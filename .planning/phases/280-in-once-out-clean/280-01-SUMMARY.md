---
phase: 280-in-once-out-clean
plan: 01
subsystem: backend (documents / sources / retention / supabase utilities)
tags: [purge, storage, retention, hold-guard, maybe_single, postgrest, g5-extraction]
requires:
  - 275 hold_guard (assert_none_held / map_hold_refusal) and disposition._remove_bytes
provides:
  - app.services.document_purge.purge_documents (hold check, then rows, then bytes; one body for both watch doors)
  - app.services.document_purge.remove_document_bytes (the one bytes step, shared with disposition)
  - app.utils.db.maybe_row (0-row-safe read of a maybe_single() result)
  - AST fence over backend/app for unguarded maybe_single() .data reads
affects:
  - DELETE /sources/watches/{id}?purge_documents=true and POST /sources/watches/{id}/purge (now remove bytes)
  - DELETE /documents/{id} and 21 other maybe_single handlers (404/403 instead of a 500)
tech-stack:
  added: []
  patterns: [module-attribute guard call (D-31), DELETE return=representation as the bytes source, AST fence with tmp_path planted controls]
key-files:
  created:
    - backend/app/services/document_purge.py
    - backend/tests/unit/test_280_purge_bytes.py
    - backend/tests/unit/test_280_maybe_row_fence.py
    - backend/tests/unit/test_280_delete_404.py
  modified:
    - backend/app/api/sources.py
    - backend/app/services/retention/disposition.py
    - backend/app/utils/db.py
    - backend/app/api/documents.py
    - backend/app/api/folders.py
    - backend/app/api/skills.py
    - backend/app/api/takeoff.py
    - backend/app/services/ingest_splice.py
    - backend/app/main.py
    - backend/tests/unit/test_275_delete_paths.py
decisions:
  - "sources.py calls the helper as document_purge.purge_documents (module attribute): delete_folder_watch's `purge_documents` query parameter would shadow a by-name import"
  - "purged_count stays len(doc_ids) (D-12 behaviour preserved); RESEARCH's len(deleted) suggestion not taken"
  - "maybe_row sites use the minimal `if not maybe_row(X):` guard form (later X.data reads are dominated by the raise); delete_document uses `target = maybe_row(await aexec(...))` per D-09"
  - "disposition.py's now-unused run_in_threadpool import removed; its STORAGE_BUCKET constant kept"
metrics:
  duration: "~70 min"
  completed: 2026-10-14
  tasks: 3
  commits: 6
---

# Phase 280 Plan 01: Out clean, part 1 (purge bytes + maybe_single 404s) Summary

Both watch purge doors now go through one helper, `document_purge.purge_documents`. It runs the hold check, then the user-JWT row DELETE, then removes the stored bytes, and it takes the paths only from the rows the DELETE returned (DEBT-10, BUG-261012-01). All 22 unguarded `maybe_single()` → `.data` reads in `backend/app` now go through `app.utils.db.maybe_row`, so `DELETE /documents/{id}` answers the same 404 with CORS for a foreign row and for a missing id, where it used to answer a 500 (DEBT-11, BUG-261012-02). An AST fence pins that rule.

## Base

- Phase base SHA: `2dd80abbedf94853555bb70c0d63ea14e881f0c7`. The worktree started on `a248672f0` (master merge) and was reset to the expected base before any edit.
- **Base failing set (D-21 reference for plans 03/04):** `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/base_failed_2dd80abbe.txt` (raw, 72 lines). A normalised copy, `base_failed_2dd80abbe.norm.txt` (72 lines), strips the pytest text that sometimes glues onto a FAILED line. **Diff against the `.norm.txt` file.**
- Base gate summary: `72 failed, 7292 passed, 1 skipped, 2 xfailed, 2 xpassed` → **gate FAILED (72 > 71) at the base, inherited.** Full log: `base_gate_2dd80abbe.log`. The run was taken under the local-DB lock, and the lock was released afterwards.

## Commits (in order)

| # | Hash | Message |
|---|------|---------|
| A | 663511155 | refactor(280-01): extract both watch purge bodies into document_purge (D-12, G-5 extraction FIRST) |
| B | 6d8568d69 | test(280-01): failing pins for purge bytes order (RED) |
| C | d1d9747b7 | fix(280-01): watch purge removes bytes after the row delete (DEBT-10, BUG-261012-01) |
| D | cd75d1590 | test(280-01): maybe_single fence + delete 404 pins (RED) |
| E | 51a9e7962 | fix(280-01): every maybe_single read answers its existing 404, not a 500 (DEBT-11, BUG-261012-02) |
| F | 6ef890118 | chore(280-01): delete the dead postgrest maybe_single patch (D-30) |

The extraction (A) landed before RED (B), and RED landed before the fix (C). At commit A, `test_275_delete_paths.py` passed **24/24 with no test file changed**. The other sources suites (`api/test_sources_*`, `test_247_watch_missing_lifecycle`, `test_260906_auth_transport_vs_invalid`, `services/test_source_health_verdict`) passed 81/81.

## RED evidence

**Task 1 (commit B), 10 failed:**
- `test_280_purge_bytes.py::test_purge_order_is_guard_then_rows_then_bytes`
- `::test_bytes_come_only_from_rows_the_delete_returned`
- `::test_a_storage_failure_is_logged_never_raised`
- `::test_watch_delete_door_removes_bytes_after_the_rows_and_before_the_watch`
- `::test_purge_missing_door_removes_bytes_after_the_rows_and_before_the_items`
- `::test_purge_documents_orders_guard_then_delete_then_bytes`
- `::test_only_the_storage_remove_may_sit_inside_a_try`
- `::test_disposition_shares_the_one_bytes_function`
- `test_275_delete_paths.py::test_watch_delete_with_purge_unheld_deletes_documents_then_the_watch` (amended pin)
- `test_275_delete_paths.py::test_purge_missing_unheld_counts_only_after_the_delete_succeeded` (amended pin)

The hold-refusal, PT409 and non-hold-error cases passed at RED. That is expected: the extraction already preserved them, and the new tests pin that they stay that way.

**Task 2 (commit D), 8 failed:** the fence reported exactly the 22 research sites over 100 scanned `maybe_single()` calls (list below). All four `test_280_delete_404` tests saw `assert 500 == 404` ("Internal Server Error"). The three `maybe_row` unit tests failed with an ImportError, because the helper did not exist yet.

## The 22 sites, as fixed (call line → first `.data` read, measured at base)

| File | Sites | Form |
|---|---|---|
| `api/documents.py` | 829→836 list_document_versions, 1226→1233 restore_document_version, 1288→1296 reingest_document, 1651→1666 reextract_document, **1825→1831 delete_document**, 1931→1938 + 1944→1951 move_document | `if not maybe_row(X):`; delete_document: `target = maybe_row(await aexec(...))` + the existing `if not target:` |
| `api/folders.py` | 99→106 rename_folder, 225→232 toggle_global (403 kept) | `if not maybe_row(current):` |
| `api/skills.py` | 513→520 toggle_enabled (403 kept), 559→566 toggle_global (403 kept), 682→689, 726→733, 781→788, 811→818 | `if not maybe_row(X):` |
| `api/takeoff.py` | 40→47, 71→78, 108→115, 168→175, 191→198 | `if not maybe_row(X):` |
| `services/ingest_splice.py` | 162→168 minter folder check, 422→423 splice_document (D-29) | `if not maybe_row(folder_check):` / `doc = maybe_row(res) or {}` |

The re-measured set matches RESEARCH exactly. RESEARCH quoted documents.py 1651→1667; the scan reads 1651→1666. Same site, and the first-read line differs by one.

After GREEN: the fence scans 100 sites and reports 0 unguarded. The only allowlisted factory is `services/harness/skill_snapshot.py:70`, and a test asserts that the factory set equals the allowlist, so the allowlist cannot go stale. `grep -rn maybe_row backend/app | grep -v "def maybe_row"` returns 29 lines (≥ 22). The `ingest_splice.py` diff is 3+/2− (import, folder check, splice read). The `skills.py` diff has 0 `status_code` lines. `test_delete_document_gained_no_if_branch_d32` and `test_every_storage_remove_in_delete_document_follows_its_row_delete` pass without modification.

## D-30 measured facts (re-measured before the deletion)

1. `postgrest/_sync/request_builder.py` defines `SyncSingleRequestBuilder` (:89) and `SyncMaybeSingleRequestBuilder` (:142) as two unrelated classes. The patch wrapped only the first.
2. `grep -rn '"204"' backend/venv/Lib/site-packages/postgrest/` returns nothing (rc=1).
3. `_patch_postgrest_maybe_single` was referenced only in `app/main.py` (def + call) and the `app/utils/db.py` docstring.

All three held, so the patch was deleted. The db.py docstring now describes `aexec` alone and points at `maybe_row`. `import app.main` OK; `test_259_closed_core_inventory` passes (7/1/30 unchanged).

## Gate result (set diff)

- After-plan gate: `71 failed, 7322 passed, 1 skipped, 2 xfailed, 2 xpassed` → **exit 0 (≤ 71)**. Log: `final_gate_280-01.log`; set: `after_failed_280-01.norm.txt`.
- `comm -3 base_failed_2dd80abbe.norm.txt after_failed_280-01.norm.txt`:
  - only in base: `tests/unit/test_230_ingestion_jobs_db.py::test_live_reclaim_stale_ingestion_claims_exhausted_fails_document`. This is a `live_pg_pool` test of stale ingestion-claim reclaim. No file in this plan touches that path, so its pass is **not attributed to this plan**. Treat it as live-DB-state variance.
  - only in after: **none**. The after-set is a strict subset of the base set, so this plan introduced no new failures.
- Passed count rose by 30, all from the new test files.
- Integration (under the lock): `tests/integration/test_275_disposition.py` + `test_275_review_confirm.py` → **9 passed** (ran against the live local DB; not skipped).
- `node scripts/check-hot-file-ledger.cjs 280` → ledger gate OK.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking] Module-attribute call in sources.py instead of a by-name helper import**
- **Found during:** Task 1, commit A
- **Issue:** `delete_folder_watch` has a query parameter named `purge_documents`, which would shadow a by-name `purge_documents` import inside that route.
- **Fix:** `from app.services import document_purge` and `document_purge.purge_documents(...)` in both doors. The key-link pattern `purge_documents\(` still matches. The `hold_guard` import was removed from sources.py because nothing there uses it any more.
- **Commit:** 663511155

**2. [Rule 1 - cleanup] disposition.py's unused `run_in_threadpool` import removed**
- Lifting `_remove_bytes` out of disposition.py left `run_in_threadpool` unused, so the import was removed. No test patches `disposition.run_in_threadpool`.
- **Commit:** d1d9747b7

### Recorded (not fixed)

- **The base gate itself was over the ceiling (72 > 71).** This was inherited at `2dd80abbe`, before any edit in this plan. The plan's acceptance wording "base ... ≤ 71" therefore could not hold for the base. The after-plan run is 71, with a failing set that is a strict subset of base.

## TDD Gate Compliance

Both TDD cycles are present in order: `test(...)` 6d8568d69 → `fix(...)` d1d9747b7 (Task 1), and `test(...)` cd75d1590 → `fix(...)` 51a9e7962 (Task 2). The GREEN commits use the `fix` type because both close reported bugs. There was no separate refactor step.

## Threat surface

All T-280-01..06 mitigations are implemented and tested. There is no new network endpoint, auth path or schema change. The storage remove runs under the user-JWT client, as the threat model specifies.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/app/services/document_purge.py, backend/tests/unit/test_280_purge_bytes.py, backend/tests/unit/test_280_maybe_row_fence.py, backend/tests/unit/test_280_delete_404.py
- FOUND commits: 663511155, 6d8568d69, d1d9747b7, cd75d1590, 51a9e7962, 6ef890118
- FOUND: base_failed_2dd80abbe.txt (72 lines)
