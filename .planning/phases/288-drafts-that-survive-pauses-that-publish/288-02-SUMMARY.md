---
phase: 288-drafts-that-survive-pauses-that-publish
plan: 02
subsystem: publish-gauntlet
tags: [auth-01, security, pause, gauntlet]
requirements: [AUTH-01]
key-files:
  modified:
    - backend/app/services/harness/publish_service.py
    - backend/app/api/workflow_wire.py
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/landing/facts.ts
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
  created:
    - backend/tests/unit/test_288_pause_lint.py
metrics:
  completed: 2026-10-19
---

# Phase 288 Plan 02: Gauntlet learns the pause Summary

A human-input step whose wait is 0, negative, or above the 30-minute ceiling is now refused at publish with a worded message, and a successful publish of a pause workflow says which pauses were answered automatically and not exercised.

## Commits

- 93b6c3fdb test(288-02): failing tests (RED)
- 0f418e59d feat(288-02): refuse out-of-range pause timeouts
- 5dadf28e5 feat(288-02): `auto_answered` on the success verdict
- 517344a8a feat(288-02): client block, stale copy fixed, ledger

## RED drive (D-08, T-288-04)

Run against the unmodified service (`pytest tests/unit/test_288_pause_lint.py`): 11 failed, 7 passed. Planted `timeout_seconds` 0, -5, 99999 and 1801 each produced NO finding from `_interactive_phase_failures`. Through the real `publish()` the same four values were NOT blocked, so the golden run was driven (`test_publish_blocks_at_interactive_phase_without_golden_run[0|-5|99999|1801]` all failed). GREEN: all four refused with exactly one finding, blocked at `interactive_phase`, `_drive_golden_run` never awaited. 1, 300 and 1800 still pass; the default (300) still publishes.

## SEED-137 coupling (T-288-05)

Nothing removed. The `on_failure == "ask_user"` refusal is untouched and re-asserted (`test_ask_user_validator_refusal_is_unchanged`, plus the shipped WR-04 cases and `test_187_armed_checkpoint_property`, `test_185_engine_attachment`, all green). The new check is added beside it in the same loop, not in `lint_workflow`, `LINT_CODES`, `human_input.py` or `LlmHumanInputPhaseConfig` (A-03).

## Assumption A3 resolved

The golden run's phase outputs ARE persisted, and `load_run_phases` returns them. `auto_answered` is derived from those rows (slug in the definition's pause steps AND output carries `_golden_run_mock`, read through `phase_output_object` so jsonb string scalars work). A `skipped` pause has no mock output and is never claimed (`test_a_skipped_pause_is_never_claimed_answered`). No static-scan fallback was needed. Pause-free workflows perform no extra read and the verdict keys stay `{published, version, golden_run_id}`.

## Verification

- Backend: `test_288_pause_lint.py` 18 passed; `test_publish_service.py` + `test_288` 101 passed; `test_214_publish_arg_gate`, `test_186_publish_race`, `test_182_publish_grounding_stage`, `test_256_judge_usage_counted` green.
- Frontend (`GSD_VITEST_MAX_WORKERS=2`): `PublishGauntlet.test.tsx` + `facts.test.ts` 97 passed; `tsc -p tsconfig.app.json` clean for the touched files. The frontend tests were written alongside the implementation rather than driven RED.
- `check-claude-md-size.cjs` exit 0 (95,672 chars); `check-hot-file-ledger.cjs --files <5 files>` exit 0.

## Deviations from Plan

None to the work. Notes:
- Only one helper-free inline change was made to `publish_service.py` per task (no new helper function added), honouring D-15.
- `CLAUDE.md` gained one FIRING row for `frontend/src/landing/facts.ts` (it crossed to 3 phases with this plan), placed next to the PublishGauntlet row per the ledger edit rules.

## Deferred / pre-existing (not fixed, out of scope)

- `tests/unit/test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node` fails: it expects an `llm_human_input` step with the default timeout to be refused, which Phase 200.3 deliberately stopped doing. Not caused by this plan (default 300 passes both before and after). The test needs retiring or re-pointing at the ask_user shape.
- `tests/test_182_canvas_gate.py::test_openapi_tracks_the_flag_in_both_directions_in_one_process` (extra `/workflow-runs` routes) and `tests/test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged` (11 != 8 test defs in `test_103_grounding_fidelity.py`) fail; neither file touches anything this plan changed.

## Known Stubs

None.

## Self-Check: PASSED

Created/modified files exist; commits 93b6c3fdb, 0f418e59d, 5dadf28e5, 517344a8a present on the worktree branch.
