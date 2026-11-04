"""Phase 307-01 (D-33 / D-15 / D-53 / D-08; T-307-17) — migration 224's privileges and shape, LIVE.

What this proves against the local database (127.0.0.1:54322), as ``postgres``:

* ``public.oauth_clients`` and ``public.oauth_tokens`` are deny-all to every client role: RLS on, no
  policy, ``has_table_privilege`` false for anon / authenticated on SELECT / INSERT / UPDATE / DELETE,
  true for service_role.
* ``api_keys.oauth_client_id`` is NOT in the ``authenticated`` column grant (D-33).
* two unrevoked GRANT rows with the same label for one (org, user) both insert, while two unrevoked
  KEY rows with the same label still collide on ``api_keys_owner_label_active_uq`` (D-53, same name).
* ``api_keys_oauth_kind_check`` refuses a workflow row carrying a client id (D-15); deleting a client
  a grant references fails (RESTRICT); deleting the grant cascades its tokens.
* ``app_settings.mcp_oauth_redirect_hosts`` reads the two built-in hosts (D-08).

Every row this file writes is written inside a transaction that is ROLLED BACK — nothing persists.

⛔ BUG-261031-01: the ONE role switch (to anon, transaction-local) targets ``public.oauth_tokens``,
which has no policy at all, inside a rolled-back transaction. Never ``api_keys``.

Guarded on :54322 only (``requires_pg``), never on 224 being applied: before 224 these FAIL.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = [requires_pg]

CLIENT_ROLES = ("anon", "authenticated")
TABLE_PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE")
NEW_TABLES = ("oauth_clients", "oauth_tokens")


class _Rollback(Exception):
    pass


async def _conn():
    import asyncpg

    return await asyncpg.connect(PG_TEST_DSN)


async def _fetchval(sql: str, *args):
    c = await _conn()
    try:
        return await c.fetchval(sql, *args)
    finally:
        await c.close()


async def _exists(table: str) -> bool:
    return bool(await _fetchval(f"SELECT to_regclass('public.{table}') IS NOT NULL"))


@pytest.mark.parametrize("table", NEW_TABLES)
async def test_table_exists_with_rls_on_and_no_policy(table):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(
        f"SELECT relrowsecurity FROM pg_class WHERE oid = 'public.{table}'::regclass"
    ) is True
    assert await _fetchval(
        "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = $1", table
    ) == 0


@pytest.mark.parametrize("table", NEW_TABLES)
@pytest.mark.parametrize("role", CLIENT_ROLES)
@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_client_roles_hold_no_privilege(table, role, priv):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(
        f"SELECT has_table_privilege($1, 'public.{table}', $2)", role, priv
    ) is False, (table, role, priv)


@pytest.mark.parametrize("table", NEW_TABLES)
@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_service_role_writes(table, priv):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(
        f"SELECT has_table_privilege('service_role', 'public.{table}', $1)", priv
    ) is True


async def test_authenticated_cannot_read_the_grant_column():
    assert await _fetchval(
        "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' "
        "AND table_name = 'api_keys' AND column_name = 'oauth_client_id'"
    ) == 1, "api_keys.oauth_client_id absent"
    assert await _fetchval(
        "SELECT has_column_privilege('authenticated', 'public.api_keys', 'oauth_client_id', 'SELECT')"
    ) is False
    assert await _fetchval(
        "SELECT has_column_privilege('anon', 'public.api_keys', 'oauth_client_id', 'SELECT')"
    ) is False


async def test_anon_select_on_oauth_tokens_is_refused():
    """The ONE role switch in this file: anon against a table with NO policy, rolled back."""
    import asyncpg

    c = await _conn()
    try:
        assert await c.fetchval("SELECT to_regclass('public.oauth_tokens') IS NOT NULL"), "absent"
        refused = False
        try:
            async with c.transaction():
                await c.execute("SET LOCAL ROLE anon")
                try:
                    await c.fetch("SELECT 1 FROM public.oauth_tokens LIMIT 1")
                except asyncpg.InsufficientPrivilegeError:
                    refused = True
                raise _Rollback
        except _Rollback:
            pass
        assert refused, "anon could SELECT from public.oauth_tokens"
    finally:
        await c.close()


# ── row behaviour, all inside one rolled-back transaction ────────────────────────────────────


async def _seed(c) -> dict:
    """A user, an org and an OAuth client — inside the caller's transaction."""
    user_id, org_id = uuid4(), uuid4()
    await c.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", user_id, f"p307-01-{user_id.hex[:8]}@test.local"
    )
    await c.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2)", org_id, f"p307-01-{org_id.hex[:8]}"
    )
    client = await c.fetchval(
        "INSERT INTO public.oauth_clients (client_id, kind, client_name, redirect_uris) "
        "VALUES ($1, 'dcr', 'Claude', $2::jsonb) RETURNING id",
        f"p307-01-{uuid4().hex}",
        json.dumps(["https://claude.ai/api/mcp/auth_callback"]),
    )
    return {"user": user_id, "org": org_id, "client": client}


async def _key(c, w: dict, *, label: str, kind: str = "mcp", client=None):
    return await c.fetchval(
        "INSERT INTO public.api_keys (org_id, user_id, label, key_prefix, key_hash, workflows, "
        "expires_at, kind, tools, oauth_client_id) "
        "VALUES ($1, $2, $3, 'srl_mcp_xxxx', $4, $5::jsonb, $6, $7, $8::jsonb, $9) RETURNING id",
        w["org"],
        w["user"],
        label,
        uuid4().hex + uuid4().hex,
        "[]" if kind == "mcp" else json.dumps([{"id": str(uuid4()), "name": "w"}]),
        datetime.now(timezone.utc) + timedelta(days=90),
        kind,
        json.dumps(["search_knowledge_base"]) if kind == "mcp" else None,
        client,
    )


async def _in_rollback(body):
    c = await _conn()
    try:
        try:
            async with c.transaction():
                await body(c)
                raise _Rollback
        except _Rollback:
            pass
    finally:
        await c.close()


async def _raises(c, exc_type, coro_fn) -> str | None:
    """Run one statement in a SAVEPOINT; return the error text if it raised ``exc_type``."""
    try:
        async with c.transaction():
            await coro_fn()
    except exc_type as exc:
        return str(exc) + " " + str(getattr(exc, "constraint_name", "") or "")
    return None


async def test_two_grants_share_a_label_but_two_keys_do_not():
    import asyncpg

    async def body(c):
        w = await _seed(c)
        await _key(c, w, label="Claude", client=w["client"])
        await _key(c, w, label="Claude", client=w["client"])  # second grant: allowed
        await _key(c, w, label="Same label")
        err = await _raises(c, asyncpg.UniqueViolationError, lambda: _key(c, w, label="Same label"))
        assert err is not None and "api_keys_owner_label_active_uq" in err, err

    await _in_rollback(body)


async def test_workflow_row_with_a_client_fails_the_kind_check():
    import asyncpg

    async def body(c):
        w = await _seed(c)
        err = await _raises(
            c, asyncpg.CheckViolationError,
            lambda: _key(c, w, label="wf", kind="workflow", client=w["client"]),
        )
        assert err is not None and "api_keys_oauth_kind_check" in err, err

    await _in_rollback(body)


async def test_client_delete_is_restricted_and_grant_delete_cascades_tokens():
    import asyncpg

    async def body(c):
        w = await _seed(c)
        grant = await _key(c, w, label="Claude", client=w["client"])
        for kind in ("access", "refresh"):
            await c.execute(
                "INSERT INTO public.oauth_tokens (grant_id, kind, token_hash, resource, expires_at) "
                "VALUES ($1, $2, $3, 'http://localhost:8000/mcp', now() + interval '1 hour')",
                grant, kind, uuid4().hex + uuid4().hex,
            )
        err = await _raises(
            c, asyncpg.ForeignKeyViolationError,
            lambda: c.execute("DELETE FROM public.oauth_clients WHERE id = $1", w["client"]),
        )
        assert err is not None, "deleting a client a grant references must fail (RESTRICT)"
        assert await c.fetchval("SELECT count(*) FROM public.oauth_tokens WHERE grant_id = $1", grant) == 2
        await c.execute("DELETE FROM public.api_keys WHERE id = $1", grant)
        assert await c.fetchval("SELECT count(*) FROM public.oauth_tokens WHERE grant_id = $1", grant) == 0

    await _in_rollback(body)


async def test_redirect_host_allowlist_reads_the_two_built_in_hosts():
    raw = await _fetchval(
        "SELECT mcp_oauth_redirect_hosts::text FROM public.app_settings WHERE id = 'global'"
    )
    assert raw is not None, "app_settings('global').mcp_oauth_redirect_hosts absent"
    hosts = [e.get("host") for e in json.loads(raw)]
    assert hosts == ["claude.ai", "claude.com"], hosts
