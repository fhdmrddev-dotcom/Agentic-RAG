---
id: BUG-260912-01
title: Inter-tool narration renders in the chat body instead of a fold — and any turn the backend discards stays on screen
reported: 2026-09-12
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, backend/agent-loop, chat/message-rendering]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-173, SEED-172]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 739decc33
  date: 2026-09-12
---

# BUG-260912-01: inter-tool narration renders in the chat body instead of a fold

## What we observed

Operator screenshot, `screenshots/Screenshot 2026-09-12 230639.png`, thread *"RPA Research
Presentation Preparation"*, provider `custom`, model `XHToken/Spark-X2.5-4B-GGUF` (a local 4B GGUF
reached over a Cloudflare tunnel — the migration-180 endpoint).

The assistant bubble is a wall of inter-tool narration: *"I'll start by searching for RPA research…"*,
*"I found several relevant documents…"*, *"Now let me analyze the key documents…"*, *"Excellent
analysis! Now let me also analyze the dissertation…"*. A collapsed **Thinking…** disclosure sits
ABOVE it and is empty of this content. The Workspace TODO rail shows 4 tools completed + 1 in
progress, so the run is healthy — the noise is purely presentational.

Two further details visible in the same frame:
- **Sentences are jammed with no separator** — `…in parallel.I found several relevant…` — i.e. these
  are separate streamed deltas concatenated, not one authored paragraph.
- **The same three sentences repeat about three times each.** ⚠ NOT ATTRIBUTED. See below.

## Why it matters

The final answer is supposed to be the message. Here it is buried under the model's process, and on
a long run the body grows without bound. Claude.ai / ChatGPT fold exactly this.

## Diagnosis — what was checked, and what was not

⭐ **The app has exactly ONE fold, and it is fed by exactly ONE thing.** `ThinkingBlock.tsx` renders
`reasoningContent` only — the provider's dedicated reasoning channel (`reasoning_delta`: DeepSeek
`reasoning_content`, `<think>`-stripped Kimi / MiniMax / GLM). Plain assistant prose is a `delta`
event and goes to the message body, **untagged**. Nothing downstream distinguishes *narration before
a tool call* from *the final answer*.

⛔ **SO THIS IS EFFECTIVELY PER-MODEL, which is what the operator suspected.** A model that routes its
thinking through the dedicated channel folds correctly and looks clean. A model that simply *talks* —
which is most of them, including this 4B — puts every word in the body. The rendering is not wrong
for one model and right for another; it is blind to the distinction.

⚠ **AND THE BACKEND ALREADY KNOWS THE DIFFERENCE IT IS NOT TELLING THE UI.** `agent_loop.py:2801`
attaches `full_content` to the tool-calling assistant message and `:2815` resets it — at that exact
moment the text is known to be narration. No event carries that fact.

⛔ **THE STRUCTURAL FINDING, wider than the cosmetic one: `delta` is APPEND-ONLY and there is NO
RETRACTION EVENT.** Three paths set `full_content = ""` to discard a turn *after* its deltas have
already been streamed to the browser:
  1. `:2508` structured-mode — narration parsed into a tool call, *"not a user-facing response"*;
  2. `:2732` MiniMax arg-repair — *"dropping the bad turn and re-asking once"*;
  3. `:2815` the normal tool-call turn reset.
In every one, the backend forgets the text and **the screen keeps it**. A discarded turn is
therefore visible forever, and on path 2 it is visible *twice* — the dropped attempt and the re-ask.

## What is NOT established

⚠ **The repetition in this screenshot is NOT attributed, and must not be written up as if it were.**
Checked and ruled out: the backend emits only NEW text per delta (`:2203-2207`) and resets per turn,
so it never re-sends. Path 2 above is a genuine exact-duplicate generator but is **gated on the
resolved provider being MiniMax**, and this run is `custom`. That leaves *the 4B model restating
itself each turn* as the most likely cause — **plausible, unproven, and not diagnosable from a
screenshot.** Reproducing it needs the run's actual delta sequence.

⚠ Separately noticed while tracing, worth its own look: `resolve_calling_mode` classified
`XHToken/Spark-X2.5-4B-GGUF` as **NATIVE** because the id contains a `/`, which `_infer_provider_for`
maps to `openrouter`, which reaches the OpenRouter strategy branch and returns NATIVE — **even though
the active provider is `custom` and the capability warning printed `native_tools=False`**. It happened
to be right here (the tools did run), but an id-shape heuristic deciding the tool-calling mode of a
self-hosted model is not a mechanism anyone should rely on. Relates to SEED-172 / SEED-173.

## Proposed fix (not built)

1. **Tag the delta with its turn's fate.** When a turn ends in tool calls, emit a `turn_boundary`
   event; the frontend moves that turn's accumulated text into the fold and starts a fresh body
   buffer. The final turn — the one that ends without tool calls — is the only one rendered as the
   message. This uses knowledge the backend already has at `:2801`.
2. **Feed the existing fold from both sources**, so `ThinkingBlock` shows reasoning *and* folded
   narration rather than being reasoning-only. One fold, two inputs — no second renderer.
3. **Then** the retraction gap closes for free on paths 1 and 3, because a discarded turn's text is
   already in the fold rather than in the body.

⛔ Do NOT fix this by filtering narration out at the backend. It is legitimately useful mid-run —
that is what the fold is for — and dropping it would also remove it from the model's own context,
which is the thing that keeps a multi-turn run coherent.
