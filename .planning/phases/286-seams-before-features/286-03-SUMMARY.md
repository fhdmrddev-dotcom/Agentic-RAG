---
phase: 286-seams-before-features
plan: 03
subsystem: frontend / workflow run surface
tags: [g5-extraction, pure-move, pin-first, frontend, run-page]
requires: []
provides:
  - "frontend/src/hooks/useWorkflowRun.ts: useWorkflowRun (run read + stale guard + CR-01 refreshRun) and useWorkflowRunPoll (5 s beat + terminal edge)"
  - "Characterization pin for the run page's read lifecycle (10 cases, 5 DOM snapshots)"
affects:
  - "Phases 288 / 289 (edit WorkflowRunPage.tsx; the read lifecycle now lives in one hook file)"
  - "Plan 286-05 (ledger row owed for frontend/src/hooks/useWorkflowRun.ts)"
tech-stack:
  added: []
  patterns:
    - "Two hooks called at the two original positions, so the page keeps the CR-01 derivation order"
    - "Mechanical move by line slice (script), proven verbatim against the base blob"
key-files:
  created:
    - frontend/src/hooks/useWorkflowRun.ts
    - frontend/src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx
    - frontend/src/pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap
    - .planning/phases/286-seams-before-features/286-03-BASE.md
  modified:
    - frontend/src/pages/WorkflowRunPage.tsx
decisions:
  - "Elapsed anchor stays in WorkflowRunPage.tsx: WorkflowRunPage.test.tsx:2110-2111 and runStepCount.test.ts:229-235 pin fmtElapsed(end - anchorMs) / fmtElapsed(nowMs - anchorMs) in the page source"
  - "TERMINAL_RUN_STATUSES and the isTerminal derivation stay in the page (D-09); useWorkflowRunPoll is called after it"
  - "RUN_POLL_MS is module-private in the hook (no test needs it); LoadPhase is exported but not imported by the page, which no longer uses it"
metrics:
  duration: "~35 min"
  completed: 2026-10-18
  tasks: 2
  files: 5
requirements: [REG-07]
---

# Phase 286 Plan 03: Run read and poll seam (WorkflowRunPage) Summary

The run page's read lifecycle now lives in `frontend/src/hooks/useWorkflowRun.ts`. That is the mount read with its stale-response guard and 404 wording, the CR-01 `refreshRun`, the 5 s poll, and the terminal-edge reconcile. The page calls two hooks at the positions the moved code used to occupy, so the poll still sits after `isTerminal` is derived. The text was moved verbatim, and a behaviour pin written first stayed byte-unchanged across the move.

## What was done

**Task 1 — pin first (`d84ff106d`).** I wrote `WorkflowRunPage.seam286.pin.test.tsx` against the unmoved page. It has 10 cases and 5 DOM snapshots:
- **Load screens:** loading while a read is in flight, loading for a null id (no read), ready, missing on 404 (no Try again), and broken on 500 (Try again shown).
- **Poll:** nothing happens before 5000 ms. At 5000 ms there is exactly one read, and `reconcile`, `reconcileStream("thread-1")` and `reconcileAsks` each fire once on that beat. Once a read comes back terminal, advancing 15000 ms more triggers no further reads.
- **Terminal edge:** the terminal read is held in flight, so the beat's own reconcile is counted separately from the edge's. On the transition, `reconcile` and `reconcileFiles` each fire exactly once more. A rerender plus 15 s triggers neither again.
- **Stale guard:** run A resolving after run B was opened never puts A on screen.
- **Retry:** Try again re-reads the same id and reaches the ready screen.
- **Refresh blip:** a failed refresh leaves the ready surface standing.

I made two throwaway edits to prove the pin can fail (both recorded in BASE.md):
- `RUN_POLL_MS` 5000 → 4000 turned the cadence case red.
- `COPY_MISSING_BODY` "deleted" → "removed" turned the missing-screen snapshot red.

Both edits were reverted, and the working-copy md5 is back to `764ba4ff…`.

`286-03-BASE.md` records:
- the base SHA
- every `?raw` and glob consumer, with what it asserts and a prediction (all green, none red)
- the 63-line tsc error set
- the hooks-rules verdict
- the base counts

**Task 2 — the move (`80f24c5ba`).** A script sliced lines 419-420, 427-431, 442-502 and 1085-1151 out of the page and into the hook, and rewrote the page around them. Checked against the base blob, all four slices are **VERBATIM** in the hook.
- **Top of the component:** the old state block is now `const { run, loadPhase, setRetryNonce, refreshRun } = useWorkflowRun(runId)`.
- **Old effect site (line 1040 after the move):** the two effects are replaced by one `useWorkflowRunPoll({ runId, loadPhase, isTerminal, run, refreshRun, reconcile, reconcileAsks, reconcileStream, reconcileFiles })` call. It comes after `const isTerminal = TERMINAL_RUN_STATUSES.has(runStatus)` (line 782).
- **Dated tombstones** sit at every old site. The CR-01 paragraph explaining why the beat comes after the derivation is kept in the page at the call site, and the full comment moved with the effect.
- **Imports:** `getWorkflowRun`, `ApiError` and `type WorkflowRunRead` are gone from the page's imports. The hook imports them from the same `@/lib/api` specifier, so the existing `vi.mock`s still intercept them.

## Measurements

| | Before (base `d45bef9e2`) | After (`80f24c5ba`) |
|---|---|---|
| `WorkflowRunPage.tsx` `wc -l` | 1679 | **1578** |
| page bytes | 97756 | 92951 (StopControl fence needs > 20000) |
| page `grep -c "useEffect("` | 7 | **4** |
| page `grep -cE "useState[<(]"` | 7 | **4** |
| `useWorkflowRun.ts` `wc -l` / useEffect / useState | — | 218 / 3 / 3 |

Acceptance greps after the move:
- `useWorkflowRunPoll(` appears in the page **1** time.
- `getWorkflowRun(` appears **0** times in the page and **2** times in the hook.
- `<StopControl` appears **1** time.
- `fmtElapsed(nowMs - anchorMs)` is still in the page.
- `reconcile()` is still in the page (3 occurrences; onWake keeps it).
- None of the page's four forbidden identifiers (spelled out in WorkflowRunPage.test.tsx), nor `RunReceipt`, appear in the hook.

**Pin numstat across the move:** `git diff --numstat d84ff106d HEAD -- <pin> <snap>` prints **nothing**. Measured from the plan base `d45bef9e2`, the same command shows `372 0` / `11 0`, because the pin was created in this plan's Task 1. The move commit `80f24c5ba` touches exactly `useWorkflowRun.ts` and `WorkflowRunPage.tsx`.

**Tests edited: none.**

Targeted suites, all `--maxWorkers=2`, none edited:
- **The 11 named suites:** the pin, WorkflowRunPage, StopControl.baseline, MessageItem.inlineApproval, runStepCount, RunReceipt, FileRow.sweep, PendingAskStack.oneInput, PendingAskCard.retired.baseline, ChatLayout.badge and attentionTab. Result: **11 files / 318 tests passed**. At base, the ten consumers ran 10 / 308 green.
- **The other 11 whole-src glob sweeps:** StreamsProvider.stopping, argumentVocabulary, libraryListFence, ChatLayout.scrollFrame, connectionMark, apiRunFields.fences, doorVocabulary, ExternalActionSection, McpToolPicker.reachability, noFrontendTokenPricing and StepIdentity.coverage. Result: **11 files / 322 passed**.
- **tsc** (`-p tsconfig.app.json`): the set diff against base is **empty**.
- **`check-react-hooks-rules.cjs`:** OK, no new violation.
- **eslint:** the same two `set-state-in-effect` findings as base. The one at base page line 447 moved with the code to hook line 60, and the alert effect's finding stays in the page. I checked the base by linting `git show HEAD:…` through `--stdin`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `LoadPhase` is not imported into the page**
- **Found during:** Task 2
- **Issue:** The plan said to import `type LoadPhase` into the page. After the move the page has no reference to it, and an unused import breaks `noUnusedLocals` in tsc.
- **Fix:** It is exported from the hook (for future readers and tests) but not imported by the page.
- **Commit:** `80f24c5ba`

**2. [Process] The first throwaway revert changed line endings**
- **Found during:** Task 1, first non-vacuity check
- **Issue:** Reverting with `sed -i` rewrote the CRLF working copy as LF. The content matched the HEAD blob, but `git status` showed `M`.
- **Fix:** `git checkout --` on that single file restored md5 `764ba4ff…`. The second check used the Edit tool, which keeps CRLF.
- **Commit:** none (nothing was committed in between)

### Notes, not deviations
- The moved comments still say "above" where they meant a neighbour in the page: the poll's "1s clock above" and "WAKE handler above". They are kept byte-for-byte, and the hook's header docblock explains what each refers to.
- Hook order inside the component changed slightly: `useWorkflowRun`'s useState/useRef/useEffect/useCallback now run before `useTechnicalNamesOptional`, which is a plain `useContext`. Effect order is unchanged: the mount read is still the first effect and the beat still runs after the tick.

## Owed to plan 286-05 (ledger wave, D-15)

`node scripts/check-hot-file-ledger.cjs .planning/phases/286-seams-before-features` reports `[no-row] frontend/src/hooks/useWorkflowRun.ts`. The new hook needs a row in the scan list in `docs/HOT-FILE-LEDGER.md` and a section of its own. The `WorkflowRunPage.tsx` row needs re-deriving: its "the run read + its poll" seam is now TAKEN. This plan did not touch the ledger, because D-15 assigns the ledger to the last wave. The same gate output also flags `useBuilderNameMaps.ts`, which belongs to 286-02.

## Threat model

- **T-286-12** (stale guard): moved verbatim, and the pin's run-switch case passes before and after.
- **T-286-13** (404 copy): moved verbatim, and the missing-screen snapshot is unchanged.
- **T-286-14** (poll DoS): cadence and teardown are pinned with fake timers, and the beat is called after the derivation (line 1040 > line 782).
- **T-286-15** (`?raw` fences): consumers were inventoried before the move, and all ran green without edits.

No new threat surface: no new endpoint, auth path, or schema.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: frontend/src/hooks/useWorkflowRun.ts
- FOUND: frontend/src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx
- FOUND: frontend/src/pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap
- FOUND: .planning/phases/286-seams-before-features/286-03-BASE.md
- FOUND commit d84ff106d (test(286-03) pin)
- FOUND commit 80f24c5ba (refactor(286-03) move)
