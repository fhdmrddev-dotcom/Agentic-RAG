# Milestones

## v2.5 Deployment Strategy (Shipped: 2026-05-09)

**Phases completed:** 15 phases shipped + 1 deferred (064), 64/64 plans complete
**Timeline:** 2026-04-30 → 2026-05-09 (10 days, 445 commits)
**Files changed:** 531 source files (+107,682 / -3,715 lines)

**Key accomplishments:**

1. Backend SSE concurrency unblocked (Phase 058) — `aexec` async wrapper around supabase `.execute()` calls + AnyIO 200-token limiter; cross-tab GET drops from ~30s queued to <1s while a streaming agent runs (CONCUR-01 binding pytest gate).
2. Run-backed streaming architecture (Phases 059 → 063 + 063.1) — `asyncio.Queue` producer + `sse-starlette` (059), Redis Streams `run:{run_id}` durable buffer (061), `GET /threads/{tid}/active-runs` + `GET /runs/{rid}/stream?since=N` replay-and-tail API (062), POST returns JSON `{message_id, run_id}` + frontend reattaches via separate subscription (063), multi-tab sync / refresh-mid-stream / navigate-away all work without manual refresh as a side-effect.
3. Adaptive run timeouts + lifecycle states (Phase 066) — per-LLM-call budget that resets on tool-call boundaries replaces the 120s total-deadline; cancelled (user-Stop) vs timed_out (system limit) terminal distinction; "Agent reached time limit" UI banner with Resume button. Closes Gap-006.
4. Streaming UX polish — Phase 067 fixed UX-067-01..05 (empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise, tool-call iteration boundary). Phase 067.1 added context-aware in-flight copy ("Searching knowledge base…", "Setting up agent…"), multi-step-intent system-prompt section, skill-load tool-card copy.
5. Streaming render & storage fixes (Phases 067.2 → 067.5, cross-phase chain) — per-thread message store via `messagesByThread` Map (cross-thread switch preserves render); sandbox-output download via JS blob fetch (no more 401 on `<a href>` click); model→provider router honors `MODEL_CAPABILITIES[model]['provider']` (Anthropic models actually route through Anthropic SDK); suggestions SSE emit at `threads.py:2487` always-emit-empty + reordered before `done`; code-execution `code_executing` heartbeat events with elapsed counter; empty-thread-until-refresh closed via `clearMessages` streaming-bucket guard (Branch D-3, 5/5 lived-experience cycles GREEN).
6. Skills test infrastructure repair (Phase 065) — eradicated AttributeError on `app.api.threads.create_streaming_chat` across 11 patch sites + 19 tuple-wrapped fakes (065-01); 3 export-test assertion drifts fixed (065-02); 11 tests migrated to canonical Phase 063 POST→GET-stream pattern using `_build_mock_supabase()` (065-03). Combined skills test run: 26/26 pass. Foundation for Skill Studio milestone.

**Architectural decisions locked:**
- D-v2.5-01: blocking I/O in async handlers must be wrapped via `run_in_threadpool` / `aexec`
- D-v2.5-02: single uvicorn worker (multi-worker masks concurrency bugs)
- D-v2.5-03: Realtime is best-effort hint, not source of truth — always reconcile via fetch on (re)connect
- D-v2.5-08/09/10: STREAM-04 run-backed streaming architecture (Redis Streams + replay-and-tail)
- D-v2.5-11: 061 + 062 + 063 ship as a single feature branch, no feature flags, no dual code paths
- D-066-11: `stream.close()` invariant under synthetic-timeout
- D-067.3-N01: model→provider router resolution chain

**Known deferred items at close:** 31 acknowledged (10 UAT status fields not flipped after cross-phase closure — cosmetic only, all show 0 pending scenarios; 4 verification gaps marked human_needed — project-level approved per Phase 063 precedent; 11 historical micro-tickets predating GSD; 6 dormant seeds intentional future work). Plus 3 carry-forward seeds for follow-on work: SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter synthetic-timeout protocol), SEED-011 (test_059 fixture-teardown). Plus 3 forward-looking seeds for post-v2.5 strategic work: SEED-012 (admin/operator UI), SEED-013 (external integrations / API + MCP), SEED-014 (automations & routines). See STATE.md `## Deferred Items` for the full inventory.

---

## v2.4 Stability, Polish & UX Fixes (Shipped: 2026-04-30)

**Phases completed:** 12 phases shipped + 2 deferred (55, 57), 42/44 plans complete
**Timeline:** 2026-04-22 → 2026-04-30 (8 days, 278 commits)
**Files changed:** 72 source files (+6,122 / -1,325 lines)

**Key accomplishments:**

1. Cross-provider tool calling reliability — MODEL_CAPABILITIES registry routes to native or structured mode; tool_parser.py deterministic JSON extraction for non-native models; 32+ tests
2. Anthropic native SDK integration — anthropic_service.py with prompt caching; 20% token reduction removed; PROMPT-01 generation/Q&A disambiguation fix
3. Context-aware sub-agent routing — keyword-based escalation to capable model tier for generation tasks; tiktoken estimation; per-model info cards with cost tier
4. Multi-provider model routing — full user control over all agent model roles; 404 fallback with SSE event; resolved_sub_agent_model in Settings
5. Agent real-time feedback — tool_preparing SSE eliminates 30–120s silence window; ElapsedTimer for running tools; iteration_start Step N counter; ingestion step badges
6. UX polish shipped — thread delete confirmation, no ghost content, folder-scoped new chats, root document visibility, version-aware delete dialog, web search toggle, nav polish, paginated library health

**Known deferred items at close:** 19 acknowledged (STREAM-02 partial, SKILL-01/02 to Skills Studio, 14 human UAT items, 12 quick tasks)

---

## v2.3 Memory, Multimodal & Experience (Shipped: 2026-04-19)

**Phases completed:** 11 phases, 27 plans

**Key accomplishments:**

1. Cross-Thread Memory — remember/recall tools with automatic injection into General Mode system prompts, plus Settings UI for memory management
2. Multi-Modal Document Intelligence — PDF/DOCX table extraction, vision-LLM image descriptions, query_tables tool, and document badges
3. Knowledge Health Dashboard — four-signal library health API (most-retrieved, never-retrieved, low-confidence, stale) with action hooks and KPI stat bar
4. User Feedback Loop — thumbs up/down with reason selector, immutable ratings, feedback stats in Library Health
5. Deep Midnight UI Redesign — glassmorphic ToolCallPanel, gradient CitationCards, floating pill MessageInput, AppDock, 3-pane SkillsPage, gradient toggles
6. Mobile & Responsive — collapsible NavPanel, frosted drawer, 5-tab Settings refactor, responsive breakpoints

**Known deferred items at close:** 4 UAT gaps, 5 verification gaps (require live browser testing), 12 quick task status markers (already committed code)

---

## v2.2 Trust & Compliance (Shipped: 2026-04-16)

**Phases completed:** 7 phases, 13 plans, 22 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- One-liner:
- 1. [Rule 1 - Bug] Upload endpoint uses /documents/upload not /documents
- Task 1 — Backend pipeline:
- FastAPI document versioning endpoints — is_latest list filter, GET /{id}/versions, and POST /{id}/restore with NULL folder guard and 6 TDD-verified unit tests
- React frontend — version badge, VersionHistoryPanel, and restore confirmation dialog in DocumentList
- audit_log Postgres table with INSERT-only RLS, 8-action CHECK constraint, composite index, and write_audit_entry async coroutine with exception swallowing
- All 8 auditable action types wired to write_audit_entry across documents.py, threads.py, and settings.py using BackgroundTasks (non-SSE) and asyncio.create_task (SSE generator)
- One-liner:
- Audit Log section added to Settings page with paginated table, date-range pills (All/7d/30d/90d), action-type dropdown filter, and CSV export button wired to /audit-logs and /audit-logs/export backend endpoints.
- SSE stream timeline upgraded from literal [DONE] to JSON done -> suggestions (cheap model) -> stream_end, with suggestion failures isolated behind try/except
- Glassmorphic suggestion pill buttons wired end-to-end: SSE done/suggestions/stream_end event parsing in api.ts, ephemeral questions stored on Message via useMessages, SuggestionPills component rendering below citations, gated on General mode and !isStreaming

---

## v2.1 Stability & RAG Correctness (Shipped: 2026-04-11)

**Phases completed:** 8 phases, 8 plans, 3 tasks

**Key accomplishments:**

- One-liner:
- Added similarity confidence hedging (< 0.4 threshold) and structured citation format guidance to SYSTEM_PROMPT, preventing fabricated answers from weak matches and standardizing document reference format

---

## v2.0 Agent Skills & Code Execution (Shipped: 2026-04-04)

**Phases completed:** 9 phases, 22 plans, 30 tasks

**Key accomplishments:**

- tool_call_id persisted in JSONB and history reconstructed as OpenAI multi-turn sequences so the LLM can reference prior tool results across conversation turns
- Supabase migration with skills + skill_files tables, RLS, private Storage bucket, Pydantic type contracts, and failing TDD scaffold covering all 10 Phase 10 requirements
- FastAPI /skills router with 6 CRUD endpoints (list, create, update, delete, toggle-enabled, toggle-global) — all CRUD tests GREEN
- 3 file management endpoints on /skills router using Supabase skill-files storage bucket with owner-only write, global-readable list, and 10 MB upload limit
- Three skill tool definitions registered in General Mode, catalog injected into system prompt via .or_() query, test scaffold with catalog/gating tests GREEN and 7 dispatch stubs for Plan 02
- Three skill tool dispatch handlers (load_skill, save_skill, read_skill_file) implemented in threads.py with skill_activated SSE event; all 8 test stubs fleshed out and GREEN
- skill_activated SSE event wired through streamMessage() callback chain with no-op handler in useMessages.ts; TypeScript compiles cleanly; live E2E test deferred to Phase 12
- Task 1 — Data Layer:
- Task 1 — Skills UI Components:
- ZIP-based skill export (GET /skills/{id}/export) and import (POST /skills/import) with SKILL.md frontmatter, MIME-type file categorization, bulk multi-skill support, and path traversal rejection
- Export button on SkillCards (owner-only, Download icon with spinner) and Import Skill button in SkillsPage header (.zip file picker with inline feedback), wired to backend ZIP endpoints
- Docker sandbox session manager with lazy llm-sandbox import, module-level TTL eviction, and Supabase tables (code_executions + sandbox_files) with RLS policies
- One-liner:
- 1. [Rule 1 - Bug] Fixed pre-existing test mock setup missing thread_folder_result
- harvest_output_files() copies Docker container output to Supabase Storage sandbox-outputs bucket, inserts sandbox_files rows, and returns signed download URLs — enabling users to retrieve files generated by their code
- FastAPI lifespan shutdown closes all Docker sandbox containers; thread-delete cleans up per-thread sessions; execute_code handler wires in harvest_output_files to deliver signed file URLs in SSE completion event
- Four code execution SSE events (start/stdout/stderr/complete) wired through streamMessage() into interleaved outputLines accumulation on the running execute_code ToolCall in React state
- ExecuteCodeBlock component with streaming terminal output and file download cards wired into ToolCallPanel dispatch for execute_code tool calls
- SkillFile TypeScript type and three tested API functions (listSkillFiles, uploadSkillFile, deleteSkillFile) wired to backend /skills/{id}/files routes
- File management section added to SkillFormDialog edit mode with upload/delete controls gated by ownership and optimistic state updates
- System prompt tool count corrected to thirteen, all v2.0 requirements marked complete, and Phase 15 VERIFICATION.md confirming SAND-12 created from code inspection

---

## v1.0 Knowledge Base Explorer (Shipped: 2026-03-29)

**Phases completed:** 8 phases, 18 plans, 22 tasks

**Key accomplishments:**

- Postgres adjacency-list folders table with RLS, cascade delete, and 5 FastAPI CRUD endpoints (create/list/children/rename/delete) with ownership enforcement
- Document-folder integration: `folder_id` FK, `full_markdown` storage, and move endpoints for files and folders
- Ingestion UI two-panel layout with folder tree, CRUD controls, and folder-targeted uploads (51 integration tests)
- `ls` and `tree` KB navigation tools with in-memory path resolution, depth limits, and truncation indicators
- `grep` (regex content search) and `glob` (filename pattern matching with `**` support) search tools
- `read` tool for full document or line-range retrieval from stored markdown
- Explorer sub-agent: backend mode branching on `agent_mode` with 6 KB-only tools and dedicated system prompt
- General/Explorer mode selector dropdown in chat toolbar (Compass icon, agentMode state in ChatArea)
- Global folder sharing via updated RLS (migration 015); folder-scoped chat threads with recursive subtree RAG scoping (migration 016)
- FolderDetail info bar: doc count, total size, global badge, subfolder count, creation date

## Post-v1.0 Enhancements (2026-03-29)

**Aether Intelligence Design System** (visual-only, no functionality changes):

- Complete CSS variable system with dark + light mode (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--success`, `--sidebar`, etc.)
- Theme toggle (Sun/Moon) in Sidebar; `useTheme` hook persists to localStorage, respects `prefers-color-scheme`; FOUC prevention script in `index.html`
- Google Fonts (Inter + Manrope), custom Tailwind font families (`sans`, `headline`, `mono`), keyframe animations (`fadeSlideUp`, `pulseGlow`)
- Glassmorphism chat input, gradient user bubbles, animated thinking dots, color-coded tool call icons, gradient send button
- AuthPage gradient orbs + glassmorphism card; IngestionPage/SettingsPage ghost-border cards

**Backend bug fix:**

- `folders.py` null-guard: `maybe_single().execute()` can return `None` when no row exists; added `if name_check and name_check.data` guard in both create and rename endpoints to prevent `AttributeError` on `None.data`

---
