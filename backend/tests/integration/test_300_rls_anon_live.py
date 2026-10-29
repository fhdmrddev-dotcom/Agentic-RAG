"""Phase 300-02 (D-19 / D-29 / T-300-09 / T-300-10) — the notice tables' wall, LIVE.

* ``public.notifications`` is readable ONLY by its recipient (one owner-only SELECT policy) and
  writable by no client role.
* ``public.notification_deliveries`` (the outbox) is deny-all to every client role.
* ``anon`` reads nothing from either table — every gate in this project reads through the service
  role, so nothing else in the suite ever makes a request as anon (BUG-260911-01). This one does.
* both trigger functions are executable by neither PUBLIC, anon nor authenticated.
* ``org_invitations``' new delivery columns are updatable by ``authenticated`` exactly as the existing
  ``role`` column is (the column-grant trap — asserted, not assumed).

The caller's RLS context is ``app.dependencies._apply_rls_user_context`` — imported, never retyped —
inside a savepoint that is always rolled back; the outer transaction is ALWAYS rolled back too.
Skip-guarded on :54322 AND on 218 being applied; run with ``-rs``.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import requires_pg
from tests.integration.test_300_notice_triggers_live import (
    _prompt,
    _run,
    _user,
    _world,
    requires_218,
)

pytestmark = [requires_pg, requires_218]

TABLES = ("public.notifications", "public.notification_deliveries")
FUNCTIONS = ("public.notify_on_ask_row()", "public.notify_on_run_status()")


class _Rollback(Exception):
    pass


async def _savepoint(conn, fn):
    """Run ``fn(conn)`` in a savepoint that is always rolled back; return its result."""
    box: dict = {}
    try:
        async with conn.transaction():
            box["v"] = await fn(conn)
            raise _Rollback
    except _Rollback:
        pass
    return box.get("v")


async def _seed_two_recipients(w):
    """A notice for the owner (run A) and one for a second user (run B), both in the owner's thread."""
    c = w.conn
    await _prompt(c, w, w.run, "tc-owner")
    run_b = await _run(c, w, user=w.other)
    await _prompt(c, w, run_b, "tc-other")
    rows = await c.fetch("SELECT id, recipient_id FROM public.notifications WHERE run_id IN ($1, $2)", w.run, run_b)
    by_recipient = {r["recipient_id"]: r["id"] for r in rows}
    assert set(by_recipient) == {w.owner, w.other}, "non-vacuity: both notices must exist"
    return by_recipient


# ── anon reads and writes nothing ────────────────────────────────────────────────


@pytest.mark.parametrize("table", TABLES)
async def test_anon_reads_nothing(table):
    import asyncpg

    async with _world() as w:
        await _seed_two_recipients(w)

        async def _as_anon(c):
            await c.execute("SET LOCAL ROLE anon")
            try:
                return await c.fetch(f"SELECT * FROM {table}")
            except asyncpg.InsufficientPrivilegeError:
                return "refused"

        got = await _savepoint(w.conn, _as_anon)
        assert got == "refused" or got == [], (table, got)


async def test_anon_cannot_insert_a_notice():
    import asyncpg

    async with _world() as w:
        async def _as_anon(c):
            await c.execute("SET LOCAL ROLE anon")
            with pytest.raises(asyncpg.PostgresError):
                await c.execute(
                    "INSERT INTO public.notifications (recipient_id, run_id, kind) VALUES ($1, $2, 'question')",
                    w.owner, w.run,
                )
            return True

        assert await _savepoint(w.conn, _as_anon)


async def test_anon_cannot_insert_a_delivery():
    import asyncpg

    async with _world() as w:
        await _prompt(w.conn, w, w.run, "tc-anon-d")
        nid = await w.conn.fetchval("SELECT id FROM public.notifications WHERE run_id = $1", w.run)
        await w.conn.execute("DELETE FROM public.notification_deliveries WHERE notification_id = $1", nid)

        async def _as_anon(c):
            await c.execute("SET LOCAL ROLE anon")
            with pytest.raises(asyncpg.PostgresError):
                await c.execute(
                    "INSERT INTO public.notification_deliveries (notification_id, due_at) VALUES ($1, now())",
                    nid,
                )
            return True

        assert await _savepoint(w.conn, _as_anon)


# ── authenticated: own notices only, no writes, no outbox ────────────────────────


async def test_a_recipient_sees_her_own_notice_and_not_anothers():
    async with _world() as w:
        by_recipient = await _seed_two_recipients(w)

        async def _as(uid):
            async def _read(c):
                await _apply_rls_user_context(c, str(uid))
                assert await c.fetchval("SELECT auth.uid()") == uid, "fail-loud: auth.uid() must resolve"
                return [r["id"] for r in await c.fetch("SELECT id FROM public.notifications")]

            return await _savepoint(w.conn, _read)

        assert await _as(w.owner) == [by_recipient[w.owner]]
        assert await _as(w.other) == [by_recipient[w.other]]
        stranger = await _user(w.conn, "stranger")
        assert await _as(stranger) == []


async def test_authenticated_reads_nothing_from_the_outbox():
    import asyncpg

    async with _world() as w:
        await _seed_two_recipients(w)
        assert await w.conn.fetchval("SELECT count(*) FROM public.notification_deliveries") >= 2

        async def _read(c):
            await _apply_rls_user_context(c, str(w.owner))
            try:
                return await c.fetch("SELECT * FROM public.notification_deliveries")
            except asyncpg.InsufficientPrivilegeError:
                return "refused"

        got = await _savepoint(w.conn, _read)
        assert got == "refused" or got == [], got


@pytest.mark.parametrize(
    "statement",
    [
        "INSERT INTO public.notifications (recipient_id, run_id, kind) VALUES ($1, $2, 'question')",
        "UPDATE public.notifications SET closed_at = now() WHERE recipient_id = $1 AND run_id = $2",
        "DELETE FROM public.notifications WHERE recipient_id = $1 AND run_id = $2",
    ],
    ids=["insert", "update", "delete"],
)
async def test_authenticated_cannot_write_notices(statement):
    import asyncpg

    async with _world() as w:
        await _prompt(w.conn, w, w.run, "tc-own")

        async def _write(c):
            await _apply_rls_user_context(c, str(w.owner))
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await c.execute(statement, w.owner, w.run)
            return True

        assert await _savepoint(w.conn, _write)
        (n,) = await w.conn.fetch("SELECT closed_at FROM public.notifications WHERE run_id = $1", w.run)
        assert n["closed_at"] is None


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE public.notification_deliveries SET status = 'sent'",
        "DELETE FROM public.notification_deliveries",
    ],
    ids=["update", "delete"],
)
async def test_authenticated_cannot_write_the_outbox(statement):
    import asyncpg

    async with _world() as w:
        await _prompt(w.conn, w, w.run, "tc-outbox")

        async def _write(c):
            await _apply_rls_user_context(c, str(w.owner))
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await c.execute(statement)
            return True

        assert await _savepoint(w.conn, _write)


# ── privileges ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("fn", FUNCTIONS)
@pytest.mark.parametrize("role", ["public", "anon", "authenticated"])
async def test_no_client_role_may_execute_the_trigger_functions(fn, role):
    async with _world() as w:
        assert not await w.conn.fetchval(
            "SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE')", role, fn
        ), f"{role} unexpectedly holds EXECUTE on {fn} (revoke FROM PUBLIC first — the CLAUDE.md trap)"


@pytest.mark.parametrize("fn", FUNCTIONS)
async def test_the_trigger_functions_are_definer_rights_with_an_empty_search_path(fn):
    async with _world() as w:
        row = await w.conn.fetchrow(
            "SELECT prosecdef, proconfig FROM pg_proc WHERE oid = $1::regprocedure", fn
        )
        assert row["prosecdef"] is True
        assert row["proconfig"] and any(
            c.replace('"', "") in ("search_path=", "search_path=''") for c in row["proconfig"]
        ), row["proconfig"]


@pytest.mark.parametrize("table", TABLES)
async def test_rls_is_on_for_both_tables(table):
    async with _world() as w:
        assert await w.conn.fetchval("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", table)


async def test_the_outbox_carries_no_policy_and_notices_carry_exactly_one():
    async with _world() as w:
        rows = await w.conn.fetch(
            "SELECT tablename, policyname, cmd, roles::text[] AS roles FROM pg_policies"
            " WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_deliveries')"
        )
        assert [r["tablename"] for r in rows] == ["notifications"], rows
        assert rows[0]["cmd"] == "SELECT" and rows[0]["roles"] == ["authenticated"]


@pytest.mark.parametrize("column", ["email_delivery", "email_failed_at", "email_failure"])
async def test_invitation_delivery_columns_are_updatable_exactly_as_role_is(column):
    async with _world() as w:
        c = w.conn
        role_priv = await c.fetchval(
            "SELECT has_column_privilege('authenticated', 'public.org_invitations', 'role', 'UPDATE')"
        )
        col_priv = await c.fetchval(
            "SELECT has_column_privilege('authenticated', 'public.org_invitations', $1, 'UPDATE')", column
        )
        table_level = await c.fetchval(
            "SELECT has_table_privilege('authenticated', 'public.org_invitations', 'UPDATE')"
        )
        assert col_priv == role_priv, (
            f"org_invitations.{column} UPDATE for authenticated is {col_priv} but 'role' is {role_priv}. "
            f"table-level UPDATE = {table_level}. 'role' is column-granted, so migration 218 MUST add "
            "`GRANT UPDATE (email_delivery, email_failed_at, email_failure) ON public.org_invitations "
            "TO authenticated` — plan 03 persists the delivery outcome inside a try/except, so a missing "
            "grant would hide the 'Email not sent' marker silently."
        )


async def test_triggers_fire_for_a_client_role_without_execute():
    """A notice is written even when the message is inserted by an authenticated caller."""
    async with _world() as w:
        c = w.conn
        assert not await c.fetchval(
            "SELECT has_function_privilege('authenticated', 'public.notify_on_ask_row()'::regprocedure, 'EXECUTE')"
        )
        tcid = f"tc-auth-{uuid4().hex[:6]}"
        await c.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
            w.org_a, w.owner,
        )

        async def _insert_as_owner(conn):
            await _apply_rls_user_context(conn, str(w.owner))
            # The answer route inserts its ask_user_response row on a user-JWT client — the trigger
            # must still be able to close the (deny-all-to-clients) notice.
            await conn.execute(
                "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
                " VALUES ($1, $2, 'system', 'Acme', 'harness', $3,"
                " jsonb_build_array(jsonb_build_object('kind', 'ask_user_response', 'tool_call_id', $4::text)))",
                w.thread, w.owner, w.org_a, tcid,
            )
            return True

        await _prompt(c, w, w.run, tcid)
        await c.execute("SAVEPOINT t300_auth")
        assert await _insert_as_owner(c)
        await c.execute("RESET ROLE")
        closed = await c.fetchval(
            "SELECT closed_reason FROM public.notifications WHERE tool_call_id = $1", tcid
        )
        await c.execute("ROLLBACK TO SAVEPOINT t300_auth")
        assert closed == "answered"
