# Phase 075.4 Deferred Items

Items surfaced during execution that are NOT in scope. Each entry includes the
source plan, the discovery context, and the proposed routing.

## D-075.4-01-DEFER-1 — Pre-existing test failures using `mockGetActiveRuns`

**Discovered during:** Plan 075.4-01 Task 2 (verifying `vitest run` baseline)

**Scope:** 7 tests in `frontend/src/__tests__/providers/streamsProvider.test.tsx`
and 1 test in `frontend/src/__tests__/hooks/useMessages.test.ts` are RED at
HEAD (verified via `git stash` round-trip on commit `16ba3ea`, the Task 1
landing commit). All 8 failures share the same root cause: the tests mock
`mockGetActiveRuns` but the reconcile path was refactored in Phase 075 D-075-02
(commit landed before Phase 075.4 — outside this plan's scope) to use a single
`getSnapshot(threadId)` atomic-swap call instead of the previous
`Promise.all([getActiveRuns(threadId), getMessages(threadId)])` chain. The
tests' `mockGetActiveRuns` set-ups are now dead mocks; `getSnapshot` returns
the default vitest stub (`undefined`), so `snapshot.active_runs` throws and
reconcile bails. Tests waiting on `mockSubscribeToRun.toHaveBeenCalled()` time
out.

**Specific failing tests (8 total):**

In `streamsProvider.test.tsx`:
1. "two concurrent reconcile() calls deduplicate via the in-flight bit"
2. "reconcile reuses existing placeholder id when runId matches; no second bubble inserted"
3. "setViewingThread on a non-null thread fires reconcile"
4. "listeners fire reconcile when activeThreadIdRef.current is set (visibility entry point)"
5. "L-068-02 lock serializes rapid visibility+focus double-fire (single getActiveRuns)"
6. "loadMessages MERGE filter (temp- + runId + !dbRunIds.has) still pins live temp placeholders"
7. "reconcile-merge replaces stale cached non-temp DB rows"

In `useMessages.test.ts`:
8. "reconcile on switch-back surfaces the post-done state, not an empty placeholder"

**Action:** OUT OF SCOPE for Plan 075.4-01. Plan 075.4-06 (Wave 3 — E2E
backstop + 95-failure triage) is the proper owner — it inherits the
Playwright + fk_aware_runs_factory infrastructure landed by Plan 075.4-05 and
performs a sweep of the ~95 currently-RED backend tests; the 8 frontend tests
above should be folded into that sweep, with the fix being a one-line per-test
`mockGetSnapshot.mockResolvedValue({active_runs: [...], messages: [...],
since_cursors: {}})` migration (the Phase 075 D-075-02 swap pattern).

**Verification:** Plan 075.4-01 Task 4's two NEW test files
(`streamsStore_per_thread.test.ts` + `streamsProvider_067_5_regression.test.tsx`)
are GREEN and serve as the per-thread state coverage for the BUG-260523-01
close-out — they do NOT depend on `mockGetActiveRuns` (they exercise either
direct store mutation or the `getSnapshot` path with the correct mock shape).
