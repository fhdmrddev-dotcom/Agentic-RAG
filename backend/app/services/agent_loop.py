"""The agent iteration loop for the agent_runner producer.

Extracted from threads.py (Phase 089, G-5 mandated refactor). Owns the
multi-iteration tool-calling loop, the three provider chunk-handlers, and the
assistant-message persistence path — all lifted VERBATIM from the
``send_message``/``agent_runner`` closure scope so the harness (Phase 091) can
sit on a clean module instead of the 3,186-LOC god file.

The caller in threads.py constructs a frozen ``RunContext`` once per run and
delegates the loop through ``run_agent_loop(ctx, *, emit, emit_terminal,
spawn)``. The loop returns an ``AgentLoopResult`` carrying the bound persist
callable + token totals + persisted system warnings so the producer's shielded
finalizer (which STAYS in threads.py) can complete the run.

Behavior-preserving: this module changes file location only, never behavior.
A careless "while-I'm-in-here" cleanup re-opens the 075.x cross-provider
cascade — the three chunk-handlers stay three separate functions, every
per-provider round-trip invariant is preserved byte-identically.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Awaitable, Callable
from uuid import UUID

# Phase 089 Plan 03 (G-5 verbatim move): the loop body lifted from threads.py
# reads these symbols from their ORIGINAL source modules — NOT re-exported
# through threads.py (that would re-create the import cycle the seam avoids,
# Pitfall 4). The callables emit/emit_terminal/spawn are passed in (kw-only),
# never imported.
import openai
from openai import APIError
import anthropic
from google.genai import errors as google_errors
try:
    from anthropic import APIError as AnthropicAPIError
except ImportError:
    AnthropicAPIError = Exception  # fallback if SDK not installed

from starlette.concurrency import run_in_threadpool

from app.config import settings, get_model_capability_async, get_per_call_timeout_async
from app.services.openai_service import (
    get_explorer_tools,
    EXPLORER_SYSTEM_PROMPT,
    CallingMode,
    get_tools,
)
# Phase 092.5 Wave 4 (D-04): create_adaptive_streaming_chat + normalize_finish_reason
# moved BEHIND the gateway — the OpenAI-compat adapter
# (app.services.provider_gateway.openai_compat) wraps create_adaptive_streaming_chat
# and calls normalize_finish_reason internally; run_agent_loop dispatches via
# open_stream and no longer references either directly.
from app.services.anthropic_service import stream_anthropic
from app.services.google_service import stream_google
from app.services.tool_parser import parse_structured_tool_calls
from app.services.tool_dispatcher import ToolContext, ToolResult, dispatch_tool
# Phase 095.1-04 (D-095.1-03 / PROVIDER-ERR): the per-provider gateway-boundary
# error classifier — replaces the billing-first keyword if-ladder in the outer
# APIError catch so a 429 (incl. Google RESOURCE_EXHAUSTED) reads as rate_limit,
# NEVER billing (closes BUG-260606-01). Pure helper; adapters untouched.
from app.services.provider_gateway import classify_provider_error, message_for_kind
from app.utils.db import aexec
from app.dependencies import get_pg_pool
from app.db.runs import insert_assistant_message
from app.utils.folder_utils import fetch_visible_folders
from app.services.context_window import (
    trim_messages_to_fit,
    estimate_messages_tokens,
    resolve_context_budget,
)
# Phase 123-01 (D-01): the relaxed "## Available Skills" catalog-note policy lives
# in skill_lint as the single source of truth, so this runtime note and the Plan 03
# Tuner classifier measure the SAME production policy (Pitfall 1 fidelity guard).
from app.services.skill_lint import LOAD_SKILL_POLICY

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase 129 D-01 / D-03 (MP-04): MiniMax truncated-tool-args repair primitives
# ---------------------------------------------------------------------------
# These are pure, side-effect-free helpers so the guard's decision logic is
# unit-testable in isolation (test_129_minimax_argrepair.py) WITHOUT driving the
# full streaming agent loop. The inline seam in run_agent_loop delegates to them.

# The corrective nudge injected on a re-ask (drop the bad turn, ask the model to
# re-emit complete arguments; suggest splitting large code across calls — Open Q3).
MINIMAX_ARGREPAIR_NUDGE = (
    "Your previous tool call's arguments were truncated or invalid JSON "
    "(the model hit its output token limit mid-argument). Re-emit the tool call "
    "with complete, well-formed arguments. If the code is large, split it across "
    "multiple smaller execute_code calls so no single call exceeds the output budget."
)


def _minimax_args_all_valid(tool_calls: list[dict]) -> bool:
    """True iff EVERY tool_call's `arguments` string is well-formed JSON.

    The MiniMax truncation failure mode: the model runs out of output budget
    mid-`arguments` and emits a truncated (therefore invalid) JSON string, yet
    still reports finish_reason="tool_calls" (so the existing length guards never
    fire — Pitfall 2). We validate the args JSON DIRECTLY here, independent of
    finish_reason. A truncated arg CANNOT be coerced (never brace-balance /
    re-escape — that fabricates a partial dispatch, violating D-01); the caller
    re-asks instead. Mirrors the stdlib coercion precedent at
    tool_dispatcher.py:2450 (write_todos, BUG-260529-01).
    """
    for tc in tool_calls:
        try:
            json.loads(tc["arguments"])
        except (ValueError, TypeError):
            return False
    return True


def minimax_argrepair_decision(
    resolved_provider: str,
    tool_calls: list[dict],
    argrepair_retries: int,
    argrepair_pending: bool,
) -> str:
    """Decide what the round-trip seam should do for a buffered tool-call turn.

    Pure decision function (no I/O) — the single source of truth for the D-01
    ladder. Returns one of:

      - "ok"         : append the assistant tool_calls turn unchanged (happy path
                       AND every non-MiniMax provider — D-14 RED LINE).
      - "reask"      : MiniMax args invalid + re-ask budget remaining → drop the
                       bad turn, inject the corrective nudge, continue (bounded to
                       ONE re-ask via argrepair_retries < 1).
      - "honest_fail": MiniMax args invalid + budget exhausted → surface the
                       existing bad_request copy and end the run (never a silent
                       swallow, never a fabricated dispatch).
      - "recovered"  : a prior re-ask just succeeded (this turn's MiniMax args are
                       valid AND argrepair_pending was set) → emit the quiet
                       tool_args_recovered signal, then append.

    RED LINE (D-14): for any non-MiniMax provider this always returns "ok" — the
    guard NEVER fires for openai/anthropic/google (test_non_minimax_unaffected).
    """
    if resolved_provider != "minimax":
        return "ok"
    if _minimax_args_all_valid(tool_calls):
        return "recovered" if argrepair_pending else "ok"
    # Invalid args under MiniMax.
    return "reask" if argrepair_retries < 1 else "honest_fail"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RunContext:
    """Carries the stable per-run INPUTS that run_agent_loop reads, lifted from
    the send_message/agent_runner closure scope.

    Frozen on purpose (Pitfall 3): inputs only, mutated nowhere. All mutable
    accumulators (full_content, token totals, persisted_tool_calls, ...) stay
    loop-local inside run_agent_loop, never on this context — frozen catches
    an accidental accumulator-on-context bug early, and keeps the object safe
    to construct once per run under WORKER_COUNT=2.
    """
    run_id: UUID
    thread_id: str
    current_user: dict  # {"id": str, ...}
    user_settings: Any  # UserEffectiveSettings (resolved, provider-overridden)
    body: Any  # MessageCreate (body.model / .provider / .agent_mode / .content)
    redis: Any  # redis.asyncio client
    supabase: Any  # supabase Client
    resolved_model: str
    resolved_provider: str
    # Phase 092 (092-03 / CONT-01) — ADDITIVE Continue-resume inputs. OFF by
    # default at EVERY existing call site → Deep Mode byte-identical (075.x
    # cascade rule). The Continue endpoint constructs a RunContext with
    # ``resume_dropped_tool_calls=True`` and ``dropped_tool_calls=<persisted
    # carrier payload>`` so the continuation CONSUMES the dropped calls (SC#4)
    # instead of re-dropping/restarting. A frozen tuple keeps the dataclass
    # hashable/immutable; the loop reads it as the first dispatch round.
    resume_dropped_tool_calls: bool = False
    dropped_tool_calls: tuple = ()
    # Phase 133 (133-02 / EVAL-02) — ADDITIVE skill-catalog override for the
    # honest eval A/B. OFF by default (None) at EVERY existing call site → Deep
    # Mode byte-identical (the 092 default-off precedent above). None = query the
    # DB (current behavior, D-14 red line); () = inject NOTHING (WITHOUT arm,
    # D-04 — the `if enabled_skills:` guard short-circuits); (skill, ...) = inject
    # EXACTLY these skills (WITH arm, D-03), no DB query. A frozen tuple keeps the
    # dataclass hashable/immutable; each dict needs only `name` + `description`.
    skill_catalog_override: tuple[dict, ...] | None = None


@dataclass
class AgentLoopResult:
    """Structured return from run_agent_loop — the outputs the producer's
    shielded finalizer (STAYS in threads.py) needs after the loop ends.

    Plain (non-frozen) like ToolResult — it is a return bag, not an input
    context. _shielded_finalize reads the token totals + persisted warnings and
    calls persist() (the bound _persist_assistant_message) to complete the run.

    SEAM §3 locks the 5 finalizer-output fields below. ``persist_system_warnings``
    is a 6th bound callable carried out of structural necessity (Phase 089-03
    deviation, Rule 3): ``_persist_system_messages`` is nested inside
    ``run_agent_loop`` (it closes over ctx + _strip_nul), yet the shielded
    finalizer in threads.py must call it AFTER the loop returns. The only
    cycle-free way for the finalizer to reach a function nested in
    ``run_agent_loop`` is to return its bound reference — same mechanism as
    ``persist`` (the bound ``_persist_assistant_message``). Behavior-preserving:
    the finalizer's call order (persist → persist_system_warnings → finalize_run
    → sentinel → expire → zrem) is byte-identical to the pre-move shielded
    finalizer (I10 / Pitfall 5).
    """
    persist: Callable[..., Awaitable[Any]]  # reference to the bound _persist_assistant_message
    input_tokens_total: int | None = None
    output_tokens_total: int | None = None
    persisted_system_warnings: list[dict] = field(default_factory=list)
    full_content_final: str = ""
    # 6th field (089-03): bound _persist_system_messages — see class docstring.
    persist_system_warnings: Callable[..., Awaitable[Any]] | None = None
    # Phase 092 (092-03 / SC#4): 'cap_paused' when the iteration cap fired WITH a
    # non-empty buffer (the producer writes this non-terminal status); else None.
    cap_disposition: str | None = None


# ---------------------------------------------------------------------------
# Phase 092 (092-03 / SC#4) — iteration-cap PERSIST (was DROP). The cap site
# used to DESTROY the buffered tool calls (``tool_calls_buffer = {}``); SC#4
# turns that into PERSIST-then-pause so a Continue can CONSUME them. These
# helpers keep the carrier-row shape + the non-terminal cap_paused event
# deterministically testable without driving the whole streaming loop.
# ---------------------------------------------------------------------------

def build_cap_paused_carrier_tool_calls(tool_calls_buffer: dict) -> list[dict]:
    """The durable ``messages.tool_calls`` jsonb payload for a cap-paused run.

    Mirrors the ask_user_response carrier shape (runs.py:531-543) — one entry
    per buffered tool call, tagged ``kind='iteration_cap_paused'`` so the
    Continue endpoint can read it OUT-OF-BAND (it is BUG-260528-01-filtered from
    /messages). Preserves the EXACT name + arguments + id of every dropped call
    so the continuation re-executes them (consume, not re-drop — SC#4).
    """
    carrier: list[dict] = []
    for tc in tool_calls_buffer.values():
        carrier.append({
            "kind": "iteration_cap_paused",
            "tool_call_id": tc.get("id"),
            "name": tc.get("name", "?"),
            "arguments": tc.get("arguments"),
        })
    return carrier


async def persist_cap_paused(
    *,
    redis,
    run_id: UUID,
    thread_id: str,
    user_id: str,
    supabase,
    tool_calls_buffer: dict,
    continues_used: int,
    emit: Callable[..., Awaitable[Any]],
) -> str:
    """Persist the dropped tool calls + emit the NON-terminal cap_paused event.

    Called at the iteration cap (force_no_tools WITH a non-empty buffer) BEFORE
    the caller clears ``tool_calls_buffer`` — so the calls are durable first
    (SC#4). Order: (1) durable role='system' carrier row, (2) distinct
    NON-terminal ``cap_paused`` SSE event (Landmine 6 — NOT a terminal sentinel,
    so the frontend keeps the stream attachable for Continue). Returns the
    terminal disposition (``cap_paused``) the producer's finalizer writes.
    """
    tool_names = [tc.get("name", "?") for tc in tool_calls_buffer.values()]
    carrier = build_cap_paused_carrier_tool_calls(tool_calls_buffer)

    # (1) DURABLE persist FIRST (the Continue endpoint reads this row).
    try:
        await aexec(
            supabase.table("messages").insert({
                "thread_id": thread_id,
                "user_id": user_id,
                "role": "system",
                "content": (
                    f"⏸ Reached the iteration limit with {len(tool_names)} "
                    f"tool(s) still queued. Continue to run them."
                ),
                "tool_calls": carrier,
            })
        )
    except Exception:
        logger.exception(
            "cap_paused carrier persist failed for run %s (%d tools dropped)",
            run_id, len(tool_names),
        )

    # (2) NON-terminal cap_paused SSE event — carries names + continue counters.
    max_continues = settings.max_continues_per_run
    continues_remaining = max(0, max_continues - continues_used)
    await emit(
        redis, run_id, 'cap_paused',
        kind="iteration_cap_paused",
        message=(
            f"⏸ Reached the iteration limit — {len(tool_names)} tool(s) "
            f"weren't run yet. Continue to run them."
        ),
        tool_names=tool_names,
        continues_used=continues_used,
        continues_remaining=continues_remaining,
    )
    return "cap_paused"


# ---------------------------------------------------------------------------
# Pure helpers (moved verbatim from threads.py — Phase 089 Plan 01)
# ---------------------------------------------------------------------------

# Phase 075.1 Plan 02 Task 2 — pure drain step.
# Deterministic, no async, no Docker. Extracted from the inline
# accumulator in the sandbox drain loop (`while True` consumer near
# the execute_code branch) so the line-buffer logic can be exercised
# by deterministic unit tests at backend/tests/unit/test_075_1_drain_step.py
# without requiring a running Docker daemon.
#
# Contract:
#   item = {"type": "stdout_chunk"|"stderr_chunk", "content": str, "captured_at": float}
#   state = {"stdout_partial": str, "stderr_partial": str}
#   returns (emit_calls, new_state) where each emit_call is a tuple
#   (event_type, content, captured_at). The caller is responsible for
#   awaiting `_emit(redis, run_id, event_type, content=..., captured_at=...)`
#   for each entry and merging new_state back into its loop-local state.
#
# Invariants:
#   - captured_at on emitted tuples is item["captured_at"] verbatim —
#     never a fresh time.time() reading. This preserves SC #2's
#     monotonic-captured_at assertion in test_075_code_stdout_progressive.py.
#   - CRLF normalises to LF before split so Windows-style line endings
#     don't leak as bare '\r' (D-075-06 + PATTERNS.md §4).
#   - Unknown item types are no-ops (state passes through unchanged) —
#     the caller handles _done and other terminal items separately.
def drain_step(
    item: dict,
    state: dict,
) -> tuple[list[tuple[str, str, float]], dict]:
    """Pure transform: chunk + state → emit calls + new state."""
    emit_calls: list[tuple[str, str, float]] = []
    stdout_partial = state.get("stdout_partial", "")
    stderr_partial = state.get("stderr_partial", "")
    item_type = item.get("type")
    if item_type == "stdout_chunk":
        captured_at = item["captured_at"]
        combined = (stdout_partial + item["content"]).replace("\r\n", "\n")
        lines = combined.split("\n")
        stdout_partial = lines.pop()
        for line in lines:
            emit_calls.append(("code_stdout", line, captured_at))
    elif item_type == "stderr_chunk":
        captured_at = item["captured_at"]
        combined = (stderr_partial + item["content"]).replace("\r\n", "\n")
        lines = combined.split("\n")
        stderr_partial = lines.pop()
        for line in lines:
            emit_calls.append(("code_stderr", line, captured_at))
    return emit_calls, {
        "stdout_partial": stdout_partial,
        "stderr_partial": stderr_partial,
    }


# Phase 067.1 Plan 01 Track A: drain-into-queue helper.
#
# Why this exists: langsmith-py 0.2.3..0.8.2's `_TracedStream.__iter__` is a
# generator (`yield from self.__ls__gen__`) wrapped in `except BaseException`.
# When an outer `for chunk in stream:` loop exits via asyncio cancellation
# (asyncio.timeout fires), Python's for-loop semantics call `iterator.close()`
# on the generator AS PART OF THE LOOP'S OWN CLEANUP — `GeneratorExit` is
# thrown INTO `_TracedStream.__iter__` at the `yield from` point, caught by
# `except BaseException as e:`, and recorded via `_end_trace(error=e)`. By
# the time control reaches our `except asyncio.TimeoutError:` block, the
# trace has already been closed with `error=GeneratorExit`. Calling
# `stream.close()` from the except handler is too late — Pitfall 1, Phase
# 067.1 RESEARCH.md.
#
# The fix: own the iteration ourselves. Run the sync `for chunk in stream:`
# loop on the default executor; the for-loop runs to natural StopIteration
# when we close the underlying SDK stream from the OUTSIDE (main thread).
# Our async-side timeout cancels OUR queue consumer (a clean asyncio
# CancelledError caught locally) — the langsmith generator never sees a
# close-from-outside, takes the `else: self._end_trace()` branch, and
# closes the trace cleanly with `error=None`.
async def _drain_stream_with_close_on_cancel(
    stream,
    timeout_seconds,
    on_chunk_async,
    close_fn=None,
):
    """Iterate ``stream`` under ``asyncio.timeout``; on cancel, close the
    underlying SDK stream (sync, idempotent) BEFORE the producer's for-loop
    cleanup propagates GeneratorExit into langsmith's _TracedStream.__iter__.

    Args:
        stream: A sync iterable (OpenAI ``Stream`` / langsmith ``_TracedStream``
            wrapper / ``stream_anthropic`` generator). The for-loop runs in a
            thread pool worker so its implicit cleanup is decoupled from our
            async timeout.
        timeout_seconds: Per-call deadline in seconds. ``asyncio.timeout``
            wraps OUR queue consumer (the `await q.get()` line below). When
            the deadline fires, we cancel the producer by closing the SDK
            stream — NOT by raising into the producer thread.
        on_chunk_async: Async callable invoked per chunk in the consumer loop.
            Runs on the event-loop thread, so all ``_emit(...)`` / Supabase
            calls Just Work.
        close_fn: Optional sync callable to close the underlying SDK stream
            on timeout. If None, falls back to ``stream.close()``. Anthropic
            uses ``_ant_gen.close()`` (the wrapping generator) — pass that
            here for the Anthropic branch. SYNC method (openai 2.28.0 /
            anthropic 0.97.0); do NOT ``await``.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=64)
    SENTINEL = object()
    EXC_SENTINEL = object()
    producer_exception: list[BaseException] = []

    loop = asyncio.get_running_loop()

    def _producer():
        # Sync producer — drives _TracedStream.__iter__ to completion.
        # When stream.close() is called from the consumer's except-block
        # (main thread), the underlying httpx response closes; the
        # `for chunk in stream:` loop exits via natural StopIteration;
        # _TracedStream.__iter__ takes the `else: self._end_trace()`
        # branch — clean trace closure with error=None.
        try:
            for chunk in stream:
                # call_soon_threadsafe: queue is event-loop-bound; producer
                # is on a thread, so put_nowait would race with the consumer.
                fut = asyncio.run_coroutine_threadsafe(q.put(chunk), loop)
                try:
                    fut.result()  # block this worker thread until queued
                except BaseException:
                    # consumer-side cancellation observed by run_coroutine_threadsafe
                    return
        except BaseException as e:
            producer_exception.append(e)
        finally:
            # Always signal end-of-stream. asyncio.run_coroutine_threadsafe
            # is safe even if the loop is closing — fut.result() will raise
            # but we ignore it; the consumer is already past q.get() at that
            # point (cancel path) or will pick up the SENTINEL (clean path).
            try:
                fut = asyncio.run_coroutine_threadsafe(q.put(SENTINEL), loop)
                fut.result(timeout=2.0)
            except BaseException:
                pass

    producer_fut = loop.run_in_executor(None, _producer)

    try:
        async with asyncio.timeout(timeout_seconds):
            while True:
                chunk = await q.get()
                if chunk is SENTINEL:
                    break
                await on_chunk_async(chunk)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        # Close the underlying SDK stream from the MAIN THREAD. The producer
        # thread's `for chunk in stream:` then exits via StopIteration —
        # _TracedStream.__iter__ closes cleanly via `else: self._end_trace()`.
        try:
            (close_fn or stream.close)()
        except Exception:
            logger.debug(
                "stream close raised during Track A drain cancel — non-fatal",
                exc_info=True,
            )
        # Wait briefly for producer to drain & post SENTINEL — bounded so a
        # genuinely-stuck SDK call cannot wedge the request handler.
        try:
            await asyncio.wait_for(asyncio.wrap_future(producer_fut), timeout=2.0)
        except Exception:
            logger.debug(
                "producer await raised during Track A drain cancel — non-fatal",
                exc_info=True,
            )
        raise
    # Re-raise any non-cancel error captured from the producer thread.
    if producer_exception:
        raise producer_exception[0]


def _strip_nul(obj):
    """Recursively strip PostgreSQL-illegal null bytes (\\x00) from strings."""
    if isinstance(obj, str):
        return obj.replace('\x00', '')
    if isinstance(obj, dict):
        return {k: _strip_nul(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip_nul(item) for item in obj]
    return obj


# ---------------------------------------------------------------------------
# Module-level helpers moved verbatim from threads.py (Phase 089 Plan 03).
#
# These are pure functions / constants the loop body reads. They MOVE here
# (re-imported into threads.py for backward-compat — mirrors the Plan 01 move
# of drain_step / _strip_nul) so the loop body references SAME-MODULE symbols
# and the agent_loop -> threads import cycle is never created (Pitfall 4).
# Byte-identical relocation — zero logic change (D-089-03).
# ---------------------------------------------------------------------------

def _is_transient_provider_error(e: APIError) -> bool:
    """Return True if this is a transient provider failure safe to retry.

    Checks status code, structured body (OpenRouter puts real code in e.body),
    and message text. Never retries auth, billing, or parameter errors.
    """
    if e.status_code in (502, 503, 529):
        return True
    try:
        code = e.body.get("error", {}).get("code")
        if code in (502, 503, 529):
            return True
    except (AttributeError, TypeError):
        pass
    msg_lower = str(getattr(e, "message", "") or e).lower()
    return any(kw in msg_lower for kw in (
        "provider returned error", "upstream", "bad gateway", "service unavailable",
    ))


SYSTEM_PROMPT = (
    "You are a helpful AI assistant with access to the user's document library.\n\n"

    "## CRITICAL: Two operating modes\n"
    "**Q&A / retrieval** (DEFAULT — use this unless the user explicitly requests a file): "
    "The user asks a question and wants a text answer. Search or analyze documents, then respond with text. "
    "After each tool call, check: do I have enough to answer? If yes — respond directly. "
    "Do NOT call more tools to verify what you already have.\n"
    "**File generation** (ONLY when the user explicitly asks you to CREATE, GENERATE, BUILD, or MAKE a downloadable file): "
    "The user uses action verbs like 'create a PowerPoint', 'generate a PDF report', 'build me an Excel sheet', "
    "'make a Word document'. Retrieve/analyze the required content, then call execute_code to produce the file.\n\n"

    "**Disambiguation — when in doubt, default to Q&A.** "
    "If the user says 'summarize the report' or 'what does the report say?' — that is Q&A, respond with text. "
    "If the user says 'create a summary report as a Word doc' — that is file generation, use execute_code. "
    "The presence of words like 'report', 'summary', 'analysis' does NOT mean file generation. "
    "Only trigger execute_code when the user explicitly asks for a downloadable file.\n\n"

    "## Tool selection guide\n"
    "Pick the ONE tool that best fits the task:\n"
    "- **search_documents** → reading passage content: finding facts, quotes, figures, or explanations *inside* documents. "
    "The returned chunks are pre-extracted relevant passages — read them carefully. If they contain the answer, stop there. "
    "Only add `metadata_filter` when the user explicitly asks to scope by author, date, or document type — never guess filter values.\n"
    "- **query_documents** → metadata/structural questions: counts, lists, date-range filters, folder membership, file sizes "
    "(e.g. 'how many PDFs from 2023?', 'list all documents by John', 'which files are in the Reports folder'). "
    "These are SQL-style questions about document attributes, not about what documents say.\n"
    "- **analyze_document** → full-document tasks: summarize, compare, or extract all key points from an entire document. "
    "If the target document is ambiguous (user says 'the report' without specifying which), call search_documents or "
    "query_documents first to identify it, then call analyze_document. "
    "**Once analyze_document returns, never call read_document on that same document — the full content has already been processed.**\n"
    "- **ls / tree** → browse folder structure and navigate the knowledge base\n"
    "- **grep** → find documents containing a specific phrase or regex pattern\n"
    "- **glob** → find documents by filename pattern (*.pdf, report-*, etc.)\n"
    "- **read_document** → read a specific section when search chunks are cut off or incomplete; use start_line/end_line; "
    "do NOT call more than once per document per question\n"
    "- **web_search** → current events, software versions, or topics not covered in uploaded documents\n"
    "- **execute_code** → create downloadable files (PowerPoint, PDF, Word, Excel, charts) when the user explicitly asks "
    "for file creation. Also for calculations and data analysis that require Python. "
    "Always pass `libraries` for non-stdlib packages. "
    "Pass `skill_files` to inject skill attachment files into the sandbox at /sandbox/{filename}. "
    "Write output files to /sandbox/output/ and list them in `output_files`. "
    "ALWAYS set `description` to a short, specific label of what the code produces "
    "(e.g. 'Generating Q3 revenue chart', 'Creating the risk-register .docx'), never a generic phrase "
    "like 'Run code' — the user sees this label live in their workspace panel.\n"
    "- **load_skill** → activate a skill; call silently and then follow the skill's instructions exactly\n"
    "- **save_skill / read_skill_file** → skill management\n"
    "- **query_tables** → structured table data from documents: 'show me the revenue table from Q3 Report', "
    "'find rows where Region is APAC', 'what are the column headers in the summary table?'. "
    "Use when the question is about specific values inside a document's tabular data.\n\n"

    "**DO NOT use execute_code for:** answering questions, summarizing documents, explaining concepts, "
    "listing information, comparing documents, or any task where a text response is appropriate. "
    "Only use it when the user wants a downloadable file or needs Python computation.\n\n"

    "**Tiebreaker — search_documents vs query_documents:** If the question is about *what a document says* (content), "
    "use search_documents. If it's about *which documents exist or their attributes* (counts, dates, folders, authors), "
    "use query_documents.\n\n"

    "**Hybrid fallback — do not stop on zero results:** If query_documents returns no rows, the identifier may exist "
    "inside document content — call search_documents with the key term. If search_documents returns no chunks, the user "
    "may be asking about metadata — call query_documents. Always try the other tool before giving up.\n\n"

    "**Multi-document comparison:** Call analyze_document once per document, then synthesize across them in your response. "
    "Do not call search_documents separately for each.\n\n"

    "## Rules\n"
    "- Always cite which document your answer comes from.\n"
    "- Never call the same tool twice with the same arguments.\n"
    "- If search_documents returns relevant chunks, answer from those — do NOT also call read_document on the same document.\n"
    "- **Zero results from search_documents:** If the tool returns no chunks at all, try grep (if the user referenced a "
    "specific phrase) or query_documents (to check whether the document exists). If still nothing, tell the user directly "
    "— do not fabricate.\n"
    "- **Zero results from query_documents:** If the SQL returns no rows, the identifier may appear inside document "
    "content rather than in filenames or metadata. Fall back to search_documents with the key identifier as the query.\n"
    "- **read_document out of bounds:** If a line range returns nothing or is out of bounds, fall back to analyze_document "
    "on that document rather than answering from nothing — unless analyze_document was already called this turn.\n"
    "- **Never loop on read_document:** If two consecutive read_document calls on the same document return no results, stop — do not call it a third time. Answer from what you have or use analyze_document once.\n"
    "- **Web vs documents conflict:** If web_search results conflict with content in your documents, prioritize the "
    "document content and flag the discrepancy explicitly to the user.\n"
    "- **Tool call brevity:** When calling tools, do NOT narrate your plan or reasoning. Just call the tool. "
    "Verbalizing your intent wastes output tokens and can cause the tool call to be cut off mid-stream.\n"
    "- **After analyze_document (file generation task):** If the user asked for a downloadable file, call execute_code "
    "with complete Python code. Do not write long preambles before the tool call — keep text minimal to preserve "
    "output token budget for the code.\n"
    "- **After analyze_document (Q&A task):** Respond with your findings in text. Do not call execute_code.\n"
    "- **Never call execute_code in the same response as search_documents, analyze_document, read_document, or web_search.** "
    "Retrieve content first; call execute_code only in the NEXT iteration after you have received the retrieved data. "
    "Calling execute_code before reading documents produces fabricated content.\n"
    "- **Keep execute_code scripts under 200 lines.** Use data-driven loops and helper functions instead of hardcoding "
    "each slide, section, or page. Monolithic scripts are slow to generate and error-prone. "
    "If the task requires more than 200 lines, split into multiple execute_code calls.\n\n"

    "## Multi-step intent\n"
    "When the user requests a multi-step pipeline — for example:\n"
    "- 'search for X and write a report'\n"
    "- 'find Y, analyze it, then make a chart and a docx'\n"
    "- 'research Z and produce a one-pager'\n"
    "Execute the FULL pipeline end-to-end. The user named the deliverables; deliver them. "
    "After each tool call, continue to the next step in the user's named sequence rather than "
    "asking 'If you want, I can also...', 'Shall I proceed to...', or 'Let me know if you'd "
    "like me to...'. When the pipeline completes, summarize what you produced in your final "
    "text response.\n"
    "- **When you are working through multiple steps or a task list, ALWAYS call write_todos** "
    "to record the task list — do not just narrate the steps in text. The user sees the todo "
    "list in their workspace panel; a narrated list they cannot see is not tracking. Call "
    "write_todos at the START of multi-step work and again to flip a todo's status as you "
    "complete it.\n\n"

    "EXCEPTIONS (still ask for clarification):\n"
    "- The intent is genuinely ambiguous (e.g. 'make me a report' — about what? from which "
    "documents? what format?).\n"
    "- The next step requires information the user did not provide and you cannot infer "
    "from the documents (e.g. specific names, date ranges, file format preferences when "
    "the document corpus has many).\n"
    "- The action would be irreversible or destructive in a way the user might not have "
    "intended (e.g. overwriting / deleting existing artifacts when an alternative path "
    "exists).\n"
    "**In these cases — when you need information only the user has, or must confirm an "
    "ambiguous or destructive action before proceeding — call the ask_user tool rather than "
    "guessing or narrating the question in prose.** Only do this for a genuine blocker; when "
    "the intent is clear and safe, proceed without asking.\n\n"

    "## Confidence & hedging\n"
    "search_documents results include a `similarity` score (0–1). If ALL returned chunks have "
    "similarity below 0.38, the answer is likely not in the documents — say so explicitly: "
    "\"I couldn't find reliable information about this in your documents. The closest match was "
    "[document name] but the similarity was low.\" Do not fabricate an answer from weak matches.\n\n"

    "## Citation format\n"
    "When citing document content, use this format:\n"
    "**[Document Name]** — [section or chapter if identifiable, otherwise omit]\n"
    "Example: **Fahed Mrad Chapters 1-4.docx** — Chapter 3.4\n"
    "Never cite a document you did not retrieve in this response.\n\n"

    "## execute_code output\n"
    "- Inline output (stdout/stderr) is shown in the terminal panel — summarize key findings in your text response; "
    "do not repeat raw output verbatim.\n"
    "- Output files (.pptx, .docx, .pdf, .png, etc.) are automatically shown as download cards in the UI — "
    "do NOT write markdown links or URLs for them. Mention the filename naturally: "
    "'I've created `report.pptx` with 8 slides covering...' — never '[filename](url)' or 'Download: link'.\n\n"

    # Phase 075.1 Plan 04 (B-260519-08 + B-260519-09) — sandbox conventions.
    # Applies uniformly to OpenAI, Anthropic, Google, OpenRouter, Ollama —
    # all providers see this same SYSTEM_PROMPT (unification principle).
    "## Code execution conventions\n"
    "- Always write output files (charts, documents, decks, etc.) to `/sandbox/output/`. "
    "Files written elsewhere are NOT harvested into the download panel — the user can't access them. "
    "Use absolute paths: `/sandbox/output/chart.png`, NOT `chart.png` or `/tmp/chart.png`.\n"
    "- If you hit `ImportError` or `ModuleNotFoundError`, install the missing package first via "
    "`pip install <pkg>` (use `!pip install <pkg>` or `subprocess.run(['pip', 'install', '<pkg>'])` inside the cell) "
    "then retry the code. Do NOT give up after the first import failure. "
    "Common packages are pre-installed (python-pptx, matplotlib, numpy, pandas); "
    "other packages can be installed at runtime in seconds.\n"
)


TOOL_USAGE_INSTRUCTIONS = """

## Tool Usage Format

When you need to use a tool, output a JSON block in this exact format:

```json
{{"tool": "TOOL_NAME", "arguments": {{"arg1": "value1", "arg2": "value2"}}}}
```

Available tools:
{tool_list}

Rules:
1. Output ONLY the JSON block — do not describe your plan or say "Now I'll search..."
2. Use the exact tool name from the list above
3. Include ALL required arguments
4. If you don't need a tool, respond normally with text
"""


def _format_tool_list(tools: list[dict]) -> str:
    """Format tool schemas as a human-readable list for structured mode prompts."""
    lines = []
    for tool in tools:
        fn = tool.get("function", {})
        name = fn.get("name", "unknown")
        desc = fn.get("description", "")
        params = fn.get("parameters", {})
        props = params.get("properties", {})
        required = params.get("required", [])

        lines.append(f"- **{name}**: {desc}")
        if props:
            arg_lines = []
            for arg_name, arg_info in props.items():
                req_flag = " (required)" if arg_name in required else ""
                arg_desc = arg_info.get("description", "")
                arg_type = arg_info.get("type", "any")
                arg_lines.append(f"  - `{arg_name}` ({arg_type}){req_flag}: {arg_desc}")
            lines.extend(arg_lines)
    return "\n".join(lines)


CONFIDENCE_DISCLAIMER = (
    "This answer is based on limited or weakly-matched evidence. "
    "Please verify with the source documents."
)


def _compute_confidence(
    avg_similarity: float,
    settings_obj=None,
    bucket_high: float | None = None,
    bucket_medium: float | None = None,
) -> str:
    """Map average cosine similarity to confidence level (D-10 / D-12).

    Cutoffs are read from settings so confidence labels stay calibrated after an
    embedder switch (D-12): the per-preset `confidence_bucket_high` /
    `confidence_bucket_medium` are app_settings columns (migration 073). Explicit
    `bucket_high` / `bucket_medium` kwargs win, then the `settings_obj` attrs,
    then the shipped 0.54/0.38 defaults — so behavior is byte-identical to today
    when no settings are supplied (D-08 back-compat).

    Thresholds calibrated for text-embedding-3-small. Phase 076 recalibration
    (2026-05-25, N=121 queries, 100 audit_log + 21 synthetic) adjusted from
    0.55/0.40 to 0.54/0.38: post-071.3 extraction stack (camelot tables +
    pymupdf_full images + legacy text) shifted the score distribution lower
    (median 0.4861 vs prior era). New thresholds restore D-04 target bucket
    balance -- high 30.6% / medium 45.5% / low 24.0% (target ~30%/45%/25%).

    Prior calibration: Phase 32.5 (2026-04-18) lowered from 0.70/0.50 to
    0.55/0.40 because text-embedding-3-small produces lower absolute scores
    than expected.
    """
    high = bucket_high
    if high is None:
        high = getattr(settings_obj, "confidence_bucket_high", 0.54) if settings_obj else 0.54
    medium = bucket_medium
    if medium is None:
        medium = getattr(settings_obj, "confidence_bucket_medium", 0.38) if settings_obj else 0.38
    if avg_similarity >= high:
        return "high"
    elif avg_similarity >= medium:
        return "medium"
    return "low"


def _deduplicate_citations(citations: list[dict]) -> list[dict]:
    """Deduplicate citations by (document_id, chunk_index), preserving order (D-14)."""
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


# NOTE (Phase 092.5 Wave 4 / D-04): ``_accumulate_chunk_usage`` MOVED to
# ``app.services.provider_gateway.openai_compat`` (it is the OpenAI-compat adapter's
# pure provider-aware usage helper — Google-cumulative-overwrite vs OpenAI-``+=``).
# The OpenAI normalization now lives in the adapter; the consumer accumulates token
# totals from the canonical ``usage`` events the adapter emits. The unit test
# (``test_chunk_handler_provider_aware.py``) imports it from the new home.


def _apply_origin_filter(history_q, agent_mode: str):
    """CTX-01 (D-120-06): apply the ASYMMETRIC, provider-agnostic origin filter.

    A row-level WHERE pre-filter on ``messages.origin`` that isolates Deep and Harness
    history go-forward in a SHARED thread:

      - Deep / Explorer (``agent_mode != "harness"``): ``neq('origin','harness')`` —
        replays deep + legacy rows (migration 076 fills legacy NULLs to 'deep' so the
        ``neq`` keeps them; the three-valued-logic trap is avoided), but NEVER a
        workflow row.
      - Harness (``agent_mode == "harness"``): ``eq('origin','harness')`` — strict,
        defense-in-depth (A1: the harness does not reconstruct via ``messages`` today;
        this is the one place ``agent_mode`` is evaluated against the history read).

    This is ADDITIVE: it only NARROWS within the already-owner/thread-scoped query — it
    never relaxes ``.eq('thread_id')`` / ``.eq('user_id')`` (V4). It is a SINGLE shared
    clause (no per-provider fork): the same filtered set feeds every provider, so a
    pure-Deep thread returns today's exact set — Deep Mode byte-identical (SC#4). The
    builder is mutated/returned in place (supabase-py chains return the same builder).
    """
    if agent_mode != "harness":
        return history_q.neq("origin", "harness")
    return history_q.eq("origin", "harness")


def _reconstruct_history(history_rows: list[dict], active_provider: str = "") -> list[dict]:
    """
    Reconstruct an OpenAI-compatible multi-turn message list from stored DB rows.

    For assistant messages that have tool_calls with tool_call_id:
      Emits 3 entries: (1) assistant+tool_calls, (2) tool result(s), (3) assistant text.
    For old assistant messages without tool_call_id (backward compat) or with no
    tool_calls: emits a plain {"role": "assistant", "content": ...}.
    User messages pass through unchanged.

    Phase 075.5 D-075.5-01 (supersedes 075.4-02 D-075.4-C3): ``thought_signature`` is
    echoed as a TOP-LEVEL field on each rebuilt tool_call dict when the stored row
    carries one. The Google native SDK path in google_service.py reads this and
    attaches the signature to the function_call Part so Gemini-3+ round-trips it
    correctly (closes BUG-260523-02 for real — the old extra_content shape didn't
    survive openai-python's serialization through Google's OpenAI-compat endpoint).
    The ``active_provider`` arg is kept for back-compat but is no longer load-bearing
    (non-Google providers ignore the field). No schema change: ``messages.tool_calls``
    is already ``jsonb``.
    """
    messages: list[dict] = []
    for msg in history_rows:
        tool_calls_data = msg.get("tool_calls")
        if (
            msg["role"] == "assistant"
            and tool_calls_data
            and isinstance(tool_calls_data, list)
            and len(tool_calls_data) > 0
        ):
            # Only reconstruct if all entries have tool_call_id (new format)
            if all(tc.get("tool_call_id") for tc in tool_calls_data):
                # 1. Assistant message announcing tool calls
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": tc["tool_call_id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc.get("args", {})),
                            },
                            # Phase 075.5 D-075.5-01 — echo thought_signature as a
                            # top-level field. google_service._convert_messages_to_google
                            # reads this and attaches it to the function_call Part for
                            # native SDK round-trip. Non-Google providers ignore unknown
                            # fields, so this is safe across all paths (provider-gating
                            # removed — simpler + correct for reload-after-Google-run case).
                            **(
                                {"thought_signature": tc["thought_signature"]}
                                if tc.get("thought_signature")
                                else {}
                            ),
                        }
                        for tc in tool_calls_data
                    ],
                })
                # 2. Tool result messages (one per tool call)
                for tc in tool_calls_data:
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc["tool_call_id"],
                        "content": tc.get("result") or "",
                    }
                    # Phase 123-02 CTX-03 — tag load_skill tool-results as pinned so
                    # context_window.trim_messages_to_fit keeps them out of the trim
                    # window (a loaded skill stays available for the rest of the
                    # session). The flag is set HERE in code, identified by the parent
                    # tool_call name being load_skill — NEVER by sniffing the tool-result
                    # content JSON (D-13 anti-pattern / D-14 no-fork). The flag value is
                    # the skill name (for de-dupe), derived from the call args with a
                    # stable fallback to the tool_call_id so de-dupe still works.
                    if tc.get("name") == "load_skill":
                        skill_name = (tc.get("args") or {}).get("skill_name") or tc["tool_call_id"]
                        tool_msg["_pinned_skill"] = skill_name
                    messages.append(tool_msg)
                # 3. Assistant text response (only if content is non-empty)
                if msg.get("content"):
                    messages.append({
                        "role": "assistant",
                        "content": msg["content"],
                        **({"reasoning_content": msg["reasoning_content"]} if msg.get("reasoning_content") else {}),
                    })
            else:
                # Old message without tool_call_id — emit as plain assistant message
                messages.append({
                    "role": msg["role"],
                    "content": msg.get("content") or "",
                    **({"reasoning_content": msg["reasoning_content"]} if msg.get("reasoning_content") else {}),
                })
        else:
            # User messages, plain assistant messages, or messages with null/empty tool_calls
            messages.append({
                "role": msg["role"],
                "content": msg.get("content") or "",
                **({"reasoning_content": msg["reasoning_content"]} if msg["role"] == "assistant" and msg.get("reasoning_content") else {}),
            })
    return messages


# Phase 095 Plan 05 Task 1 (D-08) — the final-output hero-tag selector.
# Operator-resolved this session: "agent marks + backend fallback". The agent's
# declaration (a meta dict already carrying an ``is_hero``/``hero`` truthy flag)
# is honored first; ELSE a backend heuristic picks the hero so the chat output
# area is NEVER heroless when ≥1 file exists across all 6 native providers.
#
# NOTE on the agent-declaration source: the agent loop does NOT today record an
# explicit per-file "this is my final deliverable" intent — sandbox harvest
# (sandbox_service.harvest_output_files) projects only {filename, url, size,
# iteration} into the per-run meta dict. So in the CURRENT code the heuristic is
# the sole live source. The agent-declaration branch below is kept additive and
# forward-compatible: the moment a future change stamps ``is_hero``/``hero`` onto
# a harvested meta dict (e.g. via a tool arg or a system-prompt convention), this
# helper honors it WITHOUT any further wiring change. The unit test exercises that
# branch so the contract is locked.
#
# Heuristic: if the user message names a requested extension (a small allowlist)
# and a generated file matches → the SINGLE largest matching file is the hero;
# ELSE the single largest-size file overall (tie-break: highest ``iteration`` =
# last-written). Returns a set holding EXACTLY ONE hero filename; empty ONLY when
# ``files`` is empty.
#
# Phase 095 Plan 09 (GAP-095-02 / WR-02): EVERY branch returns exactly one hero.
# The requested-ext branch previously returned a MULTI-element set (every file of
# a requested ext → hero), which leaked multiple heroes into the chat output area
# and disagreed with the per-cell persist (which heroed over a partial cumulative
# list). The single shared ``_hero_pick`` tie-break (max size, then iteration) is
# now applied identically across the declared, requested-ext, and fallback paths.
_HERO_REQUESTABLE_EXTS = ("docx", "pptx", "pdf", "xlsx", "csv", "png", "md")


def _hero_pick(metas: list[dict]) -> dict:
    """Pick the single best deliverable from ``metas`` (max size, tie iteration).

    The ONE canonical tie-break shared by every branch of
    ``_select_hero_filenames`` so the hero is identical wherever it is computed.
    ``metas`` MUST be non-empty.
    """
    return max(
        metas,
        key=lambda f: (int(f.get("size") or 0), int(f.get("iteration") or 0)),
    )


def _select_hero_filenames(files: list[dict], user_message: str | None) -> set[str]:
    """Pick THE single hero filename for the final-outputs render (D-08 / GAP-095-02).

    Pure function — no Redis, no I/O. ``files`` are per-run meta dicts shaped
    ``{filename, url, size, iteration, ...}`` (the projection from
    ``sandbox_service.harvest_output_files``). Read-only; never mutates input.

    Returns a set of EXACTLY ONE filename whenever ``files`` is non-empty (and an
    empty set otherwise). Every branch (agent-declared, requested-ext, fallback)
    collapses to a single hero via the shared ``_hero_pick`` tie-break, so the
    chat output area heroes exactly one deliverable and the live emit agrees with
    the persisted reload (Task 2 re-stamps the persisted rows against this set).
    """
    if not files:
        return set()

    # (1) Agent declaration wins, if present on any meta dict (forward-compatible;
    # see the module note above — no live producer of this flag yet). If the agent
    # ever declares MULTIPLE heroes, collapse to one (the largest/last) so the
    # declaration branch can never leak multiple heroes either.
    declared_metas = [
        f for f in files
        if (f.get("is_hero") or f.get("hero")) and f.get("filename")
    ]
    if declared_metas:
        return {_hero_pick(declared_metas)["filename"]}

    msg = (user_message or "").lower()

    # (2) Requested-extension match. Detect a requested ext among the allowlist.
    # Phase 095 Plan 09 Task 3 (hardening) — tokenize the message and match whole
    # tokens, NOT a raw substring. ``re.findall(r"[a-z0-9]+", msg)`` splits on any
    # non-alphanumeric (so ".pptx" → "pptx" still matches), bounding what counts
    # as a requested ext and removing the spurious-substring failure mode (e.g. a
    # stray "csv"/"png" embedded inside a longer word). Forward hardening — not a
    # reproduced bug; the symptom cause was the multi-hero return fixed in Task 1.
    # The hero is the SINGLE largest file with that ext (tie-break highest
    # iteration), NOT every matching file.
    tokens = set(re.findall(r"[a-z0-9]+", msg))
    requested = {ext for ext in _HERO_REQUESTABLE_EXTS if ext in tokens}
    if requested:
        matched_metas = [
            f for f in files
            if f.get("filename")
            and "." in f["filename"]
            and f["filename"].rsplit(".", 1)[-1].lower() in requested
        ]
        if matched_metas:
            return {_hero_pick(matched_metas)["filename"]}
        # requested ext named but nothing matched → fall through to largest.

    # (3) Fallback: the single largest deliverable; tie-break on highest iteration
    # (the last-written file). Stable and deterministic.
    return {_hero_pick(files)["filename"]}


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

async def run_agent_loop(
    ctx: RunContext,
    *,
    emit,
    emit_terminal,
    spawn,
    timeout_ctx: dict | None = None,
    result_sink: dict | None = None,
) -> AgentLoopResult:
    """Drive the multi-iteration tool-calling loop for one run.

    Lifted VERBATIM from threads.py ``agent_runner`` (Phase 089 Plan 03, G-5).
    Owns: the B1 setup block (folder-scope, General/Explorer prompt+tool
    selection, skills/memory/disabled-tools injection, history rebuild + trim),
    the Category-D mutable accumulators, the nested ``_persist_assistant_message``
    / ``_persist_system_messages`` persist functions, the multi-iteration loop
    with the three separate provider chunk-handlers, the tool-dispatch round,
    the inner try/except provider-error handlers, the post-loop emits
    (final_output_files, sources/citations/confidence, fallback-empty), and the
    suggestion-gen + stream_end emit. Returns an ``AgentLoopResult`` so the
    producer's shielded finalizer (STAYS in threads.py) can complete the run.

    Inputs come from the frozen ``ctx`` (Category A). The ``emit`` /
    ``emit_terminal`` / ``spawn`` callables are passed (NOT imported) to break
    the threads<->agent_loop cycle (Pitfall 4). Behavior-preserving: file
    location changes only, never behavior (D-089-03).

    ``timeout_ctx`` (089-03 deviation, Rule 3): an optional mutable dict the
    loop writes its per-iteration ``_last_iteration`` / ``_last_model_id`` /
    ``_last_per_call_budget`` into BEFORE each provider stream block (Phase 066
    D-066-07). The producer-shell's ``except asyncio.TimeoutError`` classifier
    (STAYS in threads.py) reads these to format the ``timed_out: …`` runs.error
    string. Pre-move these were agent_runner-scope locals captured by closure;
    after the move they are loop-locals, so they must be surfaced via this
    container to keep the timed_out error string byte-identical. Defaults to None
    (callers that don't need the detail string can omit it); the loop guards
    every write with ``if timeout_ctx is not None``.

    ``result_sink`` (089-03 deviation, Rule 3): an optional mutable dict the loop
    populates in its outer ``finally`` (runs on EVERY exit path — success,
    timeout, cancel, exception) with the finalizer-needed outputs: the bound
    ``persist`` / ``persist_system_warnings`` callables, the by-reference
    ``persisted_system_warnings`` list, and the final token totals + content.
    This preserves the pre-move behavior where ``_shielded_finalize`` (STAYS in
    threads.py) called ``_persist_assistant_message()`` on ALL exit paths via the
    agent_runner closure — even when the loop raised. After the move those live
    inside ``run_agent_loop``; the by-reference sink is the cycle-free way for the
    finalizer to reach them when the loop exits via an exception (the normal
    return value is unavailable on a re-raise). The happy-path return value
    (``AgentLoopResult``) carries the same fields for the seam test + callers that
    don't pass a sink.
    """
    # --- Category A inputs unpacked from the frozen context ---
    # Re-bound to the same local names the moved body reads so the lifted code
    # is byte-identical below (no `ctx.` prefix churn in the loop body).
    run_id = ctx.run_id
    thread_id = ctx.thread_id
    current_user = ctx.current_user
    user_settings = ctx.user_settings
    body = ctx.body
    redis = ctx.redis
    supabase = ctx.supabase
    _resolved_model = ctx.resolved_model
    _resolved_provider = ctx.resolved_provider
    # Phase 133 (EVAL-02) — additive default-off skill-catalog override (None =
    # DB query / Deep byte-identical; () = inject nothing; (skill,) = inject only).
    skill_catalog_override = ctx.skill_catalog_override
    # --- Category C callables (passed, not imported) ---
    # The moved body calls _emit / _spawn by those names; alias the params.
    _emit = emit
    _spawn = spawn

    # Load thread's folder scope
    thread_data = await aexec(
        supabase.table("threads")
        .select("folder_id")
        .eq("id", thread_id)
        .single()
    )
    thread_folder_id: str | None = thread_data.data.get("folder_id") if thread_data.data else None

    # Resolve folder subtree if scoped
    folder_subtree_ids: list[str] | None = None
    scoped_folder_path: str | None = None
    if thread_folder_id:
        all_folders = await fetch_visible_folders(supabase, current_user["id"])

        def _get_subtree(root_id: str, folders: list[dict]) -> list[str]:
            result = [root_id]
            for f in folders:
                if f["parent_id"] == root_id:
                    result.extend(_get_subtree(f["id"], folders))
            return result

        folder_subtree_ids = _get_subtree(thread_folder_id, all_folders)

        # Build scoped folder path for ls/tree/grep default path
        folder_map = {f["id"]: f for f in all_folders}
        path_parts = []
        current_fid: str | None = thread_folder_id
        while current_fid:
            f = folder_map.get(current_fid)
            if not f:
                break
            path_parts.append(f.get("name", ""))
            current_fid = f.get("parent_id")
        # Only set a meaningful path — if traversal found nothing, leave as None
        # so the scope note is not injected with a confusing "/" root path.
        scoped_folder_path = ("/" + "/".join(reversed(path_parts))) if path_parts else None

    # Load full message history (includes just-inserted user message).
    # CTX-01 (D-120-06): build the query, then apply the ASYMMETRIC origin pre-filter
    # so a Deep turn never replays a workflow's rows (and vice-versa). origin is a pure
    # WHERE clause — kept OUT of the .select() projection (Pitfall 4) and ADDITIVE on
    # top of the owner/thread scope (.eq thread_id + .eq user_id are never relaxed, V4).
    _history_q = (
        supabase.table("messages")
        .select("role, content, tool_calls, reasoning_content")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
    )
    _history_q = _apply_origin_filter(_history_q, body.agent_mode)
    history_resp = await aexec(_history_q.order("created_at"))

    # Select system prompt, tools, and iteration limit based on agent mode
    if body.agent_mode == "explorer":
        active_system_prompt = EXPLORER_SYSTEM_PROMPT
        active_tools = get_explorer_tools()
        max_iterations = 8   # GEN-04: was 6
    else:
        active_system_prompt = SYSTEM_PROMPT
        active_tools = None  # None = use default get_tools() in create_streaming_chat
        max_iterations = 15  # GEN-04: was 8

    # Augment system prompt with folder scope context so LLM generates scoped queries
    if scoped_folder_path:
        folder_scope_note = (
            f"\n\n**IMPORTANT: This chat is scoped to the folder '{scoped_folder_path}'. "
            f"All tool calls should be restricted to this folder and its subfolders. "
            f"When using ls, tree, or grep, default the path to '{scoped_folder_path}'. "
            f"When using query_documents, always include a folder filter (e.g., "
            f"JOIN folders or WHERE folder_id IN ...) to restrict to this folder scope. "
            f"When the user asks 'what documents do you have?' or similar, they mean within this folder scope only.**"
        )
        active_system_prompt = active_system_prompt + folder_scope_note

    # Inject enabled skills catalog (General Mode only) — SKIL-09
    if body.agent_mode != "explorer":
        # Phase 133 (EVAL-02): change ONLY the data source. None = the existing
        # DB query (Deep Mode byte-identical, SC#4 / D-14); a tuple = the eval
        # arms drive exactly these skills (D-03 WITH = target-only; D-04 WITHOUT
        # = empty → the `if enabled_skills:` guard below short-circuits).
        if skill_catalog_override is None:
            _skills_resp = await aexec(
                supabase.table("skills")
                .select("name, description")
                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                .eq("is_enabled", True)
                .order("name")
            )
            enabled_skills = _skills_resp.data or []
        else:
            enabled_skills = list(skill_catalog_override)

        if enabled_skills:
            catalog_lines = "\n".join(
                f"- **{s['name']}**: {s['description']}" for s in enabled_skills
            )
            # D-01: relaxed, description-driven load_skill firing — reconciled with
            # LOAD_SKILL_TOOL.description via the shared LOAD_SKILL_POLICY constant.
            catalog_note = (
                f"\n\n## Available Skills\n"
                f"The following skills are available. {LOAD_SKILL_POLICY}\n{catalog_lines}"
            )
            active_system_prompt = active_system_prompt + catalog_note

        # Inject cross-thread user memory (General Mode only) — MEM-03, D-05, D-06, D-07
        _memory_resp = await aexec(
            supabase.table("user_memory")
            .select("key, value")
            .eq("user_id", current_user["id"])
            .order("updated_at", desc=True)
            .limit(10)
        )
        memory_rows = _memory_resp.data or []

        if memory_rows:
            memory_lines = "\n".join(
                f"- {r['key']}: {r['value']}" for r in memory_rows
            )
            memory_note = (
                "\n\n## User Memory\n"
                "(Preferences and facts you've remembered about this user across conversations)\n"
                f"{memory_lines}"
            )
            active_system_prompt = active_system_prompt + memory_note

        # Inform the agent about tools disabled via user settings so it
        # doesn't attempt to call them or ask clarifying questions about them.
        # WR-06: getattr defaults guard against older user_settings rows
        # that predate one of these flags — without the default, a schema
        # gap would AttributeError mid-request.
        disabled_tools: list[str] = []
        if not getattr(user_settings, "web_search_enabled", True):
            disabled_tools.append("web_search (disabled in Settings › Integrations › Web Search)")
        if not getattr(user_settings, "sandbox_enabled", True):
            disabled_tools.append("execute_code (disabled in Settings › Integrations › Code Execution)")
        if disabled_tools:
            disabled_note = (
                "\n\n## Disabled Tools\n"
                "The following tools are currently disabled by the user and are NOT available. "
                "Do not attempt to call them. If a task requires one of these tools, "
                "clearly tell the user it is disabled and how to enable it:\n"
                + "\n".join(f"- {t}" for t in disabled_tools)
            )
            active_system_prompt = active_system_prompt + disabled_note

    messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
    # Phase 075.5 D-075.5-01: _reconstruct_history echoes thought_signature
    # as a top-level field; google_service.py reads it in
    # _convert_messages_to_google. active_provider is passed for back-compat
    # but no longer load-bearing (non-Google providers ignore the field).
    messages.extend(
        _reconstruct_history(
            history_resp.data,
            active_provider=(getattr(user_settings, "active_provider", "") or "").lower(),
        )
    )

    # Trim conversation history to fit context window before the first LLM call
    messages = trim_messages_to_fit(
        messages,
        max_tokens=resolve_context_budget(user_settings.active_provider, user_settings.llm_model),
        reserve_recent=settings.context_window_reserve_recent,
    )
    logger.debug(
        "Pre-loop trim: ~%d tokens in %d messages",
        estimate_messages_tokens(messages),
        len(messages),
    )

    full_content = ""
    full_reasoning_content = ""
    persisted_tool_calls: list[dict] = []
    # Plan 075.4-03 D-075.4-E1 — closure-local per-run system warning
    # accumulator. Each entry: {kind: "context_truncated" |
    # "iteration_cap_dropped_tool_calls", message: <user-visible text>}.
    # Drained at _shielded_finalize time into `messages` rows so the
    # warning survives reload (RLS-bound to thread owner).
    # FORWARD-REF #6: the `kind` field is the structured retrofit
    # hook for Phase 082.5 unified error sink.
    # NOTE: persistence requires migration 048 to widen the
    # messages_role_check CHECK constraint to allow role='system'.
    # Pre-migration the INSERT fails-silent (logged) and the SSE
    # event remains the user-visible signal.
    _persisted_system_warnings: list[dict] = []
    # Phase 092 (092-03 / SC#4) — terminal disposition override. Stays None for
    # every byte-identical Deep run; set to 'cap_paused' ONLY when the cap fires
    # WITH a non-empty buffer (Landmine 8). Surfaced via result_sink so the
    # producer's _shielded_finalize writes cap_paused instead of completed.
    _cap_disposition: str | None = None
    # Phase 073 TOKEN-COL-01 (D-073-07): per-run usage accumulators.
    # Both default to None — D-073-09 NULL sentinel if NO iteration produced
    # a usage payload. First successful usage event flips None to int; subsequent
    # ones add on top (multi-iteration SUM). Read by _shielded_finalize step 3.
    input_tokens_total: int | None = None
    output_tokens_total: int | None = None
    source_refs: list[dict] = []  # {"document_id": str, "filename": str}
    unique_sources: list[dict] = []
    retrieved_citations: list[dict] = []    # Full citation objects per D-04
    similarity_scores: list[float] = []     # Per-call avg cosine values for confidence
    unique_citations: list[dict] = []       # Deduplicated citations (closure-accessible)
    _confidence_slot: list[dict] = []       # Confidence result (closure-accessible for persist)
    _message_persisted = False  # guard against double-insert
    _empty_retries = 0  # tracks empty-response retries across all iterations
    # Phase 129 D-01 / D-03 (MP-04): run-scoped single-shot counter for the
    # MiniMax truncated-tool-args re-ask. SEPARATE from _provider_retries
    # (:1508, the transient-error budget that resets per-iteration) — Pitfall 3:
    # a code-heavy MiniMax run that also hits a transient 503 must NOT burn its
    # arg-repair budget on the transient path, or vice-versa. Mirrors the
    # _empty_retries single-shot shape (top-of-run init, max 1).
    _minimax_argrepair_retries = 0
    # Set when a prior iteration dropped a bad MiniMax tool-call turn and re-asked;
    # used to emit the quiet `tool_args_recovered` signal once the re-ask succeeds.
    _minimax_argrepair_pending = False

    async def _persist_assistant_message() -> str | None:
        """Insert the assistant message row. Idempotent — only runs once.

        Phase 061 (D-061-05): returns the inserted message_id (or the
        cached one on subsequent calls) so the producer's shielded
        finalizer can populate runs.message_id in the UPDATE.

        Phase 061.1 IN-03 (D-061.1-09): the cached id lives on the
        function object as `_persist_assistant_message._cached_id`
        instead of a `nonlocal` slot in send_message scope. The
        shielded finalizer captures the return value into its own
        local — no second nonlocal reaches into send_message.
        """
        nonlocal _message_persisted
        if _message_persisted:
            return getattr(_persist_assistant_message, "_cached_id", None)
        _message_persisted = True
        if not full_content and not persisted_tool_calls:
            logger.warning(
                "Agent loop produced no content for thread %s — persisting empty assistant message",
                thread_id,
            )
        row: dict = {
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "assistant",
            "content": _strip_nul(full_content),
        }
        if persisted_tool_calls:
            completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
            if completed_tools:
                row["tool_calls"] = _strip_nul(completed_tools)
        if unique_citations:
            row["source_refs"] = unique_citations   # Full citation objects (D-13)
        elif unique_sources:
            row["source_refs"] = unique_sources     # Backward compat for non-RAG turns
        if _confidence_slot:
            c = _confidence_slot[0]
            row["confidence_level"] = c["level"]
            row["confidence_avg_similarity"] = c["avg_similarity"]
            row["confidence_disclaimer"] = c["disclaimer"]
        _cached_id: str | None = None
        try:
            # Phase 073 D-073-04 SITE #3 — messages INSERT flips to asyncpg.
            # JSONB codec on the pool (Plan 01 _init_pg_connection) means
            # tool_calls / source_refs flow as plain Python lists — no
            # per-call json.dumps. Reads field values out of the already-
            # constructed `row` dict via .get() so conditional-set semantics
            # (lines above) carry over without rebuilding kwargs.
            _inserted_id = await insert_assistant_message(
                await get_pg_pool(),
                thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
                content=_strip_nul(full_content),
                tool_calls=row.get("tool_calls"),
                source_refs=row.get("source_refs"),
                confidence_level=row.get("confidence_level"),
                confidence_avg_similarity=row.get("confidence_avg_similarity"),
                confidence_disclaimer=row.get("confidence_disclaimer"),
                reasoning_content=_strip_nul(full_reasoning_content) or None,
            )
            _cached_id = str(_inserted_id) if _inserted_id else None
        except Exception as e:
            logger.error("Failed to persist assistant message: %s", e)
        _persist_assistant_message._cached_id = _cached_id  # type: ignore[attr-defined]
        return _cached_id

    async def _persist_system_messages(warnings: list[dict]) -> None:
        """Plan 075.4-03 D-075.4-E1 — persist system_warning rows.

        Each warning becomes a separate ``messages`` row with
        ``role='system'`` so it survives reload. The structured
        ``kind`` field is the FORWARD-REF #6 retrofit hook for
        Phase 082.5's unified error sink (keep names stable).

        CRITICAL: requires migration 048 to widen the
        ``messages_role_check`` CHECK constraint to allow
        ``role='system'``. Pre-migration the INSERT will fail
        with PostgrestAPIError; we catch and log so the warning's
        SSE event (already emitted) remains the user-visible
        signal — fail-silent is intentional here, NOT a bug.
        """
        for w in warnings:
            try:
                # Hand-rolled INSERT via supabase client (the
                # asyncpg insert_assistant_message helper is
                # role-bound to 'assistant'). Encode the kind
                # field into tool_calls jsonb so the frontend
                # MessageList can render it as a small neutral
                # banner via the existing `kind:` consumer pattern
                # (D-075.4-E1 + Phase 082.5 retrofit shape).
                await aexec(
                    supabase.table("messages").insert({
                        "thread_id": thread_id,
                        "user_id": current_user["id"],
                        "role": "system",
                        "content": _strip_nul(w.get("message", "")),
                        "tool_calls": [{"kind": w.get("kind", "")}],
                    })
                )
            except Exception as e:
                # Fail-silent: SSE event already shipped; persistence
                # is best-effort until migration 048 widens the role
                # CHECK. Log at WARNING so operators can grep for
                # the migration-needed signal.
                logger.warning(
                    "system_warning persist failed (kind=%s) — "
                    "migration 048 may be unapplied: %s",
                    w.get("kind", "?"), e,
                )

    # GEN-03: Tool results stored in full — no character caps.
    # Context budget managed by trim_messages_to_fit() which drops OLDER messages
    # when total context exceeds the model's budget.

    try:  # outer try/finally — guarantees persist even on GeneratorExit (client disconnect)
      try:
        # Pre-inject tool instructions only for OpenRouter XML strategy — the one
        # deterministic structured-mode path. All other providers use native tool
        # calling; unknown models get post-creation injection (next iteration).
        _needs_pre_injection = (
            getattr(user_settings, "active_provider", "") == "openrouter"
            and getattr(user_settings, "openrouter_tool_strategy", "quality") == "xml"
        )
        _structured_tools_injected = False

        # Plan 075.4-03 D-075.4-D1/D2 — closure-local per-run dict
        # keyed by SHA-256 content hash → meta dict {filename, url,
        # size, iteration}. PATTERNS.md S5 SHA-256 + S2 closure-local
        # per-run state. Pivot from set[str] (filename-only) to
        # dict[content_hash, meta] structurally closes BUG-260523-03
        # (OpenRouter dup outputs), BUG-260522-02 (no url/size in
        # final_output_files emit), and BUG-260521-02 (no download
        # link in pinned panel — auto-closes via re_open_trigger).
        # Per Plan 04 (Wave 2): emit carries `supersedes: <prev_fname>`
        # when iteration N produces a different hash for the same
        # filename — OutputFileCard reads this for the "Replaces:"
        # affordance. Plan 04 Wave 0 historical context:
        # B-260519-11 + BUG-260514-01 (per-run cumulative state).
        _previous_files_in_run: dict[str, dict] = {}

        # Phase 085 D-085-15 — per-run task() concurrency semaphore.
        # Initialized ONCE per top-level run (outside the iteration loop) so
        # all _handle_task spawns in this run share the same gate. Bound to
        # settings.task_per_run_concurrency (default 3). Sub-agents inherit
        # this same semaphore via task_service so a runaway sub-agent + parent
        # combo can't dodge the per-run cap.
        _per_run_task_semaphore = asyncio.Semaphore(settings.task_per_run_concurrency)

        # Phase 092 (092-03 / SC#4) — CONSUME the persisted dropped tool calls.
        # Continue (POST /runs/{id}/continue) re-enters the loop with
        # resume_dropped_tool_calls=True + the carrier payload. We pre-dispatch
        # those EXACT calls (re-execute them, feed results back into `messages`)
        # so the model's FIRST iteration here continues from the dropped work —
        # NOT a fresh restart, NOT a re-drop (the whole point of Continue vs the
        # passive 075.4 warning). OFF at every other call site → Deep byte-identical.
        if ctx.resume_dropped_tool_calls and ctx.dropped_tool_calls:
            _resume_calls = [
                {
                    "id": dc.get("tool_call_id") or "",
                    "name": dc.get("name", "?"),
                    "arguments": dc.get("arguments") or "{}",
                }
                for dc in ctx.dropped_tool_calls
            ]
            messages.append({
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": rc["id"],
                        "type": "function",
                        "function": {"name": rc["name"], "arguments": rc["arguments"]},
                    }
                    for rc in _resume_calls
                ],
            })
            _resume_ctx = ToolContext(
                redis=redis,
                run_id=run_id,
                thread_id=thread_id,
                supabase=supabase,
                pool=await get_pg_pool(),
                user_settings=user_settings,
                current_user=current_user,
                folder_subtree_ids=folder_subtree_ids,
                scoped_folder_path=scoped_folder_path,
                emit=_emit,
                spawn=_spawn,
                model=body.model or settings.llm_model,
                previous_files_in_run=_previous_files_in_run,
                iteration=0,
                parent_run_id=None,
                per_run_task_semaphore=_per_run_task_semaphore,
                available_tools=[rc["name"] for rc in _resume_calls],
            )
            for _ti, rc in enumerate(_resume_calls):
                _tool_name = rc["name"]
                try:
                    _args = json.loads(rc["arguments"])
                    await _emit(redis, run_id, 'tool_start', name=_tool_name, args=_args)
                    _resume_ctx.tool_index = _ti
                    _resume_ctx.tool_call_id = rc["id"]
                    _rr = await dispatch_tool(_tool_name, _args, _resume_ctx)
                    _tres = _rr.result
                    _llm_content = _rr.llm_content
                    if _rr.source_refs:
                        source_refs.extend(_rr.source_refs)
                    if _rr.citations:
                        retrieved_citations.extend(_rr.citations)
                    if _rr.similarity_score is not None:
                        similarity_scores.append(_rr.similarity_score)
                except json.JSONDecodeError:
                    _tres, _llm_content, _args = "Error parsing tool arguments", None, {}
                except Exception as _e:  # noqa: BLE001 — mirror the main dispatch round
                    logger.error("Resume tool %s failed: %s", _tool_name, _e)
                    _tres, _llm_content = f"Tool execution failed: {_e}", None
                await _emit(redis, run_id, 'tool_end', name=_tool_name, result=str(_tres)[:2000])
                messages.append({
                    "role": "tool",
                    "tool_call_id": rc["id"],
                    "content": _llm_content if _llm_content is not None else _tres,
                })
                persisted_tool_calls.append({
                    "tool_call_id": rc["id"],
                    "name": _tool_name,
                    "args": _args,
                    "result": str(_tres)[:2000],
                    "status": "done",
                })

        for iteration in range(max_iterations):
            # D-04 (Phase 56): emit iteration_start at the top of every iteration.
            # Frontend uses this to increment the "Step N" counter (D-03).
            # iteration is 0-indexed; frontend adds +1 for display (Pitfall 1).
            await _emit(redis, run_id, 'iteration_start', iteration=iteration)
            # Between tool-call rounds: signal to the frontend that the agent
            # is deciding its next action (all prior tools are done).
            if iteration > 0:
                await _emit(redis, run_id, 'planning', iteration=iteration)

            # Plan 075.4-03 D-075.4-E1 — context-truncated warning.
            # Capture pre-len so we can detect silent message drops
            # post-trim. Sub-agent results can balloon messages
            # length per iteration; trim_messages_to_fit drops OLDER
            # messages atomically (tool-pair preserved). Pre-Plan-03
            # the drop was silent — user saw no signal that earlier
            # context was gone. Now: SSE system_warning kind=
            # context_truncated + persisted messages row.
            _pre_trim_len = len(messages)
            # Re-trim after tool results have been appended (context grows each iteration)
            messages = trim_messages_to_fit(
                messages,
                max_tokens=resolve_context_budget(user_settings.active_provider, user_settings.llm_model),
                reserve_recent=settings.context_window_reserve_recent,
            )
            if len(messages) < _pre_trim_len:
                _dropped = _pre_trim_len - len(messages)
                _trim_msg = (
                    f"⚠ Earlier messages dropped to fit context window "
                    f"({_dropped} message(s) removed)."
                )
                await _emit(redis, run_id, 'system_warning',
                            kind="context_truncated",
                            message=_trim_msg)
                _persisted_system_warnings.append({
                    "kind": "context_truncated",
                    "message": _trim_msg,
                })
                logger.info(
                    "context_truncated run=%s iteration=%d dropped=%d",
                    run_id, iteration, _dropped,
                )
            logger.debug(
                "Agent iteration %d: ~%d tokens in %d messages",
                iteration,
                estimate_messages_tokens(messages),
                len(messages),
            )

            # On the final iteration force a text response to avoid an infinite loop
            force_no_tools = (iteration == max_iterations - 1)
            tool_choice = "none" if force_no_tools else "auto"
            _provider_retries = 0
            _MAX_PROVIDER_RETRIES = 2
            _retry_delays = [0.5, 1.5]

            # OpenRouter XML: inject tool-format instructions BEFORE stream creation
            # so the model sees them on the very first call.
            if _needs_pre_injection and not _structured_tools_injected and tool_choice == "auto":
                _tl_text = _format_tool_list(active_tools if active_tools is not None else get_tools(user_settings))
                for _si, _sm in enumerate(messages):
                    if _sm.get("role") == "system":
                        messages[_si] = {
                            "role": "system",
                            "content": _sm["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl_text),
                        }
                        _structured_tools_injected = True
                        break

            while True:
                try:
                    active_provider_name = getattr(user_settings, "active_provider", "") or ""

                    # Phase 092.5 Wave 4 (D-02 / D-04): the gateway (open_stream)
                    # now serves ALL providers — anthropic/google AND the
                    # OpenAI-compat else-branch. ONE shared _on_chunk consumes the
                    # canonical events ALL three adapters emit (a verbatim collapse
                    # of the former _on_chunk_anthropic / _on_chunk_google /
                    # _on_chunk_openai). The accumulators + handler are lifted here
                    # (above the provider dispatch) so both branches share them.
                    #
                    # ``_build_from_progress`` is the per-branch buffer-build mode:
                    #   - anthropic/google emit ``tool_start`` (complete args) →
                    #     buffer built there (``len()``-keyed, byte-identical).
                    #   - the OpenAI-compat adapter emits NO synthetic ``tool_start``
                    #     (Open Q2); it builds the buffer from ``tool_preparing``
                    #     (id+name, index-keyed) + ``tool_args_progress``
                    #     (full ``code_so_far`` args). Each stream emits only ONE
                    #     family, so the two build paths never collide.
                    from app.services.provider_gateway import (
                        GatewayRequest,
                        open_stream,
                    )

                    tool_calls_buffer: dict = {}
                    finish_reason: str | None = None
                    _announced_tools_shared: set[int] = set()
                    _build_from_progress: bool = False

                    async def _on_chunk(_event):
                        """ONE provider-agnostic consumer handler (D-02 / D-04) for
                        the anthropic + google native paths AND the OpenAI-compat
                        else-branch. Consumes the canonical events the gateway
                        adapters yield, mutates the STAY accumulators + calls _emit —
                        a verbatim collapse of the former _on_chunk_anthropic /
                        _on_chunk_google / _on_chunk_openai."""
                        nonlocal full_content, full_reasoning_content, finish_reason, input_tokens_total, output_tokens_total
                        _etype = _event.get("type")
                        # Phase 073 TOKEN-COL-01 (D-073-08): usage events. Anthropic
                        # yields message_start->"usage" + message_delta->"usage_delta";
                        # Google's SDK emits cumulative usage_metadata normalized into
                        # one initial 'usage' + per-chunk 'usage_delta'; the
                        # OpenAI-compat adapter accumulates per-stream via
                        # _accumulate_chunk_usage and emits ONE 'usage' at stream end
                        # (the consumer SUMs across iterations — byte-identical to the
                        # pre-extraction per-chunk += for the OpenAI-path providers).
                        if _etype == "usage":
                            _i = _event.get("input_tokens", 0) or 0
                            _o = _event.get("output_tokens", 0) or 0
                            if input_tokens_total is None:
                                input_tokens_total = _i
                                output_tokens_total = _o
                            else:
                                input_tokens_total += _i
                                output_tokens_total += _o
                            return
                        elif _etype == "usage_delta":
                            _o = _event.get("output_tokens", 0) or 0
                            if output_tokens_total is None:
                                # rare: usage_delta without prior message_start (partial stream)
                                output_tokens_total = _o
                            else:
                                output_tokens_total += _o
                            return
                        if _etype == "delta":
                            _text = _event.get("content", "")
                            if _text:
                                full_content += _text
                                await _emit(redis, run_id, 'delta', content=_text)
                        elif _etype == "reasoning_delta":
                            # OpenAI-path only today (DeepSeek reasoning_content +
                            # <think>-stripped Kimi/MiniMax/GLM). The adapter routes
                            # think/reasoning content here; the consumer accumulates
                            # full_reasoning_content (round-tripped on tool-call turns,
                            # I3) + emits the reasoning_delta SSE event. No-op for
                            # anthropic/google (they never emit reasoning_delta).
                            _rtext = _event.get("content", "")
                            if _rtext:
                                full_reasoning_content += _rtext
                                await _emit(redis, run_id, 'reasoning_delta', content=_rtext)
                        elif _etype == "tool_preparing":
                            # D-01 (Phase 56.1, corrected): fired when tool name is
                            # first known — before arguments finish streaming.
                            _idx = _event.get("index", len(tool_calls_buffer))
                            if _idx not in _announced_tools_shared:
                                _announced_tools_shared.add(_idx)
                                await _emit(redis, run_id, 'tool_preparing', name=_event['name'], index=_idx)
                            # Open Q2: for the OpenAI-compat path build the buffer
                            # entry HERE (the adapter yields NO synthetic tool_start).
                            # The event carries id+name; args accrue via
                            # tool_args_progress below.
                            if _build_from_progress and _idx not in tool_calls_buffer:
                                tool_calls_buffer[_idx] = {
                                    "id": _event.get("id", "") or "",
                                    "name": _event.get("name", "") or "",
                                    "arguments": "",
                                }
                        elif _etype == "tool_args_progress":
                            # Phase 075 D-075-10: route the adapter's
                            # tool_args_progress yields to _emit. Phase 075.6 Plan 01
                            # / Req #1: forward `code_so_far`. WR-01 (2026-05-24):
                            # defensive .get for the additive field.
                            #
                            # Open Q2 / L-4: for the OpenAI-compat path the buffer
                            # args are built HERE from the full cumulative
                            # ``code_so_far`` (every args-bearing delta yields one so
                            # sub-boundary tools are never lost), keyed by tool_index.
                            # The SSE _emit is gated on ``emit_sse`` (boundary-crossed
                            # — byte-identical wire cadence). anthropic/google omit
                            # ``emit_sse`` (their boundary walk is internal — they only
                            # yield on boundary) so it defaults True → emit always,
                            # byte-identical.
                            if _build_from_progress:
                                _tidx = _event["tool_index"]
                                if _tidx not in tool_calls_buffer:
                                    tool_calls_buffer[_tidx] = {"id": "", "name": "", "arguments": ""}
                                if _event.get("name"):
                                    tool_calls_buffer[_tidx]["name"] = _event["name"]
                                tool_calls_buffer[_tidx]["arguments"] = _event.get("code_so_far", "")
                            if _event.get("emit_sse", True):
                                await _emit(
                                    redis, run_id, "tool_args_progress",
                                    tool_index=_event["tool_index"],
                                    name=_event["name"],
                                    args_so_far=_event["args_so_far"],
                                    total_args_bytes_so_far=_event["total_args_bytes_so_far"],
                                    code_so_far=_event.get("code_so_far", ""),
                                )
                        elif _etype == "tool_start":
                            # Fired at content_block_stop — arguments now complete
                            # (anthropic/google native paths only; the OpenAI-compat
                            # adapter never emits this — Open Q2). tool_preparing was
                            # already emitted above; just populate buffer.
                            _idx = len(tool_calls_buffer)
                            tool_calls_buffer[_idx] = {
                                "id": _event["id"],
                                "name": _event["name"],
                                "arguments": json.dumps(_event.get("args", {})),
                            }
                        elif _etype == "finish":
                            finish_reason = _event.get("finish_reason", "stop")
                            # D-075.5-01 (I2 / D-07): hydrate thought_signature onto
                            # each tool_calls_buffer entry from the finish event's
                            # tool_calls list so the NEXT iteration's
                            # _convert_messages_to_google call can round-trip it
                            # (else Gemini-3 400s on round 2+). NO-OP for Anthropic
                            # (its tool_calls carry no thought_signature) AND for the
                            # OpenAI-compat path (its finish tool_calls carry no sig).
                            # STAYS consumer-side — mutates tool_calls_buffer (a
                            # consumer accumulator); the adapter only EMITS the sig.
                            _fin_tcs = _event.get("tool_calls", []) or []
                            for _i, _ftc in enumerate(_fin_tcs):
                                if _i in tool_calls_buffer and _ftc.get("thought_signature"):
                                    tool_calls_buffer[_i]["thought_signature"] = _ftc["thought_signature"]

                    # Plan 075.4-02 audit (Site 4): gate is operator-intent via
                    # active_provider. Models routed through OpenRouter that
                    # happen to be Claude variants are intentionally NOT pushed
                    # through the native Anthropic path (operator chose OpenRouter
                    # for a reason — routing, billing, fallbacks). Registry-aware
                    # secondary gate considered + rejected; no code change required.
                    if active_provider_name in ("anthropic", "google"):
                        # --- Native SDK paths (Anthropic GEN-02 / Google
                        # D-075.5-01) — Phase 092.5 Wave 2: dispatched through the
                        # provider gateway (GATEWAY-01 / D-01). Their stream
                        # constructions live in provider_gateway/anthropic.py +
                        # google.py (the bare SYNC generator is returned so the drain
                        # + close_fn=stream.close stay byte-identical); the two
                        # near-identical _on_chunk_anthropic / _on_chunk_google
                        # callbacks collapse into the ONE shared _on_chunk above (D-02
                        # / Wave 4 — now also serving the OpenAI-compat path).

                        # Phase 066 D-066-03 + 081.1: 4-tier async resolution
                        # (DB > env > static > default). STAYS consumer-side — it
                        # drives the per-call drain budget + the timeout_ctx the
                        # producer-shell classifier reads (loop machinery, not
                        # stream construction).
                        _model_id = body.model or user_settings.llm_model
                        per_call_budget = await get_per_call_timeout_async(_model_id, settings)
                        # Phase 066 D-066-07: capture for outer-except error format
                        _last_iteration = iteration
                        _last_model_id = _model_id
                        _last_per_call_budget = per_call_budget
                        # 089-03: surface per-iteration timeout context to the
                        # producer-shell classifier (see run_agent_loop docstring).
                        if timeout_ctx is not None:
                            timeout_ctx["last_iteration"] = _last_iteration
                            timeout_ctx["last_model_id"] = _last_model_id
                            timeout_ctx["last_per_call_budget"] = _last_per_call_budget

                        # Build the request envelope from in-scope loop values. The
                        # adapter does the inline kwargs-assembly verbatim (api_key
                        # resolution + _resolve_max_tokens + the
                        # ``active_tools if active_tools is not None else get_tools``
                        # select) — ``tools`` carries active_tools' None signal.
                        _gw_request = GatewayRequest(
                            messages=messages,
                            model=_model_id,
                            active_provider_name=active_provider_name,
                            tools=active_tools,
                            system_prompt=active_system_prompt,
                            force_no_tools=force_no_tools,
                            user_settings=user_settings,
                            tool_choice=tool_choice,
                        )
                        _stream, _calling_mode = await open_stream(
                            active_provider_name, _gw_request
                        )

                        # Anthropic/Google emit ``tool_start`` (complete args) — the
                        # shared _on_chunk builds the buffer there (len()-keyed,
                        # byte-identical). NOT the progress-build path.
                        _build_from_progress = False

                        # Phase 067.1 Plan 01 Track A: drain-into-queue parity. On
                        # timeout the helper closes the underlying SYNC generator
                        # (``_stream.close()`` raises GeneratorExit inside the raw-SDK
                        # service's `with` block → MessageStream.__exit__ →
                        # response.close()); SYNC method; do NOT `await`. The outer
                        # agent_runner's `except asyncio.TimeoutError` catches the
                        # propagated TimeoutError and sets _terminal_status='timed_out'
                        # (Phase 066 D-066-06/07).
                        await _drain_stream_with_close_on_cancel(
                            _stream,
                            per_call_budget,
                            _on_chunk,
                            close_fn=_stream.close,
                        )
                        break  # stream completed

                    else:
                        # --- OpenAI / OpenRouter / Ollama path — Phase 092.5 Wave 4
                        # (D-04, the entangled unit): dispatched through the provider
                        # gateway (GATEWAY-01). The entangled normalization (<think>
                        # state machine, reasoning_content routing,
                        # _accumulate_chunk_usage, per-provider 5KB boundary dicts)
                        # MOVED into provider_gateway/openai_compat.py and now EMITS
                        # canonical events the shared _on_chunk above consumes. The
                        # STRUCTURED messages injection (L-1) + parse_structured_tool_calls
                        # post-parse (L-3) + provider-error retry (L-5) STAY here. The
                        # adapter SURFACES calling_mode (Pitfall 3) — KEPT below.

                        # Phase 066 D-066-03 + 081.1: 4-tier async resolution
                        # (DB > env > static > default). STAYS consumer-side — loop
                        # machinery, not stream construction.
                        _model_id = body.model or user_settings.llm_model
                        per_call_budget = await get_per_call_timeout_async(_model_id, settings)
                        # Phase 066 D-066-07: capture for outer-except error format
                        _last_iteration = iteration
                        _last_model_id = _model_id
                        _last_per_call_budget = per_call_budget
                        # 089-03: surface per-iteration timeout context to the
                        # producer-shell classifier (see run_agent_loop docstring).
                        if timeout_ctx is not None:
                            timeout_ctx["last_iteration"] = _last_iteration
                            timeout_ctx["last_model_id"] = _last_model_id
                            timeout_ctx["last_per_call_budget"] = _last_per_call_budget

                        # Phase 075.3 D-075.3-03: the registry-derived provider name
                        # (NOT user_settings.active_provider) drives the adapter's
                        # <think>/usage/boundary logic — VERBATIM from the
                        # pre-extraction agent_loop.py:1667-1668. Carried into the
                        # request so the adapter keys on it (byte-identical).
                        _active_cap = await get_model_capability_async(_model_id) or {}
                        _adapter_provider = (_active_cap.get("provider") or "unknown").lower()

                        # Build the request envelope; the adapter wraps
                        # create_adaptive_streaming_chat(messages, model=body.model,
                        # user_settings, tool_choice, tools_override=active_tools)
                        # VERBATIM and SURFACES calling_mode.
                        _gw_request = GatewayRequest(
                            messages=messages,
                            model=body.model,
                            active_provider_name=_adapter_provider,
                            tools=active_tools,
                            system_prompt=active_system_prompt,
                            force_no_tools=force_no_tools,
                            user_settings=user_settings,
                            tool_choice=tool_choice,
                        )
                        stream, calling_mode = await open_stream(
                            active_provider_name, _gw_request
                        )

                        # Fallback: inject for other structured-mode models (unknown models).
                        # Happens after the first call; subsequent iterations will have instructions.
                        if calling_mode == CallingMode.STRUCTURED and tool_choice == "auto" and not _structured_tools_injected:
                            _tl_fb = _format_tool_list(active_tools if active_tools is not None else get_tools(user_settings))
                            for _fi, _fm in enumerate(messages):
                                if _fm.get("role") == "system":
                                    messages[_fi] = {
                                        "role": "system",
                                        "content": _fm["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl_fb),
                                    }
                                    _structured_tools_injected = True
                                    break

                        # Open Q2 / L-4: the OpenAI-compat adapter emits NO synthetic
                        # tool_start — the shared _on_chunk builds tool_calls_buffer
                        # from tool_preparing (id+name) + tool_args_progress (full
                        # code_so_far args). The <think> machine + reasoning routing +
                        # _accumulate_chunk_usage + per-provider 5KB boundary dicts all
                        # MOVED into provider_gateway/openai_compat.py (the adapter is
                        # one-stream-one-tracker). This branch is now pure consumer
                        # residue: STRUCTURED injection (above) + post-parse (below) +
                        # provider-error retry stay here.
                        _build_from_progress = True

                        # Phase 067.1 Plan 01 Track A: drain-into-queue. openai 2.28.0
                        # Stream.close() is sync + idempotent (closes underlying httpx
                        # response); the adapter's _ClosableEventStream.close delegates
                        # to it. Bound here so the helper's except-block closes from the
                        # main thread BEFORE the producer's for-loop cleanup propagates
                        # GeneratorExit into _TracedStream.__iter__.
                        await _drain_stream_with_close_on_cancel(
                            stream,
                            per_call_budget,
                            _on_chunk,
                            close_fn=stream.close,
                        )

                        # Parse tool calls based on calling mode
                        if calling_mode == CallingMode.STRUCTURED:
                            structured_calls = parse_structured_tool_calls(full_content)
                            if structured_calls:
                                # Convert to tool_calls_buffer format for uniform execution
                                for idx, call in enumerate(structured_calls):
                                    tool_calls_buffer[idx] = {
                                        "id": call.id,
                                        "name": call.function.name,
                                        "arguments": call.function.arguments,
                                    }
                                # D-05 (Phase 56.1): emit tool_preparing for each structured call.
                                # Structured mode has no streaming name delivery; this fires immediately
                                # after parse returns, before the tool execution loop.
                                for idx, call in enumerate(structured_calls):
                                    await _emit(redis, run_id, 'tool_preparing', name=call.function.name, index=idx)
                                # Yield control so the SSE flush reaches the client before
                                # execution begins — otherwise preparing and running arrive in
                                # the same TCP packet and the preparing state is never rendered.
                                await asyncio.sleep(0)
                                # Clear content since it was a tool call, not a user-facing response
                                full_content = ""
                                finish_reason = "tool_calls"
                            elif full_content.strip():
                                # Log parse failure for observability
                                logger.warning(
                                    "structured_tool_parse_failed",
                                    extra={
                                        "model": body.model,
                                        "provider": user_settings.active_provider if user_settings else "unknown",
                                        "content_preview": full_content[:200],
                                    }
                                )

                        break  # stream completed successfully

                except (APIError, AnthropicAPIError) as provider_err:
                    # Detect "request too large" 429 — distinct from a rate-limit 429.
                    # This fires when the account's TPM ceiling (e.g. OpenAI Tier-1: 30k)
                    # is smaller than the single request size. This is an account plan
                    # limitation, not a model or app issue — do NOT trim content.
                    _err_str = str(provider_err).lower()
                    _is_request_too_large = (
                        getattr(provider_err, "status_code", None) == 429
                        and ("request too large" in _err_str or "tokens per min" in _err_str)
                    )
                    if _is_request_too_large:
                        _tpm_msg = (
                            "*This document is too large for your current OpenAI account plan. "
                            "gpt-4.1 supports up to 1M tokens, but your account's TPM limit "
                            "rejected this request. To fix: upgrade to OpenAI Tier 2 at "
                            "platform.openai.com/account/rate-limits, switch to Anthropic "
                            "(claude-sonnet-4-6), or use OpenRouter which has higher limits.*"
                        )
                        full_content += _tpm_msg
                        await _emit(redis, run_id, 'delta', content=_tpm_msg)
                        break

                    if _is_transient_provider_error(provider_err) and _provider_retries < _MAX_PROVIDER_RETRIES:
                        _provider_retries += 1
                        delay = _retry_delays[_provider_retries - 1]
                        logger.warning(
                            "Transient provider error on iteration %d (thread %s), "
                            "attempt %d/%d — retrying in %.1fs. status=%s",
                            iteration, thread_id,
                            _provider_retries, _MAX_PROVIDER_RETRIES + 1,
                            delay, getattr(provider_err, "status_code", "unknown"),
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise  # non-retryable or retries exhausted → caught by outer except APIError

            logger.debug(
                "Iteration %d finish_reason=%r tool_calls_buffered=%d",
                iteration, finish_reason, len(tool_calls_buffer),
            )

            # Plan 075.4-03 T-075.4-05 — iteration-cap silent-drop guard.
            # When force_no_tools=True (final iteration) the agent sent
            # tool_choice="none"; if the model produced tool calls anyway,
            # there's no NEXT iteration to feed their results into the
            # model's user-facing answer. Pre-Plan-03 we silently ran
            # them and dropped the results on the floor; trust-erosion
            # class T-075.4 mitigates this by surfacing inline + log.
            # Belt-and-suspenders: clear the buffer so the downstream
            # `if not tool_calls_buffer:` short-circuit fires and the
            # tool execution round is skipped (avoids billing for
            # tool runs whose output never influences the answer).
            if force_no_tools and tool_calls_buffer:
                _dropped_count = len(tool_calls_buffer)
                _tool_names = [tc.get("name", "?") for tc in tool_calls_buffer.values()]
                logger.warning(
                    "iteration_cap_paused run=%s iteration=%d queued=%d tool_names=%s",
                    run_id, iteration, _dropped_count, _tool_names,
                )
                # Phase 092 (092-03 / SC#4) — PERSIST, don't DESTROY. The cap
                # used to zero the buffer (dropping the calls on the floor); now
                # we persist them durably to a role='system' carrier row + emit a
                # NON-terminal cap_paused event so a Continue can CONSUME them
                # within a fresh budget. Read continues_used from the DURABLE
                # runs column (migration 063) — never an in-memory count
                # (WORKER_COUNT=2). PERSIST happens BEFORE the buffer clear.
                _continues_used = 0
                try:
                    _cu_row = await aexec(
                        supabase.table("runs")
                        .select("continues_used")
                        .eq("run_id", str(run_id))
                        .maybe_single()
                    )
                    if _cu_row is not None and _cu_row.data:
                        _continues_used = _cu_row.data.get("continues_used") or 0
                except Exception:
                    logger.exception(
                        "cap_paused: continues_used read failed for run %s", run_id
                    )
                _cap_disposition = await persist_cap_paused(
                    redis=redis,
                    run_id=run_id,
                    thread_id=thread_id,
                    user_id=current_user["id"],
                    supabase=supabase,
                    tool_calls_buffer=tool_calls_buffer,
                    continues_used=_continues_used,
                    emit=_emit,
                )
                tool_calls_buffer = {}   # persisted above — now skip the tool execution round

            if finish_reason == "length" and tool_calls_buffer:
                # length limit hit while streaming tool arguments — discard partial call
                err_msg = "*The conversation grew too large for this model's context window. Start a new chat and try the generation request again.*"
                full_content += err_msg
                await _emit(redis, run_id, 'delta', content=err_msg)
                await _emit(redis, run_id, 'error', message='finish_reason=length during tool streaming')
                break

            if finish_reason == "length":
                # Detect "prose-before-code" anti-pattern: model wrote text instead of calling
                # execute_code, consumed the full token budget, and never made the tool call.
                # Recovery: inject a corrective user message and continue the loop so the model
                # can call execute_code on the next iteration.
                _generation_keywords = ("powerpoint", "pptx", "ppt", "presentation", "pdf",
                                        "word", "excel", "report", "chart", "generate", "create",
                                        "build", "python", "execute_code")
                _content_lower = full_content.lower()
                _looks_like_prose_not_code = (
                    iteration > 0
                    and not tool_calls_buffer
                    and any(kw in _content_lower for kw in _generation_keywords)
                    and len(full_content) > 500
                )
                if _looks_like_prose_not_code:
                    # Strip the truncated prose — inject a recovery prompt instead
                    full_content = ""
                    _recovery = (
                        "You wrote a text response but hit the output token limit before calling execute_code. "
                        "Do NOT write any more text. Call execute_code NOW with complete Python code to produce the file."
                    )
                    messages.append({"role": "assistant", "content": "[Response truncated — token limit reached before execute_code was called]"})
                    messages.append({"role": "user", "content": _recovery})
                    logger.warning("prose_before_code_recovery: iteration %d hit length limit without tool call — injecting recovery prompt", iteration)
                    continue  # retry this iteration
                truncation_note = "\n\n*[Response truncated — output token limit reached. Start a new chat or reduce document length.]*"
                full_content += truncation_note
                await _emit(redis, run_id, 'delta', content=truncation_note)
                break

            # Execute tools if any were buffered, regardless of finish_reason.
            # Anthropic's compat layer sends "end_turn" (not "tool_calls") even when
            # tool calls are present — checking finish_reason alone would silently drop them.
            if not tool_calls_buffer:
                if finish_reason not in ("tool_calls", "stop", "end_turn", None):
                    logger.warning(
                        "Unexpected finish_reason %r on iteration %d — treating as stop",
                        finish_reason, iteration,
                    )
                # Guard: if LLM returned stop with no content and no tools at any
                # iteration, retry once — handles transient hiccups and reasoning
                # models (e.g. Kimi K2.5) that exhaust output budget on thinking
                # tokens and return empty content after a tool call.
                if not full_content and _empty_retries < 1:
                    _empty_retries += 1
                    logger.warning(
                        "LLM returned empty response on iteration %d (thread %s) — retrying once",
                        iteration, thread_id,
                    )
                    continue
                break

            # --- Tool execution round ---
            tool_calls = list(tool_calls_buffer.values())

            # Phase 129 D-01 / D-03 (MP-04): MiniMax truncated-tool-args guard.
            # RED LINE (D-14): the ENTIRE guard is gated on the RESOLVED provider
            # identity (_resolved_provider, set from ctx.resolved_provider at
            # :1023) — NOT the model string (D-09 #3 / BUG-260616-01: slash-gating
            # on `org/model` ids misfired). For non-MiniMax round-trips
            # (openai/anthropic/google) this branch is skipped entirely and the
            # `messages.append` below is byte-identical to today.
            #
            # Root cause (run 2c711ee4, output_tokens=8192 = the cap): MiniMax-M3
            # truncates a large `execute_code.code` arg mid-stream, producing an
            # invalid (truncated) JSON `arguments` string, and reports
            # finish_reason="tool_calls" anyway (Pitfall 2 — the length guards at
            # :1975/:1983 never fire). The 400 only happens on the NEXT request
            # (the round-trip re-send below), so we validate PROACTIVELY here,
            # before the append, independent of finish_reason.
            #
            # A truncated arg CANNOT be coerced into validity (Anti-pattern: never
            # brace-balance / re-escape — that fabricates a partial dispatch,
            # violating D-01). Only a fresh re-ask is honest: drop the bad turn,
            # inject a corrective user nudge, `continue` (mirrors the
            # prose-before-code recovery at :1998-2008), bounded to ONE re-ask via
            # the run-scoped _minimax_argrepair_retries counter. Still-malformed
            # after the one re-ask → honest-fail via the existing
            # `message_for_kind("bad_request")` copy (never a silent swallow).
            # The decision logic is the pure helper minimax_argrepair_decision
            # (defined at module scope, unit-pinned by test_129_minimax_argrepair).
            # For every non-MiniMax provider it returns "ok" and this block is a
            # no-op (the messages.append below is byte-identical to today).
            _argrepair_decision = minimax_argrepair_decision(
                _resolved_provider,
                tool_calls,
                _minimax_argrepair_retries,
                _minimax_argrepair_pending,
            )
            if _argrepair_decision == "reask":
                # One-shot re-ask: do NOT append the malformed tool_calls turn.
                # Inject a corrective nudge and continue the loop so MiniMax
                # re-emits the tool call with complete arguments. Mirrors the
                # prose-before-code recovery shape at :1998-2008.
                _minimax_argrepair_retries += 1
                _minimax_argrepair_pending = True
                messages.append({
                    "role": "user",
                    "content": MINIMAX_ARGREPAIR_NUDGE,
                })
                logger.warning(
                    "minimax_argrepair: iteration %d (thread %s) — "
                    "truncated/invalid tool-call arguments detected; "
                    "dropping the bad turn and re-asking once",
                    iteration, thread_id,
                )
                # Reset the per-iteration accumulators we are discarding along
                # with the bad turn (mirrors the reset at :2076-2081).
                full_content = ""
                full_reasoning_content = ""
                continue
            elif _argrepair_decision == "honest_fail":
                # Re-ask budget exhausted and still malformed: honest-fail with
                # the existing fixed `bad_request` copy. No raw 400 detail
                # interpolation for this known kind (Information-Disclosure
                # control T-095.1-01-02 / T-129-06). Never a silent swallow,
                # never a fabricated/partial dispatch (T-129-05). Mirrors the
                # finish_reason=="length" honest-fail shape at :1975-1981.
                _argrepair_fail_msg = message_for_kind("bad_request")
                full_content += _argrepair_fail_msg
                await _emit(redis, run_id, 'delta', content=_argrepair_fail_msg)
                await _emit(
                    redis, run_id, 'error',
                    message='minimax tool-call arguments still invalid after re-ask',
                )
                logger.warning(
                    "minimax_argrepair: iteration %d (thread %s) — re-ask "
                    "exhausted, tool-call arguments still invalid; "
                    "honest-failing with bad_request copy",
                    iteration, thread_id,
                )
                break
            elif _argrepair_decision == "recovered":
                # The re-ask recovered: this iteration's MiniMax args are valid
                # after a prior _minimax_argrepair_retries increment. Surface a
                # quiet, Deep-side honesty signal (Phase-122 family) on the run
                # SSE channel BEFORE the normal append. This is the Deep agent
                # loop's own _emit (threads.py:152 → one XADD on run:{run_id}),
                # NOT the harness forced_emit substrate the Deep loop bypasses
                # (forced_emit.py:74). The event is a quiet audit signal, not a
                # user-facing error delta — the FE can ignore unknown events; no
                # new FE handler required (Open Q1).
                _minimax_argrepair_pending = False
                await _emit(
                    redis, run_id, 'tool_args_recovered',
                    provider=_resolved_provider, iteration=iteration,
                )
            # "ok" → fall through to the normal append (happy path + every
            # non-MiniMax provider).

            messages.append({
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        # Phase 075.5 D-075.5-01/03: carry thought_signature as a
                        # top-level field on the tool_call dict. google_service.py
                        # `_convert_messages_to_google` reads this and attaches it
                        # to the Part so the native SDK round-trips it on the next
                        # round. The OpenAI-compat extra_content.google.* shape
                        # (Phase 075.4-02 attempt) is OBSOLETE — openai-python's
                        # serialization silently dropped that field, causing
                        # Gemini-3+ 400 INVALID_ARGUMENT on multi-tool rounds.
                        # The native SDK + this top-level field round-trip is
                        # proven by the end-to-end smoke test executed at adoption
                        # time (see GAP-075.4-01 hotfix history).
                        **(
                            {"thought_signature": tc["thought_signature"]}
                            if tc.get("thought_signature")
                            else {}
                        ),
                    }
                    for tc in tool_calls
                ],
                # Phase 076.2 D-03: narration text before tool calls
                **({"content": full_content} if full_content else {}),
                # Phase 076.2 D-03: DeepSeek thinking mode requires reasoning_content
                # round-trip on tool-call turns. Without this, the second LLM call
                # fails with 400 "reasoning_content must be passed back to the API".
                # Anti-pattern: do NOT include for non-tool-call turns (ignored by
                # DeepSeek, but unnecessary). Do NOT include for non-DeepSeek providers
                # (harmless — the conditional spread prevents empty key).
                **({"reasoning_content": full_reasoning_content} if full_reasoning_content else {}),
            })

            # Phase 076.2 Pitfall 1: reset accumulators after consuming them.
            # Without this, iteration 2's reasoning would carry iteration 1's
            # content concatenated. Same pattern as full_content resets at lines
            # 2339 and 2447.
            full_content = ""
            full_reasoning_content = ""

            # Phase 083 D-01: construct ToolContext once per iteration.
            # All tool-specific logic delegates through dispatch_tool().
            tool_ctx = ToolContext(
                redis=redis,
                run_id=run_id,
                thread_id=thread_id,
                supabase=supabase,
                pool=await get_pg_pool(),
                user_settings=user_settings,
                current_user=current_user,
                folder_subtree_ids=folder_subtree_ids,
                scoped_folder_path=scoped_folder_path,
                emit=_emit,
                spawn=_spawn,
                model=body.model or settings.llm_model,
                previous_files_in_run=_previous_files_in_run,
                iteration=iteration,
                # Phase 085 additions —
                # parent_run_id is None at the top-level run; task_service
                # overrides it inside sub-agent ToolContexts so _handle_task
                # can short-circuit the 1-level nesting cap (D-085-12).
                # available_tools is the tool-NAME list exposed to the LLM
                # this iteration — _handle_task uses it for sub-agent toolset
                # subset validation (D-085-09).
                parent_run_id=None,
                per_run_task_semaphore=_per_run_task_semaphore,
                available_tools=[
                    t["function"]["name"]
                    for t in (active_tools or get_tools(user_settings))
                ],
            )

            for tool_index, tc in enumerate(tool_calls):
                tool_name = tc["name"]
                sub_agent_record: dict | None = None
                llm_tool_content: str | None = None
                try:
                    args = json.loads(tc["arguments"])
                    await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)

                    # Phase 083 D-01/D-03: single dispatch_tool() call replaces
                    # the ~780 LOC elif chain (G-5 mandated extraction).
                    tool_ctx.tool_index = tool_index
                    # Phase 085 D-085-01 — populate per-tool-call id so ask_user
                    # can derive its Redis pub/sub channel name and so any
                    # future per-tool-call ctx state has a stable identifier.
                    tool_ctx.tool_call_id = tc.get("id", "")
                    _tool_result = await dispatch_tool(tool_name, args, tool_ctx)
                    tool_result = _tool_result.result
                    llm_tool_content = _tool_result.llm_content
                    sub_agent_record = _tool_result.sub_agent_record

                    # Accumulate side effects from dispatcher
                    if _tool_result.source_refs:
                        source_refs.extend(_tool_result.source_refs)
                    if _tool_result.citations:
                        retrieved_citations.extend(_tool_result.citations)
                    if _tool_result.similarity_score is not None:
                        similarity_scores.append(_tool_result.similarity_score)

                except json.JSONDecodeError:
                    tool_result = "Error parsing tool arguments"
                    args = {}
                except (ValueError, RuntimeError) as e:
                    logger.error("Tool %s failed: %s", tool_name, e)
                    tool_result = f"Tool error: {e}"
                except Exception as e:
                    logger.error("Tool %s unexpected error: %s", tool_name, e)
                    tool_result = f"Tool execution failed: {e}"

                await _emit(redis, run_id, 'tool_end', name=tool_name, result=tool_result[:2000])

                # GEN-03: Store full tool result -- no character cap.
                _tool_message_content = llm_tool_content if llm_tool_content is not None else tool_result
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": _tool_message_content,
                })

                # Persist tool call -- for execute_code rebuild from tool_result
                # so output_files (with signed URLs) are never lost by string truncation.
                if tool_name == "execute_code":
                    try:
                        _r = json.loads(tool_result)
                        # Phase 095 Plan 05 Task 1 (D-08) + Plan 09 Task 2
                        # (GAP-095-02 / WR-02) — persist the hero flag so api.ts
                        # reload reconstruction (_mapMessageResponse) re-heroes the
                        # SAME file on a next-day reopen.
                        #
                        # IMPORTANT: do NOT compute the hero set here. At this
                        # per-cell persist point ``_previous_files_in_run`` is only
                        # PARTIAL (later cells have not run yet), so a per-cell hero
                        # would disagree with the loop-end emit (computed over the
                        # COMPLETE set) → live and reload would hero different files
                        # on a multi-cell run. Instead we stamp ``is_hero=False`` as
                        # a placeholder and RE-STAMP every persisted execute_code row
                        # once after the loop against the single canonical
                        # ``_hero_set`` (see the loop-end emit site below). This makes
                        # the persisted rows reflect the ONE canonical set → live ==
                        # reload. Purely additive: each output_files entry gains an
                        # ``is_hero`` bool; the existing keys (filename/url/size/...)
                        # are untouched.
                        _persist_output_files = [
                            {**_of, "is_hero": False}
                            for _of in _r.get("output_files", [])
                        ]
                        persisted_result = json.dumps({
                            "status": _r.get("status", "done"),
                            "exit_code": _r.get("exit_code", 0),
                            "duration_ms": _r.get("duration_ms", 0),
                            "output_files": _persist_output_files,
                            "stdout": (_r.get("stdout", ""))[:800],
                            "stderr": (_r.get("stderr", ""))[:200],
                        })
                    except (json.JSONDecodeError, AttributeError):
                        persisted_result = tool_result[:2000]
                else:
                    persisted_result = tool_result[:2000]

                persisted_tool_calls.append({
                    "tool_call_id": tc["id"],
                    "name": tool_name,
                    "args": args,
                    "result": persisted_result,
                    "status": "done",
                    **({"sub_agent": sub_agent_record} if sub_agent_record else {}),
                    **({"sub_agent_model": sub_agent_record.get("effective_model", "")} if sub_agent_record else {}),
                    **({"thought_signature": tc.get("thought_signature")} if tc.get("thought_signature") else {}),
                })
            # Continue to next iteration to let LLM respond with tool results in context

        # Plan 075.4-03 D-075.4-D1/D2 — pinned final-outputs panel emit.
        # After the agent loop terminates (break or natural end), emit
        # the cumulative file set so the frontend can render a single
        # "Final outputs" panel below the per-cell delta panels.
        #
        # The list comprehension iterates ``_previous_files_in_run.values()``
        # (per-hash meta dicts) and projects filename + url + size — this
        # NATURALLY closes BUG-260522-02 (pre-fix the emit was filename-only,
        # leaving the frontend pinned panel with no download URL) AND
        # auto-closes BUG-260521-02 per its re_open_trigger.
        #
        # Historical context (B-260519-11 + BUG-260514-01): closes the
        # cumulative-repeat symptom (12 download links for 1 desired file).
        if _previous_files_in_run:
            # Phase 095 Plan 05 Task 1 (D-08) — additive hero tag + url guard.
            # Compute the run's hero set ONCE over the cumulative meta dicts
            # (agent-declared else heuristic; NEVER empty when files exist) and
            # project an additive ``is_hero`` flag onto each emitted file. The
            # event NAME and the existing fields (filename/url/size) are
            # unchanged — older frontends ignore the extra key (graceful). The
            # url is guarded (``or ""``) so the chat render never paints a
            # silent dead anchor (RESEARCH dead-link root #1). The flag is
            # presentation-only and never feeds the owner-fenced re-sign
            # download path (T-095-05-01).
            _emit_metas = list(_previous_files_in_run.values())
            # Phase 095 Plan 09 Task 2 (GAP-095-02 / WR-02) — compute the hero set
            # ONCE over the COMPLETE run file set. This is the single source of
            # truth shared by BOTH the live emit (below) AND the post-loop re-stamp
            # of the persisted execute_code rows, so live == reload (a multi-cell
            # reload heroes the same single file as the live run).
            _hero_set = _select_hero_filenames(_emit_metas, body.content)

            # Re-stamp the persisted execute_code rows against the canonical
            # ``_hero_set`` (the per-cell persist above stamped a False placeholder
            # over the PARTIAL cumulative list). Each row's output_files ``is_hero``
            # is recomputed from the complete-set hero, re-serialized, written back.
            # Guarded: a truncated/non-JSON fallback ``result`` (the per-cell
            # ``except`` path) is skipped gracefully.
            for _tc in persisted_tool_calls:
                if _tc.get("name") != "execute_code":
                    continue
                try:
                    _pr = json.loads(_tc["result"])
                    _of_rows = _pr.get("output_files")
                    if not isinstance(_of_rows, list):
                        continue
                    _pr["output_files"] = [
                        {**_of, "is_hero": _of.get("filename") in _hero_set}
                        for _of in _of_rows
                    ]
                    _tc["result"] = json.dumps(_pr)
                except (json.JSONDecodeError, TypeError, KeyError):
                    continue

            await _emit(
                redis,
                run_id,
                'final_output_files',
                files=[
                    {
                        "filename": meta["filename"],
                        "url": meta.get("url") or "",
                        "size": meta["size"],
                        "is_hero": meta["filename"] in _hero_set,
                    }
                    for meta in _emit_metas
                ],
            )

        # Fallback: if the loop ended with no content produced, emit a safe message
        if not full_content:
            # GEN-07: two distinct messages — context overflow vs empty model response
            # Context overflow is caught earlier (finish_reason == "length").
            # This branch = model returned empty content after all iterations/retries.
            # Plan 075.4-03 BUG-260522-01 — use the actual iteration
            # count, not max_iterations. The model typically returns
            # empty after ONE iteration (Google 15-iter loop bug at
            # the chunk-handler), not after exhausting the cap. The
            # `iteration` loop variable is in scope from the
            # enclosing `for iteration in range(max_iterations):`.
            fallback = (
                f"*The model returned an empty response after {iteration + 1} iteration(s). "
                "Try breaking the request into smaller steps or switching to a different model.*"
            )
            full_content += fallback
            await _emit(redis, run_id, 'delta', content=fallback)

      except (asyncio.TimeoutError, asyncio.CancelledError):
          # Phase 066 Plan 04 Rule 1 fix: TimeoutError + CancelledError MUST
          # propagate past this inner try so the outer partition-guard branches
          # (lines ~2237 / ~2258) can set the correct _terminal_status
          # ('timed_out' / 'cancelled'). Without this re-raise the broad
          # `except Exception as e:` below would swallow them, leaving
          # _terminal_status at its default 'completed' — D-066-05 partition
          # guard violation. The outer handler is also responsible for
          # `_ant_gen.close()` / `stream.close()` (already done in the inner
          # `async with asyncio.timeout(...)` blocks at lines 1240/1327
          # before re-raise — see D-066-11).
          raise
      except (APIError, anthropic.APIError, google_errors.APIError) as e:
          # Phase 075.5 T-260523-05 — broadened from openai-only to
          # also include native Anthropic + Google SDK error classes,
          # so the structured per-provider classification below fires for
          # ALL providers, not just OpenAI/OpenRouter.
          logger.error("LLM API error in event stream (thread %s): %s", thread_id, e)
          err_str = str(e)
          # Phase 095.1-04 (D-095.1-03 / PROVIDER-ERR) — replaces the billing-first
          # keyword if-ladder. Classification is now STRUCTURED per-provider via the
          # gateway-boundary classifier, keyed on the in-scope `_resolved_provider`
          # (set at run_agent_loop top, ctx.resolved_provider). 429 → rate_limit
          # ALWAYS precedes billing, so a Google RESOURCE_EXHAUSTED (whose text
          # contains "quota") can NEVER read as billing again (closes BUG-260606-01);
          # billing is claimed ONLY when an `insufficient_quota` structural signal
          # proves it; an uncertain error → neutral truthful copy + bounded raw detail.
          # CONTEXT-OVERFLOW: it has no reliable structured status code — it usually
          # arrives as a 400 bad_request — so it is retained as a SINGLE narrow text
          # pre-check here. This is a targeted retention of the one keyword case with
          # no reliable structured code, NOT the billing-first soup; all other
          # classification is structured (D-095.1-03).
          err_lower = err_str.lower()
          if any(kw in err_lower for kw in ("context", "maximum context", "too long", "token limit")):
              kind = "context_overflow"
          else:
              kind = classify_provider_error(_resolved_provider, e)
          user_msg = message_for_kind(kind, err_str)
          # Phase 075.5 T-260523-05 — always emit the actionable message
          # as a delta. The prior `if not full_content` guard meant that
          # provider errors mid-run (after several successful tool calls)
          # were silently swallowed: the user saw a "long pause" instead
          # of "your Anthropic credit is exhausted". Preserve prior
          # streamed content AND append the error explanation so the
          # final assistant message tells the user what happened.
          full_content += user_msg
          await _emit(redis, run_id, 'delta', content=user_msg)
          await _emit(redis, run_id, 'error', message=err_str)
          # Phase 066 Plan 04 Rule 1 fix: re-raise so the OUTER classifier
          # at lines ~2249-2294 sets _terminal_status='failed' on
          # provider-side APIErrors. Mirrors the broad Exception
          # handler below — friendly SSE events first, then propagate.
          raise
      except Exception as e:
          logger.error("Unexpected error in event stream (thread %s): %s [%s]", thread_id, e, type(e).__name__, exc_info=True)
          user_msg = f"*An unexpected error occurred ({type(e).__name__}). Please try again.*"
          if not full_content:
              full_content += user_msg
              await _emit(redis, run_id, 'delta', content=user_msg)
          await _emit(redis, run_id, 'error', message='An unexpected error occurred')
          # Phase 066 Plan 04 Rule 1 fix: re-raise so the OUTER classifier
          # at lines ~2249-2294 sets _terminal_status='failed' (not the
          # default 'completed'). Without this re-raise the producer's
          # runs row UPDATE writes status='completed' on real producer
          # failures — D-066-05 partition guard violation. The friendly
          # `delta` + `error` SSE events above are still flushed first
          # (consumers see the user-visible message), then the outer
          # `except Exception as e` branch sets the terminal lifecycle
          # state correctly per D-066-07.
          raise

      # Emit sources SSE event (deduplicated by document_id)
      if source_refs:
          unique_sources[:] = list({s["document_id"]: s for s in source_refs}.values())
          await _emit(redis, run_id, 'sources', sources=unique_sources)

      # Emit citations event (D-03, D-07: after sources, before confidence)
      unique_citations[:] = _deduplicate_citations(retrieved_citations)
      if unique_citations:
          # SSE payload truncates passage at 400 chars (D-04); full text stored in source_refs
          sse_citations = []
          for c in unique_citations:
              sse_c = dict(c)
              if sse_c.get("passage") and len(sse_c["passage"]) > 400:
                  sse_c["passage"] = sse_c["passage"][:400]
              sse_citations.append(sse_c)
          await _emit(redis, run_id, 'citations', citations=sse_citations)

      # Emit confidence event (D-05, D-07: after citations, before title)
      if similarity_scores:
          final_avg = sum(similarity_scores) / len(similarity_scores)
          # D-12: read the confidence buckets from the resolved user_settings so labels
          # stay calibrated after an embedder switch; defaults 0.54/0.38 when unset.
          level = _compute_confidence(final_avg, user_settings)
          disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
          _confidence_slot[:] = [{"level": level, "avg_similarity": round(final_avg, 4), "disclaimer": disclaimer}]
          await _emit(redis, run_id, 'confidence', level=level, avg_similarity=round(final_avg, 4), disclaimer=disclaimer)

      # Persist assistant message (normal path — before [DONE])
      await _persist_assistant_message()

      # Touch thread so it rises in updated_at ordering
      try:
          await aexec(supabase.table("threads").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", thread_id))
      except Exception:
          pass

      # D-067.2-05: title generation moved to send_message handler (fires
      # AFTER the user-message INSERT, BEFORE this producer task spawns).
      # See the hoisted block at the bottom of send_message (just before
      # `async def agent_runner`). Title now persists regardless of run
      # outcome — success / failure / timeout / cancellation / exception.
      # The original block that previously lived here only fired on the
      # success path (between _persist_assistant_message and the 'done'
      # _emit), causing "stuck on 'New Chat' forever after a failed/
      # cancelled run" (D-067.2-05a + D-067.2-05b). Deleted in plan
      # 067.2-02 so title cannot fire twice on success.

      # Phase 32: Non-blocking suggestion generation (SUG-03, SUG-04)
      # Phase 067.4 (D-067.4-R3-03): wrap sync call in run_in_threadpool per CLAUDE.md D-v2.5-01.
      # Phase 067.4 (D-067.4-R3-02): always emit, even when empty — removes SSE-replay ambiguity.
      # Phase 067.4 (Rule 3 deviation): the suggestion block moved BEFORE the 'done'
      # emit. `done` is in TERMINAL_TYPES (threads.py:88) so the SSE replay consumer
      # (runs.py replay_tail_consumer:170) returns immediately after yielding 'done',
      # which previously made suggestion events emitted-after-done invisible to SSE
      # consumers. Producer-side ordering is now suggestions → done → stream_end so
      # the wire delivers suggestions to the SSE-replay reader.
      try:
          from app.services.suggestion_service import generate_suggestions
          questions, sugg_fallback = await run_in_threadpool(
              generate_suggestions,
              body.content,         # user_message (positional, mirrors the title pattern at threads.py:1028)
              full_content,         # assistant_response
              user_settings,        # user_settings
          )
          if sugg_fallback:
              await _emit(redis, run_id, 'fallback_model', **sugg_fallback)
          # D-067.4-R3-02: unconditional emit (frontend gate at MessageItem.tsx:93-98 already
          # short-circuits empty arrays via `message.suggestions.length > 0` clause).
          await _emit(redis, run_id, 'suggestions', questions=questions[:3])
          if not questions:
              logger.info(
                  "suggestions empty for run %s — generate_suggestions returned [] "
                  "(emitted as empty list; not an error)",
                  run_id,
              )
      except (openai.APIError, openai.APIConnectionError, openai.APITimeoutError,
              openai.BadRequestError, openai.RateLimitError, openai.InternalServerError) as e:
          # D-067.4-R3-01 branch (a): narrowed catch for known OpenAI API
          # error classes. SUG-04 invariant preserved — no re-raise; the
          # producer continues to 'done' + 'stream_end'.
          logger.warning(
              "suggestion generation API error for run %s: %s",
              run_id, type(e).__name__,
              exc_info=True,
          )
      except Exception:
          # Final safety net — unknown exception class. Logged at ERROR
          # severity so operator gets paged; SUG-04 invariant still
          # preserved (no re-raise).
          logger.error(
              "suggestion generation UNEXPECTED for run %s — investigate",
              run_id,
              exc_info=True,
          )

      # Plan 075.4-03 T-075.4-04 — terminal-status race fix.
      # The legacy inline emit of the 'done' SSE event that used to
      # live here was REMOVED because it fired BEFORE the _shielded_finalize
      # block ran (which is the writer of runs.status='completed').
      # The race window: frontend saw `done` SSE arrive while a
      # fresh GET /threads/{id}/snapshot still returned
      # status='streaming' for ~tens-of-ms (spikes 100ms+ on slow
      # hosts). Phase 075.4-03 swaps the _shielded_finalize step
      # order (finalize_run UPDATE BEFORE _emit_terminal sentinel)
      # so the terminal sentinel SSE event (which is itself
      # discriminated as 'done' via TERMINAL_TYPES at line 93) now
      # implies DB-committed state by construction.
      # Phase 067.4 Rule 3 invariant PRESERVED: suggestion events
      # at lines ~3138-3145 above still fire BEFORE the terminal
      # sentinel because they run in the agent-loop body that
      # always completes before this `finally:` triggers
      # _shielded_finalize. See test_075_4_terminal_race.py for
      # the source-order assertion.

      # Phase 32: True stream end — frontend returns from streamMessage.
      # Plan 075.4-03 note: this event is NOT in TERMINAL_TYPES
      # (the consumer breaks on `done`/`error`/`cancelled`/
      # `timed_out` sentinel, not on `stream_end`) so its placement
      # here is informational only. The terminal sentinel inside
      # _shielded_finalize is the wire-authority terminator.
      await _emit(redis, run_id, 'stream_end')

    finally:
        # Phase 089 Plan 03 (G-5 verbatim move): the agent_runner's
        # _terminal_status classifier + _shielded_finalize STAY in threads.py
        # (producer-shell concern). The exception re-raised by the inner except
        # branches above propagates OUT of run_agent_loop to agent_runner's
        # middle-try except branches, which set _terminal_status and run the
        # shielded finalizer. No behavior change: the inner try/except above is
        # byte-identical to the pre-move inner try, and the post-loop emits
        # (sources/citations/confidence/persist/thread-touch/suggestion/
        # stream_end) only run on the no-exception path — identical to before.
        #
        # Populate result_sink on EVERY exit path (incl. exception) so the
        # shielded finalizer can persist the partial assistant message + token
        # totals + system warnings exactly as the pre-move closure-scoped
        # finalizer did (it called _persist_assistant_message() inside the
        # `finally` on all paths). The by-reference sink is the cycle-free
        # surface; the normal return value below carries the same fields for the
        # happy path + the seam test.
        if result_sink is not None:
            result_sink["persist"] = _persist_assistant_message
            result_sink["persist_system_warnings"] = _persist_system_messages
            result_sink["persisted_system_warnings"] = _persisted_system_warnings
            result_sink["input_tokens_total"] = input_tokens_total
            result_sink["output_tokens_total"] = output_tokens_total
            result_sink["full_content_final"] = full_content
            # Phase 092 (092-03 / SC#4) — cap-pause disposition. None on every
            # byte-identical Deep run; 'cap_paused' only when the cap fired with
            # a non-empty buffer. _shielded_finalize reads this to override the
            # terminal status (cap_paused is non-terminal → no terminal sentinel).
            result_sink["cap_disposition"] = _cap_disposition

    # Phase 089 Plan 03 — the finalizer-needed outputs (Category E). The
    # shielded finalizer in threads.py reads these AFTER the loop returns and
    # holds the byte-identical terminal-race order
    # (persist → persist_system_warnings → finalize_run → sentinel → expire → zrem).
    return AgentLoopResult(
        persist=_persist_assistant_message,
        input_tokens_total=input_tokens_total,
        output_tokens_total=output_tokens_total,
        persisted_system_warnings=_persisted_system_warnings,
        full_content_final=full_content,
        persist_system_warnings=_persist_system_messages,
        cap_disposition=_cap_disposition,
    )
