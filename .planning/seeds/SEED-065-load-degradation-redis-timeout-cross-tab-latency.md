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

## Spike result (2026-06-07 — calm-machine re-run, single-worker --reload)

`conc_probe.py` re-run on a CALM backend (0 active runs, 92 threads, no storm):
**cross_tab_latency STILL FAIL** — snapshot p95=2667ms max=6635ms; list p95=774ms
(budget 50ms). fanout_bounded PASS. PROBE_BUDGET total=200 **peak_borrowed=6**
(threadpool NOT starved). per_worker_run_count=1.

CONCLUSION: **NOT a dev/storm artifact — a REAL backend issue.** The MEDIAN stays
~50ms while the p95/max explode to seconds → INTERMITTENT EVENT-LOOP BLOCKING
during the fan-out (synchronous work on the async loop, a D-v2.5-01 violation),
NOT threadpool exhaustion (6/200) and NOT load. Suspected site: the
llm_batch_agents fan-out sub-agents' search_documents path (query embedding +
pgvector query via supabase-py) or harness batch execution running sync I/O on
the loop instead of run_in_threadpool. WORKER_COUNT=2 would likely MASK the
symptom at low concurrency (the idle request dodges the busy worker) but not fix
the underlying blocking — still worth an operator prod-config confirm run.

## Spike COMPLETE — two event-loop blockers found (2026-06-07)

The cross_tab_latency FAIL = real intermittent event-loop blocking. TWO distinct
sync-on-loop sources in the fan-out search+LLM path:

**Blocker A — sync embeddings (+ rerank) on the loop — FIXED ✅ + verified.**
`retrieval_service._vector_search:36` ran the SYNC OpenAI `embed_texts` HTTP call
directly on the loop (and `rerank` at :301 when enabled). Wrapped both in
`run_in_threadpool` (commit on retrieval_service.py). PROOF it worked: the
re-probe's GET /threads (`list`) p95 dropped **774ms → 69ms** (10×).

**Blocker B — sync LLM stream-CREATION on the loop — DIAGNOSED, DEFERRED.**
`provider_gateway/dispatcher.py:open_stream` is `async def` but calls the SYNC
branch builders `open_anthropic_stream` / `open_google_stream` /
`open_openai_compat_stream` (→ `client.chat.completions.create(stream=True)` etc.)
DIRECTLY on the loop (lines 94/104/115). Stream creation blocks until the model
starts responding (~0.5–2s); a 5-way `llm_batch_agents` fan-out stacks 5 of these
→ the residual snapshot p95≈3s (GET /threads/{id}/snapshot has 3 awaited
round-trips vs list's 1, so it hits a blocked window 3× more often → still FAILs).
NOTE: stream ITERATION is already correctly threadpooled (the main loop's
`_drain_stream_with_close_on_cancel` and the sub-agent's `_drain` both run
`for chunk in stream` via `run_in_executor`/`run_in_threadpool`) — only the
CREATE call is on the loop.

**Why B is deferred (not rushed):** `open_stream` is the shared streaming entry
for ALL 7 providers + Deep + Harness — the operator red line ("never break
working things, all providers"). The fix is the same `run_in_threadpool` pattern
and is LOW-RISK in principle (the stream is ALREADY created on one thread and
iterated on another today, so no new thread-affinity assumption) — BUT it touches
every provider's hot path and interacts with langsmith `_TracedStream` trace
contextvars (which don't propagate to threadpool threads), so it needs a
deliberate change + full cross-provider UAT, not a marathon-session edit.

**Proposed B fix (next session):** wrap each branch in `open_stream`:
`stream = await run_in_threadpool(open_<provider>_stream, request)`. Verify:
re-probe cross_tab_latency PASS (p95<50ms), cross-provider Deep+Harness streams
byte-identical, LangSmith traces still attached.

**Also:** WORKER_COUNT=2 (production default) would MASK much of the residual at
low concurrency (the idle request lands on the other worker) — an operator
prod-config probe run would quantify the real-world impact pre-B-fix.

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
