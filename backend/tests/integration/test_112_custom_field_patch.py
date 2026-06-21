"""Phase 112 Wave-0 — PATCH round-trips an enabled custom field_key (META-05).

LIVE :54322. AC9 of SPEC: a user defines a custom field (field_key like
'probe_k', type string, enabled); the PATCH route accepts that field_key,
persists the value into documents.metadata, hard-stamps _source[field_key]='user',
and writes a metadata.update audit row. The value round-trips on a re-read.

Drives the REAL route (update_document_metadata) with a service-role supabase
client. The route validates the field against
`read_enabled_field_defs(supabase, uid)` — so the seeded def must be both owned
by the caller AND enabled for the PATCH to be accepted.

Live-DB harness copied verbatim from test_111_metadata_fields_crud.py (same
DSN + skipif + pg_pool + service-role _supabase_or_skip). Skips when :54322
unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 custom-field tests",
)


def _read_local_supabase_env():
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


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _require_route():
    """Import the PATCH route or skip — keeps this file collecting (suite exit 0)
    before Task 2 lands the route. Task 2 makes this resolve and the test run live."""
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Plan 01 Task 2)")
    return documents.MetadataUpdateRequest, documents.update_document_metadata


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
async def user_doc_and_field(pg_pool):
    """Seed user + completed doc + an enabled custom field def 'probe_k'. FK-safe teardown."""
    user_id = uuid4()
    doc_id = uuid4()
    field_key = "probe_k"
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-custom-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "custom-probe.txt", f"{user_id}/custom-probe.txt",
            123, "text/plain", "completed", {"title": "Custom Field Doc"},
        )
        if not await _table_exists(pg_pool, "metadata_field_definitions"):
            pytest.skip("migration 071 not applied (metadata_field_definitions absent)")
        await pg_pool.execute(
            "INSERT INTO metadata_field_definitions "
            "(user_id, field_key, field_type, is_global, enabled) "
            "VALUES ($1, $2, $3, $4, $5)",
            user_id, field_key, "string", False, True,
        )
    except Exception as e:
        pytest.skip(f"user_doc_and_field fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id, field_key)
    for sql in (
        ("DELETE FROM metadata_field_definitions WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_custom_field_patch_round_trips_and_audits(pg_pool, user_doc_and_field):
    """AC9 — PATCH an enabled custom field_key; value round-trips, _source='user',
    and a metadata.update audit row is written."""
    MetadataUpdateRequest, update_document_metadata = _require_route()

    user_id, doc_id, field_key = user_doc_and_field
    sb = _supabase_or_skip()

    body = MetadataUpdateRequest(field=field_key, value="probe-value-42")
    result = await update_document_metadata(
        document_id=str(doc_id), body=body,
        current_user={"id": str(user_id)}, supabase=sb,
    )
    assert result["metadata"][field_key] == "probe-value-42"
    assert result["metadata"]["_source"][field_key] == "user"

    # Round-trips on a fresh read of the persisted row.
    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"]
    assert meta[field_key] == "probe-value-42", "custom field must round-trip on reload"
    assert meta["_source"][field_key] == "user"

    audit = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log "
        "WHERE action_type='metadata.update' AND metadata->>'document_id' = $1",
        str(doc_id),
    )
    assert audit == 1, "a custom-field PATCH must write a metadata.update audit row"
