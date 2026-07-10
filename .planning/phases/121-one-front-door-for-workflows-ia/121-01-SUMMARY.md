---
phase: 121-one-front-door-for-workflows-ia
plan: 01
subsystem: ui
tags: [react, composer, chat, workflow, removal, vitest, typescript]

# Dependency graph
requires:
  - phase: 092-dual-mode-wiring
    provides: the Deep/Harness toggle + in-chat workflow picker + kickoffWorkflowId staging this plan removes
  - phase: 103-workflows-page-authoring
    provides: the Workflows-page launch route (doRun → postMessage with workflowDefinitionId) that becomes the single front door
provides:
  - 2-pill composer (Model + General/Explorer) — the Deep/Harness toggle and in-chat workflow picker are gone
  - workflowLocked gating preserved byte-identical (textarea disable + running placeholder + Send gate)
  - composer-stop confirmed as the reachable Cancel for a locked+streaming thread (D-01, no new chrome)
  - mount reconcile + 409 lock banner + workflowLock derivation preserved unchanged
affects: [121-02 (ChatAreaMode.test.tsx rewrite — currently transiently RED by design), 124-workflow-studio-ux, IA-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop-seam top-down deletion: cut render-site consumers first, then derived locals, then interface props + destructure, then orphaned imports — so no symbol dies before its last reader (PATTERNS Edit Op 1/2)"
    - "KEEP-adjacent-to-REMOVE discipline: workflowLocked sat inside the removed prop cluster but is load-bearing; cut around it, never into it (Pitfall 1)"

key-files:
  created: []
  modified:
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ChatArea.tsx

key-decisions:
  - "composer-stop is the post-removal Cancel (D-01) — no new .runchip / status chip added"
  - "kickoffWorkflowId staging deleted as dead code; postMessage/doRun launch route untouched (SC#2, D-02)"
  - "Sparkles kept in ChatArea (welcome-state JSX) but removed from MessageInput (only the deleted controls used it there)"

patterns-established:
  - "Removal-phase verification = rg removal-clean + tsc --noEmit (not the full suite) — a sibling test going RED by design is expected, not a failure"

requirements-completed: [IA-01]

# Metrics
duration: ~6min
completed: 2026-06-22
---

# Phase 121 Plan 01: One Front Door for Workflows (IA) Summary

**Removed the Deep/Harness composer toggle and in-chat workflow picker — leaving a 2-pill composer (Model + General/Explorer) — while preserving the per-thread workflow lock, 409 banner, mount reconcile, and the composer-stop Cancel byte-identical.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-22T18:57:02Z (phase execution start, per STATE)
- **Completed:** 2026-06-22T19:02:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Deleted the two composer mode affordances (`workflow-mode-selector` Deep/Harness toggle + `workflow-picker`) and their entire prop/state/handler graph across both files (IA-01, D-02).
- Preserved the SC#3 lock surface exactly: `workflowLocked` still disables the textarea, swaps the "Workflow running — Cancel to switch back" placeholder, and gates Send; the mount reconcile, the 409 lock banner, and the `workflowLock` derivation are byte-unchanged.
- Confirmed `composer-stop` is the reachable Cancel for a locked+streaming thread (D-01) — no new composer chrome added.
- Kept the Workflows-page launch route (`doRun` → `postMessage` with `workflowDefinitionId`) fully intact (SC#2); only the in-chat `kickoffWorkflowId` staging died as harmless dead code.
- TypeScript compiles clean; RunCard timer/model no-regression tests stay GREEN (35/35); no backend file and no migration touched (D-06 / G-5).

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the two mode controls + their props/state from MessageInput.tsx (the 2-pill composer)** - `131584b6` (feat)
2. **Task 2: Stop passing the removed props + delete the picker-feed state and the dead kickoff branch in ChatArea.tsx** - `6f8276de` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — see final docs commit.

## Files Created/Modified
- `frontend/src/components/chat/MessageInput.tsx` - Removed the Deep/Harness toggle + workflow picker render blocks, the 6 mode/picker props, the `WorkflowOption` interface, the `labelMode` derivation, and the now-unused `Workflow`/`Sparkles` lucide imports. KEPT: `agent-mode-selector`, Provider/Model pills, `workflowLocked` gating, `composer-stop`, per-thread drafts.
- `frontend/src/components/chat/ChatArea.tsx` - Stopped passing the 6 removed props (kept `workflowLocked={workflowLocked}`), deleted the 3 picker/toggle `useState` + their thread-switch resets + the `listPublishedWorkflows` mount fetch effect + the dead `kickoffWorkflowId` branch in `handleSend` (dropped the 7th `sendMessage` arg + stale deps), and removed the orphaned `listPublishedWorkflows` / `PublishedWorkflow` / `requestOpenPanel` imports. KEPT: `workflowLock` derivation, the full mount reconcile, the 409 banner, `isStreaming`, `stopStreaming`/`onStop`. `Sparkles` retained (welcome-state JSX).

## Decisions Made
- **`composer-stop` is the Cancel (D-01):** Did not build the sketch's `.runchip` status chip — the existing red Stop button (renders while `isStreaming`, routes `onStop` → `stopStreaming` → `cancelRun`) is the reachable Cancel for a locked+streaming thread. No new composer chrome.
- **Dead code only, launch route live (D-02 / SC#2):** Deleted only the in-chat `kickoffWorkflowId` staging in `ChatArea.handleSend`; the `postMessage(..., {workflowDefinitionId})` API function and `ChatLayout.doRun` are untouched so the Workflows-page launch still works. Dropped the 7th positional `sendMessage` arg (param defaults to `undefined`) — the Deep send path stays byte-identical (red line / D-14).
- **`Sparkles` asymmetry:** Removed from `MessageInput` (only the deleted controls used it there) but kept in `ChatArea` (still used by the welcome-state hero icon).

## Deviations from Plan

None - plan executed exactly as written.

The plan's per-task `<read_first>` line numbers drifted by a few lines against live code (a known, flagged discrepancy in PATTERNS/RESEARCH), but every removal/KEEP seam was identified by symbol and content, not by line number, so no deviation resulted. No bugs, missing functionality, or blocking issues encountered.

## Issues Encountered
- One `Edit` `old_string` match failed on the first attempt for the `<MessageInput>` prop cluster because the file's leading indentation differed from the broader block I quoted. Resolved by narrowing `old_string` to the exact 6-prop cluster (verified against the live read). No functional impact.

## Known Stubs
None. This is a pure removal — no hardcoded empty values, placeholder text, or unwired components were introduced. The verification-block "transient RED" in `ChatAreaMode.test.tsx` is by design (Plan 02 rewrites it) and is NOT a stub.

## User Setup Required
None - no external service configuration required. Frontend-only code change; a normal Vite rebuild picks it up.

## Next Phase Readiness
- **Plan 02 (next wave):** `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` is now transiently RED — its current assertions expect `workflow-mode-selector` to exist. This is the documented expected state; Plan 02 rewrites those 3 tests to assert the pill is GONE + the 2 KEEP pills remain + Cancel-reachability + the `workflowLocked` preserve. Do NOT "fix" it by re-adding the control.
- **No blockers.** `npx tsc --noEmit` passes; RunCard no-regression tests GREEN; removed symbols now appear ONLY in `ChatAreaMode.test.tsx` (the Plan 02 rewrite target), confirming the 3-file blast radius collapsed to the expected single test file.
- SC#10 4-axis cross-provider live UAT is authored under `121-VALIDATION.md` (not plan tasks) and stays a verify-phase gate.

## Self-Check: PASSED

- Files verified present: `121-01-SUMMARY.md`, `MessageInput.tsx`, `ChatArea.tsx`.
- Commits verified in git log: `131584b6` (Task 1), `6f8276de` (Task 2), `900744e1` (SUMMARY).

---
*Phase: 121-one-front-door-for-workflows-ia*
*Completed: 2026-06-22*
