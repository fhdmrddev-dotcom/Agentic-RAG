"""Phase 114 CR-01 — live stateless ad-hoc resolve/count (POST /document-views/resolve).

Drives the REAL `resolve_adhoc` router coroutine against a live service-role
Supabase client on :54322. CR-01 root-cause proof: the live FilterBar / page
preview an UNSAVED filter WITHOUT persisting a transient `document_views` row and
WITHOUT firing the per-keystroke `view.create` audit row that the old
create→resolve→delete dance left behind.

Proves:
  - the ad-hoc endpoint returns the CORRECT count (count_only) AND the correct
    document set (full), matching what a saved view of the same filter resolves to;
  - it writes ZERO audit rows and persists ZERO `document_views` rows (the headline
    CR-01 defect — audit-log pollution / orphan view rows);
  - it is leak-safe by construction (VIEW-06): a caller never sees another user's
    docs because every leg is scoped from the caller (there is no view owner here).

Live-DB harness copied verbatim from test_114_resolve_range_date.py (skips cleanly
when :54322 is unreachable).
"""

import asyncio
import json
import os
from datetime import datetime, timezone
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 114 ad-hoc tests",
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
async def test_user(pg_pool):
    """Throwaway auth.users row; FK-safe teardown (docs + views + audit + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-adhoc-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.documents WHERE user_id = $1", user_id),
        ("DELETE FROM public.document_views WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest_asyncio.fixture
async def second_user(pg_pool):
    """A second isolated user for the VIEW-06 leak-safety assertion."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-adhoc-2-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"second_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.documents WHERE user_id = $1", user_id),
        ("DELETE FROM public.document_views WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


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


def _filter(field, op, **kw):
    from app.models.document_view import ViewCondition, ViewFilter
    return ViewFilter(op="and", conditions=[ViewCondition(field=field, op=op, **kw)])


@pytest.mark.asyncio
async def test_adhoc_count_correct(pg_pool, test_user):
    """POST /resolve count_only returns the correct caller-scoped match count."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import resolve_adhoc
    from app.models.document_view import AdHocResolve

    sb = _supabase_or_skip()
    base = datetime(2025, 8, 1, tzinfo=timezone.utc)
    for _ in range(3):
        await _seed_doc(pg_pool, test_user, metadata={"language": "en"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"language": "fr"}, created_at=base)

    out = await resolve_adhoc(
        body=AdHocResolve(filter_expr=_filter("language", "eq", value="en"), count_only=True),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    assert "documents" not in out, "count_only must NOT materialize full rows"
    assert out["total"] == 3, "ad-hoc count equals the caller's matching doc count"


@pytest.mark.asyncio
async def test_adhoc_full_matches_saved_view(pg_pool, test_user):
    """The ad-hoc full resolve returns the SAME set a saved view of the same filter does."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_adhoc, resolve_view
    from app.models.document_view import AdHocResolve, ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 8, 2, tzinfo=timezone.utc)
    match = await _seed_doc(pg_pool, test_user, metadata={"title": "Quarterly Brief"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"title": "Something Else"}, created_at=base)

    flt = _filter("title", "eq", value="quarterly brief")
    adhoc = await resolve_adhoc(
        body=AdHocResolve(filter_expr=flt), current_user={"id": str(test_user)}, supabase=sb,
    )
    # A saved view of the SAME filter must produce the identical set.
    view = await create_view(
        body=ViewCreate(name="ByTitle", filter_expr=flt),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    saved = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)

    adhoc_ids = {d["id"] for d in adhoc["documents"]}
    saved_ids = {d["id"] for d in saved["documents"]}
    assert str(match) in adhoc_ids, "ad-hoc resolves the matching doc"
    assert adhoc_ids == saved_ids, "ad-hoc resolve == saved-view resolve for the same filter"


@pytest.mark.asyncio
async def test_adhoc_writes_zero_audit_and_zero_views(pg_pool, test_user):
    """CR-01 headline: the ad-hoc endpoint writes NO audit row and persists NO view row.

    The old create→resolve→delete dance fired a `view.create` audit entry per
    keystroke (never cleaned up) and churned the `document_views` table. The
    stateless endpoint must touch NEITHER.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import resolve_adhoc
    from app.models.document_view import AdHocResolve

    sb = _supabase_or_skip()
    base = datetime(2025, 8, 3, tzinfo=timezone.utc)
    await _seed_doc(pg_pool, test_user, metadata={"language": "en"}, created_at=base)

    audit_before = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log WHERE user_id = $1", test_user
    )
    views_before = await pg_pool.fetchval(
        "SELECT count(*) FROM public.document_views WHERE user_id = $1", test_user
    )

    # Several ad-hoc resolves (count + full) — mimicking debounced keystrokes.
    for _ in range(3):
        await resolve_adhoc(
            body=AdHocResolve(filter_expr=_filter("language", "eq", value="en"), count_only=True),
            current_user={"id": str(test_user)}, supabase=sb,
        )
    await resolve_adhoc(
        body=AdHocResolve(filter_expr=_filter("language", "eq", value="en")),
        current_user={"id": str(test_user)}, supabase=sb,
    )

    audit_after = await pg_pool.fetchval(
        "SELECT count(*) FROM audit_log WHERE user_id = $1", test_user
    )
    views_after = await pg_pool.fetchval(
        "SELECT count(*) FROM public.document_views WHERE user_id = $1", test_user
    )
    assert audit_after == audit_before, "ad-hoc resolve must write ZERO audit rows (CR-01)"
    assert views_after == views_before, "ad-hoc resolve must persist ZERO document_views rows (CR-01)"


@pytest.mark.asyncio
async def test_adhoc_leak_safe_from_caller(pg_pool, test_user, second_user):
    """VIEW-06: the ad-hoc resolve is caller-scoped — it never returns another user's docs."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import resolve_adhoc
    from app.models.document_view import AdHocResolve

    sb = _supabase_or_skip()
    base = datetime(2025, 8, 4, tzinfo=timezone.utc)
    # Both users own a doc with the SAME title — a leak would surface the other's doc.
    doc_a = await _seed_doc(pg_pool, test_user, metadata={"title": "Shared Name"}, created_at=base)
    doc_b = await _seed_doc(pg_pool, second_user, metadata={"title": "Shared Name"}, created_at=base)

    out_a = await resolve_adhoc(
        body=AdHocResolve(filter_expr=_filter("title", "eq", value="Shared Name")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    ids_a = {d["id"] for d in out_a["documents"]}
    assert str(doc_a) in ids_a, "A sees A's own doc"
    assert str(doc_b) not in ids_a, "A must NEVER see B's doc via the ad-hoc resolve (VIEW-06)"
