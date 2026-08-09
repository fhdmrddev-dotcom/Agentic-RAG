---
phase: 182-server-validation-seam
plan: 04
subsystem: api
tags: [fastapi, pydantic, workflow-validation, grounding, exceptions, pytest, tdd]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plans 01-03)
    provides: "the ONE shared harness/grounding.py source, grounding_verdicts, the POST /workflows/validate seam + its {ok, verdicts} envelope"
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: "scope.assert_folder_scopes_subset — the owner-scoped, cycle-guarded ⊆ check (T-098-02) reused verbatim, never re-derived"
provides:
  - "scope.FolderScopeSubsetError — a ValueError subclass carrying the offending phase slug on .phase_slug"
  - "grounding._folder_scope_violation returns (message, phase_slug) — the structural slug channel"
  - "the folder_scope verdict is keyed per-node (phase == the offending slug), closing the SC#4 BLOCKER"
  - "backend/tests/unit/test_182_folder_scope_keying.py — the 9-test falsification-proven regression suite"
affects: [184-editable-canvas-live-validation, 185-graded-governance, 188-run-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-exception attribute as a structural data channel (ValueError subclass keeps every existing except-clause working by construction)"
    - "getattr(exc, attr, None) at the consumer so an untyped exception degrades to an unkeyed result instead of raising inside an always-HTTP-200 route"
    - "Golden-literal message assertion (hand-written, never re-derived from source) as the byte-identical-parity guard"
    - "Source-text forbidden-token guard pinning the no-message-parsing red line"

key-files:
  created:
    - backend/tests/unit/test_182_folder_scope_keying.py
    - .planning/phases/182-server-validation-seam/deferred-items.md
  modified:
    - backend/app/services/harness/scope.py
    - backend/app/services/harness/grounding.py
    - backend/tests/unit/test_182_validate.py

key-decisions:
  - "FolderScopeSubsetError subclasses ValueError so all 4 pre-existing except-ValueError callers (workflow_kickoff 400, runs.py Continue, harness_engine resume, test_098) keep working with zero call-site edits"
  - "super().__init__(message) preserves str(exc) and args, keeping the message, the HTTP-400 detail and the {ok, error, detail} short-circuit dict byte-identical"
  - "except ValueError in grounding.py deliberately NOT narrowed to the subclass — the Phase-103/182 test doubles raise a plain ValueError through the same monkeypatch seam"
  - "The slug travels on the exception attribute, never by regexing the message (D-182-06); a source-text guard test pins that no parsing token appears in grounding.py or workflows.py"

patterns-established:
  - "Structural exception channel: when a check's failure is inherently per-node, the node identity rides a typed attribute, not prose"
  - "Falsification-first TDD: the discriminating assertion is proven to FAIL on the pre-change code before the fix lands"

requirements-completed: [VALID-01]

# Metrics
duration: 47min
completed: 2026-07-25
---

# Phase 182 Plan 04: SC#4 Per-Node folder_scope Keying Summary

**The `folder_scope` grounding verdict now carries its offending phase slug in `phase` — threaded structurally off a new `FolderScopeSubsetError(ValueError).phase_slug` instead of being stranded in free-text prose — so all 10 verdict codes satisfy the per-node keying contract with a byte-identical message and zero caller changes.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-07-25T01:49:52Z (phase-start commit `702d6196`)
- **Completed:** 2026-07-25T02:36:00Z
- **Tasks:** 2 (both TDD — 4 commits)
- **Files modified:** 4 (2 source, 2 test) + 1 planning log

## Accomplishments

- **Closed the 182-VERIFICATION SC#4 BLOCKER.** `grounding_verdicts` emitted `{"code": "folder_scope", "phase": None}` for a finding that is inherently per-phase, forcing a canvas consumer to regex the message to attribute it to a node — exactly the client-side re-derivation the D-182-06 red line forbids. `phase` is now the real offending slug.
- **The slug travels STRUCTURALLY, never by parsing.** New `FolderScopeSubsetError` in `scope.py` carries `phase_slug`; `grounding.py` reads it via `getattr`. No regex, no split, no second ⊆ walk — proven by a source-text guard test over both `grounding.py` and `workflows.py`.
- **Zero blast radius by construction.** The new exception is a `ValueError` **subclass** with `super().__init__(message)`, so all four pre-existing `except ValueError` callers (`workflow_kickoff` → HTTP 400, `runs.py` best-effort Continue, `harness_engine` resume fallback, `test_098`'s `pytest.raises`) keep working with no call-site edit and no string change.
- **Falsification-proven regression suite.** 9 tests across 4 layers (scope / caller-compat / collector / degradation + one-source). Every discriminating assertion was observed FAILING on the pre-change code before the fix landed.
- **The test that froze the bug is gone.** `test_folder_scope_verdict_is_workflow_global` (which asserted `phase is None` and pulled the slug out of `verdict.message`) is replaced by `test_folder_scope_verdict_is_keyed_to_the_phase`. Test count in that file is **unchanged at 12** (Phase-177 coverage-loss lesson).

## Task Commits

Each task was committed atomically (both tasks TDD — RED then GREEN):

1. **Task 1 RED: failing test for structural slug threading** — `a1eb057b` (test)
2. **Task 1 GREEN: typed `FolderScopeSubsetError` in `scope.py`** — `8d2700ac` (feat)
3. **Task 2 RED: failing tests for per-node verdict keying** — `265dcfa8` (test)
4. **Task 2 GREEN: thread the slug into the `folder_scope` verdict** — `72f1ffee` (feat)

No REFACTOR commits — the changes were minimal and additive by design; there was nothing to clean up.

## Files Created/Modified

- `backend/app/services/harness/scope.py` — added `FolderScopeSubsetError(ValueError)` (keyword-only `phase_slug`, `super().__init__(message)`); the single `raise` inside `assert_folder_scopes_subset` now raises it with the **same message expression** (both f-string fragments verbatim) plus `phase_slug=phase.slug`. The ⊆ walk, subtree resolution, cycle guard and owner scoping are **untouched** (T-098-02 unchanged). Docstrings name the new type and the structural channel.
- `backend/app/services/harness/grounding.py` — `_folder_scope_violation` returns `tuple[str, str | None] | None` instead of a bare string, reading the slug via `getattr(exc, "phase_slug", None)`; `grounding_verdicts`' Rule-1 branch emits the populated `phase` and the false "workflow-global" comment is replaced with the per-node contract; `_check_grounding_fidelity` passes **only** the message to `_grounding_failed`; module docstring updated to say all three fidelity rules key to a phase slug.
- `backend/tests/unit/test_182_folder_scope_keying.py` — **new, 9 tests / 317 lines.** Scope level (typed raise + `.phase_slug` from the REAL check, golden-literal message parity, `pytest.raises(ValueError, match=...)` compat, clean/unbound no-ops); collector level (the SC#4 guard + an end-to-end variant where only `resolve_project_subtree` is faked so the REAL ⊆ check raises); degradation (plain `ValueError` → `phase: None`, never raises); short-circuit dict parity; and the forbidden-token one-source guard.
- `backend/tests/unit/test_182_validate.py` — `test_folder_scope_verdict_is_workflow_global` → `test_folder_scope_verdict_is_keyed_to_the_phase`; the fake now raises `FolderScopeSubsetError(..., phase_slug="answer")` and the assertion is `verdict.phase == "answer"`. 12 test definitions before and after.
- `.planning/phases/182-server-validation-seam/deferred-items.md` — **new.** Two out-of-scope pre-existing failure clusters, each with a proven differential and a re-open trigger.

## Decisions Made

- **`ValueError` subclass, not a new exception hierarchy.** The plan's own threat register (T-182-11) makes caller compatibility the acceptance gate; subclassing satisfies it *by construction* rather than by auditing four call sites. `super().__init__(message)` preserves `str(exc)` **and** `args`, so `workflow_kickoff`'s `detail=str(err)` and any logging formatter that unpacks `args` are untouched.
- **`except ValueError` deliberately left un-narrowed.** Narrowing to `except FolderScopeSubsetError` would have broken `test_103_grounding_fidelity` and `test_harness_resume`, whose doubles raise a **plain** `ValueError` through the same monkeypatch seam — and would have made any future non-typed ⊆ failure escape into a 500 on a route documented "ALWAYS HTTP 200".
- **Golden-literal message assertion.** The byte-identical guarantee is asserted against a hand-written string, not re-derived from `scope.py`'s f-string. A re-derivation would pass even if the wording drifted, which is precisely the regression it exists to catch. This test was **green before and after** the change — the parity proof.
- **Two docstring rewordings to keep the acceptance greps exact.** Prose mentions of `except ValueError` and `getattr(exc, "phase_slug", None)` initially made those literal grep counts read 2 instead of the pinned 1. Reworded to "the `ValueError` catch below" / "reading the slug through `getattr` with a `None` default" — same meaning, and the acceptance criteria stay literally verifiable by a re-running verifier.

## Deviations from Plan

No auto-fixes were needed — the plan's code changes applied exactly as written. One **acceptance-criteria correction** and two **out-of-scope discoveries** are recorded below.

### Acceptance-criteria correction (not a code deviation)

**1. Task 1's "at least 10 passed" gate is unreachable — the true post-change number is 9**

- **Found during:** Task 1 verification
- **Issue:** The criterion assumed all 6 tests in `tests/test_098_scope_governance.py` were green. One (`test_run_start_resolution`) is **pre-existing rot**: it fails at `harness_engine.py:1532` with `ValueError: get_service_role_supabase requires an explicit org_id` — the v3.4 org hardening (`dependencies.py:228`, D-05) refusing a BYPASSRLS client for a fixture `run` dict that carries no org. The failure occurs **before** the `assert_folder_scopes_subset` call at line 1588, so it is causally unreachable from this plan's change.
- **Resolution:** Proven pre-existing by a direct differential — restoring the phase-start (`702d6196`) copy of `scope.py` reproduces the identical `1 failed, 5 passed`. Not fixed (SCOPE BOUNDARY: unrelated file, and the fix requires an org-model decision). Logged to `deferred-items.md` as **D1**.
- **Actual result:** `tests/unit/test_182_folder_scope_keying.py` + `tests/test_098_scope_governance.py` → **9 passed, 1 pre-existing failed** (4 new + 5 pre-existing-green). Every other Task-1 criterion met exactly.

### Out-of-scope discoveries (logged, not fixed)

**2. `tests/test_dual_mode_wiring.py` — 15 pre-existing failures**

- **Found during:** the post-Task-2 sweep of every test file referencing `folder_scope` / `workflow_kickoff`
- **Issue:** Source-text drift assertions against `api/runs.py`'s cancel/terminal vocabulary, plus the same `_build_resume_context` org_id refusal as D1.
- **Resolution:** Differential against the phase-start source produced an **identical** `15 failed, 82 passed, 1 xfailed` — **zero net-new**. Not fixed; logged to `deferred-items.md` as **D2** with a re-open trigger.

---

**Total deviations:** 0 auto-fixed code deviations; 1 acceptance-criteria correction; 2 out-of-scope pre-existing failure clusters logged.
**Impact on plan:** None on scope — the diff is exactly the 4 files declared in `files_modified`, no deletions, no new dependency, no migration. The one criterion that could not be met literally is a stale assumption in the plan about a suite this change does not touch, disproven by differential rather than assumed.

## Issues Encountered

- **Index contamination from the differential technique.** Establishing pre-existing-vs-caused required temporarily restoring phase-start source via `git checkout 702d6196 -- <files>`, which also **stages** the old blob. Caught by `git status --short` showing `MM` on `scope.py` and corrected by re-`git add`-ing the working-tree version before the next commit; `git diff HEAD` for `scope.py` verified empty afterward. No wrong blob ever reached a commit — the 4-commit diff is exactly 412 insertions / 23 deletions across the 4 intended files.

## Verification

| Gate | Command | Result |
|---|---|---|
| Task 1 | `pytest tests/unit/test_182_folder_scope_keying.py tests/test_098_scope_governance.py -q` | 9 passed, 1 pre-existing failed (D1) |
| Task 1 (seams) | `pytest tests/unit/test_103_grounding_fidelity.py tests/test_harness_resume.py -q` | **19 passed** |
| Task 1 (callers) | `python -c "import app.services.workflow_kickoff, app.api.runs, app.services.harness_engine"` | exit 0 |
| Task 2 | `pytest tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_validate.py tests/test_182_extraction_parity.py tests/unit/test_103_grounding_fidelity.py -q` | **29 passed** |
| Plan verification | the 7-file suite from `<verification>` | **57 passed**, 1 pre-existing failed (D1) |
| Phase-182 baseline (9 files) | the combined baseline command | **54 passed, 0 failed** — count unchanged vs the pre-change baseline |

Grep criteria: `class FolderScopeSubsetError` = 1 (with `(ValueError)`) · `raise ValueError` in `scope.py` = 0 · `phase_slug=phase.slug` = 1 · `"phase": None` in `grounding.py` = 0 · `getattr(exc, "phase_slug", None)` = 1 · `except ValueError` in `grounding.py` = 1 · old test name = 0 · new test name = 1 · `test_182_validate.py` test count = 12 (unchanged) · `assert_folder_scopes_subset` in `backend/app/` = the same 4 production call sites, no new caller, no second ⊆ implementation.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-08 (Tampering/Elevation — the ⊆ check) | mitigate | Held. Only the exception type + one attribute changed; `raise ValueError` count is 0, no second ⊆ walk exists, and `test_098_scope_governance`'s 5 green tests are unchanged. |
| T-182-09 (Info Disclosure — the `phase` field) | accept | Unchanged. The echoed slug is the caller's own request-body value; no server-side row, folder name or tenant identifier crosses the boundary. |
| T-182-10 (DoS — broadened handling) | mitigate | Held and pinned. `except ValueError` un-narrowed + `getattr(..., None)`; `test_plain_value_error_degrades_to_an_unkeyed_verdict` proves a plain `ValueError` yields `phase: None` and never raises. |
| T-182-11 (Repudiation/Tampering — the 3 production callers) | mitigate | Held. `ValueError` subclass + import smoke-check + the 098 suite + `test_existing_value_error_callers_still_catch_it`. |
| T-182-SC (package installs) | accept | Zero installs — no `requirements.txt` change. |

No new threat surface introduced: no route, no schema, no auth path, no file access.

## User Setup Required

None — backend-only, no migration, no env var, no external service, no package install.

## Next Phase Readiness

- **SC#4 is satisfied for all 10 verdict codes.** Phase 184 can paint per-node badges from the verdict alone, with no message parsing anywhere in the client. The forbidden-token guard test will fail loudly if a future edit reaches for the slug by regex.
- **Phase 185 (graded governance)** inherits a `folder_scope` verdict that is now shape-consistent with `unregistered_tool` / `unregistered_skill`, so adding a per-node `grounding_mode` verdict needs no special-casing.
- **Still open from 182-VERIFICATION (NOT this plan's scope):** the publish-enforcement gap (Truth 5 / WR-01 — `publish_workflow`, `create_draft` and `update_draft` never call the grounding-fidelity checks `/validate` previews). Plan 182-05 addresses it.
- **Carried forward:** `deferred-items.md` D1 + D2 — pre-existing `_build_resume_context` org_id rot and `test_dual_mode_wiring` source drift, both with re-open triggers.

## Self-Check: PASSED

All 6 claimed files exist on disk; all 5 claimed commit hashes resolve in `git log`. The
new suite's claimed 9 tests independently confirmed (`grep -c` = 9, `pytest` = 9 passed).
`test_182_validate.py` test count re-confirmed at 12. No missing artifacts.

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
