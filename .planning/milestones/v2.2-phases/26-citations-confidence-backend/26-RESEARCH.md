# Phase 26: Citations & Confidence — Backend - Research

**Researched:** 2026-04-12
**Domain:** Python/FastAPI SSE event enrichment, RAG retrieval pipeline augmentation
**Confidence:** HIGH

## Summary

Phase 26 enriches the existing SSE stream with two new event types — `citations` and `confidence` — and extends the `source_refs` JSONB column in the messages table to persist full citation objects. All decisions are locked in CONTEXT.md; no design exploration is required.

The implementation touches three files only: `retrieval_service.py` (return type change + `chunk_index` passthrough), `threads.py` (accumulation logic + new event emission), and a new SQL migration to add `chunk_index` to the `match_document_chunks` RPC return columns. The `keyword_search_chunks` RPC does not return `chunk_index` and is not changed — `chunk_index` comes from the vector RPC path or the `_enrich_with_filenames` DB lookup on `document_chunks`.

The existing `test_retrieval_service.py` has 6 pre-existing test failures (rpc_data mock rows are missing the `id` field required by `_rrf_fuse`) that must be fixed as part of this phase. The planner should scope one task to fix + extend those tests alongside the retrieval service change.

**Primary recommendation:** Make all changes in one logical wave: (1) SQL migration, (2) `retrieval_service.py` changes, (3) `threads.py` changes, (4) fix + extend unit tests.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Add `chunk_index` to `_enrich_with_filenames` return shape. Each citation entry exposes `"chunk_index": N` (integer from the `document_chunks` table). Phase 27 renders this as "Chunk N" in the citation card.

**D-02:** Retrieve `chunk_index` alongside `id` and `content` in the `_enrich_with_filenames` DB lookup — add `chunk_index` to the `.select()` on `document_chunks` if needed, or pull it from the raw row before enrichment.

**D-03:** Add `citations` event: `{"type": "citations", "citations": [<citation_object>]}`. Emitted once per turn after `sources`, before `[DONE]`, only when at least one `search_documents` or `analyze_document` call produced results.

**D-04:** Citation object shape: `{"document_id": str, "filename": str, "chunk_index": int | null, "passage": str | null, "similarity": float | null, "is_full_doc": bool}`. For `search_documents`: `is_full_doc=false`, `passage` = chunk `content`, `chunk_index` = from DB, `similarity` = vector cosine. For `analyze_document`: `is_full_doc=true`, `passage=null`, `chunk_index=null`, `similarity=null`.

**D-05:** Add `confidence` event: `{"type": "confidence", "level": "high"|"medium"|"low", "avg_similarity": float, "disclaimer": str | null}`. Emitted only when `search_documents` was called at least once. `disclaimer` non-null only when `level == "low"`.

**D-06:** `sources` event is kept unchanged for backward compatibility. `citations` and `confidence` are additive new events.

**D-07:** Emit order at turn end: `sources` → `citations` → `confidence` → title (if first turn) → `[DONE]`.

**D-08:** Modify `search_documents` to return `(list[dict], float)` — a tuple of `(enriched_results, avg_vector_similarity)`. `avg_vector_similarity` computed from raw vector `similarity` fields before RRF or reranking.

**D-09:** Hybrid mode: average `similarity` field of fused results that carry non-zero cosine similarity. Vector-only: average all returned `similarity` fields. Keyword-only (no vector results): `avg_similarity = 0.0`.

**D-10:** Confidence thresholds: `high` >= 0.7, `medium` 0.5–0.69, `low` < 0.5 (including 0.0 / zero results).

**D-11:** Multiple `search_documents` calls in one turn: accumulate all citation objects and average all similarity scores across calls for the final confidence level.

**D-12:** Disclaimer text: `"This answer is based on limited or weakly-matched evidence. Please verify with the source documents."` — included in `confidence` event payload only when `level == "low"`.

**D-13:** Extend `source_refs` in messages table to store full citation data. New shape: `[{"document_id": str, "filename": str, "chunk_index": int | null, "passage": str | null, "similarity": float | null, "is_full_doc": bool}]`. Old messages retain their existing `{document_id, filename}` shape — Phase 27 must handle both.

**D-14:** `retrieved_citations` list in `threads.py` accumulates full citation objects per turn. At turn-end, deduplicate by `(document_id, chunk_index)` before persisting and emitting.

**D-15:** `citations` event absent when zero retrieval calls produced results (no `search_documents` hits AND no `analyze_document` call in the turn).

**D-16:** `confidence` event absent when no `search_documents` call occurred in the turn.

### Claude's Discretion

- Passage truncation in the `citations` SSE payload — truncate at 400 chars in the SSE payload (full text already persisted in `source_refs`). Phase 27 requirements cap display at 400 chars with expand control.
- Internal variable naming in `threads.py`
- Whether to extract a small helper function or inline the confidence computation in `threads.py`

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope. Phase 27 (Frontend rendering) and Phase 28 (versioning) handle next steps.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CITE-01 | User can see exact retrieved passage text for each search result as a collapsible card beneath the assistant response | Passage text in `citations` event (`passage` field, truncated at 400 chars in SSE payload) |
| CITE-02 | Each citation card displays document name, section/location (if identifiable), and passage text (≤400 chars, expandable to full) | `filename` + `chunk_index` + `passage` fields in citation object |
| CITE-04 | Citation cards appear only for passages retrieved in that response turn — never for documents not retrieved | D-15: `citations` event absent when zero retrieval results |
| CITE-05 | For `analyze_document` results, user sees document name attribution only (no chunk anchor) | D-04: `is_full_doc=true`, `passage=null`, `chunk_index=null` for analyze_document |
| CONF-01 | User can see a High/Medium/Low confidence badge on every document-grounded assistant message | `confidence` event with `level` field carries the value |
| CONF-02 | Confidence badge is colour-coded: green (High ≥ 0.7), amber (Medium 0.5–0.7), red (Low < 0.5) | D-10: Thresholds embedded in confidence computation |
| CONF-03 | Low-confidence responses include a standard disclaimer | D-12: `disclaimer` field in `confidence` event when `level == "low"` |
| CONF-04 | Confidence badge does not appear on web_search, execute_code, or skill-only responses | D-16: `confidence` event absent when no `search_documents` call occurred |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| FastAPI SSE (`StreamingResponse`) | existing | Streaming `citations`/`confidence` events | Already used for all SSE events |
| Python `json` stdlib | existing | Serialize event payloads | Consistent with all other events in threads.py |
| Supabase Python client | existing | DB lookup for `chunk_index` in `_enrich_with_filenames` | Already used throughout |
| pytest + unittest.mock | existing | Unit tests for retrieval return type and threading logic | Project test framework |

No new packages are required. This phase is pure Python + SQL.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended Project Structure (no new files)
```
backend/
├── app/
│   ├── api/threads.py            # Add citations/confidence accumulation + emission
│   └── services/retrieval_service.py  # Change return type, add chunk_index passthrough
├── supabase/migrations/
│   └── 016_citations_chunk_index.sql  # New: add chunk_index to match_document_chunks RPC
└── tests/
    └── unit/test_retrieval_service.py  # Fix pre-existing failures + add new tests
```

### Pattern 1: `search_documents` Return Type Change

**What:** Change `search_documents` from `list[dict]` to `tuple[list[dict], float]`.

**When to use:** Callers in `threads.py` unpack as `results, avg_sim = search_documents(...)`. 

**Key detail:** The `@traceable(name="search-documents", run_type="retriever")` decorator from LangSmith is present on `search_documents`. LangSmith tracing wraps the return value but does not constrain its type — returning a tuple is safe. (HIGH confidence — LangSmith traceable is a pass-through decorator for return values.)

**Current call site (`threads.py` line 682):**
```python
results = search_documents(
    args["query"], current_user["id"], supabase,
    metadata_filter=metadata_filter,
    user_settings=user_settings,
    folder_ids=folder_subtree_ids,
)
```

**Updated call site:**
```python
results, avg_sim = search_documents(
    args["query"], current_user["id"], supabase,
    metadata_filter=metadata_filter,
    user_settings=user_settings,
    folder_ids=folder_subtree_ids,
)
```

### Pattern 2: `chunk_index` in `_enrich_with_filenames`

**What:** The `_enrich_with_filenames` function currently does a `.select("id, filename, metadata")` on the `documents` table — NOT on `document_chunks`. The `chunk_index` field lives on `document_chunks` rows, which arrive as the `rows` parameter.

**Critical insight:** The raw `rows` passed to `_enrich_with_filenames` already come from the RPC result. The current `match_document_chunks` RPC returns `(id, document_id, content, similarity)` — it does NOT include `chunk_index`. 

Two approaches to get `chunk_index` into enriched rows:
1. **Update the SQL RPC** to also return `chunk_index` — then `row.get("chunk_index")` works with no extra DB call.
2. **Extra DB lookup** — batch-fetch `chunk_index` from `document_chunks` by chunk `id`. More calls, more latency.

**Decision: Approach 1 is correct.** Add a SQL migration to update `match_document_chunks` to also return `chunk_index`. The `keyword_search_chunks` RPC also doesn't return `chunk_index` — since keyword results go through RRF fusion and then `_enrich_with_filenames`, the same migration pattern applies. However, D-02 says to add `chunk_index` to the `.select()` on `document_chunks` — this is the batch lookup inside `_enrich_with_filenames`. Since `_enrich_with_filenames` already queries `documents` (not `document_chunks`), the cleanest solution for both vector and keyword paths is to include `chunk_index` in the RPC returns, then pass it through `_enrich_with_filenames` via `row.get("chunk_index")`.

**Updated `_enrich_with_filenames` entry shape:**
```python
entry: dict = {
    "content": row["content"],
    "document_id": row["document_id"],
    "filename": doc.get("filename", "Unknown"),
    "chunk_index": row.get("chunk_index"),  # NEW — from RPC return
    "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
}
```

### Pattern 3: Confidence Computation

**What:** After one or more `search_documents` calls, compute `avg_vector_similarity` from accumulated raw cosine scores.

**Accumulation in `threads.py`:**
```python
# New accumulation variables alongside source_refs (line ~456)
retrieved_citations: list[dict] = []
similarity_scores: list[float] = []  # raw cosine values only (not RRF)

# At search_documents call site (updated):
results, avg_sim = search_documents(...)
if results:
    for hit in results:
        retrieved_citations.append({
            "document_id": hit["document_id"],
            "filename": hit["filename"],
            "chunk_index": hit.get("chunk_index"),
            "passage": (hit["content"][:400] if hit.get("content") else None),  # SSE truncation
            "similarity": hit.get("similarity"),
            "is_full_doc": False,
        })
    if avg_sim > 0.0:
        similarity_scores.append(avg_sim)
    # Also feed source_refs (existing behavior preserved)
    source_refs.extend(...)
```

**Confidence computation helper (inline or extracted — Claude's discretion):**
```python
def _compute_confidence(avg: float) -> str:
    if avg >= 0.7:
        return "high"
    elif avg >= 0.5:
        return "medium"
    return "low"
```

### Pattern 4: Turn-End Emission (D-07 ordering)

**Current turn-end block (`threads.py` lines ~1131–1155):**
```python
# 1. sources (existing)
if source_refs:
    unique_sources[:] = list({s["document_id"]: s for s in source_refs}.values())
    yield f"data: {json.dumps({'type': 'sources', 'sources': unique_sources})}\n\n"

# NEW 2. citations
# NEW 3. confidence

# Persist (existing)
_persist_assistant_message()

# 4. title (existing)
# 5. [DONE] (existing)
```

**New events to insert between sources and persist:**
```python
# 2. citations event
if retrieved_citations:
    # Deduplicate by (document_id, chunk_index) per D-14
    seen = set()
    unique_citations = []
    for c in retrieved_citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key)
            unique_citations.append(c)
    yield f"data: {json.dumps({'type': 'citations', 'citations': unique_citations})}\n\n"

# 3. confidence event (only when search_documents was called)
if similarity_scores:
    final_avg = sum(similarity_scores) / len(similarity_scores)
    level = _compute_confidence(final_avg)
    disclaimer = (
        "This answer is based on limited or weakly-matched evidence. "
        "Please verify with the source documents."
        if level == "low" else None
    )
    yield f"data: {json.dumps({'type': 'confidence', 'level': level, 'avg_similarity': round(final_avg, 4), 'disclaimer': disclaimer})}\n\n"
```

### Pattern 5: Persistence Extension (D-13)

**Current `_persist_assistant_message` writes `unique_sources` (the old `{document_id, filename}` shape) to `source_refs`.**

New behavior: write `unique_citations` (full citation objects) to `source_refs` when citations are present; fall back to `unique_sources` for non-RAG turns.

```python
# In _persist_assistant_message:
if unique_citations:
    row["source_refs"] = unique_citations  # full citation objects
elif unique_sources:
    row["source_refs"] = unique_sources  # backward-compat for non-RAG turns
```

`unique_citations` must be accessible in `_persist_assistant_message` — it is a nonlocal in the closure, same pattern as `unique_sources`.

### Pattern 6: `analyze_document` Citation Wrapping

**Current code (`threads.py` line 710):**
```python
source_refs.append({"document_id": doc_id, "filename": doc["filename"]})
```

**New behavior:**
```python
source_refs.append({"document_id": doc_id, "filename": doc["filename"]})
retrieved_citations.append({
    "document_id": doc_id,
    "filename": doc["filename"],
    "chunk_index": None,
    "passage": None,
    "similarity": None,
    "is_full_doc": True,
})
```

Note: `similarity_scores` is NOT appended here (D-16 — confidence event only from `search_documents`).

### Anti-Patterns to Avoid

- **Using `rrf_score` for confidence:** The confidence calculation uses raw cosine `similarity` only. Do NOT average `rrf_score` values (they are rank-fusion scores in 0.0–0.016 range, not cosine similarity).
- **Appending `similarity=0.0` rows to `similarity_scores`:** Only append `avg_sim > 0.0` to `similarity_scores` list. If keyword-only path returned no vector results, `avg_sim = 0.0` and the threshold logic would downgrade confidence wrongly from absence of vector signal rather than low similarity.
- **Emitting `confidence` for analyze_document-only turns:** D-16 is explicit — skip `confidence` event when no `search_documents` call occurred.
- **Changing `sources` event:** D-06 requires backward compatibility — `sources` event shape is unchanged.
- **Double-persisting:** `_persist_assistant_message` is idempotent (guarded by `_message_persisted`) — the `unique_citations` variable must be in scope before `finally` block runs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deduplication key | Custom hash function | `set()` of `(document_id, chunk_index)` tuples | Python set membership is O(1), simple, correct |
| Confidence rounding | Custom round logic | `round(final_avg, 4)` | Avoids 0.700000001 rendering issues in JSON |
| SSE serialization | Custom serializer | `json.dumps({...})` | Consistent with all 30+ existing events in threads.py |

---

## Common Pitfalls

### Pitfall 1: `match_document_chunks` RPC Missing `chunk_index`
**What goes wrong:** `row.get("chunk_index")` returns `None` for all vector search results because the RPC doesn't include it in its RETURNS TABLE definition.
**Why it happens:** The RPC was defined in migration 002 as `RETURNS TABLE (id uuid, document_id uuid, content text, similarity float)` — no `chunk_index`.
**How to avoid:** Create migration `016_citations_chunk_index.sql` using `CREATE OR REPLACE FUNCTION match_document_chunks(...)` to add `chunk_index integer` to the RETURNS TABLE and `dc.chunk_index` to the SELECT.
**Warning signs:** All citation objects have `chunk_index: null` for `search_documents` results.

### Pitfall 2: Pre-Existing Test Failures in `test_retrieval_service.py`
**What goes wrong:** 6 of the existing retrieval tests fail before any Phase 26 changes because the mock `rpc_data` rows are missing the `"id"` key required by `_rrf_fuse` (hybrid search path). When `hybrid_search_enabled` is True (the default in test config), the function hits `_rrf_fuse` which does `row["id"]` and raises `KeyError`.
**Why it happens:** Tests were written assuming vector-only path; default settings now enable hybrid.
**How to avoid:** Fix test mocks to include `"id"` in `rpc_data` entries AND add a `UserEffectiveSettings` mock with `hybrid_search_enabled=False` when testing vector-only behavior, OR mock the settings to disable hybrid.
**Warning signs:** Running `pytest tests/unit/test_retrieval_service.py` shows 6 failures before any code changes.

### Pitfall 3: `similarity_scores` vs `avg_sim` Confusion
**What goes wrong:** Developer appends each individual chunk's similarity score to `similarity_scores` instead of the per-call average returned from `search_documents`.
**Why it happens:** The return value is `avg_vector_similarity` (one float per `search_documents` call), not per-chunk scores. Per-chunk scores average correctly at the service level; the threads.py level averages per-call averages.
**How to avoid:** D-11 is clear: average all `avg_sim` values returned across multiple `search_documents` calls. The service computes the per-call average; threads.py averages the per-call averages.

### Pitfall 4: `unique_citations` Scope in `_persist_assistant_message`
**What goes wrong:** `_persist_assistant_message` is defined as a nested function before `retrieved_citations`/`unique_citations` are populated. Using `nonlocal` for `unique_citations` would work but it isn't declared until after emission.
**Why it happens:** `unique_citations` is a local variable constructed at emission time (turn-end), not a mutable list like `source_refs`.
**How to avoid:** Declare `retrieved_citations: list[dict] = []` at the same scope as `source_refs` (line ~456). Build `unique_citations` at turn-end before calling `_persist_assistant_message`. Since `_persist_assistant_message` captures `retrieved_citations` as a nonlocal closure variable (read-only reference), it can read the built list. Alternatively, store the deduped list back into a `unique_citations` variable in the outer scope and reference it in the closure.

### Pitfall 5: Passage Truncation Asymmetry
**What goes wrong:** SSE payload truncates passage at 400 chars, but `source_refs` (persisted) stores the full text. If the code truncates before persisting, reloaded conversations lose passage text.
**Why it happens:** Truncation applied to the wrong scope.
**How to avoid:** Build citation objects with full `content` for `source_refs` persistence. For the `citations` SSE event payload, truncate in the emission loop (not in `retrieved_citations`). Use separate variables or slice at emit time:
  ```python
  # SSE payload: truncated
  sse_citation = {**c, "passage": (c["passage"][:400] if c.get("passage") else None)}
  ```
  Actually, since D-13 stores `retrieved_citations` in `source_refs` and the passage lives there, truncation should happen only in the SSE payload. The `retrieved_citations` list should store full text; the SSE emission truncates on the fly.

---

## Code Examples

### SQL Migration: Add `chunk_index` to `match_document_chunks`
```sql
-- Migration 016: Add chunk_index to match_document_chunks RPC for citations
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold float DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL,
  p_folder_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, similarity float, chunk_index integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content,
         1 - (dc.embedding <=> query_embedding) AS similarity,
         dc.chunk_index
  FROM document_chunks dc
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (metadata_filter IS NULL OR dc.id IN (
          SELECT dci.id FROM document_chunks dci
          JOIN documents d ON d.id = dci.document_id
          WHERE d.metadata @> metadata_filter))
    AND (p_folder_ids IS NULL OR dc.document_id IN (
          SELECT id FROM documents WHERE folder_id = ANY(p_folder_ids)))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```
Note: The production RPC may already have `metadata_filter` and `p_folder_ids` parameters added by prior migrations not in git. The migration should use `CREATE OR REPLACE` and preserve all existing parameters. Check live Supabase schema before applying.

### `search_documents` Return Type Change
```python
@traceable(name="search-documents", run_type="retriever")
def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None = None,
    user_settings: UserEffectiveSettings | None = None,
    folder_ids: list[str] | None = None,
) -> tuple[list[dict], float]:  # CHANGED: returns (results, avg_vector_similarity)
    ...
    if not hybrid_enabled:
        rows = _vector_search(...)
        avg_sim = _avg_cosine(rows)  # helper: mean of row["similarity"]
        return _enrich_with_filenames(rows, supabase), avg_sim

    # hybrid path
    vector_rows = _vector_search(...)
    keyword_rows = _keyword_search(...)
    if not vector_rows and not keyword_rows:
        return [], 0.0
    
    avg_sim = _avg_cosine(vector_rows)  # compute before fusion
    fused = _rrf_fuse(vector_rows, keyword_rows, ...)
    candidates = fused[:max(top_k, rerank_top_n)]
    ...
    return _enrich_with_filenames(candidates, supabase), avg_sim
```

### `_avg_cosine` helper (inline or extracted)
```python
def _avg_cosine(rows: list[dict]) -> float:
    """Average cosine similarity from vector search rows. Returns 0.0 if no rows."""
    sims = [row["similarity"] for row in rows if row.get("similarity") and row["similarity"] > 0]
    return sum(sims) / len(sims) if sims else 0.0
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `source_refs` stores `{document_id, filename}` | Extended to full citation objects after Phase 26 | Phase 26 | Phase 27 must handle both shapes for message reload |
| `search_documents` returns `list[dict]` | Returns `tuple[list[dict], float]` after Phase 26 | Phase 26 | All call sites in threads.py need unpacking update |

**Note:** Only one call site for `search_documents` exists in `threads.py` (line 682). No other files call `search_documents` except tests.

---

## Open Questions

1. **Live `match_document_chunks` RPC signature**
   - What we know: Migration 002 defined the RPC with 4 parameters. The retrieval service calls it with `metadata_filter` and `p_folder_ids` params (lines 34–43 of retrieval_service.py) — these were added by later migrations not in git.
   - What's unclear: The exact current live RPC signature in Supabase may already have more parameters than migration 002 shows. Migration 016 must preserve those.
   - Recommendation: The SQL migration should use `CREATE OR REPLACE FUNCTION` matching the live signature. The implementer should verify in Supabase SQL editor before applying: `\df match_document_chunks` or `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'match_document_chunks';`

2. **`keyword_search_chunks` `chunk_index` field**
   - What we know: `keyword_search_chunks` returns `(id, document_id, content, rank)` — no `chunk_index`. After RRF fusion, rows that came only from keyword path will have `chunk_index=None` in enriched output.
   - What's unclear: Is this acceptable for Phase 26, or should keyword-path chunks also carry `chunk_index`?
   - Recommendation: Acceptable per CONTEXT.md — D-02 says to pull `chunk_index` from the raw row or via DB lookup. For keyword-only rows, `chunk_index` will be `None`. Phase 27 renders `None` as no location indicator. This is fine for v2.2.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tools (Python, pytest, FastAPI, Supabase) already present in the project venv.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (installed in venv) |
| Config file | none (pytest discovers tests/ automatically) |
| Quick run command | `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/test_retrieval_service.py -v` |
| Full suite command | `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CITE-01 | `search_documents` returns passage text in enriched results | unit | `pytest tests/unit/test_retrieval_service.py -k "passage"` | ❌ Wave 0 |
| CITE-02 | Citation object has `document_id`, `filename`, `chunk_index`, `passage` fields | unit | `pytest tests/unit/test_retrieval_service.py -k "chunk_index"` | ❌ Wave 0 |
| CITE-04 | `citations` event absent when no retrieval results | unit | `pytest tests/unit/test_citations_confidence.py -k "no_citations_when_no_results"` | ❌ Wave 0 |
| CITE-05 | analyze_document produces `is_full_doc=true` citation with null passage/chunk_index | unit | `pytest tests/unit/test_citations_confidence.py -k "analyze_document_citation"` | ❌ Wave 0 |
| CONF-01/02 | Confidence level computed correctly from avg similarity | unit | `pytest tests/unit/test_citations_confidence.py -k "confidence"` | ❌ Wave 0 |
| CONF-03 | Disclaimer present when level==low, absent otherwise | unit | `pytest tests/unit/test_citations_confidence.py -k "disclaimer"` | ❌ Wave 0 |
| CONF-04 | `confidence` event absent for non-search_documents turns | unit | `pytest tests/unit/test_citations_confidence.py -k "no_confidence_non_rag"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_retrieval_service.py -v`
- **Per wave merge:** `pytest tests/unit/ -v`
- **Phase gate:** Full unit suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_citations_confidence.py` — unit tests for confidence computation logic and emission conditions (CITE-04, CITE-05, CONF-01–04)
- [ ] Fix `tests/unit/test_retrieval_service.py` — add `"id"` field to existing mock `rpc_data` entries; update return-type assertions for new `(list, float)` signature

---

## Project Constraints (from CLAUDE.md)

- Python backend must use a `venv` virtual environment — all test/run commands use `source venv/Scripts/activate`
- No LangChain, no LangGraph — raw SDK calls only (no new frameworks introduced in this phase)
- Use Pydantic for structured LLM outputs — not applicable to this phase (no new LLM output schemas)
- All tables need Row-Level Security — not applicable (no new tables in this phase)
- Stream chat responses via SSE — `citations` and `confidence` events follow existing `yield f"data: {json.dumps(...)}\n\n"` pattern
- Module 2+ uses stateless completions — store and send chat history yourself (citation data stored in `source_refs` JSONB column, consistent with existing pattern)

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `backend/app/services/retrieval_service.py` — full function signatures, return types, current enrichment logic
- Direct code inspection: `backend/app/api/threads.py` lines 456–460 (variable initialization), 680–695 (search_documents call site), 1131–1155 (turn-end emission block), 461–485 (_persist_assistant_message)
- Direct code inspection: `backend/supabase/migrations/002_module2_byo_retrieval.sql` — `match_document_chunks` RPC return signature confirmed: `(id, document_id, content, similarity)` — NO `chunk_index`
- Direct code inspection: `backend/tests/unit/test_retrieval_service.py` — pre-existing 6 failures confirmed via `pytest` run

### Secondary (MEDIUM confidence)
- `.planning/phases/26-citations-confidence-backend/26-CONTEXT.md` — all implementation decisions locked by user

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing patterns verified by code inspection
- Architecture: HIGH — exact line numbers confirmed by reading source files, no speculation
- Pitfalls: HIGH — pre-existing test failures confirmed by running pytest; RPC gap confirmed by migration SQL inspection
- SQL migration: MEDIUM — current live RPC signature may differ from migration 002 (later migrations added params not in git)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable domain — Python, FastAPI, Supabase)
