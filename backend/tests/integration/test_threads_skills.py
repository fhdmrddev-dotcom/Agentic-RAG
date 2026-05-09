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
# Importing the AppStatus-reset autouse fixture from test_059_disconnect makes
# it visible in this module too (matches test_063_post_then_subscribe.py:40).
# Without this, sse-starlette caches `AppStatus.should_exit_event` against the
# first event loop that created it; the second test's GET stream would then
# fail with `RuntimeError: <Event> is bound to a different event loop` from
# inside sse-starlette's _listen_for_exit_signal task.
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

USER_ID = "00000000-0000-0000-0000-000000000001"
SKILL_ID = str(uuid4())     # module-level OK for SKILL_ID — never participates in cross-test Redis state
SKILL_NAME = "SQL Writer"


def _gen_chunks(chunks):
    """Yield each chunk in turn — a generator (has .close()) so production's
    `close_fn=stream.close` at threads.py:1566 has a real method to bind.

    A plain `iter([...])` returns a `list_iterator` which has no .close()
    attribute, causing the producer's `_drain_stream_with_close_on_cancel`
    setup to raise AttributeError before any chunk is consumed.
    """
    for c in chunks:
        yield c


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_sse_chunk(content: str):
    """Return a minimal OpenAI streaming chunk mock with a text delta."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_done_chunk():
    """Return a streaming chunk that signals finish_reason='stop'."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "stop"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_tool_call_chunk(tool_call_id: str, tool_name: str, arguments: str):
    """Return a streaming chunk that signals a tool call."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    tc_delta = MagicMock()
    tc_delta.index = 0
    tc_delta.id = tool_call_id
    tc_delta.function = MagicMock()
    tc_delta.function.name = tool_name
    tc_delta.function.arguments = arguments
    chunk.choices[0].delta.tool_calls = [tc_delta]
    return chunk


def _make_tool_calls_done_chunk():
    """Return chunk with finish_reason='tool_calls'."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "tool_calls"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk


# ── Fixtures (per-test scope: WR-02 fix and Redis loop binding) ───────────────

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


@pytest.fixture
def thread_id() -> str:
    """Per-test thread_id. WR-02 fix: replaces module-level THREAD_ID singleton
    which would otherwise leak state across tests via runs_by_thread:{tid}
    Redis sorted-set entries (now real Redis is used, not a no-op stub)."""
    return str(uuid4())


def _build_mock_supabase_for_skill_test(
    thread_id_val: str,
    *,
    skills_rows: list | None = None,         # rows the catalog SELECT (skills table) returns
    skill_lookup_rows: list | None = None,   # rows the load_skill / read_skill_file skill lookup returns
    skill_files_rows: list | None = None,    # rows the skill_files SELECT returns
    save_skill_existing: list | None = None, # rows the existing-skill check returns (save_skill update branch)
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
      - save_skill CREATE INSERT path: after the existing-skill check returns
        empty, the INSERT itself is a 3rd .execute on `skills`. Production reads
        only `.data` from the INSERT response, so returning `skill_lookup_rows`
        (typically empty list) is safe.
      - read_skill_file's normalized-name retry at threads.py:1956-1962: if the
        first lookup misses, a 2nd lookup with a normalized name fires; this is
        the 3rd .execute on `skills` overall. Falling through to
        `skill_lookup_rows` is acceptable.
    Net: the fall-through `return _make_result(skill_lookup_rows or [])` is a
    deliberate safety net.
    """
    mock_supabase = _build_mock_supabase()

    # Override the messages INSERT to return a row with `id` so threads.py:921
    # finds an id and send_message proceeds.
    messages_builder = mock_supabase.table("messages")
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
        {"id": thread_id_val, "user_id": USER_ID, "folder_id": None}
    )

    # The default_builder serves all NON-{threads, messages, runs} tables.
    # We layer a per-table override on top of mock_supabase.table so that
    # `skills` / `skill_files` / specific other tables can return per-test
    # data without consuming a flat queue.
    original_table_dispatch = mock_supabase.table.side_effect
    # Iteration-1 checker WARNING #5: defensive assertion. _build_mock_supabase()
    # in _run_helpers.py wires `mock_supabase.table.side_effect` to a callable.
    assert callable(original_table_dispatch), (
        "expected _build_mock_supabase().table.side_effect to be callable; "
        "this helper depends on per-table routing via the lambda dispatch in "
        "_run_helpers.py. If _build_mock_supabase changed shape, update this "
        "helper accordingly."
    )

    # Pre-build the skills + skill_files builders ONCE and cache them so every
    # mock_supabase.table("skills") / table("skill_files") call returns the SAME
    # builder. This is critical: the call-count routing on `skills` only works
    # if the counter is shared across separate `supabase.table("skills")` calls
    # from production (catalog SELECT, load_skill lookup, save_skill existing
    # check, save_skill INSERT/UPDATE, read_skill_file lookup, etc.).
    # Mirrors the per-table-builder caching pattern in
    # _run_helpers.py:233-241 (`builders = {...}; sb.table.side_effect = lambda
    # name: builders.get(name, default_builder)`).
    _skills_state = {"calls": 0}

    def _skills_execute(*args, **kwargs):
        _skills_state["calls"] += 1
        if _skills_state["calls"] == 1:
            return _make_result(skills_rows if skills_rows is not None else [])
        if _skills_state["calls"] == 2 and save_skill_existing is not None:
            # save_skill existing-skill check — production reads
            # existing_resp.data[0] if existing_resp.data else None.
            return _make_result(save_skill_existing)
        # Fall-through: 3rd+ .execute() on `skills`. Returns skill_lookup_rows
        # (load_skill/read_skill_file lookup shape) OR [] if not provided.
        return _make_result(skill_lookup_rows if skill_lookup_rows is not None else [])

    skills_builder = MagicMock()
    for chain_method in (
        "select", "insert", "update", "delete", "upsert", "eq", "neq",
        "in_", "or_", "is_", "order", "limit", "single", "maybe_single",
        "gte", "lt", "range",
    ):
        setattr(skills_builder, chain_method, MagicMock(return_value=skills_builder))
    skills_builder.execute.side_effect = _skills_execute

    skill_files_builder = MagicMock()
    for chain_method in (
        "select", "insert", "update", "delete", "upsert", "eq", "neq",
        "in_", "or_", "is_", "order", "limit", "single", "maybe_single",
        "gte", "lt", "range",
    ):
        setattr(skill_files_builder, chain_method, MagicMock(return_value=skill_files_builder))
    skill_files_builder.execute.side_effect = lambda *a, **k: _make_result(
        skill_files_rows if skill_files_rows is not None else []
    )

    def _table_dispatch(name):
        if name == "skills":
            return skills_builder
        if name == "skill_files":
            return skill_files_builder
        # Fall through to original dispatch for threads/messages/runs/everything else.
        return original_table_dispatch(name)

    mock_supabase.table.side_effect = _table_dispatch
    return mock_supabase


# ──────────────────────────────────────────────────────────────────────────────
# Shared per-test scaffolding
# ──────────────────────────────────────────────────────────────────────────────

async def _post_and_drain(
    *,
    mock_supabase,
    thread_id_val: str,
    fake_create_streaming_chat,
    body_content: str,
    agent_mode: str = "default",
):
    """Common POST → GET stream drain pattern. Returns the list of SSE events.

    Mirrors the canonical pattern from test_063_post_then_subscribe.py:67-168
    (D-063-01 + D-062-14). The caller wires per-test mock_supabase + fake;
    this helper handles dependency override, patches, ASGI client setup, the
    POST→JSON→GET-stream→drain-to-terminal cycle, and dependency cleanup.
    """
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
                    f"/threads/{thread_id_val}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": body_content, "agent_mode": agent_mode},
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
                             "thread_id": thread_id_val, "error": None},
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
                return events
    finally:
        app.dependency_overrides.pop(get_supabase, None)


# ── TestCatalogInjection ───────────────────────────────────────────────────────

class TestCatalogInjection:
    """SKIL-09: Enabled skills catalog injected into General Mode system prompt."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_catalog_appended_when_skills_exist(self, redis_client, thread_id):
        """When skills exist, system prompt passed to LLM contains '## Available Skills'."""
        captured_messages = []
        stream_chunks = [_make_sse_chunk("Hello"), _make_done_chunk()]

        def fake_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return _gen_chunks(stream_chunks), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[{"name": "SQL Writer", "description": "Writes SQL queries"}],
        )
        await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="hello",
            agent_mode="default",
        )

        assert len(captured_messages) > 0, "create_adaptive_streaming_chat was not called"
        system_messages = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_messages) == 1, "Expected exactly one system message"
        system_content = system_messages[0]["content"]
        assert "## Available Skills" in system_content, (
            f"Expected '## Available Skills' in system prompt but got:\n{system_content[:500]}"
        )
        assert "SQL Writer" in system_content, (
            f"Expected skill name 'SQL Writer' in system prompt but got:\n{system_content[:500]}"
        )

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_catalog_empty_when_no_skills(self, redis_client, thread_id):
        """When no skills exist, system prompt does NOT contain '## Available Skills'."""
        captured_messages = []
        stream_chunks = [_make_sse_chunk("Hello"), _make_done_chunk()]

        def fake_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return _gen_chunks(stream_chunks), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
        )
        await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="hello",
            agent_mode="default",
        )

        assert len(captured_messages) > 0, "create_adaptive_streaming_chat was not called"
        system_messages = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_messages) == 1, "Expected exactly one system message"
        system_content = system_messages[0]["content"]
        assert "## Available Skills" not in system_content, (
            f"Expected no '## Available Skills' when skills list is empty, but found in:\n{system_content[:500]}"
        )


# ── TestExplorerModeNoSkills ───────────────────────────────────────────────────

class TestExplorerModeNoSkills:
    """SKIL-13: Explorer Mode tool list does not include skill tools."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_explorer_mode_uses_explorer_tools(self, redis_client, thread_id):
        """Explorer Mode call passes explorer tools (6 tools, no skill tools)."""
        captured_kwargs = {}
        stream_chunks = [_make_sse_chunk("Here"), _make_done_chunk()]

        def fake_create_streaming_chat(messages, **kwargs):
            captured_kwargs.update(kwargs)
            return _gen_chunks(stream_chunks), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],  # Explorer Mode does not query catalog
        )
        await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="hello",
            agent_mode="explorer",
        )

        assert "tools_override" in captured_kwargs, "tools_override not passed to create_adaptive_streaming_chat"
        tools_override = captured_kwargs["tools_override"]
        assert tools_override is not None, "tools_override should not be None for explorer mode"

        tool_names = [t["function"]["name"] for t in tools_override]
        assert "load_skill" not in tool_names, f"load_skill should not be in explorer tools: {tool_names}"
        assert "save_skill" not in tool_names, f"save_skill should not be in explorer tools: {tool_names}"
        assert "read_skill_file" not in tool_names, f"read_skill_file should not be in explorer tools: {tool_names}"
        assert len(tools_override) == 6, f"Explorer mode should have 6 tools, got {len(tools_override)}: {tool_names}"


# ── TestLoadSkill ──────────────────────────────────────────────────────────────

class TestLoadSkill:
    """SKIL-10 / FILE-04: load_skill tool returns instructions and file list."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_load_skill_returns_instructions_and_files(self, redis_client, thread_id):
        """load_skill returns instructions and file list; skill_activated event emitted."""
        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Skill loaded!"), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
            skill_lookup_rows=[{
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL queries",
                "instructions": "Do X then Y",
                "user_id": USER_ID,
            }],
            skill_files_rows=[
                {"filename": "template.py"},
                {"filename": "config.json"},
            ],
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="use SQL Writer",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        assert "skill_activated" in event_types, f"Expected skill_activated event in: {event_types}"
        assert "tool_end" in event_types, f"Expected tool_end event in: {event_types}"

        # Verify skill_activated event has correct skill_name
        skill_activated_events = [e for e in events if e.get("type") == "skill_activated"]
        assert len(skill_activated_events) == 1
        assert skill_activated_events[0]["skill_name"] == SKILL_NAME

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_load_skill_not_found(self, redis_client, thread_id):
        """load_skill handles skill-not-found gracefully and still emits tool_end."""
        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": "NonExistent"})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Skill not found."), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
            skill_lookup_rows=[],
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="use missing skill",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        # skill_activated still emitted even when skill not found (emitted before DB query)
        assert "skill_activated" in event_types, f"Expected skill_activated even for not-found: {event_types}"
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"


# ── TestSaveSkill ─────────────────────────────────────────────────────────────

class TestSaveSkill:
    """SKIL-11: save_skill tool creates new skill or updates existing."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_save_skill_creates_new(self, redis_client, thread_id):
        """save_skill inserts a new skill when no existing skill with that name."""
        call_count = [0]
        save_args = {"name": "New Skill", "description": "Does things", "instructions": "Step 1, Step 2"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "save_skill", json.dumps(save_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Skill created!"), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
            save_skill_existing=[],   # empty list → no existing → create branch
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="save skill",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        # No error events
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_save_skill_updates_existing(self, redis_client, thread_id):
        """save_skill updates an existing skill when one with the same name exists."""
        call_count = [0]
        save_args = {"name": SKILL_NAME, "description": "Updated desc", "instructions": "New instructions"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "save_skill", json.dumps(save_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Skill updated!"), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
            save_skill_existing=[{"id": SKILL_ID}],   # non-empty → update branch
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="update skill",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"


# ── TestReadSkillFile ─────────────────────────────────────────────────────────

class TestReadSkillFile:
    """FILE-05: read_skill_file tool returns decoded file content."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_read_skill_file_returns_content(self, redis_client, thread_id):
        """read_skill_file downloads and decodes file content from storage."""
        call_count = [0]
        read_args = {"skill_name": SKILL_NAME, "filename": "template.py"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "read_skill_file", json.dumps(read_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("File content loaded."), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
            skill_lookup_rows=[{"id": SKILL_ID, "user_id": USER_ID}],
        )
        # Wire the storage bucket download mock onto the per-test mock_supabase.
        storage_bucket = mock_supabase.storage.from_.return_value
        storage_bucket.download.return_value = b"print('hello world')"

        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="read file",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"

        # Verify storage.download was called with the correct path
        storage_bucket.download.assert_called_once_with(f"{USER_ID}/{SKILL_ID}/template.py")

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_read_skill_file_not_found(self, redis_client, thread_id):
        """read_skill_file handles skill-not-found gracefully and still emits tool_end."""
        call_count = [0]
        read_args = {"skill_name": "NonExistent", "filename": "template.py"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "read_skill_file", json.dumps(read_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Could not find skill."), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[],
            skill_lookup_rows=[],
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="read missing",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"


# ── TestSkillActivatedEvent ───────────────────────────────────────────────────

class TestSkillActivatedEvent:
    """SKIL-12: skill_activated SSE event emitted when load_skill dispatches."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_skill_activated_event_emitted(self, redis_client, thread_id):
        """skill_activated event appears BEFORE tool_end event in SSE stream."""
        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return _gen_chunks([_make_sse_chunk("Done."), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
            skill_lookup_rows=[{
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL queries",
                "instructions": "Step 1",
                "user_id": USER_ID,
            }],
            skill_files_rows=[{"filename": "query.sql"}],
        )
        events = await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="use SQL Writer",
            agent_mode="default",
        )

        event_types = [e.get("type") for e in events]

        assert "skill_activated" in event_types, f"skill_activated not in events: {event_types}"
        assert "tool_end" in event_types, f"tool_end not in events: {event_types}"

        # Assert skill_activated appears BEFORE tool_end
        skill_activated_idx = event_types.index("skill_activated")
        tool_end_idx = event_types.index("tool_end")
        assert skill_activated_idx < tool_end_idx, (
            f"skill_activated (index {skill_activated_idx}) must appear before "
            f"tool_end (index {tool_end_idx})"
        )


# ── TestLoadSkillFiles ────────────────────────────────────────────────────────

class TestLoadSkillFiles:
    """FILE-04: load_skill response includes list of attached filenames."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(15)
    async def test_load_skill_includes_filenames(self, redis_client, thread_id):
        """load_skill tool result includes filenames list from skill_files table."""
        captured_tool_messages = []
        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return _gen_chunks([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            # On second call, capture what was passed as tool result messages
            captured_tool_messages.extend([m for m in messages if m.get("role") == "tool"])
            return _gen_chunks([_make_sse_chunk("Done."), _make_done_chunk()]), CallingMode.NATIVE

        mock_supabase = _build_mock_supabase_for_skill_test(
            thread_id,
            skills_rows=[{"name": SKILL_NAME, "description": "Writes SQL"}],
            skill_lookup_rows=[{
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL",
                "instructions": "Do X then Y",
                "user_id": USER_ID,
            }],
            skill_files_rows=[
                {"filename": "template.py"},
                {"filename": "config.json"},
            ],
        )
        await _post_and_drain(
            mock_supabase=mock_supabase,
            thread_id_val=thread_id,
            fake_create_streaming_chat=fake_create_streaming_chat,
            body_content="use SQL Writer",
            agent_mode="default",
        )

        # Verify the tool result passed back to LLM contains filenames
        assert len(captured_tool_messages) > 0, "No tool messages captured on second LLM call"
        tool_content = captured_tool_messages[0]["content"]
        parsed_result = json.loads(tool_content)

        assert "files" in parsed_result, f"Tool result missing 'files' key: {parsed_result}"
        assert "template.py" in parsed_result["files"], (
            f"Expected 'template.py' in files list: {parsed_result['files']}"
        )
        assert "config.json" in parsed_result["files"], (
            f"Expected 'config.json' in files list: {parsed_result['files']}"
        )
        assert "instructions" in parsed_result, f"Tool result missing 'instructions': {parsed_result}"
        assert parsed_result["instructions"] == "Do X then Y"
