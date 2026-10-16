# Phase 284: Library at Scale - Context

**Gathered:** 2026-10-16 (autonomous `--auto`: the operator said "make sure to execute this phase — discuss, plan, everything end to end")
**Status:** Ready for planning

<domain>
## Phase Boundary

**FIX-11 (`BUG-261014-06` + `BUG-261014-07`):** the Library, Find and every document picker stay correct
and fast for an account with **tens of thousands** of documents:

- the server returns **one page at a time** (limit / offset in SQL, exact total from the database);
- the server does **every count** (folder counts, root count, in-flight count, CHUNKS tile, per-row table /
  image counts, the header total);
- **no request carries an id list that grows with the library**, and the `BUG-261014-06` batching stopgap
  (`_ID_BATCH`, `documents.py:741`) is **removed**;
- **no list is silently cut** at PostgREST's 1,000-row cap — not the Library, not Find, not a saved view,
  not a picker, not a document's Chunks / Tables / Images list.

Measured at 10,000 and 50,000 seeded documents, before and after. Guarded by a test driven RED.

No new user-facing capability: no bulk actions, no folder-tree search, no new filter, no infinite canvas.
Layouts stay as shipped (the pager, the tiles, the tree, the detail panel).

</domain>

<decisions>
## Implementation Decisions

### Measured at discuss (scout, HEAD `84602491a`). These facts drive the decisions.

- `GET /documents` (`backend/app/api/documents.py:744`) reads **every** latest own document, then every
  document in globally visible folders (`.in_("folder_id", global_folder_ids)`), merges and sorts **in
  Python**, then counts `document_tables` / `document_images` per document with `.in_("document_id", …)`
  batched at 100 ids (the stopgap), then a connection-name `.in_` over the distinct connection ids. No
  `.range()` anywhere → PostgREST's `max_rows` (1,000 locally) cuts it silently.
- `useDocuments` (`frontend/src/hooks/useDocuments.ts`) holds the **whole list** in memory, patches it
  from Realtime (UPDATE merge, INSERT prepend, DELETE filter), exposes **no loading flag** (SEED-248).
- `LibraryPage.tsx` (1,302 lines) derives from that whole list, all in the browser:
  `inFlightCount` (:310), folder-scoped list (:655), `splitArchived`, the **client-side pager slice**
  (:680, `pagedDocuments`), per-folder counts (:453), root count (:446), `folderDocuments` →
  `FolderDetail` (count + total size), `totalDocuments={documents.length}` (:1136), the selected-document
  resolution (:388), and it passes the whole array to `LibraryStatTiles` (CHUNKS = Σ chunk_count),
  `IngestionTab` (stage cards, history, failed list) and `FindQuickAdd` → `StructurePopovers`
  (relationship-target picker; "connections that placed these documents").
- `DocumentsPager.tsx` already supports an `exact` total (Find passes it); browse does not, so it carries
  a `ROW_CAP = 1000` "list may be larger" honest arm.
- Saved views: `GET /document-views/{id}/resolve` and `POST /document-views/resolve`
  (`backend/app/api/document_views.py:202,263`) return **every** matching document; the page shows them
  unsliced (:676 comment).
- Find: `document_search_service.py` builds the full candidate list, filters `has_earlier` in Python,
  sorts in Python (`_sort_rows`), then slices `ordered[offset:offset+limit]` (:573).
- `listDocuments()` whole-library callers: `useDocuments`, `CreateLinkDialog.tsx:83`,
  `TakeoffSection.tsx:78`, `LegalHoldDialog.tsx:149`. `StructurePopovers` receives the whole list as a prop.
- Per-document lists with no `.range()`: `GET /documents/{id}/chunks` (:1058, deferred here by 283),
  `/tables` (:1168), `/images` (:1191), `/versions` (:818).
- SQL already has `public.folder_is_globally_visible` (the global-subtree predicate) — a server-side
  query can reuse it instead of shipping a folder-id list.
- The public API reference ships `GET /documents` as a JSON **array** (`docs/public/api/openapi.public.json`,
  snapshot in `openapi.snapshot.json`, Phase 276).

### The paging contract (one vocabulary)

- **D-01: `GET /documents` returns an envelope `{documents, total, offset, limit}`** — the same shape Find
  (`/document-search`) already returns. It is a **deliberate breaking change** to the public API: an array
  that quietly shrank from "up to 1,000" to "one page" would reproduce this bug for every API consumer,
  so the change must be loud. Same commit: public OpenAPI snapshot regenerated, the API reference page
  and the public changelog (`docs/public/changelog/`) say it is breaking and how to page.
- **D-02: Params:** `limit` (default **25** — the pager's default; max **200**, 422 above), `offset`
  (≥ 0), `folder_id` (a uuid, or `root` for unfiled, or absent for all), `include_archived` (default
  false — today's browse rule), `status` (`in_flight` = pending|processing|paused, `completed`, `failed`;
  absent = all). Sort stays `created_at desc` (today's order) with `id` as the tiebreaker so pages are
  stable.
- **D-03: `total` is the database's exact count of the same predicate** (`count="exact"` or `count(*)
  over()` in SQL), never `len()` of anything fetched.
- **D-04: The visible set is preserved exactly:** own latest documents ∪ latest documents in globally
  visible folders, de-duplicated — no widening to "everything RLS lets me read", no narrowing. The global
  leg is expressed **in SQL** (reuse `folder_is_globally_visible`, never restate the subtree rule), so no
  folder-id or document-id list rides a URL. If PostgREST cannot express the union with `.range()`, it is
  a SQL function (D-14).
- **D-05: Per-row extras are computed for the PAGE only** — `table_count`, `image_count` and
  `source_connection_name` for ≤ `limit` rows (a join, an embedded count, or a function), never for the
  library. A page-bounded id list (≤ 200) is acceptable; the stopgap loop over the whole library is
  deleted.

### Server-side aggregates

- **D-06: ONE summary read: `GET /documents/summary`** (name at planner's discretion) returning, over the
  same visible set as D-04: total latest documents; archived count; per-folder `{count, size_bytes}` map
  plus the root `{count, size_bytes}`; status counts (pending / processing / paused / completed / failed)
  and in-flight counts per `ingestion_step` (for the ingestion stage cards); Σ `chunk_count`; the distinct
  source connections `{id, name, count}`. One request, aggregated in SQL (GROUP BY), bounded by the number
  of folders / statuses / connections, never by documents.
- **D-07: The Library's numbers all come from it:** header total, in-flight pill, folder NavRow counts,
  root count, `FolderDetail` count + size, CHUNKS tile, IngestionTab cards. A number must equal the
  database count at 10,000 documents (SC#3). VECTORS / FOUND tiles keep their existing endpoints (verify
  `getReembedProgress().total` is itself not capped at 1,000; fix it here if it is).
- **D-08: Refresh rule (Realtime stays a hint, D-v2.5-03):** a `documents` change event triggers a
  **debounced (~500 ms) refetch of the current page + the summary**. An UPDATE to a row that is on the
  current page may still merge in place (so the live status badge / ingestion strip stays instant), but
  INSERT / DELETE never patch a list — they refetch. Upload keeps its optimistic row on the current page
  until the refetch reconciles it.

### The Library surface

- **D-09: Browse pages on the server.** The pager passes `offset/limit` to `GET /documents` and renders
  the server `total` with `exact`. The `ROW_CAP = 1000` honest arm in `DocumentsPager.tsx` is **deleted**
  (nothing depends on the cap any more); its tests are retired on purpose, with the reason in the commit.
- **D-10: Saved views and ad-hoc filters page too.** Both resolve endpoints take `limit/offset` and return
  the exact `total`; the Views list uses the same pager. `count_only` keeps working.
- **D-11: The selected document resolves page → Find rows → a single-document read.** If the open
  document is on neither, it is fetched by id (`GET /documents/{id}` through the user client, same visible
  set; add the GET if none exists). The detail panel never needs the whole library.
- **D-12: A loading state (SEED-248, Library half — folded).** The data hook exposes `loading` and
  `error`; an empty state ("No documents in this folder" / "No root documents yet") renders **only** after
  a successful load with `total === 0`. While fetching, the table shows the existing skeleton/loading
  treatment (reuse a shipped one, e.g. `MessageSkeleton`'s pattern or `CONNECTIONS_LOADING`'s copy
  approach); a failed load says it failed, never "0 documents".
- **D-13: IngestionTab** reads its counts from the summary and its history / failed lists from
  `GET /documents?status=…` paged (most recent first, same pager). Layout unchanged.

### Find and the pickers

- **D-14: Find pages in SQL.** Sort, `has_earlier`, the `older_matches` count and the page slice all run
  in the database; no Python post-filter runs before the slice. Where the PostgREST builder cannot express
  a predicate (the lineage `has_earlier` EXISTS, the D-04 union), use a SQL function in **migration 207**.
  Relationship allow-lists stay as they are only if they are bounded by one document's relationships (not
  the library); the researcher confirms.
- **D-15: Pickers search on the server — reuse Find's endpoint, no new search endpoint.**
  `CreateLinkDialog`, `TakeoffSection`, `LegalHoldDialog` and the `StructurePopovers` relationship-target
  picker type-ahead against `POST /document-search` (latest versions only, `limit` 20, ~250 ms debounce;
  an empty query shows the 20 most recent). The "connections that placed these documents" popover reads
  the summary's distinct-connections list (D-06). The researcher reads each caller first: if one needs
  something other than "pick a document" (e.g. Takeoff matching), it gets the narrowest bounded read
  that answers that need, recorded.
- **D-16: `listDocuments()` stops existing as a whole-library call.** Its signature takes paging params;
  a frontend fence fails if any component calls a document list without them.

### Per-document lists

- **D-17: `/chunks`, `/tables`, `/images`, `/versions` take `limit/offset` and return the exact total.**
  The Chunks section header shows the exact total (not 1,000); the bounded inner list from 283 loads the
  next page when scrolled to its end (a sentinel, **no "Show all" button** — 283's rule stands). Tables /
  images / versions page with a default high enough that the common document shows everything (planner
  sets it) and say "N of M" when they do not.

### Security (security_enforcement)

- **D-18: Every new SQL function is `SECURITY INVOKER`**, `SET search_path = ''` (or `public`), `REVOKE
  ALL … FROM PUBLIC`, `GRANT EXECUTE … TO authenticated` (the PUBLIC trap in CLAUDE.md), mirrored in
  `scripts/full-schema-supplement.sql`. Proven **as `authenticated` with a real user JWT**, never the
  service role, including a **two-user leak test**: user B pages, counts and searches and sees none of the
  synthetic account's 10,000 documents.
- **D-19: Migration 207 only if needed** (an index the EXPLAIN shows is required, or a function D-04 /
  D-14 needs). Applied via the SQL editor, `full-schema.sql` regenerated without reset, numbered
  `207_<name>.sql`. Production parity (migration before backend, `get_advisors(security)`) is recorded as
  owed for the deploy — no production write in this phase.

### Measurement (measure first)

- **D-20: A dedicated synthetic account, never the operator's dev account.** A seed script under
  `scripts/` (idempotent, with `--teardown`) creates one local user (`scale284@…`) and seeds **10,000**,
  then **50,000** latest documents: ~60% root, one folder holding exactly 10,000, a spread of smaller
  folders, a few hundred archived, a few hundred in-flight, `chunk_count` set, some `document_tables` /
  `document_images` rows, a few versions. Rows only — no storage bytes, no embeddings. A second synthetic
  user owns nothing (the leak test). It takes the **local-DB lock** (memory: lock file between sessions)
  and plans that run it are serialised (worktree rule 4).
- **D-21: Baseline BEFORE any code change** at 10k and 50k: `GET /documents` status / bytes / server time
  / rows returned, Library load time, header total vs `count(*)`, Find page time, picker request bytes.
  Expected today: 1,000 rows, wrong totals. Recorded in `284-MEASUREMENTS.md`.
- **D-22: After, same table.** Acceptance: totals equal `count(*)`; first-page bytes and time at 50k
  within **1.5×** of 10k (does not grow with the library); first page under **500 ms** server time
  locally at 50k; the summary under **500 ms** at 50k. A figure that misses is recorded with its cause,
  never rounded.

### The guard (SC#6)

- **D-23: Two layers, both driven RED by a planted regression:**
  1. **Route inventory (static):** every list-returning route in the library domain (`documents.py`,
     `document_views.py`, the document-search router, folders / kb list routes the researcher finds) must
     declare its bound (paged, or "bounded by construction: <reason>" on an explicit allow-list). A new
     unbounded list route fails. RED plant: an unbounded `select` route.
  2. **Request recording (runtime, against the seeded account):** a fixture records every PostgREST
     request the list / summary / Find / resolve handlers make; it fails if a document-table select has
     no `limit`/range, or any `in.(…)` carries more ids than the page limit. RED plant: re-insert the
     batching loop.
  Plus the frontend fence of D-16 (RED plant: a picker calling the list without paging).

### Sequencing, G-5, G-2, G-4

- **D-24: `LibraryPage.tsx` extraction FIRST, behaviour-preserving (G-5 — its extraction is OWED).** The
  named seam is a **data hook** (e.g. `useLibraryDocuments`) that owns everything the page derives from
  documents today — page rows, total, folder counts, root count, in-flight count, chunk sum, folder
  detail numbers, selected-document resolution, loading — implemented in wave 1 over the existing
  `useDocuments` so the screen is byte-identical, then re-pointed at the server in wave 2 without the
  page changing again. Children receive **numbers**, not the documents array, where they only count.
  Splitting the documents surface JSX into its own component is at the planner's discretion. Existing
  LibraryPage suites stay unedited in the extraction plan.
- **D-25: Plan shape (G-8, target 4-5):** wave 1 — (01) the frontend extraction (no DB) ∥ (02) seed +
  baseline, then the server-paged list + summary + view resolve paging + per-document bounds + stopgap
  removed (+ migration 207 if needed; holds the DB lock). Wave 2 — the Library switch to server paging +
  aggregates + loading state + Realtime refetch; Find in SQL + pickers on server search (planner decides
  whether that is one plan or two, by file overlap). Last wave — after-measurement, guard RED drives,
  G-4 drive, ledger rows, seeds / bugs close (orchestrator-owned checkpoints). TDD on, targeted suites per
  task, full gates once per wave, backend gate 71 failed / failing SET == base.
- **D-26: G-2 sketch SKIPPED — recorded as a decision.** The pager, tiles, tree, detail panel and
  pickers are all shipped layouts; this phase changes where numbers come from, not what the screen looks
  like. The only new visual states are "loading" and "load failed" (D-12), reusing shipped treatments, and
  the picker typeahead, which reuses the dialogs' existing inputs.
- **D-27: G-4 lived-experience scenarios (defined at scope time, driven by Chrome MCP as the synthetic
  account at 10k and then 50k; the operator may amend before the drive):**
  - **A.** Open the Library: Root shows the right total (equals `count(*)`) and the first page, no
    "0 documents" flash before data arrives.
  - **B.** Open the folder holding 10,000 documents, page to the **last** page: the last row is the
    oldest document in that folder per the DB; the folder's NavRow count equals the DB.
  - **C.** Open Create link (and Legal hold) and pick a document by typing part of its name: the match
    appears, and the network log shows no whole-library request.
  - **D.** Upload one file while on page 1: it appears and the totals go up by one without a reload.
  - **E.** The operator's real dev account (~286 docs): the Library shows the same documents and counts as
    before (regression row).
  Checks read the rendered **numbers and rows** and the network log, not the presence of a block.
  The dev account is in two orgs — prove the active org before each drive.

### Corrections and resolutions after research (2026-10-16, `284-RESEARCH.md` `249efeab5`)

Research measured facts that override the discuss-time scout. These **supersede** the D-numbers they name.

- **R-01 (supersedes D-04 / D-14 mechanism):** the visible-set union is a `security_invoker` **view**
  `public.library_documents` (migration 207), not an RPC and not `or=`. It drops `full_markdown` and adds
  `filename_key`, `version_count`, `has_earlier`. SELECT granted to `authenticated` only, revoked from
  PUBLIC/anon, mirrored in `scripts/full-schema-supplement.sql` (the dump is `--no-privileges`). The SQL
  predicate is `folder_is_org_shared` (renamed in migration 111), not `folder_is_globally_visible`.
- **R-02:** the view is keyed on `auth.uid()`, so the service role reads zero rows. The agent's
  `query_documents_by_view` path (service role) keeps the two-leg `resolve_filter` path, bounded by its own
  limit, with an exact total (own + global − overlap). The Library and Find use the view.
- **R-03 (supersedes D-06 location):** the summary is **`GET /library/summary`** in `library.py`, one
  `GROUPING SETS` scan through `get_user_pg_connection` (the `/library/index-summary` precedent). No new SQL
  function. It also carries the distinct **`document_types`** list (for `StructurePopovers.DocumentTypeEditor`).
- **R-04 (corrects D-02 / D-06):** `paused` is not a document status (the CHECK allows pending, processing,
  completed, failed). `in_flight` = pending | processing. The page keeps today's displayed semantics.
- **R-05 (D-15 exception, accepted):** Takeoff needs spreadsheets, not "pick by name". Its read is a bounded
  `GET /documents?kind=spreadsheet` page. `LegalHoldDialog`'s second whole-library `getDocumentStates` loop
  is removed too (server-side org filter or a page-bounded read).
- **R-06 (resolves open Q1, D-01 changelog):** the breaking change is stated in the route docstring and the
  public API `pagination.md` page in the same commit. The v4.6 changelog entry is **recorded as owed at the
  v4.6 close** (no v4.6 changelog mechanism exists yet).
- **R-07 (resolves open Q2, D-20 seed shape):** S10 = 6,000 Root / 3,000 in the big folder / 1,000 spread;
  S50 = 30,000 Root / exactly **10,000** in the big folder / 10,000 spread. G-4 B runs on S50.
- **R-08 (resolves open Q3):** IngestionTab History gets an `order=updated_desc` value (its shipped sort).
- **R-09 (resolves open Q5):** production `max_rows` is read read-only via the Supabase MCP during the
  measurement plan and recorded. It is not changed.
- **R-10 (resolves open Q6):** the kb and governance-edge list routes go on the D-23 allow-list with a
  planted seed carrying the re-open trigger, unless the fix is ≤ 10 lines in a file the phase already edits.
- **R-11 (corrects D-24):** `LibraryPage.cloudImport.test.tsx:382` pins `.folder_id` ×7, so the extraction
  edits that pin deliberately (recorded). Nine suites mock `@/hooks/useDocuments`; a `fakeLibraryApi(docs)`
  test helper keeps their cases when wave 2 switches the source. Retired on purpose, with reasons: the
  ROW_CAP cases, `test_261014_list_documents_batches_in.py`, Find's `test_legs_are_two_queries…`.
- **R-12:** Find's `has_earlier` lineage read (batched by 100 filenames, about 500 round trips at 50k) is
  replaced by the view's `has_earlier` column.

### Claude's Discretion
- Exact endpoint / function names, the summary's JSON field names, the page-size defaults for per-document
  lists, whether the D-04 union is a PostgREST `or=` filter or a SQL function (decided by what can page
  correctly), index choice (by EXPLAIN), and the exact cut between the wave-2 plans.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6) — matched on generic keywords ("run", "status", "first");
  it is about NL workflow authoring. Not folded despite the `--auto` ≥ 0.4 rule: folding it would be scope
  creep (same call as 283).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The bugs and the requirement
- `.planning/reported-bugs/BUG-261014-06-library-shows-zero-documents-uri-too-long.md` — the 414, the stopgap to remove
- `.planning/reported-bugs/BUG-261014-07-every-document-list-silently-cut-at-1000-rows.md` — the cap, behaviour by size, routing
- `.planning/REQUIREMENTS.md` — FIX-11
- `.planning/ROADMAP.md` §Phase 284 — goal, SC#1-#7, "How we'd know this failed", flags

### Project rules this phase is bound by
- `CLAUDE.md` §Rules (RLS, `run_in_threadpool`, Realtime-is-a-hint D-v2.5-03, migrations via SQL editor, regenerate `full-schema.sql` without reset)
- `CLAUDE.md` §Supabase MCP (the PUBLIC EXECUTE trap; production writes approval-gated)
- `CLAUDE.md` §Workflow guardrails (G-2, G-4, G-5, G-8) and §Parallel execution (worktrees, rule 4 DB-mutating plans serialise, `GSD_VITEST_MAX_WORKERS=2`, backend gate 71)
- `docs/HOT-FILE-LEDGER.md` — sections for `frontend/src/pages/LibraryPage.tsx`, `frontend/src/hooks/useDocuments.ts`, `frontend/src/components/ingestion/DocumentList.tsx` (the 7-column order is load-bearing, enforced by `LibraryPage`'s `nth-child`), `backend/app/api/documents.py`, `backend/app/services/document_search_service.py`, `frontend/src/lib/api/documents.ts`, `frontend/src/types/index.ts`
- `.planning/seeds/SEED-248-a-surface-that-is-still-loading-must-say-so.md` — the loading-state contract (Library half folded)

### Prior phase context
- `.planning/phases/283-every-member-reaches-their-own-settings/283-CONTEXT.md` — the Chunks bound (D-16..D-20) and its deferral of the 1,000-chunk cap to this phase
- `.planning/phases/280-in-once-out-clean/` — last edit of `documents.py` (ledger notes, minter)
- Sketch-findings skill (`Skill("sketch-findings-agentic-rag")`) — Phase 114 documents-page composition, Phase 217.1 tiles/pager, Phase 271 Find — read before touching any Library surface

### Code
- `backend/app/api/documents.py:741-816` — the list handler and the stopgap
- `backend/app/services/document_search_service.py` — Find's pipeline (`_candidates`, `_sort_rows`, slice at :573)
- `backend/app/api/document_views.py:202,263` — view resolve
- `backend/app/utils/folder_utils.py:281` — `get_globally_visible_folder_ids`; SQL `public.folder_is_globally_visible`
- `frontend/src/pages/LibraryPage.tsx`, `frontend/src/hooks/useDocuments.ts`, `frontend/src/components/library/DocumentsPager.tsx`, `LibraryStatTiles.tsx`, `IngestionTab.tsx`, `find/StructurePopovers.tsx`, `frontend/src/components/ingestion/FolderDetail.tsx`
- `frontend/src/components/relationships/CreateLinkDialog.tsx`, `frontend/src/components/metadata/TakeoffSection.tsx`, `frontend/src/components/retention/LegalHoldDialog.tsx`
- `docs/public/api/openapi.public.json` / `openapi.snapshot.json`, `scripts/export-openapi.py`, `scripts/build-public-openapi.cjs`, `scripts/check-docs-coverage.cjs`, `docs/public/changelog/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentsPager` with `exact` — browse adopts it; the cap arm goes.
- Find's response envelope `{documents, total, offset, limit}` — the one paging vocabulary D-01 copies.
- `POST /document-search` — the pickers' server search (D-15).
- `public.folder_is_globally_visible` — the global-subtree predicate, already in SQL.
- `MessageSkeleton` / `CONNECTIONS_LOADING` — shipped loading treatments for D-12.
- `useDocumentFind` — a request-keyed fetch hook; the pattern for the paged list hook.

### Established Patterns
- User-JWT Supabase client for reads (RLS), `aexec` / `run_in_threadpool` around supabase-py calls.
- Leak-safe resolve: the visible set is own ∪ global-folder, never "all RLS-visible".
- Route-inventory fences (283 D-11) and `?raw` source fences in vitest.
- Realtime UPDATE spread-merge keeps derived fields (`tables_stage_applies`) — preserve for on-page rows.

### Integration Points
- `LibraryPage` → new data hook → `GET /documents` (paged) + `GET /documents/summary`.
- `IngestionTab`, `LibraryStatTiles`, `FolderTree`/`NavRow`, `FolderDetail`, `LibraryHeaderBar` take numbers from the summary.
- Detail panel `DocumentChunksSection` → paged `/chunks`.
- Public API: OpenAPI snapshot + changelog + API reference page change in the same commit as D-01.

</code_context>

<specifics>
## Specific Ideas

- The operator's words that started this: *"if we have thousands and 10s of thousands of documents in the
  production … make sure that this is a sustainable solution not a batch"*. A fix that raises `max_rows`,
  keeps batching with more round-trips, or counts a page in the browser fails the phase.
- Production's largest account is 164 documents today (BUG-261014-07), so nothing is broken there yet; the
  batching stopgap never shipped to production.

</specifics>

<deferred>
## Deferred Ideas

- **SEED-352 (Library bulk actions, folder-tree search / keyboard nav, templates, drag reorder, local-folder
  import)** — fires on this phase's files, but every item is a new capability. Deferred; its trigger stays.
- **SEED-317 (Library provenance does not follow an org switch)** — fires on `LibraryPage.tsx`. The data hook
  of D-24 is the natural place for an org key, but the Library has no active-org handle today and adding
  one is not this phase. Deferred; re-open when the Library gains an org handle.
- **SEED-248, thread half** (cold-load-only thread skeleton) — not this phase; the seed stays partially open.
- **List virtualisation** for very long pages — not needed at page size ≤ 200.
- **Production `max_rows` value** — read it during research (read-only) for the record; changing it is not a fix.

### Seeds routed
- SEED-248 → folded (Library half), partial.
- SEED-317 → deferred (reason above).
- SEED-352 → deferred (reason above).

</deferred>

---

*Phase: 284-library-at-scale*
*Context gathered: 2026-10-16*
