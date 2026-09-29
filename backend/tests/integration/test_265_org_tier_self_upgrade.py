"""Phase 265 · R265-audit-fixes-01 — an org admin must not be able to raise their own plan.

── THE DEFECT THIS FILE EXISTS TO CLOSE ─────────────────────────────────────────────────
Every v4.3 tier gate reads ``organizations.subscription_tier`` and ``organizations.add_ons``
(``app/db/entitlements.py``). Supabase's default ``GRANT ALL ON ALL TABLES IN SCHEMA public TO
anon, authenticated`` left both roles holding TABLE-level INSERT and UPDATE on
``organizations``, and the only UPDATE policy is ``current_user_has_permission(id,
'org:manage')``. So any org admin could open devtools and run

    await supabase.from("organizations").update({subscription_tier: "enterprise"}).eq("id", myOrg)

and every refusal Phase 258 built would let them through. Measured on PRODUCTION on
2026-09-24 (read-only): ``has_column_privilege('authenticated', 'public.organizations',
'subscription_tier', 'UPDATE') = true``, same for ``add_ons``, no trigger on the table.

⚠ **A column-only ``REVOKE UPDATE (subscription_tier) … FROM authenticated`` is a NO-OP here**,
because the privilege is held at TABLE level and a column revoke cannot subtract from it.
Migration 194 revokes table-level INSERT/UPDATE and grants UPDATE back column by column.

── WHY AT THE DATABASE LEVEL ────────────────────────────────────────────────────────────
No app code writes ``organizations`` at all — org creation runs through the SECURITY DEFINER
functions ``create_org_with_default_dept`` / ``handle_new_user``. The hole is reachable only
through PostgREST as ``authenticated``, so only a real Postgres session under that role can
observe it.

DB writes: **none that survive**. Each probe runs inside a transaction that is always rolled
back, and the refusal (42501) fires before any row is touched.
"""

from __future__ import annotations

import os

import pytest

psycopg2 = pytest.importorskip("psycopg2")

_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

_INSUFFICIENT_PRIVILEGE = "42501"

# Columns an org admin may still edit. Spelled out independently of the migration, so a
# fence and the thing it fences cannot move together.
_EDITABLE_COLUMNS = ("name", "slug", "settings", "updated_at")
_PROTECTED_COLUMNS = ("subscription_tier", "add_ons", "id", "created_at")


def _pg_available() -> bool:
    try:
        conn = psycopg2.connect(_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:  # noqa: BLE001 — no live DB is a SKIP, not a failure
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(), reason="no live local Postgres on :54322 to gate against"
)


@pytest.fixture()
def conn():
    connection = psycopg2.connect(_DSN)
    connection.autocommit = False
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


def _probe(conn, role: str, sql: str) -> None:
    """Run ``sql`` as ``role`` inside a transaction that is ALWAYS rolled back."""
    cur = conn.cursor()
    try:
        cur.execute(f"SET LOCAL ROLE {role}")
        cur.execute(sql)
    finally:
        cur.close()
        conn.rollback()


@pytest.mark.parametrize("role", ["authenticated", "anon"])
@pytest.mark.parametrize("column", ["subscription_tier", "add_ons"])
def test_a_client_role_cannot_update_the_plan_columns(conn, role, column):
    """The headline property. The refusal must be a PRIVILEGE refusal (42501): an ``UPDATE 0``
    from RLS would pass for the wrong reason on a DB where the probe matched no row."""
    value = "'enterprise'" if column == "subscription_tier" else "'{\"workflows\": true}'::jsonb"
    with pytest.raises(psycopg2.errors.InsufficientPrivilege) as excinfo:
        _probe(conn, role, f"UPDATE public.organizations SET {column} = {value}")
    assert excinfo.value.pgcode == _INSUFFICIENT_PRIVILEGE


@pytest.mark.parametrize("role", ["authenticated", "anon"])
def test_a_client_role_cannot_insert_an_org_with_a_plan(conn, role):
    """Creating a fresh org at ``enterprise`` is the same bypass by another door.

    ⚠ This case was ALREADY green before migration 194: with no INSERT policy, RLS refuses the
    row with the same pgcode 42501. It stays as a behaviour pin; the GRANT itself is pinned by
    ``test_the_privilege_catalogue_agrees`` (``has_table_privilege … INSERT``), which was red."""
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        _probe(
            conn,
            role,
            "INSERT INTO public.organizations (name, subscription_tier) "
            "VALUES ('probe-265', 'enterprise')",
        )


def test_the_privilege_catalogue_agrees(conn):
    """Read the catalogue directly, so a future table-level GRANT is caught even if the
    probes above were somehow skipped."""
    cur = conn.cursor()
    try:
        for column in _PROTECTED_COLUMNS:
            for role in ("authenticated", "anon"):
                cur.execute(
                    "SELECT has_column_privilege(%s, 'public.organizations', %s, 'UPDATE')",
                    (role, column),
                )
                assert cur.fetchone()[0] is False, f"{role} can still UPDATE {column}"
        for role in ("authenticated", "anon"):
            cur.execute(
                "SELECT has_table_privilege(%s, 'public.organizations', 'INSERT')", (role,)
            )
            assert cur.fetchone()[0] is False, f"{role} can still INSERT organizations"
    finally:
        cur.close()


def test_an_org_admin_can_still_edit_the_harmless_columns(conn):
    """The other half: without it the fix could be "revoke everything" and still pass.
    ``WHERE false`` touches no row, but the privilege check runs at plan time."""
    for column in _EDITABLE_COLUMNS:
        _probe(conn, "authenticated", f"UPDATE public.organizations SET {column} = {column} WHERE false")
