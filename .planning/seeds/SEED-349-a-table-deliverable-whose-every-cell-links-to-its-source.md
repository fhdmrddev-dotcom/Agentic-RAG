---
seed_id: SEED-349
title: Citation-traceable grid — a table or matrix deliverable where each cell links to the passage it came from; v2.9 STRETCH Phase 106 (GRID-01) never built
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "SEED-148's remaining halves ship (outputs visible on canvas and panel) AND a user asks to read or verify a matrix deliverable cell by cell; OR the next artifact-vocabulary phase (SEED-337) adds a table component; OR a workflow template produces a comparison matrix."
trigger_paths: ["frontend/src/components/chat/CitationPeek.tsx", "frontend/src/components/chat/OutputFileCard.tsx", "backend/app/services/citation_markers.py"]
trigger_surfaces: ["workflow", "chat", "retrieval"]
migration_note:
relates_to: [".planning/v2.9-STRETCH-CARRYFORWARD.md § 106", "SEED-148", "SEED-193", "SEED-337", "SEED-338", "docs/history/v2.9-workflow-studio.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-349: a table deliverable whose every cell links to its source

## The finding

v2.9 STRETCH Phase 106 (GRID-01) was a renderer for matrix-shaped deliverables (requirements matrices,
vendor comparisons, risk registers) where each cell carries its citation and can be opened. It was never
started. The history doc records it as "still open, re-scoped behind SEED-148". SEED-148 is about showing
produced files at all; it does not hold the grid itself. No seed did.

Since then v4.5 Phase 273 added agent-authored artifacts with a closed component vocabulary (charts,
tables; SEED-193 / SEED-337). That is likely the right substrate: a table component whose cells carry
citation markers, rather than a new renderer.

## Why it matters

Matrix deliverables are where verifying the source matters most and is hardest. A grid you can click
through is a strong trust feature for compliance and procurement workflows.

## When to surface

When outputs are visible everywhere (SEED-148) and a user asks to verify a matrix, or when the next
artifact-vocabulary phase adds or extends a table component.

## Scope estimate

Medium. Establish where the artefact is displayed first (carry-forward advice), then extend the table
component with per-cell citation markers reusing `CitationPeek`.

## Breadcrumbs

- `.planning/v2.9-STRETCH-CARRYFORWARD.md` lines 77-110
