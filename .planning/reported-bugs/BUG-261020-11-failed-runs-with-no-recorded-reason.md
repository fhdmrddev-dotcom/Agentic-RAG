---
id: BUG-261020-11
title: Failed runs carry no recorded reason
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/harness, backend/audit]
folded_into: "295"
verified_closed_by: null
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-11: Failed runs carry no recorded reason

## What we observed

**20** local runs have `status = failed` with no `run_failed` audit event and an empty `metadata`: 5 in 2026-06 and 15 in 2026-08.

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

The person sees *failed* with no *why*. The 289 evidence page cannot explain these runs.

## Hypothesized cause

These runs failed through a path that does not write `run_failed`. It may be older code; the most recent date needs checking. Hypothesis.

## Surface classification

Agentic-RAG: the workflow engine in this app.
