"""Phase 238 (SRC-03 / D-238-01 · D-238-02 · D-238-03 · D-238-05 · D-238-06 · D-238-07) —
the Microsoft Graph OneDrive adapter, driven.

⭐ THE CASE THIS FILE EXISTS FOR is `test_read_file_is_a_two_step_and_never_touches_content`.
Graph's `/content` answers **302** to a different host and `egress.send_pinned_http` refuses
redirects BY DESIGN. The remedy is `@microsoft.graph.downloadUrl` plus a second pinned call
under its own key — and the whole point of Phase 238 is that this stays *inside the adapter*.
If someone later "fixes" the two-step by teaching the shared binder to follow a redirect, the
`/content` fence below is what says no.
"""

from __future__ import annotations

import json as jsonlib
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.security.egress import EgressRefused, PinnedResponse
from app.services.sources.adapters.microsoft_graph import MicrosoftGraphSourceAdapter
from app.services.sources.base import SourceRegistry

CONN = {"id": "11111111-2222-3333-4444-555555555555", "service_id": "microsoft"}

DOWNLOAD_URL = "https://b0mpua-by3301.files.1drv.com/y23vmagahszhxzlcvhasdhasghasodfi"


def _json(payload: dict[str, Any], status: int = 200) -> PinnedResponse:
    return PinnedResponse(
        status_code=status,
        headers={"content-type": "application/json"},
        body=jsonlib.dumps(payload).encode("utf-8"),
    )


class _Recorder:
    """Records every (capability, method, url, kwargs) the adapter asks egress for."""

    def __init__(self, handler):
        self.calls: list[tuple[str, str, str, dict]] = []
        self._handler = handler

    async def __call__(self, capability: str, method: str, url: str, **kwargs):
        self.calls.append((capability, method, url, kwargs))
        return self._handler(capability, method, url, kwargs)

    @property
    def urls(self) -> list[str]:
        return [c[2] for c in self.calls]

    @property
    def capabilities(self) -> list[str]:
        return [c[0] for c in self.calls]


@pytest.fixture
def adapter(monkeypatch: pytest.MonkeyPatch) -> MicrosoftGraphSourceAdapter:
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.get_fresh_access_token",
        AsyncMock(return_value="mock_graph_token"),
    )
    return MicrosoftGraphSourceAdapter()


def _install(monkeypatch: pytest.MonkeyPatch, handler) -> _Recorder:
    rec = _Recorder(handler)
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.send_pinned_http", rec
    )
    return rec


# ── registration ─────────────────────────────────────────────────────────────────────────


def test_the_adapter_is_registered_as_data_not_resolved_by_a_branch():
    """SC#4: adding a family is registration. `microsoft` must resolve through the registry's
    ordinary key lookup — not through a substring branch someone added to base.py."""
    resolved = SourceRegistry.get_adapter({"service_id": "microsoft"})
    assert isinstance(resolved, MicrosoftGraphSourceAdapter)
    assert "microsoft" in SourceRegistry.list_supported_services()


# ── browse ───────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_virtual_root_is_one_node_and_costs_no_http(adapter, monkeypatch):
    rec = _install(monkeypatch, lambda *a: pytest.fail("virtual root must not call Graph"))
    page = await adapter.browse(CONN, folder_id=None)
    assert [n.id for n in page.items] == ["onedrive"]
    assert page.items[0].name == "OneDrive"
    assert page.next_page_token is None
    assert rec.calls == []


@pytest.mark.asyncio
async def test_browse_lists_only_folder_facets_under_graph_read(adapter, monkeypatch):
    def handler(capability, method, url, kwargs):
        assert capability == "graph_read"
        assert "/me/drive/root/children" in url
        return _json({
            "value": [
                {"id": "F1", "name": "Finance", "folder": {"childCount": 3},
                 "parentReference": {"path": "/drive/root:"}},
                {"id": "D1", "name": "notes.txt", "file": {"mimeType": "text/plain"},
                 "parentReference": {"path": "/drive/root:"}},
            ]
        })

    rec = _install(monkeypatch, handler)
    page = await adapter.browse(CONN, folder_id="onedrive")
    assert [n.id for n in page.items] == ["F1"]
    assert page.items[0].kind == "folder"
    assert rec.capabilities == ["graph_read"]


@pytest.mark.asyncio
async def test_nextlink_is_carried_verbatim_and_reissued_as_the_url(adapter, monkeypatch):
    """D-238-05 — Graph's cursor is a full URL and Drive's is an opaque token. The CONTRACT
    does not change: `next_page_token` carries the URL and the adapter re-issues *that*."""
    next_link = "https://graph.microsoft.com/v1.0/me/drive/items/F1/children?$skiptoken=ABC123"

    def handler(capability, method, url, kwargs):
        if "$skiptoken" in url:
            return _json({"value": [{"id": "F3", "name": "Second", "folder": {}}]})
        return _json({
            "value": [{"id": "F2", "name": "First", "folder": {}}],
            "@odata.nextLink": next_link,
        })

    rec = _install(monkeypatch, handler)
    first = await adapter.browse(CONN, folder_id="F1")
    assert first.next_page_token == next_link

    second = await adapter.browse(CONN, folder_id="F1", page_token=first.next_page_token)
    assert rec.urls[1] == next_link, "the nextLink must be re-issued byte-identically"
    assert [n.id for n in second.items] == ["F3"]
    assert second.next_page_token is None


# ── list_files ───────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_files_maps_the_facets_and_uses_lastmodified_as_the_version(adapter, monkeypatch):
    """D-238-03 — nothing in this product reads a hash. `modified_at` IS the version key at
    every comparison site, so `lastModifiedDateTime` is the field that has to land."""
    def handler(capability, method, url, kwargs):
        return _json({
            "value": [
                {
                    "id": "ITEM1",
                    "name": "Q3 Rates.pdf",
                    "size": 4096,
                    "lastModifiedDateTime": "2026-09-01T09:30:00Z",
                    "webUrl": "https://onedrive.live.com/redir?resid=ITEM1",
                    "file": {"mimeType": "application/pdf"},
                    "parentReference": {"path": "/drive/root:/Documents/Finance"},
                },
                {"id": "FOLD", "name": "Archive", "folder": {"childCount": 0}},
            ]
        })

    _install(monkeypatch, handler)
    page = await adapter.list_files(CONN, folder_id="F1")
    assert [f.id for f in page.files] == ["ITEM1"], "folder facets are not files"
    f = page.files[0]
    assert f.name == "Q3 Rates.pdf"
    assert f.mime_type == "application/pdf"
    assert f.size == 4096
    assert f.modified_at == "2026-09-01T09:30:00Z"
    assert f.web_view_url == "https://onedrive.live.com/redir?resid=ITEM1"


@pytest.mark.asyncio
async def test_path_is_a_real_folder_path_not_a_filename(adapter, monkeypatch):
    """SEED-253 — the seed's whole complaint is that `path` was fabricated as `/<filename>`,
    so a folder-shaped rule matched the filename and a dead rule looked live. Graph returns
    `parentReference.path` free, in the same payload."""
    def handler(capability, method, url, kwargs):
        return _json({
            "value": [{
                "id": "ITEM1", "name": "Q3 Rates.pdf", "size": 1,
                "lastModifiedDateTime": "2026-09-01T09:30:00Z",
                "file": {"mimeType": "application/pdf"},
                "parentReference": {"path": "/drive/root:/Documents/Finance"},
            }]
        })

    _install(monkeypatch, handler)
    page = await adapter.list_files(CONN, folder_id="F1")
    assert page.files[0].path == "/Documents/Finance/Q3 Rates.pdf"
    assert "/Finance/" in (page.files[0].path or ""), "the rule that motivated SEED-253"


@pytest.mark.asyncio
async def test_path_at_the_drive_root_has_no_fabricated_folder(adapter, monkeypatch):
    def handler(capability, method, url, kwargs):
        return _json({
            "value": [{
                "id": "ITEM1", "name": "top.pdf", "size": 1,
                "lastModifiedDateTime": "2026-09-01T09:30:00Z",
                "file": {"mimeType": "application/pdf"},
                "parentReference": {"path": "/drive/root:"},
            }]
        })

    _install(monkeypatch, handler)
    page = await adapter.list_files(CONN, folder_id="onedrive")
    assert page.files[0].path == "/top.pdf"


# ── read_file — THE 302 DANCE ────────────────────────────────────────────────────────────


def _download_handler(capability, method, url, kwargs):
    if url == DOWNLOAD_URL:
        return PinnedResponse(
            status_code=200,
            headers={"content-type": "application/pdf"},
            body=b"%PDF-1.7 real bytes",
        )
    return _json({
        "id": "ITEM1",
        "name": "Q3 Rates.pdf",
        "size": 19,
        "file": {"mimeType": "application/pdf"},
        "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
    })


@pytest.mark.asyncio
async def test_read_file_is_a_two_step_and_never_touches_content(adapter, monkeypatch):
    """D-238-01 — two calls, two capabilities, in that order, and `/content` is never asked
    for. The last assertion is a FENCE, not a tautology: it is what fails if a future change
    "simplifies" this back into a single redirect-following request."""
    rec = _install(monkeypatch, _download_handler)

    filename, content, mime = await adapter.read_file(CONN, "ITEM1")

    assert (filename, content, mime) == ("Q3 Rates.pdf", b"%PDF-1.7 real bytes", "application/pdf")
    assert rec.capabilities == ["graph_read", "graph_download"]
    assert len(rec.calls) == 2
    assert not any(u.endswith("/content") for u in rec.urls), (
        "/content answers 302 and send_pinned_http refuses redirects by design"
    )
    assert rec.urls[1] == DOWNLOAD_URL


@pytest.mark.asyncio
async def test_the_metadata_call_selects_the_download_url(adapter, monkeypatch):
    rec = _install(monkeypatch, _download_handler)
    await adapter.read_file(CONN, "ITEM1")
    select = (rec.calls[0][3].get("params") or {}).get("$select", "")
    assert "@microsoft.graph.downloadUrl" in select


@pytest.mark.asyncio
async def test_the_download_call_carries_no_authorization_header(adapter, monkeypatch):
    """Microsoft: *"You don't need to include an Authorization header when you access the
    download URL."* Sending one anyway would put our OAuth token on a host that is only
    suffix-pinned — the one call in this adapter where that matters most."""
    rec = _install(monkeypatch, _download_handler)
    await adapter.read_file(CONN, "ITEM1")

    meta_headers = rec.calls[0][3].get("headers") or {}
    dl_headers = rec.calls[1][3].get("headers") or {}
    assert "Authorization" in meta_headers
    assert not any(k.lower() == "authorization" for k in dl_headers)


@pytest.mark.asyncio
async def test_a_download_url_on_an_unexpected_host_is_refused_not_swallowed(adapter, monkeypatch):
    """D-238-02 — the download URL is SERVER-SUPPLIED, so the suffix pin is its only fence.
    The adapter must let the refusal out rather than turning it into an empty file."""
    def handler(capability, method, url, kwargs):
        if capability == "graph_download":
            raise EgressRefused(capability=capability, host="evil.example.com",
                                reason_code="host_not_allowed")
        return _json({
            "id": "ITEM1", "name": "x.pdf", "file": {"mimeType": "application/pdf"},
            "@microsoft.graph.downloadUrl": "https://evil.example.com/x",
        })

    _install(monkeypatch, handler)
    with pytest.raises(EgressRefused):
        await adapter.read_file(CONN, "ITEM1")


@pytest.mark.asyncio
async def test_a_missing_download_url_is_a_named_failure(adapter, monkeypatch):
    _install(monkeypatch, lambda c, m, u, k: _json({"id": "ITEM1", "name": "x.pdf",
                                                    "file": {"mimeType": "application/pdf"}}))
    with pytest.raises(ValueError, match="download"):
        await adapter.read_file(CONN, "ITEM1")


# ── error honesty ────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_errors_report_the_enum_and_never_the_body(adapter, monkeypatch):
    """Mirrors `_google_error_reason`: an error body echoes user-supplied text, so only
    machine-readable codes may reach a log line or a message."""
    secret = "confidential merger q3"

    def handler(capability, method, url, kwargs):
        return _json({"error": {"code": "itemNotFound",
                                "message": f"No item matches '{secret}'"}}, status=404)

    _install(monkeypatch, handler)
    with pytest.raises(ValueError) as exc:
        await adapter.list_files(CONN, folder_id="F1")
    assert "itemNotFound" in str(exc.value)
    assert secret not in str(exc.value)


# ── check ────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_check_reports_the_account(adapter, monkeypatch):
    _install(monkeypatch, lambda c, m, u, k: _json({
        "id": "drive-1",
        "owner": {"user": {"displayName": "Ada L", "email": "ada@example.com"}},
    }))
    health = await adapter.check(CONN)
    assert health.ok is True
    assert health.details["display_name"] == "Ada L"
    assert health.details["email"] == "ada@example.com"


@pytest.mark.asyncio
async def test_check_returns_not_ok_rather_than_raising(adapter, monkeypatch):
    _install(monkeypatch, lambda c, m, u, k: _json({"error": {"code": "invalidAuthenticationToken"}},
                                                   status=401))
    health = await adapter.check(CONN)
    assert health.ok is False
    assert "invalidAuthenticationToken" in (health.error or "")
