---
id: BUG-260818-01
title: Resume replays the original prompt verbatim instead of continuing from where the run stopped
reported: 2026-08-18
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, frontend/streaming, backend/agent-loop, chat/run-lifecycle]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-180]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8bfa4b65
  date: 2026-08-18
---

# BUG-260818-01: Resume replays the original prompt instead of continuing

## What we observed

Operator report, from live testing on 2026-08-18:

> *"are we sure that resume button is resuming with the same context of the thread? When we click
> resume it is showing the original prompt again instead of showing continue or something
> representative similar to Claude AI."*

Two distinct claims inside one observation, and they resolve differently — which is why they are
separated here:

**(a) The displayed behaviour — CONFIRMED IN SOURCE.** Resume does not continue anything. It walks
back from the failed assistant message to the nearest preceding `role === "user"` message and
**re-sends that message's content verbatim** as a brand-new turn:

`frontend/src/providers/StreamsProvider.tsx` → `resumeFromFailed`:

```ts
let userMsg: Message | undefined
for (let i = idx - 1; i >= 0; i--) {
  if (bucket[i].role === "user") { userMsg = bucket[i]; break }
}
…
await useStreamsStore.getState().actions.sendMessage(threadId, userMsg.content, { surfaceId })
```

So the original prompt reappears in the transcript because **it genuinely is being sent again**. The
UI is not mislabelling a continuation; it is performing a retry and calling it Resume.

**(b) The thread-context question — NOT a defect, on the evidence available.** The retry goes
through the ordinary `sendMessage` → `POST /threads/{id}/messages` path, and the backend
reconstructs full conversation history for that thread on every turn. `MessageItem.tsx:626-632`
states the same intent in the shipped docblock: *"re-POSTs the original prompt with full
conversation context."* **The context is not lost.** What is lost is the *work of the failed
iterations* — the model starts the turn over rather than resuming mid-loop.

## Why it matters

**Major, and the severity is about honesty rather than breakage.** A control labelled *Resume* that
silently means *retry from the top* teaches the user something false about what the product just
did, on the surface where trust is the whole product. Concretely:

- Any tool calls the failed run completed are **re-executed**, at cost and latency, with no notice.
- A long multi-tool run that failed at iteration 12 restarts at iteration 1 — the user pays twice
  and may hit the cap they were already near.
- The transcript grows a duplicate of the user's prompt, which reads as a UI glitch and makes the
  thread harder to follow.
- Because the copy says nothing, the user cannot tell the difference between *"it carried on"* and
  *"it started over"* — the exact ambiguity the operator's report opens with.

## Hypothesized cause

Not a hypothesis — **read from source**. `resumeFromFailed` was built (Phase 068, L-068-07) as a
retry seam with mirrored `sendMessage` semantics, and its docblock says so. The defect is that the
**label and the mechanism disagree**, and no copy anywhere tells the user which one they are getting.

⚠ **A genuine continuation mechanism already exists next door and this path does not use it.**
`POST /runs/{id}/continue` (`backend/app/api/runs.py:708` — *"Resume a cap_paused run within a fresh
bounded budget (CONT-01)"*) resumes the **same run** with its dropped tool calls reloaded
(`load_cap_paused_tool_calls`). It is wired only to the `cap_paused` Continue card, never to the
failed/timed_out Resume button. **Whether the failed case can reuse it is the open question a fix
must answer first** — a failed run may not have persisted the state a continuation needs.

## Surface classification

`Agentic-RAG` — this app, our own frontend and backend. A routing candidate at
`/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 197 is authoring-surface only (D-01 scopes it to the
  drafted workflow view); this is the chat run lifecycle.
- **Defer to future phase / milestone:** a chat run-lifecycle phase. Should be triaged **together
  with BUG-260818-02 (Resume drops the model) and BUG-260818-03 (the Continue card did not
  surface)** — all three are the same control in the same moment, and fixing one without the others
  leaves the moment still lying.
- **Plant as seed:** `SEED-180` carries the larger *continue indefinitely* ambition (context-window
  exhaustion). This bug is the narrower, already-broken half.
- **External — note only:** no

## Workarounds

Today: after a failed run, **do not press Resume if the run did expensive work**. Type a short
follow-up instead (*"continue from where you stopped"*) — the thread history is intact, so the model
can pick up, and you avoid re-running completed tools.

## Reference / evidence links

- `frontend/src/providers/StreamsProvider.tsx` — `resumeFromFailed` (the verbatim re-send)
- `frontend/src/components/chat/MessageItem.tsx:626-651` — the Resume button and its gate
  (`runStatus ∈ {failed, timed_out}`, suppressed when deliverables already exist)
- `backend/app/api/runs.py:661-713` — the real continuation path, `cap_paused` only
- Sibling reports: `BUG-260818-02`, `BUG-260818-03`
