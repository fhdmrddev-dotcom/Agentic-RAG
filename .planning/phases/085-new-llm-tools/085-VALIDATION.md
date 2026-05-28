---
phase: 085
slug: new-llm-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
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
| **Config file** | `backend/pyproject.toml` (existing) |
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

> Populated by gsd-planner per plan; one row per task that ships behavior. `File Exists` flips to ✅ when Wave 0 scaffolding lands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (pending — planner fills) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test scaffolding new for Phase 085 (no existing test files):

- [ ] `tests/unit/test_085_todos_service.py` — fixtures for `pool`, `thread_id`, supabase RLS stub
- [ ] `tests/unit/test_085_task_service.py` — Redis fixture, mock LLM client, ToolContext fixture
- [ ] `tests/integration/test_085_concurrency.py` — Redis fixture, parallel runners
- [ ] `tests/integration/test_085_ask_user_handler.py` — Redis pub/sub fixture, mock POST endpoint
- [ ] `tests/integration/test_085_ask_user_endpoint.py` — auth dep override, supabase RLS fixture
- [ ] `tests/integration/test_085_ask_user_cancel.py` — sentinel publish helper
- [ ] `tests/integration/test_085_lifespan_shutdown.py` — uvicorn lifespan harness
- [ ] `tests/integration/test_085_panel_endpoints.py` — supabase RLS auth fixture
- [ ] `tests/integration/test_085_sub_agent_emit.py` — sub-stream + parent-stream emit assertion helper

Framework already installed — no `pyproject.toml` changes.

---

## Manual-Only Verifications (SC#10 4-Axis UAT Matrix)

> Authoritative matrix lives at `085-RESEARCH.md` `## Validation Architecture › SC#10 4-Axis UAT Matrix` (18 rows). Each row maps to one or more failure criteria FC#1..FC#10 from CONTEXT.md. Chrome MCP can drive Rows 1-5, 8-17 (automated browser). Rows 6, 7, 18 require operator interaction (Stop button, browser reload, OpenRouter free-tier rate-limit observation).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-worker ask_user resume (WORKER_COUNT=2) | TOOL-03, TOOL-04 | Multi-worker deterministic routing requires real uvicorn fleet | RESEARCH Row 5 + dev-server start with WORKER_COUNT=2; pause on Worker A confirmed via `redis-cli MONITOR` showing PUBLISH from Worker B |
| Stop-while-paused (no leaked SUBSCRIBE) | TOOL-03 | Connection leak detection requires live `redis-cli client list` | RESEARCH Row 6; after Stop, run `redis-cli client list \| grep subscribe` — must return 0 lines |
| Reload-survives-prompt | TOOL-03 | Browser refresh isn't a unit test concern | RESEARCH Row 7; refresh browser mid-pause; panel re-renders prompt from GET `/threads/{tid}/ask_user/pending`; submit reaches POST `/runs/{rid}/ask_user_response` and persists |
| OpenRouter best-effort all-3-tools | TOOL-01, TOOL-02, TOOL-03 | OpenRouter experimental per `feedback_openrouter_is_experimental` | RESEARCH Row 18; verify normalizer (Phase 084 Plan 05) doesn't trip on new tool schemas |
| 4-axis cross-provider sweep | TOOL-01..TOOL-04 (SC#10 mandate) | Bandwidth requires real provider hits + LangSmith trace inspection | Execute Rows 1-4, 8-9, 12-13, 16 in the matrix; verify in LangSmith no tool-selection regressions and no provider 400s |

---

## Failure Criteria Coverage Map (from CONTEXT.md `<failure_criteria>`)

| FC# | Failure mode | UAT row(s) | Integration test(s) |
|-----|--------------|------------|---------------------|
| FC#1 | ask_user cross-worker race | Rows 1-5 | `test_085_ask_user_handler.py::test_publish_resumes`, `test_085_ask_user_cancel.py` |
| FC#2 | ask_user leaks SUBSCRIBE clients | Row 6 (manual `redis-cli client list`) | `test_085_ask_user_cancel.py` |
| FC#3 | ask_user reload-survival | Rows 5, 7 | `test_085_ask_user_endpoint.py` |
| FC#4 | task runaway (>max_steps; nested task) | Rows 8, 11 | `test_085_task_service.py::test_nesting_cap`, `test_085_task_service.py::test_max_steps_clamp` |
| FC#5 | task cross-provider model footgun | Rows 8, 9, 18 | `test_085_task_service.py::test_provider_fallback_routing` |
| FC#6 | task concurrency caps don't fire | Row 10 | `test_085_concurrency.py::test_per_run_cap`, `test_085_concurrency.py::test_global_cap` |
| FC#7 | write_todos status revert / stale GET | Rows 12, 14, 15 | `test_085_todos_service.py`, `test_085_panel_endpoints.py::test_get_todos` |
| FC#8 | Cross-provider tool-selection regression | Rows 2, 3, 4, 13, 16, 18 | LangSmith trace inspection during UAT |
| FC#9 | Existing tools regress | Row 17 (analyze_document + task coexist) | Phase 075/084 regression suite (existing) |
| FC#10 | messages persistence bugs (kind markers) | Row 12 | `test_085_ask_user_handler.py::test_prompt_persisted_before_subscribe` |

---

## Validation Sign-Off

- [ ] All Phase 085 plan tasks have `<automated>` verify command OR a Wave 0 dependency listed above
- [ ] Sampling continuity: no 3 consecutive Phase 085 tasks ship without an automated verify
- [ ] Wave 0 scaffolding lands BEFORE any TOOL-NN-behavior task is marked complete (every test file above must exist)
- [ ] No watch-mode flags in commands (e.g., no `--watch` / `--watchAll`)
- [ ] Feedback latency under 30 seconds per-wave run
- [ ] Chrome MCP UAT matrix (Rows 1-5, 8-17 automated; Rows 6, 7, 18 manual) executed before `/gsd-verify-work 085`
- [ ] `nyquist_compliant: true` set in this frontmatter after plan-checker passes

**Approval:** pending
