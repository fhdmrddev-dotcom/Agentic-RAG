---
phase: 284-library-at-scale
review: 284-REVIEW.md
fixed_at: 2026-10-16
base: 564eed6a4
independent_review: self
fixed: [CR-01, WR-01, WR-02, WR-04, IN-05, IN-07]
accepted: [WR-03]
not_addressed_info: [IN-01, IN-02, IN-03, IN-04, IN-06]
migrations: none
pushed: false
status: all_fixed_gates_green
---

# Phase 284: Code Review Fix Report

The review gate inside execute-phase (not a gap round). Six findings fixed, each as a TDD pair: a RED commit whose failing output is quoted below, then a GREEN commit. Every commit was made by path, and each was checked with `git show --stat HEAD`.

## Commits

| Finding | RED | GREEN | Files (product) |
|---|---|---|---|
| CR-01 | `775fe5a16` | `369279f28` (+ lint `547df85e7`) | `backend/app/utils/db.py`, `backend/app/api/documents.py`, `backend/app/services/document_view_resolver.py`, `backend/app/services/document_search_service.py`, `frontend/src/lib/pageClamp.ts` (new), `frontend/src/pages/LibraryPage.tsx`, `frontend/src/components/library/IngestionTab.tsx` |
| WR-01 | `1c9e35532` | `d158ec9b6` (+ lint `547df85e7`) | `frontend/src/hooks/useDocuments.ts`, `frontend/src/hooks/useLibraryDocuments.ts` |
| WR-02 | `5461e4caf` | `a5b6e2ffd` | `backend/app/services/document_search_service.py` |
| WR-04 | `5e9791b69` | `fdb2d8a88` | `frontend/src/components/metadata/TakeoffSection.tsx` |
| IN-05 | `b10484562` | `4c87a102b` | `frontend/src/components/ui/animatedNumberProgress.ts`, `frontend/src/components/ui/AnimatedNumber.tsx`, `frontend/src/components/library/LibraryHeaderBar.tsx` |
| IN-07 | `578b603de` | `232b2bf03` | `frontend/src/hooks/useLibraryDocuments.ts`, `frontend/src/pages/LibraryPage.tsx` |

## CR-01: a page past the end is an empty page with the exact total

**PostgREST's behaviour, proven live** (the review could not drive it). The test is `backend/tests/integration/test_284_offset_past_end_live.py`. It runs as a real GoTrue user, through supabase-py on the app's own user-JWT client shape (anon key + Bearer), against local PostgREST:

- `offset > total` with `count=exact` raises `APIError` code **`PGRST103`**: `'details': 'An offset of 50 was requested, but there are only 4 rows.'`
- `offset == total` is a 200 with `[]` and the count.

**RED at base** (live, 5 failed, 1 passed — the one pass is the characterisation above):
```
E   postgrest.exceptions.APIError: {'message': 'Requested range not satisfiable', 'code': 'PGRST103', 'hint': None, 'details': 'An offset of 50 was requested, but there are only 4 rows.'}   <- GET /documents
E   ... 'An offset of 3 was requested, but there are only 2 rows.'    <- Include archived turned off on page 2 (the review's path)
E   ... 'An offset of 10 was requested, but there are only 2 rows.'   <- /versions (then /chunks, /tables, /images)
E   ... 'An offset of 40 was requested, but there are only 4 rows.'   <- GET /document-views/{id}/resolve (then POST /document-views/resolve)
E   ... 'An offset of 30 was requested, but there are only 4 rows.'   <- POST /document-search
5 failed, 1 passed
```
**RED, unit** (`backend/tests/unit/test_284_offset_past_end.py`, 11 failed): the fakes raise the real PGRST103 `APIError`, `aexec_page` does not exist, and a source fence requires every 284 paged read to go through it.

**RED, frontend** (4 failed):
- `LibraryPage.review284.test.tsx`: Include archived turned off on page 3 rendered `Received: Rows per page:25 51–40 of 40`. A Realtime shrink rendered `51–49 of 49`. An emptied list stayed at offset 50.
- `IngestionTab.test.tsx`: an emptied History list stayed at offset 50.
- `pageClamp.test.ts`: `Failed to resolve import "@/lib/pageClamp"`.

**Fix.**
- `app.utils.db.aexec_page(build, offset=, limit=)` is the one home for this. `build` is a factory for a fresh, filtered, ordered builder with no range. Builders mutate in place, so the count re-read needs its own. On `PGRST103` the helper re-reads the same filters with `.limit(1)` to get the exact count, and returns `data=[]` with that count. Any other error is still raised.
- The following page through the helper: `GET /documents`, `/versions`, `/chunks`, `/tables`, `/images`, the saved-view and ad-hoc resolves, and `POST /document-search`.
- Frontend: `lib/pageClamp.clampPageOffset` is one rule, shared by the browse pager and IngestionTab's lists. An emptied list goes back to page 1.
- LibraryPage resets the page when Include archived changes, in the same event, with the effect kept as the guard for other paths. On a ready answer it clamps to the last real page. That clamp is a render-time state adjustment, not a setState-in-effect (lint).
- IngestionTab's failure path needs no clamp of its own: a past-the-end page is no longer a failure, so the success-path clamp now runs. The review's point 3 is closed at its root.

**GREEN:** live 6/6. Unit 11/11 plus the 284/271 search, view and list suites (177 passed). Frontend 58/58 across the three suites.

One test assertion was corrected inside the GREEN commit. The page-2 rows after the shrink are d26…d03, not d27. The RED failure itself ("51–49 of 49") was real and unchanged.

## WR-01: a membership-changing Realtime UPDATE refetches

**RED** (6 failed):
```
× an UPDATE changing folder_id asks for ONE refetch          AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
× an UPDATE changing folder_id → Root / archived_at / is_latest / status (processing → pending)   (same)
× hands useDocuments the ON-PAGE rows                         expected undefined to deeply equal [ 'r3', 'r1' ]
```
**Fix.**
- `useDocuments` now takes the on-page `rows`. `changesMembership(cur, next)` compares `folder_id`, `archived_at`, `is_latest` and `status`. A key absent from the payload counts as "not sent", and `null` and `undefined` count as the same absence.
- The decision is made outside the state updater, so StrictMode cannot double it. Such an UPDATE calls `onChange()`, which is the same coalesced 500 ms page + summary refetch.
- A pure field update still spread-merges in place and asks for nothing. A terminal status still refetches exactly once.
- `useLibraryDocuments` passes its settled rows.

**GREEN:** 14/14 and 25/25.

## WR-02: the relationship cap fits the measured URL bound

**Measured (new).** Local Kong refuses a request line over 8,192 bytes. A `select=id` read with 208 ids (path + query 8,172 chars) passes; 209 ids (8,211 chars) returns `414 "URI too long"`. This agrees with BUG-261014-06 on cloud: 182 pass, 286 fail. URLs were built with the real postgrest-py builder and httpx encoding:

| ids | FIND page read | endpoints read |
|---|---|---|
| 100 | 4,569 | 3,993 |
| 150 | 6,519 | 5,943 |
| 200 | **8,469 (over)** | 7,893 |
| 500 | 20,169 | 19,593 |

⚠ So the review's suggested `REL_EDGE_CAP = 200` **would still 414** on the page read.

**RED** (unit 5 failed, live 2 failed):
```
E   AssertionError: page read at the cap is 20229 bytes (budget 6144)
E   assert 19615 <= 6144                        <- endpoints read
E   AssertionError: the follow-to-latest read must be batched
E   assert 500 == 100
live: E   postgrest.exceptions.APIError: {'message': 'JSON could not be generated', 'code': 414, ..., 'details': "b'URI too long\\n'"}   (a hub AT the old cap, and a hub of 250 edges)
```
**Fix.**
- `REL_EDGE_CAP = 100`. At the cap the page read is ~4.6 KB, which leaves room for a name, a folder subtree and dates. The pin budget is 6,144 bytes: 2 KB of the 8 KB bound kept free.
- The follow-to-latest read carries file names (up to 255 chars each, percent-encoded) in the URL. It is now batched so that each `filename=in.(…)` batch stays under 3 KB encoded.
- A hub above the cap is the worded 503 (`TRUNCATED_DETAIL`).

**GREEN:** live 2/2. A hub at the cap answers all 100 referencing documents. A 250-edge hub returns `HTTPException(503, TRUNCATED_DETAIL)`.

## WR-04: Takeoff always shows the saved rate sheet

**RED** (4 failed):
```
Unable to find role="option" and name "Rates 2019.xlsx"            <- saved sheet outside the 50-newest page
Unable to find role="option" and name "Old Rates.xlsx (archived)"
Unable to find ... "The saved rate sheet is no longer available."  <- 404
Received element is not disabled                                   <- Match while the select shows "Loading rate sheets…"
```
**Fix.**
- When the selected id is not on the page, it is read once with `getDocument(id)` and prepended to the list. The option is labelled with the file name, plus "(archived)" when the sheet is archived.
- If that read 404s, the panel shows "The saved rate sheet is no longer available." and selects the first sheet the select shows.
- Match is disabled unless the list is ready, so it can never send an id the select is not showing.
- A saved sheet that is already on the page costs no extra read.

**GREEN:** 13/13.

## IN-05: grouped numbers

**RED** (5 failed):
- `expected 'Reading 1200 files' to contain 'Reading 1,200 files'`
- `parseDisplayNumber is not a function` (the parse was inline, and comma-only: in de-DE it read "10.000" as 10.000 with three decimals)

**Fix.**
- `LibraryHeaderBar` renders `inFlight.toLocaleString()`.
- `animatedNumberProgress.parseDisplayNumber` / `formatDisplayNumber` treat a token as grouped only when the locale's group separator sits in grouping position. So de-DE "10.000" is ten thousand, and its frames read "3.142". Ungrouped decimals ("12.5 MB") and en-US behaviour are unchanged.
- `AnimatedNumber` uses both functions.

**GREEN:** 7/7 and 17/17. One test expectation was corrected in GREEN: a frame of "12.5 MB" is "6.3 MB", because the suffix is part of the frame.

## IN-07: a failed page change keeps the pager on the rows shown

**RED** (2 failed):
- Page 2 failed. Page 1's rows stayed and the alert showed, but `Received: Rows per page:25 26–30 of 30` instead of `1–25 of 30`.
- The same happened for Previous.

**Fix.**
- `useLibraryDocuments` records the page the on-screen rows belong to (`answeredPage`). The record is kept when a later request fails, and is returned as `rowsPage`.
- While the list is in error, LibraryPage shows that page's range.
- Asking again for the page that failed (Next or Previous lands on the same offset) is a `retry()`, not a no-op state set.

**GREEN:** 5/5.

## Not addressed

- **WR-03** — accepted by the operator. The deploy order is backend-first (284-LIVE-EVIDENCE), so the legacy-array fallback is unreachable. The tolerance is deleted one release after deploy.
- **IN-01, IN-02, IN-03, IN-04, IN-06** — not addressed (info), per the brief.
- The seeded items SEED-355/356/357 were not touched.

## Found, out of scope (deferred)

- **Pre-284 ranged `count="exact"` reads have the same PGRST103 hole.** They predate 284 and were not changed:
  - `backend/app/api/workflow_runs.py:631` (the run log)
  - `backend/app/api/knowledge_health.py:142` and `:338` (sync)
  - `backend/app/api/document_governance.py:241` (sync)
  - `aexec_page` is the seam to adopt for the async ones. The sync ones need a sync twin.
- **Find's folder subtree is also an `in.()` in the page URL.** A subtree of hundreds of folders could reach the same 8 KB bound that WR-02 measured. This was not measured here.

## Gates (run once, at the end, on the final tree)

| Gate | Verdict |
|---|---|
| Backend unit (`pytest tests/unit -q --continue-on-collection-errors`) | **71 failed, 7688 passed**, 1 skipped, 2 xfailed, 2 xpassed. Base `564eed6a4` measured in this worktree: **71 failed, 7673 passed**. The failing SET is identical to base, compared after stripping a `RuntimeWarning` glued to one FAILED line. The +15 passed are the new unit tests. |
| Integration `tests/integration/test_284_*.py`, all 8 files together | **35 passed, 0 skipped**. Run against the seeded 50k scale account (`seed-scale-284.py --size 50000 --lock-held`), then `--teardown`: dev account documents before = 294, after = 294; `--status` owner null / peer null. No `phase-284-route-*` users or orgs remain. |
| Frontend `tsc -p tsconfig.app.json --noEmit` | 63 errors at base, 63 at HEAD. **Multiset diff empty**, with `(line,col)` stripped and sorted without `-u`. |
| ESLint on the 17 touched files | 15 findings at base, 15 at HEAD, **0 new (file, rule) counts**. Base was measured by checking out the base versions in place and restoring them afterwards. |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | **count gate OK**: 449/449 pinned files present, no per-file decrease, 0 failing (total 10,513). Pinned in BOTH knobs with a `284-REVIEW <id>` comment: `useDocuments` 7→14, `useLibraryDocuments` 24→25, `IngestionTab` 50→52, `TakeoffSection` 8→13, `LibraryHeaderBar` 16→17, `AnimatedNumber.progress` 3→7. New: `LibraryPage.review284` 5, `pageClamp` 3. `FilterBar.find271.test.tsx.snap` untouched. |
| `check-hot-file-ledger.cjs .planning/phases/284-library-at-scale` | ledger gate OK (558 rows · 113 subject · 35 watched) |
| `check-claude-md-size.cjs` | OK (94,018 chars) |

The local-DB lock was held for every live run and for the backend gate, then released. Supabase MCP was not used. No migration was made, nothing was pushed, and the backend on :8000 was not touched.
