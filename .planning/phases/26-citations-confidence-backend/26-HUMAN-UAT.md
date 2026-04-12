---
status: partial
phase: 26-citations-confidence-backend
source: [26-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End SSE Stream Shape
expected: After streaming text completes, observe three additional events before [DONE]: `{"type":"sources",...}`, then `{"type":"citations","citations":[{...passage...chunk_index...filename...}]}`, then `{"type":"confidence","level":"high"|"medium"|"low","avg_similarity":0.XXXX,"disclaimer":null|"This answer..."}`
result: [pending]

### 2. analyze_document Citation Shape in Stream
expected: Citations event contains entry with `is_full_doc: true`, `passage: null`, `chunk_index: null`, `similarity: null`, and correct filename. No confidence event appears (no search_documents called).
result: [pending]

### 3. source_refs Persistence in Database
expected: After a RAG response, messages table row has `source_refs` column containing full citation objects (JSON array with document_id, filename, chunk_index, passage, similarity, is_full_doc fields), not old simplified shape.
result: [pending]

### 4. Confidence Absent for Non-RAG Turns
expected: SSE stream contains no `{"type":"confidence"...}` event and no `{"type":"citations"...}` event for general knowledge questions that trigger no document retrieval.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
