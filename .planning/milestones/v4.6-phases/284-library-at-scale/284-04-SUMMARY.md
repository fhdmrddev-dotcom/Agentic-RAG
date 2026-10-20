---
phase: 284-library-at-scale
plan: 04
subsystem: api + frontend / library
tags: [find, paging-in-sql, view-resolve, agent-tool, route-inventory, pickers, typeahead, tdd, backend, frontend, security]

requires:
  - phase: 284-01
    provides: "listDocumentsPage, DocumentSearchRequest.include_archived, useDocumentFind"
  - phase: 284-02
    provides: "public.library_documents (migration 207), the 50,000 + 20 scale account, _284_scale_account.py"
provides:
  - "POST /document-search pages in SQL: one ranged count=exact read of library_documents (FIND_SELECT, no full_markdown)"
  - "resolve_filter(via_view=True|False, offset, limit, include_archived): the routes page through the view; the agent keeps its two legs"
  - "GET /document-views/{id}/resolve and POST /document-views/resolve take offset / limit (<= 200) / include_archived and answer {documents, total, offset, limit}"
  - "backend/tests/unit/test_284_route_inventory.py: D-23 layer 1 — every route in ten library modules is paged or allow-listed with a reason"
  - "LinkTargetCombobox server mode; CreateLinkDialog / RelationshipEditor / LegalHoldDialog type-ahead on POST /document-search; TakeoffSection reads one bounded spreadsheet page"
  - "SEED-355 (agent kb browse unranged), SEED-356 (broken-relationships edge read unranged)"
  - "backend/tests/integration/_284_route_users.py: real GoTrue callers for route suites"
affects: [284-05, frontend/src/pages/LibraryPage.tsx (284-03 — resolve now pages), docs/public/api]

tech-stack:
  added: []
  patterns:
    - "One fragment walk, two read strategies: via_view=True (user JWT, the security_invoker view) / via_view=False (service role, the two caller-scoped legs)"
    - "Exact two-leg total without id lists: own + global - own-in-global, three count=exact head reads"
    - "Route inventory detector: query params recursed through sub-dependencies + body-model limit metadata, with a permanent throwaway-router self-test"
    - "A picker in server mode reports its query and never re-filters the answer; status/alert lines live after the listbox"

key-files:
  created:
    - backend/tests/unit/test_284_find_sql.py
    - backend/tests/unit/test_284_view_resolve.py
    - backend/tests/unit/test_284_route_inventory.py
    - backend/tests/integration/test_284_find_live.py
    - backend/tests/integration/test_284_resolve_live.py
    - backend/tests/integration/_284_route_users.py
    - .planning/seeds/SEED-355-agent-kb-ls-silently-cut-at-1000.md
    - .planning/seeds/SEED-356-governance-broken-relationships-edge-read-unranged.md
  modified:
    - backend/app/services/document_search_service.py
    - backend/app/services/document_view_resolver.py
    - backend/app/api/document_views.py
    - backend/app/models/document_view.py
    - backend/app/services/tools/documents.py
    - backend/app/services/retrieval_scope.py
    - backend/tests/unit/test_271_search_core.py
    - backend/tests/unit/test_271_relationship_filter.py
    - backend/tests/unit/test_115_handler_modes.py
    - backend/tests/unit/test_278_pure_move.py
    - backend/tests/integration/test_271_two_org_fence.py
    - backend/tests/integration/test_113_view_folder_scope.py
    - backend/tests/integration/test_113_view_global_leak.py
    - backend/tests/integration/test_113_view_resolve.py
    - backend/tests/integration/test_114_count_only.py
    - backend/tests/integration/test_114_resolve_adhoc.py
    - backend/tests/integration/test_114_resolve_range_date.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/components/relationships/LinkTargetCombobox.tsx
    - frontend/src/components/relationships/CreateLinkDialog.tsx
    - frontend/src/components/retention/LegalHoldDialog.tsx
    - frontend/src/components/metadata/TakeoffSection.tsx
    - frontend/src/components/library/find/StructurePopovers.tsx
    - frontend/src/components/library/find/FindQuickAdd.tsx
    - "10 frontend suites converted in place (relationships ×4, retention ×3, TakeoffSection, StructurePopovers, FindQuickAdd)"

key-decisions:
  - "A3 holds: on page 1 Postgres evaluates version_count / has_earlier for the 25 page rows only (Result above a top-N Sort), so the lineage pair stays in the one read; no page-only second read"
  - "The agent tool's output is byte-identical to the pre-284 algorithm for <= 50 rows (7 fixtures) — no cross-provider UAT scoreboard is owed"
  - "The 113/114 route suites now drive the routes with real GoTrue users: through the service role the fail-closed view reads 0 rows, so a service-role route test proves nothing (D-18)"
  - "Find's fail-loud invariant survives in a new form: a page SHORTER than the server's count promises raises SearchTruncatedError (503)"
  - "The _fetch_all walk moved verbatim into retrieval_scope.py (its only remaining caller, the service-role scope proposer) instead of surviving under a new name in the Find core"
  - "The route inventory classifies EVERY method in the ten modules (writes included), not just list routes, so any new route has to be looked at once"

requirements-completed: []  # FIX-11 spans 284-01..05; the orchestrator marks it at phase close

duration: ~2h45m
completed: 2026-10-16
---

# Phase 284 Plan 04: Find pages in SQL, views and filters page, every picker searches the server

**Find now answers every page with one ranged `count="exact"` read of migration 207's `library_documents`, instead of reading all 50,000 matches, sorting them in Python and reading their lineage 100 filenames at a time. Page 1 at 50,000 documents went from 12.7 s to about 0.45 s.** Saved views and ad-hoc filters page through the same view with exact totals, while the agent tool keeps its service-role two-leg path and returns exactly what it returned before. A route inventory names any Library route that can return an unbounded list. The link, relationship and legal-hold pickers type ahead against the server, and the rate-sheet select reads one bounded page.

**PLAN_BASE:** `0ae58d8bd423419d3eccbb21173cc185a658627e` (wave 1 merged). The worktree started on master's tip (`a248672f0`); the merge-base check failed and it was reset to PLAN_BASE before any edit.

## Base files (not committed)

All in `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/`:
- **Backend gate base:** `base_failed_0ae58d8_04.txt` (71 lines). It is derived from the orchestrator's merged-wave-1 run `backend_merged_w1.txt` (71 failed / 7619 passed at this tree), not from a fresh step-0 run. That saved 8 minutes of locked DB time; see Deviations.
- `integ_base_0ae58d8_04.txt`: the resolve / agent integration set at base, **55 passed, 2 xpassed**.
- `tsc_base_0ae58d8_04.txt` (66 `error TS` lines) and `.norm.txt` (58 unique). These are identical to `tsc_merged_w1.norm.txt`.
- `vitest_base_0ae58d8_04.json`: the four plan directories at base, **442 passed / 0 failed**.
- RED captures: `red_04_t1_unit.txt`, `red_04_t1_live.txt`, `red_04_t2_unit.txt`, `red_04_t2_live.txt`, `red_04_t3.txt`.
- `explain_find_04.txt`, `time_find_04.txt`, `inventory_red_plant_04.txt`, `perfile_04.txt`, `eslint_04.txt`, `backend_after_04.txt`, `backend_after2_04.txt`.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Find pages in SQL | `7980fe669` | `b7764503b` |
| 2 | Views and filters page; the agent keeps its path; the route inventory | `1f7e3b4c6` | `700a681b6`, then seeds + driven RED `6d9a1c226` |
| 3 | Every picker searches on the server | `2f505d0b5` | `7d7562093` |
| — | Backend-gate fix: the OpenAPI snapshot | — | `99cade5b1` |

## RED evidence

**Task 1, unit:** 28 failed / 137 passed across the six Find suites. All 15 of `test_284_find_sql.py`'s behaviour cases failed, for example `test_a_search_is_one_ranged_count_exact_read_of_the_view` and `test_a_relationship_above_the_edge_cap_fails_loud`. The two "pins unchanged behaviour" cases passed at base, as they should: `test_the_zero_result_keys_are_unchanged` and `test_the_connection_name_read_is_bounded_by_the_page`.

**Task 1, live:** `[284-04] Find page 1 as the owner: total=49720 in 12686 ms`, which fails the `< 5000 ms` bound. The other four live cases passed at base. That is correct: the old code gave the right answer, just slowly.

**Task 2, unit:** 13 failed / 10 passed. The inventory RED is the real unbounded set at that commit:
```
E       assert not [('GET', '/document-views/{view_id}/resolve'), ('POST', '/document-views/resolve')]
```
**Task 2, live:** 3 failed / 1 passed.
```
resolve_view() got an unexpected keyword argument 'offset'
count_only:  assert {'total': 1000} == {'total': 10000}
agent:       the agent total is exact past 1,000 — assert 1000 == 49720
```
The agent line is a real defect found on the way. `query_documents_by_view` told the model "1000 match" for a 49,720-document library, because its `count_only` was `len()` of two capped id sets.

**Task 3:** 32 failed / 328 passed across 7 suites. Per file: CreateLinkDialog 6, LinkTargetCombobox 6, RelationshipsSection.a11y 1, TakeoffSection 4, LegalHolds 7, FindQuickAdd 1, StructurePopovers 7. The full list is in `red_04_t3.txt`.

## EXPLAIN at 50k, and the A3 decision

These were run as the scale owner (`authenticated`, RLS on) against the view with Find's predicate:

| query | top node | time |
|---|---|---|
| page 1 (with `version_count`, `has_earlier`) | `Limit (rows=25)` → `Result (rows=25)` → `Sort (top-N heapsort)` → `Bitmap Heap Scan (rows=49720)` | **68.7 ms** |
| `count(*)` | `Aggregate` → `Bitmap Heap Scan (rows=49720)` | **34.4 ms** |
| page 1, `has_earlier` | `Limit (rows=25)` → `Result (rows=25)` → `Sort` → scan with the EXISTS as a filter (rows=200) | 142.9 ms |
| count, `has_earlier` | `Aggregate` | 133.2 ms |
| last page (OFFSET 49695) | `Limit` → `Result (rows=49720)` → `Sort (external merge)` | 349.4 ms |

**A3 holds for page 1.** The `Result` node that computes the two lineage subqueries sits above the top-N sort and runs 25 times. So the pair stays in the single read and no page-only second read was added.

The last page evaluates them for every row the OFFSET skips (349 ms). This is a known deep-offset cost, it is still 36× faster than before, and the plan's trigger ("first page over 500 ms") does not fire.

End-to-end through PostgREST (`time_find_04.txt`, median of 5 after one warm-up):

| request | median | note |
|---|---|---|
| page 1 | 444 ms | first call 750 ms |
| last page | 966 ms | |
| `has_earlier` | 777 ms | |
| name search | 562 ms | |

**Cause of the end-to-end gap (recorded, not fixed):** a trivial PostgREST read takes 4 ms, but any `count="exact"` request over the view takes about 250 ms end to end, while the same count EXPLAINs at 34-41 ms. A generic plan was ruled out: `force_custom_plan` measured 41.5 ms and `force_generic_plan` 40.0 ms. The cost is on the PostgREST side on this Windows/Docker stack. It affects 284-02's `GET /documents` equally.

## The route inventory (D-23 layer 1), as measured

- **48 routes** across `documents`, `document_views`, `document_search`, `folders`, `kb`, `library`, `document_relationships`, `document_governance`, `document_queries` and `takeoff`. `ROUTE_COUNT_FLOOR = 48` is a literal.
- **Paged (exact list, 11):**
  - `GET /documents`
  - `GET /documents/{id}/versions`, `/chunks`, `/tables`, `/images`
  - `GET /document-views/{view_id}/resolve`
  - `POST /document-views/resolve`
  - `POST /document-search`
  - `GET /document-governance/broken-relationships`, `/unclassified`, `/low-confidence`
- **Paged by its parameters, but with an unranged read inside:** `GET /document-governance/broken-relationships`, recorded in `PAGED_WITH_A_KNOWN_UNRANGED_READ` → SEED-356.
- **Allow-listed (37), each with a reason:**
  - **single object:** `GET /documents/{id}`, `POST …/download-url`, `GET …/takeoff`, `GET /kb/read`
  - **bounded by construction:** `/content` (line window), `/conversation` (sibling cap + truncated), `/queries` (`MAX_ROWS=100`), `GET /document-views` (one row per saved view), `GET /folders` and `/folders/{id}/children` (folders, not documents), `GET /document-relationships` (one document's edges), `GET /library/index-summary` (GROUP BY folder), `GET /library/summary` (GROUPING SETS)
  - **agent KB browse:** `GET /kb/ls`, `/kb/tree`, `/kb/grep`, `/kb/glob` → SEED-355
  - **writes:** 21 POST / PATCH / DELETE rows, each "returns the one thing it wrote"
- `app.api.retention` is named in the docstring as adjacent and out of scope: it lists through asyncpg, under an org-admin scope, and its history is already paged.
- **The detector:** query params are recursed through sub-dependencies (governance pages through `Depends(_pagination_params)`). A POST counts as paged when its body model has a `limit` field with `le`. It fails loudly if FastAPI stops exposing `field_info.metadata`. The permanent self-test uses a throwaway `/documents` router with `/_planted` (no limit), `/_paged` (`le=200`) and `/_limit_without_le`, and asserts exactly the two unbounded ones are named.

**Driven RED (not committed):** a planted `@router.get("/_planted284")` returning `[]` in `document_views.py` produced:
```
E       assert not [('GET', '/document-views/_planted284')]
1 failed, 4 passed
```
**Restore proof:** the plant was removed by re-applying the exact text with the editor. md5 of `backend/app/api/document_views.py` was `1cb1db24416f696790c5c46e888c46dc` before and after. `git diff --exit-code` was clean against the GREEN commit, and the inventory went back to 5 passed.

## Planted seeds

`SEED-355` (agent kb browse reads a folder's documents unranged) and `SEED-356` (the broken-relationships edge read is unranged). These were the next free ids (max on disk was SEED-354). Both use the TEMPLATE frontmatter, `status: planted`, structured `trigger_paths`. `node scripts/check-seeds-register.cjs` exits 0: 363/363 parsed, 0 duplicate ids.

## Agent byte-identity: cross-provider UAT is NOT owed

`test_284_view_resolve.py::test_the_agent_answer_is_byte_identical_to_pre_284` runs `_handle_query_documents_by_view` twice on the same fixture and compares the `ToolResult.result` strings byte for byte:
- once with the new `resolve_filter`;
- once with a verbatim copy of PLAN_BASE's `resolve_filter` plus the PRE-284 handler's `[:limit]` slice.

The fixture is ≤ 50 rows with distinct `created_at`. It covers own rows, a colleague's shared-folder rows, one own row inside the shared folder (the overlap), a hidden row, an older version and a non-retrievable row. **7 cases, all equal:** default 20, limit 5, 50, 1, a `document_type` filter, the same filter at limit 7, and a no-match filter.

The live case confirms the service-role path still returns rows (20 shown) with an exact total of 49,720 (it was 1,000), and that the service role reads `[]` from the view. The output is identical for ≤ 50 rows, so the 8-row scoreboard is not owed.

The one observable change is above 1,000 matches. The total the agent reports is now exact instead of being capped near 1,000. That is a correction of a wrong number, not a change in shape.

## Live suites (all ran, 0 skipped)

| suite | result |
|---|---|
| `test_284_find_live.py` | 5 passed. Page 1 `total=49720 in 906 ms` on the run-with-everything pass, 726 ms alone |
| `test_284_resolve_live.py` | 4 passed: Big walks to 10,000 ids, `count_only` 10,000, B sees 20, agent rows + fail-closed |
| `test_284_list_live.py`, `test_284_view_live.py`, `test_284_summary_live.py` | passed (25 total with the two above) |
| resolve / agent integration set (13 files) | **55 passed, 2 xpassed**, equal to base |
| `test_271_search_live.py` | 10 passed |

## Backend gate

| run | failed | passed | collection errors |
|---|---|---|---|
| base (merged wave 1) | 71 | 7619 | 0 |
| after Task 3 | 72 | 7658 | 0 |
| after the snapshot fix (`99cade5b1`) | **71** | **7659** | **0** |

The set diff after Task 3 found **one** new failure: `test_276_openapi_snapshot_fresh.py::test_committed_openapi_snapshot_matches_the_code`. The resolve routes' new params made the committed spec stale. It was fixed in `99cade5b1` (export-openapi + build-public-openapi, `--check OK`, docs coverage OK).

The re-run's failing SET equals the base set exactly. Both sides were normalised by cutting each `FAILED` line at the first `C:`, because pytest glues `RuntimeWarning` paths onto two `test_retrieval_service.py` ids on both sides. `comm -3 base_set_clean_04.txt after_set_clean_04.txt` is empty: 71 = 71. The local-DB lock was released after this run.

## Frontend

**Per-file counts vs base** (`perfile_04.txt`, four directories): **442 → 469 passed, 0 failed, 0 per-file decreases.**

| suite | base | now |
|---|---|---|
| CreateLinkDialog.test.tsx | 8 | 14 |
| LinkTargetCombobox.test.tsx | 9 | 17 |
| TakeoffSection.test.tsx | 3 | 8 |
| LegalHolds.test.tsx | 25 | 29 |
| FindQuickAdd.test.tsx | 26 | 27 |
| StructurePopovers.test.tsx | 27 | 30 |
| RelationshipsSection / .a11y, RetentionSection, RetentionTab | 11 / 6 / 24 / 18 | unchanged (converted in place) |

**For 284-05 to pin** (count-gate raises, both knobs): CreateLinkDialog 8→14, LinkTargetCombobox 9→17, TakeoffSection 3→8, LegalHolds 25→29, FindQuickAdd 26→27, StructurePopovers 27→30. No new frontend file was added. New backend suites: `test_284_find_sql.py` 17, `test_284_view_resolve.py` 18, `test_284_route_inventory.py` 5.

**tsc** (`-p tsconfig.app.json`, `(line,col)`-normalised set diff vs base): **empty**, 58 = 58.

**eslint** (rule-id multiset per touched file, base via `git show … | eslint --stdin`, JSON formatter): **identical for 15 of 16 files**. `TakeoffSection.tsx` went from 2 `react-hooks/exhaustive-deps` to 1, because the sheets effect no longer reads a stale `selectedRateDocId`. Nothing new.

**List client:** `grep "listDocuments("` over `frontend/src/components` (comments stripped) prints nothing.

`src/docs` suites: 17 files / 136 passed on two runs. A first run under load reported 16 files / 124 tests with 1 failure. I did not capture which file it was, so it is recorded as an unexplained one-off, not as clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `_fetch_all` had a second importer.**
- **Found during:** Task 1.
- **Issue:** `retrieval_scope.py` (the agent's service-role scope proposer) imported `_fetch_all` from the Find core. The acceptance grep forbids that name in the core.
- **Fix:** Moved the helper verbatim into `retrieval_scope.py`, with function-local imports per that file's Pitfall 5 fence. Behaviour is unchanged.
- **Commit:** `b7764503b`

**2. [Rule 3 - Blocking] The 271 two-org fence patched a name the core no longer has.**
- **Found during:** Task 1.
- **Issue:** `test_rls_alone_fences_when_the_app_leg_is_widened` widened the app leg by patching `get_globally_visible_folder_ids`, which the core no longer uses.
- **Fix:** The widening is now the widest possible one. The core's view read is redirected to the base `documents` table (no Library predicate at all) through S's real JWT, with a non-vacuity assertion that the redirect fired.
- **Commit:** `b7764503b`

**3. [Rule 3 - Blocking] 22 Phase 113/114 route tests drove the routes with the SERVICE ROLE.**
- **Found during:** Task 2.
- **Issue:** Once the routes read the fail-closed view, those 22 tests read 0 rows.
- **Fix:** A new helper, `_284_route_users.py`, creates real GoTrue users (signup trigger → personal org → autofilled `org_id`) and registers their clients. Six suites now call the route with `as_user(caller)`. Writes still go through the service role.
  - `test_113_view_global_leak` makes B and C members of A's org, so the system-global view is readable under RLS. That makes the leak assertions stronger: RLS then admits A's documents by org, and only the view's own-or-shared-folder rule keeps them out.
- **Result:** 55 passed, 2 xpassed, equal to base.
- **Commit:** `700a681b6`

**4. [Rule 3 - Blocking] Two fences pinned the agent handler's old shape.**
- **Found during:** Task 2.
- **Issue:** `test_278_pure_move` AST-pins `_handle_query_documents_by_view`, and `test_115_handler_modes` spies had strict signatures.
- **Fix:** The 278 case was retired BY NAME in its own `RETIRED` dict, with the reason and the byte-identity test it now relies on (the BUG-261015-03 precedent). The 115 spies accept `via_view` / `limit`.
- **Commit:** `700a681b6`

**5. [Rule 1 - Bug] The OpenAPI snapshot went stale.**
- **Found during:** the backend gate.
- **Fix:** Regenerated. The resolve route's first docstring paragraph is now a plain public change note: the public builder keeps the summary plus the first paragraph, and the original first paragraph named internal terms.
- **Commit:** `99cade5b1`

**6. [Rule 1 - Honesty] The base gate was not re-run at step 0.**
- **Issue:** The base failing set came from the orchestrator's merged-wave-1 run at this tree (71 failed / 7619 passed), not from a fresh run.
- **Mitigation:** The after-run was done twice, and its set diff is the evidence.

**7. Plan wording vs. code.**
- `models/document_search.py` needed no change, so it was left out of the commit.
- `FIND_SELECT` is built as `LIBRARY_ROW_COLUMNS + ",version_count,has_earlier"`, so the view's row column list has one home. It is pinned to migration 207's own column list by a test that parses the migration.
- Two RED-commit test details were corrected in the GREEN commit:
  - eight CreateLinkDialog cases now wait for the debounced options rather than the (now immediate) listbox;
  - LegalHolds queries the Documents input by role, because the 20-most-recent listbox shares its label.
- `LegalHoldDialog` shows up to 20 suggestions. The old `MAX_SUGGESTIONS = 8` is gone, per UI-SPEC S13.

**Total:** 7 deviations: 4 blocking, 2 bugs/honesty, 1 wording. No scope creep. Every file edited outside the plan's list is a test or helper that pinned code this plan was told to change, plus the regenerated API spec.

### Owed (recorded, not done)

- **Hot-file ledger rows (284-05 owns `docs/HOT-FILE-LEDGER.md`).** Touched outside `files_modified`: `backend/app/services/retrieval_scope.py`, which FIRES. That touch is honoured by construction: a verbatim helper move, no logic change. `docs/public/api/*.json` is generated.
- **`docs/public/api/concepts/pagination.md`** lists the 284-02 paged routes; the resolve routes' paging could be added there. It is a 284-05 or docs task.
- **The resolve routes now default to 25 rows.** Until 284-03's LibraryPage passes `offset` / `limit` / `include_archived`, a develop build with this backend shows the first 25 of a view. 284-03's `resolveView` / `resolveAdHoc` already send those params (284-01 wire contract).
- `graphify update .` was not run from the worktree. The graph output is shared.

## TDD Gate Compliance

Each task has a `test(284-04)` commit before its `fix(284-04)` commit: `7980fe669` → `b7764503b`, `1f7e3b4c6` → `700a681b6`, `2f505d0b5` → `7d7562093`. RED was seen failing every time; the counts are above.

## Known Stubs

- `frontend/src/components/library/find/FindQuickAdd.tsx`: the `documents?` prop is DECLARED and UNUSED on purpose, so 284-03's LibraryPage can stop passing it in the same wave. 284-05 deletes it.

## Self-Check: PASSED

- FOUND: all 8 created files (3 unit suites, 2 live suites, `_284_route_users.py`, SEED-355, SEED-356).
- FOUND commits on this branch: `7980fe669`, `b7764503b`, `1f7e3b4c6`, `700a681b6`, `6d9a1c226`, `2f505d0b5`, `7d7562093`, `99cade5b1`.
- Local-DB lock: released (the file is absent). STATE.md / ROADMAP.md untouched (orchestrator-owned). No FilterBar snapshot churn was committed.

## Threat Flags

None beyond the plan's register. T-284-22 to T-284-29 are mitigated as specified:
- B's live Find total is 20, all of them `Shared 284`.
- No visibility predicate is interpolated anywhere.
- The agent path never names the view (unit), still returns rows (live), and the service role reads `[]` (live).
- `REL_EDGE_CAP = 500` fails loud.
- Resolve `limit ≤ 200`.
- The inventory was driven RED.
- LegalHold's org check runs over ≤ 20 ids, and "More documents match" carries no number.
- Every picker failure is rendered.
