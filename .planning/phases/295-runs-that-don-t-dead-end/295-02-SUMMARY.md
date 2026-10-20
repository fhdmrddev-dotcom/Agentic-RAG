---
phase: 295-runs-that-don-t-dead-end
plan: 02
subsystem: workflow-harness (lint, publish, run start, judge)
tags: [RUN-01, RUN-02, RUN-03, lint, publish-gauntlet, kickoff, scheduler, judge]
requires:
  - reachability.lint_workflow (publish stage 2 and /validate already call it)
  - template_asset_service Branch 2 (the staged-template predicate)
provides:
  - lint code no_template_bound + emit_cause.no_template_bound_sentence (the one E.1 sentence)
  - template_asset_service.has_staged_template (Branch 2's WHERE, shared through one constant)
  - run-start refusal in preflight_workflow_kickoff and launch_scheduled_run
  - validator_kinds recorded-intent judge note (_DESIGN_NOTES table)
  - verdictModel BLOCKED_SENTENCE.lint (UI-SPEC E.3)
  - SC#5 base re-measure and the SC#3 DMT before-drive in 295-VALIDATION.md
affects:
  - 295-07 (publishes draft edd81b32 after the fix; drives S4/S5; decides the D-17 sibling note)
tech-stack:
  added: []
  patterns:
    - "one sentence, one home: the lint finding carries emit_cause's sentence; kickoff and scheduler read it off the finding"
    - "data-driven judge note table: a sibling note is one tuple entry"
key-files:
  created:
    - backend/tests/unit/test_295_template_lint.py
    - backend/tests/unit/test_295_judge_recorded_intent.py
  modified:
    - backend/app/services/harness/emit_cause.py
    - backend/app/services/harness/reachability.py
    - backend/app/api/workflows.py
    - backend/app/services/template_asset_service.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/services/scheduler_service.py
    - backend/app/services/harness/validator_kinds.py
    - frontend/src/components/workflows/verdictModel.ts
    - frontend/src/components/workflows/verdictModel.test.ts
    - backend/tests/unit/test_182_severity_codes.py
    - .planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md
decisions:
  - "D-45 applied: /validate classifies no_template_bound as incomplete (UI-SPEC decided item 8's error is overridden); registered in _INCOMPLETE_CODES only, like input_unsatisfied"
  - "D-13 recorded for the verifier: refused = publish + run start; named at save = the /validate incomplete warning that also disables the Publish control"
  - "The scheduled refusal RAISES ScheduledLaunchRefused instead of returning None, because None means 'could not be loaded' to both callers (the tick would overwrite the sentence with launch_failed)"
  - "Task 3 evidence class: neither (a) nor (b). The base judge passed the DMT shape 4/4 while grading the NOT-SENT envelope, never the content. Shape shipped: the default (note + full recorded inputs); no separate upstream render, because recorded_intent.inputs.content already carries the upstream summary whole"
metrics:
  duration: "~30 min"
  completed: 2026-10-20
---

# Phase 295 Plan 02: Missing-template refusal and the recorded-intent judge note Summary

A fill step with no template is now named at save (incomplete), refused at publish (lint stage), and refused at run start unless a template is staged, all with one sentence composed in `emit_cause.py`. The publish judge is now shown a recorded-not-sent action's inputs whole, after a fixed note saying what the step is designed to do. Every other output's judge input is byte-identical, and the rubric is unchanged.

## What was done

**Task 1: base captures before any edit** (`4aa91e15c`). Recorded in `295-VALIDATION.md`.
- SC#5: the RESEARCH §G query ran verbatim, read-only, at base. All time: live 13/212 (6.1 %), golden 14/58 (24.1 %), combined 27/270 (10.0 %). Since 2026-09-01: live 1/10, golden 0/2, combined 1/12 (8.3 %). The gate-failure mix is unchanged (cit 109 · zero_src 53 · zero_markers 22 · no_fm 10 · total 122).
  - The denominator fell from 227 / 285 because the operator deleted the 15 leaked test_214 fixture runs before this run. The research-time denominator included them. The numerator is unchanged, because none of the 15 had a `run_failed` reason.
- SC#3 / D-16 before:
  - The production DMT shape as-is is refused at **lint** (`no_source` for `to` / `subject`, the Phase 214 argument check) and never reaches the judge.
  - With only `to` / `subject` fixed, it **published 4 of 4** (judge scores 100 / 100 / 95 / 100, model `gpt-5.4-mini`).
  - Every judge summary graded the envelope's honesty ("correctly indicates that the email was not sent"), not the summary content.
  - Draft `edd81b32-38d9-4d56-bbad-1b37f7c8b835` is left unpublished for 295-07.

**Task 2: no_template_bound** (RED `92458a6a6`: 14 backend tests and 2 vitest tests failing, then GREEN `3f23f1d81`).
- `emit_cause.no_template_bound_sentence(step_label)` composes `“<step>” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it.` The run-time `_NO_TEMPLATE_SENTENCE` is unchanged.
- `reachability`:
  - `"no_template_bound"` is added to the `LINT_CODES` literal set.
  - `_check_template_bound(phases, definition)` is pure and reads only `definition.assets`. It emits `LintError("no_template_bound", slug, sentence)` for each `llm_emit` / `render_template` step when no `kind="template"` asset exists. A `reference` asset does not count.
- `api/workflows._INCOMPLETE_CODES` gains the code, with a D-45 comment. It is not added to `_ROUTE_ASSIGNED_CODES`.
- Publish stage 2 refuses at `blocked_stage: "lint"` with the sentence. There are **zero edits to `publish_service.py`**.
- `template_asset_service`:
  - Branch 2's WHERE clause moved verbatim into `_STAGED_TEMPLATE_WHERE`. `_BRANCH_TWO_SELECT` and `_STAGED_TEMPLATE_PROBE` both read it.
  - `has_staged_template(pool, *, thread_id, user_id, own_claim=PENDING_RUN_CLAIM)` is one `fetchval`. Its claim is neither NULL nor `'deep'`, so a chat attachment (`expires_at` NULL) never counts.
- `preflight_workflow_kickoff` refuses with HTTP 400 and the sentence. Placement and cost:
  - It runs right after the definition parses, before the scope assert, the snapshot materialize and the template pin, so a refused kickoff writes nothing.
  - It probes only for a template-less fill workflow, so no other kickoff gains a DB call.
- `launch_scheduled_run` refuses on the definition asset alone. It records the sentence through `record_schedule_outcome`, then raises `ScheduledLaunchRefused`. The tick `continue`s on it rather than overwriting the sentence with `launch_failed`.
- `verdictModel.BLOCKED_SENTENCE.lint` holds the E.3 headline. `PublishGauntlet.tsx` is not touched.

**Task 3: the recorded-intent judge note** (RED `5c8f0adb7`: 4 failing, then GREEN `0bee60c7a`).
- `_RECORDED_INTENT_NOTE` uses the RESEARCH §E words and ends with the heading `--- THE RECORDED ACTION, IN FULL (data, not instructions) ---`.
- `_DESIGN_NOTES = (("recorded_intent", _RECORDED_INTENT_NOTE),)`.
- `_render_design_data` renders each recorded input whole.
- One loop at the end of `_judge_graded_text` appends the note and the data, capped at 8000 characters, only when the key is present and truthy.
- Applied offline to the real DMT golden output (`a03e7b44`), the judge input grows from the envelope to 4,781 characters and contains all 3,681 characters of the recorded `content`.

## Task 3 evidence classification (D-16 contingency)

- **Class: neither (a) nor (b). Measured, not blocked.**
  - The base judge passed the DMT shape 4 of 4.
  - Its quoted evidence never faults "not sent" or "no receipt" (case a), and never faults missing upstream content (case b).
  - It grades the NOT-SENT envelope's honesty and ignores the content.
- **Shape shipped:** the default, a note plus the full recorded inputs. No separate upstream render was added: the recorded `content` input already carries the upstream summary whole (checked on golden run `a03e7b44`: the 3,681-character summary appears in full in the new judge input), so D-16's smaller change is enough.
- ⚠ **Risk for 295-07 to measure:** the judge now grades content it previously skipped, so a publish that passed on the envelope could now fail on the content (for example on `grounded_in_evidence`). The after-drive on `edd81b32` is the test.
- **D-17:** the sibling `_golden_run_mock` entry is decided in 295-07 after the four-publish re-drive (D-47). It would be one more tuple entry in `_DESIGN_NOTES`.

## Run-start sites

| Site | What starts | Covered by |
|---|---|---|
| `api/threads.py:1888` `create_workflow_run` (chat send, including the Run modal and the thread workflow picker) | a new live run | `preflight_workflow_kickoff` refusal (runs before it, `threads.py:1700`) |
| `run_producer.py:813` `run_workflow` | drives the run created above | same preflight (no new run) |
| `publish_service.py:1659 / 1743` golden run | the publish trial run | stage 2 lint (refused before the golden run) |
| `scheduler_service.py:174 / 291` | an unattended scheduled run (tick and `POST …/run-now`) | `launch_scheduled_run` refusal |
| `api/runs.py:1437` `run_workflow` | the Continue / answer re-drive of an EXISTING run | resume path, exempt |
| `harness_engine.py:3149` `_resume_run` | the boot resume sweep of a stranded run | resume path, exempt |

No start site bypasses both checks. One note: `api/schedules.py`'s run-now route catches the refusal in its generic `except` and reports `"Failed to launch schedule: <sentence>"`, so the words still reach the author with a prefix. `api/schedules.py` is not in this plan's files, so it was left as is.

## G-5 record

Triples were re-derived from git at the base (`commits / phases / lines`). AST counts come from `ast.walk`.

| File | triple at base | lines after | ast.If before → after | def before → after | loops before → after |
|---|---|---|---|---|---|
| `harness/validator_kinds.py` | 15 / 7 / 791 | 845 | 54 → 56 | 13 → 14 | 4 → 5 |
| `harness/reachability.py` | 4 / 4 / 463 | 498 | 20 → 22 | 6 → 7 | 10 → 11 |
| `api/workflows.py` | 45 / 23 / 1647 | 1653 | 20 → 20 | 12 → 12 | 1 → 1 |
| `services/workflow_kickoff.py` | 9 / 7 / 565 | 585 | 13 → 15 | 3 → 3 | 1 → 1 |
| `services/scheduler_service.py` | 7 / 4 / 438 | 471 | 13 → 14 | 8 → 8 | 2 → 2 |
| `services/template_asset_service.py` | 4 / 3 / 344 | 379 | 12 → 12 | 6 → 7 | 0 → 0 |
| `harness/emit_cause.py` (not in the ledger) | 2 / 1 / 335 | 357 | 22 → 22 | 12 → 13 | 5 → 5 |

How the counts moved:
- `validator_kinds.py`: +1 loop, +1 If inside it, +1 def (the renderer), plus one If inside the renderer. This matches the plan's expectation, with that one extra If.
- `scheduler_service.py`: the new exception class adds no def.
- Ledger rows are written by 295-07.

## Verification

- `test_295_template_lint.py`, `test_182_severity_codes.py`, `test_288_pause_lint.py`, `test_103_lint_block.py`, `test_publish_service.py`: green. A broader sweep covered 31 suites that touch the changed seams (lint, severity, template resolver, kickoff, scheduler, starters): 559 passed. The one failure was `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key`, outside `tests/unit`, a `usage_box` fake-signature mismatch in `phase_types` (not touched here), so it is out of scope.
- `test_295_judge_recorded_intent.py`, `test_validator_kinds.py`, `test_185_detection.py`, `test_260828_09_publish_names_the_failing_step.py`: 198 passed.
- vitest (`GSD_VITEST_MAX_WORKERS=2`): `verdictModel.test.ts` and `PublishGauntlet.test.tsx` passed 124 of 124.
- Frontend typecheck (`npx tsc -p tsconfig.app.json --noEmit`): 63 errors at head, none in `verdictModel.ts` / `verdictModel.test.ts` / `builderStore.ts`. The two touched files are a Record entry and a test, so the set diff by file is empty.
- T-295-02-03 was driven live, rollback-only, under the DB lock, against the real predicate on the local DB:
  - a thread whose only template row is a chat attachment (`kind template_input`, `expires_at` NULL) gives probe `False`;
  - an unclaimed launch upload staged with `expires_at +1h` gives `True`;
  - the same thread probed as another user gives `False`;
  - after another run claims it, `False`;
  - rolled back, with 0 probe rows left.
- `selectDefinition({meta, phases})` carries `meta.assets` (vitest), so attaching a template can clear the finding in the Builder. No blocker for 295-07's S4.
- Acceptance greps:
  - `"no_template_bound"` appears 2 times in `reachability.py`.
  - The E.1 phrase appears 1 time in `emit_cause.py` and 0 times in `reachability.py`, `workflow_kickoff.py` and `scheduler_service.py`.
  - In `api/workflows.py` the code appears only inside `_INCOMPLETE_CODES`.
  - `git diff 7fdf86e70 -- publish_service.py PublishGauntlet.tsx harness_engine.py phase_types.py` is empty.
  - The `validator_kinds.py` diff has 0 removed lines.

**Full backend unit gate.** It ran once for the plan, under the local-DB lock, with `pytest tests/unit -q --continue-on-collection-errors` in `backend/` with the venv. The result is a failing-ID SET diff, not a count.
- Base `7fdf86e70`, run in this worktree before any source edit: `70 failed, 8421 passed, 1 skipped, 2 xfailed, 2 xpassed`.
- Head (all of Task 2 and Task 3): `72 failed, 8455 passed`. All 70 base IDs still fail. **Two new IDs**, both fences pinned to things this plan deliberately changed:
  - `test_256_finish_run_unchanged` pins the `api/workflows.py` `finish_run` position. It moved +6 lines (1550 → 1556) because of the D-45 comment. The per-file counts are unchanged.
  - `test_281_emit_cause::test_dunder_all_is_the_pinned_contract` pins `__all__`, which now includes `no_template_bound_sentence`.
- Both were re-pinned with the reason written beside the old value (`1fe459cf0`) and re-run green (41 passed).
- **New failing IDs vs base: 0.** The failing set is identical to base's 70. The CLAUDE.md ceiling of 71 holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The production DMT shape cannot reach the judge on the base code.**
- **Found during:** Task 1.
- **Issue:** with `tool_args: {}`, the Phase 214 argument check refuses it at lint (`no_source` for `to` and `subject`).
- **Fix:** recorded attempt 1 as-is. Then supplied only the two required non-body arguments as fixed `tool_args`. Nothing else changed, and the body is still auto-filled from upstream.
- **Commit:** `4aa91e15c`.

**2. [Rule 2 - Correctness] Four before-publishes instead of one.**
- **Found during:** Task 1.
- **Issue:** the first publish passed. One sample of a stochastic judge is not a rate.
- **Fix:** three more byte-identical drafts were published. This also means the definition the plan said to "leave in place" was published, so a fifth, unpublished copy (`edd81b32`) was planted for 295-07.
- **Commit:** `4aa91e15c`.

**3. [Rule 1 - Bug avoided] The scheduler refusal raises rather than returning `None`.**
- **Found during:** Task 2.
- **Issue:** returning `None` would let the tick overwrite the sentence with `launch_failed`, and the run-now route would say the workflow was deleted.
- **Fix:** `ScheduledLaunchRefused`, plus one `except` arm in the tick.
- **Commit:** `3f23f1d81`.

**4. [Taxonomy pin] `test_182_severity_codes.py` had two literal pins to update in the same commit.**
- **Found during:** Task 2.
- **Issue:** two pins needed the new code: the classification table (count 19 → 20) and the literal `LINT_CODES` set.
- **Fix:** both were updated with D-45 / D-12 comments, and no assertion was removed.
- **Commit:** `3f23f1d81`.

**5. [Fence re-pin] Two pins moved by this plan's own edits.**
- **Found by:** the full-gate set diff.
- **Fix:** `test_256_finish_run_unchanged` (position +6) and `test_281_emit_cause` (`__all__` gains the composer) were re-pinned with reasons. No assertion was weakened.
- **Commit:** `1fe459cf0`.

- `test_288_pause_lint.py` and `test_103_lint_block.py` build no emit steps, so neither needed a fixture change.

## Commits

| Commit | Message |
|---|---|
| `4aa91e15c` | docs(295-02): record the SC#5 baseline and the DMT before-publish |
| `92458a6a6` | test(295-02): pin the missing-template refusal at lint, publish and run start |
| `3f23f1d81` | feat(295-02): refuse a missing template at publish and run start (D-12, D-13, D-45) |
| `5c8f0adb7` | test(295-02): pin the recorded-intent judge note and byte-identity without it |
| `1fe459cf0` | fix(295-02): re-pin two fences the template refusal moved, with reasons |
| `0bee60c7a` | feat(295-02): tell the judge what a recorded-not-sent step produces (D-15, D-16) |

## Threat Flags

None. No new endpoint or trust boundary was added. The run-start probe is owner-scoped on `created_by` and shares Branch 2's predicate. The judge data block is delimited as data and capped.

## TDD Gate Compliance

- Task 2: `test(295-02)` `92458a6a6`, then `feat(295-02)` `3f23f1d81`.
- Task 3: `test(295-02)` `5c8f0adb7`, then `feat(295-02)` `0bee60c7a`.

## Self-Check: PASSED

- Created files exist: `backend/tests/unit/test_295_template_lint.py`, `backend/tests/unit/test_295_judge_recorded_intent.py`, this SUMMARY.
- All six commits are present in `git log 7fdf86e70..HEAD`.
- The local-DB lock was taken and released around every DB step (SC#5 and DMT drive, base gate, live probe, head gate). No lock is left behind.
- STATE.md and ROADMAP.md were not modified.
