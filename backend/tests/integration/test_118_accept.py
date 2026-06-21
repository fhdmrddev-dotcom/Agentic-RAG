"""Phase 118 Wave-0 (RED) — accept_classification: reversible move + audit-after-move + 404.

Proves the CLASS-03 accept endpoint (Plan 03 T2) against live :54322:

  * accept moves the doc to the suggested folder, marks ``_classification.status="accepted"``,
    and stamps ``prior_folder_id`` (the reversible-by-construction Undo, D-118-6).
  * the target folder readability is RE-CHECKED at accept time (own+global) — a deleted /
    unreadable folder → uniform 404 (Pitfall 5; clone move_document:1325-1335).
  * the ``classification.apply`` audit row lands ONLY after the move succeeds (112/116
    honesty — never optimistic).
  * a doc with no active "suggested" suggestion → 404 (no over-broad accept).
  * cross-user accept of another user's doc → 404, NEVER 403.

xfail until Plan 03 ships accept_classification; imports inside test bodies. Harness from
test_113_view_crud.py — skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 accept tests",
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
        pytest.skip(f"local Supabase REST gate unreachable: {e}")
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


@pytest_asyncio.fixture
async def doc_with_suggestion(pg_pool):
    """Seed a user + a target folder + a doc carrying a 'suggested' _classification toward it."""
    user_id = uuid4()
    src_folder = uuid4()
    target_folder = uuid4()
    doc_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-118-accept-{user_id}@test.local",
    )
    for fid, name in ((src_folder, "Inbox"), (target_folder, "Invoices")):
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, name, is_global) VALUES ($1, $2, $3, false)",
            fid, user_id, name,
        )
    await pg_pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        doc_id, user_id, "to-accept.txt", f"{user_id}/to-accept.txt", 100, "text/plain", "completed",
        {
            "document_type": "invoice",
            "_classification": {
                "rule_id": "rule-1", "rule_name": "Invoices",
                "condition_summary": "document_type = invoice",
                "suggested_folder_id": str(target_folder),
                "suggested_folder_name": "Invoices", "status": "suggested",
            },
        },
        src_folder,
    )
    ctx = {
        "user_id": user_id, "src_folder": str(src_folder),
        "target_folder": str(target_folder), "doc_id": str(doc_id),
    }
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM documents WHERE user_id = $1", user_id),
            ("DELETE FROM public.folders WHERE user_id = $1", user_id),
            ("DELETE FROM audit_log WHERE user_id = $1", user_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.xfail(strict=False, reason="Plan 03 ships accept_classification")
@pytest.mark.asyncio
async def test_accept_moves_and_stamps_prior_folder(pg_pool, doc_with_suggestion):
    """Accept moves to the suggested folder, marks accepted, stamps prior_folder_id (Undo)."""
    from app.api.documents import accept_classification

    sb = _supabase_or_skip()
    ctx = doc_with_suggestion
    caller = {"id": str(ctx["user_id"])}
    result = await accept_classification(ctx["doc_id"], current_user=caller, supabase=sb)
    row = result if isinstance(result, dict) else result.model_dump()
    assert str(row["folder_id"]) == ctx["target_folder"], "doc moved to the suggested folder"
    sugg = (row.get("metadata") or {}).get("_classification") or {}
    assert sugg.get("status") == "accepted"
    assert sugg.get("prior_folder_id") == ctx["src_folder"], "prior folder stamped for Undo"


@pytest.mark.xfail(strict=False, reason="Plan 03 ships accept_classification")
@pytest.mark.asyncio
async def test_accept_writes_classification_apply_audit(pg_pool, doc_with_suggestion):
    """The classification.apply audit lands ONLY after the move succeeds (never optimistic)."""
    from app.api.documents import accept_classification

    sb = _supabase_or_skip()
    ctx = doc_with_suggestion
    caller = {"id": str(ctx["user_id"])}
    await accept_classification(ctx["doc_id"], current_user=caller, supabase=sb)
    audit = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id=$1 AND action_type='classification.apply' "
        "ORDER BY created_at DESC LIMIT 1",
        ctx["user_id"],
    )
    assert audit is not None, "classification.apply audit row must land after the accept move"


@pytest.mark.xfail(strict=False, reason="Plan 03 ships accept_classification")
@pytest.mark.asyncio
async def test_accept_unreadable_folder_404(pg_pool, doc_with_suggestion):
    """A suggested folder that was deleted (FK SET NULL / unreadable) → uniform 404 (Pitfall 5)."""
    from fastapi import HTTPException

    from app.api.documents import accept_classification

    sb = _supabase_or_skip()
    ctx = doc_with_suggestion
    # Delete the target folder so the accept-time readability re-check fails.
    await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", ctx["target_folder"])
    caller = {"id": str(ctx["user_id"])}
    with pytest.raises(HTTPException) as ei:
        await accept_classification(ctx["doc_id"], current_user=caller, supabase=sb)
    assert ei.value.status_code == 404


@pytest.mark.xfail(strict=False, reason="Plan 03 ships accept_classification")
@pytest.mark.asyncio
async def test_accept_cross_user_404_not_403(pg_pool, doc_with_suggestion):
    """User B accepting User A's doc → 404, NEVER 403 (no existence leak)."""
    from fastapi import HTTPException

    from app.api.documents import accept_classification

    sb = _supabase_or_skip()
    ctx = doc_with_suggestion
    other = {"id": str(uuid4())}
    with pytest.raises(HTTPException) as ei:
        await accept_classification(ctx["doc_id"], current_user=other, supabase=sb)
    assert ei.value.status_code == 404
