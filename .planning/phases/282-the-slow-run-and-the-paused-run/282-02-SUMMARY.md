---
phase: 282-the-slow-run-and-the-paused-run
plan: 02
subsystem: ui
tags: [ask_user, pending-question, draft-store, zustand, a11y, radio-group, panel, chat, tdd, bug-260918-01, bug-260828-07]

requires:
  - phase: 244-15
    provides: "PendingAskStack settleAnswered + the two-home ask mounts (chat column + panel)"
provides:
  - "frontend/src/stores/askDraftStore.ts — one draft per ask (tool_call_id), settled marker, panel-home refcount, GC on pendingAsksByThread, resetAskDrafts"
  - "PendingAskCard reads the shared draft; APG radio keyboard (roving tabindex, arrows, Space selects only) + non-colour radio mark"
  - "PendingAskStack home prop; chat-column AskPointer while a panel home is mounted; WorkspacePanel mounts home=\"panel\""
  - "D-15 fences: PendingAskStack.oneInput.test.tsx (11), askDraftStore.test.ts (7), +9 card cases"
affects: [282-03, G-4 rows 1-3, hot-file ledger PendingAskCard.tsx / WorkspacePanel.tsx / askDraftStore.ts / setupTests.ts]

tech-stack:
  added: []
  patterns:
    - "A per-concern zustand store that GCs by subscribing to another store's slice (never on component unmount)"
    - "Mount-presence registry via useLayoutEffect refcount instead of reading a parent's useState"
    - "Global store reset in setupTests.ts afterEach for module singletons"

key-files:
  created:
    - frontend/src/stores/askDraftStore.ts
    - frontend/src/stores/__tests__/askDraftStore.test.ts
    - frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx
  modified:
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/setupTests.ts
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "D-24 supersedes UI-SPEC Surface 2: Space on the selected chip SELECTS ONLY (APG); Enter and mouse click keep the D-13 toggle. G-4 owed item 3 becomes 'Space selects only; Enter or click deselects'."
  - "The settle mechanism for the pointer is a `settled` map in the draft store written in the SAME set() that clears the draft (markSettled); GC drops it when the ask leaves pendingAsksByThread."
  - "markSettled fires on answer success, countdown expiry, and the 404/409 retirements; never on 5xx/other refusals (the card stays answerable and keeps its draft)."
  - "AskPointer lives in PendingAskCard.tsx (no new component file, per CONTEXT G-5)."

patterns-established:
  - "Draft state keyed by tool_call_id, read by every rendering; nothing copied between cards"

requirements-completed: [FIX-07]

duration: ~55min
completed: 2026-10-15
---

# Phase 282 Plan 02: One answer input, one draft Summary

**One `ask_user` pause now shows one answer input: the panel card while the panel shows the pause, a one-line chat pointer (question, the shared draft, a working `Answer in panel →`) beside it, and the full chat card otherwise. Every rendering reads one draft from the new `askDraftStore`, and the option chips are a full APG radio group with a non-colour mark.**

## Performance

- **Start HEAD:** `d1ba70553bc13a137bcac65889d1ceaf07189363` (develop tip; the worktree started on master `a248672f0` and was reset to this base before any work)
- **Completed:** 2026-10-15
- **Tasks:** 3/3 (each RED then GREEN)
- **Files:** 3 created, 6 modified (all within `files_modified`; `git diff --name-only d1ba70553 HEAD` lists exactly the 9 planned paths)

## Accomplishments

- `stores/askDraftStore.ts` (new): `drafts` / `settled` / `panelHomes`, actions `setChoice`, `setFreeText`, `clearDraft`, `markSettled`, `addPanelHome`, `removePanelHome`; selectors `useAskDraft` (stable frozen `EMPTY_DRAFT`), `useAskSettled`, `usePanelHomeMounted`; `resetAskDrafts`. A module-load `useStreamsStore.subscribe(s => s.pendingAsksByThread, …)` deletes drafts and settles whose ask is gone from every thread. `streamsStore.ts` untouched.
- `setupTests.ts`: one global `afterEach(() => resetAskDrafts())`.
- `PendingAskCard`: the two draft `useState`s are gone (reads the store); `markSettled` on success/expiry/404/409; optional `home` prop written as `data-ask-home` beside `data-ask-card`; chips get roving tabindex, Arrow keys move+select with wrap, Space selects only, `flex items-center gap-2`, `ring-2 ring-offset-2` focus, and an `aria-hidden` radio mark with an inner dot when selected.
- `PendingAskStack({ home = "chat" })`: panel home registers presence in `useLayoutEffect`; the chat home renders `AskPointer` while a panel home is mounted for the thread, else today's full card. Early return, wrapper, ordering and other props unchanged.
- `AskPointer` (same file): UI-SPEC Surface 1 exactly; renders nothing when settled or retired; no live region; button focuses the panel card's roving chip (else textarea) and adds a 900 ms static amber outline; a missing card is a silent no-op.
- `WorkspacePanel.tsx`: one line, `<PendingAskStack home="panel" />`; the `pendingAsks.length > 0 &&` condition is byte-identical.

## Task Commits

1. **Task 1 — askDraftStore + global reset**
   - RED `668f4d8a8` test(282-02): one draft home per ask, garbage-collected with the ask
   - GREEN `ec604a533` feat(282-02): askDraftStore — one draft per ask, read by every rendering (FIX-07)
2. **Task 2 — card reads the draft; radio keyboard + mark**
   - RED `ac67c449f` test(282-02): radio keyboard, non-colour mark, and the card reading the shared draft
   - GREEN `3c2c1af6d` fix(282-02): the ask card reads one shared draft and completes the radio pattern (FIX-07)
3. **Task 3 — the input follows the open panel; the pointer**
   - RED `2fb8ba358` test(282-02): one input per pause, wherever the panel is
   - GREEN `3b88e0c26` fix(282-02): the ask input follows the open panel; the chat shows a pointer (FIX-07, BUG-260918-01)

## RED evidence

- **Task 1:** `askDraftStore.test.ts` — `Test Files 1 failed (1) · Tests no tests`; the transform failed resolving `@/stores/askDraftStore` (module missing).
- **Task 2:** `PendingAskCard.test.tsx` — `54 tests | 8 failed` (Tests 1, 2, 3, 4, 5, 6a, 6b, 6c). Test 7 (axe on a pending card with a selection) passed at RED: it guards that the new mark adds no violation, and the shipped card already had none.
- **Task 3:** `PendingAskStack.oneInput.test.tsx` — `11 tests | 10 failed | 1 passed`. The pass is Test 4, the BUG-260828-07 reachability fence (chat-only mount keeps a full answerable card), which is true at base by design. Test 7b was tightened before the RED commit (one `Send Answer` overall, no button in the chat column) so it does not pass vacuously.

## Hook / line deltas (for 282-03's ledger commit)

| File | Before (d1ba70553) | After | Delta |
|---|---|---|---|
| `PendingAskCard.tsx` | 836 lines (`split("\n")` 837); `useState[(<]` 9; `useEffect(` 2; `useLayoutEffect` 0; components `DraftBlock`, `PendingAskCard`, `PendingAskStack` | 1013 lines (`split("\n")` 1014); `useState[(<]` **7**; `useEffect(` 2; `useLayoutEffect` **1** call (grep reads 2 incl. the import); +1 component `AskPointer` | +177 lines; −2 useState, +1 useLayoutEffect, +1 component; `dangerouslySetInnerHTML` 0 → 0; `aria-pressed` 0; `role="radio"` 1 |
| `WorkspacePanel.tsx` | `<PendingAskStack />` | `<PendingAskStack home="panel" />` | 1 line, condition unchanged |

## Pins and count-gate entries

- `PendingAskCard.retired.baseline.test.tsx:238` line-count pin: **837 → 907** (Task 2 commit) **→ 1014** (Task 3 commit), each with a dated "re-baselined, not loosened" comment in the same commit as the card change.
- `scripts/vitest-count-gate.cjs`:
  - BASELINE `"askDraftStore.test.ts": 7` + TARGETS `"src/stores/__tests__/askDraftStore.test.ts"` (Task 1)
  - BASELINE `"PendingAskCard.test.tsx": 45 → 54` (Task 2)
  - BASELINE `"PendingAskStack.oneInput.test.tsx": 11` + TARGETS `"src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx"` (Task 3)
  - Unchanged and green: `PendingAskCard.retired.baseline.test.tsx` 9, `WorkspacePanel.test.tsx` 58, `streamsProvider_244_settle_ask.test.tsx` 16, `MessageItem.inlineApproval.test.tsx` 13, `Seam.test.tsx` 8.

## Verification

- In-scope fences (explicit run): `src/components/panel`, `src/stores`, `MessageItem.inlineApproval`, `streamsProvider_244_settle_ask`, `WorkflowRunPage.test`, `ChatAreaBanner`, `StopControl.baseline`, `ChatHistoryColumn` (+rowIdentity) — **26 files, 667 passed, 0 failed**.
- Unedited and green: `MessageItem.inlineApproval.test.tsx` (6c), `Seam.test.tsx` (84-88), `streamsProvider_244_settle_ask.test.tsx` (9-12). `git diff d1ba70553 --` on MessageList.tsx, MessageItem.tsx, PausedRunCue.tsx, streamsStore.ts, StreamsProvider.tsx, ChatLayout.tsx, WorkflowRunPage.tsx and those three suites is empty.
- tsc set diff: `npx tsc -p tsconfig.app.json --noEmit | sort` at base = 103 lines, after = 103 lines; `comm -13 base after` prints **nothing**.
- Ledger gate: `node scripts/check-hot-file-ledger.cjs 282` → `ledger gate OK` (exit 0; 542 rows, 40 subject files, 20 watched).
- Vitest count gate (one run, repo root, `GSD_VITEST_MAX_WORKERS=2`): **`RESULT: COUNT GATE VIOLATED (1 reason(s))` — `[failing-tests] 1 test(s) failed`; `total 10296 · failed 1 · pinned total 9427`; no `[count-decrease]`.** This plan's four rows read at their pins: `PendingAskCard.test.tsx 54/54`, `PendingAskStack.oneInput.test.tsx 11/11`, `PendingAskCard.retired.baseline.test.tsx 9/9`, `askDraftStore.test.ts 7/7`.
  - **The red, captured from the gate's persisted JSON before any re-run** (copy: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-282/vitest_gate_282-02.report.json`): `src/pages/WorkflowBuilderPage.canvas.test.tsx` › *"WorkflowBuilderPage canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns"*, `Error: STACK_TRACE_ERROR` at 7440 ms (a timeout under full-run load).
  - **Provably unmodified:** `git diff --numstat d1ba70553 HEAD -- frontend/src/pages/ frontend/src/components/workflows/` is empty; `git status --short` shows only this SUMMARY. The suite does not render `PendingAskCard`/`PendingAskStack`.
  - **Same case, same error, before this plan existed:** `280-04-SUMMARY.md` recorded this exact case dying with `STACK_TRACE_ERROR` at the 5 s timeout and classed it "inherited or unproven".
  - One isolated re-run at HEAD: 154/154 passed. A base re-run in isolation would not discriminate (it passes in isolation at HEAD too), so it was not run. ⚠ This plan's only global change is `setupTests.ts` (one import + one `afterEach` per suite), which adds a small fixed setup cost to every file under load; it cannot be fully excluded as a contributor to a load-timing flake. **Status: provably unmodified, pattern inherited, not proven innocent by one green sample.**

## Decisions Made

- **Space (D-24 over UI-SPEC):** the UI-SPEC's keyboard table said Space deselects the selected chip (a deliberate APG deviation). CONTEXT D-24 is later and wins: Space is intercepted in `onKeyDown` (`preventDefault` + select-only). Enter is left to the native button click, so Enter and mouse click keep the D-13 toggle. **For 282-03's G-4 confirmation list, item 3 becomes: "Space selects only; Enter or click deselects."**
- The pointer's settle signal is a `settled` map in the draft store, written in the same `set()` that clears the draft.

## Deviations from Plan

None in behaviour or scope. Two notes:
- The worktree started on `master` (`a248672f0`), not the expected base; it was reset to `d1ba70553` before any work (per the worktree_branch_check).
- `useLayoutEffect` grep count reads 2 (the react import plus the one call); the plan's acceptance is "≥ 1".

## Known Stubs

None. `EMPTY_DRAFT` is a deliberate stable empty value, not a stub.

## Threat Flags

None. No new network surface; prompt, options and draft render as plain React text (T-282-08: `dangerouslySetInnerHTML` count 0 → 0).

## Next Phase Readiness

- 282-03 owns: the ledger rows/sections for `askDraftStore.ts` and `setupTests.ts` (D-25) and the honoured-by-construction figures above; G-4 rows 1-3 and the operator's confirmation of sketch A; the 32 px pointer button, the raised focus ring, the pointer rendering nothing once settled.
- `graphify update .` was not run inside the worktree (it would write graph output into the worktree tree); run it after merge.

## TDD Gate Compliance

All three tasks: a `test(282-02)` RED commit precedes its GREEN commit (668f4d8a8 -> ec604a533, ac67c449f -> 3c2c1af6d, 2fb8ba358 -> 3b88e0c26). No REFACTOR commits were needed.

## Self-Check: PASSED

- FOUND: frontend/src/stores/askDraftStore.ts, frontend/src/stores/__tests__/askDraftStore.test.ts, frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx
- FOUND commits: 668f4d8a8, ec604a533, ac67c449f, 3c2c1af6d, 2fb8ba358, 3b88e0c26
