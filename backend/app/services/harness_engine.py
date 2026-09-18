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
    cancel_phase,
    claim_run,
    complete_phase,
    fail_phase,
    find_resumable_runs,
    finish_run,
    get_active_phase,
    get_latest_completed_workflow_run,
    get_pending_ask_user,
    load_run_phases,
    mark_phase_active,
    pause_run,
    record_phase_not_sent,
    skip_phase,
    write_audit,
)
from app.models.harness import WorkflowDefinition
# 200 (D-07) — the ONE home for the `_measure` read side, shared with the two wire
# models for these same rows. The SSE frame and the two fetches must agree.
from app.models.thread import declared_phase_measure
from app.services.ask_user_service import resume_pending_prompt
# Phase 204 (L-01 / D-204-02) -- the cross-worker cancellation brake. The two names
# come from ``run_lifecycle``, which is the cancel OWNER; this module gains a CALL,
# never a second home for the mechanism (G-5: no second concern lands here).
from app.services.run_lifecycle import cancellation_watch, is_run_cancelled
# Phase 204 (SCHED-02 / D-204-06) -- the spend-cap + wall-clock breaker. Same discipline
# as the line above: this module gains CALLS, never a second home for the mechanism. The
# breaker owns its own arithmetic, its own trip record and its own composition of the
# cancel path, so nothing about enforcement is re-derived here.
from app.services.circuit_breaker import CircuitBreaker, CircuitBreakerTrippedError

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


def _iso(value) -> str | None:
    """Render a DB timestamp for the wire, or ``None`` when there is nothing to say.

    Phase 200 / D-05. The five terminal writers and ``mark_phase_active`` return what
    Postgres stored; a row that did not move returns ``None`` and this yields ``None``, so
    the frame announces no time rather than a fabricated one.

    ⚠ Tolerant of a non-datetime by design. These values come back through a pool that is
    a RECORDING MOCK in most of this repo's engine tests, where the fake's ``fetchval``
    returns whatever a test injected. A frame is not the place to raise over that, and a
    ``str()`` of some unrelated object would be worse than silence — so anything that is
    not a datetime degrades to ``None``.
    """
    from datetime import datetime as _dt

    return value.isoformat() if isinstance(value, _dt) else None


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


async def _expire_pending_ask_user(pool, thread_id, run_id, *, org_id=None) -> None:
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

    Phase 163 (D-05 / D-14): this runs on the raw service-role (BYPASSRLS) pool with
    no auth.uid(). When the caller has org context (``org_id`` — the resume finalizer
    threads it from the run's org), an ``AND m.org_id = $3`` predicate is added to the
    SELECT as belt-and-suspenders org-scoping. ``org_id=None`` keeps the read
    byte-identical (thread_id + the prompt's run_id already uniquely scope the row).
    The INSERT omits org_id → the mig-106 autofill-from-parent-thread trigger stamps it.
    """
    if thread_id is None:
        return
    _tid = thread_id if isinstance(thread_id, UUID) else UUID(str(thread_id))
    if org_id is not None:
        rows = await pool.fetch(
            """
            SELECT m.tool_calls->0->>'tool_call_id' AS tool_call_id, m.user_id
            FROM messages m
            WHERE m.thread_id = $1
              AND m.org_id = $3
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
            org_id if isinstance(org_id, UUID) else UUID(str(org_id)),
        )
    else:
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
#   kind == "pause_run"  → NEW (Phase 200 / D-10). A human gate elapsed with no answer:
#                          the phase stays `active`, the run reads `paused`, the durable
#                          prompt is NOT expired and `finish_run` is NOT called — so the
#                          run stays resumable by BOTH the boot sweep and the
#                          answer-triggered re-drive. Stop and return; nothing terminal.
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
    total_phases: int | None = None,
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

    ARMED ACTION-RISK CHECKPOINT (D-187-01). An ``action_risk_armed`` phase gets an
    explicit pre-body checkpoint below — see the block between the pre-gate pass and the
    retry loop. ``total_phases`` exists solely to compose its sentence
    (``grounding._approval_sentence`` needs ``len(definition.phases)``); it is optional
    so the many direct unit callers stay valid, and the ONE production call site in
    ``run_workflow`` always passes the real total.

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
        # Every gate reachable here is an AUTHOR's gate. After D-187-01's hoist the
        # armed action-risk checkpoint is not a member of ``phase.validators`` at all,
        # so there is no armed finding to special-case and this is the plain
        # ``gate_failed`` announce for every pre gate.
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

    # ── D-187-01 — THE ARMED ACTION-RISK CHECKPOINT (SC#6 / SEED-137) ────────────
    # "Armed ⇒ the person is asked before the body runs" is a PROPERTY OF THE PHASE,
    # not a position in a list. Phase 185 shipped the guarantee as a synthesized
    # ``timing="pre"`` ValidatorSpec appended to ``phase.validators``; because
    # ``run_gates`` is first-failure-wins (``validators.py:248``) and the append put the
    # armed spec LAST, any author-declared failing pre gate returned first and an
    # ``ask_user`` Proceed fell straight through to the body with nobody asked. No
    # ordering rule fixes that — the gate simply must not live in the author's list.
    #
    # PLACEMENT, both halves deliberate:
    #   D-187-02 — AFTER the pre-gate pass, so a step an author's gate ``fail_run``s or
    #     ``skip_to_phase``s away is never approved. An approval receipt for a step with
    #     no body would violate the ledger's consequence ≠ receipt rule. Accepted cost:
    #     an author ``ask_user`` Proceed followed by this checkpoint is two prompts in a
    #     row. That is honest, not a defect.
    #   D-187-17 — BEFORE the ``while True:`` retry loop, so one phase execution asks a
    #     person exactly ONCE. Inside the loop, a 3-retry phase would ask three times for
    #     one step.
    #
    # THERE ARE EXACTLY TWO PHASE-LEVEL ARMED READINGS, and they are deliberately
    # INDEPENDENT: this one (run time, decides whether to pause) and
    # ``_is_armed_action_risk`` (:2148 — boot-time resume sweep, decides whether a
    # mid-flight row is re-driven or re-subscribed), which
    # ``test_the_two_resume_predicates_are_independent`` pins. What D-187-03 actually
    # deletes is the THIRD reading — the string-prefix sniff over a failing gate's error
    # message. The engine no longer infers arming from a finding it parsed; it reads the
    # boolean the author set.
    #
    # ── D-19 (Phase 189, CONFLICT 1) — THE GOLDEN-RUN BRANCH ─────────────────────
    # THE MEASURED CHAIN THIS FIXES. ``publish_service._interactive_phase_failures``
    # blocks a publish PRE-RUN for exactly two shapes — an ``llm_human_input`` phase and
    # a validator whose ``on_failure == "ask_user"``. The armed checkpoint is NEITHER,
    # because D-187-01 hoisted it OUT of ``phase.validators`` and the boolean is read
    # right here instead. So an armed phase sails past stage 2.5 into the stage-3 REAL
    # golden run, reaches this checkpoint, and subscribes to the ask channel with
    # ``timeout_seconds = None`` — which ``ask_user_service.subscribe_for_response``'s
    # own docstring calls "wait indefinitely". Nobody watches a synchronous publish's
    # ask channel, so the request burned the whole ``harness_publish_max_seconds``
    # budget (7200 s) and died at ``blocked_stage="golden_run_timeout"``. That made D-06
    # ("a workflow containing the external-action node PUBLISHES and RUNS") FALSE, and
    # it is a PRE-EXISTING defect: it reproduces on ANY armed phase of a SHIPPED type.
    #
    # THE RESOLUTION — AUTO-RECORD-AND-CONTINUE. On a golden run the PAUSE is skipped;
    # the RECORD is not. Nothing below runs: no approval sentence is composed, no
    # ``action_risk_pending`` row or event is written, no ask-channel subscribe is
    # awaited. Execution falls straight through to the retry loop so THE STEP STILL
    # RUNS and records what it would have done. "Skip the pause" must never become
    # "skip the step" — a silently-skipped governed step is the fail-open shape Phase
    # 188 spent two plans closing, and it would make the arming decorative.
    #
    # A LIVE RUN IS BYTE-IDENTICAL. ``ctx.is_golden_run`` is set at exactly one site
    # (``publish_service._drive_golden_run``'s ctx literal); every other ctx builder is
    # untouched and the ``getattr`` default below IS the live-run answer. The indefinite
    # wait, the shutdown-sentinel ``CancelledError`` and the unparseable-payload refusal
    # all stay exactly as shipped — the armed path is already fail-closed on a live run
    # and that is precisely what must be preserved.
    #
    # TWO SHAPES WERE REJECTED, each for a recorded reason, and neither is used here:
    #   (B) naming armed phases in ``publish_service._interactive_phase_failures`` so the
    #       gauntlet blocks pre-run — that makes an ``external_action`` workflow
    #       UNPUBLISHABLE and contradicts D-06 outright. ``_interactive_phase_failures``
    #       is untouched by 189 and ``test_the_armed_checkpoint_is_not_a_validator``
    #       fences it.
    #   (C) publishing a synthetic approval onto the ask channel — it writes a
    #       ``validator_ask_user_approved`` receipt claiming a human approved when none
    #       did, violating the Control-Room ``consequence ≠ receipt`` rule. Which is why
    #       this branch writes NO approval receipt AND no ``action_risk_pending`` row:
    #       nothing paused, so the ledger must not say something did.
    #
    # ARMING ITSELF IS NOT TOUCHED. ``phase.action_risk_armed`` is neither cleared in
    # memory nor in storage — only the pause is skipped. D-04 ("structurally armed, not
    # disarmable") stands, and so does the boot-time resume predicate
    # ``_is_armed_action_risk`` (:2240), which stays deliberately INDEPENDENT of this
    # run-time reader — ``test_the_two_resume_predicates_are_independent`` pins that.
    # ⚠⚠ REVIEW FINDING WR-06 — READ THIS BEFORE PHASE 190 MAKES A CAPABILITY REAL. ⚠⚠
    #
    # "The pause is skipped, the step still runs" is stated above as a virtue, and for the
    # five LLM types it is one. For ``external_action`` it is the sentence that turns into a
    # defect the moment egress exists, and the difference is that the arming on that type is
    # NOT an author preference: ``PhaseSpec._external_action_is_always_armed`` pins it
    # structurally, and it is the single guarantee D-04 exists to make. The branch below
    # bypasses it UNCONDITIONALLY, with no phase-type carve-out — so once Phase 190 wires a
    # real send, PUBLISHING a workflow would PERFORM THE EXTERNAL ACTION, with nobody asked,
    # once per publish attempt. The publish gauntlet validates STRUCTURE; it must not
    # acquire side effects in the world.
    #
    # WHY 189 DOES NOT SKIP THE BODY HERE, which is what the review proposed. The step
    # currently sends nothing, so the risk is INERT — and the proposed carve-out (return a
    # synthesized ``PhaseOutcome`` instead of executing) would have to FABRICATE the
    # recorded body to keep ``test_publish_service.py``'s shipped assertions true (that the
    # golden run's phase reaches ``recorded_not_sent`` with the real ``recorded_intent`` and
    # a body reading "NOT SENT"). That means a SECOND composer for the one sentence
    # ``_external_action_body`` owns — two vocabularies for one state, on the surface whose
    # entire discipline is that there is one. Trading an inert risk for a live duplication
    # is the wrong trade, and it would make the golden run stop exercising the real executor,
    # which is the thing D-06 is supposed to prove works.
    #
    # WHAT 189 DOES INSTEAD, so this is a GUARDED decision and not a remembered one:
    # ``test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress``
    # drives a REAL golden run with the widened no-egress transport sentinel armed (httpx +
    # smtplib + urllib + raw sockets — WR-03). It passes today BECAUSE the step is inert.
    # THE DAY A REAL SEND IS ADDED IT GOES RED, on the publish path specifically, naming this
    # comment. That is the re-open trigger, expressed as a check rather than as prose.
    #
    # PHASE 190 OWNS THE FIX and it is one of two shapes: gate the SEND on
    # ``ctx.is_golden_run`` inside the executor (the send is skipped, the record is not — so
    # one composer still owns the body), or give this branch the phase-type carve-out once
    # there is a real consequence to carve out. Recorded in ``189-DEFERRED.md`` too.
    _armed = getattr(phase, "action_risk_armed", False)
    if _armed and getattr(ctx, "is_golden_run", False):
        # The golden run's ONLY trace of the checkpoint. Deliberately a log line and
        # not an audit row: ``harness_audit`` is the ledger of things that HAPPENED to
        # a person, and on a golden run nobody was asked.
        logger.info(
            "publish golden run: armed action-risk checkpoint auto-continued for phase "
            "%s (D-19 — the pause is skipped, the step still runs; no approval receipt "
            "is written because no human approved)",
            getattr(phase, "slug", None),
        )
    elif _armed:
        # The sentence is NEVER re-authored here. ``grounding._approval_sentence`` is the
        # one composer, its honesty rules (POSITION / IDENTITY / CONSEQUENCE, never
        # "approved" / "safe" / "proven") are asserted character-identically by a shipped
        # test, and it is the only thing needing ``len(definition.phases)``.
        from app.services.harness.grounding import _approval_sentence

        # ``total_phases`` is None only on a direct unit call that omitted the keyword;
        # the single production call site in ``run_workflow`` always passes the real
        # ``len(definition.phases)``. The fallback keeps the sentence well-formed rather
        # than crashing — it degrades "Step 2 of 5" to "Step 2 of 2", never to a lie
        # about what the step is or what happens next.
        _total = total_phases if total_phases is not None else phase.phase_index + 1

        # ── 214 (D-214-14 / D-214-15) — WHAT THE COMPOSER CANNOT KNOW, RESOLVED HERE ─────
        # The composer stays PURE (no pool, no clock, no connection lookup), so the two
        # facts it cannot reach arrive as arguments. This branch is the right caller
        # because it already holds `pool`, `ctx` and `accumulated_outputs` — nothing new
        # is threaded through `_run_phase_with_gates`' signature.
        #
        #   * the SERVICE — `connector_connections.name`. `BUG-260828-01` measured the
        #     composer filling that slot from `config.capability`, i.e. the value already
        #     in the tool slot, so a capability row read the tautology
        #     `It will run "post_message" through post_message.` and an MCP row
        #     (`capability is None`) dropped the clause entirely. The name a person needs
        #     was always on the connection row and was never read.
        #   * the ARGUMENTS — under D-214-01 `config.tool_args` holds only the FIXED
        #     values, so rendering it would name the constants and SILENTLY OMIT exactly
        #     the arguments that vary (`Ask at launch`, `From an earlier step`). The pause
        #     therefore calls the SAME `args.resolve_arguments` the executor calls; a
        #     re-derivation here could disagree with the send, and on an approval surface
        #     that means a person authorising something other than what they read.
        #
        # ⚠ NOTHING HERE MAY FAIL THE PAUSE. Every arm degrades: an unresolvable name
        # omits the service clause (the shipped *never draw a name the system cannot know*
        # rule) and an unknowable schema falls back to the composer's pre-214 `tool_args`
        # rendering rather than to a fabricated resolved set. The executor still refuses
        # at its own named gates; this path only decides what a sentence says.
        # ⚠ NO AUDIT SURFACE. D-213-14 is unchanged — shown once, recorded never. No new
        # event type, no receipt field, and `_write_send_receipt` is not touched.
        _service_name = None
        _resolved_args = None
        _cfg = getattr(phase, "config", None)
        if getattr(_cfg, "phase_type", None) == "external_action":
            from app.services.connector_service import (
                ConnectorError,
                resolve_connection,
            )
            from app.services.connectors import args as _args

            _connection = None
            _connection_id = getattr(_cfg, "connection_id", None)
            # `org_id` has no default on the resolver (`test_the_resolver_signature_takes_
            # an_org_id` asserts that mechanically) — pass the RUN's org, as
            # `phase_types.py` does at its own Gate 5. No org means no scoped lookup and
            # therefore no name; an UNSCOPED lookup is D-14 with a friendlier name.
            _org_id = getattr(ctx, "org_id", None)
            if _connection_id and _org_id:
                try:
                    # Awaited directly, not wrapped: `resolve_connection`'s row fetch goes
                    # through `aexec`, which is already off the event loop (D-v2.5-01).
                    _connection = await resolve_connection(
                        str(_connection_id), org_id=str(_org_id)
                    )
                    _service_name = getattr(_connection, "name", None) or None
                except ConnectorError as _exc:
                    # The resolver's OWN refusal family — disabled, absent, another org's,
                    # or a credential this run cannot read. Mirrors `phase_types.py`'s
                    # posture and adds no new one; here it is not even a refusal, the
                    # clause simply omits a name it cannot know.
                    logger.debug(
                        "214 D-214-14: approval pause for phase %s could not resolve a "
                        "service name (%s) — the service clause is omitted rather than "
                        "guessed", getattr(phase, "slug", None), _exc,
                    )
                except Exception as _exc:  # noqa: BLE001 — T-214-06-05, driven RED
                    # ⚠ THE SECOND ARM IS NOT DEFENSIVE PADDING; IT WAS MEASURED. A
                    # storage layer that raises a timeout or a driver error raises no
                    # `ConnectorError` at all, and with the narrow arm alone the drive
                    # `test_T_214_06_05_a_failing_connection_lookup_still_produces_a_well
                    # _formed_pause` went RED with the raw exception escaping through the
                    # checkpoint — a DISPLAY-ONLY lookup killing the run, which is exactly
                    # the denial of service its own threat row names. Nothing fails open:
                    # the send path resolves this same connection again, at its own gate,
                    # unchanged, and refuses there if it must.
                    logger.debug(
                        "214 D-214-14: approval pause for phase %s hit an unexpected error "
                        "resolving a service name (%r) — the service clause is omitted "
                        "rather than guessed", getattr(phase, "slug", None), _exc,
                    )

            if _connection is not None:
                try:
                    # ⭐ THE SCHEMA COMES FROM THE ONE ACCESSOR, and its provenance is the
                    # executor's by construction rather than by assertion. Hand
                    # `resolve_arguments` a different schema and the pause shows a
                    # DIFFERENT — usually EMPTY — argument set from the one that leaves.
                    # ⛔ Do not read the adapter's own frozen declaration and do not index
                    # the snapshot list by hand. (Neither literal is spelled here: the
                    # acceptance fence is a grep for exactly those two names, and a fence
                    # that greps for a literal cannot be described using it — the 187-24
                    # trap, which this phase's brief records firing four times in wave 1.)
                    # The snapshot is the one resolved above, so there is no second lookup.
                    _capability = getattr(_cfg, "capability", None)
                    _is_mcp = bool(getattr(_connection, "mcp_server_url", None))
                    _schema = _args.schema_for_bound_tool(
                        capability=None if _is_mcp else _capability,
                        tool_name=getattr(_cfg, "tool_name", None) if _is_mcp else None,
                        discovered_tools=getattr(_connection, "discovered_tools", None),
                    )
                    if _schema is None:
                        # The executor RECORDS rather than sending on this same input.
                        # ⛔ A `None` schema must NOT become a fabricated resolved set:
                        # `resolved_args=None` leaves the composer rendering
                        # `config.tool_args` under its shipped rule, which claims nothing.
                        logger.debug(
                            "214 D-214-15: approval pause for phase %s could not learn the "
                            "bound tool's argument shape — showing the stored arguments "
                            "rather than a resolved set", getattr(phase, "slug", None),
                        )
                    else:
                        # The executor's OWN input shapes, mirrored per arm rather than
                        # averaged: the MCP gate passes `accumulated_outputs` and no body
                        # arg; the native gate passes `{}` and the capability's body field.
                        # A single "close enough" call here is exactly the pause/send
                        # disagreement this whole block exists to prevent.
                        from app.services.harness.phase_types import (
                            _BODY_ARG_FOR_CAPABILITY,
                            _external_action_inputs,
                        )

                        _run_inputs = _external_action_inputs(accumulated_outputs, ctx)
                        _resolved_args = _args.resolve_arguments(
                            config=_cfg,
                            schema=_schema,
                            upstream_outputs=accumulated_outputs if _is_mcp else {},
                            run_inputs=_run_inputs,
                            body_arg=(
                                None if _is_mcp
                                else _BODY_ARG_FOR_CAPABILITY.get(_capability)
                            ),
                        )
                except Exception as _exc:  # noqa: BLE001 — see the paragraph below
                    # ⚠ DELIBERATELY BROAD, AND IT WEAKENS NOTHING. `schema_for_bound_tool`
                    # lets an UNREGISTERED capability's `KeyError` propagate on purpose (the
                    # closed set failing closed at a named site) — but that refusal belongs
                    # to the EXECUTOR, which raises it at its own gate moments later. A
                    # display-only path that adopted it would turn a prompt into the thing
                    # that kills the run, one step earlier and at an unnamed site.
                    logger.debug(
                        "214: approval pause for phase %s could not resolve its arguments "
                        "(%s) — showing the stored arguments", getattr(phase, "slug", None),
                        _exc,
                    )

        sentence = _approval_sentence(
            phase, _total, service_name=_service_name, resolved_args=_resolved_args
        )

        # WAITING IS NOT FAILING (Phase 185 / RESEARCH L-5). The ledger records the
        # CONSEQUENCE (the run paused for a person); the RECEIPT is the separate
        # ``validator_ask_user_approved`` row the approval itself writes. Announcing
        # ``gate_failed`` would tell the ledger and the frontend something went wrong
        # when nothing did. Both event types are already in the ``harness_audit`` CHECK
        # constraint — this checkpoint introduces NO new one (Pitfall 6 /
        # ``BUG-260731-02``, where an unlisted kind killed the run).
        await write_audit(
            pool, run_id, user_id=_audit_user_id,
            event_type="action_risk_pending",
            metadata={"phase": phase.slug, "timing": "pre"},
        )
        # ``phase`` only: the raw sentence is deliberately NOT carried here — it IS the
        # user-facing prompt and already reaches the browser on the durable
        # ``ask_user_prompt`` row + emit inside the helper (T-185-05-04). THE CONSUMER
        # IS PHASE 188's run surface; an unhandled event is inert.
        await _emit(redis, stream_run_id, "action_risk_pending", phase=phase.slug)

        # ``_ACTION_RISK_FINDING_PREFIX`` is retained because DELTA 1 inside the helper
        # splits the prompt back out of the finding on ``"|"``. ``failed_idx=None``: the
        # checkpoint has no index into ``phase.validators`` — which is the whole point,
        # and why ``is_action_risk=True`` short-circuits the disposition resolution
        # (Pitfall 4) and writes ``validator: null`` on the receipt (D-187-18).
        outcome = await _resolve_failure_with_ask_user(
            phase, _ACTION_RISK_FINDING_PREFIX + sentence, 0, None,
            run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
            is_pre=True, is_action_risk=True,
        )
        if outcome is not None:
            # Refusal / abort / an answer we could not read as consent → the body NEVER
            # runs. Only an approval returns None and falls through.
            return outcome

    attempt = 0
    last_output = None
    # 200 (D-10): bound ONCE here rather than per-attempt, and LAZILY — a top-level
    # import of anything under ``app.services.harness`` runs that package's __init__ →
    # ``phase_types.register_all()`` → imports back from THIS module before the registry
    # is bound (the cycle the whole package documents). At call time the package is fully
    # loaded. The name is needed as an ``except`` clause target, which is why it cannot
    # stay inside the helper that raises it.
    from app.services.harness.human_input import HumanInputTimeout  # noqa: PLC0415
    while True:
        # Execute under the wall-clock cap. A hanging phase fails cleanly at the
        # timeout and drives the SAME on_failure routing as a gate failure (D-12).
        try:
            output = await asyncio.wait_for(
                _execute_phase(phase, accumulated_outputs, ctx),
                timeout=wall_clock,
            )
        except HumanInputTimeout as _pause:
            # ── 200 (D-10) — THE HUMAN GATE FAILED CLOSED ────────────────────────
            #
            # ⚠ CAUGHT **HERE**, DELIBERATELY, AND NOT LEFT TO PROPAGATE. Escaping this
            # helper would reach ``run_workflow``'s escape handler, which expires the
            # pending prompt and cancels the phase — the two things a pause must never
            # do. Catching it converts a control-flow signal into a first-class outcome
            # BEFORE any handler that treats an escape as a failure can see it.
            #
            # ⚠ IT IS **NOT** ROUTED THROUGH ``_route_on_failure``. Nothing failed: no
            # validator ran, no gate was exhausted, no retry would help. Routing it as a
            # gate failure would let an author's ``on_failure`` disposition decide what
            # happens when a PERSON steps away, which is a decision no workflow
            # definition is entitled to make. No ``gate_failed`` audit row, no
            # ``gate_failed`` emit — waiting is not failing.
            logger.info(
                "phase %s paused on the human gate for run %s: %s",
                phase.slug, run_id, _pause,
            )
            return PhaseOutcome("pause_run", None, None, str(_pause))
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
            # Never armed: the checkpoint is hoisted out of ``phase.validators``, so no
            # POST gate can be it (D-187-01).
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
      - ``action_risk:approval|...``        → ["Approve this step", "Do not run it"]
    Any other finding falls back to the generic Proceed/Abort pair. The choices are
    presented to the user; the engine maps the chosen text back to a continue/fail
    routing (an Abort-like choice → fail_run; anything else → Proceed).

    Phase 185 (GOVERN-03 / D-185-14): the ``action_risk:approval|`` pair is the ARMED
    action-risk checkpoint's. Its wording is deliberately about THE STEP rather than
    about a finding — nothing was flagged, the author simply said a person decides
    before this one runs — which is why it does not reuse "Proceed anyway" / "Abort".
    EVERY string returned from here MUST be classified by ``_is_abort_choice``; see
    that function's docstring for why an unclassified decline phrase is a fail-open.

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
    if msg.startswith("action_risk:approval|"):
        return [_ACTION_RISK_APPROVE_CHOICE, "Do not run it"]
    return ["Proceed anyway", "Abort"]


# T-185-04-01 (quick-260731-3y4) — THE ONE HOME for the armed checkpoint's approve
# label. It is BOTH what the armed pair above presents AND the only string the armed
# disposition accepts as consent (the allow-list in ``_resolve_failure_with_ask_user``),
# so a change here changes what counts as approval for an irreversible action. Written
# once for the same reason ``_ABORT_LIKE_CHOICES`` below writes the decline phrase as
# the literal the function returns: a rename must not be able to separate the label
# from the gate that reads it.
#
# ⚠ WORDING — corrected at /gsd:verify-work 189 (2026-08-08), operator-decided.
# This read "Approve and run this step" until Phase 189's live UAT observed it on an
# ``external_action`` step, whose whole contract is that it RECORDS AN INTENTION AND
# SENDS NOTHING. "and run" implied an outward effect the governed node exists not to
# have — it was the one sentence on that surface arguing against SC#4, while the
# step's own recorded output says "No email was sent. Nothing left this workflow."
#
# Deliberately ONE literal for every armed type rather than a phase-type-conditional
# label: the gate at ``_resolve_failure_with_ask_user`` is an EXACT-MATCH fail-closed
# compare, and making the label conditional would force that allow-list to accept two
# strings — widening the consent set on an irreversible action, which is precisely the
# surface Phase 190 makes dangerous. "Approve this step" is true of every armed type
# (185's ``llm_human_input`` included) without splitting the label from its gate.
#
# ⚠ Changing this literal changes what counts as consent. A run already PAUSED at an
# armed checkpoint under the old label fails CLOSED on resume (line ~1365 returns
# fail_run when the answer does not match) — safe, but it does end that run. Verified
# at edit time that no live paused run existed; the three ``active`` rows were stale
# zombies from June/July.
_ACTION_RISK_APPROVE_CHOICE = "Approve this step"


# Phase 185 (GOVERN-03 / RESEARCH L-4) — the set of chosen texts that mean "do NOT
# proceed". Lower-cased comparison values; the armed decline phrase is written as the
# SAME literal ``_ask_user_choices_from_finding`` returns, lowered here, so the two
# cannot drift apart under a rename.
_ABORT_LIKE_CHOICES = ("abort", "cancel", "stop", "", "Do not run it".lower())


def _is_abort_choice(choice: str) -> bool:
    """A chosen option that means 'do NOT proceed' → honest fail_run (D-11).

    **THE INVARIANT (Phase 185 / L-4): every string a branch of
    ``_ask_user_choices_from_finding`` can return must be classified by this
    function** — exactly one of each presented pair is abort-like and the other is not.

    THE FAIL-OPEN SHAPE THIS CLOSES. The routing is not symmetric: an abort-like
    choice fails the run, and *everything else* — including a decline phrase this
    function does not recognise — falls through to the Proceed branch, which writes a
    ``validator_ask_user_approved`` receipt and RUNS the step. Before Phase 185 the set
    was ``("abort", "cancel", "stop", "")``, so the armed checkpoint's ``"Do not run
    it"`` would have been read as approval: a person clicking *don't* would have sent
    the email and been recorded as having authorised it. Any FUTURE choice pair must
    therefore extend this set in the SAME commit that adds it; the invariant guard in
    ``tests/unit/test_ask_user_disposition.py`` drives every known finding prefix plus
    the generic fallback and fails if a pair is ever left unclassified.

    The three shipped freshness/generic choices are literally ``"Proceed anyway"``,
    ``"Proceed despite version ambiguity"`` and ``"Abort"`` — none of which the Phase
    185 addition touches, so those routings are byte-identical.
    """
    return (choice or "").strip().lower() in _ABORT_LIKE_CHOICES


# Phase 185 (GOVERN-03 / RESEARCH L-5) — the structured finding prefix that carries the
# armed approval sentence into ``_resolve_failure_with_ask_user``, whose DELTA 1 splits
# the prompt back out on ``"|"``. Phase 187 (D-187-01) made the hoisted checkpoint its
# ONLY producer, and the string-prefix SNIFF that used to read it back is DELETED —
# the engine no longer infers "this phase is armed" from a message it parsed; the
# checkpoint reads ``phase.action_risk_armed`` and tells the helper so with
# ``is_action_risk=True``. The prefix is now a wire format, not a predicate.
_ACTION_RISK_FINDING_PREFIX = "action_risk:approval|"


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
    is_action_risk: bool = False,
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

    ``is_action_risk`` (D-187-01 / RESEARCH Pitfall 3) — TRUE only when the CALLER is
    the armed action-risk checkpoint. It is a per-CALL parameter and never a
    ``phase.action_risk_armed`` read inside this function, because this function serves
    BOTH the armed checkpoint AND the author's own ``ask_user`` gates on the SAME phase.
    An armed phase can carry authored gates too, and only the armed one gets the armed
    treatment (the indefinite wait, the shutdown-``CancelledError`` escape, the armed
    choice pair, and the exact-match approval allow-list). Reading the phase here would
    hand an unrelated freshness gate all four. Every non-armed caller leaves it at its
    ``False`` default and every branch below evaluates to exactly the expression that
    shipped.
    """
    # ── D-187-01 / RESEARCH Pitfall 4 — THE DISPOSITION SHORT-CIRCUIT ────────────
    # An armed checkpoint has NO index into ``phase.validators`` (after the hoist it is
    # not in the list at all), so ``failed_idx`` is None and ``_failing_on_failure``
    # would fall back to the PHASE's own heuristic — an author's ``fail_run`` could
    # route the checkpoint to ``_route_on_failure`` and THE PERSON WOULD NEVER BE ASKED.
    # That is a fail-open of exactly the class the Phase-185 BLOCKER T-185-04-01
    # belonged to. When ``is_action_risk`` the disposition is ``ask_user`` BY
    # CONSTRUCTION, so ``_failing_on_failure`` is skipped ENTIRELY rather than computed
    # and overridden — there is no path a future edit can re-introduce the read on.
    if not is_action_risk:
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

    # ── Phase 185 (GOVERN-03 / SPEC Req 9) — THE ARMED-GATE READING ──────────────
    # ONE flag; every Phase-185 delta below branches on it. Phase 187 (D-187-01) moved
    # the reading from a string-prefix sniff on the error message to the ``is_action_risk``
    # PARAMETER declared above: the CALLER knows which gate it is, and only the armed
    # caller passes True. The substance is unchanged — an armed phase can also carry
    # authored gates, and only the armed one gets this disposition. An unarmed
    # ``llm_human_input`` step and every freshness gate keep byte-identical behaviour:
    # for them ``is_action_risk`` is False and each branch below evaluates to exactly the
    # expression that shipped.

    tool_call_id = uuid4().hex
    choices = _ask_user_choices_from_finding(error_message)
    if is_action_risk:
        # DELTA 1 — the prompt. "A validation check on phase 'X' flagged: …" is wrong
        # for an armed step: nothing was flagged, the author simply said a person
        # decides before this one runs. Use the engine-generated sentence carried AFTER
        # the prefix, VERBATIM (D-185-14) — composed by ``grounding._approval_sentence``,
        # already honest about POSITION, IDENTITY and CONSEQUENCE, and deliberately not
        # wrapped in the generic validation-flagged sentence.
        prompt = error_message.split("|", 1)[1]
    else:
        prompt = (
            f"A validation check on phase '{phase.slug}' flagged: {error_message}. "
            "How should the run proceed?"
        )
    # DELTA 2 — the timeout. An armed checkpoint waits INDEFINITELY: with the checkpoint
    # set, no answer must mean the run NEVER proceeds (SPEC Req 9), so there can be no
    # expiry that quietly reads as "yes". ``None``, never ``0``: the shipped
    # ``PendingAskCard`` seeds its countdown from this value and counts a null/zero
    # deadline down to EXPIRED ("No response within 0:00 — agent stopped"), so emitting
    # ``0`` would render every armed prompt as dead the instant it appeared. Plan 185-05
    # teaches the card to render ``None`` as "no deadline"; this path's job is to SEND
    # ``None`` — it rides into the durable prompt row and the ``ask_user_prompt`` emit
    # below unchanged, both of which simply carry ``timeout_seconds``.
    timeout_seconds = None if is_action_risk else min(
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
        redis, run_id, tool_call_id,
        # DELTA 2 (cont.) — armed: pass ``None`` straight through for the indefinite
        # wait (the ``float()`` cast would TypeError on it). The non-armed expression is
        # byte-identical to what shipped.
        timeout_seconds if is_action_risk else float(timeout_seconds),
    )

    # DELTA 3 (RESEARCH L-6) — a graceful restart must not DESTROY an armed run.
    # A ``{"kind": "shutdown"}`` payload comes ONLY from main.py's
    # ``broadcast_shutdown_sentinel_to_all``. It is not a decision, and today it is read
    # as one: the payload is not ``kind: "response"``, so ``choice`` stays ``""``,
    # ``_is_abort_choice("")`` is True, and the run is FAILED by a routine deploy. Copy
    # the shipped 096-09 precedent (``harness/phase_types._exec_llm_human_input``):
    # raise ``asyncio.CancelledError`` so the phase stays ``active`` and the durable
    # prompt row survives, and let the boot-time resume sweep re-ask. ``run_workflow``'s
    # escape handler already skips ``_expire_pending_ask_user`` when
    # ``is_app_shutting_down()``, so the prompt is not expired out from under it.
    #
    # SCOPED TO ARMED CHECKPOINTS ONLY, DELIBERATELY. The freshness gate reaching this
    # same line has the identical destructive-on-deploy behaviour, but SPEC Req 9 scopes
    # the fail-closed change to armed checkpoints ("a plain llm_human_input step keeps
    # its CURRENT timeout disposition unchanged"; §Out-of-scope: "Only armed checkpoints
    # change") and no D-185-NN decision authorises widening it. So the asymmetry inside
    # this one function is intentional: an armed gate escapes via CancelledError, every
    # other disposition keeps today's choice="" → _is_abort_choice("") → fail_run path
    # byte-for-byte. The freshness twin is recorded as a deferred item in
    # ``185-CONTEXT.md`` with a re-open trigger; it is not fixed here.
    if is_action_risk and payload and payload.get("kind") == "shutdown":
        raise asyncio.CancelledError(
            "action-risk checkpoint interrupted by server shutdown — phase left active "
            "for the boot-time resume sweep (096-09 precedent)"
        )

    reason_base = (
        f"Phase {phase.phase_index + 1} ({phase.slug}) validation flagged: {error_message}"
    )

    if payload is None:
        # Unanswered (the 085 expiry) → honest fail, never hung.
        #
        # DELTA 4 — KEPT ON PURPOSE for armed gates. With ``timeout_seconds=None`` this
        # branch is unreachable for an armed checkpoint except on an UNPARSEABLE payload
        # (``_subscribe_and_block`` also returns ``None`` for malformed JSON). Keeping
        # it is the fail-closed posture: a payload we could not read is not consent, and
        # the only safe reading of "we don't know what they said" is "do not run it".
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

    # ── T-185-04-01 — THE ARMED PROCEED SIDE IS AN ALLOW-LIST ────────────────────
    # ``_is_abort_choice`` is a DENY-list, and a deny-list cannot be made fail-closed
    # by extension: there is no finite set of ways to say no. Phase 185 extended it and
    # added an invariant guard over the PRESENTED BUTTON LABELS, but the shipped
    # ``PendingAskCard`` does not restrict the person to those labels — its free-text
    # ``<textarea>`` is unconditional (the choice buttons are gated on
    # ``options.length > 0``; the textarea is gated on nothing), and ``api/runs.py``
    # accepts ``response_text`` without validating it against the prompt's options. So a
    # typed "no", "nope", "stop it" or "Do not run it." (trailing period) fell straight
    # through this deny-list into the receipt write below, RAN the risky step and
    # recorded the person who refused as having authorised it.
    #
    # The engine's own words, four branches up at the ``payload is None`` case: "a
    # payload we could not read is not consent, and the only safe reading of 'we don't
    # know what they said' is 'do not run it'." An answer we cannot read AS THE APPROVAL
    # OPTION is the identical epistemic situation, so it gets the identical reading.
    #
    # Exact equality against the presented label, on the value already ``.strip()``ed
    # above — not casefold, not prefix, not substring. Case-insensitive matching would be
    # strictly MORE permissive for zero benefit: the click path resolves ``choices[0]`` to
    # this exact literal, so every string a looser rule newly accepts is one only the
    # typed path can produce. And the two errors are not symmetric — refusing an
    # oddly-cased approval fails a run the person re-triggers with a click; accepting one
    # sends the email.
    #
    # ORDERING IS LOAD-BEARING. ``_is_abort_choice`` stays FIRST so "Do not run it" and
    # "Abort" keep the byte-identical "— aborted by user" reason on every path including
    # this one. And the branch is gated on ``is_action_risk`` (the caller-supplied
    # parameter, D-187-01 — one flag read in one place), so
    # on the three non-armed choice pairs it is dead code and their routing — free-text
    # fall-through included — is unmoved. The distinct reason below is deliberate: the
    # ledger must not claim the person "aborted" when the truth is that the engine could
    # not read their answer as consent. The raw answer is NOT interpolated — it reaches
    # the durable prompt row, not the run's failure reason.
    if is_action_risk and choice != _ACTION_RISK_APPROVE_CHOICE:
        return PhaseOutcome(
            "fail_run", None, None,
            f"{reason_base} — not approved: the answer did not match the approval option",
        )

    # Proceed — write the governance receipt, then continue.
    #
    # D-187-18 — ``validator`` is written as ``None`` for a HOISTED armed checkpoint
    # (``is_action_risk`` with ``failed_idx is None``). After D-187-01's hoist the
    # checkpoint is not a member of ``phase.validators``, so there IS no validator index
    # and saying so is honest. This is a DELIBERATE governance-ledger shape change, not
    # an oversight: the key stays PRESENT so there is exactly one row shape per
    # ``event_type`` — two shapes for one event type is worse than an honest null — and
    # every pre-187 row keeps its int. No new ``event_type`` is introduced; the
    # ``harness_audit`` CHECK is a closed list of 23 values and this phase ships zero
    # migrations (``BUG-260731-02`` is the precedent where an unlisted kind killed a run).
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

    # Phase 205 (STATE-01 / D-01..D-04): Living register / incremental stateful mode
    # Resolve the previous completed run's deliverable for the stable workflow slug + owner.
    if getattr(definition, "is_stateful", False) and _audit_user_id:
        try:
            _user_uuid = UUID(str(_audit_user_id)) if not isinstance(_audit_user_id, UUID) else _audit_user_id
            _org_uuid = None
            if getattr(ctx, "org_id", None):
                _raw_org = getattr(ctx, "org_id")
                _org_uuid = UUID(str(_raw_org)) if not isinstance(_raw_org, UUID) else _raw_org
            ctx.prior_run = await get_latest_completed_workflow_run(
                pool, definition.slug, user_id=_user_uuid, org_id=_org_uuid
            )
        except Exception as exc:
            logger.warning("run_workflow: failed to resolve prior run for stateful workflow %r: %s", definition.slug, exc)
            try:
                ctx.prior_run = None
            except (AttributeError, TypeError):
                pass
    else:
        try:
            ctx.prior_run = None
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
    #
    # ── Phase 185 (GOVERN-01 Req 4) — THE ONE ENFORCEMENT SEAM ──────────────────
    # The synthesis below is what makes the citation gate fire "whether or not the
    # definition JSONB declares it, including on already-published definitions" —
    # its rule, its rationale and its NEVER-persisted contract live in one place,
    # `app.services.harness.grounding` (read that docstring before changing this).
    # This dict is the single chokepoint: DOWNSTREAM of every
    # `WorkflowDefinition.model_validate()` (fresh kickoff, boot-time resume, AND the
    # publish golden run, which drives `run_workflow` from
    # `publish_service._drive_golden_run`) and UPSTREAM of `_run_phase_with_gates`,
    # which owns the pre-gate pass, the post-gate pass, the WR-03 retry rebinding and
    # `_route_on_failure` — all of which read `phase.validators` off the object handed
    # over here. Because the synthesis happens inside `run_workflow` it never touches
    # the save path (`db/workflows.py` persists `model_dump(mode="json")`), so no
    # synthesized `ValidatorSpec` can ever be persisted; and the `workflow_phases`
    # rows, minted from the original definition, are left untouched. An ungoverned
    # phase comes back BY REFERENCE — the same object, not a copy.
    #
    # PUBLISH CONSEQUENCE, stated here rather than discovered in UAT: the publish
    # gauntlet gains NO new stage (D-185-11's letter holds), but publish BEHAVIOUR
    # changes for detected steps — a detected step whose golden run retrieves nothing
    # now fails the existing golden-run stage and blocks publish. Every
    # `workflow_definitions` row today is throwaway test data, so this is acceptable.
    from app.services.harness.grounding import effective_phase

    _total = len(definition.phases)
    spec_by_slug = {p.slug: effective_phase(p, total_phases=_total) for p in definition.phases}
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
    # ── Phase 204 (SCHED-02 / D-204-05 / D-204-06) — THE CIRCUIT BREAKER ───────────
    #
    # ⚠ IT IS DISARMED FOR EVERY RUN THAT EXISTS TODAY, AND THAT IS THE POINT OF SITING
    # IT HERE. ``load_run_budget`` reads ``workflow_runs.metadata`` — a column only
    # 204-03's scheduler writes — so an interactive run resolves both limits to ``None``,
    # ``check_limits`` returns ``(False, None)`` forever and ``duration_watch`` creates no
    # task. The engine's shipped behaviour is byte-identical on the path everything takes
    # today; the ceilings exist for the runs nobody is watching.
    #
    # ⚠ THE ANCHOR IS THE RUN'S SERVER TIMESTAMP, NOT NOW(). ``load_run_budget`` returns
    # ``claimed_at ?? created_at``. A resumed run that re-anchored on the current instant
    # would grant itself a whole fresh wall-clock budget on every restart — which is
    # exactly how a duration cap becomes decorative, and it is the same defect Phase 200's
    # elapsed timer was fixed for (BUG-260610-01).
    #
    # ⚠ ``ctx`` WINS OVER THE DATABASE WHEN IT CARRIES LIMITS. The plan allows either
    # source; a caller that passes them explicitly (a test, a future direct invocation)
    # must not be silently overridden by a row it did not write.
    #
    # ⚠ THE READ FAILS OPEN. See ``load_run_budget``'s docstring: a database blip must not
    # kill every in-flight run on every worker at once. The named cost is that an
    # unapplied migration 125 silently disarms the cap.
    # ``persist_run_usage`` (Phase 256 / METER-03) rides the same local import: it is the
    # ONE home of the token write (D-256-05), so this file gains a CALL and no SQL.
    from app.db.workflows import (  # noqa: PLC0415 — module load-path rule
        load_run_budget,
        persist_run_usage,
    )

    _budget = await load_run_budget(pool, run_id)
    breaker = CircuitBreaker(
        max_tokens=getattr(ctx, "max_tokens_per_run", None)
        or _budget["max_tokens_per_run"],
        max_duration_seconds=getattr(ctx, "max_duration_seconds", None)
        or _budget["max_duration_seconds"],
        started_at=_budget["started_at"],
    )
    # THE TOKEN SOURCE, AND IT IS THE HALF THAT DID NOT EXIST BEFORE PHASE 204. The
    # harness had NO per-call token counts at all.
    #
    # ⚠ CORRECTED (Phase 256 / D-256-08). This sentence previously read, verbatim apart
    # from the spaces added around the ``=`` so the literal itself is no longer in this
    # file:
    #   "``harness/`` contained two ``usage`` references in total, both
    #    ``input_tokens = None``."
    # It is quoted here rather than deleted, because the FIGURE was wrong and a reader
    # who trusted it would have believed METER-05 had two holes to close. MEASURED with
    # ``grep -rn "input_tokens=" backend/app | grep None``: SEVEN argument sites plus one
    # default parameter — api/runs.py:677 and :1331, this module's resume shell,
    # harness/publish_service.py, scheduler_service.py, eval_runner_service.py and
    # run_reconciler.py. Phase 256 closes this module's; the others belong to its other
    # plans, and run_reconciler's is REGISTERED rather than fixed (the process is gone, so
    # a stranded run's count is genuinely unknowable in memory).
    #
    # The counts were being measured the
    # whole time one layer down — ``task_service._stream_one_iteration`` has SUMMED every
    # turn's usage into a caller-supplied box since Phase 093 (D-17) — but nothing handed
    # a box to the harness and ``run_task_sub_agent`` did not return its total. Setting
    # ONE box here, which the executors thread into the substrate that already fills it,
    # is what makes ``max_tokens_per_run`` a ceiling that can actually trip rather than a
    # setting that is read and never reached (the Phase-200 SC#3 shape).
    #
    # ⚠ THE BOX IS CUMULATIVE AND ``record_tokens`` IS ADDITIVE — the breaker's
    # ``absorb_usage_box`` owns the subtraction so this file carries no delta bookkeeping.
    #
    # ⚠ CORRECTED (Phase 256 / METER-06 / plan 256-04 / F-4). ``llm_emit`` PHASES ARE
    # NOW COUNTED. The original text is QUOTED rather than deleted, because it was a
    # hole NAMED rather than hidden — and it named its own re-open condition, which
    # then came true:
    #
    #   "⚠ ``llm_emit`` PHASES ARE NOT COUNTED, AND THAT IS NAMED RATHER THAN HIDDEN.
    #    ``forced_emit`` measures no usage anywhere in its own module, so its spend is
    #    invisible to any box. Wiring it means instrumenting the forcing seam, which
    #    is a different file and a different plan. The three counted types are the
    #    three that loop (``llm_agent``, ``llm_batch_agents``) or stream
    #    (``llm_single``); a sealed single shot is the one that cannot run away."
    #
    # THAT DIFFERENT PLAN WAS 256-04, and the leg now counts end to end:
    #   ``forced_emit._drain``'s two usage arms (mirrored from ``task_service``)
    #     → ``forced_emit``'s LADDER accumulator, declared above the rung loop so a
    #       FAILED rung's spend counts too — you were billed for every shot served
    #     → the token keys on BOTH exits (the success return and the honest-fail floor)
    #     → ``harness/phase_types._exec_llm_emit``'s ``_record_run_usage`` call
    #     → ``ctx.run_usage_box`` (set below)
    #     → the breaker's ``absorb_usage_box`` → ``persist_run_usage``.
    #
    # ⚠ THE ORIGINAL'S CLOSING REASONING STILL HOLDS AND IS NOT RETIRED WITH IT: a
    # sealed single shot is indeed the phase type that cannot RUN AWAY. What it could
    # do — and did — is spend real money invisibly, which is a different failure and
    # the one METER-06 closes. ⛔ ``TOKEN_COVERAGE_LEGS`` in ``db/workflows.py`` gained
    # ``"emit"`` in the SAME commit as those drain arms (O-4).
    try:
        ctx.run_usage_box = {}
    except (AttributeError, TypeError):
        pass  # immutable stub ctx in some unit tests — the breaker simply sees no tokens

    async def _enforce_budget(where: str) -> None:
        """Absorb the run's spend, and raise if either ceiling is now breached.

        ⚠ IT RAISES ``CircuitBreakerTrippedError`` AND **NOT** ``asyncio.CancelledError``,
        AND IT IS CALLED FROM OUTSIDE THE PHASE ``try``. Both halves are load-bearing. A
        ``CancelledError`` would take the escape arm below, which calls ``cancel_phase`` —
        and a shipped Phase-194 fence AST-counts ``cancel_phase`` call sites in this module
        at EXACTLY ONE (204-01 hit that fence and answered by removing a write, not by
        re-baselining the count). Calling from outside the ``try`` keeps this exception out
        of that arm entirely, so the count is untouched.

        ⚠ IT RAISES AND DOES NOT ``break``. 204-01 measured what ``break`` costs here: the
        statements after this ``while`` loop are ``finish_run(pool, run_id, "completed")``,
        a ``run_completed`` audit row, ``_surface_final_answer`` and a ``run_completed``
        SSE frame. Breaking out of a TRIPPED run therefore overwrites the breaker's
        ``cancelled`` with ``completed``, persists a partial answer as the deliverable and
        tells the browser the run finished — a run killed for overspending, reporting
        success. ``return`` would be honest but silent; ``raise`` is honest AND tells the
        producer, whose F2 arm (204-01) consults the cancel registry and writes
        ``cancelled`` rather than ``failed``.

        ⚠ THE TRIP RECORD AND THE CANCEL HAPPEN BEFORE THE RAISE, inside ``trip_breaker``.
        By the time this propagates the run is already durably ``cancelled`` with its
        audit row written, so no handler upstream has to know what a breaker is.

        ⚠ THE ABSORB AND THE DURABLE WRITE SIT **ABOVE** THE ``armed`` GUARD, AND THAT
        ORDER IS THE WHOLE OF METER-03 (Phase 256, D-256-04 as corrected). ``armed`` is
        *"is either ceiling configured?"* — an INTERACTIVE harness run configures
        neither, so a persist written below this guard would run for scheduled runs only
        and measure nearly every harness run in the product at zero.
        ⛔ IT IS BEHAVIOUR-PRESERVING FOR THE TRIP, and the proof is arithmetic rather
        than empirical: on a disarmed breaker ``max_tokens`` and ``max_duration_seconds``
        are both ``None``, and BOTH arms of ``check_limits`` guard on ``is not None``, so
        it returns ``(False, None)`` unconditionally. The guard is a SHORT-CIRCUIT, never
        a semantic. ``absorb_usage_box`` mutates only the breaker's own counters, which a
        disarmed breaker never reads.
        ⛔ NO ``try`` AROUND THE PERSIST. This function's contract above is that it
        raises ``CircuitBreakerTrippedError`` and not ``CancelledError``; a ``try/except``
        here would add a branch to a function whose branch count is itself fenced.
        """
        _d_in, _d_out = breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))
        await persist_run_usage(
            pool, run_id, input_delta=_d_in, output_delta=_d_out
        )
        if not breaker.armed:
            return
        _tripped, _reason = breaker.check_limits()
        if not _tripped:
            return
        await breaker.trip_breaker(
            pool, redis, run_id, _reason, {"observed_by": where},
            user_id=_audit_user_id,
        )
        raise CircuitBreakerTrippedError(_reason, breaker.measurements())

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

        # ── 0. Phase 204 (L-01 / D-204-02) — THE CROSS-WORKER BRAKE, LEVEL HALF ──
        #
        # ⚠ WHY THIS SITS *BEFORE* ``mark_phase_active`` AND NOT ANYWHERE ELSE. Below
        # this line the engine writes a durable `active` row, emits `phase_started` to
        # the browser and hands control to an executor that calls a provider. Every one
        # of those is a cost or a claim, and a run whose owner has already pressed Stop
        # is entitled to none of them. Checking here is what makes the phase boundary a
        # hard floor: at worst ONE phase runs after a Stop, never two.
        #
        # ⚠ THIS IS THE HALF THAT SURVIVES A MISSED MESSAGE. Its partner is the
        # ``cancellation_watch`` below, which brakes DURING a phase; this one brakes
        # BETWEEN phases and needs no subscriber to have existed at the moment the
        # cancel was decided. Redis PUBLISH is fire-and-forget, so on a restarted or
        # slow-to-subscribe worker the edge is simply gone — and this check still fires.
        # Neither half is redundant; see ``run_lifecycle``'s key block for the argument.
        #
        # ⚠ IT WRITES NOTHING, AND THAT IS A CORRECTION TO THE PLAN RATHER THAN AN
        # OMISSION. 204-01 task 2 says to "invoke ``cancel_phase``" here. A shipped 194
        # fence forbids it —
        # ``test_the_cancel_arm_is_the_harness_engines_alone_and_deep_never_enters_it``
        # AST-counts ``cancel_phase`` calls in this module and asserts EXACTLY ONE, the
        # interrupted-phase terminalize on the escape arm below. A second call site
        # turns it red (measured: it read 2). The fence is RIGHT and was answered by
        # removing the write, not by re-baselining the count.
        #
        # ⚠ AND THE WRITE WOULD HAVE BEEN WRONG TWICE OVER. (a) ``cancel_phase`` is
        # ``WHERE id = $1`` with NO status predicate (``db/workflows.py:1770``), so
        # calling it here would flip a `pending` row — a step that never ran — to
        # `cancelled`, which the client's vocabulary renders as "Stopped by you". That
        # is verbatim the 194 CR-02 defect this file already carries the correction for
        # three screens down. (b) The row is ALREADY terminalized by the time anything
        # gets here: ``broadcast_run_cancellation`` is called from inside
        # ``cancel_workflow_run_internals``, whose very next statements are
        # ``finish_run`` + ``cancel_active_phases`` — the RUN-KEYED, ``AND status =
        # 'active'`` set-predicate that owns exactly this write. There is no path that
        # publishes the signal without also running it. So this brake reads state and
        # stops; the durable writes belong to the worker that decided the cancel.
        #
        # ⚠ ``return``, AND **NOT** ``break`` — THE PLAN SAYS "break immediately" AND
        # THAT WORD WOULD HAVE SHIPPED A LIE. This ``while`` loop does not fall through
        # to nothing: the statements after it are ``finish_run(pool, run_id,
        # "completed")``, a ``run_completed`` audit row, ``_surface_final_answer`` and a
        # ``run_completed`` SSE frame. Breaking out of a CANCELLED run therefore
        # overwrites the cancelling worker's ``cancelled`` with ``completed``, persists
        # a partial answer as the deliverable and tells the browser the run finished.
        # Written first as ``break`` and caught by driving the engine — the pinning case
        # is ``test_the_boundary_brake_never_lets_the_run_report_completed``, which reads
        # `completed` out of the recorded writes when the statement is reverted.
        #
        # ⚠ AND NOT ``raise`` EITHER. The run has already been terminalized on the
        # cancelling worker, so raising would only route a second, redundant terminalize
        # through the escape handler. Returning leaves the engine with the durable state
        # already correct and nothing further claimed.
        if await is_run_cancelled(redis, run_id):
            logger.info(
                "run %s: cancel signal observed at the phase boundary before %s — "
                "stopping the engine (L-01)",
                run_id,
                phase.slug,
            )
            return

        # ── 0b. Phase 204 (SCHED-02) — THE BUDGET FLOOR, SAME BOUNDARY, SAME REASON ──
        #
        # Sited immediately after the cancel brake and for the identical argument: below
        # this line the engine writes a durable ``active`` row, emits to the browser and
        # hands control to an executor that calls a provider. A run that has already spent
        # its budget is entitled to none of them. This is the check that satisfies "once
        # the breaker trips, zero further LLM provider calls or phase executions are
        # permitted" — it is a HARD FLOOR before the work, not a report after it.
        #
        # ⚠ IT ALSO COVERS THE TWO CASES A POST-PHASE CHECK CANNOT SEE: a RESUMED run
        # whose budget was already blown before the restart (the loop's first iteration
        # reaches here before anything executes), and a ``skip_to_phase`` cycle, which
        # ``continue``s past the end of the body without ever completing a phase.
        await _enforce_budget("phase_boundary")

        # 1. DURABLE active BEFORE any work (Pitfall 1).
        # 200 (DES-02 / D-05): the write RETURNS the timestamp it stored, so the frame
        # below carries the value the ROW carries — never a Python-side now() computed
        # beside it. WRITE-before-EMIT is what makes that possible: the durable flip has
        # already happened by the time this frame is built, so nothing here announces a
        # fact the database does not yet hold.
        phase_started_at = await mark_phase_active(pool, phase_id)
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
            # 200 (D-05) — THE LIVE TICK'S ANCHOR. FETCH STAYS AUTHORITATIVE
            # (D-v2.5-03): the client reconciles from `GET /threads/{id}/workflow` and
            # `GET /workflow-runs/{id}`, and a terminal run has no stream at all, so the
            # panel's reconcile floor cannot depend on this frame. What the frame buys is
            # the anchor AT THE INSTANT THE STEP STARTS, so a running step can tick
            # without polling. `None` when the row did not move — the client then renders
            # nothing rather than counting up from an invented zero.
            started_at=_iso(phase_started_at),
        )

        # 2. Execute under the bounded-retry gate loop (wall-clock cap + gates +
        #    on_failure routing live inside). The step cap is enforced INSIDE the
        #    executor (run_task_sub_agent max_steps, Plan 03) — both caps present.
        try:
            # ── Phase 204 (L-01 / D-204-02) — THE BRAKE'S *EDGE* HALF ──────────
            #
            # ⚠ THIS IS THE LINE THAT MAKES L-01 ABOUT MONEY RATHER THAN ABOUT A
            # STATUS COLUMN. The boundary check above cannot help a run that is
            # already inside a 900-second provider call; this listener cancels the
            # task the instant the signal lands, so the CancelledError surfaces at
            # the provider await and the executor issues no further request.
            #
            # ⚠ IT ADDS NO NEW HANDLING, AND THAT IS DELIBERATE (G-5 — honoured by
            # construction). The cancellation it raises is caught by the SAME
            # ``except BaseException as _escape`` arm below that a user Stop has
            # always taken, takes the SAME ``isinstance(_escape, CancelledError)``
            # branch, writes the SAME phase-keyed ``cancel_phase``, and re-raises
            # through the SAME bare ``raise``. A cross-worker Stop is therefore
            # indistinguishable from a local one by the time it reaches any writer
            # — which is D-204-03's "one unified stop path" enforced by shape
            # rather than by a rule someone has to remember.
            #
            # ⚠ THE ``async with`` IS *INSIDE* THE ``try`` ON PURPOSE. Outside it,
            # the CancelledError raised by the watcher would escape this handler
            # entirely and the interrupted phase row would never be terminalized.
            #
            # ⚠ THE LISTENER IS SCOPED TO ONE PHASE, NOT TO THE RUN. It is torn
            # down by the context manager on every exit path — completion,
            # failure, pause and cancellation alike — so a long run cannot
            # accumulate one Redis subscription per phase (threat: stranded
            # channels). Re-subscribing per phase costs one round trip against a
            # body measured in seconds to minutes.
            # ── Phase 204 (SCHED-02) — THE WALL-CLOCK SENTINEL, ON THE SAME LINE ──
            #
            # ⚠ THIS IS THE ONLY THING THAT CAN KILL A *HUNG* PHASE ON A DEADLINE. The
            # duration threat is named as "hanging network requests or third-party
            # deadlocks"; a boundary check cannot see one, because a hung phase never
            # reaches the next boundary. A duration cap enforced only at boundaries
            # would be built, gated, green and structurally unable to do its job.
            #
            # ⚠ IT CANCELS NOTHING ITSELF — IT TRIPS, AND ITS SIBLING ON THIS LINE DOES
            # THE KILLING. ``trip_breaker`` composes ``cancel_workflow_run_internals``,
            # which broadcasts on Redis; the ``cancellation_watch`` entered immediately
            # to its left then cancels this task, through the identical path a human
            # Stop takes. That is D-204-03's one unified stop path — a second killer
            # would be a second thing that can drift.
            #
            # ⚠ ORDER ON THIS LINE IS LOAD-BEARING: ``cancellation_watch`` is entered
            # FIRST, so it is already listening when the sentinel starts. Reversed, a
            # deadline that had already elapsed could trip before anything was
            # subscribed, and the run would brake one boundary later instead of now.
            #
            # ⚠ THE SENTINEL IS SCOPED TO ONE PHASE, exactly like its sibling — torn
            # down on every exit path so a long run accumulates no tasks. The deadline
            # is ABSOLUTE, so re-entering per phase re-computes the remaining time; a
            # per-phase TIMER would let an N-phase run outlive an N-times deadline.
            async with cancellation_watch(redis, run_id), breaker.duration_watch(
                pool, redis, run_id, user_id=_audit_user_id
            ):
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
                    # D-187-01 — the armed checkpoint's sentence needs the run's phase
                    # count (``_approval_sentence`` says "Step N of TOTAL"). This is the
                    # SAME ``len(definition.phases)`` ``effective_phase`` receives above.
                    total_phases=_total,
                )
        except BaseException as _escape:
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
                            pool, getattr(ctx, "thread_id", None), run_id,
                            org_id=getattr(ctx, "org_id", None),
                        )
                    )
                except BaseException:  # noqa: BLE001 — second cancel mid-cleanup
                    logger.exception(
                        "ask_user expiry cleanup failed on cancel/escape for run %s",
                        run_id,
                    )
                # ── 194 / RUN-01 / SC#3 (V-16) — the INTERRUPTED phase row ────
                # THIS ARM IS THE ONLY HOME THAT KNOWS *WHICH* PHASE THE USER
                # INTERRUPTED WITHOUT A QUERY. ``phase_id`` is bound at the top
                # of THIS loop iteration (``phase_id = row["id"]``), so the write
                # is PHASE-KEYED on the row that was actually running — it can
                # distinguish "the phase the user interrupted" from "some phase
                # row that happens to be `active`". The run-keyed sibling
                # (``cancel_active_phases``) belongs to the engineless zombie
                # arm, which has no loop and no phase_id at all; using it here
                # would throw that certainty away (RESEARCH § G-C).
                #
                # Completed phases' outputs are ALREADY durable — this does NOT
                # touch them (D-07 / D-13, inherited verbatim from the fail_run
                # arm below). Only the phase that was RUNNING moves. It did not
                # `fail` (nothing went wrong) and was not `skipped` (it ran); the
                # `cancelled` literal is migration 119's (D-04).
                #
                # ⚠ WHY THIS SITS INSIDE THE 096-09 GATE — STATED, NOT INHERITED.
                # The gate's own scope is the ask_user expiry, and this write is
                # deliberately placed under the SAME condition rather than beside
                # it: on a GRACEFUL app shutdown the run stays resumable and the
                # boot sweep re-claims it, so a phase row left `active` is
                # CORRECT — that phase really is still pending work, and
                # terminalizing it would strand a resumable run with a dead step.
                # A user Stop / crash / timeout (flag False) terminalizes exactly
                # as SC#3 requires. The gate itself is neither moved, duplicated
                # nor widened; one more statement joins its existing body.
                #
                # Shielded + its own try/except for the same reason the expiry
                # above is: cancellation is already in flight, an unshielded
                # await would be cancelled before it wrote, and a cleanup failure
                # must never mask the escape. The ``raise`` stays LAST.
                #
                # ⚠ CR-02 (194 code review) — ONLY A CANCELLATION MAY BE WRITTEN
                # AS ONE, AND THE ESCAPE IS THE ONLY THING THAT KNOWS. ⚠ The
                # paragraph above says the interrupted phase "did not `fail`
                # (nothing went wrong) and was not `skipped` (it ran)" — that is
                # TRUE OF A USER STOP AND FALSE OF A CRASH, and this handler
                # catches both (its own comment three screens up says so: "a
                # crash escapes the same way"). As first shipped the write was
                # UNCONDITIONAL, so a phase that failed for a real reason was
                # persisted as `cancelled` and rendered "Stopped by you" on the
                # canvas — under a `workflow_runs` row the producer's terminal
                # classifier writes as `failed`. A persisted, user-visible false
                # statement, produced by the fix for user-visible false
                # statements. So the escape is CAPTURED and inspected.
                #
                # ⚠ AND THE CRASH ARM DELIBERATELY WRITES NOTHING — writing
                # `failed` here was OFFERED AND REJECTED. This module's header
                # states the shipped contract verbatim: "A phase whose execution
                # raises mid-work is left ``active`` (never ``completed``) so a
                # later sweep re-runs it — the crash-leaves-active resume
                # contract" (:15-16). A terminal write on the crash path would
                # repeal that contract from inside a cancel fix. Leaving the row
                # `active` is not an omission, it is that contract's own answer,
                # and it is exactly what shipped for a year before 194.
                # ⚠ The residual it leaves is named rather than hidden: an
                # `active` phase row under a run that ends `failed`. That is
                # PRE-EXISTING and inherited, not introduced here; closing it
                # means giving the crash path its own honest status, which is a
                # vocabulary decision (a seventh literal / a migration), not a
                # line of this arm.
                if isinstance(_escape, asyncio.CancelledError):
                    try:
                        await asyncio.shield(cancel_phase(pool, phase_id))
                    except BaseException:  # noqa: BLE001 — second cancel mid-cleanup
                        logger.exception(
                            "interrupted-phase terminalize failed on cancel/escape "
                            "for run %s phase %s",
                            run_id,
                            phase_id,
                        )
            raise

        # ── pause_run: a human gate elapsed unanswered (200 / D-10) ─────────────
        #
        # ⚠ THIS ARM IS DEFINED AS MUCH BY WHAT IT MUST **NOT** DO AS BY WHAT IT DOES,
        # and each prohibition was measured rather than reasoned about:
        #
        #   1. It must NOT raise ``asyncio.CancelledError``. The escape handler above
        #      then calls ``_expire_pending_ask_user`` — killing the very prompt the
        #      person is meant to answer — and ``cancel_phase``, flipping the step to
        #      ``cancelled``. *A paused run whose spine shows the human step as Stopped*
        #      is the warning sign. (That is why the pause arrives as a PhaseOutcome.)
        #   2. It must NOT call ``finish_run``. ``finish_run`` clears
        #      ``threads.active_workflow_run_id`` in the same transaction (092 SC#2), and
        #      ``find_resumable_runs`` REQUIRES that anchor — the run would become
        #      permanently unresumable and the boot sweep would find nothing, forever.
        #   3. It must NOT leave the phase ``completed`` — ``find_resumable_runs`` also
        #      requires an ``active`` phase row. So this arm writes NO ``workflow_phases``
        #      row at all: ``mark_phase_active`` already set it and it simply stays there.
        #      The absence of a phase write IS the mechanism, which is why there is
        #      nothing here to read as an omission.
        #
        # WRITE-before-EMIT, as everywhere in this loop: the durable ``paused`` flip and
        # the audit row land before the frame, so nothing announces a fact the database
        # does not yet carry. The prompt is deliberately left PENDING — /pending keeps
        # serving it, and it is what the person comes back to.
        #
        # ⚠ THE AUDIT ROW REUSES ``policy_applied`` AND DOES **NOT** ADD A 25TH KIND —
        # a deliberate deviation from the plan, which specified a dedicated run-paused
        # audit kind. Taken on measurement. ``_AUDIT_EVENT_TYPES`` (``db/workflows.py:230``) must stay in
        # LOCKSTEP with the ``harness_audit.event_type`` Postgres CHECK, and
        # ``tests/unit/test_audit_event_registration.py`` pins the two EQUAL in both
        # directions — so a new kind is a MIGRATION (122) plus a live-DB apply, and this
        # plan ships none (121 belongs to ``200-02``, which runs alone against real
        # Postgres). Registering the kind in code alone would MOVE the failure from a
        # ValueError to a Postgres 23514 mid-run, which is precisely what that set exists
        # to prevent (BUG-260731-02). ``policy_applied`` is the recorded precedent for
        # this exact situation (Phase 196: *"No 25th harness_audit kind was added and no
        # migration ships"*), and it is honest here: D-10 IS a policy — an unanswered
        # gate never approves. ``policy`` names it explicitly so the row is unambiguous
        # in the ledger and a later migration can promote it without re-deriving intent.
        #
        # ⚠ AND THE PARAGRAPH ABOVE DELIBERATELY DOES NOT SPELL THE KIND IT DECLINES TO
        # ADD. ``tests/unit/test_audit_event_registration.py``'s G1 extractor scans this
        # module's SOURCE — comments included — for ``event_type=`` literals, so writing
        # the rejected kind out as a keyword argument, even inside a comment explaining
        # why it was rejected, turns that guard RED. Measured here, not reasoned about:
        # the first draft of this comment did exactly that and G1 named this file. It is
        # the ``PhaseFormPanel.test.tsx`` trap (RESEARCH Pitfall 6), on the backend.
        if outcome.kind == "pause_run":
            await pause_run(pool, run_id)
            await write_audit(
                pool, run_id, user_id=_audit_user_id,
                event_type="policy_applied",
                metadata={
                    "policy": "human_gate_pause",
                    "phase": phase.slug,
                    "reason": outcome.reason,
                },
            )
            await _emit(redis, stream_run_id, "run_paused",
                phase=phase.slug, reason=outcome.reason,
            )
            return  # stop — resumable, not terminal

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
                    pool, getattr(ctx, "thread_id", None), run_id,
                    org_id=getattr(ctx, "org_id", None),
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
                        pool, getattr(ctx, "thread_id", None), run_id,
                        org_id=getattr(ctx, "org_id", None),
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
        # Phase 189 (CONN-01 / D-05) — THE THIRD BRANCH, same mechanism, one over.
        # An ``external_action`` phase that a human APPROVED returns a normal output
        # dict carrying ``phase_types.RECORDED_INTENT_KEY``: it RECORDED the action it
        # would have taken and SENT NOTHING (SC#4 — nothing leaves this app in 189).
        #
        # WHY THE BRANCH EXISTS. Without it the row reads ``completed``, and
        # ``completed`` means the send happened. That is precisely the lie D-08 declined
        # to ship when it rejected deriving the honest word at render while the COLUMN
        # stayed ``completed`` — anything querying ``workflow_phases`` directly (the
        # status-repair scripts, the operator ledger, a future 190 reconciliation) would
        # read a successful send forever. The status is its own persisted word,
        # ``recorded_not_sent`` (migration 115 / D-17: the column stores the SLUG; the
        # sentence a person reads is rendered by the client's vocabulary layer).
        #
        # THE KEY IS IMPORTED, NEVER RE-TYPED. ``RECORDED_INTENT_KEY`` is exported by
        # the producer (``harness/phase_types.py``) exactly so the two ends of this seam
        # cannot drift on a bare string literal.
        #
        # A LITERAL NO-OP ON THE SHARED PATH. A Deep success output has no sentinel key,
        # so this branch cannot see it — the same additive + harness-only property the
        # emit-failure branch above states, and the red line (D-14) this phase inherits.
        #
        # PLACEMENT IS WHAT MAKES "THE RUN CONTINUES" TRUE (D-05). This branch sits
        # INSIDE the same if/else, after the ``outcome.kind`` checks have passed, and
        # that block falls through to the unconditional ``advance_current_phase`` just
        # below — the ``fail_run`` and ``skip_to`` branches return/continue out of the
        # loop long before here. A branch that returned instead would be "skip the
        # step", the fail-open shape Phase 188 spent two plans closing, and it would make
        # the arming decorative. The ORDER matters too: the failure sentinel keeps
        # precedence, because a recorded intent that ALSO carries a failure is a failure.
        # Lazy import (breaks the harness-package import cycle — the same rule the
        # ``run_gates`` import above follows; ``phase_types`` pulls the provider
        # services in, and nothing here may reach them at module import time).
        from app.services.harness.phase_types import RECORDED_INTENT_KEY

        _recorded_intent = (
            output.get(RECORDED_INTENT_KEY) if isinstance(output, dict) else None
        )
        # 200 (D-05): bound BEFORE the branch, not only inside it. The completion frame
        # further down sits in the `else` of a SECOND if/elif/else whose conditions mirror
        # this one, so the two agree today — but they are two chains, and a later edit to
        # either would make this an UnboundLocalError at emit time on a path that used to
        # work. None is also the honest value on the two arms that skip complete_phase.
        phase_completed_at = None
        if _emit_failure:
            # 101.1 review WR-02: persist the FULL failure output (incl. the cited
            # field_map states b/c/d carry) on the phase row — fail_phase merges it
            # under _failure_reason, so the extracted data survives durably (D-08).
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
        elif _recorded_intent:
            await record_phase_not_sent(pool, phase_id, durable_output)
        else:
            phase_completed_at = await complete_phase(pool, phase_id, durable_output)
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
        elif _recorded_intent:
            # 189 (T-189-31) — THE RECEIPT QUESTION, ANSWERED: a phase that RECORDED
            # rather than completed gets NO ``phase_completed`` receipt. This is a
            # DECISION, not an omission. Phase 107 / GOV-02 reads harness_audit rows as
            # receipts, and a completion receipt here would tell the ledger the step
            # completed — the ``consequence is not receipt`` rule the Control Room binds
            # this codebase to, and the same reasoning D-09 used when it declined to add
            # a new event type at all (a NEW kind needs a CHECK migration PLUS the
            # Python literal set in ``db/workflows.py``; the shipped
            # ``action_risk_pending`` row already records that a human was asked and
            # approved, and the receipt for the recorded INTENT is Phase 190's, when it
            # would describe a real consequence).
            #
            # The row that IS written rides the EXISTING ``phase_transition`` kind —
            # the same choice the emit-failure branch above made for the same reason —
            # so the ledger records the phase's TRUE terminal without inventing
            # vocabulary. ``via`` names the status, never a rendered sentence (D-17).
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_transition",
                metadata={
                    "phase": phase.slug,
                    "phase_index": phase.phase_index,
                    "via": "recorded_not_sent",
                },
            )
            # ⚠ REVIEW FINDING CR-02 — THE "NO SSE" DECISION IS REVERSED HERE, and the
            # paragraph that stood in its place is kept below because being wrong for a
            # stated reason is worth reading. It said: emitting ``phase_completed`` would
            # paint the exact lie this branch prevents (TRUE, and still true — that event
            # is NOT what is emitted); a new event would need a client handler and no plan
            # in this phase built one (TRUE at the time); the client's honest reading comes
            # from ``phaseStatusFromDb`` on reconcile (TRUE — but only on RECONNECT).
            #
            # WHAT IT MISSED: emitting NOTHING does not leave the card unresolved, it
            # leaves it ``running`` — and TWO store sweeps then upgrade ``running`` to
            # ``done`` all on their own. ``finalizeEarlierPhasesForThread`` fires from
            # ``onPhaseStarted`` when the NEXT phase goes live, so any external-action step
            # that is not the last phase is repainted "✓ Complete" MID-RUN, within
            # milliseconds; ``finalizeAllPhasesForThread`` fires from ``onRunCompleted``
            # and catches the last-phase case. The live surface then announces
            # "Phase N of M, notify, complete" to a screen reader and prints ✓ Complete on
            # the card, while a RELOAD of the same run shows "Not sent" — the live view and
            # the reload disagreeing about whether work happened is exactly the failure
            # shape SPEC Req 4 forbids, on the one step in the product whose entire reason
            # for existing is that it did not complete.
            #
            # The sweeps must not be able to INVENT a terminal they were never told, so the
            # producer tells them. ``phase_recorded_not_sent`` is ADDITIVE and inert for any
            # older client (``api.ts`` dispatches on an else-if chain; an unmatched type
            # falls through and only advances the cursor). It is NOT a new audit kind — the
            # receipt argument above is untouched and no CHECK migration is implied; this is
            # wire-only, and the client maps it onto ``"recorded-not-sent"``, a
            # ``Phase["status"]`` member that ALREADY has its ``STATUS_META`` row, its
            # ``canvasReading`` arm and its ``milestoneFor`` sentence. Every consumer was
            # already built; only the event was missing.
            await _emit(redis, stream_run_id,
                "phase_recorded_not_sent",
                phase=phase.slug,
                phase_index=phase.phase_index,
            )
        else:
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_completed",
                metadata={"phase": phase.slug, "phase_index": phase.phase_index},
            )
            _count, _noun = declared_phase_measure(output)
            await _emit(redis, stream_run_id,
                "phase_completed",
                phase=phase.slug,
                phase_index=phase.phase_index,
                # 200 (D-05) — the terminal instant, as the ROW carries it. `None` when
                # `complete_phase`'s `IS DISTINCT FROM 'cancelled'` fence refused the
                # write (a Stop already cancelled this phase — the L-01 residue): the
                # step was never completed, so no completion time is announced for it.
                completed_at=_iso(phase_completed_at),
                # 200 (D-07) — the DECLARED per-step count, read from the executor's own
                # output. ⚠ BOTH KEYS ARE ALWAYS PRESENT ON THE FRAME and carry `null`
                # for the four phase types that declare nothing, because a wire frame's
                # shape is fixed while the JSONB row's is not. `null` means "this type
                # declares no count"; `0` means "measured, and it was zero". The client
                # must branch on the two, never coalesce with `?? 0`.
                step_count=_count,
                step_noun=_noun,
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
        # ── Phase 204 (SCHED-02) — "IMMEDIATELY", THE SECOND HALF ─────────────
        #
        # ⚠ THE BOUNDARY CHECK ALONE WOULD LET THE *LAST* PHASE'S BREACH GO UNRECORDED.
        # A run whose final phase blows the budget never reaches another boundary — it
        # falls out of the loop into the success terminal and reports ``completed``. No
        # further money is at risk there, but the run still overspent, and a breach with
        # no trip record is precisely the *audit evasion* threat: the ledger would show a
        # clean completion for a run that exceeded its cap. must_have truth 2 says
        # "immediately", and this is the site that makes that word true.
        #
        # ⚠ SITED AFTER THE TRANSITION WRITES, NOT BEFORE. The phase genuinely completed
        # and its durable output, audit row and SSE frame are facts; the trip must not
        # retro-actively suppress them. What it stops is the NEXT phase — and, on the last
        # iteration, the false ``completed``.
        await _enforce_budget("phase_completed")
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
    # supabase to thread. Source the SERVICE-ROLE client for the resumed run. Without
    # ctx.supabase a resumed phase's search_documents hits ctx.supabase.rpc → None
    # AttributeError (the exact F5 crash). THREAT: the service-role client bypasses
    # RLS, so retrieval MUST stay owner-scoped — search_documents filters by
    # current_user["id"], which we set below from run["user_id"] (the durable
    # run-owner), so a resumed search can never read another user's documents.
    #
    # Phase 163 (D-05 / T-163-05b): the client is built via get_service_role_supabase(org_id)
    # — the org-requiring wrapper that REFUSES to construct a BYPASSRLS client without an
    # explicit org — instead of a bare, org-less service-role singleton, so no org-less
    # service-role client survives on this async-writer path. The org is the resumed run's OWN org
    # (workflow_runs.org_id, backfilled post-162): carried on the run dict when
    # find_resumable_runs selected it, else read here by run id. The BYPASSRLS + owner-scope
    # posture is otherwise unchanged.
    from app.dependencies import get_service_role_supabase
    _org_id = run.get("org_id")
    if _org_id is None:
        try:
            _org_id = await pool.fetchval(
                "SELECT org_id FROM workflow_runs WHERE id = $1",
                run["run_id"] if isinstance(run["run_id"], UUID) else UUID(str(run["run_id"])),
            )
        except Exception:  # noqa: BLE001 — org resolution is best-effort
            logger.debug(
                "resume: org_id read failed for run %s", run.get("run_id"), exc_info=True
            )
            _org_id = None
    _service_supabase = get_service_role_supabase(_org_id)

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
        # Phase 163 (D-05): the resumed run's org, so the terminal ask_user-expiry
        # cleanup (and any org-aware helper reading off ctx) widens to org-scope.
        org_id=_org_id,
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
      2b. Phase 185 (L-7): an ARMED action-risk step parked on its pre-gate is NOT
         an ``llm_human_input`` phase (its stored config type is ``llm_agent`` and it
         has no stored output), so step 2 never sees it. It gets its own branch,
         keyed on the loaded definition, which re-subscribes the SAME
         ``tool_call_id`` with NO timeout — the person keeps the card they were
         already looking at, and the wait stays indefinite across the restart.
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

        # 2b. Phase 185 (GOVERN-03 / RESEARCH L-7) — the ARMED action-risk branch.
        #     Runs AFTER the definition load because the arming is only legible on the
        #     parsed definition (see ``_is_armed_action_risk``); step 2's branch above
        #     and the load above it are untouched.
        #
        #     FIX (a), CHOSEN DELIBERATELY: re-subscribe the SAME ``tool_call_id``
        #     rather than expire-then-re-ask. G-4 scenario 3's stated failure is "the
        #     prompt survived but is UNREACHABLE" — and re-asking with a new id IS that
        #     failure from the person's chair: the card they are looking at (and that
        #     ``/pending`` serves) stops being the one the run is listening to, while a
        #     graceful shutdown leaves the old row un-expired (``run_workflow``'s escape
        #     handler skips ``_expire_pending_ask_user`` when ``is_app_shutting_down()``
        #     — the 096-09 fix). Preserving the id means exactly ONE live prompt per
        #     armed pause, and the answer lands on the channel the person can see.
        #
        #     ``timeout_seconds=None``: the wait was indefinite before the restart and
        #     must still be after it, or a restart would quietly re-introduce the expiry
        #     that reads as "yes" (SPEC Req 9).
        if active is not None and not _is_llm_human_input(active) \
                and _is_armed_action_risk(active, definition):
            pending = await get_pending_ask_user(pool, run_id)
            _tcid = (pending or {}).get("tool_call_id")
            if _tcid:
                if not await ask_user_response_exists(pool, run_id, _tcid):
                    await resume_pending_prompt(
                        redis,
                        run_id,
                        _tcid,
                        (pending.get("prompt") or ""),
                        (pending.get("options") or []),
                        None,   # indefinite — never a restart-introduced deadline
                    )
                # answered → fall through; the re-drive re-runs the phase.
            # No durable prompt row (a crash BEFORE the insert) → fall through to the
            # ordinary re-drive unchanged: the pre-gate re-attaches and re-asks. Either
            # way the run does not advance without an answer.

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
                    # METER-05 site 3 (Phase 256 / D-256-08). This shell used to hardcode
                    # a NULL usage, so EVERY resumed run's segment read as "never
                    # measured" even when the box on ctx had been measuring it all along.
                    # ⚠ GRAIN (D-256-03): the box carries THIS SEGMENT's spend and this is
                    # a per-segment ``runs`` row, so segment-onto-segment is correct here.
                    # ⛔ The cumulative ``workflow_runs`` figure is NOT written from this
                    # site — ``persist_run_usage`` owns it, at the phase boundary.
                    # ⛔ ``.get()`` with NO default and NO ``or 0``: an absent key stays
                    # ``None`` all the way to the column, because NULL means never
                    # measured and 0 means measured as zero (D-256-06).
                    _box = getattr(ctx, "run_usage_box", None) or {}
                    _in_tok = _box.get("input_tokens")
                    _out_tok = _box.get("output_tokens")
                    if _in_tok is None and _out_tok is None:
                        # The warning CONTRACT from db/runs.py:93-99, honoured here.
                        # IDENTIFIERS ONLY — never token values (T-073-04 / T-256-07).
                        logger.warning(
                            "runs.usage missing for run=%s provider=%s model=%s",
                            _pid,
                            getattr(ctx, "provider", None),
                            getattr(ctx, "model", None),
                        )
                    await finalize_run(
                        pool,
                        run_id=_pid,
                        status="failed" if _redrive_failed else "completed",
                        error="resume re-drive failed" if _redrive_failed else None,
                        completed_at=datetime.now(timezone.utc),
                        message_id=None,
                        input_tokens=_in_tok,
                        output_tokens=_out_tok,
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
                    pool, run.get("thread_id"), run_id,
                    org_id=getattr(ctx, "org_id", None),
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


def _is_armed_action_risk(active_phase: dict, definition) -> bool:
    """True if the active phase row is an ARMED action-risk step (Phase 185 / L-7).

    WHY THE STORED CONFIG CANNOT ANSWER THIS. ``_is_llm_human_input`` reads the
    ``workflow_phases`` row, which is the right source for the question IT asks. It
    cannot answer this one: an armed step's stored ``config.phase_type`` is
    ``llm_agent`` (arming is a VALIDATOR the engine synthesizes at the run seam, never
    a step — D-185-12/18), and its ``output`` is ``None`` because the phase never
    completed. So the row looks exactly like any other mid-flight agent step, and the
    only place the arming is legible is the parsed ``WorkflowDefinition``.

    The two predicates are INDEPENDENT and deliberately kept so: this one is a second
    named reading beside ``_is_llm_human_input``, not a widening of it. Returns False
    for anything without a matching ``PhaseSpec`` — a definition that no longer carries
    the slug falls through to the ordinary re-drive, which is fail-closed either way.
    """
    slug = active_phase.get("slug")
    if not slug or definition is None:
        return False
    for spec in getattr(definition, "phases", None) or []:
        if getattr(spec, "slug", None) == slug:
            return bool(getattr(spec, "action_risk_armed", False))
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
