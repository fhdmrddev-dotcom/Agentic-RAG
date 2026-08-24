---
id: BUG-260818-03
title: At the 15-iteration cap the chat shows a stop instead of the Continue affordance that already exists
reported: 2026-08-18
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, backend/agent-loop, chat/run-lifecycle, streaming]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-180]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8bfa4b65
  date: 2026-08-18
---

# BUG-260818-03: At the iteration cap the chat shows a stop, not Continue

## What we observed

Operator report, from live testing on 2026-08-18:

> *"model exhausted iteration which is I think capped to 15 — it's just showing stop, while in
> Claude AI we have the ability to say that the iteration was exhausted, continue, so it continues
> from the last iteration that it stopped from. So we have to ensure the correct information
> displayed."*

**The cap number is right, and the feature the operator is asking for ALREADY EXISTS AND DID NOT
APPEAR.** That is what makes this a bug rather than a request.

- **The cap is 15.** `backend/app/services/agent_loop.py:1287` — `max_iterations = 15` (GEN-04, was
  8). A lighter path uses 8 at `:1283`.
- **A Continue card is built.** `frontend/src/components/chat/MessageItem.tsx` renders an amber
  card reading *"Reached the iteration limit — some tools haven't run yet."* with a **Continue**
  button, and when the allowance is spent: *"Reached the Continue limit — this run is stopped.
  Start a new message to keep going."*
- **A real continuation exists behind it.** `continueRun(runId)` → `POST /runs/{id}/continue`
  (`backend/app/api/runs.py:708`) — *"Resume a cap_paused run within a fresh bounded budget"* —
  resumes the **same run**, reloading the tool calls the cap dropped
  (`load_cap_paused_tool_calls`, `:1096`). Capped at **3** continues per run
  (`threads.py:1008` `_MAX_CONTINUES_PER_RUN = 3`).

So the product can already do exactly what was asked. The operator saw a stop instead, which means
**the card did not render for them.**

## Why it matters

**Major, and worse than a missing feature.** A capability that exists, is paid for, and is invisible
at the one moment it applies is indistinguishable from a broken product — the user concludes the
agent gave up. They then start a new message, which **loses the paused run's dropped tool calls
entirely** and re-runs work from scratch.

## Hypothesized cause

**Hypothesis, not finding.** The Continue card's gate is not the run status — it is an out-of-band
thread lock, and the docblock says so explicitly:

```tsx
{message.role === "assistant" && isLastAssistant && workflowLock?.capPaused && ( … )}
```

> *"Gated on cap_paused delivered OUT-OF-BAND via the thread lock (NOT `message.runStatus` — the
> `role='system'` carrier row is filtered from `/messages`, BUG-260528-01)."*

Three conditions must hold at once, and each is a candidate cause:

1. **`workflowLock.capPaused` is false or absent.** The lock is seeded from a live SSE event; if the
   user reloaded, navigated away and back, or the stream dropped at exactly the cap, the lock is
   gone — and because the carrier row is filtered out of `/messages`, **nothing reconstructs it from
   the database.** This is the leading hypothesis, and it rhymes with `SEED-178` (the thread does
   not survive F5) and with the standing rule that Realtime is a hint, never a source of truth —
   **reconcile on (re)connect** (D-v2.5-03). A gate that can only ever be set by a live event, on a
   surface with no fetch-based reconcile, is a gate that will be missing.
2. **`isLastAssistant` is false** — a later message (a follow-up, a suggestion turn) would suppress
   it.
3. **The cap fired on a path that does not persist `cap_paused` at all** — plain chat versus the
   harness path. Worth measuring before assuming (1).

⚠ **A fixer must reproduce first and identify which.** Do not "fix" this by widening the gate: a
Continue button that appears when there is nothing to continue would claim a resumable run that
does not exist — the same class of lie `StopControl` was corrected for in Phase 194.1.

## Surface classification

`Agentic-RAG` — our own frontend, and possibly the backend persist path. A routing candidate at
`/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 197 is the authoring surface.
- **Defer to future phase / milestone:** the chat run-lifecycle phase. ⚠ **Triage with
  `BUG-260818-01` and `BUG-260818-02`** — Resume and Continue are two controls in one moment, and
  the user cannot tell them apart today.
- **Plant as seed:** `SEED-180` carries the ambition beyond the 3-continue cap (continue as many
  times as needed, including past context-window exhaustion).
- **External — note only:** no

## Workarounds

If the amber card is absent, send a short follow-up message in the same thread — the conversation
history is intact, so the model can carry on. ⚠ **The paused run's dropped tool calls are NOT
recovered this way**; only the real Continue path reloads those.

## Reference / evidence links

- `backend/app/services/agent_loop.py:1283-1287` — the 8 / 15 iteration caps
- `backend/app/services/agent_loop.py:276-301` — `cap_paused` persist + the
  `kind='iteration_cap_paused'` carrier rows
- `backend/app/api/runs.py:661-713`, `:1080-1113` — the continue endpoint and the remaining-count
- `backend/app/api/threads.py:1008`, `:1248` — the 3-continue cap and `continues_remaining`
- `frontend/src/components/chat/MessageItem.tsx` — the amber Continue card and its `workflowLock`
  gate
- Sibling reports: `BUG-260818-01`, `BUG-260818-02`
