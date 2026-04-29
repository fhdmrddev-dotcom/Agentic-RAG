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

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) — completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) — completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) — completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) — completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) — completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) — completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) — completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) — completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Agent Skills & Code Execution (Phases 9–17) — SHIPPED 2026-04-04</summary>

- [X] Phase 9: Persistent Tool Memory (1/1 plans) — completed 2026-03-29
- [X] Phase 10: Agent Skills Core (3/3 plans) — completed 2026-03-31
- [X] Phase 11: Skills LLM Integration (3/3 plans) — completed 2026-04-01
- [X] Phase 12: Skills UI (3/3 plans) — completed 2026-04-02
- [X] Phase 13: Skills Open Standard (2/2 plans) — completed 2026-04-02
- [X] Phase 14: Code Execution Sandbox (5/5 plans) — completed 2026-04-03
- [X] Phase 15: Code Output UI (2/2 plans) — completed 2026-04-03
- [X] Phase 16: Skill File Management UI (2/2 plans) — completed 2026-04-04
- [X] Phase 17: Tech Debt Cleanup (1/1 plans) — completed 2026-04-04

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Stability & RAG Correctness (Phases 18–25) — SHIPPED 2026-04-11</summary>

- [X] Phase 18: Context Window Hardening (1/1 plans) — completed 2026-04-09
- [X] Phase 19: Sub-Agent Guards & API Error Visibility (1/1 plans) — completed 2026-04-10
- [X] Phase 20: Blank Response Guards (1/1 plans) — completed 2026-04-10
- [X] Phase 21: Keyword Search Folder Scope (1/1 plans) — completed 2026-04-10
- [X] Phase 22: RAG Correctness Fixes (1/1 plans) — completed 2026-04-10
- [X] Phase 23: System Prompt Quality (1/1 plans) — completed 2026-04-10
- [X] Phase 24: Infrastructure Hardening (1/1 plans) — completed 2026-04-10
- [X] Phase 25: Sub-Agent Intelligence & Model-Aware Context (1/1 plans) — completed 2026-04-10

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 Trust & Compliance (Phases 26–32) — SHIPPED 2026-04-16</summary>

- [X] Phase 26: Citations & Confidence — Backend (2/2 plans) — completed 2026-04-12
- [X] Phase 27: Citations & Confidence — Frontend (1/1 plans) — completed 2026-04-12
- [X] Phase 28: Document Versioning — Schema & Ingestion (2/2 plans) — completed 2026-04-12
- [X] Phase 29: Document Versioning — UI (2/2 plans) — completed 2026-04-13
- [X] Phase 30: Audit Log — Backend (2/2 plans) — completed 2026-04-14
- [X] Phase 31: Audit Log — Settings UI (2/2 plans) — completed 2026-04-14
- [X] Phase 32: Suggested Follow-Up Questions (2/2 plans) — completed 2026-04-16

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Memory, Multimodal & Experience (Phases 33–43) — SHIPPED 2026-04-19</summary>

- [X] Phase 33: Cross-Thread Memory — Backend (2/2 plans) — completed 2026-04-17
- [X] Phase 34: Cross-Thread Memory — Settings UI (1/1 plans) — completed 2026-04-17
- [X] Phase 35: Multi-Modal Ingestion (4/4 plans) — completed 2026-04-18
- [X] Phase 36: Multi-Modal Query & Library UI (3/3 plans) — completed 2026-04-18
- [X] Phase 37: Knowledge Health Dashboard — Backend (2/2 plans) — completed 2026-04-18
- [X] Phase 38: Knowledge Health Dashboard — Frontend (2/2 plans) — completed 2026-04-18
- [X] Phase 39: User Feedback Loop — Backend (2/2 plans) — completed 2026-04-18
- [X] Phase 40: User Feedback Loop — Frontend (2/2 plans) — completed 2026-04-19
- [X] Phase 41: UI Redesign — Tool Call Visualizer & Citations (2/2 plans) — completed 2026-04-19
- [X] Phase 42: UI Redesign — Layout Shell & Skills (3/3 plans) — completed 2026-04-19
- [X] Phase 43: UI Redesign — Mobile & Responsive (3/3 plans) — completed 2026-04-19

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

### 🚧 v2.4 Stability, Polish & UX Fixes (In Progress)

**Milestone Goal:** Fix critical bugs (SSE disconnects, ghost chats) and polish UX gaps to bring the app to production quality.

> **Note:** Phase 46 (Smart Skill Dispatch) was removed from this milestone. It modifies the `skills` table schema (pgvector embedding column), CRUD hooks, and system prompt injection — the same infrastructure the Skill Studio milestone will heavily extend. Deferring avoids fragmented schema migrations and ensures smart dispatch ships as a coherent foundation alongside the eval/iteration features it enables. See: `PRD_Skill_Studio.md` for the full Skills milestone scope.

- [X] **Phase 44: SSE & Stop Reliability** — Streaming stops instantly, disconnects cleanly, partial responses are preserved (1/1 plans) — completed 2026-04-23
- [X] **Phase 45: Chat UX Fixes** — Confirmation dialogs, no ghost content, folder-scoped new chats (2/2 plans) — completed 2026-04-23
- [X] **Phase 46: Document Version Deletion** — Choose to delete one version or all, with proper cleanup (2/2 plans) — completed 2026-04-25
- [X] **Phase 47: Document List & Upload Polish** — Root documents visible, upload errors clear, root upload works (2/2 plans) — completed 2026-04-25
- [X] **Phase 48: Settings & Navigation Polish** — Web search toggle in settings, sidebar icon/logo alignment (3/3 plans) — completed 2026-04-25
- [X] **Phase 49: Library Health at Scale** — Paginated health dashboard, accurate labels, actionable empty states
  (completed 2026-04-25)
- [X] **Phase 51: Context Window Management** — Per-model context limits, task-complexity routing for sub-agents, configurable settings UI with inline model documentation (7/7 plans) — completed 2026-04-24
- [X] **Phase 52: Multi-Provider Model Routing** — Full user control over main, sub-agent, title, and follow-up models; provider-aware routing; cross-provider sub-agent fix; fallback on unavailable models (3/3 plans) — completed 2026-04-25
  - [X] 052-01-PLAN.md — Backend: config defaults, 404 fallback + SSE sentinel, resolved_sub_agent_model in settings (Wave 1)
  - [X] 052-02-PLAN.md — Frontend: 422 error parsing, fallback banner, resolved model labels (Wave 2)
  - [X] 052-03-PLAN.md — MDL-02/03 verification tests + provider-aware routing confirmed (Wave 2)
  - [X] 051-01-PLAN.md — Test stubs (Wave 0: failing tests for all CTX requirements)
  - [X] 051-02-PLAN.md — Sub-agent keyword routing (CTX-01, CTX-02)
  - [X] 051-03-PLAN.md — tiktoken upgrade for OpenAI token estimation (CTX-05)
  - [X] 051-04-PLAN.md — Settings stack for sub_agent_max_output_tokens (CTX-03)
  - [X] 051-05-PLAN.md — Model info cards in chat model selector (CTX-04)
  - [X] 051-06-PLAN.md — Gap closure: sub_agent_model override settings stack (CTX-03)
  - [X] 051-07-PLAN.md — Gap closure: cost tier in model info cards (CTX-04)
- [X] **Phase 53: Cross-Provider Tool Calling Reliability** — Capability registry routes models to native or structured tool calling; OpenRouter quality strategy setting; JSON parser for non-native models; zero regression for OpenAI (4/4 plans) — completed 2026-04-26
  - [X] 053-01-PLAN.md — Backend: MODEL_CAPABILITIES registry, create_adaptive_streaming_chat() with native/structured routing, OpenRouter quality enhancements (Wave 1)
  - [X] 053-02-PLAN.md — Backend + Frontend: openrouter_tool_strategy setting with UI dropdown (Wave 2)
  - [X] 053-03-PLAN.md — Backend: tool_parser.py module with JSON extraction, threads.py integration (Wave 3)
  - [X] 053-04-PLAN.md — Tests: test_tool_parser.py, test_calling_mode.py, test_openai_service.py (Wave 4)

## Phase Details

### Phase 44: SSE & Stop Reliability

**Goal**: Streaming responses stop immediately when the user clicks stop, disconnects are handled gracefully, and partial responses are never lost
**Depends on**: Nothing (first phase — core reliability)
**Requirements**: STREAM-01, STREAM-02, STREAM-03
**Success Criteria** (what must be TRUE):

1. User can stop a streaming response and see the response terminate immediately — no "saving response" text lingers in the UI
2. User can navigate away or refresh the page during an active stream and no server-side socket errors appear in logs
3. Partial assistant responses are persisted when stop is triggered, so the user can reload the page and see the partial answer
   **Plans**: 5 plans

- [X] 054-01-PLAN.md � TDD Wave 0: failing tests for GEN-01/GEN-02/GEN-04/GEN-05 (Wave 1)
- [X] 054-02-PLAN.md � Remove 20%% token reduction + tool-result caps + anthropic SDK (Wave 2)
- [X] 054-03-PLAN.md � anthropic_service.py native SDK adapter with message conversion + prompt caching (Wave 2)
- [X] 054-04-PLAN.md � threads.py Anthropic dispatch + SettingsPage.tsx provider-conditional sliders (Wave 3)
- [X] 054-05-PLAN.md � Full test suite verification + 054-VERIFICATION.md (Wave 4)
  **UI hint**: yes (Settings sliders hidden for native providers; read-only info rows shown)
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

- [X] 45-01-PLAN.md — Delete confirmation dialog and ghost content fix (CHAT-01, CHAT-02) ✅
- [X] 45-02-PLAN.md — Folder selector on new chat creation (CHAT-03) ✅
  **UI hint**: yes

### ~~Phase 46: Smart Skill Dispatch~~ — DEFERRED to Skills Studio milestone

**Deferred reason:** This phase adds a `vector(1536)` embedding column to the `skills` table, embedding compute hooks in `skills.py` CRUD, and replaces the full-catalog system prompt injection with cosine-similarity matching. The Skill Studio milestone (`PRD_Skill_Studio.md`) will further evolve the skills table (eval cases, eval runs, potential version column) and the same CRUD/dispatch code. Doing them in separate milestones creates fragmented migrations and forces integration work twice. Smart dispatch ships as Phase 1 of the Skills Studio milestone instead, where it serves as the foundation for relevance-aware eval execution.

**Planning artifacts preserved:** `.planning/phases/46-smart-skill-dispatch/` (CONTEXT.md, DISCUSSION-LOG.md, 46-01-PLAN.md, 46-02-PLAN.md)

### Phase 55: Streaming Reliability & Connection Resilience — DEFERRED

**Goal**: Fix three streaming durability gaps -- stop_event threading, Supabase Realtime subscription for SSE drop recovery, asyncio.shield on persist-on-disconnect
**Depends on:** Phase 54
**Requirements**: STREAM-01, STREAM-02, STREAM-03
**Status:** Deferred — Plans 01–04 complete, Plan 05 (verification) blocked by Realtime race condition. See `.planning/phases/055-streaming-reliability-connection-resilience/055-DEFERRAL.md` for full root cause and recommended fix approach.
**Plans:** 5 plans (4/5 complete)

- [X] 055-01-PLAN.md -- DB prerequisite checkpoint
- [X] 055-02-PLAN.md -- TDD test scaffold (8 tests)
- [X] 055-03-PLAN.md -- Backend: stop_event threading + asyncio.shield persist (STREAM-01, STREAM-03)
- [X] 055-04-PLAN.md -- Frontend: Realtime subscription + sseDrop removal (STREAM-02)
- [ ] 055-05-PLAN.md -- Verification — deferred (Realtime INSERT race not resolved)

### Phase 56: Agent Real-Time Feedback

**Goal:** Surface agentic loop progress in real time — Step N counter, task phase labels, inline skill rows, ingestion step badges, and Realtime reconnect instrumentation
**Depends on:** Phase 55
**Plans:** 3/3 complete — completed 2026-04-29

- [X] 56-01-PLAN.md — Backend: iteration_start SSE event + ingestion_step column + migration 032
- [X] 56-02-PLAN.md — Frontend: ToolCallPanel Step N header + task phase labels + SkillRow
- [X] 56-03-PLAN.md — Frontend: DocumentStatusBadge ingestion_step label + 2s delayed Realtime teardown + console.log tracing

---

### Phase 57: SSE Realtime Reconnect Fix

**Goal:** After a stream ends or the page is refreshed mid-stream, the assistant message is always visible — no empty threads, no silent data loss
**Depends on:** Phase 56 (console.log tracing in place; root cause confirmed via browser trace)
**Requirements**: STREAM-02
**Plans:** 2 plans

Root cause (confirmed 2026-04-29 via console trace):
- **E (tab switch):** Realtime INSERT fires while `isStreamingRef.current = true` → blocked by guard → `finally` runs too late to catch it. The 2s delayed removeChannel only helps INSERTs that arrive *after* `isStreamingRef = false`.
- **F (refresh mid-stream):** No Realtime channel on fresh page load. `loadMessages` runs before backend persists. Backend persists via asyncio.shield ~5s later but nobody is listening.

Fix approach:
- Plan 01: In `finally`, after `isStreamingRef = false`, call `loadMessages(threadId)` directly (guarded by thread identity + not stopped). Replaces the "catch INSERT via Realtime" with a direct DB reload. Handles E.
- Plan 02: Set up a Realtime subscription whenever a thread is selected (in `useEffect([thread?.id])`), not only inside `sendMessage`. Tear down on thread change. Handles F.

Plans:
- [ ] TBD (run /gsd-plan-phase 57 to break down)

---

### Phase 46: Document Version Deletion

**Goal**: Users can delete document versions intelligently — choosing between a single version or all versions — with complete cleanup of chunks, storage, and history
**Depends on**: Nothing specific (document versioning already exists from v2.2)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

1. User is offered a choice between "delete this version only" and "delete all versions" when deleting a document
2. Deleting a single version removes its chunks and storage file, and promotes the next-latest version as the current version
3. Deleting all versions removes every version's chunks, storage files, and history records for that document
   **Plans**: TBD
   **UI hint**: yes

### Phase 47: Document List & Upload Polish

**Goal**: Document management feels complete — root-folder documents are clearly visible and uploads fail with helpful, specific messages
**Depends on**: Phase 46 (deletion changes may affect document list queries)
**Requirements**: DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):

1. Documents stored in the root folder (no folder assignment) are clearly visible in the document list and recognizable as root-level items
2. When a file upload fails, the user sees the specific reason (duplicate file, unsupported type, empty file, or size limit exceeded)
3. User can upload to the root folder successfully, and the UX makes it clear where the file is being placed
   **Plans**: 2 plans

- [X] 47-01-PLAN.md — Frontend root visibility: badge, header, empty state (DOC-04, DOC-06) ✅
- [X] 47-02-PLAN.md — Backend 50 MB file size limit with specific error (DOC-05) ✅
  **UI hint**: yes

### Phase 48: Settings & Navigation Polish

**Goal**: The app feels polished — web search is explicitly controllable and the sidebar layout is visually tight
**Depends on**: Nothing specific
**Requirements**: SETT-01, SETT-02, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):

1. User can toggle web search on or off in Settings, independent of whether a Tavily API key is configured
2. When web search is toggled off, the web_search tool is excluded from the agent's available tool set regardless of API key
3. Icon labels appear directly adjacent to their icons in the expanded sidebar with no large gaps between icon and text
4. When the sidebar is collapsed, the logo icon remains visible (icon-only, no text)
   **Plans**: 3 plans
   Plans:

- [X] 048-01-PLAN.md — Backend: web_search_enabled settings stack + feedback stats counts (SETT-01, SETT-02)
- [X] 048-02-PLAN.md — Frontend: NavPanel logo icon visibility + TabsTrigger animation fix (NAV-01, NAV-02)
- [X] 048-03-PLAN.md — Frontend: web search toggle UI + feedback panel stat cards (SETT-01, SETT-02)
  **UI hint**: yes

### Phase 49: Library Health at Scale

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
Phases execute in numeric order: 44 → 45 → 46 → 47 → 48 → 49 → 51 → 52 → 53

| Phase                                             | Milestone                 | Plans Complete | Status   | Completed  |
| ------------------------------------------------- | ------------------------- | -------------- | -------- | ---------- |
| 44. SSE & Stop Reliability                        | v2.4                      | 1/1            | Complete | 2026-04-23 |
| 45. Chat UX Fixes                                 | v2.4                      | 2/2            | Complete | 2026-04-23 |
| 46. Document Version Deletion                     | v2.4                      | 2/2            | Complete | 2026-04-25 |
| 47. Document List & Upload Polish                 | v2.4                      | 2/2            | Complete | 2026-04-25 |
| 48. Settings & Navigation Polish                  | v2.4                      | 3/3            | Complete | 2026-04-25 |
| 49. Library Health at Scale                       | v2.4                      | 2/2            | Complete | 2026-04-25 |
| 51. Context Window Management                     | v2.4                      | 7/7            | Complete | 2026-04-24 |
| 52. Multi-Provider Model Routing                  | v2.4                      | 3/3            | Complete | 2026-04-25 |
| 53. Cross-Provider Tool Calling Reliability       | v2.4                      | 4/4            | Complete | 2026-04-26 |
| 54. Reliable Agentic Generation                   | v2.4                      | 5/5            | Complete | 2026-04-26 |
| 55. Streaming Reliability & Connection Resilience | v2.4                      | 4/5            | Deferred | —         |
| ~~Smart Skill Dispatch~~                         | Deferred → Skills Studio | —             | Deferred | —         |

### Phase 51: Context Window Management

**Goal**: Context limits are handled intelligently across all providers — sub-agents route complex generation tasks (PPTX, reports) to capable models, output token ceilings are configurable per task type, and admins can tune context behaviour from the Settings UI with inline per-model documentation
**Depends on**: Phase 48 (Settings & Navigation Polish — builds on that UI foundation)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):

1. A "summarise document and create PPTX" task completes without hitting context or output token limits — the sub-agent uses a capable model (Sonnet/GPT-4o/Gemini Flash) and a 32k output ceiling for generation tasks
2. Simple analysis tasks (summarise, extract, list) continue to use the cheap sub-agent model; only generation/creation tasks are escalated
3. Settings page exposes sliders for context history depth and sub-agent output token ceiling, and a dropdown for sub-agent model override
4. Each model in the model selector shows an inline info card (context window, output limit, cost tier, best-for label)
5. Token counting uses provider-accurate methods (tiktoken for OpenAI, char heuristic as fallback) rather than a single universal heuristic
   **Plans**: 7 plans (5 original + 2 gap closure)

- [ ] 051-01-PLAN.md — Test stubs: failing test scaffolds for CTX-01 through CTX-05
- [X] 051-02-PLAN.md — Sub-agent keyword routing + config field (CTX-01, CTX-02)
- [X] 051-03-PLAN.md — tiktoken upgrade in context_window.py (CTX-05)
- [X] 051-04-PLAN.md — Settings stack: sub_agent_max_output_tokens 6-layer threading + SliderInput (CTX-03)
- [X] 051-05-PLAN.md — Model info cards in chat model selector (CTX-04)
- [X] 051-06-PLAN.md — Gap closure: sub_agent_model override settings stack (CTX-03)
- [X] 051-07-PLAN.md — Gap closure: cost tier in model info cards (CTX-04)
  **UI hint**: yes

### Phase 52: Multi-Provider Model Routing

**Goal**: Every model used by the app — main chat, sub-agent, title drafter, follow-up suggester — is transparently controllable by the user, routes correctly across provider boundaries, and degrades gracefully when a model is unavailable
**Depends on**: Phase 51 (Context Window Management — sub-agent model settings already in place)
**Requirements**: MDL-01, MDL-02, MDL-03, MDL-04, MDL-05
**Success Criteria** (what must be TRUE):

1. Sub-agent always uses a model from the same provider as the main chat model unless explicitly overridden — the cross-provider 404 error is eliminated
2. Title-drafter and follow-up-suggester agents use a cheap model from the active provider (not hardcoded to a specific provider)
3. Switching the chat model mid-conversation preserves full message history — no context loss
4. If the selected model is unavailable or returns a non-retryable error, the app falls back to a default model for that provider and informs the user
5. Settings clearly exposes which model each agent role uses (main, sub-agent, title, follow-up) so the user always knows what is running
   **Plans**: 3/3 complete — completed 2026-04-25
   **UI hint**: yes

### Phase 53: Cross-Provider Tool Calling Reliability

**Goal**: Tool calling works reliably across all providers — OpenAI models use native API tools (zero regression), while non-OpenAI models (GLM 5.1, DeepSeek, Kimi via OpenRouter) use deterministic structured JSON-in-prompt mode. User controls OpenRouter behavior via a Settings dropdown.

**Depends on**: Phase 52 (Multi-Provider Model Routing — provider-aware infrastructure in place)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):

1. OpenAI models (gpt-4o, gpt-4.1, etc.) emit tool calls via native API parameters with identical behavior and latency to pre-phase code
2. GLM 5.1, DeepSeek, Kimi, and other OpenRouter models output structured JSON tool calls instead of planning text ("Now let me search...")
3. Structured JSON parser extracts tool calls from markdown blocks or inline JSON with 100% reliability for valid output
4. Unknown or untested models default to structured mode — safe by default, no surprises
5. User can toggle OpenRouter strategy between Quality (`:exacto` routing + Response Healing), Native (assume tool support), and XML (force structured) in Settings
6. Parse failures are graceful — conversation continues with text response, no errors or infinite loops
7. 32+ unit tests cover parser, calling mode resolution, and OpenRouter quality enhancements with zero regression in existing tests
   **Plans**: 4 plans

- [ ] 053-01-PLAN.md — Backend: MODEL_CAPABILITIES registry, create_adaptive_streaming_chat() with native/structured routing, OpenRouter quality enhancements (Wave 1)
- [ ] 053-02-PLAN.md — Backend + Frontend: openrouter_tool_strategy setting with UI dropdown (Wave 2)
- [ ] 053-03-PLAN.md — Backend: tool_parser.py module with JSON extraction, threads.py integration (Wave 3)
- [ ] 053-04-PLAN.md — Tests: 32+ unit tests for parser, calling mode, and OpenRouter enhancements (Wave 4)
  **UI hint**: yes (Settings dropdown only; no chat UI changes)

### Phase 54: Reliable Agentic Generation

**Goal**: Complex end-to-end tasks (PPT, report, PDF generation from documents) complete successfully for all providers — the agent retrieves content, calls execute_code exactly once with complete Python code, and delivers a working output file. Q&A queries must NOT trigger execute_code.

**Depends on**: Phase 53 (Cross-Provider Tool Calling Reliability)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, PROMPT-01
**Success Criteria** (what must be TRUE):

1. "Generate a PPT from my dissertation" completes end-to-end: file downloaded, no truncation errors
2. execute_code is called with complete Python code — never truncated mid-JSON
3. No intermediate searches after analyze_document for generation tasks
4. Empty-response fallback ("I wasn't able to generate a response") eliminated for legitimate requests
5. Works for Anthropic (claude-sonnet-4-6), OpenAI (gpt-4.1), and Google (gemini-2.5-flash)
6. Q&A queries ("summarize the report", "what does this say?") respond with text only — no execute_code triggered
   **Plans**: 5 plans — completed 2026-04-26

- [X] **PROMPT-01 (Hotfix):** System prompt Q&A vs Generation disambiguation
- [X] 054-01-PLAN.md — TDD Wave 0: failing tests for GEN requirements
- [X] 054-02-PLAN.md — Remove token reduction caps + Anthropic SDK
- [X] 054-03-PLAN.md — anthropic_service.py native SDK adapter + prompt caching
- [X] 054-04-PLAN.md — threads.py Anthropic dispatch + SettingsPage provider UI
- [X] 054-05-PLAN.md — Full test suite verification + VERIFICATION.md
