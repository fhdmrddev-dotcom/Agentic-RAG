---
id: BUG-261020-11
title: Failed runs carry no recorded reason
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/harness, backend/audit]
folded_into: "295"
verified_closed_by: "295"
related_seeds: [SEED-295, SEED-152]
re_open_trigger: null
fixed_by_commit: "bfe4e49ac (fix(295-04): every run ends with a recorded reason, RUN-04); 296-02 ba6bc4f64 worded the remaining re-drive reason (295-IN-07); closed by the 296-05 record flip"
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

## Phase 295 record (295-07, 2026-10-21)

Addressed by 295-04 (F2 and golden-run `run_failed`, the reconciler's reason, the test_214 seed fix) and 295-05 (the no-reason sentence on the run read and the evidence page). Live in `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md` S7: Q-9b now returns 5 rows (the 15 fixtures are gone); each reads `No reason was recorded when this run failed.` Not closed (verifier's call).
