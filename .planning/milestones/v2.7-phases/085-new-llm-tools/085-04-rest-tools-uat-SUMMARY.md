---
phase: 085-new-llm-tools
plan: 04
subsystem: backend
tags: [rest-api, tool-schemas, panel, supabase, asyncpg, jsonb-scan, sse-replay, uat, sc10, phase-085]

# Dependency graph
requires:
  - phase: 083-foundation-tool-dispatch-extraction-bug-fixes
    provides: ToolContext / ToolResult / _TOOL_REGISTRY pattern
  - phase: 084-workspace-filesystem-backend
    provides: backend/app/api/workspace.py scaffolding template (router prefix, _verify_thread_ownership 404 convention, aexec usage)
  - phase: 073-asyncpg-pool-integration
    provides: get_pg_pool singleton + asyncpg query path used by /ask_user/pending and /tasks
  - plan: 085-01-todos
    provides: migration 055 — todos table, runs.parent_run_id column, messages.tool_calls.kind doc-comment; write_todos handler / SSE event registered
  - plan: 085-02-task-service
    provides: ToolContext extension (parent_run_id + per_run_task_semaphore + available_tools + tool_call_id), task handler / sub_agent_start+done SSE wire format
  - plan: 085-03-ask-user
    provides: ask_user handler + POST /runs/{rid}/ask_user_response endpoint + messages.tool_calls kind='ask_user_prompt' | 'ask_user_response' rows that /ask_user/pending now reads
provides:
  - "backend/app/api/panel.py — NEW router under /threads/{thread_id} with 3 GET endpoints: /todos (supabase-py), /ask_user/pending (asyncpg jsonb @>), /tasks (asyncpg parent_run_id subquery). All gated by _verify_thread_ownership → 404 (NOT 403) per D-062-12."
  - "backend/app/main.py — adds panel to the router import line + app.include_router(panel.router) after admin.router"
  - "backend/app/services/openai_service.py — 3 new tool schema constants (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL) copied verbatim from 085-RESEARCH §E; get_tools() base count = 22 (24 when web_search + sandbox both enabled)"
  - "backend/tests/integration/test_085_panel_endpoints.py — 14 tests: router smoke, /todos happy-path + 404 cross-user + wire-format renaming + ORDER BY chain, /ask_user/pending (returns row, empty when responded, SQL contains @>/NOT EXISTS/ORDER BY ASC, payload extraction, 404 cross-user), /tasks (returns row with parent_run_id mapping, SQL contains ORDER BY DESC + cross-thread+cross-user IN-subquery, 404 cross-user), 3-endpoint smoke gate"
  - "Wire format: GET /todos returns todo_updated SSE payload shape (id, content, status, parent_id, order_index, created_at, updated_at — DB column todo_id renamed to id at the seam)"
  - "Wire format: GET /ask_user/pending returns rows shaped as {message_id, tool_call_id, prompt, options, timeout_seconds, run_id, created_at} extracted from messages.tool_calls[0]"
  - "Wire format: GET /tasks returns sub-agent runs {sub_run_id, parent_run_id, status, model, provider, started_at, completed_at}"
  - ".planning/phases/085-new-llm-tools/085-VALIDATION.md — Per-Task Verification Map populated (17 task rows across all 4 plans), SC#10 4-axis UAT Matrix (18 rows), FC coverage map (10 FCs), nyquist_compliant flipped true, wave_0_complete true"
affects: [phase-086-streamsprovider-demux, phase-087-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "thread-scoped FastAPI router with prefix /threads/{thread_id} + reusable _verify_thread_ownership helper (mirrors workspace.py from Phase 084)"
    - "asyncpg jsonb containment scan with NOT EXISTS subquery for the cross-correlated pending-prompts query (RESEARCH §D.4) — first usage in the codebase; supabase-py cannot natively express @> containment"
    - "asyncpg IN-subquery gate for cross-thread + cross-user isolation on /tasks (parent_run_id IN (SELECT run_id FROM runs WHERE thread_id=\$1 AND user_id=\$2))"
    - "test-side _patch_pg_pool helper: get_pg_pool is invoked directly inside the endpoint (NOT via Depends), so we monkey-patch the panel-module-level symbol via unittest.mock.patch instead of using FastAPI dependency_overrides"
    - "tool-description lead-style 'Use when:' + 'Do not use for:' (D-085-25 mitigation for the 24-tool selection-accuracy concern across Google + DeepSeek/Moonshot)"

key-files:
  created:
    - "backend/app/api/panel.py (3 GET endpoints, _verify_thread_ownership helper)"
    - "backend/tests/integration/test_085_panel_endpoints.py (14 tests)"
  modified:
    - "backend/app/main.py (panel router import + include)"
    - "backend/app/services/openai_service.py (3 tool schema constants + get_tools() extension)"
    - "backend/tests/unit/test_085_tool_registration.py (6 new tests for Phase 085 tool schemas)"
    - ".planning/phases/085-new-llm-tools/085-VALIDATION.md (Per-Task Verification Map + SC#10 UAT Matrix populated; nyquist_compliant flipped true)"

key-decisions:
  - "panel.py's /todos endpoint renames DB column todo_id → wire-format key 'id' at the seam (NOT in the SQL) so the response matches the todo_updated SSE payload shape (RESEARCH §F). This keeps the table schema clean (id = primary key UUID, todo_id = client-supplied stable string) while shipping the LLM-friendly shape on the wire."
  - "/ask_user/pending uses asyncpg pool directly (NOT supabase-py + aexec) because supabase-py cannot express jsonb @> containment or NOT EXISTS subqueries. RLS enforcement is handled in two layers: _verify_thread_ownership at the FastAPI gate (404 on cross-user) + thread_id = \$1 filter in the SQL itself (defense-in-depth)."
  - "/tasks uses asyncpg with an explicit user_id = \$2 filter in the SELECT subquery (NOT just thread_id) — covers the edge case where two users share a thread-id collision (impossible under current RLS but cheap to be defensive about; matches T-085-T19 mitigation)."
  - "Tool schemas use the workspace_* strict-mode convention: every 'properties' key is listed in 'required' (even nullable / optional fields). Provider compatibility: OpenAI strict mode requires this; Google union types ['type': ['integer', 'null']] are sanitized by Phase 084 Plan 05's sanitizer at runtime."
  - "Test isolation for asyncpg-backed endpoints: get_pg_pool is patched via unittest.mock.patch on the panel-module-level symbol because the endpoint calls get_pg_pool() directly (no Depends). This is symmetric with how the existing test_085_ask_user_handler tests pubsub helpers, and avoids the FastAPI dependency-override path (which only works for Depends(...) call sites)."

patterns-established:
  - "Two-layer RLS for asyncpg-backed thread-scoped reads: _verify_thread_ownership (supabase-py + RLS) gates entry; the SQL itself explicit-filters by thread_id (and user_id for /tasks). Reusable for any future asyncpg endpoint that needs RLS-equivalent isolation."
  - "Tool schema lead-style 'Use when:' + 'Do not use for:': pattern for any future tool added to a >20-tool toolbox — gives weaker models (DeepSeek, Moonshot, Google small) explicit decision boundaries to pick the right tool."
  - "Test-mock pattern for direct get_pg_pool() call sites: unittest.mock.patch('app.api.panel.get_pg_pool', side_effect=async_function_returning_mock_pool). FastAPI dependency_overrides do NOT cover non-Depends call sites."

requirements-completed:
  - TOOL-01
  - TOOL-02
  - TOOL-03
  - TOOL-04

# Metrics
duration: ~25min (excluding operator UAT)
completed: 2026-05-28 (code complete; operator UAT pending)
---

# Phase 085 Plan 04: REST endpoints + tool schemas + SC#10 UAT Summary

**Closes the Phase 085 backend loop: 3 GET REST endpoints make the panel-ready data available to Phase 086/087, 3 new tool JSON schemas register the new tools on every provider, and the SC#10 4-axis UAT matrix is authored in VALIDATION.md (executed in Task 5 by the operator).**

## Performance

- **Duration:** ~25 min (code tasks 1-4)
- **Started:** 2026-05-28T16:30Z
- **Completed (code):** 2026-05-28T16:55Z (tasks 1-4 shipped; Task 5 UAT pending operator action — checkpoint snapshot)
- **Tasks executed:** 4 of 5 (Task 5 is the BLOCKING human-verify UAT gate)
- **Files modified:** 5 (1 new: panel.py; 1 new test: test_085_panel_endpoints.py; 3 modified: openai_service.py, main.py, test_085_tool_registration.py; 1 doc: VALIDATION.md)
- **Tests passing:** 112/112 across the full Phase 085 surface (no regressions)
  - test_085_tool_registration.py: 15/15 (9 Plan 01-02 + 6 Plan 04 schema-presence)
  - test_085_todos_service.py: 7/7
  - test_085_task_service.py: 19/19
  - test_tool_dispatcher.py: 15/15
  - test_085_panel_endpoints.py: 14/14 (5 Task 2 + 9 Task 3)
  - test_085_ask_user_handler.py: 17/17
  - test_085_ask_user_endpoint.py: 5/5
  - test_085_ask_user_cancel.py: 2/2
  - test_085_lifespan_shutdown.py: 3/3
  - test_085_concurrency.py: 8/8
  - test_085_sub_agent_emit.py: 7/7

## Accomplishments

### Task 1: 3 new tool JSON schemas + get_tools() extension

- `WRITE_TODOS_TOOL`, `TASK_TOOL`, `ASK_USER_TOOL` constants added to `openai_service.py` — copied verbatim from `085-RESEARCH.md §E`, including the D-085-25 "Use when:" + "Do not use for:" lead-style descriptions that mitigate the 24-tool selection-accuracy concern across Google + DeepSeek/Moonshot.
- `TASK_TOOL` description bakes in `"Sub-agents cannot call task(), ask_user(), or write_todos()"` so the LLM sees the 1-level-nesting + sub-agent-toolset-exclusion contract directly in the tool surface (no system-prompt assist needed).
- `get_tools()` extended: base toolbox = 22 tools (8 KB + 3 skills + 3 memory/sql + 5 workspace + 3 Phase 085); conditional web_search + sandbox bring the toolbox to 24 at runtime.
- 7 new test cases pinning: schema presence, lead-with-Use-when, sub-agent-exclusion phrase, get_tools() membership, exact 22-tool base count, strict required-fields convention (every property in `properties` is in `required` — matches the workspace_* convention for OpenAI strict-mode + Google compatibility).

### Task 2: panel.py scaffolding + GET /threads/{tid}/todos

- New `backend/app/api/panel.py` — FastAPI router at prefix `/threads/{thread_id}`. Mirrors the `workspace.py` (Phase 084) scaffolding verbatim:
  * `_verify_thread_ownership(thread_id, current_user, supabase)` helper — supabase-py SELECT + 404 (NOT 403) on cross-user attempts per D-062-12 (no existence leak).
  * GET `/todos` via supabase-py + `aexec` (Phase 058 threadpool wrap); orders by `order_index ASC, created_at ASC`; renames DB column `todo_id` → wire-format key `id` at the seam so the response matches the `todo_updated` SSE payload shape (RESEARCH §F).
- `main.py` updated: adds `panel` to the router import line + `app.include_router(panel.router)` after `admin.router`.
- 5 integration tests: router-mounted smoke, 200 happy path with list shape, 404 on cross-user, wire-format key renaming (todo_id → id), .order() chain inspection (order_index then created_at).

### Task 3: GET /ask_user/pending + GET /tasks (asyncpg)

- GET `/threads/{tid}/ask_user/pending`: asyncpg `jsonb @>` containment scan on `messages.tool_calls` + `NOT EXISTS` subquery to exclude prompts whose `ask_user_response` companion already exists; matches the `tool_call_id` between prompt and response payloads; ORDER BY `created_at ASC` (oldest unanswered first). Returns rows shaped as `{message_id, tool_call_id, prompt, options, timeout_seconds, run_id, created_at}` extracted from `tool_calls[0]`.
- GET `/threads/{tid}/tasks`: asyncpg subquery — `runs WHERE parent_run_id IN (SELECT run_id FROM runs WHERE thread_id = $1 AND user_id = $2)`. The IN-subquery is the cross-thread + cross-user gate (T-085-T19, FC#9) — sub-agents only show up for parents the caller owns in this thread. ORDER BY `started_at DESC` (newest first).
- Both endpoints gated by `_verify_thread_ownership` (same 404 contract as `/todos`).
- 9 integration tests covering: returns pending row + payload extraction; empty when response present (asyncpg returns []); SQL contains `@>` containment + `NOT EXISTS`; SQL contains `parent_run_id IN` + `thread_id = $1` + `user_id = $2`; ORDER BY ASC for /pending and DESC for /tasks; 404 on cross-user on both.
- Test-side helper `_patch_pg_pool(mock_pool)` monkey-patches `app.api.panel.get_pg_pool` at the module level (the endpoint calls `get_pg_pool()` directly, NOT via `Depends`, so FastAPI dependency_overrides don't apply). This pattern is reusable for any future asyncpg endpoint.

### Task 4: VALIDATION.md per-task map populated + nyquist_compliant flag flipped

- Frontmatter: `status: ready-for-uat`, `nyquist_compliant: true`, `wave_0_complete: true`.
- Per-Task Verification Map: 17 task rows across all 4 plans (4 Plan 01 + 4 Plan 02 + 4 Plan 03 + 5 Plan 04). Each row: Task ID, Plan, Wave, Requirement, Threat Ref, Secure Behavior, Test Type, Automated Command (verbatim from PLAN.md), File Exists, Status. All shipped tasks = ✅ green; only Task 5 (operator UAT) is ⬜ pending.
- SC#10 4-Axis UAT Matrix: full 18-row table from RESEARCH §Validation Architecture. Per-row status, operator vs Chrome-MCP-automated label, FC coverage reference. 4-axis coverage check enumerated: cross-provider (rows 1-4 + 8-9-13), multi-tool (rows 8/9/12/16/17), parallel-thread (row 5), long-message (rows 15-16).
- Wire-format demux note (RESEARCH R10): `sub_agent_start`/`sub_agent_done` payload-shape contract (`sub_run_id` → Phase 085 `task`; `filename` → existing `analyze_document`) — Row 17 is the load-bearing test.
- Failure Criteria Coverage Map: 10 FC# rows mapped to UAT rows + named integration tests (no gaps).

## Task Commits

Each task committed atomically with `--no-verify` (parallel worktree mode):

1. **Task 1: 3 new tool schemas + get_tools 24-tool toolbox** — `95c6597` (feat)
2. **Task 2: panel.py + GET /todos + main.py router include** — `3224251` (feat)
3. **Task 3: GET /ask_user/pending + /tasks (asyncpg jsonb + parent_run_id)** — `e548516` (feat)
4. **Task 4: VALIDATION.md per-task map + nyquist_compliant** — `a6ce27a` (docs)

Total commits this plan (pre-UAT): 4. The Task 5 UAT execution and the final SUMMARY update commit are added after operator signoff.

## Decisions Made

- **Rename `todo_id` → `id` at the wire seam, not in the SQL.** The DB schema (migration 055) uses `id` as the primary-key UUID and `todo_id` as the client-supplied stable identifier. The wire format from the SSE event (`todo_updated`) uses `id` for the client-supplied key (because the LLM never sees the UUID). The endpoint reshapes the row on the way out — keeps the schema clean and the wire format LLM-friendly.
- **`/ask_user/pending` uses asyncpg + raw SQL, not supabase-py.** supabase-py cannot express `jsonb @>` containment or `NOT EXISTS` subqueries; we'd have to fetch all rows and filter in Python (O(N) DoS vector). The asyncpg path uses Postgres's native jsonb operators (with the `messages` table's existing GIN index per Phase 075.4 migration). RLS enforcement is two-layer: `_verify_thread_ownership` at the FastAPI gate + `thread_id = $1` explicit filter in the SQL.
- **`/tasks` uses an explicit `user_id = $2` filter (not just `thread_id`).** Cheap defense-in-depth — the thread-ownership gate already checks user_id once, but the explicit user_id filter in the IN-subquery means even an exotic thread-id-collision path (impossible under current RLS but cheap to be defensive about) can't leak sub-agents.
- **Strict-mode `required` array on every new tool.** Every key in `properties` is also in `required`, matching the workspace_* convention. Optional values are signaled by `"type": ["string", "null"]` etc. (the union-type pattern that Phase 084 Plan 05's sanitizer already covers for Google). This gives OpenAI strict mode + Google + Anthropic + OpenRouter the same schema shape.
- **Test-side `_patch_pg_pool` helper for direct call sites.** The endpoint invokes `await get_pg_pool()` directly (not via `Depends(get_pg_pool)`) because the result is used inside the body, not as a parameter. FastAPI's dependency_overrides only patch `Depends` sites; for direct call sites we use `unittest.mock.patch('app.api.panel.get_pg_pool', side_effect=...)`. Reusable for any future asyncpg endpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker resolved] Worktree base was the merge of `02bc38a`, not the prior-plan SHA `3d8ffad`**

- **Found during:** Pre-Task-1 worktree base check.
- **Issue:** HEAD was `02bc38a` (a fresh-v2.7 merge commit on master) which is NOT an ancestor of the expected base `3d8ffad` (Plan 03 closeout). `git merge-base HEAD 3d8ffad` returned `da31998` — a divergence point. The worktree had the post-merge fresh-v2.7 state where `backend/app/api/panel.py`, `backend/app/services/ask_user_service.py`, etc. did NOT exist.
- **Fix:** Followed the executor's `<worktree_branch_check>` protocol → `git reset --hard 3d8ffad3836fa795fd274aaf0c9d7293838dfa78`. After reset, all Phase 085 Plan 01-03 artifacts existed (migration 055, ask_user_service.py, task_service.py, todos_service.py, all test scaffolds, workspace.py, openai_service.py with workspace tools).
- **Files modified:** none (the reset RESTORED the expected state).
- **Verification:** `git log --oneline` shows the Phase 085 commits in order (3d8ffad → 26be9f0 → 8ed42aa → ...).

**2. [Rule 1 — Test wiring] Task 2 smoke-test asserted 3 endpoints when only `/todos` had landed yet**

- **Found during:** Task 2 first test run (`test_panel_router_mounted_in_app` failed because `/threads/{thread_id}/ask_user/pending` and `/tasks` were not yet wired).
- **Issue:** The original test bundled all 3 endpoints into one assertion, which made it red until Task 3 landed.
- **Fix:** Split into two tests — `test_panel_router_mounted_in_app` asserts ONLY `/todos` (Task 2 surface) + the router prefix; `test_panel_router_has_all_three_get_endpoints` asserts all 3 paths (Task 3 gate, lands GREEN when Task 3 ships).
- **Files modified:** `backend/tests/integration/test_085_panel_endpoints.py` (Task 2 commit; Task 3 commit unblocks the 3-endpoint gate).
- **Verification:** Task 2 tests 5/5 GREEN; Task 3 tests 14/14 GREEN including the 3-endpoint gate.

**3. [Rule 1 — Test wiring] FastAPI dependency_overrides DO NOT cover direct `get_pg_pool()` call sites**

- **Found during:** Task 3 test authoring (initial draft used `app.dependency_overrides[get_pg_pool] = lambda: mock_pool`).
- **Issue:** `panel.py` invokes `await get_pg_pool()` directly inside the endpoint body (not as a `Depends(get_pg_pool)` parameter), so FastAPI never sees the override.
- **Fix:** Switched to `unittest.mock.patch('app.api.panel.get_pg_pool', side_effect=async_factory)`. The mock pool's `fetch` is an `AsyncMock(return_value=rows)`. Wrapped in a `_patch_pg_pool` helper for symmetry across tests.
- **Files modified:** `backend/tests/integration/test_085_panel_endpoints.py`.
- **Verification:** All 9 Task 3 tests + 5 Task 2 tests = 14/14 GREEN.

**4. [Rule 3 — Path drift] Initial VALIDATION.md write landed in the main repo path instead of the worktree path**

- **Found during:** Task 4 acceptance-criteria grep on `.planning/phases/085-new-llm-tools/085-VALIDATION.md` returned the old draft frontmatter.
- **Issue:** The Write tool was given the main-repo absolute path (`C:/Vibe Apps/Agentic RAG/.planning/...`) instead of the worktree absolute path (`C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a03adcdb618110e66/.planning/...`).
- **Fix:** Copied the file from the main repo path into the worktree path; re-ran the acceptance-criteria grep against the worktree path; all 6 checks passed.
- **Files modified:** `.planning/phases/085-new-llm-tools/085-VALIDATION.md` (worktree copy now matches main-repo write).
- **Verification:** worktree `grep -c "nyquist_compliant: true"` = 1; `grep -c "wave_0_complete: true"` = 2 (frontmatter + sign-off section); 17 task rows; 11 FC rows.

---

**Total deviations:** 4 auto-fixed (1 worktree base correction + 3 test-wiring fixes that paired with intended changes). No scope creep, no architectural deviations from PLAN.md.

## Issues Encountered

- **Worktree base correction.** The worktree was bootstrapped from the post-merge fresh-v2.7 master state (`02bc38a`) rather than the Plan 03 closeout commit (`3d8ffad`). Reset hard to the correct base before any task ran; all Plan 01-03 artifacts were then in place.
- **Test isolation for asyncpg-backed endpoints.** Documented as Deviation #3 — direct `get_pg_pool()` calls need `unittest.mock.patch` not `dependency_overrides`.

## User Setup Required

**None for the code tasks (1-4).** All commits run against the existing live local DB (migration 055 applied 2026-05-28 in Plan 01 Task 4).

**Task 5 (UAT) requires operator action** — see "Pending UAT Checkpoint" below.

## Pending UAT Checkpoint (Task 5)

This is the `checkpoint:human-verify` gate for the SC#10 4-axis UAT matrix (18 rows). Three rows REQUIRE operator interaction and cannot be agent-driven:

| Row | Tool | Operator action |
|-----|------|-----------------|
| 6 | ask_user + Stop | While the agent is paused on an ask_user prompt, click Stop in the UI. Then run `redis-cli client list \| grep subscribe` in a separate terminal — must return 0 lines after ~5s (no leaked SUBSCRIBE clients). |
| 7 | ask_user + reload | While the agent is paused on an ask_user prompt, refresh the browser (F5). Verify the panel re-renders the prompt via GET /threads/{tid}/ask_user/pending; submit; verify POST /runs/{rid}/ask_user_response returns 200; verify runs.status flips to `error` (run no longer alive after the reload). |
| 18 | OpenRouter best-effort | Switch to OpenRouter free-tier model. Issue prompts triggering each of the 3 new tools (write_todos, task, ask_user). Read the LangSmith trace and confirm Phase 084 Plan 05's sanitizer + normalizer handle the schema correctly (no provider 400s, no stringified args breaking the dispatcher). |

The other 15 rows (1-5, 8-17) can be driven via Chrome DevTools MCP after the operator starts the backend + frontend per VALIDATION.md `## SC#10 4-Axis UAT Matrix` Setup line.

## Next Phase Readiness

- **Phase 086 (StreamsProvider demux)** can consume the GET endpoints for thread-switch reconcile per D-v2.5-03. Wire formats are stable:
  - `/todos` returns `[{id, content, status, parent_id, order_index, created_at, updated_at}, ...]` — matches `todo_updated` SSE payload.
  - `/ask_user/pending` returns `[{message_id, tool_call_id, prompt, options, timeout_seconds, run_id, created_at}, ...]` — joins to live `ask_user_prompt` SSE by `tool_call_id`.
  - `/tasks` returns `[{sub_run_id, parent_run_id, status, model, provider, started_at, completed_at}, ...]` — joins to live `sub_agent_start` SSE by `sub_run_id`.
- **Phase 087 (Panel UI)** can render all 3 panel sections (todos, pending prompts, sub-agent runs) on thread-switch using these endpoints. Drill-down into a sub-agent's transcript uses existing `/runs/{sub_run_id}/stream` and `/runs/{sub_run_id}/snapshot` (no new endpoints needed).

## Threat Coverage

All Plan 04 STRIDE register threats are mitigated:

- **T-085-T19** (Information disclosure — cross-user reads) — Every endpoint calls `_verify_thread_ownership` (404 NOT 403 per D-062-12). `/tasks` also adds `user_id = $2` filter in the SELECT subquery (defense-in-depth). Tested by `test_get_todos_cross_user_thread_returns_404`, `test_get_tasks_cross_user_thread_returns_404`, `test_get_pending_ask_user_cross_user_thread_returns_404`.
- **T-085-T20** (DoS — jsonb @> scan on messages with N rows) — Accepted with monitor per RESEARCH Assumption A2 (sub-100ms for N≈500). Phase 075.4 already added a GIN index on `messages.tool_calls`; if UAT Row 7 reveals p95 > 500ms, plant a SEED for the partial-index optimization.
- **T-085-T21** (Tampering — `kind` enum on writes) — Plan 03's `_handle_ask_user` validates `kind` before insert; Plan 04's GET endpoints only READ and filter by the allowed kinds via `@>` containment. Defense-in-depth at the consumer layer.
- **T-085-T22** (Tool-selection regression on the 24-tool toolbox) — Monitored via D-085-26 / SEED-035 trigger. UAT rows 1-4 + 13 + 18 measure accuracy on Google + DeepSeek/Moonshot via LangSmith trace. If accuracy drops below 90% over a 50-sample window, plant SEED-035.

## Self-Check

Verified before returning:

- `backend/app/api/panel.py` — FOUND (commit `3224251` Task 2 + extended in `e548516` Task 3)
- `backend/app/main.py` — `panel.router` include verified via Grep (commit `3224251`)
- `backend/app/services/openai_service.py` — `WRITE_TODOS_TOOL`, `TASK_TOOL`, `ASK_USER_TOOL` constants + get_tools extension verified via Grep (commit `95c6597`); base tool count probe = 22
- `backend/tests/integration/test_085_panel_endpoints.py` — FOUND (commit `3224251` Task 2 + extended in `e548516` Task 3; 14/14 tests pass)
- `backend/tests/unit/test_085_tool_registration.py` — extended with 6 Plan 04 schema-presence tests (commit `95c6597`; 15/15 tests pass)
- `.planning/phases/085-new-llm-tools/085-VALIDATION.md` — `nyquist_compliant: true` + `wave_0_complete: true` + 17 task rows + 18 UAT rows + 10 FC rows (commit `a6ce27a`)
- Commit `95c6597` — present in worktree HEAD log
- Commit `3224251` — present in worktree HEAD log
- Commit `e548516` — present in worktree HEAD log
- Commit `a6ce27a` — present in worktree HEAD log
- Full Phase 085 test surface 112/112 GREEN: tool_registration (15) + todos_service (7) + task_service (19) + tool_dispatcher (15) + panel_endpoints (14) + ask_user_handler (17) + ask_user_endpoint (5) + ask_user_cancel (2) + lifespan_shutdown (3) + concurrency (8) + sub_agent_emit (7) = 112
- Tool count: get_tools(None) returns 22 base tools; phase 085 trio (write_todos, task, ask_user) all present; web_search + sandbox conditional → 24 at runtime

## Self-Check: PASSED (code tasks 1-4)

**Status:** Plan 04 code complete. Task 5 UAT execution by operator is the remaining gate before Phase 085 verify-work.

---
*Phase: 085-new-llm-tools*
*Plan: 04*
*Code completed: 2026-05-28*
*UAT pending: operator-driven SC#10 4-axis matrix (18 rows; 15 Chrome MCP automated, 3 manual)*
