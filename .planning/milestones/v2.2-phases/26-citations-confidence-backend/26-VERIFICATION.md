---
phase: 26-citations-confidence-backend
verified: 2026-04-12T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 26: Citations & Confidence Backend Verification Report

**Phase Goal:** Every RAG response carries structured citation passages and a computed confidence score delivered via SSE
**Verified:** 2026-04-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths are drawn from Plan 01 and Plan 02 must_haves frontmatter.

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | search_documents returns tuple[list[dict], float] where float is avg vector cosine similarity | VERIFIED | retrieval_service.py line 200: `-> tuple[list[dict], float]`; vector-only (line 224) and hybrid (line 256) both return `(enriched, avg_sim)` |
| 2 | Each enriched result dict contains a chunk_index key sourced from the RPC | VERIFIED | retrieval_service.py line 115: `"chunk_index": row.get("chunk_index")` in `_enrich_with_filenames` |
| 3 | SQL RPC match_document_chunks returns chunk_index in its result set | VERIFIED | 016_citations_chunk_index.sql line 11: `RETURNS TABLE (id uuid, document_id uuid, content text, similarity float, chunk_index integer)` with `dc.chunk_index` in SELECT |
| 4 | All retrieval tests pass after mock fixes | VERIFIED | 13/13 passed in test_retrieval_service.py (live run) |
| 5 | SSE stream includes a citations event with passage text, document name, and chunk_index for each retrieved chunk | VERIFIED | threads.py line 1196: `yield f"data: {json.dumps({'type': 'citations', 'citations': sse_citations})}\n\n"` with passage, filename, chunk_index in citation shape |
| 6 | citations event is absent when no search_documents or analyze_document produced results | VERIFIED | threads.py line 1188: `if unique_citations:` guards the yield — empty retrieved_citations → no event |
| 7 | analyze_document responses produce citation entries with is_full_doc=true and passage=null | VERIFIED | threads.py lines 753-760: `"is_full_doc": True, "passage": None, "chunk_index": None, "similarity": None` |
| 8 | SSE stream includes a confidence event with level high/medium/low derived from avg vector similarity | VERIFIED | threads.py lines 1199-1203: `if similarity_scores:` → `_compute_confidence(final_avg)` → yields `{"type": "confidence", "level": level, ...}` |
| 9 | confidence event is absent when no search_documents call occurred in the turn | VERIFIED | threads.py line 1199: `if similarity_scores:` — similarity_scores only populated by search_documents (not analyze_document) per line 736-737 |
| 10 | Low-confidence responses include the disclaimer text in the confidence event | VERIFIED | threads.py line 1202: `disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None`; CONFIDENCE_DISCLAIMER line 126-129 matches exact text |
| 11 | Citation data persisted in source_refs JSONB column for message reload | VERIFIED | threads.py lines 510-513: `if unique_citations: row["source_refs"] = unique_citations` with unique_sources as backward-compat fallback |
| 12 | Event emission order is sources -> citations -> confidence -> title -> DONE | VERIFIED | threads.py lines 1181-1224: sources (1184) → citations (1196) → confidence (1203) → persist (1206) → title (1220) → DONE (1224) |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/supabase/migrations/016_citations_chunk_index.sql` | Updated match_document_chunks RPC with chunk_index in RETURNS TABLE | VERIFIED | Contains `chunk_index integer` in RETURNS TABLE; `dc.chunk_index` in SELECT body; correct parameter list preserved; 37 lines |
| `backend/app/services/retrieval_service.py` | Modified search_documents return type + _avg_cosine helper + chunk_index enrichment | VERIFIED | `-> tuple[list[dict], float]` annotation; `_avg_cosine` defined lines 124-127; chunk_index passthrough line 115; 257 lines |
| `backend/tests/unit/test_retrieval_service.py` | Fixed and extended retrieval tests (min 150 lines) | VERIFIED | 245 lines; 13 tests total; 5 Phase 26 tests in TestSearchDocumentsPhase26; all assertions use tuple unpacking |
| `backend/app/api/threads.py` | Citation accumulation, confidence computation, new SSE events, persistence extension | VERIFIED | All required patterns present; helpers at module level; accumulation vars in closure scope; both SSE yields real; 1232 lines |
| `backend/tests/unit/test_citations_confidence.py` | Unit tests for confidence computation helper and citation deduplication (min 80 lines) | VERIFIED | 164 lines; 14 tests across TestComputeConfidence (6), TestDeduplicateCitations (5), TestConfidenceDisclaimer (3) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| retrieval_service.py | match_document_chunks RPC | `supabase.rpc("match_document_chunks", ...)` | VERIFIED | Line 45: `supabase.rpc("match_document_chunks", params).execute()` |
| retrieval_service.py | _enrich_with_filenames | chunk_index passthrough from RPC row | VERIFIED | Line 115: `"chunk_index": row.get("chunk_index")` |
| threads.py | search_documents | tuple unpacking `results, avg_sim = search_documents(...)` | VERIFIED | Line 714 |
| threads.py | SSE stream | `yield ... citations event` | VERIFIED | Line 1196 |
| threads.py | SSE stream | `yield ... confidence event` | VERIFIED | Line 1203 |
| threads.py | messages table | `source_refs` stores full citation objects | VERIFIED | Lines 510-513: `row["source_refs"] = unique_citations` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| threads.py (citations event) | `unique_citations` | `retrieved_citations` accumulated from search_documents hits and analyze_document calls | Yes — populated from real search result hits at lines 728-735 | FLOWING |
| threads.py (confidence event) | `similarity_scores` | `avg_sim` from `search_documents` return value (which comes from `_avg_cosine(vector_rows)`) | Yes — real cosine similarity from DB RPC rows | FLOWING |
| threads.py (persistence) | `unique_citations` | Same as above, slice-assigned at line 1187 so closure captures live list | Yes — full citation objects with passage text, chunk_index, similarity | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| _compute_confidence thresholds correct | `python -m pytest tests/unit/test_citations_confidence.py::TestComputeConfidence -v` | 6 passed | PASS |
| _deduplicate_citations preserves order, deduplicates by (doc_id, chunk_index) | `python -m pytest tests/unit/test_citations_confidence.py::TestDeduplicateCitations -v` | 5 passed | PASS |
| Disclaimer logic correct | `python -m pytest tests/unit/test_citations_confidence.py::TestConfidenceDisclaimer -v` | 3 passed | PASS |
| chunk_index flows through retrieval pipeline | `python -m pytest tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26 -v` | 5 passed | PASS |
| Full test suite (both files) | `python -m pytest tests/unit/test_retrieval_service.py tests/unit/test_citations_confidence.py -v` | **27 passed, 0 failures** | PASS |

---

### Requirements Coverage

All 8 requirement IDs are claimed across Plan 01 (CITE-01, CITE-02, CONF-01, CONF-02) and Plan 02 (CITE-01, CITE-02, CITE-04, CITE-05, CONF-01, CONF-02, CONF-03, CONF-04).

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CITE-01 | 01 + 02 | User can see exact retrieved passage text for each search result | SATISFIED | threads.py builds citation with `"passage": hit.get("content")` and emits in citations SSE event; truncated at 400 chars for SSE, full text persisted |
| CITE-02 | 01 + 02 | Each citation card displays document name, section/location, and passage text (≤400 chars) | SATISFIED | Citation shape includes filename, chunk_index (location), passage (truncated to 400 on SSE); full text in source_refs |
| CITE-04 | 02 | Citation cards appear only for passages retrieved in that response turn | SATISFIED | `if unique_citations:` guard on citations event; citations only accumulated during active tool calls in the turn |
| CITE-05 | 02 | For analyze_document results, user sees document name attribution only | SATISFIED | threads.py lines 753-760: `is_full_doc=True, passage=None, chunk_index=None` — frontend can render doc-name-only for these entries |
| CONF-01 | 01 + 02 | High/Medium/Low confidence badge on every document-grounded assistant message | SATISFIED | `_compute_confidence` maps >= 0.7 → high, >= 0.5 → medium, < 0.5 → low; emitted in confidence SSE event |
| CONF-02 | 01 + 02 | Confidence badge colour-coded: green ≥ 0.7, amber 0.5–0.7, red < 0.5 | SATISFIED (backend) | Thresholds implemented in `_compute_confidence` matching spec exactly; colour-coding is frontend responsibility (Phase 27) |
| CONF-03 | 02 | Low-confidence responses include standard disclaimer text | SATISFIED | threads.py line 1202: `disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None`; CONFIDENCE_DISCLAIMER matches exact required text |
| CONF-04 | 02 | Confidence badge does not appear on web_search, execute_code, or skill-only responses | SATISFIED | `if similarity_scores:` guards confidence event; similarity_scores only populated by search_documents (lines 736-737), not other tool calls |

No orphaned requirements — all 8 IDs declared in plans are present in REQUIREMENTS.md under Phase 26 and confirmed complete.

---

### Anti-Patterns Found

None. Scanned threads.py, retrieval_service.py, test files for TODO/FIXME/placeholder/return null/empty array returns. No matches found.

---

### Human Verification Required

#### 1. End-to-End SSE Stream Shape

**Test:** Send a chat message that triggers search_documents (e.g. "What does the document say about X?"). Inspect raw SSE stream in browser devtools Network tab.
**Expected:** After the streaming text completes, observe three additional events before [DONE]: `{"type":"sources",...}`, then `{"type":"citations","citations":[{...passage...chunk_index...filename...}]}`, then `{"type":"confidence","level":"high"|"medium"|"low","avg_similarity":0.XXXX,"disclaimer":null|"This answer..."}`.
**Why human:** SSE stream ordering and payload shape requires a live server and real Supabase data; cannot be verified without running the full stack.

#### 2. analyze_document Citation Shape in Stream

**Test:** Send a chat message that causes the agent to call analyze_document on an uploaded PDF. Inspect the SSE citations event.
**Expected:** The citations event contains an entry with `is_full_doc: true`, `passage: null`, `chunk_index: null`, `similarity: null`, and the correct `filename`. No confidence event should appear (since no search_documents was called).
**Why human:** Requires live server, a real document, and agent routing to analyze_document tool.

#### 3. source_refs Persistence in Database

**Test:** After a RAG response, inspect the messages table row for that assistant message in Supabase dashboard.
**Expected:** `source_refs` column contains full citation objects (JSON array with document_id, filename, chunk_index, passage, similarity, is_full_doc fields), not the old simplified `{document_id, filename}` shape.
**Why human:** Requires database inspection; cannot be verified from code alone without a live query.

#### 4. Confidence Absent for Non-RAG Turns

**Test:** Send a general knowledge question that does not trigger any document retrieval (agent uses no tools or uses web_search only).
**Expected:** SSE stream contains no `{"type":"confidence"...}` event and no `{"type":"citations"...}` event.
**Why human:** Requires live server and confirming agent routing decision matches expectation.

---

### Gaps Summary

No gaps. All 12 truths verified. All artifacts exist, are substantive, are wired, and have verified data flow. All 27 unit tests pass. All 8 requirement IDs accounted for with implementation evidence. Zero anti-patterns found.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
