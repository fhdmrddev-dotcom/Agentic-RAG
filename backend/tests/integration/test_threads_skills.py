"""Integration tests for skill-related behavior in /threads endpoints.

Plan 11-01 covers:
- TestCatalogInjection  — SKIL-09: skill catalog injected into General Mode system prompt
- TestExplorerModeNoSkills — SKIL-13: Explorer Mode does not receive skill tools
- TestLoadSkill         — SKIL-10 / FILE-04 (stubs, fleshed out in Plan 02)
- TestSaveSkill         — SKIL-11 (stubs, fleshed out in Plan 02)
- TestReadSkillFile     — FILE-05 (stubs, fleshed out in Plan 02)
- TestSkillActivatedEvent — SKIL-12 (stub, fleshed out in Plan 02)
- TestLoadSkillFiles    — FILE-04 (stub, fleshed out in Plan 02)
"""
import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.openai_service import CallingMode

# ── Helpers ────────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
THREAD_ID = str(uuid4())
SKILL_ID = str(uuid4())
SKILL_NAME = "SQL Writer"


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


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


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


def _collect_sse_events(response) -> list[dict]:
    """Collect all SSE data events from a streaming response."""
    events = []
    for line in response.iter_lines():
        if line and line.startswith("data: ") and line != "data: [DONE]":
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


# ── TestCatalogInjection ───────────────────────────────────────────────────────

class TestCatalogInjection:
    """SKIL-09: Enabled skills catalog injected into General Mode system prompt."""

    def test_catalog_appended_when_skills_exist(self, client, auth_headers, mock_builder):
        """When skills exist, system prompt passed to LLM contains '## Available Skills'."""
        stream_chunks = [_make_sse_chunk("Hello"), _make_done_chunk()]

        # execute() call sequence:
        # 1. Thread ownership check (send_message)
        # 2. Insert user message (send_message)
        # 3. Thread folder_id lookup (event_stream)
        # 4. Message history (event_stream)
        # 5. Skill catalog query (event_stream) — returns skills
        # 6. Persist assistant message (event_stream)
        # 7. Update thread updated_at (event_stream)
        # 8. Auto-title update (event_stream — history has 1 user message)
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),  # ownership
            _make_result([]),                                       # insert user msg
            _make_result({"folder_id": None}),                     # folder_id lookup
            _make_result([{"role": "user", "content": "hello", "tool_calls": None}]),  # history
            _make_result([{"name": "SQL Writer", "description": "Writes SQL queries"}]),  # catalog
            _make_result([]),                                       # persist assistant
            _make_result([]),                                       # touch thread
            _make_result([]),                                       # auto-title update
        ]

        captured_messages = []

        def fake_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter(stream_chunks), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "hello", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                _ = list(response.iter_lines())

        assert len(captured_messages) > 0, "create_streaming_chat was not called"
        system_messages = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_messages) == 1, "Expected exactly one system message"
        system_content = system_messages[0]["content"]
        assert "## Available Skills" in system_content, (
            f"Expected '## Available Skills' in system prompt but got:\n{system_content[:500]}"
        )
        assert "SQL Writer" in system_content, (
            f"Expected skill name 'SQL Writer' in system prompt but got:\n{system_content[:500]}"
        )

    def test_catalog_empty_when_no_skills(self, client, auth_headers, mock_builder):
        """When no skills exist, system prompt does NOT contain '## Available Skills'."""
        stream_chunks = [_make_sse_chunk("Hello"), _make_done_chunk()]

        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),  # ownership
            _make_result([]),                                       # insert user msg
            _make_result({"folder_id": None}),                     # folder_id lookup
            _make_result([{"role": "user", "content": "hello", "tool_calls": None}]),  # history
            _make_result([]),                                       # catalog (empty)
            _make_result([]),                                       # persist assistant
            _make_result([]),                                       # touch thread
            _make_result([]),                                       # auto-title update
        ]

        captured_messages = []

        def fake_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter(stream_chunks), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "hello", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                _ = list(response.iter_lines())

        assert len(captured_messages) > 0, "create_streaming_chat was not called"
        system_messages = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_messages) == 1, "Expected exactly one system message"
        system_content = system_messages[0]["content"]
        assert "## Available Skills" not in system_content, (
            f"Expected no '## Available Skills' when skills list is empty, but found in:\n{system_content[:500]}"
        )


# ── TestExplorerModeNoSkills ───────────────────────────────────────────────────

class TestExplorerModeNoSkills:
    """SKIL-13: Explorer Mode tool list does not include skill tools."""

    def test_explorer_mode_uses_explorer_tools(self, client, auth_headers, mock_builder):
        """Explorer Mode call passes explorer tools (6 tools, no skill tools)."""
        stream_chunks = [_make_sse_chunk("Here"), _make_done_chunk()]

        # Explorer Mode does NOT query the skills catalog, so 7 execute calls (no catalog):
        # 1. Thread ownership check (send_message)
        # 2. Insert user message (send_message)
        # 3. Thread folder_id lookup (event_stream)
        # 4. Message history (event_stream)
        # 5. Persist assistant message (event_stream)
        # 6. Update thread updated_at (event_stream)
        # 7. Auto-title update (event_stream — history has 1 user message)
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),  # ownership
            _make_result([]),                                       # insert user msg
            _make_result({"folder_id": None}),                     # folder_id lookup
            _make_result([{"role": "user", "content": "hello", "tool_calls": None}]),  # history
            _make_result([]),                                       # persist assistant
            _make_result([]),                                       # touch thread
            _make_result([]),                                       # auto-title update
        ]

        captured_kwargs = {}

        def fake_create_streaming_chat(messages, **kwargs):
            captured_kwargs.update(kwargs)
            return iter(stream_chunks), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "hello", "agent_mode": "explorer"},
                headers=auth_headers,
            ) as response:
                _ = list(response.iter_lines())

        assert "tools_override" in captured_kwargs, "tools_override not passed to create_streaming_chat"
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

    def test_load_skill_returns_instructions_and_files(self, client, auth_headers, mock_builder):
        """load_skill returns instructions and file list; skill_activated event emitted."""
        # Call sequence for load_skill dispatch:
        # 1. Thread ownership check
        # 2. Insert user message
        # 3. Thread folder_id lookup
        # 4. Message history (1 user message)
        # 5. Skill catalog query
        # -- First LLM call returns tool_call for load_skill --
        # 6. load_skill: skills table query
        # 7. load_skill: skill_files table query
        # -- Second LLM call returns text response --
        # 8. Persist assistant message
        # 9. Touch thread updated_at
        # 10. Auto-title update (1 user message in history)
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "use SQL Writer", "tool_calls": None}]),  # 4. history
            _make_result([{"name": SKILL_NAME, "description": "Writes SQL"}]),  # 5. catalog
            # Tool dispatch: load_skill
            _make_result([{                                          # 6. skills query
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL queries",
                "instructions": "Do X then Y",
                "user_id": USER_ID,
            }]),
            _make_result([                                           # 7. skill_files query
                {"filename": "template.py"},
                {"filename": "config.json"},
            ]),
            _make_result([]),                                        # 8. persist assistant
            _make_result([]),                                        # 9. touch thread
            _make_result([]),                                        # 10. auto-title update
        ]

        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Skill loaded!"), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "use SQL Writer", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        assert "skill_activated" in event_types, f"Expected skill_activated event in: {event_types}"
        assert "tool_end" in event_types, f"Expected tool_end event in: {event_types}"

        # Verify skill_activated event has correct skill_name
        skill_activated_events = [e for e in events if e.get("type") == "skill_activated"]
        assert len(skill_activated_events) == 1
        assert skill_activated_events[0]["skill_name"] == SKILL_NAME

    def test_load_skill_not_found(self, client, auth_headers, mock_builder):
        """load_skill handles skill-not-found gracefully and still emits tool_end."""
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "use missing skill", "tool_calls": None}]),  # 4. history
            _make_result([]),                                        # 5. catalog (empty)
            # Tool dispatch: load_skill — skill not found
            _make_result([]),                                        # 6. skills query returns empty
            _make_result([]),                                        # 7. persist assistant
            _make_result([]),                                        # 8. touch thread
            _make_result([]),                                        # 9. auto-title update
        ]

        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": "NonExistent"})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Skill not found."), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "use missing skill", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        # skill_activated still emitted even when skill not found (emitted before DB query)
        assert "skill_activated" in event_types, f"Expected skill_activated even for not-found: {event_types}"
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"


# ── TestSaveSkill ─────────────────────────────────────────────────────────────

class TestSaveSkill:
    """SKIL-11: save_skill tool creates new skill or updates existing."""

    def test_save_skill_creates_new(self, client, auth_headers, mock_builder):
        """save_skill inserts a new skill when no existing skill with that name."""
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "save skill", "tool_calls": None}]),  # 4. history
            _make_result([]),                                        # 5. catalog (empty)
            # Tool dispatch: save_skill (create branch)
            _make_result(None),                                      # 6. maybe_single — no existing skill
            _make_result([]),                                        # 7. insert new skill
            _make_result([]),                                        # 8. persist assistant
            _make_result([]),                                        # 9. touch thread
            _make_result([]),                                        # 10. auto-title update
        ]

        call_count = [0]
        save_args = {"name": "New Skill", "description": "Does things", "instructions": "Step 1, Step 2"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "save_skill", json.dumps(save_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Skill created!"), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "save skill", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        # No error events
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"

    def test_save_skill_updates_existing(self, client, auth_headers, mock_builder):
        """save_skill updates an existing skill when one with the same name exists."""
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "update skill", "tool_calls": None}]),  # 4. history
            _make_result([]),                                        # 5. catalog (empty)
            # Tool dispatch: save_skill (update branch)
            _make_result([{"id": SKILL_ID}]),                        # 6. maybe_single — existing skill found
            _make_result([]),                                        # 7. update existing skill
            _make_result([]),                                        # 8. persist assistant
            _make_result([]),                                        # 9. touch thread
            _make_result([]),                                        # 10. auto-title update
        ]

        call_count = [0]
        save_args = {"name": SKILL_NAME, "description": "Updated desc", "instructions": "New instructions"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "save_skill", json.dumps(save_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Skill updated!"), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "update skill", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"


# ── TestReadSkillFile ─────────────────────────────────────────────────────────

class TestReadSkillFile:
    """FILE-05: read_skill_file tool returns decoded file content."""

    def test_read_skill_file_returns_content(self, client, auth_headers, mock_builder):
        """read_skill_file downloads and decodes file content from storage."""
        # Wire the storage bucket download mock
        from tests.conftest import _supabase
        storage_bucket = _supabase.storage.from_.return_value
        storage_bucket.download.return_value = b"print('hello world')"

        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "read file", "tool_calls": None}]),  # 4. history
            _make_result([]),                                        # 5. catalog (empty)
            # Tool dispatch: read_skill_file
            _make_result([{"id": SKILL_ID, "user_id": USER_ID}]),   # 6. skill lookup
            _make_result([]),                                        # 7. persist assistant
            _make_result([]),                                        # 8. touch thread
            _make_result([]),                                        # 9. auto-title update
        ]

        call_count = [0]
        read_args = {"skill_name": SKILL_NAME, "filename": "template.py"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "read_skill_file", json.dumps(read_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("File content loaded."), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "read file", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"
        error_events = [e for e in events if e.get("type") == "error"]
        assert len(error_events) == 0, f"Unexpected error events: {error_events}"

        # Verify storage.download was called with the correct path
        storage_bucket.download.assert_called_once_with(f"{USER_ID}/{SKILL_ID}/template.py")

    def test_read_skill_file_not_found(self, client, auth_headers, mock_builder):
        """read_skill_file handles skill-not-found gracefully and still emits tool_end."""
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),   # 1. ownership
            _make_result([]),                                        # 2. insert user msg
            _make_result({"folder_id": None}),                      # 3. folder_id lookup
            _make_result([{"role": "user", "content": "read missing", "tool_calls": None}]),  # 4. history
            _make_result([]),                                        # 5. catalog (empty)
            # Tool dispatch: read_skill_file — skill not found
            _make_result([]),                                        # 6. skill lookup returns empty
            _make_result([]),                                        # 7. persist assistant
            _make_result([]),                                        # 8. touch thread
            _make_result([]),                                        # 9. auto-title update
        ]

        call_count = [0]
        read_args = {"skill_name": "NonExistent", "filename": "template.py"}

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "read_skill_file", json.dumps(read_args)),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Could not find skill."), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "read missing", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

        event_types = [e.get("type") for e in events]
        assert "tool_end" in event_types, f"Expected tool_end event: {event_types}"


# ── TestSkillActivatedEvent ───────────────────────────────────────────────────

class TestSkillActivatedEvent:
    """SKIL-12: skill_activated SSE event emitted when load_skill dispatches."""

    def test_skill_activated_event_emitted(self, client, auth_headers, mock_builder):
        """skill_activated event appears BEFORE tool_end event in SSE stream."""
        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),
            _make_result([]),
            _make_result({"folder_id": None}),
            _make_result([{"role": "user", "content": "use SQL Writer", "tool_calls": None}]),
            _make_result([{"name": SKILL_NAME, "description": "Writes SQL"}]),
            # load_skill dispatch
            _make_result([{
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL queries",
                "instructions": "Step 1",
                "user_id": USER_ID,
            }]),
            _make_result([{"filename": "query.sql"}]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]

        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            return iter([_make_sse_chunk("Done."), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "use SQL Writer", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                events = _collect_sse_events(response)

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

    def test_load_skill_includes_filenames(self, client, auth_headers, mock_builder):
        """load_skill tool result includes filenames list from skill_files table."""
        captured_tool_messages = []

        mock_builder.execute.side_effect = [
            _make_result({"id": THREAD_ID, "folder_id": None}),
            _make_result([]),
            _make_result({"folder_id": None}),
            _make_result([{"role": "user", "content": "use SQL Writer", "tool_calls": None}]),
            _make_result([{"name": SKILL_NAME, "description": "Writes SQL"}]),
            # load_skill dispatch
            _make_result([{
                "id": SKILL_ID,
                "name": SKILL_NAME,
                "description": "Writes SQL",
                "instructions": "Do X then Y",
                "user_id": USER_ID,
            }]),
            _make_result([
                {"filename": "template.py"},
                {"filename": "config.json"},
            ]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]

        call_count = [0]

        def fake_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return iter([
                    _make_tool_call_chunk("tc-1", "load_skill", json.dumps({"skill_name": SKILL_NAME})),
                    _make_tool_calls_done_chunk(),
                ]), CallingMode.NATIVE
            # On second call, capture what was passed as tool result messages
            captured_tool_messages.extend([m for m in messages if m.get("role") == "tool"])
            return iter([_make_sse_chunk("Done."), _make_done_chunk()]), CallingMode.NATIVE

        with patch("app.api.threads.create_adaptive_streaming_chat", side_effect=fake_create_streaming_chat):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "use SQL Writer", "agent_mode": "default"},
                headers=auth_headers,
            ) as response:
                _ = _collect_sse_events(response)

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
