---
phase: 085-new-llm-tools
plan: 03
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - backend/app/services/ask_user_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/api/runs.py
  - backend/app/main.py
  - backend/tests/integration/test_085_ask_user_handler.py
  - backend/tests/integration/test_085_ask_user_endpoint.py
  - backend/tests/integration/test_085_ask_user_cancel.py
  - backend/tests/integration/test_085_lifespan_shutdown.py
  - backend/tests/integration/conftest.py
autonomous: true
requirements:
  - TOOL-03
  - TOOL-04
requirements_addressed:
  - TOOL-03
  - TOOL-04
tags:
  - backend
  - redis-pubsub
  - cross-worker
  - tool-dispatcher
  - phase-085

must_haves:
  truths:
    - "_handle_ask_user blocks the worker on Redis SUBSCRIBE until a PUBLISH arrives or timeout fires"
    - "Order is load-bearing: SUBSCRIBE registered + channel in Redis SET + messages row persisted with kind='ask_user_prompt' BEFORE the ask_user_prompt SSE event fires (closes PUBLISH-before-SUBSCRIBE race per FC#10 + RESEARCH §A.3)"
    - "POST /runs/{rid}/ask_user_response persists a messages row with kind='ask_user_response' FIRST, then PUBLISHes (durable even if SUBSCRIBE is dead per RESEARCH §A.7)"
    - "Cross-worker: PUBLISH from Worker B wakes SUBSCRIBE on Worker A — channels:set lookup is multi-worker-safe"
    - "Stop button: runs.py:cancel_run PUBLISHes cancel sentinel to all active ask_user channels for the run BEFORE task.cancel() — paused handler returns ToolResult('cancelled by user stop') normally"
    - "Uvicorn shutdown: lifespan hook broadcasts shutdown sentinel to ALL ask_user:channels:* SET keys BEFORE the RUN_TASKS cancel loop"
    - "Timeout: handler returns ToolResult('ask_user timed out — no response received within Ns')"
    - "Empty prompt: treated as a tool error (RESEARCH §A.8 discretion resolution)"
    - "redis-cli client list | grep subscribe shows 0 lines after Stop or normal completion (FC#2 — no leaked SUBSCRIBE clients)"
  artifacts:
    - path: "backend/app/services/ask_user_service.py"
      provides: "Redis pub/sub helpers — subscribe_for_response, publish_response, publish_cancel_sentinel, broadcast_shutdown_sentinel_to_all"
      exports: ["subscribe_for_response", "publish_response", "publish_cancel_sentinel", "broadcast_shutdown_sentinel_to_all"]
    - path: "backend/app/services/tool_dispatcher.py"
      provides: "_handle_ask_user handler + ask_user registry entry — implements the SUBSCRIBE-FIRST ordering"
      contains: "\"ask_user\": _handle_ask_user"
    - path: "backend/app/api/runs.py"
      provides: "POST /runs/{rid}/ask_user_response endpoint + cancel-sentinel publish before task.cancel() in cancel_run"
      contains: "ask_user_response"
    - path: "backend/app/main.py"
      provides: "Lifespan shutdown sentinel broadcast before RUN_TASKS cancel loop"
      contains: "broadcast_shutdown_sentinel_to_all"
  key_links:
    - from: "tool_dispatcher.py:_handle_ask_user"
      to: "ask_user_service.py:subscribe_for_response"
      via: "import inside handler"
      pattern: "from app.services.ask_user_service import"
    - from: "ask_user_service.py:subscribe_for_response"
      to: "Redis channel ask_user:{run_id}:{tool_call_id}"
      via: "pubsub.subscribe + get_message"
      pattern: "ask_user:.*:.*"
    - from: "ask_user_service.py"
      to: "Redis SET ask_user:channels:{run_id}"
      via: "SADD on subscribe, SREM on finally"
      pattern: "ask_user:channels:"
    - from: "runs.py:submit_ask_user_response"
      to: "ask_user_service.py:publish_response"
      via: "PUBLISH after messages row persist"
      pattern: "publish_response"
    - from: "runs.py:cancel_run"
      to: "ask_user_service.py:publish_cancel_sentinel"
      via: "BEFORE task.cancel() — PUBLISH-first ordering per RESEARCH §A.5"
      pattern: "publish_cancel_sentinel"
    - from: "main.py:lifespan"
      to: "ask_user_service.py:broadcast_shutdown_sentinel_to_all"
      via: "BEFORE RUN_TASKS.cancel() loop"
      pattern: "broadcast_shutdown_sentinel_to_all"
---

<objective>
Ship the FIRST Redis pub/sub usage in the codebase — `ask_user_service.py` with the SUBSCRIBE-before-everything-user-can-see ordering, the dispatcher handler `_handle_ask_user`, the POST `/runs/{rid}/ask_user_response` endpoint, the cancel-sentinel integration into `runs.py:cancel_run`, and the uvicorn lifespan shutdown broadcast.

Purpose: Deliver TOOL-03 + TOOL-04 — agent pauses on `ask_user`, user submits via panel, agent resumes with response in tool_result; works cross-worker; timeouts cleanly; stop button + uvicorn shutdown clean up paused runs without leaking SUBSCRIBE clients.

Output: 1 NEW service file, `_handle_ask_user` handler + registry entry, POST endpoint, cancel-sentinel publish, lifespan shutdown broadcast, 4 NEW integration test files + conftest.py addition for Redis pubsub fixture.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/085-new-llm-tools/085-CONTEXT.md
@.planning/phases/085-new-llm-tools/085-RESEARCH.md
@.planning/phases/085-new-llm-tools/085-PATTERNS.md
@.planning/phases/085-new-llm-tools/085-VALIDATION.md
@.planning/phases/085-new-llm-tools/085-01-todos-PLAN.md
@.planning/phases/085-new-llm-tools/085-02-task-service-PLAN.md
@backend/app/services/tool_dispatcher.py
@backend/app/api/runs.py
@backend/app/api/threads.py
@backend/app/main.py
@backend/app/dependencies.py
@backend/app/utils/db.py
@REDIS-SETUP.md

<interfaces>
<!-- Contracts the executor needs. -->

From Plan 02 ToolContext extension: ToolContext now has `tool_call_id: str = ""` populated per dispatch in agent_runner's for-loop (`tool_ctx.tool_call_id = tc.get("id", "")` before `dispatch_tool`).

Decision IDs implemented in this plan:
- D-085-01: `_handle_ask_user` blocks on Redis SUBSCRIBE on channel `ask_user:{run_id}:{tool_call_id}`; returns ToolResult containing the user's answer
- D-085-02: POST `/runs/{run_id}/ask_user_response` body `{tool_call_id, response_text, choice_index?}` returns 200 once PUBLISH succeeds
- D-085-03: Default timeout 300s; per-call override via `timeout_seconds` arg; server clamps to `settings.ask_user_max_timeout_seconds` (1800s, set in Plan 02)
- D-085-04: Stop button publishes cancel sentinel BEFORE task.cancel() — handler wakes, returns "ask_user cancelled by user stop"
- D-085-05: Persistence — messages rows with kind='ask_user_prompt' (in tool_calls jsonb) on PUBLISH side; kind='ask_user_response' on POST side
- D-085-06: Parallel ask_user calls supported — channel naming includes tool_call_id
- D-085-07: Uvicorn lifespan shutdown broadcasts to all ask_user:channels:* SET keys
- D-085-28: blocking I/O wraps; `redis.asyncio` is async-native (no run_in_threadpool)

Wire format for `messages.tool_calls` (extends Phase 075.4 system_warning pattern):
```jsonc
// ask_user_prompt row (role='system')
{
  "tool_calls": [{
    "kind": "ask_user_prompt",
    "tool_call_id": "call_abc123",
    "prompt": "Which file should I overwrite?",
    "options": ["a.txt", "b.txt"],  // optional array
    "timeout_seconds": 300,
    "run_id": "uuid"
  }]
}

// ask_user_response row (role='system')
{
  "tool_calls": [{
    "kind": "ask_user_response",
    "tool_call_id": "call_abc123",
    "response_text": "a.txt",
    "choice_index": 0
  }]
}
```

SSE event shapes (rides existing run:{run_id} Stream via _emit):
```jsonc
// ask_user_prompt
{ "type": "ask_user_prompt", "tool_call_id": "...", "prompt": "...", "options": [...], "timeout_seconds": 300 }
// ask_user_response (emitted by POST endpoint, not the handler)
{ "type": "ask_user_response", "tool_call_id": "...", "response_text": "...", "choice_index": 0 }
```

From `backend/app/api/runs.py:cancel_run` (existing) — locate the `task = RUN_TASKS.get(run_id)` block and INSERT the cancel-sentinel publish BEFORE `task.cancel()` (RESEARCH §A.5 PUBLISH-first ordering).

From `backend/app/main.py` lifespan (around lines 215-227) — INSERT the shutdown sentinel broadcast BEFORE the `RUN_TASKS.cancel()` loop.
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → API (POST ask_user_response) | User Y must not be able to PUBLISH a response for a run owned by User X |
| Worker A ↔ Worker B (Redis pub/sub) | PUBLISH on any worker must reach SUBSCRIBE on any other worker — channels:set is the cross-worker rendezvous |
| client → API (POST replay) | POST with stale tool_call_id (already responded or no longer pending) must not corrupt state |
| Worker → Redis (SUBSCRIBE leaks) | Crashed or cancelled handlers must not leak orphan SUBSCRIBE clients |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-085-T12 | Spoofing | POST `/runs/{rid}/ask_user_response` | high | mitigate | Ownership check via supabase RLS chain: `SELECT run_id, thread_id, user_id FROM runs WHERE run_id=$1 AND user_id=$current_user`; 404 (not 403) on cross-user attempt per D-062-12 convention. (Task 3) |
| T-085-T13 | Tampering | POST replay after run finalized | medium | mitigate | Check `runs.status` is `streaming` AND verify there's a pending `ask_user_prompt` row for `(thread_id, tool_call_id)` without a matching `ask_user_response` companion — refuse otherwise. (Task 3) |
| T-085-T14 | DoS | Leaked Redis SUBSCRIBE clients | high | mitigate | All SUBSCRIBE sites wrap in try/finally with `unsubscribe(channel)` + `pubsub.aclose()` with 2s wait_for; SREM on channels:set. (Task 1 — RESEARCH §A.1 + Pitfall 3) |
| T-085-T15 | DoS | redis-py async pubsub spin-loop at 100% CPU | medium | mitigate | Always pass `timeout=1.0` to `get_message`; wrap loop in `asyncio.wait_for(timeout=N)` (Pitfall 1). |
| T-085-T16 | Race condition | PUBLISH lands before SUBSCRIBE registered → message lost | high | mitigate | Strict ordering: SUBSCRIBE → SADD channels-set → persist messages row → emit SSE → block on get_message. User has no signal to respond until SSE fires; subscriber is already registered. (Task 2 — RESEARCH §A.3) |
| T-085-T17 | DoS / Repudiation | Uvicorn shutdown leaves paused runs stuck `streaming` forever | high | mitigate | Lifespan hook broadcasts shutdown sentinel BEFORE RUN_TASKS cancel; paused handlers wake + return normal ToolResult; agent loop finalizes as `error`. (Task 5 — RESEARCH §A.6) |
| T-085-T18 | Information disclosure | Local Redis pub/sub channel names leak run_ids | low | accept | Local Redis is trusted (single machine dev + isolated cloud); no auth on pub/sub. Network-level controls (Redis bind + container isolation) are pre-existing. |
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (Wave 0 + impl): Implement ask_user_service.py + Redis pub/sub conftest fixture</name>
  <files>
    backend/app/services/ask_user_service.py,
    backend/tests/integration/conftest.py,
    backend/tests/integration/test_085_ask_user_handler.py
  </files>
  <read_first>
    backend/app/dependencies.py (lines 26-100 — get_redis singleton; pubsub spawns its own internal connection on first subscribe()),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§A.1 verbatim — subscribe_for_response sketch; §A.5 — publish_cancel_sentinel; §A.6 — broadcast_shutdown_sentinel; §A.7 — reload-survival; Pitfalls 1-3),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on backend/app/services/ask_user_service.py — full skeleton),
    REDIS-SETUP.md (key conventions — adds ask_user:{rid}:{tcid} pub/sub channels + ask_user:channels:{rid} sorted SET)
  </read_first>
  <behavior>
    - Test 1: `subscribe_for_response(redis_client, run_id, "tcid", timeout=10.0)` returns None when no PUBLISH arrives within timeout
    - Test 2: `subscribe_for_response(...)` returns the parsed JSON dict `{"kind": "response", "response_text": "...", "choice_index": ...}` when PUBLISH arrives on the correct channel
    - Test 3: `subscribe_for_response(...)` adds the channel to `ask_user:channels:{run_id}` SET via SADD before any waiting
    - Test 4: `subscribe_for_response(...)` removes the channel from the SET via SREM in the finally block (verify with `SMEMBERS` post-call returning empty)
    - Test 5: `publish_response(redis, rid, tcid, "answer", 0)` publishes JSON with `kind=response`, `response_text="answer"`, `choice_index=0` to channel `ask_user:{rid}:{tcid}` (verify with a separate subscriber)
    - Test 6: `publish_cancel_sentinel(redis, rid)` reads `ask_user:channels:{rid}` SET, PUBLISHes `{"kind": "cancel"}` to each channel; if SET is empty, no-op
    - Test 7: `broadcast_shutdown_sentinel_to_all(redis)` SCANs `ask_user:channels:*`, SMEMBERS each, PUBLISHes `{"kind": "shutdown"}` to every channel
  </behavior>
  <action>
    Create `backend/app/services/ask_user_service.py` per RESEARCH §A.1-A.7 + PATTERNS skeleton:

    ```python
    """Phase 085 D-085-01..07 — ask_user pub/sub helpers (FIRST PUB/SUB USAGE in the repo).

    Channel naming:
      - ask_user:{run_id}:{tool_call_id}            (pub/sub channel — ONE subscriber per tool call)
      - ask_user:channels:{run_id}                  (Redis SET — list of active channels for cancel sweep; TTL 3600s)

    Critical ordering: callers MUST register the SUBSCRIBE + SADD BEFORE emitting any
    user-visible signal (SSE event, messages-row insert). See RESEARCH §A.3 PUBLISH-before-
    SUBSCRIBE race mitigation.
    """
    from __future__ import annotations

    import asyncio
    import json
    import logging
    from uuid import UUID

    import redis.asyncio as aioredis

    logger = logging.getLogger(__name__)


    async def subscribe_for_response(
        redis: aioredis.Redis,
        run_id: UUID,
        tool_call_id: str,
        timeout_seconds: float,
    ) -> "dict | None":
        """Block until a PUBLISH arrives on ask_user:{run_id}:{tool_call_id} or timeout fires.

        Returns the parsed JSON payload {"kind": "response"|"cancel"|"shutdown", ...} or
        None on timeout. Registers the channel in the channels:set BEFORE returning, so the
        caller can safely persist the messages row + emit SSE immediately after this call.

        IMPORTANT — caller-side ordering (RESEARCH §A.3):
          1. await subscribe_for_response(...)  ← THIS blocks waiting; do not yet emit SSE
             BUT — the SUBSCRIBE registration happens at the start of THIS call before we
             enter the wait loop. The structure here is "register, then wait inside the
             same function". To enforce ordering, the handler MUST persist + emit while
             the subscribe is already active — see _handle_ask_user docstring.
        """
        channel = f"ask_user:{run_id}:{tool_call_id}"
        channels_set_key = f"ask_user:channels:{run_id}"
        pubsub = redis.pubsub()
        try:
            await pubsub.subscribe(channel)                # SUBSCRIBE first
            await redis.sadd(channels_set_key, channel)    # then advertise to cancel-sweep + shutdown-sweep
            await redis.expire(channels_set_key, 3600)     # safety TTL

            async def _wait():
                while True:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,                       # Pitfall 1 — never 0
                    )
                    if msg is not None and msg.get("type") == "message":
                        try:
                            return json.loads(msg["data"])
                        except (TypeError, ValueError):
                            logger.warning("ask_user: unparseable PUBLISH payload on %s", channel)
                            return None

            try:
                return await asyncio.wait_for(_wait(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                return None
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                logger.exception("ask_user: unsubscribe failed for %s", channel)
            try:
                await asyncio.wait_for(pubsub.aclose(), timeout=2.0)  # Pitfall 3
            except Exception:
                logger.exception("ask_user: pubsub.aclose failed for %s", channel)
            try:
                await redis.srem(channels_set_key, channel)
            except Exception:
                logger.exception("ask_user: SREM failed for %s", channels_set_key)


    async def publish_response(
        redis: aioredis.Redis,
        run_id: UUID,
        tool_call_id: str,
        response_text: str,
        choice_index: "int | None",
    ) -> int:
        """PUBLISH user's response to the paused handler. Returns Redis subscriber count
        (0 means SUBSCRIBE is dead — POST endpoint still returns 200 since the messages
        row was persisted FIRST per RESEARCH §A.7)."""
        channel = f"ask_user:{run_id}:{tool_call_id}"
        return await redis.publish(channel, json.dumps({
            "kind": "response",
            "response_text": response_text,
            "choice_index": choice_index,
        }))


    async def publish_cancel_sentinel(redis: aioredis.Redis, run_id: UUID) -> None:
        """Broadcast cancel sentinel to ALL active ask_user channels for this run.

        Must be called BEFORE task.cancel() per RESEARCH §A.5 (PUBLISH-first ordering —
        handler wakes, returns normal ToolResult, agent loop iterates once more to write
        the response row, THEN CancelledError propagates).
        """
        channels_set_key = f"ask_user:channels:{run_id}"
        try:
            channels = await redis.smembers(channels_set_key)
        except Exception:
            logger.exception("ask_user: SMEMBERS failed for %s", channels_set_key)
            return
        for ch in channels:
            try:
                await redis.publish(ch, json.dumps({"kind": "cancel"}))
            except Exception:
                logger.exception("ask_user: cancel publish failed for %s", ch)


    async def broadcast_shutdown_sentinel_to_all(redis: aioredis.Redis) -> None:
        """Called from main.py lifespan BEFORE RUN_TASKS cancel loop (RESEARCH §A.6).

        SCAN ask_user:channels:*, SMEMBERS each, PUBLISH {"kind": "shutdown"} to every channel.
        Best-effort — never block shutdown on Redis failure.
        """
        try:
            async for key in redis.scan_iter("ask_user:channels:*", count=100):
                try:
                    channels = await redis.smembers(key)
                    for ch in channels:
                        try:
                            await redis.publish(ch, json.dumps({"kind": "shutdown"}))
                        except Exception:
                            logger.exception("ask_user shutdown publish failed for %s", ch)
                except Exception:
                    logger.exception("ask_user shutdown SMEMBERS failed for key=%s", key)
        except Exception:
            logger.exception("ask_user shutdown SCAN failed")
    ```

    Create or extend `backend/tests/integration/conftest.py` with a Redis pubsub fixture (per PATTERNS — no existing fixture):
    ```python
    import pytest_asyncio

    @pytest_asyncio.fixture
    async def redis_client():
        from app.dependencies import get_redis
        client = get_redis()
        yield client
        # Cleanup — clear test channels (best-effort)
        try:
            async for key in client.scan_iter("ask_user:channels:*", count=100):
                await client.delete(key)
        except Exception:
            pass
    ```

    Create `backend/tests/integration/test_085_ask_user_handler.py` covering Tests 1-7:
    - Tests use the real local Redis from `redis_client` fixture (`docker-compose.dev.yml` must be up — already in dev infrastructure per CLAUDE.md)
    - For Test 2: spawn the SUBSCRIBE coroutine via `asyncio.create_task`, sleep 100ms to ensure SUBSCRIBE registers, then PUBLISH from the test body
    - For Test 5: subscribe to the test channel in the test body, call `publish_response`, assert the message body
    - Use `uuid4()` for run_id; arbitrary string for tool_call_id

    Integration tests require Redis up. Mark with `@pytest.mark.integration` if a marker convention exists in `pyproject.toml`; otherwise leave unmarked (default pytest discovery).
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_ask_user_handler.py -x ; test -f backend/app/services/ask_user_service.py ; grep -q "async def subscribe_for_response" backend/app/services/ask_user_service.py ; grep -q "async def publish_response" backend/app/services/ask_user_service.py ; grep -q "async def publish_cancel_sentinel" backend/app/services/ask_user_service.py ; grep -q "async def broadcast_shutdown_sentinel_to_all" backend/app/services/ask_user_service.py</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/services/ask_user_service.py` exists
    - `grep -q "ask_user:.{run_id}.:.{tool_call_id}" backend/app/services/ask_user_service.py` — channel name format
    - `grep -q "ask_user:channels:" backend/app/services/ask_user_service.py` matches (channels:set namespace)
    - `grep -q "asyncio.wait_for.*timeout=2.0" backend/app/services/ask_user_service.py` matches (pubsub.aclose timeout per Pitfall 3)
    - `grep -q "timeout=1.0" backend/app/services/ask_user_service.py` matches (Pitfall 1 — never timeout=0)
    - `grep -q "scan_iter" backend/app/services/ask_user_service.py` matches (broadcast_shutdown_sentinel_to_all)
    - `backend/tests/integration/conftest.py` has `redis_client` fixture
    - All 7 behavior tests pass: `cd backend && pytest tests/integration/test_085_ask_user_handler.py -x` exits 0 (requires local Redis up)
  </acceptance_criteria>
  <done>ask_user_service.py implements all 4 helpers with correct lifecycle discipline; conftest.py has the Redis fixture; the 7 integration tests pass against local Redis.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement _handle_ask_user in tool_dispatcher with strict SUBSCRIBE-first ordering</name>
  <files>
    backend/app/services/tool_dispatcher.py,
    backend/tests/integration/test_085_ask_user_handler.py
  </files>
  <read_first>
    backend/app/services/tool_dispatcher.py (lines 865-1006 — workspace handler analogs; lines 1013-1036 — _TOOL_REGISTRY),
    backend/app/services/ask_user_service.py (just created in Task 1 — entry points),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§A.3 — strict SUBSCRIBE-first ordering; §A.4 — timeout-race acceptable behavior; §A.7 — empty-prompt discretion),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on tool_dispatcher.py — _handle_ask_user shape; Critical divergence — uses ctx.tool_call_id field from Plan 02),
    backend/app/utils/db.py (aexec helper for supabase calls)
  </read_first>
  <behavior>
    - Test 1: `_handle_ask_user` with empty `prompt` returns `ToolResult` containing `"non-empty prompt"`
    - Test 2: `_handle_ask_user` with valid prompt registers the SUBSCRIBE first (via `ask_user:channels:{rid}` SADD visible), THEN persists the messages row, THEN emits `ask_user_prompt` SSE — order verifiable by capturing the call order on mocked redis + supabase
    - Test 3: PUBLISH `{"kind": "response", "response_text": "hello", "choice_index": null}` while handler is awaiting causes handler to return `ToolResult(result="hello")`
    - Test 4: PUBLISH `{"kind": "cancel"}` causes handler to return `ToolResult(result="ask_user cancelled by user stop")`
    - Test 5: PUBLISH `{"kind": "shutdown"}` causes handler to return `ToolResult(result="ask_user interrupted by server shutdown")`
    - Test 6: No PUBLISH within timeout causes handler to return `ToolResult` containing `"timed out"` and the timeout value
    - Test 7: `_TOOL_REGISTRY["ask_user"]` is `_handle_ask_user`
    - Test 8 (cross-worker proxy with single client + 2 SUBSCRIBE coroutines on the same Redis client): same channel naming + behavior holds — proves the channel structure isolates calls per `(run_id, tool_call_id)` pair
  </behavior>
  <action>
    Add `_handle_ask_user` to `backend/app/services/tool_dispatcher.py` per RESEARCH §A.3 strict ordering + PATTERNS analog:

    ```python
    async def _handle_ask_user(args: dict, ctx: ToolContext) -> ToolResult:
        """Phase 085 D-085-01..07 — ask_user pause/resume via Redis pub/sub.

        ORDER IS LOAD-BEARING (RESEARCH §A.3):
          1. SUBSCRIBE (inside subscribe_for_response — registers + SADDs channel)
          2. Persist messages row with kind='ask_user_prompt' (durable for reload)
          3. Emit ask_user_prompt SSE event (frontend now knows there's a question)
          4. Block on get_message (handled inside subscribe_for_response)

        Steps 2-3 must complete BEFORE the user has any way to respond — see RESEARCH
        §A.3 (PUBLISH-before-SUBSCRIBE race window mitigation).

        To enforce ordering with subscribe_for_response's "register + wait in one call"
        shape, we split the wait: open the pubsub + SUBSCRIBE + SADD ourselves here,
        then persist + emit, then await the message-receive loop directly.
        """
        prompt = (args.get("prompt") or "").strip()
        if not prompt:
            return ToolResult(result="ask_user requires a non-empty prompt")

        from app.config import settings  # noqa: PLC0415
        timeout_arg = args.get("timeout_seconds")
        if timeout_arg is None:
            timeout_seconds = 300
        else:
            try:
                timeout_seconds = max(1, min(int(timeout_arg), settings.ask_user_max_timeout_seconds))
            except (TypeError, ValueError):
                return ToolResult(result="ask_user timeout_seconds must be a positive integer")

        options = args.get("options")
        tool_call_id = ctx.tool_call_id or ""
        if not tool_call_id:
            return ToolResult(result="ask_user requires a tool_call_id (internal: ToolContext.tool_call_id was empty)")

        run_id = ctx.run_id

        import asyncio  # noqa: PLC0415
        import json     # noqa: PLC0415
        from uuid import UUID  # noqa: PLC0415

        channel = f"ask_user:{run_id}:{tool_call_id}"
        channels_set_key = f"ask_user:channels:{run_id}"

        pubsub = ctx.redis.pubsub()

        try:
            # 1. SUBSCRIBE first
            await pubsub.subscribe(channel)
            await ctx.redis.sadd(channels_set_key, channel)
            await ctx.redis.expire(channels_set_key, 3600)

            # 2. Persist messages row with kind='ask_user_prompt' (D-085-05 / FC#10)
            from app.utils.db import aexec  # noqa: PLC0415
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
            except Exception:
                logger.exception("ask_user: messages row insert failed; continuing (frontend GET /pending will not see this prompt)")

            # 3. Emit SSE event — user now sees the prompt
            try:
                await ctx.emit(
                    ctx.redis, ctx.run_id, 'ask_user_prompt',
                    tool_call_id=tool_call_id,
                    prompt=prompt,
                    options=options,
                    timeout_seconds=timeout_seconds,
                )
            except Exception:
                logger.exception("ask_user: SSE emit failed")

            # 4. Block on get_message
            async def _wait():
                while True:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,
                    )
                    if msg is not None and msg.get("type") == "message":
                        try:
                            return json.loads(msg["data"])
                        except (TypeError, ValueError):
                            return None

            try:
                payload = await asyncio.wait_for(_wait(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                return ToolResult(
                    result=f"ask_user timed out — no response received within {timeout_seconds}s"
                )

            if not payload:
                return ToolResult(result=f"ask_user received unparseable payload — treating as timeout")

            kind = payload.get("kind")
            if kind == "response":
                return ToolResult(result=payload.get("response_text") or "")
            elif kind == "cancel":
                return ToolResult(result="ask_user cancelled by user stop")
            elif kind == "shutdown":
                return ToolResult(result="ask_user interrupted by server shutdown")
            else:
                return ToolResult(result=f"ask_user received unknown payload kind: {kind!r}")
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                logger.exception("ask_user: unsubscribe failed for %s", channel)
            try:
                await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
            except Exception:
                logger.exception("ask_user: pubsub.aclose failed for %s", channel)
            try:
                await ctx.redis.srem(channels_set_key, channel)
            except Exception:
                logger.exception("ask_user: SREM failed for %s", channels_set_key)
    ```

    Register in `_TOOL_REGISTRY` (append after `"task": _handle_task` from Plan 02):
    ```python
        "ask_user": _handle_ask_user,
    ```

    Update `backend/tests/integration/test_085_ask_user_handler.py` to cover Tests 1-8 above. For each test:
    - Construct a `ToolContext` with real `redis_client` fixture + mocked supabase (aexec is mocked or supabase is a real client to a test DB), with `tool_call_id="test-tcid-001"`, `run_id=uuid4()`, `current_user={"id": "test-user"}`, `thread_id="test-thread"`
    - For Tests 3-5: spawn the handler via `asyncio.create_task`, sleep 200ms (lets SUBSCRIBE register + emits fire), then PUBLISH the appropriate kind payload manually via `redis_client.publish(channel, json.dumps({...}))`
    - For Test 6: pass a short timeout (e.g. 1s) and assert timeout text
    - For Test 2: mock supabase to capture insert calls, mock emit to capture call order; assert that `redis_client.sadd(channels_set_key, channel)` is called BEFORE the supabase insert + emit (use call_order tracking on AsyncMock)
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_ask_user_handler.py -x ; grep -q "async def _handle_ask_user" backend/app/services/tool_dispatcher.py ; grep -q "\"ask_user\": _handle_ask_user" backend/app/services/tool_dispatcher.py ; grep -q "kind.: .ask_user_prompt" backend/app/services/tool_dispatcher.py ; grep -q "ask_user cancelled by user stop" backend/app/services/tool_dispatcher.py ; grep -q "interrupted by server shutdown" backend/app/services/tool_dispatcher.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def _handle_ask_user" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "\"ask_user\": _handle_ask_user" backend/app/services/tool_dispatcher.py` matches (registry entry)
    - `grep -q "non-empty prompt" backend/app/services/tool_dispatcher.py` matches (Test 1)
    - `grep -q "ask_user cancelled by user stop" backend/app/services/tool_dispatcher.py` matches (Test 4 / D-085-04)
    - `grep -q "interrupted by server shutdown" backend/app/services/tool_dispatcher.py` matches (Test 5 / D-085-07)
    - `grep -q "timed out — no response" backend/app/services/tool_dispatcher.py` matches (Test 6 / D-085-03)
    - `grep -q "ask_user_prompt" backend/app/services/tool_dispatcher.py` matches (kind discriminator in messages row insert)
    - `grep -q "pubsub.subscribe" backend/app/services/tool_dispatcher.py` matches
    - All 8 behavior tests pass: `cd backend && pytest tests/integration/test_085_ask_user_handler.py -x` exits 0
    - Registry has all 3 phase 085 tools: `grep -c "write_todos\|task.: _handle_task\|ask_user.: _handle_ask_user" backend/app/services/tool_dispatcher.py` returns ≥ 3 in the _TOOL_REGISTRY block (24-tool total at phase end)
  </acceptance_criteria>
  <done>_handle_ask_user implements the load-bearing SUBSCRIBE-first ordering, handles all 4 kinds (response/cancel/shutdown/timeout), persists messages row before emit, and registers in _TOOL_REGISTRY.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: POST /runs/{rid}/ask_user_response endpoint + cancel-sentinel publish in runs.py:cancel_run</name>
  <files>
    backend/app/api/runs.py,
    backend/tests/integration/test_085_ask_user_endpoint.py,
    backend/tests/integration/test_085_ask_user_cancel.py
  </files>
  <read_first>
    backend/app/api/runs.py (lines 1-80 — router setup; lines 385-456 — stream_run ownership SELECT pattern; lines 485-625 — cancel_run integration site),
    backend/app/services/ask_user_service.py (publish_response + publish_cancel_sentinel — created in Task 1),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§D.2 — POST endpoint full sketch; §A.5 — cancel sentinel BEFORE task.cancel() ordering),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on backend/app/api/runs.py)
  </read_first>
  <behavior>
    - Test 1: POST `/runs/{rid}/ask_user_response` with body `{tool_call_id, response_text, choice_index}` returns 200 on happy path
    - Test 2: POST with `run_id` belonging to a different user returns 404 (NOT 403 — D-062-12 leak-avoidance)
    - Test 3: POST persists a `messages` row with `role='system'`, `tool_calls[0].kind='ask_user_response'`, `tool_call_id`, `response_text`, `choice_index`
    - Test 4: POST PUBLISHes to channel `ask_user:{rid}:{tcid}` with `{"kind": "response", "response_text": ..., "choice_index": ...}`
    - Test 5: POST persists messages row BEFORE PUBLISH (durable-even-if-no-subscriber per RESEARCH §A.7) — verify by patching publish to raise; the row insert must still succeed; endpoint still returns 200 if insert succeeded (publish failure is logged but not fatal)
    - Test 6: cancel_run integration — when a run has active ask_user channels in `ask_user:channels:{rid}`, calling DELETE `/runs/{rid}` publishes `{"kind": "cancel"}` to each channel BEFORE `task.cancel()` runs
    - Test 7: cancel_run when no ask_user channels active is a no-op for the sentinel path (no spurious PUBLISH)
  </behavior>
  <action>
    Edit `backend/app/api/runs.py`:

    1. Add the POST endpoint. Mirror the `stream_run` ownership-check pattern (lines 385-456). Per RESEARCH §D.2:

    ```python
    from pydantic import BaseModel
    # (existing imports — verify aexec, get_current_user, get_supabase, get_redis imported)

    class AskUserResponseBody(BaseModel):
        tool_call_id: str
        response_text: str
        choice_index: int | None = None


    @router.post("/{run_id}/ask_user_response", status_code=200)
    async def submit_ask_user_response(
        run_id: UUID,
        body: AskUserResponseBody,
        current_user: dict = Depends(get_current_user),
        supabase: "Client" = Depends(get_supabase),
        redis: aioredis.Redis = Depends(get_redis),
    ):
        """Phase 085 D-085-02 — user submits answer to a paused ask_user prompt.

        Order: persist messages row FIRST (durable even if SUBSCRIBE is dead per
        RESEARCH §A.7), then PUBLISH. Returns 200 once the persist succeeds —
        PUBLISH failure (no subscriber) is logged, not raised.
        """
        # 1. Ownership check — 404 (not 403) per D-062-12
        from app.utils.db import aexec  # noqa: PLC0415
        row_resp = await aexec(
            supabase.table("runs")
            .select("run_id, thread_id, status")
            .eq("run_id", str(run_id))
            .eq("user_id", current_user["id"])
            .maybe_single()
        )
        row = row_resp.data if row_resp is not None else None
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

        # 2. Persist messages row with kind='ask_user_response' (D-085-05) BEFORE PUBLISH
        try:
            await aexec(
                supabase.table("messages").insert({
                    "thread_id": row["thread_id"],
                    "user_id": current_user["id"],
                    "role": "system",
                    "content": body.response_text,
                    "tool_calls": [{
                        "kind": "ask_user_response",
                        "tool_call_id": body.tool_call_id,
                        "response_text": body.response_text,
                        "choice_index": body.choice_index,
                    }],
                })
            )
        except Exception:
            logger.exception("ask_user_response: messages insert failed for run %s", run_id)
            raise HTTPException(status_code=500, detail="Failed to persist response")

        # 3. Optionally emit ask_user_response SSE on the run's stream (for live UI sync)
        try:
            from app.api.threads import _emit  # noqa: PLC0415 — avoid circular import at module load
            await _emit(redis, run_id, 'ask_user_response',
                        tool_call_id=body.tool_call_id,
                        response_text=body.response_text,
                        choice_index=body.choice_index)
        except Exception:
            logger.exception("ask_user_response: SSE emit failed for run %s", run_id)

        # 4. PUBLISH — wakes the paused SUBSCRIBE if it's alive
        try:
            from app.services.ask_user_service import publish_response  # noqa: PLC0415
            await publish_response(redis, run_id, body.tool_call_id, body.response_text, body.choice_index)
        except Exception:
            logger.exception("ask_user_response: publish failed for run %s tcid %s", run_id, body.tool_call_id)
            # Do NOT raise — the persist succeeded (durable), the agent run can finalize normally

        return {"status": "ok"}
    ```

    2. Modify `cancel_run` to publish cancel sentinel BEFORE `task.cancel()`. Locate the happy-path block (around line 520-529 where `task = RUN_TASKS.get(run_id)` and `task.cancel()` happen). Insert just before `task.cancel()`:

    ```python
    if task is not None and not task.done():
        # Phase 085 D-085-04 — PUBLISH cancel sentinel BEFORE task.cancel() so any
        # paused _handle_ask_user returns a normal ToolResult before CancelledError
        # propagates (RESEARCH §A.5 PUBLISH-first ordering).
        try:
            from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
            await publish_cancel_sentinel(redis, run_id)
        except Exception:
            logger.exception("ask_user: cancel sentinel broadcast failed for run %s", run_id)
        task.cancel()
        # ... existing return ...
    ```

    Find the actual function signature / dependency injection for `redis` in `cancel_run` — if it's not already injected, add `redis: aioredis.Redis = Depends(get_redis)` to the function parameters (mirror the pattern from `stream_run` at lines 385-456).

    Write `backend/tests/integration/test_085_ask_user_endpoint.py` covering Tests 1-5:
    - Use FastAPI TestClient or httpx AsyncClient with dependency overrides for `get_current_user` + `get_supabase` + `get_redis`
    - For Test 2: dependency-override `get_current_user` to return a different user_id; the supabase mock returns no row for the run; assert 404
    - For Test 5: patch `publish_response` to raise; the supabase insert mock still succeeds; assert response is 200 (durability path)

    Write `backend/tests/integration/test_085_ask_user_cancel.py` covering Tests 6-7:
    - Pre-populate `ask_user:channels:{rid}` SET with 2 channels (via real Redis or mocked)
    - Subscribe to one of those channels in the test body to capture the PUBLISH
    - Trigger DELETE /runs/{rid} via TestClient
    - Assert the captured message has `kind=cancel` AND was received BEFORE the (mocked) task.cancel() side-effect
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_ask_user_endpoint.py tests/integration/test_085_ask_user_cancel.py -x ; grep -q "ask_user_response" backend/app/api/runs.py ; grep -q "publish_cancel_sentinel" backend/app/api/runs.py ; grep -q "AskUserResponseBody" backend/app/api/runs.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "class AskUserResponseBody" backend/app/api/runs.py` matches
    - `grep -q "async def submit_ask_user_response" backend/app/api/runs.py` matches
    - `grep -q "ask_user_response" backend/app/api/runs.py` matches (endpoint path)
    - `grep -q "kind.: .ask_user_response" backend/app/api/runs.py` matches (kind discriminator in insert)
    - `grep -q "publish_cancel_sentinel" backend/app/api/runs.py` matches (cancel-path integration)
    - `grep -q "from app.services.ask_user_service import publish_cancel_sentinel" backend/app/api/runs.py` matches
    - Persist-BEFORE-PUBLISH order present: in `submit_ask_user_response`, the messages insert appears textually before the publish call (verify via line-number ordering — `grep -n "messages.*insert\|publish_response"`)
    - In `cancel_run`, the `publish_cancel_sentinel` call appears textually before `task.cancel()` (verify via line-number ordering)
    - All 7 behavior tests pass: `cd backend && pytest tests/integration/test_085_ask_user_endpoint.py tests/integration/test_085_ask_user_cancel.py -x` exits 0
  </acceptance_criteria>
  <done>POST endpoint persists FIRST, PUBLISHes second, returns 200 on durability success; cancel_run publishes cancel sentinel BEFORE task.cancel().</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Uvicorn lifespan shutdown broadcast — shutdown sentinel BEFORE RUN_TASKS cancel loop</name>
  <files>
    backend/app/main.py,
    backend/tests/integration/test_085_lifespan_shutdown.py
  </files>
  <read_first>
    backend/app/main.py (lines 185-268 — full lifespan function; lines 215-227 — RUN_TASKS cancel loop insertion site),
    backend/app/services/ask_user_service.py (broadcast_shutdown_sentinel_to_all from Task 1),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§A.6 — shutdown broadcast ordering and race notes)
  </read_first>
  <behavior>
    - Test 1: At lifespan shutdown, `broadcast_shutdown_sentinel_to_all(redis)` is called BEFORE the `for task in RUN_TASKS.values(): task.cancel()` loop
    - Test 2: If `broadcast_shutdown_sentinel_to_all` raises, lifespan still proceeds to cancel RUN_TASKS (never block shutdown on Redis failure per RESEARCH §A.6)
    - Test 3: A paused `_handle_ask_user` waiting on a channel listed in `ask_user:channels:{rid}` receives `{"kind": "shutdown"}` and returns `ToolResult(result="ask_user interrupted by server shutdown")` — integration test
  </behavior>
  <action>
    Edit `backend/app/main.py` lifespan shutdown block. Locate the current RUN_TASKS cancel block (around lines 215-227) and INSERT the shutdown sentinel broadcast BEFORE it:

    ```python
    # Phase 085 D-085-07 — broadcast ask_user shutdown sentinel BEFORE cancelling
    # producer tasks (RESEARCH §A.6). Allows paused _handle_ask_user calls to return
    # a normal ToolResult so the run completes as 'error' instead of stuck 'streaming'.
    # Best-effort — never block shutdown on Redis failure.
    try:
        from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all
        from app.dependencies import get_redis
        await asyncio.wait_for(
            broadcast_shutdown_sentinel_to_all(get_redis()),
            timeout=2.0,
        )
    except Exception:
        logger.exception("ask_user shutdown sentinel broadcast failed")

    # Existing block (preserved):
    try:
        from app.api.threads import RUN_TASKS
        for task in list(RUN_TASKS.values()):
            if not task.done():
                task.cancel()
        if RUN_TASKS:
            await asyncio.gather(*RUN_TASKS.values(), return_exceptions=True)
    except ImportError:
        pass
    ```

    Add `import asyncio` to the top of main.py if not already present.

    Write `backend/tests/integration/test_085_lifespan_shutdown.py` covering Tests 1-3:
    - Test 1: patch `broadcast_shutdown_sentinel_to_all` to record call time; patch `RUN_TASKS` cancel loop similarly; trigger lifespan shutdown; assert broadcast_time < cancel_time
    - Test 2: patch broadcast to raise; verify lifespan still proceeds (no uncaught exception bubbles)
    - Test 3 (integration): spawn `_handle_ask_user` coroutine in a task; SADD the channel manually to `ask_user:channels:{rid}`; call `broadcast_shutdown_sentinel_to_all` directly (don't need full lifespan); assert handler returns shutdown text

    Use `lifespan` testing pattern by instantiating the app context manually:
    ```python
    from app.main import app, lifespan

    @pytest.mark.asyncio
    async def test_shutdown_broadcast_before_run_tasks_cancel(monkeypatch):
        # ... patch + trace call order ...
    ```
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_lifespan_shutdown.py -x ; grep -q "broadcast_shutdown_sentinel_to_all" backend/app/main.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "broadcast_shutdown_sentinel_to_all" backend/app/main.py` matches
    - `grep -q "from app.services.ask_user_service import" backend/app/main.py` matches
    - In main.py lifespan, the broadcast call appears textually before the `RUN_TASKS` cancel block (verify via line-number ordering with `grep -n`)
    - The broadcast call is wrapped in `try/except` (must never block shutdown on Redis failure)
    - All 3 behavior tests pass: `cd backend && pytest tests/integration/test_085_lifespan_shutdown.py -x` exits 0
  </acceptance_criteria>
  <done>Lifespan hook broadcasts shutdown sentinel before RUN_TASKS cancel; paused ask_user handlers wake and return shutdown text; lifespan doesn't block on Redis failure.</done>
</task>

</tasks>

<verification>
- VALIDATION.md sampling rate:
  - Per-task: `cd backend && pytest tests/integration/test_085_ask_user_*.py tests/integration/test_085_lifespan_shutdown.py -x` exits 0 (~10-20s)
  - Per-wave: `cd backend && pytest -x -k "085_ask or 085_lifespan"` exits 0
- Manual sanity (operator runs in UAT — Plan 04 owns the matrix): `redis-cli client list | grep subscribe` returns 0 lines after a full ask_user → response → completion cycle (FC#2)
- Manual sanity: `redis-cli client list | grep subscribe` returns 0 lines after Stop button cancels a paused ask_user run (FC#2)
- Manual sanity: after uvicorn restart while an ask_user is paused, the run shows `status='error'` in the runs table (not stuck `streaming`) — FC + RESEARCH §A.6
- T-085-T16 race window verification: integration test asserts SADD-before-SSE-emit order in _handle_ask_user (Task 2 Test 2)
</verification>

<success_criteria>
1. _handle_ask_user blocks the worker on a Redis SUBSCRIBE until either PUBLISH arrives or timeout fires.
2. Order: SUBSCRIBE registered + channels:set SADD + messages row persisted with kind='ask_user_prompt' BEFORE the ask_user_prompt SSE event fires. (Verified by Task 2 Test 2.)
3. POST /runs/{rid}/ask_user_response persists messages row with kind='ask_user_response' FIRST, then PUBLISHes — returns 200 even if PUBLISH has no subscriber (durability path).
4. Cross-worker: WORKER_COUNT=2 dev server scenario — PUBLISH from Worker B reaches SUBSCRIBE on Worker A via the channels:set lookup. (Plan 04 UAT Row 5 closes the proof.)
5. Stop button: cancel_run publishes cancel sentinel BEFORE task.cancel(); paused handler returns normal ToolResult("cancelled by user stop"); agent loop iterates once more to record the result; no leaked SUBSCRIBE clients.
6. Uvicorn lifespan shutdown: broadcasts shutdown sentinel BEFORE RUN_TASKS cancel; paused runs end as `error` status with "interrupted by server shutdown" tool_result.
7. Empty prompt: returns ToolResult("ask_user requires a non-empty prompt") — RESEARCH §A.8 discretion.
8. Timeout: returns ToolResult containing "timed out" and the timeout value.
9. ask_user is registered as the 24th entry in `_TOOL_REGISTRY` (16 existing + 5 workspace + write_todos + task + ask_user = 24).
</success_criteria>

<output>
After completion, create `.planning/phases/085-new-llm-tools/085-03-ask-user-SUMMARY.md` per the template documenting: what landed (ask_user_service + handler + POST endpoint + cancel-sentinel integration + lifespan shutdown), the load-bearing SUBSCRIBE-first ordering and why it closes FC#10/T-085-T16, the persist-FIRST-PUBLISH-second discipline on the POST endpoint (RESEARCH §A.7 durability), and any deviations from the RESEARCH §A sketch (e.g. whether subscribe_for_response was split inside _handle_ask_user for ordering enforcement — yes, per the action above).
</output>
