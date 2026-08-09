"""Phase 115 SECURE-PHASE — the two-user cross-user GLOBAL-view leak proof via the TOOL HANDLER.

THE mandatory live proof of VIEW-06 / SC#2 at the AGENT-TOOL boundary: a single
shared GLOBAL view, resolved through `_handle_query_documents_by_view` by two
different callers, MUST return per-viewer result sets — each caller sees ONLY their
own matching documents. The RLS policy label / the caller-scope code comment is NOT
proof (the D-102 / D-110-5 "static would false-green" lesson); only two real callers
driving the REAL handler against live :54322 closes this threat.

This is the Phase-113 leak harness cloned VERBATIM, but it drives the TOOL HANDLER
(`_handle_query_documents_by_view(args, ctx)`) — NOT the route `resolve_view`. The
handler is the new in-process surface Phase 115 adds, so the leak must be re-proven
there: the handler reuses the extracted leak-safe `resolve_filter` verbatim, scoping
every documents leg from the CALLER (the dispatching user), never the view owner.

Plan 03 un-xfailed this (the handler shipped in Plan 02, dual-wired in Plan 03); it now
runs LIVE against :54322 here and again in secure-phase (the non-vacuous T-115-03-01
backstop). Skips cleanly when local Postgres is unreachable. Imports are inside the test
bodies so collection never errors on the not-yet-built handler.

Asserts (per VALIDATION.md + the 113 analog):
  (a) User A sees ONLY A's invoice matches; User B sees ONLY B's.
  (b) The result sets AND the `total` count DIFFER between the two callers.
  (c) Neither caller sees the other's document ids or filenames.
  (d) An unseeable / unknown view NAME → CATALOG (404-equivalent: never 403, never
      another user's data).
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 115 tool-leak test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


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
    """Build a service-role supabase client against the REAL local Supabase, or skip."""
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
        user_id, f"phase-115-tool-leak-{label}-{user_id}@test.local",
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


async def _seed_global_view(pool, owner_id, *, name, field, value):
    """Insert a document_views row with is_system_global=true directly (service-role).

    A global view CANNOT be created through the router (create_view hard-sets
    is_system_global=False). Globals are migration/service-role seeded only, exactly like
    global folders/skills. We seed it directly so the leak test can prove the TOOL
    HANDLER's resolve path is per-viewer for a genuinely shared view.
    """
    view_id = uuid4()
    filter_expr = {"op": "and", "conditions": [{"field": field, "op": "eq", "value": value}]}
    await pool.execute(
        "INSERT INTO public.document_views (id, user_id, name, filter_expr, is_system_global) "
        "VALUES ($1, $2, $3, $4, true)",
        view_id, owner_id, name, filter_expr,
    )
    return view_id


@pytest_asyncio.fixture
async def two_users_global_view(pg_pool):
    """Seed User A, User B, a shared GLOBAL invoice view, and per-user matching +
    non-matching docs. FK-safe teardown of everything seeded."""
    from datetime import datetime, timezone

    base = datetime(2025, 6, 1, tzinfo=timezone.utc)

    user_a = await _seed_user(pg_pool, "a")
    user_b = await _seed_user(pg_pool, "b")
    # The global view is OWNED by A but is_system_global=true → B can read it by name.
    view_id = await _seed_global_view(
        pg_pool, user_a, name="Global Invoices", field="document_type", value="invoice"
    )

    a_inv1 = await _seed_doc(pg_pool, user_a, metadata={"document_type": "invoice", "title": "A-inv-1"}, created_at=base)
    a_inv2 = await _seed_doc(pg_pool, user_a, metadata={"document_type": "invoice", "title": "A-inv-2"}, created_at=base)
    a_report = await _seed_doc(pg_pool, user_a, metadata={"document_type": "report", "title": "A-report"}, created_at=base)

    b_inv1 = await _seed_doc(pg_pool, user_b, metadata={"document_type": "invoice", "title": "B-inv-1"}, created_at=base)
    b_memo = await _seed_doc(pg_pool, user_b, metadata={"document_type": "memo", "title": "B-memo"}, created_at=base)

    ctx = {
        "user_a": user_a, "user_b": user_b, "view_id": view_id, "view_name": "Global Invoices",
        "a_inv": {str(a_inv1), str(a_inv2)}, "a_report": str(a_report),
        "b_inv": {str(b_inv1)}, "b_memo": str(b_memo),
    }
    try:
        yield ctx
    finally:
        for uid in (user_a, user_b):
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


def _make_ctx(sb, caller):
    """Minimal handler ctx bag — supabase + the dispatching user + Deep-Mode whitelist."""
    from types import SimpleNamespace

    return SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)


def _ref_ids(payload):
    refs = payload.get("source_refs") or payload.get("documents") or []
    return {r.get("document_id") or r.get("id") for r in refs}


def _ref_files(payload):
    refs = payload.get("source_refs") or payload.get("documents") or []
    return {r.get("filename") for r in refs}


@pytest.mark.asyncio
async def test_tool_global_view_resolves_per_viewer_no_cross_user_leak(pg_pool, two_users_global_view):
    """Two users, ONE global view by NAME → DIFFERENT per-viewer result sets via the HANDLER (SC#2)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("document_views table absent")
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    ctx = two_users_global_view
    view_name = ctx["view_name"]

    out_a = json.loads((await _handle_query_documents_by_view(
        {"view": view_name}, _make_ctx(sb, str(ctx["user_a"])))).result)
    out_b = json.loads((await _handle_query_documents_by_view(
        {"view": view_name}, _make_ctx(sb, str(ctx["user_b"])))).result)

    a_ids, b_ids = _ref_ids(out_a), _ref_ids(out_b)
    a_files, b_files = _ref_files(out_a), _ref_files(out_b)

    # (a) A sees ONLY A's invoice matches; B sees ONLY B's.
    assert a_ids == ctx["a_inv"], f"A must see exactly A's 2 invoices via the tool, got {a_ids}"
    assert b_ids == ctx["b_inv"], f"B must see exactly B's 1 invoice via the tool, got {b_ids}"
    assert ctx["a_report"] not in a_ids, "A's non-invoice report must not match"
    assert ctx["b_memo"] not in b_ids, "B's non-invoice memo must not match"

    # (b) Totals AND result sets DIFFER.
    assert out_a.get("total") == 2, f"A total must be 2, got {out_a.get('total')}"
    assert out_b.get("total") == 1, f"B total must be 1, got {out_b.get('total')}"
    assert out_a.get("total") != out_b.get("total"), "the two callers' totals must differ"
    assert a_ids != b_ids, "the two callers' result sets must differ"

    # (c) Neither caller sees the other's ids OR filenames — the core leak assertion.
    assert a_ids.isdisjoint(b_ids), "no document id may appear in BOTH callers' tool results"
    assert ctx["b_inv"].isdisjoint(a_ids), "A must NEVER see B's invoice id via the tool"
    assert ctx["a_inv"].isdisjoint(b_ids), "B must NEVER see A's invoice ids via the tool"
    assert a_files.isdisjoint(b_files), "no filename may leak across callers via the tool"


@pytest.mark.asyncio
async def test_tool_unseeable_view_name_falls_back_to_catalog_not_leak(pg_pool, two_users_global_view):
    """An unseeable / unknown view NAME → CATALOG (404-equivalent: never 403, never A's data)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("document_views table absent")

    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    ctx = two_users_global_view

    # A name no view has → catalog fallback, never an error, never another user's rows.
    out = json.loads((await _handle_query_documents_by_view(
        {"view": "Totally Unknown View"}, _make_ctx(sb, str(ctx["user_b"])))).result)

    assert "filterable_fields" in out or "views" in out or "saved_views" in out, (
        f"an unknown/unseeable view name must fall back to the catalog, got {out}"
    )
    leaked = _ref_ids(out)
    assert leaked.isdisjoint(ctx["a_inv"]), "catalog fallback must NOT leak A's docs"
