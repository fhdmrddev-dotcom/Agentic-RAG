"""Phase 113 Wave-0 — live /document-views resolve correctness (VIEW-01/02 + SC#4).

Drives the REAL `resolve_view` router coroutine against a live service-role
Supabase client on :54322 over seeded `documents` rows. Proves:

  - `test_order_and_count` — resolve returns the matching latest-version docs,
    newest-first (`created_at desc`), with `total == len(documents)`.
  - query-not-copy (VIEW-02) — ONE document is resolvable through TWO distinct
    views with no duplication; a view is a query, not a copy.
  - empty filter (D-113-9) — an empty `conditions` list resolves to ALL in-scope
    docs (no `.contains()` narrowing).
  - is_latest only — superseded (`is_latest=False`) versions never appear.
  - `test_injection_value_neutralized_live` (SC#4 live half / T-113-11) — a view
    whose `eq` value is a SQL/SSTI payload resolves to 0 matches AND the
    `documents` table is intact (row count unchanged). The compiled filter is
    bound as one `$1::jsonb` via `.contains()` — never string-interpolated.

Live-DB harness copied verbatim from test_111_metadata_fields_crud.py (skips
cleanly when :54322 is unreachable). The two-user cross-user GLOBAL-view leak
test (SC#3 / VIEW-06) is authored under VALIDATION.md and run in secure-phase —
NOT duplicated here.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 113 resolve tests",
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
    """Seed a throwaway auth.users row; FK-safe teardown (docs + views + audit + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-113-resolve-{user_id}@test.local",
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


def _filter_eq(field, value):
    from app.models.document_view import ViewCondition, ViewFilter
    return ViewFilter(op="and", conditions=[ViewCondition(field=field, op="eq", value=value)])


def _empty_filter():
    from app.models.document_view import ViewFilter
    return ViewFilter(op="and", conditions=[])


@pytest.mark.asyncio
async def test_order_and_count(pg_pool, test_user):
    """Resolve returns the right docs, newest-first, with total == len(documents)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from datetime import datetime, timedelta, timezone

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    # Three invoices (oldest → newest) + one non-matching report.
    inv_old = await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice", "title": "old"}, created_at=base)
    inv_mid = await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice", "title": "mid"}, created_at=base + timedelta(days=1))
    inv_new = await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice", "title": "new"}, created_at=base + timedelta(days=2))
    await _seed_doc(pg_pool, test_user, metadata={"document_type": "report", "title": "noise"}, created_at=base + timedelta(days=3))

    view = await create_view(
        body=ViewCreate(name="Invoices", filter_expr=_filter_eq("document_type", "invoice")),
        current_user={"id": str(test_user)},
        supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)

    ids = [d["id"] for d in out["documents"]]
    assert set(ids) == {str(inv_old), str(inv_mid), str(inv_new)}, "only the 3 invoices match, report excluded"
    assert out["total"] == 3 == len(out["documents"]), "total must equal the listing length"
    # newest-first (created_at desc)
    assert ids[0] == str(inv_new) and ids[-1] == str(inv_old), f"must be newest-first, got {ids}"


@pytest.mark.asyncio
async def test_query_not_copy_one_doc_two_views(pg_pool, test_user):
    """One document resolves through TWO distinct views with no duplication (VIEW-02)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    # One doc carrying BOTH document_type=invoice AND author=Acme.
    doc_id = await _seed_doc(
        pg_pool, test_user,
        metadata={"document_type": "invoice", "author": "Acme", "title": "shared"},
        created_at=__import__("datetime").datetime(2025, 2, 1, tzinfo=__import__("datetime").timezone.utc),
    )

    v_type = await create_view(
        body=ViewCreate(name="By type", filter_expr=_filter_eq("document_type", "invoice")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    v_author = await create_view(
        body=ViewCreate(name="By author", filter_expr=_filter_eq("author", "Acme")),
        current_user={"id": str(test_user)}, supabase=sb,
    )

    out_type = await resolve_view(view_id=str(v_type["id"]), current_user={"id": str(test_user)}, supabase=sb)
    out_author = await resolve_view(view_id=str(v_author["id"]), current_user={"id": str(test_user)}, supabase=sb)

    type_ids = [d["id"] for d in out_type["documents"]]
    author_ids = [d["id"] for d in out_author["documents"]]
    # The SAME doc appears in BOTH views (a query, not a copy) — and exactly once per view.
    assert str(doc_id) in type_ids and str(doc_id) in author_ids, "one doc resolvable through two views"
    assert type_ids.count(str(doc_id)) == 1 and author_ids.count(str(doc_id)) == 1, "no duplication within a view"


@pytest.mark.asyncio
async def test_empty_filter_resolves_all_in_scope(pg_pool, test_user):
    """An empty conditions list resolves to ALL in-scope docs (D-113-9, no narrowing)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from datetime import datetime, timezone

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 3, 1, tzinfo=timezone.utc)
    d1 = await _seed_doc(pg_pool, test_user, metadata={"document_type": "invoice"}, created_at=base)
    d2 = await _seed_doc(pg_pool, test_user, metadata={"document_type": "report"}, created_at=base)
    d3 = await _seed_doc(pg_pool, test_user, metadata={}, created_at=base)

    view = await create_view(
        body=ViewCreate(name="All", filter_expr=_empty_filter()),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert {str(d1), str(d2), str(d3)} <= ids, "empty filter must resolve to all in-scope docs"
    assert out["total"] == len(out["documents"])


@pytest.mark.asyncio
async def test_only_latest_versions_resolve(pg_pool, test_user):
    """A superseded version (is_latest=False) never appears in a resolved view."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from datetime import datetime, timezone

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    base = datetime(2025, 4, 1, tzinfo=timezone.utc)
    old_ver = await _seed_doc(
        pg_pool, test_user, metadata={"document_type": "contract"},
        created_at=base, is_latest=False, version=1,
    )
    new_ver = await _seed_doc(
        pg_pool, test_user, metadata={"document_type": "contract"},
        created_at=base, is_latest=True, version=2,
    )

    view = await create_view(
        body=ViewCreate(name="Contracts", filter_expr=_filter_eq("document_type", "contract")),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}
    assert str(new_ver) in ids, "the latest version must resolve"
    assert str(old_ver) not in ids, "a superseded (is_latest=False) version must NOT resolve"


@pytest.mark.asyncio
async def test_injection_value_neutralized_live(pg_pool, test_user):
    """SC#4 live half — an injection/SSTI payload value resolves to 0 matches, table intact."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from datetime import datetime, timezone

    from app.api.document_views import create_view, resolve_view
    from app.models.document_view import ViewCreate

    sb = _supabase_or_skip()
    # A benign doc so the table is non-empty and we can prove it survives.
    benign = await _seed_doc(
        pg_pool, test_user, metadata={"document_type": "invoice"},
        created_at=datetime(2025, 5, 1, tzinfo=timezone.utc),
    )

    payload = "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"
    count_before = await pg_pool.fetchval("SELECT count(*) FROM documents")

    view = await create_view(
        body=ViewCreate(name="evil", filter_expr=_filter_eq("document_type", payload)),
        current_user={"id": str(test_user)}, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)

    # The payload is a bound JSON literal — it matches NOTHING (no doc has that
    # exact document_type) and is NEVER executed as SQL/template.
    assert out["total"] == 0, "the injection payload must resolve to 0 matches"
    assert out["documents"] == []

    # The documents table is intact (the DROP never ran) and the benign row survives.
    assert await _table_exists(pg_pool, "documents"), "documents table must still exist"
    count_after = await pg_pool.fetchval("SELECT count(*) FROM documents")
    assert count_after == count_before, "row count must be unchanged (no DROP/DELETE executed)"
    survivor = await pg_pool.fetchrow("SELECT id FROM documents WHERE id = $1", benign)
    assert survivor is not None, "the benign row must survive the injection attempt"
