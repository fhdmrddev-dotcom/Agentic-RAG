---
phase: 182-server-validation-seam
plan: 07
subsystem: api
tags: [fastapi, harness, validation-seam, severity, fail-closed, anti-drift, pytest, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plan 03)
    provides: "the /validate route + the Verdict model + the _severity classifier this plan rewrites"
  - phase: 182-server-validation-seam (plan 01)
    provides: "harness/grounding.py — the module that now publishes GROUNDING_VERDICT_CODES"
  - phase: 182-server-validation-seam (plan 06)
    provides: "publish_service's fail-closed grounding_unavailable code — the publish-only boundary this plan pins"
  - phase: 091-harness-reachability
    provides: "reachability.lint_workflow + LintError — the module that now publishes LINT_CODES"
provides:
  - "reachability.LINT_CODES — the canonical frozenset of codes lint_workflow can emit, owned by the emitting module"
  - "grounding.GROUNDING_VERDICT_CODES — the canonical frozenset grounding_verdicts can emit, one per atomic rule"
  - "workflows._KNOWN_CODES / _ROUTE_ASSIGNED_CODES / _INCOMPLETE_CODES / _DUAL_SOURCE_CODES — the composed, partitioned taxonomy"
  - "workflows._ERROR_CODES — now DERIVED (set arithmetic), no duplicated verdict-code literal"
  - "_severity fails CLOSED: an unrecognised code classifies 'error' and logs a WARNING naming it"
  - "backend/tests/unit/test_182_severity_codes.py — 8 tests: 2 source-scanning drift detectors, a teeth self-test, a composition/partition guard, the pinned literal taxonomy, the WR-05 fail-loud proof, and the publish-only boundary pin"
affects: [184-editable-canvas-live-validation, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vocabulary ownership: the module that EMITS a code publishes the canonical set; downstream classifiers compose, never re-declare"
    - "Fail-closed classification: an unrecognised machine code resolves to the LOUD severity plus a named log line, never the soft default"
    - "Source-scanning drift detector paired with a teeth self-test, so the guard cannot pass vacuously on an empty match"
    - "Pinned literal taxonomy table deliberately NOT derived from the constants under test"
    - "Named single-element constant (_DUAL_SOURCE_CODES) to keep a derived-set assignment literal-free and the taxonomy set-math expressible"

key-files:
  created:
    - backend/tests/unit/test_182_severity_codes.py
  modified:
    - backend/app/services/harness/reachability.py
    - backend/app/services/harness/grounding.py
    - backend/app/api/workflows.py

key-decisions:
  - "grounding_unavailable's canonical home is publish_service.py — it is publish-only and deliberately NOT composed into _KNOWN_CODES, pinned by a boundary test rather than by touching a 5th file"
  - "The no_terminal dual-source split was hoisted into a named _DUAL_SOURCE_CODES so _ERROR_CODES' assignment carries zero verdict-code literals AND the three buckets can be asserted to PARTITION _KNOWN_CODES"
  - "The drift scanners strip whole-line # comments (the extraction-parity count-guard idiom) so the new documentation blocks in both owning modules are not read as emit sites"
  - "The pinned 11-row severity table is written as literals and was authored in the RED commit, where it PASSED — direct evidence that the fix reclassifies nothing"
  - "_INCOMPLETE_CODES stays a literal set: which conditions are 'still building' is a D-182-03 product decision, not something to derive"

patterns-established:
  - "Ownership-first code vocabularies: publish the set next to the type that carries it, enforce the pairing with a source scan in the same commit"
  - "When a fix narrows the meaning of an existing term, correct the docstrings that used the term loosely in the same change"

requirements-completed: []  # VALID-01 already marked complete at 182-03; this plan closes the WR-05 anti-pattern under the same ID

# Metrics
duration: 23min
completed: 2026-07-25
---

# Phase 182 Plan 07: Fail-Loud Severity Classifier Summary

**`POST /workflows/validate`'s severity classifier now COMPOSES its known-code set from the modules that own the codes and fails CLOSED on anything it does not recognise — so a future blocking rule (Phase 184 and Phase 185 both add codes) can never paint soft-grey "you're still building" on the canvas and then surprise the author with a hard publish block.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-07-24T23:09Z
- **Completed:** 2026-07-24T23:32Z
- **Tasks:** 2 (Task 1 TDD — RED then GREEN)
- **Files modified:** 4 (3 source, 1 test — exactly the plan's `files_modified`, no deletions)

## Accomplishments

- **WR-05 is closed.** `_severity`'s bare trailing soft default is gone. An unrecognised code now classifies `error` **and** emits a `logger.warning` naming the code and telling the reader exactly which set to add it to. The asymmetry is the point: a wrongly-RED verdict is visible and gets fixed; a wrongly-GREY one is invisible — the canvas says "still building", publish says "blocked", and the author is left with no signal that connects the two.
- **The known-code set is DERIVED, not duplicated.** The old block was 6 string literals copied out of two other modules. Now `reachability` publishes `LINT_CODES` (5 codes, declared beside the `LintError` type that carries them), `grounding` publishes `GROUNDING_VERDICT_CODES` (3 codes, one per atomic rule), and `workflows.py` composes those with `_ROUTE_ASSIGNED_CODES` — the 2 codes the route genuinely mints itself. `_ERROR_CODES` survives by name but is now set arithmetic: `_KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES`, with **no verdict-code string literal on the assignment**.
- **The drift is DETECTED, not trusted.** Two tests scan the owning modules' real emit sites (`LintError(` call sites; verdict `"code"` sites) and fail when a published set diverges — naming the symmetric difference. This is the guard a failures-only differential structurally cannot provide: a new code added without being published breaks nothing and fails nothing, it just arrives at `_severity` as an unknown. Both detectors were **falsified against the real modules** (see below).
- **The detectors have teeth.** A scanner that silently matched nothing would make both drift tests pass vacuously the instant a published set was also emptied. `test_drift_scanners_have_teeth` runs both regexes over an inline sample containing multi-line call sites, commented-out sites and near-miss lines, and asserts the exact extracted sets. Both drift tests also assert their scan is non-empty before comparing.
- **Every known code has exactly ONE classification path.** The composition guard asserts the three buckets *partition* `_KNOWN_CODES` — no orphan (which would fall through to the fail-loud branch and log a warning on every request that produced it) and no double-claim (an ambiguous taxonomy). It also re-asserts that the derived `_ERROR_CODES` still equals the historical 6-code literal set exactly.
- **Zero reclassification, proven by construction.** The pinned 11-row taxonomy table was authored in the **RED** commit, where it **passed** while the other two tests failed. That is direct evidence — not a claim — that the change touches only the UNKNOWN branch. The `no_terminal` dual-source split (D-182-03 / Pitfall 2) is preserved verbatim and asserted in both directions.
- **`reachability.py` stays PURE.** Only a constant declaration was added — no import, no I/O. The forbidden tokens `supabase` / `folder_utils` / `_skill_registry` all grep to **0**, so `test_182_extraction_parity.py::test_grounding_is_the_one_source` still holds and `/validate` keeps its import-light property (Pitfall 1).

## Task Commits

1. **Task 1 RED — failing tests for the fail-loud classifier** — `6b9fe093` (test)
2. **Task 1 GREEN — published code sets + the composed, fail-closed classifier** — `0f328c9a` (feat)
3. **Task 2 — drift detectors, teeth self-test, composition guard, publish boundary** — `76a6895a` (test)

No REFACTOR commit — the change is a targeted replacement with nothing left to clean up.

## Files Created/Modified

- `backend/app/services/harness/reachability.py` (+28) — `LINT_CODES: frozenset[str]` placed directly beneath the `LintError` NamedTuple, with a docblock stating it is the CANONICAL set, why downstream classifiers derive from it, and that a new `LintError` code must be added here in the SAME commit because the drift test enforces the pairing. Written carefully to avoid the three forbidden PURE-module tokens (the docblock says "no I/O, no engine import" rather than naming any DB symbol).
- `backend/app/services/harness/grounding.py` (+25) — `GROUNDING_VERDICT_CODES: frozenset[str]` immediately above the three-atomic-rules banner, with the same derive-don't-duplicate rationale and an explicit note that `grounding_unavailable` is **not** included and why.
- `backend/app/api/workflows.py` (+115/−17) — the taxonomy comment block rewritten to describe the DERIVED composition one row per owner (plus the publish-only boundary and what to do if it ever changes); `LINT_CODES` added to the existing module-direct `reachability` import; `_ROUTE_ASSIGNED_CODES` (with a comment naming where each of the two is minted), `_INCOMPLETE_CODES`, `_DUAL_SOURCE_CODES`, `_KNOWN_CODES` and the derived `_ERROR_CODES`; `_severity` rewritten with the 4-branch order and the WR-05 rationale in its docstring. The `Verdict` model docstring was corrected in the same commit — see Deviations.
- `backend/tests/unit/test_182_severity_codes.py` — **new, 8 tests / 383 lines.** (1) the published sets; (2) the WR-05 fail-loud proof (return value + `caplog`, two unknown codes, both `phases_empty` arms); (3) the pinned 11-row literal taxonomy; (4) the lint drift detector; (5) the grounding drift detector; (6) the composition/partition guard; (7) the scanner teeth self-test; (8) the publish-only boundary pin.

## The `grounding_unavailable` question (the prior-wave hand-off)

Plan 182-06 introduced a new verdict code while this plan was being planned, so its home had to be decided rather than assumed. **It was read in source before deciding.**

| Question | Answer (verified) |
|---|---|
| Where is it minted? | `publish_service.py` only — the fail-closed `except` wrapper of stage 2.6. `grounding.py` has exactly 3 `"code"` emit sites and this is not one of them. |
| Can it reach `_severity`? | **No.** `validate_workflow` calls `grounding.grounding_verdicts` **directly**, never `publish_service._grounding_fidelity_failures`. The code travels on the D-08 publish verdict's `named_failures`. |
| Would the drift detectors false-fail on it? | **No.** They scan `reachability.py` and `grounding.py`; the code appears in neither. |
| So what is its canonical home? | **`publish_service.py`.** It is deliberately NOT composed into `_KNOWN_CODES` — adding it would misrepresent `/validate` as able to emit it. |

Left implicit, that is exactly the kind of unowned code WR-05 exists to catch, so the boundary is **pinned by a test** instead: `test_publish_only_codes_are_an_acknowledged_boundary` scans `publish_service.py` and asserts the set of publish-minted codes unknown to `/validate` is **exactly** `{"grounding_unavailable"}`. If publish mints another code later, that test fails and forces the author to answer the question nobody asked the first time: is this a `/validate` code (compose it in) or publish-only (acknowledge it here)?

It also asserts that *if* it ever did reach the classifier, `_severity` returns `error` for both `phases_empty` arms — "we could not verify" must never paint soft grey. The fail-closed default gets that right by construction, which is a second, independent argument for the WR-05 posture. Recorded in source in three places: the `grounding.py` exclusion note, the `workflows.py` taxonomy block, and the test's own docstring.

## Decisions Made

- **`_DUAL_SOURCE_CODES` instead of an inline `no_terminal` literal.** The plan's action said to subtract "the single-element set holding `no_terminal`", but its acceptance criterion required the `_ERROR_CODES` assignment to contain *no* verdict-code string literal. Hoisting the literal into a named constant satisfies both, and pays for itself twice: `_severity`'s first branch reads as a bucket test like the other two, and the partition assertion (`_INCOMPLETE_CODES | _ERROR_CODES | _DUAL_SOURCE_CODES == _KNOWN_CODES`) becomes expressible. Behavior is identical — set membership on a one-element frozenset versus `==`.
- **Comment-stripping scanners.** Both owning modules now carry docblocks that *discuss* their codes, and `workflows.py`'s block names `grounding_unavailable` in prose. Stripping whole-line `#` comments before scanning (the idiom `test_182_extraction_parity.py`'s count guard already uses) makes the detectors robust to documentation rather than fragile against it. Docstrings are deliberately NOT stripped: a prose emit site inside one would over-report, and over-reporting is the safe direction — the published set would merely have to carry a code that cannot arrive.
- **The pinned table stays literal.** Deriving it from `_ERROR_CODES` / `_INCOMPLETE_CODES` would only assert the code agrees with itself. Each row is a D-182-03 product decision; the test says so and names the CONTEXT update a change would require.
- **`_INCOMPLETE_CODES` stays literal too.** Which conditions mean "still building" is a taxonomy judgement, not something derivable from the emit sites. Only `_ERROR_CODES` — the complement — is derived.
- **No 5th file.** Publishing a `PUBLISH_ONLY_CODES` constant from `publish_service.py` was considered and rejected: it would break the plan's scope criterion for a set the boundary test already pins as a literal, and the plan's own reasoning for literal-pinning the taxonomy table applies equally here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new `_severity` docstring defeated its own acceptance criterion**

- **Found during:** Task 1 GREEN verification
- **Issue:** The plan required `grep -c 'return "incomplete"' backend/app/api/workflows.py` to return **exactly 2** — the mechanical proof that the old trailing unconditional soft default is gone. The first draft of the rewritten docstring quoted the removed code verbatim (`This used to end in a bare ``return "incomplete"``…`), which pushed the count to **3** and silently turned a real check into one that could never distinguish pass from fail.
- **Fix:** Reworded to "a bare, unconditional SOFT default" — same explanation, no literal. Count back to exactly 2 (the `no_terminal` split arm and the `_INCOMPLETE_CODES` arm), both verified by line number.
- **Files modified:** `backend/app/api/workflows.py`
- **Verification:** `grep -c` → 2; `grep -n` shows only lines 450 and 453; 21 passed.
- **Committed in:** `0f328c9a`

**2. [Rule 2 - Missing Critical] Corrected the `Verdict` docstring that this change invalidated**

- **Found during:** Task 1
- **Issue:** `Verdict`'s docstring described `folder_scope` / `unregistered_tool` / `unregistered_skill` / `business_requirement` / `interactive_phase` as "the route-assigned" codes. This plan gives "route-assigned" a **narrower, load-bearing** meaning — `_ROUTE_ASSIGNED_CODES` is exactly 2 codes, and a test asserts that equality. Leaving the docstring would have created a direct contradiction between prose and a constant *introduced by this change*: a reader would reasonably conclude `_ROUTE_ASSIGNED_CODES` was missing three entries.
- **Fix:** Rewrote that sentence to attribute each code to its owning set (5 `LINT_CODES` + 3 `GROUNDING_VERDICT_CODES` + 2 `_ROUTE_ASSIGNED_CODES`), which also documents the composition at the model.
- **Files modified:** `backend/app/api/workflows.py` (comment-only, in `files_modified`)
- **Verification:** 21 passed; no behavior touched.
- **Committed in:** `0f328c9a`

**3. [Rule 2 - Missing Critical] Added an 8th test — the publish-only boundary pin**

- **Found during:** Task 2
- **Issue:** The plan specified 6 tests, authored before plan 182-06 minted `grounding_unavailable`. Nothing in the specified set would notice a publish-path code that no module owns — the same class of blind spot as WR-05 itself, one seam over.
- **Fix:** `test_publish_only_codes_are_an_acknowledged_boundary` (detailed above).
- **Files modified:** `backend/tests/unit/test_182_severity_codes.py`
- **Verification:** Green; the plan's `>= 6` test-count criterion is met at 8.
- **Committed in:** `76a6895a`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical). No architectural change, no scope creep — `git diff --stat e262e9af..HEAD` is exactly the 4 `files_modified`, `--diff-filter=D` is empty, no migration, no new dependency, no frontend file, no package install.

## Falsification Check (recorded, as the plan requires)

Both owning modules were temporarily given a fake emit site **without** publishing the code, then restored from a scratchpad backup — **never** via `git checkout`, to avoid the index contamination plan 182-04 hit.

| Probe | Result |
|---|---|
| Task-1 RED (no published sets, classifier unchanged) | **2 failed, 1 passed** — the published-sets test and the fail-loud test; the pinned taxonomy table passed, proving zero reclassification |
| `reachability.py` + `LintError("fake_drift_code", …)` unpublished | **test (4) FAILED** — `DRIFT: a lint_workflow code was added or removed without updating reachability.LINT_CODES. Symmetric difference: ['fake_drift_code']. …the /validate severity classifier composes an incomplete known-code set and would mis-classify the code (WR-05)` |
| `grounding.py` + `{"code": "fake_grounding_code", …}` unpublished | **test (5) FAILED** — `DRIFT: a grounding_verdicts code was added or removed without updating grounding.GROUNDING_VERDICT_CODES. Symmetric difference: ['fake_grounding_code']. The /validate severity classifier derives its known set from this frozenset, so an unpublished code reaches _severity as an unknown (WR-05)` |
| Restored | **8 passed**; `md5sum -c` OK for both files and `git diff HEAD` empty |

Both probes injected the code into a **live emit path** (the `phases == []` early return; the Rule-1 `folder_scope` branch), so the detectors were tested against the real module shape, not a synthetic one.

## Verification

| Gate | Command | Result |
|---|---|---|
| Task 1 | `pytest tests/unit/test_182_severity_codes.py tests/unit/test_182_validate.py tests/test_182_extraction_parity.py -q` | **21 passed** |
| Task 1 import-safety | `python -c "import app.main"` | exit 0 — the module-level set composition resolves with no circular-import breakage |
| Task 2 | `pytest tests/unit/test_182_severity_codes.py -q` | **8 passed** |
| Plan verification (13 files) | the `<verification>` command | **98 passed, 0 failed** |
| No coverage loss | the 9-file known-good baseline (unchanged files only) | **72 passed** — identical to the pre-plan baseline |
| Wider harness/workflow sweep (13 more files) | `test_harness_reachability / _gates / _resume / _whitelist`, `test_publish_gate`, `test_096_ci_workflow_regression`, `test_147_workflows_flag`, `test_harness_models`, `test_publish_flip`, `test_103_draft_crud / _published_409 / _tweak_fork`, `test_182_grounding_skill_org_gate` | **90 passed, 1 pre-existing failure** (see Deferred Issues) |
| Scope | `git diff --stat e262e9af..HEAD` | exactly the 4 `files_modified`; `--diff-filter=D` empty |

Grep criteria — `LINT_CODES` in `reachability.py` = **1** (≥1) · in `workflows.py` = **6** (≥1) · `GROUNDING_VERDICT_CODES` in `grounding.py` = **1** (≥1) · in `workflows.py` = **4** (≥1) · `return "incomplete"` in `workflows.py` = **2** (exactly) · `logger.warning` inside `_severity` = **1**, final statement `return "error"` · `supabase` / `folder_utils` / `_skill_registry` in `reachability.py` = **0 / 0 / 0** · verdict-code literals on the `_ERROR_CODES` assignment = **0** · new-file test count = **8** (≥6) · `caplog` = **7** (≥1) · `incomplete` = **17** (≥1) · file length **383** lines (≥100 `min_lines`) · all 10 pinned code literals present.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-20 (Spoofing — false-safety signal from the unknown-code branch) | mitigate | **CLOSED — this is the gap.** An unrecognised code classifies `error` and logs a WARNING naming it. Pinned by an explicit `!= "incomplete"` assertion plus a `caplog` assertion, on two different unknown codes and both `phases_empty` arms. Falsified: the RED commit observed the old soft behavior failing the assertion. |
| T-182-21 (Tampering — silent drift across duplicated literal sets) | mitigate | **CLOSED.** The classifier derives from the owning modules; two source-scanning detectors fail on divergence and were falsified against both real modules; a teeth self-test blocks the vacuous-pass failure mode; the partition guard blocks the orphan-code failure mode. |
| T-182-22 (DoS — log volume from the unknown branch) | accept | Unchanged and correct. `_severity` runs once per verdict on a read-only advisory route, so the warning is bounded by the number of verdicts in one response. An unknown code implies a code-level regression a developer must fix — this is the desired operational signal, which is why the message names the exact sets to update. |
| T-182-23 (Tampering — edits to `reachability.py`) | mitigate | Held. Only a constant declaration was added: no import, no I/O. All three forbidden tokens grep to 0 and `test_grounding_is_the_one_source` passes, so the documented PURE / import-light property is intact. |
| T-182-SC (package installs) | accept | Zero installs — no `requirements.txt` / `package.json` change. |

## Threat Flags

None. No new route, no schema change, no auth path, no file access, no network call. Three module-level frozensets and one pure-function rewrite.

## Known Stubs

None. Every symbol is real code; no placeholder value, no `TODO` / `FIXME` / `PLACEHOLDER` introduced.

## Deferred Issues

**`tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` — pre-existing, NOT fixed.** Surfaced only because this plan ran a wider-than-required regression sweep. Fails on `assert _audit_failures(mock_asyncpg_pool) == 3` (`assert 0 == 3`), with `harness_engine.py` warnings about a missing `thread_id`/`user_id` on ctx and a `KeyError: 'tool_call_id'` in the `ask_user` expiry cleanup — all in `harness_engine.py`, a file this plan never touches and which cannot reach `_severity` or either frozenset.

**Proven pre-existing:** the three plan-modified source files were temporarily replaced with their `e262e9af` (pre-plan) copies and the same test produced the identical `assert 0 == 3`. Files then restored (`md5sum -c` OK, `git diff HEAD` empty). Logged as **D4** in the phase's `deferred-items.md` with a re-open trigger. Zero net-new failures from this plan.

**Also observed, untouched:** 4 pre-existing untracked files under `backend/` (`RUN-BACKEND.md`, `scripts/115_axes234_results.json`, `scripts/115_xprovider_results.json`, `settings_override.json.migrated`) — none created by this plan, all unrelated to Phase 182.

## Deployment-Artifact Parity

No action required. No new env var, no `settings.*` read, no seed-bearing migration, no bundled service, no sandbox-image change — `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and `SANDBOX_IMAGE` are unaffected (`scripts/check-deploy-drift.sh` has nothing to flag).

## TDD Gate Compliance

Task 1 carried `tdd="true"` and ran a clean RED → GREEN cycle: `test(182-07)` `6b9fe093` (observed **2 failed, 1 passed**) → `feat(182-07)` `0f328c9a` (**21 passed**). The single passing test at RED was deliberate and is load-bearing evidence — the pinned taxonomy table passing *before* the change is what proves the fix reclassifies nothing. Task 2's tests are regression/drift guards over Task-1 behavior, so their RED substitute is the explicit falsification probe recorded above, which isolates each detector against a live emit path. No REFACTOR gate was needed.

## Issues Encountered

- The `return "incomplete"` grep criterion was nearly defeated by the docstring that *explains* the fix (Deviation 1). Worth remembering for any future acceptance criterion expressed as a source grep: prose about removed code counts as the removed code. The criterion was kept meaningful rather than waived.
- A batch pytest invocation silently reported `0 tests` because one path in the list did not exist (`tests/unit/test_147_workflows_flag.py` — the file is at `tests/test_147_workflows_flag.py`). pytest aborts collection for the whole session on a missing path and, with `-q` plus tail-trimming, the error is easy to read as "everything passed". Verify collected counts, not just the absence of `FAILED` lines.

## User Setup Required

None — backend-only, no migration, no env var, no external service, no package install.

## Next Phase Readiness

- **All three `182-VERIFICATION.md` findings this gap-closure wave targeted are now closed:** SC#4 per-node keying (182-04), publish enforcement (182-06), and the WR-05 fail-open classifier (this plan).
- **Phase 184** inherits a severity signal it can trust: a code the server does not understand paints red, never a false "you're still building". The verdict badge can be rendered directly from `severity` with no client-side taxonomy.
- **Phase 185 is the first real test of the guard, and it will fire.** 185 adds the GOVERN per-node grounding-mode verdict to `grounding_verdicts` — the exact collector `test_grounding_verdict_codes_match_the_grounding_emit_sites` scans. That test will FAIL the moment the new code is emitted, which is the intended behavior: it forces 185 to (a) publish the code in `GROUNDING_VERDICT_CODES` and (b) decide explicitly whether it is an `error` or an `_INCOMPLETE_CODES` condition. **Note for 185:** because publish stage 2.6 forwards the collector's list unchanged (182-06), any verdict added there is enforced at publish automatically — so an ADVISORY-only governance verdict must not be added to that collector without deciding whether publish should block on it.
- **No live smoke is owed by this plan.** The change is a pure classifier over a read-only advisory route with no DB, provider, or network dependency; the offline suite exercises every branch including the log. The outstanding live checks are the ones 182-06 and the phase VALIDATION file already carry.

## Self-Check: PASSED

| Claim | Verification |
|---|---|
| `backend/tests/unit/test_182_severity_codes.py` exists (383 lines ≥ min 100) | FOUND |
| `backend/app/api/workflows.py` modified (contains `_KNOWN_CODES`) | FOUND |
| `backend/app/services/harness/reachability.py` modified (contains `LINT_CODES`) | FOUND |
| `backend/app/services/harness/grounding.py` modified (contains `GROUNDING_VERDICT_CODES`) | FOUND |
| Commit `6b9fe093` (Task 1 RED) | FOUND in `git log --all` |
| Commit `0f328c9a` (Task 1 GREEN) | FOUND in `git log --all` |
| Commit `76a6895a` (Task 2) | FOUND in `git log --all` |
| Plan verification suite (13 files) | 98 passed, 0 failed |
| Known-good 9-file baseline preserved | 72 passed (unchanged) |
| No files deleted by any commit | `git diff --diff-filter=D e262e9af..HEAD` empty |

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
