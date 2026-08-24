# Phase 204: Scheduled & Recurring Unattended Runs — Context

**Gathered:** 2026-08-24
**Status:** Ready for execution
**Source:** Autonomous GSD Execution (SCHED-01, SCHED-02, L-01)

<domain>
## Phase Boundary

Phase 204 provides unattended background scheduling for published workflows with strict spend caps and duration limits, and delivers the load-bearing cross-worker cancellation brake (L-01) that actually halts producer execution and provider calls when a run is cancelled or trips its circuit breaker.

</domain>

<decisions>
## Implementation Decisions

### 1. Cross-Worker Producer Cancellation Brake (L-01)
- **D-204-01 (Redis Cancel Pub/Sub & Registry):** Cancellation is published to Redis channel `run_cancel:{run_id}` and stored in key `run_cancelled:{run_id}` with TTL (24h) when `cancel_workflow_run_internals` or manual Stop is invoked.
- **D-204-02 (Immediate Producer Abort):** The harness engine and subagent loops subscribe to the cancellation signal or check `is_run_cancelled(run_id)` before/during phase execution and prior to each LLM provider call. When received, the in-flight task is cancelled (`asyncio.Task.cancel()`) and no further provider requests are issued.
- **D-204-03 (Single Unified Stop Path):** Both manual Stop (via chat or workflow UI) and automated circuit breakers share the exact same `cancel_workflow_run_internals` + Redis cancel channel mechanism, preventing drift.
- **D-204-04 (Multi-Worker Concurrency):** Tested and verified at `WORKER_COUNT=2` where worker A triggers cancellation and worker B running the producer halts provider calls immediately.

### 2. Spend Caps & Duration Circuit Breaker (SCHED-02)
- **D-204-05 (Real-Time Budget Rollup):** Workflow runs track cumulative input and output tokens across all phases and tool steps in real time.
- **D-204-06 (Circuit Breaker Enforcement):** When a run exceeds `max_tokens_per_run` (token budget cap) or `max_duration_seconds` (wall-clock duration limit), the circuit breaker trips immediately.
- **D-204-07 (Durable Terminalization on Trip):** Tripping the breaker invokes the cancel brake, writes status `cancelled` via `finish_run`, logs a `circuit_breaker_tripped` event in `harness_audit_log`, and records the trip reason in `workflow_runs.metadata`.

### 3. Background Workflow Scheduler Service (SCHED-01)
- **D-204-08 (Database Schema):** Migration `124_workflow_schedules.sql` creates `workflow_schedules` with columns: `id`, `org_id`, `workflow_id`, `user_id`, `name`, `cron_expression`, `interval_seconds`, `timezone`, `is_active`, `max_tokens_per_run`, `max_duration_seconds`, `inputs`, `last_run_at`, `next_run_at`, `last_status`, `created_at`, `updated_at`.
- **D-204-09 (Single-Instance Advisory Lock):** Schedulers across multiple uvicorn workers or distributed processes synchronize via Postgres advisory lock (`pg_try_advisory_xact_lock` or `SELECT ... FOR UPDATE SKIP LOCKED`) so each due schedule is triggered exactly once.
- **D-204-10 (Schedule Evaluation):** Schedule due calculation uses standard `croniter` and interval time math against the configured timezone (defaulting to UTC).
- **D-204-11 (REST API & Frontend):** Full CRUD REST endpoints at `/api/schedules` and `/api/workflows/{workflow_id}/schedules` paired with a modal in the Workflows / Studio UI for configuring schedules and budget limits.

</decisions>

<canonical_refs>
## Canonical References

- `backend/app/db/workflows.py` — `finish_run`, `cancel_active_phases`, and workflow state machine
- `backend/app/services/run_lifecycle.py` — `cancel_workflow_run_internals` and run cancellation composition
- `backend/app/services/harness_engine.py` — `run_workflow` execution loop, phase transitions, and gate handling
- `backend/app/services/run_producer.py` — Producer task lifecycle and terminal status handling
- `supabase/migrations/124_workflow_schedules.sql` — Schedule schema and RLS policies
- `backend/app/services/scheduler_service.py` — Background poller and schedule execution engine

</canonical_refs>
