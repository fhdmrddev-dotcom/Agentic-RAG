# Inference Environment Reference — Agentic-RAG local development

**For:** Claude Code working in the `Agentic-RAG` repository
**Purpose:** context on the local inference stack, so you don't misread its behaviour as application bugs
**Verified:** 18 Aug 2026

---

## 1. Hardware

| Component | Spec |
|---|---|
| Machine | Acer Nitro V 15 (ANV15-51), Windows 11 |
| CPU | Intel 13th-gen H-series |
| GPU | NVIDIA RTX 4050 Laptop, **6 GB VRAM** (driver 32.0.16.1047) |
| iGPU | Intel UHD (drives the display, so the 4050 is free) |
| RAM | **48 GB DDR5** (47.7 GB usable) |
| Storage | 2× NVMe (WD SN740 512 GB, WD_BLACK SN7100 1 TB) |

**The binding constraint is 6 GB of VRAM against a ~22 GB model.** Most of the model lives in system RAM. This is why inference is slower than a cloud endpoint, and it is expected — not a defect.

---

## 2. Inference server

| Item | Value |
|---|---|
| Software | LM Studio 0.4.21 (Build 2) |
| API | OpenAI-compatible |
| Base URL | `http://localhost:1234/v1` |
| Auth | none |
| Streaming | supported |

### Available model identifiers

Use these exact strings in the `model` field:

```
qwen3.6-35b-a3b-mtp              <- primary
qwen-agentworld-35b-a3b          <- agentic-tuned alternative
glm-4.7-flash
openai/gpt-oss-20b
text-embedding-nomic-embed-text-v1.5   <- embeddings
```

A wrong `model` string returns an error that superficially resembles a connection failure. Check this first when debugging.

---

## 3. Primary model

**`qwen3.6-35b-a3b-mtp`** — Qwen3.6-35B-A3B, Unsloth Dynamic Q4_K_XL GGUF.

| Property | Value | Why it matters |
|---|---|---|
| Architecture | MoE, 41 layers, 256 experts, 8 active | Only ~3B of 35B parameters run per token |
| Quantization | UD-Q4_K_XL, ~22 GB | Q4 is the floor for reliable tool calling and JSON |
| Context window | **32,768** (model supports 262,144) | Prompts above this are rejected — see §5 |
| Thinking mode | **disabled** | `reasoning_content` is `""`, `reasoning_tokens` is `0` on every response |
| Native tool calling | **verified working** | See §6 |
| Vision | not enabled | Text only |
| MTP (speculative decoding) | on, 79–100% draft acceptance | Free speedup, no behavioural effect |

---

## 4. Load configuration and rationale

These are set in the LM Studio GUI at model load. Listed so you understand the constraints, **not so you change them.**

| Setting | Value | Reason |
|---|---|---|
| Context Length | 32768 | Fits VRAM alongside experts. Preallocated at load. |
| GPU Offload | 41 (all layers) | Max |
| **MoE weights forced to CPU** | **41** | The key setting. Keeps attention + KV cache on the GPU, pushes bulky expert weights to system RAM. Lowering this to 0 caused a **168-second** prefill. |
| Evaluation Batch Size | 4096 | Prompt-processing throughput |
| Physical Batch Size | 1024 | Prompt-processing throughput |
| Max Concurrent Predictions | **1** | Higher values can split the context across slots |
| Flash Attention | on | Required for V-cache quantization |
| K / V Cache Quantization | Q8_0 | Lets 32k context fit in 6 GB |
| Offload KV Cache to GPU | on | Core of the split strategy |
| Speculative Decoding | MTP (2 / 0 / 0.75) | Uses the model's own multi-token-prediction head |

---

## 5. Performance characteristics — read before filing a perf bug

Local inference on this machine has a very different profile from a cloud API. **Prompt processing dominates.**

| Operation | Measured |
|---|---|
| Token generation | **16+ tok/s** |
| Small prompt (~200 tokens) | 3–5 s total |
| Medium turn (4–6 messages) | 4–17 s |
| Large agent turn with retrieved context | **~50 s** |

**Implications for application design:**

- **Time-to-first-token is the bottleneck, not generation speed.** Optimise prompt size before anything else.
- **Every request reprocesses the entire prompt from scratch.** Logs show `Prompt processing progress: 0.0% → 100.0%` on each call, meaning no prefix cache reuse is occurring.
- **Prompt ordering is a real optimisation.** llama.cpp can reuse the KV cache for an unchanged prefix. Put stable content first — system prompt, tool definitions, instructions — and volatile retrieved chunks **last**, immediately before the question. If freshly retrieved documents are injected near the top, the prefix changes every turn and the whole cache is discarded.
- **Timeouts must be generous.** Default HTTP client timeouts of 30 s will abort legitimate requests. Allow at least 180 s.
- **Sequential tool calls multiply the wait.** A 3-step agent run means three full prefills. Prompt size compounds.

---

## 6. Tool calling — verified working

A direct API call bypassing the application confirms spec-compliant behaviour:

**Request** included a standard OpenAI `tools` array.

**Response:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "",
      "reasoning_content": "",
      "tool_calls": [{
        "type": "function",
        "id": "9QV1G6noL5hWaDpD0GxAFCMtZhQbGAqF",
        "function": {"name": "get_weather", "arguments": "{\"city\":\"Dubai\"}"}
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

**The model emits native `tool_calls` whenever a `tools` array is supplied.** Read `message.tool_calls`; do not parse `message.content` for tool syntax.

---

## 7. Sampling parameters

**LM Studio's GUI sampling settings do NOT apply to API requests.** The application must send its own values explicitly or it gets engine defaults.

Qwen's official recommendations for this model:

```json
{
  "temperature": 0.7,
  "top_p": 0.80,
  "top_k": 20,
  "min_p": 0.0,
  "presence_penalty": 0.0,
  "repetition_penalty": 1.0
}
```

Two notes specific to RAG:

- **`min_p` must be 0.0.** The engine default is 0.1, which is wrong for this model.
- **`presence_penalty` must be 0.0** for retrieval work. It discourages token reuse, which fights verbatim quoting from source documents and degrades citation fidelity. Qwen also warn that higher values cause occasional language mixing.

For deterministic tool calling, `temperature: 0` is worth testing.

---

## 8. Structured output caveat

llama.cpp issue **#19051** (closed as "not planned"): when a JSON schema converts to GBNF successfully but the grammar then fails to *parse*, the server logs an error and **continues generating unconstrained while returning HTTP 200**.

Schema enforcement can fail silently and the caller sees a success response containing malformed data.

**Always validate model responses against the expected schema in application code.** Do not rely on server-side grammar enforcement for the citation pipeline.

Related: issue **#25967** — Harmony-format models (gpt-oss) emit duplicate GBNF rule names once a request carries ~17 or more tools, producing HTTP 400. Relevant if the tool registry grows.

---

## 9. Controlling LM Studio from the command line

LM Studio ships a CLI called `lms`. You can use it directly.

### Inspect
```bash
lms status                 # server status
lms ps                     # currently loaded models
curl http://localhost:1234/v1/models
```

### Stream logs live — most useful for debugging this app
```bash
lms log stream
```
Shows every incoming request, prompt-processing progress, generated tool calls, and the full prediction JSON in real time. **Run this in a second terminal while reproducing the agent-loop bug** — it reveals exactly what the model returned versus what the application did with it.

### Load / unload
```bash
lms load qwen3.6-35b-a3b-mtp --context-length 32768 --gpu max --identifier qwen3.6-35b-a3b-mtp
lms unload --all
lms load <model> --estimate-only     # check memory fit without loading
```

### What the CLI cannot set

`lms load` exposes only `--gpu`, `--context-length`, `--ttl`, `--identifier`, `--estimate-only` and `--host`.

It **cannot** set the MoE-to-CPU offload, batch sizes, KV cache quantization, or Flash Attention. Those are GUI-only (or reachable via the `lmstudio-python` / `lmstudio-js` SDKs).

**Practical consequence:** if you unload and reload via CLI, the carefully tuned settings in §4 are lost and prefill performance collapses. **Do not unload the model.** If a reload is unavoidable, ask the user to reload it from the GUI, where "Remember settings for qwen3.6-35b-a3b-ud" restores the tuned configuration.

---

## 10. Constraints summary

1. Model id must be exactly `qwen3.6-35b-a3b-mtp`
2. Context ceiling is 32,768 tokens — total, including the response
3. HTTP timeouts must allow at least 180 s
4. Send sampling parameters explicitly; GUI values do not apply
5. Read `message.tool_calls`, never parse `message.content`
6. Validate all structured output application-side
7. Do not unload the model from the CLI
8. Prefill dominates — reduce prompt size and keep the prefix stable
