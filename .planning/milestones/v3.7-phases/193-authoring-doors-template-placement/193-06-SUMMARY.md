---
phase: 193-authoring-doors-template-placement
plan: 06
subsystem: workflows-library
tags: [AUTH-03, D-13, D-14, D-15, D-21, identity-line, three-arm]
requires:
  - "templateAdmission() + TemplateAdmission (193-02, soulData.ts)"
  - "CARD_TEMPLATE_MARK (193-02, library/libraryVocabulary.ts)"
provides:
  - "The card's template mark — one plain-text segment at index 0 of identityParts, on a positive admits only"
  - "Three-arm surface coverage of D-15's silence, with the two silent verdicts asserted against one shared value"
affects:
  - "193-07 (RunModal) shares the predicate and deliberately inverts the unknown fallback (D-20)"
  - "193-11 owns the count-gate pin sweep — WorkflowCard.test.tsx 80 → 90 is NOT pinned here"
tech-stack:
  added: []
  patterns:
    - "in-card derivation from `row` (the shipped ownership-predicate precedent), never a new prop"
    - "assert a segment's slot by ARRAY INDEX, never by class name"
    - "one shared expected value proves two arms indistinguishable (D-15)"
    - "the forbidden literal is not spelled in the file whose acceptance check is a raw grep (187-24 trap)"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/workflows/library/WorkflowCard.test.tsx
decisions:
  - "D-13 shipped as a plain text segment; the docblock CORRECTS the inherited justification instead of repeating it"
  - "D-14 slot: index 0 of identityParts = immediately after provenance; the provenance node stays at DOM position 2"
  - "D-15: `=== \"admits\"`; does-not-admit and unknown render identically by construction"
  - "The dangling-separator case changed its ROW rather than its expectation, so the suite keeps a one-part line"
  - "The scale cap rose per-row from the predicate, never as a blanket <= 6"
metrics:
  duration: "~55 min"
  completed: 2026-08-13
---

# Phase 193 Plan 06: The Card's Template Mark — Summary

The library row now says `· needs a template` on the workflows that genuinely need one — one
plain-text segment spliced into the shipped identity line, gated on a positive `admits` and
silent on both other arms, with the slot and the silence pinned by child order and array index.

## Worktree provenance

| | |
|---|---|
| bootstrap-worktree.sh | ran FIRST, `BOOTSTRAP OK` (junctions + env copies verified) |
| HEAD at spawn | `fda79214`, merge-base `3781a3fe` — **the wrong base, for the 5th agent running** |
| corrective action | `git reset --hard bfd67ab4`, then re-bootstrapped |
| **base SHA after correction** | **`bfd67ab4a529c3b134b8c5fd195338f5694f97fe`** |
| branch | `worktree-agent-a031185b3c96338f1` (allow-list assertion passed) |
| Wave-1 sanity check | `templateAdmission` at `soulData.ts:232` ✓ · `CARD_TEMPLATE_MARK` at `libraryVocabulary.ts:358` ✓ |
| `GSD_VITEST_MAX_WORKERS` | `4`, exported in every shell that ran vitest or the gate |

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Splice the mark at index 0 of `identityParts` (D-13/D-14/D-15) | `dc59a79d` | `WorkflowCard.tsx` (+73/−2) |
| 2 | Pin the slot and the three-arm silence | `36c259d7` | `WorkflowCard.test.tsx` (+249/−10) |

## What shipped

```ts
const templateMark = templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []
const identityParts: string[] = [
  ...templateMark,          // D-14 — after provenance, before everything else
  ...identity.segs,
  ...(identity.ofN === null ? [] : [identity.ofN]),
  ...(identity.when === null ? [] : [identity.when]),
]
```

No new prop, no `RowIdentity` field, no new node type, no package. `row.def` was already on the
row type; the in-card derivation sits one line below the shipped ownership-predicate read that
established the practice. On both silent arms `templateMark` spreads an empty array, so a row
that does not admit composes byte-identically to the way it did before this phase.

## The corrections this plan owed, made on measurement

**1. ⚠ NOTHING HERE CLAIMS A TYPECHECK ENFORCES THE PLAIN-TEXT RULING, and the card's own
docblock now says why.** D-13's text justifies the ruling by citing 188.2's `@ts-expect-error`
two-badge ceiling. That control guards the CANVAS `PhaseNodeCard`; **there is no badge ceiling of
any kind under `library/`.** The ruling STANDS on SEED-155 / UAT U8 — sketch 163 drew a chip this
card structurally could not render — and the docblock forbids the false claim by name. What
enforces it mechanically is now arithmetic over the rendered DOM (see the D-13 case below), which
is a guard this file did not previously have.

**2. The plan's child-count formula counts the own pill twice, and the fix was found by a RED
rather than reasoned out.** The acceptance criterion reads `1 + 2 × parts.length`; measured,
`identityParts()` reads the LINE's children, so its first entry *is* the own pill and the card's
own `identityParts` array is that list minus one. Observed failure before the correction:

```
AssertionError: expected <span …(1)></span> …(8) to have a length of 11 but got 9
  at WorkflowCard.test.tsx:865  expect(line.children).toHaveLength(1 + 2 * parts.length)
```

The shipped assertion is `1 + 2 × (parts.length − 1)`, and the `− 1` is documented in the case.

**3. The same criterion's "`CARD_TEMPLATE_MARK` at array index 0 of `identityParts(line)`" is
self-contradictory with D-14 and with the plan's own ordered array.** Index 0 of the helper's
output is the OWN PILL; D-14 says the mark comes *after* provenance. Shipped per the ordered
array in the plan's `<action>` — `[OWN_*, CARD_TEMPLATE_MARK, …]` — i.e. index **1** of the
helper, which is index **0** of the card's `identityParts`. Both readings are asserted explicitly
so a later reader is never left to adjudicate.

**4. `grep -c "needs a template"` on the card must be 0, so the mark's words are not spelled in
that file at all — not even in prose.** The first draft's docblock quoted the example line and
the grep read 2. This is the 187-24 trap the file's own header already records twice (it applies
the same rule to the forbidden tooltip attribute and to the ownership predicate's identifier).
The prose now reads `Yours · <the mark> · changed 2 months ago`, and the reason is written down.

## Proof, not assertion

**RED-first, twice, against real plants in production source.**

*(a) The silence — comparison flipped to the Run modal's D-20 fallback (`!== "does-not-admit"`):*

```
× UNKNOWN — `phases: []`, the shape 110 of 145 published rows carry, renders no mark
  AssertionError: expected [ 'Yours', 'needs a template', …(2) ] to deeply equal [ 'Yours', 'Original', …(1) ]
× the three silent arms agree with each other, node for node
  AssertionError: expected [ 'Yours', 'needs a template', …(2) ] to deeply equal [ 'Yours', 'Original', …(1) ]
Tests  2 failed | 88 passed (90)
```

*(b) The slot — splice moved from index 0 to the END of `identityParts`:*

```
× a COLLIDING row renders own · mark · segs · 1 of N · changed, in that order
  AssertionError: expected [ 'Shared', …(5) ] to deeply equal [ 'Shared', 'needs a template', …(4) ]
× ADMITS — an emit phase with no bound template renders the mark at the D-14 slot
  AssertionError: expected [ 'Yours', 'Original', …(2) ] to deeply equal [ 'Yours', 'needs a template', …(2) ]
× never more than the two computed segments the resolver may spend (D-04)
  AssertionError: expected 'No project' to be 'needs a template' // Object.is equality
Tests  8 failed | 82 passed (90)
```

Both are real `AssertionError`s, not timeouts, and (a) fails on the arm 110 of 145 published rows
actually take — which is the 192 CR-01 lesson applied rather than quoted.

| | md5 of `frontend/src/components/workflows/library/WorkflowCard.tsx` |
|---|---|
| pre-plant | `20a17eaf21023fb78150bebca9e4fce1` |
| after plant (a) restore | `20a17eaf21023fb78150bebca9e4fce1` |
| after plant (b) restore | `20a17eaf21023fb78150bebca9e4fce1` |

Both restores confirmed independently by `git status --short` returning the file clean against
its committed blob.

## The blast radius, stated rather than smoothed

**Eight shipped expectations gained a segment, and they gained it because the house fixture
GENUINELY ADMITS.** `DEF` in `WorkflowCard.test.tsx` carries an `llm_emit` phase (the deliverable
soul atom needs one) and binds no library template — D-21's `admits` exactly. That is now asserted
by a non-vacuity case rather than left to inference, alongside all four arms:

```ts
expect(templateAdmission(asDef(DEF))).toBe("admits")
expect(templateAdmission(asDef(NO_EMIT_DEF))).toBe("does-not-admit")
expect(templateAdmission(asDef(BOUND_TEMPLATE_DEF))).toBe("does-not-admit")
expect(templateAdmission(asDef(EMPTY_PHASES_DEF))).toBe("unknown")
```

**No expectation on a non-admitting row was edited.** Two cases were handled differently from a
mechanical insert, and both choices are arguments rather than convenience:

- **`the separator is spent BETWEEN present parts only — never a dangling one` changed its ROW,
  not its expectation.** That case exists to render a line with NOTHING after the own word;
  appending the mark to its array would have deleted the suite's only one-part line while leaving
  the case's name intact. It now renders `PUBLISHED_NO_TEMPLATE` (a positive `does-not-admit`) and
  **both assertions survive verbatim**.
- **The scale block's cap rose PER ROW, computed from the same predicate the card calls** —
  `templateAdmission(row.def) === "admits" ? 6 : 5` over all 106 rows. A blanket `<= 6` would have
  weakened the fence for every row in the corpus, including the ones that render no mark at all;
  as written, a mark on a row that does not admit still reds there.

## What the new block pins

| Case | Property |
|---|---|
| non-vacuity | all four definition shapes reach the arm they claim |
| ADMITS | the mark renders at the D-14 slot, asserted by array index |
| DOES-NOT-ADMIT (no emit phase) | `SILENT_LINE` |
| DOES-NOT-ADMIT (binds a library template) | `SILENT_LINE` — D-21's measured arm, 16 of 17 emit-phase rows |
| UNKNOWN (`phases: []`) | **the same `SILENT_LINE` value**, so D-15's indistinguishability is mechanical |
| the three silent arms agree, node for node | the pairwise form, plus a non-vacuity check that both verdicts are present |
| D-13 structural | `line.children === 1 + 2 × (parts.length − 1)` — a chip/badge/icon breaks it |
| POSITIVE CONTROL | the arithmetic reds on a node this file plants itself |
| D-08 | provenance still at DOM position 2, driven on an ADMITTING row |
| one home | `CARD_TEMPLATE_MARK` is imported, never retyped |

## Verification

| Check | Required | Observed |
|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` (baseline, before any edit) | — | **33** |
| `tsc` after the card edit | 33 | **33** — unmoved |
| `tsc` at plan end | 33 | **33** |
| `vitest run library/librarySubtree.fences.test.ts` | pass | **118 passed** (F1 / F4 / F5 / T-192-04 unmoved) |
| `vitest run library/WorkflowCard.test.tsx` | pass, ≥ 80 | **90 passed / 0 failed** (was 80) |
| `vitest run src/components/workflows/library/` | 0 failed | **8 files / 430 passed** |
| `node ../scripts/vitest-count-gate.cjs` | exit 0, `failed 0`, no `[count-decrease]` | **exit 0** · `total 3493 · failed 0` · 66/66 pinned files present |
| `eslint library/WorkflowCard.tsx` | 0 / 0 | **0 / 0** |
| `eslint -c eslint.a11y.config.js library/WorkflowCard.tsx` | 0 | **0** |
| `eslint library/WorkflowCard.test.tsx` | 0 / 0 | **0 / 0** |
| `grep -c "templateAdmission(row.def)"` | 1 | **1** (operand is the literal `"admits"`) |
| `grep -c "needs a template"` in `WorkflowCard.tsx` | 0 | **0** |
| `grep -c "title="` / `grep -c "dangerously"` in `WorkflowCard.tsx` | 0 / 0 | **0 / 0** |
| `rowIdentity.ts` diff | none | **none** — not in `files_modified`, not touched |

The count gate also reports inherited drift this plan did not author — `soulData.test.ts +16`
(193-02's own) and `PhaseTimeline.test.tsx +4`. **The pin was NOT raised here**; `193-11` owns
the sweep, exactly as `193-02` recorded.

## D-21's cost, restated plainly — and what it demands of UAT

**The mark is visible on exactly ONE published row in the local library:
`ephemeral-template-fill-101uat`.** Live scoring over the 145 published rows is
**1 admits / 34 does-not-admit / 110 unknown**. 16 of the 17 emit-phase published rows already
bind a library template, on which `_exec_llm_emit` resolves the bound asset first and the run-time
upload is unreachable code — so the mark there would be simply false; and 110 carry a `phases: []`
stub nobody authored, which reads `unknown` and stays silent.

⚠ **SC#3's G-4 UAT row (U5) MUST be driven against `ephemeral-template-fill-101uat`, and against
a non-admitting published row BESIDE it.** A scoreboard that drives any other slug cannot see this
feature at all and would report a false negative with every gate green. The second half of the row
is not optional: without a silent row in the same view, "the mark renders" is satisfied identically
by a card that marks everything.

## Hot-file ledger — `library/WorkflowCard.tsx`, re-derived not re-read

`CLAUDE.md` records **6 commits / 2 phases / 721 L**. Measured at this plan's close:

| | Command | Value |
|---|---|---|
| commits | `git log --oneline -- <file> \| wc -l` | **8** |
| phases | `git log --format=%s -- <file> \| sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \| sed -E 's/-.*//' \| sort -u` | **3** — `192 192.1 193` |
| lines | `wc -l <file>` | **818** (721 at 193's open, 747 at discuss time) |

⚠ **193 IS THIS FILE'S THIRD PHASE, SO G-5 NOW FIRES ON THE COUNT.** The ledger cell's own closing
sentence — *"the moment a THIRD phase lands here, G-5 fires on the count and this cell must be
re-derived, not re-read"* — is satisfied by this plan, and the obligation passes to Phase 194: a
phase that adds a genuinely SECOND concern to this card owes a refactor recommendation FIRST.
193-06 does not add one — its whole change is one derived constant and one array spread inside the
composition the file already owned — but the +97 lines are 74 % docblock prose, the same dominant
term the three prior cuts on this subtree measured. The ledger row itself is not edited here:
`CLAUDE.md` is not in this plan's `files_modified`, and the phase's own docs plan owns that write.

## Deviations from Plan

**None that change what shipped.** Four corrections were made ON MEASUREMENT and are recorded in
full above rather than silently applied: the child-count formula (found by a RED), the
index-0-of-which-array contradiction, the raw-grep-vs-prose collision on the mark's words, and the
fact that no typecheck guards D-13 here. Three further records:

1. The worktree base correction is the documented protocol firing, not a plan change — and it is
   the 5th consecutive agent this phase to hit it.
2. `.claude/skills/sketch-findings-agentic-rag/` carries **no** finding for the identity line or
   for this card (`grep -rn "row-identity"` over the skill tree returns nothing) — sketch 164's
   findings are not yet folded in. The acceptance bar used was the generated BUILD-CONTRACT, whose
   string `193-02` already ported and compared byte-for-byte.
3. The scale-block cap and the dangling-separator row are edits the plan did not enumerate. Both
   are argued above; neither weakens an assertion.

## Known Stubs

None. The mark is a complete value from `libraryVocabulary.ts`, the predicate has no placeholder
arm, and every branch the card can take is asserted at the surface.

## Threat Flags

None. No new network surface, no auth path, no file access, no schema change. The mark is a
module constant — no definition-derived value reaches the DOM through it, `templateAdmission`
returns a closed union, and the render path is the JSX text node the line already used (T-193-22).
T-193-23's `title` sweep and T-193-24's per-render cost are unchanged: `grep -c "title="` → 0, and
the predicate runs where the shipped ownership predicate already runs, at the same cadence.
T-193-SC: **zero packages installed.**

## Self-Check: PASSED

- `frontend/src/components/workflows/library/WorkflowCard.tsx` — FOUND (818 L)
- `frontend/src/components/workflows/library/WorkflowCard.test.tsx` — FOUND (1371 L)
- commit `dc59a79d` — FOUND
- commit `36c259d7` — FOUND
- `.planning/STATE.md` / `.planning/ROADMAP.md` — **not modified** (orchestrator owns them); no
  `gsd-sdk query state.*`, `requirements.mark-complete` or `roadmap.*` verb was invoked.
