---
phase: 081-seed-010-openrouter-uat
plan: 01
subsystem: testing
tags: [openrouter, kimi, minimax, timeout, uat, synthetic-timeout]

requires:
  - phase: 066-adaptive-run-timeouts-lifecycle-states
    provides: synthetic-timeout protocol (LLM_CALL_TIMEOUT_OVERRIDES, asyncio.wait_for, runs.status='timed_out')
  - phase: 076.1-provider-integration-ux-status-fidelity
    provides: OpenRouter model registrations (moonshotai/kimi-k2.5, minimax/minimax-m2.7)
provides:
  - Live UAT evidence that synthetic-timeout works on OpenRouter-routed providers
  - Closure of deferred 067.2 Rows 11-12 carry-forward
  - BUG-260526-02 scoped to direct Moonshot API only (not OpenRouter)
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/081-seed-010-openrouter-uat/081-HUMAN-UAT.md
    - .planning/phases/081-seed-010-openrouter-uat/081-01-SUMMARY.md
  modified:
    - backend/.env (temporary — restored to original after UAT)

key-decisions:
  - "BUG-260526-02 (Kimi thinking leakage) does NOT reproduce on OpenRouter route — scoped to direct Moonshot API only"

patterns-established: []

requirements-completed:
  - POLISH-SEED-010-01

duration: 25min
completed: 2026-05-27
---

# Phase 081: SEED-010 OpenRouter UAT Summary

**4/4 OpenRouter synthetic-timeout UAT runs GREEN — Kimi-k2.5 and MiniMax-m2.7 both produce clean `timed_out` status under 10s per-call budget via OpenRouter**

## Performance

- **Duration:** ~25 min (including operator restart cycles and port conflict diagnosis)
- **Started:** 2026-05-27
- **Completed:** 2026-05-27
- **Tasks:** 5 (2 auto + 2 human-action checkpoints + 1 human-verify)
- **Files modified:** 2 (081-HUMAN-UAT.md created, backend/.env temporary change restored)

## Accomplishments

- All 4 UAT runs confirmed: `runs.status='timed_out'` with clean error format `timed_out: 10s per-call deadline exceeded at iteration N (model=...)` — no `GeneratorExit`
- Frontend correctly displays timeout state (run card badge, "Agent reached time limit" text, Resume button) for all 4 runs
- Title generation works for all 4 timed-out runs (separate LLM call succeeds despite main run timeout)
- BUG-260526-02 (Kimi thinking text leakage) not observed on OpenRouter route — bug is direct Moonshot API specific

## UAT Evidence

| Row | Model | Run ID | DB Status | Iteration | Title Generated |
|-----|-------|--------|-----------|-----------|-----------------|
| 1 | moonshotai/kimi-k2.5 (simple) | `908df10a` | `timed_out` | 2 | "Evolution of Artificial Intelligence: Key Milestones" |
| 2 | moonshotai/kimi-k2.5 (tools) | `1519d249` | `timed_out` | 4 | "Machine Learning Research Summary Findings" |
| 3 | minimax/minimax-m2.7 (simple) | `5838affc` | `timed_out` | 1 | "Evolution of Artificial Intelligence: 1950s to Present" |
| 4 | minimax/minimax-m2.7 (tools) | `7b873a9e` | `timed_out` | 0 | "Comprehensive Machine Learning Research Summary" |

## Files Created/Modified

- `.planning/phases/081-seed-010-openrouter-uat/081-HUMAN-UAT.md` — UAT scoreboard with 4/4 GREEN verdicts and full 3-layer evidence
- `.planning/phases/081-seed-010-openrouter-uat/081-01-SUMMARY.md` — This summary
- `backend/.env` — Temporary `LLM_CALL_TIMEOUT_OVERRIDES` change (kimi-k2.5=10, minimax-m2.7=10), restored to original values after UAT

## Decisions Made

- BUG-260526-02 does not reproduce on OpenRouter route — no update to reported-bugs needed; scope remains direct Moonshot API only

## Deviations from Plan

None — plan executed as specified.

## Issues Encountered

- Port 8000 had a stale uvicorn process from a prior session (PID 62628 with orphaned worker children). Required killing the old process before the new uvicorn could serve requests. Resolved by terminating the child workers.

## Next Phase Readiness

- POLISH-SEED-010-01 closed — both OpenRouter-routed models produce clean `timed_out` status
- 067.2 Rows 11-12 carry-forward fully closed with live UAT evidence
- .env restored, ready for normal operation after operator restarts uvicorn

---
*Phase: 081-seed-010-openrouter-uat*
*Completed: 2026-05-27*
