# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent remembers preferences across threads, extracts tables and images from documents, shows confidence and citations, runs code in a sandbox, and can be taught new skills that persist. The Deep Midnight visual design delivers a glassmorphic, mobile-responsive experience with knowledge health dashboards and user feedback loops.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

## Current Milestone: v2.4 Stability, Polish & UX Fixes

**Goal:** Fix critical bugs (SSE disconnects, skill over-triggering, ghost chats) and polish UX gaps to bring the app to production quality.

**Target features:**
- SSE & Stop Reliability — graceful disconnects, partial response persistence
- Smart Skill Dispatch — relevance-based skill selection, not catalog blasting
- Document Deletion Choices — version-aware delete with cleanup
- Chat Delete Confirmation & State Cleanup — confirmation dialog, ghost chat fix
- Folder Selector on New Chat — scope threads from creation
- Root Folder Visibility — ensure root documents are clearly visible
- Web Search Toggle — settings on/off switch like sandbox/reranking
- Upload Error Clarity — specific failure reasons in UI
- Navigation Polish — icon label alignment, collapsed logo visibility
- Library Health at Scale — pagination, meaningful metrics, actionable empty states

## Current State

**Shipped:** v2.3 Memory, Multimodal & Experience — 2026-04-19 (Phases 33–43: cross-thread memory, multi-modal table/image extraction, knowledge health dashboard, user feedback, Deep Midnight UI redesign with mobile responsiveness)
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage)
**Codebase:** ~57,000 LOC (Python + TypeScript)
**Phases shipped:** 43 phases (8 v1.0 + 9 v2.0 + 8 v2.1 + 7 v2.2 + 11 v2.3), 53 requirements validated
**Design system:** Aether Intelligence — Deep Midnight theme, glassmorphic cards, gradient accents, mobile-responsive
**Docker:** `llm-sandbox` container used for code execution (`SANDBOX_ENABLED=true`)
**Known tech debt:** UAT/verification gaps for phases 038–042 (require live browser testing); metadata normalization covers only document_type/language

## Requirements

### Validated

*Pre-existing (from prior modules):*

- ✓ Chat interface with SSE streaming — Module 1
- ✓ Document ingestion with multi-format support (PDF, DOCX, HTML, Markdown via pypdf + python-docx) — Module 5
- ✓ Hybrid search (keyword + vector with RRF fusion) — Module 6
- ✓ Document analysis sub-agent (loads full document into isolated context) — Module 8
- ✓ Tool calling framework (multi-tool dispatch loop) — Module 7
- ✓ Row-Level Security for per-user data isolation — Module 2
- ✓ Supabase Auth with JWT verification — Module 1
- ✓ Thread and message management — Module 1
- ✓ Real-time ingestion status via Supabase Realtime — Module 2
- ✓ Metadata extraction (LLM-structured JSON) — Module 4
- ✓ Record manager (deduplication via SHA-256) — Module 3
- ✓ Text-to-SQL tool (`query_documents`) — Module 7
- ✓ Web search fallback (Tavily) — Module 7

*v1.0 milestone:*

- ✓ Nested folder structure with unlimited depth — v1.0 Phase 1
- ✓ Global folders (shared across all users) and per-user folders (private) — v1.0 Phase 1
- ✓ Document-folder integration (folder_id FK on documents, move document, move folder) — v1.0 Phase 2
- ✓ Store full extracted markdown alongside chunks for grep/read operations — v1.0 Phase 2
- ✓ Folder CRUD in ingestion UI (create, rename, delete folders) — v1.0 Phase 3
- ✓ Upload files to selected folder in UI — v1.0 Phase 3
- ✓ `ls` tool — list files and subfolders in a given path — v1.0 Phase 4
- ✓ `tree` tool — hierarchical structure with depth limit and truncation — v1.0 Phase 4
- ✓ `grep` tool — regex search over document content, returns matching document names — v1.0 Phase 5
- ✓ `glob` tool — file pattern matching against document names — v1.0 Phase 5
- ✓ `read` tool — read full document or line range — v1.0 Phase 6
- ✓ Explorer sub-agent — orchestrates KB tools for synthesized exploration answers — v1.0 Phase 7
- ✓ Explorer mode selector in chat UI (General / Explorer toggle) — v1.0 Phase 7
- ✓ Visual indicator for global vs per-user folders — v1.0 Phase 8
- ✓ Global folder RLS: documents in global folders readable by all authenticated users — v1.0 Phase 8
- ✓ Folder-scoped chat threads: RAG retrieval auto-scoped to folder subtree — v1.0 Phase 8
- ✓ Folder detail info bar: compact stats in ingestion UI — v1.0 Phase 8

*v2.0 milestone:*

- ✓ Persistent Tool Memory — store tool results in JSONB, reconstruct full tool call history on conversation load — v2.0 Phase 9
- ✓ Agent Skills Core — skills table with CRUD, global/private ownership, RLS, Supabase Storage bucket — v2.0 Phase 10
- ✓ Skill File Attachments — upload/list/delete files on skills — v2.0 Phase 10
- ✓ Skill tool dispatch (`load_skill`, `save_skill`, `read_skill_file`) wired into LLM chat loop — v2.0 Phase 11
- ✓ Skill catalog injection into General Mode system prompt; Explorer Mode gated out — v2.0 Phase 11
- ✓ `skill_activated` SSE event emitted on tool dispatch; frontend Zap indicator — v2.0 Phase 11/12
- ✓ Skills UI — Skills tab with full CRUD, toggle, share, "Try in Chat" — v2.0 Phase 12
- ✓ Skill-creator seed skill pre-loaded as global skill — v2.0 Phase 12
- ✓ Skills Open Standard ZIP import/export (agentskills.io format) — v2.0 Phase 13
- ✓ Code Execution Sandbox (Docker/llm-sandbox, session persistence, SSE streaming) — v2.0 Phase 14
- ✓ Code Output UI — ExecuteCodeBlock with streaming terminal + file download cards — v2.0 Phase 15
- ✓ Skill File Management UI — upload/list/delete files on skills — v2.0 Phase 16

*v2.1 milestone:*

- ✓ Rolling context window trimming with atomic tool-pair removal — v2.1 Phase 18
- ✓ Inter-iteration trim: tool result messages removed atomically between agent loop iterations — v2.1 Phase 18
- ✓ Sub-agent content cap (600k chars) enforced before API call — v2.1 Phase 19
- ✓ Blank response guards: force-no-tools empty content fallback + finish_reason=length error event — v2.1 Phase 20
- ✓ Keyword search folder scope — v2.1 Phase 21
- ✓ Read document context capped at 3,000 chars with truncation note — v2.1 Phase 22
- ✓ Metadata case normalization (document_type/language) — v2.1 Phase 22
- ✓ System prompt confidence hedging + structured citation format guidance — v2.1 Phase 23
- ✓ Settings file TTL cache (5s) on `_load_override()` — v2.1 Phase 24
- ✓ Sentence boundary chunking fix — v2.1 Phase 24
- ✓ Sub-agent model auto-selection per provider — v2.1 Phase 25
- ✓ Provider-aware context budgets — v2.1 Phase 25

*v2.2 milestone:*

- ✓ F-01 Citations — collapsible passage cards with exact retrieved text — v2.2 Phases 26–27
- ✓ F-05 Confidence — High/Medium/Low badge with colour coding — v2.2 Phases 26–27
- ✓ F-02 Document versioning — upload new versions, view history, restore — v2.2 Phases 28–29
- ✓ F-06 Audit log — immutable action log with filter, paginate, CSV export — v2.2 Phases 30–31
- ✓ F-08 Suggested follow-up questions — 2–3 clickable pills after each response — v2.2 Phase 32

*v2.3 milestone:*

- ✓ F-03 Cross-Thread Memory — remember/recall tools with auto-injection — v2.3 Phases 33–34
- ✓ F-07 Multi-Modal Table & Image Extraction — pdfplumber tables, vision-LLM image descriptions, query_tables tool — v2.3 Phases 35–36
- ✓ F-09 Knowledge Health Dashboard — most-retrieved, never-retrieved, low-confidence, stale metrics with action hooks — v2.3 Phases 37–38
- ✓ F-10 User Feedback Loop — thumbs up/down with reason selector, feedback stats in Library Health — v2.3 Phases 39–40
- ✓ UI Deep Midnight Redesign — glassmorphic ToolCallPanel, gradient CitationCards, floating pill MessageInput, AppDock, 3-pane SkillsPage, mobile-responsive NavPanel — v2.3 Phases 41–43

### Active

- [ ] STREAM-01: Stop cancels SSE generator immediately (no "saving response" linger)
- [ ] STREAM-02: Navigate/refresh during streaming disconnects gracefully (no socket errors)
- [ ] STREAM-03: Partial responses persisted on stop, visible on reload
- [ ] SKILL-01: Skill catalog uses relevance-based filtering, not all enabled skills
- [ ] SKILL-02: Non-relevant skills never triggered even if in catalog
- [ ] DOC-01: Delete document offers "this version only" or "all versions"
- [ ] DOC-02: Single-version delete cleans chunks/storage and promotes next version
- [ ] DOC-03: All-versions delete removes chunks, storage, and history
- [ ] DOC-04: Root-folder documents clearly visible in document list
- [ ] DOC-05: Upload errors show specific reasons (duplicate, type, empty, size)
- [ ] DOC-06: Root folder upload works correctly with clear UX
- [ ] CHAT-01: Thread delete shows confirmation dialog before executing
- [ ] CHAT-02: No ghost content from deleted thread appears in new chat
- [ ] CHAT-03: New chat creation presents folder selector
- [ ] SETT-01: Web search toggle in Settings (on/off) like sandbox/reranking
- [ ] SETT-02: Web search excluded from tool set when toggled off
- [ ] NAV-01: Icon labels directly next to icons when sidebar is expanded
- [ ] NAV-02: Logo icon visible when sidebar is collapsed
- [ ] HLTH-01: Knowledge Health uses server-side pagination (not fixed top-10)
- [ ] HLTH-02: Low confidence panel explains query-document relevance, not document quality
- [ ] HLTH-03: Feedback empty states use actionable corporate-appropriate messaging
- [ ] HLTH-04: Knowledge Health API supports pagination parameters

### Out of Scope

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

## Context

**Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance.

**Schema (v2.3 shipped state):**
- `folders`: id, user_id, name, parent_id, is_global, created_at, updated_at — adjacency list with RLS
- `documents`: id, user_id, folder_id, filename, file_path, file_size, mime_type, status, full_markdown, chunk_count, content_hash, metadata, version_number, is_latest, created_at, updated_at
- `document_chunks`: id, document_id, user_id, content, chunk_index, embedding (vector), search_vector (tsvector), created_at
- `document_tables`: id, document_id, user_id, page, table_index, headers, rows, created_at
- `document_images`: id, document_id, user_id, page, image_index, description, created_at
- `threads`: id, user_id, folder_id (nullable FK), title, created_at
- `messages`: id, thread_id, role, content, tool_calls, citations, source_refs, confidence, suggestions, created_at
- `user_memory`: id, user_id, key, value, created_at, updated_at — UNIQUE(user_id, key) with upsert trigger
- `message_feedback`: id, message_id, user_id, rating, reason, created_at — UNIQUE(message_id, user_id), INSERT-only
- `skills`: id, user_id, name, description, instructions, is_enabled, is_global, created_at, updated_at
- `skill_files`: id, skill_id, user_id, filename, storage_path, file_size, mime_type, created_at
- `code_executions`: id, thread_id, user_id, code, exit_code, duration_ms, created_at
- `sandbox_files`: id, thread_id, user_id, filename, storage_path, file_size, signed_url, created_at
- `audit_log`: id, user_id, action_type, details, created_at — INSERT-only RLS
- `profiles`, `user_settings`, `app_settings`

**Agent modes:**
- General: default chat with 16 tools (search, query_documents, web_search, analyze_document, ls, tree, grep, glob, read_document, load_skill, save_skill, read_skill_file, execute_code, remember, recall, query_tables)
- Explorer: KB-focused mode with 6 KB tools, dedicated system prompt, max_iterations=8

**Known issues:**
- UAT verification gaps for phases 038–042 (require live browser testing)
- Verification checks for phases 038, 039, 040, 041, 042 marked human_needed
- Metadata ingest normalization covers only document_type/language
- SSE "saving response" linger when user stops streaming mid-response
- socket.send() exception when navigating/refreshing during active SSE stream
- Skill catalog injected in full for every request (token waste, over-triggering)
- No confirmation dialog on thread delete
- Ghost chat content appears briefly after delete+new chat
- Icon labels misaligned (far right of icons) in NavPanel
- Logo disappears entirely when sidebar collapsed (opacity-0 on whole group)
- Knowledge Health fixed top-10 lists don’t scale for large libraries
- Low confidence metric is misleading (reflects query relevance, not document quality)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction from chunks | ✓ Good — implemented Phase 2, used by read/grep tools |
| Unlimited folder nesting depth | Flexibility like a real filesystem | ✓ Good — adjacency list with no depth limit |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | ✓ Good — `is_global` flag + RLS |
| grep returns document names only | Keeps output lightweight; use read for content | ✓ Good — agents follow up with read when content needed |
| tree uses depth limit + truncation | Protects context window for large KBs | ✓ Good — `truncated=True` indicator on cut nodes |
| Keep pypdf + python-docx (not Docling) | Already working; avoids migration risk | ✓ Good — no issues encountered |
| ON DELETE SET NULL on folder_id FK | Deleting folder orphans documents to root, not destroys them | ✓ Good — safe default behavior |
| document_chunks RLS not updated | match_document_chunks RPC is SECURITY DEFINER — RAG queries bypass RLS correctly | ✓ Good — no change needed |
| Python-side subtree resolution | Preferred over SQL CTE for folder scoping — simpler, testable | ✓ Good — used in grep, glob, query_documents, system prompt |
| ON DELETE SET NULL on threads.folder_id | Thread history preserved when folder deleted | ✓ Good — no data loss on folder delete |
| tools_override=None signals default mode | No override → get_tools() used; default mode completely unchanged | ✓ Good — clean branching pattern |
| JSONB for tool_call_id persistence | Store alongside existing tool call data without schema migration | ✓ Good — non-breaking, reconstructs correctly |
| asyncio.Queue bridge for Docker SSE | Decouples Docker blocking I/O from FastAPI async SSE loop | ✓ Good — real-time streaming without blocking |
| SKILL.md frontmatter YAML + agentskills.io format | Open standard for skill portability | ✓ Good — ZIP round-trip works, path traversal rejected |
| chars/3 for JSON token estimation | JSON punctuation overhead means chars/4 underestimates tool call sizes | ✓ Good — existing trim tests pass |
| Provider-aware context budgets (hardcoded) | Dynamic context limit mapping adds complexity; hardcoded per-provider sufficient | ✓ Good — avoids tiktoken dependency |
| 3k char cap on read_document context injection | Large documents were flooding agent context; 3k + truncation note preserves usefulness | ✓ Good — agents follow up with start_line/end_line |
| User memory UNIQUE(user_id, key) upsert | Enables remember tool to update in-place; consistent with per-user scoping | ✓ Good — clean upsert-by-key pattern |
| asyncio.create_task for non-blocking writes | Memory writes, feedback posts, audit log entries never delay responses | ✓ Good — consistent fire-and-forget pattern across phases 30, 33, 39 |
| Vision LLM for image descriptions | Embedded images described and indexed for vector search | ✓ Good — enables MODAL-02 and MODAL-03 |
| Python-side JSONB aggregation for health metrics | Simpler than raw SQL with Supabase client for aggregation queries | ✓ Good — fast enough for 10k document libraries |
| Immutable feedback (INSERT-only RLS) | One rating per message per user; no modification allowed | ✓ Good — clean audit trail |
| Deep Midnight is additive CSS/Tailwind only | No logic changes to SSE parsing or state management | ✓ Good — zero regression risk |
| NavPanel collapses from Sidebar + AppDock | Single component with localStorage-persisted state replaces dual-component layout | ✓ Good — cleaner responsive breakpoint story |
| 5-tab SettingsPage | Per-tab scoped Save handlers fix KEY_PLACEHOLDER contamination | ✓ Good — WR-03/WR-04 resolved |

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Supabase deployment**: Agnostic — works with local Docker or cloud; all schema changes as numbered migration SQL files
- **Extraction**: Keep pypdf + python-docx pipeline — no Docling migration
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents/skills (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files
- **Sandbox**: Docker required for code execution; SANDBOX_ENABLED=false (default) disables all sandbox features safely

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after v2.4 milestone started*