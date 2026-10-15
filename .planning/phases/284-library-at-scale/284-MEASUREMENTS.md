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
