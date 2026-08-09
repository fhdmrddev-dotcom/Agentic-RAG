---
phase: 182-server-validation-seam
plan: 10
subsystem: api
tags: [workflow-validation, grounding, scope-governance, exceptions, one-source-two-presentations, pytest, tdd, falsification]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plan 04)
    provides: "FolderScopeSubsetError.phase_slug — the structural slug channel this plan makes plural"
  - phase: 182-server-validation-seam (plan 08)
    provides: "the current state of tests/unit/test_182_validate.py (wave 1 owned its other edits)"
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: "the owner-scoped, cycle-guarded ⊆ walk (T-098-02) — MOVED here, never duplicated"
provides:
  - "scope.folder_scope_violations — the ONE ⊆ walk, non-raising, returning every offending phase in author order"
  - "scope.assert_folder_scopes_subset — now a thin short-circuit presentation that re-raises violations[0]"
  - "grounding._folder_scope_violations — the plural (message, phase_slug) helper feeding the per-node collector"
  - "grounding_verdicts emits ONE folder_scope verdict per offending phase (WR-04 closed)"
  - "a three-offender end-to-end regression + the repointed collector seams"
affects: [184-editable-canvas-live-validation, 185-graded-governance, 188-run-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One rule, two presentations pushed DOWN a layer: the collector owns the walk, the raiser is a view over it (mirrors grounding.py's own short-circuit-vs-collector split)"
    - "Re-raise the collector's OWN object instead of synthesizing a copy — type/str/args/attribute parity becomes structural rather than asserted"
    - "Counting-fake proof that removing an early exit did not multiply a DB round-trip"
    - "Deferred-review decisions written into the source as a comment, so the next reviewer reads a choice rather than an oversight"

key-files:
  created: []
  modified:
    - backend/app/services/harness/scope.py
    - backend/app/services/harness/grounding.py
    - backend/tests/unit/test_182_folder_scope_keying.py
    - backend/tests/unit/test_182_validate.py

key-decisions:
  - "The ⊆ walk MOVED into folder_scope_violations rather than being copied — assert_folder_scopes_subset now contains three statements and no walk at all (verified by AST, not grep)"
  - "assert_folder_scopes_subset re-raises violations[0] rather than synthesizing a new error: parity of type, str(exc), args and phase_slug holds by construction. Falsification 2 proved no test can currently distinguish the two, which is exactly why the structural form is the right one"
  - "The plural grounding helper keeps the singular helper's broad `except ValueError` — WR-03 (pydantic.ValidationError is a ValueError in Pydantic v2) is deferred and out of this round's operator-selected scope; the decision is recorded in the source"
  - "A raise off the ⊆ path degrades to exactly ONE unkeyed verdict, not N — an infrastructure failure is one finding"
  - "The three collector monkeypatch seams were repointed to folder_scope_violations; _patch_subtree and the Phase-103 seams were deliberately NOT repointed (they patch resolve_project_subtree / exercise the raising presentation on purpose)"

patterns-established:
  - "When a per-node rule short-circuits, fix the MULTIPLICITY at the rule source, not by re-walking one layer up — a collector cannot recover findings the rule never produced"
  - "Author the discriminating test as the task's RED gate so it is observed failing against genuinely pre-change code, then ALSO run the mutation falsification: the two together prove the guard is real and that it is the sole discriminator"

requirements-completed: [VALID-01]

# Metrics
duration: 12min
completed: 2026-07-25
---

# Phase 182 Plan 10: WR-04 — One `folder_scope` Verdict Per Offending Phase Summary

**`grounding_verdicts`' "COLLECTS every violation" promise is now true for all three rules: the ⊆ walk moved into a non-raising `scope.folder_scope_violations` that returns every out-of-subtree phase in author order, with `assert_folder_scopes_subset` reduced to a three-statement short-circuit presentation that re-raises `violations[0]` — so a three-offender definition produces three keyed verdicts for the canvas while every `except ValueError` caller and the NL-gen `detail` string stay byte-identical by construction.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-25T02:41:05Z
- **Completed:** 2026-07-25T02:53:26Z
- **Tasks:** 3 (all TDD — 5 commits)
- **Files modified:** 4 (2 source, 2 test) — exactly the plan's `files_modified` set, no creations, no deletions

## Accomplishments

- **Closed WR-04.** At HEAD, a bound definition with phases `a`, `b`, `c` all declaring an out-of-subtree `folder_scope` produced **one** `folder_scope` verdict keyed to `a`. It now produces **three**, keyed `["a", "b", "c"]`. Phase 184 paints per-node badges from exactly this verdict (VALID-03), so nodes `b` and `c` previously rendered clean and the author rediscovered them one at a time.
- **Fixed it at the RULE SOURCE, which is the only place it could be fixed.** `assert_folder_scopes_subset` `raise`d *inside* its `for phase in definition.phases` loop, so the rule physically could not report more than one offender — no amount of collecting in `grounding.py` could have recovered the others. The walk moved down into `folder_scope_violations`; the raiser is now a view over it.
- **The ⊆ walk was MOVED, not duplicated (D-182-06 red line).** `scope.py` contains the message expression exactly once and `grounding.py` zero times; `grounding.py` never calls `resolve_project_subtree`. `assert_folder_scopes_subset`'s body, extracted via AST with the docstring stripped, is literally three statements: `violations = await folder_scope_violations(...)`, `if violations:`, `raise violations[0]`.
- **Parity is structural, not copied.** The object raised **is** the first violation the collector built, so type, `str(exc)`, `args` and `phase_slug` are identical by construction. `workflow_kickoff`'s HTTP-400 `detail`, `runs.py`'s Continue fallback, `harness_engine`'s resume fallback, `test_098_scope_governance`'s `match="is not a subset"` and the NL-gen short-circuit dict are all unaffected — verified, not assumed.
- **Corrected the overstated docstring.** `grounding.py` claimed all three rules key per node "so Phase 184 can paint a per-node badge from the verdict alone", with no mention that rule 1 painted exactly one badge. That phrase is now gone (grep count 0) and the claim is true as written, with a provenance line naming 182-04 (keying) and WR-04 (multiplicity).
- **Recorded WR-03 as a decision rather than an oversight.** The broad `except ValueError` is preserved verbatim in both helpers with a source comment stating that round-2 review WR-03 argues for narrowing it, that a `pydantic.ValidationError` is a `ValueError` subclass in Pydantic v2, and that WR-03 is deferred and out of this round's operator-selected scope.
- **Test count grew 9 → 16** in `test_182_folder_scope_keying.py` (636 lines); `test_182_validate.py` stayed at 12 (Phase-177 coverage-loss lesson — this was a seam repoint, not a coverage change).

## Task Commits

Each task was TDD (RED then GREEN); Task 3 is a single test-only commit.

1. **Task 1 RED: failing multiplicity guard for the non-raising collector** — `c345293e` (test)
2. **Task 1 GREEN: `folder_scope_violations` + the raising form as its presentation** — `21b6d7c7` (feat)
3. **Task 2 RED: failing WR-04 guard — three offenders must yield three keyed verdicts** — `2724cb5a` (test)
4. **Task 2 GREEN: `grounding_verdicts` emits one verdict per offending phase** — `e6f5f71f` (feat)
5. **Task 3: repoint the three collector seams onto the list form** — `ca7081d0` (test)

No REFACTOR commits — the change is a move plus a delegation; there was nothing left to clean up.

## Files Created/Modified

- `backend/app/services/harness/scope.py` — new `folder_scope_violations` placed immediately above `assert_folder_scopes_subset`, carrying the moved walk (message expression verbatim, `phase_slug=phase.slug` unchanged, subtree resolved once, `[]` for clean and unbound). `assert_folder_scopes_subset` rewritten to three statements. Module-docstring responsibility (2) renamed from the function to the RULE and now names both presentations and which callers take which. `resolve_project_subtree`, `FolderScopeSubsetError` and the folder-override helper untouched; no new import.
- `backend/app/services/harness/grounding.py` — new `_folder_scope_violations` directly below the singular helper (function-local import of `folder_scope_violations`, list comprehension over `(str(exc), getattr(exc, "phase_slug", None))`, one-element degradation list on `ValueError`, WR-03 comment). `grounding_verdicts`' rule-1 branch is now a `for` loop over that helper with the verdict dict literal unchanged in shape and position. `_folder_scope_violation` (singular) and `_check_grounding_fidelity` untouched. Module docstring and the rule-1 comment corrected.
- `backend/tests/unit/test_182_folder_scope_keying.py` — **9 → 16 tests, 636 lines.** New `_multi_phase_definition` / `_three_offenders` builders (the existing `_scoped_definition` left untouched so no current test needed rewriting). New layer 1b (collector returns one violation per offender with hand-written golden messages; one/clean/unbound; subtree resolved exactly once via a counting fake; the raising form reports the first offender only). New collector-level trio: the WR-04 multiplicity guard, its short-circuit counterpart, and the mixed-rule composition/order test. Two seams repointed. Module docstring goes from four layers to five.
- `backend/tests/unit/test_182_validate.py` — **only** the `_raise_subset` seam changed, to a list-returning `_one_subset_violation` patching `folder_scope_violations`; every assertion in `test_folder_scope_verdict_is_keyed_to_the_phase` is unchanged and its docstring now describes the list seam. Nothing else in the file was touched (plan 182-08 owns its other edits).

## Falsification Record

Three observations. All mutations were reverted from a scratchpad backup and verified with `md5sum -c`; `git diff HEAD` on both source files was empty afterwards.

**(0) The natural RED — the strongest of the three.** The multiplicity guard was authored as Task 2's RED gate, so it was observed failing against *genuinely pre-change* `grounding.py`, not against a temporarily-mutated copy:

```
E       assert ['a'] == ['a', 'b', 'c']
E         Right contains 2 more items, first extra item: 'b'
FAILED tests/unit/test_182_folder_scope_keying.py::test_every_out_of_subtree_phase_gets_its_own_keyed_verdict
1 failed, 15 passed
```

Task 1's RED was likewise real: `ImportError: cannot import name 'folder_scope_violations' from 'app.services.harness.scope'` on 3 of the 4 new scope-level tests. The 4th (`test_raising_form_reports_the_first_offender_only`) was green in RED **by design** — it is a parity guard pinning behaviour that must *not* change, the same posture as the pre-existing golden-literal test.

**(a) `grounding_verdicts` mutated to append only the FIRST element** (`(await _folder_scope_violations(...))[:1]`) → exactly **1 failure**, with the identical observed message:

```
>       assert [v["phase"] for v in found] == ["a", "b", "c"], (
            "WR-04 REGRESSION: rule 1 short-circuited again. A definition with three "
E       assert ['a'] == ['a', 'b', 'c']
E         Right contains 2 more items, first extra item: 'b'
```

The load-bearing part of this observation is that **the other 15 tests in the file still passed**. The multiplicity guard is the *sole* discriminator against a first-element-only implementation — nothing else in the suite catches it, which is precisely why it had to be written. Reverted; 16 passed.

**(b) `assert_folder_scopes_subset` mutated to re-synthesize** (`raise FolderScopeSubsetError(str(violations[0]), phase_slug=violations[0].phase_slug)` instead of `raise violations[0]`) → **the byte-identity tests all still passed** (`1 failed, 35 passed`, and that one failure is the pre-existing D1 below, not the mutation). Observed exactly as the plan predicted.

Why re-raising the object is nonetheless the stronger contract, despite being currently indistinguishable: the synthesized form re-establishes parity by *hand-copying two fields*, so it holds only as long as someone keeps copying correctly. It silently loses anything the type gains later — a third attribute on `FolderScopeSubsetError`, a multi-valued `args`, a subclass raised by a future variant of the walk — and no existing test would fail, because no existing test can tell the two apart. Re-raising `violations[0]` makes type, `str(exc)`, `args` and `phase_slug` identical **in one step and by identity**, so the parity survives changes nobody thought to re-assert. Falsification (b) is therefore not evidence the choice is arbitrary; it is evidence that the choice cannot be defended by tests and must be defended by construction.

## Verification Evidence

| Gate | Command | Result |
|---|---|---|
| Task 1 | `pytest tests/test_098_scope_governance.py tests/test_152_folder_override.py tests/unit/test_182_folder_scope_keying.py tests/unit/test_103_grounding_fidelity.py -q` | 30 passed, 1 pre-existing failed (D1) |
| Task 2 | `pytest tests/test_182_extraction_parity.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_103_nl_generate.py tests/unit/test_103_lint_block.py tests/unit/test_182_severity_codes.py -q` | **23 passed** |
| Task 3 | `pytest tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_validate.py -q` | **28 passed** |
| Plan verification (9 files) | the `<verification>` command | 66 passed, 1 pre-existing failed (D1) |
| Phase-182 baseline (9 files) | the combined baseline command | **87 passed, 0 failed** (was 80 — the 7 net-new tests) |
| Caller smoke | `python -c "import app.services.workflow_kickoff, app.api.runs, app.services.harness_engine, app.services.workflow_authoring"` | exit 0 |
| App smoke | `python -c "import app.main"` | exit 0 |
| Adjacent suites | `pytest tests/test_harness_resume.py tests/unit/test_103_draft_crud.py tests/test_182_canvas_gate.py tests/test_181_off_audience.py tests/unit/test_103_tweak_fork.py tests/unit/test_103_published_409.py -q` | **42 passed** |

**Acceptance greps** (all as specified):

| Check | Required | Observed |
|---|---|---|
| `grep -c "async def folder_scope_violations" scope.py` | 1 | 1 |
| `grep -c "is not a subset of the" scope.py` | 1 | 1 |
| `grep -c "raise violations\[0\]" scope.py` | 1 | 1 |
| `grep -c "for phase in definition.phases" scope.py` | 1 in the ⊆ functions | **2 file-wide** — see note below |
| `assert_folder_scopes_subset` body has no walk | yes | AST-verified: references `folder_scope_violations`, no `resolve_project_subtree`, no `folder_scope` attribute read |
| `grep -c "async def _folder_scope_violations" grounding.py` | 1 | 1 |
| `grep -cE "async def _folder_scope_violation\b" grounding.py` | 1 | 1 |
| `grep -c "assert_folder_scopes_subset" grounding.py` | ≥ 1 | 4 |
| `grep -c 'getattr(exc, "phase_slug", None)' grounding.py` | ≥ 2 | 4 |
| `grep -c "re.search\|re.match\|re.findall" grounding.py` | 0 | 0 |
| `grep -c "is not a subset of the" grounding.py` | 0 | 0 |
| `grep -c "resolve_project_subtree" grounding.py` | 0 | 0 |
| `grep -c '"code": "folder_scope"' grounding.py` | 1 | 1 |
| `grep -c "paint a per-node badge from the verdict alone" grounding.py` | 0 | 0 |
| keying test count | ≥ 12 (9 at HEAD) | **16** |
| `grep -c "assert_folder_scopes_subset" keying.py` | ≥ 4 | 21 |
| `grep -c "folder_scope_violations" keying.py` | ≥ 2 | 16 |
| `grep -c "folder_scope_violations" validate.py` | ≥ 1 | 2 |
| exact-list multiplicity assertion | present, not length-only | 2 occurrences of `== ["a", "b", "c"]` |
| keying.py line count | ≥ 330 | 636 |

**Note on the `for phase in definition.phases` count** (the plan asked for this to be recorded): the file-wide count is **2**, at `scope.py:228` and `scope.py:284`. Line 228 is inside `resolve_run_scope_root`, the pre-existing per-run **folder-override** helper — a different rule (it drops an override that would empty a phase's intersection) that this plan does not touch. Line 284 is the new `folder_scope_violations`. Within the two ⊆ functions the count is exactly **1**, as required: `assert_folder_scopes_subset` contains no loop at all.

**Scope containment:** `git show --stat` across all five commits touches exactly the four files in `files_modified` and nothing else. `git diff --diff-filter=D` across the whole plan range reports **zero deletions**. Every file was staged by explicit path — never `git add .` / `-A` — leaving the ~400 unrelated `.claude/` modifications and the 4 pre-existing untracked `backend/` files alone. No scratch `.py` was written anywhere under `backend/`; both falsification mutations were applied to the real files via a heredoc script run from the backend cwd, with scratchpad backups and `md5sum -c` restoration.

## Decisions Made

Two judgement calls beyond the plan's explicit decisions:

1. **The multiplicity guard was authored as Task 2's RED gate rather than in Task 3.** The plan lists it under Task 3's action, but authoring it one task earlier makes it strictly stronger evidence: it was observed failing against *real* pre-change code (`['a']`), not only against a temporarily-mutated implementation. The plan's literal falsification criterion was still executed in Task 3 on top of that, so this adds an observation rather than replacing one. Task 3 kept its other three deliverables (short-circuit counterpart, mixed-rule test, seam repoints) plus both mutation falsifications.
2. **The degradation test gained one assertion.** `test_plain_value_error_degrades_to_an_unkeyed_verdict` previously took `matches[0]` implicitly; it now asserts `len(found) == 1` first. The plan's Task-2 behavior block says a plain `ValueError` "degrades to a SINGLE unkeyed verdict", and with a plural helper that is a genuinely new failure mode worth pinning (an infrastructure failure must not fan out into N per-phase findings). Assertion addition, not a coverage change.

## Deviations from Plan

No code deviations — the plan's changes applied exactly as written. No auto-fixes were required under Rules 1-3 and no Rule 4 architectural question arose. One acceptance-criteria correction is recorded below.

### Acceptance-criteria correction (not a code deviation)

**1. Task 1's "0 failed" gate is unreachable — the true result is 30 passed / 1 pre-existing failed**

- **Found during:** Task 1 verification.
- **Issue:** The criterion assumes `tests/test_098_scope_governance.py` is fully green. `test_run_start_resolution` is **pre-existing rot**, already logged as **D1** in this phase's `deferred-items.md` by plan 182-04: it fails at `harness_engine.py:1532` → `dependencies.py:229` with `ValueError: get_service_role_supabase requires an explicit org_id`, i.e. inside `_build_resume_context`, **before** the `assert_folder_scopes_subset` call at line 1588 this plan's change could possibly reach.
- **Resolution:** Re-proven pre-existing this session by direct differential — the pre-change `scope.py` was restored from `git show HEAD:...` into the working tree (no `git checkout --`, so no index contamination) and the same suite produced the identical `1 failed, 5 passed`; the file was then restored from a scratchpad backup and `md5sum -c` confirmed byte-identity. Not fixed (SCOPE BOUNDARY — unrelated file, and the fix requires a v3.4 org-model decision about what org a resumed run's service-role client assumes). D1's re-open trigger is unchanged.
- **Same correction 182-04 made** for the same criterion on the same suite.

### Transient state between commits (by design, recorded for auditability)

Task 2's GREEN commit (`e6f5f71f`) leaves three tests red — the two seams in `test_182_folder_scope_keying.py` and the one in `test_182_validate.py` that patch the raising form the collector no longer calls. This is inherent to the plan's declared task split (Task 2 owns `grounding.py` only; Task 3 owns the seams), and the plan's Task-2 verify command is deliberately scoped around those two files. The commit message states it explicitly, and Task 3's commit (`ca7081d0`) restores green in the very next commit. Final tree: 87 passed / 0 failed on the phase surface.

## Issues Encountered

- **The pre-existing D1 failure surfaces in this plan's verify command** (see the acceptance-criteria correction). Re-proven pre-existing by differential rather than assumed.
- **Nothing else.** No fix-attempt limit was approached; no out-of-scope discovery was made beyond the already-logged D1. `deferred-items.md` needed no new entry.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-38 (Spoofing — false-clean signal from rule-1 multiplicity) | mitigate | **Closed — the gap this plan exists to fix.** Every offending phase emits its own keyed verdict; pinned by a three-offender end-to-end test through the REAL ⊆ walk and falsified twice (natural RED at `['a']`, plus the first-element-only mutation with the same observed message). |
| T-182-39 (Tampering — a second copy of the ⊆ walk) | mitigate | Held. The walk was MOVED: message expression appears once in `scope.py`, zero times in `grounding.py`; `resolve_project_subtree` is never called from `grounding.py`; `assert_folder_scopes_subset`'s AST-extracted body is three statements with no loop. |
| T-182-40 (Tampering — silent contract break on the `except ValueError` callers) | mitigate | Held **by construction** — the raised object is the collector's own. Verified across `test_098_scope_governance` (5 green), `test_103_grounding_fidelity`, `test_harness_resume`, the extraction-parity short-circuit test, and an import smoke over all four production callers. |
| T-182-41 (Info Disclosure — verdict messages naming folder ids) | accept | Unchanged. The messages list only ids the author declared in their own definition (`outside` is a subset of the declared `folder_scope`), returned to that same author on a route that 404s outside the canvas audience. No new identifier. |
| T-182-42 (Spoofing — broad `except ValueError` renders infra errors as rule findings) | accept | Deliberately unchanged **and now recorded in the source**. WR-03 is deferred and out of this round's operator-selected scope. Residual restated here: a `pydantic.ValidationError` off the ⊆ path would still render as a red `folder_scope` verdict — now as exactly one unkeyed verdict, pinned by an explicit `len(found) == 1` assertion. |
| T-182-43 (DoS — walking every phase instead of stopping at the first) | accept → **pinned** | Stronger than planned. Rather than only reasoning that no DB round-trip was added, a counting fake now proves the subtree is resolved **exactly once** for a three-phase definition (`test_collector_resolves_the_subtree_exactly_once`). The removed early exit costs only in-memory set differences. |
| T-182-SC (package installs) | accept | Zero installs — no `requirements.txt` change, no new import in either source file. |

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data paths were introduced. The `return []` on the unbound branch of `folder_scope_violations` is the semantically correct answer (an unbound workflow has nothing to bound against — the structural `@model_validator` already rejects a phase `folder_scope` there), not a stub.

## Threat Flags

None. No new network endpoint, no auth path, no file access, no schema change, no migration, no frontend file. The change is confined to two backend service modules and their tests, and it strictly *increases* the number of findings the server reports.

## User Setup Required

None — backend-only, no environment variable, migration, seed row, cloud configuration, or package install.

## Next Phase Readiness

- **Phase 184's per-node badges can now be painted from one `/validate` call.** All three grounding rules key per node **and** report every violation, so a definition with several broken nodes lights up completely on the first validate rather than one node per round trip.
- **Phase 185 (graded governance)** adds a per-node `grounding_mode` verdict to this same collector. It inherits a rule-1 branch that is now shape-identical to rules 2 and 3 (a loop appending one keyed dict per finding), so no special-casing is needed, and `test_182_severity_codes.py`'s drift detector will still force the classification decision when the new code is added.
- **Still deferred, deliberately, and now visible in the source:** WR-03 (narrow the `except ValueError` to `FolderScopeSubsetError`). Its re-open trigger is any change to the degradation contract or the next security pass over `/validate`. Note that closing it would also let the plural helper distinguish "the rule found N problems" from "the check itself broke", which is currently only distinguishable by the absent `phase_slug`.
- **Carried forward unchanged:** `deferred-items.md` D1-D4. D1 was re-confirmed pre-existing this session; D2, D3 and D4 were not re-touched.
- Remaining round-2 gap-closure plans in this phase: **11 and 12**.

## Self-Check: PASSED

All 5 claimed files exist on disk (`scope.py`, `grounding.py`, `test_182_folder_scope_keying.py`, `test_182_validate.py`, this SUMMARY) and all 5 claimed commits resolve in `git log --all` (`c345293e`, `21b6d7c7`, `2724cb5a`, `e6f5f71f`, `ca7081d0`). The claimed test counts were independently re-confirmed by both `grep -c` (16 / 12) and `pytest` (28 passed across the two files).

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
