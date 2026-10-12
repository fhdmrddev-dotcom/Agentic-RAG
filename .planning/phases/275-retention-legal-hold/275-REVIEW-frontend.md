---
phase: 275-retention-legal-hold
reviewed: 2026-10-12T12:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - frontend/src/components/retention/ArchivedHiddenLine.tsx
  - frontend/src/components/retention/DeleteBatchCard.tsx
  - frontend/src/components/retention/HoldRefusalNotice.tsx
  - frontend/src/components/retention/LegalHoldDialog.tsx
  - frontend/src/components/retention/LegalHoldsList.tsx
  - frontend/src/components/retention/ReleaseHoldDialog.tsx
  - frontend/src/components/retention/RetentionChip.tsx
  - frontend/src/components/retention/RetentionFolderLine.tsx
  - frontend/src/components/retention/RetentionHistory.tsx
  - frontend/src/components/retention/RetentionPolicies.tsx
  - frontend/src/components/retention/RetentionPolicyEditor.tsx
  - frontend/src/components/retention/RetentionPreview.tsx
  - frontend/src/components/retention/RetentionSection.tsx
  - frontend/src/components/retention/RetentionTab.tsx
  - frontend/src/components/retention/ReviewBatchCard.tsx
  - frontend/src/components/retention/WaitingForYou.tsx
  - frontend/src/components/retention/retentionCopy.ts
  - frontend/src/components/retention/useRetentionStates.ts
  - frontend/src/lib/api/retention.ts
  - frontend/src/lib/api/refusal.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/api/sources.ts
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/ingestion/DocumentRow.tsx
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/library/find/DocumentsFindBody.tsx
  - frontend/src/components/library/find/FindQuickAdd.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/pages/findState.ts
  - frontend/src/types/index.ts
findings:
  critical: 2
  warning: 12
  info: 10
  total: 24
status: issues_found
---

# Phase 275: Code Review Report (frontend)

**Reviewed:** 2026-10-12
**Depth:** standard (modified shared files reviewed as the `b41d51d6b..HEAD` diff with context; backend routes read where a frontend claim depended on them)
**Files Reviewed:** 33
**Status:** issues_found

## Summary

I traced the eight priority checks against the code and, where a finding depended on server behaviour, against `backend/app/api/retention.py` and `backend/app/services/retention/disposition.py`.

**What holds up:**
- **The type-the-count confirm cannot be bypassed.** The button and `Enter` use the same `enabled` check. `deleteIds` and the label's N come from the same render. Every tick change clears `typed`. The server re-checks `typed_count == len(delete_ids)` (`disposition.py:436`).
- **The Save gate is correct.** Preview captures the draft key before it awaits, so an edit made mid-flight reads as stale. Every field edit goes through `set()`. The server also requires a recorded preview hash.
- **Member hold copy never reads `hold_names` on the member branch.**
- **The shared Include archived state works for folder browse and Find.**

**What does not:**
- **The "Reload" path re-mounts batch cards with stale tick state.** Rows that arrive after the remount are pre-unticked, so they are submitted as **kept** decisions the admin never made (CR-01).
- **Server refusals on retention writes are swallowed, and two of them are replaced with sentences that state the opposite of the truth.** A release that 409s because the hold is already released says "It is still in force." (CR-02). A confirm that 422/503s with nothing written says "Some documents may already be deleted." (WR-01).
- **Several stale-async and display/state mismatches** (WR-04 to WR-12).

## Critical Issues

### CR-01: Reload re-mounts batch cards before the new queue arrives, so new rows start unticked and are submitted as "kept"

**File:** `frontend/src/components/retention/WaitingForYou.tsx:56-59, 81-83`; `frontend/src/components/retention/DeleteBatchCard.tsx:228-239, 281-291`

**Issue:** `reload()` calls `setGeneration(g + 1)` synchronously and `load()` asynchronously. The cards' key is `${policy_id}-${generation}`, so they re-mount immediately **with the old `batch`**. `DeleteBatchCard`'s lazy `useState` initialiser then ticks only the **old** row ids.

When `listQueue()` resolves, `setQueue(res)` re-renders with the same key, so there is no remount and `ticked` keeps the old ids. Any row the sweep queued in the meantime has `ticked[id] === undefined`, so:
- it renders struck through;
- it lands in `keepIds` (line 237);
- it is sent as `keep_ids` on confirm.

The server writes a "kept by {admin}" receipt, and per D-11 the document is never proposed again until the policy or the document changes.

Worst case: every old row has left the queue and only new rows remain. Then `allKept` is true, and **one click on "Keep N documents" with no typed count** exempts documents the admin never saw ticked. This path is exactly the one the failure copy tells the admin to take ("Reload this list before trying again").

This breaks the contract "Every row starts ticked" (S4) and writes audit-ledger decisions nobody made. The same remount also briefly resurrects a card that has already been confirmed. If the reload then fails, that card stays, fully ticked.

**Fix:** Re-mount only after the data lands, and derive tick state from the rows rather than freezing it at mount:
```tsx
// WaitingForYou
const reload = async () => {
  await load()
  setGeneration((g) => g + 1) // remount AFTER the new rows are in state
}
// and/or DeleteBatchCard: key the tick map by the row set
const rowKey = batch.rows.map((r) => r.document_id).join(",")
useEffect(() => {
  setTicked(Object.fromEntries(batch.rows.map((r) => [r.document_id, true])))
  setTyped("")
}, [rowKey])
// and treat an unknown id as ticked, never as kept:
const isTicked = (id: string) => ticked[id] !== false
```

### CR-02: Release and Remove failures replace the server's refusal with a sentence that contradicts it

**File:** `frontend/src/components/retention/ReleaseHoldDialog.tsx:53-66, 95-99`; `frontend/src/components/retention/RetentionPolicyEditor.tsx:254-265, 517-521`

**Issue:** `releaseHold` returns **409 "This hold is already released."** when another admin released the hold first (`retention.py:544, 551`). The `catch {}` discards the `ApiRefusal` and shows `Couldn't release the hold. It is still in force.`

The list is not reloaded on failure, so the card keeps showing "Holding". The admin is told a legal hold is in force when it is not. From that moment, policies can archive those documents or queue them for deletion.

`removePolicy` has the same shape. A 404 "policy not found" (already removed) renders `Couldn't remove the policy. It is still active.`

Priority check 3 requires refusals to be shown and never swallowed. Here they are swallowed and replaced with their negation.

**Fix:** Render the server's sentence for refusals, and keep the contract copy only for transport/5xx failures. Reload the list on a 404/409:
```tsx
} catch (err) {
  if (err instanceof ApiRefusal && err.status >= 400 && err.status < 500) {
    setFailure(err.message)  // "This hold is already released."
    onDone()                 // re-read the list so the card stops saying "Holding"
  } else {
    setFailure(C.contract.releaseFailed)
  }
}
```

## Warnings

### WR-01: Batch confirm swallows every refusal and claims deletes may have run when the server wrote nothing

**File:** `frontend/src/components/retention/DeleteBatchCard.tsx:241-253`; `frontend/src/components/retention/ReviewBatchCard.tsx:47-65`

**Issue:** `confirm_batch` refuses **before any write** in each of these cases:
- **422** `Type N to confirm.` / `A document can have only one decision.` / `Nothing was chosen.` (`disposition.py:436-442`)
- **404** `That policy no longer exists.`
- **503** `LOAD_INCOMPLETE` ("…Nothing was changed.")

All of them render `Couldn't confirm the batch. Some documents may already be deleted…`. That is a false alarm, and the server's sentence is lost. `retention.ts`'s own header promises the opposite: doors render "Type 4 to confirm.".

**Fix:** Branch on `err instanceof ApiRefusal`:
- For 4xx/503, show `err.message`; nothing was written.
- Keep `confirmFailed` only for network errors or 5xx without a refusal, where partial work is genuinely possible.

### WR-02: The hold typeahead offers documents from other orgs, and the resulting 422 is swallowed

**File:** `frontend/src/components/retention/LegalHoldDialog.tsx:109-115, 165-178`

**Issue:** `listDocuments()` calls `GET /documents`. That route filters only by `user_id` and `is_latest`, plus global folders (`backend/app/api/documents.py:745-766`), with no `org_id` predicate. An admin in two orgs (the dev account is) therefore gets their own documents from the other org, and personal ones, as suggestions.

`create_hold` / `extend_hold` require every id to be in the active org and return **422** `HOLD_IDS_REFUSED` ("…not in this organization or not visible to you. Nothing was held."). The 409 `This hold has been released. Place a new hold instead.` is a second refusal on the same path. Both are swallowed into:
- `Couldn't place the hold. Nothing changed. Nothing is held yet.`, or
- `…The hold still covers what it did before.` (false after a release).

The admin cannot tell which pick is wrong.

**Fix:**
- Filter suggestions to the active org (`d.org_id === getActiveOrgId()`), or source them from an org-scoped endpoint.
- Render `err.message` for `ApiRefusal` 4xx.

### WR-03: The result banner hides documents the admin approved that were not deleted

**File:** `frontend/src/components/retention/DeleteBatchCard.tsx:161-205`

**Issue:** `ConfirmResult` carries `did_not_delete` with `reason: "changed"` (`disposition.py:496, 538`), plus `not_found` and `skipped`. The banner reports only `deleted`, `archived`, `kept` and the `held` subset of `did_not_delete`.

Example: an admin types 5. Two documents were edited since the sweep. The banner reads **"Done · Deleted 3 documents."** It never says that two approved deletions did not happen. When nothing at all was done, it reads "Done · Deleted 0 documents."

**Fix:** Add a clause for `did_not_delete.filter(r => r.reason !== "held")`, `not_found` and `skipped`, for example "Not deleted: {names}: changed since the sweep." Do not render the green "Done" chip when every requested action was dropped.

### WR-04: The posture line says "finished, nothing failed" while a sweep is running or has crashed

**File:** `frontend/src/components/retention/RetentionTab.tsx:31, 56-73`

**Issue:** `last_status` can be `'running'` (migration 204 CHECK; set at claim, `db/retention.py:115, 135`). On claim, `last_run_at` is not updated, so it still holds the **previous** run's time. The previous run's outcome has been overwritten.

`FAILED_STATUSES` covers only `failed` and `incomplete`, so `'running'` falls through to the healthy branch: `Last sweep {previous} finished, nothing failed`. That claim is unverifiable, because the previous status is gone. If a worker crashes mid-sweep, the status stays `'running'` and the healthy line never clears.

**Fix:** Add an explicit `running` state (e.g. "A sweep is running now."). If `leased_until`/`next_run_at` shows it is overdue, render it in amber as not finished. Never fall through to the healthy branch on an unknown status:
```ts
if (summary.last_status !== "ok") { /* amber, not healthy */ }
```

### WR-05: The release confirm can understate how many documents lose protection

**File:** `frontend/src/components/retention/ReleaseHoldDialog.tsx:51, 84`

**Issue:** `n = hold.held_today ?? hold.document_count`. `held_today` is null exactly when the server could not count, and `document_count` counts only directly picked documents, not folder coverage. A folder-only hold whose count failed therefore reads **"0 documents will no longer be protected."** on the victim-naming confirm (066).

The UI-SPEC rule is "a count that cannot be computed reads `Couldn't count the documents yet.`, never 0".

**Fix:** When `held_today` is null, render the countFailed sentence instead of a number. Never substitute `document_count`.

### WR-06: An Un-archive in flight writes its receipt onto whichever document is open when it resolves

**File:** `frontend/src/components/retention/RetentionSection.tsx:88-104`

**Issue:** `DocumentDetailPanel` is not keyed by document (`LibraryPage.tsx:958`), so the same `RetentionSection` instance is reused across documents. The `[doc.id]` effect resets `done`, but `handleUnarchive` has no guard for doc identity or for being mounted.

Sequence: click Un-archive on A, then select B before the response. The effect clears state for B, then the promise resolves and runs `setDone(res.policy_name)`. **B now shows "Un-archived by you just now…" with a `role="status"` "✎ Un-archived · recorded" receipt.** A failure shows "Couldn't un-archive" on B instead.

**Fix:**
```tsx
async function handleUnarchive() {
  const id = doc.id
  setPhase("busy")
  try {
    const res = await unarchiveDocument(id)
    if (currentId.current !== id) return
    ...
```
Alternatively, key the section by `doc.id` in `DocumentDetailPanel`.

### WR-07: A held, archived document hides both its archived state and Un-archive, though the server allows it

**File:** `frontend/src/components/retention/RetentionSection.tsx:131-139, 159`

**Issue:** The server returns `can_unarchive = can_manage and archived`, regardless of holds (`retention.py:787`), and `unarchive_family` does not refuse held documents. A hold stops **deletion only** (D-16).

The client adds `&& !state.held` and replaces the whole sentence with the hold line. An archived document then put on legal hold (the common litigation case) therefore:
- never tells the admin it is archived and excluded from chat;
- cannot be un-archived from anywhere in the UI.

**Fix:** Drop `!state.held` from the button condition. When `state.archived`, render the archived sentence beneath the hold line.

### WR-08: The editor shows "Any type" / "Any folder" while the draft holds a specific scope

**File:** `frontend/src/components/retention/RetentionPolicyEditor.tsx:99-104, 297-330`

**Issue:** `form.type` and `form.folder` are initialised from the stored policy. The `<select>` options come from:
- `listDocumentTypes()`: top 50 by count, latest documents only (`retention.py:350`); a load failure is swallowed into `[]`;
- `useFolders()`: async.

When the stored value has no matching option, the browser displays the first option. Causes include types still loading, a load error, a type outside the top 50, or a type with zero current documents. The admin therefore sees **"Any type"**, with the folder select disabled and "A policy covers one folder or one document type". Preview and Save still use the hidden type.

The visible scope of a policy that can queue deletions then differs from the scope that is saved.

**Fix:** Always render the stored value as an option when it is absent from the list, e.g. `{form.type && !types.some(t => t.value === form.type) && <option value={form.type}>{form.type}</option>}`. Do the same for folders. Disable the selects until their lists have loaded.

### WR-09: "Keep for" values are silently coerced to 1

**File:** `frontend/src/components/retention/RetentionPolicyEditor.tsx:123, 126`

**Issue:** `Math.max(1, parseInt(f.value, 10) || 1)` turns `""`, `"0"` and `"-3"` into 1, `"1.5"` into 1, and `"1e2"` (which `type=number` accepts) into **1**, not 100. The field keeps showing what the admin typed, while Preview and Save run a different retention period. Nothing in Preview restates the period, so the mismatch is invisible.

**Fix:** Validate in `validate()`: require `/^\d+$/` and a value of at least 1, with an inline error (e.g. "Enter a whole number of 1 or more."). Block Preview on it instead of coercing.

### WR-10: An org switch leaves the Retention tab showing the previous org's data while writes go to the new org

**File:** `frontend/src/components/org/OrgAdminShell.tsx:436-437`; `frontend/src/components/retention/RetentionTab.tsx:105-111`

**Issue:** None of the retention bodies depend on `activeOrgId`. `switchOrg` flips `X-Org-Id` synchronously (`OrgProvider.tsx:173-180`), and `ProfileMenu` can switch org while the shell is open.

After a switch, the posture line, policies, holds and batches are org A's, shown under org B's band. Every write is sent as org B:
- confirm returns 404 and shows "Some documents may already be deleted";
- editing a policy returns 404 or 422;
- a release returns 404 and shows "It is still in force".

The server prevents any cross-org effect, but the screen is wrong and its failure copy is misleading. Priority check 6 names this case.

**Fix:** `<RetentionTab key={activeOrgId ?? "none"} onRecorded={pulse} />` (or key the whole shell body on the active org).

### WR-11: Saved views and ad-hoc filters always include archived documents, ignoring Include archived

**File:** `frontend/src/pages/LibraryPage.tsx:666`

**Issue:** `splitArchived(folderScopedDocuments, filteredDocs !== null || find.include_archived)` forces `include=true` for any filter or view resolve. The view resolve does not filter `archived_at` server-side either (no archived predicate outside `document_search_service.py` / retention).

So with Include archived **off**, a saved view lists archived documents mixed in, with no hidden line. Find, with the same conditions, hides them. This breaks S9's "archived documents are hidden by default" and "the two can never disagree".

**Fix:** Apply the same split to `filteredDocs` (`splitArchived(filteredDocs, find.include_archived)`) and render `ArchivedHiddenLine` for views too. Alternatively, pass `include_archived` to the resolve.

### WR-12: History pages by offset over a list that grows at the top

**File:** `frontend/src/components/retention/RetentionHistory.tsx:108-121, 172`

**Issue:** `Show older` requests `offset = rows.length` on a newest-first list. Any receipt written meanwhile shifts the window down: by a sweep, another admin, or this admin in another tab. The next page then repeats rows already shown.

Duplicate `r.id` values hit `key={r.id}`. React warns, and the list can render or reconcile duplicates incorrectly. In the ledger that would read as two deletes of the same document.

**Fix:** Use a keyset cursor (`before=created_at,id`), or at least de-duplicate by id when appending.

## Info

### IN-01: The locked Save button looks enabled

**File:** `frontend/src/components/retention/RetentionPolicyEditor.tsx:482-495`

**Issue:** Save uses `aria-disabled` only, but the button's disabled styling is keyed to `disabled:` (`button.tsx:8`), so a locked Save looks active. Also, the "Preview first…" reason line renders while `saving` is true, which states the wrong reason.

**Fix:** Add `aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`, and compute the reason line from `preview === null || stale` only.

### IN-02: Two copies of the refusal parser

**File:** `frontend/src/lib/api/retention.ts:321-338` vs `frontend/src/lib/api/refusal.ts:37-50`

**Issue:** The two parsers are near-identical, and only one handles pydantic 422 lists, so the delete doors and retention doors parse the same server shape differently. Retention calls also bypass `ApiError`'s 401 session latch.

**Fix:** Keep one `refusalOf` in `refusal.ts` with the 422-list branch.

### IN-03: DocumentList's delete dialog keeps a stale error and an unchanged title in refusal mode

**File:** `frontend/src/components/ingestion/DocumentList.tsx:150-155, 275-288`

**Issue:** A 409 refusal does not clear `deleteError`, so a retry after a network failure shows "Delete failed. Please try again." above the hold refusal. The refusal's Close closes the dialog through state rather than `onOpenChange`, so `deleteError` survives into the next delete dialog. In refusal mode, the dialog title and description still read "Permanently delete … This action cannot be undone."

**Fix:** Call `setDeleteError(null)` in both refusal paths, and swap the description when `refusal` is set.

### IN-04: The folder confirm has no busy state now that it stays open during the request

**File:** `frontend/src/components/ingestion/FolderNode.tsx:99-106, 241-247`; `FolderTree.tsx:92-101`

**Issue:** The confirm now stays open while the request runs, but the `Delete` button is never disabled. A double click sends two DELETEs for a folder and all its documents.

**Fix:** Track `busy` in `confirmDelete` and disable both buttons while it is set.

### IN-05: LegalHoldDialog shows a stale count and can be closed by an earlier request

**File:** `frontend/src/components/retention/LegalHoldDialog.tsx:122-138, 171-173`

**Issue:** While a recount is in flight, the line shows the **previous** selection's number, because `count` is not reset when the dependencies change. Separately, closing the dialog during a submit and reopening it lets the first request's `onClose()` close the new dialog.

**Fix:** Call `setCount(null)` at the top of the effect, and ignore the completion of a request whose open-generation is stale.

### IN-06: Copy edges

**Files and fixes:**
- `RetentionSection.tsx:65, 71` (`kept_by ?? "not recorded"`) renders "Kept by not recorded on…". Use `C.contract.formerMember`.
- `RetentionSection.tsx:133` shows an admin whose `hold_line` is null the member line "Ask an org admin." Use the admin no-matter sentence.
- `DeleteBatchCard.tsx:58-66` renders "0 on legal hold ()" when only undecidable rows were skipped. Omit the empty half.
- `RetentionPolicies.tsx:137` reads "Checked every night at —" before the summary loads.

### IN-07: `fillCopy` resolves `(s)` after substitution

**File:** `frontend/src/components/retention/retentionCopy.ts:366-374`

**Issue:** Because `(s)` is resolved after the values are substituted, a document or matter name containing `(s)` is rewritten (e.g. `Invoice(s).pdf` becomes `Invoices.pdf`). A name containing `**` is split into bold runs by `RichCopy`.

**Fix:** Resolve `(s)` on the template before substitution, and escape `**` in values.

### IN-08: Accessibility gaps

**Issue:**
- `aria-controls` on the inactive sub-tabs points at panel ids that do not exist (`RetentionTab.tsx:186, 213`).
- `<tr role="button">` handles Enter but not Space (`RetentionPolicies.tsx:179-181`).
- The hold typeahead's `role="listbox"` has no arrow-key navigation or `aria-activedescendant` (`LegalHoldDialog.tsx:236-251`).
- Inline field errors are not linked via `aria-describedby` or `aria-invalid` (editor and hold dialog).

**Fix:** Render all four panels (hidden), handle `" "` on the policy rows, add listbox keyboard handling, and link each error by id.

### IN-09: The focus-return effect steals focus

**File:** `frontend/src/components/retention/RetentionPolicies.tsx:99-103`

**Issue:** The effect depends on `list`, so every reload ("Try again", or a post-save reload) refocuses the last-opened row even after the person has moved on.

**Fix:** Clear `returnFocus.current` once focus has been restored.

### IN-10: Remove policy has no busy guard

**File:** `frontend/src/components/retention/RetentionPolicyEditor.tsx:254-265, 524-526`

**Issue:** A double click sends two DELETEs. The second 404s and is masked only because the editor unmounts first.

**Fix:** Track `removing` and disable the button while it is set.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
