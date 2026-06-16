---
id: BUG-260616-01
title: Local-model extraction (LM Studio/Ollama) mis-routes to OpenRouter — provider inferred from slashed model id
reported: 2026-06-16
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/provider-routing, RAG/metadata-extraction, settings/providers, embeddings]
folded_into: "111.1"
verified_closed_by: null
related_seeds: [SEED-048, SEED-082]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: a0b2e851
  date: 2026-06-16
---

# BUG-260616-01: Local-model extraction (LM Studio/Ollama) mis-routes to OpenRouter — provider inferred from slashed model id

## What we observed

Found while attempting to drive Phase 111 UAT axis (b): operator loaded LM Studio with `google/gemma-3-4b` (OpenAI-compatible server on `:1234`) and set it as the metadata `extraction_model`. The extraction call never reaches the local server — it is silently routed to OpenRouter's cloud instead.

Trace:
1. The extraction provider is resolved from the **model-id string**, not from an explicit setting: `provider = (get_model_capability(model) or {}).get("provider")` (`backend/app/api/documents.py:1401`).
2. `google/gemma-3-4b` is not in `MODEL_CAPABILITIES`, so `get_model_capability` falls to pattern inference. The rule `^[^/\s]+/[^/\s]+` (`backend/app/config.py:362`) classifies **any** `org/model` string as `openrouter`. (`^gemini-` does not match `google/gemma…`.)
3. `forced_emit` receives `provider="openrouter"`; the cross-provider key/base_url injection block (`backend/app/services/forced_emit.py:261-275`) sees a configured `openrouter_api_key`, injects it + `https://openrouter.ai/api/v1`, and the request goes to OpenRouter — which also hosts `google/gemma-3-4b`. The local `:1234` server is never touched.

**Second, independent bug — OpenRouter request-mangling applied to local models (found during the live test 2026-06-16):** Even when the provider is *forced* to `lmstudio` (sidestepping bug #1), the request to the local server is corrupted. In `create_adaptive_streaming_chat` (`backend/app/services/openai_service.py:1449-1456`), the OpenRouter "quality" strategy block is gated on **`"/" in effective_model`** (not on `provider == "openrouter"`). Every LM Studio / Ollama model is named `org/model`, so for `google/gemma-4-e4b` it (a) rewrites the model to `google/gemma-4-e4b:exacto` and (b) injects `extra_body={"plugins":[{"id":"response-healing"}]}` — both OpenRouter-only. LM Studio has no `:exacto` model and no plugin system → returns a **500 HTML page** → `forced_emit` honest-fails to `provider_error` → null metadata. Captured SDK kwargs:
```
{'model': 'google/gemma-4-e4b:exacto', 'stream': True, 'max_tokens': 8192,
 'stream_options': {'include_usage': True}, 'tools': [...emit_document_metadata...],
 'tool_choice': 'auto', 'parallel_tool_calls': False,
 'extra_body': {'plugins': [{'id': 'response-healing'}]}}   ← :exacto + plugin = OpenRouter-only → LM Studio 500
```
(Also note `resolve_calling_mode` returned `NATIVE` for the inferred-openrouter model, so tools ARE sent natively — LM Studio accepts that fine; the 500 is purely the `:exacto`/plugin mangling.)

### Live test evidence (2026-06-16, against LM Studio :1234)

Driven via `scripts/_uat111/test_lmstudio_extraction.py` — the REAL `forced_emit` TIER-COERCE path with `provider="lmstudio"` forced and the `:exacto`/plugin mangling stripped (`openrouter_tool_strategy="off"`):

| Local model | Result | Detail |
|---|---|---|
| `google/gemma-4-12b-qat` | **✅ full success** | `failure=null`, all 7 built-in fields populated CORRECTLY (title/author/date/document_type/topics/language/summary) + per-field `confidence` map, via a real tool-call emit (not narration recovery). ~180s. |
| `google/gemma-4-e4b` (4B) | honest-fail | `failure=model_failed_to_emit` → null metadata (capability floor; the 111 degradation contract holds). ~55s. |
| `google/gemma-4-e2b` (2B) | honest-fail | reasoning-style model, burns budget on hidden `reasoning_content`; doesn't emit. |

**Conclusion:** local extraction genuinely WORKS on a capable local model (12B) through the real engine — the feature is sound. The ONLY thing blocking it on the normal app path is the two routing/mangling bugs above; smaller local models honest-fail-degrade exactly as designed.

Confirmed secondary facts:
- There is **no `lmstudio` inference pattern** — local models are only reachable as a registry hit (`provider: "lmstudio"`) or via active-provider fallthrough.
- Setting `LLM_PROVIDER=lmstudio` alone does **not** fix it: the slash still wins inference (`provider="openrouter"`), and because `openrouter != active`, the cross-provider block still hijacks the call to OpenRouter.
- The dummy-key local providers (`lmstudio`, `ollama`) have no `<provider>_api_key` Settings field, so even a registry entry mis-routes unless the active provider is *also* the same local provider (the cross-provider block then short-circuits) — i.e. it takes **both** a registry entry **and** a global provider switch + restart to reach a local model today.

## Why it matters

`major`. The whole point of local providers (LM Studio / Ollama) is privacy/cost/offline — and right now an operator who picks a local model for extraction (or, by the same mechanism, anything routed by model-name inference) silently gets their document text shipped to OpenRouter's cloud instead, with a green result that looks like local inference worked. That is both a correctness bug and a data-egress surprise. Same root cause (name-inference instead of explicit provider) underlies the embedding SPOF that Phase 111.1 already targets (SEED-048).

Practical impact on Phase 111 itself: **none** — the degradation contract holds (a mis-routed or failing extraction degrades to null metadata with the doc reaching `status=completed`). So 111 closes on the documented limitation; the fix belongs downstream.

## Hypothesized cause

Not a hypothesis — verified by code trace (above). Root cause: **provider identity is inferred from the model-name string**, but for local / OpenAI-compatible endpoints the *same* model name (`google/gemma-3-4b`) can legitimately live behind OpenRouter, a local LM Studio, or a local Ollama. A name cannot disambiguate the endpoint, so inference-from-name is structurally wrong for local providers.

## Surface classification

`Agentic-RAG` — this app's backend provider-routing + Settings. Cross-checked at `/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`. Already folded into Phase 111.1 (it owns provider-pickable embeddings/local-provider support).

## Suggested routing

- **Fold into in-flight phase:** Phase 111.1 (folded). The stable fix is symmetric with 111.1's existing embedding-provider scope.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** related to SEED-048 (embedding SPOF) and SEED-082 (forced_emit/gateway strict handling).
- **External — note only:** no

### Stable fix (for 111.1 scope)

1. **Explicit `(provider, model)` pairing.** Add `extraction_provider` next to `extraction_model` in `app_settings` (symmetric with the `embedding_provider` 111.1 already needs). When set, routing trusts it and **skips name-inference entirely**; inference stays only as a last-resort fallback for legacy unset rows. Makes the slash→OpenRouter mis-route structurally impossible.
2. **Local-aware cross-provider routing.** Fix the `forced_emit` cross-provider block (`forced_emit.py:261-275`) so a forced shot targeting a local provider resolves that provider's base_url (`:1234` / `:11434`) + dummy key — instead of silently falling through to the wrong active provider when no `<provider>_api_key` exists. Payoff: extraction can run on a local model while chat stays on a cloud provider, simultaneously — no global `LLM_PROVIDER` switch, no restart.
3. **Gate the OpenRouter "quality" mangling on the PROVIDER, not the model string.** In `create_adaptive_streaming_chat` (`openai_service.py:1449-1456`), change the `if "/" in effective_model` condition to fire only when `provider == "openrouter"`. As-is it appends `:exacto` + a `response-healing` plugin to ANY slashed model id — which is exactly how every LM Studio/Ollama model is named — and 500s the local server. (This is the bug that actually blocked the live test, even after provider was forced to lmstudio.)
4. **Provider picker in Settings** (already in 111.1's scope for embeddings) extended to the extraction model, with LM Studio/Ollama presets + dummy-key relaxation. The picker enforces (1) in the UI — you cannot pick a model without pinning where it runs.

## Workarounds (prompt-side, code-side, or UI-side)

Proven test fixture (NOT a real fix), `scripts/_uat111/test_lmstudio_extraction.py`: force `provider="lmstudio"` on the `forced_emit` call AND set `openrouter_tool_strategy="off"` on the effective settings (to skip the `:exacto`/plugin mangling), with `llm_base_url=http://127.0.0.1:1234/v1` + dummy key. No backend restart needed. The app's normal ingest path still mis-routes until the three fixes above land.

## Reference / evidence links

- `backend/app/api/documents.py:1400-1424` — extraction provider resolved from model-id string
- `backend/app/config.py:352-363` — `_INFERENCE_PATTERNS` (the `^word/word` → openrouter rule at :362)
- `backend/app/config.py:725-763` — `resolve_llm_provider` (lmstudio dummy-key / base_url resolution)
- `backend/app/services/forced_emit.py:251-275` — cross-provider key/base_url injection block
- `backend/app/services/openai_service.py:1449-1456` — OpenRouter "quality" block gated on `"/" in effective_model` (the `:exacto` + `response-healing` plugin mangling that 500s local servers)
- `scripts/_uat111/test_lmstudio_extraction.py` + `diag_lmstudio_error.py` — live repro + the proof that a 12B local model extracts correctly once the bugs are bypassed
- Phase 111 UAT axis (b): `.planning/phases/111-metadata-enrichment-extraction-backend/111-HUMAN-UAT.md` (Test 2 + Finding F-111-UAT-2)
