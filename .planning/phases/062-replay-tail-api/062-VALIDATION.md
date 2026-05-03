---
phase: 062
slug: replay-tail-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 062 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (existing) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && pytest tests/integration/test_062_*.py -x --timeout=60` |
| **Full suite command** | `cd backend && pytest -x --timeout=120 -k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"` |
| **Estimated runtime** | ~30s (Phase 062 tests only) / ~120s (full suite) |

The full-suite `-k` filter inherits the canonical exclusion clause from 061.1 covering the four pre-existing flakes documented in `061.1/deferred-items.md` (DEF-061.1-01 + DEF-061.1-02). See planner Open Question 1 for whether 062 elects to fix DEF-061.1-02 in Wave 0 or carry the exclusion forward.

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/integration/test_062_*.py -x --timeout=60`
- **After every plan wave:** Run the full suite command (with the inherited `-k` exclusion)
- **Before `/gsd-verify-work`:** Full suite must be green (excluded tests stay excluded per inherited 061.1 disposition)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner per task. Each row binds a planned task to a concrete pytest command + the file that must exist for the verify to be meaningful.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {planner fills} | | | STREAM-04 | | | integration | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/_run_helpers.py` — extend with 062 helpers (multi-consumer fan-out fixture, time-warp TTL helper, zombie-state setup helper)
- [ ] `backend/tests/integration/test_062_active_runs.py` — Wave 0 stub for SC#1
- [ ] `backend/tests/integration/test_062_stream_replay.py` — Wave 0 stub for SC#2 (replay path)
- [ ] `backend/tests/integration/test_062_stream_terminal.py` — Wave 0 stub for SC#2 (terminal sentinel close)
- [ ] `backend/tests/integration/test_062_stream_ttl_expired.py` — Wave 0 stub for D-062-06 synthetic terminal
- [ ] `backend/tests/integration/test_062_delete_happy.py` — Wave 0 stub for SC#3 happy path
- [ ] `backend/tests/integration/test_062_delete_zombie.py` — Wave 0 stub for D-062-11 zombie heal
- [ ] `backend/tests/integration/test_062_delete_terminal_idempotent.py` — Wave 0 stub for SC#3 idempotency
- [ ] `backend/tests/integration/test_062_cross_user_404.py` — Wave 0 stub for SC#5
- [ ] `backend/tests/integration/test_062_multi_consumer_fanout.py` — Wave 0 stub for SC#4

Reuse session-autouse `_flushdb_at_session_end` and function-scoped `redis_client` from `backend/tests/conftest.py:172-222` (shipped in 061). No new fixtures at conftest level.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-tab DevTools active-runs reconcile | SC#1 (read-side) | Browser-level multi-tab harness deferred to Phase 064; backend integration test covers fan-out at API layer | (1) Open thread in Tab A, send message that streams; (2) Open same thread in Tab B; (3) Verify Tab B's `GET /active-runs` returns the in-flight run; (4) Verify Tab B's `GET /runs/{id}/stream` replays + tails to completion synchronously with Tab A. Document in `062-VERIFICATION.md`. |
| Cancel-from-second-tab via DELETE | SC#3 | Browser-level UX surface deferred to Phase 064; backend test covers happy path + zombie heal at API layer | (1) Tab A sends streaming message; (2) Tab B issues `DELETE /runs/{id}` (curl/devtools); (3) Verify both tabs see the `cancelled` SSE event within ~5s and the connection closes cleanly; (4) Verify a re-issued DELETE returns 204 silently. |
| Redis-down 503 surface on stream endpoint | SC#2 + D-062-13 | `docker stop redis-dev` is environmental, not deterministic from pytest | (1) Stop the Redis container; (2) `curl -N http://localhost:8000/runs/{any-uuid}/stream`; (3) Verify 503 + `Retry-After: 10`; (4) Verify `GET /threads/{id}/active-runs` still returns 200 (Postgres-only path); (5) Verify `DELETE /runs/{id}` still returns 204 (Postgres UPDATE succeeds even with all Redis ops failing). |
| TTL-expired buffer with row present | D-062-06 | Real 600s TTL is too slow to await; test uses `redis.expire` to force-expire — but a manual smoke confirms wall-clock behavior matches | (1) Complete a streaming run; (2) Force expire: `docker exec redis-dev redis-cli DEL run:{id}`; (3) `curl -N /runs/{id}/stream` and verify a single synthetic terminal event with `error: "buffer_expired"` then connection closes. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 test files listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] DEF-061.1-02 disposition recorded (Open Question 1 from RESEARCH.md)
- [ ] Manual-only checklist items mirrored into `062-VERIFICATION.md` Manual section

**Approval:** pending
