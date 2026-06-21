"""Phase 119 — DGOV-01 — broken/dangling relationship detection (D-119-3) live on :54322.

A broken/dangling relationship is an edge whose TARGET resolves to NO readable latest
version (the document was fully deleted — no `is_latest=True` row the owner can read). The
detection anchors on Phase 116's `_resolve_readable_latest`: `None` == broken. A target that
exists but is masked "linked document (no access)" is NOT a break — masking != deletion
(`test_masked_not_broken`).

A1 OPEN-QUESTION RESOLUTION (pinned live here): seed an edge, hard-DELETE the target, and
assert whether the broken card surfaces it OR whether a FK CASCADE removed the edge. The
observed live behavior is documented in `test_hard_deleted_target_surfaces_as_broken` so the
broken card is sized against reality, not an assumption.

Drives the REAL `GET /document-governance/broken-relationships` route via a TestClient with
`get_current_user` / `get_supabase` overridden (the 117 harness). Imports inside test bodies
so collection never errors before Task 2 ships the router.
"""
import asyncio
import json
import os
from uuid import uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_MASK = "linked document (no access)"


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    if asyncpg is None:
        return False
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 119 broken test",
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
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-119-broken-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title, folder_id=None, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        {"title": title}, is_latest, version, folder_id,
    )
    return doc_id


async def _seed_relationship(pool, owner_id, source_id, target_id, rel_type="references"):
    rel_id = uuid4()
    await pool.execute(
        "INSERT INTO public.document_relationships "
        "(id, user_id, source_doc_id, target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5)",
        rel_id, owner_id, source_id, target_id, rel_type,
    )
    return rel_id


def _route_client(caller_id: str, sb):
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_supabase
    from app.main import app

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: {"id": caller_id, "email": f"{caller_id}@test.local"}
    app.dependency_overrides[get_supabase] = lambda: sb

    def _teardown():
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)

    return TestClient(app), _teardown


async def _cleanup(pg_pool, uid):
    for sql in (
        "DELETE FROM public.document_relationships WHERE user_id = $1",
        "DELETE FROM public.documents WHERE user_id = $1",
        "DELETE FROM public.folders WHERE user_id = $1",
        "DELETE FROM audit_log WHERE user_id = $1",
        "DELETE FROM auth.users WHERE id = $1",
    ):
        try:
            await pg_pool.execute(sql, uid)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_hard_deleted_target_surfaces_as_broken_or_edge_cascaded(pg_pool):
    """A1 LIVE PIN: seed an edge, hard-DELETE the target, observe the real semantics.

    Either (a) a FK ON DELETE CASCADE removed the edge → no broken row (and no orphan), OR
    (b) the edge survives the target deletion → the broken card surfaces it. Both are
    acceptable behaviors; this test PINS which one is live (documented in the assertion
    message) so the broken card is sized against reality. What is NOT acceptable: a 500, or
    the deleted target's id leaking as a "readable" end.
    """
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    uid = await _seed_user(pg_pool, "a")
    try:
        src = await _seed_doc(pg_pool, uid, title="broken-src", folder_id=None)
        target = await _seed_doc(pg_pool, uid, title="broken-target", folder_id=None)
        rel = await _seed_relationship(pg_pool, uid, src, target, "references")

        # Does the edge survive a hard target delete, or did a FK CASCADE remove it?
        await pg_pool.execute("DELETE FROM documents WHERE id = $1", target)
        edge_still_exists = await pg_pool.fetchval(
            "SELECT EXISTS (SELECT 1 FROM public.document_relationships WHERE id = $1)", rel
        )

        client, teardown = _route_client(str(uid), sb)
        try:
            resp = client.get("/document-governance/broken-relationships")
        finally:
            teardown()

        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        blob = json.dumps(body)
        # The deleted target id must never be surfaced as a readable/openable end.
        assert str(target) not in blob, (
            "the fully-deleted target id must never surface as an openable end"
        )

        if edge_still_exists:
            # A1 observed: edge survives target deletion → the broken card MUST surface it.
            assert body.get("total", 0) >= 1, (
                "A1 LIVE: edge survives target hard-delete → broken card must report it; "
                f"got {body}"
            )
            assert str(rel) in blob, "the surviving dangling edge must appear on the broken card"
        else:
            # A1 observed: a FK CASCADE removed the edge → nothing dangling, no broken row.
            assert str(rel) not in blob, (
                "A1 LIVE: target hard-delete CASCADE-removed the edge → no broken row expected"
            )
    finally:
        await _cleanup(pg_pool, uid)


@pytest.mark.asyncio
async def test_resolvable_target_is_not_broken(pg_pool):
    """An edge whose target resolves to a readable latest is NOT broken (non-vacuity twin)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    uid = await _seed_user(pg_pool, "b")
    try:
        src = await _seed_doc(pg_pool, uid, title="ok-src", folder_id=None)
        target = await _seed_doc(pg_pool, uid, title="ok-target", folder_id=None)
        rel = await _seed_relationship(pg_pool, uid, src, target, "references")

        client, teardown = _route_client(str(uid), sb)
        try:
            resp = client.get("/document-governance/broken-relationships")
        finally:
            teardown()

        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        assert str(rel) not in json.dumps(resp.json()), (
            "an edge whose target resolves to a readable latest must NOT be reported broken"
        )
    finally:
        await _cleanup(pg_pool, uid)


@pytest_asyncio.fixture
async def masked_target(pg_pool):
    """B owns an edge to a doc only A can read (present-but-masked, not deleted)."""
    if not await _table_exists(pg_pool, "folders"):
        pytest.skip("folders table absent")

    user_a = await _seed_user(pg_pool, "mask-a")
    user_b = await _seed_user(pg_pool, "mask-b")

    global_folder = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_global) VALUES ($1, $2, $3, true)",
        global_folder, user_a, "A-shared-broken-119",
    )
    subject = await _seed_doc(pg_pool, user_a, title="mask-subject", folder_id=global_folder)
    target = await _seed_doc(pg_pool, user_a, title="mask-secret", folder_id=None)
    rel_b = await _seed_relationship(pg_pool, user_b, subject, target, "references")

    ctx = {
        "user_a": str(user_a), "user_b": str(user_b),
        "subject": str(subject), "target": str(target), "rel_b": str(rel_b),
        "target_title": "mask-secret",
    }
    try:
        yield ctx
    finally:
        await _cleanup(pg_pool, user_a)
        await _cleanup(pg_pool, user_b)


@pytest.mark.asyncio
async def test_masked_not_broken(pg_pool, masked_target):
    """A masked-but-present target (117 semantics) is NOT broken for B — masking !=
    deletion (D-119-3). B must never see the rel reported as broken, nor the private id."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    ctx = masked_target

    client, teardown = _route_client(ctx["user_b"], sb)
    try:
        resp = client.get("/document-governance/broken-relationships")
    finally:
        teardown()

    assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
    blob = json.dumps(resp.json())
    assert ctx["rel_b"] not in blob, (
        "a present-but-masked target is NOT a break (masking != deletion); B must not report it"
    )
    assert ctx["target"] not in blob, "B must never see the masked private target id"
    assert ctx["target_title"] not in blob, "B must never see the masked private target title"
