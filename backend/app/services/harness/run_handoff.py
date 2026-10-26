"""What one step hands the next, and who owns a failure's words — a LEAF (Phase 295).

289-02's rule, applied: *branching lives in a helper module*, so the hot executor and engine
files (``phase_types.py``, ``harness_engine.py``, both G-5 FIRING) spend ONE call line per
concern and gain no branch. This module imports nothing from ``app`` at module level — it
reads attributes off the run ``ctx`` and the outputs it is handed, so it can never close the
harness-package import cycle. The few helpers that write (plan 295-04's run-end helpers) import
their db / engine names lazily, inside the function.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

# The engine's logger name, so a run-end record logged here reads as the engine's (the
# engine_ask precedent, 295-01).
logger = logging.getLogger("app.services.harness_engine")

__all__ = [
    "phase_scope_ids",
    "handoff_text",
    "sub_agent_text",
    "sub_agent_error_mark",
    "mark_pause_written",
    "take_pause_written",
    "claim_failure_message",
    "surface_unless_engine_owns",
    "surface_if_engine_owned",
    "end_run",
    "resume_with_terminalize",
    "fail_unloadable_definition",
    "resume_shell_status",
    "expire_unless_paused",
    "record_stop",
    "record_failed_end",
    "finish_golden_run",
    "golden_end_reason",
]


def phase_scope_ids(ctx, phase):
    """The folder ids this step searches: a per-run folder override for THIS step, else the
    run's resolved project subtree.

    D-03: "Search another folder" re-runs the step once over the chosen folder's subtree,
    which ``engine_ask.consume_engine_answer`` puts on ``ctx.phase_scope_override[slug]`` (a
    LIST — Pitfall 1: a set would break the RPC's JSON param). The override lives on the ctx
    of this re-drive only; it is recorded in the approval receipt and never written to the
    definition. The step's own ``folder_scope`` intersection still applies on top, so the
    result only narrows from what the override names.
    """
    override = (getattr(ctx, "phase_scope_override", None) or {}).get(getattr(phase, "slug", None))
    return override if override is not None else getattr(ctx, "folder_subtree_ids", None)


# ── D-10 / D-11 / D-46 (BUG-261020-01): what the next MODEL reads of a prior step ───────────

#: D-11 — the one home of the unsourced note. It reaches the next model's prior-output text
#: ONLY; ``human_input._latest_phase_text`` (an external action's body, a human step's draft)
#: reads the raw ``text`` and never this (Pitfall 10).
UNSOURCED_NOTE = (
    "Note: the step that produced the text below found no sources, and a person chose to "
    "keep it without sources. It was accepted without sources and must not be presented "
    "as sourced."
)
_NO_ANSWER = "(no answer)"


def handoff_text(out) -> str | None:
    """The text a downstream model reads for ONE prior step's output, or ``None`` for nothing.

    * A human step (``answer`` present AND a ``tool_call_id``, the shape every
      ``llm_human_input`` return carries) hands over the question AND the answer, labelled:
      ``Question asked: <q>`` then ``The person answered: <a>``. The stored ``text`` stays the
      question (the receipt and the evidence page read it) — only the READ changes.
    * An output carrying ``unsourced`` (D-04's mark) is prefixed by :data:`UNSOURCED_NOTE`.
    * Anything else is its ``text``, unchanged; a non-dict or an empty ``text`` is ``None``.
    """
    if not isinstance(out, dict):
        return None
    text = out.get("text")
    text = text if isinstance(text, str) and text.strip() else None
    if "answer" in out and out.get("tool_call_id") is not None:
        answer = out.get("answer")
        answer = answer.strip() if isinstance(answer, str) else ""
        said = f"The person answered: {answer or _NO_ANSWER}"
        return f"Question asked: {text}\n{said}" if text else said
    if text is None:
        return None
    if out.get("unsourced"):
        return f"{UNSOURCED_NOTE}\n\n{text}"
    return text


# ── 295-REVIEW WR-01 (BUG-261021-01): a sub-agent's error is an OUTAGE, not an answer ──────
#
# When a sub-agent's model call raises, ``run_task_sub_agent`` returns ``status="error"`` and
# ``summary = "Sub-agent failed: <str(e)>"`` — the VENDOR'S message body (an account id, a
# quota, a masked key, a host). Kept as the step's ``text`` it read as "found nothing" to the
# citations gate, and Continue then stored it as a deliverable and handed it downstream. The
# step's text is now this fixed sentence instead (the vendor body stays in the server log and
# the sub-agent's own ``runs.error``), and the output carries ONE mark the gate reads as an
# outage, so the run fails with the outage sentence rather than offering to continue.

SUB_AGENT_FAILED_TEXT = "This step could not get an answer from its model, so it has no result."


def sub_agent_text(result) -> str:
    """The ``text`` a step keeps from ONE sub-agent result: its summary, or the fixed sentence
    when the sub-agent errored (never the vendor's message)."""
    if result.get("status") == "error":
        return SUB_AGENT_FAILED_TEXT
    return result["summary"]


def sub_agent_error_mark(results) -> dict:
    """``{"sub_agent_status": "error"}`` when ANY sub-agent errored, else ``{}`` (absent, so a
    working step's output is byte-identical)."""
    if any(isinstance(r, dict) and r.get("status") == "error" for r in results or []):
        return {"sub_agent_status": "error"}
    return {}


# ── 295-REVIEW WR-07: ONE pause write per engine ask ────────────────────────────────────────
#
# ``engine_pause`` writes ``pause_run`` FIRST (releasing the lease, so an answer can re-drive at
# once), then the prompt row, then the card. The engine's pause arm used to write ``pause_run``
# AGAIN after that, so an answer landing in the gap (``resume_run`` → ``active``, a fresh claim)
# was flipped back to ``paused`` while its re-drive ran, and its claim was cleared. The engine
# ask now marks that it already wrote the pause, and the arm skips its own write when marked.


def mark_pause_written(ctx) -> None:
    """Called by ``engine_pause`` as it returns its ``pause_run`` outcome."""
    try:
        ctx.engine_pause_written = True
    except (AttributeError, TypeError):
        pass


def take_pause_written(ctx) -> bool:
    """Single-use: True (and cleared) when an engine ask already wrote this pause."""
    written = bool(getattr(ctx, "engine_pause_written", False))
    if written:
        try:
            ctx.engine_pause_written = False
        except (AttributeError, TypeError):
            pass
    return written


# ── D-23 (BUG-261015-01): one failure, one message ──────────────────────────────────────────


def claim_failure_message(ctx, phase) -> None:
    """Set ``ctx.engine_owns_failure_message`` for THIS phase, at the top of
    ``_run_phase_with_gates``.

    True when the phase has validators: the engine will retry or route, and every one of its
    failure-terminal arms (fail_run, a missing ``skip_to`` target, a valid ``skip_to``,
    completed-with-failure) surfaces the composed cause exactly once. False otherwise, so the
    executor's own message stays the only one (D-50: the suppression never drops it). Re-set on
    every phase, so a later phase without validators is never silenced by an earlier one. A
    frozen / slotted ctx is tolerated, as ``human_input`` tolerates it for its resume flag.

    295-REVIEW WR-03: it also clears ``ctx.engine_silenced_failure_message``, which only the
    executor side sets, when it actually suppressed a message in THIS phase.
    """
    try:
        ctx.engine_owns_failure_message = bool(getattr(phase, "validators", None))
        ctx.engine_silenced_failure_message = False
    except (AttributeError, TypeError):
        pass


async def surface_unless_engine_owns(ctx, run_id, reason, pool, surface):
    """The executor side: persist the failure message unless the engine owns it. When it
    stays silent it records that it did, so the engine knows it owes the one message."""
    if getattr(ctx, "engine_owns_failure_message", False):
        try:
            ctx.engine_silenced_failure_message = True
        except (AttributeError, TypeError):
            pass
        return None
    return await surface(ctx, run_id, reason, pool)


async def surface_if_engine_owned(ctx, run_id, reason, pool, surface):
    """The engine side, for the arms that did not surface before 295: ONLY when the executor
    was actually silenced in this phase.

    295-REVIEW WR-03: this used to key on ``engine_owns_failure_message`` alone, which is True
    for every phase with validators. Only the emit executor ever surfaces, so a non-emit step
    routed by a valid ``skip_to`` (zero messages before 295) gained a mid-run "gate failed"
    message. Keyed on the silence instead, that branch is back to its pre-295 behaviour, and
    an emit step still gets its one message."""
    if not getattr(ctx, "engine_silenced_failure_message", False):
        return None
    return await surface(ctx, run_id, reason, pool)


# ── D-19 / D-20 / D-41 (RUN-04): every run ends in a true state, with a recorded reason ─────
#
# ⭐ ONE terminal-write rule for every new end below: a GUARDED ``UPDATE … WHERE status =
# ANY(<non-terminal>) RETURNING id`` decides who won (the ``api/runs._fail_redrive`` shape,
# 289-REVIEW WR-02), and ONLY the winner writes the words (a phase failure, ``finish_run`` for
# the thread-anchor clear, the audit). ``finish_run``'s own first-terminal-wins guard stays the
# one status rule; this only answers "did MY call move it", which ``finish_run`` does not
# report. ⛔ No helper here writes or NULLs a usage / total column (SEED-297) — ``finish_run``
# names none.

#: The non-terminal statuses a resumed run, or a run the sweep cannot load, may be ended from.
_LIVE_STATUSES = ("active", "paused")
#: A Stop also ends a run parked on its spend cap.
_STOPPABLE_STATUSES = ("active", "paused", "cap_paused")

#: D-20 / D-41 — a resumed run that escaped with an error. Never the exception's text (T-295-04-07).
RESUME_FAILED_REASON = (
    "This run stopped because of an error while it was continuing after a pause or a restart. "
    "Nothing after the last finished step ran."
)
#: D-20 — the boot sweep's dead definition (the ``_REDRIVE_NO_DEFINITION_REASON`` shape).
SWEEP_NO_DEFINITION_REASON = (
    "This run could not continue after a restart: its workflow could not be loaded."
)

#: D-20 — run_producer's F2: a producer escape the engine never terminalized.
F2_FAILED_REASON = (
    "This run stopped unexpectedly before its steps finished, so it was marked failed."
)

_GUARDED_TERMINAL_SQL = (
    "UPDATE workflow_runs SET status = $2 "
    "WHERE id = $1 AND status = ANY($3::text[]) RETURNING id, user_id"
)


async def _claim_terminal(pool, run_id, status: str, from_statuses):
    """The winner check: the row (``id``, ``user_id``) iff THIS call moved the run, else None."""
    return await pool.fetchrow(_GUARDED_TERMINAL_SQL, run_id, status, list(from_statuses))


def _as_uuid(value):
    if value is None or isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


async def end_run(pool, run_id, status: str, *, from_statuses=_LIVE_STATUSES, user_id=None,
                  reason: str | None = None, fail_active_phase: bool = False) -> bool:
    """End ``run_id`` as ``status`` iff it is still in ``from_statuses``; True iff THIS call won.

    The winner of a ``failed`` end with a ``reason`` writes exactly one ``run_failed`` audit
    carrying it (and, with ``fail_active_phase``, fails the still-active step with the same
    words, so the run page says why). A lost race writes nothing at all.
    """
    from app.db.workflows import (  # noqa: PLC0415 — lazy: the harness-package cycle
        fail_phase,
        finish_run,
        get_active_phase,
        write_audit,
    )

    won = await _claim_terminal(pool, run_id, status, from_statuses)
    if won is None:
        return False
    if status == "failed" and reason and fail_active_phase:
        phase = await get_active_phase(pool, run_id)
        if phase is not None:
            await fail_phase(pool, phase["id"], reason)
    await finish_run(pool, run_id, status)
    if status == "failed" and reason:
        await write_audit(
            pool, run_id, user_id=_as_uuid(user_id or won["user_id"]), event_type="run_failed",
            metadata={"reason": reason},
        )
    return True


async def record_failed_end(pool, run_id, status: str, *, reason: str = F2_FAILED_REASON) -> bool:
    """D-20 (run_producer F2): BEFORE the caller's own unconditional ``finish_run``, claim the
    ``failed`` end and, only when THIS call won it, write ONE ``run_failed`` with words. A
    ``cancelled`` end writes nothing; a run another writer already ended gets nothing. Never
    raises, so the caller's ``finish_run`` (and its anchor clear) always still runs."""
    if status != "failed":
        return False
    try:
        from app.db.workflows import write_audit  # noqa: PLC0415

        won = await _claim_terminal(pool, run_id, "failed", _STOPPABLE_STATUSES)
        if won is None:
            return False
        await write_audit(
            pool, run_id, user_id=_as_uuid(won["user_id"]), event_type="run_failed",
            metadata={"reason": reason},
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("F2: the failure reason could not be recorded for workflow run %s", run_id)
        return False


def golden_end_reason(escape) -> str:
    """D-20: the words for a golden (publish trial) run that did not finish. Composed from the
    shape of the escape only — never its message (T-295-04-07)."""
    if isinstance(escape, (asyncio.CancelledError, asyncio.TimeoutError)):
        return "The trial run did not finish within its time limit, so it was stopped."
    if escape is not None:
        return f"The trial run stopped because of an error ({type(escape).__name__})."
    return "The trial run ended before its steps finished."


async def finish_golden_run(pool, run_id, *, user_id=None) -> bool:
    """D-20: called from ``_drive_golden_run``'s ``finally`` AFTER the shell finalise. A golden
    run's ``workflow_runs`` row still ``active`` / ``paused`` here is ended ``failed`` with
    :func:`golden_end_reason` and ONE ``run_failed``; a row the run itself already ended is never
    rewritten. The in-flight escape is read with ``sys.exc_info()`` (this runs inside the
    caller's ``finally``). Never raises: shell cleanup never masks the run's own outcome."""
    import sys  # noqa: PLC0415

    escape = sys.exc_info()[1]
    try:
        return await asyncio.shield(end_run(
            pool, run_id, "failed", user_id=user_id, reason=golden_end_reason(escape),
            fail_active_phase=True,
        ))
    except Exception:  # noqa: BLE001
        logger.warning("publish: golden run %s could not be finalised", run_id, exc_info=True)
        return False


def resume_shell_status(exc) -> str:
    """The resume producer shell's terminal word: ``completed`` for a clean return, ``cancelled``
    for a ``CancelledError`` (D-41: never ``completed`` when the run did not complete), else
    ``failed``."""
    if exc is None:
        return "completed"
    return "cancelled" if isinstance(exc, asyncio.CancelledError) else "failed"


async def resume_with_terminalize(coro, *, run_id, pool, user_id=None):
    """D-41: await a resumed ``run_workflow`` and, when it ESCAPES, end the row truthfully.

    Covers both re-drive callers (the boot sweep and the answer route's ``_wake``), which is why
    it lives under ``_resume_run``. ``CancelledError`` → ``cancelled`` (no ``run_failed``); any
    other exception → ``failed`` with :data:`RESUME_FAILED_REASON` and ONE ``run_failed``. Always
    re-raises. ⛔ A graceful app shutdown writes NOTHING: leaving the run live is exactly what
    lets the next boot's sweep resume it (096-09). An already-terminal run is never rewritten.
    """
    try:
        return await coro
    except BaseException as exc:
        from app.services.harness_engine import is_app_shutting_down  # noqa: PLC0415

        if not is_app_shutting_down():
            try:
                await asyncio.shield(end_run(
                    pool, run_id, resume_shell_status(exc), user_id=user_id,
                    reason=RESUME_FAILED_REASON, fail_active_phase=True,
                ))
            except BaseException:  # noqa: BLE001 — the run's own escape must win
                logger.exception("resume terminalize failed for workflow run %s", run_id)
        raise


async def fail_unloadable_definition(pool, run_id, *, user_id=None,
                                     reason: str = SWEEP_NO_DEFINITION_REASON) -> bool:
    """D-20: the sweep's definition-won't-load arm ends the run ``failed`` with words and one
    ``run_failed`` instead of a bare skip. Never raises (the sweep must reach the next run).

    295-IN-01 (296-02): the WINNER also expires the run's pending prompt, as the reconciler
    sweep does, so ``/pending`` stops serving a card for a run that has ended."""
    try:
        won = await end_run(pool, run_id, "failed", user_id=user_id, reason=reason,
                            fail_active_phase=True)
        if won:
            from app.services.harness_engine import _expire_pending_ask_user  # noqa: PLC0415

            _row = await pool.fetchrow(
                "SELECT thread_id, org_id FROM workflow_runs WHERE id = $1", run_id
            ) or {}
            await _expire_pending_ask_user(
                pool, _row.get("thread_id"), run_id, org_id=_row.get("org_id")
            )
        return won
    except Exception:  # noqa: BLE001
        logger.exception("resume sweep: could not end unloadable run %s", run_id)
        return False


async def expire_unless_paused(pool, thread_id, run_id, *, org_id=None, expire):
    """295-03 deferred (a): the sweep's cleanup must not expire the prompt of a re-drive that
    PAUSED AGAIN (another folder found nothing, or a human step asked again) — that prompt is
    the one the person must answer next. Any other end expires exactly as before; a status read
    that fails falls back to expiring (the shipped behaviour)."""
    try:
        status = await pool.fetchval("SELECT status FROM workflow_runs WHERE id = $1", run_id)
    except Exception:  # noqa: BLE001
        status = None
    if status == "paused":
        return None
    return await expire(pool, thread_id, run_id, org_id=org_id)


async def _stopper_words(pool, user_id) -> str:
    """Who pressed Stop, for a STORED reason: the shared name chain without the email."""
    from app.api.workflow_runs import waiting_who  # noqa: PLC0415

    display = None
    try:
        display = await pool.fetchval(
            "SELECT display_name FROM profiles WHERE id = $1", _as_uuid(user_id)
        )
    except Exception:  # noqa: BLE001 — a name is words, never a reason to fail
        display = None
    return waiting_who(is_owner=False, display_name=display, viewer_email=None)


async def record_stop(pool, run_id, stopped_by, *, policy: str) -> bool:
    """D-19: when a person's Stop wins the cancel, write ONE ``policy_applied`` audit
    ``{policy, reason: "Stopped by <name>."}``. ``stopped_by=None`` (the circuit breaker, which
    composes the same cancel) writes nothing and moves nothing. Never raises — the caller's own
    ``finish_run`` / phase cancel must still run. ``policy_applied`` is an existing kind."""
    if stopped_by is None:
        return False
    try:
        from app.db.workflows import write_audit  # noqa: PLC0415

        won = await _claim_terminal(pool, run_id, "cancelled", _STOPPABLE_STATUSES)
        if won is None:
            return False
        name = await _stopper_words(pool, stopped_by)
        await write_audit(
            pool, run_id, user_id=_as_uuid(stopped_by), event_type="policy_applied",
            metadata={"policy": policy, "reason": f"Stopped by {name}."},
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("stop reason could not be recorded for workflow run %s", run_id)
        return False
