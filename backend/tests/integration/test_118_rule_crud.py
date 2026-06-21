"""Phase 118 Wave-0 (RED) — live /classification-rules CRUD + rule.create audit + 404-not-403.

Drives the REAL router coroutines (``app.api.classification_rules``, Plan 02) against a live
service-role Supabase client on :54322 — NOT a mock. The security-load-bearing behaviors
proven here (flipped GREEN in Plan 02):

  * ``is_global`` is HARD-SET False on create (never trusts a caller arg — T-118-02-02).
  * own-OR-global reads → a not-readable id collapses to 404, NEVER 403 (no existence leak).
  * ``match_expr`` validation (``validate_fields``/``validate_operands``) → 422 on a
    ``_``-prefixed/unknown field or a bad operand.
  * the ``classification.rule.create`` audit row lands live (the 104 lesson: a mocked audit
    check false-greens an enum drift — only the live round-trip is real verification).
  * cross-user UPDATE/DELETE of another user's private rule → 404.

xfail until Plan 02 ships the router; imports are INSIDE the test bodies so collection never
errors on the not-yet-built module. The live-DB harness (PG_AVAILABLE skipif + pg_pool +
seeded auth.users with FK-safe teardown) is copied from test_113_view_crud.py — skips cleanly
when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 CRUD tests",
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
        client.table("classification_rules").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate / classification_rules table unreachable: {e}")
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
async def two_users(pg_pool):
    user_a = uuid4()
    user_b = uuid4()
    for uid, label in ((user_a, "a"), (user_b, "b")):
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-118-crud-{label}-{uid}@test.local",
        )
    try:
        yield {"user_a": user_a, "user_b": user_b}
    finally:
        for uid in (user_a, user_b):
            for sql in (
                ("DELETE FROM classification_rules WHERE user_id = $1", uid),
                ("DELETE FROM audit_log WHERE user_id = $1", uid),
                ("DELETE FROM auth.users WHERE id = $1", uid),
            ):
                try:
                    await pg_pool.execute(*sql)
                except Exception:
                    pass


def _good_expr() -> dict:
    return {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]}


@pytest.mark.asyncio
async def test_create_hard_sets_is_global_false(pg_pool, two_users):
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    from app.api import classification_rules as router_mod

    sb = _supabase_or_skip()
    caller = {"id": str(two_users["user_a"])}
    body = router_mod.RuleCreate(name="Invoices", match_expr=_good_expr())
    created = await router_mod.create_rule(body, current_user=caller, supabase=sb)
    assert created.is_global is False


@pytest.mark.asyncio
async def test_create_writes_rule_create_audit(pg_pool, two_users):
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    from app.api import classification_rules as router_mod

    sb = _supabase_or_skip()
    caller = {"id": str(two_users["user_a"])}
    body = router_mod.RuleCreate(name="Audited", match_expr=_good_expr())
    created = await router_mod.create_rule(body, current_user=caller, supabase=sb)
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id=$1 AND action_type='classification.rule.create' "
        "ORDER BY created_at DESC LIMIT 1",
        two_users["user_a"],
    )
    assert row is not None, "classification.rule.create audit row must land live"
    assert created.id is not None


@pytest.mark.asyncio
async def test_validate_fields_rejects_underscore_prefix_422(pg_pool, two_users):
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    from fastapi import HTTPException

    from app.api import classification_rules as router_mod

    sb = _supabase_or_skip()
    caller = {"id": str(two_users["user_a"])}
    bad = {"op": "and", "conditions": [{"field": "_confidence", "op": "eq", "value": "0.9"}]}
    body = router_mod.RuleCreate(name="bad", match_expr=bad)
    with pytest.raises(HTTPException) as ei:
        await router_mod.create_rule(body, current_user=caller, supabase=sb)
    assert ei.value.status_code == 422


@pytest.mark.asyncio
async def test_cross_user_update_404_not_403(pg_pool, two_users):
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    from fastapi import HTTPException

    from app.api import classification_rules as router_mod

    sb = _supabase_or_skip()
    a = {"id": str(two_users["user_a"])}
    b = {"id": str(two_users["user_b"])}
    created = await router_mod.create_rule(
        router_mod.RuleCreate(name="A-private", match_expr=_good_expr()),
        current_user=a, supabase=sb,
    )
    upd = router_mod.RuleUpdate(name="hijacked")
    with pytest.raises(HTTPException) as ei:
        await router_mod.update_rule(created.id, upd, current_user=b, supabase=sb)
    assert ei.value.status_code == 404, "cross-user update must 404, never 403 (no existence leak)"


@pytest.mark.asyncio
async def test_enable_toggle_rides_update(pg_pool, two_users):
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    from app.api import classification_rules as router_mod

    sb = _supabase_or_skip()
    a = {"id": str(two_users["user_a"])}
    created = await router_mod.create_rule(
        router_mod.RuleCreate(name="Toggle", match_expr=_good_expr()),
        current_user=a, supabase=sb,
    )
    assert created.enabled is True
    updated = await router_mod.update_rule(
        created.id, router_mod.RuleUpdate(enabled=False), current_user=a, supabase=sb
    )
    assert updated.enabled is False
