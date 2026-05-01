# Phase 53: Cross-Provider Tool Calling Reliability — Verification

## Post-Execution Verification

Run these checks after all plans (53-01 through 53-04) are complete.

### 1. File Existence

```bash
ls .planning/phases/053-cross-provider-tool-reliability/
# Should contain:
# 053-CONTEXT.md
# 053-01-PLAN.md, 053-01-SUMMARY.md
# 053-02-PLAN.md, 053-02-SUMMARY.md
# 053-03-PLAN.md, 053-03-SUMMARY.md
# 053-04-PLAN.md, 053-04-SUMMARY.md
# 053-VALIDATION.md
# 053-VERIFICATION.md
```

### 2. Backend Imports

```bash
cd "C:/Vibe Apps/Agentic RAG/backend"

python -c "from app.config import MODEL_CAPABILITIES, get_model_capability; print('config OK')"
python -c "from app.services.openai_service import create_adaptive_streaming_chat, CallingMode, resolve_calling_mode; print('openai_service OK')"
python -c "from app.services.tool_parser import parse_structured_tool_calls, ToolCall, FunctionCall; print('tool_parser OK')"
python -c "from app.api.threads import event_stream; print('threads OK')"
```

### 3. Registry Verification

```bash
cd "C:/Vibe Apps/Agentic RAG/backend"

python -c "
from app.config import get_model_capability

# Known native models
assert get_model_capability('gpt-4o')['native_tools'] == True
assert get_model_capability('claude-sonnet-4-6')['native_tools'] == True
assert get_model_capability('gemini-2.5-pro')['native_tools'] == True

# Known structured models
assert get_model_capability('z-ai/glm-5.1')['native_tools'] == False
assert get_model_capability('deepseek/deepseek-chat')['native_tools'] == False
assert get_model_capability('moonshotai/kimi-k2.6')['native_tools'] == False

# Unknown default
assert get_model_capability('future-model-2030')['native_tools'] == False

print('registry verification passed')
"
```

### 4. Unit Tests

```bash
cd "C:/Vibe Apps/Agentic RAG/backend"

# New tests
python -m pytest tests/unit/test_tool_parser.py -v
python -m pytest tests/unit/test_calling_mode.py -v
python -m pytest tests/unit/test_openai_service.py -v

# Regression check
python -m pytest tests/unit/ -v --tb=short
```

### 5. Frontend TypeScript

```bash
cd "C:/Vibe Apps/Agentic RAG/frontend"
npx tsc --noEmit
```

### 6. Settings API Verification

```bash
# Start backend and test settings endpoints
curl -X GET http://localhost:8000/api/settings -H "Authorization: Bearer $TOKEN" | jq '.openrouter_tool_strategy'
# Should return: "quality"

curl -X PATCH http://localhost:8000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"openrouter_tool_strategy": "invalid"}'
# Should return: 422 with detail message
```

### 7. OpenRouter Quality Enhancements (Log Inspection)

With OpenRouter provider and model `z-ai/glm-5.1`, send any message. Check logs for:

```
# Should NOT see for OpenAI direct:
# - :exacto in model ID
# - Response Healing plugin
# - parallel_tool_calls in kwargs

# Should see for OpenRouter quality strategy:
# - model ID contains :exacto
# - extra_body with plugins
# - parallel_tool_calls=False
```

### 8. End-to-End Structured Mode

1. Configure OpenRouter + GLM 5.1
2. Send: "Search my documents for 'testing'"
3. Verify:
   - Response contains tool execution (not planning text)
   - No "Now let me search..." in final response
   - Tool result is incorporated into answer

### 9. Zero-Regression Confirmation

1. Configure OpenAI + GPT-4o
2. Send: "Search my documents for 'testing'"
3. Verify:
   - Response is identical in quality and speed to pre-phase behavior
   - No JSON blocks visible in response
   - No extra latency

## Success Criteria

All checks above must pass. Specifically:

- [ ] All 32+ new unit tests pass
- [ ] Existing unit test suite passes (zero regression)
- [ ] TypeScript compilation clean
- [ ] Settings API returns and validates `openrouter_tool_strategy`
- [ ] OpenRouter quality mode appends `:exacto` and adds plugins
- [ ] OpenAI direct path shows no quality enhancements (identical to before)
- [ ] GLM 5.1 structured mode works end-to-end
- [ ] Parse failures are graceful (no crashes, conversation continues)

## Failure Escalation

If any verification check fails:

1. **Test failure**: Fix in current plan, re-run verification
2. **Regression in existing tests**: Immediately stop, investigate root cause, fix before proceeding
3. **End-to-end failure**: Check logs for calling_mode, parser output, and tool_calls_buffer state
4. **Performance regression**: Profile OpenAI path; ensure native mode has zero overhead

---

*Phase: 053-cross-provider-tool-reliability*
*Verification defined: 2026-04-26*
