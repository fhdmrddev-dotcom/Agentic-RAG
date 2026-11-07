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

⛔ NEVER THROUGH THE GENERIC RESUME PATH. Golden runs stay excluded from the generic resume finder
and from the engine's resume ctx builder (D-12, the Phase 190 A4 fence). The golden sweep
(:func:`resume_stranded_golden_runs`, 308.1-03) has its own finders and re-uses
:func:`spawn_attempt` and :func:`finish_attempt_tail`:

* ``main.py`` calls it FIRST inside the existing boot and late resume passes, in its own
  ``try`` (D-13). The late pass (lease + 30 s) is what catches the dead worker's OWN run: at
  boot its heartbeat is still fresh, so ``claim_run`` refuses it.
* arm A: every stranded ``active`` golden run is claimed with ``claim_run`` first. With no
  publish record (a pre-308.1 orphan) it is closed ``failed`` with :data:`NO_RECORD_WORDS` and
  one ``publish_blocked`` receipt; past ``harness_publish_max_seconds`` it is closed with the
  timeout words and gets the ``golden_run_timeout`` verdict (D-14); otherwise it is re-driven
  through :func:`spawn_attempt` and the ONE golden ctx (D-11, D-15). The killed step re-runs
  from the top (``run_workflow`` skips completed steps). The sweep never awaits a re-drive.
* arm B: a run that ENDED while its record still reads ``running``, or a ``finishing`` claim
  older than the lease, gets a spawned ``finish_attempt_tail(recovered=True)`` (D-17). A
  recovered tail reads ROWS: after a flip that already happened it records the success with the
  ``publish_succeeded`` receipt's version (Pitfall 7, never a false ``already_published``); a
  failed or cancelled run with no failed step gets ``golden_run_error`` with the run's own
  recorded ``run_failed`` words (Pitfall 8, never a fabricated exception text).

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

#: D-14: the words for a stranded golden run that has no publish record (a pre-308.1 orphan). It
#: cannot be finished: nothing says what was being published or with which token.
NO_RECORD_WORDS = (
    "the golden run was interrupted by a server restart before it had a publish record, "
    "so it could not be finished — publish again"
)


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
        PublishAttemptBusy,
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
                lease_seconds=settings.harness_resume_lease_seconds,
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
    except PublishAttemptBusy as busy:
        # 308.1 review WR-04: the lock wait is BOUNDED. Another POST on this draft held the lock
        # past it, so that POST is creating the attempt right now: answer THAT attempt's handle
        # (no second run). Nothing to answer means the holder failed; that is a sealed block.
        logger.warning("publish: definition %s lock wait gave up (another POST)", definition_id)
        try:
            existing = await active_publish_attempt(
                pool,
                definition_id=definition_id,
                user_id=user_id,
                max_age_seconds=settings.harness_publish_max_seconds,
                lease_seconds=settings.harness_resume_lease_seconds,
            )
        except Exception:  # noqa: BLE001
            existing = None
        if existing is not None:
            return _running_handle(existing["run_id"], existing["state"])
        return await _ps._block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_error",
            named_failures=[_error_words(busy)],
            golden_run_id=None,
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


def _spawn(coro, *, name: str) -> asyncio.Task:
    """The ONE task spawner of this module: strongly referenced until it finishes."""
    task = asyncio.create_task(coro, name=name)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task


def spawn_attempt(run_id, *, pool, redis) -> asyncio.Task:
    """Start :func:`_attempt_task` for ``run_id`` on this worker's loop, strongly referenced."""
    return _spawn(_attempt_task(run_id, pool=pool, redis=redis), name=f"publish-attempt-{run_id}")


def recover_publish_tail(run_id, *, pool, expired: bool = False) -> asyncio.Task:
    """Spawn a recovered tail (``finish_attempt_tail(recovered=True)``) for a stranded record.

    The ONE recovery entry, shared by the golden sweep's arm B and (308.1 review CR-02) the
    follow read, which notices a stranded tail while both workers stay up. Spawned, never
    awaited; the tail CAS decides the single winner, so a second spawn for the same run (two
    polls, or a poll and the sweep) runs nothing.

    ``expired`` (308.1 review WR-06): the attempt is past the publish budget plus the lease. The
    tail then records the existing ``golden_run_timeout`` verdict and never judges or flips
    (a flip that already happened is still recognised by its receipt, Pitfall 7)."""
    kwargs = {"recovered": True, "timed_out": True} if expired else {"recovered": True}
    return _spawn(finish_attempt_tail(run_id, pool=pool, **kwargs), name=f"publish-tail-{run_id}")


async def resume_stranded_golden_runs(*, pool, redis) -> int:
    """The golden sweep (D-11..D-14, D-17): act on golden runs and tails a dead worker left.

    Arm A claims every stranded ``active`` golden run with ``claim_run`` (the generic sweep's CAS,
    so two workers never act on the same run) and then closes it with words or re-drives it. Arm B
    spawns a recovered tail for each ended run whose publish tail never finished; the tail CAS
    decides the single winner. Re-drives and recovered tails are SPAWNED, never awaited, so the
    generic resume that follows is never held up. One run's failure never stops the sweep.
    Returns the number of runs acted on.
    """
    from datetime import datetime, timezone  # noqa: PLC0415

    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import (  # noqa: PLC0415
        claim_run,
        find_stranded_golden_runs,
        find_stranded_publish_tails,
    )

    lease = settings.harness_resume_lease_seconds
    acted = 0
    try:
        stranded = await find_stranded_golden_runs(pool, lease)
    except Exception:  # noqa: BLE001 — arm B still runs
        logger.exception("publish: the golden sweep could not list stranded golden runs")
        stranded = []
    for row in stranded:
        run_id = row["run_id"]
        try:
            if not await claim_run(pool, run_id, lease):
                continue  # another worker owns it, or its producer is still beating
            acted += 1
            if not row.get("has_publish"):
                await _close_orphan(pool, row)
                continue
            age = (datetime.now(timezone.utc) - row["created_at"]).total_seconds()
            if age >= settings.harness_publish_max_seconds:
                await _end_undriven(
                    pool, run_id, user_id=row.get("user_id"), escape=asyncio.TimeoutError()
                )
                await finish_attempt_tail(run_id, pool=pool, timed_out=True)
                continue
            logger.info("publish: re-driving stranded golden run %s (pid %s)", run_id, os.getpid())
            spawn_attempt(run_id, pool=pool, redis=redis)
        except Exception:  # noqa: BLE001 — the next run still gets its turn
            logger.exception("publish: the golden sweep could not act on run %s", run_id)

    try:
        tails = await find_stranded_publish_tails(
            pool, lease, max_age_seconds=settings.harness_publish_max_seconds
        )
    except Exception:  # noqa: BLE001
        logger.exception("publish: the golden sweep could not list stranded publish tails")
        tails = []
    for row in tails:
        run_id = row["run_id"]
        logger.info("publish: finishing the stranded publish tail of golden run %s", run_id)
        recover_publish_tail(run_id, pool=pool, expired=bool(row.get("expired")))
        acted += 1
    return acted


async def _close_orphan(pool, row) -> None:
    """D-14: a stranded golden run with no publish record is ended ``failed`` with words, and the
    winner of that end writes ONE ``publish_blocked`` receipt naming the run."""
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness.run_handoff import end_run  # noqa: PLC0415

    run_id = row["run_id"]
    won = await end_run(
        pool,
        run_id,
        "failed",
        user_id=row.get("user_id"),
        reason=NO_RECORD_WORDS,
        fail_active_phase=True,
    )
    if not won:
        return  # another writer ended it first; it owns the record of why
    await _ps._block(
        pool,
        run_id=run_id,
        user_id=row.get("user_id"),
        definition_id=row.get("definition_id"),
        stage="golden_run_error",
        named_failures=[NO_RECORD_WORDS],
        golden_run_id=run_id,
    )


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
        # golden sweep (308.1-03) can re-drive the run.
        if is_app_shutting_down():
            logger.info("publish: golden run %s left for the next boot (shutdown)", run_id)
            raise
        # 308.1 review CR-01: any OTHER cancel is a Stop (``DELETE /runs/{id}`` cancels this very
        # task through the engine's cancellation watch). The row is already ended (by the Stop,
        # or by the drive's ``finally``), so the publish is finished NOW, in a task the cancel
        # cannot reach, from the ROWS (``recovered=True``: a stopped run with no failed step gets
        # ``golden_run_error`` in the run's own recorded words). Never a ``running`` record left
        # on a terminal run. A cancel before the drive started ends the row first. The task
        # itself stays cancelled.
        logger.info("publish: golden run %s was stopped; finishing its publish", run_id)
        _spawn(
            _finish_after_stop(run_id, pool=pool, user_id=user_id, end_first=not drive_started),
            name=f"publish-tail-{run_id}",
        )
        raise
    except Exception as e:  # noqa: BLE001 — a crash is a recorded verdict, never a lost publish
        drive_error = e
        logger.exception("publish: golden run %s failed", run_id)
        if not drive_started:
            # CR-02: even with no author read yet (``load_publish_attempt`` itself raised), the
            # row is ended with words — ``end_run`` falls back to the row's own ``user_id``.
            await _end_undriven(pool, run_id, user_id=user_id, escape=e)

    await finish_attempt_tail(run_id, pool=pool, drive_error=drive_error, timed_out=timed_out)


async def _finish_after_stop(run_id, *, pool, user_id, end_first: bool) -> None:
    """CR-01: finish the publish of a golden run that was STOPPED (not a shutdown).

    Spawned, never awaited by the cancelled task. ``end_first`` (the drive never started, so its
    ``finally`` never ended the row) ends the row ``failed`` with the generic golden words first.
    Then the recovered tail claims and records the verdict from the rows. Never raises."""
    try:
        if end_first:
            await _end_undriven(pool, run_id, user_id=user_id, escape=None)
        await finish_attempt_tail(run_id, pool=pool, recovered=True)
    except Exception:  # noqa: BLE001 — the read-side recovery (CR-02) is the second net
        logger.exception("publish: the stopped golden run %s could not be finished", run_id)


async def finish_attempt_tail(
    run_id,
    *,
    pool,
    drive_error: BaseException | None = None,
    timed_out: bool = False,
    recovered: bool = False,
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
    older than ``harness_resume_lease_seconds`` it is claimable again, and the follow read
    (``GET /workflows/{id}/publish``) or the golden sweep recovers it (308.1 review CR-02). A claim
    or verdict write that raises never escapes (CR-02). Returns the verdict, or ``None`` when no
    tail ran here.

    ``recovered=True`` is the sweep's arm B (308.1-03): no drive state exists, so
    :func:`_recovered_verdict` first answers the two cases rows alone can settle (Pitfall 7 and 8);
    anything else runs the ordinary tail from the rows.
    """
    from fastapi.encoders import jsonable_encoder  # noqa: PLC0415

    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import (  # noqa: PLC0415
        claim_publish_tail,
        find_publish_receipt,
        finish_publish_attempt,
        load_publish_attempt,
        load_run_phases,
    )
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness import publish_tail  # noqa: PLC0415

    try:
        record = await claim_publish_tail(pool, run_id, settings.harness_resume_lease_seconds)
    except Exception:  # noqa: BLE001 — CR-02: never an unretrieved task exception
        # The record stays ``running`` on an ENDED run: no longer counted as in flight
        # (``active_publish_attempt``), and recovered by the follow read or the golden sweep.
        logger.exception("publish: the tail of golden run %s could not be claimed", run_id)
        return None
    if record is None:
        logger.info("publish: the tail of golden run %s belongs to another claim", run_id)
        return None
    # 308.1 review WR-02: the claim's OWNER token. Only it refreshes the claim while the tail
    # runs (so a slow judge is never re-claimed by another worker) and only it records the
    # verdict (so a taken-over claim's late write is a no-op).
    token = record.get("finishing_token") or ""
    beat = (
        _spawn(_beat_tail(run_id, pool=pool, token=token), name=f"publish-tail-beat-{run_id}")
        if token
        else None
    )

    try:
        attempt = await load_publish_attempt(pool, run_id)
        definition_id = UUID(str(record.get("definition_id") or attempt["definition_id"]))
        user_id = UUID(str(record.get("requested_by") or attempt["user_id"]))
        definition = WorkflowDefinition.model_validate(attempt["definition_snapshot"])
        verdict = (
            await _recovered_verdict(
                pool, run_id, attempt=attempt, definition_id=definition_id, user_id=user_id
            )
            if recovered
            else None
        )
        if verdict is not None:
            pass  # a recovered tail settled by the rows alone (Pitfall 7 / Pitfall 8)
        elif timed_out:
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
        elif (
            verdict := await _stopped_run_verdict(
                pool, run_id, attempt=attempt, definition_id=definition_id, user_id=user_id
            )
        ) is not None:
            # 308.1 review WR-03: the RUN ROW's status is read on every tail, not only on a
            # recovered one. A run ended ``failed`` / ``cancelled`` with no failed step (a Stop,
            # the circuit breaker, ``finish_golden_run``) is a failure in its own words; its
            # partial output is never judged and never flipped, whichever path won the CAS.
            pass
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
            # WR-02: a recovered tail whose dead predecessor already judged reuses that judge's
            # recorded verdict: no second judge call, no second spend, no repeated receipts.
            recorded = (
                await find_publish_receipt(pool, run_id, "judge_verdict") if recovered else None
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
                **({"recorded_judge": recorded} if recorded is not None else {}),
            )
    except Exception:  # noqa: BLE001 — the claim lapses; the stale-finishing recovery re-runs it
        logger.exception("publish: the tail of golden run %s failed after its claim", run_id)
        return None
    finally:
        if beat is not None:
            beat.cancel()

    # CR-02: the verdict write was outside any guard; one blip lost a computed verdict (possibly a
    # flip that already happened). One retry; if it still fails the record stays ``finishing``,
    # and once that claim is older than the lease the follow read / sweep recover it (a flip is
    # then recognised by its ``publish_succeeded`` receipt, Pitfall 7). Never raises.
    payload = jsonable_encoder(verdict)
    for attempt_no in (1, 2):
        try:
            if not await finish_publish_attempt(pool, run_id, payload, token=token):
                logger.warning(
                    "publish: the claim on golden run %s was taken over; verdict not recorded here",
                    run_id,
                )
            break
        except Exception:  # noqa: BLE001
            logger.exception(
                "publish: the verdict of golden run %s could not be recorded (try %s)",
                run_id,
                attempt_no,
            )
            if attempt_no == 1:
                await asyncio.sleep(0.5)
    return verdict


async def _recovered_verdict(pool, run_id, *, attempt, definition_id, user_id) -> dict | None:
    """What a recovered tail can conclude from ROWS alone, or ``None`` for the ordinary tail.

    Pitfall 7 / T-308.1-15: the draft is already ``published`` AND this run's own
    ``publish_succeeded`` receipt exists, so the dead worker flipped it and died before recording
    ``done``. The success is recorded with the receipt's version (the row's when the receipt has
    none). Re-running the tail would flip again, get -1 and record a FALSE ``already_published``.
    Without this run's receipt the ordinary tail runs, and its ``already_published`` is then true.

    Pitfall 8 is :func:`_stopped_run_verdict`, which every tail (not only a recovered one) now
    asks before judging (308.1 review WR-03); it is not repeated here.
    """
    from app.db.workflows import find_publish_receipt, get_definition  # noqa: PLC0415

    row = await get_definition(pool, definition_id, user_id=user_id)
    if row is not None and row.get("status") == "published":
        receipt = await find_publish_receipt(pool, run_id, "publish_succeeded")
        if receipt is not None:
            version = receipt.get("version")
            if not isinstance(version, int) or version < 0:
                version = row.get("version")
            logger.info("publish: golden run %s had already published v%s", run_id, version)
            return {"published": True, "version": version, "golden_run_id": run_id}

    # 308.1 review WR-02: the dead tail had already DECIDED (``_block`` writes its
    # ``publish_blocked`` receipt as it returns) and died before recording ``done``. That
    # decision is the verdict; re-running would repeat the judge, its spend and its receipts.
    blocked = await find_publish_receipt(pool, run_id, "publish_blocked")
    if blocked is not None and blocked.get("blocked_stage"):
        logger.info("publish: golden run %s had already been refused; recording it", run_id)
        return {
            "published": False,
            "blocked_stage": blocked.get("blocked_stage"),
            "named_failures": blocked.get("named_failures") or [],
            "golden_run_id": run_id,
            "blocked_step": blocked.get("blocked_step"),
        }
    return None


async def _beat_tail(run_id, *, pool, token: str) -> None:
    """WR-02: keep the tail claim fresh while its owner works (a third of the lease apart).

    ``touch_publish_tail`` writes only while ``token`` is still the claim's, so a beat after a
    take-over changes nothing; the owner cancels the beat when the tail ends. Never raises."""
    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import touch_publish_tail  # noqa: PLC0415

    every = max(float(settings.harness_resume_lease_seconds) / 3.0, 0.05)
    while True:
        await asyncio.sleep(every)
        try:
            if not await touch_publish_tail(pool, run_id, token):
                return  # the claim is no longer ours (or the tail already recorded)
        except Exception:  # noqa: BLE001 — a missed beat is retried on the next one
            logger.warning("publish: could not refresh the tail claim of %s", run_id, exc_info=True)


async def _stopped_run_verdict(pool, run_id, *, attempt, definition_id, user_id) -> dict | None:
    """Pitfall 8, asked by EVERY tail (308.1 review WR-03), or ``None`` for the judge path.

    The run ROW ended ``failed`` or ``cancelled`` with no ``failed`` step, so there is no
    structural cause and no exception object. The verdict is ``golden_run_error`` carrying the
    run's own recorded ``run_failed`` words (the generic golden words when none was recorded),
    never a fabricated exception text; the time-limit words map to ``golden_run_timeout``. A run
    with a ``failed`` step returns ``None``: the ordinary tail takes the structural-gate path.
    A ``completed`` (or still-live) row returns ``None`` without a read.
    """
    from app.config import settings  # noqa: PLC0415
    from app.db.workflows import find_publish_receipt, load_run_phases  # noqa: PLC0415
    from app.services.harness import publish_service as _ps  # noqa: PLC0415
    from app.services.harness.run_handoff import golden_end_reason  # noqa: PLC0415

    if attempt.get("status") not in ("failed", "cancelled"):
        return None
    phases = await load_run_phases(pool, run_id)
    if any(p.get("status") == "failed" for p in phases):
        return None
    receipt = await find_publish_receipt(pool, run_id, "run_failed")
    reason = (receipt or {}).get("reason")
    reason = reason.strip() if isinstance(reason, str) and reason.strip() else golden_end_reason(None)
    if reason == golden_end_reason(asyncio.TimeoutError()):
        return await _ps._block(
            pool,
            run_id=run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_timeout",
            named_failures=[_budget_words(settings.harness_publish_max_seconds)],
            golden_run_id=run_id,
        )
    return await _ps._block(
        pool,
        run_id=run_id,
        user_id=user_id,
        definition_id=definition_id,
        stage="golden_run_error",
        named_failures=[f"golden run could not complete: {reason}"],
        golden_run_id=run_id,
    )
