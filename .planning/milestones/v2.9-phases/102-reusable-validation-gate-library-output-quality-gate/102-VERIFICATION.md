---
phase: 102-reusable-validation-gate-library-output-quality-gate
verified: 2026-06-12T10:30:00Z
status: gaps_found
score: 1/3 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A reusable library of validator kinds — citations_required, freshness, structure_check, output_file_valid, llm_judge_rubric — is available to any phase and rides the existing gate + bounded-retry loop."
    status: partial
    reason: "All 5 kinds register correctly and citations_required, output_file_valid, structure_check are fully functional. llm_judge_rubric is structurally registered but its live forced_emit path can never return a valid JudgeVerdict (CR-01 from 102-REVIEW.md, code-confirmed): forced_emit validates all tool-call arguments against EmitFieldMap (which requires scalars+rows), so a JudgeVerdict payload always fails validation and emitted is always None. The gate fails closed (honest), but the kind is non-functional on the live path — it can never pass a judge verdict. Unit tests pass only because they use the _judge_verdict probe seam. freshness is structurally registered but its live path always fails 'no KB scope context' (WR-01, code-confirmed): the validator looks for ctx.scope_folder_ids or ctx.folder_scope, but all ctx construction sites (harness_engine._build_resume_context, publish_service._drive_golden_run) set folder_subtree_ids — a different attribute name. The probe seam works; the live path is non-functional."
    artifacts:
      - path: "backend/app/services/harness/validator_kinds.py"
        issue: "llm_judge_rubric live path: forced_emit(emitter='judge_verdict', tools=judge_tool) validates the model response as EmitFieldMap (scalars+rows required, extra=forbid). A JudgeVerdict payload always fails EmitFieldMap.model_validate → emitted=None → gate fails closed. Confirmed by code inspection + programmatic EmitFieldMap.model_validate(judge_payload) raising ValidationError."
      - path: "backend/app/services/harness/validator_kinds.py"
        issue: "freshness live path reads getattr(ctx, 'scope_folder_ids') or getattr(ctx, 'folder_scope') — both are None on all real ctx bags which use 'folder_subtree_ids'. The gate always returns GateResult(False, 'freshness: no KB scope context...'). Only the _freshness_probe seam works. Confirmed by code inspection + harness_engine/publish_service ctx construction."
    missing:
      - "forced_emit needs an additive schema_model parameter (see 102-REVIEW.md CR-01 fix spec) so the judge shot can validate against JudgeVerdict instead of EmitFieldMap — OR the caller re-validates the raw tool-call arguments dict before forced_emit's validation loop runs"
      - "freshness live path must read getattr(ctx, 'folder_subtree_ids', None) as a third fallback in the folder_ids resolution (see 102-REVIEW.md WR-01 fix spec)"

  - truth: "The freshness validator guarantees a 'check the date first' preflight that branches to ask_user on stale/multiple versions; citations_required deterministically rejects uncited register rows before any judge call."
    status: failed
    reason: "citations_required deterministic enforcement is correctly wired — it wraps check_coverage and rejects uncited/invented leaves deterministically. However the freshness guarantee is NOT met on the live path: the freshness validator's live ctx-pool query path always fails with 'no KB scope context' because the ctx attribute name mismatch (WR-01). A workflow attaching freshness with on_failure=ask_user will not get a staleness check; it will always fail with the misleading 'no KB scope context' message regardless of KB age or version state. The probe seam (unit tests) passes, but the stated live guarantee ('guaranteed preflight') is not delivered."
    artifacts:
      - path: "backend/app/services/harness/validator_kinds.py"
        issue: "freshness._validate_freshness live path: getattr(ctx, 'scope_folder_ids', None) or getattr(ctx, 'folder_scope', None) — always evaluates to None on real ctx bags which use folder_subtree_ids. The 'guaranteed preflight' stated in the success criterion is not live."
    missing:
      - "Add getattr(ctx, 'folder_subtree_ids', None) as the third getattr call in the folder_ids resolution chain in _validate_freshness"

  - truth: "A workflow declares exactly one business_requirement; an llm_judge output-quality gate plus a publish-time golden run are a HARD publish blocker — a structurally lint-clean workflow that produces bad output cannot publish."
    status: failed
    reason: "The 4-stage publish pipeline (business_requirement -> lint -> golden run -> judge -> flip) is correctly orchestrated. The business_requirement check, lint gate, and publish flip are all functional. The golden run is driven as a real run. BUT the judge verdict step is non-functional due to CR-01: _judge_golden_output calls forced_emit with the JudgeVerdict schema as the tool, but forced_emit validates the tool-call response against EmitFieldMap. A well-formed JudgeVerdict response from the model will always fail EmitFieldMap.model_validate → emitted=None → publish_service returns {failure: 'the judge produced no verdict'} → verdict.get('failure') is truthy → the publish is blocked at blocked_stage='judge'. This means: (1) a GOOD workflow whose judge would genuinely pass ALSO cannot publish, (2) the phase goal ('a workflow cannot publish unless it provably produces good output') is not met — the gate is not a quality gate, it is a structural barrier that blocks every publish attempt. Unit tests pass because they mock _judge_golden_output or _drive_golden_run at the boundary. The live acceptance (VALIDATION.md SC#10 scoreboard) would catch this."
    artifacts:
      - path: "backend/app/services/harness/publish_service.py"
        issue: "_judge_golden_output at lines 536-563: calls forced_emit(emitter='judge_verdict', tools=judge_tool). forced_emit validates the result against EmitFieldMap (not JudgeVerdict). JudgeVerdict payload always fails → result['emitted'] is always None → function returns {failure: 'the judge produced no verdict'}. The JudgeVerdict.model_validate(raw) re-parse at line 561 is dead code (never reached because the emitted branch is unreachable). Confirmed by code inspection and EmitFieldMap.model_validate(judge_payload) raising ValidationError programmatically."
      - path: "backend/app/services/harness/validator_kinds.py"
        issue: "llm_judge_rubric._validate_llm_judge_rubric live path has the same CR-01 flaw as publish_service (same forced_emit call, same EmitFieldMap validation mismatch). An in-run llm_judge_rubric gate also always fails closed."
    missing:
      - "Fix CR-01 per 102-REVIEW.md: add schema_model: type[BaseModel] | None = None to forced_emit signature (additive, default preserves EmitFieldMap for all existing callers). Judge callers pass schema_model=JudgeVerdict. Alternatively, let callers re-validate the raw tool-call arguments dict before forced_emit's validation loop."
      - "Add one un-mocked integration test that drives forced_emit's validation loop with a JudgeVerdict-shaped tool call and asserts emitted is not None"
      - "CR-02 (citation_policy flag/partial delivery): the re-render path (phase_types._exec_llm_emit non-strict branch) passes the policy-modified legacy_map to _handle_render_template, which re-runs check_coverage and rejects maps with uncited_value_count > 0. Flag/partial maps by definition still carry uncited values → render always returns rejected. The flag/partial delivery paths are non-functional. This is a secondary gap (QUAL-01 does not require these paths to be live, but GATE-01 does since citation_policy is a GATE-01 engine seam). Noted here; its criticality is lower than CR-01 since the primary QUAL-01 blocker is the judge verdict."
---

# Phase 102: Reusable Validation-Gate Library + Output-Quality Gate — Verification Report

**Phase Goal:** Any phase can attach a reusable validator, and a workflow cannot publish unless it provably produces good output for its one declared business requirement.
**Verified:** 2026-06-12T10:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Reusable library of 5 validator kinds available to any phase, riding gate + bounded-retry loop | PARTIAL | All 5 kinds register on import. citations_required, structure_check, output_file_valid fully functional. llm_judge_rubric and freshness registered but live paths non-functional (CR-01 + WR-01 — code-confirmed). |
| 2 | freshness guarantees "check the date first" preflight branching to ask_user on stale/multiple versions; citations_required deterministically rejects uncited rows before judge | FAILED | citations_required: functional (wraps check_coverage deterministically). freshness live path: always fails "no KB scope context" — ctx.scope_folder_ids and ctx.folder_scope are always None on real ctx bags (which use folder_subtree_ids). The guarantee is not delivered on the live path. |
| 3 | Workflow declares exactly one business_requirement; llm_judge gate + golden run = HARD publish blocker; bad output cannot publish | FAILED | Pipeline structure is correct (business_requirement -> lint -> golden run -> judge -> flip). The judge step is non-functional (CR-01): forced_emit validates all tool responses as EmitFieldMap; a JudgeVerdict payload always fails EmitFieldMap.model_validate → emitted=None → every publish is blocked at "judge" stage even for good output. The gate is a structural barrier, not a quality gate. |

**Score: 1/3 truths verified** (SC-1 partial — 3/5 kinds live; SC-2 and SC-3 failed due to two structural wiring gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/harness/validator_kinds.py` | 5 first-class @register_validator kinds | PARTIAL | Exists, 468 lines, substantive. All 5 kinds registered. llm_judge_rubric + freshness live paths non-functional (CR-01 + WR-01). |
| `backend/app/services/harness/freshness.py` | Net-new deterministic KB freshness queries | VERIFIED | Exists, 113 lines, contains max_age_days, newest_document_age_days, exact_stem_collisions. Queries are correctly $N-parameterized. |
| `backend/app/services/harness/validators.py` | run_gates timing filter (D-10) | VERIFIED | timing kwarg present in run_gates signature, default None (byte-identical). validator_index stays full-list index. |
| `backend/app/services/harness/__init__.py` | side-effect import of validator_kinds | VERIFIED | Imports validator_kinds; all 9 kinds present in VALIDATOR_REGISTRY on import. |
| `backend/app/services/harness/emit_policy.py` | apply_citation_policy (flag/partial/draft transforms) | PARTIAL | Exists, 162 lines, transforms are correctly authored. BUT CR-02: the render handler (tool_dispatcher._handle_render_template) re-runs check_coverage and rejects any map with uncited values, so flag/partial modes can never deliver through the actual render path. |
| `backend/app/services/harness_engine.py` | timing:pre pre-gate pass + ask_user 4th disposition | VERIFIED | _parse_on_failure recognizes ask_user. _run_phase_with_gates pre-gate pass added. _resolve_failure_with_ask_user async helper wires 085 pause. |
| `backend/app/services/harness/phase_types.py` | citation_policy post-verdict disposition in _exec_llm_emit | PARTIAL | citation_policy read, strict branch byte-identical. Non-strict applies emit_policy correctly BUT the subsequent render always rejects (CR-02). |
| `backend/app/services/harness/publish_service.py` | 4-stage publish orchestration | PARTIAL | Exists, 584 lines, 4-stage structure correct. Judge step non-functional (CR-01). |
| `backend/app/api/workflows.py` | POST /workflows/{id}/publish endpoint | VERIFIED | Route present, delegates to publish_service.publish, HTTP status mapping correct. |
| `backend/app/db/workflows.py` | get_definition + create_workflow_run is_golden_run kwarg + publish_definition | VERIFIED | All three present. $N placeholders only. |
| `supabase/migrations/070_harness_validation_gate_library.sql` | harness_audit CHECK ALTER + is_golden_run column | VERIFIED | Authored and applied. Live :54322 confirms all 22 kinds in CHECK + is_golden_run column. |
| `backend/app/models/harness.py` | ValidatorSpec 9 kinds + timing; LlmEmitPhaseConfig citation_policy/integrity_policy; WorkflowDefinition business_requirement | VERIFIED | All fields present, correct defaults. Python one-liner confirms OK. |
| `backend/app/config.py` | harness_judge_model setting | VERIFIED | Present, default None. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| validator_kinds.llm_judge_rubric | forced_emit.forced_emit | function-local import + call | BROKEN (CR-01) | forced_emit validates response against EmitFieldMap, not JudgeVerdict. A JudgeVerdict payload always fails EmitFieldMap.model_validate → emitted=None. Confirmed: EmitFieldMap.model_validate(judge_payload) raises ValidationError programmatically. |
| publish_service._judge_golden_output | forced_emit.forced_emit | same as above | BROKEN (CR-01) | Same EmitFieldMap/JudgeVerdict mismatch. The JudgeVerdict.model_validate re-parse at line 561 is dead code. |
| validator_kinds.freshness (live path) | ctx.pool + folder_ids | getattr(ctx, 'scope_folder_ids') or getattr(ctx, 'folder_scope') | BROKEN (WR-01) | Both attributes are None on all real ctx bags, which use folder_subtree_ids. The live path always fails with "no KB scope context". |
| validator_kinds.citations_required | template_render_service.check_coverage | function-local import + wrap | WIRED | Correctly wraps check_coverage for deterministic mode. Presence mode also correct. |
| validator_kinds.output_file_valid | template_render_service.assert_integrity | function-local import + wrap | WIRED | Correctly wraps assert_integrity for OOXML formats. PDF v1 stub intentional. |
| emit_policy.apply_citation_policy -> render path | tool_dispatcher._handle_render_template | phase_types._exec_llm_emit non-strict break -> entry.post_processor | BROKEN (CR-02) | _handle_render_template re-runs check_coverage and rejects maps with uncited_value_count > 0. Flag/partial maps by definition have uncited values → render always returns rejected status. |
| publish_service.publish | db.create_workflow_run is_golden_run | kwarg is_golden_run=True | WIRED | create_workflow_run gains is_golden_run kwarg; INSERT carries it. Migration 070 column present. |
| api.workflows POST /publish | publish_service.publish | module import + await | WIRED | Route delegates to publish_service.publish correctly. |
| _AUDIT_EVENT_TYPES | migration 070 CHECK | lockstep frozenset | WIRED | len == 22, all 6 new kinds present in both code and live CHECK. Confirmed by psycopg2 read-back. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| publish_service._judge_golden_output | verdict (JudgeVerdict) | forced_emit(..., emitter='judge_verdict') | No — forced_emit returns emitted=None because JudgeVerdict fails EmitFieldMap.model_validate | HOLLOW — wired call exists but data never flows through to a valid verdict |
| validator_kinds._validate_freshness (live path) | folder_ids | getattr(ctx, 'scope_folder_ids') or getattr(ctx, 'folder_scope') | No — both attributes are None on all real ctxs | DISCONNECTED — ctx attr name mismatch |
| emit_policy flag/partial re-render | modified legacy_map | apply_citation_policy output | Partially — map is correctly modified, but render handler re-rejects it | HOLLOW_PROP — modified map passed to render but render rejects it unconditionally |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 validator kinds registered on import | `python -c "import app.services.harness; from app.services.harness.validators import VALIDATOR_REGISTRY; assert {'citations_required','freshness','llm_judge_rubric','output_file_valid','structure_check'} <= set(VALIDATOR_REGISTRY)"` | Pass | PASS |
| _AUDIT_EVENT_TYPES == 22 in lockstep | `python -c "from app.db.workflows import _AUDIT_EVENT_TYPES; assert len(_AUDIT_EVENT_TYPES)==22"` | Pass | PASS |
| Schema additive-optional OK | `python -c "from app.models.harness import ValidatorSpec, LlmEmitPhaseConfig, WorkflowDefinition; ...print('OK')"` | OK | PASS |
| Migration 070 live on :54322 | psycopg2 read-back: CHECK kinds + is_golden_run column | OK migration 070 live | PASS |
| Phase 102 unit suite | pytest tests/unit/test_validator_kinds.py ... -q | 35 passed | PASS |
| EmitFieldMap rejects JudgeVerdict payload | `EmitFieldMap.model_validate(judge_payload)` | ValidationError raised | FAIL (confirms CR-01 — this is the bug, not a test) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GATE-01 | Plans 01, 03, 04 | Reusable validator library: citations_required, freshness, structure_check, output_file_valid, llm_judge_rubric — rides existing gate + bounded-retry loop | PARTIAL | 3/5 kinds fully functional (citations_required, structure_check, output_file_valid). llm_judge_rubric registered but live path non-functional (CR-01). freshness registered but live path non-functional (WR-01). timing:pre seam, ask_user disposition, and citation_policy strict path all functional. |
| QUAL-01 | Plans 01, 02, 05 | Workflow declares one business_requirement; llm_judge gate + golden run = HARD publish blocker | BLOCKED | Publish pipeline structure correct. Business_requirement check and lint gate functional. Judge verdict step non-functional due to CR-01 — every publish attempt blocks at "judge" stage regardless of output quality. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/app/services/harness/validator_kinds.py | 337-354 | llm_judge_rubric live path calls forced_emit; the returned emitted is always None because forced_emit validates against EmitFieldMap, not JudgeVerdict. The _evaluate_judge_verdict call at line 354 processes an emitted=None path. | BLOCKER | CR-01: the llm_judge_rubric kind can never pass a judge verdict on the live path; the QUAL-01 publish gate is a structural barrier, not a quality gate |
| backend/app/services/harness/publish_service.py | 536-563 | _judge_golden_output: forced_emit call with JudgeVerdict tool schema, but forced_emit validates as EmitFieldMap. The JudgeVerdict.model_validate(raw) re-parse at line 561 is dead code (the emitted branch is unreachable). | BLOCKER | CR-01: publish_service judge step always returns {failure: 'the judge produced no verdict'}; no workflow can ever publish successfully |
| backend/app/services/harness/validator_kinds.py | 411-414 | freshness live path: getattr(ctx, 'scope_folder_ids') or getattr(ctx, 'folder_scope') — both always None on real ctx bags (which use folder_subtree_ids) | BLOCKER | WR-01: freshness kind is non-functional on the live path; always returns 'no KB scope context' error |
| backend/app/services/harness/phase_types.py | 1299-1321 | Non-strict citation_policy (flag/partial) mutates legacy_map and falls through to render, but _handle_render_template re-runs check_coverage and rejects maps with uncited values unconditionally | BLOCKER | CR-02: flag and partial citation_policy modes can never deliver; the render is always rejected |
| backend/app/services/harness/emit_policy.py | 55-57 | _uncited_field_names reads only uncited_leaves, ignoring invented_leaves | WARNING | WR-06 (from 102-REVIEW.md): partial mode does not blank invented-citation cells; they pass through marked neither as [unverified] nor blanked |
| backend/app/db/workflows.py | 199-251 | get_definition uses created_by=$2 OR is_global=true — exposes another user's global draft to non-owners | WARNING | WR-02: a non-owner can trigger a golden run + publish flip on a global draft |
| backend/app/services/harness/publish_service.py | 235-248 | publish_definition returns -1 on concurrent double-publish but publish_workflow never checks the sentinel — returns {published: True, version: -1} | WARNING | WR-03: false governance record on concurrent publish race |

### Human Verification Required

All SC#10 4-axis live UAT rows from VALIDATION.md are blocked until CR-01 is fixed — the judge call cannot produce a verdict on the live path.

1. **QUAL-01 publish end-to-end (BLOCKED by CR-01)**

   **Test:** Author a lint-clean workflow with a good golden_input; call POST /workflows/{id}/publish and observe whether it succeeds.
   **Expected (after fix):** Good output publishes (verdict overall_passed=True); bad output is blocked at blocked_stage="judge" with per-criterion critique.
   **Current behaviour (before fix):** Every publish blocks at blocked_stage="judge" with "the judge produced no verdict" regardless of output quality — CR-01.
   **Why human:** Requires provider call + live KB + real workflow definition.

2. **freshness pre-gate live check (BLOCKED by WR-01)**

   **Test:** Attach a freshness validator (timing=pre, on_failure=ask_user, max_age_days=1) to a workflow with a stale folder; run the workflow and observe whether the user receives a staleness prompt.
   **Expected (after fix):** Run pauses with staleness choice prompt; Proceed continues with validator_ask_user_approved receipt.
   **Current behaviour (before fix):** Run immediately fails "no KB scope context" because ctx.folder_subtree_ids is not read by the validator.
   **Why human:** Requires live ctx from harness engine + real folder + Redis for ask_user pause.

3. **Cross-provider judge verdict (4-axis SC#10) — BLOCKED pending CR-01 fix**

   **Test:** POST /publish with harness_judge_model set to OpenAI / Anthropic / Google / OpenRouter representative models in turn.
   **Expected:** Each produces a structured JudgeVerdict (overall_passed present) or honest forced-emit failure.
   **Why human:** Requires live provider calls; cannot test without running backend.

4. **flag/partial citation_policy delivery marks (BLOCKED by CR-02)**

   **Test:** Run an llm_emit phase under flag and partial citation_policy; open the delivered file and confirm [unverified] marks / blanked cells are visible.
   **Expected:** Delivered file shows marks/blanks with coverage summary.
   **Current behaviour:** Render handler rejects the policy-modified map at the citation re-check; deliverable is never produced.
   **Why human:** Requires end-to-end workflow run with a real template.

### Gaps Summary

Phase 102 delivered substantial correct infrastructure: the model/schema substrate (Plan 01), the migration (Plan 02), the 3/5 functional validator kinds, the timing:pre/ask_user/citation_policy engine seams (Plan 04), and the publish pipeline skeleton (Plan 05) are all correct and wired. The 35 unit tests pass.

However, two critical cross-module wiring gaps (identified in 102-REVIEW.md before this verification, confirmed here by code inspection and programmatic validation) prevent the phase GOAL from being achieved:

**CR-01 (primary blocker — blocks both GATE-01 and QUAL-01):** The `forced_emit` function validates all tool-call responses against `EmitFieldMap` (requires `scalars: list[FlatScalar]` + `rows: list[FlatRow]`, `extra="forbid"`). Both the `llm_judge_rubric` validator kind and `publish_service._judge_golden_output` call `forced_emit` with a `JudgeVerdict`-shaped tool schema. A `JudgeVerdict` payload (`overall_passed`, `criteria`, `summary`, etc.) always fails `EmitFieldMap.model_validate` → `emitted=None` → the judge path always returns a failure. Consequence: no workflow can ever publish (every `POST /publish` blocks at `blocked_stage="judge"` with "the judge produced no verdict"), and the `llm_judge_rubric` in-run validator can never pass. This was confirmed programmatically: `EmitFieldMap.model_validate(judge_payload)` raises `ValidationError`. The unit tests are mock-masked (they mock `_judge_golden_output` or `_drive_golden_run` at the boundary).

**WR-01 (secondary blocker — blocks GATE-01 freshness):** The `freshness` validator's live path resolves `folder_ids` via `getattr(ctx, 'scope_folder_ids')` or `getattr(ctx, 'folder_scope')`. No ctx construction site in the codebase sets either attribute — all real ctx bags use `folder_subtree_ids`. The validator always fails with "no KB scope context" on the live path. The probe seam (`_freshness_probe`) works, which is why unit tests pass.

**CR-02 (tertiary — blocks GATE-01 citation_policy flag/partial):** The non-strict `citation_policy` re-render path applies `apply_citation_policy` correctly but then falls through to `_handle_render_template`, which re-runs `check_coverage` and unconditionally rejects maps with `uncited_value_count > 0`. Flag/partial maps by definition carry uncited values → render always returns rejected. This gap is lower severity than CR-01 since the primary QUAL-01 function doesn't require citation_policy, but it means the GATE-01 citation_policy non-strict modes are non-functional.

These are the same mock-mask class of defect the project encountered in Phase 101 (WR-01: render_template not visible to harness → model never called it) and was explicitly warned about in the verification instructions.

---

_Verified: 2026-06-12T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
