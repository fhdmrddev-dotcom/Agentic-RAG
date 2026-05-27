# Open-Source Landscape: Workspace, Panel, Agent-Tool Patterns

**Domain:** Artifact panels, workspace filesystems, sub-agent spawning, human-in-the-loop
**Researched:** 2026-05-27
**Overall confidence:** HIGH (10+ projects analyzed, multiple corroborating sources)

---

## Executive Summary

The open-source ecosystem has converged on several clear patterns for the four v2.7 features. Artifact/side panels are now standard in every major chat UI (LibreChat, Open WebUI, LobeChat) using `react-resizable-panels` or equivalent split layouts with sandboxed iframes for rendering. Workspace filesystems follow OpenHands' model: a mounted directory per session with event-sourced state. Human-in-the-loop has two dominant patterns: LangGraph's `interrupt()`/`Command(resume=...)` checkpoint model (pause graph, persist state, resume later) and Mastra's `suspend()`/`resume()` workflow steps. Sub-agent delegation is consistently implemented as a tool call that spawns a child context with constrained tool access, following Claude Code's Task tool pattern. Todo-list planning has emerged as a first-class agent tool pattern per LangChain's `TodoListMiddleware`, not a prompt hack.

**Key takeaway for v2.7:** We are NOT pioneering any of these patterns. Every one has battle-tested open-source implementations we can learn from. The risk is in integration -- combining all four in a single coherent UX -- not in the individual features.

---

## 1. Artifact / Side Panel Implementations

### 1.1 LibreChat (33.9K+ stars)

**Repo:** https://github.com/danny-avila/LibreChat
**Stack:** React + Express.js + MongoDB + Recoil + React Query
**Confidence:** HIGH (docs + PRs + architecture gist verified)

**Panel Architecture:**
- Uses `react-resizable-panels` v4 for the split layout (chat left, artifacts right)
- Artifacts render via CodeSandbox's **Sandpack** library in a sandboxed iframe
- Recently migrated code editing from Sandpack/CodeMirror to **Monaco Editor** (PR #12109) while keeping Sandpack only for live preview
- Replaced React Markdown renderer with static HTML for more reliable display (PR #12337)
- Content-Security-Policy must include `frame-src 'self' https://*.codesandbox.io`

**Artifact Type System:**
- `text/html` -- HTML content
- `application/vnd.mermaid` -- Mermaid diagrams
- `application/vnd.react` -- React components
- `application/vnd.ant.react` -- Anthropic-format React artifacts
- `image/svg+xml` -- SVG images

**State Management:**
- Dual approach: Recoil for UI state, React Query for server state (5-min stale, 30-min cache)
- Streaming via observer pattern: `aiClient.on('data', chunk => response.write(chunk))`
- 50+ component directory with clear category separation

**Key Lesson:** Monaco for editing, Sandpack for preview is the winning combo. React Markdown rendering of artifacts was unreliable and got replaced with static HTML injection.

**What Users Complain About:** Sandpack CDN dependency (self-hosting the bundler is non-trivial), inconsistent artifact detection by different models, CSP configuration complexity.

### 1.2 Open WebUI (75K+ stars)

**Repo:** https://github.com/open-webui/open-webui
**Stack:** SvelteKit (Svelte 5) + FastAPI + SQLAlchemy + Socket.IO
**Confidence:** MEDIUM (docs verified, internal architecture via DeepWiki)

**Panel Architecture:**
- Dedicated Artifacts window renders to the right of the chat
- Version selector at bottom-left enables switching between iterations
- Each edit creates a new version (version history built-in)
- Supports HTML/CSS/JS, ThreeJS, D3.js, and other visualization libraries
- Persistent artifact storage via key-value API with personal and shared scopes

**State Management:**
- Svelte reactive stores for UI state
- Socket.IO (not SSE) for real-time streaming with Redis-backed managers for multi-node
- SQLAlchemy ORM with Alembic migrations (SQLite/PostgreSQL/MySQL)

**Known Issues (relevant to us):**
- Artifacts sidebar does not auto-show when browser tab goes to background (Issue #22889 -- March 2026)
- Panel can remain empty/collapsed requiring manual toggle (Discussion #6111)
- Cross-origin iframe restrictions cause preview failures in certain environments

**Key Lesson:** The version-per-edit model is excellent UX but needs careful state management. Auto-open detection is fragile -- better to have explicit signals from the backend about artifact presence rather than relying on content detection.

### 1.3 LobeChat (60K+ stars)

**Repo:** https://github.com/lobehub/lobe-chat
**Stack:** Next.js + Zustand + SWR + tRPC + Drizzle ORM + PostgreSQL
**Confidence:** MEDIUM (wiki + DeepWiki verified)

**Artifact System:**
- Uses `lobeArtifact` XML tag structure with typed attributes: `identifier`, `type` (code/document/HTML/SVG/Mermaid/React), `language`, `title`
- Claude Artifacts-inspired real-time creation and visualization
- Supports SVG graphics, HTML pages, professional documents

**State Management (most relevant to our Zustand stack):**
- Domain-specific Zustand stores in `src/store/*`
- Migrating to class-based action pattern: class receives `(set, get, api)` in constructor
- Dual persistence: localStorage for UI state, database for persistent data
- Optimistic updates with eventual server reconciliation
- SWR integration for automatic caching and revalidation

**Key Lesson:** LobeChat's Zustand migration to class-based action slices is worth studying since we already use Zustand (via `streamsStore.ts`). Their optimistic-update pattern with DB reconciliation maps directly to our workspace file operations.

### 1.4 Bolt.diy (30K+ stars)

**Repo:** https://github.com/stackblitz-labs/bolt.diy
**Stack:** Remix + AI SDK + nanostores + zustand + WebContainers
**Confidence:** HIGH (DeepWiki architecture doc verified)

**Streaming Parser (most architecturally relevant):**
- `EnhancedStreamingMessageParser` detects structured artifacts from LLM streaming chunks in real-time
- Artifacts are structured outputs containing: unique ID, title, multiple action types (FileAction, ShellAction, StartAction)
- Each artifact gets its own `ActionRunner` instance for sequential execution
- `WorkbenchStore` is central coordinator with sub-stores for editor, filesystem, preview, terminal

**State Management:**
- Three-tier: nanostores (global/workbench), zustand (UI), persistence layers
- Atomic stores organized by domain with unidirectional data flow
- `FilesStore` handles CRUD + locking (file-level and folder-level locks)
- `PreviewsStore` manages preview URLs and ports

**File Operations:**
- Write directly to WebContainer's virtual filesystem
- File locking prevents concurrent modifications
- Action queuing ensures sequential execution per artifact

**Key Lesson:** The streaming parser pattern is gold. Parsing structured artifacts from SSE chunks as they arrive (not waiting for complete messages) is exactly what our `tool_args_progress` SSE event already does. Bolt's `ActionRunner` per-artifact pattern maps to our per-tool-call execution model.

### 1.5 assistant-ui (React Component Library, 8K+ stars)

**Repo:** https://github.com/assistant-ui/assistant-ui
**Confidence:** HIGH (official docs + examples verified)

**Artifact Panel:**
- Split-panel layout: chat left, live preview right
- Code renders in sandboxed iframe
- Has an explicit Claude Artifacts example at `examples/with-artifacts/`
- Tool UIs receive rich props: tool-call type, ID, name, args, result, error, status, artifact data

**Tool Result Rendering:**
- `makeAssistantToolUI` creates custom interfaces for tool execution
- Loading states and progress indicators per tool
- Composable primitives inspired by Radix UI -- building blocks, not rigid components
- Tool parts use typed naming: `tool-${toolName}` for type-safe rendering

**Key Lesson:** The composable-primitive approach (building blocks vs. rigid chat component) is the right architecture for our diverse tool types. Each tool type gets its own renderer component.

---

## 2. Workspace / Filesystem Patterns

### 2.1 OpenHands (formerly OpenDevin, 50K+ stars)

**Repo:** https://github.com/OpenHands/OpenHands
**Stack:** Python + Docker + Event Sourcing
**Confidence:** HIGH (ICLR 2025 paper + SDK docs + DeepWiki verified)

**Workspace Architecture (most relevant to our v2.7 design):**
- Three workspace implementations: `LocalWorkspace`, `DockerWorkspace`, `RemoteAPIWorkspace`
- Configurable workspace directory mounted into sandbox at `/workspace`
- Files created by agent are **ephemeral** in the container -- lost when container is removed
- Agent works in `/workspace` directory; user files mounted there

**Event-Sourced State Model:**
- ALL interactions are immutable events appended to an `EventLog`
- Event types: `MessageEvent`, `ActionEvent`, `ObservationEvent`, `AgentErrorEvent`, `Condensation`
- EventLog is append-only, single source of truth
- Replaying events reconstructs entire conversation (deterministic recovery)
- Conversations resume by loading base state metadata + replaying from last processed point

**Tool System:**
- Action -> Execution -> Observation pattern (strict)
- Pydantic validates input before execution
- MCP tools translate JSON schemas into Action models
- Registry-based resolution decouples specs from implementations

**Sub-Agent Delegation:**
- Child agents inherit parent config + workspace context
- Implemented as a standard tool -- no core framework modification needed
- Stateless agents emit events via callbacks

**State Persistence:**
- Dual-path: `base_state.json` metadata + individual JSON event files
- FIFO lock ensures thread-safe updates
- Two patterns: state-only updates (metadata) and event-based updates (appending to logs)

**Key Lesson for v2.7:** The event-sourced model is powerful but likely overkill for our per-thread workspace. We should use the simpler pattern: Supabase Storage for file bytes + a `workspace_files` table for metadata/versioning + inline small files in JSONB. OpenHands' workspace-mount pattern does map to our concept of a per-thread filesystem -- the thread IS the workspace scope.

### 2.2 Agentic File System (AFS) Pattern

**Confidence:** MEDIUM (academic/blog sources, emerging pattern)

**Key Concepts:**
- Unify all context artifacts as nodes in a governed namespace
- `/context/history/` for dialogue turns
- `/context/memory/` for summaries and session memories
- Workspace gets persistent container with built-in search, sharing, version control
- Checkpoint folders within workspace for state preservation
- On restart, reload recent summaries to prime context window

**Key Lesson:** The namespace convention is useful. Our workspace should have a clear path convention: `/{thread_id}/files/`, `/{thread_id}/todos/`, etc.

---

## 3. Human-in-the-Loop Patterns

### 3.1 LangGraph `interrupt()` (Most Production-Proven)

**Source:** https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt
**Confidence:** HIGH (official docs + multiple implementation guides)

**Core Pattern:**
```python
# Agent node
response = interrupt("Do you approve this action?")  
# Execution halts here, state checkpointed

# Resume from client
graph.invoke(Command(resume="Yes, proceed"), thread_config)
# Reruns work within interrupted node (not previous nodes)
```

**State Persistence:**
- Checkpoint-based: every graph step reads from and writes to a checkpoint
- Thread status marked as `interrupted` during pause
- Resources released when interrupted; only storage persists
- Can resume on different machine or months later
- `thread_id` identifies each workflow instance

**Four Primary Patterns:**
1. **Approve/Reject** -- pause before critical actions (API calls, destructive ops)
2. **Review & Edit State** -- human modifies checkpoint data directly
3. **Review Tool Calls** -- validate LLM-requested operations before execution
4. **Multi-turn Conversation** -- iterative agent-human exchanges

**Best Practice:** Interrupt on irreversible, high-blast-radius actions only -- not on every step.

**Key Lesson for v2.7 `ask_user`:** Our `ask_user` tool should follow this pattern: emit an SSE event with the question, persist the pending state to the `runs` table (status='awaiting_input'), release the SSE connection, and resume when the user submits a response via a new API call (`POST /threads/{id}/runs/{run_id}/input`). The agent loop picks up where it left off.

### 3.2 Mastra `suspend()`/`resume()` (TypeScript-Native)

**Source:** https://mastra.ai/docs/workflows/human-in-the-loop
**Confidence:** HIGH (official docs verified)

**Core Pattern:**
- `suspend()` halts workflow at a specific step, persists state to storage
- `suspendSchema` structures the data returned to users (reason, context)
- `resume()` continues with `resumeData` matching the step's `resumeSchema`
- `bail()` stops execution gracefully without error (human rejection path)
- Multi-step approval: each step defines own schemas, resumed in sequence

**Storage Requirement:** Workflows that suspend require persistent storage provider.

**Key Lesson:** The separate `bail()` path for rejection is smart. Our `ask_user` should have a "cancel" path that gracefully terminates the agent loop without it being an error.

### 3.3 AutoGen `UserProxyAgent` + `HandoffTermination`

**Source:** https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html
**Confidence:** HIGH (official docs, code examples verified)

**Two Patterns:**

**1. During-Run (Blocking):**
```python
user_proxy = UserProxyAgent("user_proxy", input_func=input)
# For web: override with custom async websocket handler
async def _user_input(prompt, cancellation_token):
    data = await websocket.receive_json()
    return data["content"]
```
- Blocks execution until human responds
- Good for: approval buttons, urgent alerts, short interactions

**2. Between-Run (Non-Blocking):**
- `HandoffTermination(target="user")` stops team when agent hands off
- Agent declares handoff targets: `Handoff(target="user", message="Transfer to user.")`
- Team preserves conversation history + agent ordering internally
- Resume with same conversation history; turn count resets but internal state preserved

**Key Lesson:** The blocking `input_func` pattern is what we'd use if we kept the SSE connection alive during `ask_user`. But for production, the HandoffTermination pattern (close the run, resume with a new run) is more robust because it doesn't hold connections open.

---

## 4. Sub-Agent / Task Delegation Patterns

### 4.1 Claude Code Task Tool (Gold Standard for UX)

**Source:** https://code.claude.com/docs/en/sub-agents + https://claude.com/blog/seeing-like-an-agent
**Confidence:** HIGH (official docs)

**Architecture:**
- Sub-agents run in **own context window** with custom system prompt, specific tool access, independent permissions
- Parent agent decides when to delegate based on sub-agent's `description`
- Built-in sub-agents: Explore (Haiku, read-only), Plan (inherited model, read-only), General-purpose (inherited model, all tools)
- Sub-agents **cannot spawn other sub-agents** (prevents infinite nesting)
- Results returned as summary to parent context (context savings)

**Configuration:**
- Defined in Markdown files with YAML frontmatter
- Scoped: user-level (~/.claude/agents/) or project-level (.claude/agents/)
- Each specifies: model, tools (allowed/disallowed), permissions, system prompt
- `max_turns` limits sub-agent execution length

**Design Philosophy:**
- ~20 tools total to reduce decision overhead
- Progressive disclosure: agents discover context incrementally
- Task tool replaced TodoWrite -- better for agent-to-agent coordination
- "Seeing like an agent": tools matched to model's actual capabilities

**Key Lesson for v2.7 `task`:** Our `task` tool should: (1) spawn a separate agent_runner invocation with constrained tool list, (2) run in the same thread but emit sub-agent SSE events with a parent_run_id linkage, (3) return a summary to the parent agent's context, (4) cap at 1 level of nesting. The system prompt for the sub-agent should be a subset of the parent's, not the full system prompt.

### 4.2 LangGraph Supervisor Pattern

**Source:** https://github.com/langchain-ai/langgraph-supervisor-py
**Confidence:** HIGH (official package + docs)

**Architecture:**
- `create_supervisor()` creates delegation tools: `delegate_to_{agent_name}`
- Supervisor is a central StateGraph node that routes, doesn't execute
- Workers return results to supervisor state
- Supervisor terminates when it returns without naming a next worker
- `recursion_limit` on `invoke()` bounds worst case

**Key Lesson:** The tool-based delegation (each sub-agent is a tool the supervisor can call) maps directly to how our `task` tool would work. The supervisor pattern is what our main agent loop already does -- it's the orchestrator that decides which tools to call.

### 4.3 CrewAI Hierarchical Process

**Source:** https://docs.crewai.com
**Confidence:** MEDIUM (docs + community guides)

**Architecture:**
- Three process types: sequential, hierarchical (manager delegates), consensual (agents vote)
- `Process.hierarchical` auto-creates a manager agent
- `allow_delegation=True` lets agents decide at runtime to pass subtasks
- Manager reassigns work if output is unsatisfactory

**Key Lesson:** The `allow_delegation=True` flag is an interesting UX idea. Our agent could have delegation as opt-in based on model capabilities -- smaller models shouldn't try to delegate.

---

## 5. Todo/Planning Tool Patterns

### 5.1 LangChain TodoListMiddleware (Most Complete Implementation)

**Source:** https://towardsdatascience.com/how-agents-plan-tasks-with-to-do-lists/
**Confidence:** HIGH (detailed implementation article + code examples)

**Data Structure:**
```python
class Todo(TypedDict):
    content: str  # Task description
    status: str   # pending | in_progress | completed | blocked
```

**Tool Design:**
- `write_todos` -- creates/updates the entire todo list (returns `Command` to update state)
- Middleware (`TodoListMiddleware`) packages: PlanningState, write_todos tool, system prompt injection
- `wrap_model_call()` appends system prompt for every model call
- Status transitions: pending -> in_progress -> completed (or blocked for HITL)

**Integration Pattern:**
- Todos persist in `PlanningState` (agent state, not external DB)
- `OmitFromInput` flag: middleware manages state internally, not sent to LLM as input
- The "highly structured and precise" tool description serves as critical additional prompt

**Key Lesson for v2.7 `write_todos`:** Our tool should: (1) store todos in a `workspace_todos` table per thread, (2) expose `write_todos` (batch create/update) + `read_todos` (current state) as tools, (3) use the 4-status model (pending/in_progress/completed/blocked), (4) inject current todo state into the system prompt on every LLM call so the agent stays aware, (5) emit SSE events for todo changes so the panel updates live.

---

## 6. Vercel AI SDK Patterns (Framework-Level)

### 6.1 AI SDK 5/6 Architecture

**Source:** https://ai-sdk.dev + https://vercel.com/blog/ai-sdk-5
**Confidence:** HIGH (official docs)

**UIMessage vs ModelMessage:**
- `UIMessage`: what React components store and render (tool parts, text, data)
- `ModelMessage`: what gets sent to the LLM
- Clear separation enables rich client-side rendering without polluting LLM context

**Tool Result Rendering:**
- Tool parts use typed naming: `tool-${toolName}` (e.g., `tool-displayWeather`)
- States: `input-available` (executing), `output-available` (ready), `output-error` (failed)
- Client renders per-tool components based on tool name + state

**Streaming:**
- SSE is the standard (custom protocol dropped in v5)
- `toUIMessageStreamResponse()` converts model output to structured SSE
- Data parts: stream arbitrary type-safe data with reconciliation by ID

**Key Lesson:** The `UIMessage`/`ModelMessage` split is the right abstraction. Our SSE events already serve as the "UIMessage" layer; the messages table stores the "ModelMessage" equivalent. The tool-name-to-component-type mapping (`tool-${toolName}`) is exactly what our `ToolCallPanel` already does with per-tool inner-body components.

---

## 7. Cross-Cutting Patterns and Anti-Patterns

### What Works Across Projects

| Pattern | Used By | Why It Works |
|---------|---------|-------------|
| `react-resizable-panels` for split layout | LibreChat, assistant-ui | Accessible, keyboard-friendly, constraints built-in |
| Sandboxed iframe for artifact preview | LibreChat, Open WebUI, assistant-ui, Bolt.diy | Security isolation, supports arbitrary HTML/JS |
| Monaco Editor for code editing | LibreChat (migrated from CodeMirror) | VS Code familiarity, streaming-friendly `applyEdits()` |
| Event-sourced state for agent execution | OpenHands, LangGraph | Deterministic replay, crash recovery, auditability |
| Tool-as-delegation for sub-agents | Claude Code, LangGraph, CrewAI | Fits existing tool-call loop, no new execution model needed |
| Checkpoint-based pause/resume | LangGraph, Mastra, AutoGen | Production-safe, doesn't hold connections open |
| Structured artifact type system | LibreChat, LobeChat, Bolt.diy | Enables per-type rendering components |
| Zustand domain-specific stores | LobeChat, Bolt.diy | Scales to complex UI state without prop drilling |

### What Fails / Gets Complained About

| Anti-Pattern | Seen In | What Goes Wrong |
|--------------|---------|-----------------|
| Auto-detecting artifacts from content | Open WebUI | Panel fails to open, empty panel, requires manual toggle |
| Holding SSE connection during human input | AutoGen (blocking UserProxyAgent) | Connection timeouts, resource waste, single-tab only |
| Single state store for everything | Early LobeChat, early LibreChat | Performance issues, complex subscriptions, re-render storms |
| Sandpack for both editing and preview | Early LibreChat | Slow, flaky, replaced Monaco for editing |
| Ephemeral-only workspace files | OpenHands (files lost on container removal) | Users lose work, no persistence across sessions |
| Infinite sub-agent nesting | (Avoided by all) | Context explosion, runaway costs, unpredictable behavior |
| Content-based artifact parsing | Multiple | Different models format artifacts differently; need explicit signals |

### Architecture Decision Checklist for v2.7

Based on what worked and failed across these projects:

1. **Panel layout:** Use `react-resizable-panels` (already compatible with shadcn/ui via their Resizable component) -- not custom CSS flexbox
2. **Artifact rendering:** Sandboxed iframe for HTML/code preview; raw React components for todos and file browser
3. **Workspace storage:** Supabase Storage for files + DB table for metadata -- NOT ephemeral container storage
4. **Human-in-the-loop:** Checkpoint pattern (close run, persist state, resume via new API call) -- NOT blocking SSE connection
5. **Sub-agent:** Tool-call delegation with 1-level nesting cap, constrained tool list, summary return
6. **Todo persistence:** DB table per thread, 4-status model, system prompt injection, live SSE updates
7. **State management:** Extend existing Zustand `streamsStore` pattern with workspace-specific slices

---

## 8. Specific Implementation Recommendations

### Panel UI

```
+--------------------------------------------+
| Chat Area (70%)     | Panel (30%)          |
|                     | [Tabs: Todos | Files |
|                     |        | Ask User]   |
|  Messages...        |                      |
|                     | [Active tab content] |
|                     |                      |
|  [Input]            | [Collapsible]        |
+--------------------------------------------+
```

- Use shadcn/ui `Resizable` (wrapper around `react-resizable-panels`)
- Panel auto-opens when: todo created, file written, ask_user pending
- Panel auto-collapses to icon strip when empty
- Persist panel open/closed state + active tab in localStorage
- Min panel width: 280px; max: 50%

### Workspace Filesystem

Follow Bolt.diy's `FilesStore` pattern adapted for Supabase:

```
workspace_files table:
  id, thread_id, user_id, path, content_inline (nullable TEXT),
  storage_path (nullable), version, size_bytes, mime_type,
  created_at, updated_at, created_by_run_id

RLS: user_id match + thread ownership check
```

- Files < 64KB: store inline in `content_inline` column (fast reads, no Storage round-trip)
- Files >= 64KB: store in Supabase Storage, reference via `storage_path`
- Auto-version: INSERT new row with incremented `version` on every write
- Agent tools: `write_file`, `read_file`, `list_files` (subset of existing KB tools adapted for workspace scope)

### ask_user Tool

Follow LangGraph's interrupt pattern:

1. Agent calls `ask_user(question, options?)` tool
2. Backend emits `ask_user` SSE event with question + run_id
3. Backend sets `runs.status = 'awaiting_input'`, closes SSE stream gracefully
4. Frontend shows question in Panel's "Ask User" tab with input/options
5. User submits response via `POST /threads/{id}/runs/{run_id}/input`
6. Backend resumes agent loop from the `ask_user` tool return point
7. Tool returns user's response as the tool result

### task Tool (Sub-Agent)

Follow Claude Code's Task pattern:

1. Agent calls `task(description, tools_hint?)` tool
2. Backend spawns a child `agent_runner` with: constrained tools, abbreviated system prompt, same thread_id, new run_id (linked via `parent_run_id`)
3. Child run emits SSE events tagged with `parent_run_id` so frontend nests them
4. Child cannot call `task` (1-level cap enforced by excluding `task` from child tool list)
5. Child completes, summary returned to parent as tool result
6. Frontend shows sub-agent execution as a collapsible card within the parent run

---

## 9. Project Comparison Matrix

| Feature | LibreChat | Open WebUI | LobeChat | Bolt.diy | OpenHands | assistant-ui |
|---------|-----------|------------|----------|----------|-----------|-------------|
| Side panel | Yes (Sandpack) | Yes (iframe) | Yes (XML tags) | Yes (workbench) | N/A (IDE) | Yes (iframe) |
| Panel library | react-resizable-panels | Svelte layout | Next.js layout | Custom | N/A | react-resizable-panels |
| State mgmt | Recoil + React Query | Svelte stores | Zustand + SWR | nanostores + zustand | Event sourcing | Context + hooks |
| Streaming | Express observer | Socket.IO | SSE | SSE (AI SDK) | Event stream | AI SDK SSE |
| File workspace | File uploads | File uploads | Knowledge base | WebContainer FS | Docker /workspace | N/A |
| Artifact types | HTML/React/Mermaid/SVG | HTML/JS/CSS | HTML/SVG/docs/React | Full-stack apps | N/A | HTML/React |
| HITL | No | No | No | No | No (autonomous) | Tool approval |
| Sub-agents | Agent system | No | Agent builder | No | Composable agents | No |
| DB | MongoDB | SQLAlchemy | Drizzle/PG | N/A | Event files | N/A (library) |
| Our stack fit | Medium (Express) | Low (Svelte) | HIGH (Zustand) | Medium (Remix) | HIGH (Python) | HIGH (React) |

---

## 10. Sources

### Artifact Panel / Side Panel
- [LibreChat Artifacts Docs](https://www.librechat.ai/docs/features/artifacts)
- [LibreChat Architecture Gist](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994)
- [LibreChat Monaco Migration PR #12109](https://github.com/danny-avila/LibreChat/pull/12109)
- [LibreChat Static HTML Renderer PR #12337](https://github.com/danny-avila/LibreChat/pull/12337)
- [Open WebUI Artifacts Docs](https://docs.openwebui.com/features/chat-conversations/chat-features/code-execution/artifacts/)
- [Open WebUI Architecture (DeepWiki)](https://deepwiki.com/open-webui/open-webui/2-architecture)
- [LobeChat Wiki Architecture](https://github.com/lobehub/lobe-chat/wiki/Architecture)
- [Bolt.diy Architecture (DeepWiki)](https://deepwiki.com/stackblitz-labs/bolt.diy)
- [assistant-ui Artifacts Example](https://www.assistant-ui.com/examples/artifacts)
- [assistant-ui Tool UI Docs](https://www.assistant-ui.com/docs/guides/tool-ui)
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [shadcn/ui Resizable](https://ui.shadcn.com/docs/components/radix/resizable)

### Workspace / Filesystem
- [OpenHands SDK Paper (arXiv 2511.03690)](https://arxiv.org/html/2511.03690v1)
- [OpenHands Deep Dive (DEV Community)](https://dev.to/truongpx396/openhands-deep-dive-build-your-own-guide-1al0)
- [OpenHands Docker Sandbox Docs](https://docs.openhands.dev/sdk/guides/agent-server/docker-sandbox)
- [Agentic Workflow Storage Guide](https://fast.io/resources/agentic-workflow-storage/)
- [Agentic File System (AFS)](https://www.emergentmind.com/topics/agentic-file-system-afs)

### Human-in-the-Loop
- [LangGraph interrupt() Blog](https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt)
- [LangGraph HITL Docs](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [Mastra HITL Docs](https://mastra.ai/docs/workflows/human-in-the-loop)
- [Mastra Suspend & Resume Docs](https://mastra.ai/docs/workflows/suspend-and-resume)
- [AutoGen HITL Tutorial](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html)
- [Mastra HITL Blog](https://mastra.ai/blog/hitl-where-to-put-approval-in-agents-and-workflows)

### Sub-Agent Delegation
- [Claude Code Sub-Agents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Tool Design Blog](https://claude.com/blog/seeing-like-an-agent)
- [LangGraph Supervisor Package](https://github.com/langchain-ai/langgraph-supervisor-py)
- [LangGraph Multi-Agent Docs](https://reference.langchain.com/python/langgraph-supervisor)
- [CrewAI Multi-Agent Guide](https://tech-insider.org/crewai-tutorial-multi-agent-ai-python-2026/)

### Todo / Planning
- [Agent Todo List Planning (TDS)](https://towardsdatascience.com/how-agents-plan-tasks-with-to-do-lists/)
- [Arize AI: Planning Architecture](https://arize.com/blog/how-to-build-planning-into-your-agent/)

### Framework / SDK
- [Vercel AI SDK 5 Blog](https://vercel.com/blog/ai-sdk-5)
- [Vercel AI SDK Generative UI Docs](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
