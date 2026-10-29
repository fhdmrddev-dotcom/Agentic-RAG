"""Phase 301-01 (NOTE-01 / NOTE-05; D-15 / D-16 / D-27 / D-28 / T-301-02 / T-301-03 / T-301-08) — LIVE.

``app.db.notifications.LIST_OPEN_SQL`` — the one statement ``GET /notifications`` runs — driven against
the REAL local Postgres, over notices written by migration 218's REAL trigger path (a harness
``ask_user_prompt`` row in the run's own thread). No notice is ever inserted by hand.

Proven here:
  * the owner, a member of orgs A and B, sees the waiting run in EACH, waited-longest first, each
    named by its org and its workflow; an action-risk pause reads ``approval``;
  * another user sees none of the owner's notices; an org the owner has left drops out (T-301-03);
  * a notice left OPEN on a run that ended is not listed — the status wall (F10 / T-301-08);
  * ``origin`` carries the run's ``origin_kind`` (schedule / key);
  * ``total`` counts every open notice even when ``LIMIT`` cuts the rows;
  * ``public.notifications`` is in the ``supabase_realtime`` publication (migration 219, D-16).

Every case runs inside ONE transaction that is ALWAYS rolled back. Skip-guarded on :54322 AND on 218
being applied; run with ``-rs`` — a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import asyncio
import importlib
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest

from tests.integration._rls_harness import PG_AVAILABLE, PG_TEST_DSN, requires_pg


def _migration_218_applied() -> bool:
    if not PG_AVAILABLE:
        return False

    async def _probe() -> bool:
        import asyncpg

        conn = await asyncpg.connect(PG_TEST_DSN)
        try:
            return bool(
                await conn.fetchval(
                    "SELECT to_regclass('public.notifications') IS NOT NULL"
                    " AND to_regprocedure('public.notify_on_ask_row()') IS NOT NULL"
                    " AND to_regprocedure('public.notify_on_run_status()') IS NOT NULL"
                )
            )
        finally:
            await conn.close()

    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_probe())
        finally:
            loop.close()
    except Exception:
        return False


requires_218 = pytest.mark.skipif(
    not _migration_218_applied(),
    reason="migration 218 not applied to the local database (public.notifications / triggers absent)",
)

pytestmark = [requires_pg, requires_218]


def _list_sql() -> str:
    # Resolved inside each test so a missing constant fails RED per test, not at collection.
    return importlib.import_module("app.db.notifications").LIST_OPEN_SQL


# ── builders ─────────────────────────────────────────────────────────────────────


@dataclass
class World:
    conn: object
    owner: UUID
    other: UUID
    org_a: UUID
    org_b: UUID
    org_a_name: str
    org_b_name: str
    thread_a: UUID
    thread_b: UUID
    def_a: UUID
    def_b: UUID


async def _user(conn, label: str) -> UUID:
    uid = uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"301-{label}-{uid}@test.local"
    )
    return uid


async def _org(conn, name: str) -> UUID:
    return await conn.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", name)


async def _member(conn, org: UUID, uid: UUID, role: str = "member") -> None:
    await conn.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        org, uid, role,
    )


async def _thread(conn, owner: UUID, org: UUID, title: str) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
        owner, org, title,
    )


async def _definition(conn, owner: UUID, org: UUID, name: str) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, $2, $3, $4, 'published') RETURNING id",
        f"301-pub-{uuid4().hex[:8]}", name, owner, org,
    )


async def _run(conn, *, thread: UUID, definition: UUID, org: UUID, user: UUID,
               status: str = "active", origin_kind: str | None = None) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, origin_kind)"
        " VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        thread, definition, status, org, user, origin_kind,
    )


async def _prompt(conn, *, thread: UUID, user: UUID, org: UUID, run_id: UUID, tcid: str,
                  engine_kind: str | None = None) -> None:
    """A harness ask_user_prompt row in the run's own thread — 218's trigger writes the notice."""
    tool_call: dict = {
        "kind": "ask_user_prompt",
        "tool_call_id": tcid,
        "prompt": "Which client is this for?",
        "options": [],
        "timeout_seconds": None,
        "run_id": str(run_id),
    }
    if engine_kind is not None:
        tool_call["engine_pause"] = {"kind": engine_kind, "phase": "p1", "continue_allowed": True,
                                     "locked": False, "folders": []}
    await conn.execute(
        "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
        " VALUES ($1, $2, 'system', $3, 'harness', $4, $5::jsonb)",
        thread, user, tool_call["prompt"], org, json.dumps([tool_call]),
    )


async def _wait_in(w: World, which: str, tcid: str, **kw) -> UUID:
    """An open waiting run for the owner in org A or B, its notice written by the real trigger."""
    thread, definition, org = (
        (w.thread_a, w.def_a, w.org_a) if which == "a" else (w.thread_b, w.def_b, w.org_b)
    )
    engine_kind = kw.pop("engine_kind", None)
    run = await _run(w.conn, thread=thread, definition=definition, org=org, user=w.owner, **kw)
    await _prompt(w.conn, thread=thread, user=w.owner, org=org, run_id=run, tcid=tcid,
                  engine_kind=engine_kind)
    n = await w.conn.fetchval(
        "SELECT count(*) FROM public.notifications WHERE run_id = $1 AND closed_at IS NULL", run
    )
    assert n == 1, "non-vacuity: 218's trigger must have written the open notice"
    return run


async def _age(conn, run: UUID, minutes: int) -> None:
    """now() is fixed inside one transaction — shift a notice so 'waited longest' is not a tie."""
    await conn.execute(
        "UPDATE public.notifications SET created_at = created_at - make_interval(mins => $2)"
        " WHERE run_id = $1",
        run, minutes,
    )


@asynccontextmanager
async def _world():
    """Owner in orgs A + B, `other` in B only; a thread + published definition per org. ROLLED BACK."""
    import asyncpg

    conn = await asyncpg.connect(PG_TEST_DSN)
    tx = conn.transaction()
    await tx.start()
    try:
        owner = await _user(conn, "owner")
        other = await _user(conn, "other")
        a_name, b_name = f"301 Org A {uuid4().hex[:6]}", f"301 Org B {uuid4().hex[:6]}"
        org_a = await _org(conn, a_name)
        org_b = await _org(conn, b_name)
        await _member(conn, org_a, owner)
        await _member(conn, org_b, owner)
        await _member(conn, org_b, other)
        w = World(
            conn, owner, other, org_a, org_b, a_name, b_name,
            thread_a=await _thread(conn, owner, org_a, "301 thread A"),
            thread_b=await _thread(conn, owner, org_b, "301 thread B"),
            def_a=await _definition(conn, owner, org_a, "Compliance Gap Report"),
            def_b=await _definition(conn, owner, org_b, "Vendor Check"),
        )
        yield w
    finally:
        await tx.rollback()  # ALWAYS rolled back — nothing here outlives the test
        await conn.close()


async def _list(w: World, uid: UUID, limit: int = 50) -> list:
    return await w.conn.fetch(_list_sql(), uid, limit)


# ── NOTE-01: every member org, named ─────────────────────────────────────────────


async def test_the_owner_sees_the_waiting_run_in_each_org_waited_longest_first():
    async with _world() as w:
        run_a = await _wait_in(w, "a", "tc-a")
        run_b = await _wait_in(w, "b", "tc-b")
        await _age(w.conn, run_b, 10)  # B has waited longer
        rows = await _list(w, w.owner)
        assert [r["run_id"] for r in rows] == [run_b, run_a]
        b, a = rows
        assert (b["org_id"], b["org_name"], b["workflow_name"], b["kind"]) == (
            w.org_b, w.org_b_name, "Vendor Check", "question",
        )
        assert (a["org_id"], a["org_name"], a["workflow_name"], a["kind"]) == (
            w.org_a, w.org_a_name, "Compliance Gap Report", "question",
        )
        assert all(r["total"] == 2 for r in rows)
        assert set(rows[0].keys()) >= {
            "id", "run_id", "org_id", "org_name", "workflow_name", "kind", "origin", "created_at", "total",
        }


async def test_an_action_risk_pause_reads_approval():
    async with _world() as w:
        run = await _wait_in(w, "a", "tc-risk", engine_kind="action_risk")
        (row,) = await _list(w, w.owner)
        assert row["run_id"] == run and row["kind"] == "approval"


# ── the walls (T-301-02 / T-301-03 / T-301-08) ───────────────────────────────────


async def test_another_user_sees_none_of_the_owners_notices():
    async with _world() as w:
        await _wait_in(w, "a", "tc-a")
        await _wait_in(w, "b", "tc-b")  # `other` is a member of B — membership alone is not enough
        assert await _list(w, w.other) == []
        assert len(await _list(w, w.owner)) == 2  # non-vacuity


async def test_an_org_the_owner_has_left_drops_out():
    async with _world() as w:
        run_a = await _wait_in(w, "a", "tc-a")
        await _wait_in(w, "b", "tc-b")
        assert len(await _list(w, w.owner)) == 2  # non-vacuity
        await w.conn.execute(
            "DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", w.org_b, w.owner
        )
        rows = await _list(w, w.owner)
        assert [r["run_id"] for r in rows] == [run_a]
        assert rows[0]["total"] == 1


async def test_a_notice_left_open_on_an_ended_run_is_not_listed():
    """F10: 218's close is fail-soft. Simulate a swallowed close — the run completed, its notice is
    still open — and the status wall alone must keep it off the list."""
    async with _world() as w:
        run_a = await _wait_in(w, "a", "tc-a")
        run_b = await _wait_in(w, "b", "tc-b")
        await w.conn.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", run_a)
        await w.conn.execute(
            "UPDATE public.notifications SET closed_at = NULL, closed_reason = NULL WHERE run_id = $1", run_a
        )
        still_open = await w.conn.fetchval(
            "SELECT count(*) FROM public.notifications WHERE run_id = $1 AND closed_at IS NULL", run_a
        )
        assert still_open == 1, "non-vacuity: the ended run's notice must really be open"
        rows = await _list(w, w.owner)
        assert [r["run_id"] for r in rows] == [run_b]


# ── D-28 origin, D-10 total ──────────────────────────────────────────────────────


@pytest.mark.parametrize("origin_kind", ["schedule", "key"])
async def test_origin_carries_the_runs_origin_kind(origin_kind):
    async with _world() as w:
        run = await _wait_in(w, "a", f"tc-{origin_kind}", origin_kind=origin_kind)
        (row,) = await _list(w, w.owner)
        assert row["run_id"] == run and row["origin"] == origin_kind


async def test_total_counts_every_open_notice_when_the_limit_cuts_the_rows():
    async with _world() as w:
        await _wait_in(w, "a", "tc-a")
        await _wait_in(w, "b", "tc-b")
        rows = await _list(w, w.owner, limit=1)
        assert len(rows) == 1 and rows[0]["total"] == 2


# ── D-16: the Realtime hint channel (migration 219) ──────────────────────────────


async def test_notifications_is_in_the_realtime_publication():
    async with _world() as w:
        n = await w.conn.fetchval(
            "SELECT count(*) FROM pg_publication_tables"
            " WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'"
        )
        assert n == 1
