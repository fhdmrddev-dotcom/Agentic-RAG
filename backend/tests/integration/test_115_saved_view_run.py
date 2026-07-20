"""Phase 115 Wave-0 — saved-view-by-name resolve RED scaffold (Plan 02 target, LIVE :54322).

The handler's saved-view mode: a `view` NAME → own-or-global lookup → resolve. An
UNKNOWN name → fall back to CATALOG (never a 403, never another user's data, never
an error) — the safe "I don't know that view, here's what you have" behavior.

Live-DB harness cloned from test_113_view_global_leak.py: PG_AVAILABLE skipif +
function-scoped pg_pool + seeded auth.users + view + docs with FK-safe teardown.
Skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 115 saved-view test",
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
        client.table("document_views").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


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


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-115-saved-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, metadata, created_at, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        doc_id, user_id, f"{metadata.get('title', 'doc')}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        metadata, created_at, is_latest, version,
    )
    return doc_id


async def _seed_view(pool, owner_id, *, name, field, value):
    view_id = uuid4()
    filter_expr = {"op": "and", "conditions": [{"field": field, "op": "eq", "value": value}]}
    await pool.execute(
        "INSERT INTO public.document_views (id, user_id, name, filter_expr, is_system_global) "
        "VALUES ($1, $2, $3, $4, false)",
        view_id, owner_id, name, filter_expr,
    )
    return view_id


@pytest_asyncio.fixture
async def seeded_user_with_view(pg_pool):
    from datetime import datetime, timezone

    base = datetime(2025, 6, 1, tzinfo=timezone.utc)
    uid = await _seed_user(pg_pool, "a")
    view_id = await _seed_view(pg_pool, uid, name="Invoices", field="document_type", value="invoice")
    inv = await _seed_doc(pg_pool, uid, metadata={"document_type": "invoice", "title": "inv-1"}, created_at=base)
    memo = await _seed_doc(pg_pool, uid, metadata={"document_type": "memo", "title": "memo-1"}, created_at=base)
    ctx = {"user_id": uid, "view_id": view_id, "inv": str(inv), "memo": str(memo)}
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM public.documents WHERE user_id = $1", uid),
            ("DELETE FROM public.document_views WHERE user_id = $1", uid),
            ("DELETE FROM audit_log WHERE user_id = $1", uid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_get_view_by_name_own_resolves(pg_pool, seeded_user_with_view):
    """get_view_by_name returns the caller's own view by case-insensitive name."""
    from app.services import document_view_service

    sb = _supabase_or_skip()
    caller = str(seeded_user_with_view["user_id"])

    row = await document_view_service.get_view_by_name("invoices", caller, supabase=sb)
    assert row is not None, "an own view must resolve by case-insensitive name"
    assert row["id"] == str(seeded_user_with_view["view_id"])
    assert row.get("user_id") == caller


@pytest.mark.asyncio
async def test_get_view_by_name_unknown_returns_none(pg_pool, seeded_user_with_view):
    """An unknown name returns None (the handler routes None → catalog, no leak)."""
    from app.services import document_view_service

    sb = _supabase_or_skip()
    caller = str(seeded_user_with_view["user_id"])

    row = await document_view_service.get_view_by_name("No Such View", caller, supabase=sb)
    assert row is None, "an unknown name must return None (existence-leak guard)"


@pytest.mark.asyncio
async def test_saved_view_by_name_resolves(pg_pool, seeded_user_with_view):
    """A `view` NAME → own-or-global lookup → resolve to the caller's matching docs."""
    from types import SimpleNamespace

    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    ctx_data = seeded_user_with_view
    caller = str(ctx_data["user_id"])

    ctx = SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)
    result = await _handle_query_documents_by_view({"view": "Invoices"}, ctx)
    payload = json.loads(result.result)

    refs = payload.get("source_refs") or payload.get("documents") or []
    ids = {r.get("document_id") or r.get("id") for r in refs}
    assert ctx_data["inv"] in ids, "the saved Invoices view must resolve the matching invoice"
    assert ctx_data["memo"] not in ids, "the non-matching memo must NOT appear"


@pytest.mark.asyncio
async def test_unknown_view_name_falls_back_to_catalog(pg_pool, seeded_user_with_view):
    """An UNKNOWN view name → CATALOG (never a 403, never another user's data, no error)."""
    from types import SimpleNamespace

    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    caller = str(seeded_user_with_view["user_id"])

    ctx = SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)
    result = await _handle_query_documents_by_view({"view": "No Such View Name"}, ctx)
    payload = json.loads(result.result)

    # Catalog fallback — never a resolve of someone else's data, never an exception.
    assert "filterable_fields" in payload or "views" in payload or "saved_views" in payload, (
        f"an unknown view name must fall back to the catalog, got {payload}"
    )
