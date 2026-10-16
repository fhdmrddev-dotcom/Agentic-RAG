---
phase: 284-library-at-scale
plan: 06
subsystem: database / library
tags: [performance, index, migration-208, seed-357, sc-1, d-22, rls, postgrest, tdd]

requires:
  - phase: 284-02
    provides: "migration 207 library_documents, the paged GET /documents, the 50k scale account + seed / measure scripts"
  - phase: 284-04
    provides: "Find paging in SQL over the view"
  - phase: 284-REVIEW-FIX
    provides: "app.utils.db.aexec_page (unchanged here; every paged route still goes through it)"
provides:
  - "migration 208: three per-caller first-page indexes, the documents SELECT policy's auth.uid() evaluated once, library_documents as an ordered UNION ALL"
  - "scripts/apply_migration_208.py: loopback-only apply, VERIFY twice, row-for-row parity for every local user"
  - "backend/tests/integration/test_284_page_index_live.py: plan-shape + page-time + statement-time pins as PostgREST runs them (custom AND generic plan)"
  - "284-MEASUREMENTS.md: 'SEED-357 — where the 50k time goes' and 'AFTER (208)' with a per-criterion D-22 verdict"
affects: [production deploy order (207 → 208), SEED-357 (answered), the documents SELECT policy]

tech-stack:
  added: []
  patterns:
    - "A UNION ALL view an index can walk in order (PG 17): legs with NO WHERE + a constant discriminator; every predicate in the outer WHERE; a parent-level equality (scope_key) so the leading user_id is redundant for ordering"
    - "Keep PostgREST embeds through a UNION view: read the FK-target column (id) from a LEFT JOIN back to the base table; the join is removed from the count"
    - "Measure RLS cost the way PostgREST runs it: request.jwt.claims = the real token payload, NOT _apply_rls_user_context (whose claim.sub takes auth.uid()'s cheap branch)"

key-files:
  created:
    - supabase/migrations/208_library_page_index.sql
    - scripts/apply_migration_208.py
    - backend/tests/integration/test_284_page_index_live.py
    - .planning/phases/284-library-at-scale/measurements/284-06-explain-{before,after}-{10000,50000}.txt
    - .planning/phases/284-library-at-scale/measurements/284-06-after-{10000,50000}-run{1,2}.json
  modified:
    - supabase/full-schema.sql
    - scripts/full-schema-supplement.sql
    - .planning/phases/284-library-at-scale/284-MEASUREMENTS.md
    - .planning/seeds/SEED-357-library-root-and-find-first-page-time-grows-with-the-library.md

key-decisions:
  - "The cost was located before anything was changed. pg_stat_statements around real API calls put 408 of 446 ms (Root) and 417 of 466 ms (Find) inside the ONE PostgREST statement. The API side is a flat ~40-60 ms, so 284-04's '~250 ms API-side' was wrong."
  - "Two linear causes, both fixed in 208. (a) The view's OR allowed no ordered walk, and Root's embeds ran for all 29,808 rows. (b) The documents SELECT policy evaluated auth.uid() per row, re-parsing the 443-byte JWT claims each time."
  - "The policy change (auth.uid() → (SELECT auth.uid())) is outside the plan's text, taken under Rule 3: without it D-22 cannot be met. The count alone was 138 / 223 ms at 50k. It is the same predicate, guarded to refuse unless the live policy is exactly 154's, and proven by the row-for-row parity and the RLS / leak suites."
  - "The view was rewritten (the plan's conditional branch). A naive UNION ALL made Find WORSE (956 ms), because legs with a WHERE are planned as isolated subqueries. Only quals-free legs + a discriminator + a scope_key equivalence class give a Merge Append."
  - "A third index (folder page 1) was added because the Big plan uses it: 95 → 8.5 ms in SQL. No index was added for status lists / updated_desc / other Find sorts. No plan in D-22 uses one."
  - "No backend code changed. Every AFTER figure was taken against the operator's :8000, which serves the same backend code. The LIST_SELECT comment claiming the embeds run 'for the PAGE only' was left as is. It is true now for Root and folder page 1, and still false for unindexed filters (recorded below)."

requirements-completed: [FIX-11]

duration: ~85 min
completed: 2026-10-16
independent_review: self
---

# Phase 284 Plan 06: Library first page as an ordered index walk (migration 208, SEED-357)

**Migration 208 does two things. It turns Root page 1 and Find page 1 into ~25-row index walks
(page node 0.82 → 1.10 ms and 1.22 → 1.22 ms from 10k to 50k). It also makes the documents
SELECT policy evaluate `auth.uid()` once instead of once per row. Root's HTTP ratio drops from
2.54x to 1.14-1.38x, and Find's from 2.59x to 1.32-1.42x in three of four paired runs (1.57x in
one host-noisy pair).**

## Where the 50k time actually went (statement level)

`pg_stat_statements` diffed around 5 real API calls against :8000 (no reset). Host CPU 7.6-18.1 %.

| size | surface | HTTP | the one PostgREST statement | everything else |
|---|---|---|---|---|
| 10,020 | Root page 1 | 135.3 ms | 89.8 ms | 45.5 ms |
| 10,020 | Find page 1 | 154.7 ms | 97.4 ms | 57.3 ms |
| 50,020 | Root page 1 | 445.6 ms | **407.9 ms** | 37.7 ms |
| 50,020 | Find page 1 | 465.7 ms | **417.2 ms** | 48.5 ms |

The statement is `WITH pgrst_source (page) , pgrst_source_count (exact count) SELECT …`. Inside it:

1. **The page has no ordered path.** 207's `user_id = auth.uid() OR folder_id IN (shared)` is
   served by a BitmapOr, so the planner sorts every matched row. Root's `document_tables(count)` /
   `document_images(count)` embeds are LATERAL joins below the sort, and they ran **29,808 loops
   each** at 50k.
2. **`auth.uid()` per row.** Migration 154's policy calls it bare. PostgREST sets only
   `request.jwt.claims`, so each call casts 443 bytes of JSON. The exact count alone cost 138 ms
   (Root) and 223 ms (Find) at 50k.
   ⚠ The 207 EXPLAIN and the 284-05 verdict read 25-37 ms for this count because they ran under
   `_apply_rls_user_context`. That helper also sets `request.jwt.claim.sub`, the parse-free branch,
   which PostgREST never takes.

## Migration 208 — content

- **Indexes**, each leading on `(user_id, is_latest)` so the walk is per caller:
  ```sql
  documents_library_root_created_idx   (user_id, is_latest, created_at DESC, id DESC) WHERE folder_id IS NULL
  documents_library_added_idx          (user_id, is_latest, created_at DESC NULLS LAST, id)
  documents_library_folder_created_idx (user_id, is_latest, folder_id, created_at DESC, id DESC) WHERE folder_id IS NOT NULL
  ```
- **Policy:** "Users can view own or global-folder documents". `auth.uid() = user_id` becomes
  `(SELECT auth.uid()) = user_id`. Name, `FOR SELECT TO authenticated`, the org gate and the other
  two arms are 154's. A DO-block guard **refuses** unless the live qual is exactly 154's
  (or already 208's).
- **View rewritten: yes.**
  - The view is a UNION ALL of two legs that carry **no WHERE**. Each leg has a constant `leg`
    and a `scope_key` (leg 1 `d.user_id`, leg 2 `auth.uid()`).
  - All predicates sit in the outer WHERE: `scope_key = (SELECT auth.uid()) AND (leg = 1 OR
    (leg = 2 AND user_id IS DISTINCT FROM uid AND folder_id = ANY(ARRAY(shared-not-own))))`.
  - `id` is read from `LEFT JOIN public.documents o ON o.id = u.id`.
  - The output has the same 36 columns in the same order, the same `security_invoker`, and 207's
    grants re-asserted (REVOKE ALL FROM PUBLIC, anon, authenticated, service_role; GRANT SELECT TO
    authenticated, service_role).
- **Why a rewrite was needed** (each measured):
  - The index alone with the OR view: 429 / 437 ms. No ordered walk is possible.
  - A naive UNION ALL with a WHERE in each leg: Find 956 ms. Such a leg is never flattened into
    an appendrel (`is_safe_append_member`).
  - Without `scope_key`: the index is scanned but the sort remains. A child-only qual forms no
    equivalence class, so the leading `user_id` blocks the index's pathkeys.
  - With `u.id` instead of `o.id`, PostgREST cannot trace `id` through the UNION. Every embedded
    read 500s with **PGRST200**.

## VERIFY (`scripts/apply_migration_208.py`, final apply)

```
AFTER FIRST APPLY            VERIFY: 14/14 PASS
AFTER SECOND APPLY (idempotency check)  VERIFY: 14/14 PASS   (VERIFY, viewdef and policy identical)
AFTER   documents rows: 50545 (= BEFORE)
ROW-FOR-ROW PARITY (207 view BEFORE vs 208 view AFTER, every user, as that user):
  d757c383-… rows 50220 -> 50220 same · d8a54002-… 294 -> 294 same · … 43 users, all "same"
  <service_role> rows 0 -> 0 same
APPLIED (local) — VERIFY identical across two applies; documents untouched; the view is row-for-row
identical for all 43 users and the service role still reads 0 rows.
```
The first apply (12/12 PASS) logged the policy transition from 154's text to the wrapped one.
After the regen, ACL parity read `349/349`, and 208's six table statements were recognised.

## EXPLAIN before / after (as `authenticated`, real token claims)

| statement | 10k BEFORE | 50k BEFORE | 10k AFTER | 50k AFTER |
|---|---|---|---|---|
| Root whole statement | 92.2 | 494.4 | 3.80 | 14.9 (generic 14.0) |
| Root page (`Limit`) | 66.0 | 355.8 | **0.82** | **1.10** |
| Root exact count | 25.8 | 138.3 | 2.60 | 13.5 |
| Find whole statement | 96.3 | 473.9 | 6.71 | 24.3 (generic 25.9) |
| Find page (`Limit`) | 52.3 | 250.5 | **1.22** | **1.22** |
| Find exact count | 43.2 | 222.7 | 5.10 | 22.7 |

All values in ms. The BEFORE plans were `Sort` ← 2 × `Nested Loop Left Join` (29,808 loops) ←
`Bitmap Heap Scan` (BitmapOr). The AFTER plans are `Incremental Sort` ← `Index Scan using
documents_library_root_created_idx` (26 rows), and for Find `Merge Append` over
`documents_library_added_idx` (26 rows).

## AFTER tables (HTTP median, `measure-library-284.py --label after`)

| surface | 10k run 1 | 50k run 1 | 10k run 2 | 50k run 2 |
|---|---|---|---|---|
| host CPU (typeperf) | 8-19 % (median 12) | 12.1-15.8 % | 10.9-16.6 % | 17.0-21.4 % (just after reseed) |
| Root page 1 | 45.1 | 55.6 | 54.2 | 74.6 |
| Big page 1 | 44.5 | 49.0 | 56.7 | 48.1 |
| Big LAST page | 69.1 | 126.1 | 75.8 | 122.8 |
| Find page 1 | 47.4 | 67.2 | 49.5 | 77.7 |
| Picker (Find limit 20) | 47.0 | 75.8 | 47.9 | — |
| summary | 45.7 | 88.1 | 47.5 | 88.0 |

Every reported total equals `count(*)`. Two lighter captures (`pg_stat_statements` + HTTP, 9
calls each, four rounds) gave 50k/10k medians of Root 61.3 / 54.0 and Find 77.6 / 59.0. At 50k
the statement read a steady 13.4-15.6 / 20.3-23.6 ms throughout.

## D-22 verdict (Root and Find page 1)

- **Root page 1: MET.** 1.23x (run 1), 1.26x, 1.14x, 1.38x (run 2), against 2.54x before. The SQL page node reads 1.34x.
- **Find page 1: MET in 3 of 4 pairs.** 1.42x, 1.33x, 1.32x, and **1.57x** in run 2, against 2.59x before.
  The 1.57x pair's 50k half ran at 17-21 % CPU right after a reseed. Its statement was 20.4 ms,
  the same as every other pair, so the extra ~10 ms is host-side, outside Postgres. The SQL page
  node is flat at 1.00x. The remaining growth is the exact count (5.1 → 22.7 ms, linear by FIX-11's
  design). It is the same size as the ±10 ms host swing in the ~45 ms of non-SQL handling.
- Big page 1: 0.85-1.10x (was 1.45x). First page < 500 ms: Root 54-75, Find 64-81 ms.
- **Missed and recorded:** the summary's ratio is 1.85x / 1.93x (88 ms at 50k, an exact aggregate,
  not targeted). 284-05's "1.45x MET" was against a contended 10k figure. On the 208 view the
  summary SQL costs ~10-20 % more than on 207's, about +5-20 ms at 50k (rolled-back comparison).

## Commits

| Task | Commit | Type |
|---|---|---|
| 1 RED: locate + live test | `88132dfee` | test |
| 2 GREEN: migration 208 + apply script + regen + supplement | `2bd13fda9` | feat |
| 3 AFTER, verdict, SEED-357 | `74c529be4` | docs |

**RED** (8 failed at 50,020 and at 10,020; pasted in 284-MEASUREMENTS.md):
`root page 1 … visits the library: …Bitmap Heap Scan[documents]: 29808 rows x 1 loops`,
`find page 1 took 233.0 ms … the bound is 20.0 ms`,
`root: the full PostgREST statement … took 413.9 ms; the bound is 89.6 ms`.
**GREEN:** `test_284_page_index_live.py` 8 passed at 50k and at 10k.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The documents SELECT policy's `auth.uid()` wrapped in a SELECT**
- **Found during:** Task 1
- **Issue:** Even with an ordered page, the exact count was 138 / 223 ms at 50k. Each row re-parsed the JWT claims, so D-22 could not be met with an index and a view alone.
- **Fix:** DROP + CREATE the policy with `(SELECT auth.uid())`. The predicate is the same, the guard refuses on drift, and parity was checked for all 43 users. The RLS / leak suites pass (below).
- **Files:** `supabase/migrations/208_library_page_index.sql` · **Commit:** `2bd13fda9`

**2. [Rule 1 - Bug] A UNION ALL view broke every PostgREST embed (PGRST200)**
- **Found during:** Task 2, at the first apply. 8 of the 284 live tests went red. The operator's :8000 Library list would also have 500'd for the ~3 minutes until the revert.
- **Fix:** Reverted to 207's view at once with `apply_migration_207.py`. The indexes and the policy stayed, since both are harmless to 207. Then `id` was taken from a `LEFT JOIN documents o`. The new shape was probed on a scratch view (`zz_284_06_probe`, dropped afterwards) and then re-applied.
- **Commit:** `2bd13fda9` (the final file)

**3. [Rule 2 - Missing critical] A folder-page index (the third index)**
- **Found during:** Task 2. With the LEFT JOIN, Big page 1 still ran the join and the embeds for all 9,948 rows.
- **Fix:** `documents_library_folder_created_idx`. Big page 1 dropped from 95 to 8.5 ms in SQL.

### Noted, not changed

- `documents.py` LIST_SELECT comment: "the two embedded counts are evaluated for the PAGE only (D-05)". This is false for unindexed filters: status lists, `kind=spreadsheet`, the unfiltered list, and any page past an offset. Left as is to keep backend code unchanged; flagged for the next edit of that file.
- The unit gate's first run read 72. The extra failure was `test_261_expert_authoring.py::test_expert_draft_non_ingestion_guarantee`, which counts ALL rows in `documents` globally. I had run the RLS integration suites at the same time, so the DB was mutating under it. It passed alone, and a clean re-run read 71.

## Gates

| Gate | Result |
|---|---|
| Backend unit (`pytest tests/unit -q --continue-on-collection-errors`) | **71 failed, 7688 passed**, 1 skipped, 2 xfailed, 2 xpassed. The failing SET is identical to 284-05's recorded 71-set, after stripping one glued `RuntimeWarning`. `backend/` differs from PLAN_BASE only by the new integration test |
| `tests/integration -k 284` (all 284 live suites incl. parity, leak, fail-closed, drift, offset-past-end, rel-edge-cap, resolve, find, recorder, page-index) | **43 passed, 0 skipped** (50k) |
| RLS / leak / view suites (112, 113 ×3, 114 ×2, 115, 116, 117 ×2, 163 leak ×2 + rls_documents, 271 ×2, 272, 275) | **86 passed, 5 xpassed** (historic `xfail(strict=False)`), 0 skipped |
| `node scripts/check-seeds-register.cjs` | OK (365/365) |
| `node scripts/check-hot-file-ledger.cjs .planning/phases/284-library-at-scale` | OK |
| `node scripts/check-claude-md-size.cjs` | OK (94,018 chars) |
| `node scripts/check-schema-acl-parity.cjs` | OK 349/349 |
| tsc | not run, because no frontend file was touched |
| Teardown | `dev account documents: before=294 after=294`; no scratch objects left; local-DB lock released |

## Production order and what is owed

1. Paste **207**, then **208**, into the cloud SQL editor. Each is an approval-gated production write, and 208's guard refuses if production's policy drifted from 154's.
2. Run `get_advisors(security)`.
3. Deploy the backend, then the frontend. 208 needs no backend change.

Plain CREATE INDEX is fine at production's 178 documents. Above ~100k, run the three as `CONCURRENTLY` first.

**Owed:**
- The production apply and its VERIFY (14/14).
- `graphify update .`, not run in the worktree because `graphify-out/` is tracked and would churn under a parallel merge.
- The summary ratio, which needs a counter or cache, not an index.
- Indexes for the other list shapes, if they matter.
- The LIST_SELECT comment.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: rls-policy-rewrite | supabase/migrations/208_library_page_index.sql | The documents SELECT policy is DROPped and re-CREATEd. It is semantically identical, guarded, parity-checked and leak-tested, but it is a change to the wall itself. Review it before the production paste |
| threat_flag: view-replace | supabase/migrations/208_library_page_index.sql | library_documents is replaced; security_invoker and SELECT-only grants are kept; the service role still reads 0 rows |

## Self-Check: PASSED
