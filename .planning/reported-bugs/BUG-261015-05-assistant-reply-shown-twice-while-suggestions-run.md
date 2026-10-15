---
id: BUG-261015-05
title: The assistant reply shows twice (one finished, one still "Thinking…") until the run ends — visible for ~36 s on local models
reported: 2026-10-15
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat-messages, frontend/streams-reconcile, backend/agent-loop]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 2cb889701
  date: 2026-10-15
---

# BUG-261015-05: Assistant reply duplicated until the run closes

## What we observed

Reported by the operator, with a screenshot (`screenshots/Screenshot 2026-10-15 210124.png`, untracked):
*"in local models sometimes we see duplication and it is back to normal after some time"*.

The thread was `hi` (`f419e834-83a1-4cfb-af96-d106ae2a884b`), on `spark-x2.5-4b` / lmstudio. Screen at 17:01:24 UTC:

- One user bubble, "hi".
- **Two identical assistant replies.** The first shows a finished `Thinking` chip. The second shows `Thinking…`, a streaming cursor, the composer's Stop button, and "1 running" in the sidebar.

## What the database says (local DB, read-only)

| Row | Time (UTC) |
|---|---|
| user message `4a56ce7e…` | 17:00:24.279 |
| run `b19917c0…` started | 17:00:24.591 |
| **assistant message `b0873011…` saved** (the only assistant row) | **17:00:45.543** |
| **run completed** | **17:01:21.991** |

**Only one assistant message exists, so the duplicate is on screen only.** The run stays open for **36 s** after the reply is saved.

## Cause (read in code, not yet driven)

1. **The extra call:** `agent_loop.py:3545` saves the reply. Then `agent_loop.py:3574` awaits `generate_suggestions` before it emits `done`. That is an extra model call, placed before `done` on purpose (067.4). On a local model it takes tens of seconds; on cloud, about 1–2 s.
2. **The window:** in that window the saved row reaches the message list through a refetch or Realtime hint, while the live stream bubble for the same run is still mounted.
3. **The reset:** when `done` arrives, the live bubble is removed and the screen returns to normal.

This is the assistant-side twin of BUG-260712-02 (the optimistic user bubble plus the persisted row). **The real defect is the frontend reconcile:** a live bubble should yield as soon as the persisted message for its run exists. The slow suggestions call only widens the window.

## Why it matters

The person sees the answer twice and a run that looks stuck, for half a minute on every local-model turn.
It looks like a double send, which erodes trust in the local-model path that SEED-172 is building out.

## Suggested routing

**Fix the frontend reconcile, keyed by `message_id`, the persisted id the run already carries.** Optionally also emit `done` before the suggestions on slow providers. Likely G-3 sized, after the files are confirmed.

⛔ **G-5:** `StreamsProvider.tsx`, `MessageList.tsx` and `useMessages.ts` all fire.

**Close only after a live re-drive on a local model and one cloud row.**
