"""Phase 111.1 Wave-0 (RED) — cross-embedder ingest+search roundtrip (EMBED-04 SC#2).

A configured non-default embedder must ingest chunks AND serve search in ONE vector
space — proving the EMBED-04 / D-13 fix (`embed_chunks` threads `user_settings`) end
to end on the LIVE corpus, NOT mocked ("static would false-green").

This is the live cross-embedder proof; it lands GREEN in Plan 03/04 once `embed_chunks`
is fixed AND migration 073 is applied (Plan 04 [BLOCKING]). RED convention: live-DB
harness copied verbatim from test_111_settings_readback.py; behavioral assertions
xfail(strict=False); imports of unbuilt symbols inside the body. Skips cleanly when
:54322 is unreachable (never collection-errors).
"""

import asyncio
import json
import os

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 cross-embedder tests",
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
@pytest.mark.xfail(
    reason="cross-embedder roundtrip proven GREEN in Plan 03/04 (EMBED-04 SC#2 + migration 073)",
    strict=False,
)
async def test_configured_embedder_ingests_and_searches_one_space(pg_pool):
    """A non-default embedder ingests + searches in a single coherent vector space.

    Requires the embed_chunks fix (Plan 03) + the per-chunk embedding_model tag
    column (migration 073, Plan 04). Until then the embedding_model column is
    absent / embed_chunks drops user_settings -> xfail.
    """
    # Migration 073 adds the per-chunk tag the single-space invariant relies on.
    has_tag = bool(await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='document_chunks' "
        "AND column_name='embedding_model')"
    ))
    assert has_tag, "document_chunks.embedding_model missing — migration 073 not applied (Plan 04)"

    # The configured embedder ingests + the query path resolves the SAME client.
    from app.services.embedding_service import embed_chunks  # noqa: F401
    from app.services.retrieval_service import embed_texts  # noqa: F401

    # Full end-to-end ingest+search assertion lands with the Plan 03/04 fixtures.
    assert False, "cross-embedder roundtrip end-to-end proof pending Plan 03/04"
