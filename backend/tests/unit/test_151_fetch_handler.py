"""Phase 151 Wave-0 — FILE-02 `_handle_fetch_document_file` handler RED scaffold.

Covers the FILE-02 threat model + honesty contract with a mocked ``ctx.supabase``
(owner-scope SELECT) and a patched ``sandbox_manager``/session:

  * D-01  null file_path  → honest "No original file" error, NO download attempted
  * D-02  file_size > cap → honest size error stating the actual MB, download
          NOT called (proves the gate runs PRE-download — no partial binary)
  * D-03  happy path      → session.copy_to_runtime lands the bytes at
          /sandbox/input/<safe>; the ToolResult path == that container path
  * T-01  crafted filename "../../etc/x" → lands as a scrubbed basename under
          /sandbox/input/ (basename + charset scrub, no ".." segment)
  * D-04 / SC#4  non-owner user_id → owner SELECT empty AND global fallback empty
          → "not found or access denied", never cross-user

Also locks the reusable resolver contract Plan 04 (FILE-01 source #4) imports:
``_fetch_owned_document_bytes`` returns ``(filename, bytes, mime)`` on success and an
``{"error": ...}`` dict on every refusal.

Imports are inside helpers so the file collects while the code is unbuilt (RED).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _handler():
    """The FILE-02 handler (ImportError while RED)."""
    from app.services.tool_dispatcher import _handle_fetch_document_file  # noqa: F401

    return _handle_fetch_document_file


def _resolver():
    """The reusable owner-scope bytes resolver (FILE-01 source #4 contract)."""
    from app.services.tool_dispatcher import _fetch_owned_document_bytes  # noqa: F401

    return _fetch_owned_document_bytes


def _sb(owner_row):
    """Build a MagicMock supabase whose owner SELECT returns ``owner_row``.

    The owner chain is ``.table().select().eq().eq().maybe_single().execute()`` (two
    ``.eq`` calls — id + user_id). ``storage.from_("documents").download`` returns real
    bytes and is asserted un-called on the PRE-download refusal paths (D-01 / D-02).
    """
    sb = MagicMock()
    resp = MagicMock()
    resp.data = owner_row
    (
        sb.table.return_value.select.return_value
        .eq.return_value.eq.return_value.maybe_single.return_value
        .execute.return_value
    ) = resp
    sb.storage.from_.return_value.download.return_value = b"REAL-DOCUMENT-BYTES"
    return sb


def _download(sb):
    return sb.storage.from_.return_value.download


# ---------------------------------------------------------------------------
# D-01 — no original file → honest error, no download
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_no_original_file_returns_honest_error(make_tool_context):
    handler = _handler()
    row = {"id": "d1", "filename": "notes.txt", "file_path": None,
           "file_size": 10, "mime_type": "text/plain"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "d1"}, ctx)
    assert "No original" in result.result
    _download(sb).assert_not_called()
    session.copy_to_runtime.assert_not_called()


# ---------------------------------------------------------------------------
# D-02 — over-cap refused PRE-download (no partial binary)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_over_cap_refused_before_download(make_tool_context):
    handler = _handler()
    big = 500 * 1024 * 1024  # 500 MB — over any reasonable operator cap
    row = {"id": "d2", "filename": "huge.pdf", "file_path": "u/d2/huge.pdf",
           "file_size": big, "mime_type": "application/pdf"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "d2"}, ctx)
    assert "over" in result.result.lower()
    assert "500" in result.result, "error must state the actual file size in MB"
    _download(sb).assert_not_called()  # PRE-download gate — proves no partial fetch
    session.copy_to_runtime.assert_not_called()


# ---------------------------------------------------------------------------
# D-03 — happy path lands at /sandbox/input/<safe> and returns that path
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_happy_path_ships_to_sandbox_input(make_tool_context):
    handler = _handler()
    row = {"id": "d3", "filename": "report.docx", "file_path": "u/d3/report.docx",
           "file_size": 4096, "mime_type":
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "d3"}, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "ok"
    assert parsed["path"] == "/sandbox/input/report.docx"
    assert parsed["size_bytes"] == len(b"REAL-DOCUMENT-BYTES")
    _download(sb).assert_called_once()
    session.copy_to_runtime.assert_called_once()
    container_arg = session.copy_to_runtime.call_args.args[1]
    assert container_arg == "/sandbox/input/report.docx"


# ---------------------------------------------------------------------------
# T-01 — path traversal via crafted documents.filename cannot escape /sandbox/input/
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_path_traversal_filename_sanitized(make_tool_context):
    handler = _handler()
    row = {"id": "d4", "filename": "../../etc/x", "file_path": "u/d4/orig",
           "file_size": 32, "mime_type": "text/plain"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "d4"}, ctx)
    landed = json.loads(result.result)["path"]
    assert landed.startswith("/sandbox/input/")
    assert "/../" not in landed
    assert ".." not in landed.split("/sandbox/input/", 1)[1]
    container_arg = session.copy_to_runtime.call_args.args[1]
    assert container_arg == landed
    assert container_arg.startswith("/sandbox/input/")
    assert "/../" not in container_arg


# ---------------------------------------------------------------------------
# D-04 / SC#4 — non-owner → owner empty + global empty → not found, never cross-user
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cross_user_not_found_never_reads_others_doc(make_tool_context):
    handler = _handler()
    sb = _sb(None)  # owner SELECT returns empty .data
    ctx = make_tool_context(supabase=sb, current_user={"id": "attacker-9"})
    with patch("app.services.tool_dispatcher.get_globally_visible_folder_ids",
               AsyncMock(return_value=[])), \
         patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "someone-elses-doc"}, ctx)
    assert "not found or access denied" in result.result
    _download(sb).assert_not_called()
    session.copy_to_runtime.assert_not_called()


# ---------------------------------------------------------------------------
# Reusable resolver contract (locks the FILE-01 source #4 symbol Plan 04 imports)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_resolver_returns_tuple_on_success(make_tool_context):
    resolver = _resolver()
    row = {"id": "d5", "filename": "a.csv", "file_path": "u/d5/a.csv",
           "file_size": 12, "mime_type": "text/csv"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    out = await resolver(ctx, "d5")
    assert isinstance(out, tuple)
    filename, data, mime = out
    assert filename == "a.csv"
    assert data == b"REAL-DOCUMENT-BYTES"
    assert mime == "text/csv"


@pytest.mark.asyncio
async def test_resolver_returns_error_dict_when_no_original(make_tool_context):
    resolver = _resolver()
    row = {"id": "d6", "filename": "a.txt", "file_path": None,
           "file_size": 5, "mime_type": "text/plain"}
    sb = _sb(row)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    out = await resolver(ctx, "d6")
    assert isinstance(out, dict)
    assert "error" in out
    _download(sb).assert_not_called()


# ---------------------------------------------------------------------------
# WR-01 — a bad-UUID / transient DB failure on the SELECT becomes the honest
# refusal (like read_path), NEVER a raw PostgREST/DB error leaked to the loop
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_resolver_db_error_returns_honest_refusal_no_leak(make_tool_context):
    resolver = _resolver()
    sb = MagicMock()
    raw = 'invalid input syntax for type uuid: "not-a-uuid"'
    (
        sb.table.return_value.select.return_value
        .eq.return_value.eq.return_value.maybe_single.return_value
        .execute.side_effect
    ) = Exception(raw)
    sb.storage.from_.return_value.download.return_value = b"REAL-DOCUMENT-BYTES"
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    out = await resolver(ctx, "not-a-uuid")
    assert isinstance(out, dict)
    assert "not found or access denied" in out["error"]
    assert raw not in out["error"], "raw DB error text must NOT leak into the tool result"
    _download(sb).assert_not_called()


@pytest.mark.asyncio
async def test_handler_db_error_returns_honest_refusal(make_tool_context):
    """WR-01 — the propagation path: a bare APIError out of the resolver must not
    surface as 'Tool execution failed: <raw>' — the handler relays the honest dict."""
    handler = _handler()
    sb = MagicMock()
    (
        sb.table.return_value.select.return_value
        .eq.return_value.eq.return_value.maybe_single.return_value
        .execute.side_effect
    ) = Exception("PGRST connection reset")
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        result = await handler({"document_id": "not-a-uuid"}, ctx)
    assert "not found or access denied" in result.result
    assert "PGRST connection reset" not in result.result
    session.copy_to_runtime.assert_not_called()
