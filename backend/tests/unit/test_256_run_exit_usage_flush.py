"""Phase 256 round 1 / CR-01 (SC#1) — EVERY exit from the phase loop persists the
phase that just ran, not only the two loop-boundary ones.

⭐ WHY THIS FILE EXISTS. ``256-VERIFICATION.md`` scored SC#1 at 2/4 because METER-03
was implemented at two sites — ``_enforce_budget("phase_boundary")`` at the top of the
``while`` body and ``_enforce_budget("phase_completed")`` after the phase's output is
durable. Three ORDINARY, first-class returns sit between them and never reach either:

    * ``outcome.kind == "pause_run"``  — a human gate elapsed unanswered (D-10)
    * ``outcome.kind == "fail_run"``   — gates exhausted / wall-clock timeout
    * ``outcome.kind == "skip_to"`` with a target missing at runtime

The loss is PERMANENT, which is what makes it a correctness defect rather than a
reporting lag: the next segment starts with ``ctx.run_usage_box = {}`` and a breaker at
zero, and D-256-03 forbids recovering the figure by summing across ``runs`` and
``workflow_runs`` (different grains).

⛔ THE HEADLINE CASE DRIVES A **DISARMED** BREAKER, AND THAT IS NOT A STYLE CHOICE.
``test_256_enforce_budget_persist.py``'s own header records that this project already
shipped a green suite beside exactly this defect once: a fixture with a ``budget=``
configured passed over the fact that ``if not breaker.armed: return`` sat above the
absorb point, while an INTERACTIVE harness run — which configures neither ceiling — was
measured at zero. A pause fixture carrying a budget would repeat that mistake in a new
file. So every case below that is about the pause/fail/skip arms uses
``_RecordingPool(rows=...)`` with **no** ``budget``.

Everything is driven through the REAL engine seam: ``run_workflow`` with the real
``_enforce_budget``, the real ``_flush_run_usage``, the real ``CircuitBreaker``, the real
``persist_run_usage`` and the real ``ctx.run_usage_box``. Only the phase executor and the
pool are replaced, and the assertions read the SQL the pool was actually handed — so a
writer that was CALLED but issued nothing cannot pass here.

WHAT THIS SUITE DOES NOT PROVE: that the statement is accepted by Postgres; that the
value survives a process boundary; that a phase which CRASHES or is CANCELLED mid-work
keeps its delta (it does not — a ``try``/``finally`` around the loop was rejected because
an unshielded ``await`` in a ``finally`` changes which exception leaves the engine on a
user Stop; the residual is registered in ``SEED-300``).

⚠ The engine harness (``_RecordingPool`` / ``_MeteredProvider`` / ``_drive`` / ``_rows``)
is IMPORTED from ``test_scheduler_circuit_breaker.py`` rather than copied — the same
discipline ``test_256_enforce_budget_persist.py`` records. ``_MeteredProvider`` bills
through ``ctx.run_usage_box``, the real production channel; a second copy could drift
into billing through a pipe production does not have. ``_NoUsageBoxCtx`` and
``_usage_writes`` are likewise IMPORTED from ``test_256_enforce_budget_persist.py``
rather than restated.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest

from app.services.circuit_breaker import (
    CircuitBreakerTrippedError,
)
from tests.unit.test_256_enforce_budget_persist import (
    _NoUsageBoxCtx,
    _usage_writes,
)
from tests.unit.test_scheduler_circuit_breaker import (
    _drive,
    _FakeRedis,
    _MeteredProvider,
    _RecordingPool,
    _rows,
)


_TOKENS = 300
_HALF = _TOKENS // 2


def _bill(ctx, tokens: int = _TOKENS) -> None:
    """Bill the run-level box exactly as ``_MeteredProvider`` does.

    ⚠ Same channel, same split (``half`` in / remainder out), so a delta asserted here
    is comparable with the ones ``test_256_enforce_budget_persist.py`` asserts.
    """
    box = getattr(ctx, "run_usage_box", None)
    if isinstance(box, dict):
        half = tokens // 2
        box["input_tokens"] = (box.get("input_tokens") or 0) + half
        box["output_tokens"] = (box.get("output_tokens") or 0) + (tokens - half)


def _defs(build_workflow_definition, n: int, *, validators=None):
    phases = []
    for i in range(n):
        phase = {
            "slug": f"p{i}",
            "phase_index": i,
            "config": {"phase_type": "llm_single", "prompt": f"p{i}"},
        }
        if validators is not None:
            phase["validators"] = validators
        phases.append(phase)
    return build_workflow_definition(phases)


# ===========================================================================
#  THE HEADLINE CASE — a DISARMED run that PAUSES on the human gate
# ===========================================================================

@pytest.mark.asyncio
async def test_a_disarmed_run_that_pauses_on_the_human_gate_persists_the_phase_it_just_ran(
    build_workflow_definition,
):
    """⭐ CR-01's headline. An interactive run, no ceilings, a real human gate pause.

    The cheapest honest way to reach the pause arm is the shipped one:
    ``harness/human_input.py``'s ``HumanInputTimeout``, raised from inside the phase and
    converted to ``PhaseOutcome("pause_run", ...)`` by ``_run_phase_with_gates`` — so the
    outcome that reaches the ``while`` body is the real thing, not a hand-built object.
    """
    from app.services.harness.human_input import HumanInputTimeout

    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))  # ⛔ NO budget= — the interactive shape
    definition = _defs(build_workflow_definition, 2)

    entered: list[str] = []

    async def _bills_then_pauses(phase, accumulated_outputs, ctx):
        entered.append(phase.slug)
        _bill(ctx)
        raise HumanInputTimeout(tool_call_id="tc-1", timeout_seconds=300)

    await _drive(pool, _FakeRedis(), run_id, definition, _bills_then_pauses)

    # The run really took the pause arm (and not the escape arm, which would have
    # cancelled the phase and expired the prompt).
    assert any(
        "SET status = 'paused'" in sql for sql in pool.sql_log()
    ), "the run did not reach the pause arm — this case is not driving what it claims"
    assert "policy_applied" in pool.audit_kinds()
    assert entered == ["p0"], "the pause must stop the next phase from running"

    writes = _usage_writes(pool)
    assert writes, (
        "A PAUSED RUN PERSISTED NOTHING. The phase billed real tokens and then the run "
        "returned from the pause arm, which is reached AFTER the phase-boundary "
        "enforcement and BEFORE the phase-completed one — so neither _enforce_budget "
        "call site ever sees this phase's spend, and ctx.run_usage_box is reset to {} on "
        "the next segment. This is CR-01."
    )
    total_in = sum(args[1] for _sql, args in writes)
    total_out = sum(args[2] for _sql, args in writes)
    assert (total_in, total_out) == (_HALF, _TOKENS - _HALF), (
        f"the persisted delta must equal what the paused phase actually billed; "
        f"got {total_in}/{total_out}"
    )
    assert all(args[0] == run_id for _sql, args in writes)


# ===========================================================================
#  The fail_run arm — the WORST one to lose
# ===========================================================================

@pytest.mark.asyncio
async def test_a_run_that_reaches_fail_run_persists_the_spend_of_the_phase_that_failed(
    build_workflow_definition,
):
    """The most expensive phase in a run is the one that exhausted its retries.

    Driven the cheapest honest way: ``asyncio.TimeoutError`` out of the phase, which
    ``_run_phase_with_gates`` converts through ``_route_on_failure`` to
    ``PhaseOutcome("fail_run", ...)`` with no retry loop (a wall-clock timeout has no
    failing-validator index, and a phase with no validators routes to ``fail_run``).
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = _defs(build_workflow_definition, 2)

    async def _bills_then_times_out(phase, accumulated_outputs, ctx):
        _bill(ctx)
        raise asyncio.TimeoutError()

    await _drive(pool, _FakeRedis(), run_id, definition, _bills_then_times_out)

    assert "failed" in pool.finish_run_statuses(), (
        "the run did not reach fail_run — this case is not driving what it claims"
    )

    writes = _usage_writes(pool)
    assert writes, (
        "A FAILED RUN PERSISTED NOTHING. fail_run is reached only after "
        "_run_phase_with_gates has exhausted its retries, so this is the most "
        "expensive phase whose spend was being dropped on the floor."
    )
    assert (
        sum(a[1] for _s, a in writes),
        sum(a[2] for _s, a in writes),
    ) == (_HALF, _TOKENS - _HALF)


# ===========================================================================
#  The dangling skip_to target — the third return
# ===========================================================================

@pytest.mark.asyncio
async def test_a_run_whose_skip_target_is_dangling_persists_before_it_is_terminalized(
    build_workflow_definition,
):
    """The runtime guard for a skip target that does not exist (T-091-18).

    A validator carrying ``on_failure: skip_to_phase:<slug>`` plus a wall-clock timeout
    (``failed_idx`` is None, so ``_failing_on_failure`` falls back to the first
    skip-bearing validator) routes to the ``skip_to`` arm; the target is absent from
    ``index_by_slug``, so the arm terminalizes the run.

    ⚠ ASSERTED AS AN ORDERING, not merely as presence: the usage write must land BEFORE
    the ``failed`` flip, because that flip is the last thing that happens to this run.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = _defs(
        build_workflow_definition,
        2,
        validators=[
            {
                "kind": "json_schema",
                "config": {},
                "on_failure": "skip_to_phase:does-not-exist",
            }
        ],
    )

    async def _bills_then_times_out(phase, accumulated_outputs, ctx):
        _bill(ctx)
        raise asyncio.TimeoutError()

    await _drive(pool, _FakeRedis(), run_id, definition, _bills_then_times_out)

    kinds = pool.audit_kinds()
    assert "phase_transition" in kinds, (
        "the run did not reach the skip_to arm — this case is not driving what it claims"
    )
    assert "failed" in pool.finish_run_statuses()

    writes = _usage_writes(pool)
    assert writes, (
        "A RUN KILLED BY A DANGLING SKIP TARGET PERSISTED NOTHING — the third of "
        "CR-01's three ordinary returns."
    )
    assert (
        sum(a[1] for _s, a in writes),
        sum(a[2] for _s, a in writes),
    ) == (_HALF, _TOKENS - _HALF)

    usage_idx = pool.index_of("input_tokens = COALESCE(input_tokens, 0)")
    fail_idx = next(
        i
        for i, (sql, args) in enumerate(pool.calls)
        if "workflow_runs" in sql and "failed" in args
    )
    assert usage_idx < fail_idx, (
        f"the spend must be durable BEFORE the run is terminalized "
        f"(usage write at {usage_idx}, failed flip at {fail_idx})"
    )


# ===========================================================================
#  The regression case — the flush must not DOUBLE-BOOK a completed run
# ===========================================================================

@pytest.mark.asyncio
async def test_a_completed_run_still_writes_exactly_once_per_phase(
    build_workflow_definition,
):
    """⛔ THE CASE THIS PLAN COULD BREAK. N phases -> N writes, each a (150, 150) DELTA.

    Byte-identical expectations to
    ``test_256_enforce_budget_persist.py::test_the_twice_per_phase_enforcement_writes_once_per_phase``,
    restated HERE because a third call site in the loop is exactly what could turn one
    write per phase into two.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(3))
    definition = _defs(build_workflow_definition, 3)
    provider = _MeteredProvider(tokens_per_phase=_TOKENS)

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    writes = _usage_writes(pool)
    assert len(writes) == 3, (
        f"expected exactly one write per phase (3), got {len(writes)}. More than one "
        "per phase means the new flush is re-adding a delta the boundary enforcement "
        "already absorbed."
    )
    for _sql, args in writes:
        assert (args[1], args[2]) == (_HALF, _TOKENS - _HALF)


# ===========================================================================
#  Idempotence by the watermark — DRIVEN, not asserted in prose
# ===========================================================================

@pytest.mark.asyncio
async def test_a_pause_after_a_completed_phase_issues_no_second_write(
    build_workflow_definition,
):
    """⭐ The idempotency property, re-derived on the real seam rather than inherited.

    ``absorb_usage_box`` MUTATES the breaker's watermark and returns the clamped delta,
    so a second call on an unchanged box yields ``(0, 0)`` and ``persist_run_usage``
    returns before touching the database. Phase 1 completes (absorbed at
    ``phase_completed``); phase 2 bills nothing and pauses. The flush must therefore
    write for phase 1 and for nothing else — 2 phases, 1 write.
    """
    from app.services.harness.human_input import HumanInputTimeout

    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = _defs(build_workflow_definition, 2)

    async def _bill_then_pause_on_second(phase, accumulated_outputs, ctx):
        if phase.slug == "p0":
            _bill(ctx)
            return {"text": "ok"}
        raise HumanInputTimeout(tool_call_id="tc-1", timeout_seconds=300)

    await _drive(pool, _FakeRedis(), run_id, definition, _bill_then_pause_on_second)

    writes = _usage_writes(pool)
    assert len(writes) == 1, (
        f"expected exactly one write (phase 1's spend, absorbed once), got "
        f"{len(writes)}: {[a[1:3] for _s, a in writes]}. A second write means the "
        "flush re-added a delta the watermark had already consumed."
    )
    assert (writes[0][1][1], writes[0][1][2]) == (_HALF, _TOKENS - _HALF)


# ===========================================================================
#  The honest-zero and no-box arms, on the pause path
# ===========================================================================

@pytest.mark.asyncio
async def test_a_phase_that_reports_no_usage_and_then_pauses_writes_nothing(
    build_workflow_definition,
):
    """⛔ NOTHING, not ``(0, 0)``.

    ``NULL`` means never measured and ``0`` means measured as zero (D-256-06). A zero
    here would make an uninstrumented run look free.
    """
    from app.services.harness.human_input import HumanInputTimeout

    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = _defs(build_workflow_definition, 2)

    async def _silent_then_pauses(phase, accumulated_outputs, ctx):
        raise HumanInputTimeout(tool_call_id="tc-1", timeout_seconds=300)

    await _drive(pool, _FakeRedis(), run_id, definition, _silent_then_pauses)

    assert any("SET status = 'paused'" in sql for sql in pool.sql_log())
    assert _usage_writes(pool) == [], (
        "nothing was measured, so nothing may be written"
    )


@pytest.mark.asyncio
async def test_a_ctx_that_refuses_a_usage_box_pauses_harmlessly(
    build_workflow_definition,
):
    """The stub-ctx arm the engine already guards for must stay harmless on this path too."""
    from app.services.harness.human_input import HumanInputTimeout

    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = _defs(build_workflow_definition, 2)

    async def _bills_then_pauses(phase, accumulated_outputs, ctx):
        _bill(ctx)  # no-op: the ctx has no box
        raise HumanInputTimeout(tool_call_id="tc-1", timeout_seconds=300)

    await _drive(
        pool,
        _FakeRedis(),
        run_id,
        definition,
        _bills_then_pauses,
        ctx=_NoUsageBoxCtx(),
    )

    assert any("SET status = 'paused'" in sql for sql in pool.sql_log())
    assert _usage_writes(pool) == []


# ===========================================================================
#  The flush must not change which exception leaves the engine
# ===========================================================================

@pytest.mark.asyncio
async def test_an_armed_run_still_trips_with_the_breaker_error_and_not_cancelled(
    build_workflow_definition,
):
    """⛔ ``CircuitBreakerTrippedError``, NEVER ``asyncio.CancelledError``.

    A ``CancelledError`` would take the escape arm, which calls ``cancel_phase`` — and a
    shipped Phase-194 fence AST-counts ``cancel_phase`` call sites in that module at
    EXACTLY ONE. Restated here because the new flush sits in the same ``while`` body.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 500}}, rows=_rows(3)
    )
    definition = _defs(build_workflow_definition, 3)
    provider = _MeteredProvider(tokens_per_phase=600)

    with pytest.raises(CircuitBreakerTrippedError) as exc:
        await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert not isinstance(exc.value, asyncio.CancelledError)
    writes = _usage_writes(pool)
    assert writes, "a breaker-tripped run must still persist the spend that killed it"
    assert sum(a[1] for _s, a in writes) + sum(a[2] for _s, a in writes) == 600


# ===========================================================================
#  The SHAPE fence — one home, reached from three sites, zero new branches
# ===========================================================================

def _engine_source() -> str:
    from pathlib import Path

    import app.services.harness_engine as he

    return Path(he.__file__).read_text(encoding="utf-8")


def test_the_durable_token_write_has_exactly_one_home():
    """⛔ Asserted as a SET of call sites, never as a count.

    ``persist_run_usage`` must be reachable from ONE place in this module — the nested
    ``_flush_run_usage`` — so the absorb+persist pair cannot drift apart between the
    three callers.
    """
    import ast

    tree = ast.parse(_engine_source())
    sites = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "persist_run_usage"
    ]
    assert len(sites) == 1, (
        f"persist_run_usage is called from {len(sites)} places in harness_engine.py "
        f"(lines {[n.lineno for n in sites]}). It has exactly one home: _flush_run_usage."
    )


def test_the_flush_is_called_unconditionally_in_the_phase_loop():
    """⭐ THE PLACEMENT IS THE WHOLE POINT, so it is checked structurally.

    The new call sits at statement level in ``run_workflow``'s ``while`` body — not
    inside an ``if``, a ``try`` or an ``except`` — which is what makes every outcome arm
    below it flow THROUGH it, and what covers a FIFTH arm nobody has written yet.
    """
    import ast

    tree = ast.parse(_engine_source())
    run_workflow = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "run_workflow"
    )
    whiles = [n for n in ast.walk(run_workflow) if isinstance(n, ast.While)]
    assert whiles, "run_workflow has no while loop — the tree has moved"

    def _is_flush(stmt) -> bool:
        return (
            isinstance(stmt, ast.Expr)
            and isinstance(stmt.value, ast.Await)
            and isinstance(stmt.value.value, ast.Call)
            and isinstance(stmt.value.value.func, ast.Name)
            and stmt.value.value.func.id == "_flush_run_usage"
        )

    top_level = [w for w in whiles if any(_is_flush(s) for s in w.body)]
    assert top_level, (
        "no unconditional `await _flush_run_usage()` at statement level in the phase "
        "loop body — a flush nested inside an if/try only covers the arms someone "
        "remembered, which is the defect CR-01 found."
    )


def test_enforce_budget_gained_no_branch():
    """⛔ Its branch count is itself fenced; the arithmetic is published, not asserted.

    ``_enforce_budget``'s docstring forbids a ``try``/``except`` here — *"a try/except
    here would add a branch to a function whose branch count is itself fenced"* — so
    this pins the shape rather than trusting the prose: 3 ``if``s, no ``try``, no
    ``except``, no ``for``/``while``.

    ⚠ MEASURED 2 ``if``s BEFORE the change and 2 AFTER (the ``armed`` short-circuit and
    the ``_tripped`` short-circuit) — the plan predicted 3 and the measurement is
    recorded beside it rather than over it. So this case was GREEN on first run and is a
    REGRESSION PIN, not RED-first evidence; it is reported as such.
    """
    import ast

    tree = ast.parse(_engine_source())
    run_workflow = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "run_workflow"
    )
    enforce = next(
        n
        for n in ast.walk(run_workflow)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_enforce_budget"
    )
    ifs = [n for n in ast.walk(enforce) if isinstance(n, ast.If)]
    tries = [n for n in ast.walk(enforce) if isinstance(n, ast.Try)]
    loops = [n for n in ast.walk(enforce) if isinstance(n, (ast.For, ast.While))]
    assert (len(ifs), len(tries), len(loops)) == (2, 0, 0), (
        f"_enforce_budget's branch shape changed: {len(ifs)} ifs, {len(tries)} trys, "
        f"{len(loops)} loops (expected 2/0/0)"
    )
