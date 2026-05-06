---
phase: 066-adaptive-run-timeouts-lifecycle-states
status: pending  # → partial | approved
reviewed_at: null
project_level_approval: pending  # → approved | blocked
---

# Phase 066 — HUMAN-UAT Scoreboard

## Summary

Phase 066 closed Gap-006 (LLM agent stops mid-iteration on complex
tool-call prompts). Replaced 120s total-deadline `asyncio.timeout` wrapper
with per-LLM-call budget that resets on tool-call boundaries; split
`cancelled` (user-Stop) vs `timed_out` (system per-call deadline) lifecycle
states; SDK stream closes cleanly on `TimeoutError` so LangSmith trace ends
without `GeneratorExit`.

This UAT verifies the user-visible behavior end-to-end with a real LLM,
real tools (sandbox / web_search / sub-agent / execute_code), and live
LangSmith trace inspection.

## Pre-flight Environment

| Property | Value |
|----------|-------|
| Frontend | http://localhost:5173/ — UP at UAT start |
| Backend | http://localhost:8000/health — UP at UAT start |
| Active model | `gpt-4o` (from `backend/.env` `LLM_MODEL` / Settings.llm_model) |
| Per-call budget (effective) | `180s` (from `get_per_call_timeout("gpt-4o", settings)` — D-066-03 default bucket "default (capable)") |
| `consumer_timeout_seconds` | `610` (replay-tail consumer deadline; independent of producer per-call budget) |
| `LLM_CALL_TIMEOUT_OVERRIDES` (raw) | `""` (no overrides — falls through to per-model default) |
| Legacy stopgap `RUN_HARD_TIMEOUT_SECONDS` | `600` in `backend/.env` (no-op per D-066-12; Pydantic `extra="ignore"` silently drops it) |

## Success Criteria Scoreboard

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| SC#1 | Complex multi-tool agent ("search → report → charts → docx") completes end-to-end | pending | _Filled by Task 1 below_ |
| SC#2 | Per-LLM-call timer fires within ε of budget; tool exec outside budget | green | Plan 04 `test_066_per_call_timer.py` (4 tests, all pass — committed in `9b9fba9` / `4b23a3e`) |
| SC#3 | `runs.status` admits 5 values; Pydantic Literal mirrors | green | Plan 04 `test_066_status_enum.py` (4 tests, all pass) + Plan 01 Task 2 SQL editor smoke test (status='timed_out' INSERT then ROLLBACK succeeded) |
| SC#4 | `runs.error` non-NULL with discriminator prefix on every non-completed terminal | green | Plan 04 `test_066_terminal_classification.py` (3 tests, all pass — including `test_delete_writes_cancelled_not_timed_out` partition guard) |
| SC#5 | SSE consumer receives distinct `timed_out` terminal event | green | Plan 04 `test_066_sse_terminal.py` (2 tests, all pass) |
| SC#6 | Frontend renders "Agent reached time limit" banner + Resume on `timed_out` | pending | _Filled by Task 2 below (synthetic timeout run)_ |
| SC#7 | LangSmith trace shows clean termination (no `GeneratorExit`) | partial | Plan 04 `test_066_langsmith_clean.py` (1 test green) — _live LangSmith dashboard inspection filled by Task 2 below_ |
| Gap-006 regression | User's verbatim prompt completes end-to-end | pending | _Filled by Task 1 below_ |

## Evidence

### SC#1 + Gap-006 regression

_Awaiting Task 1 run._

### SC#6 + SC#7 (live)

_Awaiting Task 2 run._

## Gaps

_None at the start of Phase 066 UAT. Add as Gap-NNN format if encountered._

## Sign-off

- [ ] All ROADMAP success criteria green or carry-forward-with-justification
- [ ] Gap-006 regression confirmed closed by re-running the user's prompt
- [ ] LangSmith trace inspection shows no `GeneratorExit` on synthetic-timeout run
- [ ] STATE.md updated to reflect Phase 066 closure (orchestrator owns this — not Plan 05)
