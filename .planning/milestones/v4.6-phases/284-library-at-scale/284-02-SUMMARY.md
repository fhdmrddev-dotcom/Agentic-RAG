---
phase: 284-library-at-scale
plan: 02
subsystem: api
tags: [library, paging, migration-207, security-invoker-view, rls, summary, seed, measurement, tdd, postgrest, asyncpg]

requires:
  - phase: 275-280
    provides: documents.py as of 280 (the maybe_row fence, the minter), the retention archive columns
provides:
  - "public.library_documents (migration 207): the one SQL home of the Library visible set. It is security_invoker and SELECT-only"
  - "GET /library/summary: one GROUPING SETS scan over the view (total, archived, chunks, root, folders, status, steps, rate_limited_in_flight, connections, document_types)"
  - "GET /documents returns {documents, total, offset, limit}. Params: limit ≤ 200, folder_id root|uuid, include_archived, status in_flight|completed|failed|done, order created_desc|updated_desc, kind=spreadsheet"
  - "GET /documents/{document_id}: a new single read with a uniform 404, and 422 on a malformed id"
  - "Paged envelopes with exact totals for /chunks (200/500), /tables (50/200), /images (100/200) and /versions (50/200)"
  - "The synthetic scale account (scale284@example.com + scale284-b@example.com, org Scale 284), seeded at 50,000 + 20 shared and LEFT SEEDED for 284-03/04/05"
  - "scripts/seed-scale-284.py, scripts/measure-library-284.py, scripts/apply_migration_207.py, and backend/tests/integration/_284_scale_account.py (the legacy visible-set oracle)"
affects: [284-03, 284-04, 284-05, frontend/src/lib/api/documents.ts, docs/public/api]

tech-stack:
  added: []
  patterns:
    - "A security_invoker view as the one home of a visibility union: PostgREST .range() and count=exact push down into it, and the service role reads 0 rows (fail-closed)"
    - "The grouping-sets summary runs through get_user_pg_connection and is folded by its GROUPING() flags"
    - "Route-chain contracts use a recording fake builder that RAISES on any method it does not implement (never a MagicMock)"

key-files:
  created:
    - supabase/migrations/207_library_documents_view.sql
    - scripts/apply_migration_207.py
    - scripts/seed-scale-284.py
    - scripts/measure-library-284.py
    - backend/tests/integration/_284_scale_account.py
    - backend/tests/integration/test_284_view_live.py
    - backend/tests/integration/test_284_summary_live.py
    - backend/tests/integration/test_284_list_live.py
    - backend/tests/unit/test_284_summary_shape.py
    - backend/tests/unit/test_284_list_contract.py
    - .planning/phases/284-library-at-scale/284-MEASUREMENTS.md
  modified:
    - backend/app/api/documents.py
    - backend/app/api/library.py
    - backend/app/models/document.py
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/api/concepts/pagination.md

key-decisions:
  - "Migration 207 carries NO index. Every EXPLAIN at 50k is under 70 ms (D-19: only add one if needed)"
  - "Migration 207 was applied to the LOCAL DB by scripts/apply_migration_207.py (asyncpg, loopback only), not pasted into the SQL editor. This executor ran in a worktree with no browser; Phase 178 / 275 set the precedent"
  - "_assert_document_visible is now one library_documents read. On a per-document route a malformed id gets the uniform 404; the new GET /documents/{id} answers 422 for one"
  - "The status query param binds to `status_` (alias=\"status\") because documents.py imports fastapi's `status` module"
  - "The breaking-change notice is the FIRST paragraph of the GET /documents docstring, because the public builder keeps only the summary and the first paragraph"

patterns-established:
  - "Exact totals go through one helper (_exact_total): use the count when the response carries an int, else the page length"
  - "Base-code provenance for a BEFORE measurement: byte-compare (ignoring CRLF) every tracked backend/ file of the served checkout against PLAN_BASE"

requirements-completed: [FIX-11]  # the SERVER half only. FIX-11 spans 284-01..05; the orchestrator marks it complete at phase close

duration: 54min
completed: 2026-10-16
---

# Phase 284 Plan 02: The Library's server half — seed, BEFORE figures, migration 207, paged list and summary

**The Library's visible set now has one home in SQL: migration 207's `security_invoker` view `public.library_documents`. `GET /documents` is one ranged `count="exact"` read of that view, returning `{documents, total, offset, limit}`. `GET /library/summary` is one grouping-sets scan over it. The `BUG-261014-06` `_ID_BATCH` stopgap is deleted. All of this was proven against a 50,020-document synthetic account that was measured first, while the code was still at base.**

## Performance

- **Duration:** ~54 min
- **Started:** 2026-10-15T23:20Z
- **Completed:** 2026-10-16T00:15Z
- **Tasks:** 3 / 3
- **Files:** 11 created, 8 product/artifact files modified, 6 existing suites migrated, 1 suite retired

## Accomplishments

- **Measured first (D-21).** The BEFORE tables were taken at 10k and at 50k against base code. At base every Library list is cut at 1,000 rows. Find page 1 takes 1.0 s at 10k and 16.9 s at 50k.
- **Migration 207.** The view is `security_invoker`. Its columns are `documents` minus `full_markdown`, plus `filename_key`, `version_count` and `has_earlier`. It is SELECT-only, closed to PUBLIC and anon, and the grants are mirrored in the supplement (ACL parity 349/349). `full-schema.sql` was regenerated without `--reset`.
- **Security proven live (D-18).**
  - Through PostgREST with real GoTrue JWTs, peer B sees exactly the 20 `Shared 284` documents. A's private documents read `[]` from both the view and the base table.
  - The service role reads 0 rows (fail-closed). anon has no SELECT.
  - Parity P-1 holds for owner, peer and the operator's dev account: the view's latest id set equals the PRE-284 rule.
- **`GET /library/summary`.** Every number equals its own `count(*)` / `sum()` taken from `public.documents` (not from the view). `paused` is 0. As B, every number reflects only the 20 shared documents.
- **Server paging (SC#1 and SC#2, server half).**
  - Walking all 50 pages of the 10,000-document `Big` folder at `limit=200` returns exactly the DB id set, with no duplicates, and the last row is the oldest.
  - `/chunks` of the 2,500-chunk document reports `total == 2500` and pages 200 at a time.

## Task Commits

1. **Task 1: scale account and BEFORE figures.** `aeb55f446` (test)
2. **Task 2: migration 207 and GET /library/summary.** RED `1f30122bf` (test), GREEN `d540f6f8d` (feat)
3. **Task 3: server pages.** RED `c69b8b771` (test; also retires `test_261014_list_documents_batches_in.py`), GREEN `bd80f57fe` (fix)

## Base files (not committed)

`C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/`:
- `backend_base_f8659ac2d.txt`: the full base gate, **71 failed, 7579 passed**, 0 collection errors.
- `base_failed_f8659ac2d.txt`: the base failing set, **71 lines**.
- `backend_after_284-02.txt`, plus normalised `*.set` files for the set diff.
- `red_task2.txt`, `red_task3.txt`, `apply207_run1.txt`, `outside_base.txt`.

**PLAN_BASE** = `f8659ac2d56f8cf3b93174e1ee834f383eb192c6`. The worktree started on master's tip (`a248672f0`) and was reset to PLAN_BASE per the branch check.

## The seed as built

| size | Root | Big | small folders | Shared 284 | owner latest | older versions | archived | processing | failed (429) | tables / images | 2,500-chunk doc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10,000 | 6,000 | 3,000 | 10 × 100 | +20 | 10,020 | 200 | 300 | 300 | 25 (5) | 500 / 500 | 1 |
| 50,000 | 30,000 | 10,000 | 20 × 500 | +20 | 50,020 | 200 | 300 | 300 | 25 (5) | 500 / 500 | 1 |

**Triggers on `public.documents`, all kept enabled (none enqueues external work):**
- `documents_autofill_org_id`, a no-op because org_id is supplied
- `documents_hold_identity_guard`
- `documents_inherit_family_archive`
- `documents_protect_archive_state`
- `documents_refuse_held_delete`
- `documents_refuse_truncate`
- `documents_sticky_hold_on_move`

`retrievable` is a generated column, so COPY omits it (found on the first seed attempt). The seed is idempotent: a re-run at the same size printed `no-op: the owner already holds the 10000 shape`.

**The account is LEFT SEEDED at 50,000 + 20 for 284-03 / 284-04 / 284-05.** 284-05 tears it down with `--teardown`, which asserts the dev account's document count is unchanged.

## BEFORE tables (from 284-MEASUREMENTS.md; base code, `:8000`, main checkout HEAD `develop @ f8659ac2d`)

**10,000 (+20 = 10,020)**

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents (whole list) | 200 | 1,065,537 | 435.1 | 462.5 | 1000 | 1000 | 10020 | **NO** |
| Root total as the Library derives it | 200 | 1,065,537 | 321.9 | 439.6 | 1000 | 592 | 6000 | **NO** |
| Big folder total as the Library derives it | 200 | 1,065,537 | 499.2 | 834.3 | 1000 | 294 | 3000 | **NO** |
| Picker read (whole list) | 200 | 1,065,537 | 361.2 | 551.2 | 1000 | 1000 | 10020 | **NO** |
| POST /document-search page 1 | 200 | 27,524 | 1038.2 | 1117.1 | 25 | 9720 | 9720 | yes |
| Library open request set (docs + folders) | 200/200 | 1,068,390 | 349.7 | 459.8 | — | — | — | — |

**50,000 (+20 = 50,020)**

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents (whole list) | 200 | 1,064,078 | 458.2 | 766.0 | 1000 | 1000 | 50020 | **NO** |
| Root total as the Library derives it | 200 | 1,064,078 | 405.5 | 562.2 | 1000 | 579 | 30000 | **NO** |
| Big folder total as the Library derives it | 200 | 1,064,078 | 278.1 | 341.0 | 1000 | 193 | 10000 | **NO** |
| Picker read (whole list) | 200 | 1,064,078 | 429.5 | 645.9 | 1000 | 1000 | 50020 | **NO** |
| POST /document-search page 1 | 200 | 27,491 | 16869.2 | 18243.5 | 25 | 49720 | 49720 | yes |
| Library open request set (docs + folders) | 200/200 | 1,069,311 | 348.6 | 553.6 | — | — | — | — |

## RED lines

- **Task 2:** 20 failed, 0 skipped.
  - The 9 `test_284_summary_shape` cases failed with `AttributeError: module 'app.api.library' has no attribute 'fold_summary_rows' / 'LIBRARY_SUMMARY_SQL' / 'get_library_summary'`.
  - The 9 view cases failed with `relation "public.library_documents" does not exist` (asyncpg) and `PGRST205 Could not find the table 'public.library_documents' in the schema cache` (PostgREST).
  - The 2 summary-live cases failed on the missing route.
- **Task 3:** 36 failed, 1 passed.
  - The 31 contract cases failed because there is no envelope, no `library_documents`, no `GET /documents/{id}`, and no paged per-document routes.
  - The 5 live cases failed too.
  - The one pass is `test_no_connector_rows_no_name_read`. It only asserts an absence, so it holds at base as well.

## EXPLAIN (migration 207): no index needed

These figures are for 50k, as the owner with RLS on:

| query | time |
|---|---|
| Root page 1 | 32.9 ms |
| Root `count(*)` | 27.0 ms |
| Big LAST page (OFFSET 9925, with `version_count` / `has_earlier`) | 65.7 ms |
| Big `count(*)` | 9.3 ms |
| All `count(*)` | 36.7 ms |
| Summary (`MixedAggregate`, 40 groups) | 69.4 ms |

The count is O(n) (a `Bitmap Heap Scan`) but is not the dominant cost. The `version_count` / `has_earlier` subqueries are evaluated for every row an OFFSET skips. `LIST_SELECT` does not select them, so that cost lands only on Find (284-04). Full plans are in `284-MEASUREMENTS.md`.

## `apply_migration_207.py`

```
AFTER FIRST APPLY                       VERIFY: 7/7 PASS
AFTER SECOND APPLY (idempotency check)  VERIFY: 7/7 PASS
documents rows: 50545 -> 50545
```

**Why a script rather than the SQL editor (plan-checker warning 3).** This plan ran as a worktree executor with no browser. The Phase 178 / 275 precedent is a loopback-only apply script that runs the migration file **unmodified**: the file's own `BEGIN; … COMMIT;` and the `NOTIFY pgrst`. The script adds VERIFY and the idempotency proof around it. The file stays pasteable exactly as written, which is the path production must use.

## Regen and supplement

- `supabase/full-schema.sql`: +70 lines, `CREATE VIEW public.library_documents WITH (security_invoker='true')` plus its COMMENT. Nothing else moved.
- `scripts/full-schema-supplement.sql`: +8 lines, the 207 grant block.

⚠ `bash scripts/regenerate-full-schema.sh` failed in a worktree with `Supabase is not running locally`. The CLI derives its project id from the directory name. Running it with `SUPABASE_PROJECT_ID="Agentic RAG"` set worked, still in default no-reset mode.

## Live suites (all ran, 0 skipped)

| suite | result |
|---|---|
| `test_284_view_live.py` | 9 passed |
| `test_284_summary_live.py` | 2 passed |
| `test_284_list_live.py` | 5 passed |
| `test_284_summary_shape.py` | 9 passed |
| `test_284_list_contract.py` | 32 passed |

## Retired test

`backend/tests/unit/test_261014_list_documents_batches_in.py` was retired in `c69b8b771`, with this reason in the commit body: *"it pinned the BUG-261014-06 stopgap (_ID_BATCH = 100). The stopgap is deleted by 284-02; the request-recording guard (284-05, D-23 layer 2) replaces it with a stronger property — no id list above the page limit and a range on every document-table read."*

## OpenAPI and docs gates

- `scripts/export-openapi.py` reported 250 paths, 305 operations, 267 schemas. `build-public-openapi.cjs` wrote 208/250 paths and 255 schemas. `--check OK`, with no `[ungrouped-tag]` or `[missing-v45-op]` findings: `library` and `documents` are already grouped.
- The public `GET /documents` description is now the breaking-change paragraph.
- `check-docs-coverage.cjs`: OK (34 written / 85 stubs).
- `test_276_openapi_snapshot_fresh.py`: 2 passed.
- `publicOpenapi.test.ts`: 15 passed. The file is unchanged, so its case count is unchanged; the plan's "11" was a stale figure. All 17 `src/docs` suites pass (136 cases).
- `pagination.md` now reads `status: written` (`reviewed: 2026-10-16`). It covers the envelope, the bounds table, the paging loop, the v4.6 breaking change and how to migrate, and states that totals are exact.

## Backend gate

| run | failed | passed | collection errors |
|---|---|---|---|
| Base | 71 | 7579 | 0 |
| After | 71 | 7619 | 0 |

The normalised failing-set diff (`comm -3`) is **empty**: the failing SET equals the base set.

The two raw "differences" were pytest printing a `RuntimeWarning` glued onto the end of a `FAILED` line for the same `test_retrieval_service.py` ids. After the warning tail is stripped, the sets are identical.

**Outside `tests/unit`:**
- `tests/test_217_document_detail_routes.py`: 22 passed.
- `tests/test_217_document_response_fields.py`: 9 passed.
- `tests/integration/test_documents.py`: 26 passed, 10 failed. The 10 are the same upload/dedup cases that fail at PLAN_BASE (measured by restoring base `documents.py` / `models/document.py` and re-running). They are inherited, not new.

**`upload_document` / `delete_document`:** an AST source-segment comparison against PLAN_BASE reads **IDENTICAL** for both. The changed functions are exactly the list, the versions, the gate and the three per-document routes. The `@@ … upload_document` hunk header is git's nearest-def label for the deleted `_ID_BATCH` line after that function's `return doc`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated two gated suites the plan did not list**
- **Found during:** Task 3.
- **Issue:** `tests/unit/test_270_document_response_facts.py` (3 cases) and `tests/unit/test_270_download_url.py` (15 cases) patched `app.api.documents.get_globally_visible_folder_ids`. That import is removed once the gate reads the view. The suites also read the list body as an array, and their visibility double answered `documents` with a `user_id` / `in_` filter.
- **Fix:** Each case keeps its intent. The recorders now answer `library_documents`, the `_Q.select` double accepts `count=`, and the list cases read `["documents"]`. The download-url double admits owner and colleague through the view read.
- **Files modified:** the two test files.
- **Commit:** `bd80f57fe`

**2. [Rule 1 - Bug] A vacuous pass in the 217 response-fields suite**
- **Found during:** Task 3.
- **Issue:** Once the body became a dict, `test_no_field_promises_image_bytes` iterated `res.json()`, which loops over the envelope's keys and passes over characters.
- **Fix:** A `_docs(res)` helper asserts the envelope keys and returns the rows, and the case asserts the rows are non-empty.
- **Commit:** `bd80f57fe`

**3. [Rule 1 - Bug] `GET /documents`' first docstring paragraph**
- **Found during:** Task 3.
- **Issue:** The first build dropped the breaking-change notice from the public spec, because it sat in the second paragraph.
- **Fix:** The notice is now the first paragraph.
- **Commit:** `bd80f57fe`

**4. [Rule 3 - Blocking] Two worktree gaps in the tooling**
- **Found during:** Tasks 1 and 2.
- **Issue:** The BEFORE provenance step could not run `git -C <main> diff`, because the sandbox refuses git aimed at another checkout. `regenerate-full-schema.sh` needed `SUPABASE_PROJECT_ID`.
- **Fix:** The provenance became a byte comparison (ignoring CRLF) of all 1,318 tracked `backend/` files plus a read of the main checkout's `.git/HEAD`. This is a stronger property than a diff exit code.

**5. [Rule 2 - Missing critical] Seed guard on the GoTrue URL**
- **Found during:** Task 1.
- **Issue:** Creating users against a non-local `SUPABASE_URL` would be a production write.
- **Fix:** The seed refuses unless `backend/.env`'s `SUPABASE_URL` host is loopback.

### Plan wording that did not match the code (recorded, not changed)

- `test_document_versioning.py` keeps its 10 cases. Its shared builder gained `range.return_value = b`.
- `_assert_document_visible` keeps its signature. `user_id` is now unused: the view is keyed on the JWT.

**Total deviations:** 5 auto-fixed (2 blocking, 2 bugs, 1 missing-critical). **Impact:** no scope creep. Every edit outside the plan's file list is a test that pinned the code this plan was told to replace.

## Known Stubs

None. Every new route returns live data.

## Threat Flags

None beyond the plan's register. The two new routes (`GET /documents/{id}` and `GET /library/summary`) are T-284-10 and T-284-11, and both are mitigated as specified.

## OWED (recorded, not done; no production write in this phase)

- **Production:** apply migration 207 BEFORE the backend deploy that carries 284. `GET /documents`, `GET /documents/{id}` and `GET /library/summary` 500 without the view (RESEARCH Pitfall 3). Then run `get_advisors(security)`.
- **Production `max_rows` read (R-09):** owed. This executor had no Supabase MCP.
- **The frontend still calls `GET /documents` as an array.** Wave 2 (284-03) switches it. Until then a develop build that has this backend and the old frontend reads the Library as empty, by design of the breaking change. The deploy must ship both together, or ship 284-03's dual-shape reader first.
- **`graphify update .`** was not run from this worktree; the graph output is shared and would conflict with the parallel 284-01. Run it once on the merged tree.
- The account stays at 50,000 + 20 for 284-03 / 284-04 / 284-05. 284-05 runs `--teardown`.

## Self-Check: PASSED

- All 11 created files FOUND; `test_261014_list_documents_batches_in.py` absent (retired).
- Commits FOUND on this branch: `aeb55f446`, `1f30122bf`, `d540f6f8d`, `c69b8b771`, `bd80f57fe`.
- Local-DB lock released (own file removed at 2026-10-16T00:14Z; it had been held since 23:21Z, refreshed by the holder at each task boundary).
- STATE.md / ROADMAP.md untouched (orchestrator-owned).
