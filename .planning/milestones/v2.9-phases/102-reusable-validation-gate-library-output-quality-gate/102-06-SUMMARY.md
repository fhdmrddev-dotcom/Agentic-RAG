---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 06
subsystem: api
tags: [forced-emit, judge-verdict, pydantic, harness, validation-gate, publish, qual-01, gate-01]

# Dependency graph
requires:
  - phase: 102-03
    provides: "validator_kinds.py — the llm_judge_rubric kind + JudgeVerdict / JUDGE_RUBRIC_CORE schema"
  - phase: 102-05
    provides: "publish_service.py — the 4-stage publish path with _judge_golden_output + _drive_golden_run"
  - phase: 101.1
    provides: "forced_emit.py — the sealed single forced-shot substrate (EmitFieldMap validation)"
provides:
  - "forced_emit gains an additive schema_model: type[BaseModel] | None = None seam — validates against schema_model or EmitFieldMap (CR-01)"
  - "Both judge callers (publish _judge_golden_output + in-run _validate_llm_judge_rubric) pass schema_model=JudgeVerdict → emitted is a real JudgeVerdict, not None"
  - "Shared resolve_judge_model(settings) helper in validator_kinds — the in-run validator + publish path resolve the SAME registry default (WR-05)"
  - "The publish judge forwards owner_settings to forced_emit (IN-04); IN-01 drops unused imports from publish_workflow"
  - "An un-mocked integration test that drives forced_emit's real validate loop with a JudgeVerdict shot"
affects: [102-07, 102-08, 102-09, 102-verify-work, 103-workflows-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive verdict-agnostic schema seam: _model = schema_model or EmitFieldMap; the validation site is parameterized, the default is byte-identical, the caller owns the verdict parse"
    - "One shared judge-model resolver consumed by two sites (validator + publish) so a documented knob (Settings.harness_judge_model) resolves identically everywhere"

key-files:
  created: []
  modified:
    - backend/app/services/forced_emit.py
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/harness/publish_service.py
    - backend/tests/unit/test_forced_emit.py

key-decisions:
  - "forced_emit stays verdict-AGNOSTIC: it never imports JudgeVerdict; the schema_model param is a generic BaseModel seam and the verdict parse stays in the caller (validator_kinds / publish_service)"
  - "The dead JudgeVerdict.model_validate(raw) re-parse in publish_service is now the REAL (no longer dead) validation site — kept, because forced_emit returns the validated JudgeVerdict instance and the caller owns the verdict contract"
  - "owner_settings degrades gracefully to None (the judge still resolves an independent forceable model) so a settings-load failure never blocks publish"

patterns-established:
  - "Pattern: additive optional schema seam with a byte-identical default — the existing EmitFieldMap path and every emit caller are unchanged (schema_model=None)"
  - "Pattern: un-mocked integration test mocking ONLY the gateway boundary (open_stream) so the real _validate_args / recover_narrated_emission loop is exercised — the 099/101 mock-mask antidote"

requirements-completed: [GATE-01, QUAL-01]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 102 Plan 06: CR-01 Judge Wiring (forced_emit schema_model seam) Summary

**forced_emit gains an additive `schema_model` seam (default byte-identical EmitFieldMap); both judge callers now pass `schema_model=JudgeVerdict` and resolve via a shared `resolve_judge_model`, closing the QUAL-01 / GATE-01 keystone where every publish blocked at `blocked_stage="judge"` because the judge could never produce a verdict.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13T14:06:00Z
- **Completed:** 2026-06-13T14:24:05Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **CR-01 closed (the primary goal-blocker for BOTH GATE-01 and QUAL-01).** `forced_emit` previously validated every returned tool-call's arguments EXCLUSIVELY as `EmitFieldMap`; both judge callers passed a `JudgeVerdict` tool schema, so `emitted` was ALWAYS `None`, the judge never produced a verdict, and EVERY publish blocked at `blocked_stage="judge"` regardless of output quality. The additive `schema_model: type[BaseModel] | None = None` seam threads `_model = schema_model or EmitFieldMap` through the happy-path validate loop AND `recover_narrated_emission`; the default preserves `EmitFieldMap` byte-identically for every existing emit caller.
- **Both judge callers wired to `JudgeVerdict`.** The in-run `_validate_llm_judge_rubric` live path and the publish `_judge_golden_output` both pass `schema_model=JudgeVerdict` — `emitted` is now a real `JudgeVerdict` instance on success.
- **WR-05 — shared judge-model resolution.** A module-level `resolve_judge_model(settings)` helper resolves `Settings.harness_judge_model` or the first registry default in `("claude-opus-4-8", "gpt-5.5")` with `forced_emission` truthy; both the in-run validator AND the publish path call it, so the documented knob now resolves identically everywhere (previously the validator failed "no judge model resolved" with the shipped default while the publish path resolved a default).
- **IN-04 — owner_settings forwarded** to the publish judge shot (`user_settings=owner_settings` instead of `None`); **IN-01 — unused imports** (`create_workflow_run` / `load_run_phases` / `write_audit`) dropped from `publish_workflow`'s import block (used only by helpers that re-import them locally).
- **One un-mocked CR-01 integration test** drives `forced_emit`'s real validate loop with a `JudgeVerdict`-shaped shot and asserts `isinstance(result["emitted"], JudgeVerdict)` — the test that proves the previously-hollow live judge path now flows a verdict; plus a regression test proving the default still validates `EmitFieldMap` and rejects a `JudgeVerdict` payload without `schema_model`.

## Task Commits

Each task was committed atomically (TDD plan — the substrate change ships with the existing forced_emit suite as its byte-identical-default proof; Task 3 is the test commit):

1. **Task 1: Add the additive schema_model seam to forced_emit (CR-01 substrate)** - `98146e54` (feat)
2. **Task 2: Wire both judge callers to JudgeVerdict + shared resolve_judge_model (WR-05) + IN-01/IN-04** - `a7816937` (feat)
3. **Task 3: UN-MOCKED CR-01 integration test — drive forced_emit's validate loop with a JudgeVerdict shot** - `260c0a0b` (test)

## Files Created/Modified

- `backend/app/services/forced_emit.py` - Added `from pydantic import BaseModel`; `_validate_args` + `recover_narrated_emission` + `forced_emit` gain `schema_model: type[BaseModel] | None = None`; validation site is now `_model = schema_model or EmitFieldMap` → `_model.model_validate(data)` (EmitFieldMap.model_validate count = 0); default path byte-identical.
- `backend/app/services/harness/validator_kinds.py` - Added module-level `resolve_judge_model(settings)` helper + `__all__` export; `_validate_llm_judge_rubric` resolves the model via `resolve_judge_model` (WR-05) and passes `schema_model=JudgeVerdict` (CR-01).
- `backend/app/services/harness/publish_service.py` - `_judge_golden_output` resolves the model via `resolve_judge_model` (WR-05), passes `schema_model=JudgeVerdict` (CR-01) + `user_settings=owner_settings` (IN-04), gains an `owner_settings=None` param; `publish_workflow` loads owner settings and forwards them; IN-01 drops the three unused imports.
- `backend/tests/unit/test_forced_emit.py` - Added `_judge_verdict_stream` helper + `test_forced_emit_judge_verdict_unmocked` (un-mocked judge validate-loop) + `test_forced_emit_default_still_emitfieldmap` (default-EmitFieldMap regression + JudgeVerdict-rejection-without-schema).

## Decisions Made

- **forced_emit stays verdict-AGNOSTIC.** The `schema_model` param is a generic `BaseModel` seam — `forced_emit` never imports `JudgeVerdict`. The verdict parse stays in the callers (the validator's `_evaluate_judge_verdict`, publish's `JudgeVerdict.model_validate(raw)`). This keeps the substrate decoupled and the default path byte-identical (T-102-06-01).
- **The previously-dead `JudgeVerdict.model_validate(raw)` re-parse in `publish_service` is kept** — with `schema_model=JudgeVerdict`, `forced_emit` returns a validated `JudgeVerdict` instance, so the re-parse is now the real (no longer dead) verdict-contract site; it stays in the caller because forced_emit is verdict-agnostic.
- **owner_settings degrades gracefully to None** — a `load_user_settings` failure logs and falls back; the judge still resolves an independent forceable model (T-102-06-03: forwarding the owner's already-resolved settings is no new leak — the publish path is owner-checked at stage 0).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `_judge_golden_output` `owner_settings` param is accepted by the existing `test_publish_service.py` mocks (AsyncMock absorbs the new kwarg); the `load_user_settings` call added in `publish_workflow` only fires at stage 4 (after the golden run), so the not_found / business_requirement / lint short-circuit tests never reach it.

## Verification

- **Plan target suite GREEN:** `cd backend && venv/Scripts/python -m pytest tests/unit/test_forced_emit.py tests/unit/test_validator_kinds.py tests/unit/test_publish_service.py -q` → **28 passed** (baseline 26 + 2 new Task 3 tests).
- **Task 3 new tests GREEN:** `-k "judge_verdict or default_still"` → **2 passed**.
- **forced_emit default byte-identical:** the pre-existing `test_forced_emit.py` EmitFieldMap suite stays green (11 of the 28); `grep EmitFieldMap.model_validate` count = 0 (replaced by `_model.model_validate`).
- **G-5 RED LINE held:** `git diff --stat HEAD~3 HEAD -- backend/app/api/threads.py backend/app/services/agent_loop.py backend/app/services/threads.py` is EMPTY — threads.py / agent_loop.py byte-untouched. Only the 4 plan-named files changed.
- **SEED-056 net-new-failure proof = 0:** reverting the 3 touched SOURCE files to the wave base `4c5242e6` and running the full unit suite (excluding my 2 new Task 3 tests) yields **56 failed / 750 passed** — IDENTICAL to HEAD's **56 failed / 752 passed** (the +2 passed is exactly my 2 new tests). The 56 are documented pre-existing rot (`test_retrieval_service`, `test_sandbox_service`, `test_sql_service`, `test_streaming_reliability`) that import NONE of the 4 changed modules. Source restored clean to HEAD; the plan target suite re-confirmed GREEN (28).

## Threat Surface

All 3 STRIDE threats addressed:
- **T-102-06-01 (Tampering — forced_emit schema_model seam) → mitigated:** the seam is verdict-AGNOSTIC (`_model = schema_model or EmitFieldMap`, default preserves EmitFieldMap; forced_emit never imports JudgeVerdict — no new coupling, no eval); the 101.1 truncation guard + honest-fail are inherited unchanged, so a narrated/truncated verdict cannot game the gate.
- **T-102-06-02 (EoP — judge model resolution / WR-05) → mitigated:** `resolve_judge_model` resolves an INDEPENDENT judge model (the `harness_judge_model` setting or a forced_emission-capable registry default), never the run model — no self-judging on BOTH the validator and publish paths (D-03 preserved).
- **T-102-06-03 (Info Disclosure — owner_settings to the judge / IN-04) → accepted:** owner_settings is the SAME owner-bound settings the golden run already used (D-v2.5 cached read); the publish path is already owner-checked at stage 0 — no cross-tenant leak.

No new security-relevant surface beyond the plan's threat_model.

## Next Phase Readiness

- **CR-01 is the keystone — plans 07/08/09 build on a real verdict path.** With `schema_model=JudgeVerdict` wired, a lint-clean workflow that produces GOOD output now reaches a REAL `overall_passed` verdict at publish instead of always blocking at `blocked_stage="judge"`; the in-run `llm_judge_rubric` gate can now produce a real verdict too.
- **Live acceptance pending:** the un-mocked unit test proves the validate loop flows a verdict deterministically; the REAL acceptance is the LIVE golden run on the project KB at `/gsd:verify-work 102` (the SC#10 4-axis cross-provider scoreboard).
- No blockers introduced. The orchestrator owns STATE.md / ROADMAP.md updates for this gap-closure phase (not touched by this plan).

## Self-Check: PASSED

- forced_emit.py / validator_kinds.py / publish_service.py / test_forced_emit.py — all FOUND (modified, committed).
- Commits `98146e54`, `a7816937`, `260c0a0b` — all FOUND in `git log`.

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-13*
