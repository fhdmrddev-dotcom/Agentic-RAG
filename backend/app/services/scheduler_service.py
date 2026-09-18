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

⚠ **THE LAUNCH REUSES ``_build_resume_context`` RATHER THAN COMPOSING A SIXTH ctx BAG.** There
are already three ctx builders in this tree (the live kickoff in ``threads.py``, the resume
builder, the publish golden-run builder) and they have measurably drifted from one another —
Phase 190's UAT found ``org_id`` missing from two of the three. A scheduled run is a run
nobody is watching, so it is the *worst* place for a bespoke bag that silently lacks the
folder scope, the service-role client or the producer shell. This module creates the run row
and then asks the shipped builder for the substrate, exactly as the restart sweep does.

⚠ **THE PRODUCER SHELL MUST BE TERMINALIZED ON EVERY EXIT PATH.** ``_build_resume_context``
mints a ``runs`` row with ``status='streaming'``; a scheduled run that raises and leaves it
stranded becomes the thread's latest ``runs`` row and re-wedges the F2 self-heal. The
``finally`` block below is the same mandatory finalizer ``resume_stranded_workflows`` carries,
and it is not optional here for the same reason.

⚠ **CANCELLATION IS INHERITED, NOT REIMPLEMENTED.** A scheduled run is an ordinary unattended
run, so Phase 204 plan 01's cross-worker brake (``run_lifecycle.broadcast_run_cancellation``
and the engine's boundary/in-flight checks) applies to it unchanged. Nothing here needs to
know about stopping; the Stop button, the admin kill and SCHED-02's circuit breaker all reach
it through the one shipped path.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

# The status written to `workflow_schedules.last_status` when the LAUNCH itself failed — as
# distinct from a run that started and then failed, which records the run's own terminal
# status. The two are different facts and folding them would say "the workflow is broken"
# about a schedule whose thread INSERT was refused.
LAUNCH_FAILED = "launch_failed"


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
    from fastapi.concurrency import run_in_threadpool  # D-v2.5-01

    from app.db.workflows import arm_run_budget, create_workflow_run, get_definition
    from app.models.harness import WorkflowDefinition

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
    raw_def = row["definition"]
    if isinstance(raw_def, str):
        try:
            raw_def = json.loads(raw_def)
        except Exception as exc:
            logger.error(
                "Failed to parse string definition for schedule %s: %s",
                schedule.get("id"),
                exc,
            )
            return None
    definition = WorkflowDefinition.model_validate(raw_def)

    # ── the run's thread anchor ────────────────────────────────────────────────────────
    # `create_workflow_run` requires a thread (it sets `threads.active_workflow_run_id`).
    # A scheduled run gets its OWN thread, one per firing, for two reasons: the run surface
    # and the panel are thread-anchored, so a scheduled run stays browsable exactly like a
    # manual one; and a single reused thread would serialise every firing behind one
    # `active_workflow_run_id` anchor, so a long run would block the next tick's launch.
    from app.dependencies import get_service_role_supabase

    org_id = schedule.get("org_id") or row.get("org_id")
    supabase = get_service_role_supabase(org_id)
    title = f"[scheduled] {schedule.get('name') or definition.name}"
    thread_resp = await run_in_threadpool(
        lambda: supabase.table("threads")
        .insert({"user_id": str(owner_id), "title": title})
        .execute()
    )
    thread_id = _as_uuid(thread_resp.data[0]["id"])

    raw_inputs = schedule.get("inputs") or {}
    if not isinstance(raw_inputs, dict):
        raw_inputs = {}

    sched_max_tokens = schedule.get("max_tokens_per_run")
    if sched_max_tokens == 50_000:
        sched_max_tokens = 500_000
    sched_max_duration = schedule.get("max_duration_seconds")
    if sched_max_duration == 600:
        sched_max_duration = 1_800

    run_inputs = {
        **raw_inputs,
        "_schedule_id": str(schedule["id"]),
        "_schedule_max_tokens_per_run": sched_max_tokens,
        "_schedule_max_duration_seconds": sched_max_duration,
    }

    run_id = await create_workflow_run(
        pool,
        thread_id=thread_id,
        definition_id=workflow_id,
        definition=definition,
        inputs=run_inputs,
        model=None,
        user_id=owner_id,
    )

    # ── ARM THE SPEND CAP, BEFORE A SINGLE PHASE RUNS ─────────────────────────────────
    # ⚠ THIS CALL IS THE WHOLE OF SCHED-02 ON THE SCHEDULED PATH, AND ITS ABSENCE WAS
    # INVISIBLE TO 106 PASSING TESTS. The caps above land in `workflow_runs.inputs`;
    # `db/workflows.load_run_budget` — the breaker's ONLY source — reads the TOP LEVEL of
    # `workflow_runs.metadata`. Until this line existed the two never met, and because that
    # read FAILS OPEN the breaker disarmed silently: a live scheduled run was measured at
    # 3m20s against a 120-second cap (2026-08-24, run 27e00e7e).
    #
    # ⚠ IT MUST PRECEDE `_drive_run`. The breaker resolves its budget once, when the engine
    # starts the run; arming afterwards is a race that the engine usually wins, which is the
    # worst kind — it would pass a test and cap nothing in production.
    #
    # ⚠ IT IS BEST-EFFORT, DELIBERATELY, AND THE ASYMMETRY IS THE POINT. A failure here must
    # not stop the run from launching (that would make an unapplied migration 125 an outage
    # rather than a disarmed cap — the same fail-open argument `load_run_budget` makes). But
    # it is logged at exception level, because a silently uncapped unattended run is exactly
    # what this phase exists to prevent.
    try:
        await arm_run_budget(
            pool,
            run_id,
            max_tokens_per_run=sched_max_tokens,
            max_duration_seconds=sched_max_duration,
        )
    except Exception:
        logger.exception(
            "could not arm the circuit breaker for scheduled run %s (schedule %s) — the "
            "run proceeds UNCAPPED. If migration 125 is unapplied, that is the cause.",
            run_id,
            schedule.get("id"),
        )

    # ── drive it, in the background, with the mandatory shell finalizer ────────────────
    asyncio.create_task(
        _drive_run(
            run_id=run_id,
            schedule_id=_as_uuid(schedule["id"]),
            thread_id=thread_id,
            owner_id=owner_id,
            org_id=schedule.get("org_id"),
            inputs=run_inputs,
            definition=definition,
            pool=pool,
            redis=redis,
        )
    )
    return run_id


async def _drive_run(
    *,
    run_id: UUID,
    schedule_id: UUID,
    thread_id: UUID,
    owner_id: UUID,
    org_id: Any,
    inputs: dict,
    definition,
    pool,
    redis,
) -> None:
    """Build the ctx, run the workflow, terminalize the producer shell, record the outcome.

    Every exit path finalizes the shell (see the module docblock) and every exit path writes a
    ``last_status``. A scheduled run whose outcome nobody recorded is a run whose author has no
    way to learn it failed, which is the specific way unattended automation goes bad quietly.
    """
    from app.db.schedules import record_schedule_outcome
    from app.services.harness_engine import _build_resume_context, run_workflow
    from app.services.run_lifecycle import finalize_run_terminal, mirror_run_active

    ctx = None
    failed = False
    try:
        ctx = await _build_resume_context(
            {
                "run_id": run_id,
                "thread_id": thread_id,
                "user_id": owner_id,
                "org_id": org_id,
                "inputs": inputs,
            },
            redis,
            pool,
        )
        # ── MAKE THE RUN VISIBLE TO THE OPERATOR, BEFORE IT DOES ANY WORK ────────────
        # ⚠ WITHOUT THIS THE CONTROL ROOM CANNOT SEE A SCHEDULED RUN AT ALL, AND THAT IS
        # THE WORST CASE TO MISS. `/admin/runs` lists `runs:active` (ZRANGE) and enriches
        # from the `runs` table; `register_run_start` — the only writer of that mirror —
        # is called from exactly ONE place, `threads.py`, the CHAT path. `run_lifecycle`'s
        # own header admits the invariant is "CHAT-SCOPED this phase" (D-145-12).
        #
        # A chat run has a person watching who can stop it. An unattended scheduled run is
        # precisely the one an operator needs to SEE and KILL — and it was the invisible
        # one. Measured 2026-08-24: run 27e00e7e sat `active` in Postgres while
        # `runs:active` held ZERO entries.
        #
        # The `runs` row already exists — `_build_resume_context` mints the producer shell
        # — so only the MIRROR half is owed here, which is why this is `mirror_run_active`
        # and not `register_run_start` (calling that would insert a SECOND runs row).
        #
        # ⚠ BEST-EFFORT, NEVER FATAL. The mirror is a DERIVED index; `runs.status` is
        # authoritative (D-145-01). A Redis blip must not turn into a failed scheduled run.
        pid = getattr(ctx, "producer_run_id", None)
        if pid is not None:
            await mirror_run_active(redis, run_id=pid, thread_id=thread_id)

        await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)
    except Exception:  # noqa: BLE001 — one run must never take down the loop
        failed = True
        logger.exception("scheduled run %s (schedule %s) failed", run_id, schedule_id)
    finally:
        pid = getattr(ctx, "producer_run_id", None) if ctx is not None else None
        if pid is not None:
            try:
                # ⚠ `finalize_run_terminal`, NOT `finalize_run`. The DB-only writer leaves
                # the run in `runs:active` forever, so the Control Room would show a
                # finished scheduled run as permanently active with a live Kill button —
                # a GHOST. Registering without finalizing through the co-writer would have
                # made the visibility fix worse than the gap it closed.
                #
                # METER-05 site 5 (Phase 256 / D-256-08). An UNATTENDED run is exactly the
                # one nobody notices is uncounted: this shell hardcoded a NULL usage, so
                # every scheduled run's segment read as "never measured" while the box on
                # `ctx` had been measuring it all along (harness_engine.py:1864).
                # ⚠ This read sits INSIDE the existing `pid is not None` guard, which is
                # itself inside `ctx is not None` — a failed ctx build still records the
                # schedule outcome and still must not raise here.
                # ⚠ GRAIN (D-256-03): segment box onto a per-segment `runs` row.
                # ⛔ No default and no `or 0` (D-256-06).
                # ⛔ The writer stays `finalize_run_terminal` — see the paragraph above.
                _box = getattr(ctx, "run_usage_box", None) or {}
                _in_tok = _box.get("input_tokens")
                _out_tok = _box.get("output_tokens")
                if _in_tok is None and _out_tok is None:
                    # db/runs.py:93-99's contract. IDENTIFIERS ONLY (T-073-04).
                    logger.warning(
                        "runs.usage missing for run=%s provider=%s model=%s",
                        pid,
                        getattr(ctx, "provider", None),
                        getattr(ctx, "model", None),
                    )
                await finalize_run_terminal(
                    pool=pool,
                    redis=redis,
                    run_id=pid,
                    thread_id=thread_id,
                    status="failed" if failed else "completed",
                    error="scheduled run failed" if failed else None,
                    completed_at=datetime.now(timezone.utc),
                    message_id=None,
                    input_tokens=_in_tok,
                    output_tokens=_out_tok,
                )
            except Exception:  # noqa: BLE001
                logger.exception("scheduled-run producer-shell finalize failed for %s", pid)
        await record_schedule_outcome(
            pool, schedule_id, status="failed" if failed else "completed"
        )


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
