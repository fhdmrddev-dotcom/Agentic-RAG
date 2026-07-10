---
phase: 135-self-improvement-loop-si-01
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rls, skill-proposals, self-improvement, si-01]

# Dependency graph
requires:
  - phase: 132-skill-versioning-eval-test-cases
    provides: skill_versions + skills tables (FK targets for base/new draft version)
  - phase: 133-eval-runner
    provides: eval_runs table (FK targets for source + re-eval run)
  - phase: 134-eval-results-verdict-ratings
    provides: eval_ratings (D-09 judge-disagreement join, consumed by later SI-01 plans)
provides:
  - "public.skill_proposals owner-scoped persistence table (migration 083)"
  - "7-value lifecycle status enum (proposed/rejected/approved/re_evaling/promoted/not_promoted/interrupted)"
  - "FKs into skills, skill_versions (base NOT NULL + new nullable/approval-only), eval_runs (source + re_eval)"
  - "Owner-only RLS SELECT with NO client write policies (service-role router writes only)"
  - "Regenerated supabase/full-schema.sql including skill_proposals"
affects: [135-04-proposer, 135-05-approval-promotion, 135-06, 135-07, 136-skill-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-scoped eval-domain table: owner-only RLS SELECT + NO write policies + service-role router writes (035/079/080/081 precedent)"
    - "Reuse public.set_updated_at() via DROP TRIGGER IF EXISTS + CREATE TRIGGER (never redefine the function)"
    - "D-17 migration discipline: psycopg2 :54322 apply + regenerate-full-schema.sh (no --reset) + paired commit"

key-files:
  created:
    - supabase/migrations/083_skill_proposals.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "new_skill_version_id is INSERTed only on approval (source='self_improve') so skill_versions history stays clean of unapproved drafts; rejections keep their audit trail in skill_proposals with new_skill_version_id NULL (RESEARCH Pitfall #2, D-07)"
  - "Tasks 1 and 2 paired into ONE D-17 commit (migration + regenerated full-schema together) per the plan's Task 2 acceptance criteria, not two separate task commits"
  - "full-schema regenerated from the linked main checkout (worktree is not linked to the running Supabase project) and copied into the worktree; HEADER/SUPPLEMENT parity + shared live DB make the dump identical"

patterns-established:
  - "Locked canonical schema contract: downstream Plans 04/05/06/07 use the exact column + enum names authored here"

requirements-completed: [SI-01]

# Metrics
duration: 15min
completed: 2026-07-02
---

# Phase 135 Plan 01: skill_proposals Persistence Foundation Summary

**Owner-scoped `public.skill_proposals` table (migration 083) — the durable, auditable home for the self-improvement loop: proposed instructions + rationale + evidence summary + a 7-value lifecycle status, FK-linked to skills / skill_versions (base + approval-only draft) / eval_runs (source + re-eval), owner-only RLS SELECT with no client write path.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-02T02:55Z (approx)
- **Completed:** 2026-07-02T03:09:07Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 regenerated)

## Accomplishments
- Authored migration `083_skill_proposals.sql` implementing the LOCKED canonical schema (all 6 FKs, the exact 7-value status CHECK, two indexes, owner-only RLS SELECT, reused set_updated_at trigger, D-17 header block).
- Applied the migration to the live local DB (:54322) via psycopg2 in one transaction — verified `DB_APPLIED_OK` (table + 6 sentinel columns), RLS enabled with a SELECT-only policy (`r`, no write policies), trigger present.
- Regenerated `supabase/full-schema.sql` (no --reset) so the single-file deploy artifact includes `skill_proposals` (all 6 FK constraints + SELECT-only policy captured in the dump).

## Task Commits

Tasks 1 and 2 were committed together as a single D-17 paired commit (the plan's Task 2 acceptance criteria explicitly require the migration + regenerated full-schema in one commit):

1. **Task 1 (author migration 083) + Task 2 (apply live + regenerate full-schema)** - `c73d6983` (feat)

## Files Created/Modified
- `supabase/migrations/083_skill_proposals.sql` - Owner-scoped skill_proposals table: 6 FKs, 7-value lifecycle status CHECK, two indexes, owner-only RLS SELECT (no write policies), reused set_updated_at trigger, D-17 header block.
- `supabase/full-schema.sql` - Regenerated single-file deploy artifact now including skill_proposals (table + FK constraints + trigger + SELECT policy).

## Decisions Made
- **Version-on-approval-only (D-07 / RESEARCH Pitfall #2):** `new_skill_version_id` stays NULL until Plan 05 approves; rejections keep their audit trail here — keeps `skill_versions` history clean of unapproved drafts.
- **Single D-17 paired commit** rather than per-task commits, honoring the plan's explicit "both files staged for one commit" acceptance criteria for the migration/full-schema pairing.
- **Regen ran from the linked main checkout, output copied into the worktree** — the worktree directory is not linked to the running Supabase project (`supabase status` gate fails there), but the dump is a function of the shared live DB + the HEADER/SUPPLEMENT files (byte-parity confirmed at this commit), so the copied artifact is identical to a worktree-native regen.

## Deviations from Plan

None - plan executed exactly as written. (The regen-from-main-checkout mechanics above are an environment adaptation, not a change to the plan's deliverables; both files land in the worktree commit as specified.)

## Issues Encountered
- The worktree's copy of `regenerate-full-schema.sh` aborted at its `supabase status` gate because the worktree directory is not the linked Supabase project dir. Resolved by running the regen from the linked main checkout (identical shared live DB + byte-parity HEADER/SUPPLEMENT) and copying the resulting `full-schema.sql` into the worktree — verified 38/38 `skill_proposals` occurrence parity between the two files.

## User Setup Required
None - the migration was applied autonomously to the live local DB per the established D-17 psycopg2 path. (For cloud deploys, migration 083 must be pasted into the cloud Supabase SQL editor per the standard deployment parity checklist — out of scope for this local plan.)

## Next Phase Readiness
- The persistence foundation is live: Plans 04 (proposer), 05 (approval + promotion), 06, and 07 can now read/write `skill_proposals` using the locked column + enum names.
- No blockers. The additive default-off `skill_instructions_override` seam (the re-eval load-bearing seam) is Plan 02's responsibility, independent of this schema.

## Self-Check: PASSED
- FOUND: `supabase/migrations/083_skill_proposals.sql`
- FOUND: `supabase/full-schema.sql` (regenerated, contains skill_proposals)
- FOUND: commit `c73d6983`

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
