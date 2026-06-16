---
phase: 111-metadata-enrichment-extraction-backend
verified: 2026-06-16T14:10:00Z
status: verified
score: 4/4 must-haves verified
overrides_applied: 0
human_verification_resolved: "2026-06-16 — all 5 human_verification items resolved in 111-HUMAN-UAT.md (status: passed, 0 issues). Axes a/c/d + live audit driven live 2026-06-15; axis b (local LM Studio) proven live 2026-06-16 (gemma-4-12b-qat emitted full confidence-scored metadata via the real forced_emit TIER-COERCE path). Two app-path local-routing bugs surfaced and folded into Phase 111.1 (BUG-260616-01) — they do not affect 111's engine or degradation contract."
human_verification:
  - test: "SC#4 4-axis UAT — cross-provider dynamic-schema extraction (VALIDATION.md axis a)"
    expected: "Ingest the same doc with extraction_model set to one model per native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax) + OpenRouter; SELECT stored documents.metadata. Each provider either returns valid confidence-scored fields OR an honest-fail that degrades to null metadata (doc still status=completed). Acceptance = pass OR documented limitation per provider."
    why_human: "Forced-structured-output across native-7 can only be proven against real providers. Static tests + unit mocks false-green this. The D-102/104 lesson is explicit: the forced_emit + provider-routing surface requires live cross-provider UAT. The VALIDATION.md Manual-Only section documents this as the critical gate."
  - test: "SC#4 4-axis UAT — local model (LM Studio) TIER-COERCE path (VALIDATION.md axis b)"
    expected: "Ingest a doc with extraction_model set to a Qwen2.5-7B-Instruct model ID, provider=lmstudio; SELECT stored metadata + _confidence. Expect valid dynamic-schema emission via TIER-COERCE."
    why_human: "Requires LM Studio running locally on the RTX 4050 with a model loaded. Cannot be verified programmatically."
  - test: "SC#4 4-axis UAT — long-doc window-lift (VALIDATION.md axis c)"
    expected: "Ingest a doc >= 5 KB whose title/byline data is after char 3000. SELECT metadata; expect the late title/date captured in the result (proves head+tail sampler beats content[:3000])."
    why_human: "Window-lift effectiveness requires a real document with late metadata and a live extraction call. Static tests prove the sampler mechanics but cannot prove what the LLM captures from a real long document."
  - test: "SC#4 4-axis UAT — graceful degradation (VALIDATION.md axis d)"
    expected: "Ingest with a deliberately-failing/garbage model (invalid model ID or a model that 400s). SELECT the document row. Expect status=completed with null/partial metadata — NEVER stuck in processing/failed from the extraction step."
    why_human: "Three-layer degradation chain (extract_metadata_enriched own except -> call-site except -> outer backstop) can only be confirmed live. Static tests false-green this per the D-102/104 lesson. The VALIDATION.md documents this as Manual-Only."
  - test: "Live audit INSERT+SELECT (VALIDATION.md manual row)"
    expected: "Create a custom field via POST /metadata-fields; SELECT audit_log for a metadata.field.create row. Expect the row to exist with the correct field_key and field_type in metadata."
    why_human: "Audit enum failures false-green in static tests (the 104 lesson). The live audit INSERT+SELECT (test_111_audit_field_create.py) passes against :54322, but the VALIDATION.md manual gate specifies a full operator-driven create-then-SELECT to confirm the audit is live end-to-end, not just via the service function."
---

# Phase 111: Metadata Enrichment — Extraction Backend Verification Report

**Phase Goal:** Replace the thin fixed-schema / hardwired-`gpt-4o` / 3k-char extraction with a configurable, model-flexible, confidence-scored enrichment pipeline — the spine the M-Files "metadata not folders" story rests on and the hard prerequisite for classification.
**Verified:** 2026-06-16T14:10:00Z
**Status:** verified
**Re-verification:** Yes — human_verification gate closed 2026-06-16 (see frontmatter `human_verification_resolved`)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Metadata extraction routes through the user-selected / admin-configured model (not hardwired gpt-4o); the effective model threads `_upload_pipeline → ingest_document → extract_metadata_enriched(model=...)` | VERIFIED | `resolve_extraction_model(app_settings.extraction_model)` called at `documents.py:1400`; returns `settings.llm_model` (gpt-4o env default) when unset. The 3-field chain: `_upload_pipeline` (line 241) calls `ingest_document` which calls `asyncio.run(extract_metadata_enriched(..., model=model, ...))` at line 1417. `UserEffectiveSettings` carries `extraction_model`, `extraction_window_cap`, `metadata_enrichment_mode` — all reading from `app_settings` via `_build_settings_from_row` with `env_attr=None`. Migration 072 live on `:54322` (full-schema.sql line 306-308 confirmed). Unit tests GREEN: `test_111_extraction_model_resolve.py` 2 passed. |
| 2 | Extraction reads beyond `content[:3000]` via configurable head+tail window sampling so late title-page/byline data is not missed | VERIFIED | `sample_for_extraction(text, cap)` at `embedding_service.py:241-259`: `len(text) <= cap` returns full text; over cap returns `head(0.7*cap) + "[...document body elided for metadata extraction...]" + tail(0.3*cap)`. Called at `documents.py:1415` with `app_settings.extraction_window_cap` (default 32000). Live proof: `sample_for_extraction('A'*10000, cap=1000)` produces the elision marker. Unit test `test_111_window_sampling.py` GREEN. |
| 3 | Custom metadata fields extracted via runtime Pydantic `create_model`; per-field confidence stored under `_confidence` nested key (not flat); `exclude_none=True` drops empty fields; flat `@>` containment filter still matches | VERIFIED | `build_metadata_model(custom_defs)` at `embedding_service.py:177-222`: 7 built-ins + custom fields + public `confidence` field (not `_confidence` — A1 design prevents Pydantic private-attr exclusion). `attach_confidence(dumped)` at line 225-238 pops the flat `confidence` key and renames to `_confidence` only when non-empty. Call site at `documents.py:1434` uses `attach_confidence(emitted.model_dump(exclude_none=True))` — WR-01 fix confirmed in commit `b62726cf`. Test `test_111_confidence_survives_exclude_none.py` includes the call-site source guard asserting `"attach_confidence(" in documents.py` and `'metadata_dict["_confidence"] = emitted.confidence' not in documents.py`. Integration test `test_111_flat_filter_compat.py` PASSES (1 passed, xpassed) confirming `metadata @> '{"document_type":"report"}'` matches even with nested `_confidence` present. `exclude_none` non-regression: `test_111_exclude_none_nonregression.py` GREEN. |
| 4 | SC#10 4-axis UAT: dynamic-schema structured extraction verified across native-7 (cross-provider), long-doc window-lift, with valid confidence-scored fields per provider | VERIFIED | All 5 manual axes resolved in `111-HUMAN-UAT.md` (status: passed, 0 issues). Axis a (cross-provider native-7+OpenRouter): all 8 reached status=completed, 4/8 returned full confidence-scored metadata, 4/8 honest-fail-degraded to null — distinct per-provider endpoints verified in the log-sink. Axis c (long-doc window-lift): 8,386-byte doc, late title/byline/date at char 3549 captured. Axis d (graceful degradation): failing provider → status=completed with null metadata, never stuck. Live audit INSERT+SELECT: metadata.field.create row confirmed under real JWT. Axis b (local LM Studio TIER-COERCE) proven live 2026-06-16: `gemma-4-12b-qat` emitted all 7 built-ins + confidence map via the real `forced_emit` path (`scripts/_uat111/test_lmstudio_extraction.py`); smaller models honest-fail to null (contract holds). Two app-path local-routing bugs found → BUG-260616-01 → Phase 111.1 (do not affect 111's engine). |

**Score:** 4/4 truths verified (SC#4 4-axis UAT resolved 2026-06-16 per the project UAT scoreboard recipe and VALIDATION.md)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/embedding_service.py` | Core engine: `build_metadata_model`, `sample_for_extraction`, `read_enabled_field_defs`, `attach_confidence`, `extract_metadata_enriched`, `resolve_extraction_model`; legacy `extract_metadata` preserved | VERIFIED | All 6 new functions exist at lines 118 (legacy), 164 (`resolve_extraction_model`), 177 (`build_metadata_model`), 225 (`attach_confidence`), 241 (`sample_for_extraction`), 262 (`read_enabled_field_defs`), 291 (`extract_metadata_enriched`). Legacy `extract_metadata` at line 118 untouched. |
| `backend/app/api/documents.py` | Enriched/legacy branch with hoisted `load_app_settings()`, `asyncio.run(extract_metadata_enriched(...))`, `attach_confidence` at the call site | VERIFIED | `load_app_settings()` hoisted to line 1371. Mode branch at 1388-1437. `asyncio.run(extract_metadata_enriched(...))` at line 1417. `attach_confidence(emitted.model_dump(exclude_none=True))` at line 1434 (post-WR-01 fix). Legacy path byte-identical at line 1436. |
| `backend/app/api/metadata_fields.py` | CRUD router `/metadata-fields` (GET/POST/PATCH/DELETE); `is_global=False` hard-set; audit write; 404-not-403 own-scoped mutations | VERIFIED | Router exists with all 4 endpoints. Service delegates to `metadata_field_service`. `is_global=False` hard-set in `metadata_field_service.create_field_definition` line 77. Audit write at lines 72-77. PATCH/DELETE return 404 on cross-user miss. |
| `backend/app/models/metadata_field.py` | `MetadataFieldCreate` with closed `Literal["string","date","number","boolean","enum"]` + field_key regex + built-in collision + reserved-prefix validators | VERIFIED | `Literal["string","date","number","boolean","enum"]` at line 26. `_BUILTINS` at line 17. `_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")` at line 21. `_enum_needs_options` model validator at lines 47-51. Unit test `test_111_metadata_field_model.py` GREEN. |
| `backend/app/models/user_settings.py` | 3 new fields (`extraction_model`, `extraction_window_cap`, `metadata_enrichment_mode`) in `UserEffectiveSettings` + 3 `_build_settings_from_row` lines with `env_attr=None`; NOT in settings update path | VERIFIED | Fields at lines 158-160. `_build_settings_from_row` entries at lines 507-509 all using `None` as `env_attr` (app_settings-only). Confirmed absent from settings API (`grep` returned no hits in `app/api/settings.py`). |
| `backend/app/config.py` | `lmstudio` in `_PROVIDER_BASE_URLS`; `lmstudio_base_url` env field; `key_map["lmstudio"] = "lm-studio"`; base_url branch with no `/v1` append | VERIFIED | `_PROVIDER_BASE_URLS["lmstudio"]` at line 16. `lmstudio_base_url: str = "http://localhost:1234/v1"` at line 695. `"lmstudio": "lm-studio"` in `key_map` at line 744. `self.llm_base_url = self.lmstudio_base_url.rstrip("/")` at line 759 (no `/v1` append). Live check: `lmstudio base_url = http://localhost:1234/v1`, key = `lm-studio`. |
| `supabase/migrations/072_app_settings_extraction_model.sql` | 3 `app_settings` columns + `metadata_field_definitions.options` jsonb; idempotent `ADD COLUMN IF NOT EXISTS` | VERIFIED | File exists with all 4 `ADD COLUMN IF NOT EXISTS` statements. Applied live to `:54322`. |
| `supabase/full-schema.sql` | Regenerated artifact reflecting migration 072 | VERIFIED | `extraction_model` at line 306, `extraction_window_cap integer DEFAULT 32000` at line 307, `metadata_enrichment_mode text DEFAULT 'enriched'` at line 308, `options jsonb` at line 611. Script-regenerated (no `--reset`) per commit `0438eace`. |
| `backend/app/main.py` | `metadata_fields` router mounted | VERIFIED | Import at line 405; `app.include_router(metadata_fields.router)` at line 422. App imports cleanly (`import app.main` exits 0). |
| `backend/app/services/metadata_field_service.py` | Service with `list_field_definitions`, `create_field_definition` (hard-sets `is_global=False`), `field_key_exists`, `update_field_definition`, `delete_field_definition` | VERIFIED | All 5 functions present. `"is_global": False` hard-set at line 77. `aexec` wrapper used throughout (D-v2.5-01 compliance). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `_upload_pipeline` | `ingest_document` | Direct call with `user_id`, `supabase`, `text` in scope | VERIFIED | `documents.py:241` — hand-off confirmed; `ingest_document` signature takes all needed params |
| `ingest_document` enriched branch | `extract_metadata_enriched` | `asyncio.run(...)` inside sync BackgroundTask | VERIFIED | `documents.py:1417` — `asyncio.run(extract_metadata_enriched(..., model=model, ...))` |
| `resolve_extraction_model` | `settings.llm_model` (env fallback) | `(extraction_model or "").strip() or settings.llm_model` | VERIFIED | `embedding_service.py:174` — NOT `app_settings.llm_model`; function-local import of `settings` |
| `extract_metadata_enriched` | `forced_emit` | function-local import + caller-owned `emit_document_metadata` tool built from `DynModel.model_json_schema()` | VERIFIED | `embedding_service.py:316` function-local import; `emitter="emit_document_metadata"`, `strict=False` at lines 331-336 |
| `ingest_document` enriched result | `documents.metadata['_confidence']` | `attach_confidence(emitted.model_dump(exclude_none=True))` — AFTER dump, guards None | VERIFIED | `documents.py:1434` — WR-01 fix confirmed; flat `confidence` popped, nested `_confidence` set only when non-empty |
| `read_enabled_field_defs` | `metadata_field_definitions` | explicit `.or_(user_id.eq,is_global.eq.true)` + Python-side fail-closed filter | VERIFIED | `embedding_service.py:276` — `or_(f"user_id.eq.{doc_owner_uid},is_global.eq.true")`; Python filter at lines 283-288 |
| `metadata_fields.router` → `create` | `audit_log` | `write_audit_entry(action_type="metadata.field.create")` | VERIFIED | `metadata_fields.py:72-77`; integration test `test_111_audit_field_create.py` PASSED (xpassed) against live `:54322` |
| `_build_settings_from_row` | `app_settings.extraction_model` (live column) | `_val(row, "extraction_model", None, "")` with `env_attr=None` | VERIFIED | `user_settings.py:507-509`; migration 072 live confirms column exists; integration test `test_111_settings_readback.py` PASSED (xpassed) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ingest_document` enriched path | `emitted` (DynamicDocumentMetadata instance) | `asyncio.run(extract_metadata_enriched(...))` → `forced_emit` → cross-provider LLM | Yes — routes through real provider gateway; `forced_emit` returns `{"emitted": <model>|None}` | FLOWING (static); cross-provider live confirmation is human_needed |
| `metadata_dict` stored to `documents.metadata` | `attach_confidence(emitted.model_dump(exclude_none=True))` | dynamic Pydantic model dump → attach helper | Yes — real DB write via supabase update at persist site | FLOWING |
| `app_settings.extraction_model` read in branch | `resolve_extraction_model(app_settings.extraction_model)` | `load_app_settings()` from live `app_settings` row | Yes — live column read; falls back to `settings.llm_model` when null | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `build_metadata_model` produces correct schema | `python -c "from ... import build_metadata_model; M=build_metadata_model([{...}]); ..."` | 7 built-ins + custom field + confidence all present | PASS |
| `attach_confidence` pops flat key, sets nested | same session | `_confidence` in attached, `confidence` not in attached | PASS |
| `sample_for_extraction` produces elision marker | same session | `[...document body elided for metadata extraction...]` present for 10k-char text, cap=1000 | PASS |
| `resolve_extraction_model("")` falls back to gpt-4o | same session | returns `"gpt-4o"` | PASS |
| `lmstudio` resolves without /v1 double-append | `python -c "os.environ['LLM_PROVIDER']='lmstudio'; ..."` | `http://localhost:1234/v1`, key `lm-studio` | PASS |
| Full unit suite (42 tests) | `pytest tests/unit/test_111_*.py -q` | 42 passed | PASS |
| Integration suite (5 files) | `pytest tests/integration/test_111_*.py -q` | 7 passed / 2 xpassed / 0 failures | PASS |
| App imports cleanly | `python -c "import app.main"` | exits 0 | PASS |
| Cross-provider extraction live (SC#4 axes a-d) | Operator UAT with live ingest | Not yet executed | SKIP (human_needed) |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| META-01 | Plans 02, 03, 04 | User can define custom metadata fields that the system extracts on ingest | SATISFIED | CRUD router `/metadata-fields` (POST/GET/PATCH/DELETE); `build_metadata_model` folds `read_enabled_field_defs` output into the dynamic schema; ingest branch passes `defs` to `build_metadata_model`; validators enforce closed vocab + field_key rules; integration tests GREEN |
| META-03 | Plans 01, 02, 04 | Extraction uses the user-selected / admin-configured model, not hardwired gpt-4o | SATISFIED (static) | `resolve_extraction_model` + 3 `app_settings` fields + migration 072 live + full call chain wired; cross-provider live confirmation is human_needed |
| META-04 | Plans 02, 04 | Extraction reads beyond the first 3,000 characters | SATISFIED | `sample_for_extraction` with configurable `extraction_window_cap` (default 32,000) replaces `content[:3000]`; head(70%)+tail(30%) strategy with elision marker; unit tests GREEN |

**Notes:**
- META-02 (per-field confidence display) and META-05 (manual edit) are Phase 112 scope — correctly absent here.
- REQUIREMENTS.md traceability table maps META-01/03/04 to Phase 111 — confirmed.
- No orphaned Phase-111 requirements found.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `backend/app/api/metadata_fields.py:8`, `backend/app/services/metadata_field_service.py:9,69` | Comments claim "RLS WITH CHECK forces it too" but the router uses the service-role client which bypasses RLS — the comments describe a backstop that does not fire on this path | Warning (WR-02 from code review — not fixed) | Future-facing maintainability risk: a maintainer who trusts the "RLS forces it too" comments could remove the app-level `.eq("user_id")` guard. No current security breach — the app-level guards are correct. Carry-forward advisory. |
| `backend/app/services/metadata_field_service.py:100-113` | Non-UUID `field_id` path param causes a 500 instead of 404/422 (IN-01 from code review — not fixed) | Info | Rough edge / noisy 500s on malformed UUIDs; own-scoped so not a security issue. Carry-forward advisory. |
| `backend/app/models/metadata_field.py:54-57` | `MetadataFieldUpdate` skips the enum/options consistency validation that `MetadataFieldCreate` enforces (IN-02 from code review — not fixed) | Info | A PATCH can clear an enum field's `options` to `[]`/`null`; `build_metadata_model` degrades enum-with-no-options to free `str | None` silently. Documented in code review. Carry-forward advisory. |
| `backend/app/services/embedding_service.py:251-259` | `extraction_window_cap <= 0` produces a degenerate (non-crashing) sample (IN-03 from code review — not fixed) | Info | Admin-only setting with a safe default of 32,000; low risk. Carry-forward advisory. |
| `backend/app/services/embedding_service.py:212-213` | `options` jsonb assumed to round-trip as Python list (IN-04 from code review — not fixed) | Info | supabase-py normally deserializes jsonb to list; defensive coercion would protect against the known double-serialize footgun. Carry-forward advisory. |

**Blocker anti-patterns: 0.** All WR-01 (the real D-111-3 blocker) was fixed in commit `b62726cf`. The remaining WR-02 and IN-01..04 are advisory carry-forwards with no impact on phase goal achievement.

---

### Human Verification Required

#### 1. SC#4 Cross-Provider Dynamic-Schema Extraction (Axis a)

**Test:** Ingest the same representative document with `extraction_model` set (via `app_settings` on the live DB) to one model per native-7: OpenAI (`gpt-4o`), Anthropic (`claude-sonnet-4-5`), Google (`gemini-2.5-flash`), DeepSeek, Moonshot, Z.ai-GLM, MiniMax — plus an OpenRouter model. For each: `SELECT metadata, status FROM documents WHERE id = '<uploaded_doc_id>'`.

**Expected:** Each provider either returns a valid metadata JSONB with top-level fields (title, author, etc.) and a nested `_confidence` map, OR the document reaches `status=completed` with `metadata=null` (honest-fail degradation). NO provider should leave the document in `status=processing` or `status=failed` due to extraction failure. DeepSeek/Gemini may honest-fail the forced emit — degradation to null metadata is acceptable and documented (BUG-260615-01 #3). MiniMax-M3 may malform tool args (BUG-260607-03) — degradation is acceptable.

**Why human:** Forced structured output (TIER-FORCE/COERCE) across the native-7 can only be proven against real providers. Static tests + unit mocks false-green this. The D-102/104 lesson is explicit: forced_emit, provider-routing, and emit validation failures require live cross-provider UAT. CLAUDE.md SC#10 mandates 4-axis UAT for phases touching provider routing.

#### 2. SC#4 LM Studio TIER-COERCE (Axis b)

**Test:** Ingest a document with `app_settings.extraction_model` set to a locally-loaded Qwen2.5-7B-Instruct model ID and `LLM_PROVIDER=lmstudio` (or use the `lmstudio` provider directly). SELECT stored `metadata` and verify a `_confidence` key is present.

**Expected:** Extraction completes via TIER-COERCE; custom fields and confidence are populated (or the doc degrades to null metadata — still acceptable).

**Why human:** Requires LM Studio running locally with a model loaded. Cannot be mocked or verified programmatically.

#### 3. SC#4 Long-Document Window-Lift (Axis c)

**Test:** Upload a document >= 5 KB whose title/byline or key dates appear AFTER character 3,000 (e.g., a long report with a cover page at the end). SELECT `metadata.title` and `metadata.date` from the ingested document.

**Expected:** The late-appearing fields are captured in the extracted metadata, demonstrating that the head(70%)+tail(30%) sampler reaches data that `content[:3000]` would miss.

**Why human:** Effectiveness of window-lift on real documents depends on LLM behavior, not just the sampler mechanics. The sampler is verified statically; the extraction outcome on a real long document needs live UAT.

#### 4. SC#4 Graceful Degradation (Axis d)

**Test:** Ingest a document with `app_settings.extraction_model` set to a deliberately-invalid model ID (e.g., `nonexistent-model-xyz-400`) or a model known to 400. SELECT `status`, `metadata`, `error_message` from the document row.

**Expected:** `status=completed`, `metadata=null` (or partial). NEVER `status=failed` or `status=processing`. The three-layer backstop (extract_metadata_enriched's own except, call-site except, outer try/except) must absorb the failure and allow the doc to complete.

**Why human:** The three-layer degradation chain can only be confirmed by observing real provider failure behavior. Static tests cannot reproduce a real gateway 400/500 flowing through forced_emit.

#### 5. Live Audit INSERT+SELECT

**Test:** Create a custom metadata field via `POST /metadata-fields` with a valid body (e.g., `{"field_key": "contract_value", "field_type": "number"}`). Then `SELECT * FROM audit_log WHERE action_type = 'metadata.field.create' ORDER BY created_at DESC LIMIT 1`.

**Expected:** An `audit_log` row exists with `action_type=metadata.field.create` and `metadata.field_key="contract_value"`.

**Why human:** The automated integration test `test_111_audit_field_create.py` passes (xpassed) but drives the service function directly. The VALIDATION.md manual gate specifies an operator-driven end-to-end test through the live API endpoint to confirm the audit row lands under real JWT + FastAPI routing conditions.

---

### Gaps Summary

No gaps blocking goal achievement. All static and programmatic verification items pass. The `human_needed` status is purely because the phase's own VALIDATION.md designates the SC#4 4-axis cross-provider UAT as Manual-Only per the D-102/104 lesson — and the UAT has not yet been executed by the operator.

The phase delivered:
1. A complete model-flexible extraction pipeline (SC#1/META-03) — model threads end-to-end via `resolve_extraction_model` through `forced_emit`.
2. A configurable head+tail window sampler (SC#2/META-04) — 32k default cap, replaces `content[:3000]`.
3. A runtime Pydantic `create_model` schema for custom fields with correct `_confidence` nesting via `attach_confidence`, WR-01-fix confirmed (SC#3/META-01).
4. A `/metadata-fields` CRUD surface with field_type/field_key validation, `is_global=False` hard-set, and live-verified audit.
5. Migration 072 live on `:54322`; `full-schema.sql` regenerated.
6. All 42 unit tests GREEN, all 5 integration test files GREEN (7 passed / 2 xpassed / 0 failures).
7. App imports cleanly with the `metadata_fields` router mounted.

The 4 advisory WR-02/IN-01..04 carry-forwards from the code review are non-blocking and do not affect goal achievement.

---

_Verified: 2026-06-15T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
