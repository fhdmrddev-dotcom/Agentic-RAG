---
seed_id: SEED-028
title: Native Google SDK split — mirror anthropic_service.py shape for Gemini, retire OpenAI-compat shim for Google traffic only
status: planted
planted: 2026-05-22
scheduled: null
scheduled_phase: null
phase_origin: quick-task 260522-gdg (Google empty-stream root-cause + Phase 075.3 scope-shaping discussion)
related_seeds: [SEED-012, SEED-024]
relates_to:
  - `backend/app/services/anthropic_service.py` (298 LOC) — the precedent shape this seed would replicate for Google
  - `backend/app/services/openai_service.py:880-893` — current Google routing through OpenAI-compat with a per-provider gate (Path A hotfix from 260522-gdg)
  - `backend/app/api/threads.py:1623` — the `if active_provider_name == "anthropic":` branch the Google split would mirror as `elif active_provider_name == "google":`
  - `backend/app/config.py:12` — Google's OpenAI-compat base URL `https://generativelanguage.googleapis.com/v1beta/openai/` (would be retired or kept as fallback)
  - `.planning/PRDs/v3.1.md:47-48` — v3.1 Provider key management UI + `model_capabilities_overrides` table (natural co-tenant for this work)
  - `.planning/quick/260522-gdg-google-15-iter-loop-diagnostic/260522-gdg-SUMMARY.md` — origin context for the deferral decision
  - `feedback_preserve_engine_optionality` (memory) — supports the architectural symmetry argument

re_open_triggers:
  - **(Primary)** v3.1 plan-phase opens AND Provider key management UI is being scoped — the native Google SDK + UI are natural same-phase work since both touch "provider-level configuration surface"
  - **(Quality)** Phase 075.3 ships AND its defensive chunk handler experiences a regression on a new compat-layer quirk Google introduces (signals the OpenAI-compat path is fragile by nature, not by today's bug)
  - **(Feature)** Multi-modal Gemini features (image input, video input, audio) get requested by users or surface in product roadmap — the OpenAI-compat layer doesn't expose these well; native SDK does
  - **(Architectural)** Any third provider (e.g., Cohere, Mistral direct) needs its own service; at that point "three native services + one shared OpenAI-compat shim for OpenAI/OpenRouter/Ollama only" is the clean shape
  - **(Cost/observability)** v3.4 spend caps need accurate `runs.input_tokens` / `runs.output_tokens` on Google — the Phase 075.3 defensive handler should solve this, but if Google's per-chunk usage shape changes upstream and breaks accounting again, that's an argument for SDK isolation

priority: MEDIUM (architectural cleanup; not blocking; the Phase 075.3 defensive chunk handler closes the functional gap)
suggested_phase: v3.1 (alongside Provider key management UI) OR a v2.7 polish slot if Phase 075.3 ships unstable
surface: Agentic-RAG
trigger_when: unset
---

# SEED-028 — Native Google SDK split

## What we'd do

Replicate the Anthropic pattern for Google:

1. **New service: `backend/app/services/google_service.py`** (~300 LOC, mirroring `anthropic_service.py`'s 298). Exposes `stream_google(...)`, `_convert_messages_to_google(...)`, `_convert_tools_to_google(...)`. Uses the official `google-genai` SDK (or whichever Google ships at the time — formerly `google-generativeai`, now consolidating).
2. **New agent-loop branch in `threads.py`** — add `elif active_provider_name == "google":` at line ~1623 alongside the existing `if active_provider_name == "anthropic":`. Same shape: `_on_chunk_google` handler, usage event yields, tool_args_progress emit on the native equivalent of `input_json_delta`.
3. **Retire the OpenAI-compat path for Google** — `config.py:_PROVIDER_BASE_URLS["google"]` no longer needed; `_NO_PARALLEL_TOOL_CALLS = {"google"}` workaround in `openai_service.py:790` removed (native SDK has its own param shape); finish_reason mapping for Google entries (`STOP`, `MAX_TOKENS`, etc. in `openai_service.py:776-780`) moves to the new service.
4. **Integration tests** — parity with `test_059_disconnect.py`, `test_066_per_call_timer.py`, `test_073_concurrency.py` patterns. New `test_google_streaming.py`.
5. **LangSmith integration** — extend the per-provider chat_name tagging from Phase 075.1-04 to Google (`ChatGoogle`).

## Why we deferred (and what stayed)

- **Phase 075.3's defensive chunk handler closes the user-facing bug at a fraction of the cost.** The compat layer can be made robust enough to not silently discard content. Native split is no longer the *cheapest* fix.
- **The Path A hotfix (260522-gdg) and Phase 075.3 together restore Google to feature parity** for the current product surface (chat, tool calling, code execution, search). Multi-modal features that would *require* the native SDK aren't on the v2.6 / v2.7 / v3.0 roadmap.
- **Architectural appeal stands.** Anthropic was split for the same reason; eventually Google should be too. But "should" is not "must this milestone."

## Why this fits v3.1 specifically

v3.1 (Operator UX) ships:
- Provider key management UI (`.planning/PRDs/v3.1.md:47` — "list providers (OpenAI, Anthropic, OpenRouter, Google, Tavily, Cohere)")
- `model_capabilities_overrides` table (`.planning/PRDs/v3.1.md:165` — full schema for admin-tunable per-model knobs)
- Per-provider connection-test button (`.planning/PRDs/v3.1.md:48` — calls `/embeddings` or `/models` probe)

A native Google SDK split is the natural backend correlate of "Google has first-class admin-shell parity with Anthropic." Same milestone, same theme, same RLS+role plumbing.

## Cost estimate (rough — for v3.1 scoping)

| Plan | LOC | Risk |
|---|---|---|
| `google_service.py` skeleton + tool converter | ~300 | LOW (Anthropic precedent) |
| `threads.py` branch + chunk handler + token accumulator parity | ~150 | MEDIUM (must mirror 5 cross-cutting features: per-call timeout, tool_args_progress, usage events, LangSmith tagging, drain-into-queue) |
| Integration tests + Chrome MCP UAT on 5 Gemini models | ~200 LOC tests | LOW |
| OpenAI-compat shim cleanup for Google (delete `_NO_PARALLEL_TOOL_CALLS` entry, finish_reason map entries, base URL row) | ~30 LOC | LOW |
| **Total** | **~680 LOC** | **~3 plans, ~1.5 days** |

## What NOT to do at re-open time

- Don't re-introduce the diagnostic logging from quick-task 260522-gdg. Write fresh diagnostics against the native SDK's chunk shape, not against the OpenAI SDK's.
- Don't split JUST for the architectural appeal. Pair it with a concrete v3.1 user-facing surface (Provider key UI + multi-modal Gemini OR connection-test affordance).
- Don't retire the OpenAI-compat path for OpenRouter or Ollama — they're *designed* to be OpenAI-compatible; they belong on that highway.

## Open questions for re-open plan-phase

1. **Which Google SDK?** `google-genai` is the consolidated successor (2025+); `google-generativeai` is deprecated. Verify the chosen package at plan-phase time — Google's SDK landscape shifts.
2. **Vertex AI vs. AI Studio routing?** Native SDK can target either. Default to AI Studio (matches current OpenAI-compat target); Vertex stays an optional config knob.
3. **Function-calling schema translation.** Google's tool format differs from OpenAI's; need a converter analog to `_convert_tools_to_anthropic`. Verify Gemini 3.x preview models' schema shape — the `gemini-3-flash-preview` / `gemini-3.1-pro-preview` entries in `MODEL_CAPABILITIES` may have evolved.
4. **Token accounting accuracy.** Phase 075.3's defensive handler will solve this on the compat path; native SDK exposes it directly. Confirm the numbers match between paths during the migration window.
