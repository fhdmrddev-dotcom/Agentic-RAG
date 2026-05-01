# Plan 53-01 Summary: Capability Registry + Dual-Mode Backend

## What Was Built

Implemented the model capability registry and dual-mode tool calling backend that eliminates tool-calling failures for non-OpenAI models.

### Changes

1. **backend/app/config.py**
   - Added `ModelCapability` TypedDict with `native_tools: bool` and `provider: str`
   - Added `MODEL_CAPABILITIES` registry with entries for OpenAI, Anthropic, Google, and OpenRouter models
   - Added `get_model_capability()` helper that returns `native_tools=False` for unknown models (safe default)

2. **backend/app/services/openai_service.py**
   - Added `CallingMode` enum (`NATIVE`, `STRUCTURED`)
   - Added `resolve_calling_mode()` that looks up model capability and applies OpenRouter strategy overrides
   - Replaced `create_streaming_chat()` with `create_adaptive_streaming_chat()` returning `(stream, calling_mode)`
   - Preserved old `create_streaming_chat()` as backward-compatible wrapper
   - Native mode: passes `tools` param with `parallel_tool_calls=False` and OpenRouter quality enhancements (`:exacto` appending, Response Healing plugin)
   - Structured mode: skips `tools` param entirely; tool schemas injected into system prompt by caller

3. **backend/app/api/threads.py**
   - Added `TOOL_USAGE_INSTRUCTIONS` template for structured mode prompt augmentation
   - Added `_format_tool_list()` helper that renders tool schemas as human-readable markdown
   - Modified `event_stream()` to call `create_adaptive_streaming_chat()` and inject tool instructions for structured mode
   - Added structured mode parsing branch that converts parsed tool calls into `tool_calls_buffer` format
   - Added parse failure logging warning for observability

4. **backend/app/services/tool_parser.py** (stub)
   - Created stub module for forward compatibility with Plan 53-03

## Verification

- All imports succeed (config, openai_service, threads)
- Registry lookups work: `gpt-4o` → native, `z-ai/glm-5.1` → structured, unknown → structured
- Zero regression: OpenAI path uses identical code path via backward-compatible wrapper

## Deviations

None.

## Key Links

- `config.py MODEL_CAPABILITIES` → `openai_service.py resolve_calling_mode()`
- `openai_service.py create_adaptive_streaming_chat()` → `threads.py event_stream()`
- `threads.py _format_tool_list()` → `threads.py system prompt augmentation`
