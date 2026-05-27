# Architecture: Agent Workspace & Panel Integration

**Project:** Agentic RAG v2.7
**Researched:** 2026-05-27
**Confidence:** HIGH (all integration points verified against live source files)

---

## 1. Executive Summary

v2.7 adds three surfaces to the existing architecture: (1) a per-thread workspace filesystem backed by a new `workspace_files` table + Supabase Storage hybrid, (2) three new LLM tools (`write_todos`, `task`, `ask_user`) with a `todos` table and a new `ask_user_response` endpoint, and (3) a right-side panel UI consuming the same `<StreamsProvider>` Context via event-type demultiplexing. The harness engine (state machine) and plugin contract are also scoped in the PRD but are architecturally independent modules that extend the same integration seams.

The critical architectural insight: **v2.6 already built the substrate v2.7 needs.** The `<StreamsProvider>` Context was explicitly designed as a multi-consumer surface (SEED-007). New SSE event types ride existing `run:{run_id}` Redis Streams via the same `_emit()` XADD path. The panel is a second consumer of the same EventSource, not a new subscription. No new Redis key patterns. No new background processes.

The riskiest integration point is `backend/app/api/threads.py` (the ~3500 LOC god file), which already has 9+ phases on it and G-5 fires. The `ask_user` tool requires the first-ever **pause/resume mechanism** inside `agent_runner` -- a fundamentally new control flow pattern. Everything else is extension of existing patterns.

---

## 2. Integration Map: New vs Modified Components

### 2.1 New Backend Modules (create from scratch)

| Module | Purpose | Depends On |
|--------|---------|------------|
| `backend/app/services/workspace_service.py` | CRUD for workspace_files + versions; hybrid storage (inline bytea vs Storage bucket); diff generation via `difflib` | `get_pg_pool`, `get_supabase` (Storage bucket) |
| `backend/app/services/harness_engine.py` | State machine: phase registry, transition logic, validator dispatch, tool-whitelist enforcement, audit emit | `get_pg_pool`, `_emit()` |
| `backend/app/services/todo_service.py` | `write_todos` persistence layer; full-state-replace semantics on `todos` table | `get_pg_pool` |
| `backend/app/services/workspace_file_loader.py` | Hybrid storage adapter: transparent read from `content_inline` bytea or `content_storage_url` signed-URL | `get_supabase` (Storage) |
| `backend/app/services/tool_dispatcher.py` | Extracted tool dispatch -- moves the ~800 LOC `elif tool_name ==` chain out of `agent_runner`. Required by G-5. | All tool services, `_emit()` |
| `backend/plugins/registries.py` | TOOL_PLUGIN_REGISTRY, PANEL_RENDERER_PLUGIN_REGISTRY, PHASE_TYPE_REGISTRY, FILE_PREVIEW_REGISTRY, DATA_SOURCE_REGISTRY, SECRETS_ADAPTER_REGISTRY | None |
| `backend/plugins/manifest_schema.json` | JSON-Schema for plugin manifests; validated on install and at lifespan startup | None |
| `frontend/src/components/panel/WorkspacePanel.tsx` | Right-side panel root: collapsible, 4 sections, responsive bottom-sheet on mobile | `useStreamsStore` |
| `frontend/src/components/panel/TodoSection.tsx` | Todo list display with nesting (parent_id indentation) | `useTodos` hook |
| `frontend/src/components/panel/WorkspaceFileBrowser.tsx` | File browser for workspace_files; click to preview/diff | `useWorkspaceFiles` hook |
| `frontend/src/components/panel/WorkflowIndicator.tsx` | Phase indicator for harness mode (hidden in Deep Mode) | `useWorkflow` hook |
| `frontend/src/components/panel/AskUserPrompt.tsx` | Actionable prompt with choice buttons + free-text; submits to POST endpoint | `useAskUserPrompt` hook |
| `frontend/src/components/panel/DiffViewer.tsx` | File version diff display using `delta_from_prev` or fetch-both | api.ts workspace endpoints |
| `frontend/src/hooks/useTodos.ts` | Per-thread todo state from `<StreamsProvider>` Context + reconcile fetch | `useStreamsStore` |
| `frontend/src/hooks/useWorkspaceFiles.ts` | Per-thread workspace file list from Context + reconcile fetch | `useStreamsStore` |
| `frontend/src/hooks/useWorkflow.ts` | Per-thread workflow run state from Context + reconcile fetch | `useStreamsStore` |
| `frontend/src/hooks/useAskUserPrompt.ts` | Per-thread pending ask_user prompt from Context | `useStreamsStore` |

### 2.2 Modified Backend Files (extend existing)

| File | Current LOC | What Changes | Risk |
|------|-------------|--------------|------|
| `backend/app/api/threads.py` | ~3500 | (1) Tool dispatch chain extracted to `tool_dispatcher.py` (G-5 mandated refactor). (2) `ask_user` pause/resume: new `asyncio.Event` wait inside tool execution round. (3) Harness mode: pre-check `threads.active_workflow_run_id` before tool dispatch to enforce `workflow_phases.available_tools` whitelist. (4) `_emit()` calls for new SSE event types. (5) New `ASK_USER_EVENTS` module-level registry (same pattern as `RUN_TASKS` at line 92). | **CRITICAL** -- G-5 fires (9+ phases). The `ask_user` pause mechanism is a fundamentally new control flow. Tool dispatch extraction MUST happen first. |
| `backend/app/services/openai_service.py` | ~570 | (1) Register 8 new tool definitions (workspace_write/read/list/diff/delete + write_todos + task + ask_user). (2) Plugin tool merge: `get_tools()` gains a `+ plugin_tools` extension point. | **MODERATE** -- `get_tools()` at line 514 is a simple list append; adding 8 more dicts is mechanical. |
| `backend/app/services/sub_agent_service.py` | ~150 | `run_sub_agent` generalized as the implementation backing the `task` tool. Existing function signature preserved as backward-compat alias. New parameters: `model_override`, `system_prompt_override`, `tools` (subset), `max_steps`. Each `task` invocation creates its own `run:{sub_run_id}` Redis Stream. | **MODERATE** -- existing sub-agent pattern is proven; generalization adds kwargs without breaking callers. |
| `backend/app/main.py` | ~100 | Lifespan extended: `PLUGINS_BOOTSTRAP` env var parsing + `plugin_registry` upsert at startup. | **LOW** |
| `backend/app/models/thread.py` | ~30 | Add `deep_mode_metadata: dict | None` and `active_workflow_run_id: str | None` fields. | **LOW** |
| `frontend/src/lib/api.ts` | ~540 | (1) New `StreamCallbacks` fields: `onTodoUpdated`, `onWorkspaceFileWritten`, `onWorkspaceFileDeleted`, `onWorkflowPhaseStart`, `onWorkflowTransition`, `onAskUserPrompt`, `onAskUserResponse`, etc. (2) New API functions: `getWorkspaceFiles()`, `getWorkspaceFileDiff()`, `getWorkflowState()`, `postAskUserResponse()`, `getTodos()`. (3) `subscribeToRun` parser gains ~12 new `else if` arms for the new event types. | **MODERATE** -- follows established pattern. |
| `frontend/src/stores/streamsStore.ts` | ~130 | Add panel-related state: `todosByThread: Map<string, Todo[]>`, `workspaceFilesByThread: Map<string, WorkspaceFile[]>`, `workflowStateByThread: Map<string, WorkflowState>`, `askUserPromptByThread: Map<string, AskUserPrompt | null>`. | **MODERATE** -- follows the per-thread Map pattern from Phase 075.4 (D-075.4-A1). |
| `frontend/src/providers/StreamsProvider.tsx` | ~1600 | (1) `makeStreamCallbacks` factory gains callback implementations for all new event types. (2) Reconcile function extended to fetch workspace/todo/workflow state on mount. | **MODERATE** -- additive callbacks following the exact pattern of existing 20+ callbacks. |
| `frontend/src/components/layout/ChatLayout.tsx` | ~200 | Layout: `<main>` wrapper for chat view splits into chat (~70%) + `<WorkspacePanel>` (~30%, conditionally rendered). Panel toggle button in header. | **MODERATE** -- layout reflow needs responsive breakpoint care. |

### 2.3 New Database Tables (11 migrations, range 125-135)

| Table | Key Columns | RLS Pattern | Notes |
|-------|-------------|-------------|-------|
| `workspace_files` | `id, thread_id, path, content_inline, content_storage_url, size_bytes, mime_type, created_by` | Via FK chain: `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` | UNIQUE on `(thread_id, path)`. Hybrid storage: inline bytea <= 256KB, bucket for larger. |
| `workspace_file_versions` | `id, workspace_file_id, version, content_inline, content_storage_url, delta_from_prev` | Inherits via workspace_file_id FK | Auto-version on every write. `delta_from_prev` is jsonb structured diff (null for v1). |
| `workflow_definitions` | `id, slug, version, phases (jsonb), entry_phase, published_at` | Owner private + org-shared | Immutable-on-publish (DB trigger). Semver mirrors D-PRD-13 skill versioning. |
| `workflow_runs` | `id, workflow_definition_id, thread_id, run_id, current_phase_id, status` | Via thread FK | Piggybacks on existing `runs` table + Redis Stream. |
| `workflow_phases` | `id, workflow_run_id, phase_index, phase_slug, phase_type, status, available_tools[]` | Via workflow_run FK | `available_tools text[]` is the canonical whitelist the dispatcher reads. |
| `todos` | `id, thread_id, todo_id, content, status, parent_id` | Via thread FK | UNIQUE on `(thread_id, todo_id)`. Full state replace on each `write_todos` call. |
| `plugin_registry` | `id, slug, version, manifest (jsonb), installed_by, enabled` | super_admin writes; operators read | D-PRD-14 permission tier. JSON-Schema validated on install. |
| `plugin_extension_points` | `id, plugin_id, extension_type, config, priority, enabled` | Via plugin FK | 6 extension types. Priority for deterministic ordering. |
| `harness_audit` | `id, workflow_run_id, phase_slug, event_type, details, created_at` | Via workflow_run FK | INSERT-only. Records phase transitions + gate checks + tool refusals. |

Modified tables:
- `threads` -- add `deep_mode_metadata jsonb`, `active_workflow_run_id uuid FK` (migration 133)
- `skills` -- add `harness_required` key to `skill_modes jsonb` (migration 134)

### 2.4 New API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/threads/{thread_id}/workspace/files` | GET | List workspace files for thread | JWT (owner via thread RLS) |
| `/threads/{thread_id}/workspace/files/{file_id}/versions` | GET | List versions for a file | JWT |
| `/threads/{thread_id}/workspace/files/{file_id}/diff` | GET | Diff between two versions (`?from=N&to=M`) | JWT |
| `/threads/{thread_id}/workflow` | GET | Current workflow run state | JWT |
| `/threads/{thread_id}/workflow/cancel` | POST | Cancel active workflow | JWT |
| `/threads/{thread_id}/todos` | GET | Current todo list for thread | JWT |
| `/runs/{run_id}/ask_user_response` | POST | User response to active `ask_user_prompt` | JWT |
| `/admin/plugins` | GET | List installed plugins | JWT (operator+) |
| `/admin/plugins` | POST | Install plugin | JWT (super_admin only) |
| `/admin/plugins/{plugin_id}` | PATCH | Enable/disable plugin | JWT (super_admin only) |
| `/admin/plugins/{plugin_id}` | DELETE | Uninstall plugin | JWT (super_admin only) |

### 2.5 New SSE Event Types (all ride existing `run:{run_id}` Stream)

| Event Type | Theme | Payload | Consumer |
|------------|-------|---------|----------|
| `workspace_file_written` | A | `{path, version, size_bytes, mime_type}` | Panel file browser |
| `workspace_file_deleted` | A | `{path}` | Panel file browser |
| `todo_updated` | C | `{todos: Todo[]}` | Panel todo section |
| `ask_user_prompt` | C | `{prompt, options?, timeout_seconds?}` | Panel ask-user section |
| `ask_user_response` | C | `{response_text, choice_index?}` | Panel (dismisses prompt) |
| `workflow_phase_start` | B | `{phase_slug, phase_type, index, available_tools}` | Panel workflow indicator |
| `workflow_phase_progress` | B | `{phase_slug, detail}` | Panel workflow indicator |
| `workflow_phase_gate_check` | B | `{phase_slug, validator_results}` | Panel workflow indicator |
| `workflow_phase_end` | B | `{phase_slug, status, output_summary}` | Panel workflow indicator |
| `workflow_transition` | B | `{from_phase, to_phase}` | Panel workflow indicator |
| `workflow_run_complete` | B | `{status, final_artifact_path}` | Panel workflow indicator |

---

## 3. Data Flow Diagrams

### 3.1 Workspace Write Flow

```
User prompt: "Write a plan"
    |
    v
agent_runner (threads.py:1381) -- LLM returns tool_call: workspace_write("/plan.md", "...")
    |
    v
Tool dispatch (tool_dispatcher.py) -- dispatch_tool("workspace_write", args, ctx)
    |
    v
workspace_service.write_file(thread_id, path, content)
    |-- content <= 256KB? --> INSERT/UPSERT workspace_files (content_inline = bytea)
    |-- content > 256KB?  --> Upload to workspace-files bucket
    |                         INSERT/UPSERT workspace_files (content_storage_url)
    |
    v
workspace_service.create_version(file_id, version_n, content, delta)
    |-- delta_from_prev = difflib.unified_diff(prev_content, new_content)
    |
    v
_emit(redis, run_id, 'workspace_file_written', path="/plan.md", version=2, ...)
    |
    v
Redis Stream run:{run_id} -- XADD
    |
    v
GET /runs/{run_id}/stream?since=N -- SSE consumer reads XREAD
    |
    v
subscribeToRun parser (api.ts:393) -- else if (t === "workspace_file_written")
    |
    v
callbacks.onWorkspaceFileWritten(path, version, ...) -- in makeStreamCallbacks
    |
    v
streamsStore.workspaceFilesByThread.set(threadId, updatedFiles) -- Zustand update
    |
    v
<WorkspaceFileBrowser> re-renders with new file entry
```

### 3.2 ask_user Pause/Resume Flow (New Control Flow Pattern)

```
agent_runner iteration N -- LLM returns tool_call: ask_user("Which folder?", ["A","B"])
    |
    v
Tool dispatch -- elif tool_name == "ask_user":
    |
    v
_emit(redis, run_id, 'ask_user_prompt', prompt="Which folder?", options=["A","B"])
    |
    v
Redis pub/sub SUBSCRIBE on channel ask_user:{run_id}
    |                        (producer task suspended; run status = "awaiting_user")
    |
    v [Panel renders prompt with choice buttons]
    |
User clicks "A" in AskUserPrompt panel section
    |
    v
POST /runs/{run_id}/ask_user_response {response_text: "A", choice_index: 0}
    |
    v
Endpoint does PUBLISH to Redis channel ask_user:{run_id}
    |
    v
Producer's SUBSCRIBE receives message -- agent_runner RESUMES
    |
    v
tool_result = json.dumps({"response_text": "A", "choice_index": 0})
    |
    v
messages.append({"role": "tool", "content": tool_result, ...})
    |
    v
Next iteration continues normally
```

**Multi-worker safety:** The `ask_user` pause uses Redis pub/sub (not `asyncio.Event`) because with `WORKER_COUNT=2`, the POST endpoint may land on a different worker than the one hosting the producer task. Redis pub/sub is the lightest cross-worker signaling primitive -- one SUBSCRIBE + one PUBLISH per `ask_user` invocation.

### 3.3 Right-Side Panel as Second Stream Consumer

```
                    <StreamsProvider>
                         |
            +-----------+-----------+
            |                       |
     Chat surface (70%)     Panel surface (30%)
            |                       |
    useThreadMessages()     useTodos(threadId)
                            useWorkspaceFiles(threadId)
                            useWorkflow(threadId)
                            useAskUserPrompt(threadId)
            |                       |
     [existing hooks]        [new hooks -- same store]
            |                       |
   reads bucketsBySurface   reads todosByThread,
   Map<"chat", Map<tid,     workspaceFilesByThread,
   Message[]>>              workflowStateByThread, etc.

Both read from the SAME Zustand store (streamsStore.ts).
Both receive updates from the SAME EventSource (one per run).
The StreamsProvider's makeStreamCallbacks factory routes
events by type to the correct store fields.
No new subscriptions. No new EventSource connections.
```

**Why this works:** The existing `subscribeToRun` function in `api.ts` already ignores unknown event types (they fall through the `else if` chain silently). Adding new `else if` arms for workspace/todo/workflow/ask_user events is purely additive. The `StreamsProvider` already manages one SSE connection per active run; panel events piggyback on the same connection.

### 3.4 Harness Engine Tool-Whitelist Enforcement

```
agent_runner iteration -- about to dispatch tool_name = "execute_code"
    |
    v
Pre-check: threads.active_workflow_run_id IS NOT NULL?
    |-- NO  --> Deep Mode: dispatch tool normally (existing behavior)
    |-- YES --> Harness Mode:
                    |
                    v
                Read cached whitelist for current phase
                (in-memory cache per run_id; refreshed on phase transition)
                    |
                    v
                "execute_code" in available_tools?
                    |-- YES --> dispatch normally
                    |-- NO  --> tool_result = {"error": "tool_not_available_in_phase",
                                              "phase": "research", "allowed": [...]}
                                _emit(redis, run_id, 'tool_refused', ...)
                                harness_audit INSERT
```

---

## 4. Component Boundary Definitions

### 4.1 Backend Boundaries

```
backend/
  app/
    api/
      threads.py              -- MODIFIED: agent_runner calls tool_dispatcher; ask_user
                                  pause via Redis pub/sub; harness pre-check delegate
      workspace.py             -- NEW: REST endpoints for workspace files/versions/diff
      workflow.py              -- NEW: REST endpoints for workflow state + cancel
      admin_plugins.py         -- NEW: REST endpoints for plugin CRUD
      runs.py                  -- MODIFIED (minimal): ask_user_response POST endpoint
    services/
      tool_dispatcher.py             -- NEW: extracted tool dispatch from threads.py
      workspace_service.py           -- NEW: workspace CRUD + hybrid storage + versioning
      workspace_file_loader.py       -- NEW: transparent read from inline or bucket
      harness_engine.py              -- NEW: state machine + phase registry + validators
      todo_service.py                -- NEW: todos table CRUD
      openai_service.py              -- MODIFIED: register 8 new tools + plugin tool merge
      sub_agent_service.py           -- MODIFIED: generalize run_sub_agent for task tool
    db/
      runs.py                  -- EXISTING (no change)
      workspace.py             -- NEW: asyncpg helpers for workspace tables
      workflow.py              -- NEW: asyncpg helpers for workflow tables
      todos.py                 -- NEW: asyncpg helpers for todos table
    models/
      thread.py                -- MODIFIED: add deep_mode_metadata + active_workflow_run_id
      workspace.py             -- NEW: Pydantic models for workspace files/versions
      workflow.py              -- NEW: Pydantic models for workflow definitions/runs/phases
      todo.py                  -- NEW: Pydantic model for Todo
      plugin.py                -- NEW: Pydantic models for plugin manifest/registry
  plugins/
    manifest_schema.json       -- NEW: JSON-Schema for plugin manifests
    registries.py              -- NEW: 6 extension-type registries
```

### 4.2 Frontend Boundaries

```
frontend/src/
  components/
    panel/
      WorkspacePanel.tsx              -- NEW: root panel component (collapsible, 4 sections)
      TodoSection.tsx                 -- NEW: todo list with nesting
      WorkspaceFileBrowser.tsx        -- NEW: file tree + click-to-preview
      WorkflowIndicator.tsx           -- NEW: phase progress indicator
      AskUserPrompt.tsx               -- NEW: actionable prompt UI
      DiffViewer.tsx                  -- NEW: file version diff display
    layout/
      ChatLayout.tsx                  -- MODIFIED: split main area into chat + panel
  hooks/
    useTodos.ts                       -- NEW: per-thread todos from store
    useWorkspaceFiles.ts              -- NEW: per-thread workspace files from store
    useWorkflow.ts                    -- NEW: per-thread workflow state from store
    useAskUserPrompt.ts               -- NEW: per-thread pending prompt from store
  stores/
    streamsStore.ts                   -- MODIFIED: add panel-related per-thread Maps
  providers/
    StreamsProvider.tsx               -- MODIFIED: add callbacks for new event types
  lib/
    api.ts                            -- MODIFIED: new StreamCallbacks + parser arms + API fns
  types/
    index.ts                          -- MODIFIED: add Todo, WorkspaceFile, WorkflowState types
```

---

## 5. Patterns to Follow

### 5.1 SSE Event Emission (proven pattern -- follow exactly)

Every new event type uses the existing `_emit()` at threads.py:115:

```python
await _emit(redis, run_id, 'workspace_file_written',
            path="/plan.md", version=2, size_bytes=1234, mime_type="text/markdown")
```

This XADD to `run:{run_id}` is consumed by `GET /runs/{run_id}/stream?since=N`. The frontend's `subscribeToRun` parser adds new `else if` arms. Zero new infrastructure.

### 5.2 Per-Thread State in Zustand Store (proven pattern from Phase 075.4)

Phase 075.4 (D-075.4-A1) established the pattern of replacing global booleans with per-thread Maps/Sets in `streamsStore.ts`. All new panel state follows this:

```typescript
// In streamsStore.ts
todosByThread: Map<string, Todo[]>
workspaceFilesByThread: Map<string, WorkspaceFile[]>
workflowStateByThread: Map<string, WorkflowState | null>
askUserPromptByThread: Map<string, AskUserPrompt | null>
```

### 5.3 Hybrid Storage (proven pattern from Phase 067.4 sandbox-outputs)

The `workspace-files` Supabase Storage bucket mirrors `sandbox-outputs` bucket at `backend/app/api/sandbox_outputs.py:48-67`:

```python
# Write: threshold-gated
if len(content) <= settings.workspace_inline_threshold_bytes:
    # UPSERT workspace_files SET content_inline = $content, content_storage_url = NULL
else:
    path = f"{thread_id}/{file_id}/v{version}.bin"
    supabase.storage.from_("workspace-files").upload(path, content)
    signed_url = supabase.storage.from_("workspace-files").create_signed_url(path, 3600)
    # UPSERT workspace_files SET content_storage_url = $signed_url, content_inline = NULL

# Read: transparent via workspace_file_loader
async def load_file_content(file_row) -> bytes:
    if file_row["content_inline"]:
        return file_row["content_inline"]
    else:
        return await fetch_from_storage(file_row["content_storage_url"])
```

### 5.4 Tool Registration (proven pattern -- follow exactly)

New tool dicts follow the exact shape of existing tools in `openai_service.py`:

```python
WORKSPACE_WRITE_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_write",
        "description": "Write or update a file in the thread's workspace filesystem.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path starting with /"},
                "content": {"type": "string", "description": "File content to write"},
            },
            "required": ["path", "content"],
        },
    },
}
```

Added to `get_tools()` unconditionally (workspace tools are always available in both modes).

### 5.5 Reconcile-on-Mount (D-v2.5-03 rule)

All new panel hooks fetch state on mount, not only from SSE events:

```typescript
export const useTodos = (threadId: string | null) => {
  const todos = useStreamsStore((s) =>
    threadId ? s.todosByThread.get(threadId) ?? [] : []
  )
  useEffect(() => {
    if (!threadId) return
    getTodos(threadId).then((fetched) => {
      useStreamsStore.setState((s) => {
        const next = new Map(s.todosByThread)
        next.set(threadId, fetched)
        return { todosByThread: next }
      })
    })
  }, [threadId])
  return todos
}
```

### 5.6 asyncpg for Hot Paths, aexec for Cold Paths (D-073-04)

New workspace/todo writes that happen inside the agent loop (hot path) use the asyncpg pool via new `backend/app/db/workspace.py` helpers. REST endpoint reads (cold path) can use `aexec` with supabase-py.

---

## 6. Anti-Patterns to Avoid

### 6.1 DO NOT add more tool branches to threads.py inline

The tool dispatch chain at threads.py:2548+ is already ~800 LOC of `elif tool_name == "..."` branches. Adding 8 more tools inline would push it past 1000 LOC. **Extract tool dispatch to a separate module** before adding new tools. This is the G-5 refactor that `threads.py` (9+ phases) owes before more feature work.

### 6.2 DO NOT create a separate EventSource for panel events

The panel MUST consume from the same `subscribeToRun` SSE connection as chat. Creating a second EventSource per run would double the browser's SSE connection count, create event ordering drift, and violate PANEL-STREAMS-01.

### 6.3 DO NOT use asyncio.Event for ask_user cross-worker signaling

`asyncio.Event` is process-local. With `WORKER_COUNT=2`, the POST endpoint may land on a different worker than the producer. Use Redis pub/sub (`SUBSCRIBE`/`PUBLISH` on channel `ask_user:{run_id}`) for cross-worker safety.

### 6.4 DO NOT store workflow phase state in-memory only

Harness phases MUST persist to Postgres (`workflow_phases` table). With multi-worker uvicorn, in-memory state is process-local and lost on restart. Required by HARNESS-RUN-01 and Q-v2.7-04.

### 6.5 DO NOT add harness whitelist checks inline in the tool dispatch chain

The whitelist enforcement should be a single pre-dispatch gate in `tool_dispatcher.py`, not duplicated inside each tool branch. The dispatcher checks once before routing to the tool handler.

### 6.6 DO NOT poll for workspace file changes in the panel

The panel receives workspace file updates via SSE events (`workspace_file_written`/`workspace_file_deleted`). On mount it does a single reconcile fetch (D-v2.5-03 rule). It MUST NOT poll the REST endpoint on an interval.

---

## 7. The ask_user Pause/Resume Mechanism (Deep Dive)

This is the most architecturally novel addition. The existing `agent_runner` has no concept of "pause" -- it runs tool calls synchronously within the iteration loop and only stops on `break` (natural completion) or exception.

### 7.1 Recommended Design: Redis Pub/Sub

```python
# Inside tool_dispatcher.py, when tool_name == "ask_user":
async def handle_ask_user(args, ctx):
    prompt = args["prompt"]
    options = args.get("options")
    timeout = args.get("timeout_seconds", 3600)

    # 1. Emit SSE event so panel renders the prompt
    await _emit(ctx.redis, ctx.run_id, 'ask_user_prompt',
                prompt=prompt, options=options, timeout_seconds=timeout)

    # 2. Update run status
    await ctx.pool.execute(
        "UPDATE runs SET status = 'awaiting_user' WHERE run_id = $1", ctx.run_id)

    # 3. Subscribe to Redis channel for the response
    pubsub = ctx.redis.pubsub()
    await pubsub.subscribe(f"ask_user:{ctx.run_id}")
    try:
        response = None
        async with asyncio.timeout(timeout):
            async for message in pubsub.listen():
                if message["type"] == "message":
                    response = json.loads(message["data"])
                    break
    except asyncio.TimeoutError:
        response = {"error": "User did not respond within timeout"}
    finally:
        await pubsub.unsubscribe(f"ask_user:{ctx.run_id}")
        await ctx.pool.execute(
            "UPDATE runs SET status = 'streaming' WHERE run_id = $1", ctx.run_id)

    # 4. Emit response event so panel can dismiss the prompt
    await _emit(ctx.redis, ctx.run_id, 'ask_user_response', **response)

    return json.dumps(response)
```

```python
# In runs.py or a new ask_user.py router:
@router.post("/runs/{run_id}/ask_user_response")
async def ask_user_response(run_id: UUID, body: AskUserResponseBody, redis=Depends(get_redis)):
    # Verify the run exists and is in 'awaiting_user' status
    # ...
    payload = {"response_text": body.response_text, "choice_index": body.choice_index}
    await redis.publish(f"ask_user:{run_id}", json.dumps(payload))
    return {"ok": True}
```

### 7.2 Why Redis Pub/Sub Over Alternatives

| Approach | Cross-Worker Safe | Latency | Complexity | Verdict |
|----------|-------------------|---------|------------|---------|
| `asyncio.Event` | NO | ~0ms | Low | Fails with WORKER_COUNT=2 |
| Redis pub/sub | YES | ~1ms | Low | **Recommended** |
| Postgres row + polling | YES | 100-500ms | Medium | Wasteful CPU |
| Redis Stream (existing) | YES | ~1ms | Medium | Overengineered for 1 message |
| Sticky sessions | YES | ~0ms | High | Requires LB config |

Redis pub/sub is the lightest option: 1 SUBSCRIBE, 1 PUBLISH, then the channel is gone. The existing `redis.asyncio` client already supports pub/sub. No new infrastructure.

---

## 8. threads.py God-File Extraction Strategy

The PRD section 9 row 5 claims: "v2.7 adds phase-dispatcher pre-check logic to `threads.py:1059` -- adds ~30 LOC, NOT a major compound." This is optimistic. The real additions are:

- 8 new tool branches in the dispatch chain (~200 LOC)
- ask_user pause/resume mechanism (~50 LOC)
- Harness whitelist pre-check per tool call (~30 LOC)
- Harness phase transition calls (~40 LOC)

**Recommended extraction (must happen BEFORE any feature work):**

1. **Extract tool dispatch** -- move the ~800 LOC `elif tool_name ==` chain (threads.py:2548-3360) to `backend/app/services/tool_dispatcher.py`. Define a `ToolContext` dataclass carrying `redis`, `run_id`, `thread_id`, `supabase`, `pool`, `user_settings`, `current_user`, `folder_subtree_ids`, `scoped_folder_path`. The `agent_runner` calls `result = await dispatch_tool(tool_name, args, tool_ctx)` where `dispatch_tool` routes to per-tool handler functions.

2. **Extract ask_user registry** -- the `ASK_USER_EVENTS` dict (if using in-memory fallback) or the Redis pub/sub pattern goes into `tool_dispatcher.py` alongside the `ask_user` handler.

3. **Keep agent_runner in threads.py** -- the iteration loop, LLM streaming, context window management, and finalization logic stay. The refactor extracts dispatch, not the loop.

4. **Harness whitelist enforcement** -- a single gate function `check_tool_allowed(run_id, tool_name) -> bool` in `harness_engine.py`, called by `tool_dispatcher.py` before routing to the handler.

This directly addresses G-5 (refactor between feature waves) on the hot-file ledger for `threads.py`.

---

## 9. Suggested Build Order

Based on dependency analysis and risk ordering:

### Wave 0 -- Foundation (no feature dependencies)

| Phase | Goal | Approx Plans | Risk |
|-------|------|-------------|------|
| Schema migrations (125-135) | All 11 migrations + RLS + indexes + Storage bucket | 3 | LOW |
| threads.py tool-dispatch extraction | G-5 mandated. Extract tool dispatch chain to `tool_dispatcher.py`. | 3-4 | MODERATE (large refactor, must preserve all existing behavior) |

### Wave 1 -- Backend Workspace + Tools (after Wave 0)

| Phase | Goal | Approx Plans | Risk |
|-------|------|-------------|------|
| Workspace filesystem backend | `workspace_service.py`, `workspace_file_loader.py`, 5 workspace tools, workspace REST endpoints, SSE events | 3 | MODERATE |
| Three new LLM tools | `todo_service.py`, `task` generalization, `ask_user` pause/resume (Redis pub/sub) | 4 | HIGH (ask_user is novel) |

### Wave 2 -- Frontend Panel (after Wave 1 backend events exist)

| Phase | Goal | Approx Plans | Risk |
|-------|------|-------------|------|
| StreamsProvider extension + hooks | New event types in api.ts parser + StreamCallbacks. Panel state in streamsStore.ts. 4 new hooks. | 3 | MODERATE |
| Panel UI scaffold | WorkspacePanel + ChatLayout split. 4 sections. Responsive. | 5 | MODERATE |
| Diff viewer + file preview | DiffViewer.tsx, default text/markdown preview, file_preview extension point. | 3 | LOW |

### Wave 3 -- Harness + Plugin (parallelizable with Wave 2)

| Phase | Goal | Approx Plans | Risk |
|-------|------|-------------|------|
| Harness engine | harness_engine.py, 5 phase types, validators, tool-whitelist enforcement | 5 | HIGH (complex state machine) |
| Plugin contract | Manifest schema, 6 registries, loader, /admin/plugins endpoints | 5 | MODERATE |
| Dual-mode UX | Deep/Harness toggle, skill_modes.harness_required, panel auto-open | 3 | MODERATE |

### Wave 4 -- Reference + Verification

| Phase | Goal | Approx Plans | Risk |
|-------|------|-------------|------|
| Reference plugin (PPTX preview) | Validates contract end-to-end | 2 | LOW |
| Seed workflows | 2-3 example workflow_definitions | 2 | LOW |
| Cross-cutting verification | E2E flows, accessibility, cross-PRD edits | 3 | LOW |

### Build Order Rationale

- **Tool dispatch extraction FIRST** because every subsequent phase adds to threads.py. Doing it after features ship means a painful rebase.
- **Workspace before panel** because the panel needs backend events to render. The panel is purely a consumer.
- **ask_user is the highest-risk tool** because it introduces a pause/resume control flow. Ship it WITH the other tools so the tool dispatcher contract is settled.
- **Harness after workspace/tools** because the harness extends the tool dispatcher (whitelist enforcement). Building the dispatcher extraction + basic tools first means the harness has clean hooks to plug into.
- **Plugin contract parallelizes with Wave 2** (panel) since it's primarily backend registry + API work with no frontend dependency until the reference plugin.

---

## 10. Scalability Considerations

| Concern | Current Scale | v2.7 Impact | Mitigation |
|---------|---------------|-------------|------------|
| workspace_files rows | 0 | ~20 files/thread x 100 threads = 2K rows | Index on thread_id. Trivial. |
| workspace_file_versions | 0 | ~50 writes/thread x 100 threads = 5K rows/month | No cleanup policy in v2.7. Deferred to v3.4 TTL. Monitor row count. |
| Storage bucket objects | sandbox-outputs only | workspace-files bucket adds ~10 large files/thread | Supabase Storage scales independently. Signed-URL expiry = 1hr. |
| SSE events per run | ~50-500 | +5-20 workspace/todo/workflow events per run | MAXLEN~10000 on XADD handles this. |
| Tool dispatch latency | ~1ms | +1 Postgres round-trip for harness whitelist | Cache whitelist in-memory per run_id; refresh on phase transition. |
| ask_user pause duration | N/A | Producer task suspended 0-3600s | Redis SUBSCRIBE is zero-CPU. Concern: run_id held in RUN_TASKS during pause -- cleanup if abandoned. |
| Plugin enumeration | N/A | 1 query per get_tools() call at ~10 plugins | In-memory cache per worker with 60s TTL. |
| llm_batch_agents fan-out | N/A | N parallel sub-agents per phase | `max_parallel_agents` config (default 5). At 50 concurrent workflow runs x 5 = 250 sub-runs within AnyIO ceiling (200 per worker x 2 workers). |

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| threads.py G-5 compounding (9+ phases) | **CRITICAL** | Extract tool dispatch BEFORE adding tools. This research doc explicitly recommends it as Phase 0 work. |
| ask_user multi-worker race condition | **HIGH** | Redis pub/sub channel per run_id. Test with WORKER_COUNT=2. |
| Harness state machine complexity | **HIGH** | 5 phase types is ambitious. Ship `llm_single` + `llm_agent` + `llm_human_input` first; `programmatic` + `llm_batch_agents` in a follow-up phase. |
| Panel re-render storms from high-frequency SSE events | **MODERATE** | Throttle store updates for workspace events (same `makeThrottle` pattern from StreamsProvider line 80). |
| ChatLayout responsive breakpoints | **MODERATE** | Panel width must not crush chat below readable width. Test at 768px, 1024px, 1440px. Mobile = bottom-sheet, not side panel. G-2 sketch-before-plan fires. |
| Branch D-3 clearMessages guard regression | **MODERATE** | Panel is a SECOND consumer, not a modification to chat's read path. Vitest unit must verify guard survives. |
| Workspace file versioning unbounded growth | **LOW (deferred)** | No TTL in v2.7. Document for v3.4. Monitor via admin query. |
| Plugin manifest validation crash at startup | **LOW** | Per-plugin try/except in lifespan bootstrap. Failed plugins logged + skipped. |

---

## 12. Sources

**Live source files verified (2026-05-27):**
- `backend/app/api/threads.py` -- `_emit()` at line 115, `agent_runner` at line 1381, tool dispatch at line 2548, `RUN_TASKS` registry at line 92, `TERMINAL_TYPES` at line 100
- `backend/app/services/openai_service.py` -- `get_tools()` at line 514, tool dict shapes at lines 16-52
- `backend/app/services/sub_agent_service.py` -- `run_sub_agent` at line 20
- `backend/app/api/sandbox_outputs.py` -- Storage bucket pattern at line 48-67
- `backend/app/db/runs.py` -- asyncpg helper pattern
- `frontend/src/App.tsx` -- `<StreamsProvider>` wrap at line 30
- `frontend/src/providers/StreamsProvider.tsx` -- 1600 LOC, named hooks at line 1540+
- `frontend/src/stores/streamsStore.ts` -- per-thread Maps at line 47-79, StreamsState interface at line 43
- `frontend/src/lib/api.ts` -- `StreamCallbacks` at line 186, `subscribeToRun` parser at line 380+, ~30 existing event type arms
- `frontend/src/components/layout/ChatLayout.tsx` -- current layout at line 184-196 (single `<main>` element)

**PRD:**
- `.planning/PRDs/v2.7.md` -- Themes A-H, 11 migrations (125-135), 11 phases, ~38 plans, section 5 (Architecture) + section 6 (Compatibility)

**Project context:**
- `.planning/PROJECT.md` -- Current schema (lines 232-246), agent modes (lines 248-250), key decisions, hot-file ledger in CLAUDE.md
