---
phase: 090-harness-schema-rls-config-models
plan: 02
subsystem: database
tags: [supabase, migrations, rls, harness, workflows, schema]
dependency_graph:
  requires: [017_skills.sql, 018_skill_creator_seed.sql, 030_missing_tables.sql, 054_workspace_files.sql, 055_todos_table.sql]
  provides: [workflow_definitions, workflow_runs, workflow_phases, harness_audit, threads.active_workflow_run_id]
  affects: [Phase 091 harness engine, Phase 092 dual-mode wiring, 090-01 WorkflowDefinition.model_validate fixture]
tech_stack:
  added: []
  patterns: [immutable-on-publish BEFORE UPDATE trigger (NEW), ON DELETE RESTRICT FK (new to codebase), 2-hop JOIN FK-chain RLS, INSERT-only audit table, org_id forward-compat column]
key_files:
  created:
    - supabase/migrations/056_workflow_definitions.sql
    - supabase/migrations/057_workflow_runs.sql
    - supabase/migrations/058_workflow_phases.sql
    - supabase/migrations/059_harness_audit_and_threads_col.sql
  modified: []
decisions: [D-01, D-02, D-03, D-04, D-05, D-06, D-08, D-09, D-10, D-11, D-12, T-090-06]
metrics:
  duration: ~25m
  completed: 2026-05-31
  tasks: 3
  files: 4
---

# Phase 090 Plan 02: Harness Schema + RLS Migrations Summary

Authored the four-file Postgres substrate (migrations 056–059) for the workflow harness: `workflow_definitions` (owner+global RLS, UNIQUE(slug,version), immutable-on-publish trigger keyed on `OLD.status`, one parseable global seed), `workflow_runs` (the codebase's first `ON DELETE RESTRICT` FK + 1-hop RLS), `workflow_phases` (2-hop JOIN RLS + composite index), and the INSERT-only `harness_audit` table + `threads.active_workflow_run_id` column — all `RLS ENABLE`d with an `org_id uuid NULL` forward-compat column. Files are authored only; live-DB application is Plan 03's manual SQL-editor task (CLAUDE.md forbids `db push`/`db reset`).

## What Was Built

| Task | File | Commit | Provides |
|------|------|--------|----------|
| 1 | `056_workflow_definitions.sql` | `38ea57b7` | workflow_definitions + ownership/global RLS (globals reserved to seed) + UNIQUE(slug,version) + immutable-on-publish trigger + 1 global llm_single seed |
| 2 | `057_workflow_runs.sql`, `058_workflow_phases.sql` | `1f5ff3f3` | runs (RESTRICT FK + 1-hop RLS), phases (2-hop JOIN RLS incl. UPDATE/DELETE + (run_id, phase_index) index, output jsonb) |
| 3 | `059_harness_audit_and_threads_col.sql` | `da28c742` | INSERT-only harness_audit (SELECT+INSERT only, plain run_id, SC#3 event-type CHECK) + threads.active_workflow_run_id (no deep_mode_metadata) |

## Key Decisions Honored

- **T-090-06 (resolved security flag, option b):** the `workflow_definitions` INSERT policy uses `WITH CHECK (auth.uid() = created_by AND is_global = false)` — regular users can only author PRIVATE definitions; globals come ONLY from seed migrations (write as SQL-editor superuser, bypassing RLS). Stricter than the 017 skills precedent; documented in 056. Operator tier deferred to v2.9 (D-03).
- **D-04 immutability conditional on published state:** the `workflow_definitions_block_published_update()` trigger keys on `OLD.status = 'published'`, so a draft row (including the draft→published transition itself) stays editable; once published, all updates `RAISE ... USING ERRCODE = 'check_violation'` (SQLSTATE 23514, assertable in verify_090.sql).
- **D-05/D-06:** `UNIQUE(slug, version)` + `definition_id` FK `ON DELETE RESTRICT` (the ONE FK behavior new to the codebase — every prior shipped FK is CASCADE/SET NULL).
- **D-09/D-10 (HARNESS-06):** `harness_audit.run_id` is a plain stored uuid with NO FK (audit survives run deletion); table has EXACTLY a SELECT(owner) + INSERT(owner) policy — no UPDATE/DELETE policy means RLS denies all mutation (INSERT-only).
- **D-11:** all four tables carry `org_id uuid` (nullable, no FK) with the verbatim forward-compat COMMENT; RLS stays user-scoped.
- **D-12:** only `threads.active_workflow_run_id` added (FK to workflow_runs, `ON DELETE SET NULL`); `deep_mode_metadata` is NOT created.
- **Seed fixture (RESEARCH OQ1 / SC#5):** the single global seed ships a FULL `WorkflowDefinition`-shaped `definition` jsonb (slug/version/name/status/phases[] with one `llm_single` PhaseSpec) so 090-01's `WorkflowDefinition.model_validate(row["definition"])` parses cleanly. Real 2–3 templates are Phase 091's job.

## Static Verification (the acceptance bar — no live DB this plan)

All plan-specified greps pass:
- Filenames exactly `056_`…`059_` (no letter suffix that the Supabase CLI silently skips).
- 056: `UNIQUE (slug, version)` ✓, `CHECK (status IN ('draft', 'published'))` ✓, `OLD.status = 'published'` + `ERRCODE = 'check_violation'` ✓, SELECT `auth.uid() = created_by OR is_global = true` ✓, INSERT `auth.uid() = created_by AND is_global = false` ✓, seed user `…0001` ✓, org_id ✓.
- 057: `REFERENCES workflow_definitions(id) ON DELETE RESTRICT` ✓, `REFERENCES threads(id) ON DELETE CASCADE` ✓, 4× 1-hop RLS predicate ✓, RLS enabled ✓.
- 058: 4× `JOIN workflow_runs wr ON wr.thread_id = t.id` (all SELECT/INSERT/UPDATE/DELETE) ✓, `idx_workflow_phases_run(workflow_run_id, phase_index)` ✓, RLS enabled ✓.
- 059: `run_id uuid` plain (no REFERENCES) ✓, SC#3 event types (`phase_transition`/`gate_passed`/`gate_failed`/`tool_refused`) ✓, ZERO `FOR UPDATE`/`FOR DELETE` policies (INSERT-only) ✓, `ADD COLUMN active_workflow_run_id … ON DELETE SET NULL` ✓, `deep_mode_metadata` appears only in the negation comment ✓.

Live-DB behavior (immutability refusal 23514, DELETE RESTRICT 23503, UNIQUE 23505, cross-user RLS = 0 rows, INSERT-only policy introspection, presence of 4 tables + `threads.active_workflow_run_id`) is verified in Plan 03 via `verify_090.sql` after the SQL-editor apply.

## Deviations from Plan

None — plan executed exactly as written. The four migrations are copy-with-rename of shipped analogs (017/018/030/054/055) plus the one NEW immutable-on-publish trigger, exactly as the plan and PATTERNS.md prescribed.

## Execution Note (worktree base)

This worktree branch (`worktree-agent-a692afd2d818b517e`) was spawned from `57cbe4ef` (the v2.7→master merge) rather than `v2.5-dev` (tip `24c3d90f`), where the active v2.8 milestone and the 090 phase docs live. The migration head is identical on both (`055_todos_table.sql`), so the new files 056–059 do not collide regardless. The 090 plan/context/research/pattern files were read read-only via `git show v2.5-dev:…` (no working-tree rewind — both `git reset --hard v2.5-dev` and `git checkout v2.5-dev -- …` were blocked by the auto-mode classifier as protected-ref operations, and the worktree-branch-check forbids self-recovery by force-rewinding). The four authored SQL files therefore sit on the v2.7-merge base; the orchestrator's wave-merge step should reconcile this against `v2.5-dev` when integrating. The SUMMARY.md itself is committed into the (otherwise empty in this worktree) phase directory.

## Known Stubs

None. The single seed row is intentional (D-02 + RESEARCH OQ1 fixture) and explicitly noted as the proven seed MECHANISM; the real 2–3 templates are Phase 091's scope.

## Self-Check: PASSED

- FOUND: supabase/migrations/056_workflow_definitions.sql
- FOUND: supabase/migrations/057_workflow_runs.sql
- FOUND: supabase/migrations/058_workflow_phases.sql
- FOUND: supabase/migrations/059_harness_audit_and_threads_col.sql
- FOUND commit: 38ea57b7 (Task 1)
- FOUND commit: 1f5ff3f3 (Task 2)
- FOUND commit: da28c742 (Task 3)
