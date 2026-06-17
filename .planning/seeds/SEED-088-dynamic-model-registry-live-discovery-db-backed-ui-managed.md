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

---

## Addendum (2026-06-17): verify-work 111.1 extraction-probe findings — design inputs for dynamic pulling

A live cross-provider metadata-extraction probe (the app's REAL `extract_metadata_enriched` →
`forced_emit` path, scripts/_uat111_1/xprovider_extract.py, two workflow sweeps + adversarial
verification, all failures reproduced live) surfaced concrete reasons the hardcoded picker
defaults are insufficient and what dynamic pulling MUST account for. The picker
(`EXTRACTION_PRESETS`) was trimmed to live-confirmed-working models pending this work.

### Extraction scoreboard (forced-emit metadata path, single sample doc)

| Provider | Model | Result | Cause |
|---|---|---|---|
| OpenAI | gpt-5.4-mini | ✅ full (7 fields) | TIER-FORCE + strict=False handled |
| Anthropic | claude-sonnet-4-6 | ✅ full (7 fields) | native forced emit |
| OpenRouter | deepseek/deepseek-chat | ✅ full (7 fields) | — |
| Moonshot | moonshot-v1-8k, kimi-k2.6 | ✅ full (7 fields) | TIER-COERCE |
| DeepSeek | deepseek-chat | ✅ full (7 fields) | TIER-COERCE |
| Zhipu/GLM | glm-4.5 | ✅ full (6 fields) | TIER-FORCE works |
| MiniMax | MiniMax-M2 | ⚠️ WEAK (n_fields=1, title+type null) | forced emit returns near-empty map |
| Google | gemini-2.5-flash/-pro/-lite, 3-flash-preview, 3.5-flash | ❌ `model_failed_to_emit` | Gemini won't commit the forced tool call for the optional-heavy schema — on BOTH cross-provider OpenAI-compat AND native adapter paths |
| DeepSeek | deepseek-v4-flash | ❌ `provider_error` (400 "Thinking mode does not support this tool_choice") | registry `forced_emission:True` routes a thinking model onto force_tool_name; emits cleanly in COERCE/auto |
| Zhipu/GLM | glm-4.6 | ❌ `provider_error` (400 code 1210) | same: force_tool_name rejected; `tool_choice='auto'` emits a tool call cleanly |

(All rows `raised=null` → metadata failure never breaks ingestion. `resolved_model == requested
model` everywhere → the selected model IS honored after the extraction_model persistence fix.)

### Design considerations the dynamic registry MUST handle (not just "list ids")

1. **Validate ids against LIVE `/models`, never hardcode.** Picker defaults `glm-4.6`,
   `deepseek-v4-flash`, `gemini-3.5-flash` were all in MODEL_CAPABILITIES yet failed live. A
   registered id ≠ a working id.
2. **`forced_emission` accuracy is a correctness bug, not cosmetics.** `deepseek-v4-flash` and
   `glm-4.6` are marked `forced_emission:True` but their APIs **400 on the force_tool_name path**
   (thinking-mode / param rejection) while emitting fine in COERCE/auto. This mis-route yields
   ZERO metadata on EVERY extraction with those models — and also affects any other forced-emit
   caller (judge, authoring). Dynamic pulling should derive/verify `forced_emission` per model
   (probe once, store the result) and **fall back to COERCE when the force path 400s**, rather
   than trusting a hardcoded flag. (Relates to project_cross_provider_native_tools_registry_trap.)
3. **List ≠ extraction-capable.** Even a served, reachable mainstream model can fail to emit
   (all Gemini models) or emit garbage (MiniMax-M2, 1 field). The registry/UI should carry a
   per-model **"emit-capable" signal** (probe-derived), so the picker can show only models that
   actually produce metadata — or warn on the weak ones.
4. **Provider-down vs model-declined vs forcing-incompatible are THREE different states**
   (`provider_error` thrown / `model_failed_to_emit` honest decline / 400-on-force). Collapsing
   them to "no metadata" hides the cause (ties to SEED-090). The dynamic surface + the document
   row badge should distinguish them so the operator knows whether to switch model, start a server,
   or it's a forcing-config issue.
5. **Google forced-emit needs a path fix before Google returns to the extraction picker** — either
   a COERCE fallback for Gemini, or the native function-calling adapter for the emit schema.
   Tracked here; Google omitted from `EXTRACTION_PRESETS` (2026-06-17) until fixed (still reachable
   via Custom).

### Immediate state (post-verify-work)
- `EXTRACTION_PRESETS` now lists only live-confirmed-working cloud defaults (OpenAI gpt-5.4-mini,
  Anthropic claude-sonnet-4-6) + the two local presets + Custom. Model field stays editable.
- Native-7 (deepseek/moonshot/glm/minimax) + OpenRouter are reachable via Custom; their per-model
  extraction status is the table above.
