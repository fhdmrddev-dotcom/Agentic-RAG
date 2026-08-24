"""Phase 162.5 Plan 03 (G-5 extraction) — the unified Deep/continuation producer shell.

The byte-identical HEART lifted out of ``threads.py``: the inline ``agent_runner``
producer shell (was a nested closure in ``send_message``) and the near-duplicate
module-level ``spawn_continuation_run`` (Plan 03 Task 2), UNIFIED onto ONE shared
finalize routine (``_finalize_producer_run``) so the two finalize orderings can
never drift again.

THE 8 FINALIZE-ORDERING INVARIANTS (D-A3 — preserved byte-identical on BOTH the
producer path AND the continuation path; ``_finalize_producer_run`` performs
steps 1-7 in EXACT source order, step 8 lives in the caller's outer ``finally``):

  1. asyncio.shielded ``_persist()`` assistant-message persist (exceptions logged, not raised)
  2. system_warnings persist — best-effort
  3. RUN-01b reconcile — gate ``terminal_status == "completed" AND
     result_sink.get("cap_disposition") != "cap_paused"`` (a safe superset that
     reproduces BOTH the producer two-clause gate AND the continuation plain
     ``== completed`` gate — a cap-paused continuation already set
     terminal_status="cap_paused" in its own finally, so it never reaches here)
  4. finalize_run_terminal (status UPDATE + both ZREMs, ONE atomic co-write); status
     lands FIRST. cap_paused branch uses plain finalize_run (KEEPS runs:active — NO
     ZREM). The producer's Deep first-turn is never cap_paused → always the terminal branch.
  5. terminal sentinel XADD via _emit_terminal — AFTER finalize / BEFORE EXPIRE; catch
     BaseException; gated on ``terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE`` (skips cap_paused)
  6. EXPIRE — 600s completed / 60s else
  7. harness F2 terminalize — gate ``active_workflow_run_id is not None AND != "completed"
     AND not is_app_shutting_down()`` (continuation passes active_workflow_run_id=None →
     the same gate skips it naturally — a Deep continuation never runs F2)
  8. whole block under asyncio.shield; ``RUN_TASKS.pop(run_id, None)`` in the outer finally.

THE TWO DIVERGENCES the unification PARAMETERIZES (never a forked step order):
  - Harness F2 (step 7): present only when ``active_workflow_run_id`` is set.
  - cap_paused (steps 4+5): keyed on ``terminal_status``. A continuation whose cap
    re-fired arrives as terminal_status="cap_paused" → plain finalize_run (keep
    runs:active) + no sentinel. The producer never hits this.

DISCIPLINE (D-A4, the run_lifecycle.py precedent): this module has NO top-level
``import app.api.threads``. It LATE-imports the SSE-transport names
(_emit/_emit_terminal/_spawn/RUN_TASKS/_RUN_STATUS_TO_TERMINAL_TYPE) AND the
test-patched names (run_agent_loop/RunContext/get_pg_pool/finalize_run_terminal/
finalize_run/load_user_settings) FROM ``app.api.threads`` inside the functions
(function-local, ``# noqa: PLC0415``). threads.py re-exports those names, so the
existing ``patch("app.api.threads.*")`` surface still intercepts AND the
threads.py<->service import cycle stays broken. ``run_agent_loop`` is NOT modified
here — the Deep red line stays where Phase 089 put it (D-A7).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID
import uuid as _uuid_mod

# Pure Pydantic model (cycle-safe — app.models.message imports only stdlib +
# pydantic). The MessageCreate carrier the continuation hands the agent loop.
from app.models.message import MessageCreate

logger = logging.getLogger(__name__)


async def _finalize_producer_run(
    *,
    run_id,
    thread_id,
    redis,
    result_sink: dict,
    terminal_status: str,
    terminal_error: str | None,
    active_workflow_run_id,
    resolved_provider,
    resolved_model,
) -> None:
    """The ONE shared 8-invariant finalizer for BOTH the Deep producer and the
    Deep-run continuation (D-A3 unification).

    Performs steps 1-7 in EXACT source order (the caller owns step 8:
    ``asyncio.shield(...)`` + ``RUN_TASKS.pop`` in its outer ``finally``). The two
    genuine producer/continuation differences are PARAMETERS, not a forked order:
    ``active_workflow_run_id`` (harness F2 present only when set) and
    ``terminal_status`` (cap_paused → plain finalize_run keep-active + sentinel skip).
    IN-03 (D-061.1-09): the persisted assistant id is a local, no nonlocal reaches
    into the caller. Every step is best-effort (BaseException logged, never raised).
    """
    # Late imports (D-A4): resolve the SSE-transport + test-patched names FROM
    # app.api.threads so patch("app.api.threads.*") still intercepts AND the
    # threads.py<->service cycle stays broken. threads.py re-exports these.
    from app.api.threads import (  # noqa: PLC0415
        _emit,
        _emit_terminal,
        get_pg_pool,
        finalize_run_terminal,
        finalize_run,
        _RUN_STATUS_TO_TERMINAL_TYPE,
    )

    # 089-03: the persist callables + accumulators live inside run_agent_loop.
    # They are surfaced to this finalizer via the by-reference result_sink
    # (populated by the loop's outer `finally` on EVERY exit path, incl.
    # exception). The persist→persist_system_warnings→finalize→sentinel→expire→
    # zrem step order is byte-identical to the pre-move finalizer (I10 / Pitfall 5).
    # When the loop never ran (defensive: sink empty), the persist callables are
    # absent — we skip the persist + system-warning steps and still finalize the
    # runs row so the run reaches a terminal status.
    _persist = result_sink.get("persist")
    _persist_sys = result_sink.get("persist_system_warnings")
    _sink_system_warnings = result_sink.get("persisted_system_warnings") or []
    _input_tokens_total = result_sink.get("input_tokens_total")
    _output_tokens_total = result_sink.get("output_tokens_total")
    # 1. SHIELDED PERSIST — preserves 058/059 contract.
    _msg_id_for_runs: str | None = None
    try:
        if _persist is not None:
            _msg_id_for_runs = await _persist()
    except BaseException:
        logger.exception("Shielded persist failed for run %s", run_id)

    # 2. Plan 075.4-03 D-075.4-E1 — persist any system_warning rows captured
    # during the run. Best-effort (try/except) because the messages_role_check
    # constraint pre-migration 048 rejects role='system' — INSERT fails-silent;
    # SSE event remains the user-visible signal regardless.
    try:
        if _persist_sys is not None and _sink_system_warnings:
            await _persist_sys(_sink_system_warnings)
    except BaseException:
        logger.exception("Shielded system-warning persist failed for run %s", run_id)

    # 3. Phase 138 RUN-01b — on a genuinely-clean run end, append the honesty
    # marker to any still-open todo so the Workspace TODOS panel reads "… (run
    # ended — not completed)" instead of looking permanently stuck. Positioned
    # AFTER step-1 persist and BEFORE step-4 finalize so the todo_updated emit
    # reaches the live SSE consumer ahead of the terminal sentinel and isn't
    # trimmed by EXPIRE (S5 — no existing step is reordered). Best-effort: the
    # reconciler NEVER raises into the byte-locked finalizer.
    #
    # LOCK-2 / S6 SUPERSET gate: `completed AND cap_disposition != cap_paused`
    # reproduces BOTH orderings. Producer path: a fresh Deep run that hit the
    # iteration cap arrives as terminal_status == "completed" with
    # result_sink["cap_disposition"] == "cap_paused" — gating on status alone
    # would WRONGLY mark a cap-paused run (the D-05 trap), so the cap_paused
    # clause is load-bearing. Continuation path: its own finally already set
    # terminal_status = "cap_paused" when the cap re-fired, so `== "completed"`
    # is already False and the block skips regardless of the second clause.
    if terminal_status == "completed" and result_sink.get("cap_disposition") != "cap_paused":
        try:
            from app.services.todos_service import reconcile_open_todos_on_run_end  # noqa: PLC0415
            await reconcile_open_todos_on_run_end(
                await get_pg_pool(),
                UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                emit=_emit,
                redis=redis,
                run_id=run_id,
            )
        except BaseException:
            logger.exception("RUN-01b reconciler failed for run %s", run_id)

    # Plan 075.4-03 T-075.4-04 — STEP-SWAP race fix. finalize UPDATE (step 4)
    # lands BEFORE the terminal sentinel (step 5) so the frontend's SSE `done`
    # implies the DB row already committed status. Pitfall 2 (sentinel-before-
    # EXPIRE) still holds because EXPIRE (step 6) follows the sentinel.

    # 4. UPDATE runs row — status/error/completed_at/message_id/tokens.
    # Phase 145-03 (D-145-09): a TRUE terminal routes the runs.status write +
    # both ZREMs through the atomic owner finalize_run_terminal (status lands
    # FIRST, then ZREMs). cap_paused is NON-terminal + re-attachable — it MUST
    # keep its runs:active membership, so it writes its status via the shared
    # finalize_run DIRECTLY (NOT the owner, which would ZREM). The producer's
    # Deep first-turn is never "cap_paused" → always the terminal branch
    # (byte-identical to the pre-unification producer). Phase 073 TOKEN-COL-01
    # (D-073-09): NULL + warn when the SDK never surfaced usage; the warning
    # string carries run/provider/model identifiers ONLY — NO token VALUES
    # (T-073-04 mitigation).
    try:
        if _input_tokens_total is None and _output_tokens_total is None:
            logger.warning(
                "runs.usage missing for run=%s provider=%s model=%s",
                run_id, resolved_provider, resolved_model,
            )
        if terminal_status != "cap_paused":
            await finalize_run_terminal(
                pool=await get_pg_pool(),
                redis=redis,
                run_id=run_id,
                thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                status=terminal_status,
                error=terminal_error,
                completed_at=datetime.now(timezone.utc),
                message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                input_tokens=_input_tokens_total,
                output_tokens=_output_tokens_total,
            )
        else:
            await finalize_run(
                await get_pg_pool(),
                run_id=run_id,
                status=terminal_status,
                error=terminal_error,
                completed_at=datetime.now(timezone.utc),
                message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                input_tokens=_input_tokens_total,
                output_tokens=_output_tokens_total,
            )
    except BaseException:
        logger.exception("runs row finalize+ZREM failed for run %s", run_id)

    # 5. TERMINAL SENTINEL XADD — MUST come AFTER finalize (Plan 075.4-03 race
    # fix) AND BEFORE EXPIRE (Pitfall 2). Use _emit_terminal (no MAXLEN — sentinel
    # must not be trimmed, Pitfall 5). Map runs.status enum → SSE TERMINAL_TYPES.
    # Gated on membership so cap_paused (NON-terminal, not in the map — Landmine 6)
    # skips the sentinel: the agent_loop already emitted the non-terminal cap_paused
    # event. This `if ... in` guard is the SUPERSET of the producer's unconditional
    # dict-access (the producer's status is always mapped) and the continuation's
    # skip. CR-02 + WR-03: catch BaseException (incl. CancelledError) so a
    # lifespan-shutdown cancel mid-finalize doesn't leave the runs row stuck
    # 'streaming', plus any future ValueError from the _emit_terminal type guard.
    if terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE:
        try:
            await _emit_terminal(
                redis, run_id,
                _RUN_STATUS_TO_TERMINAL_TYPE[terminal_status],
                error=terminal_error,
            )
        except BaseException:
            logger.exception("Terminal sentinel XADD failed for run %s", run_id)

    # 6. EXPIRE Redis stream — 600s completed, 60s else (REDIS-SETUP.md TTL discipline).
    _ttl = 600 if terminal_status == "completed" else 60
    try:
        await redis.expire(f"run:{run_id}", _ttl)
    except BaseException:
        logger.exception("EXPIRE failed for run %s", run_id)

    # NOTE: the standalone runs:active / runs_by_thread ZREM that used to live
    # here (old step 5) is GONE — it now co-writes atomically INSIDE
    # finalize_run_terminal above (Phase 145-03 / D-145-09), so status +
    # runs:active can no longer drift. The cap_paused branch (plain finalize_run)
    # deliberately skips the ZREM (keeps the run re-attachable).

    # 7. Phase 092-05 F2: a HARNESS run that escapes via exception/timeout/cancel
    # never reached run_workflow's own finish_run, so workflow_runs would stay
    # 'active' and the thread is wedged locked (lock_is_stale=false, no UI
    # recovery). Terminalize the workflow_runs row + clear the anchor here on any
    # NON-completed terminal status. Idempotent: finish_run no-ops the anchor-clear
    # if run_workflow already cleared it. A natural-success run
    # (terminal_status=='completed') is SKIPPED — run_workflow already wrote
    # finish_run(..., 'completed'). Deep runs / continuations
    # (active_workflow_run_id is None) skip this entirely (byte-identical).
    #
    # 096-09 (UAT Test 2 restart-resumability fix): on a GRACEFUL app shutdown, do
    # NOT terminalize — leaving workflow_runs 'active' + the thread anchor intact is
    # PRECISELY what makes the boot-time resume sweep re-claim and re-drive this run.
    # The gate is the ONLY change: user-Stop / crash / timeout (flag False) still
    # terminalize exactly as before — byte-identical.
    from app.services.harness_engine import is_app_shutting_down  # noqa: PLC0415
    if (
        active_workflow_run_id is not None
        and terminal_status != "completed"
        and not is_app_shutting_down()
    ):
        try:
            from app.db.workflows import finish_run as _finish_wf  # noqa: PLC0415

            # ── Phase 204 (L-01 / D-204-01) — DO NOT WRITE 'failed' OVER A CANCEL ──
            #
            # The v2.8 rule below reads the LOCAL classifier, which only knows what
            # happened inside THIS worker's producer. A cross-worker Stop is decided
            # elsewhere: worker A runs `cancel_workflow_run_internals` (writing
            # `cancelled`) and broadcasts; worker B's engine aborts. If B's escape
            # arrives as anything other than a bare CancelledError — the wall-clock
            # `wait_for` firing in the same window, or an executor turning the abort
            # into an exception on its way out — B's classifier says `failed` and this
            # write lands `failed` ON TOP OF A's `cancelled`. The row then tells the
            # owner their run broke when in fact they stopped it.
            #
            # Consulting the cancel registry is what closes that race, and it closes it
            # in the ONE safe direction: it can only ever turn `failed` into
            # `cancelled` for a run somebody really did cancel. It never invents a
            # cancel (the key is written only by `broadcast_run_cancellation`) and it
            # never touches the `completed` path (gated out above).
            _cancel_known = False
            try:
                from app.services.run_lifecycle import is_run_cancelled  # noqa: PLC0415
                _cancel_known = await is_run_cancelled(redis, active_workflow_run_id)
            except Exception:
                logger.exception(
                    "F2: cancel-registry read failed for workflow run %s "
                    "(falling back to the local classifier)",
                    active_workflow_run_id,
                )

            await _finish_wf(
                await get_pg_pool(),
                active_workflow_run_id,
                # v2.8-audit cancel-honesty fix: a user Stop sets
                # terminal_status='cancelled' and the workflow_runs CHECK + every
                # terminal-status consumer already handle 'cancelled' — record the
                # true intent. Every OTHER non-completed escape (timed_out is NOT in
                # the workflow_runs CHECK, failed, crash) keeps writing 'failed'.
                # 204: ...UNLESS the cancel registry says this run was cancelled, in
                # which case the far worker's intent wins over the local guess.
                "cancelled"
                if (terminal_status == "cancelled" or _cancel_known)
                else "failed",
            )
        except BaseException:
            logger.exception(
                "F2 harness-failure terminalize failed for run %s",
                active_workflow_run_id,
            )
    elif (
        active_workflow_run_id is not None
        and terminal_status != "completed"
    ):
        # Shutdown path — left resumable on purpose.
        logger.info(
            "F2 skipped for workflow run %s — app shutting down, "
            "left active for the boot-time resume sweep (096-09)",
            active_workflow_run_id,
        )


async def run_producer(
    run_id: _uuid_mod.UUID,
    *,
    thread_id,
    current_user,
    supabase,
    redis,
    user_settings,
    body,
    resolved_model,
    resolved_provider,
    active_workflow_run_id,
    kickoff_definition,
    kickoff_definition_id,
) -> None:
    """Producer task — XADDs every SSE event to run:{run_id} Redis Stream.

    Phase 162.5 Plan 03 (G-5 extraction): the inline ``agent_runner`` closure body
    lifted VERBATIM out of ``send_message``. The captured closure vars are now
    explicit parameters (user_settings/body/resolved_model/resolved_provider/
    active_workflow_run_id/kickoff_definition/kickoff_definition_id + thread_id/
    current_user/supabase/redis); the ``create_task``/``RUN_TASKS`` registration +
    ``_evict`` done-callback STAY in ``send_message``. Lifetime decoupled from the
    SSE consumer (D-061-03). The _terminal_status classifier (except branches) +
    the shielded finalize STAY producer-shell concerns — the finalize now lives in
    the shared ``_finalize_producer_run`` (D-A3 unification).
    """
    # Late imports (D-A4): SSE transport + the test-patched run_agent_loop/
    # RunContext/get_pg_pool resolved FROM app.api.threads so the
    # patch("app.api.threads.*") surface still intercepts AND the cycle stays broken.
    from app.api.threads import (  # noqa: PLC0415
        _emit,
        _emit_terminal,
        _spawn,
        RUN_TASKS,
        run_agent_loop,
        RunContext,
        get_pg_pool,
    )

    # State for the finally — set inside the body, read by the finalize call.
    _terminal_status: str = "completed"  # default — set on natural completion
    _terminal_error: str | None = None
    # Phase 066 D-066-07: capture per-iteration context for the timed_out error
    # string. Updated each iteration BEFORE the LLM stream block so the outer
    # except sees the iteration at which the timer fired. MUST be declared at
    # function scope (BEFORE the try:) — declaring inside try: would cause
    # UnboundLocalError if a TimeoutError fires before the agent loop iterates.
    _last_iteration: int = 0
    _last_model_id: str = ""
    _last_per_call_budget: int = 0

    try:                          # OUTER try → finally runs shielded finalize
        # Phase 066 D-066-01: the outer 120s total-deadline asyncio.timeout
        # wrapper that lived here in Phase 061 has been DELETED. The agent loop now
        # has no hard total cap (matches Claude/ChatGPT UX). Per-LLM-call deadlines
        # live INSIDE the iteration loop at the SDK stream blocks (D-066-02). Tool
        # execution (sandbox / web_search / sub-agent) is OUTSIDE the per-call
        # timer — tools own their own timeout discipline.
        #
        # Phase 162.5 Plan 03 (G-5 extraction): user_settings is now an explicit
        # parameter (was the send_message-hoisted closure var _user_settings). The
        # body reads it directly — behavior byte-identical.

        # Phase 089 Plan 03 (G-5 THE verbatim move): the entire agent loop MOVED
        # verbatim into app.services.agent_loop.run_agent_loop. This producer:
        # build the frozen RunContext, call run_agent_loop, consume the
        # AgentLoopResult. Behavior-preserving (D-089-03).
        _agent_loop_result = None
        # 089-03: per-iteration timeout context surfaced by the loop so the
        # `except asyncio.TimeoutError` classifier below can format the
        # byte-identical `timed_out: …` error string (Phase 066 D-066-07).
        _timeout_ctx: dict = {
            "last_iteration": _last_iteration,
            "last_model_id": _last_model_id,
            "last_per_call_budget": _last_per_call_budget,
        }
        # 089-03: finalizer-needed outputs surfaced by the loop on EVERY exit path
        # (incl. exception) so _finalize_producer_run can persist the (possibly
        # partial) assistant message + token totals + system warnings. The loop
        # populates this in its outer `finally`; the by-reference dict is the
        # cycle-free surface that survives a re-raise.
        _result_sink: dict = {}

        try:  # middle try/finally — guarantees finalize even on GeneratorExit (client disconnect)
            # ── Phase 092 MODE-01 — producer mode-branch (SC#1) ────────────
            # The ONE additive branch: Harness iff the thread holds a live
            # workflow anchor (set by create_workflow_run in send_message), else
            # Deep. MUST live here (above the loop, inside this try) — NEVER inside
            # a provider streaming branch (075.x cascade rule). The Deep `else` is
            # BYTE-IDENTICAL to the pre-092 call. The surrounding except +
            # finally:finalize stay mode-agnostic. The harness branch's
            # `run_workflow` owns the workflow_runs terminal write internally; the
            # producer-shell `runs` row still finalizes via _finalize_producer_run
            # for SSE-terminal consistency.
            if active_workflow_run_id is not None:        # Harness
                # Phase 162.5 Plan 02 (G-5 extraction, D-A2/D-A4): the harness
                # run-context / scope BUILD moved VERBATIM to the workflow_kickoff
                # run-context seam — byte-identical. Only the BUILD moves;
                # run_workflow + _load_run_definition + _harness_emit stay HERE (the
                # producer owns the run_workflow call). The harness_engine imports
                # stay LOCAL (dodge the import cycle); _harness_emit + _spawn are
                # threaded into the seam.
                from app.services.harness_engine import (  # noqa: PLC0415
                    run_workflow,
                    _load_run_definition,
                    _emit as _harness_emit,
                )
                from app.services.workflow_kickoff import build_harness_run_context  # noqa: PLC0415
                _wf_pool = await get_pg_pool()
                _wf_definition = await _load_run_definition(
                    _wf_pool, active_workflow_run_id
                )
                # Facet A (092-07): thread the producer runs.run_id into the seam
                # as producer_run_id (the FK target for sub-agent parent_run_id).
                _producer_run_id = run_id
                wf_ctx = await build_harness_run_context(
                    active_workflow_run_id=active_workflow_run_id,
                    producer_run_id=_producer_run_id,
                    kickoff_definition=kickoff_definition,
                    thread_id=thread_id,
                    body=body,
                    current_user=current_user,
                    user_settings=user_settings,
                    supabase=supabase,
                    redis=redis,
                    pool=_wf_pool,
                    harness_emit=_harness_emit,
                    spawn=_spawn,
                )
                await run_workflow(
                    active_workflow_run_id,
                    _wf_definition,
                    wf_ctx,
                    pool=_wf_pool,
                    redis=redis,
                    # Facet B (092-07): route engine SSE events to the producer
                    # stream the frontend watches (run:{producer_run_id}).
                    stream_run_id=run_id,
                )
                # ── 093-05 D-11: answer surfacing lives in run_workflow ──────
                # The F6/F7 surfacing was moved INTO the shared helper
                # `harness_engine._surface_final_answer`, which run_workflow invokes
                # on its success terminal BEFORE the terminal `run_completed` (D-11,
                # Pitfall 5) — THE single surfacing + persist owner for ALL entry
                # paths. So the live-kickoff branch surfaces NOTHING inline and
                # installs NO harness persist callable into `_result_sink`:
                # _finalize_producer_run reads `_result_sink.get("persist")` and is
                # a no-op when absent → no double-persist. The Deep `else` branch +
                # run_agent_loop + the Deep `_result_sink` flow stay byte-identical (D-14).
            else:                                          # Deep — byte-identical
                ctx = RunContext(
                    run_id=run_id,
                    thread_id=thread_id,
                    current_user=current_user,
                    user_settings=user_settings,
                    body=body,
                    redis=redis,
                    supabase=supabase,
                    resolved_model=resolved_model,
                    resolved_provider=resolved_provider,
                )
                _agent_loop_result = await run_agent_loop(
                    ctx,
                    emit=_emit,
                    emit_terminal=_emit_terminal,
                    spawn=_spawn,
                    timeout_ctx=_timeout_ctx,
                    result_sink=_result_sink,
                )
            # Mirror the loop-surfaced timeout context back onto the
            # producer-shell locals the classifier reads (keeps the timed_out
            # error string byte-identical — Phase 066 D-066-07).
            _last_iteration = _timeout_ctx.get("last_iteration", _last_iteration)
            _last_model_id = _timeout_ctx.get("last_model_id", _last_model_id)
            _last_per_call_budget = _timeout_ctx.get("last_per_call_budget", _last_per_call_budget)

        except asyncio.TimeoutError:
            # Phase 066 D-066-05 + D-066-07: per-LLM-call asyncio.timeout fired
            # inside the SDK iteration block. 089-03: the loop surfaces the
            # per-iteration context via the by-reference _timeout_ctx dict (mutated
            # even when the TimeoutError propagates out of the loop, before the
            # post-call mirror above runs). Read it here so the timed_out error
            # string carries the real iteration/model — byte-identical.
            _last_iteration = _timeout_ctx.get("last_iteration", _last_iteration)
            _last_model_id = _timeout_ctx.get("last_model_id", _last_model_id)
            _last_per_call_budget = _timeout_ctx.get("last_per_call_budget", _last_per_call_budget)
            # Strict partition guard: timer fire = system = 'timed_out'. The
            # user-Stop write at runs.py stays 'cancelled' (UNCHANGED).
            _terminal_status = "timed_out"
            _terminal_error = (
                f"timed_out: {_last_per_call_budget}s per-call deadline "
                f"exceeded at iteration {_last_iteration} "
                f"(model={_last_model_id})"
            )
            logger.warning(
                "Run %s timed out at iteration %d (model=%s, budget=%ds)",
                run_id, _last_iteration, _last_model_id, _last_per_call_budget,
            )
        except asyncio.CancelledError:
            # D-066-05 UNCHANGED: cancellation comes from app lifespan shutdown OR
            # DELETE /runs/{id} (cancel verb). The DELETE handler writes its own
            # error string ('cancelled_by_user') in runs.py; this branch leaves
            # _terminal_error = None and lets the finalizer write NULL, which is the
            # legacy contract for in-process producer cancellation.
            _terminal_status = "cancelled"
            _terminal_error = None
            raise   # MUST re-raise so timeout context + asyncio task state stay correct (Pitfall 3)
        except Exception as e:
            # D-066-07 extended format: 'failed: <ExceptionClass>: <truncated≤200chars>'.
            # The 200-char cap (T-066-02 mitigation) prevents accidental traceback /
            # API-key-fragment leakage via the RLS-readable runs.error column.
            _terminal_status = "failed"
            _truncated_msg = (str(e) or "")[:200]
            _terminal_error = f"failed: {type(e).__name__}: {_truncated_msg}"
            logger.exception("Run %s failed", run_id)
        finally:
            # Phase 061 (D-061-04, Pitfall 2): the shared shielded finalizer with
            # strict ordering — persist → sys-warnings → RUN-01b → finalize → sentinel
            # → EXPIRE → F2, registry pop LAST. asyncio.shield protects the whole
            # block from app-shutdown cancellation (058/059 invariant preserved).
            # The producer's Deep first-turn is never cap_paused, so
            # _finalize_producer_run always takes the terminal branch — byte-identical
            # to the pre-unification _shielded_finalize.
            try:
                await asyncio.shield(_finalize_producer_run(
                    run_id=run_id,
                    thread_id=thread_id,
                    redis=redis,
                    result_sink=_result_sink,
                    terminal_status=_terminal_status,
                    terminal_error=_terminal_error,
                    active_workflow_run_id=active_workflow_run_id,
                    resolved_provider=resolved_provider,
                    resolved_model=resolved_model,
                ))
            except asyncio.CancelledError:
                raise   # propagate; lifespan-cancel path
            finally:
                # 8. Self-evict from registry (done-callback also handles this; defense-in-depth)
                RUN_TASKS.pop(run_id, None)

    # CR-01 fix: classification of TimeoutError / CancelledError / Exception lives
    # INSIDE the inner try (just before its finally) so the finalize reads the
    # correct _terminal_status. CancelledError still propagates out via the inner
    # re-raise so the asyncio task transitions to CANCELLED state correctly (Pitfall 3).
    finally:
        pass  # outer try kept structurally; classification handled by inner except branches above.


# ───────────────────────────────────────────────────────────────────────
# Phase 092 (092-03 / CONT-01) — Deep-run continuation spawner.
# POST /runs/{id}/continue (runs.py) calls this to re-drive the SAME run_id
# within a FRESH bounded budget, CONSUMING the persisted dropped tool calls
# (SC#4). NET-NEW (PATTERNS.md "No Analog Found"): the Deep-run continuation.
# Phase 162.5 Plan 03 (D-A3 unification): its near-duplicate inner _finalize is
# GONE — it now reuses the SAME _finalize_producer_run as the producer (persist →
# sys-warnings → RUN-01b → finalize/keep-active → sentinel-or-skip → EXPIRE →
# RUN_TASKS.pop). The only twist is the cap_paused disposition: if the
# continuation hits the cap AGAIN it re-pauses (terminal_status="cap_paused" →
# plain finalize_run keep-active, no terminal sentinel) so the next Continue can
# resume, instead of finalizing terminal.
# ───────────────────────────────────────────────────────────────────────
async def spawn_continuation_run(
    *,
    run_id: _uuid_mod.UUID,
    thread_id: str,
    current_user: dict,
    redis,
    supabase,
    dropped_tool_calls: list[dict],
) -> None:
    """Re-drive ``run_id`` consuming the persisted dropped tool calls (SC#4)."""
    # Late import (D-A4): the shared RUN_TASKS registry FROM app.api.threads
    # (_continuation closes over it; registration below is synchronous so the
    # cancel verb can find the live task before /continue returns).
    from app.api.threads import RUN_TASKS  # noqa: PLC0415

    async def _continuation() -> None:
        # Late imports (D-A4): resolve the SSE transport + test-patched
        # run_agent_loop/RunContext/load_user_settings FROM app.api.threads (parity
        # with the producer; keeps patch("app.api.threads.*") intercepting).
        from app.api.threads import (  # noqa: PLC0415
            _emit,
            _emit_terminal,
            _spawn,
            run_agent_loop,
            RunContext,
            load_user_settings,
        )

        _terminal_status = "completed"
        _terminal_error: str | None = None
        _result_sink: dict = {}
        # Hoisted for the shared finalizer's best-effort missing-usage warning — a
        # continuation that fails before load_user_settings leaves these None (the
        # warning then logs provider=None model=None; no functional change — the old
        # inner _finalize simply omitted this best-effort log line entirely).
        resolved_provider = None
        resolved_model = None
        try:
            user_settings = load_user_settings(current_user["id"])
            resolved_model = user_settings.llm_model
            resolved_provider = user_settings.active_provider
            # Minimal MessageCreate carrier — the loop reads body.model/.provider/
            # .agent_mode/.content; a continuation carries no new user content.
            body = MessageCreate(content="", model=resolved_model, provider=resolved_provider)
            ctx = RunContext(
                run_id=run_id,
                thread_id=thread_id,
                current_user=current_user,
                user_settings=user_settings,
                body=body,
                redis=redis,
                supabase=supabase,
                resolved_model=resolved_model,
                resolved_provider=resolved_provider,
                resume_dropped_tool_calls=True,
                dropped_tool_calls=tuple(dropped_tool_calls),
            )
            try:
                await run_agent_loop(
                    ctx,
                    emit=_emit,
                    emit_terminal=_emit_terminal,
                    spawn=_spawn,
                    result_sink=_result_sink,
                )
            except asyncio.CancelledError:
                _terminal_status = "cancelled"
                raise
            except Exception as e:  # noqa: BLE001 — mirror the producer classifier
                _terminal_status = "failed"
                _terminal_error = f"failed: {type(e).__name__}: {(str(e) or '')[:200]}"
                logger.exception("Continuation run %s failed", run_id)
        finally:
            # cap_disposition override — if the cap fired AGAIN, stay non-terminal.
            _cap = _result_sink.get("cap_disposition")
            if _cap == "cap_paused":
                _terminal_status = "cap_paused"

            # D-A3 unification: reuse the ONE shared finalizer. active_workflow_run_id
            # is None (a Deep-only continuation → the step-7 harness F2 gate skips
            # naturally); the cap_paused terminal_status routes step-4 to plain
            # finalize_run (KEEPS runs:active — re-attachable) + skips the step-5
            # terminal sentinel (cap_paused not in _RUN_STATUS_TO_TERMINAL_TYPE) —
            # byte-identical to the deleted inner _finalize. RUN_TASKS.pop stays here
            # in the outer finally (step 8).
            try:
                await asyncio.shield(_finalize_producer_run(
                    run_id=run_id,
                    thread_id=thread_id,
                    redis=redis,
                    result_sink=_result_sink,
                    terminal_status=_terminal_status,
                    terminal_error=_terminal_error,
                    active_workflow_run_id=None,
                    resolved_provider=resolved_provider,
                    resolved_model=resolved_model,
                ))
            except asyncio.CancelledError:
                raise
            finally:
                RUN_TASKS.pop(run_id, None)

    task = asyncio.create_task(_continuation())
    RUN_TASKS[run_id] = task

    def _evict(_t, _rid=run_id):
        RUN_TASKS.pop(_rid, None)
    task.add_done_callback(_evict)

