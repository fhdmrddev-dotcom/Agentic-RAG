---
phase: 182-server-validation-seam
plan: 11
subsystem: api
tags: [workflow-validation, grounding, fail-honesty, degradation, postgrest, truncation, always-200, pytest, tdd, falsification]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plan 06)
    provides: "publish stage 2.6 — the fail-closed grounding wrapper this plan gave a second, honest branch"
  - phase: 182-server-validation-seam (plan 07)
    provides: "the composed severity taxonomy + the fail-loud unknown branch the new code is composed into"
  - phase: 182-server-validation-seam (plan 09)
    provides: "the current shape of api/workflows.py (Depends(canvas_caller) on both canvas handlers)"
  - phase: 182-server-validation-seam (plan 10)
    provides: "scope.folder_scope_violations + grounding._folder_scope_violations — the collector shape this plan degrades AROUND rather than through"
provides:
  - "folder_utils.FolderReadTruncatedError + an opt-in strict, count-checked folders read (every existing caller byte-identical)"
  - "GroundingBundle.degraded — the ONE degradation signal both consumers branch on"
  - "grounding.GROUNDING_UNAVAILABLE_CODE + grounding.grounding_unavailable_finding — one code string, one message, two consumers"
  - "a SEALED /validate grounding section: HTTP 200 with an honest degraded verdict, never a 500"
  - "workflows._DEGRADED_CODES — the code composed into the severity taxonomy, classifying error by derivation"
  - "tests/unit/test_182_grounding_degradation.py — 19 failure-injection tests, all observed failing pre-fix"
affects: [184-editable-canvas-live-validation, 185-graded-governance, 189-governed-external-action-node-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A fail-closed swallow belongs at the layer that can DESCRIBE the failure, not at the layer that suffers it — an invisible degradation becomes a false accusation one layer up"
    - "One degradation signal on the shared value object; every consumer branches on it identically, so there is no second copy of the decision and no second message"
    - "Seal the I/O stages, not the handler — a blanket try/except would discard results that computed perfectly well, and a blanket except returning ok:true is WORSE than the 500 it replaces"
    - "Opt-in strictness on a shared helper (keyword-only, default False) so a gating caller can be paranoid without taxing the hot path"
    - "Choose an exception BASE CLASS against the catches upstream of it — RuntimeError not ValueError, so the rule's broad catch cannot re-dress infrastructure as a finding"
    - "When a source scanner is structurally blind to a symbol, pin the link it cannot see with an explicit assertion rather than leaving a loophole"

key-files:
  created:
    - backend/tests/unit/test_182_grounding_degradation.py
  modified:
    - backend/app/utils/folder_utils.py
    - backend/app/services/harness/grounding.py
    - backend/app/api/workflows.py
    - backend/app/services/harness/publish_service.py
    - backend/tests/unit/test_182_grounding_skill_org_gate.py
    - backend/tests/unit/test_182_severity_codes.py
    - .planning/seeds/SEED-131-validate-always-200-invariant-unsealed.md

key-decisions:
  - "The degradation travels on GroundingBundle.degraded rather than by propagating the raise to each consumer: propagation would have given /validate and publish two independent chances to describe the same failure differently, which is the drift this seam exists to prevent"
  - "FolderReadTruncatedError subclasses RuntimeError, NOT ValueError — pinned by a test. The subset rule's broad except ValueError would otherwise catch a truncation and render it as folder_scope, re-creating the exact false accusation one layer down (T-182-47)"
  - "strict is keyword-only with a default of False, so all nine existing fetch_visible_folders / fetch_all_folders call sites are byte-identical BY CONSTRUCTION; only the grounding gate opts in and only it pays a COUNT(*)"
  - "The no-arg grounding_unavailable_finding() message is publish's pre-existing wording VERBATIM, so publish's resolution-failure message is unchanged on the wire; only the new degraded branch introduces new prose"
  - "The degraded code is built from GROUNDING_UNAVAILABLE_CODE, never a quoted literal, because the severity drift scanner would otherwise demand it join GROUNDING_VERDICT_CODES — which grounding_verdicts does not emit. The scanner's blind spot is covered by an explicit constant-to-classifier assertion instead"
  - "Tests invalidated by a task's source change were updated IN THAT TASK'S COMMIT rather than deferred to Task 3, so no commit in this plan leaves the suite red"
  - "Two end-to-end tests were added beyond the plan's list, driving the REAL registry read: the plan's synthetic-bundle tests isolate the consumer branch but structurally cannot observe the swallow that caused WR-01, so falsification (a) could not have reached them"

patterns-established:
  - "A verdict that says 'your definition is wrong' must be traceable to a check that actually RAN — when the check could not run, the honest verdict names the check, not the definition"
  - "Falsify a fail-honesty fix by restoring the original swallow and recording the exact false verdict dict the author would have seen"

requirements-completed: [VALID-01]

# Metrics
duration: 28min
completed: 2026-07-25
---

# Phase 182 Plan 11: The Fail-Honesty Trio — WR-01, WR-02, WR-07 Summary

**An unresolvable grounding registry now says "we could not CHECK" on both sides of the shared collector instead of manufacturing a specific, false accusation against a correct definition: `_skill_registry`'s invisible swallow moved up to `assemble_grounding_bundle` and became `GroundingBundle.degraded`, `/validate`'s two DB-backed stages are sealed so a `postgrest` `APIError` returns a structured 200 instead of a 500, and the unbounded `folders` read is truncation-aware at the two gate call sites so a `max-rows` prefix degrades honestly rather than fabricating a publish-blocking `folder_scope` violation.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-07-25T02:56:31Z (phase HEAD `c3084272`)
- **Completed:** 2026-07-25T03:24:00Z
- **Tasks:** 3 (all TDD — 5 commits: RED / GREEN / RED / GREEN / test)
- **Files:** 8 (1 created, 7 modified) — exactly the plan's `files_modified` set, no extras, no deletions

## Accomplishments

- **Closed WR-01 on BOTH consumers.** `_skill_registry`'s `except Exception: return []` sat *inside* `assemble_grounding_bundle`, so a PostgREST 5xx produced `skills = []`, `skill_ids = set()` and a bundle that returned **successfully**. Publish stage 2.6's `try` never fired; the collector ran against nothing; every membership test came back vacuously false. The observed pre-fix verdict, captured live during falsification, was `{'code': 'unregistered_skill', 'phase': 'answer', 'message': "phase 'answer' references a non-registered skill_ref '3333…3333'", 'severity': 'error'}` — the author's own valid id, called non-existent because a read returned 503. Both consumers now emit `grounding_unavailable` instead.
- **Closed WR-02 — `/validate` is sealed for its two grounding I/O stages.** A non-`ValueError` `APIError`-shaped raise from either the palette read or the ⊆ walk previously escaped the handler (proven again this session: the injected exception propagated out of `validate_workflow` in falsification (b)). Both stages are now wrapped and degrade to HTTP 200 with a structured verdict. The route Phase 184 calls on every canvas edit can no longer 500 on a registry blip.
- **Closed WR-07 — the folders read is truncation-aware where it GATES.** `fetch_all_folders` / `fetch_visible_folders` gained a keyword-only `strict=False`; `strict=True` asks PostgREST for an exact count and raises `FolderReadTruncatedError` on a short read. Falsification (c) — dropping that one keyword — reproduced the false accusation exactly: `assert 'folder_scope' not in {'folder_scope'}`.
- **The three fixes share ONE mechanism, as the plan required.** `GroundingBundle.degraded` is the only degradation decision; `grounding.grounding_unavailable_finding` is the only message builder; `grounding.GROUNDING_UNAVAILABLE_CODE` is the only place the string exists. Verified by grep: **0** occurrences of the code literal in `workflows.py`, **0** `"code": "grounding_unavailable"` in `publish_service.py` (its local dict is gone), and **0** in `grounding.py` (built from the constant, to dodge the drift scanner's trap).
- **The code classifies `error` BY DERIVATION, not by assertion.** `_DEGRADED_CODES` widens `_KNOWN_CODES`; `_ERROR_CODES` is still `_KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES` with no literal on its assignment line. Adding the code without adding it to `_INCOMPLETE_CODES` puts it in the error bucket automatically — "we could not verify" can never paint the soft `incomplete`.
- **The seal is SCOPED and the pure checks survive it.** `lint_workflow`, the D-13 business-requirement invariant and the interactive-phase check moved outside the `try`, pinned by a test that drives a definition which is *both* structurally broken and grounding-degraded and asserts `{bad_index, orphan_phase, no_terminal, business_requirement, grounding_unavailable}` all appear. A registry blip costs the author three rules, not the whole validation.
- **Corrected two false claims in the source.** `publish_service`'s docstring said this stage took "the same fail-closed posture `grounding._skill_registry` already takes" (grep count now **0**) — the swallow was *invisible* to that wrapper, which is the whole finding. `workflows.py`'s taxonomy comment said the degraded code "cannot reach this classifier"; it now does, deliberately. The seam header's parity table gained the sentence WR-02 showed was missing: the two sides share the same **failure posture**, not just the same rules.
- **SEED-131 narrowed, not closed.** Still `status: open` with all 4 `re_open_triggers` intact; a dated section records exactly what shipped and exactly what Phase 184 still owns. The 6 `confirmed` entries this plan falsifies are marked `[SUPERSEDED by plan 182-11]` with their post-fix state, so a future reader is not chasing a fixed condition. Frontmatter re-verified to parse as strict YAML (deferred item D3 counts 29 seeds that do not — this is not one of them).

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Task 1 RED — failing degradation guards (WR-01 + WR-07) | `fb2850db` | test |
| 2 | Task 1 GREEN — one degradation signal on the bundle | `79e91d48` | feat |
| 3 | Task 2 RED — failing consumer guards (WR-01 / WR-02 / WR-07) | `c668e799` | test |
| 4 | Task 2 GREEN — both consumers report "could not check" | `fe24dea3` | feat |
| 5 | Task 3 — end-to-end WR-01 proofs + SEED-131 narrowing | `6f45213f` | test |

No REFACTOR commits — each change is a move plus a branch; nothing was left to clean up.

## Files Created/Modified

- **`backend/app/utils/folder_utils.py`** (+82/-4) — new module logger; new `FolderReadTruncatedError(RuntimeError)` whose docstring states the WR-07 chain (prefix → shrunken `folder_map` → shrunken subtree → false `folder_scope` → publish block) and states *why* it is a `RuntimeError`. `fetch_all_folders` gained keyword-only `strict=False` with an early non-strict branch that issues the byte-identical query; the strict branch adds `count="exact"`, reads `getattr(resp, "count", None)`, and only raises when `isinstance(total, int) and total > len(rows)`. `fetch_visible_folders` threads `strict` through; its positional signature, return type and visibility rule are untouched. `_resolve_caller_org_ids`, `is_in_global_subtree`, `_null_foreign_global_owner` and `get_globally_visible_folder_ids` are unchanged.
- **`backend/app/services/harness/grounding.py`** (+140/-26) — `GroundingBundle.degraded: frozenset[str] = frozenset()` declared last, with the consumer contract written above it. `_skill_registry`'s `try/except` removed (the `coerce_uid` calls stay exactly where they were); its docstring now explains that the fail-closed decision MOVED rather than vanished, and names the identity-path consequence. `assemble_grounding_bundle` builds a local `degraded` set, guards the `fetch_visible_folders(..., strict=True)` call and the `_resolve_caller_org_ids` + `run_in_threadpool(_skill_registry, ...)` pair (re-using the *same* warning text so the operational signal is unchanged), and passes `degraded=frozenset(...)`. A comment above the folders call records why `strict=True` here covers the later ⊆ walk **and** records the bounded residual (two separate round-trips; a truncation appearing only on the second is not caught). New `GROUNDING_UNAVAILABLE_CODE` + `grounding_unavailable_finding`. The DELIBERATELY-NOT-INCLUDED paragraph is rewritten: the code is no longer publish-only, and it stays out of `GROUNDING_VERDICT_CODES` because that set means exactly "what `grounding_verdicts` emits". `tool_names` and `_resolve_template_placeholders` untouched.
- **`backend/app/api/workflows.py`** (+80/-23) — `_DEGRADED_CODES` added and unioned into `_KNOWN_CODES`; `_ERROR_CODES` still derived. The publish-only paragraph replaced with the new truth. `validate_workflow` restructured: lint first (outside the seal, with a comment saying why), then one `try` around `assemble_grounding_bundle` + the `bundle.degraded` branch + `grounding_verdicts`, with an `except` that logs `exc_info=True` and appends the no-arg finding; then the D-13 check and the interactive-phase check, both outside. Findings order on the success path is unchanged. Handler docstring gained the enforcement paragraph and the explicit SEED-131 / SEED-132 boundary. Seam header gained the failure-posture parity sentence.
- **`backend/app/services/harness/publish_service.py`** (+31/-14) — `grounding_unavailable_finding` added to the function-local import; a `if bundle.degraded:` branch returns the shared finding (with a warning naming the registries) without calling `grounding_verdicts`; the `except` branch's local literal dict replaced by `grounding_unavailable_finding()`. Docstring's false parity claim replaced with the accurate WR-01 account. Stage 2.6's position, `_block`'s arguments and `_resolve_publish_supabase` untouched.
- **`backend/tests/unit/test_182_grounding_degradation.py`** (new, 852 lines, **19 tests**) — module docstring names the phase, VALID-01 and the three findings, states the shared defect in one sentence, and names the pre-fix outcome for each. Groups: (A) the truncation-aware read + its three negative controls + the byte-identity control; (B) the bundle-level degradation signal incl. the healthy-bundle control; (C) WR-01 at both consumers, synthetic **and** end-to-end; (D) WR-07 end to end through the real ⊆ rule; (E) WR-02 from both escape paths, with the not-a-`ValueError` premise pinned; (F) structural survival; (G) the constant-to-classifier link.
- **`backend/tests/unit/test_182_grounding_skill_org_gate.py`** (+60/-9) — the `_Boom` test **converted, not deleted**: it now asserts the raise, with a new sibling asserting `assemble_grounding_bundle` turns that raise into a degraded, empty skill set. `_Boom` / `_SkillsBoom` hoisted to module level. Test count 8 → **9**; the `coerce_uid` raise test and every org-gate assertion untouched.
- **`backend/tests/unit/test_182_severity_codes.py`** (+45/-20) — `test_known_codes_compose_from_the_owning_modules_with_no_orphan` gained the `_DEGRADED_CODES` composition + disjointness assertions and `grounding_unavailable` in the exact `_ERROR_CODES` literal set, with a comment on why it is `error` and not `incomplete`. `test_publish_only_codes_are_an_acknowledged_boundary` → `test_publish_mints_no_code_validate_cannot_classify`: asserts the boundary set is now **empty**, keeps both `_severity(...) == "error"` assertions, adds `GROUNDING_UNAVAILABLE_CODE in _KNOWN_CODES` so it cannot pass vacuously, and its docstring records the change *and* preserves the forcing function for a future publish-only code.
- **`.planning/seeds/SEED-131-validate-always-200-invariant-unsealed.md`** — see Accomplishments.

## Falsification Record

Three mutations, each applied to the real source from a scratchpad script run from the backend cwd, each observed, each reverted. Both files were restored from scratchpad backups and verified byte-identical by `md5sum` **and** by an empty `git diff`. No scratch `.py` was written anywhere under `backend/`; no `git stash`, no `git clean`, no blanket reset.

### (0) The natural REDs — the strongest evidence, because the code was genuinely pre-change

**Task 1 RED** (`fb2850db`): 9 of 10 failed. The literal WR-01 reproduction observed

```
E       AttributeError: 'GroundingBundle' object has no attribute 'degraded'
```

after `assemble_grounding_bundle` **returned successfully** from a raising skills read — the defect stated as a test artifact. The 10th test (`test_the_default_read_requests_no_count_and_never_raises`) was green in RED **by design**: it is a byte-identity parity guard pinning behaviour that must not change.

**Task 2 RED** (`c668e799`): 7 of 7 new tests failed with the exact pre-fix outcomes:

```
E  AssertionError: WR-01 REGRESSION: ... skill reference 33333333-... being unregistered.
E  assert 'unregistered_skill' not in {'unregistered_skill'}
E  assert ['unregistered_skill'] == ['grounding_unavailable']   (publish side)
E  assert 'folder_scope' not in {'folder_scope'}                (WR-07)
E  tests...._ApiErrorLike: {'message': 'JWT expired', 'code': 'PGRST301'}   (WR-02 — ESCAPED)
```

### (a) `_skill_registry`'s swallow RESTORED → 5 failures

The mutation re-inserted `except Exception: ... return []` around the skills read. Result: **5 failed, 23 passed** across the two affected files. Failing: the bundle-level real-read test, both end-to-end WR-01 tests, and both converted `skill_org_gate` tests.

The exact verdict the author would have seen, captured by driving the real handler under the mutation:

```
{'code': 'unregistered_skill', 'phase': 'answer',
 'message': "phase 'answer' references a non-registered skill_ref '33333333-3333-3333-3333-333333333333'",
 'severity': 'error'}
ok: False
```

…with `RuntimeError: postgrest 503 on the org-gated skills read` logged underneath. That juxtaposition **is** WR-01: an outage in the log, an accusation on the wire. Publish side: `named_failures` came back `['unregistered_skill']` instead of `['grounding_unavailable']`.

**Note on reach.** The two *synthetic-bundle* consumer tests did **not** fail under this mutation, because they inject a pre-degraded bundle and therefore cannot see the swallow. That is why two end-to-end tests were added in Task 3 — without them the plan's own falsification criterion ("tests (1)-(3) FAIL") would have been unreachable for (2) and (3). This is the same class of gap 182-09 found in its counting seam.

### (b) The `/validate` seal REMOVED → 2 failures, both by propagation

The mutation deleted the `try`/`except` (keeping the degraded branch, so only the *seal* was under test). Both WR-02 tests failed by the exception **escaping the handler**:

```
E       tests.unit.test_182_grounding_degradation._ApiErrorLike: {'message': 'JWT expired', 'code': 'PGRST301'}
E       tests.unit.test_182_grounding_degradation._ApiErrorLike: connection reset by peer
```

Not an assertion failure — an escape. Under FastAPI that is the HTTP 500 the docstring promises can never happen. The other 17 tests stayed green, so the seal is the sole discriminator.

### (c) `strict=True` DROPPED from the folders read → 2 failures

```
E       AssertionError: assert 'folders' in frozenset()
E        +  where frozenset() = GroundingBundle(...).degraded
E       assert 'folder_scope' not in {'folder_scope'}
```

The first shows the truncated read being silently accepted as complete; the second is the fabricated governance violation that reaches the author. One keyword is the entire difference.

### Restoration

```
c0adedbaf818ae73d53d911ffa9590f7 *app/services/harness/grounding.py   (matches backup)
077eb9cea37e32bad41529620174a78f *app/api/workflows.py                (matches backup)
git diff --stat -- <both files>  ->  empty
```

## Verification Evidence

### Baselines recorded BEFORE editing

| Measurement | HEAD (`c3084272`) | After |
|---|---|---|
| Phase-182 9-file surface | **87 passed, 0 failed** | **87 passed, 0 failed** |
| `tests/integration/test_folders.py` + `test_kb.py` | **50 passed, 0 failed** | **50 passed, 0 failed** |
| `test_165_folder_utils_org_scope` + `182_extraction_parity` + `103_grounding_fidelity` + `103_nl_generate` | 22 passed | 22 passed |
| `grep -c "^\s*def test_" test_182_grounding_skill_org_gate.py` | 7 | 7 (all-defs: 8 → **9**) |
| `grep -n "== \[\]" test_182_grounding_skill_org_gate.py` | 1 hit — line 220, the `_Boom` swallow assertion | 2 hits — line 232 (docstring PROSE quoting the old assertion) and line 263 (`assert bundle.skills == []`, the degraded-bundle fail-closed outcome). **The `_Boom` swallow assertion itself is gone.** |
| `grep -n "return \[\]" grounding.py` | 164, 216, 237, 240, 247 — **164 is the `_skill_registry` swallow** | 231, 252, 255, 262 — **all four inside `_resolve_template_placeholders`**; none in `_skill_registry` |

### Test runs

| Gate | Result |
|---|---|
| Task 1 `<verify>` (`165_folder_utils_org_scope`, `integration/test_folders`, `182_extraction_parity`) | **40 passed** |
| Task 1 acceptance (4 suites) | **22 passed** |
| Task 2 `<verify>` (`182_validate`, `182_publish_grounding_stage`, `publish_service`) | **39 passed** |
| Task 2 acceptance (+ `182_folder_scope_keying`) | **55 passed** |
| Task 3 `<verify>` (`182_grounding_degradation`, `182_severity_codes`, `182_grounding_skill_org_gate`) | **36 passed** |
| Plan `<verification>` (12 files) | **119 passed, 0 failed** |
| Plan verification + `test_revert_byte_identical` + `test_181_flip_on` (14 files) | **131 passed, 0 failed** |
| Phase-182 9-file baseline | **87 passed, 0 failed** (unchanged) |
| Integration folders + kb | **50 passed, 0 failed** (unchanged) |
| Adjacent sweep (`098_scope_governance`, `152_folder_override`, `182_canvas_gate`, `182_canvas_auth`, `181_off_audience`, `103_lint_block`, `103_draft_crud`) | 42 passed, **1 pre-existing failed (D1)** |
| `test_dual_mode_wiring.py` | 15 failed, 38 passed — **exactly D2's recorded 15**, zero net-new |
| `python -c "import app.main"` | exit **0** |
| Import smoke over every `fetch_visible_folders` caller (`api/folders`, `api/kb`, `agent_loop`, `document_view_resolver`, `harness/scope`, `workflow_kickoff`, `workflow_authoring`) | exit **0** |

### Acceptance greps

| Check | Required | Observed |
|---|---|---|
| `count="exact"` in `folder_utils.py` | only inside the `strict` branch | 1 code occurrence (line 71, inside `if not strict:`'s else path); 1 prose mention in the docstring |
| `strict: bool = False` | 2 | **2** |
| `class FolderReadTruncatedError(RuntimeError)` | 1 (and NOT `ValueError`) | **1**; pinned additionally by a runtime `issubclass` test |
| `degraded` in `grounding.py` | ≥ 4 | **15** |
| `GROUNDING_UNAVAILABLE_CODE` in `grounding.py` | ≥ 2 | **2** |
| `"code": "grounding_unavailable"` in `grounding.py` | 0 (drift-scanner trap) | **0** |
| `_DEGRADED_CODES` in `workflows.py` | ≥ 2, referenced by `_KNOWN_CODES` | **3**, and the `_KNOWN_CODES` union references it |
| `_ERROR_CODES` still derived | no literal on its assignment line | `_ERROR_CODES: frozenset[str] = _KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES` |
| `"grounding_unavailable"` literal in `workflows.py` | 0 | **0** |
| `"code": "grounding_unavailable"` in `publish_service.py` | 0 | **0** |
| `grounding_unavailable_finding` in `workflows.py` / `publish_service.py` | ≥ 1 / ≥ 2 | **4** / **3** |
| `"the same fail-closed posture"` in `publish_service.py` | 0 | **0** |
| `available_tools` / `skill_ref` in `publish_service.py` | 0 (the one-source guard) | **0** / **0** |
| `def test_` in `test_182_grounding_degradation.py` | ≥ 9 | **19** (852 lines; plan floor was 200) |
| not-a-`ValueError` premise pinned | present | 1 explicit `issubclass` assertion |
| explicit negatives | present | `"unregistered_skill" not in` ×4, `"folder_scope" not in` ×2 |
| SEED-131 `status: open` + a section naming 182-11 | yes | yes; frontmatter re-verified to parse as strict YAML (4 `re_open_triggers`, 6 `confirmed`) |
| `python -c "import app.main"` | exit 0 | exit 0 |

### The `validate_workflow` structure (recorded per the plan's Task-2 criterion)

```
user_id = _coerce_user_id(current_user)
findings = []
findings.extend(... lint_workflow(body) ...)                 # PURE — outside the seal
try:                                                          # ← the seal (WR-02)
    bundle = await grounding.assemble_grounding_bundle(...)
    if bundle.degraded: findings.append(grounding_unavailable_finding(bundle.degraded))
    else:               findings.extend(await grounding.grounding_verdicts(...))
except Exception:
    logger.warning(..., exc_info=True)
    findings.append(grounding_unavailable_finding())
if grounding.business_requirement_missing(body): findings.append(...)   # PURE — outside
findings.extend(... publish_service._interactive_phase_failures(body) ...)  # PURE — outside
```

Three of the four aggregation stages are outside the seal; only the two DB-backed calls are inside. Findings ORDER on the success path is unchanged from HEAD (lint → grounding → business_requirement → interactive); the only structural move is that `assemble_grounding_bundle` no longer runs *before* lint.

### Scope containment

`git diff --name-only fb2850db~1 HEAD` lists **exactly the 8 files** in the plan's `files_modified`. `git diff --diff-filter=D` across the whole range is **empty** — no deletions. Every file was staged by explicit path; never `git add .` / `-A`, leaving the ~400 unrelated `.claude/` modifications and the 4 pre-existing untracked `backend/` files alone. No new untracked file was created anywhere in the repo.

## Decisions Made

Three judgement calls beyond the plan's explicit decisions.

**1. Tests invalidated by a task's source change were fixed in THAT task's commit.** The plan assigns `test_182_grounding_skill_org_gate.py` and `test_182_severity_codes.py` to Task 3, which would have left the suite red across two commits (182-10 accepted exactly that and documented it). Here the conversions are *causally* owned by the change that invalidates them — Task 1 removes the swallow the `_Boom` test pins; Task 2 widens the taxonomy the two severity tests pin — so they were folded in. Consequence: every commit in this plan leaves the phase surface green, which matters for bisect. Both files are in the plan's `files_modified`, so nothing moved out of scope; Task 3 kept the SEED narrowing, the end-to-end proofs and all three falsifications.

**2. Two end-to-end tests were added beyond the plan's eight behaviours.** The plan's WR-01 tests at `/validate` and publish both inject a *synthetic* degraded bundle. That isolates the consumer branch cleanly, but it structurally cannot observe the swallow that CAUSED WR-01 — and the plan's own falsification criterion requires restoring that swallow and seeing those tests fail. As written they would have stayed green. `test_validate_end_to_end_over_a_raising_skills_read_...` and its publish sibling drive the REAL `assemble_grounding_bundle` and the REAL `_skill_registry` against a raising client, so falsification (a) genuinely reaches both consumers. The synthetic tests were kept as well — they are the tighter guard on the branch itself.

**3. The no-arg `grounding_unavailable_finding()` message is publish's existing wording verbatim, "publish is blocked" clause included, even though `/validate` also uses it.** The alternative was neutral prose for both. Keeping it verbatim makes publish's resolution-failure message byte-identical to before this plan (a real compatibility win on the only path that already emitted this code), and the clause is *true* on `/validate` too: the verdict is `severity: error`, `ok` is `False`, and a definition whose grounding cannot be verified genuinely will not publish. The degraded-branch message — the new one — leads with the same clause and ends by naming what it is: "this reports what we could not CHECK, not a problem with the definition".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's prescribed `publish_service` docstring text would have broken a passing test**

- **Found during:** Task 2.
- **Issue:** The plan's action text dictates a replacement docstring containing the literal tokens `unregistered_skill` and `skill_ref` ("blocked publish with a false `unregistered_skill` naming the author's valid `skill_ref`"). `test_182_publish_grounding_stage.py::test_publish_service_calls_the_shared_collector_and_implements_no_rule` asserts `"available_tools" not in source` and `"skill_ref" not in source` over `publish_service.py` — a structural one-source guard that a re-implemented grounding rule would trip. Writing the plan's sentence verbatim would have failed it on prose alone.
- **Fix:** the same account written without those tokens — "naming the author's own valid phase references as unregistered". Grep confirms `skill_ref` and `available_tools` are both still **0** in that file, and the guard test passes.
- **Files modified:** `backend/app/services/harness/publish_service.py`
- **Commit:** `fe24dea3`

**2. [Rule 1 - Bug] The plan's docstring replacement also defeated its own acceptance grep**

- **Found during:** Task 2 acceptance.
- **Issue:** the corrected docstring initially *quoted* the false claim ("used to claim … 'the same fail-closed posture …'"), which is good writing and a failed criterion: `grep -c "the same fail-closed posture" publish_service.py` must return 0, and the quote returned 1. A grep-based proof that a false claim is gone cannot survive the claim being quoted.
- **Fix:** reworded to "used to claim that the posture here matched `grounding._skill_registry`'s own fail-closed read (CR-01)" — same information, phrase gone. Grep now returns **0**.
- **Files modified:** `backend/app/services/harness/publish_service.py`
- **Commit:** `fe24dea3`

No Rule 2 or Rule 3 fixes were required and no Rule 4 architectural question arose. No package was installed; `requirements.txt` is untouched.

### Acceptance-criteria corrections (not code deviations)

**1. Falsification (a) cannot reach the plan's tests (2) and (3) as specified.** The criterion says restoring the swallow makes tests (1)-(3) fail. Tests (2) and (3) inject a synthetic degraded bundle, so the swallow is invisible to them by construction. Recorded above under Decisions #2; two end-to-end tests were added so the criterion is satisfiable, and it was then satisfied.

**2. `grep -c "== \[\]"` on `test_182_grounding_skill_org_gate.py` is 2, not 0.** The criterion is that it "no longer counts the `_Boom` assertion" — it does not. The two remaining hits are the converted test's docstring quoting the old assertion (prose, deliberately kept as provenance) and `assert bundle.skills == []` in the new sibling, which pins the fail-closed OUTCOME the conversion had to preserve. Before/after recorded in the evidence table with line numbers.

**3. `tests/integration/test_folders.py` / `test_kb.py` are NOT inside the ~200-failure rot.** The plan cautioned that these sit in known pre-existing rot and asked only that the after-count be no worse. Measured: **50 passed / 0 failed both before and after.** Recorded rather than assumed.

## Issues Encountered

- **The known pre-existing D1 failure** (`test_098_scope_governance.py::test_run_start_resolution`, `ValueError: get_service_role_supabase requires an explicit org_id`) appears in the adjacent sweep. Not chased, per the orchestrator's instruction and `deferred-items.md`; it is causally unreachable from this plan (it fails inside `_build_resume_context`, before any code this plan touches).
- **`test_dual_mode_wiring.py`'s 15 failures** (D2) reproduce at exactly the recorded count. Zero net-new. Neither suite is in this plan's verification set.
- **A heredoc-based append to the test file failed to parse in the shell** (unterminated-quote error) and wrote nothing; the append was redone with the Edit tool. No partial write occurred — verified by line count and `git status` before proceeding.
- **No new `deferred-items.md` entry was needed.** No out-of-scope discovery beyond D1/D2, both already logged.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-44 (Spoofing — false accusation from the swallowed skills read) | mitigate | **Closed.** The swallow moved to `assemble_grounding_bundle`, which records `degraded={"skills"}`; both consumers emit the honest finding. Falsified by restoring the swallow and capturing the exact false verdict dict. |
| T-182-45 (DoS — unsealed grounding I/O on a route called every canvas edit) | mitigate | **Closed.** Both stages wrapped; falsified by removing the seal and observing the exception ESCAPE (not an assertion failure). The pure checks stay outside, pinned by a dedicated test. |
| T-182-46 (Spoofing — false scope violation from an unbounded read) | mitigate | **Closed at the two gate call sites.** `strict=True` + exact count; falsified by dropping the keyword and reproducing the false `folder_scope`. Residual recorded in-source: the ⊆ walk's own second read is a separate round-trip. |
| T-182-47 (Tampering — error-class confusion) | mitigate | **Closed.** `FolderReadTruncatedError` is a `RuntimeError`; asserted at runtime (`issubclass(..., ValueError) is False`) rather than only by grep, so a future base-class change fails a test. |
| T-182-48 (DoS — a COUNT on every folders read) | mitigate | **Closed.** `strict` is keyword-only, default False; the default branch is a separate early return issuing the byte-identical query. Pinned by a test that drives a *truncating* response through the default path and asserts it returns rows, never raises, and requested **no** count. Integration folders/kb counts unchanged. |
| T-182-49 (Info disclosure — the degraded message) | accept | Held. The message names registry KINDS only ("folders", "skills"); the exception is logged server-side with `exc_info` and never serialized. Strictly less disclosure than the HTTP 500 it replaces. |
| T-182-50 (EoP — degrading instead of failing closed) | mitigate | **Closed.** A degraded bundle never lets anything through: `/validate` reports `severity: error` so `ok` is `False`, and publish BLOCKS at `grounding_fidelity` before the golden run (`drive.assert_not_called()`, `flip.assert_not_called()` in two tests). Classification is derived, and both `phases_empty` states are pinned. |
| T-182-51 (Tampering — a code invisible to the drift scanner) | mitigate | **Closed as designed.** The code is built from the constant, so the scanner cannot see it — and the loophole is covered by an explicit `GROUNDING_UNAVAILABLE_CODE in _KNOWN_CODES` + both-severity assertion. The publish-only boundary test is rewritten to assert emptiness while keeping its forcing function for any future publish-only literal. |
| T-182-SC (package installs) | accept | Zero installs. `count="exact"` is an existing parameter of the already-installed postgrest 2.29.0 `select` builder. No `requirements.txt` change, no new import beyond stdlib `logging`. |

## Known Stubs

None. A scan of all five source/test files for `TODO` / `FIXME` / `placeholder` / "coming soon" / "not available" returned only two pre-existing prose hits, both about real template-placeholder resolution and publish bookkeeping. The `folders = []` / `skills = []` assignments in the degradation branches are the semantically correct fail-closed answer (an unresolvable registry yields no grounding), not unwired data — and every consumer is forbidden from reading them as membership sets when `degraded` is non-empty.

## Threat Flags

None. No new network endpoint, no new auth path, no file access, no schema change, no migration, no frontend file. The change adds one guarded read parameter and one dataclass field, and it strictly *reduces* the number of false claims the server makes about an author's definition.

## User Setup Required

None — backend-only. No environment variable, migration, seed row, cloud configuration, package install or frontend change. No deployment-artifact parity obligation (no env var read, no seed-bearing migration, no bundled service, no sandbox image tag).

## Next Phase Readiness

- **Phase 184's canvas can call `/validate` on every edit without a 500 risk from the grounding reads.** The route now degrades to a renderable verdict, and the verdict says which registry is unreachable, so the canvas can show "we could not check grounding right now" instead of an empty error state. The remaining always-200 surface (the `@model_validator` 422s) is SEED-132 and unchanged.
- **The envelope-level design question is still open and is now precisely scoped.** SEED-131 records it as Phase 184's call: keep the verdict code, or add a top-level `degraded` marker / a third severity. 182-11 chose the verdict code because it is what the existing `{ok, verdicts}` envelope can carry honestly today, not because the alternatives were rejected.
- **Phase 185 (graded governance) inherits a bundle that can say "I could not resolve this".** A per-node `grounding_mode` verdict added to the same collector automatically gets the degraded skip — a governance claim will never be minted from a registry that could not be read. `test_182_severity_codes.py`'s drift detector still forces the classification decision when 185 adds its code.
- **Deliberately still open, recorded rather than forgotten:**
  - **WR-03** (narrow the ⊆ rule's `except ValueError`, since `pydantic.ValidationError` is a `ValueError` in Pydantic v2). Untouched by this plan and still recorded in `grounding.py`'s source. Note this plan makes it *smaller*: a `ValidationError` off the ⊆ path now needs to survive the seal, and the seal catches everything the rule's catch misses.
  - **The second folders round-trip.** `resolve_project_subtree` still reads the folder tree non-strictly. The bundle's strict read runs first against the same table under the same cap, so the realistic truncation is caught; a truncation appearing only on the second read is not. Recorded in-source at the `strict=True` call site.
  - **`_resolve_caller_org_ids`' own unguarded `aexec`** — guarded at both grounding call sites, unchanged for every other caller.
  - **NL generation's posture.** `workflow_authoring` is the third consumer of `assemble_grounding_bundle` and deliberately ignores `degraded`; its own fidelity check re-reads the folder tree through the ⊆ walk, so its behaviour on a skills failure is byte-identical to before. A folders failure now degrades its prompt to an empty tree instead of propagating — strictly more forgiving, and the fidelity check still catches the real problem.
- **Carried forward unchanged:** `deferred-items.md` D1-D4. D1 and D2 were re-observed at their recorded counts this session; D3 and D4 were not re-touched.
- Remaining round-2 gap-closure plan in this phase: **12**.

## Self-Check: PASSED

All 8 claimed files exist on disk and all 5 claimed commits resolve in `git log --all`:

- FOUND: `backend/app/utils/folder_utils.py`, `backend/app/services/harness/grounding.py`, `backend/app/api/workflows.py`, `backend/app/services/harness/publish_service.py`, `backend/tests/unit/test_182_grounding_degradation.py`, `backend/tests/unit/test_182_grounding_skill_org_gate.py`, `backend/tests/unit/test_182_severity_codes.py`, `.planning/seeds/SEED-131-validate-always-200-invariant-unsealed.md`
- FOUND: `fb2850db`, `79e91d48`, `c668e799`, `fe24dea3`, `6f45213f`

Claimed test counts independently re-confirmed by both `grep -c` and `pytest`: 19 in the new file (852 lines), 9 in `test_182_grounding_skill_org_gate.py`, 8 in `test_182_severity_codes.py`.

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
