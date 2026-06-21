"""Phase 112 Wave-0 — PATCH /documents/{id}/metadata writes a metadata.update audit row.

LIVE :54322. AC5 of SPEC: after a successful PATCH, exactly one new
audit_log row with action_type='metadata.update' and
metadata->>'document_id' == the doc id is written (baseline today = 0).

Drives the REAL route function (update_document_metadata) with a service-role
supabase client + a current_user dict — the same direct-call pattern used by
test_111_metadata_fields_crud.py (which calls the real service functions). The
asyncpg pool is used only for seeding + assertion (count-before / count-after).

Live-DB harness (DSN env var, _pg_reachable skipif, jsonb-codec pg_pool,
seeded auth.users + documents fixture) copied verbatim from
test_111_flat_filter_compat.py. Skips cleanly when :54322 unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 audit tests",
)


def _require_route():
    """Import the PATCH route or skip — keeps this file collecting (suite exit 0)
    before Task 2 lands the route. Task 2 makes this resolve and the test run live."""
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Plan 01 Task 2)")
    return documents.MetadataUpdateRequest, documents.update_document_metadata


def _read_local_supabase_env():
    """Read the REAL local SUPABASE_URL + service-role key from backend/.env.

    The conftest plants a fake cloud SUPABASE_URL at import time so the suite runs
    against a mock client; these live tests drive the actual route against the local
    REST gate, so they source the two values straight from backend/.env.
    Modeled on test_111_metadata_fields_crud.py / test_093_ask_user_workflow_run_live.py.
    """
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    try:
        client.table("documents").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


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
    """Seed a throwaway user + a completed documents row; FK-safe teardown."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-audit-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "audit-probe.txt", f"{user_id}/audit-probe.txt",
            123, "text/plain", "completed",
            {"title": "Original Title", "document_type": "report"},
        )
    except Exception as e:
        pytest.skip(f"seeded_doc fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id)
    for sql in (
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_patch_writes_metadata_update_audit_row(pg_pool, seeded_doc):
    """AC5 — a successful PATCH increments the metadata.update audit count by 1
    for this document (baseline = 0)."""
    MetadataUpdateRequest, update_document_metadata = _require_route()

    user_id, doc_id = seeded_doc
    sb = _supabase_or_skip()

    before = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log "
        "WHERE action_type='metadata.update' AND metadata->>'document_id' = $1",
        str(doc_id),
    )
    assert before == 0, "baseline metadata.update count for a fresh doc must be 0"

    body = MetadataUpdateRequest(field="title", value="Edited By A Human")
    result = await update_document_metadata(
        document_id=str(doc_id), body=body,
        current_user={"id": str(user_id)}, supabase=sb,
    )
    assert result["metadata"]["title"] == "Edited By A Human"
    assert result["metadata"]["_source"]["title"] == "user", "server hard-stamps _source='user'"

    after = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log "
        "WHERE action_type='metadata.update' AND metadata->>'document_id' = $1",
        str(doc_id),
    )
    assert after == before + 1, "a successful PATCH must write exactly one metadata.update audit row"

    # The persisted documents row reflects the edit + the _source stamp (reload reconcile).
    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"]
    assert meta["title"] == "Edited By A Human"
    assert meta["_source"]["title"] == "user"
