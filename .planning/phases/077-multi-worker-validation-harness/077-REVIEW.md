---
phase: 077-multi-worker-validation-harness
reviewed: 2026-05-26T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/app/_test_mock_llm.py
  - backend/app/main.py
  - backend/app/services/sandbox_service.py
  - backend/tests/integration/test_077_multi_worker.py
  - backend/tests/integration/test_077_cross_cancel.py
  - backend/tests/integration/test_077_sandbox_reattach.py
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 077: Code Review Report

**Reviewed:** 2026-05-26T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 077 adds a multi-worker validation harness: a mock LLM module for subprocess-based testing, sandbox container re-attach logic, and three integration test suites (50-run load, cross-worker cancel, sandbox re-attach). The production safety gates in `main.py` for `MOCK_LLM_MODE` are solid (mirror the existing `ENABLE_TEST_FIXTURES` pattern). The sandbox re-attach logic in `sandbox_service.py` is well-structured with fallback-safe error handling.

Key concerns: (1) a new Docker client is instantiated on every call to `_find_existing_container`, which under the 50-run load test could create 50+ ephemeral Docker SDK clients; (2) the cross-cancel test fixture inserts directly into `auth.users` with a hardcoded password hash and minimal columns, which may break if Supabase's `auth.users` schema evolves; (3) the `_find_free_port` helper has a classic TOCTOU race window.

## Critical Issues

### CR-01: Docker client leak -- new client per `_find_existing_container` call

**File:** `backend/app/services/sandbox_service.py:100`
**Issue:** Every call to `_find_existing_container` creates a new `docker.from_env()` client. The Docker SDK client holds open HTTP connections to the Docker daemon socket. In the hot path (`get_or_create` on every sandbox invocation), each call allocates a fresh client that is never closed. Under the 50-run load test or rapid sandbox access, this can exhaust file descriptors or Docker daemon connections. While production currently gates on `SANDBOX_ENABLED` and per-thread caching mitigates repeat calls for the same thread, the re-attach branch (new in Phase 077) means `_find_existing_container` is called for every cache miss.

**Fix:** Cache the Docker client at the manager level or module level, matching the singleton pattern used for Redis and Supabase:
```python
class SandboxSessionManager:
    _docker_client = None

    def _get_docker_client(self):
        if self._docker_client is None:
            import docker
            self._docker_client = docker.from_env()
        return self._docker_client

    def _find_existing_container(self, thread_id: str) -> str | None:
        try:
            from docker.errors import NotFound
        except ImportError:
            logger.warning("Docker SDK not installed -- skipping container re-attach")
            return None
        try:
            client = self._get_docker_client()
            container = client.containers.get(f"sandbox-{thread_id[:12]}")
            # ... rest unchanged
```

## Warnings

### WR-01: Thread ID truncation collision risk in container naming

**File:** `backend/app/services/sandbox_service.py:56-59`
**Issue:** Container names use `sandbox-{thread_id[:12]}` which truncates a UUID (32 hex chars) to 12 characters. UUID v4 has ~48 bits of entropy in 12 hex chars, giving a collision probability of ~1 in 2^48. While acceptable for single-user dev, in a multi-user production environment with thousands of threads this could theoretically lead to container name collisions where `_find_existing_container` returns a container belonging to a different thread. The label `agentic_rag_thread_id` stores the full thread_id but is not checked during re-attach lookup.

**Fix:** Add a label verification check after container lookup to confirm the full thread_id matches:
```python
container = client.containers.get(f"sandbox-{thread_id[:12]}")
if container.status == "running":
    # Verify full thread_id via label to prevent truncation collisions
    labels = container.labels or {}
    if labels.get("agentic_rag_thread_id") != thread_id:
        logger.warning(
            "Container sandbox-%s belongs to thread %s, not %s -- creating fresh",
            thread_id[:12], labels.get("agentic_rag_thread_id", "unknown"), thread_id,
        )
        return None
    return container.id
```

### WR-02: Cross-cancel test fixture hardcodes `auth.users` schema columns

**File:** `backend/tests/integration/test_077_cross_cancel.py:199-205`
**Issue:** The `zombie_state` fixture inserts into `auth.users` with a hardcoded column list including `instance_id`, `aud`, `role`, `encrypted_password`, `email_confirmed_at`, `confirmation_token`, `recovery_token` and a dummy bcrypt hash (`$2a$10$dummyhash`). Supabase's `auth.users` schema has changed across versions (NOT NULL constraints on `instance_id`, added `raw_app_meta_data`, etc.). If the local Supabase schema version differs from what this INSERT expects, the fixture silently fails (no assertion on the INSERT result), and the test may pass for the wrong reason or fail with a confusing error.

**Fix:** Use the same simpler INSERT pattern from `test_077_multi_worker.py:218-230` which uses `ON CONFLICT DO NOTHING` and minimal columns:
```python
await pg_conn.execute(
    "INSERT INTO auth.users (id, email) VALUES ($1, $2) "
    "ON CONFLICT (id) DO NOTHING",
    UUID(TEST_USER_ID), "test-077@example.com",
)
```

### WR-03: Missing `SANDBOX_ENABLED=false` in cross-cancel server fixture

**File:** `backend/tests/integration/test_077_cross_cancel.py:129`
**Issue:** The `multi_worker_server` fixture in the cross-cancel test sets `MOCK_LLM_MODE=1` but does NOT set `SANDBOX_ENABLED=false` (unlike the multi-worker test at line 123). If the test environment has `SANDBOX_ENABLED=true` in its inherited environment, the subprocess workers will attempt Docker sandbox operations which (a) slow down startup and (b) could interfere with the sandbox re-attach tests if run in the same suite.

**Fix:**
```python
env = {**os.environ, "MOCK_LLM_MODE": "1", "SANDBOX_ENABLED": "false"}
```

### WR-04: TOCTOU race in `_find_free_port` across all three test files

**File:** `backend/tests/integration/test_077_multi_worker.py:90-94`, `backend/tests/integration/test_077_cross_cancel.py:104-108`
**Issue:** `_find_free_port()` binds to port 0 to get an OS-assigned port, then releases the socket before returning. Between the socket close and uvicorn's `bind()`, another process could claim that port. This is a known race condition pattern. While rare in practice (the OS typically doesn't reuse recently-released ports immediately), it can cause flaky test failures in CI environments with high port churn.

**Fix:** This is a well-known limitation of the technique. The mitigation is a retry loop in the health-check polling that distinguishes "port stolen" from "server not ready yet." The current 30s timeout acts as an implicit retry. No immediate code change required, but document the known limitation in a comment:
```python
def _find_free_port() -> int:
    """Get an OS-assigned free port. Note: TOCTOU race between release and
    uvicorn bind is possible but mitigated by the health-check retry loop."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
```

### WR-05: SSE event parsing in `_consume_sse_until_end` resets event_type on blank line before recording

**File:** `backend/tests/integration/test_077_multi_worker.py:279-293`
**Issue:** The SSE parser resets `event_type = None` on blank lines (line 290). In SSE spec, a blank line dispatches the event. However, the code only records the event when it sees `data:` (line 284-288). If the server emits an event with `event:` and `data:` on consecutive lines followed by a blank line, the flow is: set event_type -> record event on data: line -> reset on blank. This works. But if the server emits `event:` then a blank line (no data), `event_type` is reset and lost. More critically, if there are multiple `data:` lines for one event, only the first is captured. This is a test helper so the impact is limited, but the parser could miss events or miscount them under edge conditions.

**Fix:** Consider recording the event on blank-line dispatch instead of on the data: line, which better matches the SSE specification:
```python
event_type = None
event_data = None
async for line in response.aiter_lines():
    line = line.strip()
    if line.startswith("event:"):
        event_type = line[len("event:"):].strip()
    elif line.startswith("data:"):
        event_data = line[len("data:"):].strip()
    elif line == "" and event_type and event_data is not None:
        events.append(event_type)
        if event_type == "stream_end":
            return events
        event_type = None
        event_data = None
```

## Info

### IN-01: Duplicated `_find_free_port` helper across test files

**File:** `backend/tests/integration/test_077_multi_worker.py:89-94`, `backend/tests/integration/test_077_cross_cancel.py:104-108`
**Issue:** The `_find_free_port()` function is identically defined in both test files. This is minor duplication.

**Fix:** Extract to a shared test helper module (e.g., `backend/tests/integration/conftest.py` or a `_helpers.py` module) and import from both test files.

### IN-02: Duplicated `multi_worker_server` fixture across test files

**File:** `backend/tests/integration/test_077_multi_worker.py:101-173`, `backend/tests/integration/test_077_cross_cancel.py:119-167`
**Issue:** Both test files define a near-identical `multi_worker_server` fixture that launches `uvicorn --workers 2` on a free port. The cross-cancel variant is slightly simpler (no try/finally guard on the yield path, just a while/else for readiness check). The multi-worker version has more robust error reporting (captures stderr on failure). Having two separate subprocess fixtures also means two separate server processes if both test modules are collected in the same pytest run.

**Fix:** Consolidate into a shared `conftest.py` fixture at the `backend/tests/integration/` level, parameterized if needed for different env var sets. Use the more robust version from `test_077_multi_worker.py` as the base.

### IN-03: `_mock_stream` generator is called fresh per invocation but not thread-safe

**File:** `backend/app/_test_mock_llm.py:34-58`
**Issue:** `mock_create_adaptive_streaming_chat` calls `iter(_mock_stream())` which creates a fresh generator each time, so there is no shared-state threading issue. However, the function signature accepts `**kwargs` and silently ignores all arguments (model, messages, tools, etc.). This is fine for the current mock scope but means tests cannot assert which model/messages were passed to the LLM. Noted for awareness only -- the current phase does not require this.

**Fix:** No action needed for Phase 077. If future tests need to assert on LLM call arguments, add a thread-safe call log:
```python
_CALL_LOG: list[dict] = []  # append kwargs per call for assertion
```

---

_Reviewed: 2026-05-26T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
