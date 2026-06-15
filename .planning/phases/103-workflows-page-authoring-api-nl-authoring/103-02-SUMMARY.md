---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 02
subsystem: api
tags: [nl-authoring, forced-emit, provider-gateway, grounding-fidelity, strict-mode, pydantic, fastapi, cross-provider]

# Dependency graph
requires:
  - phase: 103-01
    provides: Settings.harness_authoring_model knob (D-103-2) + the additive PhaseSpec.name + the 7 Wave-0 test_103_*.py scaffolds (the nl_generate/grounding stubs this plan fills); the /workflows router the /generate route joins
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: the forced_emit(schema_model=...) CR-01 seam (the judge's mirror) + resolve_judge_model (the exact resolve_authoring_model analog) + the provider-from-cap resolution pattern
  - phase: 098-project-folder-binding
    provides: assert_folder_scopes_subset (the server-side ⊆ grounding-fidelity check) + fetch_visible_folders (owner-scoped folder grounding)
provides:
  - additive strict: bool | None = None override on forced_emit (None = cap-derived byte-identical; False = force-without-strict for the optional-heavy WorkflowDefinition authoring shot — avoids the OpenAI/DeepSeek strict 400)
  - the workflow_authoring service (resolve_authoring_model + grounding assembly + the generate→validate→retry-once→grounding-fidelity orchestration over forced_emit(schema_model=WorkflowDefinition, strict=False))
  - POST /workflows/generate route (delegates to workflow_authoring; returns a draft object NOT persisted, or an honest structured failure)
  - the filled test_103_nl_generate.py (one-call / retry-once / no-strict / honest-fail / route-delegation) + test_103_grounding_fidelity.py (⊆ subtree + tool/skill registry) — un-xfailed GREEN
affects: [103-04 (Builder POSTs /workflows/generate then PATCHes the returned draft), 103-06 (Workflows page Build-card → Builder → generate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive default-preserving override kwarg on a hot shared primitive (strict: bool | None = None; None preserves the cap-derived path byte-identically for every existing emit/judge caller)"
    - "NL one-shot structured generation REUSES forced_emit(schema_model=...) — no new SDK path, no agent loop, no gateway change (D-01 RED LINE)"
    - "Grounding fidelity is DISTINCT from model_validate (shape-only): a shape-valid but ungrounded draft is an honest failure, never a draft (G-6 silent-invalid guard)"
    - "Server-computed valid SETS (folder/tool/skill) so KB content can never whitelist itself (the 101.1-06 precedent); the model never participates in scope (GOV-01)"
    - "Exactly-once retry with an observable nl_generation_attempt structured-log event (no harness_audit row — that CHECK is a closed constraint; RESEARCH A2)"

key-files:
  created:
    - backend/app/services/workflow_authoring.py
    - backend/tests/unit/test_103_forced_emit_strict.py
  modified:
    - backend/app/services/forced_emit.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_103_nl_generate.py
    - backend/tests/unit/test_103_grounding_fidelity.py

key-decisions:
  - "The strict override is the additive `strict: bool | None = None` kwarg on forced_emit (RESEARCH Open Q1 option (a)): None preserves `bool(cap.get('strict_json_schema', False))` BYTE-IDENTICALLY; an explicit False/True overrides it. The flag flows to GatewayRequest.strict_schema exactly as before — no other line of forced_emit changed. Proven at the gateway boundary (captured GatewayRequest.strict_schema) + the existing forced_emit/judge suites stay green."
  - "The authoring shot passes strict=False (Pitfall 1): forcing-without-strict works on OpenAI/DeepSeek; the optional-heavy WorkflowDefinition (status/project_folder_id/inputs/assets/business_requirement/most config optionals NOT in `required`) would 400 under strict. The Anthropic default (claude-opus-4-8) is unaffected either way."
  - "resolve_authoring_model mirrors resolve_judge_model EXACTLY (D-103-2): Settings.harness_authoring_model else the first ('claude-opus-4-8','gpt-5.5') with forced_emission; provider resolves via (get_model_capability(model) or {}).get('provider') — the publish_service judge pattern."
  - "Grounding fidelity = assert_folder_scopes_subset (⊆ subtree, reused) + a set-membership check (available_tools ∈ get_tools(None) names, skill_ref ∈ owner/global enabled skill ids). A miss returns {ok:False, error:'grounding_failed'} — NEVER a draft."
  - "The /generate route uses the GLOBAL app.config.settings for model resolution (the judge's pattern — a model id is infra, not per-user), supabase via Depends(get_supabase), pool via await get_pg_pool() in the body; returns the service dict directly (ok=False → 200 with the structured error, not an HTTP error)."

patterns-established:
  - "Default-preserving additive kwarg on a hot shared primitive: `x = <existing derivation> if x is None else bool(x)` keeps every existing caller byte-identical while opening a per-call override."
  - "A net-new generation service reproduces a throwaway spike's logic (grounding assembly + _strip_discriminator) WITHOUT importing the spike, and reuses the production substrate (forced_emit) instead of a new SDK path."

requirements-completed: [WFAUTH-02]

# Metrics
duration: 10min
completed: 2026-06-14
---

# Phase 103 Plan 02: NL One-Shot Authoring (strict override + workflow_authoring + /generate) Summary

**The NL describe-first birth path (REQ-2 / WFAUTH-02): an additive default-preserving `strict` override on the shared `forced_emit` primitive (Pitfall 1 — the one net-new integration risk, planned and shipped FIRST), the `workflow_authoring` service that reuses `forced_emit(schema_model=WorkflowDefinition, strict=False)` for grounding assembly + exactly-once retry + grounding fidelity, and the `POST /workflows/generate` route that returns a non-persisted draft or an honest structured failure — with `forced_emit`'s default/Deep/judge path byte-identical and `threads.py`/`anthropic_service.py` untouched.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-14T09:48Z
- **Completed:** 2026-06-14T09:58Z
- **Tasks:** 3
- **Files modified:** 6 (3 source + 3 test; 2 of those net-new)

## Accomplishments

- **Task 1 — additive `strict` override on `forced_emit` (Pitfall 1, planned FIRST):** `forced_emit` gains a keyword-only `strict: bool | None = None`. The resolution changed from `strict = bool(cap.get("strict_json_schema", False))` to `strict = bool(cap.get("strict_json_schema", False)) if strict is None else bool(strict)`. `None` (the default) preserves the cap-derived value **byte-identically** for every existing emit/judge caller; `False` forces strict OFF (the authoring path); `True` is reserved. Nothing else in `forced_emit` changed — `strict` flows to `GatewayRequest.strict_schema` exactly as before. 4 boundary tests capture the `GatewayRequest.strict_schema` the substrate built.
- **Task 2 — the `workflow_authoring` service:** `resolve_authoring_model` (mirrors `resolve_judge_model`), `_strip_discriminator` + `WF_SCHEMA` + the `emit_workflow_definition` tool (Pitfall 7), `_assemble_grounding` (owner-scoped folder tree + `get_tools(None)` names + owner/global enabled skills + optional template placeholders via `resolve_template_source`/`parse_docx_template_variables`), and `generate_workflow_definition` (forced shot → validate → EXACTLY one retry on a first-pass None → honest fail; grounding fidelity after a clean validate; one `nl_generation_attempt` structured log per call). REUSES `forced_emit`/the gateway — **no new SDK path, no agent loop, no spike import**.
- **Task 3 — `POST /workflows/generate` route:** `GenerateRequest{describe, project_folder_id?, template_asset_id?, template_placeholders?}` (D-103-CONF-2), the route delegates to `workflow_authoring` (module import for patchability), returns the service dict directly — a draft (NOT persisted) or a 200 `{ok:false,error,detail}` honest "could not generate". `threads.py`/`anthropic_service.py` byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: additive strict override on forced_emit (default byte-identical)** — `a58929f7` (feat, TDD)
2. **Task 2: workflow_authoring service (grounding + retry-once + fidelity)** — `85bb7c06` (feat, TDD GREEN)
3. **Task 3: POST /workflows/generate route (delegates; never persists)** — `70783ce7` (feat, TDD GREEN)

_Note: each task's RED scaffold is the Plan-01 Wave-0 xfail stub (`a9ccc7f6`) or a new test file created in the same task; each task un-xfails/fills it to GREEN in its own atomic feat commit (the Plan-01 Wave-0 convention — the planner front-loaded the stubs into Wave 0, so no separate `test(...)` commit per task)._

## Files Created/Modified

- `backend/app/services/forced_emit.py` — added the keyword-only `strict: bool | None = None` param (after `schema_model`) + the default-preserving resolution line + a docstring paragraph. **One-line behavior change; default byte-identical.**
- `backend/app/services/workflow_authoring.py` (NEW) — `resolve_authoring_model`, `_strip_discriminator`/`WF_SCHEMA`/`EMIT_TOOL`, `_skill_registry`, `_render_folder_tree`, `_resolve_template_placeholders`, `_assemble_grounding`, `_check_grounding_fidelity`, `generate_workflow_definition`, `AUTHORING_SYSTEM_PROMPT`.
- `backend/app/api/workflows.py` — `GenerateRequest` model + `@router.post("/generate")` delegating to `workflow_authoring` (module import); `from app.config import settings`, `get_supabase` added to the deps import.
- `backend/tests/unit/test_103_forced_emit_strict.py` (NEW) — strict=None byte-identical / strict=False overrides / strict=True overrides / emit-caller-unchanged (capture `GatewayRequest.strict_schema`).
- `backend/tests/unit/test_103_nl_generate.py` — filled: one-call / retry-once / no-strict (asserts `strict=False`) / honest-fail / route-delegation-and-never-persist.
- `backend/tests/unit/test_103_grounding_fidelity.py` — filled: out-of-subtree folder UUID → grounding_failed; hallucinated tool → grounding_failed; clean → ok=True.

## Decisions Made

- **Strict override is additive, default `None` (RESEARCH Open Q1 option (a)).** The single-line `if strict is None else bool(strict)` keeps `forced_emit` byte-identical for the emit deliverable + the judge (neither passes `strict`), and opens a per-call override the authoring shot uses with `False`. Proven both ways: the new strict tests assert the captured `GatewayRequest.strict_schema`, and the existing `test_forced_emit`/`test_validator_kinds`/`test_publish_service` suites stay green.
- **The authoring shot forces strict OFF (Pitfall 1).** `WorkflowDefinition` is optional-heavy; OpenAI/DeepSeek strict requires every property in `required`, so a strict shot would 400. Forcing-without-strict is the spike's proven OpenAI path and is a distinct code branch. The Anthropic default is unaffected (no strict on Anthropic rows), so the headline path never needed it — but the SC#10 OpenAI/DeepSeek rows do.
- **Template grounding is minimal + optional (D-103-3 / D-103-CONF-2).** `template_placeholders` (direct) or `template_asset_id` (library `resolve_template_source` Branch 1, which keys on `asset_id` as the storage path and ignores `thread_id`, so authoring-time with no thread works). A resolution miss degrades to no placeholders — never a hard failure of the whole generate. No new upload route, no Builder upload UI.
- **`nl_generation_attempt` is a structured log, not a `harness_audit` row (RESEARCH A2).** The audit-event CHECK is a closed 22-kind constraint; adding a kind needs a migration. The SPEC says "structured log/trace event," and the unit test asserts the call count via the `forced_emit` mock — no migration.

## Deviations from Plan

None — plan executed exactly as written. The three tasks landed in the planned order (strict override FIRST, then the service, then the route), each with its targeted test green, and every acceptance-criteria grep passed verbatim. The one minor test-harness reality (the route test must stub `wf_api.get_pg_pool` + override `get_supabase` so no live DB is touched while the service is mocked) is standard FastAPI test plumbing, not a scope change.

## How the strict override stays additive / cross-provider-safe

- **Additive:** the new param is keyword-only with default `None`; the resolution `bool(cap.get("strict_json_schema", False)) if strict is None else bool(strict)` returns the EXACT pre-change value when `strict is None`. Every existing caller (the `llm_emit` deliverable in `phase_types.py`, both judge call sites in `publish_service.py`/`validator_kinds.py`) passes no `strict` → `None` → byte-identical. The `forced_emit(` count in `phase_types.py` is unchanged vs base (1 → 1: no new emit shots).
- **Cross-provider-safe:** the strict flag is provider-translated at the service boundary (the gateway's openai-compat adapter sets `"strict": true` only for `strict_json_schema:True` providers; Anthropic/Google ignore it). The override sets the flag for the authoring schema only — it never touches the shared chunk handler, SSE emitter, or any provider-specific branch. `threads.py` + `anthropic_service.py` are byte-identical to `a131f05a` (0-line diff). The authoring shot reuses the gateway's `force_tool_name` translation unchanged for all native-7 + OpenRouter.

## Test Results

- **Plan target suite** (`test_103_forced_emit_strict / nl_generate / grounding_fidelity`): **11 passed**. Exit 0.
- **All 8 `test_103_*.py`** (incl. Plan-01's CRUD/published-409/lint/tweak/phasespec): **24 passed**.
- **forced_emit DEFAULT byte-identical proof** (`test_forced_emit.py` + `test_llm_emit_executor.py`): **43 passed** — the emit + judge consumers unaffected by the additive strict.
- **Shared-path judge/publish slice** (`test_publish_service / test_validator_kinds / test_publish_flip / test_harness_models / test_emit_field_map`): **39 passed** — the judge (which shares `forced_emit`) green.
- **Net-new failures = 0 (SEED-056 base-checkout proven):** reverting `forced_emit.py` + `api/workflows.py` to base `7eb44ce8` and removing `workflow_authoring.py` makes my 3 net-new test files FAIL (10 failed: `ModuleNotFoundError: workflow_authoring`, missing `strict` param, missing `/generate` route); restoring HEAD source makes them PASS (11 passed). No file I touched introduces a new failure in any pre-existing test.
- **No new `*.sql`:** `git status --porcelain "backend/**/*.sql"` = none (zero-migration; RESEARCH A2 log-not-audit).
- **G-5 byte-identical:** `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` = 0 lines.

## TDD Gate Compliance

The plan's Wave-0 design (Plan 01 Task 1) front-loaded the `test_103_nl_generate.py` + `test_103_grounding_fidelity.py` RED scaffolds as xfail stubs in commit `a9ccc7f6` (the RED gate). This plan's Tasks 2/3 filled them to GREEN in their feat commits (`85bb7c06`, `70783ce7`) — the RED → GREEN gate is satisfied across commits. Task 1 created `test_103_forced_emit_strict.py` in the same commit as the source change (the plan front-loads the file into the task); the test asserts behavior that did not exist at base (proven by the base-checkout). No separate `test(...)` commit per task, consistent with the Plan-01 Wave-0 convention.

## SC#10 Note (deferred to /gsd:verify-work, per CLAUDE.md)

The 4-axis cross-provider NL-gen matrix (OpenAI/Anthropic/Google/OpenRouter + the full native-7; multi-tool / parallel-thread / long-message) lives in `103-VALIDATION.md`, NOT in this plan's tasks. It is exercised LIVE at `/gsd:verify-work 103`. The unit layer proves the contracts (exactly-once retry, grounding fidelity, strict=False for authoring); the live matrix proves the path on each provider (OpenAI/DeepSeek no-strict-400, DeepSeek/Moonshot reasoning-native, GLM/MiniMax tool-sensitive incl. the `minimax-m3-invalid-tool-args-400` watch).

## Next Phase Readiness

- **Plan 03 (frontend nav + deriveTier + api client)** and **Plan 04 (Builder)** can now wire the Builder's describe textarea → `POST /workflows/generate` → render the returned draft. The service returns `{ok, definition}` / `{ok:false, error, detail}` — the UI distinguishes on `ok` (the "could not generate" surface is Claude's-discretion copy per D-103-C).
- The `Settings.harness_authoring_model` knob (Plan 01) is consumed; the default is `claude-opus-4-8` (forced_emission, no strict — the headline path is unaffected by Pitfall 1).
- No blockers.

## Self-Check: PASSED

- All key files exist on disk (verified): `backend/app/services/workflow_authoring.py`, `backend/tests/unit/test_103_forced_emit_strict.py`, and the modified `forced_emit.py` / `api/workflows.py` / `test_103_nl_generate.py` / `test_103_grounding_fidelity.py`.
- All 3 task commits exist in git history (verified): `a58929f7`, `85bb7c06`, `70783ce7`.
- Plan target suite GREEN (11 passed); forced_emit default byte-identical (43 passed); judge/publish slice green (39 passed); G-5 byte-identical (0-line diff); no new `*.sql`; net-new failures = 0 (base-checkout proven).

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
