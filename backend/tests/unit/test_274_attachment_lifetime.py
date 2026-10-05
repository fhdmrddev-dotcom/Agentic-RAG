"""Phase 274 plan 01 Task 1 (ATT-01 / D-05, D-06, D-21, D-26, D-02) — A CHAT ATTACHMENT LIVES
FOR ITS THREAD; A TEMPLATE INPUT KEEPS ITS TTL.

⭐ THE MECHANISM IS `expires_at = NULL`, CHOSEN BY THE DOOR. Every read gate already admits a
NULL expiry, the template sweeper (`expires_at IS NOT NULL AND expires_at <= now()`) and the run
pin (`... AND expires_at IS NOT NULL`) already skip it, and the agent allow-list and the chip keep
testing ONE string (`template_input`). So the split needs no migration and no new `kind` (D-06).

⛔ THE DEFAULT DOOR IS UNCHANGED (D-21). An upload with no `lifetime` — the panel
`TemplateUpload` and the workflow-launch door — still writes `now + template_ttl_hours`.

Every case is STUBBED — no Postgres connection, no Storage call, no row is created by this file.
"""
from __future__ import annotations

import inspect
import io
import re
import typing
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api import workspace
from app.services import agent_loop

WORKSPACE_SRC = Path(workspace.__file__).read_text(encoding="utf-8")
TEMPLATE_SERVICE_SRC = (
    Path(workspace.__file__).resolve().parents[1] / "services" / "template_service.py"
).read_text(encoding="utf-8")

THREAD = "11111111-1111-4111-8111-111111111111"
USER = {"id": "33333333-3333-4333-8333-333333333333"}


def _docx_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<document/>")
    return buf.getvalue()


def _strip_comments(src: str) -> str:
    """Prose about code is not code — the 244 stripper, verbatim in shape."""
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out


class _FakeConn:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False


class _StubUpload:
    def __init__(self, filename: str, body: bytes) -> None:
        self.filename = filename
        self._body = body
        self.size = len(body)

    async def read(self) -> bytes:
        return self._body


@pytest.fixture
def stubbed(monkeypatch):
    """Every seam the routes touch, replaced. Nothing reaches a database."""
    monkeypatch.setattr(workspace, "_verify_thread_ownership", AsyncMock(return_value=None))
    monkeypatch.setattr(
        workspace.connector_service,
        "get_connection",
        AsyncMock(return_value=SimpleNamespace(id="conn-1", service_id="google_workspace")),
    )
    monkeypatch.setattr(workspace, "get_user_pg_connection", lambda *a, **k: _FakeConn())
    written: dict = {}

    async def _fake_write(_conn, _sb, **kw):
        written.update(kw)
        return {"file_id": "wf-1", "path": kw["path"], "size_bytes": len(kw["content"])}

    monkeypatch.setattr(workspace, "ws_write_file", _fake_write)
    monkeypatch.setattr(
        workspace,
        "load_app_settings_async",
        AsyncMock(return_value=SimpleNamespace(template_ttl_hours=24)),
    )
    return written


async def _upload(lifetime):
    """Direct call — every query param passed EXPLICITLY (the raw-`Query`-default trap)."""
    return await workspace.upload_template(
        thread_id=THREAD,
        request=MagicMock(),
        file=_StubUpload("Meridian-Q4.docx", _docx_bytes()),
        lifetime=lifetime,
        current_user=USER,
        supabase=MagicMock(),
    )


# ── 1 · the composer's local door writes a THREAD-LIFE row ───────────────────────────────
@pytest.mark.asyncio
async def test_a_thread_lifetime_upload_writes_a_null_expiry(stubbed):
    """PLANT to drive RED: keep `expires_at = now + ttl` on every path."""
    result = await _upload("thread")

    assert stubbed["kind"] == "template_input", "D-06: no new kind — the allow-list tests ONE string"
    assert stubbed["expires_at"] is None, "D-05: a chat attachment lives for its thread"
    assert "expires_at" in result, "the key is always present, never omitted"
    assert result["expires_at"] is None
    assert result["kind"] == "template_input"


# ── 2 · the default door keeps the template TTL, byte-identically (D-21) ─────────────────
@pytest.mark.asyncio
async def test_a_template_lifetime_upload_keeps_the_ttl(stubbed):
    before = datetime.now(timezone.utc)
    result = await _upload("template")
    after = datetime.now(timezone.utc)

    exp = stubbed["expires_at"]
    assert isinstance(exp, datetime)
    assert before + timedelta(hours=24) <= exp <= after + timedelta(hours=24)
    assert isinstance(result["expires_at"], str)
    assert datetime.fromisoformat(result["expires_at"]) == exp


@pytest.mark.asyncio
async def test_the_raw_query_default_fails_closed_to_the_ttl(stubbed):
    """A direct caller that omits `lifetime` receives FastAPI's `Query(...)` object, not the
    string. ⛔ That must read as `template` — a truthy non-string must never mean thread-life.

    PLANT to drive RED: pass `lifetime=lifetime` straight through instead of the `==` ternary.
    """
    default = inspect.signature(workspace.upload_template).parameters["lifetime"].default
    assert not isinstance(default, str), "non-vacuity: the default must be the FastAPI Query object"
    await _upload(default)
    assert isinstance(stubbed["expires_at"], datetime), "the raw Query default did not fail closed"


# ── 3 · the composer's cloud door writes a THREAD-LIFE row ───────────────────────────────
@pytest.mark.asyncio
async def test_a_cloud_attach_writes_a_null_expiry(monkeypatch, stubbed):
    monkeypatch.setattr(
        "app.services.sources.import_service.fetch_cloud_file",
        AsyncMock(return_value=("Meridian-Q4.docx", _docx_bytes(), "application/octet-stream")),
    )
    body = workspace.WorkspaceConnectionAttachRequest(connection_id="conn-1", file_id="cf-1")
    result = await workspace.attach_connection_file(
        thread_id=THREAD,
        request=MagicMock(),
        body=body,
        active_org="22222222-2222-4222-8222-222222222222",
        current_user=USER,
        supabase=MagicMock(),
    )
    assert stubbed["kind"] == "template_input"
    assert stubbed["expires_at"] is None
    assert "expires_at" in result and result["expires_at"] is None


# ── 4 · the parameter is a closed Literal (an out-of-set value is a 422) ─────────────────
def test_the_lifetime_param_is_a_closed_literal_defaulting_to_template():
    sig = inspect.signature(workspace.upload_template)
    assert "lifetime" in sig.parameters
    hints = typing.get_type_hints(workspace.upload_template)
    assert typing.get_origin(hints["lifetime"]) is typing.Literal
    assert set(typing.get_args(hints["lifetime"])) == {"template", "thread"}
    assert sig.parameters["lifetime"].default.default == "template"

    writer_hints = typing.get_type_hints(workspace._persist_workspace_upload)
    assert set(typing.get_args(writer_hints["lifetime"])) == {"template", "thread"}
    # REQUIRED on the writer — a third caller must choose, never inherit a lifetime silently.
    writer_param = inspect.signature(workspace._persist_workspace_upload).parameters["lifetime"]
    assert writer_param.default is inspect.Parameter.empty


def test_an_out_of_set_lifetime_is_a_422():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_user_supabase_client

    app = FastAPI()
    app.include_router(workspace.router)
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    client = TestClient(app)
    resp = client.post(
        f"/threads/{THREAD}/workspace/files?lifetime=forever",
        files={"file": ("a.docx", _docx_bytes())},
    )
    assert resp.status_code == 422


# ── 5 · the source fences that keep ONE writer, ONE gate, ONE TTL read (D-02) ────────────
def test_one_writer_one_gate_one_ttl_read():
    body = _strip_comments(WORKSPACE_SRC)
    assert body.count("await _persist_workspace_upload(") == 2
    assert body.count("= validate_upload(") == 1
    assert body.count("template_ttl_hours") == 1
    for forbidden in ("import_single_file", "mint_document_row", "ingest_splice", "splice_document"):
        assert forbidden not in body
    assert "MAX_FILE_SIZE = " not in body, "the 10 MB cap lives in workspace_service, untouched"


# ── 6 · a NULL-expiry row is never swept and never pinned (D-05 forward-only) ────────────
def test_the_sweeper_and_the_run_pin_skip_a_null_expiry():
    """PLANT to drive RED: widen the sweeper to `expires_at <= now() OR expires_at IS NULL`."""
    assert "expires_at IS NOT NULL AND expires_at <= now()" in TEMPLATE_SERVICE_SRC
    assert "kind = 'template_input' AND expires_at IS NOT NULL" in TEMPLATE_SERVICE_SRC


# ── 7 · the agent is told the truth (D-26) ───────────────────────────────────────────────
def test_the_agent_note_no_longer_says_the_files_expire():
    note = agent_loop._build_attachment_note(
        [{"path": "/x-report.docx", "size_bytes": 10, "mime_type": "x", "kind": "template_input"}]
    )
    assert "stay with this conversation" in note
    assert "They expire" not in note
    assert agent_loop._ATTACHMENT_KIND == "template_input"
