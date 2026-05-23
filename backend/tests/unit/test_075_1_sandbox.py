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
    filenames into the destination tmpdir.

    Plan 075.4-03 D-075.4-D1: each file gets a UNIQUE payload (filename-
    derived) so the SHA-256 content-hash dedup treats them as distinct.
    Pre-Plan-03 this used a constant ``b"x"*4`` which now collapses N
    files to 1 hash under the new dedup.
    """
    def _copy_from_runtime(_src_path, tmpdir):
        for fname in filenames:
            with open(os.path.join(tmpdir, fname), "wb") as f:
                # Unique-per-filename payload guarantees distinct SHA-256.
                f.write(f"stub-payload-for-{fname}".encode("utf-8"))

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
    """First call with previous_files={} returns all files as delta + the
    full current dict as the cumulative.

    Plan 075.4-03 D-075.4-D1/D2: pivot from set[str] to dict[content_hash, meta].
    """
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files={},
    )
    assert isinstance(result, tuple), "Must return tuple after Plan 04 signature extension"
    delta_files, current = result
    assert {f["filename"] for f in delta_files} == {"a.png", "b.png", "c.png"}
    # current is now dict[content_hash, meta]; check the projected filenames
    assert isinstance(current, dict)
    assert {meta["filename"] for meta in current.values()} == {"a.png", "b.png", "c.png"}


def test_harvest_delta_second_call_returns_only_new_files() -> None:
    """Second call where previous_files already contains 3 of the 4 hashes
    returns only the new (4th) file in the delta.

    Plan 075.4-03 D-075.4-D1: previous_files keyed by content hash, not filename.
    """
    import hashlib
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png", "d.png"])
    sb = _build_mock_supabase()

    # Pre-compute hashes for a/b/c (the helper writes unique-per-filename payloads).
    def _h(fname: str) -> str:
        return hashlib.sha256(f"stub-payload-for-{fname}".encode("utf-8")).hexdigest()

    previous = {
        _h("a.png"): {"filename": "a.png", "url": "/u/exec/a.png", "size": 21, "iteration": 0},
        _h("b.png"): {"filename": "b.png", "url": "/u/exec/b.png", "size": 21, "iteration": 0},
        _h("c.png"): {"filename": "c.png", "url": "/u/exec/c.png", "size": 21, "iteration": 0},
    }

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=previous,
    )
    delta_files, current = result
    # Only d.png is new — a/b/c hashes match previous → skipped.
    assert {f["filename"] for f in delta_files} == {"d.png"}
    # current dict contains all 4 hashes from THIS iteration's harvest.
    assert {meta["filename"] for meta in current.values()} == {"a.png", "b.png", "c.png", "d.png"}


def test_harvest_delta_no_new_files_returns_empty_delta() -> None:
    """Third call where every file's hash is already tracked → empty delta."""
    import hashlib
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png", "c.png"])
    sb = _build_mock_supabase()

    def _h(fname: str) -> str:
        return hashlib.sha256(f"stub-payload-for-{fname}".encode("utf-8")).hexdigest()

    previous = {
        _h("a.png"): {"filename": "a.png", "url": "/u/exec/a.png", "size": 21, "iteration": 0},
        _h("b.png"): {"filename": "b.png", "url": "/u/exec/b.png", "size": 21, "iteration": 0},
        _h("c.png"): {"filename": "c.png", "url": "/u/exec/c.png", "size": 21, "iteration": 0},
    }

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=previous,
    )
    delta_files, current = result
    assert delta_files == []
    # current still records this iteration's hashes
    assert {meta["filename"] for meta in current.values()} == {"a.png", "b.png", "c.png"}


def test_harvest_legacy_mode_returns_all_files_as_tuple() -> None:
    """previous_files=None (default) returns a tuple where the first element
    is the full list (matches Phase 075 behavior) and the second element is
    the cumulative dict so callers can start tracking later."""
    from app.services.sandbox_service import harvest_output_files

    session = _build_mock_session_with_files(["a.png", "b.png"])
    sb = _build_mock_supabase()

    result = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
    )
    # Plan 075.4-03 D-075.4-D1/D2: always returns a tuple. Callers that
    # pass previous_files=None get the full list as delta (legacy behavior)
    # plus the per-iteration current dict.
    assert isinstance(result, tuple)
    all_files, current = result
    assert {f["filename"] for f in all_files} == {"a.png", "b.png"}
    # current is now dict[content_hash, meta]; distinct payloads → distinct hashes.
    assert isinstance(current, dict)
    assert {meta["filename"] for meta in current.values()} == {"a.png", "b.png"}


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
