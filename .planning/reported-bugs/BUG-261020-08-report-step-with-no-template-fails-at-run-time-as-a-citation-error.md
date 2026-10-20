---
id: BUG-261020-08
title: A report step with no template bound fails at run time, reported as a citation error
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/harness, workflows/emit, workflows/authoring]
folded_into: "295"
verified_closed_by: null
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-08: A report step with no template bound fails at run time, reported as a citation error

## What we observed

`emit_failed` reads `integrity_verdict.failure = "no_template_bound"`. The gate then fails with *"citations_required: no field_map on output"* and the run fails after 2 attempts. This happened **10** times locally, and twice in production (*Risk Register* 2026-08-09, *Compliance Gap Report* 2026-10-01).

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

The author is told the wrong cause, a citation problem, for a configuration they could have fixed before running.

## Hypothesized cause

A missing template is knowable when the workflow is saved or published; nothing refuses it there. Hypothesis.

## Surface classification

Agentic-RAG: the workflow engine in this app.
