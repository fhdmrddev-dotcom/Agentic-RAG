---
phase: 197-guided-authoring
plan: 07
subsystem: frontend
tags: [auth-02, decisions-surface, guided-authoring, source-fences, red-first, d-07, d-17, d-18, d-20]

# Dependency graph
requires:
  - phase: 197-03
    provides: "decisionsVocabulary.ts — DECISION_ROW_ORDER as data, decisionRowLabel, and every user-visible string on this surface"
  - phase: 197-04
    provides: "soulData.ts terminalEmitSlug — the step rows 2 and 5 jump to"
  - phase: 197-05
    provides: "builderStore.ts setName — the write row 4's field lands in"
  - phase: 197-06
    provides: "api.ts GenerateReadiness — the readiness shape, carried to the page on onDrafted's second argument"
  - phase: 187
    provides: "SeedReceipt.tsx + SeedReceipt.test.tsx — the charter and the ?raw fence idiom this sibling adopts"
provides:
  - "DecisionsList — the answerable half of the arrival card; five rows, always, in the exported order"
  - "The three-arm readiness read: absence and green render IDENTICALLY (nothing), so an absent verdict can never be read as a pass"
  - "DecisionsListProps — the binding contract plans 197-08 and 197-09 are written against"
  - "54 cases incl. 8 positive controls and five charter fences, each shown to fire against the REAL source"
affects: [197-08, 197-09, 197-10, 197-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rows produced by mapping an exported order tuple, so 'always five, always the same order' is a property of the vocabulary module rather than of JSX sequence"
    - "A three-arm optional read where ABSENT and GREEN render identically — the useModelRegistry floor applied to a verdict"
    - "PROSE detection (two lowercase words AND sentence punctuation or an em dash) as the no-authored-sentence fence, with a tailwind class-string control pinning that it stays quiet"
    - "A type-only import fence with BOTH halves: every specifier line begins `import type`, AND at least one such line exists"

key-files:
  created:
    - "frontend/src/components/workflows/DecisionsList.tsx"
    - "frontend/src/components/workflows/DecisionsList.test.tsx"
    - ".planning/phases/197-guided-authoring/197-07-SUMMARY.md"
  modified: []

key-decisions:
  - "Row 5's ANSWER is keyed on deliverableStepSlug per the plan's binding props contract — the two-null-causes narrowing 197-04 measured is recorded in the component docblock with a re-open trigger rather than fixed by widening a contract two later plans depend on"
  - "The whole-container `<img` escaping needle was REJECTED — it fires on the name field's correctly-escaped value ATTRIBUTE; scoped to the text-child cells instead, which is the stronger claim"
  - "The 'more than N words' half of the prose fence was REJECTED — a tailwind class string is five space-separated words, so it fired on the correct code beside it"
  - "Row 4 has no sibling action control at all (D-17: the field IS the action), so there is no decision-action-name handle"

patterns-established:
  - "A RED-first proof that names the DEFECT, not the file's absence: build the wrong-shape scaffold, observe the specific failure, then implement"
  - "Prove a fence fires against the REAL source with a temporary probe, not only against planted strings"

requirements-completed: [AUTH-02]

# Metrics
duration: 32min
completed: 2026-08-18
---

# Phase 197 Plan 07: DecisionsList — the answerable half of the arrival card

**Five fixed rows built by mapping the exported order, a readiness read whose third arm is absence, and five charter fences each demonstrated firing against the component's real source — 54 cases, 8 positive controls, zero new typecheck errors.**

## Performance

- **Duration:** 32 min (11:22 → 11:54 UTC+4)
- **Tasks:** 3, each committed individually
- **Source files modified:** 2 (both created; exactly this plan's declared `files_modified`)

---

## THE DISPATCHED-BASE ASSERTION FIRED, AND IT WAS LOAD-BEARING

The worktree forked from `fda792141b0129de7b15dd40ddc1082e76f95a2a` — **the wrong SHA, for the seventh time in this phase** — and `git merge-base HEAD fac75b19…` returned `3781a3fe`, proving the dispatched base was **not an ancestor**. Reset to `fac75b19d9e68b347bc465c6ccab4f6a80c57151` before reading the plan.

This was not ceremony. **All four wave-2 artifacts this plan consumes live only at the correct base** — `decisionsVocabulary.ts`, `terminalEmitSlug`, `setName`, `GenerateReadiness`. Executing at `fda79214` would have failed to resolve every one of them.

---

## Task 1 — the component (`16779ded`)

`frontend/src/components/workflows/DecisionsList.tsx`, 329 lines, exporting `DecisionsList` and `DecisionsListProps` exactly as the plan's `<interfaces>` block specifies. It is mounted by nobody yet; `197-08` composes it.

### The rows are a consequence, not a habit

Produced by `DECISION_ROW_ORDER.map(...)`, with a `switch` on the key inside. Writing five JSX blocks in sequence would make the count a property of the author's care; mapping the exported tuple makes it a property of the module — which is why `197-03` exported the order as data.

`data-row-count={DECISION_ROW_ORDER.length}` is derived from the same tuple, never from a literal, so the attribute the suite checks cannot agree with a hand-typed 5 while the render disagrees.

### The three-arm readiness read

```
readiness === undefined            → no verdict node at all
status === "present"               → no verdict node at all
status === "missing"               → the server's own `message`, verbatim, as a text child
```

Absence and green resolve to the **same** `null` before anything is rendered, so nothing downstream can distinguish them. That is the property, not a coincidence of copy.

Four grep criteria pin the shapes that would collapse it — a `readiness ?? {}` default, a `!!readiness` coercion (both fenced in Task 3), plus `dangerouslySetInnerHTML` and `.trim()` at zero.

### Acceptance greps — all measured

| Criterion | Required | Measured |
|---|---|---|
| `grep -c "DECISION_ROW_ORDER"` | ≥ 1, rows produced by `.map` | **4 occurrences**, incl. `DECISION_ROW_ORDER.map((key) =>` |
| `grep -Ec "useState\|useRef"` | `0` | **0** |
| `grep -Ec "readiness\s*(\?\?\|\|\|)\s*\{\}"` | `0` | **0** |
| `grep -c "dangerouslySetInnerHTML"` | `0` | **0** |
| `.trim()` in the name path | absent | **0 occurrences in the whole file** |
| API-specifier lines | every one begins `import type` | **1 line, line 123: `import type { GenerateReadiness } from "@/lib/api"`** |
| `min_lines` | ≥ 120 | **329** |
| `tsc -p tsconfig.app.json` | no NEW error | **33 → 33** |

---

## ⚠ THE RED-FIRST EVIDENCE — the defect was named, not the file's absence

The plan required the three readiness cases to be written before the component satisfied them. **A red produced by a missing module proves only that the module was missing.** So the cases were written against a **scaffold whose readiness read was deliberately TWO-ARMED** — the exact wrong shape D-20 forbids — and the reds below are the reds that specific defect produces.

### Reds 1 and 2 — a two-arm read renders an affirmative in BOTH non-missing arms

```
 FAIL  src/components/workflows/DecisionsList.test.tsx > DecisionsList — the three readiness arms > an ABSENT verdict renders nothing affirmative anywhere
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/components/workflows/DecisionsList.test.tsx:78:49

 FAIL  src/components/workflows/DecisionsList.test.tsx > DecisionsList — the three readiness arms > a PRESENT verdict renders exactly what absence renders — nothing affirmative
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/components/workflows/DecisionsList.test.tsx:86:49

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

### Red 3 — a client-authored prefix on the server's sentence

The scaffold's missing arm was already correct, so the third case passed on the first run. **A case that has never been observed failing is not RED-proven.** The scaffold was mutated to prepend a client sentence — the D-20 violation "rows 1, 2, 4 and 5 must NOT say *before publishing*", committed on the one row that may borrow the gate's register:

```
 FAIL  src/components/workflows/DecisionsList.test.tsx > DecisionsList — the three readiness arms > a MISSING verdict renders the server's own sentence, character for character
AssertionError: expected 'Before publishing: This workflow has …' to be 'This workflow has …' // Object.is equality

Expected: "This workflow has no business requirement, so it cannot be published."
Received: "Before publishing: This workflow has no business requirement, so it cannot be published."

 ❯ src/components/workflows/DecisionsList.test.tsx:92:76

 Test Files  1 failed (1)
      Tests  1 failed | 4 skipped (5)
```

With the real three-arm component: **5 passed (5)**.

---

## ⚠ THE AFFIRMATIVE DETECTOR PASSED AGAINST A COMPONENT THAT REALLY DID RENDER AN AFFIRMATIVE MARK

This is the finding worth carrying forward, and it was caught only because the first run was *expected* to be red and was not.

The scaffold rendered `<p data-testid="decision-verdict-ok">All set</p>` in its else arm. The detector read `container.textContent` and swept it with `\b(all set|…)\b`. **It reported clean — 4 passed.**

The cause: `textContent` concatenates sibling text nodes with **no separator**. The preceding row's label ends `…hands back`, so the haystack read `…hands backAll set` — and `\ball set\b` has no word boundary between `k` and `A`. The mark was rendered, visible, and invisible to the guard.

**The fix is structural, not a wider needle:** the detector now walks text nodes and joins them with a separator, and additionally sweeps `placeholder` / `aria-label` / `title` values, because a placeholder is a visible affordance too. **Its positive control was rewritten to plant the token across exactly that seam** (`expect(planted.textContent).not.toMatch(affirmativeRx())` is a live assertion in the suite, so the failure mode is pinned rather than described), and a third control proves it stays **quiet** on the surface's own nine vocabulary sentences — a detector that always fires and one that never fires are indistinguishable from a green run.

**Generalisation:** a positive control planted in a *clean* string proves only that clean strings work. Plant it in the shape the defect actually takes.

---

## Task 2 — 36 behaviour cases (`5fecf95c`)

| Section | Cases | What is pinned |
|---|---|---|
| 1 · the row set is fixed | 5 | five rows on a populated draft AND on one where every answer is absent; the order compared as an **ordered array** against `DECISION_ROW_ORDER` (and again off each `li`'s own `data-row-key`); every label from `decisionRowLabel`; the limit note |
| 2 · live answers | 7 | one case per row proving the answer comes from the prop, plus two re-render cases proving it **follows** — what "no mirrored copy" buys |
| 3 · honest absence | 5 | each `*_NONE` constant renders; row 4's is the field's **placeholder** with an empty value |
| 4 · the three readiness arms | 7 | the three arms, the verdict living on row 3 and nowhere else, and three positive controls |
| 5 · the writes | 10 | `onChangeKb` / `onChangeRequirement` once each; both jumps carrying the slug; **neither jump rendering** when the slug is `null` and `onOpenStep` never called; the raw name value with leading and trailing spaces asserted verbatim; the empty value forwarded; row 4 carrying **no** sibling button |
| 6 · escaping | 2 | a runtime-assembled HTML payload in the requirement, filename, name **and** the server verdict |

**No user-visible expected string is spelled as a literal.** Every expectation references an identifier imported from `decisionsVocabulary`; the sole exception is the readiness `message`, which is the fixture's own value compared to itself by `toBe`.

### ⚠ A needle rejected for firing on the correct code beside it

The escaping case first asserted `container.innerHTML` does not contain `<img`. It **failed** — on the name field, whose `value` **attribute** jsdom serialises verbatim. An attribute value is not markup and React set it as a DOM property; the needle reported the correct treatment one row away as a defect.

Per this project's standing rule, it was **narrowed rather than forced**: the assertion now names *which* nodes must be escaped (`decision-answer-requirement`, `decision-answer-template` — `innerHTML` contains `&lt;` and no `<img`, `querySelector("img")` null) alongside the whole-container `querySelector("img")` null. That is strictly the stronger claim: it names the nodes instead of sweeping a haystack. The rejection is recorded in the case body, not just here.

---

## Task 3 — the five charter fences (`c01eacba`)

Each clause of `SeedReceipt`'s charter, adopted deliberately by this sibling, with a positive control beside it.

| # | Clause | Property asserted | Positive control |
|---|---|---|---|
| 1 | authors no sentence of its own | **PROSE** detection over comment-stripped string literals **and** JSX text nodes → `[]` | imports from `decisionsVocabulary` and references five of its exports; the detector fires on a planted sentence, an em-dashed one and a JSX text node; **and stays quiet on a real class string and on prose in a comment** |
| 2 | declares no predicate of its own | the file declares **exactly one** function, and it is the component; no module-private `^function` | it CONSUMES the shipped derivations — the emit phase-type token appears nowhere, `deliverableStepSlug` arrives as a prop; a planted predicate is detected and a two-declaration source counts 2 |
| 3 | opens no request, names no route | no `fetch(`, no `XMLHttpRequest\|EventSource\|navigator.sendBeacon`, no string literal **starting** with a path separator | planted route detected; **must not** fire on `text-muted-foreground/70` or `divide-border/50` |
| 4 | the API contact is TYPE-ONLY | every line containing the specifier begins `import type` | **and at least one such line EXISTS** — the half without which this fence passes because the import was deleted; a planted value import is shown failing the same predicate |
| 5 | no cache | neither cache hook appears (needles from parts) | it reads all nine of its props by name, so the fence is not passing on an empty file |

Plus the raw-HTML fence, the two absent-verdict-collapse shapes, the `.trim()` fence, and the **coverage sweeps**: every static `data-testid` and every `data-*` state attribute the component renders is queried by this suite, read from the suite's **comment-stripped** source so a query inside a comment cannot satisfy it. The two template testids get their own explicit acknowledgement case.

### ⚠ The prose fence's word-count arm was TRIED and REJECTED

The plan suggested "more than N words, **or** containing a sentence-ending punctuation mark". The word-count arm fires on **every `className` in the file** — `min-w-0 flex-1 truncate font-medium text-foreground` is five space-separated words. That is a fence firing on the correct code it sits beside, which this project deletes rather than fixes.

Only the punctuation arm survives, and it is safe for a measured reason: a tailwind class carries no sentence-ending mark and no em dash, and the decimal inside `text-[12.5px]` is followed by a **digit**, not by whitespace or end-of-string. A control plants a real class string (five words, a decimal, a slash and a colon) and asserts the detector stays quiet.

### ⚠ EVERY FENCE WAS SHOWN TO FIRE AGAINST THE REAL SOURCE, not only against planted strings

Planted-literal controls prove the *pattern* works. They do not prove the fence is pointed at the component. Two temporary probes were added to `DecisionsList.tsx` — a sentence constant, and `import type` downgraded to `import { type … }` — and the suite re-run:

```
     × authors NO sentence of its own — every word an author reads is imported
     × its ONE contact with the API client is TYPE-ONLY
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 52 passed (54)
```

Both probes reverted; `git diff --numstat HEAD -- DecisionsList.tsx` is empty afterwards.

---

## Verification

```
$ cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run \
    src/components/workflows/DecisionsList.test.tsx \
    src/components/workflows/SeedReceipt.test.tsx \
    src/components/workflows/decisionsVocabulary.test.ts

 Test Files  3 passed (3)
      Tests  144 passed (144)
```

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33
```

**33 = the standing baseline, unchanged.** Measured before any file was created and again after each task. Zero errors name `DecisionsList`.

### ⚠ MY OWN SUITE BASELINE, RE-DERIVED — NOT INHERITED FROM A PIN

Wave 2 found two plans quoting a count-gate **pin** as though it were the suite baseline (`soulData.test.ts` pinned 36 vs actual 49). This plan's suite is NEW, so it has no pin; the figure below is read from the gate's own `actual` column:

```
  DecisionsList.test.tsx                        —      54     new
  decisionsVocabulary.test.ts                   —      22     new
  -------------------------------------------------------------
  total                                      4217    4395    +178
  total 4395  ·  failed 0  ·  pinned total 4217
count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
```

**`DecisionsList.test.tsx` = 54.** The wave-1 finding recorded the base as `total 4341 · pinned total 4217 · 89/89`; `4341 + 54 = 4395`, so the whole grand-total delta attributable to this plan is **exactly its own 54 cases** and nothing else moved.

Acceptance thresholds: ≥ 20 cases → **54**. `grep -c "POSITIVE CONTROL"` ≥ 5 → **8**.

---

## THE FOUR D-05 NUMSTAT CRITERIA — run against this plan's diff, verdicts verbatim

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                                   [no output — exit 0]
```

| # | Path | Decision | Required | **Verdict** |
|---|---|---|---|---|
| 1 | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | ✅ **absent from the diff entirely** — 0 deletions, 0 insertions |
| 2 | `WorkflowDoorSwitch.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | ✅ **absent from the diff entirely** — 0 deletions, 0 insertions |
| 3 | `SeedReceipt.tsx` | D-02 | `0 0` — must not appear at all | ✅ **does not appear** |
| 4 | `publish_service.py` | D-11 · D-20 | `0 0` — must not appear at all | ✅ **does not appear** |

This plan's own contribution to the full-tree numstat, for audit:

```
512	0	frontend/src/components/workflows/DecisionsList.test.tsx
329	0	frontend/src/components/workflows/DecisionsList.tsx
```

**Exactly the two declared `files_modified`, both created, zero deletions anywhere.** No file outside the declaration was touched; `STATE.md` and `ROADMAP.md` were not written by this plan (their rows in the full diff belong to wave 2's merge, already on the base).

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The affirmative-token detector could not see the mark it was written to catch**

- **Found during:** Task 2 (the RED-first step — the first run passed when it should have failed)
- **Issue:** `container.textContent` concatenates sibling text nodes with no separator, destroying the leading word boundary of any mark that follows a label. The detector reported clean against a scaffold that visibly rendered `All set`.
- **Fix:** walk text nodes and join with a separator; include `placeholder` / `aria-label` / `title`; re-plant the positive control across the sibling seam and pin the old failure mode as a live assertion.
- **Files modified:** `DecisionsList.test.tsx`
- **Commit:** `5fecf95c`

**2. [Rule 1 — Bug] The escaping needle fired on correct code**

- **Found during:** Task 2
- **Issue:** a whole-container `not.toContain("<img")` failed on the name field's correctly-escaped `value` attribute.
- **Fix:** narrowed to the text-child cells by name, which is strictly the stronger claim; rejection recorded in the case body.
- **Files modified:** `DecisionsList.test.tsx`
- **Commit:** `5fecf95c`

### Plan guidance narrowed with the reason recorded

**3. The prose fence's "more than N words" arm** — the plan offered it as an alternative to the punctuation arm. It fires on every `className` in the file. Only the punctuation/em-dash arm ships, with a class-string control pinning the quiet. Recorded in the fence's own docblock.

---

## Known limitation — row 5's answer, stated rather than smoothed

`197-04` measured that `terminalEmitSlug` returns `null` for **two distinct causes**: there is no emit step, and there IS one whose slug cannot select anything. Both correctly mean *render no jump control*, which is why one prop drives the **action**.

Row 5's **answer** is keyed on the same prop, because the plan's `<interfaces>` row→data table binds it there and `197-08` / `197-09` are written against that contract. In the second case the row therefore says the workflow answers in chat while `soulDeliverable` would answer `file`.

**Not silently absorbed:** it is written into the component docblock naming `soulDeliverable` as the correct oracle, with a **re-open trigger — the first plan that widens `DecisionsListProps` for any other reason.** Changing the contract here to fix it would have broken two downstream plans for a case neither can currently produce.

## Known Stubs

None. Every row renders a real answer from a real prop; nothing is hardcoded empty and no placeholder copy stands in for a data source.

## Threat Flags

None. The two trust boundaries this plan crosses were both in the plan's own register (`T-197-19` model/author strings → DOM, `T-197-03` / `T-197-20` server verdict → copy), and each is driven rather than asserted. No new network endpoint, auth path, file access or schema surface is introduced — fences 3 and 4 pin that as a source property.

---

## Self-Check: PASSED

```
FOUND: frontend/src/components/workflows/DecisionsList.tsx
FOUND: frontend/src/components/workflows/DecisionsList.test.tsx
FOUND: 16779ded  feat(197-07): DecisionsList — five rows from the exported order, three readiness arms
FOUND: 5fecf95c  test(197-07): 36 behaviour cases — the count, the order, live answers, the writes, escaping
FOUND: c01eacba  test(197-07): the charter fences — no sentence, no predicate, no request, type-only
```

All claimed files exist on disk; all three claimed commit hashes resolve in `git log`.
