# Phase 285 — live evidence

Every row below was measured against the **real local stack**: Postgres on :54322, GoTrue, PostgREST
and Storage on :54321, and for SC#5 the real Microsoft Graph API behind the dev account's OneDrive
connection. Each run held the local-DB lock. A skip counts as a failure of the row, never as a pass.
Migration 209 was applied locally in plan 01. Measured 2026-10-16 at HEAD `521bf6491`, with plans
01-03 code in the tree. Phase base: `c8c764e90`.

| SC arm | Status | Evidence |
|---|---|---|
| SC#1 failed watch item is retried (FIX-12) | ✅ PASS | live `test_285_watch_retry_live.py`, RED first (plan 01) |
| SC#2 door 1 (DELETE watch, purge) keeps a dedup-linked hand upload (FIX-13) | ✅ PASS | hand upload `1 -> 1`, row present; minted `1 -> 0`, row gone |
| SC#2 door 2 (POST watch purge) keeps a dedup-linked hand upload | ✅ PASS | hand upload `1 -> 1`; minted `1 -> 0`; receipt `purged_count=1 kept_count=1` |
| SC#2 shared (W1-minted, W2 still references it) | ✅ PASS | `1 -> 1`, row present |
| SC#2 sibling (a PRESENT item of the same watch links it) | ✅ PASS | `1 -> 1`, row present |
| SC#3 enqueue failure does not strand (FIX-14) | ✅ PASS | RED live at `94b56c56c`, GREEN at `521bf6491` |
| D-14 heal (migration 209), rolled back | ✅ PASS | P enqueued, Q failed, R untouched |
| SC#4 FIX-02 + DEBT-10 still hold | ✅ PASS | 7 live suites `48 passed`, 0 skipped, at `521bf6491` |
| SC#5 live OneDrive re-drive | ✅ **PASS — 105 / 105** | A 95 + B 10, all `completed`; forced `ConnectError` seen, then landed |

## SC#1 — a failed watch item is retried (FIX-12 / BUG-261014-02)

Plan 01 (`55caeb445` RED → `9e9af4a1e` GREEN). The live case drives two real syncs of a real watch
with the adapter's download made to raise an empty-message `httpx.ConnectError` once.

RED, against the old service (sync 2 never read the failed file again):
```
EVIDENCE sync1 item={'state': 'failed', 'failed_attempts': 0, 'minted': False, 'last_error': '', 'document_id': None}
         run={'status': 'success', 'count_errors': 1, 'count_new': 0, 'last_error': None}
E           assert 1 == 2        # adapter.reads — sync 2 never read the failed file again
```

GREEN (`1 passed`, 0 skipped):
```
EVIDENCE sync1 item={'state': 'failed', 'failed_attempts': 1, 'minted': False, 'last_error': 'ConnectError', 'document_id': None}
         run={'status': 'success', 'count_errors': 1, 'count_new': 0, 'last_error': '1 file failed: 285-team-note-79e187.txt (ConnectError)'}
EVIDENCE sync2 item={'state': 'present', 'failed_attempts': 0, 'minted': True, 'last_error': None, 'document_id': UUID('7c3d6357-…')}
         doc_status=pending run={'status': 'success', 'count_errors': 0, 'count_new': 1, 'last_error': None}
```
`connector_watches.last_error` was asserted NULL after sync 1. Re-run green at `521bf6491` (SC#4 row).

## SC#2 — purge deletes only what the watch minted and nobody else uses (FIX-13 / BUG-261014-03)

Plan 02 (`3da27d1aa` RED → `4bcce53a1` GREEN). RED, against the old doors, the hand upload's bytes
went `1 -> 0` and its row was gone at both doors. GREEN, from the wave-gate run:
```
EVIDENCE door 1 (DELETE watch, purge_documents=true) | hand upload, dedup-linked | c7cf3298-…/82ab3092-…/285-ps-d1-hand-8b2a2d.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 1 (DELETE watch, purge_documents=true) | watch-minted, unshared | c7cf3298-…/c768a9d9-…/285-ps-d1-minted-d7505c.txt | storage.objects 1 -> 0 | documents row after: gone
EVIDENCE door 2 (POST watch purge, state=missing) | hand upload, dedup-linked | f8767f95-…/620f0cb0-…/285-ps-d2-hand-96605f.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 2 (POST watch purge, state=missing) | watch-minted, unshared | f8767f95-…/07197ecf-…/285-ps-d2-minted-4a995c.txt | storage.objects 1 -> 0 | documents row after: gone
EVIDENCE door 2 (POST watch purge, state=missing) | receipt | purged_count=1 kept_count=1 | message='Purged 1 missing or disconnected file(s). Kept 1 that is also in your Library from another source or a hand upload.'
EVIDENCE door 2 on W1 (D-08: also referenced by W2) | W1-minted, W2 still references it | 451c180a-…/22b56303-…/285-ps-shared-408629.txt | storage.objects 1 -> 1 | documents row after: present
EVIDENCE door 2 (D-08: a PRESENT sibling item of the same watch) | minted by item A (missing), linked by item B (present) | 25ed983e-…/9a5a7bbc-…/285-ps-sibling-169c0a.txt | storage.objects 1 -> 1 | documents row after: present
```
The watch-minted rows are the positive control: a minted, unshared document is still purged with its
bytes, so the check can fail and DEBT-10 holds. BUG-261014-05 (`remove_document_bytes` reports only
what Storage confirmed) is closed by `14a70e94f` and its unit pins (285-02 Task 3).

## SC#3 — an upload that could not be queued is marked failed (FIX-14 / BUG-261014-04)

Live `test_enqueue_failure_does_not_strand_and_reupload_ingests`: both enqueue paths forced to fail,
then the same bytes uploaded into a different folder.

RED, against unmodified `documents.py` (`94b56c56c`; `4 failed, 4 passed`):
```
EVIDENCE SC#3 upload 1 (both enqueue paths forced to fail) -> HTTP 201 body.status='pending' | row status='pending' step=None | ingestion_jobs=0
EVIDENCE SC#3 upload 2 (same bytes, folder B) -> HTTP 200 already_in_library=True new_id=False | row status='pending' folder_is_B=False | ingestion_jobs=0
E       AssertionError: upload 1 answered 'pending'
```
That is the bug exactly: a pending row with no job, and the folder-B upload absorbed by it.

GREEN (`521bf6491`; `42 passed`, 0 skipped):
```
EVIDENCE SC#3 upload 1 (both enqueue paths forced to fail) -> HTTP 201 body.status='failed' | row status='failed' step='failed' | ingestion_jobs=0
EVIDENCE SC#3 upload 2 (same bytes, folder B) -> HTTP 201 already_in_library=None new_id=True | row status='pending' folder_is_B=True | ingestion_jobs=1
```

## D-14 — the migration 209 heal, executed live in a rolled-back transaction

```
EVIDENCE D-14 heal (rolled back) P: status='pending' jobs=['pending'] error=None
EVIDENCE D-14 heal (rolled back) Q: status='failed' jobs=[] error='This file was never read, because its upload did not finish. Please upload it again.'
EVIDENCE D-14 heal (rolled back) R: status='pending' jobs=[] error=None
```
P (>1 h, bytes present) got exactly one pending job. Q (>1 h, no bytes) was marked failed with no
job. R (recent) was untouched. The transaction was rolled back; cleanup was proven by SQL count 0.

## SC#4 — FIX-02 and DEBT-10 still hold on the merged tree

Re-run at `521bf6491`, under the lock, 2026-10-16:
```
tests/integration/test_280_same_bytes_live.py tests/integration/test_280_purge_bytes_live.py
tests/integration/test_280_cr01_two_org_live.py tests/integration/test_285_stuck_pending_live.py
tests/integration/test_285_purge_scope_live.py tests/integration/test_285_watch_retry_live.py
tests/integration/test_275_disposition.py
48 passed, 267 warnings in 121.47s (0:02:01)      # 0 skipped
```
- `git diff --quiet c8c764e90 -- backend/app/services/ingest_splice.py backend/app/db/ingestion_jobs.py backend/tests/integration/test_280_same_bytes_live.py` exits 0. The minter's in-flight leg is byte-unchanged and the FIX-02 test ran unmodified.
- Closed core (D-21): `test_259_closed_core_inventory.py` `7 passed` (7 phase types / 1 emitter / 30 tools), and `git diff --quiet c8c764e90 -- backend/app/services/harness/ backend/app/services/tool_dispatcher.py backend/app/services/tools/` exits 0.

## SC#5 — live OneDrive re-drive (D-17, D-18)

**Status: ✅ PASS — 105 / 105.**

**The operator's decision (D-18), asked 2026-10-16:** *"option-a (Recommended)"*. That means D-17 as
written, step 2 on a temporary watch C, deleted WITHOUT purge. It was the explicit OK for the drive,
including the OAuth token refresh through the app's own `oauth_refresh_service` path.

**Driver:** `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-285/drive_sc5.py`. It lives outside the
repo and is not tracked. It follows the 280 precedent (`resync_a.py`) and calls
`WatchService(pool, supabase=get_supabase()).sync_watch(w)` directly. The forced failure is a
class-level patch of `MicrosoftGraphSourceAdapter.read_file` inside the driver process only, so there
is no product test knob (280 D-14). Token values were never printed. Log:
`.../agentic-rag-285/drive_sc5.log`; state: `.../drive_sc5_state.json`. It ran under the local-DB
lock from 17:03:47Z to 17:04:18Z.

Watches: A = `0aa5c6ac-062a-4ff6-9a63-4acfed09a5d6` (`/Team Docs`); B =
`05d93b24-8bd4-421a-8265-fbc9447c7a3b` (`/Team Docs/Q3 Plans`); connection
`34e44621-9ed3-4502-a857-1e2373c4707e` (Microsoft, `oauth_byo`).

| Step | Measured | Verdict |
|---|---|---|
| Before | A: 95 items, **94** present with a non-failed doc, `team-note-058.txt` `state='failed'`, `failed_attempts 0`, `last_error ''`, doc NULL. B: 10/10. Both `is_active=false`. Access token expired `2026-10-14 16:40:54Z` | 104 / 105 (the 280 measurement) |
| Token refresh (app path, `get_fresh_access_token`) | ok; `expires_at` → `2026-10-16 18:03:47Z` | ✅ |
| Step 1: `sync_watch(A)` as it is | result `success`, counts `new 1, errors 0` (11.7 s). `team-note-058.txt` → `state='present'`, `minted=true`, `last_error NULL`, doc `310aeac5-cd34-4ed3-816c-346ea0685b9a`. Run row `7beb29eb…`: `success`, `count_new 1`, `count_errors 0`, `last_error NULL`, `listing_complete true`. `connector_watches.last_error` NULL | ✅ the legacy failed item was retried and landed |
| After step 1 | A **95** present-ok of 95, `failed_items 0`. B **10** of 10 | ✅ **105 / 105** |
| Step 2, sync 1 of temporary watch C (`6b231dbe-2e67-4a1b-bef7-54db89a01e4a`, over B's folder, inserted `is_active=false`) with `read_file` raising `httpx.ConnectError("")` once for `q3-plan-01.txt` | forced raises: 1. Item `state='failed'`, `failed_attempts 1`, `last_error 'ConnectError'`, doc NULL. Run row `3afcab26…`: `status success`, `count_new 9`, `count_errors 1`, `last_error '1 file failed: q3-plan-01.txt (ConnectError)'`. `connector_watches.last_error` **NULL** | ✅ a typed item failure plus a run row naming the file; the watch row stays clean |
| Step 2, sync 2 of C (no patch) | item `state='present'`, `failed_attempts 0`, `minted=false`, `last_error NULL`, doc `3f7dae58-e7d3-4c8a-91f0-586056898999`, which is **B's own document for that file** (status `completed`). Run row `f8d21b98…`: `success`, `count_new 1`, `count_errors 0`, `last_error NULL`. All 10 C items `minted=false`, and 10 of 10 link to B's document for the same external id | ✅ landed, dedup-linked (live D-06 marker evidence) |
| Delete C, `purge_documents=false` (the route's non-purge arm is exactly `db.watches.delete_watch`) | `delete_watch` true; C rows 0, C items 0 (cascade). B's 10 `(name, document_id, status, updated_at)` tuples identical before and after; 10 of 10 B paths still in `storage.objects`. A and B `is_active=false` | ✅ nothing of B touched |
| Completion | A 95/95 `completed`, B 10/10 `completed`; stragglers: none (`team-note-058.txt` was `completed` by the first poll) | ✅ the ingest worker on :8000 took the new document to completed |

## D-15 — the seven-caller enqueue audit (orchestrator ruling 9)

| # | Caller | Mint site | Enqueue failure before 285 | Needs D-12 |
|---|---|---|---|---|
| 1 | /documents/upload | api/documents.py:615 | log.error, 201, pending row with no job | YES, only when ingest_worker_enabled is true |
| 2 | watch new-file | watch_service.py (new-file body) | except arm marks item + this-iteration doc failed | No (confirmed; plan 01 corrected the target) |
| 3 | watch modify | watch_service.py (modify arm) | except arm marks this-iteration doc failed | No (plan 01 correction) |
| 4 | import_service.import_single_file | sources/import_service.py:237 | _enqueue_or_splice → BackgroundTask splice with bytes in memory | No |
| 5 | workspace_promote | api/workspace_promote.py:215 | same _enqueue_or_splice | No |
| 6 | expert_install_service | :603 | same _enqueue_or_splice (incl. _redrive_failed) | No |
| 7 | email_attachments | :357 | no queue; inline ingest; except marks failed | No |

The residual for #4-#6 is a process restart that loses the BackgroundTask. The D-14 heal covers it,
because the heal finds stuck rows by state, not by door.

## Accepted residuals (recorded, not fixed)

- **D-12 race (a).** The asyncpg insert commits, then raises on the way back, and the fallback also
  raises. The doc is marked failed while a job exists. The worker does not check status and ingests
  it, so this heals itself.
- **D-12 race (b).** A same-bytes upload in the milliseconds between the mint and the D-12 write gets
  the in-flight copy as `already_in_library`, which then turns failed. The person re-uploads.
- **Retention over-report (orchestrator ruling 7).** After D-10, `retention/disposition.py` reports a
  path that was already absent from Storage under `bytes_not_removed`. This fails safe: no deletion is
  claimed that Storage did not confirm.
- **Retired earlier failed versions (RESEARCH §2).** When a retried item mints a new document, the
  earlier failed row this watch minted stays as a retired (`is_latest=false`), failed history
  version that still owns its path. A later purge removes only the document the item points at, so
  those retired versions stay behind. The modify arm already behaved this way; 285 does not change it.

## OWED operator actions (D-23)

1. **Paste migration 209 into the production SQL editor**, then run its VERIFY block. Production read
   on 2026-10-16: 0 watch items and 0 stuck rows, so this is a data no-op there. ⛔ **Deploy order:**
   209 BEFORE the backend, because `_WATCH_ITEM_COLUMNS` selects `failed_attempts, minted`.
2. `supabase/full-schema.sql` is already regenerated locally (plan 01). Nothing is owed there.
3. Run **`get_advisors(security)`** at deploy parity.
4. No env var changes. `WATCH_PROCESS_ENABLED` and `RETENTION_SWEEP_ENABLED` are untouched.
