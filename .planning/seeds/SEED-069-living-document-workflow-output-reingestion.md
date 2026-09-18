---
seed_id: SEED-069
title: Living-document feedback loop — workflow output → versioned KB re-ingestion (so produced artifacts stay live & accurate across runs)
status: planted
planted: 2026-06-09
phase_origin: Phase 097 spike go/no-go discussion 2026-06-09 (operator insight — "if the workflow keeps updating the register, the output must be re-ingested as an updated version or the AI can't keep the document live and accurate")
category: composition — ingestion/dedup/versioning ALREADY EXIST; net-new is thin wiring + a provenance flag, NOT a new pipeline
related_seeds: [SEED-005, SEED-052, SEED-051]
relates_to:
  - "backend/app/api/documents.py:402-423 — content_hash (sha256) dedup: identical re-upload short-circuits with 200, never re-ingested (the 'same exact file is rejected' behavior)"
  - "backend/app/api/documents.py:425-449 — filename-keyed versioning: updated content → version_number+1 AND retires all prior versions from retrieval (is_latest=False). Version-aware 'prefer latest' retrieval is ALREADY wired"
  - "backend/app/api/documents.py:656 — POST /documents/{id}/reingest endpoint already exists"
  - "Phase 097 CONCLUSION.md Condition 8 — the go-conditional condition this seed generalizes"
  - "SEED-005 (Enhanced Document Structure / M-Files-Doxis basics) — logical-document versioning is the DM half of this; NEXT milestone after v2.9"
  - "GOV-02 (Per-run provenance receipt, STRETCH Phase 107) — the source-vs-derived provenance tag this seed needs"
  - "Phase 102 (freshness/version + output-quality gate) — self-feedback amplification guard"
re_open_triggers:
  - Phase 100/101 designs the workflow OUTPUT side (where the produced file lands + whether it is re-ingested) — wire the existing upload/reingest API here
  - Phase 098 schema lock — decide whether the recommended schema gains an OUTPUT-side dimension (output_target_folder + reingest_output flag + version_policy) alongside inputs/assets/folder_scope
  - SEED-005 (Enhanced Document Structure) milestone starts — logical-document versioning + source-vs-derived classification land together
  - Any workflow that produces a recurring/evolving artifact (weekly risk register, status report, rolling summary) reaches build
priority: medium — high durable-value (turns one-shot file production into a living automation engine), low cost (leverages shipped ingestion infra)
suggested_phase: v2.9 Phase 100/101 (output target wiring) + Phase 098 (optional output schema dimension); the source-vs-derived provenance flag pairs with SEED-005 / GOV-02
surface: Agentic-RAG
trigger_when: unset
---

# SEED-069 — Living-document feedback loop (workflow output → versioned KB re-ingestion)

## The idea

A workflow that produces an **evolving artifact** (the Phase 097 risk register is
the canonical example) must be able to feed its output back into the KB as a new
**version**, so the *next* run grounds on the latest consolidated state — not just
the raw source documents. Without this the workflow is **stateless**: every run
re-derives from sources and forgets everything the prior runs accumulated, so the
produced document can never stay "live and accurate."

Generalize beyond risk registers: any recurring deliverable (status report, rolling
executive summary, decision log, meeting-notes digest) is a living document with the
same need.

## Why this is mostly ALREADY BUILT (don't rebuild — operator callout 2026-06-09)

The ingestion pipeline already does the hard parts (evidence in `backend/app/api/documents.py`):

| Capability | Where | Behavior |
|---|---|---|
| Dedup (reject identical) | :402-423 | `content_hash = sha256(raw)`; an identical, already-`is_latest`/`completed` file in the same folder short-circuits with `200` — not re-ingested |
| Versioning (detect updated) | :425-449 | same filename + new content → `version_number + 1`; **all prior versions retired from retrieval** (`is_latest=False`) |
| Re-ingest endpoint | :656 | `POST /documents/{id}/reingest` already exists |

So "prefer the latest version" retrieval is **already wired** — the freshness concern
(Phase 097 Pitfall 7) is less load-bearing than first assumed.

## What is actually net-new (the thin slice)

1. **Wiring:** a workflow's finalize step writes its produced file and calls the
   existing `/documents/upload` (or `/reingest`) into a target folder. Because
   versioning keys on filename, re-uploading "Project Meridian Risk Register.docx"
   with updated content auto-creates v2 and retires v1 from retrieval — the
   living-document behavior comes essentially for free.
2. **Provenance tag (source vs derived):** mark workflow-produced docs as
   `derived/generated` so the AI and the output-quality gate do NOT treat the
   model's own prior output as ground-truth source (self-feedback amplification
   risk — a re-ingested hallucination could compound). No such flag exists today.
3. **Manual-upload-only boundary decision:** CLAUDE.md says *"ingestion is manual
   file upload only — no connectors or automated pipelines."* A workflow calling the
   user-scoped upload API on the user's behalf is a *contained* automated path (same
   endpoint a human upload hits), but it crosses that line — needs an explicit,
   scoped exception decision (not a silent expansion).

## Deliberately NOT in scope (for the thin slice)

- New ingestion/dedup/versioning machinery (it exists — wire it).
- Scheduled/automatic re-ingestion on a timer (that's SEED-014 / scheduling territory).
- Full document-management versioning UX (history browse, diff, restore-to-version) —
  that's SEED-005 (Enhanced Document Structure), the next milestone.
