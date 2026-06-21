"""Phase 114 Plan 02 — live count-only resolve mode (D-114-15, own+global DISTINCT).

Drives the REAL `resolve_view` router coroutine with `count_only=True` against a
live service-role Supabase client on :54322. Proves:

  - the count-only total EQUALS the full-resolve listing length for the same view +
    caller (count == len(documents)).
  - own+global DISTINCT dedupe (Pitfall 1): a caller-OWNED doc living in a
    GLOBALLY-VISIBLE folder matches BOTH query legs but is counted ONCE — never the
    naive `own.count + global.count` double-count.
  - the count path is leak-safe by construction (T-114-02-02 / VIEW-06): it uses the
    SAME caller-scoping as full resolve, so a count over another user's docs is
    impossible.
  - an empty filter counts the caller's full visible set.

All assertions here resolve through MIGRATION-FREE legs (`language` custom .eq, the
empty filter, the global-folder overlap) so they run GREEN against :54322 NOW — the
count-only path is leg-agnostic (it runs the SAME compiled fragments as full
resolve). A typed-column-dependent count row is `xfail(strict=False)` until Plan 03
applies migration 074.

Live-DB harness copied verbatim from test_113_view_resolve.py (skips cleanly when
:54322 is unreachable).
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 114 count-only tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _column_exists(pool, table: str, column: str) -> bool:
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
    """Throwaway auth.users row; FK-safe teardown (docs + folders + views + audit + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-count-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.documents WHERE user_id = $1", user_id),
        ("DELETE FROM public.document_views WHERE user_id = $1", user_id),
        ("DELETE FROM public.folders WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest_asyncio.fixture
async def other_user(pg_pool):
    """A second user who OWNS a global folder (for the own+global overlap test)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-count-other-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"other_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.documents WHERE user_id = $1", user_id),
        ("DELETE FROM public.folders WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


async def _seed_doc(pool, user_id, *, metadata, created_at, folder_id=None, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        doc_id, user_id, f"{metadata.get('title', 'doc')}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        metadata, created_at, is_latest, version, folder_id,
    )
    return doc_id


async def _seed_global_folder(pool, owner_id):
    """A folder owned by `owner_id` with is_global=true (globally visible to others)."""
    folder_id = uuid4()
    await pool.execute(
        "INSERT INTO folders (id, user_id, name, parent_id, is_global) "
        "VALUES ($1, $2, $3, NULL, true)",
        folder_id, owner_id, f"global-{folder_id}",
    )
    return folder_id


def _filter_eq(field, value):
    from app.models.document_view import ViewCondition, ViewFilter
    return ViewFilter(op="and", conditions=[ViewCondition(field=field, op="eq", value=value)])


def _empty_filter():
    from app.models.document_view import ViewFilter
    return ViewFilter(op="and", conditions=[])


@pytest.mark.asyncio
async def test_count_only_equals_full_resolve_length(pg_pool, test_user):
    """count_only total == the full-resolve listing length for the same view (D-114-15)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 7, 1, tzinfo=timezone.utc)
    for _ in range(3):
        await _seed_doc(pg_pool, test_user, metadata={"language": "en"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"language": "fr"}, created_at=base)  # non-match

    view = await create_view(
        body=ViewCreate(name="English", filter_expr=_filter_eq("language", "en")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    full = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    count = await resolve_view(view_id=str(view["id"]), count_only=True, current_user={"id": str(test_user)}, supabase=sb)

    assert "documents" not in count, "count_only must NOT materialize full rows"
    assert count["total"] == len(full["documents"]) == full["total"] == 3, \
        "count-only total equals the full-resolve listing length"


@pytest.mark.asyncio
async def test_count_only_empty_filter_counts_full_visible_set(pg_pool, test_user):
    """An empty filter counts the caller's full visible set (== full-resolve length)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 7, 2, tzinfo=timezone.utc)
    for _ in range(4):
        await _seed_doc(pg_pool, test_user, metadata={"language": "en"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="All", filter_expr=_empty_filter()),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    full = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    count = await resolve_view(view_id=str(view["id"]), count_only=True, current_user={"id": str(test_user)}, supabase=sb)

    assert count["total"] == len(full["documents"]), "empty filter counts the full visible set"
    assert count["total"] >= 4


@pytest.mark.asyncio
async def test_count_only_own_global_overlap_deduped(pg_pool, test_user, other_user):
    """Pitfall 1: a caller-owned doc in a GLOBAL folder is counted ONCE (not double).

    The doc matches the own leg (user_id=caller) AND the global leg
    (folder_id in caller's globally-visible folders). A naive own.count+global.count
    would report it TWICE; the id-set union dedupes it to ONE.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    if not await _table_exists(pg_pool, "folders"):
        pytest.skip("folders table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 7, 3, tzinfo=timezone.utc)

    # A global folder owned by OTHER user → globally visible to test_user.
    gfolder = await _seed_global_folder(pg_pool, other_user)
    # test_user OWNS a doc that lives INSIDE that global folder → matches BOTH legs.
    overlap_doc = await _seed_doc(
        pg_pool, test_user, metadata={"language": "en"}, created_at=base, folder_id=gfolder
    )

    view = await create_view(
        body=ViewCreate(name="English", filter_expr=_filter_eq("language", "en")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    full = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    count = await resolve_view(view_id=str(view["id"]), count_only=True, current_user={"id": str(test_user)}, supabase=sb)

    ids = [d["id"] for d in full["documents"]]
    assert ids.count(str(overlap_doc)) == 1, "the overlap doc appears ONCE in full resolve (dedupe)"
    assert count["total"] == len(full["documents"]), \
        "count-only DISTINCT-dedupes the own+global overlap (Pitfall 1, no double-count)"
    assert count["total"] == 1, "exactly one matching doc, counted once across both legs"


@pytest.mark.asyncio
async def test_count_only_leak_safe_from_caller(pg_pool, test_user, other_user):
    """The count path is scoped from the CALLER — never counts another user's docs (VIEW-06)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 7, 4, tzinfo=timezone.utc)
    # test_user owns ONE English doc; other_user owns TWO English docs in a PRIVATE folder.
    await _seed_doc(pg_pool, test_user, metadata={"language": "en"}, created_at=base)
    await _seed_doc(pg_pool, other_user, metadata={"language": "en"}, created_at=base)
    await _seed_doc(pg_pool, other_user, metadata={"language": "en"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="English", filter_expr=_filter_eq("language", "en")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    count = await resolve_view(view_id=str(view["id"]), count_only=True, current_user={"id": str(test_user)}, supabase=sb)
    # Only test_user's own doc is counted — other_user's private docs are invisible.
    assert count["total"] == 1, "count is caller-scoped — never counts another user's docs (VIEW-06)"


@pytest.mark.asyncio
async def test_count_only_typed_leg_equals_full(pg_pool, test_user):
    """count_only over a typed-leg (document_type) view equals full-resolve length.

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
    base = datetime(2025, 7, 5, tzinfo=timezone.utc)
    for _ in range(2):
        await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice"}, created_at=base)
    await _seed_doc(pg_pool, test_user, metadata={"document_type": "report"}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="Invoices", filter_expr=_filter_eq("document_type", "Invoice")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    full = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    count = await resolve_view(view_id=str(view["id"]), count_only=True, current_user={"id": str(test_user)}, supabase=sb)
    assert count["total"] == len(full["documents"]) == 2
