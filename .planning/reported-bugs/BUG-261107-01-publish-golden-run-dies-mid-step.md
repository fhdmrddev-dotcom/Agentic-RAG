---
id: BUG-261107-01
title: Publish's practice run dies mid-step on production; the request fails and the run is left "active" with no driver
reported: 2026-11-07
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [backend/harness/publish, backend/harness/golden-run, deploy/proxy]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 58d6363a9
  date: 2026-11-07
---

# BUG-261107-01: Publish's practice run dies mid-step on production

Tester report number: BUG-36 (Syrel-Testing-and-Bug-Report rev 5, publish test WF-P3).

## What we observed

- 2026-11-07 04:24:45 UTC, test org `5edbb089` ("My organization"), workflow `5004ff14-aeae-457f-bc2e-5bc40303749b`
  (AI-drafted, 5 steps, template TPL-HR-001), Publish with golden input `AFM-0431`.
- Golden run `e3f5fc12-d72b-42e1-a423-8a376e0c0cb6` (`is_golden_run=true`): step 1 completed 04:25:01 (15 s);
  step 2 `collect_hr_evidence` started 04:25:01 and **nothing happened after that**:
  - no `harness_audit` row after `phase_started` at 04:25:01.505;
  - `workflow_runs.updated_at` stayed at 04:25:01 for 8+ minutes, although `run_heartbeat`
    (BUG-261106-03, lease 300 s / 5 = 60 s beat) should advance it every 60 s while a step runs;
  - step 2's own `wall_clock_seconds: 300` never fired;
  - `claimed_at` stayed null (no boot or late sweep picked it up).
- The browser showed **"Publish request failed: Failed to fetch"** and the gauntlet reset.
- `GET /health` answered 200 in 113 ms throughout, so the API itself was up.
- Control, same workflow, same input, same model (deepseek-v4-flash), started by **Test Run** at 04:33:56
  (run `63b4a82f`): all 5 steps completed in 4m55s; step 2 took 57 s. So step 2 is not the problem; the
  publish path is.
- History: the last golden run that completed on production is 2026-09-11. No publish with a practice run
  has succeeded on production since then (only one golden run exists after that date: this one).

## Why it matters

Nothing can be published on production if its practice run takes longer than whatever cut the request.
Publish is the only route to the judge, so publish test WF-P3 (judge rejects a "guess if needed" fill
prompt) cannot run. The orphaned run is still `status='active'`; a future boot sweep may re-drive it.

## Hypothesized cause (NOT verified — needs the backend container logs for 04:24–04:33 UTC)

`publish_service.py:298` runs the whole golden run inside the HTTP request (`asyncio.wait_for`, budget
7200 s). Something ended that request about the time step 2 began:
1. A reverse-proxy idle/read timeout in front of `api.superrag.cloud` closes a request that sends no bytes
   for N seconds. The app has no `BaseHTTPMiddleware` (all middleware is pure ASGI), so a client disconnect
   alone should not cancel the handler. This only explains the dead run if the worker process died or
   the handler was cancelled.
2. The uvicorn worker running the request was killed or restarted (OOM, container health check). No
   heartbeat beat at all after step 2 started, which fits a dead process or a blocked event loop better
   than a cancelled task.
Either way, the fix direction is the same: publish should start the golden run as a background run (the
Test Run path, which works) and return a handle that the gauntlet polls. A request must not own the run.

## Surface classification

Agentic-RAG: the publish gauntlet and run driver are this app's code.
