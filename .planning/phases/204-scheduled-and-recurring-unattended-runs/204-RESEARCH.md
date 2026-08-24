# Phase 204: Scheduled & Recurring Unattended Runs — Research

**Gathered:** 2026-08-24
**Status:** Complete

## Technical Architecture & Findings

### 1. The L-01 Cross-Worker Cancellation Problem
When `WORKER_COUNT=2`, worker A handles the incoming HTTP cancellation request (`DELETE /runs/{id}` or `POST /threads/{id}/cancel`) and invokes `cancel_workflow_run_internals`, updating `workflow_runs.status = 'cancelled'`.
However, worker B holds the running `asyncio.Task` running `run_workflow` / `_run_phase_with_gates` / `agent_loop`. Because worker B does not poll the database mid-token or mid-provider call, it continues executing LLM calls until the end of the phase, wasting compute and budget.

**Solution:**
1. Redis Pub/Sub: Worker A executes `await redis.publish(f"run_cancel:{run_id}", "cancelled")` and sets `await redis.set(f"run_cancelled:{run_id}", "1", ex=86400)`.
2. In `harness_engine.py` and `run_producer.py`:
   - Before starting any phase, check `await redis.exists(f"run_cancelled:{run_id}")` or check run status.
   - For long-running subagent/provider calls, listen to the cancel channel concurrently using an `asyncio.TaskGroup` or cancellation listener wrapper (`with_cancel_listener`), aborting the task when the cancel signal fires.
   - On cancellation, clean up active phase gracefully without emitting further provider requests.

### 2. SCHED-02 Hard Spend-Cap & Token/Duration Circuit Breaker
Workflow execution collects token usage from each LLM completion and tool invocation.
- Define `CircuitBreaker` tracker passed through `ExecutionState` / `ctx`.
- When cumulative `input_tokens + output_tokens >= max_tokens_per_run` OR `elapsed_time >= max_duration_seconds`:
  - Log audit `circuit_breaker_tripped` with `{reason: 'spend_cap_exceeded' | 'duration_exceeded', tokens: count, limit: cap}`.
  - Automatically invoke `cancel_workflow_run_internals(pool, run_id)` and broadcast Redis cancel signal.
  - Immediately raise `CircuitBreakerTrippedError` so the execution loop halts without additional provider calls.

### 3. SCHED-01 Background Workflow Scheduler
- Store schedules in `workflow_schedules` table with `cron_expression`, `interval_seconds`, `timezone`, `max_tokens_per_run`, `max_duration_seconds`, `is_active`, `next_run_at`.
- Background scheduler loop (`SchedulerService`) runs every N seconds (e.g. 15–30s):
  - Claims due schedules atomically: `SELECT id, workflow_id, ... FROM workflow_schedules WHERE is_active = true AND next_run_at <= now() FOR UPDATE SKIP LOCKED`.
  - Computes `next_run_at = croniter(cron_expression, now).get_next(datetime)` (or adds `interval_seconds`).
  - Updates `last_run_at`, `next_run_at`, and `last_status`.
  - Spawns background unattended workflow run with configured input and circuit breaker limits.

---

## Validation Architecture

### Automated Verification
1. **L-01 Cross-Worker Cancellation:**
   - Simulate Worker A (canceller) and Worker B (runner) via dual async tasks / mock workers.
   - Verify that when Worker A calls cancel, Worker B intercepts the signal and cancels the in-flight provider mock, asserting 0 additional provider requests.
2. **SCHED-02 Circuit Breakers:**
   - Test workflow run with `max_tokens_per_run=1000`. Mock provider returning 1200 tokens.
   - Verify circuit breaker trips, run is marked `cancelled`, and subsequent phases are aborted.
   - Test workflow run with `max_duration_seconds=1`. Mock long operation.
   - Verify duration timeout trips and halts work cleanly.
3. **SCHED-01 Workflow Scheduler & Schema:**
   - Test CRUD endpoints for schedules.
   - Test cron evaluation (`0 9 * * 1`, `*/15 * * * *`) and interval math.
   - Test single-instance lock preventing double execution across multiple runner instances.
