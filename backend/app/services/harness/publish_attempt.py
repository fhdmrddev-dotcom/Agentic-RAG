"""Phase 308.1 (BUG-261107-01) — the background publish attempt: the golden run outside the request.

THE CONCERN. ``POST /workflows/{id}/publish`` used to hold its request open for the whole golden
run: minutes, up to ``harness_publish_max_seconds``. On production (2026-11-07) a backend worker was
killed mid-run and the request, the run and the verdict died together; the author read "Failed to
fetch" and nothing was recorded. This module is what moved the golden run out of the request.

WHAT HAPPENS NOW (308.1-02):

* ``publish_service.start_publish`` runs the cheap stages 0-2.6 in the request, exactly as before,
  then calls :func:`begin_background_attempt`. Under a Postgres advisory lock keyed on the draft
  (D-10), that either returns the handle of this user's attempt already in flight, or creates the
  golden run, records the attempt on the run row (D-09) and, once the lock is released, spawns the
  drive (:func:`spawn_attempt`). The route answers 202 with the running handle at once (D-08).
* :func:`_attempt_task` re-reads everything from the run ROW (definition snapshot, stored inputs,
  the record), builds its ctx through the ONE golden ctx builder ``publish_tail._golden_ctx``
  (``is_golden_run=True``, no ``org_id``; D-15), and drives the run within what is LEFT of the
  publish budget, measured from the row's ``created_at``.
* When the run ends, :func:`finish_attempt_tail` claims the tail with ONE conditional UPDATE
  (``db.workflows.claim_publish_tail``, ``running -> finishing``; D-17). Only the winner runs the
  tail (structural gate, argument check, judge, flip, audit: ``publish_tail.run_tail_stages``, the
  same order and the same block words; D-16) and records the verdict with ``state: done``. A
  passing run flips exactly once with the token captured at stage 0; a judge failure flips nothing
  (D-18).

THE RECORD (``workflow_runs.metadata.publish``, written as a PLAIN DICT, never pre-dumped)::

    {"state": "running" | "finishing" | "done", "stage0_token": str | None,
     "golden_input": str, "definition_id": str, "requested_by": str,
     "finishing_at": None | <timestamp written by the claim>, "verdict": None | <PublishVerdict>}

⛔ POSTGRES IS THE RECORD, NEVER REDIS OR A WORKER-LOCAL DICT. Two uvicorn workers serve the app and
either can be killed at any moment; whatever is needed to finish the publish on the OTHER worker
lives on the run row. The task set below only keeps tasks alive (the event loop holds tasks
weakly); it is never consulted to decide anything.

⛔ GRACEFUL SHUTDOWN (a deploy) WRITES NOTHING. A cancel while ``is_app_shutting_down()`` is true
re-raises at once: no tail claim, no verdict, and the drive's ``finally`` leaves the run row
``active`` (``publish_tail._drive_created``) so the next boot can re-drive it (Pitfall 9, 096-09).

⛔ NEVER THROUGH THE GENERIC RESUME PATH. Golden runs stay excluded from the resume finder and from
``_build_resume_context`` (D-12, the Phase 190 A4 fence). The golden sweep that re-drives a golden
run stranded by a dead worker, closes one that cannot be finished, and re-tails a run whose tail
never ran or whose ``finishing`` claim went stale, lands HERE in 308.1-03, and re-uses
:func:`spawn_attempt` and :func:`finish_attempt_tail`.

⚠ PITFALL 13. ``config.py``'s comment that the background-job publish *stays deferred*, and the
resume finder's docstring calling an abandoned golden run *correct*, are superseded by this module.
Both files stay unedited (D-05 / D-12); the correction lives here, in ``publish_tail``'s docstring
and in ``docs/HOT-FILE-LEDGER.md``.

LATE BINDING. Every ``publish_service`` name is called as ``_ps.<name>`` through a function-local
import (tests patch them there, and ``publish_service`` imports THIS module back inside
``start_publish``). Database helpers and engine entry points are imported function-locally from
their source modules, where tests patch them. ``publish_tail`` never imports this module.
"""

from __future__ import annotations

import asyncio
import logging
import os
from uuid import UUID

logger = logging.getLogger(__name__)

#: Strong references to the attempt tasks until they finish (``unattended_launch``'s shape). The
#: event loop keeps only a weak reference to a task, so an unreferenced drive can be
#: garbage-collected mid-run.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _running_handle(run_id, state: str) -> dict:
    """The 202 body: a ``PublishVerdict``-shaped dict plus ``state`` (D-08)."""
    return {
        "published": False,
        "blocked_stage": None,
        "named_failures": [],
        "golden_run_id": run_id,
        "state": state,
    }


def _budget_words(seconds) -> str:
    """The inline stage-3 timeout sentence, verbatim (``publish_service.publish_workflow``)."""
    return f"the golden run exceeded the publish budget ({seconds}s) and was abandoned"


def _error_words(e: BaseException) -> str:
    """The inline stage-3 crash sentence, verbatim: the exception TYPE name is kept (ledger)."""
    err_msg = f"{type(e).__name__}: {e}" if str(e).strip() else type(e).__name__
    return f"golden run could not complete: {err_msg}"


async def _end_undriven(pool, run_id, *, user_id, escape) -> None:
    """End a golden run that will not be driven (it failed before its drive, or its budget is
    already spent) ``failed`` with words and one ``run_failed``, never leaving it ``active``.
    Never raises."""
    from app.services.harness.run_handoff import end_run, golden_end_reason  # noqa: PLC0415

    try:
        await asyncio.shield(
            end_run(
                pool,
                run_id,
                "failed",
                user_id=user_id,
                reason=golden_end_reason(escape),
                fail_active_phase=True,
            )
        )
    except Exception:  # noqa: BLE001 — the publish verdict must still be recorded
        logger.warning("publish: golden run %s could not be ended", run_id, exc_info=True)


async def begin_background_attempt(
    *,
    definition_id: UUID,
    definition,
    golden_input: str,
    user_id: UUID,
    stage0_token,
    pool,
    redis,
) -> dict:
    """Create the golden run, record the attempt, start the drive; return the running handle.

    D-10: under ``publish_attempt_lock`` (a Postgres advisory lock keyed on the draft, so two
    workers cannot both pass the check), an attempt of THIS user on THIS draft that is still
    ``running`` / ``finishing`` and younger than the publish budget is returned as-is: same run,
    same handle, nothing created. Otherwise the run is created (``publish_tail._create_golden_run``)
    and the D-09 record written before the lock is released. The task is spawned AFTER the lock is
    released, so the lock is never held for the length of a run.

    Sealed like the inline orchestration: a failure creating the run returns the structured
    ``golden_run_error`` block (run id preserved when it exists, the run itself ended with words),
    never an exception into the route.
    """
    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import (  # noqa: PLC0415
        active_publish_attempt,
        publish_attempt_lock,
        write_publish_attempt,
    )
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness import publish_tail  # noqa: PLC0415

    run_id = None
    try:
        async with publish_attempt_lock(pool, definition_id):
            existing = await active_publish_attempt(
                pool,
                definition_id=definition_id,
                user_id=user_id,
                max_age_seconds=settings.harness_publish_max_seconds,
            )
            if existing is not None:
                logger.info(
                    "publish: definition %s already has golden run %s in flight (%s)",
                    definition_id,
                    existing["run_id"],
                    existing["state"],
                )
                return _running_handle(existing["run_id"], existing["state"])
            created = await publish_tail._create_golden_run(
                definition_id=definition_id,
                definition=definition,
                golden_input=golden_input,
                user_id=user_id,
                pool=pool,
                supabase=None,
            )
            run_id = created["run_id"]
            # D-09 — every value a JSON primitive; the PLAIN DICT goes to the codec.
            await write_publish_attempt(
                pool,
                run_id,
                {
                    "state": "running",
                    "stage0_token": stage0_token,
                    "golden_input": golden_input,
                    "definition_id": str(definition_id),
                    "requested_by": str(user_id),
                    "finishing_at": None,
                    "verdict": None,
                },
            )
    except Exception as e:  # noqa: BLE001 — a failed start is a structured block, never a 500
        logger.exception("publish: golden run could not be started for definition %s", definition_id)
        if run_id is not None:
            await _end_undriven(pool, run_id, user_id=user_id, escape=e)
        return await _ps._block(
            pool,
            run_id=run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_error",
            named_failures=[_error_words(e)],
            golden_run_id=run_id,
        )

    spawn_attempt(run_id, pool=pool, redis=redis)
    return _running_handle(run_id, "running")


def spawn_attempt(run_id, *, pool, redis) -> asyncio.Task:
    """Start :func:`_attempt_task` for ``run_id`` on this worker's loop, strongly referenced."""
    task = asyncio.create_task(
        _attempt_task(run_id, pool=pool, redis=redis), name=f"publish-attempt-{run_id}"
    )
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task


async def _attempt_task(run_id, *, pool, redis) -> None:
    """Drive one golden run from its RECORD, then finish the publish (claim, tail, verdict).

    Reads the run row, never request memory: the definition is the run's ``definition_snapshot``
    (what the run started with, whatever the draft says now), the inputs are the stored
    ``workflow_runs.inputs``, and the token and author are the record's. The drive is bounded by
    ``harness_publish_max_seconds`` minus the time since the row's ``created_at``, so a drive can
    never grant itself a fresh budget.
    """
    from datetime import datetime, timezone  # noqa: PLC0415

    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import load_publish_attempt  # noqa: PLC0415
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness import publish_tail  # noqa: PLC0415
    from app.services.harness_engine import is_app_shutting_down  # noqa: PLC0415

    # Identifiers only. The pid is what tells the operator WHICH worker drove a run (D-25 row 2).
    logger.info("publish: golden run %s driven by pid %s", run_id, os.getpid())

    drive_error: BaseException | None = None
    timed_out = False
    drive_started = False
    user_id = None
    try:
        attempt = await load_publish_attempt(pool, run_id)
        if attempt is None or attempt.get("publish") is None:
            logger.warning("publish: golden run %s carries no attempt record; not driven", run_id)
            return
        user_id = attempt["user_id"]
        definition = WorkflowDefinition.model_validate(attempt["definition_snapshot"])
        elapsed = (datetime.now(timezone.utc) - attempt["created_at"]).total_seconds()
        remaining = settings.harness_publish_max_seconds - elapsed
        if remaining <= 0:
            timed_out = True
            await _end_undriven(pool, run_id, user_id=user_id, escape=asyncio.TimeoutError())
        else:
            supabase, org_id = await _ps._resolve_publish_supabase(
                None, definition_id=attempt["definition_id"], pool=pool
            )
            owner_settings, ctx_model, folder_subtree_ids = await publish_tail._golden_run_scope(
                definition, user_id, supabase
            )
            ctx, producer_id = await publish_tail._golden_ctx(
                run_id=run_id,
                thread_id=attempt["thread_id"],
                user_id=user_id,
                org_id=org_id,
                owner_settings=owner_settings,
                ctx_model=ctx_model,
                golden_inputs=attempt["inputs"],
                folder_subtree_ids=folder_subtree_ids,
                supabase=supabase,
                pool=pool,
                redis=redis,
            )
            drive_started = True
            await asyncio.wait_for(
                publish_tail._drive_created(
                    run_id=run_id,
                    definition=definition,
                    ctx=ctx,
                    producer_id=producer_id,
                    user_id=user_id,
                    pool=pool,
                    redis=redis,
                ),
                timeout=remaining,
            )
    except asyncio.TimeoutError:
        # The drive's own ``finally`` already ended the run row with words (not a shutdown).
        timed_out = True
        logger.warning(
            "publish: golden run %s exceeded the publish budget (%ss)",
            run_id,
            settings.harness_publish_max_seconds,
        )
    except asyncio.CancelledError:
        # ⛔ Pitfall 9: a deploy cancels us. Claim nothing and record nothing, so the next boot's
        # golden sweep (308.1-03) can re-drive the run. Any other cancel is re-raised too (a
        # cancelled task must stay cancelled); the drive's ``finally`` has ended the run row and
        # the sweep finishes the tail of a terminal run whose record still reads ``running``.
        if is_app_shutting_down():
            logger.info("publish: golden run %s left for the next boot (shutdown)", run_id)
        raise
    except Exception as e:  # noqa: BLE001 — a crash is a recorded verdict, never a lost publish
        drive_error = e
        logger.exception("publish: golden run %s failed", run_id)
        if not drive_started and user_id is not None:
            await _end_undriven(pool, run_id, user_id=user_id, escape=e)

    await finish_attempt_tail(run_id, pool=pool, drive_error=drive_error, timed_out=timed_out)


async def finish_attempt_tail(
    run_id, *, pool, drive_error: BaseException | None = None, timed_out: bool = False
) -> dict | None:
    """Claim the publish tail of a golden run that has ended; run it and record the verdict.

    ``claim_publish_tail`` decides the winner (D-17): a ``None`` means another worker owns the
    tail, and this call runs nothing, writes no receipt and no verdict. The winner builds the
    verdict from the RUN ROW: a spent budget is the inline ``golden_run_timeout`` block, a drive
    that raised is the inline ``golden_run_error`` block (exception type name kept, run id
    preserved), and otherwise the outcome is harvested from ``load_run_phases`` and the tail runs
    through ``run_tail_stages`` with the record's ``stage0_token``, ``golden_input`` and
    ``requested_by`` (D-16 / D-18). The verdict is written JSON-safe (``jsonable_encoder``: UUIDs
    become strings, Pitfall 5) with ``state: done``, exactly once.

    If the tail itself raises after the claim, the record stays ``finishing``; once that claim is
    older than ``harness_resume_lease_seconds`` it is claimable again (the sweep's recovery arm).
    Returns the verdict, or ``None`` when nothing was recorded here.
    """
    from fastapi.encoders import jsonable_encoder  # noqa: PLC0415

    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import (  # noqa: PLC0415
        claim_publish_tail,
        finish_publish_attempt,
        load_publish_attempt,
        load_run_phases,
    )
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness import publish_tail  # noqa: PLC0415

    record = await claim_publish_tail(pool, run_id, settings.harness_resume_lease_seconds)
    if record is None:
        logger.info("publish: the tail of golden run %s belongs to another claim", run_id)
        return None

    try:
        attempt = await load_publish_attempt(pool, run_id)
        definition_id = UUID(str(record.get("definition_id") or attempt["definition_id"]))
        user_id = UUID(str(record.get("requested_by") or attempt["user_id"]))
        definition = WorkflowDefinition.model_validate(attempt["definition_snapshot"])
        if timed_out:
            verdict = await _ps._block(
                pool,
                run_id=run_id,
                user_id=user_id,
                definition_id=definition_id,
                stage="golden_run_timeout",
                named_failures=[_budget_words(settings.harness_publish_max_seconds)],
                golden_run_id=run_id,
            )
        elif drive_error is not None:
            verdict = await _ps._block(
                pool,
                run_id=run_id,
                user_id=user_id,
                definition_id=definition_id,
                stage="golden_run_error",
                named_failures=[_error_words(drive_error)],
                golden_run_id=run_id,
                blocked_step=await publish_tail._blocked_step_for_run(pool, run_id, definition),
            )
        else:
            # The outcome comes from the ROWS, never from in-memory drive state: a re-tail after a
            # dead worker has none (308.1-03), and the reconciler may have ended the run itself.
            phases = await load_run_phases(pool, run_id)
            terminal_status = (
                "failed" if any(p.get("status") == "failed" for p in phases) else "completed"
            )
            final_output = publish_tail._deliverable_output(phases)
            tool_schemas = await _ps._bound_tool_schemas(
                definition, definition_id=definition_id, pool=pool
            )
            verdict = await _ps.run_tail_stages(
                definition_id=definition_id,
                definition=definition,
                golden_input=record.get("golden_input") or "",
                user_id=user_id,
                pool=pool,
                golden_run_id=run_id,
                final_output=final_output,
                terminal_status=terminal_status,
                tool_schemas=tool_schemas,
                stage0_token=record.get("stage0_token"),
            )
    except Exception:  # noqa: BLE001 — the claim lapses; the sweep's stale-finishing arm re-runs it
        logger.exception("publish: the tail of golden run %s failed after its claim", run_id)
        return None

    await finish_publish_attempt(pool, run_id, jsonable_encoder(verdict))
    return verdict
