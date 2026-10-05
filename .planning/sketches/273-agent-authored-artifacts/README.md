---
sketch: 273
name: agent-authored-artifacts
question: "How does an agent-authored artifact (chart, table, metric from a closed registry) sit in a chat answer, show where its data came from across follow-ups, and fail without ever leaking a spec?"
winner: "1B (framed card) · 2A (one metric tile) · 3A (lineage caption) · 4B (explicit notice) + live render — operator, 2026-10-03"
tags: [phase-273, artifacts, chart, table, metric, show_artifact, provenance, follow-up, failure-notice, g2-sketch-gate]
---

# Sketch 273: Agent-Authored Artifacts

The G-2 sketch for Phase 273 (ART-01..05). The decisions already locked in `273-CONTEXT.md` (D-01..D-21) are:

- the `show_artifact` tool;
- chart kinds line, bar (grouped or stacked), area and scatter, with no pie;
- a block after the answer text;
- a server-derived source caption;
- re-encoding by reference with a new immutable artifact each time;
- a 500-row cap that refuses above it;
- the model gets the chance to fix a bad spec before the notice appears.

The reference is Claude.ai artifacts: content first, minimal chrome.

## How to View

Run `python -m http.server 8273` from `.planning/sketches/`, then open
`http://127.0.0.1:8273/273-agent-authored-artifacts/index.html` (or open `index.html` directly).

Top bar: **Screen** (1-4) × **Variant** (A / B), plus **State** on Screen 4. Screens 2-4 reuse the
frame chosen on Screen 1.

## Variants

| Screen | A | B |
|---|---|---|
| 1 Artifact in the answer | Borderless, in the reading flow: title, legend, chart, caption | Framed card: header with title + kind chip, caption footer with a doc icon |
| 2 The three components | Metric = one tile | Metric = a strip of 1-4 tiles (**changes the metric spec**) |
| 3 Follow-up chain | Lineage caption line: "Redrawn from chart 1 · same 16 rows" | "↑ from chart 1" chip that scrolls to and flashes the source |
| 4 States | Quiet one-line notice | Explicit dashed box: title, reason, "rest of the answer is unaffected" |

Screen 4 states: chart arrives while the text is still streaming · skeleton until the stream ends ·
unknown kind (pie) · bad props on reload · agent-supplied values · over 500 rows (refused, aggregated,
retried).

## Data viz

The categorical palette is `#3987e5 #d95926 #199e70 #c98500` (dataviz reference dark steps). It was
validated with `validate_palette.js --mode dark --surface #0d1017`, and **all checks pass** (worst
adjacent CVD ΔE 8.4, normal-vision 19.8, every slot at or above 3:1). Scatter is capped at 3 series
(the all-pairs rule). Other choices:

- 2px lines; bars with 4px rounded tops and a 2px gap.
- Direct labels on lines in text ink, not series colour.
- One axis.
- The legend is hidden for a single series.
- A crosshair tooltip on line/area, a band tooltip on bar, a nearest-point tooltip on scatter.

## What to Look For

- **Screen 1:**
  - Does B's card frame read as "a thing the agent made" without feeling like a dashboard?
  - Does A stay calmer in a long thread?
- **Screen 2:**
  - Do chart, table and metric look like one family?
  - Is the metric strip (B) worth a spec change, or is one tile enough?
- **Screen 3:**
  - Can you tell, without scrolling, that charts 2 and 3 used **no new retrieval** (one rail step) and **which rows** they kept?
- **Screen 4:**
  - Is the notice findable but not alarming?
  - Live vs skeleton: does the chart arriving under still-streaming text feel jumpy?

## Verified before handoff

Every screen, variant and state was driven in Chrome:

- every chart's SVG fills;
- the hover tooltips show values (scatter on a point);
- toggling a legend entry drops the series and keeps its colour;
- table sort works (descending puts $702K first);
- no screen shows raw JSON;
- **0 console errors**.

## Winners

Operator, 2026-10-03:

- **Screen 1: B, the framed card.** Header with title + kind chip; a caption footer with the doc icon and the server-derived source.
- **Screen 2: A, one metric tile per artifact.** The metric spec stays single-value (value, label, unit, optional delta). Several metrics are several artifacts.
- **Screen 3: A, the lineage caption.** A follow-up's caption states its rows in words:
  - "Redrawn from chart 1 · same 16 rows"
  - "From chart 1 · filtered to quarter = Q3 · 4 of 16 rows"

  Each artifact carries a "chart N" chip as its in-thread label.
- **Screen 4: B, the explicit notice, plus live render.**
  - The notice is a dashed box: "This artifact can't be shown", one plain reason, and "The rest of the answer is unaffected."
  - The chart renders as soon as it arrives, under still-streaming text. No skeleton.
