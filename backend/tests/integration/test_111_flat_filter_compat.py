"""Phase 111 Wave-0 (RED) — flat @> containment still matches with _confidence present (D-111-9).

The enrichment change adds a nested `_confidence` object to documents.metadata.
The existing `search_documents` metadata_filter uses a FLAT `@>` jsonb
containment on top-level scalar keys (e.g. document_type). A metadata row that
ALSO carries a nested `_confidence` must STILL match the flat containment
filter — the nested key must not break flat top-level matching.

We seed a synthetic documents row with `{document_type:"report", _confidence:{...}}`
and assert `metadata @> '{"document_type":"report"}'::jsonb` still matches.

RED convention: xfail until Plan 04 produces such a row through the real
pipeline; the synthetic-row proof is the standing scaffold. Live-DB harness
copied verbatim from test_110_dm_schema.py. Skips when :54322 unreachable.
"""

import asyncio
import json
import os
from uuid import uuid4

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 flat-filter tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


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


@pytest_asyncio.fixture
async def seeded_doc(pg_pool):
    """Seed a throwaway user + a documents row carrying a nested _confidence."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-111-flat-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
            doc_id, user_id, "flat-filter-probe.txt", f"{user_id}/flat-probe.txt",
            123, "text/plain", "completed",
            json.dumps({
                "document_type": "report",
                "title": "Flat Filter Probe",
                "_confidence": {"document_type": 0.91, "title": 0.88},
            }),
        )
    except Exception as e:
        pytest.skip(f"seeded_doc fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id)
    for sql in (
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="real-pipeline _confidence row produced in Plan 04 (D-111-9); synthetic proof stands",
    strict=False,
)
async def test_flat_containment_still_matches_with_confidence(pg_pool, seeded_doc):
    """A flat @> containment filter on document_type still matches a row that
    also carries a nested _confidence object."""
    _user_id, doc_id = seeded_doc

    row = await pg_pool.fetchrow(
        "SELECT id FROM documents "
        "WHERE id = $1 AND metadata @> $2::jsonb",
        doc_id, json.dumps({"document_type": "report"}),
    )
    assert row is not None, (
        "flat @> containment must still match when a nested _confidence is present"
    )
    assert row["id"] == doc_id
