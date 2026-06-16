---
status: passed
phase: 111-metadata-enrichment-extraction-backend
source: [111-VERIFICATION.md]
started: 2026-06-15T23:55:00Z
updated: 2026-06-16T13:40:00Z
driver: Claude (live UAT via minted-JWT API uploads + psycopg2 :54322 DB checks + backend log-sink provider-endpoint verification)
resolution_note: "Axis (b) LM Studio resolved-with-documented-limitation 2026-06-16 (operator decision) — a real local-routing trap was found (slashed local model ids mis-infer to OpenRouter; no `lmstudio` inference pattern), documented as F-111-UAT-2, and folded into Phase 111.1. The 111 degradation contract is unaffected. All 5 rows now resolved."
---

## Current Test

[All 5 axes resolved. 4/5 driven live; axis (b) LM Studio resolved-with-documented-limitation — a local-routing trap (F-111-UAT-2) blocks reaching a local model without a registry entry + provider switch; folded into Phase 111.1. See Test 2.]

## Tests

### 1. SC#4 4-axis UAT — cross-provider dynamic-schema extraction (VALIDATION.md axis a)
expected: Ingest the same doc with `extraction_model` set to one model per native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax) + OpenRouter; SELECT stored `documents.metadata`. Each provider either returns valid confidence-scored fields OR an honest-fail that degrades to null metadata (doc still `status=completed`). Acceptance = pass OR documented limitation per provider.
result: pass
note: |
  PASS per the VALIDATION acceptance ("pass OR documented limitation per provider; 111 does
  NOT own the provider fix"). All 8 providers reached status=completed; each provider's DISTINCT
  API endpoint was verified in the backend log-sink within the ingest window (proof the model
  routing actually fired — not gpt-4o 8×). 4/8 returned full confidence-scored metadata INCLUDING
  the live custom `contract_value=180000` number field + nested `_confidence` map (strong live
  proof of the dynamic create_model schema + confidence path). 4/8 honest-fail-degraded to null —
  all documented limitations, doc still completed, never stuck.

  | Provider | Model | Extraction call | metadata | provider verified |
  |---|---|---|---|---|
  | OpenAI | gpt-4o | **400 Bad Request** | null (degraded) | ✅ openai endpoint |
  | Anthropic | claude-sonnet-4-6 | 200 OK | ✅ full + contract_value + _confidence | ✅ anthropic |
  | Google | gemini-2.5-flash | **429 quota** | null (degraded) | ✅ google |
  | DeepSeek | deepseek-v4-pro | **400 Bad Request** | null (degraded) | ✅ deepseek |
  | Moonshot | kimi-k2.6 | 200 OK | ✅ full + contract_value + _confidence | ✅ moonshot |
  | Z.ai/GLM | glm-4.6 | **400 Bad Request** | null (degraded) | ✅ zhipu |
  | MiniMax | MiniMax-M2.7 | 200 OK | ✅ full + contract_value + _confidence | ✅ minimax |
  | OpenRouter | deepseek/deepseek-chat | 200 OK | ✅ full + contract_value + _confidence | ✅ openrouter |

  Two distinct degradation causes (NEITHER owned by Phase 111):
  - **OpenAI / DeepSeek / Z.ai = forced_emit TIER-FORCE strict-400.** Confirmed root cause: the
    raw `emit_document_metadata` tool schema is ACCEPTED by OpenAI in non-strict mode (verified by
    direct repro — `OK tool_calls=True`), but `forced_emit`'s TIER-FORCE path 400s these three
    OpenAI-schema-family providers despite the call passing `strict=False`, and degrades straight
    to null without a non-strict COERCE retry. This is the shared forced_emit/gateway primitive,
    NOT 111 code. **Real-world impact flagged: the DEFAULT extraction provider (gpt-4o) produces
    no metadata out of the box.** Extends BUG-260615-01 #3 / SEED-082 (new evidence appended).
  - **Google = 429 Too Many Requests** (free-tier quota), transient — not a code defect.

  Evidence: doc_ids a91d9562 (openai), b1db27ac (anthropic), 5c63e252 (google), 21dbb3f5 (deepseek),
  8a318243 (moonshot), 00dc2c25 (zhipu), cc4a732d (minimax), 72827799 (openrouter);
  backend log-sink `logs/backend.60452.log` lines 117/138/158/179/200/220/241/261 (per-provider
  chat-completion HTTP status). Full capture: `scripts/_uat111/results.json`.

### 2. SC#4 4-axis UAT — local model (LM Studio) TIER-COERCE path (VALIDATION.md axis b)
expected: Ingest a doc with `extraction_model` set to a local model ID, provider `lmstudio`; SELECT stored metadata + `_confidence`. Expect valid dynamic-schema emission via TIER-COERCE (or a clean null-degradation — both acceptable per the contract). (Requires LM Studio running locally with a model loaded.)
result: pass
resolution: documented-limitation (operator decision 2026-06-16)
note: |
  RESOLVED WITH DOCUMENTED LIMITATION. Operator loaded LM Studio with `google/gemma-3-4b`
  (server on :1234). On the attempt to drive this axis live, a REAL local-routing trap was
  discovered that prevents the extraction call from reaching a local LM Studio / Ollama server
  with the current code — see Finding F-111-UAT-2:

    - Provider for an `extraction_model` is resolved from the model-id STRING:
      `get_model_capability(model)` (registry hit) else pattern inference (`config.py`).
    - A local model id with a slash — `google/gemma-3-4b` — is NOT in the registry, so it
      falls to inference, where the `^<word>/<word>` rule (`config.py:362`) classifies ANY
      `org/model` string as `openrouter`. (`^gemini-` does not match `google/gemma…`.)
    - `forced_emit` then injects the OpenRouter key + base_url (cross-provider block,
      `forced_emit.py:261-275`) and the request goes to openrouter.ai — which also hosts
      `google/gemma-3-4b`. The local server on :1234 is NEVER touched. Setting
      `LLM_PROVIDER=lmstudio` alone does not help — the slash still wins inference and the
      cross-provider injection still hijacks the call to OpenRouter. There is also NO
      `lmstudio` inference pattern, so local models are only reachable via a registry entry
      + provider switch.

  LIVE TEST (2026-06-16, `scripts/_uat111/test_lmstudio_extraction.py` — the REAL forced_emit
  TIER-COERCE path against LM Studio :1234, with provider forced to lmstudio and the
  openrouter mangling stripped): the engine WORKS on a capable local model.
    - `google/gemma-4-12b-qat` → FULL SUCCESS: all 7 built-ins populated correctly
      (title="Master Services Agreement", author, date=2024-03-15, document_type="Contract",
      topics[4], language, summary) + a complete per-field `_confidence` map, via a real
      tool-call emit (failure=null, ~180s).
    - `google/gemma-4-e4b` (4B) → honest-fail `model_failed_to_emit` → null (capability floor).
    - `google/gemma-4-e2b` (2B) → honest-fail (reasoning-burner).

  A SECOND bug was found during the test (folded into BUG-260616-01): even with provider forced
  to lmstudio, `create_adaptive_streaming_chat` (`openai_service.py:1449-1456`) appends `:exacto`
  + a `response-healing` plugin to ANY slashed model id (gated on `"/" in model`, not on
  provider==openrouter) → LM Studio 500. Both bugs must be fixed for the normal ingest path.

  Per the VALIDATION acceptance ("pass OR documented limitation per provider; 111 does NOT own
  the provider fix"), this axis is a PASS: the engine + degradation contract are PROVEN live (a
  capable local model emits correct confidence-scored metadata; weaker ones honest-fail to null
  with the doc still completing). The STABLE app-path fix — explicit `(provider, model)` pairing
  + local-aware cross-provider routing + gating the OpenRouter mangling on the provider — is
  folded into Phase 111.1 (BUG-260616-01; its discuss-phase carries the item).

### 3. SC#4 4-axis UAT — long-doc window-lift (VALIDATION.md axis c)
expected: Ingest a doc ≥ 5 KB whose title/byline data is after char 3000. SELECT metadata; expect the late title/date captured in the result (proves head+tail sampler beats `content[:3000]`).
result: pass
note: |
  PASS (conclusive). 8,386-byte doc with the identification block (Title/Author/Date) at char 3549
  — AFTER char 3000. Ingested on Anthropic claude-sonnet-4-6 (doc_id db1c8175). SELECT returned
  title="Annual Sustainability and Operations Report 2024", author="Priya Raman", date="2024-11-15"
  — the late title/byline/date WERE captured, proving the head(70%)+tail(30%) window sampler reaches
  past content[:3000]. (First attempt ran on gpt-4o and returned null — but that was the gpt-4o
  strict-400 from Test 1, not a window failure; re-run on a populating provider confirmed the lift.
  Note: dedup is content-hash-scoped, so the re-run needed a unique-content marker — HTTP 201 = fresh
  ingest confirmed.)

### 4. SC#4 4-axis UAT — graceful degradation (VALIDATION.md axis d)
expected: Ingest with a deliberately-failing/garbage model (invalid model ID or a model that 400s). SELECT the document row. Expect `status=completed` with null/partial metadata — NEVER stuck in `processing`/`failed` from the extraction step.
result: pass
note: |
  PASS. extraction_model="zzz-nonexistent-model-xyz-400" (doc_id 6f9dff61). get_model_capability
  returned unknown → inferred provider=ollama (safe defaults) → TIER-COERCE provider call raised →
  the 3-layer backstop absorbed it. Final row: status=completed, metadata=null. Never stuck in
  processing/failed. Log: backend.60452.log line 301 (model_capability_unknown) + 304 (forced_emit
  raised tier=TIER-COERCE provider=ollama).

### 5. Live audit INSERT+SELECT (VALIDATION.md manual row)
expected: Create a custom field via `POST /metadata-fields`; SELECT `audit_log` for a `metadata.field.create` row. Expect the row to exist with the correct `field_key` and `field_type` in metadata.
result: pass
note: |
  PASS. POST /metadata-fields {field_key:"contract_value", field_type:"number"} → HTTP 201
  (id c6e60bb2, user d8a54002, is_global=false). SELECT audit_log → row found:
  action_type="metadata.field.create", metadata={"field_key":"contract_value","field_type":"number"},
  user_id=d8a54002 (matches caller). Driven through the real API endpoint under a real JWT, not the
  service function. (Field deleted in cleanup → schema restored to baseline; create-audit row persists.)

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0
note: "passed includes axis (b) as pass-with-documented-limitation (F-111-UAT-2 → Phase 111.1)"

## Findings (non-blocking)

- **F-111-UAT-1 (carry to provider/eval phase, NOT a 111 gap):** OpenAI gpt-4o + DeepSeek v4-pro +
  Z.ai glm-4.6 return 400 on the metadata `forced_emit` TIER-FORCE call (strict path) and degrade
  to null; raw schema is accepted non-strict, so the gap is the shared forced_emit/gateway strict
  handling + missing non-strict retry — extends BUG-260615-01 #3 / SEED-082. Practical impact: the
  default extraction provider yields no metadata until this is addressed. The Phase 111 degradation
  contract HELD (all completed, never stuck), so this does not block the phase per its own VALIDATION
  acceptance, but the operator should weigh it before flipping to default-on enrichment.

- **F-111-UAT-2 (local-model routing trap — NOT a 111 gap; folded into Phase 111.1):** The
  extraction provider is inferred from the `extraction_model` STRING. A local model id with a
  slash (`google/gemma-3-4b`, `qwen/…`) is not in `MODEL_CAPABILITIES`, so it falls to inference,
  where `^<word>/<word>` (`config.py:362`) classifies ANY `org/model` as `openrouter`; `forced_emit`
  then injects the OpenRouter key + base_url (`forced_emit.py:261-275`) and the call goes to
  openrouter.ai, NOT the local LM Studio/Ollama server. There is no `lmstudio` inference pattern,
  and setting `LLM_PROVIDER=lmstudio` alone does not override the slash-inference + cross-provider
  injection. Net: a local model cannot be reached for extraction without a registry entry AND a
  global provider switch. **Stable fix (Phase 111.1):** explicit `(provider, model)` pairing for
  the extraction model (route by stored provider, never infer from name) + a local-aware
  cross-provider routing block (resolve a local target provider's base_url + dummy key so
  extraction can run on a local model while chat stays on a cloud provider — no global switch, no
  restart). Same primitive retires the embedding SPOF 111.1 already owns. Practical impact on 111:
  none — the degradation contract holds (mis-route/failure → null metadata, doc still completes).

## Operator Instructions — axis (b) closed (was: deferred)

Axis (b) is CLOSED as pass-with-documented-limitation (see Test 2 + F-111-UAT-2). The local-model
extraction path is genuinely reachable today only via a throwaway fixture; the real fix lives in
Phase 111.1. The fixture (for reference only, NOT required to close 111):

1. Start LM Studio, load a local model, start the local server (`:1234`).
2. Add a `MODEL_CAPABILITIES` registry row for the exact loaded model id (e.g. `google/gemma-3-4b`)
   with `provider: "lmstudio"`, `forced_emission: False` (→ TIER-COERCE), so it is a registry HIT
   (bypasses the slash→openrouter inference); restart the backend. Or set
   `app_settings.extraction_model` to the LM Studio model id + `LLM_PROVIDER=lmstudio`, upload any
   doc, and `SELECT metadata, status FROM documents WHERE id=<id>`.
3. Expected: status=completed with a populated dynamic-schema metadata + `_confidence` map via
   TIER-COERCE (or a clean null-degradation — still acceptable per the contract).

## Gaps

[none blocking — see Findings]
