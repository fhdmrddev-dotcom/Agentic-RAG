---
id: BUG-260712-02
title: User message renders as two identical bubbles on send (optimistic temp + persisted row both survive reconcile)
reported: 2026-07-12
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/streaming, frontend/chat, frontend/workflow-run-surface]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4116b063
  date: 2026-07-12
---

# BUG-260712-02: User message renders as two identical bubbles on send

## What we observed

- Sending a prompt in chat shows the user's message as **two identical user bubbles**,
  while the backend correctly runs a **single** turn (run card says `turn 1`, one run,
  one answer). Observed live on cloud production 2026-07-12 (fresh thread, deepseek,
  during the sandbox-fix verification — screenshot evidence in that session) AND
  operator reports it happens **"all the time" locally** too — so it's a frontend
  rendering/merge issue, not a cloud or double-submit issue.
- Operator also reports the **workflow chat surface** doubles "sometimes yes, sometimes
  no" — intermittent, consistent with a race (see hypothesis) rather than a
  deterministic double-render.
- The duplicate persists for the life of the view (it was still doubled after the run
  completed); switching threads / reloading clears it (the reconcile with no send in
  flight drops the temp).

## Why it matters

Cosmetic but **constant and user-visible on the primary surface** (every chat send).
Makes the app look buggy in demos and erodes trust in run honesty ("did it send twice?
am I being billed twice?"). Severity `minor` because no data or behavior is wrong —
exactly one message is persisted and one run executes.

## Hypothesized cause

(Hypothesis from code reading, not yet verified with instrumentation.)

`frontend/src/providers/StreamsProvider.tsx`:

1. `sendMessage` (~L1751) appends an **optimistic user message** with `id: makeTempId()`
   and **no `runId`** to the bucket, synchronously before `postMessage` resolves.
2. The snapshot/reconcile merge (`setMessagesForBucket` in the `getSnapshot` handler,
   ~L1429–1460) deliberately **preserves untyped temps** (temps without a `runId`)
   whenever `sendingThreadsRef.current.has(threadId)` — the Phase 075.7 protection
   against the pre-stamp placeholder race that used to blank fresh threads.
3. If a snapshot/reconcile lands **after the server has persisted the user row but
   while the send is still in flight** (the normal case — the run streams for many
   seconds), the merged bucket contains BOTH the persisted user row (from
   `snapshot.messages`) AND the optimistic user temp → two identical bubbles. There is
   **no content-level dedup for user-role temps** — the dedup work done for the
   assistant side (BUG-260609-03, BUG-260626-01: runId-bearing temps dropped once the
   DB holds the same runId) never got a user-side equivalent, because user temps carry
   no runId to match on.
4. Intermittency on the workflow surface fits the race: whether a reconcile fires
   inside the in-flight window (Realtime nudge, `setViewingThread`, watchdog probe)
   decides whether you see one bubble or two.

**Fix direction (for the owning phase):** give the optimistic user temp a matchable
identity — e.g. send a client-generated `client_msg_id` with `postMessage`, persist it,
and drop the temp when the snapshot contains a row bearing it; or as a narrower patch,
drop an untyped user temp when the snapshot already holds a user row with identical
content newer than the temp's `created_at`. Must NOT reintroduce the 075.7 blank-thread
race (the preserve-guard exists for a reason) — the fix is "dedup against the snapshot",
never "stop preserving temps".

## Surface classification

`Agentic-RAG` — our frontend chat surface, all providers, local + cloud. Routing
candidate at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (149 is provider-registry scoped; don't widen)
- **Defer to future phase / milestone:** first v3.3+ phase touching the chat surface /
  `StreamsProvider.tsx` (note: StreamsProvider is a G-5 hot-file — pairs naturally with
  any planned chat-surface work; could also ride a `/gsd:quick` alongside
  BUG-260712-01 killed-workflow-empty-chat-card since both are chat-bubble honesty)
- **Plant as seed:** no — concrete bug, concrete fix direction
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Switch away and back to the thread (or reload) — the next reconcile with no send in
flight filters the untyped temp and the duplicate disappears. Nothing is double-sent;
safe to ignore.

## Reference / evidence links

- Observed live: cloud verification chat 2026-07-12 ("Run python code to plot a sine
  wave…" — two user bubbles, single `turn 1` run, one answer, one `sine_wave.png`)
- Code: `frontend/src/providers/StreamsProvider.tsx` — optimistic user msg ~L1751;
  preserve-guard merge ~L1429; assistant-side dedup precedents at the BUG-260609-03 and
  BUG-260626-01 comments
- Related (assistant-side twins, already fixed): BUG-260609-03, BUG-260626-01
- Related (workflow chat-card honesty, same neighborhood): BUG-260712-01
  (`killed-workflow-empty-chat-card.md`)
