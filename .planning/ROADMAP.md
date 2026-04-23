# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26–32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33–43 (shipped 2026-04-19)
- 🚧 **v2.4 Stability, Polish & UX Fixes** — Phases 44–51 (in progress)

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

- [x] Phase 9: Persistent Tool Memory (1/1 plans) — completed 2026-03-29
- [x] Phase 10: Agent Skills Core (3/3 plans) — completed 2026-03-31
- [x] Phase 11: Skills LLM Integration (3/3 plans) — completed 2026-04-01
- [x] Phase 12: Skills UI (3/3 plans) — completed 2026-04-02
- [x] Phase 13: Skills Open Standard (2/2 plans) — completed 2026-04-02
- [x] Phase 14: Code Execution Sandbox (5/5 plans) — completed 2026-04-03
- [x] Phase 15: Code Output UI (2/2 plans) — completed 2026-04-03
- [x] Phase 16: Skill File Management UI (2/2 plans) — completed 2026-04-04
- [x] Phase 17: Tech Debt Cleanup (1/1 plans) — completed 2026-04-04

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

<details>
<summary>✅ v2.3 Memory, Multimodal & Experience (Phases 33–43) — SHIPPED 2026-04-19</summary>

- [x] Phase 33: Cross-Thread Memory — Backend (2/2 plans) — completed 2026-04-17
- [x] Phase 34: Cross-Thread Memory — Settings UI (1/1 plans) — completed 2026-04-17
- [x] Phase 35: Multi-Modal Ingestion (4/4 plans) — completed 2026-04-18
- [x] Phase 36: Multi-Modal Query & Library UI (3/3 plans) — completed 2026-04-18
- [x] Phase 37: Knowledge Health Dashboard — Backend (2/2 plans) — completed 2026-04-18
- [x] Phase 38: Knowledge Health Dashboard — Frontend (2/2 plans) — completed 2026-04-18
- [x] Phase 39: User Feedback Loop — Backend (2/2 plans) — completed 2026-04-18
- [x] Phase 40: User Feedback Loop — Frontend (2/2 plans) — completed 2026-04-19
- [x] Phase 41: UI Redesign — Tool Call Visualizer & Citations (2/2 plans) — completed 2026-04-19
- [x] Phase 42: UI Redesign — Layout Shell & Skills (3/3 plans) — completed 2026-04-19
- [x] Phase 43: UI Redesign — Mobile & Responsive (3/3 plans) — completed 2026-04-19

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

### 🚧 v2.4 Stability, Polish & UX Fixes (In Progress)

**Milestone Goal:** Fix critical bugs (SSE disconnects, skill over-triggering, ghost chats) and polish UX gaps to bring the app to production quality.

- [x] **Phase 44: SSE & Stop Reliability** — Streaming stops instantly, disconnects cleanly, partial responses are preserved (1/1 plans) — completed 2026-04-23
- [x] **Phase 45: Chat UX Fixes** — Confirmation dialogs, no ghost content, folder-scoped new chats (2/2 plans) — completed 2026-04-23
- [ ] **Phase 46: Smart Skill Dispatch** — Only relevant skills appear in the agent's context
  - [ ] 46-01-PLAN.md — Skill embedding infrastructure (RPC migration, config, CRUD hooks, backfill)
  - [ ] 46-02-PLAN.md — Skill dispatch in chat stream (matching, tool filtering, graceful fallback)
- [ ] **Phase 47: Document Version Deletion** — Choose to delete one version or all, with proper cleanup
- [ ] **Phase 48: Document List & Upload Polish** — Root documents visible, upload errors clear, root upload works
- [ ] **Phase 49: Settings & Navigation Polish** — Web search toggle in settings, sidebar icon/logo alignment
- [ ] **Phase 50: Library Health at Scale** — Paginated health dashboard, accurate labels, actionable empty states
- [ ] **Phase 51: Context Window Management** — Per-model context limits, task-complexity routing for sub-agents, configurable settings UI with inline model documentation
  - [ ] 051-01-PLAN.md — Test stubs (Wave 0: failing tests for all CTX requirements)
  - [ ] 051-02-PLAN.md — Sub-agent keyword routing (CTX-01, CTX-02)
  - [ ] 051-03-PLAN.md — tiktoken upgrade for OpenAI token estimation (CTX-05)
  - [ ] 051-04-PLAN.md — Settings stack for sub_agent_max_output_tokens (CTX-03)
  - [ ] 051-05-PLAN.md — Model info cards in chat model selector (CTX-04)
  - [ ] 051-06-PLAN.md — Gap closure: sub_agent_model override settings stack (CTX-03)
  - [ ] 051-07-PLAN.md — Gap closure: cost tier in model info cards (CTX-04)

## Phase Details

### Phase 44: SSE & Stop Reliability
**Goal**: Streaming responses stop immediately when the user clicks stop, disconnects are handled gracefully, and partial responses are never lost
**Depends on**: Nothing (first phase — core reliability)
**Requirements**: STREAM-01, STREAM-02, STREAM-03
**Success Criteria** (what must be TRUE):
  1. User can stop a streaming response and see the response terminate immediately — no "saving response" text lingers in the UI
  2. User can navigate away or refresh the page during an active stream and no server-side socket errors appear in logs
  3. Partial assistant responses are persisted when stop is triggered, so the user can reload the page and see the partial answer
**Plans**: TBD
**UI hint**: yes

### Phase 45: Chat UX Fixes
**Goal**: Chat interactions are safe and predictable — no accidental deletes, no ghost content, and new chats start with the right folder context
**Depends on**: Phase 44 (streaming reliability resolved first)
**Requirements**: CHAT-01, CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE):
  1. User must confirm through a dialog before a thread is deleted — the delete only executes on explicit confirmation
  2. After deleting a thread and creating a new one, the chat area shows a blank state with no ghost content from the deleted thread
  3. User can choose a folder when creating a new chat, and the thread is scoped to that folder from the start
**Plans**: 2 plans
  - [x] 45-01-PLAN.md — Delete confirmation dialog and ghost content fix (CHAT-01, CHAT-02) ✅
  - [x] 45-02-PLAN.md — Folder selector on new chat creation (CHAT-03) ✅
**UI hint**: yes

### Phase 46: Smart Skill Dispatch
**Goal**: The agent's system prompt includes only skills relevant to the user's current message, eliminating over-triggering and token waste
**Depends on**: Phase 44 (streaming reliability resolved first)
**Requirements**: SKILL-01, SKILL-02
**Success Criteria** (what must be TRUE):
  1. Only skills whose descriptions match the user's current message appear in the agent's system prompt — not all enabled skills
  2. Skills that don't match the user's intent are never triggered during conversation, even if they exist in the user's enabled catalog
**Plans**: 2 plans
  - [ ] 46-01-PLAN.md — Skill embedding infrastructure (RPC migration, config, CRUD hooks, backfill)
  - [ ] 46-02-PLAN.md — Skill dispatch in chat stream (matching, tool filtering, graceful fallback)

### Phase 47: Document Version Deletion
**Goal**: Users can delete document versions intelligently — choosing between a single version or all versions — with complete cleanup of chunks, storage, and history
**Depends on**: Nothing specific (document versioning already exists from v2.2)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. User is offered a choice between "delete this version only" and "delete all versions" when deleting a document
  2. Deleting a single version removes its chunks and storage file, and promotes the next-latest version as the current version
  3. Deleting all versions removes every version's chunks, storage files, and history records for that document
**Plans**: TBD
**UI hint**: yes

### Phase 48: Document List & Upload Polish
**Goal**: Document management feels complete — root-folder documents are clearly visible and uploads fail with helpful, specific messages
**Depends on**: Phase 47 (deletion changes may affect document list queries)
**Requirements**: DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):
  1. Documents stored in the root folder (no folder assignment) are clearly visible in the document list and recognizable as root-level items
  2. When a file upload fails, the user sees the specific reason (duplicate file, unsupported type, empty file, or size limit exceeded)
  3. User can upload to the root folder successfully, and the UX makes it clear where the file is being placed
**Plans**: TBD
**UI hint**: yes

### Phase 49: Settings & Navigation Polish
**Goal**: The app feels polished — web search is explicitly controllable and the sidebar layout is visually tight
**Depends on**: Nothing specific
**Requirements**: SETT-01, SETT-02, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. User can toggle web search on or off in Settings, independent of whether a Tavily API key is configured
  2. When web search is toggled off, the web_search tool is excluded from the agent's available tool set regardless of API key
  3. Icon labels appear directly adjacent to their icons in the expanded sidebar with no large gaps between icon and text
  4. When the sidebar is collapsed, the logo icon remains visible (icon-only, no text)
**Plans**: TBD
**UI hint**: yes

### Phase 50: Library Health at Scale
**Goal**: Knowledge Health works for real-sized libraries — paginated, accurately labeled, and provides actionable guidance instead of empty dead-ends
**Depends on**: Nothing specific (enhances existing v2.3 feature)
**Requirements**: HLTH-01, HLTH-02, HLTH-03, HLTH-04
**Success Criteria** (what must be TRUE):
  1. Knowledge Health dashboard loads data in pages the user can navigate through, rather than a fixed top-10 list
  2. Low confidence panel explains that scores reflect query-document relevance (not document quality), with context about score distribution
  3. Feedback empty states show actionable, professional messaging guiding the user on what to do next
  4. Knowledge Health API accepts offset/limit pagination parameters and returns total counts alongside paginated results
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 44 → 45 → 46 → 47 → 48 → 49 → 50 → 51

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 44. SSE & Stop Reliability | v2.4 | 1/1 | Complete | 2026-04-23 |
| 45. Chat UX Fixes | v2.4 | 2/2 | Complete | 2026-04-23 |
| 46. Smart Skill Dispatch | v2.4 | 0/2 | Not started | - |
| 47. Document Version Deletion | v2.4 | 0/? | Not started | - |
| 48. Document List & Upload Polish | v2.4 | 0/? | Not started | - |
| 49. Settings & Navigation Polish | v2.4 | 0/? | Not started | - |
| 50. Library Health at Scale | v2.4 | 0/? | Not started | - |
| 51. Context Window Management | v2.4 | 0/7 | Gap closure in progress | - |

### Phase 51: Context Window Management

**Goal**: Context limits are handled intelligently across all providers — sub-agents route complex generation tasks (PPTX, reports) to capable models, output token ceilings are configurable per task type, and admins can tune context behaviour from the Settings UI with inline per-model documentation
**Depends on**: Phase 49 (Settings & Navigation Polish — builds on that UI foundation)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):
  1. A "summarise document and create PPTX" task completes without hitting context or output token limits — the sub-agent uses a capable model (Sonnet/GPT-4o/Gemini Flash) and a 32k output ceiling for generation tasks
  2. Simple analysis tasks (summarise, extract, list) continue to use the cheap sub-agent model; only generation/creation tasks are escalated
  3. Settings page exposes sliders for context history depth and sub-agent output token ceiling, and a dropdown for sub-agent model override
  4. Each model in the model selector shows an inline info card (context window, output limit, cost tier, best-for label)
  5. Token counting uses provider-accurate methods (tiktoken for OpenAI, char heuristic as fallback) rather than a single universal heuristic
**Plans**: 7 plans (5 original + 2 gap closure)
  - [ ] 051-01-PLAN.md — Test stubs: failing test scaffolds for CTX-01 through CTX-05
  - [ ] 051-02-PLAN.md — Sub-agent keyword routing + config field (CTX-01, CTX-02)
  - [ ] 051-03-PLAN.md — tiktoken upgrade in context_window.py (CTX-05)
  - [ ] 051-04-PLAN.md — Settings stack: sub_agent_max_output_tokens 6-layer threading + SliderInput (CTX-03)
  - [ ] 051-05-PLAN.md — Model info cards in chat model selector (CTX-04)
  - [ ] 051-06-PLAN.md — Gap closure: sub_agent_model override settings stack (CTX-03)
  - [ ] 051-07-PLAN.md — Gap closure: cost tier in model info cards (CTX-04)
**UI hint**: yes
