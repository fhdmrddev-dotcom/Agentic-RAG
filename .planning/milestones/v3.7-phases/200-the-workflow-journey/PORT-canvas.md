# PORT — the workflow canvas, from sketch 200's markup

Reference: `.planning/sketches/200-journey-interactive/screens/builder-canvas.html` and
`screens/node-identity.html`, read as markup and ported structure-for-structure.
`200-CHECKLIST.md` was **not** consulted — it is what caused this rework.

Four commits: `901b25ff` (the card), `0f41b16b` (two collisions the port created),
`503d15f7` (two operator findings), `ca722deb` (two downstream geometry pins).

Verification: **4611/4611** across `src/components/workflows` + `src/pages`.
`tsc -p tsconfig.app.json --noEmit` → **19 files**, exactly the pre-existing set; none is mine.

---

## What was ported

### The node card — the whole reason this looked wrong

The shipped card was 137-B's: **248px wide, `rounded-[22px]`, CENTRE-aligned, frosted,
padded 42px at the top** to clear a **62px 3D mark floating above its edge**. The sheet
draws a different card on ten of its ten nodes, and that silhouette difference is the
operator's complaint.

| Atom | Sheet | Now |
|---|---|---|
| box | `w-[240px] h-[72px] rounded` solid `bg-card`, `p-md` | same, height as a floor |
| icon | 24px well **inside**, left gutter, glyph `text-[18px]` | same, per-type tint preserved as a glow behind it |
| text | left-aligned column: 13px title over 11px line | same |
| third line | `CHANGES SOMETHING OUTSIDE`, 9px bold wide-tracked, warning tone | same (see *not on the wire* below) |
| hover | border change **and** `-translate-y-1` | same, suppressed in run mode |
| corner mark | 4px inset, top-right | same offset; our 21px ringed ⛨ kept (see below) |

**Height is a floor, not a fixed size** — the sheet's own three-line nodes are 84px, and ours
still grows downward to meet a run line or a branch condition. `NODE_MIN_HEIGHT` 104 → **72**,
run mode 120 → **84**.

**`EDGE_ANCHOR_Y` 28 → 36**, measured off the sheet rather than chosen: its nodes sit at
`top: 64` with height 72 and every connector is drawn at `y = 100`; `100 − 64 = 36` is the
card's vertical centre.

### Already present before this port (verified, not rebuilt)

The dot-grid ground (199-05), the four connection states + the bottom-right legend strip
(200-06), and the declared-count edge labels (`step_count` / `step_noun`, BC-MR-01). The
zoom / fit / lock cluster is React Flow's `<Controls />`.

---

## Behind a hover rather than dropped

- **The ○ end cap.** Operator: *"at the very end of the workflow there is a circle, I don't
  know what this is."* It already carried an `sr-only` sentence — so a screen-reader user was
  told and a **sighted user was told nothing**. It now carries a `title`, and both sinks read
  **one string** from a new `planeVocabulary.ts` leaf. Not double-announced: `title` is the
  lowest-priority accessible-name source, so an element whose own content names it never falls
  through. Wording is a product sentence and makes **no claim about a run**:
  *"End of the workflow — nothing runs after this point."*
  ⚠ Semantics untouched — one cap, fed by max `phase_index`, still inert; and the gap case
  still leaves a pre-gap phase with **no outgoing edge**.

- **The `⌥` technical slug.** See *the one place the sheet was not followed*, below.

---

## What the sheet draws that is NOT on the wire

1. **`ONLY READS`.** The sheet draws a Jira READ node beside a Jira WRITE node, so a reader of
   the sheet alone would conclude we model a read/write split on external steps. **We do not.**
   All three capabilities the client recognises (`send_email`, `create_ticket`, `post_message`)
   are writes; nothing on the wire could resolve a step to "only reads". **Declined, not
   approximated** — rendering it would have required the model choosing which steps only read,
   in the most confident typography on the card. Dated re-open trigger inside
   `nodeEffectBanner.ts`: the first non-mutating capability, or any wire field distinguishing
   read from write.

2. **The marching "running" connector — NOT LANDED, and this is the one real gap.** The sheet
   draws exactly one live line (`stroke-dasharray: 6 6` + `@keyframes march`, brand colour,
   with a `running` textPath). I built it, and **backed it out**, because it cannot be landed
   honestly from inside the canvas:
   - `WorkflowCanvas.test.tsx` forbids this file from spelling **any** of the seven reading
     words, or importing `runVocabulary` as a value (D-188-01/02 — the page decides the
     reading, the canvas paints it). `reading === "running"` trips it.
   - a second fence forbids the run lookup below the drag-overlay memo (the anti-blink split),
     which is where the edges memo lives.
   - the clean fix is a page-resolved boolean on `NodeRunState` — and the page is
     `WorkflowRunPage.tsx`, which this dispatch must not edit.

   **What it needs:** one optional field on `NodeRunState` (e.g. `live?: boolean`), set by the
   page beside the `reading` it already resolves; the canvas then merges a stroke delta and a
   CSS class with no derivation and no vocabulary. ~15 lines, no new fetch.
   The **word** should stay on the card, not the line — `runReadingLabel` is its one home and
   the sheet only puts it on the edge because its nodes carry no run line.

---

## Pins that moved, and why (each reason is written inside the pin)

| Pin | Moved | Why |
|---|---|---|
| 3 × `CARD_HTML_BASELINE` | re-captured | see below |
| 3 × shape matrices (readings / verdicts / border branches) | re-captured | same |
| 199-01 hover fences ×2 | re-pointed | a recorded **refusal** retired in writing |
| mark-occupancy + seal-zone geometry | re-derived | card 248→240, marks re-sited |
| no-clipping prose count | re-homed | went to **0** when `NodeIconWell` was deleted |
| min-height (104→120 ⇒ 72→84) | re-derived | sheet's own figures |
| `CANVAS_LAYOUT` table | re-derived | `NODE_MIN_HEIGHT`, `EDGE_ANCHOR_Y` |
| `FlowEdge` detour transcription | re-derived | anchor moved the baseline |
| editing-affordance capture (12 rows) | re-derived | two different terms — see below |

**The `CARD_HTML_BASELINE` header forbids re-capture, and I invoked-and-overrode it rather
than ignoring it.** Read literally, its subject is *"AFTER PLANS 188.2-05 AND 188.2-06"* — an
**extraction**, which promised to move code and not pixels; against that promise a red capture
proved the promise broken. **This port promises the opposite**: a capture that stayed green
would have meant the port did not happen. The protections it exists for are intact —
re-captured **mechanically** (a harness rendered the card and dumped `innerHTML`; not one
character hand-typed), the change is **named** in the card's docblock and JSX, and the
**marker rows** that say what each capture must *contain* are untouched, so a re-capture taken
from a card that had stopped painting its verdict/seal/ring/run-line still fails. The rule is
**not retired** — it binds the next change as hard as it bound 188.2.

**199-01's refusal is retired in writing, with its reasoning preserved above the new code.** It
declined the sheet's hover border on the grounds that it would put a fifth colour utility into
a four-branch ternary. Overruled on the operator's instruction — and the concern is
**measurably not violated**: a `hover:` variant and a base utility never contend for the same
tailwind-merge slot, and every re-captured resting class list still carries exactly one
unprefixed border-colour token.

**One fence was passing by accident and is corrected rather than left green.** *"the card emits
no transform"* matched `hover:(?:translate)-` and so could not see `hover:-translate-y-1` — the
exact utility it existed to forbid — because of the minus sign. It now pins the hover-transform
set exactly and asserts the run-mode suppression.

**The editing-affordance capture has TWO terms, and my first attempt got it wrong.** Recorded
in the pin because it is the argument for re-deriving and re-running rather than reasoning: the
7 `＋` inserts sit on the connector (`+8`), the 5 `✕` removes hang off the card's bottom
(`−32`). A blanket `+8` made half of it right and the suite said so immediately. Both edits
were script-driven, one axis, one constant per group — nothing else in the array could drift
under cover. Arithmetic closes with no residual.

---

## The deletion, justified

`NodeIconWell.tsx` (**deleted**). Its entire subject was the 62px disc floating above the
card's top edge; the sheet puts the mark inside, so it lost its only consumer. Measured:
`grep -rn "NodeIconWell" frontend/src` returns **prose only, zero imports**. Its
responsibility and the no-clipping rule its docblock carried came back into the card's inline
icon-well comment. The subtree fence's path list went 6 → 5 and the destination-count pin
5 → 4 **deliberately** — a stale path resolves to the empty string *silently*, which would
have left every fence green over one file less.

The run ring was **re-sited, not replaced**: 72px floating above → 34px concentric with the
inline well. `viewBox` and `RING_RADIUS` untouched, so all nine arc shapes are byte-identical
and simply render at half scale — sketch 153-A's colour-free acceptance test is not risked.
The verdict mark moved down into the same gutter **because the occupancy check caught it
overlapping the re-sited ring by 10×17px**.

The 21px ringed ⛨ seal is **kept** rather than swapped for the sheet's bare 14px glyph: 185's
argument is that the seal must survive its border being overwritten by selection or run state,
and it survives precisely because it carries its own border *and* its own background. A bare
glyph degrades to one carrier. Only its offset moved.

---

## The one place the sheet was not followed, and why

The sheet truncates its supporting line on all ten nodes. Porting that unconditionally
**silently re-broke 187-09**, which moved the `⌥` Technical-names reveal *into* that slot
precisely because the title slot truncates and clipped the slug
(`AI agent step · find-renewal-t…`) — the one token the reveal exists to show.

Resolved so **both** hold, with nothing hidden: `subtitleIsIdentifier` is a new **data** slot
(seam #1's own rule — add data, never layout), resolved by the adapter, which is already the
one place that knows the reveal is on. Absent ⇒ the sheet's truncation, so **every card on a
default Builder canvas is the sheet's exact 72px composition**; set ⇒ the line wraps and the
whole slug reaches the reader. No hover or ⓘ was needed.

---

## Operator finding 2 — the silent reorder refusal

Operator: *"nodes cannot move to the left or to the right — the first node to the left cannot
move beyond a certain boundary, same as to the right."*

The **refusal is correct** (order is derived from run order; there is no position −1). The
defect was that the early `return` told nobody. Its comment's reasoning — *"a live region that
repeats itself on a no-op teaches the user to ignore it"* — is sound **for a screen reader**
and was being applied to the eye as well.

Split the audiences instead of trading them: the live region is **untouched** and still silent
on a no-op (`setAnnouncement` is deliberately not called); the eye gets a bounded 220ms lateral
nudge on the selected node plus a resting outline. The keyframe **returns to 0** at both ends
and in the middle — on a canvas whose premise is that position *is* run order, a nudge ending
displaced would be a lie told in motion. Under `prefers-reduced-motion` the nudge does not run
and the outline carries the reading alone, which is why it is a separate declaration outside
the query. No spam: `event.repeat` was already discarded, so a held key nudges once; a
repeatedly tapped key is a repeated deliberate act.

⚠ **Panning is NOT bounded** — the operator's wording left this ambiguous, so it was measured:
**no `translateExtent`, no `nodeExtent`** anywhere in the canvas; only `minZoom: 0.3` /
`maxZoom: 2` bound zoom. The plane pans freely. Finding 2 is entirely the node reorder.

---

## What the run-page mount inherits

`WorkflowCanvas` is mounted on **both** the builder and the run page. `WorkflowRunPage.tsx`
was **not edited**. It inherits, without any change of its own:

- **the new card shape** — 240×72, left-aligned, inline mark. Run mode floors at 84px.
- **the run ring at 34px in the card's left gutter**, and the pause chip below it. All nine
  arc shapes unchanged.
- **`EDGE_ANCHOR_Y` 36** — connectors now enter at the card's vertical centre.
- **no hover lift** — suppressed wherever a reading is supplied, deliberately: the run surface
  has no selection and no select handler, so a card lifting under the cursor would promise an
  interaction that does not exist.
- **no reorder nudge** — that path is `editable`-gated and the run mount is read-only.
- **the end cap's hover sentence** — it renders on both surfaces.

---

## Flagged, not fixed

- **`canvas-node-condition` is a latent test-id collision.** `canvas-node-` is effectively
  reserved for node **roots**: several suites enumerate the plane with a prefix selector, and
  that only works because every other element wearing the prefix is *conditional and absent
  from a resting Builder card*. `canvas-node-condition` (200-06) **does** render on a resting
  card whenever a step declares a branch. It is not failing today only because no fixture in
  those suites declares one. Not renamed — not this port's file to rename.
  (Mine were renamed to `canvas-icon-well` / `canvas-effect-banner` for exactly this reason,
  after the one-tab-stop walk read 6 nodes where 3 exist and the roster read 8 where 7 do.)

- **A docblock broke a source fence twice**, and the fence was right both times. The seal's
  props fence carves its JSX block by finding the **first** occurrence of the seal's test id
  across the *joined* subtree source — and the card is joined first — so a comment of mine
  quoting that id verbatim stole the anchor and the fence died with *"could not carve"*. Same
  class as the hover-utility set fence. Sibling ids are now **described, never spelled**. Worth
  knowing before writing prose in this subtree.

- **The step-number residual moved and its remedy expired.** The 137-B `.stepn` slot (12…34)
  is exactly where the sheet now puts the mark and its ring. Still not a collision — the slot
  paints nothing (D-183-07) — but the old written remedy (*"at `left: 16` the graze clears"*)
  no longer clears anything, because the ring spans the gutter. Whoever brings `phase_index`
  to this face needs a **new** home for it. Pinned with its real number.

## Not touched

`CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `scripts/vitest-count-gate.cjs`, `WorkflowRunPage.tsx`.
The theme fix is intact and still theme-driven (`colorMode={themeCtx?.theme ?? "dark"}`), with
its fence asserting both the plane and a node card. No `TABLE[key] ?? fallback` was introduced;
the two `own()` sites in the canvas are untouched. No edge label was invented — the declared-
count path is unchanged, and an upstream step that declared nothing still renders no label.
