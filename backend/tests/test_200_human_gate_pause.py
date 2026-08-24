"""Phase 200 Plan 03 — D-10: an unanswered human gate PAUSES the run, never approves it.

`BUG-260816-06`, measured: `HumanInputConfig.timeout_seconds` defaults to **300**
(`models/harness.py:135`), the executor initialised `answer = ""` and assigned it ONLY
inside the `kind == "response"` branch, so the timeout path fell straight through to a
normal completion. `_run_phase_with_gates` wrapped that as `PhaseOutcome("completed", …)`,
`run_workflow` called `complete_phase`, and the next phase received `""` AS THE HUMAN'S
ANSWER. **Four of five real runs of `doc_qa_scoped_098uat` completed their approval step
with `answer: ""` at exactly the five-minute mark.**

Modelled on `test_096_askuser_cleanup.py` — same role (a unit test over `harness_engine`'s
terminal/pause arms), same fakes (`_NoopRedis` + the conftest `mock_asyncpg_pool` SQL-order
recorder), which is itself modelled on `test_harness_resume.py:174-232`.

⚠ **EVERY ASSERTION BELOW IS MAPPED TO A MEASURED FAILURE MODE, NOT TO A PREFERENCE.**
The pause arm is defined as much by what it must NOT do as by what it does:

| Assertion | Because |
|---|---|
| the run reads `paused` | there were **ZERO writers of `'paused'` in the whole backend** before this plan — seven grep hits, all READS |
| the phase is still `active` | `find_resumable_runs` (`db/workflows.py:1251`) REQUIRES an `active` phase row |
| the prompt is NOT expired | a `CancelledError` pause routes into `_expire_pending_ask_user` — killing the very prompt the person must answer |
| `finish_run` is NEVER called | it clears `threads.active_workflow_run_id` in the same transaction (092 SC#2) ⇒ **permanently unresumable** |
| the thread anchor is intact | same; `find_resumable_runs` requires `t.active_workflow_run_id = wr.id` |
| `cancel_phase` is never reached | `harness_engine`'s escape handler calls it for any `CancelledError`, flipping the step to `cancelled` — *a paused run whose spine shows the human step as Stopped* |

⚠ **THE FIVE NEGATIVE ASSERTIONS ARE DRIVEN AGAINST THE REAL ENGINE, NOT AGAINST A
STUB OF IT.** They are read off the SQL the recording pool actually received, so they
cannot pass by the arm never having run — a positive control (`run_paused` was emitted,
and the `paused` UPDATE is present) is asserted alongside every one of them. A negative
fence with no positive control is the `199-03` failure: green because nothing fired.

NO LIVE DB AND NO LIVE REDIS — the operator's dev Postgres and Redis are live and must
not be touched. Everything here is in-memory.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest


class _NoopRedis:
    """Minimal redis stand-in for the engine's _emit XADD (records the frames)."""

    def __init__(self):
        self.frames: list = []

    async def xadd(self, key, fields, **kwargs):
        # ``**kwargs`` absorbs the engine's ``maxlen``/``approximate`` trim arguments —
        # a narrower signature TypeErrors inside ``_emit`` and reads as a pause failure.
        self.frames.append((key, fields))
        return "0-0"


def _sql_calls(pool):
    return [str(sql) for sql, _args in pool.calls]


def _any(pool, needle):
    return any(needle in sql for sql in _sql_calls(pool))


def _phase_rows(phase_id):
    return [
        {"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}
    ]


def _emitted(redis):
    """The event types the engine emitted, in order (the payload is a jsonb blob)."""
    import json

    out = []
    for _key, fields in redis.frames:
        raw = fields.get("data") if isinstance(fields, dict) else None
        if not raw:
            continue
        try:
            out.append(json.loads(raw).get("type"))
        except (ValueError, TypeError):
            pass
    return out


async def _drive_pause(monkeypatch, pool, redis, build_workflow_definition):
    """Drive the REAL `run_workflow` with the human gate timing out."""
    from app.services import harness_engine
    from app.services.harness.human_input import HumanInputTimeout

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_human_input", "prompt": "Approve?", "timeout_seconds": 300}
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    # ⚠ THE SECOND QUEUE ENTRY IS LOAD-BEARING AND IS THE REASON A FENCE HERE CAN FIRE
    # AT ALL. `_expire_pending_ask_user` SELECTs the run's pending prompts and INSERTs one
    # expiry row PER ROW RETURNED — so with an empty queue it writes nothing even when it
    # IS reached, and `test_the_pending_prompt_is_not_expired` would pass VACUOUSLY.
    # Measured, not reasoned about: a plant that called `_expire_pending_ask_user` inside
    # the pause arm left that case GREEN until this row was seeded, and RED afterwards.
    # A fence that cannot fire is the `199-03` failure, and this is where it hid.
    pool.set_fetch_results([
        _phase_rows(phase_id),                                        # load_run_phases
        [{"tool_call_id": "tc-live", "user_id": uuid.uuid4()}],       # a LIVE pending prompt
    ])

    # The executor is driven for real up to its block primitive; only the block itself
    # is faked, so the raise under test is the SHIPPED raise.
    async def _timeout(redis_, run_id_, tool_call_id, timeout_seconds):
        return None

    from app.services.harness import human_input

    monkeypatch.setattr(human_input, "subscribe_for_response", _timeout)

    ctx = SimpleNamespace(
        run_id=run_id,
        producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        supabase=None,
        pool=pool,
        redis=redis,
        emit=harness_engine._emit,
        current_user={"id": str(uuid.uuid4())},
        retry_feedback=None,
        inputs={},
    )
    await harness_engine.run_workflow(run_id, wf, ctx, pool=pool, redis=redis)
    return run_id, phase_id, HumanInputTimeout


# ═══════════════════════════════════════════════════════════════════════════
# The six assertions
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_run_reads_paused(monkeypatch, mock_asyncpg_pool, build_workflow_definition):
    """ASSERTION 1 — the run is written `paused`.

    ⚠ This is the FIRST WRITE OF `workflow_runs.status = 'paused'` IN THE PROJECT'S
    HISTORY. `grep -rn "'paused'" backend/app --include=*.py` returned seven hits before
    this plan and every one was a READ: the delete-cascade in-flight sweep, the lock
    banner, `find_resumable_runs`, and the claim/lease predicates. The literal has been
    admitted by `workflow_runs_status_check` since migration 057 and nothing ever wrote
    it — so there is no prior behaviour to regress, only a gap to close.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    paused = [s for s in _sql_calls(mock_asyncpg_pool)
              if "UPDATE workflow_runs SET status = 'paused'" in s]
    assert len(paused) == 1, "exactly one paused write"
    # The guard that stops it resurrecting a terminal run travels WITH the write.
    assert "status NOT IN ('completed', 'failed', 'cancelled')" in paused[0]
    # Positive control: the frame the client sees was emitted too.
    assert "run_paused" in _emitted(redis)


@pytest.mark.asyncio
async def test_the_phase_is_left_active(monkeypatch, mock_asyncpg_pool, build_workflow_definition):
    """ASSERTION 2 — no terminal `workflow_phases` write happens at all.

    `find_resumable_runs` requires a `status='active'` phase row, and `mark_phase_active`
    already wrote one before the body ran. **The ABSENCE of a phase write IS the
    mechanism**, which is why this asserts absence with the `mark_phase_active` write as
    its positive control — otherwise the case would pass on an engine that never started
    the phase.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    sqls = _sql_calls(mock_asyncpg_pool)
    # Positive control: the phase really was made active.
    assert any("UPDATE workflow_phases SET status='active'" in s for s in sqls)
    for terminal in ("status='completed'", "status='failed'", "status='cancelled'",
                     "status='skipped'", "status='recorded_not_sent'"):
        assert not any("UPDATE workflow_phases SET " + terminal in s for s in sqls), (
            f"the pause arm must write NO terminal phase status; found {terminal}"
        )


@pytest.mark.asyncio
async def test_the_pending_prompt_is_not_expired(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """ASSERTION 3 — the durable prompt survives the pause.

    `_expire_pending_ask_user` INSERTs a system message shaped like an
    `ask_user_response` carrying `expired: true`, which the `/pending` NOT-EXISTS
    correlation then excludes — i.e. it makes the question unanswerable. It is reached
    from the escape handler on any `CancelledError` and from every terminal arm. A pause
    reaches NEITHER, and that is what this measures: zero expiry INSERTs.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    expiries = []
    for sql, args in mock_asyncpg_pool.calls:
        if "INSERT INTO messages" not in str(sql):
            continue
        for a in args:
            if isinstance(a, list) and a and isinstance(a[0], dict) \
                    and a[0].get("kind") == "ask_user_response":
                expiries.append(a[0])
    assert expiries == [], "a pause must never expire the prompt it is waiting on"
    assert "run_paused" in _emitted(redis)  # positive control


@pytest.mark.asyncio
async def test_finish_run_is_never_called(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """ASSERTION 4 — `finish_run` is not reached.

    ⚠ Its guard would ACCEPT a `'paused'` write, which is exactly why this is asserted
    rather than assumed: reusing it is a plausible-looking implementation. It clears
    `threads.active_workflow_run_id` IN THE SAME TRANSACTION, and `find_resumable_runs`
    requires that anchor — so a pause routed through `finish_run` would be **permanently
    unresumable**, and the boot sweep would find nothing, forever.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    # finish_run's own UPDATE carries the terminal-guard predicate verbatim.
    assert not _any(mock_asyncpg_pool, "status NOT IN ('completed', 'failed', 'cancelled') "), (
        "finish_run's transactional UPDATE must not appear on the pause path"
    )
    assert not any(
        "UPDATE workflow_runs SET status = $2" in s for s in _sql_calls(mock_asyncpg_pool)
    ), "finish_run was called on the pause path"
    assert "run_paused" in _emitted(redis)  # positive control


@pytest.mark.asyncio
async def test_the_thread_anchor_is_intact(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """ASSERTION 5 — `threads.active_workflow_run_id` is never NULLed.

    The anchor is what makes a paused run FINDABLE again: `find_resumable_runs` joins on
    `t.active_workflow_run_id = wr.id`. Asserted separately from assertion 4 because the
    anchor clear is `finish_run`'s SECOND statement — a future refactor could reach it
    without going through the first.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    assert not _any(mock_asyncpg_pool, "SET active_workflow_run_id = NULL"), (
        "the pause must leave the thread anchor pointing at this run"
    )
    assert "run_paused" in _emitted(redis)  # positive control


@pytest.mark.asyncio
async def test_cancel_phase_is_never_reached(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """ASSERTION 6 — nothing is written as a cancellation.

    `run_workflow`'s escape handler calls `cancel_phase` for any `CancelledError`, and
    `cancel_active_phases` is the engineless arm of the same idea. **A paused run whose
    spine shows the human step as *Stopped* is the warning sign** — it is a persisted,
    user-visible false statement about what happened, produced by a fix for user-visible
    false statements. This is why `HumanInputTimeout` is deliberately NOT a
    `CancelledError`.
    """
    redis = _NoopRedis()
    await _drive_pause(monkeypatch, mock_asyncpg_pool, redis, build_workflow_definition)

    assert not any("status='cancelled'" in s for s in _sql_calls(mock_asyncpg_pool))
    assert "run_paused" in _emitted(redis)  # positive control


# ═══════════════════════════════════════════════════════════════════════════
# The kind vocabulary + the arm's three prohibitions, read off the source
# ═══════════════════════════════════════════════════════════════════════════


def test_the_pause_kind_is_declared_in_the_vocabulary_block():
    """`PhaseOutcome`'s comment block IS the kind vocabulary.

    A kind added without a line there is a kind nobody can discover — the block is how
    the next author learns the outcome exists at all. Asserted over the source between
    the block's first line and the `namedtuple`, so a line added ANYWHERE else in the
    module cannot satisfy it.
    """
    import inspect

    from app.services import harness_engine

    src = inspect.getsource(harness_engine)
    head, _, rest = src.partition("# The outcome of running a phase through its bounded-retry gate loop.")
    block, _, _ = rest.partition("PhaseOutcome = namedtuple(")
    assert block, "the kind vocabulary block was not found"
    for kind in ("completed", "skip_to", "fail_run", "pause_run"):
        assert f'kind == "{kind}"' in block, f"{kind} missing from the kind vocabulary"


def test_the_pause_arm_does_none_of_the_three_forbidden_things():
    """The arm's body carries no `CancelledError`, `finish_run`, `cancel_phase` or expiry.

    A source-scoped fence, deliberately: the driven cases above prove the arm does not
    REACH those calls on this input, and this proves the calls are not WRITTEN there at
    all — so a future branch inside the arm cannot reintroduce one on an input no case
    covers. Scoped to the arm's own body (from its `if` to its `return`), never to the
    module, whose other arms legitimately call all four.
    """
    import inspect

    from app.services import harness_engine

    src = inspect.getsource(harness_engine)
    start = src.index('if outcome.kind == "pause_run":')
    end = src.index("# ── fail_run:", start)
    arm = src[start:end]
    assert "pause_run(pool, run_id)" in arm  # positive control: the arm is non-empty
    for forbidden in ("CancelledError", "finish_run(", "cancel_phase(",
                      "_expire_pending_ask_user("):
        assert forbidden not in arm, f"FORBIDDEN in the pause arm: {forbidden}"


def test_write_lands_before_emit_in_the_pause_arm():
    """WRITE-before-EMIT — never announce a fact the database does not yet carry.

    T-200-03-02 (Repudiation): the pause must be a durable record, not a UI state. The
    ordering is read off the arm's source so it survives a refactor that keeps both calls
    but swaps them.
    """
    import inspect

    from app.services import harness_engine

    src = inspect.getsource(harness_engine)
    start = src.index('if outcome.kind == "pause_run":')
    end = src.index("# ── fail_run:", start)
    arm = src[start:end]
    assert arm.index("pause_run(pool, run_id)") < arm.index("write_audit(")
    assert arm.index("write_audit(") < arm.index('"run_paused"')


def test_no_twenty_fifth_audit_kind_was_added():
    """The audit row reuses `policy_applied` — no migration ships with this plan.

    ⚠ RECORDED AS A FENCE, NOT LEFT AS A COMMENT. `_AUDIT_EVENT_TYPES` must stay in
    LOCKSTEP with the `harness_audit.event_type` Postgres CHECK
    (`tests/unit/test_audit_event_registration.py` pins them EQUAL in BOTH directions),
    so a `run_paused` KIND would be migration 122 plus a live-DB apply — and this plan
    ships no migration (121 belongs to `200-02`, which runs alone against real Postgres).
    Registering it in code alone would MOVE the failure from a fast ValueError to a
    Postgres 23514 mid-run, which is precisely what that set exists to prevent
    (BUG-260731-02). `policy_applied` is Phase 196's recorded precedent for this exact
    situation, and `metadata.policy` names the event so the ledger row is unambiguous.
    """
    from app.db.workflows import _AUDIT_EVENT_TYPES

    assert "run_paused" not in _AUDIT_EVENT_TYPES
    assert len(_AUDIT_EVENT_TYPES) == 24
    assert "policy_applied" in _AUDIT_EVENT_TYPES


# ═══════════════════════════════════════════════════════════════════════════
# Task 4 — the ANSWER-TRIGGERED RE-DRIVE
#
# ⚠ WHICH HALF IS PROVED HERE, STATED PLAINLY. These cases prove the WIRING: that
# `submit_ask_user_response`'s new Step 5 engages for a `paused` run and for nothing
# else, that it flips the run off `paused` before driving, that it refuses a golden run,
# and that the executor CONSUMES the durable answer instead of re-asking. **The PROMISE
# — "walk away past 300s, come back, answer, and the run resumes without a restart" — is
# proved only by the driven UAT row recorded in `200-VALIDATION.md`.** No automated path
# here drives real Redis pub/sub plus a real engine re-drive; saying otherwise would be
# the "another row's evidence is not this row's" mistake.
# ═══════════════════════════════════════════════════════════════════════════


class _RedriveFakePool:
    """Records SQL and serves the one row the re-drive's SELECT asks for."""

    def __init__(self, row):
        self.row = row
        self.calls: list = []
        self.claimed = True

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql and "wr.status = 'paused'" in sql:
            return self.row
        if "SET claimed_at = now()" in sql:
            return {"id": args[0]} if self.claimed else None
        return None

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return None


def _sqls(pool):
    return [str(s) for s, _a in pool.calls]


def _paused_row(**over):
    row = {
        "run_id": uuid.uuid4(),
        "thread_id": uuid.uuid4(),
        "current_phase_id": uuid.uuid4(),
        "inputs": {},
        "org_id": None,
        "is_golden_run": False,
        "user_id": uuid.uuid4(),
    }
    row.update(over)
    return row


async def _run_redrive(monkeypatch, *, row):
    """Drive the REAL `_redrive_paused_workflow_run` with its edges faked."""
    import asyncio as _asyncio

    from app.api import runs as runs_api

    pool = _RedriveFakePool(row)
    spawned: list = []

    async def _fake_get_pool():
        return pool

    async def _fake_load_def(_pool, _run_id):
        return object()

    async def _fake_build_ctx(_row, _redis, _pool):
        return SimpleNamespace(producer_run_id=None)

    async def _fake_resume(run_id, defn, ctx, *, pool, redis):
        spawned.append((run_id, ctx))

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition", _fake_load_def)
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _fake_build_ctx)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _fake_resume)

    ok = await runs_api._redrive_paused_workflow_run(
        row["run_id"] if row else uuid.uuid4(), "tc-answered", _NoopRedis()
    )
    for _ in range(5):
        await _asyncio.sleep(0)  # let the spawned task run before asserting
    return ok, pool, spawned


@pytest.mark.asyncio
async def test_a_paused_run_is_redriven_exactly_once(monkeypatch):
    """The re-drive fires ONCE for a paused run, and flips it off `paused` first."""
    ok, pool, spawned = await _run_redrive(monkeypatch, row=_paused_row())

    assert ok is True
    assert len(spawned) == 1, "exactly one re-drive"
    resumes = [s for s in _sqls(pool)
               if "UPDATE workflow_runs SET status = 'active'" in s]
    assert len(resumes) == 1
    assert "AND status = 'paused'" in resumes[0], (
        "the resume write must be narrower than the pause write — it may only ever "
        "move a run OUT of the one state pause_run put it in"
    )
    # The re-drive carries the answered prompt id, or the executor would re-ask.
    assert spawned[0][1].resume_answered_tool_call_id == "tc-answered"


@pytest.mark.asyncio
async def test_an_unpaused_run_is_never_redriven(monkeypatch):
    """ZERO re-drives when the SELECT finds no paused row.

    The negative half of the case above, and the one that matters: the predicate is what
    keeps this route from spawning a second producer for a run that already has one.
    """
    ok, pool, spawned = await _run_redrive(monkeypatch, row=None)

    assert ok is False
    assert spawned == []
    assert not any("UPDATE workflow_runs SET status = 'active'" in s for s in _sqls(pool))


@pytest.mark.asyncio
async def test_the_claim_is_a_real_cas_so_two_answers_drive_once(monkeypatch):
    """A lost `claim_run` CAS means NO re-drive — the anti-double-drive.

    ⚠ This route and the boot sweep can both reach the same run. `claim_run` stamps the
    migration-062 `claimed_at` lease and matches only when it is unset or expired, so the
    loser sees a fresh stamp, gets 0 rows and skips. Without it, an answer landing while
    the boot sweep re-drove the same run would produce TWO producers on one run —
    Pitfall 7, the exact double-execution the lease exists to prevent.
    """
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    pool.claimed = False  # a racing sibling already holds the lease
    spawned: list = []

    async def _fake_get_pool():
        return pool

    async def _fake_resume(run_id, defn, ctx, *, pool, redis):
        spawned.append(run_id)

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pool)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _fake_resume)

    ok = await runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis())

    assert ok is False
    assert spawned == []
    assert not any("UPDATE workflow_runs SET status = 'active'" in s for s in _sqls(pool))


def test_a_golden_run_can_never_be_woken_by_an_answer():
    """⚠ A SECURITY PROPERTY, NOT HOUSEKEEPING — asserted over the predicate itself.

    `find_resumable_runs` excludes golden runs because re-driving a publish validation
    would PERFORM its external action with nobody asked (Phase 190 / A4). This route is a
    SECOND door onto the same re-drive, so it carries the same clause — and it is
    asserted over the SQL rather than driven, because a driven case would only prove the
    fake row this test wrote is not golden, never that the predicate is present at all.
    """
    import inspect

    from app.api import runs as runs_api

    src = inspect.getsource(runs_api._redrive_paused_workflow_run)
    assert "wr.is_golden_run = false" in src
    assert "wr.status = 'paused'" in src
    assert "t.active_workflow_run_id = wr.id" in src


def test_the_redrive_engages_only_after_the_shipped_paths():
    """BRANCH, never replace — Step 1's ownership SELECT is untouched and still first.

    The re-drive is gated on `_origin == "harness"`, which is set ONLY inside the F10
    fallback's owner-scoped, anchor-confirmed branch. A Deep answer therefore cannot
    reach it, and the shipped ask_user path is byte-identical.
    """
    import inspect

    from app.api import runs as runs_api

    src = inspect.getsource(runs_api.submit_ask_user_response)
    assert "_redrive_paused_workflow_run(" in src  # positive control
    gate = src.index('if _origin == "harness":')
    assert gate < src.index("_redrive_paused_workflow_run(run_id")
    # Persist first, then publish, then wake — the shipped order, extended not reordered.
    assert src.index('.table("runs")') < gate
    assert src.index("publish_response") < gate


@pytest.mark.asyncio
async def test_the_executor_consumes_the_durable_answer_instead_of_re_asking():
    """⚠ THE HALF THAT MAKES D-10's SENTENCE TRUE RATHER THAN MERELY SURVIVABLE.

    `resume_stranded_workflows`' docstring already claimed that an already-answered
    ask_user phase would *"re-run the phase, which re-reads the durable answer and
    proceeds"*. **Nothing re-read it.** `_exec_llm_human_input` mints a fresh
    `uuid4().hex` on every entry, so a re-driven phase inserts a SECOND prompt row and
    blocks again — from the person's chair, their answer vanishes and the question comes
    back. This is the re-read, keyed to the tool_call_id the ANSWER ROUTE persisted so it
    can only ever resolve the question that was actually answered.
    """
    from unittest.mock import AsyncMock, patch

    from app.models.harness import PhaseSpec
    from app.services.harness import human_input

    reads: list = []

    async def _fake_get_answer(pool, run_id, tool_call_id):
        reads.append(tool_call_id)
        return {"response_text": "", "choice_index": 1}

    async def _must_not_be_called(*a, **k):
        raise AssertionError("a re-drive must NOT re-subscribe — the answer is durable")

    phase = PhaseSpec.model_validate({
        "slug": "p0", "phase_index": 0,
        "config": {"phase_type": "llm_human_input", "prompt": "Approve?",
                   "options": ["Reject", "Approve"], "timeout_seconds": 300},
    })
    ctx = SimpleNamespace(
        run_id=uuid.uuid4(), producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()), supabase=None, pool=object(),
        redis=_NoopRedis(), emit=AsyncMock(),
        current_user={"id": str(uuid.uuid4())},
        resume_answered_tool_call_id="tc-answered",
    )

    with patch("app.db.workflows.get_ask_user_response", _fake_get_answer), \
            patch.object(human_input, "subscribe_for_response", _must_not_be_called):
        out = await human_input._exec_llm_human_input(phase, {}, ctx)

    assert reads == ["tc-answered"], "the read is keyed to the answered prompt"
    # The choice-click resolution survives the resume path (BUG-260607-01).
    assert out["answer"] == "Approve"
    assert out["tool_call_id"] == "tc-answered", "the SAME prompt, never a new one"
    # ⚠ SINGLE-USE: cleared, so a SECOND human phase in this run asks its own question
    # rather than inheriting this answer — which would be the silent auto-approval this
    # whole plan removes, re-introduced by a convenience.
    assert ctx.resume_answered_tool_call_id is None


@pytest.mark.asyncio
async def test_without_the_flag_the_executor_takes_the_shipped_ask_path():
    """No flag ⇒ no consume ⇒ the shipped ask path, unchanged.

    The boot sweep does NOT set the flag, so this is also the proof that the 096-09
    restart contract is untouched: `resume_pending_prompt` still re-subscribes and
    re-emits the SAME prompt there, exactly as it did.
    """
    from unittest.mock import AsyncMock, patch

    from app.models.harness import PhaseSpec
    from app.services.harness import human_input

    reads: list = []

    async def _fake_get_answer(pool, run_id, tool_call_id):
        reads.append(tool_call_id)
        return {"response_text": "Approve", "choice_index": None}

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
        return {"kind": "response", "response_text": "live", "choice_index": None}

    phase = PhaseSpec.model_validate({
        "slug": "p0", "phase_index": 0,
        "config": {"phase_type": "llm_human_input", "prompt": "Approve?",
                   "timeout_seconds": 300},
    })
    ctx = SimpleNamespace(
        run_id=uuid.uuid4(), producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()), supabase=None, pool=object(),
        redis=_NoopRedis(), emit=AsyncMock(),
        current_user={"id": str(uuid.uuid4())},
    )

    with patch("app.db.workflows.get_ask_user_response", _fake_get_answer), \
            patch.object(human_input, "subscribe_for_response", _fake_subscribe):
        out = await human_input._exec_llm_human_input(phase, {}, ctx)

    assert reads == [], "no flag ⇒ the durable answer is never consulted"
    assert out["answer"] == "live", "the live subscribe path is what answered"
