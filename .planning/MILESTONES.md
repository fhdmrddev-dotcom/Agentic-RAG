# Milestones

## v2.7 Agent Workspace & Panel (Shipped: 2026-05-30)

**Phases completed:** 6 phases (083–088), 28 plans, 50 tasks
**Timeline:** 2026-05-27 → 2026-05-30 (3 days, 226 commits)
**Files changed:** 673 files (+52,449 / −3,081 lines)

**Key accomplishments:**

- Provider-gated Kimi thinking content filter strips <think> tags from visible chat + title generation fixed for DeepSeek/Moonshot/MiniMax/GLM/Google with tier-aware model routing
- Workspace filesystem schema landed -- workspace_files + workspace_file_versions tables, FK-chain RLS, and private storage bucket created in live local DB. Bootstrap full-schema.sql regenerated.
- Workspace backend logic layer landed -- asyncpg helpers, response models, and a single workspace_service.py that hides hybrid storage routing (inline bytea <= 256KB / bucket > 256KB), enforces 10MB hard cap, 100-file soft warning, 8192-char read cap, path validation, and structured difflib diffing.
- 5 workspace tools wired into the agent loop -- handlers in tool_dispatcher.py + LLM schemas in openai_service.get_tools(); write and delete emit SSE events for the Phase 086/087 panel UI.
- 4 cold-path GET endpoints under /threads/{thread_id}/workspace -- list, content (inline or 60s signed URL), versions, diff. _verify_thread_ownership uses 404-not-403 to prevent existence leak. Router registered in main.py.
- Three direct fixes that close the cross-provider UAT bandwidth blockers (Google ValidationError, OpenRouter list-empty, REST /content empty body) with 22 new unit tests pinning the behavior so future provider integrations can't silently regress.
- The shared 087 foundation: 4 typed workspace api.ts client fns (content/versions/diff/answer), amber `--warning` + dim-text CSS tokens, a zero-dependency Radix-Dialog bottom-sheet primitive, and 7 GREEN-only panel test files (52 it.todo contracts) so every downstream wave builds against fixed signatures.
- The PANEL-01 panel shell + PANEL-02 todos: `WorkspacePanel` hosts an open/rail/hidden grid-state machine (⌘./Ctrl+. toggle, <768px bottom-sheet, laptop-squeeze-aware), short-circuits to ONE calm `PanelEmpty` when idle, and composes the live Wave-1/2 sections (Todos · Files · Versions) into a fixed-order accordion with the `PendingAskStack` pinned at the very top — mounted as one additive sibling in `ChatLayout` (chat-view only) with the chat↔panel seam open-handlers wired via a module-level signal. The new `TodosSection` renders the reactive todo list with non-color-only status indicators. All 7 panel test files GREEN (67 live, 0 todo); full suite at the documented 17-failure baseline, no new failures.
- The panel's file browser: `FilesSection` lists thread workspace files (icon + mono name + size·version meta, green flash on fresh write) and full-replaces into `FilePreview` — a per-type router that reuses MarkdownRenderer for md, ShikiCode for code, the new dependency-free `CsvTablePreview` `<table>` for csv, framed `<img>` for bucket images, and a calm "No preview available · Download" / "File too large to preview" fallback for null-url / binary / malformed / too-large content. All raw content is React-escaped or routed through sanitizing renderers — zero raw-HTML injection.
- The PANEL-07 version-diff viewer: a pure client-side `parseUnifiedDiff` (no diff lib), a shared in-column `DiffLines` renderer (fixed 16px sign gutter, honest truncation notice), an opt-in `DiffExpandOverlay` in the existing Radix dialog (same payload, no second fetch), and `VersionDiff` with red-base/green-target accessible pills defaulting to Compare v{n-1}↔v{n} — 14 live tests GREEN (7 parser + 7 component).
- The PANEL-04 answer surface (stacked amber `PendingAskCard`s with run_id-gated submit + resume-in-place) plus the three additive chat↔panel seam renderers (live `SeamPointer`, reload `SeamCard` that closes the `ask_user` reload gap, and the `PausedRunCue`), mounted strictly additively into the G-5 `MessageItem` with single-source-of-truth (D-05) and zero raw-JSON leak.
- Hoisted the workspace-panel chat|panel split into a single ChatLayout-level CSS grid (1fr chat | clamp(300-420px)/52px/0 panel) so the panel resolves against the real row width — closing the overflow (gap 1), dead-band (gap 7), and per-thread-shift defects — lifted the open/rail/hidden state machine up to ChatLayout to host a persistent always-visible chat-header toggle (gap 3) with a pulsing-amber-dot ask_user-pending indicator (gap 4 / PANEL-01), and stripped the leaked DevTwoPaneMock debug overlay from the production tree (gap 2).
- Dedicated `--panel-surface`/`--panel-border` tokens give the workspace panel + rail a distinct surface in both themes (gaps 5/6); Chrome-MCP gate verified the 004-panel-shell layout contract and routed the remaining feature contracts + cross-provider scoreboard to 087-08.
- One nav-style in-panel workspace toggle (collapse-to-rail) replaces the two-control/hidden-state design; all four design contracts (004/005/006/007) + PANEL-02 + the cross-provider 4-axis scoreboard verified live — surfacing and fixing a real version-diff 500 and a todo-count bug.
- WCAG 2.1 AA structural conformance closed on all 8 Phase 087 panel surfaces: vitest-axe wired as a durable regression gate, one global zero-specificity :focus-visible ring added, two targeted aria-live announcements (todo count + diff +N/−M), and the FilesSection always-false aria-selected fixed — all 89 panel tests green with zero regression past the 17-failure 086 baseline.
- A reusable, localhost-gated `scripts/eval_cross_provider.py` that drives the REAL `POST /threads/{id}/messages` route per (provider × canonical-prompt) across OpenAI/Anthropic/Google-3.x/OpenRouter and asserts tool-invocation + arg-shape + DB persistence, emitting a greppable PASS/FAIL scoreboard as the SEED-034 fold-gate evidence source.
- `scenario-13-workspace-deep-flow.spec.ts` — a provider-parameterized Playwright backstop that drives the full deep workspace flow (write -> see -> update -> diff -> ask_user -> respond -> resume) with NO page refresh on Anthropic AND Google, and asserts zero 400 INVALID_ARGUMENT on both (the D-17 gemini-3 thought-signature live re-verify at the network level).
- SEED-034 resolved on evidence: a text-only universal `write_todos` + `ask_user` directive folded into the shared `SYSTEM_PROMPT` + tool descriptions — re-verified across an extended 6-provider × 4-prompt matrix to deliver 3 improvements (OpenAI/Anthropic/OpenRouter now invoke `write_todos` on multi-step work) with zero fold-attributable regression. VERDICT: FOLDED (kept at `2f6e2523`).
- Live 4-axis cross-provider UAT (6 providers PASS) + WCAG 2.1 AA panel a11y re-verified in both themes (contrast fixed dark 7.21:1 / light 4.66:1) + Anthropic+Google deep-flow no-refresh pass + D-17 gemini-3 thought_signature closed-as-verified — recorded into 088-VALIDATION.md; Phase 088 verification gate complete.

**Architectural decisions locked:**
- FOUND-01: tool-dispatch chain extracted from `threads.py` (~3,800 LOC) into a registry-pattern `tool_dispatcher.py` — G-5 hot-file mandate satisfied; all new tools register here
- 083-03: `_SINGLE_MODEL_PROVIDERS` frozenset drives tier-aware title-gen model routing; Kimi/Moonshot thinking filter is a provider-gated `<think>` state-machine (moonshot + deepseek only)
- 084: per-thread workspace uses hybrid storage hidden behind `workspace_service.py` — inline bytea ≤256 KB / Supabase Storage bucket >256 KB; FK-chain RLS; owner endpoints return 404-not-403 to prevent existence leak
- 085: first Redis pub/sub in the codebase (`ask_user`) — SUBSCRIBE-first ordering + cancel sentinel + uvicorn lifespan shutdown broadcast for cross-worker safety under `WORKER_COUNT=2`; sub-agent `task` capped at 1-level nesting + dual concurrency (per-run `Semaphore(3)` + global Redis Lua-atomic cap 20); tool registry 21→24 (migration 055)
- PANEL-06: panel SSE events route to dedicated Zustand keys, never chat `bucketsBySurface` — a panel update triggers zero chat-message-list re-renders
- 087: the chat|panel split is ONE `ChatLayout`-level CSS grid (1fr chat | clamp(300–420px) panel); G-2 sketch-before-plan honored; 087-08 consolidated to a single nav-style in-panel toggle (collapse-to-rail), dropping the redundant chat-header toggle + hidden state
- 088 / SEED-034: the universal `write_todos`/`ask_user` tool-use directive is TEXT-ONLY — no `tool_choice` forcing, `TASK_TOOL` untouched; eval gate judged on the native providers via `scripts/eval_cross_provider.py`
- D-17 (gemini-3 `thought_signature`): closed-as-verified — Google-axis deep-flow + multi-tool rounds clean (zero 400 INVALID_ARGUMENT); the 075.4 Stage-4 echo hotfix holds

**Known deferred items at close:** 27 acknowledged (11 pre-GSD micro-tickets; 4 dormant seeds SEED-002/003/004/005; cosmetic UAT status fields; 083 + 085 verification `human_needed` gaps — operator-approved). Plus 087 panel deferrals **SEED-037** (in-panel office/PDF/PPTX viewing + working download), **SEED-038** (chat-vs-panel artifacts unification), **SEED-039** (panel reliability / fast-switch race). Plus v2.8 carry-forwards: title-gen live-verify on DeepSeek/Moonshot/Google (BUG-260527-01, rolled forward unverified), Google secondary-model 404 routing artifact, per-provider `task`/`ask_user` gaps a text-only directive did not close (eval script is the v2.8 harness seed, D-08), and chat-tool-card unification (BUG-260529-02, major — its own v2.8 phase). See STATE.md `## Deferred Items` for the full inventory.

---

## v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Shipped: 2026-05-27)

**Phases completed:** 35 phases (068–082 including inserts), 91 plans complete
**Timeline:** 2026-05-12 → 2026-05-27 (16 days, 846 commits)
**Files changed:** 771 source files (+183K lines)

**Key accomplishments:**

1. Per-aspect extraction dispatcher with swappable engines — `extract_composable()` routes text/tables/images/equations through independent registries; camelot tables (53.5x recall vs pdfplumber), pymupdf_full images, legacy text. Docling formally retired after 4 phases of diminishing returns; `PdfExtractor` ABC + per-call `?engines=` hints on `/upload` and `/reextract`. Migrations 039–047.
2. Multi-worker uvicorn enabled (`WORKER_COUNT=2`) — D-PRD-12 ADR supersedes D-v2.5-02; 50-parallel-run validation harness (Phase 077); cross-worker cancel via Redis zombie-heal; sandbox re-attach; per-worker Redis singleton idempotent. `runs.spawned_by_worker` debug column (migration 052).
3. StreamsProvider context lift — `useMessages` reduced from 1229 LOC to <100 LOC; Zustand store + `<StreamsProvider>` Context owns all run-stream subscriptions; Phase 067.5 Branch D-3 guard preserved verbatim; mocked second surface renders without state collision.
4. 9 LLM providers integrated — OpenAI, Anthropic (native SDK), Google, DeepSeek (thinking mode), Kimi/Moonshot, MiniMax, GLM/Zhipu, OpenRouter (generic fallback), Ollama. Per-provider base URLs, API keys, sub-agent defaults, timeout profiles. DeepSeek reasoning_content round-trip + collapsible Thinking block.
5. Live-execution UX refactor — RunCard per assistant turn (sticky header + timer + counter + fold-to-summary), Editor-Inset tool-call panel with per-tool inner-body components (execute_code editor + STDOUT/STDERR + file preview; search_documents ranked rows; read_file metadata), Focus Mode composition (past tools fold to result-summary, active step keeps full editor).
6. Settings architecture unification — `settings_override.json` eliminated; 36 keys migrated to `app_settings` DB table; `model_capabilities_overrides` table for runtime model registration; 30s TTL hot-reload cache; 4-tier resolution (DB > env CSV > static dict > default). Migration 053.
7. asyncpg pool in hot paths — 3 surgical flips in `threads.py` (runs INSERT, messages INSERT, runs UPDATE finalize); `runs.input_tokens`/`runs.output_tokens` forward-filled from LLM `usage` (TOKEN-COL-01). Two-gate strategy: test_058 (mock) + test_073 (real asyncpg).
8. Confidence recalibration on post-071.3 defaults — N=121 queries; thresholds 0.55/0.40 → 0.54/0.38; bucket balance restored to D-04 targets (30.6%/45.5%/24.0%).
9. Cross-cutting verification gate — 5/5 SCs GREEN, 24/24 REQ-IDs Validated, 7 seeds dispositioned (6 closed, 1 partial-consumed).

**Architectural decisions locked:**

- D-PRD-12: Multi-worker enablement — D-v2.5-02 formally superseded; WORKER_COUNT=2 default; revert via env var flip
- D-v2.6-01: supabase-py 2.10 → 2.29.x upgrade (httpx conflict resolved)
- D-v2.6-04: Opt-in re-extraction via `POST /documents/{id}/reextract`
- D-v2.6-05 (D-PRD-15): Docling demotion + camelot default + PyMuPDF in-process; v2.6 PRD "Docling-first" thesis retired

**Known deferred items at close:** 40 acknowledged (15 UAT status fields not flipped — cosmetic; 10 verification gaps with project-level approval; 11 quick tasks predating GSD; 4 dormant seeds — SEED-002/003/004/005). Phase 082.5 (Error Handler Foundation) deferred to v2.7. See STATE.md `## Deferred Items` for the full inventory.

---

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
