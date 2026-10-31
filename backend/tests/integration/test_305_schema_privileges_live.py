"""Phase 305-01 (D-39 / T-305-23 / BUG-261031-01) — migration 222's privileges, LIVE.

What this proves against the local database (127.0.0.1:54322), as ``postgres``:

* ``public.mcp_usage`` is deny-all to every client role: RLS on, no policy, and
  ``has_table_privilege`` false for anon / authenticated on SELECT / INSERT / UPDATE / DELETE,
  true for service_role.
* ``organizations.pii_redaction_enabled`` is outside mig 194's UPDATE grant: neither anon nor
  authenticated may UPDATE it. Its SELECT privilege is exactly the one every other
  ``organizations`` column already has (anon / authenticated hold a TABLE-level SELECT, and row
  visibility is the ``organizations_select`` RLS policy) — measured, not assumed; see the test.
* the column default reads false and the searches knob default reads 30; the knob's CHECK refuses
  0 and 121 (an UPDATE of the singleton app_settings row as postgres, always rolled back).

⛔ BUG-261031-01: no statement here runs as anon against ``organizations`` or any table whose
policy calls ``current_user_org_ids()`` (that crashed the local cluster in 304-01). The column
proofs are catalog functions called as postgres. The ONE role switch (to anon, transaction-local)
targets ``public.mcp_usage``, which has no policy at all, inside a rolled-back transaction.

Guarded on :54322 only (``requires_pg``), never on 222 being applied: before 222 these tests
FAIL, which is how they were driven RED.
"""

from __future__ import annotations

import pytest

from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = [requires_pg]

CLIENT_ROLES = ("anon", "authenticated")
TABLE_PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE")


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


async def test_mcp_usage_exists_with_rls_on_and_no_policy():
    assert await _fetchval("SELECT to_regclass('public.mcp_usage') IS NOT NULL"), "mcp_usage absent"
    assert await _fetchval(
        "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mcp_usage'::regclass"
    ) is True
    assert await _fetchval(
        "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mcp_usage'"
    ) == 0


@pytest.mark.parametrize("role", CLIENT_ROLES)
@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_client_roles_hold_no_privilege_on_mcp_usage(role, priv):
    assert await _fetchval("SELECT to_regclass('public.mcp_usage') IS NOT NULL"), "mcp_usage absent"
    assert await _fetchval(
        "SELECT has_table_privilege($1, 'public.mcp_usage', $2)", role, priv
    ) is False, (role, priv)


@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_service_role_writes_mcp_usage(priv):
    assert await _fetchval("SELECT to_regclass('public.mcp_usage') IS NOT NULL"), "mcp_usage absent"
    assert await _fetchval(
        "SELECT has_table_privilege('service_role', 'public.mcp_usage', $1)", priv
    ) is True


async def test_anon_select_on_mcp_usage_is_refused():
    """The ONE role switch in this file: anon against a table with NO policy, rolled back."""
    import asyncpg

    c = await _conn()
    try:
        assert await c.fetchval("SELECT to_regclass('public.mcp_usage') IS NOT NULL"), "mcp_usage absent"
        refused = False
        try:
            async with c.transaction():
                await c.execute("SET LOCAL ROLE anon")
                try:
                    await c.fetch("SELECT 1 FROM public.mcp_usage LIMIT 1")
                except asyncpg.InsufficientPrivilegeError:
                    refused = True
                raise _Rollback
        except _Rollback:
            pass
        assert refused, "anon could SELECT from public.mcp_usage"
    finally:
        await c.close()


async def _column(table: str, column: str):
    c = await _conn()
    try:
        return await c.fetchrow(
            "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
            table,
            column,
        )
    finally:
        await c.close()


async def test_pii_redaction_column_defaults_false():
    row = await _column("organizations", "pii_redaction_enabled")
    assert row is not None, "organizations.pii_redaction_enabled absent"
    assert row["data_type"] == "boolean" and row["is_nullable"] == "NO"
    assert (row["column_default"] or "").strip() == "false"


@pytest.mark.parametrize("role", CLIENT_ROLES)
async def test_no_client_role_may_update_pii_redaction(role):
    assert await _column("organizations", "pii_redaction_enabled") is not None, "column absent"
    assert await _fetchval(
        "SELECT has_column_privilege($1, 'public.organizations', 'pii_redaction_enabled', 'UPDATE')",
        role,
    ) is False, role


@pytest.mark.parametrize("role", CLIENT_ROLES)
async def test_pii_redaction_select_is_no_wider_than_mcp_enabled(role):
    """Measured 2026-10-31: anon and authenticated hold TABLE-level SELECT on organizations
    (relacl ``anon=rm`` / ``authenticated=rm``), so every column — mcp_enabled (mig 220) included —
    reads ``has_column_privilege(..., 'SELECT') = true``; rows are gated by RLS
    (``organizations_select``). A column-level REVOKE cannot narrow a table-level grant, so the
    honest pin is: the new column is exactly as readable as the 304 switch, never wider, and RLS
    is on. Narrowing anon's table SELECT on organizations is outside 305 (it is not this column's).
    """
    assert await _column("organizations", "pii_redaction_enabled") is not None, "column absent"
    new = await _fetchval(
        "SELECT has_column_privilege($1, 'public.organizations', 'pii_redaction_enabled', 'SELECT')",
        role,
    )
    old = await _fetchval(
        "SELECT has_column_privilege($1, 'public.organizations', 'mcp_enabled', 'SELECT')", role
    )
    assert new == old, (role, new, old)
    assert await _fetchval(
        "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.organizations'::regclass"
    ) is True


async def test_searches_knob_defaults_30():
    row = await _column("app_settings", "api_key_searches_per_minute")
    assert row is not None, "app_settings.api_key_searches_per_minute absent"
    assert row["data_type"] == "integer" and row["is_nullable"] == "NO"
    assert (row["column_default"] or "").strip() == "30"


@pytest.mark.parametrize("value", [0, 121])
async def test_searches_knob_check_refuses_out_of_bounds(value):
    import asyncpg

    c = await _conn()
    try:
        assert await c.fetchval("SELECT count(*) FROM public.app_settings") >= 1, "non-vacuity"
        refused = False
        try:
            async with c.transaction():
                try:
                    await c.execute(
                        "UPDATE public.app_settings SET api_key_searches_per_minute = $1", value
                    )
                except asyncpg.CheckViolationError as exc:
                    refused = "app_settings_api_key_searches_per_minute_bound" in str(exc)
                raise _Rollback
        except _Rollback:
            pass
        assert refused, f"api_key_searches_per_minute = {value} was accepted"
    finally:
        await c.close()
