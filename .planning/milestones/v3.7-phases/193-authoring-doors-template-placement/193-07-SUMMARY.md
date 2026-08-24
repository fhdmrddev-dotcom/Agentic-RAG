---
phase: 193-authoring-doors-template-placement
plan: 07
subsystem: frontend / workflows library — the Run launch modal
tags: [AUTH-03, D-17, D-18, D-19, D-20, D-21, D-25, WFIN-01, a11y, characterization-baseline]
requires:
  - "193-02 — templateAdmission(): the three-state predicate (soulData.ts)"
  - "193-02 — RUN_TEMPLATE_LABEL (library/libraryVocabulary.ts)"
  - "193-01 — the launch-failure case captured BEFORE this cut (RunModal.test.tsx)"
provides:
  - "The labelled, conditionally-rendered template block in library/RunModal.tsx"
  - "run-template-label — a stable testid for D-18's label, asserted as a TEXT NODE"
  - "Four-arm render coverage of templateAdmission at the rendered surface"
  - "RECAPTURE_SHA_193_07 — the six DOM baselines re-taken once, beside the original CAPTURE_SHA"
affects:
  - "frontend/src/components/workflows/library/RunModal.tsx"
  - "frontend/src/pages/__tests__/RunModal.test.tsx"
  - "frontend/src/pages/__tests__/RunModal.a11y.test.tsx"
tech-stack:
  added: []
  patterns:
    - "Isolated-render idiom (192-06) for per-arm coverage — no page feed involved"
    - "Shared assertion helper so two arms' identical treatment is mechanical, not promised"
    - "Capture → dump to file → substitute BY SCRIPT; never hand-edit a baseline string"
key-files:
  created: []
  modified:
    - "frontend/src/components/workflows/library/RunModal.tsx (+73 / −1 — the ONLY deletion is the import line)"
    - "frontend/src/pages/__tests__/RunModal.test.tsx (+306 / −9 across two commits)"
    - "frontend/src/pages/__tests__/RunModal.a11y.test.tsx (+90 / −0)"
decisions:
  - "The gate is `templateAdmission(def) !== \"does-not-admit\"` — hide ONLY on a positive no (D-20), deliberately the opposite of the card's fallback (D-15)"
  - "`run-upload-error` is gated by `launchError` ALONE and keeps its exact DOM position; the wrapper's `(showTemplate || launchError)` disjunction can only ADD its home, never remove it"
  - "Indentation inside the new gates is deliberately left at pre-193 depth so D-19's security sentence stays out of this commit's diff"
metrics:
  duration: "~55 min"
  completed: "2026-08-13"
  commits: 3
  tasks: 3
  tests_added: 11
---

# Phase 193 Plan 07: The Run-modal template control — named, and shown only to workflows that can use it — Summary

Turned the nameless quiet upload button into a labelled *Template to fill* input, hid it on the 34
published rows that positively cannot fill a template, left it exactly as-is on the 110 whose
definition says nothing — and lifted the launch-error node out of the cut so a failed run is still
visible on a workflow that never had a template control at all.

**Base SHA:** the worktree spawned on `fda79214` (merge-base `3781a3fe`), NOT the dispatched base —
6 of 6 agents in this phase, and this one too. `git reset --hard d6480ea6` corrected it, and
`bootstrap-worktree.sh` was re-run afterwards. All work sits on `d6480ea6`.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `afd3e907` | The label, the render condition, the launch-error node lifted out |
| 2 | `87889e13` | Four-arm render coverage + both RED plants |
| 3 | `3ee9b3fd` | The one deliberate re-capture + the a11y guard |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **33** — the measured baseline, unmoved |
| `vitest run src/pages/__tests__/ src/components/workflows/library/` | **14 files / 538 tests, 0 failed** |
| `vitest-count-gate.cjs` (GSD_VITEST_MAX_WORKERS=4) | **exit 0** · total 3518 · `failed 0` · 67/67 pinned present · no `[count-decrease]` |
| `eslint` (both configs) on all three files | **0 / 0** |
| `librarySubtree.fences.test.ts` | 118 passed (F1/F4/F5/T-192-04 unmoved) |
| `RunModal.test.tsx` | 33 → **40** cases |
| `RunModal.a11y.test.tsx` | 16 → **20** cases |

Count-gate delta is fully accounted: 3507 → 3518 = **+11** = RunModal.test.tsx +7 and
RunModal.a11y.test.tsx +4. No other file moved.

## The three RED plants — every one driven against real production source, every one restored md5-identical

`RunModal.tsx` md5 before the first plant and after every restore: **`a0858e4256aa11cf6dbc790b846278cc`**
(unchanged across all three cycles; `git status` confirmed the file clean against its committed state
after each).

| # | The plant | Observed failure |
|---|---|---|
| 1 | `showTemplate = templateAdmission(def) === "admits"` (i.e. hide on `unknown` too) | `TestingLibraryElementError: Unable to find an element by: [data-testid="run-template-label"]` at `expectTemplateBlockPresent  RunModal.test.tsx:1045:31`, from the `unknown` row at `:1095:5` |
| 2 | `{showTemplate && launchError && (` — the error node moved back inside the conditional | `TestingLibraryElementError: Unable to find an element by: [data-testid="run-upload-error"]` at `RunModal.test.tsx:900:39` — **the `193-01` case, which provably predates this cut** |
| 3 | `<label htmlFor="run-template-input">` + `id` on the hidden input | `AssertionError: expected 'LABEL' not to be 'LABEL'` at `RunModal.a11y.test.tsx:437:31` **and** `AssertionError: expected 1 to be +0` at `:458:57` |

⚠ **Plants 1 and 2 fail as `TestingLibraryElementError`, not `AssertionError`.** The plan asked for "a
real `AssertionError`". Both are genuine, located, non-flaky failures of the row that names the
property — but the exception class is stated rather than glossed, because a summary that reports the
class it was asked for instead of the class it observed is the beginning of a fiction.

⚠ **Plant 3's most useful finding is what did NOT go red: `axe` passed.** The `no aXe structural
violations` row was green with a `<label htmlFor>` bound to a `className="hidden" tabIndex={-1}`
input. So the a11y regression D-18 risks is invisible to the automated scanner already in this file,
and the three explicit rows are not belt-and-braces — they are the only thing that catches it.

## The six per-capture diff summaries (Task 3)

Measured **before** substitution by a script that reads the committed baseline strings out of the test
source and removes only the inserted node. Captured **twice**, and the two runs agreed byte for byte
(md5 `e7220729326cc32891dd20fc2eaceba8` both times).

The inserted node, identical in all six and taken from the capture rather than typed:

```html
<p data-testid="run-template-label" class="px-0.5 text-[13px] font-medium text-foreground">Template to fill</p>
```

| Capture | old → new | delta | after removing the label node |
|---|---|---|---|
| `BOUND_WITH_FOLDERS` | 3156 → 3267 B | +111 | **byte-identical to the 192-03 capture** |
| `UNBOUND_NO_PROJECT` | 3177 → 3288 B | +111 | **byte-identical** |
| `NO_FOLDERS_SCOPE_HIDDEN` | 2711 → 2822 B | +111 | **byte-identical** |
| `TEMPLATE_STAGED` | 3403 → 3514 B | +111 | **byte-identical** |
| `LAUNCH_ERROR` | 3281 → 3392 B | +111 | **byte-identical** |
| `SUBMITTING` | 3181 → 3292 B | +111 | **byte-identical** |

**`LAUNCH_ERROR` is the row that proves the cut went AROUND the error node rather than past it.**
`run-upload-error` keeps its exact DOM position — same parent, still between the control and the
provenance line. Had the error node been re-homed as a sibling of the removed wrapper (the obvious
reading of "lift it out"), that capture would have differed beyond the label and the check would have
refused the substitution. The structure that satisfies both D-17 and the "only the label" delta is:
`showTemplate` gates the label, the input, the control and the provenance line; the error `<p>` is
gated by `launchError` alone; the wrapper exists when either is true.

## ⚠ THIS PLAN'S TEST DIFF HAS DELETIONS, AND THAT IS LEGITIMATE EXACTLY HERE

`git diff --numstat` on `RunModal.test.tsx` across the two test commits reports **9 deletions**, in a
file whose own header says re-capturing "deletes the only evidence the modal still renders what it
rendered". Every one is named rather than absorbed:

- **6** — the six `RUN_MODAL_HTML_BASELINE` strings, replaced by script. The header's warning is
  about a MOVE, where re-capturing is circular. `193-07` is the first commit in this file's life that
  *intentionally* changes what the modal renders, and the delta was proved to be one node before a
  single string was written. The original `CAPTURE_SHA` stays in the file; `RECAPTURE_SHA_193_07`
  (`87889e13…`) is added **beside** it with the rationale, not instead of it.
- **1** — the `BOUND_WITH_FOLDERS` marker-row title, which now names the LABEL it asserts.
- **2** — the `193-01` case's trailing measurement. See below; this one is a correction to the plan.

## Deviations from Plan

### 1. [Correction on measurement] The `193-01` case could NOT pass unedited — its own inputs prove it

`193-07-PLAN.md` Task 2 required: *"the launch-failure case authored in `193-01` … must still pass,
unedited. Verify `git diff -U0` shows no change to it. If it needed editing, the render condition cut
through the error node and the fix belongs in Task 1."*

**Measured, the criterion is false, and not because the cut went through the error node.** That case's
final two lines were:

```js
const provenance = within(modal).getByTestId("run-provenance")
expect(alert.parentElement).toBe(provenance.parentElement)
```

Its fixture is a **`does-not-admit`** workflow. D-17 removes the upload control there — and D-19 says
the provenance line *travels with the control* ("where the control is hidden there is no upload to
describe"). So `getByTestId("run-provenance")` throws, and the old measurement cannot be evaluated at
all. Observed exactly that: `TestingLibraryElementError: Unable to find an element by:
[data-testid="run-provenance"]`, with the six assertions above it all passing.

**`193-01`'s own author predicted this in the case's comment:** *"When that cut lands, this
relationship is expected to CHANGE (the alert must move out) — and the assertions above are what force
it to move rather than vanish."* So the criterion contradicts the artifact it was written to protect.

**What was done:** all six core assertions — the alert is found, `role="alert"`, the verbatim server
message, never the `"Run failed"` fallback, and both fixture non-vacuity guards — are **byte-identical
to the day `193-01` wrote them**. Only the trailing measurement is restated, in the direction its
author named: the provenance note is gone, the upload control is gone, and the alert is still there.
The original two lines are quoted verbatim inside the amending comment rather than deleted, so a
reader can see what was measured and why it stopped being measurable.

### 2. [Rule 3 — the 187-24 prose trap, firing for the third and fourth time in this phase]

Two acceptance criteria were written as raw greps that a file's own honest documentation trips.
Both are corrected by **anchoring or rewording the check**, never by mutilating the prose.

- **`grep -c "<label" RunModal.tsx` unchanged from pre-edit.** Pre-edit **2**, post-edit **3** — and
  the third hit is the comment sentence *"A TEXT NODE, never a `<label htmlFor>`"*, i.e. the prose
  that exists to prevent the exact regression. Corrected to an anchored element match:
  `grep -cE '^ *<label ' ` → **2 before, 2 after**. No `<label>` element was introduced.
- **`git diff -U0 … | grep -c "Stored untrusted"` → 0.** First measurement returned **1**, and the
  single hit was my own new comment quoting the criterion — self-referential. The comment was reworded
  to describe the check without spelling the sentence (the `librarySubtree.fences.test.ts` T-192-04
  discipline, verbatim in spirit). Re-measured: **0**.

### 3. [Design choice, recorded because it is not the plan's literal wording]

The plan said to keep the error node "as a sibling that always renders". Implemented as: the error
`<p>` is gated by `launchError` **alone**, inside a wrapper whose condition is
`(showTemplate || launchError)`. The property the plan asked for holds — the error node's rendering is
independent of `showTemplate`, driven RED to prove it — and this shape additionally (a) preserves the
shipped DOM order so the `LAUNCH_ERROR` capture's delta is only the label, and (b) avoids an
always-rendered empty `<div>` costing a `gap-3` row of whitespace on a workflow whose control is meant
to be ABSENT. The reasoning is written beside the code, not only here.

### 4. [Formatting, deliberate and documented in-file]

Content inside the two new gates is **not re-indented**. That keeps D-19's security sentence out of
this commit's diff entirely, so "the provenance line was not touched" is mechanically checkable. The
whole source change is consequently **+73 insertions / −1 deletion, and the single deletion is the
import line** — no shipped JSX line was rewritten. A comment asks the next reader not to tidy it.

## Threat register — dispositions

| Threat ID | Status | Evidence |
|---|---|---|
| T-193-26 (DoS of a shipped capability) | **mitigated** | `!== "does-not-admit"`; the `unknown` row calls the SAME `expectTemplateBlockPresent` helper as `admits`; RED plant 1 |
| T-193-27 (a launch failure leaving no trace) | **mitigated** | error node gated on `launchError` alone; RED plant 2 against `193-01`'s pre-dating case |
| T-193-28 (the D-19 sentence reworded) | **mitigated** | `git diff -U0 \| grep -c` → 0; the byte-exact sentence asserted in `expectTemplateBlockPresent` and in all six re-captured baselines |
| T-193-29 (a `<label htmlFor>` on a hidden input) | **mitigated** | `tagName !== "LABEL"`, no `label[for]` in the dialog, no `id` on the input, focus order unmoved; RED plant 3. ⚠ `axe` did NOT catch it |
| T-193-30 (baselines re-captured to hide a regression) | **mitigated** | six per-capture diffs published above; the only permitted delta was proved before substitution; both SHAs retained |
| T-193-SC (package installs) | **mitigated** | **zero packages installed** |

## The human half — UAT rows still owed

This plan's automated coverage does not discharge the G-4 rows. Two are owed:

- **U4** — the labelled control's lived appearance. **MUST be driven against
  `ephemeral-template-fill-101uat`**: it is the ONLY published slug in the local library that scores
  `admits` (1 of 145). A scoreboard driving any other row cannot see this feature at all. Pair it with
  a **non-admitting** row to see the control ABSENT, and — worth adding — a `phases: []` row to see it
  present on `unknown`, which is 110 of 145 rows and the arm most likely to be misread as a bug.
- **U7** — a launch failure on a **hidden-block** workflow: the run must fail visibly. This is the
  lived-experience half of RED plant 2.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change. The uploaded template
remains stored untrusted and is never routed to the Jinja engine (Phase 152); this plan changes only
who is offered the control.

## Self-Check: PASSED

- `frontend/src/components/workflows/library/RunModal.tsx` — FOUND
- `frontend/src/pages/__tests__/RunModal.test.tsx` — FOUND
- `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` — FOUND
- `afd3e907` — FOUND · `87889e13` — FOUND · `3ee9b3fd` — FOUND
- `.planning/STATE.md` and `.planning/ROADMAP.md` — **not modified** (`git diff --name-only d6480ea6..HEAD` lists three source files and nothing else)
