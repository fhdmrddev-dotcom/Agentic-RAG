# Phase 298 — deferred items

## From 298-04 (2026-10-28)

1. **Chat composer folder scope across an org switch (UI-D10, third bullet).** `ChatArea.tsx`'s
   empty-thread scope `<select>` (`scopeFolderId`) is not reset when the active org changes. If a
   person picks a folder, switches org, and the new org's narrowed list lacks it, the native select
   renders blank and the held id would still be sent with the first message. Not fixed here:
   `ChatArea.tsx` is FIRING (94 / 44) and not in 298-04's `files_modified`; the fix is one
   statement in an existing effect keyed on the org (or a render-time reset), mirroring what
   `ChatLayout`'s org effect now does for `mobileFolderId`. Re-open trigger: the next phase whose
   `files_modified` names `ChatArea.tsx`, or 298-05 if it touches the composer.
2. **An active saved view / ad-hoc filter on the Library survives an org switch.** The switch resets
   the folder selection to Root and closes the panel (UI-D10), but `listTarget` (a saved view or an
   unsaved filter the list resolves) is page state the hook cannot reach without a new argument on
   `LibraryPage`'s call line. Views are per-user, and their resolve is not part of this phase's
   narrowing. Re-open trigger: a view-resolve narrowing decision, or the next LibraryPage touch.
   **CLOSED 2026-10-28 by 298-review WR-01:** `useLibraryOrgSwitch` takes an optional `listReset`
   (`findDispatch`, `setListTarget`) — one property on LibraryPage's call — and the switch reset now
   clears the Find search and the list target, as `handleSelectFolder` does.
3. **The DescribeKbPicker surrender now takes one round trip.** A held id the folder list does not
   offer is kept (shown as `UNNAMED_KB_OPTION`) until the folder-labels read answers. A Draft click
   inside that window sends the held id. The id is visible on screen the whole time (CR-R5-01's
   "never sent invisibly" holds); the server's ORG-05 refusal (298-02) is the backstop for a
   foreign folder.
4. **Line-ending-only snapshot rewrites.** Vitest runs rewrote three snapshot files with LF
   (`FilterBar.find271.test.tsx.snap`, `canvasModel.fixtures.test.ts.snap`,
   `WorkflowCanvas.headerPin.test.tsx.snap`); `git diff` shows no content change. Left uncommitted,
   like the three `seam286.pin` snapshots that were already dirty before 298-04.
