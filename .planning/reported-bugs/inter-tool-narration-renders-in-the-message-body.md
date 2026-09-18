---
id: BUG-260912-01
title: Inter-tool narration renders in the chat body instead of a fold — and any turn the backend discards stays on screen
reported: 2026-09-12
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/streaming, backend/agent-loop, chat/message-rendering]
folded_into: null
verified_closed_by: "live browser drive 2026-09-13 (c6a6b46d4)"
related_seeds: [SEED-173, SEED-172, SEED-283]
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

---

## 2026-09-12 — FIX BUILT on branch `fix/BUG-260912-01-turn-fold`. ⚠ STATUS STAYS `open`.

`agent_loop` now emits a guarded `turn_boundary` at the point it already knew the text was
narration; `StreamsProvider.onTurnBoundary` flushes the coalescer, then moves `content` into a new
client-only `narrationContent`; `ThinkingBlock` renders that as a SECOND source of the one existing
fold. Seven files, ~1 event and 1 field.

**Fences (both driven RED against the unfixed code first):**
`backend/tests/unit/test_bug_260912_01_turn_boundary_event.py` (5 cases — 5/5 RED) ·
`frontend/src/__tests__/providers/streamsProvider_bug260912_turnfold.test.tsx` (6 — 6/6 RED) ·
`frontend/src/components/chat/__tests__/ThinkingBlock.narration.test.tsx` (6 — 3/6 RED; the other
three are negative guards that pass trivially on code that renders nothing).
Both new suites adopted into **BOTH** count-gate knobs in the same commit — neither
`src/components/chat` nor `src/__tests__` has a bare-directory TARGETS entry.

**Gates:** backend `71 failed / 4702 passed / 0 collection errors` (baseline exact) · count gate
`279/279 pinned · 8282 · 0 failing` (+12 = the two new suites, fully attributed) · `tsc -p
tsconfig.app.json` set-identical at 67.

⭐ **A CHARACTERIZATION FENCE CAUGHT A REAL REGRESSION IN THIS FIX**, which is the argument for
keeping such fences. `ThinkingBlock.characterization.test.tsx` §10c pins the exact source shape
`toParagraphs(reasoningContent)` as its one-renderer needle; writing `toParagraphs(reasoningContent
?? "")` made it read **ZERO renderers on correct code** and turned the gate red. The guard was
right and the call shape gave way — the `undefined` is absorbed inside the helper.

⛔ **WHY `open` AND NOT `closed`:** not merged, and **not driven in a browser**. The operator has
not yet seen a real run fold. Nothing here is verified against a live model.

⚠ **AND THE REPETITION IS STILL UNATTRIBUTED.** This fix moves narration out of the body; it does
NOT explain why the same three sentences appeared three times. If the 4B was restating itself, the
fold now hides it and the underlying repetition remains. **Do not read a clean body as evidence
that the repetition was fixed** — it was never diagnosed.

---

## 2026-09-13 — CLOSED. Merged to `develop` at `c6a6b46d4`, verified in a LIVE BROWSER RUN.

⭐ **THE VERIFICATION IS THE POINT: driving the app found a defect that thirteen green cases did
not.** The first fix shipped a second one — `RunCard`'s planning row and the fold both drew, so the
screen carried `deciding next step…` and `Thinking...` stacked. Its guard asked `!reasoningContent`
ALONE, a complete question while the fold had ONE input; narration made it two and opened a window
where narration is set and reasoning is still empty. ⚠ **The double is TRANSIENT** (the row is gated
on `isStreamingNow`), so every test over a FINISHED message passed against broken code. `§7` renders
the streaming state and was driven RED against the unfixed guard.

**Measured across three live runs on `deepseek-v4-flash`:** mid-stream, ONE collapsed `Thinking...`
fold under the run card and no planning row; opening it shows the model's process; the body stays
empty until the answer, which then renders alone; on completion the label settles to
`Thought for 1 second`.

⛔ **WHAT IS CLOSED IS THE TITLE OF THIS REPORT AND NOTHING WIDER.**

- ⚠ **"Everything folded under thinking" was NOT REPRODUCED.** In every drive the answer landed in
  the body. The likely reading is the real window between the last tool finishing and the answer
  starting — long on a slow local model, and it read as noise while the duplicate badge was there.
  **Recorded as not-reproduced, not as fixed.**
- ⛔ **The REPETITION in the original screenshot remains UNATTRIBUTED and is now SEED-283.** The fold
  hides it; it does not explain it. **Do not read a clean body as evidence the repetition is gone.**

