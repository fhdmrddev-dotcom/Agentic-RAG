---
phase: 270-the-document-as-an-object
plan: 01
subsystem: ingest / schema
tags: [file-facts, migration-199, pypdf, python-docx, hot-file-ledger]
requires: []
provides:
  - "documents.page_count / source_created_at / source_modified_at / source_author (typed, nullable)"
  - "app_settings.document_download_url_ttl_seconds (default 60, CHECK 10-900)"
  - "read_file_facts(raw, mime) -> FileFacts (pure, never raises)"
affects: [270-02, 270-03, 270-04, 271]
key-files:
  created:
    - supabase/migrations/199_document_file_facts.sql
    - backend/app/services/file_facts.py
    - backend/tests/unit/test_270_file_facts.py
    - backend/tests/unit/test_270_splice_writes_facts.py
    - .planning/phases/270-the-document-as-an-object/270-BASELINES.md
  modified:
    - backend/app/services/ingest_splice.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - docs/OPERATOR.md
    - .planning/seeds/SEED-313-upload-never-stamps-the-active-org.md
    - .planning/seeds/SEED-318-upload-versioning-retires-an-expert-install-copy.md
decisions:
  - "Facts UPDATE is skipped when every fact is None (nothing to record; saves a round trip and never overwrites on a failed parse)"
  - "D-03 wording deviation kept: page count lives in new file_facts.py, extraction_service.py untouched (plan-flagged)"
metrics:
  tasks_done: "2 of 3 (Task 3 deferred to orchestrator)"
  completed: 2026-10-02
---

# Phase 270 Plan 01: File facts at ingest + migration 199 Summary

**Every newly ingested or re-ingested PDF/DOCX now records its pages, the dates the file itself claims, and its author in typed nullable columns, through one pure never-raising reader and one best-effort UPDATE; unreadable facts stay NULL.**

## Status: Tasks 1 and 2 complete; Task 3 DEFERRED to the orchestrator (main tree)

Task 3 (`checkpoint:human-action`: apply migration 199 to the LIVE LOCAL DB, run it twice, verify, regenerate
`supabase/full-schema.sql` without `--reset`) was NOT attempted here, per instruction — it mutates the shared
local Postgres and must run in the main tree. Nothing in this worktree touched the DB or `full-schema.sql`.
The orchestrator owes: apply `supabase/migrations/199_document_file_facts.sql` (twice, idempotency), the
verify queries in plan Task 3 (5 columns, TTL 60, 0 backfilled rows, policy sets unchanged, RLS true on both,
3600 probe rejected by `app_settings_download_ttl_bounds`), then `bash scripts/regenerate-full-schema.sh`.
Until applied, the facts write degrades (logged warning), it does not break ingest (T-270-04, tested).

## Commits

| # | Commit | What |
|---|---|---|
| 1 | `55993cc3c` docs(270-01) | frozen baselines (before any source edit) |
| 2 | `961606096` docs(270-01) | 6 ledger rows + sections, CLAUDE.md G-5 row for `models/document.py`, SEED-313/318 routed LEAVE |
| 3 | `9b0dce8ea` feat(270-01) | migration 199 + OPERATOR.md prose |
| 4 | `fd249b422` test(270-01) | RED tests |
| 5 | `423c2750d` feat(270-01) | `file_facts.py` + `splice_document` write (GREEN) |

## Baselines (PHASE_BASE `26308281a`, see 270-BASELINES.md)

- Backend: `71 failed, 6052 passed ... [GATE PASSED] (failed: 71 <= 71, errors: 0)`. After Task 2:
  `71 failed, 6067 passed` — **failed SET identical** (zero new, zero turned green).
- Vitest gate RED at base, inherited: `total 9107 · failed 8 · pinned 8354`; the 8 named in BASELINES (SEED-171
  suites + WorkflowCanvas axe + standing `sketchComposition`). No frontend file touched by this plan; not re-run.
- tsc app config: 70 errors at base (set recorded). No frontend change.
- Note: the worktree initially started on `417bb0bd7`; reset to PHASE_BASE as the plan's base check requires.

## RED evidence

`ModuleNotFoundError: No module named 'app.services.file_facts'` (file-facts suite collection error) and
2 of 5 splice tests failing (`test_facts_are_written_in_one_separate_update`,
`test_a_facts_timeout_issues_no_update_and_ingest_continues`) before implementation. GREEN: 29 passed
(both new suites + `test_ingest_splice.py`).

## Gates

- `check-hot-file-ledger.cjs 270` exit 0 (was 6 `[no-row]`); `check-claude-md-size.cjs` OK (118,102 chars);
  new CLAUDE.md row disposition < 200 chars.
- `check-seeds-register.cjs` OK (335/335). `check-deploy-drift.sh` PASS (highest listed seed 198; 199 is DDL-only).
- Acceptance greps: migration has 0 INSERT/UPDATE statements, 5 `COMMENT ON COLUMN`, one `page_count > 0` CHECK,
  one `BETWEEN 10 AND 900`; OPERATOR.md has 0 `199_*.sql` filename mentions.
- `extraction_service.py` NOT modified; no `ingestion_step` literal added in `ingest_splice.py` or `file_facts.py`.

## Seeds routing (`check-seeds-register.cjs --phase 270`, 16 matched at planning)

SEED-313, SEED-318: **LEAVE** — `status_note` written (touched trigger path, upload org-stamping/versioning
unchanged). The other 14, matched only through broad globs, are LEAVE (seed files not edited):

| Seed | Route / reason |
|---|---|
| SEED-054, 177, 185, 188, 198, 262, 280, 284, 290, 317 | LEAVE — matched via broad globs (`backend/app/**`, `frontend/src/**`, `**/ingest_splice.py`, ledger/gate/full-schema paths); this plan adds no behaviour they describe |
| SEED-266 | LEAVE — full-schema is regenerated, not hand-edited; no ACL added |
| SEED-306 | LEAVE — fact columns are owner-writable via the existing documents UPDATE policy; a user can only mis-state their own file's facts |
| SEED-287 | LEAVE — this phase adopts its suites file-level |
| SEED-326 | LEAVE — migration 199 is DDL-only, not seed-like |

## Deviations from Plan

None in behaviour. Two small choices: the facts UPDATE is skipped when all four facts are None (documented in
Decisions); the DOCX NUL-stripping assertion tests `_clean_author` directly because python-docx/lxml refuse to
write a NUL into a DOCX (a PDF string can carry one; the cleaner is the single home).
Process: the `bash scripts/bootstrap-worktree.sh "$(pwd)"` form was refused by the sandbox; bootstrapped with the
literal worktree path instead (BOOTSTRAP OK).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-270-01..06 mitigated as specified: 10 s timeout, one-member bounded DOCX read
via bytes regex, author clean/cap, separate try/except write, CHECK 10-900).

## Self-Check: PASSED

Files verified present: file_facts.py, migration 199, both test files, 270-BASELINES.md. Commits `55993cc3c`,
`961606096`, `9b0dce8ea`, `fd249b422`, `423c2750d` exist on `worktree-agent-afef72f3a35ac4b19`.
