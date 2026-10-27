---
seed_id: SEED-379
title: Show the deliverable's size and path on the run evidence report
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator asks for the deliverable's size or path on the report, or the next phase that changes the evidence payload (services/run_evidence.py) or the report's Deliverable fact.
trigger_paths: ["backend/app/services/run_evidence.py", "backend/app/api/workflow_run_evidence.py", "frontend/src/components/workflows/RunEvidenceReport.tsx"]
trigger_surfaces: ["workflow", "panel"]
migration_note:
relates_to: ["296-INVENTORY 289-F-E", "289-04-SUMMARY follow-up F-E"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-379: Deliverable size and path on the report

## The finding

The old run page listed the produced file with its name and size (289-04 row 13). The evidence report
shows the name only: the evidence payload carries no size, and the full path has no report
counterpart.

## Why it matters

Low. A reader can open the file. The operator asked for nothing yet; 289 recorded it as a follow-up.

## When to surface

The operator asks for it, or the evidence payload changes.

## Scope estimate

Small: one optional field on the evidence deliverable, read from `workspace_files`, and one fact line.

## Breadcrumbs

- 289-04-SUMMARY F-E; 289-05-SUMMARY follow-up list.
