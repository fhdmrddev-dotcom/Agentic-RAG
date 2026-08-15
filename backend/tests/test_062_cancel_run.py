"""Phase 147 Plan 03 Task 1 (D-02 refactor-to-share) — cancel/zombie-heal shared-helper
regression backstop.

Proves the D-062 cancel discipline survives the extract into
``run_lifecycle._cancel_run_internals`` (the helper the operator Kill reuses WITHOUT
the ownership filter):

  - ``cancel_run`` still 404s an owner-missing / cross-user run — Step 1's ownership
    SELECT with ``.eq(user_id)`` stays in the CALLER (the helper never checks ownership);
  - the shared helper reports the correct sub-path outcome discriminator for each of
    the three internal paths (``terminal_noop`` / ``task_cancelled`` / ``zombie_healed``)
    so a caller can pick the audit verb (064-B honesty);
  - the zombie-heal path routes the terminal co-write through ``finalize_run_terminal``
    with ``status='cancelled'`` + ``error='cancelled_by_user'`` (the load-bearing atomic
    co-write, D-145-14) and still SETNX-gates + EXPIREs the stream buffer best-effort.

Mocking matches the DATA-ACCESS layer (MEMORY lesson, Phase 146): the ownership SELECT
is supabase (``aexec`` builder) — driven via a ``get_supabase`` override; the zombie-heal
finalize is the asyncpg pool + ``run_lifecycle.finalize_run_terminal`` — patched directly;
Redis best-effort ops use a tiny in-file async fake. We do NOT assert against the stale
supabase ``runs.update`` layer the 145-03 co-write refactor retired.

⚠ EXTENDED BY PHASE 194 PLAN 09 (RUN-01 / SC#2) — the WORKFLOW half of the zombie heal.
Everything above shipped in Phase 147 and is untouched. The cases appended at the bottom
of this file cover the co-write Step 3b gained in 194-09: with ``WORKER_COUNT=2`` and a
PER-PROCESS ``RUN_TASKS`` dict, a Stop landing on the wrong worker takes the zombie arm —
roughly HALF of all missed Stops, not an edge case — and before 194-09 that arm healed only
the ``runs`` row, leaving ``workflow_runs.status='active'`` forever with no anchor pointing
at it (invisible to ``find_resumable_runs``, which requires ``t.active_workflow_run_id =
wr.id``). An orphaned lie, not a lock.

⚠ THESE CASES SEED NOTHING IN ANY DATABASE. The asyncpg pool is the ``mock_asyncpg_pool``
recorder, ``finish_run`` / ``cancel_active_phases`` are patched at ``app.db.workflows``
(the module the helper late-imports from, so the patch lands), and supabase is the
in-file ``_RecordingSupabase``. That is what keeps this suite parallel-safe under
CLAUDE.md's rule 4.
"""
import pathlib
import re
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.dependencies import get_supabase
from app.main import app
from app.services.run_lifecycle import _cancel_run_internals


class _FakeRedis:
    """Minimal async Redis for the zombie best-effort ops (set / exists / expire / zrem).

    ``exists`` defaults to 0 so the synthetic-sentinel ``_emit_terminal`` branch is
    skipped (the buffer is treated as already gone) — the discriminator + finalize
    co-write are what this suite asserts, not the SSE sentinel transport.
    """

    def __init__(self, exists=0):
        self._exists = exists
        self.calls: list = []

    async def set(self, *a, **k):
        self.calls.append(("set", a, k))
        return True

    async def exists(self, *a, **k):
        self.calls.append(("exists", a, k))
        return self._exists

    async def expire(self, *a, **k):
        self.calls.append(("expire", a, k))
        return True

    async def zrem(self, *a, **k):
        self.calls.append(("zrem", a, k))
        return 1


def _chainable(execute_result):
    b = MagicMock()
    for m in (
        "select", "insert", "update", "delete", "eq", "neq", "in_", "or_",
        "is_", "order", "limit", "single", "maybe_single", "gte", "lt", "range",
    ):
        getattr(b, m).return_value = b
    b.execute.return_value = execute_result
    b.execute.side_effect = None
    return b


def _mock_supabase_runs_returns(data):
    result = MagicMock()
    result.data = data
    result.count = None
    b = _chainable(result)
    sb = MagicMock()
    sb.table.return_value = b
    return sb


# ── cancel_run owner-path: Step 1 ownership SELECT stays in the caller ─────────

def test_cancel_run_owner_missing_row_404s(client, auth_headers):
    """cancel_run 404s when the ownership SELECT returns no row (cross-user / missing).

    The ownership filter (``.eq(user_id)``) lives in the CALLER, not the shared
    helper — a run the caller doesn't own is byte-identically 404 (D-062-12 /
    T-062-01), and the response detail is the route's ``Run not found`` (never
    FastAPI's default) so this fails loudly if the DELETE route regresses away.
    """
    sb = _mock_supabase_runs_returns(None)
    app.dependency_overrides[get_supabase] = lambda: sb
    try:
        res = client.delete(f"/runs/{uuid4()}", headers=auth_headers)
        assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"
        assert res.json()["detail"] == "Run not found"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


# ── the shared helper reports the right outcome discriminator per sub-path ─────

async def test_internals_terminal_noop_short_circuits():
    """An already-terminal run → 'terminal_noop', no Redis/pool touch (D-062-09)."""
    fr = _FakeRedis()
    out = await _cancel_run_internals(
        run_id=uuid4(),
        status="completed",
        thread_id=str(uuid4()),
        redis=fr,
        supabase=MagicMock(),
    )
    assert out == "terminal_noop"
    assert fr.calls == [], "terminal short-circuit must not touch Redis"


async def test_internals_task_cancelled_when_producer_alive():
    """A live producer in RUN_TASKS → PUBLISH-first sentinel then task.cancel() →
    'task_cancelled' (D-062-10 / D-085-04)."""
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    fake_task = MagicMock()
    fake_task.done.return_value = False
    RUN_TASKS[rid] = fake_task
    try:
        out = await _cancel_run_internals(
            run_id=rid,
            status="streaming",
            thread_id=str(uuid4()),
            redis=_FakeRedis(),
            supabase=MagicMock(),
        )
        assert out == "task_cancelled"
        fake_task.cancel.assert_called_once()
    finally:
        RUN_TASKS.pop(rid, None)


async def test_internals_zombie_heal_routes_finalize_run_terminal(mock_asyncpg_pool, monkeypatch):
    """A streaming run with NO live producer → zombie heal (D-062-11).

    Asserts the load-bearing atomic terminal co-write goes through
    ``finalize_run_terminal(status='cancelled', error='cancelled_by_user')`` (D-145-14)
    and the discriminator is 'zombie_healed' so the operator Kill can pick the
    "Recovered a stuck run" audit verb (064-B).
    """
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    RUN_TASKS.pop(rid, None)  # ensure the happy path can't fire

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    fake_finalize = AsyncMock()
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", fake_finalize)

    fr = _FakeRedis(exists=0)
    out = await _cancel_run_internals(
        run_id=rid,
        status="streaming",
        thread_id=str(uuid4()),
        redis=fr,
        supabase=MagicMock(),
    )

    assert out == "zombie_healed"
    fake_finalize.assert_awaited_once()
    kwargs = fake_finalize.await_args.kwargs
    assert kwargs["status"] == "cancelled"
    assert kwargs["error"] == "cancelled_by_user"
    # best-effort SETNX cancel-lock + EXPIRE still fire on the zombie path
    assert any(c[0] == "set" for c in fr.calls), "zombie heal must SETNX the cancel-lock"
    assert any(c[0] == "expire" for c in fr.calls), "zombie heal must EXPIRE the stream buffer"


# ══════════════════════════════════════════════════════════════════════════════
# Phase 194 Plan 09 (RUN-01 / SC#2) — the WORKFLOW half of the zombie heal
# ══════════════════════════════════════════════════════════════════════════════
#
# Everything above this banner shipped in Phase 147 and is byte-untouched.


class _RecordingBuilder:
    """A supabase query builder that RECORDS which op it is, on the owning double.

    Only ``select`` and ``update`` are recorded — those are the two the ordering
    proof (V-10) needs. Every other builder method is a fluent no-op, matching the
    shipped ``_chainable`` above.
    """

    def __init__(self, sb, table):
        self._sb = sb
        self._table = table
        self._op = None

    def select(self, *a, **k):
        self._op = "select"
        self._sb.ops.append(("select", self._table, a))
        return self

    def update(self, payload=None, *a, **k):
        self._op = "update"
        self._sb.ops.append(("update", self._table, payload))
        return self

    def eq(self, *a, **k):
        return self

    def maybe_single(self, *a, **k):
        return self

    def single(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def execute(self):
        res = MagicMock()
        if self._op == "select":
            res.data = (
                {"active_workflow_run_id": self._sb.anchor}
                if self._sb.anchor is not None
                else None
            )
        else:
            res.data = None
        res.count = None
        return res


class _RecordingSupabase:
    """A supabase double that records the ORDER of ``threads`` builder ops.

    ⚠ V-10 IS ASSERTED BY CALL ORDER, NEVER BY A SOURCE GREP. The anchor
    ``.select("active_workflow_run_id")`` MUST be recorded BEFORE the shipped
    092-03 ``.update({"active_workflow_run_id": None})`` clear, because
    ``finish_run`` keys its own anchor clear on ``active_workflow_run_id = $1``:
    if the standalone clear ran first, the id is gone and the ``workflow_runs``
    row is unreachable forever.

    ⚠ AND THE REASON THE ASSERTION IS ON THE ORDER RATHER THAN ON ``wf_id``:
    against a REAL database, moving the read below the clear makes ``wf_id`` come
    back ``None``. Against a MOCK it does not — a double keeps returning whatever
    it was seeded with, so a "wf_id is not None" assertion would stay GREEN under
    exactly the defect it is meant to catch. The recorded order is the only thing
    that moves here, which is why it is what is asserted.
    """

    def __init__(self, anchor=None):
        self.anchor = anchor
        self.ops: list = []

    def table(self, name):
        return _RecordingBuilder(self, name)

    def op_names(self, table="threads"):
        return [o[0] for o in self.ops if o[1] == table]


def _patch_workflow_writers(monkeypatch):
    """Patch the two db writers AT ``app.db.workflows`` — the module the helper
    late-imports from, so a late ``from app.db.workflows import ...`` picks the
    patched objects up at call time. Returns ``(finish_run, cancel_active_phases)``.
    """
    fake_finish = AsyncMock()
    fake_cancel_phases = AsyncMock()
    monkeypatch.setattr("app.db.workflows.finish_run", fake_finish)
    monkeypatch.setattr("app.db.workflows.cancel_active_phases", fake_cancel_phases)
    return fake_finish, fake_cancel_phases


async def _drive_zombie_heal(monkeypatch, mock_asyncpg_pool, *, anchor, redis=None):
    """Drive Step 3b's zombie arm with a thread whose anchor is ``anchor``.

    Seeds NOTHING: the pool is the recorder fixture, ``finalize_run_terminal`` is
    patched out (its own behaviour is covered by the shipped case above), and the
    two workflow writers are patched at their module.
    """
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    RUN_TASKS.pop(rid, None)  # ensure the happy path can't fire

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    monkeypatch.setattr(
        "app.services.run_lifecycle.finalize_run_terminal", AsyncMock()
    )
    fake_finish, fake_cancel_phases = _patch_workflow_writers(monkeypatch)

    sb = _RecordingSupabase(anchor=anchor)
    fr = redis if redis is not None else _FakeRedis(exists=0)
    out = await _cancel_run_internals(
        run_id=rid,
        status="streaming",
        thread_id=str(uuid4()),
        redis=fr,
        supabase=sb,
    )
    return out, sb, fr, fake_finish, fake_cancel_phases


async def test_internals_zombie_heal_finishes_the_workflow_run(
    mock_asyncpg_pool, monkeypatch
):
    """V-09 — the zombie arm terminalizes ``workflow_runs``, not only ``runs``.

    A Stop that lands on a worker where the producer task is dead now marks the
    workflow run ``cancelled`` too, so "stop at ANY point" is TRUE rather than
    qualified. ``finish_run`` is awaited exactly ONCE, with the id read off the
    thread anchor and the status ``'cancelled'``.

    ⚠ THE STATUS VALUE IS LOAD-BEARING, not incidental: a cross-worker interleave
    with worker B's F2 terminalize is benign ONLY BY VALUE-IDENTITY (both writes
    carry the same value, row-level locking serialises them, the anchor clear is
    idempotent). The one thing a caller must never do is make the two writes
    DISAGREE — e.g. this one passing 'failed' while F2 passes 'cancelled'.
    """
    wf_id = str(uuid4())
    out, _sb, _fr, fake_finish, _ = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=wf_id
    )

    assert out == "zombie_healed"
    assert fake_finish.await_count == 1, (
        "the zombie arm must terminalize workflow_runs exactly once "
        f"(awaited {fake_finish.await_count}×)"
    )
    args = fake_finish.await_args.args
    assert str(args[1]) == wf_id, "finish_run must be keyed on the anchored workflow_runs.id"
    assert args[2] == "cancelled"


async def test_internals_zombie_heal_terminalizes_the_interrupted_phase(
    mock_asyncpg_pool, monkeypatch
):
    """V-17 — the interrupted ``workflow_phases`` row is terminalized too.

    A run whose status says ``cancelled`` while its phase row still says ``active``
    is the same class of lie this plan removes one level up. ``cancel_active_phases``
    is awaited exactly once, keyed on the SAME ``workflow_runs.id`` as ``finish_run``.

    This is a SEPARATE case from V-09 on purpose: they are two clauses of the
    co-write, and a plant that breaks one must not be able to hide behind the other
    (194-03 shipped four REQUIRED plants that all red on the same clause, which
    would have left a second clause inert and indistinguishable from live).
    """
    wf_id = str(uuid4())
    _out, _sb, _fr, fake_finish, fake_cancel_phases = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=wf_id
    )

    assert fake_cancel_phases.await_count == 1, (
        "the zombie arm must terminalize the interrupted phase exactly once "
        f"(awaited {fake_cancel_phases.await_count}×)"
    )
    assert str(fake_cancel_phases.await_args.args[1]) == wf_id
    # Same id on both halves of the composition — one run, one phase set.
    assert str(fake_cancel_phases.await_args.args[1]) == str(
        fake_finish.await_args.args[1]
    )


async def test_internals_zombie_heal_reads_the_anchor_before_the_shipped_clear(
    mock_asyncpg_pool, monkeypatch
):
    """V-10 / F-2 — the anchor READ precedes the shipped 092-03 anchor CLEAR.

    Asserted by CALL ORDER on the supabase double, never by reading the source.
    ``finish_run`` keys its own anchor clear on ``WHERE active_workflow_run_id = $1``;
    if the standalone 092-03 clear ran first the id is already NULL, the read comes
    back empty and the ``workflow_runs`` row becomes permanently unreachable — the
    exact orphaned-lie state this plan exists to remove.
    """
    wf_id = str(uuid4())
    _out, sb, _fr, _fin, _ph = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=wf_id
    )

    ops = sb.op_names("threads")
    assert "select" in ops, "Step 3b must READ the thread anchor"
    assert "update" in ops, "the shipped 092-03 standalone anchor clear must survive"
    assert ops.index("select") < ops.index("update"), (
        f"the anchor read must precede the shipped clear; recorded order was {ops}"
    )


async def test_internals_zombie_heal_is_idempotent_on_a_second_call(
    mock_asyncpg_pool, monkeypatch
):
    """V-13 — a second ``_cancel_run_internals`` for the same run changes nothing.

    ``finish_run`` may legitimately be awaited again (its UPDATE writes the same
    value and its anchor clear finds 0 rows), so idempotence here means the WRITE
    and the DISCRIMINATOR are unchanged — not that the call is skipped. That
    distinction matters: the delete cascade has called both for the same run since
    Phase 152 without incident, which is the shipped evidence the double call is
    benign.
    """
    wf_id = str(uuid4())
    out1, _sb1, _fr1, fin1, ph1 = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=wf_id
    )
    out2, _sb2, _fr2, fin2, ph2 = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=wf_id
    )

    assert out1 == out2 == "zombie_healed", "the discriminator must not change"
    assert fin1.await_args.args[1:] == fin2.await_args.args[1:], (
        "the second call must write the SAME value — a divergent status is the one "
        "thing the cross-worker interleave is not safe against"
    )
    assert ph1.await_args.args[1:] == ph2.await_args.args[1:]


async def test_internals_zombie_heal_workflow_cowrite_preserves_the_shipped_arms(
    mock_asyncpg_pool, monkeypatch
):
    """The four shipped Step-3b arms still fire, unchanged, alongside the co-write.

    D-11 — the outcome discriminator's honesty rule is INHERITED, not re-decided:
    the returned value stays ``"zombie_healed"`` byte-for-byte, so the shipped 064-B
    rendering ("recovered a stuck run", NEVER "killed") is preserved BY CONSTRUCTION.
    The workflow half of the heal introduces no new discriminator and no new
    user-facing verb.

    ⚠ THIS CASE IS A REGRESSION PIN, NOT A FENCE ON NEW BEHAVIOUR, AND IT IS SAID
    HERE SO NOBODY LATER MISREADS IT. It asserts only things that were ALREADY TRUE
    before 194-09, so it PASSED on this plan's RED run (4 failed / 5 passed — the 5th
    was this) while its four siblings failed. That is correct and expected: its job is
    to red if the co-write ever DAMAGES a shipped arm, not to prove the co-write
    exists. Reading a RED run case-by-case rather than by its count is what makes that
    distinction visible (194-06 caught a genuinely vacuous fence exactly this way).
    """
    out, sb, fr, _fin, _ph = await _drive_zombie_heal(
        monkeypatch, mock_asyncpg_pool, anchor=str(uuid4())
    )

    assert out == "zombie_healed"
    assert any(c[0] == "set" for c in fr.calls), "SETNX cancel-lock must still fire"
    assert any(c[0] == "expire" for c in fr.calls), "EXPIRE must still fire"
    assert "update" in sb.op_names("threads"), (
        "the shipped standalone anchor clear must still fire — it is the "
        "belt-and-braces arm for the wf_id-is-None case and the Deep path's no-op"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Phase 194 Plan 09 — the PHASE-HONESTY fences (V-18 / V-19, F-5 / F-6)
# ══════════════════════════════════════════════════════════════════════════════

_REPO = pathlib.Path(__file__).resolve().parents[2]
_DB_WORKFLOWS_SRC = _REPO / "backend/app/db/workflows.py"
_MIG_119 = _REPO / "supabase/migrations/119_workflow_phases_cancelled.sql"
_MIG_115 = _REPO / "supabase/migrations/115_workflow_phases_recorded_not_sent.sql"

_SET_STATUS = re.compile(r"UPDATE\s+workflow_phases\s+SET\s+status='([a-z_]+)'")
_WHERE_STATUS_EQ = re.compile(r"AND\s+status\s*=\s*'([a-z_]+)'")
_WHERE_STATUS_IN = re.compile(r"AND\s+status\s+IN\s*\(([^)]*)\)")
_WHERE_RUN_KEYED = re.compile(r"WHERE\s+workflow_run_id\s*=\s*\$1")
_LITERAL = re.compile(r"'([a-z_]+)'::text")


def _constraint_literals(path):
    """Every ``'x'::text`` literal BELOW ``BEGIN;`` in a migration.

    ⚠ Scoped below ``BEGIN;`` ON PURPOSE: these migrations' headers quote the literals
    in prose (119's header names all six shipped values and the new one), so a
    whole-file scan would read the DOCUMENTATION as the constraint.
    """
    sql = path.read_text(encoding="utf-8")
    body = sql.split("BEGIN;", 1)[1]
    return set(_LITERAL.findall(body))


class _PhaseTablePool:
    """An asyncpg-pool double that INTERPRETS the phase UPDATE against seeded rows.

    Not a call recorder — a tiny evaluator. It parses the SET value and the WHERE
    predicate out of the SQL the writer composes and applies them to an in-memory
    ``workflow_phases``. That is what lets V-18 be asserted BEHAVIOURALLY ("a run whose
    phases are [completed, active, pending] produces a write matching only the active
    row") rather than only as a string shape.

    ⚠ IT UNDERSTANDS BOTH ``status = 'x'`` AND ``status IN (…)``, deliberately: F-5's
    plant widens the predicate to ``IN ('active','completed')``, and an evaluator that
    could not parse the planted form would leave the behavioural clause unable to fire
    — a fence that reds only on the string shape while the behaviour clause sits inert.

    ⚠ SEEDS NOTHING IN ANY DATABASE. Rows live in a list on this object.
    """

    def __init__(self, rows):
        self.rows = [dict(r) for r in rows]
        self.executed: list[tuple] = []

    async def execute(self, sql, *args):
        self.executed.append((sql, args))
        set_m = _SET_STATUS.search(sql)
        if not set_m:
            return None  # not a phase write (e.g. the workflow_runs status UPDATE)
        new_status = set_m.group(1)
        run_id = args[0] if args else None

        def matches(row):
            if _WHERE_RUN_KEYED.search(sql) and str(row["workflow_run_id"]) != str(run_id):
                return False
            eq = _WHERE_STATUS_EQ.search(sql)
            if eq:
                return row["status"] == eq.group(1)
            in_ = _WHERE_STATUS_IN.search(sql)
            if in_:
                return row["status"] in {
                    v.strip().strip("'") for v in in_.group(1).split(",")
                }
            return True  # NO status predicate at all — a bulk terminalize

        for row in self.rows:
            if matches(row):
                row["status"] = new_status
        return None

    def acquire(self):  # pragma: no cover - finish_run's transaction path
        raise AssertionError(
            "these fences drive cancel_active_phases only; finish_run is patched out"
        )

    def phase_statuses(self):
        return [r["status"] for r in self.rows]


async def _drive_real_phase_terminalize(monkeypatch, rows, wf_id):
    """Drive the zombie arm with the REAL ``cancel_active_phases`` against ``rows``.

    Only ``finish_run`` is patched out (its transaction path needs a connection double
    this evaluator deliberately does not provide) — the phase writer under test runs for
    real, composing its own SQL.
    """
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    RUN_TASKS.pop(rid, None)
    pool = _PhaseTablePool(rows)
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", AsyncMock())
    monkeypatch.setattr("app.db.workflows.finish_run", AsyncMock())

    out = await _cancel_run_internals(
        run_id=rid,
        status="streaming",
        thread_id=str(uuid4()),
        redis=_FakeRedis(exists=0),
        supabase=_RecordingSupabase(anchor=wf_id),
    )
    return out, pool


async def test_a_cancel_leaves_completed_and_every_other_terminal_phase_untouched(
    monkeypatch,
):
    """V-18 / F-5 — the cancel path's phase write reaches ONLY ``active`` rows.

    A stopped run KEEPS its completed phases: their outputs are already durable, and
    D-07 / D-13 forbid a bulk rewrite outright. ``failed``, ``skipped`` and
    ``recorded_not_sent`` rows are equally out of reach — this migration ADMITS a
    literal, it does not authorise a backfill.

    ⚠ TWO CLAUSES, ASSERTED SEPARATELY: the composed SQL's predicate is
    ``AND status = 'active'`` (the string shape), AND a seeded table of
    [completed, active, pending, failed, skipped, recorded_not_sent] comes back with
    exactly ONE row moved (the behaviour). The ``AND status = 'active'`` clause is THE
    MECHANISM, not a convention — it is the only thing standing between this writer and
    a bulk terminalize.
    """
    wf_id = str(uuid4())
    rows = [
        {"id": uuid4(), "workflow_run_id": wf_id, "status": s}
        for s in ("completed", "active", "pending", "failed", "skipped", "recorded_not_sent")
    ]
    _out, pool = await _drive_real_phase_terminalize(monkeypatch, rows, wf_id)

    phase_writes = [(s, a) for s, a in pool.executed if _SET_STATUS.search(s)]
    assert len(phase_writes) == 1, (
        f"expected exactly ONE workflow_phases write on the cancel path; got "
        f"{len(phase_writes)}"
    )
    sql = phase_writes[0][0]
    eq = _WHERE_STATUS_EQ.search(sql)
    assert eq and eq.group(1) == "active", (
        "the phase terminalize must restrict to status = 'active'; predicate was "
        f"{sql!r}"
    )

    assert pool.phase_statuses() == [
        "completed",
        "cancelled",
        "pending",
        "failed",
        "skipped",
        "recorded_not_sent",
    ], (
        "a stop must move ONLY the interrupted (active) row; observed "
        f"{pool.phase_statuses()}"
    )


async def test_no_cancel_path_writes_the_failed_or_skipped_vocabulary(monkeypatch):
    """V-19 / F-6 — the cancel path's composed status VALUE is the mig-119 slug.

    ⚠ THE HONESTY ARGUMENT, CARRIED BY THE FENCE ITSELF SO IT IS NOT ONLY IN CONTEXT:
    the phase did NOT fail — nothing went wrong, the step was interrupted. It was NOT
    skipped — it was never routed around; it started, it did work, and a person ended
    the run underneath it. Reusing either word was OFFERED AND REJECTED (D-04), in a
    phase whose entire requirement is honesty about what a stopped run did and did not
    do. Writing ``failed`` on a phase that did not fail is precisely the dishonesty this
    phase exists to remove.

    ⚠ SCOPED OVER THE COMPOSED SQL VALUE, NEVER THE MODULE SOURCE — the 193.2 F-3
    lesson, and here it is not hypothetical: ``db/workflows.py``'s docblocks
    LEGITIMATELY name ``failed`` and ``skipped`` (three of the five shipped writers live
    there and D-04's rejection is recorded there in prose), so a raw source sweep would
    red on the documentation of the very rule it is defending. The scoping is CHECKED
    rather than assumed below: the module source is asserted to still contain both
    words while the composed value contains neither. If that first assertion ever fails,
    this fence has stopped being a scope proof and is merely passing.

    ⚠ THE EXPECTED SLUG IS DERIVED FROM BOTH MIGRATIONS BY GREP, NEVER RE-TYPED —
    migration 119's constraint literals minus migration 115's — so a misspelling on
    either side is a failure rather than a matching pair of typos.
    """
    wf_id = str(uuid4())
    rows = [{"id": uuid4(), "workflow_run_id": wf_id, "status": "active"}]
    _out, pool = await _drive_real_phase_terminalize(monkeypatch, rows, wf_id)

    phase_writes = [s for s, _ in pool.executed if _SET_STATUS.search(s)]
    assert len(phase_writes) == 1
    written = _SET_STATUS.search(phase_writes[0]).group(1)

    assert written not in ("failed", "skipped"), (
        f"the cancel path composed status={written!r} — D-04 rejected BOTH by name"
    )

    new_literals = _constraint_literals(_MIG_119) - _constraint_literals(_MIG_115)
    assert new_literals == {"cancelled"}, (
        "migration 119 must add exactly ONE literal over migration 115's six; derived "
        f"{sorted(new_literals)}"
    )
    assert written == new_literals.pop(), (
        "the written slug must be byte-identical to migration 119's new literal"
    )

    # ── the scope proof, checked rather than assumed ──
    module_src = _DB_WORKFLOWS_SRC.read_text(encoding="utf-8")
    assert "failed" in module_src and "skipped" in module_src, (
        "db/workflows.py no longer names 'failed'/'skipped' anywhere — this fence's "
        "value-scoping is no longer demonstrating anything and must be re-examined, "
        "not trusted"
    )
