---
phase: 136-skill-publish-gate-gate-01
plan: 01
subsystem: api
tags: [fastapi, supabase, pydantic, pytest, rls, eval-gate, publish-gate]

# Dependency graph
requires:
  - phase: 132-skill-versioning-eval-persistence
    provides: skill_versions table (instructions pinned per version) — the D-04 binding target
  - phase: 133-eval-runner
    provides: eval_runs table + owner-scoped eval read patterns (evals.py _verify_owned_skill / run_in_threadpool idiom)
  - phase: 134-eval-results-verdict-ratings
    provides: migration 081 passed_count/measured_count rollup — the D-03 authoritative numeric rule the gate recomputes
  - phase: 135-self-improvement-loop
    provides: promotion near-duplicate-version behavior (the D-04 content-equality nuance) + 083 append-only owner-RLS migration precedent + _FilterSupabase test scaffold
provides:
  - migration 084 skill_publish_overrides (append-only owner-only-SELECT-RLS override audit table), applied live + full-schema regenerated (D-11)
  - compute_publish_gate(supabase, skill_id, user_id) -> PublishGate — the ONE gate-compute read-model (D-03 numeric pass rule + D-04 content-equality current-version binding + last_override)
  - PublishGate + TogglePublishBody Pydantic contracts (app.models.skill) for Plan 02 enforcement + Plan 03 frontend mirror
  - backend/tests/test_publish_gate.py — shared _seed fixtures + 5 green gate-compute tests + 6 skipped enforcement stubs Plan 02 fills
affects: [136-02 enforcement, 136-03 frontend, 136-04, 137-skill-evals-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate compute = recompute-on-read from NUMERIC columns (never verdict_summary text) — evals.py _compute_gate contract"
    - "D-04 content-equality version binding: passing run's skill_versions.instructions == live skills.instructions (never version-id equality)"
    - "Two-query runs->versions Python join (RESEARCH Pattern 1 FK-embed equivalent) so the in-memory test fake exercises the production path"
    - "Append-only override audit table: owner-only SELECT RLS, NO write policies, service-role writes (035/079/080/081/083 precedent)"

key-files:
  created:
    - supabase/migrations/084_skill_publish_overrides.sql
    - backend/app/services/publish_gate_service.py
    - backend/tests/test_publish_gate.py
  modified:
    - backend/app/models/skill.py
    - supabase/full-schema.sql

key-decisions:
  - "Two-query join (eval_runs then skill_versions.in_) instead of PostgREST FK-embed — plan-sanctioned equivalent (RESEARCH Pattern 1 fallback) chosen so the in-memory _FilterSupabase store exercises the exact production code path instead of an untestable embed branch"
  - "Mixed-history precedence: passed_on_older_version beats latest_failed (the more actionable pointer — re-eval the current version); proven by seeding a NEWER failing run alongside the stale-content pass"
  - "Interrupted-only history reads state=never_evaled (no COMPLETED evidence exists) — the completed-only filter also adversarially excludes non-completed rows carrying counts"
  - "compute_publish_gate raises LookupError on a not-owned/missing skill as a defense-in-depth backstop; Plan 02 endpoints owner-verify before compute (evals.py precedent)"

patterns-established:
  - "PublishGate.last_override normalized to {gate_state, created_at} (or None) regardless of read source — contract-exact for the Plan 03 TS mirror"
  - "Worktree Supabase-CLI workaround: SUPABASE_WORKDIR=<main repo> lets regenerate-full-schema.sh run unmodified from a git worktree (CLI derives project-id from dirname)"

requirements-completed: [GATE-01]

# Metrics
duration: 13min
completed: 2026-07-03
---

# Phase 136 Plan 01: Publish-Gate Read Model Summary

**compute_publish_gate read-model enforcing D-03 (measured>=1 AND passed==measured, completed-only) + D-04 content-equality version binding, migration 084 append-only override audit table applied live, and the PublishGate/TogglePublishBody contracts Plan 02/03 consume**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-03T03:02:28Z
- **Completed:** 2026-07-03T03:15:18Z
- **Tasks:** 3 (Task 3 TDD: RED -> GREEN -> REFACTOR)
- **Files modified:** 5

## Accomplishments

- `compute_publish_gate(supabase, skill_id, user_id) -> PublishGate` — the ONE gate helper every enforcement + UI surface will read: recomputes `met` from the NUMERIC `passed_count`/`measured_count` columns (byte-identical to the migration-081 finalize rule, promoted to the authoritative publish rule per D-03), binds a passing run to the skill's CURRENT instructions by content-equality (D-04 — a manual edit honestly resets the gate, while a 135-promotion near-duplicate version with identical text still reads "current version passed"), and carries `last_override` ({gate_state, created_at} of the most-recent force-publish, D-02).
- Migration 084 `skill_publish_overrides` authored on the 083 precedent (append-only, owner-only SELECT RLS, NO write policies — service-role writes; app-code `.eq(user_id)` is the real gate), applied to the live local DB via psycopg2 :54322 (never db push/reset), verified via `to_regclass` + pg_policies, and committed together with the regenerated `full-schema.sql` (D-11).
- `PublishGate` + `TogglePublishBody` Pydantic models exported from `app.models.skill` (flat house style; `SkillCreate.is_global` untouched — Plan 02 hard-sets it server-side).
- Test module with the shared `_seed` fixture (skills + N versions supporting the identical-text/distinct-id near-dup case + eval_runs with honest NULL rollup on non-completed + overrides) — 5 gate-compute tests green, 6 named enforcement stubs collected + skipped for Plan 02. Owner-scoping (`.eq(user_id)` on every read) and `run_in_threadpool` wraps on ALL supabase calls (D-v2.5-01) satisfy T-136-04/05/07 mitigations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Test scaffold + shared fixtures (Wave 0)** - `5c899497` (test)
2. **Task 2: [BLOCKING] Migration 084 skill_publish_overrides, applied live** - `7ec69d2b` (feat)
3. **Task 3: Gate models + compute_publish_gate read-model (TDD)** - `6451373e` (test RED) -> `16e1e977` (feat GREEN) -> `4d00b645` (refactor)

## Files Created/Modified

- `supabase/migrations/084_skill_publish_overrides.sql` - Append-only override audit table: gate_state + gate_snapshot jsonb + created_at; skill/version/user FKs; owner-only SELECT RLS, zero write policies
- `supabase/full-schema.sql` - Regenerated from the live DB (no reset); diff is purely the 084 additions (88 lines)
- `backend/app/models/skill.py` - PublishGate (met/state/measured/passed/passing_run_id/reason/last_override) + TogglePublishBody (override: bool = False), additive
- `backend/app/services/publish_gate_service.py` - compute_publish_gate: 4 owner-scoped threadpool-wrapped reads (skills, completed eval_runs, pinned skill_versions, last override); D-03 predicate + D-04 content-equality; state precedence passed > passed_on_older_version > latest_failed > never_evaled
- `backend/tests/test_publish_gate.py` - _seed fixtures + 5 green gate-compute tests + 6 skipped Plan-02 enforcement stubs (all 11 RESEARCH Test Map names collect)

## Decisions Made

1. **Two-query join instead of PostgREST FK-embed** — the plan's primary read shape was `select("..., skill_versions(instructions)")`; the RESEARCH Pattern 1 fallback (fetch runs, then `skill_versions.in_(ids)`, join in Python) is documented as equivalent, and the in-memory `_FilterSupabase` fake cannot resolve embeds — implementing the embed would have left the production branch untested. The two-query path IS the production path and is fully exercised by all five tests.
2. **Mixed-history precedence** implemented exactly per plan: `passed_on_older_version` beats `latest_failed`; `test_edit_after_pass_resets_gate` seeds a NEWER numerically-failing completed run alongside the stale-content pass to prove it.
3. **Interrupted-only history → `never_evaled`** (no completed evidence exists), with an adversarial seeded non-completed row carrying passing counts to prove the `status == "completed"` filter is load-bearing, not just the NULL-rollup convention.
4. **last_override coverage pulled into Task 3** — `test_gate_met_after_passing_eval_current_version` seeds two override rows and asserts the NEWEST is returned, directly covering the must-have truth "PublishGate carries the most-recent owner-visible override record" ahead of Plan 02's end-to-end test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `supabase status` fails inside git worktrees — regenerate-full-schema.sh could not run as-is**
- **Found during:** Task 2 (migration apply + schema regen)
- **Issue:** The Supabase CLI derives the project id from the working-directory name; from the worktree it looked for container `supabase_db_agent-ad9a177eaa9420eac` (real container: `supabase_db_Agentic_RAG`), so the script's `supabase status` guard aborted.
- **Fix:** Ran the script UNMODIFIED with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"` so the CLI resolves the main-repo project while the script's own `REPO_ROOT` stays worktree-rooted — output written to the worktree's `supabase/full-schema.sql` from the live DB.
- **Files modified:** none (env-var only)
- **Verification:** Script completed ("Latest migration on disk: 084_skill_publish_overrides.sql"); diff purely 084 additions.
- **Committed in:** `7ec69d2b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only). The two-query read shape is a plan-sanctioned alternative (documented in-plan as "equivalent"), not a deviation.
**Impact on plan:** No scope creep; all plan contracts delivered as specified.

## Known Stubs

The 6 enforcement tests in `backend/tests/test_publish_gate.py` are INTENTIONAL Wave-0 stubs (`pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")`), designed by the plan for Plan 02 to fill: `test_toggle_global_blocked_when_no_passing_eval`, `test_toggle_global_allowed_after_passing_eval`, `test_force_publish_records_override`, `test_create_skill_ignores_body_is_global`, `test_import_and_save_skill_stay_private`, `test_unshare_never_gated_reshare_regated`. No UI/data stubs exist — this plan ships no UI and no hardcoded-empty values.

## Issues Encountered

None beyond the worktree/Supabase-CLI blocker documented above.

## User Setup Required

None - no external service configuration required. (Cloud parity note for the eventual deploy: migration 084 must be pasted into the cloud Supabase SQL editor — standard checklist item, not a local setup step.)

## Next Phase Readiness

- Plan 02 (enforcement) can consume `compute_publish_gate` + `TogglePublishBody` + the 6 named test stubs immediately; migration 084 exists live so the override INSERT will not false-green against the in-memory store.
- Plan 03 (frontend) has the exact `PublishGate` JSON contract (incl. normalized `last_override: {gate_state, created_at} | null`) to mirror in `types/index.ts`.
- Verification snapshot: 5 gate-compute tests green; adjacent suites (`test_skill_proposals_router`, `test_evals_router`, `test_skill_proposals`) green (19 passed / 6 skipped); `git diff --name-only` vs base shows exactly the 5 planned files — no agent-loop / threads.py / provider-gateway touch (D-10).

## Self-Check: PASSED

- All 5 files exist on disk (verified via `[ -f ]`): migration 084, full-schema.sql, models/skill.py, publish_gate_service.py, test_publish_gate.py
- All 5 commits exist in git log: `5c899497`, `7ec69d2b`, `6451373e`, `16e1e977`, `4d00b645`
- TDD gate sequence verified in log: test (`6451373e`) -> feat (`16e1e977`) -> refactor (`4d00b645`)
- Live DB: `to_regclass('public.skill_publish_overrides')` non-null; RLS enabled; exactly one SELECT policy; both indexes present

---
*Phase: 136-skill-publish-gate-gate-01*
*Completed: 2026-07-03*
