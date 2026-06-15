"""Phase 101.1-08 (gap 5b) — distinct ephemeral output filename in _render_template_post.

The collision this closes (UAT run 4ea9bc56): on the EPHEMERAL-upload branch
(``asset_dict is None``) the emitter derived ``out_filename`` straight from
``resolved_template["filename"]`` — the UPLOADED template's name. The rendered
deliverable therefore reused the uploaded template's workspace path → ws_write_file
OVERWROTE the user's template AND forced a version-2 write → the gap-5a binary-delta
crash. Fixing 5a alone is insufficient; the ephemeral output must also write to a
DISTINCT path so it persists as a fresh v1 (no delta, no collision, template intact).

Fix (Task 2): on the ephemeral branch build a distinct ``out_filename`` (a
``deliverable-filled.<ext>``-style stem) that PRESERVES the template extension (so the
integrity re-open infers the right OOXML format). The BOUND branch is unchanged — the
handler already routes the bound output to a distinct ``/risk-register.docx``.

Test seam: ``_render_template_post`` lazily imports ``_handle_render_template`` from
``tool_dispatcher`` and awaits it with an ``args`` dict. We patch that symbol to
CAPTURE the ``args`` (and short-circuit the real render), then assert on
``args["out_filename"]``.
"""
from __future__ import annotations

import json
import os
import pytest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

from app.services.harness import emitters


def _ok_tool_result():
    """A minimal stand-in for _handle_render_template's ToolResult (.result is JSON)."""
    return SimpleNamespace(result=json.dumps({"status": "ok", "path": "/out"}))


class _Asset:
    """A minimal AssetRef-like object for the BOUND branch."""

    def __init__(self, filename: str):
        self.asset_id = "a-1"
        self.filename = filename
        self.kind = "template"
        self.mime = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )


@pytest.mark.asyncio
async def test_ephemeral_out_filename_distinct_from_template():
    """Test 1: EPHEMERAL branch (asset_dict None) — the args.out_filename passed to
    the handler is DISTINCT from resolved_template["filename"] and shares its ext."""
    resolved = {
        "asset_ref": None,  # ephemeral upload
        "filename": "client-template.docx",
        "retrieved_ids": ["doc-1"],
    }
    captured = {}

    async def _capture(args, ctx):
        captured.update(args)
        return _ok_tool_result()

    with patch(
        "app.services.tool_dispatcher._handle_render_template",
        new=AsyncMock(side_effect=_capture),
    ):
        await emitters._render_template_post({"scalars": []}, resolved, ctx=object())

    out = captured["out_filename"]
    assert out != resolved["filename"], (
        f"ephemeral output must NOT reuse the uploaded template name; got {out!r}"
    )
    assert os.path.splitext(out)[1] == ".docx", (
        f"ephemeral output must preserve the template extension; got {out!r}"
    )
    # The ephemeral branch passes asset=None (the handler's ephemeral path).
    assert captured["asset"] is None


@pytest.mark.asyncio
async def test_bound_branch_unchanged():
    """Test 2 (regression): BOUND branch (asset_dict present) — behavior unchanged.
    The handler receives a non-None asset dict and the out_filename is derived as
    before (the handler routes the bound output to its own distinct path)."""
    asset = _Asset("risk-register.docx")
    resolved = {
        "asset_ref": asset,
        "filename": "risk-register.docx",
        "retrieved_ids": [],
    }
    captured = {}

    async def _capture(args, ctx):
        captured.update(args)
        return _ok_tool_result()

    with patch(
        "app.services.tool_dispatcher._handle_render_template",
        new=AsyncMock(side_effect=_capture),
    ):
        await emitters._render_template_post({"scalars": []}, resolved, ctx=object())

    # Bound path: asset dict is populated (non-None) — the regression invariant.
    assert captured["asset"] is not None
    assert captured["asset"]["filename"] == "risk-register.docx"
    assert captured["asset"]["kind"] == "template"


@pytest.mark.asyncio
@pytest.mark.parametrize("ext", ["docx", "pptx", "xlsx"])
async def test_ephemeral_preserves_extension(ext):
    """Test 3: the ephemeral output preserves the template extension so the
    integrity re-open infers the right OOXML format (pptx→pptx, xlsx→xlsx)."""
    resolved = {
        "asset_ref": None,
        "filename": f"deck.{ext}",
        "retrieved_ids": [],
    }
    captured = {}

    async def _capture(args, ctx):
        captured.update(args)
        return _ok_tool_result()

    with patch(
        "app.services.tool_dispatcher._handle_render_template",
        new=AsyncMock(side_effect=_capture),
    ):
        await emitters._render_template_post({"scalars": []}, resolved, ctx=object())

    out = captured["out_filename"]
    assert os.path.splitext(out)[1] == f".{ext}", (
        f"a .{ext} template must yield a .{ext} output; got {out!r}"
    )
    assert out != resolved["filename"]
