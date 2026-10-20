---
phase: 287-start-from-a-thread-fork-a-starter
plan: 02
subsystem: workflows
tags: [starters, migration, tdd, static-gauntlet]
requires: []
provides:
  - "3 new published global template-less starters (shelf now lists 6)"
  - "DB-free static gauntlet over every starter, derived from migrations 094 + 210"
affects: [287-05]
tech-stack:
  added: []
  patterns: ["starter set derived from migration files, never a constant", "planted-defect counterfactuals"]
key-files:
  created:
    - backend/tests/unit/test_287_starter_static_gauntlet.py
    - supabase/migrations/210_starter_workflows_v2.sql
    - scripts/apply_migration_210.py
  modified:
    - scripts/seed-starters.py
    - docs/OPERATOR.md
key-decisions:
  - "New starters are template-less: llm_agent (search_documents) then llm_single; citations_required mode presence; structure_check loose"
  - "D-10 delivered as a bijection test (migration-derived slugs == shelf slugs, all pass static stages), not endpoint code"
requirements-completed: [START-03]
duration: ~35min
completed: 2026-10-19
---

# Phase 287 Plan 02: Three new starters + static gauntlet Summary

Migration 210 ships meeting-notes-to-actions, policy-change-impact and stakeholder-update as published global template-less starters; a DB-free gauntlet proves all six starters pass the static publish stages, with four counterfactuals that fail as they should.

## Tasks and commits

| Task | Commit | What |
|---|---|---|
| 1 RED | `test(287-02)` (first commit) | gauntlet test; 8 failed / 1 passed because 210 did not exist (set parsed only 3 starters: `assert 3 >= 5`; counterfactuals KeyError on the missing subject) |
| 2 GREEN | `feat(287-02)` | migration 210 + `scripts/apply_migration_210.py`; gauntlet + `test_starter_workflows.py` 11 passed |
| 3 | `chore(287-02)` | OPERATOR.md seed list, seed-starters asset guard, 210 VERIFY fix |

Local apply: dry-run 5/5 PASS (rolled back), `--apply` ran twice, starters 3 -> 6 -> 6, second apply inserted nothing, VERIFY identical. Local-DB lock held and released.

## Which validator I extended (binding touch-up)
I did not extend `--validate-migration` beyond the asset guard. `scripts/apply_migration_210.py` reads `210_starter_workflows_v2.sql` (its own VERIFY block, idempotency check). `seed-starters.py --validate-migration` already iterates `assets` only when present (so the 094 re-homing check applies only to starters that declare assets) and its strict checks run on every starter; I fixed only the line-208 KeyError. It passes on both 094 and 210. The publish-stage checks live in the pytest gauntlet.

## Deviations from Plan

1. **[Rule 3 - Blocked] `scripts/regenerate-full-schema.sh` could not run.** It requires docker and `supabase status`; docker is denied in this shell ("Supabase is not running locally"). Migration 210 is DML only (three INSERTs plus a guard DO block, no DDL), so a schema dump of the live DB would not change `supabase/full-schema.sql`. `full-schema.sql` is therefore unmodified. Operator may run the script from an unrestricted shell if desired; expect no diff.
2. **[Rule 1] 210 VERIFY block initially contained a `'[]'::jsonb` literal** that `seed-starters.py`'s `::jsonb` regex parsed as a definition (AttributeError). Replaced with `definition->'assets' is not null`; comment-only change, applied rows unaffected.
3. `docs/OPERATOR.md`: added both 094 (needs `seed-starters.py --upload` for its .docx assets) and 210; count wording 14 -> 16.

## Operator steps (owed)
- **Cloud paste of migration 210** into the cloud Supabase SQL editor (file unmodified). Not done by me. Seed user must have an org_members row in cloud (the migration raises a named error otherwise).
- **Prod slug-collision read-only SELECT: NOT RUN.** The Supabase MCP tools are not available to this agent. Owed before pasting: `select slug, version, created_by from workflow_definitions where slug in ('meeting-notes-to-actions','policy-change-impact','stakeholder-update');` expected 0 rows. A collision raises 23505 even with ON CONFLICT (id).
- Published rows are immutable; wording fixes need a new slug/version.

## Verification
- `pytest tests/unit/test_287_starter_static_gauntlet.py tests/unit/test_starter_workflows.py`: 11 passed.
- `bash scripts/check-deploy-drift.sh`: PASS (one non-blocking docker-compose WARN).
- `node scripts/check-hot-file-ledger.cjs <phase>`: none of this plan's files are row-less; it flags `ThreadWorkflowPicker.tsx` and `useStartWorkflowInThread.ts` (plan 03's new files, not yet existing) as no-row.
- Static stages only: golden run + judge for the 3 new starters is plan 05.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model.

## Self-Check: PASSED
Files exist (test, migration, apply script, this summary); three commits present in `git log`.
