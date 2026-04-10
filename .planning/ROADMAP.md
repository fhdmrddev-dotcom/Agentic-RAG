# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- 🔄 **v2.1 Stability & RAG Correctness** — Phases 18–24 (in progress)

## Phases

<details>
<summary>✅ v1.0 Knowledge Base Explorer (Phases 1–8) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Folder Schema & Core APIs (2/2 plans) — completed 2026-03-21
- [x] Phase 2: Document-Folder Integration (2/2 plans) — completed 2026-03-21
- [x] Phase 3: Ingestion UI (3/3 plans) — completed 2026-03-21
- [x] Phase 4: Navigation Tools (2/2 plans) — completed 2026-03-22
- [x] Phase 5: Search Tools (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Read Tool (2/2 plans) — completed 2026-03-22
- [x] Phase 7: Explorer Sub-Agent (2/2 plans) — completed 2026-03-22
- [x] Phase 8: Folder System Enhancements (3/3 plans) — completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Agent Skills & Code Execution (Phases 9–17) — SHIPPED 2026-04-04</summary>

- [x] Phase 9: Persistent Tool Memory — store tool_call_id + reconstruct multi-turn history (completed 2026-03-29)
- [x] Phase 10: Agent Skills Core — DB schema, RLS, FastAPI router, Supabase Storage bucket (completed 2026-03-31)
- [x] Phase 11: Skills LLM Integration — catalog injection, load_skill / save_skill / read_skill_file tools + dispatch (completed 2026-04-01)
- [x] Phase 12: Skills UI — Skills tab (CRUD, toggle, share), skill-creator seed skill (completed 2026-04-02)
- [x] Phase 13: Skills Open Standard — ZIP import/export (agentskills.io format) (completed 2026-04-02)
- [x] Phase 14: Code Execution Sandbox — Docker session manager, execute_code tool, SSE streaming, DB tables (completed 2026-04-03)
- [x] Phase 15: Code Output UI — streaming output panel, file download links (completed 2026-04-03)
- [x] Phase 16: Skill File Management UI — upload/list/delete files on skills (closes FILE-01, FILE-02) (completed 2026-04-04)
- [x] Phase 17: Tech Debt Cleanup — fix system prompt tool count, stale checkboxes, Phase 15 verification (completed 2026-04-04)

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v2.1 Stability & RAG Correctness (Phases 18–24)

- [x] **Phase 18: Context Window Hardening** — Rolling token budget trimming before each LLM call + atomic inter-iteration trim (completed 2026-04-09)
- [x] **Phase 19: Sub-Agent Guards & API Error Visibility** — "maximum" keyword added to APIError detection; sub-agent content cap confirmed (completed 2026-04-10)
- [x] **Phase 20: Blank Response Guards** — Force-no-tools empty content fallback + length finish_reason error event + maybe_single hardening (completed 2026-04-10)
- [x] **Phase 21: Keyword Search Folder Scope** — `_keyword_search` and `keyword_search_chunks` RPC accept and apply folder_ids (completed 2026-04-10)
- [x] **Phase 22: RAG Correctness Fixes** — read_document 3k cap + metadata case normalization at ingest and search (completed 2026-04-10)
- [x] **Phase 23: System Prompt Quality** — Similarity confidence hedging + citation format guidance (completed 2026-04-10)
- [x] **Phase 24: Infrastructure Hardening** — Settings file 5s TTL cache + sentence boundary punctuation fix (completed 2026-04-10)
- [ ] **Phase 25: Sub-Agent Intelligence & Model-Aware Context** — Auto sub-agent model per provider + provider-aware context budgets + JSON token estimation fix

---

## Phase Details

### Phase 18: Context Window Hardening
**Goal**: Long conversations never overflow the LLM context window silently — the agent trims its own history to fit before every call
**Depends on**: Phase 17
**Requirements**: CTX-01, CTX-02
**Success Criteria** (what must be TRUE):
  1. A conversation exceeding the token budget has older messages removed before the next LLM call, and the call succeeds
  2. Tool result messages added during an iteration loop are trimmed atomically (entire request/response pairs removed together) when the estimate exceeds threshold
  3. A trimmed conversation never splits a tool call from its paired tool result
  4. The trimming logic is covered by unit tests that verify token estimates and removal boundaries
**Plans**: 1 plan
Plans:
- [x] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 19: Sub-Agent Guards & API Error Visibility
**Goal**: Context overflow failures on sub-agents and API calls produce clear user-facing errors rather than silent blank responses
**Depends on**: Phase 18
**Requirements**: CTX-03, ERR-01
**Success Criteria** (what must be TRUE):
  1. When `analyze_document` is called on a document exceeding the sub-agent context cap, the tool result contains an informative message rather than an OpenAI API error
  2. When the LLM returns an APIError with status 400 and a message containing "context", "maximum", or "too long", the SSE stream emits a user-readable error event
  3. The user sees a visible error message in the chat UI (not a blank response) when context length is exceeded
  4. Sub-agent content cap is enforced before the API call is made, not after
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 20: Blank Response Guards
**Goal**: The agent never delivers a blank message — every terminal state produces visible output or a clear error
**Depends on**: Phase 19
**Requirements**: CTX-04, CTX-05, ERR-02
**Success Criteria** (what must be TRUE):
  1. When the force-no-tools final iteration returns an empty content string, a fallback message is yielded to the user
  2. When `finish_reason == "length"` occurs while assembling a streaming tool call, an error SSE event is emitted and the partial tool call is discarded cleanly
  3. When `load_skill` or `save_skill` calls `maybe_single()` and receives `None`, the handler returns an informative tool result string rather than raising an exception
  4. All three guard paths are covered by unit tests that verify the fallback output
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 21: Keyword Search Folder Scope
**Goal**: Keyword search respects folder scope the same way vector search does — folder-scoped threads return only keyword results from within the scoped subtree
**Depends on**: Phase 17
**Requirements**: RAG-01
**Success Criteria** (what must be TRUE):
  1. `_keyword_search` in Python accepts a `folder_ids` parameter and passes it to the RPC
  2. The `keyword_search_chunks` Supabase RPC accepts a `folder_ids` parameter and filters results to documents in those folders
  3. A folder-scoped thread chat returns keyword search hits only from documents inside the scoped folder subtree
  4. A Supabase migration file exists for the updated RPC and can be applied cleanly to the existing schema
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 22: RAG Correctness Fixes
**Goal**: Document retrieval results are correctly bounded and metadata filtering is case-insensitive end-to-end
**Depends on**: Phase 21
**Requirements**: RAG-02, RAG-03
**Success Criteria** (what must be TRUE):
  1. `read_document` results are capped at 3,000 characters with a truncation note directing users to use `start_line`/`end_line` for the rest
  2. Metadata fields `document_type` and `language` are lowercased at ingest time before storage
  3. `metadata_filter` values are lowercased before being passed to the search RPC, so a filter of `"PDF"` matches documents stored as `"pdf"`
  4. A unit test verifies the lowercasing occurs at both the ingest and search call sites
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 23: System Prompt Quality
**Goal**: The LLM is guided to hedge low-confidence answers and cite sources in a structured format, reducing hallucinated references
**Depends on**: Phase 17
**Requirements**: PROMPT-01, PROMPT-02
**Success Criteria** (what must be TRUE):
  1. The system prompt contains an instruction to hedge when `search_documents` returns results with similarity below 0.4
  2. The system prompt contains structured citation guidance specifying document name and section format
  3. The updated system prompt does not break existing tool descriptions or mode-specific instructions
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

### Phase 24: Infrastructure Hardening
**Goal**: Settings file reads are cached to reduce per-message disk I/O, and sentence boundary detection correctly handles abbreviations and decimal numbers
**Depends on**: Phase 17
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. `_load_override()` returns a cached result on repeated calls within 5 seconds, making only one disk read per TTL window
  2. After 5 seconds the cache is invalidated and the next call re-reads from disk
  3. `chunk_text` does not split on `.` when the following character is not a space or end-of-string (e.g., abbreviations like "Dr.", decimals like "3.14")
  4. A unit test verifies that "e.g.", "3.14", and "U.S.A." are not treated as sentence boundaries
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — Verify trim integration + add comprehensive unit tests

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Folder Schema & Core APIs | v1.0 | 2/2 | Complete | 2026-03-21 |
| 2. Document-Folder Integration | v1.0 | 2/2 | Complete | 2026-03-21 |
| 3. Ingestion UI | v1.0 | 3/3 | Complete | 2026-03-21 |
| 4. Navigation Tools | v1.0 | 2/2 | Complete | 2026-03-22 |
| 5. Search Tools | v1.0 | 2/2 | Complete | 2026-03-21 |
| 6. Read Tool | v1.0 | 2/2 | Complete | 2026-03-22 |
| 7. Explorer Sub-Agent | v1.0 | 2/2 | Complete | 2026-03-22 |
| 8. Folder System Enhancements | v1.0 | 3/3 | Complete | 2026-03-28 |
| 9. Persistent Tool Memory | v2.0 | 1/1 | Complete | 2026-03-29 |
| 10. Agent Skills Core | v2.0 | 3/3 | Complete | 2026-03-31 |
| 11. Skills LLM Integration | v2.0 | 3/3 | Complete | 2026-04-01 |
| 12. Skills UI | v2.0 | 3/3 | Complete | 2026-04-02 |
| 13. Skills Open Standard | v2.0 | 2/2 | Complete | 2026-04-02 |
| 14. Code Execution Sandbox | v2.0 | 5/5 | Complete | 2026-04-03 |
| 15. Code Output UI | v2.0 | 2/2 | Complete | 2026-04-03 |
| 16. Skill File Management UI | v2.0 | 2/2 | Complete | 2026-04-04 |
| 17. Tech Debt Cleanup | v2.0 | 1/1 | Complete | 2026-04-04 |
| 18. Context Window Hardening | v2.1 | 1/1 | Complete   | 2026-04-09 |
| 19. Sub-Agent Guards & API Error Visibility | v2.1 | 0/? | Not started | - |
| 20. Blank Response Guards | v2.1 | 0/? | Not started | - |
| 21. Keyword Search Folder Scope | v2.1 | 0/? | Not started | - |
| 22. RAG Correctness Fixes | v2.1 | 0/? | Not started | - |
| 23. System Prompt Quality | v2.1 | 0/? | Not started | - |
| 24. Infrastructure Hardening | v2.1 | 0/? | Not started | - |
