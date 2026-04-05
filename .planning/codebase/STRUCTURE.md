# Codebase Structure
_Last updated: 2026-04-05_

## Top-Level Directory Layout

```
Agentic RAG/
├── backend/                  # Python FastAPI backend
├── frontend/                 # React + Vite frontend
├── supabase/                 # Supabase config + migrations
│   └── migrations/           # SQL migration files (run in order)
├── e2e/                      # End-to-end tests
├── test-cases/               # Manual test case documentation
├── .agent/plans/             # Agent execution plans
├── .planning/codebase/       # GSD codebase analysis documents (this file)
├── CLAUDE.md                 # Project rules and conventions for Claude Code
├── PROGRESS.md               # Module completion tracking
├── CONTEXT-MANAGEMENT.md     # Notes on context window management
├── SKILLS_GUIDE.md           # Guide for creating and using skills
└── start_supabase.bat        # Windows dev startup helper
```

## Backend Structure (`backend/`)

```
backend/
├── app/
│   ├── main.py               # FastAPI app factory, CORS, router registration
│   ├── config.py             # Pydantic-settings: all env var config + LLM provider resolution
│   ├── dependencies.py       # FastAPI dependencies: get_supabase(), get_current_user()
│   ├── api/
│   │   ├── threads.py        # POST /threads/{id}/messages (SSE), CRUD threads
│   │   ├── documents.py      # POST /documents/upload, GET/DELETE/PATCH documents
│   │   ├── folders.py        # CRUD folders + move operations
│   │   ├── kb.py             # GET /kb/ls|tree|grep|glob|read + callable ls_path() etc.
│   │   ├── skills.py         # CRUD skills + skill files, ZIP import/export
│   │   └── settings.py       # GET /settings (read-only dashboard)
│   ├── models/
│   │   ├── thread.py         # ThreadCreate, ThreadResponse, ThreadUpdate
│   │   ├── message.py        # MessageCreate, MessageResponse
│   │   ├── document.py       # DocumentResponse, DocumentMetadata, DocumentMoveRequest
│   │   ├── folder.py         # FolderCreate, FolderRename, FolderResponse, FolderMoveRequest
│   │   ├── kb.py             # LsResponse, TreeResponse, GrepResponse, GlobResponse, ReadResponse
│   │   ├── skill.py          # SkillCreate, SkillResponse, SkillFileResponse, SkillImportResult
│   │   └── user_settings.py  # LLMProvider, UserEffectiveSettings, load_user_settings()
│   ├── services/
│   │   ├── openai_service.py # LLM client factory, tool schemas, create_streaming_chat(), embed_texts()
│   │   ├── embedding_service.py  # chunk_text(), embed_chunks(), extract_metadata()
│   │   ├── retrieval_service.py  # search_documents(), hybrid RRF, resolve_document_id(), fetch_full_document()
│   │   ├── rerank_service.py     # rerank() — Cohere API or local CrossEncoder
│   │   ├── sql_service.py        # query_documents() — Text-to-SQL via Supabase RPC
│   │   ├── web_search_service.py # web_search() — Tavily API
│   │   ├── sub_agent_service.py  # run_sub_agent() — isolated streaming LLM call
│   │   └── sandbox_service.py    # SandboxSessionManager, Docker-based Python execution
│   └── utils/
│       └── folder_utils.py   # fetch_visible_folders(), is_in_global_subtree(), get_globally_visible_folder_ids()
├── scripts/                  # Utility scripts (e.g. setup_vector_store.py)
├── tests/                    # Backend integration tests (pytest)
├── requirements.txt          # Python dependencies
├── pytest.ini                # pytest configuration
├── settings_override.json    # Runtime settings override (gitignored, overrides .env)
└── venv/                     # Python virtual environment (gitignored)
```

### Key Backend Files

- `backend/app/main.py` — FastAPI app, CORS middleware, lifespan (sandbox cleanup on shutdown), router registration, `/health` and `/models` endpoints.
- `backend/app/config.py` — Single `Settings` object (pydantic-settings). All env vars documented here. `LLM_PROVIDER` validator resolves to `llm_api_key`/`llm_base_url`.
- `backend/app/dependencies.py` — Singleton Supabase service-role client; `get_current_user()` JWT validation dependency.
- `backend/app/api/threads.py` — Largest file. Contains `SYSTEM_PROMPT` (full 13-tool prompt), `_reconstruct_history()`, `event_stream()` generator with the agentic loop and all tool dispatch logic.
- `backend/app/services/openai_service.py` — All LLM and embedding tool schemas defined as dicts. `get_llm_client()`, `get_embedding_client()`, `create_streaming_chat()`, `get_tools()`, `get_explorer_tools()`.

## Frontend Structure (`frontend/src/`)

```
frontend/src/
├── main.tsx                  # Vite entry point — renders <App />
├── App.tsx                   # Root: auth gate, view router (chat/documents/skills/settings)
├── App.css                   # Global app styles
├── index.css                 # Tailwind base + custom CSS variables
├── setupTests.ts             # Vitest global test setup
├── pages/
│   ├── AuthPage.tsx          # Sign in / sign up page
│   ├── IngestionPage.tsx     # Two-panel: FolderTree (left) + upload/list (right)
│   ├── SkillsPage.tsx        # Skills management grid
│   └── SettingsPage.tsx      # Read-only settings dashboard
├── components/
│   ├── auth/
│   │   ├── SignInForm.tsx
│   │   └── SignUpForm.tsx
│   ├── chat/
│   │   ├── ChatArea.tsx      # Main chat panel: thread header, model selector, message list, input
│   │   ├── MessageList.tsx   # Scrollable message list
│   │   ├── MessageItem.tsx   # Single message bubble (user/assistant) with ToolCallPanel
│   │   ├── MessageInput.tsx  # Text input + send button
│   │   ├── ToolCallPanel.tsx # Collapsible tool call display with sub-agent streaming
│   │   ├── ExecuteCodeBlock.tsx  # Code execution output: stdout/stderr/files/timing
│   │   └── MarkdownRenderer.tsx  # react-markdown with syntax highlighting
│   ├── ingestion/
│   │   ├── FolderTree.tsx        # Left panel: recursive folder tree
│   │   ├── FolderNode.tsx        # Single folder row with context menu
│   │   ├── FolderCreateInput.tsx # Inline folder creation input
│   │   ├── FolderBreadcrumb.tsx  # Path breadcrumb for selected folder
│   │   ├── FolderDetail.tsx      # Folder metadata/actions panel
│   │   ├── DocumentUpload.tsx    # Drag-and-drop / file picker upload zone
│   │   ├── DocumentList.tsx      # Document rows with metadata expansion
│   │   └── DocumentStatusBadge.tsx  # Status pill: pending/processing/completed/failed
│   ├── layout/
│   │   ├── ChatLayout.tsx    # Main shell: Sidebar + view switcher
│   │   └── Sidebar.tsx       # Thread list, folder grouping, nav buttons, theme toggle
│   ├── skills/
│   │   ├── SkillCard.tsx     # Skill display card with enable/disable toggle
│   │   └── SkillFormDialog.tsx  # Create/edit skill modal
│   └── ui/                  # shadcn/ui components (do not edit manually)
│       ├── avatar.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── hooks/
│   ├── useAuth.ts        # Session management via supabase.auth.*
│   ├── useThreads.ts     # Thread CRUD + selection state
│   ├── useMessages.ts    # Message list + SSE stream handler
│   ├── useDocuments.ts   # Document list + Realtime subscription + upload/delete
│   ├── useFolders.ts     # Folder list + Realtime subscription + CRUD
│   ├── useSkills.ts      # Skills CRUD
│   └── useTheme.ts       # Dark/light mode toggle (localStorage)
├── lib/
│   ├── api.ts            # All fetch() calls to the backend API + streamMessage() SSE parser
│   ├── supabase.ts       # Supabase browser client singleton
│   ├── folderTree.ts     # buildFolderTree() utility: flat list → nested tree structure
│   └── utils.ts          # shadcn cn() classname utility
├── types/
│   └── index.ts          # All TypeScript interfaces: Thread, Message, Document, Folder, Skill, ToolCall, etc.
└── __tests__/            # Vitest unit tests (co-located by concern)
    ├── components/
    │   ├── DocumentStatusBadge.test.tsx
    │   ├── FolderNode.test.tsx
    │   ├── FolderTree.test.tsx
    │   ├── IngestionPage.test.tsx
    │   └── MessageItem.test.tsx
    ├── hooks/
    │   ├── useDocuments.test.ts
    │   └── useFolders.test.ts
    └── lib/
        ├── api.test.ts
        └── buildFolderTree.test.ts
```

### Key Frontend Files

- `frontend/src/App.tsx` — Auth gate + top-level `activeView` state. Views: `"chat" | "documents" | "skills" | "settings"`.
- `frontend/src/lib/api.ts` — Central HTTP client. `streamMessage()` implements the SSE parsing loop. All backend endpoints called here.
- `frontend/src/types/index.ts` — Single source of truth for TypeScript types. Add new types here.
- `frontend/src/lib/supabase.ts` — Single Supabase browser client (uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
- `frontend/src/hooks/useMessages.ts` — Manages message list and dispatches all SSE event types from `streamMessage()` callbacks.

## Supabase Migrations (`supabase/migrations/`)

Migrations run sequentially (prefix = order). Apply via Supabase dashboard SQL editor or `supabase db push`.

```
001_initial_schema.sql           # profiles, threads, messages tables + RLS + triggers
002_module2_byo_retrieval.sql    # documents, document_chunks, pgvector, match_document_chunks RPC, Realtime
006_record_manager.sql           # content_hash column on documents
007_document_metadata.sql        # metadata JSONB + GIN index + updated match_document_chunks RPC
007b_fix_match_document_chunks_overload.sql  # Fixes RPC overload conflict
008_hybrid_search.sql            # search_vector tsvector + GIN index + trigger + keyword_search_chunks RPC
008b_dynamic_vector_match.sql    # Dimension-agnostic match_document_chunks (removes hardcoded vector(1536))
009_user_settings_extended.sql   # user_settings table (legacy — columns cleaned up in 011)
010_app_settings.sql             # global app_settings table (single row id='global')
011_cleanup_user_settings.sql    # Drops env-related columns from user_settings, adds preferences JSONB
012_query_documents_fn.sql       # query_documents RPC for Text-to-SQL tool
013_messages_tool_calls.sql      # tool_calls JSONB column on messages
014_folders.sql                  # folders table + folder_id on documents + Realtime
015_global_folder_document_rls.sql  # RLS for documents in global folders
016_thread_folder_scope.sql      # folder_id on threads table
017_skills.sql                   # skills + skill_files tables + RLS + storage bucket
018_skill_creator_seed.sql       # Seeds the built-in skill creator skill
019_global_folder_subtree_visibility.sql  # Global folder subtree visibility rule
```

## Key Config Files

| File | Purpose |
|------|---------|
| `backend/.env` | Runtime secrets and settings (gitignored). Source of truth for all config. |
| `backend/settings_override.json` | Runtime settings override (gitignored). Takes priority over `.env`. |
| `backend/app/config.py` | Pydantic-settings class documenting all supported env vars with defaults. |
| `backend/requirements.txt` | Python dependencies (pinned versions). |
| `backend/pytest.ini` | pytest config: asyncio mode, test paths. |
| `frontend/.env` | Frontend env (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`. |
| `frontend/vite.config.ts` | Vite build config with `@` alias for `src/`. |
| `frontend/vitest.config.ts` | Vitest test config with jsdom environment. |
| `frontend/tailwind.config.js` | Tailwind + shadcn/ui theme config. |
| `frontend/tsconfig.app.json` | TypeScript config with `@/*` path alias. |
| `frontend/components.json` | shadcn/ui component registry config. |
| `supabase/config.toml` | Supabase local dev config. |
| `CLAUDE.md` | Project rules for Claude Code (stack, no-LangChain rule, planning conventions). |
| `PROGRESS.md` | Module completion status — checked by Claude to understand current state. |

## Where to Add New Code

**New backend API endpoint:**
- Add router to `backend/app/api/<feature>.py`
- Register router in `backend/app/main.py` with `app.include_router(...)`
- Add Pydantic request/response models to `backend/app/models/<feature>.py`

**New backend service:**
- Add to `backend/app/services/<service>.py`
- Import lazily in `threads.py` if gated by a config flag (see `sandbox_service` pattern)

**New LLM tool:**
- Define tool schema dict in `backend/app/services/openai_service.py`
- Add tool to `get_tools()` return list (and/or `get_explorer_tools()` for explorer mode)
- Add tool name to `SYSTEM_PROMPT` in `backend/app/api/threads.py`
- Add dispatch branch in the tool execution section of `event_stream()`

**New frontend page:**
- Add page component to `frontend/src/pages/<Page>.tsx`
- Add view name to `ActiveView` type in `frontend/src/App.tsx`
- Add navigation case in `frontend/src/components/layout/ChatLayout.tsx`
- Add nav button to `frontend/src/components/layout/Sidebar.tsx`

**New frontend hook:**
- Add to `frontend/src/hooks/use<Feature>.ts`
- Follow pattern: useState + useEffect for initial load + Realtime subscription + useCallback for mutations

**New TypeScript type:**
- Add interface to `frontend/src/types/index.ts`

**New database table:**
- Create numbered migration SQL file in `supabase/migrations/`
- Enable RLS and add policies
- If needs Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>`

**New shadcn/ui component:**
- Install via `npx shadcn@latest add <component>` (note: on Windows, files may appear in literal `@/` dir — copy manually to `frontend/src/components/ui/`)
