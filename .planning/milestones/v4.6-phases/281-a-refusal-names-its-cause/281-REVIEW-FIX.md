---
phase: 281-a-refusal-names-its-cause
fixed_at: 2026-10-15T08:50:00Z
review_path: .planning/phases/281-a-refusal-names-its-cause/281-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 281: Code Review Fix Report

**Fixed at:** 2026-10-15T08:50:00Z
**Source review:** .planning/phases/281-a-refusal-names-its-cause/281-REVIEW.md
**Iteration:** 1

**Scope:** CR-01, WR-01, WR-02 and WR-03 only. This was the operator's decision on 2026-10-15. WR-04 is filed as BUG-261015-01 (`7cbb081b6`). IN-01 to IN-06 are not in scope.

**Summary:**
- Findings in scope: 4
- Fixed: 4. CR-01, WR-01 and WR-03 change code. WR-02 is resolved as consistent by design: its verdict is unchanged, now pinned by a test and written down in the docstring.
- Skipped: 0

Each finding has a RED test commit (`test(281): … (RED)`) followed by a fix commit. WR-02 is the exception: it changes no behaviour, so its pin test could not fail first. Instead it was driven RED against planted defects.

## Fixed Issues

### CR-01: The live run panel discards the composed cause and shows fixed copy that can name the wrong cause

**Files modified:** `frontend/src/components/panel/PhaseCard.tsx`, `frontend/src/components/panel/PhaseCard.test.tsx`
**Commits:** `feb6ff3d4` (RED), `bb077d9cc` (fix)
**Applied fix:** In `classifyFailure`'s emit arm, `reason` was always `EMIT_FAILURE_COPY[...]`. It is now `raw.length > 0 ? raw : copy.reason`. The server's composed sentence (the live `phase.error`, else the recorded `failureReason`) is the reason. The fixed copy only renders when no sentence reached the client, such as the no-validator `phase_failed`. One expression changed in a G-5 file, honoured by construction.
**RED evidence:** 3 of 4 new cases failed at `8e8f30ffd`, all with `emitFailure` and a composed reason set (the live state):
- A provider-error cause rendered the narration copy.
- The golden-run cause never named `rows`.
- A reconciled record lost to the typed copy.

The fourth case (no reason, so the fixed copy shows, and a keys-only miss never says "citation") is the control. It passed before and after.
**Tests:** `PhaseCard.test.tsx` + `WorkflowRunPage.test.tsx` + `stepIdentityVocabulary.test.ts`: 275 passed. `PhaseTimeline.test.tsx` + `PhaseReconcile.test.tsx`: 62 passed. The assertions check rendered text: "provider returned an error", no "narrated", "these fields were missing: rows", and the whole composed string as one `whitespace-pre-line` text child.

### WR-01: The header "failed after N attempts" over-counts model calls

**Files modified:** `backend/app/services/harness/emit_cause.py`, `backend/app/services/harness/phase_types.py`, `backend/tests/unit/test_281_emit_cause.py`, `backend/tests/unit/test_llm_emit_executor.py`
**Commits:** `4eeff5823` (RED), `74f5d9852` (fix)
**Status:** fixed: requires human verification (this is attempt-counting logic)
**Applied fix:**
- **`emit_cause.record_terminal()`** (new, pure). A render, integrity or unexpected cause is attached to the record of the model call it belongs to. Under a non-strict policy, the delivered rejected shot already has a record, so the cause joins it instead of adding a second record for the same call.
- **`compose_emit_failure()`.** A record with `attempt` 0 means no model call was made. It names its cause with no count. When no record is counted, the header reads `Step "X" failed:` / `This step failed:` and the bullet reads `• No template is attached … Check …`. The format with a count is unchanged.
- **`_exec_llm_emit`.** `no_template_bound` now records attempt 0. The three post-loop render arms use `record_terminal`. A new `calls_made` (set just before `forced_emit`) is passed to the backstop.
- **`_emit_unexpected_failure(…, calls=)`.** It merges into the in-flight call, or records attempt 0 when no call was made.
- **`__all__` pin.** Updated on purpose to add `record_terminal`.

No new kind, phase type, emitter or validator was added. The closed core is unchanged.
**RED evidence:** 7 failed, 1 control passed:
- Flag policy, 3 uncited shots, render fails: `This step failed after 4 attempts:` (expected 3). This is the reviewer's probe shape.
- The same shape with the render raising (the backstop): `after 4 attempts`.
- `no_template_bound` with 0 calls: `This step failed after 1 attempt:`.
- An exception before any model call: `Step "Write the report" failed after 1 attempt:`.
- 3 composer-level cases: `record_terminal` was missing, and an attempt-0 record still read as 1 attempt.

The control (gate passed, then render failed, 1 call, reads `1 attempt`) passed before and after. The reviewer's scratch probe (`probe_281_count.py`) now prints `FORCED CALLS: 3` / `This step failed after 3 attempts:`.
**Tests:** these suites, 152 passed:
- `test_llm_emit_executor.py`
- `test_281_emit_cause.py`
- `test_281_engine_cause_precedence.py`
- `test_281_freshness_retrievable.py`
- `test_freshness.py`
- `test_256_finish_run_unchanged.py`
- `test_214_describe_vocabulary.py`
- `test_260828_09_publish_names_the_failing_step.py`
- `test_emit_single_owner_persist.py`
- `test_256_llm_emit_rollup.py`

There is one failure next to this work. `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key` fails with `_fake_stream() got an unexpected keyword argument 'usage_box'`. It was already failing before this fix: with the WR-01 files stashed, it fails the same way at HEAD. It is not caused by this change.

### WR-02: The freshness gate passes when every document in scope is archived

**Files modified:** `backend/tests/unit/test_281_freshness_retrievable.py`, `backend/app/services/harness/freshness.py` (docstring only)
**Commits:** `e1eaa88c0` (pin test), `9ef863d28` (docs)
**Branch taken: CONSISTENT BY DESIGN. The verdict is not changed.** The operator should see this decision. The evidence that passing an empty folder is the designed behaviour:
- **`102-03-PLAN.md:195`** (the plan that created the leaf) says `newest_document_age_days` returns "None when the scope is empty". **`102-03-PLAN.md:257`** specifies the validator condition word for word: `if age is not None and age > max_age_days -> GateResult(False, …)`. In the same plan, **`:255`** fails closed only when there is *no scope*.
- **`freshness.py` docstring**, written at origin commit `8dc5c91e2` (2026-06-12) and unchanged since: *"an empty scope is 'no freshness signal', NOT stale — the validator decides what to do with `None`"*. `git log -S` shows the validator's `age is not None` line has existed only since `795fe10c4` (102-03), as specified.

So a folder with no document an agent may read has nothing stale in it. An all-archived folder now gets exactly the empty-folder verdict. What DEBT-07 / D-20 forbids is an archived document's date deciding the verdict, and that cannot happen on either path.

**Applied:**
1. Two pin tests, using a fake `documents` table that applies the imported predicate:
   - All-archived gives the same `(passed, error_message)` as an empty scope, and the empty scope passes.
   - Control: the same 400-day-old document marked readable fails with `freshness:staleness|`.
2. A paragraph in the `newest_document_age_days` docstring that records the decision. It avoids the lowercase word the existing "rule is never restated" fence forbids. My first draft tripped that fence, and I fixed it in the same commit.

**RED evidence:** this is a characterization pin, so it cannot be RED against unchanged code. It was instead driven RED against two plants, and each plant was restored md5-identical:
- (1) The predicate dropped from `_NEWEST_SQL` (DEBT-07 reverted): the all-archived case reads stale, so the test fails.
- (2) The reviewer's suggested fail-on-`None` arm added to `validator_kinds.py`: the empty-scope verdict flips, so the test fails.

**Tests:** `test_281_freshness_retrievable.py` + `test_freshness.py`: 11 passed.
**If the operator prefers fail-closed:** that is a design reversal of Phase 102. It would be the one-arm `validator_kinds.py` edit the reviewer sketched, and plant (2) above proves this pin would flag that change on purpose.

### WR-03: The describe door's catch arm shows any thrown text as the author's sentence

**Files modified:** `frontend/src/lib/api/_core.ts`, `frontend/src/lib/api/workflows.ts`, `frontend/src/components/workflows/describeRefusalVocabulary.ts`, `frontend/src/components/workflows/useTemplateFirstDraft.ts`, plus tests in `describeRefusalVocabulary.test.ts`, `useTemplateFirstDraft.test.tsx`, `lib/api/__tests__/entitlementRefusal.test.ts` and `pages/WorkflowBuilderPage.test.tsx`
**Commits:** `9acd0fd56` (RED), `f33faaf46` (fix)
**Applied fix:**
- **`_core.ts`.** New `EntitlementRefusalError`, the typed signal that the message is the sentence `entitlementRefusalMessage` wrote for a person. `generateWorkflow` throws it on a tier 403. Every other non-OK response still throws a plain `Error("Failed to generate workflow (status N)")`.
- **`describeRefusal`.** The new client-only `ENTITLEMENT_REFUSED_KEY` renders the detail verbatim (D-24). `REQUEST_FAILED_KEY` now returns the table's fallback sentence and next step (`Something stopped the draft from being written.` / `Try again.`), with the raw text as `technicalDetail`. The page shows it only under the technical-names reveal.
- **The hook's catch arm.** It picks the key with `instanceof EntitlementRefusalError`. The class is imported from `@/lib/api/_core`, not the barrel, because several page suites mock `@/lib/api` wholesale.
- **Existing tests.** The D-24 entitlement cases now throw the typed error.

**RED evidence:** 11 failed / 114 passed across the 4 suites. For example, the page rendered `Failed to fetch` where `Something stopped the draft from being written.` was expected. A plain thrown `Your plan doesn't include…` now also reads the fallback: only the typed signal is trusted.
**Tests:** the 4 WR-03 suites: 125 passed. 13 neighbouring suites also passed, including `WorkflowDoorSwitch` (`?raw` fences), `WorkflowBuilderPage.{header,preDraft.baseline,describe}`, `PublishGauntlet`, `toolReadOnlyMap`, `api.workflows`, `ChatLayoutLaunch` and `WorkflowDoorSwitch.baseline`.

`WorkflowBuilderPage.canvas.test.tsx` failed one canvas click case once ("clicking Canvas flips aria-selected…"). That run had 14 files going at once. Run alone, the suite passes 154/154. The case touches nothing in this change, so I read it as a timing flake under load, not a regression.
**Rendered-words assertions:** with technical names OFF, the `p.font-medium` text equals the fallback sentence, the next step is present, the raw text is absent and there is no `.font-mono`. With technical names ON, `.font-mono` contains `Failed to fetch` beside the unchanged sentence.

## Verification summary

- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit` set-diffed (`comm -13`, sorted) against `tsc_base_95c62fc83.txt`: **0 added lines** after CR-01 and after WR-03 (103 lines total, all present at base).
- **Hot-file ledger:** `node scripts/check-hot-file-ledger.cjs 281` gives `ledger gate OK — every watched file has a row.` (scan list 537 rows · subject 43 files · watched 17), exit 0.
- **Commits:** every commit was made by explicit path and checked with `git show --stat HEAD`. The operator's own uncommitted files were never staged.
- **Working tree:** I worked in the main working tree on `develop`, as the orchestrator instructed. No worktree or recovery sentinel was created.

---

_Fixed: 2026-10-15T08:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
