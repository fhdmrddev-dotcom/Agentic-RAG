"""Phase 111 Wave-0 (RED) — metadata_field_definitions CRUD + RLS forcing (META-01).

The CRUD create endpoint forces `user_id=caller` and `is_system_global=false` (no
client-supplied ownership escalation); list returns own + global enabled rows.

RED convention: the CRUD endpoint lands in Plan 03. Until then the create call
target does not exist, so the behavioral assertions are xfail(strict=False).
The live-DB harness (PG_AVAILABLE skipif + function-scoped pg_pool + seeded
auth.users) is copied verbatim from test_110_dm_audit_live.py — it skips
cleanly (never collection-errors) when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 CRUD tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_env():
    """Read the REAL local SUPABASE_URL + service-role key from backend/.env.

    The conftest plants a fake cloud SUPABASE_URL at import time so the suite runs
    against a mock client; these live tests drive the actual service against the
    local REST gate, so they source the two values straight from backend/.env
    (bypassing the conftest override). Returns None if either is absent → skip.
    Modeled on test_093_ask_user_workflow_run_live.py.
    """
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
    """Build a service-role supabase client against the REAL local Supabase, or skip."""
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
        client.table("metadata_field_definitions").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
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
    """Seed a throwaway auth.users row; FK-safe teardown."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-111-crud-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.metadata_field_definitions WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_crud_create_forces_owner_and_not_global(pg_pool, test_user):
    """The CRUD create path forces user_id=caller and is_system_global=false."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    from app.services.metadata_field_service import create_field_definition

    sb = _supabase_or_skip()
    created = await create_field_definition(
        user_id=test_user,
        field_key="contract_value",
        field_type="number",
        # A client trying to escalate to global must be ignored.
        is_system_global=True,
        supabase=sb,
    )
    row = await pg_pool.fetchrow(
        "SELECT user_id, is_system_global FROM public.metadata_field_definitions WHERE id = $1",
        created["id"],
    )
    assert row is not None, "created field row must exist"
    assert row["user_id"] == test_user, "create must force user_id=caller"
    assert row["is_system_global"] is False, "create must force is_system_global=false (no escalation)"


@pytest.mark.asyncio
async def test_list_returns_own_plus_global_enabled(pg_pool, test_user):
    """List returns the caller's own enabled fields plus global enabled fields."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    from app.services.metadata_field_service import (
        create_field_definition,
        list_field_definitions,
    )

    sb = _supabase_or_skip()
    await create_field_definition(
        user_id=test_user, field_key="own_field", field_type="string", supabase=sb
    )
    fields = await list_field_definitions(user_id=test_user, supabase=sb)
    assert isinstance(fields, list), "list must return a list of field defs"
    keys = {f["field_key"] for f in fields}
    assert "own_field" in keys, "list must return the caller's own field def"
    # Every returned row is either the caller's own or a global row.
    for f in fields:
        assert str(f["user_id"]) == str(test_user) or f["is_system_global"] is True


@pytest.mark.asyncio
async def test_update_delete_own_scoped_404_not_403_on_cross_user(pg_pool, test_user):
    """update/delete are own-scoped: a cross-user/non-existent id collapses to None (→404)."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    from uuid import uuid4

    from app.services.metadata_field_service import (
        create_field_definition,
        update_field_definition,
        delete_field_definition,
    )

    sb = _supabase_or_skip()
    created = await create_field_definition(
        user_id=test_user, field_key="scoped_field", field_type="string", supabase=sb
    )

    # Another user seeds a private field; the caller must NOT be able to touch it.
    other_user = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        other_user, f"phase-111-other-{other_user}@test.local",
    )
    other = await create_field_definition(
        user_id=other_user, field_key="other_field", field_type="string", supabase=sb
    )
    try:
        # update on another user's row → None (router maps to 404, NOT 403)
        miss = await update_field_definition(
            test_user, other["id"], {"enabled": False}, supabase=sb
        )
        assert miss is None, "cross-user update must miss (→404, not 403)"

        # delete on another user's row → False (router maps to 404)
        removed_cross = await delete_field_definition(test_user, other["id"], supabase=sb)
        assert removed_cross is False, "cross-user delete must miss (→404)"

        # own update + delete succeed
        upd = await update_field_definition(
            test_user, created["id"], {"enabled": False}, supabase=sb
        )
        assert upd is not None and upd["enabled"] is False
        removed_own = await delete_field_definition(test_user, created["id"], supabase=sb)
        assert removed_own is True
    finally:
        await pg_pool.execute(
            "DELETE FROM public.metadata_field_definitions WHERE user_id = $1", other_user
        )
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", other_user)
