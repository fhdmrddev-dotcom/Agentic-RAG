---
seed_id: SEED-324
title: POST /runs/{id}/continue accepts a run that is not cap_paused and re-runs it
created: 2026-09-29
surface: Agentic-RAG
status: partially-answered
partial: true
status_note: "Partially answered 2026-10-24 by Phase 292.1: terminal statuses now get 409 (a first-turn pause finalized completed is still accepted through run_is_cap_paused, 292.1-REVIEW CR-01); streaming is deliberately still accepted, because the cap_paused SSE event precedes the finalizer's status write, so a fast press legitimately sees streaming."
trigger_when: Any phase touching backend/app/api/runs.py continue_run or the run status lifecycle
trigger_paths: ["backend/app/api/runs.py", "backend/app/services/run_producer.py"]
trigger_surfaces: ["chat"]
migration_note:
relates_to: ["268", "268-UAT-LOG.md D-3", "SEED-323"]
folded_into: "292.1"
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

## 2026-10-24 — Partially answered by Phase 292.1

`continue_run` (`backend/app/api/runs.py`) now refuses a Deep run in a terminal status with **409**
("This run has already finished, so there is nothing to continue."), before the counter write and
the spawn. A first-turn pause finalizes `completed` with a carrier by design, so `completed` asks the
carrier-aware predicate `app.db.runs.run_is_cap_paused` first (292.1-REVIEW CR-01, `8d5ba6f1c`).

**Still accepted on purpose: `streaming`.** The `cap_paused` SSE event precedes the finalizer's
status write, so a fast Continue press legitimately sees `streaming`; refusing it would break the
button. That arm is why this seed is `partially-answered`, not `answered`. Workflow-run anchors keep
their own rule.
