"""Phase 244 plan 03 Task 1 (SHELL-02 / BUG-260904-05) — the server half of the cap-pause fix.

WHAT THIS FILE DEFENDS
----------------------
``GET /threads/{id}/workflow``'s Deep-run ``cap_paused`` probe is **bounded to the thread's
LATEST run row**. Before this plan it read::

    SELECT run_id, status, continues_used
    FROM runs
    WHERE thread_id = $1 AND status = 'cap_paused'      -- ⛔ filters BEFORE it orders
    ORDER BY started_at DESC
    LIMIT 1

⛔ **THAT READER IS UNBOUNDED IN TIME, and the consequence is the whole defect.** Nothing on
``POST /threads/{id}/messages`` refuses a cap-paused thread, and nothing there clears the old
row: the route mints a NEW ``runs`` row (``run_id = uuid4()`` → ``register_run_start``) and
writes nothing to the previous one. The only writer that clears ``status='cap_paused'``
anywhere in the backend is ``continue_run`` (``backend/app/api/runs.py:1082-1086``). So the
stale paused row survives every subsequent message, this endpoint keeps answering
``cap_paused: true``, and ``ChatArea.tsx:184`` re-applies the composer lock on **every**
reconcile — forever, on that thread. Unlocking the composer in the client alone would have
shipped the same defect one level down: type, send, reload, locked again.

THE RULING (C-2, arm **b** — bound the READ):
  · ``(b) bound the read`` — taken. One query, pure read, no new writer. The lock clears the
    instant a newer run row exists, which is exactly the semantics the operator experiences.
  · ``(a) retire the row server-side when a new run starts`` — **rejected, and not on
    difficulty**. It would add a SECOND writer of ``runs.status`` beside ``continue_run``.
    Two writers of one status column is how ``runs:active`` and ``runs.status`` drift apart —
    the failure Phase 145 / D-149-09 made one atomic co-write to prevent.

⚠ **WHAT THE BOUND MUST NOT COST**, fenced below rather than assumed:
  · ``continues_used`` and ``latest_producer_run_id`` still come off the paused row when the
    pause is real (case 7) — the bound must not strand the Continue affordance without data;
  · ``continue_run`` still resolves an OLDER paused row **by ``run_id``** (case 8), so a run
    that scrolled out of "latest" is still continuable. The read bound and the resume path
    are independent by construction, and this case is what keeps them that way.

⚠ **WHAT THIS FILE DOES NOT CLOSE.** ``D-244-09`` binds: *"drive it; do not reason about it."*
A stubbed unit test is not that drive. Whether posting a message at a cap-pause actually
starts a run **and survives a reload** is a ``244-VALIDATION.md`` row in a real browser
(ROADMAP criterion 2). This file proves the QUERY's semantics; it claims nothing about the
live round trip.

UNIT-ONLY BY CONSTRUCTION — **no local Supabase, no DB mutation, not one live row**.
CLAUDE.md's worktree rule 4 requires a DB-mutating suite to serialize; this plan runs in
parallel with ``244-04`` precisely because every read below is answered by an in-process fake
that implements the two queries' semantics over an in-memory ``runs`` table.

⚠ WHY A SEMANTIC FAKE AND NOT ``mock_asyncpg_pool.set_fetchrow_results``
-----------------------------------------------------------------------
The conftest pool answers ``fetchrow`` from a QUEUE and ignores the SQL entirely. Against
such a mock the shipped query and the fixed query receive the *same* canned row, so case 6
would pass under both and prove nothing — a fence that cannot fail. The fake below answers
from one table with real ``WHERE``/``ORDER BY`` semantics, so the two queries genuinely
disagree and case 6 is RED before the fix and GREEN after. Falsifiability is the point.
"""

from __future__ import annotations

import inspect
import re
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest


_T0 = datetime(2026, 9, 11, 9, 0, 0, tzinfo=timezone.utc)
_T1 = datetime(2026, 9, 11, 9, 5, 0, tzinfo=timezone.utc)


class _FakeConn:
    """An asyncpg connection stand-in that ANSWERS THE SQL rather than a queue.

    It models exactly the two tables this endpoint reads on a pure-Deep thread:
    ``runs`` (seeded per test) and ``workflow_runs`` (always empty — a Deep thread has
    never had one). ``SET LOCAL`` / ``set_config`` statements from
    ``_apply_rls_user_context`` are accepted and recorded; they are the RLS context, not a
    read.
    """

    def __init__(self, runs: list[dict]):
        self.runs = runs
        self.sql: list[str] = []
        self.args: list[tuple] = []

    def transaction(self):
        return _FakeTxn()

    async def execute(self, sql, *args):
        self.sql.append(sql)
        self.args.append(args)
        return "SET"

    async def fetchrow(self, sql, *args):
        self.sql.append(sql)
        self.args.append(args)
        flat = " ".join(sql.split())
        if "FROM workflow_runs" in flat or "workflow_runs WHERE" in flat:
            return None
        if "FROM runs" not in flat:
            return None
        rows = list(self.runs)
        # Honour a status predicate when the query carries one — this is the ONE
        # behaviour that separates the shipped query from the bounded one.
        if "status = 'cap_paused'" in flat:
            rows = [r for r in rows if r["status"] == "cap_paused"]
        rows.sort(key=lambda r: r["started_at"], reverse=True)  # ORDER BY started_at DESC
        return rows[0] if rows else None                        # LIMIT 1

    async def fetch(self, sql, *args):
        self.sql.append(sql)
        self.args.append(args)
        return []

    async def fetchval(self, sql, *args):
        self.sql.append(sql)
        self.args.append(args)
        return None


class _FakeTxn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeAcquire:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        return _FakeAcquire(self._conn)

    async def fetchrow(self, sql, *args):
        return await self._conn.fetchrow(sql, *args)

    async def fetch(self, sql, *args):
        return await self._conn.fetch(sql, *args)

    async def execute(self, sql, *args):
        return await self._conn.execute(sql, *args)

    async def fetchval(self, sql, *args):
        return await self._conn.fetchval(sql, *args)


def _patched(pool):
    """Both seams — patching ``app.api.threads.get_pg_pool`` ALONE records nothing.

    ``get_user_pg_connection`` lives in ``app.dependencies`` and calls ``get_pg_pool()``
    from THAT module's namespace; the note is copied from
    ``test_194_1_thread_workflow_last_run.py``, where several older cases are red at HEAD
    for exactly this reason.
    """
    return (
        patch("app.api.threads.get_pg_pool", AsyncMock(return_value=pool)),
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=pool)),
    )


def _run(status, started_at, continues_used=0, run_id=None):
    return {
        "run_id": run_id or uuid.uuid4(),
        "status": status,
        "continues_used": continues_used,
        "started_at": started_at,
    }


def _get_workflow(client, mock_execute_result, runs):
    """Drive the endpoint on a pure-DEEP thread (anchor NULL) over a seeded `runs` table."""
    thread_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    conn = _FakeConn(runs)
    p1, p2 = _patched(_FakePool(conn))
    with p1, p2:
        resp = client.get(f"/threads/{thread_id}/workflow")
    return resp, conn, thread_id


# ── Case 5 — the pause is REAL and must still be reported ────────────────────────────

def test_latest_run_is_cap_paused_reports_the_pause(client, mock_execute_result):
    """A thread whose LATEST `runs` row is cap_paused still answers `cap_paused: true`.

    This is the arm the bound must NOT break: bounding the read to the latest row is only
    correct if the latest row being paused still reads as paused. Without this case a
    "fix" that simply stopped reporting cap_paused at all would pass cases 6 and 8.
    """
    paused = _run("cap_paused", _T1, continues_used=1)
    resp, _conn, _tid = _get_workflow(
        client, mock_execute_result, [_run("completed", _T0), paused]
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cap_paused"] is True
    assert body["mode"] == "deep"


# ── Case 6 — THE DEFECT. RED before the bound, GREEN after. ──────────────────────────

def test_a_newer_running_row_clears_the_pause(client, mock_execute_result):
    """An OLDER cap_paused row + a NEWER streaming row ⇒ `cap_paused: false`.

    ⛔ RED on the shipped tree. The shipped query filters `WHERE status = 'cap_paused'`
    BEFORE it orders, so the newer row is invisible to it and the endpoint answers
    `true` — which is the composer lock coming straight back after the user did exactly
    what the on-screen message told them to do.

    Falsifiable in the other direction too: restore `AND status = 'cap_paused'` to the
    WHERE clause and this goes red again.
    """
    resp, _conn, _tid = _get_workflow(
        client,
        mock_execute_result,
        [_run("cap_paused", _T0, continues_used=1), _run("streaming", _T1)],
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["cap_paused"] is False


def test_a_newer_completed_row_also_clears_the_pause(client, mock_execute_result):
    """The newer row does not have to be LIVE — any newer run supersedes the pause.

    The invariant is "the pause belongs to the thread's latest run", not "a live run is
    in progress". A completed later run means the paused one was already left behind.
    """
    resp, _conn, _tid = _get_workflow(
        client,
        mock_execute_result,
        [_run("cap_paused", _T0, continues_used=2), _run("completed", _T1)],
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["cap_paused"] is False


# ── Case 7 — the bound must not cost the Continue affordance its data ────────────────

def test_the_paused_rows_continues_used_and_run_id_still_travel(client, mock_execute_result):
    """When the pause IS reported, its `continues_used` and `run_id` still populate.

    `continues_remaining` drives the Continue button and the two sentences at
    `MessageItem.tsx:576-578`; `latest_producer_run_id` is the id the Continue POST is
    addressed to. A bound that reported the pause without its data would render a card
    with no working control — a different flavour of the same "instructs an action it
    forbids" defect.
    """
    paused = _run("cap_paused", _T1, continues_used=2)
    resp, _conn, _tid = _get_workflow(client, mock_execute_result, [paused])

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cap_paused"] is True
    assert body["continues_used"] == 2
    assert body["latest_producer_run_id"] == str(paused["run_id"])


def test_a_thread_with_no_runs_at_all_is_not_paused(client, mock_execute_result):
    """The empty case — a brand-new Deep thread answers `false`, never a crash."""
    resp, _conn, _tid = _get_workflow(client, mock_execute_result, [])

    assert resp.status_code == 200, resp.text
    assert resp.json()["cap_paused"] is False


# ── Case 6b — the QUERY shape itself, so a passing behaviour cannot hide a rewrite ───

def test_the_runs_probe_carries_no_status_predicate(client, mock_execute_result):
    """The `runs` probe this endpoint issues no longer filters on status.

    ⚠ Asserted on the SQL the route actually EXECUTED, not on source text: a behavioural
    case alone could be satisfied by a second query added beside the first, which would
    leave the unbounded read in the tree.
    """
    _resp, conn, thread_id = _get_workflow(
        client, mock_execute_result, [_run("cap_paused", _T0), _run("streaming", _T1)]
    )

    runs_probes = [
        " ".join(s.split()) for s in conn.sql if "FROM runs" in " ".join(s.split())
    ]
    assert runs_probes, "the endpoint issued no `runs` probe at all"
    for sql in runs_probes:
        assert "status = 'cap_paused'" not in sql, sql
        # T-244-03-04: the probe stays keyed on the ROUTE's thread_id, never a
        # client-supplied run id, and travels through the RLS-scoped connection.
        assert "WHERE thread_id = $1" in sql, sql
    idx = [i for i, s in enumerate(conn.sql) if "FROM runs" in " ".join(s.split())][0]
    assert conn.args[idx] == (thread_id,)


# ── Case 8 — `continue_run` still resolves an older paused row BY run_id ─────────────

def test_continue_run_resolves_its_row_by_run_id_not_by_a_status_scan():
    """⛔ The read bound must not strand a continuable run, and this is the proof.

    `continue_run` looks its row up by the PATH id (`.eq("run_id", str(run_id))`), never by
    scanning for `status = 'cap_paused'`. That independence is what makes arm (b) safe: an
    older paused row stops being *reported* by the reconcile read, and stays *resumable* by
    its id, which is how the Continue button addresses it anyway.

    ⚠ A SOURCE-STRUCTURE assertion, and labelled as one. The behavioural path needs the
    supabase builder, whose `.eq()` returns itself and whose `.execute()` answers regardless
    of any filter — so deleting the clause changes a behavioural mock's answer by exactly
    nothing (the limitation `test_194_1_thread_workflow_last_run.py` records verbatim). This
    case IS falsifiable: replace the lookup with a status scan and it reds.
    """
    from app.api import runs as runs_module

    src = inspect.getsource(runs_module.continue_run)
    # The ownership SELECT resolves by run_id…
    assert re.search(r'\.eq\(\s*"run_id"\s*,\s*str\(run_id\)\s*\)', src), src[:400]
    # …and nothing in this function reaches for a cap_paused row by STATUS.
    assert '"status", "cap_paused"' not in src
    assert ".eq(\"status\", \"cap_paused\")" not in src
    # The Deep clear is still addressed by run_id (runs.py:1082-1086) — one writer,
    # one key. T-244-03-06: this plan adds no second writer of `runs.status`.
    assert re.search(
        r'\.update\(\{[^}]*"status":\s*"streaming"[^}]*\}\)\s*\.eq\(\s*"run_id"',
        src,
        re.S,
    ), "continue_run's status clear is no longer keyed by run_id"


def test_the_workflow_reconcile_endpoint_writes_nothing():
    """T-244-03-06 / the endpoint's own pure-read invariant, re-asserted at this change.

    Arm (a) was rejected because it would make this a writer. The fence is cheap and the
    claim is load-bearing, so it is executable rather than a comment.
    """
    from app.api import threads as threads_module

    src = inspect.getsource(threads_module.get_thread_workflow)
    assert ".update(" not in src, "get_thread_workflow acquired a write"
    assert ".insert(" not in src, "get_thread_workflow acquired a write"
    assert ".delete(" not in src, "get_thread_workflow acquired a write"
