"""Phase 111.1 (LIVE EMBED-05 / D-05) — re-embed job resumable + non-destructive.

The background re-embed job (Plan 05) must be:
  - RESUMABLE: each pass re-selects chunks where embedding_model != current, so a
    crashed/partial run picks up where it left off on the next kick. Total re-embedded
    == total stale; no double-processing.
  - NON-DESTRUCTIVE: the old vector is kept until the replacement is written (never
    delete-then-embed), so a failed/interrupted run never leaves the corpus worse than
    "partial". Only resize_embedding_column (a TRUE dims change) NULLs vectors.

These drive the REAL `reembed_job` against the LIVE :54322 inside a transaction that
ROLLS BACK — the 30-doc corpus is never mutated (the resize-test / match-filter-test
precedent). The job's supabase-py fluent surface (.table().select().eq().neq().limit()
.execute() / .update().eq().execute() / .rpc().execute()) is routed through an asyncpg
adapter so the real WHERE clauses (RLS eq(user_id), the stale predicate) hit real rows
— the job logic (predicate, batch loop, resume, non-destructive write ordering) runs
UNCHANGED. `embed_texts` is stubbed to a deterministic local vector generator so the
test needs no embedding API key (the live cross-embedder round-trip is the manual UAT
axis per the plan). Skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 re-embed tests",
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
async def test_reembed_job_is_resumable(pg_pool, monkeypatch):
    """A partial run re-selects the still-stale chunks on the next pass; total
    re-embedded == total stale, no double-processing."""
    from app.services import reembed_service

    # Deterministic local embedder — no API key, no network (the live cross-embedder
    # round-trip is the manual UAT axis, not this test).
    monkeypatch.setattr(reembed_service, "embed_texts", deterministic_embed_texts)

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            user_id = await conn.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            assert user_id is not None, "no auth.users present to fixture against"

            # 5 stale chunks tagged with the OLD model.
            doc_id, chunk_ids = await seed_stale_chunks(
                conn, user_id, n=5, stale_model="old-embedder",
            )
            current = "text-embedding-3-small"
            app_settings = make_app_settings(model=current, dims=1536)

            adapter = SupabaseTxnAdapter(conn)

            # --- Pass 1: process ONE small batch (2 of 5) then stop (interruption) ---
            await reembed_service.reembed_job(
                adapter, str(user_id), app_settings, dims_changed=False,
                max_batches=1, batch_size=2,
            )
            done_after_pass1 = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model = $2",
                chunk_ids, current,
            )
            assert 0 < done_after_pass1 < 5, (
                f"pass 1 (max_batches=1) must re-embed SOME but not all (got {done_after_pass1})"
            )

            # --- Pass 2: re-kick; resumes on the SAME stale predicate, finishes ---
            await reembed_service.reembed_job(
                adapter, str(user_id), app_settings, dims_changed=False,
            )
            done_after_pass2 = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model = $2",
                chunk_ids, current,
            )
            assert done_after_pass2 == 5, (
                f"resume must finish ALL stale chunks (got {done_after_pass2}/5)"
            )

            # No stale chunks remain (the resume predicate is exhausted).
            remaining_stale = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model IS DISTINCT FROM $2",
                chunk_ids, current,
            )
            assert remaining_stale == 0, "no stale chunk may remain after resume"
        finally:
            await tx.rollback()  # never mutate the live corpus


@pytest.mark.asyncio
async def test_reembed_job_is_non_destructive(pg_pool, monkeypatch):
    """The old vector survives until its replacement is written (no delete-then-embed);
    an interrupted run leaves every still-unprocessed chunk with its ORIGINAL vector."""
    from app.services import reembed_service

    monkeypatch.setattr(reembed_service, "embed_texts", deterministic_embed_texts)

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            user_id = await conn.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            assert user_id is not None

            doc_id, chunk_ids = await seed_stale_chunks(
                conn, user_id, n=4, stale_model="old-embedder",
            )
            current = "text-embedding-3-small"
            app_settings = make_app_settings(model=current, dims=1536)

            # No chunk has a NULL vector before the job (every seeded chunk has its old vector).
            null_before = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding IS NULL",
                chunk_ids,
            )
            assert null_before == 0, "seed must give every chunk a (stale) vector"

            adapter = SupabaseTxnAdapter(conn)
            # Run ONE small batch only (2 of 4 -> interrupt). dims_changed=False => NEVER resize/NULL.
            await reembed_service.reembed_job(
                adapter, str(user_id), app_settings, dims_changed=False,
                max_batches=1, batch_size=2,
            )

            # CONTRACT: at no point is an old vector NULLed before its replacement.
            # After an interrupted (1-batch) run with dims_changed=False, ZERO chunks
            # have a NULL vector — the unprocessed ones keep their old vector, the
            # processed ones already have their new vector (write-then-tag, never
            # delete-then-embed).
            null_after = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding IS NULL",
                chunk_ids,
            )
            assert null_after == 0, (
                "NON-DESTRUCTIVE: no chunk may have a NULL vector after an interrupted "
                "re-embed (dims_changed=False) — old vector kept until replacement written"
            )

            # The corpus is left at "partial", never worse: some done, some still stale,
            # but every row still has SOME vector.
            done = await conn.fetchval(
                "SELECT count(*) FROM public.document_chunks "
                "WHERE id = ANY($1::uuid[]) AND embedding_model = $2",
                chunk_ids, current,
            )
            assert 0 < done < 4, f"interrupted run must be partial (got {done}/4)"
        finally:
            await tx.rollback()
