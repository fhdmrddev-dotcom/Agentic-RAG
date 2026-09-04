# Agentic RAG

**An agentic RAG platform — a chat-first AI agent that grounds its answers in your private knowledge base, runs Python in a sealed Docker sandbox, can be taught skills that persist across chats, and can run multi-phase, publish-gated workflows you author in plain English.**

---

## What it is

Agentic RAG is a self-hostable platform for building an AI agent that answers **strictly from your own documents** (RAG — Retrieval-Augmented Generation: the agent retrieves relevant passages from your knowledge base and cites them, rather than answering from the model's general training). On top of question-answering, it lets you turn recurring knowledge work into **workflows** — durable, validated, multi-step procedures that produce a real, cited, integrity-checked deliverable (a filled `.docx`, `.pptx`, or `.xlsx`).

Chat is the default interface. Document ingestion is a deliberate, manual file-upload flow — there are no automated connectors or background pipelines, so you always know exactly what is in the knowledge base.

**Who it's for.** Technically-minded operators and evaluators at organizations (B2B-first; the platform is designed to serve from a few users to org-scale production from a single codebase). You do not need to be an expert coder to operate it, but you should be comfortable with API keys, environment variables, and Docker. The product is aimed at teams that want an agent which (1) answers only from their documents with citations, (2) automates recurring knowledge tasks as reviewable, validated workflows, and (3) can be deployed against published infrastructure requirements by the buyer.

---

## Key Features

### Chat & RAG

- **Streaming chat over SSE.** Responses stream token-by-token via Server-Sent Events. Chat completions are **stateless** — the app stores and re-sends conversation history itself, with no provider-side thread state — which keeps behavior identical across providers. Run events are buffered through Redis Streams so a client that refreshes, switches tabs, or navigates away can reconnect and replay the in-flight stream (Realtime is treated only as a hint; the client always reconciles by fetching).
- **Hybrid retrieval with citations.** Search fuses **vector similarity** (pgvector cosine) and **Postgres keyword search** using Reciprocal Rank Fusion (RRF), deduplicates, and returns cited passages with similarity scores. Hybrid search is on by default; an optional **reranking** stage (Cohere `rerank-v3.5` or a local `sentence-transformers` cross-encoder) can be enabled. A low-confidence guard hedges answers when the best match is weak, to avoid fabricating answers from thin retrieval.
- **Folder-scoped knowledge.** Folders are organized as a tree; a thread can be scoped to a folder so retrieval is clipped to that folder and its sub-tree.
- **Cross-session memory.** `remember` / `recall` tools persist user facts and preferences so they survive across threads.
- **Citations, confidence badges, suggested follow-ups, and an audit trail** surface what the agent did and how sure it was.

### Document ingestion

- **Manual upload only** — no connectors, no scheduled crawls. You upload a file and it is processed.
- **Multi-aspect extraction.** Separate, swappable extractors handle each aspect of a document: text (PDF text via PyMuPDF, in-process), tables (Camelot / pdfium + pdfplumber), images embedded in PDF/DOCX (described by a vision model), and equations.
- **Hierarchical chunking** (default size 1000 / overlap 200), then **OpenAI embeddings** (`text-embedding-3-small`, 1536 dimensions) stored in pgvector. Extracted tables become queryable via the `query_tables` tool.

### Agent tools (including sandboxed code execution)

The agent runs a **multi-iteration tool-calling loop** over a raw provider stream. Tool dispatch is a registry — adding a tool is one handler plus one registry line, with no changes to the request path. Three operating modes:

- **General / Deep** — the full toolbox, up to 15 iterations.
- **Explorer** — knowledge-base navigation and analysis only, up to 8 iterations.
- **Harness / Workflow** — a per-phase locked tool whitelist (see below).

Available tools include knowledge-base navigation (`ls`, `tree`, `grep`, `glob`, `read_document`), retrieval (`search_documents`, `query_documents`, `query_tables`), `web_search` (Tavily, only when configured), document analysis via a sub-agent (`analyze_document`), task delegation (`task` — a one-level-nested sub-agent whose toolset is a subset of the parent's), live planning (`write_todos`), human-in-the-loop pauses (`ask_user`), a per-thread file workspace (`workspace_write/read/list/delete/diff` with versioning and unified diffs), memory (`remember`, `recall`), skills (`load_skill`, `save_skill`, `read_skill_file`), and deliverable rendering (`render_template`).

- **Code execution in a Docker sandbox.** `execute_code` runs Python inside an `llm_sandbox`-managed Docker container, gated by `SANDBOX_ENABLED` (off by default). It streams stdout/stderr live, harvests any output files into Storage with signed download links, and enforces a wall-clock timeout that kills and removes the container on expiry. The sandbox is **network-less by design** (the agent cannot reach the internet from inside it). Sessions are cached per thread (idle eviction defaults to 30 minutes). A pre-built image ships with a data-science and document-generation package set (matplotlib, numpy, pandas, scipy, scikit-learn, seaborn, plotly, python-pptx, openpyxl, python-docx, pypdf, reportlab, docxtpl) so the agent does not have to `pip install` on every new chat.

### Persistent skills

- The agent can be **taught skills that persist** across chats. A skill carries instructions plus attached files (in Storage), is either user-owned or **global** (the only shared scope), and can be injected into the sandbox.
- Skills follow an open standard with `SKILL.md` YAML frontmatter and ZIP import/export.
- When a workflow references a skill, the skill is **snapshotted immutably at first run**, so a later edit or deletion can never change what a published workflow does.

### Harness / Workflow engine

- Runs **multi-phase workflows** from a strictly-typed JSON workflow definition. Six phase types:
  - `programmatic` — deterministic code, no model call;
  - `llm_single` — one model turn;
  - `llm_agent` — a full tool-using agent turn;
  - `llm_batch_agents` — parallel fan-out (default 5);
  - `llm_human_input` — pauses for `ask_user`;
  - `llm_emit` — a sealed, **forced** structured emission (used for deliverables).
- Each phase accumulates outputs and can declare its own **tool whitelist**, model override, wall-clock cap, and validation gates. A non-whitelisted tool call is refused at dispatch and audited.
- Runs are **claimed atomically (compare-and-swap)** so that, with multiple workers, no run is ever double-executed; sandbox sessions re-attach by container-name convention so runs survive worker restarts.

### Validation gates

- A **closed registry of 9 gate kinds**: `json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`, `citations_required`, `freshness`, `structure_check`, `output_file_valid`, and `llm_judge_rubric`.
- Gates run before or after a phase. On failure, a gate can `fail_run`, `retry`, `skip_to_phase`, or `ask_user`.
- Pass/fail is always driven by a **schema-bound boolean**, never by matching a regex against the model's prose — so a model that *narrates* a success it didn't achieve cannot game the gate.

### LLM-judge output-quality gate

- The `llm_judge_rubric` gate forces a judge model to emit a structured rubric verdict over a phase's **real output**. A workflow that is structurally lint-clean but produces bad output **cannot publish** (the hard quality wall). The judge works cross-provider and grades both free-form prose and filled templates.

### Workflow Studio

The authoring surface that turns the engine into something a domain expert can use without writing code:

- **Natural-language authoring.** `POST /workflows/generate` turns a plain-English description into one schema-valid, knowledge-base-grounded workflow **draft** via a single forced structured emission, grounded on the folder tree, the tool/skill registry, and any optional template placeholders. It retries once against the validation error, then returns an honest structured failure — never a partial draft.
- **Template-fill deliverables.** The `render_template` / `llm_emit` path produces typed documents (`.docx` / `.pptx` / `.xlsx`). The model emits a **cited field-map** (each value tied to a source chunk/page); a pinned, deterministic driver renders the bytes inside the sandbox (using `docxtpl` / `python-docx` in a Jinja `SandboxedEnvironment` with autoescape — no model-written code ever touches the file bytes). A citation policy (strict / flag / partial / draft) and an integrity check enforce that uncited values are marked or blanked, **never silently filled**, and the rendered file is re-opened to verify it isn't corrupt before delivery. Templates can be uploaded **for a single run only** (workspace-scoped, never ingested into the knowledge base, expiring via TTL).
- **The publish gauntlet.** A draft becomes *published* only by passing an ordered, server-side gauntlet that returns a structured verdict naming the blocking stage and the named failures: owner check → already-published check → definition validation → a declared business requirement is present → structural lint (reachable, terminal, satisfiable inputs) → interactive-phase pre-run block → a **real golden run on the project's knowledge base (no mocks)** → structural gate → the **judge verdict (hard blocker)** → the publish flip. Each attempt writes `publish_attempted` / `blocked` / `succeeded` receipts.
- **The Workflows page.** A project-filtered **library**, a **Builder** with a read-only vertical phase-spine graph plus side-panel forms (view, not drag-to-build — a deliberate choice for the domain-expert audience), and a **Run** action that forks a new chat thread and kicks off a real server-side run. Published definitions are immutable and versioned.

### Observability & audit

- Every LLM call is auto-traced to **LangSmith** (per-provider labels). An **append-only audit log** records sensitive actions — `search.query`, `code.execute`, `skill.load`, memory operations, and harness events (`phase_started`, `gate_failed`, `tool_refused`, `judge_verdict`, …).

---

## Architecture

One UX, N provider adapters. The frontend speaks a single, provider-agnostic streaming vocabulary; a backend **provider gateway** translates each provider's native streaming into that shared SSE format. The harness/workflow layer is built strictly **on top of** the chat agent loop and is inert unless a workflow is active.

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 8 + TypeScript + Tailwind 3 + shadcn/ui (Radix UI), Zustand 5, TanStack Query 5, `@supabase/supabase-js`, react-markdown + DOMPurify, recharts. No router — a layout component switches views (chat / documents / skills / workflows / settings / library-health). Tests: Vitest + Playwright. Design system: Aether Intelligence, Deep Midnight theme. |
| **Backend** | Python + FastAPI 0.115 on uvicorn, SSE via `sse-starlette`. **Raw provider SDKs only — no LangChain, no LangGraph.** Pydantic / pydantic-settings for structured LLM outputs and strict config (`extra='forbid'`). Blocking I/O is wrapped in `run_in_threadpool`. `asyncpg` pool + `supabase-py`. |
| **Database** | Supabase Postgres with **pgvector** for embeddings plus Postgres keyword search; Supabase **Auth**, **Storage** (documents, skill files, sandbox outputs), and **Realtime** (best-effort hint only). Schema ships as numbered SQL migrations (currently through `070`) with a single-file `full-schema.sql` deploy artifact for greenfield environments. |
| **LLM providers** | Routed via a `MODEL_CAPABILITIES` registry. OpenAI (native SDK), Anthropic (native SDK), Google (google-genai native SDK), DeepSeek, Moonshot/Kimi, MiniMax, Zhipu/GLM, OpenRouter (experimental, OpenAI-compatible), and Ollama (local inference fallback). The registry keys per-model native-tool support, provider, timeout, max output tokens, parallel-tool support, max tools (Google capped at 16), forced-emission tier, and strict-schema support; unknown model IDs fall back to safe pattern-based inference. |
| **Code sandbox** | Docker via `llm_sandbox[docker]`, gated by `SANDBOX_ENABLED`. Pre-built image `backend/Dockerfile.sandbox` (`python:3.11-slim`) with data-science + document-generation packages. Sessions keyed per thread with idle eviction and a wall-clock kill timeout; network-less posture. |
| **Cache / streaming buffer** | Redis 7 (`redis-py`). Per-run event Stream buffers (`run:{run_id}`) plus `runs_by_thread` / `runs:active` sorted sets. Ephemeral (no persistence; `allkeys-lru`). Local via docker-compose; cloud via `REDIS_URL` (e.g. Upstash `rediss://`). |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536-dim) — hardwired with no fallback (a known single point of failure: an OpenAI outage degrades retrieval for all providers). |
| **Observability** | LangSmith auto-tracing; backend logs are the uvicorn console (with an optional file mirror). |

**Safe-by-construction extension points.** Capability is added by registry entries, not new engine code: `PROGRAMMATIC_PHASE_REGISTRY`, `EMITTER_REGISTRY` (schema + driver per deliverable type), `VALIDATOR_REGISTRY` (the 9 gate kinds), and the tool dispatch registry. The workflow definition is a strict discriminated-union Pydantic model stored as JSONB, where additive-optional fields keep old rows valid with zero migration.

---

## Getting Started

The platform runs entirely on local containers for development and switches to cloud (Supabase project + managed Redis) with **environment variables only — no code changes**.

### Prerequisites

- **Docker Desktop** — installed and running (powers Supabase, Redis, and the code-execution sandbox). It must be up before any other step.
- **Supabase CLI** — installed and on `PATH` (`supabase --version` should print a version). Manages the local Postgres + Auth + Storage + Realtime stack.
- **Node.js + npm** — current LTS, for the React/Vite frontend.
- **Python 3.11+** — for the FastAPI backend. The backend **must** run inside a `venv` virtual environment (project rule).
- **Git Bash** (Windows only) — needed solely to run `scripts/regenerate-full-schema.sh` when you add a migration.
- **At least one LLM provider API key** (default provider is OpenAI). OpenAI is also the default embeddings provider used by both ingestion and retrieval, so an OpenAI key is recommended even if you primarily use another chat provider.

### Local setup (ordered)

1. **Clone the repo** and ensure Docker Desktop is running.

2. **Start Supabase** (one-time per machine), from the repo root:
   ```bash
   supabase start
   ```
   The first run pulls ~2 GB of Docker images (5–10 min); later starts take seconds. The CLI auto-applies all migrations under `supabase/migrations/`. Run `supabase status` to print the local URLs and deterministic local anon/service keys.

3. **Start Redis** (one-time per machine), from the repo root:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
   It restarts automatically on Docker Desktop boot thereafter. Verify with `docker exec agentic-rag-redis redis-cli ping` (expect `PONG`). Optional Redis Insight UI: add `--profile insight` (serves on port 5540).

4. **Configure backend env.** Copy `backend/.env.example` → `backend/.env` and fill in real values. Local Supabase defaults are pre-filled; paste the anon/service keys from `supabase status`, leave `REDIS_URL=redis://localhost:6379`, and set at least one provider key (e.g. `OPENAI_API_KEY`). `backend/.env` is gitignored — never commit it.

5. **Configure frontend env.** Create `frontend/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the frontend reads its own env, separate from the backend — keep both in sync when switching local/cloud).

6. **Create the backend venv and install deps**, from `backend/`:
   ```bash
   python -m venv venv
   # PowerShell: .\venv\Scripts\Activate.ps1   |   bash: source venv/bin/activate
   pip install -r requirements.txt
   ```

7. **Start the backend** (dev mode, auto-reload), from `backend/` with the venv active:
   ```bash
   venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Confirm at http://localhost:8000/docs.

8. **Start the frontend**, from `frontend/`:
   ```bash
   npm install        # first time
   npm run dev
   ```
   The app serves at http://localhost:5173/app (public landing page at http://localhost:5173/).

9. **(Recommended) Build the sandbox image** so the code-execution tool has the data-science and document libraries pre-installed:
   ```bash
   docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/
   ```
   Then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` and `SANDBOX_ENABLED=true` in `backend/.env`. Without the pre-built image, code execution still works but the agent must `pip install` packages on each fresh thread (~10–15s warm-up). Bump the tag whenever the package set changes so cached containers don't shadow the new image. Sandbox sessions are cached per thread, so image/env changes only affect **new** chats.

**Production-like run** (no auto-reload, 2 workers — `--reload` and `--workers` do not combine):
```bash
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

**Useful local URLs:** app http://localhost:5173/app · landing http://localhost:5173 · API docs http://localhost:8000/docs · Supabase Studio http://127.0.0.1:54323 · Mailpit (local email) http://127.0.0.1:54324.

> **Cloud switch.** To run against cloud, point `SUPABASE_URL` at a Supabase project and `REDIS_URL` at managed Redis (cloud Redis requires `rediss://` for TLS). Update `frontend/.env.local` to match, and restart the backend (env loads only at startup). Apply migrations to the cloud project with `supabase db push`, or bootstrap a greenfield project from `supabase/full-schema.sql` (note: that single-file artifact omits the auth trigger and storage buckets — create those manually). See `supabase/SETUP.md` and `REDIS-SETUP.md` for the full cloud story.

---

## Configuration

Configuration follows one rule: **environment variables are for secrets and infrastructure only.** All tunable application settings (provider/model selection, retrieval and chunking knobs, hybrid/rerank toggles, feature flags) live in `app_settings` / `user_settings` and are managed from the **Settings UI** — they are not env vars. The env groups below are listed **by name only** (no secret values).

| Group | Variables |
|---|---|
| **Supabase (infra)** | `SUPABASE_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_REST_URL`, `SUPABASE_GRAPHQL_URL`, `SUPABASE_FUNCTIONS_URL`, `SUPABASE_STUDIO_URL`, `SUPABASE_MAILPIT_URL`, `SUPABASE_MCP_URL` — `SUPABASE_URL` is the single local↔cloud switch |
| **Supabase auth + storage keys (secrets)** | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` |
| **Direct Postgres (infra + secret)** | `DATABASE_URL` (migrations/admin), `POSTGRES_DSN` (asyncpg hot path), `POSTGRES_HOST/PORT/USER/PASSWORD/DB`, `POSTGRES_POOL_MIN/MAX` |
| **Server (infra)** | `WORKER_COUNT` (validated production default: 2) |
| **Redis (infra)** | `REDIS_URL` — the single local↔cloud switch for the streaming buffer |
| **LLM providers (secrets + config)** | `LLM_PROVIDER`; per-provider keys `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `MINIMAX_API_KEY`, `ZHIPU_API_KEY`, `OLLAMA_BASE_URL`; and the `*_MODELS` lists that populate the Settings dropdowns. Set keys only for providers you use. |
| **Embeddings (secret + config)** | `EMBEDDING_API_KEY` (falls back to the LLM provider key), `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` (must match the model output; changing it requires a column resize + full re-ingestion) |
| **Retrieval & chunking (config)** | `RETRIEVAL_TOP_K`, `RETRIEVAL_MATCH_THRESHOLD`, `CHUNK_SIZE`, `CHUNK_OVERLAP` |
| **Hybrid search & reranking (config + secret)** | `HYBRID_SEARCH_ENABLED`, `HYBRID_CANDIDATE_COUNT`, `VECTOR_SEARCH_WEIGHT`, `KEYWORD_SEARCH_WEIGHT`, `RRF_K`, `RERANK_ENABLED`, `RERANK_PROVIDER`, `RERANK_API_KEY`, `RERANK_MODEL`, `RERANK_TOP_N` |
| **Web search (secret)** | `TAVILY_API_KEY` (web search is exposed only when keyed/enabled; the per-call result cap is a Settings-UI value, not an env var) |
| **Observability — LangSmith (secret + config)** | `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING` |
| **Code sandbox (infra)** | `SANDBOX_ENABLED`, `SANDBOX_IMAGE` |
| **Extraction (config)** | `PYMUPDF_TIMEOUT_S` |
| **Backend log sink (config)** | `LOG_FILE_PATH` (optional file mirror of logs, secrets redacted; unset = console-only) |

Optional services only need keys when their feature is used: reranking (Cohere), web search (Tavily), LangSmith tracing, and any non-default LLM provider. Ollama runs locally and needs no key (only `OLLAMA_BASE_URL`).

---

## Project Structure

```
.
├── backend/                  FastAPI app
│   ├── app/
│   │   ├── api/              route handlers (threads, runs, workflows, documents, …)
│   │   ├── services/         agent loop, provider gateway, harness/workflow engine,
│   │   │                     retrieval, ingestion/extraction, sandbox, skills
│   │   ├── models/           Pydantic models (incl. the strict WorkflowDefinition)
│   │   ├── db/               asyncpg / Supabase access
│   │   ├── config.py         settings + the MODEL_CAPABILITIES registry
│   │   └── main.py
│   ├── Dockerfile.sandbox    pre-built code-execution image (python:3.11-slim)
│   └── requirements.txt
├── frontend/                 React + Vite app
│   └── src/
│       ├── components/       chat surface, workspace panel, Workflows page, …
│       ├── pages/  hooks/  stores/  providers/  lib/  types/
├── supabase/
│   ├── migrations/           numbered SQL migrations (through 070)
│   ├── full-schema.sql       single-file greenfield deploy artifact (generated)
│   └── SETUP.md              Supabase local + cloud + migration guide
├── docker-compose.dev.yml    local Redis (+ optional Redis Insight)
├── REDIS-SETUP.md            Redis local + cloud + key conventions
├── scripts/                  schema regeneration + tooling
└── .planning/                build/process metadata — not a runtime concern
```

---

## Version / Status

The latest shipped milestone is **v2.9 — Workflow Studio** (2026-06-15): natural-language workflow authoring, project-bound knowledge scope, workflow↔skill composition with locked snapshots, the guaranteed-cited template-fill emission layer with integrity gates, the reusable validation-gate library, the LLM-judge output-quality hard publish-wall, the Workflows page, and a project-management flagship content pack — all built as a composition of the v2.8 harness primitives, with Deep Mode kept byte-identical.

For the full milestone history (v1.0 Knowledge Base Explorer → v2.9 Workflow Studio), see **`CHANGELOG.md`** and the milestone records under **`.planning/MILESTONES.md`**.

---

## Design philosophy & constraints

These are deliberate constraints, not omissions:

- **No LangChain, no LangGraph — raw provider SDK calls only.** Provider-specific behavior is confined to the gateway/service boundary; the shared SSE/chunk path never branches in a breaking way. Conventions do not transfer 1:1 between providers, so each is handled on its own official documentation.
- **Stateless chat completions.** The app stores and re-sends history itself; there is no provider-side conversation state.
- **Manual document ingestion only.** No connectors or automated pipelines — you always control exactly what is in the knowledge base.
- **Row-Level Security on every table.** Users only see their own data; global folders and global skills are the only shared scope. Workflow visibility, harness configs (strict-parsed to reject injected keys), per-phase tool whitelists, the network-less sandbox, and template rendering (deterministic code over model-supplied data only, inside a Jinja `SandboxedEnvironment`) are all safe-by-construction.
- **Realtime is a hint, not a source of truth.** Clients always reconcile by fetching on (re)connect.
- **Deep Mode is a red line — workflow features are additive.** The harness/workflow layer must keep non-workflow (Deep/Explorer) chat **byte-identical**; every engine addition is an additive seam, never a breaking change to a shared hot path.
- **Live UAT is the real acceptance bar.** Static and mock-based tests can pass while a feature is broken in production; the project verifies workflow, gate, and judge behavior against the real endpoint on real cross-provider runs.
- **Known limitation:** embeddings (both ingestion and retrieval) are hardwired to OpenAI `text-embedding-3-small` with no fallback — an OpenAI outage degrades retrieval for all providers.
