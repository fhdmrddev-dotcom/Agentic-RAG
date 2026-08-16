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
from uuid import UUID, uuid4

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


# ══════════════════════════════════════════════════════════════════════════════
# Phase 194 Plan 11 (RUN-01 / SC#1) — the DELETE dual-id fallback
# ══════════════════════════════════════════════════════════════════════════════
#
# ⚠ THE FINDING THESE CASES DEFEND, STATED HERE BECAUSE IT WAS RECORDED ONCE BEFORE
# AND LOST. ``WorkflowLock.runId`` on the frontend carries TWO id types — some write
# sites store a ``workflow_runs.id``, others a producer ``runs.run_id`` — while its own
# JSDoc asserts only the first. ``DELETE /runs/{id}`` accepted only the second and the
# client's ``cancelRun`` SWALLOWS 404, so a Stop resolved through the anchor id
# SILENTLY SUCCEEDED WHILE DOING NOTHING. Phase 188 measured this and recorded it only
# in a comment at ``WorkspacePanel.tsx:161-165``, where the next phase could not see it.
#
# ⚠ AND THE SERVER-SIDE HALF OF THE SAME SILENT SUCCESS: the shared cancel writer keys
# ``RUN_TASKS`` and ``finalize_run_terminal`` on the PRODUCER ``runs.run_id``. Handing
# it a ``workflow_runs.id`` misses the registry, takes the zombie arm, updates ZERO
# ``runs`` rows and STILL returns 204. That is why V-01 asserts the ARGUMENT VALUE:
# a case that only checked "the writer was called" would pass under the exact bug this
# plan exists to fix.
#
# ⚠ THESE CASES SEED NOTHING IN ANY DATABASE. supabase is the in-file
# ``_FilteringSupabase``, the pool is a tiny fetch double, Redis is a fake, and the two
# cancel writers are patched at their own modules. Parallel-safe under CLAUDE.md rule 4.


class _FilteringBuilder:
    """A supabase builder that INTERPRETS its ``.eq()`` filters against seeded rows.

    ⚠ THE INTERPRETATION IS THE WHOLE POINT AND A RECORDING DOUBLE WOULD NOT DO. F-10's
    three plants each DELETE one ``.eq(...)`` / one ``if`` from production source; a
    double that merely recorded the calls would keep returning its seeded row no matter
    which filter vanished, so every plant would stay GREEN and all three fences would
    ship inert. (194-09 hit exactly that shape from the other side: under its F-2 plant
    a seeded double kept answering, so only the recorded ORDER moved.) Here the missing
    filter must change the ANSWER, which is what makes a plant able to red at all.

    Only ``select`` is evaluated; ``update`` is recorded and returns no data, matching
    the shipped ``_RecordingBuilder`` above.
    """

    def __init__(self, sb, table):
        self._sb = sb
        self._table = table
        self._filters: dict = {}
        self._op = None

    def select(self, *a, **k):
        self._op = "select"
        self._sb.selected.append(self._table)
        return self

    def update(self, payload=None, *a, **k):
        self._op = "update"
        self._sb.updates.append((self._table, payload))
        return self

    def insert(self, payload=None, *a, **k):
        self._op = "insert"
        return self

    def eq(self, col, val):
        self._filters[col] = val
        self._sb.filters.append((self._table, col, val))
        return self

    def maybe_single(self, *a, **k):
        return self

    def single(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def execute(self):
        res = MagicMock()
        res.count = None
        if self._op != "select":
            res.data = None
            return res
        rows = [
            r
            for r in self._sb.tables.get(self._table, [])
            if all(str(r.get(c)) == str(v) for c, v in self._filters.items())
        ]
        res.data = rows[0] if rows else None
        return res


class _FilteringSupabase:
    """Seeded, filter-honouring supabase double for the dual-id fallback cases."""

    def __init__(self, **tables):
        self.tables = {k: list(v) for k, v in tables.items()}
        self.filters: list = []
        self.selected: list = []
        self.updates: list = []

    def table(self, name):
        return _FilteringBuilder(self, name)


class _FetchPool:
    """An asyncpg-pool double whose ``fetch`` answers the forward-resolution SELECT.

    Records ``(sql, args)`` so the ``$N``-bind and ``status = 'streaming'`` clauses can
    be asserted on the SQL the route actually composes, rather than on the source text.
    """

    def __init__(self, rows):
        self._rows = rows
        self.fetched: list = []

    async def fetch(self, sql, *args):
        self.fetched.append((sql, args))
        return list(self._rows)

    async def execute(self, sql, *args):  # pragma: no cover - not reached here
        return None


class _CancelFakeRedis(_FakeRedis):
    """``_FakeRedis`` plus the two ops ``publish_cancel_sentinel`` touches."""

    async def smembers(self, *a, **k):
        self.calls.append(("smembers", a, k))
        return set()

    async def publish(self, *a, **k):  # pragma: no cover - empty channel set
        self.calls.append(("publish", a, k))
        return 0


_ME = "00000000-0000-0000-0000-000000000001"   # conftest's mock_user_data["id"]
_OTHER = "00000000-0000-0000-0000-0000000000ff"


def _install(sb, redis_double, monkeypatch):
    """Point ``get_supabase`` (and, via conftest's mirror, the user-JWT client) and
    ``get_redis`` at the doubles. Returns nothing; teardown is the caller's ``finally``.
    """
    from app.dependencies import get_redis

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: redis_double


def _uninstall():
    from app.dependencies import get_redis

    app.dependency_overrides.pop(get_supabase, None)
    app.dependency_overrides.pop(get_redis, None)


def _spies(monkeypatch, pool):
    """Patch the pool singleton and BOTH cancel writers at their own modules.

    The route late-imports each one at call time, so patching the source module is what
    makes the patch land (the ``_patch_workflow_writers`` discipline above).
    """
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    producer_spy = AsyncMock(return_value="task_cancelled")
    workflow_spy = AsyncMock()
    monkeypatch.setattr(
        "app.services.run_lifecycle._cancel_run_internals", producer_spy
    )
    monkeypatch.setattr(
        "app.services.run_lifecycle.cancel_workflow_run_internals", workflow_spy
    )
    return producer_spy, workflow_spy


def _anchored_world(*, wf_owner=_ME, thread_owner=_ME, anchor=None, wf_id=None,
                    thread_id=None):
    """Seed the three tables for a workflow-run id, with each owner independently set.

    Each F-10 clause gets its OWN world by moving exactly ONE of ``wf_owner`` /
    ``thread_owner`` / ``anchor`` — which is what makes the three plants able to red
    three DIFFERENT cases instead of all reding the same one (the 194-03 lesson: four
    REQUIRED plants that all red on one clause would have shipped a second clause
    inert and indistinguishable from live).
    """
    wf_id = wf_id or str(uuid4())
    thread_id = thread_id or str(uuid4())
    sb = _FilteringSupabase(
        runs=[],
        workflow_runs=[{"id": wf_id, "user_id": wf_owner, "thread_id": thread_id}],
        threads=[{
            "id": thread_id,
            "user_id": thread_owner,
            "active_workflow_run_id": wf_id if anchor is None else anchor,
        }],
    )
    return sb, wf_id, thread_id


# ── V-01: the FORWARD resolution — asserted on the ARGUMENT VALUE ─────────────

def test_v01_workflow_run_id_cancels_through_the_producer_id(
    client, auth_headers, monkeypatch
):
    """V-01 — a ``workflow_runs.id`` reaches the shared writer as the PRODUCER id.

    ⚠ ASSERTED ON THE ARGUMENT VALUE, AND ADDITIONALLY ON ITS INEQUALITY WITH THE ID
    THE CLIENT SENT. A case that only checked "the writer was called" would pass under
    the exact bug this plan exists to fix — a ``workflow_runs.id`` handed straight
    through, which misses ``RUN_TASKS``, takes the zombie arm, updates ZERO ``runs``
    rows and still 204s. "Called" is not the property; "called with the producer
    identity" is.
    """
    sb, wf_id, thread_id = _anchored_world()
    producer_id = uuid4()
    pool = _FetchPool([{
        "wf_id": wf_id,
        "thread_id": thread_id,
        "producer_id": producer_id,
        "producer_status": "streaming",
    }])
    producer_spy, workflow_spy = _spies(monkeypatch, pool)
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 204, f"expected 204; got {res.status_code} {res.text}"
    assert producer_spy.await_count == 1, (
        "a live producer must be cancelled through the shared writer exactly once "
        f"(awaited {producer_spy.await_count}×)"
    )
    passed = producer_spy.await_args.kwargs["run_id"]
    assert str(passed) == str(producer_id), (
        "the shared writer must receive the PRODUCER runs.run_id resolved by the LEFT "
        f"JOIN; it received {passed!r}"
    )
    assert str(passed) != str(wf_id), (
        "the workflow_runs.id the client sent must NEVER reach the shared writer — "
        "that is the silent 204-over-a-no-op this plan removes"
    )
    # the producer's OWN status, not a synthesized None: this route READS row['status']
    # as Step 2's terminal check (the ask_user fallback's None shape would be wrong).
    assert producer_spy.await_args.kwargs["status"] == "streaming"
    assert workflow_spy.await_count == 0, (
        "with a live producer the workflow-side composition must NOT also run — the "
        "producer's own CancelledError handler finalizes"
    )


def test_v01_forward_resolution_sql_binds_and_scopes_the_live_producer(
    client, auth_headers, monkeypatch
):
    """The forward-resolution SELECT uses ``$N`` binds and scopes to a LIVE producer.

    Two clauses, asserted separately on the SQL the route COMPOSES (never on the module
    source, so a docblock quoting either token cannot satisfy this): the run id arrives
    as a bind parameter — no f-string reaches SQL (T-152-05-05 / T-091-03) — and the
    join is restricted to ``status = 'streaming'``, which is the only thing that makes
    the resolved id a LIVE producer rather than any historical run on the thread.
    """
    sb, wf_id, thread_id = _anchored_world()
    producer_id = uuid4()
    pool = _FetchPool([{
        "wf_id": wf_id, "thread_id": thread_id,
        "producer_id": producer_id, "producer_status": "streaming",
    }])
    _spies(monkeypatch, pool)
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 204
    assert len(pool.fetched) == 1, f"expected ONE forward-resolution fetch; got {pool.fetched}"
    sql, args = pool.fetched[0]
    assert "$1" in sql, f"the run id must be a bind, never interpolated; SQL was {sql!r}"
    assert str(wf_id) not in sql, (
        "the workflow_runs.id must NOT appear inside the SQL text — that would be an "
        f"f-string on a user-supplied value; SQL was {sql!r}"
    )
    assert str(args[0]) == str(wf_id), "the id must be bound as $1"
    assert "status = 'streaming'" in sql, (
        "the LEFT JOIN must scope to a LIVE producer row; SQL was " f"{sql!r}"
    )


# ── V-01b: no live producer → the ONE exported composition, never the writer ──

def test_v01b_no_live_producer_calls_the_exported_workflow_composition(
    client, auth_headers, monkeypatch
):
    """No live producer → plan 194-09's exported composition, keyed on the WORKFLOW id.

    ⚠ AND THE SHARED WRITER MUST NOT RUN. There is nothing in ``RUN_TASKS`` to cancel,
    and ``finalize_run_terminal`` would update ZERO ``runs`` rows — a 204 over a no-op,
    which is the same silent success one level down. The honest act is to write the
    terminal state the workflow run will otherwise never get, through the ONE
    composition (D-08/D-10) rather than a re-composed second writer.
    """
    sb, wf_id, thread_id = _anchored_world()
    pool = _FetchPool([{
        "wf_id": wf_id, "thread_id": thread_id,
        "producer_id": None, "producer_status": None,
    }])
    producer_spy, workflow_spy = _spies(monkeypatch, pool)
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 204, f"expected 204; got {res.status_code} {res.text}"
    assert workflow_spy.await_count == 1, (
        "the no-producer arm must terminalize the workflow run exactly once "
        f"(awaited {workflow_spy.await_count}×)"
    )
    assert str(workflow_spy.await_args.kwargs["workflow_run_id"]) == str(wf_id)
    assert producer_spy.await_count == 0, (
        "the shared runs-keyed writer must NOT be handed a workflow_runs.id — it "
        "would miss RUN_TASKS, update zero runs rows, and 204 anyway"
    )


# ── V-02 / V-03: the authorization boundary — one case per clause ─────────────
#
# ⚠ THREE CLAUSES, THREE CASES, THREE PLANTS — ONE PER CLAUSE, DELIBERATELY. F-10 as
# specified asked for two plants; three ship, because PATTERNS § S1 names THREE clauses
# and a single "cross-user → 404" case cannot isolate any of them: on a REALISTIC
# cross-user world (the workflow run AND its thread both owned by the attacker's
# victim) clauses (a) and (b) each block the request on their own, so deleting either
# one leaves the case GREEN and the fence ships inert. Each case below therefore moves
# EXACTLY ONE of the three inputs, so exactly one clause is load-bearing in it.
#
# ⚠ AND THE HONEST COST OF THAT ISOLATION IS STATED RATHER THAN HIDDEN: the worlds in
# the (a) and (b) cases are only reachable if a DIFFERENT invariant has already broken
# (a thread anchored to a workflow run its own owner did not start). That is precisely
# what defence in depth is for — a clause whose only test is a world where a sibling
# clause also holds has never actually been tested. The realistic both-clauses world is
# driven too, in its own case below, and is labelled as covering both.


def test_v02_cross_user_workflow_run_id_is_404_not_403(
    client, auth_headers, monkeypatch
):
    """V-02 / F-10 clause (a) — a ``workflow_runs`` row owned by another user → 404.

    ISOLATES the ``.eq("user_id", …)`` on the ``workflow_runs`` select: the thread here
    IS the caller's and IS anchored to the id, so clauses (b) and (c) both pass and
    clause (a) is the only thing standing between an attacker-chosen uuid and a cancel
    on a service-role pool that bypasses RLS. Phase 190's CR-01 was a real credential
    exposure that 19 plans of RED-first self-checking missed.

    ⚠ **404, NEVER 403** — asserted on the status AND on the body, because a 404 whose
    detail differs from the shipped *doesn't exist* response is still an existence leak
    (T-062-01 / D-062-12).
    """
    sb, wf_id, _tid = _anchored_world(wf_owner=_OTHER)
    _spies(monkeypatch, _FetchPool([]))
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"
    assert res.status_code != 403, "this route must never answer 403 (D-062-12)"


def test_v02b_thread_owned_by_another_user_is_404(
    client, auth_headers, monkeypatch
):
    """F-10 clause (b) — the ``threads`` anchor read's owner filter, in isolation.

    The ``workflow_runs`` row IS the caller's here and the anchor DOES equal the id, so
    clauses (a) and (c) both pass; only ``.eq("user_id", …)`` on the ``threads`` read
    refuses. Without it the anchor of a thread the caller does not own would confirm a
    cancel.
    """
    sb, wf_id, _tid = _anchored_world(thread_owner=_OTHER)
    _spies(monkeypatch, _FetchPool([]))
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"


def test_v03_non_anchor_workflow_run_id_is_404(client, auth_headers, monkeypatch):
    """V-03 / F-10 clause (c) — owned by the caller but NOT the thread's live anchor.

    Both owner filters pass here; only the equality check refuses. Only a thread's
    CURRENT workflow run may be stopped through this door — a stale id from a previous
    run of the same thread must not reach the cancel path.
    """
    sb, wf_id, _tid = _anchored_world(anchor=str(uuid4()))
    _spies(monkeypatch, _FetchPool([]))
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"


def test_v02_realistic_cross_user_world_is_also_404(
    client, auth_headers, monkeypatch
):
    """The REALISTIC cross-user world — run AND thread both owned by the victim → 404.

    ⚠ LABELLED AS COVERING BOTH (a) AND (b) RATHER THAN EITHER. This is the shape an
    attacker can actually reach today, and it is exactly why it CANNOT isolate a clause:
    delete (a) and (b) still refuses; delete (b) and (a) still refuses. It is driven
    because it is the real threat, and the two isolating cases above exist because this
    one alone would let a plant on either clause ship GREEN.
    """
    sb, wf_id, _tid = _anchored_world(wf_owner=_OTHER, thread_owner=_OTHER)
    _spies(monkeypatch, _FetchPool([]))
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"


def test_the_dual_id_404_is_byte_identical_to_the_shipped_doesnt_exist_404(
    client, auth_headers, monkeypatch
):
    """V-02's honesty half — *not yours* and *doesn't exist* produce the SAME response.

    Both bodies are compared, not only both statuses. A collapsed 404 that carried a
    distinguishing detail would still leak existence, and this is the one property the
    two shipped fallbacks on this prefix were reviewed for (T-062-01 / D-062-12).
    """
    # (1) the shipped "doesn't exist": nothing seeded anywhere.
    empty = _FilteringSupabase(runs=[], workflow_runs=[], threads=[])
    _spies(monkeypatch, _FetchPool([]))
    _install(empty, _CancelFakeRedis(), monkeypatch)
    try:
        missing = client.delete(f"/runs/{uuid4()}", headers=auth_headers)
    finally:
        _uninstall()

    # (2) "not yours": a real workflow run, owned by somebody else.
    sb, wf_id, _tid = _anchored_world(wf_owner=_OTHER, thread_owner=_OTHER)
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        not_mine = client.delete(f"/runs/{wf_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert missing.status_code == not_mine.status_code == 404
    assert missing.json() == not_mine.json(), (
        "'not yours' and 'doesn't exist' must be INDISTINGUISHABLE; got "
        f"{missing.json()!r} vs {not_mine.json()!r}"
    )


# ── The Deep path stays byte-identical: BRANCH, never replace (D-08) ──────────

def test_the_producer_id_path_never_enters_the_fallback(
    client, auth_headers, monkeypatch
):
    """A producer ``runs.run_id`` behaves exactly as before — the fallback never runs.

    Asserted two ways, because either alone is weak: the shared writer receives the id
    the client sent (unrebound), AND the ``workflow_runs`` table is never selected at
    all. The second is what proves the Step-1 SELECT still comes FIRST and short-
    circuits — "BRANCH, never replace" (D-08), the rule the ask_user fallback states
    verbatim at ``runs.py:549-552``.
    """
    run_id = uuid4()
    thread_id = str(uuid4())
    sb = _FilteringSupabase(
        runs=[{
            "run_id": str(run_id), "user_id": _ME,
            "status": "streaming", "thread_id": thread_id,
        }],
        workflow_runs=[],
        threads=[],
    )
    pool = _FetchPool([])
    producer_spy, workflow_spy = _spies(monkeypatch, pool)
    _install(sb, _CancelFakeRedis(), monkeypatch)
    try:
        res = client.delete(f"/runs/{run_id}", headers=auth_headers)
    finally:
        _uninstall()

    assert res.status_code == 204
    assert producer_spy.await_count == 1
    assert str(producer_spy.await_args.kwargs["run_id"]) == str(run_id), (
        "the Deep path must pass the id the client sent, unrebound"
    )
    assert producer_spy.await_args.kwargs["status"] == "streaming"
    assert "workflow_runs" not in sb.selected, (
        "the fallback must engage only AFTER the Step-1 runs SELECT misses; it queried "
        f"{sb.selected}"
    )
    assert pool.fetched == [], "no forward resolution may run on the Deep path"
    assert workflow_spy.await_count == 0


# ── T-194-11-05: the path parameter's typing was NOT relaxed ──────────────────

def test_the_run_id_path_param_is_still_uuid_typed(client, auth_headers):
    """T-194-11-05 — ``run_id: UUID`` is intact and BOTH id spaces are bare uuids.

    ⚠ THIS IS WHERE THE q5r CROSS-TENANT NEAR-MISS LIVED: a ``UUID``-typed parameter
    against a path-shaped id the producer actually mints. Accepting a second id space
    is only safe because both spaces are bare uuid columns (``runs.run_id`` and
    ``workflow_runs.id``), so no widening of the annotation was needed — and a one-line
    assertion now is cheaper than rediscovering that. Asserted on the live signature
    AND on the wire, so neither a relaxed annotation nor a lost validator can pass.
    """
    import inspect

    from app.api.runs import cancel_run

    annotation = inspect.signature(cancel_run).parameters["run_id"].annotation
    assert annotation is UUID, (
        f"run_id must stay UUID-typed; it is annotated {annotation!r}"
    )
    # and the validator is live on the wire — a path-shaped id is refused, not resolved
    res = client.delete("/runs/some/path/shaped-id", headers=auth_headers)
    assert res.status_code in (404, 422), (
        f"a non-uuid path must never resolve to a run; got {res.status_code}"
    )
    res2 = client.delete("/runs/not-a-uuid", headers=auth_headers)
    assert res2.status_code == 422, (
        f"a non-uuid run_id must be rejected by validation; got {res2.status_code}"
    )


def test_no_403_anywhere_on_the_runs_module(client, auth_headers):
    """The whole ``/runs`` module answers 404, never 403 — including the new arms.

    Scoped over the module SOURCE on purpose here (unlike the value-scoped fences
    above): the property is the ABSENCE of a status constant, so any occurrence at all —
    in a branch or in prose claiming one — is the thing worth failing on.
    """
    src = (_REPO / "backend/app/api/runs.py").read_text(encoding="utf-8")
    assert "HTTP_403" not in src, (
        "the /runs module must never answer 403 — one collapsed 404 covers both "
        "'doesn't exist' and 'not yours' (T-062-01 / D-062-12)"
    )
