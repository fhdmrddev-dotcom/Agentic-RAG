---
phase: 284-library-at-scale
reviewed: 2026-10-16T00:00:00Z
depth: standard
independent_review: self
files_reviewed: 45
files_reviewed_list:
  - backend/app/api/document_views.py
  - backend/app/api/documents.py
  - backend/app/api/library.py
  - backend/app/models/document.py
  - backend/app/models/document_view.py
  - backend/app/services/document_search_service.py
  - backend/app/services/document_view_resolver.py
  - backend/app/services/retrieval_scope.py
  - backend/app/services/tools/documents.py
  - supabase/migrations/207_library_documents_view.sql
  - scripts/full-schema-supplement.sql
  - scripts/apply_migration_207.py
  - scripts/seed-scale-284.py
  - scripts/measure-library-284.py
  - frontend/src/hooks/useLibraryDocuments.ts
  - frontend/src/hooks/useDocuments.ts
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/api/library.ts
  - frontend/src/lib/api/knowledge.ts
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
  - frontend/src/components/library/IngestionTab.tsx
  - frontend/src/components/library/DocumentsPager.tsx
  - frontend/src/components/library/LibraryHeaderBar.tsx
  - frontend/src/components/library/LibraryStatTiles.tsx
  - frontend/src/components/library/ViewCard.tsx
  - frontend/src/components/library/find/FindQuickAdd.tsx
  - frontend/src/components/library/find/StructurePopovers.tsx
  - frontend/src/components/ingestion/DocumentRow.tsx
  - frontend/src/components/ingestion/FolderDetail.tsx
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/ingestion/NavRow.tsx
  - frontend/src/components/metadata/DocumentChunksSection.tsx
  - frontend/src/components/metadata/DocumentImagesSection.tsx
  - frontend/src/components/metadata/DocumentTablesSection.tsx
  - frontend/src/components/metadata/TakeoffSection.tsx
  - frontend/src/components/relationships/CreateLinkDialog.tsx
  - frontend/src/components/relationships/LinkTargetCombobox.tsx
  - frontend/src/components/retention/LegalHoldDialog.tsx
  - frontend/src/components/ui/AnimatedNumber.tsx
  - frontend/src/components/ui/animatedNumberProgress.ts
  - frontend/src/test-utils/fakeLibraryApi.ts
  - frontend/src/components/ingestion/DocumentList.tsx
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
status: issues_found
fix_round: 2026-10-16 (284-REVIEW-FIX.md)
fixed:
  CR-01: "775fe5a16 (RED) -> 369279f28 (GREEN), lint 547df85e7"
  WR-01: "1c9e35532 (RED) -> d158ec9b6 (GREEN), lint 547df85e7"
  WR-02: "5461e4caf (RED) -> a5b6e2ffd (GREEN)"
  WR-04: "5e9791b69 (RED) -> fdb2d8a88 (GREEN)"
  IN-05: "b10484562 (RED) -> 4c87a102b (GREEN)"
  IN-07: "578b603de (RED) -> 232b2bf03 (GREEN)"
accepted:
  WR-03: "deploy order is backend-first (284-LIVE-EVIDENCE), so the legacy-array fallback is unreachable; the tolerance is deleted one release after deploy"
not_addressed_info: [IN-01, IN-02, IN-03, IN-04, IN-06]
---

# Phase 284: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard (security / RLS first, then paging, blocking I/O, UI honesty)
**Files Reviewed:** 45 (the 44 in scope plus `DocumentList.tsx`, read to confirm an empty-state claim)
**Status:** issues_found

## Summary

**The security core holds up.** Every property below was traced in code rather than assumed:

- `public.library_documents` is `security_invoker = true`. RLS on `documents` and `folders` therefore applies under the view, including the `org_id IN current_user_org_ids()` gate. The view's predicate only narrows, and so do its two lineage subqueries, which read `documents e` under the same RLS.
- Migration 207 revokes `ALL` from PUBLIC, anon, authenticated and service_role, then grants `SELECT` only, to authenticated and service_role. The same lines are mirrored in `full-schema-supplement.sql`. It adds no function and no SECURITY DEFINER object, so the PUBLIC EXECUTE trap does not apply.
- `folder_is_org_shared` is an existing SECURITY DEFINER function with no org check of its own. Cross-org leakage is still blocked, because the outer `documents` RLS requires `org_id IN current_user_org_ids()` on every row the view can return.
- `GET /library/summary` runs through `get_user_pg_connection`. That is the shared pool, but each request opens a transaction, swaps to the `authenticated` role and sets JWT GUCs with `SET LOCAL`. The GROUPING SETS scan therefore reads the view as the caller. The connection-name read selects only `id, name`.
- The agent's `query_documents_by_view` keeps the two-leg service-role path (`via_view=False`). Its new exact total, own + global − (own ∩ global), is correct because `get_globally_visible_folder_ids` excludes folders the caller owns.
- No new unwrapped supabase-py `.execute()` sits in an async handler. `/versions` used to be synchronous and now goes through `aexec`. Nothing touches per-worker state.

**The paging contract has one real hole: an offset past the end.** PostgREST answers `416 / PGRST103` when a `count=exact` request's offset is greater than the total. Every new ranged read sends `count=exact`, and none of them handles that answer. Ordinary shrinking-list events therefore turn into 500s, and the IngestionTab clamp, written for exactly this case, never runs.

Four warnings follow:

- Realtime UPDATE merges that leave rows on a list they no longer belong to.
- A relationship cap of 500 that sits above the measured 414 URL threshold (286 ids).
- A legacy-array fallback that shows the wrong rows.
- A Takeoff selection the user cannot see.

Known, recorded items were not re-reported: SEED-355/356/357, the per-page redundant `count_only` resolve, and the AnimatedNumber count-up-from-0 frame.

⚠ **One limit on this review:** CR-01 was not driven live. An attempted read-only `curl` against local PostgREST was denied by the session's permission classifier. The finding rests on PostgREST's documented range rule (offset > total with `count=exact` → 416 `PGRST103`, *"An offset of X was requested, but there are only Y rows"*) and on a code trace showing that no handler catches it. One request confirms it: `GET /rest/v1/documents?select=id&offset=5&limit=5` with `Prefer: count=exact`, sent as a user who sees fewer than 5 rows.

## Critical Issues

### CR-01: An offset past the end is a 500, not an empty page. This strands browse, saved views, Find, Chunks and the IngestionTab lists

> **FIXED 2026-10-16** — RED `775fe5a16` → GREEN `369279f28` (+ lint `547df85e7`). One helper, `app.utils.db.aexec_page`; PGRST103 proven live (`tests/integration/test_284_offset_past_end_live.py`). See `284-REVIEW-FIX.md`.

**Files:**
- `backend/app/api/documents.py:878` (also `:914`, `:1185`, `:1300`, `:1330`)
- `backend/app/services/document_view_resolver.py:421`
- `backend/app/services/document_search_service.py:482`
- `frontend/src/pages/LibraryPage.tsx:362-364`, `:965`
- `frontend/src/components/library/IngestionTab.tsx:397-398`

**Issue:** Every new ranged read is `.select(..., count="exact") ... .range(offset, offset + limit - 1)`. PostgREST's range rule (`rangeStatus`) returns **416 `PGRST103`** when `offset > total` and a count was requested. postgrest-py raises `APIError` on any non-2xx response, and none of these handlers catches it, so the browser gets a 500.

Before 284, Find sliced in Python (`ordered[offset:offset+limit]`) and the Library sliced in the browser, so going past the end returned an empty page. Now it is an error. Concrete failing states:

1. **The browse list, deterministically.** A folder has 60 documents, 20 of them archived, with *Include archived* on. The user goes to page 3 (`offset=50`), then turns *Include archived* off (`ArchivedHiddenLine` → `SET_INCLUDE_ARCHIVED`, `LibraryPage.tsx:965`). `findReducer` resets **Find's** offset, but the browse `pageOffset` resets only on `[selectedFolderId, listTarget]` (`:364`). The next request is `offset=50` against a total of 40, so 416 → 500 → *"Couldn't refresh this list"*. **Try again** repeats the same offset and fails again every time.
2. **A Realtime-shrunk page.** The user is on page 3 (`offset=50`) of 52 documents. Another tab, or the retention sweep, deletes three → DELETE hint → refetch with `offset=50` against a total of 49 → 416. When `offset == total` exactly, the answer is 200 with no rows. Browse then shows *"No documents in this folder"* under a pager reading *"51–50 of 50"*. That equality case predates 284, but browse still has no clamp.
3. **IngestionTab's clamp is dead code for this case.** `usePagedStatusList` clamps only *inside the success callback* (`offset >= res.total`, `:397`). When the list shrinks by more than one page-boundary row, `offset > total`, the server 416s, and the error branch sets `state="error"` without ever reaching the clamp. *"A shrinking list clamps the page back into range"* (`:377`) is true only for `offset == total`.
4. **Find's `older_matches` / a re-sort, view resolves, and the Chunks `loadMore`.** Each of these fails the same way when the set shrinks under an open page, for example a document re-chunked while its Chunks list is scrolled.

**Fix:** Handle it once, on the server. A page past the end is a valid question, and the answer is "no rows, here is the total". Catch `PGRST103` around each ranged read and answer with `documents: []` and the real total:

```python
# app/utils/db.py
from postgrest.exceptions import APIError

async def aexec_page(q, count_q_factory):
    """A ranged count=exact read. An offset past the end answers 0 rows + the real total
    instead of PostgREST's 416 (PGRST103)."""
    try:
        return await aexec(q)
    except APIError as e:
        if getattr(e, "code", None) != "PGRST103":
            raise
        head = await aexec(count_q_factory().limit(1))   # same filters, select("id", count="exact")
        return SimpleNamespace(data=[], count=head.count)
```

Then clamp on the client, as IngestionTab intends. Reset `pageOffset` when `find.include_archived` changes: add it to the `:364` dependency list. Add a clamp effect, for example `if (libDocs.total !== null && pageOffset >= libDocs.total && libDocs.total > 0) setPageOffset(Math.floor((libDocs.total - 1) / pageSize) * pageSize)`. Add a live test that requests `offset = total + 1` on `GET /documents`, a view resolve and `/document-search`.

## Warnings

### WR-01: A Realtime UPDATE that changes which list a row belongs to is merged in place. The row stays where it no longer belongs, and the counts go stale

> **FIXED 2026-10-16** — RED `1c9e35532` → GREEN `d158ec9b6`. See `284-REVIEW-FIX.md`.

**File:** `frontend/src/hooks/useDocuments.ts:105-110`

**Issue:** Only a terminal-status UPDATE (`completed` / `failed`) calls `onChange()`. Any other UPDATE is spread-merged into the on-page rows. That includes UPDATEs that change list membership or the summary's buckets:

- `folder_id`: a move from another tab or session, or a connector sync re-filing a document.
- `archived_at`: the retention sweep archiving rows while the Library is open with *Include archived* off.
- `is_latest` and `status`: for example a `status=failed` list in IngestionTab after a re-ingest flips a row to `pending`.

Before 284, the page re-derived every list from the merged whole-library array, so a moved or archived document left the list at once. Now it stays on page 1 of its *old* folder, wearing its new `folder_id`. The folder and Root counts in `/library/summary` are not refetched until some unrelated terminal event arrives. D-08 allows an on-page UPDATE to merge, but only because the merge was assumed to be cosmetic. These fields are not.

**Fix:** In the UPDATE arm, compare the membership fields before merging. If any of them changed, call `onChangeRef.current()`:

```ts
setDocuments((rows) => {
  const cur = rows.find((d) => d.id === newDoc.id)
  if (cur && (cur.folder_id !== newDoc.folder_id || (cur.archived_at ?? null) !== (newDoc.archived_at ?? null)
      || cur.is_latest !== newDoc.is_latest || cur.status !== newDoc.status)) onChangeRef.current()
  return rows.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d))
})
```

(Call `onChange` outside the updater, or queue it, so it is not run twice under StrictMode.)

### WR-02: `REL_EDGE_CAP = 500` sits above the measured 414 threshold, so a large relationship hub returns a 500 (URI Too Long) instead of the promised 503 refusal

> **FIXED 2026-10-16** — RED `5461e4caf` → GREEN `a5b6e2ffd`. ⚠ The suggested 200 would still 414: the FIND page read at 200 ids is ~8.5 KB against a measured 8,192-byte request line. The cap is **100**. See `284-REVIEW-FIX.md`.

**Files:**
- `backend/app/services/document_search_service.py:97`
- `backend/app/services/document_search_service.py:338`
- `backend/app/services/document_search_service.py:252`

**Issue:** BUG-261014-06 measured a **414 at 286 UUIDs** in one `in.()` URL, and the stopgap batched at 100 ids (about 3.7 KB). The relationship allow-list allows up to 500 edges. It then sends two URL reads sized by that set:

- `.in_("id", endpoints)` (`:338`): up to 500 ids, about 18.5 KB.
- `_apply_ids` on the page read itself (`:252`): `in_("id", sorted(id_allow))`.

Concrete failure: a document with 300 `references` edges. Find with *"…references this document"* passes the cap check (300 ≤ 500), builds a URL of roughly 11 KB, and the gateway rejects it with 414. postgrest-py then raises, and the user sees a 500 rather than `TRUNCATED_DETAIL`. The 284-05 recorder sanctions this through `RELATIONSHIP_EXEMPTION` (≤ `REL_EDGE_CAP`), so the guard cannot catch it either.

**Fix:** Keep the cap below the measured threshold, for example `REL_EDGE_CAP = 200`, with a comment citing the 286-id measurement. Better still, move the allow-list into SQL: filter the view with an `EXISTS` against `document_relationships` in a view or RPC, so no id list rides the URL at all. Either way, add a live test at the cap.

### WR-03: The legacy-array fallback shows the whole library as a folder's page, and every page shows the same rows

> **ACCEPTED, not fixed (operator, 2026-10-16)** — the recorded deploy order is backend-first, so the legacy-array fallback is unreachable; the tolerance is deleted one release after deploy.

**Files:**
- `frontend/src/lib/api/documents.ts:104-107`
- the same pattern at `:125`, `:137`, `:149`, `:161`

**Issue:** The fallback exists for *"one push may land the frontend before the backend"*. In that case the old backend ignores `folder_id`, `offset`, `limit`, `include_archived`, `status`, `order` and `kind`, and returns every latest document as an array. The client turns that into `{documents: body, total: body.length}`. The results:

- Root shows documents from every folder.
- The pager reports the whole library as this folder's total, and page 2 shows the same rows as page 1.
- IngestionTab's Failed and History lists show every document whatever its status.
- Takeoff's spreadsheet picker offers non-spreadsheets.

The comment calls this *"honest for the array it was handed"*. It is not honest for the request that was made. In that same window, `/library/summary` and `GET /documents/{id}` are 404s on the old backend, so the frontend-first order is broken anyway. 284-LIVE-EVIDENCE already orders the deploy backend → frontend.

**Fix:** Either delete the tolerance now, since the recorded deploy order makes it unreachable, or have it throw `DocumentListError(null, "…")` so the surface says *"Couldn't load documents"* instead of rendering a mislabelled list. If it stays, at least apply `folder_id`, `status`, `kind`, `include_archived` and the offset/limit slice on the client.

### WR-04: Takeoff's saved rate sheet can be outside the 50-sheet page. The select then shows nothing (or the wrong sheet) while Match uses the hidden one

> **FIXED 2026-10-16** — RED `5e9791b69` → GREEN `fdb2d8a88`. See `284-REVIEW-FIX.md`.

**Files:**
- `frontend/src/components/metadata/TakeoffSection.tsx:62-63`
- `frontend/src/components/metadata/TakeoffSection.tsx:95`, `:101`, `:286`

**Issue:** `selectedRateDocId` is seeded from `takeoff.rate_sheet_document_id` (`:62-63`), and the effect at `:101` keeps it (`current || …`). The options, however, are only the 50 newest non-archived spreadsheets (`kind=spreadsheet`, `include_archived` defaulting to false). The saved sheet falls outside them when it is the 51st-newest or older, or when it has been archived. The controlled `<select value={savedId}>` then matches no option: Chrome renders it blank, other engines show the first option. **Match** still sends the hidden saved id, so what the user sees is not what runs. Before 284 the whole list was read (up to the 1,000 cap), so this did not happen below 1,000 spreadsheets.

**Fix:** When the selected id is not in `rateDocs`, fetch it with `getDocument(id)` and prepend it as an option labelled with its name. If that read 404s, clear the selection and say the saved sheet is no longer available.

## Info

### IN-01: Every navigation away from a deep page fires one wasted request with the old offset against the new source

> **Not addressed (info)** in the 2026-10-16 fix round — recorded, not scheduled.

**File:** `frontend/src/pages/LibraryPage.tsx:362-364` and `frontend/src/hooks/useLibraryDocuments.ts:220-241`

`setPageOffset(0)` runs in an effect, in the same commit as the hook's fetch effect. The first request for the new folder therefore goes out at the old offset; it is dropped by `reqIdRef`, then re-asked at 0. That costs one extra request per navigation, and with CR-01 it is a server-logged 500 whenever the new folder is smaller than the old offset. Fix: key the offset on the source (`const [page, setPage] = useState({ key: sourceKey, offset: 0 })`, read as 0 when `key !== sourceKey`), or reset during render.

### IN-02: `_exact_total` falls back to `len(rows)`, the exact "length of anything fetched" D-03 forbids

> **Not addressed (info)** in the 2026-10-16 fix round — recorded, not scheduled.

**Files:** `backend/app/api/documents.py:787-791` and `backend/app/services/document_view_resolver.py:69-74`

If `count` is ever missing (a proxy dropping `Content-Range`, or a client upgrade), the total silently becomes the page length. The pager then hides every later page, and the result still reads as exact. Find raises in this case; these two helpers do not. Suggest logging a warning, or raising, when `count` is not an int outside tests.

### IN-03: `/documents/{id}/versions` still sends an unvalidated id to PostgREST

> **Not addressed (info)** in the 2026-10-16 fix round — recorded, not scheduled.

**File:** `backend/app/api/documents.py:900`

Its sibling routes now get `_uuid_or_422` / `_uuid_or_404`, but this one does not. A malformed id produces a 22P02 → 500. Use `_uuid_or_404(document_id)`.

### IN-04: The in-flight count and the queue disagree when an in-flight document is archived

> **Not addressed (info)** in the 2026-10-16 fix round — recorded, not scheduled.

**Files:** `frontend/src/components/library/IngestionTab.tsx:171`, `:479`, `:492`, with `backend/app/api/library.py` `LIBRARY_SUMMARY_SQL`

The pill and cards count archived rows: the summary's `status.*` includes `archived_at IS NOT NULL`. The queue list is `GET /documents?status=in_flight` with `include_archived` defaulting to false. This is rare, but the two numbers can differ on the same tab. Pass `include_archived: true` to the three status lists, or add `AND archived_at IS NULL` to the status grouping set.

### IN-05: Two number renders still break UI-SPEC's grouping rule

> **FIXED 2026-10-16** — RED `b10484562` → GREEN `4c87a102b`.

**Files:** `frontend/src/components/library/LibraryHeaderBar.tsx:244` and `frontend/src/components/ui/AnimatedNumber.tsx`

`Reading {inFlight} files` is not grouped, so it reads "Reading 1200 files". Separately, numbers rendered as `toLocaleString()` strings are parsed with a comma-only strip. In `de-DE`, "10.000" is read as 10.000 with three decimals, so the count-up frames show "3.142…" before landing on the right value. Fix: use `inFlight.toLocaleString()`, and strip the locale's group separator, or pass the number and a formatter.

### IN-06: The `document_types` cap (T-284-12) bounds the response, not the query

> **Not addressed (info)** in the 2026-10-16 fix round — recorded, not scheduled.

**File:** `backend/app/api/library.py:272`

The `(doc_type)` grouping set returns every distinct value. The 200-value cap is applied in Python after `conn.fetch`. A pathological `metadata.document_type` with one value per document still returns N rows from SQL. To cap it in SQL, compute the doc-type list in a separate `... GROUP BY 1 ORDER BY count(*) DESC LIMIT 201`.

### IN-07: A failed page change leaves the pager's range and the rows out of step

> **FIXED 2026-10-16** — RED `578b603de` → GREEN `232b2bf03`.

**Files:** `frontend/src/hooks/useLibraryDocuments.ts:228-238` and `LibraryPage.tsx:971-981`

A warm request that fails keeps the previous page's rows, which is correct. But `pageOffset` has already advanced, so the pager reads *"51–75 of N"* above rows 26–50, under an alert saying the rows "may be out of date". Suggest rolling `pageOffset` back to the settled request's offset when the warm request fails, or showing the settled offset.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
