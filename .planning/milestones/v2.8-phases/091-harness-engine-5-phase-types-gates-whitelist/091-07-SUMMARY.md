---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 07
subsystem: harness-engine
tags: [harness, seed-templates, migration, workflow-definitions, end-to-end, integration-test, retry-round-trip, all-5-phase-types]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 01
    provides: conftest four_seed_defs() single-source definitions + WorkflowDefinition model + mock_asyncpg_pool / fake_redis fixtures
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 02
    provides: run_workflow loop + 2-phase write + db/workflows.py + reachability lint (the engine the seeds run through)
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 03
    provides: the 5 phase-type executors wrapping substrate (mocked at the boundary by the end-to-end test)
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 05
    provides: validation gates + bounded retry + ctx.retry_feedback producer (consumed by the 07-T2 retry round-trip proof)
  - phase: 090-harness-schema-rls-config-models
    plan: 02
    provides: workflow_definitions table + seed system user + is_global RLS guard + block-published trigger (migration 056-060)
provides:
  - "4 seed WorkflowDefinitions shipped as migration 061 (global, published, immutable) collectively exercising all 5 phase types end-to-end — research_summarize, plan_execute_verify, literature_review, doc_qa_human"
  - "supabase/migrations/061_harness_seed_templates.sql — idempotent INSERTs (fixed UUID + ON CONFLICT DO NOTHING), self-contained seed system user, applied live via the operator SQL-editor checkpoint"
  - "test_harness_templates.py end-to-end-per-seed proof (mocked LLM substrate) — every seed runs through the now-complete engine asserting ordered phase completion + final-output-is-chat-message + SSE event vocabulary + gate + batch fan-out + human-input resume; plus the 07-T2 retry round-trip"
affects: [096 EVAL-01/02 live cross-provider seed runs, 092 publish/run wiring, 094 panel phase-timeline render fixtures]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single-source seed definitions — conftest four_seed_defs() is the ONE definition shape; migration 061 JSONB and the end-to-end test both derive from it so they can never drift (test asserts model_validate parity + reachability lint-clean — T-091-25 mitigation)"
    - "all-5-phase-types union coverage by design — 4 seeds chosen so { programmatic, llm_single, llm_agent, llm_batch_agents, llm_human_input } is the union; no single seed exercises all 5, the SET does (SC#1)"
    - "data-only seed migration — 061 is pure INSERTs against tables already in full-schema.sql from migration 060; applying it changes no schema, so full-schema.sql needs no commit (greenfield envs pick up seeds by running the migration)"
    - "operator SQL-editor apply checkpoint (autonomous:false) — migration applied by pasting into the Supabase SQL editor, never db push/reset (CLAUDE.md migration discipline; T-091-26 mitigation)"

key-files:
  created:
    - supabase/migrations/061_harness_seed_templates.sql
  modified:
    - backend/tests/test_harness_templates.py

key-decisions:
  - "All 4 seeds ship (D-01) — the 2 PRIMARY showcases (research_summarize, plan_execute_verify) plus 2 COVERAGE seeds (literature_review = sole programmatic + llm_batch_agents exerciser; doc_qa_human = sole llm_human_input exerciser) so the union covers all 5 phase types (SC#1)"
  - "Every seed is terminal-by-design (D-10) — the final phase's output IS the chat answer, no synthesis LLM call appended; no v1 seed uses skip_to_phase recovery (mechanism ships but seeds don't use it) and none sets a final_output knob (D-11)"
  - "Migration 061 is data-only (4 INSERTs) — the harness tables were already in full-schema.sql from migration 060 (104 references confirmed). Post-apply regen produced only pg_dump's session-specific \\restrict/\\unrestrict nonce churn (no real schema diff), so full-schema.sql was left UNCHANGED and is NOT in this plan's commits"
  - "Idempotent seeds — each INSERT carries a FIXED uuid + ON CONFLICT (id) DO NOTHING and 061 re-asserts the seed system user (mirrors 056), so the migration is self-contained and safe to re-run"

patterns-established:
  - "Seed-as-UAT-fixture: the same 4 definitions are the shipped product templates AND the integration fixtures — one artifact proves composition and double-serves SC#1/#6"
  - "Engine composition capstone: the end-to-end test mocks only the LLM substrate boundary (_stream_one_iteration / run_task_sub_agent / ask_user) and runs the REAL run_workflow + transitions + gates + completion — proving Plans 02-06 compose on the real seed definitions"

requirements-completed: [HARNESS-07]

# Metrics
duration: ~14min (incl. operator SQL-editor apply checkpoint)
completed: 2026-05-31
---

# Phase 091 Plan 07: Seed Workflow Templates (HARNESS-07) Summary

**Shipped the 4 seed workflow templates as migration 061 — global, published, immutable WorkflowDefinitions (research_summarize, plan_execute_verify, literature_review, doc_qa_human) whose union exercises all 5 phase types (SC#1), authored from the single-source conftest `four_seed_defs()` so the migration JSONB and the integration fixtures can never drift; each seed runs end-to-end through the now-complete engine with the LLM substrate mocked at the executor boundary (ordered phase completion + final-output-is-chat-message + full SSE event vocabulary + gate + batch fan-out + human-input resume all asserted), the 07-T2 retry round-trip proves the Plan-05 producer / Plan-03 consumer of `ctx.retry_feedback` connect, and the operator applied the migration live via the Supabase SQL editor — all 4 rows present and published.**

## Performance

- **Duration:** ~14 min (includes the operator SQL-editor apply checkpoint)
- **Started:** 2026-05-31T10:08:54Z (Task 1 commit)
- **Completed:** 2026-05-31 (continuation finalize)
- **Tasks:** 3 (2 auto + 1 operator checkpoint)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- 4 seed WorkflowDefinitions authored from the single-source `four_seed_defs()`, each parsing via `WorkflowDefinition.model_validate` and linting clean (reachability), collectively covering all 5 phase types (SC#1)
- Migration 061 ships them as idempotent INSERTs — global (`is_global=true`), published (`status='published'`, then frozen by the 056 block-published trigger), created by the seed system user, fixed UUID + `ON CONFLICT (id) DO NOTHING`
- End-to-end-per-seed integration test flipped live: every seed runs through the real `run_workflow` with the LLM substrate mocked at the boundary — asserts ordered active→completed UPDATE sequence per phase, final-phase-output-is-chat-message (D-10), `phase_started`/`phase_completed`/`phase_transition`/`run_completed` SSE events, the `plan_execute_verify` gate ran, the `literature_review` programmatic split + batch fan-out (bounded by max_parallel_agents), and the `doc_qa_human` ask_user blocked-then-resumed feeding finalize
- 07-T2 retry round-trip proven — the Plan-05 `ctx.retry_feedback` producer connects to the Plan-03 consumer
- Migration applied LIVE by the operator via the Supabase SQL editor; all 4 rows verified present (`version=1`, `status='published'`, `is_global=true`)
- Integration capstone: this proves Plans 02-06 compose end-to-end on the real seed definitions — `test_harness_templates.py` is 10/10 green; the full 091 harness suite reported 101/101

## Task Commits

1. **Task 1: Author the 4 seed WorkflowDefinitions + migration 061** - `0772d6b0` (feat)
2. **Task 2: End-to-end integration test per seed (mocked LLM) + 07-T2 retry round-trip** - `f358269c` (test)
3. **Task 3: Operator applies migration 061 via Supabase SQL editor** - operator action (no code commit — data-only migration, full-schema.sql unchanged)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/061_harness_seed_templates.sql` - 4 idempotent `INSERT INTO public.workflow_definitions` seed rows (global, published, fixed UUID + ON CONFLICT DO NOTHING) + self-contained seed system user re-assert; header documents the all-5-phase-types union and the CLAUDE.md SQL-editor apply discipline
- `backend/tests/test_harness_templates.py` - end-to-end-per-seed proof (mocked LLM substrate) + model_validate parity + 5-phase-type coverage + reachability lint + 07-T2 retry round-trip; all assertions live (no skips)

## Decisions Made
- **All 4 seeds ship (D-01):** 2 PRIMARY showcases + 2 COVERAGE seeds so the union covers all 5 phase types — no single seed exercises all 5, the SET does (SC#1).
- **Terminal-by-design (D-10):** every seed's final phase output IS the chat answer (no synthesis LLM call); no seed uses skip_to_phase recovery; no final_output knob (D-11).
- **Migration 061 is data-only — full-schema.sql NOT touched:** the harness tables were already in full-schema.sql from migration 060 (104 references confirmed). The post-apply regen produced only pg_dump's session-specific `\restrict`/`\unrestrict` nonce churn (no real schema diff), so the regen was reverted and full-schema.sql is NOT in this plan's commits. Greenfield envs receive the seeds by running migration 061.
- **Idempotent + self-contained:** fixed UUID per row + ON CONFLICT (id) DO NOTHING + re-asserted seed system user (mirrors 056) make 061 safe to re-run.

## Deviations from Plan

None - plan executed exactly as written. The only difference from the PLAN's checkpoint step is the full-schema.sql handling: because migration 061 is data-only (INSERTs against tables already present in full-schema.sql from migration 060), the regen produced no real schema diff (only pg_dump's session-nonce churn). The orchestrator therefore reverted the nonce-only churn and full-schema.sql was correctly NOT committed — the PLAN anticipated a possible full-schema change, the actual data-only nature made it a no-op. This is consistent with the migration discipline, not a deviation in behavior.

## Authentication Gates

None.

## Issues Encountered
None. The operator SQL-editor apply checkpoint completed cleanly — all 4 seed rows landed published + global on the first paste (idempotent migration).

## User Setup Required
None - no external service configuration required. The one operator action (applying migration 061 via the Supabase SQL editor) is complete.

## Next Phase Readiness
- HARNESS-07 closed — the harness engine (Plans 01-07) is functionally complete: state-machine engine, 5 phase-type executors, validation gates + bounded retry, per-phase tool whitelist, resumability, and 4 seed templates proven end-to-end.
- The 4 seed definitions are now live, global, and published — ready to serve as the cross-provider eval fixtures (Phase 096 EVAL-01/02) and the publish/run targets for Phase 092 (Dual-Mode Wiring + Continue).
- Phase 091 verification (phase-complete marking + cross-provider 4-axis UAT per SC#10 / VALIDATION manual rows) is the orchestrator/verifier's next step.

## Self-Check: PASSED

- FOUND: supabase/migrations/061_harness_seed_templates.sql (4 INSERTs, 4 ON CONFLICT, is_global=true, seed user, all-5-phase-types in header)
- FOUND: backend/tests/test_harness_templates.py (10 passed live)
- FOUND commit: 0772d6b0 (feat 091-07 — 4 seed definitions + migration 061)
- FOUND commit: f358269c (test 091-07 — end-to-end per-seed through the engine)
- Operator confirmed: 4 seed rows present in live DB (research_summarize, plan_execute_verify, literature_review, doc_qa_human — all version=1, status='published', is_global=true)
- full-schema.sql intentionally NOT modified (data-only migration; tables already present from migration 060)

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
