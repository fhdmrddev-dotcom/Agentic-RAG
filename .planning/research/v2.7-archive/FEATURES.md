# Feature Landscape: Agent Workspace & Panel

**Domain:** Per-thread workspace filesystem + right-side panel for AI agent platforms
**Researched:** 2026-05-27
**Overall confidence:** HIGH (multiple products verified, competitive landscape well-documented)

---

## Competitive Landscape Summary

The "right-side panel with agent-generated artifacts" pattern has become the dominant UX for AI chat products in 2025-2026. Claude.ai Artifacts (June 2024, expanded through 2026), ChatGPT Canvas (October 2024, free for all in 2025), Google Gemini Canvas (2025-2026), and the IDE agents (Cursor 3 Agents Window, Windsurf Cascade, VS Code Copilot Agents Window) all ship variations. Users arriving at any new AI chat product in 2026 carry expectations set by these products.

**Key insight:** The panel itself is no longer a differentiator -- it is table stakes. What differentiates is *what the panel can do* and *how it integrates with the agent's execution model*. Claude.ai and ChatGPT both have panels; neither has a plugin contract, deterministic workflow harness, or multi-provider support. That is where Agentic RAG v2.7 should invest.

---

## Table Stakes

Features users expect from an AI agent with a side panel in 2026. Missing = product feels incomplete or outdated.

| # | Feature | Why Expected | Complexity | Existing System Dependency | Competitive Precedent |
|---|---------|--------------|------------|---------------------------|----------------------|
| TS-01 | **Right-side panel (collapsible, ~30% width)** | Every major AI chat product ships this. Users expect artifact/workspace content to appear beside chat, not inline. | Medium | Layout change to App.tsx; no existing panel component exists. Mobile: bottom-sheet on <768px matches Aether responsive patterns. | Claude.ai artifacts pane, ChatGPT canvas, Gemini Canvas, Cursor Agents Window, VS Code Copilot Agents Window |
| TS-02 | **Panel toggle (button + keyboard shortcut)** | Users switch rapidly between full-chat and panel-visible modes. Claude.ai and ChatGPT both have one-click toggles. Keyboard shortcut is expected by power users (IDE-trained). | Low | Header component + keybinding. | Claude.ai toggle, ChatGPT Canvas auto-open, Cursor Cmd+\ |
| TS-03 | **Agent writes files to a persistent workspace** | Claude.ai artifacts persist across sessions (up to 20MB). ChatGPT Canvas documents persist. Users expect the agent's output to survive page refresh and session boundaries. | High | New `workspace_files` table + `workspace_file_versions` table + Storage bucket. Hybrid inline/bucket storage per PRD Theme A. Rides existing Supabase infra. | Claude.ai artifacts (persistent storage, 20MB), ChatGPT Canvas (version history), Devin workspace (resets between runs -- a negative precedent) |
| TS-04 | **File version history with undo/restore** | ChatGPT Canvas ships version history with back-button navigation. Claude.ai tracks artifact revisions. Users expect to step back through edits. | Medium | `workspace_file_versions` table with auto-increment per write. PRD specifies auto-version every write (Q-v2.7-02 recommendation a). | ChatGPT Canvas version arrows, Claude.ai artifact version history |
| TS-05 | **File browser / list in panel** | When the agent creates multiple files, users need to see what exists and navigate between them. Tree-view or flat list with path display. | Medium | New `useWorkspaceFiles(threadId)` hook reading from StreamsProvider Context. File list API endpoint already specified in PRD. | Cursor Files tab, VS Code Copilot Agents Window file explorer, Baton full file tree |
| TS-06 | **Live preview for text/markdown/code files** | Clicking a file in the browser should show its content. Text, Markdown, and code are the minimum. Claude.ai renders React/HTML live; ChatGPT renders code with syntax highlighting. | Medium | Default text/markdown renderer ships in core per PRD Theme D. Can reuse existing `MarkdownRenderer.tsx`. Code: can reuse `ShikiCode` from Phase 075.8. | Claude.ai artifact live rendering, ChatGPT Canvas code/text display, VS Code Copilot inline preview |
| TS-07 | **SSE-driven real-time updates to panel** | The panel must update as the agent writes files, updates todos, or emits workflow events -- without polling. Users are trained by Claude.ai and ChatGPT to expect instant visual feedback. | Medium | **This is the payoff of v2.6's StreamsProvider lift.** Panel subscribes to the SAME `run:{run_id}` Stream as chat via existing `<StreamsProvider>` Context. Event-type demultiplexer dispatches workspace/todo/workflow events to panel consumers. Zero new infrastructure. | Claude.ai real-time artifact updates, ChatGPT Canvas instant edit reflection |
| TS-08 | **Todo list display** | Agent-managed todo/task lists are emerging as standard. Users expect to see structured task progress. Display is table stakes; interactive editing is a differentiator. | Low-Medium | New `todos` table + `write_todos` tool + `useTodos(threadId)` hook. Read-only display in panel (status flip from UI is explicitly out of scope in v1 per PRD). | Cursor task lists, Devin step-by-step plans, Windsurf Workflow steps |
| TS-09 | **Agent workspace scoped per-thread** | Each chat thread has its own isolated workspace. Users expect that switching threads shows that thread's files, not a global dump. | Low | PRD specifies per-thread scoping via `workspace_files.thread_id` FK + RLS. Matches existing per-thread `sandbox_files` pattern. | Claude.ai per-conversation artifacts, ChatGPT per-conversation canvas, Devin per-session workspace |
| TS-10 | **Download workspace files** | Users need to export agent-created files to their local machine. Claude.ai artifacts are downloadable; ChatGPT Canvas supports copy/export. | Low | Mirrors existing `OutputFileCard.tsx` download pattern from Phase 075. Signed-URL from Supabase Storage for large files; inline content served directly. | Claude.ai artifact download, ChatGPT Canvas copy/export |

---

## Differentiators

Features that set the product apart. Not expected by default, but valued when present. These are where v2.7 should invest for competitive positioning.

| # | Feature | Value Proposition | Complexity | Existing System Dependency | Competitive Gap |
|---|---------|-------------------|------------|---------------------------|----------------|
| DF-01 | **Multi-provider panel (same UX, any LLM)** | Claude.ai artifacts work only with Claude. ChatGPT Canvas works only with GPT. Agentic RAG's panel works with OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, etc. This is a binary win: no competitor ships a provider-agnostic artifact panel. | Low (architectural -- already solved by v2.6 multi-provider routing) | Inherits `MODEL_CAPABILITIES` registry + provider-agnostic SSE vocabulary from v2.5/v2.6. Panel consumes events, not provider-specific data. | **Binary win** -- Claude.ai is Anthropic-only, ChatGPT is OpenAI-only, Gemini is Google-only. Zero competitors ship multi-provider workspace panels. |
| DF-02 | **Self-hostable workspace** | Claude.ai and ChatGPT are closed SaaS only. Organizations wanting data sovereignty cannot use them. Agentic RAG's workspace runs on-prem via existing Supabase Docker + Redis Docker stack. | Low (architectural -- inherits existing self-host posture) | Supabase local Docker, existing deployment model. | **Binary win** -- no closed competitor is self-hostable. Glean offers on-prem but has no agent workspace at all. |
| DF-03 | **ask_user tool (human-in-the-loop pause/resume)** | The agent pauses mid-execution to ask the user a question, rendered as an actionable prompt in the panel with optional choice buttons. Neither Claude.ai nor ChatGPT Canvas ship this as a first-class tool -- they rely on the user typing in chat to redirect. | High | New `ask_user` tool + `ask_user_prompt` SSE event + `POST /runs/{run_id}/ask_user_response` endpoint + `useAskUserPrompt(threadId)` hook. Must pause/resume the agent loop cleanly. | Claude.ai has no native human-in-the-loop pause. ChatGPT has no ask-user tool. Cursor/Windsurf have approval gates for tool use but not structured prompts. LangGraph supports `interrupt()` but that is a framework primitive, not a UX surface. |
| DF-04 | **task tool (sub-agent spawning from chat)** | User or agent can spawn delegated sub-agents for parallel work. Replaces ad-hoc per-skill `run_sub_agent` calls with a single canonical tool. Sub-agent streams to its own run. | High | Refactors existing `sub_agent_service.py:17`. New `run:{sub_run_id}` Stream per sub-agent. Already architecturally supported by run-backed streaming. | OpenAI Codex ships subagents (March 2026 GA). Claude Code has agent spawning. Neither is available in a chat-first (non-IDE) AI product. Agentic RAG would be first chat-based product with user-visible sub-agent spawning. |
| DF-05 | **Diff viewer for file versions** | Side-by-side or inline diff of workspace file versions. ChatGPT Canvas has "Show Changes" (red/green highlighting) but only for the latest edit. A full version diff viewer (pick any two versions) goes beyond. | Medium | `workspace_file_versions.delta_from_prev` JSONB + Python `difflib` on backend. Frontend diff rendering component needed (new). | ChatGPT Canvas has basic "Show Changes" toggle. Claude.ai has no diff viewer. VS Code Copilot Agents Window has full diff (but it is an IDE, not a chat product). Cursor has per-commit diffs. |
| DF-06 | **Harness workflow phase indicator in panel** | When a deterministic workflow is active, the panel shows a progress indicator with phase names, types, statuses, and gate-check results. No competitor ships this in a chat-first product. | Medium | New `useWorkflow(threadId)` hook + workflow SSE events. Only renders when `threads.active_workflow_run_id IS NOT NULL`. | **Unique** -- no chat-first competitor has deterministic workflow visualization. Cursor/Windsurf have agent step indicators but not locked-phase state machines. |
| DF-07 | **Plugin-extensible panel sections** | Third-party plugins can register custom panel renderers (e.g., legal clause viewer, financial model table). The `panel_renderer` extension type in the Plugin Contract. | High | New Plugin Contract (Theme E). `plugin_extension_points` table + dynamic import of bundled JS modules. | **Unique in chat-first products.** IDE extensions (VS Code, Cursor) support panel extensions, but no chat-based AI product has a formal plugin contract for panel rendering. |
| DF-08 | **Plugin-extensible file previews** | Custom renderers for workspace files by MIME type (PPTX, DICOM, IFC, etc.) via the `file_preview` extension type. Default text/markdown/json ships in core; everything else is pluggable. | Medium | Plugin Contract + FILE_PREVIEW_REGISTRY. Reference plugin (PPTX preview) validates the contract per PLUGIN-REF-01. | No competitor ships pluggable file preview renderers in a chat panel. Claude.ai renders HTML/React/SVG natively but cannot be extended. |
| DF-09 | **Workspace files are NOT in the RAG corpus** | Deliberate separation: workspace files are per-thread scratchpad artifacts, not searchable corpus documents. This prevents chunk-store explosion and retrieval confusion. The `data_source` plugin extension type is the future seam if someone explicitly wants workspace-as-RAG. | Low (design decision, not code) | No additional work -- workspace files live in a separate table with no vector embeddings. | Claude.ai artifacts are not in search either. This is a correct default that avoids a common trap. |

---

## Anti-Features

Features to explicitly NOT build. Each has been considered and rejected with rationale.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|-------------|-----------|-------------------|
| AF-01 | **Real-time multi-user co-editing of workspace files (CRDTs / Google Docs style)** | No demand signal. CRDT infrastructure is massive complexity that does not compose with run-backed streaming. Listed as rejected in PRD Section 10 entry 4 and carried across v2.6 and v3.0 PRDs. | Single-writer model: agent writes, user reads. User can download and edit locally. Re-trigger: vertical-pack customer explicitly asks, or Claude.ai ships it. |
| AF-02 | **User inline editing of workspace files in the panel** | Claude.ai added inline artifact editing (March 2026), but it creates a conflict model: who wins when the user edits line 5 and the agent simultaneously writes line 5? ChatGPT Canvas solves this with a "one editor at a time" model, but it is a significant UX complexity. v1 should be read-only panel display with agent-only writes. | Read-only display in panel. User provides feedback via chat or `ask_user` responses. Re-trigger: post-v2.7 user demand or Claude.ai's editing UX proves adoption-worthy. |
| AF-03 | **Workspace files as RAG corpus** | Would explode chunk store linearly with thread count. Confuses retrieval surface (workspace chunks interleave with document chunks). Most workspace files are ephemeral plans/notes, not reference material. See PRD Section 10 entry 6. | Keep workspace and document corpus separate. The `data_source` plugin extension type is the future seam for an opt-in "workspace-as-RAG" plugin. |
| AF-04 | **Visual drag-and-drop workflow builder** | Significant scope (canvas React component + edge routing + drag-drop UX + validation overlay). v1 workflow definitions are authored via API/migration as JSON. Deferred to v2.7.5. | API-driven workflow definition authoring. Seed example workflows shipped via migration. Re-trigger: first non-developer user needs to author workflows. |
| AF-05 | **Automatic panel opening on every agent response** | ChatGPT Canvas auto-opens aggressively, which annoys users doing simple Q&A. The panel should respect user intent. | Default: closed in Deep Mode, open in Harness Mode (auto-opens on workflow start). User can toggle manually. Only auto-open on workspace-mutating events or ask_user prompts if panel is hidden. |
| AF-06 | **Live rendering of agent-generated HTML/React in panel** | Claude.ai's signature feature. Implementing a sandboxed React/HTML renderer is a large security surface (XSS, CSP, sandboxed iframes). Not worth the complexity for v1. | Render text/markdown/code with syntax highlighting. Defer live HTML rendering to a `file_preview` plugin (could ship post-v2.7). |
| AF-07 | **Panel replacing the chat surface** | ChatGPT Canvas sometimes replaces the chat entirely with the editing canvas. This breaks the mental model for users who expect persistent chat history. | Panel is always beside chat, never replacing it. ~70% chat / ~30% panel split. Full-screen panel is a toggle for focus, not a mode switch. |
| AF-08 | **Todo list interactive editing from panel** | Allowing users to check/uncheck todos from the panel creates a state-sync problem (user marks done, but agent doesn't know). v1 todos are agent-managed, panel is read-only. | Read-only todo display. Agent manages state via `write_todos` tool. Re-trigger: v2.8+ polish -- requires a UI-to-agent feedback loop. |
| AF-09 | **LangGraph for workflow orchestration** | Project rule explicitly forbids LangGraph (`CLAUDE.md` -- "No LangChain, no LangGraph -- raw SDK calls only"). The 5-phase-type state machine is well within hand-rolled scope. | Direct Python state machine in `harness_engine.py`. Re-trigger: project rule changes (would require D-PRD-NN decision). |

---

## Feature Dependencies

```
Dependency graph (arrows mean "requires"):

workspace_files table (TS-03) --> File browser (TS-05)
workspace_files table (TS-03) --> File preview (TS-06)
workspace_files table (TS-03) --> File version history (TS-04)
workspace_files table (TS-03) --> Diff viewer (DF-05)
workspace_files table (TS-03) --> Download (TS-10)

StreamsProvider Context (EXISTING) --> Panel real-time updates (TS-07)
StreamsProvider Context (EXISTING) --> Todo live display (TS-08)
StreamsProvider Context (EXISTING) --> Workflow phase indicator (DF-06)
StreamsProvider Context (EXISTING) --> ask_user prompt display (DF-03)

Panel scaffold (TS-01) --> File browser (TS-05)
Panel scaffold (TS-01) --> Todo display (TS-08)
Panel scaffold (TS-01) --> Workflow indicator (DF-06)
Panel scaffold (TS-01) --> ask_user prompt (DF-03)

todos table --> write_todos tool (TS-08)
write_todos tool (TS-08) --> Todo display in panel (TS-08)

ask_user tool (DF-03) --> ask_user_response endpoint
ask_user_response endpoint --> agent loop resume

Plugin Contract (DF-07) --> Plugin panel sections (DF-07)
Plugin Contract (DF-07) --> Plugin file previews (DF-08)
Plugin Contract (DF-07) --> Reference plugin / PPTX preview (DF-08)

Harness Engine (backend) --> Workflow indicator (DF-06)
Harness Engine (backend) --> Phase-gated tool dispatch
```

**Critical path:** Schema migrations --> Workspace tools + storage --> Panel scaffold --> Panel sections (file browser, todos, workflow, ask_user)

**Parallelizable after schema:** The three new LLM tools (write_todos, task, ask_user) can be built in parallel with workspace tools and the harness engine, since they share only the schema layer.

---

## MVP Recommendation

**Phase ordering rationale based on feature dependencies:**

1. **Schema + migrations first** (all 11 migrations): Unblocks every downstream feature. Zero runtime risk; pure DDL.

2. **Workspace tools + storage adapter second**: The agent's ability to write/read files is the foundation that makes the panel useful. Without files in the workspace, the panel has nothing to show.

3. **Harness engine scaffold third** (or parallel with #2): The state machine + phase types + tool-dispatcher enforcement are backend-only and independent of the panel UI. Building them early means the panel can render workflow state when it ships.

4. **Three new LLM tools fourth** (or parallel with #2/#3): `write_todos`, `task`, `ask_user` are backend tool registrations that emit SSE events. They can ship before the panel renders those events (events would just be unhandled on the frontend until the panel ships).

5. **Panel UI scaffold fifth**: This is the big visible payoff. By this point, the backend can write workspace files, manage todos, run workflows, and pause for user input. The panel wires up all four sections.

6. **Diff/preview UI sixth**: Polish on the file browser. Depends on workspace files + panel scaffold.

7. **Plugin contract seventh**: The extension point system. Depends on the harness engine (for `phase_type` extensions) and the panel (for `panel_renderer` extensions). Ships after core functionality is proven.

8. **Dual-mode UX eighth**: Deep Mode vs Harness Mode toggle. Depends on harness engine + panel + plugin contract.

9. **Reference implementations ninth**: Seed workflows + PPTX preview plugin. Validates the contract end-to-end.

10. **Cross-cutting verification last**: Full E2E flows, accessibility audit, cross-PRD edits.

**Prioritize for MVP (must-ship):**
1. TS-01 through TS-10 (all table stakes)
2. DF-01, DF-02 (free -- inherited from architecture)
3. DF-03 (ask_user -- highest-value differentiator for agent UX)
4. DF-05 (diff viewer -- completes the file versioning story)
5. DF-06 (workflow indicator -- makes the harness visible)

**Defer to post-v2.7 polish:**
- DF-07, DF-08 (plugin panel/preview extensibility -- valuable but can be a fast-follow)
- AF-02 reconsideration (user inline editing -- wait for demand signal)

---

## Complexity Assessment

| Feature | Backend | Frontend | Schema | Risk |
|---------|---------|----------|--------|------|
| Panel layout (TS-01) | None | High (new layout component, responsive breakpoints, collapse/expand, keyboard shortcut) | None | Medium -- layout changes can break existing chat rendering |
| Workspace files (TS-03) | High (hybrid storage service, 5 new tools, version management) | Low (consumed via hooks) | High (2 tables + bucket + RLS) | Medium -- hybrid storage has two code paths |
| File browser (TS-05) | Low (existing API) | Medium (tree view or flat list with path navigation) | None | Low |
| File preview (TS-06) | Low | Medium (reuse MarkdownRenderer + ShikiCode) | None | Low |
| Diff viewer (DF-05) | Medium (difflib delta generation) | High (diff rendering component, hunk navigation) | None | Medium -- diff UX is hard to get right |
| Todo display (TS-08) | Medium (new tool + table) | Medium (nested list with status indicators) | Low (1 table) | Low |
| ask_user (DF-03) | High (agent loop pause/resume, new endpoint, timeout handling) | Medium (prompt renderer with choices + free text) | None | **High** -- pausing/resuming the agent loop mid-execution is novel and error-prone |
| task tool (DF-04) | High (sub-agent spawning, sub-run lifecycle) | Low (consumed via existing run events) | None | **High** -- sub-agent lifecycle management is complex |
| Harness engine (DF-06 backend) | Very High (state machine, 5 phase types, validator registry, tool-dispatcher enforcement, phase persistence) | None directly | High (3 tables + audit table) | **High** -- largest single module; state machine correctness is critical |
| Plugin contract (DF-07/08) | High (manifest validation, 6 extension registries, loader) | Medium (dynamic import for panel_renderer/file_preview) | Medium (2 tables) | **High** -- extension API surface area is large |
| Dual-mode UX (Mode switching) | Medium (mode detection, workflow auto-entry) | Medium (toggle UI, panel auto-open, cancel affordance) | Low (threads ALTER) | Medium -- mid-thread mode switching has edge cases |

---

## Sources

### Competitive Products (verified via WebSearch, May 2026)
- [Claude.ai Artifacts Guide (2026)](https://albato.com/blog/publications/how-to-use-claude-artifacts-guide) -- persistent storage up to 20MB, version history, Live Artifacts (April 2026)
- [Claude Live Artifacts Guide](https://www.eigent.ai/blog/claude-live-artifacts-guide) -- Live Artifacts with data source connections, persistent state
- [Claude Artifacts Help Center](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) -- official feature documentation
- [Claude Artifacts Features 2026 (limitations)](https://p0stman.com/guides/claude-artifacts-limitations) -- what Claude artifacts can and cannot do
- [ChatGPT Canvas Complete Guide (2026)](https://instapods.com/blog/what-is-chatgpt-canvas/) -- canvas features, version history, availability
- [OpenAI Canvas Help Center](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it) -- official feature documentation
- [ChatGPT Canvas vs Claude Artifacts Comparison](https://aismartventures.com/posts/chatgpt-canvas-vs-claude-artifacts-which-ai-collaboration-feature-is-better-for-teams/) -- head-to-head feature comparison
- [Claude Artifacts vs ChatGPT Canvas (2026)](https://www.shareduo.com/blog/claude-artifacts-vs-chatgpt-canvas) -- side-by-side comparison
- [Cursor 3 Deep Dive (2026)](https://www.digitalapplied.com/blog/cursor-3-deep-dive-agents-composer-review-2026) -- Agents Window, parallel agents, file changes panel
- [Windsurf 2 Cascade Deep Dive (2026)](https://www.digitalapplied.com/blog/windsurf-2-deep-dive-cascade-agents-flows-2026) -- Workflows, workspace-scoped memory
- [VS Code Copilot Agents Window](https://code.visualstudio.com/docs/copilot/agents/agents-window) -- Files tab, Changes tab, diff view
- [Google Gemini Canvas](https://gemini.google/overview/canvas/) -- write, code, create in one space
- [Gemini Workspace Side Panel (2026)](https://workspaceupdates.googleblog.com/2026/02/gemini-conversation-history-is-coming-to-side-panel-in-google-workspace.html) -- conversation history persistence
- [Devin AI File Management](https://fast.io/resources/devin-ai-file-management/) -- workspace reset behavior, file persistence strategies
- [OpenAI Codex Subagents](https://developers.openai.com/codex/subagents) -- sub-agent spawning, parallel execution
- [AI Agent UX Patterns](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/) -- taskboard pattern, receipts, control plane as primary experience
- [Human-in-the-Loop UX Patterns](https://www.bprigent.com/article/7-ux-patterns-for-human-oversight-in-ambient-ai-agents) -- pause/approve/resume patterns
- [Where AI Should Sit in UI (UX Collective)](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e) -- right-hand panel as assistive design pattern
- [AI Diff Review (Nimbalyst)](https://nimbalyst.com/blog/ai-diff-review-visual-agent-changes/) -- visual diff review for agent changes

### Project Documents
- `.planning/PROJECT.md` -- current milestone definition, validated requirements, key decisions
- `.planning/PRDs/v2.7.md` -- full v2.7 PRD (Themes A-H, 8 pre-execution decisions, 11 phases)
- `frontend/src/providers/StreamsProvider.tsx` -- existing v2.6 StreamsProvider Context (second consumer payoff surface)
- `frontend/src/components/chat/OutputFileCard.tsx` -- existing file download pattern
- `frontend/src/components/chat/MarkdownRenderer.tsx` -- existing markdown rendering (reusable for file preview)
