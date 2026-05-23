---
id: BUG-260523-02
title: Gemini 3 / 3.5 fail with "Function call is missing a thought_signature" on multi-tool agent rounds
reported: 2026-05-23
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/streaming, backend/openai-compat, google-genai, chunk-handler, tool-rounds]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 46e8a63
  date: 2026-05-23
---

# BUG-260523-02: Gemini 3 tool-call rounds drop the `thought_signature` field, causing 400 INVALID_ARGUMENT

## What we observed

Selecting `gemini-3-flash-preview` or `gemini-3.1-pro-preview` or `gemini-3.5-flash` as the active model and sending a prompt that triggers a tool call (e.g., the "search Fahed Mrad dissertation, make a professional pptx…" test prompt that exercises `query_documents` + `execute_code`) reproduces a hard 400 from Google's API after the first tool result is sent back:

```
LLM API error: Error code: 400 - [{'error': {'code': 400, 'message':
  'Function call is missing a thought_signature in functionCall parts.
   This is required for tools to work correctly, and missing
   thought_signature may lead to degraded model performance.
   Additional data, function call default_api:query_documents,
   position 2. Please refer to
   https://ai.google.dev/gemini-api/docs/thought-signatures
   for more details.',
  'status': 'INVALID_ARGUMENT'}}]
```

DB evidence (`runs` rows queried 2026-05-23 01:40Z, local Supabase):

| run_id excerpt | model                  | status | duration | error  |
|---|---|---|---|---|
| `01:40:37` | `gemini-3.1-pro-preview` | failed | 10s | `BadRequestError: 400 … 'Function call is missing a thought_signature'` |
| `01:39:28` | `gemini-3.5-flash`       | failed | 7s  | same error |

`gemini-2.5-pro` succeeded on the same prompt (121s, completed) — confirming this is **Gemini 3 series specific**, not a general Google-route regression.

## Why it matters

Tool use is completely broken on Gemini 3 / 3.5 series. Any agent flow that calls more than one tool (which is the default for the document-RAG + sandbox pipeline) fails on the **second** model turn. This effectively makes Gemini 3 unusable for the app's primary workflow.

Plan 01 of Phase 075.3 just shipped the defensive chunk handler that ensures Gemini token rows are populated — so we now correctly stream Gemini 3 *content* and we correctly bill it, but the moment a tool is involved the run dies.

## Hypothesized cause

Gemini 3 introduced a new requirement: when the model emits a `functionCall` part in its response, that part also carries a `thought_signature` field. The next turn that sends the function-result back to Gemini **must echo the corresponding `thought_signature`** in the assistant message that contained the function call. This is documented at https://ai.google.dev/gemini-api/docs/thought-signatures.

Grep evidence (2026-05-23): `grep -rn "thought_signature" backend/` returns **zero matches**. Our OpenAI-compat path through `openai_service.py` → `_on_chunk_openai` at `backend/app/api/threads.py:1856-1947` captures `delta.tool_calls[*].id`, `name`, and `arguments` into `tool_calls_buffer` (lines 1886-1947), but never reads or forwards `thought_signature` from the chunk. The assistant message we serialize back into the next round's `messages` list therefore omits it.

This is a Gemini-specific OpenAI-compat extension — OpenAI / OpenRouter / Anthropic do not have this field, so the OpenAI SDK type used to deserialize Gemini chunks may silently drop it (OpenAI SDK pydantic models reject unknown fields by default or stash them in `model_extra`).

## Suggested fix path

Two steps (small + tested):

1. **Capture** the thought_signature on Google chunks in `_on_chunk_openai` — read it from each `delta.tool_calls[i]` (likely via `getattr(tc, 'model_extra', {}).get('thought_signature')` or by reaching into the raw chunk dict before SDK pydantic parsing strips it). Store alongside id/name/arguments in `tool_calls_buffer[idx]`.
2. **Forward** the captured signature when serializing the assistant message back into the `messages` array for the NEXT model turn — add `"thought_signature": <captured value>` next to `"function_call"` in the assistant message dict, **only when the active provider is Google**.

Per-provider gate (mirroring Phase 075.3's defensive handler pattern):
- google → echo thought_signature on every tool round
- openai / openrouter / anthropic-via-compat → unchanged

Unit test: extend `backend/tests/unit/test_chunk_handler_provider_aware.py` with a Google chunk fixture that has `thought_signature` populated, assert it's captured. Add an integration test (or at minimum a manual UAT row) on `gemini-3-flash-preview` doing a 2-iteration tool flow.

## Related

- Phase 075.3 Plan 01 — closed the Google content-streaming + token-rows defects, but did NOT cover the multi-iteration tool path (Plan 01 UAT only tested single-turn `hi` prompts on all 6 Gemini models)
- D-075.3-19 (Plan 01 share) — `6/6 Gemini UAT green` is technically accurate but misleading on the agent-flow path because it never exercised tool rounds
