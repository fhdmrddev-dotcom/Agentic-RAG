# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1-8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9-17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18-25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26-32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33-43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44-57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058-067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068-082 (shipped 2026-05-27)
- **v2.7 Agent Workspace & Panel** — Phases 083-088 (in progress)

---

## v2.7 Milestone Context

**Goal:** Ship a per-thread workspace filesystem and right-side panel that gives the agent a persistent scratchpad, todo management, sub-agent spawning, and user-input pausing -- the "Claude.ai artifacts" moment for a self-hosted, multi-provider agent platform.

**Scope brief:** `.planning/PRDs/v2.7.md` (drafted 2026-05-12, scoped to Themes A+C+D+H for v2.7). 22 Active REQ-IDs across 5 categories (Foundation, Workspace, Tools, Panel, Accessibility). Research completed 2026-05-27 with HIGH confidence across all 6 axes.

**Phase numbering basis:** Continues from v2.6's last phase 082 (plus deferred 082.5). v2.7 starts at Phase **083** and runs through Phase **088** (6 phases). Migration range reserved: `053-070` (per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`).

**Critical constraints from research:**
- threads.py tool-dispatch extraction (G-5 mandated) MUST precede any new tool additions
- Panel events must route to SEPARATE Zustand keys, NOT through chat `bucketsBySurface`
- `ask_user` needs Redis pub/sub for cross-worker safety (`asyncio.Event` fails with `WORKER_COUNT=2`)
- `task` tool: 1-level nesting cap, per-run and global concurrency limits
- `workspace_read`: content cap (configurable, ~8K chars) to protect context window
- SC#10 MANDATORY: 4-axis UAT matrix for phases emitting new SSE event types
- G-2 fires for Panel UI phase (sketch-before-plan)

**Build order rationale:**
- Tool-dispatch extraction first: not optional or deferrable -- conflicts with every subsequent tool addition if done later; G-5 mandated (threads.py at 3,843 LOC with 9+ phases)
- Workspace backend before panel: panel is a pure consumer; building UI before events exist means building against mocks
- Three new tools after workspace: workspace tools establish the dispatcher pattern; `ask_user` isolated for focused testing
- StreamsProvider extension before panel UI: panel components build against working hooks, not stubs
- Verification last but SSE event matrix seeded from Phase 085 onward (first phase introducing new event types)

---

## Phases

<details>
<summary>v1.0 Knowledge Base Explorer (Phases 1-8) -- SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) -- completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) -- completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) -- completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) -- completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) -- completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) -- completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) -- completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) -- completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Agent Skills & Code Execution (Phases 9-17) -- SHIPPED 2026-04-04</summary>

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Stability & RAG Correctness (Phases 18-25) -- SHIPPED 2026-04-11</summary>

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v2.2 Trust & Compliance (Phases 26-32) -- SHIPPED 2026-04-16</summary>

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Memory, Multimodal & Experience (Phases 33-43) -- SHIPPED 2026-04-19</summary>

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>v2.4 Stability, Polish & UX Fixes (Phases 44-57) -- SHIPPED 2026-04-30</summary>

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>v2.5 Deployment Strategy (Phases 058-067.5) -- SHIPPED 2026-05-09</summary>

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068-082) -- SHIPPED 2026-05-27</summary>

35 phases (068-082 including inserts), 91 plans complete. See `.planning/milestones/v2.6-phases/` for archived phase directories and `.planning/MILESTONES.md` for the full close-out narrative.

</details>

### v2.7 Agent Workspace & Panel (In Progress)

**Milestone Goal:** Ship a per-thread workspace filesystem and right-side panel that gives the agent a persistent scratchpad, todo management, sub-agent spawning, and user-input pausing.

- [x] **Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes** - G-5 mandated refactor of threads.py tool dispatch + close 4 open v2.6 bugs
- [x] **Phase 084: Workspace Filesystem Backend** - Per-thread workspace with hybrid storage, versioning, diffing, and SSE events (gap closure in progress -- Plan 05 closes 3 cross-provider UAT blockers) (completed 2026-05-28)
- [ ] **Phase 085: New LLM Tools** - write_todos, task (sub-agent), and ask_user (human-in-the-loop pause/resume)
- [ ] **Phase 086: StreamsProvider Extension + Panel Hooks** - New SSE event types demuxed to separate Zustand stores, panel-ready hooks
- [ ] **Phase 087: Panel UI** - Right-side collapsible panel with todos, file browser, ask_user prompt, and diff viewer
- [ ] **Phase 088: Cross-Cutting Verification + Accessibility** - 4-axis UAT matrix (SC#10), WCAG 2.1 AA audit, E2E validation

## Phase Details

### Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes
**Goal**: The codebase is structurally ready for new tool additions, and 4 lingering v2.6 bugs no longer affect users
**Depends on**: Nothing (first phase of v2.7)
**Requirements**: FOUND-01, FOUND-02
**Success Criteria** (what must be TRUE):
  1. All 16 existing tools dispatch through a new `tool_dispatcher.py` registry-pattern module -- `threads.py` no longer contains tool-specific handling logic (G-5 satisfied)
  2. Existing agent behavior is byte-identical before and after extraction -- all existing tests pass without modification
  3. Kimi/Moonshot thinking content no longer leaks into visible chat messages (BUG-260526-02 closed)
  4. Sandbox output files generated during an agent run appear in the Final Outputs panel without requiring page refresh (BUG-260526-03 closed)
  5. Timer stays visible throughout the entire agent run cycle and title generation works on DeepSeek/Moonshot/Google models (BUG-260526-04 + BUG-260527-01 closed)
**Plans**: 3 plans
**Research flag**: Skip research-phase -- ARCHITECTURE.md Section 8 provides the extraction strategy; bugs have known root causes from v2.6 triage

Plans:
- [x] 083-01-PLAN.md -- Extract tool dispatch chain to tool_dispatcher.py with registry pattern (FOUND-01)
- [x] 083-02-PLAN.md -- Frontend bug fixes: output files after reload + timer key stability (FOUND-02)
- [x] 083-03-PLAN.md -- Backend bug fixes: Kimi thinking filter + title gen cross-provider fix (FOUND-02)

### Phase 084: Workspace Filesystem Backend
**Goal**: The agent can write, read, list, delete, version, and diff files in a per-thread workspace that persists across turns, thread reloads, and browser sessions
**Depends on**: Phase 083 (tool dispatcher must exist for new tool registration)
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, WS-06, WS-07
**Success Criteria** (what must be TRUE):
  1. Agent writes a file via `workspace_write`, and the file content survives thread reload and browser refresh -- user sees the same content after navigating away and back
  2. Agent reads a workspace file via `workspace_read` with content capped at a configurable max chars (default ~8K) -- large files return a truncation notice, not the full content
  3. `workspace_list` shows all files in the thread workspace; `workspace_delete` removes a file permanently; both reflect immediately in subsequent calls
  4. Every `workspace_write` auto-creates a new version row, and `workspace_diff` returns a structured diff between any two versions of the same file
  5. Files below the configurable size threshold are stored inline in Postgres; files above are uploaded to Supabase Storage -- the agent and user see no difference in behavior regardless of storage backend
**Plans**: 5 plans (1 gap-closure plan added after human UAT 2026-05-28)

Plans:
- [x] 084-01-PLAN.md -- Database migration: workspace tables, RLS policies, storage bucket (WS-01, WS-05, WS-06)
- [x] 084-02-PLAN.md -- DB layer, Pydantic models, workspace service with hybrid storage and versioning (WS-01, WS-02, WS-03, WS-04, WS-05)
- [x] 084-03-PLAN.md -- Tool handlers in tool_dispatcher + tool schemas in openai_service + SSE events (WS-01, WS-02, WS-03, WS-04, WS-07)
- [x] 084-04-PLAN.md -- REST API endpoints for workspace file browsing, content, versions, and diff (WS-02, WS-03, WS-04, WS-06)
- [x] 084-05-PLAN.md -- Gap closure: Google schema sanitizer + workspace_list-empty + REST /content empty-body (WS-02, WS-03, WS-04, WS-06, WS-07)

### Phase 085: New LLM Tools
**Goal**: The agent can manage a todo list, spawn sub-agents for delegated work, and pause to ask the user a question -- all operating safely across multiple workers
**Depends on**: Phase 084 (workspace tools establish the tool_dispatcher pattern; ask_user needs Redis infrastructure proven by WS-07 SSE events)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. Agent calls `write_todos` and the todo list persists per-thread -- reloading the thread shows the same todos with correct status indicators (pending, in-progress, completed)
  2. Agent calls `task` to spawn a sub-agent that completes work and returns a summary -- sub-agents cannot spawn their own sub-agents (1-level nesting cap enforced) and respect per-run and global concurrency limits
  3. Agent calls `ask_user`, the agent loop pauses, user sees the prompt and submits a response, and the agent resumes with the user's answer in `tool_result` -- all within a single unbroken conversation flow
  4. `ask_user` works correctly when the POST response lands on a different worker than the paused agent loop (cross-worker coordination via Redis pub/sub), and gracefully expires with a timeout message if the user does not respond within the configurable timeout
**Plans**: 4 plans (2 waves — Plans 01+02 parallel; Plans 03+04 depend on Wave 1)
**Research flag**: Phase research recommended for `ask_user` -- Redis pub/sub integration with `_shielded_finalize` cleanup, edge cases (cancelled run while SUBSCRIBE active, uvicorn shutdown during pause, timeout race with stop button)

Plans:
- [ ] 085-01-todos-PLAN.md — Migration 055 (todos table + runs.parent_run_id + messages.tool_calls.kind doc-comment) + todos_service + _handle_write_todos (TOOL-01)
- [ ] 085-02-task-service-PLAN.md — task_service.py sub-agent loop + sub_agent_models helper + ToolContext extensions + concurrency caps + _handle_task (TOOL-02)
- [ ] 085-03-ask-user-PLAN.md — ask_user_service Redis pub/sub + _handle_ask_user + POST /runs/{rid}/ask_user_response + cancel sentinel + uvicorn lifespan shutdown broadcast (TOOL-03, TOOL-04)
- [ ] 085-04-rest-tools-uat-PLAN.md — panel.py 3 GET endpoints + 3 new tool JSON schemas in get_tools() + SC#10 4-axis UAT execution (TOOL-01..TOOL-04)

### Phase 086: StreamsProvider Extension + Panel Hooks
**Goal**: The frontend streaming infrastructure routes all new SSE event types to dedicated panel state stores, and per-thread hooks provide reactive data for panel UI components
**Depends on**: Phase 085 (all backend tools and SSE event types must be finalized before frontend wiring)
**Requirements**: PANEL-05, PANEL-06
**Success Criteria** (what must be TRUE):
  1. Panel subscribes to the same EventSource as chat via StreamsProvider Context -- no duplicate SSE connections created when the panel is open
  2. Workspace file events, todo updates, ask_user prompts, and task progress events each route to separate Zustand keys -- a `workspace_file_written` event causes zero re-renders in the chat message list
  3. Per-thread hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`) provide reactive state that reconciles on thread-switch via fetch (D-v2.5-03 pattern)
**Plans**: TBD
**Research flag**: Skip research-phase -- purely additive extension of existing StreamsProvider pattern; ARCHITECTURE.md Section 3.3 diagrams the demux pattern

Plans:
- [ ] 086-01: TBD
- [ ] 086-02: TBD

### Phase 087: Panel UI
**Goal**: Users see a right-side panel that shows the agent's workspace files, todo list, pending questions, and file version diffs -- making the agent's work visible and interactive
**Depends on**: Phase 086 (panel hooks must provide reactive data before building UI)
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-07
**Success Criteria** (what must be TRUE):
  1. A collapsible right-side panel (~30% width) appears next to chat, togglable via button and keyboard shortcut -- on mobile (<768px) it renders as a bottom-sheet overlay instead
  2. Todos section renders the live todo list with status indicators (pending, in-progress, completed) and updates in real-time as the agent calls `write_todos` -- no page refresh needed
  3. Workspace file browser lists all thread files with click-to-preview for text, markdown, and code files -- previews reuse existing MarkdownRenderer and syntax highlighting
  4. Pending user input section renders `ask_user` prompts with optional choice buttons and free-text field -- submitting a response resumes the agent within the same panel view
  5. Diff viewer renders pre-computed version deltas with syntax highlighting -- user can select any two versions of a file to compare
**Plans**: TBD
**UI hint**: yes
**Research flag**: G-2 MANDATORY -- sketch-before-plan. Panel layout, responsive breakpoints (375px, 768px, 1024px, 1440px), bottom-sheet mobile behavior must have operator-approved mockup before planning begins.

Plans:
- [ ] 087-01: TBD
- [ ] 087-02: TBD

### Phase 088: Cross-Cutting Verification + Accessibility
**Goal**: All new v2.7 capabilities are verified across providers, and all panel surfaces meet accessibility standards
**Depends on**: Phase 087 (all features must be built before cross-cutting verification)
**Requirements**: A11Y-01, A11Y-02
**Success Criteria** (what must be TRUE):
  1. 4-axis UAT matrix complete: all new SSE event types verified across OpenAI, Anthropic, Google, and OpenRouter with multi-tool, parallel-thread, and long-message scenarios (SC#10 MANDATORY)
  2. All panel surfaces pass WCAG 2.1 AA -- keyboard navigation through todos, file browser, and ask_user prompt; ARIA labels on all interactive elements; minimum 4.5:1 contrast ratio; visible focus indicators
  3. File browser and todo list are fully navigable via keyboard alone -- Tab/Shift-Tab moves focus, Enter/Space activates items, Escape closes previews, no mouse-only interaction paths
  4. E2E workspace flow verified: agent writes file, user sees it in panel, agent updates file, user views diff, agent asks user a question, user responds, agent resumes -- all without page refresh, across at least 2 providers
**Plans**: TBD

Plans:
- [ ] 088-01: TBD
- [ ] 088-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 083 -> 084 -> 085 -> 086 -> 087 -> 088

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 083. Foundation -- Tool-Dispatch Extraction + Bug Fixes | 3/3 | Complete    | 2026-05-27 |
| 084. Workspace Filesystem Backend | 5/5 | Complete    | 2026-05-28 |
| 085. New LLM Tools | 0/TBD | Not started | - |
| 086. StreamsProvider Extension + Panel Hooks | 0/TBD | Not started | - |
| 087. Panel UI | 0/TBD | Not started | - |
| 088. Cross-Cutting Verification + Accessibility | 0/TBD | Not started | - |

---

*Roadmap authored 2026-05-28 from `.planning/REQUIREMENTS.md` (22 Active REQ-IDs) + `.planning/research/SUMMARY.md` (HIGH confidence, 6-file research consensus). Continues phase numbering from v2.6's last phase 082.*
