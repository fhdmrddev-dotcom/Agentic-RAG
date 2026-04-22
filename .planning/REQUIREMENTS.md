# Requirements: Agentic RAG

**Defined:** 2026-04-22
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared

## v2.4 Requirements

Requirements for Stability, Polish & UX Fixes milestone. Each maps to roadmap phases.

### STREAM — SSE & Stop Reliability

- [ ] **STREAM-01**: User can stop a streaming response and the backend SSE generator cancels immediately (no linger, no "saving response…" text stuck in UI)
- [ ] **STREAM-02**: Navigating away or refreshing during an active stream disconnects gracefully without server errors (no "socket.send() raised exception" logs)
- [ ] **STREAM-03**: Partial assistant responses are persisted when stop is triggered, so the user sees their partial answer after page reload

### SKILL — Smart Skill Dispatch

- [ ] **SKILL-01**: Skill catalog injection uses relevance-based filtering — only skills whose descriptions match the user's message are included in the system prompt (not all enabled skills)
- [ ] **SKILL-02**: Skills that don't match the user's intent are never triggered, even if they exist in the catalog

### DOC — Document Management

- [ ] **DOC-01**: User can choose between "delete this version only" and "delete all versions" when deleting a document
- [ ] **DOC-02**: Deleting a single version cleans up its chunks and storage file, and promotes the next-latest version as is_latest
- [ ] **DOC-03**: Deleting all versions removes all chunks, storage files, and version history for that filename
- [ ] **DOC-04**: Root-folder documents (folder_id=null) are clearly visible in the document list and folder tree
- [ ] **DOC-05**: Upload errors display specific reasons to the user (duplicate file, unsupported type, empty file, size limit exceeded)
- [ ] **DOC-06**: Uploading to root folder works correctly with clear UX or is explicitly gated with an informative message

### CHAT — Chat UX

- [ ] **CHAT-01**: Deleting a thread shows a confirmation dialog before the delete executes
- [ ] **CHAT-02**: After deleting a thread and creating a new one, no ghost content from the deleted thread appears
- [ ] **CHAT-03**: Creating a new chat presents a folder selector to scope the thread from the start

### SETT — Web Search Toggle

- [ ] **SETT-01**: Web search has an explicit on/off toggle in Settings (like code execution and reranking), separate from API key presence
- [ ] **SETT-02**: When web search is toggled off, the web_search tool is excluded from the agent's tool set regardless of API key

### NAV — Navigation Polish

- [ ] **NAV-01**: Icon labels appear directly adjacent to their icons in the expanded sidebar (no large gap between icon and text)
- [ ] **NAV-02**: When the sidebar is collapsed, the logo icon remains visible (icon-only, no text)

### HLTH — Library Health at Scale

- [ ] **HLTH-01**: Knowledge Health dashboard uses server-side pagination instead of fixed top-10 lists
- [ ] **HLTH-02**: Low confidence panel explains that scores reflect query-document relevance, not document quality; includes context about score distribution
- [ ] **HLTH-03**: Feedback empty states use actionable, corporate-appropriate messaging (not passive phrases like "No downvoted documents")
- [ ] **HLTH-04**: Knowledge Health API accepts pagination parameters (offset/limit) and returns total counts

## v3.0 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Skills System Overhaul

- **SKILL-03**: Full skills marketplace and discovery system
- **SKILL-04**: Skill versioning and dependency management
- **SKILL-05**: Skill sharing and collaboration features

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-document PDF highlighting (F-01 v2) | Requires PDF renderer integration; citation cards sufficient for v2.2 |
| Citation export / cross-thread citation linking | Complexity vs. value; defer |
| Diff view between document versions | Nice-to-have; version history + restore covers core need |
| Per-claim confidence scoring | Too granular; response-level confidence sufficient |
| Organisation-level audit view / SIEM integration | Single-user audit sufficient; no multi-tenant yet |
| Suggestions in Explorer mode | Explorer is KB-focused tool mode; follow-ups add noise |
| Multi-tenancy / Org-level transform | Requires clarity on isolated vs co-tenant architecture and auth/billing model |
| Automatic local folder scanning/import | Phase II feature, adds complexity |
| Team-based folder sharing with access controls | Keep it simple: global or private only |
| Real-time collaboration on folders | Not needed for current use case |
| Folder-level permissions | Global folders visible to all, per-user folders private |
| Switching to Docling | Existing pypdf + python-docx pipeline is working |
| Nyquist VALIDATION.md compliance | Phase-level validation files in draft state; full compliance deferred |
| Comprehensive skills system overhaul | Planned for next milestone; this milestone only fixes dispatch relevance |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 44 | Pending |
| STREAM-02 | Phase 44 | Pending |
| STREAM-03 | Phase 44 | Pending |
| SKILL-01 | Phase 46 | Pending |
| SKILL-02 | Phase 46 | Pending |
| DOC-01 | Phase 47 | Pending |
| DOC-02 | Phase 47 | Pending |
| DOC-03 | Phase 47 | Pending |
| DOC-04 | Phase 48 | Pending |
| DOC-05 | Phase 48 | Pending |
| DOC-06 | Phase 48 | Pending |
| CHAT-01 | Phase 45 | Pending |
| CHAT-02 | Phase 45 | Pending |
| CHAT-03 | Phase 45 | Pending |
| SETT-01 | Phase 49 | Pending |
| SETT-02 | Phase 49 | Pending |
| NAV-01 | Phase 49 | Pending |
| NAV-02 | Phase 49 | Pending |
| HLTH-01 | Phase 50 | Pending |
| HLTH-02 | Phase 50 | Pending |
| HLTH-03 | Phase 50 | Pending |
| HLTH-04 | Phase 50 | Pending |

**Coverage:**
- v2.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after v2.4 roadmap created*