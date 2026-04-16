# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent can explore the knowledge base like a filesystem, execute Python code in a sandboxed Docker container, and apply reusable named skills that users define, import, and export. Ships with General and Explorer mode toggles, a dedicated Skills management UI, and a full agentskills.io-compatible ZIP import/export standard.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

## Current Milestone: v2.3 Memory, Multimodal & Experience

**Goal:** Deepen agent intelligence with persistent memory and richer document understanding, then elevate the product feel with the Deep Midnight UI redesign.

**Target features:**
- F-03 Persistent Cross-Thread Memory
- F-07 Multi-Modal Table & Image Extraction
- F-09 Knowledge Health Dashboard
- F-10 User Feedback Loop
- UI Deep Midnight redesign (Tool Call Visualizer, Citations, Layout Shell, Mobile)

## Current State

**Shipped:** v2.2 Trust & Compliance — 2026-04-16 (Phases 26–32: citations, confidence, document versioning, audit log, suggested follow-up questions)
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage)
**Codebase:** ~15,000 LOC (Python + TypeScript)
**Phases shipped:** 30 phases (8 v1.0 + 9 v2.0 + 8 v2.1 + 5 v2.2), all requirements complete
**Design system:** Aether Intelligence — dark/light mode, CSS variables, Inter + Manrope fonts, glassmorphism
**Docker:** `llm-sandbox` container used for code execution (`SANDBOX_ENABLED=true`)
**Known tech debt:** Missing test files for phases 20 and 22 (test_blank_response_guards.py, test_rag_correctness.py); metadata ingest normalization covers only document_type/language; live LangSmith sub-agent trace not yet performed

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

*v2.1 milestone:*

- ✓ Rolling context window trimming with atomic tool-pair removal — prevents overflow on long conversations — v2.1 Phase 18
- ✓ Inter-iteration trim: tool result messages removed atomically between agent loop iterations — v2.1 Phase 18
- ✓ Sub-agent content cap (600k chars) enforced before API call; APIError "maximum" keyword detected — v2.1 Phase 19
- ✓ Blank response guards: force-no-tools empty content fallback + finish_reason=length error event — v2.1 Phase 20
- ✓ `load_skill`/`save_skill` `maybe_single()` hardening — informative tool result on None — v2.1 Phase 20
- ✓ Keyword search folder scope: `_keyword_search` + `keyword_search_chunks` RPC accept `folder_ids` — v2.1 Phase 21
- ✓ `read_document` context capped at 3,000 chars with truncation note — v2.1 Phase 22
- ✓ Metadata case normalization: `document_type`/`language` lowercased at ingest; all filter values lowercased at search — v2.1 Phase 22
- ✓ System prompt confidence hedging (similarity < 0.4) + structured citation format guidance — v2.1 Phase 23
- ✓ Settings file TTL cache (5s) on `_load_override()` — reduces per-message disk reads — v2.1 Phase 24
- ✓ Sentence boundary chunking fix: splits only when `.!?` followed by space or end-of-string — v2.1 Phase 24
- ✓ Sub-agent model auto-selection per provider (Haiku / GPT-4o-mini / Gemini Flash) — v2.1 Phase 25
- ✓ Provider-aware context budgets (Anthropic 120k, OpenAI 200k, Google 180k, OpenRouter 100k, Ollama 80k) — v2.1 Phase 25
- ✓ JSON token estimation corrected to chars/3 (from chars/4) for tool call JSON density — v2.1 Phase 25

### Active

*v2.2 milestone:*

- [x] F-01 (backend): citations SSE event with passage text, chunk_index, filename per retrieved chunk — validated Phase 26
- [x] F-05 (backend): confidence SSE event with high/medium/low level + avg_similarity + disclaimer for low — validated Phase 26
- [x] F-01 (frontend): collapsible citation cards showing exact retrieved passages beneath each answer — validated Phase 27
- [x] F-05 (frontend): Answer Confidence Score badge — colour-coded, Low adds disclaimer — validated Phase 27
- [x] F-02 (backend): document versioning — version_number + is_latest columns, re-upload creates new version, old chunks retired from all retrieval RPCs, citation cards show "(vN)" badge — validated Phase 28
- [x] F-02 (frontend): version history UI — version badge (vN chip), expandable VersionHistoryPanel, restore confirmation dialog, owner-only restore, is_latest-filtered document list — validated Phase 29
- [x] F-06 (backend): audit_log table with INSERT-only RLS, write_audit_entry service, all 8 action types instrumented across routers — validated Phase 30
- [x] F-06 (frontend): Audit Log section in Settings — date pills, action type filter, paginated table, CSV export — validated Phase 31
- [ ] F-08: Suggested Follow-Up Questions — 2–3 clickable follow-up pill buttons after each assistant response, non-blocking cheap model generation

### Out of Scope

- Automatic local folder scanning/import — Phase II feature, adds complexity
- Team-based folder sharing with access controls — Keep it simple: global or private only
- Real-time collaboration on folders — Not needed for current use case
- Folder-level permissions — Global folders visible to all, per-user folders private
- Switching to Docling — Existing pypdf + python-docx pipeline is working; full markdown stored from existing extraction
- Nyquist VALIDATION.md compliance — Phase-level validation files exist in draft state; full compliance deferred

### Deferred Architectural Decisions

#### Multi-Tenancy / Org-Level Transform (deferred to future milestone — clarity needed)

The current architecture is single-tenant per user. To support organizations (multiple users sharing a document library), the following changes are required:

**Schema additions:**
- `organizations` (id, name, slug, created_at)
- `org_memberships` (org_id, user_id, role: owner/admin/member, created_at)
- `documents` gains `org_id` (nullable FK) and `uploaded_by` (user_id) — ownership shifts from user to org
- `folders` gains `org_id` (nullable FK) — replaces the app-wide `is_global` flag with org-scoped visibility
- `document_chunks` gains `org_id` for RLS performance

**Behavioral changes:**
- Dedup scope: currently per-user (content_hash + user_id). At org level: per-org (content_hash + org_id) — same file uploaded by any member = one shared entry
- Version chain scope: currently per-user-per-filename. At org level: per-org-per-filename
- Global folders: retire `is_global` flag; replace with org-scoped folders visible to all org members
- RLS: all policies change from `user_id = auth.uid()` to `org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())`
- Delete permissions: org admin or uploader (not just owner)

**Why deferred:** Need clarity on whether orgs are isolated tenants (separate Supabase projects) or co-tenant (shared schema with org_id partitioning), and what the auth/billing model looks like before committing to a schema direction.

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
| chars/3 for JSON token estimation | JSON punctuation overhead (~33% more tokens than content estimate) means chars/4 underestimates tool call sizes | ✓ Good — existing trim tests pass, more accurate budget calculation |
| Provider-aware context budgets (hardcoded) | Dynamic context limit mapping adds complexity; hardcoded caps per provider are sufficient and reviewed at each model update | ✓ Good — avoids tiktoken dependency, covers all current providers |
| Sub-agent model auto-selection keyed by provider string | Match on `llm_provider` setting value; openrouter/ollama fall back to user model (routing unknown / local) | ✓ Good — 4-level resolution chain; backwards-compatible sentinel (0 = auto) |
| 3k char cap on read_document context injection | Large documents were flooding main agent context; 3k + truncation note preserves usefulness while protecting budget | ✓ Good — agents follow up with start_line/end_line for deeper reads |
| Ingest normalization covers only document_type/language | Other metadata fields (author, title, topics) stored as-is; search filter normalizes all strings at query time | — Pending — asymmetry is a known gap; full normalization deferred |
| Phases 18–24 executed without VERIFICATION.md | Fast execution cadence; integration checker substituted for formal verification pass | ⚠ Revisit — consider running /gsd:validate-phase retroactively for critical phases |

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
*Last updated: 2026-04-14 — Phase 31 complete: audit log settings UI shipped (F-06 frontend — date pills, action type filter, paginated table, CSV export in Settings page)*
