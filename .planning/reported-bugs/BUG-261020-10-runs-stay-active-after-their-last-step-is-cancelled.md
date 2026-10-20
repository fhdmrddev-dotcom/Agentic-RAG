---
id: BUG-261020-10
title: Runs read active for a month after their last step was cancelled
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/harness, backend/run-reconciler]
folded_into: "295"
verified_closed_by: null
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-10: Runs read active for a month after their last step was cancelled

## What we observed

Two local runs: *200-Word Essay Writer* (created 2026-09-12) and *Knowledge Base Library Structure Summary* (2026-09-19). Their phases read `...:completed act:cancelled`, but `workflow_runs.status` still reads `active`, and `updated_at` was touched again on 2026-10-19/20.

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

The run looks like it is still working, forever.

## Hypothesized cause

A cancel path finalises the phase but not the run, or the reconciler re-touches the row without finalising it. Hypothesis.

## Surface classification

Agentic-RAG: the workflow engine in this app.
