---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 03
subsystem: harness
tags: [harness, validators, gate-library, freshness, judge, forced-emit, timing, GATE-01]

# Dependency graph
requires:
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: "Plan 01 the 9-kind ValidatorSpec.kind Literal + timing field (the kinds this plan implements); Plan 02 migration 070 live on :54322 (the receipt CHECK these kinds' downstream receipts use)"
  - phase: 101.1-guaranteed-emission-layer
    provides: "the forced_emit seam (llm_judge_rubric rides it), check_coverage + assert_integrity primitives (citations_required + output_file_valid wrap them), the EmitFieldMap flat shape check_coverage normalizes"
  - phase: 091-harness-engine
    provides: "the closed VALIDATOR_REGISTRY + register_validator + run_gates fan-in (the 5 kinds plug into); GateResult.validator_index (WR-03 threading)"
  - phase: 098-project-folder-binding
    provides: "the resolved folder_scope (server-side ids) freshness queries — PROJ-02, NOT a prompt hint"
provides:
  - "VALIDATOR_REGISTRY gains all 5 library kinds on import (citations_required, output_file_valid, structure_check, llm_judge_rubric, freshness — D-12) via side-effect registration"
  - "run_gates gains an optional keyword-only timing kwarg (D-10 back-compat half); default None runs ALL specs byte-identical; validator_index stays the FULL-list index"
  - "freshness.py: newest_document_age_days + exact_stem_collisions (net-new deterministic KB queries, $N placeholders only, scope-bound — T-102-03-05)"
  - "JudgeVerdict + JudgeCriterionVerdict schema (flat, extra=forbid) + JUDGE_RUBRIC_CORE fixed prompt (D-04) for the judge's forced emission"
  - "the _judge_verdict / _freshness_probe / output_file.opened pre-computed-verdict seam (the engine + Plan-04/05 feed an already-computed verdict to the gate)"
affects: [102-04 engine seams (timing=pre wiring + ask_user disposition consume freshness's structured finding), 102-05 publish service (runs the forced judge shot, feeds _judge_verdict to llm_judge_rubric)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First-class @register_validator library kind wrapping a shipped primitive (function-local heavy import; fails CLOSED, never raises into run_gates)"
    - "Pre-computed-verdict probe seam on the gate output (_judge_verdict / _freshness_probe / output_file.opened) — the gate evaluates a verdict the caller computed (publish_service runs the forced judge shot; the gate is pure)"
    - "Parseable structured-finding prefix in error_message (freshness:staleness|... vs freshness:version_ambiguity|...) — the contract the Plan-04 ask_user disposition parses"
    - "Optional keyword-only timing kwarg on run_gates with default None = byte-identical (the GateResult.validator_index default-None back-compat discipline)"

key-files:
  created:
    - "backend/app/services/harness/freshness.py"
    - "backend/app/services/harness/validator_kinds.py"
  modified:
    - "backend/app/services/harness/validators.py"
    - "backend/app/services/harness/__init__.py"
    - "backend/tests/unit/test_pre_post_timing.py"
    - "backend/tests/unit/test_validator_kinds.py"
    - "backend/tests/unit/test_freshness.py"

key-decisions:
  - "llm_judge_rubric keeps forced_emit UNMODIFIED: the gate honors a pre-computed _judge_verdict first (the publish_service runs the forced judge shot itself, Plan 05); the validator's live fallback path also calls forced_emit and re-validates the result as a JudgeVerdict — forced_emit hard-binds EmitFieldMap end-to-end, so the verdict parse lives in the validator, not in forced_emit"
  - "freshness honors a _freshness_probe escape hatch before any ctx-pool query — the same seam the engine (Plan 04) uses to feed an already-resolved staleness/version finding to the gate (the live query path runs only when no probe is present)"
  - "the version-ambiguity check is OPT-IN (config.check_versions) — exact-stem collisions are a finding the author asks for, not a default wall (D-09 no-mandatory-validator principle)"
  - "citations_required accepts both mode='deterministic' (the documented default) and mode='emit' (the alias the Wave-0 test uses) for the check_coverage wrap"

patterns-established:
  - "library validator kinds register by side-effect import in harness/__init__.py exactly as phase_types does (the closed-registry posture); the registry doubles as 103's author menu (D-12)"
  - "structured finding encoded as a parseable error_message prefix (freshness:<which-check>|<payload>) so the Plan-04 ask_user disposition reads which check fired + the choices without a new attr/return type"

requirements-completed: []  # GATE-01 is MULTI-PLAN — marks complete at phase verification (the 099/WFSKILL-01 convention), NOT at this library-kinds plan

# Metrics
duration: ~8min
completed: 2026-06-12
---

# Phase 102 Plan 03: The 5 First-Class Validation-Gate Library Kinds Summary

**The reusable GATE-01 library lands: 5 first-class `@register_validator` kinds (`citations_required`/`output_file_valid`/`structure_check`/`llm_judge_rubric` wrap shipped primitives, `freshness` is net-new deterministic KB queries) register into the closed `VALIDATOR_REGISTRY` on import; `run_gates` gains an optional `timing` filter (D-10 back-compat half, default None byte-identical, validator_index stays the full-list index); the judge rides `forced_emit` and can never silently pass.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-12T07:03:18Z
- **Completed:** 2026-06-12T07:11:20Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- **`run_gates` timing filter (D-10 back-compat half):** added an optional keyword-only `timing: str | None = None` kwarg. `None` (default) runs EVERY spec — byte-identical to today, so every existing caller + unit test is unchanged. When set, specs whose `getattr(spec, "timing", "post") != timing` are SKIPPED while `idx` stays the enumerate index into the FULL `phase.validators` list (never a filtered sub-list), so `GateResult.validator_index` + the engine's `_failing_on_failure` (WR-03) keep pointing at the right spec. The engine half (the `timing=pre` pre-gate pass + `ask_user` disposition) is Plan 04.
- **`freshness.py` (net-new, D-09):** two pure read queries against the workflow's resolved `folder_scope` (PROJ-02 server-side ids), `$N` placeholders ONLY (`ANY($1::uuid[])` — T-102-03-05, no f-string SQL): `newest_document_age_days` (newest-doc age vs the per-workflow `max_age_days`; `documents.created_at` confirmed against `supabase/full-schema.sql`) + `exact_stem_collisions` (documents grouped by extension-stripped filename stem; groups of ≥2 distinct filenames sharing a stem — the `report-v2.docx`/`report-v3.docx` version-ambiguity finding). Deterministic v1 only (no semantic/fuzzy dedup — deferred per CONTEXT).
- **`validator_kinds.py` (the 5 first-class kinds, D-12):**
  - `citations_required` — deterministic/emit mode wraps `check_coverage` (uncited or invented leaf → fail, naming the offending leaves); presence mode counts citation markers (`< min_markers` → fail). Mirrors the `_exec_llm_emit` gate (GATE-01 "reject uncited register rows before any judge call").
  - `output_file_valid` — format-aware: docx/pptx/xlsx re-open via `assert_integrity` (try/except → corrupt/unopenable fails the gate, never crashes); PDF is a v1 stub (`GateResult(True, None)` — Phase 106 slots in); unknown extension fails CLOSED; a pre-computed `opened=False` or `residual_clean=False` fails.
  - `structure_check` — loose mode (named-section presence, order-insensitive, extras allowed, case-insensitive substring scan on the text output, RESEARCH Open Q2 v1 cut); strict mode delegates to `jsonschema.validate`.
  - `llm_judge_rubric` — rides `forced_emit`; a `failure`/None verdict → `GateResult(False, "...honest failure, not a silent pass")` (T-102-03-01); `overall_passed != True` → fail with the summary. `JudgeVerdict`/`JudgeCriterionVerdict` (flat, `extra="forbid"`) + `JUDGE_RUBRIC_CORE` (the 3 SEED-050 failure modes baked as fixed criteria; the `business_requirement` + author criteria woven as clearly-delimited DATA, never instructions — T-102-03-02) defined at module top.
  - `freshness` — `timing=pre`; no `max_age_days` → fails CLOSED (D-09 no global default); wraps the Task-1 queries via `ctx.pool` + `folder_scope`; staleness/version-ambiguity findings encoded as parseable `freshness:staleness|...` / `freshness:version_ambiguity|...` error-message prefixes (the Plan-04 `ask_user` contract).
- **Side-effect registration:** `harness/__init__.py` imports `validator_kinds` exactly as it imports `phase_types` — the 5 kinds register into `VALIDATOR_REGISTRY` at import time. All heavy/cross-module imports (`check_coverage`, `assert_integrity`, `forced_emit`, the freshness queries) are FUNCTION-LOCAL (Pitfall 4); no module-top docxtpl.

## Task Commits

Each task was committed atomically:

1. **Task 1: run_gates timing filter (D-10 back-compat) + freshness.py KB queries** - `8dc5c91e` (feat)
2. **Task 2: validator_kinds.py — the 5 first-class library kinds (D-12) + side-effect registration** - `795fe10c` (feat)

**Plan metadata:** (final docs commit) — SUMMARY + STATE + ROADMAP

_TDD note: per the project's Wave-0 un-mark-on-landing convention (098/099/101.1), the RED deliverable (the xfail-marked test stubs) shipped in Plan 01; this plan's GREEN un-marks fold into each task's feat commit. RED was re-confirmed live before implementing (the target tests xfailed at the wave base: `9 xfailed, 1 xpassed` — the lone xpass was the pre-existing `run_gates` signature-existence check, which the timing kwarg then satisfies properly)._

## Files Created/Modified
- `backend/app/services/harness/freshness.py` *(NEW)* — `newest_document_age_days` + `exact_stem_collisions` (deterministic KB freshness queries, scope-bound, `$N` only)
- `backend/app/services/harness/validator_kinds.py` *(NEW)* — the 5 first-class kinds + `JudgeVerdict`/`JudgeCriterionVerdict` + `JUDGE_RUBRIC_CORE`
- `backend/app/services/harness/validators.py` — `run_gates` gains the optional keyword-only `timing` kwarg (default None byte-identical)
- `backend/app/services/harness/__init__.py` — side-effect `from . import validator_kinds` + `__all__`/docstring update
- `backend/tests/unit/test_pre_post_timing.py` — un-marked both timing tests to GREEN (removed unused `pytest` import)
- `backend/tests/unit/test_validator_kinds.py` — un-marked all 5 kind tests to GREEN (removed unused `pytest` import)
- `backend/tests/unit/test_freshness.py` — un-marked all 3 freshness tests to GREEN (removed unused `pytest` import)

## Decisions Made
- **The judge keeps `forced_emit` UNMODIFIED (the plan's emitter-note choice, documented as required).** `forced_emit` hard-binds `EmitFieldMap` end-to-end (`_validate_args` parses the forced tool call as `EmitFieldMap`, line 292), so it cannot directly return a `JudgeVerdict`. The chosen seam: the `llm_judge_rubric` gate honors a pre-computed `_judge_verdict` on the output FIRST — this is exactly what the Wave-0 tests exercise AND how the **publish_service (Plan 05)** will feed a verdict to the gate (it runs the forced judge shot itself with the run/messages context). The validator's LIVE fallback path still calls `forced_emit` (judge model resolved from config → ctx → `Settings.harness_judge_model`, D-03, independent of the run model) and re-validates the result as a `JudgeVerdict` in the validator — never in `forced_emit`. A `failure`/None result is an honest fail. `forced_emit` is byte-untouched.
- **`citations_required` accepts `mode="emit"` as an alias for `mode="deterministic"`** (the Wave-0 test passes `mode="emit"`) — both route to the `check_coverage` wrap; only `mode="presence"` takes the marker-count branch.
- **Version-ambiguity is opt-in** (`config.check_versions`) — an exact-stem collision is a finding the author asks for, not a default wall (D-09).

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed their files, the back-compat `timing` default and the function-local-import discipline held, and all 10 Plan-03 tests un-marked to GREEN. The judge's `forced_emit`-unmodified path was a Claude's-discretion choice the plan explicitly delegated ("Choose the path that keeps forced_emit unmodified; document the choice in the SUMMARY") — recorded under Decisions, not a deviation.

## Authentication Gates
None — no auth-gated step in this plan (pure offline unit work; the live judge/freshness query paths are exercised by Plan 04/05 + phase verification, not here).

## SEED-056 Net-New-Failure Proof
- **Plan-03 target suite:** `test_validator_kinds.py` (5) + `test_freshness.py` (3) + `test_pre_post_timing.py` (2) = **10 passed / 0 failed**.
- **Adjacent harness slice** (`-k "validator or harness_audit_102 or reachability or bounded_retry"`): **7 passed**. The existing 4 validator kinds + `run_gates` callers stay byte-identical.
- **Wider slice** (`-k "harness or validator or emit or template or reachability or phase_dispatch"`): `3 failed / 109 passed`. The 3 failures (`test_075_4_final_output_files_payload.py::test_final_output_files_emit_carries_filename_url_size_keys`, `::test_final_output_files_emit_under_if_guard`, `test_phase56_iteration_start.py::...test_threads_py_emits_iteration_start_at_loop_top`) are **PRE-EXISTING ROT proven by base-checkout**: with ALL Plan-03 source reverted to the wave base `5e53b37e` (`validator_kinds.py` stashed, `freshness.py` deleted, `__init__.py` reverted, `validators.py` at base), the **same 3 fail IDENTICALLY**. They are production-source-assertion tests (they grep `threads.py`/`task_service.py` source) that import NONE of this plan's changed modules (grep-confirmed). All Plan-03 source was restored clean to HEAD after the proof. **Net-new failures introduced by this plan = 0.**

## Threat Surface
All changes fall inside the plan's `<threat_model>` (T-102-03-01..05):
- **T-102-03-01 (judge silent pass):** mitigated — `llm_judge_rubric` rides `forced_emit`; a `failure`/None verdict → `GateResult(False, ...)` (honest fail); `overall_passed` is a schema-bound bool (`JudgeVerdict.overall_passed`), never regex-on-prose.
- **T-102-03-02 (judge prompt injection):** mitigated — `JUDGE_RUBRIC_CORE` is a FIXED prompt; the `business_requirement` + graded output are woven as clearly-delimited DATA, never as instructions.
- **T-102-03-03 (validator raising into the run):** mitigated — every kind fails CLOSED with a descriptive `error_message`; `output_file_valid` catches `assert_integrity`'s raise → fail; no kind raises into `run_gates`.
- **T-102-03-04 (output_file_valid SSTI):** accepted as designed — the kind only RE-OPENS the produced file (read-only oracle via `assert_integrity`); it never renders.
- **T-102-03-05 (freshness cross-scope disclosure):** mitigated — both freshness queries bind ONLY the caller-supplied resolved `folder_scope` via `ANY($1::uuid[])`; `$N` placeholders only, no f-string SQL (grep-confirmed 0).

No new network endpoint, auth path, or trust-boundary surface introduced — the validator kinds are pure functions over the phase output + ctx; the freshness queries are read-only over the existing `documents` table within the resolved scope. **No threat flags.**

## Known Stubs
- **`output_file_valid` PDF branch is a v1 stub** (`GateResult(True, None)` for `.pdf`) — INTENTIONAL and documented per CONTEXT D-09 / RESEARCH §Environment Availability: PDF re-open validation lands with the Phase 106 free-form PDF emitters. The kind is format-aware so 106 slots a real PDF re-open into the existing `ext == "pdf"` branch without rework. This is not a goal-blocking stub — no PDF emitter exists yet in v1 (D-09 defers free-form PDF deliverables to 106), so there is nothing for it to validate; the OOXML formats (the only deliverables 102 produces) get the real `assert_integrity` re-open.
- **The `llm_judge_rubric` live `forced_emit` fallback path is not exercised by an offline unit test** (the Wave-0 tests use the `_judge_verdict` probe seam) — its real acceptance is the **live golden run at publish time (Plan 05, D-05 no-mock)** + phase verification. This is the documented "the live UAT is the gate, not the mocked unit test" posture (RESEARCH Pitfall 4); the gate's honest-fail contract on a `failure`/None result IS unit-covered via the probe.

No source stubs that flow empty data to a UI (these are backend validator functions; no UI surface).

## Next Phase Readiness
- **Plan 04 (engine seams) unblocked:** `run_gates` now accepts `timing="pre"`/`"post"` (the pre-gate pass wires here); the 5 kinds register so the `ValidatorSpec.kind` Literal (Plan 01) has real implementations; `freshness`'s structured finding is encoded as the parseable `freshness:<check>|<payload>` error-message prefix the `ask_user` disposition parses; the `_freshness_probe` seam lets the engine feed a resolved finding to the gate.
- **Plan 05 (publish service) unblocked:** `JudgeVerdict` + `JUDGE_RUBRIC_CORE` are importable from `validator_kinds`; the publish_service runs the forced judge shot itself and feeds the verdict to `llm_judge_rubric` via the `_judge_verdict` seam (or evaluates it directly with `_evaluate_judge_verdict`), keeping `forced_emit` unmodified.

## Self-Check: PASSED

- `backend/app/services/harness/freshness.py` — FOUND.
- `backend/app/services/harness/validator_kinds.py` — FOUND.
- Commit `8dc5c91e` (Task 1) — FOUND in git history.
- Commit `795fe10c` (Task 2) — FOUND in git history.
- All 5 kinds register on `import app.services.harness` (verified: `['citations_required','freshness','json_schema','llm_judge_rubric','output_file_valid','programmatic','regex_match','structure_check','workspace_file_exists']`).
- All 10 Plan-03 tests GREEN; net-new failures = 0 (base-checkout proven).

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-12*
