---
seed_id: SEED-383
title: Decide whether intermediate files (chart PNGs) are listed beside the final document a turn produced
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator rules on the intermediates policy, or the next phase that changes how execute_code output files are recorded (services/tools/sandbox.py) or listed (OutputFileCard / the output-files hero).
trigger_paths: ["backend/app/services/tools/sandbox.py", "frontend/src/components/chat/OutputFileCard.tsx", "frontend/src/components/panel/FilesSection.tsx"]
trigger_surfaces: ["chat", "sandbox", "panel"]
migration_note:
relates_to: ["296-CONTEXT D-10", "BUG-261024-04 (intermediates half)", "296-06 0ad717a67 (lead 2 fixed)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-383: Intermediate PNGs beside the final document

## The finding

When a turn makes "a PDF with 3 charts", the chart PNGs the code wrote on the way are listed as output
files beside the PDF. 296 D-10 split BUG-261024-04: the DEFECT (a follow-up turn re-showing every
prior turn's files) was fixed in 296-06 (`0ad717a67`, lead 2); the POLICY (should intermediates be
listed at all) is this seed.

## Why it matters

The person asked for one document and sees four files. Some want the charts; most do not.

## When to surface

An operator ruling, or a change to how output files are recorded or listed.

## Scope estimate

Small to medium: a rule (e.g. files referenced by the final document are intermediates), plus a
"show working files" fold.

## Breadcrumbs

- BUG-261024-04 report; 296-06-SUMMARY lead 1 / lead 2 verdicts.
