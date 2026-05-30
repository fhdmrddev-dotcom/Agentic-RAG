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
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


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


@dataclass
class AgentLoopResult:
    """Structured return from run_agent_loop — the outputs the producer's
    shielded finalizer (STAYS in threads.py) needs after the loop ends.

    Plain (non-frozen) like ToolResult — it is a return bag, not an input
    context. _shielded_finalize reads the token totals + persisted warnings and
    calls persist() (the bound _persist_assistant_message) to complete the run.
    """
    persist: Callable[..., Awaitable[Any]]  # reference to the bound _persist_assistant_message
    input_tokens_total: int | None = None
    output_tokens_total: int | None = None
    persisted_system_warnings: list[dict] = field(default_factory=list)
    full_content_final: str = ""


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
# Agent loop
# ---------------------------------------------------------------------------

async def run_agent_loop(ctx: RunContext, *, emit, emit_terminal, spawn) -> AgentLoopResult:
    """Drive the multi-iteration tool-calling loop for one run (STUB).

    The loop body lands in Plan 03 after the seam is signed off (D-089-04).
    """
    raise NotImplementedError("loop body lands in Plan 03 after seam sign-off")
