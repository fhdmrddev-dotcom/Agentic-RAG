"""Phase 114 Plan 02 — live /document-views resolve: widened operators + relative-date.

Drives the REAL `resolve_view` router coroutine against a live service-role
Supabase client on :54322 over seeded `documents` rows. Proves the widened
two-leg `_apply` (R-114-A) consumes the Plan-01 `list[Fragment]` contract:

  - relative-date window math (`_relative_window`) is computed from the SERVER
    CLOCK (D-114-16): `within_next` → (today, today+N) EXCLUDING overdue (D-114-5);
    `older_than` → (None, today-N); units days/weeks/months; CROSSES a month
    boundary. (Pure-helper assertions — no DB — run GREEN now.)
  - case-insensitive matching: the compiler lowercases a mixed-case
    `document_type`/`language` query value so "Invoice" === "invoice" (compiler-leg
    assertion GREEN now; the live `document_type_norm` resolve is xfail until the
    migration).
  - the custom-field leg resolves live NOW (no migration needed): `title`/`author`
    `eq` → case-insensitive ILIKE on `metadata->>'field'`; `is_empty` → absent-or-
    blank; `contains` → substring.
  - VIEW-06 leak-safety: a two-user resolve returns disjoint caller-scoped sets
    (proven on the migration-free custom-field leg).

xfail handoff (114-01 → 114-02 → 114-03): the typed-column legs (`document_type_norm`
/ `date_typed`) do NOT exist in the live DB until Plan 03 applies migration 074.
Tests that resolve THROUGH those columns are `xfail(strict=False)` here; Plan 03
un-marks them after applying the migration. The non-typed-column assertions
(custom-leg resolve, server-clock window math, leak-safety) run GREEN against
:54322 now (or skip cleanly when :54322 is down).

Live-DB harness copied verbatim from test_113_view_resolve.py (skips cleanly when
:54322 is unreachable).
"""

import asyncio
import json
import os
from datetime import date, datetime, timedelta, timezone
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 114 resolve tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _column_exists(pool, table: str, column: str) -> bool:
    """True if `table.column` exists — gates the typed-leg (migration-074) tests."""
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=$1 AND column_name=$2)",
        table, column,
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
    """Seed a throwaway auth.users row; FK-safe teardown (docs + views + audit + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-resolve-{user_id}@test.local",
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
    """A second isolated user for the VIEW-06 two-user leak-safety test."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-resolve-2-{user_id}@test.local",
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


def _filter(field, op, **kw):
    from app.models.document_view import ViewCondition, ViewFilter
    return ViewFilter(op="and", conditions=[ViewCondition(field=field, op=op, **kw)])


# ── server-clock relative-date window math (pure helper — GREEN now, no DB) ──────

def test_relative_window_within_next_excludes_overdue():
    """within_next → (today, today+N): the today LOWER bound EXCLUDES overdue (D-114-5)."""
    from app.api.document_views import _relative_window

    low, high = _relative_window("within_next", 90, "days")
    today = date.today()
    assert low == today.isoformat(), "the lower bound is today (overdue-exclusion, D-114-5)"
    assert high == (today + timedelta(days=90)).isoformat(), "upper bound is today+N"
    # A document due yesterday (overdue) falls BELOW the today lower bound → excluded.
    assert (today - timedelta(days=1)).isoformat() < low


def test_relative_window_within_next_crosses_month_boundary():
    """A within-next window recomputed from the server clock crosses a month boundary."""
    from app.api.document_views import _relative_window

    low, high = _relative_window("within_next", 45, "days")
    # 45 days from any date lands in a different month than `low` for almost all
    # calendars; assert the upper bound is strictly 45 days ahead (boundary-agnostic).
    assert date.fromisoformat(high) - date.fromisoformat(low) == timedelta(days=45)


def test_relative_window_older_than_is_open_lower():
    """older_than → (None, today-N): document age, open lower bound (D-114-4)."""
    from app.api.document_views import _relative_window

    low, high = _relative_window("older_than", 30, "days")
    assert low is None, "older_than has no lower bound"
    assert high == (date.today() - timedelta(days=30)).isoformat()


def test_relative_window_units():
    """days/weeks/months map to ×1/×7/×30 (sketch 030)."""
    from app.api.document_views import _relative_window

    today = date.today()
    _, h_days = _relative_window("within_next", 10, "days")
    _, h_weeks = _relative_window("within_next", 2, "weeks")
    _, h_months = _relative_window("within_next", 1, "months")
    assert date.fromisoformat(h_days) == today + timedelta(days=10)
    assert date.fromisoformat(h_weeks) == today + timedelta(days=14)
    assert date.fromisoformat(h_months) == today + timedelta(days=30)


def test_relative_window_clamps_absurd_n_no_overflow():
    """WR-05: an absurd N (e.g. 999_999_999 months) is CLAMPED, never an OverflowError.

    Without the clamp, today + timedelta(days=~3e10) raises OverflowError (an
    unhandled 500 reachable from the UI). The span caps at ~100 years (_MAX_RELATIVE_DAYS)
    and the result is a valid ISO date well inside Python's date range.
    """
    from app.api.document_views import _MAX_RELATIVE_DAYS, _relative_window

    today = date.today()
    # within_next with an absurd N — must NOT raise, must clamp to today + MAX.
    low, high = _relative_window("within_next", 999_999_999, "months")
    assert low == today.isoformat()
    assert date.fromisoformat(high) == today + timedelta(days=_MAX_RELATIVE_DAYS), \
        "an absurd within_next N clamps to the ~100-year cap (no OverflowError)"

    # older_than with an absurd N — clamps to today - MAX (still a valid date).
    low2, high2 = _relative_window("older_than", 999_999_999, "months")
    assert low2 is None
    assert date.fromisoformat(high2) == today - timedelta(days=_MAX_RELATIVE_DAYS)


def test_relative_window_recomputes_live():
    """The window derives from date.today() at CALL time (D-114-16 — drifts with calendar).

    Phase 115 extracted ``_relative_window`` into ``app.services.document_view_resolver``;
    patch ``date`` where the helper now READS it (the resolver module) — the standard
    "patch where it's used" rule. The behavior (window anchors on the live server clock)
    is byte-identical; only the patch target moved with the extraction.
    """
    from app.services import document_view_resolver

    sentinel = date(2099, 6, 1)

    class _FrozenDate(date):
        @classmethod
        def today(cls):
            return sentinel

    orig = document_view_resolver.date
    try:
        document_view_resolver.date = _FrozenDate
        low, high = document_view_resolver._relative_window("within_next", 5, "days")
        assert low == "2099-06-01" and high == "2099-06-06", "window anchors on the live clock"
    finally:
        document_view_resolver.date = orig


# ── case-insensitive matching at the compiler leg (GREEN now) ────────────────────

def test_case_insensitive_value_lowered_for_document_type():
    """A mixed-case `document_type` query value is lowercased so "Invoice"==="invoice"."""
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(_filter("document_type", "eq", value="Invoice"))
    assert len(frags) == 1
    assert frags[0].leg == "typed" and frags[0].field == "document_type_norm"
    assert frags[0].value == "invoice", "value lowercased (case-insensitive on the indexed col)"


def test_case_insensitive_free_text_uses_ilike():
    """A free-text `title` eq compiles to a case-insensitive ILIKE on metadata->>'title'."""
    from app.services.view_filter_compiler import compile_filter

    frags = compile_filter(_filter("title", "eq", value="Annual Report"))
    assert frags[0].leg == "custom" and frags[0].builder == "ilike"
    assert frags[0].value == "Annual Report"  # bound literal, case-insensitivity via ILIKE


# ── live custom-field-leg resolve (GREEN NOW — needs no migration) ───────────────

@pytest.mark.asyncio
async def test_custom_leg_title_eq_case_insensitive_live(pg_pool, test_user):
    """`title` eq resolves case-insensitively via ILIKE on metadata->>'title' (no migration)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 6, 1, tzinfo=timezone.utc)
    match = await _seed_doc(pg_pool, test_user, metadata={"title": "Quarterly Brief"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"title": "Something Else"}, created_at=base)

    # mixed-case query value → ILIKE matches the stored mixed-case title (D-114-10)
    view = await create_view(
        body=ViewCreate(name="ByTitle", filter_expr=_filter("title", "eq", value="quarterly brief")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(match) in ids, "case-insensitive ILIKE matches the mixed-case title"
    assert out["total"] == len(out["documents"]) == 1


@pytest.mark.asyncio
async def test_custom_leg_contains_substring_live(pg_pool, test_user):
    """`contains` resolves substring (ILIKE %v%) on a custom/free-text field (no migration)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 6, 2, tzinfo=timezone.utc)
    match = await _seed_doc(pg_pool, test_user, metadata={"title": "Annual Report 2025"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"title": "Invoice 42"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="HasReport", filter_expr=_filter("title", "contains", value="report")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(match) in ids, "substring ILIKE matches 'report' inside 'Annual Report 2025'"
    assert out["total"] == 1


@pytest.mark.asyncio
async def test_custom_leg_is_empty_live(pg_pool, test_user):
    """`is_empty` resolves docs with an absent OR blank custom field (D-114-12, no migration)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 6, 3, tzinfo=timezone.utc)
    absent = await _seed_doc(pg_pool, test_user, metadata={"title": "no-author"}, created_at=base)
    blank = await _seed_doc(pg_pool, test_user, metadata={"title": "blank-author", "author": ""}, created_at=base)
    has = await _seed_doc(pg_pool, test_user, metadata={"title": "has-author", "author": "Acme"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="MissingAuthor", filter_expr=_filter("author", "is_empty")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(absent) in ids and str(blank) in ids, "absent and blank both count as empty (D-114-12)"
    assert str(has) not in ids, "a doc WITH an author must NOT match is_empty"


@pytest.mark.asyncio
async def test_view06_leak_safety_two_user_custom_leg_live(pg_pool, test_user, second_user):
    """VIEW-06: two users resolving the SAME-shaped view get disjoint caller-scoped sets.

    Proven on the migration-free custom-field leg (title eq). The widening must
    preserve the 404-not-403, own+global-from-CALLER boundary (T-114-02-01).
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 6, 4, tzinfo=timezone.utc)
    # Both users own a doc with the SAME title — a leak would surface the other's doc.
    doc_a = await _seed_doc(pg_pool, test_user, metadata={"title": "Shared Name"}, created_at=base)
    doc_b = await _seed_doc(pg_pool, second_user, metadata={"title": "Shared Name"}, created_at=base)

    # user A creates and resolves the view
    view_a = await create_view(
        body=ViewCreate(name="A-view", filter_expr=_filter("title", "eq", value="Shared Name")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out_a = await resolve_view(view_id=str(view_a["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids_a = {d["id"] for d in out_a["documents"]}
    assert str(doc_a) in ids_a, "A sees A's own doc"
    assert str(doc_b) not in ids_a, "A must NEVER see B's doc (VIEW-06 leak-safety)"

    # user B can't even READ A's view id → 404-not-403 (no existence leak)
    with pytest.raises(Exception) as exc:
        await resolve_view(view_id=str(view_a["id"]), current_user={"id": str(second_user)}, supabase=sb)
    assert getattr(exc.value, "status_code", None) == 404, "cross-user view read is 404, never 403"


# ── live typed-leg resolve (GREEN since Plan 03 applied migration 074) ───────────

@pytest.mark.asyncio
async def test_typed_leg_document_type_eq_case_insensitive_live(pg_pool, test_user):
    """`document_type` eq resolves via document_type_norm — case-insensitive, indexed.

    GREEN since Plan 03 applied migration 074 (document_type_norm exists live). The
    column-existence guard below fails loudly if the migration was ever rolled back.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    if not await _column_exists(pg_pool, "documents", "document_type_norm"):
        pytest.fail("document_type_norm absent — migration 074 not applied (Plan 03)")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 6, 5, tzinfo=timezone.utc)
    # Stored lowercase (the write-path invariant); query a MIXED-case value.
    match = await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"document_type": "report"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="Invoices", filter_expr=_filter("document_type", "eq", value="Invoice")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(match) in ids, "'Invoice' (mixed) matches stored 'invoice' via document_type_norm"
    assert out["total"] == 1


@pytest.mark.asyncio
async def test_typed_leg_within_next_excludes_overdue_live(pg_pool, test_user):
    """`within_next` resolves today→today+N on date_typed, EXCLUDING overdue (D-114-5).

    GREEN since Plan 03 applied migration 074 (date_typed exists live). The
    column-existence guard below fails loudly if the migration was ever rolled back.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    if not await _column_exists(pg_pool, "documents", "date_typed"):
        pytest.fail("date_typed absent — migration 074 not applied (Plan 03)")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    today = date.today()
    base = datetime(2025, 6, 6, tzinfo=timezone.utc)
    # soon (within 90d, crosses a month boundary), overdue (past), far (beyond 90d)
    soon = await _seed_doc(pg_pool, test_user, metadata={"date": (today + timedelta(days=45)).isoformat()}, created_at=base)
    overdue = await _seed_doc(pg_pool, test_user, metadata={"date": (today - timedelta(days=5)).isoformat()}, created_at=base)
    far = await _seed_doc(pg_pool, test_user, metadata={"date": (today + timedelta(days=200)).isoformat()}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="Expiring", filter_expr=_filter("date", "within_next", value=90, unit="days")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(soon) in ids, "a doc due in 45 days is within the 90-day window (crosses a month)"
    assert str(overdue) not in ids, "an overdue doc is EXCLUDED (D-114-5 .gte(today) lower bound)"
    assert str(far) not in ids, "a doc due in 200 days is beyond the 90-day window"


@pytest.mark.asyncio
async def test_typed_leg_older_than_boundary_is_strict_live(pg_pool, test_user):
    """WR-03: `older_than` uses a STRICT `<` upper bound (D-114-4 `date < today-N`).

    A doc dated EXACTLY `today - N` must be EXCLUDED (not "older than N"); a doc dated
    `today - N - 1` must be INCLUDED. GREEN since migration 074 (date_typed) is live.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    if not await _column_exists(pg_pool, "documents", "date_typed"):
        pytest.fail("date_typed absent — migration 074 not applied (Plan 03)")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    today = date.today()
    base = datetime(2025, 6, 7, tzinfo=timezone.utc)
    # boundary = exactly today-30; just_older = today-31; not_older = today-29
    boundary = await _seed_doc(pg_pool, test_user, metadata={"date": (today - timedelta(days=30)).isoformat()}, created_at=base)
    just_older = await _seed_doc(pg_pool, test_user, metadata={"date": (today - timedelta(days=31)).isoformat()}, created_at=base)
    not_older = await _seed_doc(pg_pool, test_user, metadata={"date": (today - timedelta(days=29)).isoformat()}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="Stale", filter_expr=_filter("date", "older_than", value=30, unit="days")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(just_older) in ids, "a doc dated today-31 IS older than 30 days (included)"
    assert str(boundary) not in ids, "a doc dated EXACTLY today-30 is NOT older than 30 (strict <, WR-03)"
    assert str(not_older) not in ids, "a doc dated today-29 is younger than 30 days (excluded)"
