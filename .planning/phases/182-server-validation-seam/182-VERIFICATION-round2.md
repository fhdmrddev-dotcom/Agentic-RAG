---
phase: 182-server-validation-seam
verified: 2026-07-25T12:00:00Z
status: gaps_found
score: 5/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "SC#4 — folder_scope verdict phase: None (per-node keying blocker)"
    - "Phase-goal-fidelity clause — publish_workflow never enforced grounding fidelity"
  gaps_remaining: []
  regressions:
    - "SC#3 (byte-identical 404 when the canvas flag is off) — round 1 marked this truth 'VERIFIED, with an inherited caveat.' Independently re-driving the round-2 code review's two flagged scenarios against the live app (TestClient, no mocks) shows the caveat is load-bearing, not cosmetic: a malformed POST body to /workflows/validate returns 422 (not the byte-identical 404) while the flag is off, and GET /openapi.json / GET /docs publish both new routes plus all 5 new schemas to an anonymous caller regardless of flag state. Neither scenario was code-changed between round 1 and round 2 — round 1 saw the openapi caveat and under-classified it as non-blocking without testing the malformed-body case at all. This pass classifies the same underlying condition as FAILED because it now has direct falsifying evidence for a real (if narrow) unauthenticated-caller behavior, not just a theoretical 'sophisticated prober' framing."
gaps:
  - truth: "The route is flag-gated behind `visual_workflow_canvas` and returns a byte-identical 404 when the flag is off, for EVERY caller, before any route-existence signal can leak (SC#3, inherits Phase 181's REVERT-01/REVERT-02 HARD gate #1)"
    status: failed
    reason: >
      Independently reproduced against the live app (fastapi.testclient.TestClient over
      app.main:app, flag cold-off, no Authorization header — the same harness the phase's own
      tests use) rather than trusted from the round-2 code review's narration:

      (1) POST /workflows/validate with a MALFORMED JSON body returns 422
      ({"detail":[{"type":"json_invalid",...}]}) while a VALID body returns 404 and a genuinely
      unbuilt single-segment sibling route (POST /workflows/__nope__) returns 405 for BOTH a
      valid-shaped and a malformed body. This is a real, reproducible oracle: an anonymous,
      unauthenticated caller can learn "a POST handler exists at exactly /workflows/validate"
      while the canvas is off, by sending one malformed byte — the exact class of pre-auth
      existence leak Phase 181's own code review found and fixed in the OTHER direction (an
      auth dependency firing 403/401 ahead of the flag check). The mechanism is FastAPI's own
      request lifecycle: the body is decoded (and a JSONDecodeError raised as a 422
      RequestValidationError) BEFORE `solve_dependencies` ever runs — so `require_canvas`
      (a `Depends`) cannot intervene, no matter how it is written. The phase's own guarding
      assertion (`test_revert_byte_identical.py:132`, `assert resp_validate.status_code !=
      422  # the gate fired BEFORE body validation`) is tautological: the body it sends is
      pre-validated against the real Pydantic model in the same test, so it can never be 422
      regardless of whether the flag fires before or after body parsing — it does not test the
      case that actually breaks.

      (2) GET /openapi.json returns 200 to an anonymous caller with the flag off, and its
      `paths` object contains BOTH `/workflows/validate` and `/workflows/grounding-bundle`; its
      `components.schemas` contains all five new models (`ValidateResponse`, `Verdict`,
      `GroundingBundleResponse`, `PaletteFolder`, `PaletteSkill`). GET /docs also returns 200.
      No route in `workflows.py` sets `include_in_schema=False`, and `FastAPI(...)` in
      `main.py:592` sets no `openapi_url`/`docs_url` override — confirmed by grep across the
      whole `app/` tree: `include_in_schema` and `openapi_url`/`docs_url` appear NOWHERE in the
      codebase, so this is not an established, deliberately-skipped convention — schema gating
      has never been applied anywhere in this app. A caller therefore learns the exact shape,
      field names, and severity taxonomy of both gated routes with ZERO requests to the gated
      routes themselves — a stronger existence leak than (1).

      Both scenarios directly falsify SC#3's literal text ("returns a byte-identical 404 when
      the flag is off") and the broader REVERT-02 contract this phase's own test-file docstring
      quotes and claims to satisfy ("the same reachable-route set... every canvas-gated route is
      a 404, byte-identical to a path that was never built" — a path that was never built does
      not appear in `/openapi.json` at all, and does not distinguish malformed-body 422 from
      405). (2)'s underlying mechanism (no app-wide schema gating) pre-dates Phase 182 and
      would already have applied to the trivial Phase-181 canary route; (1) is novel to Phase
      182 because `/canvas/ping` was a body-less GET, so the flag-vs-body-parsing race did not
      exist before this phase added a POST route with a body. Both were raised in the ROUND-1
      code review (as CR-03/CR-04) and are recorded in `182-REVIEW.md`'s round-1 disposition
      table as "STILL LIVE, never triaged" through all four gap-closure plans (182-04/05/06/07)
      — a repo-wide search of `.planning/seeds/*.md` and `182-DECISION-NOTES.md` finds no
      seed, no plan, and no decision note addressing either finding (SEED-130/131/132 cover
      three DIFFERENT findings — WR-03/04/07 — and `182-DECISION-NOTES.md` covers only WR-08).
    artifacts:
      - path: "backend/app/api/workflows.py"
        issue: "POST /validate (:469-480) and GET /grounding-bundle (:569-580) rely SOLELY on `Depends(require_canvas())` for the off-flag gate; neither carries `include_in_schema=False`, so both are discoverable via /openapi.json regardless of flag state, and the POST route's body is decoded before require_canvas ever runs."
      - path: "backend/app/main.py"
        issue: "Line 592 — `FastAPI(title=..., version=..., lifespan=lifespan)` sets no `openapi_url=None`/`docs_url=None`; no per-route or app-wide schema gating exists anywhere in the codebase (confirmed by grep), so this is a structural gap, not a missed one-off."
      - path: "backend/tests/test_revert_byte_identical.py"
        issue: "Line 132 — `assert resp_validate.status_code != 422  # the gate fired BEFORE body validation` is tautological: the probe body is `WorkflowDefinition.model_validate()`-checked as VALID two lines above, so this assertion can never distinguish 'the flag gate ran first' from 'the flag gate never gets a chance to run first' — it does not exercise the malformed-body case that actually leaks."
    missing:
      - "Decide the flag BEFORE body parsing for the two canvas routes — e.g. a small pure-ASGI middleware (mirroring `MaintenanceMiddleware`'s posture) that checks `feature_audience('visual_workflow_canvas')` for the two known canvas paths and short-circuits to the byte-identical 404 ahead of Starlette's routing/body-decode step, while keeping `Depends(require_canvas())` on the routes themselves for defense-in-depth (role/operator resolution). Replace the tautological assertion with a probe that actually sends a malformed body and asserts 404 (not 422)."
      - "Gate the schema: either `include_in_schema=False` on both routes (simplest, but hides them from /docs even when the flag is ON) or a custom `app.openapi()` hook that drops the two canvas paths + their five schemas when `feature_audience('visual_workflow_canvas') == 'off'` (keeps /docs useful once the canvas is on). Add a regression test asserting `/workflows/validate` and `/workflows/grounding-bundle` are absent from `GET /openapi.json`'s `paths` when the flag is off."
      - "If the residual risk is instead judged acceptable as-is, record that as an explicit decision (the same pattern `182-DECISION-NOTES.md` already uses for WR-08) with the rationale, and add a `verification-overrides.md`-style override entry to this file's frontmatter — do not leave it silently unaddressed a third time (it was raised at round-1 review, re-raised at round-2 review, and is now independently confirmed at this verification pass)."
deferred:
  - truth: "WR-03 — GET /workflows/grounding-bundle's `template_placeholders` field is dead code (a UUID `template_asset_id` can never key a real storage-path asset)"
    addressed_in: "Phase 184"
    evidence: "SEED-130-workflow-template-placeholders-dead-path.md `suggested_phase`: 'Fold into Phase 184's node-config work — the first real consumer.' Matches Phase 184 SC#1/Requirements CANVAS-03 ('configure a selected node in a side panel')."
  - truth: "WR-04 — POST /workflows/validate documents an ALWAYS-HTTP-200 invariant that is not sealed against DB read failures"
    addressed_in: "Phase 184"
    evidence: "SEED-131-validate-always-200-invariant-unsealed.md `re_open_triggers` #1: 'Phase 184 lands the live editable canvas... /validate is called continuously during authoring... a single transient Supabase blip then turns into a visible 500 storm.' Matches Phase 184 SC#3 (structural violations 'surface live from the server validate route' as the canvas is built)."
  - truth: "WR-07 — two `@model_validator` rules on WorkflowDefinition raise raw Pydantic 422s that bypass the {ok, verdicts} envelope"
    addressed_in: "Phase 184"
    evidence: "SEED-132-harness-model-validator-bypasses-verdict-envelope.md `re_open_triggers` #1: 'Phase 184 must render validation state for a PARTIALLY-CONFIGURED node... and hits a 422 with no verdict payload.' Matches Phase 184 SC#4 / VALID-03 (per-node validation status derived from the server verdict)."
---

# Phase 182: Server Validation Seam Verification Report

**Phase Goal:** The server exposes a single source of validation truth the canvas can call, reusing the existing lint verbatim so the canvas can never drift from the publish gauntlet it must ultimately pass.
**Verified:** 2026-07-25T12:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — second pass, after gap-closure plans 182-04/05/06/07

## Re-verification Summary

The prior pass (`182-VERIFICATION-round1.md`, preserved alongside this report) found `gaps_found`
at 3/5 with two structured gaps: the SC#4 `folder_scope` per-node-keying BLOCKER, and the
phase-goal-fidelity gap (publish never enforced grounding fidelity, so `/validate` and publish
could disagree). Both are independently re-verified as **genuinely fixed** below — not merely
claimed fixed by the SUMMARYs. A third finding the orchestrator asked to be checked (WR-05, the
fail-open severity classifier) is also independently confirmed fixed. WR-03/WR-04/WR-07 are
confirmed properly deferred (seeded with concrete, evidenced re-open triggers naming Phase 184).
WR-08 is confirmed properly REJECTED via a locked decision (D-182-05) with an honest residual-risk
paragraph, not silently dropped.

However, a **new BLOCKER was found and independently confirmed** during this pass, sourced from
the round-2 code review's two Critical findings (CR-01/CR-02 in that report's numbering; CR-03/CR-04
in round-1's numbering). Per this verification's explicit instructions, these were **not** taken on
the reviewer's narration — they were re-driven against the live application with a fresh
`TestClient` probe script (no mocks reused from the phase's own tests) and both are confirmed real.
See the `gaps:` entry above and Truth #3 below.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `POST /workflows/validate` accepts a `WorkflowDefinition` and returns structural/reachability/tool-whitelist/gate verdicts reusing `reachability.lint_workflow` + grounding-fidelity checks verbatim (SC#1) | VERIFIED (regression-checked) | `backend/app/api/workflows.py:469-480` — handler imports `lint_workflow`/`LINT_CODES` module-direct from `reachability` (`:60`), calls `grounding.grounding_verdicts`, `grounding.business_requirement_missing`, `publish_service._interactive_phase_failures`. Independently re-run: `pytest tests/unit/test_182_validate.py -q` — 12/12 passed. No change to this surface since round 1 beyond the SC#4 folder_scope keying fix (see Truth 4). |
| 2 | The validation route is the SINGLE source of validation truth — no lint rule re-implemented client-side; grounding lists come from a server-provided bundle, never a frontend constant (SC#2) | VERIFIED (regression-checked) | `grounding.py` remains the one shared source; `GET /grounding-bundle` (`workflows.py:569-654`) still sources `tools`/`folders`/`skills` from `grounding.assemble_grounding_bundle`. `git diff --name-only 5ebfe993 HEAD -- frontend/` returns **zero files** — confirmed no frontend code exists anywhere in the phase's full commit range (01 through 07), so "never a frontend constant" still holds by construction. |
| 3 | The route is flag-gated behind `visual_workflow_canvas` and returns a byte-identical 404 when the flag is off, for EVERY caller (SC#3, inherits Phase 181's REVERT-01/REVERT-02 HARD gate) | **FAILED** | Independently reproduced against the live app (see the `gaps:` entry above for full detail and the exact probe transcript). `POST /workflows/validate` with a malformed body → **422** (not 404); a genuinely unbuilt sibling `POST /workflows/__nope__` → **405** for the identical malformed body — a real, unauthenticated route-existence oracle. `GET /openapi.json` (flag off, anonymous) → **200**, advertising both new paths and all 5 new schemas; `GET /docs` → **200**. `require_canvas` itself (the `Depends`) is correctly implemented and its own behavioral surface (valid-body POST, body-less GET, operator/user/pre-auth callers) is unaffected and remains 404-correct — the gap is that FastAPI resolves the request body and the OpenAPI schema entirely OUTSIDE the dependency-injection layer `require_canvas` lives in, so no amount of correctness inside `require_canvas` can close either leak. |
| 4 | The verdict shape is consumable per-node (each verdict maps to a phase/node id) so a later canvas can paint per-node badges from it (SC#4) | **VERIFIED — gap closed by 182-04** | Independently confirmed via source read (not the SUMMARY's claim alone): `backend/app/services/harness/scope.py:51` defines `class FolderScopeSubsetError(ValueError)`; `:266-270` raises it with `phase_slug=phase.slug` and the byte-identical message expression. `backend/app/services/harness/grounding.py:377-406` (`_folder_scope_violation`) returns `(message, phase_slug)` via `getattr(exc, "phase_slug", None)`; `:433-460` (`grounding_verdicts`) emits `{"code": "folder_scope", "phase": phase_slug, ...}` — no more hardcoded `"phase": None"`. `grep -c '"phase": None' backend/app/services/harness/grounding.py` → 0. Independently re-run: `pytest tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_validate.py -q` — all passed (part of the 106-test run below). The test that previously froze the bug (`test_folder_scope_verdict_is_workflow_global`) no longer exists (renamed to `test_folder_scope_verdict_is_keyed_to_the_phase`, confirmed by reading the current file). |
| 5 | Phase-goal clause: "...so the canvas can never drift from the publish gauntlet it must ultimately pass" — publish enforces the SAME grounding-fidelity checks `/validate` previews | **VERIFIED — gap closed by 182-06** | Independently confirmed via source read: `backend/app/services/harness/publish_service.py:199-225` — stage 2.6 (`grounding_fidelity`) calls `_grounding_fidelity_failures` (`:525-589`), which imports and calls `grounding.assemble_grounding_bundle` + `grounding.grounding_verdicts` — the SAME collector `/validate` calls — and blocks via `_block(..., stage="grounding_fidelity", ...)` BEFORE the stage-3 golden-run call site (line 209 precedes line 239's `asyncio.wait_for(...)`, confirmed by direct line-number comparison). Fails closed on a resolution error (`grounding_unavailable`, never raises). The seam header comment (`workflows.py:234-267`) now names, per check, the shared symbol AND the publish stage that enforces it. Independently re-run: `pytest tests/unit/test_182_publish_grounding_stage.py tests/unit/test_publish_service.py -q` — all passed (part of the 106-test run below), including the direct `/validate`-vs-publish agreement test that compares two independently produced `(code, phase)` sets. |
| 6 | The severity classifier fails LOUD (never silently soft) on an unrecognised verdict code, and its known-code set is derived from the modules that own the codes rather than duplicated as literals (WR-05, requested as an explicit check by the orchestrator) | **VERIFIED — gap closed by 182-07** | Independently confirmed via source read: `backend/app/services/harness/reachability.py` publishes `LINT_CODES`; `backend/app/services/harness/grounding.py` publishes `GROUNDING_VERDICT_CODES`; `backend/app/api/workflows.py:397-466` composes `_KNOWN_CODES = LINT_CODES \| grounding.GROUNDING_VERDICT_CODES \| _ROUTE_ASSIGNED_CODES`, derives `_ERROR_CODES` by set subtraction (no literal verdict-code string on that assignment — confirmed by reading the line), and `_severity`'s final branch logs `logger.warning(...)` and returns `"error"` for an unrecognised code — no bare trailing `return "incomplete"` remains (`grep -c 'return "incomplete"' backend/app/api/workflows.py` → 2, both intentional branches). Independently re-run: `pytest tests/unit/test_182_severity_codes.py -q` — passed (part of the 106-test run below), including the drift-detector tests that scan the owning modules' real emit sites. |

**Score:** 5/6 truths verified. One BLOCKER (SC#3) is newly confirmed at this pass.

### Deferred Items

Items not currently met but explicitly scheduled for a later phase in this milestone, with
concrete evidence of the match (Step 9b). These do not affect the `gaps_found` status above (that
status is driven solely by SC#3), and they are NOT re-litigated here as fresh gaps.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-03 — `template_placeholders` dead path on `GET /grounding-bundle` | Phase 184 | `SEED-130-workflow-template-placeholders-dead-path.md` — "Fold into Phase 184's node-config work." Matches Phase 184's CANVAS-03 node-config side panel. |
| 2 | WR-04 — `/validate`'s documented ALWAYS-200 invariant is unsealed against DB read failures | Phase 184 | `SEED-131-validate-always-200-invariant-unsealed.md` — priority `high`, re-open trigger #1 names Phase 184's live canvas calling `/validate` on every edit. Matches Phase 184 SC#3. |
| 3 | WR-07 — two `@model_validator` rules 422 before reaching the `{ok, verdicts}` envelope | Phase 184 | `SEED-132-harness-model-validator-bypasses-verdict-envelope.md` — priority `high`, re-open trigger #1 names Phase 184's per-node badge rendering. Matches Phase 184 SC#4 / VALID-03. |

**WR-08** (the two canvas routes carry `require_canvas()` alone, not stacked with
`require_visible("workflow_authoring")` like the 8 sibling authoring routes) is **not** a deferred
item — it is a **REJECTED** finding, independently confirmed sound: `182-DECISION-NOTES.md` cites
the locked decision `D-182-05`, quotes the in-source rule (`workflows.py:263-266`), explains WHY
stacking `require_visible` would be actively harmful (it raises 403, which leaks route existence
and would defeat the same REVERT-01 gate SC#3 above is about), and states an honestly-bounded
residual risk (a caller inside the canvas audience but outside the authoring audience can reach
two READ-ONLY, own-data-only routes) plus a narrow re-open trigger (an explicit decision supersede,
or either route gaining a write/execute side effect). Confirmed by reading `dependencies.py`
directly: `require_visible` (`:517-555`) does end in `raise HTTPException(status_code=403, ...)`,
so the technical claim underpinning the rejection is accurate.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/harness/scope.py` | `FolderScopeSubsetError(ValueError)` carrying `phase_slug`, raised by `assert_folder_scopes_subset` | VERIFIED | Class at `:51`; raise site at `:266-270` with `phase_slug=phase.slug`; message expression byte-identical to pre-182-04. |
| `backend/app/services/harness/grounding.py` | `_folder_scope_violation` returns `(message, phase_slug)`; `grounding_verdicts` populates `folder_scope`'s `phase`; `GROUNDING_VERDICT_CODES` published | VERIFIED | `:377-406`, `:433-460`, and the module-level `GROUNDING_VERDICT_CODES` frozenset all present and read directly. `grep -c '"phase": None'` → 0. |
| `backend/app/services/harness/publish_service.py` | Stage 2.6 `grounding_fidelity` calling the shared collector, before the golden run, fail-closed | VERIFIED | `_grounding_fidelity_failures` (`:525-589`), `_resolve_publish_supabase` (`:499-522`), call site at `:199-225` — line 209 precedes the golden-run call at `:239`. |
| `backend/app/services/harness/reachability.py` | `LINT_CODES` published, module stays PURE (no DB import) | VERIFIED | `grep -c "supabase\|folder_utils\|_skill_registry" backend/app/services/harness/reachability.py` → 0 (all three forbidden tokens absent). |
| `backend/app/api/workflows.py` | `_KNOWN_CODES`/`_ERROR_CODES`/`_severity` composed + fail-loud; `POST /validate` + `GET /grounding-bundle` routes; corrected seam header comment naming publish-stage parity | VERIFIED (routes) / **GAP** (flag-gate completeness — see Truth 3) | Routes exist at `:469-480` / `:569-580`; `_severity` fails loud at `:457-466`. Neither route carries `include_in_schema=False`; the app carries no schema-gating anywhere (confirmed by repo-wide grep). |
| `backend/tests/unit/test_182_folder_scope_keying.py` | Falsification-tested SC#4 regression suite | VERIFIED | Exists (317 lines per SUMMARY); independently re-run as part of the 106-test batch below, all passed. |
| `backend/tests/unit/test_182_publish_grounding_stage.py` | Falsification-tested publish-enforcement regression suite incl. the `/validate`-vs-publish agreement test | VERIFIED | Exists (413 lines per SUMMARY); independently re-run, all passed. |
| `backend/tests/unit/test_182_severity_codes.py` | Drift-detector + fail-loud-proof + pinned taxonomy suite | VERIFIED | Exists (383 lines per SUMMARY); independently re-run, all passed. |
| `.planning/seeds/SEED-130-*.md` / `SEED-131-*.md` / `SEED-132-*.md` | Deferred-finding seeds with concrete re-open triggers | VERIFIED | All three exist, read in full; each carries `status: open`, `folded_into: null`, ≥3 `re_open_triggers`, and a `suggested_phase` naming Phase 184 with a specific matching requirement. |
| `.planning/phases/182-server-validation-seam/182-DECISION-NOTES.md` | WR-08 recorded REJECTED with D-182-05 rationale | VERIFIED | Read in full; cites `D-182-05`, the in-source rule, the 403-vs-404 distinction (confirmed against `dependencies.py` directly), and a residual-risk paragraph + narrow re-open trigger. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `harness/publish_service.py` | `harness/grounding.py` | `grounding_verdicts` (fidelity, stage 2.6) | **NOW WIRED** (was NOT WIRED at round 1) | `publish_service.py:567` calls `grounding_verdicts` inside `_grounding_fidelity_failures`, called from `publish_workflow` at `:209`. This closes the round-1 "NOT WIRED" key-link finding. |
| `api/workflows.py` | `app/dependencies.py` | `require_canvas` gate | WIRED, but **insufficient alone** | Present on both new routes (`:472`, `:...` before `:574`); correctly implemented in isolation. The gap is not in this link — it is that two OTHER paths (body-parse-before-dependency-solving; OpenAPI schema generation) bypass the dependency-injection layer entirely and were never given an equivalent gate. |
| `api/main.py` (FastAPI app object) | OpenAPI schema generator | (none — no `include_in_schema` / custom `openapi()` hook) | **NOT WIRED** | No mechanism ties route visibility in `/openapi.json` to `feature_audience("visual_workflow_canvas")`. Confirmed by repo-wide grep: zero occurrences of `include_in_schema` or `openapi_url`/`docs_url` anywhere in `backend/app/`. |
| `test_revert_byte_identical.py` | `api/workflows.py` (`POST /validate`, malformed body) | 404-when-off probe | **NOT WIRED / vacuous** | The existing probe only sends a pre-validated VALID body (`_MINIMAL_VALID_DEFINITION`), so its `!= 422` assertion is tautological and does not exercise the path that actually leaks. No test anywhere in the phase sends a malformed body to either canvas route with the flag off. |

### Data-Flow Trace (Level 4)

No change from round 1 — both routes still source real data from `grounding.assemble_grounding_bundle` / the real DB reads (re-confirmed by the independently-run `test_182_grounding_bundle.py` / `test_182_validate.py` passing). Not re-traced in full here since neither route's data-flow was implicated in this pass's findings.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Phase-182 declared test surface (extraction parity, validate verdicts, bundle route, folder-scope keying, publish-grounding stage, severity-codes drift, skill org-gate, revert gate, flip-on, off-audience, publish_service, NL-gen + lint regression) | `cd backend && venv/Scripts/python.exe -m pytest tests/test_182_extraction_parity.py tests/test_182_grounding_bundle.py tests/unit/test_182_validate.py tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_publish_grounding_stage.py tests/unit/test_182_severity_codes.py tests/unit/test_182_grounding_skill_org_gate.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py tests/unit/test_publish_service.py tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_103_lint_block.py -q` | `106 passed, 1 warning in 2.91s` | PASS |
| **CR-01 independent reproduction** — malformed JSON body to `POST /workflows/validate`, flag OFF, no auth | Standalone `TestClient` probe script (fresh `app.main.app` import, `_cold_off`-equivalent monkeypatch, `content=b"{"`) — not reusing any of the phase's own test assertions | `status=422  body={"detail":[{"type":"json_invalid",...}]}` | **CONFIRMS GAP** |
| **CR-01 control** — same malformed body to the never-built sibling `POST /workflows/__nope__` | Same probe script | `status=405  body={"detail":"Method Not Allowed"}` — genuinely distinguishable from the /validate result | **CONFIRMS GAP** (the two paths are NOT byte-identical) |
| **CR-01 control** — VALID body to `POST /workflows/validate`, flag OFF | Same probe script | `status=404  body={"detail":"Not Found"}` | Confirms the gate itself works correctly for well-formed input — isolates the gap to the body-parsing race specifically. |
| **CR-02 independent reproduction** — `GET /openapi.json`, flag OFF, anonymous | Same probe script | `status=200`; `paths` contains `/workflows/validate` and `/workflows/grounding-bundle`; `components.schemas` contains `ValidateResponse`, `Verdict`, `GroundingBundleResponse`, `PaletteFolder`, `PaletteSkill` — all `True` | **CONFIRMS GAP** |
| **CR-02 control** — `GET /docs`, flag OFF, anonymous | Same probe script | `status=200` | **CONFIRMS GAP** |
| Sanity — `GET /workflows/grounding-bundle`, flag OFF, no auth (the known-good body-less path) | Same probe script | `status=404  body={"detail":"Not Found"}` | Confirms the body-less GET route's gate is unaffected — the gap is specific to (a) POST-with-body routes and (b) the schema endpoint. |
| Zero frontend files touched across the phase's full commit range | `git diff --name-only 5ebfe993 HEAD -- frontend/` | (empty output) | PASS |
| Debt-marker sweep across all phase-touched source files | `grep -n -E "TBD\|FIXME\|XXX"` and `grep -n -i -E "TODO\|HACK\|PLACEHOLDER"` across `workflows.py`, `grounding.py`, `scope.py`, `publish_service.py`, `reachability.py`, `skill_visibility.py` | Zero TBD/FIXME/XXX/TODO/HACK; "placeholder" hits are all legitimate domain vocabulary (docx template placeholder fields) | PASS |
| Schema-gating convention check — is `include_in_schema=False` used anywhere else in this app? | `grep -rn "include_in_schema" app/` and `grep -rn "openapi_url\|docs_url" app/main.py` | Zero matches for both | Confirms CR-02's underlying mechanism is a genuine app-wide gap, not a deliberately-skipped local convention. |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase (backend static-seam phase, no
migration, no CLI/tooling surface) — same disposition as round 1. The ad-hoc `TestClient` probe
script used for the CR-01/CR-02 independent reproduction above was written to the session
scratchpad (outside `backend/`, never committed) per the project's no-scratch-in-watched-tree rule,
and is not a project-convention probe.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| VALID-01 | 182-01..07 | The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side. | SATISFIED at the requirement-text level (unchanged from round 1) | The route exists, reuses every check verbatim, and no client-side re-implementation exists. `REQUIREMENTS.md:21,102` marks VALID-01 `[x]` / `Complete`; this verification does not dispute that at the literal-requirement-text level. The SC#3 gap above is a ROADMAP Success Criterion failure (the flag-gate's byte-identical contract), not a failure of VALID-01's own text — tracked separately per this workflow's must-have merge rules (ROADMAP SCs are non-negotiable regardless of REQ-ID wording). |

No orphaned requirements: `grep -n "Phase 182" .planning/REQUIREMENTS.md` returns only the VALID-01
row; every requirement ID declared across all 7 plans' frontmatter (`VALID-01` only, confirmed by
reading each plan's frontmatter) is accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/workflows.py` | 469-480, 569-580 | No schema gating on flag-controlled routes | **BLOCKER** (SC#3) | See gaps entry — independently confirmed via live probe. |
| `backend/app/main.py` | 592 | No `openapi_url`/`docs_url` gating anywhere in the app | **BLOCKER** (contributing cause) | Pre-existing app-wide mechanism; Phase 182 is the first phase to expose real content-bearing schemas through it and never triaged the finding despite two review passes flagging it. |
| `backend/tests/test_revert_byte_identical.py` | 132 | Tautological assertion (`!= 422` on an in-test-validated body) | WARNING | Gives false confidence that the malformed-body case is covered; it is not. |
| `backend/app/services/harness/grounding.py:148-158` interaction with `publish_service.py:562-589` (round-2 review WR-01) | — | A transient skills-read failure blocks publish with a FALSE `unregistered_skill` (naming the author's real, valid `skill_ref`) instead of the honest `grounding_unavailable` | WARNING (new, not yet seeded) | `_skill_registry`'s fail-closed `except Exception: return []` sits INSIDE `assemble_grounding_bundle`, so stage 2.6's own try/except never observes it — a read failure and "this skill genuinely does not exist" are indistinguishable to the caller. Confirmed by source read (`grounding.py:148-158`, `publish_service.py:525-589`); not independently re-run against a live failure injection in this pass. Not covered by any existing seed (SEED-131 covers `/validate`'s unsealed reads, a related but distinct surface). Recommend seeding at the next gap-closure pass — not a BLOCKER (narrow, publish-time-only, requires a transient DB failure to trigger). |
| `backend/app/api/workflows.py` / `publish_service.py` (round-2 review WR-02) | — | `/validate` is unsealed while publish (post-182-06) is now sealed — the two sides of the "one shared copy" claim have opposite failure postures on the same DB reads | WARNING (already covered) | This is the same substance as `SEED-131` (deferred to Phase 184 above); no new seed needed. |
| `backend/app/services/harness/grounding.py` / `publish_service.py` (round-2 review WR-05) | — | Publish validates grounding against the PUBLISHER's org-membership union, not the definition's own `org_id` | WARNING (not independently re-verified this pass) | Documented in `182-REVIEW.md`; a multi-org-author correctness edge case, not re-driven here — flagged for awareness, not scored as a gap since it was outside this pass's explicit CR-01/CR-02 mandate and does not bear on any of the 4 numbered SCs. |
| Round-2 review WR-03/04/06/07/09/10, IN-01..07 | — | Various — see `182-REVIEW.md` in full | INFO/WARNING (not independently re-verified this pass) | Read in full as part of this verification's required reading; not each re-driven against source individually. None were flagged by the round-2 code review as bearing on the 4 numbered ROADMAP Success Criteria, and none appear in this pass's SC-level truth table as a result. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file this phase modified
(re-confirmed this pass across all source files touched by plans 01-07).

### Human Verification Required

### 1. Live publish smoke — the org-scoped service-role client on the grounding-fidelity stage

**Test:** With `visual_workflow_canvas` on, create a draft whose one phase declares
`available_tools: ["not_a_real_tool"]`, call `POST /workflows/validate` (expect a red
`unregistered_tool` verdict), then `POST /workflows/{id}/publish` — expect HTTP 200 with
`{published: false, blocked_stage: "grounding_fidelity"}` and NO new row in `workflow_runs`.
Repeat with a clean draft and confirm publish still reaches the golden run.
**Expected:** The block fires exactly as the unit tests predict, against a REAL Supabase
connection (not the patched `_resolve_publish_supabase` seam the unit suite uses).
**Why human:** This is the one step in the 182-06 plan's own `<human-check>` that proves the
org-scoped service-role client resolves against a real DB rather than a mocked pool/supabase —
still explicitly recorded as outstanding in `182-06-SUMMARY.md` ("A live smoke remains
outstanding"). Not something a verifier can execute without a live local Supabase + an
authenticated session.

### 2. Real grounding-bundle content against a live KB

**Test:** With `visual_workflow_canvas` on for a real session, call `GET
/workflows/grounding-bundle` and compare the returned `folders`/`skills`/`tools` against the
actual Supabase KB state for that user (folder tree, enabled skills, registered tools), including
a multi-org test account.
**Expected:** The palette reflects the live DB content exactly — no missing/extra folders or
skills, no cross-org leakage.
**Why human:** Depends on live Supabase KB state and a real authenticated session; carried
forward unchanged from round 1 (`182-VALIDATION.md`'s own Manual-Only Verifications table).

### Gaps Summary

**What genuinely closed since round 1 (independently re-verified, not SUMMARY-trusted):**

1. **SC#4 (the round-1 BLOCKER) is closed.** `scope.FolderScopeSubsetError` is a real
   `ValueError` subclass carrying `phase_slug`, `grounding.py` reads it structurally (never
   parses the message), and the `folder_scope` verdict now keys to its offending phase exactly
   like `unregistered_tool`/`unregistered_skill` do. Confirmed by direct source read and an
   independent test run (106/106 passed across the full declared surface).
2. **The phase-goal-fidelity gap is closed.** `publish_workflow` now runs a stage 2.6 that
   calls the SAME shared `grounding_verdicts` collector `/validate` calls, positioned before the
   golden run, failing closed on a resolution error. A direct agreement test compares the two
   independently-produced finding sets. Confirmed by direct source read (stage 2.6's call site
   line-number-precedes the golden-run call) and an independent test run.
3. **WR-05 (fail-open severity) is closed.** The known-code set is now composed from
   `LINT_CODES`/`GROUNDING_VERDICT_CODES`/`_ROUTE_ASSIGNED_CODES`, and an unrecognised code
   classifies `error` (with a log warning) instead of the old bare `incomplete` default.
   Confirmed by direct source read and an independent test run.
4. **WR-03/WR-04/WR-07 are legitimately deferred**, each with a well-evidenced seed
   (SEED-130/131/132) naming a concrete Phase-184 consumer and re-open trigger — not silently
   dropped. **WR-08 is legitimately REJECTED** via a locked decision (`D-182-05`) with an honest,
   bounded residual-risk statement, not silently ignored.

**What is newly, independently confirmed BROKEN at this pass — a BLOCKER:**

SC#3 ("returns a byte-identical 404 when the flag is off... inherits Phase 181's off-switch") is
FALSE for two concrete, reproduced-live scenarios: a malformed JSON body to `POST
/workflows/validate` returns 422 rather than the byte-identical 404 (revealing the route exists to
an anonymous caller, before `require_canvas` — or any `Depends` — ever runs, because FastAPI
decodes the request body before solving dependencies), and `GET /openapi.json`/`GET /docs` publish
both new routes and all five new schemas to an anonymous caller regardless of flag state. Both were
raised at round-1 code review, both were re-raised (unresolved) at round-2 code review, and neither
appears in any plan, seed, or decision note across the four gap-closure plans — this verification
independently reproduced both against the live application (not the reviewer's narration) and
confirms them real. This directly bears on the HARD gate #1 this phase inherits from Phase 181
(REVERT-01/REVERT-02): "with the flag off, the product is provably byte-identical to today" is not
provably true for these two routes.

This is a narrow, well-scoped fix (a body-parsing-order guard plus a schema-visibility hook — both
sketched with code in `182-REVIEW.md`'s CR-01/CR-02 sections) or, if the residual risk is judged
acceptable, an explicit recorded decision (mirroring how WR-08 was handled) — either path closes
the gap; leaving it silently unaddressed a third time does not.

---

*Verified: 2026-07-25T12:00:00Z*
*Verifier: Claude (gsd-verifier)*
