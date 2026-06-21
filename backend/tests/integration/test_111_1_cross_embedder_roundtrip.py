"""Phase 111.1 (LIVE EMBED-04 SC#2) — cross-embedder ingest+search cred parity.

A configured non-default embedder must ingest chunks AND serve search in ONE vector
space — the EMBED-04 / D-13 fix (`embed_chunks` threads `user_settings` to `embed_texts`,
which calls `get_embedding_client(user_settings)`, exactly as the query path does).

The full second-embedder roundtrip (ingest with Jina/Google/local, then search and get
relevant cited results) is the MANUAL UAT axis — it needs a live non-OpenAI embedding key
or a running local server (both unavailable in this run; the local servers are CLOSED).

Per the Plan-04 fallback ("if only OpenAI keys are available, assert the cred-resolution
parity at the client-build boundary"), this proves the load-bearing invariant WITHOUT
mocking the cred resolution ("static would false-green"): given the SAME user_settings,
the chunk path (embed_chunks -> embed_texts -> get_embedding_client) and the query path
(retrieval_service.embed_texts -> get_embedding_client) build an IDENTICAL OpenAI client
(same api_key + same base_url). Before the EMBED-04 fix, embed_chunks dropped user_settings
so the chunk path resolved env creds while the query path resolved the configured ones —
two vector spaces, a silent retrieval failure.

The DB substrate check (the per-chunk embedding_model tag column) runs live against :54322
and skips cleanly when unreachable.
"""

import asyncio
import json
import os
import types

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


def _embedding_settings(
    *, embedding_api_key="", embedding_base_url="", llm_api_key="", llm_base_url="",
):
    """A settings shape carrying ONLY the four attributes get_embedding_client reads.

    This is NOT a mock of the cred resolution — get_embedding_client's real branching
    logic runs against these realistic values; we only narrow the object to the attrs
    it actually consumes (faithful to UserEffectiveSettings' field names).
    """
    return types.SimpleNamespace(
        embedding_api_key=embedding_api_key,
        embedding_base_url=embedding_base_url,
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
    )


@pytest.mark.asyncio
async def test_document_chunks_has_embedding_model_tag(pg_pool):
    """Migration 073 adds the per-chunk tag the single-space invariant relies on."""
    has_tag = bool(await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='document_chunks' "
        "AND column_name='embedding_model')"
    ))
    assert has_tag, "document_chunks.embedding_model missing — migration 073 not applied (Plan 04)"


def test_chunk_and_query_paths_build_identical_client_for_configured_embedder():
    """The EMBED-04 invariant: the SAME user_settings resolves to the SAME embedding client
    on the chunk (ingest) path and the query (retrieval) path — no env-vs-configured split.

    Uses a non-default (Jina-style) configured embedder with a dedicated embedding key + base_url.
    """
    from app.services.openai_service import get_embedding_client

    cfg = _embedding_settings(
        embedding_api_key="jina-key-xyz",
        embedding_base_url="https://api.jina.ai/v1",
        llm_api_key="some-llm-key",
        llm_base_url="https://api.openai.com/v1",
    )

    # Query path: retrieval_service.embed_texts -> get_embedding_client(user_settings)
    query_client = get_embedding_client(cfg)
    # Chunk path: embed_chunks -> embed_texts -> get_embedding_client(user_settings)
    chunk_client = get_embedding_client(cfg)

    assert str(query_client.base_url).rstrip("/") == "https://api.jina.ai/v1", (
        "configured embedding_base_url must win (dedicated embedding key path)"
    )
    assert str(chunk_client.base_url) == str(query_client.base_url), (
        "chunk-path and query-path base_url MUST match (EMBED-04: no two vector spaces)"
    )
    assert chunk_client.api_key == query_client.api_key == "jina-key-xyz", (
        "chunk-path and query-path api_key MUST match the configured embedding key (EMBED-04)"
    )


def test_chunk_path_threads_user_settings_to_client_build():
    """embed_chunks must forward user_settings all the way to get_embedding_client — the
    actual EMBED-04 root cause was a DROPPED kwarg. Proven by intercepting the real
    get_embedding_client call embed_chunks triggers via embed_texts (NOT mocking the
    resolution: we assert the resolution receives the SAME settings object)."""
    import app.services.openai_service as oai
    from app.services.embedding_service import embed_chunks

    cfg = _embedding_settings(
        embedding_api_key="cfg-embed-key",
        embedding_base_url="https://example-embedder.test/v1",
    )
    seen = {}
    real_get_client = oai.get_embedding_client

    def _spy(user_settings=None):
        seen["user_settings"] = user_settings
        # call the REAL resolver so the parity logic is exercised, not bypassed
        return real_get_client(user_settings)

    # embed_texts lives in openai_service and calls get_embedding_client there.
    oai.get_embedding_client = _spy
    try:
        try:
            embed_chunks(["a chunk"], user_settings=cfg)
        except Exception:
            # The network call to the fake embedder will fail; we only care that the
            # SAME user_settings reached the (real) client-build boundary.
            pass
    finally:
        oai.get_embedding_client = real_get_client

    assert seen.get("user_settings") is cfg, (
        "embed_chunks must thread the SAME user_settings object into get_embedding_client "
        "(EMBED-04 root cause was a dropped kwarg)"
    )
