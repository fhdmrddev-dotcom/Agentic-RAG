---
phase: 093-harness-cross-provider-parity
plan: 01
subsystem: testing
tags: [harness, workflow, reachability-lint, split_topic, seed-migration, supabase, pytest, tdd-scaffold]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    provides: "publish-time reachability lint (lint_workflow), split_topic programmatic fn, 4 seed workflow templates (migration 061)"
  - phase: 092-dual-mode-wiring-continue-button
    provides: "create_workflow_run persists workflow_runs.inputs={kickoff_prompt:...} (SEED-047) — the run input the split_topic alias surfaces"
  - phase: 092.5-provider-gateway-extraction
    provides: "the provider gateway the Wave-1 plan (093-02) consumes; this plan's RED scaffold names that contract"
provides:
  - "split_topic reads kickoff_prompt as well as topic (D-09a code half — topic precedence preserved, backward compatible)"
  - "INPUT_UNSATISFIED publish-time reachability lint rule (D-10, T-093-DOS mitigation) — a phase whose input_key is never produced upstream or by a known run input fails validation, not at runtime"
  - "migration 065 — the 3 corrective seed fixes (literature_review input_keys + plan_execute_verify verify-gate drop + 3 anti-delegation downstream prompts), operator-applied live"
  - "7 Wave-0 RED test scaffolds — the deterministic contract each downstream plan (093-02..05 + the 065 migration) flips to GREEN"
affects: [093-02, 093-03, 093-04, 093-05, 094-workflow-legibility, 096-eval-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 RED scaffold: each downstream plan owns a named pytest.mark.skip contract that it removes when its production code lands (091-01 pattern reused)"
    - "Corrective seed migration via the 056 immutability-trigger DISABLE→UPDATE→ENABLE in one transaction (T-093-SEED — published rows stay app-immutable after the fix)"
    - "Pure publish-time contract lint extension (getattr-guarded across PhaseConfig variants; no contract-validation framework — D-10 scope guard)"

key-files:
  created:
    - "supabase/migrations/065_harness_seed_fixes.sql"
    - "backend/tests/test_093_split_topic.py"
    - "backend/tests/test_093_surfacing.py"
    - "backend/tests/integration/test_093_ask_user_workflow_run_live.py"
    - "backend/tests/integration/test_093_verify_gate_route_forward.py"
  modified:
    - "backend/app/services/harness/programmatic.py"
    - "backend/app/services/harness/reachability.py"
    - "backend/tests/test_harness_reachability.py"
    - "backend/tests/unit/test_085_task_service.py"
    - "backend/tests/unit/test_sub_agent_routing.py"

key-decisions:
  - "Migration 065 is DATA-ONLY (jsonb_set on seed rows + trigger toggle, no table DDL) → full-schema.sql schema unchanged; only the pg_dump session nonce regenerated, so no full-schema commit was made (avoids a misleading diff)"
  - "Fix 3 (anti-delegation prompts) is a PROMPT fix not an input_keys binding — the llm_single executor ignores input_keys (only programmatic reads it); binding would be a no-op (phase_types.py:205)"
  - "split_topic reads topic OR kickoff_prompt with topic precedence (backward compatible); the seed input_keys edit (Fix 1) is what surfaces kickoff_prompt to the fn — code+seed paired (D-09a)"

patterns-established:
  - "Pattern 1: INPUT_UNSATISFIED lint — produced-set walk in phase_index order; a phase's input_keys must be in the produced set (upstream slug + declared output_keys) OR _KNOWN_RUN_INPUT_KEYS"
  - "Pattern 2: 7 RED scaffolds map 1:1 to downstream owners — verify-gate→065 (now GREEN-able), task_service→093-02, model-resolver→093-03, ask_user live→093-04, surfacing→093-05"

requirements-completed: []  # PARITY-02 stays OPEN — this plan is the substrate; phase verification owns closure

# Metrics
duration: ~45min (incl. operator SQL-editor checkpoint resolution)
completed: 2026-06-02
---

# Phase 093 Plan 01: Wave-0 Substrate + Seed Fixes Summary

**split_topic kickoff_prompt alias + INPUT_UNSATISFIED reachability lint + the 3-fix corrective seed migration 065 (operator-applied live) + 7 RED test scaffolds — the deterministic foundation the rest of Phase 093 flips to GREEN.**

## Performance

- **Duration:** ~45 min (across the operator SQL-editor checkpoint)
- **Started:** 2026-06-02 (Tasks 1-3 authored)
- **Completed:** 2026-06-02T (continuation: schema regen + sanity + closeout)
- **Tasks:** 3 (Task 1 TDD, Task 2 scaffolds, Task 3 migration author + operator-apply checkpoint)
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- **D-09a code half:** `split_topic` now reads `input.get("topic") or input.get("kickoff_prompt")` — live runs carry `kickoff_prompt` (threads.py:1233), and the legacy seed key `topic` keeps precedence (backward compatible). Paired with the seed `input_keys` edit (migration 065 Fix 1) this revives Literature Review + the `llm_batch_agents` fan-out (same root cause).
- **D-10 safe-by-construction lint:** added the `INPUT_UNSATISFIED` rule to `reachability.lint_workflow` (`_check_input_contracts` + `_KNOWN_RUN_INPUT_KEYS={"kickoff_prompt","topic"}`). A workflow phase whose `input_key` is never produced by an upstream phase or a known run input now fails publish-time validation (T-093-DOS mitigation) instead of stranding the run at runtime. Pure function, no I/O, no eval; getattr-guarded for the PhaseConfig variants that don't carry input/output keys. The 4 seeds lint clean after the fix.
- **Migration 065 (3 corrective seed fixes), operator-applied LIVE:** trigger-disable → 5 jsonb UPDATEs → trigger-enable in one transaction.
- **7 Wave-0 RED test scaffolds** authored/extended — each downstream plan has a named contract to flip.

## Task Commits

1. **Task 1: split_topic kickoff_prompt alias + INPUT_UNSATISFIED lint + unit tests** — `c0ea0367` (feat) — 13 tests GREEN
2. **Task 2: 4 new Wave-0 RED scaffolds + extend 2 task/routing tests** — `93b482a5` (test)
3. **Task 3 (author half): migration 065 — harness seed corrective fixes (trigger-disable)** — `afd9a60f` (feat)

**full-schema.sql:** NOT committed — data-only migration; the regenerated dump differed only by the random `\restrict`/`\unrestrict` pg_dump session nonce (schema DDL byte-identical), so the noise-only change was reverted (`git checkout -- supabase/full-schema.sql`). No empty/misleading commit created.

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — see final docs commit.

_Note: Task 1 was TDD (test + impl folded into one feat commit — the lint/alias and their tests authored together)._

## Migration 065 Checkpoint Resolution (Task 3 operator-applied)

Task 3 was `checkpoint:human-action` (applying a migration is operator-only per CLAUDE.md — never `db push`/`db reset`). The operator pasted `supabase/migrations/065_harness_seed_fixes.sql` into the Supabase SQL editor (local DB) and confirmed it applied cleanly. **Live verification against the DB** (recorded at checkpoint resolution):

- **Fix 1 (D-09a):** `literature_review` (`...b3`) → `phases[0].config.input_keys = ["topic","kickoff_prompt"]` ✓
- **Fix 2 (D-09b):** `plan_execute_verify` (`...b2`) → `phases[2].validators = []` ✓ (the dead-ending hard `VERIFIED` regex gate dropped — verify is the terminal phase with no successor, so route-forward = drop the gate; a model that doesn't echo VERIFIED now completes on its own output instead of `fail_run`)
- **Fix 3 (D-09 result-quality, the "asks me to share the research" defect):** the 3 downstream `llm_single` prompts rewritten to the self-sufficient, anti-delegation form (`research_summarize` phases[1], `literature_review` phases[2], `doc_qa_human` phases[2]) — applied in the same transaction. Validated by the live VALIDATION quality UAT row (operator-judged); deeper rubric/golden-output measurement deferred to SEED-050 → Phase 096.
- **T-093-SEED:** the immutability trigger `workflow_definitions_block_published` was re-ENABLEd inside the same transaction — published rows stay app-immutable after the fix.

Post-checkpoint (this continuation): `bash scripts/regenerate-full-schema.sh` (no `--reset`) ran clean — confirmed the data-only migration leaves table DDL unchanged.

## RED Scaffold Inventory (which plan flips each to GREEN)

| Test file | Status today | Flips GREEN when |
|-----------|--------------|------------------|
| `backend/tests/test_093_split_topic.py` | **GREEN** (Task 1) | — already live (split_topic alias) |
| `backend/tests/test_harness_reachability.py` (extended) | **GREEN** (Task 1) | — already live (INPUT_UNSATISFIED + 4-seeds-lint-clean) |
| `backend/tests/unit/test_085_task_service.py` → `Test093GatewayConsumption` | skipped (class-level) | **093-02** removes the skip (task_service gateway-consumption rewrite, F9 core) |
| `backend/tests/unit/test_sub_agent_routing.py` → `Test093ModelResolver` | skipped (class-level) | **093-03** removes the skip (available_models field fix, D-06) |
| `backend/tests/integration/test_093_ask_user_workflow_run_live.py` | skipped (PG-down guard + skip) | **093-04** lands the F10 workflow_run-id fallback branch |
| `backend/tests/test_093_surfacing.py` | skipped | **093-05** lands the shared surfacing helper (D-11) |
| `backend/tests/integration/test_093_verify_gate_route_forward.py` | skipped (PG-down guard + skip) | **migration 065** (now applied) — un-skip to verify a non-VERIFIED `plan_execute_verify` run completes instead of dead-ending |

The 5 skips are correct RED state — they are SUPPOSED to skip/fail until their owning plan lands; this is not a regression.

## Files Created/Modified

- `supabase/migrations/065_harness_seed_fixes.sql` (created) — the 3 corrective seed fixes via trigger-disable→UPDATE→enable
- `backend/app/services/harness/programmatic.py` (modified) — split_topic reads `topic or kickoff_prompt` (D-09a)
- `backend/app/services/harness/reachability.py` (modified) — `_KNOWN_RUN_INPUT_KEYS` + `_check_input_contracts` + INPUT_UNSATISFIED rule wired into `lint_workflow` (D-10)
- `backend/tests/test_093_split_topic.py` (created) — split_topic kickoff_prompt + fan-out N>1 + empty-contract tests
- `backend/tests/test_harness_reachability.py` (modified) — INPUT_UNSATISFIED cases + 4-seeds-lint-clean assertion
- `backend/tests/unit/test_085_task_service.py` (modified) — `Test093GatewayConsumption` RED class (093-02)
- `backend/tests/unit/test_sub_agent_routing.py` (modified) — `Test093ModelResolver` RED class (093-03)
- `backend/tests/integration/test_093_ask_user_workflow_run_live.py` (created) — F10 workflow_run-id ask_user live-DB RED scaffold (093-04)
- `backend/tests/test_093_surfacing.py` (created) — shared surfacing helper single-emit + ordering RED scaffold (093-05)
- `backend/tests/integration/test_093_verify_gate_route_forward.py` (created) — verify-gate route-forward integration RED scaffold (065)

## Decisions Made

- **No full-schema.sql commit (data-only migration).** Migration 065 only `jsonb_set`s seed rows + toggles a trigger — no table DDL. The regenerated `full-schema.sql` differed only by the random `\restrict`/`\unrestrict` pg_dump session nonce; the schema content was byte-identical, so the noise-only change was reverted rather than committed. (Same pattern as 091's data-only migration 061.)
- **Fix 3 is a prompt fix, not an input_keys binding.** The `llm_single` executor delivers the prior phase output as the user turn via `_prior_output_text` (phase_types.py:116/231) and ignores `input_keys` entirely (only `programmatic` reads it, phase_types.py:205), so binding `input_keys` on the summarize/merge/finalize phases would be a no-op. The corrective fix is a self-sufficient, anti-delegation system prompt on the 3 downstream phases.

## Deviations from Plan

None — plan executed exactly as written. (The full-schema.sql no-commit decision is the plan's own conditional instruction — "commit only if it actually changed" — not a deviation.)

## Issues Encountered

- A direct `docker exec psql` verification query of the live DB was denied by the sandbox in this continuation run; the live verification evidence (Fix 1/2/3) was already captured by the operator at checkpoint resolution and is recorded above. No re-query was needed to close the plan.

## User Setup Required

None — no external service configuration. The one operator step (apply migration 065 via the Supabase SQL editor) was the Task 3 checkpoint and is RESOLVED.

## Next Phase Readiness

- **Wave 1 unblocked:** 093-02 (task_service gateway-consumption rewrite, F9 core) and 093-03 (model-resolver field fix) can now run — their RED scaffolds + the gateway contract are in place. The seed fix landing FIRST was the precondition (the lint extension and the live UAT both require the 4 seeds to lint clean and `literature_review` to fan out).
- **`test_093_verify_gate_route_forward.py` is now un-skippable** — migration 065 is applied, so a downstream plan/the verifier can flip it GREEN.
- **PARITY-02 stays OPEN** — this plan is the deterministic substrate; phase verification (the native-7 × 5-phase-type × 4-workflow LIVE UAT, D-13/SC#6, authored in 093-VALIDATION.md) owns requirement closure.

## Self-Check: PASSED

**Created files exist:**
- FOUND: supabase/migrations/065_harness_seed_fixes.sql
- FOUND: backend/tests/test_093_split_topic.py
- FOUND: backend/tests/test_093_surfacing.py
- FOUND: backend/tests/integration/test_093_ask_user_workflow_run_live.py
- FOUND: backend/tests/integration/test_093_verify_gate_route_forward.py
- FOUND: backend/tests/test_harness_reachability.py (modified)
- FOUND: backend/tests/unit/test_085_task_service.py (modified)
- FOUND: backend/tests/unit/test_sub_agent_routing.py (modified)

**Commits exist:**
- FOUND: c0ea0367 (Task 1)
- FOUND: 93b482a5 (Task 2)
- FOUND: afd9a60f (Task 3 author)

**Tests GREEN:** `pytest backend/tests/test_093_split_topic.py backend/tests/test_harness_reachability.py -q` → 13 passed (re-verified this continuation).

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*
