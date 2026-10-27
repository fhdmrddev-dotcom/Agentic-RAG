---
id: BUG-261020-12
title: A run waiting for an action-risk approval is recorded as a failed run
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/harness, workflows/action-risk]
folded_into: "295"
verified_closed_by: "295"
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
fixed_by_commit: "80fc12e76 (295-03: an armed approval pauses durably) and bfe4e49ac (295-04, RUN-04); closed by the 296-05 record flip"
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-12: A run waiting for an action-risk approval is recorded as a failed run

## What we observed

**7** local `run_failed` events have the reason *"validation flagged: action_risk:approval ... The run is waiting"* and **0** `validator_ask_user_approved` events for the same runs. Dates: 2026-07-31, 2026-08-27, and 5 on 2026-09-12.

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

The run's own words say it is waiting, but its status says failed.

## Hypothesized cause

This may already be fixed by Phase 288 (pauses that publish). Verify before building anything. Hypothesis.

## Surface classification

Agentic-RAG: the workflow engine in this app.

## Phase 295 record (295-07, 2026-10-21)

Addressed by 295-03 (the armed approval is a durable pause) and 295-04 (a Stop ends `cancelled` with `Stopped by <name>.`). Live in `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md` S7: the armed run read `Paused for your answer`, and its Stop read `Cancelled` + `Why it stopped: Stopped by the person who started this run.` ⚠ In the chat panel the waiting approval card is shown RETIRED (S1 finding). Not closed.
