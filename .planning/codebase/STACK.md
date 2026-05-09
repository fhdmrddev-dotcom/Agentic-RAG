<!-- refreshed: 2026-05-09 -->
# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript ~5.9.3 — Frontend (`frontend/src/**/*.ts`, `frontend/src/**/*.tsx`)
- Python 3.12 — Backend (`backend/app/**/*.py`); CI pins `python-version: "3.12"` (`.github/workflows/backend-tests.yml:28`)

**Secondary:**
- SQL — Supabase migrations in `supabase/migrations/` (38 numbered files, latest `038_runs_timed_out_status.sql`); pgvector functions, RLS policies
- Shell (Bash) — `scripts/regenerate-full-schema.sh` (run via Git-bash on Windows)

## Runtime

**Environment:**
- Node.js — Frontend dev server (Vite 8.0) and build toolchain
- Python 3.12 — Backend runtime via venv at `backend/venv/` (mandated by `CLAUDE.md` rules section)
- Single Uvicorn worker — `--workers N` is forbidden by decision D-v2.5-02 (in-memory state: `RUN_TASKS` registry, `_BACKGROUND_TASKS` set, sandbox session map)

**Package Manager:**
- npm — Frontend (`frontend/package.json`); separate workspace `e2e/package.json` for Playwright tests
- pip — Backend (`backend/requirements.txt`, pinned versions for runtime deps, `>=` for SDK floors)
- Lockfiles: `frontend/package-lock.json` (committed); `e2e/` has its own; backend has no lockfile (requirements.txt pins critical versions directly)

## Frameworks

**Core (Frontend):**
- React 19.2.4 — UI framework (`frontend/src/`)
- Vite 8.0 — Dev server and bundler (`frontend/vite.config.ts`)
- TanStack React Query 5.90 — Server state (`frontend/src/hooks/`)
- React Markdown 10.1 + remark-gfm 4.0 + react-syntax-highlighter 16.1 + DOMPurify 3.3 — Markdown rendering with syntax-highlighted code (`frontend/src/components/chat/MarkdownRenderer.tsx`)
- Recharts 3.8 — Knowledge-health charts (`frontend/src/components/health/RetrievalTrendChart.tsx`)
- Marked 17.0 — Secondary markdown parser (used alongside react-markdown)

**Core (Backend):**
- FastAPI 0.115.6 — REST API framework (`backend/app/main.py`)
- Uvicorn 0.32.1 (`[standard]` extras for httptools/websockets) — ASGI server
- sse-starlette 2.4.1 — `EventSourceResponse` for SSE streaming (`backend/app/api/runs.py:43`, `backend/app/api/threads.py`)
- Pydantic + pydantic-settings 2.7 — Models, env loading, structured outputs (mandated, no LangChain)
- Starlette concurrency primitives — `run_in_threadpool` wraps blocking supabase-py calls (decision D-v2.5-01; helper at `backend/app/utils/db.py`)
- AnyIO — Default thread limiter bumped to 200 tokens at startup (`backend/app/main.py:59`, `Settings.anyio_thread_tokens`)

**UI System:**
- Tailwind CSS 3.4.19 + tailwindcss-animate 1.0.7 + @tailwindcss/typography 0.5.19 (`frontend/tailwind.config.js`, `frontend/postcss.config.js`)
- shadcn/ui (slate base, default style, CSS variables) — configured in `frontend/components.json`; primitives under `frontend/src/components/ui/`
- Radix UI primitives — `@radix-ui/react-{alert-dialog,avatar,collapsible,dialog,dropdown-menu,label,scroll-area,select,separator,slot,tabs,tooltip}` (12 packages)
- Lucide React 0.577 — Icon library (`iconLibrary: "lucide"` in components.json)
- class-variance-authority 0.7 + clsx 2.1 + tailwind-merge 3.5 — Class composition

**Testing:**
- pytest 8.0+ + pytest-asyncio 0.24 + pytest-timeout 2.4 — Backend test runner (`backend/tests/`); `conftest.py` at `backend/tests/conftest.py`; CI runs `pytest tests -q`
- Vitest 4.1 + @vitest/ui 4.1 + jsdom 29 — Frontend unit tests (`frontend/src/__tests__/`, `frontend/src/setupTests.ts`)
- @testing-library/react 16.3 + @testing-library/jest-dom 6.9 + @testing-library/user-event 14.6 — Component testing
- Playwright 1.49 — E2E browser tests (`e2e/playwright.config.ts`, `e2e/tests/*.spec.ts`); chromium-only

**Build/Dev:**
- TypeScript 5.9 with project references (`frontend/tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`); `strict`, `noUnusedLocals`, `verbatimModuleSyntax`, `moduleResolution: bundler`
- ESLint 9.39 (flat config, `frontend/eslint.config.js`) + typescript-eslint 8.56 + eslint-plugin-react-hooks 7.0 + eslint-plugin-react-refresh 0.5
- @vitejs/plugin-react 6.0 — React Fast Refresh
- autoprefixer 10.4 — PostCSS pipeline

## Key Dependencies

**Critical (Backend LLM/Agent):**
- `openai>=2.0.0` — Default client for OpenAI, OpenRouter, Google (Gemini OpenAI-compat endpoint), Ollama (`backend/app/services/openai_service.py`); also used as Anthropic fallback ImportError shim (`backend/app/api/threads.py:18-20`)
- `anthropic>=0.97.0` — Native Anthropic SDK (raw, not LangChain) for Claude tool_use streaming (`backend/app/services/anthropic_service.py:24`)
- `tiktoken>=0.12.0` — Token counting via `cl100k_base` encoder for OpenAI models (`backend/app/services/context_window.py:16-37`); chars/4 fallback for non-OpenAI providers
- `redis>=5.2,<6` — Async client `redis.asyncio.from_url` for run-backed streaming buffer (`backend/app/dependencies.py:1`, `decode_responses=True`); Streams API (`XADD`, `XREAD`, `EXPIRE`)
- `supabase==2.10.0` — Sync Python client; **MUST** be wrapped in `run_in_threadpool`/`aexec` per D-v2.5-01

**Critical (Frontend):**
- `@supabase/supabase-js ^2.99.2` — Auth + Postgres client + Realtime (`frontend/src/lib/supabase.ts`)
- `@tanstack/react-query ^5.90.21` — Server-state cache for documents, folders, threads, skills

**Document Ingestion (Python):**
- `pypdf>=5.0.0` — PDF text extraction (`backend/app/api/documents.py:8`)
- `python-docx>=1.0.0` — DOCX extraction
- `pdfplumber>=0.11.0` — PDF table extraction (`backend/app/services/multimodal_service.py:42`)
- `python-pptx>=1.0.0` — PowerPoint extraction
- `openpyxl>=3.1.0` — XLSX extraction
- `ebooklib>=0.18` — EPUB extraction
- `python-multipart==0.0.20` — FastAPI multipart/form-data file upload

**Retrieval & Embedding:**
- OpenAI `text-embedding-3-small` (default, 1536 dim) via `openai>=2.0.0`
- `sentence-transformers>=3.0.0` — Optional local CrossEncoder reranker (`backend/app/services/rerank_service.py:34`); lazy-loaded
- pgvector — Postgres extension (Supabase) for vector similarity search

**Code Execution:**
- `llm-sandbox[docker]>=0.3.37` — Containerised Python sandbox; `InteractiveSandboxSession(lang="python")` (`backend/app/services/sandbox_service.py:24`); lazy-imported only when `SANDBOX_ENABLED=true`

**Observability:**
- `langsmith==0.2.3` — Tracing decorator `@traceable` across `web_search_service`, `rerank_service`, `sub_agent_service`, `retrieval_service`; configured via `LANGSMITH_*` env vars set at module import time (`backend/app/main.py:48-51`)

**HTTP/Misc:**
- `httpx>=0.27.0` — Used directly for Tavily search (`backend/app/services/web_search_service.py:1`) and Cohere rerank API (`backend/app/services/rerank_service.py:17`); also FastAPI test client transport
- `python-dotenv==1.0.1` — `.env` loading via `pydantic-settings`

**Infrastructure:**
- Docker — Required for `llm-sandbox`, Supabase CLI local stack, and Redis (`docker-compose.dev.yml`)
- Redis 7-alpine — Run-buffer (`docker-compose.dev.yml:17`); ephemeral (`--save ""`, `--appendonly no`), 256MB cap, allkeys-lru eviction

## Configuration

**Environment:**
- Backend: `backend/.env` (gitignored); template at `backend/.env.example`; loaded via `pydantic_settings.BaseSettings` with `extra="ignore"` (`backend/app/config.py:245`)
- Frontend: `frontend/.env.local` (gitignored); reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (`frontend/src/lib/supabase.ts`, `frontend/src/lib/api.ts:9`)
- Override file: `backend/settings_override.json` (gitignored) — Settings UI writes here; takes precedence over `.env` for non-secret app settings (`backend/app/models/user_settings.py:27`)

**Key configs required:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Auth + DB access
- `REDIS_URL` — `redis://localhost:6379` local; `rediss://...` cloud (Upstash TLS)
- `LLM_PROVIDER` + per-provider key (`OPENAI_API_KEY` | `ANTHROPIC_API_KEY` | `GOOGLE_API_KEY` | `OPENROUTER_API_KEY` | `OLLAMA_BASE_URL`)
- `EMBEDDING_MODEL` (`text-embedding-3-small`), `EMBEDDING_DIMENSIONS` (1536) — must match the pgvector column width
- `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING` — Observability
- `SANDBOX_ENABLED` — Gates Docker code execution
- `TAVILY_API_KEY` — Enables web search tool (otherwise tool is hidden)
- `RERANK_*` — Optional Cohere or local CrossEncoder
- Phase 066: `LLM_CALL_TIMEOUT_OVERRIDES` (per-model override map), `CONSUMER_TIMEOUT_SECONDS` (default 610s)
- Phase 058: `ANYIO_THREAD_TOKENS` (default 200)
- Test-only: `ENABLE_TEST_FIXTURES=1` mounts `/__test__/inject-failed-run` (refuses to start if `ENVIRONMENT=production`; `backend/app/main.py:161-167`)

**Build:**
- Frontend: `vite.config.ts` with `@` → `./src` alias; `npm run build` runs `tsc -b && vite build`
- Backend: no build step; `uvicorn app.main:app --reload --port 8000`

## Platform Requirements

**Development:**
- Docker Desktop (for Supabase CLI stack, Redis container, optional sandbox)
- Supabase CLI (managed locally; `supabase start` boots Postgres on :54322 / API on :54321 / Studio on :54323 / Mailpit on :54324)
- Python 3.12 + venv at `backend/venv/` (Windows: `.\venv\Scripts\Activate.ps1`)
- Node.js 22+ (Vite 8 requires modern Node)
- Git Bash (Windows) — for `scripts/regenerate-full-schema.sh`

**Production:**
- Cloud Supabase (project URL + service role key) — vector store, auth, storage, realtime
- Cloud Redis (Upstash recommended, free tier; `rediss://` URL with TLS) — run-backed streaming buffer; or self-hosted Redis on the same VPS for SEED-003 (Hostinger) deploys
- Single Uvicorn worker per process — D-v2.5-02 forbids `--workers N`
- Docker host — only if `SANDBOX_ENABLED=true`
- LLM provider keys + LangSmith key

**CI:**
- GitHub Actions: `.github/workflows/backend-tests.yml` — Ubuntu, Python 3.12, boots Redis from `docker-compose.dev.yml`, runs `pytest tests -q`. No frontend or e2e job currently wired in CI.

---

*Stack analysis: 2026-05-09*
