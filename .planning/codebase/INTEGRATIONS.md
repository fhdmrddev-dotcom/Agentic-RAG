<!-- refreshed: 2026-05-09 -->
# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**LLM Providers (chat + tool calling):**
- OpenAI — `openai>=2.0.0` SDK (`backend/app/services/openai_service.py:6`)
  - Auth: `OPENAI_API_KEY`
  - Base URL: default OpenAI endpoint
  - Used as the primary client class for OpenAI, OpenRouter, Google (OpenAI-compat endpoint), and Ollama — they share the same `OpenAI()` client instantiation with different `base_url` + `api_key`
  - Native tool calling registered in `MODEL_CAPABILITIES` (`backend/app/config.py:92-129`) for `gpt-4o*`, `gpt-4.1*`, `gpt-5*`, `o1`/`o3`/`o4`
- Anthropic — `anthropic>=0.97.0` native SDK (`backend/app/services/anthropic_service.py:24`)
  - Auth: `ANTHROPIC_API_KEY`
  - Base URL: `https://api.anthropic.com/v1`
  - Custom message-format converter for OpenAI ↔ Anthropic interop (`_convert_messages_to_anthropic`)
  - Extended-thinking models (Claude Opus 4.6/4.7) get a 600s per-LLM-call timeout (Issue #51568 workaround)
- Google Gemini — via OpenAI-compat endpoint
  - Auth: `GOOGLE_API_KEY`
  - Base URL: `https://generativelanguage.googleapis.com/v1beta/openai/` (`backend/app/config.py:12`)
  - Models: `gemini-2.5-{flash,flash-lite,pro}`, `gemini-3-flash-preview`, `gemini-3.1-pro-preview`
- OpenRouter — via OpenAI-compat endpoint
  - Auth: `OPENROUTER_API_KEY`
  - Base URL: `https://openrouter.ai/api/v1`
  - Mixed native_tools support; defaults to structured (XML) mode for unknown models
- Ollama (local) — via OpenAI-compat endpoint
  - Auth: none
  - Base URL: `${OLLAMA_BASE_URL}/v1` (default `http://localhost:11434/v1`)

Provider routing decision table lives in `MODEL_CAPABILITIES` (`backend/app/config.py:92`); resolution flows through `Settings.resolve_llm_provider` (`backend/app/config.py:277-305`) and per-user overrides in `UserEffectiveSettings` (`backend/app/models/user_settings.py:49`).

**Embedding Provider:**
- OpenAI Embeddings — `text-embedding-3-small` (1536 dim default)
  - Auth: `EMBEDDING_API_KEY` (falls back to active LLM provider key when empty)
  - Used for chunk embedding during ingestion + query embedding at retrieval time (`backend/app/services/embedding_service.py`, `backend/app/services/retrieval_service.py:36`)
  - Dimension is locked into the `documents.embedding` pgvector column; changing it requires `resize_embedding_column` migration + full re-ingestion

**Reranking (optional):**
- Cohere Rerank API — `httpx` POST to Cohere endpoint (`backend/app/services/rerank_service.py:17`)
  - Auth: `RERANK_API_KEY` (operator-supplied)
  - Default model: `rerank-v3.5`
  - Disabled by default (`RERANK_ENABLED=false`); enabled per-user via Settings UI
- Local CrossEncoder — `sentence-transformers` (default `cross-encoder/ms-marco-MiniLM-L-6-v2`)
  - Auth: none (model downloaded on first use)
  - Lazy-loaded singleton (`_local_model` in `rerank_service.py:28-38`)

**Web Search:**
- Tavily — `https://api.tavily.com/search` via `httpx.Client` (`backend/app/services/web_search_service.py:1-10`)
  - Auth: `TAVILY_API_KEY`
  - Tool is auto-disabled when key is empty (`Settings.web_search_enabled` property, `backend/app/config.py:391`)
  - Default 5 results, basic search depth, 10s timeout

**Vision (image captioning):**
- OpenAI vision models (default `gpt-4o-mini`, `Settings.vision_model`)
  - Used during ingestion to describe extracted figures (`backend/app/services/multimodal_service.py`)
  - Capped at 20 vision calls per document, 512KB base64 payload (Pitfalls 6 + 7)

## Data Storage

**Databases:**
- Supabase Postgres (managed)
  - Connection: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (`backend/.env`)
  - Direct DB URL in `DATABASE_URL` (used only by migrations + admin scripts, not the FastAPI runtime)
  - Local: `http://127.0.0.1:54321` (API) / `127.0.0.1:54322` (Postgres) via `supabase start`
  - Cloud: `https://<project-ref>.supabase.co`
  - Client: `supabase==2.10.0` Python sync client; module-level singleton in `backend/app/dependencies.py:10-17`; **all** sync `.execute()` calls wrapped in `run_in_threadpool` via `aexec` helper (`backend/app/utils/db.py`) per D-v2.5-01
  - Frontend: `@supabase/supabase-js ^2.99.2` for auth + Realtime + RLS-scoped reads (`frontend/src/lib/supabase.ts`)
  - Extensions: pgvector (vector similarity), full-text search (tsvector for hybrid search)
  - Schema source of truth: 38 numbered migrations under `supabase/migrations/`; bootstrap artifact `supabase/full-schema.sql`

- Redis (run-backed streaming buffer, v2.5+)
  - Connection: `REDIS_URL` (`redis://localhost:6379` local, `rediss://...` cloud via Upstash TLS)
  - Client: `redis>=5.2,<6` async (`redis.asyncio.from_url`); singleton in `backend/app/dependencies.py:20-44` with `decode_responses=True`, `socket_timeout=10`, `socket_connect_timeout=5`
  - Use case: Per-run SSE event buffer using Redis Streams (`XADD` with `MAXLEN ~ 10000`, `XREAD` with cursor offset)
  - Key conventions (Phase 061+):
    - `run:{run_id}` (Stream) — per-run event buffer; TTL 600s on completed, 60s on failed
    - `runs_by_thread:{thread_id}` (Sorted set) — active runs per thread, score = started_at
    - `runs:active` (Sorted set) — global index of currently-streaming runs
  - No persistence (`--save ""`, `--appendonly no`); 256MB cap with `allkeys-lru` eviction
  - Startup `PING` is best-effort (`backend/app/main.py:67-72`); failure logs warning but does not block
  - Lifespan close: cancels all `RUN_TASKS`, then `aclose()` Redis client (`backend/app/main.py:79-96`)

**File Storage:**
- Supabase Storage (S3-compatible)
  - Buckets (created in `supabase/migrations/029_storage_buckets.sql`):
    - `documents` — uploaded source files; path: `{user_id}/{document_id}/{filename}`
    - `sandbox-outputs` — files produced by code execution; path: `{user_id}/{execution_id}/{filename}`
  - RLS: `storage.foldername(name)[1] = auth.uid()` — users see only their own folder
  - Backend touch points: `backend/app/api/documents.py`, `backend/app/api/folders.py`, `backend/app/api/skills.py`, `backend/app/api/sandbox_outputs.py`, `backend/app/services/sandbox_service.py`
  - Sandbox outputs use a re-sign endpoint (`GET /sandbox-outputs/{path}` → 302 to a fresh 60s signed URL) — never embeds long-lived URLs in messages (`backend/app/api/sandbox_outputs.py:35-40`)

**Caching:**
- TanStack React Query (frontend) — server-state cache; not a remote cache
- No backend in-memory or Redis cache outside the run buffer (Redis namespace is reserved for run buffers per `REDIS-SETUP.md` key conventions)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password + magic-link via Mailpit locally)
  - Frontend: `supabase.auth.signIn`, `supabase.auth.getSession` (`frontend/src/lib/api.ts:13`)
  - Backend: `HTTPBearer` scheme dependency `get_current_user` validates the access token via `supabase.auth.get_user(token)` (`backend/app/dependencies.py:47-58`)
  - Auth trigger `on_auth_user_created` (`supabase/migrations/001_initial_schema.sql`) auto-creates a profile row on signup
  - Test creds (local dev only): `fhdmrd@gmail.com / 123456` (per project memory)
- Row-Level Security on every user-data table — service role bypasses RLS only on the backend (writes) (mandated by `CLAUDE.md` rules)

## Monitoring & Observability

**Tracing:**
- LangSmith — `langsmith==0.2.3` SDK
  - Auth: `LANGSMITH_API_KEY`
  - Project: `LANGSMITH_PROJECT` (default `agentic-rag`; legacy `agentic-rag-module2` still defaulted in some code paths)
  - Toggle: `LANGSMITH_TRACING=true|false`
  - Configured at module import time (`backend/app/main.py:48-51`)
  - `@traceable` decorators on `web_search_service.web_search`, `rerank_service.rerank`, `sub_agent_service.run_sub_agent`, `retrieval_service` operations
  - Phase 067.1 includes a langsmith-py-version-aware drain helper for `_TracedStream` (the SDK's iterator wraps generator state in a way that breaks the run-task lifecycle; see `backend/app/api/threads.py:137`)

**Error Tracking:**
- None (no Sentry / Rollbar / Datadog APM integration in the codebase)
- Application-level audit log table `audit_log` (`backend/app/services/audit_service.py`); fire-and-forget writes via `BackgroundTasks` / `asyncio.create_task`

**Logs:**
- Python `logging` module — module-level loggers via `logging.getLogger(__name__)`
- `asyncio` logger forced to ERROR level to suppress spurious "socket.send() raised exception" noise during SSE client disconnects (`backend/app/main.py:12`)
- Frontend: `console.error` only

## CI/CD & Deployment

**Hosting:**
- Production target: Hostinger VPS (per SEED-003 — deferred; Redis self-hosted on same VPS planned)
- Cloud DB: Supabase managed Postgres
- Cloud Redis: Upstash recommended (free tier, TLS via `rediss://`)
- Frontend hosting: not yet committed to a target (Vite static build deployable anywhere)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/backend-tests.yml`
  - Triggers: pushes to `master`, `main`, `develop`, `release/**`; PRs on backend / migrations changes
  - Steps: Python 3.12, install backend deps, boot Redis via `docker compose -f docker-compose.dev.yml up -d redis`, host-port readiness probe, `pytest tests -q`
  - No frontend test job, no Playwright e2e job, no lint job in CI yet

**Deployment Story:**
- Migrations: Apply via Supabase SQL editor (manual paste of `supabase/migrations/NNN_*.sql`) — never `supabase db push`/`db reset` against the local dev DB (preserves data); see `CLAUDE.md` rules + `supabase/SETUP.md`
- Bootstrap a fresh cloud project: either `supabase db push` (preferred, includes auth-trigger + storage buckets) or paste `supabase/full-schema.sql` (Path 2 — requires manual storage bucket + auth trigger setup; see `supabase/SETUP.md` "Storage buckets and auth triggers caveat")
- After applying any migration: regenerate `supabase/full-schema.sql` via `bash scripts/regenerate-full-schema.sh` (default = live DB dump, no reset); commit migration + regenerated schema together

## Environment Configuration

**Required env vars (backend, `backend/.env`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — runtime
- `SUPABASE_ANON_KEY` — public-key parity with frontend
- `REDIS_URL` — run-backed streaming buffer
- `LLM_PROVIDER` + matching `*_API_KEY` (one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`)
- `LLM_MODEL` (default model id), `OPENAI_MODELS` / `ANTHROPIC_MODELS` / etc. (UI dropdowns)
- `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`
- `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`

**Optional env vars (backend):**
- `TAVILY_API_KEY` — enables web search tool
- `RERANK_API_KEY`, `RERANK_PROVIDER`, `RERANK_MODEL`, `RERANK_TOP_N` — reranking
- `SANDBOX_ENABLED`, `SANDBOX_TTL_MINUTES` — code execution
- `ANYIO_THREAD_TOKENS` (default 200) — concurrency cap
- `LLM_CALL_TIMEOUT_OVERRIDES` — per-model timeout map (Phase 066 D-066-03)
- `CONSUMER_TIMEOUT_SECONDS` (default 610) — SSE consumer deadline
- `MODEL_CONTEXT_LIMITS`, `MODEL_OUTPUT_LIMITS` — per-model overrides
- `ENABLE_TEST_FIXTURES=1` — mounts `/__test__/inject-failed-run` (test harness only; refuses to start if `ENVIRONMENT=production`)
- `FRONTEND_URL` (default `http://localhost:5173`) — CORS allow-list anchor

**Required env vars (frontend, `frontend/.env.local`):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — `frontend/src/lib/supabase.ts`
- `VITE_API_BASE_URL` — backend FastAPI URL (`frontend/src/lib/api.ts:9`)

**Secrets location:**
- All gitignored: `.env`, `.env.local`, `.env.*.local`, `settings_override.json` (`backend/settings_override.json` is the Settings UI override file)
- Never commit: `backend/.env`, `frontend/.env.local`
- Local Supabase keys are deterministic (CLI default JWT secret) — safe for local dev only

## Webhooks & Callbacks

**Incoming:** None — no inbound webhook handlers (`/health`, `/models`, the routers in `app.api.*`, and the test-fixture path are the only mounted routes; `backend/app/main.py:138-169`).

**Outgoing:** None — no outbound webhook delivery system (no retry queue, no signing, no event bus).

**Real-time channels:**
- Supabase Realtime (frontend → Postgres) — best-effort hint, NOT source of truth (decision D-v2.5-03)
  - Subscriptions: `folders` table (`frontend/src/hooks/useFolders.ts:43-68`), `documents` table (`frontend/src/hooks/useDocuments.ts:62`)
  - Pattern: `supabase.channel(name).on("postgres_changes", {event: "*", schema: "public", table: ...}).subscribe()`
  - Always reconciled via fetch on (re)connect — Realtime payloads can be missed
  - Migration `032_phase56_realtime.sql` configures publication membership
- SSE (backend → frontend) — `sse-starlette.EventSourceResponse`
  - `GET /runs/{run_id}/stream?since={offset}` — replay-tail consumer reads from Redis Stream `run:{run_id}` (`backend/app/api/runs.py`)
  - Frontend uses `fetch` + manual ReadableStream parse rather than `EventSource` because the WHATWG `EventSource` API cannot send Bearer auth headers (`frontend/src/lib/api.ts:259, 274`)
  - Wire format: `data: {json}\nid: {redis-stream-id}\n\n`
  - Terminal sentinel types: `done`, `error`, `cancelled`, `timed_out` (Phase 066 D-066-06)

---

*Integration audit: 2026-05-09*
