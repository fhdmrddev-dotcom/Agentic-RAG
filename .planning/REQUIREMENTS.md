# Requirements — v2.1 Stability & RAG Correctness

## Milestone Goal

Eliminate silent failures, blank responses, and correctness bugs found in post-v2.0 review.

---

## v2.1 Requirements

### Context Management (CTX)

- [x] **CTX-01**: User's conversation history is trimmed to a token budget before each LLM call, preventing context overflow on long threads
- [x] **CTX-02**: Tool result messages added during the iteration loop are trimmed atomically between iterations when total token estimate exceeds threshold
- [ ] **CTX-03**: Sub-agent document content is capped before being sent to `run_sub_agent`, preventing silent overflow on large documents with small-context models
- [ ] **CTX-04**: When the LLM returns an empty response on the force-no-tools final iteration, a fallback message is yielded to the user instead of a blank response
- [ ] **CTX-05**: When `finish_reason == "length"` occurs while assembling a tool call, an error event is emitted instead of silently abandoning the partial tool call

### RAG Correctness (RAG)

- [ ] **RAG-01**: Keyword search respects the thread's folder scope — `_keyword_search` and `keyword_search_chunks` RPC accept and apply `folder_ids`
- [ ] **RAG-02**: `read_document` tool results are subject to the same 3,000-char context cap as other tools, with a truncation note directing users to use `start_line`/`end_line`
- [ ] **RAG-03**: Document metadata (`document_type`, `language`) is lowercased at ingest time; `metadata_filter` values are lowercased before passing to the RPC

### Error Visibility (ERR)

- [ ] **ERR-01**: `APIError` responses indicating context length exceeded (status 400, message containing "context"/"maximum"/"too long") are surfaced as a clear, user-readable message rather than a silent blank response
- [ ] **ERR-02**: `load_skill` and `save_skill` tool handlers are hardened against `maybe_single()` returning `None` — errors produce an informative tool result rather than an exception

### System Prompt Quality (PROMPT)

- [ ] **PROMPT-01**: System prompt instructs the LLM to hedge confidence when `search_documents` returns results with similarity below 0.4
- [ ] **PROMPT-02**: System prompt provides structured citation guidance (document name + section) to prevent hallucinated source references

### Infrastructure (INFRA)

- [ ] **INFRA-01**: `_load_override()` caches its result with a 5-second TTL, reducing disk reads per message
- [ ] **INFRA-02**: Sentence boundary detection in `chunk_text` verifies the character following `.`/`!`/`?` is a space or end-of-string, preventing splits on abbreviations and decimals

---

## Future Requirements

- Document-level deduplication in RAG results — deferred; low user impact relative to P0/P1 fixes
- Structured citation enforcement via Pydantic output model — deferred; requires API contract change

## Out of Scope

- Dynamic model context limit mapping — hardcoded caps are sufficient for now; dynamic mapping adds complexity
- Tiktoken integration for exact token counts — char/4 heuristic is fast and accurate enough for trimming decisions
- Supabase Realtime for settings changes — polling or restart sufficient; real-time config reload adds infra complexity

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| CTX-01 | Phase 18 | — |
| CTX-02 | Phase 18 | — |
| CTX-03 | Phase 19 | — |
| CTX-04 | Phase 20 | — |
| CTX-05 | Phase 20 | — |
| RAG-01 | Phase 21 | — |
| RAG-02 | Phase 22 | — |
| RAG-03 | Phase 22 | — |
| ERR-01 | Phase 19 | — |
| ERR-02 | Phase 20 | — |
| PROMPT-01 | Phase 23 | — |
| PROMPT-02 | Phase 23 | — |
| INFRA-01 | Phase 24 | — |
| INFRA-02 | Phase 24 | — |
