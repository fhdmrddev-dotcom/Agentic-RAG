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

## From the 298 code review fix (2026-10-28)

5. **298-review WR-08 — the Builder's "lives in <org>" marker is relative to the VIEWER's active
   org, not the definition's.** Reproduced by reading, deterministic: `useBuilderNameMaps` builds
   `folderOptions` from `listFolders()` under the active-org header (narrowed by 298-01) and marks
   a label read with `chipLabel(id, { label, activeOrgId })`; `WorkflowBuilderPage.tsx:2403`'s
   `optionLabel` passes no org at all. A Builder left open on an org-A draft after a switch to B
   (`useDraftPersistence.reload` is header-less on purpose, D-12) therefore offers B's folders as
   plain names and marks the draft's own A folder "lives in A". The server refusal (ORG-05, keyed
   on the row's org) is unaffected, so the harm is a wrong hint, never a wrong write.
   **Not fixed here, because the definition's org is not on the wire:** `list_draft_workflows`
   selects `id, slug, version, name, definition, token, updated_at` (no `org_id`), and
   `WorkflowDraftRow` has no `org_id`. A correct fix needs the projection (`db/workflows.py`,
   FIRING), the client type, `useDraftPersistence` carrying the org to the page, and the page
   passing it to the hook (`WorkflowBuilderPage.tsx`, FIRING) — more than one expression in two
   FIRING files plus a wire change, which is a phase task, not a review fix.
   Re-open trigger: Phase 299 (it adds `org_id` to the run read and touches the same wire), or
   the next phase whose `files_modified` names `useBuilderNameMaps.ts` or `db/workflows.py`.
