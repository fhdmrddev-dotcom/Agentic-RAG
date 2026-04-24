---
phase: 22-rag-correctness-fixes
plan: 01
status: complete
completed: 2026-04-10
---

## What was built

Three RAG correctness fixes:

1. **read_document context cap** — Tool results from `read_document` injected into the LLM context are now capped at 3,000 chars with a truncation note. Previously uncapped — large documents could flood the main agent context.

2. **Metadata case normalization at ingest** — `document_type` and `language` fields are lowercased before storage. Previously the LLM extraction prompt asked for lowercase but had no enforcement, causing mismatches.

3. **Metadata filter case normalization at search** — `metadata_filter` values are lowercased before being passed to the RPC. Prevents query failures when the LLM generates `{"document_type": "Report"}` but stored value is `"report"`.

## Key files
- `backend/app/api/threads.py` — read_document cap
- `backend/app/api/documents.py` — lowercase at ingest
- `backend/app/services/retrieval_service.py` — lowercase filter at search
- `backend/tests/unit/test_rag_correctness.py` — unit tests

## Verification
- Committed in d996f9f
