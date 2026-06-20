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
- Multi-worker uvicorn is the default (`WORKER_COUNT=2`); see D-PRD-12 in `.planning/prd-reset/DECISIONS.md` for the singleton audit checklist and scaling guidance
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only
- **Provider-docs-first (evidence-based):** whenever work touches a specific provider (prompting, orchestration, context management, skill use, tool calls/tool use, streaming, structured output), research that provider's OWN official documentation first, then cross-check against our app's actual behavior with comparative analysis and real evidence (Supabase/DB, backend logs, LangSmith, live cross-provider UAT). Conventions do NOT transfer 1:1 between providers; keep provider-specific handling at the service boundary, never break the shared path. See `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`.

## Local dev infrastructure

- **Supabase**: managed by Supabase CLI. `supabase start` boots Postgres + Auth + Storage + Realtime on Docker; configured to auto-start on Docker Desktop boot.
- **Redis** (v2.5+): runs via `docker-compose.dev.yml` at repo root. Start once with `docker compose -f docker-compose.dev.yml up -d`; auto-restarts on Docker Desktop boot. Optional Redis Insight web UI on port 5540: `docker compose -f docker-compose.dev.yml --profile insight up -d`. No migrations — Redis has no schema; streams/keys are created on first write.
- **Sandbox image** (v2.6+ / Phase 075.1): the agent's `execute_code` tool runs in a Docker container managed by `llm_sandbox`. By default it uses `llm_sandbox`'s bare-Python image, which forces the agent to `pip install matplotlib`/`pandas`/etc. on every new chat (~10-15s warm-up). The project ships a pre-built image at `backend/Dockerfile.sandbox` with the Claude.ai-analysis-tool package set (matplotlib + numpy + pandas + python-pptx + openpyxl + python-docx + pypdf + **reportlab** + seaborn + scipy + scikit-learn + plotly + **docxtpl**; reportlab added 2026-05-31 — pypdf only READS pdfs, reportlab WRITES them; docxtpl added in Phase 101 — the trusted-path template-fill Jinja render engine) — build once with `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/`, then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env`. **The `-t` tag and `SANDBOX_IMAGE` MUST be identical** — the tag after the colon is just a label (free text, not a version requirement); its only rules are (1) build-tag == `SANDBOX_IMAGE`, and (2) pick a NEW label whenever `Dockerfile.sandbox`'s package set changes, then rebuild + update `SANDBOX_IMAGE`, so old cached containers don't shadow the new image. (Tag history: `075.1` at Phase 075.1 → `075.1.1` when reportlab landed 2026-05-31 → `101.1` when docxtpl landed in Phase 101 — the current tag.) When `SANDBOX_IMAGE` is unset, `SandboxSessionManager.get_or_create` (`backend/app/services/sandbox_service.py:25`) falls back to the bare image. Sandbox sessions are cached per `thread_id` until idle eviction (default 30 min), so env-var changes only affect NEW chats — existing chats keep their original container until eviction. Full var reference: `backend/.env.example`.
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

## UAT scoreboard recipe (MANDATORY)

Phase 075.4 Plan 05 (D-075.4-H1 Wave 0) — closes the assumption-driven-UAT gap that cost insert-phases 067.5, 075.1, 075.2, 075.3, 075.4. ROADMAP SC#10 verbatim:

> Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios.

**The 4-axis bandwidth:**

| Axis | Required coverage |
|------|-------------------|
| Cross-provider | OpenAI, Anthropic, Google, OpenRouter (4 providers — pick one representative model per axis) |
| Multi-tool | At least 1 row exercising 2+ tools in one prompt (e.g., `search_documents` + `execute_code`) |
| Parallel-thread | At least 1 row with Thread A streaming while Thread B accepts a new prompt |
| Long-message | At least 1 row with ≥ 50 prior messages OR a ≥ 5 KB user prompt |

UAT rows MUST be authored under VALIDATION.md, NOT in PLAN.md tasks. Phase verification only passes when all 4 axes are exercised — Plan 05 E2E backstop covers 1-3 automated; long-message stays manual per provider.

## Workflow guardrails (MANDATORY)

These rules exist because the v2.6 075.x cascade (8 phases on the same streaming/UI surface) showed that structural UAT misses lived-experience defects, and the full discuss→plan→execute ceremony is overkill for small work. At every phase-touching conversation, the orchestrator MUST apply these BEFORE proposing the next command.

| Rule | Trigger | Action |
|---|---|---|
| **G-1 Phase chain cap** | About to insert `<base>.N` where ≥ 2 prior `<base>.x` phases already exist on the same hot file(s) | Propose a refactor phase on those file(s) FIRST. Block another feature insert until refactor ships. |
| **G-2 Sketch before plan for UX** | Phase scope mentions live UI, panel render, badge, label, animation, "feels like", visual, or gold-standard comparison | Propose `/gsd:sketch` BEFORE `/gsd:spec-phase` or `/gsd:discuss-phase`. Operator-approved mockup is the acceptance bar. |
| **G-3 Lightweight commands for small work** | Task scope ≤ 1 file, ≤ 10 lines of source change, no schema/API surface | Propose `/gsd:fast` (inline, no agents) or `/gsd:quick` (commit + state, skip optional agents). NEVER full discuss→plan→execute for 5-line fixes. |
| **G-4 Lived-experience UAT gate** | Phase touches user-visible UI | Operator-defined "I'd recognize failure here" scenarios at scope-time (not post-hoc). Chrome MCP drives all 3 at phase verification — wire format + screenshot are insufficient. |
| **G-5 Refactor between feature waves** | ≥ 3 prior phases on the same hot file (see ledger below) | Insert a dedicated refactor phase BEFORE the next feature phase on that file. Audit during discuss-phase. |
| **G-6 Failure criteria upfront** | Writing SPEC.md or scoping a phase | Include `## How we'd know this failed` section with concrete observable conditions. If failure modes can't be enumerated, scope is not ready to plan. |

**Orchestrator protocol when a guardrail fires:**

1. Surface the violation BEFORE running the requested command — name the rule, name the proposed alternative
2. If user overrides ("proceed anyway"), proceed but record the override under `STATE.md → Recent Completed Phases → Guardrail overrides` so it's auditable
3. Never silently apply OR silently skip — every fire is either honored or audited

**Hot-file ledger (update as phases ship):**

| File | Phases touched | G-5 status |
|---|---|---|
| `frontend/src/components/chat/ToolCallPanel.tsx` | 067 / 067.5 / 075 / 075.4 / 075.6 / 075.7 (6+) | satisfied (075.7 — 2026-05-24) |
| `frontend/src/components/chat/MessageItem.tsx` | 075 / 075.1 / 075.4 / 075.6 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `backend/app/api/threads.py` | 056 / 058 / 061 / 067 / 073 / 075 / 075.3 / 075.4 / 075.6 (9+) | G-5 fires — extraction due |
| `frontend/src/providers/StreamsProvider.tsx` | 068 / 075 / 075.4 / 075.6 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `frontend/src/hooks/useMessages.ts` | 063 / 063.1 / 067 / 067.5 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `backend/app/services/anthropic_service.py` | 074 / 075 / 075.4 / 075.6 (4+) | G-5 fires — adapter pattern audit due |

When a new phase enters discuss-phase, the orchestrator must scan PLAN.md `files_modified` against this ledger. Any match against a G-5-firing row means the discuss-phase produces a refactor recommendation as the first option, not the planned feature.

## Project skills

- **Sketch findings for Agentic RAG** (design decisions, CSS patterns, visual direction for the live-execution UX — run-card frame, tool-call panel shape, long-run composition; the Phase 087 workspace panel — panel shell/collapse/mobile, file+diff viewer, ask_user interrupt, chat↔panel seam; the Phase 094 workflow-mode surfaces — harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the Phase 095 chat tool-card unification — the unified status-node rail frame, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons, and the build-once component inventory; AND the Phase 103 Workflow Studio — the requirement-first workflow Builder/authoring + read-only vertical phase-spine graph + side-panel forms, the 8-stage publish gauntlet with the judge hard-wall, the built Workflows page library+launch, the workflow run surface where the panel owns the meaningful phase spine + chat carries a thin run receipt, and the three-homes app navigation/IA contract; AND the Phase 112 document detail panel — the right-side push/split document-detail shell (the shared shell that Phase 117 relationships + Phase 118 classification also inhabit), the per-field ConfidenceChip, and honest inline metadata editing; AND the Phase 114 virtual-folders surfaces — the no-DSL filter/view builder + relative-date control, the saved-Views sidebar group + shared Folders+Views NavRow / folder-tree polish, and the Documents-page composition/layout; AND the Phase 117 document relationships — the chip-led grouped-by-direction relationships accordion added to the existing detail panel (outgoing/incoming inverse labels, masked "no access" row, re-fetch-not-optimistic remove) + the type-first searchable-typeahead create-link picker on the MoveToFolderDialog shell) → `Skill("sketch-findings-agentic-rag")`. Auto-load when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the harness/workflow run UI or its phase timeline, the workflow Builder/authoring, the publish gauntlet, the Workflows page, the workflow run surface + its meaningful steps, the app navigation/IA, the composer, the document detail panel / ConfidenceChip / inline metadata editing, the documents-page right-side panel, the metadata filter/view builder, the saved-Views sidebar + folder tree (FolderNode/FolderTree NavRow), the document relationships panel section + create-link typeahead picker, or any chat-surface component touching the agent's mid-execution moment.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
