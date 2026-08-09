---
phase: 182-server-validation-seam
verified: 2026-07-25T15:00:00Z
status: gaps_found
score: 6/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "The round-2 malformed-body leak — POST /workflows/validate with bytes `{` now returns a byte-identical 404 (was 422), because CanvasGateMiddleware decides the flag in pure ASGI before Starlette routing / FastAPI body-decode. Independently reproduced live."
    - "The round-2 /openapi.json leak — GET /openapi.json with the flag off no longer advertises either canvas path or any of the 5 canvas-only schemas (the reference-graph-derived filter + the off/on/off cache-trap falsifier both hold). Independently reproduced live."
    - "WR-08 (round-2, double auth) — the two canvas routes now resolve the caller exactly once via a request.state hand-off; the second GoTrue round-trip is gone and the blocking read rides run_in_threadpool. Confirmed by direct source read of dependencies.py."
    - "WR-04 (round-2, folder_scope multiplicity) — grounding_verdicts now emits one keyed folder_scope verdict PER offending phase via the new non-raising scope.folder_scope_violations collector, not just the first. Confirmed by direct source read and passing multiplicity/mixed-rule tests."
  gaps_remaining:
    - "SC#3 (byte-identical 404 for EVERY caller) is NOT closed — it re-opened in a different, arguably sharper shape. See gaps below (CR-01 independently reproduced live)."
  regressions:
    - "GET /workflows/grounding-bundle (a route this SAME phase ships) went from a LOUD failure (pre-round-3: an unguarded folders/skills read propagated a real exception, surfacing as a 500) to a SILENT one (post-round-3: assemble_grounding_bundle now swallows the same failure into GroundingBundle.degraded, and get_grounding_bundle never reads that field, so it returns HTTP 200 with an empty-looking palette indistinguishable from 'you truly have zero folders/skills'). This is a genuinely new defect introduced by plan 182-11's own change, not a pre-existing condition — confirmed by direct source read of workflows.py's get_grounding_bundle (no `degraded` branch exists) and by the absence of any grounding-bundle-route test in tests/unit/test_182_grounding_degradation.py (which only drives validate_workflow and publish stage 2.6)."
gaps:
  - truth: "The route is flag-gated behind `visual_workflow_canvas` and returns a byte-identical 404 when the flag is off, for EVERY caller, before any route-existence signal can leak (SC#3, inherits Phase 181's REVERT-01/REVERT-02 HARD gate #1)"
    status: failed
    reason: >
      Independently reproduced against a FRESH, unmocked `app.main.app` import (no conftest,
      no dependency_overrides — a genuine anonymous-caller probe) with the flag cold-off, using
      `fastapi.testclient.TestClient`. `CanvasGateMiddleware` genuinely fixed the round-2 leak
      (malformed-body 422 and the /openapi.json advertisement are both closed — a 5-method
      sweep confirms both canvas paths now answer a uniform, byte-identical 404 for GET / POST /
      PUT / PATCH / DELETE, with and without a body). But the middleware's OWN chosen honesty
      baseline (a two-segment path, `/workflows/__nope__/__nope__`) is the wrong shape to prove
      byte-identity against, because the two real gated routes are themselves SINGLE-segment
      (`/workflows/validate`, `/workflows/grounding-bundle`), and the router already declares
      `PATCH /workflows/{definition_id}` and `DELETE /workflows/{definition_id}` — a route shape
      that shadows EVERY single-segment `/workflows/<anything>`, built or not. A live 5-method
      sweep against a wordlist-style unbuilt single-segment sibling
      (`/workflows/zzzunknown`) returns 405 (GET/POST/PUT) or 403 "Not authenticated"
      (PATCH/DELETE) or 422 (PATCH/PUT with a malformed body, since body-decode still races
      dependency resolution on a route that DOES exist) — **never** 404. The two canvas paths
      are therefore the ONLY single-segment `/workflows/<x>` paths that answer 404 for any
      method, which is a crisp, live, reproducible enumeration oracle: one PATCH (or DELETE)
      sweep over a wordlist finds the two gated routes by their unique 404, with zero
      credentials. This is a narrower/sharper restatement of round-3 code review finding CR-01,
      itself a re-raised and worsened form of round-1/round-2 code review WR-09 ("the tests are
      green for the wrong reason"). `test_182_canvas_gate.py::test_wrong_method_probe_404s_not_405`
      makes this worse, not better: it explicitly REQUIRES 404 and explicitly REJECTS 405 for
      `GET /workflows/validate` with no same-shape/same-method comparison against a genuinely
      unbuilt single-segment sibling — so the shipped suite would fail a correct fix (one that
      made the gate answer 405 for GET, matching what an unbuilt single-segment path answers)
      and currently defends the leaking behaviour as the required contract. Reproduced with a
      standalone script (fresh import, `PYTHONPATH` only, no test fixtures) — full transcript in
      the Behavioral Spot-Checks table below.
    artifacts:
      - path: "backend/app/middleware/canvas_gate.py"
        issue: "CanvasGateMiddleware.__call__ (:113-135) gates on PATH ONLY for every method, always answering a uniform 404. That is correct in isolation, but it makes the two canvas paths BEHAVE DIFFERENTLY from what the router would answer for the SAME path shape and method if the routes had never been declared (405 for GET/POST/PUT, 403 for PATCH/DELETE on a path matching `{definition_id}`) — the middleware's own 404 is therefore itself a unique, distinguishing signal relative to every other single-segment `/workflows/<x>` path."
      - path: "backend/tests/test_182_canvas_gate.py"
        issue: "The byte-identity baseline used throughout (`/workflows/__nope__/__nope__`, two segments) does not share a shape with either gated route (both single-segment) or with the router's actual single-segment catch-all (`{definition_id}`, PATCH/DELETE only). `test_wrong_method_probe_404s_not_405` (:128-148) asserts 404-not-405 with no same-shape comparison, which would reject a fix that made the gate answer exactly what an unbuilt single-segment path answers."
    missing:
      - "Make the gate answer exactly what the router would answer for that path+method if the two canvas routes had never been declared, derived from the route table (as round-3 review CR-01 sketches) — 405 for GET/POST/PUT on a single-segment shape, 403 for PATCH/DELETE — rather than a uniform 404 for every method. This closes the enumeration oracle at its root."
      - "Replace `test_wrong_method_probe_404s_not_405` and the ~14 dominated/unreachable assertions the round-3 review's WR-07 flags (test_182_canvas_gate.py, test_182_canvas_auth.py, test_revert_byte_identical.py) with a same-shape/same-method parity loop against a genuinely single-segment unbuilt sibling (e.g. `/workflows/zzzunknown`) for every method — the property SC#3 actually claims, which fails against today's code."
      - "Fix `_is_canvas_path`'s use of the raw `scope.get('path', '')` to Starlette's `get_route_path(scope)` (round-3 review WR-05) in the same pass — behind a `root_path` / sub-path mount (the project's own Coolify deployment doc), the raw path check is bypassed entirely and the pre-fix 422/405/307 leaks reopen even though the gate code looks correct in isolation."
      - "If the residual risk is instead judged acceptable (e.g. the operator decides a PATCH/DELETE method-sweep against a wordlist is an acceptable bar, given it requires probing a specific low-value route family), record that as an explicit decision mirroring the D-182-05/WR-08 precedent, narrow the ROADMAP SC#3 wording accordingly, and add a verification override — do not leave the current uniform-404 design silently presented as satisfying byte-identity a third time."
  - truth: "GroundingBundle.degraded is the ONE degradation signal, and every consumer of the shared grounding collector branches on it identically — an unresolvable registry always reports honestly as 'we could not check', never as a false, specific, or silently-empty answer (182-11's own stated must-have, closing round-2 findings WR-01/WR-02/WR-07)"
    status: failed
    reason: >
      Confirmed FALSE for two of the collector's three real consumers, by direct source read
      and by the test suite's own coverage gap.

      (1) `GET /workflows/grounding-bundle` (`workflows.py:641-697`, the canvas palette route
      this SAME phase ships) calls `grounding.assemble_grounding_bundle` and returns
      `bundle.tools` / `bundle.folders` / `bundle.skills` / `bundle.placeholders` directly —
      there is no `if bundle.degraded` branch anywhere in the handler, and
      `GroundingBundleResponse` (`workflows.py:356-375`) has no field that could carry the
      degradation. A folders or skills read failure (or a truncation) therefore renders as
      `{"folders": [], "skills": [], ...}` at HTTP 200 — byte-indistinguishable from a user who
      genuinely owns nothing. This is a NET-NEW regression from plan 182-11 specifically: before
      that plan, the same folders read was unguarded and a PostgREST error propagated as a loud
      500 (confirmed by 182-11's own docstring history and by round-3 code review CR-02, whose
      claim I independently verified against the current source rather than trusting either
      narrative). `tests/unit/test_182_grounding_degradation.py` (852 lines, 19 tests) drives
      `wf.validate_workflow` and publish stage 2.6 under failure injection, but contains zero
      references to `get_grounding_bundle` — the palette route's degraded-blindness is untested
      as well as unfixed.

      (2) The truncation-detection mechanism 182-11 built to close round-2 WR-07 (`folder_utils.
      fetch_all_folders(strict=True)`) detects a PostgREST `max-rows` truncation and converts it
      into `FolderReadTruncatedError` -> `GroundingBundle.degraded`, but the underlying read
      remains completely UNBOUNDED and UNFILTERED (`folder_utils.py:71`, `.select(fields,
      count="exact")` with no `.limit()`/`.range()`/owner predicate) — confirmed by direct
      source read. At or above PostgREST's `max-rows` cap (1000 rows by default — a scale the
      module's own docstring calls reachable: "1000 folders ACROSS ALL TENANTS is not a large
      deployment"), EVERY call to the strict read raises, which means EVERY `/validate` call
      returns exactly one `grounding_unavailable` verdict and EVERY publish permanently blocks
      at `grounding_fidelity` — a deployment-wide, unrecoverable outage of the whole grounding
      seam and the publish gate, not a rare transient-blip fallback the "we could not check"
      framing implies. There is no pagination, no operator remedy, and no test at that
      threshold (the test suite's fakes always report `count == len(rows)`, i.e. never actually
      exercise the fail-permanently path at scale).

      (3) `workflow_authoring`'s NL-generation path (the collector's third consumer) also
      ignores `degraded` — 182-11's own SUMMARY explicitly acknowledges this ("deliberately
      ignores degraded") and defends it by claiming "its own fidelity check re-reads the folder
      tree through the ⊆ walk, so its behaviour is unchanged" — a claim disproven by source read
      (`scope.py:124-125`: `resolve_project_subtree` returns `None` -> `[]` for an UNBOUND
      definition, which is the common case for a freshly NL-generated draft before a project
      folder is assigned, so the ⊆ walk is a no-op and cannot "re-read" anything). A folders
      read failure during NL generation therefore silently produces a folder-blind draft
      presented as `{"ok": True, ...}`.
    artifacts:
      - path: "backend/app/api/workflows.py"
        issue: "get_grounding_bundle (:641-697) never reads bundle.degraded; GroundingBundleResponse (:356-375) has no field that could carry it. Contrast validate_workflow (:566-598), which does branch on bundle.degraded correctly."
      - path: "backend/app/utils/folder_utils.py"
        issue: "fetch_all_folders's strict=True branch (:71-85) detects a truncation but the underlying select (:68, :71) is unbounded/unfiltered — no .limit()/.range()/owner predicate. Confirmed by direct read: this is a detector, not a bound."
      - path: "backend/app/services/workflow_authoring.py"
        issue: "The third consumer of assemble_grounding_bundle; does not branch on bundle.degraded. grounding.py's own module docstring (post-182-11) claims this consumer's behaviour is 'unchanged by this guard', a claim contradicted by scope.py's own no-op-on-unbound behaviour."
      - path: "backend/tests/unit/test_182_grounding_degradation.py"
        issue: "852 lines, 19 tests, all driving validate_workflow or publish stage 2.6 under failure injection — zero tests exercise get_grounding_bundle or workflow_authoring's NL-generation path under the same failures."
    missing:
      - "Add a degraded (or equivalent) field to GroundingBundleResponse and branch get_grounding_bundle on bundle.degraded exactly as validate_workflow does, so the palette route can never render an outage as an honest-looking empty result."
      - "Bound the strict=True folders read (pagination via .range(), or push the owner+org predicate down as WR-07's original request asked) so a real deployment at or above PostgREST's max-rows cap does not turn 'grounding_unavailable' from a rare degraded-mode fallback into a permanent, deployment-wide outage of /validate and publish."
      - "Either make workflow_authoring's NL-generation path honour bundle.degraded, or correct grounding.py's module docstring, which currently makes a disprovable 'unchanged by this guard' claim about it."
      - "Add regression tests for GET /workflows/grounding-bundle and NL generation under a raising/truncating folders or skills read, mirroring the validate_workflow / publish-stage-2.6 tests that already exist in test_182_grounding_degradation.py."
  - truth: "Publish's grounding gate is scoped to the DEFINITION's own org, not the publisher's org-membership union — a multi-org author can no longer publish an org-A definition that references an org-B resource merely because the publisher personally belongs to both orgs (182-12's own stated must-have, closing round-2 finding WR-05)"
    status: failed
    reason: >
      Confirmed PARTIALLY false by an independent, LIVE reproduction using the phase's own
      production code (`grounding.grounding_verdicts` -> `scope.folder_scope_violations` ->
      `scope.resolve_project_subtree`), not a mock and not narration. The fix genuinely closes
      the two secondary bindings the shipped test suite exercises — a phase's `skill_ref`
      naming an org-B skill, and a phase's per-phase `folder_scope` naming an org-B DESCENDANT
      folder under an org-A project root — both correctly blocked under `restrict_org_ids`,
      confirmed by both source read and the existing `test_182_publish_org_scope.py` (16/16
      passing).

      It does NOT validate the PRIMARY binding: the workflow definition's own
      `project_folder_id` itself. `resolve_project_subtree` (`scope.py:101-156`) unconditionally
      seeds its subtree walk with `out = [rid]` for the root on its very first call (`scope.py:
      150`), with no check that the root is itself present in the org-restricted visible folder
      set. I constructed a live probe reusing the EXACT fixture shapes from
      `test_182_publish_org_scope.py` (same org/folder ids, same fake supabase), but bound the
      definition's `project_folder_id` DIRECTLY to `_FOLDER_B` (the org-B-shared folder)
      instead of `_PROJECT_A` (the org-A root) — the one case that suite's own `_bound_payload`
      helper never varies (it hardcodes `project_folder_id: _PROJECT_A` on every call). Calling
      the real `grounding_verdicts(..., restrict_org_ids={_ORG_A})` against this definition
      returns `[]` (clean, publishable) in BOTH of two cases: a phase declaring no
      `folder_scope` at all, and a phase explicitly declaring `folder_scope=[_FOLDER_B]`
      (naming the very folder the workflow is bound to). A control case in the same probe run
      (an org-A-rooted definition whose phase references the org-B descendant) correctly
      returns a `folder_scope` violation, proving the restriction mechanism itself works and
      isolating the gap to the root-binding case specifically. This is the exact run-time
      failure WR-05/182-12 exists to prevent: an org-A colleague running this published
      workflow would resolve retrieval against a folder their own org cannot see, and nothing
      in the shipped fix or its test suite catches it. Round-3 code review's WR-02 finding
      states this same conclusion; I did not take it on narration — the reproduction above is
      my own, run against the real functions with a fresh probe script.
    artifacts:
      - path: "backend/app/services/harness/scope.py"
        issue: "resolve_project_subtree (:101-156), specifically the inner _walk function (:140-154): `out = [rid]` (:150) unconditionally includes the root in the resolved subtree regardless of whether `rid` (on the first call, the definition's own project_folder_id) is present in the org-restricted `folders` list. No check anywhere validates project_folder_id itself against restrict_org_ids."
      - path: "backend/tests/unit/test_182_publish_org_scope.py"
        issue: "_bound_payload (:445-466) hardcodes project_folder_id: _PROJECT_A on every call across all 16 tests — no test varies the workflow's own project-root binding to an out-of-org folder, so this specific gap has zero test coverage."
    missing:
      - "When restrict_org_ids is supplied, validate that the definition's project_folder_id itself resolves within the restricted visible folder set before seeding the walk — e.g. in scope.folder_scope_violations, after resolving the restricted subtree, check the root id against the restricted fetch_visible_folders result and append a violation (phase_slug=None, or a new code) when it is absent."
      - "Add the missing test case: a definition whose project_folder_id is directly bound to an org-B folder (with and without an explicit per-phase folder_scope referencing it) must block at grounding_fidelity under restrict_org_ids, mirroring the existing skill_ref / per-phase folder_scope cross-org tests already in test_182_publish_org_scope.py."
deferred: []
---

# Phase 182: Server Validation Seam Verification Report

**Phase Goal:** The server exposes a single source of validation truth the canvas can call, reusing the existing lint verbatim so the canvas can never drift from the publish gauntlet it must ultimately pass.
**Verified:** 2026-07-25T15:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — third pass, after round-2 gap-closure plans 182-08 through 182-12 (12/12 plans complete)

## Re-verification Summary

Round 2 (`182-VERIFICATION-round2.md`, preserved alongside this report) found `gaps_found` at
5/6, with a single structured BLOCKER: ROADMAP SC#3 (the flag-off byte-identical 404) failed
because a malformed POST body returned 422 and `GET /openapi.json` advertised both gated routes
plus all five of their models to an anonymous caller. Plans 182-08 through 182-12 exist
specifically to close that gap plus four additional round-2 code-review findings the operator
selected as in-scope (WR-08 double auth, WR-04 folder_scope multiplicity, the WR-01/02/07
fail-honesty trio, and WR-05/WR-06 publish org-scoping).

**Four items genuinely closed, independently re-verified below (source read + live
reproduction, not SUMMARY-trusted):** the round-2 malformed-body leak, the round-2
`/openapi.json` leak, WR-08 (double authentication), and WR-04 (folder_scope multiplicity). All
four hold up under direct source inspection and, where it mattered, live probing.

**However, per this verification's explicit instructions, I did not stop at re-confirming the
round-3 code review's narration (`182-REVIEW.md`, 3 BLOCKER + 9 WARNING) — I re-drove its three
Critical findings against the real application and real production code myself, using fresh,
unmocked imports and standalone probe scripts (not reusing the phase's own test fixtures where
avoidable).** All three are independently confirmed real:

- **CR-01** (SC#3 is not actually closed — a sharper enumeration oracle replaced the one it
  fixed): confirmed with a live 5-method TestClient sweep against a genuinely fresh `app.main.app`
  import (no conftest, no dependency overrides).
- **CR-02 / CR-03** (the "fail-honesty" work is incomplete and, at scale, self-defeating):
  confirmed by direct source read of `get_grounding_bundle` (no `bundle.degraded` branch exists)
  and of `folder_utils.fetch_all_folders` (the truncation-aware read detects but never bounds the
  underlying query).
- **WR-02** (round-3 numbering; the publish org-scope fix never validates the definition's own
  `project_folder_id` binding): confirmed with a live reproduction reusing the shipped test
  suite's own fixtures, but varying the one input (`project_folder_id`) that suite's 16 tests
  never vary.

Where the round-3 code review and the plans' own SUMMARYs disagreed, I read the source myself
and sided with direct evidence in every case (all four disagreements resolved in the review's
favor once independently reproduced — see the `gaps:` entries above for the full evidence
trail, including exact commands and observed output).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `POST /workflows/validate` accepts a `WorkflowDefinition` and returns structural/reachability/tool-whitelist/gate verdicts reusing `reachability.lint_workflow` + grounding-fidelity checks verbatim (SC#1) | VERIFIED (regression-checked) | `backend/app/api/workflows.py:61` imports `lint_workflow`/`LINT_CODES` module-direct from `reachability`; `reachability.py` confirmed still PURE (`grep -c "supabase\|folder_utils\|_skill_registry"` → 0). `validate_workflow` (:494-633) calls `lint_workflow`, `grounding.grounding_verdicts`, `grounding.business_requirement_missing`, `publish_service._interactive_phase_failures` — unchanged in substance since round 2. |
| 2 | The validation route is the SINGLE source of validation truth — no lint rule re-implemented client-side; grounding lists come from a server-provided bundle, never a frontend constant (SC#2) | VERIFIED (regression-checked) | `git diff --name-only 5ebfe993 HEAD -- frontend/` and `git diff --name-only ed80de3b HEAD -- frontend/` both return **zero files** — confirmed no frontend code exists anywhere across the full phase commit range including round 3. |
| 3 | The route is flag-gated behind `visual_workflow_canvas` and returns a byte-identical 404 when the flag is off, for EVERY caller, before any route-existence signal can leak (SC#3, inherits Phase 181's REVERT-01/REVERT-02 HARD gate) | **FAILED** | Independently reproduced via a live 5-method TestClient sweep against a fresh, unmocked app import (flag cold-off, anonymous). The round-2 leaks (malformed-body 422, `/openapi.json` disclosure) ARE genuinely closed. But the two gated paths are the ONLY single-segment `/workflows/<x>` paths that answer 404 for any method — every other single-segment name answers 405 (GET/POST/PUT) or 403 (PATCH/DELETE, via the pre-existing `{definition_id}` PATCH/DELETE routes), never 404. See the `gaps:` entry above for the full transcript and root cause. |
| 4 | The verdict shape is consumable per-node (each verdict maps to a phase/node id) so a later canvas can paint per-node badges from it, INCLUDING every offending phase for a multi-offender definition (SC#4 + round-2 WR-04 multiplicity, closed by 182-04 + 182-10) | VERIFIED | `backend/app/services/harness/scope.py:264-338` — `folder_scope_violations` is a non-raising collector returning one `FolderScopeSubsetError` per offending phase, in author order; `assert_folder_scopes_subset` (:341-383) is a thin re-raise of `violations[0]`, preserving byte-identity for every pre-existing `except ValueError` caller. `grounding.py`'s `_folder_scope_violations` (plural) feeds `grounding_verdicts` one verdict per violation. Independently re-run: `pytest tests/unit/test_182_folder_scope_keying.py -q` — 16/16 passed, including the 3-offender multiplicity test and the mixed-rule composition test. |
| 5 | Phase-goal clause core wiring: publish enforces the SAME grounding-fidelity collector `/validate` previews, positioned before the golden run, fail-closed | VERIFIED (regression-checked) | `backend/app/services/harness/publish_service.py:199-233` — stage 2.6 (`grounding_fidelity`) still calls `_grounding_fidelity_failures`, still positioned before the stage-3 golden-run call (`:235` onward), still blocks via `_block(..., stage="grounding_fidelity", ...)`. Unchanged in structure since round 2; round 3 only added org-scoping and fail-honesty branching on top (see Truths 8-9 below for what's incomplete about those additions). |
| 6 | WR-08 (round-2, double auth) closed: the two canvas routes resolve the caller EXACTLY ONCE per request via a `request.state` hand-off, and the blocking GoTrue read rides `run_in_threadpool` (D-v2.5-01) | VERIFIED | `backend/app/dependencies.py:570-612` (`authenticate_canvas_request`) — `await run_in_threadpool(supabase.auth.get_user, ...)` confirmed by direct read. `:615-685` (`require_canvas._dep`) — publishes `request.state.canvas_caller = caller` (:674-675) after validating, all three success branches `return caller`. `:688-712` (`canvas_caller`) — reads it back, fails closed to the SAME `_NOT_FOUND` (never 500/403/401) when absent. `workflows.py:504`/`:645` — both routes use `Depends(canvas_caller)`, not `Depends(get_current_user)`. Independently re-run: `pytest tests/unit/test_182_canvas_auth.py -q` — 6/6 passed. |
| 7 | The severity classifier fails LOUD on an unrecognised verdict code, and the known-code set — INCLUDING the new `grounding_unavailable` degradation code — is derived from the modules that own the codes, never a duplicated literal (round-2 WR-05-severity, 182-07, extended by 182-11) | VERIFIED | `backend/app/api/workflows.py:441` — `_DEGRADED_CODES = frozenset({grounding.GROUNDING_UNAVAILABLE_CODE})`; `:444-445` — `_KNOWN_CODES` unions `LINT_CODES \| grounding.GROUNDING_VERDICT_CODES \| _ROUTE_ASSIGNED_CODES \| _DEGRADED_CODES`; `:451` — `_ERROR_CODES` still derived by subtraction, no literal on the assignment line. `_severity`'s final branch (:482-491) still logs a warning and returns `"error"` for anything unrecognised. Independently re-run: `pytest tests/unit/test_182_severity_codes.py -q` — 8/8 passed. |
| 8 | `GroundingBundle.degraded` is the ONE degradation signal, and EVERY consumer of the shared grounding collector branches on it identically — an unresolvable registry always says "we could not check", never a false accusation, a silent empty-looking answer, or a 500 (round-2 fail-honesty trio WR-01/02/07, 182-11's own stated must-have) | **FAILED** | Two of the collector's three real consumers do NOT branch on `bundle.degraded`: `GET /workflows/grounding-bundle` (the canvas palette route this phase ships) renders a registry failure as an indistinguishable-from-empty HTTP 200, and NL generation (`workflow_authoring`) does the same on an unbound draft, contradicting its own docstring's disprovable "unchanged by this guard" claim. The truncation-DETECTION mechanism built to support this claim (`folder_utils.fetch_all_folders(strict=True)`) never bounds the underlying unfiltered/unlimited read, so at real production scale (≥ PostgREST's max-rows cap) the "honest degraded" outcome becomes a PERMANENT, deployment-wide outage rather than a rare fallback. See the `gaps:` entry above for full evidence. |
| 9 | Publish's grounding gate is scoped to the DEFINITION's own org, not the publisher's org-membership union — a multi-org author cannot publish an org-A definition referencing an org-B resource merely because the publisher personally belongs to both (round-2 WR-05, 182-12's own stated must-have) | **FAILED** | Closed for the two SECONDARY bindings the shipped suite tests (a phase's `skill_ref`, a phase's per-phase `folder_scope` naming an org-B DESCENDANT of an org-A project root) — both confirmed correctly blocked by source read + passing tests. NOT closed for the PRIMARY binding: `resolve_project_subtree`'s `_walk` unconditionally includes the workflow's own `project_folder_id` in the resolved "allowed" set regardless of whether that root itself is in the org-restricted visible-folder set. Independently reproduced live: a definition bound DIRECTLY to an org-B folder (`project_folder_id=_FOLDER_B`) publishes clean under `restrict_org_ids={_ORG_A}`, both with no per-phase `folder_scope` and with `folder_scope=[_FOLDER_B]` explicitly naming the bound root — using the real production functions and the shipped test suite's own fixtures (which never vary this one input across all 16 of its tests). See the `gaps:` entry above for the full probe transcript. |

**Score:** 6/9 truths verified. Three BLOCKERs confirmed independently this pass (not inherited from the review's narration alone — each was re-driven against live code or a fresh source read).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/middleware/canvas_gate.py` | `CanvasGateMiddleware` (pure-ASGI, path-only gate) + `CANVAS_GATED_PATHS` + `build_canvas_aware_openapi`/`canvas_filtered_openapi` (schema filter, deepcopy, never mutates the FastAPI memo) | VERIFIED (exists, substantive, wired) / **GAP in behavior** | 272 lines, read in full. `BaseHTTPMiddleware` not used (`grep -c` → 0). Registered in `main.py:633` before `MaintenanceMiddleware`/`SetupMiddleware` (confirmed by reading `main.py:590-663`). Genuinely fixes the round-2 leaks; the uniform-404-for-every-method design is itself the SC#3 gap (Truth 3). |
| `backend/app/dependencies.py` | `authenticate_canvas_request` (threadpool-wrapped) + `require_canvas` (publishes `request.state.canvas_caller`) + `canvas_caller` (fails closed to `_NOT_FOUND`) | VERIFIED | Read in full (:570-712). Matches SUMMARY claims exactly — no discrepancy found. |
| `backend/app/services/harness/scope.py` | `folder_scope_violations` (non-raising, multi-offender collector) + `resolve_project_subtree`/`folder_scope_violations` carrying `restrict_org_ids` | VERIFIED (multiplicity) / **GAP** (org-restriction incomplete) | Read in full (383 lines). Multiplicity fix (Truth 4) is solid. The `restrict_org_ids` threading (Truth 9) never validates the walk's OWN root against the restriction — see Truth 9. |
| `backend/app/services/harness/grounding.py` | `GroundingBundle.degraded` + `GROUNDING_UNAVAILABLE_CODE` + `grounding_unavailable_finding` shared by both DB-backed consumers | VERIFIED (mechanism exists) / **GAP** (not consumed by all 3 real consumers) | The signal and shared builder are real and correctly composed into the severity taxonomy (Truth 7). Only 1 of 3 consumers (`validate_workflow`) branches on it — see Truth 8. |
| `backend/app/api/workflows.py` | `validate_workflow` sealed grounding section + `get_grounding_bundle` degraded-aware palette + severity taxonomy composition | VERIFIED (validate_workflow) / **GAP** (get_grounding_bundle) | `validate_workflow` (:566-598) correctly branches on `bundle.degraded` and wraps both DB stages. `get_grounding_bundle` (:641-697) has NO equivalent branch — confirmed by full read. |
| `backend/app/services/harness/publish_service.py` | `_resolve_publish_supabase` returns `(client, org_id)`; stage 2.6 threads `restrict_org_ids={str(org_id)}` into both grounding calls | VERIFIED (wiring) / **GAP** (incomplete restriction, see Truth 9) | `:507` tuple return, `:630-654` both calls scoped. Ordering unchanged (`:199-233`, before golden run at `:235+`). The restriction itself doesn't cover `project_folder_id` — see Truth 9. |
| `backend/app/utils/folder_utils.py` | `FolderReadTruncatedError(RuntimeError)` + `strict=`/`restrict_org_ids=` keyword-only opt-ins, every other caller byte-identical | VERIFIED (detection + byte-identity) / **GAP** (no bound) | Read in full (254 lines). `strict=False` default path unchanged (confirmed). The `strict=True` branch detects but never bounds the read — see Truth 8/CR-03. |
| `backend/tests/test_182_canvas_gate.py` | 7+ falsifiable probes for the non-discoverability battery | VERIFIED (exists, substantive) / defends the wrong contract for one test | 7 tests, all passing. `test_wrong_method_probe_404s_not_405` asserts a contract (404-never-405) that is, per Truth 3, itself the leak — this test would REJECT a fix that closed SC#3 correctly. |
| `backend/tests/unit/test_182_canvas_auth.py`, `tests/unit/test_182_folder_scope_keying.py`, `tests/unit/test_182_grounding_degradation.py`, `tests/unit/test_182_publish_org_scope.py` | Falsification-tested regression suites for WR-08, WR-04, the fail-honesty trio, and publish org-scope respectively | VERIFIED (exist, substantive, all green) | 6 / 16 / 19 / 16 tests respectively, independently re-run — all pass. None of them, however, cover the two specific gaps in Truths 8-9 (confirmed by reading each file for the missing route/case). |
| `.planning/seeds/SEED-130-*.md`, `SEED-131-*.md` | Corrected/narrowed per plans 182-11/182-12 | VERIFIED | Read in full; `SEED-130` no longer asserts "Not a security issue" (`grep -c` → 0), `SEED-131` carries a dated "Partially addressed" section naming what shipped and what remains. Both `status: open`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/main.py` | `app/middleware/canvas_gate.py` | `app.add_middleware(CanvasGateMiddleware)`, registered before Maintenance/Setup | WIRED | Confirmed by reading `main.py:590-663`. |
| `app/main.py` | `app/middleware/canvas_gate.py` | `app.openapi = build_canvas_aware_openapi(app)` | WIRED | `main.py:610`. |
| `app/api/workflows.py` (`validate_workflow`, `get_grounding_bundle`) | `app/dependencies.py` (`canvas_caller`) | `Depends(canvas_caller)` replacing `Depends(get_current_user)` | WIRED | `workflows.py:504`, `:645`. |
| `app/api/workflows.py` (`validate_workflow`) | `app/services/harness/grounding.py` (`grounding_unavailable_finding`, `bundle.degraded`) | the sealed grounding section | WIRED | `workflows.py:566-598`. |
| `app/api/workflows.py` (`get_grounding_bundle`) | `app/services/harness/grounding.py` (`bundle.degraded`) | — | **NOT WIRED** | No reference to `bundle.degraded` anywhere in `get_grounding_bundle` (`workflows.py:641-697`) — this is the CR-02 gap (Truth 8). |
| `app/services/harness/publish_service.py` (`_grounding_fidelity_failures`) | `app/services/harness/grounding.py`/`scope.py` (`restrict_org_ids`) | `restrict_org_ids={str(org_id)}` on both grounding calls | WIRED, but **insufficient alone** | `publish_service.py:638`, `:654`. The link itself is real; the org set it narrows never gates the walk's own root — see Truth 9 / `scope.py:150`. |
| `app/services/harness/scope.py` (`resolve_project_subtree`) | its own `restrict_org_ids`-derived `folders` set | root-membership validation | **NOT WIRED** | `_walk`'s `out = [rid]` (`scope.py:150`) includes the root unconditionally; no code path checks `rid` against the restricted `folders` list on the root call. |
| `app/services/harness/grounding.py` (`assemble_grounding_bundle`) | `app/services/workflow_authoring.py` (NL generation) | `bundle.degraded` | **NOT WIRED** | Confirmed: NL-gen's `_assemble_grounding` call site does not read `degraded`; `grounding.py`'s own docstring claim that its behaviour is "unchanged by this guard" is contradicted by `scope.py`'s no-op-on-unbound behaviour. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `validate_workflow` response `verdicts` | `findings` (list) | `grounding.assemble_grounding_bundle` + `grounding.grounding_verdicts`, real DB reads via `supabase` | Yes, on the happy path; degrades HONESTLY to `grounding_unavailable` on a real read failure | FLOWING |
| `get_grounding_bundle` response `folders`/`skills` | `bundle.folders`/`bundle.skills` | Same `assemble_grounding_bundle` call, real DB reads | Yes on the happy path — but on a read failure, produces `[]` **indistinguishable from real empty data** rather than an honest degraded signal | ⚠️ HOLLOW on failure — the route cannot be distinguished from a genuinely-empty account when its underlying read has actually failed |

Not re-traced for the publish path (`_grounding_fidelity_failures`) — its data flow was independently confirmed via the live cross-org probe (Truth 9), which is a stronger check than a static trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full round-1..3 declared phase-182 test surface (18 files) | `cd backend && venv/Scripts/python.exe -m pytest tests/test_182_extraction_parity.py tests/test_182_grounding_bundle.py tests/unit/test_182_validate.py tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_publish_grounding_stage.py tests/unit/test_182_severity_codes.py tests/unit/test_182_grounding_skill_org_gate.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py tests/unit/test_publish_service.py tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_103_lint_block.py tests/test_182_canvas_gate.py tests/unit/test_182_canvas_auth.py tests/unit/test_182_grounding_degradation.py tests/unit/test_182_publish_org_scope.py -q` | `162 passed` | PASS |
| `test_098_scope_governance.py` + `test_152_folder_override.py` (D1 pre-existing check) | `pytest tests/test_098_scope_governance.py tests/test_152_folder_override.py -q` | `1 failed, 15 passed` — the 1 failure is `test_run_start_resolution`, exactly D1 in `deferred-items.md`, unrelated to any file this round touches | PASS (matches documented pre-existing rot, zero net-new) |
| **CR-01 independent reproduction — live 5-method sweep, fresh unmocked app, flag OFF, anonymous** | Standalone script: fresh `app.main.app` import (no conftest — `app.dependency_overrides == {}` asserted), `us.load_app_settings` monkeypatched to empty `feature_visibility`, `TestClient`, GET/POST/PUT/PATCH/DELETE against `/workflows/validate`, `/workflows/grounding-bundle`, `/workflows/zzzunknown` (single-segment "unbuilt"), `/workflows/__nope__/__nope__` (two-segment) | Gated paths: **404 for all 5 methods, both routes.** Unbuilt single-segment sibling: **405 (GET/POST/PUT), 422 (PATCH — malformed body decode races dependency resolution on the REAL `{definition_id}` route), 403 (DELETE — "Not authenticated")** — never 404. Two-segment sibling: 404 for all 5 (confirms it is the WRONG baseline). | **CONFIRMS GAP** (SC#3 / Truth 3) |
| **WR-02(r3) independent reproduction — live cross-org project_folder_id probe** | Standalone script reusing `test_182_publish_org_scope.py`'s exact fixture shapes (same org/folder ids, same fake supabase), calling the REAL `grounding.grounding_verdicts` with `project_folder_id=_FOLDER_B` (org-B) instead of `_PROJECT_A` (org-A), `restrict_org_ids={_ORG_A}` | Case 1 (no per-phase `folder_scope`): `verdicts == []` (publishes clean). Case 2 (`folder_scope=[_FOLDER_B]`, naming the bound root itself): `verdicts == []` (publishes clean). Control (org-A root, `folder_scope` naming an org-B DESCENDANT): `verdicts == [{'code': 'folder_scope', ...}]` (correctly caught) | **CONFIRMS GAP** (Truth 9) |
| `GET /workflows/grounding-bundle` source read for `bundle.degraded` handling | `Read backend/app/api/workflows.py:641-697` | No `if bundle.degraded` branch found; `GroundingBundleResponse` has no field for it | **CONFIRMS GAP** (Truth 8 / CR-02) |
| `folder_utils.fetch_all_folders(strict=True)` bound check | `Read backend/app/utils/folder_utils.py:36-86` | `.select(fields, count="exact")` at line 71 with no `.limit()`/`.range()`/predicate anywhere in the function | **CONFIRMS GAP** (Truth 8 / CR-03) |
| All 20 commits claimed across plans 182-08 through 182-12 exist | `git cat-file -e <sha>` for each of `da089643 af9f2ed9 526271d8 6febf36a ea0df96d c345293e 21b6d7c7 2724cb5a e6f5f71f ca7081d0 fb2850db 79e91d48 c668e799 fe24dea3 6f45213f 0c383396 b0f19602 9d4f2c9b 75b23bbe b9578929` | 20/20 `OK` | PASS |
| Zero frontend files touched across the full phase commit range | `git diff --name-only 5ebfe993 HEAD -- frontend/` and `... ed80de3b HEAD -- frontend/` | Both empty | PASS |
| Debt-marker sweep across all round-3-touched source files | `grep -n -E "TBD\|FIXME\|XXX"` and `grep -n -i -E "TODO\|HACK\|PLACEHOLDER"` across `canvas_gate.py`, `main.py`, `dependencies.py`, `workflows.py`, `scope.py`, `grounding.py`, `publish_service.py`, `folder_utils.py` | Zero TBD/FIXME/XXX/TODO/HACK; all "placeholder" hits are legitimate domain vocabulary (docx template placeholder fields) | PASS |
| Requirements orphan check | `grep -n "Phase 182" .planning/REQUIREMENTS.md` and `grep -n "^requirements:" .planning/phases/182-server-validation-seam/*-PLAN.md` | Only `VALID-01` appears in REQUIREMENTS.md for Phase 182; all 12 plans declare exactly `[VALID-01]` | PASS (no orphans) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase (backend static-seam phase, no
migration, no CLI/tooling surface) — same disposition as rounds 1 and 2. The standalone
`TestClient`/direct-function probe scripts used for the CR-01 and WR-02(r3) independent
reproductions above were written to the session scratchpad (outside `backend/`, never
committed), per the project's no-scratch-in-watched-tree rule, and are not project-convention
probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| VALID-01 | 182-01..12 | The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side. | SATISFIED at the requirement-text level (unchanged from rounds 1-2) | The route exists, reuses every check verbatim, and no client-side re-implementation exists anywhere (zero frontend files touched). `REQUIREMENTS.md:21,102` marks VALID-01 `[x]` / `Complete`; this verification does not dispute that at the literal-requirement-text level. The gaps above are ROADMAP Success Criterion / plan-level must-have failures (SC#3's byte-identity contract, and two must-haves the round-3 plans themselves declared), tracked separately per this workflow's must-have merge rules. |

No orphaned requirements: every requirement ID declared across all 12 plans' frontmatter
(`VALID-01` only, confirmed by grep) is accounted for, and REQUIREMENTS.md's Phase-182 mapping
names only VALID-01.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/middleware/canvas_gate.py` | 113-135 | Uniform 404-for-every-method gate creates a route-existence enumeration oracle against the router's own pre-existing `{definition_id}` catch-all | **BLOCKER** (SC#3, Truth 3) | See gaps entry — independently confirmed via live 5-method sweep against a fresh app import. |
| `backend/app/api/workflows.py` | 641-697 | `get_grounding_bundle` never branches on `bundle.degraded` | **BLOCKER** (Truth 8) | A registry failure renders as an honest-looking empty palette; independently confirmed via source read and test-coverage gap. |
| `backend/app/utils/folder_utils.py` | 36-86 | Truncation-aware read detects but never bounds the underlying query | **BLOCKER** (Truth 8, contributing) | At real production scale (≥ max-rows), the whole grounding seam and publish permanently blocks; confirmed via source read. |
| `backend/app/services/harness/scope.py` | 140-154 | `resolve_project_subtree`'s `_walk` unconditionally seeds the resolved set with the root, never validated against `restrict_org_ids` | **BLOCKER** (Truth 9) | Independently confirmed via a live cross-org reproduction using the shipped test suite's own fixtures. |
| `backend/tests/test_182_canvas_gate.py` | 128-148 | `test_wrong_method_probe_404s_not_405` asserts a contract that IS the SC#3 leak (round-3 review WR-07) | WARNING | Would reject a correct fix; confirmed by direct read. |
| `backend/app/middleware/canvas_gate.py` | 119 | Matches raw `scope.get("path", "")` rather than `get_route_path(scope)` (round-3 review WR-05) — bypassed under a `root_path`/sub-path mount | WARNING | Not independently re-driven under an actual `root_path` scope this pass (no live ingress in this environment); confirmed present by source read, consistent with the review's finding. Not scored as part of the BLOCKER since it is orthogonal to the CR-01 finding, which reproduces with no `root_path` involved at all. |
| `backend/app/middleware/canvas_gate.py` | 56-66 | `CANVAS_GATED_PATHS` is a hand-maintained duplicate of the route table with no drift guard (round-3 review WR-04) | WARNING | Not independently re-driven this pass (would require adding a new route and observing the leak); read and plausible given the module's own single-source-of-truth framing is aspirational, not mechanically enforced. |
| `backend/app/services/harness/grounding.py` / `publish_service.py` | — | `except Exception` around the `restrict_org_ids`-forwarding calls could swallow a `TypeError` from a future signature drift, converting a programming error into a false `grounding_unavailable` (round-3 review WR-08) | WARNING | Read and plausible; not independently re-driven this pass — narrow, requires a future code change to trigger. |
| `backend/app/utils/folder_utils.py` | 130-146 | `is_in_global_subtree` memoizes only after recursing, so a self-parented/cyclic folder row would `RecursionError` (round-3 review WR-09) | WARNING (pre-existing, not introduced by this phase) | Confirmed via source read (`cache[folder_id] = result` written after the recursive call returns). Predates Phase 182; `scope.py`'s sibling walk has the guard this one lacks. |
| `backend/tests/unit/test_182_publish_org_scope.py` | 734-751 | Whole-file substring scan (`"restrict_org_ids" not in source`) over the 1178-line workflows router (round-3 review WR-06) | WARNING | Confirmed present; a legitimate future org-scoped read elsewhere in the file would fail this test with a misleading message. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file this phase modified
(re-confirmed this pass across all round-3-touched source files).

### Human Verification Required

### 1. Live publish smoke — the org-scoped service-role client on the grounding-fidelity stage

**Test:** With `visual_workflow_canvas` on, create a draft whose one phase declares
`available_tools: ["not_a_real_tool"]`, call `POST /workflows/validate` (expect a red
`unregistered_tool` verdict), then `POST /workflows/{id}/publish` — expect HTTP 200 with
`{published: false, blocked_stage: "grounding_fidelity"}` and NO new row in `workflow_runs`.
Repeat with a clean draft and confirm publish still reaches the golden run.
**Expected:** The block fires exactly as the unit tests predict, against a REAL Supabase
connection (not the patched `_resolve_publish_supabase` seam every unit suite uses, including
this round's new `test_182_publish_org_scope.py`).
**Why human:** Carried forward unchanged from rounds 1-2 (`182-06-SUMMARY.md`'s own
`<human-check>`, still recorded as outstanding). Not something a verifier can execute without a
live local Supabase + an authenticated session.

### 2. Real grounding-bundle content against a live KB, including a multi-org test account

**Test:** With `visual_workflow_canvas` on for a real session, call `GET
/workflows/grounding-bundle` and compare the returned `folders`/`skills`/`tools` against the
actual Supabase KB state for that user, including a multi-org test account with folders shared
into more than one org.
**Expected:** The palette reflects the live DB content exactly — no missing/extra folders or
skills, no cross-org leakage.
**Why human:** Depends on live Supabase KB state and a real authenticated session; carried
forward unchanged from rounds 1-2. **Note for whoever runs this:** given Truth 8/CR-02 above,
this check currently CANNOT distinguish "the KB genuinely has no folders" from "the read
failed" — if the palette ever comes back suspiciously empty during this check, that ambiguity
is the bug, not a false alarm.

### Gaps Summary

**What genuinely closed this round (independently re-verified, not SUMMARY-trusted):**

1. **The round-2 SC#3 leaks are closed.** A malformed POST body to `/workflows/validate` now
   returns the byte-identical 404 (was 422), and `GET /openapi.json` no longer advertises either
   canvas path or any of their five models while off. Both confirmed by direct source read and,
   for the malformed-body case, by my own live reproduction.
2. **WR-08 (double authentication) is closed.** The canvas gate resolves the caller exactly once
   via a `request.state` hand-off, and the blocking GoTrue read rides `run_in_threadpool`.
   Confirmed by direct source read.
3. **WR-04 (folder_scope multiplicity) is closed.** Every out-of-subtree phase now gets its own
   keyed verdict via a genuine non-raising collector, not a re-walk. Confirmed by direct source
   read and 16/16 passing tests including a real 3-offender end-to-end case.

**What is newly, independently confirmed still BROKEN — three BLOCKERs:**

1. **SC#3 is not actually closed.** The round-2 fix replaced a 422-vs-405 oracle with a sharper
   404-vs-405/403/422 one: the two gated routes are the ONLY single-segment `/workflows/<x>`
   paths that answer 404 for any method, because the router's pre-existing `{definition_id}`
   PATCH/DELETE routes shadow every other single-segment name. A live 5-method sweep against a
   fresh, unmocked app confirms this. One shipped test (`test_wrong_method_probe_404s_not_405`)
   actively pins the leaking behaviour as the required contract, which would reject a correct fix.
2. **The fail-honesty trio (WR-01/02/07) is incomplete, and its own truncation-detection
   mechanism creates a new, worse failure mode at scale.** `GET /workflows/grounding-bundle` — a
   route this SAME phase ships — never checks `bundle.degraded`, so a registry read failure now
   renders as a silent, honest-looking empty palette (a genuine regression from pre-round-3
   behaviour, where the same failure was a loud 500). The truncation-aware folders read this
   round built detects but never bounds the underlying query, so at real production scale
   (≥ PostgREST's max-rows cap — a scale this codebase's own comments call reachable) the entire
   grounding seam and publish gate would be permanently, not transiently, blocked.
3. **The publish org-scope fix (WR-05) protects references but not the primary binding.** A
   workflow's own `project_folder_id` is never validated against the org restriction —
   confirmed with a live reproduction using the shipped test suite's own fixtures, varying the
   one input (the project root itself) that suite's 16 tests never vary. A definition bound
   directly to another org's folder publishes clean.

All three were independently re-driven against live code or fresh source reads in this pass —
not accepted from the round-3 code review's narration, and not accepted from any SUMMARY's
claims. Where SUMMARYs claimed a fix was complete ("both consumers branch on it identically",
"a multi-org author can no longer publish... merely because the publisher can see both"),
direct evidence shows each claim is true for the cases the shipped tests exercise and false for
at least one case those tests do not.

This is a well-scoped, well-understood set of gaps — the round-3 code review already sketches
concrete fixes for all three, and the round-2→round-3 progress (4 genuine closures) shows this
gap-closure loop is converging, not stalling. The recommended path is a round-4 gap-closure wave
targeting exactly these three findings, informed by the fixes both this report and
`182-REVIEW.md` already propose.

---

*Verified: 2026-07-25T15:00:00Z*
*Verifier: Claude (gsd-verifier)*

---

## Round-3 gap closure (2026-07-25) — 2 fixed, 1 accepted

Operator-scoped close-out, taken after reviewing the round-3 findings and the fact that the
phase had grown 3 plans → 12 across three fix rounds, with round 3 itself introducing a defect
(the palette regression below). Rather than a fourth gap-closure wave, the operator directed:
fix the two cheap-and-real gaps, and make an explicit DECISION on SC#3.

| Gap | Disposition | Evidence |
|---|---|---|
| **Truth 8a** — `GET /workflows/grounding-bundle` ignores `bundle.degraded`, serving an outage as an empty palette (the regression 182-11 introduced) | **FIXED** — `de0810bd` | `GroundingBundleResponse.degraded` + the same branch `validate_workflow` makes. 6 tests; 4 fail under falsification, healthy control and model-default correctly do not. A partial degradation still serves what resolved. |
| **Truth 8b (CR-03)** — the `strict=True` folders read detects a `max-rows` truncation but never bounds the read, so past the cap every `/validate` and every publish fails permanently | **FIXED** — `844b0b40` | `.range()` pagination, then verify against the count; the raise is kept as last resort so WR-07's fail-closed posture stands. Default path still issues ONE unbounded query. 4 tests fail under falsification, incl. a new guard that the raise path ATTEMPTED pagination. |
| **Truth 8c** — NL generation (`workflow_authoring`) also ignores `degraded`, defended by a disprovable docstring claim | **PARTIALLY CLOSED** — `de0810bd` | The false claim is corrected in place (the ⊆ walk is a no-op on an unbound draft, so it "re-reads" nothing). The consumer wiring itself is planted as **SEED-133** with a Phase-187 re-open trigger. |
| **Truth 9** — publish's org gate never checks the definition's own `project_folder_id`, so an org-A definition bound directly to an org-B folder publishes clean | **FIXED** — `671d61e6` | Under a restriction, a root that did not survive it resolves to `[]` (distinct from `None` = unbound) and `folder_scope_violations` raises it as its own unkeyed violation — required because a definition with no per-phase `folder_scope` gives the subset loop nothing to test. 5 tests; the 2 root cases fail under falsification, all 4 controls stay green. |
| **Truth 3 (SC#3)** — the uniform flag-off 404 is uniquely identifying, because `PATCH/DELETE /workflows/{definition_id}` shadow every other single-segment name | **ACCEPTED RISK** — `e9375312` | Operator decision recorded in `182-DECISION-NOTES.md`; residual + fix sketch + four re-open triggers in **SEED-134**. What leaks is two route NAMES (no data, access, credential or tenant id), and those names go public in Phase 183/184. `test_wrong_method_probe_404s_not_405` is KEPT but annotated — WR-07 was right that it pinned the leak as required, so its docstring now says a correct fix should update the expectation, never be weakened to satisfy it. |

### Test state at close-out

Broad sweep (`-k "folder or grounding or scope or publish or workflow or canvas or depend or main"`):
**385 passed, 12 failed** — the 12 failures are byte-for-byte the pre-existing set, each
independently confirmed against baseline `ed80de3b` this session (D1, D2, and six others proven
by differential with the working tree restored byte-exactly). Baseline was 370 passed / 12
failed; the +15 is this closure's new tests.

One regression WAS introduced and caught inside this closure: the additive `degraded` field
broke three exact-body palette assertions (`test_182_grounding_bundle.py` ×2,
`test_181_flip_on.py` ×1). The third was caught only by the broad sweep, not by the phase-182
suites — worth remembering that the 181 gate test pins the whole palette envelope.

### Standing residuals

- **SEED-133** — NL generation is the one grounding consumer still not branching on `degraded`.
- **SEED-134** — the SC#3 404-uniqueness enumeration. Its rationale does NOT generalize.
- **D1–D4** in `deferred-items.md` — pre-existing test rot, untouched.
