# CLAUDE.md

Agentic RAG platform — AI agent that knows your knowledge base, runs code in a
sandbox, and can be taught new skills that persist. Chat is the default
interface; document ingestion is a manual file-upload flow.

## Stack
- Frontend: React + Vite + Tailwind + shadcn/ui (Aether Intelligence design system, Deep Midnight theme)
- Backend: Python + FastAPI
- Database: Supabase (Postgres, pgvector, Auth, Storage, Realtime)
- LLM providers: OpenAI, OpenRouter, Anthropic (native SDK), Google — routed via MODEL_CAPABILITIES registry
- Code execution: Docker (`llm-sandbox`), gated by `SANDBOX_ENABLED`
- Observability: LangSmith

## Rules
- Python backend must use a `venv` virtual environment
- No LangChain, no LangGraph — raw SDK calls only
- Use Pydantic for structured LLM outputs
- All tables need Row-Level Security — users only see their own data (global folders/skills are the only shared scope)
- Stream chat responses via SSE
- Stateless chat completions — store and send chat history yourself, no provider-side thread state
- Ingestion is manual file upload only — no connectors or automated pipelines
- Schema changes ship as numbered SQL migrations under `supabase/migrations/` at the repo root (the legacy `backend/supabase/migrations.archive/` is dead — see its README). Filenames must match `<digits>_name.sql` (e.g., `035_my_change.sql`); letter suffixes like `007b` are silently skipped by the Supabase CLI. After adding a migration, regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh` — this rebuilds `supabase/full-schema.sql` (single-file deploy artifact for greenfield envs). Never hand-edit `full-schema.sql`. Full setup story: `supabase/SETUP.md`.
- Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect (see decision D-v2.5-03)
- Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool` (decision D-v2.5-01)
- Single uvicorn worker — `--workers N` masks concurrency bugs and breaks in-memory state (decision D-v2.5-02)
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only

## Local dev infrastructure

- **Supabase**: managed by Supabase CLI. `supabase start` boots Postgres + Auth + Storage + Realtime on Docker; configured to auto-start on Docker Desktop boot.
- **Redis** (v2.5+): runs via `docker-compose.dev.yml` at repo root. Start once with `docker compose -f docker-compose.dev.yml up -d`; auto-restarts on Docker Desktop boot. Optional Redis Insight web UI on port 5540: `docker compose -f docker-compose.dev.yml --profile insight up -d`.
- **Local-vs-cloud switch**: env vars only. `SUPABASE_URL` + `REDIS_URL` in `backend/.env` point at local containers by default; switch to cloud (Supabase project URL, Upstash `rediss://...`) without code changes. See `backend/.env.example` for the full var list.
- **Run-buffer key conventions** (Phase 061+): `run:{run_id}` (Redis Stream — per-run event buffer), `runs_by_thread:{thread_id}` (sorted set — active runs per thread), `runs:active` (sorted set — all currently-streaming run_ids for global cleanup). Defined in code, not in any migration script.

## Planning workflow
Planning is managed by **GSD** under `.planning/`, not ad-hoc plan files.

- `.planning/PROJECT.md` — current milestone, validated requirements, key decisions, constraints
- `.planning/MILESTONES.md` — shipped milestone history
- `.planning/ROADMAP.md` — phases for the active milestone
- `.planning/STATE.md` — current phase, position, next action
- `.planning/<NNN>-<phase-name>/` — one folder per phase with PLAN.md, RESEARCH.md, VERIFICATION.md, etc.

For new work use the GSD slash commands (`/gsd:discuss-phase`, `/gsd:plan-phase`,
`/gsd:execute-phase`, `/gsd:verify-work`) rather than writing free-form plan
files. Run `/gsd:progress` to see where things stand.

The legacy `.agent/plans/` folder and `PROGRESS.md` module tracker are historical
artifacts from the masterclass build (Modules 1–8, shipped as v1.0 base) — do not
add new content there.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
