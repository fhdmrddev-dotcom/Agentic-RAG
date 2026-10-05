---
phase: 274-thread-scoped-attachments
verified: 2026-10-05T21:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (plus all PLAN must-have clusters spot-checked)
overrides_applied: 0
---

# Phase 274: Thread-Scoped Attachments Verification Report

**Phase Goal:** What a person drops into a chat stays in that chat, and the Library grows only when somebody deliberately puts something there.
**Status:** passed. **Re-verification:** No.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Attachment (disk or cloud) is used by the agent in-thread; not in Library, doc search or other threads (ATT-01) | VERIFIED | `workspace.py` composer upload writes `kind=template_input`, `expires_at=NULL` via `lifetime=thread` (lines ~275-383, from-connection at ~478 also `lifetime="thread"`). Board in 274-VALIDATION §1: 8/8 native+OpenRouter providers answered the planted fact (agent CAN read it); 2nd-thread negative, `/document-search` total 0 and DB chunk/doc count 0 on 8/8; `documents(user)` 185→185. Chrome: local and Google Drive attach, only `/workspace/files*` calls, documents 187→187 / 190→190. |
| 2 | Composer has no door that writes Library or connects a cloud source (ATT-02) | VERIFIED | Composer fence `composerNoLibraryDoor.test.ts` (in the 76 passing frontend tests) over MessageInput/useComposerAttachments/ConnectedFilePickerModal/ConnectorsFlyout/InviteExpertDialog/Connections pages; `useComposerAttachments.ts` explicitly avoids `importCloudFile`. Backend minter inventory pinned by `test_274_minter_inventory.py` (set of 6 callers, only promote is new). Not just UI hiding: API half shows no chat path writes `documents`; `connector_watches` 3→3. Live network log + Manage click verified in Chrome (§6.5). |
| 3 | Explicit promote into chosen folder; appears in Library/search; dedup per stated rule (ATT-03) | VERIFIED | `workspace_promote.py` mounted in `main.py:894`; mints through `ingest_splice.async_mint_document_row` with `version_scope="folder"`, `org_id`, `on_conflict="link"`; preview/parity test; folder required (no Root in listbox, confirm disabled until pick). G-4 #3 measured: `documents.folder_id` = chosen X, v2 versioning in same folder, `already` outcome with existing path and "not moved". Review CR-01/CR-02/WR-03/04/05/07 fixed with RED-first tests. |
| 4 | Deleting thread removes un-promoted attachments, leaves promoted docs | VERIFIED | `threads.py` delete collects paths via user-JWT (`collect_thread_workspace_paths`) before delete, then `remove_workspace_paths`. Migration 203 `library_document_id ... ON DELETE SET NULL`; promoted document has no FK to thread. G-4 #4: `storage.objects` 1→0, workspace_files 0, Library copy still `completed` and downloadable (335,738 B, bucket-stored). |

## "How we'd know this failed" checks

| Failure condition | Result |
|---|---|
| ATT-01 passes because agent can't read | NOT TRUE: 8/8 answered planted fact from persisted messages |
| ATT-02 met by hiding a button while an API still writes | NOT TRUE: minter inventory fence + DB deltas zero |
| Promotion lands at root / no folder choice | NOT TRUE: folder required, verified by `documents.folder_id` |
| Promoted doc cascades on thread delete | NOT TRUE: measured |
| Another thread cites the attachment | NOT TRUE: 2nd-thread negative 8/8 |

## Behavioral Spot-Checks (run by verifier)

| Check | Command | Result |
|---|---|---|
| Backend 274 tests | `pytest tests/unit -k 274` | 102 passed |
| Frontend attachments suites | `vitest run src/components/attachments src/lib/attachmentLifetime` | 8 files / 76 tests passed |
| Migration file present | `supabase/migrations/203_workspace_files_library_link.sql` | present |
| Debt markers (TBD/FIXME/XXX) in new promote module and attachments components | grep | none |

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| ATT-01 | 274-01, 03, 05 | SATISFIED | SC#1, SC#4 |
| ATT-02 | 274-02 (inventory fence), 274-04, 05 | SATISFIED | SC#2 |
| ATT-03 | 274-02, 03, 04, 05 | SATISFIED | SC#3, SC#4 |

No orphaned IDs: REQUIREMENTS.md maps only ATT-01..03 to Phase 274 and all are claimed. (REQUIREMENTS.md checkboxes/traceability still read Pending; the orchestrator should flip them at phase completion.)

## Anti-Patterns / Residuals (not gaps)

| Item | Severity | Note |
|---|---|---|
| F-1 residual: panel FileRow name truncated at 345 px | Info | Recorded follow-up; does not falsify an SC |
| F-2 upload response lacks `created_at` (pre-existing); F-3 agent note names prefixed file | Info | Cosmetic, recorded |
| Review WR-02, WR-06, IN-01..06 deferred | Info | Orchestrator-deferred with triggers |
| CR-02 residual: two near-simultaneous promotes into different folders can both mint (per-folder dedup index) | Warning | Documented as out of scope in the fix log; does not break any SC |

## Human Verification

None outstanding for the phase goal: operator approved the G-4 scenarios and board on 2026-10-05 (VALIDATION §5).

Owed outside the phase (not gaps): apply migrations 202 then 203 to production (operator-gated); final vitest count-gate re-run on the orchestrator side (SEED-171 flaky suite `WorkflowBuilderPage.canvas.test.tsx` may flake; I did not independently run the full gate); flip ATT-01..03 and BUG-260905-01 / SEED-247 status in planning docs.

## Gaps Summary

No gaps. Goal achieved with measured evidence (persisted data, DB deltas, Chrome network logs) and re-confirmed by targeted tests and code inspection.

_Verified: 2026-10-05_
_Verifier: Claude (gsd-verifier)_
