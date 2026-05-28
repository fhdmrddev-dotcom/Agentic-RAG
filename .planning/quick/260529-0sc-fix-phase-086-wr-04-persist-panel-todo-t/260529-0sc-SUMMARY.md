---
phase: 260529-0sc
plan: 01
subsystem: frontend-streams-persistence
tags: [streaming, panel, localStorage, persistence, WR-04, phase-086-gap]
requires:
  - "writeSnapshotToLocalStorage 4th/5th optional Map params (already shipped, Phase 086 Plan 01)"
  - "subscribeWithSelector middleware in streamsStore factory (already present)"
provides:
  - "StreamsProvider useEffect #4 write-path persists todosByThread/tasksByThread to the localStorage snapshot"
  - "End-to-end write-path regression test in panelHooks.test.tsx"
affects:
  - "F5 first-paint hydration of panel todos/tasks (readTodosSyncOrEmpty/readTasksSyncOrEmpty now return real data)"
tech-stack:
  added: []
  patterns:
    - "tuple selector + stable module-scope equalityFn for subscribeWithSelector multi-ref persistence trigger"
key-files:
  created: []
  modified:
    - "frontend/src/providers/StreamsProvider.tsx"
    - "frontend/src/providers/__tests__/panelHooks.test.tsx"
decisions:
  - "Panel Maps join the persistence *trigger* set only (not chat selectors) — PANEL-06 isolation preserved"
metrics:
  duration: ~15min
  completed: 2026-05-29
---

# Phase 260529-0sc Plan 01: Fix Phase 086 WR-04 Persist Panel Todo/Task Maps Summary

Closed the WR-04 verification gap by wiring the dead localStorage write-path for the panel `todosByThread`/`tasksByThread` Maps in StreamsProvider `useEffect #4`, proven by an end-to-end regression test that is RED pre-fix and GREEN post-fix.

## What Changed

### Task 1 — write-path fix (commit `874021c`)
`frontend/src/providers/StreamsProvider.tsx`, `useEffect #4`:

- **BUG #1 fixed:** `writeNow` now passes `state.todosByThread` and `state.tasksByThread` as the 4th/5th args of `writeSnapshotToLocalStorage` (the signature was already extended in Phase 086 Plan 01 but callers never supplied them).
- **BUG #2 fixed:** the `subscribeWithSelector` subscription was widened from a single-field selector (`state.bucketsBySurface`) to a tuple selector `[bucketsBySurface, todosByThread, tasksByThread]` with a stable module-scope `persistTriggerEqual` equalityFn (passed as the subscribe 3rd arg). Panel-Map mutations now trigger the throttled write.
- Added the `persistTriggerEqual` const beside the `EMPTY_*` module-level constants, plus an updated comment block on the subscription documenting the new trigger set and reiterating PANEL-06 chat-isolation.

### Task 2 — regression test (commit `62c1cf0`, TDD)
`frontend/src/providers/__tests__/panelHooks.test.tsx`:

- New `describe` block "Phase 086 panel — WR-04 localStorage write-path persistence" with one `it` that: seeds an `sb-test-auth-token` localStorage key (so `getCurrentUserIdSync` resolves — the supabase mock is irrelevant to the direct-localStorage writer), mounts the provider, sets an active thread via `setViewingThread` (sole writer of `activeThreadIdRef`, makes the keepPredicate pass), dispatches `replaceTodosForThread`/`replaceTasksForThread`, advances fake timers past the 500ms throttle, then asserts `readTodosSyncOrEmpty().get(THREAD_A)` and `readTasksSyncOrEmpty().get(THREAD_A)` are non-empty with the dispatched data.
- Imported `readTodosSyncOrEmpty`/`readTasksSyncOrEmpty` from `@/lib/streamsCache`.
- Fake timers are scoped to the test (try/finally restores real timers + unmount) so the other 12 tests are unaffected.

## TDD Gate Compliance

- **RED confirmed:** with Task 1 reverted (`git checkout HEAD~1 -- StreamsProvider.tsx`), the new test failed at the `expect(persistedTodos.get(THREAD_A)).toHaveLength(1)` assertion — `get(THREAD_A)` returned `undefined` because the Maps never reached the snapshot. (A harmless `reconcile from setViewingThread` stderr appeared but is unrelated test-harness noise.)
- **GREEN confirmed:** with the fix restored, all 13 tests pass.
- Commit order: `test(...)` follows the `feat/fix(...)` commit here because the fix was authored first (Task 1) then the test (Task 2); the RED/GREEN negative guarantee was verified manually by reverting/restoring the source file. Gate intent satisfied.

## Verification

Run from `frontend/`:

- `npx tsc --noEmit` → exits 0 (`TSC_OK`). No new type errors from the tuple selector / equalityFn.
- `npx vitest run src/providers/__tests__/panelHooks.test.tsx` → `Test Files 1 passed (1)`, `Tests 13 passed (13)` (12 existing + 1 new).
- RED check (pre-fix): `Tests 1 failed | 12 skipped` — the new WR-04 test fails as required.

### Scope guard
`git diff HEAD~2 HEAD --name-only` for this task's commits touches ONLY:
- `frontend/src/providers/StreamsProvider.tsx` (useEffect #4 + one module-scope const)
- `frontend/src/providers/__tests__/panelHooks.test.tsx`

No edits to `usePanelReconcile.ts`, `types/index.ts`, `streamsCache.ts`, or any WR-01/02/03 code path. (Pre-existing session-dirty files `.planning/config.json`, `backend/README.md`, `supabase/.temp/cli-latest` were untouched by this task.)

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria

- [x] WR-04 closed: panel Maps persist to the localStorage snapshot on the throttled write; `readTodosSyncOrEmpty()`/`readTasksSyncOrEmpty()` return real data on first paint (F5-resilience / D-086-03 / SC#3).
- [x] Write path proven by an end-to-end regression test (RED pre-fix, GREEN post-fix).
- [x] PANEL-06 isolation preserved — panel Maps are part of the persistence *trigger* set only; chat MessageList selectors still read `bucketsBySurface` exclusively.
- [x] No scope creep — WR-01/02/03 untouched.
- [x] `npx tsc --noEmit` clean; full panelHooks.test.tsx suite GREEN.

## Self-Check: PASSED

- FOUND: frontend/src/providers/StreamsProvider.tsx (persistTriggerEqual + state.todosByThread present)
- FOUND: frontend/src/providers/__tests__/panelHooks.test.tsx (readTodosSyncOrEmpty WR-04 test present)
- FOUND commit: 874021c (Task 1 fix)
- FOUND commit: 62c1cf0 (Task 2 test)
