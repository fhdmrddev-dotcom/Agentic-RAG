# Knowledge Base Explorer

## What This Is

A Claude Code-inspired exploration layer built on top of the existing Agentic RAG application. Users organize documents into nested folders (global or personal), and the AI agent can navigate, search, and read that structure using filesystem-like tools — just like Claude Code explores codebases.

## Core Value

The agent can explore the knowledge base the same way Claude Code explores codebases — navigating folders, pattern-matching filenames, searching content, and reading specific documents.

## Current Milestone: v1.0 Knowledge Base Explorer

**Goal:** Build a hierarchical folder system with agent-facing KB exploration tools (ls, tree, grep, glob, read) and an orchestrating explorer sub-agent.

**Target features:**
- Nested folder structure (global + per-user) with CRUD APIs
- Document-folder integration + full markdown storage
- Ingestion UI with folder tree visualization
- Navigation tools: `ls`, `tree`
- Search tools: `grep`, `glob`
- Read tool: full document and line-range reading
- Explorer sub-agent orchestrating all KB tools

## Requirements

### Validated

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

### Validated

- ✓ Nested folder structure with unlimited depth — Phase 1
- ✓ Global folders (shared across all users) and per-user folders (private) — Phase 1
- ✓ Document-folder integration (folder_id FK on documents, move document, move folder) — Phase 2
- ✓ Store full extracted markdown alongside chunks for grep/read operations — Phase 2

### Active

- ✓ `ls` tool — list files and subfolders in a given path — Validated in Phase 04: navigation-tools
- ✓ `tree` tool — hierarchical structure with depth limit and truncation — Validated in Phase 04: navigation-tools
- ✓ `grep` tool — regex search over document content, returns matching document names — Validated in Phase 05: search-tools
- ✓ `glob` tool — file pattern matching against document names (e.g., `*.md`, `reports/**/*.pdf`) — Validated in Phase 05: search-tools
- ✓ `read` tool — read full document or line range (split at newlines) — Validated in Phase 06: read-tool
- [ ] Explorer sub-agent — orchestrates KB tools + document analysis agent for deep exploration
- [ ] Folder CRUD in ingestion UI (create, rename, delete folders)
- [ ] Upload files to selected folder in UI
- [ ] Visual indicator in UI for global vs per-user folders

### Out of Scope

- Automatic local folder scanning/import — Phase II feature, adds complexity
- Team-based folder sharing with access controls — Keep it simple: global or private only
- Real-time collaboration on folders — Not needed for current use case
- Folder-level permissions — Global folders visible to all, per-user folders private
- Switching to Docling — Existing pypdf + python-docx pipeline is working; full markdown stored from existing extraction

## Context

**Existing Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance — deployment is configured purely via environment variables and migration files. Documents are ingested via pypdf + python-docx, chunked, embedded, and stored in Postgres. Currently no folder hierarchy — documents are flat per-user.

**Current Schema (what exists):**
- `documents`: id, user_id, filename, file_path, file_size, mime_type, status, error_message, chunk_count, content_hash, metadata, created_at, updated_at — **no folder_id, no full_markdown**
- `document_chunks`: id, document_id, user_id, content (chunk text), chunk_index, embedding (vector), search_vector (tsvector), created_at
- `threads` + `messages` + `profiles` + `user_settings` + `app_settings`
- No `folders` table exists yet

**Schema Changes This Milestone:**
- Phase 1: CREATE `folders` table (id, user_id, name, parent_id, is_global, created_at, updated_at) with adjacency list + RLS
- Phase 2: ADD `folder_id` (nullable FK → folders) and `full_markdown` (text) to `documents`

**Key Difference from Claude Code:** Claude Code greps/globs raw source files. This knowledge base has PDFs, DOCX, etc. that need extraction first. The tools search *extracted markdown content* stored in Supabase, not raw files.

**Sub-agent Pattern:** Existing sub-agent (Module 8) loads full document content into isolated context. Explorer sub-agent will follow the same pattern but with access to all KB tools.

**Modules History:** 8 modules completed (auth, BYO retrieval, record manager, metadata, multi-format, hybrid search + settings, additional tools, sub-agents).

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Supabase deployment**: Agnostic — works with local Docker or cloud; all schema changes delivered as numbered migration SQL files
- **Extraction**: Keep pypdf + python-docx pipeline — no Docling migration in v1.0
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction from chunks | Implemented in Phase 2 — `full_markdown` column on documents, stored on ingest |
| Unlimited folder nesting depth | Flexibility like a real filesystem | Implemented in Phase 1 — adjacency list with no depth limit |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | Implemented in Phase 1 — `is_global` flag on folders with RLS |
| grep returns document names only | Keeps output lightweight; use read for content | Implemented in Phase 5 — `grep_path` returns id/filename/folder_id only |
| tree uses depth limit + truncation | Protects context window for large KBs | Implemented in Phase 4 — `truncated=True` on cut nodes, depth param |
| Keep pypdf + python-docx (not Docling) | Already working; avoids migration risk | — Pending |

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
*Last updated: 2026-03-22 after Phase 5 complete (search-tools)*
