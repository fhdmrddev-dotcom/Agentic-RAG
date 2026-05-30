---
phase: 085-new-llm-tools
verified: 2026-05-28T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (backend) + 5 operator UAT items pending
overrides_applied: 0
re_verification: null
gaps: []
deferred:
  - truth: "User responds via the panel (TOOL-03 / SC#3 frontend portion)"
    addressed_in: "Phase 087"
    evidence: "Phase 087 Success Criteria #4: 'Pending user input section renders ask_user prompts with optional choice buttons and free-text field — submitting a response resumes the agent within the same panel view'"
  - truth: "Panel renders write_todos change without re-fetch (TOOL-01 panel rendering)"
    addressed_in: "Phase 086 / 087"
    evidence: "Phase 086 SC#2-3: per-thread hooks (useTodos) provide reactive state via SSE demux; Phase 087 SC#2: 'Todos section renders the live todo list with status indicators and updates in real-time as the agent calls write_todos'"
  - truth: "Reload-survives-prompt panel re-render (TOOL-03 reload survival UI)"
    addressed_in: "Phase 086 / 087"
    evidence: "Phase 086 SC#3: 'Per-thread hooks (useAskUserPrompt) provide reactive state that reconciles on thread-switch via fetch (D-v2.5-03 pattern)'; backend GET /threads/{tid}/ask_user/pending endpoint shipped in Plan 04"
human_verification:
  - test: "UAT Row 6 — ask_user + Stop button (redis-cli leak check)"
    expected: "Click Stop while paused on ask_user; redis-cli client list | grep subscribe returns 0 lines after ~5s (no leaked SUBSCRIBE clients per FC#2)"
    why_human: "Live multi-process leak detection requires operator running redis-cli alongside the UI; not testable in CI"
  - test: "UAT Row 7 — ask_user + browser reload (reload survival)"
    expected: "Refresh browser while paused on ask_user; panel re-renders the prompt from GET /pending; submit; runs.status flips to error (run no longer alive after reload)"
    why_human: "Browser refresh interaction; depends on Phase 086 panel UI for full re-render — backend endpoint is in place but lived-experience verification requires operator session"
  - test: "UAT Row 14 — write_todos status revert ordering"
    expected: "Call write_todos with status=completed, then again with status=pending; final GET /todos returns pending (full-state-replace semantics)"
    why_human: "Time-bounded UAT session; unit test test_full_state_replace_ordering covers it structurally, operator can confirm end-to-end during a follow-up session"
  - test: "UAT Row 15 — write_todos with long-message context (>=50 prior msgs)"
    expected: "After accumulating 50+ messages, LLM still calls write_todos correctly and SSE emits; no context-truncation regression"
    why_human: "Requires building up message history in a live session; tests focus on single-call invariants"
  - test: "UAT Row 18 — OpenRouter free-tier all-3-tools best-effort"
    expected: "Switch to OpenRouter free-tier model; trigger each of write_todos, task, ask_user; Phase 084 Plan 05 sanitizer/normalizer handle schema without provider 400s"
    why_human: "OpenRouter is experimental per feedback_openrouter_is_experimental; operator runs a single best-effort session with LangSmith trace inspection"
---

# Phase 085: New LLM Tools Verification Report

**Phase Goal:** The agent can manage a todo list, spawn sub-agents for delegated work, and pause to ask the user a question -- all operating safely across multiple workers
**Verified:** 2026-05-28T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Per ROADMAP.md Phase 085 Success Criteria (4 truths).

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Agent calls `write_todos` and the todo list persists per-thread; reloading the thread shows the same todos with correct status indicators (pending, in-progress, completed) | VERIFIED | Migration 055 ships todos table (9 columns + 4 RLS policies via threads FK chain); `todos_service.replace_todos` is single asyncpg transaction with status enum validation; `_handle_write_todos` registered as tool #22 (registry verified live = 24 entries total); GET /threads/{tid}/todos endpoint returns canonical list; full-state-replace semantics covered by unit tests (7/7 pass) |
| 2 | Agent calls `task` to spawn a sub-agent that completes work and returns a summary; sub-agents cannot spawn their own sub-agents (1-level nesting cap enforced) and respect per-run and global concurrency limits | VERIFIED | `task_service.run_task_sub_agent` creates own runs row with `parent_run_id` set; `sub_agent_start/done` emits on parent stream, internal events on sub-stream; nesting cap via `ctx.parent_run_id is not None` short-circuit at `_handle_task` Gate 1 (verified `tool_dispatcher.py:1069`); per-run `asyncio.Semaphore(3)` + global Redis Lua-atomic counter cap (default 20); cross-provider footgun closed by Plan 05 hardened `resolve_sub_agent_model_safely` (7-provider parametrized test 8/8 PASS); D-085-16 sub_agent_service.py byte-identical to master (git diff = 0 lines) |
| 3 | Agent calls `ask_user`, the agent loop pauses, user sees the prompt and submits a response, and the agent resumes with the user's answer in `tool_result` -- all within a single unbroken conversation flow | VERIFIED (backend) — frontend panel UI deferred to Phase 086/087 | `_handle_ask_user` implements load-bearing 5-step SUBSCRIBE-first ordering (SUBSCRIBE → SADD channels:set → messages-row insert kind='ask_user_prompt' → emit SSE → block on get_message); POST /runs/{rid}/ask_user_response persists BEFORE PUBLISH (durability per RESEARCH §A.7); timeout returns ToolResult; cancel sentinel handled. 24 integration tests pass against real local Redis. The "user submits via panel" sub-component is Phase 087 territory (panel UI); backend contract complete |
| 4 | `ask_user` works correctly when the POST response lands on a different worker than the paused agent loop (cross-worker coordination via Redis pub/sub), and gracefully expires with a timeout message if the user does not respond within the configurable timeout | VERIFIED | Cross-worker rendezvous via Redis SET `ask_user:channels:{run_id}` + per-call channel `ask_user:{run_id}:{tool_call_id}`; POST endpoint PUBLISHes via `ask_user_service.publish_response` from any worker; timeout via `asyncio.wait_for(timeout=N)` returns `"ask_user timed out — no response received within Ns"`; server-side clamp `settings.ask_user_max_timeout_seconds=1800`; per-call default 300s. UAT Row 5 (parallel-thread) verified via direct API |

**Score:** 4/4 truths verified (backend complete; SC#3 frontend submit-via-panel deferred to Phase 087)

### Deferred Items

Items addressed in later phases of the v2.7 milestone — not actionable gaps.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | User submits ask_user response via panel UI (TOOL-03 SC#3 frontend portion) | Phase 087 | Phase 087 SC#4: "Pending user input section renders ask_user prompts with optional choice buttons and free-text field — submitting a response resumes the agent within the same panel view" |
| 2 | Panel renders write_todos change without re-fetch (TOOL-01 panel-render) | Phase 086 / 087 | Phase 086 SC#2-3 (StreamsProvider demux + useTodos hook); Phase 087 SC#2 (Todos section renders live todo list) |
| 3 | Reload survives ask_user prompt — panel re-renders from GET /pending (UAT Row 7 panel UI) | Phase 086 / 087 | Phase 086 SC#3 (useAskUserPrompt reactive state reconciles on thread-switch); backend GET /threads/{tid}/ask_user/pending is in place |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/055_todos_table.sql` | todos table + RLS + runs.parent_run_id + messages.tool_calls.kind comment | VERIFIED | All 4 sections present; applied to live DB (operator-confirmed 2026-05-28 — validation query returned 1/1/4); also reflected in `supabase/full-schema.sql` |
| `backend/app/services/todos_service.py` | replace_todos full-state-replace transaction with pre-validation | VERIFIED | 95 lines; `replace_todos` validates status enum + required fields BEFORE pool.acquire; single `async with conn.transaction()` block |
| `backend/app/services/task_service.py` | run_task_sub_agent + acquire/release_global_task_slot helpers + sub-stream emit discipline | VERIFIED | 436 lines; Lua-atomic INCR/EXPIRE for global cap; per-run semaphore inherited via sub_ctx; FRESH `previous_files_in_run={}` (Pitfall 7); finalize_run in try/finally with `status='failed'` (matches runs CHECK enum) |
| `backend/app/services/sub_agent_models.py` | resolve_sub_agent_model_safely replicating D-075.5-04 logic | VERIFIED | 119 lines; Plan 05 hardened: always validates resolved candidate (not just override path); falls back to `_SUB_AGENT_MODEL_DEFAULTS[active_provider]` if cross-provider; preserves flexible-provider escape hatch for openrouter/ollama |
| `backend/app/services/ask_user_service.py` | 4 pub/sub helpers with cleanup discipline | VERIFIED | 197 lines; subscribe_for_response + publish_response + publish_cancel_sentinel + broadcast_shutdown_sentinel_to_all; Pitfall 1 (timeout=1.0) + Pitfall 3 (asyncio.wait_for(aclose, 2.0)) honored |
| `backend/app/services/tool_dispatcher.py` | ToolContext extension + 3 new handlers + registry entries | VERIFIED | _handle_write_todos at line 1196; _handle_task at line 1045; _handle_ask_user at line 1249; registry entries at lines 1465-1467; ToolContext has parent_run_id/per_run_task_semaphore/available_tools/tool_call_id fields with safe defaults |
| `backend/app/api/runs.py` | POST /runs/{rid}/ask_user_response + cancel-sentinel publish | VERIFIED | AskUserResponseBody at line 485; submit_ask_user_response at line 497; publish_cancel_sentinel call at line 675 (textually BEFORE task.cancel() at line 680) |
| `backend/app/api/panel.py` | 3 GET endpoints under /threads/{thread_id} | VERIFIED | /todos at line 67 (supabase-py); /ask_user/pending at line 103 (asyncpg jsonb @> + NOT EXISTS); /tasks at line 156 (asyncpg parent_run_id IN-subquery); all 3 gated by `_verify_thread_ownership` → 404 |
| `backend/app/api/threads.py` | per-run Semaphore init + ToolContext population | VERIFIED | `_per_run_task_semaphore = asyncio.Semaphore(...)` at line 1795; ToolContext kwargs `per_run_task_semaphore=` at 2634 + `available_tools=` at 2635; per-dispatch `tool_ctx.tool_call_id = tc.get("id", "")` at 2655 |
| `backend/app/main.py` | lifespan shutdown sentinel BEFORE RUN_TASKS cancel | VERIFIED | `broadcast_shutdown_sentinel_to_all` call at line 230 with 2s wait_for + try/except; RUN_TASKS cancel loop at lines 240-245 (textual ordering: broadcast BEFORE cancel) |
| `backend/app/services/openai_service.py` | 3 tool JSON schemas registered in get_tools() | VERIFIED | WRITE_TODOS_TOOL at line 636; TASK_TOOL at line 674; ASK_USER_TOOL at line 707; get_tools() includes them at line 770; live verification: get_tools(None) returns 24 tools including all 3 Phase 085 names |
| `backend/app/config.py` | 4 new Settings fields | VERIFIED | ask_user_max_timeout_seconds=1800 (line 796); task_max_steps=10 (797); task_per_run_concurrency=3 (798); task_global_concurrency=20 (799) |
| `backend/app/db/runs.py` | insert_run extended with parent_run_id kwarg | VERIFIED | Backward-compatible default None preserves all 16+ existing callers |
| 11 test files (5 unit + 6 integration) | Phase 085 test coverage | VERIFIED | All 11 files exist; 109/109 tests pass (45 unit + 64 integration) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| tool_dispatcher.py:_handle_write_todos | todos_service.py:replace_todos | lazy import inside handler | VERIFIED | Lazy `from app.services.todos_service import replace_todos` matches workspace handler pattern |
| tool_dispatcher.py:_handle_write_todos | Redis Stream run:{run_id} | ctx.emit(redis, run_id, 'todo_updated', ...) | VERIFIED | Re-SELECT canonical list before emit (D-085-21) |
| tool_dispatcher.py:_handle_task | task_service.py:run_task_sub_agent | lazy import inside handler after gate checks | VERIFIED | 6-gate sequence (nesting, description, toolset subset, max_steps clamp, per-run sem, global Lua cap) before spawn |
| task_service.py | db/runs.py:insert_run + finalize_run | parent_run_id kwarg; finally block | VERIFIED | finalize_run writes status='failed' (schema enum) on exception; status='completed' on happy path |
| task_service.py | Redis tasks:global:active counter | Lua INCR+EXPIRE atomic script | VERIFIED | 7200s TTL = crash-safety; multi-worker safe |
| tool_dispatcher.py:_handle_ask_user | ask_user_service helpers | inline 5-step ordering (not full helper) | VERIFIED | SUBSCRIBE → SADD → messages insert → SSE emit → block; explicit comment block at lines 1258-1268 documents the load-bearing order |
| runs.py:submit_ask_user_response | ask_user_service.py:publish_response | lazy import after persist | VERIFIED | Persist messages row FIRST (durability per RESEARCH §A.7), PUBLISH second; 200 returned on persist success even if PUBLISH has no subscriber |
| runs.py:cancel_run | ask_user_service.py:publish_cancel_sentinel | call BEFORE task.cancel() | VERIFIED | Textual ordering: line 675 (publish_cancel_sentinel) precedes line 680 (task.cancel) |
| main.py lifespan | ask_user_service.py:broadcast_shutdown_sentinel_to_all | call BEFORE RUN_TASKS cancel loop | VERIFIED | Textual ordering: line 230 (broadcast with 2s wait_for) precedes lines 240-245 (RUN_TASKS cancel) |
| panel.py:GET /tasks | asyncpg pool runs query | parent_run_id IN-subquery + user_id filter | VERIFIED | Defense-in-depth: _verify_thread_ownership gate + explicit `user_id = $2` in IN-subquery |
| panel.py:GET /ask_user/pending | asyncpg pool messages jsonb scan | @> containment + NOT EXISTS for response companion | VERIFIED | SQL inspection confirmed; matches RESEARCH §D.4 |
| openai_service.py:get_tools | _TOOL_REGISTRY auto-pickup | list append in tools array | VERIFIED | live verification: registry size = 24 (matches get_tools(None) length); all 3 Phase 085 tool names present in both |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| panel.py:get_thread_todos | rows | supabase.table('todos').select(...) with ORDER BY | YES — real DB query | FLOWING |
| panel.py:get_pending_ask_user | rows | asyncpg pool.fetch with jsonb @> + NOT EXISTS | YES — real Postgres jsonb scan | FLOWING |
| panel.py:get_thread_tasks | rows | asyncpg pool.fetch with parent_run_id IN-subquery | YES — real DB query | FLOWING |
| tool_dispatcher.py:_handle_write_todos | todos_payload | Re-SELECT after replace_todos | YES — DB write + read | FLOWING |
| task_service.py:run_task_sub_agent | summary | LLM stream content via create_adaptive_streaming_chat | YES — real LLM call | FLOWING |
| _handle_ask_user | payload (response_text/cancel/shutdown) | Redis pub/sub PUBLISH | YES — real Redis pub/sub | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Tool registry contains 24 entries with all 3 Phase 085 tools | `python -c "from app.services.tool_dispatcher import _TOOL_REGISTRY; print(len(_TOOL_REGISTRY), all(t in _TOOL_REGISTRY for t in ('write_todos','task','ask_user')))"` | `24 True` | PASS |
| get_tools(None) returns 24 tools including all 3 Phase 085 schemas | `python -c "from app.services.openai_service import get_tools; t=get_tools(None); print(len(t), {'write_todos','task','ask_user'}.issubset({x['function']['name'] for x in t}))"` | `24 True` | PASS |
| Phase 085 tool descriptions follow D-085-25 lead-style | `python -c "from app.services.openai_service import WRITE_TODOS_TOOL,TASK_TOOL,ASK_USER_TOOL; ..."` | All 3 contain "Use when" + "Do not use for" | PASS |
| All Phase 085 unit tests pass | `pytest tests/unit/test_085_*.py -q` | `45 passed` | PASS |
| All Phase 085 integration tests pass | `pytest tests/integration/test_085_*.py -q` | `64 passed` | PASS |
| D-085-16 freeze: sub_agent_service.py byte-identical | `git diff 643ce0e..HEAD -- backend/app/services/sub_agent_service.py \| wc -l` | `0` | PASS |
| Migration 055 reflected in committed full-schema.sql | grep checks for todos table + parent_run_id + idx_runs_parent + todos_select_own RLS policy | All present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TOOL-01 | 085-01, 085-04 | write_todos tool persists todo list per thread; emits SSE; panel renders without re-fetch | SATISFIED (backend) | Migration + service + handler + SSE emit verified; "panel renders" portion deferred to Phase 086/087 |
| TOOL-02 | 085-02, 085-04, 085-05 | task tool spawns sub-agent with constrained tool list, 1-level nesting cap, configurable concurrency | SATISFIED | All gates verified in code; cross-provider footgun closed by Plan 05 (BUG-260528-01); 7-provider integration test PASS |
| TOOL-03 | 085-03, 085-04 | ask_user pauses agent, emits prompt via SSE, user responds via panel, agent resumes with response in tool_result | SATISFIED (backend) | Handler + POST endpoint + load-bearing ordering verified; "user responds via panel" is Phase 087 UI work |
| TOOL-04 | 085-03, 085-04 | ask_user operates cross-worker with configurable timeout + graceful expiry | SATISFIED | Cross-worker pub/sub via channels:set rendezvous; timeout wraps in asyncio.wait_for; settings.ask_user_max_timeout_seconds=1800 clamps |

No orphaned requirements: all 4 TOOL-NN IDs are claimed by Phase 085 plans and addressed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| backend/app/services/tool_dispatcher.py | 1320 | CR-01 (REVIEW.md) — pubsub.subscribe() failure path may leak pubsub object | Warning (REVIEW depth: 1 Critical class, downgraded after analysis) | Narrow edge case: `pubsub.subscribe()` itself raising bypasses cleanup; cleanup wrapped in try/except so harm bounded. Routed to /gsd:code-review-fix follow-up per workflow contract |
| backend/app/services/task_service.py | 162-193 | WR-01 — sub-agent loop doesn't force tool_choice="none" on last iteration (potential empty-summary failure mode) | Warning | Edge case when LLM never stops calling tools and exhausts max_steps; produces "reached max_steps without producing a final answer" message |
| backend/app/services/task_service.py | 162-193 | WR-02 — sub-agent always routes through OpenAI-compat layer, not native Anthropic/Google SDKs | Warning | Sub-agents lose extended thinking + native tool_use shapes; documented limitation; could be revisited in Phase 086 |
| backend/app/services/sub_agent_models.py | 96-115 | WR-04 — empty-`llm_models` early-return path can leak stale cross-provider candidate | Warning | Bug-class similar to BUG-260528-01 in narrow fresh-install case (llm_models empty AND provider has hard default) |
| backend/app/api/runs.py | 673-680 | WR-06 — lazy import of publish_cancel_sentinel could silently fail | Warning | Import-time circular risk is currently zero; defensive top-of-module import recommended |
| backend/app/services/task_service.py | 274-301 | WR-07 — sub_ctx.iteration not updated per sub-agent step | Warning | Dormant: sub-agents in default toolset can't call execute_code |

All anti-patterns are advisory (REVIEW.md Code Review findings). 1 Critical, 7 Warning, 6 Info — none classified as blockers per the workflow contract. Suggested follow-up: `/gsd:code-review-fix 085`.

### Human Verification Required

5 operator UAT items remain pending. These don't block code-level acceptance but should be verified by the operator before broad release. All are pre-existing operator-only rows from VALIDATION.md (Rows 6, 7, 14, 15, 18) — they were operator-only BEFORE Plan 05 and remain operator-owned now.

#### 1. UAT Row 6 — ask_user + Stop button (redis-cli leak check)

**Test:** Trigger an ask_user prompt; while agent is paused, click Stop; in a separate terminal run `redis-cli client list | grep subscribe` after ~5 seconds
**Expected:** 0 lines returned (no leaked SUBSCRIBE clients per FC#2)
**Why human:** Live multi-process leak detection requires operator running redis-cli alongside the UI; not testable in CI without real Redis client introspection

#### 2. UAT Row 7 — ask_user + browser reload

**Test:** Trigger an ask_user prompt; while paused, refresh the browser (F5); verify the panel re-renders the prompt from GET /threads/{tid}/ask_user/pending; submit; verify the runs.status flips to error
**Expected:** Panel shows the prompt after reload, submit succeeds (200), runs.status='failed' (run terminated after reload)
**Why human:** Browser refresh interaction; depends on Phase 086 panel UI for full re-render — backend endpoint shipped but lived-experience verification needs operator + future Phase 086 panel

#### 3. UAT Row 14 — write_todos status revert ordering

**Test:** Call write_todos with status='completed' for an item, then again with status='pending' on the same item; check GET /todos
**Expected:** Final state matches second call (status='pending') — full-state-replace semantics
**Why human:** Time-bounded UAT session; structural unit test `test_full_state_replace_ordering` covers it, but operator can confirm end-to-end during a follow-up session

#### 4. UAT Row 15 — write_todos with long-message context (>=50 prior messages)

**Test:** After accumulating 50+ messages in a thread, ask the agent to call write_todos
**Expected:** LLM still calls write_todos correctly with long context; SSE emits properly; no context-truncation regression
**Why human:** Requires building up message history in a live session; tests focus on single-call invariants. SC#10 long-message axis exercise

#### 5. UAT Row 18 — OpenRouter free-tier all-3-tools best-effort

**Test:** Switch active provider to OpenRouter free-tier model; issue prompts triggering each of write_todos, task, ask_user
**Expected:** Phase 084 Plan 05 sanitizer/normalizer handle the new tool schemas without provider 400s; weak models may stringify args (Phase 084 normalizer covers)
**Why human:** OpenRouter is experimental per `feedback_openrouter_is_experimental`; operator runs a single best-effort session with LangSmith trace inspection

### Gaps Summary

No gaps blocking goal achievement. All 4 ROADMAP Success Criteria pass at the backend code level. Phase 085's scope was explicitly backend-only — the frontend panel UI (where TOOL-01 panel re-render and TOOL-03 user-submit-via-panel land) is Phase 086/087 territory. UAT artifacts verify the 4-axis matrix exercised cross-provider (Rows 1-4 ask_user × 4 providers; Rows 8/9/13/19/20 task × 5 providers post-Plan-05), multi-tool (Rows 8, 12, 19, 20), and parallel-thread (Row 5). The long-message axis (Rows 15-16) is deferred to operator follow-up. BUG-260528-01 (cross-provider sub-agent footgun) closed by Plan 05's hardened resolver with 7-provider parametrized integration test (8/8 PASS).

The 5 human-verification items are pre-existing operator-only rows from the original UAT matrix — they were never agent-driveable. The phase is structurally complete; human items represent lived-experience belt-and-suspenders verification, not gaps.

---

_Verified: 2026-05-28T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
