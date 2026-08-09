---
sketch: 153
name: run-state-without-colour
question: "What carries a step's run state on the canvas, when colour alone is not allowed to carry it?"
winner: "A"
tags: [phase-188, runviz-01, canvas-mark, run-status, colour-budget, badge-budget, greyscale-proof, shape-not-colour, waits-for-you-collision, step-number-slot, g2-sketch-gate]
---

# Sketch 153: Run state without colour

## Design Question

**What carries a step's run state on the canvas, when colour alone is not allowed to carry it?**

This is sketch 143's explicit hand-forward to Phase 188, still unanswered:

> *"Both governance channels survive a colour-blind read because neither is made of colour. Run status,
> as currently imagined, does **not** — switch colour off mid-run and it vanishes entirely.
> **188 needs a shape of its own, not just four colours.**"*

## How to View

```
open .planning/sketches/153-run-state-without-colour/index.html
```

**Press `◐ Colour off`. That button is the entire acceptance test.** Sketch 143 verified that both
governance channels survive it; run status has to as well.

Each variant shows all seven readings **co-present side-by-side** — following sketch 148's method
lesson: *variants that differ semantically in the same position need a co-present view, not tabs*,
because tab-switching outsources the comparison to memory.

## Variants

- **A: The well becomes the dial** — the 62×62 icon well already floating above the card gains a ring.
  The *arc shape* is the state: a full ring finished, a moving quarter-arc is running, a ring broken
  open with pause bars in the gap is waiting for you, a ring with a bite cut out failed, a dashed ring
  was skipped. Spends **no** slot.
- **B: The step number becomes the state** — fills the declared-but-unrendered `stepNumber` slot, and
  makes its *frame shape* the carrier while the number keeps saying which step you are on.
- **C: The lane carries the run** — refuses to spend anything on the card. State lives on a lane beneath
  the node, its fill *pattern* the shape, with a small worded notch so nothing depends on reading a texture.

## ★ Winner: A — the well becomes the dial

**Operator, 2026-08-05.** The 62×62 icon well — the largest unclaimed surface on the node, and the one
a person is already looking at because it is how they identify the step — becomes the status dial. The
**arc shape** carries the state; colour only ever reinforces it.

**Why A is the answer to 143's hand-forward specifically:**

- **It spends nothing.** Badge slot 1, `stepNumber` and `technicalLine` all remain free — so Phase 189's
  external-action node still has the whole budget it was promised. No other variant leaves it intact.
- **It uses no glyph at all.** Pure geometry, which is the same discipline that gives the shipped
  `Waits for you` badge no glyph: *the word carries the meaning; tone is decoration.* Under an icon
  convention that has just caught two glyph drifts in five days, a channel that cannot drift is worth
  something on its own.
- **It survives colour being switched off**, which is the entire acceptance test 143 set.

**Not chosen:** **B** fills a declared slot but collides with the verdict mark by a measured 2×16px, and
clearing it means editing a coordinate Phase 185 chose deliberately — a 185 decision reopened, not a
free slot filled. **C** leaves the card completely untouched, which is genuinely attractive, but it
places state in the gap between cards, where sketch 144-B already found *the eye skips*.

**The two build notes A carries:**

1. **The ring is a sibling of the icon wrapper**, which already overflows the node box upward by 26px —
   so the standing rule holds: **nothing in this subtree, or in the node wrapper around it, may ever
   take `overflow-hidden`.**
2. **Place the gaps with `stroke-dashoffset`, never with a rotation.** Setting the SVG `transform`
   attribute *and* CSS `transform-box`/`transform-origin` composes them and pivots the arc about a
   doubled offset — that bug shipped in this sketch's first two drafts and put the amber gap in the
   wrong quadrant while the pause chip sat at the top, detached from it. The offsets are computed from
   `offset = (D + G/2) − p` and verified numerically; the formula is in the source.

**Still open, and it belongs to discuss-phase:** the vocabulary questions above are NOT settled by
picking A. `pending`'s shipped word is *"Locked"*; `skipped` cannot inherit `⤳` on the canvas; and
*"waits for you"* is now carrying three jobs.

## What to Look For

1. **Colour off.** Then read all seven cells in each variant. Which ones still separate?
2. **The waiting step, in every variant, draws two marks at once** — the shipped `Waits for you` badge
   *and* the run-time waiting state. Do they read as two facts, or as one thing said twice?
3. **B's graze.** Press `⚠ Show the 2×16px graze`. It is measured, not hypothetical.
4. **The rightmost cell is the unknown reading** — drawn deliberately, because the honest answer to an
   unrecognised status must never be "done".

## The Card Occupancy Audit

Read from `PhaseNodeCard.tsx` + `PhaseNode.tsx` on 2026-08-04.

| Position | Status | Owner |
|---|---|---|
| top-right (`right:17 top:11`) | **TAKEN** | the `⛨` seal. Claimed by SPEC Req 6, **never conditional on run state** — pinned twice, by a `?raw` props fence and a four-run-state render assertion. 188 may not take it back. |
| left edge (`-left-2 top-1.5`) | **TAKEN** | the server verdict mark. Transient — exists only once the server returned a problem. |
| badge slot 2 | **TAKEN** | `Waits for you`, word-only, no glyph, `llm_human_input` only. |
| badge slot 1 | free | empty, reserved for 188/189. **A third badge is a typecheck error** — `BadgeSlots` is a max-2 tuple union. |
| `stepNumber` | free | declared, renders nothing. At `x 12…34 / y 12…34`. |
| `technicalLine` | free | declared, renders nothing. Phase 187 chose the *subtitle* for the ⌥ reveal precisely to leave this to 188. |
| the 62×62 icon well | free | claimed by nothing. |
| the card **border** | **anticipated** | the card's own docblock: *"when a step goes running / needs-you / failed the status colour overwrites the card border."* The border is already 188's — the question is what goes **with** it. |

**Two invariants no variant may break:** a third badge is a typecheck error, and **no focusable control
may live inside the card** — one tab stop per node is a canvas-level invariant, which is why both the seal
and the verdict mark are `pointer-events-none`.

## Findings This Sketch Produces

### 1. The collision — the same four words already mean something else

`Waits for you` ships **today** as badge slot 2. It is a **design-time** fact: this step *will* pause,
true whether or not anything has ever run. SC#1 asks for a **run-time** state: this step is paused *right
now* and nothing moves until you act.

Sketch 146's alignment pass already ruled that **"running" and "waiting for you" may never share a word**.
This is the same defect one turn inward: the *will-wait* badge and the *is-waiting* state must not share
one either. Not previously written down anywhere.

### 2. Two of the seven readings do not come from `status` at all

| Reading | Source | Survives reload? |
|---|---|---|
| Waiting for you | `pendingAsk != null` — **not a status value**; the Phase union has no such member | only if the prompt row is re-read |
| Retrying | `status = "retrying"` — **live stream only** | **NO** — `workflow_phases_status_check` is `pending｜active｜completed｜failed｜skipped`; a reload restores it as *running* |

`retrying` having no database representation is a real constraint on SC#4, not a rendering detail.
Sketch 154 draws the loss.

### 3. The fail-open this must not inherit

`StreamsProvider.tsx:3337` reads `DB_PHASE_STATUS[r.status] ?? "done"`. All five DB values are mapped
today, so it is unreachable — but the fallback for an *unrecognised* status is **"done"**, precisely the
reading SC#3 forbids. Same shape as the `findIndex → -1` fail-open that painted an unknown `blocked_stage`
as 8/8 green in the publish gauntlet. **The fix is one word: fall back to an explicit unknown, never to success.**

### 4. The status vocabulary already exists — and it is not on the canvas

**Found on 2026-08-05, on a second icon-convention pass, *after* the first draft of this sketch had
already invented a set of lane glyphs.** That is the exact failure §4 exists to catch, so it is recorded
rather than quietly fixed.

`PhaseCard.tsx:67-79` ships **`STATUS_META`** — every one of the six phase statuses already carries a
**glyph + real text + an AA-contrast colour token**, built explicitly as non-colour-alone for WCAG 1.4.1.
That is the *developer* timeline: the very view 188's canvas is meant to be the business twin of, painted
from the same stream. A second invented set would put **two vocabularies on one run**.

| Status | Shipped | Word | Canvas can inherit? |
|---|---|---|---|
| `running` | `●` | Running | yes, verbatim |
| `done` | `✓` | Complete | yes, verbatim |
| `failed` | `✕` | Failed | yes — and it agrees with `VERDICT_MARK.error`, same mark, same news |
| `retrying` | `↻` | Attempt *N* | the mark yes; **the state cannot survive a reload** |
| `pending` | `○` | **Locked** | the mark yes, **the word no** — "Locked" is a harness word for "the engine has not unlocked this step"; beside a governance rail that also says *locked*, it reads as a permission |
| `skipped` | `⤳` | Skipped | **NO** — `⤳` is already the on-fail `skip_to_phase` **branch edge** on the canvas (`PhaseNode.tsx:257`, `PhaseSpineGraph.tsx:250`). One surface, one glyph, two meanings |
| *waiting for you* | — | — | nothing to inherit — there is no such status |

**And a second wording split in the same place:** `PhaseCard` labels an `llm_human_input` step
**"Needs you"** (`:48`); the canvas badge says **"Waits for you"** (`PhaseNode.tsx:177`). Two views of one
run, two words for one concept — neither wrong, decided independently, and **188 is the first phase that
has to make them agree**, because it is the first to show both views of the same run.

*Noted while auditing, not 188's to fix:* `PhaseCard`'s `PHASE_TYPE_LABEL` still carries the flat
`⚙ ✎ 🤖 ⛓ ☺` glyphs Phase 127 retired in favour of the shared 3D map, and lists only five types — so
`llm_emit` falls through to `•` "Step".

## Glyph Audit (icon-convention §4)

**Corrected 2026-08-05.** The first draft failed this audit in three ways, all now fixed:

| Was | Why it was wrong | Now |
|---|---|---|
| C's notch used eight invented glyphs | `STATUS_META` already ships six of them — *a sketch that invents a glyph teaches the wrong vocabulary to whoever builds from it* | inherits `● ✓ ✕ ↻ ○` verbatim; the two it cannot inherit render with a **violet `net-new` tag on screen** |
| B put `✕` on the card for "failed" | §4 reserves `＋`/`✕` for add/remove **on the lane, never the card** | B now always shows the step **number** — truer to B's own proposition (*the frame shape carries state, the number says which step*) and drift-free |
| The verdict mark drew `!` | `VERDICT_MARK.error` ships `✕` (`nodePresentation.ts:176`) | `✕` |

**Inherited:** `⛨` (`PhaseNodeCard.tsx:440`) · `● ✓ ✕ ↻ ○` (`STATUS_META`) · `?` (`VERDICT_MARK.unknown`,
"Could not be checked").

**Net-new, flagged as proposals both in this README and visibly on the page:**

| Mark | Proposed meaning | Why nothing could be inherited |
|---|---|---|
| `‖` | waiting for you | no status entry exists — the state derives from `pendingAsk` |
| `⋯` | skipped, **on the canvas** | `⤳` is taken here; it is the on-fail branch |

**Variant A uses no glyph at all** — it is pure geometry. That is an argument in its favour under the
same rule that gives the shipped `Waits for you` badge no glyph: *the word carries the meaning; tone is
decoration.* `◆` appears only as the `icon3d()` fallback if the 3D asset fails to load, never as a mark.
