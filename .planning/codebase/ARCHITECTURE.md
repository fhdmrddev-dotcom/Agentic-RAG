# Architecture
_Generated: 2026-03-21_

## Summary

Agentic RAG is a multi-user document Q&A system built as a React SPA frontend talking to a FastAPI backend, with Supabase providing Postgres (with pgvector), Auth, and Storage. The backend operates as an agentic loop: for each user message it streams an LLM response that can autonomously call tools (vector search, keyword search, SQL query, web search, sub-agent document analysis) over multiple iterations before returning a final answer. All data is user-scoped via Row-Level Security policies.

---

## Pattern Overview

**Overall:** Layered client-server with an agentic tool-use loop on the backend.

**Key Characteristics:**
- Stateless completions — full message history is loaded from Supabase and sent with every LLM request (`backend/app/api/threads.py`, lines 185–196)
- Server-Sent Events (SSE) used for streaming chat responses to the browser
- FastAPI dependency injection pattern for auth validation and Supabase client across all routes
- All configuration exclusively via environment variables (`.env`) — no admin UI or DB-stored settings

---

## Layers

**API Layer:**
- Purpose: HTTP routing, request validation, SSE streaming, and auth guard
- Location: `backend/app/api/`
- Contains: `threads.py` (chat + message endpoints), `documents.py` (upload/list/delete), `settings.py` (read-only config exposure)
- Depends on: Services layer, Models layer, `dependencies.py`
- Used by: Frontend via `VITE_API_BASE_URL`

**Services Layer:**
- Purpose: All business logic and external integrations — isolated, testable functions
- Location: `backend/app/services/`
- Contains:
  - `openai_service.py` — LLM client factory, tool definitions, streaming chat, embeddings
  - `retrieval_service.py` — vector search, keyword search, RRF fusion, reranking orchestration
  - `embedding_service.py` — text chunking, embedding batch calls, metadata extraction
  - `rerank_service.py` — Cohere API and local CrossEncoder reranking
  - `sql_service.py` — user-scoped SELECT query execution via Supabase RPC
  - `sub_agent_service.py` — focused full-document LLM analysis, streamed
  - `web_search_service.py` — Tavily API integration for live web search
- Depends on: `config.py`, Supabase client (injected), OpenAI SDK
- Used by: API layer

**Models Layer:**
- Purpose: Pydantic schemas for request/response validation and type safety
- Location: `backend/app/models/`
- Contains: `document.py`, `message.py`, `thread.py`, `user_settings.py`
- Depends on: Pydantic only
- Used by: API layer, Services layer

**Config Layer:**
- Purpose: Single source of truth for all environment settings
- Location: `backend/app/config.py`
- Contains: `Settings` (pydantic-settings `BaseSettings` class reading `.env`)
- Depends on: `pydantic-settings`
- Used by: All other backend layers

**Frontend Hooks Layer:**
- Purpose: Stateful data management — isolate API calls and UI state from components
- Location: `frontend/src/hooks/`
- Contains: `useAuth.ts`, `useMessages.ts`, `useThreads.ts`, `useDocuments.ts`
- Depends on: `frontend/src/lib/api.ts`, `frontend/src/lib/supabase.ts`
- Used by: Pages and layout components

**Frontend Component Layer:**
- Purpose: Pure UI rendering
- Location: `frontend/src/components/`
- Contains: `chat/`, `ingestion/`, `auth/`, `layout/`, `ui/` (shadcn primitives)
- Depends on: Hooks, types, shadcn/ui
- Used by: `App.tsx` via pages

---

## Data Flow

**Chat Message (Happy Path):**

1. User types in `MessageInput` → `useMessages.sendMessage()` called
2. Frontend inserts optimistic user/assistant placeholder messages into local state
3. `lib/api.ts:streamMessage()` POSTs to `POST /threads/{id}/messages` with Bearer token
4. Backend `get_current_user` validates JWT via Supabase auth
5. User message inserted into `messages` table
6. Full thread history loaded from `messages` table and prepended with `SYSTEM_PROMPT`
7. `create_streaming_chat()` called — sends messages + tool definitions to LLM via OpenAI-compatible SDK
8. **Agentic loop** (up to 5 iterations):
   a. Stream LLM response chunks; yield `{"type": "delta"}` SSE events to frontend
   b. If LLM requests tool calls: collect buffered tool call chunks, yield `{"type": "tool_start"}` events
   c. Execute tool (`search_documents`, `query_documents`, `web_search`, or `analyze_document`)
   d. For `analyze_document`: delegate to `run_sub_agent()` which streams its own response yielding `sub_agent_delta` events
   e. Append tool result to messages list; yield `{"type": "tool_end"}` event
   f. Continue loop so LLM can synthesize tool results
9. On natural stop, persist assistant message (with `tool_calls` JSONB) to `messages` table
10. If first exchange, call LLM again to generate thread title; yield `{"type": "title"}` event
11. Yield `[DONE]` sentinel; frontend marks streaming complete

**Document Ingestion:**

1. User selects file in `DocumentUpload` → `useDocuments.upload()` → `POST /documents/upload`
2. Backend validates MIME type, checks SHA-256 hash for duplicate detection
3. Document row inserted with `status: "pending"` — response returned immediately
4. `ingest_document()` runs as FastAPI `BackgroundTask`:
   a. Status updated to `"processing"`
   b. `chunk_text()` splits content into overlapping chunks (default 1000 chars, 200 overlap)
   c. `embed_chunks()` calls OpenAI embeddings API in batch
   d. Chunk rows (with embeddings) inserted into `document_chunks`
   e. `extract_metadata()` uses LLM with JSON mode to extract structured metadata
   f. Status updated to `"completed"` with chunk count and metadata
5. Frontend polls document list to reflect updated status

---

## Retrieval Pipeline

The retrieval service (`backend/app/services/retrieval_service.py`) supports two modes:

**Vector-only (when `hybrid_search_enabled=False`):**
- Embeds query → calls `match_document_chunks` Postgres RPC (pgvector cosine similarity)
- Returns top-k chunks above similarity threshold

**Hybrid (default, `hybrid_search_enabled=True`):**
1. Vector search via `match_document_chunks` RPC → candidate list
2. Keyword search via `keyword_search_chunks` RPC (full-text search) → candidate list
3. Reciprocal Rank Fusion (RRF) merges and scores both lists
4. Optional reranking via Cohere API or local CrossEncoder (`rerank_service.py`)
5. Results enriched with filenames and metadata from `documents` table

---

## API Design

**Base URL:** Configured via `VITE_API_BASE_URL` (frontend) / `frontend_url` (backend CORS)

**Authentication:** Bearer token (Supabase JWT) on every request. Backend validates via `supabase.auth.get_user(token)` in `get_current_user` dependency (`backend/app/dependencies.py`).

**Endpoints:**
- `GET /health` — liveness check
- `GET /models` — list available LLM models from config
- `GET /settings` — read-only view of all config settings
- `GET /threads` — list user's chat threads
- `POST /threads` — create new thread
- `PATCH /threads/{id}` — rename thread
- `DELETE /threads/{id}` — delete thread
- `GET /threads/{id}/messages` — load message history
- `POST /threads/{id}/messages` — send message, returns SSE stream
- `GET /documents` — list user's documents
- `POST /documents/upload` — upload and ingest document (multipart/form-data)
- `DELETE /documents/{id}` — delete document and storage file

**SSE Event Types:**
- `delta` — text content chunk from LLM
- `title` — auto-generated thread title
- `tool_start` — tool invocation beginning (name + args)
- `tool_end` — tool invocation complete
- `sub_agent_start` — document analysis sub-agent starting
- `sub_agent_delta` — streaming output from sub-agent
- `sub_agent_done` — sub-agent complete
- `error` — API error
- `[DONE]` — stream sentinel

---

## Key Abstractions

**Tool Definitions (`backend/app/services/openai_service.py`):**
- Four tools registered as OpenAI function-calling schemas: `SEARCH_DOCUMENTS_TOOL`, `QUERY_DOCUMENTS_TOOL`, `WEB_SEARCH_TOOL`, `ANALYZE_DOCUMENT_TOOL`
- `get_tools()` conditionally includes `web_search` only when `TAVILY_API_KEY` is set
- Tool dispatch lives in `send_message()` event loop (`backend/app/api/threads.py`, lines 267–327)

**Sub-Agent Pattern (`backend/app/services/sub_agent_service.py`):**
- Spawned within the parent tool-use loop when `analyze_document` tool is called
- Receives full document content (up to `sub_agent_max_chars` chars, default 100,000)
- Streams its own LLM response back through the parent SSE connection as `sub_agent_delta` events
- Result returned as string tool result to the parent LLM context

**UserEffectiveSettings (`backend/app/models/user_settings.py`):**
- Pydantic model capturing all tunable parameters for one request
- Currently always loaded from `.env` via `load_user_settings()` — prepared for per-user overrides
- Passed through call chain from API handler → services to avoid global state reads mid-request

**Supabase Singleton (`backend/app/dependencies.py`):**
- Single `Client` instance reused across requests (`get_supabase`)
- Uses service role key — bypasses RLS, so all queries manually filter by `user_id`

---

## Error Handling

**Strategy:** Fail-fast for auth/routing; best-effort for enrichment steps.

**Patterns:**
- `get_current_user` raises `HTTP 401` on invalid JWT — applied via `Depends` to all routes
- `HTTP 404` raised when thread/document ownership check fails
- Document ingestion: metadata extraction failures are logged and swallowed (never block completion)
- Tool execution errors: caught per-tool in the agentic loop; error string injected as tool result so LLM can report it gracefully
- Storage upload failures silently pass — ingestion continues without a stored file copy
- `APIError` from OpenAI terminates SSE stream with `{"type": "error"}` event

---

## Cross-Cutting Concerns

**Observability:** LangSmith tracing enabled via `LANGSMITH_*` env vars. `@traceable` decorators on `create_streaming_chat`, `search_documents`, `rerank`, and `run_sub_agent`.

**Authentication:** Supabase Auth JWT. Frontend uses `supabase.auth.onAuthStateChange` (`frontend/src/hooks/useAuth.ts`). Backend validates token on every request.

**Validation:** Pydantic models for all request/response bodies. `pydantic-settings` for config. SQL service adds client-side SELECT-only + no-semicolon checks before DB call.

**CORS:** Configured in `backend/app/main.py` to allow `FRONTEND_URL` and any `localhost:*` origin.
