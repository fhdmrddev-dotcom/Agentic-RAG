"""Phase 204 (SCHED-01 / D-204-09 / D-204-11) — the background workflow scheduler.

Two things live here and nothing else: a **poll loop** that asks the database which schedules
are due, and a **launcher** that turns one claimed schedule into a real, unattended workflow
run. The cadence arithmetic is in ``models/schedule.py`` and the claiming transaction is in
``db/schedules.py``; this module composes them and drives the engine.

⚠ **THE DUPLICATE-FIRING GUARANTEE IS NOT IN THIS FILE.** ``claim_due_schedules`` owns it (the
``FOR UPDATE SKIP LOCKED`` select and the in-transaction ``next_run_at`` advance, in ONE
transaction). This loop can therefore run in **every** uvicorn worker with no leader election,
no advisory lock of its own and no Redis coordination — which is the point: a leader-election
scheme has a failure mode where the leader dies and nothing fires, and that failure is silent.
The database is already the arbiter of which rows exist; making it the arbiter of which rows
are claimed costs one transaction and removes a whole class of split-brain.

⚠ **PHASE 293 — THE JOB-EXECUTION HALF MOVED TO ``services/unattended_launch.py``** (the ledger's
named seam for this file, "split cadence claiming from job execution"). The thread insert, the run
row, the cap arming and the background drive with its mandatory producer-shell finalizer live
there now, shared with the API-key door (D-09, share not copy), and the three invariants that
describe them moved with the code: the launch reuses ``_build_resume_context``; the producer
shell is terminalized on every exit path; cancellation is inherited, not reimplemented. This
module keeps the cadence (the poll loop) and the schedule-only facts: cap normalisation, the
``_schedule_*`` input keys, ``ScheduledLaunchRefused`` and the outcome record.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

# The status written to `workflow_schedules.last_status` when the LAUNCH itself failed — as
# distinct from a run that started and then failed, which records the run's own terminal
# status. The two are different facts and folding them would say "the workflow is broken"
# about a schedule whose thread INSERT was refused.
LAUNCH_FAILED = "launch_failed"


class ScheduledLaunchRefused(Exception):
    """Phase 295 (D-13) — a scheduled launch refused BEFORE anything was written, with words.

    ``str(exc)`` is the author-facing sentence, already recorded on the schedule's
    ``last_status`` by :func:`launch_scheduled_run`. It is raised rather than returned as
    ``None`` because ``None`` means "could not be loaded" to both callers: the tick would
    overwrite the sentence with ``launch_failed`` and the run-now route would say the workflow
    was deleted.
    """


async def launch_scheduled_run(
    schedule: dict[str, Any],
    *,
    pool,
    redis,
) -> UUID | None:
    """Start ONE unattended workflow run for a claimed schedule. Returns the run id.

    ``schedule`` is a row as ``db.schedules.claim_due_schedules`` / ``get_schedule_for_launch``
    return it: it carries ``id``, ``user_id``, ``org_id``, ``workflow_id``, ``inputs`` and the
    two spend caps.

    ⚠ **THE RUN IS STAMPED WITH THE SCHEDULE'S OWNER, NEVER WITH A SERVICE IDENTITY.** Every
    downstream owner-scope guard — retrieval, the harness audit rows, the run page's ownership
    404 — reads that stamp. A scheduled run that ran as "the system" would retrieve across
    every tenant's documents.

    ⚠ **CORRECTED — THE CAPS DO NOT TRAVEL ON ``inputs``, AND THE BELIEF THAT THEY DID IS THE
    SCHED-02 DEFECT ITSELF.** This paragraph used to state that they did, *"so the circuit breaker
    can read them from the run it is policing"*. They travel on ``workflow_runs.metadata``, written
    by ``arm_run_budget`` (see :154), which is exactly what ``load_run_budget`` reads.

    The original wording is not preserved here because it was never merely stale — it was the
    **cause**: ``204-03`` wrote the caps to ``inputs`` while ``204-02``'s ``load_run_budget`` read
    ``metadata``, this module contained **zero** occurrences of ``metadata``, and the read FAILS
    OPEN, so the breaker disarmed **silently**. Measured on run ``27e00e7e``: **3m20s against a
    120s cap**, while 106 tests stayed green because each parallel wave mocked the other side.
    A reader who stopped at this docstring would re-learn the defect, which is why it is rewritten
    rather than annotated. Fixed by ``arm_run_budget`` (``57024280``) plus an 8-case seam suite
    whose counterfactual drives 3 RED.

    The two ``_schedule_*`` keys remain namespaced so they cannot collide with an author's own
    input names.

    Returns ``None`` when the workflow could not be resolved (deleted, or no longer the
    owner's) — a fact the caller records as ``launch_failed`` rather than raising, because one
    broken schedule must never stop the tick.
    """
    from app.db.workflows import get_definition
    from app.services.unattended_launch import (
        launch_unattended_run,
        parse_definition_row,
        template_refusal,
        workflows_disabled,
    )

    # 293-REVIEW CR-01 — the operator's workflows kill switch, before anything is read or
    # written. Recorded on the schedule in the in-app sentence, then raised (never launch_failed).
    if workflows_disabled():
        await _refuse_disabled(pool, schedule)

    owner_id = _as_uuid(schedule["user_id"])
    workflow_id = _as_uuid(schedule["workflow_id"])

    row = await get_definition(pool, workflow_id, user_id=owner_id)
    if row is None:
        logger.warning(
            "schedule %s references workflow %s the owner can no longer load; not launching",
            schedule.get("id"),
            workflow_id,
        )
        return None
    definition = parse_definition_row(row, log_ref=schedule.get("id"))
    if definition is None:
        return None

    # ── Phase 295 (D-13) — a fill step with no template is refused BEFORE the thread insert ──
    # On the definition asset ALONE (``template_refusal``, moved to unattended_launch in 293).
    # Recorded on the schedule in the lint finding's own words (one sentence, one home:
    # ``emit_cause``), then raised so neither caller rewrites it.
    sentence = template_refusal(definition)
    if sentence is not None:
        from app.db.schedules import record_schedule_outcome

        logger.warning(
            "schedule %s not launched: workflow %s has a fill step with no template",
            schedule.get("id"),
            workflow_id,
        )
        await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
        raise ScheduledLaunchRefused(sentence)

    # ── Phase 298 (D-13 / D-30) — a folder outside the definition's org is refused here too ──
    # The org is read from the ROW (get_definition omits it); system-global rows read None and are
    # never checked (D-01). No supabase client here, so the pool read alone decides. Same shape
    # as the template block above: recorded on the schedule in words, then raised.
    from app.services.foreign_folder_refusal import foreign_binding_refusal

    sentence = await foreign_binding_refusal(definition, definition_id=workflow_id, pool=pool, user_id=owner_id)
    if sentence is not None:
        from app.db.schedules import record_schedule_outcome

        logger.warning(
            "schedule %s not launched: workflow %s binds a folder outside its organization",
            schedule.get("id"),
            workflow_id,
        )
        await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
        raise ScheduledLaunchRefused(sentence)

    # ── Phase 300 (FIX-04 / D-14) — a blank required input is refused here, by label ──────────
    # A workflow can gain a required input after the schedule was saved, so the save-time 422 is
    # not enough. The ONE predicate, on the RAW stored definition (``row["definition"]``, a JSON
    # string or dict): the parsed model is not what ``declared_fields`` reads. Same shape as the
    # blocks above: recorded on the schedule in words, then raised. The log carries a COUNT only.
    from app.services.inbound_inputs import blank_required_sentence, missing_required_labels

    labels = missing_required_labels(row.get("definition"), schedule.get("inputs") or {})
    if labels:
        from app.db.schedules import record_schedule_outcome

        sentence = blank_required_sentence(labels, saved_schedule=True)
        logger.warning(
            "schedule %s not launched: %d required input(s) have no value",
            schedule.get("id"),
            len(labels),
        )
        await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
        raise ScheduledLaunchRefused(sentence)

    org_id = schedule.get("org_id") or row.get("org_id")

    # ── 258 F-2 / TIER-01 — a scheduled run is EXECUTION too ─────────────────────────
    # Same one entitlement home as the chat kickoff. Refused BEFORE the thread insert, so
    # an unentitled (or unresolvable) org's schedule writes nothing and is recorded by the
    # caller as launch_failed — one refused schedule never stops the tick.
    from app.services.entitlement_service import check_entitlement

    ent = await check_entitlement(pool, org_id, "workflows") if org_id else None
    if ent is None or not ent.allowed:
        logger.warning(
            "schedule %s not launched: org %s is not entitled to workflows (%s)",
            schedule.get("id"),
            org_id,
            ent.reason if ent else "no org",
        )
        return None

    raw_inputs = schedule.get("inputs") or {}
    if not isinstance(raw_inputs, dict):
        raw_inputs = {}

    sched_max_tokens = schedule.get("max_tokens_per_run")
    if sched_max_tokens == 50_000:
        sched_max_tokens = 500_000
    sched_max_duration = schedule.get("max_duration_seconds")
    if sched_max_duration == 600:
        sched_max_duration = 1_800

    from app.services.inbound_inputs import launch_kickoff  # noqa: PLC0415

    # 296-06 (291-S6-F8): the first step reads the kickoff, so the declared answers ride it as
    # `key: value` lines, exactly as an in-app start (293-05 D-3). No answers: byte-identical.
    _kickoff = launch_kickoff(raw_inputs.get("kickoff_prompt"), definition, raw_inputs)
    run_inputs = {
        **raw_inputs,
        **({"kickoff_prompt": _kickoff} if _kickoff else {}),
        "_schedule_id": str(schedule["id"]),
        "_schedule_max_tokens_per_run": sched_max_tokens,
        "_schedule_max_duration_seconds": sched_max_duration,
    }

    schedule_id = _as_uuid(schedule["id"])

    async def _record_outcome(status: str, run_id: UUID | None = None) -> None:
        # Every exit path of the background drive reports here (see unattended_launch).
        from app.db.schedules import record_schedule_outcome

        # 300-01 (D-26) + 300-REVIEW WR-01: the drive reports "completed" whenever run_workflow
        # RETURNS — which it also does when the run paused for a person, and when the engine's
        # fail_run arm finished it "failed" (or it was stopped). Read THIS drive's run, by id,
        # and record what it actually holds: paused -> the waiting outcome, failed / cancelled
        # as themselves (each has its D-15 sentence). 300-02's run-status trigger (migration
        # 218) later flips "waiting" to the run's terminal status. A failed read records
        # "completed", as before.
        if status == "completed" and run_id is not None:
            try:
                latest = await pool.fetchval(
                    "SELECT status FROM workflow_runs WHERE id = $1", run_id
                )
                if latest == "paused":
                    status = "waiting"
                elif latest in ("failed", "cancelled"):
                    status = latest
            except Exception:  # noqa: BLE001 — the outcome is a hint; never fail the drive
                logger.warning(
                    "schedule %s: could not read run %s status; recording completed",
                    schedule_id,
                    run_id,
                    exc_info=True,
                )
        await record_schedule_outcome(pool, schedule_id, status=status)

    return await launch_unattended_run(
        owner_id=owner_id,
        org_id=org_id,
        workflow_id=workflow_id,
        definition=definition,
        inputs=run_inputs,
        title=f"[scheduled] {schedule.get('name') or definition.name}",
        max_tokens=sched_max_tokens,
        max_duration=sched_max_duration,
        pool=pool,
        redis=redis,
        on_finish=_record_outcome,
        run_label="scheduled",
        log_ref=f"schedule {schedule.get('id')}",
        # 293 (D-22, A6): the tick AND "Run now" (api/schedules.py calls this function) read
        # as schedule origin, labelled with the schedule's name at start.
        origin_kind="schedule",
        origin_label=schedule.get("name"),
        origin_ref=schedule_id,
    )


async def _refuse_disabled(pool, schedule: dict) -> None:
    """293-REVIEW CR-01: record the kill-switch sentence on the schedule, then refuse with it."""
    from app.db.schedules import record_schedule_outcome
    from app.services.unattended_launch import WORKFLOWS_DISABLED_DETAIL

    logger.warning("schedule %s not launched: workflows are disabled", schedule.get("id"))
    await record_schedule_outcome(
        pool, _as_uuid(schedule["id"]), status=WORKFLOWS_DISABLED_DETAIL
    )
    raise ScheduledLaunchRefused(WORKFLOWS_DISABLED_DETAIL)


class SchedulerService:
    """The poll loop. One instance per uvicorn worker; they cooperate through the database.

    ``start()`` is a no-op when the feature is off, so the lifespan wiring in ``main.py`` needs
    no branch of its own beyond the setting read — and a box that has never heard of schedules
    behaves byte-identically to before this phase.
    """

    def __init__(
        self,
        *,
        pool,
        redis,
        poll_interval_seconds: int = 60,
        max_claims_per_tick: int = 10,
    ) -> None:
        self._pool = pool
        self._redis = redis
        self._poll_interval_seconds = poll_interval_seconds
        self._max_claims_per_tick = max_claims_per_tick
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        # Observability that costs nothing and answers the only question an operator has
        # about a background loop ("is it running, and has it done anything?").
        self.ticks = 0
        self.launched = 0

    async def tick(self) -> int:
        """Claim and launch every due schedule once. Returns how many were LAUNCHED.

        ⚠ A schedule whose launch raises is recorded and SKIPPED — the loop continues to the
        next claimed row. One malformed workflow must not stop every other schedule on the
        install from firing, and the claim has already advanced its ``next_run_at`` so it will
        not be retried until its next cadence.
        """
        from app.db.schedules import claim_due_schedules, record_schedule_outcome

        claimed = await claim_due_schedules(self._pool, limit=self._max_claims_per_tick)
        launched = 0
        for schedule in claimed:
            try:
                run_id = await launch_scheduled_run(
                    schedule, pool=self._pool, redis=self._redis
                )
            except ScheduledLaunchRefused:
                # Phase 295: refused with words, already recorded; never overwrite them.
                continue
            except Exception:  # noqa: BLE001
                logger.exception("schedule %s failed to launch", schedule.get("id"))
                run_id = None
            if run_id is None:
                await record_schedule_outcome(
                    self._pool, _as_uuid(schedule["id"]), status=LAUNCH_FAILED
                )
                continue
            launched += 1
        self.ticks += 1
        self.launched += launched
        return launched

    async def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                n = await self.tick()
                if n:
                    logger.info("scheduler launched %d scheduled run(s)", n)
            except Exception:  # noqa: BLE001 — a failed tick never ends the loop
                logger.exception("scheduler tick failed (the loop continues)")
            try:
                # `wait_for` on the stop event rather than a bare sleep, so shutdown does not
                # have to wait out a full poll interval.
                await asyncio.wait_for(
                    self._stopping.wait(), timeout=self._poll_interval_seconds
                )
            except asyncio.TimeoutError:
                pass

    def start(self) -> None:
        if self._task is not None:
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stopping.set()
        task, self._task = self._task, None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


def _as_uuid(value: Any) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
