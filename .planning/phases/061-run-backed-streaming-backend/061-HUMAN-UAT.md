---
status: partial
phase: 061-run-backed-streaming-backend
source: [061-VERIFICATION.md]
started: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tab A streaming + clean disconnect — producer survives
expected: Tab A sends a long message triggering a slow multi-tool agent loop; SSE events flow; close Tab A entirely; backend logs show consumer finally completed with no `task.cancel()` call
result: [pending]

### 2. Producer continues XADDing after consumer disconnect
expected: Wait 30 seconds after Tab A close; backend logs show producer still XADDing; `redis-cli XLEN run:{id}` shows the stream growing
result: [pending]

### 3. Tab B reattach — completed assistant message visible
expected: Open Tab B on same thread; `loadMessages` reflects the completed assistant message
result: [pending]

### 4. Full event replay via XRANGE — terminal sentinel present
expected: `redis-cli XRANGE run:{run_id} - +` shows all events including the terminal `done` sentinel
result: [pending]

### 5. runs row terminal status (success path)
expected: `psql -c "SELECT status, error, completed_at FROM public.runs WHERE thread_id='...'"` returns `status='completed'`, `completed_at` non-null, `error` NULL
result: [pending]

### 6. Redis EXPIRE 600 (completed) — TTL cleanup
expected: Wait 11 minutes; `redis-cli XLEN run:{id}` returns 0 (key expired); `public.runs` row still exists in Postgres (durable)
result: [pending]

### 7. Hard timeout path (D-061-01) — runs row + TTL
expected: Set `RUN_HARD_TIMEOUT_SECONDS=10` in `backend/.env`; send a slow message; Redis entry has `type='error' error='hard_timeout'`; runs row `status='failed' error='hard_timeout'`; `redis-cli TTL run:{id}` returns ≤ 60
result: [pending]

### 8. Hard timeout path — abandoned-run bound enforced
expected: Producer body bounded at the configured `run_hard_timeout_seconds`; no producer task lingers past the timeout deadline; `RUN_TASKS` registry self-evicts
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
