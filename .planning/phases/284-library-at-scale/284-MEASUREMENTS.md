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
