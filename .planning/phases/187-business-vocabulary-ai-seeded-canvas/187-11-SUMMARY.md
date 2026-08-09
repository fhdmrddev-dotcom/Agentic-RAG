---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 11
subsystem: harness-governance
tags: [sc6, seed-137, armed-checkpoint, property-test, falsification, wave-3, d-187-01, d-187-18]
status: complete
requires:
  - app.services.harness_engine._run_phase_with_gates
  - app.services.harness_engine._resolve_failure_with_ask_user
  - app.services.harness.grounding.effective_phase
  - app.services.harness.grounding._approval_sentence
provides:
  - "the SC#6 property GREEN at 30/30 and OBSERVED to fail again when the checkpoint is removed"
  - "the shipped armed-test census re-pointed at the is_action_risk parameter"
  - "criterion 18 re-shaped visibly with the D-187-01 reasoning recorded in-file"
  - "D-187-18's validator:null receipt shape pinned by value AND key presence"
  - "a helper-level proof that an armed checkpoint on a fail_run-declaring phase still asks"
affects:
  - "188 (RUNVIZ-03) — the run surface for action_risk_pending; the two L-5 tests now drive the hoisted checkpoint"
tech-stack:
  added: []
  patterns:
    - "A property test that has never been seen to fail AFTER the fix is not a control — falsify it and record the result IN the file"
    - "When a mechanism moves, re-shape the test visibly and write down what it asserted before; never delete it quietly"
    - "A shared drive helper gains an OPTIONAL armed keyword so the non-armed regression fence stays byte-identical"
    - "Prove 'unmodified' with an AST function-body comparison against HEAD, not with a grep over the diff"
key-files:
  created: []
  modified:
    - backend/tests/unit/test_ask_user_disposition.py
    - backend/tests/unit/test_185_engine_attachment.py
    - backend/tests/unit/test_187_armed_checkpoint_property.py
decisions:
  - "D-187-01 re-verified: the SC#6 property is green AND red-again-on-removal, both observed"
  - "D-187-18 pinned by a two-sided assertion (value is None AND key is present)"
  - "D-187-02 re-confirmed: pre_fail_run / pre_skip_to_phase stay GREEN in BOTH states"
  - "Task 2's grep-shaped 'unmodified' criterion replaced by a stronger AST measurement (Deviations 1)"
  - "Task 3's 'pytest tests/ → 0 failed' criterion is REFUTED by the measured tree (Deviations 2)"
metrics:
  duration: ~50 min
  tasks: 3
  tests_added: 1
  completed: 2026-08-02
---

# Phase 187 Plan 11: SC#6 Green, Census Re-shaped, Falsification Observed Summary

The armed-checkpoint property is **30/30 green**, the nine shipped tests the hoist changed are
re-shaped with their reasoning written into the files, and the property has been **watched go RED
again** with the checkpoint removed — on the recorded assertions, then restored.

## The decisive measurement

| Scope | Before this plan | After |
|---|---|---|
| `test_187_armed_checkpoint_property.py` | 15 failed / 15 passed | **30 passed** |
| `test_185_engine_attachment.py` | 8 failed / 14 passed | **22 passed** |
| `test_ask_user_disposition.py` | 1 failed / 17 passed | **19 passed** (18 + 1 net-new) |
| 7-file plan verification set | 24 failed | **112 passed, 0 failed** |
| `pytest tests/unit` | 86 failed / 1668 passed | **62 failed / 1693 passed** |

`1668 + 24 + 1 = 1693` and `86 − 24 = 62`, exactly. **The 24 in-flight failures went to 0 and the 62
pre-existing rot failures stayed at 62** — verified not just by count but by per-file breakdown
(retrieval_service 15, sql_service 12, explorer_agent 6, multimodal_query 5, 111_1_reembed 4,
sandbox_service 3, lifespan 3, db_runs 3, module7_tools 2, extraction_service 2, plus 9 singles).
**Not one of this plan's three files appears in that list.** Backend collection **3534** (187-06
recorded 3523; +1 here, +10 from sibling Wave-3 plans) — no suite silently replaced.

## What Was Built

### Task 1 — the armed disposition tests drive the parameter (`3dfd47a4`)

- **`_armed_phase()` rebuilt.** It used to construct the synthesized `action_risk_approval`
  `ValidatorSpec` — a shape `effective_phase` can no longer produce. It now builds what the hoisted
  checkpoint actually hands the helper: `action_risk_armed=True` plus **the author's own validators**
  (empty by default, parametrizable via `author_validators=`).
  `grep -c 'kind="action_risk_approval"'` → **0**.
- **Six armed drives re-pointed** to `is_action_risk=True` / `failed_idx=None`.
  `grep -c "is_action_risk=True"` → **10** (≥ 8). `_ARMED_FINDING` is **kept** — DELTA 1 still splits
  the prompt out of it, so the tests still pass a prefixed message; what changed is that the armed
  treatment is now *requested*, not *sniffed*.
- **`_drive` gained an optional `is_action_risk=False`** rather than being duplicated, so the D-14
  regression fence keeps calling it unchanged. `failed_idx` follows the flag
  (`None if is_action_risk else 0`), so the non-armed path is byte-identical.
- **`:539`'s typed refusal (T-185-04-01) needed no assertion change at all** — it still asserts
  `fail_run` on all 18 rows and **zero** receipts, with the same positive control. Only the drive
  moved.
- **D-187-18 pinned two-sidedly** on the approval-receipt test: `"validator" in metadata` is True
  **and** `metadata["validator"] is None`, with a comment naming the decision and stating why one row
  shape per `event_type` beats two.
- **`:599` `test_non_armed_free_text_fall_through_is_unchanged` is untouched.**
  `git diff -U0 | grep -c 'non_armed_free_text'` → **0**. The parameter did not leak.
- **Net-new (T-187-11-04):** `test_armed_checkpoint_on_a_fail_run_phase_still_asks`. An armed
  checkpoint on a phase whose author declared `on_failure: "fail_run"` still awaits
  `subscribe_for_response`, with a non-armed negative control in the same test proving the assertion
  is not vacuous.

### Task 2 — criterion 18 re-shaped, the armed engine tests re-pointed (`5ae04111`)

**`test_arming_adds_no_phase_and_moves_no_phase_index` is re-shaped VISIBLY**, with a 30-line comment
above it recording (a) what it asserted before — the synthesized `action_risk_approval` spec at
`validators[0]` with the sentence in its `config["prompt"]`; (b) why the mechanism changed —
**D-187-01: the guarantee is a property of the phase, not a position in an author-controlled list**;
(c) that its substance is unchanged; and (d) that this is a re-shape rather than a deletion, because
the phase-level armed reading it observed still has two independent observers in the same file, which
is the reason D-187-03's "exactly ONE reading" was recorded as *reconciled* rather than delivered —
citing `test_the_two_resume_predicates_are_independent` by name.

The substance is asserted more strongly than before: a real `WorkflowDefinition` is built,
`len(definition.phases)` is checked before **and** after, and `[(slug, phase_index)]` is compared as a
whole. The mechanism assertion becomes `[v.kind for v in eff.validators] == ["citations_required"]`
on every armed phase, plus an armed phase owing no citation gate returned **by reference**
(`is`, not `==`). The sentence assertions moved onto `grounding._approval_sentence` directly.
`grep -c 'kind == "action_risk_approval"'` → **0**.

**`_armed_finding(phase, total_phases)` added.** It composes the checkpoint's wire format from the
engine's own `_ACTION_RISK_FINDING_PREFIX` plus `grounding._approval_sentence`, replacing the pre-187
idiom `"action_risk:approval|" + eff.validators[0].config["prompt"]` — which now raises `IndexError`,
because after the hoist an armed `execute_code` phase's effective validator list is empty.

**Five direct armed drives re-pointed** (`:325` no-timeout, `:376` criterion 19, `:407`
character-identical prompt, `:452` null deadline, `:492` shutdown-resumable) with
`is_action_risk=True` / `failed_idx=None`. Every assertion's substance is unchanged.

**`_drive_armed_checkpoint()` added** for the two L-5 tests (`:647` pause-not-failure, `:666` never
announces `gate_failed`). It is the mirror image of its sibling: the effective armed phase carries no
validators, so the **real** `run_gates` passes with no patch and the explicit checkpoint is what
fires. It asserts that emptiness up front, so if a future synthesis re-appears the driver says so
instead of silently measuring something else. `_resolve_failure_with_ask_user` is stubbed to a
terminal outcome, which also keeps the body from running. **`_drive_failing_pre_gate` was left
byte-identical** — it is still the correct drive for an *author's* failing pre gate, which is what
the freshness regression net measures.

### Task 3 — the property green, then falsified on purpose (`a8410b27`)

**(a)** `_drive` now passes `total_phases=TOTAL_PHASES` — the one keyword 187-06 handed off, with a
comment explaining that it matches `run_workflow`'s single production call site and that omitting it
makes the checkpoint compose `"Step 2 of 2"` against the test's `"Step 2 of 4"`, so the
emit→subscribe join fails and the recorder reports zero prompts. **15 red → 30 green.** No case
deleted, no assertion relaxed, no `xfail` (collection still exactly 30).

**(b) The falsification, OBSERVED.** The whole 49-line checkpoint block was removed from
`harness_engine.py` — from `if getattr(phase, "action_risk_armed", False):` through its
`return outcome`, everything between the pre-gate pass and `attempt = 0`. Nothing else was touched.

**Result: 17 failed, 13 passed.** Then restored → **30 passed**, and
`git status --porcelain backend/app` is **empty**.

#### The two RED sets, side by side (plan acceptance criterion)

| | HEAD RED signature (187-01, before the fix) | Falsification RED (this plan, after the fix) |
|---|---|---|
| Count | 8 failed / 22 passed | 17 failed / 13 passed |
| P1 ids | `pre_ask_user_proceed`, `pre_ask_user_plus_post_citations`, `two_pre_ask_user`, `pre_pass_then_pre_ask_user` | **those 4** + `no_author_validators`, `post_only`, `pre_pass_fail_run_disposition`, `armed_refused_typed` |
| P2 ids | the same 4 | the same 8 |
| P3 | green | **RED** |
| Failing assertion (P1) | `assert armed_orders` — "THE BODY RAN AND NOBODY WAS ASKED" | **identical** (reported as `assert []`) |
| Failing assertion (P2) | `assert len(armed_orders) == 1` | **identical** |
| Observed | 0 armed prompts, body invoked, `outcome='completed'` | **identical** |
| Green in both | `pre_fail_run`, `pre_skip_to_phase` | **same two** |

**The falsified set is a strict SUPERSET of the HEAD set, and the reason is measured, not assumed.**
The two states are not the same code. On HEAD the checkpoint did not exist *but* `effective_phase`
still appended the armed spec, so the four rows with no author pre gate ahead of it were still asked
through that appended gate and stayed green. 187-06 Task 3 deleted the synthesis as well, so with the
checkpoint additionally removed **nothing can ask at all** and every row declaring
`reaches_body_without_arming` goes red. P3 joins for the same reason: with nobody asked,
`armed_refused_typed`'s body RUNS — precisely the Phase-185 BLOCKER shape P3 exists to see.
`pre_fail_run` / `pre_skip_to_phase` stay green in **both** states, correctly (D-187-02).

All of the above is recorded in the file itself under `## Falsification observed after the fix`.

### Two extra falsifications, observed beyond the plan's requirement

The Phase-185 lesson is *verify the PROPERTY not the PATCH*, so the two net-new/re-shaped assertions
were each watched fail as well. Neither touched a committed file — both probes were installed, run,
and reverted with `git checkout -- <one specific file>`, and `git status --porcelain backend/app` was
verified empty after each.

| Probe | Effect | Result |
|---|---|---|
| `if not is_action_risk:` → `if True:` in `_resolve_failure_with_ask_user` (the Pitfall-4 short-circuit removed) | the author's disposition speaks for the checkpoint again | `test_armed_checkpoint_on_a_fail_run_phase_still_asks` **RED**, plus 3 siblings — 4 failed / 15 passed |
| the `action_risk_approval` synthesis re-added to `effective_phase` | arming contributes a spec again | criterion 18 **RED**: `assert ['citations_required','action_risk_approval'] == ['citations_required']` |

## Verification

| Check | Result |
|---|---|
| `pytest test_187_armed_checkpoint_property.py -q` | **30 passed** ✅ |
| `pytest test_185_engine_attachment.py -q` | **22 passed** (= HEAD's 22) ✅ |
| `pytest test_ask_user_disposition.py -q` | **19 passed** (= HEAD's 18 + 1) ✅ |
| 5-file quick set | **78 passed, 0 failed** (≥ 72) ✅ |
| 7-file plan verification set | **112 passed, 0 failed** ✅ |
| `pytest tests/unit -q` | **62 failed / 1693 passed** — the 24 → 0, the 62 → 62, same files ✅ |
| Backend collection (`tests/`) | **3534** (≥ 3474 + net-new) ✅ |
| `git status --porcelain backend/app` | **empty** ✅ |
| `git diff -U0 test_ask_user_disposition.py \| grep -c 'non_armed_free_text'` | **0** ✅ |
| `grep -c "is_action_risk=True" test_ask_user_disposition.py` | **10** (≥ 8) ✅ |
| `grep -c 'kind="action_risk_approval"' test_ask_user_disposition.py` | **0** ✅ |
| `grep -c 'kind == "action_risk_approval"' test_185_engine_attachment.py` | **0** ✅ |
| Four regression-net tests unmodified (AST body compare vs HEAD) | **all 4 UNMODIFIED**, plus `_drive_failing_pre_gate` ✅ |
| A `fail_run`-named test awaits `subscribe_for_response` on an armed call | present, and observed RED under falsification ✅ |
| Receipt asserts `metadata["validator"] is None` AND `"validator" in metadata` | both, with a D-187-18 comment ✅ |
| Re-shaped criterion 18 carries a D-187-01 comment + asserts `len(definition.phases)` and every `phase_index` | yes ✅ |
| `grep -c "xfail"` in the property file | **0** — no case relaxed ✅ |
| `git diff --stat -- supabase/migrations` | **empty** ✅ |

## Deviations from Plan

### 1. [Rule 1 — measurement] Task 2's grep-shaped "unmodified" criterion returns 2, not 0 — replaced by a STRONGER measurement

- **Found during:** Task 2 acceptance check.
- **Issue:** The criterion is
  `git diff -U0 -- test_185_engine_attachment.py | grep -cE 'weak_author_spec|shutdown_on_a_NON_armed|criterion_20|freshness_pre_gate_still_fails'` → 0. Measured: **2**. Both hits are
  benign and neither is a changed line inside a regression-net test:
  1. a git **hunk-header annotation** — `@@ -169,0 +170,35 @@ def test_a_deliberately_weak_author_spec_cannot_loosen_the_gate():` — git's
     `-p` function-context label for the hunk that inserts the re-shape comment ABOVE the next test.
     Git emits it automatically; it is not editable, and the named function's body is untouched.
  2. one `+` line of **prose inside the new `_drive_armed_checkpoint` docstring** that names
     `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped` in order to explain why that
     test's driver was deliberately left alone. Deleting the sentence to satisfy the grep would make
     the file *less* honest for zero gain — the D-ITEM-183-02 prose-trap shape in reverse.
- **Fix:** the criterion's INTENT — "the four regression-net tests are unmodified" — was measured
  directly instead, with `ast.parse` over `git show HEAD:<file>` and the working tree, comparing each
  function's full source body. Result: **all four UNMODIFIED**, and `_drive_failing_pre_gate`
  (which the freshness test depends on) UNMODIFIED as well. That is strictly stronger than the grep,
  which cannot distinguish a body edit from a context label.
- **The threat is discharged, not waived.** T-187-11-02's real question is "did the armed treatment
  leak onto an author's gate?" The answer is no, from two directions: the four bodies are identical,
  and all four pass.
- **Files modified:** none beyond the task.

### 2. [Rule 1 — measurement] Task 3's `pytest tests/ → 0 failed` criterion is REFUTED by the measured tree

- **Found during:** Task 3 verification.
- **Issue:** The criterion says `pytest tests/ -q | tail -3` reports **0 failed**. That has not been
  true on this tree for some time. Measured on the full `tests/` tree at this commit: **211 failed,
  3289 passed, 1 error** — the bulk being `tests/integration`, which needs live Redis/Supabase, plus
  the standing unit rot. Measured on `tests/unit` alone: **62 failed, 1693 passed**.
- **Why the plan is still satisfied:** the criterion's real content is "this plan broke nothing", and
  the honest form of that is the delta against the baseline measured immediately before dispatch —
  **86 failed / 1668 passed**, of which 24 were this plan's three files and 62 were pre-existing rot.
  After: **62 failed / 1693 passed**, with the 62 identical file-for-file and count-for-count. The 24
  are gone and nothing else moved. Per the executor SCOPE BOUNDARY the 62 are out of scope and were
  not touched.
- **Fix:** none applied. Recorded as the honest measurement, in the same spirit as 187-06's
  Deviation 1.
- **Files modified:** none.

### 3. [Rule 2 — honesty] Two stale "7 rows" counts in the property file corrected to the measured 8

- **Found during:** Task 3, while enumerating the falsification's RED ids.
- **Issue:** The module docblock and P1's docstring both describe P2 as covering "the 7 rows
  declaring `reaches_body_without_arming=True`". Measured: **8** rows declare it (all ten cases minus
  `pre_fail_run` and `pre_skip_to_phase`), and pytest collects **8** P2 params — consistent with the
  file's own 30-test total. An inherited unmeasured count, exactly the class the standing project
  lesson warns about.
- **Why this is not a weakening:** it is prose only. No case, assertion, parametrize set or threshold
  changed; the collection count is still exactly 30 and the RED-signature section is untouched. It
  makes the file agree with what it already does.
- **Files modified:** `backend/tests/unit/test_187_armed_checkpoint_property.py`. **Commit:**
  `a8410b27`.

### 4. [Rule 3 — blocking] Two shared drive helpers were extended/added rather than edited in place

- **`_drive` in `test_ask_user_disposition.py`** is shared by the armed tests AND by
  `test_non_armed_free_text_fall_through_is_unchanged`, which must stay byte-identical. Inlining an
  armed variant per test would have duplicated the harness 8 times; editing `_drive` unconditionally
  would have changed the non-armed fence's behaviour. It gained an **optional** `is_action_risk=False`
  instead, so every non-armed caller is unmoved.
- **`_drive_failing_pre_gate` in `test_185_engine_attachment.py`** could not be re-purposed for the
  armed rows: it patches `run_gates` to FAIL, and after the hoist a failing pre gate is by
  construction an author's gate. A new sibling `_drive_armed_checkpoint` was added and the original
  left byte-identical, which is also what keeps the freshness regression net measuring exactly what
  it shipped measuring.

### Claims re-verified rather than inherited

- **187-06's diagnosis was checked, not trusted.** The claim "the property is engine-correct and only
  the drive is stale" was confirmed by observing the failure text before the fix: the awaited prompt
  really was `"Step 2 of 2, …"` against an expected `"Step 2 of 4, …"`. One keyword, 15 red → 30 green.
- **`pre_pass_fail_run_disposition` (the Pitfall-4 tripwire) is green in the fixed state and RED
  under falsification** — it does its job in both directions.
- **`armed_refused_typed` / P3 stay green in the fixed state**, so T-185-04-01 is not re-opened.
- **D-187-02 re-confirmed:** `pre_fail_run` and `pre_skip_to_phase` are green in BOTH states with the
  body un-run. A step an author's gate routes away is never approved.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-187-11-01 (Repudiation — the property's credibility) | mitigate | ✅ Falsification **observed**, not assumed: 17 red on the recorded assertions, restored, green again. Both RED sets tabulated side by side above, with the superset explained mechanically. The only edits to the file are the `total_phases` keyword (justified) and a measured prose count (Deviations 3). |
| T-187-11-02 (EoP — armed treatment leaking to author gates) | mitigate | ✅ Four regression-net tests **AST-identical** to HEAD and green; `non_armed_free_text` diff-grep **0**; `_drive_failing_pre_gate` untouched; `is_action_risk` defaults `False` on every shared helper. |
| T-187-11-03 (Repudiation — the receipt shape) | mitigate | ✅ Pinned two-sidedly: the key's PRESENCE and the value's `None`, so neither a silent drop nor an invented index can pass. |
| T-187-11-04 (EoP — the Pitfall-4 fail-open) | mitigate | ✅ Net-new helper-level test with a non-armed negative control, **and observed RED** when the short-circuit is removed. |
| T-187-11-05 (Tampering — production left falsified) | mitigate | ✅ `git status --porcelain backend/app` verified **empty** after each of the three probes and at plan end. Zero production source in any commit. |

## Known Stubs

None. Three test files, zero production source, zero migrations. Nothing hardcoded, nothing
placeholder, no unwired path.

## Threat Flags

None — no new network endpoint, auth path, file access pattern or schema change.

## Self-Check: PASSED

- `backend/tests/unit/test_ask_user_disposition.py` — FOUND
- `backend/tests/unit/test_185_engine_attachment.py` — FOUND
- `backend/tests/unit/test_187_armed_checkpoint_property.py` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-11-SUMMARY.md` — FOUND
- Commit `3dfd47a4` (Task 1) — FOUND
- Commit `5ae04111` (Task 2) — FOUND
- Commit `a8410b27` (Task 3) — FOUND
</content>
</invoke>
