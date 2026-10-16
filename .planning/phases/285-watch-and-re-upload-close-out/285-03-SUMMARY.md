---
phase: 285-watch-and-re-upload-close-out
plan: 03
subsystem: upload, ingestion-queue, connectors
tags: [upload, ingestion-queue, live-evidence, onedrive, ledger, gates, close, tdd]

requires:
  - phase: 285-01
    provides: migration 209 (failed_attempts, minted, the stuck-pending heal), the watch retry of failed items
  - phase: 285-02
    provides: watch_purge_scope, both purge doors scoped to minted+unshared, honest remove_document_bytes
  - phase: 280-in-once-out-clean
    provides: the same-bytes minter (FIX-02), the live upload/purge harnesses, the SC#2 104/105 measurement and drive precedent
provides:
  - /documents/upload marks a document failed when it could not be queued (FIX-14, D-12/D-13)
  - live RED-first proof that a failed enqueue no longer strands a same-bytes-absorbing pending row (SC#3)
  - the migration 209 heal verified live in a rolled-back transaction (D-14)
  - SC#5 live OneDrive re-drive at 105/105 (FIX-12 closed live)
  - 285-LIVE-EVIDENCE.md; BUG-261014-02/03/04/05 closed; 280 SC#2 owed line corrected
  - hot-file ledger + CLAUDE.md FIRING rows for the 7 files 285 changed
affects: [deploy parity (migration 209 production paste, get_advisors), BUG-260910-04 and 238 M-9 routing (a 105/105 pass now exists)]

tech-stack:
  added: []
  patterns:
    - "Refuse in the existing failure arm and return its response shape (mirror the storage-fail arm) rather than adding a new branch"
    - "Live drives outside the repo: class-level adapter patch in the driver process only, token via the app's own refresh path, never printed"

key-files:
  created:
    - backend/tests/integration/test_285_stuck_pending_live.py
    - backend/tests/unit/test_285_upload_enqueue_failure.py
    - .planning/phases/285-watch-and-re-upload-close-out/285-LIVE-EVIDENCE.md
  modified:
    - backend/app/api/documents.py
    - .planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md
    - .planning/reported-bugs/BUG-261014-02-watch-item-that-fails-once-is-never-retried.md
    - .planning/reported-bugs/BUG-261014-03-watch-purge-deletes-a-manual-upload-it-only-dedup-linked.md
    - .planning/reported-bugs/BUG-261014-04-stuck-pending-row-absorbs-every-same-bytes-reupload.md
    - .planning/reported-bugs/BUG-261014-05-remove-document-bytes-counts-paths-storage-did-not-delete.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "285-03: /upload's enqueue-failure arm marks the doc failed (guard status='pending') only when BOTH inserts raised AND ingest_worker_enabled; returns 201 {**doc, status: failed} before the audit task, as the storage-fail arm does; ingest_splice.py byte-unchanged (FIX-02)"
  - "285-03: SC#5 driven under operator option-a — step 1 re-synced watch A as it was (105/105), step 2 used a temporary watch C over B's folder, deleted WITHOUT purge"
  - "285-03: BUG-260910-04 and 238-VERIFICATION M-9 were NOT flipped — a 105/105 pass now exists for their own routing to cite"

patterns-established:
  - "D-15 audit table: only /upload logged-and-continued an enqueue failure; every other mint door already failed closed or splices"

requirements-completed: [FIX-12, FIX-13, FIX-14]

duration: ~45min (Task 1 + checkpoint + continuation)
completed: 2026-10-16
---

# Phase 285 Plan 03: Enqueue-failure refusal, live close-out Summary

**`/documents/upload` now marks a document `failed` when neither enqueue path could queue it, so a later same-bytes upload in another folder mints and ingests. The 209 heal is proven live without side effects. The live OneDrive re-drive reached 105/105 after one forced `ConnectError` showed a typed item failure and a run row naming the file. All four 261014 bugs are closed with evidence pointers, and the hot-file ledger reflects 285.**

## Performance

- **Started:** before the checkpoint (Task 1 RED committed 2026-10-16T16:36Z)
- **Completed:** 2026-10-16T17:12Z
- **Tasks:** 3/3. Task 2 was a decision checkpoint, answered by the operator.
- **PHASE_BASE:** `c8c764e90`

## Operator decision (Task 2, D-18)

The orchestrator asked with AskUserQuestion on 2026-10-16. The operator answered verbatim: **"option-a (Recommended)"**.
- This was the explicit OK for the drive, including the OAuth refresh through `oauth_refresh_service`.
- Backend: the orchestrator confirmed `:8000` answered `GET /health → {"status":"ok","redis":"ok","maintenance":false}`. Whether its ingest worker was enabled was not confirmed beforehand. The drive then showed the new document reaching `completed`, so the worker was live.
- No `sync_watch` call and no OAuth refresh happened before the reply.

## Task Commits

1. **Task 1 RED:** `94b56c56c` `test(285-03): enqueue-failure strand + heal live cases (RED, D-16)`
2. **Task 1 GREEN:** `521bf6491` `fix(285-03): mark an upload failed when it could not be queued (FIX-14, D-12)`
3. **Task 2:** decision checkpoint. No commit.
4. **Task 3a:** `cca4e5a90` `docs(285-03): live evidence (SC#5 105/105) and bug closes (FIX-12/13/14)`
5. **Task 3b:** `d27fb6058` `docs(285-03): hot-file ledger rows + CLAUDE.md FIRING rows for 285 (D-20)`

As the plan checker required, the evidence doc and bug closes were committed before the ledger and CLAUDE.md edits.

## Evidence

### Task 1 RED, against unmodified `documents.py` (under the lock)

Run: `test_285_stuck_pending_live.py` + `test_285_upload_enqueue_failure.py`, result `4 failed, 4 passed in 6.89s`.
```
EVIDENCE SC#3 upload 1 (both enqueue paths forced to fail) -> HTTP 201 body.status='pending' | row status='pending' step=None | ingestion_jobs=0
EVIDENCE SC#3 upload 2 (same bytes, folder B) -> HTTP 200 already_in_library=True new_id=False | row status='pending' folder_is_B=False | ingestion_jobs=0
E       AssertionError: upload 1 answered 'pending'
___________ test_both_enqueue_paths_fail_marks_the_document_failed ____________
E       assert 'pending' == 'failed'
(test_the_refusal_write_raising_does_not_double_fault)
E       AssertionError: assert 'pending' == 'failed'
(test_the_d12_message_lives_once_in_the_route)
E       assert 0 == 1      # 'could not be queued for reading' count in documents.py
```
- The live D-16 case failed for the bug's own reason: a pending row with no job, and the folder-B upload absorbed by it.
- These passed at RED as verification pins, not RED drivers:
  - the heal case (migration 209 was already applied);
  - the worker-disabled pin;
  - the asyncpg-success pin;
  - the service-role-fallback-success pin.

### Task 1 GREEN (`521bf6491`)

Run: `test_285_stuck_pending_live.py` + `test_285_upload_enqueue_failure.py` + `test_280_minter_sequence.py`, result `42 passed in 8.25s`, 0 skipped.
```
EVIDENCE SC#3 upload 1 (both enqueue paths forced to fail) -> HTTP 201 body.status='failed' | row status='failed' step='failed' | ingestion_jobs=0
EVIDENCE SC#3 upload 2 (same bytes, folder B) -> HTTP 201 already_in_library=None new_id=True | row status='pending' folder_is_B=True | ingestion_jobs=1
EVIDENCE D-14 heal (rolled back) P: status='pending' jobs=['pending'] error=None
EVIDENCE D-14 heal (rolled back) Q: status='failed' jobs=[] error='This file was never read, because its upload did not finish. Please upload it again.'
EVIDENCE D-14 heal (rolled back) R: status='pending' jobs=[] error=None
```

### SC#4 + closed core (re-run at `521bf6491`, under the lock, during the continuation)

- The 7 live suites (`test_280_same_bytes_live`, `test_280_purge_bytes_live`, `test_280_cr01_two_org_live`, `test_285_stuck_pending_live`, `test_285_purge_scope_live`, `test_285_watch_retry_live`, `test_275_disposition`) returned **`48 passed`, 0 skipped**.
- `test_259_closed_core_inventory.py` returned **`7 passed`**: 7 phase types, 1 emitter, 30 tools.
- `git diff --quiet c8c764e90 -- ingest_splice.py db/ingestion_jobs.py test_280_same_bytes_live.py harness/ tool_dispatcher.py tools/` exits 0.
- `grep -c "could not be queued for reading" backend/app/api/documents.py` returns 1.

### Backend unit gate (D-22)

- **Run 1:** `72 failed, 7738 passed, 1 skipped, 2 xfailed, 2 xpassed`. The one extra failure was `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`.
  - It is recorded as flaky in `248-GATE-BASELINE.md`.
  - It passed 3/3 when run alone.
  - It was not changed by this plan.
- **Run 2:** `71 failed, 7739 passed, 1 skipped, 2 xfailed, 2 xpassed in 421.04s`. That is ≤ 71.
  - `comm` against `base_failed.norm.txt` showed 1 "new" and 1 "gone". Both are the same test, `test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc`: the base file has a `RuntimeWarning` path glued onto its `FAILED` line.
  - After stripping that suffix, the failing set equals the base set: NEW = [], GONE = [].
- Passed rose from 7733 after plan 02 to 7739. That is +6, this plan's unit cases.
- Logs: `.../agentic-rag-285/after_03.txt` and `after_03b.txt`.

### SC#5: live OneDrive re-drive (option-a). PASS, 105 / 105

The driver was `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-285/drive_sc5.py`, outside the repo (`git ls-files | grep -c drive_sc5` returns 0). It ran under the lock from 17:03:47Z to 17:04:18Z. Full table: `285-LIVE-EVIDENCE.md` § SC#5.

**Token refresh.** It went through `get_fresh_access_token`, the app path. The token was never printed. `expires_at` moved from 2026-10-14 16:40Z to 2026-10-16 18:03Z.

**Step 1: `sync_watch(A)` as it was.**
- Result: `success`, `new 1`, `errors 0`.
- `team-note-058.txt` changed from `failed` (attempts 0, `last_error ''`) to `present`, `minted=true`, doc `310aeac5-…`.
- Run row: `count_errors 0`, `last_error NULL`.
- `connector_watches.last_error` is NULL.
- A 95 + B 10 = **105 / 105**.

**Step 2: temporary watch C (`6b231dbe-…`) over `/Team Docs/Q3 Plans`.** It was inserted with `is_active=false`.
- Sync 1, with `read_file` raising `httpx.ConnectError("")` once for `q3-plan-01.txt`:
  - the item was `failed`, `failed_attempts 1`, `last_error 'ConnectError'`;
  - the run row read `success`, `count_errors 1`, `last_error '1 file failed: q3-plan-01.txt (ConnectError)'`;
  - `connector_watches.last_error` was NULL.
- Sync 2 landed it:
  - it was dedup-linked to B's own document `3f7dae58-…`, with `minted=false`;
  - all 10 C items were `minted=false` and linked to B's documents.

**Cleanup.**
- C was deleted with `purge_documents=false`; 0 rows and 0 items remained.
- B's 10 (name, doc, status, updated_at) tuples were identical before and after, and 10/10 storage paths were present.
- A and B are both `is_active=false`.

**Completion.** A 95/95 and B 10/10 are `completed`, with no stragglers.

## D-15 audit (orchestrator ruling 9)

| # | Caller | Mint site | Enqueue failure before 285 | Needs D-12 |
|---|---|---|---|---|
| 1 | /documents/upload | api/documents.py:615 | log.error, 201, pending row with no job | YES, only when ingest_worker_enabled is true |
| 2 | watch new-file | watch_service.py (new-file body) | except arm marks item + this-iteration doc failed | No |
| 3 | watch modify | watch_service.py (modify arm) | except arm marks this-iteration doc failed | No |
| 4 | import_service.import_single_file | sources/import_service.py:237 | _enqueue_or_splice → BackgroundTask splice | No |
| 5 | workspace_promote | api/workspace_promote.py:215 | same _enqueue_or_splice | No |
| 6 | expert_install_service | :603 | same _enqueue_or_splice (incl. _redrive_failed) | No |
| 7 | email_attachments | :357 | no queue; inline ingest; except marks failed | No |

The residual for #4-#6 is a process restart that loses the BackgroundTask. The D-14 heal covers it.

## Accepted residuals

- **D-12 race (a).** The asyncpg insert commits, then raises. The doc is marked failed, but a job exists, and the worker ingests it anyway. This heals itself.
- **D-12 race (b).** A same-bytes upload in the milliseconds between mint and refusal gets the soon-failed copy. The person re-uploads.
- **Retention over-report** (orchestrator ruling 7). This fails safe.
- **Retired earlier failed versions stay behind after a purge** (RESEARCH §2).

## OWED operator actions (D-23)

1. Paste `supabase/migrations/209_watch_item_retry_and_purge_scope.sql` into the **production** SQL editor, then run its VERIFY block. ⛔ Do this BEFORE the backend deploys: `_WATCH_ITEM_COLUMNS` selects the new columns. Production read on 2026-10-16 showed 0 watch items and 0 stuck rows, so the data effect is nil.
2. Run `get_advisors(security)` at deploy parity.
3. No env var change. `full-schema.sql` was already regenerated in plan 01.

## G-5 (D-20)

All triples were re-derived with the CLAUDE.md recipe on the merged tree. Six-digit quick-task buckets are subtracted.

| File | Triple | G-5 | CLAUDE.md FIRING row |
|---|---|---|---|
| `api/documents.py` | 99 / 39 / 2698 | FIRES | updated |
| `api/sources.py` | 11 / 5 / 713 | FIRES | updated |
| `services/watch_service.py` | 8 / 6 / 769 | FIRES | **added** |
| `db/watches.py` | 6 / 4 / 828 | FIRES | **added** |
| `RunHistoryList.tsx` | 5 / 3 / 275 | now FIRES | **added** |
| `models/source.py` | 6 / 2 / 201 | no | — |
| `services/document_purge.py` | 4 / 2 / 105 | no | — |

- `docs/HOT-FILE-LEDGER.md` § "Phase 285 close (2026-10-16, 285-03)" quotes every replaced cell verbatim.
- `node scripts/check-claude-md-size.cjs` reads `claude-md size gate OK` at 94,421 chars, with no warning.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/285-watch-and-re-upload-close-out` reads `ledger gate OK` (7 watched).
- D-24: `ls *-PLAN.md | wc -l` returns 3.

## Deviations from Plan

1. **[Rule 3] SC#4 and closed-core outputs re-captured in the continuation.** Task 1's SC#4 (`48 passed`) and closed-core (`7 passed`) results had been recorded only in the hand-off, not in a log file. I re-ran both at `521bf6491` under the lock, so the evidence quoted here is captured: `.../agentic-rag-285/sc4_rerun.txt` and `closed_core_rerun.txt`. Same results.
2. **Watch C was inserted with SQL, not through `create_watch`.** `create_watch` always inserts `is_active=true, next_run_at=now()`, and the live backend scheduler could have claimed that row. The driver copied B's row with `is_active=false` and `next_run_at = now()+1 day`, as the operator option specified.
3. **The C delete called `db.watches.delete_watch` directly.** The route's `purge_documents=false` arm is exactly that call, after an owner check the driver did not need.
4. **Not flipped: BUG-260910-04 and 238-VERIFICATION M-9.** 280's evidence names a 105/105 pass as what flips them, and that pass now exists. They were not in this plan's `files_modified`, so the 280 correction note says their own routing should cite this pass.

## Self-Check: PASSED

- FOUND: `backend/tests/integration/test_285_stuck_pending_live.py`, `backend/tests/unit/test_285_upload_enqueue_failure.py`, `285-LIVE-EVIDENCE.md`
- FOUND commits: `94b56c56c`, `521bf6491`, `cca4e5a90`, `d27fb6058`
- `verified_closed_by: "285` on BUG-261014-03/04/05 → 3 (and BUG-261014-02, since SC#5 passed)
