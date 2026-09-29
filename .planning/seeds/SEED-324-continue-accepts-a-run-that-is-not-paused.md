---
seed_id: SEED-324
title: POST /runs/{id}/continue accepts a run that is not cap_paused and re-runs it
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching backend/app/api/runs.py continue_run or the run status lifecycle
trigger_paths: ["backend/app/api/runs.py", "backend/app/services/run_producer.py"]
trigger_surfaces: ["chat"]
migration_note:
relates_to: ["268", "268-UAT-LOG.md D-3", "SEED-323"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-324: Continue does not check the run is paused

## The finding

`continue_run` (`backend/app/api/runs.py`) reads the run's `status` but never requires
`cap_paused`. On 2026-09-29 a Continue on a `failed` run answered `200 ok` and spawned a
continuation segment.

## Why it matters

The UI only offers Continue on a paused run, so today only a direct API call reaches it. But it
lets a finished or failed run be re-driven, spending tokens, up to the Continue cap. Since the D-2
fix, that cap is at least counted.

## When to surface

Any phase whose `files_modified` touches `backend/app/api/runs.py`.

## Scope estimate

Small: one status check returning a refusal. Workflow-run anchors carry `status: None` and need
their own rule.

## Breadcrumbs

268-UAT-LOG.md § "SC#1-continued — live drive 2026-09-29" (D-3).
