---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 01
subsystem: database
tags: [harness, eval, migration, seed-workflow, postgres, supabase, jsonb]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    provides: PROGRAMMATIC_PHASE_REGISTRY (closed registry + register_programmatic decorator), 5 phase-type executors, workflow_definitions schema
  - phase: 092-dual-mode-wiring-continue-button
    provides: seed-workflow row shape (migration 061 analog — seed user, published+is_global posture)
provides:
  - "eval_slow_step registered programmatic fn — ~20s asyncio.sleep then delegates to split_topic (pure, idempotent); the only humanly-killable mid-programmatic window (D-08 / SC#4)"
  - "Migration 066: published global eval_coverage workflow (id 00000000-0000-0000-0000-0000000000c1) touching ALL 5 phase types: programmatic -> llm_batch_agents -> llm_agent -> llm_human_input -> llm_single"
  - "Seed row LIVE in local DB (operator SQL-editor apply, psycopg2-asserted) — resolvable by slug eval_coverage"
  - "full-schema.sql regenerated from live DB (no reset) and committed alongside"
affects: [096-06 eval extension (drives eval_coverage per provider), 096-07 restart smoke (3 kill points incl. mid-programmatic), 096-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["slow-but-pure programmatic fn: deliberate sleep is NOT a side effect — output deterministic, resume-safe (Pattern 3)", "5-type max-coverage seed: empty validators on every phase so live cross-provider eval never depends on a regex gate"]

key-files:
  created:
    - supabase/migrations/066_eval_coverage_seed.sql
  modified:
    - backend/app/services/harness/programmatic.py
    - supabase/full-schema.sql

key-decisions:
  - "eval_slow_step delegates to split_topic for output shape ({sub_questions: [...]}) — no duplicated clause-split logic"
  - "All 5 phases ship validators: [] — gate-retry coverage stays deterministic in the CI structural test (Plan 02), never a live-eval dependency"
  - "input_keys: [topic, kickoff_prompt] on phase 0 — migration-065 lesson: live runs carry kickoff_prompt, not topic"
  - "full-schema.sql is schema-only by design (pg_dump --schema-only); seed DATA rows never appear in it — 061 precedent confirmed, plan's grep criterion documented as unsatisfiable, gap logged as DI-096-01-A"

patterns-established:
  - "Mid-phase kill window: hold a programmatic phase active for EVAL_SLOW_STEP_SECONDS (20) so operator-driven uvicorn kills are real, never faked"
  - "Seed-user meta via jsonb_build_object constructor style (identical values to 061's string literals)"

requirements-completed: [EVAL-01, EVAL-02]

# Metrics
duration: ~18min active (plus ~5.5h operator checkpoint wait for SQL-editor apply)
completed: 2026-06-07
---

# Phase 096 Plan 01: Eval Coverage Seed Summary

**Published global `eval_coverage` workflow live in the local DB touching all 5 phase types, with a new ~20s `eval_slow_step` programmatic fn giving the operator a real mid-programmatic kill window**

## Performance

- **Duration:** ~18 min active execution (tasks 1-2 by prior executor in a worktree; task 3 resumed after operator checkpoint)
- **Started:** 2026-06-06T21:05:00Z (approx, prior executor)
- **Completed:** 2026-06-07T02:45:00Z
- **Tasks:** 3/3 (task 3 was a blocking `checkpoint:human-action` — operator applied migration 066 via Supabase SQL editor, replied "applied")
- **Files modified:** 3

## Accomplishments

- `eval_slow_step` registered in the closed `PROGRAMMATIC_PHASE_REGISTRY` (`EVAL_SLOW_STEP_SECONDS = 20`, exported via `__all__`) — pure + idempotent, delegates to `split_topic`, the only humanly-killable mid-`programmatic` window (RESEARCH Pitfall 4, D-08 / SC#4)
- Migration `066_eval_coverage_seed.sql`: ONE definition serving EVAL-01 (per-provider eval target), D-02a (its `llm_human_input` phase is the robot-watched ask_user round-trip), and D-08 (one canonical restart-smoke target with all 3 kill points). Idempotent: fixed UUIDs + `ON CONFLICT (id) DO NOTHING`
- Seed row asserted LIVE post-apply via psycopg2 against localhost:54322: `('eval_coverage', 'published', True, 5)` — exact slug/status/is_global/phase-count match
- `full-schema.sql` regenerated via `bash scripts/regenerate-full-schema.sh` (live-DB dump, NO reset) and committed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add eval_slow_step programmatic fn (slow, pure, idempotent)** - `365e060c` (feat) — prior executor, worktree
2. **Task 2: Author migration 066 — eval_coverage 5-type seed workflow** - `4cbb9734` (feat) — prior executor, worktree
   - Tasks 1-2 merged into v2.5-dev via `ab3725fb`
3. **Task 3: [BLOCKING checkpoint] operator apply → psycopg2 assert + full-schema regen** - `92ad9476` (chore) — continuation executor, main tree

## Files Created/Modified

- `backend/app/services/harness/programmatic.py` - `EVAL_SLOW_STEP_SECONDS = 20` constant + `@register_programmatic("eval_slow_step")` async fn (sleep then delegate to split_topic); `import asyncio` added; `__all__` extended. split_topic untouched.
- `supabase/migrations/066_eval_coverage_seed.sql` - idempotent seed: system user (jsonb_build_object meta) + workflow_definitions row `00000000-0000-0000-0000-0000000000c1`, slug `eval_coverage`, v1, published, is_global, 5-phase JSONB definition with empty validators throughout
- `supabase/full-schema.sql` - regenerated from live DB after apply (only delta: pg_dump's per-run `\restrict` token — see deviation 4)

## Decisions Made

- Delegation over duplication: `eval_slow_step` returns `await split_topic(input, ctx)` so the `{"sub_questions": [...]}` shape (what `llm_batch_agents` reads) has one owner
- `validators: []` on all 5 phases — the live cross-provider eval must not depend on a regex gate; gate-retry coverage is deterministic in Plan 02's CI structural test, gate breadth was proven live in 093 D-21
- Phase 0 `input_keys` includes BOTH `topic` and `kickoff_prompt` (migration-065 lesson: programmatic fns only receive keys listed in `config.input_keys`; live runs carry `kickoff_prompt`)
- `deep_dive` (llm_agent) tools: `["search_documents", "web_search"]`; `fanout` (llm_batch_agents): `["search_documents"]`, `max_parallel_agents: 5`, `merge_strategy: "concat_numbered"` — field names byte-matched to 061's blocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsonb_build_object substitution for seed-user meta columns**
- **Found during:** Task 2 (migration authoring, prior executor)
- **Issue:** Copying 061's seed-user block verbatim hit a quoting hazard in the meta string literals
- **Fix:** `raw_app_meta_data` / `raw_user_meta_data` expressed constructor-style via `jsonb_build_object` — identical values to 061's string literals
- **Files modified:** supabase/migrations/066_eval_coverage_seed.sql
- **Verification:** Migration applied cleanly via SQL editor; seed-user `ON CONFLICT DO NOTHING` no-ops against the existing 056/061 row
- **Committed in:** 4cbb9734

**2. [Rule 1 - Documentation accuracy] Reworded migration header comment**
- **Found during:** Task 2 (prior executor)
- **Issue:** Plan's suggested header phrasing did not exactly match the project's apply-discipline wording
- **Fix:** Header rewritten to state the SQL-editor-paste-only discipline, regen command (no reset), and commit-both instruction per CLAUDE.md
- **Files modified:** supabase/migrations/066_eval_coverage_seed.sql
- **Committed in:** 4cbb9734

**3. [Rule 3 - Blocking] Worktree base correction**
- **Found during:** Task 1 startup (prior executor)
- **Issue:** Executor worktree forked from a stale base (known gsd-sdk worktree quirk)
- **Fix:** Worktree branch corrected to the current v2.5-dev base before executing
- **Verification:** Tasks 1-2 merged cleanly into v2.5-dev (`ab3725fb`)

**4. [Plan-criterion discrepancy — documented, not "fixed"] `grep -c "eval_coverage" full-schema.sql >= 1` is unsatisfiable by design**
- **Found during:** Task 3 (full-schema regeneration, continuation executor)
- **Issue:** `scripts/regenerate-full-schema.sh` runs `pg_dump --schema-only` — seed DATA rows never appear in the bootstrap artifact. Verified precedent: migration 061's seed slugs (`literature_review`, `doc_qa_human`) are equally absent (grep -c = 0 for both). The plan's criterion encoded a wrong assumption about the artifact.
- **Resolution:** The functional must-have ("full-schema.sql regenerated and committed") IS satisfied — regen ran, only delta is pg_dump's random `\restrict` token, file committed. Changing the dump to include selected-table data would be an architectural change to the deploy artifact (Rule 4 territory, out of scope). Pre-existing greenfield-seed gap logged as **DI-096-01-A** in `deferred-items.md`.
- **Files modified:** supabase/full-schema.sql (regen), deferred-items.md (log)
- **Committed in:** 92ad9476

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3) + 1 plan-criterion discrepancy documented
**Impact on plan:** No scope creep. Seed semantics byte-equivalent to plan intent; the full-schema grep criterion was an incorrect verification proxy, not a missing deliverable.

## Authentication / Human Gates

- Task 3 was a planned blocking `checkpoint:human-action` (NOT a deviation): operator pasted migration 066 into the Supabase SQL editor (http://localhost:54323) per the project's never-`db push`/`db reset` rule, then replied "applied". Post-apply psycopg2 assert returned `('eval_coverage', 'published', True, 5)` — exact match.

## Issues Encountered

- None beyond the documented deviations. Migration applied first try (idempotent — safe to re-run).

## Known Stubs

None — no UI surface; all deliverables are live-verified backend/DB artifacts.

## User Setup Required

None - the only manual step (SQL-editor apply) was completed during execution.

## Next Phase Readiness

- Plan 06 (eval extension) and Plan 07 (restart smoke) can resolve the workflow by slug `eval_coverage` — published, global, live in the local DB
- The mid-`programmatic` kill window is real (~20s), satisfying SC#4 without faking the cell
- Note for greenfield deploys: seed workflows live in numbered migrations only, NOT in full-schema.sql (DI-096-01-A)

---
*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Completed: 2026-06-07*

## Self-Check: PASSED

- All 3 key files + SUMMARY exist on disk
- All 3 task commits present in history (365e060c, 4cbb9734, 92ad9476)
- Registry check: `register_programmatic("eval_slow_step")` == 1 occurrence
- Live DB assert: `('eval_coverage', 'published', True, 5)` via psycopg2 @ localhost:54322
