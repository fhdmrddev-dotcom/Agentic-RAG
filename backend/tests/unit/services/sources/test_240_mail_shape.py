"""Phase 240 (SRC-05 / D-240-01 · D-240-02 · D-240-03 · D-240-12 · D-240-13 · D-240-14) —
a mailbox browsed, listed and read through the adapter that already owns the connection.

⚠ **PHASE 238 NAMED THIS FILE'S WEAKNESS BEFORE IT WAS WRITTEN**: *"the fake is mine, so it
agrees with my adapter by construction."* Two things are done about that here, and neither is
a promise:

  1. **Every canned payload is built from field names quoted verbatim from Google's published
     reference** — `id`, `threadId`, `labelIds`, `internalDate`, `sizeEstimate`, `raw`,
     `nextPageToken`. If the adapter reads a field Google does not send, the fake will not have
     it and the test fails.
  2. **The REQUEST is asserted, not only the response.** A fake that returns what the adapter
     wants proves nothing; a fake that records the URL, the query parameters and the egress
     capability proves the adapter asked the right question of the right host under the right key.

⭐ `test_read_message_lands_on_the_shipped_parser` is the case this file exists for. It does not
stop at "bytes came back" — it hands the decoded bytes to `parse_eml_bytes`, the SAME function a
hand-uploaded `.eml` lands on, and reads the subject back out. **One parser, two doors** is the
whole shape claim, and this is where it is either true or not.
"""

from __future__ import annotations

import json as jsonlib
from email.message import EmailMessage
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.security.egress import PinnedResponse
from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter
from app.services.sources.base import SourceConnectionDisabled, SourceRegistry

CONN = {"id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "service_id": "google", "is_enabled": True}


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

    def params(self, index: int) -> dict:
        return self.calls[index][3].get("params") or {}


def _eml_bytes(subject: str = "Quarterly numbers", body: str = "The figure is 41.") -> bytes:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "sender@example.com"
    msg["To"] = "recipient@example.com"
    msg["Message-ID"] = "<root-1@example.com>"
    msg["Date"] = "Mon, 07 Sep 2026 09:00:00 +0000"
    msg.set_content(body)
    return msg.as_bytes()


def _b64url_no_padding(raw: bytes) -> str:
    """Gmail returns base64url and STRIPS the padding — the decoder must restore it."""
    import base64

    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


@pytest.fixture
def adapter(monkeypatch: pytest.MonkeyPatch) -> GoogleDriveSourceAdapter:
    monkeypatch.setattr(
        "app.services.sources.adapters.google_drive.get_fresh_access_token",
        AsyncMock(return_value="mock_google_token"),
    )
    return GoogleDriveSourceAdapter()


def _install(monkeypatch: pytest.MonkeyPatch, handler) -> _Recorder:
    """Patch egress in BOTH modules — the Drive half and the mail half call it separately."""
    rec = _Recorder(handler)
    monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", rec)
    monkeypatch.setattr("app.services.sources.mail.gmail.send_pinned_http", rec)
    return rec


def _refuse(capability, method, url, kwargs):  # pragma: no cover - only fires on a defect
    raise AssertionError(f"unexpected network call: {method} {url}")


# ── the virtual root ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_browse_root_offers_mail_beside_drive_and_touches_no_network(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Mail is a THIRD virtual root, returned before any network call (D-240-01).

    The no-network half matters: the roots are what a person sees the instant they open the
    picker, and a root list that costs a round trip to Gmail is a root list that fails when the
    mail scope was never granted.
    """
    rec = _install(monkeypatch, _refuse)

    page = await adapter.browse(CONN, folder_id=None)

    ids = [n.id for n in page.items]
    assert ids == ["my_drive", "shared_drives", "mailbox_root"]
    assert [n.name for n in page.items][2] == "Mail"
    assert rec.calls == [], "the virtual roots must not cost a network call"


@pytest.mark.asyncio
async def test_browse_mail_root_lists_labels_as_folders(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    def handler(capability, method, url, kwargs):
        assert url.endswith("/labels"), url
        return _json(
            {
                "labels": [
                    {"id": "INBOX", "name": "INBOX", "type": "system"},
                    {"id": "Label_9", "name": "Suppliers", "type": "user"},
                ]
            }
        )

    rec = _install(monkeypatch, handler)
    page = await adapter.browse(CONN, folder_id="mailbox_root")

    assert [n.id for n in page.items] == ["mailbox:INBOX", "mailbox:Label_9"]
    assert [n.name for n in page.items] == ["INBOX", "Suppliers"]
    assert all(n.kind == "folder" for n in page.items)
    assert rec.capabilities == ["gmail_read"]


# ── listing ────────────────────────────────────────────────────────────────────────────────


def _listing_handler(messages: list[dict], meta: dict[str, dict], next_token: str | None = None):
    def handler(capability, method, url, kwargs):
        if url.endswith("/messages"):
            payload: dict[str, Any] = {"messages": messages, "resultSizeEstimate": len(messages)}
            if next_token:
                payload["nextPageToken"] = next_token
            return _json(payload)
        msg_id = url.rsplit("/", 1)[-1]
        return _json(meta[msg_id])

    return handler


@pytest.mark.asyncio
async def test_list_files_maps_messages_to_source_files(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A message becomes a `SourceFile` the generic watch loop already knows how to ingest."""
    meta = {
        "m1": {
            "id": "m1",
            "threadId": "t1",
            "labelIds": ["INBOX"],
            "internalDate": "1757239200000",
            "sizeEstimate": 4821,
            "payload": {"headers": [{"name": "Subject", "value": "Quarterly numbers"}]},
        }
    }
    rec = _install(monkeypatch, _listing_handler([{"id": "m1", "threadId": "t1"}], meta))

    page = await adapter.list_files(CONN, folder_id="mailbox:INBOX")

    assert len(page.files) == 1
    f = page.files[0]
    assert f.id == "mailmsg:m1"
    assert f.name == "Quarterly numbers.eml"
    assert f.mime_type == "message/rfc822"
    assert f.size == 4821
    assert f.modified_at == "1757239200000"
    assert f.path == "/INBOX"
    # The listing call asked for INBOX and for the METADATA format on the follow-up (D-240-12).
    assert rec.params(0).get("labelIds") == "INBOX"
    assert rec.params(1).get("format") == "metadata"
    assert set(rec.capabilities) == {"gmail_read"}


@pytest.mark.asyncio
async def test_list_files_uses_the_mail_page_size_of_25(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D-240-12 — listing is N+1, so mail pages smaller than Drive does. Stated, not incidental."""
    rec = _install(monkeypatch, _listing_handler([], {}))
    await adapter.list_files(CONN, folder_id="mailbox:INBOX")
    assert rec.params(0).get("maxResults") == "25"


@pytest.mark.asyncio
async def test_list_files_carries_the_page_token_through(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """H-5 depends on exhausting pagination — a dropped token makes a listing silently partial."""
    meta = {
        "m1": {
            "id": "m1",
            "internalDate": "1757239200000",
            "sizeEstimate": 10,
            "payload": {"headers": [{"name": "Subject", "value": "One"}]},
        }
    }
    _install(monkeypatch, _listing_handler([{"id": "m1"}], meta, next_token="PAGE2"))
    page = await adapter.list_files(CONN, folder_id="mailbox:INBOX")
    assert page.next_page_token == "PAGE2"


@pytest.mark.asyncio
async def test_an_empty_subject_never_becomes_an_empty_name(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    meta = {
        "m1": {
            "id": "m1",
            "internalDate": "1757239200000",
            "sizeEstimate": 10,
            "payload": {"headers": []},
        }
    }
    _install(monkeypatch, _listing_handler([{"id": "m1"}], meta))
    page = await adapter.list_files(CONN, folder_id="mailbox:INBOX")
    assert page.files[0].name == "(no subject).eml"


@pytest.mark.asyncio
async def test_a_hostile_subject_is_sanitised(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """TM-240-02 — a Subject is text a stranger chose.

    ⚠ This Library has already paid for treating one as safe: a NUL byte inside a `.msg` subject
    produced a Postgres `22P05` during v3.7 UAT that 5,438 green tests had missed.
    """
    hostile = "../../etc/passwd\x00\nDROP TABLE documents"
    meta = {
        "m1": {
            "id": "m1",
            "internalDate": "1757239200000",
            "sizeEstimate": 10,
            "payload": {"headers": [{"name": "Subject", "value": hostile}]},
        }
    }
    _install(monkeypatch, _listing_handler([{"id": "m1"}], meta))
    page = await adapter.list_files(CONN, folder_id="mailbox:INBOX")

    name = page.files[0].name
    assert "\x00" not in name
    assert "\n" not in name
    assert "/" not in name
    assert ".." not in name
    assert name.endswith(".eml")


# ── reading ────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_message_lands_on_the_shipped_parser(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """⭐ ONE PARSER, TWO DOORS — the shape claim, asserted end to end.

    Google: `raw` is *"the entire email message in an RFC 2822 formatted and base64url encoded
    string"*. So the bytes a mailbox yields are the same bytes a `.eml` upload yields, and they
    must land on the same `parse_eml_bytes`.
    """
    from app.services.email_extraction_service import parse_eml_bytes

    raw = _eml_bytes()

    def handler(capability, method, url, kwargs):
        assert kwargs.get("params", {}).get("format") == "raw"
        return _json({"id": "m1", "threadId": "t1", "raw": _b64url_no_padding(raw)})

    rec = _install(monkeypatch, handler)
    filename, content, mime = await adapter.read_file(CONN, "mailmsg:m1")

    assert mime == "message/rfc822"
    assert filename.endswith(".eml")
    assert content == raw
    parsed = parse_eml_bytes(content)
    assert parsed.subject == "Quarterly numbers"
    assert parsed.message_id == "<root-1@example.com>"
    assert rec.capabilities == ["gmail_read"]


@pytest.mark.asyncio
async def test_read_message_refuses_over_the_operator_ceiling(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """TM-240-03 — bounded by the ONE operator setting, never a private module constant.

    SEED-258 removed three private copies of this ceiling that agreed only by coincidence of
    careful authorship, while a fourth disagreed in production. Reintroducing one here is the
    defect, not the convenience.
    """
    from app.models.user_settings import source_max_file_bytes

    monkeypatch.setattr(
        "app.services.sources.mail.gmail.source_max_file_bytes", lambda: 64, raising=False
    )
    oversized = b"x" * 4096

    def handler(capability, method, url, kwargs):
        return _json({"id": "m1", "raw": _b64url_no_padding(oversized)})

    _install(monkeypatch, handler)
    with pytest.raises(ValueError) as exc:
        await adapter.read_file(CONN, "mailmsg:m1")
    assert "64" in str(exc.value) or "ceiling" in str(exc.value).lower()
    assert source_max_file_bytes() > 0  # the real setting is still the one production reads


# ── negative controls ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_drive_folder_still_takes_the_drive_path(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The delegation must not swallow Drive. Without this, "mail works" could mean "only mail"."""

    def handler(capability, method, url, kwargs):
        assert "gmail" not in url, f"a Drive listing reached Gmail: {url}"
        return _json({"files": []})

    rec = _install(monkeypatch, handler)
    await adapter.list_files(CONN, folder_id="0ABCdef_real_drive_folder")
    assert rec.capabilities == ["drive_read"], "a Drive read must keep its own egress key"


@pytest.mark.asyncio
async def test_no_mail_call_carries_the_drive_egress_key(
    adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
) -> None:
    """TM-240-01 — the key is what an audit greps.

    `egress.py` keeps `gmail_read` and `drive_read` separate even though both resolve to
    googleapis.com, precisely so a Drive tool cannot reach Gmail and vice versa. A shared key
    would have destroyed that the moment a second scope was added.
    """
    rec = _install(monkeypatch, _listing_handler([], {}))
    await adapter.list_files(CONN, folder_id="mailbox:INBOX")
    assert "drive_read" not in rec.capabilities


def test_a_disabled_connection_refuses_before_any_mail_call() -> None:
    """TM-240-05 — mail INHERITS BUG-260907-03's refusal instead of re-implementing it.

    This is `D-240-01`'s second dividend: because mail rides the connection's own adapter, the
    one place a disabled connection is refused already covers it.
    """
    with pytest.raises(SourceConnectionDisabled):
        SourceRegistry.get_adapter({"service_id": "google", "is_enabled": False})
