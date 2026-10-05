---
phase: 271-find-the-document
reviewed: 2026-10-03T02:32:05Z
depth: deep
independent_review: self
diff_range: 20050816d..HEAD
files_reviewed: 35
files_reviewed_list:
  - backend/app/api/document_search.py
  - backend/app/main.py
  - backend/app/models/document_search.py
  - backend/app/services/document_search_service.py
  - backend/app/services/document_view_resolver.py
  - frontend/src/App.tsx
  - frontend/src/components/classification/ClassificationRulesPage.tsx
  - frontend/src/components/classification/RuleBuilderPanel.tsx
  - frontend/src/components/ingestion/AutomationGroup.tsx
  - frontend/src/components/ingestion/ConditionPopover.tsx
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/ingestion/DocumentRow.tsx
  - frontend/src/components/ingestion/FilterBar.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/library/DocumentsPager.tsx
  - frontend/src/components/library/LibraryHeaderBar.tsx
  - frontend/src/components/library/find/AskHandoffCard.tsx
  - frontend/src/components/library/find/DocumentsFindBody.tsx
  - frontend/src/components/library/find/FindMetaLine.tsx
  - frontend/src/components/library/find/FindModeSwitch.tsx
  - frontend/src/components/library/find/FindQuickAdd.tsx
  - frontend/src/components/library/find/StructurePopovers.tsx
  - frontend/src/components/library/find/askInChat.ts
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/metadata/DocumentFileFacts.tsx
  - frontend/src/components/relationships/CreateLinkDialog.tsx
  - frontend/src/components/relationships/LinkTargetCombobox.tsx
  - frontend/src/components/relationships/relationshipLabels.ts
  - frontend/src/hooks/useDocumentFind.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/documentAddedBy.ts
  - frontend/src/lib/nav-items.ts
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/pages/findState.ts
  - frontend/src/types/index.ts
findings:
  critical: 2
  warning: 5
  info: 8
  total: 15
status: issues_found
---

# Phase 271: Code Review Report

**Reviewed:** 2026-10-03T02:32:05Z
**Depth:** deep (call chains traced into `document_relationship_service`, `folder_utils`, `harness/scope`, `view_filter_compiler`, `useDocuments`, `useThreads`, postgrest-py 2.29.0)
**Files Reviewed:** 35 source files (tests read only where they bear on a finding)
**Status:** issues_found

## Summary

Phase 271 adds `POST /document-search` (exact field match, server order, server paging, exact total) and the Find / Ask surface on the Library's Documents tab. It also moves classification rules into the Library as "Filing rules".

**The backend security posture holds. I checked each point against the code:**

- The route takes `get_user_supabase_client` (`api/document_search.py:42`) and passes that client to every read. That includes the two relationship helpers (`document_search_service.py:336,339`), whose `None` default would otherwise be the service-role client. It also reaches `validate_and_compile` → `metadata_field_service`, `fetch_visible_folders`, `get_globally_visible_folder_ids` and `resolve_project_subtree`.
- Folder scope fails closed. A folder the caller cannot see returns `[]`, and the core answers with `_zero_result` (`:252-253`, `:506-507`). The subtree is intersected with the visible set (`:258-259`).
- There is no embedding, retrieval or RPC import. Values go through builder params. The name escapes `\ % _` in the right order (`:136`).
- The relationship direction table is correct for all 8 verbs. For an outgoing verb the result is the edge SOURCE where the target is in P's lineage. For an incoming verb the result is the edge TARGET where the source is in P's lineage. The frontend `RELATIONSHIP_FILTER_VERBS` (outgoing = result→picked) matches.
- `older_matches` comes from the same `_candidates` pipeline with `version="older"` and `id_allow=rel_older`. That is exactly the request "Show them" sends (`SET_VERSION older`, which also resets offset to 0). So the count and the rows that come back agree.
- An unreadable P returns the same zero-shape as "no matches" (`:516-517`), so P cannot be used to test whether a document exists.

**Frontend contracts I checked and found correct:** `findState.ts` has zero imports and the reducer is total. `useDocumentFind` keeps the previous rows on error and never falls back to the unfiltered list. `askInChat` awaits `createThread()` before calling `setPrefill`, and a failed create stops everything. `classification-rules` is gone from all three places: the `ActiveView` union, the ChatLayout branch, and the `NAV_ITEMS` rail entry (grep: only a negative assertion in `nav-items.test.ts` remains). The `renameFence` regex `activeView === "documents" ?[\s\S]{0,120}<LibraryPage onNavigate={onNavigate}` still matches the one-line mount at `ChatLayout.tsx:918`.

**What is wrong is in the Library wiring around Find.**

- **CR-01:** Find's metadata filter no longer resolves into the shared list state. So the Views tab now shows filter chips over an unfiltered list.
- **CR-02:** Find's delete callback throws away the promise. A failed delete looks like a success: the dialog closes and the row stays.
- The other findings: the Ask handoff has no in-flight guard; the older-version panel only guards metadata edits; the "exact total or fail loud" invariant is not kept on three auxiliary reads; filename `in`-lists can break on quoted filenames; and "Has earlier versions" disagrees with "Older versions" about shared documents.

## Critical Issues

### CR-01: The Views tab shows filter chips set in Find over an UNFILTERED list (regression)

**File:** `frontend/src/pages/LibraryPage.tsx:544-548` (with `librarySelection.ts:263-271` `SELECT_TAB`)
**Issue:** The metadata filter is still shared state (`lib.filter`, "one source of truth with the Views tab, D-114-1"). But the Documents tab now changes it through `handleFindFilterChange`, which dispatches `CHANGE_FILTER` and **sets `filteredDocs` to `null`**. It does not resolve the filter. Before 271 the Documents tab used `handleFilterChange` → `resolveFilterIntoList`, so `filteredDocs` always matched the chips on both tabs.

`SELECT_TAB` keeps `state.filter`, and nothing re-resolves on a tab switch. The only callers of `resolveFilterIntoList` are at lines 521, 529 and 537. So this sequence breaks:

1. On Documents (Find mode), add any metadata condition, for example ＋ Document type = Invoice.
2. Click the **Views** tab trigger.
3. `documentSurface(viewsLead)` renders `filterBarEl` with the Invoice chip. `matchCount` is `null`, so `externalCount` is true and the bar shows no count. Under it, `DocumentList` gets `pagedDocuments` = `folderScopedDocuments` with `filteredDocs === null`. That is the **Root folder's documents, unfiltered**, and the client pager shows too.

There is a variant. Select saved view A, go to Documents, edit the filter, then come back. `parkedViewId` is still A, so the Views lead says "A — Documents matching this saved filter." over the edited chips and the unfiltered root list.

This is exactly the failure `useDocumentFind`'s Rule 3 and T-271-14 exist to prevent: documents outside the visible filters, with nothing saying so. It just moved one tab over.

**Fix:** Do not leave the shared list state stale. The smallest correct option is to re-resolve when the Views tab is entered with an active filter:

```tsx
// LibraryPage.tsx — next to the other filter handlers
useEffect(() => {
  if (tab !== "views") return
  const viewId = selectedViewId
  const viewFilterUnchanged =
    viewId !== null &&
    JSON.stringify(views.find((v) => v.id === viewId)?.filter_expr) === JSON.stringify(filter)
  void resolveFilterIntoList(filter, viewFilterUnchanged ? viewId : undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab])
```

Alternatively, have `handleFindFilterChange` call `resolveFilterIntoList(next)` only to keep `filteredDocs` current. Its catch-to-unfiltered arm is then reachable only from the Views tab, as before. Add a LibraryPage case: set a Find metadata condition → switch to Views → assert the list rows match the chip.

### CR-02: Find's delete wrapper drops the promise, so a failed delete closes the dialog as if it succeeded

**File:** `frontend/src/pages/LibraryPage.tsx:794-796`
**Issue:** `DocumentList.confirmDelete` (`DocumentList.tsx:121-134`) does `await onDelete(...)`. It closes the dialog only if that resolves. If it throws, it shows "Delete failed. Please try again." and keeps the dialog open. `useDocuments.deleteDoc` throws on failure (`useDocuments.ts:131-132`). Find passes:

```tsx
onDelete: (id, scope) => {
  void Promise.resolve(deleteDoc(id, scope)).then(findResult.retry)
},
```

The block body returns `undefined`, so `await onDelete()` resolves at once. The dialog closes **before the DELETE has even finished**. If the DELETE then fails:

- no error is shown and the row stays in the list;
- the `.then` chain has no `.catch`, so the rejection is unhandled;
- `retry` never runs.

The person is told nothing after a destructive action that failed. The shipped browse path passes `deleteDoc` directly and keeps the error UX.

**Fix:**

```tsx
onDelete: async (id, scope) => {
  await deleteDoc(id, scope) // let DocumentList's try/catch see a failure
  findResult.retry()
},
onRefresh: () => {
  void loadDocuments().catch(() => {})
  findResult.retry()
},
```

`DocumentList`'s `onDelete` prop type is `(…) => void`. Widen it to `=> void | Promise<void>` so the await contract is visible in the type. Add a Find-mode case where `deleteDoc` rejects and assert the dialog stays open with its error.

## Warnings

### WR-01: Ask → chat has no in-flight guard and fails silently, so a double press opens two new chats

**File:** `frontend/src/pages/LibraryPage.tsx:736-738`, `frontend/src/components/layout/ChatLayout.tsx:288-295`, `frontend/src/components/library/find/AskHandoffCard.tsx:32-36`, `DocumentsFindBody.tsx:80-84`
**Issue:**

- Every "Open in chat" click and every Enter in Ask mode calls `askInChat` → `newThread()` → `POST /threads`. Nothing guards against a second call while the first is still running. A double-click, or Enter followed by a click, creates two threads. The second one becomes selected and gets the prefill, and an empty "New Chat" is left in history. This is the same defect class 267-03 fixed for `startScopedChat` ("ONE in-flight guard; live dblclick → 1 thread").
- The `false` that `askInChat` returns on a failed create is thrown away (`void onAskInChat?.(question)`). The person presses the button and nothing happens. The only trace is a `console.error`.

**Fix:** Keep an `askPending` ref/state in LibraryPage. Ignore calls while a request is pending, and disable the card button while it is set. When the call resolves `false`, show a calm inline line on the Ask card, for example "Couldn't open a new chat. Try again."

### WR-02: The older-version detail panel guards only the metadata editors; other writes still act on a superseded row

**File:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:249-253, 496-515`; `frontend/src/components/library/find/DocumentsFindBody.tsx:225-231`
**Issue:** Find is the first surface that opens `is_latest === false` rows. The panel's banner says "fields can only be changed on the latest version", and `isOlderVersion` gates `InlineEdit` and `handleCommit`. But several write paths are still live:

- **Classification accept/dismiss.** `ClassificationSection` still renders for an older row. `PATCH /documents/{id}/classification/accept` (`backend/app/api/documents.py:2085-2098`) is owner-scoped but **not `is_latest`-gated**, so it moves just that superseded row to another folder and splits the lineage across folders. Dismiss rewrites the old row's metadata.
- **Relationships "Add link"** from an older row. The create gate follows the id to the latest version, so the link lands on a different row from the one the panel shows.
- **Row actions in the Find list** (Move, Re-ingest) act on the old row. 271-05 already records Re-ingest on an older row as a silent no-op (F-2 in the ledger), and it is still unfixed.

**Fix:** Pass `readOnly={isOlderVersion}` into `ClassificationSection` and `RelationshipsSection` and hide their verbs. In `DocumentRow` with `columns="find"` and `doc.is_latest === false`, offer only Download / Delete-this-version. Also latest-gate the accept/dismiss routes on the server (`.eq("is_latest", True)` → 404), the same way `PATCH /{id}/metadata` already is.

### WR-03: "Exact total or fail loud" is not kept on three auxiliary reads, which truncate silently

**File:** `backend/app/services/document_search_service.py:346-377, 251, 521`
**Issue:** The module docstring says reads "walk with `.range()` until the reported count; a short read raises `SearchTruncatedError`". Only `_fetch_all` does that. These reads do not:

- The relationship **edges** read (`:346-352`), the **endpoint rows** read (`:357-361`) and the **heads** read (`:369-377`) are single, unpaged `.execute()` calls. Past PostgREST `max-rows`, the id allow-list is silently short. The result is a short `total` and `older_matches` that look exact, and the meta line says "Exact match on fields."
- `_resolve_folder` → `fetch_visible_folders(supabase, caller)` and `get_globally_visible_folder_ids` (`:251`, `:521`) both use `fetch_all_folders(strict=False)`. If a visible folder falls past the cap, it is treated as unreachable and the search returns **zero rows** ("No documents match"). The shared-folder leg also silently drops rows. `strict=True` exists for exactly this case (WR-07 in `folder_utils`).

The id lists built from these reads are also put into `.in_("id", …)` with no size bound, unlike the filename list, which is batched at `_LINEAGE_BATCH`.

**Fix:** Route the three relationship reads through `_fetch_all` (each with a `build(count)` closure, ordered by id). Call `fetch_visible_folders(..., strict=True)` and map `FolderReadTruncatedError` to `SearchTruncatedError`. Batch large `in_("id", …)` lists, or fail loudly above a stated ceiling.

### WR-04: The filename `in`-lists break on filenames that contain `"` or `\`, so every page showing that document fails

**File:** `backend/app/services/document_search_service.py:283, 374`
**Issue:** `_lineage_rows` and the relationship heads read pass raw filenames to `.in_("filename", …)`. postgrest-py 2.29.0 `sanitize_param` (`venv/Lib/site-packages/postgrest/utils.py:32-37`) wraps a value in double quotes when it contains `,:()`. It **does not escape an embedded `"` or `\`**. Take a filename like `Q3 "final", draft.pdf`; Drive and macOS allow both characters. It becomes `"Q3 "final", draft.pdf"` inside `in.(…)`. PostgREST cannot parse that filter, the request fails with an APIError, and the route has no handler for it, so the user gets a 500.

`_lineage_rows` runs for **every** non-empty page (`:554-555`). So once such a document lands on a page, Find fails on that page for every search that reaches it. The resolver's comment that "`.in_` quotes members" is only partly true.

**Fix:** Escape before passing. PostgREST accepts `\"` and `\\` inside a quoted value:

```python
def _pg_quote(v: str) -> str:
    return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'

q.filter("filename", "in", "(" + ",".join(_pg_quote(n) for n in chunk) + ")")
```

Or key lineage by id: read `(id, user_id, filename)` with `.in_("user_id", owners)` only, and match names in Python. Add a unit case with a filename containing `"` and `,`.

### WR-05: "Has earlier versions" and the version tag count older rows that "Older versions" will never list

**File:** `backend/app/services/document_search_service.py:298-302` (vs `:441-442`, and `document_relationship_service._resolve_readable_latest:218-221`)
**Issue:** `_lineage_facts` treats a lineage row as visible if it is in a globally visible folder, **whatever its `is_latest` value**. So a shared document owned by someone else gets `has_earlier=True` and a "v3 · 3 versions" tag, and it matches `version="has_earlier"`. But `version="older"` is own-rows-only by design (P-03, `:441`), and `_resolve_readable_latest` says an old version in a global folder "is NOT independently readable". The person is told the document has history, and every route to that history (Older versions, opening an old row) comes back empty. The two version states disagree about the same document.

**Fix:** Pick one rule and apply it in both places. Either count only visible rows that pass the P-03 rule for older versions (`user_id == caller`, or `is_latest`), or widen P-03 on purpose. Pin the choice with a two-user case where a shared document has an older version.

## Info

### IN-01: The Date column renders `metadata.date`, but the sort uses `date_typed`

**File:** `frontend/src/components/ingestion/DocumentRow.tsx:121-125`; `document_search_service.py:92`
**Issue:** `date_typed` is `view_iso_to_date(metadata->>'date')` and is NULL for any non-ISO value (migration 074:97-99). A row with `metadata.date = "March 2024"` sorts into the "missing" tail of "Date in the document (newest)". But `FindDateCell` still shows a date for it, via `new Date(raw)`, so it looks dated and sits among the undated rows.
**Fix:** Render the column from `date_typed` (it is already in the hydrated row), or show "not recorded" when the value is not ISO.

### IN-02: On error, the meta line keeps the previous search's total under the new chips

**File:** `frontend/src/hooks/useDocumentFind.ts:82-90`; `DocumentsFindBody.tsx:179-187`
**Issue:** S7 deliberately keeps the old rows. But `FindMetaLine` also keeps showing the old `total` ("12 documents") under conditions that were never answered. The alert is there, but the count still claims to describe the current chips.
**Fix:** In the error state, label the count as the last answer ("12 documents (last search)"), or hide it while `error` is set.

### IN-03: The offset is not clamped after a delete shrinks the result set

**File:** `frontend/src/pages/LibraryPage.tsx:794-796`; `findState.ts:212-213`
**Issue:** Delete the only row on the last page. After `retry`, `offset >= total > 0`, so the page renders empty, `isZero` is false, and the pager still shows.
**Fix:** In the hook or the page, when `rows.length === 0 && total > 0 && offset > 0`, dispatch `SET_PAGE` to the last valid page.

### IN-04: The pre-seeded folder chip keeps a Find search alive after the name is cleared

**File:** `frontend/src/pages/LibraryPage.tsx:561-579`
**Issue:** Type one letter while a folder is selected, then delete it. `find.folder` is now set, so `searchActive` stays true, and the person is in a cross-subfolder Find view instead of the folder browse they started from. This is edge-triggered by design, but it surprises.
**Fix:** Clear the auto-seeded folder (track that it was seeded, not chosen) when the search goes inactive on everything else, or record this as an accepted UI-SPEC behaviour.

### IN-05: The verb and mode unions are declared three or four times

**File:** `frontend/src/types/index.ts:676-684`, `frontend/src/pages/findState.ts:80-88`, `relationshipLabels.ts` (`RelVerbKey`), `FindModeSwitch.tsx:22` vs `findState.ts:63`
**Issue:** Tests pin them structurally, but four homes for one vocabulary is the drift CLAUDE.md warns about.
**Fix:** `findState.ts` has to stay import-free, so make `types/index.ts` and `FindModeSwitch` alias it (`export type { RelVerb } from "@/pages/findState"`).

### IN-06: "`extra="forbid"` on EVERY model" does not cover `filter_expr`

**File:** `backend/app/models/document_search.py:8-10, 153`; `app/models/document_view.py:34-69`
**Issue:** `ViewFilter` and `ViewCondition` are shipped models with the default `extra="ignore"`. An unknown key inside a condition is dropped silently, which is the "filter the backend silently ignores" failure the docstring says cannot happen.
**Fix:** Correct the docstring, or parse `filter_expr` through a forbid-subclass used only on this route (leave the stored view shape alone).

### IN-07: A "between" date with From after To silently returns zero

**File:** `frontend/src/components/library/find/StructurePopovers.tsx:517-521`; `backend/app/models/document_search.py:126-130`
**Issue:** Neither the editor nor the model checks `value <= value2`. The search then answers "No documents match" with no reason given.
**Fix:** Disable Apply, with a hint, when `value > value2`, and reject it in `FindDate._shape`.

### IN-08: CLAUDE.md is 476 characters below the 120,000 warn band

**File:** `CLAUDE.md`
**Issue:** `check-claude-md-size.cjs` reads 119,524 characters. The next ledger touch crosses the warn band, which is the point where the rules say the split must be scheduled.
**Fix:** Schedule the split now rather than at the trip.

---

_Reviewed: 2026-10-03T02:32:05Z_
_Reviewer: Claude (gsd-code-reviewer, fresh context)_
_Depth: deep_

## Resolution

_Fix pass: 2026-10-03, fresh context, main working tree (`develop`), base `a007288b0`. Every fixed finding was driven RED by a test that reproduced it before its fix landed. Details and gate figures: `271-REVIEW-FIX.md`._

| Finding | Disposition | Commit | How |
|---|---|---|---|
| CR-01 | **fixed** | `f5b9f43de` | Find still never resolves the filter itself. Entering the Views tab after Find changed the shared filter re-resolves it through the existing `resolveFilterIntoList` (no fork): by id when the parked saved view's filter is unchanged, otherwise ad hoc. No request when nothing changed. The Views-tab DOM snapshot pins (`FilterBar.find271.test.tsx`) stay green. ⚠ The variant's heading (a parked view's name above edited chips) is unchanged: it predates 271, and the list under it now matches the chips. |
| CR-02 | **fixed** | `4ffc43c01` | `onDelete` is `async` and awaits `deleteDoc` before `retry`; `DocumentList`'s `onDelete` type widened to `void \| Promise<void>`; Find's refresh catches a failed reload. |
| F-2 (verification) | **fixed** | `3357e07b4` | Backend read first. Re-ingest is latest-gated (`documents.py:1291`, 404 → only logged): hidden. Move moves ONE row and splits it from its lineage's folder (`:1908-1950`, no `is_latest` gate): hidden. Both are replaced by the words "Older version: re-ingest and move work on the latest". **Delete works correctly on an older row and stays** — the version delete removes exactly that row and promotes nothing (`:1864-1890`, promotion only when the deleted row `is_latest`); "Delete all versions" removes the lineage in that folder. |
| WR-01 | **fixed** | `aa12e207b` | In-flight ref in `LibraryPage` (one handoff at a time, Enter included); `AskHandoffCard` gains `pending` (button disabled) and `failed` ("Couldn't open a new chat. Try again.", `role="alert"`). |
| WR-04 | **fixed — and the review's failure mode was MEASURED WRONG** | `a791fc115` | Probed against the local PostgREST 14.10 with uuid-cast errors that echo the parsed value: `in.("Q3 "final", draft.pdf")` is **a 200, not a 500** — it parses as the two names `"Q3 "final"` and ` draft.pdf"`. So the defect is a silent wrong answer (version tag 1, missing from Has earlier versions, relationship head-follow lost), which is worse than the predicted error. `_pg_in_list` quotes every member and escapes `\` and `"`; the lineage read and the relationship heads read use it. Live check: the new encoding round-trips `Q3 "final", draft (v2):x\y.pdf` exactly. |
| WR-02 | deferred | — | see below |
| WR-03 | deferred | — | see below |
| WR-05 | deferred | — | see below |
| IN-01 … IN-08 | deferred | — | see below |

## Deferred from review

Bounded fast-fix pass: none of these was built. Each carries a concrete re-open trigger.

| Item | Why deferred | Re-open trigger | Seed-worthy |
|---|---|---|---|
| **WR-02** older-version panel still offers classification accept/dismiss and Add link | Needs `readOnly` threaded into two panel sections plus a server-side `is_latest` gate on two routes — a server behaviour change, not a fast fix | The next phase that touches `DocumentDetailPanel.tsx`, `ClassificationSection`, `RelationshipsSection` or the `classification/accept`/`dismiss` routes; or any report of a lineage split across folders | **yes** — server-side latest gate on accept/dismiss |
| **WR-03** relationship edge/endpoint/heads reads are unpaged; `fetch_visible_folders` / `get_globally_visible_folder_ids` run `strict=False` | Needs `_fetch_all` closures, `strict=True` with an error mapping, and `in_("id")` batching — a correctness change to the search core with its own tests | Any account past PostgREST `max-rows` in relationships or visible folders; or the next phase touching `document_search_service.py` | **yes** — "exact total or fail loud" on every auxiliary read |
| **WR-05** "Has earlier versions" / version tag count shared older rows that "Older versions" never lists | A semantic choice (narrow `_lineage_facts` to P-03, or widen P-03) that needs a decision and a two-user case | The next phase touching version semantics, or a report of a "3 versions" tag whose history is empty | yes (decision needed) |
| **F-1** raw field keys and duplicate Document type / Date offers in Find chips (UI-SPEC S6 copy) | Routed to `/gsd:quick` by verification; deferred here even if ≤10 lines, per the fix-pass scope | `/gsd:quick` before deploy, or the next phase touching `FindQuickAdd.tsx` / `ConditionPopover.tsx` | no |
| **F-4** inherited Esc behaviour in `ConditionPopover` | Out of 271's scope (inherited) | The next phase touching `ConditionPopover.tsx` | no |
| **New, found during F-2:** the delete dialog on an OLDER row with `version_number > 1` says "Delete vN to promote vN-1 as current" — false for an older row (nothing is promoted; the latest stays current) | Copy only; the action itself is correct | Same trigger as WR-02 | no (fold into WR-02) |
| **IN-01** Date column renders `metadata.date`, sort uses `date_typed` | Info | Next touch of `DocumentRow.tsx` Find cells | no |
| **IN-02** meta line keeps the previous total on error | Info | Next touch of `FindMetaLine.tsx` / `useDocumentFind.ts` | no |
| **IN-03** offset not clamped after a delete empties the last page | Info | Next touch of `findState.ts` paging | no |
| **IN-04** pre-seeded folder chip keeps a search alive after the name clears | Info (edge-triggered by design) | UI-SPEC review of the pre-seeded folder rule | no |
| **IN-05** verb/mode unions declared in 3-4 places | Info | Next touch of `findState.ts` vocabulary | no |
| **IN-06** `extra="forbid"` docstring overclaims for `filter_expr` | Info | Next touch of `models/document_search.py` | no |
| **IN-07** "between" with From after To silently returns zero | Info | Next touch of `StructurePopovers.tsx` date editor | no |
| **IN-08** CLAUDE.md near the 120,000 warn band | Info | The next CLAUDE.md edit; schedule the split | no |
