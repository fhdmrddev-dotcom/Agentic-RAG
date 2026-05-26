---
id: BUG-260526-04
title: Sticky timer bar disappears mid-cycle on temp-id to DB-id remount
reported: 2026-05-26
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, frontend/streaming]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 1652b30
  date: 2026-05-26
---

# BUG-260526-04: Sticky timer bar disappears mid-cycle

## What we observed

During a Kimi multi-iteration agent run, the sticky timer bar above the chat (showing elapsed time, step count, file count) disappeared after the first code execution iteration completed. The tool status labels ("Preparing code...", "Executing code...") continued updating normally, confirming the run was still active.

Observed on Kimi but likely affects all providers during multi-iteration runs.

## Why it matters

The timer bar is the user's primary indicator of run progress and duration. Its disappearance mid-cycle creates a jarring visual break and makes users wonder if the run stalled.

## Hypothesized cause

`MessageList.tsx:118` uses `key={msg.id}` for each message. When the backend persists the assistant message to the database mid-run, the message ID swaps from a temp placeholder (`temp-...`) to the real DB UUID. React sees a different key, unmounts the old MessageItem/RunCard, and mounts a fresh one.

The fresh RunCard starts with:
- `elapsedMs = 0` (timer resets)
- `startedAtRef = null` (timer origin lost)
- `userExpanded = false` (tool panel may collapse)
- `thinkingOpen = false` (thinking block closes)

If `message.runStatus` propagates as `"streaming"` on the new mount, the timer restarts from 0. If there's a brief gap where runStatus isn't set, the timer disappears entirely until the next SSE event updates it.

## Surface classification

Agentic-RAG — pre-existing structural issue from the temp-id → DB-id reconcile pattern (not specific to Phase 076.2).

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** Next frontend streaming polish phase
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

None. The timer recovers on the next SSE event (restarts from 0), but the elapsed time is lost.

## Reference / evidence links

- `frontend/src/components/chat/MessageList.tsx:118` (key={msg.id})
- `frontend/src/components/chat/RunCard.tsx:46-96` (timer state + useEffect)
- `frontend/src/components/chat/RunCard.tsx:72` (userExpanded reset on message.id change)
- Phase 076.2 VALIDATION.md BUG-260526-04 entry
