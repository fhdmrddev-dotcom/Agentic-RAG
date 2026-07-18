---
phase: 140-smart-dispatch-relevance-pre-filter-stretch
plan: 05
subsystem: database / deploy-parity (smart-dispatch pre-filter — live-runtime half)
tags: [TRIG-02, migration, skill_embeddings, match_skills, pgvector, backfill, full-schema, deploy-parity, D-01, D-04, D-05]

# Dependency graph
requires:
  - phase: 140-01
    provides: "migration 091 (skill_embeddings table + owner-only RLS + two mark-stale triggers + match_skills RPC + app_settings.skill_catalog_max_tokens) + the Plan-01 DB-CHECK suite"
  - phase: 140-02
    provides: "skill_reembed_job / kick_skill_backfill backfill lifecycle + the mock service integration suite"
  - phase: 140-04
    provides: "the over-budget pre-filter branch that consumes match_skills + kick_skill_backfill at runtime"
provides:
  - "migration 091 applied to the live LOCAL DB (skill_embeddings + match_skills + budget column + triggers all physically present)"
  - "skill_embeddings populated by the one-time real-vector backfill (7 rows: 6 for the local owner, 1 for the seed owner)"
  - "supabase/full-schema.sql regenerated from the live DB (no reset) with the migration-091 objects — the single-paste deploy artifact"
  - "the 3-item cloud deploy-parity checklist (non-code half, flagged for deploy time)"
affects: [140-verify-work, 140-VALIDATION, v3.2-cloud-deploy]

# Tech tracking
tech-stack:
  added: []            # zero new packages (threat T-140-SC accept)
  patterns:
    - "CLAUDE.md migration discipline: apply via SQL-editor-equivalent (psycopg2-direct :54322, NEVER db push/db reset), then regenerate-full-schema.sh live-DB dump (no reset), commit full-schema.sql alongside the Plan-01 migration"
    - "one-time backfill invoked off-tree (scratchpad script) via load_app_settings_async() + get_supabase() service-role client + skill_reembed_job — mirrors the reembed_service lifecycle"

key-files:
  created: []
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "Backfilled BOTH local owners with enabled skills (d8a54002 fhdmrd@gmail.com — 6 skills; 00000000-…-001 seed@system.local — 1 skill) so the local pre-filter has vectors for every enabled skill, not just the primary test user."
  - "Task 3 commit is full-schema.sql ONLY — the migration file 091_skill_embeddings.sql was already committed in Plan 01 (02b965f3), so re-committing it would be a no-op/noise."
  - "The one-time backfill ran off the uvicorn-watched tree (scratchpad script), per feedback_no_scratch_in_watched_tree — no .py written under backend/."

patterns-established:
  - "Live-runtime half of a schema-bearing phase = apply (operator-gated) + populate (backfill) + regenerate deploy artifact, kept separate from the code-authoring plans."

requirements-completed: [TRIG-02]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 140 Plan 05: Apply Migration 091 + Skill-Vector Backfill + Deploy Artifact Summary

**Migration 091 applied to the live local DB, `skill_embeddings` populated with 7 real vectors via the one-time backfill (text-embedding-3-small / 1536-dim), and `full-schema.sql` regenerated from the live DB (no reset) with the skill-embedding table + `match_skills` RPC + `skill_catalog_max_tokens` budget column — the live-runtime half of the smart-dispatch pre-filter.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-07T13:49:45Z
- **Tasks:** 3 (Task 1 applied by the orchestrator ahead of this executor; Tasks 2–3 executed here)
- **Files modified:** 1 (`supabase/full-schema.sql`)

## Accomplishments

- **Migration 091 live** (Task 1 — done by the orchestrator before this executor): the `skill_embeddings` table, owner-only RLS, both mark-stale triggers, the `match_skills` cosine RPC, and `app_settings.skill_catalog_max_tokens` (DEFAULT 1500) all physically exist on the local DB (:54322). Applied via psycopg2-direct — the SQL-editor-equivalent path the migration header sanctions — NOT `supabase db push`/`db reset`, so CLAUDE.md data-preserving discipline is honored. The Plan-01 DB-CHECK suite (`test_140_migration_091.py`) is now 5/5 green against the live table.
- **skill_embeddings populated** (Task 2): the one-time backfill (`skill_reembed_job`) ran a **real** embedding round-trip via the configured provider (text-embedding-3-small, 1536 dims) and wrote **7 rows** — 6 for the local owner `d8a54002-…` (docx, meridian-executive-report, pptx, project-brief-summarizer, risk-lens_099uat, weekly-report-writer) and 1 for the seed owner `00000000-…-001` (skill-creator). Every row has a non-NULL embedding + `source_text_hash`. Both jobs returned `status: complete` (0 skipped, 0 failed). The pre-filter now ranks against live vectors instead of degrading to D-05 fail-open (inject-all).
- **Deploy artifact regenerated** (Task 3): `supabase/full-schema.sql` re-dumped from the live DB with NO reset (data preserved), adding 155 lines of migration-091 objects (table + RLS + FK + index + RPC + both triggers + budget column). Not hand-edited — produced by `scripts/regenerate-full-schema.sh`.

## Task Commits

1. **Task 1: [BLOCKING] Operator applies migration 091 to the live LOCAL DB** — applied by the orchestrator (human-action gate) via psycopg2-direct to :54322; migration file itself committed in Plan 01 (`02b965f3`). No new commit here.
2. **Task 2: One-time skill-vector backfill + confirm service integration green** — no source-file change (runtime data population + test run); no commit. Verified: 7 rows in `skill_embeddings` (psycopg2 count), and `test_140_skill_embedding_service.py` + `test_140_migration_091.py` = **17/17 green**; full Phase-140 surface = **32/32 green**.
3. **Task 3: Regenerate full-schema.sql** — `a04b5b00` (feat) — `supabase/full-schema.sql` only.

**Plan metadata:** committed separately (this SUMMARY.md). STATE.md/ROADMAP.md are the orchestrator's to write.

## Files Created/Modified

- `supabase/full-schema.sql` — regenerated from the live DB (no reset); +155 lines: `skill_embeddings` table + owner-only RLS + FK/`idx_skill_embeddings_user_id`, `match_skills(query_embedding, match_user_id, p_embedding_model)` cosine RPC, `stale_skill_embedding` (on `skills`) + `stale_skill_embedding_from_case` (on `skill_test_cases`) triggers, and `app_settings.skill_catalog_max_tokens integer DEFAULT 1500 NOT NULL`.

## Cloud deploy-parity checklist (non-code half — flagged for deploy time, NOT executed now)

This plan touched **local** runtime only. The cloud counterpart is operator-gated per CLAUDE.md deploy-parity discipline and must be applied by hand at the next cloud deploy (mig 078 / harness_judge_model precedent):

1. **Apply migration 091 to cloud Supabase by hand** — paste `supabase/migrations/091_skill_embeddings.sql` into the CLOUD Supabase SQL editor (NEVER `db push`/`db reset`). Objects are idempotent, so a re-run is safe.
2. **Run the cloud skill-vector backfill** — invoke `skill_reembed_job` once per cloud owner with enabled skills so their vectors populate `skill_embeddings` (until then the cloud pre-filter stays D-05 fail-open = inject-all, recall-degraded not broken).
3. **Re-apply any NON-default `skill_catalog_max_tokens`** to cloud `app_settings` — the D-04 default (1500) ships in the column default, so the DEFAULT needs nothing; only a non-default budget value must be re-applied by hand.

## Decisions Made

- Backfilled **both** local owners with enabled skills (not just the primary test user) so every enabled local skill has a live vector.
- Task 3 committed **full-schema.sql only** — the migration file was already committed in Plan 01 (`02b965f3`); re-staging it would add nothing.

## Deviations from Plan

None — plan executed exactly as written. (Task 1's migration apply was completed by the orchestrator ahead of this executor via the sanctioned psycopg2-direct path; Tasks 2–3 ran clean with no auto-fixes.)

## Issues Encountered

None. The backfill's real embedding round-trip succeeded on the first run (app_settings carried a valid LLM/embedding key), so no D-05 fail-open fallback was needed.

## User Setup Required

None for LOCAL (migration applied + backfill run). The CLOUD deploy-parity checklist above is the outstanding non-code half, flagged for the next operator-gated deploy — not required for local verification or `/gsd:verify-work`.

## Threat surface

No new security surface beyond the plan's `<threat_model>`. T-140-10 (unreviewed SQL to live DB) mitigated — the EXACT reviewed migration 091 was applied via the sanctioned SQL-editor-equivalent path, no `db push`/`db reset`. T-140-11 (cross-user vectors) mitigated — the backfill hand-scopes `.eq("user_id", …)` on the read and bakes `user_id` into every upserted row; the 7 rows split cleanly 6/1 across the two owners with zero cross-owner bleed. Zero new packages (T-140-SC accept). No threat flags.

## Known Stubs

None. `skill_embeddings` holds real provider vectors; no placeholder/empty data flows to the pre-filter.

## Next Phase Readiness

- Local: the smart-dispatch pre-filter has live vectors + a live `match_skills` RPC + a live budget column — ready for `/gsd:verify-work` and the 4-axis SC#10 UAT (140-VALIDATION.md).
- Cloud: the 3-item deploy-parity checklist above is the only outstanding work, deferred to the operator-gated deploy.

## Self-Check: PASSED

- FOUND: supabase/full-schema.sql (contains skill_embeddings ×24, match_skills ×5, skill_catalog_max_tokens ×1)
- FOUND commit: a04b5b00 (feat(140-05): regenerate full-schema.sql — 1 file, +155 lines, no deletions)
- VERIFIED: skill_embeddings row count = 7 (primary owner 6 > 0; seed owner 1); zero rows with NULL embedding/hash
- VERIFIED: test_140_skill_embedding_service.py + test_140_migration_091.py = 17/17 green; full Phase-140 surface 32/32 green
- No STATE.md / ROADMAP.md modifications; no unrelated operator scratch staged

---
*Phase: 140-smart-dispatch-relevance-pre-filter-stretch*
*Completed: 2026-07-07*
