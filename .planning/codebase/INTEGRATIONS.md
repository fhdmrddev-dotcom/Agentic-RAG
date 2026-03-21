# External Integrations
_Generated: 2026-03-21_

## Summary

The application integrates Supabase for all data persistence, auth, storage, and Realtime; an OpenAI-compatible LLM API (defaults to OpenAI, supports OpenRouter and other compatible providers) for chat, embeddings, and metadata extraction; optional Tavily for web search; optional Cohere or local sentence-transformers for reranking; and LangSmith for LLM observability. All external service credentials are configured via environment variables — there is no admin UI.

## LLM Provider

**Service:** OpenAI-compatible API (default: OpenAI; supports OpenRouter or any OpenAI-compatible base URL)
- SDK: `openai>=2.0.0` Python package
- Client construction: `backend/app/services/openai_service.py` → `get_llm_client()`, `get_embedding_client()`
- Used for: streaming chat completions, metadata extraction (JSON mode), thread title generation, embeddings
- Auth env var: `LLM_API_KEY`
- Base URL env var: `LLM_BASE_URL` (empty = OpenAI default)
- Default model env var: `LLM_MODEL` (default: `gpt-4o`)
- Exposed model list: `AVAILABLE_MODELS` (comma-separated; defaults to `LLM_MODEL`)

**Embedding sub-client:**
- Separate credentials supported via `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL`
- Falls back to LLM credentials if `EMBEDDING_API_KEY` is not set
- Default model: `text-embedding-3-small` (1536 dimensions) — configurable via `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS`

## Supabase

**Purpose:** Postgres database, pgvector similarity search, user authentication, file storage, Realtime status updates

**Backend client:**
- SDK: `supabase==2.10.0` Python package
- Singleton client: `backend/app/dependencies.py` → `get_supabase()`
- Uses service role key — bypasses RLS; user scoping is done manually in all queries
- Auth env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Frontend client:**
- SDK: `@supabase/supabase-js ^2.99.2`
- Client: `frontend/src/lib/supabase.ts`
- Uses anon key for auth session management and Realtime subscriptions
- Auth env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Database tables (managed via migrations in `supabase/migrations/`):**
- `threads` — chat conversation threads
- `messages` — per-thread messages including persisted tool call metadata
- `documents` — document metadata and ingestion status
- `document_chunks` — chunked document content with pgvector embeddings
- `user_settings` — per-user LLM/embedding/retrieval overrides
- `app_settings` — server-level settings (admin override store)

**Postgres functions (RPCs):**
- `match_document_chunks` — vector similarity search
- `keyword_search_chunks` — full-text keyword search (used in hybrid search)
- `query_user_documents` — executes scoped SELECT queries from the `query_documents` tool
- `match_document_chunks_dynamic` — dynamic embedding dimension variant

**Storage bucket:** `documents` — raw uploaded files stored at `{user_id}/{document_id}/{filename}`

**Realtime:** Used by frontend to receive live ingestion status updates (document processing state changes)

**Authentication:**
- Provider: Supabase Auth (email/password)
- Frontend: `frontend/src/hooks/useAuth.ts`; auth pages at `frontend/src/pages/AuthPage.tsx`
- Backend: JWT Bearer token validated via `supabase.auth.get_user(token)` in `backend/app/dependencies.py` → `get_current_user()`
- All API routes require a valid Supabase JWT

## Tavily (Web Search)

**Purpose:** Real-time web search tool available to the LLM agent
- Integration: direct HTTP POST via `httpx` to `https://api.tavily.com/search`
- Implementation: `backend/app/services/web_search_service.py`
- Activation: tool is only registered in the LLM tools list when `TAVILY_API_KEY` is set (non-empty)
- Auth env var: `TAVILY_API_KEY`
- Config: `WEB_SEARCH_MAX_RESULTS` (default: 5)

## Cohere (Optional Reranking)

**Purpose:** Cross-encoder reranking of retrieval results to improve answer quality
- Integration: direct HTTP POST via `httpx` to `https://api.cohere.com/v2/rerank`
- Implementation: `backend/app/services/rerank_service.py` → `_rerank_api()`
- Activation: only used when `RERANK_ENABLED=true` AND `RERANK_PROVIDER=api`
- Auth env var: `RERANK_API_KEY`
- Model env var: `RERANK_MODEL` (default: `rerank-v3.5`)

## sentence-transformers (Optional Local Reranking)

**Purpose:** Local alternative to Cohere for reranking without external API calls
- SDK: `sentence-transformers>=3.0.0` Python package
- Implementation: `backend/app/services/rerank_service.py` → `_rerank_local()`
- Activation: used when `RERANK_ENABLED=true` AND `RERANK_PROVIDER=local`
- Model: configurable via `RERANK_MODEL` (default for local: `cross-encoder/ms-marco-MiniLM-L-6-v2`)
- Model is lazy-loaded on first rerank call — not loaded at startup

## LangSmith (Observability)

**Purpose:** LLM call tracing, latency monitoring, and prompt debugging
- SDK: `langsmith==0.2.3` Python package
- Configured in: `backend/app/main.py` (sets `LANGSMITH_TRACING`, `LANGSMITH_PROJECT`, `LANGSMITH_API_KEY` env vars at startup)
- Traced functions: `create_streaming_chat` (chat completions), `web_search`, `rerank-documents`, `sub-agent` — all via `@traceable` decorator
- Auth env var: `LANGSMITH_API_KEY` (tracing silently disabled if empty)
- Project env var: `LANGSMITH_PROJECT` (default: `agentic-rag-module2`)
- Toggle: `LANGSMITH_TRACING` (default: `"true"`)

## Environment Variable Reference

**Required — backend:**
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `LLM_API_KEY` | LLM provider API key |

**Optional — backend:**
| Variable | Default | Purpose |
|---|---|---|
| `LLM_BASE_URL` | (OpenAI) | Override for OpenRouter or other providers |
| `LLM_MODEL` | `gpt-4o` | Default chat model |
| `AVAILABLE_MODELS` | `""` | Comma-separated model list exposed to UI |
| `EMBEDDING_API_KEY` | `""` | Separate key for embedding calls |
| `EMBEDDING_BASE_URL` | `""` | Separate base URL for embedding calls |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `EMBEDDING_DIMENSIONS` | `1536` | Must match embedding model output |
| `RETRIEVAL_TOP_K` | `5` | Number of final retrieved chunks |
| `RETRIEVAL_MATCH_THRESHOLD` | `0.3` | Minimum vector similarity score |
| `HYBRID_SEARCH_ENABLED` | `true` | Enable vector + keyword RRF fusion |
| `HYBRID_CANDIDATE_COUNT` | `20` | Candidates per method before fusion |
| `RERANK_ENABLED` | `false` | Enable reranking pass |
| `RERANK_PROVIDER` | `api` | `"api"` (Cohere) or `"local"` |
| `RERANK_API_KEY` | `""` | Cohere API key |
| `RERANK_MODEL` | `rerank-v3.5` | Reranking model |
| `RERANK_TOP_N` | `5` | Results after reranking |
| `TAVILY_API_KEY` | `""` | Tavily web search key (disables tool if empty) |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Max Tavily results per search |
| `LANGSMITH_API_KEY` | `""` | LangSmith tracing key |
| `LANGSMITH_PROJECT` | `agentic-rag-module2` | LangSmith project name |
| `LANGSMITH_TRACING` | `"true"` | Enable/disable tracing |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

**Required — frontend:**
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_BASE_URL` | Backend API base URL |

## Webhooks & Callbacks

**Incoming:** None — no webhook endpoints are registered.

**Outgoing:** None — all external calls are request-initiated (SSE streaming to frontend, outbound HTTP to Tavily/Cohere).

---

*Integration audit: 2026-03-21*
