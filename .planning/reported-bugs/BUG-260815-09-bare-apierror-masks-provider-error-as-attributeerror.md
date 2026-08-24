---
id: BUG-260815-09
title: A bare openai.APIError is masked as "An unexpected error occurred (AttributeError)", discarding the provider's real message
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/agent-loop, backend/provider-gateway, cross-provider, local-models]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 1f363f32
  date: 2026-08-15
---

# BUG-260815-09: A bare `openai.APIError` is masked as `AttributeError`, discarding the provider's real message

## What we observed

Chatting against a local **LM Studio** server (OpenAI-compatible, `http://127.0.0.1:1234`, model `openai/gpt-oss-20b`, selected in the composer under the **Ollama** provider) the UI rendered:

> *An unexpected error occurred (AttributeError). Please try again.*

LM Studio's own Developer Log showed the request had arrived and been processed, and named the real failure precisely:

```
[INFO]  [gpt-oss-20b] Running chat completion on conversation with 2 messages.
[INFO]  [gpt-oss-20b] Streaming response...
[ERROR] The number of tokens to keep from the initial prompt is greater than the
        context length (n_keep: 8360 > n_ctx: 4096). Try to load the model with a
        larger context length, or provide a shorter input.
```

So the provider produced a clear, actionable message and the app replaced it with a generic one naming a Python exception type.

**Reproduced directly** (not inferred) by driving the live LM Studio server through the same SDK path `openai_compat.py` uses — `openai` SDK, `base_url` override, `stream=True`, oversized prompt:

```
openai.APIError: The number of tokens to keep from the initial prompt is greater
than the context length (n_keep: 120081 >= n_ctx: 33280). ...
```

The SDK raises the **base** `openai.APIError`, not an `APIStatusError` subclass.

**Root cause confirmed against the pinned SDK:**

```python
>>> openai.APIError('x', request=None, body=None).status_code
AttributeError: 'APIError' object has no attribute 'status_code'
```

`agent_loop.py::_is_transient_provider_error` read it as a plain attribute:

```python
if e.status_code in (502, 503, 529):     # unguarded
    return True
try:
    code = e.body.get("error", {}).get("code")
    ...
except (AttributeError, TypeError):      # guarded
    pass
```

The helper is called from inside `except (APIError, AnthropicAPIError)`. Raising `AttributeError` *inside* that handler escapes it, unwinds past every per-provider classification branch, and lands in the generic `except Exception`, which formats `type(e).__name__` — hence `(AttributeError)`.

## Why it matters

**The bug is a lie, not a crash.** The run fails either way; what was lost is the *explanation*. The user is told something unexpected happened, when the app had been handed a precise diagnosis ("your context window is too small") one frame earlier. It cost a full debugging session with a screenshot to recover information the app already had.

**It was broader than the symptom.** Driving the new regression suite against the pre-fix code failed **11 of 16** cases, not 1. Because the unguarded read raised on line 1 of the helper, the two *later* detection paths never executed for any bare `APIError`:

- the `e.body["error"]["code"]` path — **this is the OpenRouter shape**, where the real upstream code lives in the body rather than the HTTP status
- the message-text path (`"bad gateway"`, `"service unavailable"`, `"upstream"`)

So transient-retry detection was **entirely non-functional** for bare `APIError`s, and a genuinely retryable 502/503/529 arriving in that shape was never retried.

**Blast radius is every OpenAI-compatible backend**, because a mid-stream failure arrives inside the SSE body with no HTTP status to read: LM Studio, llama.cpp, vLLM, Ollama's compat endpoint — plus any hosted provider reporting a mid-stream failure the same way.

## Hypothesized cause

Not a hypothesis — **verified**. `openai.APIError` is the SDK base class and defines no `status_code`; only `APIStatusError` subclasses (`BadRequestError`, `RateLimitError`, …) do.

Worth recording *why it survived*: the pattern was understood everywhere except this one line. Both call sites already read the attribute defensively — `getattr(provider_err, "status_code", None)` at the request-too-large check and again in the retry log — and the `e.body` access two lines below sits inside an `except (AttributeError, TypeError)`. `_is_transient_provider_error` had **zero test coverage**, which is how a single unguarded read survived surrounded by guarded ones.

## Surface classification

`Agentic-RAG` — the defect is entirely in this app's error-handling path. LM Studio behaved correctly and reported an accurate error; we discarded it.

## Suggested routing

- **Fold into in-flight phase:** n/a — fixed directly as a bounded backend fix (G-3: 1 file, 1 line of behavior change, no schema or API surface).
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** no
- **External — note only:** no

## Fix

`backend/app/services/agent_loop.py` — one line:

```python
if getattr(e, "status_code", None) in (502, 503, 529):
```

Guarded by `backend/tests/unit/test_transient_provider_error_bare_apierror.py` (16 cases), which was **driven RED against the pre-fix source** — 11 failed with the unguarded read planted back, 16 pass with the fix. Includes a permanent positive control (`test_the_unguarded_read_really_does_raise`) that goes red if the SDK ever adds `status_code` to the base class, since Test 1 would then be guarding nothing.

Verified end to end: the LM Studio message now routes to `kind = "context_overflow"` via the existing keyword pre-check and reaches the user as
*"The conversation has grown too long for this model's context window. Please start a new chat or reduce history."*

## Known follow-up (NOT fixed here)

⚠ **The `context_overflow` copy is written for hosted models and is subtly wrong for local ones.** It advises *"start a new chat or reduce history"*. For a local server the real remedy is usually **load the model with a larger `n_ctx`** — the user's history may be perfectly reasonable while the model was simply loaded at 4096. The copy is honest and vastly better than `AttributeError`, so it ships as-is; rewording provider-error copy is a separate, deliberate decision and not something to smuggle into a one-line fix.

## Reference / evidence links

- Screenshot: `screenshots/Screenshot 2026-08-15 202546.png` (app error left, LM Studio Developer Logs bottom-right)
- Repro path: `backend/app/services/provider_gateway/openai_compat.py:258-274` (chunk loop — correctly guarded, NOT the fault)
- Defect: `backend/app/services/agent_loop.py::_is_transient_provider_error`
- Call site: `agent_loop.py` `except (APIError, AnthropicAPIError)` → transient check
- Outer handler that now receives it: `agent_loop.py` `except (APIError, anthropic.APIError, google_errors.APIError)` → `context_overflow` pre-check
- Context: Ollama was **not** running during the repro (port 11434 refused); the "Ollama" provider was pointed at LM Studio on 1234.
