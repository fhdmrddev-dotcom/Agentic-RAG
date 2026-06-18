"""Phase 113 SECURE-PHASE — the two-user cross-user GLOBAL-view leak test (T-113-09).

THE mandatory live proof of VIEW-06 / SC#3: a single shared GLOBAL view, resolved
by two different callers, MUST return per-viewer result sets — each caller sees
ONLY their own matching documents. The RLS policy label / the caller-scope code
comment is NOT proof (the D-102 / D-110-5 "static would false-green" lesson); only
two real callers hitting the REAL `resolve_view` coroutine against live :54322
closes this threat.

Authored under VALIDATION.md §Manual-Only and run HERE in secure-phase (deferred
from execute-phase by design). This file is NOT under backend/app/ — it is a
verification artifact, not an implementation change.

A GLOBAL view cannot be created through the router (`create_view` hard-sets
`is_global=False` — that IS T-113-13), so the seeded global row is inserted
directly via service-role asyncpg with `is_global=true`.

Asserts (per VALIDATION.md:79):
  (a) User A sees ONLY A's invoice matches; User B sees ONLY B's.
  (b) The result sets AND the `total` count DIFFER between the two callers.
  (c) Neither caller sees the other's document ids or filenames.
  (d) A zero-match caller gets `{documents: [], total: 0}` — never an error, never
      another user's data.
  (e) Resolve of a nonexistent / unseeable id → HTTPException(404), never 403.

Live-DB harness copied verbatim from test_113_view_crud.py (skips cleanly when
:54322 is unreachable; FK-safe teardown of documents + document_views + audit_log
+ auth.users for both seeded users and the seeded global view).
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio
from fastapi import HTTPException


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 113 leak test",
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
    """Function-scoped real asyncpg pool against local Postgres :54322."""
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


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-113-leak-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, metadata, created_at, is_latest=True, version=1):
    """Insert one documents row (jsonb codec passes the dict directly). Returns its id."""
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


async def _seed_global_view(pool, owner_id, *, field, value):
    """Insert a document_views row with is_global=true directly (service-role).

    A global view CANNOT be created through the router (create_view hard-sets
    is_global=False — that hard-set IS T-113-13). Globals are migration/service-role
    seeded only, exactly like global folders/skills. We seed it directly here so the
    leak test can prove the RESOLVE path is per-viewer for a genuinely shared view.
    """
    view_id = uuid4()
    filter_expr = {"op": "and", "conditions": [{"field": field, "op": "eq", "value": value}]}
    await pool.execute(
        "INSERT INTO public.document_views (id, user_id, name, filter_expr, is_global) "
        "VALUES ($1, $2, $3, $4, true)",
        view_id, owner_id, "Global Invoices", filter_expr,
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
    # The global view is OWNED by A (the seeding owner) but is_global=true → B can read it.
    view_id = await _seed_global_view(pg_pool, user_a, field="document_type", value="invoice")

    # User A: 2 matching invoices + 1 non-matching report.
    a_inv1 = await _seed_doc(pg_pool, user_a, metadata={"document_type": "invoice", "title": "A-inv-1"}, created_at=base)
    a_inv2 = await _seed_doc(pg_pool, user_a, metadata={"document_type": "invoice", "title": "A-inv-2"}, created_at=base)
    a_report = await _seed_doc(pg_pool, user_a, metadata={"document_type": "report", "title": "A-report"}, created_at=base)

    # User B: 1 matching invoice + 1 non-matching memo (DIFFERENT count → totals differ).
    b_inv1 = await _seed_doc(pg_pool, user_b, metadata={"document_type": "invoice", "title": "B-inv-1"}, created_at=base)
    b_memo = await _seed_doc(pg_pool, user_b, metadata={"document_type": "memo", "title": "B-memo"}, created_at=base)

    ctx = {
        "user_a": user_a, "user_b": user_b, "view_id": view_id,
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


@pytest.mark.asyncio
async def test_global_view_resolves_per_viewer_no_cross_user_leak(pg_pool, two_users_global_view):
    """Two users, ONE global view → DIFFERENT per-viewer result sets, no leak (T-113-09/SC#3)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import resolve_view

    sb = _supabase_or_skip()
    ctx = two_users_global_view
    view_id = str(ctx["view_id"])

    # Both callers resolve the SAME global view id.
    out_a = await resolve_view(view_id=view_id, current_user={"id": str(ctx["user_a"])}, supabase=sb)
    out_b = await resolve_view(view_id=view_id, current_user={"id": str(ctx["user_b"])}, supabase=sb)

    a_ids = {d["id"] for d in out_a["documents"]}
    b_ids = {d["id"] for d in out_b["documents"]}
    a_files = {d["filename"] for d in out_a["documents"]}
    b_files = {d["filename"] for d in out_b["documents"]}

    # (a) A sees ONLY A's invoice matches; B sees ONLY B's.
    assert a_ids == ctx["a_inv"], f"A must see exactly A's 2 invoices, got {a_ids}"
    assert b_ids == ctx["b_inv"], f"B must see exactly B's 1 invoice, got {b_ids}"

    # Non-matching docs of each user are excluded from their OWN resolve too.
    assert ctx["a_report"] not in a_ids, "A's non-invoice report must not match the invoice view"
    assert ctx["b_memo"] not in b_ids, "B's non-invoice memo must not match the invoice view"

    # (b) Result sets AND totals DIFFER.
    assert out_a["total"] == 2, f"A total must be 2, got {out_a['total']}"
    assert out_b["total"] == 1, f"B total must be 1, got {out_b['total']}"
    assert out_a["total"] != out_b["total"], "the two callers' totals must differ"
    assert a_ids != b_ids, "the two callers' result sets must differ"
    assert out_a["total"] == len(out_a["documents"])
    assert out_b["total"] == len(out_b["documents"])

    # (c) Neither caller sees the other's ids OR filenames — the core leak assertion.
    assert a_ids.isdisjoint(b_ids), "no document id may appear in BOTH callers' resolves"
    assert ctx["b_inv"].isdisjoint(a_ids), "A must NEVER see B's invoice id"
    assert ctx["a_inv"].isdisjoint(b_ids), "B must NEVER see A's invoice ids"
    assert a_files.isdisjoint(b_files), "no filename may leak across callers"
    # Belt-and-braces: B's invoice filename must not appear anywhere in A's listing.
    b_inv_filenames = {
        (await pg_pool.fetchrow("SELECT filename FROM documents WHERE id = $1", bid))["filename"]
        for bid in ctx["b_inv"]
    }
    assert b_inv_filenames.isdisjoint(a_files), "B's invoice filename leaked into A's resolve"


@pytest.mark.asyncio
async def test_global_view_zero_match_caller_gets_empty_not_leak(pg_pool, two_users_global_view):
    """A caller with ZERO matching docs gets {documents: [], total: 0} — never an error,
    never another user's data (T-113-09 (d))."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import resolve_view

    sb = _supabase_or_skip()
    ctx = two_users_global_view
    view_id = str(ctx["view_id"])

    # A brand-new third user with NO documents at all resolves the shared global view.
    user_c = await _seed_user(pg_pool, "c")
    try:
        out_c = await resolve_view(view_id=view_id, current_user={"id": str(user_c)}, supabase=sb)
        # Empty, honest, and NOT another user's rows.
        assert out_c["documents"] == [], "a zero-match caller must get an empty list"
        assert out_c["total"] == 0, "a zero-match caller must get total=0"
        c_ids = {d["id"] for d in out_c["documents"]}
        assert c_ids.isdisjoint(ctx["a_inv"]), "zero-match caller must NOT receive A's docs"
        assert c_ids.isdisjoint(ctx["b_inv"]), "zero-match caller must NOT receive B's docs"
    finally:
        for sql in (
            ("DELETE FROM public.documents WHERE user_id = $1", user_c),
            ("DELETE FROM public.document_views WHERE user_id = $1", user_c),
            ("DELETE FROM audit_log WHERE user_id = $1", user_c),
            ("DELETE FROM auth.users WHERE id = $1", user_c),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_global_view_nonexistent_or_unseeable_id_404(pg_pool, two_users_global_view):
    """Resolve of a nonexistent / unseeable view id → HTTPException(404), never 403
    (T-113-09 (e) / T-113-10)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCondition, ViewCreate, ViewFilter

    sb = _supabase_or_skip()
    ctx = two_users_global_view

    # (1) A nonexistent random id → 404.
    with pytest.raises(HTTPException) as ei_missing:
        await resolve_view(view_id=str(uuid4()), current_user={"id": str(ctx["user_a"])}, supabase=sb)
    assert ei_missing.value.status_code == 404, "nonexistent id must be 404, not 403"

    # (2) An id that exists but is PRIVATE to another user (unseeable) → 404, not 403.
    #     User A creates a private (non-global) view; User B resolves it → 404.
    a_private = await create_view(
        body=ViewCreate(
            name="A private",
            filter_expr=ViewFilter(op="and", conditions=[ViewCondition(field="document_type", op="eq", value="report")]),
        ),
        current_user={"id": str(ctx["user_a"])},
        supabase=sb,
    )
    with pytest.raises(HTTPException) as ei_unseeable:
        await resolve_view(view_id=str(a_private["id"]), current_user={"id": str(ctx["user_b"])}, supabase=sb)
    assert ei_unseeable.value.status_code == 404, "an unseeable private view must be 404, not 403"
