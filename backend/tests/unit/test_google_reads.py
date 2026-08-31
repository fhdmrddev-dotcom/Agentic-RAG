"""2026-08-31 — Gmail on the SAME Google connection Drive uses (BUS-037 §B).

⚠ THE ONE THING THESE CASES EXIST TO STOP is the failure measured on Drive the same
morning: given only `HTTP 403`, a real model call told the operator to re-consent scopes
that were already granted and correct. A read that cannot happen must say WHY, in a
sentence a person can act on — and for Gmail the overwhelmingly likely why, on day one,
is that the connection was authorised before `gmail.readonly` was added to the authorize
request. A token carries the scopes granted at consent time and does not widen itself.

⚠ THE SEPARATE EGRESS KEY IS A CLAIM, SO IT IS ASSERTED. `gmail_read` and `drive_read`
both resolve to googleapis.com, so the key buys no HOST separation — what it buys is that
a spec DECLARES one key, and therefore a Drive tool cannot reach Gmail and vice versa.
That property is only real if the specs actually say so.
"""
from __future__ import annotations

import base64
import json

import pytest

from app.services.google import gmail as gmail_read
from app.services.google import _http
from app.services.google._http import GoogleReadError as GmailReadError, error_reason as _error_reason
from app.services.google.gmail import _header, _plain_text


# ══════════════════════════════════════════════════════════════════════════════════════
# The refusal names the cause — the whole point of the module
# ══════════════════════════════════════════════════════════════════════════════════════
class _Resp:
    def __init__(self, status_code: int, body: bytes):
        self.status_code = status_code
        self.body = body


@pytest.mark.asyncio
async def test_an_insufficient_scope_403_tells_the_person_to_RECONNECT(monkeypatch):
    body = json.dumps({
        "error": {
            "code": 403,
            "message": "Request had insufficient authentication scopes.",
            "errors": [{"reason": "insufficientPermissions", "domain": "global"}],
            "status": "PERMISSION_DENIED",
        }
    }).encode()

    async def _fake_send(*_a, **_k):
        return _Resp(403, body)

    monkeypatch.setattr(_http, "send_pinned_http", _fake_send)
    monkeypatch.setattr(_http, "get_fresh_access_token", _token_ok)

    with pytest.raises(GmailReadError) as exc:
        await gmail_read.search_email("c-1", limit=3)
    msg = str(exc.value)
    assert "insufficientPermissions" in msg
    assert "PERMISSION_DENIED" in msg
    # ⭐ The actionable half. Without it this is the Drive defect again.
    assert "reconnect it once" in msg
    # ⛔ And the vendor's prose must NOT be in it — see the projection test below.
    assert "insufficient authentication scopes" not in msg


@pytest.mark.asyncio
async def test_a_connection_with_no_token_says_so_rather_than_calling_out(monkeypatch):
    async def _no_token(_cid):
        return None

    async def _must_not_send(*_a, **_k):
        raise AssertionError("no request may be sent without a token")

    monkeypatch.setattr(_http, "get_fresh_access_token", _no_token)
    monkeypatch.setattr(_http, "send_pinned_http", _must_not_send)

    with pytest.raises(GmailReadError, match="no valid OAuth token"):
        await gmail_read.read_email("c-1", "m-1")


async def _token_ok(_cid):
    return "ya29.fake"


@pytest.mark.asyncio
async def test_read_email_needs_an_id_and_sends_nothing_without_one(monkeypatch):
    async def _must_not_send(*_a, **_k):
        raise AssertionError("no request may be sent without a message id")

    monkeypatch.setattr(_http, "send_pinned_http", _must_not_send)
    monkeypatch.setattr(_http, "get_fresh_access_token", _token_ok)
    with pytest.raises(GmailReadError, match="needs a message id"):
        await gmail_read.read_email("c-1", "   ")


# ══════════════════════════════════════════════════════════════════════════════════════
# The enum half travels; the message half — which echoes the person's query — never does
# ══════════════════════════════════════════════════════════════════════════════════════
def test_error_reason_carries_enums_and_never_the_searched_text():
    body = json.dumps({
        "error": {
            # A Gmail error body echoes `q`, which is what the person searched their OWN
            # mail for. Planted with something nobody would want in a log.
            "message": "the query 'from:hr subject:SEVERANCE' was refused",
            "errors": [{"reason": "insufficientPermissions",
                        "message": "the query 'from:hr subject:SEVERANCE' failed"}],
            "status": "PERMISSION_DENIED",
        }
    }).encode()
    out = _error_reason(body)
    assert out == " (PERMISSION_DENIED / insufficientPermissions)"
    assert "SEVERANCE" not in out
    assert "query" not in out


def test_error_reason_never_raises_and_drops_non_enum_tokens():
    for junk in (None, b"", b"not json", b"[]", b'{"error":"a string"}', b'{"error":{}}'):
        assert _error_reason(junk) == ""
    spaced = json.dumps({"error": {"status": "DENIED because of 'my query'",
                                   "errors": [{"reason": "has spaces"}]}}).encode()
    assert _error_reason(spaced) == ""


# ══════════════════════════════════════════════════════════════════════════════════════
# Body handling — plain text or an honest absence, never markup
# ══════════════════════════════════════════════════════════════════════════════════════
def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


def test_plain_text_is_found_nested_and_html_is_never_returned():
    payload = {
        "mimeType": "multipart/alternative",
        "parts": [
            {"mimeType": "text/html", "body": {"data": _b64("<b>MARKUP</b>")}},
            {
                "mimeType": "multipart/related",
                "parts": [{"mimeType": "text/plain", "body": {"data": _b64("the real body")}}],
            },
        ],
    }
    out = _plain_text(payload)
    assert out == "the real body"
    assert "MARKUP" not in out


def test_an_html_only_message_yields_no_text_rather_than_markup():
    payload = {"mimeType": "text/html", "body": {"data": _b64("<p>only html</p>")}}
    assert _plain_text(payload) == ""


def test_headers_are_matched_case_insensitively():
    payload = {"headers": [{"name": "subject", "value": "Q3 numbers"},
                           {"name": "FROM", "value": "a@b.c"}]}
    assert _header(payload, "Subject") == "Q3 numbers"
    assert _header(payload, "From") == "a@b.c"
    assert _header(payload, "Bcc") == ""


@pytest.mark.asyncio
async def test_read_email_reports_an_html_only_body_as_a_NOTE_not_an_empty_string(monkeypatch):
    msg = {
        "threadId": "t-9",
        "snippet": "a snippet",
        "payload": {
            "mimeType": "text/html",
            "body": {"data": _b64("<p>hi</p>")},
            "headers": [{"name": "Subject", "value": "Hello"}],
        },
    }

    async def _fake_send(*_a, **_k):
        return _Resp(200, json.dumps(msg).encode())

    monkeypatch.setattr(_http, "send_pinned_http", _fake_send)
    monkeypatch.setattr(_http, "get_fresh_access_token", _token_ok)

    out = await gmail_read.read_email("c-1", "m-1")
    assert out["subject"] == "Hello"
    assert out["text"] is None
    assert "HTML only" in out["note"]


@pytest.mark.asyncio
async def test_search_email_caps_the_limit_and_projects_the_four_headers(monkeypatch):
    seen: list[dict] = []

    async def _fake_send(_cap, _method, url, *, params=None, **_k):
        seen.append({"url": url, "params": dict(params or {})})
        if url.endswith("/messages"):
            return _Resp(200, json.dumps({"messages": [{"id": "m-1"}]}).encode())
        return _Resp(200, json.dumps({
            "threadId": "t-1",
            "snippet": "snip",
            "labelIds": ["UNREAD", "INBOX"],
            "payload": {"headers": [
                {"name": "Subject", "value": "S"}, {"name": "From", "value": "F"},
                {"name": "To", "value": "T"}, {"name": "Date", "value": "D"},
            ]},
        }).encode())

    monkeypatch.setattr(_http, "send_pinned_http", _fake_send)
    monkeypatch.setattr(_http, "get_fresh_access_token", _token_ok)

    out = await gmail_read.search_email("c-1", query="from:hr", limit=999)
    # 999 is clamped to 25 — the low cap is deliberate: each result costs a second call.
    assert seen[0]["params"]["maxResults"] == "25"
    assert seen[0]["params"]["q"] == "from:hr"
    # ⚠ `metadataHeaders` is NOT sent. Gmail wants it REPEATED, and the binder's params
    # take one value per key — a comma-joined spelling is accepted and matches NO header,
    # which would have returned a listing with every subject blank.
    assert "metadataHeaders" not in seen[1]["params"]
    assert seen[1]["params"]["format"] == "metadata"
    row = out["messages"][0]
    assert (row["subject"], row["from"], row["to"], row["date"]) == ("S", "F", "T", "D")
    assert row["unread"] is True


# ══════════════════════════════════════════════════════════════════════════════════════
# The wiring claims — one connection, two keys, no writes
# ══════════════════════════════════════════════════════════════════════════════════════
def test_gmail_tools_hang_off_the_google_service_not_a_second_one():
    from app.services.connectors.service_tools import SERVICE_TOOL_SPECS

    assert "gmail" not in SERVICE_TOOL_SPECS, (
        "Gmail must not become a second service id — BUS-037 §B is 'one connection, not "
        "many': a second row means a second consent and two places to revoke"
    )
    names = {t["name"] for t in SERVICE_TOOL_SPECS["google"]}
    assert {"search_files", "read_file", "search_email", "read_email"} <= names


def test_drive_and_gmail_declare_DIFFERENT_egress_keys():
    from app.services.connectors.service_tools import spec_for

    assert spec_for("google", "search_files")["capability"] == "drive_read"
    assert spec_for("google", "read_file")["capability"] == "drive_read"
    assert spec_for("google", "search_email")["capability"] == "gmail_read"
    assert spec_for("google", "read_email")["capability"] == "gmail_read"


def test_the_gmail_key_is_WHOLLY_wired_into_the_binder():
    """A key in one table and missing from another is a KeyError at the socket, which is
    no answer rather than a clear no."""
    from app.security.egress import ALLOWED_HOST_SUFFIXES, _HOST_MATCH, _TLS_SCHEMES

    assert ALLOWED_HOST_SUFFIXES["gmail_read"] == ("googleapis.com",)
    assert _HOST_MATCH["gmail_read"] == "suffix"
    assert _TLS_SCHEMES["gmail_read"] == frozenset({"https"})


def test_no_gmail_tool_sends_and_no_send_scope_is_granted():
    """⚠ NARROWED BY PHASE 221 STEP 2 (operator, 2026-09-01) — DELIBERATELY, NOT QUIETLY.

    This asserted `tool["writes"] is False` for EVERY Google tool and forbade
    `gmail.compose`. Both were correct statements of the reads-first decision, and the
    operator lifted that decision after the approval model shipped. A fence whose premise
    has changed must be NARROWED to what is still true — deleting it is how the next
    decision it was protecting gets lost silently.

    ⛔ WHAT STILL HOLDS, and is what this now guards: **nothing sends mail.** `draft_email`
    writes a draft and cannot deliver it, because the token carries `gmail.compose` and
    never `gmail.send`. That is the operator's stated line — SMTP already sends through a
    path approval-gated since Phase 190, and a draft is the one shape of outbound mail a
    person still reads before it leaves.
    """
    from app.services.connectors.service_tools import SERVICE_TOOL_SPECS
    from app.services.oauth_service import OAUTH_PROVIDERS

    gmail_tools = [t for t in SERVICE_TOOL_SPECS["google"] if t.get("app") == "gmail"]
    writes = [t["name"] for t in gmail_tools if t["writes"]]
    assert writes == ["draft_email"], writes

    scopes = OAUTH_PROVIDERS["google"]["default_scopes"]
    assert "https://www.googleapis.com/auth/gmail.readonly" in scopes
    assert "https://www.googleapis.com/auth/gmail.compose" in scopes
    # ⛔ STILL FORBIDDEN. `compose` drafts; `send` delivers; `modify` and `mail.google.com`
    # can do both and more. Only the first is granted.
    for forbidden in ("gmail.send", "gmail.modify", "mail.google.com"):
        assert not any(forbidden in s for s in scopes), f"{forbidden} must not be granted"
