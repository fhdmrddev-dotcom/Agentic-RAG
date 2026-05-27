# Phase 075: SEED-008 + tool_args_progress Polish Bundle - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 14 (6 new, 8 modified)
**Analogs found:** 13 / 14 (one new pattern — Docker stdout line-buffer — has no in-repo precedent; sourced from RESEARCH §Pattern 5)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/threads.py` — **NEW `GET /threads/{tid}/snapshot` endpoint** | controller / route | request-response (composite read) | `backend/app/api/threads.py:510-551` `list_active_runs` + `backend/app/api/threads.py:731-818` `get_messages` + `backend/app/api/runs.py:331-391` `stream_run` (Redis probe) | exact |
| `backend/app/api/threads.py` — **NEW `_enrich_messages_with_runs` helper** | service (module-private helper) | request-response (DB read + merge) | `backend/app/api/threads.py:795-816` (the inline merge block being extracted) | exact (refactor in place) |
| `backend/app/api/threads.py:2155-2206` — **MODIFIED sandbox exec loop** | service (async producer) | streaming / event-driven | Itself — current `session.run(... on_stdout=...)` + asyncio.Queue bridge + drain loop at `threads.py:2083-2206` | exact (in-place swap) |
| `backend/app/api/threads.py:2186-2204` — **NEW line-buffer accumulator** | utility (in-drain-loop logic) | streaming / transform | No in-repo analog — new pattern from RESEARCH §Pattern 5 | none (greenfield) |
| `backend/app/api/threads.py:2210-2218` — **DELETED post-completion stdout emit** | (removal) | (removal) | The dead-code block itself | exact (delete only) |
| `backend/app/api/threads.py:1601-1616` — **NEW OpenAI `tool_args_progress` emit** | service (SSE producer in-loop) | streaming / event-driven | Adjacent `_emit(redis, run_id, 'tool_preparing', ...)` at `threads.py:1614` + `_emit` helper at `threads.py:105-119` | exact |
| `backend/app/services/anthropic_service.py:199-225` — **NEW Anthropic `tool_args_progress` yield** | service (generator yield) | streaming / event-driven | Adjacent `yield {"type": "tool_preparing", ...}` at `anthropic_service.py:197` and `yield {"type": "tool_start", ...}` at `:220-225` | exact |
| `backend/app/api/runs.py:221-235` — **MODIFIED `replay_tail_consumer` heartbeat-gap distinction** | service (SSE consumer) | streaming / event-driven | Itself — current `buffer_expired_during_tail` emit at `runs.py:229-235` | exact (in-place modify) |
| `backend/app/models/thread.py` — **NEW `ThreadSnapshotResponse`** | model (Pydantic) | (data shape) | `backend/app/models/run.py` `ActiveRunResponse` + `backend/app/models/message.py` `MessageResponse` | role-match (composition only) |
| `frontend/src/lib/api.ts` — **NEW `getSnapshot` helper** | service (HTTP client) | request-response | `frontend/src/lib/api.ts:456-467` `getActiveRuns` + `frontend/src/lib/api.ts:274-450` `subscribeToRun` (`getMessages` is at a separate site but follows same pattern) | exact |
| `frontend/src/providers/StreamsProvider.tsx:473-490` — **MODIFIED `reconcile`** | provider (orchestrator) | request-response (collapse parallel branch) | Itself — current `Promise.all([getActiveRuns, loadMessages])` at `tsx:482-485` | exact (in-place swap) |
| `frontend/src/providers/StreamsProvider.tsx:689-720` — **MODIFIED `onTerminal` handler** | provider (callback) | event-driven | Itself — current `kind === "error"` flip at `tsx:695` | exact (in-place modify) |
| `frontend/src/lib/api.ts:390-408` — **MODIFIED `buffer_expired_*` error mapping** | service (SSE parser branch) | event-driven | Itself — current `t === "error"` branch at `api.ts:393-395` | exact (in-place modify) |
| `frontend/src/components/chat/MessageItem.tsx:142-164` — **MODIFIED bottom indicator** | component (render branch) | event-driven (derived state) | Itself — current `outerBannerLabel(activeTool, hasAnyTools, ...)` at `:148-154` (clears to `null` mid-stream) | exact (in-place modify) |
| `backend/tests/integration/test_075_snapshot.py` — **NEW** | test (integration) | request-response | `backend/tests/integration/test_063_1_messages_runs_join.py` (full file) + `backend/tests/integration/test_063_post_then_subscribe.py:1-150` | exact |
| `backend/tests/integration/test_075_code_stdout_progressive.py` — **NEW** | test (integration, real sandbox) | streaming | `backend/tests/integration/test_063_post_then_subscribe.py` (POST→GET stream pattern) | role-match (no real-sandbox test analog read in this session — pattern stated as `test_065_skills_*` per RESEARCH) |
| `backend/tests/integration/test_075_tool_args_progress.py` — **NEW** | test (integration) | streaming | `backend/tests/integration/test_063_post_then_subscribe.py` (mock chunks via `_slow_chunks` pattern) | exact |

---

## Pattern Assignments

### 1. NEW `GET /threads/{tid}/snapshot` endpoint (controller, request-response composite)

**Source file:** `backend/app/api/threads.py` (insert near other `/threads/{tid}/...` endpoints, recommend right after `list_active_runs` at line 552)

**Analogs:**
- `backend/app/api/threads.py:510-551` — `list_active_runs` (auth + dual-eq + 404 posture + active-runs SELECT shape)
- `backend/app/api/threads.py:731-818` — `get_messages` (ownership SELECT + messages SELECT + runs-FK merge call-site)
- `backend/app/api/runs.py:354-370` — `stream_run` (Redis probe + 503+Retry-After:10 pattern)

**Ownership-SELECT + 404 posture pattern** (`threads.py:524-533` — `list_active_runs`):
```python
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

**Active-runs SELECT pattern** (`threads.py:543-551` — `list_active_runs`):
```python
runs_resp = await aexec(
    supabase.table("runs")
    .select("run_id, started_at, status")
    .eq("thread_id", str(thread_id))
    .eq("user_id", current_user["id"])
    .eq("status", "streaming")
    .order("started_at", desc=True)
)
return runs_resp.data or []
```

**Redis probe + 503 pattern** (`runs.py:354-370` — `stream_run`):
```python
try:
    buffer_exists = await asyncio.wait_for(
        redis.exists(f"run:{run_id}"), timeout=2.0
    )
except (RedisError, asyncio.TimeoutError, OSError):
    logger.exception("Redis unreachable on GET /runs/%s/stream", run_id)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Streaming infrastructure unavailable"},
        headers={"Retry-After": "10"},
    )
```

**Adaptation for Phase 075:** New endpoint composes all three analogs. Copy ownership SELECT verbatim (use `maybe_single()` not `single()` per CR-01 — `get_messages` at `threads.py:743` mistakenly uses `single()` and works only because the postgrest patch swallows the resulting APIError; the new endpoint should follow the cleaner `list_active_runs` posture). Use the active-runs SELECT shape verbatim. Replace `redis.exists()` with `redis.xinfo_stream(f"run:{rid}")` for the per-active-run `since_cursors` loop (per RESEARCH §Pattern 2). Wrap the whole probe loop in one try/except (RedisError/TimeoutError/OSError) so any per-run failure surfaces as a single 503+Retry-After:10 for the whole endpoint (D-075-04 — no partial-degraded shape). Call the new `_enrich_messages_with_runs` helper (assignment 2) for the messages-list enrichment instead of inlining the merge.

---

### 2. NEW shared helper `_enrich_messages_with_runs` (service, request-response — extracted refactor)

**Source file:** `backend/app/api/threads.py` (module-private; recommend defining near the existing `_reconstruct_history` helper at `threads.py:821` so both helpers live in the same scope)

**Analog:** `backend/app/api/threads.py:795-816` — the current inline merge in `get_messages`

**Code to extract verbatim** (`threads.py:795-816`):
```python
# WR-01 fix: order by started_at DESC and prefer the FIRST run per
# message_id. public.runs.message_id has no UNIQUE constraint
# (migration 035 line 24 — only an FK with ON DELETE SET NULL), so in
# rare collision cases (buffer-expired retries, partial failure paths,
# producer races) multiple runs can share message_id. Without an
# explicit ORDER BY the dict comprehension was last-write-wins under
# the supabase-py response's implementation-defined order, and the
# response could attach an arbitrary (e.g. older `failed`) run's
# status to the assistant row. With DESC + first-wins-and-skip, the
# most recently started run wins deterministically — the one whose
# status is most likely to drive the correct Resume UX.
runs_resp = await aexec(
    supabase.table("runs")
    .select("run_id, message_id, status")
    .eq("thread_id", thread_id)
    .eq("user_id", current_user["id"])
    .order("started_at", desc=True)
)
runs_by_message: dict[str, dict] = {}
for r in (runs_resp.data or []):
    mid = r.get("message_id")
    if mid is None or mid in runs_by_message:
        continue  # keep the first (most recent) per message_id
    runs_by_message[mid] = r

# 3. Zip — assistant rows with FK matches get run_id/run_status populated;
# user rows and pre-run-backed assistant rows return null (Resume button
# only renders when runStatus === "failed", so null is the correct
# "no Resume" signal).
for m in messages:
    run = runs_by_message.get(m["id"])
    m["run_id"] = run["run_id"] if run else None
    m["run_status"] = run["status"] if run else None
```

**Adaptation for Phase 075:** Wrap the block in a new keyword-only async helper (per RESEARCH Pitfall 4):
```python
async def _enrich_messages_with_runs(
    messages: list[dict],
    *,
    thread_id: str,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """D-075-03: shared runs-FK merge for /messages and /snapshot."""
    # ... body extracted verbatim from threads.py:795-816 ...
    return messages
```
The `*` enforces keyword-only args so both call sites (existing `get_messages` and new `get_snapshot`) cannot drift via positional-arg confusion. Both T-063.1-01 (cross-user 404-before-runs-SELECT) and T-063.1-04 (no extra fields beyond `run_id` + `run_status`) carry verbatim — the SELECT in this helper still explicitly enumerates `"run_id, message_id, status"`. Existing test `test_063_1_messages_runs_join.py` must stay green post-extraction (Phase 075 Plan 01 ship gate).

---

### 3. MODIFIED sandbox execution loop (service, streaming)

**Source file:** `backend/app/api/threads.py:2155-2206`

**Analog:** Itself — the current `_run_sync` + drain loop

**Current call site** (`threads.py:2155-2206`):
```python
wrapped_code = "import os; os.chdir('/sandbox/output')\n" + file_preamble + code

start_time = time_mod.time()

def _run_sync():
    exec_result = session.run(
        wrapped_code,
        libraries=libraries,
        on_stdout=on_stdout,
        on_stderr=on_stderr,
    )
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "_done", "result": exec_result}
    )
    return exec_result

fut = loop.run_in_executor(None, _run_sync)

# Phase 067.4 (D-067.4-R5-01 amended): emit code_executing
# heartbeat every ~1 s during sandbox execution.
_heartbeat_last = time_mod.time()
_HEARTBEAT_INTERVAL_S = 1.0
while True:
    try:
        item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
    except asyncio.TimeoutError:
        now = time_mod.time()
        elapsed = now - start_time
        await _emit(redis, run_id, 'code_executing',
                    tool_index=tool_index, elapsed_seconds=round(elapsed, 1))
        # Preserve 10 s keepalive cadence (D-061-10).
        if now - _heartbeat_last >= 10.0:
            await _emit(redis, run_id, 'keepalive')
            _heartbeat_last = now
        continue
    if item["type"] == "_done":
        break
    await _emit(redis, run_id, item['type'], **{k: v for k, v in item.items() if k != 'type'})
```

**Existing on_stdout/on_stderr callback signatures** (`threads.py:2085-2095`):
```python
sandbox_queue: asyncio.Queue = asyncio.Queue()

def on_stdout(chunk: str):
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "code_stdout", "content": chunk}
    )

def on_stderr(chunk: str):
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "code_stderr", "content": chunk}
    )
```

**Adaptation for Phase 075 (D-075-05 + D-075-08):** Per RESEARCH Discovery 2, `session.run()` does NOT stream stdout — its on_stdout/on_stderr params are accepted but never invoked. Swap to `session.execute_command(f"python -u {code_file}", on_stdout=..., on_stderr=...)` which streams chunk-by-chunk through `_process_stream_output`. The asyncio.Queue bridge + `loop.call_soon_threadsafe` pattern is preserved verbatim; only the producer call changes. Critical: child Python MUST run with `-u` flag (block-buffered stdout otherwise yields 1 chunk at exit, not N per RESEARCH Pitfall 1). Write `wrapped_code` to `/tmp/run-{uuid.uuid4().hex}.py` via `session.execute_command("cat > … << '__EOF_PY__'\n…\n__EOF_PY__")` or `session.copy_to_runtime`. The chunk callbacks include a `captured_at` field — extend the existing `put_nowait` shape to `{"type": "stdout_chunk", "content": chunk, "captured_at": time_mod.time()}` (and the drain consumer line-buffers — see assignment 4). Also extend the queue item with `_last_output_at` tracking for D-075-08 silent-window heartbeat — reset `_last_output_at` only on stdout/stderr chunks (NEVER on the heartbeat itself per RESEARCH Pitfall 7), then guard the heartbeat emit with `if now - _last_output_at >= _HEARTBEAT_INTERVAL_S`. The 10s keepalive cadence (line 2198) is preserved unchanged.

---

### 4. NEW line-buffer accumulator (utility, transform)

**Source file:** `backend/app/api/threads.py:2186-2204` (modifies the existing drain loop)

**Analog:** No in-repo precedent. Pattern from RESEARCH §Pattern 5 (Docker streams bytes/decoded-strings in arbitrary chunks; per-line emission requires accumulator).

**New pattern (from RESEARCH §Pattern 5):**
```python
# Per-stream partial-line accumulators (init outside the drain loop).
_stdout_partial = ""
_stderr_partial = ""
_last_output_at = time_mod.time()   # D-075-08: silent-window heartbeat clock
_HEARTBEAT_INTERVAL_S = 1.0

while True:
    try:
        item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
    except asyncio.TimeoutError:
        now = time_mod.time()
        # D-075-08: heartbeat only if silent window ≥ 1s.
        if now - _last_output_at >= _HEARTBEAT_INTERVAL_S:
            elapsed = now - start_time
            await _emit(redis, run_id, "code_executing",
                        tool_index=tool_index, elapsed_seconds=round(elapsed, 1))
            # Note: do NOT update _last_output_at here — only stdout/stderr resets it.
        # Preserve 10s keepalive cadence (D-061-10).
        if now - _heartbeat_last >= 10.0:
            await _emit(redis, run_id, "keepalive")
            _heartbeat_last = now
        continue

    if item["type"] == "_done":
        # Flush any trailing partial line BEFORE terminal so SC #2 monotonic-captured_at holds.
        if _stdout_partial:
            await _emit(redis, run_id, "code_stdout",
                        content=_stdout_partial, captured_at=time_mod.time())
            _stdout_partial = ""
        if _stderr_partial:
            await _emit(redis, run_id, "code_stderr",
                        content=_stderr_partial, captured_at=time_mod.time())
            _stderr_partial = ""
        break

    if item["type"] == "stdout_chunk":
        _last_output_at = item["captured_at"]
        # Normalize CRLF → LF so Windows-style line endings don't leak as bare '\r'.
        combined = (_stdout_partial + item["content"]).replace("\r\n", "\n")
        lines = combined.split("\n")
        _stdout_partial = lines.pop()   # trailing partial (may be "")
        for line in lines:
            await _emit(redis, run_id, "code_stdout",
                        content=line, captured_at=item["captured_at"])

    elif item["type"] == "stderr_chunk":
        _last_output_at = item["captured_at"]
        combined = (_stderr_partial + item["content"]).replace("\r\n", "\n")
        lines = combined.split("\n")
        _stderr_partial = lines.pop()
        for line in lines:
            await _emit(redis, run_id, "code_stderr",
                        content=line, captured_at=item["captured_at"])
```

**Adaptation for Phase 075:** Drop this block in place of the current drain loop body at `threads.py:2186-2204`. Note: the existing drain loop dispatched any `item['type']` generically via `await _emit(redis, run_id, item['type'], **{k: v for k, v in item.items() if k != 'type'})`. The new loop replaces that generic dispatch with explicit `stdout_chunk` / `stderr_chunk` branches because we need to line-buffer and re-emit as multiple `code_stdout`/`code_stderr` events. If other sandbox events later need to flow through the queue (none today), an `else: await _emit(...)` fallback can be added.

---

### 5. DELETED post-completion stdout/stderr emit (removal)

**Source file:** `backend/app/api/threads.py:2210-2218`

**Current dead-code block to delete** (`threads.py:2210-2218`):
```python
# Emit stdout/stderr lines from result (on_stdout callbacks
# are no-ops in InteractiveSandboxSession — output only
# available after execution completes)
if exec_result.stdout:
    for line in exec_result.stdout.splitlines():
        await _emit(redis, run_id, 'code_stdout', content=line)
if exec_result.stderr:
    for line in exec_result.stderr.splitlines():
        await _emit(redis, run_id, 'code_stderr', content=line)
```

**Adaptation for Phase 075 (D-075-07):** Delete the entire 9-line block. The triggering comment ("on_stdout callbacks are no-ops in InteractiveSandboxSession") is now stale — Phase 075 bypasses `InteractiveSandboxSession.run()` entirely via `session.execute_command()` which DOES stream. Keeping the block would double-emit every line that already came through mid-flight, breaking the SC #2 "no duplicate at completion" assertion. The downstream code reading `exec_result.exit_code` + `stdout_text` for error-marker detection (`threads.py:2220+`) stays — we just stop re-emitting the buffered stdout/stderr text on the SSE wire.

---

### 6. NEW OpenAI `tool_args_progress` emit (service, streaming SSE producer)

**Source file:** `backend/app/api/threads.py:1601-1616`

**Analog:** Adjacent `_emit(redis, run_id, 'tool_preparing', ...)` call at `threads.py:1614`; `_emit` helper at `threads.py:105-119`.

**Current code at the insertion site** (`threads.py:1601-1616`):
```python
if delta.tool_calls:
    for tc in delta.tool_calls:
        idx = tc.index
        if idx not in tool_calls_buffer:
            tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
        if tc.id:
            tool_calls_buffer[idx]["id"] = tc.id
        if tc.function and tc.function.name:
            tool_calls_buffer[idx]["name"] = tc.function.name
            # D-01 (Phase 56.1): emit tool_preparing as soon as name is known,
            # before arguments finish streaming. Fires exactly once per tool index.
            if idx not in _announced_tools:
                _announced_tools.add(idx)
                await _emit(redis, run_id, 'tool_preparing', name=tc.function.name, index=idx)
        if tc.function and tc.function.arguments:
            tool_calls_buffer[idx]["arguments"] += tc.function.arguments
```

**`_emit` helper signature** (`threads.py:105-119`):
```python
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """One canonical XADD shape for all producer-side events (D-061-10).

    Wire format byte-identical to 059's queue payload: single-field
    `data` containing JSON-encoded {type, **fields}. MAXLEN ~ 10000 caps
    per-run buffer at ~2MB (typical run emits <500 events).
    """
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```

**Adaptation for Phase 075 (D-075-09/10/11):** Initialize `_tool_args_emit_boundary: dict[int, int] = {}` in the SAME init block as `tool_calls_buffer` and `_announced_tools` (per RESEARCH Pitfall 3 — agent-loop iteration must reset this counter alongside the existing buffers). After `tool_calls_buffer[idx]["arguments"] += tc.function.arguments`, add a boundary check guarded by D-075-11 filters (`name != "execute_code"` AND `calling_mode != CallingMode.STRUCTURED`). Compute `_bytes_total = len(tool_calls_buffer[idx]["arguments"].encode("utf-8"))`, `_new_boundary = _bytes_total // 5120`, and emit only when `_new_boundary > _last_boundary`. The `args_so_far` payload is the LAST 5KB tail via UTF-8-aware byte slice + `decode(errors="ignore")` to avoid invalid trailing codepoints (per D-075-09). Reuse the `_emit` helper unchanged — new event type rides the same XADD pipe (`_emit(redis, run_id, "tool_args_progress", tool_index=idx, name=_tool_name, args_so_far=_args_so_far, total_args_bytes_so_far=_bytes_total)`).

---

### 7. NEW Anthropic `tool_args_progress` yield (service, generator)

**Source file:** `backend/app/services/anthropic_service.py:199-225`

**Analog:** Adjacent `yield {"type": "tool_preparing", ...}` at `anthropic_service.py:197` + `yield {"type": "tool_start", ...}` at `:220-225`

**Current code at the insertion site** (`anthropic_service.py:187-225`):
```python
elif event_type == "content_block_start":
    block = event.content_block
    if block.type == "tool_use":
        tool_blocks[event.index] = {
            "id": block.id,
            "name": block.name,
            "arguments": "",
        }
        # Yield tool_preparing immediately — name is known, args still streaming.
        # tool_start is still delayed until content_block_stop (needs complete args).
        yield {"type": "tool_preparing", "id": block.id, "name": block.name, "index": event.index}

elif event_type == "content_block_delta":
    delta = event.delta
    if delta.type == "text_delta":
        if delta.text:
            yield {"type": "delta", "content": delta.text}
    elif delta.type == "input_json_delta":
        if event.index in tool_blocks:
            tool_blocks[event.index]["arguments"] += delta.partial_json

elif event_type == "content_block_stop":
    # Tool block is now complete — parse accumulated JSON and yield tool_start
    if event.index in tool_blocks:
        tb = tool_blocks[event.index]
        try:
            parsed_args = json.loads(tb["arguments"]) if tb["arguments"] else {}
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse tool arguments for %s: %r",
                tb["name"], tb["arguments"][:200],
            )
            parsed_args = {}
        yield {
            "type": "tool_start",
            "id": tb["id"],
            "name": tb["name"],
            "args": parsed_args,
        }
```

**Adaptation for Phase 075 (D-075-10/11):** Anthropic service is a generator — it does NOT have direct Redis access. Add a per-tool_index `_tool_args_emit_boundary: dict[int, int] = {}` at the same scope as `tool_blocks` (top of the generator function, alongside the existing dict init). After the `tool_blocks[event.index]["arguments"] += delta.partial_json` line, add a boundary check (same arithmetic as the OpenAI path — `_bytes_total // 5120`) guarded by `tb["name"] != "execute_code"` (the calling_mode filter does NOT apply here — anthropic_service is only invoked from the NATIVE path; structured-mode path bypasses this file entirely). On boundary hit, `yield {"type": "tool_args_progress", "tool_index": event.index, "name": tb["name"], "args_so_far": <last 5KB tail>, "total_args_bytes_so_far": _bytes_total}`. The caller in `threads.py` (`_on_chunk_anthropic` agent-loop dispatch) routes this yield to `_emit(redis, run_id, 'tool_args_progress', ...)` just as it already routes `"tool_preparing"` and `"tool_start"` yields — the dispatch table needs one new branch (planner finds this in `threads.py` at the existing `_on_chunk_anthropic` dispatch site).

---

### 8. MODIFIED `runs.py` heartbeat-gap distinction (BUG-260518-01 backend half)

**Source file:** `backend/app/api/runs.py:221-235`

**Analog:** Itself — current `buffer_expired_during_tail` emit

**Current code** (`runs.py:221-235`):
```python
if not result:
    # WR-02 fix: if the stream key vanished mid-stream (TTL race
    # between the route's redis.exists probe and our first xread,
    # or producer finalize → EXPIRE 60 → TTL-zero arriving inside
    # the BLOCK window), don't keep BLOCKing until the hard
    # deadline. Emit a synthetic terminal-shaped error event and
    # return so the client gets a clean close instead of waiting
    # the full consumer_timeout_seconds for this consumer.
    try:
        if not await redis.exists(stream_key):
            yield {"data": json.dumps({
                "type": "error",
                "error": "buffer_expired_during_tail",
            })}
            return
    except asyncio.CancelledError:
        ...
```

**Adaptation for Phase 075 (D-075-13):** Before emitting `buffer_expired_during_tail` on stream-key-missing, probe `runs.status` from Postgres (the runs row outlives the Redis buffer per D-062-06). If `runs.status == "streaming"` AND the SSE wire has emitted a recent `code_executing` heartbeat (or per planner's choice, the runs row's `started_at` is younger than some threshold), distinguish this as a "heartbeat-gap" (sandbox is silent inside a long execute_code cell) rather than a genuine stream end. The cleanest expression is to keep the existing `buffer_expired_during_tail` emit shape but extend it with a discriminator field: `{"type": "error", "error": "buffer_expired_during_tail", "runs_status": <status>, "recently_active": <bool>}`. The frontend (assignment 12) reads `recently_active` and treats it as transient. Note: the existing `_synthetic_terminal_generator` at `runs.py:298-319` already reads `runs_status` for the TTL-expired-after-completion case — that pattern is the model to follow for the read-runs-row helper.

---

### 9. NEW `getSnapshot` helper in frontend api.ts (service, HTTP client)

**Source file:** `frontend/src/lib/api.ts` (insert alongside `getActiveRuns` at `:456-467`)

**Analog:** `frontend/src/lib/api.ts:456-467` — `getActiveRuns`

**Current `getActiveRuns` pattern** (`api.ts:452-467`):
```typescript
/** Phase 063 / Phase 062 contract: list streaming runs the requesting user
 * owns on the given thread. Empty array when nothing is in flight. RLS+
 * defense-in-depth filtered server-side; cross-user → 404 (D-062-12).
 */
export async function getActiveRuns(
  threadId: string,
  signal?: AbortSignal,
): Promise<ActiveRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/active-runs`, {
    headers,
    signal,
  })
  if (!res.ok) throw new Error("Failed to list active runs")
  return (await res.json()) as ActiveRun[]
}
```

**ActiveRun type** (`api.ts:155-159`):
```typescript
export interface ActiveRun {
  run_id: string
  started_at: string
  status: "streaming"
}
```

**`subscribeToRun` since-cursor consumption** (`api.ts:274-282`):
```typescript
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/runs/${runId}/stream?since=${encodeURIComponent(since)}`
  const res = await fetch(url, { headers, signal })
```

**Adaptation for Phase 075 (D-075-01/02):** Add `getSnapshot(threadId, signal?)` returning `Promise<ThreadSnapshot>` where `ThreadSnapshot = { messages: Message[]; active_runs: ActiveRun[]; since_cursors: Record<string, string> }`. The `messages` field requires the SAME snake_case → camelCase mapper that `getMessages` already uses (`run_id` → `runId`, `run_status` → `runStatus`, `source_refs` → `citations`, etc.). RESEARCH recommends extracting that mapper as a module-private `_mapMessageResponse` helper so `getMessages` and `getSnapshot` share it byte-identically — that extraction is a Plan 01 sub-task. The fetch shape, `getAuthHeaders` usage, error handling (`if (!res.ok) throw new Error(...)`) all carry verbatim from `getActiveRuns`. The existing `getActiveRuns` and `getMessages` helpers STAY (used by code outside the reconcile hot path per D-075-02); `getSnapshot` is purely additive in api.ts.

---

### 10. MODIFIED `StreamsProvider.reconcile` (provider, atomic swap)

**Source file:** `frontend/src/providers/StreamsProvider.tsx:473-490`

**Analog:** Itself — current `Promise.all([getActiveRuns, loadMessages])` chain

**Current code being collapsed** (`tsx:473-490`):
```typescript
// Phase 068 (L-068-02 + L-068-05): reconcile in-flight lock +
// runId-match dedup. Source: useMessages.ts:948-1144.
reconcile: async (threadId, surfaceId = "chat") => {
  // Phase 063.1 (D-063.1-11 / Gap-005): top-of-function in-flight guard.
  if (reconcileInFlightRef.current) return
  reconcileInFlightRef.current = true
  try {
    let activeRuns: Awaited<ReturnType<typeof getActiveRuns>>
    try {
      // CONTEXT.md "Reconciliation Hook Ordering": active-runs and messages
      // MUST be fetched in parallel.
      const [runs] = await Promise.all([
        getActiveRuns(threadId),
        useStreamsStore.getState().actions.loadMessages(threadId, surfaceId),
      ])
      activeRuns = runs
    } catch (err) {
      console.error("reconcile failed:", err)
      return
    }
    // ... per-run reattach loop at tsx:492-601 ...
```

**Branch D-3 guard (MUST PRESERVE VERBATIM per D-075-02)** — physical location post-Phase-068 is `StreamsProvider.tsx:419-435`, NOT the stale `useMessages.ts:572-590` reference in CONTEXT.md (per RESEARCH Discovery 3 + Pitfall 6):
```typescript
// Phase 068 (L-068-01): Branch D-3 guard predicate (VERBATIM from
// useMessages.ts:589-598) — refuse to wipe a bucket whose thread is
// currently being streamed into. Predicate text matches the
// acceptance-criterion grep exactly. Source: useMessages.ts:572-601.
clearThreadBucket: (surface) => {
  const tid = activeThreadIdRef.current
  if (tid && tid !== streamingThreadIdRef.current) {
    useStreamsStore.setState((state) => {
      const surfMap = state.bucketsBySurface.get(surface)
      if (!surfMap || !surfMap.has(tid)) return {}
      const nextSurf = new Map(surfMap)
      nextSurf.delete(tid)
      const nextBuckets = new Map(state.bucketsBySurface)
      nextBuckets.set(surface, nextSurf)
      return {
        bucketsBySurface: nextBuckets,
        isStreaming: false,
      }
    })
  }
},
```

**Adaptation for Phase 075 (D-075-02):** Replace the `Promise.all([getActiveRuns(threadId), loadMessages(threadId, surfaceId)])` block with a single `const snapshot = await getSnapshot(threadId)`. Hydrate the messages bucket via the existing `setMessagesForBucket(surfaceId, threadId, () => snapshot.messages)` (loadMessages already calls this internally — same shape now bypasses the extra round-trip). Seed `lastSeenOffsetRef.current` from `snapshot.since_cursors` ONLY for run_ids not yet in the map (D-075-01: server cursors are first-attach defaults; existing client cursors win on subsequent reconciles). Then iterate `snapshot.active_runs` in the existing per-run reattach loop at `tsx:492-601` — the loop body is unchanged. The `subscribeToRun(run.run_id, lastSeenOffsetRef.current.get(run.run_id) ?? "0", ...)` call at `tsx:574-579` automatically picks up the seeded cursor. The Branch D-3 guard at `tsx:419-435` (`clearThreadBucket` action) is preserved VERBATIM — Plan 01 acceptance criterion: `grep -n "tid !== streamingThreadIdRef.current" frontend/src/providers/StreamsProvider.tsx` MUST still return line 421 post-Plan-01.

---

### 11. MODIFIED `StreamsProvider.onTerminal` (BUG-260518-01 frontend half)

**Source file:** `frontend/src/providers/StreamsProvider.tsx:689-720`

**Analog:** Itself — current `kind === "error"` flip

**Current code** (`tsx:688-720`):
```typescript
const originalOnTerminal = callbacks.onTerminal
callbacks.onTerminal = (kind, errorPayload) => {
  useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
    if (!prev.some((m) => m.id === assistantId)) return prev
    return prev.map((m) => {
      if (m.id !== assistantId) return m
      if (kind === "done") return { ...m, runStatus: "completed" }
      if (kind === "error") return { ...m, runStatus: "failed" }
      if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
      // kind === "cancelled"
      return { ...m, runStatus: "cancelled", stopped: true }
    })
  })
  // L-068-07: BL-03 fix — subscriptionsRef cleanup belongs in
  // onTerminal, NOT the finally chain. Mirror updates alongside.
  if (registeredRunId) {
    subscriptionsRef.current.delete(registeredRunId)
    const runIdToRemove = registeredRunId
    useStreamsStore.setState((s) => {
      const next = new Set(s.subscriptionsByRunId)
      next.delete(runIdToRemove)
      return { subscriptionsByRunId: next }
    })
  }
  // Pitfall 8: TTL-expired buffer fallback.
  if (errorPayload === "buffer_expired") {
    useStreamsStore
      .getState()
      .actions.loadMessages(threadId, surfaceId)
      .catch(console.error)
  }
  originalOnTerminal(kind, errorPayload)
}
```

**Adaptation for Phase 075 (D-075-13):** When `kind === "error"` AND `errorPayload?.startsWith("buffer_expired")`, this is a provisional terminal — call `getSnapshot(threadId)` BEFORE flipping `runStatus: "failed"`. If `snapshot.active_runs` still contains this `run_id` with `status === "streaming"`, DO NOT update the message's runStatus; instead re-attach the SSE stream from `snapshot.since_cursors[run_id]` (reuse the existing reattach branch in the reconcile loop). Per RESEARCH Pitfall 5, this must NOT flip `isStreaming: false` until the snapshot confirms terminal — otherwise the Resume button briefly flickers visible. Two-step pattern:
```typescript
if (kind === "error" && errorPayload?.startsWith("buffer_expired")) {
  const snapshot = await getSnapshot(threadId).catch(() => null)
  const stillActive = snapshot?.active_runs.some(r => r.run_id === registeredRunId)
  if (stillActive) {
    // Re-attach SSE from snapshot.since_cursors[registeredRunId]; don't flip runStatus.
    return
  }
}
// Existing flip behavior runs for all other terminal kinds.
```
Note: there are TWO onTerminal handlers in StreamsProvider — one in `reconcile` (`tsx:540-567`) and one in the sendMessage path (`tsx:688-720`). Plan 01 must apply the fix to BOTH so resume-button-stays-hidden invariant holds whether the user F5-reloads into an active run or sends a fresh one.

---

### 12. MODIFIED `api.ts` `buffer_expired_*` error mapping

**Source file:** `frontend/src/lib/api.ts:390-408`

**Analog:** Itself — current `t === "error"` branch in `subscribeToRun`'s SSE parser

**Current code** (`api.ts:393-395`):
```typescript
} else if (t === "error") {
  callbacks.onTerminal("error", parsed.error as string | undefined)
  return
}
```

**Adaptation for Phase 075 (D-075-13):** No behavioral change at the api.ts layer — `onTerminal("error", "buffer_expired_during_tail")` continues to fire. The "transient mapping" lives at the consumer side (the StreamsProvider.onTerminal handler in assignment 11), which inspects the errorPayload prefix and decides whether to flip `runStatus: "failed"` or reconcile-and-reattach. CONTEXT.md framed this as an api.ts change, but per RESEARCH the cleanest expression keeps api.ts as a faithful SSE-to-callback bridge and puts the transient/terminal decision in the consumer. Plan 01 acceptance criterion: api.ts:393-395 stays byte-identical; the assertion lives in StreamsProvider tests. (If planner disagrees and wants an api.ts-layer remap, the alternative is to translate `parsed.error === "buffer_expired_during_tail"` into a new `onTerminal` kind like `"transient_error"` and add it to the `StreamCallbacks` Literal at `api.ts:172`. CONTEXT.md doesn't lock the layer; RESEARCH recommends the consumer-side path.)

---

### 13. MODIFIED bottom-indicator component (BUG-260514-03)

**Source file:** `frontend/src/components/chat/MessageItem.tsx:142-164`

**Analog:** Itself — current bottom-indicator render branch (also lines 181-194 for the active-tool indicator)

**Current bottom-indicator code** (`MessageItem.tsx:142-164`):
```tsx
) : hasAnyTools ? (
  // Tools ran but no text yet — show whether we're still working or waiting
  // Shown regardless of isStreaming so SSE drops don't cause a blank
  <span className="flex items-center gap-2 text-muted-foreground text-sm mt-1.5 animate-fadeSlideUp">
    {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
    <span className="italic">
      {isStreaming
        ? outerBannerLabel(activeTool, hasAnyTools, message.isPlanning ?? false)
        : message.runStatus === "timed_out"
          ? "Agent reached time limit"
          : message.runStatus === "cancelled" || message.stopped
            ? "Response stopped"
            : null /* D-067-02: no mid-stream chrome — terminal states only carry text. Match Claude/ChatGPT. */}
    </span>
    {isStreaming && (
      <span className="flex gap-1 items-center">
        ...dots...
      </span>
    )}
  </span>
) : null}
```

**Active-tool indicator** (`MessageItem.tsx:181-187`) — shown when there's both content AND a running tool:
```tsx
{isStreaming && hasRunningTools && message.content && (
  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
    <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
    <span className="italic truncate">{activeToolLabel ?? "Working…"}</span>
  </div>
)}
```

**Adaptation for Phase 075 (D-075-14, two-part fix):**
- (a) **Sticky text per macro state.** Today `outerBannerLabel(activeTool, hasAnyTools, ...)` returns the in-flight banner copy; if no fresh state event arrives the label can transiently return `null` (e.g. between a tool's running and preparing states, during silent sandbox windows). Wrap the label in a `useRef<string | null>` that retains the LAST non-null label per `activeTool?.id` (or per `message.id` if simpler) — when the computed label is `null` mid-stream AND the previous label was set, render the previous label. Reset on assistant message done.
- (b) **Subscribe to new line-by-line `code_stdout` events.** The `onCodeStdout` callback already exists at `api.ts:362-363` (wired in subscribeToRun). The consumer side (likely a hook reading SSE state, currently NOT updating any visible indicator on `code_stdout`) needs to update the bottom-indicator's sticky text on each new line — either re-anchor the existing "Running code…" label with the latest captured_at, or update to "Running code… (N seconds)". Planner must grep at plan time for where `onCodeStdout` is currently wired into the React state graph (likely in `useStreamsStore` callbacks or `makeStreamCallbacks`) and add the sticky-label update there. Per RESEARCH Assumption A7 + BUG-260514-03 report, the fix is assumed to stay in MessageItem.tsx + the callback wiring; if it leaks into deeper hooks the Plan 02 frontend half balloons.

---

### 14. NEW integration test files

**Source files:**
- `backend/tests/integration/test_075_snapshot.py` — Plan 01 ship gate (POLISH-SEED-008-01 + BUG-260518-01 backend half)
- `backend/tests/integration/test_075_code_stdout_progressive.py` — Plan 02 ship gate (POLISH-SEED-008-02 + SC #4 heartbeat regression)
- `backend/tests/integration/test_075_tool_args_progress.py` — Plan 03 ship gate (POLISH-TOOL-PROG-01, OpenAI + Anthropic + both filter cases)

**Analogs:**
- `backend/tests/integration/test_063_post_then_subscribe.py` — POST→GET stream pattern + httpx ASGITransport + 3-patch scaffold (lines 26-150)
- `backend/tests/integration/test_063_1_messages_runs_join.py` — mock-supabase ownership + runs-SELECT routing pattern + cross-user 404 leak assertion (lines 184-256)
- `backend/tests/integration/conftest.py` — `_reset_redis_singleton` autouse fixture (Phase 074 D-074-11; auto-applies to all 3 new test files)

**Test client + auth header pattern** (`test_063_post_then_subscribe.py:75-95`):
```python
async with httpx.AsyncClient(
    transport=ASGITransport(app=app), base_url="http://test"
) as ac:
    resp = await ac.post(
        f"/threads/{THREAD_A}/messages",
        headers={"Authorization": "Bearer test-token"},
        json={"content": "hello", "agent_mode": "default"},
    )
    assert resp.status_code == 201, ...
```

**3-patch scaffold for mocking the streaming LLM call** (`test_063_post_then_subscribe.py:66-75`):
```python
with patch(
    "app.api.threads.create_adaptive_streaming_chat",
    side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
), patch(
    "app.services.suggestion_service.generate_suggestions",
    return_value=([], None),
), patch(
    "app.api.threads.generate_thread_title",
    return_value=("T", None),
):
```

**SSE event-capture helper** (`test_063_post_then_subscribe.py:122-138`):
```python
events = []
async with ac.stream(
    "GET", f"/runs/{run_id}/stream?since=0",
    headers={"Authorization": "Bearer test-token"},
    timeout=30.0,
) as stream_resp:
    async for line in stream_resp.aiter_lines():
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            events.append(payload)
            if payload.get("type") in TERMINAL_TYPES:
                break
```

**Cross-user 404 + leak-assertion pattern** (`test_063_1_messages_runs_join.py:184-256`):
```python
THREAD_A = str(uuid4())
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

# Threads ownership SELECT returns no row (cross-user). Route MUST 404
# at this point and never touch the runs SELECT.
threads_builder = mock_supabase.table("threads")
threads_builder.execute.side_effect = lambda *a, **k: _make_result(None)

runs_builder = mock_supabase.table("runs")
runs_execute_called = []
def _runs_execute(*a, **k):
    runs_execute_called.append((a, k))
    return _make_result([])
runs_builder.execute.side_effect = _runs_execute

app.dependency_overrides[get_supabase] = lambda: mock_supabase
app.dependency_overrides[get_current_user] = lambda: OTHER_USER
try:
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        resp = await c.get(
            f"/threads/{THREAD_A}/snapshot",
            headers={"Authorization": "Bearer test-token"},
        )

    assert resp.status_code == 404, f"got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body.get("detail") == "Thread not found", ...
    body_text = resp.text
    assert THREAD_A not in body_text, ...
    assert "run_id" not in body_text, ...
    # Short-circuit invariant: runs SELECT MUST NOT have been called.
    assert not runs_execute_called, ...
finally:
    app.dependency_overrides.pop(get_supabase, None)
    app.dependency_overrides.pop(get_current_user, None)
```

**`_reset_redis_singleton` autouse fixture** (`conftest.py:22-37` — automatically applies to every new test in the integration dir):
```python
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop ..."""
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**Adaptation for Phase 075:**

- **test_075_snapshot.py:** 3 tests (happy-path shape, cross-user 404, Redis-down 503) using mock_supabase from `_run_helpers._build_mock_supabase` (mirror `test_063_1_messages_runs_join.py:57-127`). For Redis-down 503, the test patches `redis.xinfo_stream` to raise `RedisError` and asserts the response is 503 with `Retry-After: 10` header. The 4th implicit test is the regression run of `test_063_1_messages_runs_join.py` itself (must stay green post-helper-extraction).
- **test_075_code_stdout_progressive.py:** Real-sandbox test (needs Docker daemon). Drives a `for i in range(5): print(i); time.sleep(1)` cell via the agent loop and asserts: (a) ≥3 distinct `code_stdout` events, (b) monotonic `captured_at`, (c) total elapsed ≥1.0s, (d) no duplicate at completion (no two events with identical content where the second one fires AFTER the `_done` marker). Plus a `test_silent_workload_emits_heartbeat` companion: silent `time.sleep(5)` cell → assert ≥4 `code_executing` events in the 5s window (SC #4 invariant). Add `@pytest.mark.skipif(not os.environ.get("SANDBOX_ENABLED"), ...)` per existing real-sandbox test patterns.
- **test_075_tool_args_progress.py:** 4 mock-supabase tests using the `_slow_chunks_with_big_args` helper pattern from RESEARCH §Code Examples (test_075_tool_args_progress.py scaffold): (a) OpenAI happy path — ≥2 progress events at 5KB / 10KB boundaries, monotonic `total_args_bytes_so_far`, `args_so_far` ≤5120 bytes each, all progress events BEFORE `tool_start`; (b) `execute_code` skipped — flip tool name, assert zero progress events; (c) STRUCTURED mode skipped — patch `calling_mode = CallingMode.STRUCTURED`, assert zero progress events; (d) Anthropic happy path — mock the anthropic generator's input_json_delta events with big partial_json chunks, assert the same boundary behavior on the wire.

All three test files inherit `_reset_redis_singleton` automatically (autouse=True at conftest.py:22) — Plan 01/02/03 do NOT need to copy this fixture into the new files.

---

## Shared Patterns

### Authentication + Ownership (D-062-12 / D-075-04)

**Source:** `backend/app/api/threads.py:524-533` (`list_active_runs`) + `backend/app/api/runs.py:342-352` (`stream_run`)

**Apply to:** New `/snapshot` endpoint, ALL ownership-sensitive queries

```python
# Pattern: dual .eq("user_id") defense-in-depth + 404 not 403 + maybe_single
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

### Redis Probe + 503 Fallback (D-062-13 / D-075-04)

**Source:** `backend/app/api/runs.py:354-370`

**Apply to:** `/snapshot` endpoint's per-active-run xinfo_stream loop

```python
try:
    info = await asyncio.wait_for(
        redis.xinfo_stream(f"run:{rid}"),
        timeout=2.0,
    )
except (RedisError, asyncio.TimeoutError, OSError):
    logger.exception("Redis unreachable on GET /threads/%s/snapshot", thread_id)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Streaming infrastructure unavailable"},
        headers={"Retry-After": "10"},
    )
```

### `_emit` XADD wrapper (D-061-10)

**Source:** `backend/app/api/threads.py:105-119`

**Apply to:** All new SSE event types (`code_stdout` per-line, `tool_args_progress`)

```python
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```

All new events ride this helper unchanged: `await _emit(redis, run_id, "tool_args_progress", tool_index=idx, name=name, args_so_far=tail, total_args_bytes_so_far=total)` / `await _emit(redis, run_id, "code_stdout", content=line, captured_at=ts)`.

### Identifier-only log format strings (T-073-04 / D-074-03)

**Apply to:** Any new logger calls in `/snapshot` or `tool_args_progress` emit guards

```python
# Good:
logger.info("emitting tool_args_progress for tool_index=%d size=%d", idx, total)
# Bad (leaks args content):
logger.info("emitting tool_args_progress: %s", args_so_far)
```

### Mock-Supabase test scaffolding

**Source:** `backend/tests/integration/test_063_1_messages_runs_join.py:57-75` + `test_063_post_then_subscribe.py:66-95`

**Apply to:** All 3 new test files

```python
mock_supabase = _build_mock_supabase()
app.dependency_overrides[get_supabase] = lambda: mock_supabase
try:
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})
    # ... per-test side_effect chains ...
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.get(
            f"/threads/{THREAD_A}/snapshot",
            headers={"Authorization": "Bearer test-token"},
        )
    # ... assertions ...
finally:
    app.dependency_overrides.pop(get_supabase, None)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/api/threads.py:2186-2204` line-buffer accumulator | utility (transform) | streaming | No in-repo Docker-stdout splitter precedent. New pattern sourced from RESEARCH §Pattern 5. The algorithm itself is trivial (`combined.split("\n"); partial = lines.pop()`), but no analog exists because Phase 075 is the first time the project bypasses `InteractiveSandboxSession.run()` for streaming output. |

The Phase 074 testing scaffold for real-sandbox tests (`test_065_skills_*.py` per RESEARCH §Code Examples) was referenced but not read in this session — `test_075_code_stdout_progressive.py` borrows the POST→GET pattern from `test_063_post_then_subscribe.py` and the planner consults `test_065_skills_*` at plan time for the `@pytest.mark.skipif(not SANDBOX_ENABLED, ...)` shape.

---

## Metadata

**Analog search scope:**
- `backend/app/api/{threads,runs}.py`
- `backend/app/services/{anthropic_service,sandbox_service}.py`
- `backend/app/models/{message,run,thread}.py`
- `backend/tests/integration/{conftest,test_063_*,test_075_*}.py`
- `frontend/src/providers/StreamsProvider.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/components/chat/MessageItem.tsx`
- `frontend/src/types/index.ts`

**Files scanned:** 14 (8 backend, 6 frontend) — all read in this session.

**Pattern extraction date:** 2026-05-18

## PATTERN MAPPING COMPLETE
