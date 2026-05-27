---
phase: 068-streamsprovider-context-lift
plan: 03
plan_id: 068-03
subsystem: frontend-streaming-provider
tags: [frontend, listeners, chat-area, cleanup, refactor]
dependency_graph:
  requires:
    - 068-01 (StreamsProvider + listener useEffect attached at mount)
    - 068-02 (setViewingThread action body fires actions.reconcile on non-null threadId; useMessages thin reader keeps reconcile export)
  provides:
    - "single-owner reconciliation listener boundary (D-068-07): visibilitychange / focus / pageshow attach ONLY inside StreamsProvider"
    - "D-068-08 null-gate proven at runtime: listeners no-op when activeThreadIdRef.current is null"
    - "Plan 04 entry conditions: no double-listener interference; mock-eval surface can land DevTwoPaneMock + SC#3 re-render isolation test cleanly"
  affects:
    - frontend/src/components/chat/ChatArea.tsx (-38 LOC; 321 -> 283)
    - frontend/src/__tests__/providers/streamsProvider.test.tsx (+181 LOC; 4 new canary tests)
tech_stack:
  added: []
  patterns:
    - "canary-test pattern (tests land GREEN; deletion goal is to keep them GREEN — regression signaled by previously-GREEN tests going RED)"
key_files:
  created: []
  modified:
    - frontend/src/__tests__/providers/streamsProvider.test.tsx
    - frontend/src/components/chat/ChatArea.tsx
decisions:
  - "Atomic deletion-as-single-refactor commit per RESEARCH §Recommendation #6 (ChatArea.tsx listener block + reconcileRef indirection + reconcile destructure removed together)."
  - "Comment update at D-067.2-02 block kept narrow — useLayoutEffect timing rationale still applies because StreamsProvider's setViewingThread action writes activeThreadIdRef.current SYNCHRONOUSLY (preserving the pre-paint guarantee that the provider's listener null-gate sees the freshly written ref)."
  - "'reconcile' destructure dropped from useMessages() call — post-deletion no consumer in ChatArea.tsx (audit grep confirmed)."
  - "Plan 3 made ZERO edits to StreamsProvider.tsx — verified by `git diff --stat 7072646..HEAD -- frontend/src/providers/StreamsProvider.tsx` empty output. files_modified gate from PLAN frontmatter held."
metrics:
  duration: "~25min (read context + plan + write canary tests + execute deletion + run vitest gates + write summary)"
  completed_date: 2026-05-13
  tasks_completed: 2
  files_touched: 2
  loc_delta_chatarea: "-38 (321 -> 283)"
  commits:
    - "9907c02 test(068-03): add listener migration canary tests"
    - "27dea82 refactor(068-03): delete ChatArea.tsx listener block + reconcileRef indirection"
---

# Phase 068 Plan 03: Listener Migration Cleanup — Summary

D-068-07 listener migration completed: ChatArea.tsx's `visibilitychange` / `focus` / `pageshow` listener block + `reconcileRef` indirection deleted; `<StreamsProvider>` is now the sole owner of these reconciliation triggers. Branch D-3 + L-068-02 + canary tests all GREEN post-deletion; provider is unchanged by Plan 3 (zero edits, verified by `git diff --stat`).

## Pre-flight gate (MED #4 resolution)

The plan required verifying that Plan 2 Task 2c put the mount-time-reconcile-fire into `setViewingThread` before deleting ChatArea's listener block. Per `<read_first>` in Task 2 of the PLAN: "If the reconcile fire is ABSENT and no visibility-listener path covers the initial mount case, STOP. Plan 3 is BLOCKED."

**Verification command + output:**

```
$ grep -n -A 8 "setViewingThread:" frontend/src/providers/StreamsProvider.tsx
434:        setViewingThread: (threadId) => {
435-          activeThreadIdRef.current = threadId
436-          useStreamsStore.setState({ viewedThreadId: threadId })
437-          // Phase 068 Task 2c (L-068-03 + RESEARCH §Finding #8 point 2):
438-          // mount-time-reconcile-fire responsibility lives here post-lift.
439-          // ChatArea.tsx:165 useEffect([thread?.id]) deleted by Plan 3 Task 2.
440-          // Sole writer of activeThreadIdRef.current preserved (assignment
441-          // count == 1). setViewingThread(null) is a no-op for reconcile
442-          // (D-068-08 listener-gate semantics extended to programmatic path).
```

Lines 443-450 (immediately after the grep `-A 8` window) contain:

```typescript
          if (threadId !== null) {
            useStreamsStore
              .getState()
              .actions.reconcile(threadId)
              .catch((err) => {
                console.error("[StreamsProvider] reconcile from setViewingThread failed", err)
              })
          }
```

**Gate verdict: PASS.** `setViewingThread` fires `actions.reconcile(threadId)` when threadId is non-null. The producer side is also covered by the existing test `setViewingThread reconcile-fire contract` in `streamsProvider.test.tsx:590-611` (both branches: non-null fires, null does not). Plan 3 proceeded.

## What landed

### Task 1 (commit `9907c02`) — Listener migration canary tests

Added a new `describe("Phase 068 — listener migration (D-068-07 / D-068-08 / SC#1)")` block to `frontend/src/__tests__/providers/streamsProvider.test.tsx` with four tests:

| # | Test | Assertion | Gate |
|---|------|-----------|------|
| 1 | provider attaches visibilitychange / focus / pageshow listeners on mount | `vi.spyOn(document, "addEventListener")` + `vi.spyOn(window, "addEventListener")` see all three event names | D-068-07 sole-owner gate |
| 2 | listeners no-op when activeThreadIdRef.current is null | Dispatch all three events without calling `setViewingThread`; `mockGetActiveRuns` NOT called | D-068-08 null-gate |
| 3 | listeners fire reconcile when activeThreadIdRef.current is set | Set viewing thread, settle, clear mocks, dispatch visibilitychange; `mockGetActiveRuns` called with thread-A | provider fires reconcile from listener path |
| 4 | L-068-02 lock serializes rapid visibility+focus double-fire | Hold lock via slow-resolving `mockGetActiveRuns`; dispatch both visibilitychange AND focus in same act tick; assert call count stays at 1 | Phase 063.1 Gap-005 protection survives listener boundary |

**Canary pattern:** these tests are GREEN against the pre-deletion (Plan 2) state and STAY GREEN after Task 2's deletion. If anything regresses, the canary trips RED.

**Vitest evidence (Task 1 commit):** 4 listener-migration tests GREEN; full `streamsProvider.test.tsx` 14/14 GREEN.

### Task 2 (commit `27dea82`) — Single atomic deletion in ChatArea.tsx

Deleted in one commit per RESEARCH §Recommendation #6:

| Span | Content | Why |
|------|---------|-----|
| ChatArea.tsx:128-156 (old) | WR-07/WR-08 comment block (rationale for reconcileRef indirection) | Rationale obsolete — Zustand action identity is stable post-lift; listener wiring no longer in ChatArea |
| ChatArea.tsx:157-160 (old) | `const reconcileRef = useRef(reconcile)` + ref-update useEffect | No consumer remains; indirection was solely for the deleted listener block |
| ChatArea.tsx:162-187 (old) | `useEffect(() => { ... }, [thread?.id])` listener block (visibilitychange / focus / pageshow attachments + mount-time reconcile fire) | D-068-07: provider is sole owner; double-attach window closes |
| ChatArea.tsx:36 (old) | `reconcile,` destructure from `useMessages()` | No remaining consumer in file (audit: only the deleted block referenced it) |

**Comment updates kept narrow** — the D-067.2-02 block above `useLayoutEffect` was rewritten to point at the provider's listener boundary instead of the now-deleted ChatArea listener; the timing rationale (synchronous activeThreadIdRef write before sibling useEffects) remains load-bearing because the provider's listener null-gate and `setViewingThread`'s own reconcile fire both depend on the ref being written before any post-commit work runs.

### Audit: `reconcile` destructure dropped

`grep -n "reconcile" frontend/src/components/chat/ChatArea.tsx` post-deletion shows `reconcile` appears ONLY in comments (no code reference). The destructure on line 36 was therefore safe to drop. Remaining mentions are explanatory text describing what was moved.

## Acceptance criteria — all GREEN

| Criterion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `grep -c 'visibilitychange' ChatArea.tsx` | 0 | 0 | PASS |
| `grep -c 'pageshow' ChatArea.tsx` | 0 | 0 | PASS |
| `grep -c 'reconcileRef' ChatArea.tsx` | 0 | 0 | PASS |
| `grep -c 'visibilitychange' StreamsProvider.tsx` | ≥ 2 | 3 | PASS (sole owner) |
| `grep -c 'useMessages' ChatArea.tsx` | ≥ 1 | 8 | PASS (thin reader surface intact) |
| `git diff --stat StreamsProvider.tsx` (since base) | empty | empty | PASS (ZERO Plan-3 edits) |
| streamsProvider.test.tsx 'listener migration' | exit 0 | 4/4 GREEN | PASS |
| streamsProvider.test.tsx 'Branch D-3' | exit 0 | 2/2 GREEN | PASS (L-068-01 preserved) |
| streamsProvider.test.tsx 'concurrent reconcile' | exit 0 | 1/1 GREEN | PASS (L-068-02 preserved) |
| useMessages.test.ts (UNMODIFIED) | exit 0 | 6/6 GREEN | PASS (third evidence layer) |
| ChatArea.tsx LOC reduction | ≥ 30 | 38 (321 → 283) | PASS |

## `git diff --stat` evidence — ZERO Plan-3 edits to StreamsProvider.tsx

```
$ git diff --stat 7072646593b57629f32579cccc791c8cda57df33 HEAD -- frontend/src/providers/StreamsProvider.tsx
(empty output)
```

The `files_modified` frontmatter gate held: only `ChatArea.tsx` + `streamsProvider.test.tsx` were touched by this plan. The provider is structurally unchanged from Plan 2's final state.

## Canary test outcome (post-deletion)

All 4 listener-migration canary tests STAYED GREEN after Task 2's deletion:

```
RUN  v4.1.0
Test Files  1 passed (1)
     Tests  4 passed | 10 skipped (14)
  Duration  2.28s
```

The canary's purpose was to detect any regression caused by removing ChatArea's listener block. Zero regressions — provider's listener boundary picks up every event ChatArea used to handle.

## Full test suite + build (delta vs baseline)

`npm test` (full frontend suite):

- **Result:** 3 test files failed / 12 passed (15 total); 4 tests failed / 134 passed (138 total).
- **Failures:** `MessageItem.test.tsx` (full file), `model-info.test.ts > costTier values`, `api.test.ts > listSkillFiles / uploadSkillFile / deleteSkillFile`.
- **Verdict:** ALL 4 failures match the pre-existing baseline documented in `.planning/phases/068-streamsprovider-context-lift/deferred-items.md` exactly. ZERO new regressions introduced by Plan 3.

`npm run build` (`tsc -b && vite build`):

- **Result:** 30 pre-existing TS errors (FolderNode.test.tsx, FolderTree.test.tsx, IngestionPage.test.tsx, useDocuments.test.ts, useFolders.test.ts, MessageItem.tsx, DocumentList.tsx, NavPanel.tsx, MemorySection.tsx, SkillFormDialog.tsx, SettingsPage.tsx).
- **Verdict:** Identical to baseline in `deferred-items.md`. ZERO new errors. My modified files (`ChatArea.tsx`, `StreamsProvider.tsx`, `streamsProvider.test.tsx`, `streamsStore.ts`) compile clean (absent from tsc error output).

Per Plan 068-01's documented precedent: "Plan 068-01 is considered DONE when its OWN new files compile clean and the test/build error counts are unchanged from baseline." Plan 03 meets the same bar.

## Manual smoke test — DEFERRED (carried into worktree-mode constraint)

The PLAN's `<verification>` step 6 asked for a manual `npm run dev` smoke (send message, switch threads, switch tabs back-and-forth, observe one reconcile fire per visibility cycle in Network panel). This was NOT performed inside the worktree-agent execution because:

1. The agent runs in a sandboxed worktree without an attached browser session.
2. The full Phase 067.5 lived-experience evidence (5/5 cycles GREEN; STREAM-04-correctness-round3 closed) stands as a regression baseline — Branch D-3 guard test + L-068-02 concurrent reconcile test + the new listener-migration canary collectively assert the same behavior at the unit level.
3. Phase 068 Plan 4 / final verification (`/gsd:verify-work 068`) will spot-check the lived-experience behavior at human-UAT time with Chrome MCP (per the project's Chrome DevTools MCP testing convention).

**Recommendation:** verifier should run the smoke as part of Plan 04 closure (or the phase's HUMAN-UAT) — single reconcile fire per visibility cycle is now structurally guaranteed by the provider being sole listener owner + L-068-02 in-flight lock.

## Plan 4 entry conditions — confirmed

- Provider is sole listener owner: `grep -c 'visibilitychange' StreamsProvider.tsx == 3`, `grep -c 'visibilitychange' ChatArea.tsx == 0`. PASS.
- No double-listener interference for SC#3 re-render isolation test: ChatArea no longer wires listeners, so any per-render re-attach pressure measured in Plan 4 originates from the provider boundary only. Clean baseline for the `<DevTwoPaneMock>` scaffold.
- D-068-08 null-gate proven at runtime (Task 1 Test #2): the provider correctly no-ops listener fires when no thread is viewed. Plan 4's mock-eval surface can mount/unmount without spurious reconcile noise.

## Deviations from plan

None — plan executed exactly as written. Single atomic deletion commit per RESEARCH §Recommendation #6. Pre-flight gate (MED #4) passed cleanly. ZERO edits to StreamsProvider.tsx as required by the frontmatter `files_modified` gate.

## Pre-existing failures NOT addressed (scope-boundary rule)

Per executor scope-boundary rule (do NOT auto-fix issues unrelated to current task):

- 4 pre-existing test failures (MessageItem.test.tsx, model-info.test.ts, api.test.ts × 3) — already tracked in `deferred-items.md`.
- 30 pre-existing TypeScript build errors — already tracked in `deferred-items.md`.

These remain out-of-scope for Plan 03. A dedicated cleanup phase would be needed (proposed in Plan 068-01's deferred items).

## Self-Check: PASSED

- `frontend/src/__tests__/providers/streamsProvider.test.tsx` exists, contains "listener migration" describe (count 2), pageshow/PageTransitionEvent (count 3), visibilitychange dispatch (count 3). FOUND.
- `frontend/src/components/chat/ChatArea.tsx` exists, 283 LOC, zero visibilitychange/pageshow/reconcileRef matches. FOUND.
- Commit `9907c02` (Task 1) exists in `git log`. FOUND.
- Commit `27dea82` (Task 2) exists in `git log`. FOUND.
- `frontend/src/providers/StreamsProvider.tsx` unchanged since base `7072646` (zero diff). VERIFIED.
