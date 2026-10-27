---
seed_id: SEED-381
title: The two server lock paths disagree about a paused workflow run (F2 backstop vs the send-path check)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names backend/app/api/threads.py's F2 backstop or the send-path lock check (services/workflow_kickoff.py preflight), or a UAT row where a paused run's composer accepts a send that then 409s.
trigger_paths: ["backend/app/api/threads.py", "backend/app/services/workflow_kickoff.py", "frontend/src/providers/StreamsProvider.tsx"]
trigger_surfaces: ["chat", "workflow"]
migration_note:
relates_to: ["296-INVENTORY 295-RES-c", "295-08-SUMMARY lines 120-121", "295-10 88698c121 (wording fix, D-r1-03)", "295-VERIFICATION line 87"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-381: Paused-run composer lock — the server paths disagree

## The finding

The F2 backstop in `api/threads.py` marks the thread lock stale whenever the producer `runs` row is
terminal. The send-path lock check reads only `workflow_runs.status`. For a PAUSED workflow run they
disagree: the composer unlocks, and a send then meets the paused-run 409. 295-10 (`88698c121`) worded
that 409 (live PASS, 295 round 2 row 6), so nobody is misled, but the disagreement stands.

## Why it matters

A person can type into a composer that will refuse them. The words now explain why; the two paths
should still agree.

## When to surface

Any change to the F2 backstop or the send-path lock check.

## Scope estimate

Small to medium. Two named options (295-08): exempt `paused` in the F2 backstop (the composer stays
locked, and the client lock seed treats it like the cap pause), or keep it unlocked and keep the
worded 409.

## Breadcrumbs

- 295-08-SUMMARY "Server lock semantics"; 295-VERIFICATION residual table.
