# Phase 53: Cross-Provider Tool Calling Reliability — Validation

## Validation Strategy

This phase introduces a new architectural layer (capability registry + dual-mode calling) that sits in the critical path of every chat message. Validation must confirm:

1. **Correctness**: Parser extracts valid tool calls; registry routes correctly
2. **Zero Regression**: OpenAI path is identical; existing tests pass
3. **Performance**: No additional latency for native mode
4. **Security**: Unknown tool names filtered; invalid JSON handled gracefully

## Test Coverage Matrix

| Component | Test File | Tests | Coverage |
|-----------|-----------|-------|----------|
| Tool Parser | `test_tool_parser.py` | 12+ | Markdown blocks, inline JSON, unknown tool filtering, invalid JSON, empty text, dataclass shape |
| Calling Mode | `test_calling_mode.py` | 14+ | OpenAI native, Anthropic native, Google native, OpenRouter structured, strategy overrides, unknown model defaults |
| OpenRouter Quality | `test_openai_service.py` | 6+ | parallel_tool_calls=False, :exacto appending, no double-append, Response Healing, native strategy exclusion |
| Integration | Manual | 3 | End-to-end with GLM 5.1, DeepSeek, Kimi via OpenRouter |

## Manual Validation Steps

### Test 1: OpenAI Regression
1. Set main model to `gpt-4o`
2. Send message: "Search for documents about testing"
3. **Expected**: Tool call executes normally, response is fast, identical to pre-phase behavior
4. **Verify**: Check server logs — no `:exacto` appended, no Response Healing plugin, `parallel_tool_calls` not in kwargs (or False)

### Test 2: GLM 5.1 Structured Mode
1. Set provider to OpenRouter, model to `z-ai/glm-5.1`
2. Ensure OpenRouter Tool Strategy is "Quality" or "XML"
3. Send message: "Search for documents about testing"
4. **Expected**: Model outputs JSON block in response; parser extracts it; tool executes; final response is natural language
5. **Verify**: Check response text contains no planning language ("Now let me search...")

### Test 3: DeepSeek Structured Mode
1. Set provider to OpenRouter, model to `deepseek/deepseek-chat`
2. Send message: "List all documents"
3. **Expected**: Same as Test 2 — JSON block parsed, tool executes

### Test 4: Strategy Toggle
1. With GLM 5.1 selected, switch strategy from "Quality" to "XML"
2. Send same message
3. **Expected**: Both strategies work; "Quality" may have `:exacto` in model ID (check logs)

### Test 5: Parse Failure Graceful Degradation
1. Use a model in structured mode
2. Send a message that's ambiguous (e.g., "hello" with no tool need)
3. **Expected**: Normal text response, no tool call attempted, no error

## Performance Validation

| Metric | Before (OpenAI) | After (OpenAI) | Acceptance |
|--------|-----------------|----------------|------------|
| Time to first token | Baseline | +0ms | No regression |
| Total response time | Baseline | +0ms | No regression |
| Structured mode overhead | N/A | +50-100ms (prompt size) | Acceptable |

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Model ID not in registry | Structured mode (safe default) |
| Invalid JSON in structured response | Empty tool calls, text response preserved |
| Unknown tool name in JSON | Filtered out, not executed |
| Multiple JSON blocks | All parsed, sequential execution |
| Mixed markdown + inline JSON | Markdown preferred, inline ignored |

## Sign-off Checklist

- [ ] All 32+ unit tests pass
- [ ] Existing test suite passes (no regression)
- [ ] OpenAI path verified identical (logs inspection)
- [ ] GLM 5.1 structured mode works end-to-end
- [ ] DeepSeek structured mode works end-to-end
- [ ] Strategy toggle changes behavior as expected
- [ ] Parse failures are graceful (no errors, conversation continues)
- [ ] Performance benchmark shows no OpenAI regression

---

*Phase: 053-cross-provider-tool-reliability*
*Validation defined: 2026-04-26*
