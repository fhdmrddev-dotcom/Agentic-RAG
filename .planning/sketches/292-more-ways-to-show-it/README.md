---
sketch: 292
name: more-ways-to-show-it
question: "Which new artifact types earn a place in the closed registry (SC#1), and how should each one look inside the shipped 273 card frame?"
winner: "Set: diagram · comparison · timeline (steps out) · 2A top-down flow · 3A matrix · 4A vertical rail — operator, 2026-10-24"
tags: [phase-292, vis-02, seed-337, artifacts, diagram, comparison, timeline, steps, show_artifact, g2-sketch-gate]
---

# Sketch 292: More Ways to Show It

The G-2 sketch for Phase 292 (VIS-02). Roadmap SC#1 says the new artifact set is **chosen at sketch
time**, so Screen 1 is the decision itself. Everything reuses the shipped 273 contract:

- the framed card;
- the kind chip and the `name N` chip;
- the server-derived caption;
- the amber refusal step, then the dashed notice.

Sandboxed HTML (SEED-337 direction B) is out of scope and needs its own operator decision.

## How to View

Run `python -m http.server 8292` from `.planning/sketches/`, then open
`http://127.0.0.1:8292/292-more-ways-to-show-it/index.html` (or open `index.html` directly).

The top bar has **Screen** (1-5), with **Variant** A / B on screens 2-4 and **State** on Screen 5.
The bottom-right toolbar switches the viewport.

## Screens and variants

| Screen | A | B |
|---|---|---|
| 1 The set | Each candidate in the 273 frame, with its reason and the spec the model fills. **In the set** toggles it, and the sticky bar shows the resulting registry and the tool count (30). | — |
| 2 Diagram | Top-down flow; our layered layout; the spec has no lanes | Swimlanes by owner; the spec gains `lane` per node; it is wider than the chat column, so it scrolls sideways |
| 3 Comparison | Matrix, with options as columns and an "Only terms that differ" toggle | One card per option, with a ✓ / ✗ / ? tally |
| 4 Timeline | Vertical rail with compressed gaps, a Today line and "in N days" on the deadline | Horizontal axis on true time; click a point to see its detail panel |
| 5 Refusals | States: unknown type then retried · unknown type then notice · too many nodes then grouped · bad saved data on reload · reload of the same artifact | — |

## Proposed set (Screen 1 default)

- **In:**
  - **diagram:** explains how things connect.
  - **comparison:** "compare A and B", with a per-cell verdict and a visible "not stated".
  - **timeline:** dated events that have no number to chart.
- **Undecided:** **steps.** It adds a source per step, but a markdown list gets close.
- **Rejected, with reasons on the page:**
  - code block and rich document;
  - pie or donut, and a KPI grid (both decided in 273);
  - image (SEED-194);
  - map;
  - sandboxed HTML.

## Data contracts shown

- **Diagram:**
  - The spec is `nodes[{id,label,kind,lane?}]` and `edges[{from,to,label?}]`, with at most 25 nodes.
  - ⛔ The model sends no coordinates and no SVG; layout is our code.
  - Back edges (loops) are detected and drawn dashed.
- **Comparison:**
  - Each cell's verdict is `y|n|m|q`, and the glyph *shape* carries it.
  - The caption says the verdicts are the agent's reading.
  - Hovering a cell shows the clause.
- **Timeline:**
  - Each event carries a date, title, detail, category, source and an optional deadline flag.
  - Future events are drawn hollow. "Today" is computed by our code, not supplied by the model.
- **Source per element:**
  - The model cites a retrieved chunk.
  - The server resolves it to a document and page. The model never writes a source.

## What to Look For

1. **Screen 1.** Is this the right closed set? Does each "earns its place" reason hold? Is Steps in or out?
2. **Screen 2.** Does the top-down flow carry the process well enough that lanes aren't worth a spec field and a sideways scroll?
3. **Screen 3.** At 3 options × 7 terms, is the matrix or the cards faster for answering "which one is easiest to leave"?
4. **Screen 4.** Is the vertical rail calmer in a long thread? Or does true-time spacing (B) matter more for contract history?
5. **Screen 5.** Do the refusals read the same as 273's for chart/table/metric?

## Verified before handoff

Every screen, variant and state was driven in Chrome (`python -m http.server 8292`):

- the diagram draws 8 nodes and 9 edges in both layouts;
- hovering a node lights its 3 edges and shows the source clause;
- the comparison has 21 cells in both variants, and each shows its clause on hover;
- the vertical timeline has 13 rows (9 events, 3 gaps, Today);
- the horizontal timeline has 9 points;
- the notice states show no `{` or `}` text;
- **0 console errors**.

## Winners

Operator, 2026-10-24:

- **Screen 1, the closed set: `diagram` · `comparison` · `timeline`.** Steps is **out**. This was the
  default set; the operator did not toggle it. The registry goes from 3 to 6 components, and the tool
  count stays 30.
- **Screen 2: A, the top-down flow.** The spec carries no `lane` field. Our layered layout ranks the
  nodes by longest path and draws loops as dashed back edges on the right. It fits the chat column
  at every viewport, so it never scrolls sideways.
- **Screen 3: A, the matrix.**
  - The options are columns and the terms are rows, with an "Only terms that differ" toggle.
  - Every cell shows a verdict glyph (✓ ✗ – ?) plus short text. A clause on hover.
  - "Not stated" is shown in italics, never left as a blank.
  - The caption's second line says the verdicts are the agent's reading.
- **Screen 4: A, the vertical rail.**
  - Gaps of 6 months or more show as a labelled dashed segment.
  - Our code inserts a **Today** row that splits past from upcoming.
  - Upcoming dots are hollow. A deadline gets an amber ring and an "in N days" pill.
- **Screen 5: the 273 refusal rules carry over unchanged.** The model first gets a worded refusal
  (an amber step in the rail) and can retry. Only then does the dashed notice appear. It never shows
  JSON or a spec key.
