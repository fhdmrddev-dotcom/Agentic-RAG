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


## Review round 2 — migration 208 (2026-10-16)

**Scope:** `git diff 59a0337fb 572d90f42`, security-focused. Files: `supabase/migrations/208_library_page_index.sql`, `scripts/apply_migration_208.py`, `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` (the regenerated hunks), `backend/tests/integration/test_284_page_index_live.py`, `.planning/phases/284-library-at-scale/284-06-SUMMARY.md`. Compared against `supabase/migrations/207_library_documents_view.sql` and `supabase/migrations/154_connection_scoped_visibility.sql:109-119`. Consumers checked: `backend/app/api/documents.py`, `backend/app/api/library.py`, `backend/app/services/document_search_service.py`, `backend/app/services/document_view_resolver.py`, `backend/app/services/tools/documents.py`, `backend/tests/integration/test_284_view_live.py`, `backend/tests/integration/_284_scale_account.py`. This review was read-only: no DB access, no Supabase MCP, nothing on :8000.

**Findings (round 2):** critical 0 · warning 5 · info 5 · total 10

**Verdict:** The SQL is correct. The policy rewrite is equivalent to 154's, the view returns exactly 207's rows, and I could not find an input that leaks a row or a column. All five warnings are about the **proof**, not the change. VERIFY checks that pieces are present, not that the result is right. The parity run that shipped did not cover the policy change. No standing test protects the one invariant that makes the UNION ALL exact. The production apply also needs a lock timeout.

### Answers to the five questions

**Q1 — Policy equivalence. Equivalent, with no other text changed.**
- **Text.** 208:113-120 (`v_154` / `v_208`) and the regenerated `full-schema.sql` policy line differ in one place only: `(auth.uid() = user_id)` becomes `(( SELECT auth.uid() AS uid) = user_id)`. The name, `FOR SELECT`, `TO authenticated`, PERMISSIVE, the org gate, the shared-folder arm and the connection arm are byte-identical to 154:110-119.
- **Semantics.** `auth.uid()` is STABLE and has no arguments. It reads only `request.jwt.claim.sub` / `request.jwt.claims`. An uncorrelated InitPlan evaluates it once per statement execution, where the bare form evaluates it once per row, and both read the same GUCs. They differ only if a GUC changes *inside* one statement. `grep set_config.*request.jwt` over `supabase/migrations/` finds nothing, so no SQL path does that. Realtime's `apply_rls` sets the claims and then runs a separate statement, so it gets a fresh InitPlan each time. This is also Supabase's documented pattern.
- **NULL uid.** `NULL = user_id` is NULL in both forms, so both fail closed.
- **Per role.** *authenticated*: same predicate, so the same rows. *anon*: the policy is `TO authenticated`, both before and after, so it never applies to anon. 208 changes no anon grant or policy. *service_role*: BYPASSRLS, so no policy is consulted. The table owner is the same, since `documents` is ENABLE and not FORCE RLS (full-schema.sql:9092).
- **Restrictive policy.** `documents_agent_read_retrievable` (the `app.agent_read` / `retrievable` gate, mig 205) is a separate policy. 208 does not touch it. It is still ANDed with the permissive one.
- **The guard (208:110-135).** It compares `pg_get_expr(polqual)` as full text under a pinned `search_path` (208:95). It also requires `polcmd='r'`, `polpermissive`, and `polroles = {authenticated}` exactly. A SELECT policy cannot have a WITH CHECK (`polwithcheck` is always NULL), so USING is the whole expression. A production policy that differs in any token, role, command or permissiveness makes the guard raise, which is fail-closed. Text equality under a fixed search_path pins the expression tree, so I found no way it could pass on a policy that means something different. What it does not check is the *bodies* of `folder_is_org_shared` and `connection_doc_is_visible`. That is irrelevant here, because the recreated policy calls the same functions. See IN-R2-03 for the PG-version caveat.
- **Other policies.** The INSERT, UPDATE and DELETE policies on `documents` (full-schema.sql:8278 / 8411 / 8537) are unchanged. The regen diff touches only line 8667.

**Q2 — View rewrite. Same row set, no new exposure.**
- **Rows.** Leg 1 gives `scope_key = d.user_id = uid`, which is the caller's own documents (207's first disjunct). Leg 2 gives `scope_key = auth.uid() = uid`. That is a pseudo-constant gate: true for a real caller, NULL when there is no uid. It is ANDed with `user_id IS DISTINCT FROM uid` and `folder_id = ANY(shared folders with f.user_id <> uid)`. That is 207's second disjunct minus the rows already in leg 1. `= ANY` with a NULL `folder_id` is NULL, so 207's `folder_id IS NOT NULL` is implied. The union is exactly 207's set, and the legs are disjoint.
- **Shared leg.** Own-folder rows: other users' documents in a shared folder the caller owns are excluded by `f.user_id <> uid` (208:236-237), as in 207. Other-org rows: `documents` RLS (the org gate) and `folders` RLS still apply beneath, because security_invoker is kept (208:150; VERIFY row 1).
- **Duplicates.** A caller-owned document in *another user's* org-shared folder satisfies both legs' folder conditions. `u.user_id IS DISTINCT FROM uid` (208:234) removes it from leg 2, so it appears once. No standing test covers this shape (WR-R2-05).
- **Bypassing the outer WHERE.** PostgREST filters, `or=`, and ordering are ANDed onto the view's own qual. They cannot replace it. `leg` and `scope_key` are not output columns, so they cannot be selected, filtered or ordered on (a request naming them gets PGRST/42703). The view is not `security_barrier`, so a client predicate could in principle run before the view's WHERE. But every row reachable that way is one `documents` RLS already admits, and the caller can read the base table directly. That is the same as 207, which already recorded "the predicate is the DEFINITION, RLS is the WALL".
- **The LEFT JOIN.** `o` is `public.documents` under the same RLS, in the same snapshot and statement. The `u` row passed that RLS, so `o` always matches and `o.id = u.id`. Only `o.id` is projected, so the join exposes no column.
- **Grants (208:246-251).** REVOKE ALL from PUBLIC, anon, authenticated and service_role, then GRANT SELECT to authenticated and service_role. PUBLIC is revoked explicitly, so the PUBLIC trap does not apply. CREATE OR REPLACE also keeps the existing ACL. The six lines are unchanged in `full-schema-supplement.sql` (+1 comment line only).
- **Service role.** BYPASSRLS, and `auth.uid()` is NULL, so leg 1 gives `NULL = d.user_id` and leg 2 gives `NULL = NULL`. Both are NULL, so 0 rows.
- **The agent path.** `resolve_filter` defaults to `via_view=False` (document_view_resolver.py:324). `tools/documents.py:513-525` uses that default for the count and passes `via_view=False` explicitly for the page. `query_documents_by_view` never reads the view.

**Q3 — Indexes.** No security risk. They are plain btrees on existing columns and change no visibility. See WR-R2-03 (locking inside the transaction) and WR-R2-04 (the CONCURRENTLY path can leave an INVALID index that VERIFY passes). Plain CREATE INDEX is right at production's 178 rows.

**Q4 — Apply script.** The loopback guard (apply_migration_208.py:42, 57-60) checks a hard-coded constant, and no environment variable is read. It cannot reach cloud, though the guard is tautological (IN-R2-05). Idempotency is properly proven: the script applies twice and compares the VERIFY rows, the viewdef and the policy text (146-160). The per-user md5 fingerprint (84-108, 163-169) is a strong row-for-row check **of the view**. **VERIFY itself proves only presence** (WR-R2-01). The parity that shipped did not cover the policy transition (WR-R2-02).

**Q5 — Columns.** The same 36 columns, in the same order (33 base columns plus `filename_key`, `version_count`, `has_earlier`). I checked them name by name against 207:50-104. Every union column is the same `d.<col>` in both legs, so its type, typmod and collation are unchanged. `o.id` is `documents.id` (uuid). `CREATE OR REPLACE VIEW` refuses to change a column's name, type, typmod or collation, so the clean apply is itself proof. PostgREST clients are unaffected. Only FK traceability changed (IN-R2-02).

### Warnings

#### WR-R2-01: VERIFY's policy and view checks are substring checks, so they PASS on a widened policy or a leaky leg 2

**File:** `supabase/migrations/208_library_page_index.sql:266-268, 285-287, 302-313`
**Issue:** VERIFY is the one check the operator runs in production after the paste. Rows 13-14 pass when the policy text *contains* the wrapped uid and the three arm names. Concrete failing input: a policy whose qual is 208's text with `OR true` appended inside the disjunction. Another: the org gate turned from `AND` into `OR`. Both still contain `( SELECT auth.uid() AS uid) = user_id`, `current_user_org_ids()`, `folder_is_org_shared(folder_id)` and `connection_doc_is_visible(...)`, and neither contains `(auth.uid() = user_id)`, so both read **PASS** while the wall is gone. Row 2 passes any view containing `UNION ALL` and `scope_key`, including one whose leg 2 has lost `IS DISTINCT FROM` (duplicates) or `f.user_id <> uid` (other users' documents in the caller's own shared folder, which 207 excludes on purpose). Row 8's label says "(and reads 0 rows: auth.uid() is NULL)", but it checks only privileges, so the label claims something no row checks. The DO guard (110-135) is exact and runs *before* the change. Nothing exact runs *after* it.
**Fix:** Make the post-apply proof exact, using the guard's own constant.
```sql
('the documents SELECT policy is exactly 208''s',
 (select pg_get_expr(p.polqual, p.polrelid) from pg_policy p
   where p.polrelid = 'public.documents'::regclass
     and p.polname = 'Users can view own or global-folder documents'
     and p.polcmd = 'r' and p.polpermissive
     and p.polroles = array['authenticated'::regrole::oid])
 = '((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids)) AND ((( SELECT auth.uid() AS uid) = user_id) OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)) OR connection_doc_is_visible(source_connection_id, ingest_visibility)))'),
('exactly one permissive SELECT policy on documents',
 (select count(*) = 1 from pg_policy where polrelid = 'public.documents'::regclass
    and polcmd in ('r','*') and polpermissive)),
```
Run VERIFY with `SET search_path TO public, extensions` first, so the deparse matches. For the view, compare `md5(pg_get_viewdef('public.library_documents'::regclass, true))` to the value recorded at the local apply, or at least add `like '%IS DISTINCT FROM%'` and `like '%f.user_id <> ( SELECT auth.uid()%'`. Drop "reads 0 rows" from row 8's label, or prove it with a separate `SET LOCAL ROLE service_role; SELECT count(*) …` step.

#### WR-R2-02: The parity run that shipped did not cover the policy change, and a view fingerprint cannot see the connection arm

**File:** `scripts/apply_migration_208.py:133-137, 163-169`; `.planning/phases/284-library-at-scale/284-06-SUMMARY.md:130, 199, 204`
**Issue:** SUMMARY:204 records that after the PGRST200 revert, *"the indexes and the policy stayed"*. So the final run's `fp_before` was taken with the policy **already wrapped**. Its "207 → 208, all 43 users same" result compares the 207 view against the 208 view under one policy. It does not compare policy 154 against policy 208. That transition was logged only by an earlier run of a different script (SUMMARY:130, "12/12"), and its output is not in the record. Even a run that crossed the transition fingerprints `library_documents`, not `documents`. The view excludes connection-visible documents, so the policy's `connection_doc_is_visible` arm, and any row reachable only through it, is outside what the fingerprint can see. SUMMARY:199's *"parity was checked for all 43 users"* is therefore stronger than the evidence. The change is still correct (Q1 proves it from first principles), and the 86-test RLS suite is real evidence. But the claim in the record is overstated, and this is the threat flag the summary itself raised.
**Fix:** Before the production paste, run one local, rolled-back proof that fingerprints the **base table** under both policies.
```python
# inside ONE transaction, then ROLLBACK
for policy_sql in (POLICY_154, POLICY_208):
    await conn.execute('DROP POLICY "Users can view own or global-folder documents" ON public.documents')
    await conn.execute(policy_sql)
    for uid in users:  # SET LOCAL ROLE authenticated + request.jwt.claims ONLY (PostgREST's branch)
        fp[policy][uid] = await conn.fetchrow(
            "SELECT count(*), md5(string_agg(id::text, ',' ORDER BY id)) FROM public.documents")
assert fp[154] == fp[208]
```
Do the same for `app.agent_read = 'on'`. Make sure at least one local user has a `connection_doc_is_visible` row. Then correct SUMMARY:199 to say what was actually proven.

#### WR-R2-03: The production apply holds ACCESS EXCLUSIVE on `public.documents` with no `lock_timeout`

**File:** `supabase/migrations/208_library_page_index.sql:91-147`
**Issue:** The transaction first takes SHARE on `documents` (three CREATE INDEX statements, 98-107). `DROP POLICY` / `CREATE POLICY` (137-138) then upgrade that to ACCESS EXCLUSIVE, held until COMMIT. 207 locked only the view, so 208 is the first migration in this phase to lock the hot table this way. Without `lock_timeout`, an AEL request queued behind any open transaction on `documents` makes every later read and write of `documents` queue behind *it*. Examples of such a transaction: an ingestion worker, a long Find, a Studio tab left in a transaction. That stalls the whole app (chat retrieval, Library, ingestion) for as long as the blocker lives. Row count does not matter here, so this applies even at 178 documents. The SHARE→AEL upgrade can also deadlock against a session that holds ACCESS SHARE and then wants ROW EXCLUSIVE. Postgres aborts one side; if that side is the migration, it rolls back cleanly.
**Fix:** Add `SET LOCAL lock_timeout = '3s';` next to the `SET LOCAL search_path` (208:95), and re-paste on a timeout. Optionally move the policy block before the indexes, so the transaction asks for its strongest lock first and no upgrade is needed.

#### WR-R2-04: The documented CONCURRENTLY path can leave an INVALID index that `IF NOT EXISTS` skips and VERIFY passes

**File:** `supabase/migrations/208_library_page_index.sql:86-88, 98-107, 288-299`
**Issue:** The header tells the operator to run the three indexes `CONCURRENTLY` first above ~100k documents. A cancelled or failed `CREATE INDEX CONCURRENTLY` leaves a catalog entry with `indisvalid = false` under the same name. The migration's `CREATE INDEX IF NOT EXISTS` then skips it. VERIFY rows 9-11 read `pg_indexes`, which lists invalid indexes with a perfect `indexdef`, so they PASS. The result is an index the planner never uses, reported as present. It is not a security issue, but VERIFY would certify a state that is not real.
**Fix:** Have VERIFY join `pg_index` and require validity.
```sql
exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
         where c.relname = 'documents_library_root_created_idx' and i.indisvalid and i.indisready)
```
In the header, say: "if a CONCURRENTLY build fails, `DROP INDEX CONCURRENTLY <name>` and rebuild before pasting 208."

#### WR-R2-05: No standing test protects the legs' disjointness, so deleting `IS DISTINCT FROM` breaks nothing red

**File:** `supabase/migrations/208_library_page_index.sql:234`; `backend/tests/integration/test_284_view_live.py:87-100, 103-118, 207-225`
**Issue:** "The legs are disjoint and UNION ALL is exact" (208:44-45) rests on one predicate. The standing suites cannot see that predicate fail. The fixture has the peer own nothing, and both shared folders belong to the owner. So no caller has a document of their own inside **another user's** org-shared folder, which is the only shape both legs match. `test_view_latest_set_equals_the_legacy_rule` collects ids into a `set` (`out.update`, line 116), and a set silently removes duplicates. Concrete failing input: user B moves one of B's own documents into A's org-shared folder, and 208:234 is deleted. B's Library then lists that document twice and B's `count=exact` is +1, and every 284 live test stays green. Only the throwaway `apply_migration_208.py` would catch it, and only if the local data happened to contain that shape.
**Fix:** In the seed or fixture, give the peer one latest document in `Shared 284` (owned by the owner). Then in `test_view_latest_set_equals_the_legacy_rule`, also assert that the plain `SELECT count(*) … WHERE is_latest` equals `len(view)`. In the peer leak test, assert `count == 21` and that ids are unique.

### Info

#### IN-R2-01: The other `documents` policies still call `auth.uid()` bare

**File:** `supabase/full-schema.sql:8278, 8411, 8537`
**Issue:** These are the INSERT, UPDATE and DELETE policies. They are untouched, which is correct for this change's scope. The SELECT policies on `document_chunks`, `document_tables` and `document_images` (154:121ff) are also bare, and they sit under every chunk search. **Fix:** If a later phase profiles them, apply the same wrap under the same exact-text guard. It is not needed for 284.

#### IN-R2-02: PostgREST can no longer trace FK columns through the UNION, so a future embed via them would PGRST200

**File:** `supabase/migrations/208_library_page_index.sql:152-185`
**Issue:** Only `id` is traceable, via `o`. `user_id`, `folder_id`, `org_id`, `source_connection_id` and `archived_policy_id` come from `u`, through the UNION. So `library_documents?select=…,folders(name)` or `connector_connections(name)` would fail the way `document_tables(count)` did at the first apply. I found no current consumer: I checked `LIST_SELECT`, `FIND_SELECT`, `LIBRARY_ROW_COLUMNS`, `documents.py:1067`, and grepped the frontend for `library_documents` (0 hits). **Fix:** Add a header line naming this. The fix pattern, if one is ever needed, is to project the FK column from `o`.

#### IN-R2-03: The guard's text constant depends on how the production Postgres major version deparses

**File:** `supabase/migrations/208_library_page_index.sql:113-120`
**Issue:** The constants were captured on local PG 17.6. If the production major version deparses `IN (SELECT …)` differently, the guard raises. That is fail-closed, so the risk is a blocked deploy, not a weakened one. **Fix:** Before the paste, as a free read in the SQL editor, run `SET search_path TO public, extensions; SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polname = 'Users can view own or global-folder documents';` and compare it with `v_154`.

#### IN-R2-04: Adding a column to the view now means editing three places

**File:** `supabase/migrations/208_library_page_index.sql:151-228`
**Issue:** A new `documents` column must go in leg 1, leg 2 and the outer list. Mismatched legs fail at CREATE, and the P-2 fence (`test_284_view_live.py:123-140`) catches a missing output column. So drift is caught, just in more places. **Fix:** Update 207's "COLUMN DRIFT" note to say three places.

#### IN-R2-05: The apply script's loopback guard tests a constant

**File:** `scripts/apply_migration_208.py:42, 57-60`
**Issue:** `DSN` is a literal, so `_refuse_non_local` can never fire. It is harmless and documents intent. It would matter only if someone later made the DSN configurable. **Fix:** Leave it as is, or assert on `conn.get_server_pid()` / `inet_server_addr()` after connecting, so the check is against the live connection.

---

_Round 2 reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer, fresh context)_
_Depth: standard (security-focused) · independent_review: self_

### Fix status (round 2) — 2026-10-16

| Finding | Status | Commit | Proof |
|---|---|---|---|
| WR-R2-01 | **fixed** | `d0a11ec71` | VERIFY is now 16 rows under a pinned `search_path`: the policy USING text is matched exactly, the SELECT policies are counted and named, the view md5 is checked, and row 8's label is honest, with a real 0-row read next to it. Each of the 8 plants (`OR true`, AND→OR, a 2nd permissive policy, the restrictive one dropped, leg 2 without `IS DISTINCT FROM`, without `f.user_id <>`, an INVALID index, a not-READY index) flips its row to FAIL in a rolled-back transaction. The OLD VERIFY passed all 8. The real objects read 16/16 |
| WR-R2-02 | **fixed** | `d0a11ec71` (`--parity-policy`) + docs commit | One rolled-back transaction compares the documents TABLE and the view under policy 154 vs 208, for every user plus a no-uid caller, claims only, `app.agent_read` off and on, in two data states. The connection arm decides 696 rows when widened. Result: same for 42/42 (325 docs) and 44/44 (50,545 docs). A planted policy without the connection arm FAILS it (table 38/42), while the view stays 42/42. The SUMMARY claim is corrected (struck through) |
| WR-R2-03 | **fixed** | `d0a11ec71` | `SET LOCAL lock_timeout = '3s'`. The guard runs first and DROP/CREATE POLICY runs last, before COMMIT. The header says to retry on timeout and never widen it |
| WR-R2-04 | **fixed** | `d0a11ec71` | Index rows require `indisvalid AND indisready`. The header covers the CONCURRENTLY recovery: drop the invalid index, then rebuild |
| WR-R2-05 | **fixed** | `1ec242a84` | `test_284_view_disjoint_live.py`. RED with a planted view: *"listed 2 times"*. Restored with `apply_migration_208.py --apply` (16/16 twice). The view md5 is back to `9d2b4cf5…`. All `test_284_*` passed: 44, 0 skipped |

Details and pasted output: `284-REVIEW-FIX-R2.md`. IN-R2-01..05 are not addressed (info).
