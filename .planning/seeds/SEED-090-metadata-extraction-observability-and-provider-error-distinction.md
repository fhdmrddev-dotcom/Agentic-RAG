---
seed_id: SEED-090
title: Metadata-extraction failure observability — surface "extraction failed" vs "no metadata found", and distinguish provider_error (transport/down) from model_failed_to_emit (honest decline)
status: planted
planted: 2026-06-17
phase_origin: "Phase 111.1 verify-work — operator ingested a Word doc, saw NO metadata, no UI signal. Root cause was an OpenAI strict-400; the doc still completed with metadata=None, indistinguishable from a doc that legitimately has no metadata. The ultracode end-to-end integrity workflow (wf_bcee7c86) confirmed the gap at code + live-DB + UI layers and the adversarial pass upheld it."
category: Ingestion observability — additive status/telemetry surface over the existing best-effort degrade; does NOT change the degrade contract (a failing model still never breaks ingestion)
related_seeds: [SEED-088, SEED-089]
related_memories: [feedback_investigate_with_tools_first, feedback_uat_lived_experience_gap, feedback_cross_provider_full_native_roster]
related_decisions:
  - "D-111-8: metadata extraction is best-effort — a failing model NEVER blocks ingestion (doc reaches status=completed). This seed KEEPS that, but makes the failure VISIBLE instead of silent."
re_open_triggers:
  - An operator ingests a doc and cannot tell whether metadata is absent because extraction FAILED or because the doc genuinely had none (the exact 2026-06-17 incident).
  - A local/non-OpenAI extraction provider is pinned and silently produces zero metadata (provider down / wrong base_url / strict-trap) with no surfaced signal.
  - The pre-production comprehensive review (observability is on that list).
  - SEED-088 (dynamic model registry) ships — picker default-id health (see below) is adjacent.
priority: MEDIUM — confirmed gap that caused a real blind backfill; not ingestion-breaking, but it hides genuine failures from the operator.
suggested_phase: a small observability phase (1 nullable column + degrade-path write + a DocumentList badge), or fold into SEED-088 / a pre-production observability pass.
---

# SEED-090 — Make metadata-extraction failure observable

## The gap (confirmed Phase 111.1 verify-work, 2026-06-17)

When enriched metadata extraction fails, `documents.py ingest_document` completes the doc with
`status='completed'`, `metadata=None`, **no `error_message`, no distinct telemetry, no UI signal**:
- `pdf_extraction_runs.error` records TEXT/TABLE/IMAGE extraction failures only — never the metadata step.
- The `forced_emit` `failure` reason (`provider_error` / `model_failed_to_emit`) is returned up the stack
  but **never read, logged at the call site, or persisted** — the only trace is a server-log WARNING
  (`forced_emit: provider call raised`).
- `ingestion_step` is left at `'metadata'` on EVERY completed doc regardless of outcome → not a signal.

Net effect: a doc whose extraction FAILED (e.g. the OpenAI strict-400 we hit) is **byte-for-byte
indistinguishable on the row** from a doc the model legitimately found no metadata for. This is exactly
what forced the operator's blind backfill on 2026-06-17.

## Two distinctions worth surfacing

1. **failed vs empty**: persist a small `metadata_status` (e.g. `ok` | `empty` | `failed`) or a
   nullable `metadata_error` reason on `documents`, written on the degrade path, and show a
   "metadata unavailable" badge in `DocumentList` so the operator can re-run/re-extract.
2. **provider_error vs model_failed_to_emit** (from the cross-provider probe, wf_bcee7c86): a
   `provider_error` means the provider call THREW (server down / unreachable / 4xx — e.g. LM Studio
   down, or the OpenAI strict-400), distinct from `model_failed_to_emit` (the model ran but honestly
   declined). The current UI/telemetry collapses both to "no metadata". Surfacing the `ErrorKind`
   (`auth` / `rate_limit` / `bad_request` / `server`) — `classify_provider_error` already exists in
   `provider_gateway/errors.py` — would tell the operator "LM Studio is down" vs "the model couldn't".

## Fix outline (additive, keeps D-111-8)
- Migration: add `documents.metadata_status text` (or reuse `error_message` with a metadata prefix).
- `documents.py`: in the metadata degrade path, write the `failure` reason (already in the
  `extract_metadata_enriched` result dict) instead of discarding it.
- `DocumentList` / `HealthDocumentRow`: a small "metadata: failed (provider down)" badge with a
  re-extract action.

## Adjacent: picker default-model health (cross-ref SEED-088)
The same integrity workflow found stale/unserved EXTRACTION_PRESETS default model ids (ProviderPicker.tsx):
- `glm-4.6` (zhipu default) → `provider_error`; `glm-4.5` works.
- `deepseek-chat` is a registry-MISS / discontinued id (only `deepseek-v4-flash/-pro` are registered) —
  so the served DeepSeek strict-schema force path was never exercised (a potential OpenAI-style strict-400).
- `gemini-3.5-flash` (google default) returned `model_failed_to_emit` on a forced mainstream model — atypical; re-verify live.
These are DEFAULT-CURATION issues owned by SEED-088 (dynamic per-provider `/models` discovery), which
will replace the hardcoded defaults. Until then, the model field is editable so any served id works —
but the defaults should be corrected when SEED-088 lands (or sooner for `glm-4.6`).
