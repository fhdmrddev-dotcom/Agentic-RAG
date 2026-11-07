"""The workflow producer's heartbeat (BUG-261106-03).

A live run must be distinguishable from a dead one, or a booting worker's resume sweep
re-drives runs a sibling worker is still driving. Production measured it twice on
2026-11-06 (runs ``0c8183fc`` and ``dc6e4c56``): each ran step 1 twice in parallel and the
two copies overwrote each other's output.

``run_heartbeat`` is entered once per step, beside ``cancellation_watch`` and
``duration_watch``, and refreshes ``workflow_runs.updated_at`` on a timer for as long as
the step executes. The timer is independent of the model: a slow model call (a 27B model
on a home GPU took 7 minutes for one step) keeps beating, because the beat runs on the event
loop, not inside the call. ``claim_run`` takes an ``active`` run only after its last beat is
older than ``harness_resume_lease_seconds``.

Best-effort by design: a beat that fails is logged and retried at the next tick. The step
must never fail because its liveness signal could not be written; the cost of a missed beat
is at most a delayed re-claim, never a lost run.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

#: Beats per lease. Four beats can be missed before a live run looks dead.
_BEATS_PER_LEASE = 5


def heartbeat_interval_seconds() -> float:
    """Seconds between beats, derived from the one lease knob (no second setting to drift)."""
    from app.config import settings

    return max(5.0, settings.harness_resume_lease_seconds / _BEATS_PER_LEASE)


@contextlib.asynccontextmanager
async def run_heartbeat(pool, run_id: UUID, *, interval_seconds: float | None = None):
    """Beat for ``run_id`` while the body runs; stop on every exit path.

    The first beat is one interval in, not at entry: the step's own start already wrote the
    run row, and a step shorter than one interval (every unit test, most real steps on a
    fast model) adds no statement at all.
    """
    from app.db.workflows import touch_run_liveness

    interval = interval_seconds if interval_seconds is not None else heartbeat_interval_seconds()

    async def _beat() -> None:
        while True:
            await asyncio.sleep(interval)
            try:
                await touch_run_liveness(pool, run_id)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 — a missed beat delays a re-claim, nothing more
                logger.warning("run heartbeat failed for workflow run %s", run_id, exc_info=True)

    task = asyncio.create_task(_beat(), name=f"run-heartbeat-{run_id}")
    try:
        yield
    finally:
        task.cancel()
