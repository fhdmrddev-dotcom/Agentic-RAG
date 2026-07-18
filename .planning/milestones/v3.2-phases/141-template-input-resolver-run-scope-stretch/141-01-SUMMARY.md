---
phase: 141-template-input-resolver-run-scope-stretch
plan: 01
subsystem: database
tags: [postgres, migration, asyncpg, template-resolver, run-scope, access-control, pytest]

# Dependency graph
requires:
  - phase: 120-collision-fix-context-isolation
    provides: "isolation-by-column precedent (messages.origin nullable/no-backfill, filter-at-read) + the faithful offline-repro discipline (test_120_origin_filter.py)"
  - phase: 101-template-fill-integrity
    provides: "resolve_template_source Branch 2 (ephemeral template_input resolver) + the {bytes,filename,provenance,mime,error} envelope + two-query expired/never-uploaded probe"
provides:
  - "migration 092: additive nullable text run_claim column on workspace_files (no default, no backfill, no new RLS)"
  - "pure helpers claim_visible(row_claim, own_claim) + own_claim_for_ctx(ctx) + DEEP_CLAIM sentinel in template_asset_service.py"
  - "test_141_run_scope.py: the COLL-02 RED backstop (8 green now, 7 xfail-pending Plan 02) — the executable fail-before/pass-after authorization spec"
affects: [141-02 (resolver WHERE + Branch-2 callers), 141-03 (live migration apply + full-schema regen), COLL-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure claim-visibility helper mirrors the SQL WHERE predicate (single source of the eligibility truth) — same discipline as Phase 120 _apply_origin_filter"
    - "Run-context lineage keyed off workflow_run_id ONLY (None => 'deep' sentinel, else str(id)) — free sub-agent inheritance, zero plumbing"
    - "Author-then-apply migration split: this plan authors 092; Plan 03 (BLOCKING) applies it + regenerates full-schema.sql"

key-files:
  created:
    - "supabase/migrations/092_workspace_files_run_claim.sql"
    - "backend/tests/test_141_run_scope.py"
  modified:
    - "backend/app/services/template_asset_service.py (added claim_visible + own_claim_for_ctx + DEEP_CLAIM)"

key-decisions:
  - "run_claim is plain nullable text (no FK, no CHECK, no default) — holds str(workflow_run_id) OR the 'deep' sentinel; server-set only (D-141-02)"
  - "Did NOT mark COLL-02 complete — Plan 01 ships only the schema+logic contract; the requirement is satisfied when Plan 02 wires the resolver WHERE + Plan 03 applies the migration"
  - "test_emit_ctx_carries_workflow_lineage constrains Plan 02 to expose workflow_run_id from _ProducerStreamCtx itself (Landmine 2 fix in the class, not just the call site)"

patterns-established:
  - "Migration static-contract test asserts against comment-stripped executable DDL (not raw file text) so mandated rationale prose (the NOT-NULL-DEFAULT divergence warning, the never-db-push warning) can coexist with strict no-default/no-not-null assertions"
  - "xfail(strict=False) Plan-02-pending tests fail for the intended reason (TypeError on own_claim / 'deep' != str(W) / missing wiring token) so Plan 02 flips them GREEN by implementing the named behavior"

requirements-completed: []  # COLL-02 intentionally NOT marked complete — contract-only plan; see key-decisions

# Metrics
duration: 14min
completed: 2026-07-07
---

# Phase 141 Plan 01: Run-Scope Claim Contract + RED Backstop Summary

**Migration 092 nullable `run_claim` column + pure `claim_visible`/`own_claim_for_ctx` helpers keyed off `workflow_run_id` + `test_141_run_scope.py` (8 green / 7 xfail-pending-Plan-02) — the COLL-02 schema+logic contract and its executable fail-before/pass-after proof.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-07T18:40:09Z
- **Completed:** 2026-07-07T18:54:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- **Migration 092** adds an additive, nullable, no-default, no-backfill `run_claim text` column to `workspace_files` — the run-context claim lineage (`str(workflow_run_id)` or the `'deep'` sentinel; NULL = unclaimed). Critically diverges from migration 076's `NOT NULL DEFAULT 'deep'` (which would permanently deep-claim every legacy row — Pitfall 3). No new RLS policy (inherits thread-owner RLS). `full-schema.sql` left untouched (Plan 03 regenerates it).
- **Two pure helpers** in `template_asset_service.py`: `claim_visible(row_claim, own_claim)` (the single source of the eligibility truth — `None or ==`), `own_claim_for_ctx(ctx)` (keyed off `workflow_run_id` only → `'deep'` when None, `str(id)` otherwise, with free sub-agent inheritance), plus the shared `DEEP_CLAIM` sentinel that makes the cross-context block symmetric.
- **`test_141_run_scope.py`** — the RED backstop: the full 5-direction `claim_visible` truth table (3 blocked / 2 allowed), the `own_claim_for_ctx` derivation, and the migration-092 static contract are GREEN now; the 7 resolver/emit/wiring behaviors are `xfail(strict=False)` and flip GREEN as Plan 02 wires each. 8 passed / 7 xfailed, exits 0 in 0.55s.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 092** — `fc668805` (feat)
2. **Task 2: Add pure claim helpers** — `df7e9d97` (feat)
3. **Task 3: Author test_141_run_scope.py** — `bb2d5d69` (test)

**Plan metadata:** final docs commit (this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `supabase/migrations/092_workspace_files_run_claim.sql` — additive nullable `run_claim` column; apply-by-hand contract documented; Plan 03 applies + regenerates full-schema.sql
- `backend/app/services/template_asset_service.py` — added `DEEP_CLAIM`, `claim_visible`, `own_claim_for_ctx` (module-level, above `resolve_template_source`; Branch 2 unchanged — that is Plan 02)
- `backend/tests/test_141_run_scope.py` — 15 named tests: 8 green (truth table + own_claim + migration), 7 xfail-pending Plan 02 (resolver stamp, foreign-claim honest error, UPDATE-0 race fallthrough, _ProducerStreamCtx lineage, happy-path no-regression, scope-preservation V4, both-sites own_claim wiring)

## Decisions Made
- **`run_claim` = plain nullable `text`** (no FK — a uuid FK can't hold the `'deep'` sentinel; no CHECK — the value is server-derived, not user input; no default/backfill — NULL = unclaimed, D-141-02/04).
- **COLL-02 intentionally NOT marked complete.** Plan 01 delivers only the schema + logic contract; a foreign-run template still resolves until Plan 02 wires the claim-aware WHERE. The requirement is completed at the phase level (Plans 02 wiring + 03 live apply). Marking it now would be a false-positive.
- **Migration static-contract test asserts against comment-stripped executable DDL**, not raw file text — this lets the migration carry the CLAUDE.md-mandated apply-by-hand + never-`db push`/`db reset` warnings and the "NOT NULL DEFAULT divergence from 076" rationale (both of which contain the very substrings the contract forbids in DDL) without the test false-failing.
- **`test_emit_ctx_carries_workflow_lineage` constrains Plan 02 to expose `workflow_run_id` from the `_ProducerStreamCtx` proxy itself** (deriving from the inner bag's `run_id` in `__init__`), not merely at the call site — cleaner and directly testable, and the surest guard against the Landmine-2 green-but-broken failure (a workflow emit render mis-claiming as `'deep'`).

## Deviations from Plan

None - plan executed exactly as written. (The three helper functions, the migration shape, all 15 test names, and the xfail-pending markers match the plan's tasks and VALIDATION.md Per-Task Verification Map verbatim.)

## Issues Encountered
- **STATE.md SDK handlers partially no-op'd.** `state.advance-plan` (Plan 1→2 of 3) and `roadmap.update-plan-progress` succeeded; `state.update-progress` / `state.record-metric` / `state.record-session` / `state.add-decision` returned soft "field/arg not found" results because this project's STATE.md format doesn't match those handlers' target patterns (a known finicky area — the orchestrator typically owns STATE prose). Resolved by a minimal, balloon-safe manual edit to the Current Position "Next action" + "Last activity" lines. STATE.md stayed 373 lines (no balloon).

## User Setup Required
None in this plan. **Plan 03 (autonomous:false / BLOCKING)** will require the operator to apply migration 092 to the live local DB by hand (Supabase SQL editor / psycopg2 `:54322` — never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), and apply 092 to cloud Supabase at deploy (`scripts/pending-cloud-migrations.sh`).

## Next Phase Readiness
- **Plan 02 ready:** the contract is locked. Plan 02 wires `own_claim` into `resolve_template_source` (claim-aware Branch-2 WHERE `run_claim IS NULL OR run_claim = $own` + conditional stamp `UPDATE ... WHERE run_claim IS NULL` + UPDATE-0 re-SELECT fallthrough + the honest "belongs to another run" relay), threads the own-claim at both Branch-2 resolve sites (`tool_dispatcher.py` via `own_claim_for_ctx`, `phase_types.py` emit pre-resolve via `str(ctx.run_id)`), and stamps `_ProducerStreamCtx.workflow_run_id`. Each wired behavior drops its xfail marker in `test_141_run_scope.py`.
- **Plan 03 ready:** migration 092 authored and ready for the operator apply + full-schema regen.
- **No blockers.** No package installs, no schema applied, `full-schema.sql` untouched.

## Self-Check: PASSED
- FOUND: `supabase/migrations/092_workspace_files_run_claim.sql`
- FOUND: `backend/app/services/template_asset_service.py` (helpers present, imported by the test)
- FOUND: `backend/tests/test_141_run_scope.py` (15 tests collect; 8 passed / 7 xfailed)
- FOUND commit: `fc668805` (Task 1), `df7e9d97` (Task 2), `bb2d5d69` (Task 3)
- Blast-radius neighbors green: 72 passed / 7 xfailed (test_141_run_scope + test_workspace_template + test_citation_policy + test_llm_emit_executor)

---
*Phase: 141-template-input-resolver-run-scope-stretch*
*Completed: 2026-07-07*
