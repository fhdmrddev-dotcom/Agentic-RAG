# Progress

Track your progress through the masterclass. Update this file as you complete modules - Claude Code reads this to understand where you are in the project.

## Convention

- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

## Modules

### Module 1: App Shell + Observability ✅ COMPLETE

- [X] 0.1 Supabase schema (profiles, threads, messages + RLS)
- [X] 0.2 Backend scaffold (FastAPI + venv)
- [X] 0.3 Frontend scaffold (Vite + Tailwind + shadcn/ui)
- [X] 0.4 OpenAI vector store setup (run setup_vector_store.py, paste ID into backend/.env)
- [X] 1.1 Auth pages (sign in/sign up)
- [X] 2.1 Pydantic models
- [X] 2.2 OpenAI service + LangSmith tracing
- [X] 2.3 Threads & messages API
- [X] 3.1 API client + SSE utility
- [X] 3.2 Chat layout & components
- [X] 3.3 UX polish (thinking indicator, user/assistant avatars, LangSmith API key fix)

### Module 2: BYO Retrieval + Memory ✅ COMPLETE

- [X] Phase 1: Foundation (DB migration, config, types, Pydantic models)
  - [X] 1.1 DB migration: documents, document_chunks, HNSW index, RPC, Realtime
  - [X] 1.2 Backend config: LLM/embedding/retrieval settings
  - [X] 1.3 Frontend types: Document interface
  - [X] 1.4 DocumentResponse Pydantic model
- [X] Phase 2: LLM Service + Thread Model
  - [X] 2.1 openai_service.py: client factory, Chat Completions, embed_texts, tool schema
  - [X] 2.2 thread.py: removed openai_thread_id
- [X] Phase 3: Embedding + Retrieval Services
  - [X] 3.1 embedding_service.py: chunk_text, embed_chunks
  - [X] 3.2 retrieval_service.py: search_documents via pgvector RPC
- [X] Phase 4: Documents API + Threads Refactor
  - [X] 4.1 documents.py: upload/list/delete + background ingestion
  - [X] 4.2 threads.py: stateless history + tool-calling agentic loop
- [X] Phase 5: Router + Frontend API + Navigation
  - [X] 5.1 main.py: documents router registered
  - [X] 5.2 api.ts: listDocuments, uploadDocument, deleteDocument
  - [X] 5.3 Navigation: Sidebar Documents button, App/ChatLayout view routing
- [X] Phase 6: Ingestion Hook + UI Components
  - [X] 6.1 useDocuments hook with Supabase Realtime
  - [X] 6.2 IngestionPage, DocumentUpload, DocumentList, DocumentStatusBadge
- [X] Phase 7: Polish + Edge Cases
  - [X] 7.1 event_stream: length truncation, tool parse errors, API errors
  - [X] 7.2 Ingestion: empty file, UTF-8 decode error, embedding errors
  - [X] 7.3 PROGRESS.md updated

### Module 3: Record Manager ✅ COMPLETE

- [X] DB migration: `content_hash` column + indexes + unique constraint (`006_record_manager.sql`)
- [X] Backend: SHA-256 hash on upload + 3-case decision tree (skip duplicate / replace stale / new)
- [X] Pydantic: `content_hash: str | None` field on `DocumentResponse`
- [X] Frontend types: `content_hash: string | null` on `Document` interface
- [X] `api.ts`: `uploadDocument` returns `{ doc, isDuplicate }` using HTTP 200 vs 201
- [X] `useDocuments`: `upload` returns `Promise<{ isDuplicate: boolean }>`
- [X] `DocumentUpload`: shows "already up to date" notice on duplicate

### UX Enhancements (outside PRD modules) ✅ COMPLETE

- [X] Auto-title: LLM generates 4-6 word title after first exchange; sent as SSE event → sidebar updates instantly
- [X] Delete thread: `DELETE /threads/{id}`; messages cascade-delete in DB
- [X] Rename thread: `PATCH /threads/{id}`; inline edit via hover `...` menu in sidebar
- [X] `ThreadUpdate` Pydantic model; `deleteThread` + `renameThread` in api.ts + useThreads

#### Notes (Module 3)

- Run `006_record_manager.sql` in Supabase SQL editor before testing
- Existing rows will have `content_hash = null` — nullable field, no impact on existing data
- supabase-py v2: UPDATE does not return rows — do a follow-up SELECT to get updated row

### Module 4: Metadata Extraction ✅ COMPLETE

- [X] DB migration: `metadata` JSONB column + GIN index + updated `match_document_chunks` RPC (`007_document_metadata.sql`)
- [X] Pydantic: `DocumentMetadata` model (title, author, date, document_type, topics, language, summary)
- [X] Backend: `extract_metadata()` in `embedding_service.py` — LLM structured JSON output, best-effort (never blocks ingestion)
- [X] Backend: `ingest_document()` calls `extract_metadata()` and persists result to `documents.metadata`
- [X] Retrieval: `search_documents()` accepts optional `metadata_filter` dict, passes to RPC
- [X] Agent: `SEARCH_DOCUMENTS_TOOL` updated with optional `metadata_filter` parameter
- [X] Threads: parses `metadata_filter` from tool call args, passes to retrieval
- [X] Frontend types: `DocumentMetadata` interface + `metadata` field on `Document`
- [X] Frontend UI: expandable metadata panel in `DocumentList` (chevron toggle, topics as pill badges)

#### Notes (Module 4)

- Run `007_document_metadata.sql` then `007b_fix_match_document_chunks_overload.sql` in Supabase SQL editor before starting the backend
- Existing documents will have `metadata = null` — no impact on existing data or retrieval
- Metadata extraction uses `content[:3000]` to keep token usage low (~750 tokens per document)
- Uses `json_object` response format for broad OpenRouter/Ollama/LM Studio compatibility
- Extraction is best-effort — failures are logged but never block ingestion
- System prompt updated to guide LLM to use `metadata_filter` for scoped queries
- Sidebar fix: replaced Radix ScrollArea with plain div (ScrollArea viewport doesn't constrain child widths), three-dots menu uses absolute overlay with solid bg

### Module 5: Multi-Format Support ✅ COMPLETE

- [X] PDF extraction (pypdf), DOCX extraction (python-docx), HTML, Markdown — all supported
- [X] Cascade deletes (document_chunks → documents via ON DELETE CASCADE)

### Module 6: Hybrid Search & Reranking ✅ COMPLETE

- [X] DB migration: `search_vector tsvector` column + GIN index + trigger + backfill (`008_hybrid_search.sql`)
- [X] DB migration: dimension-agnostic `match_document_chunks` — removes `vector(1536)` hardcode (`008b_dynamic_vector_match.sql`)
- [X] Config: `hybrid_search_enabled`, `hybrid_candidate_count`, `vector/keyword_search_weight`, `rrf_k`, `embedding_dimensions`, `rerank_*` settings
- [X] `rerank_service.py`: API (Cohere via httpx) + local (sentence-transformers CrossEncoder, lazy-loaded), graceful fallback, LangSmith traceable
- [X] `retrieval_service.py`: hybrid RRF fusion (`_vector_search` + `_keyword_search` + `_rrf_fuse`), optional reranking, backward-compatible vector-only fallback
- [X] `requirements.txt`: added `sentence-transformers>=3.0.0`

#### Notes (Module 6)

- Run `008_hybrid_search.sql` then `008b_dynamic_vector_match.sql` in Supabase SQL editor
- Hybrid search is **enabled by default** (`HYBRID_SEARCH_ENABLED=true`) — set to `false` to revert to vector-only
- Reranking is **disabled by default** (`RERANK_ENABLED=false`) — no Cohere key required for normal operation
- Local reranking (`RERANK_PROVIDER=local`) auto-downloads `cross-encoder/ms-marco-MiniLM-L-6-v2` (~80MB) on first use
- Switching embedding models requires: update `EMBEDDING_MODEL` + `EMBEDDING_DIMENSIONS`, run `SELECT resize_embedding_column(N)`, re-ingest all documents

### Module 6.1: UI Settings — LLM Providers, Embedding, Reranking & Retrieval ✅ COMPLETE

- [X] DB migration: `009_user_settings_extended.sql` — adds llm_providers (JSONB), embedding_*, rerank_*, retrieval_* columns
- [X] `backend/app/models/user_settings.py` — `LLMProvider`, `UserEffectiveSettings`, `load_user_settings()`
- [X] `backend/app/api/settings.py` — full CRUD: GET /settings, PUT /providers, DELETE /providers/{id}, PATCH /providers/{id}/activate, PUT /embedding, PUT /reranking, PUT /retrieval
- [X] `backend/app/services/openai_service.py` — `get_llm_client()`, `get_embedding_client()`, `create_streaming_chat()`, `embed_texts()` accept optional `user_settings`
- [X] `backend/app/services/rerank_service.py` — `rerank()` accepts optional `user_settings`
- [X] `backend/app/services/retrieval_service.py` — `search_documents()` accepts optional `user_settings`; all config reads from effective settings
- [X] `backend/app/api/threads.py` — loads `UserEffectiveSettings` per-request, passes to all services
- [X] `frontend/src/lib/api.ts` — `FullAppSettings` type, new API functions for all settings sections
- [X] `frontend/src/pages/SettingsPage.tsx` — full rewrite: LLM Providers, Embedding, Reranking, Retrieval sections
- [X] `frontend/src/components/chat/ChatArea.tsx` — reads available_models from getSettings() (active provider)

#### Notes (Module 6.1)

- Run `009_user_settings_extended.sql` in Supabase SQL editor before starting the backend
- All new user_settings columns are nullable — NULL = use env default (zero user impact on existing rows)
- API keys are write-only: GET responses return `has_api_key: bool` only; empty string on PUT = keep existing key
- First provider added auto-activates; switching active provider updates chat model dropdown on next load

### Module 6.2: Settings Architecture Refactor ✅ COMPLETE

- [X] DB migration: `010_app_settings.sql` — global `app_settings` table (single row, `id='global'`); replaces per-user settings
- [X] DB migration: `011_cleanup_user_settings.sql` — drops all env-related columns from `user_settings`; adds `preferences jsonb` for future UI prefs
- [X] `backend/app/models/user_settings.py` — `load_app_settings(supabase)` reads global row + `.env` fallback; `_v()` treats NULL and empty string as unset
- [X] `backend/app/api/settings.py` — all settings read from `.env`; Settings UI is fully read-only (no DB writes)
- [X] `backend/app/services/openai_service.py` — `get_embedding_client()` falls back to `llm_api_key` + `llm_base_url` together (prevents key/endpoint mismatch)
- [X] `backend/app/api/documents.py` — replaced stale `user_settings` read with `load_app_settings()`
- [X] `frontend/src/pages/SettingsPage.tsx` — fully read-only dashboard showing LLM, Embedding, Reranking, Retrieval values from `.env`

#### Notes (Module 6.2)

- Run `010_app_settings.sql` then `011_cleanup_user_settings.sql` in Supabase SQL editor
- All settings come from `.env` — Settings page is an inspection dashboard only
- `user_settings` table is reserved for future user-specific UI preferences

#### Deferred: UI-Based LLM Provider Configuration

**Goal:** Allow adding/switching local model providers (Ollama, LM Studio, etc.) via the Settings UI without touching `.env`.

**What's needed:**
- Fix the root cause: old uvicorn process (different terminal session) stays alive on port 8000 with stale code after hot-reload — write logic must handle this gracefully, or document a restart requirement
- Implement: `PUT /settings/providers`, `DELETE /settings/providers/{id}`, `PATCH /settings/providers/{id}/activate` writing to `app_settings.llm_providers`
- The `app_settings` table and backend API already support this (migrations + handlers exist but UI is disabled)
- Re-enable editable LLM Providers section in `SettingsPage.tsx`

### Module 7: Additional Tools ✅ COMPLETE

- [x] Text-to-SQL tool (`query_documents` — RPC + sql_service.py, migration 012)
- [x] Web search fallback (`web_search` — Tavily via web_search_service.py, auto-disabled without key)
- [x] Multi-tool dispatch loop in threads.py
- [x] Updated system prompt with tool routing guidance
- [x] Multi-file upload (frontend only — useDocuments counter, DocumentUpload batch handling)

#### Notes (Module 7)

- Run `012_query_documents_fn.sql` in Supabase SQL editor before using the query_documents tool
- Add `TAVILY_API_KEY=tvly-...` to `backend/.env` to enable web search (tool is silently excluded when key is absent)
- `query_documents` is always available (no key required) — it queries the `documents` table via RPC with RLS enforced
- Multi-file upload: select or drag multiple files at once; each uploads concurrently; duplicate files are skipped gracefully

### Module 8: Sub-Agents ✅ COMPLETE

- [x] `analyze_document` tool — triggers sub-agent for full-document tasks (summarization, analysis)
- [x] `sub_agent_service.py` — isolated streaming LLM call with full document content
- [x] Multi-turn agentic loop (up to 5 iterations) — enables tool chaining (e.g. query_documents → analyze_document)
- [x] `ToolCallPanel.tsx` — nested tool call display with sub-agent streaming preview
- [x] `types/index.ts` — `ToolCall`, `SubAgentState` types added to `Message`
- [x] `useMessages.ts` — handles `tool_start`, `tool_end`, `sub_agent_start/delta/done` SSE events
- [x] `api.ts` — `streamMessage` wired for all sub-agent SSE event types
- [x] Fuzzy filename matching in `resolve_document_id` (partial match fallback)

#### Notes (Module 8)

- Sub-agent receives full document text (up to `SUB_AGENT_MAX_CHARS`, default 100k chars)
- Tool chaining works: LLM can call `query_documents` to find filename, then `analyze_document`
- Sub-agent output is streamed live in the ToolCallPanel, then fed back as tool result for LLM final response
- `tool_calls` are in-memory only (not persisted to DB) — they reset on page reload

#### Notes (Module 2)

- Run `002_module2_byo_retrieval.sql` in Supabase SQL editor before starting backend
- Create a `documents` Storage bucket in Supabase dashboard (public or private)
- Update `backend/.env`: replace OPENAI_API_KEY with LLM_API_KEY, add LLM_MODEL, EMBEDDING_MODEL, etc.

---

## Milestone: Knowledge Base Explorer (v1.0) ✅ COMPLETE — 2026-03-29

Build a hierarchical folder system + AI agent tools to explore the knowledge base like a filesystem.

### Phase 1: Folder Schema & Core APIs ✅ COMPLETE

- [x] Migration `013_folders.sql` — `folders` table with adjacency list, RLS, cascade deletes
- [x] Pydantic models — `FolderCreate`, `FolderRename`, `FolderResponse`
- [x] `backend/app/api/folders.py` — full CRUD: POST, GET /folders, GET /folders/{id}/children, PATCH /folders/{id}/rename, DELETE /folders/{id}
- [x] Global folder visibility — `is_global` flag, RLS uses `.or_()` to include global folders for all users

#### Notes (Phase 1)

- Run `013_folders.sql` in Supabase SQL editor (or `supabase db push` for local Docker)
- Global folders are visible to all users; per-user folders are private (RLS enforced)

### Phase 2: Document-Folder Integration ✅ COMPLETE

- [x] Migration `014_document_folder_integration.sql` — adds `folder_id` (nullable FK → folders, ON DELETE SET NULL) and `full_markdown` (text) to `documents`
- [x] `DocumentResponse` gains `folder_id` field; new `DocumentMoveRequest` and `FolderMoveRequest` models
- [x] `PATCH /documents/{id}/move` — move document to folder or root (folder_id: null)
- [x] `PATCH /folders/{id}/move` — move folder to new parent with ownership validation
- [x] Upload endpoint accepts `folder_id` form field; validates folder accessibility before insert
- [x] `full_markdown` stored on ingest completion for grep/read tool use later

#### Notes (Phase 2)

- Run `014_document_folder_integration.sql` in Supabase SQL editor before using move endpoints
- 51 integration tests passing (24 document + 27 folder)

### Phase 3: Ingestion UI ✅ COMPLETE

- [x] Plan 01: useFolders hook + Folder types + buildFolderTree utility + api.ts folder methods + Realtime subscription
- [x] Plan 02: FolderNode, FolderCreateInput, FolderTree components with 19 tests (TDD), shadcn dialog + tooltip installed
- [x] Plan 03: Two-panel IngestionPage — folder tree (left 260px), DocumentUpload with folder targeting + dynamic label, DocumentList with folder filtering, human-verified

#### Notes (Phase 3)

- Global folders visible to all users; created via API only (no UI toggle in v1.0)
- Realtime folder sync uses no user_id filter — RLS enforces row isolation
- shadcn CLI on Windows creates files in literal `@/` dir — copy manually to `src/components/ui/`

### Phase 4: Navigation Tools ✅ COMPLETE

- [x] Plan 01: `/kb/ls` endpoint — lists immediate contents at a folder path; shared helpers `_fetch_visible_folders`, `_build_tree_map`, `_resolve_path`; 5 integration tests
- [x] Plan 02: `/kb/tree` endpoint — depth-limited recursive folder serialization with `truncated` indicators; `_collect_folder_ids` BFS + `_serialize_tree`; 4 integration tests
- [x] Patch: `ls_path()` + `tree_path()` service helpers extracted from endpoints; `LS_TOOL` + `TREE_TOOL` registered in `openai_service.py`; dispatch wired in `threads.py`; system prompt updated to 6 tools

#### Notes (Phase 4)

- `ls` tool: agent lists folder contents by path (use `path='/'` for root)
- `tree` tool: agent gets full hierarchy as nested JSON; optional `depth` parameter limits expansion
- Both tools respect RLS — users see only their own + global folders
- `query_documents` retained for analytical/SQL-style questions (counts, joins, filters)

### Phase 5: Search Tools ✅ COMPLETE

- [x] Plan 01: `/kb/grep` endpoint — regex search over `full_markdown` content, path-scoped, returns matching document names; `grep_path()` helper; `GREP_TOOL` registered; 5 integration tests
- [x] Plan 02: `/kb/glob` endpoint — filename pattern matching with `**` recursive support, `glob_path()` helper; `GLOB_TOOL` registered; `GREP_TOOL + GLOB_TOOL` dispatched in `threads.py`; system prompt updated to 8 tools; 4 integration tests

#### Notes (Phase 5)

- `grep` searches extracted markdown content (`full_markdown`) — only works on ingested documents
- `glob` matches against both full path and filename alone (e.g., `*.pdf` matches regardless of folder depth)
- `**` glob patterns use regex internally (`fnmatch` does not support recursive path segments)
- System prompt now routes: `ls`/`tree` for navigation, `grep`/`glob` for finding, `search_documents` for semantic, `query_documents` for SQL-style

### UI Enhancement: Rich Tool Call Display ✅ COMPLETE

- [x] `ToolCallPanel.tsx` — distinct icons for `ls` (FolderOpen), `tree` (GitBranch), `grep` (TextSearch), `glob` (FileSearch)
- [x] Collapsed state shows result count badge ("2 folders, 5 documents" / "12 matches")
- [x] Expanded state renders structured listings: `ls` → folder + file sections with status badges; `tree` → recursive indented hierarchy (3 levels); `grep`/`glob` → scrollable filename/path lists in monospace
- [x] Defensive JSON parsing (try/catch on `tool_call.result`) — graceful error display on parse failure

### Phase 6: Read Tool ✅ COMPLETE

- [x] Plan 01: `ReadResponse` Pydantic model, `read_path()` helper (1-based line slicing, clamp), `GET /kb/read` endpoint, `READ_DOCUMENT_TOOL` registered in `get_tools()`, `threads.py` handler, system prompt updated to 9 tools; 5 integration tests (24 total passing)
- [x] Plan 02: `ToolCallPanel.tsx` extended — `BookOpen` icon, "Reading document" label, collapsible `ReadDocumentResult` with `ScrollArea` + monospace `<pre>`, error styling in `text-destructive`

#### Notes (Phase 6)

- `read` tool accepts a path and optional `start_line`/`end_line` (1-based, inclusive); omitting line params returns full document
- Line numbers are prepended to each line in the response for easy navigation
- `full_markdown` fetched directly from `documents` table — only works on ingested documents
- System prompt now references 9 tools; `read_document` positioned at slot 5

### Phase 7: Explorer Sub-Agent ✅ COMPLETE

- [x] Plan 01: Backend explorer mode — `agent_mode="explorer"` parameter on POST /threads/{id}/messages; distinct `EXPLORER_SYSTEM_PROMPT`; KB-only tool set (6 tools); max_iterations raised to 8; default mode unchanged
- [x] Plan 02: Frontend agent mode selector — General/Explorer dropdown in MessageInput toolbar; `agentMode` state in ChatArea; threaded through `useMessages.sendMessage` → `streamMessage` → POST body as `agent_mode`

#### Notes (Phase 7)

- Explorer mode accessible via the mode selector dropdown in the chat input toolbar (Compass icon)
- Selecting Explorer sends `agent_mode="explorer"` to the backend; General mode sends `agent_mode="default"`
- Mode defaults to General on page load and resets on thread switch (agentMode state lives in ChatArea)

### Phase 8: Folder System Enhancements ✅ COMPLETE

- [x] Plan 01: Global folder toggle — migration `015_global_folder_document_rls.sql` (documents RLS updated for global folder visibility), `PATCH /folders/{id}/toggle-global` backend endpoint (owner-only, 403 for non-owners), Globe toggle button in FolderNode hover actions, isGlobal checkbox in FolderCreateInput
- [x] Plan 02: Folder-scoped chat threads — migration `016_thread_folder_scope.sql` (folder_id on threads, updated match_document_chunks RPC with p_folder_ids), backend subtree resolution + scoped tool dispatch, frontend folder picker dropdown + scope badge in chat header + folder icon in sidebar
- [x] Plan 03: Folder detail info bar — `FolderDetail.tsx` component (doc count, total size, global badge, subfolder count, creation date), mounted in IngestionPage between breadcrumb and upload

#### Notes (Phase 8)

- Run `015_global_folder_document_rls.sql` and `016_thread_folder_scope.sql` in Supabase SQL editor (or `supabase db push`)
- Global folder toggle: only the folder owner can toggle; non-owners receive 403
- Folder-scoped threads: scope is fixed at creation; deleting the scoped folder reverts thread to unscoped (ON DELETE SET NULL)
- Human verification required: cross-user RLS testing, live scope badge rendering, and retrieval restriction validation require a running app with multiple Supabase sessions

---

### UI Enhancement: Aether Intelligence Design System ✅ COMPLETE

> **Agent:** Antigravity (Google DeepMind)
> **Date:** 2026-03-29
> **Scope:** Visual-only — zero functionality, hooks, API, or data structure changes.

A complete visual overhaul of the frontend implementing the "Aether Intelligence" design system with **dark + light mode support** and a sidebar theme toggle.

#### Design System Foundation

- [x] `frontend/index.html` — Google Fonts (Inter + Manrope), `<meta>` SEO tags, FOUC prevention `<script>` that applies `dark` class before first paint
- [x] `frontend/src/index.css` — **Complete rewrite.** CSS variable system (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--success`, `--sidebar`, etc.) with two modes:
  - `:root` = light mode (soft bluish-grey `hsl(220 20% 97%)`)
  - `.dark` = dark mode (deep navy `hsl(216 45% 4%)`)
  - Custom utility classes: `.glass`, `.glass-strong`, `.ghost-border`, `.gradient-primary`, `.gradient-primary-text`, `.font-headline`
  - Keyframe animations: `fadeSlideUp`, `pulseGlow`, `shimmer`, `dotPulse`
  - Full markdown rendering styles (`.markdown h1/h2/h3/p/ul/ol/code/pre/table/blockquote`)
  - Custom scrollbar styling
- [x] `frontend/tailwind.config.js` — **Complete rewrite.** `darkMode: ["class"]`, extended with:
  - Font families: `sans` (Inter), `headline` (Manrope), `mono` (JetBrains Mono)
  - All semantic colors mapped to CSS variables (`background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `border`, `input`, `ring`, `sidebar`)
  - Custom keyframes (`fadeSlideUp`, `pulseGlow`) and animation utilities
  - Plugins: `tailwindcss-animate`, `@tailwindcss/typography`

#### Theme Hook (NEW FILE)

- [x] `frontend/src/hooks/useTheme.ts` — **New file.** Exports `useTheme()` hook:
  - Returns `{ theme, toggleTheme, setTheme }`
  - Persists to `localStorage` key `"theme"`
  - Respects `prefers-color-scheme: dark` on first visit
  - Toggles `.dark` class on `document.documentElement`

#### Component Visual Updates (no logic changes)

All components below were visually updated. **No hooks, props, state, API calls, or data handling were changed.** Only Tailwind classes and JSX structure were modified.

| File | Key Visual Changes |
|------|--------------------|
| `ToolCallPanel.tsx` | Color-coded tool icons (amber=web_search, emerald=query_docs, violet=analyze), `pulseGlow` animation on running tools, gradient left accent on sub-agent blocks, `ghost-border` instead of solid borders, collapsible result previews with count summaries |
| `MessageItem.tsx` | User bubbles use `gradient-primary` (indigo→violet) instead of flat `bg-primary`, bot avatar uses gradient circle, `fadeSlideUp` entrance animation, animated thinking dots (3 pulsing circles), streaming cursor bar |
| `MessageList.tsx` | `max-w-4xl mx-auto` container for centered content, `px-6 py-6` padding |
| `MessageInput.tsx` | Glassmorphism container (`bg-card/80 backdrop-blur-sm`), pill-shaped model/agent selectors, gradient send button, focus glow ring (`ring-primary/30`), keyboard shortcut hint |
| `ChatArea.tsx` | Gradient `Sparkles` icon in empty state, `font-headline` (Manrope) headings, frosted glass header (`backdrop-blur-md`), refined folder scope selector |
| `Sidebar.tsx` | **Theme toggle button** (Sun/Moon icons), gradient logo with shadow, left accent line on active thread, `ghost-border` on New Chat button, tonal depth instead of borders |
| `ChatLayout.tsx` | Imports and passes `useTheme()` → `theme`/`onToggleTheme` to Sidebar; removed explicit border separator |
| `MarkdownRenderer.tsx` | No changes — markdown styling handled entirely via `index.css` `.markdown` classes |

#### Page Visual Updates

| File | Key Visual Changes |
|------|--------------------|
| `AuthPage.tsx` | Gradient background orbs (blurred circles), glassmorphism card (`backdrop-blur-sm`), gradient Sparkles logo, Manrope title |
| `IngestionPage.tsx` | `font-headline` heading, `ghost-border` folder tree card with `bg-card/50` |
| `SettingsPage.tsx` | `ghost-border` cards with `bg-card/50`, `.env` pill badges, `divide-border/30` separators, Manrope headings |

#### Color Palette Reference

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--background` | `hsl(220 20% 97%)` soft blue-grey | `hsl(216 45% 4%)` deep navy |
| `--foreground` | `hsl(222 47% 11%)` near-black | `hsl(226 60% 97%)` near-white |
| `--primary` | `hsl(239 84% 67%)` indigo | `hsl(239 100% 82%)` bright indigo |
| `--card` | `hsl(0 0% 100%)` white | `hsl(220 30% 7%)` dark navy |
| `--muted` | `hsl(220 14% 94%)` light grey | `hsl(220 30% 11%)` charcoal |
| `--border` | `hsl(220 13% 89%)` silver | `hsl(220 20% 16%)` dark border |
| `--success` | `hsl(142 71% 45%)` green | `hsl(142 71% 45%)` green |
| `--sidebar` | `hsl(220 15% 95%)` off-white | `hsl(220 40% 5%)` darker navy |

#### Typography

- **Headlines** (`font-headline`): Manrope 500–800 weight
- **Body/labels** (`font-sans`): Inter 400–700 weight
- **Code** (`font-mono`): JetBrains Mono (system fallback)
- Loaded via Google Fonts `<link>` in `index.html`

#### Critical Notes for Other Agents

1. **Theme mechanism**: Dark mode uses `.dark` class on `<html>`. All colors use CSS variables — never hardcode `text-white` or `bg-gray-900`. Use semantic tokens (`text-foreground`, `bg-background`, `bg-card`, `text-muted-foreground`, etc.).
2. **New components should follow the pattern**: Use `ghost-border` for subtle borders, `bg-card/50` for card backgrounds, `font-headline` for headings, `gradient-primary` for accent elements.
3. **Animations**: Use `animate-fadeSlideUp` for entrance animations, `animate-pulseGlow` for active/running states.
4. **The `useTheme` hook** lives in `src/hooks/useTheme.ts` and is consumed in `ChatLayout.tsx` → passed to `Sidebar.tsx`. If you add a new layout that needs theme awareness, import `useTheme` directly.
5. **Test files** (`src/__tests__/components/MessageItem.test.tsx`) check old CSS class names (e.g., `.bg-primary.text-primary-foreground`) that no longer exist. These tests need updating if you run `tsc -b` (Vite build passes fine since tests are runtime-only).
6. **No functionality was changed.** All hooks (`useAuth`, `useMessages`, `useThreads`, `useDocuments`, `useFolders`), API functions (`api.ts`), types (`types/index.ts`), and backend endpoints remain identical.
---

### Module 9: Enhanced Transparency ✅ COMPLETE

- [x] **Execution Timing** — `startedAt`/`endedAt` timestamps on tool calls; frontend calculates and displays duration (e.g. "1.2s") per tool
- [x] **Total Duration** — aggregate duration shown in ToolCallPanel header (e.g. "Used 3 tools • 4.5s")
- [x] **Recursive Result Capture** — SSE `tool_end` event now carries the tool result payload (truncated to 2000 chars); frontend captures and displays without extra API calls
- [x] **Parameter Visibility** — collapsible "parameters" block (`Code2` icon) reveals exact arguments sent to the tool
- [x] **Rich Result Renderers**:
  - [x] `search_documents` — shows top chunks, filenames, and similarity scores
  - [x] `query_documents` — displays raw SQL result text
  - [x] `web_search` — renders markdown search summaries
  - [x] Fallback — generic JSON/text preview for custom tools

#### Notes (Module 9)

- **Zero Token Cost** — all transparency data is derived from existing SSE stream events; no additional LLM calls or tokens consumed
- **Persistence** — tool results and timestamps are stored in the message state; they persist through the current session but are not saved to the DB (v1.0 behavior)
- **Truncation** — backend truncates results to 2000 chars to keep SSE message sizes manageable while providing enough context for debugging
- **UI Alignment** — long tool summaries and results use `truncate` and `ScrollArea` to prevent layout breaking on mobile/narrow screens

---

### Module 10: UI & Navigation Refinement ✅ COMPLETE

- [x] **Document Type Column** — Added "Type" column to the Document Library table with beautiful, color-coded `lucide-react` icons (Red PDF, Blue Word, Emerald Excel, etc.).
- [x] **Sidebar Reorganization** — Restructured sidebar into distinct "Chat" and "Knowledge Base" sections for better mental mapping.
- [x] **Premium New Chat Button** — Styled the "New Chat" button with a `gradient-primary` background, white text, and a subtle shadow to make it the primary call-to-action.
- [x] **Consistent Spacing** — Standardized line heights and padding across sidebar items for a more premium, "Aether" feel.

#### Notes (Module 10)

- **Icons** — Uses a lookup table based on file extension to assign icons and colors.
- **Sectioning** — "Chat" contains the thread list; "Knowledge Base" group Documents, Skills, and Settings.
- **Mobile Friendly** — All new elements use `truncate` to prevent horizontal overflow on narrow sidebars.
- **Visual Only** — No changes to backend APIs or frontend state management logic.

---

## Milestone: Agent Skills & Code Execution (v2.0) — IN PROGRESS

### Phase 9: Persistent Tool Memory ✅ COMPLETE (2026-03-29)

- [x] `tool_call_id` persisted in `tool_calls` JSONB alongside name, args, result, status
- [x] `_reconstruct_history()` emits proper multi-turn sequences: `assistant (tool_calls)` → `tool (result)` → `assistant (text)`
- [x] Backward-compatible: old messages without `tool_call_id` fall back to plain assistant emission
- [x] Tool results capped at 2000 chars (existing cap preserved)

### Phase 10: Agent Skills Core ✅ COMPLETE (2026-03-31)

- [x] DB migration `017_skills.sql` — `skills` + `skill_files` tables, RLS, indexes, `skill-files` Storage bucket
- [x] Pydantic models: `SkillCreate`, `SkillUpdate`, `SkillResponse`, `SkillFileResponse`
- [x] `backend/app/api/skills.py` — full CRUD: list, create, update, delete, toggle-enabled, toggle-global
- [x] File attachment endpoints: upload, list, delete (stored in `skill-files` Supabase Storage bucket)
- [x] RLS: users can only access their own skills and files (global skills visible to all authenticated users)

#### Notes (Phase 10)

- Run `017_skills.sql` in Supabase SQL editor before using Skills endpoints
- Create a `skill-files` Storage bucket in Supabase dashboard
- 28 pre-existing test failures noted in `deferred-items.md` (existed before Phase 10, unrelated to skills)

### Phase 11: Skills LLM Integration ✅ COMPLETE (2026-04-01)

- [x] Skill catalog (name + description) injected into General Mode system prompt each turn
- [x] `LOAD_SKILL_TOOL`, `SAVE_SKILL_TOOL`, `READ_SKILL_FILE_TOOL` constants in `openai_service.py`
- [x] `load_skill` dispatch: returns full instructions + file list
- [x] `save_skill` dispatch: create or update skill from conversation
- [x] `read_skill_file` dispatch: resolves owner `user_id`, reads from storage
- [x] `skill_activated` SSE event emitted before DB query in `load_skill` handler
- [x] Explorer Mode excludes all skill tools (unchanged: 6 KB tools only)

### Phase 12: Skills UI ✅ COMPLETE (2026-04-02)

- [x] Skills tab in sidebar (Zap icon) — routes to `SkillsPage`
- [x] `useSkills` hook: list, create, update, delete, toggle-enabled, toggle-global (optimistic updates)
- [x] `SkillCard` component: enabled/disabled dimming, Global badge, Try in Chat, Edit, Delete
- [x] `SkillFormDialog`: create/edit modal with name, description, instructions fields
- [x] "Try in Chat" prefills MessageInput with "Use the [Skill Name] skill" (state lifted to `App.tsx`)
- [x] `skill_activated` SSE indicator in chat: "Skill activated: {name}" with Zap icon
- [x] Seed migration `018_seed_skill_creator.sql` — global "skill-creator" skill pre-loaded for all users

#### Notes (Phase 12)

- Run `018_seed_skill_creator.sql` in Supabase SQL editor to seed the skill-creator global skill
- `useSkills` has no Realtime subscription — skills table not in realtime publication; optimistic updates only

### Phase 13: Skills Open Standard ✅ COMPLETE (2026-04-02)

- [x] `POST /skills/import` — ZIP import: parses `SKILL.md` manifest, bulk-inserts skills (atomicity via two-phase parse)
- [x] `GET /skills/{id}/export` — ZIP export: generates `SKILL.md` + attached files in ZIP
- [x] Frontend: `exportSkill` + `importSkillZip` in `api.ts`; Import/Export buttons on `SkillsPage`
- [x] Path traversal protection on file entries (`normpath` + `startswith('..')` + `isabs()` guards)
- [x] `POST /import` registered before `PATCH /{skill_id}` — avoids FastAPI route shadowing

#### Notes (Phase 13)

- Import endpoint uses `getAuthToken()` not `getAuthHeaders()` — FormData sets its own Content-Type
- Export endpoint uses `getAuthToken()` not `getAuthHeaders()` — must not set `Content-Type: application/json` on blob download

### Phase 14: Code Execution Sandbox ✅ COMPLETE (2026-04-03)

- [x] DB migration `019_sandbox_sessions.sql` — `sandbox_sessions` table + RLS
- [x] `SandboxManager` (`sandbox_service.py`) — Docker session manager, lazy `llm_sandbox` import, module-level `_sessions`/`_last_used` dicts
- [x] `EXECUTE_CODE_TOOL` in `openai_service.py`; added to `get_tools()` when `SANDBOX_ENABLED=true`
- [x] SSE streaming via `asyncio.Queue` bridge (thread pool → coroutine): `code_execution_start`, `code_execution_stdout`, `code_execution_stderr`, `code_execution_complete` events
- [x] `harvest_output_files` — copies files written to `/output` in container to temp dir, returns download metadata
- [x] `DELETE /threads/{id}` cleanup extended to terminate sandbox sessions
- [x] `sandbox_enabled` defaults to `False` — opt-in, never breaks existing deployments

#### Notes (Phase 14)

- Run `019_sandbox_sessions.sql` in Supabase SQL editor
- Set `SANDBOX_ENABLED=true` in `backend/.env` to enable (requires Docker running)
- Default session timeout: `SANDBOX_SESSION_TIMEOUT_SECONDS=300`; max iterations raised to 12

### Phase 15: Code Output UI ✅ COMPLETE (2026-04-03)

- [x] `OutputLine` and `OutputFile` interfaces + 5 code execution fields on `ToolCall` type (`types/index.ts`)
- [x] Four SSE callbacks wired in `streamMessage()`: `onCodeExecutionStart/Stdout/Stderr/Complete`
- [x] Live stdout/stderr accumulation in `useMessages.ts` via functional `setMessages` updater (interleaved `outputLines` array)
- [x] `ExecuteCodeBlock.tsx` — streaming terminal panel: `TerminalOutput` (auto-scroll, green/red lines), `OutputFileCard` (download link), 4 execution states (running/success/error/connecting)
- [x] `ToolCallPanel.tsx` — execute_code routes to `ExecuteCodeBlock`; reload fallback parses `tc.result` JSON for ephemeral fields

#### Notes (Phase 15)

- VERIFICATION.md pending (Phase 17 task — SAND-12 already marked `[x]` in REQUIREMENTS.md)
- No automated tests added; browser verification (Task 3 human checkpoint) outstanding

### Phase 16: Skill File Management UI ✅ COMPLETE (2026-04-04)

- [x] `SkillFile` interface in `types/index.ts`
- [x] `listSkillFiles`, `uploadSkillFile`, `deleteSkillFile` in `api.ts` (uses `getAuthToken()` for multipart)
- [x] `SkillFormDialog.tsx` — "Attached Files" section in edit mode: list files, Attach File button (file picker), delete per-file; gated by `isOwner` for global skills
- [x] Optimistic state: upload appends immediately, delete filters immediately — no re-fetch needed
- [x] 6 automated tests for the 3 new API functions (28 suite tests pass)

#### Notes (Phase 16)

- File section is only rendered in edit mode (`isEdit && skill`) — never shown in New Skill dialog
- `isOwner` derived client-side from `skill.user_id === currentUserId` — matches existing SkillCard pattern
