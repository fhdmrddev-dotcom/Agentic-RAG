---
phase: 210-ground-truth-operability-and-failure-honesty
plan: 02
subsystem: api
tags: [CONN-10, CONN-11, backend, frontend, automations, schedules, circuit-breaker, budget-safety]
requires:
  - phase: 210-01
    provides: "GovernedFeature type union & Control Room live_connectors switch"
provides:
  - "WorkflowScheduleCreate default budgets increased to 500k tokens and 1800s"
  - "JSON string-scalar definition deserialization guard in launch_scheduled_run"
  - "Legacy budget lift in scheduler_service (50k -> 500k, 600s -> 1800s) preserving intentional low caps"
  - "Fallback to row['org_id'] when schedule row org_id is missing"
  - "trigger_schedule catches exceptions and returns structured ScheduleTriggerResult(launched=False, detail=...)"
  - "GET /features includes scheduler_process_enabled boolean"
  - "WorkflowScheduleModal warning banner when scheduler daemon is inactive"
  - "RunHero displays honest circuit breaker cancellation reasons"
affects: [210-03, 211]
tech-stack:
  added: []
  patterns:
    - "Fail-safe deserialization guard for JSONB string/dict polymorphism"
    - "Top-level infrastructure capabilities exposed on GET /features payload"
key-files:
  created:
    - backend/tests/unit/test_scheduler_string_guard.py
    - frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx
  modified:
    - backend/app/models/schedule.py
    - backend/app/services/scheduler_service.py
    - backend/app/api/schedules.py
    - backend/app/api/features.py
    - frontend/src/lib/api/_core.ts
    - frontend/src/lib/api/admin.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
    - frontend/src/components/workflows/RunHero.tsx
    - frontend/src/components/workflows/RunHero.test.tsx
key-decisions:
  - "D-210-04: Default schedule token budget is lifted from 50,000 to 500,000 and duration from 600 to 1,800 seconds."
  - "D-210-05: Legacy default budgets (exactly 50,000 tokens / 600s) in existing schedule records are lifted at launch time, avoiding accidental cancellation while preserving custom low caps."
  - "D-210-06: GET /features returns scheduler_process_enabled as a top-level sibling field, allowing WorkflowScheduleModal to warn users if the daemon is inactive without polluting the GovernedFeature union."
  - "D-210-07: Uncaught exceptions in manual trigger route return structured ScheduleTriggerResult(launched=False, detail=...) rather than unhandled 500."
patterns-established:
  - "Run deliverable hero displays precise circuit breaker metric readings when stopped by budget ceilings."
requirements-completed: [CONN-10, CONN-11]
duration: 20min
completed: 2026-08-26
---

# Phase 210 Plan 02: Automations Honesty, Token Budget & Trigger Hardening Summary

**Automations schedule defaults are lifted to 500k tokens and 1800s, launch execution is hardened against string-scalar definition rows and missing org_id, scheduler daemon status is honestly surfaced in the UI, and circuit breaker trip reasons are displayed on run deliverable surfaces.**

## Performance
- **Tasks:** 2 tasks completed (Backend + Frontend)
- **Files created:** 2 test suites
- **Files modified:** 11 files
- **Backend Tests:** 88/88 passed (`test_workflow_scheduler.py`, `test_scheduler_breaker_seam.py`, `test_scheduler_circuit_breaker.py`, `test_scheduler_string_guard.py`)
- **Frontend Typecheck:** 34 errors (exact baseline)
- **Count Gate:** OK (114/114 pinned, 0 failing, total 5798)

## Accomplishments
1. **Lifted Budget Defaults & Legacy Lift (CONN-10):** `WorkflowScheduleCreate` and `WorkflowScheduleModal` default to `500_000` tokens and `1_800` seconds. Legacy schedules stored with `50_000` tokens / `600` seconds are automatically lifted at launch time without touching intentional custom caps.
2. **Hardened Schedule Launch (CONN-11):** `launch_scheduled_run` deserializes string-scalar definition representations and resolves `row["org_id"]` fallback. `trigger_schedule` catches launch failures and returns structured responses.
3. **Surfaced Scheduler Daemon Status:** `GET /features` exposes `scheduler_process_enabled`. `WorkflowScheduleModal` renders an amber warning banner if the scheduler daemon is inactive.
4. **Honest Circuit Breaker Outcome Display:** `RunHero` inspects `run.metadata.circuit_breaker` on `cancelled` runs to display exact token or duration limit breach sentences.

## Verification
- `pytest tests/unit/test_scheduler_string_guard.py`: 3/3 passed.
- `vitest src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx src/components/workflows/RunHero.test.tsx`: 21/21 passed.
- `npx tsc --noEmit -p tsconfig.app.json`: 34 errors (baseline).
- `node scripts/vitest-count-gate.cjs`: OK 114/114 pinned, 0 failing, total 5798.
