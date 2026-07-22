---
id: BUG-260623-01
title: Title-gen "Model X unavailable — using Y" banner when sub_agent_model points cross-provider
reported: 2026-06-23
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/title-generation, backend/sub-agent-model-resolution, cross-provider-parity]
folded_into: 175
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: aef2c6d0
  date: 2026-06-23
---

# BUG-260623-01: Title-gen "Model X unavailable — using Y" banner when sub_agent_model points cross-provider

## What we observed

During Phase 122 SC#10 cross-provider UAT (switching the chat model across providers and sending an `execute_code`-triggering prompt), a banner appeared on the **first message of a new thread**:

> Model gpt-5.4-mini unavailable — using gemini-3.5-flash

The substitute varied by active provider (e.g. on Anthropic it read "…using Haiku"). Crucially it appeared **only on the multi-model providers — Anthropic and Google — and NOT on DeepSeek, MiniMax, GLM (zhipu), or Kimi (moonshot)**. The chat itself worked fine and the `execute_code` panel labels were concrete on every provider (TDP-01 passed); the banner is orthogonal to the agent run.

## Why it matters

Minor / cosmetic + a small latency cost. The notice itself is *honest* (it correctly tells the user a substitution happened), but:
- It names a model the user did NOT pick for that chat (`gpt-5.4-mini`), which is confusing.
- It costs one wasted 404 round-trip on the first message of every new thread on a non-OpenAI multi-model provider.
- It's an uneven cross-provider experience — a parity gap, which is on-theme for the v3.1 trust/clarity work even though it's outside Phase 122's scope.

In normal single-provider use it never appears; it surfaces only when the active provider differs from the (OpenAI) `sub_agent_model`.

## Hypothesized cause

CONFIRMED by code + live DB read (not just a hypothesis):
- The thread-title generator (`backend/app/api/threads.py:658-692`) routes title-gen for **multi-model providers** (openai/anthropic/google/openrouter) to the global `sub_agent_model` override (`user_settings.sub_agent_model or settings.sub_agent_model`). Live `app_settings.sub_agent_model = "gpt-5.4-mini"` (an OpenAI model).
- On a non-OpenAI active provider, that OpenAI model is sent to the provider's endpoint → `openai.NotFoundError` (404) → the app falls back to `_SUB_AGENT_MODEL_DEFAULTS[provider]` (`config.py:693`: anthropic→claude-haiku-4-5, google→gemini-3.5-flash) and emits a `fallback_model` event → the banner (`useMessages.ts` `fallbackNotice`).
- **Single-model providers** (`_SINGLE_MODEL_PROVIDERS = {deepseek, moonshot, minimax, zhipu, ollama}`, `threads.py:606`) use the user's MAIN model for title-gen, so there's no separate model to 404 → no banner. This exactly matches the uneven observation.
- The same blind cross-provider override pattern exists in the follow-up suggestion path (`suggestion_service.py` / `agent_loop.py:2422`) and sub-agent paths (`sub_agent_service.py:141`, `task_service.py`).

NOT a Phase 122 regression — `threads.py` / `sub_agent_service.py` / `suggestion_service.py` are untouched by Phase 122; the sub-agent defaults were last changed in commit `e6a50e24` (096-08 model curation).

## Surface classification

`Agentic-RAG` — this app's backend title/suggestion sub-agent model resolution. Cross-checked at `/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a — pre-existing, outside Phase 122's MP-01/02/03/TDP-01 scope.
- **Defer to future phase / milestone:** a small cross-provider-parity hardening — natural adjacency to STRETCH Phase 128 (TDP-02) or a new MP follow-up; consider at the next v3.1 discuss-phase that touches provider routing.
- **Plant as seed:** optional — the general principle "a single global model setting must never be applied cross-provider" could seed a broader audit of `sub_agent_model` / `extraction_model` / authoring-model resolution.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- **Config (applied in local dev 2026-06-23):** cleared `app_settings.sub_agent_model` (`'gpt-5.4-mini' → ''`) so title-gen uses the per-provider default directly — no cross-provider 404, no banner. OpenAI behavior is unchanged (its default IS gpt-5.4-mini). Revert: `update app_settings set sub_agent_model='gpt-5.4-mini';`. Equivalent via the Settings UI (clear the sub-agent model field).
- **Code (proper fix):** guard the title-gen + suggestion override to ignore a `sub_agent_model` whose inferred provider ≠ the active provider (fall through to `_SUB_AGENT_MODEL_DEFAULTS[provider]`), so a stale/cross-provider global setting can't trigger the 404-then-fallback path at all.

## Reference / evidence links

- `.planning/phases/122-cross-provider-trust-honesty-parity/122-HUMAN-UAT.md` (SC#10 observation + Gaps note)
- `backend/app/api/threads.py:606` (`_SINGLE_MODEL_PROVIDERS`), `:658-692` (`generate_thread_title` override resolution)
- `backend/app/config.py:693` (`_SUB_AGENT_MODEL_DEFAULTS`), `:940` (`sub_agent_model` default `""`)
- `backend/app/services/sub_agent_service.py:130-148` (`fallback_model` sentinel emit), `suggestion_service.py:80-86`
- Live `app_settings`: `sub_agent_model='gpt-5.4-mini'`, `llm_model='gpt-5.4-mini'` (pre-fix)
