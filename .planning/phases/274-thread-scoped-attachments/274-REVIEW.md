---
phase: 274-thread-scoped-attachments
reviewed: 2026-10-05T15:43:29Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/api/workspace.py
  - backend/app/api/workspace_promote.py
  - backend/app/main.py
  - backend/app/models/workspace_promote.py
  - backend/app/services/agent_loop.py
  - backend/app/services/thread_workspace_cleanup.py
  - backend/tests/unit/test_244_attachment_prompt_line.py
  - backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py
  - backend/tests/unit/test_274_attachment_lifetime.py
  - backend/tests/unit/test_274_delete_thread_cleanup.py
  - backend/tests/unit/test_274_migration_203_shape.py
  - backend/tests/unit/test_274_minter_inventory.py
  - backend/tests/unit/test_274_promote_helpers.py
  - backend/tests/unit/test_274_promote_preview_parity.py
  - backend/tests/unit/test_274_promote_route.py
  - frontend/src/components/attachments/AttachmentActionsMenu.tsx
  - frontend/src/components/attachments/AttachmentRowTrailing.tsx
  - frontend/src/components/attachments/folderDisplay.ts
  - frontend/src/components/attachments/FolderPathListbox.tsx
  - frontend/src/components/attachments/LibraryLinkSegment.tsx
  - frontend/src/components/attachments/saveToLibraryCopy.ts
  - frontend/src/components/attachments/SaveToLibraryDialog.tsx
  - frontend/src/components/attachments/useLibraryLinks.ts
  - frontend/src/components/attachments/__tests__/AttachmentActionsMenu.test.tsx
  - frontend/src/components/attachments/__tests__/AttachmentRowTrailing.test.tsx
  - frontend/src/components/attachments/__tests__/FolderPathListbox.test.tsx
  - frontend/src/components/attachments/__tests__/SaveToLibraryDialog.test.tsx
  - frontend/src/components/attachments/__tests__/composerNoLibraryDoor.test.ts
  - frontend/src/components/attachments/__tests__/promoteContract.fence.test.ts
  - frontend/src/components/attachments/__tests__/saveToLibraryCopy.test.ts
  - frontend/src/components/attachments/__tests__/useLibraryLinks.test.tsx
  - frontend/src/components/chat/ChatAttachmentChip.tsx
  - frontend/src/components/chat/composerCopy.ts
  - frontend/src/components/chat/useComposerAttachments.ts
  - frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx
  - frontend/src/components/chat/__tests__/ComposerAttach.composition.test.tsx
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/__tests__/FilesSection.test.tsx
  - frontend/src/lib/attachmentLifetime.ts
  - frontend/src/lib/api/attachments.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/__tests__/attachmentLifetime.test.ts
  - frontend/src/lib/__tests__/attachmentsApi.test.ts
  - frontend/src/types/index.ts
  - scripts/run-274-board.py
  - supabase/migrations/203_workspace_files_library_link.sql
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 274: Code Review Report

**Reviewed:** 2026-10-05T15:43:29Z
**Depth:** standard (diff base `75cd73782`; shared hot files reviewed by their Phase 274 hunks, with surrounding code and called functions traced)
**Files Reviewed:** 47
**Status:** issues_found

## Summary

The read order on all three promote routes is correct. Each route checks thread ownership (404), then reads the attachment row and its bytes on the user-JWT connection, then mints. No service-role client is created in `workspace_promote.py`. The thread-delete cleanup is also sound on its own terms. It derives the path set through RLS, keeps only the caller's own `user_id/` prefix, and runs the removal after the `threads` delete. The storage policy (`workspace_storage_delete_own`) backs that up. A foreign thread yields `[]`. I found no composer path that reaches a minter. The listbox has real combobox/listbox wiring, and the poll in `useLibraryLinks` is cleared both on last-unsubscribe and when nothing is indexing.

The two blockers sit where this phase's new door hands its inputs to the shared minter:

1. **Cross-org folder.** The promote stamps the active org on the new document, but the minter's folder check only compares `user_id`. `GET /folders` lists folders from every org the user belongs to. `folder_is_org_shared` has no org check. So a promote into an org-shared folder from another org shows the content to the wrong org.
2. **Same bytes promoted twice while the first copy is still indexing.** The minter retires the first copy (`is_latest=false`), hits the 23505, and the `on_conflict="link"` arm returns that retired copy as success. The document then drops out of the Library list and out of search, while both chips read "In Library".

Among the warnings, the most consequential is that thread-life attachments are still candidates for the workflow/Deep template resolver, and now with no expiry. Second, the Library receives the sanitised storage name, not the person's filename. Third, three frontend flows misstate or hide the result of a promote.

## Critical Issues

### CR-01: Promote can file an active-org document into another org's folder; an org-shared target exposes the content to the wrong org

**File:** `backend/app/api/workspace_promote.py:333-345` (with `backend/app/services/ingest_splice.py:159-174`, `frontend/src/components/attachments/SaveToLibraryDialog.tsx:85`)

**Issue:** The route passes `org_id=str(active_org)` and `folder_id=str(body.folder_id)` to the minter, and deliberately does no folder check of its own (D-12). The minter's only folder check is `folder_check.data["user_id"] != user_id`, and it never compares `folders.org_id` with the org it stamps. `folders.org_id` is `NOT NULL`, and `GET /folders` (`fetch_visible_folders`, `restrict_org_ids=None`) returns the caller's owned folders in **every** org they belong to. So does the dialog's `listFolders()` call. No org label is shown.

**Failure scenario (traced, not driven):** The user is a member of orgs A and B, with B active. They own an org-shared folder `Board/` in A. The memory notes record that the dev account is in two orgs. They save an attachment into `Board/`:
- The minter's owner check passes, so the document is inserted with `org_id = B, folder_id = Board(A)`.
- The `documents` SELECT policy is `org_id IN current_user_org_ids() AND (... OR folder_is_org_shared(folder_id) ...)`. `folder_is_org_shared` walks `is_org_shared` up the folder ancestry and never checks org. So **every member of org B** can read the document, and org-B retrieval can surface it.
- The intended audience, org A, cannot see it (`org_id = B`).
- The chip still reads `In Library · Board`.

For a non-shared folder the result is a document whose `org_id` disagrees with its folder's. Org-scoped search in the folder's own org will never find it.

**Fix:** Refuse a folder outside the active org before minting. Pass the active org into the check rather than trusting the folder:
```python
# workspace_promote.py, before async_mint_document_row (user-JWT client, RLS-visible read only)
fold = await aexec(
    supabase.table("folders").select("id, org_id").eq("id", str(body.folder_id)).maybe_single()
)
if not (fold and fold.data) or str(fold.data["org_id"]) != str(active_org):
    raise HTTPException(status_code=404, detail="Folder not found")
```
This amends D-12's "never reads `folders`", so record it as a decision. A better long-term fix is to make `mint_document_row` assert `folder.org_id == org_id` whenever `org_id` is passed, so import/watch/Expert get the same guarantee. Also scope the dialog's folder list to the active org (`restrict_org_ids={active_org}`) so the wrong folder is never offered.

### CR-02: Promoting identical bytes into the same folder while the first copy is still indexing retires that copy and reports success; the document vanishes from the Library and search

**File:** `backend/app/api/workspace_promote.py:335-347` (with `backend/app/services/ingest_splice.py:221-269, 316-345`)

**Issue:** Promote calls the minter with `version_scope="folder"` and `on_conflict="link"`. Traced through `mint_document_row`:
1. The dedup check only matches `status='completed'`, so it misses a first copy that is still `pending`/`processing`.
2. The folder-scoped version lookup has no status filter. It finds that pending v1, computes `next_version = 2`, and **runs the retire UPDATE (`is_latest=False`) on v1**. This is a separate PostgREST call with no transaction.
3. The insert of v2 (same org/user/hash/folder, `status='pending'`) violates `documents_dedup_idx (org_id, user_id, content_hash, COALESCE(folder_id,…)) WHERE status <> 'failed'` and raises 23505.
4. The `link` arm re-queries and returns **v1, now `is_latest=False`**, as `is_duplicate=True`. Promote answers 200 `already` and stamps the mark.

`GET /documents` filters `.eq("is_latest", True)` (`documents.py:749`), and retrieval requires `is_latest`. So the only copy disappears from the Library list and from search, while both chips say `Already in Library · X` / `In Library · X`. Nothing ever restores `is_latest`.

**Reproduction:** Attach the same PDF in two chats (or twice in one chat; each upload gets its own prefixed row). Save both to folder X before the first finishes indexing. Opening the chip and the panel dialog for one attachment at once also triggers it. The race also lets the second response overwrite the first attachment's `saved` mark with `already`. The preview misleads in the same window: it shows "Saving makes this version 2" for byte-identical bytes, because its dedup is also completed-only. The root cause is pre-existing in the shared minter (`/documents/upload` with `on_conflict="raise"` retires v1 and then 409s). This door is the first to turn it into a reported success. None of the board's probes cover it: `--promote-probe` waits for `completed` before its D-13 step.

**Fix:** Do the non-failed same-hash check before the version step. At minimum, do it in promote before minting:
```python
live = await aexec(
    supabase.table("documents").select("*")
    .eq("user_id", uid).eq("org_id", org).eq("content_hash", sha256(raw))
    .eq("folder_id", str(body.folder_id)).neq("status", "failed").limit(1)
)
if live.data:  # link to it; never mint, never retire
    ...
```
The proper fix is in `mint_document_row`: check the `documents_dedup_idx` predicate (`status <> 'failed'`, folder-scoped) before versioning. Failing that, in the `on_conflict="link"` arm, set `is_latest=True` back on the linked row. Add a parity case for "same bytes, same folder, first copy pending".

## Warnings

### WR-01: Thread-life chat attachments remain workflow/Deep template candidates, now with no expiry

**File:** `backend/app/api/workspace.py:345-351, 374-375` (consumer: `backend/app/services/template_asset_service.py:204-220, 296-301`)

**Issue:** D-06 required chat attachments and workflow template inputs to become distinguishable. The lifetime split did that (`expires_at` NULL vs set), but `resolve_template_source` Branch 2 still selects the newest `kind='template_input'` row with `expires_at IS NULL OR expires_at > now()`. It applies no extension check, and on first resolve it stamps `run_claim` (`'deep'` for every chat Deep run). Before this phase, a chat-attached PDF could be resolved as "the template" only for 24 h. Now it stays a candidate for the life of the thread. Two failure modes:
- A template-fill run in an old chat picks a PDF/CSV the person attached weeks ago instead of failing cleanly with "No template uploaded".
- A thread-life row claimed once by Deep (`run_claim='deep'`) is permanently foreign to every later workflow run in that thread. That run then gets "This template belongs to a different run or context" with no expiry to clear it.

**Fix:** Have Branch 2 (and its two probe queries) admit only real template inputs: add `AND expires_at IS NOT NULL`, or restrict to the OOXML extensions the renderer accepts. Pin it with a test showing a thread-life row is never resolved.

### WR-02: The Library receives the sanitised storage name, not the person's filename; D-14 versioning cannot match a Library-uploaded original

**File:** `backend/app/api/workspace_promote.py:101-109, 325` (source of the name: `backend/app/api/workspace.py:357-360`)

**Issue:** `library_filename` strips the 8-hex prefix (D-27), but the remainder is `safe_name`, produced by `re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)`. Saving `Q3 Report (final).docx` creates a Library document named `Q3 Report _final_.docx`, and `Übersicht.docx` becomes `_bersicht.docx`, permanently. D-14's same-name rule then never matches the same file uploaded through the Library door, which keeps the original name. The person gets two unrelated documents instead of "version 2". The preview's version warning also names the mangled file. The original name is not stored anywhere, so this cannot be repaired after the fact.

**Fix:** At upload (`_persist_workspace_upload`), store the original filename, for example in a `metadata.original_filename` or a new column in the same migration family. Have `library_filename` prefer it, falling back to the stripped path.

### WR-03: Re-promoting an already-linked attachment into a different folder silently "succeeds" and never says where the copy is

**File:** `backend/app/api/workspace_promote.py:320-323, 246-285`; `frontend/src/components/attachments/SaveToLibraryDialog.tsx:124-130`

**Issue:** `_existing_link` returns the stored mark, including its original `outcome`, whatever folder was picked. If that mark is `saved`, the POST answers 200 `outcome: "saved"` with `folder_id` = the old folder. The dialog only branches on `outcome === "already"`, so it calls `onSaved` and closes as if the file had landed in the folder just picked. D-13 requires the dialog to state that difference, and here it is hidden.

This is reachable whenever the client offers the verb on a linked file. `offerVerb = state.link === null` is true in the `UNKNOWN` state (before the first `library-links` answer, or after it failed: a rejected fetch keeps the empty map), and in a second tab.

**Fix:** In the dialog, treat any result whose `folder_id !== picked` as the already screen. On the server, return `outcome: "already"` from the short-circuit when `body.folder_id` differs from the linked document's folder.

### WR-04: Panel row: the `In Library` segment is a tab stop inside `role=option`, and Enter on it opens the file preview instead of the document

**File:** `frontend/src/components/attachments/LibraryLinkSegment.tsx:88-101`, `frontend/src/components/attachments/AttachmentRowTrailing.tsx:44-47`, `frontend/src/components/panel/FilesSection.tsx:230-236`

**Issue:** `CitationNavProvider` is mounted app-wide (`App.tsx:390`), so on the panel row the segment always renders as a `<button>` with the default tab index. `AttachmentRowTrailing` itself says an interactive tab stop inside a `role=option` breaks the listbox, and that is why the `⋯` trigger gets `tabIndex={-1}`. The segment gets no such treatment. Its handler stops only `click`. A keyboard Enter on the focused segment bubbles to the row's `onKeyDown`, which calls `e.preventDefault()` and `openFile(file)`. The button's native Enter activation is cancelled, and the file preview replaces the list. Keyboard users cannot open the Library document from the panel; mouse users can.

**Fix:** On the panel variant, pass `tabIndex={-1}` to the segment and give the row a key (or the existing Shift+F10 menu) to open the linked document. Alternatively, stop `keydown` propagation on the segment, as `AttachmentActionsMenu` does with its wrapper.

### WR-05: Panel: the "Already in Library" result screen is unmounted by the next poll and the stated folder difference disappears

**File:** `frontend/src/components/attachments/AttachmentRowTrailing.tsx:42-51`, `frontend/src/components/attachments/AttachmentActionsMenu.tsx:155-161`

**Issue:** The dialog is owned by `AttachmentActionsMenu`. On the panel row, that menu is rendered only while `state.link` is null. The POST stamps the mark before it responds. So the moment the store re-reads the thread, the row swaps the menu for `LibraryLinkSegment`, which unmounts the dialog while it shows `Already in your Library · X / You picked Y`. The store re-reads on the 4 s tick whenever any other attachment in the thread is still indexing. `onSaved` never fires on that path either. This is the D-13 "difference is stated, never hidden" screen. (The chip variant keeps the menu mounted when linked, so only the panel is affected.)

**Fix:** Keep `AttachmentActionsMenu` mounted on the panel row in both states (render the segment beside it, and use `offerVerb` to hide the verb), or lift the dialog above the swap.

### WR-06: A promoted document whose ingestion failed can never be saved again from the chat

**File:** `backend/app/api/workspace_promote.py:246-285`; `frontend/src/components/attachments/AttachmentActionsMenu.tsx:83`

**Issue:** D-25 added `couldn't index` so a failed promote is visible. But `_existing_link` returns the failed document as the link, and the menu hides the verb whenever `link !== null`. The chip says `couldn't index` and offers no way to retry. A new POST just returns the failed link. The only escape is to find and delete the document in the Library, which nothing on the surface suggests.

**Fix:** Treat a linked document with `status == 'failed'` as unlinked in `_existing_link`, and offer the verb when `link.document_status === "failed"`. The minter's dedup already ignores failed rows, so a re-mint works.

### WR-07: Every refusal is introduced as "You can't save into this folder.", and the API module's claim that the dialog tells 403/404/422 apart is false

**File:** `frontend/src/components/attachments/SaveToLibraryDialog.tsx:132, 239-248`; `frontend/src/lib/api/attachments.ts:13-15`; `frontend/src/components/attachments/saveToLibraryCopy.ts:55`

**Issue:** `handleConfirm` stores only `e.message`, and the dialog never reads `PromoteError.status`. So a 422 `Unsupported file type…` (reachable through the preview while the store is still `UNKNOWN`, since it defaults `promotable: true`), a 404 `File not found` / `Thread not found`, and a 5xx detail all render under the lead `You can't save into this folder.` A type refusal applies to every folder, and this wording sends the person looking for a folder permission that is not the problem. The `attachments.ts` header says the dialog "tells a 403 … from a 404 … from a 422 by `status`". Nothing does.

**Fix:** Keep the `PromoteError` in state and choose the lead by status: 403/404-folder → folder lead, 422 → a type lead, other → `saveFailed`. Or correct the docstring and copy to describe what actually happens.

## Info

### IN-01: Folder options are selectable only through `onMouseDown`

**File:** `frontend/src/components/attachments/FolderPathListbox.tsx:152-156`
**Issue:** An option has no `onClick`. Assistive-technology activation that dispatches only `click` (some screen-reader browse-mode paths and switch access) will not select an option. The combobox arrow/Enter path still works. Uncertain how widespread this is; not driven.
**Fix:** Handle selection in `onClick` and keep `onMouseDown={e => e.preventDefault()}` for focus retention.

### IN-02: The links store's folder list is never refreshed while mounted, and the poll has no ceiling for stuck states

**File:** `frontend/src/components/attachments/useLibraryLinks.ts:37, 89-108`
**Issue:** `foldersLoaded` stays true for the entry's lifetime, so a folder created after the first load has `leaf = null`, and the mark reads `In Library` with no folder. `paused` and a `pending` row that the worker never picks up count as "indexing", so the store re-fetches every 4 s for as long as the chat is open. It stays bounded by mount, but never terminates on its own.
**Fix:** Pass `withFolders` when a link's `folder_id` is not in the cached list. Back off or cap the poll after N unchanged ticks.

### IN-03: Migration 203's FK can be used as a document-id existence oracle by a direct PostgREST PATCH

**File:** `supabase/migrations/203_workspace_files_library_link.sql:38-39`
**Issue:** `workspace_files_update_own` has no column restriction, so a user can PATCH their own row's `library_document_id` to any UUID. FK checks bypass RLS, so success versus a 23503 error tells them whether that document exists. Every reader re-checks visibility through RLS, so no data leaks. UUIDs make this low-value.
**Fix:** Optional. Revoke `UPDATE (library_document_id, library_link)` from `authenticated` and stamp through a narrow path, or accept it and record the decision.

### IN-04: `PromoteResult.version_number` is `number` on the client but `int | None` on the server

**File:** `frontend/src/lib/api/attachments.ts:34` vs `backend/app/models/workspace_promote.py` (`version_number: int | None`)
**Fix:** Type it `number | null` so the fence catches a null instead of letting it read as a number.

### IN-05: The agent note now tells the model that TTL template inputs persist too

**File:** `backend/app/services/agent_loop.py:1328-1332`
**Issue:** The allow-list is the shared `kind='template_input'`, so panel-uploaded 24 h template inputs also appear under "They stay with this conversation for as long as it exists". That is false for those rows. This is the inverse of the D-26 fix. Low impact.
**Fix:** Render the persistence sentence only when every listed row has `expires_at IS NULL`, or annotate TTL rows individually.

### IN-06: Bytes written between the collect and the `threads` delete are orphaned

**File:** `backend/app/api/threads.py:1444-1452`, `backend/app/services/thread_workspace_cleanup.py:53-60`
**Issue:** `write_file` upserts the row, then uploads to the bucket, then sets `content_storage_path`. An upload or agent write that lands after the collect, or an upload whose bucket PUT finishes after the cascade, leaves an object that no row names. The module already states that best-effort applies. Recorded so the residual is known rather than discovered.
**Fix:** Optional. Add a periodic sweep of `workspace-files/<uid>/<thread>/` prefixes whose thread no longer exists, run as the owning user.

---

_Reviewed: 2026-10-05T15:43:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
