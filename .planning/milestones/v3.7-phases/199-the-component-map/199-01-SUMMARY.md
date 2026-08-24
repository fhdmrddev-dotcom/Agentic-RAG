---
phase: 199-the-component-map
plan: 01
subsystem: ui
tags: [canvas, phase-node, design-system, sketch-178, characterization-pin, tailwind, vitest]

requires:
  - phase: 188.2
    provides: the six-file card subtree, the slot contract, and the byte-for-byte pre-move DOM captures this plan declares its one delta against
  - phase: 187
    provides: the invisible four-tier `nodeTitle` ladder and the subtitle-swap reveal, which is what makes sheet c2 §2 already satisfied
provides:
  - a resting-atom characterization pin for `PhaseNodeCard` — every painted string as a literal, at rest and at all nine run readings
  - a falsifiable mechanism-absence sweep over the rendered node face (driven RED against a plant, then restored)
  - the sheet-c2 §3 HOVERED row, built — the one section of the sheet the shipped card could express and did not
  - a six-row CAN-EXPRESS / CANNOT-EXPRESS reconciliation for every section of sheet `c2-phase-node`
affects: [199-02 phase-spine, 199-05 builder-chrome, any future canvas node work, sketch-178 step-3 follow-on]

tech-stack:
  added: []
  patterns:
    - "Declared-delta amendment: when a deliberate change moves a byte-for-byte capture, keep the capture VERBATIM and express the change as one named, singular, machine-checked splice whose arithmetic closes with no residual — never re-capture"
    - "A splice helper THROWS when its anchor is not found exactly once, so it can never silently degrade an assertion into a comparison of the baseline with itself"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
    - frontend/src/components/workflows/PhaseNode.test.tsx

key-decisions:
  - "The hover lift changes the FILL only, never the border — the four-branch border ternary's whole argument is that exactly one border-colour utility is emitted per state"
  - "The hover lift is suppressed in run mode, derived from `status` (a slot the card already holds) rather than from a new slot — `phaseNodeCardContract.ts` is outside this plan's file envelope, which makes 'needs a new slot' a hard CANNOT-EXPRESS fence"
  - "The three 188.2-03 captures are kept byte-verbatim; the delta is declared as a named splice rather than re-captured"
  - "Five of sheet c2's six sections build nothing — four are ALREADY-SHIPPED and one is CANNOT-EXPRESS in full. That is the honest outcome of reconciling a direction-only sheet against a locked visual language, not an under-delivery"

patterns-established:
  - "Resting-atom inventory: assert every painted atom PRESENT as a literal so a later removal is proved by INVERTING the assertion, never by deleting it"
  - "Mechanism-absence sweep: word-boundary patterns over the rendered text INCLUDING sr-only, with non-vacuity asserted before contents and a permanent positive-control block"

requirements-completed: [DES-01]

duration: 47min
completed: 2026-08-19
---

# Phase 199 Plan 01: The Phase Node Summary

**Reconciled the shipped 137-B canvas node against all six sections of sketch 178's sheet `c2-phase-node`, pinned its resting face as literals with a falsifiable mechanism-absence sweep, and built the single row the card could express and did not — a fill-only hover lift, suppressed in run mode from state the card already holds.**

## Performance

- **Duration:** ~47 min
- **Tasks:** 2/2
- **Files modified:** 3 (one source, two suites)
- **Test cases added:** +25 (`PhaseNodeCard.test.tsx` 132 → 154, `PhaseNode.test.tsx` 31 → 34)

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `ecf546ef` | `test(199-01)`: the resting inventory + the mechanism sweep, test-file-only |
| 2 | `2cbd3ed0` | `feat(199-01)`: the hover lift + its four invariant fences + the declared delta |

---

## THE RECONCILIATION — all six sections of sheet `c2-phase-node`

Sheet 178 is **direction, not an acceptance bar** (its own README says so, and `acceptance_bar: false` is in its frontmatter). It renders **zero** shipped components, and it draws its node in the **superseded 137-D language** — a 16rem horizontal row with a left icon well — which `185-01` deliberately replaced with 137-B. Every verdict below is taken against that fact.

| § | Sheet asks for | Verdict | One-line reason |
|---|---|---|---|
| 1 | The six types, each with a distinct glyph | **ALREADY-SHIPPED** (+1 CANNOT-EXPRESS sub-row) | All **7** phase types resolve to a real bundled 3D mark; the sheet's six *type names* are a different taxonomy from the app's |
| 2 | Three name-length cases, ladder invisible | **ALREADY-SHIPPED** | `nodeTitle`'s four-tier ladder is computed and never printed — now proved by the sweep, not asserted |
| 3 | Six interaction states | **1 BUILT · 3 ALREADY-SHIPPED · 2 CANNOT-EXPRESS** | HOVERED built; dragging and locked cannot be expressed |
| 4 | Six run states | **ALREADY-SHIPPED** (+2 CANNOT-EXPRESS atoms) | 6/6 map onto shipped readings — and the card ships **NINE**, so the sheet under-covers |
| 5 | A hexagonal router node | **CANNOT-EXPRESS** | The spine is LINEAR by construction; no router node type exists |
| 6 | Three zoom sizes (100 / 75 / 50 %) | **ALREADY-SHIPPED** (with a recorded caveat) | The canvas already offers `minZoom 0.3 … maxZoom 2`; all three sit inside it |

**No section was silently dropped.** Every row below carries its evidence.

---

### §1 — THE TYPES · ALREADY-SHIPPED

**Measured, not assumed.** `PHASE_GLYPHS` (`soulData.ts:57-65`) and `PHASE_GLYPH_MARKS` (`lib/phaseGlyph.tsx:76-84`) each carry **seven** keys — the six the sheet draws plus `external_action` — and every one resolves to a **build-time bundled** `~icons/fluent-emoji/*` SVG component. The "empty icon" trap the icon convention warns about is structurally closed here: a missing slug **fails the build**, it does not render blank. The two key sets are asserted identical by `soulData.test.ts`, so neither map can drift alone.

Nothing was re-declared. `NodeIconWell` receives an **already-resolved `ReactNode`** and performs no lookup at all.

> ⚠ **A CLAIM IN THIS PLAN'S OWN `key_links` IS FALSE OF THE TREE, and it is recorded rather than quietly satisfied.** The plan asserts a link `NodeIconWell.tsx → soulData.ts PHASE_GLYPHS` matching `phaseGlyph|PHASE_GLYPHS`. **`NodeIconWell.tsx` names neither token** (measured: `grep` → 0). The real chain is `PhaseNode.tsx → nodePresentation.renderPhaseMark → { phaseGlyph, PHASE_GLYPHS }`, and the resolution is deliberately at **module scope** in `nodePresentation.ts` because `phaseGlyph()` returns a *component* and binding one inside a render body is what `react-hooks/static-components` correctly flags. The link the plan wanted exists; it does not run through the file the plan named.

#### CANNOT-EXPRESS · the sheet's six type NAMES and its line-glyph vocabulary

- **What the sheet asks for:** six types called *Retrieve · Extract · Judge · Draft · Branch · Publish*, each drawn with a flat Material-Symbols line glyph (`download`, `content_cut`, `gavel`, `draw`, `call_split`, `publish`).
- **What the component can do:** render the ONE shared 3D `PHASE_GLYPHS` mark for the app's actual seven types — `programmatic · llm_single · llm_agent · llm_batch_agents · llm_human_input · llm_emit · external_action`.
- **The gap:** three of the sheet's six (*Retrieve, Extract, Judge*) are **not phase types at all** — they are things a step *does*, which this app expresses through the config-derived name tier, not through the type. *Branch* is a **topology**, not a type. Adopting the sheet's glyphs would additionally break two standing rules at once: the icon convention forbids hand-drawing or re-declaring a phase mark, and sketches 134/135 were rejected by the operator specifically for drawing **flat text glyphs instead of the shared 3D marks**. Renaming the type set is a data change, which this plan's scope fence forbids outright.

---

### §2 — NAME FALLBACKS · ALREADY-SHIPPED

The sheet's three cases are captioned **only by text length** (`LONG TEXT` / `MEDIUM TEXT` / `STANDARD TEXT`) and the faces are identical in kind — which is precisely the fix sketch 178 made to sketch 177's worst defect, where node subtitles literally read *"Author name" / "Derived name" / "Type description"*.

The shipped card already agrees, and the ladder was **not rebuilt**:

- `nodeTitle` (`phaseVocabulary.ts:231-240`) resolves four tiers — stored name → config-derived face → type sentence → the raw type, honestly echoed — **computed at render, stored nowhere**.
- The card is handed a resolved string and paints it; it owns no tier, no rule and no reveal state.
- The title is `truncate` at 14px in a 248px card, which is exactly the sheet's `text-overflow: ellipsis` on `LONG TEXT`.

**Now proved rather than believed.** The Task-1 sweep asserts that no rendered text — visible *or* `sr-only` — matches any of twenty word-boundary patterns covering the fallback rule, the ladder's rungs, the raw discriminators, the definition's machine keys and the validator identifiers. A separate case asserts the **slug** never reaches the default face.

---

### §3 — THE SIX INTERACTION STATES

| Row | Verdict | Evidence |
|---|---|---|
| At rest | **ALREADY-SHIPPED** | Pinned as exactly two text atoms and one 3D mark |
| **Hovered** | **BUILT** | See below — measured absent before the change |
| Selected | **ALREADY-SHIPPED** | Branch 2 of the border ternary: `border-primary` + a 1px primary ring, plus `data-selected` |
| Dragging | **CANNOT-EXPRESS** | See report |
| Configuration problem | **ALREADY-SHIPPED** (+ CANNOT-EXPRESS sub-row) | The server verdict mark; the sheet's red wash is not available |
| Locked | **CANNOT-EXPRESS** | See report |

#### BUILT · the hover lift

`grep -n "hover:"` across **all five files of the node subtree** returned **zero** before this plan. The card had no hover response of any kind — on the one surface where a person is deciding whether to click a node.

What shipped, in `PhaseNodeCard.tsx` (+33 lines, all in the card div's `cn(...)` and its account):

```
reading === null ? "transition-colors duration-150 hover:bg-card/45" : undefined
```

Four decisions, each of them a shipped invariant rather than a preference:

1. **FILL ONLY — the border is untouched.** The sheet's own hover rule changes `border-color`, and taking it would put a fifth colour utility into a four-branch ternary whose entire documented argument is that exactly **one** border-colour utility is emitted per state *"so nothing depends on which order Tailwind happens to emit two same-specificity colour classes in."* A hover border would make that sentence false for the one state a person is looking at while they decide. Guarded: all four branches still emit exactly one `border-*` colour utility.
2. **SUPPRESSED IN RUN MODE, from state the card already holds.** The run surface renders the canvas with **no selection and no select handler**, so a card that lit up under the cursor there would promise an interaction that does not exist. `reading` is the run-mode boolean the whole component already hangs off — **no slot was added, and `phaseNodeCardContract.ts` is byte-untouched**. Guarded at all nine readings.
3. **NOT MOTION.** Motion on this canvas keys off run state and nothing else; the run channel's carrier is the ring's infinite `canvas-ring-spin`. The card emits no `animate-*`, no transform utility and no `hover:` transform — asserted, with `canvas-ring-spin` as the positive control so the negatives are about the card and not about a token that appears nowhere.
4. **NO FOCUSABLE CONTROL AND NO HANDLER.** One tab stop per node is a canvas-level invariant. The lift is pure CSS; the subtree names no `onMouseEnter` / `onMouseLeave` / `onPointerEnter`.

**Token chain verified before use** (the `bg-warning`-compiled-to-nothing lesson): utility `bg-card` → tailwind key `card` (`tailwind.config.js:23`) → CSS var `--card`, defined in **both** themes (`index.css:21` light, `:108` dark). The same chain is already carried by the shipped `bg-card/30`, so it is proven by the rendering card, not only by the config.

#### CANNOT-EXPRESS · dragging

- **What the sheet asks for:** `transform: rotate(2deg) translateY(-2px)`, a lifted shadow and `opacity: 0.9` while a node is being moved.
- **What the component can do:** nothing — the card is not told a drag is happening. `NodeProps.dragging` reaches the **adapter**, but the card's props carry no such slot.
- **The gap:** two independent blockers. **(a)** Expressing it needs a new slot on `phaseNodeCardContract.ts`, which is **not in this plan's `files_modified` envelope** — adding one would be growing the plan's data axis, which the scope fence forbids. **(b)** Even with the slot, the sheet's 2° rotation is not applicable as drawn: the 3D mark, the status ring and both corner marks are **siblings of the card div**, not children, so rotating the card alone would tear the composition apart, and rotating the node box would fight the graph library's own per-frame position transform. There is also a measured performance hazard — the adapter is memoised precisely because a drag re-rendering this subtree ~60×/s re-rasterised the 3D mark and produced the flicker an operator reported as *"blinking while I drag"*.
- **Not built. Not approximated.**

#### CANNOT-EXPRESS · locked

- **What the sheet asks for:** a `Locked Node` face with a dimmed icon well and the subtitle *"Permission denied"*.
- **What the component can do:** nothing. No permission, ownership or lock state reaches the node. The nearest shipped concepts are deliberately different things: the ⛨ governance seal means *"this step must prove it"*, and `WorkflowDoorSwitch`'s 🔒 means *"this grounding choice is one-way"* — neither is "you may not touch this step".
- **The gap:** this is a **permission model**, not a presentation. Building it would require a backend authority for per-step access, a wire field and a migration — all three explicitly outside a presentation-only plan. The plan's own text anticipated this and it is confirmed: *"not a licence to invent a permission model."*
- **Not built.**

#### CANNOT-EXPRESS · the configuration-problem card wash

- **What the sheet asks for:** `border-color: #ffb4ab` plus a `rgba(255,180,171,0.05)` wash across the whole node, and an error-tinted icon well.
- **What the component can do:** render the **server's** verdict as a 22×22 mark on the card's left edge — `✕ Has a problem` / dashed `○ Not finished yet` / `? Could not be checked` — each an aria-hidden glyph **plus** a real accessible label, never colour alone.
- **The gap:** the strong colours are **banked for run status** (137-B's stated colour budget), and R9 is explicit that `incomplete` must *not* read as alarm — *"not finished yet" is the state a canvas spends most of its life in, and painting it in alarm colours tells a person they have done something wrong every time they pause halfway.* A red wash would also be indistinguishable from the §4 `failed` run state on the same face. The shipped `incomplete` card emits the destructive token **zero** times, and that is asserted, not trusted.
- **Not built.** The interaction row is satisfied by the shipped mark; the sheet's *treatment* is declined with the reason above.

---

### §4 — THE SIX RUN STATES · ALREADY-SHIPPED

Every one of the sheet's six maps onto a shipped reading, with the word imported from `runVocabulary` and never re-spelled:

| Sheet | Shipped reading | Shipped sentence (pinned as a literal) |
|---|---|---|
| WAITING | `not-started` | `Not started` |
| RUNNING | `running` | `Running` |
| SUCCEEDED | `done` | `Complete` |
| FAILED | `failed` | `Failed — this step did not finish` (one of three fixed clauses) |
| SKIPPED | `skipped` | `Skipped — the run took a different path` |
| PAUSED | `waiting-for-you` | `Paused for your answer — it needs your reply before it can continue` |

> ⚠ **THE SHEET UNDER-COVERS THE SHIPPED SET, AND THAT IS A FINDING RATHER THAN A DETAIL.** The card ships **NINE** readings; the sheet draws six. The three it does not draw are `unknown` (*State unknown*), `recorded-not-sent` (189/CONN-01) and `cancelled` (194/RUN-01, *Stopped by you*). **A sheet that draws six teaches that there are six** — and `unknown` is precisely the reading a fail-open hides behind. The count is now asserted (`ALL_READINGS.length === 9`) and the table is `Record<CanvasReading, string>`, so a tenth reading is a typecheck error here rather than a silently-uncovered face.

The run channel is **geometry plus a word** — one distinct ring shape per reading plus a sentence in the body — which is why it spends no badge slot, no step number and no colour on the card body.

#### CANNOT-EXPRESS · the live elapsed timer (`00:15`)

- **What the sheet asks for:** a mono `00:15` in the running node's bottom-right, ticking, with no percentage.
- **What the component can do:** nothing. No elapsed value reaches the card, and it has no way to compute one.
- **The gap:** this is blocked **twice over, and the second block is machine-enforced**. (a) There is no per-node elapsed slot on the contract, and adding one is outside this plan's file envelope. (b) A locally-computed timer is *structurally impossible here*: the shipped fence **N11** forbids `Date.now`, `Math.random`, `document.` and `window.` across the whole card subtree, and the card's own suite asserts *"the card reads no DOM, no clock and no randomness."* A ticking clock is exactly what that fence exists to refuse — it is what makes the byte-for-byte DOM captures reproducible at all.
- **Not built.**

#### CANNOT-EXPRESS · the succeeded node's kept fact (*"Found 12 items"*)

- **What the sheet asks for:** the succeeded node carries a result count as its supporting line.
- **What the component can do:** render the fixed word `Complete`. The subtitle slot at that moment carries the step's **type sentence**, not a result.
- **The gap:** **nothing in this system emits a per-step result count.** Drawing it is a promise we cannot keep — the same class of fabricated precision the sketch's own README flags on sheet 3 (`Processing liability caps section (4/12)`). Producing one would need the harness to emit a structured per-phase result, a wire field and a slot: a data axis, not a presentation.
- **Not built.**

---

### §5 — THE HEXAGONAL ROUTER NODE · CANNOT-EXPRESS

- **What the sheet asks for:** a hexagonal *ROUTER NODE* (`clip-path: polygon(...)`) labelled *Evaluate Risk*, with **two labelled outgoing paths** — *High Risk* and *Standard*.
- **What the component can do:** render one card per phase, on a **linear** spine. `PhaseNodeCard`'s own docblock states the rule for the closest shipped case: *"`llm_batch_agents` gets ONE card: the ×N fan-out is runtime behaviour, not topology, and drawing N lanes would disagree with the server's adjacency."*
- **The gap:** the canvas is **a projection of a LINEAR spine, not a free DAG** — there is no `depends_on`, no parallel lanes and no free rewiring of order, and the harness engine runs it linearly. The only branch that exists is the single dashed `skip_to_phase` **failure** edge, whose one honest rendering already ships (`⤳ on fail → goes to <slug> — no such step` for a broken target). There is **no router phase type**, so there is nothing to give a hexagon to. Building one would mean a new phase type, a new edge model and a backend that can execute it — three data axes at once. The skill reference states the constraint as a prohibition: *"Never imply a DAG."*
- **Not built.** A hexagon drawn today would be the canvas telling a person their workflow can branch when it cannot.

---

### §6 — THE THREE ZOOM SIZES · ALREADY-SHIPPED, with a recorded caveat

The canvas already ships `minZoom={0.3}` / `maxZoom={2}` (`WorkflowCanvas.tsx:1247-1249`), so all three of the sheet's sizes — 100 %, 75 %, 50 % — sit **inside** the shipped range, and the micro size is well clear of the floor. No edit was made: **`CanvasToolbar.tsx` belongs to plan 05** and was not opened.

> ⚠ **THE SHEET'S "STILL-READABLE MICRO" CLAIM IS NOT VERIFIED BY THIS PLAN, and saying so is the honest close.** At the shipped type scale the 50 % card renders its title at an effective **7px** and its supporting line at **5.5px**. The sheet asserts readability at that size; a jsdom suite cannot measure it and this plan did not drive a browser. Recorded as **owed**, not as passed — it needs a driven UAT row on a real canvas, which is a lived-experience check (G-4) rather than a unit assertion. The shipped composition does not *degrade* at zoom in any way this plan could detect: the card scales as a whole, and nothing in the subtree clips.

---

## The deliberate RED — the sweep is falsifiable, not decorative

A mechanism-absence sweep that has never been observed failing is a claim, not a fence. Both halves were driven:

**The transient source plant.** `PhaseNodeCard.tsx:207` was temporarily changed from `{title}` to `{title} Derived name (llm_agent)` — sketch 177's actual defect, plus a raw discriminator. Observed:

```
× paints EXACTLY TWO text atoms at rest, and both are literals
    AssertionError: expected [ …(3) ] to deeply equal [ …(2) ]
× the FULLY DRESSED design-time card pins eight atoms, in document order
    AssertionError: expected [ …(9) ] to deeply equal [ …(8) ]
× the run-mode face adds ONE atom to the resting two, and nothing else
    AssertionError: expected [ …(4) ] to deeply equal [ …(3) ]
× prints none of it at rest, at every run reading, or fully dressed
    AssertionError: expected [ '\bderived name\b', …(1) ] to deeply equal []
```

Four cases red, and the sweep **named the rules that fired** rather than only reporting that one did. The plant was then reverted with `git checkout --`, verified by `git status --short` showing exactly one modified file, and Task 1 was committed with the source byte-unchanged.

**The permanent positive controls**, which survive in the suite so the fence stays falsifiable after this plan: three cases proving the patterns fire on sketch 177's three literal subtitles, on a raw discriminator and on two definition keys — plus a **no-false-positive** case sweeping every shipped word this surface really renders (both vocabularies, the seal label, all three verdict labels, both badge labels). A fence that fires on innocent copy gets loosened rather than obeyed.

**Non-vacuity is asserted before contents on every sweep.** This project has measured three fences that swept the empty string and passed green defending nothing.

---

## The one declared delta against the 188.2-03 captures

The hover term moved three byte-for-byte pins. **That is the pins working**, and they forced the change to be declared rather than slipped in.

Their own header says a diff against them *"IS A BEHAVIOUR CHANGE … AND NOT A TEST TO UPDATE"* and that re-capturing would *"delete the only evidence anybody has that the card still renders what it rendered."* So **not one character of the three literals was edited.** Instead the delta is a named, singular, machine-checked splice:

- `HOVER_TERM_199` is the exact added string; `classWithHoverLift199` inserts it at one position; the arithmetic is asserted to **close with no residual** (`after.replace(TERM + " ", "") === before`).
- The helper **throws** when its anchor is not found exactly once. A splice that silently returned its input would turn all three amended assertions into comparisons of the baseline with itself.
- **The predicate is read off each row's own props** (`status === undefined`), never off a hand-kept list of row names.

> ⚠ **THE ANCHOR WAS CORRECTED BY MEASUREMENT, AND THE HELPER'S OWN REFUSAL IS WHAT CAUGHT IT.** The first attempt anchored on the base box-shadow, assuming `cn` emits its arguments in source order. It threw on the `selected` branch — `cn` runs tailwind-merge, and that branch's own `shadow-[0_0_0_1px_…]` **replaces** the base shadow rather than following it, so its captured class reads `… backdrop-blur-sm border-primary shadow-[…]` with no base-shadow token at all. Re-measured across all four branches, the term lands immediately **before the border-colour utility** every time. The correction is pinned as its own test rather than written down as a claim.

**The run-mode captures went green against the unamended baseline on the first run after the source change** — the only red rows were the three Builder-mode ones. A hover lift that had leaked onto the run surface would have reddened `MAXIMAL_RUNNING` and `MAXIMAL_WAITING`, so their silence is evidence that the suppression works, not an absence of coverage.

---

## Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors** — the pre-existing baseline, unmoved. **0** under `components/workflows/` |
| `PhaseNodeCard.test.tsx` | 132 → **154** (+22: 11 Task 1, 11 Task 2), 0 failing |
| `PhaseNode.test.tsx` | 31 → **34** (+3), 0 failing |
| `WorkflowCanvas.test.tsx` | 53 → **53** (0), 0 failing |
| `node scripts/vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | `count gate OK` — **96/96** pinned files present, no per-file decrease, **0 failing**. total **4715** · pinned total **4543** |
| `git diff --stat -- backend supabase` | **EMPTY** at every task |
| `STATE.md` / `ROADMAP.md` | **not touched** (orchestrator owns those writes) |

**The count-gate arithmetic closes with no residual:** the only files this plan moved are `PhaseNodeCard.test.tsx` (+22) and `PhaseNode.test.tsx` (+3). Every other delta in the gate's output predates this plan's base commit `b5464184`.

**The cap was neither adjusted nor needed.** `GSD_VITEST_MAX_WORKERS=2` held on every run, and nothing red ever appeared that this plan had not deliberately caused. **Recorded as an observation, not as proof of innocence:** none of SEED-171's five named flaky suites is in this plan's blast radius, and none appeared red at any point.

---

## Success criteria

- [x] **SC#1** — all six sections of sheet c2 carry a verdict; none silently dropped
- [x] **SC#2** — no backend, migration, endpoint or wire model modified (`git diff --stat -- backend supabase` empty at every task)
- [x] **SC#3** — the node renders no more at rest than before, proved against the Task-1 inventory (still exactly two text atoms and one 3D mark; the hover term is inert at rest and adds no element)
- [x] **SC#4** — the mechanism is not printed, proved by a sweep driven RED against a plant and restored
- [x] **SC#5** — `tsc` unmoved at 33/0, count gate `failed 0` with no per-file decrease, all three named suites green

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The worktree forked from the wrong base**

- **Found during:** startup, at the mandatory branch check
- **Issue:** `git merge-base HEAD b5464184…` returned `3781a3fe`, not the dispatched base SHA — the known "worktrees fork from the WRONG base" hazard.
- **Fix:** `git reset --hard b5464184454c7492e10ea4c74b6a60f137a7e4ab` per the branch-check protocol, verified by re-reading `HEAD`. One unrelated modified file (`.claude/settings.local.json`) was discarded with it.
- **Commit:** pre-commit (no code change)

**2. [Rule 1 - Bug] The splice anchor was wrong, and the helper caught it**

- **Found during:** Task 2
- **Issue:** the first `withHoverLift199` anchored on the base box-shadow and threw `anchor found 0 times` on the `selected` branch, because `cn`'s tailwind-merge **replaces** that shadow there.
- **Fix:** re-anchored on the border-colour utility after measuring the real rendered class on all four branches with a transient probe suite (created, read, deleted — it appears in no commit). The correction is pinned as its own test.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Commit:** `2cbd3ed0`

### Findings recorded rather than fixed

**3. A `key_links` claim in this plan is false of the tree.** `NodeIconWell.tsx` names neither `phaseGlyph` nor `PHASE_GLYPHS` (measured: 0 occurrences). The real chain runs through `nodePresentation.renderPhaseMark`, at module scope, for a lint reason. Nothing was changed to make the plan's sentence true — that would have been moving code to satisfy a document. Recorded under §1.

**4. Sheet c2 draws six run states against the shipped nine.** Recorded under §4, and now asserted.

**5. The sheet's "still-readable" claim at 50 % zoom is owed a driven UAT row.** Recorded under §6 as owed, not as passed.

## Known Stubs

None. Every row of the reconciliation is either built, already shipped, or reported as CANNOT-EXPRESS with all three parts. Nothing was faked, approximated or left implied.

## Threat Flags

None. The plan's three registered threats are all satisfied and unchanged:

- **T-199-01-01** (tampering) — no `dangerouslySetInnerHTML` was introduced; the shipped grep guard anchored on the JSX prop form still passes. Authored strings remain plain React text children.
- **T-199-01-02** (information disclosure) — the mechanism-absence sweep is the guard, and it now sweeps `sr-only` text as well as visible text, so an identifier hidden in an accessible label is covered too.
- **T-199-01-03** (elevation / scope) — `git diff --stat -- backend supabase` asserted EMPTY at both tasks.

No new network endpoint, auth path, file access pattern or schema change. The one source change is a CSS utility on an existing element.

## Self-Check: PASSED

- **Files claimed created/modified — all FOUND:** `199-01-SUMMARY.md`, `PhaseNodeCard.tsx`, `PhaseNodeCard.test.tsx`, `PhaseNode.test.tsx`
- **Commits claimed — both FOUND in `git log`:** `ecf546ef` (task 1), `2cbd3ed0` (task 2), on `worktree-agent-a4878755ee8c4c8d3`, parented on the dispatched base `b5464184`
- **Scope fence re-asserted across BOTH commits, not only the working tree:** `git diff --stat b5464184..HEAD -- backend supabase .planning/STATE.md .planning/ROADMAP.md` → **empty**
- **Nothing deleted:** `git diff --diff-filter=D` clean on both commits
- **Transient artefacts left nothing behind:** the RED plant in `PhaseNodeCard.tsx` and the `__probe199.test.tsx` measurement suite were both removed before their respective commits and appear in neither
