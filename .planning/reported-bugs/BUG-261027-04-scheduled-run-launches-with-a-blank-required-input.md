---
id: BUG-261027-04
title: A scheduled run launches with a blank required input (the schedule door skips missing_required)
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)
affected_areas: ['backend/schedules', 'backend/workflows']
folded_into: "300"
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch backend/app/services/scheduler_service.py or backend/app/api/schedules.py; found by the v4.7 close integration check, outside 296's inventory"
status_note: >
  2026-10-30 (302 REG-08): stays folded -> 300. Fixed in code by 300-01 (FIX-04) and driven live: 300 G4-5
  PASS 2026-10-29 (Run now on the blank-input row reads "Didn't run — Client name is required and has no
  value. …"; last_status holds the sentence). NOT closed ahead of the phase: 300 is human_needed — owed rows
  G4-8 (email step, real mailbox) and the real-provider half of G4-1 (Resend deferred, 300-HUMAN-UAT.md:43).
  Close at 300's verification. Previous status line, verbatim: `status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)`.
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
