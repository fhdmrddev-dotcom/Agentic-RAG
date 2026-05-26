# Phase 077: Multi-Worker Validation Harness - Research

**Researched:** 2026-05-26
**Domain:** Multi-process uvicorn testing, Docker container re-attach, synthetic load harness
**Confidence:** HIGH

## Summary

Phase 077 builds a validation harness proving that `uvicorn --workers 2` is safe for this application. The harness launches a real multi-worker uvicorn subprocess, fires 50 concurrent mocked runs via `httpx.AsyncClient`, and asserts four contracts: (1) CONCUR-01 cross-tab GET remains unblocked, (2) cross-worker cancel works via the existing zombie-heal path, (3) sandbox sessions re-attach to existing Docker containers, and (4) Redis/asyncpg/Supabase singletons initialize per-worker without cross-talk.

The critical architectural insight is that uvicorn on Windows uses `spawn` (not `fork`), so each worker is a completely fresh Python interpreter with its own module-level globals. This means the lazy-init singleton pattern (`_redis = None` / `_pg_pool = None` / `_supabase = None`) is safe by construction -- each worker's `lifespan()` independently initializes its own connections. There is no memory sharing between workers. The primary risk areas are: (1) the `RUN_TASKS` dict is per-process so cancel must use the Redis zombie-heal path for cross-worker cases, and (2) sandbox `_sessions` dict is per-process so worker bounces lose the in-memory session reference.

The `llm_sandbox` library (v0.3.37) already supports `container_id` passthrough for connecting to existing Docker containers. The `SandboxDockerSession` has `_connect_to_existing_container()` which calls `client.containers.get(container_id)`, verifies the container is running (starts it if stopped), and attaches. The `InteractiveSandboxSession` re-bootstraps its IPython runner on attach, preserving the container filesystem (pip installs, generated files).

**Primary recommendation:** Build a pytest integration test that launches `uvicorn --workers 2` as a subprocess with `MOCK_LLM_MODE=1` env var, uses `httpx.AsyncClient` against the real HTTP port, and asserts all four contracts. Mock injection works via an env-var-gated mock module loaded at import time in the subprocess workers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-077-01: Claude's discretion on harness location (pytest integration test vs standalone script vs hybrid). Must launch real `uvicorn --workers 2` subprocess and fire 50 concurrent HTTP requests via `httpx.AsyncClient` -- cannot use ASGITransport (single-process only).
- D-077-02: Full LLM mock, zero API cost. Patch `create_adaptive_streaming_chat` to return a fake stream with ~5 chunks + a tool call. Deterministic, millisecond-per-run execution.
- D-077-03: CONCUR-01 binding gate stays green under --workers 2. Existing `test_058_concurrency.py` unchanged. New 077 test hits live --workers 2 instance.
- D-077-04: Re-create on miss sandbox stickiness. No reverse proxy, no Redis session registry, no consistent hashing at the load-balancer level.
- D-077-05: Verify + re-attach to existing Docker container before creating fresh. Preserves pip installs, generated files, interpreter state.
- D-077-06: Stickiness transparent to agent loop -- `sandbox_manager.get_or_create(thread_id)` remains the only call site.
- D-077-07: Automated test only for cross-worker cancel. Launches --workers 2, starts mocked long-running run (Worker A), sends DELETE (likely Worker B). Asserts cancelled status + zombie_healed sentinel + cancel_lock. Fully automated.
- D-077-08: The zombie-heal path at runs.py:459-623 already handles cross-worker. No new cancel logic needed -- only verification.
- D-077-09: Assert-in-harness singleton validation. After all 50 runs: `redis.zcard('runs:active')` correct count; asyncpg pool connection count within bounds (max=10).
- D-077-10: Three singletons (`_redis`, `_pg_pool`, `_supabase`) are all `None` at module-import time. Lifespan runs post-fork (post-spawn on Windows). Each worker independently initializes.

### Claude's Discretion
- Exact pytest fixture structure and subprocess management approach
- Whether to use Docker container name convention or Docker API label query for re-attach discovery
- The `llm_sandbox` library's API for attaching to existing containers (researched below)
- Harness assertion granularity (per-run vs batch summary)
- Whether 50-run count is sequential-then-parallel or all-at-once

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within phase scope.
- BUG-260526-02 (Kimi thinking leaks) -- frontend domain, not multi-worker
- BUG-260526-03 (finalOutputFiles SSE-only) -- frontend domain, not multi-worker
- BUG-260526-04 (timer disappears) -- frontend domain, not multi-worker
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORKER-LIFT-01 | `uvicorn --workers 2` runs cleanly: run-tracking survives across workers (cancelled run started in W1 cancellable from W2), sandbox sessions are sticky to the originating worker via consistent hashing on `thread_id`, Redis singleton initializes per worker without cross-talk. | Verified: uvicorn --workers 2 launches successfully on this Windows machine (spawn-based). Singleton pattern safe by construction. llm_sandbox container_id re-attach API exists. Zombie-heal cancel path is cross-worker-ready. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-worker process management | uvicorn parent (multiprocess manager) | -- | uvicorn's built-in --workers flag manages spawn/health-check/restart |
| Per-worker singleton init | Application lifespan (main.py) | dependencies.py lazy-init | Lifespan runs post-spawn in each worker; lazy-init creates connections on first use |
| Cross-worker cancel | Redis (run stream + cancel_lock) | Postgres (runs.status) | RUN_TASKS is per-process; zombie-heal path uses Redis SETNX + Postgres UPDATE |
| Sandbox session stickiness | SandboxSessionManager (sandbox_service.py) | Docker API (container inspection) | In-memory dict is per-worker; Docker container persists across workers |
| Synthetic load harness | pytest (test orchestrator) | httpx.AsyncClient (HTTP driver) | pytest manages subprocess lifecycle; httpx fires concurrent requests |
| Mock injection | Environment variable gate | Import-time conditional | Can't monkey-patch across process boundary; env var triggers mock at import |

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uvicorn | 0.32.1 (installed) | ASGI server with --workers flag | Already the project's server; 0.32.1 supports Windows spawn workers [VERIFIED: pip show] |
| httpx | 0.28.1 (installed) | Async HTTP client for load harness | Already used by existing integration tests [VERIFIED: pip show] |
| pytest | 9.0.2 (installed) | Test runner | Already the project's test framework [VERIFIED: pip show] |
| pytest-asyncio | 1.3.0 (installed) | Async test support | Already used; asyncio_mode=auto in pytest.ini [VERIFIED: pip show] |
| docker | 7.1.0 (installed) | Docker SDK for container inspection | Already installed (llm-sandbox[docker] dependency) [VERIFIED: pip show] |
| llm-sandbox | 0.3.37 (installed) | Sandbox session management | Already the project's sandbox library [VERIFIED: pip show] |
| asyncpg | (installed) | Postgres pool | Already used since Phase 073 [VERIFIED: dependencies.py] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| subprocess (stdlib) | -- | Launch uvicorn --workers 2 | Harness fixture starts/stops the multi-worker server |
| docker (Python SDK) | 7.1.0 | Container.get() for re-attach lookup | SandboxSessionManager.get_or_create needs container discovery |

**Installation:** No new packages needed. All dependencies already in requirements.txt.

## Architecture Patterns

### System Architecture Diagram

```
pytest harness
    |
    +-- [fixture] subprocess.Popen("uvicorn --workers 2 --port {free_port}")
    |       |                                     |
    |       +-- Worker 1 (PID A)                  +-- Worker 2 (PID B)
    |       |   - own _redis singleton            |   - own _redis singleton
    |       |   - own _pg_pool singleton           |   - own _pg_pool singleton
    |       |   - own _supabase singleton          |   - own _supabase singleton
    |       |   - own RUN_TASKS dict               |   - own RUN_TASKS dict
    |       |   - own _sessions dict               |   - own _sessions dict
    |       |                                      |
    |       +-- Shared: Redis server, Postgres, Docker daemon
    |
    +-- httpx.AsyncClient(base_url=f"http://127.0.0.1:{free_port}")
    |       |
    |       +-- POST /threads/{tid}/messages  (50 concurrent, mocked LLM)
    |       +-- GET /runs/{rid}/stream        (consume SSE)
    |       +-- DELETE /runs/{rid}            (cross-worker cancel)
    |       +-- GET /health                   (readiness probe)
    |
    +-- [assertions]
            +-- Redis: zcard("runs:active") == 0 after all complete
            +-- Redis: cancel_lock key exists for cancelled run
            +-- Postgres: runs.status == 'cancelled' for cancelled run
            +-- Redis stream: zombie_healed sentinel present
```

### Recommended Project Structure
```
backend/tests/
    integration/
        test_077_multi_worker.py     # Main harness (50-run load + singleton + CONCUR-01)
        test_077_cross_cancel.py     # Cross-worker cancel verification (D-077-07)
    _run_helpers.py                  # Existing shared helpers (reused)
backend/app/
    _test_mock_llm.py               # Env-var-gated mock LLM module (MOCK_LLM_MODE=1)
    services/
        sandbox_service.py           # Modified: Docker container re-attach logic
```

### Pattern 1: Env-Var-Gated Mock LLM (subprocess mock injection)
**What:** Since we cannot monkey-patch across process boundaries (uvicorn workers are separate processes), we use an environment variable `MOCK_LLM_MODE=1` that the subprocess reads at import time. When set, the app replaces `create_adaptive_streaming_chat` with a deterministic fake that yields ~5 chunks + a tool call in milliseconds.
**When to use:** Any time a test harness needs to control behavior inside a separately-spawned uvicorn process.
**Example:**
```python
# backend/app/_test_mock_llm.py
# Source: project-internal pattern following ENABLE_TEST_FIXTURES precedent
import os
from unittest.mock import MagicMock
from app.services.openai_service import CallingMode

def _mock_stream():
    """Deterministic fake LLM stream: 5 content chunks + stop."""
    for i in range(5):
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].finish_reason = None
        chunk.choices[0].delta = MagicMock()
        chunk.choices[0].delta.content = f"tok{i} "
        chunk.choices[0].delta.tool_calls = None
        chunk.usage = None
        yield chunk
    # Final chunk with stop
    done = MagicMock()
    done.choices = [MagicMock()]
    done.choices[0].finish_reason = "stop"
    done.choices[0].delta = MagicMock()
    done.choices[0].delta.content = None
    done.choices[0].delta.tool_calls = None
    done.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
    yield done

def mock_create_adaptive_streaming_chat(**kwargs):
    return (iter(_mock_stream()), CallingMode.NATIVE)

def install_mock():
    """Patch the real LLM entry point. Called once per worker at import time."""
    import app.api.threads as threads_mod
    threads_mod.create_adaptive_streaming_chat = mock_create_adaptive_streaming_chat
```

```python
# In app/main.py (bottom, after router mounts), gated like ENABLE_TEST_FIXTURES:
if os.getenv("MOCK_LLM_MODE", "0") == "1":
    from app._test_mock_llm import install_mock
    install_mock()
    logger.warning("MOCK_LLM_MODE=1 -- LLM calls return deterministic fakes")
```

### Pattern 2: Subprocess Uvicorn Fixture
**What:** A pytest fixture that starts `uvicorn --workers 2` on a free port, waits for readiness, yields the port, and tears down on exit.
**When to use:** Integration tests that need a real multi-worker HTTP server.
**Example:**
```python
# Source: project pattern + safir.testing.uvicorn inspiration
import subprocess
import socket
import time
import httpx
import pytest

def _find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

@pytest.fixture(scope="module")
def multi_worker_server():
    """Launch uvicorn --workers 2 on a free port with MOCK_LLM_MODE=1."""
    port = _find_free_port()
    env = {**os.environ, "MOCK_LLM_MODE": "1"}
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "app.main:app",
            "--host", "127.0.0.1",
            "--port", str(port),
            "--workers", "2",
        ],
        cwd=str(Path(__file__).resolve().parents[2]),  # backend/
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    # Wait for readiness (health endpoint)
    base_url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{base_url}/health", timeout=2.0)
            if r.status_code == 200:
                break
        except httpx.ConnectError:
            time.sleep(0.5)
    else:
        proc.terminate()
        raise RuntimeError("uvicorn --workers 2 did not become ready in 30s")
    
    yield {"port": port, "base_url": base_url, "process": proc}
    
    proc.terminate()
    proc.wait(timeout=10)
```

### Pattern 3: Docker Container Re-Attach in SandboxSessionManager
**What:** Before creating a new container, check if a Docker container named `sandbox-{thread_id[:12]}` exists and is running. If so, create an `InteractiveSandboxSession` with `container_id=container.id` to re-attach.
**When to use:** `get_or_create()` when the in-memory `_sessions` dict has no entry for `thread_id` (worker bounce scenario).
**Example:**
```python
# Source: llm_sandbox v0.3.37 SandboxDockerSession._connect_to_existing_container
# [VERIFIED: inspected source code of installed package]
def get_or_create(self, thread_id: str) -> object:
    from llm_sandbox import InteractiveSandboxSession
    self._evict_expired()
    
    if thread_id not in _sessions:
        # D-077-05: check for existing Docker container before creating new
        container_id = self._find_existing_container(thread_id)
        session_kwargs = {"lang": "python", "verbose": False}
        custom_image = os.environ.get("SANDBOX_IMAGE")
        if custom_image:
            session_kwargs["image"] = custom_image
        
        if container_id:
            # Re-attach to existing container (preserves pip installs, files)
            session_kwargs["container_id"] = container_id
            session_kwargs["skip_environment_setup"] = True
            logger.info("Re-attaching to existing container %s for thread %s",
                       container_id, thread_id)
        else:
            # Create new container with discoverable name
            session_kwargs["runtime_configs"] = {
                "name": f"sandbox-{thread_id[:12]}",
                "labels": {"agentic_rag_thread_id": thread_id},
            }
        
        session = InteractiveSandboxSession(**session_kwargs)
        session.open()
        _sessions[thread_id] = session
    
    _last_used[thread_id] = time.time()
    return _sessions[thread_id]

def _find_existing_container(self, thread_id: str) -> str | None:
    """Look up a running sandbox container by name convention."""
    import docker
    try:
        client = docker.from_env()
        container = client.containers.get(f"sandbox-{thread_id[:12]}")
        if container.status == "running":
            return container.id
        # Container exists but stopped -- could start it, but D-077-05
        # says "if container is gone/stopped, create fresh"
        return None
    except docker.errors.NotFound:
        return None
    except Exception as e:
        logger.warning("Docker container lookup failed for thread %s: %s",
                       thread_id, e)
        return None
```

### Anti-Patterns to Avoid
- **ASGITransport for multi-worker tests:** `httpx.ASGITransport(app=app)` runs everything in a single process. Cannot test cross-worker behavior. MUST use real HTTP against subprocess.
- **monkey-patching across process boundaries:** `unittest.mock.patch` only works within the same process. For subprocess workers, use env-var-gated mocks loaded at import time.
- **Sharing asyncpg/Redis connections across fork:** On Windows this is impossible (spawn, not fork), but even on Linux, asyncpg pools are event-loop-bound and MUST NOT be inherited across fork. The lazy-init-from-None pattern is the correct approach. [VERIFIED: asyncpg docs + Phase 073 D-073-12]
- **Fixed port allocation:** Tests that hard-code a port will fail in CI when the port is occupied. Always use `socket.bind(("", 0))` to get a free port.
- **Session-scoped async fixtures for subprocess tests:** The subprocess is not managed by pytest-asyncio's event loop. Use synchronous `subprocess.Popen` + sync health check in the fixture, then async `httpx.AsyncClient` in the test body.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker container lookup | Custom Docker API wrapper | `docker.from_env().containers.get(name)` | Docker Python SDK 7.1.0 already installed; handles name/ID lookup, status check, NotFound exception [VERIFIED: docker SDK 7.1.0] |
| Container re-attach in sandbox | Custom Docker exec/attach logic | `InteractiveSandboxSession(container_id=existing_id)` | llm_sandbox 0.3.37 has built-in `_connect_to_existing_container()` that verifies running status, starts if stopped, handles NotFound [VERIFIED: inspected source] |
| Free port allocation | Random port generation | `socket.socket().bind(("", 0))` | OS guarantees no collision; standard Python pattern |
| Process health-check polling | Custom TCP probe | `httpx.get("/health")` with retry loop | The app already has a `/health` endpoint returning `{"status": "ok", "redis": "ok"}` [VERIFIED: main.py:140] |
| Fake LLM stream generation | Custom mock framework | `_run_helpers._fast_chunks()` pattern | Existing test infrastructure has proven mock chunk generators [VERIFIED: _run_helpers.py:91-102] |

**Key insight:** The project already has 90% of the infrastructure needed. The `_run_helpers.py` mock builders, the `ENABLE_TEST_FIXTURES` gating pattern, the `test_058_concurrency.py` httpx.AsyncClient pattern, and the Docker Python SDK are all in place. The new work is: (1) a subprocess launcher fixture, (2) an env-var-gated mock LLM module, and (3) the container re-attach logic in SandboxSessionManager.

## Common Pitfalls

### Pitfall 1: Windows Spawn vs Linux Fork
**What goes wrong:** Code that assumes fork semantics (shared memory, inherited file descriptors, copy-on-write globals) breaks silently on Windows where spawn creates a completely fresh interpreter.
**Why it happens:** Most uvicorn multi-worker documentation and examples assume Linux fork.
**How to avoid:** Treat each worker as completely independent. Module-level globals like `_redis = None` are re-initialized in each worker. This is actually SAFER than fork (no accidental sharing of asyncpg connections across forked processes).
**Warning signs:** Tests pass on Linux CI but fail on Windows dev machines. [VERIFIED: uvicorn uses `spawn.Process` on all platforms as of 0.30.0+]

### Pitfall 2: Port Collision in Parallel Test Runs
**What goes wrong:** Two test runs bind to the same port; the second one gets `Address already in use`.
**Why it happens:** Hard-coded ports or predictable port ranges.
**How to avoid:** Use `socket.bind(("127.0.0.1", 0))` to get an OS-assigned free port. Release the socket before passing the port to uvicorn.
**Warning signs:** Tests fail intermittently with `OSError: [Errno 10048]` on Windows.

### Pitfall 3: Subprocess Not Terminated on Test Failure
**What goes wrong:** If a test assertion fails, the subprocess keeps running, holding the port and leaving zombie processes.
**Why it happens:** `pytest.fixture` teardown runs even on failure, but if the fixture setup fails (e.g., health check timeout), the `proc` variable might not exist.
**How to avoid:** Use try/finally in the fixture with `proc.terminate()` + `proc.wait(timeout=10)`. If wait times out, use `proc.kill()`. Store proc as fixture state, not local variable.
**Warning signs:** Port occupied errors in subsequent test runs; orphaned uvicorn processes in Task Manager.

### Pitfall 4: RUN_TASKS Is Per-Process (Cross-Worker Cancel)
**What goes wrong:** Cancel request lands on Worker B, but the run was started by Worker A. `RUN_TASKS.get(run_id)` returns None because RUN_TASKS is a per-process dict.
**Why it happens:** With `--workers 2`, requests are round-robin distributed by uvicorn's parent process.
**How to avoid:** The existing zombie-heal path (runs.py:531-623) already handles this exact case. When `RUN_TASKS` lookup returns None and `runs.status='streaming'`, it falls through to the zombie-heal branch: SETNX cancel-lock, Postgres UPDATE, synthetic terminal sentinel. This is the design -- no new code needed, just verification that it works.
**Warning signs:** Cancel returns 204 (always does per D-062-09 idempotent) but the run never actually transitions to `cancelled` in Postgres.

### Pitfall 5: Docker Container Name Collision
**What goes wrong:** Two workers try to create a container with the same `name` for the same `thread_id`. Docker rejects the second create with `409 Conflict`.
**Why it happens:** Concurrent `get_or_create()` calls for the same thread_id on different workers.
**How to avoid:** The name-based lookup (`containers.get(name)`) acts as a natural guard. If Worker A creates the container first, Worker B's lookup finds it and re-attaches. Race window: both workers check simultaneously, both find nothing, both try to create. Mitigate with: try/except on create, re-lookup on conflict.
**Warning signs:** `docker.errors.Conflict: 409` in logs during concurrent sandbox creation.

### Pitfall 6: InteractiveSandboxSession _bootstrap_runtime on Re-Attach
**What goes wrong:** Re-attaching to an existing container re-runs `_bootstrap_runtime()` which uploads the runner script and starts a new runner process. If the old runner is still running, there could be two runner processes.
**Why it happens:** `_start_runner_process()` does `rm -f {ready_file} {pid_file}` then starts a new nohup runner. The old runner (if any) is not explicitly killed first.
**How to avoid:** Call `_stop_runner_process()` before `_bootstrap_runtime()`, or ensure the close() on the old session object kills the runner. Since close() on the old session was never called (the worker that had it died or bounced), the old runner may still be alive. The new runner start does `rm -f` the ready file, then starts fresh. The old runner becomes a zombie but is harmless (no one reads its results directory). Long-term, could kill by PID from the pid_file, but for Phase 077 this is acceptable.
**Warning signs:** Multiple python processes inside the container. Check with `docker exec sandbox-xxx ps aux`.

### Pitfall 7: Auth Token for Subprocess HTTP Requests
**What goes wrong:** The harness fires `POST /threads/{tid}/messages` but gets 401 because there's no valid auth token.
**Why it happens:** The subprocess runs the real app with real auth middleware. Dependency override `get_current_user` is per-process and not available in the subprocess.
**How to avoid:** Two approaches: (a) use the real Supabase auth service (local) to get a test token, or (b) add an env-var-gated auth bypass similar to `ENABLE_TEST_FIXTURES`. Approach (b) is simpler and follows existing patterns. When `MOCK_LLM_MODE=1`, also bypass auth to return a fixed test user.
**Warning signs:** All 50 requests return 401.

## Code Examples

### Container Re-Attach: llm_sandbox container_id API
```python
# Source: [VERIFIED: inspected llm_sandbox 0.3.37 source code]
# SandboxDockerSession.__init__ accepts container_id parameter
# When container_id is set, self.using_existing_container = True
# open() calls _connect_to_existing_container() instead of creating new

from llm_sandbox import InteractiveSandboxSession

# Re-attach to existing container (preserves pip installs, files)
session = InteractiveSandboxSession(
    lang="python",
    verbose=False,
    container_id="abc123deadbeef",  # Docker container ID or name
    skip_environment_setup=True,     # Skip pip install steps
)
session.open()
# _connect_to_existing_container() is called internally:
#   - client.containers.get(container_id)
#   - if container.status != "running": container.start()
#   - then _bootstrap_runtime() runs (uploads runner script, starts new runner)
```

### Docker Container Lookup by Name
```python
# Source: [VERIFIED: docker Python SDK 7.1.0]
import docker
from docker.errors import NotFound

client = docker.from_env()
try:
    container = client.containers.get(f"sandbox-{thread_id[:12]}")
    if container.status == "running":
        container_id = container.id  # Full 64-char hex ID
except NotFound:
    container_id = None
```

### Free Port Allocation
```python
# Source: [ASSUMED] Standard Python pattern
import socket

def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    return port
```

### Existing Mock LLM Stream Pattern
```python
# Source: [VERIFIED: backend/tests/integration/_run_helpers.py:91-122]
from unittest.mock import MagicMock

def _fast_chunks():
    """Yields ~3 content chunks + done. Sub-millisecond."""
    for token in ("a", "b", "c"):
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].finish_reason = None
        chunk.choices[0].delta.content = token
        chunk.choices[0].delta.tool_calls = None
        yield chunk
    done = MagicMock()
    done.choices = [MagicMock()]
    done.choices[0].finish_reason = "stop"
    done.choices[0].delta.content = None
    done.choices[0].delta.tool_calls = None
    yield done
```

### asyncpg Pool Introspection
```python
# Source: [VERIFIED: asyncpg Pool API, inspected via dir()]
pool = await get_pg_pool()
pool.get_size()       # Current number of connections
pool.get_idle_size()  # Idle connections available
pool.get_max_size()   # Configured maximum (default: 10, per D-073-03)
pool.get_min_size()   # Configured minimum (default: 2, per D-073-03)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gunicorn + uvicorn workers (Unix only) | uvicorn --workers N (cross-platform spawn) | uvicorn 0.30.0 (May 2024) | Windows multi-worker support; uvicorn.workers module deprecated [VERIFIED: uvicorn changelog] |
| ASGITransport for all integration tests | Real subprocess for multi-process tests | Phase 077 (new) | Cannot test cross-worker behavior with in-process transport |
| Single-worker assumption (D-v2.5-02) | Multi-worker validation (Phase 077) then enable (Phase 079) | Phase 077/079 | Removes the single-worker constraint that masked concurrency bugs |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `skip_environment_setup=True` on InteractiveSandboxSession prevents re-running pip install on re-attach | Pattern 3 | LOW -- if it does re-run pip install, it just adds ~5s overhead per re-attach, not a correctness issue |
| A2 | Docker container name collision (409 Conflict) can be caught with try/except and retried with a lookup | Pitfall 5 | LOW -- if the exception type is different, the except block needs adjustment |
| A3 | The uvicorn parent process distributes requests round-robin across workers | Pitfall 4 | LOW -- even if the distribution strategy differs, the zombie-heal path is still exercised when cancel lands on a different worker |
| A4 | `_stop_runner_process()` on InteractiveSandboxSession only kills the runner inside the container, not the container itself | Pitfall 6 | MEDIUM -- if it also stops the container, re-attach would fail; needs verification during implementation |

## Open Questions

1. **Anthropic/Google Provider Mock Path**
   - What we know: D-077-02 says "patch `create_adaptive_streaming_chat`" which only covers the OpenAI/OpenRouter/Ollama code path. The Anthropic path uses `create_anthropic_streaming_chat` (anthropic_service.py) and Google uses its own native SDK path.
   - What's unclear: Do we need to mock all three provider paths, or can we force all 50 runs through the OpenAI path by setting the provider in the mock mode?
   - Recommendation: Set `LLM_PROVIDER=openai` and `LLM_MODEL=gpt-4o-mini` in the subprocess env so all runs go through the OpenAI code path where `create_adaptive_streaming_chat` is the entry point. Provider diversity is already covered by 075.x UAT phases. The multi-worker harness only needs to prove the plumbing works.

2. **Auth Bypass in Subprocess**
   - What we know: The subprocess runs real FastAPI with real `Depends(get_current_user)` middleware. We cannot dependency-override across process boundaries.
   - What's unclear: Whether to use a real Supabase auth token (local Supabase is running) or an env-var-gated auth bypass.
   - Recommendation: Use a real Supabase auth token from the local auth service. The test user `fhdmrd@gmail.com / 123456` is already documented. Call `supabase.auth.sign_in_with_password()` at fixture setup to get a JWT. This is more realistic than bypassing auth and avoids adding another test-only code path.

3. **Sandbox Test Scope**
   - What we know: D-077-04/05 require container re-attach logic. But sandbox is gated by `SANDBOX_ENABLED=false` by default.
   - What's unclear: Whether the 50-run load test should exercise sandbox at all, or if sandbox re-attach should be a separate focused test.
   - Recommendation: The 50-run load test should NOT exercise sandbox (too slow, Docker overhead). Sandbox re-attach should be a separate unit-level test that directly exercises `SandboxSessionManager.get_or_create()` with a pre-created Docker container. The load test focuses on run-tracking, cancel, and singletons.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| uvicorn --workers 2 | Load harness | YES | 0.32.1 | -- |
| Docker daemon | Sandbox re-attach tests | YES | (running) | Skip sandbox tests if Docker unavailable |
| Redis | Run-tracking, cancel verification | YES | (running via docker-compose.dev.yml) | -- |
| Postgres (Supabase) | Auth tokens, runs table assertions | YES | (running via supabase start) | -- |
| httpx | HTTP client for load | YES | 0.28.1 | -- |
| docker Python SDK | Container inspection | YES | 7.1.0 | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. All required services are running.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 + pytest-asyncio 1.3.0 |
| Config file | `backend/pytest.ini` (asyncio_mode=auto) |
| Quick run command | `cd backend && venv/Scripts/pytest tests/integration/test_077_multi_worker.py -x -v` |
| Full suite command | `cd backend && venv/Scripts/pytest tests/integration/test_077*.py -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORKER-LIFT-01a | 50-run load under --workers 2, no state corruption | integration | `pytest tests/integration/test_077_multi_worker.py::test_50_run_load -x` | Wave 0 |
| WORKER-LIFT-01b | CONCUR-01 cross-tab GET unblocked under --workers 2 | integration | `pytest tests/integration/test_077_multi_worker.py::test_concur01_multi_worker -x` | Wave 0 |
| WORKER-LIFT-01c | Cross-worker cancel via zombie-heal | integration | `pytest tests/integration/test_077_cross_cancel.py -x` | Wave 0 |
| WORKER-LIFT-01d | Sandbox re-attach to existing container | integration | `pytest tests/integration/test_077_sandbox_reattach.py -x` | Wave 0 |
| WORKER-LIFT-01e | Redis singleton per-worker, no duplicates in runs:active | integration (in test_077_multi_worker) | `pytest tests/integration/test_077_multi_worker.py::test_singleton_no_crosstalk -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/integration/test_077_multi_worker.py -x -v`
- **Per wave merge:** `pytest tests/integration/test_077*.py -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/test_077_multi_worker.py` -- covers WORKER-LIFT-01a, 01b, 01e
- [ ] `tests/integration/test_077_cross_cancel.py` -- covers WORKER-LIFT-01c
- [ ] `tests/integration/test_077_sandbox_reattach.py` -- covers WORKER-LIFT-01d
- [ ] `app/_test_mock_llm.py` -- env-var-gated mock LLM for subprocess injection
- [ ] Sandbox service modification for Docker container re-attach

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Real Supabase auth tokens for harness HTTP requests; no auth bypass introduced |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Existing RLS + user_id scoping preserved; test runs scoped to test user |
| V5 Input Validation | no | Harness uses well-formed requests only |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MOCK_LLM_MODE env var left on in production | Information Disclosure | Production safety gate (same pattern as ENABLE_TEST_FIXTURES: refuse to start if ENVIRONMENT=production) [VERIFIED: main.py:185-191] |
| Test user credentials in source code | Information Disclosure | Use env var for test credentials; the `fhdmrd@gmail.com / 123456` test user is local-only (Supabase local auth) [VERIFIED: MEMORY.md reference_local_dev_app] |
| Docker container name predictability | Tampering | Container names include thread_id (UUID) -- not guessable; Docker daemon access requires host-level privileges |

## Sources

### Primary (HIGH confidence)
- llm_sandbox 0.3.37 source code -- inspected `InteractiveSandboxSession.__init__`, `open()`, `close()`, `_bootstrap_runtime()`, `_start_runner_process()`; `SandboxDockerSession.__init__` (container_id param), `open()` (existing container branch), `close()` (skip remove for existing), `_connect_to_existing_container()`
- docker Python SDK 7.1.0 -- `containers.get(name_or_id)`, `container.status`, `docker.errors.NotFound`
- uvicorn 0.32.1 -- `_subprocess.get_subprocess()` uses `spawn.Process`, confirmed Windows multi-worker works (live test on this machine)
- Project codebase -- `dependencies.py` (singleton pattern), `main.py` (lifespan), `runs.py:459-623` (zombie-heal cancel), `threads.py:92` (RUN_TASKS), `sandbox_service.py` (SandboxSessionManager), `test_058_concurrency.py` (httpx.AsyncClient pattern), `_run_helpers.py` (mock builders)

### Secondary (MEDIUM confidence)
- uvicorn docs via Context7 -- "lifespan protocol is executed only once per application instance, meaning each worker will run it independently" [CITED: Context7 /kludex/uvicorn]
- uvicorn changelog -- "0.30.0: new multiprocess manager; uvicorn.workers deprecated" [CITED: Context7 /kludex/uvicorn release-notes]

### Tertiary (LOW confidence)
- uvicorn GitHub issues #484 -- Windows --workers workaround discussion (import string requirement) [CITED: github.com/Kludex/uvicorn/issues/484]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and verified
- Architecture: HIGH -- singleton pattern verified safe under spawn; llm_sandbox container_id API verified; zombie-heal path verified cross-worker ready
- Pitfalls: HIGH -- Windows spawn behavior confirmed by live test; mock injection pattern follows existing ENABLE_TEST_FIXTURES precedent
- Sandbox re-attach: MEDIUM -- API exists and is documented, but `_bootstrap_runtime` behavior on re-attach (Pitfall 6) needs implementation-time verification

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable domain -- uvicorn/llm_sandbox/docker SDK unlikely to break)
