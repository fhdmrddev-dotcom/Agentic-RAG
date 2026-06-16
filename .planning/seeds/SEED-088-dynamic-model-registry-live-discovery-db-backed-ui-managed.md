---
seed_id: SEED-088
title: Dynamic model registry — live per-provider /models discovery + DB-backed, UI-managed model capabilities (zero-code new-model absorption)
status: planted
planted: 2026-06-17
phase_origin: "Phase 111.1 execute-phase conversation (2026-06-17) — operator review of the new embedding/extraction ProviderPicker found hardcoded model arrays; 2-agent model-source audit workflow wf_6d4f132f-d32 mapped how models are sourced today"
category: Cross-cutting model/provider management — additive discovery + storage layer over the EXISTING provider/settings substrate; NOT a re-platform of the LLM call path
related_seeds: [SEED-040, SEED-048, SEED-087]
related_memories: [feedback_prioritize_newest_models, feedback_model_names_representative, feedback_dont_hedge_to_no_new_infra, feedback_separate_per_feature_safe_by_construction, feedback_iterate_leverage_existing, project_cross_provider_native_tools_registry_trap, feedback_cross_provider_full_native_roster]
related_decisions:
  - "Phase 111.1 sequencing decision (2026-06-17): operator chose 'finish 111.1 clean, then dynamic registry as next phase' — the extraction picker gets the SMALL fix now (read from existing provider.models), the embedding picker keeps curated dims-coupled presets, and THIS dynamic registry is the dedicated follow-up phase."
  - "MODEL_CAPABILITIES (config.py:207) is the hardcoded seed/fallback; the DB override layer (get_model_capability_async + model_capabilities_overrides) ALREADY wins over it — this seed promotes DB+discovery to primary and demotes the dict to a seed."
re_open_triggers:
  - Phase 111.1 ships (the embedding feature is done) — this is the operator-confirmed NEXT phase candidate
  - A new provider model is released and someone has to hand-edit config.py MODEL_CAPABILITIES / a provider_models CSV to surface it (the exact pain this kills; dated 'live /models 2026-06-07' comments in config.py prove humans curl + hand-edit today)
  - The pre-production comprehensive review (operator: "once we finish the app we will do a very comprehensive review to make it production ready") — model management is on that list
  - A model is selected whose real context window differs from the inferred default and a request truncates/over-runs (capabilities need to be real, not guessed)
priority: HIGH — operator-confirmed next phase after 111.1; directly serves the stated product principle ("everything manageable from the UI dynamically; only API keys stay as env secrets")
suggested_phase: a dedicated "Dynamic Model Registry" phase immediately after Phase 111.1. ~70% of the storage substrate already exists (see below), so the net-new is the discovery service + capability auto-ingest + a capabilities-editing UI.
---

# SEED-088 — Dynamic model registry (live discovery + DB-backed, UI-managed)

## Operator vision (verbatim intent, 2026-06-17)

Call every integrated provider's `/models` endpoint, auto-pull the model list, and update it
dynamically with **zero code change** — the endpoints + OpenAI-compatible layer are already
established, so a newly-released model "just works." Per-model settings (context window and other
parameters) should be **configurable from the UI and stored in the DB**, not hardcoded. The ONLY
things that stay as env/secrets are the **API keys**. Security is top priority. This is part of the
pre-production comprehensive review.

## Ground truth from the audit (workflow wf_6d4f132f-d32, 2026-06-17)

**What already exists (build ON this — do NOT rebuild):**
- `provider_model_lists` — JSONB column in `app_settings`, per-provider model id lists, ALREADY
  UI-editable via PUT /settings and ALREADY drives the chat composer + sub-agent pickers
  (`GET /settings/providers` → `providers[].models`; `_build_providers` user_settings.py:351).
- `model_capabilities_overrides` — a real DB table (migration `053_settings_unification.sql`),
  read by `_load_model_overrides()` (user_settings.py:282), merged onto the hardcoded dict via
  `get_model_capability_async` (config.py:629; stamps `capability_source="db_override"`). The DB
  layer ALREADY wins over the hardcoded `MODEL_CAPABILITIES`.
- Pattern-inference fallback — `get_model_capability` → `_build_inferred_defaults` via
  `_INFERENCE_PATTERNS` (config.py:361) gives any UNKNOWN model id safe defaults (provider,
  native_tools, token/timeout) → a brand-new model routes correctly with zero registration.
- `_PROVIDER_BASE_URLS` + key resolution (config.py:10-21, resolve_llm_provider) — the single
  source of truth for KNOWN providers + their base_url/key; the discovery service reuses this verbatim.
- DEAD code to revive: `listModels()` (api.ts:168) + `GET /models` (main.py:396) exist but the
  frontend never calls them.

**The gaps (the net-new work):**
1. NO live discovery — nothing calls any provider `/v1/models`; humans curl + hand-edit config.py.
2. The Phase 111.1 embedding/extraction ProviderPicker HARDCODED its model arrays
   (`EMBEDDING_PRESETS` / `EXTRACTION_PRESETS`, ProviderPicker.tsx:49/65) — the only picker needing
   a code edit to add a model (111.1 fixes the EXTRACTION side by reading provider.models; embedding
   keeps curated dims-coupled presets — see the 111.1 decision).

## Capability discoverability — the one nuance that shapes the design

The model LIST is universally discoverable; CAPABILITIES (context window etc.) are only partial:

| Provider | list | capabilities from /models |
|---|---|---|
| Google (`models.list`) | ✅ | ✅ rich — `inputTokenLimit`, `outputTokenLimit`, supported methods |
| OpenRouter (`/api/v1/models`) | ✅ | ✅ richest — `context_length`, pricing, supported params |
| Ollama (`/api/show`) | ✅ | ⚠️ partial — context length for many models |
| OpenAI / Anthropic / DeepSeek / Moonshot / GLM / MiniMax | ✅ | ❌ sparse — `{id, owned_by}` only |

## Target architecture (3 tiers)

1. **Discover the list** — a backend model-discovery service calls each configured provider's
   `/models` (OpenAI-compat `/v1/models` for openai/google-compat/openrouter/deepseek/moonshot/
   minimax/zhipu/lmstudio/ollama; native for anthropic; Ollama `/api/tags`), reusing the existing
   base_url/key resolution, cached (TTL or Redis). Populates `provider_model_lists`. New model
   appears automatically.
2. **Auto-ingest capabilities where exposed** (Google `inputTokenLimit`, OpenRouter
   `context_length`/pricing, Ollama `/api/show`) → seed `model_capabilities_overrides`.
3. **Inference + UI override for the rest** — sparse providers' models still WORK immediately via
   the existing inference defaults; the operator edits context window/params in a capabilities UI,
   persisted to `model_capabilities_overrides`. `MODEL_CAPABILITIES` dict demoted to a seed/fallback.

All pickers (chat, extraction, embedding) then read from this one source; revive `listModels()`.

## Security (operator priority)

- API keys remain env/secrets, used SERVER-SIDE only by the discovery service — never sent to the
  frontend. Discovered model lists + capabilities are non-secret → DB + UI is appropriate.
- Confirm RLS/scope of `provider_model_lists` + `model_capabilities_overrides` (app-global config
  vs per-user) during phase design; validate discovery-fetch failures degrade gracefully (fall back
  to stored/inferred — never block the chat path).

## Out of scope / guardrails
- NOT the LLM call path itself (free-text model id → completion already works + degrades gracefully).
- Fold into the pre-production comprehensive review the operator flagged.
