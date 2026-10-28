---
id: BUG-261027-04
title: A scheduled run launches with a blank required input (the schedule door skips missing_required)
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: open
affected_areas: ['backend/schedules', 'backend/workflows']
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch backend/app/services/scheduler_service.py or backend/app/api/schedules.py; found by the v4.7 close integration check, outside 296's inventory"
reproduces_on:
  branch: develop
  commit: 7e2c3e5bd
  date: 2026-10-27
---

# BUG-261027-04: A scheduled run launches with a blank required input

## What we observed

Static trace at the v4.7 close (not driven). 296-06 made `missing_required` (`services/inbound_inputs.py:144`) the one predicate for "a required input is blank": in-app starts call it (`services/workflow_kickoff.py:266`, 422 before any write) and key starts call it (`services/inbound_inputs.py:217`). `launch_scheduled_run` (`services/scheduler_service.py:150-175`) and `POST /schedules` never call it; the only guard is client-side (`WorkflowScheduleModal.tsx:265`). A schedule saved before 296, or created by calling the API directly, with a blank required input still launches, and `launch_kickoff` simply omits that `key: value` line, so the first step runs without the input.

## Why it matters

An unattended run starts without information the author marked required, and nobody is there to notice.

## Hypothesized cause

The schedule door was not one of the two doors 296-06 wired. Fix shape: call `missing_required` at schedule create/update (worded 422) and at launch (skip with a recorded outcome).

## Surface classification

Agentic-RAG (this app's scheduler).
