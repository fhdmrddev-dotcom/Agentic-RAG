# Phase 284 — Library at scale: measurements

**Date:** 2026-10-16 (UTC 2026-10-15T23:3x) · **PLAN_BASE:** `f8659ac2d56f8cf3b93174e1ee834f383eb192c6`
(plan 284-02, wave 1). **Backend measured = BASE CODE:** the operator's uvicorn on `:8000` serves the
main checkout, whose HEAD read `refs/heads/develop @ f8659ac2d` = PLAN_BASE, and every one of the
1,318 tracked `backend/` files was byte-compared against this worktree at PLAN_BASE (modulo CRLF↔LF —
`core.autocrlf` checks the fresh worktree out with CRLF; 387 files differed ONLY in line endings) —
identical. No backend code in this phase had changed when both BEFORE tables were taken.

**Local stack:** Postgres 17.6 (:54322), PostgREST 14.10 (:54321), `max_rows` **1,000** (CLI default; no
`supabase/config.toml`). **"ms"** = wall time of the HTTP round trip on loopback measured by
`scripts/measure-library-284.py` (the backend emits no Server-Timing header — this is the honest
proxy, labelled as such); 5 runs per surface, median and max. The browser-rendered Library load time
is the G-4 drive's (284-05), not this table's.

**The seed as built** (`scripts/seed-scale-284.py`, deterministic `random.Random(284)` + `uuid5` ids):
owner `scale284@example.com` (org-admin) and peer `scale284-b@example.com` (member, owns 0) in ONE org
`Scale 284` (`567f87e8-d78b-5ea1-a89a-66fb11981a6b`).

| size | Root | Big | small folders | Shared 284 (org-shared) | owner latest | older versions | archived | processing | failed (429) | tables / images | 2,500-chunk doc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10,000 | 6,000 | 3,000 | 10 × 100 | **+20** | **10,020** | 200 | 300 | 300 | 25 (5) | 500 / 500 | 1 |
| 50,000 | 30,000 | 10,000 | 20 × 500 | **+20** | **50,020** | 200 | 300 | 300 | 25 (5) | 500 / 500 | 1 |

**Triggers on `public.documents` (all kept enabled — none enqueues external work):**
`documents_autofill_org_id` (no-op: org_id supplied), `documents_hold_identity_guard`,
`documents_inherit_family_archive` (BEFORE INSERT, one indexed lookup per row),
`documents_protect_archive_state`, `documents_refuse_held_delete`, `documents_refuse_truncate`,
`documents_sticky_hold_on_move`. `retrievable` is a GENERATED column (mig 205), so COPY omits it.
Seed time: 10k ≈ 4.6 s, 50k ≈ 9.4 s (COPY in batches of 5,000, then `VACUUM (ANALYZE)`).

**Reading the BEFORE tables.** The base API has no folder or paging parameters: the Library downloads
the `GET /documents` array and derives Root, folder totals and the page slice in the browser. So the
"Root" and "Big" rows re-measure the same request and report the count the BROWSER can derive from
it. Every one is cut at 1,000 rows by PostgREST's `max_rows`: 10,020 documents read as 1,000; Root
6,000 → 592; Big 3,000 → 294 (and at 50k: 50,020 → 1,000, Root 30,000 → 579, Big 10,000 → 193).
Find's total IS exact at base (it walks every candidate in 1,000-row pages) — and pays for it: page 1
costs **1.0 s at 10k and 16.9 s at 50k**.

## BEFORE

### BEFORE — 10,000 seeded (+20 shared = 10,020 owner latest)

Measured 2026-10-15T23:31:37.021004+00:00 against `http://127.0.0.1:8000`. Provenance: `{"worktree_head": "f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "plan_base": "f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "main_checkout_head": "refs/heads/develop @ f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "tracked_backend_files_compared": 1318, "identical": true}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 10020, "root_latest_all": 6000, "root_latest_unarchived": 5816, "big_latest_all": 3000, "big_latest_unarchived": 2918, "owner_latest_unarchived": 9720, "legacy_visible_latest": 10020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents (whole list) | 200 | 1,065,537 | 435.1 | 462.5 | 1000 | 1000 | 10020 | **NO** |
| Root total as the Library derives it (array, folder_id null) | 200 | 1,065,537 | 321.9 | 439.6 | 1000 | 592 | 6000 | **NO** |
| Big folder total as the Library derives it (array, folder_id = Big) | 200 | 1,065,537 | 499.2 | 834.3 | 1000 | 294 | 3000 | **NO** |
| Picker read (whole list, as CreateLink/LegalHold/Takeoff download it) | 200 | 1,065,537 | 361.2 | 551.2 | 1000 | 1000 | 10020 | **NO** |
| POST /document-search page 1 (limit 25) | 200 | 27,524 | 1038.2 | 1117.1 | 25 | 9720 | 9720 | yes |
| Library open request set (GET /documents + GET /folders, parallel) | 200/200 | 1,068,390 | 349.7 | 459.8 | — | — | — | — |

### BEFORE — 50,000 seeded (+20 shared = 50,020 owner latest)

Measured 2026-10-15T23:33:43.383917+00:00 against `http://127.0.0.1:8000`. Provenance: `{"worktree_head": "f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "plan_base": "f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "main_checkout_head": "refs/heads/develop @ f8659ac2d56f8cf3b93174e1ee834f383eb192c6", "tracked_backend_files_compared": 1318, "identical": true}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50020, "root_latest_all": 30000, "root_latest_unarchived": 29808, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49720, "legacy_visible_latest": 50020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents (whole list) | 200 | 1,064,078 | 458.2 | 766.0 | 1000 | 1000 | 50020 | **NO** |
| Root total as the Library derives it (array, folder_id null) | 200 | 1,064,078 | 405.5 | 562.2 | 1000 | 579 | 30000 | **NO** |
| Big folder total as the Library derives it (array, folder_id = Big) | 200 | 1,064,078 | 278.1 | 341.0 | 1000 | 193 | 10000 | **NO** |
| Picker read (whole list, as CreateLink/LegalHold/Takeoff download it) | 200 | 1,064,078 | 429.5 | 645.9 | 1000 | 1000 | 50020 | **NO** |
| POST /document-search page 1 (limit 25) | 200 | 27,491 | 16869.2 | 18243.5 | 25 | 49720 | 49720 | yes |
| Library open request set (GET /documents + GET /folders, parallel) | 200/200 | 1,069,311 | 348.6 | 553.6 | — | — | — | — |

## EXPLAIN (migration 207)

Run after the first apply of 207, at **50,000 + 20** seeded, as `authenticated` with the owner's claims
(`_apply_rls_user_context` — RLS on, so the plans include the documents policy's per-row filter),
`EXPLAIN (ANALYZE, BUFFERS)`, local Postgres 17.6, after `VACUUM (ANALYZE)`. Top lines and timings,
verbatim:

| query | top node | rows scanned | buffers | execution time |
|---|---|---|---|---|
| Root page 1 (`is_latest AND folder_id IS NULL AND archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 25`) | `Limit` ← `Sort` (top-N heapsort, 28 kB) | 29,808 | shared hit=3,052 | **32.9 ms** |
| Root `count(*)` (same predicate) | `Aggregate` ← `Bitmap Heap Scan on documents d` | 29,808 | shared hit=2,949 | **27.0 ms** |
| Big LAST page (`folder_id = Big AND archived_at IS NULL … LIMIT 25 OFFSET 9925`, selecting `version_count, has_earlier` too) | `Limit` ← `Result` ← `Sort` | 9,948 | shared hit=81,960 | **65.7 ms** |
| Big `count(*)` | `Aggregate` ← `Bitmap Heap Scan` (`Recheck Cond: folder_id = …`) | 9,948 | shared hit=2,294 | **9.3 ms** |
| All latest `count(*)` | `Aggregate` ← `Bitmap Heap Scan` | 50,020 | shared hit=3,010 | **36.7 ms** |
| `GET /library/summary` SQL (`LIBRARY_SUMMARY_SQL`) | `MixedAggregate` (hash keys folder_id · status,step · status · connection · doc_type; group key `()`) | 50,020 → 40 groups | — | **69.4 ms** |

**Index decision: no index.** Every plan is under 70 ms at 50k, far inside the D-22 500 ms bar, so
migration 207 carries no index (D-19 "only if needed"). Recorded for whoever reads these later:

- The count is a `Bitmap Heap Scan` over every visible row (Pitfall 2's warning sign) — it is O(n) and
  costs ~27-37 ms at 50k. It is not the dominant cost and does not threaten 500 ms; a covering partial
  index would buy little here and is deferred until a measurement says otherwise.
- The Big LAST page selecting `version_count` / `has_earlier` shows those correlated subqueries are
  evaluated for **every row the OFFSET skips** (the `Result` node above the `Sort` processes 9,948
  rows; 81,960 buffer hits vs ~2-3k for the plain reads). Postgres postpones them past the sort but
  not past the offset. Still 65.7 ms here — but `GET /documents` does NOT select them (its
  `LIST_SELECT` names neither), so this cost lands only on a caller that asks for them (Find, 284-04).

### AFTER — 50,000 seeded (+20 shared = 50,020 owner latest)

Measured 2026-10-16T03:29:12.530631+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50020, "root_latest_all": 30000, "root_latest_unarchived": 29808, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49720, "legacy_visible_latest": 50020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,538 | 470.7 | 481.9 | 25 | 29808 | 29808 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,208 | 192.9 | 196.8 | 25 | 9948 | 9948 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 24,886 | 189.0 | 195.8 | 23 | 9948 | 9948 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,966 | 499.4 | 515.7 | 25 | 49720 | 49720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,569 | 492.8 | 496.7 | 20 | 49720 | 49720 | yes |
| GET /library/summary | 200 | 2,557 | 122.6 | 162.0 | — | 50020 | 50020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 34,328 | 483.1 | 489.5 | — | — | — | — |

### AFTER — 50,000 seeded (+20 shared = 50,021 owner latest)

Measured 2026-10-16T04:01:33.720466+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50021, "root_latest_all": 30001, "root_latest_unarchived": 29809, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49721, "legacy_visible_latest": 50021}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,948 | 622.6 | 706.6 | 25 | 29809 | 29809 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,208 | 289.7 | 311.2 | 25 | 9948 | 9948 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 24,886 | 298.6 | 312.0 | 23 | 9948 | 9948 | yes |
| POST /document-search page 1 (limit 25) | 200 | 27,441 | 696.7 | 761.4 | 25 | 49721 | 49721 | yes |
| Picker read (POST /document-search limit 20) | 200 | 22,011 | 698.7 | 726.0 | 20 | 49721 | 49721 | yes |
| GET /library/summary | 200 | 2,590 | 167.9 | 172.8 | — | 50021 | 50021 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 34,771 | 754.8 | 904.3 | — | — | — | — |

### AFTER — 50,000 seeded (+20 shared = 50,021 owner latest)

Measured 2026-10-16T04:03:59.443306+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50021, "root_latest_all": 30001, "root_latest_unarchived": 29809, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49721, "legacy_visible_latest": 50021}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,948 | 679.9 | 741.6 | 25 | 29809 | 29809 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,208 | 276.4 | 290.1 | 25 | 9948 | 9948 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 24,886 | 292.7 | 357.4 | 23 | 9948 | 9948 | yes |
| POST /document-search page 1 (limit 25) | 200 | 27,441 | 660.2 | 695.3 | 25 | 49721 | 49721 | yes |
| Picker read (POST /document-search limit 20) | 200 | 22,011 | 687.3 | 718.0 | 20 | 49721 | 49721 | yes |
| GET /library/summary | 200 | 2,590 | 150.2 | 151.9 | — | 50021 | 50021 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 34,771 | 679.4 | 757.0 | — | — | — | — |

### AFTER — 10,000 seeded (+20 shared = 10,020 owner latest)

Measured 2026-10-16T04:04:55.498367+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 10020, "root_latest_all": 6000, "root_latest_unarchived": 5816, "big_latest_all": 3000, "big_latest_unarchived": 2918, "owner_latest_unarchived": 9720, "legacy_visible_latest": 10020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,409 | 185.6 | 214.2 | 25 | 5816 | 5816 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,328 | 133.1 | 138.5 | 25 | 2918 | 2918 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 19,666 | 136.4 | 145.9 | 18 | 2918 | 2918 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,999 | 192.8 | 197.5 | 25 | 9720 | 9720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,568 | 191.5 | 213.2 | 20 | 9720 | 9720 | yes |
| GET /library/summary | 200 | 1,642 | 84.3 | 89.2 | — | 10020 | 10020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 30,904 | 225.8 | 232.3 | — | — | — | — |

## AFTER — provenance and run conditions (orchestrator, 284-05 Task 3, 2026-10-16)

- Served code: the operator's uvicorn on :8000 runs `--reload`; its worker respawned at 06:12:57 local, 11 s after the wave-2 merge `e741f56bd`, so every AFTER figure is the merged tree (284-05's own commits after it touch tests, docs and frontend only).
- Run 1 at 50k (03:29 UTC) was taken on a quiet host. Runs 2 and 3 at 50k (03:5x / 04:0x UTC) and the 10k run (04:04 UTC) were taken while an unrelated IDE process held about one core (host CPU 30-39%, measured with `Get-Counter`; top process "Antigravity IDE" at ~1 CPU-s/s). Runs 2-3 read ~1.4x slower than run 1 on EVERY surface, including the summary and Big, which is host contention, not the code. All four runs are kept above, unedited.
- The 50k account gained one document between run 1 and run 2 (the G-4 D upload), which is why later tables read 50,021 / 29,809.

## AFTER — verdict per D-22 criterion

| D-22 criterion | 10k | 50k | Verdict |
|---|---|---|---|
| Every reported total equals `count(*)` | 6 of 6 surfaces `yes` | 6 of 6 surfaces `yes`, all three runs | **MET** (BEFORE: 4 of 5 surfaces **NO** at both sizes) |
| First-page BYTES at 50k within 1.5x of 10k | Root 26,409 · Big 27,328 · Find 26,999 | Root 26,538 · Big 27,208 · Find 26,966 | **MET** — flat (1.00x). BEFORE: 1,064,078 bytes per Library open |
| First-page TIME at 50k within 1.5x of 10k | Root 185.6 · Big 133.1 / last 136.4 · Find 192.8 · summary 84.3 ms | quiet run 1: Root 470.7 · Big 192.9 / last 189.0 · Find 499.4 · summary 122.6 ms | **PARTIAL** — Big first/last 1.45x / 1.39x and summary 1.45x MET; **Root 2.54x and Find 2.59x MISSED** |
| First page < 500 ms at 50k | — | Root 470.7 (run 1) · 622.6 / 679.9 (contended runs 2-3) | **MET on a quiet host, MISSED under contention** |
| Summary < 500 ms at 50k | — | 122.6 / 167.9 / 150.2 | **MET** |

**Cause of the two time misses (measured, not inferred).** Both are the surfaces whose exact total is a `count(*)` over the whole matched set (Root 29,808; Find 49,720), and whose top-25 page is chosen by sorting that same set. As `authenticated` at 10k, `EXPLAIN ANALYZE` of the Root count is a Bitmap Heap Scan over **every latest row the user owns** (10,020 visited, 4,204 removed by filter), then the RLS / view predicate per row: count 25.2 ms, page 22.8 ms in SQL against 185.6 ms through the API. Both are linear in the library size by construction: an exact count cannot be sub-linear, and the page has no index matching `(user_id, folder_id IS NULL, created_at DESC)` under `is_latest`. Big's page and the summary stay flat because Big's predicate is selective on an indexed `folder_id`, and the summary is one GROUPING SETS read. 284-04 separately recorded ~250 ms of API-layer handling around an exact count at 50k against ~40 ms for the same count in SQL. **Not fixed in this phase**: making Root's page flat needs a new index (a migration and another production step), which is new scope in a checkpoint. The fix is recorded as a seed (see 284-LIVE-EVIDENCE.md §Owed).

**Find before / after at 50k: 16,869 ms → 499.4 ms (quiet) for page 1 (34x).** Deep pages are linear in the offset: `POST /document-search` at offset 49,700 measured 1,444 ms (contended).

**Browser render time is not a D-22 figure.** In the Vite dev build, the Library open at 50k showed its rows ~3.2 s after the click while every API response had landed by ~1.9 s. A performance trace (`trace_library_open_50k.json`, evidence dir) puts most of the main-thread time in React's DEV instrumentation (`performance.measure` 2,610 ms self, JSX dev validation, StrictMode double render); the app's own components total about 0.8 s inclusive under the trace. Not measured on a production build.

## SEED-357 — where the 50k time goes

284-06 Task 1, 2026-10-16 (local, PLAN_BASE `59a0337fb`, migration 207 applied, no 208). Host CPU
before the capture: 16.1 / 18.1 / 7.6 % (`typeperf "\Processor(_Total)\% Processor Time"`, the same
counter as `Get-Counter`; PowerShell is not runnable from this executor).

**Method.** `pg_stat_statements` is preloaded locally. The capture snapshots it, makes 5 real API
calls against the operator's backend on :8000 as the scale owner, snapshots again, and diffs per
`queryid` (no reset, so other sessions' stats are untouched). Then each captured statement is run
again by hand, with EXPLAIN (ANALYZE, BUFFERS), as `authenticated`, with `request.jwt.claims` set to
the decoded payload of a real GoTrue access token (443 bytes). That is the one claims GUC PostgREST
14 sets. Full plans: `measurements/284-06-explain-before-{10000,50000}.txt`.

**Where it goes (statement level).** Each request runs exactly one SQL statement that matters (plus
PostgREST's 0.02 ms `set_config` preamble):

| size | surface | HTTP median | that one statement (`pg_stat_statements` mean) | everything else |
|---|---|---|---|---|
| 10,020 | Root page 1 | 135.3 ms | 89.8 ms | 45.5 ms |
| 10,020 | Find page 1 | 154.7 ms | 97.4 ms | 57.3 ms |
| 50,020 | Root page 1 | 445.6 ms | **407.9 ms** | 37.7 ms |
| 50,020 | Find page 1 | 465.7 ms | **417.2 ms** | 48.5 ms |

The API side is flat at roughly 40-60 ms. **All of the growth is inside the one statement**
(SQL 4.54x / 4.28x from 10k to 50k). So "~250 ms of API-side handling" (284-04) is refuted: that
time is in Postgres, and the earlier EXPLAINs could not see it, for the reason under cause 2 below.

**The statement.** PostgREST sends one CTE statement: `pgrst_source` (the page: select list,
embeds, ORDER BY, LIMIT 25) and `pgrst_source_count` (`SELECT 1 FROM library_documents WHERE …`,
the exact count). Two causes, both linear in the library:

1. **The page has no ordered path, and the embeds run for every row.** The view's
   `user_id = auth.uid() OR folder_id IN (shared folders not own)` can only be served by a BitmapOr.
   That has no order, so the planner sorts the whole matched set. Root's `document_tables(count)` /
   `document_images(count)` embeds are LEFT JOIN LATERALs *below* that sort. At 50k they ran
   **29,808 loops each** (157 ms of the 209 ms page). For Root, the LIST_SELECT comment ("the two
   embedded counts are evaluated for the PAGE only") was false. Find selects no embeds, and its
   `version_count` / `has_earlier` already run after the sort (25 loops). Its page cost is the
   bitmap heap scan plus the sort.
2. **`auth.uid()` is evaluated per row and re-parses the whole JWT each time.** The documents
   SELECT policy (migration 154) calls `auth.uid()` bare, so it is inlined into the per-row filter.
   PostgREST sets only `request.jwt.claims`, so every evaluation casts 443 bytes of JSON to jsonb.
   The same statement with a 45-byte claims blob runs 302 / 175 ms (Root / Find, 50k). With the full
   token it runs **494 / 474 ms** (EXPLAIN ANALYZE; 396 / 435 ms un-instrumented, which matches
   `pg_stat_statements`). The exact count alone costs **138 ms (Root) / 223 ms (Find)** at 50k
   (~4.5 µs/row).
   ⚠ **Why the 207 EXPLAIN above read 27-37 ms for the same count:** its own text says it ran under
   `_apply_rls_user_context`, which also sets `request.jwt.claim.sub`. That is the first,
   parse-free branch of `auth.uid()`'s COALESCE, so the measurement took a path PostgREST never
   takes. The 284-05 verdict's 10k figures (count 25.2 ms, page 22.8 ms) match that path, not
   PostgREST's: measured here at 10k, PostgREST's statement is 89.8 ms.

| 50,020 · `authenticated` + real token claims | top node | rows | execution |
|---|---|---|---|
| Root, full PostgREST statement | `Aggregate` ← `Limit` ← `Sort` (top-N) ← 2 × `Nested Loop Left Join` ← `Bitmap Heap Scan on documents` (BitmapOr) | 29,808 + 2 × 29,808 lateral loops | **494.4 ms** |
| Root count CTE | `Bitmap Heap Scan on documents` (BitmapOr; 20,412 removed by filter) | 29,808 | 138.2 ms |
| Find, full PostgREST statement | `Aggregate` ← `Limit` ← `Result` ← `Sort` ← `Bitmap Heap Scan` (BitmapOr) | 49,720 | **473.9 ms** |
| Find count CTE | `Bitmap Heap Scan on documents` (BitmapOr) | 49,720 | 223.0 ms |

At 10,020 the same four read 92.2 / 27.0 / 96.3 / 42.9 ms.

**What it takes to make page 1 flat.** Each piece was measured in a rolled-back transaction at 50k,
as `authenticated` with the real claims:

| change | Root statement | Find statement |
|---|---|---|
| none (base, 207) | 494 ms | 474 ms |
| index `(user_id, …, created_at DESC, id DESC)` only, view unchanged | 429 ms | 437 ms — the OR still forces a BitmapOr, so the index is not walked in order |
| + a naive `UNION ALL` of the two legs | 466 ms | 956 ms (worse: each leg is planned as a separate subquery, so the version subqueries run for 49,720 rows) |
| documents policy `auth.uid()` → `(SELECT auth.uid())` only | 211 ms | 72 ms |
| the UNION ALL view (first candidate) + the Root/Find indexes, policy unchanged | 126 ms (page 0.9 ms) | 212 ms (page 1.1 ms, Merge Append) |
| **all three (first candidate; the shipped 208 adds the `o.id` join + a folder index, see AFTER (208))** | **15.0 ms** (page 0.7 ms) | **25.4 ms** (page 1.2 ms) |

**Why a naive UNION ALL does not work (Postgres 17.6, measured).** A UNION ALL leg with a WHERE
clause cannot be flattened into an appendrel (`is_safe_append_member`: "the child can't have any
WHERE quals"). It is planned as an isolated subquery that never sees the outer ORDER BY, so no
Merge Append is possible. The working shape has no WHERE in either leg, a constant discriminator
column `leg`, and every predicate in the outer WHERE. Postgres pushes that WHERE into each
appendrel child and const-folds it per leg (`leg = 1` folds the shared arm away). The own leg's
`user_id = (SELECT auth.uid())` must also reach the child's index pathkeys as an *equivalence
class*, and a child-only qual never forms one. So both legs expose `scope_key` (leg 1:
`d.user_id`, leg 2: `auth.uid()`), and the outer `scope_key = (SELECT auth.uid())` is one
parent-level equality that makes the index's leading `user_id` redundant for ordering.

**RED** (`backend/tests/integration/test_284_page_index_live.py`, 8 failed at both sizes, before 208):
```
50,020:
E   AssertionError: root page 1 (custom plan) visits the library (50020 latest documents): nodes producing > 100 rows:
E       /Limit/Sort/Nested Loop/Nested Loop/Bitmap Heap Scan[documents]: 29808 rows x 1 loops
E       /Limit/Sort/Nested Loop/Nested Loop/Aggregate: 1 rows x 29808 loops          (the embed, per row)
E   AssertionError: root page 1 (generic plan) visits the library …  (same)
E   AssertionError: find page 1 (custom plan) visits the library (50020 latest documents): nodes producing > 100 rows:
E       /Limit/Result/Sort/Bitmap Heap Scan[documents]: 49720 rows x 1 loops
E   AssertionError: find page 1 (generic plan) visits the library …  (same)
E   AssertionError: root page 1 took 279.2 ms as authenticated (PostgREST claims) at 50020 latest documents; the bound is 20.0 ms at any size
E   AssertionError: find page 1 took 233.0 ms … the bound is 20.0 ms at any size
E   AssertionError: root: the full PostgREST statement (page + exact count over 29808 rows) took 413.9 ms; the bound is 89.6 ms (30 ms + 2 µs/row)
E   AssertionError: find: the full PostgREST statement (page + exact count over 49720 rows) took 440.2 ms; the bound is 129.4 ms (30 ms + 2 µs/row)
8 failed
10,020: the same 8 fail — Root scans 5,816, Find 9,720; page 64.1 / 51.6 ms; statement 89.5 / 92.4 ms
        against bounds of 41.6 / 49.4 ms.
```

## AFTER (208) — 10k / 50k

284-06 Task 3, 2026-10-16. Migration 208 applied to the local DB; **no backend code changed in 284-06**, so the operator's backend on :8000 (main checkout, `--reload`) serves exactly the code these figures belong to, and only the DB differs from the 284-05 AFTER tables above. Host CPU (`typeperf`) is recorded before each run.

- 50k run: host CPU 15.0 / 15.8 / 12.1 %.

### AFTER (208) — 50,000 seeded (+20 shared = 50,020 owner latest)

Measured 2026-10-16T06:08:42.334839+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50020, "root_latest_all": 30000, "root_latest_unarchived": 29808, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49720, "legacy_visible_latest": 50020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,538 | 55.6 | 64.4 | 25 | 29808 | 29808 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,208 | 49.0 | 51.7 | 25 | 9948 | 9948 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 24,886 | 126.1 | 136.3 | 23 | 9948 | 9948 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,966 | 67.2 | 77.4 | 25 | 49720 | 49720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,569 | 75.8 | 87.7 | 20 | 49720 | 49720 | yes |
| GET /library/summary | 200 | 2,557 | 88.1 | 95.2 | — | 50020 | 50020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 34,328 | 109.8 | 181.8 | — | — | — | — |

- 10k run: host CPU 18.3 / 20.6 / 17.4 % right after the reseed; re-sampled over 24 s at 8.2-19.1 % (median 12.0 %) and measured immediately after.

### AFTER (208) — 10,000 seeded (+20 shared = 10,020 owner latest)

Measured 2026-10-16T06:10:02.038999+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 10020, "root_latest_all": 6000, "root_latest_unarchived": 5816, "big_latest_all": 3000, "big_latest_unarchived": 2918, "owner_latest_unarchived": 9720, "legacy_visible_latest": 10020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,409 | 45.1 | 52.9 | 25 | 5816 | 5816 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,328 | 44.5 | 46.9 | 25 | 2918 | 2918 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 19,666 | 69.1 | 79.6 | 18 | 2918 | 2918 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,999 | 47.4 | 58.8 | 25 | 9720 | 9720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,568 | 47.0 | 49.0 | 20 | 9720 | 9720 | yes |
| GET /library/summary | 200 | 1,642 | 45.7 | 48.7 | — | 10020 | 10020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 30,904 | 62.8 | 69.4 | — | — | — | — |

#### Run 2 (stability check, same code and DB)

- 50k run 2: host CPU 21.4 / 19.4 / 17.2 / 17.0 % (the seed had just finished).

### AFTER (208) run 2 — 50,000 seeded (+20 shared = 50,020 owner latest)

Measured 2026-10-16T06:31:16.079962+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 50020, "root_latest_all": 30000, "root_latest_unarchived": 29808, "big_latest_all": 10000, "big_latest_unarchived": 9948, "owner_latest_unarchived": 49720, "legacy_visible_latest": 50020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,538 | 74.6 | 83.8 | 25 | 29808 | 29808 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,208 | 48.1 | 48.7 | 25 | 9948 | 9948 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 24,886 | 122.8 | 133.6 | 23 | 9948 | 9948 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,966 | 77.7 | 92.9 | 25 | 49720 | 49720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,569 | 62.9 | 77.1 | 20 | 49720 | 49720 | yes |
| GET /library/summary | 200 | 2,557 | 88.0 | 92.2 | — | 50020 | 50020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 34,328 | 109.8 | 175.7 | — | — | — | — |

- 10k run 2: host CPU 16.6 / 14.3 / 10.9 %.

### AFTER (208) run 2 — 10,000 seeded (+20 shared = 10,020 owner latest)

Measured 2026-10-16T06:33:49.315837+00:00 against `http://127.0.0.1:8000`. Provenance: `{"plan_base": null}`.
Ground truth (asyncpg as postgres): `{"big_folder_id": "ea595fbd-6880-5816-a543-c6eab092279c", "owner_latest_all": 10020, "root_latest_all": 6000, "root_latest_unarchived": 5816, "big_latest_all": 3000, "big_latest_unarchived": 2918, "owner_latest_unarchived": 9720, "legacy_visible_latest": 10020}`

| surface | status | bytes | median ms | max ms | rows | reported total | DB count(*) | equal? |
|---|---|---|---|---|---|---|---|---|
| GET /documents Root page 1 (limit 25) | 200 | 26,409 | 54.2 | 57.5 | 25 | 5816 | 5816 | yes |
| GET /documents Big page 1 (limit 25) | 200 | 27,328 | 56.7 | 57.7 | 25 | 2918 | 2918 | yes |
| GET /documents Big LAST page (limit 25) | 200 | 19,666 | 75.8 | 80.3 | 18 | 2918 | 2918 | yes |
| POST /document-search page 1 (limit 25) | 200 | 26,999 | 49.5 | 50.7 | 25 | 9720 | 9720 | yes |
| Picker read (POST /document-search limit 20) | 200 | 21,568 | 47.9 | 49.0 | 20 | 9720 | 9720 | yes |
| GET /library/summary | 200 | 1,642 | 47.5 | 50.4 | — | 10020 | 10020 | yes |
| Library open request set (Root page + summary + folders, parallel) | 200/200/200 | 30,904 | 68.3 | 108.7 | — | — | — | — |

### AFTER (208) — statement level (the primary evidence)

`pg_stat_statements` diff around real API calls (as in "SEED-357 — where the 50k time goes").
"SQL" is the mean execution time of the ONE PostgREST statement per request. The statement time
is what 208 changes. It is far less sensitive to host load than the HTTP time.

| size | surface | BEFORE HTTP / SQL | AFTER HTTP / SQL (each capture: 5-9 calls) |
|---|---|---|---|
| 10,020 | Root page 1 | 135.3 / 89.8 ms | 42.8 / 3.59 · 59.8 / 3.88 · 48.0 / 3.60 · 52.1 / 3.49 · 55.9 / 3.45 |
| 10,020 | Find page 1 | 154.7 / 97.4 ms | 48.0 / 5.69 · 66.7 / 6.31 · 55.9 / 6.08 · 53.5 / 6.34 · 62.1 / 5.92 |
| 50,020 | Root page 1 | 445.6 / 407.9 ms | 54.0 / 13.51 · 59.5 / 14.85 · 54.6 / 13.43 · 64.5 / 15.62 · 63.1 / 15.40 |
| 50,020 | Find page 1 | 465.7 / 417.2 ms | 64.0 / 20.31 · 75.6 / 20.39 · 79.5 / 21.57 · 71.7 / 22.45 · 81.2 / 23.60 |

EXPLAIN (ANALYZE, BUFFERS) of the exact statement, as `authenticated` with a real token's claims.
Full plans: `measurements/284-06-explain-{before,after}-{10000,50000}.txt`.

| statement | 10k BEFORE | 50k BEFORE | 10k AFTER | 50k AFTER | AFTER ratio |
|---|---|---|---|---|---|
| Root: whole statement | 92.2 ms | 494.4 ms | 3.80 ms | 14.9 ms (generic plan 14.0) | 3.9x |
| Root: the page (`Limit` node) | 66.0 ms | 355.8 ms | **0.82 ms** | **1.10 ms** | **1.34x** |
| Root: the exact count (InitPlan) | 25.8 ms | 138.3 ms | 2.60 ms | 13.5 ms | 5.2x |
| Find: whole statement | 96.3 ms | 473.9 ms | 6.71 ms | 24.3 ms (generic plan 25.9) | 3.6x |
| Find: the page (`Limit` node) | 52.3 ms | 250.5 ms | **1.22 ms** | **1.22 ms** | **1.00x** |
| Find: the exact count (InitPlan) | 43.2 ms | 222.7 ms | 5.10 ms | 22.7 ms | 4.5x |

Plan shape AFTER (50k). Root: `Limit` ← `Incremental Sort` (presorted `created_at`) ← the
embeds and the `documents_pkey` probe for `o.id` ← `Index Scan using
documents_library_root_created_idx` (26 rows). Find: `Limit` ← `Incremental Sort` ← the `o.id`
probe ← `Merge Append` (26 rows) of `Index Scan using documents_library_added_idx` and the shared
leg's sort (0 rows for the owner). The count CTE is a Bitmap Heap Scan via the same index over the
caller's rows, and its LEFT JOIN is removed. Under a forced generic plan the shapes are the same
(`test_284_page_index_live.py` checks both).

**So the page is flat, and the remaining growth is the exact count.** It is linear by
construction: FIX-11 keeps the total exact, so every matched row is counted. It now costs
~0.45 µs/row (Root 13.5 ms over 29,808 rows, Find 22.7 ms over 49,720), down from ~4.5 µs/row.
Measured headroom not taken: wrapping `current_setting('app.agent_read')` in the 205 restrictive
policy the same way saves only 10-15 % of the count (rolled-back test). A second policy change is
not worth that.

### AFTER (208) — paired HTTP ratios (10k and 50k measured close together, same host conditions)

| pair | when (local) | Root page 1 | Find page 1 | Big page 1 | summary |
|---|---|---|---|---|---|
| measure run 1 | 10:08 / 10:10 | 55.6 / 45.1 = **1.23x** | 67.2 / 47.4 = **1.42x** | 49.0 / 44.5 = 1.10x | 88.1 / 45.7 = 1.93x |
| capture A | 10:08 / 10:10 | 54.0 / 42.8 = **1.26x** | 64.0 / 48.0 = **1.33x** | — | — |
| capture B (4 × 9 calls each, medians) | 10:31-32 / 10:33 | 61.3 / 54.0 = **1.14x** | 77.6 / 59.0 = **1.32x** | — | — |
| measure run 2 | 10:31 / 10:33 | 74.6 / 54.2 = **1.38x** | 77.7 / 49.5 = **1.57x** | 48.1 / 56.7 = 0.85x | 88.0 / 47.5 = 1.85x |

The HTTP figure is ~40-55 ms of request handling outside Postgres, plus the statement. That
handling is the same work at both sizes (one statement, a 26 KB body, planning 1.5-2.0 ms at
both), but it swings ±10 ms with host load. Find's statement grows by ~15 ms from 10k to 50k.
That is the same size as the swing, so Find's HTTP ratio reads 1.32-1.57x depending on the pair.
The 1.57x pair's 50k half ran right after a reseed at 17-21 % CPU (other samples 9-16 %). Its own
statement time was 20.4 ms, the same as every other 50k capture, so the extra ~10 ms is outside
Postgres.

## AFTER (208) — verdict per D-22 criterion

| D-22 criterion | Verdict (208) | Evidence |
|---|---|---|
| Every reported total equals `count(*)` | **MET** | 7 of 7 surfaces `yes` at both sizes, both runs |
| First-page BYTES at 50k within 1.5x of 10k | **MET** (unchanged, 1.00x) | Root 26,538 / 26,409 · Find 26,966 / 26,999 |
| First-page TIME at 50k within 1.5x — **Root** | **MET** | HTTP 1.14-1.38x across four pairs (284-05: 2.54x). SQL page node 1.34x |
| First-page TIME at 50k within 1.5x — **Find** | **MET in 3 of 4 pairs** (1.32x · 1.33x · 1.42x); **1.57x in 1** | 284-05: 2.59x. SQL page node 1.00x. The 1.57x is host-side (statement 20.4 ms, as in every pair) |
| First-page TIME — Big folder page 1 | **MET** | 0.85-1.10x (284-05: 1.45x). It now uses `documents_library_folder_created_idx` |
| First page < 500 ms at 50k | **MET** | Root 54-75 ms, Find 64-81 ms (284-05: 470.7 / 499.4 quiet, 622-697 contended) |
| Summary < 500 ms at 50k | **MET** | 88.0 / 88.1 ms |
| Summary TIME within 1.5x | **MISSED: 1.85x / 1.93x** | The 284-05 verdict listed the summary under first-page time at 1.45x, against a 10k figure taken under contention (84.3 ms). On a quiet host the summary reads 45.7-47.5 ms at 10k and 88 ms at 50k. It is an exact GROUPING SETS aggregate over every visible row, so it is linear by construction, and 208 did not target it. Its SQL on the 208 view is 62-80 ms at 50k, against 55-60 ms on 207's view (rolled-back comparison): the UNION ALL costs it ~10-20 % |
| Deep page (Big LAST page, offset 9,925) | not a D-22 first-page figure; 1.62-1.82x | 69.1-75.8 → 122.8-126.1 ms, linear in the OFFSET (the walk must skip the offset rows) |

**Not fixed, and recorded rather than rounded.** First, the summary ratio, which needs a
maintained counter or a cached summary, not an index. Second, any list whose filter has no
matching index. These are IngestionTab's status lists, the `kind=spreadsheet` read, the
unfiltered GET /documents, and Find sorted by anything but `added_desc`. The policy wrap roughly
halves their statement time, but their page is still a full sort.


## WR-R2-02 — the documents SELECT policy, 154 vs 208 (2026-10-16, 284-REVIEW-FIX-R2)

What it covers: ONE rolled-back transaction (`scripts/apply_migration_208.py --parity-policy`). It
installs 154's policy, then 208's (each confirmed by its deparsed text). For every user in
`auth.users`, plus a no-uid caller, it reads the documents **TABLE** (row count + md5 of the sorted
ids) and the view. It reads as `authenticated` with `request.jwt.claims` ONLY
(`request.jwt.claim.sub` is empty, which is PostgREST's branch of `auth.uid()`), with
`app.agent_read` off and on. There are two data states: as-is, and "widened". Widened means,
inside the same transaction, every connection document set to `ingest_visibility = 'org'` and 60
documents set to `source_state = 'missing_at_source'`, so the generated `retrievable` is false. In
the as-is data no local row is reachable through the connection arm (all 179 connection documents
are `private`), which is why the widened state exists. Nothing was committed, and the live policy
reads 208's text afterwards.

### 325 documents (scale account not seeded)

```
STATE as-is: arms over (member, document) pairs: {'connection_arm_only': 0, 'shared_folder_arm': 109, 'own_arm': 325, 'not_retrievable_member_rows': 10}
WIDENED (inside the transaction): 179 connection documents -> ingest_visibility 'org'; 60 documents -> source_state 'missing_at_source' (retrievable is GENERATED, so this makes it false)
STATE widened: arms over (member, document) pairs: {'connection_arm_only': 696, 'shared_folder_arm': 109, 'own_arm': 325, 'not_retrievable_member_rows': 288}
PARITY — documents TABLE and library_documents VIEW, policy 154 vs policy 208:
  state=as-is    agent_read=off  callers=42 (incl. <no uid>)  table rows Σ=   434  view rows Σ=   434  table same=42/42  view same=42/42
  state=as-is    agent_read=on   callers=42 (incl. <no uid>)  table rows Σ=   432  view rows Σ=   432  table same=42/42  view same=42/42
  state=as-is    agent_read on vs off changes the table for 1 caller(s)
  state=widened  agent_read=off  callers=42 (incl. <no uid>)  table rows Σ=  1130  view rows Σ=   434  table same=42/42  view same=42/42
  state=widened  agent_read=on   callers=42 (incl. <no uid>)  table rows Σ=   918  view rows Σ=   354  table same=42/42  view same=42/42
  state=widened  agent_read on vs off changes the table for 12 caller(s)
rolled back; live policy == 208's again: True
PARITY PROVED — for all 41 users and a no-uid caller, in both data states, with app.agent_read off and on, policy 154 and policy 208 admit the SAME documents rows (count + md5 of sorted ids) and the SAME view rows.
```

### 50,545 documents (scale account at 50k)

```
STATE as-is: arms over (member, document) pairs: {'connection_arm_only': 0, 'shared_folder_arm': 129, 'own_arm': 50545, 'not_retrievable_member_rows': 610}
WIDENED (inside the transaction): 179 connection documents -> ingest_visibility 'org'; 60 documents -> source_state 'missing_at_source' (retrievable is GENERATED, so this makes it false)
STATE widened: arms over (member, document) pairs: {'connection_arm_only': 696, 'shared_folder_arm': 129, 'own_arm': 50545, 'not_retrievable_member_rows': 730}
PARITY — documents TABLE and library_documents VIEW, policy 154 vs policy 208:
  state=as-is    agent_read=off  callers=44 (incl. <no uid>)  table rows Σ= 50674  view rows Σ= 50674  table same=44/44  view same=44/44
  state=as-is    agent_read=on   callers=44 (incl. <no uid>)  table rows Σ= 50372  view rows Σ= 50372  table same=44/44  view same=44/44
  state=as-is    agent_read on vs off changes the table for 2 caller(s)
  state=widened  agent_read=off  callers=44 (incl. <no uid>)  table rows Σ= 51370  view rows Σ= 50674  table same=44/44  view same=44/44
  state=widened  agent_read=on   callers=44 (incl. <no uid>)  table rows Σ= 51000  view rows Σ= 50312  table same=44/44  view same=44/44
  state=widened  agent_read on vs off changes the table for 6 caller(s)
rolled back; live policy == 208's again: True
PARITY PROVED — for all 43 users and a no-uid caller, in both data states, with app.agent_read off and on, policy 154 and policy 208 admit the SAME documents rows (count + md5 of sorted ids) and the SAME view rows.
```

### RED drive of the parity check itself (325 documents)

With `--plant-drop-connection-arm`, the "208" side is a policy WITHOUT the connection arm. The
TABLE fingerprint catches it for 4 callers. The VIEW fingerprint stays 42/42 "same", which is the
blind spot the review named: the view cannot see that arm.

```
  state=widened  agent_read=off  callers=42 (incl. <no uid>)  table rows Σ=  1130  view rows Σ=   434  table same=38/42  view same=42/42
  state=widened  agent_read=on   callers=42 (incl. <no uid>)  table rows Σ=   918  view rows Σ=   354  table same=38/42  view same=42/42
*** FAILED ***
  · widened agent_read=False: table differs for [4 callers: 1f13dc7b…, cdaa02a1…, d9e4f4e7…, e6dc45ca…], view for []
  · widened agent_read=True: table differs for [the same 4 callers], view for []
```
