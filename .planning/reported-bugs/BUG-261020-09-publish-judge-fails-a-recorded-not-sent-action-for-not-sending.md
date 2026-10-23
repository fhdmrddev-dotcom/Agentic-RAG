---
id: BUG-261020-09
title: The publish judge fails a workflow because its recorded-not-sent action did not send
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/publish-gauntlet, workflows/external-action]
folded_into: "295"
verified_closed_by: null
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-09: The publish judge fails a workflow because its recorded-not-sent action did not send

## What we observed

**4** `publish_blocked` events at `blocked_stage: judge`, 2 of them in production (2026-08-26, *DMT Project Status Summary & Email*). The judge's evidence, quoted: *"No email was sent ... This is a record of an intention, not a receipt"*. Criterion score **0**.

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

Recording without sending is designed behaviour (D-12/D-16). The judge punishes it, so such a workflow can never publish.

## Hypothesized cause

The judge prompt is not told what an `external_action` step is designed to produce. Hypothesis.

## Surface classification

Agentic-RAG: the workflow engine in this app.

## Phase 295 record (295-07, 2026-10-21)

Addressed by 295-02 (the recorded-intent judge note, `_DESIGN_NOTES`). Live in `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md` SC#3 after / S5: the DMT draft `edd81b32` published, and the judge summary now grades the email's content. One sample; not closed (verifier's call).
