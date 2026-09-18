---
id: BUG-260722-02
title: gpt-5.6 reasoning models (Sol/Terra/Luna) return "empty response after N iterations" on tool tasks
reported: 2026-07-22
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/agent-loop, cross-provider/openai, streaming]
folded_into: 250
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

---

## ✅ FOLDED INTO PHASE 250 — `HONEST-02` (2026-09-15)

**What shipped:** the single fallback sentence is replaced by a closed four-arm taxonomy —
reasoning-only / tools-ran-but-no-answer / nothing-we-could-see / **reason-not-captured**. The
last arm is load-bearing for the same reason it is in `run-honesty.md` D2: it proves a guess is
never dressed as a diagnosis.

⛔ **THIS DOES NOT PICK BETWEEN THIS REPORT'S THREE CANDIDATE ROOT CAUSES.** It makes the run
SAY which of them it looks like, which is what the requirement asked for. The capability half —
making a reasoning-first model actually complete the loop — remains `SEED-118` / `SEED-127`, and
both seeds were annotated at this phase so neither can be closed by citing this fix.

⭐ **A TRAP FOUND WHILE BUILDING IT, AND IT WOULD HAVE SHIPPED A LIE.**
`full_reasoning_content` is **reset inside the loop** (two sites — providers such as DeepSeek
need the CURRENT turn's reasoning round-tripped and nothing older). Reading it at the fallback
would report *"the model produced no reasoning"* about a model that reasoned on every iteration
— the honesty fix itself being dishonest, for exactly this model family. A never-reset
`reasoning_chars_this_run` counter was added instead, both reset sites carry a comment saying why
it is deliberately absent from them, and a fence fails if the fallback ever reads the per-turn
name again.

⚠ **STATED LIMITATION:** `reasoning_delta` is emitted by the OpenAI-compat path only, so an
Anthropic or Google run that thought silently registers zero reasoning. That is why the third arm
is worded as an OBSERVATION — *"nothing we could see"* — and never as a claim about what the
model did internally.

Fences: `test_250_run_honesty_agent_loop.py` §2 (five; three driven RED against a plant).
`test_075_4_empty_response_iter_count.py` was **updated deliberately**, not tripped by surprise:
`BUG-260522-01`'s real claim (report the iterations that RAN, never the cap) survives the
rewording and is now pinned as a claim rather than as a sentence.
