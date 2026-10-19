---
phase: 287-start-from-a-thread-fork-a-starter
plan: 03
subsystem: frontend-chat
tags: [start-01, workflow, thread, tdd]
requires: [287-01]
provides: [in-thread Run a workflow action]
affects: [ChatArea, StreamsProvider, streamsStore]
key-files:
  created:
    - frontend/src/components/chat/useStartWorkflowInThread.ts
    - frontend/src/components/chat/ThreadWorkflowPicker.tsx
    - frontend/src/components/chat/__tests__/useStartWorkflowInThread.test.tsx
    - frontend/src/components/chat/__tests__/ThreadWorkflowPicker.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.threadWorkflowPicker.test.tsx
    - frontend/src/providers/__tests__/StreamsProvider.inputs.test.tsx
  modified:
    - frontend/src/stores/streamsStore.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - Action button (no aria-pressed, no composer state), not a mode pill (A-03)
  - sendMessage called un-awaited with fixed text "Run <name>" (A-09, D-07)
metrics:
  tasks: 3
  completed: 2026-10-19
---

# Phase 287 Plan 03: Start a workflow from inside a thread Summary

START-01: in an open thread, "Run a workflow" lists published workflows, collects the declared inputs through its own ChatLaunchForm (plan-01 required-field refusal included), and calls `sendMessage(thread.id, "Run <name>", {workflowDefinitionId, inputs, surfaceId:"chat"})` un-awaited, so the run attaches to the same thread with no thread creation.

## Commits
- 0d30dd881 test: failing sendMessage inputs passthrough (RED)
- feat: forward `inputs` through sendMessage (StreamsProvider +1 line, streamsStore +2 lines, 0 branches)
- 9f17343d2 test: failing picker + hook tests (RED)
- feat: ThreadWorkflowPicker + useStartWorkflowInThread (GREEN)
- test: failing ChatArea mount test (RED)
- feat: ONE mount in ChatArea (+3 lines) + ledger rows/sections + CLAUDE.md rows (GREEN)

## Verification
- `vitest run src/components/chat src/providers src/components/layout` (GSD_VITEST_MAX_WORKERS=2): 98 files, 1158 tests, all green.
- `check-hot-file-ledger.cjs` exit 0 (576 rows, 33 subject files); `check-claude-md-size.cjs` OK (95,559 chars).
- ChatLayout.tsx and MessageInput.tsx absent from `git diff --name-only` against base 37159ec21.
- Counterfactual: planting a string containing the forbidden `createThread` token in the hook made the stripped-source fence fail ("contains none of the forbidden needles in code"); file restored. (A first plant of a bare identifier crashed the module at load instead, so the string plant was the clean drive.)

## Deviations from Plan
- Worktree started on an earlier commit; reset to the expected base per instructions (discarded the unrelated `.claude/settings.local.json` modification).
- `stripComments` strips only full-line `//` comments (documented as crude), so the positive control plants the comment on its own line.
- ChatArea "locked" test seeds the lock via the server's getThreadWorkflow answer (a directly seeded store lock is cleared by mount reconcile).

## Deferred / Pre-existing
- `npx tsc -p tsconfig.app.json --noEmit` reports one error at `streamsStore.ts(477)` (`viewedThreadId` null vs string|null in the zustand initializer). It concerns an untouched line, not the added `inputs` type field; not fixed (out of scope). Plan 04 should confirm by set-diff at base. No errors in any file this plan created.
- Plan 04 adopts `ChatArea.threadWorkflowPicker.test.tsx` and the other new suites in the count-gate TARGETS.

## Known Stubs
None.

## Self-Check: PASSED
All created files exist; commits present in `git log`.
