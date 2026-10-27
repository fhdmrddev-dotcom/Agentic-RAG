---
seed_id: SEED-382
title: Back off a schedule whose every tick is refused, instead of refusing it again each time
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names backend/app/services/scheduler_service.py or backend/app/api/schedules.py, or a schedule's run history shows the same refusal on consecutive ticks.
trigger_paths: ["backend/app/services/scheduler_service.py", "backend/app/api/schedules.py", "frontend/src/components/workflows/WorkflowScheduleModal.tsx"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: ["296-INVENTORY 295-IN-05 (backoff)", "296-02 3a6d7aae8 (worded refusal + ScheduleTriggerResult.outcome)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-382: Back off a schedule refused on every tick

## The finding

When a scheduled workflow is refused at launch (for example its template lint fails), the scheduler
refuses it again on every tick. 296-02 (`3a6d7aae8`) fixed the words: Run now reports a refusal as a
refusal, never as a launch failure with raw text. A schedule that can never start still fires and is
refused forever.

## Why it matters

Noise in the run history and audit, and a person who does not open the schedule never learns it is
dead.

## When to surface

Any change to the scheduler or the schedule routes, or repeated refusals seen in history.

## Scope estimate

Small to medium: count consecutive refusals on the schedule row, pause it after N with a worded
reason, and show that on the schedule.

## Breadcrumbs

- 295-REVIEW IN-05; 296-02-SUMMARY row 295-IN-05.
