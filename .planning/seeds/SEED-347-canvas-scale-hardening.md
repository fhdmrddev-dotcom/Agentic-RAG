---
seed_id: SEED-347
title: Canvas scale hardening (SCALE-01) — virtualise large canvases, index the org Workflows list, branching layout — deferred by design in v3.6 (Phase 191), held by no seed
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Measured, not estimated — any one of: (1) a real workflow definition exceeds 100 phases; (2) the org Workflows list endpoint p95 exceeds ~500 ms or EXPLAIN shows a sequential scan; (3) llm_batch_agents fan-out must be drawn as a branching graph; (4) a user reports canvas lag on a workflow they authored."
trigger_paths: ["frontend/src/components/workflows/WorkflowCanvas.tsx", "frontend/src/components/workflows/canvasModel.ts", "backend/app/api/workflows.py", "backend/app/db/workflows.py"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: [".planning/v3.6-STRETCH-CARRYFORWARD.md § 191", "docs/history/v3.6-visual-no-code-workflow-studio.md", "D-14 (canvas is a projection, never a second runtime)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-347: canvas scale hardening

## The finding

v3.6 STRETCH Phase 191 (SCALE-01) was never built, on purpose. The ROADMAP scoped it as conditional: *ship
only if a real workflow or org fan-out exceeds the expected small scale.* At close, real workflows had 5-50
phases against a ~100-150 node threshold. Three independent deliverables:
1. React Flow `onlyRenderVisibleElements` plus node memoisation;
2. indexed org-scoped Workflows-list reads;
3. `elkjs` auto-layout, only if fan-out must be drawn as a branch.

The concrete re-open triggers are written in `.planning/v3.6-STRETCH-CARRYFORWARD.md` (including the SQL to
count phases, which must unwrap the JSON string scalar: `((definition #>> '{}')::jsonb)->'phases'`). No seed
pointed at that file until now, and carry-forward files are swept by nothing.

## Why it matters

Not yet. This seed exists so that the first large workflow or slow Workflows list triggers a known plan
instead of an improvised one.

## When to surface

Only when one of the four measured triggers fires. Do not revive it on a schedule.

## Scope estimate

Small to Medium per half. Ship only the half whose trigger fired. `WorkflowCanvas.tsx` is a G-5 hot file;
virtualisation must not create node state that exists only in the renderer; layout stays computed, never
persisted.

## Breadcrumbs

- `.planning/v3.6-STRETCH-CARRYFORWARD.md` lines 27-85
- `docs/history/v3.6-...md` status row "Canvas scale hardening (SCALE-01): deferred, never built"
