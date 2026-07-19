import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
# WR-01 fix: removed dead imports `AsyncGenerator` and `EventSourceResponse`
# left over from the legacy SSE-on-POST path (deleted in D-063-01).
import openai
from openai import APIError
# Phase 075.5 T-260523-05 — catch native provider errors too, not only OpenAI.
# Without these, Anthropic BadRequestError (billing, etc.) and Google native
# errors fell through to the broad Exception handler and surfaced as the
# generic "An unexpected error occurred" message, with no actionable hint.
import anthropic
from google.genai import errors as google_errors
try:
    from anthropic import APIError as AnthropicAPIError
except ImportError:
    AnthropicAPIError = Exception  # fallback if SDK not installed
from supabase import Client

from app.dependencies import get_current_user, get_supabase, get_redis
import redis.asyncio as aioredis
# Phase 075 D-075-04: RedisError for the /snapshot endpoint's xinfo_stream
# probe → 503+Retry-After:10 fallback (mirrors runs.py:354-370 pattern).
# 101.1-08 (gap 4): ResponseError ('no such key') distinguishes a GC'd terminal-run
# buffer (degrade — skip that cursor) from a genuine outage (503). ResponseError is a
# RedisError subclass, so the specific branch is handled BEFORE the broad except.
from redis.exceptions import RedisError, ResponseError
from app.models.message import MessageCreate, MessageResponse
from app.models.run import ActiveRunResponse
from app.models.thread import ThreadCreate, ThreadResponse, ThreadSnapshotResponse, ThreadUpdate
from app.services.audit_service import write_audit_entry
from app.utils.db import aexec
from app.dependencies import get_pg_pool
from app.db.runs import finalize_run, insert_assistant_message
# Phase 145-03 (D-145-09) — the atomic run-lifecycle owner (Plan 02). The chat-run
# START register + every TRUE terminal route through these co-writers so
# runs.status and its runs:active/runs_by_thread mirrors move in ONE unit and can
# never drift (BUG-260709-01 / 145-REPRO Direction B). The SSE transport
# (sentinel XADD / EXPIRE / get_snapshot / RUN_TASKS) stays in this file.
from app.services.run_lifecycle import register_run_start, finalize_run_terminal
# Phase 162.5 Plan 01 (D-A2 / D-A4) — the title subsystem extracted to a leaf module.
# Re-imported at module scope so every existing patch("app.api.threads.generate_thread_title")
# still intercepts, and send_message injects this module-global into maybe_autotitle_thread
# (title_fn=generate_thread_title, emit=_emit) — behavior byte-identical.
from app.services.thread_title import generate_thread_title, maybe_autotitle_thread
# Phase 162.5 Plan 01 (D-A2 / D-A4) — the disabled-model fallback + provider-resolution
# transform extracted to a leaf module. Re-imported at module scope so test_149's
# `from app.api.threads import _resolve_enabled_model` + threads_mod._reresolve_fallback_provider
# / _apply_fallback_to_request still resolve; send_message calls resolve_run_model. The moved
# bodies resolve load_all_model_overrides / get_model_capability_async / override_provider LATE
# off this module (kept imported below), so patch("app.api.threads.*") still intercepts.
from app.services.run_model_resolution import (
    _resolve_enabled_model,
    _reresolve_fallback_provider,
    _apply_fallback_to_request,
    resolve_run_model,
)
# Phase 162.5 Plan 02 (D-A2 / D-A4) — the workflow-kickoff machinery extracted to a
# service module. Re-imported at module scope so `from app.api.threads import
# _ensure_skill_snapshots` (test_099) still resolves + send_message calls the seam.
# The moved bodies late-import workflows_enabled / get_pg_pool FROM this module so
# patch("app.api.threads.workflows_enabled") (test_147) + the app.api.threads.get_pg_pool
# patch (test_dual_mode_wiring) still intercept (D-A4). Behavior byte-identical.
from app.services.workflow_kickoff import (
    _ensure_skill_snapshots,
    preflight_workflow_kickoff,
)
# Phase 092 (MODE-01): the net-new run-creation + picker-feed helpers. db-layer
# imports are cycle-safe (db/workflows.py imports only models). run_workflow +
# _load_run_definition are imported LOCALLY inside the producer branch to keep
# the heavier service graph (agent_loop/tool_dispatcher) off the module-load path.
from app.db.workflows import create_workflow_run, list_published_workflows
from app.models.thread import ThreadWorkflowState, WorkflowPhaseState
from app.utils.folder_utils import fetch_visible_folders
from app.services.harness.scope import resolve_project_subtree, assert_folder_scopes_subset, resolve_run_scope_root
# 099 WFSKILL-01: imported as a MODULE (not bound names) so the kickoff helper calls
# validate_skill_refs / materialize_skill_snapshots_if_needed through the module
# object — keeps the seam patchable + the hot file free of inline gate/copy logic (G-5).
from app.services.harness import skill_snapshot as _skill_snapshot
from app.models.user_settings import (
    load_all_model_overrides,
    load_user_settings,
    override_provider,
    workflows_enabled,
)
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS, get_model_capability, get_model_capability_async, get_per_call_timeout_async
from app.services.openai_service import create_adaptive_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT, _uses_max_completion_tokens, CallingMode, get_tools, resolve_calling_mode, normalize_finish_reason
from app.services.anthropic_service import stream_anthropic
from app.services.google_service import stream_google  # Phase 075.5 D-075.5-01 — native Google Gen AI SDK path
from app.services.tool_parser import parse_structured_tool_calls, ToolCall
from app.services.tool_dispatcher import ToolContext, ToolResult, dispatch_tool
# Phase 089 Plan 01 (G-5 extraction): the three pure stream-drain / null-strip
# helpers moved verbatim to agent_loop.py. Re-imported here so the still-in-place
# agent_runner callers (drain loops + the persist functions that call _strip_nul)
# resolve them until the loop body itself moves in Plan 03. `t.drain_step is
# a.drain_step` holds — one definition, no duplicate.
#
# Phase 089 Plan 03 (THE verbatim move): run_agent_loop now owns the loop body.
# The loop-body module-level helpers + _reconstruct_history MOVED to agent_loop.py
# (re-imported here for backward-compat — existing `from app.api.threads import
# _compute_confidence`/`SYSTEM_PROMPT`/`_reconstruct_history`/etc. call sites + test
# imports keep resolving; one definition, no duplicate). run_agent_loop is imported
# and called by agent_runner; the _terminal_status classifier + _shielded_finalize
# STAY here (producer-shell concern).
from app.services.agent_loop import (
    drain_step,
    _drain_stream_with_close_on_cancel,
    _strip_nul,
    run_agent_loop,
    RunContext,
    AgentLoopResult,
    _is_transient_provider_error,
    SYSTEM_PROMPT,
    TOOL_USAGE_INSTRUCTIONS,
    _format_tool_list,
    CONFIDENCE_DISCLAIMER,
    _compute_confidence,
    _deduplicate_citations,
    _reconstruct_history,
)

# Sandbox import — always available at module scope so per-request paths
# (e.g. line ~1328 where get_or_create runs without re-importing) cannot
# NameError when sandbox_enabled is False at startup but enabled per-user
# via user_settings.sandbox_enabled (see WR-03 review fix). The module
# itself has no side effects, so unconditional import is safe.
from app.services.sandbox_service import sandbox_manager  # noqa: E402
from app.services.context_window import trim_messages_to_fit, estimate_messages_tokens, resolve_context_budget

router = APIRouter(prefix="/threads", tags=["threads"])
logger = logging.getLogger(__name__)


# WR-05: retain strong references to fire-and-forget background tasks so the
# event loop does not garbage-collect them mid-execution (Python docs:
# asyncio.create_task only weakly references the returned task). Without a
# strong reference, audit-log and memory writes can be silently dropped with
# the warning "Task was destroyed but it is pending!". Tasks self-evict from
# the set via the done-callback so it never grows unbounded.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _spawn(coro) -> asyncio.Task:
    """Schedule a fire-and-forget coroutine and retain a strong reference."""
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t


# ── Phase 061: per-run producer-task registry (D-061-11, D-v2.5-08) ──────
# Module-level dict keyed by run_id. The route handler registers new
# producer tasks; the producer's finally pops itself; the lifespan close
# in main.py cancels all entries (Plan 01 — late-bound import). 062's
# DELETE /runs/{id} will look up the run_id here and call task.cancel().
# Single uvicorn worker (D-v2.5-02) means one registry per process — no
# cross-process coordination needed.
import uuid as _uuid_mod
from uuid import UUID  # Phase 062 D-062-04: typed path param for list_active_runs
RUN_TASKS: dict[_uuid_mod.UUID, asyncio.Task] = {}

# Terminal sentinel discriminator types (D-061-12). Consumer breaks when
# it XREADs an entry whose data.type is in this set.
# Phase 066 D-066-06: 5th SSE terminal type 'timed_out' — distinct wire-format
# value from 'error' so the frontend's onTerminal callback can route to a
# dedicated "Agent reached time limit" banner (D-066-10) and the Resume
# button gating extends to runStatus === 'timed_out' (D-066-09).
TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})

# D-061-09 runs.status enum → SSE TERMINAL_TYPES mapping. The runs table
# uses {"streaming","completed","failed","cancelled","timed_out"} per the
# migration CHECK constraint (035 + 038); the SSE wire uses TERMINAL_TYPES.
# The producer's finally must translate runs.status → wire type before
# calling _emit_terminal.
_RUN_STATUS_TO_TERMINAL_TYPE: dict[str, str] = {
    "completed": "done",
    "failed": "error",
    "cancelled": "cancelled",
    "timed_out": "timed_out",  # Phase 066 D-066-06 — system-timeout sentinel
}


async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """One canonical XADD shape for all producer-side events (D-061-10).

    Wire format byte-identical to 059's queue payload: single-field
    `data` containing JSON-encoded {type, **fields}. MAXLEN ~ 10000 caps
    per-run buffer at ~2MB (typical run emits <500 events). The terminal
    sentinel XADD goes through _emit_terminal() instead so it's exempt
    from MAXLEN trimming (Pitfall 5).
    """
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )


async def _emit_terminal(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """Terminal sentinel XADD — exempt from MAXLEN trimming (Pitfall 5).

    type MUST be in TERMINAL_TYPES. Called inside the producer's shielded
    finalizer BEFORE EXPIRE — Pitfall 2 ordering rule.
    """
    # WR-03: explicit raise (not assert) — assertions are stripped under `python -O`.
    if type not in TERMINAL_TYPES:
        raise ValueError(
            f"_emit_terminal type must be in TERMINAL_TYPES, got {type!r}"
        )
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
    )


# Phase 162.5 Plan 01 (G-5 leaf extraction): the disabled-model fallback + provider-resolution
# helpers — _resolve_enabled_model, _reresolve_fallback_provider, _apply_fallback_to_request —
# MOVED VERBATIM to app.services.run_model_resolution and re-imported at the top of this module
# (one canonical copy, no duplicate). They stay patchable/importable as app.api.threads.* via
# that re-import; their moved bodies resolve load_all_model_overrides / get_model_capability_async
# / override_provider LATE off this module (still imported above) so those patches still apply.
# The inline model/provider resolution block (below, in send_message) moved with them into
# run_model_resolution.resolve_run_model.


# Phase 089 Plan 03 (G-5 verbatim move): _is_transient_provider_error,
# SYSTEM_PROMPT, TOOL_USAGE_INSTRUCTIONS, _format_tool_list, CONFIDENCE_DISCLAIMER,
# _compute_confidence, _deduplicate_citations MOVED verbatim to
# app.services.agent_loop and are re-imported at the top of this module (see the
# agent_loop import block). Definitions removed here to keep one canonical copy (no
# duplicate). _reconstruct_history (further down) moved with them.
# Phase 092.5 Wave 4 (D-04): _accumulate_chunk_usage moved AGAIN — from agent_loop
# into app.services.provider_gateway.openai_compat (the OpenAI-compat adapter owns
# the provider-aware usage helper now); no longer re-exported through threads.py.


# Phase 063 (D-063-01): the module-level `event_consumer` async generator that
# previously lived here was DELETED in the hard cutover. POST /threads/{tid}/messages
# no longer returns SSE; the live equivalent for GET /runs/{rid}/stream is
# `replay_tail_consumer` in `app.api.runs`. See 063-CONTEXT.md decision D-063-01
# and the ROADMAP risk note "Don't keep two streaming code paths longer than one phase".


@router.get("", response_model=list[ThreadResponse])
async def list_threads(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # BUG-260702-01 / Phase 134.1 (mig 082): exclude eval-execution threads (is_eval=true).
    # They are pure agent-loop exhaust — the eval's user-visible outputs live in eval_results +
    # the eval panel, so they must never appear in the chat sidebar. ADDITIVE narrowing filter on
    # this G-5 hot file: it only SHRINKS the result set for the same user (no widened rows, no
    # IDOR); real chat threads default is_eval=false and are unaffected.
    response = (
        supabase.table("threads")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_eval", False)
        .order("updated_at", desc=True)
        .execute()
    )
    return response.data


# Phase 062 (D-062-02, D-062-03, D-062-04, D-062-12, D-062-14, T-062-01).
# Phase 075 D-075-03: shared runs-FK merge helper for /messages and /snapshot.
# Extracted verbatim from the inline merge that lived in get_messages
# (threads.py:795-816 pre-extraction). Both callers MUST pass kwargs — the
# leading `*` enforces keyword-only args so positional-arg confusion can't
# regress the call sites (RESEARCH Pitfall 4). T-063.1-01 (cross-user
# 404-before-runs-SELECT) and T-063.1-04 (no extra fields beyond run_id +
# run_status) carry verbatim — the SELECT below still enumerates
# "run_id, message_id, status" only.
async def _enrich_messages_with_runs(
    messages: list[dict],
    *,
    thread_id: str,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """D-075-03: shared runs-FK merge for /messages and /snapshot.

    Extracted verbatim from threads.py:795-816 (Phase 063.1 D-063.1-13 /
    Gap-002 / WR-01). Mutates `messages` in place and returns the same list
    for caller-side fluent composition.

    Both queries hit existing indexes — messages: thread_id; runs:
    idx_runs_history on (user_id, thread_id, started_at DESC) per migration
    035 line 44. Result-set sizes are bounded by thread length.

    WR-01 carry-forward: order by started_at DESC and prefer the FIRST run
    per message_id. public.runs.message_id has no UNIQUE constraint
    (migration 035 line 24 — only an FK with ON DELETE SET NULL), so in
    rare collision cases (buffer-expired retries, partial failure paths,
    producer races) multiple runs can share message_id. With DESC +
    first-wins-and-skip, the most recently started run wins deterministically
    — the one whose status is most likely to drive the correct Resume UX.

    Defense-in-depth: .eq("user_id", ...) alongside RLS policy
    runs_select_own (migration 035 lines 47-49). Mirrors list_active_runs
    at threads.py:543-551 (D-062-12).
    """
    # Phase 095.1-03 (D-04/D-05): ADDITIVE-SELECT-ONLY on this G-5 hot file.
    # The SELECT gains 4 COLUMNS (model, provider, started_at, completed_at) so
    # the run-sub can show `{provider} · {model} · turn N` (D-04 model
    # attribution) and the RunCard timer can derive the TRUE duration
    # completed_at − started_at (D-05). The WHERE clause is UNCHANGED
    # (.eq thread_id + .eq user_id + RLS runs_select_own) → no widened row set,
    # no IDOR (T-095.1-03-02). No migration, no new write — runs.model/provider
    # are NOT NULL and started_at DEFAULTs now(); completed_at is written on
    # finalize. Flows to BOTH /messages and /snapshot (shared helper).
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, message_id, status, model, provider, started_at, completed_at")
        .eq("thread_id", thread_id)
        .eq("user_id", user_id)
        .order("started_at", desc=True)
    )
    runs_by_message: dict[str, dict] = {}
    for r in (runs_resp.data or []):
        mid = r.get("message_id")
        if mid is None or mid in runs_by_message:
            continue  # keep the first (most recent) per message_id
        runs_by_message[mid] = r

    # Zip — assistant rows with FK matches get run_id/run_status populated;
    # user rows and pre-run-backed assistant rows return null (Resume button
    # only renders when runStatus === "failed", so null is the correct
    # "no Resume" signal).
    for m in messages:
        run = runs_by_message.get(m["id"])
        m["run_id"] = run["run_id"] if run else None
        m["run_status"] = run["status"] if run else None
        # Phase 095.1-03 (D-04/D-05): additive stamps. A message with no matched
        # run (legacy / pre-run-backed) gets None for all 4 — graceful, never a
        # fabricated value (the honesty rule).
        m["model"] = run["model"] if run else None
        m["provider"] = run["provider"] if run else None
        m["started_at"] = run["started_at"] if run else None
        m["completed_at"] = run["completed_at"] if run else None

    return messages


# Surface the durable per-run lifecycle table as a streaming-only filter.
# Lives in threads.py (under the /threads prefix) per D-062-14; the other
# two 062 endpoints (GET /runs/{id}/stream + DELETE /runs/{id}) live in
# the new app/api/runs.py module to minimize merge conflicts with any
# parallel work in threads.py's event_consumer / agent_runner / send_message.
@router.get("/{thread_id}/active-runs", response_model=list[ActiveRunResponse])
async def list_active_runs(
    thread_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Ownership check — mirror runs.py stream_run / cancel_run pattern. 404
    # (NOT 403) per D-062-12 so we don't leak thread existence to other users
    # (T-062-01 mitigation).
    # CR-01 fix: use .maybe_single() instead of .single(). PostgREST's .single()
    # raises APIError(code="PGRST116", HTTP 406) on no rows; the postgrest patch
    # in main.py only converts code="204" to _Empty, so PGRST116 would propagate
    # to the FastAPI default handler and surface as 500 — directly violating
    # D-062-12 / T-062-01. .maybe_single() returns None on no-row instead.
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", str(thread_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = thread_resp.data if thread_resp is not None else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # D-062-02: streaming-only filter. Uses the partial index idx_runs_active
    # shipped in supabase/migrations/035_runs_table.sql (lines 38-40) — the
    # WHERE status='streaming' partial keeps the index physically tiny.
    # Discretion: ORDER BY started_at DESC for deterministic ordering under
    # concurrent INSERTs; otherwise insertion order is undefined.
    # D-062-12: defense-in-depth alongside RLS policy runs_select_own
    # (migration 035 lines 47-49) — the .eq("user_id", ...) below ALSO
    # filters even though the service-role bypasses RLS.
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, started_at, status")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .eq("status", "streaming")
        .order("started_at", desc=True)
    )
    return runs_resp.data or []


# Phase 075 D-075-01 / D-075-02 / D-075-03 / D-075-04: one-round-trip reconcile
# primitive. Replaces the frontend's 3-call cold-cache chain (getActiveRuns +
# loadMessages + per-run subscribeToRun?since=) with a single combined fetch.
# Auth posture mirrors GET /messages + GET /active-runs exactly:
#   - dual .eq("user_id") defense-in-depth alongside RLS (D-062-12)
#   - cross-user → 404 not 403 (T-062-01)
#   - maybe_single() not single() (CR-01 — avoids PGRST116 → 500 leak)
# Redis-down posture mirrors GET /runs/{rid}/stream:
#   - xinfo_stream wrapped in asyncio.wait_for(timeout=2.0) per active run
#   - RedisError / asyncio.TimeoutError / OSError → 503 + Retry-After: 10 (D-062-13)
@router.get("/{thread_id}/snapshot", response_model=ThreadSnapshotResponse)
async def get_snapshot(
    thread_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """D-075-01: one-round-trip reconcile primitive.

    Returns {messages, active_runs, since_cursors} so StreamsProvider.reconcile
    replaces its 3-call sequential chain with a single fetch.
    """
    # Step 1: ownership SELECT (CR-01: maybe_single, not single).
    # T-062-01 mitigation — this fires FIRST so cross-user requests 404 before
    # any messages/runs SELECT can leak data.
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", str(thread_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = thread_resp.data if thread_resp is not None else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Step 2: messages SELECT + D-075-03 helper merge.
    # BUG-260528-01: exclude role='system' rows (system_warning banners
    # persisted since migration 048 / Plan 075.4-03). MessageResponse.role is
    # Literal["user","assistant"], so serializing a system row raises
    # ResponseValidationError → 500 and the thread never loads. These rows are
    # an internal/forward-ref hook (Phase 082.5 error sink) with no frontend
    # renderer yet; the live SSE event was already the user-visible signal.
    msgs_resp = await aexec(
        supabase.table("messages")
        .select("*")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .neq("role", "system")
        .order("created_at")
    )
    messages = msgs_resp.data or []
    messages = await _enrich_messages_with_runs(
        messages,
        thread_id=str(thread_id),
        user_id=current_user["id"],
        supabase=supabase,
    )

    # Step 3: active_runs SELECT (mirror of /active-runs at threads.py:543-551).
    # Same defense-in-depth + status='streaming' partial-index filter.
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, started_at, status")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .eq("status", "streaming")
        .order("started_at", desc=True)
    )
    active_runs = runs_resp.data or []

    # Phase 075.1 Plan 04 (B-260519-02) — short-circuit when there are no
    # active runs to probe. The empty for-loop below is already a no-op, but
    # the explicit early-return locks in the intent: brand-new threads with
    # zero rows in `runs` MUST return 200 with empty since_cursors WITHOUT
    # touching Redis at all. Future refactors that add unconditional Redis
    # work in this branch (e.g. cleanup probes) would otherwise re-introduce
    # the 503-on-empty-thread regression UAT B-260519-02 observed.
    if not active_runs:
        return {
            "messages": messages,
            "active_runs": [],
            "since_cursors": {},
        }

    # Step 4: per-active-run since_cursors via xinfo_stream (D-075-01).
    # On any Redis failure (RedisError / TimeoutError / OSError), the entire
    # endpoint returns 503 + Retry-After: 10 — no partial/degraded shape
    # (D-075-04). The since_cursors field is contractually required when
    # active_runs is non-empty.
    since_cursors: dict[str, str] = {}
    for run in active_runs:
        rid = str(run["run_id"])
        try:
            info = await asyncio.wait_for(
                redis.xinfo_stream(f"run:{rid}"),
                timeout=2.0,
            )
        except ResponseError as e:
            # 101.1-08 (gap 4 backend): a GC'd run buffer raises
            # ResponseError('no such key') — that run is simply terminal, not a
            # Redis outage. Degrade to skipping its cursor (the DB reconcile is the
            # source of truth, D-v2.5-03) instead of 503-ing the whole snapshot. A
            # real connection-level RedisError still returns 503 below. A
            # non-missing-key ResponseError is still a real fault — re-raise it into
            # the broad handler's 503 path.
            if "no such key" in str(e).lower():
                # T-073-04 / D-074-03: identifier-only log (run id, no content).
                logger.debug(
                    "Snapshot skipping GC'd run buffer on GET /threads/%s/snapshot run=%s",
                    thread_id, rid,
                )
                continue
            logger.exception("Redis unreachable on GET /threads/%s/snapshot", thread_id)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": "Streaming infrastructure unavailable"},
                headers={"Retry-After": "10"},
            )
        except (RedisError, asyncio.TimeoutError, OSError):
            # T-073-04 / D-074-03: identifier-only log format string —
            # never log message/args content.
            logger.exception("Redis unreachable on GET /threads/%s/snapshot", thread_id)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": "Streaming infrastructure unavailable"},
                headers={"Retry-After": "10"},
            )
        first_entry = info.get("first-entry") if info else None
        if first_entry and len(first_entry) >= 1:
            cursor = first_entry[0]
            since_cursors[rid] = (
                cursor.decode() if isinstance(cursor, bytes) else cursor
            )
        else:
            since_cursors[rid] = "0"

    return {
        "messages": messages,
        "active_runs": active_runs,
        "since_cursors": since_cursors,
    }


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    background_tasks: BackgroundTasks,
    body: ThreadCreate = ThreadCreate(),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    insert_data: dict = {"user_id": current_user["id"], "title": body.title}
    if body.folder_id:
        insert_data["folder_id"] = str(body.folder_id)
    # BL-01 fix: wrap sync .execute() with aexec so the event loop is not blocked
    # (D-v2.5-01 / Phase 058 D-058-09 — cross-tab unblocking invariant).
    response = await aexec(supabase.table("threads").insert(insert_data))
    new_thread = response.data[0]
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="thread.create",
        metadata={"thread_id": new_thread["id"]},
        supabase=supabase,
    )
    return new_thread


@router.patch("/{thread_id}", response_model=ThreadResponse)
async def rename_thread(
    thread_id: str,
    body: ThreadUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # BL-01 fix: wrap sync .execute() with aexec (D-v2.5-01).
    await aexec(
        supabase.table("threads")
        .update({"title": body.title.strip() or "New Chat"})
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
    )
    result = await aexec(
        supabase.table("threads")
        .select("*")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return result.data


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Close sandbox session if sandbox is enabled (SAND-10).
    # sandbox_manager is imported unconditionally at module scope (WR-03);
    # we still gate the call on settings.sandbox_enabled to skip work when
    # the feature is off.
    if settings.sandbox_enabled:
        sandbox_manager.close_session(thread_id)

    # Clean up sandbox output files from storage before cascade deletes DB rows.
    # BL-01 fix: wrap sync .execute() with aexec (D-v2.5-01). The supabase.storage
    # call is also sync but is best-effort and only fires when there are files,
    # so we wrap it in run_in_threadpool too to keep the event loop responsive.
    try:
        exec_resp = await aexec(
            supabase.table("code_executions")
            .select("id")
            .eq("thread_id", thread_id)
            .eq("user_id", current_user["id"])
        )
        exec_rows = exec_resp.data or []
        if exec_rows:
            exec_ids = [r["id"] for r in exec_rows]
            file_resp = await aexec(
                supabase.table("sandbox_files")
                .select("storage_path")
                .in_("execution_id", exec_ids)
            )
            file_rows = file_resp.data or []
            if file_rows:
                # Phase 067.4 (D-067.4-R3-03): module-local re-import deleted; the
                # module-top import at threads.py:12 is now the single source.
                paths = [f["storage_path"] for f in file_rows]
                await run_in_threadpool(
                    supabase.storage.from_("sandbox-outputs").remove, paths
                )
    except Exception:
        pass  # Best-effort cleanup — don't block thread deletion

    # BL-01 fix: wrap sync .execute() with aexec (D-v2.5-01).
    await aexec(
        supabase.table("threads")
        .delete()
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
    )
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="thread.delete",
        metadata={"thread_id": thread_id},
        supabase=supabase,
    )


# Phase 162.5 Plan 01 (G-5 leaf extraction): the title subsystem — _SINGLE_MODEL_PROVIDERS,
# _strip_think_blocks, _derive_title_from_message, _clean_llm_title, generate_thread_title —
# MOVED VERBATIM to app.services.thread_title and re-imported at the top of this module
# (one canonical copy, no duplicate). generate_thread_title stays patchable as
# app.api.threads.generate_thread_title via that re-import. The inline auto-title emit block
# (below, in send_message) moved with them into thread_title.maybe_autotitle_thread.


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # BL-01 fix: wrap sync .execute() with aexec (D-v2.5-01).
    thread = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # 1. Fetch messages.
    # BUG-260528-01: exclude role='system' rows (system_warning banners,
    # migration 048 / Plan 075.4-03) — MessageResponse.role only allows
    # 'user'/'assistant', so a system row 500s this endpoint via
    # ResponseValidationError. Mirror of the filter in get_snapshot.
    msgs_resp = await aexec(
        supabase.table("messages")
        .select("*")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
        .neq("role", "system")
        .order("created_at")
    )
    messages = msgs_resp.data or []

    # 2. Phase 075 D-075-03: shared helper does the runs-FK merge so both
    # /messages and /snapshot route through one source of truth.
    # T-063.1-01 mitigation still holds: the threads ownership SELECT above
    # runs FIRST, so cross-user requests 404 before reaching the runs SELECT
    # inside the helper. T-063.1-04 mitigation also carries — helper
    # explicitly enumerates "run_id, message_id, status" only. WR-01 fix
    # (DESC + first-wins-per-message-id) lives inside the helper now.
    messages = await _enrich_messages_with_runs(
        messages,
        thread_id=thread_id,
        user_id=current_user["id"],
        supabase=supabase,
    )

    return messages


# Phase 089 Plan 03 (G-5 verbatim move): _reconstruct_history MOVED verbatim to
# app.services.agent_loop (co-located there per the operator-approved SEAM.md —
# the loop calls it from its own setup block; keep-and-import was rejected because
# agent_loop -> threads reintroduces the cycle). Re-imported at the top of this
# module so `from app.api.threads import _reconstruct_history` (e.g.
# test_tool_memory.py) keeps resolving. Definition removed here (one canonical copy).


# Phase 162.5 Plan 02 (G-5 extraction): _ensure_skill_snapshots MOVED VERBATIM to
# app.services.workflow_kickoff (re-imported at module scope above so
# `from app.api.threads import _ensure_skill_snapshots` — test_099 — still resolves;
# one canonical copy, no duplicate). The service functions are still called THROUGH
# the _skill_snapshot module object there, so test_099's monkeypatch surface holds.


@router.post("/{thread_id}/messages")
async def send_message(
    thread_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id, active_workflow_run_id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # ── Phase 092 MODE-01 / MODE-02 — server-side lock + workflow kickoff ──────
    # This is the AUTHORITATIVE workflow lock (the grayed client toggle is courtesy
    # only — D-05). The anchor + its run's terminal-state decide whether a send is
    # allowed and whether it kicks off a workflow. Done BEFORE the user-message
    # INSERT so a refused send writes nothing. Phase 162.5 Plan 02 (G-5 extraction,
    # D-A2/D-A4): the anchor 409-lock check + the workflow_definition_id preflight
    # (workflows kill-switch 403 → RLS-scoped published-definition resolve → 098
    # folder-scope ⊆ assert → 099 skill-snapshot materialize → 100 template pin) moved
    # VERBATIM to workflow_kickoff.preflight_workflow_kickoff. Every HTTPException 4xx/5xx
    # shape + the fail-closed-before-insert ordering is byte-identical; a plain Deep send
    # (no anchor, workflow_definition_id is None) returns (None, None) — a byte-identical
    # no-op that never consults the kill-switch. workflows_enabled / get_pg_pool resolve
    # LATE off this module inside the seam so patch("app.api.threads.workflows_enabled")
    # (test_147) + the app.api.threads.get_pg_pool patch still intercept (D-A4).
    _kickoff_definition, _kickoff_definition_id = await preflight_workflow_kickoff(
        body=body,
        thread_id=thread_id,
        thread_row=thread_resp.data,
        supabase=supabase,
        current_user=current_user,
    )

    # Insert user message (D-058-02: pre-stream INSERT in scope for 058).
    # Phase 063 (D-063-01): capture inserted user_message id for the new
    # JSONResponse contract — the frontend uses this to deduplicate its
    # optimistic placeholder against the persisted row. Per RESEARCH Open
    # Question #1, this is the USER-message id (the only one that exists
    # synchronously; the assistant message is persisted at terminal time).
    # BL-02 fix: supabase-py `.insert(...)` does not chain `.select("id").single()`
    # (`.single()` is a query-builder method, not an insert-builder method). The
    # standard pattern — used elsewhere in this module (line ~970 for the assistant
    # INSERT) — is to call `.insert(row)` alone; PostgREST returns the inserted
    # row(s) under `.data` as a list (Prefer: return=representation is the
    # supabase-py default). Read the id from `.data[0]["id"]`.
    _user_msg_resp = await aexec(
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "user",
            "content": body.content,
        })
    )
    _user_msg_data = _user_msg_resp.data if _user_msg_resp is not None else None
    # Real-PostgREST path: list[dict]; some test mocks hand back a single dict.
    if isinstance(_user_msg_data, list):
        _user_msg_id = _user_msg_data[0].get("id") if _user_msg_data else None
    elif isinstance(_user_msg_data, dict):
        _user_msg_id = _user_msg_data.get("id")
    else:
        _user_msg_id = None
    if not _user_msg_id:
        # Defensive: PostgREST should always return the inserted row by default.
        # If it doesn't, fail loudly so the frontend never gets a partial
        # {message_id: null, run_id: ...} response that would silently break
        # optimistic placeholder dedup.
        logger.error(
            "User-message INSERT did not return id for thread %s — aborting send_message",
            thread_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist user message",
        )

    # Phase 061 (D-061-05, D-061-10, D-061-11): generate run_id, INSERT
    # the runs lifecycle row, register the producer task, and ZADD the
    # sorted-set indexes — all BEFORE returning the consumer.
    #
    # NOTE: hoisted load_user_settings here from inside agent_runner so we
    # can resolve model/provider for the runs INSERT before spawning the
    # producer. Inside agent_runner, we shadow this with the same call so
    # the producer's closure-captured user_settings is independent (cheap
    # second call; load_user_settings is a settings-file read).
    _user_settings = load_user_settings(current_user["id"])
    if body.provider and body.provider != _user_settings.active_provider:
        _user_settings = override_provider(_user_settings, body.provider)

    run_id = _uuid_mod.uuid4()
    # Phase 149 (D-149-10) enabled-enforcement + D-067.3-N01 provider resolution + Plan-09/CR-01
    # disabled-model fallback. Phase 162.5 Plan 01 (G-5 leaf extraction): the inline model/provider
    # resolution transform moved VERBATIM to run_model_resolution.resolve_run_model. It returns the
    # (possibly mutated) body + user_settings so the EFFECTIVE fallback model on the wire + the
    # fallback-aligned provider credentials flow into register_run_start and the producer closure
    # unchanged; get_model_capability_async / override_provider resolve LATE off this module so the
    # provider-router patches still intercept. Behavior byte-identical (D-14).
    _resolved_model, _resolved_provider, _model_fallback_notice, body, _user_settings = await resolve_run_model(
        body=body, user_settings=_user_settings
    )

    try:
        # Phase 145-03 (D-145-09) — the runs INSERT + both ZADD mirrors are now ONE
        # atomic co-write via the run_lifecycle owner (was: an insert_run here + a
        # separate ZADD ×2 block). Status + runs:active can no longer drift: on
        # success run_id ∈ runs:active ⇔ runs.status == 'streaming'. The owner reuses
        # the shared db.runs.insert_run writer (Phase 073 parity) + a time.time()
        # started-at score (the ordering 062's active-runs endpoint ZRANGEBYSCOREs).
        # _resolved_provider is guaranteed non-None at this line by the if/else chain
        # above (Pitfall 6 — provider column is NOT NULL).
        await register_run_start(
            pool=await get_pg_pool(),
            redis=redis,
            run_id=run_id,
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
            model=_resolved_model,
            provider=_resolved_provider,
            spawned_by_worker=str(os.getpid()),
        )
    except Exception:
        # Spawn-failure cleanup (RESEARCH.md Q2): don't leave an orphan runs row +
        # mirror entries. Route through the owner so the failed-status write + both
        # ZREMs are the SAME atomic co-write (was: a supabase UPDATE + a separate
        # ZREM ×2). A completed_at datetime replaces the legacy "now()" string,
        # symmetric with the finalize path (WR-01 discipline).
        try:
            await finalize_run_terminal(
                pool=await get_pg_pool(),
                redis=redis,
                run_id=run_id,
                thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                status="failed",
                error="spawn_failed",
                completed_at=datetime.now(timezone.utc),
            )
        except Exception:
            logger.exception("Failed to finalize spawn-failed run %s", run_id)
        raise

    # Phase 149 (D-149-10): the run stream now exists — emit the honest disabled-model
    # fallback notice (naming BOTH models) when the user's selected model was operator-
    # disabled. REUSES the canonical _emit informational-event shape (no new emitter, no
    # per-provider fork). Best-effort: an informational emit must never sink the run.
    if _model_fallback_notice:
        try:
            await _emit(redis, run_id, "model_disabled_fallback", **_model_fallback_notice)
        except Exception:  # noqa: BLE001 — informational only; never break the run
            logger.warning(
                "D-149-10 fallback notice emit failed for run %s", run_id, exc_info=True
            )

    # ── Phase 092 MODE-01 — kickoff: create the workflow run + set the anchor ──
    # AFTER the producer-shell `runs` row exists (two-rows model, RESEARCH A2 /
    # Landmine 5: the `runs` row carries SSE-terminal consistency; this
    # `workflow_runs` row is the engine's row) and BEFORE the producer spawns, so
    # agent_runner reads a non-null anchor and branches to the harness engine.
    # create_workflow_run sets threads.active_workflow_run_id atomically (FK-ordered).
    _active_workflow_run_id = None
    if _kickoff_definition is not None:
        _active_workflow_run_id = await create_workflow_run(
            await get_pg_pool(),
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            definition_id=(
                UUID(_kickoff_definition_id)
                if isinstance(_kickoff_definition_id, str)
                else _kickoff_definition_id
            ),
            definition=_kickoff_definition,
            # SEED-047 kickoff_prompt + 152 WFIN-02: persist the per-run folder override (D-01, no migration) so resume/Continue read it back (Pitfall 5).
            inputs={"kickoff_prompt": body.content, **({"folder_id": str(body.folder_id)} if body.folder_id else {})},
            model=_resolved_model,                      # SEED-047
            # Phase 092-05 F1: persist the run-owner so harness_audit writes
            # (NOT NULL user_id) and the resume path resolve a real user.
            user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
        )

    # D-067.2-05: Auto-title fires AFTER the first-user-message INSERT but BEFORE the
    # agent producer task starts, derived from the user message alone (so the title persists
    # regardless of run success / failure / timeout / cancellation). Phase 162.5 Plan 01
    # (G-5 leaf extraction): the "New Chat" guard + threadpool-wrapped title-gen + the
    # fallback-model-before-title emit ordering + the nested try/except moved VERBATIM into
    # thread_title.maybe_autotitle_thread. title_fn / emit are injected as THIS module's
    # generate_thread_title / _emit so patch("app.api.threads.generate_thread_title") and
    # app.api.threads._emit still intercept (D-A4). Behavior byte-identical.
    await maybe_autotitle_thread(
        supabase=supabase,
        redis=redis,
        thread_id=thread_id,
        first_message=body.content,
        user_settings=_user_settings,
        chat_model=body.model or "",
        run_id=run_id,
        title_fn=generate_thread_title,
        emit=_emit,
    )

    async def agent_runner(run_id: _uuid_mod.UUID) -> None:
        """Producer task — XADDs every SSE event to run:{run_id} Redis Stream.

        Phase 061 (D-061-01, D-061-10, D-v2.5-08): replaces 059's
        queue.put(...) producer. Lifetime decoupled from the SSE consumer
        (D-061-03). Body wrapped in asyncio.timeout(120s) to bound
        abandoned runs (D-061-01); on TimeoutError the outer except sets
        _terminal_error='hard_timeout' and the finally writes the terminal
        error sentinel + runs UPDATE + EXPIRE 60.
        """
        # State for the finally — set inside the body, read by the finally (Task 3).
        _terminal_status: str = "completed"  # default — set on natural completion
        _terminal_error: str | None = None
        # Phase 066 D-066-07: capture per-iteration context for the timed_out
        # error string. Updated each iteration BEFORE the LLM stream block
        # (around line ~1149 / ~1213) so the outer except sees the iteration
        # at which the timer fired. MUST be declared at function scope (same
        # indent as _terminal_status / _terminal_error, BEFORE the try: below)
        # — declaring inside try: would cause UnboundLocalError if a
        # TimeoutError fires before the agent loop iterates.
        _last_iteration: int = 0
        _last_model_id: str = ""
        _last_per_call_budget: int = 0

        try:                          # OUTER try → finally runs shielded finalizer (Phase 061 Plan 03 Task 3)
            # Phase 066 D-066-01: the outer 120s total-deadline asyncio.timeout
            # wrapper (formerly fed by the legacy producer-hard-timeout setting)
            # that lived here in Phase 061 has been DELETED. The agent loop now
            # has no hard total cap (matches Claude/ChatGPT UX where complex
            # tool-calling workflows can run as long as needed within
            # max_iterations). Per-LLM-call deadlines live INSIDE the iteration
            # loop at the SDK stream blocks (D-066-02); see the
            # `async with asyncio.timeout(per_call_budget)` wraps at the
            # Anthropic native path (around line ~1149) and the
            # OpenAI/Google/OpenRouter path (around line ~1213). Tool execution
            # (sandbox / web_search / sub-agent) is OUTSIDE the per-call
            # timer — tools own their own timeout discipline.
            #
            # Worst-case wall-time = max_iterations × per_call_budget (15 × 300s
            # ≈ 75min for unknown models; per-model overrides in
            # MODEL_CAPABILITIES tune this). The replay-tail consumer's deadline
            # at runs.py (settings.consumer_timeout_seconds) is independent
            # from this scope — it bounds the CONSUMER, not the producer.

            # Reuse the user_settings already resolved by the route handler
            # (hoisted from inside this function in Plan 03 Task 1 so the
            # runs INSERT could populate model/provider before producer spawn).
            user_settings = _user_settings

            # Phase 089 Plan 03 (G-5 THE verbatim move): the entire agent loop —
            # the B1 setup block, the Category-D accumulators, the nested persist
            # functions, the multi-iteration loop with the three provider
            # chunk-handlers, the tool-dispatch round, the inner try/except, the
            # post-loop emits, and the suggestion-gen + stream_end — MOVED verbatim
            # into app.services.agent_loop.run_agent_loop. agent_runner now: build
            # the frozen RunContext, call run_agent_loop, consume the AgentLoopResult.
            # The _terminal_status classifier (except branches below) + the shielded
            # finalizer STAY here (producer-shell concern). Behavior-preserving — file
            # location changes only (D-089-03).
            _agent_loop_result: AgentLoopResult | None = None
            # 089-03: per-iteration timeout context surfaced by the loop so the
            # `except asyncio.TimeoutError` classifier below can format the
            # byte-identical `timed_out: …` error string (Phase 066 D-066-07). The
            # loop writes last_iteration / last_model_id / last_per_call_budget into
            # this dict before each provider stream block (was an agent_runner-scope
            # local captured by closure pre-move).
            _timeout_ctx: dict = {
                "last_iteration": _last_iteration,
                "last_model_id": _last_model_id,
                "last_per_call_budget": _last_per_call_budget,
            }
            # 089-03: finalizer-needed outputs surfaced by the loop on EVERY exit
            # path (incl. exception) so _shielded_finalize can persist the
            # (possibly partial) assistant message + token totals + system
            # warnings exactly as the pre-move closure-scoped finalizer did. The
            # loop populates this in its outer `finally`; the by-reference dict is
            # the cycle-free surface that survives a re-raise (the return value
            # below is unavailable when the loop exits via an exception).
            _result_sink: dict = {}

            try:  # middle try/finally — guarantees persist even on GeneratorExit (client disconnect)
                # ── Phase 092 MODE-01 — producer mode-branch (SC#1) ────────────
                # The ONE additive branch: Harness iff the thread holds a live
                # workflow anchor (set by create_workflow_run above), else Deep.
                # MUST live here (above the loop, inside this try) — NEVER inside a
                # provider streaming branch (075.x cascade rule). The Deep `else`
                # is BYTE-IDENTICAL to the pre-092 call. The surrounding except +
                # finally:_shielded_finalize stay mode-agnostic (untouched). The
                # harness branch's `run_workflow` owns the workflow_runs terminal
                # write internally; the producer-shell `runs` row still finalizes
                # via _shielded_finalize for SSE-terminal consistency (the lock-clear
                # is Plan 03's single-clear-site concern — this plan only SETS it).
                if _active_workflow_run_id is not None:        # Harness
                    # Engine ctx is NOT RunContext (Landmine 7) — build the loose
                    # SimpleNamespace bag the engine threads through, mirroring
                    # harness_engine._build_resume_context.
                    from types import SimpleNamespace
                    from app.services.harness_engine import (
                        run_workflow,
                        _load_run_definition,
                        _emit as _harness_emit,
                    )
                    # D-04 (site 1): the shared resolve-never-mutate (D-05) wrapper —
                    # resolve the effective ctx model from the run owner's active
                    # provider (a stale cross-provider llm_model falls back to the
                    # provider default rather than leaking to the wrong client). Lazy
                    # import inside the harness branch (matches the pattern above);
                    # threaded onto wf_ctx.model below. Phase-level precedence is
                    # unchanged downstream: phase.config.model or ctx.model.
                    from app.services.sub_agent_models import resolve_workflow_ctx_model
                    _wf_pool = await get_pg_pool()
                    _wf_definition = await _load_run_definition(
                        _wf_pool, _active_workflow_run_id
                    )
                    # F5 (092-07) + 098 (GOV-01/PROJ-02 — site 1 kickoff): resolve the
                    # run-start retrieval scope. For a BOUND workflow
                    # (_kickoff_definition.project_folder_id set) the scope is the
                    # PROJECT subtree, sourced from the binding the model cannot supply
                    # (GOV-01) — NOT the thread folder. For an UNBOUND/legacy workflow
                    # the scope stays the thread-folder subtree (unchanged — SC#1). Both
                    # branches resolve through the shared scope.resolve_project_subtree
                    # helper, so the inline recursive subtree walk is REMOVED
                    # (G-5: threads.py must shrink, not grow). The scoped_folder_path is
                    # the human-readable ls/tree/grep default-path hint (display only —
                    # the real scope enforcement is folder_subtree_ids).
                    _wf_folder_subtree_ids: list[str] | None = None
                    _wf_scoped_folder_path: str | None = None
                    try:
                        _wf_thread_data = await aexec(
                            supabase.table("threads").select("folder_id").eq("id", thread_id).single()
                        )
                        _wf_thread_folder = _wf_thread_data.data.get("folder_id") if _wf_thread_data.data else None
                        # 152 WFIN-02: owned-override > author > thread precedence + D-05 gate in the helper (G-5).
                        _wf_scope_root = await resolve_run_scope_root(
                            _kickoff_definition,
                            run_inputs={"folder_id": str(body.folder_id)} if body.folder_id else None,
                            thread_folder_id=_wf_thread_folder,
                            supabase=supabase, user_id=current_user["id"],
                        )
                        if _wf_scope_root:
                            _wf_folder_subtree_ids = await resolve_project_subtree(
                                _wf_scope_root, supabase=supabase, user_id=current_user["id"]
                            )
                            _wf_all_folders = await fetch_visible_folders(
                                supabase, current_user["id"]
                            )
                            _wf_folder_map = {f["id"]: f for f in _wf_all_folders}
                            _wf_path_parts: list[str] = []
                            _wf_current_fid = _wf_scope_root
                            while _wf_current_fid:
                                _f = _wf_folder_map.get(_wf_current_fid)
                                if not _f:
                                    break
                                _wf_path_parts.append(_f.get("name", ""))
                                _wf_current_fid = _f.get("parent_id")
                            _wf_scoped_folder_path = (
                                "/" + "/".join(reversed(_wf_path_parts))
                                if _wf_path_parts else None
                            )
                    except Exception:
                        # WR-03 (098 secure-phase): a scope-resolution failure must not
                        # silently widen a BOUND workflow to the whole KB. The Plan-05
                        # clip + scope_violation emit are gated on
                        # `folder_subtree_ids is not None`, so on a None fallback neither
                        # narrows nor fires — the degradation would be INVISIBLE. Kickoff
                        # is the one site where the run has NOT started yet, so for a
                        # bound workflow we fail CLOSED (emit + raise → a clean `failed`
                        # terminal via the producer's outer `except Exception` below)
                        # rather than run unscoped. An UNBOUND/legacy workflow keeps the
                        # historical fall-through to whole-KB (SC#1 — losing the
                        # thread-folder default hint is not a governance violation).
                        _wf_bound = _kickoff_definition.project_folder_id is not None
                        logger.exception(
                            "harness run-start scope resolution failed for thread %s "
                            "(bound=%s)", thread_id, _wf_bound,
                        )
                        if _wf_bound:
                            try:
                                await _harness_emit(
                                    redis,
                                    _active_workflow_run_id,
                                    "scope_resolution_failed",
                                    site="kickoff",
                                    bound=True,
                                    detail=(
                                        "project-scope resolution failed at run start; "
                                        "failing closed to avoid whole-KB retrieval"
                                    ),
                                )
                            except Exception:  # noqa: BLE001 — emit is best-effort
                                logger.debug(
                                    "kickoff: scope_resolution_failed emit failed for run %s",
                                    _active_workflow_run_id,
                                )
                            raise RuntimeError(
                                "bound workflow scope resolution failed at run start "
                                "(failing closed to avoid whole-KB retrieval)"
                            )
                        # unbound → fall through to unscoped (None) search (unchanged)
                    wf_ctx = SimpleNamespace(
                        run_id=_active_workflow_run_id,
                        # Facet A (092-07): the producer runs.run_id is the FK target
                        # for sub-agent parent_run_id; ctx.run_id stays the workflow_run
                        # id for audit/terminal/definition/resume-match.
                        producer_run_id=run_id,
                        thread_id=thread_id,
                        current_user=current_user,
                        user_settings=user_settings,
                        # D-04 (site 1): the effective ctx model resolved from the run
                        # owner's active provider (resolve-never-mutate, D-05). user_settings
                        # is the live request's effective settings — resolve from it so a
                        # stale cross-provider llm_model cannot leak to the wrong client.
                        # Phase-level precedence stays phase.config.model or ctx.model
                        # (phase_types._effective_model) — this only sets ctx.model.
                        model=resolve_workflow_ctx_model(user_settings),
                        # F8 (092-07): the consumption half of SEED-047. create_workflow_run
                        # STORED the user's kickoff question in workflow_runs.inputs.kickoff_prompt
                        # (:995 above) but the phase executors never read it — the FIRST phase
                        # (research) ran with an empty user turn and asked "send me the topic…".
                        # Mirror EXACTLY what was persisted so live ctx.inputs == the durable
                        # inputs jsonb the resume builders read back (152: mirror the folder
                        # override too). ctx.inputs["kickoff_prompt"] is the first phase's user
                        # turn / sub-agent task; programmatic split_topic reads ctx.inputs at :178.
                        inputs={"kickoff_prompt": body.content, **({"folder_id": str(body.folder_id)} if body.folder_id else {})},
                        redis=redis,
                        pool=_wf_pool,
                        emit=_harness_emit,
                        retry_feedback=None,
                        # F5 (092-07): the tool-context fields every Supabase tool
                        # reads via ctx.<field> (search_documents/hybrid/ls/tree/grep/
                        # glob/fetch_document/skills/code-exec logging). Sourced from
                        # the SAME in-scope values the Deep RunContext + run_agent_loop
                        # use: supabase=supabase (threads.py:1190), spawn=_spawn
                        # (threads.py:1198, the module-level _spawn). Without these
                        # _build_phase_tool_context forwards None → ctx.supabase.rpc
                        # raises AttributeError on the first search_documents (F5).
                        supabase=supabase,
                        folder_subtree_ids=_wf_folder_subtree_ids,
                        scoped_folder_path=_wf_scoped_folder_path,
                        spawn=_spawn,
                        # Per-run task() concurrency gate — mirrors the Deep
                        # run_agent_loop local (_per_run_task_semaphore,
                        # agent_loop.py:1234). A fresh per-run semaphore is correct
                        # (this is a fresh top-level workflow run).
                        per_run_task_semaphore=asyncio.Semaphore(
                            settings.task_per_run_concurrency
                        ),
                    )
                    await run_workflow(
                        _active_workflow_run_id,
                        _wf_definition,
                        wf_ctx,
                        pool=_wf_pool,
                        redis=redis,
                        # Facet B (092-07): route engine SSE events to the producer
                        # stream the frontend watches (run:{producer_run_id}).
                        stream_run_id=run_id,
                    )
                    # ── 093-05 D-11: answer surfacing now lives in run_workflow ──────
                    # The F6/F7 surfacing (delta + sources/citations/confidence emit +
                    # the assistant-message persist) was moved INTO the shared helper
                    # `harness_engine._surface_final_answer`, which run_workflow invokes
                    # on its success terminal BEFORE the terminal `run_completed` (D-11,
                    # Pitfall 5). That helper is THE single surfacing site + single
                    # persist owner for ALL THREE entry paths (live kickoff here, resume
                    # via _build_resume_context, Continue via _harness_continuation) —
                    # so resumed/Continue'd workflows surface identically and there is
                    # exactly ONE persisted assistant message per path (Landmine 5).
                    # Therefore the live-kickoff branch surfaces NOTHING inline and
                    # installs NO harness persist callable into `_result_sink`:
                    # `_shielded_finalize` reads `_result_sink.get("persist")` and is a
                    # no-op when it is absent (threads.py:1529) → no double-persist /
                    # duplicate assistant message. The Deep `else` branch +
                    # run_agent_loop + the Deep `_result_sink` flow stay byte-identical
                    # (D-14).
                else:                                          # Deep — byte-identical
                    ctx = RunContext(
                        run_id=run_id,
                        thread_id=thread_id,
                        current_user=current_user,
                        user_settings=user_settings,
                        body=body,
                        redis=redis,
                        supabase=supabase,
                        resolved_model=_resolved_model,
                        resolved_provider=_resolved_provider,
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
                # producer-shell locals the classifier reads (keeps the
                # timed_out error string byte-identical — Phase 066 D-066-07).
                _last_iteration = _timeout_ctx.get("last_iteration", _last_iteration)
                _last_model_id = _timeout_ctx.get("last_model_id", _last_model_id)
                _last_per_call_budget = _timeout_ctx.get("last_per_call_budget", _last_per_call_budget)

            except asyncio.TimeoutError:
                # Phase 066 D-066-05 + D-066-07: per-LLM-call asyncio.timeout
                # fired inside the SDK iteration block. _last_iteration /
                # _last_model_id / _last_per_call_budget were captured at the
                # iteration start (closure variables initialized to defaults
                # at top of agent_runner so an early TimeoutError before the
                # loop iterates won't UnboundLocalError).
                # 089-03: the loop now lives in run_agent_loop, so it surfaces
                # the per-iteration context via the by-reference _timeout_ctx
                # dict (mutated even when the TimeoutError propagates out of the
                # loop, before the post-call mirror above runs). Read it here so
                # the timed_out error string carries the real iteration/model —
                # byte-identical to the pre-move closure-captured behavior.
                _last_iteration = _timeout_ctx.get("last_iteration", _last_iteration)
                _last_model_id = _timeout_ctx.get("last_model_id", _last_model_id)
                _last_per_call_budget = _timeout_ctx.get("last_per_call_budget", _last_per_call_budget)
                # Strict partition guard: timer fire = system = 'timed_out'.
                # The user-Stop write at runs.py stays 'cancelled' (UNCHANGED).
                # The format mirrors the contract documented in CONTEXT.md
                # D-066-07 exactly so log/audit consumers can grep on the prefix.
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
                # D-066-05 UNCHANGED: cancellation comes from app lifespan shutdown
                # OR DELETE /runs/{id} (cancel verb). The DELETE handler writes its
                # own error string ('cancelled_by_user') in runs.py:423; this branch
                # leaves _terminal_error = None and lets the finalizer write NULL,
                # which is the legacy contract for in-process producer cancellation.
                _terminal_status = "cancelled"
                _terminal_error = None
                raise   # MUST re-raise so timeout context + asyncio task state stay correct (Pitfall 3)
            except Exception as e:
                # D-066-07 extended format: 'failed: <ExceptionClass>: <truncated≤200chars>'
                # supersedes today's bare type(e).__name__. The 200-char cap (T-066-02
                # mitigation) prevents accidental traceback / API-key-fragment leakage
                # via RLS-readable runs.error column.
                _terminal_status = "failed"
                _truncated_msg = (str(e) or "")[:200]
                _terminal_error = f"failed: {type(e).__name__}: {_truncated_msg}"
                logger.exception("Run %s failed", run_id)
            finally:
                # Phase 061 (D-061-04, Pitfall 2): shielded finalizer with
                # strict ordering — sentinel BEFORE expire, registry pop LAST.
                # Persists message, writes terminal sentinel, updates runs row,
                # EXPIREs Redis key, ZREMs sorted sets, evicts from RUN_TASKS.
                #
                # asyncio.shield protects the whole block from app-shutdown
                # cancellation (058/059 invariant preserved). socket_timeout=10
                # on the Redis client (Plan 01, Pitfall 7) prevents this block
                # from hanging on a dead Redis socket.
                async def _shielded_finalize():
                    # IN-03 (D-061.1-09): _persist_assistant_message owns the
                    # cached id on its own function attribute. We capture the
                    # return value here as a local — no nonlocal reaches into
                    # send_message scope. Idempotency is preserved via the
                    # _message_persisted guard inside _persist_assistant_message.
                    #
                    # 089-03: the persist callables + accumulators now live inside
                    # run_agent_loop. They are surfaced to this finalizer via the
                    # by-reference _result_sink (populated by the loop's outer
                    # `finally` on EVERY exit path, incl. exception). The
                    # persist→persist_system_warnings→finalize_run→sentinel→expire→
                    # zrem step order is byte-identical to the pre-move finalizer
                    # (I10 / Pitfall 5). When the loop never ran (defensive: sink
                    # empty), the persist callables are absent — we skip the
                    # persist + system-warning steps and still finalize the runs
                    # row so the run reaches a terminal status.
                    _persist = _result_sink.get("persist")
                    _persist_sys = _result_sink.get("persist_system_warnings")
                    _sink_system_warnings = _result_sink.get("persisted_system_warnings") or []
                    _input_tokens_total = _result_sink.get("input_tokens_total")
                    _output_tokens_total = _result_sink.get("output_tokens_total")
                    # 1. SHIELDED PERSIST — preserves 058/059 contract.
                    _msg_id_for_runs: str | None = None
                    try:
                        if _persist is not None:
                            _msg_id_for_runs = await _persist()
                    except BaseException:
                        logger.exception("Shielded persist failed for run %s", run_id)

                    # Plan 075.4-03 D-075.4-E1 — persist any system_warning
                    # rows captured during the run. Best-effort (try/except)
                    # because the messages_role_check constraint pre-migration
                    # 048 rejects role='system' — INSERT fails-silent; SSE
                    # event remains the user-visible signal regardless.
                    try:
                        if _persist_sys is not None and _sink_system_warnings:
                            await _persist_sys(_sink_system_warnings)
                    except BaseException:
                        logger.exception("Shielded system-warning persist failed for run %s", run_id)

                    # Phase 138 RUN-01b (SITE 1) — on a genuinely-clean run end, append
                    # the honesty marker to any still-open todo so the Workspace TODOS
                    # panel reads "… (run ended — not completed)" instead of looking
                    # permanently stuck. Positioned AFTER step-1 persist and BEFORE
                    # step-2 finalize_run so the todo_updated emit reaches the live SSE
                    # consumer ahead of the terminal sentinel and isn't trimmed by EXPIRE
                    # (S5 — no existing step is reordered). Best-effort: the reconciler
                    # NEVER raises into the byte-locked finalizer.
                    #
                    # LOCK-2 / S6 two-clause gate: _shielded_finalize NEVER reads
                    # cap_disposition, so a fresh Deep run that hit the iteration cap
                    # arrives here as _terminal_status == "completed" with
                    # _result_sink["cap_disposition"] == "cap_paused". Gating on status
                    # alone would WRONGLY mark a cap-paused run (the D-05 trap) — the
                    # cap_paused clause is load-bearing.
                    if _terminal_status == "completed" and _result_sink.get("cap_disposition") != "cap_paused":
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

                    # Plan 075.4-03 T-075.4-04 — STEP-SWAP race fix.
                    # Legacy order was (2) sentinel → (3) finalize_run, but
                    # frontend consumes the SSE `done` (which is the
                    # _emit_terminal payload's discriminator type) as the
                    # signal that the run is finished — including any
                    # subsequent GET /threads/{id}/snapshot expectations on
                    # runs.status. Old order let the consumer see `done`
                    # BEFORE the DB UPDATE landed.
                    # New order (post-Plan-03):
                    #   2. finalize_run UPDATE      (DB commit)
                    #   3. _emit_terminal sentinel  (SSE consumer breaks)
                    # Pitfall 2 (terminal-sentinel-before-EXPIRE) still holds
                    # because EXPIRE (step 4) follows the sentinel (step 3).
                    # The Phase 067.4 Rule 3 invariant (suggestion events
                    # emit before terminal sentinel) is preserved because
                    # suggestions live in the agent body that runs BEFORE
                    # the finally: that triggers _shielded_finalize.

                    # 2. UPDATE runs row — status/error/completed_at/message_id/tokens.
                    # Phase 073 D-073-04 SITE #2 — flips to asyncpg finalize_run helper.
                    # Phase 073 TOKEN-COL-01 (D-073-09): NULL + warn when SDK never
                    # surfaced usage on any iteration (interrupted stream / provider
                    # gap). Both slots stay None until the on-chunk callback fires.
                    # Warning format string contains run/provider/model identifiers
                    # only — NO token VALUES (T-073-04 mitigation; locked by Plan 03's
                    # test_missing_usage_format_string_has_no_token_values negative gate).
                    # WR-01 historical note: PostgREST required ISO-8601-string timestamps
                    # due to JSON-over-the-wire encoding. asyncpg uses the Postgres binary
                    # protocol — pass datetime objects directly.
                    try:
                        if _input_tokens_total is None and _output_tokens_total is None:
                            logger.warning(
                                "runs.usage missing for run=%s provider=%s model=%s",
                                run_id, _resolved_provider, _resolved_model,
                            )
                        # Phase 145-03 (D-145-09) — the terminal runs.status write +
                        # both ZREMs are now ONE atomic co-write via the owner (was:
                        # finalize_run here + a separate ZREM ×2 at old step 5). The
                        # 075.4-03 ordering holds: the owner writes status FIRST then
                        # ZREMs; the terminal sentinel (step 3) + EXPIRE (step 4) below
                        # still run AFTER this call. Deep _terminal_status is always a
                        # TRUE terminal here (cap_disposition is tracked separately —
                        # see the LOCK-2/S6 gate above), so this is unconditional.
                        await finalize_run_terminal(
                            pool=await get_pg_pool(),
                            redis=redis,
                            run_id=run_id,
                            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                            status=_terminal_status,
                            error=_terminal_error,
                            completed_at=datetime.now(timezone.utc),
                            message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                            input_tokens=_input_tokens_total,
                            output_tokens=_output_tokens_total,
                        )
                    except BaseException:
                        logger.exception("runs row finalize+ZREM failed for run %s", run_id)

                    # 3. TERMINAL SENTINEL XADD — MUST come AFTER finalize_run
                    # (Plan 075.4-03 race fix) AND BEFORE EXPIRE (Pitfall 2).
                    # Use _emit_terminal (no MAXLEN — sentinel must not be trimmed, Pitfall 5).
                    # Map runs.status enum → SSE TERMINAL_TYPES (D-061-09 vs D-061-12 namespaces).
                    # CR-02 + WR-03: catch BaseException (incl. CancelledError) so a
                    # lifespan-shutdown cancel mid-finalize doesn't leave runs row stuck
                    # in 'streaming'. Also catches KeyError if an unmapped status sneaks
                    # past the _RUN_STATUS_TO_TERMINAL_TYPE lookup, plus any future
                    # ValueError from the _emit_terminal type guard.
                    try:
                        _terminal_type = _RUN_STATUS_TO_TERMINAL_TYPE[_terminal_status]
                        await _emit_terminal(redis, run_id, _terminal_type, error=_terminal_error)
                    except BaseException:
                        logger.exception("Terminal sentinel XADD failed for run %s", run_id)

                    # 4. EXPIRE Redis stream — 600s completed, 60s failed/cancelled (REDIS-SETUP.md TTL discipline)
                    _ttl = 600 if _terminal_status == "completed" else 60
                    try:
                        await redis.expire(f"run:{run_id}", _ttl)
                    except BaseException:
                        logger.exception("EXPIRE failed for run %s", run_id)

                    # 5. ZREM sorted-set indexes — MOVED into the finalize_run_terminal
                    # owner above (Phase 145-03 / D-145-09): the terminal mirror removal
                    # now co-writes atomically with the runs.status UPDATE, so status +
                    # runs:active can no longer drift (BUG-260709-01, 145-REPRO Dir B).

                    # 6. Phase 092-05 F2: a HARNESS run that escapes via
                    # exception/timeout/cancel never reached run_workflow's own
                    # finish_run, so workflow_runs would stay 'active' and the
                    # thread is wedged locked (lock_is_stale=false, no UI recovery).
                    # Terminalize the workflow_runs row + clear the anchor here on
                    # any NON-completed terminal status. Idempotent: finish_run
                    # no-ops the anchor-clear if run_workflow already cleared it on
                    # its own internal failure path. A natural-success run
                    # (_terminal_status=='completed') is SKIPPED — run_workflow
                    # already wrote finish_run(..., 'completed'). Deep runs
                    # (_active_workflow_run_id is None) skip this entirely
                    # (byte-identical).
                    #
                    # 096-09 (UAT Test 2 restart-resumability fix): on a GRACEFUL
                    # app shutdown, do NOT terminalize — leaving workflow_runs
                    # 'active' + the thread anchor intact is PRECISELY what makes
                    # the boot-time resume sweep re-claim and re-drive this run
                    # (the active phase's output was never durable → re-running it
                    # from the top is the correct, idempotent resume). Terminalizing
                    # here (the pre-fix behavior) is what stranded the run. The gate
                    # is the ONLY change: user-Stop / crash / timeout (flag False)
                    # still terminalize exactly as before — byte-identical. Deep
                    # runs are unaffected (_active_workflow_run_id is None).
                    from app.services.harness_engine import is_app_shutting_down
                    if (
                        _active_workflow_run_id is not None
                        and _terminal_status != "completed"
                        and not is_app_shutting_down()
                    ):
                        try:
                            from app.db.workflows import finish_run as _finish_wf
                            await _finish_wf(
                                await get_pg_pool(),
                                _active_workflow_run_id,
                                # v2.8-audit cancel-honesty fix: a user Stop sets
                                # _terminal_status='cancelled' (:1379) and the
                                # workflow_runs CHECK + every terminal-status
                                # consumer (_TERMINAL_WORKFLOW_STATUSES here and
                                # in panel.py, PhaseTimeline, RunCard) already
                                # handle 'cancelled' — record the true intent.
                                # Every OTHER non-completed escape (timed_out is
                                # NOT in the workflow_runs CHECK, failed, crash)
                                # keeps writing 'failed' verbatim.
                                "cancelled"
                                if _terminal_status == "cancelled"
                                else "failed",
                            )
                        except BaseException:
                            logger.exception(
                                "F2 harness-failure terminalize failed for run %s",
                                _active_workflow_run_id,
                            )
                    elif (
                        _active_workflow_run_id is not None
                        and _terminal_status != "completed"
                    ):
                        # Shutdown path — left resumable on purpose.
                        logger.info(
                            "F2 skipped for workflow run %s — app shutting down, "
                            "left active for the boot-time resume sweep (096-09)",
                            _active_workflow_run_id,
                        )

                try:
                    await asyncio.shield(_shielded_finalize())
                except asyncio.CancelledError:
                    raise   # propagate; lifespan-cancel path
                finally:
                    # 6. Self-evict from registry (done-callback also handles this; defense-in-depth)
                    RUN_TASKS.pop(run_id, None)

    # CR-01 fix: classification of TimeoutError / CancelledError / Exception
    # was moved INSIDE the inner try (just before its finally) so the finalizer
    # at line 1942 reads the correct _terminal_status. The previous outer
    # except branches at this level were redundant — they fired AFTER the
    # finally had already committed status='completed' to Redis and Postgres.
    # CancelledError still propagates out of agent_runner via the inner re-raise
    # so the asyncio task transitions to CANCELLED state correctly (Pitfall 3).
        finally:
            pass  # outer try kept structurally; classification handled by inner except branches above.

    # Spawn producer task — runs concurrently with the consumer below.
    # D-061-11: register the producer in RUN_TASKS BEFORE returning the
    # consumer. add_done_callback evicts on completion (defense-in-depth;
    # the producer's own finally ALSO pops). 062's DELETE /runs/{id}
    # looks up run_id here and calls task.cancel().
    task = asyncio.create_task(agent_runner(run_id))
    RUN_TASKS[run_id] = task

    def _evict(_t, _rid=run_id):
        RUN_TASKS.pop(_rid, None)
    task.add_done_callback(_evict)

    # Phase 063 (D-063-01): hard cutover. POST returns JSON synchronously
    # with the user_message id and run_id; frontend opens GET /runs/{rid}/stream
    # in a separate request to consume tokens. Replaces the legacy SSE-on-POST
    # path that 062's replay_tail_consumer in runs.py made obsolete. No compat
    # shim — both paths cannot coexist beyond this phase per ROADMAP risk note
    # "Don't keep two streaming code paths longer than one phase".
    #
    # CRITICAL ordering invariants preserved by lines above this return:
    #   - messages INSERT happened (Task 1, _user_msg_id captured)
    #   - public.runs row INSERTed (line ~793, status='streaming')
    #   - runs:active + runs_by_thread:{tid} sorted-set ZADDs happened
    #   - agent_runner task spawned + RUN_TASKS[run_id] registered
    # Frontend's GET /runs/{rid}/stream relies on the runs row being
    # SELECT-able by the time this response arrives (Pitfall 4).
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message_id": str(_user_msg_id),
            "run_id": str(run_id),
            # Phase 095.1-07 (GAP-2): surface the ALREADY-resolved model/provider
            # (computed at L921-954 before insert_run, and written to the runs row)
            # so the live assistant placeholder shows `{provider} · {model}` in the
            # LIVE moment — not only after a reload re-reads them via the Plan-03
            # enrich SELECT. Additive keys ONLY; no re-resolution, no SSE/chunk-path
            # change. These are the SAME values the reload enrich reads back.
            "model": _resolved_model,
            "provider": _resolved_provider,
        },
    )


# Phase 092 (SC#5 / D-v2.5-03) — reconcile mode/lock/phase/Continue state.
# Realtime is a hint, not truth: the frontend fetches this on (re)connect /
# thread-switch to reconcile the per-thread workflow lock + Continue affordance.
_TERMINAL_WORKFLOW_STATUSES = ("completed", "failed", "cancelled")
_MAX_CONTINUES_PER_RUN = 3  # D-06 (mirror of config.max_continues_per_run; Plan 03 wires the knob)


@router.get("/{thread_id}/workflow", response_model=ThreadWorkflowState)
async def get_thread_workflow(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> ThreadWorkflowState:
    """PURE READ — reconcile a thread's Deep/Harness mode + lock + phase + Continue.

    Ownership-gated FIRST (T-092-04 — 404, never leak existence). Then a joined
    read over the thread anchor -> workflow_runs -> workflow_definitions ->
    workflow_phases, plus the latest non-terminal `runs` row for the Deep-run
    cap_paused case (RESEARCH Q3). NEVER writes — the lock-clear is owned by the
    cancel/terminal path (Plan 03); `lock_is_stale` is a diagnostic self-heal
    signal only, so a thread is never stuck Harness-locked with a terminal/absent
    run.
    """
    # 1. Ownership gate — fetch the anchor in the same SELECT (threads.py:341 idiom).
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id, active_workflow_run_id")
        .eq("id", str(thread_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = thread_resp.data if thread_resp is not None else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    active_workflow_run_id = row.get("active_workflow_run_id")
    pool = await get_pg_pool()

    # 2. Workflow-run state (joined: run -> definition -> current phase + total).
    run_status = None
    definition_slug = None
    definition_name = None
    current_phase_slug = None
    current_phase_index = None
    total_phases = None
    wf_continues_used = 0
    phases_list: list[WorkflowPhaseState] | None = None
    if active_workflow_run_id is not None:
        wf_row = await pool.fetchrow(
            """
            SELECT wr.status,
                   wr.continues_used,
                   wd.slug  AS definition_slug,
                   wd.name  AS definition_name,
                   cp.slug  AS current_phase_slug,
                   cp.phase_index AS current_phase_index,
                   (SELECT count(*) FROM workflow_phases wp
                     WHERE wp.workflow_run_id = wr.id) AS total_phases
            FROM workflow_runs wr
            JOIN workflow_definitions wd ON wd.id = wr.definition_id
            LEFT JOIN workflow_phases cp ON cp.id = wr.current_phase_id
            WHERE wr.id = $1
            """,
            UUID(active_workflow_run_id) if isinstance(active_workflow_run_id, str) else active_workflow_run_id,
        )
        if wf_row is not None:
            run_status = wf_row["status"]
            wf_continues_used = wf_row["continues_used"] or 0
            definition_slug = wf_row["definition_slug"]
            definition_name = wf_row["definition_name"]
            current_phase_slug = wf_row["current_phase_slug"]
            current_phase_index = wf_row["current_phase_index"]
            total_phases = wf_row["total_phases"]

    # mode / locked / lock_is_stale derive from the anchor + run terminality.
    mode = "harness" if active_workflow_run_id is not None else "deep"
    locked = (
        active_workflow_run_id is not None
        and run_status is not None
        and run_status not in _TERMINAL_WORKFLOW_STATUSES
    )
    # SC#5 heal: anchor set BUT the run row is missing OR terminal -> stale lock.
    lock_is_stale = active_workflow_run_id is not None and (
        run_status is None or run_status in _TERMINAL_WORKFLOW_STATUSES
    )

    # Phase 092-05 F2 backstop: even if workflow_runs.status somehow lagged at a
    # non-terminal value (e.g. a crash between run_workflow's two writes), if the
    # underlying producer `runs` row for this thread is terminal/missing the lock
    # is stale — surface it so the F3 frontend treats the thread as unlocked
    # (self-heals a future stranded lock on reconcile). PURE READ — no writes
    # (the test_thread_workflow_endpoint.py pure-read invariant must hold).
    producer_terminal = False
    # Facet C (092-07): surface the thread's latest producer runs.run_id WHEN live
    # (non-terminal) so the StreamsProvider reconcile re-attaches a startup-sweep-
    # resumed run's live stream (GET /runs/{id}/stream) on mount with no page
    # action. We REUSE the existing F2 self-heal SELECT — add `run_id` to it (no
    # new query, no write — the 092-05 pure-read F2 invariant holds).
    latest_producer_run_id = None
    if active_workflow_run_id is not None and not lock_is_stale:
        prod_row = await pool.fetchrow(
            "SELECT run_id, status FROM runs WHERE thread_id = $1 "
            "ORDER BY started_at DESC LIMIT 1",
            UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        )
        prod_status = prod_row["status"] if prod_row is not None else None
        producer_terminal = prod_status in (
            "completed", "failed", "cancelled", "timed_out"
        )
        # Only point the frontend at a stream that is still being written (live).
        if prod_row is not None and not producer_terminal:
            latest_producer_run_id = prod_row["run_id"]
    lock_is_stale = lock_is_stale or producer_terminal

    # 3. cap_paused / continues: a workflow run carries it on workflow_runs; a
    # Deep run carries it on the latest non-terminal `runs` row (RESEARCH Q3 —
    # report from whichever run holds the pause).
    cap_paused = run_status == "cap_paused"
    continues_used = wf_continues_used
    if not cap_paused:
        # Look at the thread's latest cap_paused `runs` row (Deep-run Continue case).
        deep_row = await pool.fetchrow(
            """
            SELECT status, continues_used
            FROM runs
            WHERE thread_id = $1 AND status = 'cap_paused'
            ORDER BY started_at DESC
            LIMIT 1
            """,
            UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        )
        if deep_row is not None:
            cap_paused = True
            continues_used = deep_row["continues_used"] or 0

    # Phase 098-UAT run-honesty fix (B) — surface the run's DURABLE per-phase status
    # array so the frontend reconcile floor can rebuild an HONEST timeline on
    # revisit/reload. A COMPLETED harness run CLEARS the thread anchor (mode flips
    # back to "deep"), so the timeline previously vanished on revisit — the panel
    # had no run reference at all. Resolve the phases from the active anchor when
    # set, ELSE from the thread's LATEST workflow_run (by thread_id) so a finished
    # workflow thread still yields its historical timeline. mode/locked/lock_is_stale
    # stay anchor-based and UNCHANGED — this is a pure additive read used only by the
    # panel timeline; a pure-deep thread (no workflow_run ever) yields phases=None.
    phases_source_run_id = active_workflow_run_id
    if phases_source_run_id is None:
        latest_wf = await pool.fetchrow(
            "SELECT id FROM workflow_runs WHERE thread_id = $1 "
            "ORDER BY created_at DESC LIMIT 1",
            UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        )
        if latest_wf is not None:
            phases_source_run_id = latest_wf["id"]
    if phases_source_run_id is not None:
        phase_rows = await pool.fetch(
            "SELECT slug, phase_index, status FROM workflow_phases "
            "WHERE workflow_run_id = $1 ORDER BY phase_index",
            UUID(phases_source_run_id) if isinstance(phases_source_run_id, str) else phases_source_run_id,
        )
        if phase_rows:
            # Derive slug → phase_type from the definition JSON so the frontend
            # timeline can render the correct 3D icon for completed/historical runs
            # (the workflow_phases table doesn't store phase_type).
            slug_to_type: dict[str, str] = {}
            def_row = await pool.fetchrow(
                "SELECT wd.definition FROM workflow_runs wr "
                "JOIN workflow_definitions wd ON wd.id = wr.definition_id "
                "WHERE wr.id = $1",
                UUID(phases_source_run_id) if isinstance(phases_source_run_id, str) else phases_source_run_id,
            )
            if def_row is not None:
                try:
                    defn = def_row["definition"]
                    if isinstance(defn, str):
                        import json as _json
                        defn = _json.loads(defn)
                    for p in (defn or {}).get("phases", []):
                        slug = p.get("slug", "")
                        ptype = (p.get("config") or {}).get("phase_type", "")
                        if slug and ptype:
                            slug_to_type[slug] = ptype
                except Exception:
                    pass
            phases_list = [
                WorkflowPhaseState(
                    slug=r["slug"],
                    phase_index=r["phase_index"],
                    status=r["status"],
                    phase_type=slug_to_type.get(r["slug"]),
                )
                for r in phase_rows
            ]

    return ThreadWorkflowState(
        thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        mode=mode,
        locked=locked,
        active_workflow_run_id=(
            UUID(active_workflow_run_id)
            if isinstance(active_workflow_run_id, str)
            else active_workflow_run_id
        ),
        run_status=run_status,
        definition_slug=definition_slug,
        definition_name=definition_name,
        current_phase_slug=current_phase_slug,
        current_phase_index=current_phase_index,
        total_phases=total_phases,
        lock_is_stale=lock_is_stale,
        cap_paused=cap_paused,
        continues_used=continues_used,
        continues_remaining=max(0, _MAX_CONTINUES_PER_RUN - continues_used),
        latest_producer_run_id=(
            UUID(latest_producer_run_id)
            if isinstance(latest_producer_run_id, str)
            else latest_producer_run_id
        ),
        phases=phases_list,
    )


# ───────────────────────────────────────────────────────────────────────
# Phase 092 (092-03 / CONT-01) — Deep-run continuation spawner.
# POST /runs/{id}/continue (runs.py) calls this to re-drive the SAME run_id
# within a FRESH bounded budget, CONSUMING the persisted dropped tool calls
# (SC#4). NET-NEW (PATTERNS.md "No Analog Found"): the Deep-run continuation.
# Mirrors agent_runner's _shielded_finalize ordering (persist → finalize_run →
# sentinel → expire → zrem); the only twist is the cap_paused disposition —
# if the continuation hits the cap AGAIN, it re-pauses (no terminal sentinel)
# so the next Continue can resume, instead of finalizing terminal.
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

    async def _continuation() -> None:
        _terminal_status = "completed"
        _terminal_error: str | None = None
        _result_sink: dict = {}
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
            except Exception as e:  # noqa: BLE001 — mirror agent_runner classifier
                _terminal_status = "failed"
                _terminal_error = f"failed: {type(e).__name__}: {(str(e) or '')[:200]}"
                logger.exception("Continuation run %s failed", run_id)
        finally:
            # cap_disposition override — if the cap fired AGAIN, stay non-terminal.
            _cap = _result_sink.get("cap_disposition")
            if _cap == "cap_paused":
                _terminal_status = "cap_paused"

            async def _finalize() -> None:
                _persist = _result_sink.get("persist")
                _persist_sys = _result_sink.get("persist_system_warnings")
                _sink_warnings = _result_sink.get("persisted_system_warnings") or []
                _in_tok = _result_sink.get("input_tokens_total")
                _out_tok = _result_sink.get("output_tokens_total")
                _msg_id: str | None = None
                try:
                    if _persist is not None:
                        _msg_id = await _persist()
                except BaseException:
                    logger.exception("Continuation persist failed for run %s", run_id)
                try:
                    if _persist_sys is not None and _sink_warnings:
                        await _persist_sys(_sink_warnings)
                except BaseException:
                    logger.exception("Continuation sys-warning persist failed for run %s", run_id)

                # Phase 138 RUN-01b (SITE 2 / LOCK-1) — a Continue-completed run ending
                # with open todos is just as dishonest as a first-turn completion, so it
                # must reconcile too. Positioned AFTER persist and BEFORE finalize_run so
                # the todo_updated emit lands before the terminal sentinel (S5). PLAIN
                # gate here (no cap_disposition clause): this finalizer's own `finally`
                # (~2104-2107) already set _terminal_status = "cap_paused" when the cap
                # fired, so a cap-paused continuation never reaches "completed".
                # Best-effort — never raises into the finalizer.
                if _terminal_status == "completed":
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

                # Phase 145-03 (D-145-09) — TRUE terminals route the runs.status write
                # + both ZREMs through the atomic owner (was: finalize_run here + a
                # separate gated ZREM ×2 below). cap_paused is NON-terminal +
                # re-attachable: it MUST keep its runs:active membership, so it still
                # writes its status via the shared finalize_run DIRECTLY (NOT the owner,
                # which would ZREM) — mirroring the old != "cap_paused" skip gate exactly.
                if _terminal_status != "cap_paused":
                    try:
                        await finalize_run_terminal(
                            pool=await get_pg_pool(),
                            redis=redis,
                            run_id=run_id,
                            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                            status=_terminal_status,
                            error=_terminal_error,
                            completed_at=datetime.now(timezone.utc),
                            message_id=UUID(_msg_id) if _msg_id else None,
                            input_tokens=_in_tok,
                            output_tokens=_out_tok,
                        )
                    except BaseException:
                        logger.exception("Continuation finalize+ZREM failed for run %s", run_id)
                else:
                    try:
                        await finalize_run(
                            await get_pg_pool(),
                            run_id=run_id,
                            status=_terminal_status,
                            error=_terminal_error,
                            completed_at=datetime.now(timezone.utc),
                            message_id=UUID(_msg_id) if _msg_id else None,
                            input_tokens=_in_tok,
                            output_tokens=_out_tok,
                        )
                    except BaseException:
                        logger.exception("Continuation cap_paused status write failed for run %s", run_id)
                # cap_paused is NON-terminal — NO terminal sentinel (Landmine 6).
                # The agent_loop already emitted the non-terminal cap_paused event.
                if _terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE:
                    try:
                        await _emit_terminal(
                            redis, run_id,
                            _RUN_STATUS_TO_TERMINAL_TYPE[_terminal_status],
                            error=_terminal_error,
                        )
                    except BaseException:
                        logger.exception("Continuation sentinel XADD failed for run %s", run_id)
                _ttl = 600 if _terminal_status == "completed" else 60
                try:
                    await redis.expire(f"run:{run_id}", _ttl)
                except BaseException:
                    logger.exception("Continuation EXPIRE failed for run %s", run_id)
                # cap_paused keeps the run in the active sorted sets (re-attachable);
                # a true terminal status ZREMs them — that ZREM now lives INSIDE the
                # finalize_run_terminal owner above (Phase 145-03 / D-145-09), so the
                # standalone runs:active removal that used to live here is gone. The
                # cap_paused branch above (plain finalize_run) deliberately skips it.

            try:
                await asyncio.shield(_finalize())
            except asyncio.CancelledError:
                raise
            finally:
                RUN_TASKS.pop(run_id, None)

    task = asyncio.create_task(_continuation())
    RUN_TASKS[run_id] = task

    def _evict(_t, _rid=run_id):
        RUN_TASKS.pop(_rid, None)
    task.add_done_callback(_evict)
