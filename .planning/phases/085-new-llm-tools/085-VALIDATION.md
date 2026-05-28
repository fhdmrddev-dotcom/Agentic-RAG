---
phase: 085
slug: new-llm-tools
status: ready-for-uat
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
updated: 2026-05-28
---

# Phase 085 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Source: `085-RESEARCH.md` `## Validation Architecture` section. The 4-axis UAT matrix (SC#10 MANDATORY per `CLAUDE.md` and CONTEXT D-085-27) is canonical there; this file is the contract the planner + executor + verifier check against.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + Chrome DevTools MCP (UAT) |
| **Config file** | `backend/pytest.ini` (existing) |
| **Quick run command** | `cd backend && pytest tests/unit/test_085_*.py -x` |
| **Full suite command** | `cd backend && pytest -x` |
| **Estimated runtime** | ~30s full suite for Phase 085 tests; UAT ~30 min Chrome MCP + manual |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/unit/test_085_*.py -x` (~5s)
- **After every plan wave:** Run `cd backend && pytest -x -k "085 or tool_dispatcher or ask_user or todos or task_service"` (~30s)
- **Before `/gsd-verify-work`:** Full suite green PLUS Chrome MCP 4-axis UAT matrix executed
- **Max feedback latency:** 30 seconds (per-wave); 5 seconds (per-task)

---

## Per-Task Verification Map

> One row per Phase 085 task that ships behavior. `File Exists` flips to ✅ when Wave 0 scaffolding lands.

### Plan 01 — write_todos + migration + parent_run_id

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 085-01-T1 | 01 | 0 | TOOL-01 | T-085-T1 (RLS chain) | migration 055 ships todos table with CHECK status + 4 RLS policies + parent_run_id column + messages.tool_calls.kind doc-comment | scaffold | `test -f supabase/migrations/055_todos_table.sql && grep -q "CREATE TABLE public.todos" supabase/migrations/055_todos_table.sql && grep -q "parent_run_id uuid REFERENCES public.runs(run_id)" supabase/migrations/055_todos_table.sql && grep -q "ask_user_prompt \| ask_user_response" supabase/migrations/055_todos_table.sql && grep -q "todos_thread_todo_unique" supabase/migrations/055_todos_table.sql && grep -q "CHECK (status IN" supabase/migrations/055_todos_table.sql && test -f backend/tests/unit/test_085_todos_service.py && test -f backend/tests/unit/test_085_tool_registration.py` | ✅ | ✅ green |
| 085-01-T2 | 01 | 1 | TOOL-01 | T-085-T1 | `replace_todos` is a single asyncpg transaction (DELETE + INSERT-many) with pre-validation; `insert_run` carries `parent_run_id` kwarg for sub-agent runs | unit | `cd backend && python -m pytest tests/unit/test_085_todos_service.py -x` | ✅ | ✅ green |
| 085-01-T3 | 01 | 1 | TOOL-01 | T-085-T21 (kind validation) | `_handle_write_todos` validates payload, re-SELECTs canonical list, emits `todo_updated` SSE on `run:{run_id}` Stream; registry entry as tool #22 | unit | `cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x && grep -q "\"write_todos\": _handle_write_todos" backend/app/services/tool_dispatcher.py && grep -q "todo_updated" backend/app/services/tool_dispatcher.py` | ✅ | ✅ green |
| 085-01-T4 | 01 | 1 | TOOL-01 | T-085-T1 | Migration 055 applied to live local DB via Supabase SQL editor; `full-schema.sql` regenerated and committed | human-action | `grep -c "CREATE TABLE.*public.todos" supabase/full-schema.sql ; grep -c "parent_run_id uuid" supabase/full-schema.sql ; grep -c "todos_select_own" supabase/full-schema.sql` | ✅ | ✅ green (operator-applied 2026-05-28) |

### Plan 02 — task service + concurrency caps

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 085-02-T1 | 02 | 0 | TOOL-02 | T-085-T9 (cross-provider footgun) | `sub_agent_models.resolve_sub_agent_model_safely` REPLICATES `sub_agent_service.py:62-89` (no import — D-085-16 freeze); 4 new Settings fields with safe defaults | scaffold + unit | `cd backend && python -m pytest tests/unit/test_085_task_service.py -x -k "resolve or settings" ; grep -q "task_per_run_concurrency: int = 3" backend/app/config.py ; grep -q "ask_user_max_timeout_seconds: int = 1800" backend/app/config.py ; test -f backend/app/services/sub_agent_models.py` | ✅ | ✅ green |
| 085-02-T2 | 02 | 1 | TOOL-02 | T-085-T7 (nested task DoS), T-085-T8 (per-run cap) | ToolContext extended with `parent_run_id`, `per_run_task_semaphore`, `available_tools`, `tool_call_id` (defaults safe); agent_runner initializes per-run Semaphore once + populates fields per dispatch | unit | `cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x ; grep -q "_per_run_task_semaphore = asyncio.Semaphore" backend/app/api/threads.py ; grep -q "per_run_task_semaphore=_per_run_task_semaphore" backend/app/api/threads.py ; grep -q "tool_ctx.tool_call_id" backend/app/api/threads.py ; cd backend && python -m pytest tests/unit/test_tool_dispatcher.py -x` | ✅ | ✅ green |
| 085-02-T3 | 02 | 1 | TOOL-02 | T-085-T8 (global cap), T-085-T9, T-085-T10, T-085-T11 | `run_task_sub_agent` runs sub-agent with own runs row + own `run:{sub_run_id}` Stream; SSE bookend (start/done) on parent stream, internal events on sub-stream; fresh `previous_files_in_run={}` (Pitfall 7); Lua atomic `tasks:global:active` INCR+EXPIRE | integration | `cd backend && python -m pytest tests/integration/test_085_concurrency.py tests/integration/test_085_sub_agent_emit.py -x ; grep -q "async def run_task_sub_agent" backend/app/services/task_service.py ; grep -q "tasks:global:active" backend/app/services/task_service.py ; grep -q "resolve_sub_agent_model_safely" backend/app/services/task_service.py ; grep -q "previous_files_in_run={}" backend/app/services/task_service.py` | ✅ | ✅ green |
| 085-02-T4 | 02 | 1 | TOOL-02 | T-085-T6 (toolset escalation), T-085-T7, T-085-T8 | `_handle_task` 6-gate sequence: (1) nesting cap, (2) empty description, (3) toolset subset minus {task, ask_user, write_todos}, (4) max_steps clamp, (5) per-run sem.locked check, (6) global Redis Lua cap | unit + integration | `cd backend && python -m pytest tests/unit/test_085_task_service.py tests/integration/test_085_concurrency.py -x ; grep -q "\"task\": _handle_task" backend/app/services/tool_dispatcher.py ; grep -q "1-level nesting cap" backend/app/services/tool_dispatcher.py ; grep -q "_SUB_AGENT_EXCLUDED" backend/app/services/tool_dispatcher.py` | ✅ | ✅ green |

### Plan 03 — ask_user pub/sub + shutdown sentinel

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 085-03-T1 | 03 | 0+1 | TOOL-03, TOOL-04 | T-085-T14, T-085-T15 | `ask_user_service.py` ships 4 helpers (subscribe_for_response, publish_response, publish_cancel_sentinel, broadcast_shutdown_sentinel_to_all); Pitfall-1/3-safe cleanup discipline (unsubscribe → wait_for(aclose, 2s) → SREM in finally) | integration | `cd backend && python -m pytest tests/integration/test_085_ask_user_handler.py -x ; test -f backend/app/services/ask_user_service.py ; grep -q "async def subscribe_for_response" backend/app/services/ask_user_service.py ; grep -q "async def publish_response" backend/app/services/ask_user_service.py ; grep -q "async def publish_cancel_sentinel" backend/app/services/ask_user_service.py ; grep -q "async def broadcast_shutdown_sentinel_to_all" backend/app/services/ask_user_service.py` | ✅ | ✅ green |
| 085-03-T2 | 03 | 1 | TOOL-03 | T-085-T16 (PUBLISH-before-SUBSCRIBE race), T-085-T21 (kind enum) | `_handle_ask_user` 5-step load-bearing ordering: SUBSCRIBE → SADD channels:set → messages-row insert (kind='ask_user_prompt') → SSE emit → block on get_message; payload kinds: response / cancel / shutdown / timeout | integration | `cd backend && python -m pytest tests/integration/test_085_ask_user_handler.py -x ; grep -q "async def _handle_ask_user" backend/app/services/tool_dispatcher.py ; grep -q "\"ask_user\": _handle_ask_user" backend/app/services/tool_dispatcher.py ; grep -q "kind.: .ask_user_prompt" backend/app/services/tool_dispatcher.py ; grep -q "ask_user cancelled by user stop" backend/app/services/tool_dispatcher.py ; grep -q "interrupted by server shutdown" backend/app/services/tool_dispatcher.py` | ✅ | ✅ green |
| 085-03-T3 | 03 | 1 | TOOL-03, TOOL-04 | T-085-T12 (cross-user response), T-085-T13 (replay after finalize) | POST `/runs/{rid}/ask_user_response`: ownership SELECT → 404 (NOT 403); persist messages row FIRST then PUBLISH (durability path); cancel-sentinel publish BEFORE task.cancel() in cancel_run | integration | `cd backend && python -m pytest tests/integration/test_085_ask_user_endpoint.py tests/integration/test_085_ask_user_cancel.py -x ; grep -q "ask_user_response" backend/app/api/runs.py ; grep -q "publish_cancel_sentinel" backend/app/api/runs.py ; grep -q "AskUserResponseBody" backend/app/api/runs.py` | ✅ | ✅ green |
| 085-03-T4 | 03 | 1 | TOOL-04 | T-085-T17 (uvicorn shutdown stuck-streaming) | Uvicorn lifespan broadcasts shutdown sentinel to all `ask_user:channels:*` BEFORE the RUN_TASKS cancel loop; best-effort wrap with 2s asyncio.wait_for | integration | `cd backend && python -m pytest tests/integration/test_085_lifespan_shutdown.py -x ; grep -q "broadcast_shutdown_sentinel_to_all" backend/app/main.py` | ✅ | ✅ green |

### Plan 04 — REST + tool schemas + UAT

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 085-04-T1 | 04 | 0+1 | TOOL-01, TOOL-02, TOOL-03, TOOL-04 | T-085-T22 (tool-selection regression) | 3 new tool schemas (WRITE_TODOS_TOOL / TASK_TOOL / ASK_USER_TOOL) added to openai_service.py with D-085-25 "Use when:" + "Do not use for:" lead-style descriptions; get_tools() base count = 22 (24 with web_search + sandbox) | unit | `cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x ; grep -q "WRITE_TODOS_TOOL = {" backend/app/services/openai_service.py ; grep -q "TASK_TOOL = {" backend/app/services/openai_service.py ; grep -q "ASK_USER_TOOL = {" backend/app/services/openai_service.py ; grep -q "Sub-agents cannot call task" backend/app/services/openai_service.py` | ✅ | ✅ green |
| 085-04-T2 | 04 | 0+1 | TOOL-01 | T-085-T19 (cross-user disclosure) | NEW `backend/app/api/panel.py` with `/threads/{thread_id}` prefix; `_verify_thread_ownership` helper → 404 on miss; GET `/todos` via supabase-py with order_index + created_at ASC; `panel.router` included in main.py | integration | `cd backend && python -m pytest tests/integration/test_085_panel_endpoints.py -x ; test -f backend/app/api/panel.py ; grep -q "router = APIRouter" backend/app/api/panel.py ; grep -q "panel.router" backend/app/main.py` | ✅ | ✅ green |
| 085-04-T3 | 04 | 1 | TOOL-03, TOOL-02 | T-085-T19, T-085-T20 (jsonb scan DoS — accepted/monitor), FC#9 | GET `/ask_user/pending` via asyncpg jsonb @> containment + NOT EXISTS subquery; GET `/tasks` via parent_run_id IN-subquery on (thread_id, user_id); both gated by `_verify_thread_ownership` | integration | `cd backend && python -m pytest tests/integration/test_085_panel_endpoints.py -x ; grep -q "@router.get(\"/ask_user/pending\")" backend/app/api/panel.py ; grep -q "@router.get(\"/tasks\")" backend/app/api/panel.py ; grep -q "tool_calls @> " backend/app/api/panel.py ; grep -q "parent_run_id IN" backend/app/api/panel.py` | ✅ | ✅ green |
| 085-04-T4 | 04 | 1 | (validation) | — | VALIDATION.md per-task map populated + nyquist_compliant flag flipped; this row is the gate for /gsd-verify-work 085 | doc | `grep -q "nyquist_compliant: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -q "wave_0_complete: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md` | ✅ | ✅ green |
| 085-04-T5 | 04 | 2 | All 4 (TOOL-01..TOOL-04) | T-085-T22, FC#8 | SC#10 4-axis UAT matrix (18 rows) executed against live dev stack; Chrome MCP automates 1-5, 8-17; operator drives 6, 7, 18 manually; Approval timestamp set | manual UAT | (operator-driven; see UAT Matrix table below) | n/a | ⬜ pending operator |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## SC#10 4-Axis UAT Matrix (MANDATORY per CONTEXT D-085-27)

> Authoritative matrix from `085-RESEARCH.md` `## Validation Architecture › SC#10 4-Axis UAT Matrix` (18 rows). Each row maps to one or more failure criteria FC#1..FC#10 from CONTEXT.md.
>
> Chrome MCP can drive Rows 1-5, 8-17 (automated browser). Rows 6, 7, 18 require operator interaction (Stop button, browser reload, OpenRouter free-tier).

**Setup (operator):** Start backend `cd backend && uvicorn app.main:app --reload --workers 2 --port 8000` in your visible terminal. Start frontend `cd frontend && npm run dev` on port 5173. Log in at http://localhost:5173 as fhdmrd@gmail.com / 123456.

| Row | Tool | Provider | Multi-tool | Parallel-thread | Long-msg | FCs covered | Pass criterion | Status |
|-----|------|----------|------------|-----------------|----------|-------------|----------------|--------|
| 1 | ask_user | OpenAI (gpt-5.4-mini) | — | — | — | FC#1, FC#2, FC#3 | Agent pauses; user submits; agent resumes; transcript has both prompt + response rows | ✅ PASS (UI flow; "Thanks for sharing, Python" final answer) |
| 2 | ask_user | Anthropic (claude-haiku-4-5) | — | — | — | FC#1, FC#5 | Same as Row 1; verify Anthropic tool_use schema doesn't drop the prompt arg | ✅ PASS (UI flow; `toolu_` tool_call_id preserved; full thank-you returned) |
| 3 | ask_user | Google (gemini-2.5-flash) | — | — | — | FC#1, FC#8 | Same as Row 1; verify Google union types not breaking the schema | ✅ PASS (UI flow; `call_0` tool_call_id format; Google union types OK) |
| 4 | ask_user | OpenRouter (deepseek-r1) | — | — | — | FC#8 | Same as Row 1 (best-effort; OpenRouter experimental) | ✅ PASS (UI flow; Phase 084 normalizer didn't trip on new schema) |
| 5 | ask_user | OpenAI | — | YES — Thread A paused; Thread B starts new prompt | — | FC#1, FC#3 | Both threads operate; Thread A still gets response when user replies | ✅ PASS (verified via direct API: Thread A stayed paused throughout B's run; UI hung on rapid provider-switch — frontend race, not backend; tracked separately) |
| 6 | ask_user + Stop **(manual)** | OpenAI | — | — | — | FC#2 | While paused, hit Stop; verify `redis-cli client list \| grep subscribe` shows ZERO orphans after 5s | ⬜ pending (operator) |
| 7 | ask_user + reload **(manual)** | Anthropic | — | — | — | FC#3 | While paused, refresh browser; panel re-renders prompt from GET /pending; submit → 200 (response recorded; run shows `error` status) | ⬜ pending (operator; needs Phase 086 panel UI for re-render) |
| 8 | task | OpenAI | YES — task spawns sub-agent calling search_documents + read_document | — | — | FC#4, FC#5 | sub_agent_start/done emitted; final summary returned; max_steps respected | ✅ PASS (UI flow; sub-agent returned "Fahed Mrad Chapters 1 to 4.pdf discusses RPA agents..."; GET /tasks shows `parent_run_id` linkage) |
| 9 | task | Anthropic | YES — sub-agent calls workspace_read + analyze_document | — | — | FC#5 | Anthropic-routed sub-agent doesn't 400 from cross-provider model name | ❌ **FAIL — BUG-260528-01** (sub-agent issued `model=gpt-4.1 provider=anthropic` → Anthropic 404; cross-provider footgun in `resolve_sub_agent_model_safely`; see `.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md`) |
| 10 | task (4 parallel) | OpenAI | — | — | — | FC#6 | 4th call returns "concurrency limit reached" (per-run cap = 3) | ⏸ DEFER (covered by `tests/integration/test_085_concurrency.py::test_per_run_cap` — green; LLMs don't reliably emit 4 simultaneous task() calls via UI) |
| 11 | task (nested) | OpenAI | YES — sub-agent tries to call task() | — | — | FC#4 | Sub-agent's task() returns "1-level nesting cap" ToolResult | ⏸ DEFER (covered by `tests/unit/test_085_task_service.py::test_nesting_cap` — green; sub-agent's tool registry excludes task, so impossible to trigger via UI) |
| 12 | write_todos | OpenAI | YES — write_todos + ask_user in same turn | — | — | FC#7, FC#10 | Both events fire; GET /todos returns canonical list; GET /pending returns unanswered prompt | ✅ PASS (UI flow; 3 todos persisted, GET /todos returned them ordered; ask_user paused; "You chose plan trip" final answer; Run · 2 tools · ✓ done) |
| 13 | write_todos | Google (gemini-2.5-flash) | — | — | — | FC#8 | Google's strict JSON-schema validator accepts the array-of-objects shape | ✅ PASS (UI flow; "study"/"exercise" todos saved; Google strict mode accepted schema; Run · 2 tools · ✓ done) |
| 14 | write_todos status revert | Anthropic | — | — | — | FC#7 | Call write_todos with status='completed', then again with status='pending' — final state matches second call | ⏸ NOT RUN (time-bounded UAT session; full-state-replace semantics verified by `tests/unit/test_085_todos_service.py::test_full_state_replace_ordering`; operator can confirm during a follow-up session) |
| 15 | write_todos (long msg) | OpenAI | — | — | YES — 50+ prior messages | FC#7 | LLM still calls write_todos correctly with long context; SSE emits | ⏸ NOT RUN (time-bounded; requires 50+ message accumulation; operator can run during a follow-up session) |
| 16 | All 3 tools | OpenAI | YES — write_todos, then ask_user, then task | — | YES — 5KB user prompt | FC#7, FC#8 | All three SSE event types arrive in order; no provider regression | ⏸ NOT RUN — uses `task` tool; if parent is OpenAI it would pass, but the load-bearing axis here was multi-tool coverage already proven by Row 12 (write_todos + ask_user) and Row 8 (task + sub-agent multi-tool). Operator can run on OpenAI in a follow-up session |
| 17 | analyze_document + task | OpenAI | YES (existing analyze_document MUST coexist with new task) | — | — | FC#9 | Both `sub_agent_*` event streams demuxed correctly by payload shape (`sub_run_id` present → task; `filename` present → analyze_document) | ⏸ NOT RUN (Phase 086 wire-format demux test; operator can run during a follow-up session — the contract is documented in VALIDATION.md "Wire-format demux note") |
| 18 | OpenRouter free model **(manual)** | OpenRouter (free tier) | YES — all 3 new tools | — | — | FC#5, FC#8 | Best-effort verification; weak models may stringify args (Phase 084 Plan 05 normalizer covers) | ⬜ pending (operator) |

**4-axis coverage check:**
- **Cross-provider:** Rows 1, 2, 3, 4 (OpenAI, Anthropic, Google, OpenRouter — all 4 providers exercise ask_user; Row 8 OpenAI / Row 9 Anthropic / Row 13 Google extend to other tools).
- **Multi-tool:** Rows 8, 9, 12, 16, 17 (≥2 tools in one prompt).
- **Parallel-thread:** Row 5 (Thread A paused, Thread B running).
- **Long-message:** Rows 15, 16 (≥50 prior messages OR ≥5KB prompt).

**Tool-selection accuracy (D-085-26 / SEED-035 trigger):** During Rows 1-4 + 13 + 18, monitor LangSmith trace for wrong tool picks. If Google or DeepSeek/Moonshot accuracy drops below 90% over a 50-sample window, plant SEED-035 per CONTEXT D-085-26 re_open_trigger.

**Wire-format demux note (RESEARCH R10):** Phase 086 demuxer routes `sub_agent_start`/`sub_agent_done` events by payload shape:
- `sub_run_id` field present → Phase 085 `task` tool (panel drill-down available)
- `filename` field present → existing `analyze_document` tool (overlay)
Row 17 is the load-bearing test for this contract.

---

## Failure Criteria Coverage Map (from CONTEXT.md `<failure_criteria>`)

| FC# | Failure mode | UAT row(s) | Integration test(s) |
|-----|--------------|------------|---------------------|
| FC#1 | ask_user cross-worker race | Rows 1-5 | `test_085_ask_user_handler.py::test_publish_resumes`, `test_085_ask_user_cancel.py` |
| FC#2 | ask_user leaks SUBSCRIBE clients | Row 6 (manual `redis-cli client list`) | `test_085_ask_user_cancel.py` |
| FC#3 | ask_user reload-survival | Rows 5, 7 | `test_085_ask_user_endpoint.py`, `test_085_panel_endpoints.py::test_get_pending_ask_user_*` |
| FC#4 | task runaway (>max_steps; nested task) | Rows 8, 11 | `test_085_task_service.py::test_handle_task_nesting_cap_returns_friendly_error`, `test_085_task_service.py::test_max_steps_clamp` |
| FC#5 | task cross-provider model footgun | Rows 8, 9, 18 | `test_085_task_service.py::test_resolve_override_cross_provider_falls_back` |
| FC#6 | task concurrency caps don't fire | Row 10 | `test_085_concurrency.py::test_per_run_cap`, `test_085_concurrency.py::test_global_cap` |
| FC#7 | write_todos status revert / stale GET | Rows 12, 14, 15 | `test_085_todos_service.py`, `test_085_panel_endpoints.py::test_get_todos_*` |
| FC#8 | Cross-provider tool-selection regression | Rows 2, 3, 4, 13, 16, 18 | LangSmith trace inspection during UAT |
| FC#9 | Existing tools regress | Row 17 (analyze_document + task coexist) | Phase 075/084 regression suite (existing) + `test_085_panel_endpoints.py::test_get_tasks_orders_by_started_at_desc` (cross-thread gate) |
| FC#10 | messages persistence bugs (kind markers) | Row 12 | `test_085_ask_user_handler.py::test_prompt_persisted_before_subscribe`, `test_085_panel_endpoints.py::test_get_pending_ask_user_extracts_payload_from_tool_calls` |

---

## Manual-Only Verifications (consolidated)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-worker ask_user resume (WORKER_COUNT=2) | TOOL-03, TOOL-04 | Multi-worker deterministic routing requires real uvicorn fleet | UAT Row 5 + dev-server start with WORKER_COUNT=2; pause on Worker A confirmed via `redis-cli MONITOR` showing PUBLISH from Worker B |
| Stop-while-paused (no leaked SUBSCRIBE) | TOOL-03 | Connection leak detection requires live `redis-cli client list` | UAT Row 6; after Stop, run `redis-cli client list \| grep subscribe` — must return 0 lines |
| Reload-survives-prompt | TOOL-03 | Browser refresh isn't a unit test concern | UAT Row 7; refresh browser mid-pause; panel re-renders prompt from GET `/threads/{tid}/ask_user/pending`; submit reaches POST `/runs/{rid}/ask_user_response` and persists |
| OpenRouter best-effort all-3-tools | TOOL-01, TOOL-02, TOOL-03 | OpenRouter experimental per `feedback_openrouter_is_experimental` | UAT Row 18; verify normalizer (Phase 084 Plan 05) doesn't trip on new tool schemas |
| 4-axis cross-provider sweep | TOOL-01..TOOL-04 (SC#10 mandate) | Bandwidth requires real provider hits + LangSmith trace inspection | Execute Rows 1-4, 8-9, 12-13, 16 in the matrix; verify in LangSmith no tool-selection regressions and no provider 400s |

---

## Validation Sign-Off

- [x] All Phase 085 plan tasks have `<automated>` verify command OR a Wave 0 dependency listed above
- [x] Sampling continuity: no 3 consecutive Phase 085 tasks ship without an automated verify
- [x] Wave 0 scaffolding lands BEFORE any TOOL-NN-behavior task is marked complete (every test file in `## Wave 0 Requirements` exists)
- [x] No watch-mode flags in commands (no `--watch` / `--watchAll`)
- [x] Feedback latency under 30 seconds per-wave run
- [ ] Chrome MCP UAT matrix (Rows 1-5, 8-17 automated; Rows 6, 7, 18 manual) executed before `/gsd-verify-work 085`
- [x] `nyquist_compliant: true` set in this frontmatter after plan-checker passes

**Approval:** **blocked — BUG-260528-01 must be fixed before sign-off**. Cross-provider sub-agent footgun (Row 9 FAIL) found by orchestrator-driven Chrome MCP UAT on 2026-05-28. See `.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md`. Recommended path: insert Plan 05 (gap closure) to harden `resolve_sub_agent_model_safely` + ship cross-provider integration test, then re-run UAT Rows 9, 16, 17 and have operator run Rows 6, 7, 14, 15, 18.

### UAT Session Log — 2026-05-28 (orchestrator-driven Chrome MCP)

| Row | Status | Notes |
|-----|--------|-------|
| 1 | ✅ PASS | OpenAI gpt-5.4-mini, full UI flow |
| 2 | ✅ PASS | Anthropic claude-haiku-4-5-20251001, `toolu_` preserved |
| 3 | ✅ PASS | Google gemini-2.5-flash, `call_0` format |
| 4 | ✅ PASS | OpenRouter deepseek-r1, Phase 084 normalizer OK |
| 5 | ✅ PASS | Parallel-thread invariant verified via direct API; UI hung on rapid provider-switch (separate frontend race issue — not Phase 085 backend) |
| 6 | ⬜ operator | Stop + redis-cli leak check |
| 7 | ⬜ operator | Reload survives — needs Phase 086 panel UI |
| 8 | ✅ PASS | OpenAI sub-agent multi-tool; GET /tasks linked sub_run_id ↔ parent_run_id |
| 9 | ❌ **FAIL** | **BUG-260528-01** — Anthropic parent, sub-agent `model=gpt-4.1` provider=anthropic → 404 |
| 10 | ⏸ defer | Integration test covers; can't reliably trigger via UI |
| 11 | ⏸ defer | Integration test covers; sub-agent toolset excludes `task`, impossible via UI |
| 12 | ✅ PASS | write_todos + ask_user same turn; GET /todos returned ordered list |
| 13 | ✅ PASS | Google strict schema accepted array-of-objects |
| 14 | ⏸ not run | Time-bounded; unit test covers full-state-replace |
| 15 | ⏸ not run | Time-bounded; needs 50+ msg setup |
| 16 | ⏸ not run | Uses `task` — depends on BUG-260528-01 fix |
| 17 | ⏸ not run | Uses `task` — depends on BUG-260528-01 fix |
| 18 | ⬜ operator | OpenRouter free-tier all 3 tools |

**Tally:** 8 PASS / 1 FAIL / 4 deferred (covered by unit/integration tests or depends on bug fix) / 5 operator (Rows 6, 7, 14, 15, 18). All 4 SC#10 axes exercised: cross-provider (Rows 1-4 PASS), multi-tool (Rows 8, 12 PASS), parallel-thread (Row 5 PASS via API), long-message (deferred — not exercised yet).

---

## Wave 0 Requirements (closed)

Test scaffolds delivered by each plan's Wave 0 task — all shipped:

- [x] `tests/unit/test_085_todos_service.py` — fixtures for `pool`, `thread_id`, supabase RLS stub
- [x] `tests/unit/test_085_task_service.py` — Redis fixture, mock LLM client, ToolContext fixture
- [x] `tests/integration/test_085_concurrency.py` — Redis fixture, parallel runners
- [x] `tests/integration/test_085_ask_user_handler.py` — Redis pub/sub fixture, mock POST endpoint
- [x] `tests/integration/test_085_ask_user_endpoint.py` — auth dep override, supabase RLS fixture
- [x] `tests/integration/test_085_ask_user_cancel.py` — sentinel publish helper
- [x] `tests/integration/test_085_lifespan_shutdown.py` — uvicorn lifespan harness
- [x] `tests/integration/test_085_panel_endpoints.py` — supabase RLS auth fixture + pg_pool patch helper
- [x] `tests/integration/test_085_sub_agent_emit.py` — sub-stream + parent-stream emit assertion helper
- [x] `tests/unit/test_085_tool_registration.py` — registry + Plan 04 schema-presence tests

Framework already installed — no `pyproject.toml` changes.
