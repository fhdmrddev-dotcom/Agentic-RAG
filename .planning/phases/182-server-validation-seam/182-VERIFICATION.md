---
phase: 182-server-validation-seam
verified: 2026-07-25T01:30:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The verdict shape is consumable per-node (each verdict maps to a phase / node id) so a later canvas can paint per-node badges from it (SC#4)"
    status: failed
    reason: >
      9 of 10 verdict codes correctly key to a phase slug (per-node) or null (genuinely
      workflow-global). The `folder_scope` code is the exception: `assert_folder_scopes_subset`
      names the offending phase in its raised message, and `grounding_verdicts` builds that
      violation from a single phase's `folder_scope` config — i.e. it IS a per-node finding —
      yet the verdict is emitted with `phase: None`, with the slug embedded only in free-text
      prose. A canvas consumer can only attribute this verdict to a node by regexing the
      message, which is exactly the client-side re-derivation the phase's own D-182-06 red line
      forbids. The shipped unit test freezes the gap as intended behavior rather than catching
      it (its own docstring calls the verdict "workflow-global").
    artifacts:
      - path: "backend/app/services/harness/grounding.py"
        issue: "grounding_verdicts() Rule-1 branch (lines 409-412) hardcodes `\"phase\": None` for a violation that is inherently phase-specific"
      - path: "backend/tests/unit/test_182_validate.py"
        issue: "test_folder_scope_verdict_is_workflow_global (lines 203-232) asserts `verdict.phase is None` and pulls the slug out of `verdict.message` instead of asserting a populated `phase` field — the test encodes the bug as the contract"
    missing:
      - "Thread the offending phase slug structurally out of the folder-scope check (e.g. a typed exception/return value carrying `phase_slug`, without re-deriving the ⊆ walk) into grounding_verdicts()'s folder_scope verdict, so `phase` is populated the same way `unregistered_tool`/`unregistered_skill` already are, with a regression test that fails if `phase` reverts to `None`"
  - truth: "PHASE GOAL clause: \"reusing the existing lint verbatim so the canvas can never drift from the publish gauntlet it must ultimately pass\" (supplementary — derived from the ROADMAP goal narrative, beyond the 4 enumerated Success Criteria)"
    status: partial
    reason: >
      The /validate SEAM itself is real and mechanically correct: it imports and calls
      lint_workflow, grounding.grounding_verdicts, grounding.business_requirement_missing and
      publish_service._interactive_phase_failures verbatim, with no re-implementation anywhere.
      What is false is the code's own claim about what happens on the OTHER side of the
      anti-drift promise: publish_workflow's enforced stages are owner-check ->
      business_requirement -> structural lint -> interactive-phase -> golden run -> judge ->
      flip. Grounding-fidelity (unregistered_tool / unregistered_skill) is never invoked there,
      so /validate can show a red "error" verdict for a tool/skill reference that publish will
      accept and run anyway. This is exploitable TODAY, independent of any future canvas: the
      existing POST /workflows (create_draft) and PATCH /workflows/{id} (update_draft) routes
      also never call the grounding-fidelity checks, so a hand-crafted definition body can
      create, "validate" (red), and publish (green) a workflow with a hallucinated tool or an
      inaccessible skill_ref. The seam's own header comment in workflows.py asserts "every rule
      it previews is the SAME copy the publish gauntlet enforces" — true for 2 of 4 check
      categories (lint, business_requirement, interactive_phase), false for grounding fidelity.
    artifacts:
      - path: "backend/app/services/harness/publish_service.py"
        issue: "publish_workflow's documented + actual stage list (lines 1-33 docstring; 127-177 code) has no grounding-fidelity stage"
      - path: "backend/app/api/workflows.py"
        issue: "lines 236-242 claim byte-for-byte parity with what publish enforces; lines 619-650 (create_draft) and 687-714 (update_draft) never call grounding.grounding_verdicts or _check_grounding_fidelity"
    missing:
      - "A human/product decision: either add a grounding-fidelity stage to publish_workflow reusing grounding.grounding_verdicts (the same shared collector, so there is still exactly one copy of the rule), or explicitly narrow the header-comment claim to name which checks publish actually shares today and track the rest as a tracked follow-up"
---

# Phase 182: Server Validation Seam Verification Report

**Phase Goal:** The server exposes a single source of validation truth the canvas can call, reusing the existing lint verbatim so the canvas can never drift from the publish gauntlet it must ultimately pass.
**Verified:** 2026-07-25T01:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `POST /workflows/validate` accepts a `WorkflowDefinition` and returns structural/reachability/tool-whitelist/gate verdicts reusing `reachability.lint_workflow` + grounding-fidelity checks verbatim (SC#1) | VERIFIED | `backend/app/api/workflows.py:371-468` — the handler imports `lint_workflow` module-direct from `reachability` (`:58`), calls `grounding.grounding_verdicts`, `grounding.business_requirement_missing`, `publish_service._interactive_phase_failures` (`:419-456`), and returns `ValidateResponse(ok=(len(verdicts)==0), verdicts=verdicts)`. `pytest tests/unit/test_182_validate.py` — 12/12 passed (independently re-run) covering every lint code, `unregistered_tool`/`unregistered_skill`/`folder_scope`, `business_requirement`, `interactive_phase`. |
| 2 | The validation route is the SINGLE source of validation truth — no lint rule re-implemented client-side; grounding lists come from a server-provided bundle, never a frontend constant (SC#2) | VERIFIED | Server side: `workflow_authoring._assemble_grounding`/`_check_grounding_fidelity` are thin delegates to `grounding.py` (`workflow_authoring.py:149-184, 187-214` — confirmed by direct read, no residual duplicate logic); `publish_service.py:69,130` calls the shared `business_requirement_missing`, no inline predicate remains. `GET /grounding-bundle` (`workflows.py:471-529`) sources `tools`/`folders`/`skills` from `grounding.assemble_grounding_bundle` — `test_grounding_bundle_returns_server_sourced_palette` proves `tools` is the real in-process registry (`"search_documents" in body["tools"]`), not a literal. No frontend code exists yet for this phase (backend-only, confirmed no `frontend/` files in any of the 3 SUMMARYs' `files_modified`) — the "never a frontend constant" promise is upheld by construction; Phase 183/184 inherit the obligation to consume, not re-derive. |
| 3 | The route is flag-gated behind `visual_workflow_canvas`, byte-identical 404 when off (inherits Phase 181's off-switch) (SC#3) | VERIFIED, with an inherited caveat | Both routes carry `dependencies=[Depends(require_canvas())]` ALONE (`workflows.py:374,474`) — confirmed no `require_visible` stacked. `require_canvas` (`dependencies.py:600-651`) resolves the off-flag BEFORE auth (`:636`), folding every caller into the byte-identical `_NOT_FOUND`. `pytest tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py` — 21/21 passed, including the discriminating `test_require_canvas_404s_for_an_authenticated_operator_when_off` (proves the flag — not the anonymous-caller fold — is what 404s a genuinely authenticated operator). The canary (`canvas_canary.py`) is fully deleted; `grep -rn "canvas_canary" backend/app/` returns nothing (source or bytecode). **Caveat (CR-04, pre-existing/inherited, not a 182 regression):** `backend/app/main.py:592` sets no `openapi_url=None`/`docs_url=None`, and no route in `workflows.py` sets `include_in_schema=False` — so unauthenticated `GET /openapi.json`/`/docs` advertise both new routes + their schemas regardless of flag state. This is an app-wide condition present since before Phase 181; it weakens the "indistinguishable from a route that was never built" framing for a sophisticated prober but does not change the functional 404-vs-403/401 behavior verified above. |
| 4 | The verdict shape is consumable per-node (each verdict maps to a phase / node id) (SC#4) | **FAILED** | 9/10 verdict codes are correctly keyed (`unregistered_tool`/`unregistered_skill`/`orphan_phase`/`unsatisfiable_skip`/`input_unsatisfied`/`interactive_phase` → phase slug; `no_terminal`/`business_requirement` → correctly `null`, genuinely workflow-global). `folder_scope` is the exception — see gap entry above. `grounding.py:409-412`. |
| 5 | (Supplementary — derived from the Phase Goal narrative) "...so the canvas can never drift from the publish gauntlet it must ultimately pass" | **PARTIAL / gap** | The seam mechanically reuses every check verbatim (true), but publish does not enforce 2 of the 4 check categories the seam previews (grounding fidelity) — see gap entry above. Not one of the 4 numbered ROADMAP Success Criteria, but it is the literal wording of the phase's stated Goal and is directly falsifiable in the shipped code. |

**Score:** 3/5 truths verified (3 of the 4 numbered ROADMAP Success Criteria are clean; SC#4 has a real, verified defect; the supplementary phase-goal-fidelity check surfaces a second, distinct, verified gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/harness/grounding.py` | ONE shared grounding source: `GroundingBundle`, `assemble_grounding_bundle`, `render_grounding_prompt`, `grounding_verdicts`, `_check_grounding_fidelity`, `business_requirement_missing` | VERIFIED | 490 lines. All symbols present and importable (`python -c "from app.services.harness.grounding import ..."` pattern confirmed by reading the file directly). No DB import leaked into `reachability.py` (`grep -c "import supabase\|folder_utils" backend/app/services/harness/reachability.py` → 0). |
| `backend/app/services/workflow_authoring.py` | `_assemble_grounding`/`_check_grounding_fidelity` as thin delegates | VERIFIED | Lines 149-184, 187-214 — both call into `grounding.py`, return the byte-identical `(str, set, set)` tuple / short-circuit dict. No residual duplicate rule logic. |
| `backend/tests/test_182_extraction_parity.py` | Extraction-parity + one-source + NL-gen count guard | VERIFIED | Exists, 6 tests, independently re-run: 6/6 passed. Count-guard literals (2, 6) independently confirmed against `test_103_grounding_fidelity.py`/`test_103_nl_generate.py` via `grep -c`. |
| `backend/app/api/workflows.py` | `POST /validate` + `GET /grounding-bundle` routes + `Verdict`/`ValidateResponse`/`GroundingBundleResponse`/`PaletteFolder`/`PaletteSkill` models + `_severity` classifier | VERIFIED | Lines 253-529. All models and both routes present and read directly; `require_canvas` alone on both (`:374,474`). |
| `backend/tests/unit/test_182_validate.py` | Verdict unit set — every code + severity + per-node keying + `ok` semantics | VERIFIED (contains the SC#4 gap as a frozen assertion) | 364 lines, 12 tests, independently re-run: 12/12 passed. `test_folder_scope_verdict_is_workflow_global` (lines 203-232) is the test that documents the SC#4 defect rather than catching it. |
| `backend/tests/test_182_grounding_bundle.py` | `GET /grounding-bundle` shape + 404-when-off + CR-02 projection | VERIFIED | 252 lines, 6 tests, independently re-run: green. Confirms `PaletteFolder`/`PaletteSkill` projection (no `org_id`/`user_id` on the wire) and the real-registry server-sourcing proof. |
| `backend/app/api/canvas_canary.py` | DELETED | VERIFIED | File absent; `grep -rn "canvas_canary" backend/app/` returns nothing (source or bytecode). |
| `backend/app/main.py` | canary import + include removed | VERIFIED | Line 688 carries a tombstone comment naming the retirement; no `canvas_canary` reference remains; `python -c "import app.main"` succeeds. |
| `backend/tests/test_revert_byte_identical.py` | Repointed onto `GET /grounding-bundle` + `POST /validate` | VERIFIED | 266 lines, 5 tests; `grep -c "workflows/grounding-bundle\|workflows/validate"` both > 0; `grep -c "canvas/ping"` → 0. Independently re-run: green (part of the 21/21 batch above). |
| `backend/tests/test_181_flip_on.py` | Repointed onto `GET /grounding-bundle` (404-off + 200-on) | VERIFIED | 189 lines, 7 tests; repointed and green (part of the 21/21 batch above). |
| `backend/app/utils/skill_visibility.py` (post-review CR-01 fix, not in original plan frontmatter) | ONE org-gated skill-visibility predicate (`build_skill_visibility_or` / `skill_row_visible`) | VERIFIED | 84 lines. Mirrors the live RLS SELECT policy on `public.skills` term-for-term; `tool_dispatcher.py`'s 6 sites re-pointed at it (commit `0559e64b`, `git show --stat` confirms `tool_dispatcher.py` touched). |
| `backend/tests/unit/test_182_grounding_skill_org_gate.py` (post-review, CR-01 regression backstop) | Falsification-tested cross-org skill leak closure proof | VERIFIED | 314 lines, 8 tests, independently re-run: 8/8 passed. Attacks the fix from 4 directions (query shape, post-filter, fail-closed, end-to-end through the real route). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `workflow_authoring.py` | `harness/grounding.py` | delegate import | WIRED | `from app.services.harness.grounding import assemble_grounding_bundle, render_grounding_prompt` (`:170-173`) and `_check_grounding_fidelity as _shared_check_grounding_fidelity` (`:208-210`). |
| `harness/publish_service.py` | `harness/grounding.py` | `business_requirement_missing` | WIRED | `publish_service.py:69,130` — imported and called at stage 1. |
| `harness/publish_service.py` | `harness/grounding.py` | `grounding_verdicts` / `_check_grounding_fidelity` (fidelity) | **NOT WIRED** | `grep -n "grounding" backend/app/services/harness/publish_service.py` finds only the `business_requirement_missing` references — no call to `grounding_verdicts` or `_check_grounding_fidelity` anywhere in the publish stage list. This is the WR-01 / Truth-5 gap above. |
| `api/workflows.py` | `harness/grounding.py` | `grounding_verdicts` + `assemble_grounding_bundle` + `business_requirement_missing` | WIRED | `workflows.py:410-413,419-456` — all three called inside `validate_workflow`; `:506-512` inside `get_grounding_bundle`. |
| `api/workflows.py` | `harness/reachability.py` | `lint_workflow` (module-direct) | WIRED | `from app.services.harness.reachability import lint_workflow` (`:58`); called at `:421`. |
| `api/workflows.py` | `app/dependencies.py` | `require_canvas` gate | WIRED | Present on both new routes (`:374,474`); confirmed absent `require_visible` on the same two routes (present on all 8 other authoring routes on the same router, e.g. `:559,623,656,685,720,790,820,960`). |
| `test_revert_byte_identical.py` | `api/workflows.py` | real-route 404-when-off probe | WIRED | Confirmed via independent test run + `grep` for `workflows/(grounding-bundle|validate)`. |
| `test_181_flip_on.py` | `api/workflows.py` | real-route 200-when-on probe | WIRED | Confirmed via independent test run; `test_canvas_ping_200_after_flip_on` (retained name, repointed path) asserts 200 on `GET /workflows/grounding-bundle`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GET /workflows/grounding-bundle` | `bundle.tools`/`.folders`/`.skills`/`.placeholders` | `grounding.assemble_grounding_bundle` → `fetch_visible_folders` (real Supabase query, org+owner scoped), `get_tools(None)` (real in-process tool registry), `_skill_registry` (real Supabase query, now org-gated) | Yes | FLOWING — `test_grounding_bundle_returns_server_sourced_palette` asserts `"search_documents" in body["tools"]` (the genuine registry) and `body["tools"] == sorted(body["tools"])`, not a hardcoded list. |
| `POST /workflows/validate` | `verdicts` | `lint_workflow(body)` (pure fn over the actual request body), `grounding.grounding_verdicts` (real DB-backed `assert_folder_scopes_subset` + the request body's own `available_tools`/`skill_ref`), `grounding.business_requirement_missing(body)`, `publish_service._interactive_phase_failures(body)` | Yes | FLOWING — every check operates on the caller-supplied `WorkflowDefinition`, not a static/canned response; `test_182_validate.py`'s 12 tests each drive a distinct definition shape through the real handler. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 182's full test surface (extraction parity, validate verdicts, bundle route, revert gate, flip-on, off-audience, NL-gen regression, lint regression) | `cd backend && venv/Scripts/python.exe -m pytest tests/test_182_extraction_parity.py tests/test_182_grounding_bundle.py tests/unit/test_182_validate.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_103_lint_block.py -q` | `54 passed, 1 warning in 2.44s` | PASS |
| CR-01 org-gate regression backstop (post-review fix) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_182_grounding_skill_org_gate.py -q` | `8 passed` | PASS |
| SEED-125 original fix still green after the CR-01 change (no regression to the earlier tool_dispatcher fix) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_182_grounding_skill_org_gate.py tests/unit/test_seed125_skill_visibility_filter.py -q` | `12 passed` | PASS |
| NL-gen test count guard literals are accurate (not stale) | `grep -c "^async def test_\|^def test_" tests/unit/test_103_grounding_fidelity.py tests/unit/test_103_nl_generate.py` | `2` and `6` respectively | PASS |
| Publish never calls grounding-fidelity checks (WR-01 confirmation) | `grep -n "grounding" backend/app/services/harness/publish_service.py` | Only `business_requirement_missing` references (lines 66-69, 128) — no `grounding_verdicts`/`_check_grounding_fidelity` | CONFIRMS GAP |
| Draft create/update routes never call grounding-fidelity checks either (WR-01 exploitability) | Direct read of `create_draft` (`workflows.py:625-650`) and `update_draft` (`:687-714`) | Neither calls any grounding function | CONFIRMS GAP |

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` files exist for this phase and none are declared in the PLAN/SUMMARY files (backend static-seam phase, no migration, no CLI/tooling surface).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| VALID-01 | 182-01, 182-02, 182-03 | The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side. | SATISFIED (with caveats) | The route exists, reuses every check verbatim, and no client-side re-implementation exists (no frontend touches this yet). Literal requirement wording is met. Caveats: SC#4's per-node keying gap and the publish-enforcement gap (Truth 5) are real, verified defects tracked above but do not literally contradict this requirement's text — `REQUIREMENTS.md:21,102` already marks VALID-01 `[x]` / `Complete`, which this verification does not dispute at the requirement-text level, while still surfacing the two gaps as phase-goal-level concerns. |

No orphaned requirements: `grep -n "Phase 182" .planning/REQUIREMENTS.md` returns only the VALID-01 row; every requirement ID declared across all 3 plans' frontmatter (`VALID-01` only) is accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/harness/publish_service.py` | 1-33 (docstring), 127-177 (code) | Missing enforcement stage | WARNING | `publish_workflow` never calls the grounding-fidelity checks it shares a module with — see Truth 5 gap. |
| `backend/app/api/workflows.py` | 230-242 | Comment asserts a property the code does not have | WARNING | "Every rule it previews is the SAME copy the publish gauntlet enforces" is false for grounding-fidelity rules 2/3 (WR-01). |
| `backend/app/services/harness/grounding.py` | 409-412 | Verdict emitted with `phase: None` for an inherently per-phase finding | WARNING (BLOCKER for SC#4) | See gap entry — forces client-side message parsing to attribute a node. |
| `backend/app/api/workflows.py` | 481, 505; `grounding.py:189-237` | Silent dead code path | WARNING | `template_asset_id: UUID` can never match a real library asset (a storage path, not a UUID); `template_placeholders` is permanently `[]` for every real asset. `test_182_grounding_bundle.py:114-136` asserts the `[]` result as the expected shape rather than catching the defect — a test passing for the wrong reason (WR-03). |
| `backend/app/api/workflows.py` | 338-368, 405-456 | Unsealed I/O despite a documented invariant | WARNING | Docstring promises "ALWAYS HTTP 200"; a DB blip inside `assemble_grounding_bundle`/`grounding_verdicts` (uncaught `APIError`/`ValueError` paths) would 500 instead. No test exercises this failure path (WR-04). |
| `backend/app/api/workflows.py` | 344-368 | Hardcoded literal-set duplicate of codes owned elsewhere, fails open | WARNING | `_ERROR_CODES` re-declares 6 string literals from `reachability`/`grounding`; an unrecognized future code silently classifies as `incomplete` (soft) rather than failing loud (WR-05). |
| `backend/app/models/harness.py` | 252-280 | Two `@model_validator` rules bypass the `{ok, verdicts}` envelope | WARNING | `folder_scope`-without-`project_folder_id` and `skill_snapshot`-without-`skill_ref` 422 as raw Pydantic errors before reaching the handler — a second, un-server-mapped error surface the canvas would have to interpret itself (WR-07). |
| `backend/app/api/workflows.py` | 374, 474 | Authorization asymmetry with sibling routes | WARNING | The 2 new routes carry `require_canvas()` alone; all 8 other authoring routes on the same router also carry `require_visible("workflow_authoring")`. Currently latent (default audience "everyone") but a silent authz gap the moment an operator narrows authoring visibility (WR-08). |
| `backend/app/main.py` | 592 | No schema gating | INFO (inherited, pre-existing) | `FastAPI(...)` sets no `openapi_url=None`/`docs_url=None`; `/openapi.json`/`/docs` advertise the new routes regardless of flag state — app-wide condition, not introduced by 182 (CR-04). |
| `backend/tests/unit/test_182_validate.py` | 322-335; `test_revert_byte_identical.py` (POST /validate probe) | Tautological assertions | INFO | `{v.severity for v in resp.verdicts} <= {"error","incomplete"}` cannot fail given `Verdict.severity: Literal[...]`; the `!= 422` off-probe assertion on an in-test-validated body cannot fail either (IN-04, CR-03-adjacent — already independently confirmed by the orchestrator as a non-reproducing status-code concern for the live posture). |
| `backend/app/utils/folder_utils.py` via `grounding.py:241` | — | Full-table read on a hot path | INFO | `fetch_all_folders(supabase, fields="*")` selects every folder row with no filter/limit on a route documented as firing "on every canvas edit" (IN-05). |
| `backend/app/services/harness/grounding.py` | 372-391 | Duplicate-slug keying ambiguity | INFO | Verdicts key on `phase.slug`; two phases sharing a slug (a `bad_index` lint finding, not a hard reject) would produce ambiguous per-node attribution (IN-06). |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file this phase modified.

### Human Verification Required

### 1. Real grounding-bundle content against a live KB

**Test:** With `visual_workflow_canvas` flipped on for a real session, call `GET /workflows/grounding-bundle` and compare the returned `folders`/`skills`/`tools` against the actual Supabase KB state for that user (folder tree, enabled skills, registered tools).
**Expected:** The palette reflects the live DB content exactly — no missing/extra folders or skills, no cross-org leakage for a multi-org test account.
**Why human:** Depends on live Supabase KB state and a real authenticated session; the offline tests (correctly) fake the assembler or run against conftest's mock client, which cannot substitute for a live-data spot check. (Flagged in the phase's own `182-VALIDATION.md` Manual-Only Verifications table.)

### 2. Product decision on the publish-enforcement gap (Truth 5 / WR-01)

**Test:** Not a UI test — a product/architecture decision: should `publish_workflow` also enforce grounding fidelity (reusing `grounding.grounding_verdicts`), or is the current split (previewed-but-not-enforced) intentional, with the header comment corrected to say so?
**Expected:** An explicit decision recorded (e.g. a `D-182-xx` entry or a follow-up phase/seed), not a silent status quo — since the current code makes an affirmatively false claim about what publish enforces.
**Why human:** This is a scope/risk-tolerance call (NL-gen already prevents AI-authored ungrounded drafts; the residual exposure is hand-crafted/API-authored or future canvas-edited definitions), not something a verifier can resolve unilaterally.

### Gaps Summary

Phase 182 delivered the architecturally correct anti-drift SEAM: one shared `grounding.py` module, byte-identical NL-gen behavior post-extraction (independently re-run, 54+ tests green), a `POST /workflows/validate` route that genuinely imports and calls every check verbatim (no re-implementation anywhere), a server-sourced `GET /grounding-bundle` palette, and a fully-retired canary with the byte-identical-404 gate strengthened onto the real routes (including a new discriminating test that pins the flag-before-auth step order). Two Critical findings from code review (CR-01 cross-org skill leak, CR-02 raw-row serialization) were genuinely fixed after the review with dedicated, falsification-tested regression suites (8+4 tests independently re-run green) and an honestly-scoped follow-up seed (SEED-129) for three OTHER pre-existing, out-of-surface leaky reads the fix's own grep sweep surfaced — a textbook example of bounding scope correctly rather than silently expanding or ignoring.

Two gaps remain open, both verified directly against source:

1. **SC#4 (BLOCKER):** the `folder_scope` verdict — the one grounding-fidelity rule that is genuinely per-phase in nature — is emitted with `phase: None`, contradicting the phase's own per-node-keying contract and forcing exactly the client-side message-parsing the D-182-06 red line exists to prevent. This is a narrow, mechanical fix (thread the slug structurally instead of leaving it in prose) with a clear regression-test shape already modeled by the sibling `unregistered_tool`/`unregistered_skill` verdicts in the same file.

2. **Phase-goal fidelity (WARNING / human decision):** the code's own claim that "every rule it previews is the SAME copy the publish gauntlet enforces" is false for grounding-fidelity rules 2 and 3 — `publish_workflow`, `create_draft`, and `update_draft` never call them. This is exploitable today via the existing (non-canvas) authoring API, not merely a future canvas concern. Whether to close this by adding a publish-time stage or by narrowing the claim is a product decision, not a code defect to auto-fix.

Neither gap blocks the mechanical existence or wiring of the seam itself, but both are real, falsifiable departures from what the phase set out to guarantee, and are structured above for `/gsd:plan-phase --gaps`.

---

*Verified: 2026-07-25T01:30:00Z*
*Verifier: Claude (gsd-verifier)*
