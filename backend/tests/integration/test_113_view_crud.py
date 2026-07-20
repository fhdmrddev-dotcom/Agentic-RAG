"""Phase 113 Wave-0 — live /document-views CRUD + view.create audit + 404-not-403.

Drives the REAL router coroutines (`app.api.document_views`) against a live
service-role Supabase client on :54322 — NOT a mock. Two security-load-bearing
behaviors are proven here:

  - `test_create_writes_audit` — create a view, then SELECT the `view.create`
    audit row back via raw asyncpg. The audit-service write SWALLOWS errors (the
    104 lesson: a static/mocked check FALSE-GREENS an enum drift), so the LIVE
    round-trip is the only real verification.
  - `test_cross_user_miss_404` — User B's GET/PATCH/DELETE/resolve of User A's
    private view returns 404 (HTTPException(404)), NEVER 403 — no existence leak
    (D-113-4 / T-113-10).

The live-DB harness (PG_AVAILABLE skipif + function-scoped pg_pool + seeded
auth.users with FK-safe teardown incl. `DELETE FROM audit_log` and
`DELETE FROM document_views`) is copied verbatim from
test_111_metadata_fields_crud.py — it skips cleanly (never collection-errors)
when :54322 is unreachable.

The two-user cross-user GLOBAL-view leak test (SC#3 / VIEW-06) is authored under
VALIDATION.md and run in secure-phase (the D-102/D-110-5 "static would
false-green" lesson) — it is NOT duplicated here.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 113 CRUD tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_env():
    """Read the REAL local SUPABASE_URL + service-role key from backend/.env.

    The conftest plants a fake cloud SUPABASE_URL at import time; these live tests
    drive the actual service against the local REST gate, so they source the two
    values straight from backend/.env. Returns None if either is absent → skip.
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


@pytest_asyncio.fixture
async def test_user(pg_pool):
    """Seed a throwaway auth.users row; FK-safe teardown (views + audit + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-113-crud-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.document_views WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


def _filter_eq(field: str, value):
    """Build a one-condition `eq` ViewFilter."""
    from app.models.document_view import ViewCondition, ViewFilter
    return ViewFilter(op="and", conditions=[ViewCondition(field=field, op="eq", value=value)])


@pytest.mark.asyncio
async def test_create_writes_audit(pg_pool, test_user):
    """Creating a view writes a `view.create` audit row for that view_id (LIVE)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")

    from app.api.document_views import create_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    body = ViewCreate(name="Invoices", filter_expr=_filter_eq("document_type", "invoice"))
    created = await create_view(
        body=body, current_user={"id": str(test_user)}, supabase=sb
    )
    assert created["name"] == "Invoices"
    assert created["is_system_global"] is False, "create must hard-set is_system_global=false"

    # The audit write SWALLOWS errors — the LIVE round-trip is the real proof.
    row = await pg_pool.fetchrow(
        "SELECT action_type, metadata FROM audit_log "
        "WHERE user_id = $1 AND action_type = $2 "
        "AND metadata->>'view_id' = $3",
        test_user, "view.create", str(created["id"]),
    )
    assert row is not None, (
        "view.create audit row did not land — either CHECK enum drift OR "
        "write_audit_entry swallowed an error"
    )
    assert row["action_type"] == "view.create"


@pytest.mark.asyncio
async def test_cross_user_miss_404(pg_pool, test_user):
    """User B's GET/PATCH/DELETE/resolve of User A's private view → 404 (never 403)."""
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")

    from app.api.document_views import (
        create_view,
        delete_view,
        resolve_view,
        update_view,
    )
    from app.models.document_view import ViewCreate, ViewUpdate

    sb = _supabase_or_skip()

    # User A owns a private view.
    a_view = await create_view(
        body=ViewCreate(name="A private", filter_expr=_filter_eq("document_type", "report")),
        current_user={"id": str(test_user)},
        supabase=sb,
    )
    a_view_id = str(a_view["id"])

    # User B exists but does NOT own that view.
    user_b = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_b, f"phase-113-crud-b-{user_b}@test.local",
    )
    b_ctx = {"id": str(user_b)}
    try:
        # GET/resolve of A's view by B → 404 (readability gate: not own, not global).
        with pytest.raises(HTTPException) as ei_resolve:
            await resolve_view(view_id=a_view_id, current_user=b_ctx, supabase=sb)
        assert ei_resolve.value.status_code == 404, "cross-user resolve must be 404, not 403"

        # PATCH of A's view by B → 404 (own-scoped update misses → None → 404).
        with pytest.raises(HTTPException) as ei_patch:
            await update_view(
                view_id=a_view_id,
                body=ViewUpdate(name="hijacked"),
                current_user=b_ctx,
                supabase=sb,
            )
        assert ei_patch.value.status_code == 404, "cross-user patch must be 404, not 403"

        # DELETE of A's view by B → 404 (own-scoped delete misses → False → 404).
        with pytest.raises(HTTPException) as ei_delete:
            await delete_view(view_id=a_view_id, current_user=b_ctx, supabase=sb)
        assert ei_delete.value.status_code == 404, "cross-user delete must be 404, not 403"

        # A nonexistent id → 404 too (no existence leak).
        with pytest.raises(HTTPException) as ei_missing:
            await resolve_view(view_id=str(uuid4()), current_user=b_ctx, supabase=sb)
        assert ei_missing.value.status_code == 404, "nonexistent id must be 404"

        # Sanity: A's view still exists untouched (B never reached it).
        still = await pg_pool.fetchrow(
            "SELECT name FROM public.document_views WHERE id = $1", a_view["id"]
        )
        assert still is not None and still["name"] == "A private"
    finally:
        await pg_pool.execute("DELETE FROM public.document_views WHERE user_id = $1", user_b)
        await pg_pool.execute("DELETE FROM audit_log WHERE user_id = $1", user_b)
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", user_b)


@pytest.mark.asyncio
async def test_cross_user_invalid_filter_patch_404(pg_pool, test_user):
    """User B PATCHing User A's view with an INVALID filter → 404, never 422 (WR-01).

    Ownership is gated BEFORE filter-field validation, so an unowned id uniformly
    404s regardless of filter validity — closing the 422-vs-404 ordering oracle.
    A request with an UNKNOWN filter field would 422 if validation ran first; the
    own-scoped 404 must win.
    """
    if not await _table_exists(pg_pool, "document_views"):
        pytest.skip("migration 071 not applied (document_views absent)")

    from app.api.document_views import create_view, update_view
    from app.models.document_view import (
        ViewCondition,
        ViewCreate,
        ViewFilter,
        ViewUpdate,
    )

    sb = _supabase_or_skip()

    # User A owns a private view.
    a_view = await create_view(
        body=ViewCreate(name="A private", filter_expr=_filter_eq("document_type", "report")),
        current_user={"id": str(test_user)},
        supabase=sb,
    )
    a_view_id = str(a_view["id"])

    # User B exists but does NOT own that view.
    user_b = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_b, f"phase-113-crud-b-{user_b}@test.local",
    )
    b_ctx = {"id": str(user_b)}

    # An INVALID filter (unknown, non-whitelisted field) that WOULD 422 if
    # validation ran before the ownership check.
    bad_filter = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="not_a_real_field", op="eq", value="x")],
    )
    try:
        with pytest.raises(HTTPException) as ei:
            await update_view(
                view_id=a_view_id,
                body=ViewUpdate(filter_expr=bad_filter),
                current_user=b_ctx,
                supabase=sb,
            )
        assert ei.value.status_code == 404, (
            "cross-user PATCH with an invalid filter must 404 (ownership before "
            f"validation), not {ei.value.status_code} — a 422 here would be a "
            "filter-validity oracle on an id the caller does not own"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.document_views WHERE user_id = $1", user_b)
        await pg_pool.execute("DELETE FROM audit_log WHERE user_id = $1", user_b)
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", user_b)
