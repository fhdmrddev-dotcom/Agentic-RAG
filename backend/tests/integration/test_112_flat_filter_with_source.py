"""Phase 112 Wave-0 — flat @> containment still matches with _confidence AND _source present.

LIVE :54322. AC8 of SPEC / D-111-9: the PATCH route adds a nested `_source`
object as a sibling of the existing nested `_confidence`. A metadata row that
carries BOTH nested objects must STILL match a flat `@>` top-level containment
filter (document_type / title) — neither nested key may break flat matching,
and a negative control (a non-matching document_type) must NOT match.

EXTENDS test_111_flat_filter_compat.py: the seed dict here carries BOTH
`_confidence` AND `_source` sub-keys. This is a synthetic-row proof (the fixture
self-seeds the exact shape the PATCH route + merge guard produce), so it is
GREEN immediately — no route call required to prove the containment invariant.

Live-DB harness copied verbatim from test_111_flat_filter_compat.py. Skips when
:54322 unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 flat-filter tests",
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


@pytest_asyncio.fixture
async def seeded_doc(pg_pool):
    """Seed a documents row carrying BOTH a nested _confidence AND a nested _source.

    The pg_pool init registers a jsonb codec (encoder=json.dumps), so the dict is
    passed DIRECTLY — wrapping it in json.dumps here would double-encode it into a
    JSON string scalar and a flat `@>` object containment would never match (the
    Phase-111 Plan-04 Rule-1 fix).
    """
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-flat-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "flat-source-probe.txt", f"{user_id}/flat-source-probe.txt",
            123, "text/plain", "completed",
            {
                "document_type": "report",
                "title": "Flat Filter With Source",
                # BOTH nested display-only objects present — the PATCH/merge shape.
                "_confidence": {"document_type": 0.91, "title": 0.88},
                "_source": {"title": "user"},
            },
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
async def test_flat_containment_matches_with_confidence_and_source(pg_pool, seeded_doc):
    """AC8 — flat @> on document_type still matches a row carrying BOTH _confidence
    and _source nested objects."""
    _user_id, doc_id = seeded_doc

    row = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"document_type": "report"},
    )
    assert row is not None, (
        "flat @> containment must still match when nested _confidence AND _source are present"
    )
    assert row["id"] == doc_id


@pytest.mark.asyncio
async def test_flat_containment_matches_on_title(pg_pool, seeded_doc):
    """AC8 — flat @> on the title scalar also still matches with _source present."""
    _user_id, doc_id = seeded_doc

    row = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"title": "Flat Filter With Source"},
    )
    assert row is not None, "flat @> on title must still match with nested _source present"


@pytest.mark.asyncio
async def test_negative_control_non_matching_document_type(pg_pool, seeded_doc):
    """AC8 negative control — a non-matching document_type must NOT match the row,
    confirming @> is doing real value comparison (not matching everything)."""
    _user_id, doc_id = seeded_doc

    row = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"document_type": "invoice"},
    )
    assert row is None, "a non-matching document_type must NOT match (negative control)"
