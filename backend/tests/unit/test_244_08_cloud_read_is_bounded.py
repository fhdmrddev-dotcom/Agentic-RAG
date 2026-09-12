"""Phase 244-08 (T-244-06-07 / OPEN-3 / WR-04) — THE CHAT'S CLOUD DOOR READS UNDER ITS OWN CAP.

⛔ THE DEFECT THIS FILE EXISTS TO CLOSE. `244-06` shipped a net-new route,
``POST /threads/{id}/workspace/files/from-connection``, whose declared mitigation reads
*"the workspace cap is enforced before body materialisation"*. It was not. The route called
``fetch_cloud_file(conn, file_id)`` with no bound at all, and the 10 MB workspace cap was then
applied to ``len(raw)`` — **after** the whole body was resident in a worker.

⚠ THE AUDIT'S "MULTI-GB" FRAMING IS OVERSTATED, AND SAYING SO IS PART OF THE FIX.
``send_pinned_http`` already refuses a declared over-cap ``content-length`` before reading a
byte and aborts the wire read past ``max_bytes``; both first-party adapters already pass
``max_bytes=source_max_file_bytes()``. So the real residency bound was the SOURCE ceiling —
1–50 MB, default 25 — not multi-GB. The gap is real but it is **2.5–5× the declared cap**, not
unbounded. A threat recorded larger than it is gets fixed for the wrong reason.

⭐ WHAT THE FIX IS. ``read_file`` gains an optional ``max_bytes``; a caller may only TIGHTEN
the operator's ceiling, never raise it; the chat door asks for ``MAX_FILE_SIZE``. The cap then
lands on the transport, which enforces it BEFORE materialisation — which is the declared
mitigation, word for word.

⚠ DRIVEN RED BEFORE IT WAS TRUSTED. At `5edb08292` case 1 fails naming `max_bytes` (the route
passed none), cases 2/4 fail with ``read_file() got an unexpected keyword argument
'max_bytes'``, and case 5 reads 502 where it must read 422.

Every case is STUBBED — no network, no database, no Postgres connection.
"""
from __future__ import annotations

import io
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api import workspace
from app.security.egress import EgressResponseTooLarge
from app.services.workspace_service import MAX_FILE_SIZE

THREAD = "11111111-1111-4111-8111-111111111111"
ORG = "22222222-2222-4222-8222-222222222222"
USER = "33333333-3333-4333-8333-333333333333"


def _docx_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<document/>")
    return buf.getvalue()


class _FakeConn:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def stubbed(monkeypatch):
    """Every seam the route touches, replaced. Nothing reaches a database or a network."""
    monkeypatch.setattr(workspace, "_verify_thread_ownership", AsyncMock(return_value=None))
    monkeypatch.setattr(
        workspace.connector_service,
        "get_connection",
        AsyncMock(return_value=SimpleNamespace(id="conn-1", service_id="google_workspace")),
    )
    monkeypatch.setattr(workspace, "get_user_pg_connection", lambda *a, **k: _FakeConn())

    async def _fake_write(_conn, _sb, **kw):
        return {"file_id": "wf-1", "path": kw["path"], "size_bytes": len(kw["content"])}

    monkeypatch.setattr(workspace, "ws_write_file", _fake_write)
    monkeypatch.setattr(
        workspace,
        "load_app_settings_async",
        AsyncMock(return_value=SimpleNamespace(template_ttl_hours=24)),
    )


async def _call_route():
    body = workspace.WorkspaceConnectionAttachRequest(connection_id="conn-1", file_id="cf-1")
    return await workspace.attach_connection_file(
        thread_id=THREAD,
        request=MagicMock(),
        body=body,
        active_org=ORG,
        current_user={"id": USER},
        supabase=MagicMock(),
    )


# ── 1 · the chat door asks the source layer for ITS OWN cap, not the source ceiling ───────
@pytest.mark.asyncio
async def test_the_chat_cloud_door_asks_for_the_workspace_cap(monkeypatch, stubbed):
    """⛔ A RECORDING FAKE, never a MagicMock.

    `getattr` on a MagicMock auto-creates a truthy child, which is how a whole suite went
    green by accident in `244-07`. The cap must be read off a real recorded call.
    """
    seen: dict = {}

    async def _recording_fetch(connection, file_id, **kwargs):
        seen["args"] = (connection, file_id)
        seen["kwargs"] = dict(kwargs)
        return ("Meridian-Q4.docx", _docx_bytes(), "application/octet-stream")

    monkeypatch.setattr(
        "app.services.sources.import_service.fetch_cloud_file", _recording_fetch
    )

    await _call_route()

    assert "max_bytes" in seen["kwargs"], (
        "the chat cloud door called fetch_cloud_file with NO size bound — the declared "
        "mitigation for T-244-06-07 is 'the workspace cap is enforced before body "
        "materialisation', and a cap applied to len(raw) afterwards is not that."
    )
    assert seen["kwargs"]["max_bytes"] == MAX_FILE_SIZE, (
        f"the door asked for {seen['kwargs']['max_bytes']} bytes; the workspace cap it "
        f"enforces two lines later is {MAX_FILE_SIZE}. Asking for more than you will accept "
        "is the residency gap this threat names."
    )


# ── 2 · the cap REACHES THE TRANSPORT, which is the only place it bounds residency ────────
@pytest.mark.asyncio
async def test_drive_read_file_hands_the_callers_cap_to_the_transport(monkeypatch):
    from app.services.sources.adapters import google_drive as gd

    calls: list[dict] = []

    async def _fake_send(capability, method, url, **kwargs):
        calls.append({"capability": capability, "url": url, **kwargs})
        if "/files/file-1" in url and kwargs.get("params", {}).get("alt") != "media":
            body = b'{"id": "file-1", "name": "q4.docx", "mimeType": "application/octet-stream", "size": "12"}'
            return SimpleNamespace(status_code=200, body=body, headers={})
        return SimpleNamespace(status_code=200, body=b"payload", headers={})

    monkeypatch.setattr(gd, "send_pinned_http", _fake_send)
    monkeypatch.setattr(
        gd.GoogleDriveSourceAdapter, "_get_auth_token", AsyncMock(return_value="tok")
    )

    adapter = gd.GoogleDriveSourceAdapter()
    await adapter.read_file({"service_id": "google"}, "file-1", max_bytes=1_000_000)

    download = [c for c in calls if c.get("params", {}).get("alt") == "media"]
    assert download, "no content download was issued"
    assert download[0]["max_bytes"] == 1_000_000, (
        f"the Drive download ran under a {download[0]['max_bytes']}-byte cap, not the "
        "1,000,000 the caller asked for. A cap the transport never sees bounds nothing."
    )


# ── 3 · a caller may only TIGHTEN the operator's ceiling — never raise it ─────────────────
@pytest.mark.asyncio
async def test_a_caller_can_only_tighten_the_operator_ceiling(monkeypatch):
    from app.services.sources.adapters import google_drive as gd

    calls: list[dict] = []

    async def _fake_send(capability, method, url, **kwargs):
        calls.append({"url": url, **kwargs})
        if kwargs.get("params", {}).get("alt") != "media":
            return SimpleNamespace(
                status_code=200,
                body=b'{"id": "file-1", "name": "q4.docx", "mimeType": "application/octet-stream"}',
                headers={},
            )
        return SimpleNamespace(status_code=200, body=b"payload", headers={})

    monkeypatch.setattr(gd, "send_pinned_http", _fake_send)
    monkeypatch.setattr(gd, "source_max_file_bytes", lambda: 25 * 1024 * 1024)
    monkeypatch.setattr(
        gd.GoogleDriveSourceAdapter, "_get_auth_token", AsyncMock(return_value="tok")
    )

    adapter = gd.GoogleDriveSourceAdapter()
    await adapter.read_file({"service_id": "google"}, "file-1", max_bytes=500 * 1024 * 1024)

    download = [c for c in calls if c.get("params", {}).get("alt") == "media"]
    assert download[0]["max_bytes"] == 25 * 1024 * 1024, (
        "a caller asking for 500 MB was GIVEN 500 MB. The parameter must be able to tighten "
        "the operator's ceiling and never to raise it, or it is a bypass wearing a cap's name."
    )


# ── 4 · the same property on the SECOND first-party family ────────────────────────────────
@pytest.mark.asyncio
async def test_graph_read_file_hands_the_callers_cap_to_the_transport(monkeypatch):
    from app.services.sources.adapters import microsoft_graph as mg

    calls: list[dict] = []

    async def _fake_send(capability, method, url, **kwargs):
        calls.append({"capability": capability, "url": url, **kwargs})
        if capability == "graph_read":
            body = (
                b'{"id": "item-1", "name": "q4.docx", '
                b'"file": {"mimeType": "application/octet-stream"}, '
                b'"@microsoft.graph.downloadUrl": "https://example.sharepoint.com/dl"}'
            )
            return SimpleNamespace(status_code=200, body=body, headers={})
        return SimpleNamespace(status_code=200, body=b"payload", headers={})

    monkeypatch.setattr(mg, "send_pinned_http", _fake_send)
    monkeypatch.setattr(mg, "get_fresh_access_token", AsyncMock(return_value="tok"))

    adapter = mg.MicrosoftGraphSourceAdapter()
    await adapter.read_file({"service_id": "onedrive"}, "item-1", max_bytes=1_000_000)

    download = [c for c in calls if c["capability"] == "graph_download"]
    assert download, "no content download was issued"
    assert download[0]["max_bytes"] == 1_000_000, (
        f"the Graph download ran under a {download[0]['max_bytes']}-byte cap, not the "
        "1,000,000 the caller asked for."
    )


# ── 5 · an over-cap cloud file is a 422 about SIZE, never a 502 about the provider ────────
@pytest.mark.asyncio
async def test_an_over_cap_cloud_file_is_a_422_not_a_provider_502(monkeypatch, stubbed):
    """⛔ THE ERROR SHAPE IS PART OF THE MITIGATION.

    `T-244-06-04` closed on the rule that *"a control that failed to stop something must not
    read as the provider's fault"*. A refusal WE issued, surfaced as `502 Failed to download
    cloud file`, tells the person their Drive is broken when their file is simply too big.
    """

    async def _too_large(connection, file_id, **kwargs):
        raise EgressResponseTooLarge("response declares 40000000 bytes, over the cap")

    monkeypatch.setattr("app.services.sources.import_service.fetch_cloud_file", _too_large)

    with pytest.raises(HTTPException) as exc:
        await _call_route()

    assert exc.value.status_code == 422, (
        f"an over-cap file answered HTTP {exc.value.status_code}. Our own size refusal must "
        "not be dressed as a provider failure."
    )
    assert "too large" in str(exc.value.detail).lower()
