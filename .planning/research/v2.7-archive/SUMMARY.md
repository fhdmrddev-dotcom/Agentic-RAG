# Project Research Summary

**Project:** Agentic RAG v2.7 - Agent Workspace and Panel
**Domain:** Per-thread workspace filesystem, right-side panel UI, agent-pause/resume, sub-agent delegation
**Researched:** 2026-05-27
**Confidence:** HIGH

## Executive Summary

The v2.7 milestone adds four interconnected capabilities to an existing run-backed streaming chat platform: a per-thread workspace filesystem (agent writes persistent files visible in a side panel), a right-side panel UI consuming the same SSE stream as chat, three new LLM tools (write_todos, task, ask_user), and a deterministic workflow harness. The right-side panel is no longer a product differentiator -- Claude.ai, ChatGPT Canvas, Cursor, and Windsurf all ship variations. What differentiates Agentic RAG is that it is the only product combining multi-provider support, self-hosting, human-in-the-loop pause/resume, and a plugin-extensible panel in a single chat-first interface. Every one of the four new capabilities has battle-tested open-source reference implementations (LibreChat, OpenHands, LangGraph, Claude Code Task tool) that confirm our architecture choices and reveal the failure modes to avoid.

The recommended approach leverages the substrate already built in v2.6. The StreamsProvider Context was explicitly designed as a multi-consumer surface; the panel is a second consumer of the same EventSource, adding zero new infrastructure. Workspace storage mirrors the existing sandbox-outputs bucket pattern. The three new LLM tools follow the same tool-definition shape as the existing 16. Net new dependencies are minimal: 3 npm packages, 1 pip package, 6 shadcn components. The harness engine stays hand-rolled (no LangGraph -- project rule) and the plugin contract is deferred to v2.8. The most critical decision in this milestone is the build order: the threads.py god-file (3,843 LOC, 9+ phases, G-5 fires) MUST have its tool dispatch chain extracted into a separate module before any new tools are added. Skipping this extraction is the single highest-risk path to a 075.x-style cascade.

The three highest risks are: (1) threads.py god-file compounding -- mitigated by treating tool-dispatch extraction as a Phase 0 prerequisite, (2) ask_user pause/resume requiring the first-ever cross-worker coordination primitive inside the agent loop -- mitigated by using Redis pub/sub instead of asyncio.Event, and (3) panel events triggering chat re-renders through the StreamsProvider -- mitigated by routing panel event types to a separate Zustand slice and never funneling them through setMessagesForBucket. All other risks are moderate or lower and have clear precedents in the open-source landscape.

---

## Key Findings

### Recommended Stack

The stack additions for v2.7 are minimal. On the frontend, react-resizable-panels (the library shadcn Resizable wraps) is the ecosystem-consensus choice for split layouts -- used by LibreChat and assistant-ui, confirmed React 19 compatible. Six shadcn components cover all panel UI needs using Radix primitives already in the project dependency tree. The custom diff viewer built on existing shiki and server-side difflib avoids the React 19 incompatibility of every external diff library. On the backend, jsonschema>=4.23.0 is the sole new pip package, needed for plugin manifest validation (deferred to v2.8 but in the dependency budget). No new state machine library, no new WebSocket, no new visualization library, no Monaco Editor. Total dependency budget: 3 npm packages + 1 pip package + 6 shadcn component files.

**Core technologies (new additions only):**
- react-resizable-panels (v4.11.2): resizable chat/panel split layout -- shadcn officially wraps it, React 19 compatible, authored by Brian Vaughn (React DevTools)
- @radix-ui/react-accordion, @radix-ui/react-progress: Accordion and Progress for panel sections -- same Radix ecosystem as existing project deps
- jsonschema>=4.23.0: plugin manifest JSON-Schema draft-2020-12 validation -- canonical Python implementation, not a transitive dep of any existing package
- shadcn resizable, sheet, checkbox, badge, accordion, progress: panel UI via npx shadcn add -- zero new npm packages beyond Radix primitives

**What NOT to add:** Monaco Editor (3MB bundle, overkill for agent-written read-only artifacts), CRDT library (no co-editing in v2.7), any external diff library (all have React 19 peer dep issues), LangGraph (project rule).

### Expected Features

The panel itself is table stakes in 2026. All 10 table-stakes features (TS-01 through TS-10) are required for the product to feel complete. The differentiators in scope for v2.7 are ask_user (DF-03), the diff viewer (DF-05), and the workflow phase indicator (DF-06). The plugin-extensible panel (DF-07/08) and harness engine are deferred to v2.8.

**Must have (table stakes):**
- TS-01: Right-side panel, collapsible, ~30% width, bottom-sheet on mobile
- TS-02: Panel toggle (button + keyboard shortcut)
- TS-03: Agent writes files to a persistent per-thread workspace
- TS-04: File version history with restore
- TS-05: File browser / list in panel
- TS-06: Live preview for text/markdown/code files -- reuses MarkdownRenderer and ShikiCode
- TS-07: SSE-driven real-time panel updates -- the v2.6 StreamsProvider payoff
- TS-08: Todo list display from write_todos tool
- TS-09: Workspace scoped per-thread via workspace_files.thread_id FK + RLS
- TS-10: Download workspace files -- mirrors existing OutputFileCard pattern

**Should have (differentiators in v2.7 scope):**
- DF-03: ask_user tool (human-in-the-loop pause/resume) -- first-class panel prompt; no competitor ships this in a chat-first product
- DF-05: Diff viewer for file versions -- delta_from_prev JSONB + custom DiffViewer component
- DF-06: Workflow phase indicator in panel -- visible only when active_workflow_run_id IS NOT NULL

**Defer to v2.8:**
- DF-07/08: Plugin-extensible panel sections and file preview renderers -- design extension seams now, implement contract later
- User inline editing of workspace files -- read-only in v1 avoids write-conflict complexity
- Visual drag-and-drop workflow builder -- API-authored workflows for v2.7

**Anti-features (explicitly not building):**
- Real-time multi-user co-editing (CRDT -- no demand signal, massive complexity)
- Workspace files as RAG corpus (chunk-store explosion, retrieval confusion)
- Automatic panel opening on every agent response (annoys Q&A users)
- Live HTML/React rendering in panel (XSS surface, deferred to post-v2.7 plugin)

### Architecture Approach

v2.7 is extension, not reinvention. New SSE event types ride the existing run:{run_id} Redis Stream via the same _emit() XADD helper. The panel is a second consumer of the existing StreamsProvider Context -- no new EventSource connections. New workspace tools register in the existing get_tools() function. Workspace storage mirrors the sandbox-outputs bucket pattern from Phase 067.4. The ask_user pause/resume uses Redis pub/sub for cross-worker safety -- asyncio.Event fails with WORKER_COUNT=2. All panel state lives in separate Zustand keys in streamsStore.ts (not in bucketsBySurface) to prevent chat re-render storms.

**Major new components:**

Backend (new modules):
1. tool_dispatcher.py -- extracted tool dispatch from threads.py; registry-pattern mapping tool names to async handler functions; G-5 mandated refactor; prerequisite for all new tools
2. workspace_service.py -- CRUD for workspace_files + workspace_file_versions; hybrid storage (inline bytea up to 256KB, Supabase Storage bucket for larger); difflib-based delta generation
3. harness_engine.py -- state machine: phase registry, transition logic, validator dispatch, tool-whitelist enforcement; 3 priority phase types (llm_single, llm_agent, llm_human_input); defer programmatic + llm_batch_agents
4. todo_service.py -- full-state-replace persistence to todos table
5. task_runner.py -- standalone sub-agent execution; spawns run:{sub_run_id} with constrained tool list, 1-level nesting cap, parent_run_id linkage

Frontend (new components):
1. WorkspacePanel.tsx -- root panel: collapsible, shadcn Resizable, 4 sections, responsive bottom-sheet on mobile
2. TodoSection.tsx, WorkspaceFileBrowser.tsx, WorkflowIndicator.tsx, AskUserPrompt.tsx -- panel sections
3. DiffViewer.tsx -- file version diff display; renders pre-computed delta_from_prev JSONB
4. useTodos, useWorkspaceFiles, useWorkflow, useAskUserPrompt -- per-thread hooks with reconcile-on-mount (D-v2.5-03)

Database (11 migrations, range 125-135):
New tables: workspace_files, workspace_file_versions, workflow_definitions, workflow_runs, workflow_phases, todos, plugin_registry, plugin_extension_points, harness_audit. Modified: threads, skills.

### Critical Pitfalls

1. **threads.py god-file compounding (G-5)** -- The 3,843 LOC file has 9+ phases on it. Adding 8 new tool branches inline before extracting the dispatch chain guarantees merge conflicts, cross-provider regressions, and an unnavigable diff. Prevention: tool_dispatcher.py extraction is Phase 0, not optional. Extract the for-tool-calls loop to a new module with a ToolContext dataclass; keep agent_runner in threads.py.

2. **ask_user pause/resume cross-worker failure** -- asyncio.Event is process-local. With WORKER_COUNT=2, the POST /runs/{run_id}/ask_user_response endpoint may land on a different worker than the paused producer task. Prevention: Redis pub/sub on channel ask_user:{run_id}. Add a configurable timeout (default 300s) with a graceful tool result on expiry -- never terminate the run on timeout.

3. **Panel events triggering chat re-renders** -- If new SSE event types flow through the existing setMessagesForBucket path in StreamsProvider, every workspace write triggers full chat message list reconciliation. Prevention: panel state lives in separate Zustand keys (todosByThread, workspaceFilesByThread, workflowStateByThread, askUserPromptByThread), never in bucketsBySurface. The makeStreamCallbacks factory routes by event type before dispatching.

4. **workspace_read content size blowing the context window** -- An agent that writes a 300KB file and later reads it injects approximately 100K tokens. Prevention: cap workspace_read at app_settings.workspace_read_max_chars (recommend 8K chars); return a truncation notice. Binary files return metadata only. Matches Anthropic documented guidance: return only high-signal information.

5. **task tool sub-agent exhaustion** -- Parallel sub-agents each create a new asyncio.Task in RUN_TASKS and a new Redis Stream. Prevention: per-run cap (max_sub_agents_per_run, default 5) + global cap (max_concurrent_sub_agents, default 50). Sub-agents register as children of the parent run; parent _shielded_finalize cascade-cancels children. The task tool must NOT be available to sub-agents (1-level nesting cap).

6. **Insufficient cross-provider UAT on new SSE event types** -- The 075.x cascade (8 insert-phases) happened because new events were only tested on OpenAI. Prevention: SC#10 MANDATORY -- 4-axis UAT matrix (OpenAI x Anthropic x Google x OpenRouter, multi-tool, parallel-thread, long-message) for every phase emitting new SSE event types.

---

## Implications for Roadmap

All research files agree on the same high-level build order, confirmed independently by FEATURES.md dependency graph, ARCHITECTURE.md wave breakdown, PITFALLS.md structural risk section, PROVIDER-BEST-PRACTICES.md integration sequence, and OPEN-SOURCE-LANDSCAPE.md architecture decision checklist.

### Phase 1: Schema + Storage Foundation
**Rationale:** All 11 migrations (125-135) and the workspace-files Storage bucket must exist before any other work. Pure DDL -- zero runtime risk. Storage bucket RLS must be configured in the same migration.
**Delivers:** All 9 new tables; threads and skills altered; workspace-files bucket with matching RLS policies; all indexes including (workspace_file_id, version DESC) for efficient version queries
**Addresses:** Foundation for TS-03, TS-04, TS-08, TS-09
**Avoids:** Pitfall 13 (storage RLS mismatch if split across phases)

### Phase 2: threads.py Tool-Dispatch Extraction (G-5 Mandated Refactor)
**Rationale:** This is the single most dangerous ordering mistake in the milestone if skipped. Not a feature phase -- a prerequisite for every subsequent tool addition. Doing it after any tool ships means the extraction PR conflicts with every tool branch.
**Delivers:** backend/app/services/tool_dispatcher.py with registry-pattern dispatch; typed ToolContext dataclass; existing 16 tools migrated to handler functions; agent_runner calling dispatch_tool() instead of inline elif chain; G-5 satisfied on threads.py
**Addresses:** G-5 guardrail (threads.py 9+ phases); unblocks Phases 3 and 4
**Avoids:** Pitfall 1 (threads.py compounding); cross-provider regression from shared-path changes
**Research flag:** Standard refactor pattern. Skip research-phase -- ARCHITECTURE.md Section 8 provides the extraction strategy.

### Phase 3: Workspace Filesystem Backend
**Rationale:** The panel has nothing to show until the agent can write files. Workspace tools + hybrid storage + REST endpoints + SSE events are the foundation that makes the panel useful. Builds after the tool dispatcher exists.
**Delivers:** workspace_service.py, workspace_file_loader.py; 5 workspace tools registered in tool_dispatcher.py; workspace_file_versions with difflib delta; REST endpoints for files/versions/diff; SSE events (workspace_file_written, workspace_file_deleted)
**Addresses:** TS-03, TS-04, TS-05, TS-10
**Avoids:** Pitfall 4 (workspace_read content cap from day one); Pitfall 11 (path normalization); Pitfall 7 (version accumulation soft cap)
**Research flag:** Skip research-phase -- mirrors Phase 067.4 sandbox-outputs bucket pattern exactly.

### Phase 4: Three New LLM Tools (write_todos, task, ask_user)
**Rationale:** Backend-only phase. These tools emit SSE events the frontend does not yet consume. Shipping before the panel means the backend contract is settled when the panel connects. ask_user is the highest-risk individual item and is isolated here.
**Delivers:** todo_service.py + write_todos tool; task_runner.py + task tool with 1-level nesting cap + sub-agent caps + parent_run_id linkage; ask_user tool with Redis pub/sub pause/resume + POST /runs/{run_id}/ask_user_response + configurable timeout + graceful expiry; run_sub_agent preserved as backward-compat alias
**Addresses:** TS-08, DF-03
**Avoids:** Pitfall 2 (ask_user cross-worker failure -- Redis pub/sub); Pitfall 5 (task exhaustion -- caps); Pitfall 10 (sub_agent migration -- preserve signature)
**Research flag:** Phase research recommended for ask_user. The cleanup path (cancelled run while SUBSCRIBE active, uvicorn shutdown during pause, timeout race with stop button) needs explicit decision records.

### Phase 5: StreamsProvider Extension + Panel Hooks
**Rationale:** Before building panel UI, extend the streaming infrastructure to handle new event types. Panel UI then builds against a working event stream, not stubs.
**Delivers:** New else-if arms in api.ts subscribeToRun parser for all 11 new event types; new StreamCallbacks fields; separate Zustand keys in streamsStore.ts; 4 new hooks with reconcile-on-mount
**Addresses:** TS-07 (SSE-driven real-time updates)
**Avoids:** Pitfall 3 (panel events triggering chat re-renders -- separate Zustand slice); Pitfall 6 (start the 4-provider SSE event matrix here)
**Research flag:** Skip research-phase -- purely additive. ARCHITECTURE.md Section 3.3 diagrams the demux pattern.

### Phase 6: Panel UI Scaffold
**Rationale:** The big visible payoff. By this point backend can write workspace files, manage todos, and pause for user input. G-2 fires -- sketch approval mandatory before planning.
**Delivers:** WorkspacePanel.tsx (collapsible, shadcn Resizable, 4 sections); ChatLayout.tsx split (approximately 70% chat / 30% panel); responsive bottom-sheet on mobile (shadcn Sheet, z-60); panel toggle + keyboard shortcut; TodoSection.tsx, WorkspaceFileBrowser.tsx, WorkflowIndicator.tsx, AskUserPrompt.tsx; localStorage persistence for panel state and active tab
**Addresses:** TS-01, TS-02, TS-05, TS-06, TS-08, DF-03, DF-06
**Avoids:** Pitfall 9 (mobile layout z-index conflict -- panel bottom-sheet z-60, nav drawer z-50; no auto-open on mobile); Pitfall 3 (Zustand shallow selectors per section)
**Research flag:** G-2 MANDATORY -- sketch-before-plan. Test at 375px, 768px, 1024px, 1440px. Chrome MCP drives lived-experience UAT.

### Phase 7: Diff Viewer + File Preview Polish
**Rationale:** Completes the file versioning story and workspace browser experience. Low risk -- pre-computed delta_from_prev JSONB means the backend work is done.
**Delivers:** DiffViewer.tsx rendering delta_from_prev JSONB using existing shiki; 500-hunk / 50KB cap with graceful fallback; default text/markdown preview; file version selector
**Addresses:** TS-04, TS-06, DF-05
**Avoids:** Pitfall 15 (large file diff memory pressure -- cap output, compute at write time)
**Research flag:** Skip research-phase -- standard frontend rendering component.

### Phase 8: Harness Engine + Dual-Mode UX
**Rationale:** The workflow harness depends on Phase 2 (tool dispatcher) for the whitelist enforcement gate. Build after dispatcher and workspace are stable. Scope reduction: ship 3 phase types (llm_single, llm_agent, llm_human_input); defer programmatic + llm_batch_agents.
**Delivers:** harness_engine.py (3 priority phase types, transition logic, validator dispatch, in-memory cache with phase_index version key); workflow REST endpoints; WorkflowIndicator.tsx connected to useWorkflow; dual-mode toggle; skill_modes.harness_required; panel auto-open on workflow start (desktop only)
**Addresses:** DF-06; llm_human_input phase type reinforces DF-03
**Avoids:** Pitfall 8 (whitelist cache staleness -- invalidate cache before emitting transition SSE event); Pitfall 1 (harness whitelist enforcement lives in tool_dispatcher.py as a single pre-dispatch gate)
**Research flag:** Phase research recommended. Validator registry, gate-check result schema, and llm_human_input integration with ask_user mechanism need deeper design before implementation.

### Phase 9: Cross-Cutting Verification + Accessibility
**Rationale:** Full E2E flows, 4-provider UAT matrix, accessibility audit. SC#10 mandatory verification wave. Cannot be compressed or skipped.
**Delivers:** 4-axis UAT matrix (OpenAI x Anthropic x Google x OpenRouter x multi-tool x parallel-thread x long-message) for all new SSE event types; WCAG AA accessibility audit; v2.7-sse-event-matrix.md filled and signed off; cross-PRD decision edits
**Addresses:** Pitfall 6 (cross-provider UAT); all table stakes (final E2E validation)
**Avoids:** 075.x cascade mechanism

### Phase Ordering Rationale

- Schema first: pure DDL, zero runtime risk, everything else depends on it
- Tool-dispatch extraction second: not optional or deferrable -- conflicts with every subsequent tool addition if done later; G-5 mandated
- Workspace backend before panel: panel is a pure consumer; building UI before events exist means building against mocks
- Three new tools in one phase: tool dispatcher contract settled once; ask_user isolated for focused testing
- StreamsProvider extension before panel UI: panel components build against working hooks, not stubs
- Harness after workspace/tools: extends the dispatcher with whitelist enforcement; dispatcher must be clean first
- Verification last but SSE event matrix started in Phase 5 (first phase introducing new event types)

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (ask_user tool):** Redis pub/sub integration with _shielded_finalize cleanup. Edge cases: cancelled run while SUBSCRIBE active, uvicorn shutdown during pause, timeout race with stop button. Needs explicit decision records.
- **Phase 8 (Harness Engine):** Validator registry, gate-check result schema, llm_human_input integration with ask_user mechanism. Most complex single module in milestone.

Phases with well-documented patterns (skip research-phase):
- **Phase 1 (Schema):** Pure DDL following existing migration patterns. ARCHITECTURE.md Section 2.3 provides the complete table spec.
- **Phase 2 (tool_dispatcher extraction):** ARCHITECTURE.md Section 8 provides extraction strategy and ToolContext dataclass design.
- **Phase 3 (Workspace backend):** Mirrors Phase 067.4 sandbox-outputs bucket pattern. ARCHITECTURE.md Section 5.3 provides the exact code template.
- **Phase 5 (StreamsProvider extension):** Purely additive. ARCHITECTURE.md Section 3.3 diagrams the demux pattern.
- **Phase 7 (Diff viewer):** Standard frontend rendering component; pre-computed delta makes it low-risk.
- **Phase 9 (Verification):** SC#10 procedure is defined -- execute the matrix, do not design it.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependency choices verified against npm/PyPI; React 19 compat confirmed. react-resizable-panels v4.11.2 published 2026-05-23. jsonschema 4.26.0 verified on PyPI. |
| Features | HIGH | Competitive landscape verified across 10+ products. Feature boundaries confirmed by PRD Section 10 anti-features. |
| Architecture | HIGH | All integration points verified against live source files (threads.py line numbers, api.ts callback shapes, streamsStore.ts state interface). Anti-patterns grounded in actual code observations. |
| Pitfalls | HIGH | Pitfalls 1-5 grounded in v2.6 incidents (075.x cascade, BUG-260523-01/02/03, multi-worker race conditions). Pitfall 6 is the codified lesson from feedback_regressions_during_075_3_uat.md. |
| Provider compatibility | HIGH | Anthropic, OpenAI, Google primary docs consulted. All 4 new tools are application-layer constructs requiring zero provider-specific handling. |
| Open-source landscape | HIGH | 10 projects analyzed (LibreChat, Open WebUI, LobeChat, Bolt.diy, assistant-ui, OpenHands, LangGraph, Mastra, AutoGen, CrewAI). Patterns converge on our architecture choices. |

**Overall confidence:** HIGH

### Gaps to Address

- **ask_user timeout + cleanup in _shielded_finalize:** The architecture doc describes the happy path. The cleanup path (run cancelled while SUBSCRIBE active, uvicorn shutdown during pause, timeout race with stop button) needs explicit decision records during Phase 4 planning.

- **Tool count budget at v2.7 launch:** Current: 16 tools. Adding 8 new tools = 24 total. Google warns against more than 20. PROVIDER-BEST-PRACTICES.md Section 8 recommends consolidating workspace operations into a single workspace tool with an action parameter and todos into a single todos tool, bringing the total to approximately 18. This is a tool design decision for Phase 3 planning.

- **Harness engine phase-type scope:** The PRD lists 5 phase types. ARCHITECTURE.md recommends shipping 3 (llm_single, llm_agent, llm_human_input) and deferring 2 (programmatic, llm_batch_agents). The roadmapper should confirm this scope reduction -- llm_batch_agents is the fan-out pattern that creates the task-tool exhaustion risk (Pitfall 5).

- **Plugin contract timing:** Plugin contract is DEFERRED to v2.8. However, schema for plugin_registry and plugin_extension_points ships in Phase 1. The registries.py stubs should be created in Phase 2 or 3 to establish the extension seam, even if the loader and manifest validation ship later.

---

## Sources

### Primary (HIGH confidence)
- backend/app/api/threads.py -- _emit() at line 115, agent_runner at line 1381, tool dispatch at line 2548, RUN_TASKS at line 92
- frontend/src/providers/StreamsProvider.tsx -- 1,600 LOC; makeStreamCallbacks at line 214
- frontend/src/stores/streamsStore.ts -- per-thread Maps at lines 47-79
- frontend/src/lib/api.ts -- subscribeToRun parser at line 335; 30+ event type branches
- .planning/PRDs/v2.7.md -- Themes A-H, 11 migrations, 11 phases, approximately 38 plans
- Anthropic official docs: Tool use, Define tools, Streaming, Context windows, Prompting best practices
- Anthropic Engineering: Writing tools for agents, Effective context engineering, Effective harnesses
- OpenAI official docs: Function calling, Streaming, Orchestration and handoffs, Human-in-the-loop
- Google official docs: Function calling

### Secondary (HIGH confidence)
- LibreChat (33.9K stars) -- panel architecture, react-resizable-panels, Monaco migration
- Open WebUI (75K stars) -- version-per-edit model, auto-open fragility
- LobeChat (60K stars) -- Zustand domain-specific stores, optimistic updates
- Bolt.diy (30K stars) -- streaming parser, FilesStore file locking
- assistant-ui (8K stars) -- composable tool UI primitives
- OpenHands (50K stars) -- workspace architecture, event-sourced state
- LangGraph interrupt() -- checkpoint-based pause/resume pattern
- Mastra suspend()/resume() -- bail() path for rejection
- AutoGen UserProxyAgent -- blocking vs. non-blocking HITL patterns
- Claude Code Task tool -- 1-level nesting cap, constrained tools, summary return
- LangGraph Supervisor -- tool-as-delegation pattern
- LangChain TodoListMiddleware -- 4-status todo model, system prompt injection

### Tertiary (MEDIUM confidence)
- Claude.ai Artifacts (2026) -- persistent storage, version history, 20MB limit
- ChatGPT Canvas Complete Guide -- canvas features, version arrows
- Cursor 3 Deep Dive -- Agents Window, parallel agents
- Windsurf 2 Cascade Deep Dive -- Workflows, workspace-scoped memory
- Vercel AI SDK 5 -- UIMessage/ModelMessage separation, SSE as standard

---
*Research completed: 2026-05-27*
*Ready for roadmap: yes*