---
phase: 281-a-refusal-names-its-cause
reviewed: 2026-10-14T21:45:15Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - backend/app/services/harness/emit_cause.py
  - backend/app/services/harness/freshness.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness_engine.py
  - backend/app/services/workflow_authoring.py
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/workflows/describeRefusalVocabulary.ts
  - frontend/src/components/workflows/publishBlockedStep.ts
  - frontend/src/components/workflows/PublishBlockedStepCard.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/runVocabulary.ts
  - frontend/src/components/workflows/useTemplateFirstDraft.ts
  - frontend/src/lib/api/knowledge.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/types/index.ts
  - backend/tests/integration/test_214_argument_seams.py
  - backend/tests/unit/test_214_describe_vocabulary.py
  - backend/tests/unit/test_256_finish_run_unchanged.py
  - backend/tests/unit/test_281_emit_cause.py
  - backend/tests/unit/test_281_engine_cause_precedence.py
  - backend/tests/unit/test_281_freshness_retrievable.py
  - backend/tests/unit/test_llm_emit_executor.py
  - frontend/src/components/panel/PhaseCard.test.tsx
  - frontend/src/components/workflows/describeRefusalVocabulary.test.ts
  - frontend/src/components/workflows/publishBlockedStep.test.ts
  - frontend/src/components/workflows/PublishBlockedStepCard.test.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
  - frontend/src/components/workflows/runVocabulary.test.ts
  - frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  - frontend/src/pages/__tests__/WorkflowsPage.navGuard.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.test.tsx
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 281: Code Review Report

**Reviewed:** 2026-10-14T21:45:15Z
**Depth:** standard
**Files Reviewed:** 36 (17 source, 19 test files read for vacuous or false-green assertions)
**Status:** issues_found

## Summary

I reviewed `git diff 95c62fc83..HEAD` for the listed files. `backend/app/api/documents.py` and
`test_261014_*` were out of scope, as instructed.

**Parts that hold up:**
- The composer leaf (`emit_cause.py`) is pure.
- The engine precedence is correct: the executor's diagnosis beats the post-gate validator, the
  `Phase N (slug)` prefix is dropped, and `_attempt_identity` keeps the identical-output
  short-circuit.
- `template_fields_missing` is never worded as "citation" on the composer or the `PhaseCard` copy.
- The describe-door refusal never prints a server code with technical names off.
- Both new navigations (golden-run link, connect control) go through `canLeaveBuilderRef`.
- `reason_code` reaches the wire. `api/workflows.py:1913` returns the service dict unchanged.

I ran the three `test_281_*` backend suites: 48 passed.

**Defects found:**
- **CR-01 (BLOCKER):** D-04's "one string, everywhere" is not delivered on the live run panel.
  While a run streams, `PhaseCard` drops the composed cause and shows fixed copy keyed off the
  last invocation's failure value. For a provider error that copy names the wrong cause ("it
  narrated prose or was cut off"). Pitfall 9 was fixed in the composer, but this surface still
  shows the old cause.
- **WR-01:** the attempt total over-counts model calls on the non-strict deliver path. I drove
  this with a probe: 3 forced calls produced the header `failed after 4 attempts`.
- **WR-02:** the freshness gate now fails open (passes) when every document in scope is archived.
- **WR-03:** the describe door's catch arm shows any thrown string, including
  `Failed to generate workflow (status 500)` and the browser's `Failed to fetch`, as the
  author-facing sentence.
- **WR-04:** a validated emit failure still writes N+1 chat messages with different attempt totals.

## Critical Issues

### CR-01: The live run panel discards the composed cause and shows fixed copy that can name the wrong cause (D-04 unmet on the run page)

**File:** `frontend/src/components/panel/PhaseCard.tsx:291-294` (with `frontend/src/providers/StreamsProvider.tsx:1412-1418` and `backend/app/services/harness/phase_types.py:1650`)

**Issue:** D-04 names three surfaces that must show one string: the gauntlet's `blocked_step`
reason, the chat failure message, and **the run page's failed step**. The run page
(`WorkflowRunPage` → `PhaseTimeline` → `PhaseCard.classifyFailure`) reads the typed
`phase.emitFailure` **first** and returns `EMIT_FAILURE_COPY[...]`.

On a live run, `emitFailure` is always set. Every executor failure arm emits `phase_substep`
with a `failure` value, and `onPhaseSubstep` writes it into the store. So the composed cause
never renders on the live run page:

1. **Wrong cause for a provider error.** `classify_forced_failure` words a provider error as
   *"the model provider returned an error"*. The failure VALUE stays `model_failed_to_emit`
   (`phase_types.py:1650`), so the live card reads *"The model did not emit a structured
   field-map (it narrated prose or was cut off)"*. That is the exact miswording this phase's
   Pitfall 9 removed from the composer.
2. **The least informative cause wins by being last, again.** The golden-run shape (7 calls
   missing `rows`, then 2 narrated) ends on a narrated invocation. The live card reads only the
   narration copy, and `rows` is never named, which also breaks D-02 on this surface.
3. **The `template_fields_missing` copy names no fields.** It reads *"some of its fields were
   missing"* (`PhaseCard.tsx:251-256`), not the placeholder names D-02 requires.

The `whitespace-pre-line` added at `PhaseCard.tsx:781` only takes effect on the reconciled
(`fromRecord`) arm, which renders only after a reload. 281-03-SUMMARY says *"The server's
multi-line cause now displays line by line on both the gauntlet card and the run panel"*. On the
live path that is not true.

The new PhaseCard test (`PhaseCard.test.tsx` "a reconciled run's composed two-line cause renders
VERBATIM") covers only `error: undefined, failureReason: CAUSE`. No case renders a card with
both `emitFailure` and a composed reason, which is the live state.

**Fix:** let the server's sentence win whenever one is present, and keep the closed-taxonomy copy
only as the never-empty fallback:
```tsx
if (phase.emitFailure && phase.emitFailure in EMIT_FAILURE_COPY) {
  const copy = EMIT_FAILURE_COPY[phase.emitFailure]
  // D-04: the composed cause (live gate_failed.error, or the recorded _failure_reason) IS the
  // reason; the fixed copy is only the fallback when no sentence reached the client.
  return {
    kind: phase.emitFailure,
    reason: raw.length > 0 ? raw : copy.reason,
    where: `phase: ${slug} · ${copy.where}`,
  }
}
```
Pin it with a case that sets `emitFailure: "model_failed_to_emit"` together with
`error: <composed provider-error cause>`. Assert the rendered text contains "provider returned an
error" and does not contain "narrated". The no-validator branch emits `phase_failed` with no
reason, so `raw` is empty there and the fixed copy still renders, which is correct.

## Warnings

### WR-01: The header "failed after N attempts" over-counts model calls when a non-strict policy delivers a rejected shot that then fails to render (D-25)

**File:** `backend/app/services/harness/phase_types.py:1699-1710, 1814-1815, 1916, 1930-1932` and `phase_types.py:1386` (`_emit_unexpected_failure`)

**Issue:** D-25 says an attempt is one model call, and `compose_emit_failure` uses
`total = len(records)`.

- **Non-strict double count.** Every rejected shot appends a record (`:1699`) *before* the
  `citation_policy` decision. Under `flag`/`partial`/`draft`, the last rejected shot is delivered
  to the render. If the render or the integrity re-open then fails, a **second** record is
  appended for the same `attempt` (`:1916`, `:1930`).
  - Driven with a scratch probe: `citation_policy="flag"`, 3 uncited shots, render returns
    `status: failed`. Result: **3 forced calls**, and the message reads
    `This step failed after 4 attempts:` / `• 3 attempts — the citation check failed…` /
    `• 1 attempt — the template could not be filled in: boom…`.
- **Same over-count in the backstop.** `_emit_unexpected_failure` always appends
  `shot_record(len(causes) + 1, …)`. An exception raised after a rejected-then-delivered shot
  counts that call twice.
- **Zero-call paths read "1 attempt".** An exception raised before any model call (e.g. while
  resolving the template), and the `no_template_bound` arm (`:1520`), both report
  "failed after 1 attempt" when no model was called.

**Fix:** attach a terminal cause to the shot it belongs to instead of appending a new shot:
```python
def _record_terminal(records, attempt, kind, detail=None):
    if records and records[-1]["attempt"] == attempt:
        records[-1]["kinds"].append(kind)          # same model call, a second cause
        if detail is not None:
            records[-1]["detail"] = str(detail)
    else:
        records.append(shot_record(attempt, [kind], detail=detail))
```
In the backstop, append only when the last record is not the in-flight attempt. For the zero-call
arms, either word the header without a count or record `attempt=0` and have the composer drop the
count when no call was made. Add a non-strict render-failure case to `test_llm_emit_executor.py`.

### WR-02: The freshness gate now passes (fails open) when every document in scope is archived or gone at the source

**File:** `backend/app/services/harness/freshness.py:79-83` with `backend/app/services/harness/validator_kinds.py:717-718`

**Issue:** `newest_document_age_days` returns `None` when no row matches. The validator treats
`None` as "not stale" (`if age is not None and age > max_age_days`) and returns
`GateResult(True, None)`.

Before 281, a folder whose only document was an old archived file failed `freshness:staleness`.
With the retrievable filter, the same folder has zero matching rows, so the gate **passes**. The
step then runs against a scope where retrieval can return nothing. DEBT-07 was meant to stop
archived rows from making a stale folder read FRESH. This is the same "reads fresh" outcome
reached from the other side, and no test covers it: the recording pool always returns
`{"newest": None}`, and no case asserts the verdict.

**Fix:** decide this explicitly rather than inherit it. The safer reading is to fail the gate with
a worded reason when the scope has no retrievable document. That needs a one-arm edit in
`validator_kinds.py` (a G-5 file, so record it as honoured by construction):
```python
age = await newest_document_age_days(pool, folder_ids)
if age is None:
    return GateResult(False, "freshness:staleness|no readable source in scope")
```
If pass-on-empty is intended, write that down in `freshness.py`'s docstring and pin it with a
test, so the behaviour change is visible.

### WR-03: The describe door's catch arm shows any thrown text as the author's sentence, including a status code or the browser's "Failed to fetch"

**File:** `frontend/src/components/workflows/describeRefusalVocabulary.ts:137-141`, `frontend/src/components/workflows/useTemplateFirstDraft.ts:630-634`

**Issue:** D-24 allows exactly one thrown message to render as is: a sentence the **server**
wrote for a person (the entitlement refusal). The hook stores **every** thrown `e.message` under
`REQUEST_FAILED_KEY`, and `describeRefusal` renders it as the headline sentence:

- `generateWorkflow` throws `Failed to generate workflow (status 502)` for any non-entitlement
  non-OK response (`lib/api/workflows.ts:963`). The hook's own test pins that string as the
  detail (`useTemplateFirstDraft.test.tsx`, "…status 502").
- `fetch` rejects with `TypeError: Failed to fetch` on a network error.

With technical names OFF, the author reads `Failed to generate workflow (status 502)` or
`Failed to fetch` as the explanation. That is a machine-flavoured string, not the table's
sentence, which is the gap SEED-221 / D-15 exist to close. `technical` and `technicalDetail` are
both `null` on this arm, so even the reveal cannot show the raw text beside a real sentence.

**Fix:** carry the entitlement sentence as a typed signal rather than "whatever was thrown". For
example, throw an `EntitlementRefusalError` from `generateWorkflow` when
`entitlementRefusalMessage` matched, and render every other throw as the fallback sentence with
the message behind the reveal:
```ts
if (key === REQUEST_FAILED_KEY) {
  return { ...REFUSAL_FALLBACK, technical: null, technicalDetail: detail ?? null }
}
// new client-only key for the server-worded refusal:
if (key === ENTITLEMENT_REFUSED_KEY && detail?.trim()) {
  return { sentence: detail, next: REFUSAL_FALLBACK.next, technical: null, technicalDetail: null }
}
```

### WR-04: A validated emit failure still writes N+1 assistant messages to chat, with different attempt totals

**File:** `backend/app/services/harness/phase_types.py:1651, 1741, 1764` (one surface per executor invocation) and `backend/app/services/harness_engine.py:2473` (the engine's `fail_run` surface)

**Issue:** for an emit step with a declared validator, each engine attempt runs the executor,
and each executor failure calls `_surface_failure_message`, which inserts a message row. The
engine's `fail_run` branch then inserts one more with `outcome.reason`.

For the golden-run shape, the thread now reads `This step failed after 3 attempts:` three times,
followed by `This step failed after 9 attempts:`. That is two different totals for one failure,
in the one surface D-04 says carries "one string". CONTEXT's established pattern also says
*"The `_surfaced` single-writer flag on emit failures: one persist, one message. D-04 must keep
it."* `_surfaced` only guards the success surface (`harness_engine.py:437`).

RESEARCH §Finding 1 and Open Question 3 measured this and recommended leaving it. However, no
seed, bug report or owed row records it, and before 281 the four messages did not disagree on a
count, because the executor messages carried no total.

**Fix:** the minimal fix is to suppress the executor's per-invocation surface when the engine
will retry or route. For example, set a ctx flag in `_run_phase_with_gates` while
`attempt < phase_max_retries`, and have `_surface_failure_message` in `phase_types` skip on it.
The final engine message is then the only one, and it equals the gauntlet's cause. If that is
deferred, plant a seed with a concrete `trigger_when` so the gap has a home.

## Info

### IN-01: Frontend test fixtures retype an invented "composed cause" format instead of the composer's real output

**File:** `frontend/src/components/panel/PhaseCard.test.tsx` (281-03 block, `CAUSE`), `frontend/src/components/workflows/PublishGauntlet.test.tsx` (`COMPOSED_CAUSE`)

**Issue:** both fixtures use `failed after 2 attempt(s):` and `• 2 attempt(s) — the model left
template fields empty.` The composer never emits `attempt(s)` (D-25 dropped it), and no
`emit_cause` sentence reads "left template fields empty". The tests do check a verbatim render,
so they are not false greens, but a format change on the server cannot fail them.

**Fix:** copy one real composed string, such as the one pinned in 281-01-SUMMARY, into a shared
fixture, and note where it came from.

### IN-02: The retry feedback wraps the author-facing cause in "… {cause}. Fix it."

**File:** `backend/app/services/harness_engine.py:1204`

**Issue:** the composed cause ends with a "Check …." line, so the model reads `…produces.. Fix
it.` with a double period. It also receives author-directed "Check which model this step uses"
lines and the step's header. This is harmless model input, but D-26 frames it as a deliberate
model-input change, so the wording deserves a deliberate shape.

**Fix:** `f"Previous output failed validation:\n{cause}"`, or strip a trailing period before
appending.

### IN-03: `compose_emit_failure` tests the stripped name but interpolates the raw one

**File:** `backend/app/services/harness/emit_cause.py:277-281`

**Issue:** `name = step_name.strip()` decides the branch, but the f-string prints `step_name`.
Today's callers pass `_clean_label` output, which is already trimmed. A future caller passing a
padded name would print the padding, and an embedded `"` would print as `Step ""X"" …`.

**Fix:** interpolate `name`.

### IN-04: Redundant function-local `_clean_label` imports with a cycle justification that the module itself contradicts

**File:** `backend/app/services/harness/phase_types.py:1381, 1494`

**Issue:** `phase_types.py:78` already imports `_clean_label` at module top. Its comment there
says this is safe because `publish_service` has no app-level module-top imports. The two new
function-local re-imports (`# noqa: PLC0415 — the harness package cycle`) shadow that name and
cite a cycle that the module-top comment says does not exist.

**Fix:** delete both local imports and use the module-level name.

### IN-05: The run link and the next-step line name the same run two ways

**File:** `frontend/src/components/workflows/publishBlockedStep.ts:169-170` vs `PublishGauntlet.tsx:411`

**Issue:** on one refused-publish card, `BLOCKED_STEP_NEXT` says *"Open the **trial** run…"*
while the control directly below it reads *"Open the **golden** run that was judged ›"*. Also,
`doorVocabulary.ts:535` still says *"connect it in Settings"* while the wired control now lands
on Connections. 281-03 recorded this as a known residual.

**Fix:** use one noun in both places. When `doorVocabulary.ts` next opens, re-word the
DOOR_REFUSAL destination.

### IN-06: The import-time identifier guard in `freshness.py` is an `assert`

**File:** `backend/app/services/harness/freshness.py:42`

**Issue:** `assert RETRIEVABLE_COLUMN.isidentifier()` is removed under `python -O`, so T-281-01's
runtime guard disappears in an optimised build. The constant is a fixed literal today, so the
risk is low.

**Fix:** `if not RETRIEVABLE_COLUMN.isidentifier(): raise RuntimeError(...)`.

---

_Reviewed: 2026-10-14T21:45:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
