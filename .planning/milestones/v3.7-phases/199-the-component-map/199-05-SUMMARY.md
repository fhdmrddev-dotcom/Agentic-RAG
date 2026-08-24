---
phase: 199-the-component-map
plan: 05
subsystem: ui
tags: [canvas, connections, flow-edge, background, sketch-178, icon-convention, cannot-express, characterization-pin]

requires:
  - phase: 199-01
    provides: the re-presented phase node this plane renders, and its six-row CAN-EXPRESS / CANNOT-EXPRESS method
  - phase: 185
    provides: the `edgeTypes.flow` entry and `FlowEdge`'s transcribed `@xyflow/react` v12 bezier baseline
  - phase: 188.1
    provides: `PlaneEditingLayer` + `editAffordance`, the ＋/✕ layer this plan audits but does not modify
provides:
  - a resting-plane characterization pin — the ground, the five connectors by id, the three floating controls, and both empty planes, every atom a literal
  - a colour-blind connection signature that DELETES every stroke colour and requires the states to stay mutually distinct
  - the branch connector's word, so the only non-"then" connector on the plane is legible without colour
  - the plane's ground committed rather than inherited from a library default
  - a rendered-DOM audit of every canvas mark against `icon-convention.md` §4, which found THREE shipped marks §4 has no row for
  - a 21-row verdict table over every element of sheet `c1-canvas-plane`, and the phase's flagship CANNOT-EXPRESS report
affects: [199-02 phase-spine, 199-10 journey-arc, any future canvas connection work, icon-convention §4, sketch-178 step-3 follow-on]

tech-stack:
  added: []
  patterns:
    - "Colour-blind signature: for an EDGE the card's class-strip proves nothing (colour rides `style` beside `stroke-width` and `stroke-dasharray`), so DELETE the colour channels and require the remaining signature to stay distinct"
    - "Commit a library default by NAMING the values it already produces — zero pixels change, and an upgrade that moves the default can no longer move the surface without a diff"
    - "Audit a glyph vocabulary over the RENDERED DOM in EVERY mode, not over source: a comment can spell a mark the surface never draws, and mutually-exclusive arms hide each other's marks"
    - "A gap in a shared convention is pinned PRESENT in the consumer's suite, so closing it inverts an assertion instead of deleting one"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
    - frontend/src/components/workflows/FlowEdge.test.tsx
    - frontend/src/components/workflows/CanvasToolbar.test.tsx

key-decisions:
  - "The branch connector carries the WORD and not the `⤳` glyph: an SVG edge label is one text node with no room for the aria-hidden split both sibling homes use, so shipping the mark would put an unlabelled glyph into an accessible name"
  - "The ground commits its GEOMETRY and deliberately not its colour — an explicit `color` emits an inline fill and takes the dots off the theme's variables"
  - "`icon-convention.md` is NOT edited despite this plan finding three gaps in it: it is outside the file envelope and is a shared artifact being read by a sibling plan in the same wave (the 197-10 precedent). The gaps are pinned in the consumer suite instead"
  - "Four of sheet c1's five connection states are CANNOT-EXPRESS, and the fifth is already shipped. The one thing built is the row the sheet did not ask for and the acceptance bar did — the branch's own word"

patterns-established:
  - "Both-modes sweeps: a fence over a surface with mutually-exclusive arms must walk every arm and assert an arm-exclusive atom from each, or it silently covers half the surface"

requirements-completed: [DES-01]

duration: 78min
completed: 2026-08-19
---

# Phase 199 Plan 05: The Canvas Plane Summary

**Reconciled the shipped canvas plane against all five sections of sketch 178's re-run sheet `c1-canvas-plane`, pinned its resting atoms and a colour-blind connection signature, delivered the phase's flagship CANNOT-EXPRESS report on the payload-bearing connection label, and built the two rows the plane could honestly express: the branch connector's word, and a ground that is committed rather than inherited.**

## Performance

- **Duration:** ~78 min
- **Tasks:** 3/3
- **Files modified:** 4 (one source, three suites)
- **Test cases added:** **+31** — `WorkflowCanvas.test.tsx` 53 → 77, `FlowEdge.test.tsx` 22 → 25, `CanvasToolbar.test.tsx` 14 → 18

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `ee8ae1e9` | `test(199-05)`: the resting plane inventory + the colour-blind connection signatures, test-files-only |
| 2 | `d1525d46` | `feat(199-05)`: the branch connector's word |
| 3 | `92cf14da` | `feat(199-05)`: the committed ground + the §4 mark audit |
| 3 (fix) | `79612fd8` | `fix(199-05)`: the §4 audit was mode-blind — both arms now walked |

---

## ⚠ THE BASE ASSERTION FIRED — a fourth confirmed instance in this phase

The prompt records three: `199-01`, `199-03` and `199-04` all landed on a tree that predated their dispatched base. **This worktree did too.**

```
git merge-base HEAD a64802968ba53c9f95031d38eeca13150f5a959e
  → 3781a3fe4690a9619e619f4cc412bd37a7dafc52     (NOT the dispatched base)
git rev-parse HEAD
  → fda792141b0129de7b15dd40ddc1082e76f95a2a
```

Corrected with `git reset --hard a6480296…` per protocol and verified by re-reading HEAD, then Wave 1's presence was confirmed before any work began (`git log --grep="199-01"` → four commits, including `2cbd3ed0`, the re-presented node face). **Four for four is no longer an intermittent hazard; it is the default behaviour of this dispatch path**, and the assertion is the only thing standing between it and a plan built against the wrong tree.

---

## THE RECONCILIATION — every element of sheet `c1-canvas-plane`, 21 rows

Sheet 178 is **direction, not an acceptance bar** — `acceptance_bar: false` sits in its own frontmatter, it renders **zero** shipped components, and its Tailwind config declares a Material-3 palette of which **15 of 18 tokens compile to nothing** against `frontend/tailwind.config.js`. Every verdict below is taken against those facts. **No element is silently dropped.**

| § | Sheet asks for | Verdict | One-line reason |
|---|---|---|---|
| 1 | A committed quiet dot-grid ground | **BUILT** | The dots already shipped; the *commitment* did not |
| 1 | Business-language step names | **ALREADY-SHIPPED** | D-183-06's plain-language title; `nodeTitle`'s ladder is computed and never printed |
| 1 | **Payload-bearing connection labels** | ⚠ **CANNOT-EXPRESS** | **The flagship — nothing emits a per-edge count. Full report below** |
| 1 | Alignment guides during a drag | **CANNOT-EXPRESS** | See report |
| 1 | The `Fork Logic` label on the fork node | **REFUSED** | Machine vocabulary; the sheet's own README flags it. See report |
| 1 | `Over £2m?` — the branch condition on the node face | **CANNOT-EXPRESS** | See report |
| 1 | A two-outcome fork topology | **CANNOT-EXPRESS** | The spine is LINEAR by construction (`199-01` §5 measured the same wall) |
| 1 | A `dragging` node face | **CANNOT-EXPRESS** | Already reported in full by `199-01` §3 — not re-litigated here |
| 1 | Material-Symbols line glyphs on nodes | **REFUSED** | `199-01` §1: sketches 134/135 were rejected for exactly this |
| 1 | ⚠ The plane overflowing on the right | **FLAW DECLINED** | Not inherited — see below |
| 2 | AT REST — thin solid | **ALREADY-SHIPPED** | `EDGE_STYLE.flow` — solid, 2px, `hsl(var(--border))` |
| 2 | HOVERED — brighter | **CANNOT-EXPRESS** | See report |
| 2 | SELECTED — indigo, weighted | **CANNOT-EXPRESS** | See report |
| 2 | FLOWING — dashed, alive, indeterminate | **CANNOT-EXPRESS** | See report |
| 2 | NOT TAKEN — faint dotted, still legible | **CANNOT-EXPRESS** | See report — and the shipped dashed branch is a *different thing* |
| 2 | *(the acceptance bar, not the sheet)* each state carries its word | **BUILT** | The branch connector was wordless. See below |
| 3 | Zoom out · zoom in · fit | **ALREADY-SHIPPED** | Exactly three, pinned by aria-label as an exact list |
| 3 | The `85%` zoom readout | **REFUSED** | See report |
| 3 | The lock / padlock | **REFUSED** | Deliberately suppressed since 183 (T-183-11). See report |
| 4 | The empty plane's `Start your workflow` invitation | **ALREADY-SHIPPED** | Shipped copy is `＋ Add your first step` — and is better. See note |
| 5 | The read-only `Locked for Execution` banner + ghost node | **ALREADY-SHIPPED (banner) · REFUSED (ghost)** | `👁 View only` ships; the ghost node is refused. See report |

**Two BUILT rows. Three ALREADY-SHIPPED. Five REFUSED. Eleven CANNOT-EXPRESS.** That distribution is the honest outcome of reconciling a direction-only sheet against a locked visual language, and it matches `199-01`'s (1 built / 4 already / 2 cannot). A sheet drawn without opening the code will mostly describe things the code cannot do; saying so precisely is the deliverable.

---

## ⚠ THE FLAGSHIP CANNOT-EXPRESS — the payload-bearing connection label

The sketch's own README calls this *"the idea worth keeping from the whole exploration"*. It is reported in the three required parts, and it is **not built and not approximated.**

### 1 · What the sheet asks for

Every connector on the plane carries a pill naming **what actually moved along it**:

```
Find contracts ──[ 312 contracts ]──▶ Pull out dates ──[ 48 extracted findings ]──▶ Weigh each
                                                     ├──[ 12 flagged ]──▶ Escalate
                                                     └──[ 36 routine ]──▶ File as routine
```

The claim behind it is real and good: *"a connection stops being 'A then B' and becomes a statement about the work — you can audit the arithmetic of your own process at a glance."*

### 2 · What the component can do

`FlowEdge` and the library's default renderer can draw a label on any connector — `BaseEdge` already forwards `label` / `labelStyle` / `labelBgStyle`, and this plan proves it by shipping one. **The rendering is not the blocker. The VALUE is.**

What reaches the canvas per connector is exhaustively: the source slug, the target slug, `data.kind` (`flow` / `skip` / `end`), and `data.armed`. Per NODE the canvas may additionally receive a `NodeRunState` — a `reading` and a page-worded `label`. **There is no count of anything, anywhere, at any granularity.**

### 3 · The gap, and precisely which value is missing

- **The missing value is a per-edge item count**: *how many units of work crossed this connector on the last (or a given) run.* Nothing produces it.
- **Where it would have to come from.** The harness emits per-PHASE status, not per-phase *output cardinality*; `workflow_phases` carries no result count; the wire model (`app/models/harness.py`) has no field for one; and even if a phase emitted one, an EDGE count is a different quantity again — for a branch it is *how many items took THIS arm*, which requires per-item routing telemetry the engine does not record. That is a backend emission, a schema column, a wire field and a projection field: **four data axes**, every one forbidden by this plan's scope fence.
- **Why an approximation is worse than nothing.** A phase count or a step index is available and would render identically. It would also be a **fabricated business figure on the surface a business reader trusts most** — the same class of defect the sketch's own README flags on sheet 3 (`Processing liability caps section (4/12)`) and that `199-01` refused twice (`Found 12 items`, the live `00:15` timer). A number on a canvas is read as a fact about the reader's own business. There is no honest approximation of one.
- **T-199-05-01 disposition: MITIGATED.** The absence is now MACHINE-CHECKED, not merely intended: `WorkflowCanvas.test.tsx` asserts that **no connector's text contains a digit**, with the sheet's own four labels as positive controls. A future fabricated figure cannot arrive quietly.

### Re-open trigger

> **The first phase in which the harness emits a structured per-phase result cardinality onto `workflow_phases` AND a run-time edge-traversal record exists.** At that point this becomes a real requirement — provisionally `CANVAS-PAYLOAD-01` — and its first question is *"what does the label say on a workflow that has never run?"*, because the sheet draws only the populated case and the plane spends most of its life un-run. Until then: **not built, not approximated, and guarded by an assertion.**

---

## THE OTHER CANNOT-EXPRESS REPORTS

### Connection state · HOVERED

- **Asks for:** the connector brightening under the cursor (`#464651` → `#918f9c`, 2px → 3px).
- **Can do:** nothing today, and `grep hover:` across the canvas subtree returns zero for edges.
- **The gap:** **an edge on this canvas is not interactive and never has been.** `edgesFocusable={false}`, no `onEdgeClick` is wired, and there is no edge inspector to open. A connector that lit up under the cursor would promise an interaction that does not exist — which is the exact argument `199-01` used to *suppress* its own hover lift in run mode. Additionally the sheet's carrier is a colour change, which fails this plan's own acceptance bar. **Not built.**

### Connection state · SELECTED

- **Asks for:** an indigo, weighted, drop-shadowed connector.
- **Can do:** the library tags every edge `selectable` and would apply its own `selected` styling. **Measured: a click on the interaction path did NOT select an edge in the shipped harness** (`ANY SELECTED EDGE: 0` after `fireEvent.click`).
- **The gap:** selection on this canvas means *"open this step's form"* — `onSelectNode(slug)` is the whole contract, and an edge is not a step. There is nothing for a selected edge to open, and the library's own selected-edge treatment is **colour-only**, which fails the acceptance bar. Removing the `selectable` class was considered and **declined**: the measurement shows the state is not reachable by click, so changing behaviour on an unproven claim would be worse than recording it. **Not built. Recorded with its measurement.**

### Connection state · FLOWING

- **Asks for:** a dashed, animated, indeterminate connector while work is moving along it.
- **Can do:** the canvas *does* receive `runState?: (slug) => NodeRunState | undefined`, so it can know a STEP is running.
- **The gap:** two blockers, and the second is machine-enforced. **(a)** "Flowing" is a claim about a CONNECTOR; the run reports per-PHASE status and nothing about traversal. The nearest true statement — *"the step this leads into is running"* — is a fact about the node, which the node already paints. **(b)** `WorkflowCanvas`'s shipped, suite-enforced contract is that it **derives no run state**: its own suite asserts the canvas spells none of the seven reading words, imports the run type TYPE-ONLY, and imports `@/lib/phaseState` in no form at all. Mapping a node reading onto an edge state would be a second derivation home for a value D-188-01 gave exactly one. **Not built.**

### Connection state · NOT TAKEN — *and a semantic correction worth recording*

- **Asks for:** a faint dotted connector for **a branch the run did not take** — *"a skipped path is information, not an absence."*
- **Can do:** the plane already draws a dashed amber `skip` connector, and this plan's own plan text names it as the likely match.
- **⚠ THE GAP IS THAT THEY ARE NOT THE SAME THING, and treating them as one would ship a lie.** The shipped `skip` edge is an **authoring-time** fact: *this validator declares an on-fail branch to that step*. It is drawn on a workflow that has never run, and it means "this path MIGHT be taken". The sheet's NOT TAKEN is a **run-time** fact: *this path WAS NOT taken on this run*. Painting the authoring-time branch in the run-time vocabulary would tell a reader their branch was skipped on a workflow that has never executed. The node side of the run-time fact *is* shipped (`Skipped — the run took a different path`, one of `199-01`'s nine readings); the EDGE side needs a per-edge traversal record, which shares the flagship's missing data. **Not built. The plan's own suggested mapping is recorded as REFUTED.**

### §1 · Alignment guides during a drag

- **Asks for:** indigo horizontal/vertical guides while a node is being moved.
- **Can do:** nothing — no guide layer exists, and `PlaneEditingLayer` draws only the ＋/✕ affordances.
- **The gap:** guides imply free 2-D placement. The spine is **linear and cannot be rewired** (D-138-C-local: order is the contract with the engine, and the vertical nudge is a browser-local cosmetic preference that never writes the definition). A guide showing a node snapping to an arbitrary column would advertise a placement model this product deliberately does not have. **Not built.**

### §1 · `Over £2m?` — the branch condition printed on the node face

- **Asks for:** the fork node's supporting row carrying its own condition in the author's words.
- **Can do:** render the type sentence in the supporting slot; the branch's condition reaches the canvas only as `skip_to_phase:<slug>` on a validator's `on_failure`.
- **The gap:** the definition holds **which step to jump to**, never **the predicate that decides it** — the condition lives inside the validator's own kind and configuration, which no client-side vocabulary reads. There is also no slot: badge 1 is reserved for 188/189 and badge 2 is `llm_human_input`'s, and `BadgeSlots` is a max-2 tuple union, so a third is a typecheck error. **Not built.** *(The connector's `on fail` word, built below, is the honest fraction of this that the definition really does hold.)*

### §3 · The `85%` zoom readout

- **Asks for:** a live zoom percentage between the two zoom buttons.
- **Can do:** the library exposes the viewport, so it is technically reachable.
- **The gap:** it is a **new user-facing capability**, which this plan's scope fence forbids in one line. It is also the one control in the sheet's cluster with no shipped counterpart, so adding it is a feature decision rather than a re-presentation. **REFUSED as out of scope**, and pinned as an absence (`.react-flow__controls` text must not match `/\d+\s*%/`, with `85%` as the positive control) so it cannot arrive without a diff. **Re-open trigger:** the first phase whose scope includes canvas view controls as a feature.

### §5 · The `Locked for Execution` banner and its ghost node

- **The banner:** **ALREADY-SHIPPED, in better words.** The read-only plane carries `👁 View only` + *"the plane pans · steps stay put"*. The sheet's phrase names the MECHANISM (*execution*, *locked*); the shipped pair says what the reader can and cannot do. The sheet's own third rule — *never name the mechanism to the user* — argues for the shipped one.
- **The ghost `Validated Logic` node:** **REFUSED.** A dimmed placeholder node on a surface that cannot act implies an affordance that does not exist (D-183-11 in miniature), and `Validated Logic` is machine vocabulary besides. Pinned: the read-only empty plane renders **zero** buttons, the editable one exactly **one**.

### §1 · `Fork Logic` — REFUSED, as the sheet's own README instructs

The sheet prints a small `Fork Logic` label on its fork node. Its own README flags this as *"machine vocabulary that slipped past the rule"*. **Not copied.** Any word on a branch comes from shipped vocabulary or does not appear — which is precisely what the one BUILT connection row does.

---

## THE TWO BUILT ROWS

### 1 · The branch connector carries its word

**The measured gap.** The resolved on-fail branch is the **only** connector on the plane that means something other than *"then"*, and it said so in **nothing but a dash and an amber stroke**. Measured on an untouched tree: `skip:assess->escalate` rendered `"text": ""`.

The same concept carries its word on **both** sibling surfaces:

| Surface | What it prints |
|---|---|
| `PhaseSpineGraph.tsx:186` | `⤳ on fail → skip to <slug>` |
| `PhaseNode.tsx:261` (broken target) | `⤳ on fail → goes to <slug> — no such step` |
| **the canvas connector** | **(nothing)** |

So a reader who cannot see the amber got the branch from the shipped canvas **and from nowhere else** — and that is exactly what this plan's acceptance bar forbids: *every state the plane can express is distinguishable without colour, and carries its word where a word exists.* The word existed. The connector did not carry it.

**What shipped** (`WorkflowCanvas.tsx`, +2 module-scope tables, +1 conditional spread in the existing `edges` memo):

```ts
export const BRANCH_CONNECTOR_WORD = "on fail"
```

Five decisions, each a shipped invariant rather than a preference:

1. **The WORD, not the `⤳` glyph.** `⤳` is §4's on-fail mark and both sibling homes draw it — wrapped in `aria-hidden`, because it is decoration beside a sentence. **An SVG edge label is one text node with no room for that split**, so shipping the glyph would put an unlabelled mark into an accessible name. The dash carries the shape; the word carries the meaning — `PhaseNodeCard`'s own docblock rule.
2. **Not on the broken branch.** An unresolvable `skip_to_phase` already terminates in a stub that prints the whole sentence; a second `on fail` on its connector is the same fact twice, three centimetres apart. The guard reads the **node type**, never the reserved id prefix. **Driven RED**: dropping it produced `AssertionError: expected 'on fail' to be ''` on the case named *"does NOT double up on a BROKEN branch"* — the fence named the right rule, then was restored.
3. **Raw `hsl` literals, never a Tailwind token.** The label spends the identical `hsl(38 92% 60% / …)` the branch stroke already spends. 15 of sheet 178's 18 colour tokens compile to nothing here, and an unpainted class is indistinguishable from a deliberately unpainted arm — the `bg-warning` silent no-op that shipped unguarded until 192.2. A raw literal beside an identical raw literal cannot acquire that failure mode.
4. **Conditional spread (the shipped D-14 idiom).** A run-order connector's object is byte-identical to what it was before this plan, so `FlowEdge`'s transcribed bezier baseline is not merely unchanged — it is *unreachable* by this diff.
5. **A signal, never a control.** No tab stop, no handler, no role inside the branch's `<g>`; asserted, with a positive control proving the query would find one.

**Proved non-colour-only on two independent channels** — with every colour deleted, the branch differs from run order in BOTH its dash and its word, so losing either one still leaves it readable.

### 2 · The ground, committed rather than inherited

Sheet c1's one structural claim about the plane is that it *commits* to a ground: *"a quiet dot grid, quiet enough that a step at rest is still the loudest thing on the plane."*

Until this plan the ground was whatever `@xyflow/react` happened to default to — `<Background />`, no props. The dots were already right; **the commitment was missing.** `BACKGROUND_GROUND` now states the variant, gap and size **measured off the shipped rendering** (`variant: dots`, `gap: 20`, `size: 1` — the library was drawing a 20px lattice with a 1px dot, and still is). **Zero pixels change.** What is bought: a library upgrade that moves a default can no longer move this surface's ground without appearing in a diff. The enum is used rather than the string `"dots"`, because a typo in a string literal falls back to the default and draws a ground that merely *looks* committed.

⚠ **THE COLOUR IS DELIBERATELY NOT COMMITTED, and the absence is the decision.** An explicit `color` emits an inline fill and takes the dots **off the theme's own CSS variables**, so light/dark would stop following them. Geometry is ours to state; the palette belongs to the theme. The sheet's `#212631` on `#090e18` is declined for the same reason its other tokens are. Pinned: the rendered dot carries **no** inline `style` and **no** `fill` attribute.

⚠ **WHAT THE "QUIETER THAN A STEP" ASSERTION DELIBERATELY DOES NOT CLAIM.** The provable half is asserted — the ground's loudest mark is a sub-2px dot against a 248px card, it paints one pattern and one circle, and **no text, image or `foreignObject` at all**. The STACKING half is not: the ground sits behind the cards by the library stylesheet's `z-index`, and it is rendered **after** the renderer in document order (measured — the first attempt at a document-order assertion failed, correctly). jsdom resolves no stylesheet, so that half is **owed to a driven check** and is recorded as owed rather than claimed. Asserting it from a passing unit test would be the fail-open this project keeps catching.

---

## THE SHEET'S RIGHT-OVERFLOW FLAW IS NOT INHERITED

The sheet's README records that its plane overflows on the right and clips its two branch outcomes. The structural reason it cannot happen here, asserted rather than assumed: the plane is **fluid** (`group/canvas relative h-full w-full`), never a fixed `h-[600px]` box with absolutely-positioned cards, and the library is asked to **fit** the content on mount (`fitView`, `fitViewOptions={{ padding: 0.1, minZoom: 0.3 }}`, `minZoom={0.3}`). Driven on the widest fixture: the last step, the end cap and all five nodes are on the plane.

---

## ⚠ THE §4 MARK AUDIT — three shipped marks have no row in `icon-convention.md` §4

§4 closes with an instruction: *"a sketch touching the canvas should be greppable for glyph literals, and every one should trace to a row in the table above or be explicitly flagged as a proposal."* This plan ran that audit — **over the RENDERED DOM in both modes**, not over source, because what a reader is taught is what is painted and a comment can spell a mark the surface never draws.

**It found four unaccounted marks on the first run.** All four trace to real shipped homes. **Three of them have no row in §4.**

| Mark | Where it is painted | §4 row? |
|---|---|---|
| `＋` `✕` | `PlaneEditingLayer.tsx` | ✅ yes |
| `⤳` | `PhaseNode.tsx:261` (broken-branch stub) | ✅ yes |
| `⛨` | `NodeCornerMarks.tsx` | ✅ yes |
| **`○`** | **`PhaseNode.tsx:280` — the END CAP** (also `nodePresentation.ts:71`, `deriveTier.ts:46`, `definitionOps.ts:218` `○ Free to think`) | ⚠ **NO** |
| **`✎`** | **`WorkflowCanvas.tsx:512` `✎ Editing`** — plus `library/WorkflowCard.tsx:48`, `WorkflowDoorSwitch.tsx:213`, `library/WorkflowDeleteSheet.tsx:193` | ⚠ **NO** |
| **`👁`** | **`WorkflowCanvas.tsx:1082` `👁 View only`** | ⚠ **NO** |
| `⌥` `←` `→` (canvas) · `⌘` `⇧` (toolbar) | keyboard-accelerator hints | n/a — these name a KEY, not a canvas concept |

`○` is a canvas mark by any definition: it says where the flow stops (sketch 136 — *"every flow ends in an explicit cap, never a dangling edge stub"*). `✎` is one mark on **four** surfaces, reused from the Control Room's audit-receipt vocabulary. **A mark missing from §4's table is permanently invisible to its own convention** — the identical failure the hot-file ledger's completeness rule exists to prevent, in a second place.

**Not fixed here, deliberately.** `icon-convention.md` lives outside this plan's file envelope and is a **shared artifact being read by a sibling plan in the same wave**; `197-10`'s precedent is that editing one mid-wave is the wrong call. **Reported instead, and pinned in the consumer suite** as `SHIPPED_BUT_ABSENT_FROM_SECTION_4` with each mark's home — so if a future phase adds the rows and moves them into the §4 set, the assertion **inverts** rather than being deleted.

> **Re-open trigger:** the next phase that edits `icon-convention.md` §4, or the next `/gsd:sketch` that draws a canvas mark. Adding rows for `○`, `✎` and `👁` is a three-line change to a doc and closes the gap for four surfaces at once.

### ⚠ AND THE AUDIT'S FIRST VERSION WAS ITSELF BROKEN — mode-blind, and fixed in its own commit

The sweep as first committed walked **only the editable plane**. The header's two arms are **mutually exclusive**, so `👁 View only` was invisible to it — and so would a phase glyph appearing only in read-only have been. That is Phase 188's F7 lesson in a new dress: *an invariance fence says nothing about what it does not cover.* Fixed in `79612fd8`: both modes are walked and unioned, and the assertion now demands `＋`/`✕` (editable-only) **and** `👁` (read-only-only) in the same set — **which the old sweep could not possibly have satisfied**, so the fix is proved by the assertion rather than asserted by the message.

The blanket emoji check was replaced at the same time with the honest failure shape: the shipped phase marks are **bundled SVG components resolved from `PHASE_GLYPHS`' slugs**, so a phase glyph cannot appear as an emoji at all — the real risk is a **slug leaking onto a face**, which is both the mechanism being printed and a re-declaration of the one shared map. That is now checked against `PHASE_GLYPHS` itself rather than a hand-kept copy.

---

## A NOTE ON THE SHIPPED EMPTY-PLANE COPY

The sheet's invitation reads `Start your workflow` under a circle-`＋`. The shipped one reads `＋ Add your first step` with a supporting line *"Pick what it should do — you can change the details afterwards."* **The shipped copy is better and was not touched**: it says what pressing the control will *do*, which is the sheet's own "the purpose must survive the cut" rule applied more strictly than the sheet applied it. Both planes are pinned as exact literal atom lists — two atoms each.

---

## Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors** — the pre-existing baseline, unmoved. **0** under `components/workflows/` |
| `WorkflowCanvas.test.tsx` | 53 → **77** (+24), 0 failing |
| `FlowEdge.test.tsx` | 22 → **25** (+3), 0 failing |
| `CanvasToolbar.test.tsx` | 14 → **18** (+4), 0 failing |
| `WorkflowCanvas.editing.test.tsx` | 65 → **65** (0), 0 failing |
| `WorkflowCanvas.composition.test.tsx` | 20 → **20** (0), 0 failing |
| `node scripts/vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | `count gate OK` — **96/96** pinned files present, no per-file decrease, **0 failing**. total **4806** · pinned total **4543** |
| `git diff --stat -- backend supabase` | **EMPTY** at every task, and across all four commits from the base |
| `STATE.md` / `ROADMAP.md` | **not touched** (orchestrator owns those writes) |

**The count-gate arithmetic closes with no residual.** Base total **4775** → **4806** = **+31**, and `+24 +3 +4 = +31` across exactly the three suites this plan moved. Every other delta in the gate's output predates the base commit `a6480296`.

**Zero assertion deletions.** `git diff base..HEAD | grep "^-[^-]"` returns **three** lines across four commits, and none is an assertion: two are import statements being widened, one is `<Background />` becoming its committed form.

**The cap was neither adjusted nor needed.** `GSD_VITEST_MAX_WORKERS=2` held on every run and nothing red appeared that this plan had not deliberately caused (the guard plant, and three literals corrected by measurement). **Recorded as an observation, not as proof of innocence:** none of SEED-171's five named flaky suites is in this plan's blast radius, and none appeared red at any point.

---

## Hot-file ledger — `WorkflowCanvas.tsx` RE-DERIVED

| | ledger cell | **re-derived at this HEAD** |
|---|---|---|
| commits | 23 | **25** |
| phases | 6 | **7** (`183 184 185 187 188 188.1 199`) |
| lines | 1301 | **1405** |

**The cell was CURRENT at the base and this plan moved it** — that is the ordinary case, not a staling. **G-5 FIRES (7 phases); disposition: honoured by construction.** The change is two module-scope frozen tables plus a conditional spread inside the memo that already existed; **no second concern was added and no seam was taken.** The ledger row is **not edited here**, for the same reason `icon-convention.md` is not: it is a shared artifact and this is a ten-plan wave. Wave 1 (`199-01`) likewise left it — `docs/HOT-FILE-LEDGER.md`'s last commit is 192.2's sync. **Reported for the phase-close sync.**

`FlowEdge.tsx` (2 commits) and `CanvasToolbar.tsx` (3 commits) were **measured, not modified** — this plan's diff over both source files is empty, deliberately.

---

## Success criteria

- [x] **SC#1** — every element of sheet c1 carries a verdict; 21 rows, none silently dropped
- [x] **SC#2** — no backend, migration, endpoint or wire model modified (`git diff --stat -- backend supabase` empty at every task AND across all four commits)
- [x] **SC#3** — the plane renders no more at rest than before, proved against the Task-1 inventory (the branch connector gains one word; every other connector, both empty planes, the three controls and the ground are unchanged, pinned as literals)
- [x] **SC#4** — the mechanism is not printed: `Fork Logic` refused, `Locked for Execution` declined in favour of the shipped `View only`, and no `PHASE_GLYPHS` slug may reach a face
- [x] **SC#5** — `tsc` unmoved at 33/0, count gate `failed 0` with no per-file decrease, all five named suites green

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The worktree forked from the wrong base — the FOURTH instance in this phase**

- **Found during:** startup, at the mandatory branch check
- **Issue:** `git merge-base HEAD a6480296…` returned `3781a3fe`, not the dispatched base.
- **Fix:** `git reset --hard a64802968ba53c9f95031d38eeca13150f5a959e` per protocol, verified by re-reading HEAD, then Wave 1's presence confirmed by `git log --grep="199-01"` before any work began.
- **Commit:** pre-commit (no code change)

**2. [Rule 1 - Bug] Three inventory literals were wrong, and were corrected by MEASUREMENT**

- **Found during:** Task 1
- **Issue:** the pins were authored from reading the source and three were wrong — `⤳ on fail →…` has no space after the glyph (`⤳on fail →…`), `＋ Add your first step` likewise (`＋Add your first step`), and the ground's depth was asserted by document order when the ground is stacked by CSS `z-index` and is rendered **after** the renderer.
- **Fix:** the two string literals re-read off the rendered DOM; the depth arm replaced with a provable content claim (one pattern, one circle, no text) and the unprovable half **recorded as owed** rather than dropped.
- **Files modified:** `WorkflowCanvas.test.tsx`
- **Commit:** `ee8ae1e9`

**3. [Rule 1 - Bug] The §4 mark audit was mode-blind**

- **Found during:** Task 3, after committing
- **Issue:** the sweep walked only the editable plane; the header's arms are mutually exclusive, so the read-only `👁` and any read-only-only phase glyph were invisible to it.
- **Fix:** both modes walked and unioned, with an arm-exclusive atom from each asserted so the old sweep could not have passed; the blanket emoji check replaced by a `PHASE_GLYPHS`-slug check.
- **Files modified:** `WorkflowCanvas.test.tsx`
- **Commit:** `79612fd8`

**4. [Rule 3 - Blocking] Task 2's BUILT row could not live in the file the task named**

- **Found during:** Task 2
- **Issue:** the plan gives Task 2 `FlowEdge.tsx` + `FlowEdge.test.tsx`. `FlowEdge` renders **only** `flow` edges; the `skip` connector keeps the library's default renderer, and its style table (`EDGE_STYLE`) lives in `WorkflowCanvas.tsx`. Registering `skip` in `edgeTypes` was considered and **declined** — the shipped docblock states a `skip` entry *"would look like a promise the projection does not make"*, and moving who renders every branch is exactly the risk `FlowEdge`'s baseline transcription exists to contain.
- **Fix:** the row landed in `WorkflowCanvas.tsx`, which is inside the plan's top-level `files_modified`. `FlowEdge.tsx`'s diff is **empty**; its suite gained the colour-blind signature only.
- **Commit:** `d1525d46`

### Findings recorded rather than fixed

**5. The plan's own suggested mapping for NOT TAKEN is REFUTED.** The plan text says *"the dashed `skip_to_phase` branch already exists"*. It does — but it is an **authoring-time** fact drawn on workflows that have never run, while the sheet's NOT TAKEN is a **run-time** one. Nothing was changed to make the plan's sentence true; the semantic difference is reported under the CANNOT-EXPRESS section.

**6. Three shipped marks have no row in `icon-convention.md` §4** (`○`, `✎`, `👁`). Reported with homes and a re-open trigger; pinned in the consumer suite; the shared doc deliberately not edited mid-wave.

**7. `WorkflowCanvas.tsx`'s ledger triple moved to `25 / 7 / 1405`.** Reported for the phase-close sync; the shared ledger deliberately not edited mid-wave.

**8. The ground's stacking is OWED a driven check.** jsdom resolves no stylesheet, so `z-index` cannot be asserted here. Recorded as owed, not as passed.

### Deferred items

**9. `.vite-cache/` is untracked and unignored.** The bootstrap script creates it inside every worktree and `.gitignore` carries no rule. It is never staged by this plan. The ignore rule belongs in `.gitignore` — a shared file — and is a one-line cross-cutting change better made once at phase close than by one of ten concurrent wave agents. Recorded rather than taken.

## Known Stubs

None. Every row of the 21-row reconciliation is built, already shipped, refused with a reason, or reported as CANNOT-EXPRESS in all three parts with a re-open trigger. Nothing was faked, approximated or left implied — and the flagship absence is machine-checked rather than merely intended.

## Threat Flags

None. The plan's three registered threats are satisfied:

- **T-199-05-01** (spoofing — connection labels) — **MITIGATED, and now guarded.** The payload label is reported, never approximated, and `WorkflowCanvas.test.tsx` asserts no connector's text contains a digit, with the sheet's own four labels as positive controls. The one label that ships is an authored condition the definition already holds, carrying no digit.
- **T-199-05-02** (tampering — `FlowEdge.tsx`) — **`FlowEdge.tsx`'s diff is EMPTY.** The transcribed bezier baseline is untouched, and the branch label rides the library's own `EdgeText` at the path's midpoint, changing no `d`. The conditional spread means an ordinary connector's object is byte-identical to before.
- **T-199-05-03** (elevation — `WorkflowCanvas.tsx`) — the read-only plane gains **no** affordance (pinned: zero buttons on the read-only empty plane), the ＋/✕ stay on the lane, and every read-only opt-out prop is unchanged. The new label is a signal with no tab stop, no handler and no role.

No new network endpoint, auth path, file access pattern or schema change. The source diff is two module-scope constant tables, one conditional spread inside an existing memo, and three props on an existing `<Background>`.

## Self-Check: PASSED

- **Files claimed modified — all FOUND:** `WorkflowCanvas.tsx`, `WorkflowCanvas.test.tsx`, `FlowEdge.test.tsx`, `CanvasToolbar.test.tsx`
- **Commits claimed — all four FOUND in `git log`:** `ee8ae1e9`, `d1525d46`, `92cf14da`, `79612fd8`, on `worktree-agent-acd143cd3e3af748d`, parented on the corrected base `a6480296`
- **Scope fence re-asserted across ALL FOUR COMMITS, not only the working tree:** `git diff --stat a6480296..HEAD -- backend supabase .planning/STATE.md .planning/ROADMAP.md` → **empty**
- **Nothing deleted:** `git diff --diff-filter=D` clean on every commit
- **Transient artefacts left nothing behind:** two probe suites (`__probe199_05.test.tsx`, `__probe199_05b.test.tsx`) and the deliberate RED plant in `WorkflowCanvas.tsx` were all removed before their respective commits and appear in none of them
