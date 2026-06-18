"""Phase 113 Wave-0 — live /document-views folder-subtree narrowing (VIEW-05 / D-113-5).

Drives the REAL `resolve_view` router coroutine against a live service-role
Supabase client on :54322 over a seeded folder subtree. Proves:

  - subtree narrowing — a view whose `folder_scope` is a folder root resolves
    over that folder + its descendants (the `resolve_project_subtree` LIST,
    Pitfall 1: a list, never a set), excluding docs outside the subtree.
  - unreachable-scope tolerance (D-113-5) — a view scoped to a folder the CALLER
    can't see (another user's private folder) contributes NO narrowing: the view
    resolves over the caller's full visible set rather than erroring or resolving
    empty. (`resolve_project_subtree` is owner-scoped to the caller, so the
    unreachable root walks to a subtree the caller's docs aren't in — the
    AND-with-subtree would zero them out — so the route must treat an
    unreachable/empty-of-caller-docs subtree as no-narrowing. This test asserts
    the user-facing D-113-5 behavior live.)

Live-DB harness copied verbatim from test_111_metadata_fields_crud.py (skips
cleanly when :54322 is unreachable).
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 113 folder-scope tests",
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
        client.table("folders").select("id").limit(1).execute()
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
    """Seed a throwaway auth.users row; FK-safe teardown (docs + folders + views + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-113-scope-{user_id}@test.local",
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


async def _seed_folder(pool, user_id, name, parent_id=None):
    fid = uuid4()
    await pool.execute(
        "INSERT INTO folders (id, user_id, name, parent_id) VALUES ($1, $2, $3, $4)",
        fid, user_id, name, parent_id,
    )
    return fid


async def _seed_doc(pool, user_id, *, folder_id, metadata=None):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, folder_id, is_latest) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        doc_id, user_id, f"doc-{doc_id}.txt", f"{user_id}/{doc_id}.txt",
        100, "text/plain", "completed", metadata or {}, folder_id, True,
    )
    return doc_id


@pytest.mark.asyncio
async def test_folder_scope_narrows_to_subtree(pg_pool, test_user):
    """A folder_scope view narrows to the folder subtree (root + descendants)."""
    if not (await _table_exists(pg_pool, "folders") and await _table_exists(pg_pool, "documents")):
        pytest.skip("folders/documents table absent")

    from app.api.document_views import resolve_view
    from app.models.document_view import ViewFilter
    from app.services import document_view_service

    sb = _supabase_or_skip()

    # Subtree: root → child. Plus an UNRELATED sibling folder outside the subtree.
    root = await _seed_folder(pg_pool, test_user, "Projects")
    child = await _seed_folder(pg_pool, test_user, "Project A", parent_id=root)
    outside = await _seed_folder(pg_pool, test_user, "Personal")

    doc_root = await _seed_doc(pg_pool, test_user, folder_id=root)
    doc_child = await _seed_doc(pg_pool, test_user, folder_id=child)
    doc_outside = await _seed_doc(pg_pool, test_user, folder_id=outside)

    # Empty filter + folder_scope=root → all docs in the root subtree (root + child),
    # excluding the outside folder. Create via the service to set folder_scope directly.
    view = await document_view_service.create_view(
        user_id=test_user, name="Scoped", filter_expr=ViewFilter(op="and", conditions=[]).model_dump(),
        folder_scope=root, supabase=sb,
    )
    out = await resolve_view(view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb)
    ids = {d["id"] for d in out["documents"]}

    assert str(doc_root) in ids, "root-folder doc must be in the subtree"
    assert str(doc_child) in ids, "child-folder doc must be in the subtree (descendant)"
    assert str(doc_outside) not in ids, "a doc outside the subtree must be excluded"


@pytest.mark.asyncio
async def test_unreachable_scope_contributes_no_narrowing(pg_pool, test_user):
    """A view scoped to a folder the caller can't see → no narrowing (D-113-5)."""
    if not (await _table_exists(pg_pool, "folders") and await _table_exists(pg_pool, "documents")):
        pytest.skip("folders/documents table absent")

    from app.api.document_views import resolve_view
    from app.models.document_view import ViewFilter
    from app.services import document_view_service

    sb = _supabase_or_skip()

    # The caller owns a doc in their own folder.
    my_folder = await _seed_folder(pg_pool, test_user, "Mine")
    my_doc = await _seed_doc(pg_pool, test_user, folder_id=my_folder)

    # Another user owns a PRIVATE folder the caller can't see.
    other = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        other, f"phase-113-scope-other-{other}@test.local",
    )
    other_folder = await _seed_folder(pg_pool, other, "Theirs (private)")
    try:
        # A (seeded) view scoped to the unreachable other-user folder. The caller
        # can read it (seed as a global view) but its folder_scope points at a
        # folder the caller can't see → resolve_project_subtree(caller) yields a
        # subtree the caller's docs aren't in. Per D-113-5 the route must treat
        # this as NO narrowing — the view resolves over the caller's full visible
        # set, never erroring or resolving empty.
        view = await document_view_service.create_view(
            user_id=test_user, name="UnreachableScope",
            filter_expr=ViewFilter(op="and", conditions=[]).model_dump(),
            folder_scope=other_folder, supabase=sb,
        )
        out = await resolve_view(
            view_id=str(view["id"]), current_user={"id": str(test_user)}, supabase=sb
        )
        ids = {d["id"] for d in out["documents"]}

        # No error, no empty-by-leak: the caller's own doc still resolves (the
        # unreachable scope contributed no narrowing).
        assert str(my_doc) in ids, (
            "an unreachable folder_scope must contribute NO narrowing (D-113-5) — "
            "the caller's own visible doc must still resolve"
        )
    finally:
        await pg_pool.execute("DELETE FROM public.folders WHERE user_id = $1", other)
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", other)
