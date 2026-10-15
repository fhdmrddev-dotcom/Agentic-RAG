"""Phase 085 agent-control tools: ``task`` (sub-agents), ``write_todos`` and ``ask_user``.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``aexec``, ``settings``. Patch ``app.services.tools.agent_control.<name>``; a patch of the same
name on ``tool_dispatcher`` no longer reaches the code that calls it (and, because the registry
module no longer imports them, raises ``AttributeError`` instead of silently patching nothing).

``_handle_task`` imports ``task_service`` LAZILY (``task_service`` imports ``tool_dispatcher`` at
module level) — keep it lazy.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from app.utils.db import aexec
from app.config import settings
from app.services.tools.base import ToolContext, ToolResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase 085 — sub-agent toolset constants (D-085-09)
# ---------------------------------------------------------------------------

# Default sub-agent toolset when the parent agent calls task() without a `tools`
# arg — the read-only KB + workspace surface. NB the intersection with the
# parent's available_tools is what actually gets passed to the sub-agent: this
# frozenset is the upper bound, not the floor.
_SUB_AGENT_DEFAULT_READ_ONLY: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "web_search", "ls", "tree", "grep", "glob",
    "analyze_document", "query_tables",
    "workspace_read", "workspace_list",
})

# Tools the LLM is NEVER allowed to grant to a sub-agent. task() itself is the
# nesting-cap belt; ask_user inside a sub-agent has no UI surface (sub-agents
# don't own a panel slot); write_todos is the parent's UI hook, not the
# sub-agent's. Defense-in-depth: also enforced in run_task_sub_agent's
# sub_ctx.available_tools (which dispatch_tool reads on every call).
# Phase 273: show_artifact is chat-top-level only (openai_service.CHAT_ONLY_TOOLS) — an artifact
# belongs under the chat answer, and a sub-agent has no message to put it under.
_SUB_AGENT_EXCLUDED: frozenset[str] = frozenset({"task", "ask_user", "write_todos", "show_artifact"})


async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-08..16 — task() spawns a sub-agent.

    Gate sequence (each gate returns a friendly LLM-readable error on refusal):
      1. parent_run_id != None — 1-level nesting cap (D-085-12).
      2. description empty/missing.
      3. requested tools (if any) violate the subset rule or include
         task/ask_user/write_todos (D-085-09).
      4. max_steps non-integer.
      5. per-run concurrency cap saturated (D-085-15, in-process Semaphore).
      6. global concurrency cap saturated (D-085-15, Redis Lua counter).

    On success: spawn run_task_sub_agent, await summary, return
    ToolResult(result=<summary>). Per D-085-13 the LLM sees ONLY the summary
    text — the full sub-agent transcript lives on run:{sub_run_id} for the
    Phase 086 demuxer to surface.

    Concurrency invariant: both slots (per-run + global) are released in a
    finally block. If global acquire fails AFTER per-run was acquired, we
    release per-run before returning the refusal — otherwise a single
    blocked spawn would permanently consume one of the 3 per-run slots.
    """
    # Gate 1: nesting cap (D-085-12) — HARD GATE, runs first to short-circuit
    # before any other work happens.
    if ctx.parent_run_id is not None:
        return ToolResult(
            result="task() unavailable inside a sub-agent — 1-level nesting cap"
        )

    description = (args.get("description") or "").strip()
    if not description:
        return ToolResult(result="task() requires a non-empty description argument")

    instructions = args.get("instructions")
    requested_tools = args.get("tools")
    max_steps_arg = args.get("max_steps")

    # Gate 2: toolset subset validation (D-085-09)
    available = set(ctx.available_tools or [])
    if requested_tools is None:
        # No tools arg — use the default read-only set, intersected with
        # what the parent actually has available (sanitizes case where the
        # parent's toolset is itself restricted, e.g. explorer mode).
        sub_tools = sorted(available & _SUB_AGENT_DEFAULT_READ_ONLY)
    else:
        invalid = [
            t for t in requested_tools
            if t not in available or t in _SUB_AGENT_EXCLUDED
        ]
        if invalid:
            return ToolResult(
                result=(
                    f"task() refused: tools {invalid} not available to sub-agent "
                    "(must be subset of parent's available_tools, excluding "
                    "task/ask_user/write_todos)"
                )
            )
        sub_tools = [t for t in requested_tools if t not in _SUB_AGENT_EXCLUDED]

    if not sub_tools:
        return ToolResult(
            result="task() refused: no usable tools after subset filter"
        )

    # Gate 3: max_steps clamping (D-085-10)
    if max_steps_arg is None:
        max_steps = 5  # default-when-omitted per D-085-10
    else:
        try:
            max_steps = max(1, min(int(max_steps_arg), settings.task_max_steps))
        except (TypeError, ValueError):
            return ToolResult(
                result="task() max_steps must be a positive integer"
            )

    # Gate 4: per-run concurrency cap (D-085-15) — non-blocking try-acquire.
    # asyncio.Semaphore exposes `.locked()` which returns True iff the internal
    # counter has reached zero (no slots free). `locked()` is synchronous and
    # the subsequent `acquire()` won't yield to the event loop when a slot IS
    # available — so the check + acquire pair is atomic within a single
    # coroutine step. asyncio.wait_for(timeout=0) is NOT a viable alternative
    # because it cancels the acquire coroutine before it gets to run at all
    # (verified in Python 3.12). The locked-then-acquire idiom is the
    # canonical non-blocking try-acquire for asyncio.Semaphore.
    sem = ctx.per_run_task_semaphore
    if sem is None:
        return ToolResult(
            result="task() unavailable: per-run semaphore not initialized"
        )
    if sem.locked():
        return ToolResult(result="task() per-run concurrency limit reached")
    # Guaranteed immediate acquire (value > 0); no yield point between
    # locked() and acquire() in single-threaded asyncio.
    await sem.acquire()

    # Gate 5: global concurrency cap (D-085-15)
    # Lazy import to keep the dispatcher module load-cheap and avoid the
    # task_service ↔ tool_dispatcher load-time cycle (task_service imports
    # ToolContext + dispatch_tool from this module).
    from app.services.task_service import (  # noqa: PLC0415
        acquire_global_task_slot,
        release_global_task_slot,
        run_task_sub_agent,
    )

    global_acquired = await acquire_global_task_slot(
        ctx.redis, settings.task_global_concurrency,
    )
    if not global_acquired:
        # Release per-run slot we acquired above — otherwise the LLM's failed
        # task() call would permanently consume one of the 3 per-run slots.
        try:
            sem.release()
        except (ValueError, RuntimeError):
            logger.exception(
                "per-run semaphore release failed on global-cap refusal"
            )
        return ToolResult(
            result=(
                f"task() concurrency limit reached — global cap of "
                f"{settings.task_global_concurrency} active sub-agents"
            )
        )

    # Both slots acquired — spawn the sub-agent. finally block guarantees
    # release of BOTH no matter how the spawn ends (success, exception,
    # cancellation).
    try:
        result = await run_task_sub_agent(
            parent_ctx=ctx,
            description=description,
            instructions=instructions,
            allowed_tools=sub_tools,
            max_steps=max_steps,
        )
    finally:
        try:
            sem.release()
        except (ValueError, RuntimeError):
            logger.exception("per-run semaphore release failed in spawn finally")
        try:
            await release_global_task_slot(ctx.redis)
        except Exception:  # noqa: BLE001
            logger.exception("global task slot release failed in spawn finally")

    # D-085-13 — return only the sub-agent's final summary text to the LLM.
    # Full transcript is reachable via the sub_run_id we emitted on the
    # parent stream (Phase 086 panel will drill into it).
    return ToolResult(result=result.get("summary") or "")


async def _handle_write_todos(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-17..21 — write_todos handler.

    Full-state-replace of the thread's todo list. Validates payload pre-DB
    (mitigates T-085-T1), calls replace_todos in a single asyncpg transaction
    (mitigates T-085-T4 race), re-SELECTs the canonical list, emits a
    ``todo_updated`` SSE event carrying the FULL list (per D-085-21), and
    returns ``{"accepted": N, "version": <ms>}`` JSON to the LLM.

    Lazy import of replace_todos mirrors the workspace handlers' style.
    """
    todos_in = args.get("todos") or []
    # BUG-260529-01: some models (e.g. free OpenRouter llama-3.3-70b) serialize the
    # nested `todos` arg as a JSON string. Coerce + guard so valid stringified
    # payloads succeed and bad shapes return a self-correcting error (not a crash).
    if isinstance(todos_in, str):
        try:
            todos_in = json.loads(todos_in)
        except (ValueError, TypeError):
            return ToolResult(
                result="write_todos: 'todos' must be a JSON array of objects, not a string"
            )
    if not isinstance(todos_in, list):
        return ToolResult(result="write_todos: 'todos' must be a list of objects")

    # Pre-DB validation — fast-fail with a friendly LLM-readable error before
    # any pool acquire so a malformed payload never trips the transaction.
    for t in todos_in:
        if not isinstance(t, dict):
            return ToolResult(
                result="write_todos: each todo must be an object with id, content, status"
            )
        if not t.get("id") or not t.get("content"):
            return ToolResult(result="write_todos: each todo requires id and content")
        if t.get("status") not in ("pending", "in_progress", "completed"):
            return ToolResult(
                result=f"write_todos: invalid status {t.get('status')!r}; "
                "must be pending|in_progress|completed"
            )

    from app.services.todos_service import replace_todos  # noqa: PLC0415

    try:
        result = await replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)
    except Exception as e:  # noqa: BLE001
        logger.exception(
            "write_todos: replace_todos failed for thread=%s", ctx.thread_id
        )
        return ToolResult(result=json.dumps({"error": f"write_todos failed: {e}"}))

    # Re-SELECT canonical list for the SSE payload (RESEARCH §C.3 — D-085-21)
    rows = await ctx.pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        UUID(ctx.thread_id),
    )
    todos_payload = [dict(r) for r in rows]

    await ctx.emit(
        ctx.redis, ctx.run_id, 'todo_updated',
        todos=todos_payload,
    )

    return ToolResult(result=json.dumps({
        "accepted": result["accepted"],
        "version": result["version"],
    }))


def _resolve_ask_timeout(timeout_arg) -> int | None:
    """The wait for one ask_user call: null -> the floor; an integer -> clamped to
    [floor, cap]; anything else -> None (the caller refuses it).

    BUG-261015-03: the floor stops a model-picked ~60 s from expiring the question before a
    person can answer it. The floor equals the null default, so null and "too short" agree.
    """
    floor = settings.ask_user_min_timeout_seconds
    if timeout_arg is None:
        return floor
    try:
        return max(floor, min(int(timeout_arg), settings.ask_user_max_timeout_seconds))
    except (TypeError, ValueError):
        return None


async def _handle_ask_user(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-01..07 — ask_user pause/resume via Redis pub/sub.

    Blocks the agent loop on a Redis SUBSCRIBE until either the user POSTs a
    response (PUBLISH wakes us), the Stop button is hit (PUBLISH cancel
    sentinel), uvicorn shuts down (PUBLISH shutdown sentinel), or the
    configured timeout fires. Returns a normal ``ToolResult`` so the existing
    agent_runner loop continues — no run-state machinery.

    ORDER IS LOAD-BEARING (RESEARCH §A.3 — PUBLISH-before-SUBSCRIBE race
    mitigation):
      1. pubsub.subscribe(channel)              # SUBSCRIBE first — Redis acks
      2. SADD ask_user:channels:{run_id}        # advertise to cancel/shutdown sweeps
      3. messages row insert (kind='ask_user_prompt')   # durable for reload (D-085-05)
      4. emit ask_user_prompt SSE event         # frontend now knows to ask the user
      5. block on get_message                   # NOW we can safely wait

    Steps 1-2 register the subscriber BEFORE the user has any way to know there
    is a question pending. A fast user response can't PUBLISH before step 4,
    by which point the subscription is already alive.

    This handler does NOT use ``ask_user_service.subscribe_for_response`` for
    the full flow because the SSE emit + messages row insert must happen
    BETWEEN the SADD and the block-on-message — see the ordering invariant
    above. ``ask_user_service`` exports the helper for tests and for the
    cancel + shutdown paths that don't need the persistence step.

    Wake payload kinds (RESEARCH §A wire format):
      - {"kind": "response", "response_text": str, "choice_index": int|null}
      - {"kind": "cancel"}    — Stop button or zombie heal
      - {"kind": "shutdown"}  — uvicorn lifespan shutdown

    Empty prompt is a tool error (RESEARCH §A.8 discretion resolution — less
    surprising than rendering "(no prompt)" in the panel).
    """
    prompt = (args.get("prompt") or "").strip()
    if not prompt:
        return ToolResult(result="ask_user requires a non-empty prompt")

    # Per-call timeout override, clamped to [ask_user_min_timeout_seconds,
    # ask_user_max_timeout_seconds]; null waits the floor (D-085-03, BUG-261015-03).
    timeout_seconds = _resolve_ask_timeout(args.get("timeout_seconds"))
    if timeout_seconds is None:
        return ToolResult(
            result="ask_user timeout_seconds must be a positive integer"
        )

    options = args.get("options")

    # tool_call_id is the LLM-supplied id for the current tool call; populated
    # per-dispatch by agent_runner. Without it, we can't name the channel.
    tool_call_id = ctx.tool_call_id or ""
    if not tool_call_id:
        return ToolResult(
            result=(
                "ask_user requires a tool_call_id (internal: "
                "ToolContext.tool_call_id was empty)"
            )
        )

    run_id = ctx.run_id
    channel = f"ask_user:{run_id}:{tool_call_id}"
    channels_set_key = f"ask_user:channels:{run_id}"

    pubsub = ctx.redis.pubsub()

    try:
        # ── Step 1: SUBSCRIBE first ───────────────────────────────────────
        await pubsub.subscribe(channel)
        # ── Step 2: advertise to cancel + shutdown sweep paths ────────────
        await ctx.redis.sadd(channels_set_key, channel)
        await ctx.redis.expire(channels_set_key, 3600)  # safety TTL

        # ── Step 3: persist messages row with kind='ask_user_prompt' ──────
        # D-085-05 — durable for reload survival (RESEARCH §A.7). Wrapped in
        # try/except: if the insert fails (Postgres hiccup, etc.) we still
        # let the handler proceed so the user can answer — the missing row
        # only affects the GET /pending replay surface, not the live flow.
        try:
            await aexec(
                ctx.supabase.table("messages").insert({
                    "thread_id": ctx.thread_id,
                    "user_id": ctx.current_user["id"],
                    "role": "system",
                    "content": prompt,
                    "tool_calls": [{
                        "kind": "ask_user_prompt",
                        "tool_call_id": tool_call_id,
                        "prompt": prompt,
                        "options": options,
                        "timeout_seconds": timeout_seconds,
                        "run_id": str(run_id),
                    }],
                })
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: messages row insert failed for run %s tcid %s",
                run_id, tool_call_id,
            )

        # ── Step 4: emit ask_user_prompt SSE event ────────────────────────
        try:
            await ctx.emit(
                ctx.redis, run_id, 'ask_user_prompt',
                tool_call_id=tool_call_id,
                prompt=prompt,
                options=options,
                timeout_seconds=timeout_seconds,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: SSE emit failed for run %s tcid %s",
                run_id, tool_call_id,
            )

        # ── Step 5: block on get_message ──────────────────────────────────
        async def _wait():
            while True:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,                      # Pitfall 1 — never 0
                )
                if msg is not None and msg.get("type") == "message":
                    try:
                        return json.loads(msg["data"])
                    except (TypeError, ValueError):
                        logger.warning(
                            "ask_user: unparseable PUBLISH payload on %s", channel
                        )
                        return None

        try:
            payload = await asyncio.wait_for(_wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return ToolResult(
                result=f"ask_user timed out — no response received within {timeout_seconds}s"
            )

        if not payload:
            return ToolResult(
                result="ask_user received unparseable payload — treating as timeout"
            )

        kind = payload.get("kind")
        if kind == "response":
            # BUG-260607-01: a choice-click answer arrives as
            # {response_text: "", choice_index: N} — resolving the chosen
            # option text here is the authoritative defense (the frontend
            # also sends the resolved text now, but the server must never
            # hand the model an empty answer when the user actually chose).
            _resp = (payload.get("response_text") or "").strip()
            if not _resp and isinstance(options, list):
                _ci = payload.get("choice_index")
                try:
                    _ci = int(_ci)
                    if 0 <= _ci < len(options):
                        _resp = str(options[_ci])
                except (TypeError, ValueError):
                    pass
            return ToolResult(result=_resp)
        elif kind == "cancel":
            return ToolResult(result="ask_user cancelled by user stop")
        elif kind == "shutdown":
            return ToolResult(result="ask_user interrupted by server shutdown")
        else:
            return ToolResult(
                result=f"ask_user received unknown payload kind: {kind!r}"
            )
    finally:
        # Cleanup discipline — Pitfall 3 + R2 (Redis SUBSCRIBE client leaks).
        # Each step in its own try/except so a single failure doesn't mask
        # the others. SREM keeps the channels:set honest (only LIVE
        # subscribers should be there); the safety TTL above is the
        # eventual-consistency safety net.
        try:
            await pubsub.unsubscribe(channel)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: unsubscribe failed for %s", channel
            )
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: pubsub.aclose failed for %s", channel
            )
        try:
            await ctx.redis.srem(channels_set_key, channel)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: SREM failed for %s", channels_set_key
            )
