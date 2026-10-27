---
seed_id: SEED-380
title: Let an API key start a workflow that has no declared inputs, by sending a typed task
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: An operator or customer asks to start a field-less workflow from the API, or the next phase that changes the inbound run body (backend/app/api/inbound.py / inbound_inputs.py) or the API-key workflow picker.
trigger_paths: ["backend/app/api/inbound.py", "backend/app/services/inbound_inputs.py", "backend/app/api/api_keys.py", "frontend/src/components/settings/apiKeys/apiKeysCopy.ts"]
trigger_surfaces: ["workflow", "settings"]
migration_note:
relates_to: ["296-INVENTORY 293-IN-06 (task field)", "296-06 04618f10e (needs_task state, refusal and picker reason)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-380: An inbound `task` field for zero-field workflows

## The finding

A workflow with no declared launch field starts in the browser from the typed `kickoff_prompt`. A key
call has no field for that text. 296-06 (`04618f10e`) made this honest: such a workflow reads
`needs_task` in the picker, `create_key` refuses it with `{name} starts from a typed task, which a
key can't send yet.`, and an inbound start refuses it with `needs_task`. Sending the task is a new
request field, so it was seeded (D-03).

## Why it matters

Field-less workflows cannot be automated from outside until this exists.

## When to surface

A request for it, or the next change to the inbound body.

## Scope estimate

Small to medium: one optional bounded `task` string on the inbound body, carried inside the untrusted
envelope (T-296-32), and the picker state lifted.

## Breadcrumbs

- 293 deferred-items IN-06; 296-06-SUMMARY row 293-IN-06.
