# Canvas Frame, Node Anatomy & Visual Language (Phase 183 / CANVAS-01)

What the canvas plane is, what a node IS, how the whole graph reads, and — decisively — what it all
looks like.

Synthesized from sketches **134**, **135** (structural findings only), **136** (winner B),
**137** (winner B).

---

## READ THIS FIRST — 137-B is the canvas visual language

**Sketches 134 and 135 have `winner: null` on purpose.** Operator review (2026-07-25) found their
variants too similar to tell apart, and the batch "too technical and visually basic" — it drew flat
text glyphs instead of the shared 3D `PHASE_GLYPHS` marks the icon convention requires.
**Sketch 137 is the visual redo.** What survives from 134/135 is their *structural* content: the
canvas frame inventory and the node contents inventory.

**Sketch 137 winner B — "Glass Depth"** (operator, 2026-07-26, changed from D). This is the canvas
visual language Phases 183–188 build on:

- The 3D mark **floats above** a narrower, **centre-aligned frosted panel**, with its own contact
  shadow.
- **No per-step-type colour at all.** Type colour is a tint *behind the icon only* — never a tile
  wash — because Phase 188 needs the strong colours for run status.
- Plain-language title + one supporting line + at most two word-badges.
- Motion keys off **run state**, never off selection.

### The shipped card is 137-B — and `themes/canvas-184.css` is NOT it

`canvas-184.css` encodes the older **137-D** language (left-floating icon, 300px card). **185-01
rebuilt the shipped card to 137-B.** Reasoning about the card from that stylesheet draws a card that
no longer exists. Always read `PhaseNodeCard.tsx`.

```
node box   260 × min 104        canvasModel.ts:62 CANVAS_LAYOUT
card       248 wide, centred, radius 22, padding 42/20/20, text-centre
3D mark    62×62 at left-1/2 top-[-26px]   (overflows the box upward by 26px)
seal       21×21 at top 11 / right 17      (11px clearance + 6px box inset)
verdict    22×22 at -left-2 top-1.5        (transient)
title      14px headline semibold, TRUNCATE
```

Nothing in this subtree may take `overflow: hidden` — the mark and the verdict both depend on
upward overflow.

---

## Decision — the flow runs HORIZONTAL, left → right (136-B)

The familiar builder direction (operator, 2026-07-25). The *visual treatment* of that flow is
superseded by 137-B; the **topology findings stand**:

- Only linear `i → i+1` edges plus dashed `skip_to_phase` failure branches.
- **No `depends_on`, no parallel lanes** — the canvas is a projection of a LINEAR spine, not a free
  DAG. The harness engine runs it linearly; the canvas must not imply otherwise.
- No dropped phase and no phantom edge — faithfulness to the definition is the acceptance bar.
- `llm_batch_agents` fan-out is a *phase type*, not a branching layout. (`elkjs` stays deferred to
  Phase 191 only if a real branching layout is ever needed.)

The `skip_to_phase` parse has ONE home — `phaseVocabulary.parseSkipTarget`, whose semantics are
EXACTLY the backend's `parse_skip_target` (slice the prefix **by length**, so
`skip_to_phase:a:b` → `a:b`). A shared fixture is read by both the vitest suite and
`test_183_skip_parse_parity.py`, so neither language can drift alone.

---

## Node anatomy — the budget, and why it is enforced by types

From 135's structural findings, as they landed after 183–185:

| Slot | Owner | Status |
|---|---|---|
| Title | `nodeTitle()` — layered ladder | see `node-vocabulary-and-reveal.md` |
| Supporting line | type subtitle | 149-C swaps this for technical detail |
| Badge slot 1 | **empty, reserved for 188 (run state) / 189 (external actions)** | do not fill |
| Badge slot 2 | `Waits for you`, `llm_human_input` only | word-only, tone primary |
| Top-right corner | **governance seal — permanently claimed** | see `graded-governance.md` |
| Left mark | server verdict — transient | 139-A |
| `technicalLine`, `status`, `stepNumber` | **reserved for Phase 188** | declared, deliberately not passed |

`BadgeSlots` is a **max-2 tuple union**, so a third badge is a *typecheck error* rather than a
review comment. `PhaseNodeCard`'s docblock states the rule: the WORD carries the meaning; tone is
decoration. The `waitsForYou` slot ships with **no glyph**.

**No focusable control may live inside the card.** One tab stop per node is a canvas-level
invariant — the ✕ and ＋ live on the lane, and arming/escalating happen in the side panel. *The
panel is where you SET; the canvas is where you SEE.*

---

## CSS Patterns

```css
/* the frosted card (137-B) */
.card {
  width: 248px; margin: 0 auto; min-height: 104px;
  border-radius: 22px; padding: 42px 20px 20px; text-align: center;
  background: hsl(220 30% 100% / .045); backdrop-filter: blur(8px);
  border: 1px solid var(--color-border-soft);
  box-shadow: 0 1px 0 hsl(220 30% 100% / .06) inset,
              0 18px 36px -22px rgba(0,0,0,.95);
}

/* THE COLOUR BUDGET: type colour is a tint behind the icon, and nothing more. */
.mark::before {                       /* the icon well */
  content: ''; position: absolute; inset: -3px; border-radius: 50%;
  background: radial-gradient(circle, var(--t, hsl(220 30% 100% / .18)), transparent 68%);
}
.mark::after {                        /* contact shadow — what makes it "float" */
  content: ''; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 36px; height: 8px; border-radius: 50%;
  background: rgba(0,0,0,.5); filter: blur(5px);
}
.mark svg { filter: drop-shadow(0 9px 13px rgba(0,0,0,.8)); }

/* per-type tints — icon well ONLY, never the card */
[data-type="llm_agent"]        { --t: hsl(239 90% 70% / .40); }
[data-type="llm_emit"]         { --t: hsl(258 90% 70% / .40); }
[data-type="programmatic"]     { --t: hsl(200 85% 62% / .36); }
[data-type="llm_batch_agents"] { --t: hsl(170 80% 55% / .34); }
[data-type="llm_human_input"]  { --t: hsl(38 92% 62% / .38); }
[data-type="llm_single"]       { --t: hsl(220 30% 100% / .22); }

/* the ambient plane backdrop — the 137 depth cue */
.amb::before { width: 520px; height: 520px; left: 6%;  top: -14%;
               background: hsl(239 84% 45% / .22); filter: blur(90px); }
.amb::after  { width: 460px; height: 460px; right: 4%; bottom: -18%;
               background: hsl(258 90% 50% / .16); filter: blur(90px); }
```

---

## What to Avoid

- **Never wash the card in the type colour.** Phase 188 owns the strong colours for run status.
- **Never draw the card from `themes/canvas-184.css`** — that is 137-D, superseded.
- **Never add a third badge** (it will not compile) or fill slot 1 — it belongs to 188/189.
- **Never put a focusable control on the card.**
- **Never take `overflow: hidden`** anywhere in the node subtree.
- **Never imply a DAG.** No `depends_on`, no parallel lanes, no free rewiring of order.
- **Never hand-draw a phase glyph** — one shared 3D map, always (`icon-convention.md`).
- **Never key motion off selection.** Motion keys off run state.

---

## Origin

Synthesized from sketches: **134**, **135** (structural findings; look superseded), **136**
(winner B — horizontal), **137** (winner B — Glass Depth; operator changed D→B 2026-07-26).
MANIFEST running decision **43** (icon convention) and the Phase 183–185 decision records.
Source files: `sources/136-flow-shape-and-branches/`, `sources/137-agentic-canvas-look/`
