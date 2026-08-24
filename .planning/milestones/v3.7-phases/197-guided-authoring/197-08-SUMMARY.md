---
phase: 197-guided-authoring
plan: 08
subsystem: frontend
tags: [auth-02, guided-authoring, draft-arrival, composition, d-02, sketch-174, source-fences, one-card]

# Dependency graph
requires:
  - phase: 197-07
    provides: "DecisionsList + DecisionsListProps — the five-row decisions surface this card folds open"
  - phase: 197-03
    provides: "decisionsVocabulary.ts — groundingFoldSummary / decisionsFoldSummary / the two fold action words / DECISION_ROW_ORDER"
  - phase: 187-13
    provides: "SeedReceipt + its shipped constants in definitionOps (seedReceiptHeading, SEED_RECEIPT_DISMISS_LABEL / _GLYPH, SEED_RECEIPT_NOTHING_COMMITTED)"
  - phase: 187-24
    provides: "groundingCauseOf in phaseVocabulary.ts — THE ONE client grounding derivation"
provides:
  - "DraftArrivalCard — the composing parent that makes the arrival moment ONE card, four lines on arrival"
  - "DraftArrivalCardProps — the binding props contract plan 197-09 mounts against"
  - "A suppression wrapper that neutralises the receipt's frame and hides its three now-duplicate handles WITHOUT editing the receipt"
  - "35 cases: the one-card shape, the genuinely-folding folds, the composed-not-redrawn receipt, and five charter fences each shown to fire"
affects: [197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compose-and-suppress: a parent renders a fenced leaf unmodified and neutralises its duplicate chrome with Tailwind arbitrary child variants keyed on the leaf's own shipped testids"
    - "A suppression list declared as a module constant and swept BOTH directions by a source fence — the four suppressed handles present, the four content handles absent"

key-files:
  created:
    - "frontend/src/components/workflows/DraftArrivalCard.tsx (338 lines)"
    - "frontend/src/components/workflows/DraftArrivalCard.test.tsx (800 lines, 35 cases)"
  modified: []

key-decisions:
  - "Dismissal is NOT remembered across a reload — declined deliberately; open is already caller-owned and the page resets it per generation"
  - "The API-client fence is STRICTER here than in DecisionsList: absence in ANY form, because the readiness rides inside the decisions prop object"
  - "The JSX-text arm of the inherited prose detector was TIGHTENED to a single line — the sibling's newline-admitting tail fired on this file's own correct code"
  - "No data-* state attribute is published: the grounded count is spent on one sentence, never written into the DOM"

patterns-established:
  - "A composing parent may hold disclosure state; a leaf's no-useState purity fence does not travel to its parent"
  - "Verify Tailwind arbitrary-variant emission by running the CLI over a probe, then record HOW it was verified"

requirements-completed: [AUTH-02]

# Metrics
duration: 78min
completed: 2026-08-18
---

# Phase 197 Plan 08: DraftArrivalCard — One Card, Two Components Underneath Summary

**The arrival moment is now ONE card of four lines that composes the governance receipt
UNMODIFIED behind a fold — `SeedReceipt.tsx` shows `0 0` on numstat, its own suite is green, and
five source fences pin the parent's charter with eight positive controls.**

## Performance

- **Duration:** ~78 min
- **Tasks:** 3, each committed individually
- **Files created:** 2 · **Files modified:** 0 · **Deletions across the whole plan diff:** 0

---

## THE DISPATCHED-BASE ASSERTION FIRED, AS THE BRIEFING WARNED IT WOULD

The worktree forked from `fda792141b0129de7b15dd40ddc1082e76f95a2a`, **not** from the dispatched
base `ffbcf1a5cf018caf615a29e7bb76012e2b151f54`. It was not merely stale — `git merge-base` of the
two returned `3781a3fe4690a9619e619f4cc412bd37a7dafc52`, i.e. **the checked-out SHA was NOT an
ancestor of the dispatched base**. That is now eight for eight in this phase.

```
$ git rev-parse HEAD                                        # before
fda792141b0129de7b15dd40ddc1082e76f95a2a
$ git merge-base HEAD ffbcf1a5cf018caf615a29e7bb76012e2b151f54
3781a3fe4690a9619e619f4cc412bd37a7dafc52                    # neither
$ git reset --hard ffbcf1a5cf018caf615a29e7bb76012e2b151f54
$ git rev-parse HEAD                                        # after
ffbcf1a5cf018caf615a29e7bb76012e2b151f54
```

⚠ **Skipping it would have been fatal to this plan specifically:** `DecisionsList.tsx` — the child
this card composes — exists only at the correct base. The parent would have been written against a
component that was not there.

---

## Task 1 — `DraftArrivalCard.tsx` · commit `9a690b71`

One `<section data-testid="draft-arrival-card">` carrying the frame lifted from
`SeedReceipt.tsx:239-255`, and inside it, top to bottom:

1. **Heading row** — `seedReceiptHeading(phases.length)` in an `<h2>` whose `useId` id is the
   section's `aria-labelledby`, plus the dismiss button using `SEED_RECEIPT_DISMISS_LABEL` /
   `SEED_RECEIPT_DISMISS_GLYPH`. **Composed from the receipt's own shipped constants, never
   re-typed.**
2. **Fold line 1** — rendered only when `groundingFoldSummary(groundedCount)` is non-empty; action
   word `GROUNDING_FOLD_ACTION`; `aria-expanded` + `aria-controls`.
3. **Fold-1 body** — the suppression wrapper containing `<SeedReceipt … open={true}
   onDismiss={onDismiss} />`. The parent's real `onDismiss` is passed through rather than a no-op:
   the control is suppressed, and if suppression ever failed the behaviour would still be correct.
4. **Fold line 2** — `decisionsFoldSummary(DECISION_ROW_ORDER.length)`, action word
   `DECISIONS_FOLD_ACTION`.
5. **Fold-2 body** — `<DecisionsList {...decisions} />`.
6. **The closing line** — `SEED_RECEIPT_NOTHING_COMMITTED`, under `draft-arrival-close`.

`open === false` returns `null` before any DOM — the shipped `SeedReceipt.tsx:236` behaviour
inherited exactly. Both fold booleans are **false on mount**, which is sketch 174's 149 px
four-line arrival.

### `groundedCount` is a SECOND CONSUMER of one predicate, not a second predicate

```ts
phases.reduce((total, phase) => (groundingCauseOf(phase, kbTools) !== null ? total + 1 : total), 0)
```

`groundingCauseOf` MOVED to `phaseVocabulary.ts` at 187-24 precisely so no surface could hold a
second copy. This file declares no cause table, names no cause token, and does **not** read the
receipt's published `data-grounded-count` back out of the DOM.

### Task 1 acceptance criteria — every one run, verdicts verbatim

| Criterion | Command | Result |
|---|---|---|
| Receipt mounted exactly once | `grep -c "<SeedReceipt" …/DraftArrivalCard.tsx` | **1** |
| Consumes the one home | `grep -c "groundingCauseOf" …/DraftArrivalCard.tsx` | **3** |
| No DOM read-back | `grep -Ec "data-grounded-count\|querySelector" …/DraftArrivalCard.tsx` | **0** |
| Suppression list is exactly the four frame/duplicate handles | fence 5, both directions | **pass** (see below) |
| `SeedReceipt.tsx` untouched | `git diff --numstat <base> HEAD -- …/SeedReceipt.tsx` | **empty output** |
| No new typecheck error | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors** — the standing baseline, **0** naming this file |

---

## ⚠ HOW THE TAILWIND ARBITRARY-VARIANT EMISSION WAS CONFIRMED — MEASURED, NOT ASSUMED

The plan required confirmation rather than assumption. The Tailwind **CLI was run over a probe
carrying the ten exact candidates**, against a throwaway config pointing at nothing else, using the
repo's own `tailwindcss` (`^3.4.19`) through the worktree's junctioned `node_modules`:

```bash
npx tailwindcss -c <scratch>/tw.config.cjs -i <scratch>/in.css -o <scratch>/out.css
# Done in 160ms.
```

**All ten rules were emitted**, each as `.<escaped-candidate> [data-testid=<handle>]`. Verbatim
extract:

```css
.\[\&_\[data-testid\=seed-receipt\]\]\:p-0 [data-testid=seed-receipt]        { padding: 0px }
.\[\&_\[data-testid\=seed-receipt\]\]\:animate-none [data-testid=seed-receipt] { animation: none }
.\[\&_\[data-testid\=seed-receipt-close\]\]\:hidden [data-testid=seed-receipt-close] { display: none }
```

Three properties of that output are load-bearing and are recorded rather than inferred:

- **The attribute match is EXACT** (`[data-testid=seed-receipt]`), so the frame rules cannot reach
  `seed-receipt-heading` or any other handle that merely starts with the frame's name.
- **Specificity is `(0,2,0)`** against the receipt's own single-class utilities at `(0,1,0)`, so the
  neutralisation wins without `!important`.
- **`animation: none` is the shorthand**, which kills `tailwindcss-animate`'s `animate-in` entrance
  outright rather than leaving a half-applied enter animation.

⚠ **`display`, not opacity, and that is deliberate.** `display:none` removes the suppressed dismiss
button from the **tab order**, so the card ships no hidden focusable control. An opacity-based
suppression would have looked identical and shipped one.

⚠ **The second accepted consequence:** the receipt's `<section>` loses its accessible name once its
`<h2>` is hidden. It becomes a generic unnamed region inside a named parent section, which is benign
— an unnamed `<section>` is not exposed as a landmark.

---

## Task 2 — the composition cases · commit `7a6a8048`

16 cases at this commit (35 in the file after Task 3). They pin: exactly one card and one element
child; `open={false}` yielding an **empty `container.innerHTML`**; both folds closed on mount with
neither child in the DOM; the heading and both summaries read from the **imported formatters**;
fold 1 revealing the REAL receipt (`seed-receipt-grounded-list` plus three `[data-slug]` rows, not a
redrawn copy); fold 2 mounting one `decisions-list` at `data-row-count="5"`; both folds open at once
with each closing independently; the zero-grounded draft dropping fold line 1 while fold line 2
stays; dismissal calling `onDismiss` **once** while the card stays rendered; and the `decisions`
object **driven** rather than shallow-compared.

### RED evidence, observed rather than assumed

Defaulting `groundingOpen` to `true` — the one-line inversion of the arrival state — failed **5 of
16**:

```
× mounts with BOTH folds closed — neither child is in the DOM
× gives each fold line its own action word, and reports both as collapsed
× fold 1 mounts exactly ONE receipt, and reveals the REAL receipt's content
× fold 1 open — ONE heading, dismiss and close inside the wrapper, ONE of each outside (…U1)
× both folds open at once, and closing either unmounts ONLY its own body
AssertionError: expected <section …(6)>…(5)</section> to be null
```

### ⚠ A CLAIM THIS SUITE WAS ABOUT TO MAKE AND CANNOT — CORRECTED BEFORE COMMIT

The first draft named the closing-sentence case *"THE CASE THAT WOULD CATCH A WRONG SUPPRESSION
LIST"*. **It would not.** The helper removes the suppression wrapper's subtree before counting, so
that case is **blind to the suppression list by construction**. Both cases now state narrowly what
they prove:

- **collapsed:** the receipt is not mounted at all, so a second occurrence could only come from the
  parent saying the sentence twice **itself**;
- **fold-1 open:** it measures what the card **owns**, and says in its own comment that the
  suppression list is fenced at the source (fence 5) and its appearance is owed to **G-4 row U1**.

A green case whose name promises more than it checks is worse than an absent one.

---

## Task 3 — the five charter fences · commit `14503eae`

| Fence | Property | Positive control |
|---|---|---|
| 1 | Authors **no sentence** of its own (comment-stripped literal + JSX-text sweep) | imports from **both** copy homes and references **eight** of their exported identifiers; the prose detector fires on a planted sentence and stays **quiet on two class strings lifted verbatim out of this component** |
| 2 | Declares **no predicate** — exactly ONE module-scope `function`, and none of the three cause tokens is named | it **calls** `groundingCauseOf` and imports `phaseVocabulary`, so it does not merely LACK a predicate — it consumes the one home (the 187-24 property) |
| 3 | **No request**: no `fetch(`, no `EventSource`/`XMLHttpRequest`/`sendBeacon`, no route-shaped literal, and **no API-client contact in ANY form** | it imports from the two copy homes, so the fence is not passing on a file that imports nothing |
| 4 | **D-02** — `<SeedReceipt` appears **exactly once**; the governance seal glyph, the per-row handle prefix and **any `.map(`** are all absent | it DOES name `SeedReceipt`, its module specifier and `DecisionsList` — the fence reads a file that really composes |
| 5 | The suppression list is exactly right, **in both directions** | the sweep finds exactly 4 targets, and a planted content-handle candidate is shown to be extracted by the same regex |

Plus a testid-coverage sweep (every static testid the component renders is queried by this suite,
measured over the **comment-stripped** test source) and a sibling assertion that the component
publishes **no brace-valued `data-*` state attribute** at all.

**`grep -c "POSITIVE CONTROL"` → 8** (the plan required at least 4).

### RED evidence for the fences — each shown to fire on a real violation

**Adding one content handle to the suppression list** (`seed-receipt-grounded-list`) failed **3**
cases, and the message named the handle:

```
× suppresses EXACTLY the four frame and duplicate handles — no more
× suppresses NONE of the handles the fold exists to reveal
× POSITIVE CONTROL — the sweep really does find the targets…
AssertionError: seed-receipt-grounded-list is the fold's own content and must stay visible:
  expected [ 'seed-receipt', …(4) ] to not include 'seed-receipt-grounded-list'
```

**Swapping the fold glyph for the governance seal** failed fence 4:

```
× composes the receipt EXACTLY ONCE, and re-implements none of its content
```

Both probes were reverted and the tree confirmed byte-identical to the committed component before
the fences were committed.

### ⚠ THE INHERITED DETECTOR WAS WRONG ON THIS FILE, AND IT WAS MEASURED RATHER THAN REASONED

`DecisionsList.test.tsx`'s JSX-text arm is `/>([^<>{}\n]*[A-Za-z]{2,}[^<>{}]*)</g` — the **tail
admits newlines**. On this component it ran from the `>` of an arrow function, **across several
lines of ordinary code**, to the next `<`, capturing:

```
(groundingCauseOf(phase, kbTools) !== null ? total + 1 : total),
      0,
    ),
  [phases, kbTools],
)
```

Two adjacent lowercase words are trivially present in code, and **the ternary's `?` followed by a
space satisfies the prose mark** — so the fence fired on the correct code it sits beside. That is
the failure mode that gets a fence deleted instead of fixed (the D-ITEM-183-02 family). The tail is
now pinned to a **single line**, which is a strict tightening: real JSX text is a short run of words
on one line, and both planted controls still fire.

⚠ **The narrowing it costs is ASSERTED, not hoped.** A sentence wrapped across two JSX lines is not
seen by that arm; a case plants exactly that shape, asserts it is missed, and asserts the
string-literal arm still catches the same sentence the moment it is assigned to anything. **This is
worth carrying back to `DecisionsList.test.tsx` and `SeedReceipt.test.tsx`, whose copies of this arm
have the same hole and simply have not met a file that trips it.**

---

## THE FOUR D-05 NUMSTAT CRITERIA — RUN AGAINST THIS PLAN'S DIFF, VERDICTS VERBATIM

Base SHA substituted as the literal `197-01` recorded (`52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07`).

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
                                                                      [no output]
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
                                                                      [no output]
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/components/workflows/SeedReceipt.tsx
                                                                      [no output]
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- backend/app/services/harness/publish_service.py
                                                                      [no output]
```

| # | Path | Required | Verdict |
|---|---|---|---|
| 1 | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | deletions = 0 | **PASS** — file absent from the diff |
| 2 | `WorkflowDoorSwitch.baseline.test.tsx` | deletions = 0 | **PASS** — file absent from the diff |
| 3 | `SeedReceipt.tsx` | **`0 0`** — must not appear at all | **PASS** — absent from the diff entirely |
| 4 | `publish_service.py` | **`0 0`** — must not appear at all | **PASS** — absent from the diff entirely |

**D-02 has three proofs and all three hold:** `SeedReceipt.tsx` is absent from the numstat;
`SeedReceipt.test.tsx` is green (its own `?raw` fences would fire on any API import, type-only
import or prose change); and fence 4 asserts the parent composes rather than redraws.

### The whole plan diff, so nothing hides outside those four paths

```bash
$ git diff --numstat ffbcf1a5cf018caf615a29e7bb76012e2b151f54 HEAD
800     0       frontend/src/components/workflows/DraftArrivalCard.test.tsx
338     0       frontend/src/components/workflows/DraftArrivalCard.tsx
# total deletions across the plan diff: 0
```

**Two paths, both declared in `files_modified`, zero deletions.** `STATE.md`, `ROADMAP.md` and every
file outside the declared two are untouched.

---

## GATE BASELINES — RE-DERIVED FROM THE GATE'S OWN `actual` COLUMN, NOT INHERITED FROM A PIN

⚠ **A count-gate PIN is a FLOOR, never a census.** Three plans in this phase found their plan
quoting a pin as if it were the suite baseline, so the figure below is read off the gate's verdict
line verbatim:

```
  DecisionsList.test.tsx                        —      54     new
  DraftArrivalCard.test.tsx                     —      35     new
  decisionsVocabulary.test.ts                   —      22     new
  -------------------------------------------------------------
  total                                      4217    4430    +213
  total 4430  ·  failed 0  ·  pinned total 4217
count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
```

**This plan's own contribution is `+35`, and the arithmetic confirms it in isolation:** the
briefing measured `total 4395` on this base; `4395 + 35 = 4430`. Nothing was absorbed, replaced or
re-implemented — `DraftArrivalCard.test.tsx` reads `new`, and no pinned file decreased.

| Gate | Base (briefing) | Measured here | Verdict |
|---|---|---|---|
| `vitest-count-gate.cjs` | `4395` total · `4217` pinned · 89/89 | **`4430` total · `4217` pinned · 89/89 · failed 0** | `count gate OK` |
| `tsc -p tsconfig.app.json` | 33 errors | **33 errors**, **0** naming this plan's files | unchanged |
| In-scope suites | — | `DraftArrivalCard` + `SeedReceipt` + `DecisionsList` + `decisionsVocabulary` → **4 files, 179 tests, 0 failing** | green |

The gate ran green on the **first** attempt, with no re-runs and **the worker cap untouched** —
`GSD_VITEST_MAX_WORKERS=2` on every run in this plan, as the project rule requires. No SEED-171
suite reddened; the `ENOSPC` reporter signature wave 1 recorded did not occur.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The inherited prose detector fired on this component's own correct code**

- **Found during:** Task 3
- **Issue:** The sibling suite's JSX-text arm admits newlines in its tail, so it ran from an arrow
  function's `>` across several lines of code to the next `<`; the captured span contained two
  adjacent lowercase words and a ternary `?` followed by a space, which satisfied the prose mark.
  Fence 1 failed on correct code.
- **Fix:** The tail is pinned to a single line (`[^<>{}\n]*`), with the measurement, the captured
  string and the rejected alternative recorded in the regex's own docblock, plus a case asserting
  the narrowing this buys.
- **Files modified:** `DraftArrivalCard.test.tsx` (this plan's own new file — no shipped file was
  touched)
- **Commit:** `14503eae`

**2. [Rule 2 - Missing critical honesty] A case name claimed a guarantee the case could not give**

- **Found during:** Task 2
- **Issue:** The closing-sentence case was labelled as the one that would catch a wrong suppression
  list. Because the helper strips the wrapper's subtree before counting, it is blind to the
  suppression list by construction.
- **Fix:** Both closing-sentence cases now state narrowly what they prove and name fence 5 and G-4
  row U1 as the actual owners of the claim.
- **Commit:** `7a6a8048`

### Plan-authorised discretion, exercised and recorded

**Dismissal is NOT remembered across a reload.** CONTEXT.md leaves persistence to Claude's
discretion; it is **declined**. `open` is already caller-owned and the page resets it per
generation, so persistence would be a new concern — storage, scoping to a draft, and a stale key
when a second generation lands — for no stated benefit. **Re-open trigger:** an author reporting
that the card returns after a reload they had dismissed it on.

### Not a deviation, but a contract decision worth naming

`DecisionsListProps` was **not widened.** 197-07 recorded a known narrowing of its row 5 whose
re-open trigger is *"the first plan that widens this props contract for any other reason"* — this
plan gave no other reason, so **the trigger did not fire and the limitation stands unchanged**. It
remains 197-09's or a later plan's to take.

---

## Known Stubs

**None.** Every rendered value comes from a prop or an imported formatter; there is no hardcoded
empty array, no placeholder copy and no unwired data source. The component is **mounted by nobody
yet** — that is plan `197-09`'s deliverable and is stated in this plan's own objective, not a stub.

---

## ⚠ OWED — G-4 ROW U1, THE APPEARANCE PROOF

**jsdom applies no CSS**, so every assertion in this suite sees the three suppressed nodes. The
suite therefore proves the **structure** the CSS then hides — exactly one of each handle inside the
wrapper and exactly one of each outside — and the case that carries it **names U1 in its title** so
the debt cannot go quiet.

This project's own hardest-won lesson governs: *geometry proves composition; only LOOKING proves
appearance.* Three pages of green assertions did not notice that every sketch page rendered in light
mode, nor that the header contradicted the card. **U1 is owed and is not discharged by this plan.**
What U1 must show: with fold 1 open, the author sees **one** heading, **one** dismiss control and
**one** closing sentence, and the composed receipt reads as part of this card rather than as a
second card nested inside it.

---

## Threat Register — dispositions honoured

| Threat ID | Disposition | How it is discharged here |
|---|---|---|
| T-197-19 | mitigate | The parent renders no server- or model-authored string of its own — imported constants and one count formatter. Fence 3's raw-HTML needle pins the absence in this file too |
| T-197-23 | mitigate | D-02's three mechanical proofs all hold: `SeedReceipt.tsx` `0 0`, `SeedReceipt.test.tsx` green, fence 4 asserts composition |
| T-197-24 | mitigate | The card is ONE element, asserted by the single-`draft-arrival-card` case **and** by `container.childElementCount === 1`; the page-level child-count claim remains `197-09`'s |
| T-197-25 | mitigate | `groundingCauseOf` imported from the one home; fence 2 asserts no local predicate and no cause token, with a consuming positive control |
| T-197-26 | mitigate | Fence 5 asserts the four content handles are absent from the suppression list, shown to fire by a real RED probe |
| T-197-SC | accept | No package was installed by this plan |

## Threat Flags

**None.** This plan adds no network endpoint, no auth path, no file access and no schema change.

---

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `9a690b71` | `feat(197-08): one arrival card composing the unmodified receipt behind a fold` |
| 2 | `7a6a8048` | `test(197-08): pin the one-card composition, the folds and the caller-owned dismissal` |
| 3 | `14503eae` | `test(197-08): fence the parent's charter on all five clauses, each shown to fire` |

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| Component exists | `[ -f frontend/src/components/workflows/DraftArrivalCard.tsx ]` | FOUND (338 lines, ≥ 100 required) |
| Suite exists | `[ -f frontend/src/components/workflows/DraftArrivalCard.test.tsx ]` | FOUND (800 lines, 35 cases ≥ 12 required) |
| Task 1 commit | `git log --oneline` | FOUND `9a690b71` |
| Task 2 commit | `git log --oneline` | FOUND `7a6a8048` |
| Task 3 commit | `git log --oneline` | FOUND `14503eae` |
| `SeedReceipt.tsx` absent from the diff | `git diff --numstat <base> HEAD -- …/SeedReceipt.tsx` | empty output |
| Nothing outside `files_modified` | `git diff --numstat <dispatched base> HEAD` | two paths, both declared |
| Zero deletions | `git diff --numstat …\| awk '{s+=$2}'` | **0** |
| Suites green | `vitest run` ×4 suites | 179 passed, 0 failed |
| Typecheck | `tsc -p tsconfig.app.json` | 33 errors, baseline unchanged |
| Count gate | `vitest-count-gate.cjs` | `count gate OK — 89/89 …, 0 failing` |
