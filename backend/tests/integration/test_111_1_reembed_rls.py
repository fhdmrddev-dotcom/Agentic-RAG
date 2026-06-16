"""Phase 111.1 (LIVE EMBED-05 / V4 SECURITY) — re-embed job stays RLS-scoped.

The background re-embed job MUST scope every read + write to `eq("user_id", user_id)`
(matching the `dc.user_id = match_user_id` RLS clause in match_document_chunks). A
re-embed kicked for user A must NEVER touch user B's chunks — a cross-user re-embed is
a tampering / info-disclosure boundary (T-111.1-05-01 / V4).

This drives the REAL `reembed_job` for user A against LIVE :54322 rows for TWO real
users inside a transaction that ROLLS BACK (corpus untouched). The job's supabase-py
surface is routed through an asyncpg adapter so the real RLS WHERE clause hits real
two-user rows — NOT a MagicMock asserting a call shape; the cross-user isolation is
proven by real SQL. `embed_texts` is a deterministic local stub (no API key). Skips
cleanly when :54322 is unreachable.
"""

import asyncio
import json
import os
import uuid

import asyncpg
import pytest
import pytest_asyncio

from tests.integration._reembed_adapter import (
    SupabaseTxnAdapter,
    deterministic_embed_texts,
    make_app_settings,
    seed_stale_chunks,
)


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 re-embed RLS tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_reembed_never_touches_another_users_chunks(pg_pool, monkeypatch):
    """A re-embed for user A leaves user B's stale chunks (and their embedding_model
    tags + vectors) untouched."""
    from app.services import reembed_service

    monkeypatch.setattr(reembed_service, "embed_texts", deterministic_embed_texts)

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            user_rows = await conn.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
            if len(user_rows) < 2:
                pytest.skip("need >=2 auth.users to exercise the cross-user RLS scope")
            user_a = user_rows[0]["id"]
            user_b = user_rows[1]["id"]

            current = "text-embedding-3-small"
            # Both users have stale chunks tagged with the SAME old model.
            _, a_chunks = await seed_stale_chunks(conn, user_a, n=3, stale_model="old-embedder")
            _, b_chunks = await seed_stale_chunks(conn, user_b, n=3, stale_model="old-embedder")

            # Snapshot user B's vectors + tags before the job (to prove they are untouched).
            b_before = await conn.fetch(
                "SELECT id, embedding_model, embedding::text AS vec FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) ORDER BY id",
                b_chunks,
            )

            app_settings = make_app_settings(model=current, dims=1536)
            adapter = SupabaseTxnAdapter(conn)

            # Run the job for user A only — to completion.
            await reembed_service.reembed_job(adapter, str(user_a), app_settings, dims_changed=False)

            # User A's chunks ARE re-embedded.
            a_done = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model = $2",
                a_chunks, current,
            )
            assert a_done == 3, f"user A's stale chunks must be re-embedded (got {a_done}/3)"

            # User B's chunks are COMPLETELY untouched (still stale model + identical vector).
            b_after = await conn.fetch(
                "SELECT id, embedding_model, embedding::text AS vec FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) ORDER BY id",
                b_chunks,
            )
            assert len(b_after) == 3
            for before, after in zip(b_before, b_after):
                assert after["embedding_model"] == "old-embedder", (
                    "RLS BREACH: user B's chunk model tag was changed by user A's re-embed (V4)"
                )
                assert after["vec"] == before["vec"], (
                    "RLS BREACH: user B's chunk vector was changed by user A's re-embed (V4)"
                )

            # And no cross-user chunk became stale-free under the wrong scope.
            b_still_stale = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model = 'old-embedder'",
                b_chunks,
            )
            assert b_still_stale == 3, "every user-B chunk must remain stale (never re-embedded)"
        finally:
            await tx.rollback()
