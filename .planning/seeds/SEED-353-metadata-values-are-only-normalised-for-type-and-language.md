---
seed_id: SEED-353
title: Extracted metadata is normalised only for document type and language — author, organisation and other strings are stored as extracted, so the same value can appear in several spellings
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names backend/app/services/ingest_enrich.py or metadata_field_service.py; OR a Find/View facet shows the same author or organisation twice under different casing; OR a metadata-quality or re-extraction pass is scheduled."
trigger_paths: ["backend/app/services/ingest_enrich.py", "backend/app/services/metadata_field_service.py", "backend/app/services/view_filter_compiler.py"]
trigger_surfaces: ["ingestion", "library", "retrieval"]
migration_note:
relates_to: ["SEED-153", "SEED-336", "docs/history/v2.1-stability-and-rag-correctness.md", "docs/history/v2.3-memory-multimodal-and-experience.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-353: metadata values are normalised only for type and language

## The finding

v2.1 lowercased `document_type` and `language` at ingest and deferred the rest; v2.3 deferred it again.
Measured 2026-10-04: `backend/app/services/ingest_enrich.py:356` and `:358` are still the only
normalisation of extracted metadata values. Other strings (author, organisation, custom text fields) are
stored as the model extracted them. v2.1 recorded that filters compare them lowercase, which hides some of
the mismatch at query time but not in facets, chips or exports.

## Why it matters

Find (v4.5) and saved Views show metadata as filter chips and facets. "ACME Corp", "Acme Corp" and
"ACME CORP." become three values, and counts split across them. It gets worse as cloud sync adds volume.

## When to surface

The next phase that changes metadata extraction or field handling, or the first duplicated facet value a
user reports.

## Scope estimate

Small to Medium. Decide per field type: case-fold and trim for display-insensitive text, keep the original
for display; optionally an alias table for organisations. Existing rows need a one-off backfill (no
re-embedding required, metadata only).

## Breadcrumbs

- `docs/history/v2.1-...md` (Gaps: "Partial normalisation")
- `docs/history/v2.3-...md` (Gaps: "Metadata normalisation ... was deferred")
