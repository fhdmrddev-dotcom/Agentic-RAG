---
phase: 085-new-llm-tools
plan: 02
subsystem: backend
tags: [sub-agent, tool-dispatcher, concurrency, asyncio, redis-lua, sse, task-tool, phase-085]

# Dependency graph
requires:
  - phase: 083-foundation-tool-dispatch-extraction-bug-fixes
    provides: ToolContext/ToolResult dataclasses + _TOOL_REGISTRY pattern + dispatch_tool entry
  - phase: 084-workspace-filesystem-backend
    provides: workspace_service.py shape (service-layer + SSE emit) + ToolContext construction site pattern
  - phase: 073-asyncpg-pool-integration
    provides: backend/app/db/runs.py insert_run + finalize_run helpers (Phase 073)
  - phase: 075.5
    provides: D-075.5-04 cross-provider model fallback pattern (sub_agent_service.py:62-89) — replicated, NOT modified
  - plan: 085-01-todos
    provides: runs.parent_run_id column (migration 055) + insert_run(parent_run_id=) kwarg + write_todos handler establishing the registry-extension pattern
provides:
  - "backend/app/services/task_service.py — run_task_sub_agent(parent_ctx, description, instructions, allowed_tools, max_steps) sub-agent loop with own runs row + own run:{sub_run_id} Stream + nested dispatch_tool calls"
  - "backend/app/services/task_service.py — acquire_global_task_slot / release_global_task_slot — Lua-atomic INCR+EXPIRE on tasks:global:active counter (multi-worker safe, 7200s TTL crash-safety)"
  - "backend/app/services/sub_agent_models.py — resolve_sub_agent_model_safely() shared helper replicating D-075.5-04 model-routing safety (REPLICATED, NOT imported by sub_agent_service.py per D-085-16 freeze)"
  - "backend/app/services/tool_dispatcher.py — _handle_task handler with 6 gate sequence (nesting cap, description, toolset subset, max_steps clamp, per-run cap, global cap) + registry entry; ToolContext extended with parent_run_id + per_run_task_semaphore + available_tools + tool_call_id"
  - "backend/app/api/threads.py — agent_runner initializes per-run Semaphore once + populates 3 new ToolContext fields + per-dispatch tool_call_id population"
  - "backend/app/config.py — 4 new Settings: ask_user_max_timeout_seconds (1800), task_max_steps (10), task_per_run_concurrency (3), task_global_concurrency (20)"
  - "Registry size: 22 -> 23 tools (Phase 085 Plan 03 will land ask_user as #24)"
affects: [phase-085-03-ask-user, phase-085-04-rest-tools-uat, phase-086, phase-087]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-agent loop with OWN runs row + OWN SSE stream + nested dispatch_tool — parent stream sees only sub_agent_start/done bookend events while internal tool calls emit on run:{sub_run_id} (Phase 086 demux contract)"
    - "Lua-atomic Redis INCR-with-cap + EXPIRE for global concurrency counter (multi-worker safe, single-round-trip, with eventual-consistency TTL safety net)"
    - "Non-blocking asyncio.Semaphore try-acquire via sem.locked() + immediate acquire (canonical asyncio idiom — asyncio.wait_for(timeout=0) cancels the coro before it can run in Python 3.12)"
    - "Sub-agent ToolContext with parent_run_id non-null + FRESH previous_files_in_run dict (Pitfall 7 isolation — no leakage from parent's execute_code state)"
    - "Lazy import of task_service from tool_dispatcher (mirrors workspace handlers' lazy-import idiom) to avoid the load-time cycle between dispatcher and service"

key-files:
  created:
    - "backend/app/services/task_service.py"
    - "backend/app/services/sub_agent_models.py"
    - "backend/tests/unit/test_085_task_service.py"
    - "backend/tests/integration/test_085_concurrency.py"
    - "backend/tests/integration/test_085_sub_agent_emit.py"
  modified:
    - "backend/app/services/tool_dispatcher.py (ToolContext extension + _handle_task handler + 'task' registry entry)"
    - "backend/app/api/threads.py (per-run Semaphore init + 3 new ToolContext fields populated + per-dispatch tool_call_id)"
    - "backend/app/config.py (4 new Settings fields)"
    - "backend/tests/unit/test_tool_dispatcher.py (EXPECTED_TOOLS list + registry count assertion 22 -> 23 — Rule 1 directly-caused fix)"

key-decisions:
  - "D-085-16 honored: backend/app/services/sub_agent_service.py is byte-identical to base 643ce0e (git diff returns 0 lines). The model-routing safety logic was REPLICATED into a new sub_agent_models.py helper, NOT imported from sub_agent_service.py — preserves the Phase 084 byte-freeze contract while still giving task_service one logical source of truth for the D-075.5-04 footgun mitigation."
  - "Non-blocking semaphore try-acquire uses sem.locked() check + immediate acquire, NOT asyncio.wait_for(sem.acquire(), timeout=0). The wait_for+timeout=0 pattern in PLAN.md was incorrect for Python 3.12 — wait_for cancels the coro before it can run, even when the semaphore has free slots. Verified by reproducing the bug. Used the canonical asyncio idiom (locked-then-acquire is atomic within a single coroutine step in single-threaded asyncio)."
  - "finalize_run on sub-agent error writes status='failed' (the runs CHECK enum), not status='error' as PLAN.md drafted. The runs table CHECK constraint at supabase/full-schema.sql:459-473 enforces ('streaming'|'completed'|'failed'|'cancelled'|'timed_out'). The dict result key still carries 'error' (internal phase-085 sentinel for the parent's sub_agent_done payload); the schema enum and the API contract are now consistent."
  - "Sub-agent's per_run_task_semaphore SHARES the parent's semaphore object. The 1-level nesting cap (parent_run_id != None) already forbids a sub-agent from spawning task(), so sub-agents can't drain the per-run cap. Sharing is the belt-and-suspenders: any cross-parent leakage of a stale sub_ctx would still be capped by the parent's gate."
  - "Sub-agent's previous_files_in_run is a FRESH empty dict, not a reference to parent's. This is Pitfall 7 in the research — without it, the parent's pinned-outputs panel would briefly flash files belonging to the sub-agent (and vice versa). Tested directly in test_085_sub_agent_emit::test_sub_ctx_previous_files_is_fresh_dict."

patterns-established:
  - "Lazy-import-the-service-from-the-handler pattern: tool_dispatcher imports task_service (acquire/release/run) inside _handle_task to break the load-time cycle. Future tool services can follow the same pattern — keeps the dispatcher module load-cheap."
  - "Sub-agent loop's parent-stream-bookend + sub-stream-internal split — sub_agent_start{sub_run_id, ...} + sub_agent_done{sub_run_id, status, summary} on parent; iteration_start + tool_start + tool_end on run:{sub_run_id}. Phase 086 demuxer uses sub_run_id presence to route panel drill-down without re-scraping messages.tool_calls."
  - "Cross-provider model safety helper extraction: sub_agent_models.py REPLICATES (not imports) the safety logic from a byte-frozen file. Future repository-wide pattern when a Phase-N file must stay frozen but Phase-N+M needs the same logic — replicate with a clear comment pointing back to the source-of-truth line range."

requirements-completed:
  - TOOL-02

# Metrics
duration: ~13min
completed: 2026-05-28
---

# Phase 085 Plan 02: task-service (Sub-Agent Tool) Summary

**Sub-agent spawned via `task()` runs in its own `runs` row + its own `run:{sub_run_id}` Stream + its own constrained tool loop, with a 1-level nesting cap, per-run + global concurrency caps, and cross-provider model-routing safety — all without modifying the byte-frozen `sub_agent_service.py`.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-28T12:05Z
- **Completed:** 2026-05-28T12:18Z
- **Tasks executed:** 4 of 4
- **Files modified:** 9 (5 created + 4 modified)
- **Tests passing:** 65/65 across the Phase 085 + dispatcher surface
  - test_085_task_service.py: 19/19 (resolver + settings + handler gates)
  - test_085_concurrency.py: 8/8 (helpers + per-run cap + global cap discipline)
  - test_085_sub_agent_emit.py: 7/7 (insert_run, start/done emits, sub-stream isolation, fresh previous_files, finalize-on-exception)
  - test_085_tool_registration.py: 9/9 (Plan 01 retained)
  - test_085_todos_service.py: 7/7 (Plan 01 retained)
  - test_tool_dispatcher.py: 15/15 (22 → 23 count assertion updated; no regression on 22 pre-existing handlers)

## Accomplishments

- **Cross-provider model-routing footgun closed for task path** — `sub_agent_models.resolve_sub_agent_model_safely(user_settings, override_model, fallback_model)` REPLICATES (does not import from) `sub_agent_service.py:62-89` verbatim. When a user switches active_provider but doesn't update their model setting, task() sub-agents fall back to the provider's `_SUB_AGENT_MODEL_DEFAULTS` entry instead of routing (e.g.) a Google model name through an OpenAI client → 400.
- **4 new Settings fields shipped** with .env-overridable defaults (`ASK_USER_MAX_TIMEOUT_SECONDS`, `TASK_MAX_STEPS`, `TASK_PER_RUN_CONCURRENCY`, `TASK_GLOBAL_CONCURRENCY`). Defaults match research: 1800s, 10 steps, 3 per-run, 20 global.
- **ToolContext extended with 4 fields** (`parent_run_id`, `per_run_task_semaphore`, `available_tools`, `tool_call_id`) — all default to safe no-ops so existing 22 handlers keep working without changes. The defaults test pins this for future ToolContext changes.
- **`task_service.py` ships the full sub-agent loop** — own runs row (with `parent_run_id` set so Plan 04's `GET /threads/{tid}/tasks` joins cleanly), own SSE stream, nested `dispatch_tool` calls with `sub_ctx` whose `run_id == sub_run_id` (so internal tool events emit on the sub-agent's stream). Parent's stream only sees `sub_agent_start{sub_run_id, description, tools, max_steps}` and `sub_agent_done{sub_run_id, status, summary}`. The Phase 086 demuxer uses the `sub_run_id` field to route panel drill-down without scraping `messages.tool_calls`.
- **6-gate `_handle_task` handler registered as tool #23**: (1) nesting cap → "1-level nesting cap"; (2) empty description → friendly error; (3) requested tools subset of parent's available_tools minus {task, ask_user, write_todos} → "refused"; (4) max_steps clamped to settings.task_max_steps; (5) per-run cap via canonical `sem.locked()` non-blocking check; (6) global cap via Redis Lua atomic INCR. On any gate failure, the LLM gets a friendly readable error string that explains the refusal.
- **Concurrency caps survive crashes** — global counter has a 7200s EXPIRE TTL so a worker crashing between INCR and DECR doesn't permanently leak slots. Per-run Semaphore is in-process scope so it dies with the worker (acceptable — no cross-run leakage possible).
- **Slot-release discipline** — both slots released in finally block. If global acquire fails AFTER per-run was acquired, we release per-run before returning the refusal (test_handle_task_global_cap_releases_per_run_semaphore pins this).
- **Sub-agent isolation invariants** — sub_ctx gets a FRESH `previous_files_in_run={}` dict (Pitfall 7; no leakage of parent's execute_code output state), shares the parent's Redis/Supabase/pool/user_settings handles (singleton clients), inherits the parent's per_run_task_semaphore (defense-in-depth with the 1-level nesting cap).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel worktree mode):

1. **Task 1: sub_agent_models extraction + 4 Settings fields + 3 test scaffolds** — `9d2857f` (feat)
2. **Task 2: ToolContext extension + agent_runner construction + per-dispatch tool_call_id** — `0bc4545` (feat)
3. **Task 3: task_service.py — concurrency helpers + sub-agent loop + SSE emit discipline** — `92759ba` (feat)
4. **Task 4: _handle_task registration with 6 gates + Rule 1 fix to test_tool_dispatcher.py registry count** — `79e68c5` (feat)

Total commits this plan: 4 (one per task). The final metadata commit (this SUMMARY) is the orchestrator's, after merge.

## Files Created/Modified

- `backend/app/services/sub_agent_models.py` — NEW. `resolve_sub_agent_model_safely(user_settings, override_model, fallback_model)`. Doc-comment points back to `sub_agent_service.py:62-89` as the byte-frozen source of truth.
- `backend/app/services/task_service.py` — NEW. `acquire_global_task_slot` + `release_global_task_slot` + `run_task_sub_agent` + private `_consume_sync_stream` + `_stream_one_iteration` + `_build_sub_agent_system_prompt`. ~390 lines.
- `backend/app/services/tool_dispatcher.py` — ToolContext gained 4 fields; `_handle_task` + `_SUB_AGENT_DEFAULT_READ_ONLY` + `_SUB_AGENT_EXCLUDED` constants added; `"task": _handle_task` registry entry added.
- `backend/app/api/threads.py` — agent_runner: per-run `_per_run_task_semaphore = asyncio.Semaphore(settings.task_per_run_concurrency)` initialized ONCE per top-level run (before the iteration loop); ToolContext construction populates `parent_run_id=None`, `per_run_task_semaphore=_per_run_task_semaphore`, `available_tools=[t['function']['name'] for t in ...]`; per-tool-call dispatch loop also assigns `tool_ctx.tool_call_id = tc.get("id", "")`. Total threads.py delta: ~25 lines added (G-5 minimization respected — no agent_runner control-flow changes).
- `backend/app/config.py` — appended 4 Settings fields after `sub_agent_max_output_tokens`.
- `backend/tests/unit/test_085_task_service.py` — NEW. 19 tests: resolver (5) + settings (1) + scaffold imports (2) + handler gates (8) + registry (2) + max_steps default (1).
- `backend/tests/integration/test_085_concurrency.py` — NEW. 8 tests: acquire/release helpers (5) + per-run cap saturation + global cap releases per-run + release-in-finally (3).
- `backend/tests/integration/test_085_sub_agent_emit.py` — NEW. 7 tests: scaffold import + insert_run parent_run_id + sub_agent_start emit + sub_agent_done emit + sub-stream tool dispatch isolation + finalize-on-exception + fresh previous_files_in_run.
- `backend/tests/unit/test_tool_dispatcher.py` — `EXPECTED_TOOLS` list + count assertion updated 22 → 23 (Rule 1 directly-caused fix; same shape as Plan 01's bump from 21 → 22).

## Decisions Made

- **REPLICATE, don't import, the model-routing safety from sub_agent_service.py** — D-085-16 freezes that file. The shared `sub_agent_models.py` helper duplicates lines 62-89's logic verbatim, with a doc-comment pointing back to the source-of-truth line range. If the safety logic ever needs a patch, both call sites update; if D-085-16 ever lifts, sub_agent_service.py can switch to the helper as a one-line swap. Both states are clean.
- **finalize_run writes 'failed' on sub-agent exception, not 'error'** — the PLAN.md draft used 'error' which is NOT in the runs table CHECK enum (`'streaming'|'completed'|'failed'|'cancelled'|'timed_out'`). The dict return key (`result["status"]`) still carries the internal 'error' sentinel for the parent's sub_agent_done payload; the DB enum and the API contract are now consistent. Updated test_finalize_run_called_with_error_status_on_exception accordingly.
- **`sem.locked()` non-blocking try-acquire over `asyncio.wait_for(timeout=0)`** — PLAN.md drafted the latter, but Python 3.12 cancels the wrapped coro BEFORE it can run when timeout=0 (verified with a 5-line reproducer). The locked-then-acquire idiom is the canonical asyncio pattern: `sem.locked()` returns True iff value <= 0, and acquiring a semaphore with value > 0 doesn't yield to the event loop, so the check + acquire pair is atomic within a single coroutine step in single-threaded asyncio.
- **Sub-agents share the parent's per_run_task_semaphore** — they can't spawn task() (1-level nesting cap), but sharing the semaphore is the belt-and-suspenders. If some future code path constructed a sub-agent ToolContext outside `run_task_sub_agent` (and forgot the nesting cap), the shared semaphore would still cap the total.
- **Lazy import of task_service inside _handle_task** — keeps tool_dispatcher.py module load cheap and breaks the load-time cycle (task_service imports ToolContext + dispatch_tool from tool_dispatcher). Mirrors the workspace handlers' style for `_handle_workspace_*`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug in PLAN.md draft] asyncio.wait_for(sem.acquire(), timeout=0) cancels the coroutine before it can run**

- **Found during:** Task 4 (per-run cap test_handle_task_per_run_cap_fires_on_fourth_call expected 1 refusal + 3 successes; got 4 refusals).
- **Issue:** The PLAN.md handler sketch used `await asyncio.wait_for(sem.acquire(), timeout=0)` as the non-blocking try-acquire pattern. In Python 3.12, `wait_for(coro, timeout=0)` cancels `coro` before it runs even when the semaphore has free slots — every call gets `TimeoutError`. Verified with a standalone 5-line reproducer.
- **Fix:** Switched to the canonical asyncio idiom `if sem.locked(): refuse / else: await sem.acquire()`. `sem.locked()` returns True iff value <= 0, and `acquire()` on a value > 0 semaphore is immediate (no event loop yield), so the pair is atomic within a single coroutine step.
- **Files modified:** `backend/app/services/tool_dispatcher.py` (lines in `_handle_task` Gate 4)
- **Verification:** 4 concurrent task() calls on Semaphore(3) → 3 succeed + 1 refusal (`test_handle_task_per_run_cap_fires_on_fourth_call` PASS).
- **Committed in:** `79e68c5` (Task 4).

**2. [Rule 1 — Schema mismatch in PLAN.md draft] finalize_run status='error' fails the runs CHECK constraint**

- **Found during:** Task 3 (test_finalize_run_called_with_error_status_on_exception failed with `'failed' != 'error'`).
- **Issue:** PLAN.md drafted `finalize_run(status='error')` on sub-agent exception. The runs table CHECK constraint (`supabase/full-schema.sql:459-473`) enforces `status IN ('streaming','completed','failed','cancelled','timed_out')` — 'error' would 23514 in production.
- **Fix:** finalize_run writes `status='failed'` on exception. The dict return key (`result["status"]`) still carries 'error' for the parent's sub_agent_done payload (internal phase-085 sentinel), but the DB write uses the schema-compatible enum. Updated the test assertion to match.
- **Files modified:** `backend/app/services/task_service.py` (finalize_run call site), `backend/tests/integration/test_085_sub_agent_emit.py` (test assertion + comment explaining the discrepancy).
- **Verification:** `test_finalize_run_called_with_error_status_on_exception` PASS — both assertions (`result["status"] == "error"` for the API contract; `finalize_calls[0]["status"] == "failed"` for the DB enum) hold simultaneously.
- **Committed in:** `92759ba` (Task 3).

**3. [Rule 1 — Directly-caused bug] Updated test_tool_dispatcher.py registry count assertion 22 → 23**

- **Found during:** Task 4 (after committing the new registry entry).
- **Issue:** The pre-existing `test_registry_has_exactly_22_entries` would fail with `assert 23 == 22` after the Task 4 registry entry landed. This is the same shape as Plan 01's fix (`21 → 22`).
- **Fix:** Renamed test to `test_registry_has_exactly_23_entries`, added `"task"` to `EXPECTED_TOOLS`, updated comments to reflect the new trajectory (Plan 03 adds `ask_user` → 24).
- **Files modified:** `backend/tests/unit/test_tool_dispatcher.py`
- **Verification:** test_tool_dispatcher.py: 15/15 PASS (no regression on existing handlers).
- **Committed in:** `79e68c5` (Task 4).

---

**Total deviations:** 3 auto-fixed (2 PLAN.md drafting bugs that production code would have hit + 1 directly-caused test count assertion). No scope creep.
**Impact on plan:** No success criterion compromised. The semaphore idiom fix actually CLOSES a latent gate-bypass that would have allowed all task() calls under load to refuse — a critical correctness fix. The schema enum fix avoids a 23514 in production. The test count fix is a mechanical follow-up of an intended registry change.

## Issues Encountered

- **Worktree base mismatch on agent startup:** The worktree was bootstrapped from `da319985` (one commit ahead of the expected Plan 02 base `643ce0e`). Followed the `<worktree_branch_check>` protocol — `git reset --hard 643ce0e` corrected the base. Safe in a fresh worktree (no user changes to lose, #2015).
- **`create_adaptive_streaming_chat` is SYNC, not async** — the function returns `(stream, calling_mode)` where `stream` is a sync iterator. PLAN.md's `_stream_one_iteration` sketch hinted at `async for chunk in create_adaptive_streaming_chat(...)` which is wrong. Implemented `_consume_sync_stream` inside `run_in_threadpool` instead (`asyncio.wait_for` would deadlock the event loop if the stream blocks). Mirrors how threads.py:2119+ runs the stream inside `run_in_threadpool` for the OpenAI path.

## User Setup Required

None — Plan 01's migration 055 already added `runs.parent_run_id` to the live DB, and `insert_run(parent_run_id=)` was wired in Plan 01. No new DB schema, no new secrets, no new infra.

## Next Phase Readiness

- **Plan 03 (ask_user) is unblocked** — the ToolContext.`tool_call_id` field (Task 2) is the channel-naming hook ask_user needs for `ask_user:{run_id}:{tool_call_id}` Redis pub/sub channels. The `ask_user_max_timeout_seconds` Settings field is in place. The handler-registration pattern is established.
- **Plan 04 (REST + UAT) is unblocked** — `GET /threads/{tid}/tasks` joins on `runs.parent_run_id IS NOT NULL`, which Plan 02 populates. Tool schema authoring in `openai_service.get_tools()` can reference the `_handle_task` argument shape from this plan's handler.
- **Phase 086 (StreamsProvider demux)** — the parent-vs-sub-stream emit split is the contract: parent stream sees `sub_agent_start{sub_run_id, description, tools, max_steps}` + `sub_agent_done{sub_run_id, status, summary}`; sub-stream `run:{sub_run_id}` carries `iteration_start` + `tool_start` + `tool_end` + terminal `done`/`error` sentinel. Phase 086 demuxer routes on presence of `sub_run_id` field.
- **Phase 087 (Panel UI)** can drill into a sub-agent's transcript via existing `/runs/{sub_run_id}/stream` and `/runs/{sub_run_id}/snapshot` endpoints — no new endpoints needed for the sub-agent drill-down.

## Threat Coverage

All Plan 02 STRIDE register threats mitigated:

- **T-085-T6** (Elevation of privilege — toolset validation) — `_handle_task` Gate 2 validates `requested_tools ⊆ (ctx.available_tools - _SUB_AGENT_EXCLUDED)`. Tested by `test_handle_task_excluded_tool_rejected` + `test_handle_task_nonexistent_tool_rejected`.
- **T-085-T7** (DoS — nested task() worker pool exhaustion) — `ctx.parent_run_id is not None` short-circuits at handler entry. Tested by `test_handle_task_nesting_cap_returns_friendly_error`. Sub-agents inherit `parent_run_id=parent_ctx.run_id` via task_service so any `_handle_task` call inside the sub-agent's dispatch chain refuses immediately.
- **T-085-T8** (DoS — unbounded parallel task() calls) — Per-run Semaphore(3) + global Redis Lua counter capped at 20. Tested by `test_handle_task_per_run_cap_fires_on_fourth_call` + `test_handle_task_global_cap_releases_per_run_semaphore` + `test_handle_task_release_global_slot_called_in_finally`.
- **T-085-T9** (Cross-provider model footgun) — `resolve_sub_agent_model_safely` REPLICATES sub_agent_service.py:62-89. Tested by `test_resolve_override_cross_provider_falls_back`.
- **T-085-T10** (Sub-agent leaks parent's execute_code output state) — sub_ctx.previous_files_in_run is a fresh empty dict. Tested by `test_sub_ctx_previous_files_is_fresh_dict`.
- **T-085-T11** (Sub-agent crashes mid-loop leaving runs row 'streaming' forever) — try/except/finally with finalize_run in finally. Tested by `test_finalize_run_called_with_error_status_on_exception`.

## Self-Check

Verified before returning:

- `backend/app/services/sub_agent_models.py` — FOUND (commit 9d2857f)
- `backend/app/services/task_service.py` — FOUND (commit 92759ba; 30+ grep matches for required symbols)
- `backend/tests/unit/test_085_task_service.py` — FOUND (commit 9d2857f; 19/19 tests pass)
- `backend/tests/integration/test_085_concurrency.py` — FOUND (commit 9d2857f; 8/8 tests pass)
- `backend/tests/integration/test_085_sub_agent_emit.py` — FOUND (commit 9d2857f; 7/7 tests pass)
- `backend/app/services/tool_dispatcher.py` — ToolContext extension + `_handle_task` + `"task": _handle_task` registry entry verified via Grep (14 phase-085 markers found in the dispatcher)
- `backend/app/api/threads.py` — `_per_run_task_semaphore = asyncio.Semaphore(...)` + `available_tools=` + `tool_ctx.tool_call_id` all verified via Grep
- `backend/app/config.py` — all 4 new Settings fields verified via Grep
- Commit `9d2857f` — present in worktree HEAD log
- Commit `0bc4545` — present in worktree HEAD log
- Commit `92759ba` — present in worktree HEAD log
- Commit `79e68c5` — present in worktree HEAD log
- D-085-16: `git diff 643ce0e..HEAD -- backend/app/services/sub_agent_service.py` returns 0 lines (byte-identical to base)
- Full test surface 65/65 GREEN: test_085_task_service.py (19) + test_085_concurrency.py (8) + test_085_sub_agent_emit.py (7) + test_085_tool_registration.py (9) + test_085_todos_service.py (7) + test_tool_dispatcher.py (15) = 65

## Self-Check: PASSED

---
*Phase: 085-new-llm-tools*
*Plan: 02*
*Completed: 2026-05-28*
