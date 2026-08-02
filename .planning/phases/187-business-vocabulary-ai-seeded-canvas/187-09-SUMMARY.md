---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 09
subsystem: frontend/canvas-node-face
tags: [vocab-01, req-4, d-187-06, d-187-16, d-187-05, adapter-only, tdd, prose-proof-guards]
requires:
  - "phaseVocabulary.nodeTitle(phase, ctx?) + NameContext — the 4-tier ladder landed by 187-04"
  - "canvasModel ToCanvasOptions.nameContext + buildPhaseData's third parameter — landed by 187-08"
  - "PhaseNodeCard's shipped subtitle slot (`:321-323`), which wraps where the title slot truncates"
  - "the shipped app-wide TechnicalNamesProvider — one boolean, read by the canvas shell"
provides:
  - "the canvas card's SUBTITLE-slot reveal swap — the plain title now survives the ⌥ toggle"
  - "PhaseNode.test.tsx — the adapter's first suite of its own (13 tests)"
  - "PhaseSpineGraphProps.nameContext — the spine half of the injected id→name lookup"
  - "the spine's TITLE agreement: nodeTitle(phase, nameContext) in both toggle states"
affects:
  - "187-15 — the page still owes `nameContext` to <PhaseSpineGraph>; the prop now exists, nothing passes it yet"
  - "Phase 188 — `technicalLine` is still unspent and still reserved, alongside `status` and `stepNumber`"
  - "any surface reading PhaseSpineGraph — it is no longer a TechnicalNamesProvider consumer"
tech-stack:
  added: []
  patterns:
    - "adapter-only change — the slot moved, the card did not"
    - "assert an acceptance criterion stated as an EQUALITY as an equality, over two renders in one test"
    - "source guards anchored on code-only forms, never on a token the prose must be free to quote"
    - "read the slot back off the DOM by POSITION when the component may not be given a test hook"
key-files:
  created:
    - frontend/src/components/workflows/PhaseNode.test.tsx
  modified:
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/PhaseSpineGraph.tsx
    - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
decisions:
  - "The spine's reveal SUBSCRIPTION is removed, not left dead. With the title no longer swapping, no rendered value on that surface depends on the reveal — tsc -b (TS6133) and ESLint both refused the unused read, so this was measured rather than chosen."
  - "The plan's `grep -c 'showTechnical ? technicalTitle'` = 0 criterion is honoured LITERALLY by describing the retired expression in prose and quoting it verbatim exactly once — as the positive control of the source guard, where it cannot be mistaken for live code."
  - "The card↔spine agreement is asserted against `toCanvas(...).nodes[0].data.title` (the string the CARD paints), not against a second call of `nodeTitle` — two surfaces compared, not one function compared with itself."
  - "The title/subtitle slots are read by DOM POSITION, because PhaseNodeCard gives them no hooks and this plan may not add any."
  - "The reveal-ON title equality is asserted against the reveal-OFF title captured in the SAME test, with a non-vacuity guard, rather than against a hand-typed string."
metrics:
  duration: ~50 min
  tasks: 2
  commits: 4
  completed: 2026-08-02
---

# Phase 187 Plan 09: The reveal stops destroying the title — Summary

The ⌥ Technical-names reveal now swaps the canvas card's **subtitle**, so the plain title
survives and the whole slug reaches the DOM uncut; the spine simply stops swapping, and
both graph views agree on the title in both toggle states.

## What Was Built

**Task 1 — the subtitle-slot swap (`37c898e8` RED → `3a9f5723` GREEN).** A three-line
change to the adapter and nothing else:

```tsx
title={data.title}                                     // was: technical ? technicalTitle : title
subtitle={technical ? data.technicalTitle : data.subtitle}
```

`technicalTitle` already rode on `data` (`canvasModel.ts:296`), so **no new `PhaseNodeData`
key was needed and the projection never moved** — `git status --porcelain` on
`canvasModel.ts`, `PhaseNodeCard.tsx` and `__snapshots__/` is empty, and
`canvasModel.fixtures.test.ts` still reports its unchanged 100.

The reservation comment at `:183` was **maintained rather than left**, per this file's own
rule that a comment still naming a slot the component now fills is the same defect as a
false docblock. It is the first edit to that line that does not *remove* a name from it,
and the comment now says why: Req 4 moved the reveal into a slot the card already renders
and the adapter already fills, so **no reserved slot was spent** — `technicalLine` is still
Phase 188's, and choosing it instead (sketch 149-B) would have been a Phase 188 scope
decision this phase declines to make.

**`PhaseNode.test.tsx` is net-new — the adapter had no suite of its own**, which is
precisely why the reveal could destroy the title unnoticed for four phases. 13 tests over
six blocks, driven through the shipped harness (`mockReactFlow()` + a real `<ReactFlow>`
carrying the real `nodeTypes` map) over a real `toCanvas()` projection, with `technical`
merged onto `data` in exactly the shape the shell uses at `WorkflowCanvas.tsx:949`. The
fixture is a supplier-renewal draft with `folder_scope` and `skill_ref` bound — no shipped
canvas fixture reaches 187-04's derived tier, and Req 4's whole argument is that the reveal
now destroys a **specific** title. Its slugs are deliberately long: `find-renewal-terms` is
the exact slug sketch 149 measured the clip on (`AI agent step · find-renewal-t…`).

**Task 2 — the spine's title agreement (`0b30dcac` RED → `8e54edee` GREEN).** The ternary
became `nodeTitle(phase, nameContext)`, and a `nameContext?: NameContext` prop was added and
threaded to that call and nowhere else (`:84` declared, `:91` destructured, `:174` used).
The raw `phase_type` chip, the `phase_index` line and the `aria-label` **template** are
untouched — **0 non-comment diff lines** match any of the three.

### The reveal ON, before and after

| Surface | Slot | Before | After |
|---|---|---|---|
| canvas card | title | `AI agent step · find-renewal-t…` **(clipped)** | `Search Supplier Contracts` |
| canvas card | subtitle | `Searches and decides its own next move` | `AI agent step · find-renewal-terms` **(whole slug)** |
| spine | title | `AI agent step · find-renewal-terms` | `Search Supplier Contracts` |
| spine | chip / index line | raw, unconditional | **unchanged** |

## Verification

| Gate | Bar | Result |
|---|---|---|
| 8-file verification set (the plan's) | ≥ 863 passed, 0 failed | **980 passed, 0 failed** |
| `PhaseNode.test.tsx` | passes | **13 passed** (net-new) |
| `PhaseNodeCard.test.tsx` | unchanged from HEAD's 68 | **68** |
| `PhaseSpineGraph.test.tsx` | `?raw` guards green | **20 passed** (HEAD 14, +6 net) |
| `PhaseSpine.test.tsx` | unchanged | **11** |
| `WorkflowCanvas` × 3 suites | unchanged | **111 passed, 0 failed** |
| `WorkflowBuilderPage.canvas` / `.header` / `ProblemsTray` | unchanged | included in **265 passed** across 7 consumer suites |
| `git status --porcelain PhaseNodeCard.tsx canvasModel.ts` | empty | **empty** |
| `git status --porcelain __snapshots__/` | empty | **empty** |
| `grep -c "technicalLine=" PhaseNode.tsx` | 0 | **0** (2 mentions, both in the reservation comment) |
| `grep -c "showTechnical ? technicalTitle" PhaseSpineGraph.tsx` | 0 | **0** |
| chrome / `aria-label` non-comment diff lines | 0 | **0** |
| `npx eslint` on all 4 files | clean | **clean** |
| `npx tsc -b` | see Deviations | **33 errors, 0 in `components/workflows`, identical before and after** |

**RED was observed for both halves, not inferred.** Task 1's suite was committed failing
(`37c898e8`: **5 failed / 8 passed**) and every one of the five was a Req-4 behaviour — the
title equality, the subtitle swap on every node, the whole-slug assertion, the truncate
asymmetry and the no-context swap. Task 2's was committed failing (`0b30dcac`: **6 failed /
14 passed**), including the re-shaped swap assertion and the source guard.

## Deviations from Plan

### 1. [Rule 3 — blocking] The spine's reveal subscription had to be REMOVED, not left

- **Found during:** Task 2, immediately after the plan's own edit.
- **Plan text:** *"Replace `const title = showTechnical ? technicalTitle(phase) : nodeTitle(phase)`
  with `const title = nodeTitle(phase, nameContext)`."* The plan anticipated a dead
  `technicalTitle` import (*"`tsc -b` will say"*) but not a dead `showTechnical`.
- **Measured:** with the swap gone, `showTechnical` has no reader and **both** tools refuse
  it — `PhaseSpineGraph.tsx(79,9): error TS6133: 'showTechnical' is declared but its value
  is never read` and ESLint `@typescript-eslint/no-unused-vars`. So the choice was made by
  measurement, not taste.
- **Resolution:** the local, the `useTechnicalNamesOptional` import and the docblock
  paragraph promising the reveal are all removed, and the docblock now records the removal
  and its reason at length. **This is a real behaviour change worth stating plainly: the
  spine is no longer a consumer of the technical-names state at all.** It costs nothing,
  because that surface never hid the technical vocabulary — its mono chip prints the raw
  `phase_type` unconditionally, its second line prints the raw `phase_index`, and its
  `aria-label` carries the raw type, all three with the reveal OFF. That is the measured
  basis of D-187-16, and it is now asserted by its own test rather than only argued.
- **The `must_haves` truth it touches** — *"the reveal remains the single app-wide
  `TechnicalNamesProvider` boolean — no second source of truth"* — **still holds, and more
  strongly:** a consumer was removed, none was added, and the provider is untouched.
- **Commit:** `8e54edee`.

### 2. [Rule 1 — the D-ITEM-183-02 trap, fired twice, in the open]

The plan's Task-2 acceptance criteria are greps over the component source. Written the
obvious way, **two of them were satisfiable only by deleting the explanation of the change
they were checking** — the exact trap this project has now hit half a dozen times. Both
fired for real during execution rather than being reasoned about in advance:

| Guard | What tripped it | Resolution |
|---|---|---|
| `not.toMatch(/showTechnical \? technicalTitle/)` | the new comment quoted the retired line **verbatim**, so the needle was in the prose | re-anchored on `const title = showTechnical` — a form only CODE can have — and the comment now *describes* the retired ternary. The verbatim expression survives exactly once, as the guard's **positive control**, where it cannot be mistaken for live code. The plan's literal criterion is therefore **0**, honestly. |
| `nameContext` occurs exactly 3× | it occurs **5×**, and all five are honest: 2 declarations, 1 call, 2 explanations | re-anchored on the ARGUMENT form: `/nameContext\)/` = **1**, `/nameContext\?: NameContext/` = **1**, `/nodeTitle\(/` = **1**. The property the criterion wanted — *reaches `nodeTitle` and nowhere else* — is now measured instead of approximated by a line count. |

The same reasoning applies to the plan's chrome grep
(`git diff -U0 … | grep -cE '(phase\.config\.phase_type|phase_index \{|aria-label)'`), which
reports **2**. Both matches are **added comment lines** (`+ *` and `+ //`) explaining that
the chrome is untouched. The comment-excluding measurement — which is the one that measures
the property — is **0**. Recorded here rather than silently reported as green.

### 3. [Rule 1 — refuted inherited claim, corrected in a file already being edited]

`PhaseSpineGraph.test.tsx:208` carried *"only 10 of 119 phases are named"*. The 187 SPEC
refuted it (**0 of 57** across the 27 well-formed `workflow_definitions` rows) and 187-04
corrected `phaseVocabulary.ts`'s copy. This one was still standing in a file this plan
edits, so it is corrected in the same edit, with the reason: the correction **strengthens**
the fixture's point rather than weakening it — unnamed is not the dominant shape, it is the
only shape the shipped ladder ever saw.

### 4. [Rule 1 — inherited claim, already logged] `npx tsc -b` does not exit 0

Both tasks carry *"`npx tsc -b` exits 0"*. Re-measured at this plan's HEAD rather than
inherited: **exit 2, 33 `error TS` lines, zero in `src/components/workflows/`**, identical
before and after this plan's edits — so the delta is provably zero. Already logged as
`D-ITEM-01` in the phase's `deferred-items.md` by 187-04, with the correct reading of the
criterion. Nothing new added there.

### 5. [In scope, worth naming] Two shipped assertions were re-shaped, and both had to be

- `PhaseSpineGraph.test.tsx` *"flipping the reveal ON shows `<type label> · <slug>` on EVERY
  node at once"* is **exactly the sentence Req 4 had to make false** on this surface.
  Keeping it green would have required this plan not to exist. It is re-shaped into its
  stronger form — titles and accessible names asserted **identical** across the flip on
  every node, with a non-vacuity pin, plus a new companion test asserting the raw chip and
  index line are byte-identical across the flip so the technical vocabulary is proved
  **still present** rather than assumed gone.
- The `emit` fixture's comment promised the swap. Corrected, pointing at the new home of the
  technical form (the canvas card's subtitle slot) and at the block that explains why the
  spine has no analogue.

Nothing was deleted and no expectation was weakened. `titleOf` was hoisted to module scope
rather than copied into the new block — two spellings of a title reader is how two halves of
one suite start measuring different elements (`PhaseNodeCard.test.tsx:86-89`'s lesson).

### 6. [Audited, no action] `ProblemsTray` was checked for a card↔row disagreement

Worth recording because it looked like one and is not. The tray renders
`nodeTitle(phase, nameContext)` as the row name **unconditionally** and *adds* a mono
technical line beneath it when the reveal is on (`:252-259`). It never swapped. So the tray
had independently arrived at the same principle 149-C locks — **keep the plain name, put the
technical form on its own line** — and this plan brings the canvas card into agreement with
it rather than away from it. No edit, no deferred item.

## Known Stubs

None. Both changes are fully wired and exercised.

One **open item is handed forward, not stubbed**: `PhaseSpineGraphProps.nameContext` exists
and is threaded, but **nothing passes it yet** — `WorkflowBuilderPage.tsx` mounts the spine
without it, which is byte-identical to HEAD by construction and is asserted by its own test
(*"OMITTING it renders exactly what HEAD rendered"*). That is **187-15's line**, the same
one that owes the canvas its `assets[] where kind === "template"` → `ctx.templateFilename`
resolution. The prop is the whole wiring cost; there is nothing else to build.

## Threat Flags

None. No new network surface, auth path, file access or schema — this plan moves one prop
value between two existing slots and adds one optional prop.

| Threat | Disposition |
|---|---|
| T-187-09-01 `PhaseNodeCard` invariants | mitigated — `git status --porcelain` on that file is **empty**; badges asserted identical in both toggle states (same ids, same labels, ≤ 2); no focusable control asserted on every card in both states |
| T-187-09-02 a second technical-names source | mitigated — the canvas still reads `data.technical` set by the shell; the spine's consumer was **removed**, none added; no new context, no new state |
| T-187-09-03 a second copy of the vocabulary | mitigated — the `?raw` guards in `PhaseSpineGraph.test.tsx` / `PhaseSpine.test.tsx` run green; the derivation is imported, never redeclared |
| T-187-09-04 accessible-name regression | mitigated — the `aria-label` is asserted identical across the flip and still contains the raw `phase_type`; the title is still resolved ONCE and used for both the visible title and the accessible name (WCAG 2.5.3), and the source line is untouched |
| T-187-09-05 rendered title/subtitle | accept — both render as plain React text children; the raw-HTML prop is never used and `PhaseNodeCard`'s own fence still forbids it |

**One honest correction to the plan's threat text.** T-187-09-04 asks for the `aria-label`
to be *"byte-identical to HEAD in both toggle states"*. Its **template** is byte-identical
and its VALUE is identical across the two toggle states — but the reveal-ON value necessarily
differs from HEAD's, because HEAD's reveal-ON label embedded the swapped title. That is
WCAG 2.5.3 working correctly: the accessible name tracks the visible one, so a title that
stops moving is a label that stops moving. Stated here rather than left to be discovered.

## For the Next Plan

- **`technicalLine` is still unspent.** `PhaseNode.tsx`'s reservation comment now records
  that 187-09 moved the reveal into the SUBTITLE slot and why that is **not** the same as
  spending 188's slot. Phase 188 inherits `status`, `technicalLine` and `stepNumber` intact.
- **`PhaseSpineGraph` no longer consumes `TechnicalNamesProvider`.** If a future phase wants
  a reveal-dependent value on the spine, it re-adds the read — it will not find a dead one
  lying around, and the docblock says why.
- **187-15 owes `nameContext` to the spine mount**, one prop on
  `<PhaseSpineGraph>` in `WorkflowBuilderPage.tsx`, alongside the canvas prop 187-08 added.
- **Read a canvas card's title/subtitle by DOM POSITION**, not by test id — the card gives
  them no hooks and its invariants say it should not gain any. `PhaseNode.test.tsx`'s
  `slotsOf` is the one helper for it.
- **Do not gate acceptance on `tsc -b` exiting 0** — `deferred-items.md` D-ITEM-01.
- **When writing a source guard for this phase, anchor on a code-only form.** Both of this
  plan's first-draft guards were satisfiable only by deleting an explanation, and both were
  caught by running them rather than by reading them.

## Self-Check: PASSED

- `frontend/src/components/workflows/PhaseNode.test.tsx` — FOUND (created)
- `frontend/src/components/workflows/PhaseNode.tsx` — FOUND (modified)
- `frontend/src/components/workflows/PhaseSpineGraph.tsx` — FOUND (modified)
- `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — FOUND (modified)
- commits `37c898e8`, `3a9f5723`, `0b30dcac`, `8e54edee` — all FOUND in `git log`
- key links verified in source: `PhaseNode.tsx:217-218` (`title={data.title}` /
  `subtitle={technical ? data.technicalTitle : data.subtitle}`),
  `PhaseSpineGraph.tsx:174` (`nodeTitle(phase, nameContext)`)
- no file deletions across the four commits; no untracked files left in `frontend/src`
