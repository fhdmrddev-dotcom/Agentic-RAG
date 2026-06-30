"""Phase 133 Plan 03 (EVAL-02) — the eval runner engine.

A bounded background job (modeled on ``skill_tuner.py::_run_tuner_job``) that, for
each owner-scoped test case, drives the SHARED agent loop TWICE — a WITH arm
(target-skill-only catalog) and a WITHOUT arm (empty catalog) — persists an
``eval_results`` row the instant each arm finishes, and emits additive ``eval_*``
progress events over the shared ``run:{run_id}`` Redis buffer.

THE LOAD-BEARING CORRECTNESS POINT (Pattern 2 / T-133-07): the inner
``run_agent_loop`` is driven with a NO-OP ``emit`` / ``emit_terminal`` so the loop's
OWN ``'done'`` / ``'error'`` terminals (both in ``threads.TERMINAL_TYPES``) never
reach the shared eval buffer — a real emit would terminate the eval SSE stream on
completion #1 (``replay_tail_consumer`` breaks on the first terminal). The
completion text + token totals are read from the RETURN value
(``AgentLoopResult.full_content_final`` / ``input_tokens_total`` /
``output_tokens_total``), never the stream. The service emits the single closing
terminal itself, after ``eval_complete``.

THE HONEST A/B (D-03/D-04/D-10): the WITH arm's injected name/description come from
the LATEST ``skill_versions`` SNAPSHOT passed in (``skill_version``), NOT the live
``skills`` row — true version-pinned traceability. The WITHOUT arm injects ``()``.
Both ride the additive, default-off ``RunContext.skill_catalog_override`` field
(Plan 02) so the shared Deep agent-loop path is byte-identical when the field is
absent.

STATE DISCIPLINE (D-PRD-12 / SEED-097): all run state lives in Redis + DB — no
module-global run state. Every ``supabase-py`` call is wrapped in
``run_in_threadpool`` (D-v2.5-01). The companion ``public.runs`` row is finalized
via ``finalize_run`` so reattach/cancel parity holds. The only same-process handle
is ``_BACKGROUND_TASKS`` (sub-agent spawn retention — the sanctioned exception, the
in-flight CORRECTNESS gate being the Redis ``SET NX`` claim taken in the router).
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi.concurrency import run_in_threadpool

from app.config import get_model_capability
from app.db.runs import finalize_run
from app.models.message import MessageCreate
from app.services.agent_loop import RunContext, run_agent_loop

logger = logging.getLogger(__name__)

# ── Eval-specific SSE event vocabulary (additive — NEVER overload chat event types) ──
EVENT_CASE_STARTED = "eval_case_started"
EVENT_CASE_DONE = "eval_case_done"
EVENT_COMPLETE = "eval_complete"

# Terminal sentinel types the SHARED replay_tail_consumer breaks on
# (threads.TERMINAL_TYPES). The eval_* events above are NON-terminal progress; the
# run is closed with exactly one of these AFTER eval_complete.
TERMINAL_DONE = "done"
TERMINAL_ERROR = "error"

# A/B variant discriminators (mirror the eval_results.variant CHECK — migration 080).
VARIANT_WITH = "with_skill"
VARIANT_WITHOUT = "without_skill"

# Run-buffer TTL after the eval run finalizes (mirrors REDIS-SETUP.md discipline).
_EVAL_BUFFER_TTL_S = 600

# CAS compare-and-delete for the in-flight claim (taken with SET NX in the router):
# delete the claim IFF its stored value still equals this run_id (atomic — no TOCTOU).
_RELEASE_IF_OWNED = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""

# Same-process sub-agent task retention (NOT run state — the sanctioned exception,
# mirrors threads._spawn). The in-flight correctness gate is the Redis SET NX claim.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _inflight_key(skill_id: str) -> str:
    return f"eval_inflight:{skill_id}"


def _cancel_key(run_id: UUID) -> str:
    return f"eval_cancel:{run_id}"


def _spawn(coro) -> asyncio.Task:
    """Schedule a fire-and-forget coroutine and retain a strong reference (mirrors
    threads._spawn). Defined locally to avoid a threads<->services import cycle."""
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t


async def _noop(*args, **kwargs) -> None:
    """The NO-OP emit handed to ``run_agent_loop`` (Pattern 2 / T-133-07). Swallows
    the inner loop's ``'done'`` / ``'error'`` terminals so they never reach the shared
    eval buffer. The completion outcome is read from the loop's RETURN value."""
    return None


async def _emit_eval(redis, run_id: UUID, event_type: str, **fields) -> None:
    """XADD one eval-specific progress event to ``run:{run_id}`` (additive vocab).

    Mirrors threads._emit's single-field ``data`` envelope + MAXLEN cap, emitting ONLY
    ``eval_*`` types (never a chat event type). Best-effort: a Redis hiccup logs and
    continues (the run keeps computing; the consumer reconciles via the next event)."""
    try:
        await redis.xadd(
            f"run:{run_id}",
            {"data": json.dumps({"type": event_type, **fields})},
            maxlen=10000,
            approximate=True,
        )
    except Exception:
        logger.exception("eval _emit_eval XADD failed for run %s (type=%s)", run_id, event_type)


async def _emit_terminal(redis, run_id: UUID, terminal_type: str, **fields) -> None:
    """XADD the single terminal sentinel (``done`` / ``error``) so the shared SSE
    consumer breaks cleanly, then EXPIRE the buffer (run-buffer TTL discipline)."""
    try:
        await redis.xadd(
            f"run:{run_id}",
            {"data": json.dumps({"type": terminal_type, **fields})},
        )
    except Exception:
        logger.exception("eval terminal sentinel XADD failed for run %s", run_id)
    try:
        await redis.expire(f"run:{run_id}", _EVAL_BUFFER_TTL_S)
    except Exception:
        logger.exception("eval EXPIRE failed for run %s", run_id)


async def _release_inflight_if_owned(redis, skill_id: str, run_id: UUID) -> None:
    """Compare-and-delete the in-flight claim: delete ``eval_inflight:{skill_id}`` IFF
    its stored value still equals ``run_id`` (atomic Lua — no TOCTOU). A no-op when a
    NEWER run already re-claimed the key, so a dying run never evicts the live one."""
    try:
        await redis.eval(_RELEASE_IF_OWNED, 1, _inflight_key(skill_id), str(run_id))
    except Exception:
        logger.exception("eval inflight CAS-release failed (skill %s)", skill_id)


def _truncate_error(exc: Exception) -> str:
    """Truncate an error string to <=200 chars (threads.py:1561 precedent — T-133-04):
    never leak raw tracebacks / key fragments into the RLS-readable error column."""
    return f"{type(exc).__name__}: {exc}"[:200]


async def _create_eval_thread(supabase, user_id: str) -> str:
    """Create ONE ephemeral eval thread per run (a real threads row — run_agent_loop
    reads folder_id + history from the DB; there is no in-memory path). Returns the
    new thread id. Wrapped in run_in_threadpool (blocking supabase-py)."""
    thread_id = str(uuid4())
    payload = {
        "id": thread_id,
        "user_id": user_id,
        "title": "[eval] skill A/B run",
        "folder_id": None,
    }

    def _insert():
        return supabase.table("threads").insert(payload).execute()

    await run_in_threadpool(_insert)
    return thread_id


async def _reset_thread_to_prompt(supabase, thread_id: str, user_id: str, prompt: str) -> None:
    """Clean single-turn isolation (Pattern 4): clear any prior messages in the eval
    thread, then insert ONLY this case's prompt as a user message. Both arms of the
    case read the SAME single prompt — so case i+1 never sees case i, and the WITH /
    WITHOUT arms differ ONLY in the injected skill catalog. Blocking calls wrapped."""
    def _clear():
        return supabase.table("messages").delete().eq("thread_id", thread_id).execute()

    await run_in_threadpool(_clear)

    msg = {
        "id": str(uuid4()),
        "thread_id": thread_id,
        "user_id": user_id,
        "role": "user",
        "content": prompt,
    }

    def _insert():
        return supabase.table("messages").insert(msg).execute()

    await run_in_threadpool(_insert)


async def _persist_result(
    supabase,
    *,
    run_id: UUID,
    test_case_id: str,
    user_id: str,
    variant: str,
    provider: str,
    model: str,
    output: str,
    status: str,
    error: str | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Persist ONE eval_results row the instant an arm finishes (D-06 — partials stay
    readable). Owner-stamped from ``current_user`` (never a body — T-133-03)."""
    payload = {
        "eval_run_id": str(run_id),
        "test_case_id": str(test_case_id),
        "user_id": user_id,
        "variant": variant,
        "provider": provider,
        "model": model,
        "output": output,
        "status": status,
        "error": error,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }

    def _insert():
        return supabase.table("eval_results").insert(payload).execute()

    await run_in_threadpool(_insert)


async def _run_arm(
    *,
    redis,
    supabase,
    run_id: UUID,
    thread_id: str,
    case: dict,
    variant: str,
    catalog_override: tuple[dict, ...],
    provider: str,
    model: str,
    current_user: dict,
    user_settings,
) -> None:
    """Drive ONE completion (WITH or WITHOUT arm) for one case, then persist its
    eval_results row + emit progress. A per-arm exception records status=failed /
    timed_out + a truncated error and RETURNS (the job continues — D-06)."""
    user_id = current_user["id"]
    test_case_id = case["id"]
    await _emit_eval(redis, run_id, EVENT_CASE_STARTED, test_case_id=str(test_case_id), variant=variant)

    body = MessageCreate(
        content=case.get("prompt", ""),
        model=model,
        provider=provider,
        agent_mode="default",
    )
    # Canonical Deep RunContext build (mirrors threads.py:1490-1500) + the ONLY new
    # field: the additive default-off skill_catalog_override (WITH = version snapshot,
    # WITHOUT = empty tuple). NO-OP emit so the loop's terminals are swallowed.
    ctx = RunContext(
        run_id=run_id,
        thread_id=thread_id,
        current_user=current_user,
        user_settings=user_settings,
        body=body,
        redis=redis,
        supabase=supabase,
        resolved_model=model,
        resolved_provider=provider,
        skill_catalog_override=catalog_override,
    )

    status = "completed"
    error: str | None = None
    output = ""
    in_tok: int | None = None
    out_tok: int | None = None
    try:
        result = await run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn)
        output = result.full_content_final or ""
        in_tok = result.input_tokens_total
        out_tok = result.output_tokens_total
    except asyncio.TimeoutError as exc:
        status = "timed_out"
        error = _truncate_error(exc)
        logger.warning("eval arm timed out (run %s, case %s, %s)", run_id, test_case_id, variant)
    except Exception as exc:
        status = "failed"
        error = _truncate_error(exc)
        logger.exception("eval arm failed (run %s, case %s, %s)", run_id, test_case_id, variant)

    await _persist_result(
        supabase,
        run_id=run_id,
        test_case_id=test_case_id,
        user_id=user_id,
        variant=variant,
        provider=provider,
        model=model,
        output=output,
        status=status,
        error=error,
        input_tokens=in_tok,
        output_tokens=out_tok,
    )
    await _emit_eval(
        redis, run_id, EVENT_CASE_DONE,
        test_case_id=str(test_case_id), variant=variant, status=status,
    )


async def _update_eval_run_status(
    supabase, *, run_id: UUID, user_id: str, status: str, error: str | None
) -> None:
    """Update the durable eval_runs row's terminal status + completed_at (owner-scoped)."""
    payload = {
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "error": error,
    }

    def _update():
        return (
            supabase.table("eval_runs")
            .update(payload)
            .eq("id", str(run_id))
            .eq("user_id", user_id)
            .execute()
        )

    try:
        await run_in_threadpool(_update)
    except Exception:
        logger.exception("eval_runs status update failed for run %s", run_id)


async def run_eval_job(
    *,
    run_id: UUID,
    skill_id: str,
    skill_version: dict,
    cases: list[dict],
    provider: str,
    model: str,
    current_user: dict,
    user_settings,
    redis,
    supabase,
    pool,
) -> None:
    """The bounded background eval job (EVAL-02).

    For each owner-scoped ``case`` in order: reset the ephemeral eval thread to that
    case's single prompt, then drive the agent loop TWICE — WITH arm
    (``skill_catalog_override=(version snapshot,)``) then WITHOUT arm
    (``skill_catalog_override=()``) — persisting an ``eval_results`` row per arm and
    emitting ``eval_*`` progress. Closes with a single terminal sentinel + finalizes
    the companion ``runs`` row. All state lives in Redis + DB.

    ``skill_version`` is the LATEST owner-scoped version SNAPSHOT (``name`` /
    ``description``) — the WITH arm injects THAT, not the live skills row (D-03/D-10).
    """
    user_id = current_user["id"]
    final_status = "completed"
    run_error: str | None = None
    try:
        # D-01 / V5: resolve + validate the provider from the model. An unknown model
        # is rejected (no fabricated capability) — single provider per run.
        cap = get_model_capability(model)
        if not cap:
            run_error = f"unknown_model: {model}"[:200]
            final_status = "failed"
            await _emit_terminal(redis, run_id, TERMINAL_ERROR, error=run_error)
            await _update_eval_run_status(
                supabase, run_id=run_id, user_id=user_id, status=final_status, error=run_error,
            )
            return

        # WITH-arm catalog from the VERSION SNAPSHOT (D-03/D-10) — name/description only.
        with_override = (
            {
                "name": skill_version.get("name") or "",
                "description": skill_version.get("description") or "",
            },
        )

        eval_thread_id = await _create_eval_thread(supabase, user_id)

        for case in cases:
            # Cooperative cancel checkpoint at the top of each case (T-133-02).
            if await redis.get(_cancel_key(run_id)):
                final_status = "cancelled"
                break

            await _reset_thread_to_prompt(
                supabase, eval_thread_id, user_id, case.get("prompt", ""),
            )

            # WITH arm — inject ONLY the target skill (version snapshot).
            await _run_arm(
                redis=redis, supabase=supabase, run_id=run_id, thread_id=eval_thread_id,
                case=case, variant=VARIANT_WITH, catalog_override=with_override,
                provider=provider, model=model, current_user=current_user,
                user_settings=user_settings,
            )

            # Cancel checkpoint between arms — stop before another (paid) completion.
            if await redis.get(_cancel_key(run_id)):
                final_status = "cancelled"
                break

            # WITHOUT arm — inject NOTHING (empty catalog).
            await _run_arm(
                redis=redis, supabase=supabase, run_id=run_id, thread_id=eval_thread_id,
                case=case, variant=VARIANT_WITHOUT, catalog_override=(),
                provider=provider, model=model, current_user=current_user,
                user_settings=user_settings,
            )

        await _emit_eval(redis, run_id, EVENT_COMPLETE, status=final_status)
        await _update_eval_run_status(
            supabase, run_id=run_id, user_id=user_id, status=final_status, error=run_error,
        )
        await _emit_terminal(redis, run_id, TERMINAL_DONE, status=final_status)
    except Exception:
        logger.exception("eval job crashed for run %s", run_id)
        final_status = "failed"
        run_error = "eval_job_failed"
        await _update_eval_run_status(
            supabase, run_id=run_id, user_id=user_id, status=final_status, error=run_error,
        )
        await _emit_terminal(redis, run_id, TERMINAL_ERROR, error=run_error)
    finally:
        # Finalize the companion runs row (reattach/cancel parity — db/runs.py).
        try:
            await finalize_run(
                pool,
                run_id=run_id,
                status=final_status,
                error=run_error,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=None,
                output_tokens=None,
            )
        except Exception:
            logger.exception("eval finalize_run failed for run %s", run_id)

        # Release the in-flight claim (CAS — only our OWN claim) + drop the run from
        # the active sorted sets. All best-effort.
        await _release_inflight_if_owned(redis, skill_id, run_id)
        try:
            await redis.zrem("runs:active", str(run_id))
            await redis.zrem(f"runs_by_thread:eval:{skill_id}", str(run_id))
        except Exception:
            logger.exception("eval job cleanup (ZREM) failed for run %s", run_id)
