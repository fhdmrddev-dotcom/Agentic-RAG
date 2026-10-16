---
phase: 285-watch-and-re-upload-close-out
plan: 01
subsystem: database, connectors
tags: [migration, watch-sync, retry, connectors, tdd, asyncpg, postgres]

requires:
  - phase: 280-in-once-out-clean
    provides: the minter caller fence (2 call sites in watch_service.py), the purge helper, the live harness shape
provides:
  - migration 209 (connector_watch_items.failed_attempts + .minted, tightened one-shot backfill, D-14 heal)
  - scripts/apply_migration_209.py (loopback-only apply / dry-run / verify)
  - watch retry of failed items (cap 3, reset on version change), typed item errors, run-row failure summary
  - the minted marker written at every point the minter answers (M-1..M-4) — plan 02's purge scope reads it
affects: [285-02 purge scope (FIX-13), 285-03 enqueue rule + heal live check + SC#5 re-drive]

tech-stack:
  added: []
  patterns:
    - "COALESCE($param, stored) in ON CONFLICT DO UPDATE so None means keep (never EXCLUDED for a preserved marker)"
    - "run-level summary on the run row only (release_watch run_error), never on the watch row the pill reads"

key-files:
  created:
    - supabase/migrations/209_watch_item_retry_and_purge_scope.sql
    - scripts/apply_migration_209.py
    - backend/tests/unit/test_285_migration_209_shape.py
    - backend/tests/unit/services/test_285_watch_retry.py
    - backend/tests/integration/test_285_watch_retry_live.py
  modified:
    - supabase/full-schema.sql
    - backend/app/db/watches.py
    - backend/app/services/watch_service.py
    - backend/tests/unit/db/test_watches_db.py
    - frontend/src/components/sources/RunHistoryList.tsx
    - frontend/src/components/sources/RunHistoryList.test.tsx

key-decisions:
  - "285-01: a failed watch item is RE-MINTED through the existing new-file branch (watch_service.py keeps exactly 2 minter call sites); cap WATCH_ITEM_MAX_FAILED_ATTEMPTS = 3, reset on a source version change"
  - "285-01: the per-file failure summary goes to connector_sync_runs.last_error only (release_watch run_error=); connector_watches.last_error stays NULL on a success tick"
  - "285-01: the watch error arm marks a document failed only when this iteration minted it — never the previous good copy, never a dedup-linked document"
  - "285-01: _WATCH_ITEM_COLUMNS now selects failed_attempts/minted, so migration 209 MUST be applied before this backend deploys (deploy order: paste 209, then promote code)"
  - "285-01: requirements FIX-12/13/14 are NOT marked complete here — plan 02 closes FIX-13, plan 03 closes FIX-14 and runs the SC#5 live re-drive that closes FIX-12"

patterns-established:
  - "Retry routing: widen the new-file condition (existing is None or retry_failed) instead of adding a third mint call"

requirements-completed: []

duration: 39min
completed: 2026-10-16
---

# Phase 285 Plan 01: Watch retry + migration 209 Summary

**Migration 209 adds `failed_attempts` and a `minted` marker to watch items (with a tightened one-shot backfill and a stuck-pending heal). A watched file whose download fails is now read again on later syncs, up to 3 failed attempts and reset by a source edit. Every run row names still-failed files with their exception type while the watch row stays clean.**

## Performance

- **Started:** 2026-10-16T15:20:37Z
- **Completed:** 2026-10-16T15:59:18Z
- **Tasks:** 3/3
- **Files:** 11 (5 created, 6 modified)
- **PHASE_BASE:** `c8c764e90bb50a23de6a63f94183a24e63e5cba3`

## Accomplishments

- **Migration 209.** It is applied locally twice with identical results, VERIFY 8/8 PASS on both applies, and `full-schema.sql` is regenerated with a clean +17-line diff (no unrelated drift).
- **FIX-12 retry.**
  - A `failed` item goes back through read, mint, bytes and enqueue in the SAME new-file body.
  - Past the cap, the item is not read. It is still counted and named on the run row.
  - `last_error` keeps the type: `ConnectError`, not `''`.
- **Error-arm correction (orchestrator ruling 4).** A transient read error on an edited file no longer marks the previous good copy failed. A raising upsert in the dedup arm no longer marks a hand upload failed.
- **D-06 marker writes.**
  - M-1: a fresh mint writes `minted=True`.
  - M-2: the minter returning the item's own document writes `minted=None`, which keeps the stored value.
  - M-3: a dedup link to another document writes `minted=False`.
  - M-4: the rename arm, the error arm and `update_item_state` never touch the marker.
  - The modify arm now passes `metadata=` (orchestrator ruling 8).
- **RunHistoryList.** Comment only, no logic change. One vitest regression pin: a success row carrying the summary renders the partial register and never the summary (T-235-12).

## Task Commits

1. **Task 1: migration 209.** RED `fce26cc10` (shape pins) → GREEN `1759cf780` (migration + apply script + full-schema)
2. **Task 2: DAL + RunHistoryList.** RED `c518b7150` → GREEN `92bf5a869`
3. **Task 3: watch_service retry.** RED `55caeb445` → GREEN `9e9af4a1e`

## Evidence

### Base gate (D-22), at PHASE_BASE, under the local-DB lock

`71 failed, 7688 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 450.62s (0:07:30)`
- Failing set: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-285/base_failed.norm.txt` (71 lines). Plans 02 and 03 compare against this file.
- Full log: `.../agentic-rag-285/base_unit.txt`.

### Task 1: shape test RED, then GREEN

RED, with no 209 file:
```
FAILED tests/unit/test_285_migration_209_shape.py::test_no_function_or_procedure_is_created
... (all 8)
>       assert len(matches) == 1, matches
E       AssertionError: []
8 failed, 1 warning in 0.65s
```
GREEN: `8 passed, 1 warning in 0.30s`

### Task 1: local apply (`scripts/apply_migration_209.py`, under the lock)

`--dry-run` (rolled back): VERIFY 8/8 PASS inside the transaction, minted 112 inside, `None` after the rollback.

`--apply`:
```
BEFORE  {'documents': 325, 'ingestion_jobs': 235, 'watch_items': 122, 'minted': None}
FIRST APPLY
  NOTICE: 209 backfill: 112 item(s) marked minted, 9 linked item(s) will be kept by a purge
  NOTICE: 209 heal: 0 stuck row(s) enqueued (bytes present), 0 marked failed (no bytes)
VERIFY: 8/8 PASS
AFTER FIRST  {'documents': 325, 'ingestion_jobs': 235, 'watch_items': 122, 'minted': 112}
SECOND APPLY
  NOTICE: column "failed_attempts" of relation "connector_watch_items" already exists, skipping
  NOTICE: column "minted" of relation "connector_watch_items" already exists, skipping
  NOTICE: 209 backfill: skipped, columns already present (one-shot)
  NOTICE: 209 heal: 0 stuck row(s) enqueued (bytes present), 0 marked failed (no bytes)
VERIFY: 8/8 PASS
AFTER SECOND {'documents': 325, 'ingestion_jobs': 235, 'watch_items': 122, 'minted': 112}
APPLIED (local) — VERIFY identical across two applies; documents untouched (325); minted 112 on both applies; ingestion_jobs 235 -> 235 -> 235.
```
The 8 VERIFY rows are:
- failed_attempts int NOT NULL DEFAULT 0
- minted boolean NOT NULL DEFAULT false
- nonneg CHECK present
- no minted item points at a doc older than its watch
- no column-level ACL appeared
- authenticated keeps table UPDATE
- anon has no SELECT
- no stuck pending row older than 1h without a job

The backfill count matches RESEARCH §4's measured 112. The heal is a no-op locally (0/0), as measured at research.

`full-schema.sql` diff: the two columns, the CHECK and the two COMMENTs, +17 lines, nothing else.

### Task 2: RED, then GREEN

RED:
```
E       AssertionError: assert 'COALESCE($13::int, connector_watch_items.failed_attempts)' in '...'
E       TypeError: upsert_watch_item() got an unexpected keyword argument 'failed_attempts'
E       TypeError: release_watch() got an unexpected keyword argument 'run_error'
3 failed, 19 passed
```
- `test_release_watch_error_without_run_error_unchanged` passed at RED by design. It is a pin that existing behaviour is unchanged.
- The vitest case passed at RED, as M-5 predicted. It is a regression pin, not a RED driver.

GREEN: `test_watches_db.py` 22 passed. `RunHistoryList.test.tsx` 31 passed.

### Task 3: RED against unmodified `watch_service.py`

Unit: `17 failed, 1 passed`. The one pass is the M-4 rename pin, which already held. Failure reasons:
- `Expected read_file to have been awaited once. Awaited 0 times.` (the failed item was never re-read)
- `assert 0 == 1` on `counts["errors"]` for the past-cap item (counted nowhere)
- `assert '' == 'ConnectError'` (the type was lost)
- `the previous completed copy was marked failed ... {'error_message': 'Watch sync failed: ', 'status': 'failed'}`
- `a dedup-linked hand upload was marked failed ... 'Watch sync failed: db blip'`
- `KeyError: 'failed_attempts' / 'minted' / 'metadata' / 'run_error'`

Live, with migration 209 applied and the DAL in place, against the old service:
```
>           assert it["failed_attempts"] == 1
E           assert 0 == 1
1 failed
```
A second run of the same file, copied to the scratchpad (outside the tree) with only the sync-1 attempt and last_error asserts turned into prints, shows the headline bug at sync 2:
```
EVIDENCE sync1 item={'state': 'failed', 'failed_attempts': 0, 'minted': False, 'last_error': '', 'document_id': None}
         run={'status': 'success', 'count_errors': 1, 'count_new': 0, 'last_error': None}
E           assert 1 == 2        # adapter.reads — sync 2 never read the failed file again
```
That is the bug exactly: the run row reads `success`, `count_errors` 1 and `last_error NULL`, and the next sync never re-reads the file.

### Task 3: GREEN

- Unit: `test_285_watch_retry.py` 18 passed.
- Targeted (`test_285_watch_retry`, `test_watch_service`, `test_watch_sync_runs`, `test_watch_diff_completeness`, `test_watches_db`, `test_280_minter_sequence`, `test_sources_watches_api`, `test_285_migration_209_shape`): `112 passed`.
- Live: `1 passed`, 0 skipped.
```
EVIDENCE sync1 item={'state': 'failed', 'failed_attempts': 1, 'minted': False, 'last_error': 'ConnectError', 'document_id': None}
         run={'status': 'success', 'count_errors': 1, 'count_new': 0, 'last_error': '1 file failed: 285-team-note-79e187.txt (ConnectError)'}
EVIDENCE sync2 item={'state': 'present', 'failed_attempts': 0, 'minted': True, 'last_error': None, 'document_id': UUID('7c3d6357-…')}
         doc_status=pending run={'status': 'success', 'count_errors': 0, 'count_new': 1, 'last_error': None}
```
- `connector_watches.last_error` was asserted NULL after sync 1.
- Cleanup was proven with one SQL count, which reads 0 across documents, jobs, watches, items, runs, connections, auth users and storage objects.

Acceptance greps:
- `grep -c "async_mint_document_row(" watch_service.py` returns `2`.
- `test_280_minter_sequence.py` is unmodified since PHASE_BASE (`git diff --quiet` passes) and green.
- `ingest_splice.py` is untouched since PHASE_BASE.
- `WATCH_ITEM_MAX_FAILED_ATTEMPTS = 3` appears once.

### Wave gate

**Backend unit, run once, with the full suite exactly as at base:**
`71 failed, 7718 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 465.34s (0:07:45)`
- Failing set: `.../agentic-rag-285/after_01.norm.txt`.
- `comm -13 base after` is EMPTY after normalisation: 71 == 71, set-identical.
  - The raw diff first showed two "new" lines. Both were the same two tests with a `RuntimeWarning` path glued onto the `FAILED` line by output interleaving: `test_explorer_agent` and `test_sql_service`, both in the base set.
  - Stripping the glued `C:...` suffix from both files gives 0 differing lines.
- Passed went from 7688 to 7718. The +30 is 8 shape, 4 DAL and 18 retry tests.
- Ceiling ≤ 71 is held, with zero new failures.

**Live suites:** `test_280_purge_bytes_live`, `test_280_same_bytes_live`, `test_280_cr01_two_org_live` and `test_285_watch_retry_live` ran `37 passed`, with 0 skipped.

**Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root):
- **Run 1:** `COUNT GATE VIOLATED (1 reason(s))`, `[failing-tests] 1 test(s) failed`.
  - The failing test is in `src/pages/WorkflowBuilderPage.canvas.test.tsx`: *"canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected…"*, with `STACK_TRACE_ERROR` after 6.5 s.
  - I read the failure from the gate's own persisted JSON report, copied to `.../agentic-rag-285/vitest_gate_report.json`, before re-running anything.
  - The file is **provably unmodified**: absent from `git diff --numstat c8c764e90 HEAD -- frontend/`, which lists only the two RunHistoryList files, and absent from `git status`.
  - Run 1 was concurrent with the 7.7-minute backend gate.
  - Re-running the file alone gave `154 passed`. One green sample of a load-sensitive suite is an observation, not proof of innocence.
- **Run 2,** alone, with no concurrent suite: `count gate OK — 449/449 pinned files present, no per-file decrease, 0 failing.` The total is 10514 (pinned 9644).
  - `RunHistoryList.test.tsx` reads 18 pinned against 31 now. That is +13: this plan's case plus earlier growth. It is not a decrease, and no pin needed raising.

## Deviations from Plan

1. **[Rule 3 - Blocking] VERIFY block blank comment line.** The migration's first VERIFY draft had a bare `--` line under `-- VERIFY`, which the shape pin (every body line `--   `) rejected. I removed that line; the pin was not loosened. This was found during Task 1 GREEN.
2. **Live RED fails at sync 1, not sync 2.** Migration 209 and the DAL land before the service change, so the old error arm writes `failed_attempts` 0. The test therefore fails at sync 1's `failed_attempts == 1` before it reaches sync 2. A scratchpad copy with the sync-1 attempt/type asserts relaxed proves the sync-2 failure (`adapter.reads 1 != 2`). Both outputs are quoted above.
3. **The restore arm passes no `failed_attempts`.** The plan lists "restore arm" among the success upserts, but that arm calls `update_item_state`, not `upsert_watch_item`. Only `present` items become `missing`/`unauthorized`, so their counter is already 0. A `failed` item never reaches that arm, because the retry routing sends it to the new-file branch. No change was made there.
4. **Commit order.** Task 2's RED commit (`c518b7150`) landed before Task 1's GREEN commit, because the base gate was still running. I did not edit app source while it ran, since some fences read source as text. Each task still has RED before GREEN.

## Owed (not performed here)

- **Production paste of migration 209** (D-23). The operator pastes `supabase/migrations/209_watch_item_retry_and_purge_scope.sql` into the cloud SQL editor, then runs the VERIFY block, then `get_advisors(security)` at deploy parity.
  - Orchestrator ruling 10: production read 0 watch items and 0 stuck rows, so 209 is a data no-op there.
  - ⛔ **Deploy order:** 209 must be applied BEFORE this backend ships. `_WATCH_ITEM_COLUMNS` now selects `failed_attempts, minted`, so the old schema would fail every watch-item read.
- No env var changes. `WATCH_PROCESS_ENABLED` and `RETENTION_SWEEP_ENABLED` are untouched.
- SC#5 live re-drive on the real watch A (`team-note-058.txt`) is plan 03.

## G-5 (D-20)

Re-derived triples:
- `watch_service.py` is **8 / 6 / 769** (was 7/5/643).
- `db/watches.py` is **5 / 4 / 733** (was 4/3/709).

Both are honoured by construction:
- Every hunk sits inside `sync_watch`'s existing branches, its error arm and the happy-path release, or inside `upsert_watch_item`, `release_watch` and `_WATCH_ITEM_COLUMNS`.
- The new module-level pieces are pure helpers: `_typed_error`, `_failure_summary` and `_minted_marker`.
- The named seam (extract the paged-listing loop before a third adapter) is not triggered.

`check-hot-file-ledger.cjs` reports `ledger gate OK`. The CLAUDE.md size gate is OK at 94,018 chars.

## Threat model

All mitigations are applied:
- **T-285-01:** `run_error` reaches the run row only, pinned in `test_watches_db` and live.
- **T-285-02:** the vitest pin; strings are capped at 500.
- **T-285-03:** a cap of 3.
- **T-285-04:** the error-arm correction, with unit RED first.
- **T-285-05:** the tightened backfill, the one-shot guard and the VERIFY row.
- **T-285-06:** the heal requires bytes before it enqueues; INSERT runs before UPDATE.
- **T-285-07:** no function is created, no column ACL appeared, and VERIFY checks grants.
- **T-285-08:** the loopback-only script.

No new surface beyond the threat register.

## Known Stubs

None.

## Next Phase Readiness

- The `minted` marker is populated, both by the backfill and at runtime. Plan 02 can scope the purge doors to `minted AND NOT shared`.
- RESEARCH §7 named `test_280_purge_bytes_live.py` as a fixture that plan 02 must amend. It still passes today, because the purge doors do not read `minted` yet.

## Self-Check: PASSED

- All 5 created files are present on disk.
- All 6 task commits are in history: `fce26cc10`, `c518b7150`, `1759cf780`, `92bf5a869`, `55caeb445`, `9e9af4a1e`.
- The local-DB lock is released.
