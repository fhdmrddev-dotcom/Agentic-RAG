# Phase 111: Metadata Enrichment — Extraction Backend - Research

**Researched:** 2026-06-15
**Domain:** Re-platforming document metadata extraction onto the existing cross-provider `forced_emit` engine (configurable model, dynamic Pydantic schema, per-field confidence, window lift, first-class local provider)
**Confidence:** HIGH (every code seam re-verified against live source by file:line this session; external provider claims CITED from official docs; the only ASSUMED items are local-model value-quality floors — see Assumptions Log)

## Summary

This is a **re-platforming**, not a greenfield AI build. The framework is locked by CLAUDE.md (raw SDK, no LangChain). The substrate — `forced_emit` (cross-provider TIER-FORCE / TIER-COERCE structured emission with a caller-owned tool + runtime `schema_model` + `strict` override) — already ships and has two live precedents (`workflow_authoring` → `WorkflowDefinition`; the judge → `JudgeVerdict`). 111 adds a third caller: a metadata extractor that builds a dynamic Pydantic model at runtime from the always-on 7 built-ins + the user's enabled `metadata_field_definitions`, feeds it to `forced_emit`, and persists per-field confidence under a nested `_confidence` key inside the existing `documents.metadata` JSONB column.

Every CONTEXT decision D-111-1..11 was re-verified this session against live source. **All file:line citations in CONTEXT are confirmed current** (no drift detected). The genuinely-open research questions resolved to concrete recommendations below. The two highest-leverage findings: (1) **grammar-constrained `response_format` json_schema for local models is a NET-NEW wiring task, not a flag flip** — the existing `strict_response_format` seam fires ONLY in the TIER-FORCE branch AND is gated to `provider == "openai"` (`openai_service.py:1399`); a local model is TIER-COERCE (`force_tool_name is None`) so it never reaches that code today and relies entirely on COERCE prompt-injection + narration recovery. (2) **`/reextract` DOES converge on `ingest_document`** (`documents.py:1178` schedules it as a BackgroundTask), so the new enrichment applies on re-extract with no separate path — D-111-10 confirmed.

**Primary recommendation:** Build a new `async def extract_metadata_enriched(...)` in `embedding_service.py` that mirrors `workflow_authoring`'s caller pattern (own EMIT tool from `model_json_schema()`, `forced_emit(schema_model=<dynamic>, strict=False)`, real `UserEffectiveSettings`), call it via `asyncio.run(...)` inside the sync `ingest_document`, gate it behind `app_settings.metadata_enrichment_mode` (default `enriched`), keep the legacy `json_object` path for `legacy` mode, and add a clean `lmstudio` provider to `config._PROVIDER_BASE_URLS`. Ship migration `072_app_settings_extraction_model.sql` (3 columns). Build `backend/app/api/metadata_fields.py` CRUD router. Preserve both graceful-degradation layers verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dynamic-schema structured extraction | API/Backend (`embedding_service` + `forced_emit`) | — | LLM orchestration is service-boundary work; runs in the BackgroundTask off the event loop |
| Custom field CRUD (META-01 "define") | API/Backend (`metadata_fields.py` router) | Database (`metadata_field_definitions` RLS) | Authoring is a request-scoped CRUD surface; RLS enforces own+global |
| Ingest-time field-def read | API/Backend (`ingest_document` BackgroundTask) | Database (explicit app-code scoping) | No `auth.uid()` in a BackgroundTask → MUST scope by hand, not RLS |
| Model + settings resolution | API/Backend (`load_app_settings` / `_build_settings_from_row`) | Database (`app_settings` columns) | Admin-global knob; DB-only column, no env, no UI (mirrors `harness_judge_model`) |
| Local-model routing | API/Backend (`config._PROVIDER_BASE_URLS` + gateway) | — | Provider registration is config; the gateway adapter already handles arbitrary base_url |
| Per-field confidence storage | Database (`documents.metadata` JSONB `_confidence` sub-key) | — | No new column; nested under existing JSONB; flat fields stay top-level for `@>` |
| Confidence DISPLAY | (NOT THIS PHASE → 112) | — | 111 stores only; META-02 owns the panel |

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| META-01 | User can define custom metadata fields extracted on ingest | New `metadata_fields.py` CRUD router (create/list/edit/delete) writing `metadata_field_definitions`; runtime `pydantic.create_model` folds enabled own+global custom fields into the emit schema (D-111-5). `field_type` validated in app code via a closed `Literal` vocabulary (DB has no CHECK). |
| META-03 | Extraction uses an admin-configured model, not hardwired gpt-4o | `forced_emit` re-platform routes through the provider gateway; `app_settings.extraction_model` (migration 072, DB-only) resolves the model; unset → `settings.llm_model` (gpt-4o) fallback (D-111-1/2). |
| META-04 | Read beyond first 3,000 chars (configurable / head+tail sampling) | Replace `content[:3000]` with head+tail sampling + a new `extraction_window_cap` column, validated against the resolved model's context window; truncate-then-degrade on overflow (D-111-4). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pydantic` | 2.x (already a project dep) | `create_model` runtime schema; `.model_json_schema()` for the emit tool; `.model_validate` hard-validation | Project rule ("Use Pydantic for structured LLM outputs"); `forced_emit.schema_model` accepts any `BaseModel` subclass [VERIFIED: forced_emit.py:140-154,215] |
| `forced_emit` (in-repo) | Phase 101.1 + 103 | Cross-provider structured emission engine; TIER-FORCE/COERCE; `schema_model` + `strict` params | The locked substrate; two live precedents [VERIFIED: forced_emit.py:205-249] |
| `openai` SDK (OpenAI-compat) | already a project dep | Local-model transport via `create_adaptive_streaming_chat` arbitrary base_url | Gateway else-branch routes every non-anthropic/google provider here [VERIFIED: dispatcher.py:117-127] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| LM Studio server | local | Operator's 6GB local-model proof; OpenAI-compat `/v1` on port 1234 | The SC#4 local-model UAT row (D-111-7/11) |
| Qwen2.5-7B-Instruct Q4_K_M (GGUF) | — | Ship/test local model | The recommended 6GB target [CITED: lmstudio.ai structured-output docs — "particularly LLMs below 7B" struggle] |

**Installation:** No new Python packages. `pydantic` and `openai` are already installed. Operator-side: LM Studio app + a downloaded Qwen2.5-7B-Instruct-Q4_K_M GGUF.

**Version verification:** `pydantic.create_model` and `.model_json_schema()` are stable Pydantic-2 API (the project already uses `WorkflowDefinition.model_json_schema()` at `workflow_authoring.py:127` and `JudgeVerdict.model_json_schema()` in the judge). No registry check needed — no new dependency is introduced.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `forced_emit` re-platform | Keep the OpenAI `json_object` path, just thread `model` | Rejected — no cross-provider routing, no COERCE net, no local support; would re-derive a worse engine. CONTEXT D-111-1 locks the re-platform. |
| `pydantic.create_model` dynamic model | Hand-built JSON-schema dict | Rejected — `forced_emit`'s `_validate_args` calls `_model.model_validate(data)`; it NEEDS a real `BaseModel` class to hard-validate, not a raw schema [VERIFIED: forced_emit.py:149-154]. |
| Ollama-impersonation for local | New first-class `lmstudio` provider | CONTEXT D-111-7 + operator want LM Studio first-class. Impersonation works but is a footgun; one config edit removes it. |

## Architecture Patterns

### System Architecture Diagram

```
  POST /upload (or /reingest, /reextract)        [all 3 converge — VERIFIED documents.py:1178,1475]
        │  201/202 in ~1s
        ▼
  _upload_pipeline  (SYNC BackgroundTask, off the event loop, Starlette threadpool)
        │  extract text (per-aspect composer)
        ▼
  ingest_document  (SYNC; has user_id + supabase in scope)   [VERIFIED documents.py:1334-1338]
        │
        ├─ app_settings = load_app_settings()      ◄── HOIST above the extract call (currently :1403)
        │      └─ resolves admin-global extraction_model + window_cap + enrichment_mode
        │
        ├─ if metadata_enrichment_mode == "enriched":           [DEFAULT-ON]
        │     │
        │     ├─ read enabled field defs  ── EXPLICIT .eq(user_id).or_(is_global.eq.true)
        │     │       (service-role bypasses RLS — scope by hand)   [D-111-6; precedent workflow_authoring.py:152-181]
        │     │
        │     ├─ build dynamic model = create_model(
        │     │       <7 built-ins always-on> + <enabled custom fields> + _confidence: dict[str,float])
        │     │
        │     ├─ build EMIT_TOOL = {parameters: model.model_json_schema()}   [precedent workflow_authoring.py:127-137]
        │     │
        │     └─ asyncio.run( extract_metadata_enriched(...) )   ◄── sync→async bridge [precedent documents.py:218]
        │             │
        │             └─ forced_emit(schema_model=<dynamic>, strict=False, emitter="emit_document_metadata",
        │                            tools=[EMIT_TOOL], user_settings=<real UserEffectiveSettings>)
        │                   │
        │                   ├─ TIER-FORCE  (capable model, registry hit)  → named tool_choice
        │                   └─ TIER-COERCE (registry miss / local)        → schema-in-prompt + narration recovery
        │                          │                                          + Pydantic hard-validate (semantic net)
        │                   ▼
        │             returns {emitted: <model>|None, failure: ...}
        │                   │  None → swallow → metadata_dict stays None (graceful degrade) [D-111-8]
        │
        │  else (legacy):  metadata = extract_metadata(text)   ◄── UNTOUCHED OpenAI json_object path
        │
        ├─ metadata_dict = emitted.model_dump(exclude_none=True)   [None VALUES dropped — author stays dropped]
        ├─ attach _confidence  AFTER the dump (guard metadata_dict-is-None)   [D-111-3]
        ├─ lowercase document_type + language (flat filter fields)   [D-111-9]
        │
        ▼
  persist documents.metadata = metadata_dict   [VERIFIED documents.py:1467-1482]
        │   flat fields → @> containment still matches    [VERIFIED full-schema.sql:108,132]
        │   _confidence nested → ignored by flat @> filters [D-111-9 non-regression]
        ▼
  status = completed   (ALWAYS reached unless ingest itself fails — outer try/except backstop :1484)
```

### Recommended Project Structure
```
backend/app/
├── api/
│   ├── documents.py          # MODIFIED: hoist load_app_settings; branch enriched/legacy; asyncio.run new extractor
│   └── metadata_fields.py    # NEW: custom-field CRUD router (mount in main.py)
├── services/
│   └── embedding_service.py  # MODIFIED: keep sync extract_metadata (legacy); ADD async extract_metadata_enriched + dynamic-model builder
├── models/
│   ├── document.py           # DocumentMetadata 7-field model — KEEP as the always-on built-in source
│   └── user_settings.py      # MODIFIED: +extraction_model, +extraction_window_cap, +metadata_enrichment_mode fields in UserEffectiveSettings + 3 _build_settings_from_row lines
└── config.py                 # MODIFIED: + "lmstudio" in _PROVIDER_BASE_URLS + key_map; + lmstudio_base_url env field

supabase/migrations/
└── 072_app_settings_extraction_model.sql   # NEW: 3 ALTER TABLE ADD COLUMN IF NOT EXISTS
```

### Pattern 1: Caller-owned EMIT tool + dynamic schema_model (the workflow_authoring precedent)
**What:** `forced_emit` owns no tool. The caller builds the tool from `<Model>.model_json_schema()`, names it via `emitter=`, passes `schema_model=<Model>`, and `forced_emit` validates the emission against that exact model.
**When to use:** Every `forced_emit` caller that isn't emitting the default `EmitFieldMap`.
**Why NOT reuse `phase_types._emit_forced_tool`:** That tool advertises an `EmitFieldMap` schema [VERIFIED: phase_types.py is EmitFieldMap-shaped]. Reusing it with `schema_model=<metadata model>` makes the advertised tool and the validator disagree — the model emits one shape, the validator expects another → guaranteed honest-fail.
**Example:**
```python
# Source: backend/app/services/workflow_authoring.py:127-137,434-444 (VERIFIED this session)
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))
EMIT_TOOL = {"type": "function", "function": {
    "name": "emit_workflow_definition",
    "description": "Emit a single valid WorkflowDefinition for this task.",
    "parameters": WF_SCHEMA,
}}
res = await forced_emit(
    messages=messages, model=authoring_model, provider=provider,
    emitter="emit_workflow_definition", tools=[EMIT_TOOL],
    user_settings=owner_settings,            # REAL UserEffectiveSettings (.active_provider)
    schema_model=WorkflowDefinition,
    strict=False,                            # optional-heavy schema; avoids OpenAI/DeepSeek strict-400
)
wd = res.get("emitted")                      # None → honest fail, NEVER prose-as-artifact
```
For 111: `emitter="emit_document_metadata"`, `schema_model=<dynamic create_model result>`, and the tool's `parameters` = `<dynamic model>.model_json_schema()`.

### Pattern 2: Dynamic Pydantic model via create_model (D-111-3/5)
**What:** Build a runtime `BaseModel` subclass from the 7 immutable built-ins + enabled custom fields + a `_confidence` dict.
**Example:**
```python
from pydantic import create_model, Field
from typing import Literal

# field_type → Python type (validated in app code; DB field_type is free-text, no CHECK)
_TYPE_MAP = {
    "string": (str | None, None),
    "date":   (str | None, None),     # ISO string; do NOT lowercase/typecast — typed cols are 113/114
    "number": (float | None, None),
    "boolean": (bool | None, None),   # recommend including boolean
    # "enum" handled separately — carries options, becomes Literal[...] | None
}

def build_metadata_model(custom_defs: list[dict]) -> type[BaseModel]:
    fields: dict = {
        # 7 built-ins ALWAYS-ON + immutable (mirror models/document.py DocumentMetadata)
        "title": (str | None, None), "author": (str | None, None),
        "date": (str | None, None), "document_type": (str | None, None),
        "topics": (list[str] | None, None), "language": (str | None, None),
        "summary": (str | None, None),
    }
    for d in custom_defs:                      # enabled own+global only
        key, ftype = d["field_key"], d["field_type"]
        if ftype == "enum" and d.get("options"):
            fields[key] = (Literal[tuple(d["options"])] | None, None)  # carry options
        else:
            fields[key] = _TYPE_MAP.get(ftype, (str | None, None))
    # _confidence is a POPULATED dict → survives exclude_none (only None VALUES drop)
    fields["_confidence"] = (dict[str, float], Field(default_factory=dict))
    return create_model("DynamicDocumentMetadata", **fields)
```
**Note on `_confidence` survival:** `model_dump(exclude_none=True)` drops keys whose VALUE is `None`. A populated `dict[str,float]` (even `{}`) is not `None`, so it survives [VERIFIED: this is Pydantic-2 exclude_none semantics; cross-checked against the existing `documents.py:1369` exclude_none usage that drops `author=None`]. Attach `_confidence` AFTER the dump to be safe and to guard the `metadata is None` case:
```python
metadata_dict = emitted.model_dump(exclude_none=True) if emitted else None
if metadata_dict is not None and emitted._confidence:
    metadata_dict["_confidence"] = emitted._confidence   # populated dict, never None
```
**Pydantic-2 underscore-field caveat (ASSUMED → verify at plan/exec time):** Pydantic-2 treats leading-underscore attribute names as private attributes by default, which are NOT included in `model_dump`. `_confidence` as a real schema field that survives `model_dump` likely requires either (a) a non-underscore field name internally (e.g. `confidence_scores`) that you rename to `_confidence` when attaching to `metadata_dict`, or (b) `model_config = ConfigDict(...)` handling. **Recommendation: name the Pydantic field `confidence` (no underscore), then attach it to `metadata_dict["_confidence"]` after the dump.** This sidesteps the private-attribute rule entirely and keeps the stored JSONB key as `_confidence` per D-111-3. [ASSUMED — must be unit-tested in Wave 0; see Validation Architecture.]

### Pattern 3: Sync→async bridge inside the BackgroundTask (D-111-1/5)
**What:** Call the new async extractor via `asyncio.run(...)` from within sync `ingest_document`.
**Why legal:** The whole `_upload_pipeline → ingest_document` chain is a SYNC function scheduled as a BackgroundTask (`documents.py:1178` `background_tasks.add_task(ingest_document, ...)` and `_upload_pipeline` is sync). It runs in a Starlette threadpool worker OFF the event loop. `asyncio.run` is already used for exactly this at `documents.py:218` [VERIFIED]. D-v2.5-01 ("no blocking I/O in async handlers") does NOT fire — there is no event loop on this thread.
**Anti-pattern:** Do NOT make `ingest_document`/`_upload_pipeline` async (changes the BackgroundTask threading model; ripples into /reingest + telemetry). Do NOT wrap `forced_emit` in `run_in_threadpool` — it's a coroutine, and it already wraps its own blocking drain via `run_in_threadpool(_drain, stream)` internally [VERIFIED: forced_emit.py:324].

### Pattern 4: Explicit user-scoping under service-role (D-111-6 — the 110 SECURITY lesson)
**What:** A BackgroundTask carries no request JWT → `auth.uid()` is NULL → a service-role client BYPASSES RLS (over-returns ALL rows, or with a different key under-returns). Read field defs with an explicit predicate.
**Example:**
```python
# Source pattern: workflow_authoring.py:152-181 (_skill_registry) — VERIFIED this session
rows = (supabase.table("metadata_field_definitions")
        .select("id,field_key,field_type,description,is_global,user_id,enabled")
        .or_(f"user_id.eq.{doc_owner_uid},is_global.eq.true")   # doc_owner_uid = ingest_document user_id
        .execute().data) or []
defs = [r for r in rows if r.get("enabled")
        and (str(r.get("user_id")) == str(doc_owner_uid) or r.get("is_global"))]
```
Mirror `_skill_registry`'s fail-closed posture: on a query exception, return `[]` (extract built-ins only) rather than a possibly-polluted set. Never a bare full-table read.

### Anti-Patterns to Avoid
- **Restructuring `documents.metadata` into `{value, confidence}` per field:** breaks `@>` containment + the case-normalize at `documents.py:1372`. Keep fields FLAT; confidence under one `_confidence` sub-key [PITFALLS.md anti-pattern; D-111-9].
- **Lowercasing typed values (dates, numbers, enum identifiers):** lowercasing is for free-text equality only. Only `document_type` + `language` get lowercased (the existing flat filter fields). Date/number/enum stay as-emitted [PITFALLS.md Pitfall 4; D-111-9].
- **Coercing empty `author` to `""`:** `exclude_none=True` correctly DROPS empty fields. An empty-string author corrupts equality filters. Guard with a non-regression test [PITFALLS.md Pitfall 5; D-111-9].
- **Reusing the EmitFieldMap-shaped `_emit_forced_tool`:** advertised tool ≠ validator → guaranteed fail (Pattern 1).
- **Folding the CRUD into `documents.py`:** already 1478+ lines, hot file, unrelated domain. Own router mirrors skills/folders [D-111-5].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-provider structured output | A new per-provider extraction dispatcher | `forced_emit` (TIER-FORCE/COERCE) | Already solves native-7 + OpenRouter + local; narration recovery; honest-fail; two live precedents [VERIFIED forced_emit.py] |
| Runtime schema from field defs | Hand-built JSON-schema dicts | `pydantic.create_model` + `.model_json_schema()` | `forced_emit._validate_args` needs a real `BaseModel` to `.model_validate` [VERIFIED forced_emit.py:149-154] |
| Cross-provider key/base_url for the extraction model | Manual key plumbing | Pass a real `UserEffectiveSettings`; `forced_emit` resolves the target provider's key+base_url | The cross-provider key-injection seam already exists [VERIFIED forced_emit.py:260-275] |
| Local provider transport | A bespoke local client | Register `lmstudio` in `_PROVIDER_BASE_URLS`; the gateway else-branch routes it | `open_openai_compat_stream` handles arbitrary base_url already [VERIFIED dispatcher.py:117-127, openai_compat.py:381] |
| Audit enum for `metadata.field.create` | A new migration | Nothing — it's ALREADY in `VALID_ACTION_TYPES` AND migration 071's CHECK | [VERIFIED audit_service.py:25; migration 071 applied; STATE.md 110 entry confirms 19-type CHECK live] |
| Graceful-degradation backstop | A new try/except design | Preserve BOTH existing layers (extract→None + ingest outer try/except) | [VERIFIED embedding_service.py:134, documents.py:1484] |

**Key insight:** The entire 111 value is composition over a proven substrate. The ONLY genuinely net-new code is (a) the dynamic-model builder, (b) the `lmstudio` provider line, (c) the CRUD router, (d) migration 072, (e) the enriched/legacy branch + sync→async call site. Everything else is wiring established patterns.

## Open Questions — Resolved

### Q1: LM Studio first-class provider (D-111-7) — RESOLVED
**Finding (CITED):** LM Studio's OpenAI-compat server runs at `http://localhost:1234/v1`, default key `"lm-studio"` (a dummy — no real auth) [CITED: lmstudio.ai/docs/developer/openai-compat/structured-output]. It supports **both** grammar-constrained `response_format` json_schema AND OpenAI-style tool/function calling on `/v1/chat/completions` [CITED: lmstudio.ai/docs/developer/openai-compat/tools — "Tool use enables LLMs to request calls... through the /v1/chat/completions endpoint"]. Native tool support is best on Qwen2.5-7B-Instruct, Llama-3.1/3.2, Ministral-8B; all others get a custom system-prompt fallback with variable quality.

**Recommendation (concrete):**
- Add `"lmstudio": ""` to `config._PROVIDER_BASE_URLS` (empty string → resolved dynamically like ollama). [VERIFIED current dict at config.py:10-20.]
- Add a `lmstudio_base_url: str = "http://localhost:1234/v1"` env field on `Settings` (mirror `ollama_base_url`).
- In `resolve_llm_provider` (config.py:720-755): add `"lmstudio": "lm-studio"` to `key_map` (dummy key like ollama's `"ollama"`), and a branch `if provider == "lmstudio": self.llm_base_url = self.lmstudio_base_url.rstrip("/")` (LM Studio's URL already includes `/v1`, so no append — unlike ollama which appends `/v1`).
- **Provider key name:** `lmstudio` (specific, matches operator intent; `local-openai` is more generic but less discoverable). **Env var:** `LMSTUDIO_BASE_URL`.
- Shared chunk/SSE path needs ZERO change — the gateway adapter handles arbitrary base_url [VERIFIED dispatcher.py:117-127].
- An `lmstudio`-prefixed or registry-miss model id will infer to the `ollama` fallback bucket (`_INFERENCE_FALLBACK_PROVIDER`) for capabilities → `forced_emission=False`, `native_tools=False` → TIER-COERCE STRUCTURED [VERIFIED config.py:363,422-451]. That is the desired safe default. **Note:** the `active_provider` for the gateway is resolved from `UserEffectiveSettings.active_provider`, which comes from `app_settings.llm_provider`; for an admin-global extraction call you pass `load_app_settings()`'s settings — set `LLM_PROVIDER=lmstudio` OR (cleaner) thread the resolved provider explicitly into `forced_emit(provider=...)` from the extraction model's inferred provider, exactly as `workflow_authoring` does (`provider = get_model_capability(model).get("provider")`).

### Q2: Grammar-constrained response_format vs COERCE narration-recovery — RESOLVED
**Critical finding (VERIFIED):** The existing `strict_response_format` json_schema wiring fires ONLY when `force_tool_name is not None` (TIER-FORCE) AND is hard-gated to `provider == "openai"` [VERIFIED openai_service.py:1378,1399]. A local model is TIER-COERCE (`force_tool_name is None` — registry miss → `forced=False` at forced_emit.py:246), so it falls to the `elif tool_choice == "auto"` STRUCTURED branch (openai_service.py:1457-1460) which passes NO `tools` param and NO `response_format`. **Local models today rely ENTIRELY on COERCE: schema injected into the system prompt by `_coerce_schema_block` + `recover_narrated_emission` + Pydantic hard-validate** [VERIFIED forced_emit.py:294-314,346-364].

So: wiring grammar-constrained `response_format` for local extraction is a **NET-NEW task**, not a flag flip. LM Studio supports it [CITED above]; GGUF models use grammar-based sampling for token-level constraints.

**Recommendation (concrete):**
- **Ship 111 WITHOUT grammar-constrained response_format as the default.** The COERCE path + bounded validate-retry (≤2) + Pydantic hard-validate is the proven net and is provider-agnostic (the operator's "guarantee anything works" requirement). Grammar guarantees SHAPE, not SEMANTIC correctness (enum membership, 0-1 confidence calibration, grounding) — the validate-retry loop is still required regardless.
- **IF** the local-model UAT row (D-111-11b) shows the COERCE path producing too many JSON-parse failures on Qwen2.5-7B, add a NARROW, provider-gated enhancement: pass `strict_response_format=True` on the COERCE/auto path ONLY for `provider == "lmstudio"`, wiring the dynamic model's `model_json_schema()` into a `response_format: {type: "json_schema", json_schema: {...}}`. This is a small additive change to `create_adaptive_streaming_chat`'s `elif tool_choice == "auto"` STRUCTURED branch, mirroring the existing OpenAI-only forced-path block (openai_service.py:1417-1425). **Gate it per-provider exactly as the OpenAI gate (line 1399) is gated** — the 101.1-07 lesson: an unverified `json_schema` 400s every emit. Verify live on LM Studio before widening.
- **Ollama caveat (CITED):** Ollama's structured outputs use a NATIVE `format` param (pass `model_json_schema()` to `format`), and its OpenAI-compat `response_format` support exists but with no reliability assessment + "Ollama Cloud does not support structured outputs" [CITED: docs.ollama.com/capabilities/structured-outputs; GitHub #10001 flakiness]. **111 targets LM Studio, not Ollama, for the local proof.** If Ollama support is later wanted, branch to native `format` at the service boundary — out of scope for 111 (the impersonation path still works as a fallback).

### Q3: 6GB VRAM local model floor — RESOLVED
**Finding (CITED + ASSUMED for value-quality):** Qwen2.5-7B-Instruct Q4_K_M weighs ~4.7GB (some sources ~5.7GB with context overhead); fits a 6GB GPU but TIGHT — leaves room only for modest 4-8k context [CITED: localai.computer Qwen2.5-7B Q4_K_M ~4GB weights; Medium/Novita ~5.7GB with overhead]. LM Studio's own docs warn structured output struggles "particularly LLMs below 7B" [CITED: lmstudio.ai].

**Recommendation (confirms CONTEXT):**
- **Ship/test target:** Qwen2.5-7B-Instruct Q4_K_M — strongest JSON-following that fits 6GB with 4-8k context.
- **Floor:** 3B (Qwen2.5-3B-Instruct / Phi-3.5-mini) — emits grammar-valid JSON but unreliable VALUES/confidence [ASSUMED — value-quality is a judgment from model-class reputation, not measured this session].
- **Avoid:** Llama-3.1-8B at 6GB (KV-cache pushes past VRAM) [ASSUMED — standard 8B-at-6GB constraint].
- **Practical context cap for D-111-4:** the window-lift cap MUST be validated against the resolved model's context window. For Qwen2.5-7B at Q4_K_M on 6GB, budget a **4,000-token effective extraction window** (head+tail) to leave KV-cache headroom; on overflow, truncate-then-degrade (never fail). For cloud models (gpt-4o etc.) the cap can be far larger (quality-first per operator) — the cap is a setting, validated per-model.
- **Determinism:** temperature 0/low. (Note: temperature is not currently a `forced_emit` param — if determinism matters for the local proof, it can be set via the model/provider defaults; flag as a possible small additive if needed. Not blocking.)

### Q4: Dynamic Pydantic schema (D-111-3/5) — RESOLVED
See Pattern 2 above. Field-type → Python-type mapping: `string|date→str|None`, `number→float|None`, `boolean→bool|None`, `enum→Literal[*options]|None` (options carried on the field def — note: `metadata_field_definitions` has NO `options` column today; **recommend storing enum options in the `description` field as a parseable convention OR add an `options jsonb` column in migration 072** — flag this gap to the planner). The 7 built-ins are always-on and immutable. `_confidence` survives `exclude_none` (populated dict). **The underscore-field-name caveat (Pattern 2) is the one ASSUMED item that MUST be unit-tested in Wave 0.**

**Gap flagged:** `metadata_field_definitions` (migration 071) has columns `field_key, field_type, description, is_global, enabled` — **NO `options` column** [VERIFIED migration 071:89-104]. The `enum` field_type cannot carry options without one. Planner decision: either (a) add `options jsonb` to `metadata_field_definitions` in migration 072 (cleanest), or (b) defer `enum` to a follow-on and ship `{string,date,number,boolean}` in 111. Recommend (a) — one column, additive.

### Q5: Sync→async seam (D-111-1) — CONFIRMED
See Pattern 3. `asyncio.run(...)` inside the sync BackgroundTask is correct [VERIFIED documents.py:218 precedent; ingest_document is sync at :1334]. D-v2.5-01 does NOT fire (no event loop on the threadpool worker). Do NOT make ingest_document async; do NOT wrap forced_emit in run_in_threadpool.

### Q6: Explicit user-scoped field-def read (D-111-6) — CONFIRMED
See Pattern 4. Exact query: `.or_(f"user_id.eq.{doc_owner_uid},is_global.eq.true")` against `metadata_field_definitions`, `doc_owner_uid` = `ingest_document`'s `user_id` param (`documents.py:1337`). Precedent: `workflow_authoring._skill_registry` reads `skills` under service-role with this exact `.or_` shape + fail-closed filter [VERIFIED workflow_authoring.py:152-181]. Existing ingest code already reads its user-scoped data via the `user_id` param threaded through (e.g. `chunk_rows` set `"user_id": user_id` at documents.py:1410).

### Q7: Window head+tail sampling + cap (D-111-4) — RESOLVED
**Recommendation:** Replace `content[:3000]` with head+tail sampling:
```python
def sample_for_extraction(text: str, cap_chars: int) -> str:
    if len(text) <= cap_chars:
        return text.strip()
    head = text[: int(cap_chars * 0.7)]      # title page, abstract, author block
    tail = text[-int(cap_chars * 0.3):]      # signatures, dates, bylines at the end
    return (head + "\n\n[...document body elided for metadata extraction...]\n\n" + tail).strip()
```
- New `app_settings.extraction_window_cap` column (int, char-based for simplicity; or token-based — recommend chars to avoid a tokenizer dependency, with a conservative char→token ratio of ~4:1 when validating against the model window).
- Validate `cap_chars` against the resolved model's context window (leave room for system prompt + schema + output). On a small local model, clamp the effective cap. Truncate-then-degrade — NEVER fail.
- Quality-first: default cap can be generous (e.g. 32,000 chars ≈ 8k tokens) for cloud models; the per-model clamp protects local models.

### Q8: /reextract path (D-111-10) — CONFIRMED
**Finding (VERIFIED):** `/reextract` (documents.py:967) extracts text then calls `background_tasks.add_task(ingest_document, ...)` at `documents.py:1178`. `ingest_document`'s persist site comment confirms "Consistent across /upload, /reingest, /reextract (all paths hit this ingest_document write site)" [VERIFIED documents.py:1475]. **It is NOT a separate metadata-only path** — the new enrichment + `_confidence` + custom fields apply on re-extract automatically. D-111-10 confirmed; no special handling needed. (The `_reextract_refill_empty_descriptions` short-circuit at :1079 is an image-description-only fast path that does NOT touch metadata — it returns before the ingest call, so metadata re-enrichment only happens on the full /reextract path, which is correct.)

### Q9: Setting + reversibility (D-111-2) — RESOLVED
**Migration 072 column set (recommend ONE migration `072_app_settings_extraction_model.sql`):**
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS extraction_model            text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_window_cap       integer DEFAULT 32000,
  ADD COLUMN IF NOT EXISTS metadata_enrichment_mode    text DEFAULT 'enriched';
-- if enum field_type ships in 111 (Q4 gap (a)):
ALTER TABLE public.metadata_field_definitions
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL;
```
- Idiom = migration 045's `ADD COLUMN IF NOT EXISTS … text` [VERIFIED 045 + next free number is 072 per CONTEXT].
- `extraction_model` DB-only, default NULL → fall back to env `settings.llm_model` (gpt-4o), NOT `app_settings.llm_model`.
- `metadata_enrichment_mode`: recommend **TEXT enum** (`'enriched'|'legacy'`) over boolean — more extensible (future `'flag'`/`'partial'` modes echo the 102 citation_policy precedent) and self-documenting. Default `'enriched'` (DEFAULT-ON).
- Add 3 (or 4) fields to `UserEffectiveSettings` + 3 `_build_settings_from_row` lines with `env_attr=None` (app_settings-only, no env fallback — the DMF-03 precedent at user_settings.py:480) [VERIFIED _build_settings_from_row pattern]. Recommend `metadata_enrichment_mode` validated to the closed set; `extraction_window_cap` as `int`.
- **HOIST `load_app_settings()`** above the `extract_metadata` call. It currently runs at documents.py:1403; the extract call is at :1368. Move the `app_settings = load_app_settings()` read to before :1368 so `extraction_model` / `window_cap` / `enrichment_mode` are in scope [VERIFIED both line locations].
- **Apply migration** by pasting into the Supabase SQL editor (or psycopg2-direct to :54322 per the 100/102/110 operator-authorized precedent) — NEVER `db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no --reset) and commit both [CLAUDE.md].
- **Cache caveat (note, not a bug):** `save_app_settings` invalidates only the writing worker's 30s-TTL cache; a freshly-set `extraction_model` may take ≤30s to reach a sync ingest on another worker (`WORKER_COUNT=2`). Acceptable for an admin knob [D-111-2].

## Runtime State Inventory

> This is a backend re-platforming phase, not a rename/refactor. No string-rename runtime state applies. Included for completeness per the additive-not-destructive nature of the change.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `documents.metadata` JSONB on existing docs (19 docs in local dev per STATE.md) carry the OLD 7-field shape, NO `_confidence` | None at ingest-rewrite time. Existing docs re-enrich via opt-in `/reextract` only (D-111-10) — never auto-bulk. Old docs remain valid (additive: new keys, flat fields unchanged). |
| Live service config | `app_settings` row in DB — new columns default-applied by migration 072 | Migration 072 applied via SQL editor / psycopg2; full-schema regenerated. |
| OS-registered state | None | None — no OS registrations involved. |
| Secrets/env vars | New `LMSTUDIO_BASE_URL` env (non-secret; default `http://localhost:1234/v1`). `extraction_model` is a VALUE not a secret → DB column, not env (CLAUDE.md). | Add `LMSTUDIO_BASE_URL` to `backend/.env.example`. No secret rotation. |
| Build artifacts | None | None — no package rename. |

**Audit enum:** `metadata.field.create` is ALREADY in both `VALID_ACTION_TYPES` (audit_service.py:25) AND migration 071's live CHECK (STATE.md confirms 19-type CHECK applied). **No audit migration in 111** — verified. Just call `write_audit_entry(..., action_type="metadata.field.create")` from the CRUD create endpoint and verify with a live INSERT+SELECT.

## Common Pitfalls

### Pitfall 1: Grammar-constrained response_format assumed to "just work" for local
**What goes wrong:** Plan assumes flipping `strict=True` or the existing `strict_response_format` seam grammar-constrains local output.
**Why it happens:** The seam exists and the docs say LM Studio supports json_schema — but the seam is TIER-FORCE-only AND openai-only (openai_service.py:1399). Local is TIER-COERCE.
**How to avoid:** Treat grammar-constraint for local as net-new, provider-gated, live-verified, OPTIONAL work (Q2). Ship COERCE + validate-retry as the default.
**Warning signs:** A plan task that says "pass strict=True for local models" with no openai_compat wiring change.

### Pitfall 2: `_confidence` dropped or never emitted
**What goes wrong:** A bare `model_dump(exclude_none=True)` drops `_confidence` if it's None, or the Pydantic underscore-field rule excludes it entirely.
**Why it happens:** Pydantic-2 treats `_`-prefixed names as private attrs (not in model_dump); a default-None confidence dict gets dropped by exclude_none.
**How to avoid:** Name the field `confidence` (no underscore) in the Pydantic model, default to `{}` (never None), attach to `metadata_dict["_confidence"]` AFTER the dump, guarding the metadata-None case (Pattern 2).
**Warning signs:** A doc's stored metadata has flat fields but no `_confidence` sub-key.

### Pitfall 3: exclude_none non-regression broken (author coerced to "")
**What goes wrong:** A "fix" forces empty `author: ""`, corrupting equality filters.
**Why it happens:** Someone reads the dropped-author behavior as a bug.
**How to avoid:** Lock `exclude_none=True` as intended; guard with a test asserting empty author is ABSENT, not `""` [PITFALLS.md Pitfall 5; D-111-9].
**Warning signs:** `author: ""` in stored metadata; a removed `exclude_none`.

### Pitfall 4: AttributeError('active_provider') from passing app-level Settings
**What goes wrong:** Passing `config.settings` (the env Settings) to `forced_emit(user_settings=...)` raises AttributeError inside the gateway.
**Why it happens:** The gateway reads `user_settings.active_provider`, which exists on `UserEffectiveSettings` but NOT on app-level `Settings` [VERIFIED workflow_authoring.py:398-414 documents this exact live fix].
**How to avoid:** Pass a real `UserEffectiveSettings` — from `load_app_settings()` (admin-global, has `.active_provider`) for the extraction call. NOT `config.settings`.
**Warning signs:** Generic `provider_error` from forced_emit on every extraction; AttributeError in logs.

### Pitfall 5: Service-role over-returns field defs (cross-user leak)
**What goes wrong:** Reading `metadata_field_definitions` under service-role without an explicit predicate returns EVERY user's custom fields.
**Why it happens:** No `auth.uid()` in a BackgroundTask → RLS bypassed (110 SECURITY lesson).
**How to avoid:** Explicit `.or_(user_id.eq.{owner},is_global.eq.true)` + fail-closed filter (Pattern 4).
**Warning signs:** A doc extracted with another user's custom fields in its schema.

## Code Examples

### The full extraction call site shape (inside ingest_document, enriched branch)
```python
# Source: composed from workflow_authoring.py:434-444 (forced_emit caller) + documents.py:218 (asyncio.run)
app_settings = load_app_settings()                      # HOISTED above the extract call
mode = app_settings.metadata_enrichment_mode            # 'enriched' | 'legacy'

if mode == "enriched":
    from app.config import get_model_capability
    model = app_settings.extraction_model or settings.llm_model    # gpt-4o fallback
    provider = (get_model_capability(model) or {}).get("provider")
    defs = read_enabled_field_defs(supabase, user_id)              # Pattern 4
    DynModel = build_metadata_model(defs)                          # Pattern 2
    emit_tool = {"type": "function", "function": {
        "name": "emit_document_metadata",
        "description": "Emit structured metadata for this document with a per-field 0-1 confidence.",
        "parameters": DynModel.model_json_schema(),
    }}
    sampled = sample_for_extraction(text, app_settings.extraction_window_cap)   # Q7
    try:
        result = asyncio.run(extract_metadata_enriched(            # NEW async fn
            sampled=sampled, model=model, provider=provider,
            schema_model=DynModel, emit_tool=emit_tool,
            user_settings=app_settings,                            # real UserEffectiveSettings
        ))
        emitted = result.get("emitted")                           # None → honest fail
    except Exception:
        logger.warning("enriched extraction raised; degrading to None")   # D-111-8 swallow
        emitted = None
    metadata_dict = emitted.model_dump(exclude_none=True) if emitted else None
    if metadata_dict is not None and getattr(emitted, "confidence", None):
        metadata_dict["_confidence"] = emitted.confidence         # attach AFTER dump (Pattern 2)
else:
    metadata = extract_metadata(text)                             # UNTOUCHED legacy path
    metadata_dict = metadata.model_dump(exclude_none=True) if metadata else None

# shared tail (UNCHANGED): lowercase document_type + language, persist (D-111-9)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI-only `json_object` extraction, hardwired gpt-4o, content[:3000], static 7-field | `forced_emit` cross-provider, configurable model, head+tail window, dynamic schema + confidence | Phase 111 | Any model (incl. local) works; custom fields; per-field confidence; the M-Files spine |
| `strict_response_format` json_schema | Still OpenAI-only + TIER-FORCE-only (openai_service.py:1399) | Phase 101.1/103 (unchanged) | Local grammar-constraint is net-new if wanted (Q2) |

**Deprecated/outdated:** The sync `extract_metadata` is NOT deprecated — it's retained as the `legacy` reversibility path. Keep it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pydantic-2 `_`-prefixed field name is excluded from model_dump (private-attr rule) → use `confidence` then rename | Pattern 2 / Q4 / Pitfall 2 | If wrong, `_confidence` could be emitted directly — but the recommended workaround (non-underscore field + post-dump attach) is correct EITHER way. LOW risk. MUST unit-test in Wave 0. |
| A2 | 3B is the value-reliability floor; sub-3B emits valid JSON but unreliable values | Q3 | If a sub-3B model is "good enough," we under-claim. Quality judgment from model-class reputation, not measured. Validated by the local-model UAT row. LOW risk. |
| A3 | Llama-3.1-8B overflows 6GB VRAM via KV-cache | Q3 | Standard 8B-at-6GB constraint; if wrong, just an extra viable option. LOW. |
| A4 | enum field_type needs an `options` carrier; 071 has no `options` column | Q4 gap | If the planner ships only {string,date,number,boolean}, no impact. If enum ships, needs the column (recommended in migration 072). MEDIUM — flagged to planner. |
| A5 | char-based window cap with ~4:1 char→token ratio is adequate for model-window validation | Q7 | A token-based cap is more precise but adds a tokenizer dep. Conservative char ratio is safe (under-fills). LOW. |

## Open Questions

1. **enum options carrier** — see A4. Recommendation: add `options jsonb` to `metadata_field_definitions` in migration 072, or defer enum to a follow-on. **Planner decides.**
2. **Per-field confidence calibration prompt** — the system-prompt wording for confidence self-reporting (0-1 per field, few-shot) is Claude's discretion per CONTEXT. Recommendation: instruct "set confidence 0.0 when the value was not found and is null; 0.3-0.6 when inferred/guessed; 0.9+ when explicitly stated in the document." Tune against the cross-provider UAT.
3. **Temperature for determinism** — not currently a `forced_emit` param. If the local proof needs temperature 0, a small additive may be required. Non-blocking; flag at plan time.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (:54322) | migration 072 + field-def reads + audit | ✓ (per STATE.md, 19 docs live) | local CLI | — |
| `pydantic` | dynamic create_model | ✓ | 2.x (project dep) | — |
| `openai` SDK | local-model transport | ✓ | project dep | — |
| LM Studio + Qwen2.5-7B GGUF | SC#4 local-model UAT row | ✗ (operator machine, RTX 4050) | — | Operator installs LM Studio + downloads GGUF before the local UAT row; the impersonation path (LLM_PROVIDER=ollama→1234) is the documented fallback if the first-class provider has issues |
| Native-7 provider keys | SC#4 cross-provider UAT | ✓ (per memory: all native-7 keys in backend/.env) | — | — |

**Missing dependencies with no fallback:** None block code/migration work.
**Missing dependencies with fallback:** LM Studio (operator-side; impersonation fallback exists). The local-model UAT row requires the operator to have LM Studio running with Qwen2.5-7B loaded — flag this as an operator pre-req for the D-111-11b row.

## Validation Architecture

> nyquist_validation is enabled (no explicit false in config). This section is consumed to author VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), with unit + integration split (`backend/tests/unit/`, `backend/tests/integration/`) |
| Config file | `backend/pytest.ini` / project conftest (existing — Phase 110 added `tests/integration/test_110_audit_drift_guard.py`) |
| Quick run command | `cd backend && venv\Scripts\python -m pytest tests/unit/test_111_*.py -x -q` |
| Full suite command | `cd backend && venv\Scripts\python -m pytest -q` (use SEED-056 stash-and-rerun to prove net-new=0 vs base; ~119 pre-existing rot failures at baseline) |

### Phase Requirements → Test Map
| Req / Invariant | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-01 (define) | CRUD create writes own-scoped, is_global=false forced; list returns own+global enabled | integration (live DB) | `pytest tests/integration/test_111_metadata_fields_crud.py -x` | ❌ Wave 0 |
| META-01 (extract) | `build_metadata_model` folds enabled custom fields into the schema (7 built-ins + custom + confidence) | unit | `pytest tests/unit/test_111_dynamic_model.py::test_custom_fields_in_schema -x` | ❌ Wave 0 |
| META-01 (vocab) | field_type validated against closed {string,date,number,boolean,enum} `Literal`; unknown rejected | unit | `pytest tests/unit/test_111_dynamic_model.py::test_field_type_vocabulary -x` | ❌ Wave 0 |
| META-03 (un-pin) | extraction_model resolves from app_settings; unset → settings.llm_model (gpt-4o) | unit | `pytest tests/unit/test_111_extraction_model_resolve.py -x` | ❌ Wave 0 |
| META-03 (settings) | migration 072 columns read back via _build_settings_from_row (env_attr=None) | integration (live DB) | `pytest tests/integration/test_111_settings_readback.py -x` | ❌ Wave 0 |
| META-04 (window) | head+tail sampler returns head+tail for >cap text, full text for ≤cap; cap clamps to model window | unit | `pytest tests/unit/test_111_window_sampling.py -x` | ❌ Wave 0 |
| Confidence survival | `confidence` populated dict survives `model_dump(exclude_none=True)`; attaches as `_confidence` | unit | `pytest tests/unit/test_111_confidence_survives_exclude_none.py -x` | ❌ Wave 0 |
| exclude_none non-regression | empty author DROPPED (not `""`); flat fields stay top-level | unit | `pytest tests/unit/test_111_exclude_none_nonregression.py -x` | ❌ Wave 0 |
| Flat-filter non-regression | stored metadata with `_confidence` still matches a flat `@>` containment filter | integration (live DB) | `pytest tests/integration/test_111_flat_filter_compat.py -x` | ❌ Wave 0 |
| User-scoped read | field-def read with explicit `.or_(user_id,is_global)` returns own+global only, NOT cross-user (2-user) | integration (live DB) | `pytest tests/integration/test_111_field_def_scoping.py -x` | ❌ Wave 0 |
| lmstudio provider | `lmstudio` in `_PROVIDER_BASE_URLS`; resolve_llm_provider sets base_url, dummy key, no /v1 append | unit | `pytest tests/unit/test_111_lmstudio_provider.py -x` | ❌ Wave 0 |
| Audit live | `metadata.field.create` INSERTs and SELECTs back against live DB (NOT mocked) | integration (live DB) | `pytest tests/integration/test_111_audit_field_create.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_111_*.py -x -q` (the unit subset — fast, <30s).
- **Per wave merge:** the full `test_111_*` set incl. integration (requires local Supabase up).
- **Phase gate:** full suite green (net-new=0 vs base via SEED-056 stash-and-rerun) before `/gsd:verify-work`; THEN the live SC#4 4-axis UAT (below).

### LIVE-only / can't-be-mocked gate (THE CRITICAL GATE — the D-102/104 lesson)

> Static def-shape tests FALSE-GREEN forced-structured-output, provider-forcing, and audit-enum failures (104 found 6 mock-masked blockers live; 102 found the judge gate had never worked). The following MUST be driven LIVE and authored in VALIDATION.md, NOT as PLAN.md tasks:

**SC#4 4-axis (D-111-11) — LIVE, per the CLAUDE.md UAT scoreboard recipe:**

| Axis | Live probe | Acceptance |
|------|-----------|------------|
| (a) Cross-provider dynamic-schema extraction | Ingest the SAME doc with `extraction_model` set to one representative model per native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax) + OpenRouter; SELECT the stored `documents.metadata` per run | **pass OR documented limitation per provider.** DeepSeek (deepseek-v4-pro) + Gemini (gemini-2.5-pro) may honest-fail the forced emit per BUG-260615-01 finding 3; MiniMax-M3 may malform tool-args per BUG-260607-03. COERCE + degradation is the net — 111 does NOT own the provider fix. A honest-fail that degrades to null metadata (doc still completed) is ACCEPTABLE and documented. |
| (b) Local model | Ingest a doc with `extraction_model` = the LM Studio Qwen2.5-7B-Instruct model id, `LLM_PROVIDER=lmstudio` (or provider threaded); SELECT stored metadata + `_confidence` | A valid dynamic-schema emission via TIER-COERCE (narration-recovery) with custom fields + confidence. Operator pre-req: LM Studio running, Qwen2.5-7B loaded. |
| (c) Long-doc window-lift | Ingest a ≥5KB doc whose title/byline data is AFTER char 3000 and dates are at the very end; SELECT metadata | The late title/date is captured (proves head+tail sampling beats the old content[:3000]). |
| (d) Graceful degradation | Ingest with a deliberately-failing/garbage-emitting model (e.g. a tiny/broken local model or a model id that 400s); SELECT the doc row | Doc reaches `status=completed` with null/partial metadata — NEVER stuck in `processing`/`failed` from the extraction step. Both backstop layers preserved. |

**Plus the live audit:** `metadata.field.create` INSERT via the CRUD create endpoint, then SELECT it back from `audit_log` on the live DB. (The 110 audit drift guard already proves the enum is in the live CHECK.)

**Mocking ban:** axes (a)/(b)/(d) and the audit INSERT MUST hit real providers/DB. A def-shape or mocked test passing is NOT sufficient evidence for these — it false-greens exactly the failures this gate exists to catch.

### Wave 0 Gaps
- [ ] `tests/unit/test_111_dynamic_model.py` — create_model schema + field_type vocabulary (META-01)
- [ ] `tests/unit/test_111_confidence_survives_exclude_none.py` — the A1 underscore-field caveat (BLOCKING — verify the chosen field naming)
- [ ] `tests/unit/test_111_exclude_none_nonregression.py` — empty author dropped (D-111-9)
- [ ] `tests/unit/test_111_window_sampling.py` — head+tail + cap clamp (META-04)
- [ ] `tests/unit/test_111_extraction_model_resolve.py` — model resolution + gpt-4o fallback (META-03)
- [ ] `tests/unit/test_111_lmstudio_provider.py` — provider registration (D-111-7)
- [ ] `tests/integration/test_111_metadata_fields_crud.py` — CRUD + RLS forcing (META-01)
- [ ] `tests/integration/test_111_field_def_scoping.py` — 2-user service-role scoping (D-111-6)
- [ ] `tests/integration/test_111_settings_readback.py` — migration 072 read-back (META-03)
- [ ] `tests/integration/test_111_flat_filter_compat.py` — @> still matches with _confidence present (D-111-9)
- [ ] `tests/integration/test_111_audit_field_create.py` — live INSERT+SELECT (D-111-5/11)
- [ ] Framework install: none — pytest + venv already present

## Security Domain

> security_enforcement is enabled (no explicit false). Phase 110 set the secure-phase precedent (11/11 threats CLOSED).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | CRUD endpoints use the existing `get_current_user` dependency (request JWT); same as documents/skills routers |
| V3 Session Management | no | No new session surface |
| V4 Access Control | **yes (HIGH)** | (1) CRUD create hard-sets `user_id=caller` + `is_global=false` (RLS WITH CHECK forces it — migration 071:167-172). (2) Ingest-time field-def read is EXPLICITLY user-scoped in app code (service-role bypasses RLS — D-111-6, the 110 lesson). 404-not-403 on cross-user CRUD miss (D-v2.6-04 precedent). |
| V5 Input Validation | **yes** | `field_type` validated against a closed `Literal` vocabulary (DB has no CHECK); `field_key` recommend a `^[a-z][a-z0-9_]*$` regex + unique-per-user; reject keys colliding with the 7 built-ins or `_confidence`/`_classification` reserved prefixes |
| V6 Cryptography | no | No crypto; LM Studio dummy key is not a secret |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user field-def leak via service-role over-return | Information Disclosure | Explicit `.or_(user_id,is_global)` + fail-closed filter (Pattern 4 / D-111-6); 2-user live test |
| Custom field_key injection (reserved-key collision / prompt injection via description) | Tampering | Closed-vocabulary field_type; field_key regex; treat `description` as untrusted text in the extraction prompt (it's user-authored) — it's data, not instructions; the dynamic schema's `additionalProperties:false` (Pydantic strict) rejects extra keys |
| LLM-emitted value used as a `metadata_filter` dimension | Tampering | `_confidence` is DISPLAY-ONLY (112), NEVER a filter dimension — a nested `@>` filter triggers exact-subtree containment and breaks (D-111-3) |
| Global field def created by a non-admin | Elevation of Privilege | RLS WITH CHECK forces `is_global=false` on INSERT; CRUD also hard-sets it (migration 071:167; D-111-5) |
| Garbage/failing model breaks ingestion (availability) | Denial of Service | Two-layer graceful degradation preserved (D-111-8); doc always reaches completed |
| LM Studio endpoint as an SSRF/exfil vector | Tampering / Info Disclosure | `LMSTUDIO_BASE_URL` is an admin-set env (not user-controlled); same trust model as `OLLAMA_BASE_URL` |

## Sources

### Primary (HIGH confidence — live source, this session)
- `backend/app/services/forced_emit.py:140-154,205-249,260-275,294-364` — schema_model/strict params, default-SAFE tier routing, cross-provider key injection, COERCE branch, narration recovery, honest-fail
- `backend/app/services/workflow_authoring.py:83-105,127-137,152-181,398-414,434-444` — caller precedent: own EMIT tool, resolve model, service-role scoping, UserEffectiveSettings live-fix, forced_emit call
- `backend/app/services/openai_service.py:970-984,1302-1463` — get_llm_client; create_adaptive_streaming_chat; strict_response_format gated to TIER-FORCE + provider==openai (the Q2 finding); COERCE/auto STRUCTURED branch passes no tools/response_format
- `backend/app/services/embedding_service.py:94-138` — extract_metadata (content[:3000], json_object, try/except→None)
- `backend/app/api/documents.py:136-252,218,967,1116-1191,1334-1505` — _upload_pipeline (sync, asyncio.run), /reextract→ingest_document convergence, ingest_document (sync, exclude_none, persist, outer try/except, load_app_settings at :1403)
- `backend/app/models/user_settings.py:306-318,437-518` — _val/_build_settings_from_row/load_app_settings (env_attr=None app_settings-only pattern, DMF-03 precedent)
- `backend/app/config.py:10-20,340-476,680-755,962` — _PROVIDER_BASE_URLS, inference/_build_inferred_defaults, resolve_llm_provider key_map, harness_judge_model DB-only precedent
- `backend/app/services/provider_gateway/dispatcher.py:100-128` — else-branch → open_openai_compat_stream
- `backend/app/services/provider_gateway/openai_compat.py:381-409` — strict_response_format forwarding seam
- `backend/app/services/audit_service.py:13-54` — VALID_ACTION_TYPES (metadata.field.create at :25) + drift guard
- `backend/app/services/retrieval_service.py:248-258` — flat lowercased metadata_filter build
- `backend/app/models/document.py:8-15` — static 7-field DocumentMetadata (built-ins source)
- `supabase/migrations/071_dm_foundations.sql:88-172` — metadata_field_definitions DDL (no options col, no field_type CHECK) + RLS (is_global=false forced)
- `supabase/migrations/045_app_settings_extraction_aspects.sql` — ADD COLUMN IF NOT EXISTS idiom (next = 072)
- `.planning/STATE.md` — Phase 110 shipped: migration 071 applied live, 19-type CHECK, 27 live tests green
- `.planning/phases/111-metadata-enrichment-extraction-backend/111-CONTEXT.md` — D-111-1..11 (all file:line re-verified)
- `.planning/research/v3.0-document-management/ARCHITECTURE.md` §4 + PITFALLS.md (Pitfalls 4/5; exclude_none non-regression)

### Secondary (HIGH-MEDIUM — official provider docs, CITED)
- LM Studio structured output: https://lmstudio.ai/docs/developer/openai-compat/structured-output (response_format json_schema + strict; GGUF grammar-based sampling; base http://localhost:1234/v1, key "lm-studio"; <7B struggle)
- LM Studio tools: https://lmstudio.ai/docs/developer/openai-compat/tools (OpenAI-compat tool calling; Qwen2.5-7B native tool support)
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs (native `format` param; OpenAI-compat response_format exists but unassessed; Cloud unsupported) + GitHub #10001 (flakiness)

### Tertiary (MEDIUM — WebSearch, cross-referenced)
- Qwen2.5-7B Q4_K_M VRAM: localai.computer (~4GB weights) + Medium/Novita (~5.7GB w/ context) — confirms 6GB tight-but-fits, modest 4-8k context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `forced_emit` + Pydantic + gateway all re-verified by file:line; zero new deps
- Architecture: HIGH — every CONTEXT decision re-confirmed against live source; the two live-precedent callers read in full
- Local provider / grammar-constraint: HIGH on the wiring finding (verified the seam is openai+force-only); MEDIUM-CITED on LM Studio capabilities (official docs); ASSUMED on local-model value-quality floors (A2/A3)
- Pitfalls: HIGH — drawn from verified source + the D-102/104/110 shipped lessons
- Validation: HIGH — the LIVE gate is the explicit D-111-11 contract + the 104 mock-masked-blocker precedent

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable internal architecture; LM Studio/Ollama docs are the only fast-moving external — re-check before the local UAT row if >2 weeks elapse)
