---
id: BUG-261106-03
title: A live workflow run is driven twice when a sibling backend worker restarts
reported: 2026-11-06
surface: Agentic-RAG
severity: high
status: open
affected_areas: [backend/harness-engine, backend/run-resume]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 2cc9b4845
  date: 2026-11-06
---

# BUG-261106-03: A live workflow run is driven twice when a sibling backend worker restarts

Found while verifying BUG-261106-01 on production (tester report, BUG-19 thread).

## What we observed

Two production runs in the last 30 days carry a `claimed_at`, and both logged two
`phase_started` events for step 1, the second at the claim instant:

| Run | Created (UTC) | Claimed | Gap |
|---|---|---|---|
| `0c8183fc` (tester RUN-007) | 05:05:13 | 05:06:53 | 1m40s |
| `dc6e4c56` | 12:19:54 | 12:20:17 | 23s |

Both copies ran to the end of the step. Each overwrote the other's `workflow_phases.output`
(6 citations became 3), both paid for model calls, and the second copy kept logging gate
failures after the run was already `failed`. Neither moment matches a deploy.

## Cause (verified in code and by a RED test against real Postgres)

`resume_stranded_workflows` runs in every worker's lifespan (`main.py`) and re-drives any
`active` run that has an `active` step. Its `claim_run` CAS only stops two SWEEPS racing: a
fresh run never takes a claim, so its live producer is indistinguishable from a dead one.
Production runs `uvicorn --workers 2`; uvicorn 0.32.1 restarts a worker that dies or misses a
5 s ping. When ONE worker restarts, its boot sweep claims the run the OTHER is still driving.

Why the worker restarted is not yet known (needs the Coolify log lines `Child process [...]
died` at 05:06:53 and 12:20:17 UTC). Whatever it was also dropped every request that worker
was serving.

## Fix (develop, not deployed)

- `harness/run_heartbeat.py`: a per-step context manager, entered beside
  `cancellation_watch` / `duration_watch`, that refreshes `workflow_runs.updated_at` every
  lease/5 s (60 s) while a step runs. Timer-driven, so a slow model keeps beating.
- `db/workflows.claim_run`: an `active` run is claimable only once its last beat is older
  than `harness_resume_lease_seconds`; `paused` runs are unchanged (answer route).
  `touch_run_liveness` writes the beat (`status = 'active'` only).
- `claimed_at` is deliberately NOT the heartbeat: it anchors the circuit breaker's duration
  cap and the run's displayed start.
- `main.py`: a late boot pass (`include_paused=False`) one lease + 30 s after boot, for a
  worker that died mid-run and whose own boot saw a still-fresh beat.
- Test: `backend/tests/unit/test_261106_run_heartbeat.py`.

Trade-off: a run whose worker died is resumed about 5.5 minutes after the restart instead of
at once. A deploy that overlaps a run on code without the heartbeat could still double it
once.

## Surface classification

Agentic-RAG: the app's own workflow engine.
