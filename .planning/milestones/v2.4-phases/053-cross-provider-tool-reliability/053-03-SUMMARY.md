# Plan 53-03 Summary: JSON Tool Call Parser

## What Was Built

Extracted the inline structured tool call parser from threads.py into a dedicated `tool_parser.py` module with a proper `ToolCall` dataclass. Updated threads.py to import and use the module.

### Changes

1. **backend/app/services/tool_parser.py** (replaced stub)
   - Added `ToolCall` and `FunctionCall` dataclasses (OpenAI-compatible format)
   - Implemented `parse_structured_tool_calls()` supporting:
     - Markdown JSON code fences (```json ... ```)
     - Inline JSON objects
   - Added `_get_known_tools()` lazy loader from `openai_service.get_tools()`
   - Added `_parse_single_tool_call()` helper with validation:
     - Validates `tool` name against known tool names
     - Normalizes `arguments` to JSON string
     - Returns `None` on invalid JSON or unknown tools
   - Graceful failure: returns empty list on any parse failure

2. **backend/app/api/threads.py**
   - Added module-level import: `from app.services.tool_parser import parse_structured_tool_calls, ToolCall`
   - Removed inline import inside `event_stream()`
   - Structured mode branch now calls `parse_structured_tool_calls(full_content)` directly
   - Parse failure logging preserved (warns with model ID and content preview)

## Verification

- All imports succeed
- Parser tests pass: markdown blocks, inline JSON, unknown tool filtering, invalid JSON, empty text
- ToolCall dataclass has correct shape (id, type, function with name/arguments)

## Deviations

None.
