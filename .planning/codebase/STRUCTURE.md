# Codebase Structure

**Analysis Date:** 2026-05-09

## Directory Layout

```
agentic-rag/
├── backend/                       # FastAPI Python service
│   ├── app/
│   │   ├── main.py                # FastAPI app, lifespan, router mounting
│   │   ├── config.py              # Settings (pydantic-settings) + MODEL_CAPABILITIES + context budgets
│   │   ├── dependencies.py        # Supabase + Redis singletons + JWT auth dep
│   │   ├── api/                   # HTTP/SSE routers (one module per resource family)
│   │   ├── services/              # LLM/SDK adapters, retrieval, sandbox, sub-agent, etc.
│   │   ├── models/                # Pydantic types (request/response/row shapes)
│   │   └── utils/                 # aexec async-exec wrapper, folder utils
│   ├── requirements.txt           # Python deps (FastAPI, Supabase, OpenAI, Anthropic, Redis, llm-sandbox, ...)
│   ├── pytest.ini                 # asyncio mode, marker config
│   ├── settings_override.json     # Runtime settings cache (5s TTL)
│   ├── tests/                     # pytest unit + integration + api tests
│   │   ├── conftest.py
│   │   ├── unit/                  # Service-level tests (mocked deps)
│   │   ├── integration/           # Cross-module tests w/ real Supabase + Redis
│   │   └── api/                   # Route-level tests
│   ├── supabase/                  # LEGACY — `migrations.archive/` only; do not add here
│   └── venv/                      # Python virtual env (gitignored)
│
├── frontend/                      # React 19 + Vite SPA
│   ├── src/
│   │   ├── main.tsx               # createRoot + StrictMode
│   │   ├── App.tsx                # Auth gate + ChatLayout
│   │   ├── index.css              # Tailwind entry + Aether Intelligence variables
│   │   ├── App.css                # Component-scoped styles
│   │   ├── setupTests.ts          # Vitest jsdom setup
│   │   ├── components/
│   │   │   ├── auth/              # SignInForm / SignUpForm
│   │   │   ├── chat/              # ChatArea, MessageList, ToolCallPanel, citations, suggestions, ExecuteCodeBlock
│   │   │   ├── health/            # Library Health dashboard panels + RetrievalTrendChart
│   │   │   ├── ingestion/         # Folder tree + document list + upload
│   │   │   ├── layout/            # ChatLayout, NavPanel, AppDock
│   │   │   ├── settings/          # MemorySection (settings tab content)
│   │   │   ├── skills/            # SkillCard, SkillFormDialog
│   │   │   └── ui/                # shadcn/ui primitives (Radix + Tailwind)
│   │   ├── hooks/                 # useAuth, useThreads, useMessages, useDocuments, useFolders, useSkills, useTheme
│   │   ├── lib/                   # api.ts (REST + SSE), supabase.ts, model-info.ts, toolMeta.ts, fileIcons, folderTree, utils
│   │   ├── pages/                 # AuthPage, IngestionPage, KnowledgeHealthPage, SettingsPage, SkillsPage
│   │   ├── types/                 # TypeScript domain types (Message, Thread, Document, Skill, ...)
│   │   ├── assets/                # Static logo / images
│   │   └── __tests__/             # Vitest tests (components, hooks, lib)
│   ├── public/                    # Static assets served by Vite
│   ├── package.json               # React 19, Vite 8, Vitest 4, TanStack Query, Radix UI, recharts, shadcn deps
│   ├── tsconfig.json              # TS root config
│   ├── tailwind.config.js         # Aether Intelligence design tokens
│   ├── vite.config.ts             # Vite + React plugin
│   ├── vitest.config.ts           # Vitest jsdom config
│   ├── eslint.config.js           # Flat ESLint v9 config
│   └── components.json            # shadcn/ui config
│
├── supabase/                      # Live DB schema artifacts (Supabase CLI managed)
│   ├── full-schema.sql            # Bootstrap deploy artifact (regenerated; never hand-edited)
│   ├── SETUP.md                   # Local + cloud + migration procedure
│   ├── migrations/                # Numbered SQL migrations (001 → 038 currently)
│   │   ├── 001_initial_schema.sql
│   │   ├── ...
│   │   ├── 035_runs_table.sql               # v2.5 run lifecycle (D-v2.5-11)
│   │   ├── 037_messages_confidence_columns.sql  # v2.5 schema-restore (D-v2.5-12)
│   │   └── 038_runs_timed_out_status.sql    # Phase 066 timed_out terminal
│   └── snippets/                  # Reusable SQL fragments
│
├── e2e/                           # Playwright e2e harness
│   ├── playwright.config.ts
│   ├── package.json               # @playwright/test + harness deps
│   ├── tests/                     # Multi-tab streaming, reconcile, refresh-mid-stream scenarios
│   └── fixtures/                  # Test users, seed data
│
├── scripts/
│   ├── regenerate-full-schema.sh  # Live-DB dump → supabase/full-schema.sql (no reset by default)
│   └── full-schema-header.sql
│
├── .planning/                     # GSD workspace (managed via /gsd:* slash commands)
│   ├── PROJECT.md                 # Current milestone, requirements, decisions, constraints
│   ├── ROADMAP.md                 # Active milestone phases
│   ├── MILESTONES.md              # Shipped milestone history
│   ├── STATE.md                   # Current phase, position, deferred items
│   ├── RETROSPECTIVE.md           # Cumulative retrospectives
│   ├── codebase/                  # This directory — codebase-mapping artifacts
│   ├── milestones/                # Milestone-scope archives (v2.5-phases/, etc.)
│   ├── phases/                    # Active milestone's phase folders (NNN-name)
│   ├── research/                  # /gsd:research outputs
│   ├── seeds/                     # SEED-* tracked future-work items
│   ├── quick/                     # Lightweight notes
│   └── backups/                   # Snapshots before destructive operations
│
├── graphify-out/                  # Knowledge-graph artifact (graphify CLI)
│   ├── GRAPH_REPORT.md
│   └── wiki/
│
├── .claude/                       # Claude Code agents + commands (GSD)
│   ├── agents/                    # gsd-codebase-mapper, gsd-planner, gsd-executor, ...
│   └── commands/gsd/              # /gsd:* slash command definitions
│
├── docker-compose.dev.yml         # Local Redis (+ optional Redis Insight at port 5540)
├── REDIS-SETUP.md                 # Redis local + cloud + key conventions
├── CLAUDE.md                      # Project rules (stack, decisions, dev infra, planning workflow)
├── README.md                      # Project README
├── PROGRESS.md                    # LEGACY — historical Module 1-8 tracker; do not modify
├── SKILLS_GUIDE.md                # Skills authoring + import/export guide
├── start_supabase.bat             # Local-dev Supabase startup helper
├── test-cases/                    # Manual test plans + fixtures
├── Files to test and diaganose/   # Sample documents for ingestion testing
└── .gsd-config.json (via .planning/config.json)
```

## Directory Purposes

**`backend/app/api/`:**
- Purpose: FastAPI routers — HTTP/SSE entry points for every resource family.
- Contains: One Python module per resource. Authorization is enforced inline via `.eq("user_id", current_user["id"])` filters; Pydantic models validate bodies; sync DB calls are wrapped via `aexec`.
- Key files: `threads.py` (~2700 lines, includes the `agent_runner` producer closure), `runs.py` (replay-and-tail consumer + cancel verb), `documents.py`, `kb.py` (KB tool implementations also reused by the LLM dispatch path), `skills.py`, `feedback.py`, `audit.py`, `knowledge_health.py`, `folders.py`, `sandbox_outputs.py`, `settings.py`, `test_fixtures.py` (gated by env var).

**`backend/app/services/`:**
- Purpose: External-integration adapters and pure-function business logic.
- Contains: SDK adapters (`openai_service.py` for OpenAI-compatible providers, `anthropic_service.py` for native Anthropic), retrieval (`retrieval_service.py` — hybrid search + folder scoping), `sub_agent_service.py`, `sandbox_service.py` (lazy `llm-sandbox` import + Docker session manager), `web_search_service.py` (Tavily), `sql_service.py` (text-to-SQL `query_documents` tool), `embedding_service.py`, `rerank_service.py`, `suggestion_service.py`, `context_window.py` (provider-aware budgets + trimming with atomic tool-pair removal), `multimodal_service.py` (pdfplumber tables + vision-LLM image descriptions), `tool_parser.py` (structured-mode JSON-in-prompt parser), `audit_service.py`.
- Key files: `openai_service.py` (`get_tools()`, `get_explorer_tools()`, `EXPLORER_SYSTEM_PROMPT`, `create_adaptive_streaming_chat`, `_uses_max_completion_tokens`, `CallingMode`, `resolve_calling_mode`).

**`backend/app/models/`:**
- Purpose: Pydantic types for request/response bodies and database row shapes.
- Contains: `document.py`, `folder.py`, `kb.py`, `message.py`, `run.py` (Phase 062 ActiveRunResponse), `skill.py`, `thread.py`, `user_settings.py` (settings file load/override + 5s TTL cache).

**`backend/app/utils/`:**
- Purpose: Cross-cutting helpers used by multiple routers and services.
- Contains: `db.py` (`aexec` — the canonical async wrapper around supabase-py `.execute()`, Phase 058 D-058-03), `folder_utils.py` (`fetch_visible_folders` + Python-side subtree resolution, used by KB tools and folder-scoped chat threads).

**`backend/tests/`:**
- Purpose: pytest test suite with three tiers.
- Contains: `unit/` (mocked-dep service-level tests), `integration/` (cross-module tests against real Supabase + Redis containers), `api/` (route-level tests with mock Supabase). `conftest.py` configures shared fixtures.
- Naming pattern: `test_<phase>_<area>.py` (e.g. `test_058_concurrency.py`, `test_062_active_runs.py`, `test_066_per_call_timer.py`, `test_063_post_then_subscribe.py`). Older tests follow `test_<module>.py` (e.g. `test_documents.py`, `test_skills.py`).

**`frontend/src/components/`:**
- Purpose: React components grouped by domain.
- Contains: `auth/` (sign-in/up forms), `chat/` (the largest cluster — chat surface with streaming, tool-call rendering, citations, confidence, suggestions, code execution), `health/` (knowledge-health dashboard), `ingestion/` (folder tree + document upload), `layout/` (`ChatLayout` orchestrates view routing; `NavPanel` is the collapsible sidebar; `AppDock` is the mobile bottom dock), `settings/` (settings tab content), `skills/` (skill CRUD UI), `ui/` (shadcn/ui Radix primitives — never edit the underlying Radix components, only the wrapper styling).

**`frontend/src/hooks/`:**
- Purpose: Stateful logic exposed to components as React hooks.
- Contains: `useAuth.ts` (Supabase auth state), `useThreads.ts`, `useMessages.ts` (the largest hook — per-thread bucket store, run subscriptions, reconcile, resumeFromFailed, ~1230 lines), `useDocuments.ts`, `useFolders.ts`, `useSkills.ts`, `useTheme.ts` (light/dark with localStorage persistence + `prefers-color-scheme`).

**`frontend/src/lib/`:**
- Purpose: Library functions and external SDK bindings.
- Contains: `api.ts` (every REST + SSE call, including the `subscribeToRun` SSE parser at line 274), `supabase.ts` (Supabase JS client), `model-info.ts` (cost-tier + context-window display info per model — has a sibling `.test.ts`), `toolMeta.ts` (tool icon + display-name registry), `fileIcons.tsx`, `folderTree.ts`, `utils.ts` (cn helper for Tailwind class merging).

**`frontend/src/pages/`:**
- Purpose: Top-level route components (rendered by `ChatLayout` based on `activeView`).
- Contains: `AuthPage.tsx`, `IngestionPage.tsx`, `KnowledgeHealthPage.tsx`, `SettingsPage.tsx` (5 tabs), `SkillsPage.tsx` (3-pane layout).

**`supabase/migrations/`:**
- Purpose: Append-only numbered SQL migrations.
- Contains: 001 → 038 currently. Filenames must match `<digits>_name.sql` regex; letter suffixes like `007b` are silently skipped by the Supabase CLI. Each new migration is applied via the Supabase SQL editor (never `db push`/`db reset` — preserves dev data); then `bash scripts/regenerate-full-schema.sh` regenerates `supabase/full-schema.sql`.

**`.planning/phases/`:**
- Purpose: One folder per active-milestone phase.
- Contains: Folders named `<NNN>-<phase-name>/` (e.g. `067-streaming-ux-fixes/`). Each folder has `PLAN.md`, `RESEARCH.md`, `CONTEXT.md`, `VERIFICATION.md` and other GSD artifacts.

**`.planning/milestones/`:**
- Purpose: Archived phase folders from completed milestones.
- Contains: Subdirectories like `v2.5-phases/` containing the snapshot of phase folders at milestone close.

**`e2e/`:**
- Purpose: Playwright multi-tab browser harness.
- Contains: `playwright.config.ts`, `tests/` (multi-tab streaming, reconcile, refresh-mid-stream, navigate-away scenarios), `fixtures/`. Has its own `package.json` (Playwright is NOT in the frontend deps).

**`graphify-out/`:**
- Purpose: Knowledge-graph artifact for codebase navigation (managed by external `graphify` CLI, NOT GSD's `/gsd:graphify`).
- Contains: `GRAPH_REPORT.md` (god nodes + community structure), `wiki/index.md`. Read FIRST when answering architecture or codebase questions per CLAUDE.md `## graphify` rules.

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app + lifespan (startup Redis ping, AnyIO thread tokens, sandbox close-all on shutdown, `RUN_TASKS` cancellation on shutdown).
- `frontend/src/main.tsx`: createRoot + StrictMode wrapping `App`.
- `frontend/src/App.tsx`: Auth gate; routes to `ChatLayout` when authenticated.

**Configuration:**
- `backend/app/config.py`: Pydantic-settings — env vars + MODEL_CAPABILITIES registry + per-provider context budgets + per-model timeout matrix.
- `backend/.env.example`: Required env vars (referenced by CLAUDE.md).
- `backend/settings_override.json`: Runtime settings cache (5s TTL via `_load_override` in `models/user_settings.py`).
- `docker-compose.dev.yml`: Local Redis (+ optional Redis Insight on port 5540).
- `frontend/tailwind.config.js`: Aether Intelligence design tokens.
- `frontend/vite.config.ts`, `frontend/tsconfig.json`: Build/TS config.

**Streaming-architecture core (Phase 061-067.5):**
- `backend/app/api/threads.py:875` (`send_message`): POST entry; spawns `agent_runner`; returns JSON `{message_id, run_id}`.
- `backend/app/api/threads.py:1059` (`agent_runner` inline closure): producer task; XADDs to `run:{run_id}`; shielded finalize.
- `backend/app/api/runs.py:80` (`replay_tail_consumer`): replay-and-tail XREAD consumer.
- `backend/app/api/runs.py:331` (`stream_run`): GET /runs/{id}/stream entry; mounts EventSourceResponse.
- `backend/app/api/runs.py:421` (`cancel_run`): DELETE /runs/{id} entry; happy/zombie/terminal paths.
- `backend/app/api/threads.py:80` (`RUN_TASKS`): module-level producer-task registry.
- `backend/app/api/threads.py:88` (`TERMINAL_TYPES`): SSE wire-format terminal sentinel set.
- `backend/app/api/threads.py:95` (`_RUN_STATUS_TO_TERMINAL_TYPE`): runs.status enum → SSE wire type map.
- `backend/app/api/threads.py:103` (`_emit`) / `:120` (`_emit_terminal`): canonical XADD shape.
- `backend/app/api/threads.py:158` (`_drain_stream_with_close_on_cancel`): asyncio-Queue bridge from sync SDK stream.
- `backend/app/utils/db.py:32` (`aexec`): async wrapper around supabase-py `.execute()`.
- `backend/app/dependencies.py:23` (`get_redis`): redis.asyncio singleton + connection settings.
- `frontend/src/hooks/useMessages.ts:380` (`useMessages` hook): per-thread bucket store + run subscriptions.
- `frontend/src/hooks/useMessages.ts:572` (`clearMessages`): streaming-bucket guard (Phase 067.5 Branch D-3 fix).
- `frontend/src/hooks/useMessages.ts:673` (`sendMessage`): optimistic placeholders + POST + subscribe.
- `frontend/src/hooks/useMessages.ts:948` (`reconcile`): on-(re)connect active-runs + loadMessages parallel fetch.
- `frontend/src/hooks/useMessages.ts:477` (`stopStreaming`): server-side cancel via DELETE /runs/{rid}.
- `frontend/src/lib/api.ts:229` (`postMessage`), `:274` (`subscribeToRun`), `:456` (`getActiveRuns`), `:479` (`cancelRun`): wire bindings.
- `frontend/src/components/chat/ChatArea.tsx`: thread-switching glue + reconcile listener (visibilitychange/focus/pageshow/mount via `reconcileRef`).

**Database:**
- `supabase/full-schema.sql`: Single-file deploy artifact, regenerated from live DB.
- `supabase/migrations/035_runs_table.sql`: Run lifecycle table (D-v2.5-11).
- `supabase/migrations/037_messages_confidence_columns.sql`: Schema-restore (D-v2.5-12).
- `supabase/migrations/038_runs_timed_out_status.sql`: timed_out terminal status (Phase 066).
- `supabase/SETUP.md`: Migration application procedure.
- `REDIS-SETUP.md`: Redis local + cloud + key conventions.

**Testing:**
- `backend/pytest.ini`: pytest config (asyncio_mode=auto).
- `backend/tests/conftest.py`: Shared fixtures.
- `frontend/vitest.config.ts`: Vitest jsdom + setupTests.
- `e2e/playwright.config.ts`: Multi-browser config for streaming harness.

**Skills system:**
- `backend/app/api/skills.py`: Skill CRUD + ZIP import/export.
- `frontend/src/components/skills/SkillFormDialog.tsx`: Skill editor with file management.
- `SKILLS_GUIDE.md`: User-facing authoring guide.

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g. `sandbox_service.py`, `audit_service.py`).
- React components: `PascalCase.tsx` (e.g. `ChatArea.tsx`, `MessageInput.tsx`, `ToolCallPanel.tsx`).
- Hooks: `useCamelCase.ts` (e.g. `useMessages.ts`, `useThreads.ts`).
- Library functions / utilities: `camelCase.ts` (e.g. `api.ts`, `model-info.ts`, `folderTree.ts`, `toolMeta.ts`).
- shadcn/ui primitives: `kebab-case.tsx` (e.g. `alert-dialog.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`) — convention from shadcn CLI; do NOT rename.
- Test files: `<thing>.test.ts` (frontend Vitest) or `test_<thing>.py` (backend pytest). Phase-scoped tests prefix the phase number: `test_062_active_runs.py`, `useMessages.test.ts`.
- Migrations: `<NNN>_<snake_name>.sql` where NNN is monotonically increasing 3+ digits. Letter suffixes (`007b`) are silently skipped by Supabase CLI — DO NOT use.
- Phase folders in `.planning/phases/`: `<NNN>-<kebab-name>/` (e.g. `063-frontend-stream-decouple/`, `067.5-frontend-reconcile-fix/`). Sub-phases use decimal: `067.1`, `067.2`, etc.
- Markdown docs in phase folders: UPPERCASE.md (`PLAN.md`, `RESEARCH.md`, `CONTEXT.md`, `VERIFICATION.md`).

**Functions:**
- Python: `snake_case` for all functions and methods. Private/internal: leading underscore (`_emit`, `_emit_terminal`, `_drain_stream_with_close_on_cancel`, `_synthetic_terminal_generator`).
- TypeScript: `camelCase` for functions; `PascalCase` for React components; private hook helpers prefixed `_` are rare — most use `make<Thing>` or `_internal` naming inline.

**Variables:**
- Python: `snake_case`. Module-level state: `_BACKGROUND_TASKS`, `RUN_TASKS`, `TERMINAL_TYPES`. Constants UPPER_SNAKE.
- TypeScript: `camelCase`. Refs: `<thingName>Ref` (e.g. `streamingThreadIdRef`, `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`).

**Types:**
- Python: PascalCase Pydantic classes (`MessageCreate`, `MessageResponse`, `ActiveRunResponse`, `ThreadCreate`, `ThreadUpdate`, `ThreadResponse`, `ModelCapability`).
- TypeScript: PascalCase types/interfaces (`Message`, `Thread`, `ToolCall`, `OutputFile`, `SourceReference`, `Citation`, `StreamCallbacks`, `PostMessageResponse`).

**Database:**
- Tables: `snake_case` plural (`documents`, `document_chunks`, `messages`, `runs`, `skills`, `skill_files`, `audit_log`, `code_executions`, `sandbox_files`, `user_memory`, `user_settings`, `app_settings`, `profiles`).
- RLS policies: human-readable English ("Users can view their own threads", "runs_select_own"). Newer policies use snake_case (`runs_select_own`).
- Indexes: `<table>_<columns>_idx` (e.g. `idx_runs_active`, `idx_runs_history`, `documents_folder_id_idx`, `document_chunks_embedding_idx`).
- RPC functions: `snake_case` (`match_document_chunks`, `keyword_search_chunks`, `query_user_documents`, `folder_is_globally_visible`).

**Phase decisions in code comments:**
- `D-<phase>-<num>` for phase decisions (e.g. `D-061-11`, `D-v2.5-08`, `D-067.3-R1-04`, `D-066-06`).
- `T-<phase>-<num>` for threats/risks mitigated (e.g. `T-062-01`).
- `WR-<num>` for working-research items (review fixes, e.g. `WR-01`, `WR-06`).
- `BL-<num>` for bug-list items (e.g. `BL-03`).
- `Pitfall <N>` for known gotchas (e.g. `Pitfall 5` — terminal sentinel exempt from MAXLEN).
- `SC#<N>` for success criteria, `SEED-<NNN>` for tracked future work.

## Where to Add New Code

**New API endpoint:**
- Decide the resource family. If existing (`threads`, `documents`, `kb`, `skills`, `feedback`, `audit`, `knowledge_health`, `folders`, `runs`, `sandbox_outputs`, `settings`): add a new route to that file under `backend/app/api/`. If new family: create a new module, register the router in `backend/app/main.py:136-148`.
- Use `await aexec(supabase.table(...).select(...).eq("user_id", current_user["id"]))` for every Supabase query — never call `.execute()` directly inside an async handler.
- Define request/response Pydantic models in `backend/app/models/<resource>.py`.
- Tests: integration test in `backend/tests/integration/test_<phase|resource>.py`.

**New SSE event type for the streaming flow:**
- Add the wire-type emit in `agent_runner` (`backend/app/api/threads.py:1059`) via `await _emit(redis, run_id, '<type>', **fields)`.
- Add parser branch in `frontend/src/lib/api.ts:274` (`subscribeToRun`).
- Add callback to `StreamCallbacks` type definition in `frontend/src/lib/api.ts`.
- Add handler in `frontend/src/hooks/useMessages.ts` `makeStreamCallbacks` factory (line 58).
- If terminal: add to `TERMINAL_TYPES` set at `threads.py:88` AND `_RUN_STATUS_TO_TERMINAL_TYPE` map AND the `runs.status` CHECK constraint via a new numbered migration AND `useMessages.ts onTerminal` switch.

**New LLM tool:**
- Define schema in `backend/app/services/openai_service.py` `get_tools()` list (and `get_explorer_tools()` if it should be available in Explorer mode).
- Implement dispatch handler inline inside `agent_runner` in `backend/app/api/threads.py` — follow the pattern of existing tools (`_emit('tool_preparing', ...)` → `_emit('tool_start', ...)` → execute → `_emit('tool_end', ...)`).
- Update SYSTEM_PROMPT tool count in `threads.py`.
- Update `frontend/src/lib/toolMeta.ts` for icon + display name.
- Update `frontend/src/components/chat/ToolCallPanel.tsx` if tool needs custom rendering (e.g. citations, code execution, sub-agent).

**New React component:**
- Domain-grouped under `frontend/src/components/<domain>/<PascalCase>.tsx` (auth/chat/health/ingestion/layout/settings/skills).
- shadcn primitives go in `frontend/src/components/ui/` only when added via shadcn CLI — do not hand-roll Radix wrappers there.
- Tests in `frontend/src/__tests__/components/<PascalCase>.test.tsx` (Vitest + Testing Library).

**New hook:**
- `frontend/src/hooks/use<CamelCase>.ts`.
- If the hook owns server state, prefer composing on top of TanStack Query (`@tanstack/react-query`) — examples: `useDocuments`, `useThreads`. If the hook owns streaming/SSE/realtime, follow `useMessages` patterns: refs for non-rendering state, abort controllers for cancellation, in-flight bool guards for coalescing.

**New page:**
- Add to `frontend/src/pages/<Page>.tsx`.
- Add corresponding `ActiveView` value in `frontend/src/App.tsx:8`.
- Wire the route in `frontend/src/components/layout/ChatLayout.tsx` (view-switching logic).

**Database schema change:**
- Create the next-numbered migration: `supabase/migrations/<NNN>_<snake_name>.sql`. Filename must match `<digits>_name.sql` (NO letter suffixes).
- Apply by pasting into the Supabase SQL editor (NEVER `db push` / `db reset` — preserves dev data).
- Run `bash scripts/regenerate-full-schema.sh` to refresh `supabase/full-schema.sql` (live DB dump, no reset).
- Commit the migration AND the regenerated `full-schema.sql` together.
- Add RLS policies for any new user-scoped table.

**New Pydantic model:**
- `backend/app/models/<resource>.py` for request/response shapes. Use `pydantic.BaseModel`. Enforce field constraints inline (`Field(max_length=...)`) rather than via validators when possible.

**Tests:**
- Backend unit (mocked deps): `backend/tests/unit/test_<thing>.py`.
- Backend integration (real Supabase + Redis): `backend/tests/integration/test_<phase>_<area>.py`.
- Backend route-level: `backend/tests/api/test_<area>.py`.
- Frontend: `frontend/src/__tests__/{components,hooks,lib}/<thing>.test.tsx?`.
- E2E (multi-tab streaming, reconcile, refresh): `e2e/tests/<scenario>.spec.ts`.

**GSD planning artifacts:**
- New milestone: `/gsd:new-milestone` (do NOT hand-create folders).
- New phase: `/gsd:new-phase <name>` → creates `.planning/phases/<NNN>-<name>/` with PLAN.md scaffold.
- Discussion / research: `/gsd:discuss-phase`, `/gsd:research`. Outputs land in the phase folder or `.planning/research/`.

## Special Directories

**`backend/venv/`:**
- Purpose: Python virtual environment.
- Generated: Yes.
- Committed: No (gitignored).

**`frontend/node_modules/`, `e2e/node_modules/`:**
- Purpose: npm dependencies.
- Generated: Yes.
- Committed: No (gitignored).

**`frontend/dist/`:**
- Purpose: Production Vite build output.
- Generated: Yes.
- Committed: No.

**`backend/__pycache__/`, `backend/app/**/__pycache__/`:**
- Purpose: Python bytecode cache.
- Generated: Yes.
- Committed: No (gitignored).

**`graphify-out/`:**
- Purpose: Knowledge-graph artifacts from `graphify` CLI.
- Generated: Yes (via `graphify update .`).
- Committed: Yes (used by Claude / the user for codebase navigation).

**`.planning/backups/`:**
- Purpose: Snapshots taken before destructive GSD operations.
- Generated: Yes (by `/gsd:*` commands).
- Committed: Yes.

**`.planning/milestones/v2.5-phases/`:**
- Purpose: Archived phase folders from v2.5 milestone close (16 phases including 063, 063.1, 066, 067, 067.1-067.5).
- Generated: Yes (by `/gsd:complete-milestone`).
- Committed: Yes.

**`backend/supabase/migrations.archive/`:**
- Purpose: LEGACY — predecessor migration directory before consolidation under repo-root `supabase/migrations/`.
- Generated: No.
- Committed: Yes (with a README explaining it's dead).
- DO NOT add to. New migrations go under `supabase/migrations/` at the repo root.

**`Files to test and diaganose/`** (note: typo preserved from original directory):
- Purpose: Sample documents for ingestion testing.
- Generated: No (manually curated).
- Committed: Yes.

**`.agent/plans/`** (legacy from masterclass build, referenced in CLAUDE.md):
- Purpose: Historical Module 1-8 plan artifacts.
- Generated: No.
- Committed: Yes.
- DO NOT add new content. New planning goes through GSD under `.planning/`.

---

*Structure analysis: 2026-05-09*
