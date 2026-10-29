"""Phase 300-02 (D-01 / D-04 / D-18 / D-26 / T-300-08 / T-300-11..14) — the notice triggers, LIVE.

Migration 218's two trigger functions are driven against the REAL local Postgres:

* ``public.notify_on_ask_row()`` (AFTER INSERT ON public.messages) writes ONE open notice per
  recipient and run — recipient and org read from ``public.workflow_runs``, never from the message —
  plus ONE pending delivery due at ``created_at + app_settings.notification_email_delay_seconds``;
  an ``ask_user_response`` with the same ``tool_call_id`` closes it.
* ``public.notify_on_run_status()`` (AFTER UPDATE OF status ON public.workflow_runs) closes every open
  notice of a run that ended, and follows a schedule recorded ``'waiting'`` to the run's terminal
  status (D-26, the contract with 300-01).

Every case runs inside ONE transaction that is ALWAYS rolled back — nothing outlives a test, and no
statement here ever commits. Skip-guarded on :54322 AND on 218 being applied; run with ``-rs`` — a
skip is a SKIP, never a pass.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from tests.integration._rls_harness import PG_AVAILABLE, PG_TEST_DSN, requires_pg

ASK_FN = "public.notify_on_ask_row()"
STATUS_FN = "public.notify_on_run_status()"


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
                    " AND to_regclass('public.notification_deliveries') IS NOT NULL"
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
    reason="migration 218 not applied to the local database (public.notifications / "
    "public.notification_deliveries / notify_on_ask_row() / notify_on_run_status() absent)",
)

pytestmark = [requires_pg, requires_218]


# ── row builders (the test_299_links_live shapes) ────────────────────────────────


@dataclass
class World:
    conn: object
    owner: UUID
    other: UUID
    org_a: UUID
    org_b: UUID
    thread: UUID
    definition: UUID
    run: UUID


async def _user(conn, label: str) -> UUID:
    uid = uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"300-{label}-{uid}@test.local"
    )
    return uid


async def _org(conn, name: str) -> UUID:
    return await conn.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", name)


async def _member(conn, org: UUID, uid: UUID, role: str = "member") -> None:
    await conn.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        org, uid, role,
    )


async def _run(
    conn,
    w: "World | None" = None,
    *,
    thread: UUID | None = None,
    definition: UUID | None = None,
    org: UUID | None = None,
    user: UUID | None | str = "owner",
    status: str = "active",
    golden: bool = False,
    inputs: dict | None = None,
    age_minutes: int = 0,
) -> UUID:
    if w is not None:
        thread = thread or w.thread
        definition = definition or w.definition
        org = org or w.org_a
        if user == "owner":
            user = w.owner
    return await conn.fetchval(
        "INSERT INTO public.workflow_runs"
        " (thread_id, definition_id, status, org_id, user_id, is_golden_run, inputs, created_at)"
        " VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now() - make_interval(mins => $8)) RETURNING id",
        thread, definition, status, org, user, golden, json.dumps(inputs or {}), age_minutes,
    )


async def _prompt(
    conn,
    w: World,
    run_id: object,
    tcid: str,
    *,
    origin: str = "harness",
    engine_kind: str | None = None,
    msg_org: UUID | None = None,
) -> UUID:
    """A harness ask_user_prompt row, shaped exactly as engine_ask.py / human_input.py write it."""
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
    return await conn.fetchval(
        "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
        " VALUES ($1, $2, 'system', $3, $4, $5, $6::jsonb) RETURNING id",
        w.thread, w.owner, tool_call["prompt"], origin, msg_org or w.org_a, json.dumps([tool_call]),
    )


async def _response(conn, w: World, tcid: str, *, expired: bool = False, origin: str = "harness") -> UUID:
    """An ask_user_response row — the answer route's shape, or the engine's expiry shape."""
    tool_call: dict = {"kind": "ask_user_response", "tool_call_id": tcid}
    if expired:
        tool_call.update({"expired": True, "response_text": None})
    else:
        tool_call.update({"response_text": "Acme", "choice_index": None, "folder_id": None})
    return await conn.fetchval(
        "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
        " VALUES ($1, $2, 'system', $3, $4, $5, $6::jsonb) RETURNING id",
        w.thread, w.owner, "" if expired else "Acme", origin, w.org_a, json.dumps([tool_call]),
    )


async def _notices(conn, run_id: UUID) -> list:
    return await conn.fetch(
        "SELECT id, recipient_id, org_id, run_id, kind, tool_call_id, created_at, closed_at, closed_reason"
        " FROM public.notifications WHERE run_id = $1 ORDER BY created_at, id",
        run_id,
    )


async def _deliveries(conn, notice_id: UUID) -> list:
    return await conn.fetch(
        "SELECT id, status, due_at, attempts, channel FROM public.notification_deliveries"
        " WHERE notification_id = $1",
        notice_id,
    )


async def _delay(conn) -> int:
    return await conn.fetchval(
        "SELECT coalesce(notification_email_delay_seconds, 120) FROM public.app_settings LIMIT 1"
    )


@asynccontextmanager
async def _world():
    """Seed two users / two orgs / a thread / a published definition / an active run, then ROLL BACK."""
    import asyncpg

    conn = await asyncpg.connect(PG_TEST_DSN)
    tx = conn.transaction()
    await tx.start()
    try:
        owner = await _user(conn, "owner")
        other = await _user(conn, "other")
        org_a = await _org(conn, f"300 Org A {uuid4().hex[:6]}")
        org_b = await _org(conn, f"300 Org B {uuid4().hex[:6]}")
        await _member(conn, org_a, owner)
        await _member(conn, org_b, owner)
        await _member(conn, org_b, other)
        thread = await conn.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
            owner, org_a, "300 thread",
        )
        definition = await conn.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
            " VALUES ($1, $2, $3, $4, 'published') RETURNING id",
            f"300-pub-{uuid4().hex[:8]}", "Compliance Gap Report", owner, org_a,
        )
        w = World(conn, owner, other, org_a, org_b, thread, definition, run=uuid4())
        w.run = await _run(conn, w)
        yield w
    finally:
        await tx.rollback()  # ALWAYS rolled back — nothing here outlives the test
        await conn.close()


def _close_to(actual, expected, seconds: float = 5.0) -> bool:
    return abs((actual - expected).total_seconds()) <= seconds


# ── the notice is written (D-18 / D-04) ──────────────────────────────────────────


async def test_a_harness_prompt_writes_one_notice_and_one_pending_delivery():
    async with _world() as w:
        c = w.conn
        # T-300-11: the message names a DIFFERENT org than the run — the notice must follow the run.
        msg = await _prompt(c, w, w.run, "tc-1", msg_org=w.org_b)
        assert await c.fetchval("SELECT org_id FROM public.messages WHERE id = $1", msg) == w.org_b, (
            "non-vacuity: the message row must really carry the other org"
        )
        rows = await _notices(c, w.run)
        assert len(rows) == 1, rows
        n = rows[0]
        assert n["recipient_id"] == w.owner
        assert n["org_id"] == w.org_a, "D-18: the notice org is workflow_runs.org_id, never messages.org_id"
        assert n["kind"] == "question"
        assert n["tool_call_id"] == "tc-1"
        assert n["closed_at"] is None and n["closed_reason"] is None
        ds = await _deliveries(c, n["id"])
        assert len(ds) == 1, ds
        d = ds[0]
        assert d["status"] == "pending" and d["attempts"] == 0 and d["channel"] == "email"
        assert _close_to(d["due_at"], n["created_at"] + timedelta(seconds=await _delay(c)))


async def test_an_action_risk_pause_is_an_approval():
    async with _world() as w:
        await _prompt(w.conn, w, w.run, "tc-risk", engine_kind="action_risk")
        rows = await _notices(w.conn, w.run)
        assert [r["kind"] for r in rows] == ["approval"]


async def test_another_engine_pause_kind_is_a_question():
    async with _world() as w:
        await _prompt(w.conn, w, w.run, "tc-grounding", engine_kind="grounding")
        assert [r["kind"] for r in await _notices(w.conn, w.run)] == ["question"]


async def test_a_prompt_on_a_paused_run_writes_a_notice():
    async with _world() as w:
        paused = await _run(w.conn, w, status="paused")
        await _prompt(w.conn, w, paused, "tc-paused")
        assert len(await _notices(w.conn, paused)) == 1


# ── the excluded pause kinds write nothing (T-300-14) ────────────────────────────


async def test_a_chat_ask_user_writes_no_notice():
    async with _world() as w:
        c = w.conn
        # A chat ask_user carries origin 'deep' — even naming a REAL workflow run id it writes nothing.
        msg = await _prompt(c, w, w.run, "tc-chat", origin="deep")
        assert msg is not None
        assert await _notices(c, w.run) == []
        # And a chat run id (a runs.id, never a workflow_runs.id) finds no run: nothing written.
        chat_run = uuid4()
        await _prompt(c, w, chat_run, "tc-chat-2")
        assert await c.fetchval("SELECT count(*) FROM public.notifications WHERE run_id = $1", chat_run) == 0


async def test_a_golden_run_writes_no_notice():
    async with _world() as w:
        golden = await _run(w.conn, w, golden=True)
        await _prompt(w.conn, w, golden, "tc-golden")
        assert await _notices(w.conn, golden) == []


async def test_a_run_with_no_owner_writes_no_notice():
    async with _world() as w:
        ownerless = await _run(w.conn, w, user=None)
        await _prompt(w.conn, w, ownerless, "tc-ownerless")
        assert await _notices(w.conn, ownerless) == []


@pytest.mark.parametrize("status", ["completed", "failed", "cancelled", "cap_paused"])
async def test_a_run_that_is_not_waiting_writes_no_notice(status):
    async with _world() as w:
        run = await _run(w.conn, w, status=status)
        await _prompt(w.conn, w, run, f"tc-{status}")
        assert await _notices(w.conn, run) == []


async def test_a_prompt_outside_the_runs_thread_writes_no_notice():
    """300-SECURITY UF-1: the messages INSERT policy checks user_id + org only, so a signed-in user
    who knows another user's workflow-run id could write a harness prompt row in THEIR OWN thread
    naming that run, and the SECURITY DEFINER trigger wrote (or re-pointed) the victim's notice and
    its email. The engine and human_input write prompts into the run's own thread, so the write is
    now scoped to it."""
    async with _world() as w:
        c = w.conn
        foreign_thread = await c.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, 'foreign') RETURNING id",
            w.other, w.org_b,
        )
        tool_call = {"kind": "ask_user_prompt", "tool_call_id": "tc-forged", "prompt": "x",
                     "options": [], "timeout_seconds": None, "run_id": str(w.run)}
        await c.execute(
            "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
            " VALUES ($1, $2, 'system', 'x', 'harness', $3, $4::jsonb)",
            foreign_thread, w.other, w.org_b, json.dumps([tool_call]),
        )
        assert await _notices(c, w.run) == [], "a prompt in another thread wrote the run owner's notice"
        # non-vacuity: the same prompt in the run's own thread writes it
        await _prompt(c, w, w.run, "tc-own")
        assert [n["tool_call_id"] for n in await _notices(c, w.run)] == ["tc-own"]
        # and a forged prompt cannot re-point an OPEN notice either
        await c.execute(
            "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
            " VALUES ($1, $2, 'system', 'x', 'harness', $3, $4::jsonb)",
            foreign_thread, w.other, w.org_b, json.dumps([tool_call]),
        )
        assert [n["tool_call_id"] for n in await _notices(c, w.run)] == ["tc-own"]


async def test_a_malformed_run_id_writes_nothing_and_the_message_lands():
    async with _world() as w:
        c = w.conn
        msg = await _prompt(c, w, "not-a-uuid'; DROP TABLE x; --", "tc-bad")
        assert await c.fetchval("SELECT count(*) FROM public.messages WHERE id = $1", msg) == 1
        assert await c.fetchval(
            "SELECT count(*) FROM public.notifications WHERE tool_call_id = 'tc-bad'"
        ) == 0


# ── closing (answered / run_ended) ───────────────────────────────────────────────


async def test_an_answer_closes_the_notice_as_answered():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-a")
        await _response(c, w, "tc-a")
        (n,) = await _notices(c, w.run)
        assert n["closed_at"] is not None and n["closed_reason"] == "answered"


async def test_an_answer_for_another_question_leaves_the_notice_open():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-open")
        await _response(c, w, "tc-somebody-else")
        (n,) = await _notices(c, w.run)
        assert n["closed_at"] is None


@pytest.mark.parametrize("origin", ["deep", "harness"])
async def test_another_users_answer_in_their_own_thread_cannot_close_the_notice(origin):
    """300-REVIEW WR-04: the close ran SECURITY DEFINER on the client-supplied tool_call_id alone.
    The answer route checks the id only on the harness branch, so a deep-origin answer row with
    another user's prompt id — written in the answerer's OWN thread — closed that user's notice
    (their email became skipped_answered). The close is now scoped to the answer's thread."""
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-victim")
        foreign_thread = await c.fetchval(
            "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, 'foreign') RETURNING id",
            w.other, w.org_b,
        )
        await _run(c, w, thread=foreign_thread, org=w.org_b, user=w.other)
        tool_call = {"kind": "ask_user_response", "tool_call_id": "tc-victim", "response_text": "x",
                     "choice_index": None, "folder_id": None}
        await c.execute(
            "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
            " VALUES ($1, $2, 'system', 'x', $3, $4, $5::jsonb)",
            foreign_thread, w.other, origin, w.org_b, json.dumps([tool_call]),
        )
        (n,) = await _notices(c, w.run)
        assert n["closed_at"] is None and n["closed_reason"] is None, "a foreign answer closed the notice"
        # non-vacuity: the owner's own answer, in the run's thread, still closes it
        await _response(c, w, "tc-victim")
        (n,) = await _notices(c, w.run)
        assert n["closed_reason"] == "answered"


async def test_an_expiry_row_in_the_runs_thread_still_closes_the_notice():
    """WR-04 non-regression: the engine's expiry row is written in the run's own thread."""
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-exp2")
        await _response(c, w, "tc-exp2", expired=True)
        (n,) = await _notices(c, w.run)
        assert n["closed_reason"] == "run_ended"


async def test_an_expired_response_closes_the_notice_as_run_ended():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-exp")
        await _response(c, w, "tc-exp", expired=True)
        (n,) = await _notices(c, w.run)
        assert n["closed_reason"] == "run_ended"


@pytest.mark.parametrize("terminal", ["completed", "failed", "cancelled"])
async def test_a_run_ending_closes_every_open_notice_of_that_run(terminal):
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-end")
        bystander = await _run(c, w)
        await _prompt(c, w, bystander, "tc-bystander")
        await c.execute("UPDATE public.workflow_runs SET status = $2 WHERE id = $1", w.run, terminal)
        (n,) = await _notices(c, w.run)
        assert n["closed_reason"] == "run_ended" and n["closed_at"] is not None
        (b,) = await _notices(c, bystander)
        assert b["closed_at"] is None, "another run's notice is not closed"


async def test_a_non_terminal_status_change_closes_nothing():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-pause")
        await c.execute("UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1", w.run)
        (n,) = await _notices(c, w.run)
        assert n["closed_at"] is None


# ── one notice per wait (D-01) ───────────────────────────────────────────────────


async def test_a_re_ask_keeps_one_open_notice_and_a_later_wait_is_a_new_one():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-first")
        (first,) = await _notices(c, w.run)
        # Shift the stored created_at so "unchanged" below is not vacuous inside one transaction.
        shifted = await c.fetchval(
            "UPDATE public.notifications SET created_at = created_at - interval '1 minute'"
            " WHERE id = $1 RETURNING created_at",
            first["id"],
        )

        await _prompt(c, w, w.run, "tc-second")  # re-ask while the first wait is open
        rows = await _notices(c, w.run)
        assert len(rows) == 1, "a re-ask while a notice is open keeps ONE open notice"
        assert rows[0]["id"] == first["id"]
        assert rows[0]["tool_call_id"] == "tc-second"
        assert rows[0]["created_at"] == shifted, "the wait's start is kept"
        assert len(await _deliveries(c, first["id"])) == 1, "still one delivery"

        await _response(c, w, "tc-second")
        await _prompt(c, w, w.run, "tc-third")  # a NEW wait after the previous closed
        rows = await _notices(c, w.run)
        assert len(rows) == 2, rows
        closed, fresh = rows
        assert closed["closed_reason"] == "answered"
        assert fresh["closed_at"] is None and fresh["tool_call_id"] == "tc-third"
        assert len(await _deliveries(c, fresh["id"])) == 1
        total = await c.fetchval(
            "SELECT count(*) FROM public.notification_deliveries d"
            " JOIN public.notifications n ON n.id = d.notification_id WHERE n.run_id = $1",
            w.run,
        )
        assert total == 2


# ── fail-soft (T-300-08) ─────────────────────────────────────────────────────────


async def test_a_failing_notice_write_never_fails_the_message_insert():
    async with _world() as w:
        c = w.conn
        await c.execute(
            "ALTER TABLE public.notifications ADD CONSTRAINT t300_block CHECK (false) NOT VALID"
        )
        msg = await _prompt(c, w, w.run, "tc-blocked")
        assert await c.fetchval("SELECT count(*) FROM public.messages WHERE id = $1", msg) == 1
        assert await _notices(c, w.run) == []


async def test_a_failing_close_never_fails_the_status_update():
    async with _world() as w:
        c = w.conn
        await _prompt(c, w, w.run, "tc-close-blocked")
        await c.execute(
            "ALTER TABLE public.notifications ADD CONSTRAINT t300_block_close"
            " CHECK (closed_at IS NULL) NOT VALID"
        )
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", w.run)
        assert await c.fetchval("SELECT status FROM public.workflow_runs WHERE id = $1", w.run) == "completed"
        (n,) = await _notices(c, w.run)
        assert n["closed_at"] is None, "the close was swallowed, the run update stood"


# ── the delay knob (D-07) ────────────────────────────────────────────────────────


async def test_the_delivery_is_due_after_the_app_settings_delay():
    async with _world() as w:
        c = w.conn
        await c.execute("UPDATE public.app_settings SET notification_email_delay_seconds = 300")
        await _prompt(c, w, w.run, "tc-delay")
        (n,) = await _notices(c, w.run)
        (d,) = await _deliveries(c, n["id"])
        assert _close_to(d["due_at"], n["created_at"] + timedelta(seconds=300))


async def test_the_delay_is_bounded_by_a_check():
    import asyncpg

    async with _world() as w:
        for bad in (59, 3601):
            with pytest.raises(asyncpg.CheckViolationError):
                async with w.conn.transaction():  # a savepoint, rolled back by the raise
                    await w.conn.execute(
                        "UPDATE public.app_settings SET notification_email_delay_seconds = $1", bad
                    )


# ── the schedule follow-up (D-26, the contract with 300-01) ─────────────────────


async def _schedule(conn, w: World, last_status: str | None) -> UUID:
    return await conn.fetchval(
        "INSERT INTO public.workflow_schedules (org_id, workflow_id, user_id, name, interval_seconds, last_status)"
        " VALUES ($1, $2, $3, $4, 3600, $5) RETURNING id",
        w.org_a, w.definition, w.owner, "300 nightly", last_status,
    )


async def _schedule_status(conn, sid: UUID) -> str | None:
    return await conn.fetchval("SELECT last_status FROM public.workflow_schedules WHERE id = $1", sid)


@pytest.mark.parametrize("terminal", ["completed", "failed", "cancelled"])
async def test_a_waiting_schedule_takes_its_runs_terminal_status(terminal):
    async with _world() as w:
        c = w.conn
        sid = await _schedule(c, w, "waiting")
        run = await _run(c, w, inputs={"_schedule_id": str(sid)}, status="paused")
        await c.execute("UPDATE public.workflow_runs SET status = $2 WHERE id = $1", run, terminal)
        assert await _schedule_status(c, sid) == terminal


async def test_a_newer_run_of_the_schedule_leaves_the_schedule_alone():
    async with _world() as w:
        c = w.conn
        sid = await _schedule(c, w, "waiting")
        older = await _run(c, w, inputs={"_schedule_id": str(sid)}, status="paused", age_minutes=10)
        await _run(c, w, inputs={"_schedule_id": str(sid)}, status="paused")
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", older)
        assert await _schedule_status(c, sid) == "waiting"


@pytest.mark.parametrize("recorded", ["completed", "launch_failed", None])
async def test_a_schedule_not_recorded_waiting_is_left_alone(recorded):
    async with _world() as w:
        c = w.conn
        sid = await _schedule(c, w, recorded)
        run = await _run(c, w, inputs={"_schedule_id": str(sid)}, status="paused")
        await c.execute("UPDATE public.workflow_runs SET status = 'failed' WHERE id = $1", run)
        assert await _schedule_status(c, sid) == recorded


async def test_a_malformed_schedule_id_is_ignored_and_the_run_still_ends():
    async with _world() as w:
        c = w.conn
        run = await _run(c, w, inputs={"_schedule_id": "nope"}, status="paused")
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", run)
        assert await c.fetchval("SELECT status FROM public.workflow_runs WHERE id = $1", run) == "completed"


async def test_the_functions_are_the_ones_the_triggers_name():
    async with _world() as w:
        rows = await w.conn.fetch(
            "SELECT t.tgname, p.oid::regprocedure::text AS fn FROM pg_trigger t"
            " JOIN pg_proc p ON p.oid = t.tgfoid"
            " WHERE t.tgname IN ('messages_notify_on_ask', 'workflow_runs_notify_on_status')"
            " ORDER BY t.tgname"
        )
        assert [(r["tgname"], r["fn"]) for r in rows] == [
            ("messages_notify_on_ask", "notify_on_ask_row()"),
            ("workflow_runs_notify_on_status", "notify_on_run_status()"),
        ]
