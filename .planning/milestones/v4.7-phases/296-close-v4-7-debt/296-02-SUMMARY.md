---
phase: 296-close-v4-7-debt
plan: 02
subsystem: harness run lifecycle (boot sweep, re-drive, run ends, schedules)
tags: [harness, resume-sweep, ask_user, re-drive, cancel, reconciler, schedules, judge, pytest]
requires:
  - phase: 296-01
    provides: wave-1 merge (create_workflow_definition org kwarg, run evidence fixes)
provides:
  - "SEED-363: app.main.RUN_BOOT_SWEEPS module flag; tests/conftest.py turns the run-claiming sweeps off for every test lifespan"
  - "BUG-261025-03 (backend): a boot pauses a run waiting on an unanswered human step and consumes an answered one; it never re-asks"
  - "295-RES-a: one action_risk_pending row per armed approval; 289-F3: run confidence on the owner's buckets"
  - "SEED-362 (resume half): resumed / re-driven runs continue on workflow_runs.model + metadata.provider; create_workflow_run(provider=)"
  - "Truthful run ends: worded re-drive failure, True-only-when-spawned, one held lease retry, unloadable end expires its prompt, all-completed reads completed, cancelled step keeps no _awaiting_answer, Stop on a live producer names the person"
  - "295-IN-05: ScheduleTriggerResult.outcome + UI-SPEC C sentences (296-04's panel reads them); 295-IN-08: judge design note only for by-design recording; 293-IN-04: held unattended task"
affects: [296-05 (seeds: Run-now backoff), 296-06 (kickoff callers pass provider=), 296-04 (panel reads outcome)]
tech-stack:
  added: []
  patterns:
    - "Classify an active phase by the DEFINITION (_active_spec), never by the workflow_phases row (it carries no type)"
    - "Held fire-and-forget tasks (_BACKGROUND_TASKS + add_done_callback(discard)) in api/runs.py and unattended_launch.py"
    - "Who-stopped rides a sibling Redis level key (run_cancelled_by:{id}) beside the cancel flag"
key-files:
  created:
    - backend/tests/unit/test_296_lifespan_no_sweeps.py
    - backend/tests/test_296_boot_sweep_human_ask.py
    - backend/tests/unit/test_296_engine_touches.py
    - backend/tests/unit/test_296_run_ends_truthfully.py
    - backend/tests/unit/test_296_redrive_cap_paused.py
    - backend/tests/unit/test_296_schedule_trigger_words.py
    - backend/tests/unit/test_296_judge_note_and_tasks.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/app/services/harness_engine.py
    - backend/app/db/workflows.py
    - backend/app/api/runs.py
    - backend/app/services/harness/run_handoff.py
    - backend/app/services/run_reconciler.py
    - backend/app/services/run_lifecycle.py
    - backend/app/services/run_producer.py
    - backend/app/api/schedules.py
    - backend/app/models/schedule.py
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/unattended_launch.py
    - backend/app/services/harness/human_input.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
key-decisions:
  - "295-RES-a guard keys on ctx.engine_ask_approved[slug], not resume_answered_tool_call_id: consume_engine_answer CLEARS that flag before the armed checkpoint runs (measured by driving the real consume), so the plan's guard would never fire"
  - "295-IN-08 (D-07): by-design recording = the executor's own two by-design gates (golden run, live_connectors not fully on); read in validator_kinds, no phase_types touch"
  - "295-IN-03 strips _awaiting_answer only from object outputs (CASE jsonb_typeof); the plan's COALESCE would turn NULL into {} and '-' raises on a jsonb scalar"
  - "SEED-362: a recorded provider is used as recorded; no provider -> resolve_sub_agent_model_safely; no model -> owner default"
  - "DEBT-3 closed as did-not-reproduce: engine_pause writes pause_run first; nothing writes workflow_runs.status='cap_paused'"
requirements-completed: []
duration: ~2h40m
completed: 2026-10-26
---

# Phase 296 Plan 02: run lifecycle (W2a) Summary

**A test lifespan can no longer claim a live run. A boot now pauses a run that is waiting on a person instead of asking them again. Every run-end path records a true status and a worded reason.**

## Performance

- **Base sha:** `606a4e31b` (develop, including the merged 296-01 and 296-04)
- **Started:** 2026-10-26T18:15Z · **Completed:** 2026-10-26T20:17Z
- **Tasks:** 3 of 3, each committed RED first and then fixed (9 commits)
- **Files:** 31 changed, +1587 / −126

## RED evidence per row

| Row | RED test (observed failing before the fix) | Fix commit |
|---|---|---|
| SEED-363 + 289-IN-08 | `test_296_lifespan_no_sweeps.py`: 4 red (`RUN_BOOT_SWEEPS` missing; the lifespan awaited the sweep; no space in the import line) | `6d51f603b` |
| BUG-261025-03 (backend) | `test_296_boot_sweep_human_ask.py`: unanswered → `_resume_run` awaited (`assert 1 == 0`); answered → flag `None != 'tc-hi'` | `bf8a4467b` |
| 295-RES-a | `test_296_engine_touches.py`: approve + re-drive through the real `consume_engine_answer` wrote **2 rows and 2 emits** | `bf8a4467b` |
| 289-F3 | owner buckets 0.9/0.8 at an average of 0.6 → the run read `medium`, should be `low` (the kwarg did not exist) | `bf8a4467b` |
| SEED-362 | resume ctx model `gpt-5.5 != glm-5.2`; no `ctx.provider`; select lacked `wr.model`; `create_workflow_run(provider=)` TypeError | `bf8a4467b` |
| 289-IN-05 | a failed context build returned True | `ba6bc4f64` |
| 289-WR-06b | a lost claim scheduled no retry (`_BACKGROUND_TASKS` missing) | `ba6bc4f64` |
| 295-IN-07 | audit reason `ask_user re-drive failed` | `ba6bc4f64` |
| 295-IN-01 | the winning unloadable end expired nothing | `ba6bc4f64` |
| 295-IN-02 | an all-completed run ended `failed`; the query had no `all_completed` | `ba6bc4f64` |
| 295-IN-03 | the cancel SQL kept `_awaiting_answer` | `ba6bc4f64` |
| 295-RES-b | no `stopped_by` on the broadcast; Step 3a broadcast nothing; the F2 escape recorded no stop | `ba6bc4f64` |
| 295-IN-05 | no `outcome`; the raw `boom secret` reached the wire; a refusal read `Failed to launch schedule: …` | `3a6d7aae8` |
| 295-IN-08 | `by_design` / `recording_by_design` missing (the note was always attached) | `3a6d7aae8` |
| 293-IN-04 | `unattended_launch._BACKGROUND_TASKS` missing | `3a6d7aae8` |

## DEBT-3 verdict: did not reproduce

`tests/unit/test_296_redrive_cap_paused.py` was green at the base: **3 passed**.

- `engine_pause` writes `pause_run` before anything else.
- A `cap_paused` run that reaches an engine ask moves to `paused`. When the answer arrives it is re-driven: `ok is True`, `_resume_run` is awaited once, and the run ends `active`.
- Nothing writes `workflow_runs.status='cap_paused'`. A grep found no backend writer; every `cap_paused` write goes to `runs`.

`api/runs.py` did not change for DEBT-3, and `run_is_cap_paused` is not used anywhere in it.

## G-5 record

`harness_engine.py`: the four audited touches, measured.

Branch counts are If / IfExp / Except, read from the AST before and after:

| Function | Base | After |
|---|---|---|
| `resume_stranded_workflows` | 13 / 2 / 3 | 12 / 2 / 3 |
| `_run_phase_with_gates` | 15 / 8 / 6 | 16 / 8 / 6 |
| `_build_resume_context` | 8 / 5 / 5 | 9 / 8 / 6 |
| `_finalize_run_grounding` | 3 / 2 / 0 | 3 / 2 / 0 |

`api/runs.py` `_redrive_paused_workflow_run` went from 5 / 1 / 4 to 6 / 1 / 4.

Ledger triples, each re-derived in the same commit as its fix:

| File | Triple |
|---|---|
| `main.py` | `95/69/991` |
| `harness_engine.py` | `69/27/2992` |
| `db/workflows.py` | `62/31/2857`, then `63/31/2862` |
| `human_input.py` | `7/4/376` |
| `api/runs.py` | `53/23/2033` |
| `run_handoff.py` | `9/2/444` |
| `run_reconciler.py` | `6/4/415` |
| `run_lifecycle.py` | `11/7/827` |
| `run_producer.py` | `26/14/1220` |
| `validator_kinds.py` | `19/9/918` |
| `unattended_launch.py` | `6/2/361` |
| `api/schedules.py` | `4/4/299`. New row. It had no row for its whole life and now fires |
| `models/schedule.py` | `3/3/231`. New row. It had no row for its whole life and now fires |

The armed-block seam was not taken and is still owed.

## Guardrail overrides for STATE.md

> Phase 296-02. The G-5 audited reading allowed 4 one-statement touches in `harness_engine.py` and 5 small touches in `api/runs.py`. Measured, the touches were larger than one statement each:
>
> **`harness_engine.py`**
> 1. **BUG-261025-03:** the dead branch was deleted, together with `_active_tool_call_id`, its only helper. The new arm is about 8 lines plus one `elif` (set the flag, then `resume_run`). `_active_spec` was extracted and `_is_armed_action_risk` now calls it. The plan allowed that extraction.
> 2. **RES-a:** one `if` wraps the existing audit and emit.
> 3. **289-F3:** 3 lines (a param on `_finalize_run_grounding`, the argument at its call site, and the kwarg).
> 4. **SEED-362:** about 15 lines (metadata parse, model choice, an import name, `provider=` on the ctx).
>
> **`api/runs.py`:** 4 touches, and DEBT-3 made no change.
> - The constant and the audit reason.
> - The return fix.
> - The held retry: `_BACKGROUND_TASKS`, `_spawn`, `_redrive_after_lease`, and a `_retry` kwarg.
> - The SELECT columns.
> - Also, the producer shell's error string now uses the same constant.
>
> **Touched outside `files_modified`:**
> - `harness/human_input.py`: a stale comment corrected, no code (FIRES, 7/4/376).
> - `models/schedule.py`: `ScheduleTriggerResult` lives there.
> - `docs/public/api/openapi.{snapshot,public}.json`: regenerated for the additive `outcome` field, because `test_276_openapi_snapshot_fresh` pins it.
> - Pinned tests, each reconciled with a written reason (the D-206-07 precedent): `test_185_engine_attachment`, `test_harness_resume`, `test_200_human_gate_pause`, `test_289_redrive_failure`, `test_256_finish_run_unchanged` (call-site positions re-derived; the COUNTS stayed identical), and `test_295_09_review_fixes`.

## Backend gate (under the local-DB lock)

**HEAD (`0a3fba8fd` plus this SUMMARY):**
- Command: `node scripts/check-backend-unit-baseline.cjs -- tests/unit -q --continue-on-collection-errors -p no:cacheprovider -rf`
- Result: **`70 failed, 9956 passed, 1 skipped, 2 xfailed, 2 xpassed` — `[GATE PASSED] failed: 70 <= 71, errors: 0`**

**Base comparison run:**
- What it ran: the same suite with all 16 of this plan's modified `backend/` files written back to their `606a4e31b` content and the new 296 unit test files ignored.
  - `main.py` and `tests/conftest.py` were kept at HEAD on purpose. Without the SEED-363 guard, a base run would boot the real resume sweep against the shared DB.
- Result: **71 failed, 9913 passed.**

**Comparing the two sets:**
- The **final failing set is a subset of the base set**, so no failing id is new. The one apparent difference is a line-wrap artifact in the `-rf` output (the same test id, `test_extraction_service.py::test_legacy_extractor_pdf_matches_golden`).
- The base-only id, `test_276_openapi_snapshot_fresh`, comes from the comparison method itself: the docs snapshot stayed at HEAD while the model was at base. At HEAD it passes.

**Final failing set by file:**

| Test file | Failures |
|---|---|
| `test_retrieval_service.py` | 15 |
| `test_sql_service.py` | 12 |
| `test_explorer_agent.py` | 6 |
| `test_multimodal_query.py` | 5 |
| `test_111_1_reembed_kickoff.py` | 4 |
| `test_sandbox_service.py` | 3 |
| `test_lifespan.py` | 3 |
| `test_db_runs.py` | 3 |
| `test_module7_tools.py` | 2 |
| `test_extraction_service.py` | 2 |
| `test_cross_worker_cancellation.py` | 2 |
| `test_071_1_threadpool_sweep.py` | 2 |
| `test_streaming_reliability.py` | 1 |
| `test_published_workflow_ownership.py` | 1 |
| `test_phase56_iteration_start.py` | 1 |
| `test_per_format_ingestion.py` | 1 |
| `test_get_model_capability_inference.py` | 1 |
| `test_forced_emit.py` | 1 |
| `test_chat_tool_approval.py` | 1 |
| `test_200_1_phase_output_shape.py` | 1 |
| `test_190_review_fix_data_layer.py` | 1 |
| `test_075_4_unknown_provider_error.py` | 1 |
| `test_061_consumer.py` | 1 |

**The first HEAD run read 72.** The two ids that were new are named and fixed under Deviations, item 8. They were:
- `test_295_09_review_fixes::test_wr05_both_judges_send_the_note_as_the_system_prompt`
- `test_296_run_ends_truthfully::test_the_producer_escape_records_the_stopper`

**Targeted suites, all green apart from failures that also fail at the base:**
- The plan's three verify commands.
- `test_harness_resume`, `test_295_engine_ask_redrive`, `test_185_engine_attachment`, `test_093_surfacing`, `test_187_armed_checkpoint_property`, `test_214_approval_names_service`, `test_289_phase_confidence`, `test_run_reconciler`, `test_289_redrive_failure`, `test_295_truthful_run_ends`, `test_run_lifecycle`, `test_062_cancel_run`, `test_workflow_phase_cancel`, `test_scheduler_circuit_breaker`, `test_256_finish_run_unchanged`, `test_280_maybe_row_fence`, `test_295_judge_recorded_intent`, `test_293_*`, `test_276_openapi_snapshot_fresh`.
- These also fail, and fail at the base as well:
  - `test_200_human_gate_pause::test_no_twenty_fifth_audit_kind_was_added`
  - `test_096_askuser_cleanup::test_pending_route_filters_dead_prompt_keeps_legacy`
  - The failures in `test_dual_mode_wiring`, part of 23 failures across 10 suites (`test_096_askuser_cleanup`, `test_200_human_gate_pause`, `test_dual_mode_wiring`, `test_harness_engine`, ...). The 23 ids were re-measured at HEAD after Task 3 and are **identical** to the base run of the same 10 suites.

**Other gates:**
- `node scripts/check-hot-file-ledger.cjs --files <all 13 source files>` passes.
- `node scripts/check-claude-md-size.cjs` passes.
- `node scripts/build-public-openapi.cjs --check` passes.

## Deviations from Plan

1. **[Rule 1] The RES-a guard key.**
   - The plan's guard, `getattr(ctx, "resume_answered_tool_call_id", None)`, would never fire. `consume_engine_answer` runs at the top of `_run_phase_with_gates`, clears that flag, and records `ctx.engine_ask_approved[slug]` before the armed checkpoint.
   - The guard keys on `engine_ask_approved` instead.
   - The RED test drives the real consume.
2. **[Rule 1] The 295-IN-03 SQL shape.** The plan used `COALESCE(output,'{}') - '_awaiting_answer'`. It is now `CASE WHEN jsonb_typeof(output)='object' THEN output - '_awaiting_answer' ELSE output END`, for two reasons:
   - the plan's version would turn NULL into `{}`;
   - `-` raises on a jsonb scalar.

   `stash_awaiting_answer` only ever writes an object.
3. **[Rule 2] SEED-363 also gates the periodic reconciler.** The periodic reconciler calls the same `reconcile_orphaned_runs` at t=0. SEED-363's own measured 295-04 incident was a reconciler sweep, so leaving it open would leave the defect.
4. **[Rule 1] The 2c answered arm also calls `resume_run`.** This mirrors arm 2a: a re-driven run must not read `paused`.
5. **[Rule 1] SEED-362: a recorded provider bypasses `resolve_sub_agent_model_safely`.** That resolver validates against the owner's *active* provider and would swap `glm-5.2` back to the owner's default. That is the defect, re-introduced.
6. **[Rule 1] 295-IN-08 is read in `validator_kinds` from the executor's own by-design gates.** The plan did not say how to read "the grant". `recorded_intent` carries no reason, and adding one would mean touching `phase_types.py` (FIRES, G-5 owed).
7. **[Rule 3] `models/schedule.py` was touched for the `outcome` field.** OpenAPI snapshots were regenerated, and `node scripts/build-public-openapi.cjs --check` passes. The phase286 `workflows_openapi.json` fixture does not cover schedules, so it was left untouched.
8. **[Rule 1] The plan-end gate found 2 order-dependent reds of my own,** both fixed in `0a3fba8fd`:
   - My lifespan test left the process-wide shutting-down flag set. Later F2 escapes skipped, which is what reddened `test_the_producer_escape_records_the_stopper`.
   - `test_295_09`'s WR-05 judge test depended on a settings cache left by earlier tests, because the note is now read off the run.

## Deferred / found, not fixed (out of scope)

- **`tests/test_096_ci_workflow_regression.py` hangs, and it hung at the base too.** It is outside `tests/unit`. A pytest process from this plan's Task 1 pinned-suite run has been hung on it since 18:35Z: Windows PIDs **101060** (venv launcher) and **94388** (`C:\Python312\python.exe`, about **26 GB** resident). I was refused permission to kill it. **The operator should end it.**
- **`scripts/check-backend-unit-baseline.cjs` reports a false pass when it is killed.** It printed `[GATE PASSED] … failed: 0 <= 71` after SIGTERM, before pytest had written any summary line.
- **Passing any argument through `--` replaces the default `tests/unit` path.** My first attempt ran the whole `tests/` tree for about 3 minutes, including `tests/integration` against the local DB, under my lock. It was stopped, and the orphaned pytest children were terminated.
- **`human_input.py` and `phase_types.py` were not refactored,** and no G-5 seam was taken.

## Self-Check: PASSED

- All 7 created test files were found on disk.
- All 9 task commits were found: `d267c6fff`, `6d51f603b`, `0d3d4d8d0`, `bf8a4467b`, `d08c8a37e`, `ba6bc4f64`, `665f290ed`, `3a6d7aae8`, `0a3fba8fd`.
- Acceptance greps:

  | Check | Result |
  |---|---|
  | `RUN_BOOT_SWEEPS` in `main.py` | 4 |
  | `RUN_BOOT_SWEEPS = False` in `conftest.py` | 1 |
  | the worded sentence in `runs.py` | 1 |
  | `_BACKGROUND_TASKS` in `runs.py` | 3 |
  | `_BACKGROUND_TASKS` in `unattended_launch.py` | 3 |
  | `except ScheduledLaunchRefused` | 1, placed above the generic arm |
  | `_compute_confidence(final_avg,` | 1 line |
  | the non-comment `ask_user re-drive failed` | 0 |

- STATE.md and ROADMAP.md were not modified.

## Known Stubs

None.

## Threat Flags

None. T-296-15 to T-296-20 are mitigated as planned. T-296-17 is asserted by `test_an_unexpected_error_never_puts_its_text_on_the_wire`. T-296-19 (exactly one retry) is asserted by `test_a_lost_claim_retries_once_after_the_lease_and_never_loops`.
