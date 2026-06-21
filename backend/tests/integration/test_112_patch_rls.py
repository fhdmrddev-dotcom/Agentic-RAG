"""Phase 112 Wave-0 — PATCH /documents/{id}/metadata is owner-scoped → 404, never 403.

LIVE :54322. AC6 of SPEC: a non-owner PATCH returns 404 (no existence leak),
never 403; the "Saved" receipt path is only reachable on a 200. Mirrors the
move_document / reextract_document RLS posture (T-112-01-01/02).

Drives the REAL route with a service-role supabase client + a non-owner
current_user dict — the route's app-side .eq('user_id', uid) on BOTH the SELECT
and the UPDATE is what enforces ownership (the service-role client bypasses DB
RLS, exactly as the BackgroundTask paths do, so the app-side scope is the
control under test).

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 RLS tests",
)


def _require_route():
    """Import the PATCH route or skip — keeps this file collecting (suite exit 0)
    before Task 2 lands the route. Task 2 makes this resolve and the test run live."""
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Plan 01 Task 2)")
    return documents.MetadataUpdateRequest, documents.update_document_metadata


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
async def doc_owned_by_a(pg_pool):
    """Seed user A + user B + a documents row owned by A; FK-safe teardown."""
    user_a = uuid4()
    user_b = uuid4()
    doc_id = uuid4()
    try:
        for uid, tag in ((user_a, "a"), (user_b, "b")):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-112-rls-{tag}-{uid}@test.local",
            )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_a, "rls-probe.txt", f"{user_a}/rls-probe.txt",
            123, "text/plain", "completed",
            {"title": "Owned by A"},
        )
    except Exception as e:
        pytest.skip(f"doc_owned_by_a fixture setup failed: {type(e).__name__}: {e}")
    yield (user_a, user_b, doc_id)
    for sql in (
        ("DELETE FROM audit_log WHERE user_id = ANY($1::uuid[])", [user_a, user_b]),
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [user_a, user_b]),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_non_owner_patch_returns_404_not_403(pg_pool, doc_owned_by_a):
    """AC6 — user B PATCHing user A's document gets 404 (no existence leak), never 403."""
    from fastapi import HTTPException

    MetadataUpdateRequest, update_document_metadata = _require_route()

    user_a, user_b, doc_id = doc_owned_by_a
    sb = _supabase_or_skip()

    body = MetadataUpdateRequest(field="title", value="Hijacked")
    with pytest.raises(HTTPException) as exc:
        await update_document_metadata(
            document_id=str(doc_id), body=body,
            current_user={"id": str(user_b)}, supabase=sb,
        )
    assert exc.value.status_code == 404, "non-owner PATCH must be 404 (no existence leak)"
    assert exc.value.status_code != 403, "must never be 403 (that would leak existence)"

    # The document was NOT mutated by the non-owner attempt.
    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    assert row["metadata"]["title"] == "Owned by A", "non-owner PATCH must not mutate the row"
    assert "_source" not in row["metadata"], "no _source stamp from a rejected non-owner PATCH"

    # No audit row was written for the rejected attempt.
    audit = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log "
        "WHERE action_type='metadata.update' AND metadata->>'document_id' = $1",
        str(doc_id),
    )
    assert audit == 0, "a rejected non-owner PATCH must write no audit row"


@pytest.mark.asyncio
async def test_owner_patch_succeeds(pg_pool, doc_owned_by_a):
    """The 'Saved' path: user A (the owner) PATCHing their own doc gets a 200-shaped result."""
    MetadataUpdateRequest, update_document_metadata = _require_route()

    user_a, _user_b, doc_id = doc_owned_by_a
    sb = _supabase_or_skip()

    body = MetadataUpdateRequest(field="title", value="Owner Edit")
    result = await update_document_metadata(
        document_id=str(doc_id), body=body,
        current_user={"id": str(user_a)}, supabase=sb,
    )
    assert result["metadata"]["title"] == "Owner Edit"
    assert result["metadata"]["_source"]["title"] == "user"
