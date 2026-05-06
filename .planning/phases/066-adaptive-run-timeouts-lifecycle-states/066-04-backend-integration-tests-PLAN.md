---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 04
type: execute
wave: 3
depends_on: ["01", "02"]
files_modified:
  - backend/tests/integration/test_066_status_enum.py
  - backend/tests/integration/test_066_per_call_timer.py
  - backend/tests/integration/test_066_terminal_classification.py
  - backend/tests/integration/test_066_sse_terminal.py
  - backend/tests/integration/test_066_langsmith_clean.py
  - backend/tests/integration/test_061_hard_timeout.py
autonomous: true
requirements:
  - STREAM-04-polish

must_haves:
  truths:
    - "5 new integration test files exist under backend/tests/integration/test_066_*.py covering SC#2, SC#3, SC#4, SC#5, SC#7 from VALIDATION.md"
    - "test_066_status_enum.py asserts CHECK constraint admits 'timed_out' AND Pydantic Literal accepts 'timed_out' (SC#3)"
    - "test_066_per_call_timer.py asserts per-call timer fires within ε of budget (test_per_call_timer_fires_at_budget) AND timer resets per iteration (test_timer_resets_per_iteration) AND tool execution time does NOT count against budget (test_tool_exec_outside_timer) (SC#2 + D-066-02 + T-066-13)"
    - "test_066_terminal_classification.py is table-driven over (TimeoutError, CancelledError, Exception) → asserts terminal_status mapping AND DELETE-write-cancelled-not-timed_out partition guard (SC#4 + T-066-01)"
    - "test_066_sse_terminal.py asserts SSE consumer receives a `data: {\"type\": \"timed_out\", ...}` event distinct from `error` and `cancelled` (SC#5)"
    - "test_066_langsmith_clean.py asserts via caplog that no log line contains 'GeneratorExit' on TimeoutError path (SC#7)"
    - "test_061_hard_timeout.py is rewritten or skipped — it tests the deleted 120s wrapper which Plan 02 removed; the test must not be a false-positive RED on the new architecture"
    - "Full suite `pytest tests/integration/ -q` is green (no 058/059/060/061/062/063 regressions)"
  artifacts:
    - path: "backend/tests/integration/test_066_status_enum.py"
      provides: "DB CHECK + Pydantic Literal admits 'timed_out' (SC#3)"
      contains: "test_pydantic_literal_admits_timed_out"
    - path: "backend/tests/integration/test_066_per_call_timer.py"
      provides: "Per-call timer fires at budget; resets on iteration; tool exec outside budget (SC#2)"
      contains: "test_per_call_timer_fires_at_budget"
    - path: "backend/tests/integration/test_066_terminal_classification.py"
      provides: "Terminal mapping correctness + DELETE writes cancelled not timed_out (SC#4 + T-066-01)"
      contains: "test_delete_writes_cancelled_not_timed_out"
    - path: "backend/tests/integration/test_066_sse_terminal.py"
      provides: "Consumer receives distinct 'timed_out' SSE sentinel (SC#5)"
      contains: "test_consumer_receives_timed_out_sentinel"
    - path: "backend/tests/integration/test_066_langsmith_clean.py"
      provides: "No GeneratorExit log leak on TimeoutError (SC#7)"
      contains: "test_no_generator_exit_on_timeout"
    - path: "backend/tests/integration/test_061_hard_timeout.py"
      provides: "Rewritten to assert the wrapper is GONE (per Plan 02 deletion) OR explicitly skipped with reason"
      contains: "Phase 066"
  key_links:
    - from: "Plan 01 _terminal_status='timed_out' branch + 5-value enum"
      to: "test_066_terminal_classification.py + test_066_status_enum.py"
      via: "Tests assert mock_supabase update calls match new contract"
      pattern: 'status.*timed_out'
    - from: "Plan 02 per-call asyncio.timeout + stream.close()"
      to: "test_066_per_call_timer.py + test_066_langsmith_clean.py"
      via: "Slow-mock-LLM fixture stalls past per_call_budget; assertions on timing + caplog"
      pattern: "asyncio.timeout|caplog"
---

<objective>
Author the 5 new pytest integration test files specified in VALIDATION.md Wave 0 (covering SC#2, SC#3, SC#4, SC#5, SC#7) and rewrite-or-skip `test_061_hard_timeout.py` (which tests Plan 02's now-deleted wrapper). All tests use the existing `_run_helpers.py` mock infrastructure (Phase 061.1 IN-01) and follow the `redis_client + monkeypatch + httpx.AsyncClient + dependency_overrides` shape established by `test_061_hard_timeout.py` and `test_062_*.py`.

Purpose: Plan 04 is the validation safety net for the entire Phase 066 contract. Without these tests:
- Plan 01's CHECK constraint extension might silently regress (SC#3)
- Plan 02's per-call timer might fire outside the LLM block (SC#2)
- The DELETE/timer partition guard could break in a future refactor (SC#4 + T-066-01)
- The frontend's `timed_out` parser branch could lose its wire-format counterpart (SC#5)
- LangSmith trace cleanliness could regress silently (SC#7)
- The legacy `test_061_hard_timeout.py` would now fail in a misleading way (it asserts on deleted code)

Output: 6 test files (5 new + 1 rewritten); full suite green.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-VALIDATION.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/_run_helpers.py
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_061_hard_timeout.py
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_062_delete_happy.py
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_062_stream_terminal.py

<interfaces>
<!-- Test patterns and helpers the executor MUST reuse. -->

From backend/tests/integration/_run_helpers.py — shared mock builders (Phase 061.1 IN-01):
```python
# Imports already established
from tests.integration._run_helpers import (
    _build_mock_supabase,        # supabase APIResponse mock
    _make_done_chunk,            # OpenAI-shaped finish_reason='stop' chunk
    _make_sse_chunk,             # OpenAI-shaped delta chunk
    _extract_run_id_from_mock,   # pulls run_id from mock_supabase("runs").insert call args
    await_producer_finalized,    # waits for RUN_TASKS to drain (D-061.1-01/02/03)
)
```

Reference test pattern from test_061_hard_timeout.py (current — to be rewritten):
```python
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_120s_timeout_fires_full_finally(redis_client, monkeypatch):
    monkeypatch.setattr(settings, "run_hard_timeout_seconds", 2)
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_too_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream("POST", f"/threads/{THREAD_A}/messages", ...) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)
            run_id = _extract_run_id_from_mock(mock_supabase)
            # ... assertions ...
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

Phase 062 DELETE test pattern (test_062_delete_happy.py):
```python
# Calls DELETE /runs/{rid} → asserts mock_supabase.table("runs").update was called with status='cancelled'
```

From CONTEXT.md and Plan 02 SUMMARY.md (after Plan 02 ships): the producer's terminal classification at threads.py:~2140 reads from closure variables `_last_iteration / _last_model_id / _last_per_call_budget`. Tests assert on the formatted error string content `"timed_out: Ns per-call deadline exceeded at iteration N (model=...)"`.

From RESEARCH.md "Validation Architecture → Phase Requirements → Test Map" — full SC test map already enumerated; Plan 04 implements it.
</interfaces>

<key_decisions>
**File scope and naming:**
- 5 new files under `backend/tests/integration/`: `test_066_status_enum.py`, `test_066_per_call_timer.py`, `test_066_terminal_classification.py`, `test_066_sse_terminal.py`, `test_066_langsmith_clean.py`.
- 1 rewritten file: `test_061_hard_timeout.py`. Two strategies considered (CONTEXT.md Claude's Discretion):
  - **(a) Rewrite** to assert the wrapper is gone (e.g., grep `assert "asyncio.timeout(settings.run_hard_timeout_seconds)" not in open("backend/app/api/threads.py").read()`). Asserts a useful negative invariant.
  - **(b) Skip** with `@pytest.mark.skip(reason="Phase 066 D-066-01 deleted the 120s wrapper this test asserted on; replaced by per-LLM-call timer + test_066_per_call_timer.py")`.
  - **Choice: rewrite** — provides defense-in-depth against accidental wrapper reintroduction. Strategy (a) below in Task 5.

**Slow-mock fixture extension:** `_run_helpers.py` already has `_make_sse_chunk` and `_make_done_chunk`. For per-call timer tests, we need a **stall-before-yield** generator that sleeps inside the iteration loop. Inline this per-test rather than promoting to `_run_helpers.py` until 2+ tests share the helper.

**Vitest deferral noted:** Plan 03 already documented the Vitest deferral. Plan 04 is backend-only; pytest is fully available on this machine.

**Test isolation:** All Phase 066 tests follow the established Phase 062+ pattern — `redis_client` fixture (auto-flush per test), `monkeypatch` for settings overrides, `app.dependency_overrides[get_supabase]` for mock supabase. The autouse `_reset_redis_singleton` fixture (Phase 062 plan 02 deviation) is implicit via test file location.

**SC#3 split into TWO tests:** The CHECK-constraint test requires a live DB connection; the Pydantic-Literal test is pure-Python. Keep them in the same file (`test_066_status_enum.py`) but separate functions so the Pydantic test passes in any env (no DB dependency).
</key_decisions>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test fixtures ↔ production code | Tests must not bypass invariants they aim to verify. mock_supabase mirrors the production supabase shape; deviations would mask real bugs. |
| caplog ↔ langsmith wrapper | The "no GeneratorExit" assertion depends on caplog seeing what the LangSmith decorator would have seen. Since the project uses `langsmith.wrappers.wrap_openai`, the wrapper is in the call stack — caplog capture is reliable. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-066-12 | Tampering / regression | DELETE /runs/{rid} accidentally writes 'timed_out' instead of 'cancelled' (T-066-01 partition guard breaks) | mitigate | `test_delete_writes_cancelled_not_timed_out` explicitly drives DELETE → asserts mock_supabase update args contain `status='cancelled'` AND not `status='timed_out'`. |
| T-066-13 | Tampering | Per-call timer accidentally counts tool execution against budget → false-positive timed_out on long sandbox calls | mitigate | `test_tool_exec_outside_timer` patches `dispatch_tool` with a 90s sleep + sets per_call_budget=2s; asserts run completes WITHOUT timed_out (tool sleeps OUTSIDE the timer scope). |
| T-066-14 | Information Disclosure | Test fixture accidentally exposes API key fragments via the `runs.error` truncation path | mitigate | `test_failed_error_truncated_to_200_chars` asserts the produced `runs.error` string has length ≤ 200 chars even when the source exception message is 1000+ chars. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author test_066_status_enum.py (SC#3) and test_066_terminal_classification.py (SC#4 + T-066-01 partition guard)</name>
  <files>backend/tests/integration/test_066_status_enum.py, backend/tests/integration/test_066_terminal_classification.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-04, 05, 07, 08)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md "Validation Architecture → Phase Requirements → Test Map" SC#3 + SC#4 rows
    - C:/Vibe Apps/Agentic RAG/backend/tests/integration/_run_helpers.py (helpers — full file)
    - C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_061_hard_timeout.py (existing pattern reference)
    - C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_062_delete_happy.py (DELETE-test reference)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 81-94 (TERMINAL_TYPES + namespace map — Plan 01 result)
    - C:/Vibe Apps/Agentic RAG/backend/app/models/message.py (5-value Literal — Plan 01 result)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py lines 386-426 (cancel handler — partition-guard target)
  </read_first>
  <action>
**File 1 — `backend/tests/integration/test_066_status_enum.py`** with this content:

```python
"""Phase 066 SC#3: runs.status CHECK admits 'timed_out' + Pydantic Literal mirror.

Tests:
1. test_pydantic_literal_admits_timed_out — pure-Python; no DB required.
2. test_terminal_types_includes_timed_out — module-import assertion.
3. test_namespace_map_routes_timed_out — module-import assertion.

(The DB CHECK constraint is verified live in Plan 01 Task 2 SQL editor smoke
test — no integration test runs against the live DB CHECK because Postgres
DDL acquires ACCESS EXCLUSIVE lock and would conflict with parallel test
execution. The test_062 / test_063_1 pattern of mocking supabase is preserved.)
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE
from app.models.message import MessageResponse


def test_pydantic_literal_admits_timed_out():
    """SC#3: MessageResponse.run_status='timed_out' validates without error."""
    m = MessageResponse(
        id=uuid4(),
        thread_id=uuid4(),
        user_id=uuid4(),
        role="assistant",
        content="",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        run_status="timed_out",
    )
    assert m.run_status == "timed_out"


def test_pydantic_literal_rejects_unknown_status():
    """Negative: 'foo' is NOT a valid run_status — Literal must reject it."""
    with pytest.raises(ValidationError):
        MessageResponse(
            id=uuid4(),
            thread_id=uuid4(),
            user_id=uuid4(),
            role="assistant",
            content="",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            run_status="foo",  # type: ignore[arg-type]
        )


def test_terminal_types_includes_timed_out():
    """SC#3 + D-066-06: TERMINAL_TYPES set frozen at runtime; 'timed_out' present."""
    assert "timed_out" in TERMINAL_TYPES, (
        f"TERMINAL_TYPES must include 'timed_out' per D-066-06; got: {sorted(TERMINAL_TYPES)}"
    )
    # Sanity: legacy types still there
    assert "done" in TERMINAL_TYPES
    assert "error" in TERMINAL_TYPES
    assert "cancelled" in TERMINAL_TYPES


def test_namespace_map_routes_timed_out():
    """D-066-06: 5th row in _RUN_STATUS_TO_TERMINAL_TYPE maps timed_out → timed_out."""
    assert _RUN_STATUS_TO_TERMINAL_TYPE.get("timed_out") == "timed_out", (
        f"_RUN_STATUS_TO_TERMINAL_TYPE['timed_out'] must equal 'timed_out'; "
        f"got: {_RUN_STATUS_TO_TERMINAL_TYPE}"
    )
    # Sanity: legacy mappings unchanged
    assert _RUN_STATUS_TO_TERMINAL_TYPE["completed"] == "done"
    assert _RUN_STATUS_TO_TERMINAL_TYPE["failed"] == "error"
    assert _RUN_STATUS_TO_TERMINAL_TYPE["cancelled"] == "cancelled"
```

**File 2 — `backend/tests/integration/test_066_terminal_classification.py`** with this content:

```python
"""Phase 066 SC#4 + T-066-01: terminal-state classification correctness.

Three branches in agent_runner's outer try/except (threads.py:~2140-2159):
- TimeoutError       → status='timed_out',  error=f"timed_out: ..."  (Plan 02 format)
- CancelledError     → status='cancelled',  error=None  (raises after — UNCHANGED)
- generic Exception  → status='failed',     error=f"failed: <Class>: <truncated≤200>"

Plus the partition guard (T-066-01): DELETE /runs/{rid} (cancel verb) writes
status='cancelled' — NEVER 'timed_out'. The two terminal states are
strictly partitioned by source.
"""
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.api.threads import TERMINAL_TYPES
from app.config import settings
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    _extract_run_id_from_mock,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    """Sleeps past the lowered per-call budget — fires TimeoutError."""
    time.sleep(5.0)  # Plan 02 patches per_call_budget to ≤2s in tests
    yield _make_sse_chunk("never_emitted ")
    yield _make_done_chunk()


def _crashing_chunks():
    """Raises mid-stream — exercises the generic Exception branch."""
    yield _make_sse_chunk("hello ")
    raise RuntimeError("simulated provider crash with very long detail " * 30)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_timeout_branch_writes_timed_out(redis_client, monkeypatch):
    """SC#4: TimeoutError → runs UPDATE with status='timed_out' + error prefix='timed_out:'."""
    # Force per-call budget to fire fast. Plan 02 added get_per_call_timeout —
    # patch it to return 1s regardless of model.
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            await await_producer_finalized(mock_supabase)

            # Assert runs UPDATE with status='timed_out' and error prefix
            runs_builder = mock_supabase.table("runs")
            timed_out_updates = [
                c for c in runs_builder.update.call_args_list
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "timed_out"
                    and isinstance(c.args[0].get("error"), str)
                    and c.args[0]["error"].startswith("timed_out:")
                )
            ]
            assert timed_out_updates, (
                f"Expected runs UPDATE with status='timed_out' AND error.startswith('timed_out:'); "
                f"got: {runs_builder.update.call_args_list}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_failed_error_truncated_to_200_chars(redis_client, monkeypatch):
    """T-066-14 + D-066-07: generic Exception → status='failed' AND error length ≤ 200."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_crashing_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            await await_producer_finalized(mock_supabase)

            runs_builder = mock_supabase.table("runs")
            failed_updates = [
                c for c in runs_builder.update.call_args_list
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "failed"
                )
            ]
            assert failed_updates, (
                f"Expected runs UPDATE with status='failed'; "
                f"got: {runs_builder.update.call_args_list}"
            )
            err = failed_updates[-1].args[0]["error"]
            assert err.startswith("failed:"), f"error must start with 'failed:'; got {err!r}"
            assert len(err) <= 200 + len("failed: RuntimeError: "), (
                f"error length {len(err)} exceeds 200-char cap on detail (T-066-02 mitigation); "
                f"full string: {err!r}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_writes_cancelled_not_timed_out(redis_client):
    """T-066-01 partition guard: DELETE /runs/{rid} writes status='cancelled', NEVER 'timed_out'.

    The cancel handler at runs.py:386, 422-424 must continue producing
    'cancelled' even after Plan 02 introduced the timed_out lifecycle. Tests
    the zombie-heal path (RUN_TASKS empty + status='streaming' in mock).
    """
    mock_supabase = _build_mock_supabase()

    # Pre-populate a streaming run row that the DELETE handler will heal.
    run_id = uuid4()
    thread_id = THREAD_A

    # Configure the mock_supabase("runs").select(...).maybe_single() to return
    # an in-flight row owned by the test user. setup_zombie_state lives in
    # _run_helpers.py:356 (test_062_delete_zombie.py:29 only re-imports it).
    from tests.integration._run_helpers import setup_zombie_state  # noqa: E402
    setup_zombie_state(mock_supabase, run_id, thread_id)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(app=app, base_url="http://test") as c:
            r = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            )
        assert r.status_code == 204

        runs_builder = mock_supabase.table("runs")
        cancel_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and isinstance(c.args[0], dict) and c.args[0].get("status") == "cancelled"
        ]
        assert cancel_updates, (
            f"DELETE must write status='cancelled' (T-066-01 partition guard); "
            f"got: {runs_builder.update.call_args_list}"
        )
        # T-066-01 negation: NEVER 'timed_out' from the cancel verb
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and isinstance(c.args[0], dict) and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out_updates, (
            f"DELETE MUST NOT write status='timed_out' (T-066-01 partition guard violated); "
            f"got: {timed_out_updates}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

**Note on `setup_zombie_state` import:** Verified — the helper is a public `async def setup_zombie_state(...)` at `tests/integration/_run_helpers.py:356`. Import directly from `_run_helpers` (NOT from `test_062_delete_zombie`, which only re-imports it). DO NOT modify either file.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_status_enum.py -x -q 2>&amp;1 | tail -5 | grep -E "passed|^OK"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_terminal_classification.py::test_timeout_branch_writes_timed_out -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_terminal_classification.py::test_failed_error_truncated_to_200_chars -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
  </verify>
  <done>
    - 4 test functions pass: test_pydantic_literal_admits_timed_out, test_terminal_types_includes_timed_out, test_namespace_map_routes_timed_out, test_pydantic_literal_rejects_unknown_status
    - 3 test functions in test_066_terminal_classification.py pass: timeout branch, failed truncation, DELETE partition guard
    - All assertions are RED-then-GREEN against Plan 01 + Plan 02 deltas (NOT against pre-066 behavior)
  </done>
</task>

<task type="auto">
  <name>Task 2: Author test_066_per_call_timer.py — 4 subtests covering SC#2 (timer fires, quick call within budget, timer resets per iteration, tool exec outside timer) — and test_066_sse_terminal.py (SC#5)</name>
  <files>backend/tests/integration/test_066_per_call_timer.py, backend/tests/integration/test_066_sse_terminal.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-01, 02, 06)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md "Validation Architecture → SC#2 + SC#5"; "Pitfalls → 1 (sync iteration cancellation responsiveness)"
    - C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_062_stream_terminal.py (SSE consumer pattern for SC#5)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 1149-1244 (per-call timer wraps from Plan 02)
  </read_first>
  <action>
**File 1 — `backend/tests/integration/test_066_per_call_timer.py`**:

```python
"""Phase 066 SC#2: per-LLM-call asyncio.timeout machinery.

Three behaviors under test:
1. Timer fires within ε of budget on a chunk-stalled stream (D-066-02).
2. Timer RESETS per iteration (asyncio.timeout reset semantics — RESEARCH.md Pattern 1).
3. Tool execution time does NOT count against the per-call budget (D-066-02 — timer scope = LLM stream block ONLY).
"""
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    _extract_run_id_from_mock,
    await_producer_finalized,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    """Stalls 5s before any chunk — exercises the per-call timer."""
    time.sleep(5.0)
    yield _make_sse_chunk("late ")
    yield _make_done_chunk()


def _quick_then_done_chunks():
    """Yields one delta then done — completes well under any reasonable budget."""
    yield _make_sse_chunk("hello ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_per_call_timer_fires_at_budget(redis_client, monkeypatch):
    """SC#2 (a): timer fires within ε of per_call_budget — slow chunks → timed_out."""
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        start = time.monotonic()
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)
        elapsed = time.monotonic() - start

        # ε ≤ 5s tolerance — sync iteration only checks cancellation at await
        # boundaries (Pitfall 1), so timer fires shortly after the next chunk
        # arrives. _stalling_chunks sleeps 5s then yields, so elapsed should
        # be ≤ 6s (1s budget + 5s stall + small finalize overhead).
        assert elapsed < 8, (
            f"Per-call timer should fire within ~budget+stall (~6s); got {elapsed:.2f}s"
        )

        # Confirm runs UPDATE wrote timed_out
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, "Expected status='timed_out' update"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_quick_call_within_budget_completes(redis_client, monkeypatch):
    """SC#2 (b) — sanity: quick LLM stream completes (does NOT timed_out)."""
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 5)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_quick_then_done_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        # NOT timed_out — must be completed
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, f"Quick call wrongly marked timed_out: {timed_out}"
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, f"Expected status='completed'; got: {runs_builder.update.call_args_list}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


# Multi-iteration mock — yields enough chunks per iteration to drive a tool call,
# then a second iteration's chunks. Used to prove asyncio.timeout's per-iteration
# reset semantics (RESEARCH.md Pattern 1) — D-066-02.
def _two_iterations_each_within_budget():
    """First iteration emits a chunk that triggers a tool call (1.5s wall),
    second iteration emits a final chunk + done (1.5s wall). With per_call_budget=2s
    each iteration is within budget; the cumulative wall-time (~3s) is NOT --
    proves the timer resets at the start of each `async with asyncio.timeout(...)`
    block (one wrap per iteration in threads.py:~1149/1213 per Plan 02 Subtask 2b/2c).
    """
    # Iteration 1: stall 1.5s then yield a tool_call chunk + finish_reason='tool_calls'
    time.sleep(1.5)
    # Synthesize an OpenAI-shaped tool_call chunk (helper builders take only delta text;
    # we build inline so we can drive the tool path).
    from types import SimpleNamespace
    yield SimpleNamespace(
        choices=[SimpleNamespace(
            delta=SimpleNamespace(
                content=None,
                tool_calls=[SimpleNamespace(
                    index=0,
                    id="tc_1",
                    function=SimpleNamespace(name="echo", arguments='{"x":1}'),
                )],
            ),
            finish_reason=None,
        )],
    )
    yield SimpleNamespace(
        choices=[SimpleNamespace(
            delta=SimpleNamespace(content=None, tool_calls=None),
            finish_reason="tool_calls",
        )],
    )


def _second_iteration_quick_done():
    """Second iteration: 1.5s stall then final delta + done. Within 2s budget."""
    time.sleep(1.5)
    yield _make_sse_chunk("answer ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_timer_resets_per_iteration(redis_client, monkeypatch):
    """SC#2 (b) -- D-066-02: per-iteration reset.

    per_call_budget=2s. Iteration 1 takes 1.5s (within budget) + tool dispatch.
    Iteration 2 takes 1.5s (within budget). Total wall-time ~3s > 2s budget.

    If the timer did NOT reset between iterations, the cumulative 3s would
    fire the deadline. asyncio.timeout's contract is per-`async with` block --
    Plan 02 Subtask 2b/2c emit a fresh `async with asyncio.timeout(per_call_budget)`
    on EACH while-True iteration. This test proves it.
    """
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 2)

    # Each call to create_adaptive_streaming_chat returns a fresh iterator
    # (one per agent loop iteration). Use a side_effect list to drive two
    # distinct streams.
    streams = [
        (iter(_two_iterations_each_within_budget()), CallingMode.NATIVE),
        (iter(_second_iteration_quick_done()), CallingMode.NATIVE),
    ]

    # Use a real (cheap) tool dispatch -- patch dispatch_tool to a no-op fast return
    # so we exercise the agent loop's tool->next-iteration boundary.
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: streams.pop(0),
        ), patch(
            "app.api.threads.dispatch_tool",
            new=lambda *a, **k: {"ok": True, "result": "tool done"},
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        # MUST NOT be timed_out -- per-iteration reset proves cumulative > budget OK
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, (
            f"D-066-02 regression: cumulative wall-time exceeded per-iteration "
            f"budget but timer did NOT reset between iterations. "
            f"Updates: {runs_builder.update.call_args_list}"
        )
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, (
            f"Expected status='completed' after two within-budget iterations; "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


def _quick_call_then_tool_call():
    """First iteration LLM stream: 0.5s, yields a tool call. Within 2s budget."""
    time.sleep(0.5)
    from types import SimpleNamespace
    yield SimpleNamespace(
        choices=[SimpleNamespace(
            delta=SimpleNamespace(
                content=None,
                tool_calls=[SimpleNamespace(
                    index=0,
                    id="tc_2",
                    function=SimpleNamespace(name="slow_tool", arguments='{}'),
                )],
            ),
            finish_reason=None,
        )],
    )
    yield SimpleNamespace(
        choices=[SimpleNamespace(
            delta=SimpleNamespace(content=None, tool_calls=None),
            finish_reason="tool_calls",
        )],
    )


def _quick_call_then_done():
    """Second iteration LLM stream: 0.5s, final answer + done. Within 2s budget."""
    time.sleep(0.5)
    yield _make_sse_chunk("done ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(120)
async def test_tool_exec_outside_timer(redis_client, monkeypatch):
    """SC#2 (c) -- D-066-02 + T-066-13: tool execution does NOT count against per-call budget.

    per_call_budget=2s. Iteration 1 LLM call: 0.5s (well within budget).
    Tool dispatch: sleeps 90s (way past budget). Iteration 2 LLM call: 0.5s
    (within budget). Total wall-time ~91s.

    If the tool dispatch were INSIDE the asyncio.timeout block, the 90s sleep
    would fire the 2s deadline. Plan 02 Subtask 2b/2c places the per-call
    timer ONLY around the SDK iteration block (`for chunk in stream:` /
    `for _ant_event in _ant_gen:`) -- tool dispatch happens OUTSIDE the
    `async with asyncio.timeout(...)` block, between iterations.
    """
    import asyncio as _asyncio_mod
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 2)

    streams = [
        (iter(_quick_call_then_tool_call()), CallingMode.NATIVE),
        (iter(_quick_call_then_done()), CallingMode.NATIVE),
    ]

    async def _slow_tool_dispatch(*args, **kwargs):
        # Real wall-time sleep -- proves tool exec time does NOT count against
        # the LLM-call timer scope (D-066-02). Use asyncio.sleep so we don't
        # block the event loop entirely; the assertion is that no timed_out
        # is written despite total wall-time >> per_call_budget.
        await _asyncio_mod.sleep(90)
        return {"ok": True, "result": "slow tool done"}

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: streams.pop(0),
        ), patch(
            "app.api.threads.dispatch_tool",
            new=_slow_tool_dispatch,
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=120.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        # T-066-13 + D-066-02: 90s tool exec MUST NOT cause timed_out
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, (
            f"D-066-02/T-066-13 regression: tool exec time was counted against "
            f"per-call budget. 90s tool sleep with 2s budget produced timed_out -- "
            f"timer scope must be LLM stream block ONLY. "
            f"Updates: {runs_builder.update.call_args_list}"
        )
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, (
            f"Expected status='completed' (tool exec outside timer scope); "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

**Note on real `asyncio.timeout` semantics:** Both new tests use real `asyncio.timeout` (NOT mocked) and real `time.sleep` / `asyncio.sleep` durations to prove the per-iteration reset and tool-outside-scope contracts. Mocking `asyncio.timeout` itself would defeat the test purpose — Plan 02 Subtask 2b/2c emits real `async with asyncio.timeout(per_call_budget)` calls; the test must exercise the real implementation. The slow-mock-LLM fixture pattern (`_two_iterations_each_within_budget`, `_quick_call_then_tool_call`) extends the Phase 058 pattern of using `time.sleep` inside the synchronous chunk generator to drive deterministic stream timings.

**File 2 — `backend/tests/integration/test_066_sse_terminal.py`**:

```python
"""Phase 066 SC#5: SSE consumer receives a distinct `timed_out` terminal sentinel.

Wire format from D-066-06: TERMINAL_TYPES adds 'timed_out'; consumer breaks
on any TERMINAL_TYPES entry. The sentinel data shape is
{"type": "timed_out", "error": "<formatted string>"} — distinct from
{"type": "error", ...} (real failure) and {"type": "cancelled", ...} (user-Stop).
"""
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    _extract_run_id_from_mock,
    await_producer_finalized,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    time.sleep(5.0)
    yield _make_sse_chunk("never ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_consumer_receives_timed_out_sentinel(redis_client, monkeypatch):
    """SC#5: the Redis Stream contains a {type:'timed_out'} terminal entry — distinct from error/cancelled."""
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            # Read the entire stream; assert exactly one timed_out terminal sentinel
            entries = await redis_client.xrange(stream_key)
            timed_out_sentinels = [
                json.loads(e[1]["data"]) for e in entries
                if json.loads(e[1]["data"]).get("type") == "timed_out"
            ]
            assert timed_out_sentinels, (
                f"Expected at least one terminal sentinel with type='timed_out'; "
                f"all events: {[json.loads(e[1]['data']) for e in entries]}"
            )

            # Negation: must NOT have an 'error'-typed terminal (would be misclassification)
            error_sentinels = [
                json.loads(e[1]["data"]) for e in entries
                if json.loads(e[1]["data"]).get("type") == "error"
            ]
            assert not error_sentinels, (
                f"timed_out must NOT also emit type='error' — partition violation; got: {error_sentinels}"
            )

            # Negation: must NOT emit a 'cancelled' sentinel either
            cancelled_sentinels = [
                json.loads(e[1]["data"]) for e in entries
                if json.loads(e[1]["data"]).get("type") == "cancelled"
            ]
            assert not cancelled_sentinels, (
                f"timed_out must NOT also emit type='cancelled' — partition violation; got: {cancelled_sentinels}"
            )

            # The error payload (if present) starts with 'timed_out:' prefix
            payload = timed_out_sentinels[0]
            if payload.get("error"):
                assert payload["error"].startswith("timed_out:"), (
                    f"timed_out sentinel error must start with 'timed_out:' prefix per D-066-07; "
                    f"got: {payload['error']!r}"
                )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```
  </action>
  <verify>
    <automated>grep -q "def test_per_call_timer_fires_at_budget" "C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_066_per_call_timer.py"</automated>
    <automated>grep -q "def test_quick_call_within_budget_completes" "C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_066_per_call_timer.py"</automated>
    <automated>grep -q "def test_timer_resets_per_iteration" "C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_066_per_call_timer.py"</automated>
    <automated>grep -q "def test_tool_exec_outside_timer" "C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_066_per_call_timer.py"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_per_call_timer.py -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_sse_terminal.py -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
  </verify>
  <done>
    - test_066_per_call_timer.py contains 4 test functions: test_per_call_timer_fires_at_budget, test_quick_call_within_budget_completes, test_timer_resets_per_iteration, test_tool_exec_outside_timer
    - test_per_call_timer_fires_at_budget passes: timer fires within budget+ε on stalled stream
    - test_quick_call_within_budget_completes passes: quick call within budget completes (does NOT timed_out)
    - test_timer_resets_per_iteration passes: cumulative wall-time > budget across 2 iterations does NOT fire timer (D-066-02 per-iteration reset proven)
    - test_tool_exec_outside_timer passes: 90s tool sleep with 2s budget does NOT fire timer (D-066-02 + T-066-13 — tool exec outside scope proven)
    - test_066_sse_terminal.py passes: consumer sees {type:'timed_out', error:'timed_out: ...'} sentinel; no `error`/`cancelled` partition violations
  </done>
</task>

<task type="auto">
  <name>Task 3: Author test_066_langsmith_clean.py (SC#7) — caplog assertion no GeneratorExit on TimeoutError</name>
  <files>backend/tests/integration/test_066_langsmith_clean.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-11)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md "LangSmith clean termination"; "Pattern 2: Close-stream-then-raise on timeout"; "Pitfalls → 4 (wrap_openai)"
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md (Plan 02 close-then-raise pattern)
  </read_first>
  <action>
**File — `backend/tests/integration/test_066_langsmith_clean.py`**:

```python
"""Phase 066 SC#7: LangSmith trace clean on TimeoutError — no GeneratorExit leak.

D-066-11: when the per-call asyncio.timeout fires inside an SDK stream
iteration, the producer must call stream.close() (OpenAI/Google/OpenRouter)
or _ant_gen.close() (Anthropic) BEFORE re-raising. This converts the
LangSmith trace from "unexpected GeneratorExit at run_helpers.py:1680"
to a clean stream-end + TimeoutError.

This test asserts the symptom: caplog at WARNING+ level captures NO log
record whose path or message contains 'GeneratorExit'. (We can't assert
positively on LangSmith's internal state without a wrapper-injection
fixture; the negation on caplog is the cheapest reliable proxy.)
"""
import logging
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    await_producer_finalized,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    time.sleep(5.0)
    yield _make_sse_chunk("never ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_no_generator_exit_on_timeout(redis_client, monkeypatch, caplog):
    """SC#7 + D-066-11: TimeoutError path does NOT leak GeneratorExit into logs."""
    monkeypatch.setattr("app.config.get_per_call_timeout", lambda *a, **k: 1)
    caplog.set_level(logging.WARNING)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        # Assert: no caplog record contains 'GeneratorExit' in its message
        # OR pathname (covers both langsmith/run_helpers.py:1680 and any
        # synthetic exception trace).
        offending = [
            (rec.levelname, rec.name, rec.getMessage())
            for rec in caplog.records
            if "GeneratorExit" in rec.getMessage()
            or "GeneratorExit" in (rec.pathname or "")
        ]
        assert not offending, (
            f"D-066-11 violation: TimeoutError path leaked GeneratorExit into logs. "
            f"Offending records: {offending}"
        )

        # Sanity: we DID hit the timed_out path (otherwise the negation is vacuous)
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, "Test setup wrong — must have hit timed_out path"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_langsmith_clean.py -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
  </verify>
  <done>
    - test_066_langsmith_clean.py passes: no caplog record contains 'GeneratorExit'; timed_out path was actually exercised (sanity check)
  </done>
</task>

<task type="auto">
  <name>Task 4: Rewrite test_061_hard_timeout.py to assert the legacy wrapper is GONE (Plan 02 deletion)</name>
  <files>backend/tests/integration/test_061_hard_timeout.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md (confirms outer wrapper deleted)
    - C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_061_hard_timeout.py (current — to be replaced)
  </read_first>
  <action>
Replace the entire contents of `backend/tests/integration/test_061_hard_timeout.py` with:

```python
"""Phase 061 D-061-01 → Phase 066 D-066-01: legacy 120s wrapper deletion guard.

Phase 061 introduced `async with asyncio.timeout(settings.run_hard_timeout_seconds)`
at threads.py:855 to bound abandoned producer runs (D-061-01). Phase 066
DELETES that wrapper (D-066-01) and replaces it with per-LLM-call timers
inside the iteration loop (D-066-02). The agent loop now has no hard
total cap — matches Claude/ChatGPT UX.

This file used to verify the wrapper's behavior (`test_120s_timeout_fires_full_finally`).
Phase 066 repurposes it to a deletion guard: the wrapper line is gone, AND
the legacy setting `Settings.run_hard_timeout_seconds` is gone. Re-introduction
of either would silently regress to the Gap-006 architecture.

The new lifecycle behavior is covered by:
- tests/integration/test_066_per_call_timer.py (per-call timer fires correctly)
- tests/integration/test_066_terminal_classification.py (timed_out terminal mapping)
- tests/integration/test_066_sse_terminal.py (SSE wire-format)
- tests/integration/test_066_langsmith_clean.py (no GeneratorExit leak)
"""
from pathlib import Path

import pytest


# Resolve project root from this test file's location:
# backend/tests/integration/test_061_hard_timeout.py → ../../../
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_THREADS_PY = _PROJECT_ROOT / "backend" / "app" / "api" / "threads.py"
_CONFIG_PY = _PROJECT_ROOT / "backend" / "app" / "config.py"


def test_legacy_outer_wrapper_is_gone():
    """D-066-01: the asyncio.timeout(settings.run_hard_timeout_seconds) wrapper at threads.py:~855 is DELETED."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    # The exact source line that used to live at threads.py:855
    assert "asyncio.timeout(settings.run_hard_timeout_seconds)" not in src, (
        "Phase 066 D-066-01 deletion regression: the outer 120s asyncio.timeout "
        "wrapper at threads.py:~855 is back. This is the bug Gap-006 reported "
        "and Plan 02 fixed. Re-deletion required."
    )


def test_legacy_setting_run_hard_timeout_seconds_is_gone():
    """D-066-01 + Plan 02 SUMMARY: Settings.run_hard_timeout_seconds field is removed.

    The env var name `RUN_HARD_TIMEOUT_SECONDS` is silently parsed-and-ignored
    by Pydantic Settings (`extra='ignore'` at config.py:129) so legacy deploys
    don't error at startup. But the field itself is gone — references should
    fail at import time.
    """
    src = _CONFIG_PY.read_text(encoding="utf-8")
    # The class-attribute declaration line
    assert "run_hard_timeout_seconds: int" not in src, (
        "Phase 066 deletion regression: Settings.run_hard_timeout_seconds field "
        "is back. Plan 02 removed it; per-call budgets live on MODEL_CAPABILITIES "
        "now. Re-deletion required."
    )


def test_per_call_timer_replacements_present():
    """Defense-in-depth: the per-call asyncio.timeout(per_call_budget) wraps appear at least once each."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    n = src.count("async with asyncio.timeout(per_call_budget)")
    assert n >= 2, (
        f"Expected >=2 occurrences of `async with asyncio.timeout(per_call_budget)` "
        f"(Anthropic + OpenAI paths per D-066-02); found {n}. The wrapper deletion "
        f"in test_legacy_outer_wrapper_is_gone passing without these replacements "
        f"means the per-call timer is missing — runs would never time out."
    )


def test_sdk_close_methods_present():
    """D-066-11: stream.close() and _ant_gen.close() appear in threads.py."""
    src = _THREADS_PY.read_text(encoding="utf-8")
    assert "stream.close()" in src, (
        "D-066-11 regression: OpenAI Stream.close() call missing. LangSmith "
        "would record GeneratorExit on TimeoutError without this."
    )
    assert "_ant_gen.close()" in src, (
        "D-066-11 regression: Anthropic _ant_gen.close() call missing."
    )
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_061_hard_timeout.py -x -q 2>&amp;1 | tail -5 | grep -E "passed"</automated>
  </verify>
  <done>
    - test_061_hard_timeout.py rewritten with 4 deletion-guard tests
    - All 4 tests pass: outer wrapper gone, Settings field gone, per-call timer present, SDK close methods present
    - File no longer imports `app.config.settings.run_hard_timeout_seconds` (would fail import otherwise)
  </done>
</task>

<task type="auto">
  <name>Task 5: Run full integration suite to confirm no regression in 058/059/060/061/062/063/063.1 + commit Plan 04</name>
  <files>backend/tests/integration/test_066_status_enum.py, backend/tests/integration/test_066_per_call_timer.py, backend/tests/integration/test_066_terminal_classification.py, backend/tests/integration/test_066_sse_terminal.py, backend/tests/integration/test_066_langsmith_clean.py, backend/tests/integration/test_061_hard_timeout.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (full sample of new tests' coverage)
    - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-VALIDATION.md (sampling rate + Wave 0 gaps to confirm fulfilled)
  </read_first>
  <action>
**Subtask 5a — Full suite gate:** Run the full integration suite from `backend/`:

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/integration/ -q 2>&1 | tail -30
```

Expected: all tests pass (or pre-existing failures unrelated to Plan 04 — 15 known backend test failures from side-phase 002 per STATE.md "Blockers/Concerns"; test_threads_skills.py / test_skills_import_export.py drift per Phase 065 plan). Document any new failures as either:
- Plan 04 regressions → fix before commit
- Pre-existing → record in SUMMARY.md with `pytest -k "not <name>"` workaround if needed

**Subtask 5b — Commit Plan 04 deliverables:**

Stage exactly these 6 files:

```bash
git add \
  backend/tests/integration/test_066_status_enum.py \
  backend/tests/integration/test_066_per_call_timer.py \
  backend/tests/integration/test_066_terminal_classification.py \
  backend/tests/integration/test_066_sse_terminal.py \
  backend/tests/integration/test_066_langsmith_clean.py \
  backend/tests/integration/test_061_hard_timeout.py
```

Commit (HEREDOC):

```
test(066-04): integration test suite for adaptive run timeouts + lifecycle states

Phase 066 SC#2 / SC#3 / SC#4 / SC#5 / SC#7 from VALIDATION.md Wave 0.
5 new files + 1 rewritten file. Backend pytest suite now binds Plan 01
+ Plan 02 contract surface against regression.

- test_066_status_enum.py (SC#3): Pydantic Literal admits 'timed_out';
  TERMINAL_TYPES set has 5 values; _RUN_STATUS_TO_TERMINAL_TYPE map has
  5 rows. Pure-Python — no DB dep (live CHECK verified in Plan 01 Task 2
  SQL editor smoke test).
- test_066_per_call_timer.py (SC#2): timer fires within ε of budget on
  stalled stream; quick call completes well under budget.
- test_066_terminal_classification.py (SC#4 + T-066-01): TimeoutError
  → status='timed_out' + error prefix='timed_out:'. Generic Exception
  → status='failed' + error length capped at ~200 chars (T-066-02
  mitigation). DELETE /runs/{rid} → status='cancelled' AND NEVER
  status='timed_out' (T-066-01 partition guard).
- test_066_sse_terminal.py (SC#5): Redis Stream contains exactly one
  {type:'timed_out'} terminal sentinel; no 'error' or 'cancelled'
  partition violations.
- test_066_langsmith_clean.py (SC#7 + D-066-11): caplog asserts no
  'GeneratorExit' substring on TimeoutError path; sanity-checks the
  timed_out path was actually exercised.
- test_061_hard_timeout.py REWRITTEN: was a positive-behavior test of
  the now-deleted 120s wrapper. Now a 4-test deletion-guard:
    1. asyncio.timeout(settings.run_hard_timeout_seconds) is gone
    2. Settings.run_hard_timeout_seconds field is gone
    3. async with asyncio.timeout(per_call_budget) appears >=2 times
    4. stream.close() and _ant_gen.close() both present
  Defense-in-depth against accidental re-introduction.

Vitest deferred per Phase 063.1 plan precedent (npm optional-dep cascade);
frontend behavior verified in Plan 05 live UAT.

Full backend suite (058/059/060/061/062/063/063.1/066) passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py tests/integration/test_061_hard_timeout.py -q 2>&amp;1 | tail -3 | grep -E "passed"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --pretty=%s | grep -q "066-04"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --name-only --pretty=format: | grep -c "test_066_" | tr -d ' ' | grep -E "^5$"</automated>
  </verify>
  <done>
    - All 5 new test files pass
    - Rewritten test_061_hard_timeout.py passes
    - Full integration suite green (058/059/060/061/062/063/063.1/066) — pre-existing failures (Phase 065 scope) untouched
    - Single commit on current branch
  </done>
</task>

</tasks>

<verification>
- All 7 grep gates from Tasks 1-5 pass
- Phase 066 subset: `pytest tests/integration/test_066_*.py tests/integration/test_061_hard_timeout.py -q` reports passed
- Full suite: `pytest tests/integration/ -q` reports no NEW failures vs pre-Plan-04 baseline
- One commit landed
</verification>

<success_criteria>
- 5 new test files exist and pass — covering SC#2, SC#3, SC#4, SC#5, SC#7
- Rewritten test_061_hard_timeout.py passes — guards against accidental wrapper re-introduction
- T-066-01 (DELETE → cancelled), T-066-02 (≤200 char traceback cap), T-066-13 (tool exec outside timer) all explicitly tested
- Full backend integration suite green (no Plan 04 regressions)
</success_criteria>

<output>
After completion, create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-04-SUMMARY.md` documenting:
- Final test counts: 5 new files, 1 rewritten, X total assertions
- Any tests that needed adaptation (e.g., setup_zombie_state import shape)
- Pre-existing failures observed in the full suite (kept exact list for triage; expected to match STATE.md "Blockers/Concerns")
- Plan 05 prerequisite: with the test suite green, the user can confidently re-run the Gap-006 prompt knowing all four corners of the lifecycle contract are bound
</output>
