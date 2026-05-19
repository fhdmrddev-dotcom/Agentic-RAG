"""Phase 075.1 Plan 04 Task 2 — sandbox bundle tests.

Covers:
- Test 1 (B-260519-11): harvest_output_files first call with empty previous_files
  returns (all_files, current_set).
- Test 2 (B-260519-11): subsequent call with the prior set returns delta only.
- Test 3 (B-260519-11): no-new-files call returns empty delta.
- Test 4 (BUG-260514-01 / B-260519-11 backwards-compat): legacy mode
  (previous_files=None) returns the full list (tuple second element still
  populated for callers that want to start tracking later).
- Test 5 (B-260519-08 + B-260519-09): SYSTEM_PROMPT contains both the
  `pip install` hint and the `/sandbox/output/` write-path hint — uniformly
  applied across all providers (since all providers see the same prompt).
"""
from __future__ import annotations

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest


def _build_mock_session_with_files(filenames: list[str]):
    """Build a MagicMock session whose copy_from_runtime writes the given
    filenames into the destination tmpdir."""
    def _copy_from_runtime(_src_path, tmpdir):
        for fname in filenames:
            with open(os.path.join(tmpdir, fname), "wb") as f:
                f.write(b"x" * 4)  # 4-byte stub payload per file

    session = MagicMock()
    session.execute_command = MagicMock()
    session.copy_from_runtime = MagicMock(side_effect=_copy_from_runtime)
    return session


def _build_mock_supabase():
    """Build a MagicMock supabase client that no-ops storage uploads + table inserts."""
    sb = MagicMock()
    sb.storage.from_.return_value.upload = MagicMock()
    sb.table.return_value.insert.return_value.execute = MagicMock()
    return sb


def test_harvest_delta_first_call_with_empty_previous_returns_all_files() -> None:
    """First call with previous_files=set() returns all files as delta + the
    full current set as the cumulative."""
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=set(),
    )
    assert isinstance(result, tuple), "Must return tuple after Plan 04 signature extension"
    delta_files, current_set = result
    assert {f["filename"] for f in delta_files} == {"a.png", "b.png", "c.png"}
    assert current_set == {"a.png", "b.png", "c.png"}


def test_harvest_delta_second_call_returns_only_new_files() -> None:
    """Second call with a non-empty previous_files set returns only the new files."""
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png", "d.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files={"a.png", "b.png", "c.png"},
    )
    delta_files, current_set = result
    assert {f["filename"] for f in delta_files} == {"d.png"}
    assert current_set == {"a.png", "b.png", "c.png", "d.png"}


def test_harvest_delta_no_new_files_returns_empty_delta() -> None:
    """Third call where no files are new returns an empty delta but the set is preserved."""
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files={"a.png", "b.png", "c.png"},
    )
    delta_files, current_set = result
    assert delta_files == []
    assert current_set == {"a.png", "b.png", "c.png"}


def test_harvest_legacy_mode_returns_all_files_as_tuple() -> None:
    """previous_files=None (default) returns a tuple where the first element
    is the full list (matches Phase 075 behavior) and the second element is
    the current set so callers can start tracking later."""
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
    )
    # Plan 04 signature change: always returns a tuple. Callers that pass
    # previous_files=None get the full list as delta (legacy behavior) plus
    # the cumulative set.
    assert isinstance(result, tuple)
    all_files, current_set = result
    assert {f["filename"] for f in all_files} == {"a.png", "b.png"}
    assert current_set == {"a.png", "b.png"}


def test_system_prompt_contains_sandbox_hints_for_all_providers() -> None:
    """The agent-runner system prompt must contain both the `pip install`
    hint AND the `/sandbox/output/` write-path hint so all providers
    (OpenAI, Anthropic, Google, OpenRouter, Ollama) receive the same
    correctness guidance (B-260519-08 + B-260519-09 unification principle)."""
    from app.api.threads import SYSTEM_PROMPT

    # The /sandbox/output/ hint
    assert "/sandbox/output/" in SYSTEM_PROMPT, (
        "SYSTEM_PROMPT must mention /sandbox/output/ as the write path "
        "(B-260519-09 — OpenRouter wrote to /tmp/ in UAT)."
    )
    # The pip install hint
    assert "pip install" in SYSTEM_PROMPT, (
        "SYSTEM_PROMPT must include a pip install hint for ImportError "
        "/ ModuleNotFoundError recovery (B-260519-08 — OpenAI gpt-5.4 gave "
        "up after first ModuleNotFoundError)."
    )
