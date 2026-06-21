"""Phase 111.1 (LIVE EMBED-05) — resize_embedding_column resizes + rebuilds HNSW.

`resize_embedding_column(new_dim)` (re-declared as the migration-073 source of truth)
must: DROP the HNSW index, ALTER document_chunks.embedding TYPE vector(new_dim) USING NULL,
then rebuild the HNSW index. It is wired into the re-embed job (Plan 05) and only called
on a TRUE dims change.

A4 (the function has never been called live; USING NULL wipes existing vectors). So this
test NEVER runs the live function against the real :54322 corpus. Instead it:
  1. asserts the live function EXISTS + its source body carries the EMBED-05 contract
     (drop index, ALTER ... vector(%s) USING NULL, recreate HNSW), and
  2. proves the resize MECHANICS (drop index -> alter vector dim -> rebuild HNSW index)
     against a SCRATCH table that clones document_chunks' embedding shape, inside a
     transaction that ROLLS BACK — the live corpus is never touched.

Skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 resize tests",
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


async def _function_exists(pool, fn_name: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname='public' AND p.proname=$1)",
        fn_name,
    ))


async def _function_def(pool, fn_name: str) -> str:
    return await pool.fetchval(
        "SELECT pg_get_functiondef(p.oid) FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname='public' AND p.proname=$1",
        fn_name,
    )


@pytest.mark.asyncio
async def test_resize_embedding_column_exists(pg_pool):
    assert await _function_exists(pg_pool, "resize_embedding_column"), (
        "resize_embedding_column must exist (re-declared in migration 073, Plan 04)"
    )


@pytest.mark.asyncio
async def test_resize_function_body_carries_embed05_contract(pg_pool):
    """Static check of the LIVE function source — never executes it on the corpus (A4).

    The EMBED-05 contract: drop the HNSW index, ALTER the embedding column to vector(N)
    USING NULL (incompatible dims wipe the old vectors), recreate the HNSW index.
    """
    src = (await _function_def(pg_pool, "resize_embedding_column")) or ""
    low = src.lower()
    assert "drop index" in low and "document_chunks_embedding_idx" in low, (
        "resize must DROP the HNSW index"
    )
    assert "alter column embedding type" in low and "using null" in low, (
        "resize must ALTER embedding TYPE vector(%s) USING NULL (incompatible dims)"
    )
    assert "hnsw" in low and "vector_cosine_ops" in low, (
        "resize must recreate the HNSW (vector_cosine_ops) index"
    )


@pytest.mark.asyncio
async def test_resize_mechanics_on_scratch_table(pg_pool):
    """Prove drop-index -> alter-dim -> rebuild-HNSW MECHANICS on a SCRATCH clone of the
    embedding shape, inside a transaction that ROLLS BACK. The live document_chunks corpus
    is NEVER touched (A4). Mirrors the resize_embedding_column body exactly but parameterized
    on a throwaway table name."""
    scratch = "tmp_111_1_resize_" + uuid.uuid4().hex[:8]

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(
                f"CREATE TABLE public.{scratch} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
                f"embedding public.vector(1536))"
            )
            await conn.execute(
                f"CREATE INDEX {scratch}_embedding_idx ON public.{scratch} "
                f"USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
            )
            # Seed a row so we can confirm USING NULL wipes the vector.
            await conn.execute(
                f"INSERT INTO public.{scratch} (embedding) VALUES ($1::vector)",
                "[" + ",".join(["0"] * 1535 + ["1"]) + "]",
            )

            # --- resize mechanics (the resize_embedding_column body, on the scratch table) ---
            new_dim = 768
            await conn.execute(f"DROP INDEX IF EXISTS public.{scratch}_embedding_idx")
            await conn.execute(
                f"ALTER TABLE public.{scratch} ALTER COLUMN embedding TYPE public.vector({new_dim}) USING NULL"
            )
            await conn.execute(
                f"CREATE INDEX {scratch}_embedding_idx ON public.{scratch} "
                f"USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
            )

            # column type changed to vector(768)
            new_typmod = await conn.fetchval(
                "SELECT a.atttypmod FROM pg_attribute a "
                "JOIN pg_class c ON c.oid = a.attrelid "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname='public' AND c.relname=$1 AND a.attname='embedding'",
                scratch,
            )
            assert new_typmod == new_dim, f"embedding dim must be {new_dim} after resize, got {new_typmod}"

            # HNSW index exists again
            idx_exists = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_indexes "
                "WHERE schemaname='public' AND tablename=$1 AND indexname=$2)",
                scratch, f"{scratch}_embedding_idx",
            )
            assert idx_exists, "HNSW index must be recreated after the resize"

            # USING NULL wiped the seeded vector
            null_count = await conn.fetchval(
                f"SELECT count(*) FROM public.{scratch} WHERE embedding IS NULL"
            )
            assert null_count == 1, "USING NULL must wipe the pre-existing vector (incompatible dims)"
        finally:
            await tx.rollback()  # drops the scratch table; live corpus untouched
