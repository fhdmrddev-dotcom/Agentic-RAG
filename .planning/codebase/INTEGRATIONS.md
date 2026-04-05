# External Integrations
_Last updated: 2026-04-05_

## APIs & External Services

### LLM Inference

**OpenAI (and compatible providers):**
- Purpose: All LLM chat completions, agentic tool calls, and text embeddings
- SDK: `openai` Python SDK ≥2.0.0 — raw API calls only (no LangChain/LangGraph)
- Client factory: `backend/app/services/openai_service.py` — `get_llm_client()` and `get_embedding_client()`
- Provider switching: controlled by `LLM_PROVIDER` env var in `backend/app/config.py`; swaps `api_key` and `base_url` dynamically
- Supported providers (all via OpenAI SDK with `base_url` override):
  - `openai` — `OPENAI_API_KEY`; default `base_url` (OpenAI servers)
  - `anthropic` — `ANTHROPIC_API_KEY`; base URL `https://api.anthropic.com/v1`
  - `google` — `GOOGLE_API_KEY`; base URL `https://generativelanguage.googleapis.com/v1beta/openai/`
  - `openrouter` — `OPENROUTER_API_KEY`; base URL `https://openrouter.ai/api/v1`
  - `ollama` — no key required; base URL resolved from `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`)
- Default model: `gpt-4o` (overridable via `LLM_MODEL`)
- Available models list: `AVAILABLE_MODELS` (comma-separated); exposed via `GET /models`
- Streaming: all chat completions use `stream=True` and are delivered as SSE via `StreamingResponse`
- Embeddings: default model `text-embedding-3-small`, 1536 dimensions; separate `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` supported for dedicated embedding provider

### Web Search

**Tavily:**
- Purpose: Real-time web search tool available to the chat agent
- SDK: Direct HTTP call via `httpx` to `https://api.tavily.com/search`
- Implementation: `backend/app/services/web_search_service.py`
- Auth: `TAVILY_API_KEY` env var
- Activation: tool is disabled automatically when `TAVILY_API_KEY` is absent (`config.py` `web_search_enabled` property)
- Returns: formatted results with title, URL, and content snippet

### Reranking

**Cohere (API provider):**
- Purpose: Optional result reranking after hybrid retrieval
- SDK: Direct HTTP call via `httpx` to `https://api.cohere.com/v2/rerank`
- Implementation: `backend/app/services/rerank_service.py` — `_rerank_api()`
- Auth: `RERANK_API_KEY` env var
- Activation: `RERANK_ENABLED=true` + `RERANK_PROVIDER=api`
- Default model: `rerank-v3.5`

**Local sentence-transformers (alternative reranking):**
- Purpose: Reranking without external API calls
- SDK: `sentence-transformers` ≥3.0.0 — `CrossEncoder` class; lazy-loaded on first use
- Implementation: `backend/app/services/rerank_service.py` — `_rerank_local()`
- Activation: `RERANK_ENABLED=true` + `RERANK_PROVIDER=local`
- Default model: `cross-encoder/ms-marco-MiniLM-L-6-v2`

## Data Storage

### Database

**Supabase (Postgres + pgvector):**
- Purpose: All application data — users, threads, messages, documents, folders, chunks, skills, settings
- Client (backend): `supabase` Python SDK 2.10.0, service-role client initialized in `backend/app/dependencies.py` via `create_client()`
- Client (frontend): `@supabase/supabase-js` 2.99.2, anon-key client in `frontend/src/lib/supabase.ts`
- Connection (backend): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Connection (frontend): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Extension: `pgvector` — enabled in `supabase/migrations/001_initial_schema.sql`; powers `match_document_chunks` RPC for vector search
- Key tables: `profiles`, `threads`, `messages`, `documents`, `document_chunks`, `folders`, `user_settings`, `skills`, `sandbox_files`
- Key database functions (RPCs): `match_document_chunks` (vector similarity search), `keyword_search_chunks` (full-text), `query_user_documents` (SQL tool), `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_document_path` (KB navigation)
- RLS: Row Level Security enabled on every table; users see only their own data
- Migrations: 19 SQL migration files in `supabase/migrations/`; applied in order via Supabase CLI

### File Storage

**Supabase Storage:**
- Purpose: Storing uploaded documents and sandbox output files
- SDK: Supabase Python SDK (backend), `@supabase/supabase-js` (frontend, indirectly via signed URLs)
- Implementation: `backend/app/services/sandbox_service.py` — uploads sandbox output files to `sandbox-outputs` bucket
- Signed URLs: generated with 1-hour expiry for sandbox output download links

## Authentication & Identity

**Supabase Auth:**
- Purpose: User registration, login, session management
- Frontend implementation: `frontend/src/hooks/useAuth.ts` — wraps `supabase.auth` methods (`signInWithPassword`, `signUp`, `signOut`, `getSession`, `onAuthStateChange`)
- Backend implementation: JWT Bearer token validation in `backend/app/dependencies.py` — `get_current_user()` calls `supabase.auth.get_user(token)`
- Token flow: frontend attaches Supabase JWT as `Authorization: Bearer <token>` header on all API requests; backend validates against Supabase Auth
- Session state: managed client-side via `onAuthStateChange` listener; no server-side sessions
- Profile creation: automatic via Postgres trigger `on_auth_user_created` (defined in `supabase/migrations/001_initial_schema.sql`)

## Monitoring & Observability

**LangSmith:**
- Purpose: LLM call tracing for debugging and evaluation
- SDK: `langsmith` 0.2.3 — `@traceable` decorator and environment-variable-based auto-tracing
- Configured in: `backend/app/main.py` (startup sets `LANGSMITH_TRACING`, `LANGSMITH_PROJECT`, `LANGSMITH_API_KEY` env vars)
- Auth: `LANGSMITH_API_KEY` env var
- Project name: `LANGSMITH_PROJECT` env var (default `agentic-rag-module2`)
- Traced functions: `web_search` (`web_search_service.py`), `rerank` and `rerank-documents` (`rerank_service.py`), `sub-agent` (`sub_agent_service.py`), retrieval service calls

**Logging:**
- Standard Python `logging` module throughout backend
- Frontend: `console.error` for hook-level errors; no structured logging framework

## Real-time

**Supabase Realtime:**
- Purpose: Push document ingestion status updates to the frontend without polling
- Implementation: `frontend/src/hooks/useDocuments.ts` — subscribes to `postgres_changes` on the `documents` table
- Channel: `documents-changes` — listens for `INSERT`, `UPDATE`, `DELETE` events
- Pattern: optimistic updates on upload/delete; Realtime `UPDATE` events update document status (pending → processing → completed)

## Code Execution

**Docker (via llm-sandbox):**
- Purpose: Sandboxed Python execution for the `execute_code` agent tool
- SDK: `llm-sandbox[docker]` ≥0.3.37 — `InteractiveSandboxSession`
- Implementation: `backend/app/services/sandbox_service.py` — `SandboxSessionManager` maintains per-thread Docker container sessions
- Activation: `SANDBOX_ENABLED=true` env var; Docker daemon must be running
- Session lifecycle: created on first use per thread, evicted after `SANDBOX_TTL_MINUTES` idle (default 30), all sessions closed on app shutdown
- Output files: copied from `/sandbox/output/` in container, uploaded to Supabase Storage `sandbox-outputs` bucket, returned as signed download URLs

## CI/CD & Deployment

**Hosting:** Not configured in repository (no Dockerfile, no deployment manifests, no CI pipeline config detected)

**CI Pipeline:** None detected

## Webhooks & Callbacks

**Incoming:** None detected

**Outgoing:** None (all external calls are request-initiated synchronous HTTP)

## Environment Configuration Summary

**Backend (`backend/.env`):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (admin access, bypasses RLS on backend)
- `LLM_PROVIDER` — active provider: `openai` | `anthropic` | `google` | `openrouter` | `ollama`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `OPENROUTER_API_KEY` — provider keys
- `OLLAMA_BASE_URL` — Ollama server URL (default `http://localhost:11434`)
- `LLM_MODEL` — model name (default `gpt-4o`)
- `AVAILABLE_MODELS` — comma-separated model list exposed to UI
- `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` — optional dedicated embedding provider
- `LANGSMITH_API_KEY` / `LANGSMITH_PROJECT` — LangSmith observability
- `TAVILY_API_KEY` — web search (tool disabled if absent)
- `RERANK_ENABLED` / `RERANK_PROVIDER` / `RERANK_API_KEY` / `RERANK_MODEL` — reranking config
- `SANDBOX_ENABLED` / `SANDBOX_TTL_MINUTES` — code execution sandbox config

**Frontend (`frontend/.env`):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (RLS-enforced public access)
