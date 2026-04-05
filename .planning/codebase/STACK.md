# Technology Stack
_Last updated: 2026-04-05_

## Languages

**Primary:**
- TypeScript ~5.9.3 — Frontend (all `.ts` / `.tsx` source files in `frontend/src/`)
- Python 3.12.6 — Backend (all files in `backend/app/`)

**Secondary:**
- SQL — Supabase migrations in `supabase/migrations/` (19 migration files, pgvector functions, RLS policies)

## Runtime

**Environment:**
- Node.js v22.14.0 — Frontend dev server and build toolchain
- Python 3.12.6 — Backend runtime via virtual environment at `backend/venv/`

**Package Manager:**
- npm — Frontend (`frontend/package.json`)
- pip — Backend (`backend/requirements.txt`)
- Lockfile: present for frontend; backend uses `requirements.txt` with pinned versions

## Frameworks

**Core:**
- React 19.2.4 — UI framework (`frontend/src/`)
- FastAPI 0.115.6 — REST API framework (`backend/app/main.py`)
- Uvicorn 0.32.1 (standard extras) — ASGI server for FastAPI

**UI Component Library:**
- shadcn/ui pattern — Radix UI primitives + Tailwind CSS (individual `@radix-ui/*` packages, no monolithic shadcn package)
  - Radix UI packages: `@radix-ui/react-avatar`, `react-dialog`, `react-dropdown-menu`, `react-label`, `react-scroll-area`, `react-select`, `react-separator`, `react-slot`, `react-tooltip`
- Tailwind CSS 3.4.19 — Utility-first CSS (`frontend/tailwind.config.js`)
  - `tailwindcss-animate` 1.0.7 — animation utilities
  - `@tailwindcss/typography` 0.5.19 — prose styling for markdown output
- `class-variance-authority` 0.7.1 — variant-based component styles
- `tailwind-merge` 3.5.0 — class merging utility
- `lucide-react` 0.577.0 — icon library
- Fonts: Inter (sans), Manrope (headline), JetBrains Mono (mono) — loaded via CSS

**State Management:**
- `@tanstack/react-query` 5.90.21 — server state and caching (no Redux / Zustand)
- React built-in `useState` / `useEffect` — local component state
- Custom hooks in `frontend/src/hooks/` — encapsulate shared stateful logic (auth, documents, threads, folders, skills, messages, theme)

**Markdown / Content Rendering:**
- `react-markdown` 10.1.0 with `remark-gfm` 4.0.1 — renders LLM responses
- `marked` 17.0.4 — secondary markdown parser
- `react-syntax-highlighter` 16.1.1 — code block highlighting in chat
- `dompurify` 3.3.3 — sanitizes HTML before rendering

**Testing:**
- Vitest 4.1.0 — frontend unit test runner (`frontend/vitest.config.ts`, jsdom environment)
- `@testing-library/react` 16.3.2 + `@testing-library/user-event` 14.6.1 — component testing
- `@testing-library/jest-dom` 6.9.1 — DOM assertion matchers
- Playwright 1.49.0 — end-to-end browser tests (`e2e/package.json`)
- pytest 8.0.0+ with `pytest-asyncio` 0.24.0+ — backend unit/integration tests (`backend/pytest.ini`)
- `httpx` 0.27.0+ — async HTTP client used in backend tests

**Build / Dev:**
- Vite 8.0.0 — frontend bundler and dev server (`frontend/vite.config.ts`)
  - `@vitejs/plugin-react` 6.0.0 — React Fast Refresh and JSX transform
  - Path alias `@` → `./src` configured in both `vite.config.ts` and `vitest.config.ts`
- PostCSS 8.5.8 + Autoprefixer 10.4.27 — CSS processing (`frontend/postcss.config.js`)
- TypeScript compiler (`tsc -b`) — type-checking before production build

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.99.2 — frontend client for auth, Realtime subscriptions (`frontend/src/lib/supabase.ts`)
- `supabase` 2.10.0 (Python SDK) — backend client for database queries and storage (`backend/app/dependencies.py`)
- `openai` ≥2.0.0 — ALL LLM inference and embeddings via OpenAI-compatible API (supports multiple providers via `base_url` swap); raw SDK calls only, no LangChain (`backend/app/services/openai_service.py`)
- `pydantic-settings` 2.7.0 — type-safe config from env vars (`backend/app/config.py`)
- `langsmith` 0.2.3 — tracing and observability via `@traceable` decorators on retrieval, reranking, web search, and sub-agent functions

**Document Processing:**
- `pypdf` ≥5.0.0 — PDF text extraction
- `python-docx` ≥1.0.0 — Word document text extraction
- `python-multipart` 0.0.20 — multipart file upload support for FastAPI endpoints

**Retrieval / AI:**
- `sentence-transformers` ≥3.0.0 — local cross-encoder reranking (`backend/app/services/rerank_service.py`); lazy-loaded only when `RERANK_PROVIDER=local`
- `httpx` ≥0.27.0 — sync HTTP client for Tavily web search and Cohere reranking API calls

**Code Execution Sandbox:**
- `llm-sandbox[docker]` ≥0.3.37 — Docker-based Python code sandbox (`backend/app/services/sandbox_service.py`); lazy-loaded only when `SANDBOX_ENABLED=true`

## Configuration

**Environment:**
- Backend config loaded via `pydantic-settings` from `backend/.env` (`backend/app/config.py`)
- Frontend config loaded via Vite's `import.meta.env` (vars must be prefixed `VITE_`)
- Key backend vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`), `LANGSMITH_API_KEY`, `TAVILY_API_KEY`, `SANDBOX_ENABLED`
- Key frontend vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Per-user runtime overrides via `backend/settings_override.json`

**Build:**
- Frontend: `frontend/tsconfig.json` (composite), `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Backend: no build step — Python runs directly from source in venv

## Linting

- ESLint 9.39.4 — frontend linting (`frontend/eslint.config.js`)
  - `typescript-eslint` 8.56.1
  - `eslint-plugin-react-hooks` 7.0.1
  - `eslint-plugin-react-refresh` 0.5.2
- No Prettier config detected — formatting not enforced by tooling
- No backend linter config detected (no `ruff.toml`, `.flake8`, or `mypy.ini`)

## Platform Requirements

**Development:**
- Python 3.12+ with venv at `backend/venv/`
- Node.js 22+
- Docker — required only when `SANDBOX_ENABLED=true` (llm-sandbox)
- Supabase project (cloud or local via `start_supabase.bat`)

**Production:**
- Deployment target not explicitly declared; FastAPI served by Uvicorn; frontend built as static assets via Vite
