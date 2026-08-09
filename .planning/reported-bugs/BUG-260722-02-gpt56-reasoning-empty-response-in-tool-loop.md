---
id: BUG-260722-02
title: gpt-5.6 reasoning models (Sol/Terra/Luna) return "empty response after N iterations" on tool tasks
reported: 2026-07-22
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/agent-loop, cross-provider/openai, streaming]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-118, SEED-127]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 00b8954a
  date: 2026-07-22
---

# BUG-260722-02: gpt-5.6 reasoning models return "empty response after N iterations" on tool tasks

## What we observed

After Phase 175 (XPROV-01) made gpt-5.6 Sol/Terra/Luna usable (no more hard 400), operator live-tested them. The models now accept the request and run the agent loop — but on at least one Luna thread a tool-ish task ended with the agent-loop fallback:

> *"The model returned an empty response after 3 iteration(s). Try breaking the request into smaller steps or switching to a different model."*

This is a **different failure from the 400 that Phase 175 fixed** — the request is no longer rejected; the model simply produced no usable visible content across the loop iterations.

Exact source of the message: `backend/app/services/agent_loop.py:2751` — the `if not full_content:` fallback (GEN-07), which fires when the loop ends with empty `full_content`.

## Why it matters

**Major** from the user's chair: a whole newly-enabled model family (gpt-5.6 reasoning) is selectable but can't complete a tool task — the user gets a "try a different model" dead-end. Phase 175's crash-fix is real progress (graceful degradation beats a hard 400), but "no crash" is not "usable." This is the next layer of the onion, now visible because the crash is gone.

## Hypothesized cause

**Hypothesis (needs run-trace confirmation):** Phase 175 routes `reasoning_first` models STRUCTURED (tools via XML injection, no native `tools`/`reasoning_effort` param — that's what avoids the 400). A STRUCTURED-routed reasoning model must emit its tool call as XML text and/or a visible final answer. If Luna emits only *reasoning* tokens and no visible `content` / no parseable XML tool call, `full_content` stays empty every iteration → the loop exhausts and hits the empty-response fallback.

Candidate root causes to distinguish during the fix:
1. Reasoning-model output not surfaced — the model put everything in reasoning/thinking and never produced a visible answer or XML tool call (STRUCTURED-path handling for reasoning models).
2. Weak-model tool-loop behavior — the general "model can't drive the tool loop" pattern (this is exactly [[SEED-118]]'s territory: early force-answer / per-model budget / dedup guard).
3. XML tool-call emission quality — the model attempts a tool but its XML is malformed and `parse_structured_tool_calls` drops it, leaving nothing.

**Investigation next step:** pull the specific Luna run from the DB / backend logs (was reasoning content emitted? was a tool attempted? was there malformed XML?) to pick between 1/2/3 before designing the fix.

## Surface classification

`Agentic-RAG` — this is our agent loop + our cross-provider STRUCTURED-routing decision, not a provider-side defect. Routing candidate at `/gsd:discuss-phase`.

## Routing note

**Not a Phase 175 regression.** XPROV-01's acceptance bar was "no 400 on chat or with tools" — that is met (confirmed live: Luna runs instead of rejecting). This empty-response behavior is an **agent-loop / reasoning-model output** concern whose natural home is **Phase 180 (Agent-Loop Behavior Honesty, LOOP-01/02/03 — STRETCH, touches `agent_loop.py`)** and/or [[SEED-118]] (weak-model tool-loop harness). Related: [[SEED-127]] (reasoning-first forced-emission gap — a sibling reasoning-first edge). Fold candidate when Phase 180 is scoped; this operator repro strengthens the case for prioritizing it.
