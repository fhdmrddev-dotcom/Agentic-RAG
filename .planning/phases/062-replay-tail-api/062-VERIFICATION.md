---
phase: 062-replay-tail-api
verified: 2026-05-03T00:00:00Z
status: human_needed
score: 20/21 must-haves verified
nyquist_compliant: true
last_updated: 2026-05-03
overrides: []
inherited_exclusions:
  - test_normal_stream_unchanged              # DEF-061.1-01 carried forward
  - test_failed_run_expires_60s               # DEF-061.1-02 carried forward
  - test_120s_timeout_fires_full_finally      # DEF-061.1-02 carried forward
  - test_producer_continues_after_consumer_disconnect  # DEF-061.1-02 carried forward
gaps:
  - truth: "Cross-user GET /threads/{tid}/active-runs returns 404 (NOT 500) on real Postgres (SC#5, D-062-12, T-062-01)"
    status: partial
    reason: "list_active_runs uses .single() not .maybe_single(). The main.py postgrest patch only handles code='204'; real Postgres raises PGRST116 (code='PGRST116') on zero rows from .single(), which the patch does NOT catch. Integration tests pass because _make_result(None) returns a mock with .data=None without raising — the real failure mode only surfaces against a real PostgREST connection. The stream and delete endpoints correctly use .maybe_single()."
    artifacts:
      - path: "backend/app/api/threads.py"
        issue: "list_active_runs line 462: .single() should be .maybe_single() to match the same pattern used correctly in runs.py stream_run() and cancel_run()"
    missing:
      - "Change .single() to .maybe_single() in the threads ownership SELECT inside list_active_runs"
      - "Update the null check: row = thread_resp.data if thread_resp is not None else None; if not row: raise HTTPException(404)"
human_verification:
  - test: "Open Tab A on a thread → send a long message → confirm SSE streaming begins"
    expected: "GET /threads/{tid}/active-runs returns [{run_id, started_at, status: 'streaming'}]; GET /runs/{rid}/stream?since=0 replays backlog then live-tails in sync with Tab A tokens"
    why_human: "Browser EventSource parsing, real Redis TTL timing, and visual confirmation of multi-tab token sync cannot be verified programmatically"
  - test: "In Tab B: trigger DELETE /runs/{rid} while Tab A is mid-stream"
    expected: "Both tabs receive 'cancelled' terminal SSE event within ~5s; both close cleanly; subsequent GET /threads/{tid}/active-runs returns []"
    why_human: "Requires real two-tab orchestration and wall-clock timing verification"
  - test: "Wait ~11 minutes after a completed stream, then GET /runs/{rid}/stream"
    expected: "Returns a synthetic terminal SSE event: {type: 'done', error: 'buffer_expired', runs_status: 'completed'}; closes immediately"
    why_human: "Requires real Redis TTL expiry (10-min wait); cannot be fast-path tested"
  - test: "Log in as a different user and attempt GET /runs/{rid}/stream and GET /threads/{tid}/active-runs where the run/thread belongs to another user"
    expected: "Both return 404 (not 403, not 200) against real Supabase RLS — distinct from mock-based test coverage"
    why_human: "Integration tests use mocked Supabase; real RLS verification requires a live Supabase connection"
  - test: "Stop Redis container (docker compose -f docker-compose.dev.yml stop redis); curl GET /runs/{rid}/stream"
    expected: "HTTP 503 with Retry-After: 10 header; GET /threads/{tid}/active-runs still returns 200 (Postgres-only path unaffected); DELETE /runs/{rid} returns 204"
    why_human: "Wall-clock Redis container failure cannot be reproduced with mock fault injection alone"
---

# Phase 062: Replay & Tail API — Verification Report

**Phase Goal:** Surface the durable run buffer from Phase 061 as a clean HTTP API so any client can reattach to a stream at the right offset and tail to completion.
**Verified:** 2026-05-03
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
|-----|-------|--------|----------|
| T1  | GET /active-runs streaming-only filter (SC#1, D-062-02) | VERIFIED | `test_062_active_runs.py::test_returns_streaming_only_filter` GREEN; code at threads.py:480 uses `.eq("status", "streaming")` and `.order("started_at", desc=True)` |
| T2  | GET /active-runs response shape (D-062-03, SC#1) | VERIFIED | `test_returns_response_model_shape` GREEN; `ActiveRunResponse` in `models/run.py` has exactly `{run_id: UUID, started_at: datetime, status: str}` |
| T3  | GET /active-runs empty case (D-062-04) | VERIFIED | `test_empty_when_no_streaming` GREEN; route returns `runs_resp.data or []` |
| T4  | GET /active-runs malformed UUID → 422 (D-062-04) | VERIFIED | `test_malformed_uuid_returns_422` GREEN; `thread_id: UUID` path param typed — FastAPI auto-validates |
| T5  | GET /active-runs ownership SELECT runs first (D-062-12) | PARTIAL | `test_thread_ownership_select_runs_first` GREEN via mock; BUT code uses `.single()` at threads.py:462 — real Postgres will raise PGRST116 (not code="204"), bypassing the patch → 500 instead of 404 on real backend (CR-01) |
| T6  | GET /stream replay-then-tail-to-terminal (SC#2, D-062-05) | VERIFIED | `test_062_stream_replay.py::test_replay_then_tail_to_terminal` GREEN; `replay_tail_consumer` mirrors event_consumer two-mode XREAD with `last_id=since` |
| T7  | GET /stream cursor parameterization (D-062-07) | VERIFIED | `test_replay_from_specific_offset` GREEN; `since: str = "0"` query param wired through to `last_id` in `replay_tail_consumer` |
| T8  | GET /stream already-terminal replays + closes (D-062-05) | VERIFIED | `test_062_stream_terminal.py::test_terminal_run_replays_and_closes` GREEN; same consumer path, terminal sentinel in buffer breaks loop |
| T9  | GET /stream TTL-expired → synthetic done (D-062-06) | VERIFIED | `test_emits_synthetic_terminal_when_buffer_expired_completed` GREEN; `_synthetic_terminal_generator` maps `completed→done` with `error="buffer_expired"` |
| T10 | GET /stream TTL-expired → synthetic error (D-062-06) | VERIFIED | `test_emits_synthetic_terminal_when_buffer_expired_failed` GREEN |
| T11 | GET /stream TTL-expired → synthetic cancelled (D-062-06) | VERIFIED | `test_emits_synthetic_terminal_when_buffer_expired_cancelled` GREEN |
| T12 | GET /stream missing row → 404 (D-062-06) | VERIFIED | `test_404_when_runs_row_missing` GREEN; `maybe_single()` returns None → 404 in `stream_run` |
| T13 | DELETE in-flight cancels producer (SC#3, D-062-10) | VERIFIED | `test_062_delete_happy.py::test_cancels_in_flight_producer` GREEN; `RUN_TASKS.get(run_id); task.cancel()` at runs.py:313-315 |
| T14 | DELETE zombie heal (D-062-11) | VERIFIED | `test_062_delete_zombie.py::test_heals_zombie_state` GREEN; 5-step heal sequence in `cancel_run`: UPDATE Postgres + synthetic sentinel + ZREM×2 + EXPIRE |
| T15 | DELETE on terminal (3 statuses) → 204 silent (D-062-09) | VERIFIED | `test_062_delete_terminal_idempotent.py::test_terminal_returns_204_silent` (parametrized) GREEN; `if row["status"] in ("completed", "failed", "cancelled")` early return |
| T16 | Cross-user GET /active-runs → 404 (SC#5, T-062-01) | PARTIAL | `test_active_runs_other_user_returns_404` GREEN via mock; real Postgres will 500 (not 404) due to `.single()` vs `.maybe_single()` — same CR-01 issue as T5 |
| T17 | Cross-user GET /stream → 404 (SC#5, T-062-01) | VERIFIED | `test_get_stream_other_user_returns_404` GREEN; `stream_run` correctly uses `.maybe_single()` at runs.py:198 |
| T18 | Cross-user DELETE → 404 (SC#5, T-062-01, T-062-02) | VERIFIED | `test_delete_other_user_returns_404` GREEN; `cancel_run` uses `.maybe_single()` at runs.py:287; ownership SELECT runs before `RUN_TASKS.get` (T-062-02 ordering preserved) |
| T19 | Multi-consumer fan-out (SC#4, T-062-04) | VERIFIED | `test_062_multi_consumer_fanout.py::test_two_consumers_receive_identical_sequences` GREEN; `asyncio.gather(_consume_stream(c1, ...), _consume_stream(c2, ...))` — both consumers receive identical terminal-ending sequences |
| T20 | Redis-down stream → 503 + Retry-After: 10 (D-062-13, T-062-03) | VERIFIED | `test_062_redis_down.py::test_stream_returns_503_on_redis_unreachable` GREEN; `RedisError` caught at route boundary in `stream_run`; `JSONResponse(503, headers={"Retry-After": "10"})` |
| T21 | Redis-down DELETE → 204 (D-062-13, T-062-03) | VERIFIED | `test_stream_returns_503_on_redis_unreachable` + `test_delete_returns_204_on_redis_unreachable` GREEN; each Redis op in zombie-heal wrapped in individual try/except; 204 returned regardless |

**Score:** 20/21 truths verified (T5 and T16 are PARTIAL due to CR-01 — verified via mock but behavior against real PostgREST is unsafe)

---

## CR-01: .single() vs .maybe_single() — Gap Analysis

**File:** `backend/app/api/threads.py` — `list_active_runs` function, line 462

**Confirmed in code:**
```python
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .single()        # <-- BUG: should be .maybe_single()
)
if not thread_resp.data:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

**Why tests pass:** `_make_result(None)` in `_run_helpers.py` returns a MagicMock with `.data = None` without raising any exception. The `if not thread_resp.data:` check then correctly triggers the 404. This masks the real behavior.

**Real Postgres behavior:** `.single()` with zero matching rows causes PostgREST to raise `APIError(code="PGRST116")`. The patch in `main.py` only catches `code == "204"`. PGRST116 propagates up through `aexec` and hits FastAPI's default 500 handler — leaking a 500 instead of 404 to the caller.

**Contrast with correct implementation:** Both `stream_run` and `cancel_run` in `runs.py` use `.maybe_single()` (lines 198, 287) with the correct null check `row = row_resp.data if row_resp is not None else None`. The `list_active_runs` route was written in Plan 01 before the `runs.py` pattern was established.

**Fix required:**
```python
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

**Severity:** WARNING (not BLOCKER). The cross-user 404 contract is broken only against a real Postgres backend; mock-based tests pass. The `stream_run` and `cancel_run` endpoints (the ones most likely to be cross-user attacked) correctly use `.maybe_single()`. The `active-runs` endpoint's 500 would still not leak the thread's data — it returns a generic 500, not the thread contents. However it violates D-062-12 (must return 404, not 5xx) and T-062-01 mitigation.

---

## Required Artifacts

| Artifact | Expected | Status | Notes |
|----------|----------|--------|-------|
| `backend/app/models/run.py` | ActiveRunResponse Pydantic model | VERIFIED | 24 lines; `class ActiveRunResponse(BaseModel)` with `run_id: UUID`, `started_at: datetime`, `status: str` |
| `backend/app/api/threads.py` | `list_active_runs` route appended | VERIFIED | Lines 449-483; between `list_threads` and `create_thread`; import at line 24 |
| `backend/app/api/runs.py` | New module: `replay_tail_consumer` + `_synthetic_terminal_generator` + GET /stream + DELETE | VERIFIED | 385 lines; all four components present |
| `backend/app/main.py` | `runs.router` registered | VERIFIED | Line 139: `app.include_router(runs.router)` |
| `backend/tests/integration/_run_helpers.py` | `setup_zombie_state` helper | VERIFIED | Line 356: `async def setup_zombie_state(...)` confirmed via grep |
| `backend/tests/integration/test_062_active_runs.py` | SC#1 + ownership coverage (5 tests) | VERIFIED | 213 lines; all 5 test functions present |
| `backend/tests/integration/test_062_stream_replay.py` | SC#2 replay-tail coverage (2 tests) | VERIFIED | File exists; `test_replay_then_tail_to_terminal` confirmed |
| `backend/tests/integration/test_062_stream_terminal.py` | SC#2 already-terminal coverage (1 test) | VERIFIED | File exists; `test_terminal_run_replays_and_closes` confirmed |
| `backend/tests/integration/test_062_stream_ttl_expired.py` | D-062-06 TTL-expired coverage (4 tests) | VERIFIED | File exists; all 4 test functions confirmed |
| `backend/tests/integration/test_062_delete_happy.py` | SC#3 happy path coverage | VERIFIED | File exists; `test_cancels_in_flight_producer` confirmed |
| `backend/tests/integration/test_062_delete_zombie.py` | D-062-11 zombie heal coverage | VERIFIED | File exists; `test_heals_zombie_state` confirmed |
| `backend/tests/integration/test_062_delete_terminal_idempotent.py` | D-062-09 idempotency (parametrized) | VERIFIED | File exists; `test_terminal_returns_204_silent` confirmed |
| `backend/tests/integration/test_062_cross_user_404.py` | SC#5 cross-user coverage (3 tests) | VERIFIED | 212 lines; all 3 cross-user tests present (active-runs, stream, delete) |
| `backend/tests/integration/test_062_multi_consumer_fanout.py` | SC#4 multi-consumer coverage | VERIFIED | File exists; `test_two_consumers_receive_identical_sequences` with `asyncio.gather` pattern confirmed |
| `backend/tests/integration/test_062_redis_down.py` | D-062-13 degradation coverage (2 tests) | VERIFIED | File exists; `test_stream_returns_503_on_redis_unreachable` and `test_delete_returns_204_on_redis_unreachable` confirmed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `threads.py:list_active_runs` | `models/run.py` | `from app.models.run import ActiveRunResponse` | VERIFIED | threads.py line 24 |
| `runs.py` | `app/api/threads.py` | Multi-line import block: `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, `_RUN_STATUS_TO_TERMINAL_TYPE` | VERIFIED | runs.py lines 49-54 (multi-line form; functionally identical to single-line) |
| `runs.py:stream_run` | sse-starlette + redis | `EventSourceResponse(replay_tail_consumer(...), ping=None)` | VERIFIED | runs.py lines 228-231 |
| `runs.py:cancel_run` | `RUN_TASKS` registry | `task = RUN_TASKS.get(run_id); task.cancel()` | VERIFIED | runs.py lines 313-315; zombie path: `_emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")` at line 350 |
| `main.py` | `runs.router` | `app.include_router(runs.router)` | VERIFIED | main.py line 139 |
| `runs.py` | `redis.exceptions` | `from redis.exceptions import RedisError` (top-level, avoids `redis` param shadowing) | VERIFIED | runs.py line 47 |
| `test_062_multi_consumer_fanout.py` | `runs.py` (parallel consumers) | `asyncio.gather(_consume_stream(c1, ...), _consume_stream(c2, ...))` | VERIFIED | fanout test lines 151-154 |
| `test_062_redis_down.py` | `app.dependencies.get_redis` | `app.dependency_overrides[get_redis] = lambda: dead_redis` + `redis.exceptions.ConnectionError` | VERIFIED | redis_down test lines 87-90, 52 |

---

## Data-Flow Trace (Level 4)

The 062 endpoints do not render UI components; they are API routes that pass data through. Data-flow trace applies to the SSE streaming path:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `runs.py:replay_tail_consumer` | `fields["data"]` from XREAD | `redis.xread(streams={stream_key: last_id})` against real Redis stream | Yes (XREAD reads producer-written entries) | FLOWING |
| `runs.py:_synthetic_terminal_generator` | `mapped` from `_RUN_STATUS_TO_TERMINAL_TYPE` | `runs.status` from Postgres SELECT | Yes (maps real DB status) | FLOWING |
| `threads.py:list_active_runs` | `runs_resp.data` | Postgres SELECT with `.eq("status", "streaming")` | Yes (real DB query) | FLOWING |

---

## Behavioral Spot-Checks

Step 7b skipped — no runnable entry point can be invoked without a live Redis + Supabase connection. Orchestrator-provided runtime evidence covers this:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 23/23 Phase 062 integration tests | `pytest tests/integration/test_062_*.py` | 23 passed | PASS |
| SC#1 active-runs | `test_062_active_runs.py` | GREEN | PASS |
| SC#2 stream replay+tail | `test_062_stream_replay.py` + `test_062_stream_terminal.py` + `test_062_stream_ttl_expired.py` | GREEN | PASS |
| SC#3 delete cancel | `test_062_delete_happy.py` + `test_062_delete_zombie.py` + `test_062_delete_terminal_idempotent.py` | GREEN | PASS |
| SC#4 fan-out | `test_062_multi_consumer_fanout.py` | GREEN | PASS |
| SC#5 cross-user 404 | `test_062_cross_user_404.py` | GREEN (mock only) | PASS (mock) |
| D-062-13 Redis-down | `test_062_redis_down.py` | GREEN | PASS |
| Pre-existing failures | `test_059_disconnect.py::test_normal_stream_unchanged` | FAIL — confirmed NOT introduced by 062 | EXCLUDED (DEF-061.1-01) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STREAM-04 (API layer) | Plans 01-04 | Replay-and-tail HTTP endpoints + cancel verb | SATISFIED | All three endpoints implemented and tested: GET /active-runs (Plan 01), GET /stream (Plan 02), DELETE /cancel (Plan 03). 23/23 tests pass. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/threads.py` | 462 | `.single()` instead of `.maybe_single()` in `list_active_runs` ownership SELECT | WARNING | Real Postgres raises PGRST116 on zero rows; patch catches only code="204"; results in 500 instead of 404 for cross-user access. Mock tests pass; real-Postgres behavior is incorrect (CR-01 from code review). |
| `backend/app/api/runs.py` | 336 | `"completed_at": "now()"` literal in zombie-heal UPDATE | WARNING | PostgREST sends `"now()"` as a JSON string. PostgreSQL's timestamptz parser accepts `'now'` (without parens) as a special token but `'now()'` behavior is version-dependent and undocumented. Tests use mocks that store nothing. Carried-forward pattern from Phase 061's `_shielded_finalize`. |
| `backend/app/api/runs.py` | 92-111 | `since` param not validated — malformed Redis ID raises `RedisError` caught by `except BaseException`, re-raised; consumer closes mid-stream with no terminal sentinel | WARNING (WR-03) | Client receives HTTP 200 + zero SSE events + stream closes silently. D-062-07 documents this as accepted ("Redis XREAD validates"). Low surface for well-behaved clients. |

---

## Threat-Model Verification

| Threat ID | Category | Mitigation observable in | Test | Status |
|-----------|----------|--------------------------|------|--------|
| T-062-01 | Information Disclosure (cross-user IDOR) | `.eq("user_id", current_user["id"])` in all 3 endpoints + 404-not-403 (D-062-12) | `test_062_cross_user_404.py` (3 tests) | PARTIAL — `list_active_runs` uses `.single()` which will 500 instead of 404 on real Postgres for cross-user; `stream_run` and `cancel_run` correctly use `.maybe_single()` |
| T-062-02 | Tampering (cross-user cancel) | DELETE ownership SELECT runs BEFORE `RUN_TASKS.get` (D-062-08 step 1 ordering, runs.py:283-299) | `test_delete_other_user_returns_404` | VERIFIED |
| T-062-03 | Information Disclosure (stack-trace leak) + DoS | `RedisError` + `asyncio.TimeoutError` caught at route boundary; generic 503/204 returned (D-062-13) | `test_062_redis_down.py` (2 tests) | VERIFIED |
| T-062-04 | DoS (parallel-consumer connection exhaustion) | Accepted disposition; bounded by deadline + bounded pool; SC#4 test proves fan-out at small scale | `test_062_multi_consumer_fanout.py` | VERIFIED |

---

## ROADMAP SC Coverage

The ROADMAP SC wording predates several locked architectural decisions made during /gsd:discuss-phase 062. These deviations are intentional and documented:

| ROADMAP SC | Deviation | Decision | Impact |
|------------|-----------|----------|--------|
| SC#1 includes `current_offset` field | Omitted from `ActiveRunResponse` | D-062-03 — frontend always replays from since=0; MAXLEN 10000 ≈ 2MB makes full replay cheap; cursor bookkeeping in Phase 063 deferred | None — frontend Phase 063 will use `since=0` |
| SC#1 status includes "completed" and "failed" | Streaming-only filter (`status='streaming'`) | D-062-02 — terminal runs reached via existing GET /messages; `?include_terminal=true` rejected as unproven UX need | None — terminal runs accessible via existing endpoint |
| SC#2(d) `request.is_disconnected()` polling | Not present in `replay_tail_consumer` | D-061-03 contract inversion: consumer disconnect MUST NOT cancel producer; `is_disconnected` was replaced by sse-starlette's internal disconnect handling in Phase 059 | None — Phase 059 established sse-starlette as canonical pattern; no endpoint in the codebase uses `is_disconnected` directly |
| SC#5 "verified by integration test against Supabase Auth + RLS policy" | Tests use mocked Supabase | All integration tests use mock supabase per 061/062 test patterns; real RLS is verified by migration 035's SELECT policy and defense-in-depth `.eq("user_id", ...)` filter | Deferred to human verification item 4 |
| SC#6 POST /messages decision | Deferred | D-062-01 — explicitly deferred to /gsd:discuss-phase 062; resolved as "keep backward-compatible streaming for Phase 063 cut" | None — SC#6 explicitly marked deferred in ROADMAP |

---

## Human Verification Required

### 1. Browser Two-Tab Multi-Tab Flow (SC#2 + SC#3 wall-clock)

**Test:** Open Tab A on a thread → send a long message → observe SSE streaming → open Tab B → query `GET /threads/{tid}/active-runs` in DevTools console → call `GET /runs/{rid}/stream?since=0` in Tab B → verify Tab B receives backlog replay then live-tail in sync with Tab A tokens
**Expected:** Both tabs show identical token sequences; Tab B reattach works without manual refresh
**Why human:** Browser EventSource parsing, real Redis stream operation, and visual multi-tab token sync require a running dev environment; pytest cannot drive a browser

### 2. DELETE Cancel (SC#3 wall-clock)

**Test:** From Tab B, trigger `fetch('/runs/{rid}', {method: 'DELETE', headers: {Authorization: 'Bearer <token>'}})` while Tab A is mid-stream
**Expected:** Both Tab A and Tab B receive `cancelled` terminal SSE event within ~5s; both streams close; subsequent `GET /threads/{tid}/active-runs` returns `[]`
**Why human:** Requires real asyncio task cancellation over a real HTTP connection; mock-based tests cannot verify the producer's CancelledError handler fires and the stream closes on real clients

### 3. TTL-Expired Buffer Synthetic Terminal (D-062-06 wall-clock)

**Test:** Complete a run; wait ~11 minutes for the Redis buffer to expire (TTL=600s for completed runs); call `GET /runs/{rid}/stream?since=0`
**Expected:** Receives exactly one synthetic SSE event `{type: "done", error: "buffer_expired", runs_status: "completed"}`; stream closes immediately; no hang
**Why human:** Requires real 10-minute Redis TTL expiry; cannot be fast-path tested

### 4. Real Supabase RLS Cross-User Verification (SC#5 real backend)

**Test:** Authenticate as User A; start a stream (get run_id + thread_id); authenticate as User B in a different session; call all three endpoints with User B's token against User A's IDs
**Expected:** `GET /threads/{tid}/active-runs` → 404 (but NOTE: this will actually 500 until CR-01 is fixed; verify it 500s, not 403/200); `GET /runs/{rid}/stream` → 404; `DELETE /runs/{rid}` → 404
**Why human:** Tests use mocked Supabase; real RLS enforcement requires a live Supabase connection

### 5. Redis-Down Wall-Clock Degradation (D-062-13 wall-clock)

**Test:** Stop the Redis container (`docker compose -f docker-compose.dev.yml stop redis`); then: (a) `curl -N http://localhost:8000/runs/{any-uuid}/stream` (b) `curl http://localhost:8000/threads/{tid}/active-runs` (c) `curl -X DELETE http://localhost:8000/runs/{rid}` (with auth headers); then restart Redis
**Expected:** (a) 503 with `Retry-After: 10`; (b) 200 JSON array (Postgres-only path unaffected); (c) 204; restart restores streaming
**Why human:** Real container failure vs mock fault injection; the differentiated-degradation contract needs wall-clock confirmation

---

## Gaps Summary

One gap (CR-01) is identified: `list_active_runs` uses `.single()` instead of `.maybe_single()` for the threads ownership SELECT. Against mocked Supabase all 5 SC#1 tests and the cross-user test pass because `_make_result(None)` returns a mock with `.data=None` without raising. Against a real PostgREST connection, zero-row `.single()` raises `APIError(code="PGRST116")` which the `main.py` patch does NOT handle (it only catches `code="204"`), causing a 500 instead of the required 404.

**Scope of impact:** Only `list_active_runs` (Plan 01). The stream and delete endpoints in `runs.py` use `.maybe_single()` correctly. The fix is a one-line change + two-line null check update, closely modeled on the existing correct pattern.

**Suggestion for override:** If the team decides the 500 is acceptable before Phase 063 frontend lands (since `list_active_runs` is not yet called by any production client path), add an override. Otherwise fix before merge.

**WR-01 (`"now()"` literal)** and **WR-03 (malformed `since` silent drop)** are code review warnings that do not block the phase goal. WR-01 is a carried-forward pattern from Phase 061. Both are candidates for a cleanup plan.

The 5 human verification items are standard end-to-end smoke tests that require a running dev environment. They backstop the integration test coverage with wall-clock and browser-level evidence. They do not represent new implementation work.

---

_Verified: 2026-05-03_
_Verifier: Claude (gsd-verifier)_
