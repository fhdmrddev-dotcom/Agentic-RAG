---
phase: 285-watch-and-re-upload-close-out
verified: 2026-10-16T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
deferred: []
---

# Phase 285: Watch and Re-upload Close Out. Verification Report

**Phase Goal:** A failed watch download is retried, a purge deletes only what the watch minted, and a never-started ingest does not absorb same-bytes uploads.
**Status:** passed. Re-verification: No.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Failed watch item is re-read next sync; run row shows exception type and file name (FIX-12) | VERIFIED | `watch_service.py` has `WATCH_ITEM_MAX_FAILED_ATTEMPTS = 3`, a retry_failed path and a cap that stays visible. Live evidence shows RED (reads 1, not 2, `last_error None`) then GREEN (`1 file failed: ... (ConnectError)`, sync 2 `present`). CR-02 fixed after review, with a RED pin. |
| 2 | Both purge doors delete only minted and unshared docs; hand upload keeps row and bytes (FIX-13) | VERIFIED | `db/watches.py::watch_purge_scope` reads the `minted` marker, never connection provenance, and keeps shared docs. Both doors in `sources.py` call it (lines 337 and 472). Live evidence covers both doors, shared and sibling arms, and the minted positive control. CR-01 was fixed after review. |
| 3 | Both enqueue paths failing does not leave a pending row; later same-bytes upload ingests (FIX-14) | VERIFIED | `documents.py` `/upload` sets `enqueued` and marks the row `failed` (guarded by `.eq("status","pending")`, worker-enabled only). Migration 209 heals stranded rows. `ingest_splice.py` is byte-unchanged against base. Live RED at `94b56c56c`, GREEN at `521bf6491`. |
| 4 | 280 guarantees (FIX-02, DEBT-10) still hold | VERIFIED | `test_280_minter_sequence.py` and the 280 purge tests pass. The 7 live suites were recorded at 48 passed. The in-flight leg is untouched. |
| 5 | Live OneDrive re-drive 105/105 after a forced transient failure | VERIFIED | `285-LIVE-EVIDENCE.md`: 95 + 10, all `completed`, forced `ConnectError` seen and then landed. I did not re-run it, because it needs live credentials and a shared DB. |

**Score:** 5/5

## "How we'd know this failed" checks

- Retry runs forever: capped at 3 and the item stays named in the run row.
- Purge keys on `source_connection_id`: no. It keys on the `minted` marker, and the migration backfill is tightened.
- Stuck-row fix races a live worker: guarded by `status = 'pending'`, and the heal only touches rows with no job.
- In-flight leg loosened: `ingest_splice.py` is unchanged.
- Mock-only fix: RED was driven live for SC#1, SC#2 and SC#3.

## Behavioral spot-check

Targeted suite run by me: `test_285_watch_retry`, `test_285_purge_scope`, `test_285_upload_enqueue_failure`, `test_285_migration_209_shape`, `test_280_minter_sequence`, `test_watches_db`. Result: **113 passed**.

## Requirements Coverage

| ID | Plans | REQUIREMENTS.md | Status |
|---|---|---|---|
| FIX-12 | 285-01, 285-03 | `[x]`, Phase 285 Complete | SATISFIED |
| FIX-13 | 285-01, 285-02, 285-03 | `[x]`, Phase 285 Complete | SATISFIED |
| FIX-14 | 285-01, 285-03 | `[x]`, Phase 285 Complete | SATISFIED |

No orphaned requirement IDs.

## Anti-patterns

No TBD, FIXME or XXX markers in the modified source files. No stubs found.

## Notes (not gaps)

- Migration 209 is applied locally only (8/8 verify). The **production apply is an operator paste and must precede the backend deploy** (D-23). The schema-drift gate's "db push not run" flag is by design under CLAUDE.md.
- Review leftovers (WR-01 orphan half, WR-02, WR-03, IN-01..06) are accepted or deferred, with reasons in the REVIEW fix log. None of them makes a success criterion unmet.
- I did not run the full backend gate. The orchestrator reports 71 failed, with the failing set identical to base.

_Verified: 2026-10-16_
_Verifier: Claude (gsd-verifier)_
