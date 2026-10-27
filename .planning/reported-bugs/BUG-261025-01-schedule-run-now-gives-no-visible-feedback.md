---
id: BUG-261025-01
title: The schedules window's Run now starts the run but shows no visible feedback
reported: 2026-10-25
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/workflows, schedules]
folded_into: "296"
verified_closed_by: "296"
related_seeds: []
re_open_trigger: null
fixed_by_commit: "296-04: RED c563f4ad0, GREEN 9c6b3403c (row-local spinner + result line); 296-02 3a6d7aae8 (ScheduleTriggerResult.outcome)"
reproduces_on:
  branch: develop
  commit: b8aed8884
  date: 2026-10-25
---

# BUG-261025-01: The schedules window's Run now starts the run but shows no visible feedback

## What we observed

Phase 293 G-4 step 4 (orchestrator drove it in Chrome, operator watching): on the "293 board: deepseek"
card, ⋯ → Schedules → ▷ Run now on schedule "293 weekly check". Nothing visible changed: no toast, no
link to the run. The run did start: `f22440aa-371e-4031-a773-b3875db08048`, origin schedule
"293 weekly check", and its page reads "📅 Started by schedule 293 weekly check".

## Why it matters

The person cannot tell whether the click did anything, so they are likely to press it again and start
a second run.

## Hypothesized cause

Hypothesis, not verified: `WorkflowScheduleModal.tsx` `onRunNow` (from 204-03, `fa80b5a71`) does set a
notice ("Started. It runs in the background — open the run log to watch it."), rendered at the bottom of
the dialog as `data-testid="schedule-notice"` in 12px muted text. It is likely below the fold or too
quiet to be noticed, and it carries no link to the run it started.

## Surface classification

`Agentic-RAG`: the app's own schedules window.

## Suggested routing

- **Fold into in-flight phase:** n/a (logged at the operator's direction during 293 G-4, not fixed)
- **Defer to future phase / milestone:** the next phase that touches the schedules window
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Open the workflow's run log after pressing Run now.

## Reference / evidence links

- `.planning/phases/293-start-from-outside-and-close-out/293-VALIDATION.md` §3 (G4-4) and §"Logged bugs"

## Closed 2026-10-27 (296)

Verified closed by G-4 scenario 5 in `.planning/phases/296-close-v4-7-debt/296-HUMAN-UAT.md` (PASS with evidence under `evidence/g4/`). Status was `folded`.
