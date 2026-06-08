---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 08
subsystem: backend/harness
tags: [harness, resumability, postgres, claim-cas, lease, tool-budget, ask_user, validation-gates, migration]

# Dependency graph
requires:
  - phase: 091
    provides: "harness engine (run_workflow + 2-phase write), db/workflows.py claim_run + ask_user queries, phase-type executors, validation gates, apply_tool_budget"
  - phase: 090
    provides: "workflow_runs / workflow_phases tables + RLS (migration 060)"
provides:
  - "CR-01: real resume CAS via a claimed_at timestamptz lease on workflow_runs (migration 062) — WORKER_COUNT=2 safe, no double-execute"
  - "CR-02: >64 KB phase outputs stored inline (jsonb), never silently dropped to a workspace-files://pending placeholder"
  - "WR-03: retry bound + on_failure disposition both derived from the SAME failing validator (failing index threaded through GateResult)"
  - "WR-04: TOOL-05 per-provider max_tools budget cap actually applied to sub-agent tool schemas (run_task_sub_agent path)"
  - "WR-05 + WR-06: get_pending_ask_user + ask_user_response_exists run-scoped (predicate on stored run_id), not thread-scoped"
  - "IN-01: dead gate param dropped from _failing_on_failure"
affects: [092, 096]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lease CAS: claim a stranded row by stamping claimed_at=now() under (claimed_at IS NULL OR claimed_at < now() - $interval); orthogonal to status, no new status enum value, no CHECK-constraint migration"
    - "Correctness-over-optimization for durable jsonb: inline-store the full payload, treat the size cap as a future bucket-spill optimization, never discard"
    - "Run-scoping resume queries on the stored tool_calls->0->>'run_id' so multi-run threads resume the correct prompt/answer"

key-files:
  created:
    - "supabase/migrations/062_workflow_run_claim_lease.sql"
    - ".planning/seeds/SEED-047-resume-ctx-persist-inputs-model.md"
  modified:
    - "backend/app/db/workflows.py"
    - "backend/app/services/harness_engine.py"
    - "backend/app/services/harness/phase_types.py"
    - "backend/app/services/harness/validators.py"
    - "backend/app/services/task_service.py"
    - "backend/app/config.py"
    - "supabase/full-schema.sql"

key-decisions:
  - "CR-01 fixed with a claimed_at lease (not a new 'resuming' status) — lease is orthogonal to status, avoids a CHECK-constraint migration, and gives crash-mid-resume re-claimability for free once the lease window expires"
  - "CR-02 stores >64 KB output INLINE (jsonb holds it); bucket spill stays a future optimization — correctness (no lost output) outranks jsonb row size"
  - "WR-01/WR-02 deferred to Phase 092 — proper fix needs run inputs+model persisted at workflow_runs CREATION, which doesn't exist in Phase 091; planted as SEED-047 with Phase 096 EVAL-02 as the proof gate"

patterns-established:
  - "Lease-CAS resume claim: orthogonal claimed_at column, no status churn"
  - "Run-scoped (not thread-scoped) durable ask_user resume queries"

requirements-completed: [HARNESS-03, HARNESS-05, TOOL-05]

# Metrics
duration: ~20min (build) + operator migration-apply checkpoint + continuation finalize
completed: 2026-05-31
---

# Phase 091 Plan 08: Code-Review Gap Closure Summary

**Closed the two Critical + four Warning code-review defects on Phase 091's headline requirements: a real `claimed_at`-lease resume CAS (migration 062, no double-execute under WORKER_COUNT=2), inline storage of >64 KB phase outputs (no silent data loss), the TOOL-05 budget cap actually applied to sub-agent tool schemas, same-failing-validator retry/route pairing, and run-scoped ask_user resume queries.**

## Performance

- **Duration:** ~20 min build (3 task commits) + operator migration-apply checkpoint + continuation finalize
- **Completed:** 2026-05-31
- **Tasks:** 3 build tasks (CR-01 / CR-02+WR-* / tests) + finalize
- **Files modified:** 7 source/schema + 5 test files

## Accomplishments

- **CR-01 (Critical) — real resume CAS.** `claim_run` was a no-op self-transition (`SET status='active' WHERE status IN ('active','paused')`) — both racing workers won. Now it's a lease CAS: the winner stamps `claimed_at = now()`; a racing sibling matches 0 rows via `claimed_at IS NULL OR claimed_at < now() - $interval` → returns False → no double-execute. Crash-mid-resume runs are re-claimable once the lease (engine/config constant, default 5 min) expires. Migration `062_workflow_run_claim_lease.sql` adds the orthogonal `claimed_at timestamptz` column (no new status, no CHECK churn).
- **CR-02 (Critical) — no silent data loss.** `_persist_output` returned `{"_spilled_path": "workspace-files://pending"}` for outputs > 64 KB, but no executor ever set `_spilled_path` — the real content was gone, and a resumed downstream phase (or final chat message) read the placeholder. Now the full output is stored **inline** in `workflow_phases.output` jsonb; the size gate may log but never discards. Bucket spill stays a future optimization.
- **WR-04 — TOOL-05 budget actually applied.** The per-provider `max_tools` cap (Google = 16, SEED-035) was computed then discarded (dead `_tools_override`). It's now applied to the schemas the sub-agent model sees on the `run_task_sub_agent` path. Whitelist (HARNESS-05) still enforced; Deep-Mode/no-whitelist path stays byte-identical (no cap when there's no active workflow).
- **WR-05 + WR-06 — run-scoped resume.** `get_pending_ask_user` and `ask_user_response_exists` now filter on the stored `run_id` in `tool_calls`, so a thread with multiple workflow runs resumes the prompt/answer belonging to the specific stranded run.
- **WR-03 — same-validator routing.** The failing-validator index is threaded back through `GateResult`; both `max_retries` and `on_failure` now come from `phase.validators[failed_idx]` (the same validator), not `validators[0]` for the bound and a different one for routing.
- **IN-01 — dead param dropped** from `_failing_on_failure`.
- **Live-column backstop GREEN:** full harness suite (engine + resume + gates + whitelist + tool_budget + templates + reachability) = **95 passed, 0 skipped** against the live `claimed_at` column.

## Task Commits

1. **Task 1: CR-01 migration 062 + lease-window config** — `42cf002f` (feat)
2. **Task 2: real claim CAS + inline large-output + budget cap + run-scoped resume + same-validator routing (CR-01/CR-02/WR-03/WR-04/WR-05/WR-06/IN-01)** — `77394956` (fix)
3. **Task 3: regression tests for all fixes** — `ac1083e6` (test)

**Plan metadata (this commit):** `docs(091-08)` — SUMMARY + REVIEW resolution + full-schema.sql + SEED-047 + STATE/ROADMAP/REQUIREMENTS

## Files Created/Modified

- `supabase/migrations/062_workflow_run_claim_lease.sql` — adds `claimed_at timestamptz` lease column to `workflow_runs` (idempotent, documented lease semantics)
- `supabase/full-schema.sql` — regenerated (live-DB dump, no reset); `claimed_at` now present in the `workflow_runs` CREATE TABLE block (line 748) + lease-semantics COMMENT
- `backend/app/db/workflows.py` — `claim_run` lease CAS; run-scoped `get_pending_ask_user` + `ask_user_response_exists`
- `backend/app/services/harness_engine.py` — inline-store `_persist_output`; `GateResult` failing-index → same-validator retry/route; `_failing_on_failure` dead param dropped
- `backend/app/services/harness/validators.py` — failing-index threaded through `GateResult`
- `backend/app/services/harness/phase_types.py` — budget-capped tools passed through to the sub-agent path
- `backend/app/services/task_service.py` — `apply_tool_budget` applied to `run_task_sub_agent` sub-agent tool schemas
- `backend/app/config.py` — claim-lease window constant
- Tests: `test_harness_resume.py`, `test_harness_gates.py`, `test_tool_budget.py`, `test_harness_engine.py`, `test_harness_templates.py`, `integration/test_085_sub_agent_emit.py`
- `.planning/seeds/SEED-047-resume-ctx-persist-inputs-model.md` — WR-01/WR-02 deferral to Phase 092

## Migration

`062_workflow_run_claim_lease.sql` was applied LIVE by the operator via the Supabase SQL editor (per CLAUDE.md — never `db push`/`db reset`). Verified: `public.workflow_runs.claimed_at` exists, type `timestamp with time zone`, `is_nullable = YES`. `full-schema.sql` was then regenerated from the live DB (no reset) — a real schema diff this time (the new column, 10 insertions / 2 deletions; the `\restrict`/`\unrestrict` nonce line is pg_dump session noise). Committed alongside the migration.

## Decisions Made

- **Lease over status transition for CR-01:** the REVIEW suggested either a new `'resuming'` status (needs a CHECK-constraint migration + flip-back logic) or an advisory lock. Chose the `claimed_at` lease — orthogonal to status, idempotent migration, and crash-mid-resume re-claimability falls out of the lease expiry for free.
- **Inline over fail-loud for CR-02:** the REVIEW offered (a) inline-store or (b) raise. Chose inline (the REVIEW's "preferred for v1") — a resumed run keeps its real output; bucket spill is a later optimization, not a correctness dependency.

## Deviations from Plan

None — plan executed as written. Tasks 1-3 were built and committed by the prior executor (stopped at the operator migration-apply checkpoint, as the plan specified). This continuation finalized after the operator applied migration 062: regenerated `full-schema.sql`, ran the live-column backstop, flipped the REVIEW to `resolved`, planted SEED-047, and updated tracking.

## Deferred Items

- **WR-01 (resume ctx missing `inputs`) + WR-02 (resume ctx missing `model`/`user_settings`)** → **SEED-047**. Proper fix requires persisting run inputs + model at `workflow_runs` CREATION, which does not exist in Phase 091 (no `INSERT INTO workflow_runs` in `backend/app`). Owned by **Phase 092** (dual-mode + Continue). Re-open trigger: Phase 092 run-creation persists `workflow_runs.inputs` + `model` → rehydrated into the resume ctx; **Phase 096 EVAL-02 (live kill-and-resume)** is the proof gate. Until then, resumed LLM / top-level-input phases are a known live-resume limitation (deterministic unit proof for resume mechanics stands).
- **IN-02 / IN-03 / IN-04 / IN-05** — cosmetic / doc-only (apply_tool_budget cleanup, prior-output join intent, import-time settings snapshot, timeout reason text). No correctness impact, no action.

## Issues Encountered

None. The full harness suite was GREEN both at checkpoint time (against mocks) and after the live column landed (95 passed, 0 skipped).

## Cross-Provider / Invariant Notes

No shared provider streaming branch was modified — the diff is confined to harness engine + db + config + tests. Deep Mode (`phase_whitelist is None` / no active workflow) stays a literal no-op for both the whitelist filter and the budget cap, preserving the Phase 089 byte-identical SSE gate.

## Next Phase Readiness

- All Phase 091 code-review Criticals + actionable Warnings resolved; `091-REVIEW.md` status → `resolved`.
- Phase 091 is **8/8 plans complete, awaiting `/gsd:verify-work 091`** — the verifier owns final phase-complete marking + the SC#10 4-axis cross-provider UAT (VALIDATION manual rows).
- WR-01/WR-02 handed to Phase 092 via SEED-047 with a concrete re-open trigger.

## Self-Check: PASSED

- FOUND: 091-08-SUMMARY.md, SEED-047, migration 062, full-schema.sql (claimed_at present at line 748)
- FOUND: task commits 42cf002f, 77394956, ac1083e6
- Live-column backstop: full harness suite 95 passed, 0 skipped

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
