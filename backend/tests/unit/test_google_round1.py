"""Round 1 — Sheets, Docs, Calendar and Contacts reads on the SAME Google connection.

⚠ THE OPERATOR'S QUESTION WAS "WHY ONLY TWO TOOLS", and the honest answer was that two
was never a product decision: Drive's pair is exactly what `cloud_storage` already
implemented for the composer file picker, and Gmail's pair was read-only because the
write-approval gate was unproven. The gate was proven the same day. These eleven are the
surfaces that were missing.

⚠ EVERY CASE HERE GUARDS A WRONG *ANSWER*, NOT A CRASH. The failures this file exists to
prevent all return HTTP 200 and look fine:
  · a recurring meeting read without `singleEvents` comes back once, dated years ago;
  · a free/busy calendar that could not be read looks completely FREE;
  · a Doc whose content sits in a table reads as empty;
  · a disabled API and a missing scope produce the same 403 with two different remedies.
"""
from __future__ import annotations

import json

import pytest

from app.services.google import _http, calendar, docs, people, sheets
from app.services.google._http import GoogleReadError, activation_url, error_reason


class _Resp:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self.body = json.dumps(payload).encode() if not isinstance(payload, bytes) else payload


async def _token_ok(_cid):
    return "ya29.fake"


@pytest.fixture(autouse=True)
def _no_real_token(monkeypatch):
    monkeypatch.setattr(_http, "get_fresh_access_token", _token_ok)


def _serve(monkeypatch, handler):
    """`handler(url, params, json_body) -> _Resp`."""
    async def _send(_cap, method, url, *, params=None, json=None, **_k):
        return handler(url, dict(params or {}), json, method)

    monkeypatch.setattr(_http, "send_pinned_http", _send)


# ══════════════════════════════════════════════════════════════════════════════════════
# The two 403s are told apart — a disabled API and a missing scope
# ══════════════════════════════════════════════════════════════════════════════════════
_DISABLED = {
    "error": {
        "code": 403, "status": "PERMISSION_DENIED",
        "message": "Google Sheets API has not been used in project 877112366454 …",
        "errors": [],
        "details": [{
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            "reason": "SERVICE_DISABLED", "domain": "googleapis.com",
            "metadata": {
                "service": "sheets.googleapis.com",
                "activationUrl": "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=877112366454",
            },
        }],
    }
}
_NO_SCOPE = {
    "error": {
        "code": 403, "status": "PERMISSION_DENIED",
        "message": "Request had insufficient authentication scopes.",
        "details": [{
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            "reason": "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
            "metadata": {"service": "people.googleapis.com"},
        }],
    }
}


def test_the_details_shape_is_read_not_just_the_legacy_errors_array():
    """⚠ THE FIRST CUT READ ONLY `errors[]` AND BOTH BODIES CAME BACK AS BARE
    `PERMISSION_DENIED`. Sheets, Docs and People send an EMPTY `errors` and put everything
    in `details[]`, so two opposite remedies were indistinguishable."""
    assert error_reason(json.dumps(_DISABLED).encode()) == (
        " (PERMISSION_DENIED / SERVICE_DISABLED / sheets.googleapis.com)"
    )
    assert error_reason(json.dumps(_NO_SCOPE).encode()) == (
        " (PERMISSION_DENIED / ACCESS_TOKEN_SCOPE_INSUFFICIENT / people.googleapis.com)"
    )


def test_the_vendor_message_never_travels_even_from_details():
    body = json.dumps({"error": {
        "status": "PERMISSION_DENIED",
        "message": "the query 'SECRET-2026' was refused",
        "details": [{"reason": "SERVICE_DISABLED",
                     "metadata": {"service": "sheets.googleapis.com",
                                  "consumer": "projects/877112366454"},
                     "message": "the query 'SECRET-2026' was refused"}],
    }}).encode()
    out = error_reason(body)
    assert "SECRET-2026" not in out
    assert "query" not in out
    # `consumer` is not on the projection either — only `service`.
    assert "projects/" not in out


def test_activation_url_is_origin_whitelisted_not_sanitised():
    assert activation_url(json.dumps(_DISABLED).encode()).startswith(
        "https://console.developers.google.com/"
    )
    assert activation_url(json.dumps(_NO_SCOPE).encode()) == ""
    for evil in ("https://evil.example/console.developers.google.com/x",
                 "javascript:alert(1)", "http://console.developers.google.com/x", ""):
        body = json.dumps({"error": {"details": [{"metadata": {"activationUrl": evil}}]}})
        assert activation_url(body.encode()) == "", evil


@pytest.mark.asyncio
async def test_a_disabled_api_says_reconnecting_will_NOT_help(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Resp(403, _DISABLED))
    with pytest.raises(GoogleReadError) as exc:
        await sheets.read_sheet("c-1", "s-1", "Sheet1!A1:B2")
    msg = str(exc.value)
    assert "switched OFF" in msg
    assert "reconnecting will not help" in msg
    assert "console.developers.google.com" in msg


@pytest.mark.asyncio
async def test_a_missing_scope_says_RECONNECT_ONCE(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Resp(403, _NO_SCOPE))
    with pytest.raises(GoogleReadError) as exc:
        await people.search_contacts("c-1", "ada")
    msg = str(exc.value)
    assert "reconnect it once" in msg
    assert "switched OFF" not in msg


# ══════════════════════════════════════════════════════════════════════════════════════
# Sheets — cells, not a PDF
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_read_sheet_returns_ragged_rows_and_reports_the_widest(monkeypatch):
    _serve(monkeypatch, lambda url, p, b, m: _Resp(200, {
        "range": "Sheet1!A1:D3", "values": [["a", "b", "c", "d"], ["1", "2"], ["x"]],
    }))
    out = await sheets.read_sheet("c-1", "s-1", "Sheet1!A1:D3")
    assert out["rows"] == [["a", "b", "c", "d"], ["1", "2"], ["x"]]
    assert out["row_count"] == 3
    # ⭐ Rows are NOT padded — padding invents cells the sheet does not contain.
    assert out["columns"] == 4
    assert "ragged" in out["note"]


@pytest.mark.asyncio
async def test_read_sheet_with_no_range_resolves_the_FIRST_TAB_BY_NAME(monkeypatch):
    """⚠ NOT `Sheet1`. Tab names are whatever the author typed, and guessing is wrong the
    moment anyone renamed one — which is also why `list_sheet_tabs` exists."""
    seen: list[str] = []

    def handler(url, params, body, method):
        seen.append(url)
        if url.endswith("/s-1"):
            return _Resp(200, {"properties": {"title": "Budget"},
                               "sheets": [{"properties": {"title": "Q3 actuals",
                                                          "sheetId": 7,
                                                          "gridProperties": {"rowCount": 100,
                                                                             "columnCount": 8}}}]})
        return _Resp(200, {"range": "Q3 actuals!A1:B1", "values": [["x", "y"]]})

    _serve(monkeypatch, handler)
    out = await sheets.read_sheet("c-1", "s-1")
    assert any("Q3 actuals" in u for u in seen), seen
    assert out["rows"] == [["x", "y"]]


@pytest.mark.asyncio
async def test_an_empty_range_says_the_read_SUCCEEDED(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Resp(200, {"range": "A1:B2"}))
    out = await sheets.read_sheet("c-1", "s-1", "A1:B2")
    assert out["rows"] == []
    assert "succeeded" in out["note"]


@pytest.mark.asyncio
async def test_sheets_tools_refuse_an_absent_id_without_calling_out(monkeypatch):
    async def _must_not_send(*_a, **_k):
        raise AssertionError("no request may be sent without a spreadsheet id")

    monkeypatch.setattr(_http, "send_pinned_http", _must_not_send)
    with pytest.raises(GoogleReadError, match="needs a spreadsheet id"):
        await sheets.list_sheet_tabs("c-1", "  ")
    with pytest.raises(GoogleReadError, match="needs a spreadsheet id"):
        await sheets.read_sheet("c-1", "")


# ══════════════════════════════════════════════════════════════════════════════════════
# Docs — text, including text inside tables
# ══════════════════════════════════════════════════════════════════════════════════════
def _para(text: str) -> dict:
    return {"paragraph": {"elements": [{"textRun": {"content": text}}]}}


@pytest.mark.asyncio
async def test_read_doc_walks_TABLES_not_only_paragraphs(monkeypatch):
    """⚠ A DOC WHOSE CONTENT IS IN A TABLE WOULD OTHERWISE READ AS EMPTY — a silent wrong
    answer, which is worse than an error."""
    _serve(monkeypatch, lambda *_a, **_k: _Resp(200, {
        "title": "Rates",
        "body": {"content": [
            _para("Intro\n"),
            {"table": {"tableRows": [
                {"tableCells": [{"content": [_para("Item")]}, {"content": [_para("Price")]}]},
                {"tableCells": [{"content": [_para("Steel")]}, {"content": [_para("12.50")]}]},
            ]}},
        ]},
    }))
    out = await docs.read_doc("c-1", "d-1")
    assert out["title"] == "Rates"
    assert "Intro" in out["text"]
    assert "Item | Price" in out["text"]
    assert "Steel | 12.50" in out["text"]


@pytest.mark.asyncio
async def test_a_doc_with_no_text_runs_says_so_rather_than_returning_empty(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Resp(200, {"title": "Poster", "body": {"content": []}}))
    out = await docs.read_doc("c-1", "d-1")
    assert out["text"] is None
    assert "no text runs" in out["note"]


# ══════════════════════════════════════════════════════════════════════════════════════
# Calendar — the two answers that are dangerous when wrong
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_list_events_expands_recurrence_and_orders_by_start(monkeypatch):
    """⚠ WITHOUT `singleEvents=true` A RECURRING MEETING COMES BACK ONCE, as its defining
    rule, carrying the SERIES' original start date. "What is on my calendar this week"
    then answers with a date from years ago and omits every actual occurrence."""
    seen: dict = {}

    def handler(url, params, body, method):
        seen.update(params)
        return _Resp(200, {"items": [
            {"id": "e1", "summary": "Standup",
             "start": {"dateTime": "2026-09-01T09:00:00Z"},
             "end": {"dateTime": "2026-09-01T09:15:00Z"}},
        ]})

    _serve(monkeypatch, handler)
    out = await calendar.list_events("c-1", days_ahead=3)
    assert seen["singleEvents"] == "true"
    assert seen["orderBy"] == "startTime"
    assert out["events"][0]["summary"] == "Standup"
    assert out["events"][0]["all_day"] is False


@pytest.mark.asyncio
async def test_an_all_day_event_is_not_lost(monkeypatch):
    """Google sends `date` OR `dateTime` and never both — reading only `dateTime` silently
    drops every all-day event."""
    _serve(monkeypatch, lambda *_a, **_k: _Resp(200, {"items": [
        {"id": "e2", "summary": "Public holiday",
         "start": {"date": "2026-09-07"}, "end": {"date": "2026-09-08"}},
    ]}))
    out = await calendar.list_events("c-1")
    ev = out["events"][0]
    assert ev["start"] == "2026-09-07"
    assert ev["all_day"] is True


@pytest.mark.asyncio
async def test_an_unreadable_calendar_is_reported_and_NOT_treated_as_free(monkeypatch):
    """⚠ THE MOST DANGEROUS WRONG ANSWER ON THIS SURFACE. freeBusy answers 200 with a
    per-calendar `errors` array for a calendar it could not read; dropping it would make
    that calendar look completely free and schedule straight over someone."""
    _serve(monkeypatch, lambda url, p, b, m: _Resp(200, {"calendars": {
        "primary": {"busy": [{"start": "2026-09-01T09:00:00Z", "end": "2026-09-01T10:00:00Z"}]},
        "team@x.com": {"errors": [{"domain": "global", "reason": "notFound"}], "busy": []},
    }}))
    out = await calendar.find_free_time("c-1", days_ahead=2, calendar_ids=["primary", "team@x.com"])
    assert out["busy"]["primary"][0]["start"].startswith("2026-09-01")
    assert out["errors"]["team@x.com"] == ["notFound"]
    assert "NOT free" in out["note"]


@pytest.mark.asyncio
async def test_find_free_time_is_a_POST_and_names_its_calendars(monkeypatch):
    captured: dict = {}

    def handler(url, params, body, method):
        captured["method"] = method
        captured["body"] = body
        return _Resp(200, {"calendars": {}})

    _serve(monkeypatch, handler)
    await calendar.find_free_time("c-1", calendar_ids=["a@x", "b@x"])
    assert captured["method"] == "POST"
    assert captured["body"]["items"] == [{"id": "a@x"}, {"id": "b@x"}]


# ══════════════════════════════════════════════════════════════════════════════════════
# Contacts — a question, never a bulk export
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_search_contacts_REFUSES_an_empty_query(monkeypatch):
    """"List every contact I have" is a bulk export of personal data with no question
    behind it — a shape this connector does not offer at all, not one it merely caps."""
    async def _must_not_send(*_a, **_k):
        raise AssertionError("no request may be sent without a query")

    monkeypatch.setattr(_http, "send_pinned_http", _must_not_send)
    with pytest.raises(GoogleReadError, match="does not list every contact"):
        await people.search_contacts("c-1", "   ")


@pytest.mark.asyncio
async def test_search_contacts_projects_the_first_of_each_field(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Resp(200, {"results": [
        {"person": {
            "names": [{"displayName": "Ada Lovelace"}],
            "emailAddresses": [{"value": "ada@x.com"}, {"value": "second@x.com"}],
            "organizations": [{"name": "Analytical Engines", "title": "Engineer"}],
        }},
    ]}))
    out = await people.search_contacts("c-1", "ada")
    c = out["contacts"][0]
    assert (c["name"], c["email"], c["organization"], c["title"]) == (
        "Ada Lovelace", "ada@x.com", "Analytical Engines", "Engineer"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# The wiring — 15 tools, one connection, five keys, no writes
# ══════════════════════════════════════════════════════════════════════════════════════
def test_every_google_tool_declares_a_wholly_wired_key_and_writes_nothing():
    from app.security.egress import ALLOWED_HOST_SUFFIXES, _HOST_MATCH, _TLS_SCHEMES
    from app.services.connectors.service_tools import SERVICE_TOOL_SPECS

    tools = SERVICE_TOOL_SPECS["google"]
    assert len(tools) == 15
    for tool in tools:
        key = tool["capability"]
        assert tool["writes"] is False, f"{tool['name']} claims to write"
        # A key in one table and missing from another is a KeyError at the socket —
        # no answer, rather than a clear no.
        assert ALLOWED_HOST_SUFFIXES.get(key), f"{key} has no allow-list"
        assert key in _HOST_MATCH, f"{key} has no match mode"
        assert key in _TLS_SCHEMES, f"{key} has no permitted scheme"


def test_the_five_surfaces_declare_five_DIFFERENT_keys():
    """They all resolve to googleapis.com, so the key buys no host separation — it buys
    that a Calendar tool cannot reach Gmail, which is the property an audit can grep."""
    from app.services.connectors.service_tools import spec_for

    expected = {
        "search_files": "drive_read", "read_file": "drive_read",
        "search_email": "gmail_read", "read_email": "gmail_read",
        "list_labels": "gmail_read", "read_thread": "gmail_read",
        "read_attachment": "gmail_read",
        "list_sheet_tabs": "sheets_read", "read_sheet": "sheets_read",
        "read_doc": "docs_read",
        "list_calendars": "calendar_read", "list_events": "calendar_read",
        "get_event": "calendar_read", "find_free_time": "calendar_read",
        "search_contacts": "contacts_read",
    }
    for tool, key in expected.items():
        assert spec_for("google", tool)["capability"] == key, tool


def test_no_second_google_service_id_and_every_read_scope_is_readonly():
    from app.services.connectors.service_tools import SERVICE_TOOL_SPECS
    from app.services.oauth_service import OAUTH_PROVIDERS

    for forbidden in ("gmail", "sheets", "docs", "calendar", "contacts"):
        assert forbidden not in SERVICE_TOOL_SPECS, (
            f"{forbidden} must not become a second service id — one connection means one "
            "consent and one place to revoke"
        )
    scopes = OAUTH_PROVIDERS["google"]["default_scopes"]
    for surface in ("gmail", "spreadsheets", "documents", "calendar", "contacts", "drive"):
        assert any(f"/{surface}.readonly" in s for s in scopes), surface
    # ⛔ Not one write scope was granted along the way.
    for forbidden in ("gmail.send", "gmail.modify", "gmail.compose", "mail.google.com",
                      "auth/spreadsheets\"", "calendar.events", "drive.file"):
        assert not any(forbidden in s for s in scopes), forbidden


def test_every_declared_tool_resolves_to_a_real_transport():
    """⚠ AN ADVERTISED ACTION NOTHING CAN PERFORM IS THE DEFECT THIS REPO KEEPS FINDING.
    Every spec name must be reachable — either a Gmail arm, a table entry, or Drive."""
    from app.services.connectors.service_tools import (
        _GOOGLE_READ_CALLS, SERVICE_TOOL_SPECS,
    )
    import importlib

    gmail_arms = {"search_email", "read_email", "read_thread", "list_labels",
                  "read_attachment"}
    drive_arms = {"search_files", "read_file"}
    for tool in SERVICE_TOOL_SPECS["google"]:
        name, key = tool["name"], tool["capability"]
        if name in gmail_arms or name in drive_arms:
            continue
        entry = _GOOGLE_READ_CALLS.get(key, {}).get(name)
        assert entry is not None, f"{name} declares {key} but has no transport"
        module_path, func_name = entry
        assert callable(getattr(importlib.import_module(module_path), func_name)), name
