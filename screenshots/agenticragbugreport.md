# Bug Report — Agent loop terminates after the first tool call

**For:** Claude Code, working in the `Agentic-RAG` repository
**Reported:** 18 Aug 2026
**Severity:** Blocking — no multi-step agent run completes

---

## 1. Summary

The agent plans correctly and fires at least the first tool call, then **stops before executing the remaining steps**. The user sees a completed plan with steps still marked `pending` and no final artifact produced.

This reproduces **across every model tested** (Qwen3.6-35B-A3B, Qwen3-30B-A3B-Instruct-2507, gpt-oss-20b, GLM-4.7-Flash). That, combined with the verified evidence in §3, means **the fault is in the application's agent loop, not in any model, prompt, or inference setting.**

Do not spend time on model selection, quantization, sampling parameters, or inference tuning. Those have been independently verified as correct (§2).

---

## 2. Verified environment — treat as known-good, do not investigate

| Component | Value |
|---|---|
| Inference server | LM Studio 0.4.21, OpenAI-compatible endpoint |
| Base URL | `http://localhost:1234/v1` |
| Primary model id | `qwen3.6-35b-a3b-mtp` |
| Also available | `qwen-agentworld-35b-a3b`, `glm-4.7-flash`, `openai/gpt-oss-20b`, `text-embedding-nomic-embed-text-v1.5` |
| Thinking mode | Disabled — `reasoning_content` is `""` and `reasoning_tokens` is `0` on every response |
| Context window | 32,768 tokens |
| Native tool calling | **Confirmed working** (§3) |

---

## 3. Evidence A — the raw API works perfectly

A hand-built request sent directly to the endpoint, bypassing the application entirely.

**Request:**
```json
{
  "model": "qwen3.6-35b-a3b-mtp",
  "messages": [{"role": "user", "content": "What is the weather in Dubai?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get current weather for a city",
      "parameters": {
        "type": "object",
        "properties": {"city": {"type": "string"}},
        "required": ["city"]
      }
    }
  }]
}
```

**Response:**
```json
{
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "",
      "reasoning_content": "",
      "tool_calls": [{
        "type": "function",
        "id": "9QV1G6noL5hWaDpD0GxAFCMtZhQbGAqF",
        "function": {
          "name": "get_weather",
          "arguments": "{\"city\":\"Dubai\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }],
  "usage": {"prompt_tokens": 277, "completion_tokens": 27, "total_tokens": 304}
}
```

Native `tool_calls` array, correct function name, valid JSON arguments, empty `content` with no leakage, and `finish_reason: "tool_calls"`.

**Conclusion: the model and server emit spec-compliant OpenAI tool calls whenever a `tools` array is supplied.**

---

## 4. Evidence B — what the application produces

### 4.1 A failed run

User prompt: `generate weekly report`

```
Run · 2 steps · 1m 58s
```

Assistant message content rendered to the user:

```
[{"status": "in_progress", "value": "Search knowledge base for weekly report data", "id": "1"},
 {"status": "pending",     "value": "Build replacements dictionary from KB data",    "id": "2"},
 {"status": "pending",     "value": "Generate Word document using template",         "id": "3"}]
```

Followed by a `WRITE_TODOS` panel showing "3 todos".

**The run then ended.** Steps 2 and 3 remained `pending`. No knowledge-base search occurred. No `.docx` was produced.

### 4.2 Two distinct anomalies in that output

**(a) Tool arguments are being rendered as user-visible message text.** The JSON array above appeared as the assistant's prose. In a correct native-tool-calling flow, arguments live in `message.tool_calls[0].function.arguments` and `content` is empty — exactly as in §3.

**(b) Server logs show `Model generated tool calls: []` on multiple turns**, with `finish_reason: "stop"`, while the UI simultaneously displays a `WRITE_TODOS` tool block. This means at least some tool invocations are being recovered by parsing text rather than read from the structured field.

### 4.3 Provider configuration

The UI labels the provider as **`ollama`**, but the requests are being served by LM Studio's OpenAI-compatible endpoint. An Ollama client adapter may reshape or drop the `tools` field when pointed at an OpenAI-compatible URL.

---

## 5. Symptoms to reproduce

1. Agent produces a multi-step plan via `WRITE_TODOS`.
2. First step is marked `in_progress`.
3. Run terminates. Remaining steps stay `pending`.
4. Run label reads `Run · 2 steps` regardless of plan length.
5. Reproduces on all four models.

---

## 6. Ranked hypotheses

### H1 — Loop does not continue on `finish_reason: "tool_calls"` (most likely)

The loop probably terminates whenever a response arrives, or only continues on a condition that never fires. The correct trigger is `finish_reason == "tool_calls"`.

**Check:** locate the agent loop's termination condition. It must be:
```
while response.choices[0].finish_reason == "tool_calls":
    execute each tool_call
    append results as role="tool" messages
    call the model again
```

### H2 — Tool results are not appended back into the message array

If the tool executes but its result is never appended as a `role: "tool"` message carrying the matching `tool_call_id`, the model has no way to continue and will emit a terminal text response.

**Check:** confirm every executed tool call produces:
```json
{"role": "tool", "tool_call_id": "<id from the request>", "content": "<result as string>"}
```
appended immediately after the assistant message that contained the call. The `tool_call_id` must match exactly.

### H3 — `tools` array not sent on every turn

Some turns show `tool_calls: []` with `finish_reason: "stop"`. If `tools` is only supplied on the first request and omitted on follow-ups, the model cannot invoke anything after step one.

**Check:** log the outgoing request body for every turn in a run. Confirm `tools` is present on all of them, not just the first.

### H4 — Text-mode tool parsing competing with native

Evidence 4.2(a) suggests a text-based fallback path is active. If both a text parser and native handling exist, they may conflict — the text path consumes the response and the native path never sees a `tool_calls` array.

**Check:** search for regex or string parsing of `message.content` looking for tool syntax. Remove it in favour of reading `message.tool_calls`.

### H5 — Hard-coded step limit

`Run · 2 steps` on a 3-step plan is suspicious.

**Check:** search for `max_steps`, `max_iterations`, `max_turns` or similar. Confirm the configured value and that the loop isn't exiting on it silently.

### H6 — Ollama adapter dropping `tools`

**Check:** the provider config. Base URL is `http://localhost:1234/v1` (LM Studio), so the client should be a plain **OpenAI-compatible** client, not an Ollama one.

---

## 7. Investigation order

1. **Add request/response logging** for every model call in a run — full body both ways. This alone will discriminate H1/H2/H3 immediately.
2. Run `generate weekly report` and capture the complete sequence.
3. For each turn record: is `tools` present in the request; what is `finish_reason`; is `tool_calls` populated; is a `role: "tool"` message appended afterwards.
4. Fix whichever link is broken.

---

## 8. Reference — the correct message sequence

A complete two-tool agent turn should produce this array:

```json
[
  {"role": "system",    "content": "..."},
  {"role": "user",      "content": "generate weekly report"},
  {"role": "assistant", "content": "", "tool_calls": [{"id": "call_1", "type": "function",
      "function": {"name": "search_kb", "arguments": "{\"query\":\"weekly report\"}"}}]},
  {"role": "tool",      "tool_call_id": "call_1", "content": "<search results>"},
  {"role": "assistant", "content": "", "tool_calls": [{"id": "call_2", "type": "function",
      "function": {"name": "generate_docx", "arguments": "{...}"}}]},
  {"role": "tool",      "tool_call_id": "call_2", "content": "<file path>"},
  {"role": "assistant", "content": "Report generated at ..."}
]
```

Every request in the sequence carries the same `tools` array. The loop exits only when `finish_reason == "stop"`.

---

## 9. Acceptance criteria

- [ ] `generate weekly report` runs all three planned steps to completion
- [ ] A `.docx` file is produced
- [ ] No raw JSON appears in user-visible message content
- [ ] Server logs show `Model generated tool calls: [...]` populated, not `[]`
- [ ] The run continues past 2 steps
- [ ] Every tool result is appended as `role: "tool"` with a matching `tool_call_id`
- [ ] Behaviour is identical when the model is switched to `qwen-agentworld-35b-a3b`

---

## 10. Out of scope

Do not modify or investigate:

- Model choice, quantization, or download
- Inference parameters (temperature, top_p, top_k, min_p, penalties)
- LM Studio load settings (context length, GPU offload, MoE offload, batch sizes, KV cache)
- Hardware, VRAM, or performance tuning
- Thinking / reasoning configuration

All of the above have been independently verified as correct. The defect is confined to the application's tool-calling and agent-loop code.

---

## 11. Note on structured output

Separately, and relevant to the citation pipeline: llama.cpp issue **#19051** (closed as "not planned") means that when a JSON schema converts to GBNF but the grammar then fails to parse, the server logs an error and **continues generating unconstrained while returning HTTP 200**.

Schema enforcement can therefore fail silently. **Validate every model response against the expected schema in application code** rather than relying on server-side enforcement.
