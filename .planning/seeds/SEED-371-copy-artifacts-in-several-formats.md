---
seed_id: SEED-371
title: Copy any artifact (chart, diagram, table, timeline, comparison) in several formats from a Copy button
created: 2026-10-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase that touches the artifact frame (frontend/src/components/chat/artifacts/**), or the next /gsd:new-milestone sweep."
trigger_paths: ["frontend/src/components/chat/artifacts/**"]
trigger_surfaces: ["chat"]
migration_note:
relates_to: ["Phase 273 (artifact frame)", "Phase 292 (diagram / comparison / timeline)", "SEED-337"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-371: Copy any artifact in several formats

## The finding

Operator ask, 2026-10-24: every artifact card that can be copied should carry a **Copy** button with a choice of formats, the way Claude.ai's artifacts do.

Candidate formats per type (to be chosen at a sketch, G-2):
- **chart / diagram / timeline / comparison:** PNG (rendered image), SVG (vector), and for the diagram a Mermaid or text outline.
- **table / comparison:** CSV, Markdown table, and TSV (pastes into Excel / Sheets).
- **metric:** plain text value with its label and unit.

## Why it matters

Today the only way to reuse an artifact is a screenshot or asking the agent to regenerate it as a file. A copy menu turns an in-chat answer into something that pastes straight into a deck, a doc or a spreadsheet.

## Notes for scoping

- It's frontend-only and works from the persisted spec. It never asks the model, and the 273/292 render code is the single source.
- PNG and SVG come from the rendered card. Recharts and our diagram SVG are already SVG.
- Keep it inside the 273 frame (one toolbar affordance), no new dependency unless a sketch proves it necessary.
