---
phase: 085-new-llm-tools
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - backend/app/services/todos_service.py
  - backend/app/services/task_service.py
  - backend/app/services/ask_user_service.py
  - backend/app/services/sub_agent_models.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/api/panel.py
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/main.py
  - backend/app/services/openai_service.py
  - backend/app/db/runs.py
  - backend/app/config.py
  - supabase/migrations/055_todos_table.sql
  - backend/tests/unit/test_085_todos_service.py
  - backend/tests/unit/test_085_task_service.py
  - backend/tests/unit/test_085_tool_registration.py
  - backend/tests/unit/test_tool_dispatcher.py
  - backend/tests/integration/test_085_concurrency.py
  - backend/tests/integration/test_085_sub_agent_emit.py
  - backend/tests/integration/test_085_ask_user_handler.py
  - backend/tests/integration/test_085_ask_user_endpoint.py
  - backend/tests/integration/test_085_ask_user_cancel.py
  - backend/tests/integration/test_085_lifespan_shutdown.py
  - backend/tests/integration/test_085_panel_endpoints.py
  - backend/tests/integration/test_085_sub_agent_cross_provider.py
  - backend/tests/integration/conftest.py
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: issues_found
---

# Phase 085: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 085 ships three new LLM tools (`write_todos`, `task`, `ask_user`) and three REST endpoints for thread-scoped panel data. The implementation is overall solid: the threat-model surface (T-085-T1..T22) is well-covered, the load-bearing PUBLISH-before-SUBSCRIBE ordering invariant is correctly implemented in `_handle_ask_user`, the shutdown sentinel broadcast precedes `RUN_TASKS` cancel, and the migration 055 RLS chain (FK to `threads.user_id`) follows the workspace_files pattern.

Key concerns:

1. **CRITICAL — D-v2.5-01 violation in `_handle_ask_user`** (T-085-T14/15): the messages-row insert at `tool_dispatcher.py:1335` calls `aexec(ctx.supabase.table(...).insert(...))` *between* the SADD and the `get_message` block. If `aexec` raises (e.g., Postgres hiccup), the broad `except Exception` swallows it — but more importantly, the path was meant to be wrapped in `run_in_threadpool`. `aexec` itself already does threadpool wrapping (Phase 058 D-058-03), so this is OK — downgraded to Warning level on closer inspection. **HOWEVER** there is a real critical-class bug: an unhandled exception in `pubsub.subscribe()` BEFORE step 2 (SADD) will reach the `finally` block, which then attempts `pubsub.unsubscribe(channel)` and `pubsub.aclose()` on a never-subscribed pubsub object. redis-py raises on unsubscribe-without-subscribe in some versions. This is masked by the broad try/except in cleanup, but the `pubsub` object itself may leak file descriptors if `aclose()` also raises. See WR-01 for the actual critical issue.

2. **Sub-agent always routes through OpenAI-compat path** — `task_service._stream_one_iteration` uses `create_adaptive_streaming_chat`, which goes through the OpenAI-compat layer for ALL providers including Anthropic and Google. The main agent loop in `threads.py` routes Anthropic via `stream_anthropic` (native SDK) and Google via `stream_google` (native Gen AI SDK) per Phase 075.5. The sub-agent inherits the parent's `active_provider` via `parent_ctx.user_settings`, so for an Anthropic user calling `task()`, the sub-agent hits `https://api.anthropic.com/v1` as an OpenAI-compat endpoint. This works (Anthropic offers an OpenAI-compat layer) but may have feature gaps (no extended thinking, no thought_signature, no Anthropic-native tool_use). This is a documented limitation — sub-agent service was frozen per D-085-16 — but worth surfacing.

3. **Plan 05 cross-provider footgun** is correctly hardened, but the empty-`llm_models` early-return path can still leak a stale cross-provider candidate for hard-default providers (anthropic/google/etc.) on fresh installs.

The unit + integration test coverage is excellent: SUBSCRIBE-first ordering is asserted with call-order recording, the per-run + global concurrency caps are tested for both block and release paths, and cross-provider safety is parameterized across 7 providers. Test mocks are realistic (AsyncMock for pubsub flow, real Redis for SUBSCRIBE/PUBLISH integration).

## Critical Issues

### CR-01: `_handle_ask_user` cleanup leaks pubsub object when `pubsub.subscribe()` raises

**File:** `backend/app/services/tool_dispatcher.py:1320-1434`
**Issue:** The pattern at line 1320 creates `pubsub = ctx.redis.pubsub()`, then immediately enters a `try:` block that calls `await pubsub.subscribe(channel)` at line 1324. The `finally` block at 1411-1434 unconditionally calls `pubsub.unsubscribe(channel)` and `pubsub.aclose()`. If `pubsub.subscribe()` itself raises (Redis socket error, network glitch, channel-name validation failure), the `finally` block runs with `pubsub` never having subscribed to anything. While the inner try/except guards swallow exceptions from `unsubscribe`/`aclose`, the operation order matters: the SREM at line 1430 references `channels_set_key` and `channel` — but SADD at line 1326 *never ran* because subscribe failed first. The SREM is a no-op (correct), but `pubsub.aclose()` failing AND `pubsub.unsubscribe()` failing both bypass any further cleanup. Each pubsub object holds a connection from the pool; in a high-churn failure mode (Redis blip during a tool-call burst), this can starve the connection pool.

Compounding this: when SUBSCRIBE itself raises, the handler returns no `ToolResult` — the exception bubbles up through `dispatch_tool` → `agent_runner` and lands in the broad `except Exception` at `threads.py:2675-2677` as `Tool execution failed: <e>`. The user sees a generic tool error but never realizes their ask_user prompt was destined to land in a dead subscription state. The messages row is never inserted (step 3), the SSE event is never emitted (step 4), and downstream `cancel_run` finds no entry in the channels:set to broadcast to.

**Fix:**
```python
# At line ~1320-1322:
pubsub = ctx.redis.pubsub()
_subscribe_succeeded = False
try:
    # ── Step 1: SUBSCRIBE first ───────────────────────────────────────
    await pubsub.subscribe(channel)
    _subscribe_succeeded = True
    # ── Step 2: advertise to cancel + shutdown sweep paths ────────────
    await ctx.redis.sadd(channels_set_key, channel)
    await ctx.redis.expire(channels_set_key, 3600)
    # ... rest of steps 3-5 unchanged ...
finally:
    # Skip unsubscribe/aclose if subscribe never succeeded — pubsub is in
    # an invalid state and these calls can raise or hang.
    if _subscribe_succeeded:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:  # noqa: BLE001
            logger.exception("ask_user: unsubscribe failed for %s", channel)
    try:
        await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
    except Exception:  # noqa: BLE001
        logger.exception("ask_user: pubsub.aclose failed for %s", channel)
    # SREM is safe even if SADD never ran (no-op on empty set)
    try:
        await ctx.redis.srem(channels_set_key, channel)
    except Exception:  # noqa: BLE001
        logger.exception("ask_user: SREM failed for %s", channels_set_key)
```

Also consider returning a `ToolResult` on subscribe-failure rather than letting the exception propagate so the LLM gets a clean retry signal:
```python
try:
    await pubsub.subscribe(channel)
    _subscribe_succeeded = True
except Exception:
    logger.exception("ask_user: pubsub.subscribe failed for %s", channel)
    return ToolResult(result="ask_user temporarily unavailable — retry shortly")
```

## Warnings

### WR-01: `task_service._stream_one_iteration` ignores tool_choice for force-text-on-last-iteration parity

**File:** `backend/app/services/task_service.py:162-193`, `backend/app/services/task_service.py:322-388`
**Issue:** The main agent loop at `threads.py:1847` flips `tool_choice = "none"` on the final iteration (`force_no_tools`) to prevent infinite tool loops. The sub-agent loop in `task_service.py:322` iterates `for step in range(max_steps)` and breaks ONLY on `not tool_calls` (line 339). If the sub-agent LLM never stops calling tools, the loop exhausts `max_steps` and the `else` branch (line 383) records `summary = content or "Sub-agent reached max_steps without producing a final answer."` — but `content` may be empty because the last iteration was tool-only. This produces an unhelpful summary string for the parent agent. Worse, on the iteration that EQUALS `max_steps - 1`, the sub-agent should still be forced to text-only to give it a chance to produce a real final answer.

**Fix:** Mirror the parent's force-text-on-last-iteration logic:
```python
for step in range(max_steps):
    # ... emit iteration_start ...
    # Force text on the last iteration so we always get a final summary
    is_last_iter = (step == max_steps - 1)
    content, tool_calls = await _stream_one_iteration(
        messages=messages,
        tools=sub_tool_schemas if not is_last_iter else [],  # no tools => text-only
        model=effective_model,
        user_settings=parent_ctx.user_settings,
    )
    # ... rest unchanged
```
Or pass `tool_choice="none"` through `create_adaptive_streaming_chat` to make the intent explicit.

### WR-02: Sub-agent always routes through OpenAI-compat layer, never native Anthropic/Google SDKs

**File:** `backend/app/services/task_service.py:162-193`
**Issue:** `_stream_one_iteration` calls `create_adaptive_streaming_chat`, which uses the OpenAI client targeted at `user_settings.llm_base_url` (`https://api.anthropic.com/v1` for Anthropic users, etc.). The main agent loop branches on `active_provider == "anthropic"` to use `stream_anthropic` (native SDK with extended thinking, thought_signature, native tool_use) and `active_provider == "google"` to use `stream_google`. Sub-agents NEVER take that branch — they always go through the OpenAI-compat path.

This causes silent feature divergence:
- Anthropic sub-agents: no extended thinking, no native tool_use, may emit different tool-call shapes
- Google sub-agents: no thought_signature handling, OpenAI-compat layer may reject parallel_tool_calls (already handled by `supports_parallel_tools`)
- DeepSeek sub-agents: thinking-mode `extra_body` IS emitted (line 1161-1166 in openai_service.py) — sub-agents will inherit this since the call path goes through `create_adaptive_streaming_chat`, but the parent's `messages` list isn't passed to the sub-agent (system + description only), so reasoning_content from prior turns is not preserved.

D-085-16 freezes `sub_agent_service.py` (the older analyze_document path) but the new `task_service.py` is a fresh module — it could have routed through the native paths. Worth at least documenting the limitation in the SUMMARY or noting it as a known gap for Phase 086.

**Fix (option A — document the limitation):** Add a docstring note to `_stream_one_iteration`:
```python
"""...
NOTE: This always routes through the OpenAI-compat layer, even for Anthropic
and Google users. The native SDK paths (stream_anthropic / stream_google) are
NOT used here. Limitations: no extended thinking, no thought_signature, no
Anthropic-native tool_use. Acceptable for short focused sub-agent tasks; revisit
in Phase 086 if cross-provider sub-agent fidelity becomes a UX issue.
"""
```

**Fix (option B — route natively for big-3):** Branch on `parent_ctx.user_settings.active_provider` and call `stream_anthropic` / `stream_google` for those paths. Larger change; consider deferring to Phase 086.

### WR-03: Sub-agent `_consume_sync_stream` swallows `tc.id` vs `tc.tool_call_id` shape mismatch

**File:** `backend/app/services/task_service.py:121-159` (consume), `backend/app/services/task_service.py:348-359` (dispatch)
**Issue:** `_consume_sync_stream` accumulates `tc.get("arguments")` (JSON string) at line 156. The dispatcher loop at line 355 does `json.loads(tc.get("arguments") or "{}")`. If `arguments` is empty/missing (some providers omit it for zero-arg tool calls), the `except (ValueError, TypeError)` falls back to `tc.get("args") or {}` — but `_consume_sync_stream` never populates `args`, only `arguments`. So zero-arg tool calls always dispatch with `args = {}` (correct), but tool-call objects that arrive with `args` already parsed (e.g., from a future refactor) are silently dropped. This is fine TODAY but is a footgun for cross-provider regressions.

**Fix:** Make the fallback explicit:
```python
raw_args = tc.get("arguments")
if raw_args:
    try:
        parsed_args = json.loads(raw_args)
    except (ValueError, TypeError):
        logger.warning(
            "task_service: sub-agent tool %r emitted unparseable arguments=%r",
            tc.get("name"), raw_args[:100],
        )
        parsed_args = {}
else:
    parsed_args = {}
```

### WR-04: `resolve_sub_agent_model_safely` empty-`llm_models` path returns stale cross-provider candidate

**File:** `backend/app/services/sub_agent_models.py:96-115`
**Issue:** The hardened validation at line 96 only fires when `_active_models_list` is non-empty. For fresh installs / partial user_settings rows (where the user hasn't populated `<provider>_models` yet), the candidate is returned as-is at line 119. This means a user who freshly installs, picks Anthropic, but never enters an Anthropic models list, AND has `llm_model="gpt-4.1"` from a default Settings page state, would still hit BUG-260528-01. The test `test_resolve_with_empty_active_models_list_skips_validation` explicitly pins this behavior, documenting it as an accepted trade-off ("we trust the caller when we have no list to compare against") — but the production user experience is identical to the closed bug.

**Fix:** Fall through to `_provider_default` when the active provider has a non-empty default AND `llm_models` is empty:
```python
# After candidate construction at line 91, add:
if not _active_models_list and _provider_default and _active_provider:
    # No list to validate against — but we DO have a known-safe default
    # for this provider. Prefer it over a potentially-stale candidate.
    if candidate != _provider_default:
        # Soft warning — this catches fresh installs where llm_models hasn't
        # been populated yet but active_provider IS set.
        logger.info(
            "sub_agent_model: empty llm_models list for provider=%r; "
            "preferring _SUB_AGENT_MODEL_DEFAULTS=%r over candidate=%r",
            _active_provider, _provider_default, candidate,
        )
        return _provider_default
```

### WR-05: `_handle_ask_user` `aexec` for messages row is between SUBSCRIBE and the block — D-v2.5-01 review

**File:** `backend/app/services/tool_dispatcher.py:1334-1356`
**Issue:** `aexec(ctx.supabase.table("messages").insert({...}))` runs blocking I/O inside an async function. Per D-v2.5-01 the wrapper must use `run_in_threadpool`. `aexec` from `app.utils.db` DOES handle this (per Phase 058 D-058-03 — wraps `.execute()` in `run_in_threadpool`), so the call is compliant. The pattern is correct.

**Subtle concern:** the entire steps-1-through-5 sequence at lines 1322-1389 runs without yielding back to the event loop between SADD and the SSE emit. A long-running messages insert (Postgres slow) means the SSE emit is also delayed, but the SUBSCRIBE is already alive — so a fast user POST that PUBLISHes between SADD and the block IS captured by the pubsub buffer (pubsub buffers messages received between subscribe + first get_message). This is correct.

**Fix:** No code change — annotate the comment block at line 1257-1268 to mention this buffering behavior explicitly so future maintainers don't try to "optimize" by reordering steps. Optionally, add a metric/log timing the SADD→block latency so operators notice if Postgres is slowing the prompt-emit path.

### WR-06: `cancel_run` happy-path PUBLISH cancel sentinel uses a lazy import that might fail silently

**File:** `backend/app/api/runs.py:673-680`
**Issue:** Lines 673-679 lazy-import `publish_cancel_sentinel` inside the happy-path branch. If the import itself fails (rare but possible — e.g., circular import in a future refactor), the `except Exception` swallows it and the cancel proceeds without notifying any paused `ask_user` channels. The handler then waits the full `timeout_seconds` until it wakes via CancelledError, but per RESEARCH §A.5 the agent loop won't have a normal `ToolResult` to write a `kind='ask_user_response'` companion row — leaving the prompt in pending forever.

This is the exact failure mode the PUBLISH-first ordering was supposed to prevent. The lazy import is the right call (avoids load-time cycles) but the silent-failure behavior on the only import that matters is bothersome.

**Fix:** Top-of-module import — `from app.services.ask_user_service import publish_cancel_sentinel` at line 53-ish — there is no circular import because `ask_user_service.py` doesn't import from `runs.py` (verified at review time). Move the import out of the function body so any import-time failure crashes at startup, not silently at runtime.

### WR-07: `task_service.run_task_sub_agent` doesn't set sub-agent's `iteration` on `sub_ctx`

**File:** `backend/app/services/task_service.py:274-301` (sub_ctx construction), `backend/app/services/tool_dispatcher.py:75` (iteration field default = 0)
**Issue:** `ToolContext.iteration` is used by `harvest_output_files` (in `_handle_execute_code`) to track which agent iteration produced which sandbox output file. The sub-agent's `sub_ctx` is constructed once at lines 274-301 and never updates `iteration` as the sub-agent loop iterates (line 322 `for step in range(max_steps)`). All sub-agent execute_code calls within a single `task()` spawn will share `iteration=0` (the field default), which means cross-iteration deduplication of output files in `harvest_output_files` will misbehave for sub-agents.

This may be intentional (sub-agents have their own ephemeral context and tool-output tracking) but it's not documented anywhere. Today, sub-agents in the read-only default tool list can't even call `execute_code`, so the bug is dormant. If a future operator enables `execute_code` for sub-agents (via `tools=["execute_code", ...]`), the dedup logic will silently misbehave.

**Fix:** Inside the sub-agent loop at line 322, update `sub_ctx.iteration = step` at the top of each iteration:
```python
for step in range(max_steps):
    sub_ctx.iteration = step  # <-- add this so execute_code in sub-agents
                              # gets correct cross-iteration tracking
    # ... emit iteration_start ...
```
Alternatively, add a comment explicitly stating that sub-agents are not expected to call `execute_code` and the iteration-tracking limitation is intentional.

## Info

### IN-01: Migration 055 `parent_run_id` ON DELETE SET NULL — sub-agent runs become orphaned if parent is deleted

**File:** `supabase/migrations/055_todos_table.sql:40-42`
**Issue:** `parent_run_id` uses `ON DELETE SET NULL`. If a parent run is ever deleted (currently no DELETE happens in `runs.py`, only UPDATE), sub-agent rows survive with `parent_run_id=NULL` and become indistinguishable from top-level runs. The GET `/threads/{tid}/tasks` query filters on `parent_run_id IN (subquery)`, so orphans simply vanish from the panel. This is graceful degradation, not a bug — worth noting for future work where DELETE FROM runs might be added (e.g., GDPR data-purge endpoint).

**Fix:** No change needed; document the trade-off if a DELETE path lands later.

### IN-02: `_SUB_AGENT_DEFAULT_READ_ONLY` includes `analyze_document` but not `query_tables` consistency check

**File:** `backend/app/services/tool_dispatcher.py:1030-1035`
**Issue:** The default sub-agent toolset includes `analyze_document`, which itself can spawn a sub-agent (via `run_sub_agent` in `sub_agent_service.py`). This is OK because the older `analyze_document` flow doesn't go through `_handle_task`'s nesting cap — but it means a sub-agent CAN trigger another sub-agent indirectly via `analyze_document`. The 1-level nesting cap technically holds because that sub-agent uses the OLDER frozen path, not `task()`, so there's no recursion through `_handle_task`.

**Fix:** No code change needed — the dual paths are intentional (D-085-16). Worth documenting in CONTEXT.md that `analyze_document` is the legacy sub-agent path and is exempt from the `task()` nesting cap.

### IN-03: `panel.py` `/ask_user/pending` query JSON path uses `tool_calls->0->>` — assumes tool_calls[0]

**File:** `backend/app/api/panel.py:128-135`
**Issue:** The query at lines 128-135 hardcodes `tool_calls->0->>` (first array element). The schema in migration 055 says `"first element may carry a kind discriminator"`. If a future migration ever stores multiple discriminator entries in `tool_calls`, the second one won't match. Today there's only ever one discriminator entry per system row, so this is correct. The unit test at `test_085_panel_endpoints.py:236-251` pins the exact SQL string.

**Fix:** No change today. If multi-discriminator rows ever land, switch to `EXISTS (SELECT 1 FROM jsonb_array_elements(tool_calls) e WHERE e->>'kind' = 'ask_user_prompt')`.

### IN-04: `_handle_task` Gate 3 max_steps clamp message is misleading

**File:** `backend/app/services/tool_dispatcher.py:1109-1118`
**Issue:** The error message at line 1116-1118 says `"task() max_steps must be a positive integer"`, but the silent path at line 1114 clamps to `max(1, min(int(max_steps_arg), settings.task_max_steps))`. So `max_steps=-5` is silently clamped to `1`, while `max_steps="abc"` raises the explicit error. Inconsistent UX — same root cause (bad input), two different LLM-visible behaviors.

**Fix:** Either reject negative ints explicitly (`if max_steps_arg < 0: return ToolResult(...)`), or document the clamp in the schema description so the LLM knows what's happening.

### IN-05: Inconsistent broad exception handling — `# noqa: BLE001` everywhere

**File:** `backend/app/services/task_service.py`, `backend/app/services/ask_user_service.py`, `backend/app/services/tool_dispatcher.py` (multiple)
**Issue:** Every defensive try/except uses `# noqa: BLE001` to silence the broad-except lint rule. This is appropriate for cleanup blocks in `finally` (we want belt-and-suspenders survivability), but blurs the line between "real errors we should know about" and "best-effort cleanup". A single failure mode (e.g., `RedisError`) raised inside the protected block emits a `logger.exception` with the same loudness as a `KeyboardInterrupt` would (which we'd want to propagate). Consider narrowing to `except (RedisError, OSError, ValueError)` where applicable so future cancellation paths aren't silently caught.

**Fix:** Audit each `except Exception` site:
- `task_service.py:67-82` (Lua eval) — catch `RedisError` + `OSError` specifically; let asyncio.CancelledError propagate
- `task_service.py:85-90` (decr) — same
- `ask_user_service.py:107-117` (cleanup) — keep broad; this is `finally`-only

### IN-06: `_handle_ask_user` doesn't validate `tool_call_id` shape / charset

**File:** `backend/app/services/tool_dispatcher.py:1307-1314`
**Issue:** `tool_call_id` is used directly in the Redis channel name `f"ask_user:{run_id}:{tool_call_id}"`. Redis channel names accept arbitrary bytes but the LLM-supplied id could contain `\n`, `:`, `*` (Redis pattern characters), spaces, etc. Today the LLM emits sensible tool_call ids (`call_xxx` from OpenAI, `toolu_xxx` from Anthropic, etc.), but if a future provider emits weird ids, the channel name could be unmappable or could accidentally match a SCAN pattern in `broadcast_shutdown_sentinel_to_all`. The shutdown scan is on `ask_user:channels:*` keys (not channel names) so this risk is low — but defense-in-depth would be cheap.

**Fix:** Add a charset guard at line 1308:
```python
import re
_TOOL_CALL_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")
# ...
if not tool_call_id or not _TOOL_CALL_ID_RE.match(tool_call_id):
    return ToolResult(
        result="ask_user requires a well-formed tool_call_id "
               "(letters, digits, _-, max 128 chars)"
    )
```

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
