import asyncio
import base64
import io
import json
import logging
import os
import time as time_mod
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
# WR-01 fix: removed dead imports `AsyncGenerator` and `EventSourceResponse`
# left over from the legacy SSE-on-POST path (deleted in D-063-01).
import openai
from openai import APIError
try:
    from anthropic import APIError as AnthropicAPIError
except ImportError:
    AnthropicAPIError = Exception  # fallback if SDK not installed
from supabase import Client

from app.dependencies import get_current_user, get_supabase, get_redis
import redis.asyncio as aioredis
# Phase 075 D-075-04: RedisError for the /snapshot endpoint's xinfo_stream
# probe → 503+Retry-After:10 fallback (mirrors runs.py:354-370 pattern).
from redis.exceptions import RedisError
from app.models.message import MessageCreate, MessageResponse
from app.models.run import ActiveRunResponse
from app.models.thread import ThreadCreate, ThreadResponse, ThreadSnapshotResponse, ThreadUpdate
from app.services.audit_service import write_audit_entry
from app.utils.db import aexec
from app.dependencies import get_pg_pool
from app.db.runs import insert_run, finalize_run, insert_assistant_message
from app.utils.folder_utils import fetch_visible_folders
from app.models.user_settings import load_user_settings, override_provider
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS, get_model_capability
from app.services.openai_service import create_adaptive_streaming_chat, get_llm_client, get_explorer_tools, EXPLORER_SYSTEM_PROMPT, _uses_max_completion_tokens, CallingMode, get_tools, resolve_calling_mode, normalize_finish_reason
from app.services.anthropic_service import stream_anthropic
from app.services.tool_parser import parse_structured_tool_calls, ToolCall

# Sandbox import — always available at module scope so per-request paths
# (e.g. line ~1328 where get_or_create runs without re-importing) cannot
# NameError when sandbox_enabled is False at startup but enabled per-user
# via user_settings.sandbox_enabled (see WR-03 review fix). The module
# itself has no side effects, so unconditional import is safe.
from app.services.sandbox_service import sandbox_manager, harvest_output_files  # noqa: E402
from app.services.context_window import trim_messages_to_fit, estimate_messages_tokens, resolve_context_budget
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sql_service import query_documents
from app.services.sub_agent_service import run_sub_agent
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path

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
    "Use `metadata_filter` to scope by author, date, or document type when the user specifies a source.\n"
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
    "Write output files to /sandbox/output/ and list them in `output_files`.\n"
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

    "**Multi-document comparison:** Call analyze_document once per document, then synthesize across them in your response. "
    "Do not call search_documents separately for each.\n\n"

    "## Rules\n"
    "- Always cite which document your answer comes from.\n"
    "- Never call the same tool twice with the same arguments.\n"
    "- If search_documents returns relevant chunks, answer from those — do NOT also call read_document on the same document.\n"
    "- **Zero results from search_documents:** If the tool returns no chunks at all, try grep (if the user referenced a "
    "specific phrase) or query_documents (to check whether the document exists). If still nothing, tell the user directly "
    "— do not fabricate.\n"
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
    "text response.\n\n"

    "EXCEPTIONS (still ask for clarification):\n"
    "- The intent is genuinely ambiguous (e.g. 'make me a report' — about what? from which "
    "documents? what format?).\n"
    "- The next step requires information the user did not provide and you cannot infer "
    "from the documents (e.g. specific names, date ranges, file format preferences when "
    "the document corpus has many).\n"
    "- The action would be irreversible or destructive in a way the user might not have "
    "intended (e.g. overwriting / deleting existing artifacts when an alternative path "
    "exists).\n\n"

    "## Confidence & hedging\n"
    "search_documents results include a `similarity` score (0–1). If ALL returned chunks have "
    "similarity below 0.4, the answer is likely not in the documents — say so explicitly: "
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
    "'I've created `report.pptx` with 8 slides covering...' — never '[filename](url)' or 'Download: link'.\n"
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


def _compute_confidence(avg_similarity: float) -> str:
    """Map average cosine similarity to confidence level (D-10).

    Thresholds are calibrated for text-embedding-3-small, where typical
    top-5 average scores are 0.50–0.70 for prose and 0.35–0.55 for
    structured/tabular content. The previous 0.7/0.5 thresholds caused
    almost all correct answers to show as "low" confidence.
    """
    if avg_similarity >= 0.55:
        return "high"
    elif avg_similarity >= 0.40:
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
    response = (
        supabase.table("threads")
        .select("*")
        .eq("user_id", current_user["id"])
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
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, message_id, status")
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
    msgs_resp = await aexec(
        supabase.table("messages")
        .select("*")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
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


def generate_thread_title(
    first_user_message: str,
    user_settings=None,
) -> tuple[str, dict | None]:
    """Call LLM to produce a short thread title from the first user message.

    Returns (title, fallback_info). fallback_info is None unless a 404 retry occurred.
    """
    try:
        client = get_llm_client(user_settings)
        # Use cheapest model per provider — same resolution as sub_agent_service/suggestion_service.
        # Avoids burning the main (expensive) model on a 20-token title call.
        override = (
            (user_settings.sub_agent_model if user_settings else "")
            or settings.sub_agent_model
        )
        if override:
            model = override
        else:
            provider = user_settings.active_provider if user_settings else ""
            model = (
                _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
                or (user_settings.llm_model if user_settings else settings.llm_model)
            )
        token_param = "max_completion_tokens" if _uses_max_completion_tokens(model) else "max_tokens"
        title_messages = [
            {
                "role": "system",
                "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
            },
            {"role": "user", "content": first_user_message[:500]},
        ]
        response = client.chat.completions.create(
            model=model,
            messages=title_messages,
            stream=False,
            **{token_param: 20},
        )
        return response.choices[0].message.content.strip() or "New Chat", None
    except openai.NotFoundError:
        provider = user_settings.active_provider if user_settings else ""
        fallback = (
            _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
            or (user_settings.llm_model if user_settings else settings.llm_model)
        )
        if not fallback or fallback == model:
            return first_user_message[:40].strip() or "New Chat", None
        fallback_info = {"original_model": model, "fallback_model": fallback}
        token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
        title_messages = [
            {
                "role": "system",
                "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
            },
            {"role": "user", "content": first_user_message[:500]},
        ]
        response = client.chat.completions.create(
            model=fallback,
            messages=title_messages,
            stream=False,
            **{token_param2: 20},
        )
        return response.choices[0].message.content.strip() or "New Chat", fallback_info
    except Exception:
        return first_user_message[:40].strip() or "New Chat", None


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

    # 1. Fetch messages — UNCHANGED from the pre-063.1 implementation.
    msgs_resp = await aexec(
        supabase.table("messages")
        .select("*")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
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


def _reconstruct_history(history_rows: list[dict]) -> list[dict]:
    """
    Reconstruct an OpenAI-compatible multi-turn message list from stored DB rows.

    For assistant messages that have tool_calls with tool_call_id:
      Emits 3 entries: (1) assistant+tool_calls, (2) tool result(s), (3) assistant text.
    For old assistant messages without tool_call_id (backward compat) or with no
    tool_calls: emits a plain {"role": "assistant", "content": ...}.
    User messages pass through unchanged.
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
                        }
                        for tc in tool_calls_data
                    ],
                })
                # 2. Tool result messages (one per tool call)
                for tc in tool_calls_data:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["tool_call_id"],
                        "content": tc.get("result") or "",
                    })
                # 3. Assistant text response (only if content is non-empty)
                if msg.get("content"):
                    messages.append({"role": "assistant", "content": msg["content"]})
            else:
                # Old message without tool_call_id — emit as plain assistant message
                messages.append({"role": msg["role"], "content": msg.get("content") or ""})
        else:
            # User messages, plain assistant messages, or messages with null/empty tool_calls
            messages.append({"role": msg["role"], "content": msg.get("content") or ""})
    return messages


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
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

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
    _resolved_model = body.model if getattr(body, "model", None) else _user_settings.llm_model
    # D-067.3-N01-01: Resolution order — explicit body.provider (already
    # applied to _user_settings.active_provider above via override_provider) >
    # MODEL_CAPABILITIES[model]["provider"] > active_provider fallback.
    # Repro: run 6eab949f-78da-4ea4-ac01-f04b16c9be7d (claude model + openai
    # default active_provider → routed to OpenAI SDK → 404). Fix uses the
    # existing get_model_capability helper which returns provider='unknown'
    # for unknown models so the fallback chain is naturally safe (D-067.3-N01-02).
    if body.provider:
        # Explicit override already applied to _user_settings.active_provider above.
        _resolved_provider = _user_settings.active_provider
    else:
        _capability_provider = get_model_capability(_resolved_model).get("provider", "unknown")
        if _capability_provider != "unknown":
            _resolved_provider = _capability_provider
            # Align _user_settings so downstream agent_runner reads see the
            # resolved provider for SDK selection (D-067.3-N01-04). The
            # inner-shadowed `user_settings = _user_settings` at the top of
            # agent_runner picks this mutation up for free. Use override_provider
            # to keep the canonical mutation path.
            _user_settings = override_provider(_user_settings, _resolved_provider)
        else:
            _resolved_provider = _user_settings.active_provider

    try:
        # Phase 073 D-073-04 SITE #1 — runs INSERT flips to asyncpg.
        # _resolved_provider is guaranteed non-None at this line by the
        # if/else chain above (Pitfall 6 — provider column is NOT NULL).
        await insert_run(
            await get_pg_pool(),
            run_id=run_id,
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
            status="streaming",
            model=_resolved_model,
            provider=_resolved_provider,
        )

        # ZADD sorted-set indexes (REDIS-SETUP.md key conventions). Score is
        # the started_at unix timestamp so 062's active-runs endpoint can
        # ZRANGEBYSCORE for time-window queries.
        _started_score = time_mod.time()
        try:
            await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _started_score})
            await redis.zadd("runs:active", {str(run_id): _started_score})
        except Exception:
            logger.exception("ZADD failed for run %s; continuing (passive cleanup at query time)", run_id)
    except Exception:
        # Spawn-failure cleanup (RESEARCH.md Q2): don't leave orphan runs row + ZADD entries.
        try:
            await aexec(supabase.table("runs").update({
                "status": "failed", "error": "spawn_failed",
                "completed_at": "now()",
            }).eq("run_id", str(run_id)))
        except Exception:
            logger.exception("Failed to mark spawn-failed run row")
        try:
            await redis.zrem("runs:active", str(run_id))
            await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
        except Exception:
            pass
        raise

    # D-067.2-05: Auto-title fires AFTER the first-user-message INSERT (line ~903)
    # but BEFORE the agent producer task starts (asyncio.create_task at the bottom
    # of this handler). Title is derived from the user message alone — independent
    # of run outcome — so the title persists regardless of success / failure /
    # timeout / cancellation / exception (closes D-067.2-05a + D-067.2-05b).
    #
    # Option B placeholder check (PATTERNS.md § 6 recommendation): only auto-title
    # when threads.title is the canonical "New Chat" default. Avoids re-titling an
    # existing thread whose user added a follow-up message AND avoids the
    # count-query race when the agent retries with the same thread_id.
    try:
        _title_check = await aexec(
            supabase.table("threads").select("title").eq("id", thread_id).single()
        )
        _existing_title = (_title_check.data or {}).get("title") if _title_check is not None else None
        if _existing_title == "New Chat":
            # generate_thread_title is sync (def at line ~660) and makes a blocking
            # provider SDK call (client.chat.completions.create) — wrap with
            # run_in_threadpool per CLAUDE.md D-v2.5-01.
            _title, _title_fallback = await run_in_threadpool(
                generate_thread_title,
                body.content,
                _user_settings,
            )
            # Ordering invariant (preserved from the original :2398-2408 block):
            # fallback_model emit fires BEFORE title emit when title_fallback is
            # non-empty.
            if _title_fallback:
                await _emit(redis, run_id, 'fallback_model', **_title_fallback)
            try:
                await aexec(
                    supabase.table("threads").update({"title": _title}).eq("id", thread_id)
                )
                await _emit(redis, run_id, 'title', content=_title)
            except Exception as e:
                logger.warning(
                    "D-067.2-05 title persist/emit failed at run start: %s", e,
                    exc_info=True,
                )
    except Exception as e:
        # Outer try guards the title-check query AND the run_in_threadpool call —
        # never block the run on title-generation failure (matches the original
        # :2398-2408 block's exception-swallow stance, with a logger.warning
        # upgrade per CONTEXT.md D-067.2-05 fix shape).
        logger.warning(
            "D-067.2-05 title generation skipped due to setup error: %s", e,
            exc_info=True,
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
            # Worst-case wall-time = max_iterations × per_call_budget (15 × 180s
            # ≈ 45min for unknown models; per-model overrides in
            # MODEL_CAPABILITIES tune this). The replay-tail consumer's deadline
            # at runs.py (settings.consumer_timeout_seconds) is independent
            # from this scope — it bounds the CONSUMER, not the producer.

            # Reuse the user_settings already resolved by the route handler
            # (hoisted from inside this function in Plan 03 Task 1 so the
            # runs INSERT could populate model/provider before producer spawn).
            user_settings = _user_settings

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

            # Load full message history (includes just-inserted user message)
            history_resp = await aexec(
                supabase.table("messages")
                .select("role, content, tool_calls")
                .eq("thread_id", thread_id)
                .eq("user_id", current_user["id"])
                .order("created_at")
            )

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
                _skills_resp = await aexec(
                    supabase.table("skills")
                    .select("name, description")
                    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                    .eq("is_enabled", True)
                    .order("name")
                )
                enabled_skills = _skills_resp.data or []

                if enabled_skills:
                    catalog_lines = "\n".join(
                        f"- **{s['name']}**: {s['description']}" for s in enabled_skills
                    )
                    catalog_note = (
                        f"\n\n## Available Skills\n"
                        f"The following skills are available. ONLY call `load_skill(skill_name)` when the user "
                        f"explicitly names a skill or says 'use [skill name]'. Never auto-load based on "
                        f"description similarity — wait for an explicit request:\n{catalog_lines}"
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
            messages.extend(_reconstruct_history(history_resp.data))

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
            persisted_tool_calls: list[dict] = []
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
                    )
                    _cached_id = str(_inserted_id) if _inserted_id else None
                except Exception as e:
                    logger.error("Failed to persist assistant message: %s", e)
                _persist_assistant_message._cached_id = _cached_id  # type: ignore[attr-defined]
                return _cached_id

            def _strip_nul(obj):
                """Recursively strip PostgreSQL-illegal null bytes (\\x00) from strings."""
                if isinstance(obj, str):
                    return obj.replace('\x00', '')
                if isinstance(obj, dict):
                    return {k: _strip_nul(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [_strip_nul(item) for item in obj]
                return obj

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

                for iteration in range(max_iterations):
                    # D-04 (Phase 56): emit iteration_start at the top of every iteration.
                    # Frontend uses this to increment the "Step N" counter (D-03).
                    # iteration is 0-indexed; frontend adds +1 for display (Pitfall 1).
                    await _emit(redis, run_id, 'iteration_start', iteration=iteration)
                    # Between tool-call rounds: signal to the frontend that the agent
                    # is deciding its next action (all prior tools are done).
                    if iteration > 0:
                        await _emit(redis, run_id, 'planning', iteration=iteration)

                    # Re-trim after tool results have been appended (context grows each iteration)
                    messages = trim_messages_to_fit(
                        messages,
                        max_tokens=resolve_context_budget(user_settings.active_provider, user_settings.llm_model),
                        reserve_recent=settings.context_window_reserve_recent,
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

                            if active_provider_name == "anthropic":
                                # --- Anthropic native SDK path (GEN-02) ---
                                from app.services.openai_service import _resolve_max_tokens
                                from app.config import get_per_call_timeout  # Phase 066 D-066-03
                                _ant_max_tokens = _resolve_max_tokens(None, user_settings)
                                _ant_api_key = user_settings.llm_api_key or settings.llm_api_key or ""
                                _ant_tools = active_tools if active_tools is not None else get_tools(user_settings)
                                # Phase 066 D-066-03: resolve per-LLM-call deadline before stream
                                _model_id = body.model or user_settings.llm_model
                                per_call_budget = get_per_call_timeout(_model_id, settings)
                                # Phase 066 D-066-07: capture for outer-except error format
                                _last_iteration = iteration
                                _last_model_id = _model_id
                                _last_per_call_budget = per_call_budget
                                _ant_gen = stream_anthropic(
                                    messages=messages,
                                    tools=_ant_tools,
                                    system_prompt=active_system_prompt,
                                    model=_model_id,
                                    api_key=_ant_api_key,
                                    max_tokens=_ant_max_tokens,
                                    force_no_tools=force_no_tools,
                                )
                                tool_calls_buffer: dict = {}
                                finish_reason: str | None = None
                                _announced_tools_ant: set[int] = set()

                                # Phase 067.1 Plan 01 Track A: drain-into-queue
                                # parity with the OpenAI branch (PATTERNS.md
                                # parity rule). The Anthropic path is NOT
                                # langsmith-wrapped today (anthropic_service.py
                                # uses raw anthropic.Anthropic — see
                                # SUMMARY.md "Symmetry check"), so the
                                # GeneratorExit-trace pollution is OpenAI-only;
                                # but symmetric structure prevents future
                                # langsmith-anthropic adoption from regressing
                                # to the inline-for-loop shape.
                                #
                                # On timeout the helper closes _ant_gen
                                # (`_ant_gen.close()` raises GeneratorExit
                                # inside anthropic_service.py's `with` block
                                # → MessageStream.__exit__ → response.close());
                                # SYNC method (anthropic 0.97.0); do NOT
                                # `await`. The outer agent_runner's
                                # `except asyncio.TimeoutError` catches the
                                # propagated TimeoutError and sets
                                # _terminal_status='timed_out' (Phase 066
                                # D-066-06/07).
                                async def _on_chunk_anthropic(_ant_event):
                                    nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total
                                    _etype = _ant_event.get("type")
                                    # Phase 073 TOKEN-COL-01 (D-073-08): usage events from Plan 03's
                                    # anthropic_service.stream_anthropic yields. message_start to "usage";
                                    # message_delta to "usage_delta" (Pitfall 9: usage_delta.output_tokens
                                    # is FINAL CUMULATIVE for THAT Message; accumulator adds it ONCE per
                                    # Message, which is what stream_anthropic guarantees).
                                    if _etype == "usage":
                                        _i = _ant_event.get("input_tokens", 0) or 0
                                        _o = _ant_event.get("output_tokens", 0) or 0
                                        if input_tokens_total is None:
                                            input_tokens_total = _i
                                            output_tokens_total = _o
                                        else:
                                            input_tokens_total += _i
                                            output_tokens_total += _o
                                        return
                                    elif _etype == "usage_delta":
                                        _o = _ant_event.get("output_tokens", 0) or 0
                                        if output_tokens_total is None:
                                            # rare: usage_delta without prior message_start (partial stream)
                                            output_tokens_total = _o
                                        else:
                                            output_tokens_total += _o
                                        return
                                    if _etype == "delta":
                                        _text = _ant_event.get("content", "")
                                        if _text:
                                            full_content += _text
                                            await _emit(redis, run_id, 'delta', content=_text)
                                    elif _etype == "tool_preparing":
                                        # D-01 (Phase 56.1, corrected): fired at content_block_start when
                                        # tool name is first known — before arguments finish streaming.
                                        _idx = _ant_event.get("index", len(tool_calls_buffer))
                                        if _idx not in _announced_tools_ant:
                                            _announced_tools_ant.add(_idx)
                                            await _emit(redis, run_id, 'tool_preparing', name=_ant_event['name'], index=_idx)
                                    elif _etype == "tool_args_progress":
                                        # Phase 075 D-075-10: route Anthropic-path
                                        # tool_args_progress yields from
                                        # anthropic_service.stream_anthropic to
                                        # _emit. Filter logic (execute_code skip)
                                        # already applied at the producer side;
                                        # this dispatch is a straight pass-through.
                                        await _emit(
                                            redis, run_id, "tool_args_progress",
                                            tool_index=_ant_event["tool_index"],
                                            name=_ant_event["name"],
                                            args_so_far=_ant_event["args_so_far"],
                                            total_args_bytes_so_far=_ant_event["total_args_bytes_so_far"],
                                        )
                                    elif _etype == "tool_start":
                                        # Fired at content_block_stop — arguments now complete.
                                        # tool_preparing was already emitted above; just populate buffer.
                                        _idx = len(tool_calls_buffer)
                                        tool_calls_buffer[_idx] = {
                                            "id": _ant_event["id"],
                                            "name": _ant_event["name"],
                                            "arguments": json.dumps(_ant_event.get("args", {})),
                                        }
                                    elif _etype == "finish":
                                        finish_reason = _ant_event.get("finish_reason", "stop")

                                await _drain_stream_with_close_on_cancel(
                                    _ant_gen,
                                    per_call_budget,
                                    _on_chunk_anthropic,
                                    close_fn=_ant_gen.close,
                                )
                                break  # stream completed

                            else:
                                # --- OpenAI / Google / OpenRouter / Ollama path (unchanged) ---
                                stream, calling_mode = create_adaptive_streaming_chat(
                                    messages=messages,
                                    model=body.model,
                                    user_settings=user_settings,
                                    tool_choice=tool_choice,
                                    tools_override=active_tools,
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

                                tool_calls_buffer: dict = {}
                                finish_reason: str | None = None
                                _announced_tools: set[int] = set()
                                # Phase 075 D-075-10 + Pitfall 3: per-tool_index 5KB-boundary
                                # counter for tool_args_progress emits. Resets alongside
                                # tool_calls_buffer / _announced_tools at each agent-loop
                                # iteration to prevent cross-round leakage (a stale boundary
                                # from iteration N would silence the emit in iteration N+1).
                                _tool_args_emit_boundary: dict[int, int] = {}

                                # Phase 066 D-066-02 + D-066-03 + D-066-11: per-LLM-call
                                # timer + close-then-raise. Resolve budget before each
                                # iteration so per-iteration reset is honored
                                # (asyncio.timeout creates a fresh deadline per `async with`).
                                from app.config import get_per_call_timeout  # local import — same module imported in Anthropic path above
                                _model_id = body.model or user_settings.llm_model
                                per_call_budget = get_per_call_timeout(_model_id, settings)
                                # Phase 066 D-066-07: capture for outer-except error format
                                _last_iteration = iteration
                                _last_model_id = _model_id
                                _last_per_call_budget = per_call_budget

                                # Phase 067.1 Plan 01 Track A: drain-into-queue.
                                # Wraps the per-chunk body so that the sync
                                # `for chunk in stream:` loop runs in a thread
                                # pool worker — when timeout fires, we close
                                # the underlying SDK stream from outside the
                                # for-loop, so _TracedStream.__iter__ takes
                                # the `else: self._end_trace()` clean-closure
                                # branch (no GeneratorExit recorded). Variables
                                # `_last_iteration` / `_last_model_id` /
                                # `_last_per_call_budget` (captured above) are
                                # consumed by the outer agent_runner's
                                # `except asyncio.TimeoutError` formatter.
                                async def _on_chunk_openai(chunk):
                                    nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total
                                    # Phase 073 TOKEN-COL-01 (D-073-08): final usage chunk has empty choices=[]
                                    # and populated chunk.usage. Other chunks have chunk.usage=None. Pitfall 2:
                                    # _drain_stream_with_close_on_cancel iterates the stream to natural
                                    # StopIteration so the trailing chunk WILL be delivered.
                                    if getattr(chunk, "usage", None) is not None:
                                        u = chunk.usage
                                        _i = getattr(u, "prompt_tokens", 0) or 0
                                        _o = getattr(u, "completion_tokens", 0) or 0
                                        if input_tokens_total is None:
                                            input_tokens_total = _i
                                            output_tokens_total = _o
                                        else:
                                            input_tokens_total += _i
                                            output_tokens_total += _o
                                        return  # usage chunk has empty choices=[]; no delta/tool work
                                    if not chunk.choices:
                                        return
                                    choice = chunk.choices[0]
                                    delta = choice.delta

                                    if choice.finish_reason:
                                        finish_reason = normalize_finish_reason(choice.finish_reason)

                                    if delta.content:
                                        full_content += delta.content
                                        await _emit(redis, run_id, 'delta', content=delta.content)

                                    if delta.tool_calls:
                                        for tc in delta.tool_calls:
                                            idx = tc.index
                                            if idx not in tool_calls_buffer:
                                                tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                                            if tc.id:
                                                tool_calls_buffer[idx]["id"] = tc.id
                                            if tc.function and tc.function.name:
                                                tool_calls_buffer[idx]["name"] = tc.function.name
                                                # D-01 (Phase 56.1): emit tool_preparing as soon as name is known,
                                                # before arguments finish streaming. Fires exactly once per tool index.
                                                if idx not in _announced_tools:
                                                    _announced_tools.add(idx)
                                                    await _emit(redis, run_id, 'tool_preparing', name=tc.function.name, index=idx)
                                            if tc.function and tc.function.arguments:
                                                tool_calls_buffer[idx]["arguments"] += tc.function.arguments
                                                # Phase 075 D-075-09/10/11: emit tool_args_progress
                                                # on every 5KB cumulative-byte boundary for non-
                                                # execute_code tools in NATIVE calling mode. Skip
                                                # execute_code (deferred to v3.0 Skill Studio per
                                                # REQUIREMENTS.md line 65). Skip STRUCTURED mode
                                                # (args arrive at finish_reason parse time, not
                                                # progressively — there's no streaming accumulator
                                                # to walk on that path).
                                                _tool_name = tool_calls_buffer[idx]["name"]
                                                if (
                                                    _tool_name
                                                    and _tool_name != "execute_code"
                                                    and calling_mode != CallingMode.STRUCTURED
                                                ):
                                                    _bytes_total = len(
                                                        tool_calls_buffer[idx]["arguments"].encode("utf-8")
                                                    )
                                                    _new_boundary = _bytes_total // 5120
                                                    _last_boundary = _tool_args_emit_boundary.get(idx, 0)
                                                    if _new_boundary > _last_boundary:
                                                        _tool_args_emit_boundary[idx] = _new_boundary
                                                        # D-075-09: args_so_far is the LAST 5KB of
                                                        # the cumulative accumulator (sliding-window
                                                        # tail). UTF-8-aware byte slice + decode
                                                        # errors="ignore" drops any invalid trailing
                                                        # codepoint bytes left by the byte boundary.
                                                        _tail_bytes = tool_calls_buffer[idx]["arguments"].encode("utf-8")[-5120:]
                                                        _args_so_far = _tail_bytes.decode("utf-8", errors="ignore")
                                                        await _emit(
                                                            redis, run_id, "tool_args_progress",
                                                            tool_index=idx,
                                                            name=_tool_name,
                                                            args_so_far=_args_so_far,
                                                            total_args_bytes_so_far=_bytes_total,
                                                        )

                                await _drain_stream_with_close_on_cancel(
                                    stream,
                                    per_call_budget,
                                    _on_chunk_openai,
                                    # openai 2.28.0 Stream.close() is sync and
                                    # idempotent (closes underlying httpx
                                    # response). Bound here so the helper's
                                    # except-block calls it from the main
                                    # thread BEFORE the producer's for-loop
                                    # cleanup ever propagates GeneratorExit
                                    # into _TracedStream.__iter__.
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

                    messages.append({
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "id": tc["id"],
                                "type": "function",
                                "function": {"name": tc["name"], "arguments": tc["arguments"]},
                            }
                            for tc in tool_calls
                        ],
                    })

                    # Phase 067.4 (D-067.4-R5-01 amended — Plan 03 Rule 3 deviation):
                    # introduced enumerate(tool_calls) so tool_index is in scope inside
                    # the per-tool body (specifically the sandbox_queue drain loop's
                    # heartbeat emit at the `code_executing` SSE event below). Plan
                    # 03 PATTERNS.md asserted tool_index was already in scope; static
                    # audit at execution time showed it was not — surfaced as Rule 3
                    # deviation in 067.4-03-SUMMARY.md.
                    for tool_index, tc in enumerate(tool_calls):
                        tool_name = tc["name"]
                        sub_agent_record: dict | None = None
                        llm_tool_content: str | None = None  # overridden per-tool to strip URLs from LLM context
                        try:
                            args = json.loads(tc["arguments"])
                            await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)
                            if tool_name == "ls":
                                path = args.get("path") or (scoped_folder_path if scoped_folder_path else "/")
                                result = await ls_path(path, current_user["id"], supabase)
                                tool_result = json.dumps(result)
                            elif tool_name == "tree":
                                path = args.get("path") or (scoped_folder_path if scoped_folder_path else "/")
                                result = await tree_path(path, args.get("depth"), current_user["id"], supabase)
                                tool_result = json.dumps(result)
                            elif tool_name == "grep":
                                path = args.get("path") or scoped_folder_path
                                result = await grep_path(args.get("pattern", ""), path, current_user["id"], supabase)
                                tool_result = json.dumps(result)
                            elif tool_name == "glob":
                                result = await glob_path(args.get("pattern", ""), current_user["id"], supabase)
                                # Scope glob results to folder subtree if thread is folder-scoped
                                if folder_subtree_ids is not None and "matches" in result:
                                    result["matches"] = [
                                        m for m in result["matches"]
                                        if m.get("folder_id") in folder_subtree_ids
                                    ]
                                    result["total"] = len(result["matches"])
                                tool_result = json.dumps(result)
                            elif tool_name == "read_document":
                                result = await read_path(
                                    args["document_id"],
                                    current_user["id"],
                                    supabase,
                                    args.get("start_line"),
                                    args.get("end_line"),
                                )
                                tool_result = json.dumps(result)
                            elif tool_name == "search_documents":
                                metadata_filter = args.get("metadata_filter") or None
                                results, avg_sim = await search_documents(
                                    args["query"], current_user["id"], supabase,
                                    metadata_filter=metadata_filter,
                                    user_settings=user_settings,
                                    folder_ids=folder_subtree_ids,
                                )
                                tool_result = json.dumps(results) if results else "No relevant documents found."
                                # Accumulate full citation objects for citations event (D-04, D-14)
                                if results and isinstance(results, list):
                                    for hit in results:
                                        doc_id = hit.get("document_id") or hit.get("id")
                                        filename = hit.get("filename") or hit.get("document_name")
                                        if doc_id and filename:
                                            source_refs.append({"document_id": doc_id, "filename": filename})
                                            retrieved_citations.append({
                                                "document_id": doc_id,
                                                "filename": filename,
                                                "chunk_index": hit.get("chunk_index"),
                                                "passage": hit.get("content"),  # Full text for persistence
                                                "similarity": hit.get("similarity"),
                                                "is_full_doc": False,
                                                "version_number": hit.get("version_number", 1),
                                            })
                                    if avg_sim > 0.0:
                                        similarity_scores.append(avg_sim)
                                # Audit: fire-and-forget inside async generator (AUDIT-02)
                                _audit_doc_ids = list({
                                    h.get("document_id") or h.get("id")
                                    for h in (results or [])
                                    if h.get("document_id") or h.get("id")
                                })
                                _spawn(write_audit_entry(
                                    user_id=current_user["id"],
                                    action_type="search.query",
                                    metadata={"query_text": args["query"], "document_ids": _audit_doc_ids},
                                    supabase=supabase,
                                ))
                            elif tool_name == "query_documents":
                                tool_result = await query_documents(args["query"], current_user["id"], supabase, folder_ids=folder_subtree_ids)
                            elif tool_name == "web_search":
                                tool_result = web_search(args["query"], settings.tavily_api_key, settings.web_search_max_results)
                            elif tool_name == "analyze_document":
                                doc_id = await resolve_document_id(args["filename"], current_user["id"], supabase)
                                if not doc_id:
                                    tool_result = f"Document '{args['filename']}' not found."
                                else:
                                    doc = await fetch_full_document(doc_id, current_user["id"], supabase)
                                    if not doc:
                                        tool_result = f"Could not retrieve content for '{args['filename']}'."
                                    else:
                                        # Track this document as a source reference
                                        source_refs.append({"document_id": doc_id, "filename": doc["filename"]})
                                        retrieved_citations.append({
                                            "document_id": doc_id,
                                            "filename": doc["filename"],
                                            "chunk_index": None,
                                            "passage": None,
                                            "similarity": None,
                                            "is_full_doc": True,
                                            "version_number": doc.get("version_number", 1),
                                        })
                                        await _emit(redis, run_id, 'sub_agent_start', filename=doc['filename'], task=args['task'])
                                        sub_agent_content = ""
                                        # Phase 075.1 Plan 04 (B-260519-05) — capture the effective
                                        # model resolved by sub_agent_service so we can surface it
                                        # in persisted_tool_calls (spread below) and in the
                                        # frontend tool-card. Mirrors sub_agent_service.run_sub_agent's
                                        # resolution rules (user override > env override > provider default).
                                        _sub_agent_effective_model = (
                                            (user_settings.sub_agent_model if user_settings else "")
                                            or settings.sub_agent_model
                                            or _SUB_AGENT_MODEL_DEFAULTS.get(
                                                getattr(user_settings, "active_provider", "") or "",
                                                "",
                                            )
                                            or (user_settings.llm_model if user_settings else "")
                                            or body.model
                                            or settings.llm_model
                                        )
                                        try:
                                            for text_chunk in run_sub_agent(doc["content"], doc["filename"], args["task"], model=body.model, user_settings=user_settings):
                                                # Detect fallback sentinel emitted by sub_agent_service
                                                if text_chunk.startswith('{"__type": "fallback_model"'):
                                                    try:
                                                        sentinel = json.loads(text_chunk)
                                                        await _emit(redis, run_id, 'fallback_model', original_model=sentinel['original_model'], fallback_model=sentinel['fallback_model'])
                                                        # The fallback model actually ran the request — update
                                                        # the effective model so the persisted payload reflects
                                                        # what produced the content.
                                                        _sub_agent_effective_model = sentinel.get('fallback_model', _sub_agent_effective_model)
                                                    except (json.JSONDecodeError, KeyError):
                                                        pass
                                                    continue
                                                sub_agent_content += text_chunk
                                                await _emit(redis, run_id, 'sub_agent_delta', content=text_chunk)
                                        except Exception as sa_err:
                                            logger.error("Sub-agent failed: %s", sa_err)
                                            if not sub_agent_content:
                                                sub_agent_content = f"Sub-agent analysis failed: {sa_err}"
                                        await _emit(redis, run_id, 'sub_agent_done')
                                        tool_result = sub_agent_content
                                        sub_agent_record = {
                                            "filename": doc["filename"],
                                            "task": args["task"],
                                            "content": sub_agent_content,
                                            "effective_model": _sub_agent_effective_model,
                                        }
                            elif tool_name == "load_skill":
                                skill_name = args.get("skill_name", "")
                                # Emit skill_activated SSE event immediately (SKIL-12)
                                await _emit(redis, run_id, 'skill_activated', skill_name=skill_name)
                                # Resolve skill — prefer user-owned over global when names conflict
                                _skill_resp = await aexec(
                                    supabase.table("skills")
                                    .select("id, name, description, instructions, user_id")
                                    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                    .eq("name", skill_name)
                                    .eq("is_enabled", True)
                                    .order("is_global")
                                )
                                skill_row = _skill_resp.data
                                if not skill_row:
                                    tool_result = json.dumps({"error": f"Skill '{skill_name}' not found or not enabled."})
                                else:
                                    row = skill_row[0] if isinstance(skill_row, list) else skill_row
                                    # Phase 067.1 Plan 04: follow-up emit with skill description as
                                    # upcoming-context hint. Fires AFTER the DB query (so we have the
                                    # description) and BEFORE the audit/files fetch (so the SSE arrives
                                    # promptly). Guard on truthy description per Pitfall 4 — empty/null
                                    # skip avoids "Loading skill 'docx' — " trailing-em-dash render bug.
                                    # V7 mitigation: emit ONLY skill_name + description; NEVER
                                    # instructions (skill instructions can be arbitrarily long user
                                    # content — out of scope for SSE hint).
                                    if row.get("description"):
                                        await _emit(
                                            redis,
                                            run_id,
                                            'skill_loaded',
                                            skill_name=skill_name,
                                            description=row["description"],
                                        )
                                    _spawn(write_audit_entry(
                                        user_id=current_user["id"],
                                        action_type="skill.load",
                                        metadata={"skill_id": row["id"], "skill_name": row["name"]},
                                        supabase=supabase,
                                    ))
                                    # Fetch attached filenames (FILE-04)
                                    _files_resp = await aexec(
                                        supabase.table("skill_files")
                                        .select("filename")
                                        .eq("skill_id", row["id"])
                                        .order("filename")
                                    )
                                    files_data = _files_resp.data or []
                                    file_names = [f["filename"] for f in files_data]
                                    tool_result = json.dumps({
                                        "name": row["name"],
                                        "instructions": row["instructions"],
                                        "files": file_names,
                                    })
                            elif tool_name == "save_skill":
                                name = args.get("name", "").strip()
                                description = args.get("description", "")
                                instructions = args.get("instructions", "")
                                if not name:
                                    tool_result = json.dumps({"error": "Skill name is required."})
                                else:
                                    # Check if user already owns a skill with this name
                                    existing_resp = await aexec(
                                        supabase.table("skills")
                                        .select("id")
                                        .eq("user_id", current_user["id"])
                                        .eq("name", name)
                                        .limit(1)
                                    )
                                    existing = existing_resp.data[0] if existing_resp.data else None
                                    if existing:
                                        row = existing
                                        await aexec(
                                            supabase.table("skills").update({
                                                "description": description,
                                                "instructions": instructions,
                                            }).eq("id", row["id"]).eq("user_id", current_user["id"])
                                        )
                                        tool_result = json.dumps({"status": "updated", "name": name})
                                    else:
                                        await aexec(
                                            supabase.table("skills").insert({
                                                "user_id": current_user["id"],
                                                "name": name,
                                                "description": description,
                                                "instructions": instructions,
                                            })
                                        )
                                        tool_result = json.dumps({"status": "created", "name": name})
                            elif tool_name == "read_skill_file":
                                skill_name = args.get("skill_name", "")
                                filename = args.get("filename", "")
                                # Resolve skill to get owner's user_id for storage path
                                _sr_resp = await aexec(
                                    supabase.table("skills")
                                    .select("id, user_id")
                                    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                    .eq("name", skill_name)
                                    .maybe_single()
                                )
                                skill_row = _sr_resp.data if _sr_resp is not None else None
                                if not skill_row:
                                    # Retry with normalized name for agent display-name mismatches
                                    _sr_norm = skill_name.lower().replace(" ", "-")
                                    if _sr_norm != skill_name:
                                        _sr_resp2 = await aexec(
                                            supabase.table("skills")
                                            .select("id, user_id")
                                            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                            .eq("name", _sr_norm)
                                            .maybe_single()
                                        )
                                        skill_row = _sr_resp2.data if _sr_resp2 is not None else None
                                if not skill_row:
                                    tool_result = json.dumps({"error": f"Skill '{skill_name}' not found."})
                                else:
                                    row = skill_row[0] if isinstance(skill_row, list) else skill_row
                                    storage_path = f"{row['user_id']}/{row['id']}/{filename}"
                                    try:
                                        raw_bytes = supabase.storage.from_("skill-files").download(storage_path)
                                        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

                                        if ext == "docx":
                                            import docx as _docx  # python-docx
                                            doc = _docx.Document(io.BytesIO(raw_bytes))
                                            tool_result = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                                        elif ext == "xlsx":
                                            import openpyxl as _openpyxl
                                            wb = _openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
                                            rows = []
                                            for sheet in wb.worksheets:
                                                for row in sheet.iter_rows(values_only=True):
                                                    line = "\t".join(str(c) if c is not None else "" for c in row)
                                                    if line.strip():
                                                        rows.append(line)
                                            tool_result = "\n".join(rows)
                                        elif ext == "pptx":
                                            from pptx import Presentation as _Presentation  # python-pptx
                                            prs = _Presentation(io.BytesIO(raw_bytes))
                                            slides = []
                                            for slide in prs.slides:
                                                for shape in slide.shapes:
                                                    if hasattr(shape, "text") and shape.text.strip():
                                                        slides.append(shape.text)
                                            tool_result = "\n".join(slides)
                                        elif ext in {"txt", "md", "py", "csv", "json", "yaml", "yml", "toml", "html", "xml", "rst", "log"}:
                                            tool_result = raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
                                        else:
                                            # Unrecognized or binary type
                                            tool_result = json.dumps({
                                                "error": f"File '{filename}' is a binary file that cannot be read as text. "
                                                         "Upload a text-based version instead."
                                            })
                                    except Exception as e:
                                        tool_result = json.dumps({"error": f"File '{filename}' not found: {e}"})
                            elif tool_name == "execute_code":
                                code = args.get("code", "")
                                libraries = args.get("libraries") or []
                                # Emit start event (SAND-04)
                                await _emit(redis, run_id, 'code_execution_start', code_preview=code[:200])

                                try:
                                    session = sandbox_manager.get_or_create(thread_id)
                                    loop = asyncio.get_running_loop()  # WR-04: get_event_loop deprecated in 3.10+
                                    # Inner sandbox-event queue (separate from the outer producer
                                    # XADD path used for SSE). Renamed from `queue` (D-059-Rule1 fix
                                    # — historical from 059's asyncio.Queue producer; preserved as
                                    # an in-process bridge between the blocking sandbox executor
                                    # callbacks and the async producer in 061).
                                    sandbox_queue: asyncio.Queue = asyncio.Queue()

                                    # Phase 075 D-075-05/06: callbacks now carry captured_at for
                                    # monotonic-timestamp assertion in SC #2 + reset the silent-
                                    # window heartbeat clock (D-075-08). Item type renamed from
                                    # 'code_stdout' → 'stdout_chunk' because the drain consumer
                                    # (Task 3) line-buffers chunks and emits one 'code_stdout'
                                    # SSE event per complete line.
                                    def on_stdout(chunk: str):
                                        loop.call_soon_threadsafe(
                                            sandbox_queue.put_nowait,
                                            {"type": "stdout_chunk", "content": chunk, "captured_at": time_mod.time()}
                                        )

                                    def on_stderr(chunk: str):
                                        loop.call_soon_threadsafe(
                                            sandbox_queue.put_nowait,
                                            {"type": "stderr_chunk", "content": chunk, "captured_at": time_mod.time()}
                                        )

                                    # Ensure /sandbox/output exists via shell (reliable across container
                                    # environments) and chdir so relative writes land there
                                    try:
                                        session.execute_command("mkdir -p /sandbox/output")
                                    except Exception:
                                        pass

                                    # Inject skill files into sandbox by embedding bytes as base64
                                    # in a preamble that runs before user code. More reliable than
                                    # copy_to_runtime which can fail silently on Windows Docker setups.
                                    skill_files_req = args.get("skill_files") or []
                                    file_preamble = ""
                                    for sf in skill_files_req:
                                        sf_skill_name = sf.get("skill_name", "")
                                        sf_filename = sf.get("filename", "")
                                        if not sf_skill_name or not sf_filename:
                                            continue
                                        _sf_resp = await aexec(
                                            supabase.table("skills")
                                            .select("id, user_id")
                                            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                            .eq("name", sf_skill_name)
                                            .maybe_single()
                                        )
                                        sf_skill = _sf_resp.data if _sf_resp is not None else None
                                        if not sf_skill:
                                            # Retry with normalized name: agent often uses display name
                                            # ("Weekly Report Writer") instead of stored slug ("weekly-report-writer")
                                            _sf_norm = sf_skill_name.lower().replace(" ", "-")
                                            if _sf_norm != sf_skill_name:
                                                _sf_resp2 = await aexec(
                                                    supabase.table("skills")
                                                    .select("id, user_id")
                                                    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                                                    .eq("name", _sf_norm)
                                                    .maybe_single()
                                                )
                                                sf_skill = _sf_resp2.data if _sf_resp2 is not None else None
                                        if not sf_skill:
                                            logger.warning("Skill file injection: skill '%s' not found", sf_skill_name)
                                            continue
                                        sf_row = sf_skill[0] if isinstance(sf_skill, list) else sf_skill
                                        sf_storage_path = f"{sf_row['user_id']}/{sf_row['id']}/{sf_filename}"
                                        try:
                                            sf_bytes = supabase.storage.from_("skill-files").download(sf_storage_path)
                                            b64 = base64.b64encode(sf_bytes).decode("ascii")
                                            safe_name = sf_filename.replace("'", "\\'")
                                            file_preamble += (
                                                f"import base64 as _b64, os as _os\n"
                                                f"_os.makedirs('/sandbox', exist_ok=True)\n"
                                                f"with open('/sandbox/{safe_name}', 'wb') as _f:\n"
                                                f"    _f.write(_b64.b64decode('{b64}'))\n"
                                                f"print('Injected skill file: {safe_name}')\n"
                                            )
                                        except Exception as sf_err:
                                            logger.warning("Failed to inject skill file %s/%s: %s", sf_skill_name, sf_filename, sf_err)

                                    wrapped_code = "import os; os.chdir('/sandbox/output')\n" + file_preamble + code

                                    # Phase 075 D-075-05: write user code to a uniquely-named file
                                    # inside the container so `python -u {file}` can stream stdout
                                    # line-by-line. session.copy_to_runtime is preferred over the
                                    # heredoc fallback (multi-line user code with arbitrary
                                    # quoting hazards). Marker filename uses uuid4 to avoid
                                    # collisions across concurrent tool calls on the same session.
                                    import tempfile as _tempfile_local
                                    import os as _os_local
                                    code_file = f"/tmp/run-{_uuid_mod.uuid4().hex}.py"
                                    with _tempfile_local.NamedTemporaryFile(
                                        mode="w", encoding="utf-8", suffix=".py", delete=False
                                    ) as _tmp_fp:
                                        _tmp_fp.write(wrapped_code)
                                        _local_tmp_path = _tmp_fp.name
                                    try:
                                        session.copy_to_runtime(_local_tmp_path, code_file)
                                    finally:
                                        try:
                                            _os_local.unlink(_local_tmp_path)
                                        except OSError:
                                            pass

                                    # Phase 075 D-075-05: libraries install hoisted out of
                                    # session.run() (which we no longer call). session.install()
                                    # uses the same pip-cache + pip-executable path the run()
                                    # call used internally. Empty list is a no-op.
                                    if libraries:
                                        try:
                                            session.install(libraries=libraries)
                                        except Exception as _install_err:
                                            logger.warning(
                                                "sandbox library install failed thread=%s err=%s",
                                                thread_id, type(_install_err).__name__,
                                            )

                                    start_time = time_mod.time()

                                    def _run_sync():
                                        # Phase 075 D-075-05: bypass InteractiveSandboxSession.run()
                                        # — its on_stdout/on_stderr params are unused (verified in
                                        # ~/site-packages/llm_sandbox/interactive.py lines 234-235).
                                        # Use the streaming execute_command path with `python -u`
                                        # to force unbuffered stdout (RESEARCH Pitfall 1). The
                                        # high-level wrapper at llm_sandbox/docker.py:43-60 flips
                                        # exec_run(stream=True, demux=True) and dispatches each
                                        # decoded chunk to on_stdout/on_stderr via
                                        # mixins._process_stream_output.
                                        exec_result = session.execute_command(
                                            f"python -u {code_file}",
                                            on_stdout=on_stdout,
                                            on_stderr=on_stderr,
                                        )
                                        loop.call_soon_threadsafe(
                                            sandbox_queue.put_nowait,
                                            {"type": "_done", "result": exec_result, "captured_at": time_mod.time()}
                                        )
                                        return exec_result

                                    fut = loop.run_in_executor(None, _run_sync)

                                    # Drain sandbox_queue, forwarding SSE events out via _emit XADD
                                    # (SAND-05 + Phase 061 D-061-10). Emit keepalives every 10 s
                                    # when sandbox produces no output to prevent SSE connection
                                    # timeouts on long executions.
                                    #
                                    # Phase 067.4 (D-067.4-R5-01 amended): emit code_executing
                                    # heartbeat every ~1 s during sandbox execution. Reuses the
                                    # existing wait_for drain loop with a tighter inner cycle.
                                    # `start_time` was captured at line 2086. The pre-existing
                                    # 10 s keepalive cadence (D-061-10 SSE-timeout protection) is
                                    # preserved by tracking `_heartbeat_last`.
                                    # Phase 075 D-075-06 + D-075-08: line-buffered per-line emit
                                    # + silent-window heartbeat. Docker streams stdout as bytes
                                    # chunks (not always per-line); the accumulator splits each
                                    # chunk on '\n', emits one code_stdout SSE event per complete
                                    # line, and retains the trailing partial for the next chunk.
                                    # On _done we flush any trailing partial BEFORE breaking so no
                                    # line is dropped. The heartbeat fires only during silent
                                    # windows (≥1s with no stdout/stderr); _last_output_at is
                                    # reset ONLY by stdout_chunk/stderr_chunk handlers (Pitfall 7
                                    # — never by the heartbeat itself, otherwise silent workloads
                                    # would emit one heartbeat at +1s then go dead).
                                    # Phase 075.1 Plan 02 Task 2: line-buffer state hoisted into
                                    # a dict that flows through the pure drain_step helper at
                                    # module scope. Equivalent state shape to the prior
                                    # `_stdout_partial` / `_stderr_partial` locals — refactor
                                    # is mechanical, not behavioural.
                                    _drain_state: dict = {"stdout_partial": "", "stderr_partial": ""}
                                    # Counters used by the post-completion safety-net at the
                                    # _done branch (Plan 02 Task 2): if the mid-flight per-line
                                    # emit path produced ZERO lines but exec_result.stdout has
                                    # content, emit one consolidated code_stdout so output is
                                    # never silently lost (defense-in-depth against future
                                    # regressions in the streaming line-buffer path).
                                    _emitted_stdout_line_count = 0
                                    _emitted_stderr_line_count = 0
                                    _last_output_at = time_mod.time()
                                    _heartbeat_last = time_mod.time()  # 10s keepalive cadence — preserved from D-061-10
                                    _HEARTBEAT_INTERVAL_S = 1.0
                                    while True:
                                        try:
                                            item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
                                        except asyncio.TimeoutError:
                                            now = time_mod.time()
                                            # D-075-08: heartbeat ONLY during silent windows (≥1s
                                            # with no stdout/stderr). Pitfall 7: do NOT reset
                                            # _last_output_at here — only stdout/stderr chunks
                                            # reset it. SC #4 invariant: silent time.sleep(5)
                                            # cell emits ≥4 code_executing events; chatty cell
                                            # emits 0 because every chunk resets the clock.
                                            if now - _last_output_at >= _HEARTBEAT_INTERVAL_S:
                                                elapsed = now - start_time
                                                await _emit(redis, run_id, 'code_executing',
                                                            tool_index=tool_index, elapsed_seconds=round(elapsed, 1))
                                            # Preserve 10s keepalive cadence (D-061-10) unchanged.
                                            if now - _heartbeat_last >= 10.0:
                                                await _emit(redis, run_id, 'keepalive')
                                                _heartbeat_last = now
                                            continue

                                        if item["type"] == "_done":
                                            # D-075-07: flush trailing partial lines BEFORE break
                                            # so monotonic captured_at holds and no line is dropped.
                                            if _drain_state["stdout_partial"]:
                                                await _emit(redis, run_id, "code_stdout",
                                                            content=_drain_state["stdout_partial"],
                                                            captured_at=time_mod.time())
                                                _emitted_stdout_line_count += 1
                                                _drain_state["stdout_partial"] = ""
                                            if _drain_state["stderr_partial"]:
                                                await _emit(redis, run_id, "code_stderr",
                                                            content=_drain_state["stderr_partial"],
                                                            captured_at=time_mod.time())
                                                _emitted_stderr_line_count += 1
                                                _drain_state["stderr_partial"] = ""
                                            # Phase 075.1 Plan 02 Task 2 — post-completion
                                            # safety-net (per 075-CROSS-PROVIDER-UAT.md Plan 02
                                            # scope). If the mid-flight emit produced ZERO lines
                                            # but the final exec_result has stdout content, emit
                                            # ONE consolidated code_stdout so output isn't
                                            # silently lost. Guards against future regressions
                                            # in the streaming line-buffer path. Same for stderr.
                                            # Fires BEFORE break so the terminal frame still
                                            # ships AFTER the safety-net emit (consumer ordering
                                            # invariant preserved).
                                            _exec_result = item.get("result")
                                            if _exec_result is not None:
                                                _final_stdout = (getattr(_exec_result, "stdout", "") or "").strip()
                                                _final_stderr = (getattr(_exec_result, "stderr", "") or "").strip()
                                                if _emitted_stdout_line_count == 0 and _final_stdout:
                                                    await _emit(redis, run_id, "code_stdout",
                                                                content=_final_stdout,
                                                                captured_at=time_mod.time())
                                                if _emitted_stderr_line_count == 0 and _final_stderr:
                                                    await _emit(redis, run_id, "code_stderr",
                                                                content=_final_stderr,
                                                                captured_at=time_mod.time())
                                            break

                                        if item["type"] in ("stdout_chunk", "stderr_chunk"):
                                            # Reset silent-window heartbeat clock on any output
                                            # (D-075-08 / Pitfall 7 — only stdout/stderr chunks
                                            # reset it).
                                            _last_output_at = item["captured_at"]
                                            # Pure helper extracts the line-buffer math into
                                            # module scope so it's exercised by
                                            # tests/unit/test_075_1_drain_step.py without Docker.
                                            emit_calls, _drain_state = drain_step(item, _drain_state)
                                            for evt_type, content, captured_at in emit_calls:
                                                await _emit(redis, run_id, evt_type,
                                                            content=content, captured_at=captured_at)
                                                if evt_type == "code_stdout":
                                                    _emitted_stdout_line_count += 1
                                                else:
                                                    _emitted_stderr_line_count += 1
                                        else:
                                            # Safety net: any other item type flows through the
                                            # generic emit (none today; future-proof).
                                            await _emit(redis, run_id, item['type'], **{k: v for k, v in item.items() if k != 'type'})

                                    exec_result = await fut
                                    end_time = time_mod.time()
                                    duration_ms = int((end_time - start_time) * 1000)

                                    # Phase 075 D-075-07: post-completion stdout/stderr emit DELETED —
                                    # mid-flight per-line emit (Tasks 2-3) owns every line; this block
                                    # would double-emit on the SSE wire. The exec_result.stdout / .stderr
                                    # attrs are STILL read below for backend-side error-marker detection;
                                    # only the SSE wire writes are removed.

                                    # Derive actual exit code — InteractiveSandboxSession may
                                    # return 0 even when Python raises an exception.
                                    # Check exec_result.exit_code first; if it's 0/None,
                                    # scan stdout for Python error signatures.
                                    actual_exit_code = getattr(exec_result, "exit_code", None) or 0
                                    if actual_exit_code == 0:
                                        stdout_text = exec_result.stdout or ""
                                        _error_markers = (
                                            "Traceback (most recent call last)",
                                            "Error:",
                                            "Exception:",
                                            "ModuleNotFoundError",
                                            "ImportError",
                                            "SyntaxError",
                                            "NameError",
                                            "TypeError",
                                            "ValueError",
                                            "RuntimeError",
                                            "AttributeError",
                                            "KeyError",
                                            "IndexError",
                                        )
                                        if any(m in stdout_text for m in _error_markers):
                                            actual_exit_code = 1

                                    # Log execution to DB (SAND-09)
                                    exec_row = await aexec(
                                        supabase.table("code_executions").insert({
                                            "thread_id": thread_id,
                                            "user_id": current_user["id"],
                                            "code": code,
                                            "exit_code": actual_exit_code,
                                            "duration_ms": duration_ms,
                                        })
                                    )
                                    execution_id = exec_row.data[0]["id"] if exec_row.data else None

                                    # Harvest output files from container (SAND-07, SAND-08)
                                    # Phase 075.1 Plan 02 Task 1 — D-v2.5-01 fix
                                    # (075-CROSS-PROVIDER-UAT.md headline finding):
                                    # harvest_output_files performs synchronous blocking I/O
                                    # (Supabase Storage uploads, sandbox_files INSERTs, local
                                    # file reads) directly on the async event loop. Pre-fix,
                                    # this starved the SSE keepalive after the cell completed,
                                    # tearing down the stream before the terminal frame
                                    # shipped — producing the universal "stuck on Running
                                    # code until F5" symptom across all three providers
                                    # (OpenAI, Anthropic, OpenRouter). run_in_threadpool
                                    # offloads to anyio's worker pool so the loop stays
                                    # responsive. See CLAUDE.md Rules + D-v2.5-01.
                                    output_file_list = []
                                    if execution_id and actual_exit_code == 0:
                                        output_file_list = await run_in_threadpool(
                                            harvest_output_files,
                                            session, execution_id, current_user["id"], supabase,
                                        )

                                    # Emit completion event (SAND-06) with file list
                                    await _emit(redis, run_id, 'code_execution_complete', exit_code=actual_exit_code, duration_ms=duration_ms, execution_id=execution_id, output_files=output_file_list)

                                    exec_status = "completed" if actual_exit_code == 0 else "error"
                                    tool_result = json.dumps({
                                        "status": exec_status,
                                        "exit_code": actual_exit_code,
                                        "duration_ms": duration_ms,
                                        "execution_id": execution_id,
                                        "output_files": output_file_list,
                                        "stdout": exec_result.stdout or "",
                                        "stderr": exec_result.stderr or "",
                                    })
                                    # Strip signed URLs from LLM context — frontend shows download cards
                                    llm_tool_content = json.dumps({
                                        "status": exec_status,
                                        "exit_code": actual_exit_code,
                                        "duration_ms": duration_ms,
                                        "output_files": [{"filename": f["filename"], "size": f["size"]} for f in output_file_list],
                                        "stdout": exec_result.stdout or "",
                                        "stderr": exec_result.stderr or "",
                                    })
                                    _spawn(write_audit_entry(
                                        user_id=current_user["id"],
                                        action_type="code.execute",
                                        metadata={"thread_id": thread_id, "language": args.get("language", "python")},
                                        supabase=supabase,
                                    ))
                                except Exception as exec_err:
                                    logger.error("execute_code failed: %s", exec_err)
                                    await _emit(redis, run_id, 'code_execution_complete', exit_code=1, error=str(exec_err), duration_ms=0, output_files=[])
                                    tool_result = json.dumps({"status": "error", "error": str(exec_err)})
                            elif tool_name == "remember":
                                # Phase 33 MEM-01: store user preference/fact across threads
                                # D-01 upsert, D-02 case-insensitive, D-16 non-blocking, D-17 silent fail
                                key = (args.get("key", "") or "").strip().lower()
                                value = args.get("value", "") or ""

                                if not key:
                                    # Pitfall 3: empty key must not reach DB
                                    tool_result = json.dumps({"error": "key cannot be empty"})
                                else:
                                    tool_result = json.dumps({"status": "remembered", "key": key})

                                    async def _write_memory(
                                        _key: str = key,
                                        _value: str = value,
                                        _uid: str = current_user["id"],
                                    ) -> None:
                                        try:
                                            await aexec(
                                                supabase.table("user_memory").upsert(
                                                    {
                                                        "user_id": _uid,
                                                        "key": _key,
                                                        "value": _value,
                                                    },
                                                    on_conflict="user_id,key",
                                                )
                                            )
                                        except Exception as exc:
                                            logger.warning(
                                                "memory.remember write failed [user=%s key=%s]: %s",
                                                _uid, _key, exc,
                                            )

                                    _spawn(_write_memory())
                                    _spawn(write_audit_entry(
                                        user_id=current_user["id"],
                                        action_type="memory.remember",
                                        metadata={"key": key, "value": value, "action": "upsert"},
                                        supabase=supabase,
                                    ))

                            elif tool_name == "recall":
                                # Phase 33 MEM-01: retrieve stored memory entries
                                # D-09 (all), D-10 (specific), D-11 (not found), D-12 (empty)
                                key = (args.get("key", "") or "").strip().lower()

                                if key:
                                    resp = await aexec(
                                        supabase.table("user_memory")
                                        .select("value")
                                        .eq("user_id", current_user["id"])
                                        .eq("key", key)
                                        .maybe_single()
                                    )
                                    row = resp.data if resp else None
                                    # Pitfall 5: maybe_single() mock compatibility
                                    if isinstance(row, list):
                                        row = row[0] if row else None
                                    if row:
                                        tool_result = row["value"]
                                    else:
                                        tool_result = f"No memory entry found for key: {key}"
                                else:
                                    _rows_resp = await aexec(
                                        supabase.table("user_memory")
                                        .select("key, value")
                                        .eq("user_id", current_user["id"])
                                        .order("updated_at", desc=True)
                                    )
                                    rows = _rows_resp.data or []
                                    if rows:
                                        tool_result = "\n".join(
                                            f"- {r['key']}: {r['value']}" for r in rows
                                        )
                                    else:
                                        tool_result = "No memories stored yet."

                                _spawn(write_audit_entry(
                                    user_id=current_user["id"],
                                    action_type="memory.recall",
                                    metadata={"key": key or None},
                                    supabase=supabase,
                                ))
                            elif tool_name == "query_tables":
                                # MODAL-03 Phase 36: query structured table data from documents
                                from app.services.multimodal_service import handle_query_tables  # noqa: PLC0415
                                tool_result = await handle_query_tables(args, current_user["id"], supabase)
                            else:
                                tool_result = f"Unknown tool: {tool_name}"
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

                        # GEN-03: Store full tool result — no character cap.
                        # trim_messages_to_fit() drops OLDER messages when context budget is exceeded.
                        # IMPORTANT: use a separate local — `full_content` is the assistant's
                        # accumulated text response that gets persisted to messages.assistant.content.
                        # Reusing it as a temp for the tool payload corrupted the persisted message
                        # with the entire tool_result JSON (e.g., a full document dump). The bug was
                        # latent pre-061 because the producer was cancelled on disconnect before
                        # persist; 061's D-v2.5-08 contract inversion runs persist via the shielded
                        # finalizer regardless of disconnect, surfacing the leak.
                        _tool_message_content = llm_tool_content if llm_tool_content is not None else tool_result
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": _tool_message_content,
                        })

                        # Persist tool call — for execute_code rebuild from tool_result
                        # so output_files (with signed URLs) are never lost by string truncation.
                        # Stdout/stderr are truncated since they're not needed for reload.
                        if tool_name == "execute_code":
                            try:
                                _r = json.loads(tool_result)
                                persisted_result = json.dumps({
                                    "status": _r.get("status", "done"),
                                    "exit_code": _r.get("exit_code", 0),
                                    "duration_ms": _r.get("duration_ms", 0),
                                    "output_files": _r.get("output_files", []),
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
                            # Phase 075.1 Plan 04 (B-260519-05) — surface the resolved
                            # sub-agent model id in the tool_call_result payload so the
                            # frontend tool-card can render "Sub-agent: {model_id}" and
                            # the user sees the silent downgrade transparency.
                            **({"sub_agent_model": sub_agent_record.get("effective_model", "")} if sub_agent_record else {}),
                        })
                    # Continue to next iteration to let LLM respond with tool results in context

                # Fallback: if the loop ended with no content produced, emit a safe message
                if not full_content:
                    # GEN-07: two distinct messages — context overflow vs empty model response
                    # Context overflow is caught earlier (finish_reason == "length").
                    # This branch = model returned empty content after all iterations/retries.
                    fallback = (
                        f"*The model returned an empty response after {max_iterations} iterations. "
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
              except APIError as e:
                  logger.error("LLM API error in event stream (thread %s): %s", thread_id, e)
                  err_str = str(e)
                  err_lower = err_str.lower()
                  # Map common API errors to actionable user messages
                  if any(kw in err_lower for kw in ("credit balance", "billing", "quota", "insufficient_quota", "rate limit", "rate_limit")):
                      user_msg = (
                          "*API billing or rate-limit error: your account has insufficient credits "
                          "or has hit a usage limit. Please check your provider's billing dashboard.*"
                      )
                  elif any(kw in err_lower for kw in ("invalid api key", "invalid_api_key", "authentication", "unauthorized", "401")):
                      user_msg = (
                          "*Authentication error: the API key for this provider is invalid or expired. "
                          "Please check your API key in Settings.*"
                      )
                  elif any(kw in err_lower for kw in ("unsupported parameter", "unsupported_parameter")):
                      user_msg = (
                          f"*Model parameter error: {err_str}. "
                          "This model may not support the current configuration.*"
                      )
                  elif any(kw in err_lower for kw in ("context", "maximum", "too long", "too large", "token limit", "overloaded")):
                      user_msg = (
                          "*The conversation has grown too long for this model's context window. "
                          "Please start a new chat or reduce the amount of history.*"
                      )
                  elif _is_transient_provider_error(e):
                      user_msg = (
                          "*The AI provider is temporarily unavailable. Please try again in a moment.*"
                      )
                  else:
                      user_msg = f"*LLM API error: {err_str}*"
                  if not full_content:
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
                  level = _compute_confidence(final_avg)
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

              # Phase 32: JSON done event signals main response complete (frontend stops streaming cursor)
              # Phase 061: this 'done' event flows through the regular MAXLEN-bounded _emit path.
              # The EXPLICIT terminal sentinel in the producer's finally (via _emit_terminal) is the
              # safety net for paths that don't reach this line (TimeoutError, exceptions, cancellation)
              # — that one is exempt from MAXLEN trimming (Pitfall 5).
              # Phase 067.4 (Rule 3 deviation): suggestion block now precedes this 'done' emit
              # so SSE-replay readers see suggestions before the consumer's terminal break.
              await _emit(redis, run_id, 'done')

              # Phase 32: True stream end — frontend returns from streamMessage
              await _emit(redis, run_id, 'stream_end')

            except asyncio.TimeoutError:
                # Phase 066 D-066-05 + D-066-07: per-LLM-call asyncio.timeout
                # fired inside the SDK iteration block. _last_iteration /
                # _last_model_id / _last_per_call_budget were captured at the
                # iteration start (closure variables initialized to defaults
                # at top of agent_runner so an early TimeoutError before the
                # loop iterates won't UnboundLocalError).
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
                    # 1. SHIELDED PERSIST — preserves 058/059 contract.
                    _msg_id_for_runs: str | None = None
                    try:
                        _msg_id_for_runs = await _persist_assistant_message()
                    except BaseException:
                        logger.exception("Shielded persist failed for run %s", run_id)

                    # 2. TERMINAL SENTINEL XADD — MUST come BEFORE EXPIRE (Pitfall 2).
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

                    # 3. UPDATE runs row — status/error/completed_at/message_id/tokens.
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
                        if input_tokens_total is None and output_tokens_total is None:
                            logger.warning(
                                "runs.usage missing for run=%s provider=%s model=%s",
                                run_id, _resolved_provider, _resolved_model,
                            )
                        await finalize_run(
                            await get_pg_pool(),
                            run_id=run_id,
                            status=_terminal_status,
                            error=_terminal_error,
                            completed_at=datetime.now(timezone.utc),
                            message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                            input_tokens=input_tokens_total,
                            output_tokens=output_tokens_total,
                        )
                    except BaseException:
                        logger.exception("runs row UPDATE failed for run %s", run_id)

                    # 4. EXPIRE Redis stream — 600s completed, 60s failed/cancelled (REDIS-SETUP.md TTL discipline)
                    _ttl = 600 if _terminal_status == "completed" else 60
                    try:
                        await redis.expire(f"run:{run_id}", _ttl)
                    except BaseException:
                        logger.exception("EXPIRE failed for run %s", run_id)

                    # 5. ZREM sorted-set indexes
                    try:
                        await redis.zrem("runs:active", str(run_id))
                        await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
                    except BaseException:
                        logger.exception("ZREM failed for run %s", run_id)

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
        },
    )
