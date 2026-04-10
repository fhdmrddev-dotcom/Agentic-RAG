# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent can explore the knowledge base like a filesystem, execute Python code in a sandboxed Docker container, and apply reusable named skills that users define, import, and export. Ships with General and Explorer mode toggles, a dedicated Skills management UI, and a full agentskills.io-compatible ZIP import/export standard.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

## Current State

**Shipped:** v2.0 Agent Skills & Code Execution — 2026-04-04
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage)
**Codebase:** ~11,000 LOC (Python + TypeScript)
**Phases shipped:** 17 phases (8 v1.0 + 9 v2.0), all requirements complete
**Design system:** Aether Intelligence — dark/light mode, CSS variables, Inter + Manrope fonts, glassmorphism
**Docker:** `llm-sandbox` container used for code execution (`SANDBOX_ENABLED=true`)

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
- ✓ `glob` tool — file pattern matching against document names (e.g., `*.md`, `reports/**/*.pdf`) — v1.0 Phase 5
- ✓ `read` tool — read full document or line range (split at newlines) — v1.0 Phase 6
- ✓ Explorer sub-agent — orchestrates KB tools for synthesized exploration answers — v1.0 Phase 7
- ✓ Explorer mode selector in chat UI (General / Explorer toggle) — v1.0 Phase 7
- ✓ Visual indicator for global vs per-user folders — v1.0 Phase 8
- ✓ Global folder RLS: documents in global folders readable by all authenticated users — v1.0 Phase 8
- ✓ Folder-scoped chat threads: RAG retrieval auto-scoped to folder subtree — v1.0 Phase 8
- ✓ Folder detail info bar: compact stats (doc count, size, subfolders, date) in ingestion UI — v1.0 Phase 8

*v2.0 milestone:*

- ✓ Persistent Tool Memory — store tool results in JSONB, reconstruct full tool call history on conversation load — v2.0 Phase 9
- ✓ Agent Skills Core — skills table with CRUD, global/private ownership, RLS, Supabase Storage bucket — v2.0 Phase 10
- ✓ Skill File Attachments — upload/list/delete files on skills (backend); file list returned in load_skill — v2.0 Phase 10
- ✓ Skill tool dispatch (`load_skill`, `save_skill`, `read_skill_file`) wired into LLM chat loop — v2.0 Phase 11
- ✓ Skill catalog injection into General Mode system prompt; Explorer Mode gated out — v2.0 Phase 11
- ✓ `skill_activated` SSE event emitted on tool dispatch; frontend Zap indicator — v2.0 Phase 11/12
- ✓ Skills UI — Skills tab with full CRUD, toggle, share, "Try in Chat" — v2.0 Phase 12
- ✓ Skill-creator seed skill pre-loaded as global skill — v2.0 Phase 12
- ✓ Skills Open Standard ZIP import/export (agentskills.io format, SKILL.md frontmatter) — v2.0 Phase 13
- ✓ Code Execution Sandbox (Docker/llm-sandbox, session persistence by thread, SSE streaming, `SANDBOX_ENABLED` flag) — v2.0 Phase 14
- ✓ Code Output UI — ExecuteCodeBlock with streaming terminal + file download cards — v2.0 Phase 15
- ✓ Skill File Management UI — upload/list/delete files on skills via SkillFormDialog — v2.0 Phase 16

## Current Milestone: v2.1 Stability & RAG Correctness

**Goal:** Eliminate silent failures, blank responses, and correctness bugs found in post-v2.0 review.

**Target features:**
- Rolling context window with inter-iteration trimming (P0)
- Sub-agent size guard to prevent silent overflow on large documents (P0)
- APIError context overflow surfaced as visible UI error message (P0)
- Blank response guards: force-no-tools empty content + length mid-tool-call (P0)
- `load_skill`/`save_skill` `maybe_single()` hardening (P0)
- Keyword search folder scope fix — `_keyword_search` + `keyword_search_chunks` RPC (P1)
- `read_document` context cap — remove exemption, apply 3k cap with truncation note (P1)
- Metadata filter case normalization at ingest and search path (P1)
- Document-level RAG deduplication (P2)
- Similarity confidence hedging in system prompt (P2)
- Citation format guidance in system prompt (P2)
- Sentence boundary chunking edge case fix (P2)
- Settings file caching with 5s TTL (P2)

### Active

*(See Current Milestone above — requirements being defined)*

### Out of Scope

- Automatic local folder scanning/import — Phase II feature, adds complexity
- Team-based folder sharing with access controls — Keep it simple: global or private only
- Real-time collaboration on folders — Not needed for current use case
- Folder-level permissions — Global folders visible to all, per-user folders private
- Switching to Docling — Existing pypdf + python-docx pipeline is working; full markdown stored from existing extraction
- Nyquist VALIDATION.md compliance — Phase-level validation files exist in draft state; full compliance deferred

## Context

**Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance — configured purely via environment variables and migration SQL files.

**Schema (v2.0 shipped state):**
- `folders`: id, user_id, name, parent_id, is_global, created_at, updated_at — adjacency list with RLS
- `documents`: id, user_id, folder_id, filename, file_path, file_size, mime_type, status, full_markdown, chunk_count, content_hash, metadata, created_at, updated_at
- `document_chunks`: id, document_id, user_id, content, chunk_index, embedding (vector), search_vector (tsvector), created_at
- `threads`: id, user_id, folder_id (nullable FK → scoped chat), title, created_at
- `messages`, `profiles`, `user_settings`, `app_settings`
- `skills`: id, user_id, name, description, instructions, is_enabled, is_global, created_at, updated_at — RLS owner + global read
- `skill_files`: id, skill_id, user_id, filename, storage_path, file_size, mime_type, created_at — RLS owner-write, global-read
- `code_executions`: id, thread_id, user_id, code, exit_code, duration_ms, created_at — execution audit log
- `sandbox_files`: id, thread_id, user_id, filename, storage_path, file_size, signed_url, created_at — harvested output files

**Agent modes:**
- General: default chat with 13 tools (search, query_documents, web_search, analyze_document, ls, tree, grep, glob, read_document, load_skill, save_skill, read_skill_file, execute_code)
- Explorer: KB-focused mode with only 6 KB tools (ls, tree, grep, glob, read_document, analyze_document), dedicated system prompt, max_iterations=8

**Known issues:**
- Pre-existing test failures (7 tests): test_folders.py, test_threads.py, test_explorer_agent.py, test_module7_tools.py, test_retrieval_service.py, test_sql_service.py — pre-date v2.0, not regressions
- Human E2E verifications outstanding (14 items across phases 11–15): require live Docker + Supabase infra

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
| ON DELETE SET NULL on threads.folder_id | Thread history preserved when folder deleted; thread reverts to unscoped | ✓ Good — no data loss on folder delete |
| tools_override=None signals default mode | No override → get_tools() used; default mode completely unchanged | ✓ Good — clean branching pattern |
| agentMode state lives in ChatArea | Resets automatically on thread switch (ChatArea remounts per thread) | ✓ Good — correct v1.0 behavior |
| Use 403 not 404 for toggle-global by non-owner | Distinguishes permission denial from missing resource | ✓ Good — clearer error semantics |
| JSONB for tool_call_id persistence | Store alongside existing tool call data without schema migration | ✓ Good — non-breaking, reconstructs correctly |
| Pydantic models + TDD scaffold first | Define types contract before implementation — catches integration issues early | ✓ Good — Phase 10 pattern followed through Phase 16 |
| Skill catalog injection via .or_() Supabase query | Single query for user's own + global enabled skills | ✓ Good — correct RLS behavior |
| asyncio.Queue bridge for Docker SSE | Decouples Docker blocking I/O from FastAPI async SSE loop | ✓ Good — real-time streaming without blocking |
| Lazy llm-sandbox import | Docker container only started when SANDBOX_ENABLED=true | ✓ Good — no import penalty for disabled sandbox |
| Module-level TTL eviction for sandbox sessions | Prevents indefinite Docker container accumulation | ✓ Good — prevents resource leak |
| harvest_output_files() copies to /sandbox/output | Files generated by code accessible via signed URLs | ✓ Good — clean separation of sandbox and storage |
| SKILL.md frontmatter YAML + agentskills.io format | Open standard for skill portability | ✓ Good — ZIP round-trip works, path traversal rejected |
| FILE-01/FILE-02 deferred to Phase 16 | Audit found frontend file UI missing; gap closure phase added | ✓ Good — clean gap closure, no tech debt carried |

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
*Last updated: 2026-04-09 — v2.1 milestone started (Stability & RAG Correctness)*
