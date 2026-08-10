---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 03
subsystem: backend/api-validate
tags: [vocab-02, d-187-11, bug-260731-03, validate, grounding, zero-migration, tdd]
requires:
  - "grounding.grounding_cause / KB_TOOLS (Phase 185, D-185-09) — the ONE KB-tool intersection home"
  - "the /validate severity taxonomy (Phase 182, D-182-03): _ROUTE_ASSIGNED_CODES + the DERIVED _ERROR_CODES"
  - "ValidateResponse.ok == (verdicts == []) — an incomplete-only set still blocks (Phase 182)"
  - "blockedReason (WorkflowBuilderPage.tsx:1093-1102) — the canvas publish seam, unmodified"
provides:
  - "the `unbound_retrieval` incomplete verdict — one per unbound KB-reading phase, from POST /workflows/validate"
  - "its two registrations (_ROUTE_ASSIGNED_CODES + _INCOMPLETE_CODES) and their exact-set guards"
  - "a canvas-only boundary assertion: the code is in NEITHER owning module's published set"
  - "the BUG-260731-03 verdict-half touchpoint record"
affects:
  - "187 UAT — the canvas must be observed painting this verdict and blocking Publish (G-4)"
  - "BUG-260731-03 — may flip to closed only when BOTH halves are live-verified"
tech-stack:
  added: []
  patterns:
    - "route-minted verdict: canvas-only, never through the publish-shared grounding collector"
    - "pure/registry-free checks live OUTSIDE the sealed grounding try/except"
    - "one home per rule — call grounding_cause, never a local KB-tool literal"
    - "exact-set (==) literal guards on code vocabularies, never issubset"
key-files:
  created: []
  modified:
    - backend/app/api/workflows.py
    - backend/tests/unit/test_182_validate.py
    - backend/tests/unit/test_182_severity_codes.py
    - .planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md
decisions:
  - "D-187-11 implemented in the ROUTE, not grounding.grounding_verdicts — publish blast radius"
  - "The canvas-only property is now a TEST, not a comment: unbound_retrieval must be absent from LINT_CODES and GROUNDING_VERDICT_CODES"
  - "The shipped clean-definition fixture was BOUND rather than de-toothed — it carries search_documents, so leaving it unbound would have asserted that an unbound retrieval workflow is publishable-now"
  - "BUG-260731-03 stays `folded`; verified_closed_by stays null — neither half has a live confirmation"
metrics:
  duration: ~40 min
  tasks: 3
  commits: 4
  completed: 2026-08-02
---

# Phase 187 Plan 03: The unbound-retrieval verdict — Summary

`POST /workflows/validate` now returns a deterministic per-node `incomplete` verdict when a step
reads the knowledge base while the workflow is bound to no folder — so an unbound retrieval workflow
is caught on the canvas at edit time instead of by a probabilistic judge after a golden run.

## What Was Built

**Task 1 — the verdict (`3727b006` RED → `a68132db` GREEN).** A new stage (5) in
`validate_workflow`, placed beside the `business_requirement` and `interactive_phase` mints and
**outside** the sealed grounding `try/except` (it needs no registry and cannot fail, so a registry
blip must not cost the author this finding). The predicate is
`body.project_folder_id is None` **and** `grounding.grounding_cause(phase) == "detected"`, evaluated
per phase — one verdict per offending node, keyed to `phase.slug`. The message states a fact and its
consequence and nothing else: *"phase 'X' reads your documents, but this workflow is not bound to a
knowledge base — it would search everything."* No "unsafe", no "blocked". The code is registered in
**both** `_ROUTE_ASSIGNED_CODES` (so `_KNOWN_CODES` contains it) and `_INCOMPLETE_CODES` (so the
DERIVED `_ERROR_CODES` does not claim it by subtraction).

**Task 2 — the scanner's pinned literals (`555fbf35`).** `test_182_severity_codes.py`'s
code→severity table gains `unbound_retrieval → incomplete` in **both** `phases_empty` arms, the
canvas-only boundary is asserted directly (in `_ROUTE_ASSIGNED_CODES`, in neither
`reachability.LINT_CODES` nor `grounding.GROUNDING_VERDICT_CODES`), and a `caplog` registration test
proves the code does not reach the fail-loud unknown branch.

**Task 3 — the folded-bug record (`7ef69454`).** `BUG-260731-03` gains `backend/api/validate` to
`affected_areas` and a dated `## UPDATE 2026-08-02 — the VERDICT half…` section. `status` stays
`folded` and `verified_closed_by` stays `null`.

## Measured Baselines (captured at HEAD before editing)

| Measurement | HEAD | After |
|---|---|---|
| `test_182_validate.py` count | **12** | **18** (strictly greater) |
| `test_182_severity_codes.py` count | **8** | **9** (strictly greater) |
| `grep -n "unbound_retrieval" backend/app/api/workflows.py` | 0 | **5** — 1 docblock, 1 comment, 2 registrations, **1 emit site** |
| `grep -n "search_documents\|KB_TOOLS" …/workflows.py` | 0 | **1**, a comment naming `KB_TOOLS`'s docblock — **no tool literal** |
| `grep -c "unbound_retrieval" …/harness/grounding.py` | 0 | **0** (publish's shared collector untouched) |
| `grep -c "unbound_retrieval" test_182_severity_codes.py` | 0 | **14** (criterion: ≥ 3) |
| `test_182_publish_grounding_stage.py` | green | green, count unchanged |
| backend collection | 3517 (post-187-02) | **3523** (+6 net-new) |
| `git diff --stat -- supabase/migrations` | empty | **empty** |

## TDD Gate Compliance

Task 1 observed RED before GREEN, as separate commits.

- **RED (`3727b006`):** 4 failed / 14 passed. The four net-new behaviours failed —
  per-node verdict, plural keying, the `KB_TOOLS` one-home proof, and `_severity`'s classification
  (which failed loudly as `error`, logging the WR-05 warning, exactly as an unregistered code must).
- The two *negative* guards (a bound workflow, a workflow that reads nothing) passed on both sides
  by construction — they assert an absence. Recorded rather than dressed up as coverage.
- **GREEN (`a68132db`):** 18 passed.

Gate sequence in `git log`: `test(187-03)` → `feat(187-03)` → `test(187-03)` → `docs(187-03)`. No
REFACTOR commit; none was needed.

## Deviations from Plan

**1. [Rule 3 — blocking issue] One of Task 2's two literal moves was pulled into Task 1's GREEN
commit.**

- **Found during:** Task 1 GREEN.
- **Issue:** The plan splits the code change (Task 1) from the severity scanner's literal
  expectations (Task 2), *and* Task 2's own action text states those literals "must move in the same
  commit as the new code, or the suite goes red". Both cannot hold under per-task commits: after the
  GREEN commit, `test_owning_modules_publish_their_canonical_code_sets`'s exact-set assertion on
  `_ROUTE_ASSIGNED_CODES` fails, so the tree would carry a knowingly-red commit.
- **Fix:** Moved *only* the assertion required to keep the tree green — the literal
  `_ROUTE_ASSIGNED_CODES` set (Task 2's item **a**) — into the GREEN commit. Item **b** (the
  code→severity table), the canvas-only boundary assertion and the new `caplog` test all stayed in
  Task 2, which remains substantive (8 → 9 tests, 14 occurrences of the code).
- **Why the split is at that exact line:** item (a) is the *registration's* mirror and its absence
  makes the suite red; item (b) is a *taxonomy decision* and its absence makes the suite pass with a
  gap. Only the first is a blocking issue.
- **Files modified:** `backend/tests/unit/test_182_severity_codes.py` (commits `a68132db`, `555fbf35`).
- **No assertion was weakened.** `==` is preserved in
  `test_owning_modules_publish_their_canonical_code_sets`; the only `<=` in the file is the
  pre-existing `owned <= _KNOWN_CODES` on a different claim.

**2. [Rule 1 — bug] The shipped clean-definition fixture would have asserted the defect.**

- **Found during:** Task 1 RED.
- **Issue:** `test_clean_definition_is_ok_with_no_verdicts` builds an **unbound** workflow whose one
  phase carries `search_documents`. That is precisely `BUG-260731-03`'s shape. Left as-is it would
  have asserted `verdicts == []` for an unbound retrieval workflow — i.e. pinned the bug.
- **Fix:** the fixture is now **bound** (`project_folder_id=_PROJECT`) rather than having its tools
  removed, so it still exercises the registered-tool path and now means "clean on **every** rule".
- **Consequence:** a bound definition resolves the project subtree for real against
  `supabase=object()`, so a `_patch_scope_clean` helper stubs the ONE ⊆ walk — the same seam and the
  same monkeypatch posture `test_folder_scope_verdict_is_keyed_to_the_phase` already uses.
- **Files modified:** `backend/tests/unit/test_182_validate.py`. **Commit:** `3727b006`.

**3. [beyond the plan's five behaviours] A sixth test: the one-home property, falsifiably.**
The plan's acceptance criteria check the *absence* of a KB-tool literal by `grep`. A grep cannot fail
if someone later inlines the set under a different spelling. `test_the_unbound_check_reuses_the_one_
kb_intersection_home` monkeypatches a sixth name into `grounding.KB_TOOLS` and asserts the verdict
appears for a phase carrying only that name — impossible if `workflows.py` held its own copy. This is
T-187-03-03 stated as a property rather than as a patch check (the Phase-185 T-185-04-01 lesson).

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-03-01 (Info disclosure — unbound retrieval reaching a golden run) | mitigated | The verdict fires per offending node with `ok: false`; `blockedReason` (measured at `WorkflowBuilderPage.tsx:1093-1102`) returns a non-null reason for any `ok: false`, including an `incomplete`-only set. **UI half not live-verified** — see Known Gaps. |
| T-187-03-02 (Tampering — severity classification) | mitigated | Registered in both sets; `test_182_severity_codes.py` holds exact-set literals plus a `caplog` proof that the fail-loud branch is not taken. A code registered in only one set would return `error` *silently* — the log assertion is what distinguishes the two. |
| T-187-03-03 (Tampering — a second KB-tool source of truth) | mitigated, **strengthened** | `grep` shows no tool literal, **and** the `KB_TOOLS` monkeypatch test proves the derivation is live rather than copied. |
| T-187-03-04 (DoS — publish path) | mitigated | `grep -c "unbound_retrieval" grounding.py` → **0**. `test_182_publish_grounding_stage.py`, `test_182_publish_org_scope.py` and `test_182_grounding_skill_org_gate.py` all green with unchanged counts. |
| T-187-03-05 (Repudiation — the folded record) | mitigated | `status: folded`, `verified_closed_by: null`; the new section states in its own subsection what is *not* verified. |

## Known Gaps (not stubs — scope boundaries stated so UAT does not rediscover them)

- **No live browser run.** The canvas painting this verdict, and the Publish button blocking on it,
  are proven by unit tests against the route handler plus a *reading* of shipped `blockedReason`
  source. G-4 lived-experience UAT owes the observation.
- **Flag-gated reachability.** `blockedReason` is gated on `canvasEnabled` **and**
  `builderPhase === "drafted"`. With `visual_workflow_canvas` off, D-181-01's revert-switch
  byte-identity holds and this verdict reaches no UI — the same caveat 186 recorded for the re-bind
  control. No new code path was added to change that.
- **No frontend work in this plan.** Nothing renders the code by name; it rides the existing verdict
  envelope and the existing problems tray.

## Out-of-Scope Test Rot (NOT fixed — pre-existing, does not touch this surface)

`pytest tests/unit -q` reports **70 failures / 1684 passed**. Verified out of scope:
none of the 18 failing files import `app.api.workflows` (checked by grep). They split into

- **8 in `test_187_armed_checkpoint_property.py`** — plan **187-01**'s deliberate RED-on-HEAD SC#6
  falsification harness. Expected red until the SC#6 implementation plan lands.
- **62 across `test_retrieval_service.py`, `test_sql_service.py`, `test_explorer_agent.py`,
  `test_multimodal_query.py`, `test_sandbox_service.py`, `test_lifespan.py`, `test_db_runs.py` and
  10 others** — the documented pre-existing backend rot. Untouched.

Every `test_182_*` file is green.

## Notes for Later Plans

- **`grounding_cause` returns three truthy values**, and this check tests for `"detected"` **only**.
  `"already-set"` (a `citation_policy: strict` step) and `"escalated"` (an author's one-way lock) do
  not imply the step reads the KB — an `llm_single` can be escalated and reads nothing. Any later
  widening is a product decision, not a tidy-up.
- **The message is the canvas's publish-block sentence.** `blockedReason` renders the first verdict's
  `message` **verbatim**, ordering `error` findings ahead of `incomplete` ones. So on a draft whose
  only problem is an unbound retrieval step, this exact string is what the author reads next to a
  disabled Publish button. Rewording it is a UX change, not a copy edit.
- **D-187-12's deferred hole is untouched and still open.** `_interactive_phase_failures` reads the
  raw definition, so an armed phase still publishes past the pre-run fence. Its cheap fix (adding
  `action_risk_armed` there) would be picked up by `/validate` for free — through stage (4), not this
  new stage (5).

## Verification

```
pytest tests/unit/test_182_validate.py tests/unit/test_182_severity_codes.py \
       tests/unit/test_182_publish_grounding_stage.py tests/unit/test_182_canvas_auth.py -q
→ 40 passed

pytest tests/unit/test_182_grounding_degradation.py tests/unit/test_182_folder_scope_keying.py \
       tests/unit/test_182_publish_org_scope.py tests/unit/test_182_grounding_skill_org_gate.py \
       tests/test_182_extraction_parity.py tests/test_182_canvas_gate.py \
       tests/test_revert_byte_identical.py tests/test_184_uat02_staleness_bound.py -q
→ 101 passed

pytest tests/ -q --collect-only        → 3523 tests collected
git diff --stat -- supabase/migrations → empty
grep -E "^status:" …BUG-260731-03….md  → status: folded
```

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 (RED) | `3727b006` | `test(187-03): add failing tests for the unbound-retrieval /validate verdict` |
| 1 (GREEN) | `a68132db` | `feat(187-03): mint the unbound_retrieval incomplete verdict in POST /workflows/validate` |
| 2 | `555fbf35` | `test(187-03): pin unbound_retrieval in the severity scanner's literal tables` |
| 3 | `7ef69454` | `docs(187-03): record the VERDICT half on BUG-260731-03 at the plan-phase touchpoint` |

## Self-Check: PASSED

All four modified files exist on disk; all four claimed commits resolve in `git log`.
</content>
</invoke>
