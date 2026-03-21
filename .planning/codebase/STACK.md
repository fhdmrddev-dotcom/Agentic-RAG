# Technology Stack
_Generated: 2026-03-21_

## Summary

Agentic RAG is a full-stack application with a React/TypeScript frontend, a Python/FastAPI backend, and Supabase as the database and auth platform. The backend exposes a streaming REST API consumed by the frontend via SSE, with no LangChain dependency — all LLM calls are made directly through the OpenAI SDK against an OpenAI-compatible endpoint.

## Languages

**Primary:**
- TypeScript 5.9 — all frontend source code under `frontend/src/`
- Python 3.12 — all backend source code under `backend/app/`

**Secondary:**
- SQL — Supabase migrations in `supabase/migrations/` and `backend/supabase/migrations/`

## Runtime

**Frontend:**
- Node.js 22.14 — frontend build and dev server

**Backend:**
- Python 3.12.6 — FastAPI application server
- Virtual environment: `backend/venv/` (required, managed manually)

**Package Managers:**
- npm — frontend (`frontend/package-lock.json` present)
- pip — backend (`backend/requirements.txt`)

## Frameworks

**Backend Core:**
- FastAPI 0.115.6 — REST API framework (`backend/app/main.py`)
- Uvicorn 0.32.1 (standard) — ASGI server
- Pydantic-settings 2.7.0 — settings and structured LLM output validation (`backend/app/config.py`, `backend/app/models/`)

**Frontend Core:**
- React 19.2 — UI framework
- Vite 8.0 — build tool and dev server (`frontend/vite.config.ts`)
- TypeScript 5.9 — static typing

**Styling:**
- Tailwind CSS 3.4 — utility-first CSS (`frontend/tailwind.config.js`)
- shadcn/ui — component library built on Radix UI primitives (`frontend/src/components/ui/`)
- tailwindcss-animate 1.0.7 — animation utilities
- @tailwindcss/typography 0.5.19 — prose rendering for markdown

## Key Dependencies

**Backend:**
- `openai>=2.0.0` — LLM and embedding API client (OpenAI-compatible, used for OpenRouter and local endpoints too) — `backend/app/services/openai_service.py`
- `supabase==2.10.0` — database, auth, and storage client — `backend/app/dependencies.py`
- `langsmith==0.2.3` — LLM observability and tracing — `backend/app/main.py`, `backend/app/services/`
- `pydantic-settings==2.7.0` — config management from `.env` — `backend/app/config.py`
- `python-dotenv==1.0.1` — .env file loading
- `python-multipart==0.0.20` — multipart file upload handling
- `pypdf>=5.0.0` — PDF text extraction — `backend/app/api/documents.py`
- `python-docx>=1.0.0` — DOCX text extraction — `backend/app/api/documents.py`
- `httpx>=0.27.0` — async HTTP client used for Tavily and Cohere API calls — `backend/app/services/web_search_service.py`, `backend/app/services/rerank_service.py`
- `sentence-transformers>=3.0.0` — local reranking via CrossEncoder (lazy-loaded) — `backend/app/services/rerank_service.py`

**Frontend:**
- `@supabase/supabase-js ^2.99.2` — Supabase auth and Realtime client — `frontend/src/lib/supabase.ts`
- `@tanstack/react-query ^5.90.21` — server state management
- `react-markdown ^10.1.0` + `remark-gfm ^4.0.1` — markdown rendering in chat
- `marked ^17.0.4` — additional markdown processing
- `dompurify ^3.3.3` — XSS sanitization for rendered HTML
- `react-syntax-highlighter ^16.1.1` — code block syntax highlighting
- `lucide-react ^0.577.0` — icon set
- Radix UI primitives (`@radix-ui/react-*`) — accessible headless components backing shadcn/ui

## Build / Dev Tools

**Frontend:**
- `vite ^8.0.0` — dev server (HMR) and production bundler
- `@vitejs/plugin-react ^6.0.0` — React Fast Refresh integration
- `typescript-eslint ^8.56.1` + `eslint ^9.39.4` — linting
- `postcss ^8.5.8` + `autoprefixer ^10.4.27` — CSS processing

**Backend:**
- `pytest>=8.0.0` + `pytest-asyncio>=0.24.0` — test runner (`backend/pytest.ini`, `backend/tests/`)

**E2E:**
- `@playwright/test ^1.49.0` — end-to-end browser testing (`e2e/`)

## Configuration

**Frontend env vars (VITE_ prefix, public):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `VITE_API_BASE_URL` — backend API base URL

**Backend env vars (loaded via pydantic-settings from `.env`):**
- See `backend/app/config.py` for the full `Settings` class — all fields map 1:1 to env vars

## Path Aliases

- Frontend: `@` → `frontend/src/` (configured in `frontend/vite.config.ts`)

---

*Stack analysis: 2026-03-21*
