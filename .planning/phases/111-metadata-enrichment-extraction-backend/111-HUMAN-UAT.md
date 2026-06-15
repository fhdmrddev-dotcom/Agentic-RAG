---
status: partial
phase: 111-metadata-enrichment-extraction-backend
source: [111-VERIFICATION.md]
started: 2026-06-15T23:55:00Z
updated: 2026-06-15T23:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC#4 4-axis UAT — cross-provider dynamic-schema extraction (VALIDATION.md axis a)
expected: Ingest the same doc with `extraction_model` set to one model per native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax) + OpenRouter; SELECT stored `documents.metadata`. Each provider either returns valid confidence-scored fields OR an honest-fail that degrades to null metadata (doc still `status=completed`). Acceptance = pass OR documented limitation per provider.
result: [pending]

### 2. SC#4 4-axis UAT — local model (LM Studio) TIER-COERCE path (VALIDATION.md axis b)
expected: Ingest a doc with `extraction_model` set to a Qwen2.5-7B-Instruct model ID, provider `lmstudio`; SELECT stored metadata + `_confidence`. Expect valid dynamic-schema emission via TIER-COERCE. (Requires LM Studio running locally with a model loaded.)
result: [pending]

### 3. SC#4 4-axis UAT — long-doc window-lift (VALIDATION.md axis c)
expected: Ingest a doc ≥ 5 KB whose title/byline data is after char 3000. SELECT metadata; expect the late title/date captured in the result (proves head+tail sampler beats `content[:3000]`).
result: [pending]

### 4. SC#4 4-axis UAT — graceful degradation (VALIDATION.md axis d)
expected: Ingest with a deliberately-failing/garbage model (invalid model ID or a model that 400s). SELECT the document row. Expect `status=completed` with null/partial metadata — NEVER stuck in `processing`/`failed` from the extraction step.
result: [pending]

### 5. Live audit INSERT+SELECT (VALIDATION.md manual row)
expected: Create a custom field via `POST /metadata-fields`; SELECT `audit_log` for a `metadata.field.create` row. Expect the row to exist with the correct `field_key` and `field_type` in metadata.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
