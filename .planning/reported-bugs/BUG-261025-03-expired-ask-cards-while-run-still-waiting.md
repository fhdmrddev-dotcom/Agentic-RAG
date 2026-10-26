---
id: BUG-261025-03
title: A run waiting on a person shows several EXPIRED ask cards while its header still says waiting and Running
reported: 2026-10-25
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/harness, frontend/panel, human-input]
folded_into: "296"
verified_closed_by: null
related_seeds: []
re_open_trigger: "CLOSE when 296-HUMAN-UAT G-4 scenario 4 reads PASS with evidence (set status closed, verified_closed_by \"296\", re_open_trigger null). A FAIL routes back to its owning 296 plan under G-7."
fixed_by_commit: "296-02 backend: RED 0d3d4d8d0, GREEN bf8a4467b (a boot pauses a waiting run, never re-asks); 296-04 UI: RED e93dbecbb, GREEN fd59d0f19 (one ask per live workflow run; a passed clock on a live run reads paused)"
reproduces_on:
  branch: develop
  commit: b8aed8884
  date: 2026-10-25
---

# BUG-261025-03: A run waiting on a person shows several EXPIRED ask cards while its header still says waiting and Running

## What we observed

Phase 293 (live drive and G-4 step 3). Run `1e932094-5f46-4d55-95fb-786c92f63b0a` ("295-07 S6 approve then
wrap", started with an API key) asked "Approve the note?" with a 600 s timeout. Before the operator
pressed Stop, the right-hand panel showed three cards reading "EXPIRED · No response within 10:00 — agent
stopped", plus a live "NEEDS YOU" card, while the run page header said "Still waiting on fhdmrd@gmail.com
(you)" and the status read Running. The database still had `workflow_runs.status = 'active'` well past
the first expiry (checked at about 12:12 UTC for a run started 11:59 UTC). Screenshot at the time:
`evidence/ui/ui-keyRunWaiting.png` in the 293 phase folder (one expired card then).

## Why it matters

The surfaces contradict each other: "expired, agent stopped" next to "still waiting" and "Running". A
person cannot tell whether answering will do anything.

## Hypothesized cause

Hypothesis, not verified: when a human-input step's ask expires, the step re-asks (a new pending ask)
without the run being marked stopped, and the panel keeps every expired ask card; the "agent stopped"
wording comes from the chat ask_user expiry and does not match what the harness does next.

## Surface classification

`Agentic-RAG`: the harness human-input step and the workspace panel.

## Suggested routing

- **Fold into in-flight phase:** n/a (logged at the operator's direction during 293 G-4, not fixed)
- **Defer to future phase / milestone:** the next phase touching human-input steps or the ask card
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Answer within the timeout, or press Stop on the run page.

## Reference / evidence links

- `.planning/phases/293-start-from-outside-and-close-out/293-VALIDATION.md` §"Logged bugs"
- `.planning/phases/293-start-from-outside-and-close-out/evidence/ui/ui-keyRunWaiting.png`
