---
phase: 284-library-at-scale
verified: 2026-10-16T07:30:42Z
verified_at_head: 34443231b
phase_diff: "git diff f8659ac2d 34443231b (165 files, +21,499 / -2,015)"
status: human_needed
score: 7/7 success criteria verified (0 failed, 0 partial); 1 item awaits a human decision
verification_mode: self-verified
independent_review: self
overrides_applied: 0
requirements: [FIX-11]
gaps: []
deferred:
  - truth: "No list request depends on the API's 1,000-row cap — agent KB browse (/kb/ls, /kb/tree, /kb/grep, /kb/glob) still reads a folder's documents unranged"
    addressed_in: "SEED-355 (planted, structured trigger)"
    evidence: "R-10 decided at research: agent KB and governance-edge routes go on the D-23 allow-list with a seed. Named in test_284_route_inventory.py ALLOW_LIST. No frontend caller."
  - truth: "GET /document-governance/broken-relationships reads every relationship edge unranged before paging"
    addressed_in: "SEED-356 (planted)"
    evidence: "Named in PAGED_WITH_A_KNOWN_UNRANGED_READ in test_284_route_inventory.py. Governance surface, not the Library / Find / pickers."
  - truth: "Pre-284 ranged count=exact reads (workflow_runs.py:631, knowledge_health.py:142/:338, document_governance.py:241) still 500 on an offset past the end; Find's folder subtree is still an in.() in the URL"
    addressed_in: "SEED-358 (planted)"
    evidence: "284-REVIEW-FIX.md §Found, out of scope. Not Library list routes."
human_verification:
  - test: "Browser-rendered Library open at 10k and at 50k on the migration-208 view, ideally on a production build (vite build + preview). Click Library, record click to settled rows, and re-read G-4 A (Root total, first page) and B (Big last page)."
    expected: "Rows settle in roughly the same time at both sizes. The 50k total reads 1-25 of 29,808 and Big's last row is scale284-00017.pdf, as in the 207 drive."
    why_human: "SC#1's load time is recorded as the HTTP round trip (Root, folder, Find, summary and the parallel open set). The only browser figure is ~3.2 s at 50k on the Vite DEV build, before 208, with no 10k pair. G-4 A-D and F were driven on 207's view; only E was re-driven on 208. The scale account is torn down, so this needs an operator decision to reseed. Accepting the HTTP proxy plus the row-for-row parity proofs closes this as passed."
---

# Phase 284: Library at Scale — Verification Report

**Phase Goal:** The Library, Find and every document picker stay correct and fast for an account with **tens of thousands of documents**: the server returns one page at a time, the server does the counting, and no request ever carries an ever-growing list of ids.
**Verified:** 2026-10-16T07:30:42Z at `34443231b` (develop). Phase diff `f8659ac2d..34443231b`.
**Status:** human_needed. All 7 success criteria are verified with 0 gaps. One perception item is open: browser load time at scale on the 208 view.
**Re-verification:** No. This is the first verification. It covers the merged tree after review rounds 1 and 2.
**Mode:** self-verified. Claude is the only agent on this repo (`independent_review: self`).

## How this was verified

Every claim below was checked against the code, a test I ran myself, or a recorded artifact named by file. SUMMARY prose was not used as evidence. What I ran:

| Check | Result (this verification) |
|---|---|
| `pytest tests/unit/test_284_*.py -q` (8 files) | **110 passed** |
| `node scripts/check-backend-unit-baseline.cjs` (full `tests/unit`) | **[GATE PASSED] 71 failed (≤ 71), 7688 passed, 0 errors**, 405 s |
| Vitest (11 suites: `libraryListFence`, `libraryPaging284`, `LibraryPage.states284`, `LibraryPage.review284`, `useLibraryDocuments`, `CreateLinkDialog`, `LegalHolds`, `TakeoffSection`, `StructurePopovers`, `LibraryStatTiles`, `FolderDetail284`), `--maxWorkers=2` | **11 files, 178 passed** |
| Live, under the local-DB lock (no scale account needed): `test_284_offset_past_end_live`, `test_284_rel_edge_cap_live`, `test_284_view_disjoint_live` | **9 passed, 0 skipped** against the local DB with 208 applied |
| Live, under the lock: `test_284_view_live -k "security_invoker or grants_are_select_only"` | **2 passed** |
| `check-schema-acl-parity.cjs` | OK. 207 (6) and 208 (6) table statements are mirrored in the supplement |
| `check-seeds-register.cjs` | OK, 365/365 |
| `check-hot-file-ledger.cjs .planning/phases/284-library-at-scale` | OK (558 rows, 35 watched) |
| Debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) on added lines in `backend/app`, `frontend/src`, `supabase/migrations`, `scripts` | **none** |
| All cited commits (`23029ca74`, `6bfc47a77`, `6d9a1c226`, `88132dfee`, `2bd13fda9`, `74c529be4`, `d0a11ec71`, `1ec242a84`, `c96a0909e`, `bb47f34ce`, `775fe5a16`, `369279f28`, `e741f56bd`) | exist, and are ancestors of HEAD |

**Not re-run, and why.** These live suites need the seeded 10k/50k scale account, which is torn down (the brief said not to reseed): `test_284_list_live`, `find_live`, `resolve_live`, `summary_live`, `request_recorder_live`, `page_index_live`, and most of `view_live`. I rely on their recorded runs: **44 passed, 0 skipped at 50k** (284-REVIEW-FIX-R2 gates) and 43 passed (284-06 gates). Note what the R2 record itself says: *"At 10k, 3 suites fail and 2 skip because they need the 50k shape"*. So the green record is a 50k-shaped run. The 10k figures come from the measurement tables and from G-4 A@10k.

## Goal Achievement — per Success Criterion

| SC | Criterion (abridged) | Status | Evidence |
|---|---|---|---|
| **1** | 10k and 50k seeded; Root and a folder show the correct total and the first page; page size and load time measured and recorded at both sizes; neither grows with the library | ✓ **VERIFIED** (one perception item below) | **Measured and recorded at both sizes:** 284-MEASUREMENTS.md has BEFORE, AFTER (207, 4 runs) and AFTER (208, 2 runs + statement captures). **Correct total:** AFTER (208) Root page 1 total 29,808 = DB, Big 9,948 = DB, 10k 5,816 / 2,918 = DB, every surface `yes`. BEFORE, 4 of 5 surfaces read **NO** (cut at 1,000). **Size:** Root 26,538 vs 26,409 B, Big 27,208 vs 27,328 B, **1.00x** (BEFORE: 1.06 MB). **Time, under SC#1's literal scope (Root and a folder):** Root page 1 HTTP **1.14-1.38x** across four 10k/50k pairs (45.1→55.6, 54.2→74.6 ms, etc.). Big folder page 1 **0.85-1.10x**. SQL page node Root 0.82→1.10 ms. Both meet D-22's 1.5x. Absolute: Root 54-75 ms and Big 48-49 ms at 50k, against the 500 ms bar. **Code:** `documents.py:825-883` (`list_documents`: one ranged `library_documents` read through `aexec_page`, `count="exact"`, `limit` 1-200). Migration 208's three per-caller indexes plus the ordered UNION ALL view (plan: `Index Scan using documents_library_root_created_idx`, 26 rows). Pinned by `test_284_page_index_live.py` (plan shape, custom AND generic plan, 8 cases, RED 8 failed at both sizes before 208, recorded in MEASUREMENTS). See "SC#1 — what is outside its literal wording" below. |
| **2** | Nothing silently missing: >1,000 reaches every one by paging; the shown total = `count(*)`; no list request depends on the 1,000 cap | ✓ **VERIFIED** (scope note) | `test_walking_every_page_of_big_reaches_every_document` (`test_284_list_live.py:124`) and `test_root_total_equals_count_star`. Recorded green at 50k. G-4 B: 397 real Next clicks to "9,926–9,948 of 9,948". The last row `scale284-00017.pdf` is the DB's oldest. G-4 F: a saved view paged to "8,276–8,289 of 8,289". `DocumentsPager` ROW_CAP arm deleted (D-09). `aexec_page` (`app/utils/db.py:86-111`) makes a past-the-end page `[]` plus the exact total, never a 500. Proven live by `test_284_offset_past_end_live.py`: 6 passed (run here). `max_rows` **not** raised: no `supabase/config.toml` exists, no diff line touches `max_rows`, and production was read-only (R-09, LIVE-EVIDENCE). **Scope note:** agent KB browse (`/kb/*`) and the governance broken-relationships edge read are still unranged. Both were decided at research (R-10), named on the guard's allow-list, and seeded as SEED-355 / SEED-356. Neither is the Library, Find or a picker. |
| **3** | Folder counts, CHUNKS / VECTORS tiles and per-row table / image counts are server aggregates equal to DB counts at 10k; no growing id list; the BUG-261014-06 stopgap is removed | ✓ **VERIFIED** | `GET /library/summary` (`library.py:149-299`) is ONE `GROUPING SETS` scan of `public.library_documents` through `get_user_pg_connection` (RLS as the caller). It returns totals, archived, chunks, root/folder `{count,size,archived}`, status, steps, connections and doc types. `useLibraryDocuments.ts` reads every number from `summary.*` / the page `total`. No product `.length`/`.filter`/`.reduce` count over documents was found in the hook, LibraryPage, IngestionTab, FolderDetail, FolderTree or FolderNode. **CHUNKS:** the summary's Σ `chunk_count`. **VECTORS:** `getReembedProgress().total` is `count="exact"` + `.limit(1)` (`reembed_service.py:293-309`), not capped. **Row counts:** `document_tables(count)` / `document_images(count)` embeds in `LIST_SELECT` (`documents.py:756`), pinned by `test_table_count_equals_document_tables_count`. **At 10k (G-4 A@10k):** tree "Root 6,000 · Big 3,000" = DB `root_latest_all` / `big_latest_all`; CHUNKS "297,360 across 10,020"; AFTER (208) 10k summary total 10,020 = DB. **Stopgap removed:** base `documents.py:786-792` (`_ID_BATCH` `in_` loop) is gone. `test_261014_list_documents_batches_in.py` was retired on purpose (R-11). The recorder's RED plant (a) re-inserted the loop and was named (`document_id in.() carries 100 ids > 25`). |
| **4** | Find pages in the database (limit / offset in SQL), not load-all-and-slice | ✓ **VERIFIED** | Base `document_search_service.py:571-573` (`ordered = _sort_rows(candidates…)`; `page = ordered[req.offset:req.offset + req.limit]`) is gone. Now `search_documents` (`:460-557`) issues ONE `aexec_page` read over `library_documents` with `.order(col).order("id")`, `count="exact"`, and the range in SQL. A short page raises `SearchTruncatedError`, never a silent cut. R-12: lineage `has_earlier` is a view column, so the ~500-round-trip batching is gone. Find page 1 at 50k: **16,869 ms → 67-78 ms**. Total 49,720 = DB. `test_284_find_sql.py` is in the 110 unit passes. Deep offsets stay linear in the offset (recorded: 1,444 ms at offset 49,700, contended). |
| **5** | Every whole-list picker (`CreateLinkDialog`, `TakeoffSection`, `LegalHoldDialog`, the rest of the `listDocuments()` callers) searches on the server | ✓ **VERIFIED** | `CreateLinkDialog.tsx:96-110` makes one `POST /document-search` per debounced query (`limit: 20`, 250 ms). `LinkTargetCombobox` runs in server mode. `StructurePopovers.tsx:266` (`limit: 20`). Its connection / doc-type editors read `LibrarySummary.connections` / `document_types`. `LegalHoldDialog.tsx:62-66`: the org check is ONE `getDocumentStates` over ≤ 20 search ids, and the old second whole-library loop is removed (R-05). `TakeoffSection.tsx:95` is one bounded `listDocumentsPage({kind:"spreadsheet", limit: RATE_SHEET_PAGE})`, an accepted exception per R-05, plus a `getDocument(id)` for an off-page saved sheet (WR-04 fix). The five whole-list clients are **deleted**. The only product `listDocumentsPage` callers are IngestionTab, Takeoff and useLibraryDocuments, and each asks for one page. `useRetentionStates` ids are on-screen rows only (`LibraryPage.tsx:688-695`, capped at 500). G-4 C@50k: typing in Create link and Legal hold produced `POST /document-search` with `limit: 20` (1,125 / 1,194 B) and **no** `GET /documents`. |
| **6** | A guard fails on any unbounded list endpoint or a query built from an unbounded id list, **driven RED** against a planted regression | ✓ **VERIFIED** (allow-list note) | **Layer 1, route inventory** `tests/unit/test_284_route_inventory.py`: 48-route literal floor, an exact PAGED set, and a reasoned ALLOW_LIST. RED: planted `GET /document-views/_planted284` → `assert not [('GET', '/document-views/_planted284')]`. Restored md5-identical (284-04 SUMMARY §Driven RED). A permanent in-file plant self-test is included. **Layer 2, request recorder** `tests/unit/test_284_request_recorder.py` (over the shared httpx transport, real postgrest-py query strings) plus the live twin `tests/integration/test_284_request_recorder_live.py`. RED plant (a), the stopgap loop: `document_id in.() carries 100 ids > 25`. RED plant (b), `.range()` deleted: `unbounded select on library_documents`, unit AND live at 50k (284-05 SUMMARY drives 1-2). **D-16 frontend fence** `frontend/src/lib/__tests__/libraryListFence.test.ts`. RED 3: the legacy definitions named. RED 4: a planted `listDocuments()` in `CreateLinkDialog.tsx` named. A permanent planted-source case is included. **Green now:** the two unit files are within the 110 passes, and the fence is within the 178 vitest passes (run here). The live recorder is green as recorded (44 at 50k), not re-run. **Allow-list note:** the guard knowingly admits the four `/kb/*` agent routes (SEED-355) and flags broken-relationships' inner read (SEED-356). A new unbounded route still fails by name. |
| **7** | G-4: operator scenarios defined at scope time, each driven in Chrome MCP | ✓ **VERIFIED** (one re-drive item) | Scenarios were defined at scope time in CONTEXT D-27 (A-E); F was added by the plan checker. 284-LIVE-EVIDENCE.md records the active-org proof for both accounts and verdicts that read rendered numbers, rows and the network log. **A@50k** PASS (after 2 fixes found by the drive: `c96a0909e` grouping, `bb47f34ce` negative-frame clamp, each with RED recorded). **A@10k** PASS. **B@50k** PASS (last page = DB oldest). **C@50k** PASS (no `GET /documents`). **D@50k** PASS (upload: totals +1 with no reload). **E (dev)** PASS, and re-checked under 208 ("1–25 of 200", CHUNKS "8,042 across 286"). **F@50k PASS, amended:** a Folder condition cannot be saved as a view (FilterBar Pitfall 9), so F ran as the ad-hoc folder filter ("1–25 of 9,948" = DB) plus a saved invoice view paged to the DB's oldest match. The amendment is recorded in the row, not silent. A-D and F ran on 207's view. 208's view is proven row-for-row identical for all 43 local users, including the 50k owner (50,220 → 50,220), and the policy parity holds 44/44 at 50,545 documents. See the human item. |

**Score:** 7/7 success criteria verified. 0 failed, 0 partial.

### SC#1 — what is outside its literal wording (recorded, not rounded)

SC#1 names **Root and a folder**. D-22 added Find and the summary. Judged against SC#1's own words, the criterion is met. These are the figures that sit outside it, stated plainly:

- **Find page 1:** 1.32x / 1.33x / 1.42x, and **1.57x in one pair**. That pair's statement time was 20.4 ms, the same as every other 50k capture. The extra ~10 ms is host-side, and the SQL page node is 1.00x. Find's time is a D-22 figure, not an SC#1 figure. SC#4 asks only that Find pages in SQL.
- **Summary:** **1.85x / 1.93x** (45.7-47.5 → 88 ms). It is an exact GROUPING SETS aggregate, linear by construction. D-22's bar for it is < 500 ms, which is MET. The ratio miss is recorded in MEASUREMENTS §"AFTER (208) — verdict" with its cause and fix (a counter or cache, not an index).
- **The parallel "Library open request set"** (Root page + summary + folders): 62.8 / 68.3 → 109.8 ms = **1.61-1.75x**, driven by the summary above. Absolute 110 ms.
- **What remains growing is the exact count.** It is linear by design (FIX-11 keeps totals exact), now ~0.45 µs/row, down from ~4.5 µs/row. "Correct total" and "does not grow at all" cannot both hold for an exact count, and D-22 (operator-locked) defined "does not grow" as "within 1.5x". Root and the folder are within 1.5x on every pair.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/207_library_documents_view.sql` | security_invoker visible-set view, SELECT-only | ✓ VERIFIED | `WITH (security_invoker = true)`. REVOKE ALL from PUBLIC / anon / authenticated / service_role, then GRANT SELECT to authenticated and service_role (the view is keyed on `auth.uid()`, so the service role reads 0 rows). Live fences pass (here). |
| `supabase/migrations/208_library_page_index.sql` | 3 indexes, policy `(SELECT auth.uid())`, ordered UNION ALL view | ✓ VERIFIED | Drift guard first, `lock_timeout 3s`, policy DROP/CREATE last. VERIFY is 16 rows (exact policy text, policy counts and names, view md5, index valid+ready). Each of 8 plants flips its row (REVIEW-FIX-R2). Policy 154 vs 208 parity: TABLE and view, 42/42 and 44/44, with agent_read off/on and two data states. A planted connection-arm drop FAILS it. |
| `backend/app/api/documents.py` | envelope list, per-document pages, single GET | ✓ VERIFIED | `:825` list, `:886` versions, `:924` single, `:1162` chunks, `:1279` tables, `:1309` images, all through `aexec_page` |
| `backend/app/api/library.py` | `GET /library/summary` | ✓ VERIFIED | `:277-299` |
| `backend/app/services/document_search_service.py` | Find in SQL | ✓ VERIFIED | `:497-546`; `REL_EDGE_CAP = 100` (`:106`), measured under the 8 KB URL bound (WR-02) |
| `backend/app/utils/db.py` `aexec_page` | one home for past-the-end pages | ✓ VERIFIED | `:86-111` |
| `frontend/src/hooks/useLibraryDocuments.ts` | G-5 seam, server-backed | ✓ VERIFIED | Numbers come from `summary` / page `total`; `null` = not answered |
| Guards (3 files) | layer 1, layer 2 (+ live), D-16 fence | ✓ VERIFIED | Listed under SC#6 |
| `scripts/seed-scale-284.py`, `measure-library-284.py`, `apply_migration_207.py`, `apply_migration_208.py` | measurement and apply tooling | ✓ present | Loopback-only apply. The teardown proof (`dev account documents: before=294 after=294`) is recorded |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `useLibraryDocuments` | `GET /documents` + `GET /library/summary` | `listDocumentsPage` / `getLibrarySummary` | WIRED (G-4 A network log; vitest) |
| `list_documents` / `search_documents` / resolvers | `public.library_documents` | `supabase.table("library_documents")` + `aexec_page` | WIRED |
| `/library/summary` | `public.library_documents` as the caller | `get_user_pg_connection` (asyncpg, RLS) | WIRED (recorder unit: reads the view and passes no parameter list) |
| Pickers | `POST /document-search` | debounced `searchDocuments` with `limit: 20` | WIRED (G-4 C network bodies) |
| Realtime INSERT/DELETE / membership UPDATE | page + summary refetch | `useDocuments` `onChange` (WR-01 fix) | WIRED (14/14 hook tests) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Library pager / table | `rows`, `total` | `GET /documents` → `library_documents` ranged read with `count=exact` | yes (AFTER tables: total = `count(*)`) | ✓ FLOWING |
| NavRow / FolderDetail / header / CHUNKS / IngestionTab cards | `summary.*` | GROUPING SETS over the view | yes (G-4 A@10k / @50k = DB) | ✓ FLOWING |
| VECTORS tile | `total` | `reembed_progress` `count="exact"` | yes | ✓ FLOWING |
| Row table / image counts | `table_count` / `image_count` | PostgREST embedded counts | yes (live test) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Past-the-end page is `[]` + exact total, live | `pytest tests/integration/test_284_offset_past_end_live.py` | 6 passed | ✓ PASS |
| 208's UNION ALL legs stay disjoint (no duplicate rows), live | `pytest tests/integration/test_284_view_disjoint_live.py` | 1 passed | ✓ PASS |
| Relationship hub at / above the cap: 100 answered, 250 → worded 503, live | `pytest tests/integration/test_284_rel_edge_cap_live.py` | 2 passed | ✓ PASS |
| View is security_invoker; grants SELECT-only, closed to anon | `pytest test_284_view_live.py -k …` | 2 passed | ✓ PASS |
| Whole-list fence green over the product tree | vitest `libraryListFence.test.ts` | pass (in 178) | ✓ PASS |
| Scale-account suites (list / find / resolve / summary / recorder / page-index) | — | not re-run: account torn down; recorded 44 passed at 50k | ? SKIP (recorded) |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` is declared or present for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FIX-11 | 284-01..06 | Library, Find and every picker are correct and fast at tens of thousands of documents; the server pages and counts; no growing id list; no list silently cut at 1,000 | ✓ SATISFIED (code) | SC#1-#7 above. ⚠ `REQUIREMENTS.md:23` still reads `[ ]` and `:74` reads `Pending`. The flip is the close step's job, not a code gap |

No orphaned requirements: REQUIREMENTS.md maps only FIX-11 to Phase 284.

### "How we'd know this failed" — each condition checked

| Failure condition | Found? | Evidence |
|---|---|---|
| Folder totals / tiles counted from the page in the browser (reading 50, not 10,000) | **No** | All counts come from `summary.*`. G-4 A tree "Big 10,000", CHUNKS "1,514,668 across 50,020" |
| The 1,000 cap "fixed" by raising `max_rows` | **No** | No `config.toml`, no `max_rows` diff. Production read-only: not changed (R-09) |
| The batching stays and runs 100+ round trips | **No** | `_ID_BATCH` loop deleted. The recorder's RED plant proves the guard sees it. Live recorder at 50k: largest `in.()` = 1 |
| Find still loads every match before slicing | **No** | Base `:573` slice gone; one ranged SQL read |
| A picker still downloads the whole library | **No** | Five whole-list clients deleted. The D-16 fence is green. G-4 C network log |
| RLS loosens via a `SECURITY DEFINER` aggregate or a default `PUBLIC` EXECUTE | **No** | **No new SQL function** in 207 or 208 (the summary is plain SQL as the caller; R-03). The view is `security_invoker`, REVOKE ALL FROM PUBLIC/anon, GRANT SELECT only. The policy rewrite is semantically identical (parity proved; drift guard). ACL parity gate OK |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `backend/app/api/documents.py` | 787-791 | `_exact_total` falls back to `len(rows)` when `count` is missing (IN-02) | ℹ️ Info | Only when a response carries no count (test doubles, a proxy dropping `Content-Range`). Recorded, not scheduled |
| `backend/app/api/documents.py` | 750-753 | LIST_SELECT comment "embedded counts evaluated for the PAGE only" is false for unindexed filters | ℹ️ Info | Comment accuracy. Flagged for the next edit (284-06 §Noted) |
| `backend/app/api/documents.py` | ~900 | `/versions` sends an unvalidated id (IN-03): malformed id → 500 | ℹ️ Info | Recorded |
| `frontend/src/lib/api/documents.ts` | 104-161 | Legacy-array tolerance mislabels a list if the frontend ships before the backend (WR-03) | ⚠️ Accepted | Operator-accepted. Deploy order is backend-first; delete one release after deploy |
| — | — | No TBD / FIXME / XXX / TODO / HACK on any added line | — | Debt-marker gate clear |

## Review dispositions (round 1 + round 2) — all recorded

- **Fixed (round 1):** CR-01, WR-01, WR-02, WR-04, IN-05, IN-07. Each is a RED → GREEN pair (284-REVIEW-FIX.md).
- **Accepted:** WR-03 (operator, 2026-10-16). The note sits in 284-REVIEW.md beside the finding.
- **Not addressed, info, recorded:** IN-01 (one wasted request on navigation), IN-02, IN-03, IN-04 (IngestionTab's in-flight pill counts archived rows while its queue list excludes them; rare, two numbers on one tab can differ), IN-06 (the doc-type cap bounds the response, not the query).
- **Fixed (round 2):** WR-R2-01..05 (`d0a11ec71`, `1ec242a84`, docs). **Info recorded:** IN-R2-01..05.
- **Seeds:** SEED-355, SEED-356 and SEED-358 are `planted` with structured triggers. SEED-357 is `answered` by 284-06 with measured figures. BUG-261014-06 and BUG-261014-07 are `closed`.

## Owed (operator-gated, expected; not gaps)

1. **Production, in order:** paste **207**, then **208** (VERIFY must read **16/16**, run with its `SET search_path` line; on a lock timeout re-paste, never widen it). Then `get_advisors(security)`, then the backend, then the frontend. Production is at 206 (R-09 read: `library_documents` absent). Each paste is an approval-gated production write.
2. The v4.6 public changelog entry for the `GET /documents` breaking change (R-06, owner: v4.6 close).
3. Remove the legacy-array tolerance in `lib/api/documents.ts` one release after the production deploy (WR-03).
4. `graphify update .` (284-06 §Owed).

### Bookkeeping the close step still owes (info)

- `ROADMAP.md`: the 284-06 plan line is still `[ ]`, and the Progress row reads `5/6 · In Progress`.
- `REQUIREMENTS.md`: FIX-11 is still `[ ]` / `Pending`.
- `STATE.md` still says "Phase 284 planned — executing (284-01..05)" and has no 284-06 or 208 entry.
- `284-LIVE-EVIDENCE.md` §Owed lists only migration 207 for production. 208 is listed in 284-06-SUMMARY and REVIEW-FIX-R2 but not there.

## Human Verification Required

### 1. Library open at scale, in the browser, on the 208 view

**Test:** Reseed the scale account (operator decision; it is torn down). Open the Library at 10k and at 50k, ideally on a production build (`vite build` + preview), and record click → settled rows. Re-read G-4 A (Root "1–25 of 29,808") and B (Big last page, last row `scale284-00017.pdf`).
**Expected:** Settled-rows time is about the same at both sizes. The numbers and rows are as in the 207 drive.
**Why human:** SC#1's load time is the HTTP round trip, which is measured, flat and recorded. The only browser figure is ~3.2 s at 50k on the Vite DEV build before 208 (React DEV instrumentation dominated, per the trace), with no 10k pair. G-4 A-D and F were driven on 207's view; only E was re-driven on 208. The row-for-row parity proofs make a regression unlikely, but nothing has observed the rendered experience at scale after 208. **If the operator accepts the HTTP proxy plus the parity proofs, this phase closes as `passed`.**

## Gaps Summary

**None.** Every success criterion has code, test and measurement evidence. The guards were each driven RED, and their unit and vitest forms pass now (run here). The "How we'd know this failed" conditions are all absent. The figures that miss a D-22 ratio (the summary's 1.85-1.93x, the open set's 1.61-1.75x, and one Find pair at 1.57x) are outside SC#1's literal wording and are recorded with their causes. The deferrals (SEED-355 / 356 / 358) are agent, governance or pre-284 routes, decided at research (R-10) or found by review, and none is the Library, Find or a picker. The status is `human_needed` only because the browser-rendered load time at scale on the final (208) view has not been observed.

---

_Verified: 2026-10-16T07:30:42Z_
_Verifier: Claude (gsd-verifier), self-verified, `independent_review: self`_
