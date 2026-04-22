# Phase 26: Citations & Confidence — Backend - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich the SSE event stream with two new event types: `citations` (retrieved passage text with document attribution per chunk) and `confidence` (high/medium/low level computed from retrieval similarity scores). Also persist citation data in the messages table for reload reconstruction.

No UI rendering — that is Phase 27. No new Supabase tables. Changes are confined to `retrieval_service.py`, `threads.py`, and the messages JSON column.

</domain>

<decisions>
## Implementation Decisions

### Chunk location anchor
- **D-01:** Add `chunk_index` to `_enrich_with_filenames` return shape. Each citation entry exposes `"chunk_index": N` (integer from the `document_chunks` table). Phase 27 renders this as "Chunk N" in the citation card.
- **D-02:** Retrieve `chunk_index` alongside `id` and `content` in the `_enrich_with_filenames` DB lookup (add `chunk_index` to the `.select()` on `document_chunks` if needed, or pull it from the raw row before enrichment).

### New SSE events
- **D-03:** Add `citations` event: `{"type": "citations", "citations": [<citation_object>]}`. Emitted once per turn after `sources`, before `[DONE]`, only when at least one `search_documents` or `analyze_document` call produced results.
- **D-04:** Citation object shape: `{"document_id": str, "filename": str, "chunk_index": int | null, "passage": str | null, "similarity": float | null, "is_full_doc": bool}`. For `search_documents` results: `is_full_doc=false`, `passage` = chunk `content`, `chunk_index` = from DB, `similarity` = vector cosine. For `analyze_document` results: `is_full_doc=true`, `passage=null`, `chunk_index=null`, `similarity=null` (CITE-05: document name only).
- **D-05:** Add `confidence` event: `{"type": "confidence", "level": "high"|"medium"|"low", "avg_similarity": float, "disclaimer": str | null}`. Emitted only when `search_documents` was called at least once (not for `analyze_document`-only or non-RAG turns). `disclaimer` is non-null only when `level == "low"`.
- **D-06:** `sources` event is kept unchanged for backward compatibility. `citations` and `confidence` are additive new events.
- **D-07:** Emit order at turn end: `sources` → `citations` → `confidence` → title (if first turn) → `[DONE]`.

### Confidence scoring
- **D-08:** Modify `search_documents` to return `(list[dict], float)` — a tuple of `(enriched_results, avg_vector_similarity)`. `avg_vector_similarity` is computed from raw vector `similarity` fields (cosine 0–1) of the top-K results before RRF or reranking. This gives a stable 0–1 score regardless of search mode.
- **D-09:** In hybrid mode: average the `similarity` field of fused results that carry a non-zero cosine similarity. In vector-only mode: average all returned `similarity` fields. If no vector results at all (keyword-only path): `avg_similarity = 0.0`.
- **D-10:** Confidence thresholds per CONF-02: `high` ≥ 0.7, `medium` 0.5–0.69, `low` < 0.5 (including 0.0 / zero results).
- **D-11:** If `search_documents` is called multiple times in one turn (agent calls it twice), accumulate all citation objects and average all similarity scores across all calls to compute the final confidence level.
- **D-12:** Disclaimer text (CONF-03): `"This answer is based on limited or weakly-matched evidence. Please verify with the source documents."` — included in `confidence` event payload only when `level == "low"`.

### Citations persistence (data model extension)
- **D-13:** Extend `source_refs` in the `messages` table to store full citation data. The column is already JSONB. New shape stored per message: `[{"document_id": str, "filename": str, "chunk_index": int | null, "passage": str | null, "similarity": float | null, "is_full_doc": bool}]`. Old messages retain their existing `{document_id, filename}` shape — Phase 27 must handle both shapes gracefully.
- **D-14:** The `retrieved_citations` list in `threads.py` (analogous to existing `source_refs`) accumulates full citation objects per turn. At turn-end, deduplicate by `(document_id, chunk_index)` before persisting and emitting.

### Conditional emission (CITE-04, CONF-04)
- **D-15:** `citations` event: absent when zero retrieval calls produced results (no `search_documents` hits AND no `analyze_document` call in the turn).
- **D-16:** `confidence` event: absent when no `search_documents` call occurred in the turn (i.e., turn used only `web_search`, `execute_code`, `analyze_document`, or skill tools).

### Claude's Discretion
- Passage truncation in the `citations` SSE payload — the full `content` field can be up to ~800 chars. Truncate at 400 chars in the SSE payload (the full text is already persisted in `source_refs`). Phase 27 requirements cap display at 400 chars with expand control anyway.
- Internal variable naming in `threads.py`
- Whether to extract a small helper function or inline the confidence computation in `threads.py`

</decisions>

<specifics>
## Specific Ideas

- All gray areas delegated to Claude — no specific references or "I want it like X" from user.
- Phase 27 (Frontend) will render citation cards and confidence badge from these SSE events. The event shapes defined in D-03/D-05 are the contract Phase 27 consumes.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §"Citation & Source Highlighting (F-01)" — CITE-01 through CITE-05 definitions
- `.planning/REQUIREMENTS.md` §"Answer Confidence Score (F-05)" — CONF-01 through CONF-04 definitions
- `.planning/ROADMAP.md` §"Phase 26: Citations & Confidence — Backend" — Success criteria (5 items)

### Source files to modify
- `backend/app/services/retrieval_service.py` — `search_documents`, `_enrich_with_filenames`, `_vector_search`; adding `chunk_index` to enriched output and changing `search_documents` return type
- `backend/app/api/threads.py` — SSE event emission loop, `source_refs` accumulation, turn-end event sequence
- `backend/supabase/migrations/002_module2_byo_retrieval.sql` — Reference for `document_chunks` table schema (confirm `chunk_index` column exists)

### Existing patterns to follow
- `backend/app/api/threads.py` lines 1123–1126 — existing `sources` event emission pattern to follow for `citations`/`confidence`
- `backend/app/api/threads.py` lines 689–695 — existing `source_refs` accumulation pattern to extend
- `backend/app/services/retrieval_service.py` lines 102–120 — `_enrich_with_filenames` to extend with `chunk_index`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_enrich_with_filenames(rows, supabase)` — already does a batched lookup of document metadata (filename) from chunk rows. Extend to also return `chunk_index` from the raw row data (it's in `document_chunks` but not currently fetched in this function's select).
- `source_refs` list in `threads.py` — already accumulates `{document_id, filename}` per turn and emits the `sources` SSE event at turn-end. Citation accumulation follows the same pattern.

### Established Patterns
- SSE events use `yield f"data: {json.dumps({...})}\n\n"` pattern consistently throughout `threads.py`
- `search_documents` is called at line 682 with `results` variable; adding a second return value requires updating both the call site and any test mocks
- `source_refs` is stored in messages table at line 481: `row["source_refs"] = unique_sources`

### Integration Points
- `threads.py` line 680–695: `search_documents` call site — change `results = search_documents(...)` to `results, avg_sim = search_documents(...)`; add to `retrieved_citations` list and accumulate similarity scores
- `threads.py` line 1123–1126: turn-end event emission — add `citations` and `confidence` events after `sources`
- `threads.py` line 481: `_persist_assistant_message` — extend `source_refs` write to use full citation objects

### Codebase Note
- `analyze_document` already adds `{document_id, filename}` to `source_refs` (lines 709–710). For citations, wrap these as `is_full_doc=true` entries with `passage=null`, `chunk_index=null`.
- `match_document_chunks` RPC (SQL) returns `similarity` as cosine similarity (0–1). `keyword_search_chunks` does NOT return `similarity`. After RRF fusion, rows have `rrf_score` instead. The `similarity` key in `_enrich_with_filenames` falls back: `row.get("similarity") or row.get("rrf_score") or ...`. For confidence, only use `row.get("similarity")` (the real cosine value) — ignore RRF-only rows.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope. Phase 27 (Frontend rendering) and Phase 28 (versioning) handle next steps.

</deferred>

---

*Phase: 26-citations-confidence-backend*
*Context gathered: 2026-04-12*
