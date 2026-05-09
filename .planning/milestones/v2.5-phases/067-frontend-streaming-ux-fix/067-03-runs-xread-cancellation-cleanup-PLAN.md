---
phase: 067
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/runs.py
  - backend/tests/api/__init__.py
  - backend/tests/api/test_runs_cancellation.py
autonomous: true
requirements:
  - STREAM-04-polish
must_haves:
  truths:
    - "On a browser tab refresh that disconnects an open SSE consumer mid-stream, backend logs show INFO-level 'cancelled by client disconnect' or 'socket timeout' messages — NOT a `redis.exceptions.TimeoutError` traceback (UX-067-04)"
    - "asyncio.CancelledError on xread is RE-RAISED, never swallowed (Phase 059 D-059-04 invariant preserved — cooperative cancellation contract)"
    - "Genuine RedisError (connection reset, OOM, cluster failover) STILL logs full traceback at ERROR level — no diagnostic regression"
    - "Phase 062 D-062-14 file-layout discipline: all three xread call sites edited (lines 104, 163, 184) live in runs.py — NOT in any threads.py off-limits region"
    - "BLK-2 closure: backend/tests/api/test_runs_cancellation.py exists with three monkey-patched tests (CancelledError re-raise + INFO-no-traceback; RedisTimeoutError INFO with canonical substring + sentinel SSE event + no traceback; genuine RedisError ERROR-level with exc_info intact). All three pass against the post-Tasks-1+2 differentiated handlers."
  artifacts:
    - path: "backend/app/api/runs.py"
      provides: "runs.py with module-top `from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError` import (variable-shadowing-safe per Pattern J / Pitfall 2). Three xread call sites get explicit `except asyncio.CancelledError: raise` + `except RedisTimeoutError: log INFO + clean SSE close` + retain `except RedisError: log .exception + clean SSE close` for genuine failures."
      contains: "from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError"
    - path: "backend/tests/api/test_runs_cancellation.py"
      provides: "Three async pytest tests using caplog + AsyncMock to assert (a) CancelledError logs INFO, no traceback, re-raised; (b) RedisTimeoutError logs INFO with canonical substring 'consumer disconnected; xread cancellation-equivalent', no traceback, sentinel SSE error event yielded; (c) genuine RedisError keeps ERROR-level logger.exception with exc_info set (full traceback intact)."
      contains: "consumer disconnected; xread cancellation-equivalent"
    - path: "backend/tests/api/__init__.py"
      provides: "Package marker for backend/tests/api/ test subpackage."
      contains: ""
  key_links:
    - from: "runs.py replay_tail_consumer Phase 1 xread (line 104-117)"
      to: "differentiated handler — CancelledError re-raised, RedisTimeoutError INFO log, RedisError full traceback"
      via: "explicit except clauses in priority order"
      pattern: "except asyncio.CancelledError"
    - from: "runs.py replay_tail_consumer Phase 2 xread (line 162-174)"
      to: "same differentiated handler — symmetric defense"
      via: "explicit except clauses in priority order"
      pattern: "except RedisTimeoutError"
    - from: "runs.py post-BLOCK exists probe (line 183-196)"
      to: "same differentiated handler — symmetric defense per RESEARCH Open Question 4 recommendation"
      via: "explicit except clauses in priority order"
      pattern: "consumer disconnected \\(xread cancellation-equivalent\\)"
---

<objective>
Differentiate `redis.exceptions.TimeoutError` (cancellation-equivalent — caused by `redis-py`'s `async_timeout` wrapper converting `CancelledError` on socket-read) from genuine `RedisError` failures (connection reset, OOM, cluster failover) at the three xread call sites in `replay_tail_consumer`. The current code logs `.exception(...)` (full traceback) for ALL RedisErrors, which produces alarming-looking stack traces in production logs every time a browser tab refreshes (UX-067-04).

Add explicit `asyncio.CancelledError` re-raise (cooperative cancellation contract — Phase 059 D-059-04) ABOVE the RedisError handler at all three sites. Keep traceback for genuine RedisError; INFO-only log (no traceback) for `RedisTimeoutError`.

Purpose: closes UX-067-04. Backend logs become quiet on tab cycle (no false alarm), while genuine Redis failures still surface with full diagnostics.

Output: `runs.py` with one new module-top import alias and three differentiated xread handlers (lines ~104, ~163, ~184).
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md

<interfaces>
<!-- Existing wiring this plan modifies. -->

From `backend/app/api/runs.py:1-60` (module top — site of new import):
```python
"""Phase 062 — /runs/* endpoint module.

(... module docstring with variable-shadowing trap warning at lines 24-30 ...)
"""
import asyncio
import json
import logging
import time as time_mod
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sse_starlette import EventSourceResponse
from supabase import Client
# Top-level import — see module docstring for why `import redis.exceptions`
# would break inside the route handler (variable shadowing on the `redis`
# parameter). Phase 061 follows the same convention in threads.py.
from redis.exceptions import RedisError    # ← extend with TimeoutError alias
```

From `backend/app/api/runs.py:104-117` (Phase 1 replay xread — site #1):
```python
try:
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
    )
except RedisError:
    logger.exception(
        "replay_tail_consumer xread (replay phase) raised RedisError "
        "for run %s (likely malformed since=%r)",
        run_id,
        since,
    )
    yield {"data": json.dumps({"type": "error", "error": "invalid_since"})}
    return
```

From `backend/app/api/runs.py:162-174` (Phase 2 live-tail xread — site #2):
```python
try:
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
        block=5000,
    )
except RedisError:
    logger.exception(
        "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

From `backend/app/api/runs.py:183-196` (post-BLOCK exists probe — site #3):
```python
try:
    if not await redis.exists(stream_key):
        yield {"data": json.dumps({
            "type": "error",
            "error": "buffer_expired_during_tail",
        })}
        return
except (RedisError, OSError):
    logger.exception(
        "replay_tail_consumer post-BLOCK exists probe failed for run %s",
        run_id,
    )
```

Existing cooperative cancellation analog at `backend/app/api/threads.py:2374-2375` (verbatim shape to mirror):
```python
except asyncio.CancelledError:
    raise   # propagate; lifespan-cancel path
```

Phase 062 D-062-14 file-layout discipline (verified — runs.py is OUT of any threads.py carved off-limits region; runs.py was created BY Phase 062 plan 02).

Phase 059 D-059-04 cooperative cancellation invariant: `asyncio.CancelledError` MUST be re-raised; never swallowed. The handler may log INFO before re-raising but MUST end with `raise`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `RedisTimeoutError` import alias at module top</name>
  <files>backend/app/api/runs.py</files>
  <read_first>
    - backend/app/api/runs.py (lines 1-60 — module docstring + imports; the variable-shadowing trap is documented at lines 24-30)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern J — exact import shape)
  </read_first>
  <behavior>
    - Module-top alias import. The `redis: aioredis.Redis = Depends(get_redis)` parameter at runs.py:267 / replay_tail_consumer's `redis` parameter shadow the `redis` module name inside function bodies, so any `redis.exceptions.X` reference inside the body would AttributeError.
    - Aliasing as `RedisTimeoutError` avoids name collision with Python's built-in `TimeoutError` (which is what the redis-py wrapper subclasses, but the canonical reference at this site is the redis-py specific class).
    - Verify: `redis.exceptions.TimeoutError IS a subclass of RedisError` (RESEARCH lines 425). The narrow except chain catches RedisTimeoutError BEFORE RedisError; that's the cleanest pattern.
  </behavior>
  <action>
    In `backend/app/api/runs.py` at line 48, change:

    ```python
    from redis.exceptions import RedisError
    ```

    to:

    ```python
    # Phase 067 D-067-04: alias TimeoutError as RedisTimeoutError to differentiate
    # the redis-py async_timeout wrapper conversion (cancellation-equivalent on
    # xread BLOCK) from genuine RedisError. Variable-shadowing-safe: the `redis`
    # module is shadowed inside the route body by `redis: aioredis.Redis =
    # Depends(get_redis)`, so writing `redis.exceptions.TimeoutError` would
    # AttributeError. Module-level alias is the canonical safe approach.
    from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError
    ```

    Do NOT touch any other import. Do NOT change the variable name `RedisError` (it's used throughout the existing file). Do NOT use `import redis.exceptions` (Pitfall 2 — variable shadowing).
  </action>
  <acceptance_criteria>
    - `grep -n "from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError" backend/app/api/runs.py` returns 1 match.
    - `grep -c "import redis.exceptions" backend/app/api/runs.py` returns 0 (Pitfall 2 violation absent).
    - `grep -n "from redis.exceptions import RedisError$" backend/app/api/runs.py` returns 0 matches (the old import is replaced).
    - Backend boots: `cd backend && venv/Scripts/python.exe -c "from app.api.runs import replay_tail_consumer; print('OK')"` returns "OK" exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -c "from app.api.runs import replay_tail_consumer; print('OK')"</automated>
  </verify>
  <done>
    Module-top import is `from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError`. The runs module imports cleanly; replay_tail_consumer is importable.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Differentiate cancellation/timeout/error handlers at all three xread call sites</name>
  <files>backend/app/api/runs.py</files>
  <read_first>
    - backend/app/api/runs.py (lines 89-225 — replay_tail_consumer body covering all three xread call sites)
    - backend/app/api/threads.py (lines 2374-2375 — `except asyncio.CancelledError: raise` shape to mirror; verify at read time, do not modify)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern J — full before/after)
    - .planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md (RESEARCH Open Question 4 — symmetric defense recommendation)
  </read_first>
  <behavior>
    - Three xread call sites: line 104 (Phase 1 replay), line 163 (Phase 2 live-tail), line 184 (post-BLOCK exists probe).
    - At each site, the handler order MUST be: `asyncio.CancelledError` (re-raise; preserves Phase 059 D-059-04 cooperative cancellation), `RedisTimeoutError` (INFO log + clean SSE error close, no traceback), `RedisError` (full `.exception()` traceback for genuine failures + clean SSE error close). Order matters because `RedisTimeoutError IS a subclass of RedisError` — the narrower clause MUST come first.
    - The post-BLOCK exists probe at site #3 currently has a tuple-catch `except (RedisError, OSError)`; preserve OSError handling alongside the new differentiated logic.
    - At all three sites, the existing `yield {"data": json.dumps({...})}` SSE error event behavior is preserved on RedisTimeoutError AND RedisError paths so the consumer-side socket gets a clean close event before the consumer returns. The CancelledError path does NOT yield (re-raises immediately — the asyncio task is being cancelled and yielding into a dead generator is undefined behavior).
    - INFO-level log message format includes `run_id` for traceability. No PII in the message.
  </behavior>
  <action>
    Three near-identical edits in `backend/app/api/runs.py`. Apply each one in turn, preserving the surrounding code byte-identical (Pitfall 1 — no re-indenting the xread call body).

    **Edit 1 — Site #1 (Phase 1 replay xread, lines 104-117).** Replace:

    ```python
    try:
        result = await redis.xread(
            streams={stream_key: last_id},
            count=100,
        )
    except RedisError:
        logger.exception(
            "replay_tail_consumer xread (replay phase) raised RedisError "
            "for run %s (likely malformed since=%r)",
            run_id,
            since,
        )
        yield {"data": json.dumps({"type": "error", "error": "invalid_since"})}
        return
    ```

    with:

    ```python
    try:
        result = await redis.xread(
            streams={stream_key: last_id},
            count=100,
        )
    except asyncio.CancelledError:
        # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
        # Client disconnected; log INFO and re-raise so the asyncio task state
        # stays correct. No yield — the generator is being torn down.
        logger.info(
            "replay_tail_consumer xread (replay phase) cancelled by client "
            "disconnect for run %s",
            run_id,
        )
        raise
    except RedisTimeoutError:
        # D-067-04: redis-py's async_timeout wrapper converted a socket-read
        # deadline / cancellation into TimeoutError. Cancellation-equivalent at
        # this site — INFO-only, no traceback. Yield a clean SSE error event
        # so the consumer-side socket closes naturally; do NOT propagate as 503.
        logger.info(
            "replay_tail_consumer xread (replay phase) socket timeout for run %s "
            "(consumer disconnected; xread cancellation-equivalent)",
            run_id,
        )
        yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
        return
    except RedisError:
        logger.exception(
            "replay_tail_consumer xread (replay phase) raised RedisError "
            "for run %s (likely malformed since=%r)",
            run_id,
            since,
        )
        yield {"data": json.dumps({"type": "error", "error": "invalid_since"})}
        return
    ```

    **Edit 2 — Site #2 (Phase 2 live-tail xread, lines 162-174).** Replace:

    ```python
    try:
        result = await redis.xread(
            streams={stream_key: last_id},
            count=100,
            block=5000,
        )
    except RedisError:
        logger.exception(
            "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
            run_id,
        )
        yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
        return
    ```

    with:

    ```python
    try:
        result = await redis.xread(
            streams={stream_key: last_id},
            count=100,
            block=5000,
        )
    except asyncio.CancelledError:
        # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
        logger.info(
            "replay_tail_consumer xread (tail phase) cancelled by client "
            "disconnect for run %s",
            run_id,
        )
        raise
    except RedisTimeoutError:
        # D-067-04: redis-py async_timeout wrapper conversion;
        # cancellation-equivalent at this site (the only thing it means here is
        # the consumer's blocking xread was interrupted while no client was
        # actively listening). INFO-only, no traceback.
        logger.info(
            "replay_tail_consumer xread (tail phase) socket timeout for run %s "
            "(consumer disconnected; xread cancellation-equivalent)",
            run_id,
        )
        yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
        return
    except RedisError:
        logger.exception(
            "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
            run_id,
        )
        yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
        return
    ```

    **Edit 3 — Site #3 (post-BLOCK exists probe, lines 183-196).** This site has a tuple-catch `except (RedisError, OSError)` which we preserve for OSError. Replace:

    ```python
    try:
        if not await redis.exists(stream_key):
            yield {"data": json.dumps({
                "type": "error",
                "error": "buffer_expired_during_tail",
            })}
            return
    except (RedisError, OSError):
        # Best-effort probe; if it fails, fall through to the
        # original deadline-based behavior rather than dying.
        logger.exception(
            "replay_tail_consumer post-BLOCK exists probe failed for run %s",
            run_id,
        )
    ```

    with:

    ```python
    try:
        if not await redis.exists(stream_key):
            yield {"data": json.dumps({
                "type": "error",
                "error": "buffer_expired_during_tail",
            })}
            return
    except asyncio.CancelledError:
        # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
        # Symmetric defense per RESEARCH Open Question 4: same shape as the two
        # xread sites above so a tab-cycle interrupt during the post-BLOCK probe
        # does not surface a stack trace either.
        logger.info(
            "replay_tail_consumer post-BLOCK exists probe cancelled by client "
            "disconnect for run %s",
            run_id,
        )
        raise
    except RedisTimeoutError:
        # D-067-04: cancellation-equivalent at this site too. Best-effort probe;
        # fall through to deadline-based loop rather than yielding an error.
        logger.info(
            "replay_tail_consumer post-BLOCK exists probe socket timeout for run %s "
            "(consumer disconnected; xread cancellation-equivalent)",
            run_id,
        )
    except (RedisError, OSError):
        # Best-effort probe; if it fails (genuine Redis failure or socket OSError),
        # fall through to the original deadline-based behavior rather than dying.
        logger.exception(
            "replay_tail_consumer post-BLOCK exists probe failed for run %s",
            run_id,
        )
    ```

    DO NOT touch:
    - The `for _stream_name, entries in result:` per-entry yield loops at lines 120-151 and 198-222 (Pitfall 1 — byte-identical preservation; the BaseException wrapper there is intentional from 061.1 H1 mitigation).
    - The outer `try/finally: pass` at line 89/223 (D-061-03 contract — consumer disconnect MUST NOT cancel producer; preserve verbatim).
    - The deadline guard at lines 92/155 (D-062-05 deadline machinery).
    - The `await redis.exists(stream_key)` call inside the probe — only the surrounding except chain changes.
    - Any logic in `_synthetic_terminal_generator` (line 233+) or the route handler (line 267+).
  </action>
  <acceptance_criteria>
    - `grep -c "except asyncio.CancelledError" backend/app/api/runs.py` returns at least 3 matches (one per xread site).
    - `grep -c "except RedisTimeoutError" backend/app/api/runs.py` returns at least 3 matches (one per site).
    - `grep -c "consumer disconnected; xread cancellation-equivalent" backend/app/api/runs.py` returns at least 3 matches (the canonical INFO log substring at all three sites).
    - `grep -c "logger.exception" backend/app/api/runs.py` returns at least 3 matches (genuine RedisError still logs full traceback at all three sites).
    - All three CancelledError handlers end with `raise` (cooperative cancellation invariant): `grep -A2 "except asyncio.CancelledError" backend/app/api/runs.py | grep -c "^.*    raise$"` returns at least 3.
    - `except (RedisError, OSError)` tuple still present at site #3: `grep -n "except (RedisError, OSError)" backend/app/api/runs.py` returns at least 1 match.
    - Phase 062 D-062-14 file-layout: edits ONLY in runs.py — `git diff --name-only` shows ONLY backend/app/api/runs.py among backend changes.
    - Outer `try/finally: pass` (D-061-03) at the bottom of replay_tail_consumer preserved: `grep -A2 "finally:" backend/app/api/runs.py | grep -c "^        pass$"` returns at least 1 match (the no-op finally — consumer must NOT cancel producer).
    - Module imports cleanly: `cd backend && venv/Scripts/python.exe -c "from app.api.runs import replay_tail_consumer; print('OK')"` returns "OK" exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -c "from app.api.runs import replay_tail_consumer; print('OK')" && venv/Scripts/python.exe -m pytest tests/api/test_runs_cancellation.py tests/integration/test_062_redis_down.py tests/integration/test_062_stream_replay.py tests/integration/test_062_stream_terminal.py -x -q</automated>
  </verify>
  <done>
    All three xread call sites have differentiated `asyncio.CancelledError` (re-raise) → `RedisTimeoutError` (INFO log, clean SSE close) → `RedisError` (full traceback, clean SSE close) handlers. Site #3 preserves `(RedisError, OSError)` tuple for the legitimate genuine-failure path. Outer `try/finally: pass` D-061-03 contract preserved. Existing 062 stream replay/terminal/redis-down integration tests pass — no regression in the SSE error-event contract.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create monkey-patched cancellation tests at backend/tests/api/test_runs_cancellation.py (BLK-2 closure / VALIDATION.md Wave 0 link fix)</name>
  <files>backend/tests/api/__init__.py, backend/tests/api/test_runs_cancellation.py</files>
  <read_first>
    - backend/tests/integration/test_062_redis_down.py (lines 1-120 — analog test pattern: build a Mock redis whose async methods raise; uses pytest-asyncio + httpx + ASGITransport pattern for the route, but a direct generator-driving pattern is acceptable here since replay_tail_consumer is exported)
    - backend/app/api/runs.py (post-edits from Tasks 1+2 — the three differentiated handlers; needed to know the exact INFO-log substring the tests assert on, which MUST equal "consumer disconnected; xread cancellation-equivalent" per Plan 03 Task 2)
    - backend/tests/conftest.py (existing pytest fixtures; especially confirm caplog is available — it is built-in to pytest 7.x, no plugin required)
  </read_first>
  <behavior>
    - Three pytest tests in a NEW file `backend/tests/api/test_runs_cancellation.py` that monkey-patch `redis.xread` to raise specific exceptions and assert log behavior + re-raise behavior using pytest's built-in `caplog` fixture.
    - Test 1 (`test_xread_cancellation_logs_info_no_traceback`): monkey-patch xread to raise `asyncio.CancelledError` on first invocation → call `replay_tail_consumer` and consume → assert at least one INFO record present, no record's text contains "Traceback", and `CancelledError` is re-raised (`pytest.raises(asyncio.CancelledError)`).
    - Test 2 (`test_xread_redis_timeout_logs_info_no_traceback`): monkey-patch xread to raise `redis.exceptions.TimeoutError` → consume the generator → assert at least one INFO record contains the canonical substring `"consumer disconnected; xread cancellation-equivalent"` (this MUST equal the substring used in Plan 03 Task 2), no "Traceback" in any record, a sentinel SSE error event is yielded (NOT propagated as a 503 — client gone).
    - Test 3 (`test_xread_genuine_redis_error_keeps_traceback`): monkey-patch xread to raise generic `redis.exceptions.ConnectionError` (a RedisError subclass that is NOT TimeoutError) → consume the generator → assert ERROR-level log record present with `exc_info` non-None (logger.exception sets exc_info to the active exception tuple; that's what handlers render as the traceback). This is the regression guard that genuine cluster-failover / OOM / connection-reset diagnostics survive the D-067-04 cleanup.
    - Test infrastructure parity: same `pytest-asyncio` + `MagicMock` + `AsyncMock` patterns as `test_062_redis_down.py`. Tests do NOT need to drive the FastAPI route — they call `replay_tail_consumer` directly as an async generator since the function is exported (`from app.api.runs import replay_tail_consumer`). Driving the route via httpx is acceptable as an alternative if the executor finds it cleaner; either approach satisfies BLK-2.
  </behavior>
  <action>
    Create TWO new files. Both must be created — `__init__.py` is required because `tests/api/` is a new test package and pytest discovery needs the marker.

    **File 1 — `backend/tests/api/__init__.py`** (empty marker file with one comment):

    ```python
    # Phase 067 — backend/tests/api/ test package marker. Sibling to
    # backend/tests/integration/. Created in Plan 067-03 Task 3 (BLK-2 closure)
    # alongside test_runs_cancellation.py.
    ```

    **File 2 — `backend/tests/api/test_runs_cancellation.py`**:

    ```python
    """D-067-04 — runs.py xread cancellation differentiation tests.

    Phase 067 BLK-2 closure: asserts the post-Plan-03 behavior at the three
    xread call sites in `replay_tail_consumer`:

    Test 1 (asyncio.CancelledError path):
      - monkey-patch xread to raise CancelledError
      - assert INFO log record present
      - assert no \"Traceback\" substring in any log record
      - assert CancelledError is re-raised (Phase 059 D-059-04 cooperative
        cancellation invariant)

    Test 2 (RedisTimeoutError path — the cancellation-equivalent):
      - monkey-patch xread to raise redis.exceptions.TimeoutError
      - assert INFO log record contains the canonical substring
        \"consumer disconnected; xread cancellation-equivalent\"
      - assert no \"Traceback\" substring
      - assert a sentinel SSE error event is yielded (not propagated as 503)

    Test 3 (genuine RedisError keeps traceback):
      - monkey-patch xread to raise redis.exceptions.ConnectionError
      - assert ERROR-level log record present (logger.exception)
      - assert exc_info is non-None on the error record (full traceback intact)

    Verifies:
      - Phase 059 D-059-04 cooperative cancellation contract.
      - D-067-04 INFO-not-traceback differentiation.
      - No regression to genuine-failure traceback diagnostics.
    """
    import asyncio
    import json
    import logging
    from unittest.mock import MagicMock, AsyncMock
    from uuid import uuid4

    import pytest
    import redis.exceptions

    from app.api.runs import replay_tail_consumer


    CANONICAL_INFO_SUBSTRING = "consumer disconnected; xread cancellation-equivalent"


    def _build_redis_mock(xread_side_effect):
        """Build a Mock redis client whose xread raises the supplied exception.

        Other methods (`exists`) are stubbed to return True so the post-BLOCK
        probe path does not conflate with the xread error.
        """
        client = MagicMock()
        client.xread = AsyncMock(side_effect=xread_side_effect)
        client.exists = AsyncMock(return_value=True)
        return client


    @pytest.mark.asyncio
    @pytest.mark.timeout(10)
    async def test_xread_cancellation_logs_info_no_traceback(caplog):
        """D-067-04 / Phase 059 D-059-04: CancelledError on xread → INFO log,
        no traceback, re-raised cooperatively.
        """
        run_id = str(uuid4())
        client = _build_redis_mock(asyncio.CancelledError())

        # runs.py uses `logger = logging.getLogger(__name__)`. Set caplog level
        # at the module logger so we capture INFO and above for that module.
        caplog.set_level(logging.INFO, logger="app.api.runs")

        gen = replay_tail_consumer(run_id, "0", client)

        with pytest.raises(asyncio.CancelledError):
            async for _ in gen:
                pass

        # Phase 059 D-059-04: at least one INFO record (the cooperative
        # cancellation log line in runs.py).
        info_records = [r for r in caplog.records if r.levelno == logging.INFO]
        assert len(info_records) >= 1, (
            f"Expected at least one INFO record on CancelledError; got "
            f"{[(r.levelname, r.message) for r in caplog.records]!r}"
        )

        # D-067-04: no traceback rendered. logger.info() does NOT emit traceback
        # metadata (exc_info is None on level=INFO calls in runs.py).
        for r in caplog.records:
            text = r.getMessage()
            assert "Traceback" not in text, (
                f"D-067-04 violation: 'Traceback' substring found in record "
                f"{r.levelname}: {text!r}"
            )
            if r.levelno == logging.INFO:
                assert r.exc_info is None, (
                    f"D-067-04 violation: INFO record carries exc_info: {r.message!r}"
                )


    @pytest.mark.asyncio
    @pytest.mark.timeout(10)
    async def test_xread_redis_timeout_logs_info_no_traceback(caplog):
        """D-067-04: RedisTimeoutError (redis-py async_timeout wrapper conversion)
        on xread → INFO log with canonical substring, no traceback, sentinel SSE
        error event yielded (NOT a 503).
        """
        run_id = str(uuid4())
        client = _build_redis_mock(redis.exceptions.TimeoutError("socket timeout (test)"))

        caplog.set_level(logging.INFO, logger="app.api.runs")

        gen = replay_tail_consumer(run_id, "0", client)

        # Drive the generator and capture all yielded SSE events.
        yielded = []
        async for event in gen:
            yielded.append(event)

        # D-067-04: canonical INFO substring present (this MUST match the
        # substring used in Plan 03 Task 2 INFO log calls).
        info_messages = [r.getMessage() for r in caplog.records if r.levelno == logging.INFO]
        assert any(CANONICAL_INFO_SUBSTRING in m for m in info_messages), (
            f"Expected INFO record containing {CANONICAL_INFO_SUBSTRING!r}; "
            f"got {info_messages!r}"
        )

        # D-067-04: no traceback rendered (logger.info, not .exception).
        for r in caplog.records:
            text = r.getMessage()
            assert "Traceback" not in text, (
                f"D-067-04 violation: 'Traceback' in record {r.levelname}: {text!r}"
            )
            if r.levelno == logging.INFO:
                assert r.exc_info is None, (
                    f"D-067-04 violation: INFO record carries exc_info: {r.message!r}"
                )

        # Sentinel SSE error event yielded (replay phase site #1 yields
        # `redis_timeout`; tail phase yields the same; site #3 falls through
        # without yielding). This test exercises the replay phase (first xread
        # call), so we expect AT LEAST one event whose JSON body has
        # `type: "error"`.
        assert len(yielded) >= 1, (
            "Expected at least one yielded SSE event on RedisTimeoutError "
            "(replay phase yields a sentinel before returning)."
        )
        first_event = yielded[0]
        body = json.loads(first_event["data"])
        assert body.get("type") == "error", (
            f"Expected first yielded event to be type:error sentinel; got {body!r}"
        )


    @pytest.mark.asyncio
    @pytest.mark.timeout(10)
    async def test_xread_genuine_redis_error_keeps_traceback(caplog):
        """D-067-04 (regression guard): genuine RedisError (e.g. ConnectionError
        from cluster failover) STILL produces full traceback at ERROR level —
        only the narrow RedisTimeoutError clause is downgraded to INFO.
        """
        run_id = str(uuid4())
        # ConnectionError is a RedisError subclass that is NOT TimeoutError.
        # This is the canonical "cluster failover / OOM / connection reset" case.
        client = _build_redis_mock(
            redis.exceptions.ConnectionError("simulated cluster failover")
        )

        caplog.set_level(logging.DEBUG, logger="app.api.runs")

        gen = replay_tail_consumer(run_id, "0", client)

        # Drive the generator. The except RedisError clause yields a sentinel
        # error event and returns; no exception propagates to the caller.
        yielded = []
        async for event in gen:
            yielded.append(event)

        # D-067-04 regression guard: ERROR-level record present (logger.exception
        # emits at ERROR with exc_info set).
        error_records = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_records) >= 1, (
            f"Expected at least one ERROR record on genuine RedisError; "
            f"got {[(r.levelname, r.message) for r in caplog.records]!r}"
        )

        # Full traceback intact: at least one ERROR record carries exc_info
        # (logger.exception sets exc_info to the active exception tuple). When
        # exc_info is set, log handlers render the traceback — this is what we
        # are asserting NOT regressed.
        records_with_exc = [r for r in error_records if r.exc_info is not None]
        assert len(records_with_exc) >= 1, (
            f"Expected at least one ERROR record with exc_info set "
            f"(traceback intact); got exc_info={[r.exc_info for r in error_records]!r}"
        )
    ```

    Notes for the executor:
    - The `from app.api.runs import replay_tail_consumer` import resolves the post-Tasks-1+2 module. Run the test file AFTER Tasks 1+2 land — order matters because the tests assert behavior of the new differentiated handlers.
    - The `CANONICAL_INFO_SUBSTRING` constant MUST equal the literal string used in Plan 03 Task 2's `logger.info(...)` calls. Per Task 2's action body, the canonical substring is `"consumer disconnected; xread cancellation-equivalent"`. If Task 2 settles on a different substring during execution, update this constant accordingly (this is the only place where Plan 03 Task 3's tests couple to Task 2's exact log message text).
    - `caplog` is pytest's built-in fixture; no plugin install required (already in pytest 7.x).
    - `replay_tail_consumer` signature is `(run_id: str, since: str, redis: aioredis.Redis)` — third positional arg is the redis client (NOT injected via `Depends` at this layer). Passing the MagicMock-built client directly is the cleanest test driver.
    - If the executor finds that `replay_tail_consumer` is NOT importable as `from app.api.runs import replay_tail_consumer` (e.g., it was renamed in Tasks 1+2 — unlikely), they should adapt the import to the actual public symbol used by the route handler. Document any deviation per Rule 3.

    Do NOT touch:
    - `backend/tests/integration/test_062_redis_down.py` (analog source; preserve verbatim).
    - `backend/tests/conftest.py` (existing fixtures intact).
    - `backend/app/api/runs.py` (this task only creates test files; Tasks 1+2 own the source diff).
  </action>
  <acceptance_criteria>
    - File `backend/tests/api/__init__.py` exists.
    - File `backend/tests/api/test_runs_cancellation.py` exists.
    - Three test functions defined: `grep -c '^async def test_xread' backend/tests/api/test_runs_cancellation.py` returns at least 3.
    - Canonical INFO substring constant present (and matches Plan 03 Task 2's INFO log substring): `grep -c 'consumer disconnected; xread cancellation-equivalent' backend/tests/api/test_runs_cancellation.py` returns at least 1.
    - Three side_effect classes covered: `grep -c 'asyncio.CancelledError\|redis.exceptions.TimeoutError\|redis.exceptions.ConnectionError' backend/tests/api/test_runs_cancellation.py` returns at least 3.
    - All three tests pass when invoked: `cd backend && venv/Scripts/python.exe -m pytest tests/api/test_runs_cancellation.py -x -v` exits 0 with all 3 tests reported as PASSED. (This task depends on Tasks 1+2 having landed first; running in isolation against the pre-Task-2 source will fail — that is by design and confirms the tests are not no-ops.)
  </acceptance_criteria>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -m pytest tests/api/test_runs_cancellation.py -x -v</automated>
  </verify>
  <done>
    `backend/tests/api/test_runs_cancellation.py` exists with three monkey-patched tests covering the CancelledError, RedisTimeoutError, and genuine RedisError paths. All three tests pass against the post-Tasks-1+2 differentiated handlers. The `__init__.py` package marker is in place. VALIDATION.md Wave 0 row for `backend/tests/api/test_runs_cancellation.py` can now be checked. BLK-2 closure complete.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Backend log file → operator | Logs may be aggregated to a SIEM or log search; INFO vs ERROR level affects alert volume but not data exposure. |
| Redis socket → consumer generator | Existing trust boundary unchanged — `redis-py` async wrapper handles socket-level errors. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-067-03-01 | Information disclosure | Backend log poisoning / stack trace info-leak in production logs | mitigate | UX-067-04 root cause: `redis.exceptions.TimeoutError` traceback dumps async stack frames including line numbers + variable references on every tab cycle. INFO-level structured log without traceback (`logger.info(..., run_id)`) reveals only the run_id (already user-bound, RLS-protected) — no async stack frames, no internal file paths. Mitigation is the entire purpose of D-067-04. |
| T-067-03-02 | Denial of Service | Cooperative cancellation contract (Phase 059 D-059-04) | mitigate | Swallowing `asyncio.CancelledError` would leave the asyncio task in an inconsistent state and could mask shutdown failures. Always re-raise. The plan enforces this with grep-verifiable acceptance criterion ("All three CancelledError handlers end with `raise`"). |
| T-067-03-03 | Repudiation | Genuine RedisError silently downgraded to INFO | accept | Mitigated by keeping `logger.exception(...)` for the third except clause — only the narrow `RedisTimeoutError` clause is downgraded. Cluster failover / OOM / connection reset still produce full tracebacks. Verified by acceptance criterion ("`grep -c logger.exception` returns at least 3"). |

The post-BLOCK exists probe at site #3 keeps `(RedisError, OSError)` tuple for OSError handling — this preserves the existing best-effort-degraded-fallback semantics; no new threat surface.
</threat_model>

<verification>
Phase-wide checks for this plan:
- Module imports cleanly (Task 1 verify).
- Three integration tests still pass: `test_062_redis_down.py`, `test_062_stream_replay.py`, `test_062_stream_terminal.py` — these are the closest existing regression baseline for this consumer's error-event contract.

Live verification (D-067-07 — moved to Plan 05 closing UAT):
- Chrome MCP: open http://localhost:5173/ as fhdmrd@gmail.com, submit a long-running prompt, observe SSE stream open in DevTools Network tab. Then refresh the tab.
- Backend log inspection: `tail backend/logs/...` (or wherever uvicorn dumps stdout) — verify NO `Traceback (most recent call last):` block from `redis/asyncio/...` or runs.py xread call sites in the seconds following the refresh. Verify presence of one INFO-level "consumer disconnected" or "socket timeout" log line carrying the run_id.
- Captured fully in Plan 05 evidence with run_id.
</verification>

<success_criteria>
- runs.py imports `RedisTimeoutError` alias at module top.
- All three xread call sites (replay phase, tail phase, post-BLOCK probe) have differentiated handlers in priority order: CancelledError → RedisTimeoutError → RedisError.
- All three CancelledError handlers end with `raise` (cooperative cancellation contract).
- All three RedisTimeoutError handlers log INFO without traceback and yield a clean SSE error event (sites #1, #2) or fall through (site #3, best-effort probe).
- All three RedisError handlers continue to log `.exception()` (full traceback) for genuine Redis failures.
- Outer `try/finally: pass` (D-061-03) at bottom of replay_tail_consumer preserved verbatim.
- Phase 062 D-062-14 file layout respected: ONLY runs.py touched in this plan.
- Existing 062 integration tests pass — no regression in SSE error-event contract.
- BLK-2 closure: backend/tests/api/test_runs_cancellation.py exists with 3 monkey-patched tests; all three pass; VALIDATION.md Wave 0 link is satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/067-frontend-streaming-ux-fix/067-03-SUMMARY.md` documenting:
- Module-top import alias added (line cited).
- Three differentiated handlers added (each with line range cited).
- Test results from `test_062_redis_down.py` / `test_062_stream_replay.py` / `test_062_stream_terminal.py`.
- Confirmation that runs.py is OUT of any threads.py off-limits region (D-062-14 sanity check).
- Any deviations from the plan (with rationale per Rule 3 of execute-plan.md).
</output>
