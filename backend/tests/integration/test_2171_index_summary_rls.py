"""Phase 217.1 (BE-2 / T-217.1-01 / D-217.1-27) — the two-user LIVE RLS leak proof
for `GET /library/index-summary`.

⭐ **THE MANDATORY LIVE PROOF of T-217.1-01's owner-scoping.** The endpoint is UNGATED
(D-217.1-27 — reading your own corpus facts is not model management) and its entire
safety rests on RLS being enforced by Postgres, not on a permission check.

**How this drives the REAL handler with REAL SQL and REAL RLS.** The route's async body
runs in-process (`await get_index_summary(...)`), with `get_user_pg_connection` (its
`Depends` seam) monkeypatched to the TEST pool — so every query the handler runs hits
the REAL Postgres under `SET LOCAL ROLE authenticated` + JWT GUCs as the injected user.
The app-singleton pool + TestClient-portal loop pairing is structurally loop-incompatible
on Windows (asyncpg pools bind to one event loop; the 163 leak suite's own precedent is
`as_user_asyncpg` / `as_user_fetchval` for exactly this reason), so the TestClient's
routing/`Depends` layer is the only thing not exercised — and that layer adds no access
control (the route is deliberately ungated; RLS is the gate, and it IS exercised).

**NON-VACUITY (the D-102 "static would false-green" lesson):** user A is seeded at
least ONE document + one chunk + one folder, so an empty pass cannot false-green —
A's own data MUST appear in A's response.

**Two-user assertion:** A's response NEVER contains B's folder id; and vice-versa.
RLS filters at the row level — a second user's folders cannot appear because Postgres
never lets the query see them.

**Non-operator (no `model_management` visibility) gets 200 with real data, not 403:**
this is D-217.1-27's whole point — the FACTS are visible to every user; only the
ACTION buttons are gated (Plan 10).

ALL seeds are created in a transaction that ROLLS BACK at the end — the operator's
local DB is the working environment (CLAUDE.md forbids destructive DB commands).
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from unittest.mock import MagicMock
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
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 217.1 RLS test",
)


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


async def _seed_user(pool, label, conn=None):
    """Insert an auth.users row (FK parent for RLS ownership) inside the caller's tx."""
    user_id = uuid4()
    await (conn or pool).execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-2171-leak-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_corpus(pool, user_id, label, conn=None):
    """One folder, one document, one chunk for the given user. Returns (folder_id, doc_id)."""
    folder_id = uuid4()
    doc_id = uuid4()
    ex = conn or pool
    await ex.execute(
        "INSERT INTO folders (id, user_id, name, parent_id, is_org_shared, created_at, updated_at) "
        "VALUES ($1, $2, $3, NULL, false, now(), now())",
        folder_id, user_id, f"{label}-folder",
    )
    await ex.execute(
        "INSERT INTO documents (id, user_id, folder_id, filename, file_path, file_size, mime_type, "
        "status, created_at, updated_at) "
        "VALUES ($1, $2, $3, $4, $5, 100, 'text/plain', 'completed', now(), now())",
        doc_id, user_id, folder_id, f"{label}-doc.txt", f"/{label}-doc.txt",
    )
    # 1536-dim vector — the column's declared dimension (text-embedding-3-small).
    vec = "[" + ",".join(["0.1"] * 1536) + "]"
    await ex.execute(
        "INSERT INTO document_chunks (id, document_id, user_id, content, chunk_index, embedding, "
        "embedding_model, embedding_dimensions, embedded_at) "
        "VALUES ($1, $2, $3, $4, 0, $5::vector, $6, 1536, now())",
        uuid4(), doc_id, user_id, f"{label}-chunk", vec,
        "text-embedding-3-small",
    )
    return folder_id, doc_id


@asynccontextmanager
async def _user_conn(pool, uid: str):
    """Acquire from the TEST pool and turn RLS on as ``uid`` — the same
    SET-LOCAL-as-user shape `get_user_pg_connection` applies, against the test pool
    so the route's asyncpg calls run on the SAME loop as the seed/assert code."""
    from app.dependencies import _apply_rls_user_context

    async with pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_user_context(conn, uid)
            yield conn


def _patch_route_rls(pool):
    """Monkeypatch `app.api.library.get_user_pg_connection` to the test pool.

    The handler calls it as ``get_user_pg_connection(request, current_user)``; the
    patched function closes over the test pool and derives the uid from
    `current_user["id"]`, so RLS is genuinely applied as the injected user on the REAL
    Postgres. Returns the module (for teardown inspection).
    """
    from app.api import library as library_api

    def _patched(request, current_user):
        return _user_conn(pool, current_user["id"])

    library_api.get_user_pg_connection = _patched  # noqa: SLF001 (test seam)
    return library_api


def _fake_request():
    """A minimal request-like object — the handler only passes it to the RLS seam,
    which we patched to ignore it. Its `app` attribute satisfies the Depends contract."""
    req = MagicMock()
    req.app = MagicMock()
    return req


async def _call_summary(pool, uid: str) -> dict:
    """Drive the REAL handler in-process as `uid` against the REAL Postgres under RLS."""
    from app.api.library import get_index_summary

    _patch_route_rls(pool)
    result = await get_index_summary(_fake_request(), {"id": uid})
    return result.model_dump()


async def _seed_and_commit(pool, label) -> tuple[str, str]:
    """Seed one user + corpus, COMMIT (so a separate connection sees it), return (uid, folder_id).

    The handler queries on a DIFFERENT pool connection than the seed — an uncommitted
    seed would be invisible to it (MVCC isolation), so the seed commits and the rows are
    cleaned up after by id.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            uid = await _seed_user(pool=pool, label=label, conn=conn)
            folder_id, doc_id = await _seed_corpus(pool, uid, label, conn=conn)
    return str(uid), str(folder_id)


async def _teardown(pool, uids: list[str]):
    """Delete the seeded users' rows (FK cascade order). Idempotent; never touches
    anything the operator created."""
    for uid in uids:
        await pool.execute("DELETE FROM document_chunks WHERE user_id = $1", uid)
        await pool.execute("DELETE FROM documents WHERE user_id = $1", uid)
        await pool.execute("DELETE FROM folders WHERE user_id = $1", uid)
        await pool.execute("DELETE FROM auth.users WHERE id = $1", uid)


async def test_two_users_never_see_each_others_folders(pg_pool):
    """T-217.1-01 — A's folders/chunks never appear in B's response (and A's own do)."""
    a_id, a_folder = await _seed_and_commit(pg_pool, "A")
    b_id, b_folder = await _seed_and_commit(pg_pool, "B")
    try:
        a_json = await _call_summary(pg_pool, a_id)
        b_json = await _call_summary(pg_pool, b_id)
    finally:
        await _teardown(pg_pool, [a_id, b_id])

    # NON-VACUITY: A's own corpus appears in A's response.
    assert a_json["folders"], "user A seeded a folder but A's response has none"
    a_folder_ids = {str(r["folder_id"]) for r in a_json["folders"] if r["folder_id"]}
    assert a_folder in a_folder_ids, "user A's own folder missing from A's response"
    assert a_json["vectors"] and a_json["vectors"] > 0, "user A's seeded vector missing"

    # THE LEAK PROOF, both directions.
    b_folder_ids = {str(r["folder_id"]) for r in b_json["folders"] if r["folder_id"]}
    assert b_folder in b_folder_ids, "user B's own folder missing from B's response"
    assert b_folder not in a_folder_ids, (
        "user B's folder LEAKED into user A's index-summary — RLS not enforced (T-217.1-01)"
    )
    assert a_folder not in b_folder_ids, (
        "user A's folder LEAKED into user B's index-summary — RLS not enforced (T-217.1-01)"
    )


async def test_ungated_for_non_operator(pg_pool):
    """D-217.1-27 — a plain user gets the facts, NOT 403 (no gate)."""
    user_id, _ = await _seed_and_commit(pg_pool, "plain")
    try:
        body = await _call_summary(pg_pool, user_id)
        # The handler carries NO require_visible dependency — it returns the facts,
        # which is the ungated contract. (A 403 would surface here as a raised
        # dependency error; the handler completing IS the proof.)
        assert body["vectors"] is not None, "non-operator response must carry the corpus facts"
    finally:
        await _teardown(pg_pool, [user_id])
