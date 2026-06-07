---
seed_id: SEED-065
title: Degradation under heavy concurrent load — Redis-read timeout, cross-tab latency, slow reconcile (diagnose real-vs-dev-artifact first)
status: planted
planted: 2026-06-07
phase_origin: Phase 096 live UAT (Test 3 stream-cap storm + Test 4 conc_probe) — operator-run + script, DB-verified
category: B/C — needs a diagnosis spike BEFORE any fix (operator-approved routing 2026-06-07); may split into a real fix + a "dev-box artifact, no action" finding
severity: major (unverified portion may be lower once dev-artifact is separated)
related_seeds: [SEED-063, SEED-064, SEED-036a]
relates_to:
  - "`scripts/conc_probe.py` PROBE_RESULT FAIL — cross_tab_latency: snapshot p95=8563ms / list p95=2644ms (budget 50ms); fanout_bounded PASS; PROBE_BUDGET total=200 peak_borrowed=5 (threadpool NOT starved)"
  - "deepseek-v4-pro run failed: `TimeoutError: Timeout reading from localhost:6379` under the storm"
  - "operator: 'new chat hung' after 4th chat; 3 chats rendered empty then loaded correctly (self-healed) — reconcile/snapshot latency"
  - "Decision D-v2.5-01 (no blocking I/O in async handlers; run_in_threadpool) — prime suspect for event-loop blocking under load"
  - "WORKER_COUNT=2 production default — the UAT ran single-worker `--reload` (dev artifact suspect)"
re_open_triggers:
  - The diagnosis spike for the 096-UAT load findings is scheduled
  - Any production deployment / load-testing milestone (this is a precondition data point)
  - SEED-036a AnyIO threadpool sizing work is opened
  - cross_tab_latency or Redis-timeout symptoms recur on a production-config run
priority: medium — investigate before committing to a fix; do NOT band-aid
suggested_phase: diagnosis spike first (re-run on WORKER_COUNT=2, no --reload, bounded sandboxes), THEN a fix phase only for the confirmed-real portion
---

# SEED-065 — Load degradation (diagnose before fixing)

## What happened (Phase 096 live UAT, 2026-06-07)

Under ≥6 concurrent heavy chats (plus 8+ unbounded sandbox containers from
SEED-063), the platform degraded:
- **deepseek** chat failed with `Timeout reading from localhost:6379` (Redis
  socket_timeout exceeded under contention).
- **conc_probe.py** cross_tab_latency FAIL: an idle thread's GET /snapshot p95
  hit 8.5s (budget 50ms) while a fan-out streamed. `PROBE_BUDGET` showed the
  AnyIO threadpool was NOT starved (5/200 borrowed) — so the bottleneck is
  elsewhere (event-loop blocking, Redis contention, or single-worker dev).
- **UI**: "new chat hung" after the 4th chat; 3 chats rendered empty then
  loaded correctly after a delay (reconcile self-healed — no data loss).

## Why this is "diagnose first," not "fix now"

The UAT ran on a heavily-overloaded dev box: single-worker uvicorn `--reload`
(NOT the WORKER_COUNT=2 production default) + 8+ unbounded sandboxes pegging CPU
(SEED-063). Some of the degradation is genuinely the platform; some is dev-box
artifact. Band-aiding before separating the two risks fixing a phantom.

## Spike plan (the diagnosis)

1. Fix SEED-063 (sandbox timeout) + SEED-064 first so the storm is bounded.
2. Re-run `conc_probe.py` AND the ≥6-run storm on **WORKER_COUNT=2, no
   --reload**, with bounded sandbox concurrency.
3. If cross_tab_latency still FAILs → real bug: hunt event-loop-blocking sync
   I/O in async handlers (D-v2.5-01), Redis connection-pool sizing, snapshot
   query cost. If it PASSes → the original FAIL was dev-artifact; record and
   close that portion.
4. Feed the AnyIO/sandbox sizing conclusion into SEED-036a.

## Vibe-coder plain summary

When many heavy chats ran at once on an already-overloaded laptop, the app got
slow and one chat hit a Redis timeout. Some of that is just the test machine
being maxed out (single worker, 8 runaway sandboxes); some might be a real
slowdown in how we serve requests during streaming. Before fixing anything, we
re-test on a proper setup to see what's actually broken versus what was just the
overloaded laptop — so we don't chase a ghost.
