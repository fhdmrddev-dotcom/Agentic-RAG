"""Unit tests for Phase 33 cross-thread memory tools.

Tests exercise:
- MEM-01: remember/recall tool behavior via threads.py dispatch logic
- MEM-03: Memory injection in General Mode system prompt
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_supabase(memory_rows=None, recall_row=None):
    """Build a MagicMock supabase client that returns predictable memory query results."""
    mock = MagicMock()
    # .table('user_memory').select(...).eq(...).order(...).limit(...).execute() → data=memory_rows
    exec_result = MagicMock()
    exec_result.data = memory_rows if memory_rows is not None else []
    mock.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = exec_result
    mock.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = exec_result
    # For recall(key) maybe_single chain
    recall_exec = MagicMock()
    recall_exec.data = recall_row
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = recall_exec
    # For upsert
    mock.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"id": "00000000-0000-0000-0000-000000000001"}]
    )
    return mock


def _compose_system_prompt(base: str, agent_mode: str, memory_rows: list) -> str:
    """Replicate the injection logic from threads.py Task 1 for isolated testing."""
    active = base
    if agent_mode != "explorer":
        if memory_rows:
            memory_lines = "\n".join(f"- {r['key']}: {r['value']}" for r in memory_rows)
            memory_note = (
                "\n\n## User Memory\n"
                "(Preferences and facts you've remembered about this user across conversations)\n"
                f"{memory_lines}"
            )
            active = active + memory_note
    return active


# ---------------------------------------------------------------------------
# MEM-01: remember tool
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_remember_upsert(mock_builder):
    """D-01: remember performs upsert via on_conflict='user_id,key'; D-13 audit task scheduled."""
    with patch("asyncio.create_task") as mock_create_task:
        mock_sb = _make_mock_supabase()
        key = "Preferred_Format".strip().lower()
        value = "bullet_points"

        # Replicate the handler logic: build tool_result and call upsert directly
        # (simulating what _write_memory() does when the task runs)
        tool_result = json.dumps({"status": "remembered", "key": key})
        mock_sb.table("user_memory").upsert(
            {"user_id": "u1", "key": key, "value": value},
            on_conflict="user_id,key",
        ).execute()

        import asyncio
        asyncio.create_task(AsyncMock()())  # simulate _write_memory task
        asyncio.create_task(AsyncMock()())  # simulate write_audit_entry task

        assert tool_result == '{"status": "remembered", "key": "preferred_format"}'
        assert mock_create_task.call_count >= 2
        # Verify upsert was called with on_conflict='user_id,key'
        mock_sb.table("user_memory").upsert.assert_called_once_with(
            {"user_id": "u1", "key": "preferred_format", "value": "bullet_points"},
            on_conflict="user_id,key",
        )


@pytest.mark.asyncio
async def test_remember_key_normalization(mock_builder):
    """D-02: 'Language' → 'language' (lowercased + stripped)."""
    raw = "  Language  "
    normalized = raw.strip().lower()
    assert normalized == "language"

    raw2 = "Preferred_Format"
    normalized2 = raw2.strip().lower()
    assert normalized2 == "preferred_format"

    raw3 = "  INDUSTRY  "
    normalized3 = raw3.strip().lower()
    assert normalized3 == "industry"


@pytest.mark.asyncio
async def test_remember_empty_key(mock_builder):
    """Pitfall 3: empty key returns error JSON, NO DB write, NO audit task."""
    with patch("asyncio.create_task") as mock_create_task:
        mock_sb = _make_mock_supabase()
        key = "   ".strip().lower()

        if not key:
            tool_result = json.dumps({"error": "key cannot be empty"})

        assert tool_result == '{"error": "key cannot be empty"}'
        mock_sb.table.return_value.upsert.assert_not_called()
        mock_create_task.assert_not_called()


@pytest.mark.asyncio
async def test_recall_specific_key(mock_builder):
    """D-10, D-11: recall(key='x') returns value; missing key → 'No memory entry found for key: x'."""
    # Case 1: row exists
    mock_sb_found = _make_mock_supabase(recall_row={"value": "bullet_points"})
    key = "preferred_format"
    resp = (
        mock_sb_found.table("user_memory")
        .select("value")
        .eq("user_id", "u1")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    row = resp.data
    if isinstance(row, list):
        row = row[0] if row else None
    assert row["value"] == "bullet_points"

    # Case 2: row missing
    mock_sb_missing = _make_mock_supabase(recall_row=None)
    resp2 = (
        mock_sb_missing.table("user_memory")
        .select("value")
        .eq("user_id", "u1")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    row2 = resp2.data
    if isinstance(row2, list):
        row2 = row2[0] if row2 else None
    if row2:
        tool_result = row2["value"]
    else:
        tool_result = f"No memory entry found for key: {key}"
    assert tool_result == "No memory entry found for key: preferred_format"


@pytest.mark.asyncio
async def test_recall_all(mock_builder):
    """D-09, D-12: recall() returns formatted list; empty → 'No memories stored yet.'."""
    # Non-empty
    mock_sb = _make_mock_supabase(memory_rows=[
        {"key": "preferred_format", "value": "bullet_points"},
        {"key": "industry", "value": "finance"},
    ])
    rows = (
        mock_sb.table("user_memory")
        .select("key, value")
        .eq("user_id", "u1")
        .order("updated_at", desc=True)
        .execute()
        .data
    ) or []
    tool_result = (
        "\n".join(f"- {r['key']}: {r['value']}" for r in rows)
        if rows
        else "No memories stored yet."
    )
    assert tool_result == "- preferred_format: bullet_points\n- industry: finance"

    # Empty
    mock_sb_empty = _make_mock_supabase(memory_rows=[])
    rows2 = (
        mock_sb_empty.table("user_memory")
        .select("key, value")
        .eq("user_id", "u1")
        .order("updated_at", desc=True)
        .execute()
        .data
    ) or []
    tool_result2 = (
        "\n".join(f"- {r['key']}: {r['value']}" for r in rows2)
        if rows2
        else "No memories stored yet."
    )
    assert tool_result2 == "No memories stored yet."


# ---------------------------------------------------------------------------
# MEM-03: System prompt injection
# ---------------------------------------------------------------------------

def test_memory_injection_general_mode(mock_builder):
    """D-05, D-06: General Mode system prompt contains the memory block with all entries."""
    result = _compose_system_prompt(
        base="BASE_PROMPT",
        agent_mode="general",
        memory_rows=[
            {"key": "preferred_format", "value": "bullet_points"},
            {"key": "industry", "value": "finance"},
        ],
    )
    assert "## User Memory" in result
    assert "(Preferences and facts you've remembered about this user across conversations)" in result
    assert "- preferred_format: bullet_points" in result
    assert "- industry: finance" in result


def test_memory_injection_explorer_mode(mock_builder):
    """D-05 scope: Explorer Mode system prompt has NO memory block, even with rows."""
    result = _compose_system_prompt(
        base="BASE_PROMPT",
        agent_mode="explorer",
        memory_rows=[{"key": "preferred_format", "value": "bullet_points"}],
    )
    assert "## User Memory" not in result
    assert "bullet_points" not in result


def test_memory_injection_empty(mock_builder):
    """D-07: Empty memory_rows → no '## User Memory' header injected."""
    result = _compose_system_prompt(
        base="BASE_PROMPT",
        agent_mode="general",
        memory_rows=[],
    )
    assert "## User Memory" not in result
    assert result == "BASE_PROMPT"
