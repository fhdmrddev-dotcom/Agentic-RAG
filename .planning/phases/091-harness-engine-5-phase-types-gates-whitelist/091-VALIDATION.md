---
phase: 091
slug: harness-engine-5-phase-types-gates-whitelist
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 091 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `091-RESEARCH.md` § Validation Architecture (lines 576–620). The planner
> populates the Per-Task Verification Map once plan/task IDs exist.

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
| **Shared fixtures** | `backend/tests/conftest.py` — `mock_redis`, `mock_supabase`, `anyio_backend` |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/ -x -q`
- **After every plan wave:** Run the full suite `cd backend && venv/Scripts/python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Planner fills this once task IDs are assigned. Each row maps a task → requirement → an
> automated grep/test command. Seeded requirement→test mapping below from RESEARCH.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | HARNESS-01 | — | 5 phase executors drive their substrate; full workflow runs end-to-end | unit+integration | `pytest tests/test_harness_engine.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HARNESS-03 | T-091-resume | phase left `active` re-runs on resume; `completed` skipped; no double-commit | unit+integration | `pytest tests/test_harness_resume.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HARNESS-04 | — | each gate kind pass/fail; retry bounded (max_retries=2 → 3 attempts); consec-identical short-circuit | unit | `pytest tests/test_harness_gates.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HARNESS-05 | T-091-whitelist | out-of-whitelist refused with clean `tool_result` (matching `tool_call_id`); Deep Mode literal no-op | unit+integration | `pytest tests/test_harness_whitelist.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HARNESS-07 | — | each seed template runs end-to-end; all 5 phase types exercised | integration | `pytest tests/test_harness_templates.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOOL-05 | T-091-budget | `get_tools()` caps at `max_tools`; whitelist tools always retained | unit | `pytest tests/test_tool_budget.py -q` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | (cross-cut) audit | — | every transition/gate/refusal writes a `harness_audit` row | unit | folded into above | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files (it.todo()/skeleton contracts at Wave 0, flipped live by their owning plan):

- [ ] `backend/tests/test_harness_engine.py` — 5 phase-type executors + end-to-end state-machine drive (HARNESS-01)
- [ ] `backend/tests/test_harness_resume.py` — 2-phase write + kill-and-resume idempotency (HARNESS-03, highest risk)
- [ ] `backend/tests/test_harness_gates.py` — 4 validator kinds + bounded retry + short-circuit (HARNESS-04)
- [ ] `backend/tests/test_harness_whitelist.py` — dispatch_tool refusal envelope + Deep-Mode no-op (HARNESS-05)
- [ ] `backend/tests/test_harness_templates.py` — seed templates run end-to-end (HARNESS-07)
- [ ] `backend/tests/test_tool_budget.py` — get_tools max_tools cap + whitelist retention (TOOL-05)
- [ ] Reuse existing `backend/tests/conftest.py` fixtures (`mock_redis`, `mock_supabase`); add a `mock_workflow_run` fixture if needed

---

## Highest-Risk Surfaces — Deterministic Proof Required

| Surface | Deterministic proof |
|---------|---------------------|
| 2-phase write (HARNESS-03) | insert phase row `active`, simulate restart (re-invoke resume), assert re-run with NO double side-effect; `completed` phase skipped |
| ask_user resume (D-091-10) | pending prompt persisted → resume re-SUBSCRIBES + re-emits; answered prompt is NOT re-asked (durable response-row check first) |
| whitelist refusal (HARNESS-05) | per-provider envelope unit test: refused `tool_result` has matching `tool_call_id`, raises no exception, no provider 400 |
| tool budget (TOOL-05) | `get_tools()` with >max_tools tools → exactly `max_tools` returned, whitelist subset always present |

---

## Manual-Only Verifications

> The 4-axis UAT scoreboard (SC#10) is MANDATORY for this phase — it touches the agent loop,
> provider routing, and streaming. Authored here; run LIVE against the operator backend during
> `/gsd:verify-work` (long-message + true uvicorn-restart-mid-workflow stay manual). The
> independent uvicorn-restart-mid-workflow kill-and-resume per phase type is Phase 096 (EVAL-02);
> Phase 091 provides the unit-level deterministic proof above.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider workflow run | HARNESS-01 / SC#10 | needs live provider keys + real LLM round-trips | Run the Research→Summarize seed workflow once per native provider (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM, MiniMax); confirm locked phase order completes |
| Multi-tool in one phase | HARNESS-05 / SC#10 | needs live KB + sandbox | Research→Summarize `llm_agent` phase calls `search_documents` + `web_search` + `execute_code`; confirm whitelist allows all three, refuses an out-of-whitelist tool with the D-04 guiding message |
| Parallel-thread isolation | HARNESS-05 / SC#10 | needs two concurrent live threads | Workflow run streaming in Thread A while Thread B accepts a Deep-Mode prompt; confirm whitelist guard does not leak across threads (Deep Mode tools unrestricted in B) |
| Long-message survival | HARNESS-03 / SC#10 | needs a real long thread | A workflow phase with ≥50 prior messages OR ≥5KB prompt survives the 2-phase write + completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
