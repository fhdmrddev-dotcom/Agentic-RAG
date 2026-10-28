---
seed_id: SEED-394
title: A published workflow cannot move to another organization
created: 2026-10-28
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: A published workflow is found in the wrong organization, or any phase touches the workflow_definitions_block_published_update trigger or names org_move.py with a published-workflow requirement.
trigger_paths: ["backend/app/services/org_move.py", "supabase/migrations/*block_published*", "backend/app/services/harness/publish_service.py"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: ["backend/app/services/org_move.py", "298-03", "D-31", "D-19", "SEED-393", "298-RESEARCH.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-394: A published workflow cannot move to another organization

## The finding

The per-item org move (`backend/app/services/org_move.py`, Phase 298 plan 298-03) moves a
**draft** workflow only. A published, starter or system-global workflow is refused with a worded
reason ("“Brief” is published, and published workflows can't move to another organization yet.
Switch to its organization to use it there.").

The database blocks it as well. `workflow_definitions_block_published_update`
(`supabase/full-schema.sql`, trigger `workflow_definitions_block_published`) raises on **any**
change to a published row, `org_id` included. D-31 decided not to loosen the publish lock at a
measured mis-stamp count of 0, so migration 217 only adds the audit action type.

298-RESEARCH.md §"Workflow definition" has a ready shape for the trigger amendment: allow an
`org_id`-only change when `current_setting('app.org_move', true) = 'on'` and
`current_user NOT IN ('anon','authenticated')`, set inside the move transaction (the
`workflow_runs_origin_immutable` role-guard precedent, mig 215). It also needs REVOKE from PUBLIC
then GRANT to service_role, and a sync of `scripts/full-schema-supplement.sql`.

## Why it matters

Nobody yet. A published workflow in the wrong org still appears in the elsewhere count, and Switch
reaches it. The cost appears when an author needs a published workflow to run in another org
without republishing it there. Republishing there gives a new version history, and the old runs
stay with the old row.

## When to surface

- a published workflow is found in the wrong organization (a real report, not a fixture);
- any phase that touches the `workflow_definitions_block_published_update` trigger function;
- any phase that names `org_move.py` with a published-workflow requirement.

## Scope estimate

Medium. It needs one migration (trigger amendment + grants + supplement sync), a decision for
every version of the slug (the run log treats a workflow as all versions of its slug), and
dispositions for `workflow_schedules` (CASCADE FK, carries `org_id`), API keys that list the
workflow, and live runs. Each of those is already a draft-move refusal in `org_move.py`.

## Breadcrumbs

- D-31 (amends D-19): "published workflows are NOT movable in v1 … a seed records the published move".
- 298-RESEARCH.md §"Migration 217 trigger amendment (shape)", Pitfall 3.
- `org_move.s_published` and `test_refused_published_workflow` (live) pin today's refusal.
