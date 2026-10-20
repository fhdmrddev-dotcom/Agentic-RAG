---
id: BUG-261020-07
title: A knowledge-base step that finds nothing, or answers without citation markers, fails the whole run
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/harness, workflows/citations-gate]
folded_into: "295"
verified_closed_by: null
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 46c23fe00
  date: 2026-10-20
---

# BUG-261020-07: A knowledge-base step that finds nothing, or answers without citation markers, fails the whole run

## What we observed

`citations_required` fails the step, retries, then fails the run. There is no pause and no way for the person to choose.

- **53** `gate_failed` events read *"nothing was retrieved (0 sources)"*. They hit 11 workflows, including *Knowledge Base Library Structure Summary* (20) and *Summarize DeepWiki structure and post to Slack* (9).
- **~22** more read *"0/1 citation markers in the answer"*. The answer may be correct, but the formatting was missing.
- **35 of 36** gate failures in the last 60 days are `citations_required`.
- Since 2026-09-01, local runs are **5 completed / 7 failed**.

Measured 2026-10-20 by read-only queries: local DB (287 runs, mostly operator testing plus UAT plants) and production (20 runs). Summary in memory `project_workflow_blocking_measured_20261020`.

## Why it matters

This is the main reason the operator reports that workflows "block most of the time". A governed step should stop a run from inventing sources, but a dead end with no next move is worse than an honest pause.

## Hypothesized cause

`ValidatorSpec.on_failure` already accepts `ask_user` (D-11), but the citations gate defaults to `fail_run`. Hypothesis: the fix is mostly a default and a worded pause, not new engine code. Some August "0 sources" runs may coincide with the local embedding switch that deleted vectors; that is unproven.

## Surface classification

Agentic-RAG: the workflow engine in this app.
