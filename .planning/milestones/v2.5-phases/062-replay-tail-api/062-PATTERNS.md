# Phase 062: Replay & Tail API - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 14 (3 new source + 2 modified source + 1 modified helper + 8 new test files; tracking 062-CONTEXT.md "in scope" + D-062-14 file layout)
**Analogs found:** 14 / 14 — every file in scope has a strong same-codebase analog (061 / 061.1 / earlier 058–059 conventions)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/runs.py` | controller (APIRouter module) | streaming + request-response | `backend/app/api/threads.py` (whole module — esp. `event_consumer`, `delete_thread`, `send_message` SSE return) | exact (role + data flow) |
| `backend/app/models/run.py` | model (Pydantic response) | request-response | `backend/app/models/thread.py` (`ThreadResponse`); `backend/app/models/message.py` (`MessageResponse`) | exact |
| `backend/app/api/threads.py` (MOD: append `GET /threads/{thread_id}/active-runs`) | controller (route addition) | request-response (CRUD-read, bare list) | `backend/app/api/threads.py:426-438` (`list_threads`); `backend/app/api/threads.py:591-616` (`get_messages` ownership SELECT) | exact (same file, same router) |
| `backend/app/main.py` (MOD: register `runs.router`) | config (router wiring) | startup | `backend/app/main.py:136-146` (existing `app.include_router(threads.router)` block) | exact |
| `backend/tests/integration/_run_helpers.py` (MOD: add zombie-state + fan-out helpers) | utility (test helper) | n/a | `backend/tests/integration/_run_helpers.py` (extend in place — IN-01 / D-061.1-11) | exact (same file) |
| `backend/tests/integration/test_062_active_runs.py` | test (integration) | request-response | `backend/tests/integration/test_061_runs_table.py` | exact (mock-supabase pattern, no Redis needed) |
| `backend/tests/integration/test_062_stream_replay.py` | test (integration) | streaming | `backend/tests/integration/test_061_producer_survives_disconnect.py` | exact (real Redis + mocked LLM + httpx.AsyncClient.stream) |
| `backend/tests/integration/test_062_stream_terminal.py` | test (integration) | streaming | `backend/tests/integration/test_061_ttl.py::test_completed_run_expires_600s` (drain-to-natural-completion pattern) | exact |
| `backend/tests/integration/test_062_stream_ttl_expired.py` | test (integration) | request-response | `backend/tests/integration/test_061_runs_table.py` (mock SELECT) + new pattern: pre-populate Redis without producer | role-match (composes two existing patterns) |
| `backend/tests/integration/test_062_delete_happy.py` | test (integration) | request-response + cancel | `backend/tests/integration/test_061_producer_survives_disconnect.py` (slow-mock-LLM + RUN_TASKS lookup + `await_producer_finalized`) | exact |
| `backend/tests/integration/test_062_delete_zombie.py` | test (integration) | request-response | none yet — closest is `test_061_runs_table.py`; CONTEXT/RESEARCH provide a NEW skeleton for "manually XADD/ZADD without producer" | role-match (new sub-pattern documented inline) |
| `backend/tests/integration/test_062_delete_terminal_idempotent.py` | test (integration) | request-response | `backend/tests/integration/test_061_runs_table.py` (mock-only, no Redis) | exact |
| `backend/tests/integration/test_062_cross_user_404.py` | test (integration) | request-response | `backend/tests/integration/test_061_runs_table.py` + dependency-override pattern (`conftest.py:80-81` for `get_current_user`) | exact |
| `backend/tests/integration/test_062_multi_consumer_fanout.py` | test (integration) | streaming (parallel) | `backend/tests/integration/test_061_producer_survives_disconnect.py` (httpx + ASGITransport baseline) + NEW `asyncio.gather` parallel-consumer wrapper | role-match (new sub-pattern in RESEARCH §Code Examples) |

## Pattern Assignments

### `backend/app/api/runs.py` (controller, streaming + request-response)

**Analog:** `backend/app/api/threads.py` (entire module — same project, same router idiom; 062 mirrors imports, the SSE response shape from `send_message`, the 204-style delete from `delete_thread`, and the consumer from `event_consumer`).

**Imports pattern** — copy structure from `threads.py:1-48`. The 062 module needs a strict subset:

```python
# Source: backend/app/api/threads.py:1-48 (project import convention)
import asyncio
import json
import logging
import time as time_mod
from datetime import datetime
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response          # for 204 No Content body discipline
from sse_starlette import EventSourceResponse
from supabase import Client
import redis.asyncio as aioredis

from app.dependencies import get_current_user, get_supabase, get_redis
from app.utils.db import aexec
from app.config import settings
from app.models.run import ActiveRunResponse    # if planner co-locates models there
# Cross-module import — D-062-14 keeps RUN_TASKS in threads.py for 062
from app.api.threads import (
    RUN_TASKS,
    TERMINAL_TYPES,
    _emit_terminal,
    _RUN_STATUS_TO_TERMINAL_TYPE,
)

router = APIRouter(prefix="/runs", tags=["runs"])
logger = logging.getLogger(__name__)
```

**Replay-tail consumer (mirrors `event_consumer`)** — copy `threads.py:336-423` verbatim with two changes: (1) initial `last_id = since` instead of `"0"`; (2) docstring callout to D-062-05.

```python
# Source: backend/app/api/threads.py:336-423 (event_consumer; lifted to module level
# in 061.1 IN-04 / D-061.1-10). 062's replay_tail_consumer mirrors verbatim with
# `last_id = since` instead of hardcoded `"0"`. Keep the WR-01 "carry last_id forward,
# no `$` reset" fix at threads.py:387-392. Keep the H1 BaseException wrappers around
# both per-entry yield bodies. Keep the deadline = run_hard_timeout_seconds + 10.
# Keep the no-op finally per D-061-03.

async def replay_tail_consumer(redis, run_id: UUID, since: str, settings):
    """Two-mode XREAD consumer — D-062 analogue of event_consumer.

    Difference from event_consumer (threads.py:336-423):
      - last_id starts at `since` (D-062-07; defaults to "0")
      - Otherwise structurally identical: WR-01 cursor carry-forward,
        TERMINAL_TYPES break, deadline guard, H1 BaseException wrap,
        D-061-03 no-op finally.
    """
    stream_key = f"run:{run_id}"
    last_id = since
    deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10
    try:
        # Phase 1: replay from `since` (no block; immediate return)
        # ... copy threads.py:362-385 body verbatim ...

        # Phase 2: live-tail (BLOCK 5000) — WR-01 (D-061.1-07): keep last_id; NO `$` reset
        # ... copy threads.py:393-415 body verbatim ...
    finally:
        pass   # D-061-03: consumer disconnect MUST NOT cancel producer
```

**Auth/ownership pattern (DELETE prologue and GET stream prologue)** — adapt `threads.py:683-691` (the `send_message` ownership SELECT), substituting `maybe_single()` for `single()` per RESEARCH §Code Examples:

```python
# Source: backend/app/api/threads.py:683-691 (send_message ownership SELECT)
# Adaptation per D-062-08: use maybe_single() so missing row returns None
# rather than raising APIError (postgrest patch in main.py:22-45 makes maybe_single
# safe; single() raises 204-as-APIError without the patch).
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**EventSourceResponse return** — copy `threads.py:2183-2186` verbatim including the `ping=None` H2 fix:

```python
# Source: backend/app/api/threads.py:2183-2186 (D-061.1-04 H2 fix)
# ping=None disables sse-starlette's keep-alive task to avoid the burst→quiet
# interleaving that produced ERR_INCOMPLETE_CHUNKED_ENCODING. ALL 062 stream
# endpoints use ping=None for byte-identical wire format with 061's POST.
return EventSourceResponse(
    replay_tail_consumer(redis=redis, run_id=run_id, since=since, settings=settings),
    ping=None,
)
```

**DELETE 204 pattern** — copy decorator from `threads.py:477` (and `documents.py:483`, `folders.py:131`, `skills.py:286,475` — same idiom across the codebase):

```python
# Source: backend/app/api/threads.py:477 (delete_thread route signature)
# Per Discretion in D-062-14: `status.HTTP_204_NO_CONTENT` over plain `204` for
# consistency with the 5 existing DELETE routes in this codebase.
@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def cancel_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    ...
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**Per-Redis-call try/except pattern (zombie heal + best-effort degradation)** — copy from the producer's `_shielded_finalize` block at `threads.py:2108-2138`. Note `BaseException` (not `Exception`) per CR-02/WR-03; for 062's route boundary the RESEARCH recommends plain `Exception` since there is no producer-side `asyncio.shield`. Use `Exception` in the route handler, document the deviation:

```python
# Source: backend/app/api/threads.py:2108-2138 (_shielded_finalize per-step try/except)
# Adaptation: 062's route handlers don't run inside asyncio.shield, so plain
# Exception (not BaseException) is appropriate — we WANT CancelledError to
# propagate so the response closes promptly on client disconnect.
# Each Redis call is independently wrapped + logged via logger.exception.
# Compare also threads.py:739-754 (ZADD spawn-failure cleanup) which is the
# same shape on the producer side.
try:
    if await redis.exists(f"run:{run_id}"):
        await _emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")
except Exception:
    logger.exception("Zombie heal sentinel XADD failed for run %s", run_id)

try:
    await redis.zrem("runs:active", str(run_id))
    await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
except Exception:
    logger.exception("Zombie heal ZREM failed for run %s", run_id)

try:
    await redis.expire(f"run:{run_id}", 60)   # 60s = failed/cancelled bucket per D-061-04
except Exception:
    logger.exception("Zombie heal EXPIRE failed for run %s", run_id)
```

**Synthetic terminal generator (TTL-expired path)** — NEW for 062, but mirrors the `EventSourceResponse(generator, ping=None)` plumbing and uses `_RUN_STATUS_TO_TERMINAL_TYPE` from `threads.py:87-91`:

```python
# Source: NEW (D-062-06). Reuses _RUN_STATUS_TO_TERMINAL_TYPE from
# backend/app/api/threads.py:87-91 — the same dict the producer's
# _shielded_finalize uses at threads.py:2109.
async def _synthetic_terminal_generator(runs_status: str, runs_error: str | None):
    mapped = _RUN_STATUS_TO_TERMINAL_TYPE.get(runs_status)
    if mapped is None:
        # Defensive: status='streaming' but Redis key missing — shouldn't happen,
        # but emit error rather than 500 so client renders cleanly.
        yield {"data": json.dumps({
            "type": "error",
            "error": "buffer_expired_while_streaming",
            "runs_status": runs_status,
        })}
        return
    yield {"data": json.dumps({
        "type": mapped,
        "error": "buffer_expired",   # D-062-06 discriminator
        "runs_status": runs_status,
        "runs_error": runs_error,
    })}
```

---

### `backend/app/models/run.py` (model, request-response)

**Analog:** `backend/app/models/thread.py` and `backend/app/models/message.py`.

**Full file pattern** — mirror `models/thread.py:1-22`:

```python
# Source: backend/app/models/thread.py:1-22 (Pydantic precedent)
# Same imports order; same single-class shape; UUID + datetime types
# auto-validated by FastAPI's response_model machinery.
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActiveRunResponse(BaseModel):
    run_id: UUID
    started_at: datetime
    status: str   # always 'streaming' per D-062-02; field present for forward-compat
```

D-062-04 requires the response_model to be `list[ActiveRunResponse]` — this matches `list_threads`'s `response_model=list[ThreadResponse]` shape.

---

### `backend/app/api/threads.py` (MOD — append `GET /threads/{thread_id}/active-runs`)

**Analog:** `backend/app/api/threads.py:426-438` (`list_threads` — same router, same bare-list response shape) + `backend/app/api/threads.py:591-616` (`get_messages` — ownership SELECT pattern).

**Where to append:** Per D-062-14, "near `list_threads` at line 329." Concretely: insert AFTER `list_threads` (currently lines 426-438) and BEFORE `create_thread` (currently lines 441-460). Do NOT touch any other code in this file — the 061.1 cleanup work is in this same file's `event_consumer` (336-423), `agent_runner` (757-2156), `_shielded_finalize` (2087-2146), and `send_message` (675-2186) regions.

**Import additions at top of file:** `from app.models.run import ActiveRunResponse`. The route can also be defined in `runs.py` and `app.include_router`'d separately, but D-062-14 explicitly puts it in `threads.py` for prefix routing under `/threads`.

**Route pattern (compose `list_threads` shape + `get_messages` ownership check + `send_message`-style `aexec`):**

```python
# Source: backend/app/api/threads.py:426-438 (list_threads — bare-list shape, response_model)
#       + backend/app/api/threads.py:591-616 (get_messages — ownership SELECT + 404)
#       + backend/app/api/threads.py:683-691 (send_message — aexec convention since D-058-03)
@router.get("/{thread_id}/active-runs", response_model=list[ActiveRunResponse])
async def list_active_runs(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Ownership check — mirror get_messages:597-606 (single() + 404 on missing row)
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # D-062-02: streaming-only filter; uses idx_runs_active partial index
    # (migration 035, lines 38-40). ORDER BY started_at DESC per Discretion.
    response = await aexec(
        supabase.table("runs")
        .select("run_id, started_at, status")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
        .eq("status", "streaming")
        .order("started_at", desc=True)
    )
    return response.data or []
```

**Anti-pattern guard:** Do NOT add `from app.api.runs import …` here — the import direction is `runs.py → threads.py`, not the reverse (D-062-14 + RESEARCH "Architecture Patterns"). The `ActiveRunResponse` model lives in `app.models.run`, not in `app.api.runs`, precisely so this active-runs route in `threads.py` can import the model without creating a circular import.

---

### `backend/app/main.py` (MOD — register `runs.router`)

**Analog:** `backend/app/main.py:136-146` (the existing import + `app.include_router` block).

**Edit:** add `runs` to the import list and add one `app.include_router` line:

```python
# Source: backend/app/main.py:136-146 (existing router registration block)
# Insert `runs` into the comma-separated import; add include_router below.
from app.api import (
    threads, runs, documents, settings as settings_api, folders,
    kb, skills, audit, knowledge_health, feedback,
)  # noqa: E402

app.include_router(threads.router)
app.include_router(runs.router)        # ← new: 062
app.include_router(documents.router)
# ... (rest unchanged) ...
```

No other changes to `main.py`. The lifespan block at `main.py:54-101` already cancels `RUN_TASKS` on shutdown and pings Redis on startup — both serve 062 unchanged.

---

### `backend/tests/integration/_run_helpers.py` (MOD — add zombie-state + fan-out helpers)

**Analog:** `backend/tests/integration/_run_helpers.py` itself — Phase 061.1 IN-01 / D-061.1-11 established this is the canonical home for shared run-related test helpers. **Extend in place** per D-062-14 Discretion.

**Pattern:** add new helpers at the bottom of the file, AFTER `await_producer_finalized` (currently ends at line 349). Keep the existing imports + constants unchanged.

```python
# Source: extend backend/tests/integration/_run_helpers.py (current file ends at line 349)
# New helpers for 062 — use the same MagicMock + asyncio + UUID/uuid4 imports
# already at top of file. Examples below; planner finalizes shape.

# 062 zombie-state setup helper (used by test_062_delete_zombie.py)
# Mirror: pre-populates Redis stream + sorted-set entries WITHOUT spawning
# a producer task. The mock_supabase already routes 'runs' through a builder.
async def setup_zombie_state(
    redis_client,
    mock_supabase,
    run_id,
    thread_id,
    *,
    n_entries: int = 1,
):
    """Simulate a zombie: producer wrote N entries then died without finalizing.
    runs.status='streaming' in Postgres; RUN_TASKS does NOT contain run_id.
    """
    import json, time
    stream_key = f"run:{run_id}"
    for i in range(n_entries):
        await redis_client.xadd(stream_key, {"data": json.dumps({"type": "delta", "content": f"tok{i}"})})
    score = time.time()
    await redis_client.zadd("runs:active", {str(run_id): score})
    await redis_client.zadd(f"runs_by_thread:{thread_id}", {str(run_id): score})

    # Configure mock so SELECT returns a streaming row
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result({
        "run_id": str(run_id),
        "status": "streaming",
        "thread_id": thread_id,
    })
```

**Rationale for extending vs. new file:** D-062-14 Discretion + 061.1's IN-01 precedent. Tests already reach for `_run_helpers` for run-id extraction and finalize await; co-locating zombie-state setup keeps the test files thin.

---

### `backend/tests/integration/test_062_active_runs.py` (test, request-response — no Redis)

**Analog:** `backend/tests/integration/test_061_runs_table.py:1-92` (`test_runs_lifecycle_row` — same mock_supabase pattern, no `redis_client` fixture needed).

**Imports + scaffolding pattern** (lines 1-29 of analog):

```python
# Source: backend/tests/integration/test_061_runs_table.py:1-29
import pytest
from unittest.mock import patch
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _make_result,
)
from tests.integration.test_059_disconnect import (    # noqa: E402
    _reset_sse_starlette_app_status,                    # autouse import — required
)

THREAD_A = str(uuid4())
```

**Test body pattern** — drive the route, assert call args on `mock_supabase.table("runs")`. Active-runs is mock-only (no Redis) so this is the simplest 062 test file.

```python
# Source pattern (mock supabase + httpx.AsyncClient): test_061_runs_table.py:31-91
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_returns_streaming_only_filter():
    mock_supabase = _build_mock_supabase()
    # Configure runs builder to return mixed-status rows
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"run_id": "00000000-0000-0000-0000-000000000010",
         "started_at": "2026-05-03T00:00:00+00:00", "status": "streaming"},
    ])
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        # Assert .eq("status", "streaming") AND .order("started_at", desc=True) appeared
        eq_calls = [c for c in runs_builder.eq.call_args_list]
        assert any(c.args == ("status", "streaming") for c in eq_calls)
        order_calls = runs_builder.order.call_args_list
        assert any(c.args == ("started_at",) and c.kwargs.get("desc") is True for c in order_calls)
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

---

### `backend/tests/integration/test_062_stream_replay.py` (test, streaming)

**Analog:** `backend/tests/integration/test_061_producer_survives_disconnect.py:1-173` — same shape: mock LLM + `_slow_chunks` + real `redis_client` fixture + `_extract_run_id_from_mock` + `httpx.AsyncClient.stream`.

**Imports** — copy `test_061_producer_survives_disconnect.py:10-46` verbatim, optionally adding the new `setup_zombie_state` helper if any sub-test reuses it.

**Test pattern** — drive POST to spawn a producer (need run_id), then immediately fire a parallel `c.stream("GET", "/runs/{rid}/stream?since=0")`. Assert the GET drains all replay + tail entries up to the terminal sentinel.

```python
# Source: backend/tests/integration/test_061_producer_survives_disconnect.py:51-77
# Adaptation for 062: after extracting run_id, fire a SECOND client.stream() against
# the new /runs/{rid}/stream endpoint and drain it. The terminal sentinel from D-061-12
# closes both consumers naturally.
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_replay_then_tail_to_terminal(redis_client):
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch("app.services.suggestion_service.generate_suggestions", return_value=([], None)), \
           patch("app.api.threads.generate_thread_title", return_value=("T", None)):

            # Step 1: POST → producer spins up
            # Step 2: extract run_id from mock
            # Step 3: GET /runs/{rid}/stream?since=0 → drain to terminal
            # Step 4: await_producer_finalized → assert terminal sentinel in events
            ...
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

---

### `backend/tests/integration/test_062_stream_terminal.py` (test, streaming — already-terminal)

**Analog:** `backend/tests/integration/test_061_ttl.py::test_completed_run_expires_600s` — same drain-to-natural-completion pattern, but pre-populates the Redis stream with a terminal sentinel rather than spawning a producer.

**Pattern** — `await redis_client.xadd(stream_key, {"data": json.dumps({"type": "delta", ...})})` for delta entries + `await redis_client.xadd(stream_key, {"data": json.dumps({"type": "done"})})` for the terminal sentinel. Mock `runs` SELECT to return `{status: "completed"}`. Drive GET stream; assert all entries delivered + connection closes naturally.

---

### `backend/tests/integration/test_062_stream_ttl_expired.py` (test, request-response)

**Analog:** `backend/tests/integration/test_061_runs_table.py` (mock-only) + the `_RUN_STATUS_TO_TERMINAL_TYPE` mapping at `backend/app/api/threads.py:87-91`.

**Pattern** — do NOT populate `run:{rid}` (so `await redis.exists(...)` returns 0). Mock `runs` SELECT to return `{status: "completed"|"failed"|"cancelled", error: ...}`. Drive GET stream. Assert response body is exactly one synthetic SSE event with `{type: <mapped>, error: "buffer_expired", runs_status: <orig>}`. Variants: status `"failed"` → `"error"` mapping; missing row → 404.

---

### `backend/tests/integration/test_062_delete_happy.py` (test, request-response + cancel)

**Analog:** `backend/tests/integration/test_061_producer_survives_disconnect.py:51-173` (the slow-mock-LLM + RUN_TASKS lifecycle pattern) + `await_producer_finalized` for the post-DELETE assertion (Pitfall 8 in RESEARCH).

**Key sequence** — POST (slow) → extract run_id → assert `RUN_TASKS[run_id]` exists → fire DELETE → assert 204 within 100ms → `await_producer_finalized(mock_supabase)` → assert `runs.status='cancelled'` UPDATE call.

```python
# Source: test_061_producer_survives_disconnect.py:155-171 (the post-finalize assert pattern)
await await_producer_finalized(mock_supabase)
runs_builder = mock_supabase.table("runs")
update_calls = runs_builder.update.call_args_list
cancelled = [
    c for c in update_calls
    if (c.args and isinstance(c.args[0], dict) and c.args[0].get("status") == "cancelled")
]
assert cancelled, f"Expected runs.status='cancelled' UPDATE; got {update_calls}"
```

---

### `backend/tests/integration/test_062_delete_zombie.py` (test, request-response)

**Analog:** No exact analog — composes (a) `setup_zombie_state` from extended `_run_helpers.py`, (b) DELETE call pattern from any existing DELETE route test, (c) Redis assertion patterns from `test_061_ttl.py` (xrange / zscore / ttl checks). Full skeleton in **RESEARCH §Code Examples — "Zombie-state setup for DELETE test"** (lines 762-831).

**Pattern** — copy the RESEARCH skeleton directly. Asserts all 4 zombie-heal effects: Postgres UPDATE with `cancelled` + `cancelled_by_user`, terminal sentinel with `reason="zombie_healed"` in stream, ZREM cleared from both sorted sets, EXPIRE 60 applied.

---

### `backend/tests/integration/test_062_delete_terminal_idempotent.py` (test, request-response)

**Analog:** `backend/tests/integration/test_061_runs_table.py` — mock-only, no `redis_client` fixture needed.

**Pattern** — mock `runs` SELECT to return `{status: "completed"}`. Capture `runs_builder.update.call_args_list` length pre-DELETE. Fire DELETE. Assert: 204 returned; UPDATE call count unchanged (the early-return at D-062-09 step 2 skips all subsequent work). Three sub-tests for {`completed`, `failed`, `cancelled`}.

---

### `backend/tests/integration/test_062_cross_user_404.py` (test, request-response — auth + 404)

**Analog:** `backend/tests/integration/test_061_runs_table.py` (mock pattern) + `backend/tests/conftest.py:80-81` (the `app.dependency_overrides[get_current_user] = lambda: mock_user_data` pattern — override it per-test with a different user id).

**Pattern** — three sub-tests (all assert 404 per D-062-12; never `200 []` for cross-user, never 403):
1. `test_active_runs_other_user_returns_404` — drive GET `/threads/{tid}/active-runs` with a different `current_user["id"]`; mock the threads ownership SELECT to return None; assert `404` (NOT `200 []` — that's the empty-but-owned case, distinct).
2. `test_get_stream_other_user_returns_404` — mock `runs` SELECT to return `data=None` (RLS+`.eq("user_id", ...)` filtered it out); assert `404`.
3. `test_delete_other_user_returns_404` — same mock setup; assert `404`.

```python
# Source: backend/tests/conftest.py:80-81 (dependency override convention)
from app.dependencies import get_current_user
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}
app.dependency_overrides[get_current_user] = lambda: OTHER_USER
try:
    # ... drive request, assert 404 / [] ...
finally:
    app.dependency_overrides.pop(get_current_user, None)
```

---

### `backend/tests/integration/test_062_multi_consumer_fanout.py` (test, streaming — parallel)

**Analog:** `backend/tests/integration/test_061_producer_survives_disconnect.py:99-130` (the `cross_tab_task = asyncio.create_task(_cross_tab_get())` parallel-AsyncClient pattern is the seed — 062 extends to TWO independent `c.stream()` consumers via `asyncio.gather`).

**Pattern** — full skeleton in **RESEARCH §Code Examples — "Multi-consumer fan-out test harness"** (lines 695-758).

```python
# Source: research §Code Examples lines 695-758. Two parallel ASGITransport clients
# both run c.stream("GET", "/runs/{rid}/stream?since=0") via asyncio.gather; assert
# events1 == events2 and last event type is in TERMINAL_TYPES.
async def _consume(client):
    events = []
    async with client.stream(
        "GET", f"/runs/{run_id}/stream?since=0",
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as resp:
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                events.append(line[6:])
    return events

async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c1, \
           httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c2:
    events1, events2 = await asyncio.gather(_consume(c1), _consume(c2))
assert events1 == events2
```

**Pitfall 7 + RESEARCH Open Question 3:** if the parallel `c.stream` pattern hangs on the same event loop, fall back to one `httpx.AsyncClient` consumer + one direct `redis_client.xread` consumer — both should see identical entries. Document the chosen approach in the test docstring.

---

## Shared Patterns

### Authentication
**Source:** `backend/app/dependencies.py:47-58` (`get_current_user` Depends — already used by every existing route).
**Apply to:** All 3 new routes (active-runs, GET stream, DELETE).

```python
# Source: backend/app/dependencies.py:47-58
# Existing convention — every 062 route declares this exact Depends.
current_user: dict = Depends(get_current_user),
```

### Async DB call wrapping (D-058-03 invariant)
**Source:** `backend/app/utils/db.py::aexec` + every supabase call in `threads.py:683-754`.
**Apply to:** Every supabase `.execute()` call in `runs.py` and the new active-runs route in `threads.py`.

```python
# Source: backend/app/utils/db.py:32-44 + backend/app/api/threads.py:683-754 usage
# CLAUDE.md rule: "Do not run blocking I/O directly inside async handlers — wrap with run_in_threadpool"
# 062 introduces ZERO new sync DB calls; every SELECT/UPDATE/DELETE goes through aexec.
response = await aexec(
    supabase.table("runs").select("...").eq("...", "...").maybe_single()
)
```

### Error handling — 404 not 403 for ownership mismatches
**Source:** `backend/app/api/threads.py:586-606` (`get_messages`) — established convention in D-062-12.
**Apply to:** All 3 new routes; all 9 test files (no test should ever expect 403).

```python
# Source: backend/app/api/threads.py:597-606
# Same pattern: SELECT with both .eq("id"|"run_id", ...) AND .eq("user_id", current_user["id"])
# → no row → HTTPException(404), never 403. Don't leak resource existence.
if not row.data:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

### Per-Redis-call try/except + logger.exception
**Source:** `backend/app/api/threads.py:739-754` (ZADD spawn-failure) + `backend/app/api/threads.py:2108-2138` (`_shielded_finalize` per-step).
**Apply to:** All Redis calls in DELETE handler (zombie heal sentinel XADD, ZREM × 2, EXPIRE) per D-062-13.

```python
# Source: backend/app/api/threads.py:739-754
# Note: the producer uses BaseException (CR-02/WR-03) because asyncio.shield is in play.
# 062's route handlers use plain Exception — we WANT CancelledError to propagate so
# response closes promptly on client disconnect. Document this delta inline.
try:
    await redis.zrem("runs:active", str(run_id))
    await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
except Exception:
    logger.exception("ZREM failed for run %s", run_id)
```

### EventSourceResponse with `ping=None`
**Source:** `backend/app/api/threads.py:2183-2186` (D-061.1-04 H2 fix).
**Apply to:** The GET stream endpoint AND the synthetic-terminal-event TTL-expired path. Both use `EventSourceResponse(generator, ping=None)` for byte-identical wire format with 061's POST.

### Pydantic `response_model` on every route
**Source:** `backend/app/api/threads.py:426` (`@router.get("", response_model=list[ThreadResponse])`) + every other GET route.
**Apply to:** GET active-runs uses `response_model=list[ActiveRunResponse]`; GET stream uses no response_model (EventSourceResponse is the body); DELETE uses `response_class=Response` + `status_code=status.HTTP_204_NO_CONTENT`.

### Test infrastructure reuse (NO new fixtures)
**Source:**
- `backend/tests/conftest.py:174-199` — `redis_client` async fixture
- `backend/tests/conftest.py:202-224` — `_flushdb_at_session_end` session autouse
- `backend/tests/integration/_run_helpers.py` — `_build_mock_supabase`, `_fast_chunks`, `_slow_chunks`, `_extract_run_id_from_mock`, `await_producer_finalized`
- `backend/tests/integration/test_059_disconnect.py` — `_reset_sse_starlette_app_status` autouse fixture (imported by all 061 tests; 062 follows the same convention)

**Apply to:** All 062 test files. No 062-specific conftest changes needed.

### Test `pytest.mark.timeout(15)` discipline
**Source:** Every 061 test (e.g., `test_061_ttl.py:35`, `test_061_producer_survives_disconnect.py:52`).
**Apply to:** Every 062 test. Bound runaway tests at 15s — well above the `_slow_chunks` total of ~1.5s but well below the `RUN_HARD_TIMEOUT_SECONDS=120` deadline.

### Test cleanup — `app.dependency_overrides.pop(get_supabase, None)` in `finally`
**Source:** `backend/tests/integration/test_061_producer_survives_disconnect.py:64-65,172-173`.
**Apply to:** Every 062 test that calls `app.dependency_overrides[get_supabase] = ...`. Same `try`/`finally` bracket.

---

## No Analog Found

| File / Sub-pattern | Role | Data Flow | Reason / Where to Find Pattern Instead |
|--------------------|------|-----------|----------------------------------------|
| Synthetic TTL-expired SSE generator (single-yield) inside `runs.py` | controller | streaming | Truly NEW shape (a single-yield generator wrapped in EventSourceResponse). Closest existing reference is the `_emit_terminal` XADD pattern at `threads.py:111-125` — same `{type, **fields}` JSON envelope. Full skeleton in **RESEARCH §Pattern 4** (lines 448-475). |
| `_setup_zombie_state` helper for `_run_helpers.py` | utility | n/a | NEW. The existing `_run_helpers.py` has no equivalent of "pre-populate Redis without a producer task." Sketch is in this PATTERNS.md under the `_run_helpers.py` extension entry; full inline skeleton in **RESEARCH §Code Examples — Zombie-state setup** (lines 762-831). |
| Multi-consumer fan-out via parallel `c.stream` + `asyncio.gather` | test (integration) | streaming | NEW. The closest existing pattern is the single-`asyncio.create_task` cross-tab GET at `test_061_producer_survives_disconnect.py:99-125` — but 062 needs TWO independent stream consumers, not one stream + one regular GET. Full skeleton in **RESEARCH §Code Examples — Multi-consumer fan-out test harness** (lines 695-758). Pitfall 7 fallback documented in RESEARCH Open Question 3. |
| Redis-down 503 + `Retry-After: 10` header (recommended optional `test_062_redis_down.py`) | controller / test | request-response | NEW. The codebase has no existing 503 + Retry-After pattern. RESEARCH §Validation Architecture line 898+ marks this test as "RECOMMENDED OPTIONAL." If included, mock `app.dependencies.get_redis` to return a stub that raises `redis.exceptions.ConnectionError` on every call. |

For all of the above, the planner can copy the inline skeletons from RESEARCH.md verbatim; this is what the "Code Examples" section of RESEARCH was assembled to provide.

---

## DEF-061.1-02 Pre-requisite Note (for the planner)

CONTEXT.md flags DEF-061.1-02 (producer exception classifier potentially writes wrong `_terminal_status`) as a 062 disposition decision. PATTERNS.md does NOT prescribe a fix — but if the planner picks disposition (a) "fix in 062 as Wave 0," the relevant code site is `backend/app/api/threads.py:2057-2076` (the `agent_runner` exception classifier). The fix would modify lines in that range; 062's other code (the new `runs.py`, the new active-runs route in `threads.py`) is independent. Pattern source for the fix: study `_terminal_status` flow at `threads.py:768` (default value) → 2057-2076 (except handlers) → 2109-2122 (`_shielded_finalize` consumer of the value).

This is OUT of the file-list above (which tracks ONLY the files in 062's "in scope"). Pattern data for it is supplied because the planner may add a Wave 0 task that touches those lines.

---

## Metadata

**Analog search scope:**
- `backend/app/api/` (controllers — found analogs in `threads.py`, `documents.py`, `folders.py`, `skills.py`)
- `backend/app/models/` (Pydantic models — found analogs in `thread.py`, `message.py`)
- `backend/app/dependencies.py` + `backend/app/utils/db.py` + `backend/app/main.py` (cross-cutting infra)
- `backend/tests/integration/` (test analogs — focused on `test_061_*.py` files per CONTEXT.md)
- `backend/tests/conftest.py` + `backend/tests/integration/_run_helpers.py` (fixtures + helpers)
- `supabase/migrations/035_runs_table.sql` (schema reference for column names)

**Files scanned:** ~12 source files + 4 test files + 1 migration + 1 config

**Pattern extraction date:** 2026-05-03

**Closest-analog file ranking summary:**
- 12/14 files have an EXACT analog (same role + same data flow) within Phase 061 or 061.1 sources
- 2/14 have a ROLE-MATCH analog with a NEW sub-pattern documented in RESEARCH §Code Examples (zombie test, multi-consumer test)
- 0/14 truly greenfield — every file has at least a starting skeleton in RESEARCH or in an existing analog

The recurrent observation: 062 is API-shape work on top of fully-shipped infrastructure (Phase 061 + 061.1). The planner's job is mostly to copy 061 patterns with the documented deltas (`since` cursor, no asyncio.shield, plain `Exception` not `BaseException` at route boundary), not to invent new shapes.
