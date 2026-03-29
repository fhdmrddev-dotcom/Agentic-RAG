# Architecture Research

**Domain:** Agentic RAG — v2.0 Agent Skills & Code Execution Sandbox
**Researched:** 2026-03-29
**Confidence:** HIGH (based on direct source code inspection of the existing codebase)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend                              │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │   Chat   │  │  Documents  │  │   Skills   │  │ Code Output  │  │
│  │   Tab    │  │     Tab     │  │    Tab     │  │    Panel     │  │
│  └────┬─────┘  └──────┬──────┘  └─────┬──────┘  └──────┬───────┘  │
└───────┼───────────────┼───────────────┼────────────────┼───────────┘
        │ SSE stream    │ REST          │ REST           │ SSE events
┌───────▼───────────────▼───────────────▼────────────────▼───────────┐
│                         FastAPI Backend                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ /threads │  │/documents│  │ /skills  │  │ /sandbox         │   │
│  │ (SSE +   │  │(REST)    │  │(REST)    │  │(signed URLs)     │   │
│  │  CRUD)   │  │          │  │          │  │                  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │             │             │                  │             │
│  ┌────▼─────────────▼─────────────▼──────────────────▼──────────┐  │
│  │                    openai_service.py                          │  │
│  │  get_tools() / get_explorer_tools() → dispatch loop          │  │
│  │  NEW: skills tools + execute_code injected here              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ sandbox/      │  │ skill_store/  │  │  open_standard/       │   │
│  │ session_mgr   │  │ (CRUD + files)│  │  (ZIP parse/generate) │   │
│  │ (lifespan)    │  │               │  │                       │   │
│  └───────┬───────┘  └───────────────┘  └───────────────────────┘   │
│          │ Docker SDK                                               │
│  ┌───────▼────────────────────────────────────────────────────┐    │
│  │           llm-sandbox Docker session pool                   │    │
│  │           (keyed by thread_id, TTL 30 min)                  │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
        │                          │
┌───────▼──────────────┐  ┌────────▼──────────────────────────────────┐
│   Supabase Postgres  │  │         Supabase Storage                  │
│   skills             │  │  documents/   (existing)                  │
│   skill_files        │  │  skill-files/ (new, private)              │
│   code_executions    │  │  sandbox-outputs/ (new, private)          │
│   sandbox_files      │  │                                           │
│   (existing tables)  │  └───────────────────────────────────────────┘
└──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `threads.py` router | SSE chat loop, tool dispatch, message persistence | MODIFIED |
| `openai_service.py` | Tool definitions, `get_tools()`, `create_streaming_chat()` | MODIFIED |
| `skills.py` router | CRUD for skills + building-block file uploads | NEW |
| `sandbox.py` router | Signed URL endpoint, execution file listing | NEW |
| `sandbox/session_manager.py` | Docker session pool keyed by thread_id, TTL, cleanup | NEW |
| `skills/open_standard.py` | ZIP parse/generate, SKILL.md frontmatter, file categorization | NEW |
| `skills`, `skill_files` tables | Skill metadata + file metadata (RLS enforced) | NEW |
| `code_executions`, `sandbox_files` tables | Execution audit log + generated file metadata | NEW |
| `skill-files` storage bucket | Private storage for building-block files | NEW |
| `sandbox-outputs` storage bucket | Private storage for sandbox-generated files | NEW |

---

## Integration Points

### 1. Tool Dispatch Loop (threads.py — MODIFIED)

The `event_stream()` function in `send_message` is the central integration point for all new LLM-facing behavior. The existing pattern is a `for iteration in range(max_iterations)` loop that calls `create_streaming_chat()`, streams chunks, buffers tool calls, and dispatches them in a giant `if/elif` chain.

**What changes:**
- Add `load_skill`, `save_skill`, `read_skill_file`, and (conditionally) `execute_code` to the `elif` dispatch chain
- `execute_code` must be an `async` dispatch path — the current dispatch loop is synchronous inside an `async def`. The sandbox session manager will be async; `execute_code` will need `await` calls or a `asyncio.run_coroutine_threadsafe` bridge. The cleanest approach is converting the `for chunk in stream` loop to `async for` and making the tool dispatch `await`-able.
- New SSE event types emitted from within the dispatch: `skill_activated`, `code_execution_start`, `code_stdout`, `code_stderr`, `code_execution_complete`, `code_execution_error`
- `execute_code` SSE events stream stdout/stderr lines in real time, interleaved with the existing `tool_start`/`tool_end` events

**Existing tool_calls pattern preserved:** `persisted_tool_calls.append({...})` already trims results to 2000 chars before storing in `messages.tool_calls` JSONB. Adding `result` and `tool_call_id` fields to this dict (for Persistent Tool Memory) does not require any schema change.

### 2. System Prompt Injection (threads.py — MODIFIED)

The active system prompt (`SYSTEM_PROMPT` or `EXPLORER_SYSTEM_PROMPT`) is built at request time, then augmented with folder scope context. Skills add a third augmentation layer: the **skill catalog**.

**Injection order:**
```
base system prompt
  + folder scope note (if thread is folder-scoped)
  + skill catalog table (if user has enabled skills)
```

The skill catalog is a lightweight markdown table:

```
## Your Available Skills

| Skill | What it does |
|-------|--------------|
| analyzing-sales-data | Analyzes sales data and generates visual reports... |
| legal-review | Reviews contracts for standard risk clauses... |

Load a skill when the user's request matches its description. Use `load_skill` with the skill name.
```

This is fetched once per request (not cached) from the `skills` table filtered by `enabled = true AND (user_id = current_user_id OR user_id IS NULL)`. The query is cheap: only `name` and `description` columns, no instruction bodies.

### 3. `get_tools()` / Tool Registration (openai_service.py — MODIFIED)

Current shape:
```python
def get_tools() -> list[dict]:
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL,
             GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL]
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    return tools
```

New shape adds three always-present skill tools and one flag-gated sandbox tool:

```python
def get_tools() -> list[dict]:
    tools = [...existing..., LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL]
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    if settings.sandbox_enabled:
        tools.append(EXECUTE_CODE_TOOL)
    return tools
```

`get_explorer_tools()` does NOT get skill tools (explorer mode is KB-navigation-only) and does NOT get `execute_code`. This preserves the clean tool separation between modes.

### 4. Persistent Tool Memory (threads.py — MODIFIED)

**Current history loading** (line 248–254 in threads.py):
```python
history_resp = (
    supabase.table("messages")
    .select("role, content")
    ...
)
messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
for msg in history_resp.data:
    messages.append({"role": msg["role"], "content": msg["content"]})
```

This reconstructs only `role` and `content`, discarding all tool call history.

**Modified history loading:** Fetch `role, content, tool_calls` from messages. For each assistant message that has `tool_calls`, reconstruct three message objects in sequence:

```
1. {"role": "assistant", "tool_calls": [{id, type, function: {name, arguments}}]}
2. {"role": "tool", "tool_call_id": ..., "content": result_string}  -- one per tool call
3. {"role": "assistant", "content": full_content}  -- the text response that followed
```

This matches the OpenAI API's expected multi-turn tool call message structure. The `tool_call_id` must be stored when persisting (add to `persisted_tool_calls` dict entries alongside existing fields). The `arguments` must also be preserved (already stored in `args`).

**No schema change required:** `tool_calls` is already JSONB. The existing `persisted_tool_calls.append({name, args, result, status})` just needs `tool_call_id` added:

```python
persisted_tool_calls.append({
    "tool_call_id": tc["id"],  # ADD THIS
    "name": tool_name,
    "args": args,
    "result": tool_result[:2000],
    "status": "done",
})
```

### 5. FastAPI Application Lifespan (main.py — MODIFIED)

The Docker session manager must start and stop with the application. Currently `main.py` has no lifespan handler. A lifespan context manager must be added:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await session_manager.start()  # starts TTL cleanup background task
    yield
    await session_manager.stop()   # closes all open Docker sessions

app = FastAPI(title="Agentic RAG API", version="1.0.0", lifespan=lifespan)
```

The session manager also needs to hook into thread deletion: when `DELETE /threads/{thread_id}` runs, it must call `session_manager.close_session(thread_id)` if a session exists.

### 6. Config (config.py — MODIFIED)

One new setting added to `Settings`:

```python
sandbox_enabled: bool = False
```

Pattern is identical to `web_search_enabled` — a boolean env var with `false` default. No breaking changes to existing config.

### 7. New FastAPI Routers (main.py — MODIFIED)

Two new routers registered in `main.py`:

```python
from app.api import skills, sandbox

app.include_router(skills.router)    # prefix="/skills"
app.include_router(sandbox.router)   # prefix="/sandbox"
```

### 8. Supabase Storage Buckets (new)

Two new private buckets required — created via migration or Supabase dashboard:

| Bucket | Path pattern | Access |
|--------|-------------|--------|
| `skill-files` | `{user_id}/{skill_id}/{filename}` | Private, signed URLs |
| `sandbox-outputs` | `{user_id}/{thread_id}/{execution_id}/{filename}` | Private, signed URLs |

The existing `documents` bucket uses `supabase.storage.from_("documents").remove([doc["file_path"]])` — the new buckets follow the same access pattern. RLS is enforced at the application layer (backend verifies ownership before generating signed URLs), consistent with how the existing documents bucket works.

---

## New Components — Detailed

### `backend/app/api/skills.py` (NEW)

Standard REST router following the `folders.py` pattern:
- Dependency injection: `get_current_user`, `get_supabase`
- Ownership checks identical to folder ownership: `eq("user_id", current_user["id"])`
- Global skills: `user_id IS NULL` — readable by all authenticated users, not writable
- `PATCH /{id}/share` toggles `user_id` between `current_user["id"]` and `NULL` (mirrors `toggle-global` in folders.py)
- File upload endpoints call `supabase.storage.from_("skill-files").upload(path, data)`
- Export calls the open standard utility module, returns a `StreamingResponse` with `application/zip`
- Import parses uploaded ZIP via the open standard utility module, creates skills in batch

### `backend/app/sandbox/session_manager.py` (NEW)

Manages `llm-sandbox` Docker sessions keyed by `thread_id`:

```
SessionManager
  sessions: dict[thread_id → SandboxSession]
  TTL: 30 min (configurable)

  async start()     → starts background cleanup task (every 60s)
  async stop()      → closes all sessions, cancels cleanup task
  async get_or_create(thread_id) → SandboxSession
  async close_session(thread_id) → None
  async _cleanup()  → evict sessions past TTL
```

The `execute_code` tool handler calls `session_manager.get_or_create(thread_id)` then streams stdout/stderr via async generator, emitting SSE events. The `code_executions` record is written to Supabase after execution completes. Generated files in `/sandbox/output/` are uploaded to `sandbox-outputs` storage bucket and their metadata inserted into `sandbox_files`.

### `backend/app/skills/open_standard.py` (NEW)

Pure utility module with no I/O side effects — takes data in, returns data out:

```python
def parse_skill_zip(zip_bytes: bytes) -> list[ParsedSkill]:
    """Parse ZIP → list of {name, description, instructions, license,
       compatibility, metadata, files: list[{filename, category, content}]}"""

def generate_skill_zip(skill: dict, files: list[dict]) -> bytes:
    """Skill dict + file list → ZIP bytes with SKILL.md + categorized subdirs"""

def categorize_file(filename: str, mime_type: str) -> str:
    """Returns 'scripts', 'references', or 'assets'"""
```

No database access, no HTTP calls. Tested independently. Called by `skills.py` router endpoints.

---

## Data Flow

### New Skill Loading Flow (per chat turn)

```
POST /threads/{id}/messages
    ↓
event_stream() builds messages list
    ↓
Fetch enabled skills → build catalog markdown
    ↓
Inject catalog into system prompt
    ↓
LLM call → LLM calls load_skill("analyzing-sales-data")
    ↓
dispatch: fetch skill instructions + file list from skills/skill_files tables
    ↓
yield SSE: skill_activated
    ↓
append tool result to messages
    ↓
LLM continues with full skill instructions in context
    ↓
persist tool call in tool_calls JSONB
```

### Code Execution Flow (per execute_code tool call)

```
LLM calls execute_code({code, libraries, output_files})
    ↓
dispatch: session_manager.get_or_create(thread_id)
    ↓
yield SSE: code_execution_start
    ↓
session.run(code, libraries) → async stdout/stderr stream
    ↓
yield SSE: code_stdout / code_stderr (per line, real-time)
    ↓
upload generated files → sandbox-outputs bucket
    ↓
insert code_executions + sandbox_files rows
    ↓
yield SSE: code_execution_complete {exit_code, files: [{filename, url}]}
    ↓
tool_result = summary string with exit code + file count
    ↓
append to messages, persist in tool_calls JSONB
```

### Persistent Tool Memory — History Reconstruction

```
New turn arrives → load messages from DB (role, content, tool_calls)
    ↓
For each message row:
  if role="assistant" and tool_calls is not null:
    emit {role: "assistant", tool_calls: [...reconstructed...]}
    for each tc in tool_calls:
      emit {role: "tool", tool_call_id: tc.tool_call_id, content: tc.result}
    emit {role: "assistant", content: row.content}  [if content non-empty]
  else:
    emit {role: msg.role, content: msg.content}
    ↓
LLM receives full multi-turn tool call history
```

---

## Recommended Project Structure Changes

```
backend/app/
├── api/
│   ├── threads.py          # MODIFIED — new tool dispatch + history reconstruction
│   ├── folders.py          # unchanged
│   ├── documents.py        # unchanged
│   ├── kb.py               # unchanged
│   ├── settings.py         # unchanged
│   ├── skills.py           # NEW — skill CRUD, file upload, import/export
│   └── sandbox.py          # NEW — signed URL, execution file listing
├── sandbox/
│   ├── __init__.py
│   └── session_manager.py  # NEW — Docker session pool, TTL, lifespan hooks
├── skills/
│   ├── __init__.py
│   └── open_standard.py    # NEW — ZIP parse/generate, SKILL.md parsing
├── services/
│   └── openai_service.py   # MODIFIED — 3 new tool defs, get_tools() additions
├── config.py               # MODIFIED — sandbox_enabled flag
└── main.py                 # MODIFIED — lifespan handler, 2 new router registrations
```

---

## Build Order (Dependency Graph)

The features have a clear dependency chain. Build in this order:

### Phase 1: Persistent Tool Memory
**Why first:** Zero new dependencies. Touches only `threads.py` and `openai_service.py`. Validates that tool call round-trips work end-to-end before adding new tools. If history reconstruction breaks existing chat, it's isolated before adding sandbox complexity.

**New:** None
**Modified:** `threads.py` (history loading + persist `tool_call_id`), no schema change

### Phase 2: Agent Skills Core (DB + API)
**Why second:** Skills API has no dependency on sandbox. Establishes the new router pattern, storage bucket, RLS policy, and ownership model that skill files inherit.

**New:** `skills` table + RLS, `skill-files` storage bucket, `backend/app/api/skills.py`, `backend/app/skills/open_standard.py`
**Modified:** `main.py` (register router)

### Phase 3: Skills LLM Integration
**Why third:** Depends on Skills Core being queryable. Adds the catalog injection and tool dispatch without any Docker dependency.

**New:** `LOAD_SKILL_TOOL`, `SAVE_SKILL_TOOL`, `READ_SKILL_FILE_TOOL` definitions in `openai_service.py`
**Modified:** `get_tools()` in `openai_service.py`, `event_stream()` in `threads.py` (catalog injection + dispatch branches), `config.py` (no new settings — skills are always on)

### Phase 4: Skills Open Standard (Import/Export)
**Why fourth:** Pure utility layer. Depends on `skills.py` router endpoints existing to wire import/export to. The `open_standard.py` module is side-effect-free and can be developed in parallel, but the endpoints need the router to exist.

**New:** Import/export endpoints in `skills.py`, Bulk import logic
**Modified:** `open_standard.py` (already created in Phase 2 as stub)

### Phase 5: Code Execution Sandbox
**Why last:** Depends on lifespan pattern, Docker infrastructure, new SSE event types, new tables. Highest risk feature. Isolating it last means all other features are fully functional before introducing Docker complexity.

**New:** `code_executions` + `sandbox_files` tables + RLS, `sandbox-outputs` bucket, `backend/app/sandbox/session_manager.py`, `backend/app/api/sandbox.py`, `EXECUTE_CODE_TOOL` definition, custom Docker image (`Dockerfile.sandbox`)
**Modified:** `main.py` (lifespan handler + sandbox router), `config.py` (`sandbox_enabled` flag), `threads.py` (execute_code dispatch branch + new SSE events), `delete_thread` endpoint (close sandbox session on delete)

---

## Architectural Patterns

### Pattern 1: Tool-as-Dispatch-Branch

**What:** Every LLM tool is handled as an `elif` branch inside `event_stream()`. The tool name string from the LLM is the dispatch key. Tool implementations are either inline (simple) or call out to service functions (complex).

**When to use:** Always — this is the existing pattern. New tools must follow it.

**Trade-offs:** Single large function, but the linear structure makes the control flow easy to read and debug. Refactoring to a `tool_registry: dict[str, Callable]` is possible later but is not needed now.

**New tool additions follow this exact shape:**
```python
elif tool_name == "load_skill":
    skill_id = args["skill_name"]
    result = load_skill_instructions(skill_id, current_user["id"], supabase)
    yield f"data: {json.dumps({'type': 'skill_activated', 'name': skill_id})}\n\n"
    tool_result = json.dumps(result)
```

### Pattern 2: Feature-Flag Gating via Settings

**What:** Settings (`config.py`) uses `pydantic-settings` with `bool` fields defaulting to `False`. The tool is appended to `get_tools()` only when the flag is `True`.

**When to use:** Any feature that requires external infrastructure (Docker for sandbox, Tavily for web search) or that adds cost/risk when enabled.

**Sandbox follows web_search pattern exactly:**
```python
@property
def web_search_enabled(self) -> bool:
    return bool(self.tavily_api_key)

# New:
sandbox_enabled: bool = False
```

### Pattern 3: Ownership Model (Global/Private)

**What:** `user_id = NULL` means global (visible to all, writable by no one except seeded data). `user_id = current_user.id` means private. Toggle-global flips `user_id` between the two states.

**When to use:** Skills follow the same model as folders and documents. The `share` endpoint sets `user_id = NULL`; unsharing sets it back to the caller's ID. RLS policy: `SELECT WHERE user_id = auth.uid() OR user_id IS NULL`.

**Pattern is identical to `toggle-global` in `folders.py`** — no new concepts needed.

### Pattern 4: SSE Event Envelope

**What:** Every SSE event is `data: {JSON}\n\n` where the JSON has a `type` field. Frontend routes on `type`.

**Existing types:** `delta`, `tool_start`, `tool_end`, `sub_agent_start`, `sub_agent_delta`, `sub_agent_done`, `title`, `error`

**New types to add:**
- `skill_activated` — `{type, name}` — skill loaded by LLM
- `code_execution_start` — `{type, execution_id}`
- `code_stdout` — `{type, line}`
- `code_stderr` — `{type, line}`
- `code_execution_complete` — `{type, exit_code, duration_ms, files: [{filename, url, size}]}`
- `code_execution_error` — `{type, message}`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Injecting Full Skill Instructions into System Prompt

**What people do:** Dump all skill instructions for all enabled skills into the system prompt on every request.

**Why it's wrong:** Skills are designed for progressive disclosure. Even 10 skills with moderate instructions will consume 5-15k tokens every request, inflating cost significantly. The catalog/load pattern is specifically designed to avoid this.

**Do this instead:** Inject only `name` + `description` (the catalog table) into the system prompt. Full instructions load only when `load_skill` is called.

### Anti-Pattern 2: Synchronous Docker Calls Inside the SSE Generator

**What people do:** Call `session.run(code)` synchronously inside the async `event_stream()` generator, blocking the event loop while Docker executes.

**Why it's wrong:** Blocks FastAPI's async event loop. All other requests stall while code executes. SSE events stop flowing until execution completes (no real-time output).

**Do this instead:** Make `execute_code` dispatch use `await` with an async Docker session API, or run in a thread pool via `asyncio.run_in_executor`. Stream stdout/stderr lines as they arrive via `async for line in session.stream()`.

### Anti-Pattern 3: Storing Full Tool Results Without Size Cap

**What people do:** Store the complete `tool_result` string in the `tool_calls` JSONB column for history reconstruction.

**Why it's wrong:** Search results, file trees, and grep output can be tens of kilobytes. Storing full results for every tool call in every assistant message will bloat the database quickly.

**Do this instead:** The existing code already trims to `result[:2000]`. Keep this cap. The LLM still has the full result in-context during the current turn; the persisted result is for reconstruction, not for full replay.

### Anti-Pattern 4: One Docker Container Per Request

**What people do:** Spin up a fresh Docker container for each `execute_code` call.

**Why it's wrong:** Container startup takes 2-5 seconds per call, destroying interactivity. Variables and installed packages don't persist across calls in the same conversation.

**Do this instead:** The session manager maintains one container per thread_id, reusing it for the conversation lifetime. Container startup cost is paid once per thread, not per tool call.

### Anti-Pattern 5: Explorer Mode Gets Skill or Sandbox Tools

**What people do:** Add new tools to `get_tools()` and forget to check that `get_explorer_tools()` is separately maintained.

**Why it's wrong:** Explorer mode is intentionally KB-navigation-only. Injecting `load_skill` or `execute_code` breaks the focused behavior contract.

**Do this instead:** Skills tools and execute_code belong only in `get_tools()`. `get_explorer_tools()` returns its own static list and must not be changed.

---

## Integration Points Summary

### What is NEW (net-new files and tables)

| Artifact | Type | Purpose |
|----------|------|---------|
| `backend/app/api/skills.py` | Router | Skill CRUD, file management, import/export |
| `backend/app/api/sandbox.py` | Router | Signed download URLs, execution file listing |
| `backend/app/sandbox/session_manager.py` | Service | Docker session pool with TTL and lifespan |
| `backend/app/skills/open_standard.py` | Utility | ZIP parse/generate, SKILL.md parsing |
| `skills` table | DB | Skill metadata, global/private ownership |
| `skill_files` table | DB | Building-block file metadata |
| `code_executions` table | DB | Execution audit log |
| `sandbox_files` table | DB | Generated file metadata |
| `skill-files` bucket | Storage | Building-block file storage |
| `sandbox-outputs` bucket | Storage | Sandbox-generated file storage |
| `LOAD_SKILL_TOOL` | Tool def | LLM tool definition |
| `SAVE_SKILL_TOOL` | Tool def | LLM tool definition |
| `READ_SKILL_FILE_TOOL` | Tool def | LLM tool definition |
| `EXECUTE_CODE_TOOL` | Tool def | LLM tool definition (sandbox-gated) |
| `Dockerfile.sandbox` | Docker | Custom Python image with pre-installed libs |

### What is MODIFIED (existing files changed)

| File | What Changes |
|------|-------------|
| `backend/app/main.py` | Add lifespan handler, register `/skills` and `/sandbox` routers |
| `backend/app/config.py` | Add `sandbox_enabled: bool = False` |
| `backend/app/services/openai_service.py` | Add 4 new tool defs, extend `get_tools()` |
| `backend/app/api/threads.py` | History reconstruction (Persistent Tool Memory), skill catalog injection, 4 new `elif` dispatch branches, new SSE event types, `tool_call_id` in persisted tool calls, session cleanup on thread delete |

### What is UNCHANGED

All existing routers (`folders.py`, `documents.py`, `kb.py`, `settings.py`), all existing services (`retrieval_service.py`, `embedding_service.py`, `rerank_service.py`, `web_search_service.py`, `sql_service.py`, `sub_agent_service.py`), all existing tables, the `documents` storage bucket, and the frontend's existing Chat and Documents tabs are entirely unchanged.

---

## Sources

- Direct source inspection: `backend/app/api/threads.py` (tool dispatch loop, SSE pattern, message persistence)
- Direct source inspection: `backend/app/services/openai_service.py` (tool definitions, get_tools pattern, feature-flag pattern)
- Direct source inspection: `backend/app/api/folders.py` (ownership model, global/private toggle pattern)
- Direct source inspection: `backend/app/config.py` (Settings class, web_search_enabled pattern)
- Direct source inspection: `backend/app/main.py` (router registration, no existing lifespan)
- PRD: `PRD-Skills-Sandbox.md` (feature specifications, SSE event types, storage bucket paths)
- Project context: `.planning/PROJECT.md` (existing schema, agent modes, Key Decisions)

---
*Architecture research for: v2.0 Agent Skills & Code Execution Sandbox*
*Researched: 2026-03-29*
