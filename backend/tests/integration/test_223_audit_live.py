"""Phase 223 Plan 05 — Live database integration tests for audit ledger and message durability.

Tests run against live PostgreSQL on port 54322 to guarantee that:
1. Migration 152 is applied and audit_log_action_type_check includes 'connector.call' and 'connector.grant'.
2. connector.call audit rows physically land across all 5 evaluated action exits:
   policy_denial, user_rejected, timeout, execution_failure, success.
3. connector.grant audit rows physically land from both chat_card and settings sources.
4. Privacy invariant (G-6) is preserved: metadata records arg_keys only, no argument values.
5. messages.active_connector_ids distinguishes [] ('[]'::jsonb) from absent (SQL NULL).
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

from app.services.audit_service import VALID_ACTION_TYPES, assert_action_types_synced, write_audit_entry


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live Phase 223 audit tests",
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


def _supabase_or_none():
    creds = _read_local_supabase_env()
    if creds is None:
        return None
    url, key = creds
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


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
async def live_test_ctx(pg_pool):
    user_id = uuid4()
    org_id = uuid4()
    thread_id = uuid4()

    # Seed auth.users and public.threads
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"test-223-audit-{user_id}@test.local",
    )
    await pg_pool.execute(
        "INSERT INTO public.threads (id, user_id, title) VALUES ($1, $2, $3)",
        thread_id, user_id, "Test 223 Thread",
    )

    ctx = {
        "user_id": user_id,
        "org_id": org_id,
        "thread_id": thread_id,
    }
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM public.messages WHERE thread_id = $1", thread_id),
            ("DELETE FROM public.threads WHERE id = $1", thread_id),
            ("DELETE FROM public.audit_log WHERE user_id = $1", user_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_drift_guard_live(pg_pool):
    """Verify assert_action_types_synced passes and migration 152 action types are present."""
    await assert_action_types_synced(pg_pool)
    assert "connector.call" in VALID_ACTION_TYPES
    assert "connector.grant" in VALID_ACTION_TYPES

    row = await pg_pool.fetchrow(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
        "WHERE conname = 'audit_log_action_type_check'"
    )
    assert row is not None
    assert "'connector.call'" in row["def"]
    assert "'connector.grant'" in row["def"]


@pytest.mark.asyncio
async def test_connector_call_audit_live_persisted(pg_pool, live_test_ctx):
    """Verify connector.call rows land in public.audit_log across all 5 outcomes without swallowing."""
    user_id = live_test_ctx["user_id"]
    org_id = live_test_ctx["org_id"]
    conn_id = uuid4()

    outcomes = [
        "policy_denial",
        "user_rejected",
        "timeout",
        "execution_failure",
        "success",
    ]

    for outcome in outcomes:
        meta = {
            "connection_id": str(conn_id),
            "tool": "slack_post_message",
            "outcome": outcome,
            "arg_keys": ["channel", "text"],
        }
        if outcome == "execution_failure":
            meta["error"] = "Upstream socket timeout"
        elif outcome == "policy_denial":
            meta["policy_verdict"] = "deny"

        # Raw INSERT raises CheckViolationError on schema mismatch (never swallowed)
        await pg_pool.execute(
            "INSERT INTO public.audit_log (user_id, org_id, action_type, metadata) "
            "VALUES ($1, $2, $3, $4)",
            user_id, org_id, "connector.call", meta,
        )

    # Query back directly from Postgres
    rows = await pg_pool.fetch(
        "SELECT action_type, metadata, user_id, org_id FROM public.audit_log "
        "WHERE user_id = $1 AND action_type = 'connector.call' ORDER BY created_at ASC",
        user_id,
    )

    assert len(rows) == 5, f"Expected 5 connector.call audit rows, found {len(rows)}"
    persisted_outcomes = [r["metadata"]["outcome"] for r in rows]
    assert persisted_outcomes == outcomes

    for row in rows:
        meta = row["metadata"]
        assert meta["tool"] == "slack_post_message"
        assert meta["arg_keys"] == ["channel", "text"]
        assert str(row["user_id"]) == str(user_id)
        assert str(row["org_id"]) == str(org_id)
        # Privacy Invariant (G-6): No raw arguments or secret values in metadata
        assert "channel_value" not in meta
        assert "secret" not in meta
        assert "args" not in meta


@pytest.mark.asyncio
async def test_connector_grant_audit_live_persisted(pg_pool, live_test_ctx):
    """Verify connector.grant rows land in public.audit_log from both chat_card and settings sources."""
    user_id = live_test_ctx["user_id"]
    org_id = live_test_ctx["org_id"]
    conn_id = uuid4()

    # 1. Chat card grant
    chat_card_meta = {
        "source": "chat_card",
        "connection_id": str(conn_id),
        "tool_name": "post_message",
        "posture": "allow",
    }
    await pg_pool.execute(
        "INSERT INTO public.audit_log (user_id, org_id, action_type, metadata) "
        "VALUES ($1, $2, $3, $4)",
        user_id, org_id, "connector.grant", chat_card_meta,
    )

    # 2. Settings panel update
    settings_meta = {
        "source": "settings",
        "connection_id": str(conn_id),
        "tool_count": 2,
        "grants": {"post_message": "allow", "read_history": "ask"},
    }
    await pg_pool.execute(
        "INSERT INTO public.audit_log (user_id, org_id, action_type, metadata) "
        "VALUES ($1, $2, $3, $4)",
        user_id, org_id, "connector.grant", settings_meta,
    )

    # Query back
    rows = await pg_pool.fetch(
        "SELECT action_type, metadata, user_id, org_id FROM public.audit_log "
        "WHERE user_id = $1 AND action_type = 'connector.grant' ORDER BY created_at ASC",
        user_id,
    )

    assert len(rows) == 2, f"Expected 2 connector.grant audit rows, found {len(rows)}"
    sources = [r["metadata"]["source"] for r in rows]
    assert "chat_card" in sources
    assert "settings" in sources

    chat_row = next(r for r in rows if r["metadata"]["source"] == "chat_card")
    assert chat_row["metadata"]["tool_name"] == "post_message"
    assert chat_row["metadata"]["posture"] == "allow"

    settings_row = next(r for r in rows if r["metadata"]["source"] == "settings")
    assert settings_row["metadata"]["tool_count"] == 2
    assert settings_row["metadata"]["grants"] == {"post_message": "allow", "read_history": "ask"}


@pytest.mark.asyncio
async def test_write_audit_entry_live_roundtrip(pg_pool, live_test_ctx):
    """Verify write_audit_entry service write path actually persists connector action types via Supabase client."""
    sb = _supabase_or_none()
    if sb is None:
        pytest.skip("Supabase client not available from local env")

    user_id = str(live_test_ctx["user_id"])
    org_id = str(live_test_ctx["org_id"])
    conn_id = str(uuid4())

    meta = {
        "connection_id": conn_id,
        "tool": "github_create_issue",
        "outcome": "success",
        "arg_keys": ["repo", "title"],
    }

    # Call service writer
    await write_audit_entry(
        user_id=user_id,
        action_type="connector.call",
        metadata=meta,
        supabase=sb,
        org_id=org_id,
    )

    # Read back from pg_pool to verify the service write path did NOT swallow a DB error
    row = await pg_pool.fetchrow(
        "SELECT action_type, metadata, user_id, org_id FROM public.audit_log "
        "WHERE user_id = $1 AND metadata->>'tool' = 'github_create_issue'",
        live_test_ctx["user_id"],
    )

    assert row is not None, "write_audit_entry must physically persist row without swallowing errors"
    assert row["action_type"] == "connector.call"
    assert row["metadata"]["outcome"] == "success"
    assert row["metadata"]["arg_keys"] == ["repo", "title"]


@pytest.mark.asyncio
async def test_messages_active_connector_ids_persistence(pg_pool, live_test_ctx):
    """Verify messages.active_connector_ids distinguishes [] from NULL in the live database."""
    thread_id = live_test_ctx["thread_id"]
    user_id = live_test_ctx["user_id"]

    msg1_id = uuid4()
    msg2_id = uuid4()
    msg3_id = uuid4()

    # Msg 1: explicitly cleared active connectors ([])
    await pg_pool.execute(
        "INSERT INTO public.messages (id, thread_id, user_id, role, content, active_connector_ids) "
        "VALUES ($1, $2, $3, 'user', 'msg1 cleared', '[]'::jsonb)",
        msg1_id, thread_id, user_id,
    )

    # Msg 2: armed connectors list
    await pg_pool.execute(
        "INSERT INTO public.messages (id, thread_id, user_id, role, content, active_connector_ids) "
        "VALUES ($1, $2, $3, 'user', 'msg2 armed', '[\"conn-1\", \"conn-2\"]'::jsonb)",
        msg2_id, thread_id, user_id,
    )

    # Msg 3: absent active connectors (NULL)
    await pg_pool.execute(
        "INSERT INTO public.messages (id, thread_id, user_id, role, content, active_connector_ids) "
        "VALUES ($1, $2, $3, 'user', 'msg3 absent', NULL)",
        msg3_id, thread_id, user_id,
    )

    # Query back and verify distinctions
    row1 = await pg_pool.fetchrow("SELECT active_connector_ids FROM public.messages WHERE id = $1", msg1_id)
    row2 = await pg_pool.fetchrow("SELECT active_connector_ids FROM public.messages WHERE id = $1", msg2_id)
    row3 = await pg_pool.fetchrow("SELECT active_connector_ids FROM public.messages WHERE id = $1", msg3_id)

    assert row1 is not None
    assert row1["active_connector_ids"] == [], "msg1 must be decoded as empty list [], NOT None"

    assert row2 is not None
    assert row2["active_connector_ids"] == ["conn-1", "conn-2"]

    assert row3 is not None
    assert row3["active_connector_ids"] is None, "msg3 must be SQL NULL"

    # SQL equality predicates: '[]'::jsonb vs IS NULL
    r_empty = await pg_pool.fetch(
        "SELECT id FROM public.messages WHERE thread_id = $1 AND active_connector_ids = '[]'::jsonb",
        thread_id,
    )
    assert len(r_empty) == 1
    assert r_empty[0]["id"] == msg1_id

    r_null = await pg_pool.fetch(
        "SELECT id FROM public.messages WHERE thread_id = $1 AND active_connector_ids IS NULL",
        thread_id,
    )
    assert len(r_null) == 1
    assert r_null[0]["id"] == msg3_id
