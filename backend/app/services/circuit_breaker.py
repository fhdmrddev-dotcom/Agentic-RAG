"""Spend-cap and wall-clock circuit breakers for unattended workflow runs (SCHED-02).

WHY THIS EXISTS. A scheduled run has no one watching it. A phase that loops, a context
that keeps growing, or a provider that simply never answers all cost real money or real
wall-clock, and the only thing standing between that and an invoice is a limit something
actually enforces. Phase 204 gives an unattended run two hard ceilings — a cumulative
token budget and a wall-clock deadline — and this module is where both live.

⚠ THE BREAKER DOES NOT IMPLEMENT ITS OWN STOP, AND THAT IS D-204-03 ("one unified stop
path") ENFORCED BY SHAPE RATHER THAN BY A RULE SOMEONE HAS TO REMEMBER. ``trip_breaker``
composes ``run_lifecycle.cancel_workflow_run_internals`` — the ONE site that announces a
cancel (204-01) — so a breaker trip inherits, unedited and for free: the Redis level +
edge broadcast, the ``finish_run(…, "cancelled")`` write, the run-keyed
``cancel_active_phases`` terminalize, the producer's F2 registry consult, and the
in-flight ``cancellation_watch`` that kills a provider call mid-await on ANOTHER worker.
A breaker that called ``finish_run`` itself would get the status column and none of the
halt — which is the difference between a number in a table and money not spent.

⚠ THE BOOKKEEPING IS BEST-EFFORT AND THE HALT IS NOT. Both durable writes below are
individually wrapped: an audit kind whose migration has not been applied yet raises a
Postgres ``23514``, and a ``metadata`` column whose migration has not been applied raises
``UndefinedColumnError``. Neither may prevent the cancel. BUG-260731-02 is this project's
recorded case of an audit write killing the very run it was describing; a SAFETY
mechanism that can be disabled by its own paperwork is worse than no safety mechanism,
because it reads as armed.

⚠ THE WRITES STILL COME **FIRST**. The threat model's third entry is *audit evasion*:
"all circuit breaker trips must write durable audit records with exact token and timing
measurements BEFORE terminating the run". That is deliberately the opposite ordering to
``cancel_workflow_run_internals``'s own internal one (which broadcasts before its writes,
to stop spending a few milliseconds sooner). Both are right for their own reason and the
tension is named rather than hidden: the trip record is the only evidence that the run
was killed by a policy rather than by a person, and it is bounded at two round trips.

⚠ A DISARMED BREAKER IS A LITERAL NO-OP. Both limits default to ``None``. Interactive
runs — every run that exists before 204-03's scheduler — pass no limits, so
``check_limits`` returns ``(False, None)`` forever, ``duration_watch`` yields without
creating a task, and nothing about the shipped engine path changes.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# The canonical trip reasons. These are SLUGS that land in the audit row's metadata and
# in workflow_runs.metadata — never a sentence a person reads. The client's vocabulary
# layer owns the rendering (D-17, the shipped rule for every other persisted status word
# in this cluster). Spelled once, here, so the writer and the reader cannot drift.
REASON_TOKEN_BUDGET = "token_budget_exceeded"
REASON_MAX_DURATION = "max_duration_exceeded"

# The ONE key under which a trip is recorded inside workflow_runs.metadata. Imported by
# readers rather than re-typed, for the same reason RECORDED_INTENT_KEY is.
TRIP_METADATA_KEY = "circuit_breaker"


class CircuitBreakerTrippedError(RuntimeError):
    """Raised by the engine after a trip, to guarantee no further phase executes.

    ⚠ IT CARRIES THE REASON AND THE MEASUREMENTS. A bare exception would force every
    handler to re-derive what happened from the database.

    ⚠ IT IS **NOT** ``asyncio.CancelledError`` AND MUST NOT BE MADE ONE. The engine
    raises it from OUTSIDE its ``except BaseException`` phase-escape arm, precisely so it
    does not take the interrupted-phase branch — the phase in question has already
    finished, and a shipped Phase-194 fence AST-counts ``cancel_phase`` call sites in
    ``harness_engine.py`` at EXACTLY ONE.
    """

    def __init__(self, reason: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(f"circuit breaker tripped: {reason}")
        self.reason = reason
        self.details = details or {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CircuitBreaker:
    """Cumulative token + wall-clock ceilings for ONE run.

    Construct once per ``run_workflow`` invocation. ``record_tokens`` /
    ``absorb_usage_box`` feed it; ``check_limits`` reads it; ``trip_breaker`` and
    ``duration_watch`` act on it.

    ⚠ ``started_at`` IS THE RUN'S ANCHOR, NOT THE OBJECT'S BIRTHDAY, on any path that can
    supply one. A resumed run that re-anchored on ``datetime.now()`` would hand itself a
    fresh full budget of wall-clock on every restart, which is exactly how a duration cap
    becomes decorative. The engine passes ``workflow_runs.claimed_at ?? created_at`` when
    it has them — the same two server timestamps the run page's elapsed reads (Phase 200
    F3/F6).
    """

    def __init__(
        self,
        *,
        max_tokens: int | None = None,
        max_duration_seconds: int | None = None,
        started_at: datetime | None = None,
    ) -> None:
        self.max_tokens = max_tokens if (max_tokens or 0) > 0 else None
        self.max_duration_seconds = (
            max_duration_seconds if (max_duration_seconds or 0) > 0 else None
        )
        self.started_at = started_at or _now()
        if self.started_at.tzinfo is None:
            # A naive timestamp read back from a driver would make every subtraction
            # below raise. Assume UTC — every timestamp in this cluster is timestamptz.
            self.started_at = self.started_at.replace(tzinfo=timezone.utc)
        self.input_tokens = 0
        self.output_tokens = 0
        # Trips exactly once. The boundary check and the duration sentinel can observe
        # the same breach concurrently; without this the run would be cancelled twice,
        # write two audit rows and claim two different reasons for one event.
        self._tripped = False
        self._trip_lock = asyncio.Lock()

    # ── state ────────────────────────────────────────────────────────────────

    @property
    def armed(self) -> bool:
        """Is either ceiling configured? A disarmed breaker can never trip."""
        return self.max_tokens is not None or self.max_duration_seconds is not None

    @property
    def cumulative_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def tripped(self) -> bool:
        return self._tripped

    def record_tokens(self, input_tokens: int | None, output_tokens: int | None) -> None:
        """ADD this call's usage to the running totals.

        Negative deltas are clamped to zero: the only caller that can produce one is a
        usage box that went BACKWARDS, which means the box was reset under us, and
        subtracting from a spend counter is never the safe direction for a spend cap.
        """
        self.input_tokens += max(0, int(input_tokens or 0))
        self.output_tokens += max(0, int(output_tokens or 0))

    def absorb_usage_box(self, box: dict | None) -> None:
        """Sync from a CUMULATIVE ``usage_box`` — the shipped accumulator idiom.

        ``task_service._stream_one_iteration`` SUMS each turn's usage into a
        caller-supplied dict with keys ``input_tokens`` / ``output_tokens`` (Phase 093
        D-17). The engine hands one such box to every phase executor, so the box holds
        RUN-CUMULATIVE totals while ``record_tokens`` is ADDITIVE. This does the
        subtraction in ONE place — the breaker — rather than making the hot engine file
        carry delta bookkeeping it would have to get right.
        """
        if not box:
            return
        total_in = max(0, int(box.get("input_tokens") or 0))
        total_out = max(0, int(box.get("output_tokens") or 0))
        self.record_tokens(total_in - self.input_tokens, total_out - self.output_tokens)

    def elapsed_seconds(self, now: datetime | None = None) -> float:
        return max(0.0, ((now or _now()) - self.started_at).total_seconds())

    def remaining_seconds(self, now: datetime | None = None) -> float | None:
        """Seconds left on the wall clock, or ``None`` when no duration cap is set."""
        if self.max_duration_seconds is None:
            return None
        return self.max_duration_seconds - self.elapsed_seconds(now)

    # ── the decision ─────────────────────────────────────────────────────────

    def check_limits(self, now: datetime | None = None) -> tuple[bool, str | None]:
        """``(tripped, reason)``. Pure — it reads state and writes none.

        ⚠ ``>=`` ON BOTH, NOT ``>``. A budget of 500 tokens means 500 is the ceiling, and
        a run that has spent exactly its allowance has spent it. The same argument holds
        for the deadline: at ``max_duration_seconds`` the time is up.

        ⚠ TOKENS ARE CHECKED FIRST, AND THE ORDER IS ONLY VISIBLE WHEN BOTH BREACH AT
        ONCE. It is fixed here so the reason a run reports is deterministic rather than
        an artefact of evaluation order.
        """
        if self.max_tokens is not None and self.cumulative_tokens >= self.max_tokens:
            return True, REASON_TOKEN_BUDGET
        if self.max_duration_seconds is not None:
            if self.elapsed_seconds(now) >= self.max_duration_seconds:
                return True, REASON_MAX_DURATION
        return False, None

    def measurements(self, now: datetime | None = None) -> dict[str, Any]:
        """The exact numbers the threat model requires a trip record to carry."""
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cumulative_tokens": self.cumulative_tokens,
            "max_tokens": self.max_tokens,
            "elapsed_seconds": round(self.elapsed_seconds(now), 3),
            "max_duration_seconds": self.max_duration_seconds,
            "started_at": self.started_at.isoformat(),
        }

    # ── the act ──────────────────────────────────────────────────────────────

    async def trip_breaker(
        self,
        pool,
        redis,
        run_id,
        reason: str,
        details: dict[str, Any] | None = None,
        *,
        user_id=None,
    ) -> bool:
        """Record the trip durably, then stop the run through the ONE cancel path.

        Returns ``True`` iff this call is the one that tripped (``False`` when another
        observer got there first). Never raises: a breaker whose bookkeeping failed must
        still have stopped the run, and a breaker that raised on the way to stopping the
        run would leave the run going.
        """
        async with self._trip_lock:
            if self._tripped:
                return False
            self._tripped = True

        record = {"reason": reason, **self.measurements(), **(details or {})}
        logger.warning(
            "circuit breaker tripped for workflow run %s: %s (%s tokens / %.1fs)",
            run_id,
            reason,
            record["cumulative_tokens"],
            record["elapsed_seconds"],
        )

        # 1. THE DURABLE RECORD, BEFORE TERMINATION (threat: audit evasion). Late import
        #    — this module must stay off the db layer's load path, matching
        #    run_lifecycle's own shipped discipline.
        try:
            from app.db.workflows import record_circuit_breaker_trip  # noqa: PLC0415

            await record_circuit_breaker_trip(pool, run_id, record, user_id=user_id)
        except Exception:
            logger.exception(
                "circuit breaker trip record could not be written for run %s — the "
                "run is still being cancelled below (the halt never depends on the "
                "bookkeeping)",
                run_id,
            )

        # 2. THE HALT — composed, never re-implemented (D-204-03).
        try:
            from app.services.run_lifecycle import (  # noqa: PLC0415
                cancel_workflow_run_internals,
            )

            await cancel_workflow_run_internals(
                pool=pool, workflow_run_id=run_id, redis=redis
            )
        except Exception:
            logger.exception("circuit breaker could not cancel workflow run %s", run_id)
        return True

    @contextlib.asynccontextmanager
    async def duration_watch(self, pool, redis, run_id, *, user_id=None):
        """Trip on the wall-clock deadline while the body runs — the IN-FLIGHT half.

        ⚠ WITHOUT THIS THE DURATION CAP COULD NOT DO THE ONE THING ITS THREAT NAMES. The
        threat is "hanging network requests or third-party deadlocks"; a check performed
        only between phases cannot see one, because a hung phase never reaches the next
        boundary. A breaker that enforced its deadline only at boundaries would be built,
        gated, green and structurally unable to kill a stall.

        ⚠ IT CANCELS NOTHING ITSELF, AND THAT IS THE WHOLE DESIGN. It calls
        ``trip_breaker``, whose ``cancel_workflow_run_internals`` broadcasts the cancel;
        the ``cancellation_watch`` the engine has ALREADY entered around the same body
        then cancels the in-flight task — through the identical code path a human Stop
        takes. There is exactly one killer in this system and this is not it.

        ⚠ SCOPED TO ONE PHASE, NOT TO THE RUN, mirroring ``cancellation_watch``'s shipped
        lifecycle argument verbatim: torn down on every exit path (completion, failure,
        pause, cancellation) so a long run cannot accumulate one sentinel per phase. The
        deadline is ABSOLUTE (``started_at`` + ``max_duration_seconds``), so re-entering
        it each phase re-computes the correct remaining time rather than restarting a
        timer — a per-phase timer would let an N-phase run outlive an N× deadline.

        ⚠ A DISARMED OR ALREADY-TRIPPED BREAKER CREATES NO TASK AT ALL.
        """
        if self.max_duration_seconds is None or self._tripped:
            yield
            return

        async def _sentinel() -> None:
            try:
                while True:
                    remaining = self.remaining_seconds()
                    if remaining is None:
                        return
                    if remaining <= 0:
                        await self.trip_breaker(
                            pool,
                            redis,
                            run_id,
                            REASON_MAX_DURATION,
                            {"observed_by": "duration_watch"},
                            user_id=user_id,
                        )
                        return
                    # Bounded sleep: a long deadline must still wake often enough that
                    # the sentinel is cancellable promptly on the ordinary exit path.
                    await asyncio.sleep(min(remaining, 1.0))
            except asyncio.CancelledError:
                raise
            except Exception:
                # A dead sentinel must never kill a healthy run (mirrors
                # cancellation_watch's "the watcher never raises into the body").
                logger.exception(
                    "circuit breaker duration sentinel died for run %s", run_id
                )

        sentinel = asyncio.create_task(_sentinel())
        try:
            yield
        finally:
            sentinel.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await sentinel
