# Phase 075: SEED-008 + tool_args_progress Polish Bundle - Research

**Researched:** 2026-05-18
**Domain:** SSE producers, Redis Streams, Docker SDK exec streaming, FastAPI Pydantic models, frontend stream reconciliation
**Confidence:** HIGH for all areas (claims grounded in direct codebase reads + installed-package source inspection)

## Summary

Phase 075 ships three narrow streaming-UX upgrades + two folded bug fixes. Every locked decision in CONTEXT.md (D-075-01 through D-075-16) is honored by this research — no alternative paths researched for locked choices. Where CONTEXT.md grants Claude's discretion (Pydantic shapes, Docker SDK API depth, integration-test scaffolding), this research surfaces the specific verified implementation path.

**Three discoveries that shift planning:**

1. **`InteractiveSandboxSession.run()` cannot stream stdout at all** — verified by reading `~/site-packages/llm_sandbox/interactive.py`. The on_stdout/on_stderr params are explicitly `# noqa: ARG002` (unused; lines 234-235) and the docstring says "Not used in interactive sessions (accepted for API compatibility)." The architecture uses a remote IPython runner that captures stdout in `io.StringIO`, then dumps the full buffer in a result-{id}.json file ONLY after `shell.run_cell()` completes. **There is no streaming channel out of `.run()` — period.** D-075-05's "bypass session.run()" is not optional; it's the only available path.
2. **`session.execute_command(cmd, on_stdout=..., on_stderr=...)` already streams chunk-by-chunk via Docker's exec_run(stream=True, demux=True)** — verified by reading `~/site-packages/llm_sandbox/docker.py` (DockerContainerAPI.execute_command at lines 43-60) and `~/site-packages/llm_sandbox/core/mixins.py` (`_process_stream_output`). This is a simpler path than reaching for raw Docker SDK. Trade-off: it runs as a fresh process inside the container (NOT the persistent IPython interpreter), so it loses cross-cell state. For execute_code that's acceptable — every execute_code call today already runs in a fresh shell via `session.run(wrapped_code)` which wraps the user's code in `import os; os.chdir('/sandbox/output')` (threads.py:2154); the IPython "persistent state across cells" feature isn't load-bearing for this use case.
3. **The CONTEXT.md canonical-refs entry "frontend/src/hooks/useMessages.ts:572-590 — PRESERVE VERBATIM" is stale.** Post-Phase 068, `useMessages.ts` is now a 89-line thin wrapper that delegates to `<StreamsProvider>` named hooks. The Branch D-3 guard physically lives at `StreamsProvider.tsx:415-435` (`clearThreadBucket` action). The verbatim-preservation intent still applies, but the line range to honor is StreamsProvider.tsx:419-435 (where the `tid && tid !== streamingThreadIdRef.current` predicate fires). **Plan 01 acceptance criterion must lock against this corrected location.**

**Primary recommendation:** Plan 01 is a straightforward backend-endpoint-plus-frontend-cutover; Plan 03 is a pure SSE-producer add. Plan 02 carries the most novelty (the `session.execute_command(...)` swap + the sandbox child must run with `python -u` or `PYTHONUNBUFFERED=1` to flush per-line — block-buffered stdout will otherwise produce 1 chunk at exit, not 5 per the SC #2 test).

## User Constraints (from CONTEXT.md)

### Locked Decisions

> Source: 075-CONTEXT.md `<decisions>` section. Verbatim copy below — these are the choices the planner does not re-research.

**Snapshot endpoint shape + cutover (Area 1):**
- **D-075-01:** `GET /threads/{id}/snapshot` returns `{messages, active_runs, since_cursors}`. `since_cursors` is **server-derived** from the actual Redis stream state for each active run — NOT a literal `'0'` constant and NOT a client hint. The frontend's `lastSeenOffsetRef.current` map at `StreamsProvider.tsx:369` still wins on reconnects after the first attach; server cursors are the **initial** replay starting point.
- **D-075-02:** Frontend cutover is an **atomic swap** in `StreamsProvider.reconcile` (lines 478-485). No feature flag, no coexistence. The Phase 067.5 Branch D-3 streaming-bucket guard is preserved **verbatim** (see Discovery 3 above — actual location is StreamsProvider.tsx:419-435 post-Phase-068 lift).
- **D-075-03:** Extract a shared async helper `_enrich_messages_with_runs(thread_id, user_id, supabase)` from threads.py:795-816. Both `/messages` and the new `/snapshot` call it. T-063.1-01 (cross-user 404-before-runs-SELECT) and T-063.1-04 (no extra fields beyond `run_id` + `run_status`) carry verbatim.
- **D-075-04:** Auth + failure-mode posture mirrors existing endpoints **exactly** — dual `.eq("user_id")`, cross-user → 404 not 403, Redis probe with 2s wait_for + 503+Retry-After:10 on failure, `since_cursors` requires Redis (Redis-down → entire endpoint 503).

**Sandbox line-by-line stdout mechanism (Area 2):**
- **D-075-05:** Bypass `InteractiveSandboxSession.run()` entirely for execute_code. Use Docker SDK `exec_run(..., stream=True, demux=True)` (or equivalent). Session object stays for lifecycle, /sandbox/output bootstrap, and harvest_output_files post-execution.
- **D-075-06:** Per-line emit, no batching. Each line → one `code_stdout` SSE event with `captured_at` timestamp.
- **D-075-07:** DELETE the post-completion stdout/stderr emit at threads.py:2213-2218. Mid-flight emit owns every line; the post-completion loop would double-emit.
- **D-075-08:** Heartbeat fires only during silent windows (>1s with no stdout). Implementation: track `_last_output_at`; emit `code_executing` only when `now - _last_output_at >= 1.0`. The 10s keepalive cadence (D-061-10) is preserved unchanged.

**tool_args_progress payload + chunking (Area 3):**
- **D-075-09:** `args_so_far` is the cumulative full args buffer truncated to the LAST 5KB (sliding-window tail). `total_args_bytes_so_far` carries the full running size. UTF-8-aware slice required to avoid invalid trailing codepoint bytes.
- **D-075-10:** Fire on every 5KB-accumulated boundary (5KB, 10KB, 15KB, …). Per-tool_index `last_emit_boundary` counter; `if len(accumulator.encode("utf-8")) // 5120 > last_emit_boundary: emit; advance counter`.
- **D-075-11:** Filter: skip when `tool_name == "execute_code"` AND skip when `calling_mode == CallingMode.STRUCTURED`. Both filters live in the emit guard.
- **D-075-12:** Backend SSE primitive only — no frontend consumer this phase. UI consumption deferred to v3.0 Skill Studio.

**Reported bug fold-ins (Area 4):**
- **D-075-13:** BUG-260518-01 (Resume mid-stream) folded into Plan 01. Three-file fix: runs.py:221-235 (heartbeat-gap distinction), api.ts:390-408 (buffer_expired_* → transient), StreamsProvider.tsx:689-720 (reconcile-fetch on provisional terminal).
- **D-075-14:** BUG-260514-03 (top/bottom indicator desync) folded into Plan 02. Two-half fix: (a) sticky bottom-indicator text, (b) subscribe to new code_stdout events.
- **D-075-15:** BUG-260514-02 (Anthropic narration vs synthesized summary) deferred again — root cause is system-prompt / agent-loop terminal-frame OR frontend block-ordering, orthogonal to Phase 075's surface.
- **D-075-16:** 3-plan split — Plan 01 (snapshot + BUG-260518-01), Plan 02 (code_stdout rewire + BUG-260514-03), Plan 03 (tool_args_progress). Plans 02 + 03 are independent; Plan 01 has no dependency on either.

### Claude's Discretion

(Verbatim per CONTEXT.md.)

- **Pydantic response models:** new `ThreadSnapshotResponse(messages: list[MessageResponse], active_runs: list[ActiveRunResponse], since_cursors: dict[str, str])` in the existing `app/models/` (NOT `app/schemas/` — verified: this repo uses `backend/app/models/{message,run,thread}.py`, not `app/schemas/`). Reuse existing two models verbatim.
- **Integration test scaffolding:** new tests land in `backend/tests/integration/` next to `test_063_post_then_subscribe.py` / `test_063_1_messages_runs_join.py`. The hoisted `_reset_redis_singleton` autouse fixture from `backend/tests/integration/conftest.py` (per Phase 074 D-074-11) protects them automatically.
- **Chrome MCP UAT cadence:** SC #1 cold-cache latency needs `performance_start_trace` / `performance_stop_trace` against `http://localhost:5173/` with `fhdmrd@gmail.com` / `123456`.
- **Docker SDK exec_run API choice:** planner picks between `session.execute_command(cmd, on_stdout=..., on_stderr=...)` (high-level, already-streaming, callback-driven — see Discovery 2 + Pattern 2 below) vs `session.container.exec_run(cmd, stream=True, demux=True)` (low-level, return value is iterator of (stdout, stderr) bytes tuples). The high-level path is cleaner.
- **Per-line vs per-chunk from Docker SDK:** Docker streams **bytes chunks, not lines**. Planner adds a small line-buffer; trailing partial line flushes as a final `code_stdout` event before `_done`.
- **Code-review depth:** Standard.

### Deferred Ideas (OUT OF SCOPE)

(Verbatim per CONTEXT.md.)

- BUG-260514-02 (Anthropic narration vs synthesized summary) — re_open_trigger refreshed to v2.7 Agent Workspace OR future system-prompt redesign OR optional 075.1.
- `tool_args_progress` for `execute_code` — deferred to v3.0 Skill Studio per REQUIREMENTS.md line 65.
- Frontend consumer for `tool_args_progress` — deferred to v3.0 Skill Studio.
- Adaptive emit cadence for `code_stdout` (hybrid per-line / batched at >20 events/s) — rejected per D-075-06.
- Snapshot endpoint feature flag — rejected per D-075-02.
- Snapshot endpoint partial-degraded shape on Redis-down — rejected per D-075-04.
- Frontend dedup for double-emit stdout — rejected per D-075-07.
- Heartbeat at fixed 1Hz regardless of stdout activity — rejected per D-075-08.
- Switching to a streaming-capable llm-sandbox variant — D-075-05 already bypasses `session.run()`.
- Realtime hint composition with snapshot — D-v2.5-03 says Realtime is a hint; snapshot IS the reconcile fetch.
- Multi-worker compatibility audit — Phase 077 / D-PRD-12 territory. /snapshot is stateless.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-SEED-008-01 | Thread switch latency ≥50% reduced on cold-cache (post-F5). New `GET /threads/{id}/snapshot` endpoint replaces 3-call chain. | §Technical Approach #1 (Pydantic shape), #2 (`since_cursors` derivation), #7 (frontend types + atomic swap). Plan 01. |
| POLISH-SEED-008-02 | Sandbox `for i in range(5): print(i); time.sleep(1)` produces ≥3 distinct `code_stdout` events across ≥1s. | §Technical Approach #1 (sandbox bypass), #5 (line-buffering algorithm), #6 (test scaffolding). Plan 02. |
| POLISH-TOOL-PROG-01 | Non-`execute_code` tools emit `tool_args_progress` SSE when arg JSON > 5KB during streaming. | §Technical Approach #4 (`_emit` helper signature + boundary check). Plan 03. |

## Project Constraints (from CLAUDE.md)

These directives apply to every plan in Phase 075; carry verbatim into PLAN.md acceptance criteria:

- **`venv` virtual environment** — backend tests must run via `backend/venv/Scripts/python -m pytest …` (Windows). Don't shell out to system Python.
- **No LangChain, no LangGraph** — raw SDK calls only. New `tool_args_progress` emit lives in raw OpenAI / Anthropic SDK paths (already the case at threads.py:1601-1616 + anthropic_service.py:199-206).
- **Pydantic for structured LLM outputs** — `ThreadSnapshotResponse` is a Pydantic BaseModel, composing existing `MessageResponse` + `ActiveRunResponse` models in `backend/app/models/`.
- **RLS — users only see their own data** — `/snapshot` must dual `.eq("user_id")` per D-075-04 (defense-in-depth alongside RLS policies).
- **Stream chat responses via SSE** — `tool_args_progress` is a new SSE event type added to the existing SSE producer; no protocol change.
- **No blocking I/O in async handlers — wrap with `run_in_threadpool`** (D-v2.5-01) — `/snapshot` uses the existing `aexec(...)` helper that already wraps `supabase-py` calls; same pattern as `/messages` and `/active-runs`. `redis.exists()` and `redis.xinfo_stream()` are native async (redis-py 5.x async client), no wrapping needed.
- **Single uvicorn worker** (D-v2.5-02) — still authoritative pre-D-PRD-12. `/snapshot` is stateless (reads Postgres + Redis); no per-worker state to worry about. Phase 075 doesn't introduce multi-worker risk.
- **Realtime is a hint, not source of truth** (D-v2.5-03) — `/snapshot` IS the reconcile fetch that D-v2.5-03 demands. The atomic swap at StreamsProvider.tsx:478-485 satisfies the "always reconcile via fetch on (re)connect" half of that invariant via a single round-trip.
- **Schema changes ship as numbered SQL migrations** — Phase 075 has **NO migrations** (verified: every change is code-only).
- **Settings live in `user_settings`/`app_settings`** — n/a, no settings touched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `GET /threads/{id}/snapshot` endpoint | API / Backend (FastAPI) | Database (Postgres reads + Redis state probe) | Composite reconcile primitive; runs ownership SELECT + messages JOIN runs + per-active-run Redis stream probe. |
| `_enrich_messages_with_runs` helper extraction | API / Backend | — | Pure refactor inside threads.py module-private scope; no tier crossing. |
| BUG-260518-01 backend half (heartbeat-gap distinction) | API / Backend (SSE producer in runs.py) | Database (read `runs.status`) | runs.py:221-235 already in the consumer code path; needs to read recent `code_executing` event vs raw exists() probe. |
| BUG-260518-01 frontend half (reconcile-fetch on terminal) | Frontend (Browser, React/Provider) | API / Backend (snapshot call) | StreamsProvider.tsx:689-720 onTerminal handler issues a snapshot fetch before flipping `runStatus: "failed"`. |
| Sandbox line-by-line `code_stdout` rewire | API / Backend (threads.py sandbox branch) | — | Docker SDK exec stream → asyncio.Queue → existing `_emit` XADD path. No frontend change for the producer; existing `onCodeStdout` consumer already wired in api.ts:362-363. |
| Silent-window heartbeat | API / Backend (threads.py:2192-2200) | — | Pure timer logic inside the existing drain loop. |
| Bottom-indicator sticky text + code_stdout subscribe (BUG-260514-03) | Frontend (MessageItem.tsx, related hook) | — | Pure rendering / state-derivation; reads existing `runStatus` + new `code_stdout` events. |
| `tool_args_progress` SSE emit | API / Backend (threads.py:1601-1616 OpenAI; anthropic_service.py:199-206 Anthropic) | — | Pure producer-side add. Filter logic (skip execute_code + STRUCTURED) lives in the emit guard. |

## Standard Stack

### Core (already installed — versions verified via `backend/venv/Scripts/python.exe -c "import X; print(X.__version__)"`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | 0.115.6 | HTTP framework for `/snapshot` endpoint | [VERIFIED: installed in repo venv] Matches existing api/threads.py + api/runs.py endpoints. |
| `pydantic` | 2.12.5 | Response model validation | [VERIFIED: installed in repo venv] All existing response models use Pydantic v2. |
| `sse-starlette` | 2.4.1 | SSE response wrapping | [VERIFIED: installed in repo venv] D-074-12 invariant — version pin assertion at `test_059_disconnect.py:63-94` still holds. Phase 075 doesn't touch sse-starlette directly; new `tool_args_progress` event rides the same XADD → replay_tail_consumer → SSE wire path. |
| `redis` (redis-py async) | 5.3.1 | Async Redis client; `xinfo_stream` / `xrange` for `since_cursors` derivation | [VERIFIED: installed in repo venv] Phase 062's `redis.exists()` / `redis.xread()` use the same client; new endpoint uses the same `aioredis.Redis` dependency-injected via `get_redis()`. |
| `docker` (Docker SDK for Python) | 7.1.0 | Container.exec_run + low-level api.exec_create/exec_start | [VERIFIED: installed in repo venv] Already pulled in transitively by llm-sandbox; new code in Plan 02 imports either through `session.container` (Container instance) or `session.container_api` (DockerContainerAPI wrapper). |
| `llm-sandbox` | (no `__version__` attr) | InteractiveSandboxSession + DockerContainerAPI | [VERIFIED: installed at `~/site-packages/llm_sandbox/interactive.py` + `~/site-packages/llm_sandbox/docker.py`] Library lacks `__version__`; treat as a vendored dependency. |
| `httpx` | 0.28.1 | Integration test client (`AsyncClient` + `ASGITransport`) | [VERIFIED: installed in repo venv] Used by every existing test in `backend/tests/integration/`. |

### Supporting (test-side, already in repo)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pytest-asyncio` | (installed; see backend/requirements.txt) | Async test harness | All new tests use `@pytest.mark.asyncio` + `@pytest.mark.timeout(N)` per existing patterns. |
| `unittest.mock` (stdlib) | n/a | `patch`/`MagicMock` for supabase + suggestion_service patches | Mirrors `test_063_post_then_subscribe.py:66-75` 3-patch pattern verbatim. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `session.execute_command(cmd, on_stdout=...)` (high-level) | Raw `session.container.exec_run(cmd, stream=True, demux=True)` | High-level path is 1 line shorter, already does chunk decoding + per-chunk callback dispatch via `_process_stream_output` (mixins.py). Both produce identical wire behavior. CONTEXT.md grants either; **recommend high-level** because it composes with `verbose` / `encoding_errors` / etc. config knobs and survives future llm-sandbox upgrades better. |
| `xinfo_stream(f"run:{run_id}")` (full stream summary) | `xrange(f"run:{run_id}", "-", "+", count=1)` (one head entry) | See §Technical Approach #2 for full quantification. **Recommend xinfo_stream** — it's the dedicated XINFO STREAM command that returns `first-entry` (cursor of earliest still-available event) as a structured field. xrange works but loads the entire first entry's fields (`{"data": "...500 byte json..."}`) just to read its id. xinfo_stream returns the metadata cheaper. |
| New Pydantic model file `app/models/snapshot.py` | New class in existing `app/models/thread.py` | **Recommend co-locating** — `app/models/thread.py` already holds `ThreadCreate`/`ThreadUpdate`/`ThreadResponse`; `ThreadSnapshotResponse` belongs there as a sibling. Adding a new file would just be ceremony. |

**Installation:**

No new dependencies. Every package listed is already installed in `backend/venv`.

**Version verification:** All versions confirmed via direct `python -c "import X; print(X.__version__)"` runs against the actual project venv at `C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`. No npm registry queries needed — Phase 075 adds zero npm packages and zero pip packages.

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────────────────┐
                │  Browser (React)                                    │
                │                                                     │
                │   ChatArea ─→ StreamsProvider                       │
                │                  │                                  │
                │   useEffect      │  setViewingThread(threadId)      │
                │     thread.id ──→│  fires reconcile()               │
                │                  ▼                                  │
                │              reconcile(threadId) [tsx:478-485]      │
                │                  │                                  │
                │              ATOMIC SWAP                            │
                │                  ▼                                  │
                │              getSnapshot(threadId) ─── 1 round-trip │
                │                                                     │
                │              { messages,                            │
                │                active_runs,                         │
                │                since_cursors }                      │
                │                  │                                  │
                │      ┌───────────┼───────────┐                      │
                │      ▼           ▼           ▼                      │
                │  hydrate     reattach   populate                    │
                │  bucket      subscribeToRun   lastSeenOffsetRef     │
                │              with since=     [tsx:369 map]          │
                │              since_cursors[rid]                     │
                └──────────────────┬──────────────────────────────────┘
                                   │
                                   │   HTTPS / Bearer auth
                                   ▼
                ┌─────────────────────────────────────────────────────┐
                │  FastAPI Backend (single uvicorn worker)            │
                │                                                     │
                │   GET /threads/{tid}/snapshot                       │
                │                                                     │
                │   Step 1: ownership SELECT [maybe_single + 404]     │
                │   Step 2: messages SELECT + runs SELECT             │
                │   Step 3: _enrich_messages_with_runs (shared)       │
                │   Step 4: active_runs SELECT (status=streaming)     │
                │   Step 5: for each active_run:                      │
                │              xinfo_stream(f"run:{rid}")["first-entry"]
                │              → since_cursors[rid] = <id> or "0"     │
                │   Step 6: Redis-down → 503 + Retry-After:10         │
                │                                                     │
                │   Concurrent SSE producer (existing):               │
                │     • code_stdout per-line emit (NEW; Plan 02)      │
                │     • tool_args_progress every 5KB (NEW; Plan 03)   │
                │                                                     │
                │   Concurrent SSE consumer (existing, fix):          │
                │     • replay_tail_consumer (runs.py:221-235)        │
                │       heartbeat-gap probe (Plan 01 fix)             │
                └──────────┬──────────────────────────────┬───────────┘
                           │                              │
                           ▼                              ▼
                ┌──────────────────────┐         ┌──────────────────┐
                │  Postgres (Supabase) │         │  Redis Stream    │
                │   • threads          │         │   run:{run_id}   │
                │   • messages         │         │   (XADD producer │
                │   • runs             │         │    + XREAD       │
                │     (status: live)   │         │    consumer)     │
                └──────────────────────┘         └──────────────────┘
                                                          ▲
                                                          │ XADD
                                                          │
                ┌─────────────────────────────────────────┴───────────┐
                │  Docker (llm-sandbox container, execute_code only)  │
                │                                                     │
                │   session.execute_command(                          │
                │     "python -u /tmp/code.py",                       │
                │     on_stdout=lambda chunk: queue.put_nowait(...),  │
                │     on_stderr=lambda chunk: queue.put_nowait(...),  │
                │   )                                                 │
                │                                                     │
                │   → bytes chunks → line-buffer → per-line _emit     │
                │     code_stdout SSE events with captured_at         │
                └─────────────────────────────────────────────────────┘
```

### Recommended Project Structure (incremental — no new directories)

```
backend/app/
├── api/
│   └── threads.py            # +/snapshot endpoint, -post-completion stdout emit,
│                             #  +tool_args_progress emit in OpenAI delta handler
│   └── runs.py               # heartbeat-gap distinction in replay_tail_consumer
├── models/
│   └── thread.py             # +ThreadSnapshotResponse (composes existing models)
├── services/
│   └── anthropic_service.py  # +tool_args_progress yield in input_json_delta branch
└── tests/integration/
    ├── conftest.py           # (unchanged — autouse fixture already protects new tests)
    ├── test_075_snapshot.py            # NEW — Plan 01 ship gate
    ├── test_075_code_stdout_progressive.py  # NEW — Plan 02 ship gate
    └── test_075_tool_args_progress.py  # NEW — Plan 03 ship gate

frontend/src/
├── lib/
│   └── api.ts                # +getSnapshot helper; +buffer_expired_* → transient mapping
├── providers/
│   └── StreamsProvider.tsx   # atomic swap in reconcile; reconcile-fetch in onTerminal
└── components/chat/
    └── MessageItem.tsx       # sticky bottom-indicator text + code_stdout subscribe (BUG-260514-03)
```

### Pattern 1: Pydantic ThreadSnapshotResponse composition

**What:** New response model composing existing `MessageResponse` (with run_id + run_status already attached per D-063.1-15) and `ActiveRunResponse`, plus a `since_cursors: dict[str, str]` field.

**When to use:** GET /threads/{id}/snapshot only.

**Example:**

```python
# backend/app/models/thread.py (extension)
# Source: existing patterns in backend/app/models/{message,run,thread}.py

from app.models.message import MessageResponse
from app.models.run import ActiveRunResponse

class ThreadSnapshotResponse(BaseModel):
    """One-round-trip reconcile primitive (Phase 075 / SEED-008).

    Returns the three pieces of state the frontend needs on thread switch:
      - messages: full history with run_id + run_status already merged
        (same shape as GET /threads/{id}/messages — D-063.1-15).
      - active_runs: streaming runs the requesting user owns on this thread
        (same shape as GET /threads/{id}/active-runs — D-062-04).
      - since_cursors: per-active-run Redis stream replay starting points
        (D-075-01 — server-derived from XINFO STREAM first-entry id;
        '0' for unexpired fresh buffers, real earliest-available id for
        partially-trimmed buffers).
    """
    messages: list[MessageResponse]
    active_runs: list[ActiveRunResponse]
    since_cursors: dict[str, str]
```

### Pattern 2: `since_cursors` derivation via `xinfo_stream`

**What:** For each active run, probe the Redis stream's earliest-available entry id.

**When to use:** Inside `/snapshot` endpoint, AFTER active_runs SELECT, BEFORE the response build.

**Example:**

```python
# Source: redis-py async client v5.3.1 (verified)
# https://redis.io/commands/xinfo-stream/

since_cursors: dict[str, str] = {}
for run in active_runs:
    rid = str(run["run_id"])
    stream_key = f"run:{rid}"
    try:
        # xinfo_stream returns a dict-like response; "first-entry" is the
        # earliest still-available entry as a list [id, fields_dict].
        # For an unexpired fresh buffer, first-entry's id is the producer's
        # first XADD (cursor close to '0' — actually a millisecond-prefixed
        # id like "1731936000000-0"). For a partially-trimmed buffer (MAXLEN
        # cap hit), it's the oldest survivor.
        info = await asyncio.wait_for(
            redis.xinfo_stream(stream_key), timeout=2.0
        )
        first_entry = info.get("first-entry")
        if first_entry and len(first_entry) >= 1:
            # first_entry[0] is the entry id (bytes or str depending on
            # decode_responses setting; verify against the project's
            # aioredis.Redis configuration — see runs.py for the pattern).
            cursor = first_entry[0]
            since_cursors[rid] = cursor.decode() if isinstance(cursor, bytes) else cursor
        else:
            # Empty stream — shouldn't happen for an active run, but '0' is
            # the safe "replay everything" cursor that the consumer accepts.
            since_cursors[rid] = "0"
    except (RedisError, asyncio.TimeoutError, OSError):
        # D-075-04: Redis-down → 503 + Retry-After:10 for the WHOLE endpoint
        # (since_cursors requires Redis; no partial-degraded response shape).
        return JSONResponse(
            status_code=503,
            content={"detail": "Streaming infrastructure unavailable"},
            headers={"Retry-After": "10"},
        )
```

**Source:** Direct read of `~/site-packages/redis/commands/core.py::StreamCommands.xinfo_stream`:

```python
def xinfo_stream(self, name: KeyT, full: bool = False) -> ResponseT:
    """Returns general information about the stream. ..."""
    pieces = [name]
    options = {}
    if full:
        pieces.append(b"FULL")
        options = {"full": full}
    return self.execute_command("XINFO STREAM", *pieces, **options)
```

XINFO STREAM (without FULL) returns a 14-key associative array — for the cursor we only need `first-entry`. **Why prefer over `xrange(key, "-", "+", count=1)`:** xrange would also work and returns the same first-entry shape, but it returns the full `(id, fields)` tuple including the data payload (typically a 500-byte JSON envelope); xinfo_stream returns metadata only. Both round-trip costs are 1 RTT; on data-transfer cost xinfo_stream is cheaper.

### Pattern 3: Docker SDK exec_run via `session.execute_command`

**What:** Per D-075-05 + Discovery 2, the simplest path is the high-level llm_sandbox API which already streams via Docker's exec_run.

**When to use:** Inside the sandbox branch of threads.py (currently around lines 2155-2206) — replace the `loop.run_in_executor(None, _run_sync)` call that wraps `session.run(wrapped_code, on_stdout=..., on_stderr=...)`.

**Example:**

```python
# Source: llm_sandbox/docker.py:43-60 (DockerContainerAPI.execute_command)
# + llm_sandbox/core/mixins.py::_process_stream_output (chunk dispatch)
# Both verified by direct read in this research session.

# CRITICAL: child Python must run with -u or PYTHONUNBUFFERED=1
# (see §Common Pitfalls for the buffering trap).
import shlex

# Write code to a file inside the container, then exec python -u against it.
# (The current threads.py:2154 wraps with `import os; os.chdir(...)` — that
#  preamble migrates verbatim into the new file payload.)
code_file = f"/tmp/run-{uuid.uuid4().hex}.py"
session.execute_command(
    f"cat > {code_file} << '__EOF_PY__'\n{wrapped_code}\n__EOF_PY__"
)
# Alternatively: session.copy_to_runtime(local_tmp_path, code_file) — same effect.

def on_stdout(chunk: str):
    # chunk is a UTF-8-decoded string (decoded inside _process_stream_output
    # using config.encoding_errors). May be a partial line, multiple lines,
    # or even just a few bytes. Line-buffer in the queue consumer (see Pattern 5).
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "stdout_chunk", "content": chunk, "captured_at": time_mod.time()}
    )

def on_stderr(chunk: str):
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "stderr_chunk", "content": chunk, "captured_at": time_mod.time()}
    )

def _run_sync():
    # python -u forces unbuffered stdout/stderr — line-by-line output flushes
    # as the interpreter produces it, not held in BLOCK-buffered fwrites.
    result = session.execute_command(
        f"python -u {code_file}",
        on_stdout=on_stdout,
        on_stderr=on_stderr,
    )
    loop.call_soon_threadsafe(
        sandbox_queue.put_nowait,
        {"type": "_done", "result": result, "captured_at": time_mod.time()}
    )
    return result

fut = loop.run_in_executor(None, _run_sync)
# Drain loop (existing at threads.py:2186-2204) — modified per Pattern 5
# (line buffer + silent-window heartbeat per D-075-08).
```

**Why this works:** `~/site-packages/llm_sandbox/docker.py:43-60` shows `DockerContainerAPI.execute_command` calling `container.exec_run(cmd=..., stream=True, demux=True, tty=False, stdout=True, stderr=True)`. When callbacks are provided, `BaseSession.execute_command` at `docker.py:30-44` flips `effective_stream = True`, then `_process_stream_output` at `mixins.py` iterates the demux'd generator and dispatches each `(stdout_bytes, stderr_bytes)` tuple to the callbacks after UTF-8 decode.

### Pattern 4: tool_args_progress emit at OpenAI delta accumulator

**What:** Insert a 5KB-boundary check into the `tool_calls_buffer[idx]["arguments"] += tc.function.arguments` step.

**When to use:** Inside `_on_chunk_openai` at `threads.py:1601-1616`.

**Example:**

```python
# Source: threads.py:1601-1616 (verbatim insertion point)
# + reuse the existing _emit helper signature (XADD wrapper)

# Track per-tool boundary count. Lives in the closure adjacent to
# tool_calls_buffer / _announced_tools. Init at the same place:
#   tool_calls_buffer: dict[int, dict] = {}
#   _announced_tools: set[int] = set()
#   _tool_args_emit_boundary: dict[int, int] = {}   # NEW
# Phase 075 D-075-09/10/11.

# Inside the delta-tool_calls branch:
if tc.function and tc.function.arguments:
    tool_calls_buffer[idx]["arguments"] += tc.function.arguments
    # D-075-10: fire on every 5KB-accumulated boundary.
    # D-075-11: skip execute_code AND skip STRUCTURED calling_mode.
    _tool_name = tool_calls_buffer[idx]["name"]
    if (
        _tool_name != "execute_code"
        and calling_mode != CallingMode.STRUCTURED
    ):
        # Byte size of the cumulative accumulator (UTF-8).
        _bytes_total = len(tool_calls_buffer[idx]["arguments"].encode("utf-8"))
        _new_boundary = _bytes_total // 5120
        _last_boundary = _tool_args_emit_boundary.get(idx, 0)
        if _new_boundary > _last_boundary:
            _tool_args_emit_boundary[idx] = _new_boundary
            # D-075-09: args_so_far is the LAST 5 KB of the accumulator;
            # UTF-8-aware slice avoids invalid trailing codepoint bytes.
            _tail_bytes = tool_calls_buffer[idx]["arguments"].encode("utf-8")[-5120:]
            _args_so_far = _tail_bytes.decode("utf-8", errors="ignore")
            await _emit(
                redis, run_id, "tool_args_progress",
                tool_index=idx,
                name=_tool_name,
                args_so_far=_args_so_far,
                total_args_bytes_so_far=_bytes_total,
            )
```

The Anthropic-path equivalent lives at `anthropic_service.py:204-206`:

```python
elif delta.type == "input_json_delta":
    if event.index in tool_blocks:
        tool_blocks[event.index]["arguments"] += delta.partial_json
        # D-075-10 emit guard goes here. But anthropic_service is a generator
        # that yields events for the caller to dispatch — it does NOT have
        # the Redis handle directly. Pattern: yield a new event shape
        # {"type": "tool_args_progress", ...} from anthropic_service.py;
        # caller in threads.py (the agent loop) routes it to _emit just like
        # it does for "tool_preparing" / "tool_start" today.
```

The Anthropic generator yields normalized events (not direct XADDs); see `_on_chunk_anthropic` in `threads.py` for the existing dispatch pattern. New `"type": "tool_args_progress"` event joins the existing dispatch table.

### Pattern 5: Line-buffering Docker stdout stream

**What:** Docker exec_run streams bytes (or decoded strings via llm_sandbox) in arbitrary-size chunks. To emit per-line code_stdout events, maintain a partial-line accumulator.

**When to use:** In the sandbox_queue drain loop at `threads.py:2186-2204`, when item type is `stdout_chunk` / `stderr_chunk`.

**Algorithm:**

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
        # D-075-07: flush any trailing partial line before terminal.
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
        # Reset silent-window clock first (D-075-08).
        _last_output_at = item["captured_at"]
        # Accumulate, split on \n, emit complete lines, retain trailing partial.
        # Normalize CRLF → LF before split so Windows-style line endings don't
        # leak as bare '\r' into the SSE payload.
        combined = (_stdout_partial + item["content"]).replace("\r\n", "\n")
        lines = combined.split("\n")
        _stdout_partial = lines.pop()   # always at least one element — the trailing partial (may be "")
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

**UTF-8 decoding note:** `_process_stream_output` (mixins.py) already decodes via `chunk.decode("utf-8", errors=self.config.encoding_errors)` before calling on_stdout/on_stderr. The callback receives a `str`, not `bytes`. The `encoding_errors` config defaults to `"strict"` (see `SandboxDockerSession.__init__`'s `encoding_errors: EncodingErrorsType = "strict"`); the current sandbox session in `sandbox_service.py:30` doesn't override this. Decision: leave at `"strict"` (preserves the current behavior — UTF-8 garbage in stdout will raise, which would surface as a clear error rather than silently corrupting the SSE wire). If user code emits raw bytes (`sys.stdout.buffer.write(...)` with non-UTF-8), this currently raises; that behavior is preserved.

### Pattern 6: Frontend atomic swap in reconcile

**What:** Replace the `Promise.all([getActiveRuns, loadMessages])` parallel call at `StreamsProvider.tsx:482-485` with a single `getSnapshot(threadId)` call.

**When to use:** D-075-02 — sole reconcile site (only).

**Example:**

```typescript
// frontend/src/lib/api.ts (add new helper alongside existing getActiveRuns / getMessages)
export interface ThreadSnapshot {
  messages: Message[]            // mapped from MessageResponse[] — same shape as getMessages return
  active_runs: ActiveRun[]       // same shape as getActiveRuns return
  since_cursors: Record<string, string>
}

export async function getSnapshot(
  threadId: string,
  signal?: AbortSignal,
): Promise<ThreadSnapshot> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/snapshot`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to fetch snapshot (status ${res.status})`)
  // Reuse the same snake → camel mapping logic getMessages uses for run_id/run_status
  // (api.ts:67-100). Recommend extracting that mapper as a module-private function
  // _mapMessageResponse so getMessages and getSnapshot share it byte-identically.
  const data = await res.json()
  return {
    messages: (data.messages as MessageResponseDTO[]).map(_mapMessageResponse),
    active_runs: data.active_runs as ActiveRun[],
    since_cursors: data.since_cursors as Record<string, string>,
  }
}

// frontend/src/providers/StreamsProvider.tsx (reconcile body, lines 478-485)
reconcile: async (threadId, surfaceId = "chat") => {
  if (reconcileInFlightRef.current) return
  reconcileInFlightRef.current = true
  try {
    let snapshot: ThreadSnapshot
    try {
      // ATOMIC SWAP (D-075-02): one round-trip replaces the Promise.all chain.
      snapshot = await getSnapshot(threadId)
    } catch (err) {
      console.error("reconcile failed:", err)
      return
    }

    // Hydrate messages bucket — same setMessagesForBucket pattern as the
    // pre-swap loadMessages used (it called setMessagesForBucket with the
    // mapped Message[]; getSnapshot returns the same shape).
    useStreamsStore.getState().actions.setMessagesForBucket(
      surfaceId, threadId, () => snapshot.messages
    )

    // D-075-01: seed lastSeenOffsetRef from server cursors (first attach only —
    // existing entries from a prior subscribe win on subsequent reconciles).
    for (const [rid, cursor] of Object.entries(snapshot.since_cursors)) {
      if (!lastSeenOffsetRef.current.has(rid)) {
        lastSeenOffsetRef.current.set(rid, cursor)
      }
    }

    // Existing per-run reattach loop (StreamsProvider.tsx:492-601) — unchanged.
    // subscribeToRun call at :574-579 already reads from lastSeenOffsetRef:
    //   subscribeToRun(run.run_id, lastSeenOffsetRef.current.get(run.run_id) ?? "0", ...)
    // — so the cursor seeded above flows through unchanged.
    for (const run of snapshot.active_runs) {
      // ... (existing reattach logic preserved verbatim) ...
    }
  } finally {
    reconcileInFlightRef.current = false
  }
}
```

### Anti-Patterns to Avoid

- **Adding a feature flag for the atomic swap.** D-075-02 explicitly rejects this. The dual-call posture is a faster reconcile, not a behavioral change; a flag adds complexity without benefit.
- **Calling `session.run()` and `session.execute_command()` in parallel for the same execute_code call.** The IPython runtime owns `session.run()`; running a shell exec alongside it for the same code would either duplicate execution or race the runner's poll loop. D-075-05's "bypass session.run() entirely for execute_code" means replace, not augment.
- **Batching `code_stdout` events.** D-075-06 rejects this. Trust Redis Stream backpressure + the run buffer's TTL.
- **Allowing `python` (not `python -u`) inside the sandbox child.** Python defaults to block-buffered stdout when stdout isn't a TTY (Docker exec without tty=True). Without `-u` or `PYTHONUNBUFFERED=1`, the SC #2 5-step printer flushes once at process exit — not 5 distinct events.
- **Emitting `tool_args_progress` during `STRUCTURED` calling mode.** D-075-11. In STRUCTURED mode args arrive at `finish_reason` parse time (threads.py:1633-1654), not as deltas — there's no accumulator to walk.
- **Treating the post-completion stdout/stderr loop at threads.py:2213-2218 as optional.** D-075-07 says DELETE. With mid-flight emit owning every line, the post-completion loop double-emits and breaks the SC #2 "no duplicate at completion" assertion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker exec streaming + chunk decoding + per-chunk callback dispatch | Custom Docker SDK `exec_create + exec_start` + manual demux frame parsing | `session.execute_command(cmd, on_stdout=..., on_stderr=...)` | Already implemented in llm_sandbox/docker.py:43-60 + mixins.py::_process_stream_output. Library handles UTF-8 decode, demux unpack, generator iteration, exception trapping. Reaching for raw Docker SDK reinvents 60 lines of working code. |
| SSE wire format / replay-tail consumer | Custom HTTP streaming response + manual SSE framing | Existing `_emit(redis, run_id, type, **fields)` XADD wrapper + replay_tail_consumer | Phase 062 D-062-05 invariant — wire format byte-identical to legacy POST-stream; sse-starlette 2.4.1 pin handles the SSE envelope. New events (`tool_args_progress`, mid-flight `code_stdout`) ride the same pipe. |
| Redis stream first-entry detection | Custom XLEN + XREAD probe | `redis.xinfo_stream(stream_key)` reading `first-entry` | Dedicated XINFO STREAM command returns metadata in one round-trip; xrange or xread+count=1 also work but transfer data we don't need. |
| Postgres-to-Pydantic snake_case → camelCase mapping | New API client wrapper for snapshot | Reuse existing `getMessages` mapping logic (api.ts:67-100) extracted as a private `_mapMessageResponse` helper | The map already exists, already converts `run_id` → `runId`, `source_refs` → `citations`, etc. Reimplementing it for snapshot would drift. |
| Line-buffering raw bytes from Docker | Per-byte state machine | `partial + chunk; lines = combined.split("\n"); partial = lines.pop()` | 4-line idiom; see Pattern 5. Don't over-engineer — Docker's chunk granularity is typically small (KB at most) and the partial-line buffer is bounded by line length. |

**Key insight:** Phase 075 is composition, not invention. Every primitive needed (XADD emit, SSE consumer, ownership SELECT, Pydantic response models, frontend SSE parser, message-mapping helper, sandbox session lifecycle) already exists. The phase reorganizes existing primitives into a new endpoint + a swapped sandbox-output producer + a new SSE event type.

## Common Pitfalls

### Pitfall 1: Python stdout block-buffering inside Docker

**What goes wrong:** SC #2 test asserts ≥3 distinct `code_stdout` events from `for i in range(5): print(i); time.sleep(1)`. With default Python invocation (`python /tmp/code.py` or `session.run(code)`), CPython detects stdout is not a TTY and switches to block-buffered output. All 5 prints accumulate in a single block flushed at process exit — yielding 1 chunk (or 0-2 chunks depending on block size), not 5 distinct events.

**Why it happens:** CPython's `Py_Main` checks `isatty(STDOUT_FILENO)`. Docker exec_run with `tty=False` (the default and what `DockerContainerAPI.execute_command` uses at docker.py:54) provides a pipe, not a TTY → block-buffered.

**How to avoid:** Always invoke Python with `-u` flag (`python -u /tmp/code.py`) OR set `PYTHONUNBUFFERED=1` in the exec environment. Either forces unbuffered stdout/stderr. Recommended: `-u` flag is explicit at the call site; env-var requires inspecting the container's env.

**Warning signs:** SC #2 test passes locally only because of latent buffering effects (stdout flushes when buffer fills, ~4KB on Linux); fails reliably when range(5) is replaced with shorter sleep or smaller per-print payload.

**Verification path for the planner:** Plan 02 task verifying SC #2 should include an explicit grep: `grep -n "python -u" backend/app/api/threads.py` returns ≥1 hit in the sandbox branch.

### Pitfall 2: redis-py response decoding (`decode_responses` setting)

**What goes wrong:** `xinfo_stream` returns entries with id fields. If the Redis client is configured with `decode_responses=False` (the default for `aioredis.Redis()`), id values come back as `bytes`. Storing them in a `dict[str, str]` Pydantic field raises ValidationError.

**Why it happens:** redis-py's async client returns raw bytes unless `decode_responses=True` is passed at client init.

**How to avoid:** Check the project's Redis client init (likely in `app/dependencies.py` `get_redis`). If `decode_responses=False`, the snapshot endpoint must `.decode()` cursor bytes before storing:

```python
cursor = first_entry[0]
since_cursors[rid] = cursor.decode() if isinstance(cursor, bytes) else cursor
```

Pattern 2 above already does this defensively.

**Warning signs:** Integration test for snapshot endpoint fails with `pydantic.ValidationError: since_cursors -> {run_id}: Input should be a valid string [type=string_type, input_value=b'1731936000000-0', input_type=bytes]`.

### Pitfall 3: Tool index conflict in `_tool_args_emit_boundary`

**What goes wrong:** OpenAI streams multiple parallel tool_calls in the same response (e.g., model decides to call 3 tools simultaneously). Each tool has its own `tc.index` (0, 1, 2 …). If `_tool_args_emit_boundary` is keyed by `idx` and reused across iterations, boundary tracking leaks across rounds.

**Why it happens:** The agent loop iterates multiple LLM calls per user message (one per tool-call round). `tool_calls_buffer` resets each iteration at threads.py:1500-ish (start of each iteration). `_tool_args_emit_boundary` must reset at the same place.

**How to avoid:** Initialize `_tool_args_emit_boundary: dict[int, int] = {}` in the SAME init block as `tool_calls_buffer` / `_announced_tools` — typically at start of each agent-loop iteration. Verify by grepping for `tool_calls_buffer = {}` and locating the same pattern.

### Pitfall 4: `_enrich_messages_with_runs` async signature drift

**What goes wrong:** Extracting the runs-FK merge logic from get_messages into a shared helper changes the call signature; both call sites (existing `/messages` and new `/snapshot`) must call it identically.

**Why it happens:** Python doesn't enforce that two call sites pass identical arguments. The helper's parameter order + naming must be exact.

**How to avoid:** Pin the signature in the helper docstring and assert via a unit test that both call sites use kwargs (not positional):

```python
async def _enrich_messages_with_runs(
    messages: list[dict],
    *,
    thread_id: str,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """D-075-03: shared runs-FK merge for /messages and /snapshot."""
    # ... body extracted from threads.py:795-816 verbatim ...
```

The `*` enforces keyword-only args; positional-call regressions fail at the call site, not silently in production.

### Pitfall 5: Resume button race during BUG-260518-01 fix

**What goes wrong:** The frontend onTerminal handler (StreamsProvider.tsx:689-720) currently flips `runStatus: "failed"` synchronously on `kind === "error"`. The fix wants to call `getSnapshot(threadId)` first and only flip if the snapshot confirms terminal state. But the snapshot call is async — during the await window, the user could click Resume on the still-rendering (stale) UI.

**Why it happens:** React state updates aren't synchronous; the UI renders the previous (streaming) state until the snapshot returns. If the snapshot says "still streaming," the desired behavior is "don't flip to failed" — but the existing finalization (`setIsStreaming(false)`) may have already fired.

**How to avoid:** Don't flip `isStreaming: false` until the snapshot confirms. Two-step pattern:

```typescript
callbacks.onTerminal = async (kind, errorPayload) => {
  if (kind === "error" && errorPayload?.startsWith("buffer_expired")) {
    // Transient — try snapshot first.
    const snapshot = await getSnapshot(threadId).catch(() => null)
    const stillActive = snapshot?.active_runs.some(r => r.run_id === run.run_id)
    if (stillActive) {
      // Re-attach SSE from the snapshot's cursor; don't flip runStatus.
      // (Reuse existing reattach branch.)
      return
    }
  }
  // Existing behavior preserved for all other terminal kinds.
  // (Body unchanged from current StreamsProvider.tsx:689-720.)
}
```

**Warning signs:** Live UAT shows Resume button flickers visible for ~200ms before disappearing — sign that the flip happened then the snapshot reverted. Acceptable but ugly; aim for "never flips at all when still active."

### Pitfall 6: `useMessages.ts:572-590` references are stale post-Phase-068

**What goes wrong:** CONTEXT.md canonical_refs sections cite "useMessages.ts:572-590 — PRESERVE VERBATIM". Post-Phase 068 lift, `useMessages.ts` is 89 lines total — there is no line 572. Acceptance-criterion greps against that path return zero hits.

**Why it happens:** Phase 068 STREAMS-PROVIDER-01 lifted the streaming-bucket guard into `StreamsProvider.tsx` (line 419-435 in `clearThreadBucket` action). The "verbatim preservation" intent still applies — but to the lifted location, not the original.

**How to avoid:** Plan 01 acceptance criterion must reference `frontend/src/providers/StreamsProvider.tsx:419-435` (the predicate `tid && tid !== streamingThreadIdRef.current`), not the obsolete useMessages.ts:572-590 path. Verify-only command: `grep -n "tid !== streamingThreadIdRef.current" frontend/src/providers/StreamsProvider.tsx` returns line 421.

### Pitfall 7: `code_executing` heartbeat regression (SC #4)

**What goes wrong:** SC #4 invariant: "Existing `code_executing` heartbeat is preserved — code_stdout re-wire is additive." If the silent-window logic (D-075-08) inadvertently disables the heartbeat for chatty workloads, a slow Anthropic-driven multi-step skill could miss heartbeats and trigger BUG-260518-01-style false Resume.

**Why it happens:** Resetting `_last_output_at` inside the heartbeat emit (instead of only on stdout/stderr) creates a deadlock — silent-window check never fires because the timer keeps getting reset by the heartbeat itself.

**How to avoid:** `_last_output_at` is **only** updated by stdout_chunk + stderr_chunk handlers, NEVER by the heartbeat. Pattern 5 above shows the correct flow.

**Warning signs:** Long matplotlib renders (60s+ silent window) show zero `code_executing` events in the SSE wire — heartbeat machinery jammed.

## Runtime State Inventory

Not applicable — Phase 075 is a code-only change (no migrations, no string renames, no schema touches). Verification:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema changes per CONTEXT.md. | None. |
| Live service config | None — no n8n / Datadog / Tailscale touchpoints in scope. | None. |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2 changes. | None. |
| Secrets/env vars | None — no new secrets; no .env changes. | None. |
| Build artifacts | None — no package renames; no .egg-info / dist artifacts at risk. | None. |

## Code Examples

### Snapshot endpoint full body (skeleton — verified by composing existing patterns)

```python
# backend/app/api/threads.py — new endpoint, slot location TBD by planner
# (recommend grouping with the other /threads/{tid}/... endpoints around line 510).

@router.get("/{thread_id}/snapshot", response_model=ThreadSnapshotResponse)
async def get_snapshot(
    thread_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """D-075-01: one-round-trip reconcile primitive. Returns {messages,
    active_runs, since_cursors} so the frontend's StreamsProvider.reconcile
    can replace its 3-call sequential chain (/messages + /active-runs +
    /runs/{rid}/stream?since=) with a single fetch.

    Auth posture mirrors GET /messages + GET /active-runs exactly (D-075-04):
      - dual .eq("user_id") (defense-in-depth alongside RLS).
      - cross-user → 404 not 403 (T-062-01 — don't leak resource existence).
      - Redis-down → 503 + Retry-After: 10 (D-062-13 mirror).
    """
    # Step 1: ownership SELECT (CR-01: maybe_single avoids PGRST116 → 500 leak)
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", str(thread_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    if not (thread_resp.data if thread_resp is not None else None):
        raise HTTPException(status_code=404, detail="Thread not found")

    # Step 2: messages SELECT + runs SELECT + merge (extracted helper).
    msgs_resp = await aexec(
        supabase.table("messages")
        .select("*")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .order("created_at")
    )
    messages = msgs_resp.data or []
    messages = await _enrich_messages_with_runs(
        messages,
        thread_id=str(thread_id),
        user_id=current_user["id"],
        supabase=supabase,
    )

    # Step 3: active_runs SELECT (mirror of /active-runs at threads.py:543-551).
    runs_resp = await aexec(
        supabase.table("runs")
        .select("run_id, started_at, status")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .eq("status", "streaming")
        .order("started_at", desc=True)
    )
    active_runs = runs_resp.data or []

    # Step 4: per-active-run since_cursors via xinfo_stream (D-075-01).
    since_cursors: dict[str, str] = {}
    for run in active_runs:
        rid = str(run["run_id"])
        try:
            info = await asyncio.wait_for(
                redis.xinfo_stream(f"run:{rid}"),
                timeout=2.0,
            )
            first_entry = info.get("first-entry") if info else None
            if first_entry and len(first_entry) >= 1:
                cursor = first_entry[0]
                since_cursors[rid] = (
                    cursor.decode() if isinstance(cursor, bytes) else cursor
                )
            else:
                since_cursors[rid] = "0"
        except (RedisError, asyncio.TimeoutError, OSError):
            # D-075-04: Redis-down → 503 + Retry-After:10 for the whole endpoint.
            logger.exception("Redis unreachable on GET /threads/%s/snapshot", thread_id)
            return JSONResponse(
                status_code=503,
                content={"detail": "Streaming infrastructure unavailable"},
                headers={"Retry-After": "10"},
            )

    return {
        "messages": messages,
        "active_runs": active_runs,
        "since_cursors": since_cursors,
    }
```

### Plan 03 emit test scaffold (verified via existing test patterns)

```python
# backend/tests/integration/test_075_tool_args_progress.py — Plan 03 ship gate

import json, pytest
from uuid import uuid4
from unittest.mock import patch
import httpx
from httpx import ASGITransport

from app.api.threads import TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import _build_mock_supabase
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401

THREAD_A = str(uuid4())

def _slow_chunks_with_big_args():
    """Yield OpenAI-shaped chunks with a tool_call whose arguments
    accumulate past 5KB in 1KB delta chunks (so the 5KB boundary fires
    cleanly). Tool name is 'analyze_document' (NOT execute_code → filter
    must NOT skip)."""
    # Tool announce chunk (tool_preparing trigger).
    yield _make_openai_chunk(tool_calls=[{
        "index": 0,
        "id": "call_abc",
        "function": {"name": "analyze_document", "arguments": ""},
    }])
    # 8 × 1KB delta chunks — total 8 KB → boundaries at 5 KB and 10 KB.
    # Wait, 8 KB only crosses the 5 KB boundary once. To assert ≥2 emits
    # we need ≥10 KB total — 12 chunks of 1 KB each crosses 5 / 10 KB.
    for _ in range(12):
        yield _make_openai_chunk(tool_calls=[{
            "index": 0,
            "function": {"arguments": "x" * 1024},  # 1024 bytes each
        }])
    # finish_reason='tool_calls' triggers parsing.
    yield _make_openai_chunk(finish_reason="tool_calls")


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_tool_args_progress_fires_on_5kb_boundary(redis_client):
    """D-075-09/10: tool_args_progress emits at every 5KB cumulative boundary
    for non-execute_code tools in NATIVE mode."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks_with_big_args()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "analyze the doc please"},
                )
                run_id = resp.json()["run_id"]
                # ... (mock runs SELECT for /stream ownership) ...
                events = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            events.append(json.loads(line[6:]))
                            if events[-1].get("type") in TERMINAL_TYPES:
                                break

        progress_events = [e for e in events if e.get("type") == "tool_args_progress"]
        assert len(progress_events) >= 2, (
            f"Expected ≥2 tool_args_progress emits at 5KB + 10KB; "
            f"got {len(progress_events)}: {progress_events}"
        )
        # Monotonic total_args_bytes_so_far
        totals = [e["total_args_bytes_so_far"] for e in progress_events]
        assert totals == sorted(totals), f"Non-monotonic totals: {totals}"
        # args_so_far ≤ 5120 bytes per event
        for e in progress_events:
            assert len(e["args_so_far"].encode("utf-8")) <= 5120
        # All progress events fire BEFORE tool_start.
        first_tool_start_idx = next(
            (i for i, e in enumerate(events) if e.get("type") == "tool_start"), len(events)
        )
        last_progress_idx = max(
            (i for i, e in enumerate(events) if e.get("type") == "tool_args_progress"), default=-1
        )
        assert last_progress_idx < first_tool_start_idx, (
            "tool_args_progress fired AFTER tool_start — event ordering broken"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_tool_args_progress_skipped_for_execute_code(redis_client):
    """D-075-11: execute_code MUST NOT emit tool_args_progress. Same big-args
    chunks but tool name flipped."""
    # ... (same scaffolding, swap tool name to "execute_code") ...
    progress_events = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress_events == [], (
        f"execute_code MUST NOT emit tool_args_progress; got {progress_events}"
    )
```

## Architecture Patterns from Past Phases (Reuse Verbatim)

| Pattern | Origin | Reuse In Plan 075 |
|---------|--------|-------------------|
| `maybe_single()` not `single()` for ownership SELECT | Phase 062 CR-01 (`runs.py:347-352`) | Snapshot endpoint Step 1. |
| Dual `.eq("user_id")` defense-in-depth | Phase 062 D-062-12 (`threads.py:524-547`, `runs.py:342-352`) | Snapshot Steps 1 + 3. |
| Cross-user → 404 not 403 | Phase 062 T-062-01 | Snapshot Step 1. |
| Redis probe with `asyncio.wait_for(timeout=2.0)` + 503+Retry-After:10 fallback | Phase 062 D-062-13 (`runs.py:354-370`) | Snapshot Step 4. |
| `_reset_redis_singleton` autouse fixture | Phase 074 D-074-11 (`tests/integration/conftest.py`) | All three new test files (auto-inherits). |
| POST→GET-stream test pattern with mock_supabase | Phase 063 (`test_063_post_then_subscribe.py`) | test_075_snapshot.py + test_075_tool_args_progress.py. |
| Runs-FK merge in `get_messages` (`threads.py:795-816`) | Phase 063.1 D-063.1-13 | Extract as `_enrich_messages_with_runs`; both endpoints call it (D-075-03). |
| `code_executing` 1-Hz heartbeat | Phase 067.4 D-067.4-R5-01 (`threads.py:2192-2200`) | Plan 02 silent-window guard (D-075-08) — only adds `_last_output_at` reset; cadence + emit body preserved. |
| Identifier-only log format strings | Phase 073 T-073-04 / Phase 074 D-074-03 | Any new logger lines in `/snapshot` or tool_args_progress emit. |
| `_emit(redis, run_id, type, **fields)` XADD wrapper | Phase 061 D-061-04 | New SSE event types `tool_args_progress` + per-line `code_stdout` ride it unchanged. |
| sse-starlette 2.4.1 pin invariant | Phase 074 D-074-12 (`test_059_disconnect.py:63-94`) | Preserved — Phase 075 doesn't touch sse-starlette. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-call sequential reconcile chain on thread switch | One-round-trip `/snapshot` | Phase 075 | ≥50% latency cut on cold cache (SC #1). |
| Post-completion stdout/stderr block dump | Mid-flight per-line emit during execution | Phase 075 | Real-time UX for SC #2; bottom-indicator updates as code runs (BUG-260514-03 closure). |
| `session.run()` for execute_code | `session.execute_command("python -u ...", on_stdout=...)` | Phase 075 | Streaming becomes possible; loses persistent IPython interpreter state (acceptable — current code already wraps with chdir preamble, doesn't rely on cross-cell state). |
| Silent gap → `buffer_expired_during_tail` → "failed" runStatus | `runs.py:221-235` distinguishes heartbeat-gap; frontend reconcile-fetches before flipping | Phase 075 | BUG-260518-01 closure. |
| `code_executing` heartbeat fires fixed 1Hz | Heartbeat fires only during silent windows (>1s no output) | Phase 075 | Cleaner SSE wire on chatty execution; preserved 1-Hz fire on silent windows + 10s keepalive cadence. |

**Deprecated/outdated:**

- **CONTEXT.md "useMessages.ts:572-590 — preserve verbatim"** — line range is stale; actual location post-Phase 068 is StreamsProvider.tsx:419-435.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest with pytest-asyncio (Python); vitest (frontend) |
| Config file | `backend/pytest.ini` (exists per prior phases) / `frontend/vitest.config.ts` |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/integration/test_075_*.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| POLISH-SEED-008-01 | `/snapshot` returns valid shape | unit/integration | `pytest tests/integration/test_075_snapshot.py::test_snapshot_returns_messages_active_runs_cursors -x` | ❌ Wave 0 |
| POLISH-SEED-008-01 | Cross-user → 404 no leak | integration | `pytest tests/integration/test_075_snapshot.py::test_cross_user_returns_404 -x` | ❌ Wave 0 |
| POLISH-SEED-008-01 | Redis-down → 503 + Retry-After | integration | `pytest tests/integration/test_075_snapshot.py::test_redis_down_returns_503 -x` | ❌ Wave 0 |
| POLISH-SEED-008-01 | `_enrich_messages_with_runs` regression — existing /messages still green | integration | `pytest tests/integration/test_063_1_messages_runs_join.py -x` | ✅ exists |
| POLISH-SEED-008-01 (SC #1) | Cold-cache latency reduction ≥50% | manual (Chrome MCP) | `performance_start_trace → reload → performance_stop_trace` | manual |
| POLISH-SEED-008-01 (BUG-260518-01) | Resume button stays hidden during long sandbox run | manual (Chrome MCP UAT) | Drive long sandbox cell at `http://localhost:5173/` | manual |
| POLISH-SEED-008-02 | 5-step printer produces ≥3 distinct events ≥1s apart | integration (real sandbox) | `pytest tests/integration/test_075_code_stdout_progressive.py -x` | ❌ Wave 0 |
| POLISH-SEED-008-02 | Monotonic `captured_at` per event | integration | (same file, separate assertion) | ❌ Wave 0 |
| POLISH-SEED-008-02 | No duplicate emit at completion | integration | (same file, separate assertion) | ❌ Wave 0 |
| POLISH-SEED-008-02 (SC #4) | `code_executing` heartbeat preserved on silent-only workload | integration | `pytest tests/integration/test_075_code_stdout_progressive.py::test_silent_workload_emits_heartbeat -x` | ❌ Wave 0 |
| POLISH-SEED-008-02 (BUG-260514-03) | Bottom indicator stays animated during silent windows | manual (Chrome MCP UAT) | Long pptx cell screenshot at t=30s/60s/120s | manual |
| POLISH-TOOL-PROG-01 | ≥2 progress events at 5KB / 10KB boundaries | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_fires_on_5kb_boundary -x` | ❌ Wave 0 |
| POLISH-TOOL-PROG-01 | `args_so_far` ≤ 5120 bytes per event | integration | (same file) | ❌ Wave 0 |
| POLISH-TOOL-PROG-01 | Monotonic `total_args_bytes_so_far` | integration | (same file) | ❌ Wave 0 |
| POLISH-TOOL-PROG-01 | execute_code skipped | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_skipped_for_execute_code -x` | ❌ Wave 0 |
| POLISH-TOOL-PROG-01 | STRUCTURED mode skipped | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_skipped_in_structured_mode -x` | ❌ Wave 0 |
| POLISH-TOOL-PROG-01 (Anthropic path) | input_json_delta accumulator emits boundary events | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_anthropic_path_emits_on_boundary -x` | ❌ Wave 0 |
| POLISH-SEED-008-02 (frontend) | Existing tests stay green post-StreamsProvider edit | unit | `cd frontend && npm run test -- StreamsProvider.test.tsx` | ✅ existing tests |

### Sampling Rate

- **Per task commit:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_075_*.py -x -q` (3 files, ~10-15 tests total; <30s).
- **Per wave merge:** `cd backend && venv/Scripts/python -m pytest tests/ -q` (full backend suite; ~3-5 min).
- **Phase gate:** Full suite green + 3 Chrome MCP UAT scenarios green (SC #1 latency timing, BUG-260518-01 closure, BUG-260514-03 closure) + Anthropic-path tool_args_progress live UAT.

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_075_snapshot.py` — covers POLISH-SEED-008-01 backend half + BUG-260518-01 backend half
- [ ] `backend/tests/integration/test_075_code_stdout_progressive.py` — covers POLISH-SEED-008-02 + SC #4 invariant
- [ ] `backend/tests/integration/test_075_tool_args_progress.py` — covers POLISH-TOOL-PROG-01
- [ ] Framework install: none — pytest, pytest-asyncio, httpx, ASGITransport all already installed in `backend/venv`.

### Validation Dimensions Coverage for the 4 SCs

| SC # | Dimension | Coverage Method |
|------|-----------|-----------------|
| #1 (latency ≥50% reduction) | **Performance / timing** | Chrome DevTools MCP `performance_start_trace` / `_stop_trace` comparison before/after cutover. Integration test alone cannot measure perceived latency. |
| #1 (correctness) | **Correctness / shape** | Integration test on `/snapshot` response shape + auth posture (3 sub-tests). |
| #1 (regression — `_enrich_messages_with_runs` extraction) | **Regression** | Existing `test_063_1_messages_runs_join.py` MUST stay green (specifies the helper's exact behavior). |
| #1 (BUG-260518-01 closure) | **Integration + manual UAT** | Chrome MCP UAT against >30s sandbox cell — Resume button MUST stay hidden. |
| #2 (5-step printer ≥3 events ≥1s) | **Integration (real sandbox)** | New test must drive a real Docker container — pytest fixtures launch sandbox manager. Real-sandbox tests already exist in the suite (test_065_*); pattern is verified. |
| #2 (monotonic captured_at) | **Correctness** | (same file, separate assertion) |
| #2 (no duplicate emit) | **Correctness / regression** | (same file) |
| #2 (BUG-260514-03 closure) | **Manual UAT** | Chrome MCP screenshot at t=30s/60s/120s during long pptx generation. |
| #3 (tool_args_progress 5KB boundary) | **Integration** | Mock OpenAI/Anthropic deltas with big_args payload; assert event count + payload shape. |
| #3 (execute_code skipped) | **Negative-assertion integration** | Same scaffold, name="execute_code"; assert zero progress events. |
| #3 (STRUCTURED skipped) | **Negative-assertion integration** | Calling_mode = STRUCTURED branch; assert zero progress events. |
| #4 (heartbeat preserved) | **Regression / integration** | Silent-only workload (`time.sleep(5)` no prints) — assert ≥4 `code_executing` events in the 5s window. |

## Security Domain

Security enforcement is enabled by default (no `security_enforcement: false` in config.json). Phase 075 touches RLS-sensitive surfaces (a new ownership-checked endpoint + a producer change in the sandbox branch + an SSE event emit).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `get_current_user` dependency — unchanged. |
| V3 Session Management | no | Stateless JWT-bearer; no session affinity introduced. |
| V4 Access Control | yes | Dual `.eq("user_id")` on `/snapshot` + cross-user → 404 (D-075-04 + T-062-01). |
| V5 Input Validation | yes | `thread_id: UUID` Pydantic-validated; Redis `xinfo_stream` arg is server-derived f"run:{rid}" (no user-injectable path). |
| V6 Cryptography | no | No new crypto; existing Supabase Auth JWT verification unchanged. |
| V7 Errors & Logging | yes | T-073-04 / D-074-03 identifier-only log format — any new `logger.info/warning/exception` in /snapshot OR the tool_args_progress emit MUST use `%s`/`%d` identifiers, never log full args content. |

### Known Threat Patterns for FastAPI / Redis / Docker SDK stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user IDOR on /snapshot (T-062-01 mirror) | Information Disclosure | 404 not 403 on ownership-miss; ownership SELECT FIRST before any runs / messages SELECT (T-063.1-01 mirror). |
| Args content leak via `tool_args_progress` log lines | Information Disclosure | Identifier-only log format strings (T-073-04). If logging at all for the emit, format MUST be `"emit tool_args_progress tool_index=%d size=%d"` — no `%s` on `args_so_far` content. |
| Redis stream key forgery | Tampering | Stream key is server-derived `f"run:{rid}"` where `rid` comes from the active_runs SELECT (already RLS-bound); no user input flows into the key. |
| Sandbox command injection via `wrapped_code` | Tampering / Elevation of Privilege | Pre-existing concern — `session.execute_command(f"python -u {code_file}")` swap doesn't widen the surface. The code_file path is server-generated (`/tmp/run-{uuid.uuid4().hex}.py`); only the file *contents* (user code) carry attacker influence, and they were always going to run inside the container. **No new injection vector introduced.** |
| `tool_args_progress` event flood | Denial of Service | D-075-10 5KB boundary caps event rate at `ceil(total_args / 5120)`. Trust Redis Stream backpressure (MAXLEN 10000 ~= 2MB per buffer per D-061-09). |
| Heartbeat false-failure (BUG-260518-01 itself) | Availability | The fix IS the mitigation: distinguish heartbeat-gap from genuine stream end. |
| Docker exec stream resource exhaustion | DoS | Existing sandbox TTL eviction (sandbox_service.py:_evict_expired) — unchanged. Per-execution timeout from llm-sandbox InteractiveSettings.timeout=300s also unchanged. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12+ | Backend tests | ✓ | (project venv) | — |
| pytest + pytest-asyncio | All integration tests | ✓ | (project venv) | — |
| httpx + ASGITransport | Integration test client | ✓ | 0.28.1 | — |
| FastAPI | Server | ✓ | 0.115.6 | — |
| redis-py async | `/snapshot` Redis probe | ✓ | 5.3.1 | — |
| Docker SDK for Python | Sandbox exec stream | ✓ | 7.1.0 | — |
| llm-sandbox | Session lifecycle + execute_command wrapper | ✓ | (no version attr) | — |
| sse-starlette | SSE response | ✓ | 2.4.1 (pin invariant) | — |
| Pydantic v2 | Response models | ✓ | 2.12.5 | — |
| Docker daemon (for Plan 02 real-sandbox test) | test_075_code_stdout_progressive.py | ✓ assumed (existing tests use it) | — | If Docker unavailable in test env, mark Plan 02 integration test as `@pytest.mark.skipif(SANDBOX_ENABLED=False, ...)` per existing patterns. |
| Chrome DevTools MCP | SC #1 latency UAT | ✓ assumed (per `feedback_chrome_mcp_testing.md`) | — | Fallback to manual stopwatch + browser DevTools Network panel. |
| Dev login `fhdmrd@gmail.com / 123456` | Chrome MCP authenticated flows | ✓ per `reference_local_dev_app.md` | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — every dependency is installed or assumed-available per memory notes.

## Open Questions

1. **redis-py decode_responses setting in the project's `aioredis.Redis` config**
   - What we know: existing `runs.py` calls `redis.exists()`, `redis.xread()` etc. without decoding cursors as bytes explicitly; the existing replay_tail_consumer's `data_field = fields.get("data")` followed by `json.loads(data_field)` suggests `decode_responses=True` is set (otherwise json.loads would receive bytes and raise TypeError on Python 3.5+ … actually json.loads accepts bytes since 3.6, so this is ambiguous).
   - What's unclear: whether xinfo_stream's first-entry id will come back as bytes or str.
   - Recommendation: planner reads `app/dependencies.py::get_redis` and confirms. Pattern 2's defensive `cursor.decode() if isinstance(cursor, bytes) else cursor` handles either way; no planner action needed unless test environment differs from production.

2. **Whether `tty=True` would make line-buffering unnecessary**
   - What we know: `DockerContainerAPI.execute_command` hardcodes `tty=False`. With `tty=True`, CPython detects a TTY and switches to line-buffered stdout — no need for `python -u`.
   - What's unclear: whether llm-sandbox supports an opt-in `tty=True` override or whether forking the call to raw `container.exec_run(cmd, tty=True, stream=True)` would help.
   - Recommendation: stick with `python -u` (D-075 Discretion grants the choice, and `-u` is the explicit, well-documented approach). Don't fight the library.

3. **Order-of-magnitude estimate for SC #1 latency cut**
   - What we know: 3 sequential HTTP calls on cold cache today (1 RTT each = ~3 × 50ms LAN = ~150ms minimum, often 500ms+ under load). Single call cuts to ~50-100ms.
   - What's unclear: whether the 50% threshold is conservative or aggressive — depends on dev-machine network and Supabase response times.
   - Recommendation: capture before/after with `performance_start_trace` and report the actual delta in UAT; if <50%, investigate Postgres query plans (likely `messages SELECT` is the heavyweight call).

4. **Whether to add a `tool_args_progress` integration test for STRUCTURED mode**
   - What we know: the filter is in the emit guard (D-075-11). A test that exercises STRUCTURED mode with big args and asserts ZERO progress emits is a clean negative-assertion regression guard.
   - What's unclear: STRUCTURED mode in production rarely produces >5KB args (args inject into system prompt; LLM rarely returns 5KB+ JSON via structured-prompt parsing). The test may be trivially green even with broken filter.
   - Recommendation: include the test anyway — negative-assertion guards are cheap insurance.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app/dependencies.py::get_redis` uses `decode_responses=True` (or close to it). | Pitfall 2 | Snapshot endpoint may need explicit `.decode()` on cursor bytes; defensive code in Pattern 2 handles either case so risk is minor. [ASSUMED based on existing replay_tail_consumer behavior — not verified in this session] |
| A2 | The sandbox's child Python process inherits no `PYTHONUNBUFFERED=1` env from llm-sandbox; explicit `-u` is required. | Pitfall 1 | SC #2 test fails for buffering reasons rather than wiring reasons. [ASSUMED — would need a live Docker exec to verify, but `python -u` is a no-op when env var is already set, so always-include is safe] |
| A3 | Existing Phase-074 `_reset_redis_singleton` autouse fixture from `tests/integration/conftest.py` auto-applies to all 3 new test files. | Wave 0 gaps | Tests fail with "Event loop is closed" on second run. [VERIFIED: conftest.py uses `autouse=True` and lives in the integration dir — scope is correct] |
| A4 | `MessageResponse` already carries `run_id` + `run_status` (per D-063.1-15 / Phase 063.1). | Pattern 1 | Snapshot's response is missing fields and frontend breaks. [VERIFIED via direct read of `backend/app/models/message.py:38-44`] |
| A5 | Docker exec stream's UTF-8 decoding inside llm_sandbox passes the decoded string directly to on_stdout (not bytes). | Pattern 3, Pattern 5 | Line-buffer code receives bytes and must add explicit decode. [VERIFIED via direct read of `~/site-packages/llm_sandbox/core/mixins.py::_process_stream_output`] |
| A6 | `session.container` exposes a `docker.models.containers.Container` instance with `exec_run` method available. | Pattern 3 alternative | Low-level exec_run path doesn't work; only high-level `session.execute_command` is viable. [VERIFIED via direct read of `interactive.py:209` — `self.container = self._backend_session.container`] |
| A7 | The bottom-indicator desync (BUG-260514-03) is fixable purely in MessageItem.tsx (sticky text logic) without touching the StreamsProvider event dispatch. | D-075-14 fix surface | Plan 02 frontend half balloons in size. [ASSUMED — based on report's recommended fix; planner should grep for current indicator render site at plan time] |
| A8 | The `_emit` helper at `threads.py` accepts arbitrary `**kwargs` and serializes them to the SSE event payload via XADD. | Pattern 4 | New event types require helper changes. [VERIFIED via direct read of multiple existing `_emit(redis, run_id, 'event_type', key=val, …)` call sites — e.g., threads.py:1599, 1614, 2195-2196, 2204] |
| A9 | The integration test for SC #2 can drive a real Docker sandbox in the test environment (Docker daemon available). | Validation Architecture | Plan 02 ship gate can't run automatically — falls back to manual UAT. [ASSUMED — existing tests like test_065_skills_*.py drive real sandboxes; if Docker isn't available in CI, test would skip with the SANDBOX_ENABLED pattern] |

## Recommended Implementation Order

Per CONTEXT.md D-075-16, the three plans are parallel-able (Plan 02 and Plan 03 independent; Plan 01 independent of both). Within each plan:

### Plan 01 — Snapshot endpoint full stack + BUG-260518-01

1. **Backend Task 1 — Extract `_enrich_messages_with_runs` helper** (D-075-03). Refactor only — `/messages` behavior unchanged. Verify: existing `test_063_1_messages_runs_join.py` stays green.
2. **Backend Task 2 — Add `ThreadSnapshotResponse` Pydantic model** in `backend/app/models/thread.py`. Pure additive.
3. **Backend Task 3 — Implement `GET /threads/{id}/snapshot` endpoint** with auth + dual `.eq("user_id")` + maybe_single + Redis xinfo_stream loop + 503 fallback.
4. **Backend Task 4 — Update `runs.py:221-235` `replay_tail_consumer`** to distinguish heartbeat-gap from genuine TTL expiry (BUG-260518-01 backend half).
5. **Backend Task 5 — Integration tests `test_075_snapshot.py`** (3 tests: happy path, cross-user 404, Redis-down 503). Plus a regression run of `test_063_1_messages_runs_join.py`.
6. **Frontend Task 6 — Add `getSnapshot` helper + extract `_mapMessageResponse`** to `frontend/src/lib/api.ts`.
7. **Frontend Task 7 — Map `buffer_expired_*` errors as transient** at `api.ts:390-408` (BUG-260518-01 frontend half).
8. **Frontend Task 8 — Atomic swap in `StreamsProvider.reconcile`** (D-075-02) + seed `lastSeenOffsetRef` from `since_cursors`.
9. **Frontend Task 9 — Reconcile-fetch in `StreamsProvider.tsx:689-720` onTerminal handler** before flipping `runStatus: "failed"` (BUG-260518-01 wiring).
10. **UAT Task 10 — Chrome MCP timing run** for SC #1 (≥50% reduction) + Resume-button-stays-hidden lived-experience check.

### Plan 02 — Line-by-line code_stdout SSE rewire + BUG-260514-03

1. **Backend Task 1 — Build the `python -u` invocation path**. Write user code to a file (`session.execute_command("cat > /tmp/run-{uuid}.py …")` or `session.copy_to_runtime`); compose the python invocation; verify file write works.
2. **Backend Task 2 — Replace `_run_sync` to use `session.execute_command(f"python -u {code_file}", on_stdout=..., on_stderr=...)`** (D-075-05). Drop the on_stdout/on_stderr lambdas straight into the existing asyncio.Queue bridge — the bridge consumer is reused unchanged.
3. **Backend Task 3 — Add line-buffer + silent-window heartbeat in the drain loop** (Pattern 5). Touch threads.py:2186-2204.
4. **Backend Task 4 — DELETE post-completion stdout/stderr emit at threads.py:2213-2218** (D-075-07).
5. **Backend Task 5 — Integration test `test_075_code_stdout_progressive.py`** — 5-step printer + monotonic captured_at + no duplicate + silent-window heartbeat regression.
6. **Frontend Task 6 — Identify bottom-indicator render site** (grep for the indicator hook — likely under `frontend/src/components/chat/MessageItem.tsx` or a sibling hook).
7. **Frontend Task 7 — Sticky text + subscribe to `code_stdout`** (BUG-260514-03 two-half fix).
8. **UAT Task 8 — Chrome MCP long pptx cell** — bottom indicator stays animated through silent matplotlib renders.

### Plan 03 — tool_args_progress SSE primitive

1. **Backend Task 1 — Add OpenAI-path emit** at `threads.py:1601-1616`. Insert `_tool_args_emit_boundary: dict[int, int] = {}` initialization alongside `tool_calls_buffer` reset; add the 5KB-boundary check after `tool_calls_buffer[idx]["arguments"] += tc.function.arguments`. Apply D-075-11 filter.
2. **Backend Task 2 — Add Anthropic-path yield** at `anthropic_service.py:199-206`. New yield event `{"type": "tool_args_progress", "tool_index": idx, "name": …, "args_so_far": …, "total_args_bytes_so_far": …}` from the generator; route via existing `_on_chunk_anthropic` dispatch in threads.py.
3. **Backend Task 3 — Integration test `test_075_tool_args_progress.py`** — 4 tests: OpenAI happy path, execute_code skipped, STRUCTURED skipped, Anthropic happy path.
4. **UAT Task 4 — Live Anthropic UAT** — Drive `analyze_document` with a long-form prompt against `claude-sonnet-4-6`; confirm SSE wire shows boundary events between `tool_preparing` and `tool_start`.

## Sources

### Primary (HIGH confidence — direct verified reads in this session)

- `~/site-packages/llm_sandbox/interactive.py` (full module) — confirmed `on_stdout`/`on_stderr` unused in `.run()` path; confirmed `self.container` + `self.container_api` attribute presence post-`open()`.
- `~/site-packages/llm_sandbox/docker.py:43-60` — `DockerContainerAPI.execute_command` calling `container.exec_run(cmd=..., stream=stream, tty=False, demux=True)`.
- `~/site-packages/llm_sandbox/core/mixins.py::_process_stream_output` — confirmed per-chunk UTF-8 decode + per-chunk callback dispatch in streaming mode.
- `~/site-packages/redis/commands/core.py::StreamCommands.xinfo_stream` — XINFO STREAM command shape.
- `~/site-packages/docker/api/exec_api.py::ExecApiMixin.exec_start` — confirmed `stream=True` returns generator yielding response chunks.
- `backend/app/api/threads.py:510-551, 731-818, 1595-1616, 2085-2218` — verbatim source reads of all canonical-ref ranges.
- `backend/app/api/runs.py:120-290, 322-391` — replay_tail_consumer + stream_run + Redis probe pattern.
- `backend/app/services/anthropic_service.py:170-249` — input_json_delta accumulator + yield-event shape.
- `backend/app/services/sandbox_service.py` (full file) — SandboxSessionManager lifecycle.
- `backend/app/models/{message,run,thread}.py` — Pydantic response model shapes.
- `frontend/src/lib/api.ts:1-470` (relevant ranges) — existing helpers + SSE parser.
- `frontend/src/providers/StreamsProvider.tsx:360-720` (relevant ranges) — reconcile + onTerminal + clearThreadBucket.
- `frontend/src/hooks/useMessages.ts` (full 89 lines) — confirmed post-Phase-068 thin wrapper.
- `frontend/src/components/chat/MessageItem.tsx:100-200` — Resume button + bottom indicator render sites.
- `backend/tests/integration/conftest.py` (full file) — `_reset_redis_singleton` autouse hoisted per Phase 074 D-074-11.
- `backend/tests/integration/test_063_post_then_subscribe.py:1-151` (full file) — POST→GET-stream test pattern.
- `backend/tests/integration/test_063_1_messages_runs_join.py:1-80` — mock-supabase ownership + runs SELECT routing pattern.
- Direct package version queries via `backend/venv/Scripts/python.exe -c "import X; print(X.__version__)"` for redis (5.3.1), docker (7.1.0), fastapi (0.115.6), sse-starlette (2.4.1), httpx (0.28.1), pydantic (2.12.5).

### Secondary (MEDIUM confidence — derived from sources above + project memory)

- `.planning/PROJECT.md` Key Decisions (D-v2.5-01 through D-v2.5-12 + D-PRD-* family) — referenced through CLAUDE.md guardrails.
- `.planning/reported-bugs/resume-button-appears-during-active-code-execution.md` — full bug report with fix surface.
- `.planning/STATE.md` — milestone v2.6 + phase 074 close status.
- `.planning/REQUIREMENTS.md` Theme D — POLISH-SEED-008-01/02 + POLISH-TOOL-PROG-01.
- `.planning/ROADMAP.md:452-461` — Phase 075 charter + 4 SCs.

### Tertiary (LOW confidence — assumptions flagged in Assumptions Log)

- redis-py `decode_responses` config — defensive code in Pattern 2 handles either way (A1).
- Docker exec PYTHONUNBUFFERED inheritance — `-u` flag always-include is safe (A2).
- CI Docker availability for Plan 02 real-sandbox test (A9).

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every version + every API surface verified via direct read of installed packages in the project venv.
- Architecture: **HIGH** — all 4 canonical reference paths read directly; D-075-* decisions are pre-locked in CONTEXT.md and not re-researched.
- Pitfalls: **HIGH** — Pitfalls 1-7 grounded in direct package source reads + verified CLAUDE.md project rules.
- Test scaffolding: **HIGH** — existing patterns (test_063_post_then_subscribe + test_063_1_messages_runs_join + conftest.py autouse fixture) read directly.
- Frontend types: **HIGH** — useMessages.ts + StreamsProvider.tsx + api.ts + MessageItem.tsx + types/index.ts:113 all read in this session.
- BUG-260518-01 fix surface: **HIGH** — bug report read; runs.py:221-235 + StreamsProvider.tsx:689-720 + api.ts:390-408 + MessageItem.tsx:118 all read.
- BUG-260514-03 fix surface: **MEDIUM** — report classified the fix as 2-part (sticky + subscribe), but the exact rendering site for the bottom indicator wasn't pinpointed in this research; planner will grep in Plan 02 Task 6.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30-day window — stable Python libs, no fast-moving dependencies).

## RESEARCH COMPLETE
