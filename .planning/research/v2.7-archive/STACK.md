# Technology Stack: v2.7 Agent Workspace & Panel

**Project:** Agentic RAG
**Researched:** 2026-05-27
**Scope:** NEW dependencies only for workspace filesystem, right-side panel, and 3 new LLM tools

---

## Recommended Stack Additions

### Frontend: New Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-resizable-panels` | `^4.11.2` | Resizable chat/panel split layout | shadcn/ui's `Resizable` component wraps this library. Already the ecosystem standard for VS Code-style resizable panels. React 19 compatible. Authored by Brian Vaughn (React DevTools author). The project already uses shadcn/ui (15 components installed) so this is the natural fit -- add the shadcn Resizable component which pulls this as its underlying dependency. |

### Frontend: New shadcn/ui Components (zero new npm deps)

These are shadcn/ui components that need to be added via `npx shadcn add <name>`. They use Radix UI primitives already in `package.json` -- no new npm packages, just new component files in `frontend/src/components/ui/`.

| Component | Purpose | Why Not Build Custom |
|-----------|---------|---------------------|
| `resizable` | Chat (~70%) + Panel (~30%) split layout | Wraps `react-resizable-panels` with Aether-compatible styling. The only new npm dep from this section. |
| `sheet` | Mobile bottom-sheet for panel on <768px screens | Radix Dialog-based. Uses `@radix-ui/react-dialog` already installed. The `side="bottom"` prop gives the PRD's mobile bottom-sheet requirement. Responsive side switching (right on desktop, bottom on mobile) is built-in. |
| `checkbox` | Todo item status display in panel | Uses `@radix-ui/react-checkbox`. Radix is already a project dependency. WCAG AA keyboard + ARIA support baked in. |
| `badge` | Phase status indicators (completed/active/failed/pending) in workflow panel | Pure Tailwind component, no Radix dependency. Variant-based via CVA (already installed). |
| `accordion` | Collapsible panel sections (Todos / Plan / Workspace / Pending Input) | Uses `@radix-ui/react-accordion`. Keyboard navigation + ARIA landmark regions for screen readers (ACCESSIBILITY-01). Not installed yet; needs `@radix-ui/react-accordion` added. |
| `progress` | Phase progress bar in workflow panel | Uses `@radix-ui/react-progress`. Visual phase-completion indicator. Not installed yet; needs `@radix-ui/react-progress` added. |

### Frontend: Diff Viewer Decision

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **None (build custom)** | n/a | Workspace file diff viewer | The PRD states the backend stores `delta_from_prev jsonb` using Python stdlib `difflib`. The diff is **pre-computed server-side** and sent as structured JSON (added/removed lines with line numbers). A custom React component rendering this JSON is ~100-150 LOC with syntax highlighting via the existing `shiki` dependency (already at `^4.1.0`). External diff libraries (`react-diff-viewer-continued`, `@git-diff-view/react`) all have React 19 compatibility issues -- the main `react-diff-viewer-continued` has an open issue (#63) for React 19 peer dep support. Building custom avoids the dep risk and is simpler since the diff computation is already done server-side. |

### Backend: New Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `jsonschema` | `>=4.23.0,<5` | Plugin manifest JSON-Schema validation | The PRD requires JSON-Schema draft 2020-12 validation of plugin manifests on install (`backend/plugins/manifest_schema.json`). Pydantic generates JSON schemas but does NOT validate arbitrary JSON against JSON-Schema specs (confirmed via Pydantic GitHub discussion #5135). `jsonschema` is the canonical Python implementation, supports draft 2020-12, requires Python >=3.10. NOT a transitive dependency of any existing package (verified: `import jsonschema` fails in current venv). |

### Backend: No-New-Dep Capabilities (stdlib + existing)

| Capability | Implementation | Why No New Dep |
|------------|---------------|----------------|
| Workspace file diffing | Python stdlib `difflib.unified_diff()` | PRD Section 5 explicitly says "Hashing for `workspace_file_versions.delta_from_prev` uses stdlib `difflib`". Store structured delta as JSONB. No external diff library needed. |
| Harness state machine | Hand-rolled Python module (`harness_engine.py`) | Project rule: "No LangChain, no LangGraph -- raw SDK calls only". The 5 phase types + transition logic + validator dispatch is well within hand-rolled scope (~500-800 LOC). |
| Workspace hybrid storage | Existing `supabase-py` + Supabase Storage | Mirrors Phase 067.4 sandbox-outputs bucket pattern. New `workspace-files` Storage bucket, same signed-URL discipline. Zero new deps. |
| `ask_user` pause/resume | `asyncio.Event` in agent_runner | The agent loop already uses `asyncio.Queue` for SSE bridging (threads.py:250, 2864). `asyncio.Event` is the clean primitive for pause/resume: `event.clear()` on ask_user emit, `await event.wait()` blocks the agent loop, `event.set()` on user response. Stdlib, no dep. |
| Todo persistence | Existing `supabase-py` / `asyncpg` | Simple CRUD to new `todos` table. Follows existing patterns. |
| Sub-agent spawning (`task` tool) | Existing `sub_agent_service.py` generalization | Refactor existing `run_sub_agent` into canonical `task` tool. Same `asyncio.Queue` bridge, same Redis Stream producer pattern. |
| Plugin registries | Python dicts + Pydantic models | `PHASE_TYPE_REGISTRY`, `TOOL_PLUGIN_REGISTRY`, etc. are plain Python dicts mapping slugs to callables. Manifest shape validated by `jsonschema`; runtime config validated by Pydantic models. |
| SSE event types | Existing `_emit()` XADD helper | All new events (`workspace_file_written`, `workflow_phase_start`, `todo_updated`, `ask_user_prompt`, etc.) ride existing `run:{run_id}` Redis Stream via the same `_emit(redis, run_id, type, **fields)` at threads.py:115. Zero new infrastructure. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Panel layout | shadcn Resizable (`react-resizable-panels`) | CSS Grid with manual drag handle | react-resizable-panels handles edge cases (min/max sizes, keyboard resize, persistence, SSR) that a manual implementation would need to re-invent. shadcn wraps it into the project's design system. |
| Panel layout | shadcn Resizable | `allotment` npm package | Less ecosystem adoption. shadcn/ui already wraps react-resizable-panels -- using a different lib breaks the component library coherence. |
| Mobile panel | shadcn Sheet (bottom-sheet) | Vaul drawer component | Vaul is popular but adds a new dependency. shadcn Sheet already supports `side="bottom"` via Radix Dialog. The project uses Radix throughout -- stay consistent. |
| Diff viewer | Custom (shiki + structured JSONB) | `react-diff-viewer-continued` | React 19 peer dep incompatibility (open issue #63). Would require `--legacy-peer-deps` or a fork. Not worth the risk for a component that only needs to render pre-computed deltas. |
| Diff viewer | Custom | `@git-diff-view/react` | Feature-rich but overkill -- designed for full git-style diffs with syntax highlighting engines. Our diffs are workspace text files with pre-computed deltas. |
| Plugin manifest validation | `jsonschema` | Pydantic model validation | Pydantic validates Python objects, not arbitrary JSON against JSON-Schema specs. Plugin manifests are user-authored JSON that must validate against a published schema file (`manifest_schema.json`). `jsonschema` is the right tool. |
| Plugin manifest validation | `jsonschema` | `fastjsonschema` | Faster but generates validator functions at build time. `jsonschema` is more Pythonic, has better error messages, and the validation only runs on plugin install (not hot path). Speed irrelevant. |
| State machine | Hand-rolled | LangGraph | Project rule forbids it. Also: LangGraph would metastasize once introduced and the state machine is intentionally simple (5 phase types, linear progression). |
| State machine | Hand-rolled | `transitions` Python lib | Adds a dependency for ~200 LOC of logic. The state machine has 5 states, 4 transitions, and a phase-index incrementor. Over-engineered to use a framework. |
| Workspace storage | Supabase Storage hybrid | S3 direct | Supabase Storage IS S3-compatible under the hood. Using it directly avoids a new SDK dependency and stays within the existing auth + RLS story. |
| Workspace file system | Virtual (DB rows) | Real filesystem mount | DB-backed virtual FS gives RLS, versioning, cross-worker access, and backup for free. A real mount would require volume management, no built-in versioning, and breaks multi-worker. |

---

## Installation

### Frontend

```bash
# New npm dependency (pulled in by shadcn Resizable)
npm install react-resizable-panels

# New Radix UI primitives for shadcn components not yet installed
npm install @radix-ui/react-accordion @radix-ui/react-checkbox @radix-ui/react-progress

# Add shadcn/ui components (generates files in src/components/ui/)
npx shadcn add resizable sheet checkbox badge accordion progress
```

**Note:** `@radix-ui/react-dialog` (for Sheet) is already installed via the existing Dialog component. `class-variance-authority` (for Badge) is already installed.

### Backend

```bash
# Single new dependency
pip install "jsonschema>=4.23.0,<5"
```

Add to `requirements.txt`:
```
# Plugin manifest JSON-Schema validation (Theme E — Plugin Contract).
# Validates user-authored plugin manifests against manifest_schema.json.
# Draft 2020-12 support required per PRD §3 Theme E.
jsonschema>=4.23.0,<5
```

---

## Integration Points with Existing Stack

### StreamsProvider Context (v2.6 lift payoff)

The right-side panel is the SECOND concurrent consumer the v2.6 `<StreamsProvider>` was designed for. Integration approach:

- Panel components use the SAME `useStreamsContext()` hook as chat
- The Context's event dispatcher gains a routing table: `workspace_file_*` and `workflow_*` and `todo_*` and `ask_user_*` events route to panel hooks; `content`/`tool_*`/`done` events route to chat hooks
- Single `EventSource` per run (no duplicate SSE connections)
- Implemented via event-type filtering in new hooks (`useWorkflow`, `useWorkspaceFiles`, `useTodos`, `useAskUserPrompt`)

### Redis Streams (D-v2.5-08)

Zero new Redis infrastructure. All new SSE event types use the existing `_emit(redis, run_id, type, **fields)` XADD helper at `backend/app/api/threads.py:115`. New event types are just new `type` string values in the same stream.

### asyncpg Pool (v2.6 WORKER-LIFT-02)

Workspace file reads/writes and harness phase transitions go through the existing asyncpg pool for hot-path operations. No new connection pool needed.

### Supabase Storage

New `workspace-files` bucket follows the exact pattern of the existing `sandbox-outputs` bucket (Phase 067.4). Same signed-URL generation, same RLS-via-FK-chain discipline.

### Tool Registration

New tools register in the existing `get_tools(mode)` function at `backend/app/services/openai_service.py`. The 5 workspace tools + 3 new tools (write_todos, task, ask_user) follow the same tool-definition shape as the existing 16 tools.

---

## What NOT to Add

| Temptation | Why Resist |
|------------|-----------|
| Monaco Editor for workspace files | Massive bundle (~3MB). Workspace files are agent-written artifacts, not code editing surfaces. shiki (already installed) handles syntax highlighting for read-only viewing. |
| CRDT library (Yjs, Automerge) | PRD explicitly rejects real-time collaboration (Section 10 entry 4). The workspace is single-writer (agent writes, user reads). CRDT adds ~50KB and significant complexity for zero user value. |
| React Hook Form for ask_user | The ask_user prompt is 1 text field + optional choice buttons. A controlled component with `useState` is simpler. React Hook Form is designed for complex multi-field forms. |
| TanStack Virtual for file browser | Only renders when panel is open. Workspace files are capped at 200 per thread (`app_settings.workspace_max_files_per_thread`). Virtual scrolling unnecessary for <200 items. |
| Zustand store for panel state | Panel state (which section is expanded, selected file) is local UI state. The StreamsProvider Zustand store handles streaming data. Panel UI state stays in React `useState` / `useReducer` to avoid polluting the global store. |
| WebSocket for ask_user response | The response is a single POST to `POST /runs/{run_id}/ask_user_response`. SSE (already flowing) notifies the backend; the user response travels via REST. Adding WebSocket for one endpoint is over-engineering. |
| Workflow visualization library (e.g., ReactFlow) | PRD Section 10 entry 3 explicitly defers the visual workflow builder. The v1 phase indicator is a simple vertical stepper (list of phases with status icons). ~50 LOC of custom React, not a graph library. |

---

## Dependency Budget Summary

| Surface | New npm packages | New pip packages | New shadcn components |
|---------|-----------------|------------------|-----------------------|
| Right-side panel layout | 1 (`react-resizable-panels`) | 0 | 2 (`resizable`, `sheet`) |
| Panel UI components | 2 (`@radix-ui/react-accordion`, `@radix-ui/react-progress`) | 0 | 4 (`checkbox`, `badge`, `accordion`, `progress`) |
| Workspace diff viewer | 0 (custom) | 0 (`difflib` stdlib) | 0 |
| Plugin manifest validation | 0 | 1 (`jsonschema`) | 0 |
| Harness engine | 0 | 0 (hand-rolled) | 0 |
| New LLM tools | 0 | 0 (existing patterns) | 0 |
| **Total** | **3 packages** | **1 package** | **6 components** |

**Note on `@radix-ui/react-checkbox`:** This is likely already transitively available since shadcn's other components pull Radix packages, but it needs to be explicitly installed for the Checkbox component. Verify at install time -- if the resolution already has it, the install is a no-op.

---

## Version Compatibility Matrix

| New Dependency | React 19 | Python 3.10+ | Notes |
|----------------|----------|-------------|-------|
| `react-resizable-panels@^4.11.2` | Yes (actively maintained, 4 days old) | n/a | v4 has server-rendering + Server Components support |
| `@radix-ui/react-accordion` | Yes (Radix UI supports React 19) | n/a | Same Radix ecosystem as existing components |
| `@radix-ui/react-checkbox` | Yes | n/a | Same Radix ecosystem |
| `@radix-ui/react-progress` | Yes | n/a | Same Radix ecosystem |
| `jsonschema>=4.23.0` | n/a | Yes (requires >=3.10) | Draft 2020-12 support, 4.26.0 is latest (Jan 2026) |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| Panel layout (react-resizable-panels) | HIGH | shadcn/ui officially wraps it; actively maintained; React 19 compatible; version verified via npm |
| Diff viewer (custom build) | HIGH | Server-side difflib is stdlib; React 19 incompatibility of alternatives verified via GitHub issues |
| jsonschema | HIGH | Version verified on PyPI; not a transitive dep (verified via import failure in venv); draft 2020-12 support confirmed in docs |
| No new state machine dep | HIGH | PRD Section 10 explicitly rejects LangGraph; hand-rolled scope is 5 phase types |
| shadcn components | HIGH | All use Radix UI primitives already in the project's dependency tree; checkbox/accordion/progress are standard shadcn components |
| ask_user asyncio.Event | MEDIUM | Pattern is standard but the specific integration with the existing agent_runner `asyncio.Queue` bridge needs careful implementation to avoid deadlocks. Phase-specific research recommended. |

---

## Sources

- [shadcn/ui Resizable component docs](https://ui.shadcn.com/docs/components/radix/resizable)
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels) -- v4.11.2, published 2026-05-23
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [react-diff-viewer-continued React 19 issue #63](https://github.com/Aeolun/react-diff-viewer-continued/issues/63)
- [shadcn/ui Sheet component docs](https://ui.shadcn.com/docs/components/radix/sheet)
- [shadcn/ui Checkbox component docs](https://ui.shadcn.com/docs/components/radix/checkbox)
- [jsonschema PyPI](https://pypi.org/project/jsonschema/) -- v4.26.0, released 2026-01-07
- [Pydantic JSON Schema discussion #5135](https://github.com/pydantic/pydantic/discussions/5135) -- confirms Pydantic does not validate JSON against schemas
- [Python difflib docs](https://docs.python.org/3/library/difflib.html)
- PRD v2.7 Section 5: "Hashing for workspace_file_versions.delta_from_prev uses stdlib difflib"
- PRD v2.7 Section 5: "New SDK / library deps: none" (for core features; jsonschema is the only addition for plugin contract validation)
