---
phase: 065-skills-test-infrastructure-repair
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/tests/integration/test_threads_skills.py
autonomous: true
gap_closure: true
requirements: [TEST-DEBT-059]
must_haves:
  truths:
    - "All 11 tests in test_threads_skills.py pass at execution (not just collection) — pytest reports 11 passed, 0 failed, 0 errors"
    - "The combined skills test run (`pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q`) reports 0 errors, 0 failed, AND 0 skipped/xfailed (no test silenced via @pytest.mark.skip / @pytest.mark.xfail / pytest.skip() to fake a green) — closes ROADMAP SC-3"
    - "Each test's user-message INSERT mock returns a row carrying an `id` field, so production threads.py:921-933 does not abort send_message with HTTP 500 (closes BL-01)"
    - "Each test follows the Phase 063 two-step pattern: POST returns 201 JSON {message_id, run_id}; SSE events are consumed from GET /runs/{run_id}/stream?since=0 (closes WR-01)"
    - "Each test uses a per-test thread_id (fixture or local uuid4) — module-level THREAD_ID singleton at line 23 is removed (closes WR-02)"
    - "058 + 059 binding gates remain green: `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` PASS and the rest of `test_059_disconnect.py` is unchanged (Plan 065-01 baseline preserved)"
  artifacts:
    - path: backend/tests/integration/test_threads_skills.py
      provides: "11 integration tests that actually execute the skills code path (catalog injection, explorer mode tools, load_skill, save_skill, read_skill_file, skill_activated event, load_skill_files filenames)"
      contains: "_build_mock_supabase"
      min_lines: 600
  key_links:
    - from: "backend/tests/integration/test_threads_skills.py (POST call sites)"
      to: "POST /threads/{tid}/messages → JSONResponse({message_id, run_id})"
      via: "ac.post(...) then resp.json()['run_id']"
      pattern: 'await ac\.post\(\s*f?"/threads/'
    - from: "backend/tests/integration/test_threads_skills.py (SSE consumption)"
      to: "GET /runs/{run_id}/stream?since=0"
      via: "ac.stream('GET', ..., timeout=...)"
      pattern: 'ac\.stream\(\s*"GET"'
    - from: "backend/tests/integration/test_threads_skills.py (Supabase override)"
      to: "tests.integration._run_helpers._build_mock_supabase"
      via: "app.dependency_overrides[get_supabase] = lambda: mock_supabase"
      pattern: "_build_mock_supabase"
    - from: "backend/tests/integration/test_threads_skills.py (Redis loop binding)"
      to: "_reset_redis_singleton autouse fixture (per-test scope)"
      via: "app.dependencies._redis = None pre/post test"
      pattern: "_reset_redis_singleton"
---

<objective>
Close the single SC-3 verification gap from `065-VERIFICATION.md` by repairing the 11 tests in `backend/tests/integration/test_threads_skills.py` so that they actually execute against the production code path, instead of short-circuiting at the user-message INSERT mock and silently returning `[]` from `_collect_sse_events()` against a JSONResponse.

Two compounding root causes (independently confirmed by the verifier as BL-01 + WR-01 + WR-02 in `065-VERIFICATION.md` and `065-REVIEW.md`):

1. **INSERT-id mock deficit (BL-01).** Every test provides `_make_result([])` for the user-message INSERT at index 1 of its `mock_builder.execute.side_effect` array (lines 116, 157, 209, 265, 319, 365, 408, 461, 505, 549, 612). Production `threads.py:921-933` aborts with HTTP 500 when the INSERT response carries no `id`. The patched `create_adaptive_streaming_chat` is therefore never reached.

2. **SSE-on-POST architecture staleness (WR-01).** Every test calls `client.stream("POST", ...)` and expects to drain SSE via `_collect_sse_events()`. Phase 063 (D-063-01) hard-cut this path: `send_message` now returns `JSONResponse(status_code=201, content={"message_id": ..., "run_id": ...})` at `threads.py:2719-2725`. `_collect_sse_events()` filters for `"data: "` lines and finds none, so every event-shape assertion silently fails.

This plan migrates the 11 tests to the canonical Phase 063 pattern that already ships in `backend/tests/integration/test_063_post_then_subscribe.py`:
- Use `_build_mock_supabase()` from `_run_helpers.py` (per-table routing) instead of the conftest's flat-side_effect-array approach. The conftest's shared `_builder` cannot serve a two-phase POST→GET-stream test cleanly (the runs ownership SELECT lands at an unpredictable index).
- POST returns 201 JSON; read `run_id = resp.json()["run_id"]`.
- After POST, configure `mock_supabase.table("runs").execute.side_effect` to return the streaming-status row that the GET stream's ownership SELECT (`runs.py:342-348`) needs.
- Open `ac.stream("GET", f"/runs/{run_id}/stream?since=0", ...)` and drain until any `TERMINAL_TYPES` event.
- Use the `redis_client` fixture (real Redis from conftest) so the producer's XADDs are XREAD-able by the GET stream consumer.
- Add the per-test `_reset_redis_singleton` autouse fixture (verbatim copy from `test_062_stream_replay.py:36-51` / `test_063_post_then_subscribe.py:45-62`) — required because pytest-asyncio function-scope creates a fresh event loop per test, and the cached Redis singleton would otherwise be invoked against a closed loop.
- Convert module-level `THREAD_ID = str(uuid4())` (line 23) to per-test scope (closes WR-02 latent flake source).
- Fix IN-01 cosmetic: assertion-message strings still reference the old name `create_streaming_chat` — update to `create_adaptive_streaming_chat`.

The 11 test purposes do NOT change. They still assert: catalog injection (system prompt content), explorer-mode tool list, load_skill SSE event + content, save_skill behavior, read_skill_file storage download, skill_activated SSE event ordering, load_skill_files filenames in tool result. Only the wiring updates.

Out of scope (per `065-VERIFICATION.md` deferred section): D-065-01-DEFER-2 (`test_059_disconnect.py::test_normal_stream_unchanged` Event-loop-closed pre-existing failure). Plan 065-03 must NOT touch `test_059_disconnect.py`.

**Scope-risk acknowledgement (per Iteration-1 checker WARNING #2 — option (b) chosen):** Task 1 is a ~150-200 LOC rewrite of a 670-line file with 7 coordinated edits (A-G) and 11 per-test variations. To prevent runaway defects, an explicit mid-task checkpoint after edits A-D is enforced (see `<checkpoint>` block inside Task 1) — the helper + fixtures + module imports must land first and pass `ast.parse` + `pytest --collect-only` BEFORE the per-test migration in edit E begins. This is cheap insurance against off-by-one in the helper's call counters or a missed import that would otherwise propagate to all 11 tests and require a full re-read to debug.

Output: A single repaired `test_threads_skills.py` + an atomic commit + a SUMMARY.md. No production code touched (per Phase 065 charter).
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/065-skills-test-infrastructure-repair/065-VERIFICATION.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/065-skills-test-infrastructure-repair/065-REVIEW.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/065-skills-test-infrastructure-repair/065-01-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/065-skills-test-infrastructure-repair/deferred-items.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_threads_skills.py
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_063_post_then_subscribe.py
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/_run_helpers.py
@C:/Vibe Apps/Agentic RAG/backend/tests/conftest.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py

<interfaces>
<!-- Key contracts the executor must respect. Extracted from the actual codebase. -->
<!-- DO NOT explore the codebase further; these are sufficient. -->

### Production POST contract (Phase 063 D-063-01) — `backend/app/api/threads.py:2719-2725`
```python
return JSONResponse(
    status_code=status.HTTP_201_CREATED,
    content={
        "message_id": str(_user_msg_id),
        "run_id": str(run_id),
    },
)
```
The POST response is **JSON, not SSE**. Tests must read `run_id` from `resp.json()["run_id"]` then open a separate GET stream.

### Production user-message INSERT contract — `backend/app/api/threads.py:905-933`
```python
_user_msg_resp = await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    })
)
_user_msg_data = _user_msg_resp.data if _user_msg_resp is not None else None
if isinstance(_user_msg_data, list):
    _user_msg_id = _user_msg_data[0].get("id") if _user_msg_data else None
elif isinstance(_user_msg_data, dict):
    _user_msg_id = _user_msg_data.get("id")
else:
    _user_msg_id = None
if not _user_msg_id:
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to persist user message",
    )
```
Mocks MUST return a list-with-id (`[{"id": "<uuid>"}]`) or a dict-with-id (`{"id": "<uuid>"}`) — NOT `[]` (current state).

### Production GET stream ownership SELECT — `backend/app/api/runs.py:342-352`
```python
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id, error")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```
After POST returns the run_id, configure `mock_supabase.table("runs").execute.side_effect` to return a row with `{run_id, status: "streaming", thread_id, error: None}`. Use the canonical pattern from `test_063_post_then_subscribe.py:135-140`:
```python
runs_builder = mock_supabase.table("runs")
runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
    "data": {"run_id": run_id, "status": "streaming",
             "thread_id": tid, "error": None},
    "count": None,
})()
```

### Production import — `backend/app/api/threads.py:33`
```python
from app.services.openai_service import create_adaptive_streaming_chat, get_llm_client, ... CallingMode, ...
```
Patch target is `app.api.threads.create_adaptive_streaming_chat` (Plan 065-01 already fixed this — preserve it).

### Production unpack — `backend/app/api/threads.py:1475`
```python
stream, calling_mode = create_adaptive_streaming_chat(
    messages=messages,
    model=body.model,
    user_settings=user_settings,
    tool_choice=tool_choice,
    tools_override=active_tools,
)
```
Fakes return `(iter([...]), CallingMode.NATIVE)` (Plan 065-01 already fixed this — preserve it).

### Canonical helpers — `backend/tests/integration/_run_helpers.py`
```python
def _make_result(data):
    """Mimic the supabase APIResponse contract used by aexec() consumers."""
    r = MagicMock()
    r.data = data
    r.count = len(data) if isinstance(data, list) else None
    return r

def _build_mock_supabase():
    """Build a mock supabase client with per-table routing.

    The 'messages' / 'threads' / 'runs' tables each have their own builder
    so insert/update call_args_list inspection works without flat-side_effect
    contention. The default_builder serves all other tables (skills, etc.)
    with _make_result([]) — override per-test as needed.
    """
    # Returns a mock supabase client; the user_id used by inner threads_execute
    # is USER_ID = "00000000-0000-0000-0000-000000000001" (matches conftest.mock_user_data).
```
For tests that need non-empty catalog or skill rows, override the `default_builder` (or a specific table's builder) AFTER calling `_build_mock_supabase()`. Pattern:
```python
mock_supabase = _build_mock_supabase()
# Default behavior: messages.insert returns one row, runs.insert+select returns
# empty, all other tables return empty list.
# To override for a test that needs a specific table call to return data, you
# must replace that table's builder OR use a side_effect on .execute that
# inspects call_args.
```

### Canonical Redis-singleton-reset fixture — verbatim from `test_062_stream_replay.py:36-51` / `test_063_post_then_subscribe.py:45-62`
```python
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

### Canonical POST → GET stream pattern — verbatim from `test_063_post_then_subscribe.py:67-168`
```python
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_xxx(redis_client):
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=fake_create_streaming_chat,   # tuple-returning fake
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
                    f"/threads/{tid}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "hello", "agent_mode": "default"},
                )
                assert resp.status_code == 201
                assert resp.headers.get("content-type", "").startswith("application/json")
                run_id = resp.json()["run_id"]

                # Pitfall 4: producer needs ~200ms to schedule its first XADD;
                # otherwise the GET consumer sees an empty key + runs.status='streaming'
                # and synthesizes 'buffer_expired_while_streaming' instead of tailing.
                import asyncio as _asyncio_inner
                await _asyncio_inner.sleep(0.2)

                # Configure runs ownership SELECT for the GET stream.
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": tid, "error": None},
                    "count": None,
                })()

                events = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    assert stream_resp.status_code == 200
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

### TERMINAL_TYPES import — `backend/app/api/threads.py:88`
```python
from app.api.threads import TERMINAL_TYPES   # frozenset({"done", "error", "cancelled", "timed_out"}) — 4 elements, NO "stream_end"
```
**Iteration-1 checker BLOCKER fix:** Verified at `backend/app/api/threads.py:88` — production is `TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})`. Do NOT construct fakes that emit `'stream_end'` as the terminal sentinel — it would never break the GET-stream drain loop and `@pytest.mark.timeout(15)` would fire after the producer's natural completion. The fake's terminator is the `done` chunk emitted by `_make_done_chunk()` which the producer translates to a `done` SSE event (per `_RUN_STATUS_TO_TERMINAL_TYPE` at threads.py:95-99: `completed → done`).

Also import `from app.dependencies import get_supabase` and `from app.main import app`.

### Catalog / skills / storage data — how to override per-test
The `_build_mock_supabase()` `default_execute` returns `_make_result([])`. The 11 tests need specific data on specific tables (catalog rows on `skills`, file rows on `skill_files`, ownership row on `threads`). Two override patterns are acceptable:

**Pattern 1 (preferred — test-local helper):** wrap `_build_mock_supabase()` in a per-test helper that replaces the `default_builder.execute.side_effect` with a callable inspecting `args[0]` (the table name passed to `.table()`) and returning per-table data. This mirrors the canonical analog's per-table routing extension pattern.

**Pattern 2 (acceptable for tests that only need ONE non-default table):** patch `mock_supabase.table` so that for the specific table name it returns a builder whose `.execute.side_effect` returns the desired list, while all other names fall through to the default. This is straightforward when only `skills` (catalog) or `skill_files` needs specific data.

For TestCatalogInjection, TestExplorerModeNoSkills (catalog-empty), TestSaveSkill, the default `_make_result([])` is sufficient for all reads after the user-INSERT (Pattern 2 only needed for the catalog/skills reads). For TestLoadSkill, TestReadSkillFile, TestSkillActivatedEvent, TestLoadSkillFiles, the executor must override the `skills` and `skill_files` table builders.

The conftest fixture `mock_builder` is no longer used by these tests after the migration; do NOT remove the fixture from conftest.py (other test files rely on it).

### `agent_mode` body parameter
Tests pass `"agent_mode": "default"` (10/11 tests) or `"agent_mode": "explorer"` (1/11). Preserve verbatim — these drive the system-prompt branch under test.

### Captured-messages mechanism
The fakes use closure capture: `captured_messages = []` defined OUTSIDE the fake, then `def fake_create_streaming_chat(messages, **kwargs): captured_messages.extend(messages); return iter(...), CallingMode.NATIVE`. After the test consumes events, assertions read `captured_messages`. This pattern is preserved verbatim — the fake itself is unchanged; only the surrounding wiring (POST→GET-stream, mock_supabase override) changes.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Migrate the 11 tests in test_threads_skills.py to the Phase 063 POST→GET-stream pattern with per-table mock_supabase routing</name>
  <files>backend/tests/integration/test_threads_skills.py</files>

  <read_first>
    1. Read `backend/tests/integration/test_threads_skills.py` in full (currently 670 lines, under the 2000-line single-read budget). Note the 11 patch sites + 11 fake-function definitions left by Plan 065-01 — those are CORRECT and must be preserved verbatim (the patch target string and the tuple-shaped return are already right).
    2. Read `backend/tests/integration/test_063_post_then_subscribe.py` in full (170 lines). This is the canonical analog for the POST→GET-stream pattern; the migrated tests will mirror its structure (autouse Redis-reset fixture, async test functions, dependency override, patches, ASGITransport client, POST/GET pair, terminal-event drain loop).
    3. Read `backend/tests/integration/_run_helpers.py` in full (415 lines). Note `_make_result(data)`, `_build_mock_supabase()` per-table routing, `USER_ID` constant, and the executor will reuse `_make_result` (not the local one in test_threads_skills.py) since the migrated module needs it for the per-table override path.
    4. Read `backend/tests/conftest.py` (224 lines). Note: the conftest's autouse `reset_mocks` fixture only resets the shared `_builder`; it does NOT touch `app.dependency_overrides[get_supabase]` set by individual tests, so the test's own `try/finally` must restore it. Also note `redis_client` fixture (lines 174-199) and `_reset_redis_singleton` is NOT in conftest — it must be added per-file (matching `test_063_post_then_subscribe.py:45-62`).
    5. Read `backend/app/api/threads.py` lines 905-933 to confirm the user-message INSERT contract (must return list-with-id or dict-with-id).
    6. Read `backend/app/api/threads.py` lines 2700-2725 to confirm the JSONResponse return shape (`{"message_id": str, "run_id": str}` with status 201).
    7. Read `backend/app/api/runs.py` lines 322-391 to confirm the GET /runs/{run_id}/stream ownership SELECT contract (selects `run_id, status, thread_id, error` from `runs` table; 404 if no row).
    8. Confirm `from app.api.threads import TERMINAL_TYPES` exists at `backend/app/api/threads.py:88` and is `frozenset({"done", "error", "cancelled", "timed_out"})` — exactly 4 elements, NO `"stream_end"`. Used by `test_063_post_then_subscribe.py:34`.
    9. Confirm via grep that `_collect_sse_events` is currently used 11 times in `test_threads_skills.py` and `client.stream("POST"` is also currently used 11 times — these are the migration targets. After the migration, both counts must drop to 0.
  </read_first>

  <action>
    Rewrite `backend/tests/integration/test_threads_skills.py` to follow the canonical Phase 063 pattern. The 11 test purposes (assertions about catalog injection, explorer mode tools, load_skill behavior, save_skill behavior, read_skill_file behavior, skill_activated event ordering, load_skill_files filenames) are PRESERVED verbatim. Only the wiring changes. Below is the exact transformation, broken into 7 coordinated edits applied to the same file.

    ### Edit A — Module imports and module-level constants (top of file, lines 1-25)

    Replace the current module imports + constants with:
    ```python
    """Integration tests for skill-related behavior in /threads endpoints.

    Phase 065 Plan 03 (gap closure for 065-VERIFICATION.md SC-3): migrated to the
    Phase 063 POST→GET-stream pattern. POST returns 201 JSON {message_id, run_id};
    SSE events are consumed from GET /runs/{rid}/stream?since=0. The previous
    SSE-on-POST pattern broke under D-063-01 (POST is now JSONResponse, not SSE).

    Test purposes (unchanged):
    - TestCatalogInjection      — SKIL-09: skills catalog injected into General Mode system prompt
    - TestExplorerModeNoSkills  — SKIL-13: Explorer Mode does not receive skill tools
    - TestLoadSkill             — SKIL-10 / FILE-04
    - TestSaveSkill             — SKIL-11
    - TestReadSkillFile         — FILE-05
    - TestSkillActivatedEvent   — SKIL-12
    - TestLoadSkillFiles        — FILE-04
    """
    import asyncio
    import json
    from unittest.mock import MagicMock, patch
    from uuid import uuid4

    import httpx
    import pytest
    from httpx import ASGITransport

    from app.api.threads import TERMINAL_TYPES   # frozenset({"done", "error", "cancelled", "timed_out"})
    from app.dependencies import get_supabase
    from app.main import app
    from app.services.openai_service import CallingMode

    from tests.integration._run_helpers import _build_mock_supabase, _make_result

    USER_ID = "00000000-0000-0000-0000-000000000001"
    SKILL_ID = str(uuid4())     # module-level OK for SKILL_ID — never participates in cross-test Redis state
    SKILL_NAME = "SQL Writer"
    ```

    Notes:
    - DROP module-level `THREAD_ID = str(uuid4())` (line 23 in current file). Each test now generates its own thread_id (closes WR-02 — eliminates cross-test state leakage in `runs_by_thread:{tid}` Redis sorted sets).
    - DROP the local `_make_result(data)` definition (current lines 50-53). Use the helper from `_run_helpers.py` instead — the helper version sets `r.count` correctly which avoids future drift.
    - KEEP `_make_sse_chunk`, `_make_done_chunk`, `_make_tool_call_chunk`, `_make_tool_calls_done_chunk` as module-level helpers — they're still needed for fake_create_streaming_chat construction.
    - DROP `_collect_sse_events` (current lines 84-93). It's a no-op against JSONResponse and is no longer needed.

    ### Edit B — Add the per-test Redis singleton reset autouse fixture (after the helper functions, before the first TestXxx class)

    Insert verbatim copy from `test_063_post_then_subscribe.py:45-62`:
    ```python
    @pytest.fixture(autouse=True)
    def _reset_redis_singleton():
        """Reset app.dependencies._redis so each test gets a Redis client bound to
        its own per-test event loop (pytest-asyncio function-scope creates a fresh
        loop per test). Without this, a singleton created in test N's loop is
        invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").
        Verbatim copy from test_063_post_then_subscribe.py:45-62 / test_062_stream_replay.py:36-51.
        """
        import app.dependencies as _deps
        _deps._redis = None
        yield
        _deps._redis = None
    ```

    ### Edit C — Add a per-test thread_id fixture (immediately after the Redis reset fixture)

    ```python
    @pytest.fixture
    def thread_id() -> str:
        """Per-test thread_id. WR-02 fix: replaces module-level THREAD_ID singleton
        which would otherwise leak state across tests via runs_by_thread:{tid}
        Redis sorted-set entries (now real Redis is used, not a no-op stub)."""
        return str(uuid4())
    ```

    ### Edit D — Add a `_build_mock_supabase_for_skill_test` helper (immediately after the thread_id fixture)

    Wraps `_build_mock_supabase()` and adds:
    1. The user-message INSERT must return `[{"id": "<uuid>"}]` so `threads.py:921` finds an `id` and does NOT abort with HTTP 500.
    2. Per-table override hook so individual tests can plant catalog rows / skill rows / skill_files rows on the relevant table without flat-array contention.

    ```python
    def _build_mock_supabase_for_skill_test(
        thread_id: str,
        *,
        skills_rows: list | None = None,        # rows the catalog SELECT (skills table) returns
        skill_lookup_rows: list | None = None,  # rows the load_skill / read_skill_file skill lookup returns
        skill_files_rows: list | None = None,   # rows the skill_files SELECT returns
        save_skill_existing: list | None = None, # rows the maybe_single() existing-skill check returns
    ):
        """Build a mock_supabase pre-wired for the skills test pattern.

        Rationale: _build_mock_supabase() in _run_helpers.py routes by table name
        but its `default_builder` returns _make_result([]) for every non-{threads,
        messages, runs} table. The 11 skills tests need catalog rows on `skills`,
        skill rows on `skills` (lookup branch), and file rows on `skill_files`.

        We do NOT use the conftest's flat side_effect array — that pattern is
        incompatible with the GET stream's runs ownership SELECT (which lands at
        an unpredictable index relative to the producer's background calls).

        ── 2-call assumption + fall-through behavior (Iteration-1 checker WARNING #3) ──
        The skills-table call-count routing assumes "first .execute on `skills` =
        catalog SELECT (in event_stream BEFORE tool dispatch); subsequent .execute
        = lookup branch (load_skill / read_skill_file)". Production code paths that
        MAY exceed 2 calls and fall through to `skill_lookup_rows`:
          - save_skill CREATE INSERT path (threads.py around save_skill tool):
            after the maybe_single() existing-skill check returns empty, the INSERT
            itself is a 3rd .execute on `skills`. Production reads only `.data` from
            the INSERT response, so returning `skill_lookup_rows` (typically empty
            list) is safe — production doesn't dereference `.data[0]["id"]` from
            the INSERT row in the create branch.
          - read_skill_file's normalized-name retry at threads.py:1956-1962: if the
            first lookup misses, a 2nd lookup with a normalized name fires; this is
            the 3rd .execute on `skills` overall. Production reads `.data`; falling
            through to `skill_lookup_rows` is acceptable (the test either expects
            success on first lookup or a not-found result — both honored by the
            fall-through).
        Net: the fall-through `return _make_result(skill_lookup_rows or [])` is a
        deliberate safety net — production never expects more than 2 distinct row
        shapes from `skills` in the test scenarios under coverage.
        """
        mock_supabase = _build_mock_supabase()

        # Override the messages INSERT to return a row with `id` so threads.py:921
        # finds an id and send_message proceeds.
        messages_builder = mock_supabase.table("messages")
        # Preserve the existing slow-INSERT-then-empty pattern from _run_helpers
        # but force the FIRST .execute() to return [{"id": <uuid>}]. State is
        # maintained per-call so subsequent reads (history, persist assistant)
        # still return empty.
        _state = {"calls": 0}
        def _messages_execute(*args, **kwargs):
            _state["calls"] += 1
            if _state["calls"] == 1:
                # First call from send_message handler is the user-msg INSERT.
                # Production reads result.data[0]["id"] (list path).
                return _make_result([{"id": str(uuid4())}])
            return _make_result([])
        messages_builder.execute.side_effect = _messages_execute

        # Configure threads ownership SELECT to return the requested thread row.
        threads_builder = mock_supabase.table("threads")
        threads_builder.execute.side_effect = lambda *a, **k: _make_result(
            {"id": thread_id, "user_id": USER_ID, "folder_id": None}
        )

        # The default_builder serves all NON-{threads, messages, runs} tables.
        # We layer a per-table override on top of mock_supabase.table so that
        # `skills` / `skill_files` / specific other tables can return per-test
        # data without consuming a flat queue.
        original_table_dispatch = mock_supabase.table.side_effect
        # Iteration-1 checker WARNING #5: defensive assertion. _build_mock_supabase()
        # in _run_helpers.py wires `mock_supabase.table.side_effect` to a callable
        # (lambda routing). If a future revision changes that to a non-callable
        # shape (e.g. a return_value), this helper would silently break — fail loud
        # immediately instead of producing surprising NoneType errors per-test.
        assert callable(original_table_dispatch), (
            "expected _build_mock_supabase().table.side_effect to be callable; "
            "this helper depends on per-table routing via the lambda dispatch in "
            "_run_helpers.py. If _build_mock_supabase changed shape, update this "
            "helper accordingly."
        )

        def _table_dispatch(name):
            if name == "skills":
                # Two read shapes: catalog (.execute returns list of {name, description}) AND
                # load_skill / read_skill_file lookup (.execute returns list of {id, name, ..., user_id}).
                # We can't distinguish by table name alone — we use a state flag:
                # first .execute on `skills` = catalog; subsequent = lookup. That mirrors the
                # production order (catalog SELECT happens in event_stream BEFORE tool dispatch).
                # See helper docstring for the 3+-call fall-through behavior covering save_skill
                # CREATE INSERT and read_skill_file normalized-name retry.
                b = MagicMock()
                _ms = {"calls": 0}
                def _skills_execute(*args, **kwargs):
                    _ms["calls"] += 1
                    if _ms["calls"] == 1:
                        return _make_result(skills_rows if skills_rows is not None else [])
                    if _ms["calls"] == 2 and save_skill_existing is not None:
                        # save_skill maybe_single() existing check — production calls
                        # .maybe_single().execute() expecting a single row dict OR None.
                        # _make_result accepts list (data=list) or dict (data=dict);
                        # production reads .data; we pass the list as-is for create branch
                        # (empty) or [{"id": ...}] for update branch.
                        return _make_result(save_skill_existing)
                    # Fall-through: 3rd+ .execute() on `skills`. Returns skill_lookup_rows
                    # (the load_skill/read_skill_file lookup shape) OR [] if not provided.
                    # See helper docstring §"2-call assumption + fall-through" for the
                    # production code paths that legitimately exceed 2 calls.
                    return _make_result(skill_lookup_rows if skill_lookup_rows is not None else [])
                # Re-implement chainable builder shape (matches _make_table_builder in helpers).
                for chain_method in (
                    "select", "insert", "update", "delete", "upsert", "eq", "neq",
                    "in_", "or_", "is_", "order", "limit", "single", "maybe_single",
                    "gte", "lt", "range",
                ):
                    setattr(b, chain_method, MagicMock(return_value=b))
                b.execute.side_effect = _skills_execute
                return b
            if name == "skill_files":
                b = MagicMock()
                for chain_method in (
                    "select", "insert", "update", "delete", "upsert", "eq", "neq",
                    "in_", "or_", "is_", "order", "limit", "single", "maybe_single",
                    "gte", "lt", "range",
                ):
                    setattr(b, chain_method, MagicMock(return_value=b))
                b.execute.side_effect = lambda *a, **k: _make_result(
                    skill_files_rows if skill_files_rows is not None else []
                )
                return b
            # Fall through to original dispatch for threads/messages/runs/everything else.
            return original_table_dispatch(name)

        mock_supabase.table.side_effect = _table_dispatch
        return mock_supabase
    ```

    Note: this helper is INTENTIONALLY local to `test_threads_skills.py` (not promoted to `_run_helpers.py`) because (a) the `skills` table call-count semantics are specific to this test family, (b) Plan 065-03 scope is one-file repair, (c) future skills test files in the Skill Studio milestone can lift it if it generalizes.

    ### Mid-task checkpoint (Iteration-1 checker WARNING #2 — option (b))

    **STOP HERE.** Before proceeding to Edit E (the per-test migration of all 11 tests), the foundational changes from edits A-D must be verified. This checkpoint is non-optional — a defective helper or import propagates to all 11 tests and turns a test-fix task into a debug-cycle task. Cheap insurance.

    Run these two commands in order. Both MUST pass before continuing:

    ```bash
    # Gate 1: file is syntactically valid Python after edits A-D have landed.
    cd "C:/Vibe Apps/Agentic RAG" && python -c "import ast; ast.parse(open('backend/tests/integration/test_threads_skills.py').read())" && echo "AST: ok"
    ```
    Expected output: `AST: ok` (a SyntaxError here means an indentation slip or stray paren in edits A-D — fix and re-run before proceeding).

    ```bash
    # Gate 2: pytest can COLLECT the file (imports resolve, fixtures parse).
    # The 11 sync test methods from the original file are still present at this
    # point (edit E hasn't run yet) — collection should succeed but show the
    # original 11 test IDs. Either count is fine; the gate is "no collection error".
    cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py --collect-only -q 2>&1 | tail -10
    ```
    Expected output: a list of test IDs (e.g. `tests/integration/test_threads_skills.py::TestCatalogInjection::test_catalog_appended_when_skills_exist`) and NO line containing `ERROR` or `error in collection`. An import error here usually means a typo in the new imports (Edit A) or a missing comma in the helper signature (Edit D).

    On both gates green → proceed to Edit E. On either gate red → fix the offending edit BEFORE migrating any test.

    ### Edit E — Migrate each of the 11 tests to the canonical pattern

    Each test follows this template (concrete — copy-paste, then edit per-test specifics):
    ```python
    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_NAME(self, redis_client, thread_id):
        captured_messages = []         # or captured_kwargs / captured_tool_messages depending on test
        stream_chunks = [_make_sse_chunk("Hello"), _make_done_chunk()]   # or call-counted multi-iter

        def fake_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter(stream_chunks), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[{"name": "SQL Writer", "description": "Writes SQL queries"}],   # per-test
        )
        app.dependency_overrides[get_supabase] = lambda: mock_supabase
        try:
            with patch(
                "app.api.threads.create_adaptive_streaming_chat",
                side_effect=fake_create_streaming_chat,
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
                        f"/threads/{thread_id}/messages",
                        headers={"Authorization": "Bearer test-token"},
                        json={"content": "hello", "agent_mode": "default"},
                    )
                    assert resp.status_code == 201, (
                        f"D-063-01: expected 201 JSON envelope; got {resp.status_code}, "
                        f"content-type={resp.headers.get('content-type')!r}, body={resp.text[:200]}"
                    )
                    assert resp.headers.get("content-type", "").startswith("application/json")
                    run_id = resp.json()["run_id"]

                    # Pitfall 4: producer needs ~200ms to schedule first XADD before
                    # GET stream opens; otherwise consumer synthesizes
                    # 'buffer_expired_while_streaming' instead of tailing real deltas.
                    await asyncio.sleep(0.2)

                    # Configure runs ownership SELECT for the GET stream consumer.
                    runs_builder = mock_supabase.table("runs")
                    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                        "data": {"run_id": run_id, "status": "streaming",
                                 "thread_id": thread_id, "error": None},
                        "count": None,
                    })()

                    events = []
                    async with ac.stream(
                        "GET", f"/runs/{run_id}/stream?since=0",
                        headers={"Authorization": "Bearer test-token"},
                        timeout=30.0,
                    ) as stream_resp:
                        assert stream_resp.status_code == 200
                        async for line in stream_resp.aiter_lines():
                            if line.startswith("data: "):
                                payload = json.loads(line[6:])
                                events.append(payload)
                                if payload.get("type") in TERMINAL_TYPES:
                                    break
        finally:
            app.dependency_overrides.pop(get_supabase, None)

        # ── Assertions (TEST-SPECIFIC — preserve verbatim from old test) ──
        assert len(captured_messages) > 0, "create_adaptive_streaming_chat was not called"
        # ... rest of test-specific assertions unchanged from original test ...
    ```

    Test-by-test specifics — apply the template with these per-test variations:

    **TestCatalogInjection.test_catalog_appended_when_skills_exist (lines 101-149 in current file):**
    - Builder kwargs: `skills_rows=[{"name": "SQL Writer", "description": "Writes SQL queries"}]`
    - Body: `{"content": "hello", "agent_mode": "default"}`
    - Captures: `captured_messages`
    - Assertions verbatim from current lines 140-149 EXCEPT update the message string at line 140 from `"create_streaming_chat was not called"` to `"create_adaptive_streaming_chat was not called"` (IN-01 fix).

    **TestCatalogInjection.test_catalog_empty_when_no_skills (lines 151-187):**
    - Builder kwargs: `skills_rows=[]`
    - Same template, assertions verbatim from current lines 181-187 EXCEPT IN-01 fix at line 181.

    **TestExplorerModeNoSkills.test_explorer_mode_uses_explorer_tools (lines 195-240):**
    - Builder kwargs: `skills_rows=[]`  (Explorer Mode does not query catalog, so no rows needed)
    - Body: `{"content": "hello", "agent_mode": "explorer"}`
    - Captures: `captured_kwargs = {}`; fake assigns `captured_kwargs.update(kwargs)`.
    - Assertions verbatim from current lines 232-240. (No IN-01 message string in this test.)

    **TestLoadSkill.test_load_skill_returns_instructions_and_files (lines 248-313):**
    - Builder kwargs:
      ```python
      skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
      skill_lookup_rows=[{"id": SKILL_ID, "name": SKILL_NAME, "description": "Writes SQL queries", "instructions": "Do X then Y", "user_id": USER_ID}],
      skill_files_rows=[{"filename": "template.py"}, {"filename": "config.json"}],
      ```
    - Body: `{"content": "use SQL Writer", "agent_mode": "default"}`
    - Multi-iteration fake with `call_count[0]` (tool_call on first LLM call, text on second) — verbatim from current lines 286-295.
    - Assertions verbatim from current lines 306-313.

    **TestLoadSkill.test_load_skill_not_found (lines 315-353):**
    - Builder kwargs: `skills_rows=[]`, `skill_lookup_rows=[]`
    - Body: `{"content": "use missing skill", "agent_mode": "default"}`
    - Assertions verbatim from current lines 350-353.

    **TestSaveSkill.test_save_skill_creates_new (lines 361-402):**
    - Builder kwargs: `skills_rows=[]`, `save_skill_existing=[]` (empty list = no existing → create branch)
    - Body: `{"content": "save skill", "agent_mode": "default"}`
    - Tool args: `{"name": "New Skill", "description": "Does things", "instructions": "Step 1, Step 2"}`
    - Assertions verbatim from current lines 398-402.

    **TestSaveSkill.test_save_skill_updates_existing (lines 404-444):**
    - Builder kwargs: `skills_rows=[]`, `save_skill_existing=[{"id": SKILL_ID}]` (non-empty → update branch)
    - Body: `{"content": "update skill", "agent_mode": "default"}`
    - Tool args: `{"name": SKILL_NAME, "description": "Updated desc", "instructions": "New instructions"}`
    - Assertions verbatim from current lines 441-444.

    **TestReadSkillFile.test_read_skill_file_returns_content (lines 452-499):**
    - Builder kwargs: `skills_rows=[]`, `skill_lookup_rows=[{"id": SKILL_ID, "user_id": USER_ID}]`
    - Body: `{"content": "read file", "agent_mode": "default"}`
    - Tool args: `{"skill_name": SKILL_NAME, "filename": "template.py"}`
    - Storage download mock: `mock_supabase.storage.from_.return_value.download.return_value = b"print('hello world')"` (set BEFORE entering the patch block).
    - Assertions verbatim from current lines 493-499.

    **TestReadSkillFile.test_read_skill_file_not_found (lines 501-538):**
    - Builder kwargs: `skills_rows=[]`, `skill_lookup_rows=[]`
    - Body: `{"content": "read missing", "agent_mode": "default"}`
    - Tool args: `{"skill_name": "NonExistent", "filename": "template.py"}`
    - Assertions verbatim from current lines 537-538.

    **TestSkillActivatedEvent.test_skill_activated_event_emitted (lines 546-599):**
    - Builder kwargs:
      ```python
      skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
      skill_lookup_rows=[{"id": SKILL_ID, "name": SKILL_NAME, "description": "Writes SQL queries", "instructions": "Step 1", "user_id": USER_ID}],
      skill_files_rows=[{"filename": "query.sql"}],
      ```
    - Body: `{"content": "use SQL Writer", "agent_mode": "default"}`
    - Assertions verbatim from current lines 588-599 (skill_activated index < tool_end index).

    **TestLoadSkillFiles.test_load_skill_includes_filenames (lines 607-669):**
    - Builder kwargs:
      ```python
      skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
      skill_lookup_rows=[{"id": SKILL_ID, "name": SKILL_NAME, "description": "Writes SQL", "instructions": "Do X then Y", "user_id": USER_ID}],
      skill_files_rows=[{"filename": "template.py"}, {"filename": "config.json"}],
      ```
    - Body: `{"content": "use SQL Writer", "agent_mode": "default"}`
    - Captures: `captured_tool_messages` (extracted on second LLM call) — preserve the closure-capture pattern from current lines 644.
    - Assertions verbatim from current lines 657-669.

    ### Edit F — Convert all test classes from sync `def` to `async def` and from `def test_x(self, client, auth_headers, mock_builder)` to `async def test_x(self, redis_client, thread_id)`

    The TestXxx class structure is preserved (TestCatalogInjection, TestExplorerModeNoSkills, TestLoadSkill, TestSaveSkill, TestReadSkillFile, TestSkillActivatedEvent, TestLoadSkillFiles). Each test method:
    - Becomes `async def`.
    - Decorated with `@pytest.mark.asyncio` and `@pytest.mark.timeout(15)`.
    - Drops the `client`, `auth_headers`, `mock_builder` fixture params (no longer used).
    - Adds the `redis_client` fixture param (real Redis from conftest) and the new `thread_id` fixture param.

    Auth headers are inlined as `headers={"Authorization": "Bearer test-token"}` (matching `test_063_post_then_subscribe.py:103`).

    ### Edit G — Atomic-commit hygiene

    Final file should have:
    - Zero occurrences of `_collect_sse_events` (helper deleted; consumers migrated).
    - Zero occurrences of `client.stream("POST"` (POST is now ac.post; stream is GET).
    - Zero occurrences of `mock_builder.execute.side_effect` (per-table routing replaces flat array).
    - Zero occurrences of `THREAD_ID = ` at module level (replaced by per-test fixture).
    - Zero occurrences of `_make_result([])` for the user-msg INSERT position (the helper now wires `[{"id": uuid}]` automatically).
    - Zero occurrences of the assertion message string `"create_streaming_chat was not called"` (IN-01 fix — replaced with `"create_adaptive_streaming_chat was not called"`).
    - Zero occurrences of `@pytest.mark.skip` / `@pytest.mark.xfail` / `pytest.skip(` (Iteration-1 checker WARNING #4 — no test silenced to fake a green).
    - Exactly 11 occurrences of `await ac.post(` against `/threads/{thread_id}/messages`.
    - Exactly 11 occurrences of `ac.stream("GET"` against `/runs/{run_id}/stream`.
    - Exactly 11 patches of `app.api.threads.create_adaptive_streaming_chat` (preserved from Plan 065-01).
    - One `_reset_redis_singleton` autouse fixture.
    - One `thread_id` fixture.
    - One `_build_mock_supabase_for_skill_test` helper.

    **Project rules to honor (CLAUDE.md):**
    - Backend uses `venv` at `backend/venv/` — activate before running pytest. Real Redis is required (the `redis_client` fixture connects to `redis://localhost:6379` via `REDIS_URL` env var). Local dev infra default per CLAUDE.md is Redis on Docker via `docker-compose.dev.yml` — assume it is up; if not, the `redis_client` fixture will raise on connect and the executor must `docker compose -f docker-compose.dev.yml up -d` before retrying.
    - No production code touched (per Phase 065 charter and `<scope_boundaries>`). The `files_modified` frontmatter lists exactly one entry: `backend/tests/integration/test_threads_skills.py`.
    - No new tests added. **No tests skipped or xfailed.** The 11 tests must all pass at execution. If any test surfaces a NEW deeper drift (e.g., the SSE event schema has changed since 065-01 was written), STOP and report — do not paper over with skip-with-reason. Per `<scope_reduction_prohibition>`, surface failures honestly.
  </action>

  <acceptance_criteria>
    1. `pytest backend/tests/integration/test_threads_skills.py -q` exits 0 with output containing "11 passed" (or higher if there are class-level conftest tests; explicitly NO failures or errors).
    2. Counter-grep `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '_collect_sse_events'` returns 0 (helper deleted, no consumers).
    3. Counter-grep `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c 'client\.stream("POST"'` returns 0 (SSE-on-POST migration complete).
    4. Counter-grep `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c 'mock_builder'` returns 0 (flat side_effect array replaced).
    5. Counter-grep `grep -E '^THREAD_ID *=' backend/tests/integration/test_threads_skills.py | wc -l` returns 0 (module-level singleton removed — WR-02 fix).
    6. Counter-grep `grep -c 'create_streaming_chat was not called' backend/tests/integration/test_threads_skills.py` returns 0 (IN-01 fix — old assertion message strings gone).
    7. `grep -c 'await ac.post(' backend/tests/integration/test_threads_skills.py` returns 11 (one per test).
    8. `grep -c 'ac.stream("GET"' backend/tests/integration/test_threads_skills.py` returns 11 (one per test).
    9. `grep -c '"app.api.threads.create_adaptive_streaming_chat"' backend/tests/integration/test_threads_skills.py` returns 11 (Plan 065-01 patch targets preserved).
    10. `grep -c 'def _reset_redis_singleton' backend/tests/integration/test_threads_skills.py` returns 1 (autouse fixture present).
    11. `grep -c 'def _build_mock_supabase_for_skill_test' backend/tests/integration/test_threads_skills.py` returns 1 (helper present).
    12. `python -c "import ast; ast.parse(open('backend/tests/integration/test_threads_skills.py').read())"` exits 0 (valid Python).
    13. The combined skills test run `pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q` exits 0 with all-passed output (closes ROADMAP SC-3).
    14. **No-skip enforcement (Iteration-1 checker WARNING #4):** `grep -c -E '@pytest\.mark\.skip|@pytest\.mark\.xfail|pytest\.skip\(' backend/tests/integration/test_threads_skills.py` returns 0 (no test was silenced via skip/xfail/pytest.skip() to fake a green). This is a hard acceptance criterion — closing SC-3 means real green, not silenced-green.
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py -q 2>&1 | tee /tmp/065-03-pytest.log; tail -5 /tmp/065-03-pytest.log; echo '---'; cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q 2>&1 | tail -5; echo '---'; echo 'Counter-greps:'; grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '_collect_sse_events' || echo 0; grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c 'client\.stream("POST"' || echo 0; grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c 'mock_builder' || echo 0; grep -E '^THREAD_ID *=' backend/tests/integration/test_threads_skills.py | wc -l; grep -c 'await ac.post(' backend/tests/integration/test_threads_skills.py; grep -c 'ac.stream("GET"' backend/tests/integration/test_threads_skills.py; grep -c '"app.api.threads.create_adaptive_streaming_chat"' backend/tests/integration/test_threads_skills.py; echo 'No-skip gate:'; grep -c -E '@pytest\.mark\.skip|@pytest\.mark\.xfail|pytest\.skip\(' backend/tests/integration/test_threads_skills.py</automated>
    <!-- Expected output:
         - First pytest line: "11 passed" (no failures, no errors)
         - Second pytest line (combined run): "26 passed" (11 + 15)
         - Counter-greps in order: 0, 0, 0, 0, 11, 11, 11
         - No-skip gate: 0
    -->
  </verify>

  <done>
    All 14 counter-grep + pytest gates pass. The 11 tests in `test_threads_skills.py` execute cleanly against the production code path (catalog injection, explorer mode, load_skill, save_skill, read_skill_file, skill_activated event, load_skill_files filenames). Combined skills test run `pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q` reports 0 errors, 0 failed, AND 0 skipped/xfailed — closes ROADMAP SC-3 / 065-VERIFICATION.md SC-3 gap. If any individual test surfaces a NEW deeper drift beyond BL-01 / WR-01 / WR-02 / IN-01, STOP and report each in the SUMMARY.md — do not skip-with-reason; the gap closure is the entire scope.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Verify no regression in 058 + 059 binding gates and commit atomically</name>
  <files>(no files modified — verification + commit)</files>

  <read_first>
    1. Confirm Task 1 left only the test file modified: `git status --short backend/tests/integration/test_threads_skills.py`. No other backend files should appear in `git status` for this branch.
    2. Confirm no production code in `backend/app/` was modified by Task 1 (production code is OFF LIMITS for Phase 065).
    3. Confirm Phase 065 plan list in ROADMAP.md (already lists 065-01 and 065-02 as complete; this plan adds the 03 entry — the orchestrator will update ROADMAP after this plan ships).
  </read_first>

  <action>
    Run the no-regression check against Phase 058 + 059 binding gates per ROADMAP SC-4 and the must_haves.truths gate from this plan's frontmatter.

    Commands (PowerShell-friendly via the Bash tool — venv activation required per CLAUDE.md):

    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -q
    cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -q
    cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q
    ```

    Expected outcomes:
    - `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` → 1 passed, 0 failed (Plan 065-01 baseline preserved).
    - `test_059_disconnect.py` → 2 passed, 1 failed (the failure is `test_normal_stream_unchanged: Event loop is closed`, pre-existing per `deferred-items.md` D-065-01-DEFER-2 — verified pre-existing on `fa1e327` base, NOT introduced by Plan 065-01 OR this plan). The pre-existing failure is the SAME failure that was present before this plan ran; NEW failures (different test name OR different error message) WOULD be a regression and would BLOCK commit.
    - Combined skills test run → 26 passed (11 from `test_threads_skills.py` + 15 from `test_skills_import_export.py`), 0 failed, 0 errors. Closes ROADMAP SC-3.

    On all-green (modulo the documented pre-existing 059 failure), create a single atomic commit:

    ```bash
    git add backend/tests/integration/test_threads_skills.py
    git commit -m "$(cat <<'EOF'
    test(065-03): migrate test_threads_skills.py to Phase 063 POST→GET-stream pattern

    Closes 065-VERIFICATION.md SC-3 gap (the only must-have failing for Phase 065).
    Two compounding root causes confirmed by verifier (BL-01) + code reviewer (WR-01,
    WR-02, IN-01) repaired together in a single follow-on plan to avoid partial-green:

    1. INSERT-id mock deficit (BL-01) — every test provided _make_result([]) at the
       user-message INSERT position; threads.py:921-933 aborts with HTTP 500 when the
       INSERT response carries no `id`. The patched create_adaptive_streaming_chat
       was therefore never reached. Fix: per-table routed mock_supabase whose
       messages-table FIRST .execute() returns [{"id": uuid4()}].

    2. SSE-on-POST architecture staleness (WR-01) — Phase 063 (D-063-01) cut
       send_message over to JSONResponse({message_id, run_id}) at threads.py:2719.
       The 11 tests still used client.stream("POST", ...) + _collect_sse_events()
       which silently returned [] against a JSON response. Fix: migrate to the
       canonical pattern from test_063_post_then_subscribe.py — POST returns 201
       JSON; SSE events drained from GET /runs/{run_id}/stream?since=0.

    3. THREAD_ID singleton (WR-02) — module-level THREAD_ID = str(uuid4()) became
       a flake source the moment tests actually ran (cross-test state leakage in
       runs_by_thread:{tid} Redis sorted-set). Fix: per-test thread_id fixture.

    4. Stale assertion messages (IN-01) — assertion strings still referenced
       "create_streaming_chat was not called". Fix: update to current name.

    Mechanical changes:
    - Add _reset_redis_singleton autouse fixture (verbatim from
      test_063_post_then_subscribe.py:45-62 / test_062_stream_replay.py:36-51).
    - Add per-test thread_id fixture (replaces module-level singleton).
    - Add _build_mock_supabase_for_skill_test helper wrapping _build_mock_supabase()
      from _run_helpers.py with skills/skill_files per-table overrides.
    - Migrate 11 tests from sync def to async def with @pytest.mark.asyncio.
    - Replace mock_builder.execute.side_effect = [...] flat arrays with the
      per-table routed mock_supabase.
    - Replace client.stream("POST", ...) + _collect_sse_events() with
      ac.post() + ac.stream("GET", "/runs/{rid}/stream?since=0") drain loop.
    - Drop local _make_result + _collect_sse_events helpers (use _run_helpers).
    - Drop client / auth_headers / mock_builder fixture params; use redis_client
      and thread_id instead.

    Test purposes preserved verbatim — catalog injection, explorer mode tools,
    load_skill, save_skill, read_skill_file, skill_activated event ordering,
    load_skill_files filenames. Only wiring changed; assertions unchanged.

    No production code touched. 058 + 059 binding gates verified green pre-commit
    (pre-existing test_normal_stream_unchanged failure unrelated — see
    deferred-items.md D-065-01-DEFER-2).

    Closes TEST-DEBT-059 SC-3 surface; combined skills test run now reports
    26 passed (11 + 15), 0 failed, 0 errors.

    Phase 065 / Plan 03.
    EOF
    )"
    ```

    **Do NOT** use `--no-verify`, `--amend`, or include any other modified file in this commit. The plan owns one file.
  </action>

  <acceptance_criteria>
    1. `pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -q` exits 0 (1 passed).
    2. `pytest tests/integration/test_059_disconnect.py -q` exits with the SAME pass/fail breakdown as before this plan ran (2 passed, 1 pre-existing failure for `test_normal_stream_unchanged: Event loop is closed`). NO new test names appear in the failure list.
    3. `pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q` exits 0 with 26 passed (11 + 15), 0 failed, 0 errors — closes ROADMAP SC-3.
    4. `git log -1 --name-only` shows exactly one file (`backend/tests/integration/test_threads_skills.py`) in the new commit.
    5. `git status --short backend/` reports clean working tree for `backend/app/` and `backend/tests/integration/test_threads_skills.py`.
    6. The commit subject starts with `test(065-03): migrate test_threads_skills.py to Phase 063 POST→GET-stream pattern`.
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q 2>&1 | tail -15 && echo '---' && git log -1 --name-only --format="%H%n%s%n%n%b" -- backend/tests/integration/test_threads_skills.py | head -40</automated>
    <!-- Expected: pytest summary shows 058 PASS, 059 (2 pass + 1 pre-existing fail), test_threads_skills 11 PASS, test_skills_import_export 15 PASS. git log shows new commit with subject starting "test(065-03):". -->
  </verify>

  <done>
    Atomic commit landed on the current branch. 058 binding gate green; 059 suite unchanged from baseline (same pre-existing failure, no new regressions); combined skills test run reports 26 passed (closes ROADMAP SC-3 and 065-VERIFICATION.md SC-3 gap). Phase 065 must-haves satisfied 4/4 — phase eligible for closure once VERIFICATION.md is re-run.
  </done>
</task>

</tasks>

<verification>
**Phase-level checks for this plan (gap-closure scope):**

1. **SC-3 gap closed:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q 2>&1 | grep -E "passed|failed|error" | tail -1` shows "26 passed" (or "26 passed, X warnings" — no failed, no errors).
2. **No INSERT-id deficit remains:** `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '_make_result(\[\])'` returns 0 — neither the user-msg INSERT slot nor any other slot uses the empty-list shortcut. (The new pattern uses `_build_mock_supabase_for_skill_test` which wires `[{"id": uuid4()}]` automatically.)
3. **No SSE-on-POST remains:** `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c 'client\.stream("POST"'` returns 0 AND `grep -v '^[[:space:]]*#' backend/tests/integration/test_threads_skills.py | grep -c '_collect_sse_events'` returns 0.
4. **WR-02 closed:** `grep -E '^THREAD_ID *=' backend/tests/integration/test_threads_skills.py | wc -l` returns 0 (no module-level THREAD_ID singleton).
5. **058 binding gate intact:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -q` exits 0.
6. **059 suite intact:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -q` exits with the SAME failure list as the pre-plan baseline (pre-existing `test_normal_stream_unchanged: Event loop is closed` only). New regressions BLOCK commit.
7. **Atomic commit hygiene:** `git log -1 --name-only` shows exactly one file modified (`backend/tests/integration/test_threads_skills.py`) and the commit subject starts with `test(065-03):`.
8. **No-skip enforcement:** `grep -c -E '@pytest\.mark\.skip|@pytest\.mark\.xfail|pytest\.skip\(' backend/tests/integration/test_threads_skills.py` returns 0.
</verification>

<success_criteria>
- All 11 tests in `backend/tests/integration/test_threads_skills.py` PASS at execution (not just collection) — 0 failed, 0 errors, 0 skipped, 0 xfailed.
- Combined skills test run (`pytest tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q`) reports 26 passed (11 + 15), 0 failed, 0 errors, 0 skipped/xfailed. **Closes ROADMAP SC-3 / 065-VERIFICATION.md SC-3 gap.**
- BL-01 closed: every test's user-message INSERT mock returns a row with an `id` field; `threads.py:921-933` no longer aborts send_message.
- WR-01 closed: every test follows the Phase 063 two-step pattern (POST returns JSON 201; SSE consumed from GET /runs/{rid}/stream?since=0).
- WR-02 closed: module-level THREAD_ID singleton removed; per-test `thread_id` fixture in use.
- IN-01 closed: assertion message strings reference current function name `create_adaptive_streaming_chat`, not the legacy `create_streaming_chat`.
- 058 + 059 binding gates remain green (058 PASS; 059 unchanged from baseline including the pre-existing pre-plan failure).
- Single atomic commit on current branch with subject `test(065-03): migrate test_threads_skills.py to Phase 063 POST→GET-stream pattern`.
- No production code modified. `files_modified` frontmatter contains exactly one entry. ~150-200 LOC diff in the test file (substantial rewrite — test purposes preserved, wiring fully migrated).
</success_criteria>

<output>
After completion, create `.planning/phases/065-skills-test-infrastructure-repair/065-03-SUMMARY.md` capturing:
- Final counter-grep gate values (all 14 acceptance criteria from Task 1, plus the 8 phase-level checks).
- Pytest result line for `test_threads_skills.py` alone (e.g., "11 passed in 8.21s").
- Pytest result line for the combined run (`test_threads_skills.py` + `test_skills_import_export.py`) — must show "26 passed".
- Pytest result line for the 058 + 059 no-regression gate (and a one-line confirmation that the 059 failure list is identical to the pre-plan baseline).
- The single commit SHA.
- Any individual test that surfaced NEW deeper drift beyond BL-01 / WR-01 / WR-02 / IN-01 (should be zero; if non-zero, list each test name + the assertion that fails + a one-line hypothesis for a future plan).
- Confirmation that ROADMAP SC-3 (combined skills test run reports 0 errors, 0 unexpected failures, AND 0 skipped/xfailed) is now satisfied.
- Note that Phase 065 is now eligible for re-verification (`/gsd:verify-work 065`) — must_haves should score 4/4 on the next pass.
</output>
