---
phase: 102-reusable-validation-gate-library-output-quality-gate
reviewed: 2026-06-12T08:00:27Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/config.py
  - backend/app/db/workflows.py
  - backend/app/models/harness.py
  - backend/app/services/harness/__init__.py
  - backend/app/services/harness/emit_policy.py
  - backend/app/services/harness/freshness.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/validator_kinds.py
  - backend/app/services/harness/validators.py
  - backend/app/services/harness_engine.py
  - backend/tests/unit/test_ask_user_disposition.py
  - backend/tests/unit/test_citation_policy.py
  - backend/tests/unit/test_freshness.py
  - backend/tests/unit/test_harness_audit_102.py
  - backend/tests/unit/test_harness_audit_emit.py
  - backend/tests/unit/test_pre_post_timing.py
  - backend/tests/unit/test_publish_flip.py
  - backend/tests/unit/test_publish_service.py
  - backend/tests/unit/test_validator_kinds.py
  - supabase/full-schema.sql
  - supabase/migrations/070_harness_validation_gate_library.sql
findings:
  critical: 2
  warning: 8
  info: 4
  total: 14
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-06-12T08:00:27Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 102 (GATE-01 validator library + QUAL-01 publish gate) was reviewed across the Pydantic shape layer (Plan 01), the 5 library validator kinds + net-new freshness queries (Plan 03), the engine pre/post timing + ask_user disposition (Plan 04), and the 4-stage publish path (Plan 05), plus migration 070 and the test set.

**Red-line verification (all PASS):**
- Deep-mode shared paths untouched — `threads.py` / `agent_loop.py` are not in the diff; the engine changes are harness-only branches.
- Default-config byte-identity holds: `ValidatorSpec.timing` defaults `"post"`, `run_gates(timing=None)` runs all specs with the full-list `validator_index`, `citation_policy` defaults `"strict"` and the strict path never routes through `emit_policy` (it raises if it does), `create_workflow_run(is_golden_run=False)` keyword-only.
- All SQL is `$N`-parameterized (`ANY($1::uuid[])` in freshness; the one f-string in `list_published_workflows` builds only the code-derived placeholder index — pre-existing 098 pattern).
- D-v2.5-01 honored: the publish path's `threads` insert rides `run_in_threadpool`; `load_user_settings` is the cached in-memory read.
- Migration 070 ↔ `_AUDIT_EVENT_TYPES` lockstep verified: 22 kinds in both the code frozenset and the live-dump `full-schema.sql` CHECK; `harness_audit.run_id` is nullable (so the NULL-run `publish_blocked` receipts work); `is_golden_run` is additive `DEFAULT false`.
- Fail-closed posture: unknown `on_failure` → `fail_run`; judge `failure`/None verdict → gate fails; unknown validator kind → gate fails.

**However, cross-module tracing found that two headline features of this phase are structurally non-functional on the live path while their mocked unit tests pass — the exact 099/101 mock-mask failure class this project has been burned by repeatedly.** CR-01 means no workflow can ever pass the publish judge (QUAL-01 becomes a wall, not a gate); CR-02 means `citation_policy: flag` and `draft` can never deliver (and the user is told they did). Both fail *closed*, so there is no security exposure — but the phase's core requirements do not work end-to-end. The VALIDATION.md live UAT would catch both; this review catches them first.

## Critical Issues

### CR-01: The live LLM-judge path can never produce a verdict — every publish blocks at the judge stage

**File:** `backend/app/services/harness/publish_service.py:536-563`, `backend/app/services/harness/validator_kinds.py:337-354` (consumer contract with `backend/app/services/forced_emit.py:288-314`)
**Issue:** Both the publish stage-4 judge (`_judge_golden_output`) and the `llm_judge_rubric` validator's live path run the judge shot via `forced_emit(..., emitter="judge_verdict", tools=judge_tool)` where `judge_tool` carries `JudgeVerdict.model_json_schema()`. But `forced_emit` validates the returned tool-call arguments **exclusively as `EmitFieldMap`** (`_validate_args` → `EmitFieldMap.model_validate`, and the narration-recovery path likewise). `EmitFieldMap` requires `scalars: list[FlatScalar]` + `rows: list[FlatRow]` with `extra="forbid"` — a `JudgeVerdict` payload (`overall_passed`, `criteria`, `summary`, ...) can **never** validate. The better the model follows the judge schema, the more certainly validation fails → `forced_emit` returns `failure="model_failed_to_emit"` → the gate/publish honestly fails. Deterministic 100% failure: `test_good_output_publishes` can never happen live (it mocks `_judge_golden_output`), and the `JudgeVerdict.model_validate(raw)` re-parse at publish_service.py:561 is dead code (the `emitted` branch is unreachable for a judge payload). The comment at validator_kinds.py:322-326 acknowledges forced_emit parses against EmitFieldMap but draws the wrong conclusion.
**Fix:** Give `forced_emit` an optional, additive schema seam so the emit path stays byte-identical:
```python
# forced_emit signature (additive, default preserves current behavior):
async def forced_emit(*, ..., schema_model: type[BaseModel] | None = None) -> dict:
    ...
    _model = schema_model or EmitFieldMap
    # in the validate loop and in recover_narrated_emission, validate against _model

# callers (validator_kinds._validate_llm_judge_rubric live path + publish_service._judge_golden_output):
result = await forced_emit(..., emitter="judge_verdict", tools=judge_tool,
                           schema_model=JudgeVerdict)
```
Alternatively return the raw `arguments` dict alongside `emitted` and let the judge callers validate `JudgeVerdict` themselves. Either way, add one un-mocked integration test that drives `forced_emit`'s validation loop with a JudgeVerdict-shaped tool call and asserts `emitted is not None`.

### CR-02: `citation_policy` "flag" and "draft" can never deliver — the render handler's own citation gate rejects the policy-modified map, after the user was already told it was delivered

**File:** `backend/app/services/harness/phase_types.py:1294-1321`, `backend/app/services/harness/emit_policy.py:55-57,113-160` (contract with `backend/app/services/tool_dispatcher.py:1605-1616`)
**Issue:** The non-strict disposition mutates `legacy_map` (flag: appends `[unverified]`, value stays uncited; draft: leaves values untouched) and falls through to the render dispatch. But the render dispatch is `_render_template_post` → `_handle_render_template`, which **re-runs `check_coverage` and hard-rejects any map with `uncited_value_count > 0` or `invented_citation_count > 0`** (`status: "rejected", reason: "uncited_or_invented"`). A flag/draft map by definition still carries uncited values → the render is always rejected → the executor maps the non-ok status to state (c) `render_failed`. Consequences: (1) `flag` and `draft` can never produce a deliverable; (2) the sequencing is actively dishonest — `_surface_failure_message(ctx, run_id, policy_summary, pool)` at phase_types.py:1318 persists "delivered WITH [unverified] marks" / "DRAFT deliverable" **before** the render, then a second message says the deliverable was NOT produced — contradicting the T-102-04-03 never-mislead red line; (3) `partial` also fails whenever invented citations exist, because `_uncited_field_names` reads only `gate["uncited_leaves"]` and ignores `invented_leaves` — invented-citation cells are neither blanked nor marked, so the handler gate rejects on `invented_citation_count`. The unit tests (`test_citation_policy.py`) exercise only the pure `apply_citation_policy` transform, never the render round-trip — mock-masked.
**Fix:** Thread the applied policy through the render args so the handler's gate becomes policy-aware (the policy decision was already made, receipted via `policy_applied`, and surfaced):
```python
# phase_types._exec_llm_emit (non-strict branch):
resolved["citation_policy_applied"] = citation_policy  # flag | partial | draft

# emitters._render_template_post: args["citation_policy_applied"] = resolved.get("citation_policy_applied")

# tool_dispatcher._handle_render_template gate:
if (stats["uncited_value_count"] > 0 or stats["invented_citation_count"] > 0) \
        and not args.get("citation_policy_applied"):
    return ToolResult(...rejected...)
```
Also fix `emit_policy._uncited_field_names` to include invented leaves:
```python
def _uncited_field_names(gate: dict) -> set[str]:
    leaves = (gate.get("uncited_leaves") or []) + (gate.get("invented_leaves") or [])
    return {_leaf_field_name(x) for x in leaves}
```
And move the policy-summary surfacing to AFTER a successful render (or fold it solely into the success `text`) so the user is never told a failed delivery succeeded. Add one test that drives the non-strict path through `_render_template_post` (with the handler's gate un-mocked) and asserts delivery.

## Warnings

### WR-01: The `freshness` validator's live path reads ctx attributes that no ctx in the codebase carries — the kind always fails closed outside the probe seam

**File:** `backend/app/services/harness/validator_kinds.py:410-420`
**Issue:** The live path resolves the scope via `getattr(ctx, "scope_folder_ids", None) or getattr(ctx, "folder_scope", None)`. A repo-wide search shows **no** ctx construction site sets either attribute — the live kickoff, `_build_resume_context`, and `_drive_golden_run` all set `folder_subtree_ids`; `folder_scope` exists only as a *phase config* field, never on ctx. Every live `timing="pre"` freshness gate therefore fails with "no KB scope context" (fail-closed, but the kind is non-functional; with `on_failure=ask_user` the user is prompted with a misleading "no KB scope context" finding on every run). Only the `_freshness_probe` test seam works — the unit tests use exactly that seam.
**Fix:** Read the names the engine actually provides, preferring the phase's declared narrow scope when the engine threads it:
```python
folder_ids = (
    getattr(ctx, "scope_folder_ids", None)
    or getattr(ctx, "folder_scope", None)
    or getattr(ctx, "folder_subtree_ids", None)   # the real ctx field (092/098/102 ctx bags)
)
```
and/or have `_run_phase_with_gates` stamp `ctx.folder_scope` from `phase.config.folder_scope` (narrow-only ∩ subtree) before the pre-gate pass. Add a live-shape test using a ctx with only `folder_subtree_ids`.

### WR-02: Any user can publish a GLOBAL draft — `get_definition` owner predicate is wider than documented and `publish_definition` has no owner re-check

**File:** `backend/app/db/workflows.py:199-251`, `backend/app/services/harness/publish_service.py:82-104`
**Issue:** `get_definition` uses `WHERE id = $1 AND (created_by = $2 OR is_global = true)`. Unlike `list_published_workflows`, there is no `status='published'` filter, so the `is_global` arm exposes another user's **draft** when `is_global=true` — and the publish path then drives a golden run and flips it (`publish_definition` filters only `id + status='draft'`). The docstring claims "A non-owner gets None (NOT another user's draft)" — untrue for global drafts. Global drafts may not exist today, but nothing prevents one, and the flip is a privileged state change performed by a non-owner.
**Fix:** Restrict the publish read to true ownership:
```sql
WHERE id = $1 AND created_by = $2
```
(or `AND (created_by = $2 OR (is_global = true AND status = 'published'))` if global rows must stay readable here). If global drafts must be publishable, require an explicit admin path, not the user-facing endpoint.

### WR-03: Concurrent double-publish returns `published: True, version: -1` and writes a false `publish_succeeded` receipt

**File:** `backend/app/services/harness/publish_service.py:235-248`, `backend/app/db/workflows.py:229-251`
**Issue:** `publish_definition` correctly guards `WHERE status='draft'` and returns `-1` when the flip found no row (the documented defensive sentinel). But `publish_workflow` never checks the sentinel: the race loser (two concurrent publishes both passing stages 0-4, or a publish racing another flip path) returns `{"published": True, "version": -1}` and writes a `publish_succeeded` receipt with `version: -1` — a false governance record and a misleading API response.
**Fix:**
```python
version = await publish_definition(pool, definition_id)
if version == -1:
    return await _block(pool, run_id=golden_run_id, user_id=user_id,
        definition_id=definition_id, stage="already_published",
        named_failures=["the draft was published concurrently or is no longer a draft"],
        golden_run_id=golden_run_id)
```

### WR-04: The publish endpoint synchronously drives a full workflow run inside one HTTP request — no overall deadline, and interactive phases dead-end

**File:** `backend/app/api/workflows.py:96-143`, `backend/app/services/harness/publish_service.py:348-468`
**Issue:** `POST /workflows/{id}/publish` awaits `_drive_golden_run` → `run_workflow` end-to-end. Per-phase wall clock defaults to 3600s (`harness_phase_wall_clock_seconds`), so a multi-phase golden run can legally hold the request for hours; typical proxies/clients time out long before, losing the verdict (the run continues server-side; a client *disconnect* instead cancels the producer mid-run, leaving a stranded golden run the startup resume sweep will later resurrect and re-drive). Additionally, an `llm_human_input` phase or an `ask_user` validator disposition inside a golden run emits its prompt to `run:{run_id}` — a stream no frontend tails on the publish path (`ctx.producer_run_id = run_id`) — so the run blocks up to `ask_user_max_timeout_seconds` (1800s) and then honestly fails; lint does not pre-block interactive phases at publish.
**Fix:** Minimum viable hardening for this phase: wrap `_drive_golden_run` in `asyncio.wait_for` with a publish-level budget (e.g. `min(sum(per-phase wall clocks), PUBLISH_MAX_SECONDS)`) mapping timeout to a `golden_run_error` block, and have stage 2 lint (or a stage-2.5 check) block definitions containing `llm_human_input` phases / `ask_user` dispositions from the synchronous publish path with a named failure ("interactive phases cannot be validated in a synchronous publish"). Longer-term: make publish a background job with a poll/SSE verdict (103 candidate).

### WR-05: Judge-model default inconsistency — the validator's live path fails where the publish path resolves a registry default

**File:** `backend/app/services/harness/validator_kinds.py:295-306` vs `backend/app/services/harness/publish_service.py:489-502`, `backend/app/config.py:956-962`
**Issue:** `Settings.harness_judge_model`'s comment promises "None = a registry default resolved at call time to a forced_emission:True model (claude-opus-4-8 / gpt-5.5)". `_judge_golden_output` implements that fallback; `_validate_llm_judge_rubric`'s live path does not — with the setting unset (the shipped default) and no `config.model`/`ctx.judge_model`, an in-run `llm_judge_rubric` gate always fails "no judge model resolved". Same documented knob, two behaviors.
**Fix:** Extract the publish path's candidate loop into one shared helper (e.g. `resolve_judge_model(settings) -> str | None` in validator_kinds.py) and call it from both sites so the documented default holds everywhere.

### WR-06: `emit_policy` matches leaves by bare field name — `partial` blanks CITED sibling cells, and the fallback summaries claim marks/blanks that did not happen

**File:** `backend/app/services/harness/emit_policy.py:45-57,113-150`
**Issue:** `_uncited_field_names` strips the location (`risks0.risk_id` → `risk_id`) and `_iter_leaf_dicts` matches by key alone. If `risks0.risk_id` is uncited but `risks1.risk_id` is properly cited, **both** are marked (flag) or blanked (partial) — partial destroys cited data (over-blanking is the safe direction for trust, but it silently discards verified values, contradicting "null-over-invent" which targets *unverified* values only). Conversely, when key names don't match anything (`marked == 0` / `blanked == []`), the flag summary still claims "delivered WITH [unverified] marks" and partial's `gap_list = blanked or sorted(uncited)` names keys that were never actually blanked — the document then carries unverified data presented as handled.
**Fix:** Match on the full `(location, field)` pair: have `_iter_leaf_dicts` yield the location (derivable for the legacy envelope as `scalar`/`{cname}{ri}` exactly as `check_coverage._iter_leaves` formats it) and compare against the verdict's full leaf strings. When zero leaves were actually modified but the verdict named offenders, fail back to the strict disposition rather than claiming success.

### WR-07: `output_file_valid` passes author-controlled `config["path"]` straight to a server-filesystem open — and its docstring claims a workspace lookup it never does

**File:** `backend/app/services/harness/validator_kinds.py:163-221`
**Issue:** The docstring says the `config["path"]` branch uses "the workspace ctx-pool lookup (the workspace_file_exists pattern)", but the code passes the raw path to `assert_integrity(path, ext)` — a direct local-file open. A workflow author can probe arbitrary server paths ending in `.docx/.pptx/.xlsx`; differing error messages (missing file vs not-a-zip vs parse detail in `f"...failed re-open: {e}"`) form a limited filesystem existence/type oracle. No file content is disclosed and non-OOXML extensions fail first, so exploitability is low — but it is an unscoped filesystem touch driven by definition JSONB.
**Fix:** Resolve `config["path"]` through the run's workspace (mirror `workspace_file_exists`: `get_file_by_path(pool, thread_id, path)` then open the workspace-managed location), or at minimum confine the path to the run's workspace root and genericize the error message (drop the raw exception text).

### WR-08: ask_user choices "Use newest version" / "Use as-is" imply version-selection behavior that does not exist

**File:** `backend/app/services/harness_engine.py:787-803,957-982`
**Issue:** For a `freshness:version_ambiguity` finding, the user is offered "Use newest version" vs "Use as-is" — but both are non-abort choices that route identically to Proceed; nothing filters retrieval to the newest version. A user choosing "Use newest version" reasonably believes the run will use only `report-v3.docx`; it will use whatever retrieval returns. The choice is recorded in the `validator_ask_user_approved` receipt, making the governance trail assert an unimplemented semantic.
**Fix:** Until version-scoped retrieval exists, present honest choices ("Proceed despite version ambiguity", "Abort") for the version-ambiguity finding too, or implement the narrowing (drop colliding non-newest stems from the phase's folder/document scope) before offering the choice. If this is a deliberate v1 cut, rename the options and note the cut in the receipt metadata.

## Info

### IN-01: Unused function-local imports in `publish_workflow`

**File:** `backend/app/services/harness/publish_service.py:62-68`
**Issue:** `create_workflow_run`, `load_run_phases`, and `write_audit` are imported in `publish_workflow` but used only by other helpers (which re-import them locally).
**Fix:** Drop the three unused names from the `publish_workflow` import block.

### IN-02: `write_audit` annotation says `run_id: UUID` but `_safe_audit` passes `None`

**File:** `backend/app/db/workflows.py:573-580`
**Issue:** The NULL-run `publish_blocked` receipts rely on `run_id=None` (column is nullable — verified in full-schema.sql:452), but the signature annotates `run_id: UUID`. Works at runtime; lies to type checkers.
**Fix:** Annotate `run_id: UUID | None` and note the nullable-receipt contract in the docstring.

### IN-03: Non-strict delivery double-surfaces the policy summary

**File:** `backend/app/services/harness/phase_types.py:1318,1382`
**Issue:** When a non-strict policy delivers (currently only `partial` can — see CR-02), the summary is persisted as its own assistant message via `_surface_failure_message` at 1318 AND appended to the success `text` at 1382, which `_surface_final_answer` persists again on the final phase — the user reads the same summary twice (echo of the 101.1 duplicate-message bug). Fold the surfacing into one site when fixing CR-02's ordering.
**Fix:** Keep only the success-text carry (1382); drop the pre-render `_surface_failure_message` call, or gate it to the failure path.

### IN-04: `_judge_golden_output` passes `user_settings=None` to `forced_emit` while the golden run loaded owner settings

**File:** `backend/app/services/harness/publish_service.py:539-547`
**Issue:** `_drive_golden_run` resolves `owner_settings` for the run ctx, but the judge shot passes `user_settings=None` — inconsistent with the validator live path (which forwards `ctx.user_settings`) and potentially relevant to gateway key/config resolution for the judge provider.
**Fix:** Thread the owner settings from `publish_workflow` into `_judge_golden_output` and forward them to `forced_emit`.

---

_Reviewed: 2026-06-12T08:00:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
