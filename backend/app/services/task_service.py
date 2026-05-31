"""Phase 085 D-085-08..16 — task() sub-agent service.

Spawns a sub-agent with constrained toolset, 1-level nesting cap (via
parent_run_id), and per-run + global concurrency caps. Each sub-agent gets
its OWN ``runs`` row + its OWN Redis Stream ``run:{sub_run_id}``. The PARENT
agent's stream only sees the two bookend events ``sub_agent_start`` and
``sub_agent_done`` — every internal tool call from the sub-agent emits on
its own ``run:{sub_run_id}`` stream so the Phase 086 demuxer can route
panel drill-down without re-scraping ``messages.tool_calls``.

Cross-provider model safety: ``resolve_sub_agent_model_safely`` (from the
shared ``sub_agent_models`` helper) replicates the D-075.5-04 footgun
mitigation that lives in ``sub_agent_service.py:62-89`` — that file is
byte-frozen per D-085-16, so the helper REPLICATES rather than imports
the logic.

Concurrency caps:
  - per-run: ``ctx.per_run_task_semaphore`` (asyncio.Semaphore, default 3).
    Initialized once per top-level run in agent_runner; sub-agents inherit
    the SAME semaphore via sub_ctx so a single run cannot fan out beyond
    the cap even if the LLM goes recursive (which the nesting cap also
    forbids — defense-in-depth).
  - global: Redis ``tasks:global:active`` counter, capped via Lua atomic
    INCR+EXPIRE script. Multi-worker safe. TTL 7200s = eventual-consistency
    safety net so crashed workers don't permanently leak slots.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db.runs import finalize_run, insert_run
from app.dependencies import get_pg_pool
from app.services.openai_service import (
    create_adaptive_streaming_chat,
    get_tools,
)
from app.services.sub_agent_models import resolve_sub_agent_model_safely
from app.services.tool_dispatcher import ToolContext, ToolResult, dispatch_tool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Global concurrency cap helpers (D-085-15)
# ---------------------------------------------------------------------------

# Lua: INCR-with-cap + EXPIRE in one atomic step.
# Returns 1 when slot acquired (counter incremented under the cap), 0 when
# the counter is already at the cap. EXPIRE on every INCR refreshes the
# 7200s safety TTL — a crashed worker's leaked slot eventually clears.
_ACQUIRE_LUA = """
local cur = redis.call('GET', KEYS[1])
if cur and tonumber(cur) >= tonumber(ARGV[1]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
"""


async def acquire_global_task_slot(redis: Any, max_concurrent: int) -> bool:
    """Try to acquire one slot in the global ``tasks:global:active`` counter.

    Returns True on success (slot reserved — caller MUST pair with
    ``release_global_task_slot`` in a finally block), False on cap reached
    or on Redis error (fail-closed — refuse the spawn rather than
    silently exceed the cap).
    """
    try:
        result = await redis.eval(
            _ACQUIRE_LUA, 1, "tasks:global:active", str(max_concurrent), "7200"
        )
        return bool(int(result))
    except Exception:  # noqa: BLE001
        logger.exception("acquire_global_task_slot failed")
        return False


async def release_global_task_slot(redis: Any) -> None:
    """Release one slot in the global counter. Best-effort — TTL handles drift."""
    try:
        await redis.decr("tasks:global:active")
    except Exception:  # noqa: BLE001
        logger.exception("release_global_task_slot failed")


# ---------------------------------------------------------------------------
# Sub-agent loop (D-085-08..16)
# ---------------------------------------------------------------------------

def _build_sub_agent_system_prompt(
    description: str,
    instructions: str | None,
    allowed_tools: list[str],
) -> str:
    """Server-controlled base prompt + appended task-specific instructions.

    D-085-08: LLMs supply task ``instructions`` but DO NOT author the full
    system prompt. The base prompt names the constrained capability surface
    and the "produce a concise final message" contract that maps to
    D-085-13 (return summary text only).
    """
    base = (
        "You are a focused sub-agent spawned to complete a specific task. "
        f"Your task: {description}\n\n"
        f"Available tools: {', '.join(sorted(allowed_tools)) or 'none'}\n"
        "You CANNOT call task(), ask_user(), or write_todos(). "
        "When done, produce a concise final message summarizing what you accomplished."
    )
    if instructions:
        return base + "\n\nTask-specific guidance:\n" + instructions
    return base


def _consume_sync_stream(stream: Any) -> tuple[str, list[dict]]:
    """Drain a sync OpenAI-shaped stream into (content_text, tool_calls).

    This runs inside ``run_in_threadpool`` (see ``_stream_one_iteration``)
    because ``create_adaptive_streaming_chat`` returns a SYNC iterator
    (not async-iterable). Mirrors the tool_calls_buffer accumulation
    pattern from ``threads.py:_on_chunk_openai`` at lines 2294-2311 but
    without provider-specific branching — sub-agents always go through
    the OpenAI-style path because they inherit the parent's provider via
    ``resolve_sub_agent_model_safely``.
    """
    content_parts: list[str] = []
    # tool_calls_buffer keyed by stream-emitted index; values are accumulated dicts.
    buffer: dict[int, dict] = {}
    for chunk in stream:
        if not getattr(chunk, "choices", None):
            continue
        choice = chunk.choices[0]
        delta = getattr(choice, "delta", None)
        if delta is None:
            continue
        if getattr(delta, "content", None):
            content_parts.append(delta.content)
        tcs = getattr(delta, "tool_calls", None) or []
        for tc in tcs:
            idx = getattr(tc, "index", 0) or 0
            if idx not in buffer:
                buffer[idx] = {"id": "", "name": "", "arguments": ""}
            if getattr(tc, "id", None):
                buffer[idx]["id"] = tc.id
            fn = getattr(tc, "function", None)
            if fn is not None:
                if getattr(fn, "name", None):
                    buffer[idx]["name"] = fn.name
                if getattr(fn, "arguments", None):
                    buffer[idx]["arguments"] += fn.arguments
    # Convert buffer dict to ordered list by index
    tool_calls = [buffer[i] for i in sorted(buffer.keys())]
    return "".join(content_parts), tool_calls


async def _stream_one_iteration(
    *,
    messages: list[dict],
    tools: list[dict],
    model: str,
    user_settings: Any,
) -> tuple[str, list[dict]]:
    """Run one streaming LLM iteration in a worker thread.

    Returns ``(content_text, tool_calls_list)`` where each ``tool_calls`` entry
    is the shape consumed by ``dispatch_tool`` later in this module: a dict
    with ``id`` / ``name`` / ``arguments`` (the raw JSON string from the LLM)
    — the loop parses arguments before each ``dispatch_tool`` call.
    """
    def _run_sync() -> tuple[str, list[dict]]:
        stream, _calling_mode = create_adaptive_streaming_chat(
            messages=messages,
            model=model,
            user_settings=user_settings,
            tools_override=tools,
        )
        try:
            return _consume_sync_stream(stream)
        finally:
            # Best-effort close — SDK streams expose .close() (sync) for resource cleanup.
            try:
                close = getattr(stream, "close", None)
                if close is not None:
                    close()
            except Exception:  # noqa: BLE001
                logger.debug("stream close failed; ignoring", exc_info=True)
    return await run_in_threadpool(_run_sync)


async def run_task_sub_agent(
    *,
    parent_ctx: ToolContext,
    description: str,
    instructions: str | None,
    allowed_tools: list[str],
    max_steps: int,
    system_prompt_override: str | None = None,
) -> dict:
    """Spawn a sub-agent with its own runs row + stream + tool dispatch loop.

    Returns ``{"sub_run_id": UUID, "summary": str, "status": "completed"|"error"}``.

    Phase 091 OQ1 (additive, backward-compatible): when ``system_prompt_override``
    is provided, it REPLACES the hardcoded ``_build_sub_agent_system_prompt``
    "focused sub-agent" framing for THIS call only — the harness ``llm_agent`` /
    ``llm_batch_agents`` phases need the phase's own ``prompt`` to be the system
    framing, not the generic sub-agent text. ``None`` (every existing caller —
    tasks / sub-agents) is byte-identical to pre-091 behavior: the helper-built
    prompt is used unchanged. ``_build_sub_agent_system_prompt`` and
    ``resolve_sub_agent_model_safely`` (D-085-16 replicated footgun) are NOT
    touched.

    Flow:
      1. Resolve a provider-safe sub-agent model name (D-075.5-04 footgun).
      2. INSERT a new runs row with ``parent_run_id = parent_ctx.run_id``
         (Plan 01 migration 055 added the column).
      3. Emit ``sub_agent_start`` on the PARENT's run stream so the panel
         knows there's a drill-down available.
      4. Build ``sub_ctx`` — same Redis + Supabase + pool, NEW run_id,
         FRESH ``previous_files_in_run={}`` (Pitfall 7 — don't leak parent's
         sandbox state), ``parent_run_id=parent_ctx.run_id`` (non-null
         enforces the 1-level nesting cap inside the sub-agent's own
         _handle_task calls), ``available_tools=allowed_tools``.
      5. Run the minimal LLM-and-dispatch loop bounded by ``max_steps``.
         Each iteration's ``dispatch_tool`` uses ``sub_ctx`` whose ``run_id``
         is ``sub_run_id`` so internal tool events emit on the SUB-agent's
         stream (Phase 086 demux contract — R9).
      6. In ``finally``: ``finalize_run`` the sub-agent's runs row, then
         ``sub_agent_done`` on the PARENT's stream.
    """
    sub_run_id = uuid4()
    pool = await get_pg_pool()

    effective_model = resolve_sub_agent_model_safely(
        parent_ctx.user_settings,
        override_model=None,  # D-085-11 — no LLM-controlled model override in v1
        fallback_model=parent_ctx.model or None,
    )

    provider = (
        (parent_ctx.user_settings.active_provider if parent_ctx.user_settings else "")
        or "unknown"
    )

    # 1. INSERT sub-agent's runs row with parent_run_id set
    try:
        await insert_run(
            pool=pool,
            run_id=sub_run_id,
            thread_id=UUID(parent_ctx.thread_id),
            user_id=UUID(parent_ctx.current_user["id"]),
            status="streaming",
            model=effective_model,
            provider=provider,
            parent_run_id=parent_ctx.run_id,
        )
    except Exception:  # noqa: BLE001
        # If the runs row can't be created, propagate to caller — the
        # handler will see the exception and translate to ToolResult.
        logger.exception(
            "task_service: insert_run failed for sub_run_id=%s parent=%s",
            sub_run_id, parent_ctx.run_id,
        )
        raise

    # 2. Emit sub_agent_start on PARENT's stream (panel drill-down hint)
    try:
        await parent_ctx.emit(
            parent_ctx.redis, parent_ctx.run_id, 'sub_agent_start',
            sub_run_id=str(sub_run_id),
            description=description,
            tools=allowed_tools,
            max_steps=max_steps,
        )
    except Exception:  # noqa: BLE001
        logger.exception("sub_agent_start emit failed for sub_run_id=%s", sub_run_id)

    # 3. Build sub-agent's ToolContext
    sub_ctx = ToolContext(
        redis=parent_ctx.redis,
        run_id=sub_run_id,
        thread_id=parent_ctx.thread_id,
        supabase=parent_ctx.supabase,
        pool=parent_ctx.pool,
        user_settings=parent_ctx.user_settings,
        current_user=parent_ctx.current_user,
        folder_subtree_ids=parent_ctx.folder_subtree_ids,
        scoped_folder_path=parent_ctx.scoped_folder_path,
        emit=parent_ctx.emit,
        spawn=parent_ctx.spawn,
        model=effective_model,
        # Pitfall 7 — fresh dict, NOT a reference to parent's. Sub-agent's
        # execute_code output tracking is isolated from parent's; otherwise
        # the parent's pinned-outputs panel would briefly show files that
        # belong to the sub-agent and vice versa.
        previous_files_in_run={},
        # D-085-12 — non-null parent_run_id makes _handle_task short-circuit
        # inside the sub-agent's own dispatch chain. 1-level nesting cap.
        parent_run_id=parent_ctx.run_id,
        # D-085-15 — share the parent's semaphore. Sub-agents can't spawn
        # task() (nesting cap above) but sharing the semaphore is the
        # belt-and-suspenders guarantee.
        per_run_task_semaphore=parent_ctx.per_run_task_semaphore,
        # D-085-09 — constrained toolset; dispatch_tool will route on this.
        available_tools=list(allowed_tools),
    )

    # 4. Build the constrained tool-schema list once (subset of parent's tool schemas)
    full_tool_schemas = get_tools(parent_ctx.user_settings)
    sub_tool_schemas = [
        t for t in full_tool_schemas
        if t.get("function", {}).get("name") in allowed_tools
    ]

    # 5. The minimal sub-agent loop
    #    OQ1 (Phase 091): system_prompt_override REPLACES the helper-built framing
    #    for harness phases; None = byte-identical to pre-091 (helper used unchanged).
    if system_prompt_override is not None:
        sys_prompt = system_prompt_override
    else:
        sys_prompt = _build_sub_agent_system_prompt(
            description, instructions, allowed_tools
        )
    messages: list[dict] = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": description},
    ]
    summary = ""
    content = ""
    final_status = "completed"
    error_msg: str | None = None

    try:
        for step in range(max_steps):
            # Emit per-iteration heartbeat on the SUB-agent's stream so Phase
            # 086 demuxer can render iteration counters for the drill-down.
            try:
                await parent_ctx.emit(
                    parent_ctx.redis, sub_run_id, 'iteration_start', iteration=step,
                )
            except Exception:  # noqa: BLE001
                logger.debug("iteration_start emit failed", exc_info=True)

            content, tool_calls = await _stream_one_iteration(
                messages=messages,
                tools=sub_tool_schemas,
                model=effective_model,
                user_settings=parent_ctx.user_settings,
            )

            if not tool_calls:
                # LLM produced a final answer — break out of the loop.
                summary = content or ""
                break

            # Dispatch each tool via the shared dispatcher with sub_ctx.
            # ctx.run_id is sub_run_id so tool_start/tool_end events emit
            # on the SUB-agent's stream (R9 — Phase 086 demux contract).
            tool_results_to_append: list[dict] = []
            for idx, tc in enumerate(tool_calls):
                sub_ctx.tool_call_id = tc.get("id", "")
                sub_ctx.tool_index = idx

                # Parse args (JSON string from the LLM) before dispatching.
                try:
                    import json as _json
                    parsed_args = _json.loads(tc.get("arguments") or "{}")
                except (ValueError, TypeError):
                    parsed_args = tc.get("args") or {}

                tr = await dispatch_tool(tc.get("name") or "", parsed_args, sub_ctx)
                tool_results_to_append.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": tr.result if isinstance(tr, ToolResult) else str(tr),
                })

            # Replay assistant + tool messages for next iteration
            messages.append({
                "role": "assistant",
                "content": content,
                "tool_calls": [
                    {
                        "id": tc.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.get("name", ""),
                            "arguments": tc.get("arguments", ""),
                        },
                    }
                    for tc in tool_calls
                ],
            })
            messages.extend(tool_results_to_append)
        else:
            # max_steps exhausted without producing a tool-free final answer.
            # Not an error — the sub-agent just ran out of steps. D-085-13:
            # we return the last content as the summary.
            summary = content or "Sub-agent reached max_steps without producing a final answer."

    except Exception as e:  # noqa: BLE001
        logger.exception(
            "task_service: sub-agent loop failed (sub_run_id=%s)", sub_run_id,
        )
        final_status = "error"
        error_msg = str(e)
        summary = f"Sub-agent failed: {e}"
    finally:
        # 6a. Finalize the sub-agent's runs row.
        try:
            await finalize_run(
                pool=pool,
                run_id=sub_run_id,
                status="completed" if final_status == "completed" else "failed",
                error=error_msg,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=None,
                output_tokens=None,
            )
        except Exception:  # noqa: BLE001
            logger.exception("finalize_run failed for sub_run_id=%s", sub_run_id)

        # 6b. Terminal sentinel on the SUB-agent's stream (for /runs/{sub_run_id}/stream
        # consumers that may be tailing the drill-down). Lazy-imported here to avoid
        # the threads.py ↔ task_service.py module-load cycle.
        try:
            from app.api.threads import _emit_terminal  # noqa: PLC0415
            await _emit_terminal(
                parent_ctx.redis,
                sub_run_id,
                "done" if final_status == "completed" else "error",
            )
        except Exception:  # noqa: BLE001
            logger.exception("_emit_terminal failed for sub_run_id=%s", sub_run_id)

        # 6c. sub_agent_done on PARENT's stream — final bookend
        try:
            await parent_ctx.emit(
                parent_ctx.redis, parent_ctx.run_id, 'sub_agent_done',
                sub_run_id=str(sub_run_id),
                status=final_status,
                summary=summary,
            )
        except Exception:  # noqa: BLE001
            logger.exception("sub_agent_done emit failed for sub_run_id=%s", sub_run_id)

    return {"sub_run_id": sub_run_id, "summary": summary, "status": final_status}
