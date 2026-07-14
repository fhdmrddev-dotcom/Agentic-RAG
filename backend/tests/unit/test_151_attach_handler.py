"""Phase 151 Wave-0 — FILE-01 ``_handle_attach_skill_file`` handler RED scaffold (Plan 04).

Covers the FILE-01 threat model + D-05/D-06/D-07 contract with a mocked ``ctx.supabase``
(owner-only skill SELECT + skill_files pre-check/upsert) and patched source readers:

  * D-05 four sources — workspace (`_get_file_content`), sandbox_output
    (`copy_from_runtime` harvest), inline (`content` arg), kb_document (the reused
    Plan 01 resolver ``_fetch_owned_document_bytes``) each resolve bytes → upsert.
  * D-06 / T-04 owner-only WRITE gate — a skill NOT owned by ``ctx.current_user`` (empty
    SELECT ``.data``) OR an ``is_system`` skill → refuse, no upload, no DB write.
  * D-07 overwrite-in-place — a pre-existing (skill_id, filename) row → status "updated";
    a new filename → "created"; the DB write is a race-immune
    ``.upsert(..., on_conflict="skill_id,filename")``.
  * T-02 — the Storage path passed to ``.upload`` is exactly
    ``{ctx.current_user['id']}/{skill_id}/{filename}`` (owner-prefixed, never a model arg).
  * T-03 — kb_document reuses FILE-02's owner-scope resolver; its ``{"error": ...}`` dict
    propagates as an honest ToolResult error (the doc→skill data-movement path stays
    owner-scoped on both ends).
  * inline weak-model guard — empty / oversized inline ``content`` → honest error.

Imports live inside helpers so the file COLLECTS while the handler is unbuilt (RED).
"""
from __future__ import annotations

import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _handler():
    """The FILE-01 handler (ImportError while RED)."""
    from app.services.tool_dispatcher import _handle_attach_skill_file  # noqa: F401

    return _handle_attach_skill_file


def _sb(skill_row, existing_file_row=None):
    """Mock supabase: table('skills') owner SELECT + table('skill_files') pre-check/upsert.

    ``skill_row``          → owner SELECT ``.data`` (None = not owned / not found).
    ``existing_file_row``  → skill_files pre-check ``.data`` (None = no collision → 'created').
    ``storage.from_('skill-files').upload`` is a MagicMock — asserted (not) called + its
    ``path`` kwarg is the owner-prefixed T-02 path.
    """
    sb = MagicMock()

    skills_tbl = MagicMock()
    skill_resp = MagicMock()
    skill_resp.data = skill_row
    (
        skills_tbl.select.return_value.eq.return_value.eq.return_value
        .maybe_single.return_value.execute.return_value
    ) = skill_resp

    files_tbl = MagicMock()
    exist_resp = MagicMock()
    exist_resp.data = existing_file_row
    (
        files_tbl.select.return_value.eq.return_value.eq.return_value
        .maybe_single.return_value.execute.return_value
    ) = exist_resp
    upsert_resp = MagicMock()
    upsert_resp.data = [{"id": "sf-new"}]
    files_tbl.upsert.return_value.execute.return_value = upsert_resp

    def _table(name):
        return skills_tbl if name == "skills" else files_tbl

    sb.table.side_effect = _table
    sb.storage.from_.return_value.upload.return_value = MagicMock()
    return sb


def _upload(sb):
    return sb.storage.from_.return_value.upload


def _files_tbl(sb):
    return sb.table("skill_files")


_OWNED = {"id": "skill-1", "is_system": False}


# ---------------------------------------------------------------------------
# D-05 source #1 — workspace file bytes → upsert (created)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_source_workspace_uploads_and_creates(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    file_row = {"mime_type": "text/x-python", "content_inline": b"print('hi')"}
    with patch("app.services.tool_dispatcher.get_file_by_path",
               AsyncMock(return_value=file_row)), \
         patch("app.services.tool_dispatcher._get_file_content",
               AsyncMock(return_value=b"print('hi')")):
        result = await handler({
            "target_skill_name": "My Skill", "filename": "helper.py",
            "source": "workspace", "workspace_path": "/helper.py",
        }, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "created"
    assert parsed["filename"] == "helper.py"
    assert parsed["skill"] == "My Skill"
    _upload(sb).assert_called_once()
    # T-02 — owner-prefixed Storage path built from ctx user id + resolved skill id.
    assert _upload(sb).call_args.kwargs["path"] == "owner-1/skill-1/helper.py"
    _files_tbl(sb).upsert.assert_called_once()
    assert _files_tbl(sb).upsert.call_args.kwargs.get("on_conflict") == "skill_id,filename"


# ---------------------------------------------------------------------------
# D-05 source #2 — sandbox output bytes harvested via copy_from_runtime
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_source_sandbox_output_harvests_and_creates(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})

    def _copy(container_dir, dest_dir):
        with open(os.path.join(dest_dir, "chart.png"), "wb") as f:
            f.write(b"PNG-OUTPUT-BYTES")

    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        session.copy_from_runtime.side_effect = _copy
        result = await handler({
            "target_skill_name": "My Skill", "filename": "chart.png",
            "source": "sandbox_output", "sandbox_path": "/sandbox/output/chart.png",
        }, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "created"
    _upload(sb).assert_called_once()
    assert _upload(sb).call_args.kwargs["file"] == b"PNG-OUTPUT-BYTES"
    assert _upload(sb).call_args.kwargs["path"] == "owner-1/skill-1/chart.png"


@pytest.mark.asyncio
async def test_source_sandbox_output_missing_file_errors(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})

    def _copy_empty(container_dir, dest_dir):
        pass  # nothing harvested

    with patch("app.services.tool_dispatcher.sandbox_manager") as sm:
        session = sm.get_or_create.return_value
        session.copy_from_runtime.side_effect = _copy_empty
        result = await handler({
            "target_skill_name": "My Skill", "filename": "missing.png",
            "source": "sandbox_output", "sandbox_path": "/sandbox/output/missing.png",
        }, ctx)
    assert "error" in json.loads(result.result)
    _upload(sb).assert_not_called()


# ---------------------------------------------------------------------------
# D-05 source #3 — inline content bytes; weak-model guards (empty / oversized)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_source_inline_uploads_content_bytes(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    result = await handler({
        "target_skill_name": "My Skill", "filename": "notes.md",
        "source": "inline", "content": "# Notes\nhello",
    }, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "created"
    assert _upload(sb).call_args.kwargs["file"] == b"# Notes\nhello"


@pytest.mark.asyncio
async def test_source_inline_empty_content_errors(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    result = await handler({
        "target_skill_name": "My Skill", "filename": "empty.txt",
        "source": "inline", "content": "",
    }, ctx)
    assert "error" in json.loads(result.result)
    _upload(sb).assert_not_called()


@pytest.mark.asyncio
async def test_source_inline_oversized_content_errors(make_tool_context):
    handler = _handler()
    from app.services import tool_dispatcher as td
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    huge = "x" * (td._ATTACH_INLINE_MAX_BYTES + 1)
    result = await handler({
        "target_skill_name": "My Skill", "filename": "huge.txt",
        "source": "inline", "content": huge,
    }, ctx)
    assert "error" in json.loads(result.result)
    _upload(sb).assert_not_called()


# ---------------------------------------------------------------------------
# D-05 source #4 — kb_document reuses FILE-02's owner-scope resolver (T-03)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_source_kb_document_reuses_resolver(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    with patch("app.services.tool_dispatcher._fetch_owned_document_bytes",
               AsyncMock(return_value=("orig.docx", b"DOCX-BYTES", "application/msword"))):
        result = await handler({
            "target_skill_name": "My Skill", "filename": "template.docx",
            "source": "kb_document", "document_id": "doc-9",
        }, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "created"
    assert _upload(sb).call_args.kwargs["file"] == b"DOCX-BYTES"


@pytest.mark.asyncio
async def test_source_kb_document_resolver_error_propagates(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "attacker-9"})
    # T-03 — resolver refuses cross-user doc; its {"error"} dict must propagate honestly.
    with patch("app.services.tool_dispatcher._fetch_owned_document_bytes",
               AsyncMock(return_value={"error": "Document 'doc-x' not found or access denied."})):
        result = await handler({
            "target_skill_name": "My Skill", "filename": "steal.docx",
            "source": "kb_document", "document_id": "doc-x",
        }, ctx)
    assert "not found or access denied" in result.result
    _upload(sb).assert_not_called()


# ---------------------------------------------------------------------------
# D-07 — colliding filename overwrites in place → status "updated"
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_collision_reports_updated(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row={"id": "sf-existing"})
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    result = await handler({
        "target_skill_name": "My Skill", "filename": "helper.py",
        "source": "inline", "content": "print('v2')",
    }, ctx)
    parsed = json.loads(result.result)
    assert parsed["status"] == "updated"
    # D-07 — Storage overwrite requires upsert=true; DB write is the race-immune upsert.
    assert _upload(sb).call_args.kwargs["file_options"].get("upsert") == "true"
    assert _files_tbl(sb).upsert.call_args.kwargs.get("on_conflict") == "skill_id,filename"


# ---------------------------------------------------------------------------
# T-04 / SC#4 — owner-only WRITE gate: not-owned + is_system → refuse
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_refuse_when_skill_not_owned(make_tool_context):
    handler = _handler()
    sb = _sb(None, existing_file_row=None)  # owner SELECT empty → not owned by this user
    ctx = make_tool_context(supabase=sb, current_user={"id": "attacker-9"})
    result = await handler({
        "target_skill_name": "Someone Elses Skill", "filename": "x.py",
        "source": "inline", "content": "print(1)",
    }, ctx)
    assert "error" in json.loads(result.result)
    _upload(sb).assert_not_called()
    _files_tbl(sb).upsert.assert_not_called()


@pytest.mark.asyncio
async def test_refuse_when_skill_is_system(make_tool_context):
    handler = _handler()
    sb = _sb({"id": "builtin-1", "is_system": True}, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    result = await handler({
        "target_skill_name": "Built-in Skill", "filename": "x.py",
        "source": "inline", "content": "print(1)",
    }, ctx)
    assert "error" in json.loads(result.result)
    _upload(sb).assert_not_called()
    _files_tbl(sb).upsert.assert_not_called()


# ---------------------------------------------------------------------------
# T-02 — storage path is ALWAYS owner-prefixed, never a model-supplied path even
#        when the model tries a traversal filename
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_owner_prefixed_path_defends_traversal(make_tool_context):
    handler = _handler()
    sb = _sb(_OWNED, existing_file_row=None)
    ctx = make_tool_context(supabase=sb, current_user={"id": "owner-1"})
    result = await handler({
        "target_skill_name": "My Skill", "filename": "../../etc/passwd",
        "source": "inline", "content": "data",
    }, ctx)
    assert json.loads(result.result)["status"] == "created"
    path = _upload(sb).call_args.kwargs["path"]
    assert path.startswith("owner-1/skill-1/")
    assert ".." not in path.split("owner-1/skill-1/", 1)[1]
