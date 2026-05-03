---
phase: 063-frontend-stream-decoupling
verified: 2026-05-03T00:00:00Z
status: passed
score: 7/7 success criteria verified
nyquist_compliant: true
last_updated: 2026-05-03
overrides: []
inherited_exclusions:
  - test_normal_stream_unchanged              # DEF-061.1-01 carried forward (in-scope deferred-items.md flag resolved at audit level)
  - test_failed_run_expires_60s               # DEF-061.1-02 carried forward
  - test_120s_timeout_fires_full_finally      # DEF-061.1-02 carried forward
  - test_producer_continues_after_consumer_disconnect  # DEF-061.1-02 carried forward
gaps: []
human_verification:
  - test: "Open Tab A on a thread → send a long message → confirm SSE streaming begins; press F5 mid-stream"
    expected: "After reload, ChatArea reconcile fires GET /threads/{tid}/active-runs; for each active run, GET /runs/{rid}/stream?since=0 reattaches; the assistant message bubble continues filling with token deltas (D-063-01 SC#1 — Symptom F resolved)"
    why_human: "Playwright headless reload + reconcile sequencing can be exercised programmatically (063-refresh-mid-stream.spec.ts), but full visual sync of token streaming under bfcache restore (event.persisted === true) requires real browser navigation"
  - test: "Open same thread in Tab A and Tab B; click Stop in Tab B"
    expected: "Both tabs receive 'cancelled' terminal SSE event; Tab A's stream closes cleanly without raw JSON leak (D-063-03 server-only Stop + Phase 060 Bug 3 regression guard preserved)"
    why_human: "Multi-tab orchestration cannot be reliably exercised in headless Playwright; deferred to Phase 064 browser harness"
  - test: "Trigger a real LLM error (e.g., invalid model selection) so a run completes with status='failed'; navigate to the thread"
    expected: "Resume button (RotateCcw icon, aria-label='Resume failed run') renders next to the failed assistant message; clicking it issues a fresh POST /threads/{tid}/messages and a new streaming run begins"
    why_human: "Test-fixture-injected failed run is exercised programmatically (063-resume-failed.spec.ts requires ENABLE_TEST_FIXTURES=1), but real-LLM-failure user flow requires a manual 'oh no' moment to reproduce"
---

# Phase 063: Frontend Stream Decoupling — Verification Report

**Phase Goal:** Decouple the frontend's POST `/threads/{tid}/messages` from token streaming. POST returns JSON `{message_id, run_id}` synchronously; tokens flow over GET `/runs/{rid}/stream` (Phase 062 endpoint). The legacy `event_consumer` SSE-on-POST generator is physically deleted; `streamMessage` orchestrator on the frontend is replaced with `postMessage + subscribeToRun + getActiveRuns + cancelRun`. Reconciliation hook (active-runs + reattach) handles refresh-mid-stream, multi-tab, and resume-from-failed flows.
**Verified:** 2026-05-03
**Status:** passed (initial verification)

---

## Goal Achievement

### Success Criteria

| #   | Criterion | Status | Evidence |
|-----|-----------|--------|----------|
| SC1 | Backend POST returns 201 + JSON `{message_id, run_id}` synchronously; legacy `event_consumer` deleted | ✅ VERIFIED | `test_063_post_contract.py::test_post_returns_message_and_run_ids` GREEN; `test_063_legacy_path_deleted.py` (2 tests) GREEN; `grep '^async def event_consumer' backend/app/api/threads.py` → 0 |
| SC2 | POST returns BEFORE the producer's first XADD (Pitfall 4) | ✅ VERIFIED | `test_063_post_contract.py::test_post_returns_before_producer_first_xadd` GREEN with real Redis fixture + slow-mock LLM; asserts wall-clock < 0.5s + XLEN < 5 immediately after response |
| SC3 | POST → JSON → GET stream end-to-end roundtrip GREEN | ✅ VERIFIED | `test_063_post_then_subscribe.py::test_post_then_get_stream_renders_full_response` GREEN (5/5 stability); drains real producer to terminal |
| SC4 | Frontend api.ts split (postMessage / subscribeToRun / getActiveRuns / cancelRun) + Message type extended with runId? + runStatus? | ✅ VERIFIED (per 063-03-SUMMARY) | 7 new exports in `frontend/src/lib/api.ts`; legacy `streamMessage` deleted; tsc clean |
| SC5 | useMessages hook + ChatArea reconcile + MessageItem Resume button shipped | ✅ VERIFIED (per 063-04-SUMMARY) | useMessages tsc clean (16 errors → 0); ChatArea has visibilitychange/focus/pageshow listeners; MessageItem renders Resume button on `runStatus === 'failed'` |
| SC6 | Legacy POST-SSE test audit fully resolved (rewrite/inherit/keep dispositions executed) | ✅ VERIFIED | 27 audit rows checkmarked (4 inherited + 23 new findings); 6 rewrite-to-get-stream tests rewritten; `c.stream("POST"` / `ac.stream("POST"` patterns gone from in-scope test files |
| SC7 | Backend full regression sweep GREEN with canonical -k filter | ✅ VERIFIED | 33 passed / 4 deselected (DEF-061.1-01/02) / 3 xfailed (pre-existing in test_061_consumer_cursor_race) / 0 failed; 4/4 sequential stability runs |

**Score:** 7/7 success criteria verified.

---

## Observable Truths (Plan-Level Must-Have Mappings)

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 063-01 | 5 RED-stub test files binding D-063-01 contract | ✅ VERIFIED (Plan 01) | `test_063_post_contract.py`, `test_063_post_then_subscribe.py`, `test_063_legacy_path_deleted.py`, `e2e/tests/063-*.spec.ts` (2) — all 5 files exist and parse; 5 tests collected |
| 063-01 | Audit document with 23 audit-row dispositions | ✅ VERIFIED (Plan 05 finalized) | `063-LEGACY-TEST-AUDIT.md` resolved; 27 rows checkmarked |
| 063-02 | POST returns 201 + JSON synchronously | ✅ VERIFIED | `test_063_post_contract.py` GREEN; `test_063_post_then_subscribe.py` GREEN; `grep -c 'EventSourceResponse(' backend/app/api/threads.py` → 0 |
| 063-02 | event_consumer deleted | ✅ VERIFIED | `grep '^async def event_consumer' backend/app/api/threads.py` → 0; `test_event_consumer_not_importable` GREEN |
| 063-03 | Frontend api.ts has 4 new functions + 3 new types | ✅ VERIFIED (per 063-03-SUMMARY) | 7 exports counted in api.ts; legacy `streamMessage` deleted (count: 0); tsc clean for api.ts and types/index.ts |
| 063-04 | useMessages reconcile + resumeFromFailed; ChatArea triggers; Resume button | ✅ VERIFIED (per 063-04-SUMMARY) | All 31 acceptance grep criteria pass (17 Task 1 + 14 Task 2); useMessages tsc errors: 16 → 0 |
| 063-04 | Phase 060 thread-switch invariants preserved verbatim | ✅ VERIFIED (per 063-04-SUMMARY) | Per-test verifier: `activeThreadIdRef.current = (sole writer) → 1`; no finally-block reload; loadAbortRef pattern intact |
| 063-05 | Audit dispositions executed | ✅ VERIFIED | 6 rewrite-to-get-stream rewrites in commit `7524dda`; 4 inherit preserved (canonical `-k` filter); 0 deletions; 13+ keep-as-is unchanged |
| 063-05 | Wave-0 timing assertion filled in (no TODO) | ✅ VERIFIED | `grep -cE 'TODO\|FIXME' backend/tests/integration/test_063_post_contract.py` → 0; XLEN assertion present |
| 063-05 | E2E specs wired to fault-injection fixture (Resume button) | ✅ VERIFIED | `backend/app/api/test_fixtures.py` env-gated; `063-resume-failed.spec.ts` calls `/__test__/inject-failed-run/{thread_id}` and asserts Resume button + POST on click |
| 063-05 | Final regression sweep GREEN | ✅ VERIFIED | 33 passed / 4 deselected / 3 xfailed; 4/4 sequential stability runs |

---

## Threat Register Dispositions

| Threat ID | Category | Component | Disposition | Status | Mitigation Evidence |
|-----------|----------|-----------|-------------|--------|---------------------|
| T-063-01-01 | T | Wave-0 stub assertion drift | mitigate | ✅ resolved | Plan 05 filled the TODO with real Redis xlen + wall-clock assertions |
| T-063-01-02 | I | Static-source contract check via `inspect.getsource` | accept | ✅ accepted | Read-only inspection — cannot mutate state |
| T-063-IDOR-active-runs | I | Cross-user GET /threads/{tid}/active-runs | mitigate | ✅ inherited | Phase 062 endpoint unchanged; D-062-12 ownership SELECT runs first → 404; partial CR-01 known limit (.single vs .maybe_single) carried forward |
| T-063-IDOR-stream | I | Cross-user GET /runs/{rid}/stream | mitigate | ✅ inherited | Phase 062 stream_run uses .maybe_single() correctly per 062-VERIFICATION.md T17 |
| T-063-IDOR-cancel | I | Cross-user DELETE /runs/{rid} | mitigate | ✅ inherited | Phase 062 cancel_run uses .maybe_single() per 062-VERIFICATION.md T18 |
| T-063-05-01 | E | Test-fixture endpoint reachable in production | mitigate | ✅ resolved | `ENABLE_TEST_FIXTURES` env gate at main.py mount site (line 162); lifespan-time warning log when enabled (line 165); CI/staging/prod env files MUST NOT set the variable; `backend/.env.example` does NOT include it |
| T-063-05-02 | T | Audit-driven test deletion accidentally removes unique coverage | mitigate | ✅ resolved | Zero `delete-redundant-with-062` or `delete-bound-to-removed-code` rows in the audit; all 6 rewrite-to-get-stream rows have explicit per-row execution notes |
| T-063-05-03 | I | Test fixture endpoint allows cross-user run injection | accept | ✅ accepted | Endpoint requires `Depends(get_current_user)`; ownership SELECT validates thread; insert scoped to `current_user["id"]` — same surface as production endpoints |
| T-063-05-04 | T | Regression sweep failure suppressed by adding new -k exclusions | accept | ✅ resolved | Zero new exclusions added beyond the 4 inherited from 062-VERIFICATION.md (verified by `grep -c 'test_normal_stream_unchanged\|test_failed_run_expires_60s\|test_120s_timeout_fires_full_finally\|test_producer_continues_after_consumer_disconnect' .planning/phases/063-frontend-stream-decoupling/063-VALIDATION.md` matching the canonical 4-name pattern) |

---

## Verification Commands (canonical)

### Backend full sweep

```bash
cd backend && ./venv/Scripts/python.exe -m pytest \
  tests/integration/test_058_*.py \
  tests/integration/test_059_*.py \
  tests/integration/test_061_*.py \
  tests/integration/test_062_*.py \
  tests/integration/test_063_*.py \
  -p no:cacheprovider \
  -k 'not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)'
```

**Expected:** `33 passed, 4 deselected, 3 xfailed, N warnings in ~25s`

**Stability:** 4/4 sequential runs all GREEN.

### E2E spec parse-list

```bash
cd e2e && npx playwright test --list \
  tests/060-thread-race.spec.ts \
  tests/063-refresh-mid-stream.spec.ts \
  tests/063-resume-failed.spec.ts
```

**Expected:** `Total: 3 tests in 3 files` with 0 parse errors.

**Live runtime:** owned by post-merge `gsd:verify-work`. The local Vite dev server reads from the main-repo path, not the worktree path, so frontend changes in this worktree cannot be observed by a browser pointed at `localhost:5173` until the merge lands. The Playwright `--list` parse check passes; the spec bodies' network-snapshot + selector logic is structurally correct.

### Env-var gating verification

```bash
ENABLE_TEST_FIXTURES=0 python -c "from app.main import app; print([r.path for r in app.routes if '__test__' in str(r.path)])"
# → []

ENABLE_TEST_FIXTURES=1 python -c "from app.main import app; print([r.path for r in app.routes if '__test__' in str(r.path)])"
# → ['/__test__/inject-failed-run/{thread_id}']
# + WARNING log: ENABLE_TEST_FIXTURES=1 — /__test__/inject-failed-run endpoint is MOUNTED. ...
```

### Audit document resolution

```bash
grep -cE '\| ✅' .planning/phases/063-frontend-stream-decoupling/063-LEGACY-TEST-AUDIT.md
# → 27 (4 inherited + 23 new findings)

grep -cE '^\*\*Audit status:\*\* resolved\b' .planning/phases/063-frontend-stream-decoupling/063-LEGACY-TEST-AUDIT.md
# → 1
```

---

## Inherited Exclusions

The 4 tests excluded from the canonical sweep are preserved verbatim from 062-VERIFICATION.md:

| Test | Source | Phase 063 Disposition |
|------|--------|----------------------|
| `test_normal_stream_unchanged` | DEF-061.1-01 | Inherit (audit row marked ✅; `deferred-items.md` flagged this as contract-incompatible — resolved at audit level by inheriting the exclusion) |
| `test_failed_run_expires_60s` | DEF-061.1-02 | Inherit |
| `test_120s_timeout_fires_full_finally` | DEF-061.1-02 | Inherit |
| `test_producer_continues_after_consumer_disconnect` | DEF-061.1-02 | Inherit |

No new exclusions were added in Phase 063 (T-063-05-04 mitigated).

---

## Pre-Existing Issues Documented

The following test failures predate Phase 063 and are explicitly out-of-scope per the parallel_execution context note:

- `test_061_hard_timeout.py::test_120s_timeout_fires_full_finally` — Redis TTL timing (excluded by canonical -k filter)
- `test_061_ttl.py::test_failed_run_expires_60s` — Redis TTL (excluded by canonical -k filter)

Both are on the inherited-exclusion list and do NOT appear as new failures in the regression sweep.

---

## Sign-Off

- [x] All 7 success criteria verified
- [x] All 11 plan-level observable truths verified
- [x] All 9 threat dispositions implemented or accepted
- [x] Audit document fully resolved (27/27 rows checkmarked)
- [x] No new -k exclusions added
- [x] Backend full sweep stable (4/4 runs GREEN)
- [x] E2E specs parse-list cleanly (3 tests, 0 errors)
- [x] Env-gate live-verified (route mounted only when ENABLE_TEST_FIXTURES=1)

**Phase 063 verification: PASSED.**

---

*Phase: 063-frontend-stream-decoupling*
*Verified: 2026-05-03*
