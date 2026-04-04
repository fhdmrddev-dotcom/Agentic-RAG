---
plan: 12-03
phase: 12-skills-ui
status: complete
completed: 2026-04-02
self_check: PASSED
requirements_closed: [SKIL-08]
gap_closure: true
---

## Summary

Created `supabase/migrations/018_skill_creator_seed.sql` — an idempotent SQL migration that seeds the `skill-creator` global skill and its system seed user into the database, closing SKIL-08.

## What Was Built

- **`supabase/migrations/018_skill_creator_seed.sql`** — Idempotent seed migration with two `ON CONFLICT (id) DO NOTHING` INSERTs:
  1. System seed user (`00000000-0000-0000-0000-000000000001`, `seed@system.local`) inserted into `auth.users` to satisfy the FK constraint on `skills.user_id`
  2. `skill-creator` global skill (`00000000-0000-0000-0000-000000000010`) inserted into `public.skills` with `is_global=true`, `is_enabled=true`, and a 3-question guided skill creation flow in the instructions

## Key Files

### Created
- `supabase/migrations/018_skill_creator_seed.sql`

## Decisions

- Used fixed UUIDs (`000...001`, `000...010`) for deterministic idempotency — `ON CONFLICT (id) DO NOTHING` guarantees re-runnable migration
- Used SQL standard `''` escaping (not backslash) for single quotes inside the instructions string
- Seed user inserted directly into `auth.users` (bypassing Supabase Auth API) — acceptable for a migration-time system seed

## Deviations

None — implemented exactly as specified in the plan.

## Self-Check: PASSED

- [x] `supabase/migrations/018_skill_creator_seed.sql` exists
- [x] Contains exactly 2 `ON CONFLICT (id) DO NOTHING` clauses
- [x] Contains `INSERT INTO auth.users` for seed user
- [x] Contains `INSERT INTO public.skills` for skill-creator
- [x] `is_global = true`, `is_enabled = true`
- [x] Instructions contain 3-question flow and `save_skill` tool reference
- [x] Uses `''` SQL escaping (no backslash escapes)
- [x] Committed atomically: `feat(12-03): seed skill-creator global skill migration (SKIL-08)`
