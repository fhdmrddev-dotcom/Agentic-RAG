---
phase: 116-document-relationships-backend-agent-tool
plan: 04
subsystem: database
tags: [relationships, migration, idempotency-index, unique-index, full-schema, psycopg2-direct, race-immune, pytest, supabase]

# Dependency graph
requires:
  - phase: 116-01
    provides: "migration 075 FILE (the additive partial unique index DDL) + document_relationship_service idempotent create (the 23505-catch the index makes race-immune)"
  - phase: 116-02
    provides: "test_116_idempotency.py with the race-immune assertion authored as an index-gated xfail (a runtime pg_indexes probe auto-promotes it once the index lands)"
provides:
  - "Migration 075 (document_relationships_idempotency_idx — the partial unique index over (user_id, source_doc_id, target_doc_id, rel_type)) CROSSED INTO the live local DB :54322 via psycopg2-direct (no db push/reset; dev data preserved 36→36 docs / 0→0 edges)"
  - "supabase/full-schema.sql regenerated via the no-reset live dump, now reflecting the 075 index (present twice — the table-level index + the standalone CREATE)"
  - "test_116_idempotency.py race-immune assertion un-marked + GREEN live on :54322 (a duplicate insert hits the 23505 unique-violation → the service returns the existing edge → exactly one row)"
  - "scripts/apply_migration_075.py — the psycopg2-direct apply script (audit-trail artifact, mirrors the 072/073/074 precedent)"
affects: [117-relationship-panel, 116-verify-phase, 116-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-gated migration-apply at a BLOCKING checkpoint: apply psycopg2-direct → read-back from pg_indexes + assert dev-data row counts preserved → regenerate full-schema.sql (no --reset) → un-mark the index-gated test → operator confirms on DB evidence (the 100/102/111/114 precedent — NEVER db push/reset)"
    - "Index-gated test promotion: the race-immune assertion was authored (Plan 02) as an xfail keyed to a runtime pg_indexes probe; applying the index live un-gates it by construction (no test rewrite — the design proves itself)"

key-files:
  created:
    - scripts/apply_migration_075.py
  modified:
    - supabase/full-schema.sql
    - backend/tests/integration/test_116_idempotency.py

key-decisions:
  - "Autonomous psycopg2-direct apply (local stack up): the plan's Task-1 autonomous path was available, so the apply ran via scripts/apply_migration_075.py (mirroring scripts/apply_migration_072.py — idempotent CREATE UNIQUE INDEX IF NOT EXISTS, read-back from pg_indexes, no reset). The operator confirmed on the DB evidence rather than performing the apply manually."
  - "Committed the apply script (Rule 2): scripts/apply_migration_075.py is an audit-trail artifact matching the tracked 072/073/074 precedent (apply scripts are kept under scripts/, not throwaway). No behavior change to app code."
  - "No hand-edit of full-schema.sql: regenerated solely via scripts/regenerate-full-schema.sh (no --reset) per the CLAUDE.md hard rule; the index lines are produced by the live dump, not authored."

patterns-established:
  - "Pattern: the additive idempotency index is the SOLE race-immune guarantee — the app-code SELECT-then-INSERT 23505-catch (Plan 01) only becomes TOCTOU-safe once the unique constraint is live to throw (Pitfall 3 closed)"

requirements-completed: [REL-01]

# Metrics
duration: ~10min (apply + regen + un-mark; the blocking operator gate spanned the confirmation interval)
completed: 2026-06-20
---

# Phase 116 Plan 04: Migration 075 Idempotency Index — Live Apply Summary

**Migration 075 (`document_relationships_idempotency_idx` — the additive partial unique index over `(user_id, source_doc_id, target_doc_id, rel_type)`) crossed into the live local DB `:54322` via psycopg2-direct (no `db push`/`db reset`, dev data preserved 36→36 docs / 0→0 edges), `supabase/full-schema.sql` regenerated via the no-reset dump, and the race-immune half of `test_116_idempotency.py` un-marked + GREEN live — the SOLE race-immune idempotency guarantee the app-code 23505-catch relies on is now live, and the operator confirmed on the four DB-evidence items.**

## Performance

- **Duration:** ~10 min (apply + regen + test un-mark; the blocking operator gate spanned the confirmation interval)
- **Tasks:** 2 (1 auto apply + 1 BLOCKING human-verify, operator-approved)
- **Files modified:** 3 (1 created `scripts/apply_migration_075.py` + 2 modified `supabase/full-schema.sql`, `backend/tests/integration/test_116_idempotency.py`)

## Accomplishments
- **Migration 075 is live on `:54322` (no reset, dev data preserved):** `scripts/apply_migration_075.py` (psycopg2-direct, mirroring `scripts/apply_migration_072.py`) ran `CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx ON public.document_relationships (user_id, source_doc_id, target_doc_id, rel_type)` in one transaction, read back from `pg_indexes` that the index exists, and asserted existing row counts preserved (documents 36→36, document_relationships 0→0 — proving no `db reset` wipe, the CLAUDE.md hard rule). Re-verified live: the index def is `CREATE UNIQUE INDEX document_relationships_idempotency_idx ON public.document_relationships USING btree (user_id, source_doc_id, target_doc_id, rel_type)`.
- **`full-schema.sql` regenerated (not hand-edited):** `bash scripts/regenerate-full-schema.sh` (no `--reset` — the default no-reset live dump) rebuilt the bootstrap artifact; `document_relationships_idempotency_idx` now appears in it (2 occurrences — the table-attached index + the standalone `CREATE UNIQUE INDEX` block). Produced by the dump script, never hand-authored.
- **The race-immune idempotency assertion un-marked + GREEN live:** `test_duplicate_create_returns_existing_one_row` in `backend/tests/integration/test_116_idempotency.py` was un-gated (the Plan-02 index-gated xfail auto-promotes now that the live `pg_indexes` probe finds the index) — a duplicate `(source, target, rel_type)` insert hits the live 23505 unique-violation → the service re-fetches and returns the existing edge → exactly one matching row in the DB. `test_116_idempotency.py` is green live on `:54322` (2 passed).
- **The BLOCKING operator gate cleared on DB evidence:** the operator confirmed the four DB-evidence items (index live over the 4-tuple, dev data preserved no-wipe, `full-schema.sql` regenerated with the index, idempotency test green), independently re-verified by the orchestrator before approval.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply migration 075 to :54322 (psycopg2-direct, no reset) + regenerate full-schema.sql + un-mark the race-immune idempotency assertion** - `f5ace0b6` (feat)
2. **Task 2: Operator confirms migration 075 is live (DB evidence)** - checkpoint:human-verify (blocking), no code commit — operator typed "approved" on the four DB-evidence items, orchestrator-reconfirmed

**Plan metadata:** _this SUMMARY + tracking updates_ (docs: complete plan)

## Files Created/Modified
- `scripts/apply_migration_075.py` - **CREATED.** psycopg2-direct apply script (mirrors `scripts/apply_migration_072.py`): single-transaction `CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx`, read-back from `pg_indexes`, dev-data row-count preservation assertion (no reset). Committed as an audit-trail artifact per the 072/073/074 precedent.
- `supabase/full-schema.sql` - regenerated via `scripts/regenerate-full-schema.sh` (no `--reset`); now contains `document_relationships_idempotency_idx` (2 occurrences). Not hand-edited.
- `backend/tests/integration/test_116_idempotency.py` - the race-immune `test_duplicate_create_returns_existing_one_row` assertion un-marked (the Plan-02 index-gated xfail auto-promotes once the index is live); green on `:54322` (2 passed).

## Decisions Made
- **Autonomous psycopg2-direct apply (local stack up):** the plan's Task-1 autonomous path was available (the `:54322` stack was up), so the apply ran via `scripts/apply_migration_075.py` rather than the SQL-editor fallback. The operator confirmed on the DB evidence instead of performing the apply manually — the blocking gate is a verification gate, not a manual-apply gate (the plan's Task-2 framing).
- **Committed the apply script:** `scripts/apply_migration_075.py` is kept under `scripts/` as an audit-trail artifact matching the tracked `apply_migration_072.py`/`073`/`074` precedent — apply scripts are NOT throwaway here. No app-code behavior change.
- **No hand-edit of `full-schema.sql`:** regenerated solely via the no-reset dump per the CLAUDE.md hard rule; the index lines are dump output, not authored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Committed the psycopg2-direct apply script as a tracked audit-trail artifact**
- **Found during:** Task 1 (applying migration 075)
- **Issue:** The plan's `files_modified` lists only `supabase/full-schema.sql` + `test_116_idempotency.py`; the apply itself needed an apply script. The tracked precedent (`scripts/apply_migration_072.py`, `073`, `074`) keeps these scripts under version control as the audit trail of HOW each migration crossed into the live DB (the 100/102/111/114 pattern) — leaving it untracked would break that precedent and lose the apply provenance.
- **Fix:** Authored `scripts/apply_migration_075.py` (idempotent `CREATE UNIQUE INDEX IF NOT EXISTS`, read-back from `pg_indexes`, dev-data row-count preservation assertion, no reset) mirroring `apply_migration_072.py`, and committed it alongside the regenerated `full-schema.sql` + the un-marked test.
- **Files modified:** scripts/apply_migration_075.py (created)
- **Verification:** the script applied the index live (read-back confirmed `document_relationships_idempotency_idx` exists over the 4-tuple); dev data preserved (documents 36→36, document_relationships 0→0 — no wipe); committed in `f5ace0b6`.
- **Committed in:** `f5ace0b6` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical — the tracked apply-script artifact matching the established 072/073/074 precedent). No behavior/scope change to app code; threads.py untouched.
**Impact on plan:** The migration apply, the no-reset regeneration, and the race-immune test un-mark are exactly as planned. The one deviation preserves the apply-provenance audit trail the prior migration phases established.

## Issues Encountered
- **The working tree carries many unrelated pre-existing modifications** (GSD tooling churn under `.claude/`, plus `backend/README.md` shown `D` — the 075.4-era pre-existing deletion noted in the 116-03 SUMMARY). All left untouched (SCOPE BOUNDARY); only the three plan-owned files were staged individually for `f5ace0b6` (never `git add .`/`-A`). No file deletions introduced by this plan.

## User Setup Required
None - the apply ran autonomously against the live local stack (`:54322` was up), and the operator confirmed on the DB evidence. No external service configuration required. Migration 075 is now LIVE — no further apply step remains for this phase.

## Next Phase Readiness
- **Phase 116 execution is COMPLETE (4/4 plans):** the substrate (01), the REST write surface (02), the agent tool (03), and now the live idempotency index (04) all shipped. The race-immune idempotency guarantee the app-code 23505-catch relies on is live; the SC#1 "links don't orphan + a `relationship.create` audit lands live" bar is met end-to-end.
- **Verify/secure/validate gates:** the phase is ready for `/gsd:verify-work 116` (SC#1/#2 must-haves + the SC#10 4-axis cross-provider UAT authored in VALIDATION.md). The agent tool's LIVE two-user leak proof (Plan 03) and the now-live idempotency index (this plan) are the secure-phase backstops. No blockers.
- **Phase 117 (relationship panel)** consumes the REST write surface (Plan 02) + the both-directions/inverse-label/per-viewer-mask contract (Plan 03) — the schema substrate is fully live.

## Self-Check: PASSED

All claims verified below.

---
*Phase: 116-document-relationships-backend-agent-tool*
*Completed: 2026-06-20*
