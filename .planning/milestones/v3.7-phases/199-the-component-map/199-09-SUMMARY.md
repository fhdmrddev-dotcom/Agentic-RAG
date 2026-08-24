---
phase: 199-the-component-map
plan: 09
subsystem: ui
tags: [react, tailwind, vitest, workflow-builder, builder-chrome, design-system, stitch, characterization-testing, a11y]

# Dependency graph
requires:
  - phase: 184.1
    provides: BuilderHeaderBar — the merged row that owns LAYOUT and nothing else
  - phase: 186
    provides: BuilderSaveRegion, useDraftPersistence's PersistState union, the blockedReason seam
  - phase: 197
    provides: identityLabel (D-19) — the header's NAME row, ALREADY-SHIPPED and not rebuilt here
  - plan: 199-04
    provides: the draft-arrival cluster this chrome hosts
  - plan: 199-06
    provides: the ModelField noAnswer arm, wired into WorkflowBuilderPage.tsx (+24/−6) — PRESERVED
  - plan: 199-08
    provides: DESCRIBE_REFUSAL, the 23rd governed door id — imported here, never re-spelled
provides:
  - a header whose fallback identity READS as a fallback, in both fallback arms
  - the Builder's SECOND pre-draft describe box, refusing out loud in the door's own words
  - a hairline between where-you-are and what-this-is on the merged row
  - a class-free resting atom pin of both header surfaces, which is what proves the band-3 re-baseline moved no word
  - the phase's second flagship CANNOT-EXPRESS report (the problems tray's business language) plus two more
  - the measured answer to the question 199-08 deliberately left open
affects: [199-10, WorkflowBuilderPage, BuilderHeaderBar, StepTypePicker, the Builder's pre-draft screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inventory-then-invert, applied across a WAVE boundary: 199-08 planted an absence in wave 2 and wave 3 flipped its polarity in place"
    - "A class-free atom pin committed BEFORE a byte-pin re-baseline, so the re-capture can be PROVED presentation rather than claimed"
    - "A source fence that filters comment lines, so the paragraph explaining the rule cannot red the rule"
    - "Hoist a predicate into a named value rather than re-spelling it, when a second render position needs the same answer"

key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/BuilderHeaderBar.tsx
    - frontend/src/components/workflows/StepTypePicker.tsx
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
    - frontend/src/components/workflows/ProblemsTray.test.tsx
    - frontend/src/components/workflows/StepTypePicker.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx

key-decisions:
  - "The sheet's fourth save arm (`Unsaved changes`) is REFUSED on a MECHANICAL ground, and the cost is pinned rather than described"
  - "FLAG_OFF_HEADER_MARKUP band 3 was re-baselined DELIBERATELY — re-capture three of three, ONE class token, proved against a class-free atom pin"
  - "ProblemsTray.tsx is byte-UNMODIFIED; the sheet's language gap is a backend change and is reported, not faked"
  - "The picker's hand-mixed amber is RECORDED, not converted — swapping in `text-warning` would DARKEN it, and declaring `warning-text` is a shared-artifact edit this wave declines"
  - "BuilderSaveRegion.tsx and ProblemsTray.tsx were NOT edited at all; two of the three source changes are one expression each"
  - "The hot-file ledger and CLAUDE.md were NOT edited mid-wave; re-derived triples are recorded here with exact values"

patterns-established:
  - "A wave-2 plant is a wave-3 obligation: 199-08's `199-09's inheritance, pinned` case was flipped in place, in a file outside this plan's files_modified"
  - "A byte pin answers 'did anything move?'; only a class-free reading answers 'did what a PERSON reads move?' — write the second before re-baselining the first"

requirements-completed: [DES-01]

# Metrics
duration: 78min
completed: 2026-08-19
---

# Phase 199 Plan 09: The Builder Chrome Summary

**The header now tells an authored name apart from a stand-in, the Builder's second describe box finally says out loud what it has silently refused since Phase 124, and the problems tray came back as the phase's second flagship CANNOT-EXPRESS — because the sheet's own tray language is a backend sentence and rewriting it client-side is precisely what D-182-06 removed.**

## Performance

- **Duration:** ~78 min
- **Tasks:** 3/3
- **Files modified:** 8 (3 source, 5 test)
- **Source deletions across the whole plan:** **4** — the identity expression's one line, the identity span's one line, the textarea's one class line, and the picker's one class line. Every one replaced by its conditional/concatenated form.
- **Test-assertion deletions:** **0.** Every red was an INVERSION (polarity flipped, query unchanged) or one stated narrowing, listed below.

## ⚠ Worktree base correction FIRED — SEVEN for seven in this phase

The dispatched base was **not** an ancestor of the worktree's HEAD:

```
git merge-base HEAD 4b8efd7d…   →   3781a3fe4690a9619e619f4cc412bd37a7dafc52   ← ≠ 4b8efd7d
```

`git reset --hard 4b8efd7d` applied and verified (`git rev-parse HEAD` → `4b8efd7d…`). This is the identical `3781a3fe` the prompt named and that `199-03` and `199-08` each recorded. **It is the DEFAULT behaviour of this dispatch path, not an intermittent fault, and the assertion is the only thing that catches it** — this plan depends on four earlier ones and an uncorrected base would have built against a tree containing none of them. All measurements below are against `4b8efd7d`.

Verified before Task 1: `199-04`, `199-06` and `199-08` SUMMARYs all present.

## The reconciliation table — sheet `c10-builder-chrome` vs the shipped chrome

Every element of the sheet carries a verdict. **None is silently dropped (SC#1).**

### §1 The header bar — the sheet's five cases

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| H1 | the headline is the workflow's NAME, never a slug | `identityLabel` — name → slug → `"Untitled workflow"` | ✅ **ALREADY-SHIPPED** — Phase 197 plan `197-10` (D-19). **Not rebuilt.** Its docblock records the exact defect the sheet designs out: *"before this, the header rendered the slug and `meta.name` appeared in no render position anywhere on this page."* |
| H2 | the name is an **editable `<input>`** in the header | a read-only span; the name's one write path is the arrival card's row 4 | ⛔ **REFUSED** — a second editor two inches from the first is a second home for one write, the collision **D-21 already ruled on for this screen's own label**. It would also move a byte pin for a capability nobody asked for. |
| H3 | EMPTY NAME degrades to a **DIMMED** fallback, never to blank | degraded to a fallback and never to blank — but painted the stand-in **exactly as it paints an authored name** | ✅ **BUILT** — see below. The sheet's second half was already true; its first half was not. |
| H4 | a LONG name truncates without pushing the controls off the row | `min-w-0 truncate` on the identity, `shrink-0` on the trailing group, `flex-wrap` on the bar | ✅ **ALREADY-SHIPPED, verified structurally.** ⚠ jsdom runs no layout — measured through a STATED SURROGATE, with the real check named as an owed G-4 row below. |
| H5 | a **PUBLISHED & LOCKED** header mode (lock glyph, `Published` badge, `Edit Draft`) | the badge is the literal `draft`; the Builder has no published header state at all | ⛔ **CANNOT-EXPRESS** — see CE-4. |
| H6 | Material Symbols glyphs (`arrow_back`, `lock`, `check_circle`, `cloud_off`, `sync`) | the shipped icon convention has none | ⛔ **REFUSED** — `199-03` and `199-08` refused the identical substitution on the two preceding sheets. Swept across all seven chrome sources, with a positive control. |
| H7 | a `shaping-indicator` animated underline pulsing under the name | nothing | ⛔ **REFUSED** — it asserts an activity in flight on a bar that renders while nothing is running. Same class as `199-03`'s determinate-progress refusal and `199-08`'s S2. Swept. |
| H8 | a hairline between the back control and the identity, drawn three times | one undifferentiated `gap-2` run | ✅ **BUILT, spent ONCE** — see below. |

### §2 The save region — the sheet's four arms

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| S1 | **Saved** | two readings — `Saved · still a draft` (184's locked wording) and the quiet `Saved · just now` | ✅ **ALREADY-SHIPPED.** |
| S2 | **Saving** | `Saving…` on the button AND on the quiet line | ✅ **ALREADY-SHIPPED.** |
| S3 | **Failed**, unmistakable, never confusable with saved | `builder-save-error`, `role="alert"`, the write loop's own sentence | ✅ **VERIFIED — and this is must_have #2.** Proved distinct from the saved arm **with every `class` attribute physically stripped off a clone**, with non-vacuity asserted first and a positive control proving the comparator can still detect sameness. All four reachable arms pairwise distinct. |
| S4 | the sheet's literal *"Save failed — Check connection"* | the sentence is the loop's, verbatim (D-186-03 / D-186-08) | ⛔ **REFUSED** — it would re-word a refusal this component did not make, and would say *"check connection"* about a 409 that has nothing to do with the network. Swept, with a positive control. |
| S5 | **Unsaved changes** | **NOTHING. There is no such reading, on either surface.** | ⛔ **REFUSED — see CE-2. The ground is MECHANICAL, not aesthetic.** |

### §3 The publish gate — the sheet's four states

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| P1 | **Ready** | the shipped `◆ Publish…` trigger | ✅ **ALREADY-SHIPPED.** |
| P2 | **Refused, with the refusal STATED** rather than a dead control | ✅ it is **rendered**: `publish-blocked-reason` is a real element wired to the trigger by `aria-describedby` | ✅ **ALREADY-SHIPPED — this was the plan's open question for §3 and the answer is "rendered", not "only disabled".** Proved LIVE and end-to-end: a real server verdict reaches the header as the server's own sentence, and the trigger is disabled AND points at it. |
| P3 | the sheet's reason *"Needs 2 grounded phases"* | `blockedReason`'s five honest branches — the server's verbatim message, or one of two locally-authored NON-verdicts | ⛔ **REFUSED** — a lint code wearing a sentence, naming a threshold nothing in this product computes. Swept. |
| P4 | **Publishing…** on the trigger | the modal owns in-flight and reports it back through `onRunningChange` | ⛔ **REFUSED** — `PublishGauntlet.tsx` is outside this plan's `files_modified`, and the in-flight reading already has exactly one home. |
| P5 | a **Published** state on the trigger | publish freezes an immutable v1 and edits FORK a v2 draft; the Builder is always a draft surface | ⛔ **CANNOT-EXPRESS** — see CE-4, same root as H5. |

### §4 The problems tray

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| T1 | one undifferentiated count — *"3 Issues preventing publish"* | the **two-count** summary, *"1 problem · 2 things to finish"*, rendered in the CLOSED state | ✅ **ALREADY-SHIPPED and stronger.** Verified: the closed summary carries both words and **the sheet's undifferentiated "issue" appears in neither**. |
| T2 | rows phrased as **error codes wearing a sentence** | the server's `message`, verbatim (D-182-06) | ⛔ **CANNOT-EXPRESS — the phase's second flagship report. See CE-1.** |
| T3 | *"Tray collapses entirely when cleared"* | the summary line survives, carrying `checked by the server` and the honest all-clear paragraph | ⛔ **REFUSED** — collapsing removes the ATTRIBUTION, and a surface that vanishes when clean cannot say who checked or when. Sketch 139's *"registry blip rendered as a green light"* failure, one step removed. |
| T4 | row titles prefixed `Phase 2:` / `Phase 5:` | `nodeTitle(phase, nameContext)` — the plain-language name the CARD shows | ✅ **ALREADY-SHIPPED and stronger.** |
| T5 | the raw identifier beside the sentence | the `code` appears ONLY behind the ⌥ Technical-names reveal | ✅ **VERIFIED, driven through the REAL provider and the REAL accessor** — absent by default, present after the toggle, and **the plain sentence does not go away** (the reveal ADDS a technical name; it never swaps the business one out). |
| T6 | a finding that belongs to no step | its own `phase: null` section | ✅ **VERIFIED standing ALONE** — driven with an empty per-phase set, so the section is proved to render on its own rather than as a tail. |

### §5 The step picker

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| K1 | the six verbs (*Find documents · Pull out specific details · …*) | every row title resolves through `nodeTitle` over the phase the click will build | ⛔ **REFUSED** — a DRAWING of the vocabulary, not a source for it. Transcribing them re-creates the exact WR-03 defect (*"Check with you"* in the menu, *"Wait for your approval"* on the card, one click apart) which survived every lexical fence because the drift was SEMANTIC. Swept, plus a stronger guard: **each row's whole class-free reading is reconstructed from the two modules that own its halves and compared** — any transcription breaks that without a fence needing to name the words. |
| K2 | a **search field** over the rows | nothing | ⛔ **REFUSED** — a filter decides which rows EXIST; that is behaviour, not presentation. Swept. |
| K3 | a 2-column grid | a 300 px single-column `role="menu"` with a roving tabindex | ⛔ **REFUSED** — `nextRovingIndex` is a vertical-`menu` key map and `ArrowLeft`/`ArrowRight` deliberately do nothing (APG reserves them for submenus). A grid makes the shipped keyboard contract wrong, which is behaviour. |
| K4 | a tinted tile carrying the type's mark | the shared 3D `renderPhaseMark` over the shared `ICON_TINT` | ✅ **ALREADY-SHIPPED** (sketch 137's locked rule). Re-verified because this plan edits the row. |
| K5 | title with WEIGHT, supporting line with AIR (`line-clamp-2`) | title and supporting line differed by SIZE alone (12.5 px vs 10.5 px, same weight, no gap) | ✅ **BUILT (weight + air)** · ⛔ **`line-clamp-2` REFUSED** — the supporting line carries the REFUSAL REASON on a declined row, and clipping a refusal to two lines is the failure R10b exists to prevent. |
| K6 | the refused row's amber | a hand-mixed `text-[hsl(38_92%_66%)]` literal with no token | ⛔ **RECORDED, NOT CONVERTED — see CE-3.** |

## THE BUILT ROWS

### B1 — the Builder's second describe box refuses out loud (the wave-2 → wave-3 obligation, discharged)

**The question `199-08` deliberately left open, and the executor brief made binding: does the Builder's pre-draft CTA carry an equivalent trimmed-length predicate?** **It does, and it was measured before a line was written**, two ways:

| | expression | home |
|---|---|---|
| the door | `describe.trim().length > 0 && templateRead.kind !== "loading"` | `WorkflowDoorSwitch.tsx:218` |
| **the Builder** | `describe.trim().length > 0 && builderPhase !== "composing" && templateRead.kind !== "loading"` | **`useTemplateFirstDraft.ts:463`**, spent by the page as `disabled={!canDraft}` |

**The same first term.** So saying it out loud here is **PRESENTATION and in scope**; had the predicate not existed, inventing one would have been behaviour and this row would have been a report instead. The measurement is pinned as a case, not asserted in prose, and the fence is stated as *"the page declares no `canDraft` of its own"* rather than *"the page contains no `describe.trim()`"* — because Task 2 legitimately adds a trimmed READ, and a fence that cannot tell a read from a rule has to be deleted the moment one lands.

Four properties, each mechanical, each copied in kind from `199-08`'s door:

1. **The sentence is IMPORTED.** `DESCRIBE_REFUSAL` joins the page's existing `doorVocabulary` import list. `WorkflowBuilderPage.tsx` is **already a swept source of the D-24(a) copy fence**, so a re-spelling would turn that fence red — and it is *additionally* asserted here, so the claim does not rely on another suite noticing.
2. **It never greets anyone.** The trigger carries `describe.length > 0` as well as the trim, so an untouched empty box — refused by the same rule — stays silent. Without that term the refusal would appear on the first screen an author meets **and would move `WorkflowDoorSwitch.baseline.test.tsx`'s `GOVERN_INLINE`, which pins this exact screen byte for byte.** That pin passed unedited.
3. **The resting class list is character-for-character the shipped one** — a concatenation, three slots moving, token count unchanged. `aria-invalid` is a spread-conditional, so it is **ABSENT at rest, not `"false"`**.
4. **It changes no enablement**, driven across all three inputs and back: empty → disabled, whitespace-only → disabled + refusal, real text → enabled + silent, whitespace again → disabled. The "and back" arm is what stops the case passing on a control that simply never re-disables.

⚠ **It covers only the FIRST term, deliberately** — the same fence the door drew. The second (`templateRead.kind`) already speaks through `DescribeTemplateRow`'s in-flight line and the third (`builderPhase`) through the CTA's own `Composing…` label.

### B2 — a fallback now READS as a fallback

`identityLabel` resolves `name → slug → "Untitled workflow"` and painted all three arms identically. So a header reading `vendor-brief` in the same weight and colour as an authored name **asserted that the workflow was called `vendor-brief`, about a workflow nobody had named.** That is sheet §1 case 4's finding, applied where it is true.

- **The predicate is HOISTED, not duplicated.** `authoredName` is D-19's own non-empty check with its result carried instead of re-spelled; `identityLabel` is byte-for-byte the same three-arm chain. Two spellings of one predicate is how a label and its styling come to disagree.
- **D-19's binding constraint is preserved and now GUARDED:** the check is a display fallback, not a validation rule. A case counts `authoredName`'s **non-comment** uses and pins them at **three** — the declaration, the label chain, the tone — so nothing else can start reading it.
- **BOTH arms in one case.** A dimmed-everything header would satisfy the fallback assertion alone and would say strictly less than what shipped.
- **The tone is the SECOND carrier, never the first** (WCAG 1.4.1): a class-free reading proves a person with no colour at all still receives the whole distinction, because a fallback is a slug or the literal words `Untitled workflow` — neither of which is a name anybody typed.

### B3 — the hairline between WHERE-YOU-ARE and WHAT-THIS-IS

The merged row packed two different kinds of thing into one undifferentiated `gap-2` run: the breadcrumb + door escape + door name (`lead`), and the workflow's name + draft badge + bindings (`identity`). The sheet draws a rule between them three times; this spends it **once**, at the one seam that carries a meaning change.

- **It is the SHIPPED divider**, not a new one — the same `mx-0.5 h-4 w-px bg-border` span `DoorHeaderStrip` already draws and that band 2 of the byte pin contains. One divider language, not two.
- **Gated on BOTH slots being filled**, and that guard is load-bearing: the pre-draft mount passes `lead` and `trail` only, and its resting DOM is `GOVERN_INLINE`. Asserted on the component's own terms — absent with lead-only, present with lead+identity — so the claim is a property of the guard, not a fact about one capture that happens to still pass.
- **It stays a child of the EXISTING group**, so `bar.children` is still **2** — `canvas.test.tsx`'s 184-13 pin, re-measured here.
- **It spends no words**: `aria-hidden`, zero text nodes, and the class-free atom pin of the merged row passed **unedited** across it.

### B4 — the picker's rows are SET, not re-worded

Title takes `font-medium`; the supporting line takes `mt-0.5`. Two tokens. At 12.5 px against 10.5 px with the same weight and no gap, a title and its supporting line read as one paragraph.

**The sentences did not move, and that is proved rather than promised:** each row's whole class-free reading is reconstructed from `nodeTitle(minimalPhaseFor(...))` and `PHASE_TYPE_SUBTITLES` and compared for equality — so any transcription into this component (the sheet's six verbs above all) breaks it without a fence having to name the specific words.

## CANNOT-EXPRESS reports (three parts each, as required)

### CE-1 · ⚠ THE FLAGSHIP — the problems tray's business language

- **What the sheet asks for:** findings phrased in a colleague's language. Sketch 178's own README names the failure it drew instead: *"Phase 5: Output schema invalid / JSON schema definition contains syntax errors"*, *"Retrieve step requires at least one connected datastore"* — **error codes wearing a sentence.** *"The business-language rule holds on labels and titles, and fails on error text."*
- **What the component can do:** **nothing — BY DECISION.** `ProblemsTray.tsx` renders the server's own `message` verbatim (D-182-06): *"There is no code table here and no friendly-message map."* Phase 185 ships new findings as **new identifiers in the module that owns them**, and this tray renders them with no edit at all. A client-side rewrite map is exactly what that decision removed, and re-introducing one puts a **SECOND home under every finding identifier** — silently stale for every identifier this client has not been taught, which is every identifier a future phase adds.
- **The gap:** the sentences are authored **server-side**, in the module that owns the finding identifiers. Fixing them is a **BACKEND change** and is outside this phase's presentation-only fence. `ProblemsTray.tsx` is therefore **byte-UNMODIFIED by this plan**, and that is the finding rather than an omission.

**⚠ THE REPORT IS A MEASUREMENT, NOT A CLAIM.** Every property it rests on is pinned:

- the tray carries **none** of the sheet's four row sentences (swept, positive control);
- it carries **no** friendly-message map — `FRIENDLY` / `MESSAGE_FOR` / `CODE_TO_MESSAGE` / `messageFor` / `rewrite`, over **non-comment lines only** so the paragraph explaining the rule cannot red the rule;
- **⚠ AND THAT FENCE WAS DRIVEN RED AGAINST A REAL PLANT.** A `const FRIENDLY_MESSAGE: Record<string, string>` was added to `ProblemsTray.tsx`, the case failed naming it — `AssertionError: expected 'FRIENDLY:2' to be 'FRIENDLY:0'` — and the plant was removed. `git diff --stat` on that file is **empty** and `grep -c FRIENDLY_MESSAGE` → **0**. Without that drive it is a sweep that has never fired.

**ROUTING RECOMMENDATION.** The fix belongs in a **backend plan on the validation findings module** — the same module Phase 185 established as the one home for finding identifiers — re-wording each finding's `message` at its source, where the identifier and the sentence live together and cannot drift. It is NOT a gap-closure round on this phase (it is a new capability in a different tier, which G-7 forbids in a closure round) and it is NOT `/gsd:fast` (it touches every finding this product can emit).

**RE-OPEN TRIGGER, so the deferral has a home rather than being forgotten:** *the next phase whose `files_modified` names the backend validation-findings module, OR the next operator report of engineer language on the Builder's problems tray.* Whoever takes it inherits a ready-made acceptance bar: this tray needs **no change at all** — flipping the sweeps above from ABSENT to a set of business sentences at the source is the whole of the work, and the tray will render them with no edit, which is D-182-06 working exactly as designed.

### CE-2 · The sheet's fourth save arm — and the refusal is MECHANICAL, not aesthetic

- **What the sheet asks for:** a fourth save reading, *"● Unsaved changes"*, beside `Saved` / `Saving` / `Failed`.
- **What the component can do:** it already HAS the fact. `dirty` is a shipped prop of `BuilderSaveRegion` and is already read (`receiptVisible` is `saved && !dirty`). There is a clean `{ kind: "idle" }` member in the union. Saying it would have been presentation by this plan's own standard — no new rule, no new state, one existing prop read back. **This was the closest call in the plan and it is recorded as one.**
- **The gap, and it is mechanical:** the ONE element that could carry it is `builder-autosave-status`, and **`WorkflowBuilderPage.canvas.test.tsx:1741` asserts that element ABSENT after an edit made on the flag-off surface** — *"the line is FLAG-GATED — with the canvas off the header is the one that shipped"*, the mechanical form of D-181-01's promise. Adding the reading there reds a shipped guard on a shipped decision, in a file this plan does not own; adding a SECOND element instead violates `BuilderSaveRegion.test.tsx`'s own *"there is one quiet-line element, not a second one added for the flag-off case — two homes for one reading is how two readings drift apart."* And on the flag-ON surface the reading resolves itself inside the autosave debounce, which is noise against D-186-03's *"autosave is meant to be unremarkable."*

⚠ **THE COST IS PINNED, NOT DESCRIBED** (`199-08`'s CE-3 pattern). A case asserts `Unsaved` / `unsaved changes` absent from `BuilderSaveRegion.tsx`, with a positive control, **so a later plan that closes this gap FLIPS an assertion instead of rediscovering it.** The honest statement of today's surface: **on the flag-off Builder — the surface most authors are actually on — an edit leaves the header saying nothing at all about unsaved work.**

### CE-3 · The picker's refusal amber is a hand-mixed literal with no token

- **What the sheet asks for:** the refused row's reason in `error/80`.
- **What the component can do:** it already spends an amber — `text-[hsl(38_92%_66%)]`. `--warning` is `38 92% 60%`: **the same hue and saturation, lightened six points for text contrast.** That is precisely the `accent-violet` (graphic-level ≥3:1) / `accent-violet-text` (text-safe ≥4.5:1) pair `tailwind.config.js` already ships and documents — **with the second member never declared.**
- **The gap:** converting to `text-warning` would **DARKEN** a 10.5 px line that already sits under `opacity-[0.42]` — a contrast regression dressed as design-system hygiene. Declaring a `warning-text` token is a two-file edit on `tailwind.config.js` **and** `index.css`, both shared artifacts, with a sibling agent active in this wave (the `197-10` / `199-03` precedent for declining mid-wave). ⚠ And the sheet's own `error` token **compiles to nothing** here, so its literal answer is not available either.

**PINNED so it is not rediscovered:** a case counts the literal (exactly **one** occurrence, in a code line) and asserts `text-warning` absent from code lines. A later plan that declares the token flips it. **A second occurrence lives in `WorkflowCanvas.tsx:1119`** (outside this plan's files) whose sibling background is `hsl(38 92% 60%/0.08)` — i.e. `--warning` exactly — which is what makes the "hand-lightened text shade" reading a measurement rather than a guess.

**RE-OPEN TRIGGER:** *the next phase that touches `frontend/tailwind.config.js` or `frontend/src/index.css` for a colour token.* Declaring `warning-text` there discharges both occurrences in one commit, and `gutterTokens.fences.test.ts` is the ready-made place for its resolution fence.

### CE-4 · The Builder has no PUBLISHED header mode (sheet §1 case 3 and §3 case 4)

- **What the sheet asks for:** a header that flips to `🔒 Published` with an `Edit Draft` control, and a trigger that becomes a `✓ Published` badge.
- **What the component can do:** the badge is the literal string `draft`, and it is honest — publish freezes an **immutable v1** and edits **FORK a v2 draft** (migration 056's `UNIQUE(slug,version)` + on-publish trigger). The Builder is a draft surface by construction; a published definition is not editable in it at all.
- **The gap:** the sheet's state 3 is not a presentation of something we have — it is a **different lifecycle**, in which a published workflow is opened in the Builder and locked. Building it needs a published-definition load path and a fork affordance in the header: **new capability**, outside the fence. The nearest shipped analogue is the Workflows page's Tweak door, which forks first and then opens the Builder on the fork — so the state the sheet draws is one the author never sees here.

## Measurements

| Gate | Baseline (prompt) | Measured | Verdict |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 | **33** | **unmoved.** ZERO under `WorkflowBuilderPage`, `BuilderHeaderBar`, `StepTypePicker` or `ProblemsTray`. ⚠ The 3 that ARE under `pages/` are all pre-existing `SettingsPage.tsx` / `SettingsPage.test.tsx` errors present at the base — named rather than rounded to "zero". |
| count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`) | OK · 96/96 · failed 0 · total 4888 · pinned 4543 | **OK · 96/96 · failed 0 · total 4932 · pinned 4543** | **+44, and it closes with NO residual** |
| `git diff --stat -- backend supabase` | empty | **empty at every task** | scope fence holds |
| eslint (8 changed files) | — | **clean except two PRE-EXISTING errors**, both proved pre-existing at the base and neither in code this plan wrote | see out-of-scope observations |

**The +44 closes exactly, and the arithmetic is the point — an unexplained `+n` is the thing to worry about, never a bigger number:**

| suite | base ACTUAL | now | Δ | what |
|---|---|---|---|---|
| `WorkflowBuilderPage.header.test.tsx` | 36 | **68** | **+32** | the whole c10 reconciliation, both atom pins, the identity arms, the driven publish refusal, the CTA measurement, the refusal drive, the seam |
| `ProblemsTray.test.tsx` | 30 | **35** | **+5** | the closed two-count reading, the lone `phase: null` section, the ⌥ reveal, the RED-driven no-map fence, the engineer-sentence sweep |
| `StepTypePicker.test.tsx` | 68 | **72** | **+4** | the resolver claim, the hierarchy pin, the reconstructed readings, the amber record |
| `BuilderSaveRegion.test.tsx` | 11 | **14** | **+3** | the class-stripped distinctness, its positive control, the four-arm sweep |
| `WorkflowDoorSwitch.test.tsx` | 67 | **67** | **0** | the inversion was in place — polarity flipped, no case added |

⚠ **THE GATE'S `+36` COLUMN FOR THE HEADER SUITE IS PIN→ACTUAL, NOT BASE→ACTUAL** (its pin is `32`, its base actual was `36`). Reading that column as this plan's delta gives `+48` and an unexplained `−4`. **The pins are floors, and mistaking one for a previous reading is how a clean total looks like drift.**

**Count-gate pins were left SLACK rather than raised**, following `199-03` and `199-08` in the same phase: `scripts/vitest-count-gate.cjs` is a G-5-firing shared guard file and a sibling agent (`199-10`) is active in this wave. Pins are floors, so nothing is hidden. **Exact values for a later single re-pin:** `WorkflowBuilderPage.header.test.tsx: 68` · `ProblemsTray.test.tsx: 35` · `StepTypePicker.test.tsx: 72` · `BuilderSaveRegion.test.tsx: 14` · `WorkflowDoorSwitch.test.tsx: 67`.

## ⚠ `FLAG_OFF_HEADER_MARKUP` — RE-CAPTURE THREE, TAKEN DELIBERATELY, STATED, SCOPED AND PROVED

The pin's own docblock predicted no third re-capture and said one would be *"a behaviour change to explain in its own plan, not a test to update."* **This is that plan and this is that explanation.** The `TWO OF TWO` note is **not overwritten** — a correction is recorded beside it, and its prediction keeps its force for the next author.

⚠ **It is also NOT the trigger that note predicted.** The fixture still binds no `name`; nobody gave it one. What moved is the TONE the fallback arm is painted in.

- **ONE CHANGED LINE AND ONE CHANGED TOKEN:** `text-foreground` → `text-muted-foreground` inside band 3's identity span. The source side is spelled as a **concatenation** precisely so the authored arm stays character-identical and this diff could not be anything larger.

  | band | tag deltas | attribute deltas | non-empty text nodes |
  |---|---|---|---|
  | 1 (breadcrumb) | NONE | NONE | 3 → 3, identical |
  | 2 (door band) | NONE | NONE | 4 → 4, identical |
  | 3 (save cluster) | NONE | **ONE class token** | 4 → 4, identical |

- ⚠ **THE PROOF THAT NO WORD MOVED IS NOT THAT TABLE — IT IS A SEPARATE, CLASS-FREE PIN COMMITTED ONE COMMIT EARLIER.** `sheet c10 §1 — the header's RESTING atoms` captures both surfaces as text-node literals with every class discarded, landed in Task 1's commit, and **passed UNEDITED** after Task 2. A byte pin cannot tell a colour change from a content change; that atom list can. **This is the structural answer to "never re-baseline a pin to make red go green": write the instrument that can tell the two apart, before you move the pin.**
- **The green is not vacuous.** The identity slot is driven live in five cases across three arms, both tones, and both surfaces.

## The wave-2 plant, INVERTED in place (and a file outside `files_modified`)

`199-08` authored `it("the Builder's box is UNGATED BY ANY SENTENCE today — 199-09's inheritance, pinned")` in `WorkflowDoorSwitch.test.tsx` **specifically so wave 3 would flip it.** It went red the moment B1 landed, in a file this plan's `files_modified` does not name.

**Flipped, never deleted**, with wave 2's original words preserved verbatim inside the new case, and strengthened: it now also asserts the sentence arrives **by import** and that the literal appears nowhere in the page. Recorded as deviation 1 below.

## Hot-file ledger — re-derived, and NOT edited (stated, not silent)

| File | ledger says | **re-derived at HEAD** | note |
|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | `47 / 14 / 2656` · FIRES · honoured by construction ×3 | **`49 / 17 / 2762`** | ⚠ stale by **2 commits / 3 phases / 106 L** — and it was re-derived on **2026-08-17**, two days ago. Its buckets now include `196`, `197` and `199`. G-5 still FIRES; **honoured by construction** here: two expressions, one import, one gated `<p>`, one hoisted predicate — no second concern. |
| `frontend/src/components/workflows/StepTypePicker.tsx` | ⚠ **NO ROW AT ALL** | **`7 / 3 / 522`** | ⚠ **FIRES — EXACTLY AT THRESHOLD, and it is ABSENT from the scan list**: the `libraryRow.ts` state, where a missing row costs most. Buckets `184 / 187 / 199` (plus two dated quick tasks, `260807` / `260808`, correctly excluded). **No seam proposed** — its two concerns (the roving-focus keyboard machine and the row rendering) are genuinely one component's — but the audit could not *ask*, which is the cost. |
| `frontend/src/components/workflows/BuilderHeaderBar.tsx` | ⚠ **NO ROW AT ALL** | **`2 / 2 / 81`** | below threshold; **listed here on purpose**, because `WorkflowsPage.tsx` escaped G-5 for ten phases purely by not being written down. It owns LAYOUT and nothing else, and this plan's edit keeps that true. |
| `frontend/src/components/workflows/ProblemsTray.tsx` | ⚠ **NO ROW AT ALL** | **byte-unmodified by this plan** | not re-derived, because measuring a file this plan did not change would publish a figure nobody verified against a diff. Named so its absence from the scan list is on the record. |

**The ledger and `CLAUDE.md` were NOT edited.** Both are shared artifacts and a sibling agent is active in this wave; `197-10`, `199-03` and `199-08` are the precedents for declining mid-wave. The same-commit sync rule makes a row a two-file edit on the two hottest shared documents in the repo. **Owed, with exact values above so the edit is transcription rather than re-derivation.**

## Owed G-4 rows (jsdom cannot answer these, and a surrogate is not the answer)

Stated as owed rather than quietly satisfied by a structural pin:

1. **Sheet §1 case 5 — the long-name row at ~900 px.** jsdom reports every box as 0×0, so a "the controls did not get pushed off" assertion reads `0 − 0` and passes on any markup. The shipped contract (`min-w-0 truncate` / `shrink-0` / `flex-wrap`) is pinned as a **stated surrogate**; the real check is a browser at the width the operator's original 184.1 complaint came from.
2. **B2's tone, seen.** `text-muted-foreground` at 14 px semibold against the header background must stay legible in **both** themes. The class-free pin proves the distinction survives with no colour at all, which is the accessibility floor — it does not prove the muted arm looks right.
3. **B3's hairline, seen.** Whether one rule at the lead↔identity seam reads as structure or as clutter on a wrapped two-row header is a judgement no jsdom assertion can make.

## Deviations from Plan

### 1. [Rule 3 — blocking] `WorkflowDoorSwitch.test.tsx` was edited, though `files_modified` did not name it

- **Found during:** Task 2, from a neighbour-suite run.
- **Issue:** `199-08` planted `expect(builderPageSource).not.toContain("DESCRIBE_REFUSAL")` **in that file**, explicitly labelled *"199-09's inheritance, pinned"*. B1 makes it false by design. Leaving it red is not an option and deleting it destroys the evidence that the absence was ever pinned.
- **Fix:** polarity flipped in place, wave 2's original wording quoted inside the new case, and two assertions added (import-not-literal, and the literal absent). `+19 / −4` on a 1300-line suite; no other case touched.
- **Commit:** `e8fd2038`.

### 2. [Rule 1 — bug in this plan's OWN new fence] a source sweep that would have had to be deleted

- **Found during:** Task 2.
- **Issue:** Task 1 pinned *"the page authors no gate of its own"* as `carries(builderSource, "describe.trim()") === false`. B1 adds a legitimate trimmed READ, so that fence goes red against a change it should not object to — a fence that cannot tell a read from a rule.
- **Fix:** narrowed to the absence of a `const canDraft` DECLARATION, with the positive control moved to match. The claim is unchanged and the fence can now survive the thing it was meant to allow. Stated in the case's own comment rather than silently swapped.
- **Commit:** `e8fd2038`.

### 3. [Rule 1 — bug caught by this plan's own new fence] two sweeps went red against their own explanations

- **Found during:** Tasks 2 and 3.
- **Issue:** the `authoredName` use-counter and the `text-warning` absence sweep both fired on the **docblock paragraphs explaining why the rule exists** — `199-08`'s recorded lesson that *"a fence that forbids explaining itself is a fence that gets deleted"*, hit twice in one plan.
- **Fix:** both filter comment lines (`/^\s*(\*|\/\/)/`) before matching, and both carry a positive control proving the filter drops prose **and** keeps code.
- **Commits:** `e8fd2038`, `54c18dcf`.

### 4. [Rule 1 — a false green my own test would have shipped] `identitySlot` measured the wrong element with the flag ON

- **Found during:** Task 1, from a real failure (`expected 'Edit · Vendor brief v1' to be 'Enterprise Q3 …'`).
- **Issue:** the shipped `identitySlot` helper takes the first `<span>` of the `<header>` band. With the flag ON the merged bar **is** a `<header>`, and its first span belongs to the breadcrumb LEAD. Reused there it silently measures the wrong node — the exact class of false green this suite's docblock warns about.
- **Fix:** the identity contract is measured flag-OFF where the helper is correct; the bar's own wrap/shrink contract is measured flag-ON as a separate case. The trap is recorded in the case's comment so the next author does not re-enter it.
- **Commit:** `6200a6c7`.

### 5. [Rule 1 — a racy pin my own test would have shipped] two first-load races

- **Found during:** Task 1.
- **Issue (a):** the flag-ON atom pin captured `"Not checked yet."` — a **transient**: before the first validation answers, `blockedReason` is the fail-closed never-ran sentence and the publish refusal is live in the merged row. **Issue (b):** the driven §3 case used `findByTestId`, which resolved **instantly against that same wrong reading** and would have measured the fail-closed default while claiming to measure a server verdict.
- **Fix:** (a) the pin waits for `publish-blocked-reason` to go absent before capturing, with the reason stated; (b) the driven case waits on the **sentence**, never on the element. Both comments say why, because both are traps a later author would otherwise re-enter.
- **Commit:** `6200a6c7`.

### Deliberate declines

**6. The hot-file ledger and `CLAUDE.md` were not edited mid-wave.** Shared artifacts, sibling agent active; exact re-derived values recorded above.

**7. The count-gate pins were left slack rather than raised.** Same file, same reason; pins are floors, exact values published above.

**8. `ProblemsTray.tsx` and `BuilderSaveRegion.tsx` were not modified at all** — both came back verified-and-reported rather than rebuilt, which is the correct outcome for both under this phase's fence.

## Out-of-scope observations (logged, not fixed)

- **Two PRE-EXISTING eslint errors**, both proved pre-existing against the base: `WorkflowBuilderPage.tsx:287` (`react-refresh/only-export-components` on the shipped `useCanvasGate` export — whose own docblock records that the rule stays in this file on purpose) and `StepTypePicker.test.tsx:1219` (`jsx-a11y/no-static-element-interactions` on a shipped `.react-flow__pane` stand-in). Neither is in code this plan wrote; fixing the first would move a source guard `canvas.test.tsx` greps for.
- **`.vite-cache/` is untracked and NOT gitignored** — `scripts/bootstrap-worktree.sh` creates it in every worktree. Already logged by `199-03` and `199-08`; still true, still not fixed for the same reason (a one-line edit to the shared `.gitignore` races the sibling agent). Never staged; files were staged individually throughout.
- **A pre-existing `stash@{0}` exists on the shared stash stack.** Untouched — **no `git stash` subcommand was run at any point** (`refs/stash` is shared across worktrees, #3542).
- **`WorkflowCanvas.tsx:1119` carries the second occurrence of the hand-mixed amber** (CE-3). Outside this plan's files; recorded so the token work discharges both together.

## Preserved, not reverted

**`199-06`'s edit to `WorkflowBuilderPage.tsx` (`+24 / −6`, commit `6264097e`) is intact.** It wires `ModelField`'s `noAnswer` arm to its caller so the capability is reachable in the product. This plan's own edits to that file are at lines ~230 (an import), ~1902 (one expression), ~1930 (the textarea + the refusal node) and ~2490 (the identity expression + span) — none of them near the model-picker call site, and the file's model-picker suites pass unmodified.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced. The two new rendered nodes are a decorative hairline and a `<p>` whose sentence arrives by import, both gated on real, driven predicates.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was touched. The plan's three registered threats are all **held or strengthened**:

| Threat | Status |
|---|---|
| `T-199-09-01` tampering — `ProblemsTray.tsx` renders server strings as plain text children, no rewrite map, no `dangerouslySetInnerHTML` | ✅ **held, and now GUARDED.** The file is byte-unmodified; the no-map assertion was **driven RED against a real plant** and restored. |
| `T-199-09-02` spoofing — the failure arm asserted distinct from the saved arm with classes stripped | ✅ **held, in the strongest available form.** All four reachable arms are pairwise distinct with every `class` attribute physically removed from a clone, the removal itself asserted, non-vacuity first and a sameness-detecting positive control. |
| `T-199-09-03` elevation — the publish refusal renders from the shipped `blockedReason`; no new predicate, no gate loosened | ✅ **held.** No refusal predicate was authored anywhere; the reason is proved LIVE to be the server's own sentence, and the trigger stays disabled and `aria-describedby`-wired to it. |

## Success criteria

- **SC#1** every element of sheet c10 carries a verdict, none silently dropped — ✅ **28 rows** across five sections: 8 ALREADY-SHIPPED/VERIFIED, 4 BUILT, 12 REFUSED, 4 CANNOT-EXPRESS.
- **SC#2** no backend, migration, endpoint or wire model modified — ✅ `git diff --stat -- backend supabase` **empty at every task**.
- **SC#3** the chrome renders no more at rest than before, proved against a pre-change inventory — ✅ both header surfaces' class-free atom lists are **byte-identical** across the whole plan; the two new nodes are one `aria-hidden` hairline with zero text nodes and one `<p>` unreachable at rest.
- **SC#4** the mechanism is not printed to the user — ✅ the refusal names what is missing and what to do; no predicate, threshold, code or token reaches a headline, and the sheet's engineer-language rows are refused and reported rather than transcribed.
- **SC#5** gates hold — ✅ tsc **33** (unmoved, zero in this plan's files), count gate **OK / 96/96 / failed 0 / no per-file decrease**, eslint clean but for two proved-pre-existing errors.

## Self-Check: PASSED

Files claimed, verified on disk:

- `FOUND: frontend/src/pages/WorkflowBuilderPage.tsx`
- `FOUND: frontend/src/components/workflows/BuilderHeaderBar.tsx`
- `FOUND: frontend/src/components/workflows/StepTypePicker.tsx`
- `FOUND: frontend/src/pages/WorkflowBuilderPage.header.test.tsx`
- `FOUND: frontend/src/components/workflows/BuilderSaveRegion.test.tsx`
- `FOUND: frontend/src/components/workflows/ProblemsTray.test.tsx`
- `FOUND: frontend/src/components/workflows/StepTypePicker.test.tsx`
- `FOUND: frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx`
- `FOUND: .planning/phases/199-the-component-map/199-09-SUMMARY.md`

Commits claimed, verified in `git log`:

- `FOUND: 6200a6c7` — test(199-09): pin the builder chrome's resting inventory and the sheet c10 reconciliation
- `FOUND: e8fd2038` — feat(199-09): the builder chrome re-presented — a fallback reads as one, and the second describe box refuses out loud
- `FOUND: 54c18dcf` — test(199-09): re-set the step picker's rows, and REPORT the problems-tray language gap

No modification to `STATE.md` or `ROADMAP.md` (owned by the orchestrator).
