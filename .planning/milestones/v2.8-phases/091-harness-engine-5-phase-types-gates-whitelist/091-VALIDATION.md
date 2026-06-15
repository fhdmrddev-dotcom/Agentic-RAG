---
phase: 091
slug: harness-engine-5-phase-types-gates-whitelist
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 091 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `091-RESEARCH.md` § Validation Architecture (lines 576–620).
> Per-Task Verification Map populated by the planner (plan/task IDs assigned).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (`asyncio_mode=auto`) |
| **Config file** | `backend/pytest.ini` (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~30–60 seconds (unit); DB-touching tests gated by `RUN_DB_TESTS=1` |
| **HTTP client** | `httpx.AsyncClient` + `ASGITransport` (in-process) |
| **Shared fixtures** | `backend/tests/conftest.py` — existing: `mock_redis`, `mock_supabase`, `anyio_backend`; ADDED in Plan 01: `mock_asyncpg_pool` (UPDATE-order recorder), `fake_redis` (pub/sub+XADD), `make_tool_context`, `make_run_context`, `build_workflow_definition`/`four_seed_defs` |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/ -x -q`
- **After every plan wave:** Run the full suite `cd backend && venv/Scripts/python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> The 7 Wave-0 test files are created as skeleton contracts in Plan 01 (Wave 1); each downstream
> plan flips its own contracts live. Task IDs are `{plan}-T{n}`. "File Exists" = the test file the
> automated command runs against (created in Plan 01, flipped live by the owning plan = `W0→NN`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | HARNESS-01/03/04/05/07/TOOL-05 | T-091-01/02 | Models carry every engine-read field; extra='forbid' preserved (no injected keys) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_engine.py -k models -q` | ✅ created in 01 | ⬜ pending |
| 01-T2 | 01 | 1 | (infra) | — | Shared fixtures: UPDATE-order recorder, fake Redis pub/sub+XADD, ctx factories, def builder | infra | `cd backend && venv/Scripts/python -m pytest tests/ --collect-only -q` | ✅ created in 01 | ⬜ pending |
| 01-T3 | 01 | 1 | HARNESS-01/03/04/05/07/TOOL-05 | — | 7 Wave-0 skeleton files exist + collect green (every req has a declared contract) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_*.py tests/test_tool_budget.py -q` | ✅ created in 01 | ⬜ pending |
| 02-T1 | 02 | 2 | HARNESS-03 | T-091-05/06 | 2-phase write = active-UPDATE before completed-UPDATE (one atomic flip each); 9-kind audit CHECK validated in code | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_resume.py -k two_phase_write -q` | W0→02 | ⬜ pending |
| 02-T2 | 02 | 2 | HARNESS-01/03 | T-091-05/07 | Engine drives ordered transitions via PHASE_TYPE_REGISTRY seam; crash leaves phase `active`; final output is chat message (no extra LLM) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_engine.py tests/test_harness_resume.py -k "transition or crash_leaves or completion" -q` | W0→02 | ⬜ pending |
| 02-T3 | 02 | 2 | HARNESS-03 (safety) | T-091-04 | Reachability lint flags orphan / unsatisfiable-skip / no-terminal; 4 seeds lint clean | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_reachability.py -q` | W0→02 | ⬜ pending |
| 06-T1 | 06 | 2 | HARNESS-05 | T-091-08/10/11 | Out-of-whitelist refused with clean tool_result + matching tool_call_id + tool_refused audit; phase_whitelist=None = literal no-op | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_whitelist.py -q` | W0→06 | ⬜ pending |
| 06-T2 | 06 | 2 | TOOL-05 | T-091-09 | get_tools filtered by whitelist then capped at max_tools; whitelist tools always retained; absent=no cap | unit | `cd backend && venv/Scripts/python -m pytest tests/test_tool_budget.py -q` | W0→06 | ⬜ pending |
| 03-T1 | 03 | 3 | HARNESS-01 | T-091-12 | Closed PROGRAMMATIC_PHASE_REGISTRY + idempotent split_topic | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_engine.py -k "programmatic or split_topic" -q` | W0→03 | ⬜ pending |
| 03-T2 | 03 | 3 | HARNESS-01 | T-091-13 | Additive system_prompt_override (None = byte-identical sub-agent path) | unit | `cd backend && venv/Scripts/python -m pytest tests/ -k "sub_agent and (override or prompt)" -q` | existing suite | ⬜ pending |
| 03-T3 | 03 | 3 | HARNESS-01 | T-091-14/15 | All 5 executors registered + wrap substrate; both whitelist layers wired; engine resolves all 5 end-to-end | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_engine.py -k "phase_dispatch or 5_types or ordered" -q` | W0→03 | ⬜ pending |
| 05-T1 | 05 | 3 | HARNESS-04 | T-091-17 | 4 validator kinds pass/fail via jsonschema/re/registry; run_gates returns first failure | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_gates.py -k validator -q` | W0→05 | ⬜ pending |
| 05-T2 | 05 | 3 | HARNESS-04 (D-12) | T-091-16 | Caps default from existing knobs (Explorer=8 step; 300×8 wall-clock) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_gates.py -k caps -q` | W0→05 | ⬜ pending |
| 05-T3 | 05 | 3 | HARNESS-04 | T-091-16/18/19 | Bounded retry reaches failed ≤3 (never loops) + consec-identical SC + skip_to_phase + fail_run-keeps-partial + visible (emit+audit) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_gates.py -q` | W0→05 | ⬜ pending |
| 04-T1 | 04 | 4 | HARNESS-03 | T-091-23 | find_resumable_runs (per-thread anchor); answered-vs-pending via /pending-style system-row scan | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_resume.py -k "resumable or answered_vs_pending" -q` | W0→04 | ⬜ pending |
| 04-T2 | 04 | 4 | HARNESS-03 | T-091-21 | resume_pending_prompt re-subscribes BEFORE re-emit (Pitfall 2); no row duplication | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_resume.py -k "resubscribe or reemit or pending" -q` | W0→04 | ⬜ pending |
| 04-T3 | 04 | 4 | HARNESS-03 | T-091-20/22 | Startup sweep claims each run (multi-worker-safe) + re-runs active idempotently + resumes ask_user correctly | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_resume.py -q` | W0→04 | ⬜ pending |
| 07-T1 | 07 | 5 | HARNESS-07 | T-091-24/25 | 4 seeds parse via model_validate + lint clean + cover all 5 types; migration 061 idempotent, no db push | unit | `cd backend && venv/Scripts/python -m pytest tests/test_harness_templates.py -k "parse or 5_types or lint" tests/test_harness_reachability.py -k seeds -q` | W0→07 | ⬜ pending |
| 07-T2 | 07 | 5 | HARNESS-07 | — | Each seed runs end-to-end through the engine (mocked LLM); ordered completion + chat-msg + SSE + gate + batch + human-input | integration | `cd backend && venv/Scripts/python -m pytest tests/test_harness_templates.py -q` | W0→07 | ⬜ pending |
| 07-T3 | 07 | 5 | HARNESS-07 | T-091-26 | Operator applies migration 061 via SQL editor + regenerate full-schema (checkpoint, no db push/reset) | manual (checkpoint) | operator SQL-editor apply + `grep -c "research_summarize" supabase/full-schema.sql` ≥ 1 | checkpoint | ⬜ pending |
| (cross-cut) | 02/05/06 | 2-3 | HARNESS-06 (substrate) | T-091-06/11/19 | every transition/gate/refusal writes a harness_audit row | unit | folded into 02-T1 / 05-T3 / 06-T1 | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files (skeleton contracts created in Plan 01 Wave 1, flipped live by their owning plan):

- [ ] `backend/tests/test_harness_engine.py` — models (live in 01) + 5 phase-type dispatch + ordered transitions (02/03)
- [ ] `backend/tests/test_harness_resume.py` — 2-phase write + crash-leaves-active (02) + sweep/claim + ask_user resume (04)
- [ ] `backend/tests/test_harness_gates.py` — 4 validator kinds + bounded retry + short-circuit + caps (05)
- [ ] `backend/tests/test_harness_whitelist.py` — dispatch_tool refusal envelope + Deep-Mode no-op (06)
- [ ] `backend/tests/test_harness_reachability.py` — orphan/unsatisfiable-skip/no-terminal + 4 seeds lint clean (02/07)
- [ ] `backend/tests/test_harness_templates.py` — seeds parse + 5-type coverage + end-to-end mocked-LLM (07)
- [ ] `backend/tests/test_tool_budget.py` — get_tools max_tools cap + whitelist retention (06)
- [ ] `backend/tests/conftest.py` — ADD `mock_asyncpg_pool`, `fake_redis`, `make_tool_context`, `make_run_context`, `build_workflow_definition`/`four_seed_defs` (preserve existing `mock_redis`/`mock_supabase`/`anyio_backend`)

---

## Highest-Risk Surfaces — Deterministic Proof Required

| Surface | Owning Task | Deterministic proof |
|---------|-------------|---------------------|
| 2-phase write (HARNESS-03) | 02-T1, 02-T2 | via `mock_asyncpg_pool.calls`: assert the `status='active'` UPDATE index < `status='completed'` UPDATE index; simulate execute raising → assert NO `status='completed'` UPDATE for that phase (left active → sweep re-runs); `completed` phase skipped on re-run |
| ask_user resume (HARNESS-03) | 04-T2, 04-T3 | pending prompt → resume_pending_prompt re-SUBSCRIBES (subscribe xadd order before ask_user_prompt xadd in `fake_redis`) + re-emits; answered prompt → resume_pending_prompt NOT called (durable response-row check first) |
| whitelist refusal (HARNESS-05) | 06-T1 | `dispatch_tool('execute_code', {}, ctx(phase_whitelist={'search_documents'}))` → ToolResult.result JSON-parses to `{"error":"tool_not_available_in_phase","allowed":["search_documents"],...}`, raises no exception; `phase_whitelist=None` → guard skipped (byte-identical to pre-091 dispatch) |
| tool budget (TOOL-05) | 06-T2 | `apply_tool_budget(24 schemas, model with max_tools=8, whitelist of 2)` → exactly 8 returned, both whitelist tools present; model with no max_tools → all returned unchanged |
| bounded retry never loops (HARNESS-04) | 05-T3 | a gate configured to always fail terminates the run in exactly 3 attempts (max_retries=2) or 1 on identical output; pytest default timeout is the backstop the test must NOT hit |

---

## Manual-Only Verifications

> The 4-axis UAT scoreboard (SC#10) is MANDATORY for this phase — it touches the agent loop,
> provider routing, and streaming. Authored here; run LIVE against the operator backend during
> `/gsd:verify-work` (long-message + true uvicorn-restart-mid-workflow stay manual). The
> independent uvicorn-restart-mid-workflow kill-and-resume per phase type is Phase 096 (EVAL-02);
> Phase 091 provides the unit-level deterministic proof above (Plan 04). The 4 seed templates
> (migration 061, Plan 07) ARE the UAT fixtures.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider workflow run | HARNESS-01 / SC#10 | needs live provider keys + real LLM round-trips | Run the `research_summarize` seed workflow once per native provider (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/Zhipu, MiniMax); confirm the locked phase order completes and the final phase output is the chat message |
| Multi-tool in one phase | HARNESS-05 / SC#10 | needs live KB + sandbox | `research_summarize` llm_agent phase whitelist allows `search_documents` + `web_search`; confirm both dispatch and an out-of-whitelist `execute_code` call is cleanly refused with the D-04 guiding message (no provider 400 on any of the 7) |
| Parallel-thread isolation | HARNESS-05 / SC#10 | needs two concurrent live threads | Workflow run streaming in Thread A while Thread B accepts a Deep-Mode prompt; confirm the whitelist guard does not leak across threads (Deep Mode tools unrestricted in B — phase_whitelist=None) |
| Long-message survival | HARNESS-03 / SC#10 | needs a real long thread | A workflow phase with ≥50 prior messages OR a ≥5KB phase prompt survives the 2-phase write + completes |
| restart-mid-workflow smoke | HARNESS-03 / SC#10 | needs a real uvicorn restart | Start `doc_qa_human` (or any seed), kill uvicorn mid-phase, restart; confirm the startup sweep re-runs the active phase (and a mid-ask_user phase re-emits its prompt). Full independent proof = Phase 096 EVAL-02 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (7 skeleton files created in Plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-31 — every task has an `<automated>` verify or a Wave-0 dependency (the 7 skeleton files are created in Plan 01 Wave 1 and flipped live by their owning plans); no 3 consecutive tasks without automated verify; feedback latency < 60s; no watch-mode flags. The single `checkpoint:human-verify` (07-T3, migration apply) is operator-required (SQL-editor paste per CLAUDE.md migration discipline) and is not automatable.
