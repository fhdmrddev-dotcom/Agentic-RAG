---
phase: 139-self-improve-proposer-description-only-stretch
plan: 01
subsystem: database
tags: [postgres, supabase, migration, pydantic, fastapi, skill-proposals, si-02]

# Dependency graph
requires:
  - phase: 135-self-improvement-loop
    provides: "skill_proposals table (mig 083) + SkillProposalResponse contract (eval_run.py) — the SI-01 substrate SI-02 extends"
  - phase: 123.1-trigger-tuner
    provides: "tuner_runs table (mig 077, UNIQUE(skill_id) latest-wins) — the provenance FK target"
provides:
  - "Migration 090 — additive skill_proposals kind discriminator + description-side columns + provenance FK + kind-gated CHECK (authored, not yet applied)"
  - "Extended SkillProposalResponse carrying kind, proposed_description, base_description, scoreboard_snapshot, source_tuner_run_id (FastAPI-strip-safe)"
  - "ProposeDescriptionBody request contract (run_id only)"
affects: [139-02, 139-03, si-02, description-proposer, skill-tuner, evals-router]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot-not-FK for mutable upstream evidence (RESEARCH Pattern 1) — copy the scoreboard inline, FK the tuner run for provenance only"
    - "ONE proposals table + kind discriminator (D-11) — instruction and description proposals share one lifecycle, one audit trail, one response contract"
    - "Kind-gated partial CHECK below route validation as a second DB-level integrity gate"

key-files:
  created:
    - "supabase/migrations/090_skill_proposals_description_kind.sql"
  modified:
    - "backend/app/models/eval_run.py"

key-decisions:
  - "D-11: SI-02 reuses the SI-01 skill_proposals table + status enum, filtered by a new kind ('instruction'|'description') discriminator — no second table"
  - "source_tuner_run_id is provenance-ONLY (ON DELETE SET NULL); the displayed evidence is copied inline into scoreboard_snapshot because tuner_runs mutates latest-wins (RESEARCH Pitfall 1)"
  - "No status-enum migration and no new RLS policy — description proposals use only proposed/rejected/approved/promoted (D-07) and the 083 owner-only SELECT covers the new columns"
  - "instruction fields default to '' so a kind='description' row serializes without a FastAPI validation error"

patterns-established:
  - "Pattern 1: Snapshot-not-FK — mutable upstream evidence is copied inline, the FK is audit-only"
  - "Pattern 2: kind-discriminated ONE-contract persistence + one Pydantic response model for both proposal kinds"

requirements-completed: [SI-02]

# Metrics
duration: 3min
completed: 2026-07-06
---

# Phase 139 Plan 01: SI-02 Persistence + Response Contract Summary

**Migration 090 extends skill_proposals with a kind discriminator + description-side columns (proposed_description, scoreboard_snapshot, provenance-only source_tuner_run_id) behind a kind-gated CHECK, and SkillProposalResponse + a new ProposeDescriptionBody lock the non-stripped response shape for the Wave 2 description routes.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-06T14:40:37Z
- **Completed:** 2026-07-06T14:44:15Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Authored `090_skill_proposals_description_kind.sql`: additive `ALTER TABLE public.skill_proposals` adding `kind` (default 'instruction'), `proposed_description`, `scoreboard_snapshot` (jsonb), and `source_tuner_run_id` (FK → tuner_runs, ON DELETE SET NULL); relaxed `proposed_instructions` to nullable; installed the `skill_proposals_kind_fields` partial CHECK with both kind branches. Pure additive — no CREATE TABLE, no DROP, no status-enum migration, no new RLS policy.
- Extended `SkillProposalResponse` with the five SI-02 fields (declared so FastAPI does not strip fields the description routes write) and relaxed `proposed_instructions`/`base_instructions` to default `""` so a description-kind row serializes cleanly.
- Added `ProposeDescriptionBody(run_id: str)` — mirrors `ProposeBody` but carries only the ephemeral tuner run-buffer id; owner/skill come from the caller + path (T-135-02), the route sets `kind='description'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 090 — additive kind + description columns + kind-gated CHECK** - `d094fa13` (feat)
2. **Task 2: Extend SkillProposalResponse + add ProposeDescriptionBody** - `e2cf6295` (feat)

_Plan metadata (SUMMARY) committed separately in worktree mode._

## Files Created/Modified
- `supabase/migrations/090_skill_proposals_description_kind.sql` - Additive skill_proposals extension: kind discriminator, description columns, provenance FK, relaxed instruction NOT-NULL, kind-gated partial CHECK. Authored only; live apply happens in Plan 139-03.
- `backend/app/models/eval_run.py` - `SkillProposalResponse` extended with `kind` / `proposed_description` / `base_description` / `scoreboard_snapshot` / `source_tuner_run_id` (+ relaxed instruction fields); new `ProposeDescriptionBody`.

## Decisions Made
None beyond the plan — followed the locked D-11 / RESEARCH Pattern 1 shapes exactly (snapshot-not-FK, ONE table + kind discriminator, no enum/RLS change).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The backend `venv` is not present in the worktree (gitignored, lives in the main repo). Resolved by running the Task 2 import verification with the main-repo venv interpreter and `PYTHONPATH` pointed at the worktree's `backend/` — the module is self-contained (only pydantic/datetime/uuid at load), so it imports cleanly in isolation. Verify printed `OK`; an extra construct test confirmed a `kind='description'` row serializes without instructions.

## User Setup Required
None in this plan. NOTE: migration 090 is **authored, not applied** — the live DB apply (paste into Supabase SQL editor / psycopg2 :54322) + `bash scripts/regenerate-full-schema.sh` (no `--reset`) + commit of the regenerated `full-schema.sql` happens in the [BLOCKING] Plan 139-03.

## Next Phase Readiness
- Persistence + response contract are locked for the Wave 2 description propose/approve/reject routes (Plan 139-02) — they can write `kind='description'` rows and serialize the full description contract without FastAPI stripping fields.
- Plan 139-03 (blocking-human) applies migration 090 to the live DB and regenerates `full-schema.sql`.
- No stubs introduced (the nullable columns are the intended persistence contract for Wave 2 to populate, not placeholder data flowing to UI).

## Self-Check: PASSED
- FOUND: `supabase/migrations/090_skill_proposals_description_kind.sql`
- FOUND: `backend/app/models/eval_run.py` (SI-02 fields present)
- FOUND commit: `d094fa13` (Task 1)
- FOUND commit: `e2cf6295` (Task 2)

---
*Phase: 139-self-improve-proposer-description-only-stretch*
*Completed: 2026-07-06*
