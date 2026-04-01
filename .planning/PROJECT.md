# Knowledge Base Explorer

## What This Is

A Claude Code-inspired exploration layer built on top of the existing Agentic RAG application. Users organize documents into nested folders (global or personal), and the AI agent can navigate, search, and read that structure using filesystem-like tools — just like Claude Code explores codebases. Ships with a General/Explorer mode toggle in the chat UI so users can switch the agent into KB-focused exploration mode on demand.

## Core Value

The agent can explore the knowledge base the same way Claude Code explores codebases — navigating folders, pattern-matching filenames, searching content, and reading specific documents.

## Current Milestone: v2.0 Agent Skills & Code Execution

**Goal:** Transform the chat app into a customizable AI agent platform with reusable skills, sandboxed code execution, and persistent tool memory.

**Target features:**
- Agent Skills — named reusable behavior units with progressive discovery, AI-guided creation, full CRUD UI (new Skills tab)
- Skill Building-Block Files — files attached to skills, loaded on demand by the LLM
- Code Execution Sandbox — Docker-based Python sandbox with session persistence and SSE streaming
- Skills Open Standard — ZIP import/export compatible with agentskills.io
- Persistent Tool Memory — store and replay tool call results across conversation turns

## Current State

**Shipped:** v1.0 Knowledge Base Explorer — 2026-03-29
**Active:** v2.0 Agent Skills & Code Execution — Phase 11 complete (2026-04-01)
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector)
**Codebase:** ~9,200 LOC (Python + TypeScript)
**Phases shipped:** 11 phases (8 v1.0 + 3 v2.0), 25 plans, 30 tasks
**Design system:** Aether Intelligence — dark/light mode, CSS variables, Inter + Manrope fonts, glassmorphism

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

### Active

- [ ] Agent Skills with progressive discovery (`load_skill` / `save_skill` tools), full CRUD UI, global/private ownership model
- [ ] Skill Building-Block Files stored in Supabase Storage, listed on `load_skill`, read via `read_skill_file` tool
- ✓ Skill tool dispatch (`load_skill`, `save_skill`, `read_skill_file`) wired into LLM chat loop — v2.0 Phase 11
- ✓ Skill catalog injection into General Mode system prompt; Explorer Mode gated out — v2.0 Phase 11
- ✓ `skill_activated` SSE event emitted on tool dispatch; frontend callback wired (no-op until Phase 12 UI) — v2.0 Phase 11
- [ ] Code Execution Sandbox (Docker/llm-sandbox, session persistence by thread, SSE streaming, `SANDBOX_ENABLED` flag)
- [ ] Skills Open Standard ZIP import/export (agentskills.io format, SKILL.md frontmatter)
- ✓ Persistent Tool Memory — store tool results in JSONB, reconstruct full tool call history on conversation load — v2.0 Phase 9

### Out of Scope

- Automatic local folder scanning/import — Phase II feature, adds complexity
- Team-based folder sharing with access controls — Keep it simple: global or private only
- Real-time collaboration on folders — Not needed for current use case
- Folder-level permissions — Global folders visible to all, per-user folders private
- Switching to Docling — Existing pypdf + python-docx pipeline is working; full markdown stored from existing extraction

## Context

**Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance — configured purely via environment variables and migration SQL files.

**Schema (v1.0 shipped state):**
- `folders`: id, user_id, name, parent_id, is_global, created_at, updated_at — adjacency list with RLS
- `documents`: id, user_id, folder_id, filename, file_path, file_size, mime_type, status, full_markdown, chunk_count, content_hash, metadata, created_at, updated_at
- `document_chunks`: id, document_id, user_id, content, chunk_index, embedding (vector), search_vector (tsvector), created_at
- `threads`: id, user_id, folder_id (nullable FK → scoped chat), title, created_at
- `messages`, `profiles`, `user_settings`, `app_settings`

**Agent modes:**
- General: default chat with all tools (search, query_documents, web_search, analyze_document, ls, tree, grep, glob, read_document)
- Explorer: KB-focused mode with only KB tools (ls, tree, grep, glob, read_document, analyze_document), dedicated system prompt, max_iterations=8

**Key Difference from Claude Code:** Claude Code greps/globs raw source files. This knowledge base has PDFs, DOCX, etc. that need extraction first. The tools search *extracted markdown content* stored in Supabase, not raw files.

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

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Supabase deployment**: Agnostic — works with local Docker or cloud; all schema changes as numbered migration SQL files
- **Extraction**: Keep pypdf + python-docx pipeline — no Docling migration
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files

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
*Last updated: 2026-03-31 — Phase 10 complete (Agent Skills Core backend API)*
