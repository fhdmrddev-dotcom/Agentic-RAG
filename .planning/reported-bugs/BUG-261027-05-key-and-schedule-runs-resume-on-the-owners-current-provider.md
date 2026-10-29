---
id: BUG-261027-05
title: A paused key-started or scheduled run resumes on the owner's current default provider, not the one it started on
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)
affected_areas: ['backend/harness', 'backend/runs']
folded_into: "300"
verified_closed_by: null
related_seeds: ['SEED-362']
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch backend/app/services/unattended_launch.py or backend/app/services/harness/publish_service.py; found by the v4.7 close integration check, outside 296's inventory"
reproduces_on:
  branch: develop
  commit: 7e2c3e5bd
  date: 2026-10-27
---

# BUG-261027-05: Key and schedule runs resume on the owner's current provider

## What we observed

Static trace at the v4.7 close (not driven). SEED-362 / 296 made a resumed run read the provider recorded at kickoff (`workflow_runs.metadata.provider`): in-app starts pass it (`api/threads.py:2089` → `db/workflows.py:548-551`). The unattended launch (`services/unattended_launch.py:181-192`, used by schedules and API keys) and the golden kickoff (`services/harness/publish_service.py:1710`) call `create_workflow_run` with no `provider=`, so a paused run of theirs resumes on the owner's default at answer time (`harness_engine.py:2597-2601`). If the owner changes their active provider between the pause and the answer, the run switches provider mid-run.

## Why it matters

SEED-362's promise ("a resumed run finishes on the model it started on") holds for in-app runs only.

## Hypothesized cause

296-06 wired the provider on the in-app door only. Fix shape: resolve and pass the launching owner's provider on the unattended and golden paths.

## Surface classification

Agentic-RAG (this app's run engine).
