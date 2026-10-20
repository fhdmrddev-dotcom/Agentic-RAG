---
id: BUG-261020-06
title: glm-5.3's registry row (window 30,000 < max output 32,768) leaves a 1,981-token budget, so every search result is trimmed and GLM searches in a loop
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [model-registry, backend/context-window, cross-provider]
folded_into: null
verified_closed_by: "live 2026-10-20 ~20:45: same question on glm-5.3 answered after 2 searches with [n] markers and 4 sources (was 13 searches, no answer)"
related_seeds: []
re_open_trigger: "Any registry row whose max_output_tokens exceeds context_window_tokens, or a context_budget_clamped log line below the system-prompt size; the code guard in Fix direction 2 is still unbuilt"
reproduces_on:
  branch: develop
  commit: 762e74a54
  date: 2026-10-20
---

# BUG-261020-06: glm-5.3's registry row starves the context budget, and GLM searches in a loop

## What we observed

Phase 294 UAT test 8, roster row R5, local app, Zhipu `glm-5.3` (the composer's default Zhipu model), question "Search my documents: what did Northwind's CC6.1 deprovisioning test find? Cite the passages.":

1. The run made 13 `search_documents` calls in 4 min 15 s and never answered; it was stopped by hand (empty assistant message `a4a5c4bc`).
2. Every search returned the right passages (Jev ranked the CC6.1 chunk first at 0.97-0.99), so retrieval was not the cause.
3. GLM's thinking repeated, each round: "the conversation history was trimmed … I don't actually see the content of those chunks … I should perform the search".
4. Backend log `backend.45132.log`, every iteration from 18:51:24 local:
   - `model_capability_unknown model_id=glm-5.3 inferred_provider=zhipu`
   - `context_budget_clamped model=glm-5.3 chain_budget=100000 registry_window=30000 max_output=32768 -> 1981`
   - `trim_messages_to_fit: EXHAUSTED and still over budget — 4304 > 1981 tokens (system prompt alone: 4276)`

The same question on `glm-5.2` (registry-backed, `MODEL_CONTEXT_DEFAULTS` 800,000) answered with 5 markers in one pass.

## Why it matters

The model the composer offers first for Zhipu cannot answer any knowledge-base question; it burns tokens until stopped. The trimmer removes the tool results the model just asked for, and the citation manifest (which survives in the system prompt) tells it sources exist, so it keeps searching.

## Cause

Local `model_capabilities_overrides` row: `glm-5.3 · zhipu · context_window_tokens 30000 · max_output_tokens 32768`. The output limit is larger than the window, which is almost certainly a typo (GLM-5.x windows are around 200K; `glm-5.3-flash` reads 128,000). `resolve_context_budget` reserves the requested output + the measured tool schemas + 10% of the window, which leaves 1,981 tokens. Its self-consistency guard only fires when the reserve is ≥ the window (here 28,019 < 30,000), so the row passed as valid.

## Fix direction

1. Data (operator): correct `glm-5.3`'s Context window in Settings → Model Registry to the vendor's figure (check docs.z.ai). This is the operator's registry value, so it was not edited here.
2. Code (small, worth a test): treat a registry row whose `max_output_tokens` exceeds `context_window_tokens`, or whose clamped budget is smaller than the system prompt, as inconsistent: log it and fall back to the chain budget, as the existing guard already does for `reserve >= window`. Optionally flag `max_output > window` in the Model Registry form.

## Fix (2026-10-20, operator: "fix the glm-5.3 context window for me")

Data only. docs.z.ai/guides/llm/glm-5.3 states *"a 1M-token context window and a maximum output length of 128K tokens"*. Set glm-5.3's Context to **1,000,000** in Control Room → Model Registry (verified in `model_capabilities_overrides`: `context_window_tokens 1000000`, `max_output_tokens 32768` left as the request ceiling). With the window corrected, the budget falls back to the zhipu chain value (100,000) instead of being clamped to 1,981. Re-driven live on the same question: 2 searches, then an answer with [n] markers and 4 sources.

⚠ **Local DB only.** If the cloud registry carries the same row, it needs the same edit after deploy. Fix direction 2, the code guard, is not built; the re_open_trigger names what would bring this back.
