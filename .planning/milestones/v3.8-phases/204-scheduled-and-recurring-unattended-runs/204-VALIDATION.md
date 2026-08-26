---
phase: 204
slug: 204-scheduled-and-recurring-unattended-runs
date: 2026-08-24
---

# Phase 204: Scheduled & Recurring Unattended Runs — Validation Strategy

## Test Matrix

| Req ID | Target Capability | Verification Method | Automated Test Target |
|--------|-------------------|---------------------|-----------------------|
| `L-01` | Cross-Worker Run Cancellation (Producer Brake) | Unit/Integration Test | `backend/tests/unit/test_cross_worker_cancellation.py` |
| `SCHED-02` | Hard Spend-Cap & Token/Duration Circuit Breakers | Unit/Integration Test | `backend/tests/unit/test_scheduler_circuit_breaker.py` |
| `SCHED-01` | Cron/Interval Workflow Scheduler & RLS | Unit/Integration Test | `backend/tests/unit/test_workflow_scheduler.py` |

## Automated Verification Suite

1. **Cross-Worker Cancellation (L-01):**
   ```bash
   backend\venv\Scripts\python -m pytest backend/tests/unit/test_cross_worker_cancellation.py -v
   ```
   - Proves producer halts immediately upon cancel signal from another worker.
   - Proves provider call count does not increment after cancellation signal.

2. **Spend-Cap & Duration Circuit Breaker (SCHED-02):**
   ```bash
   backend\venv\Scripts\python -m pytest backend/tests/unit/test_scheduler_circuit_breaker.py -v
   ```
   - Proves token budget breach trips breaker, marks run `cancelled`, and stops subsequent phases.
   - Proves wall-clock duration limit trips breaker.

3. **Workflow Scheduler & Background Runner (SCHED-01):**
   ```bash
   backend\venv\Scripts\python -m pytest backend/tests/unit/test_workflow_scheduler.py -v
   ```
   - Proves schedule CRUD, next run calculations, skip-locked atomic claiming, and automated execution.
