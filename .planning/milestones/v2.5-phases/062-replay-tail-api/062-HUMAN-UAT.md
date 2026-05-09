---
status: partial
phase: 062-replay-tail-api
source: [062-VERIFICATION.md]
started: 2026-05-03T11:30:00Z
updated: 2026-05-03T11:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Browser two-tab multi-tab flow (SC#2 + SC#3 wall-clock)
expected: Open Tab A on a thread → send a long message → SSE streaming begins. In Tab B, call `GET /threads/{tid}/active-runs` (returns `[{run_id, started_at, status: 'streaming'}]`) then `GET /runs/{rid}/stream?since=0` — Tab B receives backlog replay then live-tails in sync with Tab A tokens. Both tabs show identical token sequences; reattach works without manual refresh.
why_human: Browser EventSource parsing, real Redis stream operation, and visual multi-tab token sync require a running dev environment.
result: [pending]

### 2. DELETE cancel wall-clock (SC#3 wall-clock)
expected: From Tab B, `fetch('/runs/{rid}', {method: 'DELETE', headers: {Authorization: 'Bearer <token>'}})` while Tab A is mid-stream. Both tabs receive `cancelled` terminal SSE event within ~5s; both streams close; subsequent `GET /threads/{tid}/active-runs` returns `[]`.
why_human: Requires real asyncio task cancellation over a real HTTP connection; mocks cannot verify the producer's CancelledError handler fires and the stream closes on real clients.
result: [pending]

### 3. TTL-expired buffer synthetic terminal (D-062-06 wall-clock)
expected: Complete a run; wait ~11 minutes for Redis buffer expiry (TTL=600s for completed); `GET /runs/{rid}/stream?since=0` returns exactly one synthetic SSE event `{type: "done", error: "buffer_expired", runs_status: "completed"}`; stream closes immediately, no hang.
why_human: Requires real 10-minute Redis TTL expiry; cannot be fast-path tested.
result: [pending]

### 4. Real Supabase RLS cross-user (SC#5 real backend)
expected: Authenticate as User A; start a stream (get run_id + thread_id). Authenticate as User B in a different session; call all three endpoints with User B's token against User A's IDs. `GET /threads/{tid}/active-runs` → 404 (NOTE: will actually surface CR-01 — see VERIFICATION.md gap; verify whether it 500s or 404s on real Postgres); `GET /runs/{rid}/stream` → 404; `DELETE /runs/{rid}` → 404.
why_human: Tests use mocked Supabase; real RLS enforcement requires a live Supabase connection.
result: [pending]

### 5. Redis-down wall-clock degradation (D-062-13 wall-clock)
expected: Stop Redis container (`docker compose -f docker-compose.dev.yml stop redis`); curl all three endpoints. `GET /runs/{rid}/stream` → HTTP 503 with `Retry-After: 10` header; `GET /threads/{tid}/active-runs` still returns 200 (Postgres-only path unaffected); `DELETE /runs/{rid}` → 204 (per-Redis-op try/except absorbs failures, Postgres UPDATE is the durable cancel record).
why_human: Wall-clock Redis container failure cannot be reproduced with mock fault injection alone.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
