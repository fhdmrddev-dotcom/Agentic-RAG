# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26–32 (shipped 2026-04-16)
- 🚧 **v2.3 Memory, Multimodal & Experience** — Phases 33–43 (in progress)

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


<details>
<summary>✅ v2.2 Trust & Compliance (Phases 26–32) — SHIPPED 2026-04-16</summary>

- [x] Phase 26: Citations & Confidence — Backend (2/2 plans) — completed 2026-04-12
- [x] Phase 27: Citations & Confidence — Frontend (1/1 plans) — completed 2026-04-12
- [x] Phase 28: Document Versioning — Schema & Ingestion (2/2 plans) — completed 2026-04-12
- [x] Phase 29: Document Versioning — UI (2/2 plans) — completed 2026-04-13
- [x] Phase 30: Audit Log — Backend (2/2 plans) — completed 2026-04-14
- [x] Phase 31: Audit Log — Settings UI (2/2 plans) — completed 2026-04-14
- [x] Phase 32: Suggested Follow-Up Questions (2/2 plans) — completed 2026-04-16

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

---

### v2.3 Memory, Multimodal & Experience (In Progress)

**Milestone Goal:** Deepen the agent intelligence with persistent memory and richer document understanding, then elevate the product feel with the Deep Midnight UI redesign across chat, citations, skills, and mobile.

- [x] **Phase 33: Cross-Thread Memory — Backend** — user_memory table, remember/recall tools, automatic memory summary injection into system prompt (completed 2026-04-16)
- [x] **Phase 34: Cross-Thread Memory — Settings UI** — Memory viewer in Settings: list, edit, delete memory entries (completed 2026-04-17)
- [ ] **Phase 35: Multi-Modal Ingestion** — Extract tables (pdfplumber) and describe images (vision LLM) during PDF/DOCX ingestion; store in document_tables and document_images tables
- [ ] **Phase 36: Multi-Modal Query & Library UI** — query_tables tool for structured table queries; image descriptions in vector search; Tables/Images badge on documents
- [ ] **Phase 37: Knowledge Health Dashboard — Backend** — Metrics API from audit log: most-retrieved, never-retrieved, low-confidence, stale documents
- [ ] **Phase 38: Knowledge Health Dashboard — Frontend** — Library Health view in sidebar with action hooks (delete, re-ingest, move)
- [ ] **Phase 39: User Feedback Loop — Backend** — message_feedback table, thumbs endpoints, aggregate stats for dashboard
- [ ] **Phase 40: User Feedback Loop — Frontend** — Thumbs up/down on messages, reason selector, feedback stats in Library Health
- [ ] **Phase 41: UI Redesign — Tool Call Visualizer & Citations** — Glassmorphic upgrades to ToolCallPanel, CitationCard/CitationList; floating pill MessageInput
- [ ] **Phase 42: UI Redesign — Layout Shell & Skills** — Extract AppDock from Sidebar; 3-pane SkillsPage with tonal depth; premium glow toggles; SettingsPage tonal polish
- [ ] **Phase 43: UI Redesign — Mobile & Responsive** — Frosted overlay drawer for thread list on mobile; responsive breakpoints in ChatLayout; active-thread gradient accent
## Phase Details (v2.3)

### Phase 33: Cross-Thread Memory — Backend
**Goal**: The agent remembers key facts and preferences stated in any conversation thread and surfaces them automatically in future threads
**Depends on**: Phase 32
**Requirements**: MEM-01, MEM-03
**Success Criteria** (what must be TRUE):
  1. A user_memory table exists with RLS (INSERT/SELECT/DELETE by owner only)
  2. remember(key, value) tool stores a fact; recall(key?) retrieves all or a specific entry
  3. Top 10 most-recently updated memory entries are injected as a concise block at the start of each General Mode turn (capped ~500 tokens)
  4. Memory injection is absent in Explorer Mode
  5. Memory writes are non-blocking and do not delay the chat response
**Plans**: 2 plans
- [x] 33-01-PLAN.md — Migration 026 (user_memory table + RLS + trigger), tool constants (REMEMBER_TOOL/RECALL_TOOL), audit type extension, and 8-test unit scaffold (RED)
- [x] 33-02-PLAN.md — Memory injection block in General Mode system prompt, remember/recall tool dispatch handlers (non-blocking + audit), and test GREEN conversion
**UI hint**: no

### Phase 34: Cross-Thread Memory — Settings UI
**Goal**: Users can view, edit, and delete their memory entries from Settings
**Depends on**: Phase 33
**Requirements**: MEM-02
**Success Criteria** (what must be TRUE):
  1. A Memory section in Settings lists all entries with key, value, and created date
  2. User can edit a value inline and save it
  3. User can delete individual entries with confirmation
  4. Empty state shown with guidance when no memories exist
**Plans**: 1 plan
Plans:
- [x] 34-01-PLAN.md — MemorySection component + SettingsPage integration
**UI hint**: yes

### Phase 35: Multi-Modal Ingestion
**Goal**: Tables and images inside PDFs and DOCX files are extracted and stored during ingestion
**Depends on**: Phase 34
**Requirements**: MODAL-01, MODAL-02
**Success Criteria** (what must be TRUE):
  1. PDF ingestion extracts tables via pdfplumber; stored as JSON in document_tables (document_id, page, table_index, headers, rows)
  2. DOCX ingestion extracts tables via python-docx; same schema
  3. Embedded images above 50x50px are extracted and described by a vision LLM; stored in document_images (document_id, page, image_index, description)
  4. If extraction fails for any reason, ingestion continues without error
  5. Realtime ingestion status updates include extraction step progress
**Plans**: 3 plans
Plans:
- [ ] 035-01-PLAN.md — Migrations 018/019 (document_tables + document_images), pdfplumber install, 6 RED test stubs
- [ ] 035-02-PLAN.md — Table extraction service (extract_and_store_tables), ingest_document wired, MODAL-01 tests GREEN
- [ ] 035-03-PLAN.md — Image extraction + vision LLM wired (extract_and_store_images), all 6 tests GREEN
**UI hint**: no

### Phase 36: Multi-Modal Query & Library UI
**Goal**: The agent can query document tables and search image content; the document library surfaces extraction counts
**Depends on**: Phase 35
**Requirements**: MODAL-03
**Success Criteria** (what must be TRUE):
  1. Image descriptions are embedded and included in search_documents vector search results
  2. A query_tables tool allows the agent to query structured tables by document and optional column filter
  3. The document library shows a "Tables: N, Images: N" badge on documents where extraction produced results
  4. query_tables is listed in the General Mode system prompt tool catalog
**Plans**: TBD
**UI hint**: yes

### Phase 37: Knowledge Health Dashboard — Backend
**Goal**: A metrics API derived from the audit log exposes library health data
**Depends on**: Phase 36
**Requirements**: HLTH-01, HLTH-02, HLTH-03, HLTH-04
**Success Criteria** (what must be TRUE):
  1. GET /knowledge-health/summary returns top-10 most-retrieved, never-retrieved, low-confidence, and stale documents
  2. All metrics derived from audit_log table
  3. Returns in < 2s for libraries up to 10,000 documents
  4. RLS enforced: users only see health data for their own documents
**Plans**: TBD
**UI hint**: no

### Phase 38: Knowledge Health Dashboard — Frontend
**Goal**: Users can review library health and take action from a new Library Health view
**Depends on**: Phase 37
**Requirements**: HLTH-05
**Success Criteria** (what must be TRUE):
  1. A Library Health nav item appears in the sidebar document section
  2. Four metric panels shown: Most Retrieved, Never Retrieved, Low Confidence, Stale
  3. Each document row has Delete, Re-ingest, and Move to Folder action buttons
  4. Empty state shown per panel when no documents match
**Plans**: TBD
**UI hint**: yes

### Phase 39: User Feedback Loop — Backend
**Goal**: Users can rate any assistant response; feedback is stored and surfaced in aggregate stats
**Depends on**: Phase 38
**Requirements**: FB-01, FB-02, FB-03
**Success Criteria** (what must be TRUE):
  1. message_feedback table exists with RLS (one rating per message per user)
  2. POST /feedback accepts message_id, rating (positive/negative), optional reason enum
  3. GET /feedback/stats returns overall positive rate and top-5 most-downvoted documents (last 30 days)
  4. Feedback entries visible in the audit log viewer (action_type = message_feedback)
**Plans**: TBD
**UI hint**: no

### Phase 40: User Feedback Loop — Frontend
**Goal**: Thumbs up/down controls appear on every assistant message; stats surface in Library Health
**Depends on**: Phase 39
**Requirements**: FB-04, FB-05
**Success Criteria** (what must be TRUE):
  1. Thumbs-up and thumbs-down icons appear on hover over any completed assistant message in MessageItem
  2. On thumbs-down: inline reason selector appears (Wrong answer / Not from my documents / Incomplete / Other)
  3. Submitting feedback does not interrupt the conversation
  4. A Feedback Stats panel in Library Health shows overall positive rate and most-downvoted documents
**Plans**: TBD
**UI hint**: yes

### Phase 41: UI Redesign — Tool Call Visualizer & Citations
**Goal**: ToolCallPanel, CitationCard/CitationList, and MessageInput adopt the Deep Midnight glassmorphic aesthetic
**Depends on**: Phase 40
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. ToolCallPanel wrapper uses bg-card/80 backdrop-blur-sm; parameters block uses bg-card/50 backdrop-blur-md nested frosted window
  2. CitationCard uses ambient gradient border instead of solid border; PDF = red icon, DOCX = blue, Markdown = purple (lucide-react)
  3. CitationList expand/collapse animation is 200ms ease
  4. MessageInput renders as floating pill (rounded-2xl shadow-lg backdrop-blur-sm) at bottom of chat area
  5. All changes are additive CSS/Tailwind with no logic changes to SSE parsing or state management
**Plans**: TBD
**UI hint**: yes

### Phase 42: UI Redesign — Layout Shell & Skills
**Goal**: Nav icons extracted into AppDock; SkillsPage adopts 3-pane tonal layout; premium toggle styling across Skills and Settings
**Depends on**: Phase 41
**Requirements**: UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Nav icons (Chat, Documents, Skills, Settings, Sign Out) extracted from Sidebar into standalone AppDock component
  2. SkillsPage uses 3-pane layout (nav sidebar, skill list, skill detail/form) separated by tonal background shifts, not border-r dividers
  3. Active skill toggles glow with indigo-to-cyan gradient
  4. Skill API key/env inputs use bg-card/50 pill styling with Required/ReadOnly badges
  5. SettingsPage section dividers replaced with tonal background shifts
**Plans**: TBD
**UI hint**: yes

### Phase 43: UI Redesign — Mobile & Responsive
**Goal**: The app is fully usable on mobile with a frosted drawer navigation pattern
**Depends on**: Phase 42
**Requirements**: UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. On viewport < 768px the thread list is hidden by default; a menu button reveals it as a backdrop-blur-md frosted overlay drawer
  2. The active thread in the drawer has slightly brighter background and a left gradient accent line
  3. ChatLayout has responsive Tailwind breakpoints: sidebar hidden on mobile, full-width main on mobile
  4. MessageInput always visible as floating pill at bottom on all viewport sizes
  5. No layout regressions on desktop (>= 1024px)
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
| 31. Audit Log — Settings UI | v2.2 | 2/2 | Complete    | 2026-04-14 |
| 32. Suggested Follow-Up Questions | v2.2 | 2/2 | Complete | 2026-04-16 |
| 33. Cross-Thread Memory — Backend | v2.3 | 2/2 | Complete    | 2026-04-17 |
| 34. Cross-Thread Memory — Settings UI | v2.3 | 1/1 | Complete    | 2026-04-17 |
| 35. Multi-Modal Ingestion | v2.3 | 0/3 | Planned | |
| 36. Multi-Modal Query & Library UI | v2.3 | 0/2 | Planned | |
| 37. Knowledge Health Dashboard — Backend | v2.3 | 0/2 | Planned | |
| 38. Knowledge Health Dashboard — Frontend | v2.3 | 0/2 | Planned | |
| 39. User Feedback Loop — Backend | v2.3 | 0/2 | Planned | |
| 40. User Feedback Loop — Frontend | v2.3 | 0/2 | Planned | |
| 41. UI Redesign — Tool Call Visualizer & Citations | v2.3 | 0/1 | Planned | |
| 42. UI Redesign — Layout Shell & Skills | v2.3 | 0/1 | Planned | |
| 43. UI Redesign — Mobile & Responsive | v2.3 | 0/1 | Planned | |
