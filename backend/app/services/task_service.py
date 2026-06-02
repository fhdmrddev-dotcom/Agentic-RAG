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
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db.runs import finalize_run, insert_run
from app.dependencies import get_pg_pool
from app.services.openai_service import get_tools
from app.services.provider_gateway import GatewayRequest, open_stream
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


async def _stream_one_iteration(
    *,
    messages: list[dict],
    tools: list[dict],
    model: str,
    user_settings: Any,
    provider: str | None = None,
    structured_injected: list[bool] | None = None,
) -> tuple[str, list[dict]]:
    """Run one streaming LLM iteration through the provider gateway.

    Phase 093 (F9 core fix — SC#1): this drives the SHARED provider gateway
    (``open_stream``) instead of calling the OpenAI-only adaptive-stream helper
    directly and discarding ``calling_mode`` (the old F9 bug). Honoring
    ``calling_mode`` fixes harness tool-firing on BOTH axes: native
    Anthropic/Google now reach their SDK adapters, and tools are sent per the
    RESOLVED mode. NATIVE providers — including the registered-default compat
    natives DeepSeek/Moonshot/GLM/MiniMax, which are ``native_tools:True`` →
    NATIVE — emit tools via the API param and fire natively (the happy path);
    a STRUCTURED-mode provider (``native_tools:False`` / registry-miss /
    OpenRouter-xml — the case-sensitive-registry trap) gets the inject-once +
    ``parse_structured_tool_calls`` recovery below (the safety net). The old
    path discarded the mode, so the native SDK adapters were never reached and
    STRUCTURED providers never recovered (narrated ``search_documents`` as text).

    This is the SAME drive mechanism the Deep agent-loop uses post-092.5
    (``agent_loop.py:1352-1708``); routing Deep ``task()``/``analyze_document``
    sub-agents through the gateway is the CORRECT path for them too — it makes
    them cross-provider-robust as a bonus while staying non-regressing (D-14
    byte-identical-Deep guard; the eval ``task``-cell skeleton diff is the
    verifier-owned LIVE proof, the deterministic full-suite net-new=0 is Task 2).

    Returns ``(content_text, tool_calls_list)`` where each ``tool_calls`` entry
    is the shape consumed by ``dispatch_tool`` later in this module: a dict
    with ``id`` / ``name`` / ``arguments`` (the raw JSON string from the LLM)
    — the loop parses arguments before each ``dispatch_tool`` call.

    ``provider`` is the active provider routing key (sub-agents inherit the
    parent provider; ``run_task_sub_agent`` threads it in). When ``None`` it is
    derived from ``user_settings.active_provider`` so the lone direct caller
    (``harness/phase_types.py:_exec_llm_single``) keeps routing correctly.

    ``structured_injected`` is a single-element mutable box (the inject-once
    flag — Pitfall 2) the sub-agent loop owns so the system message never
    accumulates repeated ``TOOL_USAGE_INSTRUCTIONS`` blocks across iterations.
    When ``None`` (the ``llm_single`` direct caller, which never loops) a local
    one-shot box is used.
    """
    from app.services.openai_service import CallingMode

    # Route key: sub-agents inherit the parent provider; the lone direct caller
    # (llm_single) passes provider=None → derive from active_provider.
    _provider = provider or (
        getattr(user_settings, "active_provider", "") if user_settings else ""
    ) or "unknown"

    if structured_injected is None:
        structured_injected = [False]

    # The openai-compat else-branch keys its <think>/usage/boundary logic on the
    # REGISTRY-derived provider for this model (agent_loop.py:1616-1617 verbatim),
    # so the adapter normalizes correctly. anthropic/google route on the active
    # provider directly.
    _adapter_provider = _provider
    if _provider not in ("anthropic", "google"):
        from app.config import get_model_capability_async

        _cap = await get_model_capability_async(model) or {}
        _adapter_provider = (_cap.get("provider") or _provider or "unknown").lower()

    # CR-01 (093 REVIEW) — pull the system framing out of messages so the native
    # Anthropic/Google adapters receive it. Their message-converters STRIP every
    # role="system" entry (anthropic_service.py:60/72-74) and build the top-level
    # system block from system_prompt ONLY (anthropic_service.py:174) — so without
    # this the sub-agent / phase system prompt is silently dropped on Anthropic
    # (breaching the byte-identical-Deep RED LINE). The openai_compat adapter does
    # NOT read system_prompt (it sends the messages array, system included) → this
    # is a NO-OP there (byte-identical for OpenAI / compat-natives / OpenRouter /
    # Ollama). Mirrors agent_loop.py:1553 / :1628, which set system_prompt on the
    # request REDUNDANTLY alongside messages[0] precisely so the native adapters
    # receive it. Captured BEFORE the STRUCTURED inject mutates messages[_i] below —
    # correct because Anthropic/Google are native_tools:True → NATIVE → the inject
    # never runs for them.
    _system_prompt = next(
        (m.get("content", "") for m in messages if m.get("role") == "system"),
        "",
    )

    _gw_request = GatewayRequest(
        messages=messages,
        model=model,
        active_provider_name=_adapter_provider,
        tools=tools,
        system_prompt=_system_prompt,
        user_settings=user_settings,
        tool_choice="auto",
    )
    stream, calling_mode = await open_stream(_provider, _gw_request)

    # D-03 half b — STRUCTURED inject ONCE (Pitfall 2), BEFORE the drain, into the
    # system message. The gateway's openai_compat adapter SKIPS tool emission on
    # STRUCTURED and does NOT inject (openai_compat.py) — the consumer must. Mirrors
    # the Deep residue at agent_loop.py:1639-1648 (inject-once flag).
    if calling_mode == CallingMode.STRUCTURED and not structured_injected[0]:
        from app.services.agent_loop import (
            TOOL_USAGE_INSTRUCTIONS,
            _format_tool_list,
        )

        _tl = _format_tool_list(tools if tools else get_tools(user_settings))
        for _i, _m in enumerate(messages):
            if _m.get("role") == "system":
                messages[_i] = {
                    "role": "system",
                    "content": _m["content"]
                    + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl),
                }
                structured_injected[0] = True
                break

    # anthropic/google emit tool_start (complete args) → buffer built there
    # (len()-keyed). The openai-compat adapter emits NO synthetic tool_start; it
    # builds the buffer from tool_preparing (id+name) + tool_args_progress (full
    # cumulative code_so_far args). Each stream emits only ONE family, so the two
    # build paths never collide (agent_loop.py:1364-1371).
    _build_from_progress = _provider not in ("anthropic", "google")

    def _drain() -> tuple[str, list[dict]]:
        # IN-05: the gateway annotation says AsyncIterator but the adapters return
        # BARE SYNC generators — drive `for event in stream:` here inside the
        # threadpool, NEVER the async-iteration form (mirrors
        # _drain_stream_with_close_on_cancel + the old sync stream drive).
        content_parts: list[str] = []
        buffer: dict[int, dict] = {}
        try:
            for event in stream:
                et = event.get("type")
                if et == "delta":
                    _text = event.get("content", "")
                    if _text:
                        content_parts.append(_text)
                elif et == "reasoning_delta":
                    # Sub-agent ignores reasoning text — not round-tripped here.
                    pass
                elif et == "tool_preparing":
                    if _build_from_progress:
                        idx = event.get("index", len(buffer))
                        if idx not in buffer:
                            buffer[idx] = {
                                "id": event.get("id", "") or "",
                                "name": event.get("name", "") or "",
                                "arguments": "",
                            }
                elif et == "tool_args_progress":
                    if _build_from_progress:
                        tidx = event["tool_index"]
                        b = buffer.setdefault(
                            tidx, {"id": "", "name": "", "arguments": ""}
                        )
                        if event.get("name"):
                            b["name"] = event["name"]
                        # L-4: full cumulative args live in code_so_far.
                        b["arguments"] = event.get("code_so_far", "")
                elif et == "tool_start":
                    buffer[len(buffer)] = {
                        "id": event["id"],
                        "name": event["name"],
                        "arguments": json.dumps(event.get("args", {})),
                    }
                # usage / usage_delta / finish ignored — the sub-agent return
                # needs no token SUM or thought_signature round-trip (A1).
        finally:
            close = getattr(stream, "close", None)
            if close is not None:
                try:
                    close()
                except Exception:  # noqa: BLE001
                    logger.debug("stream close failed; ignoring", exc_info=True)
        return "".join(content_parts), [buffer[i] for i in sorted(buffer)]

    content, tool_calls = await run_in_threadpool(_drain)

    # D-03 half b — STRUCTURED post-parse AFTER the drain (agent_loop.py:1675-1696).
    # The compat natives narrate the tool call as a JSON block in content; recover
    # it so search_documents actually fires.
    if calling_mode == CallingMode.STRUCTURED:
        from app.services.tool_parser import parse_structured_tool_calls

        structured = parse_structured_tool_calls(content)
        if structured:
            tool_calls = [
                {
                    "id": c.id,
                    "name": c.function.name,
                    "arguments": c.function.arguments,
                }
                for c in structured
            ]
            content = ""

    return content, tool_calls


async def run_task_sub_agent(
    *,
    parent_ctx: ToolContext,
    description: str,
    instructions: str | None,
    allowed_tools: list[str],
    max_steps: int,
    system_prompt_override: str | None = None,
    tools_override: list[dict] | None = None,
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

    Phase 091 WR-04 (091-08 / additive, backward-compatible): when ``tools_override``
    is provided, it REPLACES the schema list the sub-agent model sees — the harness
    ``llm_agent`` / ``llm_batch_agents`` phases pass the already-whitelisted +
    TOOL-05-budget-capped list (``apply_tool_budget(...)``) so the per-provider
    ``max_tools`` ceiling is actually applied to what the model sees (the layer-1 cap
    was previously computed-then-discarded — a no-op). ``None`` (every existing
    caller — tasks / sub-agents / Deep Mode) is byte-identical to pre-091: the
    sub-agent rebuilds its own ``allowed_tools``-filtered schema list as before (no
    cap on the Deep-Mode path — SC#2 / the Phase 089 byte-identical invariant).

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

    # 4. Build the constrained tool-schema list once (subset of parent's tool schemas).
    #    WR-04 (091-08): a harness phase passes tools_override = the already
    #    whitelist-filtered + TOOL-05-budget-capped list, so the per-provider
    #    max_tools ceiling actually applies to what the model SEES. None (every
    #    Deep-Mode / tasks caller) rebuilds the allowed_tools-filtered list exactly
    #    as before — byte-identical, NO cap (SC#2 / Phase 089 invariant).
    if tools_override is not None:
        sub_tool_schemas = tools_override
    else:
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

    # Phase 093 (Pitfall 2): inject-once flag for STRUCTURED-mode compat natives,
    # shared across the loop iterations so TOOL_USAGE_INSTRUCTIONS is appended to
    # the system message at most once (the message never accumulates blocks).
    structured_injected: list[bool] = [False]

    # F7 (092-07): accumulate the grounding off every ToolResult so the harness
    # final answer can SHOW its sources (a harness research phase gathers them via
    # search_documents here, but the FINAL phase is summarize — llm_single with no
    # tools — so the sub-agent return MUST carry them up to the engine). Mirrors the
    # Deep agent-loop accumulation EXACTLY (agent_loop.py:2229-2234): source_refs +
    # citations EXTEND (per-tool lists), similarity_score APPENDS one avg per call.
    sub_source_refs: list[dict] = []
    sub_citations: list[dict] = []
    sub_similarity_scores: list[float] = []

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
                provider=provider,
                structured_injected=structured_injected,
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
                # F7 (092-07): harvest the grounding from this ToolResult — same
                # extend/extend/append shape the Deep loop uses (agent_loop.py:2229).
                if isinstance(tr, ToolResult):
                    if tr.source_refs:
                        sub_source_refs.extend(tr.source_refs)
                    if tr.citations:
                        sub_citations.extend(tr.citations)
                    if tr.similarity_score is not None:
                        sub_similarity_scores.append(tr.similarity_score)

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

    # F7 (092-07): return the accumulated grounding alongside the summary so the
    # harness phase executor can thread it onto the run-level union (the engine then
    # attaches it to the persisted+emitted final answer). Existing callers (Deep
    # task() / analyze_document) ignore these extra keys — additive, no behavior
    # change. similarity_scores stays a raw per-call list; the engine computes the
    # avg → confidence using the SAME _compute_confidence the Deep path uses.
    return {
        "sub_run_id": sub_run_id,
        "summary": summary,
        "status": final_status,
        "source_refs": sub_source_refs,
        "citations": sub_citations,
        "similarity_scores": sub_similarity_scores,
    }
