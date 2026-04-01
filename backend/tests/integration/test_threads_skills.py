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
            return iter(stream_chunks)

        with patch("app.api.threads.create_streaming_chat", side_effect=fake_create_streaming_chat):
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
            return iter(stream_chunks)

        with patch("app.api.threads.create_streaming_chat", side_effect=fake_create_streaming_chat):
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
            return iter(stream_chunks)

        with patch("app.api.threads.create_streaming_chat", side_effect=fake_create_streaming_chat):
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


# ── TestLoadSkill (Plan 02 stubs) ──────────────────────────────────────────────

class TestLoadSkill:
    """SKIL-10 / FILE-04: load_skill tool returns instructions and file list. (Plan 02)"""

    def test_load_skill_returns_instructions_and_files(self):
        pass

    def test_load_skill_not_found(self):
        pass


# ── TestSaveSkill (Plan 02 stubs) ─────────────────────────────────────────────

class TestSaveSkill:
    """SKIL-11: save_skill tool creates new skill or updates existing. (Plan 02)"""

    def test_save_skill_creates_new(self):
        pass

    def test_save_skill_updates_existing(self):
        pass


# ── TestReadSkillFile (Plan 02 stubs) ─────────────────────────────────────────

class TestReadSkillFile:
    """FILE-05: read_skill_file tool returns decoded file content. (Plan 02)"""

    def test_read_skill_file_returns_content(self):
        pass

    def test_read_skill_file_not_found(self):
        pass


# ── TestSkillActivatedEvent (Plan 02 stub) ────────────────────────────────────

class TestSkillActivatedEvent:
    """SKIL-12: skill_activated SSE event emitted when load_skill dispatches. (Plan 02)"""

    def test_skill_activated_event_emitted(self):
        pass


# ── TestLoadSkillFiles (Plan 02 stub) ─────────────────────────────────────────

class TestLoadSkillFiles:
    """FILE-04: load_skill response includes list of attached filenames. (Plan 02)"""

    def test_load_skill_includes_filenames(self):
        pass
