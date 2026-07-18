"""Harness state-machine engine (Phase 091 / HARNESS-01 + HARNESS-03).

``run_workflow`` is a hand-rolled async transition loop (NO LangGraph — raw
asyncio per CLAUDE.md) that drives a published :class:`WorkflowDefinition`
through its phases in ``phase_index`` order over the Phase 090 tables. The LLM
NEVER selects the next phase — the backend does, by index. This is the whole
correctness bar of the milestone (HARNESS-01).

The strict 2-phase write (HARNESS-03, the highest-risk surface) is delegated to
``db/workflows.py``:
  1. ``mark_phase_active`` — DURABLE active BEFORE any work runs.
  2. execute (dispatched by phase_type via ``PHASE_TYPE_REGISTRY`` — the SEAM).
  3. ``complete_phase`` — flip to ``completed`` AND write output in ONE atomic
     UPDATE, ONLY after the output is durable.
A phase whose execution raises mid-work is left ``active`` (never ``completed``)
so a later sweep re-runs it — the crash-leaves-active resume contract.

DISPATCH SEAM:
  - ``PHASE_TYPE_REGISTRY`` : dispatch-by-phase_type → Plan 03 registers the 5
    real executors. Empty here → :class:`PhaseTypeNotRegistered`.

VALIDATION GATES (HARNESS-04 / Plan 05): ``_run_phase_with_gates`` wraps each
phase in a bounded-retry loop — run under a wall-clock cap (``asyncio.wait_for``,
``_DEFAULT_PHASE_WALL_CLOCK`` sized from real knobs), run the validation gates,
and on failure retry up to the validator's ``max_retries`` (≤ 3 total, never
loops — SC#3) feeding the error back via ``ctx.retry_feedback`` (PRODUCER side;
Plan 03 executors CONSUME it). On exhaustion the ``on_failure`` routes: ``fail_run``
(D-07, keep partials + plain reason) or ``skip_to_phase:<slug>`` (D-09); unknown
→ fail_run (fail-safe). Every attempt audits + emits ``gate_failed`` (D-08).

Completion semantics (D-10 / D-11): on success the FINAL phase's output IS the
assistant chat message verbatim — there is NO extra synthesis LLM call. The
engine sets ``ctx.final_output`` to the last phase's output; Plan 03's executors
return the chat-ready payload and the existing message-insert path persists it.

WRITE-before-EMIT (D-v2.5-03): every durable DB write precedes its SSE ``_emit``;
Postgres is truth, the ``run:{run_id}`` stream is a hint consumers reconcile.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import namedtuple
from datetime import datetime, timezone
from typing import Callable
from uuid import UUID

from app.config import settings
from app.db.workflows import (
    advance_current_phase,
    ask_user_response_exists,
    claim_run,
    complete_phase,
    fail_phase,
    find_resumable_runs,
    finish_run,
    get_active_phase,
    get_pending_ask_user,
    load_run_phases,
    mark_phase_active,
    skip_phase,
    write_audit,
)
from app.models.harness import WorkflowDefinition
from app.services.ask_user_service import resume_pending_prompt

logger = logging.getLogger(__name__)

# ── App-shutdown flag (096-09 restart-resumability fix / UAT Test 2) ──────────
# A GRACEFUL uvicorn shutdown (SIGINT/SIGTERM — what dev Ctrl+C and production
# deploys/restarts use) cancels in-flight harness producers. Without this flag,
# the F2 backstop (threads.py) terminalizes the workflow_runs row to 'failed' and
# clears the thread anchor on that cancel — so the boot-time resume sweep
# (find_resumable_runs needs status active + anchor + an active phase) can NEVER
# re-claim it. main.py sets this True immediately before cancelling RUN_TASKS, so
# the producer's finalizer can tell "app is going down, leave me resumable" apart
# from "user Stop / crash / timeout, terminalize me". A HARD kill (SIGKILL) runs
# no code at all → row stays active → already resumable; this flag is ONLY about
# the graceful path. Default False keeps every non-shutdown path byte-identical.
_APP_SHUTTING_DOWN = False


def set_app_shutting_down(value: bool = True) -> None:
    """Mark the process as shutting down (called from main.py lifespan)."""
    global _APP_SHUTTING_DOWN
    _APP_SHUTTING_DOWN = value


def is_app_shutting_down() -> bool:
    """True once the lifespan shutdown has begun cancelling producers."""
    return _APP_SHUTTING_DOWN


# NOTE: ``run_gates`` (harness.validators) and ``parse_skip_target``
# (harness.reachability) are imported LAZILY inside the functions that use them.
# A top-level import of anything under the ``app.services.harness`` PACKAGE runs
# that package's ``__init__`` → ``phase_types.register_all()`` → which imports
# back from THIS module before ``PHASE_TYPE_REGISTRY`` is bound (circular import).
# The lazy import (the same pattern phase_types uses for the engine) breaks it.


# ── SEAMS ────────────────────────────────────────────────────────────────────
class PhaseTypeNotRegistered(KeyError):
    """Raised when a phase_type has no executor in PHASE_TYPE_REGISTRY (Plan 03)."""


# Dispatch-by-phase_type SEAM. Plan 03 registers the 5 real executors here and
# flips the dispatch tests live; this plan ships it EMPTY (tests inject stubs).
PHASE_TYPE_REGISTRY: dict[str, Callable] = {}

# Per-phase wall-clock cap default, sized from existing knobs (D-12): a phase
# making up to harness_phase_max_steps bounded LLM calls must allow >= N x the
# per-call timeout. Read off Settings so an operator can override via env without
# code change. Per-phase override is ``phase.config.wall_clock_seconds``.
_DEFAULT_PHASE_WALL_CLOCK = settings.harness_phase_wall_clock_seconds

# Per-phase STEP cap default (D-12). The cap itself is enforced INSIDE the
# executor (run_task_sub_agent's max_steps in Plan 03's llm_agent path); the
# engine surfaces the default here + onto ctx so the executor and the engine
# agree on the bound. Aligned to the Explorer=8 convention via Settings.
_DEFAULT_PHASE_MAX_STEPS = settings.harness_phase_max_steps

# Outputs larger than this spill to the workspace-files bucket (path-only), so
# the workflow_phases.output jsonb never bloats (T-091-07 / Pattern 3).
_OUTPUT_INLINE_LIMIT = 64 * 1024  # 64 KB


async def _emit(redis, run_id: UUID, type: str, **fields) -> None:
    """One canonical XADD to ``run:{run_id}`` (mirrors threads.py:139)."""
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )


def _persist_output(output: dict) -> dict:
    """Return the output dict to durably persist — NEVER discarding the payload.

    CR-02 fix (091-REVIEW): the prior version returned
    ``{"_spilled_path": "workspace-files://pending"}`` for outputs > 64 KB, but NO
    phase executor ever supplies a real ``_spilled_path`` (the bucket-write path
    was never wired). The result silently DESTROYED any large phase output —
    ``workflow_phases.output`` kept only a dead pointer string, and a resumed
    downstream phase (or the final chat message) read the placeholder instead of
    the real text. Correctness (no lost output) outranks jsonb size.

    Policy: store the FULL output inline. jsonb can hold it — the 64 KB cap is an
    OPTIMIZATION, not a hard storage limit. If a real ``_spilled_path`` is ever
    supplied by a future bucket-spill path, honor it (path-only); otherwise keep
    the payload inline and log a debug note that bucket spill is not yet wired.
    Bucket spill remains a future optimization, NOT a correctness dependency.
    """
    try:
        serialized = json.dumps(output)
    except (TypeError, ValueError):
        # Non-JSON-serializable output is a phase-executor bug (Plan 03 owns the
        # return shape); surface it rather than silently store nothing.
        raise
    if len(serialized) > _OUTPUT_INLINE_LIMIT:
        # A real spill pointer (future optimization) is honored if present...
        spilled_path = output.get("_spilled_path") if isinstance(output, dict) else None
        if spilled_path:
            return {"_spilled_path": spilled_path}
        # ...otherwise store inline. NEVER drop the payload (CR-02).
        logger.debug(
            "harness phase output is %d bytes (> %d inline limit); storing inline "
            "(bucket spill not yet wired — payload preserved, no data loss)",
            len(serialized),
            _OUTPUT_INLINE_LIMIT,
        )
        return output
    return output


async def _expire_pending_ask_user(pool, thread_id, run_id) -> None:
    """D-06 (BUG-260605-01): resolve any outstanding ask_user prompt when a run
    reaches terminal status. INSERT-only (HARNESS-06 audit posture): writes a
    system message shaped as the matching ask_user_response with expired=true,
    so the EXISTING /pending NOT EXISTS correlation excludes it — no query
    change needed for new runs.

    The SELECT mirrors the panel.py /pending shape (jsonb ``@>`` containment +
    the NOT EXISTS exclusion of already-answered prompts), scoped to THIS run
    via the prompt payload's ``run_id`` (phase_types.py stores ``ctx.run_id`` —
    the workflow_run id). The INSERT byte-matches the correlation the /pending
    query excludes on: ``kind='ask_user_response'`` + the prompt's
    ``tool_call_id`` (correlated via ``tool_calls->0->>'tool_call_id'``).
    Never UPDATEs any existing row. No-op when nothing is pending. Callers wrap
    each call in try/except — cleanup must never convert a successful
    terminalization into a crash.
    """
    if thread_id is None:
        return
    _tid = thread_id if isinstance(thread_id, UUID) else UUID(str(thread_id))
    rows = await pool.fetch(
        """
        SELECT m.tool_calls->0->>'tool_call_id' AS tool_call_id, m.user_id
        FROM messages m
        WHERE m.thread_id = $1
          AND m.role = 'system'
          AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
          AND m.tool_calls->0->>'run_id' = $2
          AND NOT EXISTS (
            SELECT 1 FROM messages r
            WHERE r.thread_id = m.thread_id
              AND r.role = 'system'
              AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
              AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
          )
        """,
        _tid,
        str(run_id),
    )
    for r in rows:
        tcid = r["tool_call_id"]
        if not tcid:
            continue
        # Plain Python list for the jsonb param — the pool's JSONB codec
        # (dependencies._init_pg_connection, D-073-06) serializes it, mirroring
        # insert_assistant_message (db/runs.py). $N placeholders only (T-096-03-03).
        await pool.execute(
            """
            INSERT INTO messages (thread_id, user_id, role, content, tool_calls, origin)
            VALUES ($1, $2, 'system', '', $3, $4)
            """,
            _tid,
            r["user_id"],
            [{
                "kind": "ask_user_response",
                "tool_call_id": tcid,
                "expired": True,
                "response_text": None,
            }],
            # CTX-01 (T-120-04 / T-120-06): harness ask_user expiry row — origin is a
            # positional $4 bind (NEVER f-stringed: no injection surface).
            "harness",
        )
        logger.info(
            "expired pending ask_user prompt tcid=%s for terminal run %s",
            tcid, run_id,
        )


# ── F7 (092-07): run-level grounding union ────────────────────────────────────
def _accumulate_phase_grounding(
    output: dict | None,
    run_source_refs: list[dict],
    run_citations: list[dict],
    run_similarity_scores: list[float],
) -> None:
    """Fold one phase's grounding (if any) into the run-level union (in place).

    A phase executor's output (harness/phase_types.py) may carry ``source_refs`` /
    ``citations`` (per-tool lists) and ``similarity_scores`` (one avg-cosine per
    search call). Mirrors the Deep agent-loop accumulation EXACTLY
    (agent_loop.py:2229-2234): EXTEND the ref/citation lists, EXTEND the score list
    (the per-phase list is already the per-call collection from the sub-agent loop).
    Non-grounding phases (no keys) contribute nothing — no behavior change.
    """
    if not isinstance(output, dict):
        return
    refs = output.get("source_refs")
    if refs:
        run_source_refs.extend(refs)
    cites = output.get("citations")
    if cites:
        run_citations.extend(cites)
    scores = output.get("similarity_scores")
    if scores:
        run_similarity_scores.extend(scores)


def _finalize_run_grounding(
    run_source_refs: list[dict],
    run_citations: list[dict],
    run_similarity_scores: list[float],
) -> tuple[list[dict], list[dict], dict | None]:
    """Dedupe the union + compute confidence, MATCHING the Deep path exactly.

    Returns ``(final_source_refs, final_citations, final_confidence)`` where:
      * ``final_citations`` = ``_deduplicate_citations`` of the union (Deep D-14).
      * ``final_source_refs`` = the deduped CITATION objects when present (Deep D-13:
        ``row["source_refs"] = unique_citations``), else the source_refs deduped by
        ``document_id`` (Deep backward-compat: ``unique_sources``). This is the value
        that lands in ``messages.source_refs`` so the references render with passages.
      * ``final_confidence`` = ``{"level", "avg_similarity", "disclaimer"}`` from the
        avg over the union via ``_compute_confidence`` (Deep D-05/D-10), or None when
        no similarity was gathered (a non-RAG workflow — no confidence chip, like Deep).

    Deep helpers are lazy-imported (agent_loop imports this package transitively; a
    top-level import risks the same cycle phase_types breaks lazily).
    """
    from app.services.agent_loop import (
        CONFIDENCE_DISCLAIMER,
        _compute_confidence,
        _deduplicate_citations,
    )

    unique_citations = _deduplicate_citations(run_citations) if run_citations else []
    if unique_citations:
        final_source_refs = unique_citations
    elif run_source_refs:
        # Deep backward-compat path: dedupe by document_id (agent_loop.py:2414).
        final_source_refs = list(
            {s["document_id"]: s for s in run_source_refs}.values()
        )
    else:
        final_source_refs = []

    final_confidence: dict | None = None
    if run_similarity_scores:
        final_avg = sum(run_similarity_scores) / len(run_similarity_scores)
        level = _compute_confidence(final_avg)
        disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
        final_confidence = {
            "level": level,
            "avg_similarity": round(final_avg, 4),
            "disclaimer": disclaimer,
        }

    return final_source_refs, unique_citations, final_confidence


# ── D-11: the SHARED answer-surfacing helper (Pitfall 5 / Landmine 5) ─────────
async def _surface_final_answer(ctx, run_id: UUID, stream_run_id, redis, pool) -> str | None:
    """Surface the harness final answer (delta + grounding) + persist it — ONCE.

    THE single surfacing site + the single persist owner for ALL THREE entry
    paths (live kickoff, resume, Continue). Previously the F6/F7 surfacing lived
    INLINE in the live-kickoff branch of ``threads.py`` only (≈:1268-1418), so
    resume (``_build_resume_context`` → ``run_workflow``) and Continue
    (``_harness_continuation`` → ``run_workflow``) NEVER reached it and lost their
    answer. ``run_workflow`` now calls this on its success terminal so all three
    surface identically (D-11).

    Ordering (mirror ``_shielded_finalize`` / D-v2.5-03): the caller has already
    done the durable ``finish_run`` UPDATE; this helper emits ``delta`` +
    ``sources`` / ``citations`` / ``confidence`` AND persists the assistant
    ``messages`` row, and the caller emits the terminal ``run_completed`` AFTER —
    so the visible answer + grounding land BEFORE the terminal sentinel.

    Single persist owner (Landmine 5): this helper persists the assistant message
    DIRECTLY (resume/Continue have no ``_result_sink``/``_shielded_finalize``).
    The live-kickoff path no longer installs a harness persist callable, so there
    is no double-persist / duplicate assistant message (the 075.x defect).

    Emits on the PRODUCER stream (``stream_run_id``) using the SAME canonical
    event vocabulary + 400-char citation-passage truncation the inline block used
    (mirroring the Deep path). Each emit is best-effort (a Redis hiccup must not
    abort the run — the persisted row below is the durable source of truth).

    Returns the inserted assistant ``messages`` id (str) or ``None`` (no text /
    persist failure). The producer-shell ``runs.message_id`` legitimately stays
    NULL (the durable answer is the ``messages`` row, not the producer shell) — we
    do NOT add a runs.message_id write that did not exist (the engine path's
    producer-shell ``runs`` row has no aggregated SDK usage either).
    """
    # The engine already set these on ctx at the completion block (:665-687).
    _final_output = getattr(ctx, "final_output", None) or {}
    final_text = _final_output.get("text", "") or ""
    # Phase 101.1-07 (gap 2 — single-owner persist): an honest emit failure has ALREADY
    # been persisted as the assistant ``messages`` row by ``_surface_failure_message``
    # (the executor's RC-4 surface) and carries the ``_surfaced`` flag on the final
    # output. Skip BOTH the durable persist AND the live delta here — a second insert
    # would render the SAME failure text twice (the duplicate-honest-failure-message
    # bug). The already-persisted row renders on the next reconcile, so nothing is lost.
    # Harness-only: Deep never returns a ``_surfaced`` final_output (Deep does not run
    # _exec_llm_emit), so this guard is a literal no-op on the shared path.
    if _final_output.get("_surfaced"):
        return None
    source_refs = getattr(ctx, "final_source_refs", None) or []
    citations = getattr(ctx, "final_citations", None) or []
    confidence = getattr(ctx, "final_confidence", None) or None

    # 1. LIVE render: emit the final answer as ONE `delta` (the engine produces the
    #    answer atomically per-phase — there is no token stream to mirror). Same
    #    canonical XADD the engine uses; frontend api.ts `delta → onDelta(content)`
    #    appends it to the assistant placeholder WITHOUT a reload.
    if final_text:
        try:
            await _emit(redis, stream_run_id, "delta", content=final_text)
        except Exception:
            logger.exception(
                "harness final_output delta emit failed for run %s "
                "(answer still persisted below)", run_id,
            )

    # 2. Grounding SSE on the producer stream — sources → citations (passage ≤400)
    #    → confidence, mirroring the Deep event vocabulary + ordering EXACTLY.
    try:
        if source_refs:
            await _emit(redis, stream_run_id, "sources", sources=source_refs)
        if citations:
            _sse_citations = []
            for _c in citations:
                _sse_c = dict(_c)
                _passage = _sse_c.get("passage")
                if _passage and len(_passage) > 400:
                    _sse_c["passage"] = _passage[:400]
                _sse_citations.append(_sse_c)
            await _emit(redis, stream_run_id, "citations", citations=_sse_citations)
        if confidence:
            await _emit(
                redis, stream_run_id, "confidence",
                level=confidence["level"],
                avg_similarity=confidence["avg_similarity"],
                disclaimer=confidence.get("disclaimer"),
            )
    except Exception:
        logger.exception(
            "harness grounding SSE emit failed for run %s "
            "(sources still persisted below)", run_id,
        )

    # 3. DURABLE persist — the SINGLE persist owner. Insert the assistant `messages`
    #    row directly (resume/Continue have no _result_sink), using the EXACT Deep
    #    insert_assistant_message param shape (so grounding renders on reload).
    #    tool_calls stays absent (the harness final answer is plain prose — the
    #    tool-call panel is Phase 094); token totals stay None (the engine owns its
    #    own audit; the producer-shell has no aggregated SDK usage). Lazy-import the
    #    Deep persist helpers to keep the harness-package import cycle broken (the
    #    engine already lazy-imports the Deep grounding helpers — match that).
    if not final_text:
        return None
    _thread_id = getattr(ctx, "thread_id", None)
    _user_id = ((getattr(ctx, "current_user", None) or {}).get("id"))
    if not _thread_id or not _user_id:
        logger.warning(
            "harness surfacing: missing thread_id/user_id on ctx for run %s "
            "(answer emitted but not persisted)", run_id,
        )
        return None
    from app.db.runs import insert_assistant_message
    from app.services.agent_loop import _strip_nul

    _conf = confidence or {}
    try:
        _inserted_id = await insert_assistant_message(
            pool,
            thread_id=UUID(_thread_id) if isinstance(_thread_id, str) else _thread_id,
            user_id=UUID(_user_id) if isinstance(_user_id, str) else _user_id,
            content=_strip_nul(final_text),
            source_refs=source_refs or None,
            confidence_level=_conf.get("level"),
            confidence_avg_similarity=_conf.get("avg_similarity"),
            confidence_disclaimer=_conf.get("disclaimer"),
            origin="harness",  # CTX-01 (T-120-04): this is a workflow row — never replay it in Deep.
        )
        return str(_inserted_id) if _inserted_id else None
    except Exception as e:
        logger.error("Failed to persist harness assistant message: %s", e)
        return None


# ── D-04 / RC-4: persist a real failure message before a harness failure return ──
# The reason_unknown sentinel — verbatim from the 094 UI-SPEC Copywriting Contract.
# When the engine has no reason string, we persist THIS (never empty content) so a
# failed run is never rendered as an empty "done" card (the RC-4 trust bug).
_REASON_UNKNOWN_SENTINEL = (
    "Failure reason not captured by the backend — surfaced explicitly so the "
    "run is never shown as an empty success."
)


async def _surface_failure_message(ctx, run_id: UUID, reason, pool) -> str | None:
    """Persist a real assistant FAILURE message before a harness failure return (RC-4).

    A strict SUBSET of ``_surface_final_answer``'s durable persist block: the
    success path persists the answer (with grounding); this persists the failure
    REASON as plain prose (no grounding — a failure has none). Called from BOTH of
    ``run_workflow``'s harness-only failure-return sites (the ``fail_run`` branch
    AND the ``skip_to_phase`` runtime guard) AFTER the ``run_failed`` emit and
    BEFORE the ``return`` — so a later reconcile reads a terminal run WITH a real
    ``messages`` row and renders failed-with-reason instead of a silent empty
    ``done`` (finding #3 / D-04).

    ⚠️ Deep byte-identical guard (Pitfall 2): this helper lives INSIDE
    ``harness_engine.py`` and is called ONLY from the two harness-only failure
    branches. It MUST NOT live in (or route through) the shared Deep+harness
    terminal path (the agent-runner's shielded finalize closure) — Deep never
    reaches this code.

    Owner-scoped (T-094-04-02): writes for the run's OWN owner via
    ``ctx.current_user["id"]`` + ``ctx.thread_id``, identical to the proven
    ``_surface_final_answer`` success path — no cross-user write, no new IDOR.

    ``reason_unknown`` fallback (T-094-04-04): an empty / missing reason persists
    the explicit ``_REASON_UNKNOWN_SENTINEL`` — NEVER empty content.

    Returns the inserted ``messages`` id (str) or ``None`` (missing owner ids /
    persist failure — a failing run must never crash inside this best-effort
    persist).
    """
    _thread_id = getattr(ctx, "thread_id", None)
    _user_id = ((getattr(ctx, "current_user", None) or {}).get("id"))
    if not _thread_id or not _user_id:
        # Never crash a failing run; the run_failed emit already fired.
        logger.warning(
            "harness failure surfacing: missing thread_id/user_id on ctx for run %s "
            "(run_failed emitted but failure message not persisted)", run_id,
        )
        return None

    # Lazy-import (keeps the harness-package import cycle broken — mirrors the
    # success path) and _strip_nul the content; the reason_unknown sentinel is the
    # load-bearing fallback that proves a failure is never shown as an empty success.
    from app.db.runs import insert_assistant_message
    from app.services.agent_loop import _strip_nul

    content = _strip_nul(reason or _REASON_UNKNOWN_SENTINEL)
    try:
        # Grounding params OMITTED (None) — a strict subset of the success persist.
        _inserted_id = await insert_assistant_message(
            pool,
            thread_id=UUID(_thread_id) if isinstance(_thread_id, str) else _thread_id,
            user_id=UUID(_user_id) if isinstance(_user_id, str) else _user_id,
            content=content,
            origin="harness",  # CTX-01 (T-120-04): workflow failure row — never replay it in Deep.
        )
        return str(_inserted_id) if _inserted_id else None
    except Exception as e:
        logger.error("Failed to persist harness failure message: %s", e)
        return None


async def _execute_phase(phase, accumulated_outputs: dict, ctx) -> dict:
    """Dispatch a phase to its executor via the registry SEAM (Plan 03 fills it)."""
    phase_type = phase.config.phase_type
    executor = PHASE_TYPE_REGISTRY.get(phase_type)
    if executor is None:
        raise PhaseTypeNotRegistered(
            f"no executor registered for phase_type {phase_type!r} "
            f"(Plan 03 registers the 5 real executors)"
        )
    return await executor(phase, accumulated_outputs, ctx)


# ── on_failure routing (Plan 05 / D-07/D-08/D-09) ────────────────────────────
# The outcome of running a phase through its bounded-retry gate loop.
#   kind == "completed"  → output is durable-ready; advance to the next phase.
#   kind == "skip_to"    → jump to target_slug (D-09); this phase is `skipped`.
#   kind == "fail_run"   → the run is `failed`; stop cleanly keeping partials (D-07).
PhaseOutcome = namedtuple("PhaseOutcome", ["kind", "output", "target_slug", "reason"])

# on_failure dispositions (ValidatorSpec.on_failure). UNKNOWN values route to
# fail_run (fail-safe — T-091-18 mitigation).
_OnFailure = namedtuple("_OnFailure", ["kind", "target_slug"])


def _parse_on_failure(on_failure: str) -> _OnFailure:
    """Parse a failing validator's ``on_failure`` disposition.

    Recognizes ``fail_run`` (the D-07 baseline), ``retry`` (retry exhausted ⇒ falls
    back to fail_run unless a skip_to_phase is configured), ``skip_to_phase:<slug>``
    (D-09), and ``ask_user`` (the D-11 generic 4th disposition — any validator can
    declare it; the engine pauses for a human choice via the 085 ask_user_service).
    ANY unrecognized value routes to ``fail_run`` (fail-safe, T-091-18).

    NOTE: ``ask_user`` is a PURE-PARSE result here — ``_route_on_failure`` (the sync
    mapper) cannot await the user, so the pause is resolved INLINE in
    ``_run_phase_with_gates`` via ``_resolve_failure_with_ask_user`` (where
    redis/pool/ctx are in scope — RESEARCH Pattern 3 / A4). A bare ``_route_on_failure``
    seeing an ``ask_user`` disposition treats it as ``fail_run`` (fail-safe — it
    cannot pause), so the engine MUST route ask_user through the async helper.
    """
    from app.services.harness.reachability import parse_skip_target

    target = parse_skip_target(on_failure)
    if target is not None:
        return _OnFailure("skip_to_phase", target)
    if on_failure == "ask_user":
        # D-11 — the 4th disposition. Resolved INLINE (the async helper), never by
        # the sync _route_on_failure (which cannot await the user).
        return _OnFailure("ask_user", None)
    if on_failure in ("fail_run", "retry"):
        # `retry` here means "retries are exhausted" → D-07 baseline (fail_run).
        return _OnFailure("fail_run", None)
    return _OnFailure("fail_run", None)  # unknown → fail-safe


def _failing_on_failure(phase, failed_idx: int | None) -> str:
    """The ``on_failure`` of the validator that produced this gate failure.

    WR-03 (091-08): ``run_gates`` now threads the FAILING validator's index back
    (``GateResult.validator_index``); the engine passes it here as ``failed_idx`` so
    the disposition comes from the SAME validator whose ``max_retries`` bounded the
    retry loop. When the index is known we index ``phase.validators[failed_idx]``
    directly. When it is None (e.g. a wall-clock timeout — no gate ran) we fall back
    to the prior heuristic: the first validator carrying a ``skip_to_phase``
    disposition if any, else the first validator's ``on_failure``.
    """
    validators = list(getattr(phase, "validators", None) or [])
    if not validators:
        return "fail_run"
    if failed_idx is not None and 0 <= failed_idx < len(validators):
        return validators[failed_idx].on_failure
    for v in validators:
        if v.on_failure.startswith("skip_to_phase:"):
            return v.on_failure
    return validators[0].on_failure


async def _run_phase_with_gates(
    phase,
    accumulated_outputs: dict,
    ctx,
    *,
    run_id: UUID,
    pool,
    redis,
    wall_clock: int,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
) -> PhaseOutcome:
    """Execute a phase under a bounded-retry gate loop (HARNESS-04 — the SC#3 bar).

    Runs the phase under a wall-clock cap (``asyncio.wait_for``), runs its
    validation gates, and on failure retries up to the failing validator's
    ``max_retries`` (default 2 → 3 total attempts) — feeding the validator error
    back into the next attempt via ``ctx.retry_feedback`` (the PRODUCER side; the
    Plan 03 LLM executors are the CONSUMER, round-trip proven in 07-T2). The bound
    is HARD: a deterministically-failing gate reaches ``failed`` in ≤ 3 attempts and
    NEVER loops; a consecutive-identical output short-circuits even faster (retrying
    won't help). Every attempt writes a ``gate_failed`` audit row AND emits a
    ``gate_failed`` SSE event (D-08 visible retries). On exhaustion the failing
    validator's ``on_failure`` routes: ``fail_run`` (D-07 baseline) or
    ``skip_to_phase:<slug>`` (D-09); an unknown value fails safe to ``fail_run``.

    Returns a :class:`PhaseOutcome`; the caller (``run_workflow``) commits the
    durable side-effects (complete/skip/fail) so the 2-phase write stays in the
    main loop.
    """
    # Facet B (092-07): gate_failed events are engine _emit sites too — route them
    # to the producer stream (run:{stream_run_id}) while gate_failed write_audit
    # stays keyed on the workflow ``run_id`` (the _emit / write_audit pair are
    # separate call sites taking distinct ids — the decoupling is mechanically
    # clean). Default to the workflow run_id when called without the kwarg
    # (back-compat for direct unit callers).
    stream_run_id = stream_run_id or run_id

    # Lazy import (breaks the harness-package import cycle — see module note).
    from app.services.harness.validators import run_gates

    # WR-03 (091-08): the retry bound AND the on_failure disposition must come from
    # the SAME failing validator. We don't know which validator fails until the gate
    # runs, so seed the bound from validators[0] and REBIND it to the failing
    # validator's max_retries the moment run_gates reports the failing index — so a
    # multi-validator phase where validators[0].max_retries differs from the
    # routing validator's no longer pairs a wrong bound with a wrong route.
    validators = list(getattr(phase, "validators", None) or [])
    phase_max_retries = validators[0].max_retries if validators else 2
    failed_idx: int | None = None

    # ── D-10 PRE-gate pass — run timing="pre" validators BEFORE the executor body ──
    # A pre validator (freshness's "check the date first" preflight) checks
    # inputs/scope rather than output. A pre failure routes via the SAME disposition
    # machinery (fail_run / skip_to_phase / ask_user) WITHOUT running the body —
    # unless an ask_user Proceed approves running despite the finding (helper returns
    # None → fall through to the body). A phase with NO pre validators gets a passing
    # GateResult immediately → byte-identical (the existing default-post path).
    pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")
    if not pre.passed:
        await write_audit(
            pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
            metadata={"phase": phase.slug, "attempt": 0, "error": pre.error_message,
                      "timing": "pre"},
        )
        await _emit(redis, stream_run_id, "gate_failed",
            phase=phase.slug, attempt=0, error=pre.error_message,
        )
        outcome = await _resolve_failure_with_ask_user(
            phase, pre.error_message, 0, pre.validator_index,
            run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
            is_pre=True,
        )
        if outcome is not None:
            return outcome  # fail_run / skip_to_phase / aborted ask_user
        # outcome is None → ask_user Proceed: fall through and run the body.

    attempt = 0
    last_output = None
    while True:
        # Execute under the wall-clock cap. A hanging phase fails cleanly at the
        # timeout and drives the SAME on_failure routing as a gate failure (D-12).
        try:
            output = await asyncio.wait_for(
                _execute_phase(phase, accumulated_outputs, ctx),
                timeout=wall_clock,
            )
        except asyncio.TimeoutError:
            gate_error = f"wall_clock_timeout after {wall_clock}s"
            # Treat the timeout as a terminal gate failure: audit + emit, then route.
            await write_audit(
                pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
                metadata={"phase": phase.slug, "attempt": attempt, "error": gate_error},
            )
            await _emit(redis, stream_run_id, "gate_failed",
                phase=phase.slug, attempt=attempt, error=gate_error,
            )
            # A wall-clock timeout has no failing-validator index (the phase hung
            # before gates ran) → failed_idx stays None → routing uses the phase's
            # disposition heuristic (skip_to_phase-bearing validator else first).
            return _route_on_failure(phase, gate_error, attempt, failed_idx)

        gate = await run_gates(phase, output, ctx, timing="post")
        if gate.passed:
            if validators:
                await write_audit(
                    pool, run_id, user_id=_audit_user_id,
                    event_type="gate_passed", metadata={"phase": phase.slug},
                )
            # Clear the retry feedback so a downstream phase isn't polluted.
            _clear_retry_feedback(ctx)
            return PhaseOutcome("completed", output, None, None)

        # ── gate failed ──────────────────────────────────────────────────────
        # WR-03: rebind the retry bound to the FAILING validator the first time we
        # learn its index (run_gates threads it back on GateResult), so the bound
        # and the route both come from the same validator.
        if gate.validator_index is not None and 0 <= gate.validator_index < len(validators):
            failed_idx = gate.validator_index
            phase_max_retries = validators[failed_idx].max_retries

        # Consecutive-identical short-circuit: re-running produced the SAME output,
        # so retrying cannot help — treat as exhausted (T-091-16, the SC#3 net).
        identical = output == last_output
        last_output = output

        await write_audit(
            pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
            metadata={"phase": phase.slug, "attempt": attempt, "error": gate.error_message},
        )
        await _emit(redis, stream_run_id, "gate_failed",
            phase=phase.slug, attempt=attempt, error=gate.error_message,
        )

        exhausted = identical or attempt >= phase_max_retries
        if not exhausted:
            attempt += 1
            # PRODUCER side: feed the validator error into the next attempt's prompt
            # (the Plan 03 executors append ctx.retry_feedback). D-08 visible.
            try:
                ctx.retry_feedback = (
                    f"Previous output failed validation: {gate.error_message}. Fix it."
                )
            except (AttributeError, TypeError):
                pass  # immutable stub ctx in some unit tests
            continue

        # Exhausted → on_failure routing (from the SAME failing validator, WR-03).
        # Routed through the async helper so an ``ask_user`` disposition (D-11) can
        # pause for a human choice: a Proceed returns ``completed`` carrying THIS
        # attempt's produced output; an Abort/unanswered → honest fail_run; a
        # fail_run/skip_to_phase disposition delegates to _route_on_failure
        # (byte-identical for every non-ask_user phase).
        _clear_retry_feedback(ctx)
        return await _resolve_failure_with_ask_user(
            phase, gate.error_message, attempt, failed_idx,
            run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
            produced_output=output, is_pre=False,
        )


def _route_on_failure(
    phase, error_message: str, attempt: int, failed_idx: int | None = None
) -> PhaseOutcome:
    """Map an exhausted/timed-out gate failure to a :class:`PhaseOutcome`.

    ``failed_idx`` (WR-03) is the index of the validator that failed — both the
    retry bound and this routing disposition derive from that same validator.
    """
    disposition = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    reason = (
        f"Phase {phase.phase_index + 1} ({phase.slug}) gate failed after "
        f"{attempt + 1} attempt(s): {error_message}"
    )
    if disposition.kind == "skip_to_phase":
        return PhaseOutcome("skip_to", None, disposition.target_slug, reason)
    # ``ask_user`` cannot be resolved here (this sync mapper cannot await the user) —
    # fail safe to fail_run. The engine routes ask_user through
    # ``_resolve_failure_with_ask_user`` (the async helper) BEFORE ever reaching here,
    # so this branch is only hit when the pause path is unreachable (no redis/ctx).
    return PhaseOutcome("fail_run", None, None, reason)


def _ask_user_choices_from_finding(error_message: str) -> list[str]:
    """Derive the ask_user choices from a validator's structured finding (D-11).

    The freshness validator (Plan 03) encodes its finding as a parseable
    ``error_message`` prefix:
      - ``freshness:staleness|...``         → ["Proceed anyway", "Abort"]
      - ``freshness:version_ambiguity|...`` → ["Proceed despite version ambiguity", "Abort"]
    Any other finding falls back to the generic Proceed/Abort pair. The choices are
    presented to the user; the engine maps the chosen text back to a continue/fail
    routing (an Abort-like choice → fail_run; anything else → Proceed).

    WR-08: the version-ambiguity branch presents the HONEST pair matching the
    staleness pair — NOT "Use newest version" / "Use as-is", which implied
    version-scoped retrieval that does not exist (both old non-abort choices routed
    identically to Proceed). Until version-scoped narrowing ships, the user explicitly
    approves continuing with UNFILTERED retrieval; the v1 cut is noted in the receipt.
    """
    msg = error_message or ""
    if msg.startswith("freshness:version_ambiguity|"):
        return ["Proceed despite version ambiguity", "Abort"]
    if msg.startswith("freshness:staleness|"):
        return ["Proceed anyway", "Abort"]
    return ["Proceed anyway", "Abort"]


def _is_abort_choice(choice: str) -> bool:
    """A chosen option that means 'do NOT proceed' → honest fail_run (D-11)."""
    return (choice or "").strip().lower() in ("abort", "cancel", "stop", "")


async def _resolve_failure_with_ask_user(
    phase,
    error_message: str,
    attempt: int,
    failed_idx: int | None,
    *,
    run_id: UUID,
    pool,
    redis,
    ctx,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
    produced_output: dict | None = None,
    is_pre: bool = False,
) -> PhaseOutcome | None:
    """Resolve a failing validator's disposition, pausing for a human choice when
    the disposition is ``ask_user`` (D-11).

    If the failing validator's ``on_failure`` is NOT ``ask_user``, delegate to the
    sync ``_route_on_failure`` (fail_run / skip_to_phase) — byte-identical behavior.

    When it IS ``ask_user``: pause via the 085 ask_user_service ordering
    (durable prompt row → emit ``ask_user_prompt`` → SUBSCRIBE-before-emit block on
    ``subscribe_for_response``), presenting the validator's structured finding as
    choices. The answer routes:
      - unanswered (subscribe returns None, the 085 expiry) → honest ``fail_run``.
      - an Abort-like choice                                → honest ``fail_run``.
      - a Proceed/use-version choice → write a ``validator_ask_user_approved`` receipt
        (someone explicitly approved grounding on the flagged finding — governance)
        and CONTINUE: for a PRE gate return ``None`` (signal 'run the body'); for a
        POST gate return ``completed`` carrying the already-produced output.

    The redis/pool ordering, the channel keying, and the expiry-honest-fail are the
    SAME shipped 085 substrate ``_exec_llm_human_input`` uses — never re-invented.
    """
    disp = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    if disp.kind != "ask_user":
        # fail_run / skip_to_phase — the sync mapper handles it byte-identical.
        return _route_on_failure(phase, error_message, attempt, failed_idx)

    # ── ask_user pause (copy _exec_llm_human_input ordering VERBATIM) ──
    # The pause needs a live redis transport + a run_id channel; without them the
    # disposition cannot pause (a unit/minimal ctx) → fail safe to fail_run, never
    # a hung run.
    if redis is None or run_id is None:
        return _route_on_failure(phase, error_message, attempt, failed_idx)

    from uuid import uuid4

    tool_call_id = uuid4().hex
    choices = _ask_user_choices_from_finding(error_message)
    prompt = (
        f"A validation check on phase '{phase.slug}' flagged: {error_message}. "
        "How should the run proceed?"
    )
    timeout_seconds = min(
        getattr(phase.config, "timeout_seconds", settings.ask_user_max_timeout_seconds)
        if getattr(phase, "config", None) is not None
        else settings.ask_user_max_timeout_seconds,
        settings.ask_user_max_timeout_seconds,
    )

    # 1. Durable prompt row (the resume matcher keys on run_id) — best-effort, the
    #    live block-on-answer flow does not depend on it (mirrors _exec_llm_human_input).
    supabase = getattr(ctx, "supabase", None)
    current_user = getattr(ctx, "current_user", None) or {}
    thread_id = getattr(ctx, "thread_id", None)
    if supabase is not None and thread_id:
        try:
            from app.utils.db import aexec

            await aexec(
                supabase.table("messages").insert(
                    {
                        "thread_id": thread_id,
                        "user_id": current_user.get("id"),
                        "role": "system",
                        "content": prompt,
                        # CTX-01 (T-120-04): harness disposition ask_user prompt — workflow row.
                        "origin": "harness",
                        "tool_calls": [
                            {
                                "kind": "ask_user_prompt",
                                "tool_call_id": tool_call_id,
                                "prompt": prompt,
                                "options": choices,
                                "timeout_seconds": timeout_seconds,
                                "run_id": str(run_id),
                            }
                        ],
                    }
                )
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user disposition: prompt row insert failed run=%s tcid=%s",
                run_id, tool_call_id,
            )

    # 2. Emit the ask_user prompt so the frontend renders the choice — on the
    #    PRODUCER stream the frontend tails (the direct-executor-emit transport
    #    pattern from _exec_llm_human_input), while the durable row + subscribe
    #    channel stay on the workflow run_id for live↔resume consistency.
    _stream_id = getattr(ctx, "producer_run_id", None) or stream_run_id or run_id
    emit = getattr(ctx, "emit", None) or _emit
    try:
        await emit(
            redis, _stream_id, "ask_user_prompt",
            tool_call_id=tool_call_id,
            prompt=prompt,
            options=choices,
            timeout_seconds=timeout_seconds,
        )
    except Exception:  # noqa: BLE001
        logger.exception("ask_user disposition: ask_user_prompt emit failed")

    # 3. Block on the answer (SUBSCRIBE-before-emit is enforced inside the helper;
    #    None on timeout — honest fail, never a hung run — the 085 expiry).
    from app.services.ask_user_service import subscribe_for_response

    payload = await subscribe_for_response(
        redis, run_id, tool_call_id, float(timeout_seconds)
    )

    reason_base = (
        f"Phase {phase.phase_index + 1} ({phase.slug}) validation flagged: {error_message}"
    )

    if payload is None:
        # Unanswered (the 085 expiry) → honest fail, never hung.
        return PhaseOutcome(
            "fail_run", None, None, f"{reason_base} — unanswered, run failed"
        )

    # Resolve the chosen option text (choice-click arrives as {choice_index: N};
    # same defense as _exec_llm_human_input / the Deep dispatcher handler).
    choice = ""
    if payload.get("kind") == "response":
        choice = (payload.get("response_text") or "").strip()
        if not choice and choices:
            _ci = payload.get("choice_index")
            try:
                _ci = int(_ci)
                if 0 <= _ci < len(choices):
                    choice = str(choices[_ci])
            except (TypeError, ValueError):
                pass

    if _is_abort_choice(choice):
        return PhaseOutcome(
            "fail_run", None, None, f"{reason_base} — aborted by user"
        )

    # Proceed — write the governance receipt, then continue.
    receipt_metadata = {
        "phase": phase.slug,
        "validator": failed_idx,
        "choice": choice,
        "finding": error_message,
    }
    # WR-08: note the v1 honest cut on a version-ambiguity approval — the user
    # approved continuing with UNFILTERED retrieval (version-scoped narrowing is
    # not yet implemented), so the receipt must not assert that semantic.
    if (error_message or "").startswith("freshness:version_ambiguity|"):
        receipt_metadata["version_ambiguity_v1_cut"] = (
            "honest Proceed/Abort — version-scoped retrieval not yet implemented; "
            "Proceed continues with unfiltered retrieval"
        )
    try:
        await write_audit(
            pool, run_id, user_id=_audit_user_id,
            event_type="validator_ask_user_approved",
            metadata=receipt_metadata,
        )
    except Exception:  # noqa: BLE001 — a receipt write must never strand the approved run
        logger.warning(
            "ask_user disposition: validator_ask_user_approved receipt write failed run=%s",
            run_id,
        )

    if is_pre:
        return None  # signal: run the body (the user approved running despite the finding)
    return PhaseOutcome("completed", produced_output, None, None)


def _clear_retry_feedback(ctx) -> None:
    """Clear ``ctx.retry_feedback`` so it never leaks into a later phase's prompt."""
    try:
        ctx.retry_feedback = None
    except (AttributeError, TypeError):
        pass


async def run_workflow(
    run_id: UUID,
    definition: WorkflowDefinition,
    ctx,
    *,
    pool,
    redis,
    stream_run_id: UUID | None = None,
) -> None:
    """Drive a run through its phases in ``phase_index`` order (HARNESS-01).

    The 2-phase write (mark active before work, complete only after durable
    output) is the resumability core (HARNESS-03). A phase that raises mid-work
    is left ``active`` — the exception propagates so a later sweep re-runs it; the
    engine never marks a crashed phase ``completed`` from the generic path.

    Validation gates (HARNESS-04) run per phase via ``_run_phase_with_gates``: the
    bounded-retry loop reaches ``failed`` in ≤ 3 attempts and NEVER loops (the SC#3
    bar). On exhaustion the ``on_failure`` routing either fails the run cleanly
    keeping completed phases' outputs with a plain reason (D-07), or jumps to a
    ``skip_to_phase`` target (D-09).
    """
    # Phase 092-05 F1: the run-owner id every harness_audit write must bind
    # (harness_audit.user_id is NOT NULL). Live runs set ctx.current_user from the
    # route; the resume path's _build_resume_context reads back the persisted
    # workflow_runs.user_id. A unit stub without current_user resolves to None.
    _audit_user_id = (
        (ctx.current_user or {}).get("id")
        if getattr(ctx, "current_user", None)
        else None
    )

    # Phase 101.1 (D-10 / GAP-B): the llm_emit executor resolves the bound library
    # template AssetRef SERVER-SIDE off the parsed definition (the model never selects
    # it). The executor receives only ``(phase, accumulated_outputs, ctx)`` — the
    # definition is NOT on the live/resume ctx bag (built in threads.py / the resume
    # builder, neither of which this plan may touch — G-5). Thread it here, the ONE
    # site where ``run_workflow`` holds both the parsed definition AND the ctx, so the
    # executor reads ``ctx.definition.assets`` / ``.version`` / ``.id`` via getattr.
    # Additive + defensive (mirrors ``_clear_retry_feedback``): Deep never reaches this
    # path (Deep does not run a workflow), so it stays byte-identical.
    try:
        ctx.definition = definition
    except (AttributeError, TypeError):
        pass

    # Facet B (092-07): every engine SSE event must reach the PRODUCER stream the
    # frontend watches (run:{producer_run_id}), NOT run:{workflow_run_id} (a stream
    # nobody subscribes to). The explicit ``stream_run_id`` (passed by the live
    # kickoff + both resume paths) wins; otherwise resolve it from
    # ``ctx.producer_run_id`` (live/resume safe once the producer row is minted),
    # falling back to ``run_id`` only for legacy unit stubs with no producer id.
    # write_audit / finish_run / load_run_phases / _load_run_definition STAY on the
    # workflow ``run_id`` (F1/F2 shape preserved).
    stream_run_id = stream_run_id or getattr(ctx, "producer_run_id", None) or run_id

    rows = await load_run_phases(pool, run_id)
    # Resumed runs see prior outputs: seed accumulated_outputs from completed rows.
    accumulated_outputs: dict[str, dict] = {}
    # F7 (092-07): on resume, the grounding gathered by phases that completed BEFORE
    # the restart lives only in their durable workflow_phases.output — re-fold it
    # into the run-level union (declared below) from those rows, so a resumed run's
    # final answer still SHOWS the sources earlier phases gathered. Forward-declared
    # here; the loop body folds LIVE-completed phases into the same lists.
    _resumed_grounding_rows = [
        r.get("output") or {} for r in rows if r.get("status") == "completed"
    ]
    for r in rows:
        if r.get("status") == "completed":
            accumulated_outputs[r["slug"]] = r.get("output") or {}

    # Map the parsed definition's PhaseSpec by slug so we dispatch on the typed
    # config while iterating the durable rows in phase_index order.
    spec_by_slug = {p.slug: p for p in definition.phases}
    ordered = sorted(rows, key=lambda r: r["phase_index"])
    index_by_slug = {row["slug"]: i for i, row in enumerate(ordered)}

    last_output: dict = {}
    # F7 (092-07): the run-level grounding union. Every phase's executor output may
    # carry source_refs/citations/similarity_scores (an llm_agent research phase
    # gathers them via search_documents; an llm_single summarize phase has none).
    # We UNION across ALL phases here so the FINAL phase's answer SHOWS the sources
    # the EARLIER phases gathered — the cross-phase nuance F7 turns on. Mirrors the
    # Deep agent-loop accumulators (agent_loop.py:1078-1081): extend/extend/append.
    run_source_refs: list[dict] = []
    run_citations: list[dict] = []
    run_similarity_scores: list[float] = []
    # F7: fold the grounding of phases completed before a restart (resume path).
    for _resumed_output in _resumed_grounding_rows:
        _accumulate_phase_grounding(
            _resumed_output, run_source_refs, run_citations, run_similarity_scores
        )
    # Index-driven loop (not a for-each) so skip_to_phase can jump the cursor (D-09).
    i = 0
    while i < len(ordered):
        row = ordered[i]
        status = row.get("status")
        if status in ("completed", "skipped"):
            # Idempotent resume — already done, don't re-run.
            if status == "completed":
                last_output = accumulated_outputs.get(row["slug"], {})
            i += 1
            continue

        phase = spec_by_slug[row["slug"]]
        phase_id = row["id"]
        wall_clock = (
            getattr(phase.config, "wall_clock_seconds", None) or _DEFAULT_PHASE_WALL_CLOCK
        )

        # 1. DURABLE active BEFORE any work (Pitfall 1).
        await mark_phase_active(pool, phase_id)
        # WRITE-before-EMIT.
        await write_audit(
            pool,
            run_id,
            user_id=_audit_user_id,
            event_type="phase_started",
            metadata={"phase": phase.slug, "phase_index": phase.phase_index},
        )
        await _emit(redis, stream_run_id,
            "phase_started",
            phase=phase.slug,
            phase_index=phase.phase_index,
            phase_type=phase.config.phase_type,
        )

        # 2. Execute under the bounded-retry gate loop (wall-clock cap + gates +
        #    on_failure routing live inside). The step cap is enforced INSIDE the
        #    executor (run_task_sub_agent max_steps, Plan 03) — both caps present.
        try:
            outcome = await _run_phase_with_gates(
                phase,
                accumulated_outputs,
                ctx,
                run_id=run_id,
                pool=pool,
                redis=redis,
                wall_clock=wall_clock,
                _audit_user_id=_audit_user_id,
                stream_run_id=stream_run_id,
            )
        except BaseException:
            # ── cancel/escape path (D-06 / BUG-260605-01) ─────────────────────
            # A user Stop cancels the producer task while the phase await blocks
            # (a paused ask_user lives exactly here); a crash escapes the same
            # way. Either escape reaches a terminal status OUTSIDE this engine —
            # the threads.py F2 backstop terminalizes workflow_runs after this
            # propagates — so resolve any outstanding prompt NOW or it strands
            # as a submittable-but-dead card. Shielded (cancellation is already
            # in flight) + best-effort: cleanup failure never masks the original
            # escape. The process-death case runs no code here by definition —
            # the startup sweep's re-emit contract (Plan 04) is untouched.
            #
            # 096-09 (UAT Test 2): on a GRACEFUL app shutdown we must NOT expire
            # the pending prompt — the run stays resumable and the boot-time sweep
            # re-emits the SAME prompt (resume_pending_prompt). Expiring it here
            # would make /pending serve nothing and force a fresh prompt on resume.
            # The flag gate is the ONLY behavior change; user-Stop / crash / timeout
            # (flag False) still expire exactly as before — byte-identical.
            if not is_app_shutting_down():
                try:
                    await asyncio.shield(
                        _expire_pending_ask_user(
                            pool, getattr(ctx, "thread_id", None), run_id
                        )
                    )
                except BaseException:  # noqa: BLE001 — second cancel mid-cleanup
                    logger.exception(
                        "ask_user expiry cleanup failed on cancel/escape for run %s",
                        run_id,
                    )
            raise

        # ── fail_run: keep completed phases' outputs, stop cleanly, plain reason ─
        if outcome.kind == "fail_run":
            await fail_phase(pool, phase_id, outcome.reason)
            # Completed phases' outputs are ALREADY durable — finish_run does NOT
            # touch them (D-07). The run flips to `failed`; nothing silently dropped.
            await finish_run(pool, run_id, "failed")
            await write_audit(
                pool, run_id, user_id=_audit_user_id,
                event_type="run_failed", metadata={"reason": outcome.reason},
            )
            await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
            # RC-4 (D-04): persist a real failure message BEFORE returning, so a
            # reconcile renders failed-with-reason — not a silent empty `done`.
            await _surface_failure_message(ctx, run_id, outcome.reason, pool)
            # D-06 (BUG-260605-01): the run is now durably terminal — resolve any
            # outstanding ask_user prompt so /pending never serves a dead one.
            try:
                await _expire_pending_ask_user(
                    pool, getattr(ctx, "thread_id", None), run_id
                )
            except Exception:  # noqa: BLE001 — cleanup never crashes a terminal
                logger.exception(
                    "ask_user expiry cleanup failed at fail_run site for run %s",
                    run_id,
                )
            return  # stop — no further phases

        # ── skip_to_phase: mark this phase skipped, jump the cursor (D-09) ──────
        if outcome.kind == "skip_to":
            await skip_phase(pool, phase_id)
            await write_audit(
                pool, run_id, user_id=_audit_user_id, event_type="phase_transition",
                metadata={"from": phase.slug, "to": outcome.target_slug, "via": "skip_to_phase"},
            )
            await _emit(redis, stream_run_id, "phase_transition",
                from_phase=phase.slug, to_phase=outcome.target_slug, via="skip_to_phase",
            )
            target_i = index_by_slug.get(outcome.target_slug)
            if target_i is None:
                # Runtime guard: lint catches dangling skips at publish, but a
                # target missing at runtime fails safe to fail_run (T-091-18).
                reason = (
                    f"skip_to_phase target {outcome.target_slug!r} does not exist "
                    f"at runtime (phase {phase.slug})"
                )
                await finish_run(pool, run_id, "failed")
                await write_audit(
                    pool, run_id, user_id=_audit_user_id,
                    event_type="run_failed", metadata={"reason": reason},
                )
                await _emit(redis, stream_run_id, "run_failed", reason=reason)
                # RC-4 (D-04): the SECOND failure-return site — the missing-skip-
                # target guard must persist its failure reason too, else a dangling
                # skip still renders as an empty `done` (Pitfall 7 / both sites).
                await _surface_failure_message(ctx, run_id, reason, pool)
                # D-06 (BUG-260605-01): second terminal site — same prompt expiry.
                try:
                    await _expire_pending_ask_user(
                        pool, getattr(ctx, "thread_id", None), run_id
                    )
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "ask_user expiry cleanup failed at missing-skip-target "
                        "site for run %s", run_id,
                    )
                return
            i = target_i
            continue

        # ── completed: persist output (2-phase write step 2), advance ──────────
        output = outcome.output
        durable_output = _persist_output(output)
        # Phase 101.1-07 (gap 1 — the "phase stuck active" half): a GRACEFUL emit
        # failure (an honest state a-e return from _exec_llm_emit, or the layer-6
        # catch-all) comes back as a NORMAL phase output carrying a ``failure`` key —
        # the run would otherwise "complete" and the active phase would never flip.
        # Flip THIS phase to ``failed`` (reusing the existing fail_phase write — no new
        # schema) so workflow_phases never strands in active/completed while the
        # deliverable was never produced. Additive + harness-only: a Deep success output
        # has no ``failure`` key, so this is a literal no-op on the shared path.
        _emit_failure = output.get("failure") if isinstance(output, dict) else None
        if _emit_failure:
            # 101.1 review WR-02: persist the FULL failure output (incl. the cited
            # field_map states b/c/d carry) on the phase row — fail_phase merges it
            # under _failure_reason, so the extracted data survives durably (D-08).
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
        else:
            await complete_phase(pool, phase_id, durable_output)
        accumulated_outputs[phase.slug] = output
        last_output = output
        # F7 (092-07): fold this phase's grounding into the run-level union.
        _accumulate_phase_grounding(
            output, run_source_refs, run_citations, run_similarity_scores
        )

        # 4. Advance current_phase + audit/emit the transition.
        next_phase_id = ordered[i + 1]["id"] if i + 1 < len(ordered) else None
        await advance_current_phase(pool, run_id, next_phase_id)
        if _emit_failure:
            # 101.1 review WR-01: NEVER record/emit ``phase_completed`` for a phase
            # just flipped to ``failed`` — the audit trail (Phase 107 / GOV-02 reads
            # harness_audit rows as receipts) and the live rail must reflect the
            # phase's TRUE terminal status. The audit row rides the EXISTING
            # ``phase_transition`` kind (the 069 CHECK constraint has no phase_failed
            # kind; the executor's emit_failed/emit_rejected receipts carry the full
            # failure detail). The SSE is a NEW additive ``phase_failed`` event the
            # frontend maps to a failed card — the finalize sweeps skip terminal
            # statuses, so the card is never repainted "done" over the failure alert.
            # Run-level semantics are EXPLICITLY preserved (decided, not silent): the
            # run continues to the next phase and terminalizes ``completed`` — the
            # honest failure message IS this phase's output, and the gap-4 terminal
            # workspace refetch (plan 09) keys off run_completed and must keep firing.
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_transition",
                metadata={
                    "phase": phase.slug,
                    "phase_index": phase.phase_index,
                    "via": "emit_failed",
                    "failure": str(_emit_failure),
                },
            )
            await _emit(redis, stream_run_id,
                "phase_failed",
                phase=phase.slug,
                phase_index=phase.phase_index,
                failure=str(_emit_failure),
            )
        else:
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_completed",
                metadata={"phase": phase.slug, "phase_index": phase.phase_index},
            )
            await _emit(redis, stream_run_id,
                "phase_completed",
                phase=phase.slug,
                phase_index=phase.phase_index,
            )
        if next_phase_id is not None:
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_transition",
                metadata={"from": phase.slug, "to": ordered[i + 1]["slug"]},
            )
            await _emit(redis, stream_run_id,
                "phase_transition",
                from_phase=phase.slug,
                to_phase=ordered[i + 1]["slug"],
            )
        i += 1

    # ── Completion (D-10 / D-11): final phase output IS the chat message ──────
    # No extra synthesis LLM call. Plan 03's executors return the chat-ready
    # payload; the existing message-insert path persists ctx.final_output.
    try:
        ctx.final_output = last_output
    except (AttributeError, TypeError):
        pass  # ctx may be an immutable stub in unit tests

    # F7 (092-07): expose the run-level grounding union for the persist+emit hand-off
    # (threads.py F6 branch). Dedupe + confidence are computed with the SAME helpers
    # the Deep path uses (lazy-imported to keep the harness-package import cycle
    # broken): _deduplicate_citations (by document_id+chunk_index, order-preserving)
    # and _compute_confidence (avg cosine → high/medium/low). source_refs prefers the
    # full deduped CITATION objects (Deep D-13: row["source_refs"] = unique_citations
    # when present, else unique_sources) so the references render with passages.
    _final_source_refs, _final_citations, _final_confidence = _finalize_run_grounding(
        run_source_refs, run_citations, run_similarity_scores
    )
    for _attr, _val in (
        ("final_source_refs", _final_source_refs),
        ("final_citations", _final_citations),
        ("final_confidence", _final_confidence),
    ):
        try:
            setattr(ctx, _attr, _val)
        except (AttributeError, TypeError):
            pass  # immutable stub ctx in some unit tests

    # Mirror _shielded_finalize ordering: durable run-status UPDATE BEFORE the
    # terminal _emit.
    await finish_run(pool, run_id, "completed")
    await write_audit(
        pool, run_id, user_id=_audit_user_id,
        event_type="run_completed", metadata={"run_id": str(run_id)},
    )
    # D-11: surface the answer (delta + grounding emit + persist) on the success
    # terminal — THE single surfacing site + single persist owner for live + resume
    # + Continue (Pitfall 5 / Landmine 5). Emits on the PRODUCER stream BEFORE the
    # terminal `run_completed` below (mirrors _shielded_finalize: durable UPDATE
    # first, then surfacing, then terminal sentinel). The live-kickoff branch in
    # threads.py no longer surfaces inline (removed in the same change) — no
    # double-persist / duplicate assistant message.
    await _surface_final_answer(ctx, run_id, stream_run_id, redis, pool)
    await _emit(redis, stream_run_id, "run_completed", status="completed")


# ── HARNESS-03 startup sweep (Plan 04) ────────────────────────────────────────
async def _load_run_definition(pool, run_id: UUID) -> WorkflowDefinition | None:
    """Parse a run's published :class:`WorkflowDefinition` from the DB.

    Joins ``workflow_runs.definition_id`` → ``workflow_definitions.definition``
    (the FULL WorkflowDefinition jsonb, migration 056:23) and parses it. Returns
    ``None`` if the run or its definition is gone (a defensively-handled edge —
    the sweep skips it rather than crashing startup).
    """
    row = await pool.fetchrow(
        """
        SELECT wd.definition, wd.skill_snapshots
        FROM workflow_runs wr
        JOIN workflow_definitions wd ON wd.id = wr.definition_id
        WHERE wr.id = $1
        """,
        run_id,
    )
    if row is None or not row.get("definition"):
        return None
    definition = row["definition"]
    if isinstance(definition, str):
        definition = json.loads(definition)
    parsed = WorkflowDefinition.model_validate(definition)
    # 099-07: the materialized snapshots live in the skill_snapshots SIBLING column
    # (not the locked definition JSONB) → graft them back so a resumed / index-driven
    # run reads the immutable snapshot. May arrive as a str via the asyncpg default
    # codec (mirror the definition parse). LOCAL import — harness_engine does not
    # import skill_snapshot at module top (avoid any cycle).
    _snaps = row.get("skill_snapshots")
    if isinstance(_snaps, str):
        _snaps = json.loads(_snaps)
    if _snaps:
        from app.services.harness.skill_snapshot import graft_skill_snapshots
        parsed = graft_skill_snapshots(parsed, _snaps)
    return parsed


async def _build_resume_context(run, redis, pool):
    """Build the minimal run-identity ctx bag the engine threads through on resume.

    Mirrors the live producer ctx surface (run_id / thread_id / redis / pool /
    user / emit) so ``run_workflow`` and the phase executors find their substrate.
    The executors read this bag via ``getattr`` with safe defaults (Plan 03), so a
    minimal bag is sufficient for the index-driven loop; richer per-run fields
    (folder scope, user_settings) are absent on resume and default to None — the
    re-run reads its inputs from the durable accumulated phase outputs.

    Facet C (092-07): the original producer ``runs`` row was finalized at the
    crash and its ``run:{id}`` stream EXPIREd; no producer-id column persists, so
    we MINT a fresh producer-shell ``runs`` row here (status='streaming',
    parent_run_id=None, NON-NULL placeholder model/provider — the shell never makes
    an LLM call) and set ``producer_run_id`` to it. The resumed sub-agents'
    ``parent_run_id`` FK now resolves (Facet A) and resumed events route to
    ``run:{producer_run_id}`` (Facet B). ``ctx.run_id`` stays the workflow_run id
    (audit/terminal/definition/resume-match). The caller (``resume_stranded_workflows``)
    MUST terminalize this shell on every exit path (no stranded streaming row → the
    F2 self-heal is never defeated).
    """
    from types import SimpleNamespace
    from uuid import uuid4
    from app.db.runs import insert_run

    _producer_id = uuid4()
    _thread_id = run["thread_id"]
    _user_id = run.get("user_id")
    await insert_run(
        pool,
        run_id=_producer_id,
        thread_id=_thread_id if isinstance(_thread_id, UUID) else UUID(str(_thread_id)),
        user_id=_user_id if isinstance(_user_id, UUID) else UUID(str(_user_id)),
        status="streaming",
        # model/provider are NOT NULL (db/runs.py); the shell is never used for an
        # LLM call so the placeholder cannot misroute any provider's sub-agent.
        model="unknown", provider="unknown",
        parent_run_id=None,
    )

    # F5 (092-07): the startup sweep has NO request, so there is no request-scoped
    # supabase to thread. Source the SERVICE-ROLE client from the existing
    # dependencies factory (get_supabase — a module-level singleton building
    # create_client(SUPABASE_URL, SERVICE_ROLE_KEY); dependencies.py:16-20). Without
    # ctx.supabase a resumed phase's search_documents hits ctx.supabase.rpc → None
    # AttributeError (the exact F5 crash). THREAT: the service-role client bypasses
    # RLS, so retrieval MUST stay owner-scoped — search_documents filters by
    # current_user["id"], which we set below from run["user_id"] (the durable
    # run-owner), so a resumed search can never read another user's documents.
    from app.dependencies import get_supabase
    _service_supabase = get_supabase()

    # F8 (092-07) + 152 WFIN-02 (Pitfall 5): parse the durable workflow_runs.inputs jsonb
    # ONCE up front so both the folder-override scope resolution below AND the F8
    # kickoff_prompt rehydration read the same dict. jsonb arrives as a str under
    # asyncpg's default codec (mirror _load_run_definition).
    _resume_inputs = run.get("inputs") or {}
    if isinstance(_resume_inputs, str):
        try:
            _resume_inputs = json.loads(_resume_inputs)
        except (ValueError, TypeError):
            _resume_inputs = {}
    if not isinstance(_resume_inputs, dict):
        _resume_inputs = {}

    # 098 (GOV-01 / PROJ-02 — site 2 resume): source the run-start retrieval scope
    # from the run's PROJECT binding so a bound workflow stays inside its project
    # across a restart. Closes the folder_subtree_ids=None whole-KB bypass below
    # (the GOV-01 resume gap RESEARCH §2 / Pitfall 3 found). Owner-scoped via the
    # durable run owner (str(_user_id)): this path uses the SERVICE-ROLE client
    # (RLS bypassed), so the resolver's user_id is the only guard keeping retrieval
    # owner-scoped — same posture as the search owner-scope note above. An UNBOUND
    # definition (project_folder_id None) resolves to None → whole-KB unchanged.
    # Best-effort: a resolution failure must NEVER strand the resume sweep (fall back
    # to None + log, matching the owner-settings posture below).
    _resume_folder_subtree_ids: list[str] | None = None
    # WR-03 (098 secure-phase): hoisted so the except below can tell a BOUND
    # workflow (scope genuinely lost → emit) from an unbound one / a pre-load
    # failure (nothing to signal) without risking a NameError.
    _resume_project_folder_id = None
    if _user_id is not None:
        try:
            # LAZY import (the established harness-package pattern, :104-109): a
            # top-level import of anything under app.services.harness runs that
            # package's __init__ → phase_types.register_all() → imports back from THIS
            # module before PHASE_TYPE_REGISTRY is bound (circular import). At call
            # time the package is fully loaded, so the lazy import is cycle-safe — and
            # the governance test patches app.services.harness.scope.* (the source
            # module) so the fake is still picked up here.
            from app.services.harness.scope import (  # noqa: PLC0415
                assert_folder_scopes_subset,
                resolve_project_subtree,
                resolve_run_scope_root,
            )
            _resume_definition = await _load_run_definition(pool, run["run_id"])
            # getattr (not attribute access) defends the sentinel definitions some
            # tests inject via a stubbed _load_run_definition; a real WorkflowDefinition
            # always has the field. An unbound workflow (None) skips → whole-KB.
            _resume_project_folder_id = getattr(
                _resume_definition, "project_folder_id", None
            )
            if _resume_project_folder_id is not None:
                # D-07 (DB half): re-assert every per-phase folder_scope ⊆ the project
                # subtree. It was validated at definition-save, so this normally passes;
                # a raise here is caught below (unscoped fallback) rather than stranding
                # the sweep — distinct from the kickoff site, which 400s loudly.
                await assert_folder_scopes_subset(
                    _resume_definition,
                    supabase=_service_supabase,
                    user_id=str(_user_id),
                )
            # 152 WFIN-02 (Pitfall 5): layer the durable per-run folder override from
            # workflow_runs.inputs so a RESUMED run stays on the operator's chosen folder
            # instead of silently reverting to the author default. The helper owner-
            # re-validates the override against the durable owner's visible folders (a
            # since-deleted folder degrades safely to the author default → whole-KB).
            _resume_scope_root = await resolve_run_scope_root(
                _resume_definition,
                run_inputs=_resume_inputs,
                thread_folder_id=None,
                supabase=_service_supabase,
                user_id=str(_user_id),
            )
            if _resume_scope_root is not None:
                _resume_folder_subtree_ids = await resolve_project_subtree(
                    _resume_scope_root,
                    supabase=_service_supabase,
                    user_id=str(_user_id),
                )
        except Exception:  # noqa: BLE001
            logger.exception(
                "resume: project-scope resolution failed for run %s "
                "(falling back to unscoped search)", run.get("run_id"),
            )
            _resume_folder_subtree_ids = None
            # WR-03 (098 secure-phase): only a BOUND workflow losing its scope is a
            # governance degradation worth signaling (unbound resolves to None by
            # design; a pre-load failure leaves _resume_project_folder_id None). EMIT
            # scope_resolution_failed so the silent fall-open to whole-KB is OBSERVABLE
            # in the run timeline — the Plan-05 clip + scope_violation are gated on
            # `folder_subtree_ids is not None` and never fire on this None fallback.
            # Resume is an in-flight re-drive (startup sweep) → stays fail-OPEN (never
            # strand the sweep); the emit is the security signal, not a block.
            if _resume_project_folder_id is not None:
                try:
                    await _emit(
                        redis,
                        run["run_id"],
                        "scope_resolution_failed",
                        site="resume",
                        bound=True,
                        detail=(
                            "project-scope resolution failed; "
                            "retrieval degraded to whole-KB"
                        ),
                    )
                except Exception:  # noqa: BLE001 — emit is best-effort
                    logger.debug(
                        "resume: scope_resolution_failed emit failed for run %s",
                        run.get("run_id"),
                    )

    # F8 (092-07): _resume_inputs (parsed up front above) carries the durable
    # kickoff_prompt so a resumed first phase still acts on the user's question instead
    # of an empty user turn — rehydrated onto ctx.inputs in the return below.

    # D-04 (site 2): thread the resolved ctx model onto the resumed wf_ctx so a
    # resumed run resolves a non-stale model from the active provider (closes part
    # of SEED-047). Per Open Q2's recommendation, load the run OWNER's effective
    # settings from the durable run["user_id"] (the same verified owner the
    # service-role retrieval is scoped to above) and resolve via the
    # resolve-never-mutate wrapper (D-05) — a stale cross-provider llm_model falls
    # back to the active provider's default rather than leaking to the wrong client.
    # load_user_settings is a cheap in-memory cache read (models/user_settings.py:527
    # → load_app_settings reads the _settings_cache, no blocking DB I/O), so it is
    # safe on the startup sweep that runs for every stranded run. Phase-level
    # precedence is unchanged downstream: phase.config.model or ctx.model. If loading
    # fails for any reason, fall back to None settings + "" model (the resolver
    # returns "" for None) so phase.config.model still applies — never block resume.
    from app.models.user_settings import load_user_settings
    from app.services.sub_agent_models import resolve_workflow_ctx_model

    _owner_settings = None
    if run.get("user_id") is not None:
        try:
            _owner_settings = load_user_settings(str(run["user_id"]))
        except Exception:  # noqa: BLE001
            logger.exception(
                "resume: owner effective-settings load failed for run %s "
                "(falling back to phase-level model only)", run.get("run_id"),
            )
            _owner_settings = None
    _ctx_model = resolve_workflow_ctx_model(_owner_settings)

    return SimpleNamespace(
        run_id=run["run_id"],
        producer_run_id=_producer_id,
        thread_id=str(run["thread_id"]),
        # D-04 (site 2): the run owner's effective settings + the resolved ctx model
        # (resolve-never-mutate, D-05) so resumed phases route to the active provider's
        # model instead of an empty/stale one. Previously user_settings=None → model
        # absent → only phase.config.model applied.
        user_settings=_owner_settings,
        model=_ctx_model,
        # F8 (092-07): the persisted inputs (kickoff_prompt) for the resumed run.
        inputs=_resume_inputs,
        # 092-07: coerce to str, mirroring str(run["thread_id"]) above. On the
        # resume path run["user_id"] is an asyncpg pgproto.UUID OBJECT (not a
        # str like the live auth dict). task_service.insert_run does
        # UUID(parent_ctx.current_user["id"]) — UUID(<UUID object>) raises
        # AttributeError ('UUID' has no 'replace'). Match the live contract
        # (current_user["id"] is a str). user_id None → resume can't proceed.
        current_user={
            "id": str(run["user_id"]) if run.get("user_id") is not None else None
        },
        redis=redis,
        pool=pool,
        emit=_emit,
        retry_feedback=None,
        # F5 (092-07): the tool-context substrate every Supabase tool reads via
        # ctx.<field>. supabase = the service-role client (owner-scoped retrieval
        # enforced above). 098 (GOV-01): folder scope is now resolved from the run's
        # project binding (resolved above) — a bound workflow stays inside its project
        # across the restart instead of falling back to whole-KB. An unbound workflow
        # resolves to None (unscoped, unchanged). spawn = the module-level asyncio task
        # spawner so a resumed sub-agent's task() can fan out; per_run_task_semaphore =
        # a fresh per-run gate for this resumed run.
        supabase=_service_supabase,
        folder_subtree_ids=_resume_folder_subtree_ids,
        scoped_folder_path=None,
        spawn=_resume_spawn,
        per_run_task_semaphore=asyncio.Semaphore(settings.task_per_run_concurrency),
    )


def _resume_spawn(coro) -> asyncio.Task:
    """Fire-and-forget task spawner for resumed workflows (F5, 092-07).

    Mirrors threads.py:_spawn — a resumed sub-agent's task() tool needs the same
    spawn surface the live producer's RunContext carries. The startup sweep has no
    request-scoped _spawn, so the engine provides this minimal create_task wrapper.
    """
    return asyncio.create_task(coro)


async def _resume_run(run_id: UUID, definition: WorkflowDefinition, ctx, *, pool, redis) -> None:
    """Re-drive a claimed stranded run through the engine (rides run_workflow).

    ``run_workflow`` skips ``completed``/``skipped`` phases and re-runs the ``active``
    one from the top (Plan 02 idempotent load) — an active phase's output was never
    durable, so re-running is the correct resume point with no double side-effect
    (an llm_agent re-run forks a fresh sub_run_id; the old partial is orphaned
    harmlessly — Pitfall 5). The completion/failure path inside run_workflow already
    mirrors ``_shielded_finalize`` (durable terminal status BEFORE the terminal emit).
    """
    await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)


async def resume_stranded_workflows(*, pool, redis) -> int:
    """Startup sweep: re-run runs left ``active`` by a restart (HARNESS-03).

    For each stranded run (``find_resumable_runs`` — anchored on the per-thread
    ``threads.active_workflow_run_id``, with a ``status='active'`` workflow_phases
    row):

      1. ``claim_run`` (CAS) — only ONE worker resumes each run (Pitfall 7); with
         WORKER_COUNT=2 the loser skips. Idempotent + atomic.
      2. Inspect the active phase. If it is an ``llm_human_input`` phase mid-ask:
           - ANSWERED (``ask_user_response_exists`` True): the answer is durable →
             do NOT re-ask; let ``run_workflow`` re-run the phase, which re-reads
             the durable answer and proceeds.
           - PENDING (False): ``resume_pending_prompt`` re-SUBSCRIBES + re-SADDs +
             re-EMITs the SAME prompt (subscribe-before-emit, Pitfall 2) and blocks
             on the answer BEFORE handing back to the loop.
      3. Re-drive via ``_resume_run`` → ``run_workflow``, riding the same engine
         machinery a fresh run uses (single producer per run).

    Returns the count of runs this worker resumed (for the lifespan log). Never
    re-runs a run it did not claim (the OQ6 anti-pattern: no unclaimed re-run loop).
    """
    resumed = 0
    runs = await find_resumable_runs(pool)
    for run in runs:
        run_id = run["run_id"]
        # 1. CAS claim — single-producer-per-run (Pitfall 7). Loser skips.
        #    The lease (claimed_at) is the real CAS (CR-01): the winner stamps it,
        #    a racing sibling sees the fresh stamp → 0 rows → skips. A crash
        #    mid-resume becomes re-claimable once harness_resume_lease_seconds expires.
        if not await claim_run(pool, run_id, settings.harness_resume_lease_seconds):
            continue

        # 2. ask_user resume branch: answered → proceed; pending → re-emit + block.
        active = await get_active_phase(pool, run_id)
        if active is not None and _is_llm_human_input(active):
            tool_call_id = _active_tool_call_id(active)
            if tool_call_id is not None:
                answered = await ask_user_response_exists(pool, run_id, tool_call_id)
                if not answered:
                    pending = await get_pending_ask_user(pool, run_id)
                    if pending is not None and pending.get("tool_call_id"):
                        await resume_pending_prompt(
                            redis,
                            run_id,
                            pending["tool_call_id"],
                            pending.get("prompt") or "",
                            pending.get("options") or [],
                            pending.get("timeout_seconds")
                            or settings.ask_user_max_timeout_seconds,
                        )
                # answered → fall through; run_workflow re-reads the durable answer.

        # 3. Load the definition + ctx and re-drive (rides run_workflow).
        definition = await _load_run_definition(pool, run_id)
        if definition is None:
            # WR-02 (096 review): a gone/unloadable definition must not abort
            # the WHOLE sweep — _resume_run(run_id, None, ...) would raise
            # AttributeError and the loop's re-raise strands every remaining
            # run until the next restart. Skip THIS run only (honoring the
            # _load_run_definition docstring promise); it re-becomes claimable
            # after harness_resume_lease_seconds expires.
            logger.warning(
                "resume sweep: run %s has no loadable definition — skipping "
                "(re-claimable after lease expiry)", run_id,
            )
            continue
        ctx = await _build_resume_context(run, redis, pool)
        # Facet C (092-07): MANDATORY resume finalizer — terminalize the
        # producer-shell minted in _build_resume_context on EVERY exit path
        # (success/exception/cancel), mirroring the F2 terminalize at
        # threads.py. Without it a crashed/cancelled resume strands a
        # status='streaming' row that becomes the thread's latest runs row, so the
        # reconcile F2 self-heal (ORDER BY started_at DESC LIMIT 1) reads
        # 'streaming' → lock_is_stale=False → re-wedges the thread (the exact class
        # F2 closed). The point is TERMINAL (not the exact status).
        _redrive_failed = False
        try:
            await _resume_run(run_id, definition, ctx, pool=pool, redis=redis)
        except Exception:
            _redrive_failed = True
            raise
        finally:
            _pid = getattr(ctx, "producer_run_id", None)
            if _pid is not None:
                try:
                    from app.db.runs import finalize_run
                    await finalize_run(
                        pool,
                        run_id=_pid,
                        status="failed" if _redrive_failed else "completed",
                        error="resume re-drive failed" if _redrive_failed else None,
                        completed_at=datetime.now(timezone.utc),
                        message_id=None,
                        input_tokens=None,
                        output_tokens=None,
                    )
                except Exception:
                    logger.exception(
                        "resume producer-shell finalize failed for %s", _pid
                    )
            # D-06 (BUG-260605-01): EVERY resume exit path resolves outstanding
            # prompts AFTER the shell finalize. Success: the engine's own
            # terminal sites usually already expired (NOT EXISTS makes this a
            # no-op) — except the timed-out-prompt-then-completed edge, closed
            # here. Failed redrive: the old prompt's subscription is dead; the
            # next sweep's re-run re-asks with a fresh prompt row, so expiring
            # the stale one keeps /pending honest in the interim.
            try:
                await _expire_pending_ask_user(
                    pool, run.get("thread_id"), run_id
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "ask_user expiry cleanup failed in resume finalizer for "
                    "run %s", run_id,
                )
        resumed += 1

    return resumed


def _is_llm_human_input(active_phase: dict) -> bool:
    """True if the active phase row is an ``llm_human_input`` phase.

    The row may carry a ``config`` dict (phase_type) or expose the type via its
    stored output; we check the config phase_type first, then fall back to the
    presence of a stored ``tool_call_id`` in the output (the llm_human_input
    executor stores it — Plan 03).
    """
    config = active_phase.get("config")
    if isinstance(config, dict) and config.get("phase_type") == "llm_human_input":
        return True
    output = active_phase.get("output")
    if isinstance(output, dict) and "tool_call_id" in output:
        return True
    return False


def _active_tool_call_id(active_phase: dict) -> str | None:
    """The ask_user ``tool_call_id`` stored by the llm_human_input executor (Plan 03)."""
    output = active_phase.get("output")
    if isinstance(output, dict):
        return output.get("tool_call_id")
    return None


__all__ = [
    "run_workflow",
    "PHASE_TYPE_REGISTRY",
    "PhaseTypeNotRegistered",
    "resume_stranded_workflows",
]
