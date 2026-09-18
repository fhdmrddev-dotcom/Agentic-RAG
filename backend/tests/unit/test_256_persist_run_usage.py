"""Phase 256 / METER-03 (D-256-05, D-256-06, D-256-09) — the write seam.

Two halves of one seam, pinned at the statement level because the whole point of
Phase 256 is that a token total stops being a number nobody can check:

  A. ``CircuitBreaker.absorb_usage_box`` now RETURNS the clamped delta it just
     handed to ``record_tokens``. It already owned that subtraction; the phase
     must not write a second delta bookkeeper (D-256-09). ⚠ The ``max(0, …)``
     clamp has to survive the extraction — ``record_tokens`` clamps internally,
     so a delta computed without the clamp would hand the database a NEGATIVE
     and SUBTRACT real spend the first time a usage box was reset under us.

  B. ``db.workflows.persist_run_usage`` is the ONE home of the token write
     (D-256-05). It ADDs at the database and never SETs, because
     ``ctx.run_usage_box`` resets per run SEGMENT
     (``harness_engine.py:1844``) — a SET would report the last segment's spend
     as the whole run's total. Its ``(0, 0)`` guard is LOAD-BEARING rather than
     an optimisation: ``_enforce_budget`` is invoked twice per phase iteration
     (``harness_engine.py:1978`` and ``:2547``), and unlike ``finish_run`` this
     writer is NOT safe under repetition by value-identity.

WHAT THESE CASES DO NOT PROVE, stated rather than left to be assumed: nothing
here touches Postgres. The SQL text is asserted as a string against a fake pool,
so a statement that is well-formed here could still be rejected by the server.
The live round-trip is ``tests/integration/test_256_persist_restart.py``; the
column shape is ``tests/integration/test_256_migration_182.py``. Both of those
live OUTSIDE ``pytest tests/unit`` and are invisible to the 71-name baseline,
which is exactly why these statement-level assertions exist in the unit gate.
"""

from __future__ import annotations

import uuid

import pytest

from app.db.workflows import TOKEN_COVERAGE_LEGS, persist_run_usage
from app.services.circuit_breaker import CircuitBreaker


# ---------------------------------------------------------------------------
# A fake pool that records statements instead of issuing them.
# ---------------------------------------------------------------------------

class _RecordingPool:
    """Records every ``execute`` call. A write that never happens records nothing."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *args):  # noqa: D401 - asyncpg.Pool shape
        self.calls.append((sql, args))
        return "UPDATE 1"


# ===========================================================================
# A. absorb_usage_box returns the delta it recorded
# ===========================================================================

def test_absorb_returns_the_delta_not_the_cumulative_box():
    """The box is RUN-CUMULATIVE; the return is the increment since last time."""
    breaker = CircuitBreaker()

    first = breaker.absorb_usage_box({"input_tokens": 100, "output_tokens": 40})
    assert first == (100, 40)

    second = breaker.absorb_usage_box({"input_tokens": 250, "output_tokens": 90})
    assert second == (150, 50), (
        "the second absorb must return the WATERMARK delta (250-100, 90-40), not "
        "the cumulative box — persisting the box per phase against an ADD column "
        "double-books every phase after the first"
    )


def test_absorb_of_nothing_returns_a_zero_delta():
    """``None`` and ``{}`` are both 'no usage reported', and both must be no-ops."""
    breaker = CircuitBreaker()
    assert breaker.absorb_usage_box(None) == (0, 0)
    assert breaker.absorb_usage_box({}) == (0, 0)
    assert (breaker.input_tokens, breaker.output_tokens) == (0, 0)


def test_a_backwards_box_returns_zero_and_never_a_negative():
    """⛔ The clamp must live on the RETURNED delta, not only inside record_tokens.

    A box that went BACKWARDS means it was reset under us. Without the clamp the
    writer would receive a negative and the database would SUBTRACT real spend —
    a run would report having cost less than it did, which is the repudiation
    failure this phase exists to close.
    """
    breaker = CircuitBreaker()
    breaker.absorb_usage_box({"input_tokens": 500, "output_tokens": 200})

    backwards = breaker.absorb_usage_box({"input_tokens": 1, "output_tokens": 1})

    assert backwards == (0, 0), f"expected a clamped (0, 0), got {backwards!r}"
    assert backwards[0] >= 0 and backwards[1] >= 0
    assert (breaker.input_tokens, breaker.output_tokens) == (500, 200), (
        "the counters must not go backwards either"
    )


def test_absorb_still_advances_the_breaker_counters_exactly_as_before():
    """The widened return must not change what the method already did."""
    breaker = CircuitBreaker()

    breaker.absorb_usage_box({"input_tokens": 100, "output_tokens": 40})
    assert (breaker.input_tokens, breaker.output_tokens) == (100, 40)
    assert breaker.cumulative_tokens == 140

    breaker.absorb_usage_box({"input_tokens": 250, "output_tokens": 90})
    assert (breaker.input_tokens, breaker.output_tokens) == (250, 90)
    assert breaker.cumulative_tokens == 340


# ===========================================================================
# B. persist_run_usage — the one home of the token write
# ===========================================================================

@pytest.mark.asyncio
async def test_a_zero_delta_issues_no_sql_at_all():
    """D-256-09's idempotence: two _enforce_budget calls on an unchanged box."""
    pool = _RecordingPool()
    await persist_run_usage(pool, uuid.uuid4(), input_delta=0, output_delta=0)
    assert pool.calls == [], (
        "a (0, 0) delta must issue NO statement — the guard is what makes the "
        "twice-per-phase invocation idempotent, and this writer is not safe "
        "under repetition the way finish_run is"
    )


@pytest.mark.asyncio
async def test_a_none_delta_issues_no_sql_at_all():
    """``None`` is 'never measured'. It must not be written as a zero."""
    pool = _RecordingPool()
    await persist_run_usage(pool, uuid.uuid4(), input_delta=None, output_delta=None)
    assert pool.calls == []


@pytest.mark.asyncio
async def test_a_real_delta_issues_exactly_one_parameterised_add():
    pool = _RecordingPool()
    run_id = uuid.uuid4()

    await persist_run_usage(pool, run_id, input_delta=150, output_delta=50)

    assert len(pool.calls) == 1, f"expected exactly one statement, got {pool.calls!r}"
    sql, params = pool.calls[0]

    assert "COALESCE(input_tokens, 0)" in sql
    assert "COALESCE(output_tokens, 0)" in sql
    assert "+ $2" in sql and "+ $3" in sql, (
        "the token columns must ACCUMULATE BY ADDITION (D-256-09) — a SET would "
        "make the last run segment's spend the whole run's total"
    )
    assert "token_coverage = $4" in sql
    assert params == (run_id, 150, 50, list(TOKEN_COVERAGE_LEGS))


@pytest.mark.asyncio
async def test_only_one_delta_present_still_writes_once():
    """An input-only (or output-only) delta is real spend and must be written."""
    pool = _RecordingPool()
    run_id = uuid.uuid4()

    await persist_run_usage(pool, run_id, input_delta=7, output_delta=0)

    assert len(pool.calls) == 1
    assert pool.calls[0][1] == (run_id, 7, 0, list(TOKEN_COVERAGE_LEGS))


@pytest.mark.asyncio
async def test_the_statement_targets_workflow_runs_by_id_only():
    """T-256-01 / T-256-02: parameterised, and ``WHERE id`` is the whole boundary.

    This writer runs on the service-role pool, which BYPASSES RLS. ⛔ An
    org-less ``WHERE thread_id`` variant would widen the blast radius of a bad
    id from one run to a whole conversation.
    """
    pool = _RecordingPool()
    await persist_run_usage(pool, uuid.uuid4(), input_delta=1, output_delta=1)

    sql, _params = pool.calls[0]
    assert "UPDATE workflow_runs" in sql
    assert "WHERE id = $1" in sql
    assert "thread_id" not in sql, (
        "never key this write by thread_id — id is the entire access boundary "
        "on a pool that bypasses RLS"
    )
    for interpolation_marker in ("{", "}", "%s", "' +", "+ '"):
        assert interpolation_marker not in sql, (
            f"the statement must be parameterised ($1..$4) with no {interpolation_marker!r} "
            f"interpolation (T-091-03); got {sql!r}"
        )


# ===========================================================================
# The coverage marker constant
# ===========================================================================

def test_token_coverage_legs_claims_only_the_legs_that_have_shipped():
    """⛔ ``emit`` is appended by plan 256-04, in the SAME commit as the drain arms.

    A marker that claims a leg which has not shipped is a lie in a column built
    to prevent lies (D-256-07 / SC#4). This assertion is expected to be UPDATED
    by 256-04 — and updating it is the point: the change is visible in a diff
    rather than silent.
    """
    assert TOKEN_COVERAGE_LEGS == ("agent", "single", "batch")
    assert isinstance(TOKEN_COVERAGE_LEGS, tuple), (
        "a tuple, so a caller cannot mutate the shared marker in place"
    )
