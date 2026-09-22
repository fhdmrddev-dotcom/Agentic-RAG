"""Phase 256 / METER-03 (SC#1) — the durable write happens on an INTERACTIVE run.

⭐ THIS SUITE EXISTS BECAUSE THE DECISION IT TESTS WAS WRONG AS WRITTEN, and the
correction is the whole value of the file. D-256-04 names
``harness_engine.py:1875`` — the breaker's absorb point — as where a run's token
total becomes durable. Measured at this plan's base, line ``:1873`` is::

    if not breaker.armed:
        return

and ``CircuitBreaker.armed`` is *"is either ceiling configured?"*. An INTERACTIVE
harness run configures neither, so the function returned before reaching the
absorb — meaning METER-03 implemented literally would have persisted **nothing
for nearly every harness run in the product**, while a suite written against a
SCHEDULED-run fixture passed. That is the green-fence-beside-the-defect shape
this project has recorded twice. So:

  ⛔ THE HEADLINE CASE BELOW USES A RUN WITH NO CEILINGS AT ALL. A version of
     this file that only ever drives a budgeted run would be worthless, however
     many cases it had.

Everything is driven through the REAL engine seam — ``run_workflow`` with the
real ``_enforce_budget``, the real ``CircuitBreaker``, the real
``persist_run_usage`` and the real ``ctx.run_usage_box`` channel — with only the
phase executor and the pool replaced. The assertions read the SQL the pool was
actually handed, so a writer that was called but issued nothing cannot pass.

WHAT THIS SUITE DOES NOT PROVE: that the statement is accepted by Postgres, or
that the value survives a process boundary. Those are
``tests/integration/test_256_migration_182.py`` and
``tests/integration/test_256_persist_restart.py``, both of which live OUTSIDE
``pytest tests/unit`` and are invisible to the 71-name baseline.

⚠ The engine harness (``_RecordingPool`` / ``_MeteredProvider`` / ``_drive``) is
IMPORTED from ``test_scheduler_circuit_breaker.py`` rather than copied. That is
deliberate: ``_MeteredProvider`` bills through ``ctx.run_usage_box``, the real
production channel, and a second copy could drift into billing through a pipe
that does not exist in production.
"""

from __future__ import annotations

import uuid

import pytest

from app.services.circuit_breaker import (
    REASON_TOKEN_BUDGET,
    CircuitBreaker,
    CircuitBreakerTrippedError,
)
from tests.unit.test_scheduler_circuit_breaker import (
    _drive,
    _FakeRedis,
    _MeteredProvider,
    _RecordingPool,
    _rows,
)


_USAGE_WRITE = "input_tokens = COALESCE(input_tokens, 0)"


def _usage_writes(pool) -> list[tuple[str, tuple]]:
    """Every statement ``persist_run_usage`` actually issued, in order."""
    return [(sql, args) for sql, args in pool.calls if _USAGE_WRITE in sql]


class _NoUsageBoxCtx:
    """A ctx that REFUSES ``run_usage_box`` — the Deep-run / unit-stub / golden-run shape.

    ``harness_engine`` sets the box inside a ``try/except (AttributeError, TypeError)``
    precisely because such a ctx exists. This class makes that arm reachable without
    also breaking every other attribute the engine sets.
    """

    def __setattr__(self, name, value):
        if name == "run_usage_box":
            raise AttributeError("immutable stub ctx — no usage box here")
        object.__setattr__(self, name, value)


# ===========================================================================
# THE HEADLINE CASE — a DISARMED breaker still persists
# ===========================================================================

def test_an_interactive_run_has_a_disarmed_breaker():
    """The leaf fact the headline case rests on, asserted rather than assumed.

    ``load_run_budget`` returns all-``None`` for a run with no metadata, and that
    is every interactive run in the product.
    """
    assert CircuitBreaker(max_tokens=None, max_duration_seconds=None).armed is False


@pytest.mark.asyncio
async def test_a_disarmed_interactive_run_persists_its_token_delta(
    build_workflow_definition,
):
    """⭐ SC#1 ON THE RUN SHAPE THAT ACTUALLY EXISTS. No ceilings, real spend.

    ``_RecordingPool(rows=...)`` with no ``budget`` makes ``fetchrow`` return
    ``None``, so the breaker is disarmed — exactly the shipped interactive path.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )
    provider = _MeteredProvider(tokens_per_phase=300)

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    writes = _usage_writes(pool)
    assert writes, (
        "a run with NO ceilings persisted NOTHING — this is the `if not "
        "breaker.armed: return` guard sitting above the absorb point, and it is "
        "why METER-03 as literally specified would have measured nearly every "
        "harness run at zero"
    )
    total_in = sum(args[1] for _sql, args in writes)
    total_out = sum(args[2] for _sql, args in writes)
    assert (total_in, total_out) == (300, 300), (
        f"the persisted deltas must sum to the run's real spend "
        f"(2 phases x 300 tokens, split 150/150); got {total_in}/{total_out}"
    )
    assert all(args[0] == run_id for _sql, args in writes)


@pytest.mark.asyncio
async def test_a_disarmed_run_never_consults_the_ceiling_and_never_trips(
    build_workflow_definition,
):
    """The reorder must not turn a limitless run into a checked one.

    ``check_limits`` is unreachable for a disarmed breaker by arithmetic — both
    arms guard on ``is not None`` — so moving the persist above the guard cannot
    change the trip decision. This asserts the observable half of that.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )
    provider = _MeteredProvider(tokens_per_phase=10**7)  # would blow any real cap

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert provider.entered == ["p0", "p1"], (
        "a disarmed run must execute every phase no matter what it spends"
    )
    assert "circuit_breaker_tripped" not in pool.audit_kinds()
    assert "completed" in pool.finish_run_statuses()


# ===========================================================================
# The ARMED path is untouched
# ===========================================================================

@pytest.mark.asyncio
async def test_an_armed_run_at_its_ceiling_still_trips_identically(
    build_workflow_definition,
):
    """⛔ ``CircuitBreakerTrippedError``, NEVER ``asyncio.CancelledError``.

    A ``CancelledError`` would take the escape arm that calls ``cancel_phase``,
    and a shipped Phase-194 fence AST-counts ``cancel_phase`` call sites in that
    module at EXACTLY ONE. The reorder must not add a branch that changes which
    exception leaves this function.
    """
    import asyncio

    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 500}}, rows=_rows(3)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider(tokens_per_phase=600)

    with pytest.raises(CircuitBreakerTrippedError) as exc:
        await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert not isinstance(exc.value, asyncio.CancelledError)
    assert exc.value.reason == REASON_TOKEN_BUDGET
    assert exc.value.details["cumulative_tokens"] == 600
    assert provider.entered == ["p0"], (
        "the trip must still stop the NEXT phase from executing"
    )
    assert "circuit_breaker_tripped" in pool.audit_kinds()


@pytest.mark.asyncio
async def test_a_tripped_run_still_persists_the_spend_that_killed_it(
    build_workflow_definition,
):
    """⭐ The run whose spend matters MOST is the one killed for overspending.

    At finalize-only this number would be lost, which is D-256-04's whole reason
    for choosing the phase boundary.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 500}}, rows=_rows(3)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider(tokens_per_phase=600)

    with pytest.raises(CircuitBreakerTrippedError):
        await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    writes = _usage_writes(pool)
    assert writes, "a breaker-tripped run persisted nothing — the worst case to lose"
    assert sum(a[1] for _s, a in writes) + sum(a[2] for _s, a in writes) == 600


# ===========================================================================
# Idempotence against repetition, observed on the real seam
# ===========================================================================

@pytest.mark.asyncio
async def test_the_twice_per_phase_enforcement_writes_once_per_phase(
    build_workflow_definition,
):
    """``_enforce_budget`` runs at the phase boundary AND at phase completion.

    Two invocations per phase, and the boundary one always sees an UNCHANGED box
    (the previous completion already absorbed it), so its delta is ``(0, 0)`` and
    it must issue no statement. N phases -> 2N enforcements -> N writes.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(3))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider(tokens_per_phase=300)

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    writes = _usage_writes(pool)
    assert len(writes) == 3, (
        f"expected exactly one write per phase (3), got {len(writes)}. More than "
        "one per phase means the (0,0) guard is missing and the boundary "
        "enforcement is re-adding; fewer means a phase's spend was dropped."
    )
    for _sql, args in writes:
        assert (args[1], args[2]) == (150, 150), (
            f"every write must carry a DELTA, not the cumulative box; got {args[1:3]}"
        )


@pytest.mark.asyncio
async def test_a_silent_phase_writes_nothing_and_breaks_nothing(
    build_workflow_definition,
):
    """A phase that reports no usage must not manufacture a zero-token write."""
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )

    entered: list[str] = []

    async def _silent(phase, accumulated_outputs, ctx):
        entered.append(phase.slug)
        return {"text": "x"}

    await _drive(pool, _FakeRedis(), run_id, definition, _silent)

    assert entered == ["p0", "p1"]
    assert _usage_writes(pool) == [], (
        "nothing was measured, so nothing may be written — a 0 here would read as "
        "'measured as zero' and make an uninstrumented run look free (D-256-06)"
    )


@pytest.mark.asyncio
async def test_a_ctx_with_no_usage_box_persists_nothing_and_raises_nothing(
    build_workflow_definition,
):
    """The stub-ctx arm the engine already guards for must stay harmless."""
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )
    provider = _MeteredProvider(tokens_per_phase=300)

    await _drive(
        pool, _FakeRedis(), run_id, definition, provider.execute, ctx=_NoUsageBoxCtx()
    )

    assert provider.entered == ["p0", "p1"], "the run must complete normally"
    assert _usage_writes(pool) == []
