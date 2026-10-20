# Phase 284: Library at Scale - Research

**Researched:** 2026-10-16 (HEAD `f01291357`, branch `develop`)
**Domain:** Server-side paging and aggregation over an RLS-protected Postgres table (Supabase / PostgREST 14.10 / supabase-py 2.29 / FastAPI), plus the React data layer that consumes it
**Confidence:** HIGH on what the code does today and where it is cut (measured). MEDIUM on performance figures at 50k (they are predictions; D-21/D-22 measure them).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `284-CONTEXT.md` `<decisions>`.)

#### Measured at discuss (scout, HEAD `84602491a`). These facts drive the decisions.

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

#### The paging contract (one vocabulary)

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

#### Server-side aggregates

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

#### The Library surface

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

#### Find and the pickers

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

#### Per-document lists

- **D-17: `/chunks`, `/tables`, `/images`, `/versions` take `limit/offset` and return the exact total.**
  The Chunks section header shows the exact total (not 1,000); the bounded inner list from 283 loads the
  next page when scrolled to its end (a sentinel, **no "Show all" button** — 283's rule stands). Tables /
  images / versions page with a default high enough that the common document shows everything (planner
  sets it) and say "N of M" when they do not.

#### Security (security_enforcement)

- **D-18: Every new SQL function is `SECURITY INVOKER`**, `SET search_path = ''` (or `public`), `REVOKE
  ALL … FROM PUBLIC`, `GRANT EXECUTE … TO authenticated` (the PUBLIC trap in CLAUDE.md), mirrored in
  `scripts/full-schema-supplement.sql`. Proven **as `authenticated` with a real user JWT**, never the
  service role, including a **two-user leak test**: user B pages, counts and searches and sees none of the
  synthetic account's 10,000 documents.
- **D-19: Migration 207 only if needed** (an index the EXPLAIN shows is required, or a function D-04 /
  D-14 needs). Applied via the SQL editor, `full-schema.sql` regenerated without reset, numbered
  `207_<name>.sql`. Production parity (migration before backend, `get_advisors(security)`) is recorded as
  owed for the deploy — no production write in this phase.

#### Measurement (measure first)

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

#### The guard (SC#6)

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

#### Sequencing, G-5, G-2, G-4

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

### Claude's Discretion
- Exact endpoint / function names, the summary's JSON field names, the page-size defaults for per-document
  lists, whether the D-04 union is a PostgREST `or=` filter or a SQL function (decided by what can page
  correctly), index choice (by EXPLAIN), and the exact cut between the wave-2 plans.

### Deferred Ideas (OUT OF SCOPE)
- **SEED-352 (Library bulk actions, folder-tree search / keyboard nav, templates, drag reorder, local-folder
  import)** — fires on this phase's files, but every item is a new capability. Deferred; its trigger stays.
- **SEED-317 (Library provenance does not follow an org switch)** — fires on `LibraryPage.tsx`. The data hook
  of D-24 is the natural place for an org key, but the Library has no active-org handle today and adding
  one is not this phase. Deferred; re-open when the Library gains an org handle.
- **SEED-248, thread half** (cold-load-only thread skeleton) — not this phase; the seed stays partially open.
- **List virtualisation** for very long pages — not needed at page size ≤ 200.
- **Production `max_rows` value** — read it during research (read-only) for the record; changing it is not a fix.

Seeds routed: SEED-248 → folded (Library half), partial. SEED-317 → deferred. SEED-352 → deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-11 | The Library, Find and every document picker stay correct and fast for an account with tens of thousands of documents — the server pages and counts, no request carries a growing id list, and no list is silently cut at the API's 1,000-row cap. (`BUG-261014-06` + `BUG-261014-07`) | §Recommended architecture (one `security_invoker` view = the one home of the D-04 set; PostgREST `.range()` + `count="exact"` over it); §Summary SQL (one `GROUPING SETS` scan via `get_user_pg_connection`); §Find in SQL; §Consumer inventory (every array consumer → its bounded read); §Route inventory (D-23 static list); §Guard design; §Validation Architecture (SC#1-#7) |
</phase_requirements>

## Summary

Every document list in the Library domain is read with an unbounded PostgREST `select` and is therefore cut at **1,000 rows with no error** — measured live today on the local stack: `GET /rest/v1/document_chunks?select=id` returns `Content-Range: 0-999/*` while `count=exact` reports `8949` [VERIFIED: live PostgREST 14.10 probe]. The same cut applies to `GET /documents` (two unbounded legs), both saved-view resolve paths — including `count_only`, which counts `len(set of ids)` from two un-ranged `select("id")` reads and so also tops out near 1,000 per leg (`document_view_resolver.py:367-386`) — and Find, which walks every candidate in 1,000-row pages and then runs a lineage read **batched by 100 filenames over every candidate** (`document_search_service.py:283-308`), i.e. ~500 round trips at 50k for `has_earlier`.

**The D-04 union cannot be paged by the PostgREST builder without shipping a folder-id list** (`or=(user_id.eq.X,folder_id.in.(…))` is exactly the URL-borne list D-04 forbids), and an RPC set-returning function is the wrong tool: any SQL function with a `SET search_path` clause (which D-18 requires) is **not inlinable**, so `rpc().range()` would materialise the caller's whole visible set on every page. The tool that pages correctly is a **`security_invoker = true` view** (`public.library_documents`, migration 207) that encodes the own ∪ globally-visible-folder predicate once in SQL, reuses `public.folder_is_org_shared` (the CONTEXT's `folder_is_globally_visible` was **renamed by migration 111** — verified), and lets every existing builder filter, Find's shared fragment walker, `.order()`, `.range()`, `count="exact"` and embedded `document_tables(count)` apply unchanged and push down into the index scan. It also keeps `test_271_no_embedding.py`'s "no `.rpc(` in the Find core" fence green. ⚠ The view is keyed on `auth.uid()`, so it returns **zero rows to the service role** (fail-closed) — which matters because the agent's `query_documents_by_view` tool calls the shared `resolve_filter` core with the **service-role** client (`threads.py:32-34`, `tools/documents.py:515-521`). That caller keeps a two-leg path.

The summary (D-06) is one `GROUPING SETS` aggregate over the view, run through `get_user_pg_connection` (asyncpg, `SET LOCAL ROLE authenticated` + JWT claims) — the shipped `GET /library/index-summary` precedent (`api/library.py`), no new SQL function, no PostgREST aggregate setting, no URL. Put it at **`GET /library/summary`** in `api/library.py`, not `/documents/summary`: `documents.py` is G-5-hot and a new `GET /documents/{document_id}` (D-11) would shadow a later-declared `/documents/summary`.

**Primary recommendation:** Migration 207 = one `security_invoker` view `public.library_documents` (own ∪ org-shared-folder set, plus `filename_key`, `version_count`, `has_earlier` columns, **without `full_markdown`**) + `SELECT`-only grants + the index(es) EXPLAIN demands; every user-JWT list/count/Find/resolve read goes through it with `.range()` + `count="exact"`; the summary is one asyncpg `GROUPING SETS` read at `/library/summary`; pickers reuse `POST /document-search`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| The visible set (own ∪ org-shared folder) | Database (view, migration 207) | — | One home in SQL; RLS still the wall beneath it (invoker); no id list in any URL |
| Page slice, order, exact total | Database (PostgREST `.order().range()` + `count=exact` over the view) | API (param validation) | `max_rows` cannot cut a ranged read; total is `count(*)` of the same predicate |
| Per-row table/image counts, connection name | Database (embedded `document_tables(count)`) / API (page-bounded name read) | — | D-05: page only |
| Library aggregates (folder counts/sizes, status, steps, Σ chunks, connections, types) | Database (one `GROUPING SETS` scan) via API `GET /library/summary` | — | Bounded by folders/statuses/connections, never documents |
| Find predicates incl. `has_earlier`, `older_matches`, sort | Database (view columns + builder filters) | API (relationship allow-list, folder subtree resolve) | D-14 |
| Pickers (link target, legal hold, relationship editor) | API (`POST /document-search`, limit 20) | Browser (debounce, chosen-item retention) | D-15 |
| Takeoff rate-sheet list | API (`GET /documents?kind=spreadsheet`, bounded) | Browser (select) | Needs "spreadsheets", not "pick by name" (D-15 narrowest read) |
| Loading / error / empty states | Browser (data hook) | — | D-12 |
| Realtime reconcile | Browser (debounced refetch) | Database (publication `supabase_realtime` on `documents`) | Hint, never truth (D-v2.5-03) |
| Guards | API tests (route inventory, request recorder) + frontend fence | — | D-23 / D-16 |

## Project Constraints (from CLAUDE.md)

- Backend in `venv`; blocking supabase-py calls inside `async` handlers wrapped (`aexec` / `run_in_threadpool`, D-v2.5-01). ⚠ `list_documents` (`documents.py:750-770`) and `list_document_versions` (`:826-844`) call `.execute()` **bare** today — the rewrite must route them through `aexec`.
- All tables need RLS; reads go through the **user-JWT client** (`get_user_supabase_client`) or `get_user_pg_connection`; never the service role for a user-facing list.
- Migrations: `supabase/migrations/207_<name>.sql` (digits only), applied to the live local DB by pasting into the SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`. `regenerate-full-schema.sh` dumps with `--no-privileges` (`:103-104`), so **every GRANT/REVOKE must be mirrored in `scripts/full-schema-supplement.sql`**.
- The PUBLIC EXECUTE trap: revoke from `PUBLIC`, then grant back. Run `get_advisors(security)` in the deploy parity checklist.
- Supabase MCP is production: reads free, every write approval-gated. No production write in this phase (D-19).
- Realtime is a hint; reconcile by fetch.
- Multi-worker uvicorn: no module-level mutable caches.
- Backend unit gate: `pytest tests/unit -q --continue-on-collection-errors` in `backend/`, ceiling **71 failed** (failing SET == base, zero headroom).
- Worktrees: bootstrap first; `GSD_VITEST_MAX_WORKERS=2`; never `rm -rf` a worktree; **rule 4: plans that mutate the local DB are serialised** (seed, migration apply, live integration tests).
- Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit` (the bare `tsc --noEmit` checks zero files); count gate from repo root, read per-file deltas.
- G-5: `check-hot-file-ledger.cjs` fails a plan whose `files_modified` names a source file with **no ledger row** (fires in the PostToolUse hook when PLAN.md is written). G-8: 3-5 plans.
- Deployment-artifact parity: no new env var is needed by this research's design (verify at plan time; if one appears, `deploy/onebox.env.example` etc. in the same commit).
- Provider-docs-first / UAT 4-axis: this phase does not touch streaming, agent loop or provider routing **if** the agent tool path is left on its two-leg code (recommended); touching `tools/documents.py` behaviour would pull in the cross-provider scoreboard.

## Standard Stack

No new packages. Everything needed is installed and current in this repo.

### Core
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| PostgreSQL | 17.6 (local) | View, indexes, `GROUPING SETS`, EXPLAIN | [VERIFIED: `select version()` local] |
| PostgREST | 14.10 (local, behind Kong 2.8.1) | `.range()` → `offset`/`limit`, `Prefer: count=exact`, embedded `table(count)`, embedding through views | [VERIFIED: `Server: postgrest/14.10` header; embedded `document_tables(count)` returned `[{"count":0}]` live] |
| supabase-py / postgrest-py | 2.29.0 / 2.29.0 | `.range(a,b)` adds `offset=a&limit=b-a+1` query params; `.order(col, desc=, nullsfirst=)` emits `.nullslast`; `select(..., count="exact")` → `.count` | [VERIFIED: `pip show`; read `postgrest/base_request_builder.py:569-636`] |
| asyncpg | ≥0.29 (installed) | `get_user_pg_connection` for the summary | [VERIFIED: `backend/requirements.txt:30`, `dependencies.py:159-177`] |
| httpx | ≥0.28 | Shared transport for user-JWT clients (`_get_shared_httpx`, `dependencies.py:183-193`) — the request recorder hooks it | [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `security_invoker` view | RPC `SETOF documents` function + `rpc().range()` | Not inlinable once it carries `SET search_path` (D-18) → materialises the whole visible set per page; breaks `test_271_no_embedding.py` (`\.rpc\(` forbidden in the Find core). Reject. |
| `security_invoker` view | `or=(user_id.eq.X,folder_id.in.(<global ids>))` | Ships a folder-id list in the URL (D-04 forbids; grows with shared folders). Reject. |
| View with `OR` predicate | View as `UNION ALL` of two disjoint legs (own; `user_id <> me AND folder_id IN global`) | UNION ALL gives Merge Append of two index-ordered scans (fast LIMIT, no top-N sort) but PostgREST may not infer embedding through a UNION view. **Fallback only if EXPLAIN at 50k misses D-22**; then count tables/images with one page-bounded `documents?select=id,document_tables(count)&id=in.(≤200)` read. |
| asyncpg summary | PostgREST aggregates (`select=folder_id,count()`) | Aggregates are disabled by default in PostgREST ≥12 and need an `authenticator` role setting [CITED: docs.postgrest.org aggregate functions — not fetched this session, 429]; a config change, not code. Reject. |
| asyncpg summary | SECURITY INVOKER SQL function via `rpc` | Works, but adds a function (D-18 obligations) for no gain over the `library.py` precedent. Use only if the planner wants PostgREST-only reads. |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — this phase installs **no** external packages (asyncpg, httpx, supabase, postgrest are already pinned in `backend/requirements.txt`; no new npm package). slopcheck was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none · **Packages flagged [SUS]:** none.

## Measured Facts the Planner Must Know (beyond CONTEXT)

1. **`folder_is_globally_visible` no longer exists.** Migration 111 renamed it OID-preservingly to **`public.folder_is_org_shared(uuid)`** (`111_is_global_retirement_rename.sql:120`; `full-schema.sql:460`). It is `LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''`, walks ancestors with a recursive CTE, and has **no org predicate** (the org gate comes from RLS on the caller's side). EXECUTE is revoked from PUBLIC and anon (`full-schema.sql:10530-10531`). [VERIFIED]
2. **The documents SELECT policy is wider than the Library set.** `"Users can view own or global-folder documents"` (`full-schema.sql:8511`): `org_id IN current_user_org_ids() AND (auth.uid() = user_id OR (folder_id IS NOT NULL AND folder_is_org_shared(folder_id)) OR connection_doc_is_visible(source_connection_id, ingest_visibility))`, plus a RESTRICTIVE `documents_agent_read_retrievable` policy (`:8942`). So RLS also admits **connection-visible** documents and **other users' documents in the caller's own shared folder**, neither of which `list_documents` shows today (the global leg excludes folders the caller owns: `folder_utils.py:290-293`, `f["user_id"] != user_id`). D-04 ⇒ the view must keep both exclusions. [VERIFIED]
3. **`paused` is not a document status.** `documents_status_check` allows only `pending|processing|completed|failed`, and `DocumentResponse.status` is the same `Literal` (`models/document.py:38`). `paused` lives on `ingestion_jobs`. The frontend's `=== "paused"` checks are dead branches; the summary may report `paused: 0` for wire compatibility, but `status=in_flight` should filter `in ("pending","processing")`. [VERIFIED: `pg_constraint` read]
4. **`select("*")` drags `full_markdown` (measured max 266,773 chars/doc, `documents.py:934-936`) through every list read** — `DocumentResponse` drops it, but Find's plain-dict `_hydrate` (`document_search_service.py:486`) **sends it to the browser**. The view should omit `full_markdown`; the list should name its columns. [VERIFIED]
5. **Local `max_rows` = 1,000.** No `supabase/config.toml` exists in the repo (`ls -a supabase/` → none), so the CLI default applies; measured `Content-Range: 0-999/*` on an unranged read. **Production `max_rows`: not read** (no Supabase MCP tool in this research session). Record as owed: `execute_sql: select rolname, rolconfig from pg_roles where rolname = 'authenticator'` (shows `pgrst.db_max_rows` only if set in-DB) plus Dashboard → Settings → API → *Max rows*. [VERIFIED local / production OPEN]
6. **`authenticated` has `statement_timeout=8s`; `anon` 3s** (`pg_roles.rolconfig`). A `SET LOCAL ROLE authenticated` asyncpg session does **not** inherit role-level config (it applies at login); the pool's `command_timeout=30` bounds it instead (`dependencies.py:107`). [VERIFIED]
7. **`getReembedProgress().total` is NOT capped**: `reembed_service.py:299-310` uses `count="exact"` + `.limit(1)`. It counts the user's own `document_chunks` rows (org-scoped when known), not the D-04 set — unchanged by D-07. [VERIFIED]
8. **`documents` is in the `supabase_realtime` publication** (`pg_publication_tables`). Seeding 50k rows will push 50k changes through Realtime; close Library tabs during the seed. [VERIFIED]
9. **The agent loop uses the service-role client** (`threads.py:32-34` "the agent-loop async writer stays service-role"), and `tools/documents.py:515-521` calls `resolve_filter` twice (count_only + full) then slices `[:limit]` (≤50). A view keyed on `auth.uid()` returns **zero rows** to that client. [VERIFIED]
10. **Ten files this phase will likely touch have NO hot-file-ledger row**, so the PLAN.md hook will fire: `backend/app/api/document_views.py`, `backend/app/api/library.py`, `backend/app/utils/folder_utils.py`, `frontend/src/components/ingestion/FolderDetail.tsx`, `frontend/src/components/library/LibraryStatTiles.tsx`, `frontend/src/components/library/ViewsTab.tsx`, `frontend/src/components/metadata/DocumentImagesSection.tsx`, `frontend/src/components/metadata/DocumentTablesSection.tsx`, `frontend/src/components/metadata/TakeoffSection.tsx`, and any new hook file (`frontend/src/hooks/useLibraryDocuments.ts`). Measured with `node scripts/check-hot-file-ledger.cjs --files …` → `[no-row]` ×10. `scripts/*.py` seed scripts and `supabase/migrations/*.sql` are exempt. [VERIFIED]
11. **Changelog mechanism mismatch (D-01).** `docs/public/changelog/` holds only `overrides.json`, keyed by an **existing** history version; the changelog is generated from `docs/history/vX.Y-*.md` (`scripts/lib/docs-content.cjs:510-541`), there is no `v4.6` file yet, and `parseHistory` throws "a release has no chapter" because the README arc ends at `v4.5` (`docs/history/README.md:30`). See Open Question 1. [VERIFIED]

## Consumer Inventory — every whole-library array consumer and its bounded read

| Consumer (file:line) | What it reads from the array today | Bounded server read that answers it |
|---|---|---|
| `LibraryPage.tsx:310` `inFlightCount` | count of pending/processing/paused | `summary.status.pending + processing` |
| `LibraryPage.tsx:1136` `LibraryHeaderBar totalDocuments` | `documents.length` (all latest, incl. archived) | `summary.total` |
| `LibraryPage.tsx:445` `rootDocumentCount` → `FolderTree` + Root header | root count incl. archived | `summary.root.count` |
| `LibraryPage.tsx:452` `folderDocumentCounts` → `FolderTree`/`NavRow` | per-folder count incl. archived | `summary.folders[id].count` |
| `LibraryPage.tsx:435` `folderDocuments` → `FolderDetail` (`FolderDetail.tsx:28-29`) | count + Σ `file_size` for the folder | `summary.folders[id].{count,size_bytes}` — change FolderDetail props to numbers |
| `LibraryPage.tsx:1017` → `LibraryStatTiles` (`:79-80`) | Σ `chunk_count`, `documents.length` | `summary.chunks`, `summary.total` — props become numbers |
| `LibraryPage.tsx:656-685` folder-scoped list + `splitArchived` + pager slice | page rows, total, archived hidden count | `GET /documents?folder_id=…&include_archived=…&limit&offset` → `{documents,total}`; archived-hidden count = `summary.folders[id].archived` (browse) |
| `LibraryPage.tsx:917` "fully archived list is not empty" guard | `listDocuments.length===0 && archivedCount>0` | `total===0 && archivedHidden>0` |
| `LibraryPage.tsx:1069` `ViewsTab corpusCount` | length of the current list | the current list's server `total` |
| `LibraryPage.tsx:384-392` `selectedDoc` | `documents.find(id)` | page rows → Find rows → `GET /documents/{id}` (D-11) |
| `LibraryPage.tsx:394-408` citation-nav pending id | resolved from the owner-scoped array | same as above; a 404 closes the panel (same visible set by construction) |
| `IngestionTab.tsx:151-158` stage cards | processing docs per `ingestion_step` | `summary.steps` (status=processing GROUP BY step) |
| `IngestionTab.tsx:173-176` in-flight / completed / failed counts | counts | `summary.status` |
| `IngestionTab.tsx:177-183` `pausedDoc` (rate-limit banner) | any in-flight doc whose `error_message` mentions rate limit / 429 / quota | `summary.rate_limited_in_flight` count, plus `GET /documents?status=in_flight&limit=1` row for the banner's verbatim error if the banner shows one (check `IngestionPauseBanner` props) |
| `IngestionTab.tsx` In-progress list, Needs-attention list (**unpaged today**), History (sorted **`updated_at` desc**, `:165-172`) | rows | `GET /documents?status=in_flight|failed|completed…` paged. ⚠ History orders by `updated_at`, not `created_at` — needs an `order=updated_desc` value (Open Question 3) |
| `FindQuickAdd → StructurePopovers.DocumentTypeEditor` (`StructurePopovers.tsx:629-648`) — **missed by CONTEXT** | distinct `metadata.document_type` values of loaded docs | `summary.document_types: [{value, count}]` (bounded by distinct types; cap 200 + `truncated` flag) |
| `StructurePopovers.AddedByEditor` (`:405-434`) | distinct `source_connection_id` + `source_connection_name` | `summary.connections: [{id, name, count}]` |
| `StructurePopovers.RelationshipEditor` (`:234-290`) | latest docs as combobox candidates | server typeahead over `POST /document-search` (`version:"latest"`, `limit:20`, `name:q`) |
| `CreateLinkDialog.tsx:83` | every doc as combobox candidates; excludes self + already-linked | same typeahead; keep the chosen doc object in state (`targetDoc = candidates.find` breaks once candidates change) |
| `LegalHoldDialog.tsx:149` + `inActiveOrg` (`:57-64`) | every doc, then **a second whole-library loop** through `getDocumentStates` in `STATE_CHUNK` chunks to keep only active-org ids | typeahead over Find (limit 20), then `inActiveOrg` over **≤20 ids** (page-bounded; Find is NOT active-org scoped — `test_271_two_org_fence.py` proves a two-org member sees both) |
| `TakeoffSection.tsx:78` | every doc, filtered client-side to spreadsheets (`.xlsx/.xls/.csv` or spreadsheet/csv mime), auto-selects the first, rendered in a `<select>` (`:274-288`) | **Not "pick by name"** — the narrowest read is `GET /documents?kind=spreadsheet&limit=50` (constant server-side `or_` of mime/extension patterns, no user value) and "50 of N" when truncated. Record as the D-15 exception. |
| `useDocuments.ts` Realtime INSERT/DELETE/UPDATE patching | the array | D-08 debounced refetch; UPDATE spread-merge for on-page rows only |
| `DocumentList.tsx:111-121` client re-filter by `folderId` | rows | harmless no-op once rows are server-scoped; leave (G-5 hot, 7-column order load-bearing) |

**Archived default for pickers:** `listDocuments()` returned archived latest docs too; Find hides them unless `include_archived:true` (`document_search_service.py:220-223`). Pass `include_archived: true` from CreateLinkDialog / LegalHoldDialog / RelationshipEditor to preserve "any visible latest document" [ASSUMED intent — confirm].

## Route Inventory (the D-23 static list)

Library-domain modules: `api/documents.py`, `api/document_views.py`, `api/document_search.py`, `api/folders.py`, `api/kb.py`, `api/library.py`, `api/document_relationships.py`, `api/document_governance.py`, `api/document_queries.py`, `api/takeoff.py`. (`api/retention.py` lists documents via asyncpg — not PostgREST-capped — and is org-admin scope; inventory it as adjacent, allow-listed with reason, or leave it out explicitly in the fence docstring.)

| Route | Today | Proposed bound / classification |
|---|---|---|
| `GET /documents` | unbounded, two legs, Python merge | **paged** `limit≤200, offset`, view, `count=exact` |
| `GET /documents/{id}` (new, D-11) | — | single object (view + `maybe_single`) |
| `GET /documents/{id}/versions` | unbounded, bare `.execute()` | **paged** (default 50, max 200) + total |
| `GET /documents/{id}/content` | `CONTENT_MAX_LINES=2000` | bounded by construction: line window |
| `GET /documents/{id}/chunks` | unbounded (silent 1,000) | **paged** (default 200, max 500) + total |
| `GET /documents/{id}/conversation` | `.limit(CONVERSATION_SIBLING_CAP=200)` + `count=exact` + `truncated` | bounded by construction: capped and reports itself |
| `GET /documents/{id}/tables` | unbounded | **paged** (default 50 — `rows` jsonb is heavy) + total |
| `GET /documents/{id}/images` | unbounded | **paged** (default 100) + total |
| `GET /documents/{id}/queries` | `.limit(MAX_ROWS=100)` + window | bounded by construction |
| `GET /documents/{id}/takeoff` | single object | single object |
| `GET /document-views` | views list, unranged | bounded by construction: one row per saved view (not documents) — allow-list |
| `GET /document-views/{id}/resolve` | unbounded; `count_only` capped ~1,000/leg | **paged** + exact total; `count_only` → `count="exact"` head read |
| `POST /document-views/resolve` | same | same (body gains `limit`/`offset`) |
| `POST /document-search` | Python-paged, `limit≤100` | **paged in SQL** (body `limit≤100`) |
| `GET /folders`, `GET /folders/{id}/children` | `fetch_visible_folders` (unranged, folders) | bounded by construction: folders, not documents — allow-list (note: silently capped at 1,000 folders) |
| `GET /kb/ls`, `/kb/tree`, `/kb/grep`, `/kb/glob`, `/kb/read` | agent KB browse; `ls` lists a folder's docs unranged | allow-list "agent KB browse (no frontend caller; agent tools call the cores with the service role) — out of FIX-11 scope" **and plant a seed** (an agent `kb_ls` of a 10k folder sees 1,000). Changing agent tool output pulls in the cross-provider UAT scoreboard. |
| `GET /library/index-summary` | asyncpg GROUP BY folder | bounded by construction: GROUP BY folder |
| `GET /library/summary` (new) | — | bounded by construction: GROUPING SETS over folders/status/step/connection/type |
| `GET /document-relationships?document_id=` | one document's edges | bounded by construction: one document's relationships |
| `GET /document-governance/broken-relationships` | `offset/limit` Query, but reads **every** edge unranged (`document_governance.py:157-159`) | paged params present; record the edge read as "bounded by relationships, silently cut at 1,000 edges" (allow-list + seed, or fix with `count="exact"` + walk) |
| `GET /document-governance/unclassified` | `count=exact` + `.range()` | paged |
| `GET /document-governance/low-confidence` | `.limit(LOW_CONF_SCAN_CAP)` | bounded by construction: explicit scan cap |

## Architecture Patterns

### System Architecture Diagram

```
Browser (LibraryPage)
  │ useLibraryDocuments({folder, filter|view, page, includeArchived})
  │   ├─ GET  /documents?folder_id&include_archived&limit&offset ───────┐
  │   ├─ GET  /library/summary ─────────────────────────────┐          │
  │   ├─ GET  /documents/{id}         (selected doc, D-11)   │          │
  │   ├─ GET|POST /document-views/…/resolve (limit/offset)   │          │
  │   └─ Realtime "documents" event ──debounce 500ms──► refetch page + summary
  │ useDocumentFind → POST /document-search (Find tab + every picker, limit 20)
  ▼                                                          │          │
FastAPI (user-JWT client / get_user_pg_connection)           │          │
  │                                                          ▼          ▼
  │                                     asyncpg  SET LOCAL ROLE      supabase-py builder
  │                                     authenticated + claims       .table("library_documents")
  │                                     ONE GROUPING SETS scan       .eq/.is_/.ilike/… (fragments)
  │                                                          │       .order(col).order(id).range()
  ▼                                                          ▼       count="exact"
Postgres ── public.library_documents (security_invoker view) ◄──── PostgREST 14.10
              WHERE user_id = (select auth.uid())
                 OR folder_id IN (folders not mine AND folder_is_org_shared)
              └─ RLS on documents/folders still applies (invoker) ── org gate
              └─ service role: auth.uid() IS NULL → 0 rows (fail-closed)
Agent tool (service role) ── resolve_filter(via_view=False) ── two legs, limit ≤50, exact counts
```

### Recommended file layout

```
supabase/migrations/207_library_documents_view.sql   # view + grants + indexes (if EXPLAIN demands) + NOTIFY pgrst
scripts/full-schema-supplement.sql                   # mirror the view GRANT/REVOKE (dump is --no-privileges)
scripts/seed-scale-284.py                            # idempotent seed / --teardown, takes the local-DB lock
scripts/measure-library-284.py                       # D-21/D-22 table (status, bytes, time, rows, totals vs count(*))
backend/app/api/documents.py                         # list (envelope), GET /{id}, per-doc paging, visibility gate on the view
backend/app/api/library.py                           # GET /library/summary (asyncpg, beside index-summary)
backend/app/models/document.py                       # DocumentListResponse + per-doc page envelopes
backend/app/services/document_view_resolver.py       # resolve_filter: view path (paged) + agent two-leg path (exact counts)
backend/app/api/document_views.py                    # limit/offset params
backend/app/services/document_search_service.py      # Find in SQL over the view
frontend/src/hooks/useLibraryDocuments.ts            # the D-24 seam
frontend/src/lib/api/documents.ts, types/index.ts    # wire contract (one plan owns both)
frontend/src/test-utils/fakeLibraryApi.ts            # derives page + summary from a fixture array (test migration lever)
```

### Pattern 1: The visible-set view (migration 207)

**What:** one SQL home of D-04, invoker semantics, read-only grants.
**When:** every user-JWT list / count / single / Find / resolve read.

```sql
-- Source: PostgreSQL 15+ CREATE VIEW ... WITH (security_invoker) [ASSUMED syntax from training; verify on PG17 when applying]
-- Shape derived from documents.py:750-779 + folder_utils.py:281-293 (the leg this replaces).
CREATE OR REPLACE VIEW public.library_documents WITH (security_invoker = true) AS
SELECT
  d.id, d.user_id, d.org_id, d.folder_id, d.filename, d.file_path, d.file_size, d.mime_type,
  d.status, d.error_message, d.chunk_count, d.content_hash, d.metadata, d.version_number,
  d.is_latest, d.created_at, d.updated_at, d.ingestion_step, d.extractor, d.document_type_norm,
  d.date_typed, d.source_connection_id, d.ingest_visibility, d.source_state, d.thread_key,
  d.page_count, d.source_created_at, d.source_modified_at, d.source_author,
  d.archived_at, d.archived_policy_id, d.archived_policy_name, d.retrievable,
  -- full_markdown deliberately omitted (up to ~267 KB/row; no list consumer reads it)
  lower(d.filename) COLLATE "C" AS filename_key,           -- name_asc ≈ Python casefold codepoint order
  (SELECT count(*)::int FROM public.documents e
     WHERE e.user_id = d.user_id AND e.filename = d.filename
       AND (e.user_id = (SELECT auth.uid()) OR e.folder_id IN (
             SELECT f.id FROM public.folders f
             WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)))) AS version_count,
  EXISTS (SELECT 1 FROM public.documents e
     WHERE e.user_id = d.user_id AND e.filename = d.filename AND e.version_number < d.version_number
       AND (e.user_id = (SELECT auth.uid()) OR e.folder_id IN (
             SELECT f.id FROM public.folders f
             WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)))) AS has_earlier
FROM public.documents d
WHERE d.user_id = (SELECT auth.uid())
   OR (d.folder_id IS NOT NULL AND d.folder_id IN (
         SELECT f.id FROM public.folders f
         WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)));

REVOKE ALL ON public.library_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.library_documents TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';   -- precedent: 206_retention_hold_hardening.sql:342
```

Notes:
- `(SELECT auth.uid())` makes it an InitPlan (once per query), not a per-row call.
- The `folders f` subquery runs under folders RLS (`org_id IN current_user_org_ids() AND (own OR folder_is_org_shared(id))`), and `documents` RLS still applies to `d` and `e` — the view can only narrow.
- Supabase's default privileges grant new relations to `anon`/`authenticated`; revoke first. A simple view is **auto-updatable** — granting only `SELECT` keeps it read-only.
- No `security_barrier` needed: the view predicate is the Library *definition*, not the security wall (RLS is); a leaky user filter can only see RLS-visible rows.
- Equivalence caveat to test, not assume: Python's `is_in_global_subtree` checks the **shared ancestor's** `org_id ∈ caller orgs`; the view checks the folder's own org via folders RLS and "any ancestor shared" via `folder_is_org_shared`. They differ only for a cross-org folder tree [ASSUMED never occurs] — a parity test closes it (Validation, P-1).
- **Column drift:** a column added to `documents` later will not appear in the view. Add a fence: view columns == `documents` columns − `{full_markdown}` + `{filename_key, version_count, has_earlier}`.

### Pattern 2: The paged list handler

```python
# Source: postgrest-py 2.29 base_request_builder.py:569-636 (order / range); shape of documents.py:744-815
LIST_SELECT = ("id,user_id,folder_id,filename,file_path,file_size,mime_type,status,error_message,"
               "chunk_count,content_hash,version_number,is_latest,metadata,created_at,updated_at,"
               "extractor,source_connection_id,ingestion_step,page_count,source_created_at,"
               "source_modified_at,source_author,archived_at,archived_policy_id,archived_policy_name,"
               "retrievable,document_tables(count),document_images(count)")

@router.get("", response_model=DocumentListResponse)
async def list_documents(
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    folder_id: str | None = Query(None, description="A folder id, or 'root' for unfiled"),
    include_archived: bool = False,
    status: Literal["in_flight", "completed", "failed"] | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    q = supabase.table("library_documents").select(LIST_SELECT, count="exact").eq("is_latest", True)
    if folder_id == "root":
        q = q.is_("folder_id", "null")
    elif folder_id is not None:
        q = q.eq("folder_id", str(UUID(folder_id)))        # 422 on a non-uuid (raise HTTPException)
    if not include_archived:
        q = q.is_("archived_at", "null")
    if status == "in_flight":
        q = q.in_("status", ["pending", "processing"])     # constant list, not ids
    elif status:
        q = q.eq("status", status)
    q = q.order("created_at", desc=True).order("id", desc=True).range(offset, offset + limit - 1)
    res = await aexec(q)
    rows = res.data or []
    for r in rows:   # flatten embedded counts: [{"count": n}] → n
        r["table_count"] = (r.pop("document_tables", None) or [{"count": 0}])[0]["count"]
        r["image_count"] = (r.pop("document_images", None) or [{"count": 0}])[0]["count"]
    # connection names: ONE read, ids ≤ limit (D-05), decoration never 500s (Phase 270 P-02)
    ...
    return {"documents": rows, "total": res.count if isinstance(res.count, int) else len(rows),
            "offset": offset, "limit": limit}
```

`document_tables` / `document_images` RLS is owner-only (`documents.py:1153-1165`), so embedded counts read 0 for a shared-folder document — identical to today's asymmetry.

### Pattern 3: The summary — one `GROUPING SETS` scan (asyncpg as `authenticated`)

```sql
-- Run through get_user_pg_connection (dependencies.py:159-177); precedent api/library.py:61-137.
SELECT GROUPING(folder_id) AS g_f, GROUPING(status) AS g_s, GROUPING(ingestion_step) AS g_i,
       GROUPING(source_connection_id) AS g_c, GROUPING(doc_type) AS g_t,
       folder_id, status, ingestion_step, source_connection_id, doc_type,
       count(*)                                              AS n,
       coalesce(sum(file_size), 0)::bigint                   AS size_bytes,
       count(*) FILTER (WHERE archived_at IS NOT NULL)       AS archived,
       coalesce(sum(chunk_count), 0)::bigint                 AS chunks,
       count(*) FILTER (WHERE status IN ('pending','processing')
             AND (error_message ILIKE '%rate limit%' OR error_message ILIKE '%429%'
                  OR error_message ILIKE '%quota%'))         AS rate_limited
FROM (SELECT folder_id, status, ingestion_step, source_connection_id, file_size, chunk_count,
             archived_at, error_message, metadata->>'document_type' AS doc_type
      FROM public.library_documents WHERE is_latest) v
GROUP BY GROUPING SETS ((), (folder_id), (status), (status, ingestion_step),
                        (source_connection_id), (doc_type));
-- then ONE name read for the distinct connection ids (bounded by connections, asyncpg ANY($1)):
--   SELECT id, name FROM public.connector_connections WHERE id = ANY($1::uuid[])
-- ⚠ select ONLY id, name: authenticated has no SELECT grant on secret_ciphertext /
--   oauth_client_secret_ciphertext (column_privileges, measured) — `c.*` raises permission denied.
```

Shape the JSON as `{total, archived, chunks, root:{count,size_bytes,archived}, folders:{<id>:{count,size_bytes,archived}}, status:{pending,processing,paused:0,completed,failed}, steps:{<step>:n}, rate_limited_in_flight, connections:[{id,name,count}], document_types:[{value,count}], document_types_truncated}`. The `folder_id IS NULL` row of the `(folder_id)` set is Root (disambiguate from the grand-total row with `GROUPING()`).

### Pattern 4: Find in SQL

- Replace `_candidates` + `_fetch_all` + `_sort_rows` + the Python slice + `_lineage_rows`/`_lineage_facts` + `_hydrate`'s `in.(page ids)` re-read with **one** builder over the view:
  `q = supabase.table("library_documents").select(FIND_SELECT, count="exact")` → `structure(q)` (the shipped appliers, unchanged — `apply_fragments`, `_apply_name`, `_apply_folder`, `_apply_added_by`, `_apply_dates`, `_apply_version`, `_apply_archived`, `_apply_ids`) → `if version=="older": q=q.eq("user_id", caller)` (P-03 own only) → `if version=="has_earlier": q=q.eq("has_earlier", True)` → order → `.range(offset, offset+limit-1)`.
- Order: `.order(col, desc=desc, nullsfirst=False).order("id")` reproduces `_sort_rows` (nulls last both directions, ties on `id` asc). `name_asc` orders by `filename_key`. ⚠ DB collation is `en_US.UTF-8` (measured); without `COLLATE "C"` punctuation/space ordering would differ from Python's codepoint sort.
- `older_matches` = same pipeline with `version="older"`, `id_allow=rel_older`, `select("id", count="exact").limit(1)` → `.count` (counted, never hydrated — same contract).
- `version_count` / `has_earlier` per row come from the view columns (page-only evaluation; PG postpones expensive target-list expressions past ORDER BY/LIMIT [ASSUMED planner behaviour — confirm with EXPLAIN]).
- Connection names: keep the page-bounded `in.(≤limit conn ids)` read.
- **Relationship allow-lists: confirmed bounded by ONE document's relationships**, not the library: `_relationship_allow_list` reads edges `.eq("rel_type").eq("user_id", caller).in_(match_col, versions)` where `versions` = P's own lineage (`_subject_version_ids`), then endpoints `in.(edge endpoints)`, then lineage heads for stale endpoints (`document_search_service.py:357-402`). Keep them; add a cap with fail-loud (`SearchTruncatedError`, e.g. 500 edges) so a hub document cannot silently cut at 1,000, and teach the runtime guard that an `id` allow-list's bound is "one document's edges", not the page limit.
- Folder subtree `in.(folder ids)` (`_resolve_folder`, `apply_fragments` subtree) is bounded by folders, not documents; the runtime guard must distinguish `folder_id` lists from `id`/`document_id` lists.
- **Deliberately retire** two Phase 271 invariants with the reason in the commit: the docstring rule "Caller-scoped legs, kept as TWO queries … Never collapsed into one `or_`" and `test_271_search_core.py::test_legs_are_two_queries_and_a_row_in_both_appears_once` (`:673-686`). The union is now SQL in the view, not an `or_` string — the property the rule protected (no interpolated visibility) is stronger, not weaker.

### Pattern 5: Saved-view resolve, two strategies, one fragment walk

`resolve_filter` is shared by the route (user-JWT) and the agent tool (service role). Add `via_view: bool` and `offset/limit`:
- Route (`via_view=True`): one view query, `apply_fragments` (unchanged), `.range()`, `count="exact"`; `count_only` → `select("id", count="exact").limit(1)`.
- Agent (`via_view=False`): keep the two legs, but read each leg `.order("created_at", desc=True).limit(limit)` (union top-N is correct from each leg's top-N after dedupe) and compute an **exact** total as `count(own) + count(global) − count(own ∩ global folders)` with three `count="exact"` head reads. Both failure directions are safe: a wrong `True` from the service role reads 0 rows (fail-closed view); a wrong `False` from the route reads the old two legs.
- `tools/documents.py:515-521` then passes `limit` instead of slicing a full list. ⚠ This touches the agent tool's code path; keep its output byte-identical for ≤50 rows so no cross-provider UAT is owed (assert in a unit test).

### Pattern 6: The data hook seam (D-24)

Wave 1: `useLibraryDocuments({folderId, filteredDocs?, includeArchived, offset, limit, selectedDocId, findRows})` computes from `useDocuments()` exactly what the page computes today and returns `{rows, total, archivedHidden, summary: {total, root, folders, chunks, status, steps, connections, document_types, rate_limited_in_flight}, selectedDoc, loading:false, error:null, refresh, upload, deleteDoc, …}` — a summary-SHAPED object derived client-side, so children can switch to numbers now and the wave-2 swap changes only the hook body. Wave 2: the same return shape from `GET /documents` + `/library/summary` + `GET /documents/{id}`.

### Anti-Patterns to Avoid
- **Counting a page in the browser** (folder totals read 25/50) — the ROADMAP's first failure mode.
- **Raising `max_rows`** or batching with more round trips — explicitly a failed phase.
- **`select("document_id").in_("document_id", page_ids)` to count tables** — even page-bounded, the *returned rows* can exceed `max_rows` (200 docs × many tables) and undercount silently; use embedded `(count)`.
- **`select("*")` on documents for a list** — drags `full_markdown`.
- **A `GET /documents/summary` declared after `GET /documents/{document_id}`** — shadowed.
- **An RPC set-returning function with `SET search_path` for paging** — not inlinable; materialises the set.
- **Service-role reads of the view** — return 0 rows; a test that "passes" through the service role proves nothing (D-18).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Union of two visibility legs with paging | Python merge/dedupe/sort + slice | The view + `.range()` | Exact total, stable order, no id lists |
| Exact totals | `len(rows)` | `count="exact"` / `count(*)` | `max_rows` cuts silently (the `reembed_service.py:294-298` lesson) |
| Per-row child counts | id-list `in.()` + Python `Counter` | Embedded `document_tables(count)` | Page-bounded, no URL growth, no returned-row cap |
| Aggregates | per-folder resolve calls | One `GROUPING SETS` scan | One request bounded by folders |
| Typeahead search | a new search endpoint | `POST /document-search` + `useDocumentFind` (300 ms debounce, stale-request drop) | D-15; already RLS-tested (`test_271_two_org_fence.py`) |
| RLS-as-user SQL | hand-built `SET ROLE` | `get_user_pg_connection` (role first, both GUC forms, `is_local`) | `dependencies.py:128-157` documents three traps |
| Test users with real JWTs | minted HS256 tokens | `tests/integration/_271_gotrue_users.GoTrueUsers` | Real GoTrue tokens; single-membership cleanup; personal-org cleanup |
| Source scanning fence | grep in a shell script | `import.meta.glob("…/**/*.{ts,tsx}", {query:"?raw", import:"default", eager:true})` | Precedent `attentionTab.test.ts:238-242` |

## Common Pitfalls

### Pitfall 1: The view is fail-closed for the service role
**What goes wrong:** the agent's `query_documents_by_view` (service role) suddenly returns nothing.
**Why:** `auth.uid()` is NULL outside a user JWT.
**How to avoid:** `resolve_filter(via_view=False)` for the agent; a unit test that the agent path never names `library_documents`; a live test that a service-role read of the view returns 0 rows (proves fail-closed, never "works by accident").

### Pitfall 2: `count(*)` is O(n) and can break the 1.5× criterion
**What goes wrong:** first-page *time* grows with the library even though bytes do not, because the exact total scans every visible row (plus per-row RLS: the policy's bare `auth.uid()` and `org_id IN (SELECT …)` are evaluated per row).
**How to avoid:** measure count time separately in EXPLAIN. If it dominates at 50k, a covering partial index lets `count` run index-only, e.g. `CREATE INDEX … ON documents (user_id, created_at DESC, id DESC) INCLUDE (org_id, folder_id, source_connection_id, ingest_visibility, archived_at, status) WHERE is_latest` [ASSUMED effective — visibility map must be set: run `VACUUM (ANALYZE) documents` after seeding]. If it still misses, D-22 says record the cause.
**Warning signs:** EXPLAIN shows `Seq Scan`/`Bitmap Heap Scan` with `rows≈50000` under the count node.

### Pitfall 3: Breaking change deploy window
**What goes wrong:** Vercel and Coolify both build from `production`; for a minute an old frontend gets an envelope (or a new frontend gets an array) and the Library reads empty.
**How to avoid:** the new `listDocumentsPage()` accepts both (`Array.isArray(body) ? legacy : envelope`) for one release; migration 207 must be applied to cloud **before** the backend deploy or `GET /documents` 500s (view missing).

### Pitfall 4: `folder_id=root` vs a uuid, and 422s
Validate `folder_id` as `"root"` or a UUID (explicit `HTTPException(422)`) — PostgREST would answer a malformed uuid with `22P02` → a 500 that is also an existence oracle (the `document_relationships.py:107-118` WR-01 lesson).

### Pitfall 5: The `.folder_id` occurrence pin
`LibraryPage.cloudImport.test.tsx:382` pins `pageSource.match(/\.folder_id\b/g)?.length` **toBe(7)**. The D-24 extraction moves those seven reads into the hook, so this assertion cannot stay unedited — which contradicts D-24's "Existing LibraryPage suites stay unedited". Re-pin it in plan 01 with the reason (the property it guards — no `folder_id:` body key on the page — is unaffected; `:377` stays). Every other `?raw` fence over `LibraryPage.tsx` / `documents.py` survives (they assert `SHED_COLUMNS_3_TO_5`, `canUploadToFolder` ×4, `<IngestionTab … onNavigateToConnections=`, length floors, `ingestion_step` payloads, MIME sets — none of which move).

### Pitfall 6: Nine suites mock `@/hooks/useDocuments`
`LibraryPage.test.tsx`, `.cloudImport`, `.filingRules271`, `.find271`, `.initialTab`, `.tabAttention`, `sketchComposition.test.tsx`, `libraryRetention.test.tsx`, `sourceComposition.test.tsx` (~127 cases). Wave 1 keeps them green by building the hook *on* `useDocuments`. Wave 2 removes that path → each suite must change its mock wiring. Lever: a `fakeLibraryApi(docs)` test util that answers `listDocumentsPage(params)` / `getLibrarySummary()` / `getDocument(id)` from the same fixture array, so each suite swaps one `vi.mock` line and keeps its cases (no per-file count decrease). `sourceComposition.test.tsx` carries a standing red (CLAUDE.md count-gate notes) — compare against base, never "fix" it here.

### Pitfall 7: Retired cases decrease pinned per-file counts
`DocumentsPager.exact271.test.tsx` (pin 3; case 2 asserts the cap arm) and `LibraryPage.test.tsx:557` (the "list may be larger" case) retire with D-09. Replace each in place with the new behaviour (browse at total 1,500 renders the exact total, no "+", no cap line) so the per-file count stays, or re-pin in the same commit with the reason. Same for `useDocuments.test.ts` (pin 7): the INSERT-prepend and DELETE-filter cases become "INSERT/DELETE trigger a debounced refetch"; the UPDATE spread-merge case stays.

### Pitfall 8: `test_261014_list_documents_batches_in.py` pins the stopgap
It asserts batching at 100 ids with a mocked client. Delete it with the stopgap, replaced by the request-recording guard (stronger: forbids any id list above the page limit and requires a range). Other backend suites that mock `list_documents`/`list_document_versions`/per-doc routes with MagicMock chains: `tests/unit/test_document_versioning.py` (in the gated unit set), plus `tests/integration/test_documents.py`, `tests/test_217_document_detail_routes.py`, `tests/test_217_document_response_fields.py` (outside `tests/unit`, but CI runs all tests — memory note on 278).

### Pitfall 9: Realtime flood during seeding
50k INSERTs go through the `supabase_realtime` publication. Close every Library tab; seed in batches; expect Realtime lag for a few minutes.

### Pitfall 10: Picker double filtering and the `*` wildcard
`LinkTargetCombobox` filters `candidates` by `filename.toLowerCase().includes(q)` (`LinkTargetCombobox.tsx:65-68`) while Find's name match is `ilike %q%` where a typed `*` is a PostgREST wildcard (RESEARCH A4). For a query containing `*`, the client filter drops server matches. Add an optional `onQueryChange` prop and let server-mode skip the client filter.

### Pitfall 11: The seed's sizes are self-contradictory as written
D-20 says "seeds 10,000 … ~60% root, one folder holding exactly 10,000". At the 10k step one folder cannot hold 10,000 and leave 60% in Root. See Open Question 2.

## Code Examples

### Request recorder for the runtime guard (D-23 layer 2)
```python
# Source: dependencies.py:196-216 (user client takes ClientOptions(httpx_client=...));
#         postgrest-py range() → offset/limit query params (base_request_builder.py:628-636)
import re, httpx
from urllib.parse import urlsplit, parse_qsl

RECORDED: list[httpx.Request] = []
client = httpx.Client(event_hooks={"request": [RECORDED.append]})
# build the user client exactly like get_user_supabase, with this httpx_client, or
# monkeypatch app.dependencies._shared_httpx = client before calling the route coroutine

DOC_TABLES = {"documents", "library_documents", "document_chunks", "document_tables", "document_images"}
ID_COLS = {"id", "document_id"}

def violations(page_limit: int) -> list[str]:
    out = []
    for r in RECORDED:
        path = urlsplit(str(r.url)).path
        if "/rest/v1/" not in path or r.method != "GET":
            continue
        table = path.rsplit("/", 1)[-1]
        params = parse_qsl(urlsplit(str(r.url)).query, keep_blank_values=True)
        keys = {k for k, _ in params}
        single = any(k == "id" and v.startswith("eq.") for k, v in params)
        if table in DOC_TABLES and not single and "limit" not in keys:
            out.append(f"unbounded select on {table}: {r.url}")
        for k, v in params:
            if k in ID_COLS and v.startswith("in.("):
                n = v.count(",") + 1
                if n > page_limit:
                    out.append(f"{k} in.() carries {n} ids > {page_limit}: {table}")
    return out
```
RED plant: re-insert the `_ID_BATCH` loop over every document id → `document_id in.() carries 100 ids > 25`; or drop `.range()` → `unbounded select on library_documents`.

### Route-inventory detector (D-23 layer 1)
Copy `tests/unit/test_283_settings_route_inventory.py`'s shape: walk `app.routes` for endpoints whose `__module__` is in the library-domain set; a route is **paged** iff its query params (`route.dependant.query_params`) include `offset` and a `limit` whose field metadata carries an `le` bound, or its body model has a `limit` field with `le`; otherwise it must be on `ALLOW_LIST = {(method, path): "reason"}`. Non-vacuity floors (route count ≥ N, paged count == M); a permanent self-test with a throwaway `APIRouter` that plants `GET /documents/_planted` with no limit and asserts the detector names it.

### Frontend fence (D-16)
`import.meta.glob("../../**/*.{ts,tsx}", {query:"?raw", import:"default", eager:true})`; fail on `listDocuments\(\s*\)`, on `fetch\(\`\$\{API_BASE\}/documents\`` (no `?`), and on any `listDocuments` import outside `lib/api/documents.ts` that is not `listDocumentsPage`. RED plant: a test-only string `listDocuments()` in a planted file under a temp glob root, or a mutation of `CreateLinkDialog.tsx` text in memory.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `folder_is_globally_visible(uuid)` | `folder_is_org_shared(uuid)` (same OID) | migration 111 | CONTEXT's name is stale; use the new one |
| PostgREST embedding via view-defined FKs | Embedding through views reads the base tables' FKs (computed relationships replace old view tricks) | PostgREST v10+ | `library_documents?select=*,document_tables(count)` should work [CITED: docs.postgrest.org/en/v14/references/api/resource_embedding.html] — verify live after 207 |
| `len(select…)` totals | `count="exact"` | Phase 111.1 (`reembed_service`) | Pattern this phase generalises |

**Deprecated/outdated:** the `ROW_CAP = 1000` honest arm (D-09); `_ID_BATCH` (D-01/BUG-261014-06); `get_globally_visible_folder_ids` in list/Find/resolve/visibility-gate paths (stays for kb, relationships, agent).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CREATE VIEW … WITH (security_invoker = true)` syntax and semantics on PG17 (training knowledge; no view exists in this schema to copy) | Pattern 1 | Migration fails or RLS not applied as invoker → leak test catches it |
| A2 | PostgREST infers `document_tables(count)` embedding through the view | Pattern 2 | Embedding 400s → fall back to one page-bounded `documents?select=id,document_tables(count)&id=in.(≤limit)` read |
| A3 | Postgres postpones the `version_count`/`has_earlier` subqueries past ORDER BY/LIMIT and prunes them from the count query | Pattern 4 | Page cost grows with rows scanned → move them to a page-only second read |
| A4 | The view's org semantics equal Python's `is_in_global_subtree` for real data (no cross-org folder trees) | Pattern 1 | A narrowing/widening for some account → parity test P-1 catches it |
| A5 | A covering index makes the exact count index-only and keeps D-22's 1.5× | Pitfall 2 | Record the miss with its cause (D-22) |
| A6 | Pickers should pass `include_archived: true` to keep today's candidate set | Consumer inventory | Archived docs silently vanish from link / hold pickers |
| A7 | `lower(filename) COLLATE "C"` is close enough to Python `casefold()` codepoint order for `name_asc` | Pattern 4 | `test_each_sort_is_the_server_order[name_asc]` expectations differ for exotic characters |

## Open Questions

1. **Where does the "public changelog says it is breaking" line go (D-01)?**
   - Known: the changelog is generated from `docs/history/v*.md`; `overrides.json` can only annotate an existing version; no `v4.6` history file exists; the README arc ends at v4.5, so a v4.6 file throws "no chapter".
   - Recommendation: in this phase put the breaking notice in (a) the first paragraph of `list_documents`' docstring (the public builder keeps "summary + the first paragraph", `build-public-openapi.cjs` header) and (b) `docs/public/api/concepts/pagination.md`; record the changelog entry as **owed at v4.6 close** (creating the v4.6 history file and extending the README arc is milestone-close/operator content). Planner confirms with the operator or records the deviation.
2. **Seed shape (D-20).** Recommend S10 = 6,000 Root · 3,000 in "Big" · 1,000 spread across ~10 folders; S50 adds 40,000 → 30,000 Root · **exactly 10,000 in "Big"** · 10,000 spread across ~20 folders. Each step also: ~300 archived, ~300 in-flight (`status='processing'` with `ingestion_step` set, no `ingestion_jobs` rows — the stale sweeper only touches `ingestion_jobs`, `ingestion_queue_service.py:129-135`), ~200 older versions (`is_latest=false`), `chunk_count` 1-60, ~500 `document_tables` / ~500 `document_images` rows, one document with ~2,500 `document_chunks` rows (no embedding) to prove `/chunks` paging and the Chunks header exceeding 1,000. G-4 scenario B at 10k uses the 3,000 folder.
3. **IngestionTab History order.** Today `updated_at desc` (`IngestionTab.tsx:165-167`); D-02 fixes `created_at desc`. Recommend an `order` param `created_desc|updated_desc` (ordering only, not a filter) so History is unchanged; otherwise record the visible change.
4. **Takeoff exception.** `GET /documents?kind=spreadsheet` is an internal bounded read, not a user-facing filter — confirm the planner accepts it as D-15's "narrowest bounded read".
5. **Production `max_rows`.** Read via Supabase MCP (`pg_roles` authenticator `rolconfig`) and the dashboard; not available to this session.
6. **kb / governance edges.** Allow-list with a seed (recommended) vs fixing now; both are outside the Library/Find/picker surfaces.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres :54322 | seed, EXPLAIN, live tests | ✓ (asyncpg connect OK) | 17.6 | — |
| Local PostgREST :54321 | user-JWT reads | ✓ (HTTP 200) | 14.10 | — |
| Local GoTrue | synthetic users / real JWTs | ✓ (same gateway; `_271_gotrue_users` pattern) | — | — |
| Backend :8000 | live measurement | ✓ (`/health` 200, operator-started) | — | operator restarts after code changes |
| Node | frontend tests, docs scripts | ✓ | 24.19.0 | — |
| Python venv | backend | ✓ | 3.12.6 | — |
| `docker` CLI | `regenerate-full-schema.sh` (`docker exec … pg_dump`) | ✗ for a bare `docker` command (settings deny) | — | **run `bash scripts/regenerate-full-schema.sh`** — the wrapper runs fine (memory: docker-denied note) |
| Supabase SQL editor | applying 207 | operator / established local method | — | asyncpg apply locally as `postgres` if the plan says so (record it) |
| Supabase MCP | production `max_rows`, advisors | ✗ in this research session | — | orchestrator reads it |
| Local-DB lock | seed / migration / backend baseline | free at research time (`agentic-rag-localdb.lock` absent) | — | wait if held; stale after 45 min |

**Missing with no fallback:** none blocking.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`; included because the orchestrator asked for it.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (+ `asyncio_mode = auto`, `backend/pytest.ini`) |
| Frontend | vitest (`frontend/vitest.config.ts`, setup `src/setupTests.ts`) |
| Quick run (backend) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_284_*.py -x -q` |
| Live (backend, skip-guarded :54321/:54322) | `cd backend && venv/Scripts/python -m pytest tests/integration/test_284_*.py -q` (holds the DB lock) |
| Full backend gate | `cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors` (≤71 failed, failing SET == base) |
| Quick run (frontend) | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <files>` |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) |
| Count gate | repo root: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (per-file deltas, 0 failing) |
| Docs gates | `backend/venv/Scripts/python scripts/export-openapi.py` → `node scripts/build-public-openapi.cjs` (then `--check`); `node scripts/check-docs-coverage.cjs`; `test_276_openapi_snapshot_fresh.py`; `publicOpenapi.test.ts` (pin 11) |
| Ledger / size | `node scripts/check-hot-file-ledger.cjs 284`; `node scripts/check-claude-md-size.cjs` |

### Phase Requirements → Test Map
| SC | Behaviour | Type | Proof |
|----|-----------|------|-------|
| SC#1 | Root and a folder show the correct total + first page at 10k and 50k; bytes/time recorded, not growing | live measurement + live test | `scripts/measure-library-284.py` → `284-MEASUREMENTS.md` (before/after); `test_284_list_live.py::test_total_equals_count_star_root_and_folder` (as `authenticated`, seeded account) |
| SC#2 | Every one of >1,000 docs reachable by paging; total == `count(*)` | live test | walk all pages of the 10k folder via `GET /documents`, assert the id set == `SELECT id FROM documents WHERE …` (asyncpg as postgres), no duplicates, last row = oldest |
| SC#3 | Folder counts, CHUNKS, per-row table/image counts == DB; no growing id list; stopgap gone | live + unit | `test_284_summary_live.py` (each summary number vs its own `count(*)`/`sum()`); `test_284_request_recorder.py` (layer 2); source fence: `_ID_BATCH` absent from `documents.py` |
| SC#4 | Find pages in SQL | unit + live | `test_284_find_sql.py`: one view read with `range` + `count=exact`; no `_fetch_all`/`_sort_rows`/Python slice; `has_earlier` as a filter; live: Find page time at 50k recorded |
| SC#5 | Pickers search on the server | frontend unit + fence | CreateLinkDialog / LegalHoldDialog / TakeoffSection / RelationshipEditor tests assert the request body (`name`, `limit:20`) and no `listDocuments()`; D-16 glob fence |
| SC#6 | Guard RED-driven | unit (RED plants) | layer 1 self-test (planted unbounded route named); layer 2 RED (re-inserted batching loop / dropped `.range()` named); D-16 RED (planted no-arg call named) — each recorded RED then GREEN in SUMMARY |
| SC#7 | G-4 A-E | manual (Chrome MCP) | read rendered numbers/rows + network log; prove active org first (dev account is in two orgs) |
| D-18 | Leak + fail-closed | live | `test_284_two_user_leak.py`: user B (same org, owns nothing) pages/counts/summary/Find → 0 of A's docs; positive control A sees N; service-role read of `library_documents` → 0 rows |
| P-1 | D-04 parity | live | for the dev account and both synthetic users: set(view latest ids) == set(old `list_documents` ids computed by the pre-change two-leg code, kept as a test helper) — run BEFORE deleting the old code |
| P-2 | View column drift | live/unit | view columns == documents columns − `{full_markdown}` + the three derived columns |

### Sampling Rate
- Per task: the targeted files above.
- Per wave: full backend gate + count gate + typecheck set diff.
- Phase gate: all of the above + docs gates + `check-hot-file-ledger.cjs 284`.

### Wave 0 Gaps
- [ ] `scripts/seed-scale-284.py` (+ `--teardown`, lock) and `scripts/measure-library-284.py`
- [ ] `backend/tests/integration/test_284_*.py` (live, skip-guarded) reusing `_271_gotrue_users.GoTrueUsers`
- [ ] `backend/tests/unit/test_284_route_inventory.py`, `test_284_request_recorder.py`, `test_284_find_sql.py` (FakePostgrest in `test_271_search_core.py` must learn `order`/`range`/`count` server semantics, or the Find tests move to the live suite)
- [ ] `frontend/src/test-utils/fakeLibraryApi.ts`
- [ ] Ledger rows for the 10 `[no-row]` files before any PLAN.md names them

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged `get_current_user`) | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS beneath a `security_invoker` view; user-JWT client / `get_user_pg_connection`; `GET /documents/{id}` 404-not-403; service role fail-closed on the view; two-user leak test |
| V5 Input Validation | **yes** | FastAPI `Query(ge=, le=)` for `limit`/`offset`; `folder_id` = `"root"` or UUID (explicit 422); `status` `Literal`; Find body `extra="forbid"`; values bound as builder params, never interpolated |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | `full_markdown` excluded from list payloads; connection reads name only `id, name` (column grants) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| New view inherits Supabase default `anon` grants | Information disclosure | `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT SELECT … TO authenticated, service_role`; mirror in `full-schema-supplement.sql`; `get_advisors(security)` at deploy |
| Writes through an auto-updatable view | Tampering | SELECT-only grant |
| `SECURITY DEFINER` aggregate bypassing RLS | Elevation | No new DEFINER object; summary runs as `authenticated` |
| Visibility widened to "all RLS-visible" (connection leg, others' docs in my shared folder) | Information disclosure | View predicate keeps both exclusions; parity test P-1 |
| IDOR on `GET /documents/{id}` / malformed id 500 oracle | Information disclosure | View read + `maybe_row` → uniform 404; uuid validation |
| Count oracle via summary | Information disclosure | Summary aggregates only the view (caller-visible) |
| DoS by huge pages | DoS | `limit ≤ 200` (list), `≤ 100` (Find), per-doc caps; `command_timeout=30`; `authenticated` `statement_timeout=8s` on PostgREST |
| URL-borne id lists (414) | DoS | No document-id list beyond the page; runtime guard |

## Hot-file ledger (G-5) — re-derived 2026-10-16

| File | commits / phases / lines | Note |
|---|---|---|
| `frontend/src/pages/LibraryPage.tsx` | **59 / 19 / 1302** (`--follow`; without it the recipe reads 33/10 — renamed from `IngestionPage.tsx` at `dbd9b8c0b`) | FIRES; extraction OWED (taken by 01). Invariants: `SHED_COLUMNS_3_TO_5` selector string (`DocumentRow.download270.test.tsx:165`), `const canUploadToFolder =` once / identifier ×4, `.folder_id` ×7 pin (Pitfall 5), no `useSourceAttention()` call, `<IngestionTab onNavigateToConnections={…onNavigate…}>`, no `max-w-*` on the page |
| `backend/app/api/documents.py` | 96 / 37 / 2531 | FIRES; honoured by construction so far; `ast.If` count fences on `upload_document`/`delete_document` (275 D-32) — do not add branches there |
| `backend/app/services/document_search_service.py` | 6 / 3 / 587 | FIRES; ⚠ its "two legs, never one `or_`" invariant is deliberately retired (Pattern 4) |
| `frontend/src/components/ingestion/DocumentList.tsx` | 32 / 15 / 379 | FIRES; 7-column order chevron·Filename·Type·Size·Chunks·Status·Actions is load-bearing (LibraryPage `nth-child`) — do not touch columns |
| `frontend/src/lib/api/documents.ts` | 8 / 8 / 503 | FIRES; one plan owns all wire additions |
| `frontend/src/types/index.ts` | 99 / 78 / 1546 | FIRES; additive types only |
| `frontend/src/hooks/useDocuments.ts` | 9 / 4 / 147 | FIRES; UPDATE spread-merge must keep `tables_stage_applies`/`images_stage_applies` |
| `frontend/src/components/library/DocumentsPager.tsx` | 3 / 2 / 112 | ROW_CAP arm deleted (D-09) |
| `frontend/src/components/library/IngestionTab.tsx` | 19 / 6 / 546 | FIRES; layout unchanged (D-13); 42+5+6 pinned cases |
| `backend/app/services/document_view_resolver.py` | 5 / 5 / 412 | FIRES; `apply_fragments` stays the one fragment walk (D-115-6) |
| `backend/app/models/document.py` · `document_search.py` | 13/10/221 · 3/3/174 | FIRING rows exist |
| `backend/app/api/document_views.py` · `api/library.py` · `utils/folder_utils.py` · `FolderDetail.tsx` · `LibraryStatTiles.tsx` · `ViewsTab.tsx` · `DocumentTablesSection.tsx` · `DocumentImagesSection.tsx` · `TakeoffSection.tsx` · new `useLibraryDocuments.ts` | 11/5/300 · 1/1/137 · — · 3/2/59 · 5/1/123 · 4/2/84 · — · — · 2/1/412 · new | **`[no-row]` — add rows + sections in the same commit before a PLAN names them** |

## Recommended Plan Cut (G-8: 5 plans)

| Plan | Wave | Owns (files) | DB lock |
|---|---|---|---|
| **284-01** Library data-hook extraction (behaviour-preserving) | 1 | `LibraryPage.tsx`, new `useLibraryDocuments.ts` (over `useDocuments`, returns the summary-shaped object), `LibraryStatTiles.tsx` + `FolderDetail.tsx` → number props, `FindQuickAdd`/`StructurePopovers` DocumentType/AddedBy editors → `documentTypes`/`connections` arrays (RelationshipEditor keeps `documents` for now), their child tests; re-pin the `.folder_id` ×7 assertion; ledger rows for the new/no-row files it names | no |
| **284-02** Seed + baseline + server contract | 1 (∥ 01) | `scripts/seed-scale-284.py`, `scripts/measure-library-284.py`, `284-MEASUREMENTS.md` (BEFORE), migration 207 + supplement + regenerate, `documents.py` (envelope list, `GET /{id}`, per-doc paging, visibility gate on view, stopgap deleted, `aexec` everywhere), `library.py` (`/library/summary`), `document_views.py` + `document_view_resolver.py` (+ `tools/documents.py` call site), models, OpenAPI snapshot + public spec + pagination.md + docstring notice, **frontend `lib/api/documents.ts` + `types/index.ts` + `useDocumentPicker`/typeahead hook** (so wave-2 plans never both edit these hot files), backend tests incl. leak + parity + request recorder fixture | **yes** (seed, apply 207, live tests) |
| **284-03** Library on the server | 2 | `useLibraryDocuments.ts` body → server, `useDocuments.ts` (D-08), `LibraryPage.tsx` loading/error/empty (D-12), `DocumentsPager.tsx` (ROW_CAP out), `IngestionTab.tsx` (summary + paged lists), `DocumentChunksSection`/`Tables`/`Images` (sentinel / N of M), `fakeLibraryApi.ts`, the nine suites' mock migration, D-16 frontend fence | no (frontend only) |
| **284-04** Find in SQL + pickers | 2 (∥ 03) | `document_search_service.py` (+ `test_271_*` retirements/rewrites), `models/document_search.py` if needed, `CreateLinkDialog.tsx`, `LegalHoldDialog.tsx`, `TakeoffSection.tsx`, `LinkTargetCombobox.tsx` (`onQueryChange`), `StructurePopovers.tsx` RelationshipEditor | **yes** (Find live tests) |
| **284-05** After + guards + G-4 | 3 | `284-MEASUREMENTS.md` (AFTER), route-inventory + request-recorder RED drives, D-16 RED drive, G-4 A-E (orchestrator checkpoints), ledger sections, BUG-261014-06/-07 + SEED-248 frontmatter, seeds planted for kb/governance edges | yes (seeded measurement) |

Conflict rules: 03 and 04 must not both edit `lib/api/documents.ts`, `types/index.ts` or `LibraryPage.tsx` — 02 lands every wire type and client function; if 04 removes `FindQuickAdd`'s `documents` prop while 03 still passes it, make the prop optional in 04 and remove the pass-through in 03 (or defer removal to 05). Plans 02 and 04 hold the DB lock and run serially (rule 4).

## Sources

### Primary (HIGH confidence)
- Live local stack probes (read-only): PostgREST 14.10 header; `document_chunks` unranged `0-999/*` vs `count=exact` 8949; embedded `document_tables(count)` response; `pg_indexes`, `pg_trigger`, `pg_constraint`, `pg_publication_tables`, `pg_roles.rolconfig`, `information_schema.column_privileges` for `connector_connections`; `select version()`.
- Codebase (file:line cited inline): `documents.py`, `document_search_service.py`, `document_view_resolver.py`, `document_views.py`, `folder_utils.py`, `dependencies.py`, `library.py`, `reembed_service.py`, `retention.py`, `tools/documents.py`, `threads.py`, `kb.py`, `document_governance.py`, `full-schema.sql`, migrations 019/108/110/111/206; frontend `LibraryPage.tsx`, `useDocuments.ts`, `DocumentsPager.tsx`, `LibraryStatTiles.tsx`, `IngestionTab.tsx`, `StructurePopovers.tsx`, `FindQuickAdd.tsx`, `CreateLinkDialog.tsx`, `LegalHoldDialog.tsx`, `TakeoffSection.tsx`, `LinkTargetCombobox.tsx`, `FolderDetail.tsx`; tests `test_283_settings_route_inventory.py`, `test_271_search_core.py`, `test_271_no_embedding.py`, `test_261014_list_documents_batches_in.py`, `_271_gotrue_users.py`, `_rls_harness.py`, `LibraryPage.cloudImport.test.tsx`, `renameFence.test.ts`; `scripts/vitest-count-gate.cjs` pins; `scripts/check-hot-file-ledger.cjs` run.
- postgrest-py 2.29 source (`base_request_builder.py:569-636`).

### Secondary (MEDIUM confidence)
- [PostgREST v14 Resource Embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) — embedding through views uses base-table FKs (via search summary; page fetch rate-limited).
- [PostgREST v10.0.0 release notes](https://docs.postgrest.org/en/v10/releases/v10.0.0.html) — view relationship detection changes.

### Tertiary (LOW confidence — verify)
- PostgreSQL `security_invoker` view syntax, SQL-function inlining rules (SET clause blocks inlining), postponed target-list evaluation past LIMIT — training knowledge (A1, A3).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and behaviours measured live.
- Architecture: HIGH for the visible-set analysis and consumer/route inventories (code read); MEDIUM for the view approach until 207 is applied and EXPLAINed (A1-A3).
- Pitfalls: HIGH — each tied to a measured file/line or test pin.

**Research date:** 2026-10-16
**Valid until:** 2026-10-30 (fast-moving hot files; re-derive ledger triples at plan time)
