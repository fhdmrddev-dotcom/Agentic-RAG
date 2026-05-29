# Requirements: Agentic RAG v2.7 — Agent Workspace & Panel

**Defined:** 2026-05-27
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared. v2.7 gives the agent a persistent workspace and a visible panel, making it feel like a real work partner with a desk, not just a chatbot.

## v2.7 Requirements

### Foundation

- [x] **FOUND-01**: Tool dispatch chain extracted from threads.py into a dedicated module with registry-pattern dispatch — all existing 16 tools migrated with zero behavior change
- [x] **FOUND-02
**: 4 open bugs closed: final-output-files-not-persisted (BUG-260526-03), kimi-thinking-leaks-into-content (BUG-260526-02), timer-disappears-mid-cycle (BUG-260526-04), title-generation-broken-deepseek-moonshot-google (BUG-260527-01)

### Workspace Filesystem

- [x] **WS-01**: Agent can write a file to a per-thread workspace via `workspace_write(path, content)` — file persists across turns and thread reloads
- [x] **WS-02**: Agent can read workspace files via `workspace_read(path)` with content capped at configurable max chars and truncation notice for large files
- [x] **WS-03**: Agent can list workspace files via `workspace_list(prefix)` and delete via `workspace_delete(path)`
- [x] **WS-04**: Every workspace_write auto-creates a new version row; `workspace_diff(path, from_version, to_version)` returns a structured diff
- [x] **WS-05**: Files up to a configurable threshold stored inline in Postgres; larger files uploaded to a Supabase Storage bucket — threshold tunable via app_settings
- [x] **WS-06**: Workspace files scoped per-thread with unique path constraint and RLS — user cannot read another user's workspace files
- [x] **WS-07**: SSE events emitted for workspace file writes and deletes via existing run:{run_id} Redis Stream

### New LLM Tools

- [x] **TOOL-01**: `write_todos` tool persists a todo list per thread; emits SSE event on update; panel renders the change without re-fetch
- [x] **TOOL-02**: `task` tool spawns a sub-agent with constrained tool list, single-level nesting cap, and configurable concurrency limits (per-run and global)
- [x] **TOOL-03**: `ask_user` tool pauses the agent loop, emits a prompt via SSE, user responds via the panel, and the agent resumes with the response in tool_result
- [x] **TOOL-04**: `ask_user` operates safely across multiple workers (cross-worker coordination) with configurable timeout and graceful expiry when the user doesn't respond

### Panel UI

- [x] **PANEL-01**: Right-side panel (~30% width) next to chat, collapsible via button and keyboard shortcut, renders as bottom-sheet on mobile screens (<768px)
- [x] **PANEL-02**: Todos section renders live todo list from write_todos tool with status indicators (pending, in-progress, completed)
- [x] **PANEL-03**: Workspace file browser lists files with click-to-preview for text, markdown, and code using existing renderers
- [x] **PANEL-04**: Pending user input section renders ask_user prompts with optional choice buttons and free-text field
- [ ] **PANEL-05**: Panel subscribes to the same SSE stream as chat via StreamsProvider Context — single subscription, demultiplexed by event type, no duplicate connections
- [ ] **PANEL-06**: Panel events route to separate state stores — no chat message list re-renders triggered by panel updates
- [x] **PANEL-07**: Diff viewer for workspace file versions with syntax highlighting, rendering pre-computed version deltas

### Accessibility

- [ ] **A11Y-01**: All panel surfaces meet WCAG 2.1 AA — keyboard navigation, ARIA labels, minimum 4.5:1 contrast ratio, visible focus indicators
- [ ] **A11Y-02**: File browser and todo list fully navigable via keyboard without any mouse-only interaction paths

## Future Requirements (v2.8 — Harness Engine & Plugin Contract)

- **HARNESS-01**: State-machine workflow runtime with 5 phase types, validation gates, and tool-whitelist enforcement
- **HARNESS-02**: Workflow definitions table with immutable-on-publish semantics (mirrors skill versioning)
- **HARNESS-03**: Workflow runs persist phase state to Postgres — survive uvicorn restarts
- **PLUGIN-01**: Plugin contract with 6 extension types (tool, panel_renderer, phase_type, file_preview, data_source, secrets_adapter)
- **PLUGIN-02**: Plugin manifest JSON-Schema validation on install; super_admin-only writes
- **PLUGIN-03**: Reference plugin (PPTX preview) validates the contract end-to-end
- **MODE-01**: Dual-mode UX (Deep Mode vs Harness Mode) with mid-thread switching and workflow-lock semantics

## Out of Scope

| Feature | Reason |
|---------|--------|
| User inline editing of workspace files | Write-conflict complexity; agent-writes / user-reads for v1; natural v2.8 follow-up |
| Visual workflow builder (drag-and-drop) | Harness engine deferred to v2.8; visual builder is polish layer on top |
| Real-time co-editing (CRDT) | No demand signal; massive complexity disjoint from workspace |
| Workspace files as RAG corpus | Chunk-store pollution; AI-generated content would degrade search accuracy |
| Live HTML/React rendering in panel | XSS surface; deferred to plugin system with sandboxed renderers |
| Auto-open panel on every response | Anti-pattern per open-source research (Open WebUI); users find it annoying for Q&A |
| Plugin sandbox isolation (WASM) | Deferred to v3.5+ marketplace where untrusted plugins matter |
| Workspace file cross-thread sharing | Per-thread scoping is simpler; cross-thread sharing adds permission complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 083 | Complete |
| FOUND-02 | Phase 083 | Complete |
| WS-01 | Phase 084 | Complete |
| WS-02 | Phase 084 | Complete |
| WS-03 | Phase 084 | Complete |
| WS-04 | Phase 084 | Complete |
| WS-05 | Phase 084 | Complete |
| WS-06 | Phase 084 | Complete |
| WS-07 | Phase 084 | Complete |
| TOOL-01 | Phase 085 | Complete |
| TOOL-02 | Phase 085 | Complete |
| TOOL-03 | Phase 085 | Complete |
| TOOL-04 | Phase 085 | Complete |
| PANEL-01 | Phase 087 | Complete (087-02) |
| PANEL-02 | Phase 087 | Complete (087-02) |
| PANEL-03 | Phase 087 | Complete |
| PANEL-04 | Phase 087 | Complete (087-05) |
| PANEL-05 | Phase 086 | Pending |
| PANEL-06 | Phase 086 | Pending |
| PANEL-07 | Phase 087 | Complete (087-04) |
| A11Y-01 | Phase 088 | Pending |
| A11Y-02 | Phase 088 | Pending |

**Coverage:**
- v2.7 requirements: 22 total
- Mapped to phases: 22/22
- Unmapped: 0

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-28 after roadmap creation — all 22 requirements mapped to phases 083-088*
