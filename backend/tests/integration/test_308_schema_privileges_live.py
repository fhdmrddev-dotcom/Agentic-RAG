"""Phase 308-01 (D-05 / D-06 / D-07 / D-12 / D-27 / D-32 / D-42 / D-47 / D-48; T-308-10/11/06/17)
— migration 225's privileges, shape and emission, LIVE against the local database (127.0.0.1:54322).

* the four webhook tables are deny-all: RLS on, no policy, no privilege for anon / authenticated,
  every privilege for service_role; ONE ``SET LOCAL ROLE anon`` read of ``webhook_endpoints`` (a table
  with NO policy, BUG-261031-01) inside a rolled-back transaction is refused;
* both emit functions are definer-rights with an empty search_path and nobody but service_role may
  EXECUTE them (PUBLIC included — the CLAUDE.md trap);
* the CHECKs refuse a plaintext secret, an http url, a fragment, userinfo, an empty event list and a
  101-character description; a webhook_disabled notice without an endpoint fails the shape CHECK and
  deleting the endpoint removes its notice;
* the triggers emit: one ``run.finished`` per run (a second terminal write adds nothing), nothing for a
  golden run or when no endpoint subscribes, ``run.waiting`` on pause, ``document.ingested`` on
  ``processing -> completed`` and on an INSERT already ``completed``;
* ``scripts/check-migration-225-live.py`` prints ``225 live`` and a second apply of 225 succeeds.

Every row this file writes is inside a transaction that is ROLLED BACK. Guarded on :54322 only
(``requires_pg``), never on 225 being applied: before 225 these FAIL rather than skip.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest

from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = [requires_pg]

REPO = Path(__file__).resolve().parents[3]
MIGRATION = REPO / "supabase" / "migrations" / "225_webhooks.sql"
CLIENT_ROLES = ("anon", "authenticated")
TABLE_PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE")
TABLES = ("webhook_endpoints", "webhook_events", "webhook_deliveries", "webhook_delivery_attempts")
FUNCTIONS = ("public.webhook_emit_run_event()", "public.webhook_emit_document_event()")
SECRET = "enc:v1:dGVzdA"


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


# ── privileges ───────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("table", TABLES)
async def test_table_exists_with_rls_on_and_no_policy(table):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(f"SELECT relrowsecurity FROM pg_class WHERE oid = 'public.{table}'::regclass") is True
    assert await _fetchval(
        "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = $1", table
    ) == 0


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("role", CLIENT_ROLES)
@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_client_roles_hold_no_privilege(table, role, priv):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(f"SELECT has_table_privilege($1, 'public.{table}', $2)", role, priv) is False


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("priv", TABLE_PRIVS)
async def test_service_role_holds_every_privilege(table, priv):
    assert await _exists(table), f"{table} absent"
    assert await _fetchval(f"SELECT has_table_privilege('service_role', 'public.{table}', $1)", priv) is True


@pytest.mark.parametrize("fn", FUNCTIONS)
@pytest.mark.parametrize("role", ["public", "anon", "authenticated"])
async def test_no_client_role_may_execute_an_emit_function(fn, role):
    assert await _fetchval("SELECT to_regprocedure($1) IS NOT NULL", fn), f"{fn} absent"
    assert await _fetchval("SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE')", role, fn) is False


@pytest.mark.parametrize("fn", FUNCTIONS)
async def test_emit_functions_are_definer_rights_with_an_empty_search_path(fn):
    c = await _conn()
    try:
        assert await c.fetchval("SELECT to_regprocedure($1) IS NOT NULL", fn), f"{fn} absent"
        row = await c.fetchrow("SELECT prosecdef, proconfig FROM pg_proc WHERE oid = $1::regprocedure", fn)
    finally:
        await c.close()
    assert row["prosecdef"] is True
    assert row["proconfig"] and any(
        x.replace('"', "") in ("search_path=", "search_path=''") for x in row["proconfig"]
    ), row["proconfig"]


async def test_anon_select_on_webhook_endpoints_is_refused():
    """The ONE role switch in this file: anon against a table with NO policy, rolled back."""
    import asyncpg

    c = await _conn()
    try:
        assert await c.fetchval("SELECT to_regclass('public.webhook_endpoints') IS NOT NULL"), "absent"
        refused = False
        try:
            async with c.transaction():
                await c.execute("SET LOCAL ROLE anon")
                try:
                    await c.fetch("SELECT 1 FROM public.webhook_endpoints LIMIT 1")
                except asyncpg.InsufficientPrivilegeError:
                    refused = True
                raise _Rollback
        except _Rollback:
            pass
        assert refused, "anon could SELECT from public.webhook_endpoints"
    finally:
        await c.close()


# ── row behaviour, each inside one rolled-back transaction ─────────────────────────────────


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


async def _seed(c) -> dict:
    user_id = uuid4()
    await c.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", user_id, f"p308-01-{user_id.hex[:8]}@test.local")
    org_id = await c.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"p308-01-{uuid4().hex[:8]}")
    await c.execute("INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", org_id, user_id)
    thread = await c.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, '308 thread') RETURNING id",
        user_id, org_id,
    )
    definition = await c.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, '308 wf', $2, $3, 'published') RETURNING id",
        f"p308-{uuid4().hex[:8]}", user_id, org_id,
    )
    return {"user": user_id, "org": org_id, "thread": thread, "definition": definition}


async def _endpoint(c, w, *, url="https://hooks.example.com/in", events=("run.finished", "run.waiting", "document.ingested"),
                    secret=SECRET, description=None, enabled=True):
    return await c.fetchval(
        "INSERT INTO public.webhook_endpoints (user_id, org_id, url, description, event_types, secret_ciphertext, enabled)"
        " VALUES ($1, $2, $3, $4, $5::text[], $6, $7) RETURNING id",
        w["user"], w["org"], url, description, list(events), secret, enabled,
    )


async def _run(c, w, *, golden=False, status="active"):
    return await c.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, is_golden_run, inputs)"
        " VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb) RETURNING id",
        w["thread"], w["definition"], status, w["org"], w["user"], golden,
    )


async def _events(c, item) -> list[str]:
    return [r["type"] for r in await c.fetch(
        "SELECT type FROM public.webhook_events WHERE item_id = $1 ORDER BY created_at, id", item
    )]


@pytest.mark.parametrize(
    ("kwargs", "constraint"),
    [
        ({"secret": "whsec_plaintext"}, "secret_ciphertext"),
        ({"url": "http://hooks.example.com/in"}, "webhook_endpoints_url_check"),
        ({"url": "https://hooks.example.com/in#frag"}, "webhook_endpoints_url_check"),
        ({"url": "https://user:pw@hooks.example.com/in"}, "webhook_endpoints_url_check"),
        ({"url": "https://hooks.example.com/" + "a" * 2050}, "webhook_endpoints_url_check"),
        ({"events": ()}, "event_types"),
        ({"events": ("run.finished", "webhook.test")}, "event_types"),
        ({"description": "x" * 101}, "description"),
    ],
)
async def test_endpoint_checks_refuse(kwargs, constraint):
    import asyncpg

    async def body(c):
        w = await _seed(c)
        err = await _raises(c, asyncpg.CheckViolationError, lambda: _endpoint(c, w, **kwargs))
        assert err is not None and constraint in err, (kwargs, err)
        # the allowed shape still inserts
        assert await _endpoint(c, w)

    await _in_rollback(body)


async def test_a_webhook_notice_needs_its_endpoint_and_cascades_with_it():
    import asyncpg

    async def body(c):
        w = await _seed(c)
        err = await _raises(
            c, asyncpg.CheckViolationError,
            lambda: c.execute(
                "INSERT INTO public.notifications (recipient_id, org_id, kind) VALUES ($1, $2, 'webhook_disabled')",
                w["user"], w["org"],
            ),
        )
        assert err is not None and "notifications_kind_shape_check" in err, err
        ep = await _endpoint(c, w, enabled=False)
        await c.execute(
            "INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id)"
            " VALUES ($1, $2, 'webhook_disabled', $3)",
            w["user"], w["org"], ep,
        )
        dup = await _raises(
            c, asyncpg.UniqueViolationError,
            lambda: c.execute(
                "INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id)"
                " VALUES ($1, $2, 'webhook_disabled', $3)",
                w["user"], w["org"], ep,
            ),
        )
        assert dup is not None and "notifications_one_open_per_endpoint" in dup, dup
        await c.execute("DELETE FROM public.webhook_endpoints WHERE id = $1", ep)
        assert await c.fetchval("SELECT count(*) FROM public.notifications WHERE endpoint_id = $1", ep) == 0

    await _in_rollback(body)


async def test_one_run_finished_per_run_and_waiting_on_pause():
    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        await c.execute("UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1", run)
        await c.execute("UPDATE public.workflow_runs SET status = 'active' WHERE id = $1", run)
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", run)
        await c.execute("UPDATE public.workflow_runs SET status = 'failed' WHERE id = $1", run)
        await c.execute("UPDATE public.workflow_runs SET status = 'failed' WHERE id = $1", run)
        assert await _events(c, run) == ["run.waiting", "run.finished"]
        row = await c.fetchrow(
            "SELECT org_id, owner_id, status, definition_id FROM public.webhook_events"
            " WHERE item_id = $1 AND type = 'run.finished'", run,
        )
        assert (row["org_id"], row["owner_id"], row["status"], row["definition_id"]) == (
            w["org"], w["user"], "completed", w["definition"]
        )

    await _in_rollback(body)


async def test_golden_runs_and_unsubscribed_orgs_emit_nothing():
    async def body(c):
        w = await _seed(c)
        quiet = await _run(c, w)  # no endpoint yet
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", quiet)
        assert await _events(c, quiet) == []
        await _endpoint(c, w, events=("run.waiting",))  # subscribed to the other type only
        only_waiting = await _run(c, w)
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", only_waiting)
        assert await _events(c, only_waiting) == []
        await _endpoint(c, w)
        golden = await _run(c, w, golden=True)
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", golden)
        assert await _events(c, golden) == []

    await _in_rollback(body)


async def test_document_ingested_on_completion_and_on_a_completed_insert():
    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))

        async def doc(status):
            return await c.fetchval(
                "INSERT INTO public.documents (user_id, org_id, filename, mime_type, file_size, file_path, status)"
                " VALUES ($1, $2, $3, 'text/plain', 1, $4, $5) RETURNING id",
                w["user"], w["org"], f"308-{uuid4().hex[:6]}.txt", f"308/{uuid4()}", status,
            )

        d1 = await doc("pending")
        await c.execute("UPDATE public.documents SET status = 'processing' WHERE id = $1", d1)
        assert await _events(c, d1) == []
        await c.execute("UPDATE public.documents SET status = 'completed' WHERE id = $1", d1)
        assert await _events(c, d1) == ["document.ingested"]
        d2 = await doc("completed")
        assert await _events(c, d2) == ["document.ingested"]

    await _in_rollback(body)


async def test_a_second_delivery_for_one_endpoint_and_event_is_refused():
    import asyncpg

    async def body(c):
        w = await _seed(c)
        ep = await _endpoint(c, w)
        ev = await c.fetchval(
            "INSERT INTO public.webhook_events (type, org_id, endpoint_id) VALUES ('webhook.test', $1, $2) RETURNING id",
            w["org"], ep,
        )
        await c.execute("INSERT INTO public.webhook_deliveries (endpoint_id, event_id) VALUES ($1, $2)", ep, ev)
        err = await _raises(
            c, asyncpg.UniqueViolationError,
            lambda: c.execute("INSERT INTO public.webhook_deliveries (endpoint_id, event_id) VALUES ($1, $2)", ep, ev),
        )
        assert err is not None and "webhook_deliveries_endpoint_event_uq" in err, err

    await _in_rollback(body)


# ── the apply discipline ───────────────────────────────────────────────────────────────────


async def test_a_second_apply_succeeds():
    assert MIGRATION.exists(), "225 absent"
    c = await _conn()
    try:
        await c.execute(MIGRATION.read_text(encoding="utf-8"))
    finally:
        await c.close()


def test_check_script_says_225_live():
    proc = subprocess.run(
        [sys.executable, str(REPO / "scripts" / "check-migration-225-live.py")],
        capture_output=True, text=True, cwd=str(REPO), timeout=120,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "225 live" in proc.stdout
