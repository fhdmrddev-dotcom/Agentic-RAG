# Phase 059: SSE Architecture Refactor — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 6 (2 modified, 1 deleted, 3 created)
**Analogs found:** 6 / 6 (every new/modified file has a precise in-repo analog or self-reference)

---

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `backend/app/api/threads.py` | MODIFIED | controller (FastAPI route) | streaming (SSE producer/consumer) | self — current `event_stream` (lines 522-1793) is the source of truth for *what to keep*; sse-starlette docs Example 1 in RESEARCH §"Code Examples" is the source for *what to change* | exact (refactor of self) |
| `backend/app/responses.py` | DELETED | utility (response wrapper) | streaming (transport-error suppressor) | self — only to confirm what's being removed; no replacement file | exact (deletion target) |
| `backend/requirements.txt` | MODIFIED | config | n/a | self — adjacent to the existing `fastapi==0.115.6` line; format is `pkg==X.Y.Z` one-per-line | exact |
| `backend/tests/integration/test_059_disconnect.py` | CREATED | test (integration) | streaming (mid-stream disconnect simulation) | `backend/tests/integration/test_058_concurrency.py` (`_make_table_builder`, `_build_mock_supabase`, `_consume_sse`, `_fast_chunks`, `app.dependency_overrides[get_supabase]` setup/restore) | exact (058 is the canonical async-httpx SSE test in this repo) |
| `backend/app/api/_agent_runner.py` | CREATED (optional, Claude's discretion per D-059-01b) | controller helper | streaming (producer task) | inline closure currently at `threads.py:522-1791`; if extracted, must accept the captured-state shim as explicit args (`current_user`, `body`, `thread_id`, `supabase`, `user_settings`) | role-match (extraction of existing closure) |
| `backend/tests/integration/_sse_helpers.py` | CREATED (optional, Claude's discretion) | test helper | streaming | `_fast_chunks`, `_make_sse_chunk`, `_make_done_chunk`, `_consume_sse` from `test_058_concurrency.py:84-117, 230-251` | exact (extraction of existing helpers) |
| `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` | CREATED | docs (manual checklist) | n/a | `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` | exact (D-058-10 format precedent locked by D-059-08) |

**Note on `_agent_runner.py` and `_sse_helpers.py`:** Both are explicitly marked Claude's-discretion in CONTEXT.md. The planner's default should be **inline first, extract only if the diff is cleaner** — they are listed here so the planner can reference patterns either way.

---

## Pattern Assignments

### `backend/app/api/threads.py` (controller, streaming SSE)

**Analog 1 — current state (what to keep):** `backend/app/api/threads.py` itself, lines 736-1791 (the producer body, including `_persist_assistant_message`, the `try/finally` shielded persist, the iteration loop, post-loop title/suggestion/`stream_end` events). This is a refactor — most of the logic survives; only the wrapping changes.

**Analog 2 — target shape (what to copy):** RESEARCH.md §"Code Examples" Example 1 (canonical sse-starlette FastAPI endpoint) and §"Pattern 1" (the asyncio.Queue producer/consumer minimal sketch).

#### Imports pattern (current `threads.py:1-30`)

```python
import asyncio
import base64
import io
import json
import os
import time as time_mod
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.responses import sse_response          # ← REMOVE this line (D-059-05)
import openai
from openai import APIError
...
from app.utils.db import aexec
```

**Copy-mirror:**
- Keep all imports above except `from app.responses import sse_response` (line 11) — delete that line.
- Add the new SSE wrapper import: `from sse_starlette import EventSourceResponse` (or the explicit module path `from sse_starlette.sse import EventSourceResponse` — both work in 2.4.1; prefer the top-level `from sse_starlette import EventSourceResponse` for consistency with the library's public API).
- The `from typing import AsyncGenerator` import becomes unused once `event_stream` is removed (the consumer is an inline `async def` with no return-type annotation in the sketch). Remove it iff no other annotations in the file still need it (Grep `AsyncGenerator` to confirm before removing — there may be other generators in this file).

**Change exactly:** drop one line, add one line. No other import surgery.

#### Pre-stream INSERT pattern (KEEP VERBATIM, lines 493-518)

```python
@router.post("/{thread_id}/messages")
async def send_message(
    thread_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Insert user message (D-058-02: pre-stream INSERT)
    await aexec(
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "user",
            "content": body.content,
        })
    )
```

**Copy-mirror:** Keep this whole block byte-for-byte. CONTEXT.md §"Phase Boundary" states: "The pre-stream user-message INSERT at `threads.py:511` stays in the route handler (already `aexec`-wrapped per D-058-02)."

**Change:** Nothing in lines 493-518. Cancellation safety stops at line 519 (i.e. the user-message INSERT runs *before* the queue/task is created — if the client disconnects between INSERT and `EventSourceResponse(...)`, the message stays inserted, which is the correct behavior).

#### `_stop_event` deletion (line 520)

**Current:**
```python
    _stop_event = asyncio.Event()
```

**Target:** Delete this line entirely (D-059-02). Replace with:
```python
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)   # D-059-04
```

#### Producer body — entire `event_stream` body (lines 522-1791) → `agent_runner`

**Current shape (line 522):**
```python
    async def event_stream(stop_event: asyncio.Event = _stop_event) -> AsyncGenerator[str, None]:
```

**Target shape:**
```python
    async def agent_runner() -> None:
        """Producer — entire current event_stream body lives here."""
```

**Critical mapping table (per RESEARCH.md §"Pattern 1" — the planner must apply each rule):**

| Current (`event_stream` body) | New (`agent_runner` body) |
|---|---|
| `async def event_stream(stop_event: asyncio.Event = _stop_event) -> AsyncGenerator[str, None]:` | `async def agent_runner() -> None:` |
| `if stop_event.is_set(): return` (line 748) | **DELETE** |
| `if stop_event.is_set(): return` (line 815) | **DELETE** |
| `if stop_event.is_set(): return` (line 871) | **DELETE** |
| Every `yield f"data: {json.dumps({...})}\n\n"` | `await queue.put(json.dumps({...}))` (no `data:` prefix, no `\n\n`) |
| Outer `try` at line 736 | **KEEP** — this is the inner try (shielded persist guard) |
| Inner `try` at line 737 | **KEEP** — wraps the iteration loop / setup |
| `finally:` at line 1780 | **KEEP** — runs the shielded persist |
| `except asyncio.CancelledError: pass` (line 1790-1791) | **CHANGE to `raise`** — D-059-02, RESEARCH §A5, RESEARCH Pitfall 2 |
| (no outer-outer wrapping today) | **ADD** outer `try/finally` whose only purpose is `await queue.put(None)` (sentinel) — RESEARCH Pitfall 4 mandates this |

**Two-finally structure (RESEARCH "Open Question 2" — explicit recommendation):**

```python
async def agent_runner() -> None:
    try:                           # OUTER try → finally runs sentinel push
        try:                       # INNER try → finally runs shielded persist
            # ... entire current event_stream body 522-1779 lives here ...
            # Every  yield f"data: {json.dumps(...)}\n\n"
            #   becomes  await queue.put(json.dumps(...))
        finally:
            async def _shielded_persist():
                await _persist_assistant_message()
            try:
                await asyncio.shield(_shielded_persist())
            except asyncio.CancelledError:
                raise              # ← was `pass` (line 1790); now `raise` per §A5
    finally:
        await queue.put(None)      # SENTINEL — must be the LAST queue op, ALWAYS
```

#### Yield-to-put rewrite (every occurrence in lines 522-1779)

**Current pattern (e.g. lines 753, 757, 822, 829, 883, 1752, 1755, 1760, 1773, 1778):**
```python
yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"
yield f"data: {json.dumps({'type': 'delta', 'content': _text})}\n\n"
yield f"data: {json.dumps({'type': 'tool_preparing', 'name': _ant_event['name'], 'index': _idx})}\n\n"
yield f"data: {json.dumps({'type': 'delta', 'content': delta.content})}\n\n"
yield f"data: {json.dumps({'type': 'fallback_model', **title_fallback})}\n\n"
yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
yield f"data: {json.dumps({'type': 'done'})}\n\n"
yield f"data: {json.dumps({'type': 'fallback_model', **sugg_fallback})}\n\n"
yield f"data: {json.dumps({'type': 'suggestions', 'questions': questions[:3]})}\n\n"
yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
```

**Target pattern (mechanical rewrite — every `yield` becomes `await queue.put`):**
```python
await queue.put(json.dumps({"type": "iteration_start", "iteration": iteration}))
await queue.put(json.dumps({"type": "planning", "iteration": iteration}))
await queue.put(json.dumps({"type": "delta", "content": _text}))
await queue.put(json.dumps({"type": "tool_preparing", "name": _ant_event["name"], "index": _idx}))
await queue.put(json.dumps({"type": "delta", "content": delta.content}))
await queue.put(json.dumps({"type": "fallback_model", **title_fallback}))
await queue.put(json.dumps({"type": "title", "content": title}))
await queue.put(json.dumps({"type": "done"}))
await queue.put(json.dumps({"type": "fallback_model", **sugg_fallback}))
await queue.put(json.dumps({"type": "suggestions", "questions": questions[:3]}))
await queue.put(json.dumps({"type": "stream_end"}))
```

**Optional ergonomic helper (Claude's discretion, per CONTEXT.md):**
```python
async def _yield(type_: str, **fields) -> None:
    await queue.put(json.dumps({"type": type_, **fields}))
# Usage: await _yield("delta", content=_text)
```

**Landmines on the rewrite:**
- Do NOT add `data: ` prefix or `\n\n` to the queue payload (RESEARCH Anti-Patterns: "Adding a `data:` prefix or trailing `\n\n` to queue payloads"). `EventSourceResponse` does framing.
- Do NOT use `queue.put_nowait(...)` — RESEARCH Anti-Patterns: backpressure with `maxsize=100` is desired, `put_nowait` raises `QueueFull`.
- Watch for any `yield` statements not currently captured in the list above. Use `Grep("^\\s*yield\\s+f\"data:", path=threads.py)` once before rewriting and **after** rewriting (post-rewrite count should be 0).

#### Iteration-loop stop-flag deletions (lines 748, 815, 871)

**Current (line 748):**
```python
            for iteration in range(max_iterations):
                if stop_event.is_set():
                    return
                yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
```

**Target:**
```python
            for iteration in range(max_iterations):
                # D-059-02: stop_event polling removed; task.cancel() raises
                # CancelledError at the next await (queue.put or aexec call).
                await queue.put(json.dumps({"type": "iteration_start", "iteration": iteration}))
```

**Same pattern applies to lines 815 and 871** (Anthropic and OpenAI/OpenRouter inner-stream loops). Per CONTEXT.md "Claude's Discretion": planner may either delete the three checks outright or replace with a one-line comment per deletion. Either is functionally equivalent under D-059-02.

**Landmine — sync-iterator inside async loop:** Lines 814 (`for _ant_event in _ant_gen:`) and 870 (`for chunk in stream:`) are **sync** iterators. `task.cancel()` cannot interrupt them mid-step; cancellation only fires at the next `await` *after* the chunk is produced. This is KI-001's bounded scope: "no NEW LLM calls fire after disconnect" — but an in-flight chunk completes. CONCUR-02 explicitly accepts this (see RESEARCH §"Cancellation Propagation Timeline" — worst-case 500ms+ if a token batch is in flight). The planner does NOT need to fix this; it is documented as out of scope.

#### Producer creation + consumer + return (replaces line 1793)

**Current (line 1793):**
```python
    return sse_response(event_stream(_stop_event), stop_event=_stop_event)
```

**Target (replace with the queue/task/consumer wiring AFTER `agent_runner` is defined):**

```python
    # Spawn producer task — runs concurrently with the consumer below.
    task = asyncio.create_task(agent_runner())

    async def event_consumer():
        """Thin consumer — yields queue payloads as SSE data dicts.

        sse-starlette wraps each dict in `data: {payload}\n\n` framing. The
        producer's outermost finally pushes None as a sentinel so this loop
        can exit cleanly.
        """
        try:
            while True:
                payload = await queue.get()
                if payload is None:
                    break
                yield {"data": payload}
        finally:
            # On disconnect, sse-starlette cancels this consumer; cancel the
            # producer too so its outer `finally` (shielded persist) runs.
            if not task.done():
                task.cancel()
            # Drain task — surfaces any non-cancellation exception for logging.
            try:
                await task
            except asyncio.CancelledError:
                pass  # expected on disconnect — producer's finally already ran
            except Exception:
                import logging
                logging.getLogger(__name__).exception("agent_runner crashed")

    return EventSourceResponse(event_consumer(), ping=15)
```

**Landmines:**
- The consumer's `finally` MUST drain `task` with a `try/except CancelledError: pass` — RESEARCH Open Question 1 explicitly recommends this. Without the drain, Python may emit "Task was destroyed but it is pending!" warnings on some uvicorn/anyio version combinations.
- Do NOT pass `headers=`, `media_type=`, or `Cache-Control` overrides — sse-starlette sets `media_type="text/event-stream"` and `Cache-Control: no-cache` automatically (RESEARCH Open Question 3).
- Do NOT add `request: Request` to the route handler signature just to call `request.is_disconnected()` from the producer — RESEARCH Anti-Patterns: "Polling `request.is_disconnected()` from the producer. Don't. The consumer doesn't need to either when using `EventSourceResponse`."

#### Inner shielded persist (lines 1786-1791) — minimal change

**Current:**
```python
            async def _shielded_persist():
                await _persist_assistant_message()
            try:
                await asyncio.shield(_shielded_persist())
            except asyncio.CancelledError:
                pass
```

**Target:**
```python
            async def _shielded_persist():
                await _persist_assistant_message()
            try:
                await asyncio.shield(_shielded_persist())
            except asyncio.CancelledError:
                raise   # D-059-02, RESEARCH §A5: re-raise after cleanup
```

**Single character change of intent: `pass` → `raise`.** This is a load-bearing edit — RESEARCH Pitfall 2 documents the symptom (test reports `task.cancelled()` False AND `task.exception()` None ⇒ swallowed cancellation ⇒ leaked task ⇒ consumer's `await task` hangs).

**Landmine — `asyncio.shield` caveat (RESEARCH Pitfall 3):** `asyncio.shield` only protects against EXTERNAL cancellation. If `_persist_assistant_message` itself raises `CancelledError`, the shield does not protect. For 059 this is theoretical — `_persist_assistant_message` calls `await aexec(supabase.table("messages").insert(row))` which runs inside `run_in_threadpool`; threadpool workers cannot be directly cancelled. Add a one-line comment in `_shielded_persist` calling out the assumption: `# aexec runs in run_in_threadpool — not directly cancellable; shield is sufficient.`

---

### `backend/app/responses.py` (utility — DELETE ENTIRELY)

**Analog:** Self. The file is read once to confirm what's being removed; nothing replaces it.

**Existing file shape (lines 1-153 of `backend/app/responses.py`):**

```python
import asyncio
import logging
from starlette.responses import StreamingResponse

logger = logging.getLogger(__name__)


class _SilentSSEIterator:
    """Wraps an async generator to suppress transport errors when SSE clients disconnect.
    ...
    """
    def __init__(self, gen, stop_event=None): ...
    async def aclose(self): ...
    async def __anext__(self):
        # 60+ lines of OSError/AssertionError/RuntimeError catching


class SSEStreamingResponse(StreamingResponse):
    """StreamingResponse that suppresses ASGI transport errors on client disconnect.
    ...
    """
    async def __call__(self, scope, receive, send):
        # _safe_send wrapper + try/except OSError/Assertion/Runtime + finally aclose


def sse_response(gen, media_type="text/event-stream", stop_event=None):
    return SSEStreamingResponse(_SilentSSEIterator(gen, stop_event), media_type=media_type)
```

**What to copy:** Nothing. This file is replaced by sse-starlette's `EventSourceResponse` + `_listen_for_disconnect` task-group machinery.

**What to change:** Delete the entire file: `git rm backend/app/responses.py`.

**Verification command (D-059-05 structural check):**
```bash
[ ! -f backend/app/responses.py ] && echo OK || echo FAIL
```

**Landmines:**
- Do NOT preserve any of these classes "just in case." RESEARCH §A3 explicit warning: "Don't re-add the OSError-catching `SSEStreamingResponse` shim once `sse-starlette` is in place — it becomes redundant and can hide real bugs."
- Importer audit (already done in pattern-mapping pass): the **only** non-stale importer in the active codebase is `backend/app/api/threads.py:11` — `from app.responses import sse_response`. Confirmed via `Grep("from app\\.responses|app\\.responses\\.", path=backend/app)` returning exactly one hit. The substring matches in `main.py`, `services/openai_service.py`, `api/skills.py`, `api/audit.py` are noise (`responses.create`, comment text, etc.) — verified zero `from app.responses` imports in those files. The deletion is safe once `threads.py:11` is removed.

---

### `backend/requirements.txt` (config)

**Analog:** Self — the existing `fastapi==0.115.6` line is the format precedent. Existing pin scheme: pinned versions use `==X.Y.Z`; libraries with semver tolerance use `>=X.Y.Z`.

**Existing file (`backend/requirements.txt`):**
```text
fastapi==0.115.6
uvicorn[standard]==0.32.1
supabase==2.10.0
openai>=2.0.0
anthropic>=0.97.0
tiktoken>=0.12.0
langsmith==0.2.3
pydantic-settings==2.7.0
python-dotenv==1.0.1
python-multipart==0.0.20
pypdf>=5.0.0
python-docx>=1.0.0
pdfplumber>=0.11.0
python-pptx>=1.0.0
openpyxl>=3.1.0
ebooklib>=0.18
pytest>=8.0.0
pytest-asyncio>=0.24.0
httpx>=0.27.0
sentence-transformers>=3.0.0
llm-sandbox[docker]>=0.3.37
```

**Copy-mirror format:** New entries follow existing convention.

**Changes:**
1. Add `sse-starlette==2.4.1` immediately under the `fastapi==0.115.6` line for reviewability (RESEARCH Pitfall 1 explicit guidance: "Add to `backend/requirements.txt` directly under the existing `fastapi==0.115.6` line so it's reviewable").
2. Add `pytest-timeout>=2.4.0` under the existing `pytest-asyncio>=0.24.0` line (RESEARCH §"Wave 0 Gaps" + Open Question 4: belt-and-suspenders against test hangs, used by `@pytest.mark.timeout(10)` on the disconnect test).

**Target file:**
```text
fastapi==0.115.6
sse-starlette==2.4.1                              # ← NEW (D-059, RESEARCH §Standard Stack)
uvicorn[standard]==0.32.1
supabase==2.10.0
openai>=2.0.0
anthropic>=0.97.0
tiktoken>=0.12.0
langsmith==0.2.3
pydantic-settings==2.7.0
python-dotenv==1.0.1
python-multipart==0.0.20
pypdf>=5.0.0
python-docx>=1.0.0
pdfplumber>=0.11.0
python-pptx>=1.0.0
openpyxl>=3.1.0
ebooklib>=0.18
pytest>=8.0.0
pytest-asyncio>=0.24.0
pytest-timeout>=2.4.0                             # ← NEW (RESEARCH Open Q4, Pitfall 4/7)
httpx>=0.27.0
sentence-transformers>=3.0.0
llm-sandbox[docker]>=0.3.37
```

**Landmines:**
- Pin `sse-starlette==2.4.1` **exactly** — not `>=2.4.1`, not `^2.4.0`, not `~=2.4`. RESEARCH Pitfall 1: 3.x hard-requires `starlette>=0.49.1` and pip will either error out or silently downgrade FastAPI/Starlette below 058's tested baseline. The exact-pin is mandatory.
- After modifying `requirements.txt`, the executor MUST run `backend/venv/Scripts/pip install -r backend/requirements.txt` before any test or runtime check. Document this in the plan as Wave 0.

---

### `backend/tests/integration/test_059_disconnect.py` (test, integration, streaming)

**Analog:** `backend/tests/integration/test_058_concurrency.py` — the only async-httpx SSE integration test in the repo, and the file CONTEXT.md §"Reusable Assets" explicitly names: "058's slow-mock-LLM fixture in `tests/integration/test_058_concurrency.py` — reuse for 059's disconnect test."

#### Imports + module docstring pattern (058 lines 1-55)

```python
"""Integration test for Phase 058 — cross-tab GET unblocked during SSE streaming.
..."""
import asyncio
import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

USER_ID = "00000000-0000-0000-0000-000000000001"
THREAD_A = str(uuid4())
THREAD_B = str(uuid4())
SLOW_INSERT_DELAY = 1.5
```

**Copy-mirror:** Same imports. The 059 test:
- KEEPs `asyncio`, `time`, `MagicMock`, `patch`, `uuid4`, `httpx`, `pytest`, `get_supabase`, `app`, `CallingMode`.
- DOES NOT need a Thread B (this is a single-thread disconnect test, not a cross-tab test). Use just `THREAD_A = str(uuid4())`.
- Adds `import pytest` decorator `@pytest.mark.timeout(10)` if `pytest-timeout` is in requirements.

#### Mock supabase builder pattern (058 lines 76-227, KEEP — this is the canonical primitive)

The full `_make_result`, `_make_table_builder`, `_build_mock_supabase`, `_thread_row`, `_message_row` block is reusable verbatim. The 059 test's mock supabase needs:
- A threads-table builder returning `_thread_row(THREAD_A)` for the ownership check.
- A messages-table builder that:
  - Returns successfully on the pre-stream INSERT (no slow delay needed for 059).
  - Returns successfully on the assistant-message persist (the `asyncio.shield`-protected write that must complete after disconnect).
  - Records each insert call so the test can assert "messages table contains an assistant row after disconnect" (Invariant I4).

```python
def _make_table_builder(execute_fn):
    """Build a chainable mock that routes every chained method back to itself
    and dispatches `.execute()` to the supplied callable."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.upsert.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.or_.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.gte.return_value = b
    b.lt.return_value = b
    b.range.return_value = b
    b.execute.side_effect = execute_fn
    return b
```

**Copy verbatim.** The chainable mock works for any Supabase query; reusing it avoids drift.

#### Slow-mock-LLM pattern (058 lines 84-117 + 230-251)

**058's `_fast_chunks`** is the wrong primitive for 059 — 058 deliberately avoids slowing the LLM stream because *058's* event-loop blocking concern was the threadpool, not the LLM iterator (058 module docstring lines 33-43 explicitly states this).

**059 needs the OPPOSITE: a SLOW chunked stream** so the disconnect happens reliably mid-stream. Pattern:

```python
def _slow_chunks(delay: float = 0.3, count: int = 50):
    """Sync generator — yields tokens with a delay so the SSE stream stays
    open long enough for the test to disconnect mid-stream.

    NOTE: Like _fast_chunks in 058, this is a SYNC iterator. Per KI-001,
    `task.cancel()` cannot interrupt a sync iterator step; cancellation lands
    at the NEXT `await` (e.g. `queue.put`) after the current chunk yields.
    The test's <1s budget includes this gap (RESEARCH §"Cancellation
    Propagation Timeline" — worst-case 500ms+ for an in-flight chunk).
    """
    import time
    for i in range(count):
        time.sleep(delay)             # blocks the event loop briefly during chunk
        yield _make_sse_chunk(f"tok{i} ")
    yield _make_done_chunk()
```

**Critical:** `time.sleep` here keeps the producer awake long enough for the test client to disconnect; the event-loop block during sleep is bounded by `delay` and is exactly the KI-001 territory CONCUR-02 accepts. Do NOT use `asyncio.sleep` — the iterator is consumed by a sync `for chunk in stream:` loop in `agent_runner`, so it must be a sync generator.

**`_make_sse_chunk` and `_make_done_chunk` patterns (058 lines 84-103) — copy verbatim:**

```python
def _make_sse_chunk(content: str):
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_done_chunk():
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "stop"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk
```

#### LLM call counter pattern (NEW — RESEARCH §"Wave 0 Gaps" + I2)

058 does not need this; 059 requires it for Invariant I2 ("no NEW LLM calls fire after disconnect"). Pattern:

```python
class LLMCallCounter:
    """Thread-safe counter that records the timestamp of every
    create_adaptive_streaming_chat invocation so the test can assert
    no NEW calls fire AFTER the disconnect timestamp."""

    def __init__(self):
        self._timestamps: list[float] = []

    def record(self) -> None:
        self._timestamps.append(time.monotonic())

    def count_after(self, t0: float) -> int:
        return sum(1 for t in self._timestamps if t > t0)


# Wire it into the patched create_adaptive_streaming_chat:
def _make_counted_chat(counter: LLMCallCounter):
    def _patched(*args, **kwargs):
        counter.record()
        return (iter(_slow_chunks()), CallingMode.NATIVE)
    return _patched

# In the test:
counter = LLMCallCounter()
with patch(
    "app.api.threads.create_adaptive_streaming_chat",
    side_effect=_make_counted_chat(counter),
):
    ...
    t_disconnect = time.monotonic()
    # ... close stream ...
    await asyncio.sleep(1.0)   # give cancellation propagation budget
    assert counter.count_after(t_disconnect) == 0
```

**Landmine:** `agent_runner` may call `create_adaptive_streaming_chat` multiple times across iterations of the agent loop. Each iteration creates a new stream — the counter increments per call. The assertion is that `count_after(t_disconnect)` is **zero**, meaning no NEW iteration started after the disconnect.

#### Mid-stream disconnect primitive (058 lines 230-251 — `_consume_sse`)

```python
async def _consume_sse(client: httpx.AsyncClient, thread_id: str) -> None:
    try:
        async with client.stream(
            "POST",
            f"/threads/{thread_id}/messages",
            json={"content": "hello"},
            headers={"Authorization": "Bearer test-token"},
            timeout=30.0,
        ) as r:
            async for _ in r.aiter_lines():
                pass
    except asyncio.CancelledError:
        raise
    except Exception:
        pass
```

**059 modification — break after first chunk to trigger disconnect:**

```python
async def _read_then_disconnect(client: httpx.AsyncClient, thread_id: str) -> float:
    """Open SSE, read until first `data:` line lands, exit context (→ http.disconnect).

    Returns the monotonic timestamp at which the stream was closed (i.e.
    when the test triggered disconnect) so the test can measure cancellation
    latency from that point.
    """
    async with client.stream(
        "POST",
        f"/threads/{thread_id}/messages",
        json={"content": "hello"},
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as r:
        async for line in r.aiter_lines():
            if line.startswith("data:"):
                break    # ← exiting the `async with` here triggers ASGI http.disconnect
    return time.monotonic()
```

**Landmine — httpx hang (RESEARCH Pitfall 7):** Always set `timeout=30.0` on the stream call AND add `@pytest.mark.timeout(10)` on the test function. Both layers protect against Pitfall 4 (sentinel never sent) and Pitfall 7 (httpx ASGITransport sharing the same loop).

#### Test-body skeleton (mirrors 058 lines 258-335 — D-059-06 gating test)

```python
@pytest.mark.asyncio
@pytest.mark.timeout(10)   # belt-and-suspenders against Pitfalls 4 & 7
async def test_agent_task_cancels_on_disconnect():
    """Cancellation latency < 1.0s; no NEW LLM calls fire after disconnect.

    This is the D-059-06 merge gate. Maps to CONCUR-02 acceptance verbatim.
    """
    mock_supabase = _build_mock_supabase()
    counter = LLMCallCounter()

    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=_make_counted_chat(counter),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                t_disconnect = await _read_then_disconnect(c, THREAD_A)
                # Allow 1s budget for cancellation to propagate
                await asyncio.sleep(1.0)

                # I1: cancellation latency — measured via the absence of new LLM calls
                # I2: no NEW LLM calls after disconnect
                count_after = counter.count_after(t_disconnect)
                assert count_after == 0, (
                    f"Expected 0 LLM calls after disconnect, got {count_after}. "
                    f"Cancellation did not propagate within 1.0s."
                )
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    # I4: assistant message persisted (shielded persist completed)
    insert_calls = [
        call for call in mock_supabase.table("messages").insert.call_args_list
        if call.args and call.args[0].get("role") == "assistant"
    ]
    assert len(insert_calls) >= 1, (
        "Expected the shielded persist to insert an assistant message even "
        "after disconnect; got 0. Check that the producer's outer finally "
        "ran asyncio.shield(_persist_assistant_message())."
    )
```

**Landmines:**
- The `app.dependency_overrides` `try/finally` restoration pattern is mandatory (058 lines 277-279, 316-319). Forgetting it leaks the mock into subsequent tests. Reuse the exact pattern.
- The `tests.conftest._supabase` import is the project-specific way to restore the conftest-installed Supabase mock — confirmed used in 058. Verify this attribute exists in `backend/tests/conftest.py` before depending on it (058's import works, so it does).
- The `timeout=30.0` argument on `client.stream(...)` is required (Pitfall 7) — even though the test should complete in ~1s, the timeout guards against a regression where the producer hangs.

#### Optional second test — happy-path smoke (RESEARCH §"Wave 0 Gaps" — D-059-06 second test)

```python
@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_normal_stream_unchanged():
    """Smoke test: a normal end-to-end stream still emits the expected event
    sequence (delta → done → stream_end). Guards against accidental wire-
    format breakage from the queue refactor.
    """
    mock_supabase = _build_mock_supabase()
    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    types_seen: list[str] = []
                    async for line in r.aiter_lines():
                        if line.startswith("data:"):
                            payload = json.loads(line[len("data:"):].strip())
                            types_seen.append(payload.get("type"))
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    assert "delta" in types_seen
    assert "done" in types_seen
    assert "stream_end" in types_seen
```

**Reuses 058's `_fast_chunks`** — the smoke test wants a fast stream so it finishes quickly, unlike the disconnect test which needs slow chunks.

---

### `backend/app/api/_agent_runner.py` (controller helper — OPTIONAL extraction, Claude's discretion per D-059-01b)

**Analog:** The current closure body of `event_stream` at `threads.py:522-1791`.

**When to extract:** Only if the diff in `threads.py` is materially cleaner with the producer in a separate module. CONTEXT.md §"Claude's Discretion" explicitly states "Functionally equivalent; planner picks based on diff size and import-graph fit."

**If extracted, the function signature must accept all closed-over state explicitly:**

```python
async def agent_runner(
    queue: asyncio.Queue,
    *,
    current_user: dict,
    body: MessageCreate,
    thread_id: str,
    supabase: Client,
) -> None:
    """Producer task — runs the agent loop and pushes JSON payloads onto the queue.

    Lifted from the inline closure formerly at threads.py:522-1791 (Phase 059
    D-059-01b). See PATTERNS.md for the line-by-line transformation rules.

    Cancellation contract:
    - The route handler creates this task via `asyncio.create_task(...)`.
    - The route handler's consumer cancels this task on client disconnect
      (sse-starlette `_listen_for_disconnect` → consumer's finally → task.cancel()).
    - This function's outer try/finally pushes None as a queue sentinel.
    - The inner try/finally runs `asyncio.shield(_persist_assistant_message())`
      to guarantee the partial-response DB write completes even on cancel.
    - After the shielded persist, we re-raise CancelledError per RESEARCH §A5.
    """
    # body of the function here — same shape as the inline sketch above
```

**Imports the extracted module needs:** All imports currently in `threads.py:1-40` that are referenced inside the producer body. The planner does an import-graph audit when extracting (specifically: every helper called by `_persist_assistant_message`, every service from `app.services.*`, every API helper from `app.api.kb`, every model, etc.). Functionally easier to keep inline.

**Recommendation:** Default to **inline closure** (D-059-01b's preferred form). Extract only if the planner's draft of `threads.py` exceeds ~200 lines for the route handler's body and breaking it up genuinely improves readability.

---

### `backend/tests/integration/_sse_helpers.py` (test helper — OPTIONAL, Claude's discretion)

**Analog:** The helper functions at `test_058_concurrency.py:76-227`: `_make_result`, `_make_sse_chunk`, `_make_done_chunk`, `_fast_chunks`, `_thread_row`, `_message_row`, `_make_table_builder`, `_build_mock_supabase`, `_consume_sse`.

**When to extract:** If the planner judges that 058 + 059 sharing >100 lines of helpers warrants a shared module. Otherwise reuse via direct cross-import (`from tests.integration.test_058_concurrency import _make_table_builder, _build_mock_supabase`).

**Recommendation per CONTEXT.md "Test discovery":** "whether to put 059's mock-LLM patches in a shared `tests/integration/conftest.py` or reuse 058's fixture file directly." Two viable shapes:

1. **Cross-import from 058's test file** (zero new files; least intrusive).
2. **Extract to `_sse_helpers.py`** (clean but creates a new module; requires updating 058's test to import from it too — additional surface area).

**Default:** Option 1. Reuse 058's helpers via direct import. Extract only if a third SSE test (Phase 060+) materializes.

---

### `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` (docs — manual checklist, D-059-08)

**Analog:** `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` — D-059-08 explicitly mirrors D-058-10's format.

**Structure to mirror (058's section headings, in order):**

1. `# Phase 059 — Manual Verification Checklist` (header + Date/Tester/Environment table)
2. `## CI Gate (Automated — Binding)` — pytest command for the merge-gate test
3. `## Manual Two-Tab DevTools Timing Checklist` (the manual procedure)
   - `### Setup` — backend + frontend running, test user prepared
   - `### Procedure` — Tab A streams, Tab A is closed mid-stream
   - `### Expected Result` — table with Pre-059 / Post-059 / Your-result columns
   - `### Pass Criteria` — checkboxes for the three success conditions
   - `### Fail Action` — concrete debug steps if the test regresses
4. `## Notes` — free-form observations
5. `## Appendix — Why this checklist exists alongside the automated test` — rationale

**Specifics for 059's manual procedure (per D-059-08):**

```markdown
**Tab A — Start a streaming response and disconnect:**

1. Open the application in Tab A.
2. Open Chrome / Edge / Firefox DevTools → Network tab → filter by `XHR` or `Fetch`.
3. Open the backend's terminal/log window so you can watch for `CancelledError` log lines as they arrive.
4. In Tab A, send a message that will trigger a long LLM response
   (e.g. "Write a 1000-word essay about asyncio cancellation semantics").
5. Observe the SSE stream begin — DevTools shows the POST /threads/{id}/messages
   request as `(pending)` with a streaming response visible in the Response panel.
6. After ~2 seconds of streaming, **close the tab** (Cmd+W / Ctrl+W).
   - Note the wall-clock time of the close (or use a stopwatch).

**Backend log inspection — measure cancellation latency:**

7. Switch to the backend's terminal.
8. Wait up to 1 second after the tab close.
9. Search the log output for:
   - A `CancelledError` traceback (the producer task being cancelled), OR
   - The assistant-message persist log line (the shielded DB write completing).
10. Confirm that within 1 second of the tab close, the LLM API request count
    stops incrementing (no further `openai`/`anthropic`/`openrouter` calls fire).

### Expected Result

| Metric                                              | Pre-059 (broken)                        | Post-059 (fixed)                          | Your result   |
| --------------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------- |
| Time from tab close to `CancelledError` in logs     | Variable (sometimes never)              | < 1 second                                | [fill in]     |
| New LLM API calls fired AFTER tab close             | Up to N more (one per agent iteration)  | 0                                         | [fill in]     |
| Assistant message persisted in `messages` table     | May or may not (race condition)         | Yes (shielded persist always completes)   | [fill in]     |

### Pass Criteria

- [ ] Within 1 second of closing Tab A, the backend log shows `CancelledError`
      (or the producer's `finally` cleanup messages) and ceases all LLM calls.
- [ ] Querying `messages` for the test thread shows an assistant row was
      persisted (even though the client never received the full response).
- [ ] No `OSError` or transport-error tracebacks appear in the log
      (sse-starlette handles disconnect cleanly; if you see OSError tracebacks,
      that's a regression — the deleted `_SilentSSEIterator` was suppressing them).
```

**Landmines:**
- The 058 doc has the same `Notes` and `Appendix` sections. Mirror them exactly — D-058-10/D-059-08 format precedent is "the human-flow document; CI gate above is confirmatory only."
- Do NOT include any reference to a `/stop` endpoint or task registry — D-059-03 explicitly excludes both.
- Do NOT promise that the user will see the persisted message exactly match what they saw on screen. RESEARCH Pitfall 5 documents this is by-design: "the persisted assistant message in Postgres may have characters beyond what the client saw on screen ... CONCUR-02 explicitly accepts this."

---

## Shared Patterns

### `aexec` threadpool wrapper (apply to ALL Supabase calls inside `agent_runner`)

**Source:** `backend/app/utils/db.py` (lines 32-44, all 13 lines of it).

```python
async def aexec(query):
    """Run a sync supabase-py query off the event loop.

    Args:
        query: A Supabase query builder (the result of
            `supabase.table(...).select(...).eq(...)` etc., before
            `.execute()` is called).

    Returns:
        The same response object `query.execute()` would have returned —
        typically with `.data` (list[dict] or dict) and `.count` (int|None).
    """
    return await run_in_threadpool(query.execute)
```

**Apply to:** every `.execute()` call inside the new `agent_runner` body. Critical: **the entire current `event_stream` body already uses `await aexec(...)` everywhere** (verified by grepping `aexec` in `threads.py` — 22 occurrences per 058's verification doc). The 059 refactor MUST NOT introduce any sync `.execute()` calls. CONTEXT.md §"Established Patterns": "All Supabase reads/writes in the SSE path are `await aexec(...)` since 058. The new `agent_runner` inherits this naturally — no sync `.execute()` calls to migrate."

**Landmine — D-059-07 regression guard:** 058's test (`test_cross_tab_unblocked_during_sse`) expects the pre-stream INSERT to be `aexec`-wrapped. Any 059 change that removes `await aexec(...)` from the route handler's pre-stream INSERT (line 511) breaks 058. Treat 058 passing as a binding gate (CONTEXT.md D-059-07).

### `asyncio.shield` cancellation-safe cleanup pattern

**Source:** `backend/app/api/threads.py:1786-1791` (current — minimal change for 059).

```python
async def _shielded_persist():
    await _persist_assistant_message()
try:
    await asyncio.shield(_shielded_persist())
except asyncio.CancelledError:
    raise   # ← CHANGE from `pass` to `raise` (D-059-02 / RESEARCH §A5)
```

**Apply to:** the inner `finally` of `agent_runner`. This is the canonical cancellation-cleanup pattern (RESEARCH Pattern 2 + Pattern 3, official Python docs example).

**Landmines:**
- `asyncio.shield` only protects against EXTERNAL cancellation (RESEARCH Pitfall 3). Does not protect if the shielded coroutine self-cancels.
- The `try/except CancelledError: raise` MUST wrap the `await asyncio.shield(...)`, not be inside `_shielded_persist`. Wrapping the shield call is what protects the cleanup path; wrapping the inner coroutine would defeat the purpose.

### Sentinel-flush pattern for queue producers

**Source:** RESEARCH Example 4 + Pitfall 4 (the structural rule).

```python
async def producer(queue: asyncio.Queue):
    try:                            # OUTER → sentinel
        try:                        # INNER → cleanup with shield
            # ... body ...
        finally:
            await asyncio.shield(persist())
    finally:
        await queue.put(None)       # always last — guarantees consumer can exit
```

**Apply to:** `agent_runner` and any future producer task (none planned in 059, but the pattern locks in for Phase 060/061 reconnect work).

**Landmines:**
- Both `finally` blocks are mandatory. Pitfall 4: "If `agent_runner` raises an unhandled exception BEFORE its outer `finally` runs ... the consumer's `await queue.get()` blocks forever." The outer `finally` must wrap the entire body, including any setup before the inner `try`.
- Do NOT push the sentinel inside the inner finally — the inner finally is for the shield. If you push the sentinel there, an exception during the inner finally itself (rare but possible) skips the sentinel.

### Task drain pattern for consumers

**Source:** RESEARCH §"Pattern 1" + Open Question 1.

```python
async def consumer():
    try:
        while True:
            payload = await queue.get()
            if payload is None:
                break
            yield {"data": payload}
    finally:
        if not task.done():
            task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("agent_runner crashed")
```

**Apply to:** the `event_consumer` inside `send_message`. Surfaces non-cancellation exceptions for logging; prevents "Task was destroyed but it is pending!" warnings.

### Test fixture restoration via `dependency_overrides` `try/finally`

**Source:** `backend/tests/integration/test_058_concurrency.py:277-319` — verbatim pattern.

```python
from tests.conftest import _supabase as _conftest_supabase
app.dependency_overrides[get_supabase] = lambda: mock_supabase
try:
    # ... test body ...
finally:
    app.dependency_overrides[get_supabase] = lambda: _conftest_supabase
```

**Apply to:** every async test in `test_059_disconnect.py` that overrides `get_supabase`. Without restoration, subsequent tests pick up the per-test mock and break.

---

## No Analog Found

None. Every file has either an in-repo analog (close — same role + flow) or a self-reference (refactoring the file itself). The 058 phase is the canonical precedent for SSE testing; the 058 verification doc is the canonical precedent for the manual checklist.

---

## Metadata

**Analog search scope:**
- `backend/app/api/threads.py` (route handler with the SSE producer — lines 1-30, 490-528, 670-792, 814-895, 1750-1793)
- `backend/app/responses.py` (deletion target — entire file, 153 lines)
- `backend/app/utils/db.py` (the `aexec` shared pattern — entire file, 45 lines)
- `backend/requirements.txt` (existing pin format)
- `backend/tests/integration/test_058_concurrency.py` (canonical async-httpx SSE test — entire file, 336 lines)
- `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` (manual checklist format — entire file, 126 lines)

**Importer audit (D-059-05 safety):** Confirmed via `Grep("from app\\.responses|app\\.responses\\.", path=backend/app)` — exactly **one** match: `backend/app/api/threads.py:11`. Substring matches in `main.py`, `services/openai_service.py`, `api/skills.py`, `api/audit.py` are noise (the literal word "responses" in unrelated comments / `responses.create` chains, not module imports). Deletion is safe once `threads.py:11` is removed.

**Files scanned:** 6 (the targeted reads above + the importer Grep audit). Stopped at 5 strong matches — every analog was either an exact self-reference or the unique 058 precedent; broader search would not surface additional patterns.

**Pattern extraction date:** 2026-05-01

---

*Phase: 059-sse-architecture-refactor*
*Pattern map: PATTERNS.md (consumed by gsd-planner)*
