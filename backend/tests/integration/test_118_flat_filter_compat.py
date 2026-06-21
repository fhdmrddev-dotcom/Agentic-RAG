"""Phase 118 Wave-0 (RED) — flat @> containment still matches with _classification present (A2).

The classification pass adds a nested ``_classification`` object to documents.metadata. The
existing ``search_documents`` metadata_filter + the 113/114 ``metadata @>`` containment leg
operate on top-level scalar keys (e.g. document_type). A metadata row that ALSO carries a
nested ``_classification`` must STILL match the flat containment filter — the nested key must
not break flat top-level matching (RESEARCH Assumptions A2; mirrors the proven D-111-9 result
for ``_confidence``/``_source``).

A ``_``-prefixed key is already excluded from filters by ``validate_fields``, so a new
``_classification`` is safe by the same rule; this is the regression scaffold the RESEARCH
A2 row asks for. Clones test_111_flat_filter_compat.py verbatim (synthetic-row proof,
self-seeding). Flipped GREEN by the classification splice plan; the synthetic-row proof
stands on its own. Skips when :54322 unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 flat-filter tests",
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
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def seeded_doc(pg_pool):
    """Seed a throwaway user + a documents row carrying a nested _classification."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-118-flat-{user_id}@test.local",
        )
        # The pg_pool init registers a jsonb codec (encoder=json.dumps) — pass the dict
        # DIRECTLY (double-encoding would store a JSON string scalar and flat @> would never
        # match — the Plan-04 Rule-1 lesson from Phase 111).
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "flat-class-probe.txt", f"{user_id}/flat-class-probe.txt",
            123, "text/plain", "completed",
            {
                "document_type": "invoice",
                "title": "Flat Classification Probe",
                "_confidence": {"document_type": 0.91},
                "_classification": {
                    "rule_id": "rule-1",
                    "rule_name": "Invoices",
                    "condition_summary": "document_type = invoice",
                    "suggested_folder_id": "folder-1",
                    "suggested_folder_name": "Invoices",
                    "status": "suggested",
                },
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
async def test_flat_containment_still_matches_with_classification(pg_pool, seeded_doc):
    """A flat @> containment filter on document_type still matches a row that ALSO carries a
    nested _classification object (RESEARCH A2 — the `_`-prefix-is-safe rule, like D-111-9).

    GREEN on its own: the synthetic-row proof self-seeds a row with nested ``_classification``;
    no real-pipeline run is required to prove the nested key doesn't break flat top-level
    ``@>`` matching.
    """
    _user_id, doc_id = seeded_doc

    row = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"document_type": "invoice"},
    )
    assert row is not None, (
        "flat @> containment must still match when a nested _classification is present"
    )
    assert row["id"] == doc_id

    # And the flat filter does NOT spuriously match the wrong document_type.
    miss = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"document_type": "receipt"},
    )
    assert miss is None, "flat @> must not match a different document_type"
