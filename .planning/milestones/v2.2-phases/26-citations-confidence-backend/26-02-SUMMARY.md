---
phase: 26-citations-confidence-backend
plan: "02"
subsystem: backend-threads
tags: [citations, confidence, sse, tdd, threads]
dependency_graph:
  requires: [26-01]
  provides: [citations SSE event, confidence SSE event, full citation objects in source_refs]
  affects: [backend/app/api/threads.py, backend/tests/unit/test_citations_confidence.py]
tech_stack:
  added: []
  patterns: [tuple unpacking from search_documents, SSE citation/confidence events, closure-accessible unique_citations for persistence]
key_files:
  created:
    - backend/tests/unit/test_citations_confidence.py
  modified:
    - backend/app/api/threads.py
decisions:
  - unique_citations uses slice assignment (unique_citations[:] = ...) so _persist_assistant_message closure captures the populated list
  - SSE citations payload truncates passage at 400 chars; full passage stored in source_refs for message reload
  - similarity_scores accumulates only from search_documents calls (not analyze_document) per D-16
  - analyze_document produces is_full_doc=True citation with null passage/chunk_index/similarity
  - confidence event absent when no search_documents produced results (similarity_scores empty)
  - citations event absent when no search_documents or analyze_document produced results
metrics:
  duration: "2m 2s"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 2
---

# Phase 26 Plan 02: Citation Accumulation + Confidence Scoring SSE Summary

**One-liner:** Added citations and confidence SSE events to threads.py with full citation passage accumulation, confidence scoring from avg cosine similarity, and full citation persistence in source_refs.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create test file for confidence computation and citation deduplication | 8deccfb | backend/tests/unit/test_citations_confidence.py |
| 2 | Add citation accumulation, confidence scoring, and SSE events to threads.py | d4ccf22 | backend/app/api/threads.py |

## What Was Built

### Task 1: TDD Test File (RED phase)

Created `backend/tests/unit/test_citations_confidence.py` with 14 tests covering:

**TestComputeConfidence (6 tests):**
- `test_high_confidence`: avg_similarity=0.85 → "high"
- `test_high_confidence_boundary`: avg_similarity=0.7 → "high" (inclusive boundary)
- `test_medium_confidence`: avg_similarity=0.6 → "medium"
- `test_medium_confidence_boundary`: avg_similarity=0.5 → "medium" (inclusive boundary)
- `test_low_confidence`: avg_similarity=0.3 → "low"
- `test_low_confidence_zero`: avg_similarity=0.0 → "low"

**TestDeduplicateCitations (5 tests):**
- `test_deduplicates_by_document_id_and_chunk_index`: same (doc_id, chunk_index) → 1 entry
- `test_keeps_different_chunks_same_document`: different chunk indices → both kept
- `test_handles_null_chunk_index`: two None chunk_index entries → deduplicated to 1
- `test_preserves_order`: first occurrence wins, C dropped as duplicate of A
- `test_empty_input`: [] → []

**TestConfidenceDisclaimer (3 tests):**
- `test_disclaimer_present_when_low`: level "low" → CONFIDENCE_DISCLAIMER text
- `test_disclaimer_absent_when_high`: level "high" → None
- `test_disclaimer_absent_when_medium`: level "medium" → None

Tests failed with ImportError (RED phase) until Task 2 added the helpers.

### Task 2: threads.py Modifications

Modified `backend/app/api/threads.py` with six targeted changes:

**A. Module-level helpers (after SYSTEM_PROMPT, before route handlers):**
- `CONFIDENCE_DISCLAIMER`: canonical low-confidence disclaimer text string
- `_compute_confidence(avg_similarity: float) -> str`: maps float to "high"/"medium"/"low"
- `_deduplicate_citations(citations: list[dict]) -> list[dict]`: deduplicates by (document_id, chunk_index), preserving insertion order

**B. Accumulation variables (alongside source_refs):**
- `retrieved_citations: list[dict] = []` — full citation objects per D-04
- `similarity_scores: list[float] = []` — per-call avg cosine values for confidence
- `unique_citations: list[dict] = []` — deduplicated list accessible by _persist_assistant_message closure

**C. search_documents call site updated:**
- Changed `results = search_documents(...)` → `results, avg_sim = search_documents(...)` (tuple unpacking from Plan 01)
- Replaced plain `source_refs.append` loop with combined block that also builds `retrieved_citations` entries and appends `avg_sim` to `similarity_scores`

**D. analyze_document source tracking extended:**
- After existing `source_refs.append(...)`, appends a full citation dict with `is_full_doc=True`, `passage=None`, `chunk_index=None`, `similarity=None` (D-16: no similarity_scores contribution)

**E. Turn-end SSE emission (after sources, before persist):**
- Calls `unique_citations[:] = _deduplicate_citations(retrieved_citations)` (slice assignment for closure capture)
- If `unique_citations` non-empty: builds `sse_citations` with passage truncated to 400 chars, yields `{"type": "citations", "citations": sse_citations}`
- If `similarity_scores` non-empty: computes `final_avg`, calls `_compute_confidence`, sets disclaimer when level=="low", yields `{"type": "confidence", "level": ..., "avg_similarity": ..., "disclaimer": ...}`

**F. _persist_assistant_message closure updated:**
- Changed `if unique_sources: row["source_refs"] = unique_sources` to prefer `unique_citations` (full citation objects, D-13) with `unique_sources` as backward-compat fallback for non-RAG turns

**Emission order confirmed:** sources → citations → confidence → title → DONE

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are real. Citations come from actual search_documents results. Confidence comes from actual avg_cosine values returned by retrieval_service. SQL migration 016 (from Plan 01) enables chunk_index to be present in RPC rows.

## Self-Check: PASSED

- [x] `backend/tests/unit/test_citations_confidence.py` exists with 14 test cases
- [x] threads.py contains `def _compute_confidence(avg_similarity: float) -> str:`
- [x] threads.py contains `def _deduplicate_citations(citations: list[dict]) -> list[dict]:`
- [x] threads.py contains `CONFIDENCE_DISCLAIMER = "`
- [x] threads.py contains `results, avg_sim = search_documents(`
- [x] threads.py contains `retrieved_citations: list[dict] = []`
- [x] threads.py contains `similarity_scores: list[float] = []`
- [x] threads.py contains `unique_citations: list[dict] = []`
- [x] threads.py contains `"type": "citations"` in yield statement (line 1196)
- [x] threads.py contains `"type": "confidence"` in yield statement (line 1203)
- [x] threads.py contains `"is_full_doc": True` in analyze_document block (line 759)
- [x] threads.py contains `unique_citations[:] = _deduplicate_citations(retrieved_citations)` (line 1187)
- [x] threads.py contains `row["source_refs"] = unique_citations` (line 511)
- [x] sources event (line ~1180) precedes citations event (line 1187) precedes confidence event (line 1198)
- [x] Commit `8deccfb` exists (Task 1)
- [x] Commit `d4ccf22` exists (Task 2)
- [x] `python -m pytest tests/unit/test_citations_confidence.py` → 14 passed
- [x] `python -m pytest tests/unit/test_retrieval_service.py` → 13 passed
- [x] Pre-existing 7 failures in other test files are unchanged (not regressions)
