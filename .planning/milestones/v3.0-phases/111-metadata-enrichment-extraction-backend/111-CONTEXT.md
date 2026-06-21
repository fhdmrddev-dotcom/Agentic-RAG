# Phase 111: Metadata Enrichment — Extraction Backend - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the thin, fixed-schema metadata extraction with a **configurable, model-flexible, confidence-scored enrichment pipeline** — the spine the M-Files "metadata not folders" story rests on and the **hard prerequisite for auto-classification (118)**.

Today's extractor (`embedding_service.extract_metadata`, `embedding_service.py:100-137`) is: an **OpenAI-only `response_format=json_object` call** via `get_llm_client()` (no `user_settings` → provider hardwired `openai` + env creds, `openai_service.py:970-984`), **hardwired to `settings.llm_model` (gpt-4o)**, reading only **`content[:3000]`**, validating a **static 7-field `DocumentMetadata`** (`models/document.py:8-15`), with **no per-field confidence**. The caller `ingest_document` (`documents.py:1368`) passes no model.

**In scope (META-01, META-03, META-04):**
- Re-platform extraction onto the proven cross-provider `forced_emit` substrate so any user/admin-selected model works (incl. local LM Studio/Ollama) — not hardwired gpt-4o.
- Lift the 3,000-char window (configurable head+tail sampling) so late title-page/byline data isn't missed.
- User-defined **custom metadata fields** (from `metadata_field_definitions`) extracted on ingest via a runtime Pydantic `create_model` schema (built-in 7 always-on + custom additive).
- **Per-field confidence** stored flat under a nested `_confidence` sub-key in `documents.metadata`.
- A backend CRUD API to **define** custom fields (satisfies META-01's "user can define").
- An admin-global `extraction_model` setting + a window-cap setting + an enrichment reversibility knob.
- Cross-provider (native-7) + local-model SC#4 4-axis VALIDATION rows.

**Out of scope (NOT this phase):**
- The document detail panel + per-field-confidence DISPLAY + manual edit → **Phase 112** (META-02, META-05). 111 ships no UI; the field-management UI is deferred (112 or a Settings slice).
- Views/filters, relationships, classification, governance → 113–119.
- Fixing provider-side forced-structured-output reliability (DeepSeek/Gemini narrate-instead-of-force, MiniMax malformed tool-args) — 111 treats these as **pass-OR-documented** per provider; the FIX pairs with SEED-082 / a provider-feature-fit phase (see Deferred + reported-bug routing).
- Promoting metadata to typed/indexed columns for range queries → that's **Phase 113/114** (views) territory, not enrichment.

</domain>

<decisions>
## Implementation Decisions

> Every decision below was adversarially verified against live source (workflow `verify-111-context`, 7 agents). Verdicts and file:line evidence are in `<canonical_refs>`.

### Engine — cross-provider structured extraction

- **D-111-1 — Re-platform `extract_metadata` onto `forced_emit` (the cross-provider engine).** Replace the OpenAI-only `json_object` path with `forced_emit` (`forced_emit.py:205`), which routes through the provider gateway (native-7 + OpenRouter + local) and picks **TIER-FORCE** for capable models / **TIER-COERCE** (prompt-injected schema + narration recovery + hard validation) for the rest — default-SAFE (a registry miss → COERCE, never a wrong force, `forced_emit.py:245-249`).
  - **Build a DEDICATED emit tool** whose `parameters = <dynamic metadata model>.model_json_schema()`, `emitter="emit_document_metadata"`, and pass `schema_model=<dynamic model>`, `strict=False`. **Do NOT reuse `phase_types._emit_forced_tool`** — that tool is `EmitFieldMap`-shaped (`phase_types.py:860-880`); reusing it with a different `schema_model` would make the advertised tool and the validator disagree. `forced_emit` itself owns no tool — the caller does (precedents: `workflow_authoring` → `WorkflowDefinition`; judge → `JudgeVerdict`).
  - **This is a re-platforming, not a 1-line swap.** Today's path uses `get_llm_client()` with no `user_settings`. The new path must resolve + pass `model` + `provider` + a **real `UserEffectiveSettings`** (with `.active_provider`) — passing app-level `Settings` raises `AttributeError('active_provider')` inside the gateway (`workflow_authoring.py:398-414`). Source the settings via `load_user_settings(user_id)` (`ingest_document` has `user_id` in scope, `documents.py:1337`); resolve the model by mirroring `resolve_authoring_model` / `resolve_judge_model`.
  - **Sync→async seam:** add a NEW `async def` extraction function and call it via `asyncio.run(...)` inside the existing **sync** `ingest_document` BackgroundTask — mirroring the established `asyncio.run` at `documents.py:218`. The whole `_upload_pipeline → ingest_document → extract_metadata` chain is sync and runs in a Starlette threadpool worker (off the event loop), so `asyncio.run` is legal and D-v2.5-01 does NOT fire. **Do NOT** make `ingest_document`/`_upload_pipeline` async (changes the BackgroundTask threading model; ripples into `/reingest` + telemetry). **Do NOT** wrap `forced_emit` in `run_in_threadpool` (it's a coroutine; it already wraps its own blocking drain internally, `forced_emit.py:324`).
  - `strict=False` is **required** — the dynamic enrichment model is optional-heavy (all fields nullable); without it OpenAI/DeepSeek strict-mode 400s. The `strict` override exists (Phase 103 additive, `forced_emit.py:247-248`).

### Setting + default + reversibility

- **D-111-2 — Admin-global `app_settings.extraction_model`, default unset → gpt-4o; the new enrichment path is DEFAULT-ON; a separate knob reverts to legacy.**
  - The setting is a **DB-only `app_settings` column** (mirror the existing `extraction_*` engine columns + `harness_judge_model` — NOT in `SettingsUpdate`, **no UI work**). `load_app_settings()` is sync/cache-only and already used inside `ingest_document` (`documents.py:1403`). Migration `072_app_settings_extraction_model.sql` (next free number after 071); add an `extraction_model: str = ''` field to `UserEffectiveSettings` + one `_build_settings_from_row` line (`env_attr=None` → app_settings-only). **Hoist** `load_app_settings()` above the `extract_metadata` call (`documents.py:1368`, currently read at `:1403`) so it's in scope.
  - **Model-agnostic by design** (operator: *"guarantee anything will work; business/production decides"*). Keep `gpt-4o` as the unset default; Sonnet / `gpt-5.4` / `gpt-5.5` / `claude-opus-4-8` are all valid picks (the expensive ones stay *options*, not defaults). Default fallback target = env `settings.llm_model` (gpt-4o), **NOT** `app_settings.llm_model`.
  - **The NEW forced_emit enrichment path is DEFAULT-ON for new ingests** — so per-field confidence + custom fields + the window lift actually apply by default (the phase's whole value). ⚠️ **This means "unset" is NOT byte-identical to today's extraction internals** (it routes through the gateway, not the env-OpenAI `json_object` client). It IS additive (built-in 7 preserved, `exclude_none` preserved) and **reversible** via:
  - **A separate enrichment reversibility knob** (the D-110-2 "own knob", deliberately NOT the master DM capability flag). Recommend `app_settings.metadata_enrichment_mode` (`enriched` | `legacy`, default `enriched`) — `legacy` falls back to the untouched OpenAI `json_object` path. **[OPERATOR JUDGMENT CALL — flagged for veto]:** the alternative is "unset = legacy, enrichment opt-in," but that ships the default experience with NO enrichment, defeating the phase. Recommendation stands: default-on + revert knob.
  - **Cache caveat (note, not a bug):** `save_app_settings` invalidates only the writing worker's 30s-TTL cache; a freshly-set `extraction_model` may take ≤30s to reach a sync ingest BackgroundTask on another worker (`WORKER_COUNT=2`). Acceptable for an admin knob.

### Confidence + window + storage

- **D-111-3 — Per-field confidence: model self-reports 0–1 per field in the same structured emission.** The dynamic model carries a `_confidence: dict[str, float]` field. **Attach `_confidence` to `metadata_dict` AFTER `model_dump(exclude_none=True)`** (a bare dump won't emit it), guarding the `metadata is None` case (`metadata_dict = metadata_dict or {}` before attaching; or only attach when not None — decide whether a doc with failed core extraction but partial confidence persists a metadata object). `_confidence` is a **populated dict → survives `exclude_none`** (only None *values* are dropped). It is **DISPLAY-ONLY (META-02, Phase 112)** — **NEVER a `metadata_filter` dimension** (a nested `@>` filter triggers exact-subtree containment and would break, `retrieval_service.py:258`).

- **D-111-4 — Window lift: generous head+tail sampling, NEW configurable cap.** Replace the hardcoded `content[:3000]` (`embedding_service.py:107`) with head + tail sampling (title page lands at the top; bylines/signatures/dates at the very end) and a NEW configurable cap (app_settings/env — no existing knob). **Quality-first** (operator: *cost is not a constraint*), but the cap MUST be validated against the resolved model's context window — a small local model (D-111-7) can overflow; on overflow **truncate-then-degrade**, never fail. Token budget is bounded by the chosen model, not a cost ceiling.

- **D-111-9 — Preserve `exclude_none=True` + flat filterable fields + `@>` containment as guarded non-regression invariants.** Empty `author` stays *dropped*, never coerced to `""` (intended best-effort behavior; guard with a test). All AI-filterable fields stay FLAT at `documents.metadata` top level (`document_type`, `language`, `author`, `date`, `title`); confidence/derived data confined to nested `_confidence`. `@>` partial containment (`full-schema.sql:108,132`) ignores extra top-level/nested keys, so existing flat filters are unaffected. No migration on `documents.metadata` (single JSONB column).

### Custom-field authoring (META-01)

- **D-111-5 — 111 ships a NEW `backend/app/api/metadata_fields.py` router (CRUD) + dynamic schema; built-ins always-on, custom additive.** META-01 ("user can DEFINE custom fields") is mapped to 111 and `metadata_field_definitions` has **zero code touching it today** (pure 110 substrate). Endpoints: create / list (own + global enabled) / enable-disable+edit / delete. **Do NOT fold into `documents.py`** (already 1478+ lines, hot, unrelated domain — own router mirrors skills/folders). `field_type` is **free text in the DB (no CHECK)** → validate the `{string | date | number | enum}` (+ likely `boolean`) vocabulary in app code via a Pydantic `Literal`/closed registry. Create endpoint **hard-sets `user_id=caller` + `is_global=false`** (RLS forces this too, `071:165-172`). The runtime model is `pydantic.create_model` from {7 built-ins always-on + immutable} + {enabled own+global custom fields} + the `_confidence` field → fed to `forced_emit(schema_model=...)`. Audit **`metadata.field.create`** (already pre-seated in the 110 enum) with a **live INSERT+SELECT** verification.

- **D-111-6 — The ingest-time field-definition read MUST be EXPLICITLY user-scoped (110 SECURITY lesson).** `ingest_document` runs in a BackgroundTask with no request JWT → `auth.uid()` is NULL and a service-role client BYPASSES RLS. Read enabled definitions with an explicit `.eq("user_id", doc_owner_uid).or_("is_global.eq.true")` (doc owner = the `ingest_document` `user_id` param, `documents.py:1337`) — never rely on RLS here (over-returns under service role, under-returns otherwise).

### Local models + graceful degradation

- **D-111-7 — Local models (LM Studio / Ollama): route via `openai_compat` → TIER-COERCE; add a first-class local provider.** The dispatcher else-branch sends every non-anthropic/google provider to `open_openai_compat_stream` (`dispatcher.py:117-127`); a local model id misses `MODEL_CAPABILITIES` → inferred defaults (`forced_emission=False`, `strict_json_schema=False`, `native_tools=False`) → **TIER-COERCE STRUCTURED** (schema prompt-injected + narration recovery + Pydantic hard-validation; a non-validating result is an honest `model_failed_to_emit`, never prose-as-artifact).
  - **Gap to close:** there is NO first-class LM Studio provider today — local routing works only via **Ollama-impersonation** (`LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL=http://localhost:1234` → config appends `/v1`, keyless). Operator explicitly wants **LM Studio** to work. **Add a clean named local/OpenAI-compat provider** (e.g. `lmstudio` or generic `local-openai`) to `config._PROVIDER_BASE_URLS` + key map (allow empty/dummy key like ollama, configurable base_url env) so impersonation isn't required. Shared chunk/SSE path needs no change (gateway adapter already handles arbitrary base_url).
  - **Researcher to evaluate:** for local models, prefer **grammar-constrained `response_format` json_schema** (LM Studio supports it; the gateway forwards a `strict_response_format` seam, `openai_compat.py:381-409`) — grammar guarantees ~100% *syntactic* validity at the token level, so JSON-parse retries are unnecessary. COERCE + bounded validate-retry (≤2) + graceful degradation remain the **semantic** safety net (enum/range/0–1 confidence calibration, grounding) — grammar guarantees shape, not correctness. (Ollama's OpenAI-compat `response_format` is historically flaky, #10001 — if supporting Ollama, branch to its native `format` param at the service boundary.)
  - **6 GB VRAM test target (RTX 4050 laptop, LM Studio, Q4_K_M):** ship/test against **Qwen2.5-7B-Instruct Q4_K_M** (~4.7 GB; strongest JSON-following that still fits with modest 4–8k context). Fallback: Qwen2.5-3B-Instruct or Phi-3.5-mini-instruct (lots of headroom). **Floor = 3B** (sub-3B emits grammar-valid JSON but unreliable *values*/confidence). Avoid Llama-3.1-8B at 6 GB (KV-cache pushes past VRAM). Temperature 0/low for determinism.

- **D-111-8 — Graceful degradation invariant: a failing/garbage model NEVER breaks ingestion.** Preserve BOTH safety layers: `extract_metadata`'s own `except Exception → return None` (`embedding_service.py:111-137`) AND `ingest_document`'s outer `try/except` backstop (`documents.py:1360,1484`). A failing enrichment field degrades to null/low-confidence; the document still reaches `status=completed` with core metadata intact-or-null. Wrap any new per-field/confidence LLM sub-calls in the same swallow-to-None/skip pattern. **Verify LIVE** with a deliberately-raising/garbage-emitting model (static def-shape tests false-green this — the 104 lesson).

### Re-extraction + UAT

- **D-111-10 — Forward-only; existing docs re-enrich via opt-in `/reextract`, never auto-bulk.** Confirm `/reextract` routes through `ingest_document` (the `documents.py:1478` comment claims `/upload`, `/reingest`, `/reextract` converge there) so the new enrichment + `_confidence` + custom fields actually apply on re-extract — **verify at plan time** it's not a separate metadata-only path.

- **D-111-11 — SC#4 VALIDATION (4-axis, live not mocked).** Author rows in `VALIDATION.md`: (a) cross-provider dynamic-schema extraction across the native-7 — acceptance = **"pass OR documented limitation per provider"** (DeepSeek/Gemini forced-emit + MiniMax tool-args are known traps — see reported-bug routing; COERCE/degradation is the net); (b) a **local-model (LM Studio, Qwen2.5-7B)** extraction row; (c) a **long-doc (≥ 5 KB)** window-lift sampling row; (d) a **deliberately-failing-model graceful-degradation** row (doc still completes). Plus the live `metadata.field.create` audit INSERT+SELECT (D-111-5).

### Claude's Discretion
- Exact `app_settings` column set in migration 072 (`extraction_model`, the window-cap field, `metadata_enrichment_mode`) — may be one migration or split; recommend one `072_*.sql`.
- Retry cap number for the COERCE semantic-validate loop (recommend ≤ 2; grammar already guarantees parseability).
- Exact local-provider key name (`lmstudio` vs generic `local-openai`) + env var name.
- `metadata_enrichment_mode` as enum vs boolean; the precise field-type vocabulary (whether to include `boolean`/`integer`).
- Exact router method shapes + uniqueness rule (recommend `field_key` unique per user).
- The system-prompt wording for the extraction emit (instructions + few-shot for confidence calibration).

### Folded Todos
None — `gsd-sdk todo.match-phase 111` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 111: Metadata Enrichment — Extraction Backend" — the 4 success criteria (verbatim acceptance bar).
- `.planning/REQUIREMENTS.md` — META-01 (define custom fields), META-03 (un-pin model), META-04 (window lift); the deferred/out-of-scope tables.

### Architecture / research (HIGH confidence, file:line-cited)
- `.planning/research/v3.0-document-management/ARCHITECTURE.md` §4 "Configurable metadata + per-field confidence" — the three coordinated changes (un-pin model / lift window / dynamic schema), the `_confidence` flat-key rule, the `@>` containment compatibility, the BackgroundTask scoping caveat. **The enrichment design source.**
- `.planning/research/v3.0-document-management/PITFALLS.md` — Pitfall 5 (classification bounded by metadata; `exclude_none` non-regression; suggest-not-move), Pitfall 4 (don't lowercase typed values; typed columns are 113/114's job), Pitfall 2 (audit enum), Pitfall 7 (`org_id` forward-compat).
- `.planning/research/v3.0-document-management/SUMMARY.md` + `STACK.md` — near-zero new deps; `documents_metadata_gin_idx` already exists.
- `.planning/phases/110-dm-foundations/110-CONTEXT.md` — D-110-2 (enrichment NOT behind the master flag; its own knob), D-110-1 (the 8 audit types incl. `metadata.field.create`/`metadata.update`), the `metadata_field_definitions` shape (D-110-3).

### Code seams (verified file:line — `verify-111-context` workflow, 2026-06-15)
**forced_emit engine (D-111-1):**
- `backend/app/services/forced_emit.py:205-215` — async signature: `schema_model: type[BaseModel]|None`, `strict: bool|None`.
- `forced_emit.py:140-154` — `_validate_args`: `_model = schema_model or EmitFieldMap` → validates the PASSED model.
- `forced_emit.py:245-249` — default-SAFE tier routing (registry miss → TIER-COERCE).
- `forced_emit.py:247-248` — `strict=False` override (Phase 103 additive) for optional-heavy schemas.
- `forced_emit.py:286,309` — `tools` forwarded verbatim; `emitter` is just the tool NAME (forced_emit owns no tool).
- `forced_emit.py:294-314,346-364` — COERCE branch (schema inline + narration recovery + hard-validate; honest fail).
- `backend/app/services/harness/phase_types.py:860-880` — `_emit_forced_tool` is `EmitFieldMap`-shaped — **the coupling lives HERE; do NOT reuse for metadata**.
- `backend/app/services/workflow_authoring.py:127-145,398-414,434-449,83-105` — PRECEDENT: custom `schema_model` + own tool + None-check honest-fail; `resolve_authoring_model`; the `UserEffectiveSettings.active_provider` live-fix.
- `backend/app/services/harness/publish_service.py:688-718` + `validator_kinds.py:452-470` — PRECEDENT: judge builds `judge_tool` from `JudgeVerdict.model_json_schema()`.

**Extraction + ingestion seam (D-111-1/3/4/8/9):**
- `backend/app/services/embedding_service.py:100-137` — `extract_metadata` (model=None already accepted; `content[:3000]` hardcoded at :107; OpenAI `json_object` at :130; try/except→None at :134).
- `backend/app/services/openai_service.py:970-984` — `get_llm_client` with no `user_settings` → provider hardwired `openai` + env creds (today's default route).
- `backend/app/api/documents.py:136-252` — `_upload_pipeline` (sync BackgroundTask; `asyncio.run` precedent at :218; scheduled as sync callable at :497).
- `documents.py:1334-1338` — `ingest_document` is SYNC; has `user_id` + `supabase` client in scope.
- `documents.py:1368-1375` — `extract_metadata(text)` call + `model_dump(exclude_none=True)` + None-guarded case-normalize.
- `documents.py:1403,1405` — `load_app_settings()` (sync, must hoist) + the `embed_chunks(model=...)` threading pattern to mirror.
- `documents.py:1467-1482` — persist site (`documents.metadata = metadata_dict`, may be None).
- `documents.py:1360,1484` — outer try/except backstop (never break ingestion).

**Settings seam (D-111-2):**
- `backend/app/models/user_settings.py:511` — sync `load_app_settings()`; `:437-506` `_build_settings_from_row` (add field); `:216-259` `save_app_settings`; `:306-318` `_val` helper.
- `backend/app/config.py:703` — env `llm_model` default gpt-4o; `:962` `harness_judge_model` precedent (DB-only `str|None`).
- `supabase/migrations/045_app_settings_extraction_aspects.sql` — the `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS … text` idiom; next migration = **072**.
- `backend/app/api/settings.py:189-287` — `update_settings` (extraction_* engine cols are DB-only, no UI — the pattern to follow).

**Custom-field defs (D-111-5/6):**
- `supabase/migrations/071_dm_foundations.sql:89-104` — `metadata_field_definitions` DDL (`field_type text` free text, no CHECK; only `mfd_reachable`); `:163-172` RLS (own+global read, own-only write, `is_global=false` forced on INSERT).
- `backend/app/models/document.py:8-15` — the static 7-field `DocumentMetadata` (built-ins to keep always-on).
- `backend/app/services/audit_service.py:13-54` — `VALID_ACTION_TYPES` (`metadata.field.create` present) + boot/CI drift guard.

**Local-model path (D-111-7):**
- `backend/app/services/provider_gateway/dispatcher.py:117-127` — else-branch → `open_openai_compat_stream` for ollama/local.
- `backend/app/services/provider_gateway/openai_compat.py:381-409` — forwards `force_tool_name` + `strict_response_format` (the grammar-constrained json_schema seam).
- `backend/app/config.py:351-363,382-384,422-476` — inference patterns; `ollama` excluded from `_NATIVE_TOOL_PROVIDERS`; `_build_inferred_defaults` never sets `forced_emission`/`strict_json_schema`.
- `backend/app/config.py:10-20,691,739,750-751` + `backend/.env.example:103-104` — `ollama` provider base-url resolution (`/v1` append), keyless.

**Search non-regression (D-111-9):**
- `supabase/full-schema.sql:108,132` — `d.metadata @> metadata_filter` partial containment.
- `backend/app/services/retrieval_service.py:256-258` — flat lowercased `metadata_filter` build (confirms flat-filter assumption).

### Provider docs (D-111-7, evidence-based per CLAUDE.md provider-docs-first)
- LM Studio structured output (`response_format` json_schema, grammar-constrained): https://lmstudio.ai/docs/developer/openai-compat/structured-output ; tools: https://lmstudio.ai/docs/developer/openai-compat/tools
- Ollama structured outputs (native `format` param) + the OpenAI-compat `response_format` caveat (#10001): https://docs.ollama.com/capabilities/structured-outputs ; https://github.com/ollama/ollama/issues/10001

### Reported-bug routing (open, NOT folded — awareness only)
- `.planning/reported-bugs/BUG-260615-01-pm-pack-seed-and-provider-forcing-findings.md` — finding (3): DeepSeek `deepseek-v4-pro` + Google `gemini-2.5-pro` **honest-fail the FORCED structured emit** (narrate/truncate). Directly relevant — 111's extraction is forced_emit-based. **Disposition: leave open; 111 does NOT own the fix (pairs with SEED-082).** 111's SC#4 = pass-OR-documented per provider; COERCE + degradation is the net.
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` (BUG-260607-03) — MiniMax-M3 malformed tool-call args JSON → 400. Same disposition (already the 101 D-15 precedent: cover+document, leave open).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`forced_emit` (`forced_emit.py:205`)** — the cross-provider structured-output engine; accepts a runtime `schema_model` + caller-owned tool + `strict` override. Reuse wholesale (D-111-1). Two live precedents (workflow_authoring, judge).
- **`load_user_settings(user_id)` + `resolve_authoring_model`/`resolve_judge_model`** — the model+settings resolution pattern to mirror for `extraction_model`.
- **`load_app_settings()` (sync, `user_settings.py:511`)** — already used in `ingest_document`; the home for the `extraction_model` read.
- **`asyncio.run(...)` inside the sync BackgroundTask (`documents.py:218`)** — the established sync→async bridge to reuse for the async extraction call.
- **`extract_metadata`'s try/except→None + `ingest_document`'s outer try/except** — the two-layer graceful-degradation backstop to preserve.
- **`pydantic.create_model`** — for the runtime metadata schema (no existing precedent in-repo, but `forced_emit`'s `schema_model` accepts any `BaseModel` subclass).

### Established Patterns / constraints
- `documents.metadata` is a single JSONB column with `documents_metadata_gin_idx` + `@>` partial-containment pre-filter; keep filterable fields FLAT, confine confidence to nested `_confidence`. No migration on this column.
- DB-only `app_settings` engine columns (`extraction_*`, `harness_judge_model`) are set by admins via SQL/`save_app_settings`, not the Settings UI — the zero-UI precedent for `extraction_model`.
- BackgroundTasks have no `auth.uid()` → all new table reads must be explicitly `user_id`-scoped in app code (the 110 SECURITY lesson).
- Local providers ride `openai_compat` with arbitrary base_url; capability-misses degrade to TIER-COERCE by construction.

### Integration Points
- `embedding_service.extract_metadata` — the function to re-platform (new async sibling recommended; keep the old sync fn for the `legacy` reversibility mode).
- `documents.py:1368` ingest call site — thread the resolved model + invoke the async extractor via `asyncio.run`.
- `backend/app/api/metadata_fields.py` (NEW) — the custom-field CRUD router; mount in `main.py`.
- `app_settings` (migration 072) — `extraction_model` + window-cap + `metadata_enrichment_mode`.
- `config._PROVIDER_BASE_URLS` / key map — the first-class local/LM-Studio provider registration.
- `audit_service` `metadata.field.create` — live INSERT+SELECT verification.

</code_context>

<specifics>
## Specific Ideas

- Operator: *"guarantee that anything will work and it is up to the business or production to decide"* — the engine must be model-agnostic; the COERCE tier + bounded validate-retry + graceful degradation are the guarantee, not a fixed provider.
- Operator: *cost is not a constraint as long as quality holds* — window cap is quality-first; only bounded by the chosen model's context window.
- Operator hardware for the local-model proof: **LM Studio, RTX 4050 laptop, 6 GB VRAM.** Recommended test model: **Qwen2.5-7B-Instruct Q4_K_M** (fits with modest context); floor 3B; first-class LM Studio provider to be added (no Ollama-impersonation).
- The most important verification gate (per the D-102 / 104 lesson): the cross-provider + local + failing-model rows are driven **LIVE**, not mocked — static def-shape tests false-green forced-structured-output and audit-enum failures.

</specifics>

<deferred>
## Deferred Ideas

- **Per-user `extraction_model` override** — 111 ships admin-global only; a per-user override is a trivial additive follow-on.
- **A Settings-UI control for `extraction_model` / window cap** — DB-only in 111 (mirrors `extraction_*`); add `SettingsUpdate` field + one mapping line later if a UI knob is wanted.
- **Provider-side forced-structured-output reliability fixes** (DeepSeek/Gemini narrate-instead-of-force; MiniMax malformed tool-args) → SEED-082 / a provider-feature-fit-routing phase. 111 documents per-provider limitations, doesn't fix them.
- **Promoting hot metadata fields to typed/indexed columns** for range/date queries → Phase 113/114 (views). 111 keeps metadata in JSONB; no typed-column promotion.
- **The field-management UI + per-field-confidence DISPLAY + manual edit** → Phase 112 (META-02, META-05).
- **`metadata.update` audit** (manual edit) → Phase 112; 111 only emits `metadata.field.create`.

### Reviewed Todos (not folded)
None — `todo.match-phase 111` returned 0.

</deferred>

---

*Phase: 111-metadata-enrichment-extraction-backend*
*Context gathered: 2026-06-15*
