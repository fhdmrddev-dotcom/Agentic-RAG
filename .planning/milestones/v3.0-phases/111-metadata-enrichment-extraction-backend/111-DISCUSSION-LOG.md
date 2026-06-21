# Phase 111: Metadata Enrichment — Extraction Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 111-metadata-enrichment-extraction-backend
**Areas discussed:** Cross-provider extraction engine, Extraction-model setting + default, Window lift + ingest cost, Custom-field authoring scope, Local models (operator add-on)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-provider extraction engine | Reuse forced_emit vs keep OpenAI json_object; how confidence is produced | ✓ |
| Extraction-model setting + default | app_settings (admin) vs user_settings; default model | ✓ |
| Window lift & ingest cost | bigger fixed window vs head+tail sampling; cap | ✓ |
| Custom-field authoring scope | backend CRUD in 111 vs deferred; field types; re-extract | ✓ |

**Operator add-on (free-text):** "Also consider the local models using Ollama and LM Studio … we have to ensure that this is working." → Local-model support folded into the engine decision as a first-class requirement.

---

## Cross-provider extraction engine

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `forced_emit` (TIER-FORCE/COERCE) | Proven cross-provider engine; accepts dynamic schema_model; COERCE carries weak/local models | ✓ |
| Keep/extend OpenAI `json_object` | OpenAI-only; dead end for model-flexibility + local | |

**User's choice:** Go with recommendation (reuse forced_emit). **Verified:** forced_emit is async, validates the passed `schema_model`, owns no tool (caller builds it). Correction surfaced: do NOT reuse `phase_types._emit_forced_tool` (EmitFieldMap-shaped); build a dedicated `emit_document_metadata` tool. It's a re-platforming (resolve model+provider+real UserEffectiveSettings; asyncio.run inside the sync BackgroundTask). Confidence = model self-reports 0–1 per field into a nested `_confidence` map.

## Extraction-model setting + default

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-global `app_settings.extraction_model` | One pick for everyone; matches "admin-configured" + minimal SEED-012 | ✓ |
| Per-user `user_settings` | Each user picks | deferred |

**User's choice:** admin-global, keep gpt-4o default but model-agnostic ("guarantee anything works; business decides"; Sonnet/gpt-5.4 good; gpt-5.5/opus-4-8 expensive but keep as options). **Reconciliation locked:** the new forced_emit enrichment path is DEFAULT-ON (so enrichment applies by default); a separate `metadata_enrichment_mode` knob reverts to the legacy OpenAI path (the D-110-2 "own knob"). DB-only column (no UI), migration 072.

## Window lift & ingest cost

| Option | Description | Selected |
|--------|-------------|----------|
| Head+tail sampling, configurable cap | Catches title page AND late bylines; quality-first | ✓ |
| Bigger fixed head-only window | Simpler; misses the tail | |

**User's choice:** quality-first ("as long as cost affects quality, don't let it impact negatively; I don't care about budget as long as it works perfectly"). Cap validated against the resolved model's context window; on overflow truncate-then-degrade (couples with local-model path).

## Custom-field authoring scope

| Option | Description | Selected |
|--------|-------------|----------|
| 111 = backend CRUD API + extraction; UI deferred | New `metadata_fields.py` router; built-ins always-on + custom additive | ✓ |
| Defer "define" to a UI phase | Would leave META-01 unsatisfied in 111 | |

**User's choice:** "you decide best option and think about the bigger picture." **Decided:** new router (not folded into hot documents.py), field_type validated in app (free text in DB), create hard-sets user_id+is_global=false, ingest read explicitly user-scoped (110 SECURITY lesson), forward-only + opt-in /reextract, live `metadata.field.create` audit.

## Local models (operator add-on)

| Option | Description | Selected |
|--------|-------------|----------|
| openai_compat → TIER-COERCE + first-class LM Studio provider | COERCE + validate-retry + graceful degradation; add named local provider | ✓ |
| Ollama-impersonation only | Works today via LLM_PROVIDER=ollama + base_url hack; no clean LM Studio | rejected |

**User's hardware:** LM Studio, RTX 4050 laptop, 6 GB VRAM. **Decided:** add a first-class local/LM-Studio provider; test target Qwen2.5-7B-Instruct Q4_K_M (floor 3B); evaluate grammar-constrained `response_format` json_schema for syntactic guarantees; a failing model must never break ingestion (graceful degradation invariant).

---

## Claude's Discretion

- Migration 072 exact columns; COERCE retry cap (≤2); local-provider key name + env var; enum vs boolean for the reversibility knob; field-type vocabulary; router method shapes; extraction system-prompt wording.

## Deferred Ideas

- Per-user extraction_model override; Settings-UI control; provider-side forcing fixes (SEED-082); typed/indexed metadata columns (113/114); field-management UI + confidence display + manual edit (112); `metadata.update` audit (112).

## Verification

A 7-agent adversarial workflow (`verify-111-context`, 2026-06-15) confirmed all six load-bearing claims against live source + provider docs; corrections (forced_emit tool ownership, the default-byte-identical/forced_emit tension, free-text field_type, mandatory explicit ingest scoping) were folded into the CONTEXT decisions. Two open reported bugs (BUG-260615-01 finding 3, BUG-260607-03 MiniMax) routed as awareness-only (pass-OR-documented; 111 does not own the fix).
