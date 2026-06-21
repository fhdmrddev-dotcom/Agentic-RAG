"""Phase 111.1 (LIVE D-10) — match_document_chunks excludes stale-model chunks.

After migration 073, `match_document_chunks` takes a `p_embedding_model` parameter
and filters `AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)`.
During a half-finished re-embed, chunks still tagged with the OLD model are excluded
from results — the graceful-dip recall reduction — so the search NEVER compares
across two vector spaces (Pitfall 2). RLS scope `dc.user_id = match_user_id` is kept.

Plan 04 un-marks these against the LIVE :54322 (migration 073 applied). The fixture
inserts a throwaway is_latest document + a current-model chunk + a stale-model chunk
for ONE synthetic user inside a transaction that ROLLS BACK — the live corpus is never
mutated. Skips cleanly when :54322 is unreachable.
"""

import asyncio
import json
import os
import uuid

import asyncpg
import pytest
import pytest_asyncio


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 match-filter tests",
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


async def _function_has_param(pool, fn_name: str, param: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname='public' AND p.proname=$1 "
        "AND pg_get_function_arguments(p.oid) LIKE '%' || $2 || '%')",
        fn_name, param,
    ))


def _vector_literal(dim: int = 1536, hot_index: int = 0) -> str:
    """A pgvector literal '[0,...,1,...,0]' with 1.0 at hot_index (live column is 1536-dim)."""
    vals = ["0"] * dim
    vals[hot_index] = "1"
    return "[" + ",".join(vals) + "]"


@pytest.mark.asyncio
async def test_match_function_has_embedding_model_param(pg_pool):
    assert await _function_has_param(pg_pool, "match_document_chunks", "p_embedding_model"), (
        "match_document_chunks must take p_embedding_model after migration 073 (Plan 04)"
    )


@pytest.mark.asyncio
async def test_stale_model_chunks_excluded(pg_pool):
    """A chunk tagged with the OLD embedding_model is excluded when p_embedding_model = current.

    Inserts (in a transaction that ROLLS BACK) one is_latest document + two chunks for a
    synthetic user: one tagged 'current-model', one tagged 'stale-model', BOTH with an
    identical embedding so similarity alone cannot distinguish them — only the
    p_embedding_model filter can. Asserts:
      - p_embedding_model='current-model'  -> only the current chunk returns (stale EXCLUDED)
      - p_embedding_model='stale-model'    -> only the stale chunk returns
      - p_embedding_model=NULL             -> both return (back-compat, no filter)
    """
    doc_id = uuid.uuid4()
    cur_chunk = uuid.uuid4()
    stale_chunk = uuid.uuid4()
    vec = _vector_literal(1536, hot_index=0)

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            # documents.user_id FK -> auth.users(id); use a REAL user (rollback keeps it ephemeral).
            user_id = await conn.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            assert user_id is not None, "no auth.users present to fixture against"
            await conn.execute(
                """
                INSERT INTO public.documents
                  (id, user_id, filename, file_path, file_size, mime_type, status,
                   version_number, is_latest, created_at, updated_at)
                VALUES ($1, $2, '111_1_stale_fixture.txt', 'fixtures/111_1_stale.txt',
                        10, 'text/plain', 'completed', 1, true, now(), now())
                """,
                doc_id, user_id,
            )
            for chunk_id, idx, model in (
                (cur_chunk, 0, "current-model"),
                (stale_chunk, 1, "stale-model"),
            ):
                await conn.execute(
                    """
                    INSERT INTO public.document_chunks
                      (id, document_id, user_id, content, chunk_index, embedding,
                       created_at, embedding_model, embedding_dimensions)
                    VALUES ($1, $2, $3, $4, $5, $6::vector, now(), $7, 1536)
                    """,
                    chunk_id, doc_id, user_id, f"stale-fixture chunk {idx}", idx, vec, model,
                )

            # current-model query: stale chunk must be EXCLUDED (threshold -1 so similarity never filters)
            rows_current = await conn.fetch(
                "SELECT id, content FROM public.match_document_chunks($1::vector, $2, 10, -1.0, NULL, NULL, $3)",
                vec, user_id, "current-model",
            )
            ids_current = {r["id"] for r in rows_current}
            assert cur_chunk in ids_current, "current-model chunk must be returned"
            assert stale_chunk not in ids_current, (
                "STALE-model chunk must be EXCLUDED when p_embedding_model='current-model' (D-10)"
            )

            # stale-model query: only the stale chunk
            rows_stale = await conn.fetch(
                "SELECT id FROM public.match_document_chunks($1::vector, $2, 10, -1.0, NULL, NULL, $3)",
                vec, user_id, "stale-model",
            )
            ids_stale = {r["id"] for r in rows_stale}
            assert stale_chunk in ids_stale and cur_chunk not in ids_stale, (
                "p_embedding_model='stale-model' must return only the stale chunk"
            )

            # NULL model: no filter -> both returned (back-compat)
            rows_all = await conn.fetch(
                "SELECT id FROM public.match_document_chunks($1::vector, $2, 10, -1.0, NULL, NULL, NULL)",
                vec, user_id,
            )
            ids_all = {r["id"] for r in rows_all}
            assert {cur_chunk, stale_chunk} <= ids_all, (
                "p_embedding_model=NULL must apply no model filter (both chunks returned)"
            )
        finally:
            await tx.rollback()  # never mutate the live corpus


@pytest.mark.asyncio
async def test_match_keeps_rls_user_scope(pg_pool):
    """The D-10 filter does NOT relax the RLS scope: a chunk owned by another user is
    never returned even when its model tag matches (dc.user_id = match_user_id kept, V4)."""
    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    vec = _vector_literal(1536, hot_index=0)

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            # Two DISTINCT real users (FK -> auth.users); rollback keeps the fixture ephemeral.
            user_rows = await conn.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
            if len(user_rows) < 2:
                pytest.skip("need >=2 auth.users to exercise the cross-user RLS scope")
            owner = user_rows[0]["id"]
            other = user_rows[1]["id"]
            await conn.execute(
                """
                INSERT INTO public.documents
                  (id, user_id, filename, file_path, file_size, mime_type, status,
                   version_number, is_latest, created_at, updated_at)
                VALUES ($1, $2, '111_1_rls_fixture.txt', 'fixtures/111_1_rls.txt',
                        10, 'text/plain', 'completed', 1, true, now(), now())
                """,
                doc_id, owner,
            )
            await conn.execute(
                """
                INSERT INTO public.document_chunks
                  (id, document_id, user_id, content, chunk_index, embedding,
                   created_at, embedding_model, embedding_dimensions)
                VALUES ($1, $2, $3, 'owner-only chunk', 0, $4::vector, now(), 'current-model', 1536)
                """,
                chunk_id, doc_id, owner, vec,
            )
            # Query as the OTHER user with the matching model tag.
            rows = await conn.fetch(
                "SELECT id FROM public.match_document_chunks($1::vector, $2, 10, -1.0, NULL, NULL, $3)",
                vec, other, "current-model",
            )
            assert chunk_id not in {r["id"] for r in rows}, (
                "RLS scope must exclude another user's chunk regardless of model tag (V4)"
            )
        finally:
            await tx.rollback()
