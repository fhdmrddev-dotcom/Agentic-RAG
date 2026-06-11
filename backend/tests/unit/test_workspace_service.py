"""Phase 101.1-08 (gap 5a) — binary-mime version-delta skip in write_file.

The crash this closes (UAT run 4ea9bc56): a second-version write of a binary
deliverable (docx/pptx/xlsx) computed a unified-text delta regardless of mime.
``_compute_delta_from_prev`` decodes the new bytes with ``errors="replace"`` —
that NEVER raises, so its "Binary file changed" guard was DEAD for a docx whose
literal ``\x00`` zip bytes decode to ``\x00`` (NUL). Postgres JSONB rejects a NUL
(``UntranslatableCharacterError`` at ``insert_version``). The deliverable passed
every gate (truncation + citation + render + integrity) then died at persist.

Fix (Task 1): skip the delta for binary mimes (a missing delta is harmless;
versioning still records the version row). Defense-in-depth: a NUL anywhere in
either text returns the NUL-free binary verdict shape even on a mis-classified
file, so a stray NUL can never reach a JSONB delta column.

Test seam: ``write_file`` calls db-layer helpers imported INTO
``workspace_service`` (``upsert_workspace_file`` / ``get_next_version`` /
``insert_version`` / ``count_files_in_thread``) plus the module-local
``_compute_delta_from_prev`` — patch those module attributes so the test runs
with no live DB / Storage. We assert on the ``delta_from_prev`` kwarg passed to
the patched ``insert_version``.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.services import workspace_service


# A tiny valid OOXML zip header carrying a literal NUL byte (the crash trigger).
_DOCX_BYTES = b"PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00!\x00rest\x00of\x00zip"
_TEXT_BYTES = b"# Title\n\nsecond version line\nanother line\n"


def _patch_db(monkeypatch, *, version_num: int):
    """Patch the db-layer helpers write_file imports so no live DB is touched.

    Returns the AsyncMock standing in for ``insert_version`` so the caller can
    assert on its ``delta_from_prev`` kwarg.
    """
    file_id = uuid4()
    monkeypatch.setattr(
        workspace_service,
        "upsert_workspace_file",
        AsyncMock(return_value=(file_id, False)),
    )
    monkeypatch.setattr(
        workspace_service, "get_next_version", AsyncMock(return_value=version_num)
    )
    insert_version_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(workspace_service, "insert_version", insert_version_mock)
    monkeypatch.setattr(
        workspace_service, "count_files_in_thread", AsyncMock(return_value=1)
    )
    return insert_version_mock


@pytest.mark.asyncio
async def test_binary_second_version_skips_delta_no_nul_crash(monkeypatch):
    """Test 1: a second-version .docx write does NOT raise and persists
    ``delta_from_prev=None`` (binary skip) — no UntranslatableCharacterError.

    If write_file reached ``_compute_delta_from_prev`` for a binary it would
    decode the \\x00 zip bytes to a NUL and (without this fix) hand a NUL-bearing
    delta to insert_version. We make that path explode if hit, then assert it
    is NEVER hit for a binary mime.
    """
    insert_version_mock = _patch_db(monkeypatch, version_num=2)

    # _compute_delta_from_prev must NOT be called for a binary — make it loud.
    compute_mock = AsyncMock(
        side_effect=AssertionError("delta must be skipped for a binary mime")
    )
    monkeypatch.setattr(workspace_service, "_compute_delta_from_prev", compute_mock)

    pool = AsyncMock()
    supabase = object()

    result = await workspace_service.write_file(
        pool,
        supabase,
        thread_id=uuid4(),
        user_id=uuid4(),
        path="/risk-register.docx",
        content=_DOCX_BYTES,
    )

    assert result["version"] == 2
    compute_mock.assert_not_awaited()
    # The persisted version carries a None delta (binary skip).
    _, kwargs = insert_version_mock.call_args
    assert kwargs["delta_from_prev"] is None, (
        f"binary version>1 must persist delta_from_prev=None; got {kwargs['delta_from_prev']!r}"
    )


@pytest.mark.asyncio
async def test_text_second_version_still_computes_unified_delta(monkeypatch):
    """Test 2 (regression): a second-version TEXT file STILL computes a
    unified-text delta — text diffs are unchanged by the binary skip."""
    insert_version_mock = _patch_db(monkeypatch, version_num=2)

    compute_mock = AsyncMock(
        return_value={"format": "unified", "diff": "+new line\n", "stats": {}}
    )
    monkeypatch.setattr(workspace_service, "_compute_delta_from_prev", compute_mock)

    pool = AsyncMock()
    supabase = object()

    await workspace_service.write_file(
        pool,
        supabase,
        thread_id=uuid4(),
        user_id=uuid4(),
        path="/notes.md",
        content=_TEXT_BYTES,
    )

    compute_mock.assert_awaited_once()
    _, kwargs = insert_version_mock.call_args
    assert kwargs["delta_from_prev"] is not None
    assert kwargs["delta_from_prev"]["format"] == "unified", (
        f"text version>1 must still get a unified delta; got {kwargs['delta_from_prev']!r}"
    )


def test_is_binary_mime_classification():
    """Test 3: _is_binary_mime — True for the 3 OOXML mimes + octet-stream +
    image/*; False for text/markdown / text/plain / application/json / text/csv."""
    is_binary = workspace_service._is_binary_mime

    # Binary — must skip the delta.
    assert is_binary(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert is_binary(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    assert is_binary(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert is_binary("application/octet-stream")
    assert is_binary("application/pdf")
    assert is_binary("image/png")
    assert is_binary("image/jpeg")

    # Text-ish — must KEEP the unified delta.
    assert not is_binary("text/markdown")
    assert not is_binary("text/plain")
    assert not is_binary("application/json")
    assert not is_binary("text/csv")


@pytest.mark.asyncio
async def test_compute_delta_nul_defense_in_depth(monkeypatch):
    """Defense-in-depth: even if a binary slips through classification, a NUL in
    the decoded text returns the NUL-free binary verdict — never a NUL delta.

    Drives _compute_delta_from_prev directly with a prev inline holding a NUL.
    """
    file_id = uuid4()
    # prev inline content carries a literal NUL (mis-classified binary).
    monkeypatch.setattr(
        workspace_service,
        "get_previous_version_content",
        AsyncMock(return_value=b"PK\x03\x04\x00prev"),
    )

    pool = AsyncMock()
    supabase = object()

    delta = await workspace_service._compute_delta_from_prev(
        pool, supabase, file_id, 2, b"PK\x03\x04\x00new", "/x.docx"
    )

    assert delta is not None
    assert "\x00" not in (delta.get("diff", "") or ""), "delta must be NUL-free"
    assert delta.get("format") in ("binary", "error"), (
        f"a NUL-bearing diff must return the NUL-free binary verdict; got {delta!r}"
    )
    assert "\x00" not in (delta.get("note", "") or "")
