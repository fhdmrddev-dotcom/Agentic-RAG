---
seed_id: SEED-067
title: New-chat / thread-select hangs ~5-7s — frontend latency that scales with thread count
status: planted
planted: 2026-06-07
phase_origin: Phase 096 post-fix operator observation (during SEED-064 verification) — DB-timed
category: B/C — real frontend perf characteristic; diagnose under the SEED-065 latency family
severity: minor (annoyance, not data loss) — but degrades as threads accumulate
related_seeds: [SEED-065]
relates_to:
  - "`frontend/src/hooks/useThreads.ts:36` newThread = createThread (0.06s) → setThreads([new,...prev]) → setSelectedThread — the backend POST is NOT the hang"
  - "Backend timing measured 2026-06-07: POST /threads 0.06s, GET messages 0.08s, GET workflow 0.05s, GET /threads (list 159) 0.05s — ALL sub-100ms"
  - "Suspect frontend path: setSelectedThread → setViewingThread → reconcile + enforceStreamPool + writeSnapshotToLocalStorage (streamsCache.ts), and/or NavPanel re-rendering 158 rows"
  - "Local DB had 158 threads (≈nearly all eval/smoke/probe/sse-diff test debris) at observation time"
re_open_triggers:
  - The SEED-065 load-degradation spike runs (fold this in — same latency family, frontend angle)
  - New-chat / thread-switch latency is reported again after debris cleanup (proves it's thread-count scaling, not just debris volume)
  - Any phase touching useThreads, StreamsProvider reconcile/stream-pool, streamsCache, or NavPanel render perf
  - Production / multi-user scale work (real users WILL accumulate hundreds of threads)
priority: low now (dev-debris-amplified) / medium at scale
suggested_phase: fold into the SEED-065 diagnosis spike (frontend perf trace) — or a focused thread-list virtualization/perf phase if confirmed
---

# SEED-067 — New-chat / thread-select frontend latency

## What the operator saw (2026-06-07, during SEED-064 verification)

Clicking "+ New" hangs ~5–7s before the empty chat appears. NOT caused by the
SEED-064 Stop-button work (the newThread → createThread → select path is
untouched by it; its additions are O(1)-per-row Set lookups).

## Evidence (measured, not guessed)

- **Backend is fast**: every new-chat call is sub-100ms, including listing all
  159 threads (0.05s). So the 5–7s is entirely FRONTEND-side, after
  `createThread` resolves.
- **0 active runs** at observation time — not streaming/load contention.
- **158 threads** in the local DB — overwhelmingly eval/smoke/probe/sse-diff/
  benchmark test debris accumulated across development; 15 are empty "New Chat"
  shells.

## Hypothesis (to confirm via the spike)

A thread-select side effect scales with thread count — likely one (or more) of:
`reconcile` / `enforceStreamPool` work, a synchronous `writeSnapshotToLocalStorage`
JSON.stringify over cached threads, or NavPanel re-rendering 158 rows
synchronously. 158 threads should NOT cost 5–7s in a well-built list → there's a
real inefficiency, merely amplified by the debris volume.

## Cleanup performed (2026-06-07)

Pruned 66 unambiguous infra-test threads via DELETE /threads/{id} (eval workflow,
restart-smoke, conc-probe, sse-diff, Python Sorting Benchmark / Sleep Delay,
"Use the code tool in three separate steps", Initial Greeting, 14 empty New-Chat
shells). **158 → 92 threads.** Operator re-test of New Chat latency pending — the
result tells us whether the hang is thread-count scaling (faster now) or a
count-independent frontend cost (still slow → prioritize the trace).

## Two-step plan

1. **Immediate relief + cause test**: prune the unambiguous test-debris threads
   (eval/restart-smoke/conc-probe/sse-diff/benchmark/empty shells). If the hang
   vanishes at ~10–20 real threads → confirms thread-count scaling AND declutters
   the app. (Band-aid; the underlying scaling stays.)
2. **Root-cause** (SEED-065 spike): capture a ~7s DevTools Performance trace
   while clicking New Chat → the slow frame names the exact function. Fix the
   hot path (memoize/virtualize the thread list, cap/async the snapshot cache,
   or defer reconcile work).

## Vibe-coder plain summary

Making a new chat waits ~5–7 seconds before it appears. The server is NOT slow
(it answers in well under a tenth of a second) — the delay is in the browser
app, and it's not the Stop-button change. You've got 158 chats, almost all
leftover test junk from building the features. Step one: delete the junk chats
(should make it snappy again and tidy your list). Step two: if it's still slow
with few chats, we record a quick browser performance trace to find and fix the
exact slow spot.
