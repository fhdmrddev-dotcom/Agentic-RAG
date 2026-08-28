# Deferred items found during 214-02

Plan-scoped filename deliberately: four executors run this phase in parallel worktrees, and a
shared `deferred-items.md` would collide on merge. The orchestrator can fold these into the
phase-level list.

## OUT OF SCOPE — pre-existing, NOT caused by this plan

### `backend/tests/unit/test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration` is RED at HEAD

- **Observed:** `AssertionError: Left contains 5 more items, first extra item:
  '124_workflow_schedules.sql'`
- **Mechanism:** the case diffs `supabase/migrations/`'s listing against Phase 200.1's base SHA
  (`4ffae459…`) and asserts equality. Five migrations (124–128) have landed since, so it reds on
  every commit after 200.1 regardless of what any later plan does.
- **Provably unmodified by this plan:** `git status --short` for 214-02 lists four files, none of
  them under `supabase/migrations/`. This plan writes no migration.
- **Not fixed here** (executor scope rule): the repair is a one-line re-baseline of that suite's
  own SHA constant, which belongs to whoever owns that file — and re-pointing another plan's
  fence from inside this one would silently re-baseline a guard nobody asked to move.
- **Suggested disposition:** `/gsd:fast` (G-3 — one file, one line, no schema or API surface).
