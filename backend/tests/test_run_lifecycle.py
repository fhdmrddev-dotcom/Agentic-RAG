"""Phase 145 Plan 02 (FND-01 / D-145-02 / D-145-09) — atomic run-lifecycle co-writer tests.

Proves the TWO load-bearing behaviors of the anti-drift owner
(``backend/app/services/run_lifecycle.py``) — the single module that co-writes
Postgres ``runs.status`` and its derived ``runs:active`` mirror together, so the
mirror can never drift from the truth (the drift that lives in ``threads.py`` today,
where the ZADD/ZREM run in different code paths than the status writes):

  1. ``test_register_cowrites_status_and_active``: ONE ``register_run_start`` call
     fires the status write (``db.runs.insert_run`` → ``pool.execute`` INSERT with
     ``status='streaming'``) AND the ``ZADD runs:active`` mirror AND the
     ``ZADD runs_by_thread:{tid}`` mirror — all for the SAME ``run_id``.
  2. ``test_finalize_cowrites_terminal_and_zrem``: ONE ``finalize_run_terminal`` call
     fires the terminal status write (``db.runs.finalize_run`` → ``pool.execute``
     UPDATE with ``status='completed'``) AND the ``ZREM runs:active`` +
     ``ZREM runs_by_thread:{tid}`` mirror removals — same ``run_id``, one call.

No live DB / no live Redis: the ``pool`` is an in-memory ``_FakePool`` honoring
``execute`` (recording ``(sql, params)`` per DB write), and ``redis`` is an in-memory
``_FakeRedis`` honoring ``zadd``/``zrem`` and distinguishing the ``runs:active`` set
from the ``runs_by_thread:*`` sets — mirroring the fakes in
``backend/tests/test_run_reconciler.py`` (the existing analog), extended with the
``zadd`` recorder the reconciler fake lacks.

⚠ EXTENDED BY PHASE 194 PLAN 09 (RUN-01 / SC#2) — the SCOPE fences. Everything above
shipped in Phase 145 and is byte-untouched. The cases appended at the bottom pin the
four boundaries the zombie arm's new workflow co-write must not cross: the Deep path
stays byte-identical, the app-shutdown gate's scope is pinned on BOTH arms, a Redis
outage still cannot fail a Stop, and the ask_user cancel sentinel is still published
before ``task.cancel()``.

⚠ THESE CASES SEED NOTHING IN ANY DATABASE — every pool is a fake, every writer is
patched, and no supabase call leaves the process. That is what keeps this suite
parallel-safe under CLAUDE.md's rule 4.
"""
import ast
import pathlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from redis.exceptions import RedisError

from app.services.run_lifecycle import finalize_run_terminal, register_run_start


# ── A tiny asyncpg.Pool stand-in — execute() records the status write ──────────────
class _FakePool:
    """Records every ``pool.execute(sql, *params)`` the shared writers issue, so a test
    can assert the status INSERT/UPDATE fired with the right positional bindings
    (``insert_run``/``finalize_run`` bind ``run_id`` as $1)."""

    def __init__(self):
        self.executed: list[tuple] = []   # (sql, params) recorded per insert_run/finalize_run

    async def execute(self, sql, *params):
        self.executed.append((sql, params))
        return None


# ── A tiny in-memory async fake Redis (runs:active + runs_by_thread membership) ─────
class _FakeRedis:
    """In-memory sorted-set doubles for the two mirrors the owner co-writes. ``zadd``
    (the recorder the reconciler fake lacks) and ``zrem`` route to ``self.active`` for
    the ``runs:active`` key, else to a per-``runs_by_thread:{tid}`` bucket. Async so
    ``await redis.<op>(...)`` works."""

    def __init__(self, *, active=None, by_thread=None):
        # runs:active membership {run_id_str: score}. Presence == genuinely streaming.
        self.active = {str(k): v for k, v in (active or {}).items()}
        # per-thread buckets {"runs_by_thread:{tid}": {run_id_str: score}}
        self.by_thread = {k: dict(v) for k, v in (by_thread or {}).items()}

    def _bucket(self, key):
        if key == "runs:active":
            return self.active
        return self.by_thread.setdefault(key, {})

    async def zadd(self, key, mapping, *a, **k):
        z = self._bucket(key)
        z.update({str(m): s for m, s in mapping.items()})
        return len(mapping)

    async def zrem(self, key, *members):
        z = self._bucket(key)
        n = 0
        for m in members:
            if z.pop(str(m), None) is not None:
                n += 1
        return n


class _FailingZaddRedis(_FakeRedis):
    """A redis double whose ``zadd`` ALWAYS raises — to prove the mirror write is
    best-effort (CR-01). ``zrem`` is inherited unchanged; only the START ZADD path is
    exercised here."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.zadd_attempts = 0

    async def zadd(self, key, mapping, *a, **k):
        self.zadd_attempts += 1
        raise ConnectionError("simulated transient Redis failure")


@pytest.mark.asyncio
async def test_register_run_start_mirror_zadd_failure_is_best_effort():
    """CR-01 (Phase 145 review): a transient ``redis.zadd`` failure AFTER the
    authoritative Postgres INSERT must NOT propagate. ``runs:active`` is a DERIVED
    mirror (D-145-01) — a mirror blip is best-effort, never fatal, so the run stays
    ``streaming`` in Postgres and the send is never turned into a 500 / ``failed`` run.
    Pre-fix, the un-wrapped ZADD raised straight out of ``register_run_start`` →
    spawn-failure → user-facing 500."""
    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()
    pool = _FakePool()
    redis = _FailingZaddRedis()

    # Must NOT raise despite the ZADD failure (the whole point of CR-01).
    await register_run_start(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        model="gpt-x",
        provider="openai",
    )

    # The authoritative status write still fired with status='streaming'.
    assert len(pool.executed) == 1
    sql, params = pool.executed[-1]
    assert "INSERT INTO runs" in sql
    assert params[0] == run_id
    assert params[3] == "streaming"
    # The mirror ZADD was ATTEMPTED (and raised) — proving best-effort swallow, not skip.
    assert redis.zadd_attempts >= 1


@pytest.mark.asyncio
async def test_register_cowrites_status_and_active():
    """ONE register_run_start → insert_run(status='streaming') AND ZADD runs:active AND
    ZADD runs_by_thread — all for the SAME run_id (the atomic START co-write, D-145-02)."""
    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()
    pool = _FakePool()
    redis = _FakeRedis()

    n_before = len(pool.executed)
    await register_run_start(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        model="gpt-x",
        provider="openai",
    )

    # (1) the status write fired: insert_run → pool.execute INSERT, status='streaming'.
    # insert_run binds (run_id $1, thread_id $2, user_id $3, status $4, ...) — db/runs.py:52-66.
    assert len(pool.executed) == n_before + 1
    sql, params = pool.executed[-1]
    assert "INSERT INTO runs" in sql
    assert params[0] == run_id
    assert params[3] == "streaming"
    # (2) the runs:active mirror gained the SAME run_id ...
    assert str(run_id) in redis.active
    # (3) ... AND the runs_by_thread mirror gained it — all in the one call.
    assert str(run_id) in redis.by_thread[f"runs_by_thread:{thread_id}"]


@pytest.mark.asyncio
async def test_finalize_cowrites_terminal_and_zrem():
    """ONE finalize_run_terminal → finalize_run(status=terminal) AND ZREM runs:active AND
    ZREM runs_by_thread — same run_id, one call (the atomic TERMINAL co-write, D-145-02)."""
    run_id = uuid4()
    thread_id = uuid4()
    tkey = f"runs_by_thread:{thread_id}"
    # Pre-seed the run as LIVE in BOTH mirrors (as register_run_start would have left it).
    redis = _FakeRedis(active={run_id: 1.0}, by_thread={tkey: {str(run_id): 1.0}})
    pool = _FakePool()

    n_before = len(pool.executed)
    await finalize_run_terminal(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        status="completed",
        error=None,
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )

    # (1) the terminal status write fired: finalize_run → pool.execute UPDATE, status='completed'.
    # finalize_run binds run_id as $1 and status as $2 — db/runs.py:91-101 → params[0], params[1].
    assert len(pool.executed) == n_before + 1
    sql, params = pool.executed[-1]
    assert "UPDATE runs" in sql
    assert params[0] == run_id
    assert params[1] == "completed"
    # (2) the SAME run_id was removed from the runs:active mirror ...
    assert str(run_id) not in redis.active
    # (3) ... AND from the runs_by_thread mirror — one call, both mirrors.
    assert str(run_id) not in redis.by_thread[tkey]


# ══════════════════════════════════════════════════════════════════════════════
# Phase 194 Plan 09 (RUN-01 / SC#2) — the SCOPE fences
# ══════════════════════════════════════════════════════════════════════════════
#
# Everything above this banner shipped in Phase 145 and is byte-untouched.

_RUN_PRODUCER_SRC = (
    pathlib.Path(__file__).resolve().parents[1] / "app/services/run_producer.py"
)


class _CancelFakeRedis:
    """The Step-3b Redis surface (set / exists / expire / zrem / publish), recording.

    ``raising`` makes EVERY op raise ``RedisError`` — the F-11 outage simulation.
    ``exists`` returns 0 by default so the synthetic-sentinel branch is skipped.
    """

    def __init__(self, *, raising=False, exists=0):
        self.raising = raising
        self._exists = exists
        self.calls: list = []

    async def _op(self, name, *a, **k):
        self.calls.append((name, a, k))
        if self.raising:
            raise RedisError(f"simulated Redis outage on {name}")
        return {"exists": self._exists}.get(name, True)

    async def set(self, *a, **k):
        return await self._op("set", *a, **k)

    async def exists(self, *a, **k):
        return await self._op("exists", *a, **k)

    async def expire(self, *a, **k):
        return await self._op("expire", *a, **k)

    async def zrem(self, *a, **k):
        return await self._op("zrem", *a, **k)

    async def publish(self, *a, **k):
        return await self._op("publish", *a, **k)


class _AnchorSupabase:
    """A supabase double returning ``anchor`` for the threads select; no-op on update."""

    def __init__(self, anchor=None):
        self.anchor = anchor
        self.ops: list = []

    def table(self, name):
        return _AnchorSupabase._B(self, name)

    class _B:
        def __init__(self, sb, table):
            self._sb, self._table, self._op = sb, table, None

        def select(self, *a, **k):
            self._op = "select"
            self._sb.ops.append(("select", self._table))
            return self

        def update(self, payload=None, *a, **k):
            self._op = "update"
            self._sb.ops.append(("update", self._table))
            return self

        def eq(self, *a, **k):
            return self

        def maybe_single(self, *a, **k):
            return self

        def execute(self):
            res = MagicMock()
            res.count = None
            res.data = (
                {"active_workflow_run_id": self._sb.anchor}
                if self._op == "select" and self._sb.anchor is not None
                else None
            )
            return res


async def _drive_step_3b(monkeypatch, *, anchor, redis=None):
    """Drive ``_cancel_run_internals``'s zombie arm. Patches every writer; seeds nothing."""
    from app.api.threads import RUN_TASKS
    from app.services.run_lifecycle import _cancel_run_internals

    rid = uuid4()
    RUN_TASKS.pop(rid, None)

    monkeypatch.setattr("app.dependencies._pg_pool", _FakePool())
    fake_finalize = AsyncMock()
    fake_finish = AsyncMock()
    fake_cancel_phases = AsyncMock()
    monkeypatch.setattr(
        "app.services.run_lifecycle.finalize_run_terminal", fake_finalize
    )
    monkeypatch.setattr("app.db.workflows.finish_run", fake_finish)
    monkeypatch.setattr("app.db.workflows.cancel_active_phases", fake_cancel_phases)

    sb = _AnchorSupabase(anchor=anchor)
    out = await _cancel_run_internals(
        run_id=rid,
        status="streaming",
        thread_id=str(uuid4()),
        redis=redis if redis is not None else _CancelFakeRedis(),
        supabase=sb,
    )
    return {
        "out": out,
        "sb": sb,
        "finalize": fake_finalize,
        "finish": fake_finish,
        "phases": fake_cancel_phases,
    }


# ── F-3 / V-11: the Deep path through Step 3b is byte-identical ────────────────

@pytest.mark.asyncio
async def test_deep_run_takes_step_3b_without_entering_the_workflow_branch():
    """V-11 / F-3 — a Deep run (``active_workflow_run_id IS NULL``) is unchanged.

    A Deep run has no workflow at all, so the workflow co-write must not be entered:
    ``finish_run`` and ``cancel_active_phases`` are awaited ZERO times, while every
    shipped arm still fires exactly as it did before 194-09 — ``finalize_run_terminal``
    once, the standalone 092-03 anchor clear once, and the discriminator still
    ``"zombie_healed"``.

    ⚠ THE ``if wf_id:`` GUARD IS THE WHOLE SCOPE, and the zero-counts are the only
    thing that can see it. Without a plant that removes that guard, "the Deep path is
    byte-identical" is a claim rather than a measurement — which is why F-3's plant is
    the SCOPE PROOF, not a formality.
    """
    monkeypatch = pytest.MonkeyPatch()
    try:
        r = await _drive_step_3b(monkeypatch, anchor=None)
    finally:
        monkeypatch.undo()

    assert r["out"] == "zombie_healed"
    assert r["finish"].await_count == 0, (
        "a Deep run has no workflow_runs row — finish_run must not be called "
        f"(awaited {r['finish'].await_count}×)"
    )
    assert r["phases"].await_count == 0, (
        "a Deep run has no workflow_phases rows — cancel_active_phases must not be "
        f"called (awaited {r['phases'].await_count}×)"
    )
    assert r["finalize"].await_count == 1, "the shipped chat-side co-write must still fire"
    assert [o for o in r["sb"].ops if o[0] == "update"], (
        "the shipped standalone 092-03 anchor clear must still fire on the Deep path"
    )


# ── F-4 / V-12: the app-shutdown gate's SCOPE — TWO arms, TWO assertions ───────
#
# ⚠ TWO SEPARATE CASES, NOT ONE COMPOUND ASSERTION, AND THAT IS THE 193.2 LESSON
# APPLIED. A fence asserting only that Step 3b LACKS the gate leaves the other arm —
# that F2 still HAS it — completely undefended, and a phase that broke
# restart-resumability would ship green. Plant (a) reds only arm (a); plant (b) reds
# only arm (b). Neither plant can red the other, which is the evidence they are two
# fences rather than one written twice.

@pytest.mark.asyncio
async def test_step_3b_carries_no_app_shutdown_gate():
    """V-12 arm (a) / F-4a — Step 3b's workflow co-write fires even mid-shutdown.

    ⚠ THE ARGUMENT LIVES HERE SO THE NEXT READER FINDS IT RATHER THAN RE-DERIVING IT,
    AND SO NOBODY "FIXES" THIS FENCE BY ADDING THE GATE. 194-CONTEXT warns that "any
    new terminalize must carry the same gate or it will break restart-resumability."
    That is TRUE of ``run_producer.py``'s F2 block and MEASURABLY FALSE of Step 3b, for
    three independent reasons:

      1. STEP 3b IS ONLY REACHABLE ON EXPLICIT CANCEL INTENT. Its two callers are
         ``DELETE /runs/{id}`` (the owner's Stop) and ``POST /admin/runs/{id}/kill``
         (the operator's). Neither fires during a shutdown. F2's gate exists precisely
         because F2 runs on ANY producer exit, shutdown-induced included.
      2. A SHUTDOWN-AFFECTED RUN CANNOT REACH STEP 3b AT ALL. On graceful shutdown the
         producer still writes ``runs.status='cancelled'`` (only the WORKFLOW half is
         gated), so a subsequent DELETE hits Step 2's ``terminal_noop`` — no writes.
      3. RESUMABILITY IS ALREADY FORFEIT AT STEP 3b. The shipped 092-03 anchor clear
         runs there UNCONDITIONALLY, and ``find_resumable_runs`` requires
         ``t.active_workflow_run_id = wr.id``. Once the anchor is cleared the run is
         unsweepable regardless of its status. Adding the status write cannot remove
         resumability that is already gone — it only stops the row lying about itself.

    The flag is set for real via ``set_app_shutting_down`` and the PRIOR value is
    restored in a ``finally`` — not hard-reset to ``False``.

    ⚠ THAT DISTINCTION IS NOT PEDANTRY: ``_APP_SHUTTING_DOWN`` IS A PROCESS-GLOBAL THAT
    ALREADY LEAKS ACROSS TESTS, measured in this phase rather than assumed. The shared
    ``client`` fixture is ``with TestClient(app) as c:``, so its teardown runs the app
    lifespan's shutdown handler (``app/main.py:511-512``), which sets the flag ``True``
    for the REST of the pytest process. Probed directly: before any client ``False`` →
    during ``False`` → after teardown ``True``. The leak is pre-existing and out of this
    plan's scope, but a fence that hard-reset the flag would silently repair a state
    other suites are running in.
    """
    from app.services.harness_engine import is_app_shutting_down, set_app_shutting_down

    monkeypatch = pytest.MonkeyPatch()
    _prior = is_app_shutting_down()
    set_app_shutting_down(True)
    try:
        r = await _drive_step_3b(monkeypatch, anchor=str(uuid4()))
    finally:
        set_app_shutting_down(_prior)
        monkeypatch.undo()

    assert r["finish"].await_count == 1, (
        "Step 3b must terminalize the workflow run even while the app is shutting "
        "down — a shutdown gate here would be wrong for the three reasons above"
    )
    assert r["phases"].await_count == 1


def test_the_f2_terminalize_still_carries_the_app_shutdown_gate():
    """V-12 arm (b) / F-4b — ``run_producer.py``'s F2 block STILL has its gate.

    096-09 / Phase 096 UAT Test 2: on a GRACEFUL shutdown F2 must NOT terminalize —
    leaving ``workflow_runs`` 'active' with the thread anchor intact is precisely what
    lets the boot-time resume sweep re-claim and re-drive the run. Removing this gate
    would silently terminalize runs the sweep should have resumed, and no other test in
    this repository would notice.

    ⚠ ASSERTED OVER THE AST, NEVER OVER THE RAW SOURCE. A bare grep for the gate's name
    matches the docblocks that EXPLAIN it — including this very module's — so a raw
    needle cannot tell "the gate is present" from "someone wrote about the gate". This
    walks to the ``if`` statement that actually guards the workflow terminalize call and
    asserts the gate appears inside a ``not`` in THAT statement's test expression.
    """
    tree = ast.parse(_RUN_PRODUCER_SRC.read_text(encoding="utf-8"))

    def calls(node, name):
        return any(
            isinstance(n, ast.Call)
            and (
                (isinstance(n.func, ast.Name) and n.func.id == name)
                or (isinstance(n.func, ast.Attribute) and n.func.attr == name)
            )
            for n in ast.walk(node)
        )

    guards = [
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.If)
        and any(calls(b, "_finish_wf") for b in n.body)
    ]
    assert len(guards) == 1, (
        "expected exactly ONE `if` guarding the F2 workflow terminalize; found "
        f"{len(guards)} — the fence has lost its anchor and must be re-scoped, not "
        "trusted (a sweep that matches nothing passes over the empty set)"
    )

    gate_calls = [
        n
        for n in ast.walk(guards[0].test)
        if isinstance(n, ast.UnaryOp)
        and isinstance(n.op, ast.Not)
        and calls(n, "is_app_shutting_down")
    ]
    assert gate_calls, (
        "run_producer.py's F2 terminalize has LOST its app-shutdown gate — 096-09 / "
        "Phase 096 UAT Test 2 restart-resumability is broken. The gate must read "
        "`and not is_app_shutting_down()` inside the same `if` that calls _finish_wf."
    )


# ── F-11: a Redis outage cannot fail a Stop ───────────────────────────────────

@pytest.mark.asyncio
async def test_a_redis_outage_cannot_fail_the_stop():
    """F-11 — with EVERY Redis op raising, the cancel still succeeds (D-062-13).

    "Postgres ``runs.status`` is the durable cancel record": the discriminator is still
    ``"zombie_healed"`` and BOTH Postgres writes still land. A Stop that 500s because a
    cache blipped is a Stop the user has to guess about.

    ⚠ WHICH FORM OF THE PLANT WAS USED, AND WHY — the plan allowed either and asked for
    the choice to be recorded. The plant is the STRUCTURAL one it preferred: the
    ``try/except`` around Step 3b's ``EXPIRE`` is DELETED in production source, so that
    op raises OUTSIDE a try. It was constructible honestly, so the weaker
    everything-inside-its-try form was not needed. ⚠ Note the shipped ``except`` clauses
    on the last three arms catch ``(RedisError, OSError)`` and NOT bare ``Exception`` —
    which is why this fence raises ``RedisError`` specifically. That is a real, narrow
    limit of the shipped contract and it is stated rather than papered over: an
    arbitrary non-Redis exception from a Redis client WOULD escape.
    """
    monkeypatch = pytest.MonkeyPatch()
    try:
        r = await _drive_step_3b(
            monkeypatch, anchor=str(uuid4()), redis=_CancelFakeRedis(raising=True)
        )
    finally:
        monkeypatch.undo()

    assert r["out"] == "zombie_healed", "a Redis outage must not change the outcome"
    assert r["finish"].await_count == 1, "the durable workflow_runs write must still land"
    assert r["phases"].await_count == 1, "the phase terminalize must still land"


# ── F-12: the ask_user cancel sentinel is published BEFORE task.cancel() ──────

@pytest.mark.asyncio
async def test_the_cancel_sentinel_is_published_before_task_cancel(monkeypatch):
    """F-12 / D-085-04 — sentinel publish, THEN ``task.cancel()``, on the happy arm.

    The sentinel goes first so a paused ``_handle_ask_user`` wakes and returns a normal
    ``ToolResult`` before ``CancelledError`` propagates. Reversed, a run stopped while
    waiting at an approval strands the prompt as a submittable-but-dead card.

    ⚠ THIS IS ``BUG-260808-02``'s FOLDED HALF — stopping a run that is waiting at an
    approval — so this fence is the evidence that fold is honoured rather than assumed.
    Asserted by CALL SEQUENCE on the two mocks, never by reading the source.
    """
    from app.api.threads import RUN_TASKS
    from app.services.run_lifecycle import _cancel_run_internals

    order: list[str] = []

    async def _fake_publish(*a, **k):
        order.append("publish_cancel_sentinel")

    monkeypatch.setattr(
        "app.services.ask_user_service.publish_cancel_sentinel", _fake_publish
    )

    rid = uuid4()
    fake_task = MagicMock()
    fake_task.done.return_value = False
    fake_task.cancel.side_effect = lambda *a, **k: order.append("task.cancel")
    RUN_TASKS[rid] = fake_task
    try:
        out = await _cancel_run_internals(
            run_id=rid,
            status="streaming",
            thread_id=str(uuid4()),
            redis=_CancelFakeRedis(),
            supabase=_AnchorSupabase(),
        )
    finally:
        RUN_TASKS.pop(rid, None)

    assert out == "task_cancelled"
    assert order == ["publish_cancel_sentinel", "task.cancel"], (
        f"D-085-04 ordering broken; recorded sequence was {order}"
    )
