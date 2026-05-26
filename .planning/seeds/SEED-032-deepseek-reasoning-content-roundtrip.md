---
id: SEED-032
title: DeepSeek reasoning_content round-trip for thinking mode
status: planted
planted: 2026-05-26
trigger_when: "User enables DeepSeek thinking mode OR DeepSeek deprecates non-thinking mode entirely"
surface: Agentic-RAG
affected_areas: [openai_service, threads, messages-schema]
---

# SEED-032: DeepSeek reasoning_content round-trip

## Context

DeepSeek v4-flash and v4-pro support "thinking mode" where the model returns
a `reasoning_content` field alongside the normal `content` in assistant messages.
The DeepSeek API requires this field to be passed back in subsequent conversation
turns — omitting it causes `400 invalid_request_error`.

Phase 076.1 disabled thinking mode via `enable_thinking: false` in `openai_service.py`
as a workaround. This seed tracks full thinking mode support.

## What's needed

1. **Streaming handler** — capture `delta.reasoning_content` chunks during streaming
   (similar to how we handle Anthropic's thinking blocks)
2. **Message storage** — persist `reasoning_content` in the messages table (new column
   or JSON metadata field)
3. **History builder** — include `reasoning_content` in assistant messages when building
   conversation history for DeepSeek at `threads.py:1100-1153`
4. **Frontend** — optionally render reasoning content in a collapsible "thinking" block
   (pattern exists from Anthropic's `thought_content` handling)

## Scope estimate

- 3-4 files modified (threads.py, openai_service.py, messages schema, possibly frontend)
- 1 migration (reasoning_content column or metadata extension)
- Similar in scope to Phase 075.5's thought_signature handling for Google

## Related

- Phase 075.5: thought_signature echo for Google (same pattern, different provider)
- Anthropic native SDK: already handles thinking blocks separately in anthropic_service.py
- `enable_thinking: false` workaround at openai_service.py line ~902
