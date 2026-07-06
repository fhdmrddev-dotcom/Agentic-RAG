---
phase: 139-self-improve-proposer-description-only-stretch
plan: 03
subsystem: database
tags: [si-02, skill-proposals, migration, live-db, deploy-artifact]
requires:
  - phase: 139-self-improve-proposer-description-only-stretch
    plan: 01
    provides: "supabase/migrations/090_skill_proposals_description_kind.sql (authored)"
provides:
  - "Migration 090 LIVE on the local DB (:54322) — kind discriminator + proposed_description + scoreboard_snapshot + source_tuner_run_id FK + relaxed proposed_instructions + skill_proposals_kind_fields CHECK"
  - "supabase/full-schema.sql regenerated from the live DB (deploy-parity with 090)"
  - "backend/tests/test_139_migration_090.py — live-DB gate proving the kind-gated CHECK"
affects:
  - "139-04 / 139-05 (description routes + UI against the real schema)"
  - "Phase 139 live UAT (honest schema — no false-positive verification state)"
tech-stack:
  added: []
  patterns:
    - "asyncpg :54322 + rolled-back-tx live-DB test idiom (test_132_skill_versions.py sibling)"
    - "nested savepoint around a deliberate constraint violation so the outer seeded tx survives"
key-files:
  created:
    - backend/tests/test_139_migration_090.py
  modified:
    - supabase/full-schema.sql
decisions:
  - "Migration 090 applied via the operator-gated psycopg2 path (D-14) — never db push/reset; dev data preserved (skill_proposals had 0 rows, no backfill concerns)"
  - "The skill_proposals_kind_fields constraint presence is the definitive applied-gate probe (added LAST in the migration, so it proves the whole file ran)"
metrics:
  duration: "~30 min (including the human-gated apply checkpoint)"
  completed: "2026-07-06"
  tasks: 2
  files: 2
---

# Phase 139 Plan 03: Live Migration Apply + Deploy Artifact Summary

**Migration 090 is live on :54322 (kind-gated skill_proposals CHECK proven by a green asyncpg DB test) and full-schema.sql is regenerated in deploy-parity — the false-positive verification state is closed.**

## What Was Done

### Task 1: Migration-090 DB-CHECK test (commit `8755f69f`)

Created `backend/tests/test_139_migration_090.py` with `test_kind_check_constraint`, mirroring the `test_132_skill_versions.py` live-DB idiom (asyncpg pool on `127.0.0.1:54322`, all writes inside a rolled-back transaction, FK parents `auth.users` → `public.skills` seeded in-tx — the skills INSERT fires the 079 capture trigger, producing the base `skill_versions` row that satisfies `base_skill_version_id NOT NULL`). Both branches asserted:

- **Branch A (rejected):** `kind='description'` + `proposed_description=NULL` → `skill_proposals_kind_fields` CHECK fires, SQLSTATE `23514` (run in a nested savepoint so the deliberate failure doesn't abort the outer tx).
- **Branch B (accepted):** `kind='description'` + `proposed_description` set + `proposed_instructions=NULL` → INSERT succeeds, proving the NOT-NULL relax.

Skip discipline: green-skips when :54322 is unreachable OR when the `skill_proposals_kind_fields` constraint is absent (migration unapplied). Pre-apply run: **1 skipped** (expected per acceptance criteria).

### Task 2: [checkpoint:human-action] Live apply + regen + commit (commit `eaebd826`)

Checkpoint honored — execution STOPPED at the human gate with the verified pre-apply DB state (090 absent, `tuner_runs` FK target present, DB reachable). The operator authorized the psycopg2 path and applied migration 090 to the live DB; the orchestrator verified columns, the relaxed NOT-NULL, the CHECK, and 0-row table (dev data preserved — no `db push`/`db reset` used, D-14 held).

Post-confirmation follow-ups (this agent):
1. `bash scripts/regenerate-full-schema.sh` (NO `--reset`) from the worktree root → `supabase/full-schema.sql` regenerated (4120 lines; latest migration on disk = 090).
2. Verified tokens: `scoreboard_snapshot` (4 hits) + `skill_proposals_kind_fields` (4 hits) + `proposed_description` (6) + `source_tuner_run_id` (6). The diff is exactly the 090 surface (+50/−1: columns, both CHECKs, the tuner_runs FK, column/constraint comments) — nothing else drifted.
3. DB-CHECK test flipped skip → **1 passed** against the live constraint.
4. Post-test DB probe: `skill_proposals` rows = 0, leftover probe skills = 0 — the rollback idiom left zero residue.
5. Committed the regenerated `full-schema.sql` (migration 090 itself already tracked in-tree from Plan 139-01 — deploy-parity pair present in the same tree, T-139-11 satisfied).

## Verification (plan `<verification>` block)

- `grep scoreboard_snapshot supabase/full-schema.sql` → match ✓
- `grep skill_proposals_kind_fields supabase/full-schema.sql` → match ✓
- `pytest tests/test_139_migration_090.py -x -q` → **1 passed** ✓
- Commit `eaebd826` contains the regenerated full-schema.sql; migration 090 tracked in the same tree ✓
- Never `supabase db push` / `db reset` ✓ (T-139-10)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] regenerate-full-schema.sh unrunnable from a worktree**
- **Found during:** Task 2 (post-confirmation follow-up step 1)
- **Issue:** The script's `supabase status` guard fails inside a git worktree — the Supabase CLI derives the container name from the cwd directory name (`supabase_db_agent-a28e8bea…` instead of the real `supabase_db_Agentic_RAG`), so the guard aborts even though Supabase is running. The script's actual work (docker `pg_dump` discovered via `grep '^supabase_db_'`) is cwd-independent.
- **Fix:** A scratchpad PATH shim (`supabase` → `cd "C:/Vibe Apps/Agentic RAG" && exec <real supabase>`) satisfies the status guard from the main-repo context while the script itself runs untouched from the worktree root, so the regenerated artifact lands in the worktree for commit. No repo file was modified; the shim lives in the session scratchpad only.
- **Files modified:** none (temp shim outside the repo)
- **Commit:** n/a (no repo change)

## Authentication Gates

None. The Task-2 human gate was the plan-designed D-14 migration-apply checkpoint (documented above as normal flow), not an auth failure.

## Known Stubs

None — this plan ships schema + test + deploy artifact only; no UI or data-flow surface.

## Threat Flags

None beyond the plan's `<threat_model>`: T-139-10 (destructive apply path) mitigated — SQL-editor/psycopg2 apply only, regen with no `--reset`; T-139-11 (schema drift) mitigated — full-schema.sql regenerated from the live DB and present in the same tree as migration 090. No new network endpoints, auth paths, or trust-boundary surface introduced.

## Self-Check: PASSED

- FOUND: backend/tests/test_139_migration_090.py
- FOUND: supabase/full-schema.sql (contains `scoreboard_snapshot` + `skill_proposals_kind_fields`)
- FOUND: commit `8755f69f` (test)
- FOUND: commit `eaebd826` (full-schema regen)
- Test result: 1 passed against the live DB
- Live-DB residue check: skill_proposals rows = 0, probe skills = 0
