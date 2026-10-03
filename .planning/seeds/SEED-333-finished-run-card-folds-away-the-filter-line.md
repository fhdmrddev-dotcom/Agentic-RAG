---
seed_id: SEED-333
title: A finished run card folds to "done", so the search card's "Filtered: …" line is one click away at rest
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Phase 273 planning (the operator routed it there on 2026-10-03), or the next phase whose files_modified names RunCard.tsx, ToolCallPanel.tsx or StepRow.tsx.
trigger_paths: ["frontend/src/components/chat/RunCard.tsx", "frontend/src/components/chat/ToolCallPanel.tsx", "frontend/src/components/chat/StepRow.tsx"]
trigger_surfaces: ["chat"]
migration_note:
relates_to: ["272-VALIDATION.md §4 G4-1 (finding F-1)", "272-CONTEXT.md D-08", "OV-266-01 (tooltip-only note was invisible)", "SEED-153"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-333: A finished run card hides the filter line at rest

## The finding

Phase 272 (D-08) put the applied filter on the search tool card as one visible line, for example
`Filtered: document date 1–31 Oct 2025`. The line is plain text, not a tooltip, so it meets D-08.
The G-4 drive found a gap in how it is reached. Once a run finishes, `RunCard.tsx` folds the card
to `✓ done`, and the step rows (with their `Filtered:` lines) are not in the DOM until the person
clicks the status row. At rest, a reader sees the answer and the citations but not the scope that
produced them.

Measured on 2026-10-03 in real Chromium, G4-1 (thread `6cfb82df`): the line is absent from the
at-rest DOM (`evidence/g4-1-dom.txt`), and after one click it is present and visible at 659×20 px
(`evidence/g4-1-runcard-open-dom.txt`, `g4-1-runcard-open.png`). The fold predates 272. RunCard was
last changed at `c570922f4` (Phase 257), and 272 did not touch it.

## Why it matters

D-08 exists because a filter the reader cannot see cannot be checked: "close means wrong" holds only
if a person can confirm the answer came from October and not March. One click is not a tooltip
(OV-266-01), but the filter is still hidden behind a step that most readers will not take after a
run that says `done`. Nobody has lost data over this. It is a legibility gap on the one surface
that shows what was searched.

## When to surface

At Phase 273 planning, where the operator routed it on 2026-10-03 (272-05 Task 4 ruling: *"Accept,
plant a seed"*). Also at any phase whose `files_modified` names `RunCard.tsx`, `ToolCallPanel.tsx`
or `StepRow.tsx`.

## Scope estimate

Small to medium. Options, in rough order of cost: (1) when a finished run's search carried a
filter, show the applied-filter line in the folded summary row; (2) keep a filtered run unfolded at
rest; (3) put the filter beside the References header. Each changes a G-5-firing chat file
(`RunCard.tsx` has a hot-file ledger row), so G-2 (sketch before plan) and G-4 (lived-experience
UAT) apply.

## Breadcrumbs

- 272-05 G-4 drive (commit `9c6cfdeb5`): `272-UAT-LOG.md` "G-4 drive", `272-VALIDATION.md` §4 G4-1.
- Operator ruling on F-1, 2026-10-03: accept for 272 and plant a seed, routed to Phase 273.
