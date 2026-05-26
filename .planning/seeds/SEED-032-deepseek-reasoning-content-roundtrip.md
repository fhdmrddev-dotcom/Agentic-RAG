---
id: SEED-032
title: DeepSeek full integration — thinking mode + real-time UI parity
status: planted
planted: 2026-05-26
trigger_when: "Next milestone planning OR user requests DeepSeek thinking mode OR DeepSeek deprecates non-thinking mode"
surface: Agentic-RAG
affected_areas: [openai_service, threads, messages-schema, StreamsProvider]
---

# SEED-032: DeepSeek full integration

## Context

Phase 076.1 integrated DeepSeek as a direct provider (config, Settings UI, sub-agent
defaults, inference patterns). Multi-turn chat works with thinking mode disabled.
Two gaps remain for full parity with Anthropic/OpenAI.

## Gap 1: Thinking mode (reasoning_content round-trip)

DeepSeek v4-flash/v4-pro return `reasoning_content` (chain-of-thought) in thinking
mode. The API requires this field in subsequent conversation turns.

**Current state:** thinking disabled via `extra_body.thinking.type = "disabled"` in
`openai_service.py` streaming path. Migration 050 added `reasoning_content` column
to messages. Streaming accumulator captures `delta.reasoning_content`. DB storage
wired in `insert_assistant_message`.

**What's missing:** The agent loop rebuilds messages **in-memory** between tool-call
iterations (not from DB). The in-memory message assembly in threads.py does NOT
include `reasoning_content` on the assistant message dict between iterations. This
is why the second LLM call in a multi-tool run fails — the first call's
`reasoning_content` isn't passed back.

**Fix requires:** Modify the agent loop's in-memory message building (threads.py
~line 2429-2470 area where tool results are appended and the next iteration's
messages are assembled). The assistant message dict needs `reasoning_content`
from the streaming accumulator. This is a threads.py change (G-5 hot file).

**DeepSeek API reference:** `thinking` parameter is an object with
`type: "enabled"|"disabled"` and optional `reasoning_effort: "high"|"max"`.
Docs at `api-docs.deepseek.com/api/create-chat-completion`.

## Gap 2: Real-time UI reflection for multi-batch runs

**Observed:** Anthropic Sonnet multi-batch runs (e.g., DBA PPTX 4-batch) now render
each tool panel in real-time (076.1 iteration-aware dedup fix). DeepSeek runs
complete successfully but tool panels don't reflect in real-time with the same
fidelity — the run finishes and content appears at once.

**Likely cause:** DeepSeek's streaming chunk timing/structure differs from
Anthropic's. The tool_preparing/tool_start/tool_end SSE events may fire with
different timing or the chunk handler may process them differently. Needs
investigation with DeepSeek-specific streaming traces.

**Fix requires:** Streaming trace comparison (DeepSeek vs Anthropic chunk-by-chunk),
then targeted fixes in the OpenAI-compat chunk handler or StreamsProvider callbacks.

## Scope estimate

- threads.py agent loop modification (G-5 — needs dedicated phase, not inline fix)
- Streaming trace investigation + chunk handler fixes
- Frontend: optionally render reasoning_content in collapsible "thinking" block
- 4-5 files, proper UAT with multi-tool DeepSeek runs

## Groundwork already in place (from 076.1)

- Migration 050: `reasoning_content TEXT` column on messages
- Streaming accumulator: `full_reasoning_content` in `_on_chunk_openai`
- DB persist: `insert_assistant_message` accepts `reasoning_content`
- History query: SELECT includes `reasoning_content`
- History builder: `_reconstruct_history` includes `reasoning_content` on assistant messages
- Title gen: refusal guard for DeepSeek models

## Related

- Phase 075.5: thought_signature echo for Google (similar provider-specific field)
- Anthropic native SDK: handles thinking blocks in anthropic_service.py
- Phase 076.1: iteration-aware dedup fix in StreamsProvider (multi-batch rendering)
