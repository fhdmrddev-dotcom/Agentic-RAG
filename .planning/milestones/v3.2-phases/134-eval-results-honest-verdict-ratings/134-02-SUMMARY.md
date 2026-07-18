---
phase: 134-eval-results-honest-verdict-ratings
plan: 2
subsystem: api
tags: [eval, llm-judge, forced-emit, cross-provider, pydantic, sse, pytest]

# Dependency graph
requires:
  - phase: 134-01
    provides: "migration 081 — additive verdict columns on eval_results (verdict_state/passed/score/reason/judge_model) + rollup columns on eval_runs (passed_count/measured_count/verdict_summary) + eval_ratings table"
  - phase: 133
    provides: "net-new eval runner (eval_runner_service.run_eval_job, _run_arm, _persist_result), eval_run.py Pydantic contracts, RunContext.skill_catalog_override, the eval_* SSE vocabulary + companion runs row"
  - phase: 102
    provides: "the shipped workflow LLM judge reused READ-ONLY — validator_kinds.resolve_judge_model + JudgeVerdict; publish_service._judge_golden_output call pattern; forced_emit cross-provider key copy"
provides:
  - "_judge_eval_answer — an eval-specific LLM judge that grades an answer against a case's free-text expected_behavior, reusing resolve_judge_model + JudgeVerdict READ-ONLY via forced_emit(schema_model=JudgeVerdict)"
  - "EVAL_JUDGE_RUBRIC (expected_behavior woven as DATA, anti-injection) + EVENT_VERDICT eval_verdict SSE event"
  - "inline grading of BOTH arms in _run_arm — D-04 honesty gate (only completed+non-empty arms graded), same-insert verdict (D-06), honest not_measured / judge_error states"
  - "with-skill run rollup at finalize (passed_count/measured_count/verdict_summary) — with-skill-only denominator, guarded so a cancelled/interrupted run reads NULL"
  - "single-typed verdict/rollup Pydantic fields on EvalResultResponse + EvalRunResponse (Gemini type:[] array trap avoided)"
  - "the machine-verifiable half of SC#10 (D-12): judge-provider-independence + not_measured-honesty units + a Deep byte-identical guard"
affects: [134-03, 134-04, 135, 136]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eval judge = the shipped workflow judge reused READ-ONLY via function-local imports (never edit validator_kinds.py) + an eval-adapted rubric"
    - "Independent judge provider passed EXPLICITLY to forced_emit (never user_settings.active_provider — the provider-under-test) — cross-provider key copy happens inside forced_emit"
    - "Honesty gate: grade only status==completed AND output.strip(); errored/empty -> not_measured with the judge NEVER called; completed-but-ungradeable -> judge_error"
    - "Run-LOCAL rollup accumulator (no module-global run state — D-PRD-12/WORKER_COUNT=2); rollup written only on clean completion (cancelled/interrupted reads NULL)"

key-files:
  created: []
  modified:
    - "backend/app/services/eval_runner_service.py — _judge_eval_answer + EVAL_JUDGE_RUBRIC + EVENT_VERDICT; inline grading in _run_arm; with-skill rollup in run_eval_job; verdict params on _persist_result + rollup params on _update_eval_run_status"
    - "backend/app/models/eval_run.py — single-typed verdict fields on EvalResultResponse + rollup fields on EvalRunResponse"
    - "backend/tests/test_eval_runner.py — 4 new verdict/not_measured/rollup/judge-provider-independence units + Deep byte-identical guard; existing 2 hermetic tests mock the judge"

key-decisions:
  - "Grade BOTH arms against expected_behavior on the independent resolve_judge_model model, routed by EXPLICIT provider= (D-01/D-02/D-03)"
  - "Errored/empty arms honestly not_measured with the judge never called (D-04); completed-but-ungradeable arms judge_error (OQ1)"
  - "verdict_summary = pass iff measured_count>=1 AND passed_count==measured_count — a NON-authoritative default; Phase 136 owns the real publish threshold (D-07/OQ2)"
  - "Rollup counts with-skill arms only (OQ3); without-skill verdict is stored for the A/B story + SI-01, not the denominator"
  - "Cancelled/interrupted runs read NULL rollup (guarded by final_status==completed) — never a misleading partial count"

patterns-established:
  - "Pattern 1: same-insert verdict — verdict columns ride the single _persist_result INSERT (D-06), never a follow-up UPDATE"
  - "Pattern 2: run-local rollup accumulated from each WITH-arm _run_arm return, written at finalize (D-PRD-12-safe)"

requirements-completed: [EVAL-03]

# Metrics
duration: ~17min
completed: 2026-07-01
---

# Phase 134 Plan 02: Honest Verdict Engine Summary

**Inline dual-arm LLM-judge verdict on the net-new eval runner — reusing the shipped workflow judge (`resolve_judge_model` + schema-bound `JudgeVerdict`) READ-ONLY via an independent, explicitly-routed `forced_emit` shot, with honest `not_measured`/`judge_error` states and a with-skill-only run rollup.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-01T22:26:00+04:00
- **Completed:** 2026-07-01T22:43:00+04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `_judge_eval_answer` mirrors `publish_service._judge_golden_output` stripped of the WorkflowDefinition coupling: resolves the independent judge model (D-03), builds the forced `judge_verdict` tool from `JudgeVerdict.model_json_schema()`, runs a `forced_emit(provider=<judge provider>, schema_model=JudgeVerdict)` shot inside a ≤3 bounded retry that breaks on the first real verdict and retries only a transient non-verdict, and returns the verdict dict or an honest `{"failure": ...}` — a coerced/truncated/absent verdict can never become a silent pass.
- Inline grading wired into `_run_arm`: the D-04 gate grades ONLY a `status=="completed"` non-empty arm; an errored/empty arm stays `not_measured` with the judge NEVER called (so the deferred cross-provider baseline bugs surface honestly per D-11); a completed-but-ungradeable arm becomes `judge_error` with a ≤200-char reason (T-134-06). The verdict is written in the SAME `_persist_result` insert (D-06) and an additive `eval_verdict` SSE event is emitted after `eval_case_done` (D-05).
- With-skill run rollup computed in `run_eval_job` from each WITH-arm's returned outcome (run-local, no module-global — D-PRD-12), written at finalize as `passed_count`/`measured_count`/`verdict_summary` — with-skill-only denominator (OQ3), non-authoritative default (OQ2), guarded by `final_status == "completed"` so a cancelled/interrupted run reads NULL rollup.
- Single-typed verdict + rollup Pydantic fields added to `EvalResultResponse`/`EvalRunResponse` (no `list[...]` / multi-type union — Gemini `type:[...]` array trap avoided).
- Four honest-verdict unit tests + a Deep byte-identical guard lock the machine-verifiable half of SC#10 (D-12); Deep Mode stays byte-identical and `validator_kinds.py` is reused READ-ONLY (D-13).

## Task Commits

Each task was committed atomically:

1. **Task 1: Eval judge contract (`_judge_eval_answer`, rubric, verdict event, Pydantic fields)** - `3c300930` (feat)
2. **Task 2: Wire inline grading (D-04 gate + same-insert verdict) + with-skill rollup** - `3a122173` (feat)
3. **Task 3: Verdict/not_measured/rollup/judge-provider-independence units + Deep guard** - `9c2599f8` (test)

**Plan metadata:** this SUMMARY (docs) — STATE.md/ROADMAP.md/REQUIREMENTS.md intentionally NOT touched (orchestrator owns those writes).

## Files Created/Modified
- `backend/app/services/eval_runner_service.py` - Added `EVENT_VERDICT`, `EVAL_JUDGE_RUBRIC`, `_judge_eval_answer`; extended `_persist_result` (verdict payload, same insert) + `_update_eval_run_status` (optional rollup params); wired the D-04 grading gate + `eval_verdict` emit + outcome return into `_run_arm`; added the with-skill rollup accumulation + guarded finalize in `run_eval_job`.
- `backend/app/models/eval_run.py` - Single-typed `verdict_state`/`verdict_passed`/`verdict_score`/`verdict_reason`/`judge_model` on `EvalResultResponse`; `passed_count`/`measured_count`/`verdict_summary` on `EvalRunResponse`.
- `backend/tests/test_eval_runner.py` - `test_completed_arm_graded`, `test_errored_arm_not_measured`, `test_rollup_counts`, `test_judge_provider_independent`, `test_deep_mode_byte_identical_guard`; a shared `_FAKE_VERDICT_PASS`; `expected_behavior` added to the shared CASES; the two existing hermetic tests now mock `_judge_eval_answer`.

## Decisions Made
- **Judge-provider resolution in tests is dynamic:** `test_judge_provider_independent` computes the expected provider from `get_model_capability(resolve_judge_model(settings))` and also asserts it is NOT the provider-under-test (`openai`). This is robust to a set `harness_judge_model` while still proving D-03 independence (a regression that routed on `active_provider` would flip the provider to `openai` and fail both asserts).
- **Rollup verified via `_update_eval_run_status` mock:** the service-level recording fake (`_RecTable`) does not apply UPDATEs, so `test_rollup_counts` patches `_update_eval_run_status` and inspects its call kwargs — this directly tests `run_eval_job`'s rollup computation (`passed_count`/`measured_count`/`verdict_summary`) rather than a fake's storage.
- **`judge_model` recorded via `resolve_judge_model(settings)` inside `_run_arm`** (per plan Pattern 1) — deterministic re-resolution of the same singleton the judge used; kept `_judge_eval_answer`'s return a pure verdict dict.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing hermetic tests would attempt a live judge call once grading was wired**
- **Found during:** Task 2 (Wire inline grading)
- **Issue:** The two shipped 133 tests (`test_two_results_per_case`, `test_sse_vocabulary`) drive COMPLETED arms with a mocked `run_agent_loop`. Wiring the D-04 grading gate means a completed arm now calls `_judge_eval_answer` → the real `forced_emit` → a live (paid/flaky/hanging) provider call, breaking the suite's explicit "No live LLM / no live DB" invariant and Task 2's "existing tests still pass (no regression)" acceptance.
- **Fix:** Mocked `_judge_eval_answer` (via `patch.object(eval_runner_service, "_judge_eval_answer", AsyncMock(return_value=dict(_FAKE_VERDICT_PASS)))`) in both existing tests, and added a shared `_FAKE_VERDICT_PASS` + `expected_behavior` to the shared CASES. `test_sse_vocabulary`'s structural assertions still hold with the additive `eval_verdict` events (the last `eval_*` event is still `eval_complete`).
- **Files modified:** backend/tests/test_eval_runner.py
- **Verification:** `pytest tests/test_eval_runner.py -q` → 11 passed (6 existing + 4 new + guard); no network access in the suite.
- **Committed in:** `3a122173` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to preserve test hermeticity + Task 2's no-regression acceptance. No scope creep — the grading behavior and all declared assertions are unchanged; only the two existing tests gained a judge mock they now require.

## Issues Encountered
- **Task 2 is tagged `tdd="true"` but the plan authored its tests in Task 3** (a RED/GREEN split across tasks). Executed in plan order 1→2→3: contract (feat) → wiring (feat) → tests (test). There is no separate RED `test(...)` commit before the wiring because the plan deliberately placed all four new tests in Task 3; the RED→GREEN proof for the new behavior therefore lands in the Task 3 commit, which passed on first full run (11/11). Called out here for TDD-gate transparency.

## TDD Gate Compliance
- Plan frontmatter `type: execute` (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR gate does not apply. Task 2's per-task `tdd="true"` is satisfied by the Task 2 (feat, wiring) + Task 3 (test, behavior proof) pair; all four behavior tests + the guard are green. No unexpected-pass RED violation (the new tests genuinely exercise the Task 1+2 wiring — e.g. `test_errored_arm_not_measured` asserts `judge.await_count == 0`).

## User Setup Required
None - no external service configuration required. (Migration 081 was applied to the live DB in Plan 134-01; the judge reuses the already-present `anthropic_api_key`.)

## Next Phase Readiness
- The automated "passed" verdict + honest `not_measured`/`judge_error` states + with-skill rollup are persisted inline and stream over `eval_verdict` — ready for Plan 134-03 (owner-gated `PUT rating`) and Plan 134-04 (thin `SkillEvalSection` readout: verdict line + side-by-side per-arm pass/fail + reason).
- Downstream consumers unblocked: Phase 136 (publish gate) and Phase 135 (auto-re-eval) can read the pass/fail verdict + rollup.
- **Live SC#10 4-axis UAT (U1–U9 in 134-VALIDATION.md) is still pending** and MUST run at `/gsd:verify-work` (D-12) — including the intentional errored-arm row (U8: a `claude-sonnet-5` without-skill baseline hitting BUG-260701-01 must render `not_measured`, never a fabricated score). The machine-verifiable backstop is green; the live cross-provider proof is the human gate.
- Red line intact: `git diff --quiet backend/app/services/agent_loop.py` and `backend/app/services/harness/validator_kinds.py` both exit 0.

## Self-Check: PASSED
- Files exist: `eval_runner_service.py`, `eval_run.py`, `test_eval_runner.py` — all FOUND.
- Commits exist: `3c300930`, `3a122173`, `9c2599f8` — all FOUND.
- `_judge_eval_answer` defined; full runner suite 11/11 green; D-13 red line (agent_loop.py + validator_kinds.py) byte-identical (both exit 0).

---
*Phase: 134-eval-results-honest-verdict-ratings*
*Completed: 2026-07-01*
