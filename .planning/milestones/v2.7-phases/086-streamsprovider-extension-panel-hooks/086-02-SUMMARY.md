---
phase: 086-streamsprovider-extension-panel-hooks
plan: 02
subsystem: frontend-streaming
tags: [streamsprovider, named-hooks, zustand, reconcile, abortcontroller, agent-panel, sse-dispatch]
requires:
  - phase: 086-01
    provides: "4 per-thread Zustand Maps + 11 action signatures/stubs (streamsStore.ts), 7 StreamCallbacks + payload-shape SSE dispatch (api.ts), 4 GET helpers (getThreadTodos/WorkspaceFiles/PendingAsks/Tasks), 4 wire-mirror types (types/index.ts)"
provides:
  - "Shared usePanelReconcile<T> helper (AbortController + isLoading + composite-error-key reconcile, no visibility/focus listeners)"
  - "4 named panel hooks Phase 087 imports: useTodos / useWorkspaceFiles / useAskUserPrompt / useTasks — each returns { data, isLoading, error, reconcile }, data never undefined"
  - "11 immutable store action BODIES (new Map(prev) clone-then-set) registered in StreamsProvider useEffect #1"
  - "7 makeStreamCallbacks default handlers wiring live SSE panel events into the 4 Maps without re-rendering chat (PANEL-06)"
  - "Integration backstop panelHooks.test.tsx (12 tests, SC#10 axes 1-3 automated)"
affects:
  - "Phase 087 (Panel UI consumes the 4 named hooks + reconcile + isLoading + error)"
tech-stack:
  added: []
  patterns:
    - "Factored shared reconcile helper (usePanelReconcile<T>) over 4 inlined copies — concentrates AbortController + isLoading + composite-error-key in one testable unit (Claude's Discretion per PATTERNS §5)"
    - "Composite reconcileErrors key `${threadId}:${hookId}` reuses the existing per-thread Error Map for per-hook failure isolation (D-086-13)"
    - "Thin named-hook wrappers: null-safe selector + module-level EMPTY constant fallback + usePanelReconcile call; raw store stays hidden (D-086-02)"
    - "Real-SSE-byte integration backstop: mockSseFetch -> real subscribeToRun demux -> real makeStreamCallbacks defaults -> store Maps (end-to-end dispatch assertion)"
key-files:
  created:
    - "frontend/src/hooks/usePanelReconcile.ts (shared SWR + AbortController + composite-error-key helper)"
    - "frontend/src/providers/__tests__/panelHooks.test.tsx (12-test integration backstop)"
  modified:
    - "frontend/src/providers/StreamsProvider.tsx (4 EMPTY constants + 11 action bodies + 7 callback defaults + 4 named hooks)"
key-decisions:
  - "D-086-02 honored: useStreamsStore NOT exported; 4 named hooks are the only consumer surface"
  - "Factored usePanelReconcile<T> helper rather than 4 inlined copies (Claude's Discretion per PATTERNS §5)"
  - "D-086-15: NO visibility/focus/pageshow listeners on panel hooks — reconcile fires ONLY on thread-switch + manual escape hatch"
  - "onTaskStart seeds parent_run_id/model/provider empty (SSE bookend lacks them); GET reconcile (panel.py:156) overwrites with canonical row, merged by sub_run_id"
  - "addPendingAskForThread is idempotent-on-replay: drops any existing ask with the same tool_call_id before appending"
patterns-established:
  - "usePanelReconcile<T>: AbortController-per-reconcile + post-await signal guard + composite-error-key set/clear + manual reconcile() escape hatch"
  - "Panel hook = null-safe store selector (EMPTY fallback) + usePanelReconcile; { data, isLoading, error, reconcile } contract (D-086-10)"
requirements-completed: [PANEL-05, PANEL-06]
duration: 12min
completed: 2026-05-28
---

# Phase 086 Plan 02: StreamsProvider Extension — Panel Hooks Summary

**4 named per-thread panel hooks (useTodos/useWorkspaceFiles/useAskUserPrompt/useTasks) built on a factored usePanelReconcile helper (AbortController + composite-error-key), 11 immutable store action bodies, and 7 SSE callback defaults — live panel events update 4 dedicated Maps without re-rendering chat.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-28T20:05:20Z
- **Completed:** 2026-05-28T20:17:13Z
- **Tasks:** 3
- **Files modified:** 3 (1 created helper, 1 modified provider, 1 created test)

## Accomplishments

- **Shared reconcile helper** `usePanelReconcile<T>` — one testable unit for AbortController-per-reconcile, `isLoading` (initial-fetch-only), composite-error-key (`${threadId}:${hookId}`) read/set/clear, post-await signal guard, and a manual `reconcile()` escape hatch. NO visibility/focus/pageshow listeners (D-086-15).
- **11 immutable store action bodies** registered in StreamsProvider's mount-time useEffect — every body clones `new Map(prev)` before mutating so chat-message selectors (which read `bucketsBySurface`) never re-render (PANEL-06). Identity keys: Todo full-replace, WorkspaceFile by `path`, PendingAsk by `tool_call_id`, TaskRunIndexItem by `sub_run_id`.
- **7 makeStreamCallbacks default handlers** routing live SSE panel events (`todo_updated`, `workspace_file_written/deleted`, `ask_user_prompt/response`, task-variant `sub_agent_start/done`) into the 4 Maps via `getState().actions`, closure-bound to `threadId` — NO call-site signature change.
- **4 named hooks** Phase 087 imports — each `(threadId: string | null) => { data, isLoading, error, reconcile }` (D-086-10); `data` never undefined (module-level EMPTY constant fallback, stable ref); `useAskUserPrompt` returns `PendingAsk[]` (parallel asks). Raw `useStreamsStore` stays hidden (D-086-02).
- **12-test integration backstop** — end-to-end raw-SSE-byte → api.ts demux → callback → store assertions for FC#1/#3/#4/#6/#9, plus hook-level FC#5 (abort) and D-086-13 (per-hook error isolation). SC#10 axes 1-3 automated.

## Task Commits

1. **Task 1: usePanelReconcile helper + 11 action bodies + 7 callback defaults + 4 EMPTY constants** — `a13191e` (feat)
2. **Task 2: 4 named hooks (useTodos/useWorkspaceFiles/useAskUserPrompt/useTasks)** — `7afcb70` (feat)
3. **Task 3: integration backstop panelHooks.test.tsx** — `e45a346` (test)

## Files Created/Modified

- `frontend/src/hooks/usePanelReconcile.ts` (created) — shared SWR + AbortController + composite-error-key reconcile helper; thread-switch effect + manual escape hatch.
- `frontend/src/providers/StreamsProvider.tsx` (modified) — added Todo/WorkspaceFile/PendingAsk/TaskRunIndexItem type imports + 4 GET-helper imports + usePanelReconcile import; 4 module-level EMPTY constants; 11 immutable panel action bodies; 7 panel callback defaults; 4 exported named hooks.
- `frontend/src/providers/__tests__/panelHooks.test.tsx` (created) — 12-test integration backstop.

## Decisions Made

- **Factored `usePanelReconcile<T>` over 4 inlined copies** (Claude's Discretion per PATTERNS §5). The in-hook reconcile useEffect is the single structurally-new shape; concentrating the plumbing removes 4x copy drift and makes it unit-testable in isolation. The 4 hooks are thin wrappers (selector + EMPTY guard + helper call).
- **`onTaskStart` seeds `parent_run_id`/`model`/`provider` empty.** The SSE bookend (`task_service.py:264`) carries only `sub_run_id`/`description`/`tools`/`max_steps`; the GET reconcile (`panel.py:156`) is authoritative and `setTaskForThread` MERGES by `sub_run_id` so a later reconcile fills the canonical fields without clobbering.
- **`addPendingAskForThread` is idempotent-on-replay** — drops any existing ask with the same `tool_call_id` before appending, so a replayed `ask_user_prompt` SSE can't double-insert.

## Deviations from Plan

None - plan executed exactly as written.

The plan specified the test path `frontend/src/providers/__tests__/panelHooks.test.tsx` (note: existing provider tests live under `src/__tests__/providers/`). I honored the plan's specified path verbatim; vitest's default include glob matches `**/*.test.tsx` anywhere under root, so the file is discovered and runs (12/12 pass).

## Issues Encountered

- **No node_modules in worktree.** The parallel worktree had no installed dependencies and `npx tsc` resolved to a global stub that does NOT run the compiler (false-clean). Resolved by junctioning the worktree's `frontend/node_modules` to the main checkout's via `node fs.symlinkSync(target, link, 'junction')` (the `_mklnk.cjs` helper was removed before any commit). All subsequent typechecks ran the REAL `node_modules/typescript/bin/tsc` (exit 0) and the REAL `node_modules/vitest/vitest.mjs`.
- **Pre-existing test failures confirmed unrelated.** Running the provider/cache suites surfaced 13 failures across 3 files (`StreamsProvider.dedup.test.ts`, `streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`) — all in the known 17-failure baseline (argsCodeText/dedup/clientKey/068-reconcile). Verified pre-existing by checking out base `82f5d65` StreamsProvider.tsx and re-running: the same failures reproduce WITHOUT any Plan 086-02 change. My 2 source commits touched only `usePanelReconcile.ts` + `StreamsProvider.tsx` and did NOT modify those test files or the reducers they assert against (`onToolEnd`/`onToolStart`/`onToolArgsProgress` are untouched). My new `panelHooks.test.tsx` is 12/12 GREEN.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit` (full project): clean, EXIT 0 after all 3 tasks.
- `vitest run src/providers/__tests__/panelHooks.test.tsx`: 12/12 pass, EXIT 0.
- grep: `addEventListener` count = 0 in `usePanelReconcile.ts` (D-086-15 — no visibility/focus listeners).
- grep: `export ... useStreamsStore` count = 0 in `StreamsProvider.tsx` (D-086-02 — raw store hidden).
- grep: `usePanelReconcile.ts` contains `AbortController`; `panelHooks.test.tsx` contains `sub_run_id`; `StreamsProvider.tsx` contains `export function useTodos` (artifact "contains" checks).
- grep: 11 immutable `new Map(s.<panelMap>)` clones across the new action bodies; 4 EMPTY constants; 7 panel callback defaults; 4 named-hook exports.
- No file deletions in any commit (`git diff --diff-filter=D` clean across the 3 task commits).

## Threat Model Compliance

- **T-086-04 (Info Disclosure — rapid thread-switch stale data, FC#5):** mitigated. `usePanelReconcile` creates an AbortController per reconcile and aborts it on `[threadId]` cleanup (L-068-02); the post-await `signal.aborted` guard drops late results; writes are keyed by the `threadId` the fetch was invoked with. Task 3 FC#5 test asserts `capturedSignalA.aborted === true` after an A→B switch AND that B's data never appears under key A.
- **T-086-05 (localStorage cross-user leak, FC#8):** mitigated (inherited from Plan 01). These hooks read whatever the store hydrated via the user-scoped cache key; no new persistence added.
- **T-086-06 (reconcile fan-out DoS):** accept. D-086-15 excludes visibility/focus triggers; reconcile fires only on thread-switch + manual escape hatch.

No new high-severity findings; consumer layer only, same authenticated same-origin surface as Plan 01. No new endpoints, no new auth surface.

## Self-Check: PASSED

- frontend/src/hooks/usePanelReconcile.ts — FOUND
- frontend/src/providers/StreamsProvider.tsx — FOUND (4 EMPTY consts, 11 action bodies, 7 callbacks, 4 hooks)
- frontend/src/providers/__tests__/panelHooks.test.tsx — FOUND (12 tests pass)
- Commit a13191e — FOUND
- Commit 7afcb70 — FOUND
- Commit e45a346 — FOUND

## Next Phase Readiness

- Phase 087 (Panel UI) can import the 4 named hooks directly: `useTodos(threadId)`, `useWorkspaceFiles(threadId)`, `useAskUserPrompt(threadId)`, `useTasks(threadId)` — each yields `{ data, isLoading, error, reconcile }`, data never undefined.
- Long-message (SC#10 axis 4) + the full cross-provider matrix remain MANUAL UAT in 086-VALIDATION.md (provider-specific wire behavior can't be unit-mocked).

---
*Phase: 086-streamsprovider-extension-panel-hooks*
*Completed: 2026-05-28*
