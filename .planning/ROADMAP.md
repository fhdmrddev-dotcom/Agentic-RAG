# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)
- 🚧 **v2.2 Trust & Compliance** — Phases 26–32 (in progress)

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

<details>
<summary>✅ v2.1 Stability & RAG Correctness (Phases 18–25) — SHIPPED 2026-04-11</summary>

- [x] Phase 18: Context Window Hardening (1/1 plans) — completed 2026-04-09
- [x] Phase 19: Sub-Agent Guards & API Error Visibility (1/1 plans) — completed 2026-04-10
- [x] Phase 20: Blank Response Guards (1/1 plans) — completed 2026-04-10
- [x] Phase 21: Keyword Search Folder Scope (1/1 plans) — completed 2026-04-10
- [x] Phase 22: RAG Correctness Fixes (1/1 plans) — completed 2026-04-10
- [x] Phase 23: System Prompt Quality (1/1 plans) — completed 2026-04-10
- [x] Phase 24: Infrastructure Hardening (1/1 plans) — completed 2026-04-10
- [x] Phase 25: Sub-Agent Intelligence & Model-Aware Context (1/1 plans) — completed 2026-04-10

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

---

### v2.2 Trust & Compliance (In Progress)

**Milestone Goal:** Make answers verifiable and auditable — surface retrieved evidence, confidence signals, document version provenance, usage trails, and contextual follow-up suggestions.

- [x] **Phase 26: Citations & Confidence — Backend** — Enrich SSE stream with citation passages and confidence scores; extend data model (completed 2026-04-12)
- [x] **Phase 27: Citations & Confidence — Frontend** — Render citation cards and confidence badge in chat UI (completed 2026-04-12)
- [x] **Phase 28: Document Versioning — Schema & Ingestion** — Migration for version tracking, re-upload creates new version, stale chunks retired, citation includes version number (completed 2026-04-12)
- [x] **Phase 29: Document Versioning — UI** — Version badges, history expansion, restore action in document library (completed 2026-04-13)
- [x] **Phase 30: Audit Log — Backend** — `audit_log` table with RLS, async fire-and-forget writes for all significant actions (completed 2026-04-14)
- [ ] **Phase 31: Audit Log — Settings UI** — Audit log viewer in Settings with filters, pagination, and CSV export
- [ ] **Phase 32: Suggested Follow-Up Questions** — Cheap-model generation post-response, new SSE event type, clickable pill buttons in chat

## Phase Details

### Phase 26: Citations & Confidence — Backend
**Goal**: Every RAG response carries structured citation passages and a computed confidence score delivered via SSE
**Depends on**: Phase 25
**Requirements**: CITE-01, CITE-02, CITE-04, CITE-05, CONF-01, CONF-02, CONF-03, CONF-04
**Success Criteria** (what must be TRUE):
  1. Each RAG response SSE stream includes a `citations` event containing passage text, document name, and location for every retrieved chunk used in that turn
  2. The `citations` event is absent for turns that used no RAG retrieval (web search, code execution, skill-only responses)
  3. For `analyze_document` responses the citation payload contains document name only (no chunk anchor)
  4. A `confidence` field is included in the SSE stream with one of three values (high/medium/low) derived from average retrieval similarity scores
  5. Low-confidence responses include the standard disclaimer text in the SSE payload
**Plans:** 2/2 plans complete
Plans:
- [x] 26-01-PLAN.md — SQL migration + retrieval_service return type change (chunk_index, avg_similarity)
- [x] 26-02-PLAN.md — Citation accumulation, confidence scoring, SSE events in threads.py
**UI hint**: yes

### Phase 27: Citations & Confidence — Frontend
**Goal**: Users can read the retrieved evidence and confidence level for each assistant response directly in the chat UI
**Depends on**: Phase 26
**Requirements**: CITE-03
**Success Criteria** (what must be TRUE):
  1. Citation passages appear as collapsible cards beneath the assistant message, visually distinct from the AI-generated prose (quoted block style with different background)
  2. Each citation card shows document name and passage text (truncated to 400 chars with an expand control for full text)
  3. A colour-coded confidence badge (green/amber/red) appears on every document-grounded message and is absent on non-RAG messages
  4. A Low-confidence disclaimer is rendered beneath the assistant response text when the badge is red
**Plans**: TBD
**UI hint**: yes

### Phase 28: Document Versioning — Schema & Ingestion
**Goal**: Re-uploading a file with the same name creates a new tracked version rather than failing deduplication, and old chunks are immediately retired from retrieval
**Depends on**: Phase 27
**Requirements**: VER-01, VER-02, VER-06
**Success Criteria** (what must be TRUE):
  1. Uploading a file whose name matches an existing document succeeds and creates a new version record rather than being rejected as a duplicate
  2. Chunks from the previous version are excluded from all vector and keyword retrieval immediately after the new version finishes ingesting
  3. Citation cards for answers citing a versioned document display the version number alongside the document name (e.g., "Report.pdf (v2)")
**Plans:** 2/2 plans complete
Plans:
- [x] 28-01-PLAN.md — SQL migration (version_number, is_latest, RPC filters) + upload endpoint versioning logic
- [x] 28-02-PLAN.md — version_number propagation through retrieval pipeline + CitationCard rendering

### Phase 29: Document Versioning — UI
**Goal**: Users can see which documents have been updated, browse their version history, and restore an older version as active
**Depends on**: Phase 28
**Requirements**: VER-03, VER-04, VER-05
**Success Criteria** (what must be TRUE):
  1. Documents with more than one version display a version badge (e.g., "v3") in the document library
  2. Expanding a document row reveals a version history list showing version number, upload date, and file size for each version
  3. User can click a restore action on any historical version to make it the active version
**Plans**: TBD
**UI hint**: yes

### Phase 30: Audit Log — Backend
**Goal**: All significant user actions are silently and immutably recorded in an append-only `audit_log` table without impacting any user-facing operation
**Depends on**: Phase 29
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-06
**Success Criteria** (what must be TRUE):
  1. Document upload, document delete, search query, code execution, skill load, thread create, thread delete, and settings change each produce an audit entry automatically
  2. Search query audit entries include the query text and the IDs of documents returned in the result set
  3. No API endpoint allows a user to delete or modify their own audit entries — the RLS policy permits INSERT only
  4. Audit writes never block a chat response or ingestion operation — they fire asynchronously with no awaited result
**Plans:** 2/2 plans complete
Plans:
- [x] 30-01-PLAN.md — SQL migration (audit_log table, CHECK constraint, RLS) + audit_service.py + unit tests
- [x] 30-02-PLAN.md — Instrument 8 action types across documents.py, threads.py, settings.py

### Phase 31: Audit Log — Settings UI
**Goal**: Users can review and export their own audit history from the Settings page
**Depends on**: Phase 30
**Requirements**: AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. A new Audit Log section in Settings displays the user's audit entries in a paginated table
  2. The table can be filtered by date range and by action type
  3. An Export CSV button downloads the currently filtered audit log as a well-formed CSV file
**Plans**: TBD
**UI hint**: yes

### Phase 32: Suggested Follow-Up Questions
**Goal**: Users see 2–3 contextually relevant follow-up question pills after each assistant response, generated non-blockingly
**Depends on**: Phase 31
**Requirements**: SUG-01, SUG-02, SUG-03, SUG-04
**Success Criteria** (what must be TRUE):
  1. After each assistant response completes, 2–3 clickable pill buttons appear beneath the message within 2 seconds
  2. Clicking a pill populates the chat input with that question text and immediately submits it
  3. If suggestion generation fails for any reason, the main response is unaffected and no pills appear
  4. Suggestions are absent in Explorer mode
**Plans**: TBD
**UI hint**: yes

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
| 18. Context Window Hardening | v2.1 | 1/1 | Complete | 2026-04-09 |
| 19. Sub-Agent Guards & API Error Visibility | v2.1 | 1/1 | Complete | 2026-04-10 |
| 20. Blank Response Guards | v2.1 | 1/1 | Complete | 2026-04-10 |
| 21. Keyword Search Folder Scope | v2.1 | 1/1 | Complete | 2026-04-10 |
| 22. RAG Correctness Fixes | v2.1 | 1/1 | Complete | 2026-04-10 |
| 23. System Prompt Quality | v2.1 | 1/1 | Complete | 2026-04-10 |
| 24. Infrastructure Hardening | v2.1 | 1/1 | Complete | 2026-04-10 |
| 25. Sub-Agent Intelligence & Model-Aware Context | v2.1 | 1/1 | Complete | 2026-04-10 |
| 26. Citations & Confidence — Backend | v2.2 | 2/2 | Complete    | 2026-04-12 |
| 27. Citations & Confidence — Frontend | v2.2 | 1/1 | Complete    | 2026-04-12 |
| 28. Document Versioning — Schema & Ingestion | v2.2 | 2/2 | Complete    | 2026-04-12 |
| 29. Document Versioning — UI | v2.2 | 1/2 | Complete    | 2026-04-13 |
| 30. Audit Log — Backend | v2.2 | 2/2 | Complete    | 2026-04-14 |
| 31. Audit Log — Settings UI | v2.2 | 0/? | Not started | - |
| 32. Suggested Follow-Up Questions | v2.2 | 0/? | Not started | - |
