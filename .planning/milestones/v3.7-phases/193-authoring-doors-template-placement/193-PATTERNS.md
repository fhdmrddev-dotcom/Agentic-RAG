# Phase 193: Authoring Doors + Template Placement — Pattern Map

**Mapped:** 2026-08-13
**Measured at HEAD:** `cafc9389` (`docs(193): add validation strategy`)
**Files analyzed:** 4 created · 11 modified
**Analogs found:** 15 / 15 (every new file has a shipped analog in this repo)

---

## ⚠ Read this first — the HEAD moved, and two inherited numbers measure FALSE

`193-RESEARCH.md` and `193-VALIDATION.md` are measured at `58a402bc`. **HEAD is now `cafc9389`.**
Verified the drift is docs-only before trusting a single line number:

```bash
git diff --stat 58a402bc cafc9389
#  193-CONTEXT.md    |  104 ++
#  193-RESEARCH.md   | 1205 ++++
#  193-VALIDATION.md |  168 ++
#  3 files changed, 1477 insertions(+)      ← ZERO source files
```

**So every `file:line` in RESEARCH § B and § D still holds at `cafc9389`.** Spot-re-derived and
confirmed TRUE: `WorkflowDoorSwitch.tsx` 385 L · `doorGroup` docblock 145–155 / fragment 156–175 /
standalone band 179–181 / inline pass-through 202 / describe band 214–231 / chooser breadcrumb
321–323 · `ml-auto` conditional at `:170` · `RunModal.tsx` 430 L, block 306–361, provenance
358–360 with the string at `:359`, `launchError` node 353–357, `const def` at `:90`, soulData import
at `:60` · `WorkflowCard.tsx` 747 L, identity JSX 543–561, `identityParts` 498–502,
`IDENTITY_SEPARATOR` at `:307` · `libraryFilter.ts:173` = `"makes-a-file"` · `soulDeliverable` at
`soulData.ts:161` · `WorkflowBuilderPage.header.test.tsx:304` = the byte-exact band literal.

**Gates re-measured at `cafc9389`, not inherited:**

| Gate | Command | Result |
|---|---|---|
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` | **33** ✓ |
| Lint, the five touched files | `npx eslint …DoorSwitch.tsx …WorkflowCard.tsx …RunModal.tsx …libraryVocabulary.ts …soulData.ts` | **0 / 0** ✓ |

### Corrections

| # | Inherited claim | Source | Measured | Command |
|---|---|---|---|---|
| **P-1** | `soulData.ts` is **172 L** | RESEARCH § Sources | **171 L** | `wc -l frontend/src/components/workflows/soulData.ts` |
| **P-2** | `libraryVocabulary.ts` is *"the naming and shape precedent"* for `doorVocabulary.ts` (D-10, RESEARCH § B.7) | CONTEXT canonical_refs | **It is the WRONG-DIRECTORY analog and a second-best one.** `components/workflows/` **already contains two shipped vocabulary leaves** — `runVocabulary.ts` (482 L, its own suite `runVocabulary.test.ts` 420 L) and `phaseVocabulary.ts` (834 L, `phaseVocabulary.test.ts` 1377 L). `libraryVocabulary.ts` **has no suite of its own**; it is asserted through `librarySubtree.fences.test.ts` and `WorkflowCard.test.tsx`. `runVocabulary.ts` is the same directory, the same `.ts`-leaf shape, the same "locked in CONTEXT, mirrored here" rule, **and it is the file `libraryVocabulary.ts:8,18` itself cites as its precedent.** See § S-1. | `find frontend/src -name "*ocabulary*"` |
| **P-3** | CONTEXT `<deferred>`: merging vocabularies re-opens when *"a third vocabulary module appear[s] on the workflow surface"* | CONTEXT deferred | **The trigger has ALREADY fired and the deferral is still right.** `doorVocabulary.ts` will be the **fourth** module named `*Vocabulary` on this surface (`runVocabulary`, `phaseVocabulary`, `library/libraryVocabulary`, + doors). Stated so the deferral is a decision rather than an oversight. | same |
| **P-4** | The contract COPY table is at `BUILD-CONTRACT.generated.md:31-52` | RESEARCH § C | **`:33-52`** (20 rows; `:31-32` are the header + rule). Immaterial, corrected on measurement. | `grep -n "^\| \`" BUILD-CONTRACT.generated.md` |
| **P-5** | *"ALL 20 COPY ids"* / D-23 makes it 21 | D-11 / D-23 | **TRUE, and the `build.cjs` array holds 21 ENTRIES, not 20.** `COPY[]` (`build.cjs:51-78`) has a **21st row, `describe.hint` (`:71`)**, carrying `shipped: null` and no B/C/D — a composite descriptor, not a substitutable string. It is filtered out of the generated table (hence 20 rows). **A planner that ports `COPY.length` ports one entry too many.** D-23 takes the substantive count 20 → 21. | `grep -n "id:" build.cjs` |

---

## File Classification

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| **NEW** `components/workflows/doorVocabulary.ts` | vocabulary leaf (`.ts`, zero runtime imports) | transform (pure data) | **`components/workflows/runVocabulary.ts`** (secondary: `library/libraryVocabulary.ts`) | **exact** |
| **NEW** `components/workflows/DoorHeaderStrip.tsx` | presentational component (extraction product) | request-response (props → DOM) | **`components/workflows/PlaneEditingLayer.tsx`** (188.1 verbatim-move product) | **exact** |
| **NEW** `components/workflows/doorVocabulary.test.ts` | unit / exact-match vocabulary suite | transform | **`components/workflows/runVocabulary.test.ts`** | **exact** |
| **NEW** `components/workflows/DoorHeaderStrip.test.tsx` | unit + source-fence suite | transform | **`WorkflowCanvas.test.tsx:669-767`** (the ESM-cycle fence) + `WorkflowDoorSwitch.test.tsx` | **exact** |
| **NEW (Wave 0)** the `WorkflowDoorSwitch` characterization baseline | characterization capture | transform | **`pages/__tests__/RunModal.test.tsx:325-…`** (192-03's six whole-`innerHTML` captures) | **exact** |
| MOD `components/workflows/WorkflowDoorSwitch.tsx` (385 L) | component (extraction source) | request-response | `WorkflowCanvas.tsx` post-188.1 (import-the-layer shape) | exact |
| MOD `components/workflows/WorkflowDoorSwitch.test.tsx` (418 L) | unit + `?raw` fence suite | transform | itself (`:21`, `:192`, `:204`, `:402`) + `librarySubtree.fences.test.ts` | exact |
| MOD `components/workflows/soulData.ts` (171 L) | pure derivation module | transform | **`soulDeliverable` at `:161-171` — the function it sits beside** | exact |
| MOD `components/workflows/soulData.test.ts` (pinned 17) | unit (pure) | transform | `libraryFilter.test.ts` / its own shipped cases | exact |
| MOD `library/WorkflowCard.tsx` (747 L) | presentational card | request-response | **its own identity line at `:543-561`** | exact |
| MOD `library/WorkflowCard.test.tsx` (1132 L, pinned 80) | unit (child-order assertions) | transform | **its own `identityParts()` at `:154` + the child-order block at `:598-629`** | exact |
| MOD `library/RunModal.tsx` (430 L) | modal component | request-response | itself (`:306-361`) | exact |
| MOD `pages/__tests__/RunModal.test.tsx` (pinned 32) / `.a11y` (16) | characterization + a11y | transform | itself (`RUN_MODAL_HTML_BASELINE`) | exact |
| MOD `pages/WorkflowBuilderPage.header.test.tsx` (pinned 32) | characterization | transform | itself (`FLAG_OFF_HEADER_MARKUP:302-306`) | exact |
| MOD `scripts/vitest-count-gate.cjs` | config | — | its own `BASELINE` / `TARGETS` blocks | exact |
| MOD `.planning/sketches/164-…/build.cjs` | generator config | transform | its own `COPY[]` + `D_FROM_C` | exact |

---

## Pattern Assignments

### `frontend/src/components/workflows/doorVocabulary.ts` — NEW (vocabulary leaf, pure data)

**Primary analog:** `frontend/src/components/workflows/runVocabulary.ts` (482 L)
**Secondary analog (for the `export const` per-string shape):** `library/libraryVocabulary.ts` (448 L)

**Why `runVocabulary.ts` and not `libraryVocabulary.ts` — see correction P-2.** Same directory,
same `.ts` leaf, same lock-elsewhere/mirror-here contract, its own suite, and `libraryVocabulary.ts`
cites it as *its* precedent (`libraryVocabulary.ts:8` — *"that is the `runVocabulary.ts:44-48` habit"*).

**Header convention** (`runVocabulary.ts:1-38` — copy the SHAPE, not the words):

```ts
/**
 * Phase 188 Plan 06 (RUNVIZ-01 — SPEC Req 5, D-188-02 / …) — the CANVAS's run vocabulary.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: one derivation, two vocabularies. …
 * …
 * Pure data + pure functions. No React, no hooks, no JSX, and exactly TWO imports,
 * both type-only — so this module contributes nothing to the runtime graph and an ESM
 * cycle is impossible by construction.
 */
```

⚠ `doorVocabulary.ts` should go one better and state **ZERO imports** — RESEARCH § H-2 verified it
is a true leaf, which is what makes D-24(b)'s cycle risk one-directional.

**The lock-elsewhere/mirror-here rule** (`libraryVocabulary.ts:5-13`) — this is the sentence
`doorVocabulary.ts` must carry, retargeted at the BUILD-CONTRACT instead of `192-CONTEXT.md`:

```
 * EVERY USER-FACING STRING ON THE LIBRARY SURFACE, IN ONE HOME. The words are LOCKED in
 * `192-CONTEXT.md` and MIRRORED here: a change is a decision taken in that document and
 * reflected here, never the other way round. That is the `runVocabulary.ts:44-48` habit,
 * and it is copied for a mechanical reason rather than a tidy one — D-08 is a WORD-CLASS
 * rule …, and a word-class rule is only enforceable by a fence if the words live somewhere
 * a fence can bind to.
```

**The "a `toContain` on a fragment is a vacuous fence" rule — verbatim** (`libraryVocabulary.ts:15-18`):

```
 * ⚠ EXACT-MATCH ASSERTIONS ONLY when testing this table. *Starters* is a substring of
 * nothing here, but *Still building* and *Strict* share a prefix and *Ready to run* shares
 * its first word with nothing else only by luck — a `toContain` on a fragment is the
 * vacuous fence `runVocabulary.ts:57-59` names.
```

⚠ **This rule BINDS variant D hard, and the collision is real rather than hypothetical.** Column D
gives `doorB.name = "Build it myself"` and `switch.cta = "Build it myself ›"` — one is a strict
prefix of the other. And D-23 makes `strip.labelGovern` a THIRD string built on the same words. A
`toContain` anywhere in `doorVocabulary.test.ts` is vacuous by construction.

**The port-not-transcribe docblock** (`libraryVocabulary.ts:229-253`) — the closest precedent to
D-02, retarget `163` → `164`:

```ts
/**
 * PORTED FROM THE GENERATED BUILD CONTRACT, NOT TRANSCRIBED FROM PROSE.
 *
 * The source is `.planning/sketches/163-the-assembled-card/BUILD-CONTRACT.generated.md`
 * § "Exact strings" — a file emitted by `drive.cjs --emit` FROM THE RUNNING MOCKUP, so the
 * strings below are the ones a human approved on screen rather than a re-typing of a README.
 * …
 * ⚠ THAT IS THE WHOLE ANTI-DRIFT MECHANISM, AND IT ONLY WORKS IF EVERY CONSUMER IMPORTS.
 * D-14: a copy change must be a ONE-LINE DIFF IN ONE FILE. A resolver or a card that spells
 * `"Copy of "` inline has silently forked the acceptance bar, and nothing typechecks prose.
 *
 * ⚠ THE TRAILING AND LEADING SPACES ARE LOAD-BEARING and are ported verbatim: …
```

**Export shape — three shipped forms, pick per id:**

```ts
// 1. flat `export const`, SCREAMING_SNAKE, one docblock each  (libraryVocabulary.ts:78, :158, :281)
export const FORK_VERB = "Make my own copy"
export const SEARCH_LABEL = "Search workflows"
export const LINEAGE_COPY_OF = "Copy of "          // ⚠ TRAILING SPACE IS PART OF THE STRING

// 2. an `as const satisfies Record<…>` table — a new key with no word is a TYPECHECK ERROR
//    (libraryVocabulary.ts:52-59, :203-208; the `deriveTier.ts:57-79` table idiom)
export const CHIP_WORDS = { … } as const satisfies Record<ChipId, ChipWord>
export const LIBRARY_STATES = { … } as const satisfies Record<LibraryStateId, string>

// 3. a plain `Record<K, string>` table for a closed reading set (runVocabulary.ts:80)
export const RUN_READING_WORD: Record<CanvasReading, string> = { "not-started": "Not started", … }

// 4. a FUNCTION when a half is interpolated data (libraryVocabulary.ts:149, :325, :341, :369)
export function forkFailedMessage(name: string, conflict: boolean): string { … }
//    reason, verbatim (:146-148): "Shaped as a FUNCTION … the interpolated half is data, and a
//    template assembled at the call site is a string that leaks out of this module's fences."

// 5. an AGREEMENT FENCE via a literal type annotation, when two ids must not drift
//    (libraryVocabulary.ts:256, :297, :300) — costs nothing at runtime
export const OWN_YOURS: (typeof CHIP_WORDS)["yours"]["label"] = "Yours"
```

⚠ **Form 5 is the one to reach for on D-23.** `strip.labelGovern`'s string IS `doorB.name`'s string
(`Build it myself`, per D-23), and `switch.cta` is `doorB.name + " ›"`. Annotating
`strip.labelGovern` as `typeof DOOR_B_NAME` makes a rename on either side a **typecheck error**
rather than two words that quietly disagree — which is exactly the SEED-147 failure mode D-23 exists
to close. `libraryVocabulary.ts:291-296` states the reasoning verbatim:

```
 * ⚠ THE TYPE ANNOTATION IS THE FENCE, and it costs nothing at runtime: `CHIP_WORDS` is
 * `as const`, so its label type is the literal itself and a rename on either side becomes a
 * TYPECHECK ERROR rather than two words that quietly disagree. The literal is still spelled
 * out because the build contract declares it as its own key …
```

**How a consumer imports it** (`WorkflowCard.tsx` — a named-import list, never a namespace):

```ts
import {
  CHANGED_PREFIX, LINEAGE_COPY_OF, OWN_SHARED, OWN_YOURS, STATE_DRAFT, …
} from "./libraryVocabulary"
```
and cross-directory (`libraryFilter.ts:28`, `RunModal.tsx:60`):
```ts
import { soulDeliverable, tierForDefinition, type DefShape } from "@/components/workflows/soulData"
```
`WorkflowDoorSwitch.tsx` already uses the `@/components/workflows/…` form (`:34-36`), so
`doorVocabulary` is a one-line addition to the existing import block.

⚠ **D-12's three fragments are a SHIPPED shape, not a new one.** `libraryVocabulary.ts` already
ships two concatenation-joint strings (`LINEAGE_COPY_OF` + `LINEAGE_STARTER_SUF`) whose
leading/trailing spaces are load-bearing and are documented as such. `hint.frag1/2/3` are the same
pattern minus the joints — the JSX owns `You describe the goal — the AI `, `, `, `, and `, `.` and
the `<b>` markup (`WorkflowDoorSwitch.tsx:278-283`).

---

### `frontend/src/components/workflows/DoorHeaderStrip.tsx` — NEW (extraction product)

**Primary analog:** `frontend/src/components/workflows/PlaneEditingLayer.tsx` (336 L, the 188.1
verbatim-move product)
**Secondary analogs:** `library/RunModal.tsx` (430 L) and `library/WorkflowDeleteSheet.tsx` (296 L) —
the 192 verbatim-move products.

**The docblock convention that records the move's measured figures** — `PlaneEditingLayer.tsx:1-52`,
the single best template in the repo. Copy all five paragraph *kinds*:

```ts
/**
 * Phase 188.1-03 Task 1 (D-01) — PlaneEditingLayer.
 *
 * THE `＋` / `✕` PLANE LAYER, AND THE MENU IT OPENS. Ten props in, four callbacks out,
 * two React Flow context reads: it owns no state, fetches nothing, and closes over
 * nothing at module scope — which is why it could be lifted out of the canvas shell at
 * all, and the property the next author has to keep true.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `PlaneEditingLayerProps` and `PlaneEditingLayer` were CUT out of `WorkflowCanvas.tsx`
 * (they were declared there at `:526` and `:569` — the tail of Region B, `:526-728` —
 * before the 188.1-03 plan). It is a HARD CUT: `WorkflowCanvas.tsx` declares neither any
 * more and NO re-export shim was left behind; it imports the component from here and
 * renders it at the byte-identical JSX site inside `<ReactFlow>`. The body moved
 * byte-for-byte with its docblock and every inline comment intact — nothing re-typed,
 * nothing tidied, nothing re-ordered — so the phase's first diff reads as a MOVE under
 * `git diff --numstat` rather than as a rewrite a reviewer would have to re-derive.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCK POINT AT THE PRE-MOVE
 * `WorkflowCanvas.tsx` (measured 1593 L at `eff79154`), not at this file. Kept as
 * shipped, for the same reason.
 *
 * THE GEOMETRY LIVES ONE FILE AWAY, AND THAT SPLIT IS MECHANICAL RATHER THAN TIDY (D-01).
 * `EDIT_AFFORDANCE`, … went to `editAffordance.ts` — a `.ts` leaf — because a component
 * module may not export a shared runtime value: `react-refresh/only-export-components`
 * errors for exactly that … SO THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO
 * RUNTIME VALUE OF ANY KIND. Adding one puts the directory's lint count back where it
 * started and silently undoes D-01's only measurable win …
 *
 * These paragraphs are kept honest by machine, not by habit. `WorkflowCanvas.test.tsx` …
 * read this file's SOURCE through the 188.1-01 subtree fence … A second fence in the same
 * suite forbids this module from naming a `WorkflowCanvas` specifier in ANY import form …
 */
```

**The five paragraph kinds to reproduce for `DoorHeaderStrip.tsx`:**

| # | Kind | What 193 writes |
|---|---|---|
| 1 | What it is + why it was liftable | props in / callbacks out; owns no state; closes over nothing at module scope — the `doorGroup` fragment already satisfies this (`WorkflowDoorSwitch.tsx:156-175` reads only `inline` + `goBoth`) |
| 2 | **STATE OF THE EXTRACTION, with the pre-move `file:line`** | *"cut out of `WorkflowDoorSwitch.tsx`, declared at `:145-175` before plan 193-NN"* — re-derive at execution HEAD |
| 3 | ⚠ the `:NNN` refs inside the moved docblock point at the PRE-MOVE file | the `doorGroup` docblock at `:145-155` references the merged row and `ml-auto`; keep as shipped |
| 4 | **the `react-refresh/only-export-components` rule** | ⚠ **BINDING — it is an ACTIVE error in this repo.** `DoorHeaderStrip.tsx` may export ONLY the component and its props type; every string lives in `doorVocabulary.ts`. This is the mechanical reason D-10 is right. |
| 5 | what keeps the paragraphs honest by machine | the D-24(b) cycle fence + the D-24(a) copy fence, named by file |

**The `ml-auto` conditional must move VERBATIM** (`WorkflowDoorSwitch.tsx:145-155` + `:170`) —
D-05's whole risk:

```ts
    /**
     * … `ml-auto` is dropped ONLY when inline: in this shell's own band it is what pushes the
     * judge badge to the far edge, but inside the merged row's already-right-aligned trailing
     * group it would open a gap between the label and the badge. Concatenated so the non-inline
     * string is character-for-character the class list that shipped.
     */
      className={`${inline ? "" : "ml-auto "}inline-flex items-center gap-1 rounded-full border …`}
```
Its mechanical cause is one grep away and belongs in the moved docblock: `BuilderHeaderBar.tsx:53`
already wraps `trail` in `<div className="ml-auto flex shrink-0 items-center gap-2">`.

**Prop-shape precedent for the `inline` variant** — the shipped spread-conditional idiom
(`WorkflowDoorSwitch.tsx:198-202`), which the strip's caller keeps:

```tsx
            // SPREAD-CONDITIONAL, the D-14 idiom this file's sibling `rails` prop uses:
            // without `inline` the two slots must be genuinely ABSENT from the element, not
            // present-and-undefined, so the Builder's flag-off branch is reached by a page
            // that was handed nothing at all.
            {...(inline ? { headerLead, headerTrail: doorGroup } : {})}
```

**The D-04 divider — do not invent one.** The shipped idiom is `CanvasToolbar.tsx:212`:
```tsx
<span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
```

---

### `frontend/src/components/workflows/doorVocabulary.test.ts` — NEW (exact-match vocabulary suite)

**Primary analog:** `frontend/src/components/workflows/runVocabulary.test.ts` (420 L).
⚠ `libraryVocabulary.ts` **has no suite of its own** — do not go looking for one (correction P-2).

**Header — the four numbered rules, verbatim shape** (`runVocabulary.test.ts:1-45`):

```ts
/**
 * Phase 189 Plan 10 — the CANVAS VOCABULARY's own suite.
 *
 * WHY THIS FILE EXISTS AT ALL. `runVocabulary.ts` shipped in 188-06 with no suite of its
 * own: every assertion about it lived in `PhaseNodeCard.test.tsx`, reached THROUGH a
 * rendered card. That is the right place to prove what a person SEES, and the wrong place
 * to prove a property OF THE TABLE …
 *
 * ⚠ IT DOES NOT DUPLICATE THE CARD SUITE. …
 *
 * 1. THE D-16 WORD, BYTE-EXACTLY. The operator locked the wording; the table is where it
 *    lives. The literal is spelled ONCE, here, and the source is compared against it —
 *    never the other way round.
 *
 * 2. D-07 NON-COLLISION, AS INEQUALITIES AGAINST THE SHIPPED VALUES. The seven words are
 *    READ OFF THE TABLE rather than re-typed, so the comparison is against what actually
 *    ships and not against a copy that can rot.
 *
 * 3. ⚠ EXACT MATCH, NEVER A SUBSTRING CHECK. The new word shares its leading token with
 *    the shipped `Not started`, so a containment assertion on that fragment is true of
 *    BOTH and would pass while proving nothing — a vacuous fence …
 *
 * 4. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. … so the NINTH reading inherits all
 *    three guards without anyone remembering to extend a list. A property stated only
 *    about the row being added is a property the next row can break in silence.
 */
```

**The falsification rule — the literal lives in the TEST, never in the source**
(`runVocabulary.test.ts:65-75`):

```ts
/**
 * D-16's locked wording, spelled literally and exactly once in this repository's tests.
 *
 * It MUST be a literal here — that is what makes the first assertion a FALSIFICATION of
 * the table rather than a copy of it. …
 *
 * The separator is an EM DASH (U+2014), not a hyphen and not an en dash, and the
 * codepoint is asserted below rather than trusted to survive an editor.
 */
const D16_WORD = "Not sent — recorded"
```

**The assertion shapes to copy** (`runVocabulary.test.ts:80-107`):

```ts
/** Every reading the table owns, DERIVED from the table itself rather than hand-listed —
 *  so a ninth reading is covered by every loop below the moment it is added. */
const ALL_READINGS = Object.keys(RUN_READING_WORD) as CanvasReading[]

it("is byte-exactly the locked wording, em dash included", () => {
  expect(RUN_READING_WORD[NEW_READING]).toBe(D16_WORD)
  // …and it really is reachable through the TOTAL accessor a caller uses, not merely
  // present in the literal. Without this the table could be right and the lookup wrong.
  expect(runReadingWord(NEW_READING)).toBe(D16_WORD)

  // THE SEPARATOR IS AN EM DASH, asserted by CODEPOINT. A hyphen-minus or an en dash
  // looks nearly identical in a diff and in most editors …
  const separator = D16_WORD.slice(D16_WORD.indexOf("—"), D16_WORD.indexOf("—") + 1)
  expect(separator.codePointAt(0)).toBe(0x2014)
  expect(D16_WORD).not.toContain("--")
})
```

**Apply to 193, concretely.** Column D contains at least five characters that survive an editor
badly and must be asserted by codepoint the way `D16_WORD` is:

| Character | Appears in column D | Codepoint |
|---|---|---|
| `‹` single left angle quote | `strip.back` = `‹ Change how I start` | `0x2039` |
| `›` single right angle quote | `switch.cta` = `Build it myself ›` | `0x203A` |
| `·` middle dot | `doorB.note` = `what it must cite · required checks · per-step sources & model` | `0x00B7` |
| `—` em dash | `doorA.note` = `you can open the full editor at any point — nothing is locked in` | `0x2014` |
| `⚡` | `strip.label` = `⚡ Drafting it for you` | `0x26A1` |

⚠ **And `&` is the JSX-entity trap (RESEARCH § H-1).** The source spells `Author &amp; govern`; a
vocabulary module holds `Build it myself` with no entity at all — but any id that keeps an `&`
(none in column D as it stands) must be asserted as a plain ampersand, and the wave-1 move-proof
must be taken at the **DOM level**, never at source level, for exactly this reason.

**Whole-table property assertions to author (rule 4):** all 21 ids present and non-empty; pairwise
distinct; no id is a **prefix** of another *except* the two the contract deliberately makes so
(`doorB.name` ⊂ `switch.cta`, and D-23's `strip.labelGovern` ≡ `doorB.name`) — pin those two as
**equalities**, so the exceptions are declared rather than tolerated.

---

### `frontend/src/components/workflows/DoorHeaderStrip.test.tsx` — NEW (unit + D-24(b) cycle fence)

**The cycle fence — `WorkflowCanvas.test.tsx:669-767`, the exact shape D-24(b) must copy.**

Imports (`WorkflowCanvas.test.tsx:30-37`):
```ts
// The component SOURCE via Vite's ?raw loader — the idiomatic vitest way to make a
// … constraint checkable.
import workflowCanvasSource from "./WorkflowCanvas?raw"
// … the ESM-cycle fence below is about their IMPORT GRAPH, which no rendered DOM
// can see.
import planeEditingLayerSource from "./PlaneEditingLayer?raw"
import editAffordanceSource from "./editAffordance?raw"
```

The rationale block + the two regexes (`:669-694`) — **the `(\.[jt]sx?)?` group is load-bearing**:
```ts
// ── 188.1-03 — THE ESM-CYCLE FENCE (SC#3, T-188.1-05) ────────────────────────────────
//
// WHY A TEST AND NOT A DOCBLOCK. `WorkflowCanvas.tsx` imports `FlowEdge`'s component
// VALUE at module scope for its `edgeTypes` map, so the canvas subtree already contains a
// live value-level edge. If either module 188.1-03 extracted imported `WorkflowCanvas`
// back, the cycle would typecheck clean and lint clean and fail only at RUNTIME — a TDZ
// `ReferenceError` in whichever module a caller reached first, which under Vitest is
// whichever suite happens to import first. Nothing in the build can see that, so the
// constraint is spelled as an assertion over the two files' own source.
//
// The forbidden shape is stated ONCE and covers every import form deliberately: a static
// import, a re-export, and `import type` all end in `from "<specifier>"`, and a type-only
// import back is forbidden too even though it is erased at build — `verbatimModuleSyntax`
// makes the value/type distinction easy to get wrong under a later edit, and a fence that
// permits the cheap mistake is not worth the line it costs. Dynamic `import()` is its own
// regex because it has no `from`.
//
// ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING AND WAS ADDED AT `/gsd:secure-phase 188.2`. This fence is
// 188.1-03's, and it shipped with the SAME hole its 188.2 sibling did — the quote was anchored
// to close immediately after `WorkflowCanvas`, so `from "./WorkflowCanvas.tsx"` evaded it in
// every form. `frontend/tsconfig.app.json:13-14` sets `"moduleResolution": "bundler"` WITH
// `"allowImportingTsExtensions": true`, so that specifier compiles and resolves and would build
// a real TDZ cycle under a green fence. …
const IMPORT_FROM_CANVAS = /from\s+["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']/
const DYNAMIC_IMPORT_CANVAS = /import\s*\(\s*["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']\s*\)/
```

The four `it()`s (`:696-766`) — **copy all four, they are not interchangeable**:

```ts
describe("WorkflowCanvas 188.1-03 — the extracted modules cannot import back (SC#3)", () => {
  it("the two regexes match the shapes they forbid, and both sources are really loaded", () => {
    // POSITIVE CONTROLS, inline and first: a fence whose matcher is broken passes
    // vacuously and looks exactly like a fence that holds.
    expect('import { WorkflowCanvas } from "./WorkflowCanvas"').toMatch(IMPORT_FROM_CANVAS)
    expect('import type { CanvasNotice } from "@/components/workflows/WorkflowCanvas"').toMatch(IMPORT_FROM_CANVAS)
    expect('export { EDIT_AFFORDANCE } from "./WorkflowCanvas"').toMatch(IMPORT_FROM_CANVAS)
    expect('const m = await import("@/components/workflows/WorkflowCanvas")').toMatch(DYNAMIC_IMPORT_CANVAS)
    // …and the SUFFIXED spelling of each, legal under `allowImportingTsExtensions: true` …
    // One per form: an optional group is only proven by exercising the branch that takes it.
    expect('import { WorkflowCanvas } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('import type { CanvasNotice } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('export { EDIT_AFFORDANCE } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('const m = await import("./WorkflowCanvas.tsx")').toMatch(DYNAMIC_IMPORT_CANVAS)
    // NEGATIVE CONTROLS … `?raw` is this very file's own spelling at line 32, and
    // it must keep missing under BOTH branches of the new optional group.
    for (const legal of [
      'import workflowCanvasSource from "./WorkflowCanvas?raw"',
      'import src from "./WorkflowCanvas.tsx?raw"',
    ]) {
      expect(legal).not.toMatch(IMPORT_FROM_CANVAS)
      expect(legal).not.toMatch(DYNAMIC_IMPORT_CANVAS)
    }
    // …and the subjects are non-empty, so the negatives below are about real files.
    expect(planeEditingLayerSource.length).toBeGreaterThan(0)
    expect(editAffordanceSource.length).toBeGreaterThan(0)
  })

  it("neither extracted module names a WorkflowCanvas specifier in ANY import form", () => {
    for (const source of [planeEditingLayerSource, editAffordanceSource]) {
      expect(source).not.toMatch(IMPORT_FROM_CANVAS)
      expect(source).not.toMatch(DYNAMIC_IMPORT_CANVAS)
    }
  })

  it("editAffordance is a LEAF — no react import, and no component module at all", () => {
    // The house naming rule in this directory is the mechanism: a PascalCase sibling is a
    // component module, a camelCase one is a plain module (10 of 10, measured by 188.1's
    // pattern map). So "imports no component" is checkable without listing every file.
    const COMPONENT_SIBLING = /from\s+["']@\/components\/workflows\/[A-Z]/
    const REACT_IMPORT = /from\s+["']react["']/
    // POSITIVE CONTROLS first.
    expect('import { StepTypePicker } from "@/components/workflows/StepTypePicker"').toMatch(COMPONENT_SIBLING)
    expect('import { useMemo } from "react"').toMatch(REACT_IMPORT)

    expect(editAffordanceSource).not.toMatch(COMPONENT_SIBLING)
    expect(editAffordanceSource).not.toMatch(REACT_IMPORT)
    // Non-vacuity for the leaf claim: it DOES import the one thing it is allowed to, so
    // the two negatives above describe a wired module rather than an empty file.
    expect(editAffordanceSource).toMatch(/from\s+["']@\/components\/workflows\/canvasModel["']/)
  })

  it("the canvas imports the layer rather than declaring it — the cut has one direction", () => {
    // The other half of "no cycle": the edge exists, and it points one way. Without this
    // the three negatives above are also satisfied by two modules nobody uses.
    expect(workflowCanvasSource).toMatch(
      /import \{ PlaneEditingLayer \} from ["']@\/components\/workflows\/PlaneEditingLayer["']/,
    )
    expect(workflowCanvasSource).not.toContain("function PlaneEditingLayer(")
    // …and no re-export shim was left behind, which is what would quietly preserve the
    // coupling this phase exists to remove while every other assertion here stayed green.
    expect(workflowCanvasSource).not.toContain("EDIT_AFFORDANCE")
  })
})
```

**Port map for 193** — substitute mechanically:

| Canvas | Doors |
|---|---|
| `IMPORT_FROM_CANVAS` | `/from\s+["'][^"']*WorkflowDoorSwitch(\.[jt]sx?)?["']/` |
| `DYNAMIC_IMPORT_CANVAS` | `/import\s*\(\s*["'][^"']*WorkflowDoorSwitch(\.[jt]sx?)?["']\s*\)/` |
| `planeEditingLayerSource` | `doorHeaderStripSource` from `./DoorHeaderStrip?raw` |
| `editAffordanceSource` | `doorVocabularySource` from `./doorVocabulary?raw` |
| the LEAF test | `doorVocabulary.ts` imports **NOTHING** — assert `not.toMatch(REACT_IMPORT)`, `not.toMatch(COMPONENT_SIBLING)`. ⚠ **Its non-vacuity control must be DIFFERENT**: a zero-import leaf cannot prove itself with a positive import. Use `expect(doorVocabularySource).toMatch(/export const /)` **plus** `expect(doorVocabularySource.length).toBeGreaterThan(500)` — the 192.1 E-2 lesson (*a fence swept against the empty string passes green*). |
| the one-direction test | `WorkflowDoorSwitch?raw` **matches** `import { DoorHeaderStrip } from "@/components/workflows/DoorHeaderStrip"`, **does not contain** `const doorGroup = (`, and **leaves no re-export shim** |

**D-05's `ml-auto` unit cases** — assert by class *presence on the badge node*, both `inline` values,
and the standalone class list **character-for-character** against the `WorkflowBuilderPage.header.test.tsx:304`
substring so the two guards agree.

**Where the strip's D-04 shape is asserted:** by **child order**, never by class name — the 192.1
rule (see § S-4). `[return control] [divider] [door label] [judge badge]`, with the badge as the
**last** child in both variants.

---

### Wave 0 — the `WorkflowDoorSwitch` characterization baseline

**Analog: `frontend/src/pages/__tests__/RunModal.test.tsx`** — the canonical 192-03 capture.

**The "why a capture, not an expectation" block** (`RunModal.test.tsx:~530-560`, verbatim):

```
// WHY A CAPTURE AND NOT AN EXPECTATION. Phase 192's D-01 moves `RunModal`
// (`WorkflowsPage.tsx:1054-1405`, 352 lines) VERBATIM into
// `frontend/src/components/workflows/library/RunModal.tsx`, and the phase's first
// contract on that move is "the modal renders exactly what it rendered". The cheap
// wrong way to check that is to hand-type the DOM the modal OUGHT to produce — which
// records only what its author believed the markup was, and would ratify a move that
// changed the markup whenever the change happened to match the belief. So this block
// CAPTURES the rendered DOM from the tree AS IT SHIPS.
//
// ⚠ THE BASELINE MUST PREDATE THE CHANGE. A baseline taken after the edit proves the
// edit against itself. This is not a preference: it is Phase 188.1's most expensive
// measured lesson, and 188.2 discharged it by showing every destination module
// answered "No such file or directory" at its capture commit. The same proof, run
// here and recorded rather than asserted:
//
//     $ git rev-parse HEAD
//     14b309b4bd3b04ad5718caa821c24ddb613e2d3f
//     $ git show HEAD:frontend/src/components/workflows/library/RunModal.tsx
//     fatal: path '…/RunModal.tsx' does not exist in 'HEAD'                [exit 128]
//     $ ls frontend/src/components/workflows/library
//     ls: cannot access '…/library': No such file or directory             [exit 2]
//
// THIS PLAN MODIFIES NO SOURCE FILE. `git diff --name-only` over its two commits
// lists only this file and `RunModal.a11y.test.tsx` — a source edit inside the
// capture commit would destroy the very property the capture exists to establish.

/** The capture commit, recorded so the proof above is re-runnable rather than believed. */
const CAPTURE_SHA = "14b309b4bd3b04ad5718caa821c24ddb613e2d3f"
```

**What is and is not claimed byte-identical** (`RunModal.test.tsx:~530-541`) — port this verbatim,
it is what stops a reviewer misreading the diff-stat:

```
 * ── WHAT IS AND IS NOT CLAIMED TO BE BYTE-IDENTICAL ──────────────────────────────────
 *
 * THE RENDERED DOM must be byte-identical. THE MOVED SOURCE need not be byte-identical in
 * its surroundings: `RunModal` is already a top-level function with eight props that closes
 * over no page state, so unlike 188.2's JSX fragments it needs no new wrapper — but it does
 * acquire a module docblock and its own import lines, and a diff-stat showing more
 * insertions than deletions on the destination side is therefore expected and is NOT
 * evidence of drift. A diff against the strings below is.
 */
const RUN_MODAL_HTML_BASELINE: Record<string, string> = {
  BOUND_WITH_FOLDERS: "<div class=\"w-[min(560px,92%)] …\">…</div>",
  UNBOUND_NO_PROJECT: "…", NO_FOLDERS_SCOPE_HIDDEN: "…", TEMPLATE_STAGED: "…",
  LAUNCH_ERROR: "…", SUBMITTING: "…",
}
```

**The driver loop, with its two non-vacuity guards:**

```ts
for (const row of Object.keys(RUN_MODAL_HTML_ROWS)) {
  it(`${row} reproduces the DOM CAPTURED from the unmoved tree, byte for byte`, async () => {
    // NON-VACUITY, first: a `toBe` against an empty string would pass forever if the row
    // ever stopped rendering and the baseline were ever re-captured from that silence.
    expect(RUN_MODAL_HTML_BASELINE[row].length).toBeGreaterThan(0)
    expect(await runModalCapture(RUN_MODAL_HTML_ROWS[row])).toBe(RUN_MODAL_HTML_BASELINE[row])
  })
}
```

**The MARKER ROWS — copy them, they are what makes byte-identity mean something:**

```ts
// ── THE MARKER ROWS ────────────────────────────────────────────────────────────────
// Byte-identity alone is compatible with a row that quietly rendered nothing: an empty
// capture equals an empty render forever. These rows say WHAT each capture contains, so a
// state that stopped painting its blocks is a failure rather than a pass. They read the
// COMMITTED baseline strings, not a fresh render …
it("BOUND_WITH_FOLDERS captured the whole modal body — scope, kickoff, upload, provenance, hint, destination", () => {
  const html = RUN_MODAL_HTML_BASELINE.BOUND_WITH_FOLDERS
  for (const testId of ["run-scope", "run-scope-select", "run-kickoff", "run-template-upload",
                        "run-provenance", "run-hint", "run-destination", "run-confirm"]) { … }
})
```

**"Zero re-capture", measured — the `git diff --numstat` shape** (verified at `cafc9389`):

```bash
git show --numstat 7114a640 -- frontend/src/pages/__tests__/RunModal.test.tsx
# 143    0    frontend/src/pages/__tests__/RunModal.test.tsx
#  ↑insertions ↑DELETIONS — zero. Not one `*_BASELINE` literal was edited.
```
`7114a640` is `refactor(192-06): cut RunModal out of the page`. **A baseline whose diff shows a
deletion did not prove the move; it was edited to agree with it.**

**The sed-span-out-of-base-blob + diff → IDENTICAL proof** (RESEARCH § F.1; use for the STRUCTURAL
move only, never for the 21 strings — see the `&amp;` trap):

```bash
# 1. the destination must not exist at the capture commit
git rev-parse HEAD
git show HEAD:frontend/src/components/workflows/DoorHeaderStrip.tsx
#   fatal: path '…' does not exist in 'HEAD'                          [exit 128]

# 2. after the move: sed the span out of the BASE blob and out of the NEW module,
#    strip the one added `export ` keyword, and diff
git show <base>:frontend/src/components/workflows/WorkflowDoorSwitch.tsx | sed -n '145,175p' > /tmp/before.txt
sed -n '<a>,<b>p' frontend/src/components/workflows/DoorHeaderStrip.tsx | sed 's/^export //' > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt          # must be IDENTICAL

# 3. "zero re-capture"
git diff --numstat -- <the baseline test file>   # e.g. `143 0 …` — insertions only
```

**The ready-made harness — reuse, do not reinvent.**
`.planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src` (121 L) already renders the REAL
`WorkflowDoorSwitch` and the REAL `library/RunModal` under jsdom and dumps `innerHTML`. Its mock set
(`:19-30`) is exactly what the govern door needs, because that door mounts the real
`WorkflowBuilderPage`:

```ts
const { mockGenerateWorkflow, mockListFolders, mockListSkills } = vi.hoisted(() => ({
  mockGenerateWorkflow: vi.fn(), mockListFolders: vi.fn(), mockListSkills: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerateWorkflow, createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(), listFolders: mockListFolders, listSkills: mockListSkills,
}))
```
It captures only `chooser` and `describe`; **adding the two govern states is a ten-line change.**
Note the identical `vi.hoisted` block already ships at `WorkflowDoorSwitch.test.tsx:26-37` — either
home works, and D-08's "no source file in the capture commit" rule is what decides.

**The six states to capture** (RESEARCH § F.2). Rows 5 and 6 are the load-bearing pair — they are
the only two that differ by exactly the D-05 `ml-auto` conditional.

⚠ **Freest and strongest proof, already in the tree:** `WorkflowBuilderPage.header.test.tsx:302-306`
holds `FLAG_OFF_HEADER_MARKUP`, a byte-exact literal of the whole `doorGroup` band captured in Phase
**184.1** — nine phases before this one. **Wave 1 keeping it green with ZERO edits is the proof.**
Consumed at `:311` and `:321`; also `:352` / `:801` `getByRole("button", { name: "‹ both doors" })`
and `:249` `toContain("‹ both doors")`, and `:362` `toHaveTextContent("🔧 Author & govern")`.

---

### `frontend/src/components/workflows/soulData.ts` — MODIFIED (`templateAdmission`, D-25)

**Analog: the function it sits immediately after** — `soulDeliverable` at `:161-171`.

**Docblock convention for a derived predicate** (`soulData.ts:146-159`):

```ts
/**
 * The honest deliverable signal (D-03 / A1). The verified mechanism: a workflow
 * WITH a terminal `llm_emit` phase produces a FILE; ABSENT → the honest
 * "produces: answer in chat".
 * …
 * `kind: "chat"` is the LOCKED honest fallback — never a fabricated deliverable.
 */
export type SoulDeliverable = { kind: "file"; label: string } | { kind: "chat" }

export function soulDeliverable(def: DefShape | null | undefined): SoulDeliverable {
  const phases = def?.phases ?? []
  const hasEmit = phases.some((p) => p.config?.phase_type === "llm_emit")
  if (!hasEmit) return { kind: "chat" }
  …
}
```

⚠ **This is the CAUTIONARY precedent, not the template to copy.** `def?.phases ?? []` collapses
`null` and `{phases: []}` into the same answer — correct for a deliverable label, **a D-20 violation
here** (D-25). `templateAdmission` must distinguish them:

```ts
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"
export function templateAdmission(def: DefShape | null | undefined): TemplateAdmission
```

**Signature style to copy exactly:** `(def: DefShape | null | undefined)` — the same argument type as
both neighbours (`tierForDefinition:111`, `soulDeliverable:161`), and a discriminated union return
in `SoulDeliverable`'s shape.

**The module header's binding claim** (`soulData.ts:13-15`) — `templateAdmission` inherits it:
```
 * Pure + client-side (D-02): this module surfaces EXISTING definition fields only
 * — no migration, no new authoring field, no backend touch. It imports NOTHING
 * from the API client; a tier / glyph / deliverable is DERIVED, never fetched.
```

**A `DefShape` extension may be needed.** `DefShape` (`:68-82`) declares `phases[].config` but **not
`assets`** — it ends with an index signature `[k: string]: unknown`, so `definition.assets` is
reachable but **untyped**. D-21's bound-asset arm reads `definition.assets[kind == "template"]`, so
the planner must either widen `DefShape` (preferred — it is the declared read-shape and
`libraryFilter.ts:19` forbids re-declaring it) or narrow through the index signature at the call
site. **Widening `DefShape` touches every consumer's type surface — check `tsc` stays 33.**

**The "derive, do not re-implement" rule the new predicate must obey** —
`libraryFilter.ts:18-27`, quoted verbatim because it names this exact failure:

```
 * DERIVE, DO NOT RE-IMPLEMENT. Two of the six chips are questions the codebase already
 * answers: *Makes a file* is `soulDeliverable`, *Strict* is `tierForDefinition`. Neither is
 * re-written here, and the *Strict* case is the one that matters — `tierForDefinition`
 * picks the STRICTEST citation policy across every emit phase deterministically
 * (`soulData.ts:100-102`, WR-03), so a hand-rolled equality test against the strict policy
 * on the first emit phase it finds is ORDER-DEPENDENT and already has a regression test
 * against it (`WorkflowsPage.test.tsx:279`). A second implementation of a derivation is a
 * second answer, and two answers to one question is the drift `soulData.ts` exists to forbid.
```

**And how a consumer table reads it** (`libraryFilter.ts:172-176` — measured at `:173`):
```ts
  /** Derived, never re-implemented — see the header's "derive, do not re-implement". */
  "makes-a-file": (row: LibraryRow) => soulDeliverable(row.def).kind === "file",
  /** Same rule, and the one where a hand-rolled check is measurably wrong (WR-03). */
  strict: (row: LibraryRow) => tierForDefinition(row.def).id === TIERS.STRICT.id,
} as const satisfies Record<ChipId, (row: LibraryRow) => boolean>
```

⚠ **D-21's rejection of P1′ is visible right here**: `"makes-a-file"` **is** P1′, byte-for-byte. A
`templateAdmission` that only checked for an emit phase would be a second word for a fact this exact
surface already states.

**The wire-honesty precedent for the `unknown` arm** (`libraryFilter.ts:165-169`):
```
   * frontend deployed ahead of its backend is then RIGHT, not merely non-fatal. Treating
   * `undefined` as `false` renders an empty *Yours* chip on a stale deploy — the failure
   * shape that looks like lost data.
   */
  yours: (row: LibraryRow) => row.isMine ?? row.provenance !== "starter",
```
This is D-20's reasoning already shipped on this surface, and worth citing in `templateAdmission`'s
docblock.

**The wire-absence precedent for the card's silence (D-15)** — `rowIdentity.ts:171-172`:
```ts
  /** `relativeChanged(updatedAt, now)` — `null` when the wire did not say (never fabricated). */
  when: string | null
```

---

### `frontend/src/components/workflows/library/WorkflowCard.tsx` — MODIFIED (the D-13/D-14 mark)

**Analog: its own identity line.** `:543-561` (JSX) + `:498-502` (composition) + `:307` (separator).

**The composition — splice, never interleave `·` by hand** (`:486-502`):

```tsx
  /**
   * Phase 192.1-06 (D-03 / D-06) — the identity line's parts AFTER the owner word, in the one
   * grammar the generated build contract declares:
   *
   *   [own pill] [computed seg] · [computed seg] [1 of N] · changed <rel>
   *
   * ⚠ THE `null`s ARE DROPPED HERE RATHER THAN RENDERED AS BLANKS, and that is what makes the
   * separator rule mechanical instead of a matter of care: the card spends a `·` BETWEEN
   * present parts and nowhere else, so a row with no recency reads `Yours` and never `Yours ·`.
   * A dangling separator promises the reader something that is then not said, which is the same
   * class of defect as an empty state that lies.
   */
  const identityParts: string[] = [
    ...identity.segs,
    ...(identity.ofN === null ? [] : [identity.ofN]),
    ...(identity.when === null ? [] : [identity.when]),
  ]
```

**The render** (`:543-561`) — the mark joins as a plain `string` in `identityParts`; **no new node
type, no new class, no chip** (D-13):

```tsx
          <div
            // Part of the shipped test surface, carried as a LITERAL …
            data-testid="row-identity"
            className={IDENTITY_CLASSES}
          >
            <span className={owned ? IDENTITY_OWN_YOURS : IDENTITY_OWN_SHARED}>{identity.own}</span>
            {identityParts.map((part, index) => (
              // The index belongs in the key: two parts CAN carry the same text …
              <Fragment key={`${index}-${part}`}>
                <span aria-hidden="true">{IDENTITY_SEPARATOR}</span>
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
```

**D-14's slot, pinned.** `own` is rendered separately (the pill); `identityParts` starts after it. So
**index 0 of `identityParts`** = *immediately after provenance*, which is what D-14 means and what
RESEARCH § D.2 recommends:

```ts
  const templateMark = templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []
  const identityParts: string[] = [
    ...templateMark,                       // D-14: after provenance, before everything else
    ...identity.segs,
    ...(identity.ofN === null ? [] : [identity.ofN]),
    ...(identity.when === null ? [] : [identity.when]),
  ]
```

**The card computes some things from `row` and needs NO new prop.** Precedent, one line up at `:477-484`:
```tsx
  /**
   * Whether this row's owner is the person looking at it — read through the SHIPPED predicate
   * rather than re-tested here, because a second copy of it is the drift D-03 forbids by name. …
   */
  const owned = CHIP_PREDICATES.yours(row)
```
⚠ **Do NOT add the mark to `RowIdentity`.** `rowIdentity.ts:163-173` defines it as *"Everything the
card paints on the identity line, already resolved"* — but its four fields are all properties of the
row's **place in the list** (`own`, `segs`, `ofN`, `when`), resolved by an `IdentityIndex` built over
`[rows]`. A definition-derived fact is a category error there and would force `rowIdentity.ts` to
learn about definitions.

⚠ **Where the string lives.** RESEARCH § B.7 is right and it OVERRIDES D-11's directory reading:
`card.templateMark` and `run.templateLabel` render inside the fence-swept `library/` subtree, whose
one-home rule is **`libraryVocabulary.ts`**. They go there, not in `doorVocabulary.ts`.
`libraryVocabulary.ts:248-252` states the rule for exactly this case:

```
 * ⚠ THE FIVE CARD LABELS IN THE SAME CONTRACT TABLE ARE DELIBERATELY NOT HERE.
 * `RUN_LABEL`, `OPEN_LABEL`, … already live module-private in `WorkflowCard.tsx:105-109`,
 * where their re-home debt is recorded. Porting them would create a SECOND home for five
 * strings — the exact failure this module exists to prevent …
```

⚠ **The 188.2 two-badge ceiling does NOT apply to this card** (RESEARCH C-2, and CONTEXT's own
"measured FALSE" section). D-13's plain-text ruling stands on SEED-155 / U8 grounds. **No plan may
write a task or a fence claiming a typecheck enforces it here.**

---

### `frontend/src/components/workflows/library/WorkflowCard.test.tsx` — MODIFIED (pinned 80)

**The `identityParts()` helper** — ⚠ **it is at `:154`, not `:632`.** Both CONTEXT and RESEARCH say
`:632`; measured, `:632` is the *grammar describe block* that USES it. Re-derive:
`grep -n "const identityParts" frontend/src/components/workflows/library/WorkflowCard.test.tsx` → **154**.

```ts
const identityParts = (line: HTMLElement): string[] =>
  Array.from(line.children)
    .map((child) => child.textContent ?? "")
    .filter((text) => text !== IDENTITY_SEPARATOR)
```

**The child-order assertion — the pattern D-14 must copy** (`:598-629`):

```ts
  it.each<[Provenance, LibraryRow]>([["published", PUBLISHED], ["starter", STARTER], ["draft", DRAFT]])(
    "on a %s row the line is child index 1 — after the name row, before the folder chip", (_p, row) => {
    const { card } = renderCard(row, { folderName: "Risk & Compliance" })
    // The length check first, so the RED for an absent line is an AssertionError rather than
    // a `getBy*` throw — an uninformative failure is a failure that teaches nothing.
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column).not.toBeNull()

    expect(column.children).toHaveLength(3)
    // 0 — the name/version row, which really carries the name (so index 0 is not an accident)
    expect(column.children[0].textContent).toContain(row.name)
    // 1 — D-08's position
    expect(column.children[1]).toBe(line)
    // 2 — the folder chip, still BELOW the line
    expect(column.children[2].textContent).toContain("Risk & Compliance")
  })
```

**The grammar-in-order block** (`:632-649`) — the exact shape a new segment must extend:

```ts
describe("D-03 / D-06 — the line's grammar, in order", () => {
  it("a COLLIDING row renders own · segs · 1 of N · changed, in that order", () => {
    const { card } = renderCard(PUBLISHED, { identity: identityOf({ … }) })
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual([
      OWN_SHARED,
      "Copy of Compliance Gap Report starter",
      STATE_DRAFT,
      "43 share this name",
      "changed 2 months ago",
    ])
  })
```

⚠ **Every case in this block reds when the mark lands, and that is correct — it is the right place
to pin the new order** (RESEARCH § D.2). The mark's position is asserted by the **array index in
`toEqual`**, never by a class name.

**The three-arm D-15 requirement** — the 192 CR-01 lesson applies directly (*"both failure tests
pinned the correct branch without ever entering the wrong one"*): author a case that genuinely
reaches **`unknown`** (`{phases: []}`), not only `admits` and `does-not-admit`. `"does-not-admit"`
and `"unknown"` must be **indistinguishable** on the card — assert them with the **same** expected
`toEqual` array, so a divergence is a failure rather than an untested difference.

**`renderCard`'s required-prop convention** (`:159-…`) — the reason to make anything new REQUIRED:
```ts
    // Phase 192.1-06 (D-06): REQUIRED, never optional-with-a-default. The identity line is
    // UNCONDITIONAL, so an optional prop defaulting to "no line" would let a call site render
    // a card the phase says cannot exist — `hasExistingFork`'s trick deliberately does not
    // transfer. This builder is the default every case inherits; `...over` replaces it.
    identity: identityOf(),
```

---

### `frontend/src/components/workflows/library/RunModal.tsx` — MODIFIED (D-17/D-18/D-19/D-20)

**Analog: itself.** The block to wrap is `:306-361`; D-18's label inserts at `:307`.

**The shipped block, with the three things that must not move:**
```tsx
          {/* WFIN-01 (D-LOCK-02): a quiet, self-start template upload. The button STAGES
              the picked File in modal state … Beneath it, the honest provenance note. */}
          <div className="flex flex-col gap-1.5">
            <input ref={fileInputRef} type="file" accept=".docx,…"
              aria-label="Upload template file" tabIndex={-1} className="hidden"
              onChange={onFilePicked} />                                       {/* :307-315 */}
            {templateFile ? ( <div data-testid="run-template-file" …>…</div>   {/* :316-335 */}
            ) : ( <button data-testid="run-template-upload" …>                 {/* :337-352 */}
                    {submitting ? "Uploading…" : "Upload template"}</button> )}
            {launchError && (                                                  {/* :353-357 */}
              <p data-testid="run-upload-error" role="alert" className="px-0.5 text-[11px] text-destructive">
                {launchError}</p> )}
            <p data-testid="run-provenance" className="px-0.5 text-[12px] text-muted-foreground">
              Stored untrusted — never run as code, never fed to the fill engine.  {/* :359 */}
            </p>
          </div>
```

⚠ **`launchError` is NOT template-only, and it lives INSIDE the wrapper D-17 removes.**
`handleRun` at `:184` does `setLaunchError(e instanceof Error ? e.message : "Run failed")` at `:198`
on **any** `onRun` rejection. Hiding the wrapper naively makes launch failures **silent** on every
non-template workflow — the WR-03 class of defect Phase 192's gap round had to repair on this very
surface. **The render condition must cut around `:353-357`.**

**D-18's label must be a TEXT NODE, not a `<label htmlFor>`** — the input at `:307-315` is
`className="hidden" tabIndex={-1}`, so a bound label is an a11y regression and
`RunModal.a11y.test.tsx` (pinned 16) will notice. Use the `run-provenance` `<p>` shape at `:358-360`.

**D-19: `run-provenance` byte-exact.** Confirmed at `cafc9389`, `:359`:
`Stored untrusted — never run as code, never fed to the fill engine.` (em dash U+2014, one space
either side, terminal full stop). It appears **six times** inside `RUN_MODAL_HTML_BASELINE`, so the
baselines are already a byte-fence on it.

**The predicate's input is already in scope** — `:90`:
```ts
  const def = wf.definition as DefShape | undefined
```
and the soulData import is already there at `:60`:
```ts
import { entryInputKeys, type DefShape } from "@/components/workflows/soulData"
```
⇒ **`templateAdmission` is a one-word addition to an existing import.** No new module edge.

**The consumer expressions, stated so the D-15/D-20 asymmetry is legible at both call sites:**
```ts
// WorkflowCard.tsx  (D-15 — silence on anything but a positive yes)
const mark = templateAdmission(row.def) === "admits"

// RunModal.tsx      (D-20 — hide ONLY on a positive no)
const showTemplate = templateAdmission(def) !== "does-not-admit"
```

**The six `RUN_MODAL_HTML_BASELINE` captures WILL red on D-18** — that re-capture is legitimate and
must be recorded as a deliberate one-time re-capture with the reason. ⚠ **The fixtures at
`RunModal.test.tsx:70-96` declare `config: { phase_type: "llm_emit", citation_policy: "draft" }` and
NO `emitter` key** — under D-25's default rule all six **admit**, the control stays and the only
delta is one added label node. Under a predicate requiring an explicit `emitter`, all six vanish
catastrophically. That is why D-25's default is load-bearing.

---

### `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` — MODIFIED (the D-24(a) fence)

**The `?raw` idiom already ships here** — `:19-21`:
```ts
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way — the
// G-5 grep precedent at PhaseSpineGraph.test.tsx:16-19,153-159).
import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"
```
Consumed at `:192`, `:204`, `:402` as `const src = workflowDoorSwitchSource`.

**The plain form, with a positive control** (`:190-201`, `:401-418`):
```ts
  it("GOVERN-DOOR DELEGATION source-grep (G-5): imports + renders WorkflowBuilderPage, no inline governance clone", () => {
    const src = workflowDoorSwitchSource
    expect(src).toMatch(/import .*WorkflowBuilderPage/)
    expect(src).toMatch(/<WorkflowBuilderPage/)
    expect(src).not.toMatch(/citation_policy/)
    expect(src).not.toMatch(/deriveTier|tierForDefinition/)
    expect(src).not.toMatch(/PhaseFormPanel/)
  })

  it("POSITIVE CONTROL — every source needle above matches a planted literal", () => {
    expect('<DescribeKbPicker value={x} onChange={y} />').toMatch(/<DescribeKbPicker/)
    expect('import { DescribeKbPicker } from "./DescribeKbPicker"').toMatch(/import .*DescribeKbPicker/)
    expect('<WorkflowBuilderPage initialProjectFolderId={kb} />').toMatch(/initialProjectFolderId=/)
    expect('import { listFolders } from "@/lib/api"').toMatch(/from ["']@\/lib\/api["']/)
    expect('const f = await listFolders()').toMatch(/listFolders/)
  })
```

⚠ **D-24(a) hits the AST trap head-on, and there is a shipped escape that costs nothing.**
The fence *"no door COPY literal may appear outside `doorVocabulary.ts`"* must name 21 literals — so
a raw-grep fence written the obvious way **reds on itself**. Two shipped answers, and for 193 the
first is strictly better:

**(a) READ THE NEEDLES OFF THE MODULE — the `runVocabulary.test.ts:110-118` idiom.** Import the 21
values from `doorVocabulary.ts` at runtime and sweep `WorkflowDoorSwitch?raw` / `DoorHeaderStrip?raw`
for each. **The fence file then spells ZERO literals**, so the trap cannot fire:
```ts
  /**
   * The shipped words, READ OFF THE TABLE. Not re-typed: an inequality against a
   * hand-copied string proves the copy differs, which is not the claim being made.
   */
  const shipped = { notStarted: RUN_READING_WORD["not-started"], … }
```
⚠ And this fence **must not sweep test files** — `doorVocabulary.test.ts` legitimately spells every
literal (that is its falsification property). The shipped rule is
`librarySubtree.fences.test.ts:186-188`:
```ts
  it("sweeps no test file — the explicit list is what makes this suite able to name what it forbids", () => {
    expect(SWEPT.filter((f) => /\.test\.tsx?$/.test(f.path))).toEqual([])
  })
```

**(b) THE AST-PARSED FORM — `librarySubtree.fences.test.ts` F1** (use if the fence must also exclude
prose in `DoorHeaderStrip.tsx`'s own docblock). Its rationale, verbatim (`:41-48`):
```
 * ⚠ F1 IS PARSED, NOT GREPPED, AND THE REASON IS THIS FILE'S OWN NEIGHBOURS.
 * `libraryVocabulary.ts` EXPLAINS the D-14 rule in its docblock, and a raw source grep for
 * the attribute spelling reds on the prose that documents the very rule it enforces — the
 * 187-24 trap in its inverted form. So the detector walks JSX attributes with the
 * TypeScript parser: comments are not nodes, so they are excluded by construction rather
 * than by stripping, and a `//` inside a string cannot fool it. Known limit, stated rather
 * than discovered later: an attribute smuggled in through a spread or through
 * `setAttribute` is invisible to this fence, as it is to the grep it replaces.
```
The scaffolding (`:193-246`) — parse once, extract user-visible text only:
```ts
const parse = (path: string, source: string) =>
  ts.createSourceFile(path, source, ts.ScriptTarget.Latest, /* setParentNodes */ false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

const userVisibleTextOf = (path: string, source: string): string[] => {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) || ts.isJsxText(node)) found.push(node.text)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(parse(path, source), visit)
  return found
}
```
And the assemble-from-parts token trick, if any literal must still be typed (`:353-366`):
```ts
/** Assemble a searched token so no forbidden word is a contiguous literal in this file. */
const tok = (...parts: string[]): string => parts.join("")
const OVERSTATED_WORDS = [tok("sem", "antic"), tok("mean", "ing"), …]
```

**The four control kinds every fence in this repo carries** (F1/F5, `:252-278`, `:382-428`):
POSITIVE CONTROL (a real plant caught) · SCOPING CONTROL (prose NOT caught) · a second SCOPING
CONTROL (a same-named non-target NOT caught) · ANCHOR CONTROL (a legal stem does not trip it).

⚠ **Verify each fence's SCOPE — *could it fire?*** — the 192.1 E-2 finding, where a fence swept
against the empty string passed green while defending nothing. The mechanical guard is
`librarySubtree.fences.test.ts:164-184`:
```ts
    // Exact equality subsumes BOTH retired assertions and makes the corpus prove itself: every
    // listed path resolved, none resolved to `""`, and the order still matches the list. …
    expect(SWEPT.map((f) => f.path)).toEqual([...LIBRARY_SUBTREE_PATHS])
    expect(subtreeSource.length).toBeGreaterThan(1000)
```

---

### `scripts/vitest-count-gate.cjs` — MODIFIED (BASELINE entries for the new suites)

**Both knobs already cover the new files, and this is the first phase in nine where that is true.**
`TARGETS[0]` is the directory `"src/components/workflows"` (`:1524`), which sweeps
`doorVocabulary.test.ts` and `DoorHeaderStrip.test.tsx` the moment they land — **so they RUN but are
UNPINNED until a `BASELINE` entry exists.** Add both in the **same commit that creates them**.

**BASELINE entry format** (basename → count, flat):
```js
  "soulData.test.ts": 17,                        // :273
  "WorkflowDoorSwitch.test.tsx": 23,             // :278
  "RunModal.test.tsx": 32,                       // :935
  "RunModal.a11y.test.tsx": 16,                  // :936
  "librarySubtree.fences.test.ts": 118,          // :1117
  "WorkflowCard.test.tsx": 80,                   // :1214
  "WorkflowBuilderPage.header.test.tsx": 32,     // :817
```

**The house rule for reading a new number — never hand-count it** (`librarySubtree.fences.test.ts:129-148`
records five consecutive applications):
> *"THE LITERAL IS READ OUT OF THIS ASSERTION'S OWN FAILING DIFF, never predicted."*
> *"…printing `WorkflowCard.test.tsx 39 80 +41` at `total 3408` — never hand-counted from `it(`"*

**The two-knob rule, stated in the file itself** (`:1536-1541`):
```js
  // Added post-round-5 (CR-R5-01 / verification truth 14). TARGETS and BASELINE are TWO
  // knobs: TARGETS decides what RUNS, BASELINE decides what is PINNED, and a page-level
  // suite lands outside BOTH by default …
```

⚠ **`BASELINE_TOTAL`'s marker comment is stale, for the thirteenth time.** `:1520` reads
`// ⚠ 3384 (192.1-06)`; RESEARCH measured the reduce at **3413** and the gate printing
`pinned total 3413`. Not 193's debt — **correct it in passing if a pin is touched anyway**, which
this phase will. The file's own habit at `:1512-1519` is to state the correction rather than
overwrite it.

---

### `.planning/sketches/164-telling-the-doors-apart/build.cjs` — MODIFIED (D-23)

**Where `strip.labelGovern` goes** — `COPY[]` at `:51-78`, immediately after `strip.back` (`:67`)
and before `strip.label` (`:68`). Row shape, verbatim from `:68`:

```js
  { id: "strip.label", where: "describe-door header — the current-door label <span>", shipped: "⚡ Describe & run", B: "⚡ Drafting it for you", C: "⚡ Describing it" },
```

⚠ **`shipped` is what `applyVariant` SUBSTITUTES ON, so it must be the exact rendered text.** For the
govern label that is `🔧 Author &amp; govern` in source (`WorkflowDoorSwitch.tsx:166`) — the emitter
escapes with `esc = (s) => s.replace(/&/g, "&amp;")` (`build.cjs:114`), so the `COPY` row carries the
**plain** form `🔧 Author & govern` and the escaping happens in `applyVariant`.

**The derivation D-02 protects** (`:99-103`) — `strip.labelGovern` must NOT be added to `D_FROM_C`;
it takes its `B` value like every other id:
```js
const D_FROM_C = new Set(["doorA.tier", "doorB.tier"])
for (const c of COPY) {
  const src = D_FROM_C.has(c.id) ? c.C : c.B
  if (src) c.D = src
}
```

**The longest-first substitution guard** (`:110-113`) — ⚠ **this is why D-23 is safe**:
```js
/** Substitute a variant's copy into the real DOM. Longest shipped string first,
 *  so "Author & govern" cannot clobber the inside of "switch to Author & govern
 *  anytime" before that longer string has had its turn. */
```
`🔧 Author & govern` is longer than `Author & govern`, so it sorts first and cannot be clobbered by
`doorB.name`'s substitution.

**The audit re-runs itself** — `applied.push({ id: c.id, ok: false/true })` at `:127`/`:131` feeds the
substitution audit (contract `:80-82`: B 18/0 · C 19/0 · **D 18/0**). After D-23, expect **D 19 / 0**
and 21 table rows; **read the new numbers out of the regenerated contract, never predict them.**

Then: `node build.cjs && node assemble.cjs`.

⚠ **`dom.generated.json` has exactly three keys — `["chooser", "describe", "runModal"]`** — and the
emitter never renders the govern door. **If the audit is to verify `strip.labelGovern` matched a real
DOM, `emit.test.tsx.src` must first be extended to capture the govern state.** Otherwise the row is
declared but unverified, and the plan must say so rather than let `19 / 0` imply a check that did not
happen. (Same ten-line change Wave 0's baseline needs — do them together.)

---

## Shared Patterns

### S-1 · Vocabulary modules on this surface — there are already three
**Sources:** `runVocabulary.ts` (482 L) · `phaseVocabulary.ts` (834 L) · `library/libraryVocabulary.ts` (448 L)
**Apply to:** `doorVocabulary.ts`
Common shape: `.ts` leaf · zero or type-only imports · one docblock per export · "locked elsewhere,
mirrored here" · "EXACT-MATCH ASSERTIONS ONLY" · functions for interpolated halves · literal type
annotations as agreement fences. **`runVocabulary.ts` is the closest analog** (same directory, own
suite); `libraryVocabulary.ts` is the closest for the flat `export const` + generated-contract port.

### S-2 · The verbatim-move + characterization-baseline method (proved four times: 188.1, 188.2, 192-06, 192-08)
**Sources:** `pages/__tests__/RunModal.test.tsx` (the capture) · `PlaneEditingLayer.tsx` (the docblock) · RESEARCH § F.1 (the commands)
**Apply to:** Wave 1 in full
Five obligations: (1) the destination must answer *"does not exist in 'HEAD'"* at the capture commit;
(2) **the capture commit modifies NO source file**; (3) whole-`innerHTML`, captured never typed;
(4) marker rows, so byte-identity cannot ratify a blank render; (5) **zero deletions** in the
baseline file's `git diff --numstat` after the move — measured `143  0` for 192-06 at `7114a640`.

### S-3 · The `?raw` source fence
**Sources:** plain — `WorkflowDoorSwitch.test.tsx:21,192,204,402` · directory-swept —
`WorkflowCanvas.test.tsx:55-83` · explicit-path-list — `librarySubtree.fences.test.ts:82-123` ·
AST-parsed — `librarySubtree.fences.test.ts:193-278`
**Apply to:** D-24(a), and every new negative assertion in this phase
Every fence carries an **inline positive control first**, plus scoping and anchor controls. A fence
whose matcher is broken passes vacuously and looks exactly like a fence that holds. **Name a
destination file in the sweep list BEFORE it exists** — `import.meta.glob` contributes the empty
string for a path with no file and never throws, which is what stops an extraction narrowing a fence.

### S-4 · Assert by CHILD ORDER, never by class name
**Source:** `WorkflowCard.test.tsx:598-629` + `WorkflowCard.tsx:525-542`
**Apply to:** the card mark (D-14) and the strip's D-04 shape
> *"Its own suite asserts that by CHILD ORDER, never by a class name — a class assertion passes on a
> node in the wrong column and fails on a Tailwind tidy-up."*
Length check first, so an absent node reds as an `AssertionError` rather than a `getBy*` throw.

### S-5 · Wire-absence honesty (D-15 / D-20)
**Sources:** `rowIdentity.ts:171-172` (`null` when the wire did not say) · `libraryFilter.ts:159-169`
(`row.isMine ?? …` — treating `undefined` as `false` is *"the failure shape that looks like lost data"*)
**Apply to:** `templateAdmission` and both call sites
The three-state return is what makes the D-15/D-20 asymmetry expressible. `soulDeliverable` is the
cautionary precedent directly above it — **do not model this as a boolean with a `?? true`**.

### S-6 · Derive, do not re-implement
**Source:** `libraryFilter.ts:18-27` (the rule, by name) + `:172-176` (the two shipped uses)
**Apply to:** `templateAdmission`, both consumers
A second implementation of a derivation is a second answer. `"makes-a-file"` at `:173` **is** P1′ —
which is the independent reason D-21 rejected it.

### S-7 · `react-refresh/only-export-components` is an ACTIVE error in this repo
**Source:** `PlaneEditingLayer.tsx:23-31` (states it after 188.1 measured it)
**Apply to:** `DoorHeaderStrip.tsx`
> *"THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND."*
This is the mechanical reason D-10 is right, and the reason every string goes to the `.ts` leaf.

### S-8 · The `<threat_model>` block — house format
**Source:** `.planning/phases/192.1-workflow-identity/192.1-06-PLAN.md`
**Apply to:** every 193 PLAN.md (security enforcement ON — ASVS L1, block on `high`)

```markdown
<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| resolved value → DOM | The identity line is rendered as JSX text nodes; React escapes them. |
| page state → per-card render | The memo key decides both correctness (D-05) and cost. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-192.1-15 | Spoofing (of fact) | `1 of N` under a failed feed | accept | **D-28**, decided rather than defaulted: … UAT row **U7** is the named check, and the acceptance is recorded in code beside the memo. |
| T-192.1-16 | Denial of Service | Per-keystroke re-resolution | mitigate | The memo is keyed on `[rows]` alone (grep-asserted on the literal dependency array). … |
| T-192.1-17 | Information Disclosure | Hover-only tooltip carrying more than the line shows | mitigate | F1 sweeps the card for a `title` JSX attribute; grep-asserted absent. Touch has no hover … |
| T-192.1-18 | Tampering | XSS via a row name rendered into the line | mitigate | Rendered as a JSX text node (React escapes); `dangerouslySetInnerHTML` is fenced by T-192-04 across the subtree. |
| T-192.1-SC | Tampering | npm/pip/cargo installs | mitigate | **Zero packages installed.** No date library, no tooltip library, no virtualiser. |
</threat_model>
```

Conventions to match: threat ids `T-<phase>-NN` · a **supply-chain row `T-<phase>-SC`** on every plan
· dispositions are `mitigate` / `accept` (an `accept` names the decision id **and** the UAT row that
checks it) · every mitigation names its mechanism as **grep-asserted / fenced / typechecked**, never
"we will be careful".

**Threats 193 will actually carry** (candidates for the planner):
`definition` is server-supplied JSON read by a client predicate — **Tampering**, mitigated by rendering
through JSX text nodes and by `templateAdmission` returning a closed union, never interpolating
definition content; **Information Disclosure**, the D-19 provenance line — a reworded security claim
is the threat, mitigated by a byte-exact fence; **Spoofing (of fact)** — D-15's silence must never be
readable as *"no template needed"*, `accept`ed with UAT row **U5** named; **Supply chain** — zero
packages.

### S-9 · Fences bind the AUTH-03 edits — `library/` is swept
`WorkflowCard.tsx` and `RunModal.tsx` are both in `LIBRARY_SUBTREE_PATHS`
(`librarySubtree.fences.test.ts:82-110`, pinned `toHaveLength(12)` at `:149`). So:
**no `title=` attribute** on the new label or mark (F1, AST-parsed) · **no `dangerouslySetInnerHTML`**
(T-192-04 — a RAW regex, so **do not spell the prop in a comment either**) · **no `WorkflowsPage`
specifier** (F4) · **F5's `OVERSTATED_WORDS` sweep** runs over any AUTH-03 string re-homed into
`libraryVocabulary.ts` (`needs a template` and `Template to fill` contain none — re-check after any
reword).
**Nothing sweeps `components/workflows/*.ts`** — `doorVocabulary.ts` and `DoorHeaderStrip.tsx` sit
outside the corpus entirely. **D-10's location is clear, and D-24 exists because they would otherwise
ship undefended.**

---

## No Analog Found

| File / concern | Role | Data flow | Reason |
|---|---|---|---|
| — | — | — | **None.** Every artifact this phase creates has a shipped analog in this repository. The single genuinely new thing is one pure function and one vocabulary leaf, and both have direct neighbours (`soulDeliverable` at `soulData.ts:161`; `runVocabulary.ts`). |

Two things have **no visual analog**, which is a different gap and belongs to UAT rather than to
patterns: the D-04/D-22 restack (no mockup — `164/README.md:149-157`) and both AUTH-03 surfaces
(`build.cjs:23` — *"a PROPOSAL, not a generated dump"*). Those are G-4 rows U3/U3b/U4/U5, not files.

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/` (incl. `library/`) ·
`frontend/src/pages/` (`__tests__/`, `WorkflowBuilderPage.*.test.tsx`) · `scripts/` ·
`.planning/sketches/164-telling-the-doors-apart/` · `.planning/phases/192.1-workflow-identity/`

**Files read at `cafc9389`:** `soulData.ts` · `library/libraryVocabulary.ts` ·
`WorkflowDoorSwitch.tsx` · `WorkflowDoorSwitch.test.tsx` · `PlaneEditingLayer.tsx` ·
`WorkflowCanvas.test.tsx` (three spans) · `library/librarySubtree.fences.test.ts` (three spans) ·
`library/WorkflowCard.tsx` (two spans) · `library/WorkflowCard.test.tsx` (two spans) ·
`library/RunModal.tsx` (two spans) · `library/libraryFilter.ts` (two spans) ·
`library/rowIdentity.ts` (one span) · `pages/__tests__/RunModal.test.tsx` (two spans) ·
`pages/WorkflowBuilderPage.header.test.tsx` (one span) · `runVocabulary.ts` · `runVocabulary.test.ts` ·
`scripts/vitest-count-gate.cjs` (three spans) · `sketches/164/build.cjs` (three spans) ·
`sketches/164/BUILD-CONTRACT.generated.md` · `sketches/164/emit.test.tsx.src` ·
`192.1-06-PLAN.md` (`<threat_model>`)

**Commands run for verification (all re-runnable):**
```bash
git diff --stat 58a402bc cafc9389                                  # docs-only, 0 source files
cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"     # 33
cd frontend && npx eslint <the five touched files>                 # 0 / 0
wc -l frontend/src/components/workflows/soulData.ts                # 171 (RESEARCH said 172)
find frontend/src -name "*ocabulary*"                              # 7 hits, 3 shipped vocab modules
grep -n "const identityParts" …/library/WorkflowCard.test.tsx      # 154 (CONTEXT/RESEARCH said 632)
git show --numstat 7114a640 -- …/RunModal.test.tsx                 # 143  0
grep -n "^| \`" …/164/BUILD-CONTRACT.generated.md                  # rows at :33-52 (RESEARCH said :31)
grep -n "id:" …/164/build.cjs                                      # 21 COPY entries, 1 composite
```

**Pattern extraction date:** 2026-08-13
