# Phase 14: Code Execution Sandbox - Research

**Researched:** 2026-04-03
**Domain:** Docker sandbox session management, llm-sandbox library, SSE streaming, FastAPI lifespan
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAND-01 | `execute_code` LLM tool available in General Mode when `SANDBOX_ENABLED=true` | Tool definition pattern matches existing skill tools in openai_service.py |
| SAND-02 | Each chat thread maintains a persistent Docker sandbox session (keyed by `thread_id`, TTL 30 min) | `SandboxSession` with explicit `open()`/`close()` lifecycle; dict-based session manager |
| SAND-03 | Python sandbox via `llm-sandbox`; variables and packages persist across calls within same thread | `InteractiveSandboxSession` uses IPython kernel — state persists across `run()` calls |
| SAND-04 | `execute_code` supports specifying additional PyPI packages to install before execution | `run(code, libraries=["numpy"])` parameter documented in llm-sandbox API |
| SAND-05 | Stdout and stderr streamed in real time via SSE (`code_stdout`, `code_stderr` events) | `on_stdout`/`on_stderr` callbacks in `run()`; bridge to asyncio Queue needed |
| SAND-06 | `code_execution_start` and `code_execution_complete` SSE events | Custom SSE events emitted before/after `run()` call, same pattern as `skill_activated` |
| SAND-07 | Files written to `/sandbox/output/` uploaded to `sandbox-outputs` Supabase Storage | Post-execution file harvest + Supabase storage upload, same pattern as skill-files bucket |
| SAND-08 | Sandbox-generated file metadata stored in `sandbox_files` table with signed download URLs | New DB table with RLS, mirroring `skill_files` schema |
| SAND-09 | Execution logged to `code_executions` table | New DB table with `thread_id`, `code`, `exit_code`, `duration`, `created_at` |
| SAND-10 | Docker session closed when associated thread is deleted | Hook `delete_thread` endpoint to call `session_manager.close_session(thread_id)` |
| SAND-11 | Sandbox session manager starts/stops with FastAPI lifespan | `@asynccontextmanager lifespan` pattern in `main.py` |
| SAND-13 | When `SANDBOX_ENABLED=false`, `execute_code` not registered — no Docker import at startup | Conditional tool registration in `get_tools()`; lazy import of llm-sandbox |
</phase_requirements>

---

## Summary

Phase 14 adds a Docker-based Python code execution sandbox to the existing FastAPI backend. The key library is `llm-sandbox` (v0.3.37), which wraps Docker containers and provides an `InteractiveSandboxSession` that maintains IPython kernel state across multiple `run()` calls — making variables and installed packages persist within a thread session.

The central design challenge is bridging the synchronous, callback-based `llm-sandbox` API into the async SSE event stream already used for chat. The `on_stdout`/`on_stderr` callbacks execute in worker threads, so a `asyncio.Queue` bridge is required to relay chunks back to the async event generator. The session manager is a module-level dict (`dict[str, InteractiveSandboxSession]`) initialized in the FastAPI lifespan handler; sessions are keyed by `thread_id` and lazily created on first `execute_code` call.

The phase also adds two new DB tables (`code_executions`, `sandbox_files`), a new Supabase Storage bucket (`sandbox-outputs`), and extends the thread-delete endpoint to close the associated Docker session. The `SANDBOX_ENABLED` env var gates all Docker dependency — when false, the tool is never registered and `llm-sandbox` is never imported.

**Primary recommendation:** Use `InteractiveSandboxSession` (not `SandboxSession`) — it is the only session type that persists IPython kernel state (variables, imports, installed packages) across multiple `run()` calls, which is required by SAND-03.

---

## Project Constraints (from CLAUDE.md)

- Python backend must use a `venv` virtual environment — `llm-sandbox` must be added to `requirements.txt`
- No LangChain, no LangGraph — raw Docker SDK calls via `llm-sandbox` only
- Use Pydantic for structured LLM outputs (tool args validated via Pydantic where needed)
- All tables need Row-Level Security — `code_executions` and `sandbox_files` require RLS policies
- Stream chat responses via SSE — `code_stdout`/`code_stderr` are new SSE event types
- Use Supabase Realtime for ingestion status updates (not applicable here — code streaming is SSE)
- Module 2+ uses stateless completions — store and send chat history yourself (no change)
- Ingestion is manual file upload only (not applicable)
- Save plans to `.agent/plans/` folder with naming convention (planning constraint)

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| llm-sandbox | 0.3.37 | Docker sandbox session management | Requirements spec calls it out explicitly (SAND-03) |
| docker (SDK) | transitive via llm-sandbox[docker] | Docker API client | llm-sandbox[docker] installs it automatically |
| asyncio (stdlib) | built-in | Queue bridge for streaming callbacks | Bridges blocking sandbox callbacks to async SSE |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| llm-sandbox[docker] | 0.3.37 | Docker-specific extras | Always — this project uses Docker backend |
| contextlib (stdlib) | built-in | `@asynccontextmanager` for lifespan | Required for FastAPI lifespan pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| InteractiveSandboxSession | SandboxSession | SandboxSession resets state on each run — does NOT meet SAND-03 (session persistence) |
| llm-sandbox | direct Docker SDK (docker-py) | llm-sandbox abstracts container lifecycle, library install, streaming callbacks — hand-rolling is significantly more code |
| asyncio.Queue bridge | threading.Event | Queue is cleaner for producer/consumer SSE streaming; supports backpressure |

**Installation:**
```bash
pip install 'llm-sandbox[docker]'
```

Add to `requirements.txt`:
```
llm-sandbox[docker]>=0.3.37
```

**Version verification:** Confirmed current version is 0.3.37 (released March 2, 2026) via PyPI.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── main.py                  # Add lifespan handler (SAND-11)
│   ├── config.py                # Add SANDBOX_ENABLED, SANDBOX_TTL_MINUTES settings
│   ├── api/
│   │   └── threads.py           # Add execute_code handler + thread delete hook (SAND-10)
│   └── services/
│       └── sandbox_service.py   # SandboxSessionManager class (SAND-02, SAND-11)
└── supabase/
    └── migrations/
        └── 019_sandbox.sql      # code_executions + sandbox_files tables + RLS + bucket
```

### Pattern 1: SandboxSessionManager (Module-Level Singleton)

**What:** A class (or dict + functions) that owns the dict of open sessions, keyed by `thread_id`. Initialized in FastAPI lifespan so it starts/stops with the app.

**When to use:** All sandbox operations go through this manager; `execute_code` handler asks it for a session, creating one if absent.

```python
# Source: FastAPI lifespan docs + llm-sandbox open()/close() API
from contextlib import asynccontextmanager
from llm_sandbox import InteractiveSandboxSession

_sessions: dict[str, InteractiveSandboxSession] = {}

class SandboxSessionManager:
    def get_or_create(self, thread_id: str) -> InteractiveSandboxSession:
        if thread_id not in _sessions:
            session = InteractiveSandboxSession(lang="python")
            session.open()
            _sessions[thread_id] = session
        return _sessions[thread_id]

    def close_session(self, thread_id: str) -> None:
        session = _sessions.pop(thread_id, None)
        if session:
            try:
                session.close()
            except Exception:
                pass  # best-effort cleanup

    def close_all(self) -> None:
        for thread_id in list(_sessions.keys()):
            self.close_session(thread_id)

sandbox_manager = SandboxSessionManager()

# In main.py:
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # sandbox_manager is already ready (sessions created on demand)
    sandbox_manager.close_all()  # cleanup on shutdown

app = FastAPI(lifespan=lifespan, ...)
```

### Pattern 2: Async SSE Bridge via asyncio.Queue

**What:** llm-sandbox callbacks run in a worker thread. To relay them to an async SSE generator, push chunks into an `asyncio.Queue` from the callback, then `await queue.get()` in the async generator.

**When to use:** Every `execute_code` call — bridges blocking `run()` into the async event stream.

```python
# Source: Python asyncio docs — loop.call_soon_threadsafe pattern
import asyncio

async def run_code_with_streaming(session, code, libraries, loop, queue):
    """Run in thread pool — puts SSE events into queue."""
    def on_stdout(chunk: str):
        loop.call_soon_threadsafe(
            queue.put_nowait,
            {"type": "code_stdout", "content": chunk}
        )
    def on_stderr(chunk: str):
        loop.call_soon_threadsafe(
            queue.put_nowait,
            {"type": "code_stderr", "content": chunk}
        )
    result = session.run(code, libraries=libraries, on_stdout=on_stdout, on_stderr=on_stderr)
    loop.call_soon_threadsafe(queue.put_nowait, {"type": "_done", "result": result})

# In the async SSE generator (threads.py):
async def stream_execution(session, code, libraries):
    loop = asyncio.get_event_loop()
    queue = asyncio.Queue()
    fut = asyncio.get_event_loop().run_in_executor(
        None, lambda: run_code_sync(session, code, libraries, loop, queue)
    )
    while True:
        item = await queue.get()
        if item["type"] == "_done":
            break
        yield f"data: {json.dumps(item)}\n\n"
    await fut  # ensure thread completes
```

### Pattern 3: Conditional Tool Registration (SAND-13)

**What:** `execute_code` tool is only added to `get_tools()` when `SANDBOX_ENABLED=true`. The llm-sandbox import is guarded so Docker is never required at startup when disabled.

```python
# In config.py:
sandbox_enabled: bool = False
sandbox_ttl_minutes: int = 30

# In openai_service.py get_tools():
def get_tools() -> list[dict]:
    tools = [...]  # existing tools
    if settings.sandbox_enabled:
        tools.append(EXECUTE_CODE_TOOL)
    return tools

# In sandbox_service.py (lazy import):
if settings.sandbox_enabled:
    from llm_sandbox import InteractiveSandboxSession
```

### Pattern 4: Output File Harvest + Supabase Upload

**What:** After `session.run()` completes, copy files from `/sandbox/output/` inside the container to a temp directory, upload each to Supabase `sandbox-outputs` bucket, insert rows into `sandbox_files` table, return signed URLs in `code_execution_complete` event.

**When to use:** Post-execution step, only when exit_code indicates completion.

```python
# After run() completes:
import tempfile, os
output_files = []
try:
    # llm-sandbox copy_from_runtime copies files out of container
    with tempfile.TemporaryDirectory() as tmpdir:
        session.copy_from_runtime("/sandbox/output/", tmpdir)
        for fname in os.listdir(tmpdir):
            fpath = os.path.join(tmpdir, fname)
            with open(fpath, "rb") as f:
                data = f.read()
            storage_path = f"{user_id}/{execution_id}/{fname}"
            supabase.storage.from_("sandbox-outputs").upload(storage_path, data)
            # Insert sandbox_files row, generate signed URL
            signed = supabase.storage.from_("sandbox-outputs").create_signed_url(storage_path, 3600)
            output_files.append({"filename": fname, "url": signed["signedURL"]})
except Exception:
    pass  # output dir may not exist — not an error
```

### Anti-Patterns to Avoid

- **Running `session.run()` directly in an async function:** `run()` is blocking — it will stall the FastAPI event loop entirely. Always use `run_in_executor`.
- **Using `SandboxSession` instead of `InteractiveSandboxSession`:** `SandboxSession` starts a fresh process for each `run()` call — variables do not persist. SAND-03 requires `InteractiveSandboxSession`.
- **Importing llm-sandbox unconditionally:** Docker SDK import will fail if Docker is not installed. Guard with `if settings.sandbox_enabled`.
- **Storing sessions in a request-scoped object:** The dict must be module-level (or app-level via `app.state`) to persist across requests.
- **Not cleaning up on thread delete:** Leaked containers accumulate and exhaust Docker resources. Always call `session.close()` in the thread-delete endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Container lifecycle (create, start, exec, stop, remove) | Custom docker-py wrapper | `llm-sandbox` | Handles image pull, Python environment, library install, streaming, cleanup |
| PyPI package installation inside container | Custom exec("pip install...") | `libraries` parameter in `run()` | llm-sandbox handles pip install before code execution |
| IPython kernel state persistence | Custom exec context | `InteractiveSandboxSession` | Maintains full IPython kernel across calls — variables, imports, installed packages |
| Streaming stdout/stderr from container | `container.exec_run(stream=True)` | `on_stdout`/`on_stderr` callbacks | Already wired and thread-safe in llm-sandbox |
| Container image management | Dockerfile management | `llm-sandbox` default image | Default Python image works for general use; override via `image=` if needed |

**Key insight:** llm-sandbox abstracts 200+ lines of docker-py boilerplate into a 3-line session. The value is in the IPython kernel persistence and library install pipeline.

---

## Common Pitfalls

### Pitfall 1: Blocking the Event Loop with session.run()

**What goes wrong:** `session.run()` is a synchronous blocking call — if called directly in an `async def` FastAPI handler or SSE generator, it blocks the entire uvicorn event loop for the duration of code execution. All other requests stall.

**Why it happens:** llm-sandbox is a sync library; its callbacks run in worker threads but the `run()` call itself is blocking.

**How to avoid:** Always wrap `session.run()` in `asyncio.get_event_loop().run_in_executor(None, ...)`. Use `asyncio.Queue` to bridge callback chunks back to the async SSE generator.

**Warning signs:** FastAPI stops responding to health checks during code execution.

### Pitfall 2: SandboxSession vs InteractiveSandboxSession

**What goes wrong:** Using `SandboxSession` instead of `InteractiveSandboxSession` — each `run()` call starts a fresh Python process so variables defined in call N are gone by call N+1.

**Why it happens:** The basic examples in llm-sandbox docs all show `SandboxSession`.

**How to avoid:** Use `InteractiveSandboxSession` explicitly. SAND-03 requires this.

**Warning signs:** `x = 5` in one execute_code call, then `print(x)` in the next call raises `NameError`.

### Pitfall 3: Thread-Unsafe Queue writes from callbacks

**What goes wrong:** Callbacks (`on_stdout`, `on_stderr`) run in a worker thread. Calling `await queue.put()` from a worker thread crashes — `await` is not valid outside an async context.

**Why it happens:** `on_stdout` is called by llm-sandbox in a `concurrent.futures` thread, not in the asyncio event loop.

**How to avoid:** Use `loop.call_soon_threadsafe(queue.put_nowait, item)` instead of `await queue.put()`.

**Warning signs:** `RuntimeError: no running event loop` in the callback thread.

### Pitfall 4: Leaked Docker Containers on Server Restart

**What goes wrong:** If the FastAPI process is killed without running the lifespan shutdown, `_sessions` dict is lost but Docker containers keep running. On restart, new sessions are created, orphaning the old containers.

**Why it happens:** `session.open()` creates containers; `session.close()` removes them. Skipped shutdown = orphaned containers.

**How to avoid:** The lifespan shutdown calls `sandbox_manager.close_all()`. Additionally, consider using a named container prefix so orphans can be detected and cleaned up on startup.

**Warning signs:** `docker ps` shows accumulating `python-sandbox-*` containers after repeated restarts.

### Pitfall 5: /sandbox/output/ directory doesn't exist by default

**What goes wrong:** User code writes to `/sandbox/output/filename.csv` but the directory doesn't exist inside the container — `FileNotFoundError` in user code.

**Why it happens:** The default container image doesn't pre-create this directory.

**How to avoid:** In the execute_code handler, prepend a `mkdir -p /sandbox/output` setup snippet before running user code, or ensure the sandbox image is custom-built with this directory.

**Warning signs:** User code throws `FileNotFoundError: /sandbox/output/`.

### Pitfall 6: SANDBOX_ENABLED=false but llm-sandbox imported at module level

**What goes wrong:** Importing `from llm_sandbox import InteractiveSandboxSession` at the top of `sandbox_service.py` causes an import-time Docker SDK initialization that fails if Docker is not installed.

**Why it happens:** The Docker SDK's `from_env()` call happens at import time in some versions.

**How to avoid:** Guard the import inside `if settings.sandbox_enabled:` blocks. The `sandbox_service.py` module should only be imported conditionally (or use lazy imports within functions).

---

## Code Examples

### execute_code Tool Definition

```python
# Source: Matches pattern of existing tool definitions in openai_service.py
EXECUTE_CODE_TOOL = {
    "type": "function",
    "function": {
        "name": "execute_code",
        "description": (
            "Execute Python code in a sandboxed Docker container. "
            "Variables and installed packages persist across calls within the same conversation thread. "
            "Write output files to /sandbox/output/ — they will be returned as download links."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code to execute.",
                },
                "libraries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of PyPI packages to install before execution (e.g. ['pandas', 'matplotlib']).",
                },
                "output_files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of expected output filenames in /sandbox/output/ to return as download links.",
                },
            },
            "required": ["code"],
        },
    },
}
```

### Session Manager (sandbox_service.py)

```python
# Source: llm-sandbox open()/close() API + FastAPI lifespan docs
from __future__ import annotations
import logging
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

# Lazy import — only if sandbox is enabled
_sessions: dict[str, object] = {}


class SandboxSessionManager:
    def get_or_create(self, thread_id: str):
        """Return existing session or create a new one keyed by thread_id."""
        from llm_sandbox import InteractiveSandboxSession  # lazy import
        if thread_id not in _sessions:
            session = InteractiveSandboxSession(lang="python", verbose=False)
            session.open()
            _sessions[thread_id] = session
            logger.info("Sandbox session opened for thread %s", thread_id)
        return _sessions[thread_id]

    def close_session(self, thread_id: str) -> None:
        session = _sessions.pop(thread_id, None)
        if session:
            try:
                session.close()
                logger.info("Sandbox session closed for thread %s", thread_id)
            except Exception as e:
                logger.warning("Error closing sandbox session %s: %s", thread_id, e)

    def close_all(self) -> None:
        for thread_id in list(_sessions.keys()):
            self.close_session(thread_id)


sandbox_manager = SandboxSessionManager()
```

### FastAPI Lifespan (main.py)

```python
# Source: FastAPI lifespan docs https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing to do — sessions created on demand
    yield
    # Shutdown: close all open sandbox sessions
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()

app = FastAPI(title="Agentic RAG API", version="1.0.0", lifespan=lifespan)
```

### Async Bridge Pattern (in threads.py execute_code handler)

```python
# Source: Python asyncio docs — loop.call_soon_threadsafe for thread-to-async bridge
import asyncio
import json

async def _execute_code_streaming(session, code, libraries, queue, loop):
    """Runs session.run() in thread pool, streams chunks via asyncio.Queue."""
    def on_stdout(chunk: str):
        loop.call_soon_threadsafe(
            queue.put_nowait,
            json.dumps({"type": "code_stdout", "content": chunk})
        )
    def on_stderr(chunk: str):
        loop.call_soon_threadsafe(
            queue.put_nowait,
            json.dumps({"type": "code_stderr", "content": chunk})
        )

    def _run_sync():
        return session.run(
            code,
            libraries=libraries or [],
            on_stdout=on_stdout,
            on_stderr=on_stderr,
        )

    result = await asyncio.get_event_loop().run_in_executor(None, _run_sync)
    loop.call_soon_threadsafe(queue.put_nowait, json.dumps({"type": "_done"}))
    return result
```

### SQL Migration (019_sandbox.sql skeleton)

```sql
-- code_executions table
CREATE TABLE IF NOT EXISTS public.code_executions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL,
  exit_code   integer,
  duration_ms integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.code_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own executions"
  ON public.code_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executions"
  ON public.code_executions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- sandbox_files table
CREATE TABLE IF NOT EXISTS public.sandbox_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    uuid NOT NULL REFERENCES public.code_executions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sandbox_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sandbox files"
  ON public.sandbox_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sandbox files"
  ON public.sandbox_files FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false)
ON CONFLICT (id) DO NOTHING;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` / `@app.on_event("shutdown")` | `lifespan` async context manager | FastAPI 0.95+ | Cleaner lifecycle; `on_event` deprecated |
| `SandboxSession` for all use cases | `InteractiveSandboxSession` for stateful workflows | llm-sandbox 0.2.x+ | Session state (variables, packages) now persists |
| Custom docker-py wrappers | `llm-sandbox` abstraction | 2024+ | Reduces boilerplate; handles library install pipeline |

**Deprecated/outdated:**
- `@app.on_event("startup")`: Deprecated in FastAPI 0.95+ — use `lifespan` instead. The existing `main.py` does not use it yet, so lifespan can be added cleanly.

---

## Open Questions

1. **llm-sandbox `copy_from_runtime` API**
   - What we know: `session.copy_from_runtime(src, dest)` exists per llm-sandbox docs
   - What's unclear: Exact method signature and whether it works with `InteractiveSandboxSession` specifically
   - Recommendation: Verify by testing in Wave 0; fallback is using docker-py `container.get_archive()` directly

2. **TTL for sessions (SAND-02 specifies 30 minutes)**
   - What we know: llm-sandbox does not have built-in TTL; sessions persist until explicitly closed
   - What's unclear: Whether TTL should be enforced in the session manager via a timestamp or via a background task
   - Recommendation: Store `last_used` timestamp alongside session in the dict; check and close on next `get_or_create` call for the same thread (lazy eviction) or add a background task. Lazy eviction is simpler and avoids async scheduling complexity.

3. **Container image selection**
   - What we know: llm-sandbox uses a default Python image; custom images can be specified via `image=` parameter
   - What's unclear: Whether the default image has common data science libraries (numpy, pandas) pre-installed
   - Recommendation: Use default image; user specifies `libraries` in tool call. Confirm in Wave 0 test.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | llm-sandbox sandbox sessions | Yes | 29.3.1 | — |
| Python (venv) | Backend runtime | Yes | 3.12.6 | — |
| llm-sandbox | SAND-02, SAND-03, SAND-04, SAND-05 | Not yet installed | 0.3.37 (latest on PyPI) | — |
| Supabase (local) | DB tables, Storage | Yes (running) | via docker ps | — |

**Missing dependencies with no fallback:**
- `llm-sandbox[docker]` — must be installed via `pip install 'llm-sandbox[docker]>=0.3.37'` and added to `requirements.txt` in Wave 0.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | `backend/pytest.ini` (asyncio_mode = auto) |
| Quick run command | `cd backend && venv/Scripts/pytest tests/unit/test_sandbox_service.py -x` |
| Full suite command | `cd backend && venv/Scripts/pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAND-01 | `execute_code` in `get_tools()` when enabled; absent when disabled | unit | `pytest tests/unit/test_sandbox_service.py::test_tool_registration -x` | No — Wave 0 |
| SAND-02 | `get_or_create` returns same session for same thread_id | unit | `pytest tests/unit/test_sandbox_service.py::test_session_reuse -x` | No — Wave 0 |
| SAND-03 | Variables persist across two `run()` calls in same session | integration (requires Docker) | manual / integration test | No — Wave 0 |
| SAND-04 | `libraries` parameter passed to `session.run()` | unit (mock) | `pytest tests/unit/test_sandbox_service.py::test_libraries_passed -x` | No — Wave 0 |
| SAND-05 | SSE events `code_stdout` / `code_stderr` emitted during execution | unit (mock session) | `pytest tests/unit/test_sandbox_service.py::test_sse_streaming -x` | No — Wave 0 |
| SAND-06 | `code_execution_start` and `code_execution_complete` events emitted | unit (mock) | `pytest tests/unit/test_sandbox_service.py::test_start_complete_events -x` | No — Wave 0 |
| SAND-09 | Execution row inserted into `code_executions` table | unit (mock supabase) | `pytest tests/unit/test_sandbox_service.py::test_execution_logged -x` | No — Wave 0 |
| SAND-10 | Thread delete calls `sandbox_manager.close_session(thread_id)` | unit (mock) | `pytest tests/unit/test_sandbox_service.py::test_thread_delete_closes_session -x` | No — Wave 0 |
| SAND-11 | `close_all()` called in lifespan shutdown | unit (mock) | `pytest tests/unit/test_sandbox_service.py::test_lifespan_shutdown -x` | No — Wave 0 |
| SAND-13 | `execute_code` absent from tools when `SANDBOX_ENABLED=false` | unit | `pytest tests/unit/test_sandbox_service.py::test_tool_not_registered_when_disabled -x` | No — Wave 0 |
| SAND-07, SAND-08 | Output files uploaded to storage, rows in sandbox_files | integration (requires Docker + Supabase) | manual validation | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && venv/Scripts/pytest tests/unit/test_sandbox_service.py -x`
- **Per wave merge:** `cd backend && venv/Scripts/pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_sandbox_service.py` — covers SAND-01, SAND-02, SAND-04, SAND-05, SAND-06, SAND-09, SAND-10, SAND-11, SAND-13
- [ ] `llm-sandbox[docker]>=0.3.37` in `requirements.txt` and installed in venv
- [ ] `backend/app/services/sandbox_service.py` — new file for Wave 0

---

## Sources

### Primary (HIGH confidence)
- PyPI: llm-sandbox 0.3.37 — version, features, install options (verified via `pip index versions`)
- https://vndee.github.io/llm-sandbox/api-reference/ — `run()` method signature, `on_stdout`/`on_stderr` callbacks, `InteractiveSandboxSession` state persistence
- https://github.com/vndee/llm-sandbox — `open()`/`close()` lifecycle, `container_id` parameter, Docker session architecture
- https://fastapi.tiangolo.com/advanced/events/ — FastAPI lifespan async context manager pattern
- Codebase review: `threads.py`, `openai_service.py`, `config.py`, `main.py`, `017_skills.sql` — integration patterns confirmed against existing code

### Secondary (MEDIUM confidence)
- https://vndee.github.io/llm-sandbox/getting-started/ — `PYTHONUNBUFFERED=1` auto-set, context manager recommendation, Docker session notes
- Python asyncio docs — `loop.call_soon_threadsafe` pattern for thread-to-async bridge

### Tertiary (LOW confidence)
- WebSearch result re: LangGraph thread-per-sandbox pattern — not directly applicable but confirms session-per-thread pattern is ecosystem standard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — llm-sandbox version confirmed via PyPI live query; Docker confirmed installed
- Architecture: HIGH — based on verified API docs + existing codebase patterns
- Pitfalls: HIGH — derived from verified API behavior (blocking `run()`, IPython kernel types, lazy import risk)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (llm-sandbox minor version stability; check PyPI for breaking changes before planning)
