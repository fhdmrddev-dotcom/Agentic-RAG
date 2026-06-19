"""Phase 115 Wave-0 — result-shape integration RED scaffold (Plan 02 target, LIVE :54322).

The handler's resolve result MUST be honest and agent-shaped:

  * the TRUE total comes from the count-only leg (never `len(shown_rows)` when the
    listing is capped — the silent-undercount trap),
  * a truncation NOTE is present when `total > shown`,
  * `source_refs` are present and shaped `{document_id, filename}` (the agent cites
    by id + filename).

Live-DB harness cloned from test_113_view_global_leak.py: PG_AVAILABLE skipif +
function-scoped pg_pool + seeded auth.users + many docs with FK-safe teardown.
Skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 115 result-shape test",
)


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
        client.table("document_views").select("id").limit(1).execute()
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
        user_id, f"phase-115-shape-{label}-{user_id}@test.local",
    )
    return user_id


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


@pytest_asyncio.fixture
async def user_with_many_docs(pg_pool):
    """A user with several matching invoices so a capped listing can be exercised."""
    from datetime import datetime, timedelta, timezone

    base = datetime(2025, 6, 1, tzinfo=timezone.utc)
    uid = await _seed_user(pg_pool, "a")
    ids = []
    for i in range(5):
        did = await _seed_doc(
            pg_pool, uid,
            metadata={"document_type": "invoice", "title": f"inv-{i}"},
            created_at=base + timedelta(days=i),
        )
        ids.append(str(did))
    ctx = {"user_id": uid, "ids": ids}
    try:
        yield ctx
    finally:
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


@pytest.mark.xfail(strict=False, reason="Plan 02 builds the resolve result shape (total + refs + truncation)")
@pytest.mark.asyncio
async def test_result_shape_true_total_refs_and_truncation(pg_pool, user_with_many_docs):
    """TRUE total via count-only + a truncation note when capped + shaped source_refs."""
    from types import SimpleNamespace

    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    caller = str(user_with_many_docs["user_id"])

    ctx = SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)
    inline = {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]}
    # A small limit forces truncation against the 5 seeded invoices.
    result = await _handle_query_documents_by_view({"filter": inline, "limit": 2}, ctx)
    payload = json.loads(result.result)

    # TRUE total reflects all 5 matching docs (count-only leg), not the 2 shown.
    assert payload.get("total") == 5, f"true total must be 5 (count-only), got {payload.get('total')}"

    refs = payload.get("source_refs") or []
    assert refs, "source_refs must be present"
    for r in refs:
        assert "document_id" in r and "filename" in r, f"source_ref must be {{document_id, filename}}, got {r}"

    # Truncation note present when total > shown.
    shown = len(refs)
    if payload["total"] > shown:
        note = json.dumps(payload).lower()
        assert "trunc" in note or "showing" in note or "more" in note, (
            "a truncation note must be present when total > shown"
        )
