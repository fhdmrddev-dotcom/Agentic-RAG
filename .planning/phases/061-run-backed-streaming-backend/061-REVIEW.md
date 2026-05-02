---
phase: 061-run-backed-streaming-backend
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/requirements.txt
  - backend/app/config.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/api/threads.py
  - supabase/migrations/035_runs_table.sql
  - backend/tests/conftest.py
  - .github/workflows/backend-tests.yml
  - backend/tests/unit/test_061_emit_helper.py
  - backend/tests/unit/test_061_consumer.py
  - backend/tests/unit/test_health.py
  - backend/tests/integration/_run_helpers.py
  - backend/tests/integration/test_061_producer_survives_disconnect.py
  - backend/tests/integration/test_061_ttl.py
  - backend/tests/integration/test_061_runs_table.py
  - backend/tests/integration/test_061_hard_timeout.py
  - backend/tests/integration/test_058_concurrency.py
  - backend/tests/integration/test_059_disconnect.py
  - backend/tests/integration/test_health.py
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 061: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 061 ships the run-backed streaming backend: Redis Streams as the event buffer, a producer task (`agent_runner`) decoupled from the SSE consumer (`event_consumer`), a `runs` Postgres lifecycle row, and a suite of binding tests. The core contract inversion (D-061-03 / D-v2.5-08) is architecturally sound and the enum-mapping fix (D-061-09) that landed post-merge in `94d5031` is correctly applied.

Three critical issues were found: (1) the `_terminal_status` / `_terminal_error` variables are declared in the wrong scope — they are not visible to the shielded finalizer on the paths that matter most (TimeoutError, CancelledError, unhandled Exception), meaning the finalizer always writes `completed`+`None` instead of the actual error state; (2) the `_shielded_finalize` inner coroutine re-raises `asyncio.CancelledError` inside `asyncio.shield`, which silently swallows the shield and allows the finalizer to be cut short during lifespan shutdown; (3) the CI workflow hardcodes the Redis container name (`agentic-rag-redis`) which may not match every environment and has no SUPABASE_URL/KEY env-var setup for integration tests that need them.

Seven warnings were found covering: the `_terminal_status` scope gap in the `CancelledError` re-raise path, the consumer starting with `last_id = "$"` after the replay-drain transition (race window), missing `upsert=True` / conflict handling on ZADD for reconnect scenarios, open `assert` in production path `_emit_terminal`, no `decode_responses=True` on the session-end synchronous flush client, missing `or_` on the `conftest.py` builder mock causing the skills catalog inject to silently skip, and the CI workflow missing a pin on `actions/setup-python` and `docker compose` version.

---

## Critical Issues

### CR-01: `_terminal_status` / `_terminal_error` variables declared INSIDE `asyncio.timeout` block — invisible to shielded finalizer on error paths

**File:** `backend/app/api/threads.py:666-668` and `1942-2005`

**Issue:** `_terminal_status` and `_terminal_error` are declared at lines 667-668, inside the `try:` block that is wrapped by `async with asyncio.timeout(...)`. The shielded finalizer at line 1942 references them via the closure. This works on the **happy path** (natural completion), but the three error paths that change these variables (`TimeoutError` at line 2007, `CancelledError` at line 2016, generic `Exception` at line 2023) execute **after** the inner try/finally block has already run — meaning the finalizer has already read the stale default values (`"completed"` / `None`) and written them to Redis and Postgres.

Specifically:
- `asyncio.timeout` fires → inner `finally` at line 1942 runs with `_terminal_status = "completed"` → writes `completed` sentinel + `runs.status='completed'`  → **then** the `except asyncio.TimeoutError` at line 2007 sets `_terminal_status = "failed"` (too late).
- Same race for `CancelledError` and generic `Exception`.

This is the most probable root cause of the 5 still-failing integration tests. `test_061_hard_timeout.py` asserts `status='failed'` and `error='hard_timeout'`, but the finalizer will have already written `status='completed'` before the except branch fires.

**Fix:** Move `_terminal_status` and `_terminal_error` declarations **outside** the outer `try` block so the `except` branches can mutate them before the inner `finally` reads them. The correct structure is:

```python
async def agent_runner(run_id: _uuid_mod.UUID) -> None:
    _terminal_status: str = "completed"   # MUST be here, OUTSIDE the try
    _terminal_error: str | None = None    # MUST be here, OUTSIDE the try

    try:                                  # OUTER try
        async with asyncio.timeout(settings.run_hard_timeout_seconds):
            ...
            try:                          # inner try (agent loop)
                ...
            except APIError as e:
                ...
            except Exception as e:
                ...
            finally:
                # _shielded_finalize reads _terminal_status/_terminal_error
                try:
                    await asyncio.shield(_shielded_finalize())
                ...

    except asyncio.TimeoutError:
        _terminal_status = "failed"       # NOW visible to shielded finalizer ← NO
        ...
```

Wait — the above structure still has the same issue: the `except` clauses run AFTER the inner `finally`. The correct fix is to catch these conditions INSIDE the inner try block and set the variables there, or to use a different structure where the except branches set status before the finally runs.

The cleanest fix is to restructure so the `except` branches for `TimeoutError` / `CancelledError` / `Exception` are positioned INSIDE the outer try but OUTSIDE the inner finally. Currently the code nests:

```
outer try:
  async with asyncio.timeout:
    inner try:         ← _terminal_status defined here (line 667)
      agent loop
    except APIError:
      ...
    except Exception:
      ...
    finally:           ← reads _terminal_status (line 1968)
      shield(...)
  
except TimeoutError:   ← sets _terminal_status (line 2013) — TOO LATE
except CancelledError: ← sets _terminal_status (line 2020) — TOO LATE
except Exception:      ← sets _terminal_status (line 2024) — TOO LATE
```

The fix is to move the variable declarations to the top of `agent_runner`, outside all try blocks, AND catch `TimeoutError`/`CancelledError`/`Exception` BEFORE the finally reads them. One clean approach:

```python
async def agent_runner(run_id):
    _terminal_status = "completed"
    _terminal_error = None

    try:
        async with asyncio.timeout(settings.run_hard_timeout_seconds):
            ...
            # agent loop
            ...
    except asyncio.TimeoutError:
        _terminal_status = "failed"
        _terminal_error = "hard_timeout"
        logger.warning(...)
    except asyncio.CancelledError:
        _terminal_status = "cancelled"
        _terminal_error = None
        raise
    except Exception as e:
        _terminal_status = "failed"
        _terminal_error = type(e).__name__
        logger.exception(...)
    finally:
        # finalizer now sees correct _terminal_status
        try:
            await asyncio.shield(_shielded_finalize())
        ...
```

This puts the `finally` at the outermost `try` level, AFTER the `except` branches have set the status correctly.

---

### CR-02: `asyncio.CancelledError` re-raised inside `asyncio.shield` in `_shielded_finalize`

**File:** `backend/app/api/threads.py:1999-2002`

**Issue:** `_shielded_finalize` is awaited via `asyncio.shield(...)`. If the outer task is cancelled (lifespan shutdown), `asyncio.shield` protects the inner coroutine from cancellation — but only as long as the caller re-raises the `CancelledError` at its boundary to keep the outer task's cancellation state intact. The code at line 2001 does re-raise:

```python
try:
    await asyncio.shield(_shielded_finalize())
except asyncio.CancelledError:
    raise   # propagate; lifespan-cancel path
```

However, `_shielded_finalize` itself at step 2 calls `_emit_terminal` which calls `await redis.xadd(...)`. If the outer task is cancelled mid-`asyncio.shield`, the shield guarantees `_shielded_finalize` continues running in a **detached** task — but any `CancelledError` that propagates out of `_shielded_finalize`'s awaits (e.g., from `aexec` or `redis.expire`) will silently abort `_shielded_finalize` without completing the remaining steps.

More concretely: `asyncio.shield(coro)` protects `coro` from the outer cancellation, but if `coro` internally catches and re-raises `CancelledError` (or doesn't catch it at all), `coro` aborts. The steps in `_shielded_finalize` that follow step 1 (steps 2-5) each sit inside their own `try/except Exception` blocks, but NOT `try/except BaseException` — a `CancelledError` (which is a `BaseException`) propagating from `redis.xadd` or `aexec` would not be caught by `except Exception` and would abort `_shielded_finalize` mid-way.

During lifespan shutdown (`task.cancel()` from main.py:81), `asyncio.shield` spawns `_shielded_finalize` as a detached task. If Redis is slow, the 10s `socket_timeout` means the detached task may receive a cancellation from the event loop shutdown before completing all 5 steps.

**Fix:** In each of the 5 steps inside `_shielded_finalize`, change `except Exception` to `except BaseException` to absorb `CancelledError` too, OR wrap the entire body in `try: ... except BaseException: logger.exception(...)`:

```python
async def _shielded_finalize():
    # step 2 — sentinel XADD
    try:
        _terminal_type = _RUN_STATUS_TO_TERMINAL_TYPE[_terminal_status]
        await _emit_terminal(redis, run_id, _terminal_type, error=_terminal_error)
    except BaseException:          # ← was: except Exception
        logger.exception("Terminal sentinel XADD failed for run %s", run_id)

    # steps 3-5 same pattern
```

---

### CR-03: CI workflow hardcodes container name `agentic-rag-redis` with no guarantee it matches `docker-compose.dev.yml`

**File:** `.github/workflows/backend-tests.yml:46`

**Issue:** The "Wait for Redis" step runs:
```
docker exec agentic-rag-redis redis-cli ping
```
The container name `agentic-rag-redis` is determined by `docker-compose.dev.yml`'s `container_name` field (or the compose project name + service name). If `docker-compose.dev.yml` uses a different container name or the CI runner has a different compose project prefix, this `exec` silently fails every 1-second loop and after 30s emits "Redis did not become ready in 30s" and exits 1 — aborting the entire CI run before any tests execute.

The workflow also never sets `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` as env vars. The `conftest.py` uses `os.environ.setdefault(...)` so this is safe for unit tests, but any future integration test that tries to skip on missing `SUPABASE_URL` (via an env guard) will see the conftest-injected dummy values and NOT skip — it will run against a non-existent Supabase URL instead.

**Fix for container name:** Use `docker compose ps` or a host-level port-check instead of the container-name-dependent `docker exec`:

```yaml
- name: Wait for Redis
  run: |
    for i in {1..30}; do
      if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
        echo "Redis ready"; exit 0
      fi
      sleep 1
    done
    echo "Redis did not become ready in 30s"; exit 1
```

Or install `redis-tools` first and use a port check. This avoids depending on the internal container name.

---

## Warnings

### WR-01: Consumer transitions to `"$"` cursor after replay drain — races events produced between drain and tail

**File:** `backend/app/api/threads.py:2079`

**Issue:** The replay phase drains the stream with `last_id = "0"` until `xread` returns empty. At that point (line 2079) `last_id` is reset to `"$"`, and the tail phase XREADs from `$`. This opens a race window: events produced between the moment the replay phase saw an empty result and the moment the tail phase issues its first `BLOCK XREAD` are permanently missed by the consumer. In a fast producer (e.g., immediate completion on iteration 0), the producer may XADD `done` into the stream, the replay phase drains and returns empty, the tail switches to `$`, and the consumer never sees `done` — hanging until the defensive deadline fires.

The standard Redis pattern is to NOT reset to `$` when the replay drain returns empty; instead keep `last_id` at the value from the last yielded entry (or `"0"` if nothing was replayed) and switch to `BLOCK XREAD` with that same ID. This is safe because XREAD with `block=5000` and a past ID still returns only NEW entries arriving after the call.

**Fix:**
```python
# Phase 2: live-tail — keep last_id from replay (do NOT reset to "$")
# This eliminates the race window between replay-drain and tail-subscribe.
# last_id is already set to the final replay entry id (or "0" if empty replay).
while True:
    if time_mod.monotonic() > deadline:
        yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
        return
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
        block=5000,
    )
    if not result:
        continue
    for _stream_name, entries in result:
        for entry_id, fields in entries:
            last_id = entry_id
            yield {"data": fields["data"]}
            payload = json.loads(fields["data"])
            if payload.get("type") in TERMINAL_TYPES:
                return
```

---

### WR-02: `_terminal_status` set to `"cancelled"` in `CancelledError` except but `_RUN_STATUS_TO_TERMINAL_TYPE` is consumed by the finalizer BEFORE the except runs

**File:** `backend/app/api/threads.py:2016-2022`

**Issue:** This is the CancelledError leg of the CR-01 defect. On lifespan cancellation:
1. Inner finally runs at line 1942 with `_terminal_status = "completed"`.
2. `_shielded_finalize` writes `completed` sentinel + `runs.status='completed'`.
3. `except asyncio.CancelledError` fires at line 2016, sets `_terminal_status = "cancelled"`.
4. `raise` at line 2022 propagates.

Step 3 is a no-op — the finalizer already ran. The `runs` row is permanently marked `completed` for a cancelled run. The `EXPIRE` will be 600s instead of 60s (step 4 of finalizer). This is data integrity corruption — the `runs` table will show the wrong terminal state for every run that ends via shutdown.

**Fix:** Part of the CR-01 fix — move `_terminal_status` and the outer `try/except/finally` above the `asyncio.timeout` block.

---

### WR-03: `assert` in production `_emit_terminal` will raise `AssertionError` (not caught) and abort the finalizer

**File:** `backend/app/api/threads.py:117`

**Issue:**
```python
assert type in TERMINAL_TYPES, f"_emit_terminal type must be in TERMINAL_TYPES, got {type!r}"
```

Python `assert` statements are removed when running with `python -O` (optimized mode). More importantly, even without `-O`, if `_RUN_STATUS_TO_TERMINAL_TYPE` lookup at line 1968 produces a value that is somehow not in `TERMINAL_TYPES` (e.g., someone adds a new status to the runs table but forgets to update the mapping), `_emit_terminal` raises `AssertionError`. The `except Exception` wrapper at line 1970 DOES catch `AssertionError` (it is an `Exception`), so the finalizer continues. This is fine for step 2 — but the unit test `test_emit_terminal_rejects_non_terminal_type` relies on the `assert` existing and not being optimized away.

Additionally, `_RUN_STATUS_TO_TERMINAL_TYPE` at lines 87-91 has only three keys: `completed`, `failed`, `cancelled`. The `streaming` status (a valid `runs.status` CHECK value) is absent. If `_terminal_status` is ever `"streaming"` when `_shielded_finalize` runs (which should not happen by design but could if a code path returns without setting `_terminal_status`), the `_RUN_STATUS_TO_TERMINAL_TYPE[_terminal_status]` at line 1968 raises `KeyError`, aborting step 2.

**Fix:** Replace `assert` with an explicit `raise ValueError` for the internal guard, and add `KeyError` to the `except` clause at line 1970:

```python
async def _emit_terminal(redis, run_id, type: str, **fields) -> None:
    if type not in TERMINAL_TYPES:
        raise ValueError(f"_emit_terminal type must be in TERMINAL_TYPES, got {type!r}")
    await redis.xadd(...)
```

And in `_shielded_finalize` step 2:
```python
try:
    _terminal_type = _RUN_STATUS_TO_TERMINAL_TYPE[_terminal_status]
    await _emit_terminal(redis, run_id, _terminal_type, error=_terminal_error)
except (KeyError, ValueError, Exception):
    logger.exception("Terminal sentinel XADD failed for run %s", run_id)
```

---

### WR-04: `_drive_sse_until_disconnect` helper awaits the full ASGI app coroutine — the producer task runs to completion BEFORE the assertion snapshots

**File:** `backend/tests/integration/test_059_disconnect.py:238`

**Issue:** The helper calls:
```python
await asyncio.wait_for(asgi_app(scope, receive, send), timeout=8.0)
```
`asgi_app(scope, receive, send)` is the FastAPI/Starlette ASGI coroutine. In the Phase 061 architecture this returns **after the SSE consumer generator exhausts** — which now means: after `event_consumer()` terminates (on disconnect or on terminal type), but the **producer task continues running in the background** as a detached `asyncio.Task`. The `await` here completes before the producer finishes. The test then immediately does:
```python
run_id = _extract_run_id_from_mock(mock_supabase)
xlen_at_disconnect = await redis_client.xlen(stream_key)
await asyncio.sleep(5.0)
xlen_after = await redis_client.xlen(stream_key)
assert xlen_after > xlen_at_disconnect
```

The 5-second sleep is correct and should let the slow-chunks producer (5 × 0.3s = 1.5s remaining) finish. However, `_extract_run_id_from_mock` inspects `mock_supabase.table("runs").insert.call_args_list` which is populated during the **synchronous** `send_message` handler BEFORE the producer task starts. This part is fine. But if for any reason the test reaches the `assert terminal` check before the producer's finally completes its `asyncio.shield(_shielded_finalize())`, the terminal entry may not be in the stream yet and the assertion fails.

The test waits for `asyncio.sleep(5.0)` but the slow-chunks producer takes ~1.5s of `time.sleep` inside a sync for-loop on the event-loop thread. The `asyncio.shield` in the finalizer runs immediately after. In practice this is within the 5s window, but the test has no explicit mechanism to wait for the finalizer to complete. This is a potential source of the 5 still-failing tests.

**Fix:** After the 5-second sleep, add an explicit poll for the terminal sentinel instead of the fixed sleep:
```python
deadline_t = time.monotonic() + 6.0
while time.monotonic() < deadline_t:
    entries = await redis_client.xrange(stream_key)
    terminal = [e for e in entries if json.loads(e[1]["data"]).get("type") in TERMINAL_TYPES]
    if terminal:
        break
    await asyncio.sleep(0.1)
assert terminal, f"Expected terminal sentinel; got entries: {entries}"
```

---

### WR-05: `test_061_ttl.py` uses `httpx.AsyncClient(app=app, ...)` — deprecated constructor form, likely fails with httpx >= 0.27

**File:** `backend/tests/integration/test_061_ttl.py:48`

**Issue:**
```python
async with httpx.AsyncClient(app=app, base_url="http://test") as c:
```
The `app=` parameter on `httpx.AsyncClient` was removed in httpx 0.27 in favor of `transport=ASGITransport(app=app)`. The `requirements.txt` pins `httpx>=0.27.0`, which means this constructor will raise a `TypeError` at test collection time in CI. The other test files (`test_059_disconnect.py`, `test_061_producer_survives_disconnect.py`) correctly use `ASGITransport`. `test_061_runs_table.py` has the same issue at line 45-48 and line 59-64.

**Fix** (both files):
```python
from httpx import ASGITransport
async with httpx.AsyncClient(
    transport=ASGITransport(app=app),
    base_url="http://test",
) as c:
```

This is likely one of the 5 integration test failures.

---

### WR-06: `conftest.py` mock builder is missing `upsert` chaining — `user_memory.upsert(...)` calls during tests return a non-chainable MagicMock

**File:** `backend/tests/conftest.py:29-50`

**Issue:** `_make_builder` chains `select`, `insert`, `update`, `delete`, `eq`, `neq`, `in_`, `order`, `limit`, `single`, `maybe_single`, `is_`, `or_`, `gte`, `lt`, `range` — but NOT `upsert`. The `remember` tool at `threads.py:1695` calls `supabase.table("user_memory").upsert(...)` which returns a fresh unconfigured `MagicMock` (not the builder with `.execute()` wired). Subsequent `.on_conflict(...)` and `.execute()` calls on that MagicMock return new MagicMocks, not errors — but if any test path triggers `remember` with the shared conftest mock, the assertion `_resp.data` access on the result may raise `AttributeError` or return a MagicMock that is truthy unexpectedly.

**Fix:**
```python
b.upsert.return_value = b
```
Add this line in `_make_builder` and in the `reset_mocks` fixture reset block.

---

### WR-07: `requirements.txt` — `redis>=5.2,<8` upper bound is too broad; `redis` 6.x (not yet released) may break XREAD response shape

**File:** `backend/requirements.txt:18`

**Issue:** The `redis` Python client pinned as `>=5.2,<8` allows any 5.x, 6.x, or 7.x release. The `redis-py` library has historically made breaking changes to the XREAD response shape between major versions. The production code at `threads.py:2070-2075` iterates:
```python
for _stream_name, entries in result:
    for entry_id, fields in entries:
```
If a future 6.x release changes the XREAD response structure (e.g., wrapping in a named tuple or changing the fields dict to bytes even with `decode_responses=True`), this will silently break all streaming.

**Fix:** Tighten to `>=5.2,<6` until redis-py 6.x is explicitly tested and the XREAD shape verified:
```
redis>=5.2,<6
```

---

## Info

### IN-01: `_build_mock_supabase` in `test_058_concurrency.py` is referenced by 4 integration test files — any change requires coordinated update

**File:** `backend/tests/integration/test_058_concurrency.py:170-237`

**Issue:** `_build_mock_supabase`, `_fast_chunks`, `_thread_row`, `_make_table_builder`, and other helpers are imported by `test_061_*.py` and `test_059_disconnect.py` via cross-file imports. `_build_mock_supabase` in particular now has `runs` table routing baked in (added in Plan 05). Future changes to the `runs` table mock behavior (e.g., Plan 062 adding a `cancel` verb test) require touching `test_058_concurrency.py` which is a Phase 058 test — coupling that is not immediately obvious.

**Suggestion:** Move shared 061+ infrastructure helpers (`_build_mock_supabase` with `runs` routing, `_fast_chunks`, `_slow_chunks`) to `tests/integration/_run_helpers.py` so the single-responsibility principle is clearer. `test_058_concurrency.py` becomes a consumer of that helper rather than a provider.

---

### IN-02: `_extract_run_id_from_mock` extracts the first `runs` INSERT — breaks if a spawn-failure cleanup INSERT lands first

**File:** `backend/tests/integration/_run_helpers.py:16-35`

**Issue:** The helper asserts `insert_calls[0]` is the success INSERT. The spawn-failure path in `send_message` at `threads.py:641-654` also calls `supabase.table("runs").update(...)` — not insert — so there is no duplicate INSERT. However, if future code adds a retry-INSERT in the failure path, `insert_calls[0]` would capture the wrong row. The current code is safe but the assumption is fragile.

**Suggestion:** Filter `insert_calls` by `payload.get("status") == "streaming"` rather than always taking `[0]`:
```python
streaming_inserts = [
    c for c in insert_calls
    if (c.args[0] if c.args else c.kwargs.get("data", {})).get("status") == "streaming"
]
assert streaming_inserts, "Expected a streaming INSERT in runs"
return streaming_inserts[0].args[0]["run_id"]
```

---

### IN-03: `_shielded_finalize` re-defines `_persisted_msg_id` via `nonlocal` inside an inner coroutine nested 3 levels deep

**File:** `backend/app/api/threads.py:1952-1960`

**Issue:** `_shielded_finalize` is defined inside `agent_runner`, which is itself a closure over the `send_message` scope. The `nonlocal _persisted_msg_id` declaration reaches back two closure levels. This works in CPython 3.12 but is unusual enough to confuse future readers about which scope owns the variable. The `_persisted_msg_id` is also captured by `_persist_assistant_message` via its own `nonlocal` declaration. The two `nonlocal` declarations pointing at the same variable are not a bug, but this pattern is difficult to audit under code review.

**Suggestion:** Pass `_persisted_msg_id` as a return value from `_persist_assistant_message` rather than mutating it through nonlocal, and thread it explicitly into `_shielded_finalize`. This eliminates the double-nonlocal pattern.

---

### IN-04: `test_061_consumer.py::test_xread_advances_last_id` tests the contract manually, not the actual `event_consumer` closure

**File:** `backend/tests/unit/test_061_consumer.py:9-55`

**Issue:** The comment at line 19 explicitly acknowledges: "event_consumer is defined as a closure inside send_message; we exercise its cursor-advancement CONTRACT here by stub-driving xread manually." This means the unit test replicates the cursor logic by hand and asserts on the replica. A regression in `event_consumer` itself (e.g., `last_id = "$"` not being updated after a tail-phase entry) would NOT be caught by this test — the test would still pass because it is exercising its own in-test replica.

The integration test comment at lines 144-153 of `test_061_producer_survives_disconnect.py` acknowledges this is covered by the `xrange_count == xlen_final` parity guard, which is weaker (it detects trim/holes but not a stuck-at-`$` cursor if only one entry is missed).

**Suggestion:** Extract `event_consumer` as a module-level function (accepting `redis`, `run_id`, `settings` as parameters) so it can be unit-tested directly with a mock Redis, rather than relying on the indirect parity-count approach.

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
