---
id: BUG-260906-01
title: Context trimming drops the user's OWN question while keeping tool results, so the agent answers "your question was trimmed" to a question just asked
reported: 2026-09-06
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/agent-loop, chat/context-window, chat/retry]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 68858a3c5
---

# The agent says your question was trimmed — to a question you asked eight turns in

## What happens

Ask the same one-line question repeatedly in a single thread, switching models between turns (the
Phase 236 SC#1 drive did exactly this). After roughly eight short turns the assistant answers:

> *"It looks like the earlier part of our conversation was trimmed from my context, so I no longer
> have your original question in front of me. Could you restate your question?"*

The user had **just asked it**. It is the most recent message in the thread.

## Why it matters

The reply is a dead end for the person: they asked a question and were told their question is
missing. And the loss is silent from their side — the trimming decision happens server-side and the
turn still "succeeds".

⚠ **It also silently invalidates measurement.** In the Phase 236 live drive, two provider rows
returned this instead of an answer. Both were excluded from the SC#1 scoreboard as unscoreable —
but a less careful pass could easily have recorded them as passes, because *the model did retrieve
the document and did not obey the injected instruction*. **A truncation bug that looks like a
security pass is exactly the shape of thing that makes a scoreboard lie.**

## Evidence — from the database, not the screen

`messages` carries the mechanism explicitly:

```
role=system  content='⚠ Earlier messages dropped to fit context window (3 message(s) removed).'
             tool_calls=[{"kind": "context_truncated"}]
```

Three such rows landed at 15:38:29 alone (3, 2 and 3 messages removed). The affected assistant turns
are 15:36:16 and 15:38:13 on 2026-09-06.

⭐ **The trim kept the tool results and dropped the user turn.** The same turns still executed
`search_documents` and still received the full document chunk — so the retrieved payload survived
while the human's question did not. That ordering is the defect: **the current user question should
be the last thing evicted, never the first.**

## Contributing factor

The thread had absorbed several large `search_documents` results (each carrying full document
chunks) plus a provider rate-limit retry. The retry re-ran the turn on an already-loaded thread
rather than starting from the user's message.

## Expected

1. The **current user question is never evicted** — it is the one message the turn cannot proceed
   without.
2. If trimming must drop something, drop the oldest **tool results** first; they are re-derivable by
   re-running retrieval, which a user question is not.
3. If the turn genuinely cannot fit, say so in the product's own voice rather than letting the model
   improvise an apology about its own context.

## Notes

Found during the Phase 236 SC#1 live cross-provider drive (2026-09-06), not by a test. Related in
spirit to the Resume/Continue cluster in `DEBT-02` (a retry that replays the wrong thing), though
the mechanism here is context eviction rather than resume semantics.
