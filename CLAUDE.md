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
- Schema changes ship as numbered SQL migrations under `supabase/migrations/` at the repo root (the legacy `backend/supabase/migrations.archive/` is dead — see its README). Filenames must match `<digits>_name.sql` (e.g., `035_my_change.sql`); letter suffixes like `007b` are silently skipped by the Supabase CLI. **Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data). Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh` — by default this dumps the live DB schema with no reset, rebuilding `supabase/full-schema.sql` (single-file deploy artifact for greenfield envs). Pass `--reset` only when you explicitly want to verify the migration sequence from a clean slate (CI / release verification — destructive: wipes local DB). Never hand-edit `full-schema.sql`. Full setup story: `supabase/SETUP.md`.
- Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect (see decision D-v2.5-03)
- Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool` (decision D-v2.5-01)
- Single uvicorn worker — `--workers N` masks concurrency bugs and breaks in-memory state (decision D-v2.5-02)
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only

## Local dev infrastructure

- **Supabase**: managed by Supabase CLI. `supabase start` boots Postgres + Auth + Storage + Realtime on Docker; configured to auto-start on Docker Desktop boot.
- **Redis** (v2.5+): runs via `docker-compose.dev.yml` at repo root. Start once with `docker compose -f docker-compose.dev.yml up -d`; auto-restarts on Docker Desktop boot. Optional Redis Insight web UI on port 5540: `docker compose -f docker-compose.dev.yml --profile insight up -d`. No migrations — Redis has no schema; streams/keys are created on first write.
- **Local-vs-cloud switch**: env vars only. `SUPABASE_URL` + `REDIS_URL` in `backend/.env` point at local containers by default; switch to cloud (Supabase project URL, Upstash `rediss://...`) without code changes. See `backend/.env.example` for the full var list.
- **Run-buffer key conventions** (Phase 061+): `run:{run_id}` (Redis Stream — per-run event buffer), `runs_by_thread:{thread_id}` (sorted set — active runs per thread), `runs:active` (sorted set — all currently-streaming run_ids for global cleanup). Defined in code, not in any migration script.
- **Setup guides**: `supabase/SETUP.md` for Supabase (local + cloud + migrations), `REDIS-SETUP.md` for Redis (local + cloud + key conventions). Read these when connecting a new environment or onboarding a contributor.

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

## Reported bugs cross-check (MANDATORY)

User-observed bugs from manual testing live in `.planning/reported-bugs/`. Each report has structured frontmatter (`surface`, `severity`, `status`, `affected_areas`, `folded_into`, `re_open_trigger`). Use `.planning/reported-bugs/TEMPLATE.md` when creating new reports.

**Cross-check these reports at four GSD touchpoints:**

| Touchpoint | What to do |
|---|---|
| `/gsd:discuss-phase NNN` | After loading prior CONTEXT, list `.planning/reported-bugs/*.md` with `status: open` AND `surface: Agentic-RAG`. For each, check whether `affected_areas` overlaps the phase's domain. Surface relevant ones to the user as: fold into this phase / defer to a named future phase / leave open. Update each report's frontmatter (`status` + `folded_into` or `re_open_trigger`) to reflect the routing. Capture folded ones in CONTEXT.md `<decisions>`; deferred ones in `<deferred>`. |
| `/gsd:plan-phase NNN` | Verify every report with `folded_into: NNN` is actually addressed by at least one plan task. If a folded report isn't covered, either add a task or revert its status. |
| `/gsd:new-milestone` | Sweep all open `surface: Agentic-RAG` reports; surface unaddressed bugs as candidate REQ-IDs for the new milestone, or plant as SEED-NNN with concrete `re_open_trigger`. |
| `/gsd:complete-milestone` | Audit open reports whose `folded_into` matches a phase shipped in the closing milestone — flip status to `closed` only if the bug no longer reproduces. Reports still observable roll forward (status stays `open`, with a note in the milestone retrospective). |

**Filter rule:** ONLY `surface: Agentic-RAG` reports are routing candidates. External reports (`Claude.ai`, `Anthropic-API`, `OpenAI`, `OpenRouter`, `Other`) are observability/feedback notes — never auto-folded into app phases; mention them at touchpoints only if the user explicitly asks.

**Status lifecycle:** `open` → `folded` (when a phase claims it) → `closed` (when the shipped phase verifiably closes it). Reports can also be `deferred` (with `re_open_trigger`) or `external-noted` (won't ever fold).

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
