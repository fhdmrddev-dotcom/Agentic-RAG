---
sketch: 008
name: phase-timeline
question: "What does a live harness run look like IN THE PANEL — the run's REAL steps and tasks, not a spinner?"
winner: "D"
tags: [panel, harness, timeline, legibility, a11y, phase-094]
---

# Sketch 008: Phase Timeline

## Design Question
This is the operator's **#1 acceptance bar** for Phase 094, verbatim:
> "Show the workflow's REAL steps and real tasks — transparency, not a spinner."

Today the chat shows "Setting up agent…" then a pulsing icon, then the full answer at once,
because every harness lifecycle event (`phase_started`, `phase_completed`, `phase_transition`,
`gate_failed`, `run_completed`, `run_failed`) is emitted on the wire but **dropped by `api.ts`**
(BRIEF §1.2 — "wire-only"). This sketch is fundamentally about **rendering those dropped events**
as a live, honest, accessible phase timeline in the workspace panel.

## How to View
open .planning/sketches/008-phase-timeline/index.html

Use the **state cycler** (bottom-right toolbar): `Running · Gate retry · Failed · Done`.
Switch variants with the top tabs. The content is the **real** `literature_review`-on-DBA
storyboard (BRIEF §3.5): split → 4 subtopics, review → 4 agents / 6 searches / 16 tool calls /
48 sources, merge → integrated review.

## Variants
- **A: Span timeline** — a vertical spine (Temporal / Inngest reading). Each phase is a node with
  a status glyph, an outcome-colored bar, type tag, tool chips, and honest counts. The `review`
  phase's 4 sub-agents nest as indented child rows. Reads as a *pipeline run*.
- **B: RunCard-per-phase** — each phase is its own card reusing our existing **RunCard** frame
  (Cursor agent reading). Active/failed cards auto-expand to show sub-agents; completed cards
  collapse to a one-line summary (`✓ Review · 4 agents · 48 src · 12.3s ▸`). Closest to the
  D-094-UNIFY goal since Deep already uses RunCard — one component, two drivers.
- **C: Stepper + event log** — a compact top stepper (plan-as-progress-bar, GitHub Actions
  reading) + a plain-language "doing now" line + an expandable **event log** showing the real
  faithfully-named event stream for drill-down. At-a-glance plan, detail on demand.
- **D: Synthesis ★ (cards on spine)** — B's collapsible RunCards threaded onto A's vertical
  spine. The spine "fills" green through completed phases, turns amber at the active phase, and
  goes dashed-dim for locked-ahead — so you *feel* the locked, ordered, escape-proof pipeline
  (A's best quality) while keeping the familiar RunCard frame, collapse-to-summary, and rich
  in-phase tool detail (B's reuse + D-094-UNIFY fit). Built after the A-vs-B trade-off discussion.

## What to Look For
- **The spinner-killer:** does it instantly read what the agent *did*, is *doing*, and what's
  *queued* — with real counts, never a fake percentage?
- **5 real states** (not just done/pending): complete (green ✓) · running (amber pulse) ·
  **locked-ahead** (gray dashed — the lock is legible) · failed (red, reason-bearing) ·
  retrying (purple ↻ "attempt N"). Color is reinforcement, never the only signal.
- **Failed-as-failed (RC-4 fix):** flip to `Failed` — the run shows *which* phase failed and
  *why* ("Employee engagement reached its 12-step cap"), never an empty/done card.
- **Fan-out legibility (the ghost-avatar fix):** the 4 sub-agents read as real child rows with
  their own state + counts, not stacked empty avatars.
- **Gate rendering:** flip to `Gate retry` — even though the 4 shipped seeds have no active gates,
  authored workflows (013) can, so the timeline must render a gate-fail/retry state.

## Honesty notes (so we don't over-promise)
- Sub-agent *internal* `tool_start/tool_end` fire on the **sub-agent's** stream, not the harness
  producer stream (BRIEF §1.5). The per-agent counts shown here are aggregate; live per-tool
  drill-down inside a phase would need 093/094 to thread those events up. Flagged for planning.
- `gate_passed` is **audit-only** (never on the wire) — a passed gate is inferred from the phase
  advancing, which is what these variants do.
