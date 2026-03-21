# Codebase Structure
_Generated: 2026-03-21_

## Summary

The project is a monorepo with three top-level workspaces: `frontend/` (React/Vite SPA), `backend/` (FastAPI Python app), and `supabase/` (migrations and DB config). An `e2e/` directory contains Playwright tests. Configuration, planning documents, and agent instructions live at the repo root.

---

## Directory Layout

```
Agentic RAG/
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx             # Root component, auth gate, view routing
│   │   ├── main.tsx            # Vite entry point
│   │   ├── index.css           # Tailwind base styles
│   │   ├── types/
│   │   │   └── index.ts        # Shared TypeScript interfaces (Thread, Message, Document, ToolCall, SubAgentState)
│   │   ├── lib/
│   │   │   ├── api.ts          # All fetch calls to FastAPI backend (auth headers, SSE parsing)
│   │   │   ├── supabase.ts     # Supabase JS client singleton
│   │   │   └── utils.ts        # Tailwind cn() utility
│   │   ├── hooks/
│   │   │   ├── useAuth.ts      # Auth state, signIn/signUp/signOut
│   │   │   ├── useMessages.ts  # Message list state, streaming, tool/sub-agent callbacks
│   │   │   ├── useThreads.ts   # Thread list state, CRUD
│   │   │   └── useDocuments.ts # Document list state, upload, delete
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx    # Sign in / sign up toggle page
│   │   │   ├── IngestionPage.tsx  # Document management page
│   │   │   └── SettingsPage.tsx   # Settings display page
│   │   └── components/
│   │       ├── layout/
│   │       │   ├── ChatLayout.tsx  # Full app shell (sidebar + content area)
│   │       │   └── Sidebar.tsx     # Navigation, thread list, rename/delete menus
│   │       ├── chat/
│   │       │   ├── ChatArea.tsx        # Chat view with model selector + message pane
│   │       │   ├── MessageList.tsx     # Scrolling message history
│   │       │   ├── MessageItem.tsx     # Single message bubble (user or assistant)
│   │       │   ├── MessageInput.tsx    # Textarea + send button + model picker
│   │       │   ├── MarkdownRenderer.tsx  # react-markdown with syntax highlighting
│   │       │   └── ToolCallPanel.tsx   # Inline tool call + sub-agent status/output
│   │       ├── auth/
│   │       │   ├── SignInForm.tsx
│   │       │   └── SignUpForm.tsx
│   │       ├── ingestion/
│   │       │   ├── DocumentUpload.tsx   # Drag-and-drop / file picker upload area
│   │       │   ├── DocumentList.tsx     # Table of uploaded documents with status
│   │       │   └── DocumentStatusBadge.tsx
│   │       └── ui/                     # shadcn/ui primitives (button, card, badge, etc.)
│   ├── public/                 # Static assets
│   ├── dist/                   # Vite build output (not committed)
│   ├── @/components/ui/        # Alias target for shadcn components (mirrors src/components/ui)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app factory, CORS middleware, router registration
│   │   ├── config.py           # pydantic-settings Settings class (all env vars)
│   │   ├── dependencies.py     # get_supabase() singleton, get_current_user() JWT guard
│   │   ├── api/
│   │   │   ├── threads.py      # /threads routes + agentic SSE stream handler
│   │   │   ├── documents.py    # /documents routes + ingest_document background task
│   │   │   └── settings.py     # /settings read-only config endpoint
│   │   ├── services/
│   │   │   ├── openai_service.py    # LLM + embedding clients, tool definitions, streaming chat
│   │   │   ├── retrieval_service.py # search_documents() — vector, hybrid, RRF, rerank pipeline
│   │   │   ├── embedding_service.py # chunk_text(), embed_chunks(), extract_metadata()
│   │   │   ├── rerank_service.py    # Cohere API + local CrossEncoder reranking
│   │   │   ├── sql_service.py       # query_documents() — LLM-generated SELECT via RPC
│   │   │   ├── sub_agent_service.py # run_sub_agent() — full-document streaming analysis
│   │   │   └── web_search_service.py  # Tavily web search integration
│   │   └── models/
│   │       ├── document.py      # DocumentMetadata, DocumentResponse
│   │       ├── message.py       # MessageCreate, MessageResponse
│   │       ├── thread.py        # ThreadCreate, ThreadResponse, ThreadUpdate
│   │       └── user_settings.py # UserEffectiveSettings, load_user_settings(), load_app_settings()
│   ├── supabase/
│   │   └── migrations/          # Backend-local copy of some migration files
│   ├── tests/
│   │   ├── unit/               # Unit tests for services
│   │   └── integration/        # Integration tests
│   ├── scripts/                # One-off utility scripts
│   ├── requirements.txt
│   ├── pytest.ini
│   └── venv/                   # Python virtual environment (not committed)
│
├── supabase/
│   ├── migrations/              # Canonical DB migration files (applied to Supabase)
│   │   ├── 001_initial_schema.sql       # profiles, threads, messages tables + RLS
│   │   ├── 002_module2_byo_retrieval.sql  # documents, document_chunks, pgvector, match_document_chunks RPC
│   │   ├── 006_record_manager.sql
│   │   ├── 007_document_metadata.sql    # metadata JSONB column on documents
│   │   ├── 008_hybrid_search.sql        # keyword_search_chunks RPC (full-text search)
│   │   ├── 008b_dynamic_vector_match.sql  # parameterised vector match for configurable dimensions
│   │   ├── 009_user_settings_extended.sql
│   │   ├── 010_app_settings.sql
│   │   ├── 011_cleanup_user_settings.sql
│   │   ├── 012_query_documents_fn.sql   # query_user_documents RPC for Text-to-SQL tool
│   │   └── 013_messages_tool_calls.sql  # tool_calls JSONB column on messages
│   └── snippets/
│
├── e2e/
│   ├── tests/                  # Playwright test specs
│   └── fixtures/               # Test fixture files
│
├── .agent/
│   └── plans/                  # Agent implementation plans (*.md)
│       └── Completed_Plans/    # Archived completed plans
│
├── .planning/
│   └── codebase/               # GSD codebase analysis documents (this directory)
│
├── CLAUDE.md                   # Project instructions and rules for AI agents
├── PROGRESS.md                 # Module completion status
├── PRD.md                      # Product requirements document
└── README.md
```

---

## Directory Purposes

**`frontend/src/hooks/`:**
- Purpose: All stateful data management, decoupled from rendering
- One hook per data domain: auth, messages (with SSE callbacks), threads, documents
- Hooks call `lib/api.ts` functions and manage local React state
- Key files: `useMessages.ts` (most complex — handles streaming, tool state, sub-agent state)

**`frontend/src/lib/`:**
- Purpose: Side-effect utilities shared across hooks
- `api.ts` — all backend fetch calls; `streamMessage()` is the SSE parser entry point
- `supabase.ts` — single JS client instance (used only for auth in frontend; data goes via FastAPI)
- `utils.ts` — Tailwind `cn()` helper

**`frontend/src/types/`:**
- Purpose: Single source of truth for shared TypeScript interfaces
- `index.ts` exports: `Thread`, `Message`, `Document`, `ToolCall`, `SubAgentState`, `DocumentMetadata`

**`backend/app/services/`:**
- Purpose: All business logic; each file is a standalone module with no circular dependencies
- Services receive all dependencies (Supabase client, user settings) as arguments — no global state
- LangSmith `@traceable` decorators on: `create_streaming_chat`, `search_documents`, `rerank`, `run_sub_agent`

**`backend/app/models/`:**
- Purpose: Pydantic request/response schemas only — no DB queries
- `user_settings.py` is the exception — also contains `load_user_settings()` factory function

**`supabase/migrations/`:**
- Purpose: Ordered SQL migration files applied to Supabase (canonical source of truth for DB schema)
- Naming convention: `{NNN}_{description}.sql` where NNN is a zero-padded sequence number
- Note: `backend/supabase/migrations/` is a subset copy used for local development

---

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx` — Vite/React app mount point
- `frontend/src/App.tsx` — Auth gate; routes to `AuthPage` or `ChatLayout` based on session
- `backend/app/main.py` — FastAPI app creation, middleware, router inclusion

**Configuration:**
- `backend/app/config.py` — All env var definitions with defaults (`Settings` class)
- `backend/.env` — Actual secrets (not committed)
- `frontend/.env` or `frontend/.env.local` — `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Core Logic:**
- `backend/app/api/threads.py` — `send_message()` contains the full agentic loop (lines 151–359)
- `backend/app/services/retrieval_service.py` — `search_documents()` orchestrates hybrid retrieval
- `backend/app/services/openai_service.py` — `get_tools()`, `create_streaming_chat()`, `embed_texts()`
- `frontend/src/lib/api.ts` — `streamMessage()` is the SSE consumer that maps server events to callbacks

**Database Schema (via migrations):**
- Tables: `profiles`, `threads`, `messages`, `documents`, `document_chunks`
- Supabase RPCs: `match_document_chunks`, `keyword_search_chunks`, `query_user_documents`
- Key columns: `document_chunks.embedding` (vector), `documents.metadata` (JSONB), `messages.tool_calls` (JSONB)

**Testing:**
- `backend/tests/unit/` — Unit tests for service functions
- `backend/tests/integration/` — Integration tests (require live Supabase)
- `e2e/tests/` — Playwright end-to-end tests
- `backend/pytest.ini` — pytest configuration

---

## Naming Conventions

**Frontend Files:**
- React components: PascalCase `.tsx` (e.g., `ChatArea.tsx`, `MessageItem.tsx`)
- Hooks: camelCase with `use` prefix `.ts` (e.g., `useMessages.ts`)
- Utilities/lib: camelCase `.ts` (e.g., `api.ts`, `supabase.ts`)
- Pages: PascalCase `Page` suffix `.tsx` (e.g., `AuthPage.tsx`, `IngestionPage.tsx`)

**Backend Files:**
- Python modules: snake_case (e.g., `embedding_service.py`, `retrieval_service.py`)
- Pydantic models: PascalCase classes (e.g., `DocumentResponse`, `UserEffectiveSettings`)

**Database Migrations:**
- Pattern: `{NNN}_{description}.sql` with sequential numeric prefix

---

## Where to Add New Code

**New API endpoint:**
- Create or extend a router in `backend/app/api/` (use existing `threads.py` or `documents.py` as pattern)
- Register router in `backend/app/main.py` via `app.include_router()`
- Add corresponding fetch function in `frontend/src/lib/api.ts`

**New tool for the LLM agent:**
- Define tool schema dict in `backend/app/services/openai_service.py` alongside existing tool constants
- Add to `get_tools()` function (conditionally if it requires an API key)
- Add dispatch case in `send_message()` event loop in `backend/app/api/threads.py`

**New service / integration:**
- Create `backend/app/services/{name}_service.py`
- Follow the pattern: pure functions, receive all dependencies as arguments, use `@traceable` for observability

**New frontend page:**
- Create `frontend/src/pages/{Name}Page.tsx`
- Add view type to `ActiveView` union in `frontend/src/App.tsx`
- Add navigation button to `frontend/src/components/layout/Sidebar.tsx`
- Wire into `frontend/src/components/layout/ChatLayout.tsx` render switch

**New React hook:**
- Create `frontend/src/hooks/use{Name}.ts`
- Call `lib/api.ts` functions; manage state with `useState`/`useCallback`

**New database table or function:**
- Add `supabase/migrations/{NNN}_{description}.sql`
- Apply RLS policies — all tables must have `enable row level security` and user-scoped policies
- If table needs Realtime updates, add `REPLICA IDENTITY FULL` (see `005_documents_replica_identity.sql` pattern)

---

## Special Directories

**`backend/venv/`:**
- Purpose: Python virtual environment
- Generated: Yes
- Committed: No

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No

**`frontend/node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes
- Committed: No

**`supabase/.temp/` and `supabase/.branches/`:**
- Purpose: Supabase CLI internal state
- Generated: Yes
- Committed: No (`.gitignore`)

**`.agent/plans/`:**
- Purpose: Implementation plan markdown files written by AI agents before executing changes
- Naming: `{N}.{plan-name}.md` (e.g., `1.auth-setup.md`)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Committed: Yes
