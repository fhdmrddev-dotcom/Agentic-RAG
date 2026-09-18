---
seed_id: SEED-111
title: Workflow delete + cascade lifecycle — a user-facing way to delete workflows (drafts and, safely, published) with cascade to dependent runs/threads
status: open
planted: 2026-07-10
phase_origin: "Operator, during Phase 143 (Starter Workflow Library) discuss-phase: noted there is no delete functionality in the Workflows UI, and no cascade deletion. Agreed to seed it (lifecycle hygiene, unrelated to the starter shelf) rather than widen Phase 143."
category: product capability — workflow lifecycle / hygiene, deferred (small standalone phase)
related_seeds:
  - SEED-084-starter-workflow-library (the phase that surfaced this gap)
related_memories: []
priority: low
surface: Agentic-RAG
trigger_when: unset
---

# SEED-111 — workflow delete + cascade lifecycle (deferred)

## The finding (2026-07-10, Phase 143 discuss-phase)

The Workflows page (`frontend/src/pages/WorkflowsPage.tsx`) has **no user-facing delete affordance**:
- `DraftCard` → **Open** + **Publish…** only.
- `PublishedCard` → **Tweak** + **Run** only.

Backend `delete_workflow_definition` (`backend/app/db/workflows.py`) exists but is **drafts-only**
(`status='draft' AND created_by=$2`) and does **not cascade** to dependent `workflow_runs` /
threads; published rows are **frozen by the immutability-on-publish trigger** (mig 056) and cannot be
deleted at all. Net effect: abandoned drafts and orphaned runs **accumulate with no way to clean up**.

## Why deferred (not folded into Phase 143)

- It is **lifecycle hygiene**, orthogonal to the starter shelf (the Phase 143 deliverable). Folding a
  delete affordance + a cascade **threat model** (who can delete what; what a cascade removes;
  soft-vs-hard delete; RLS) into "one shelf section" would over-widen the STRETCH phase.
- The fresh-copy fork in 143 already lets a user own + edit their copy; **deleting** it is a separate
  capability that can land later without blocking anything 143 ships.

## Re-open trigger

Fire when **either**:
1. Orphaned drafts / abandoned runs become a **real annoyance** (the dev DB already shows ~30+ draft/
   test definitions — a "delete this draft" ask is likely), OR
2. A **Workflows lifecycle / UX** phase is scoped (a natural home for delete + sort + visual polish).

Surface at the `/gsd:new-milestone` sweep as a small standalone `/gsd:quick`-scale phase candidate.

## Implementation sketch (when promoted)

- Add a **Delete** affordance to `DraftCard` (and decide the policy for **published** rows —
  likely soft-archive/unpublish rather than hard-delete, given the immutability trigger + run history).
- Extend delete to **cascade** (or FK `ON DELETE`) to dependent `workflow_runs` / `workflow_phases`,
  or block delete while active runs exist — with an explicit **threat model** (owner-only, no
  cross-user delete, no existence leak — mirror the `delete_workflow_definition` 404-collapse
  precedent).
- Confirm the immutability trigger interaction (a published row currently raises `23514` on DELETE —
  decide unpublish-first vs a trigger exception path).

## Related
- Phase 143 CONTEXT `<deferred>` (this is the named landing).
- `backend/app/db/workflows.py` `delete_workflow_definition` (the drafts-only, no-cascade current state).
- `supabase/migrations/056_workflow_definitions.sql` (RLS + immutability-on-publish trigger).
