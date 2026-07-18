# Phase 138 — Deferred / Out-of-Scope Items

Discovered during execution but NOT fixed (per SCOPE BOUNDARY — only auto-fix
issues directly caused by the current task's changes).

## Pre-existing test rot (unrelated to RUN-01a)

**`backend/tests/unit/test_sandbox_service.py::TestHarvestOutputFiles`** — 3 failures
at the phase base commit (`6d4b8623`), NOT introduced by Plan 138-01:

- `test_harvest_files_uploads_and_inserts`
- `test_harvest_files_empty_output`
- `test_harvest_files_storage_path_format`

**Root cause:** these tests assert `current_files_set == {"output.csv"}` (a set of
filenames), but since Phase 075.4 the second return value of
`harvest_output_files()` is `current_files_dict` keyed by **SHA-256 content-hash**
(`sandbox_service.py:343`), not by filename. The tests were never updated for the
075.4 hash-key pivot.

**Why out of scope for 138-01:** Plan 138-01 does NOT touch `sandbox_service.py`
(D-07/D-08 — harvest upload/insert side deliberately untouched) and does NOT touch
`test_sandbox_service.py`. Confirmed `git diff --stat backend/app/services/sandbox_service.py`
shows no changes. These failures reproduce on the base commit independently of this plan.

**Suggested disposition:** a small test-maintenance quick-task to update the three
assertions to the hash-key shape (mirror `test_075_4_dedup_supersedes.py`, which
already uses the content-hash keying correctly). Candidate for `/gsd:fast` or a
backlog note — not a 138 blocker.
