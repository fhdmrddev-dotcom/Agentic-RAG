"""BUG-260910-04 / 238-REVIEW WR-02 — an unrecognised Graph cursor must REFUSE, never restart.

⛔ WHAT SHIPPED, AND WHY NOBODY WOULD HAVE NOTICED.

`_get_page` re-issued a pagination cursor only when it matched `GRAPH_API_BASE` byte-for-byte:

    if page_token and page_token.startswith(f"{GRAPH_API_BASE}/"):
        url = page_token
    else:
        params = {...}          # <- silently starts the listing over at page 1

There is no `else: raise`. Any cursor that does not match the prefix exactly — a differently
cased host, a `beta` base, a future `nextLink` shape — **silently refetches page 1**.

⭐ BOTH CONSEQUENCES ARE SILENT, AND THE WATCH ONE IS THE SERIOUS ONE:

  * `preview_service.walk_source_files` re-reads page 1 until `MAX_PAGES_PER_FOLDER`, then
    reports `truncated=True, stopped_by="pages"` — *"this folder is too big"* about a folder
    that is not.
  * `watch_service` trips its `seen_tokens` cycle detector and sets `listing.complete = False`,
    so DELETIONS correctly fail closed — but **the run still reports `success`**. A watched
    OneDrive folder larger than one page silently stops importing at ~200 files, forever,
    while the UI says the sync worked.

⭐ REFUSING IS SAFE AND GUESSING IS NOT. `graph_read`'s suffix pin validates the host on the way
out, so re-issuing an unexpected cursor cannot reach a foreign host — the egress layer would
refuse it loudly. Restarting the listing reaches the RIGHT host and returns the WRONG data,
which is the failure that has no alarm attached.

⚠ THESE ASSERT BEHAVIOUR, NOT SHAPE (SEED-270). Each drives the adapter and reads what URL was
actually issued, or that an exception was actually raised — none greps the source.
"""

import json as jsonlib
from typing import Any

import pytest
from unittest.mock import AsyncMock

from app.security.egress import PinnedResponse
from app.services.sources.adapters.microsoft_graph import (
    GRAPH_API_BASE,
    MicrosoftGraphSourceAdapter,
)

CONN = {"id": "conn-1", "service_id": "microsoft", "config": {}}


class _Recorder:
    def __init__(self, handler):
        self.handler = handler
        self.urls: list[str] = []

    async def __call__(self, capability, method, url, **kwargs):
        self.urls.append(url)
        return self.handler(capability, method, url, kwargs)


def _json(payload: dict[str, Any], status: int = 200) -> PinnedResponse:
    """Mirror `test_238_microsoft_graph_adapter.py`'s stub exactly.

    ⚠ An earlier draft of this file hand-rolled a `_R` object with only `status_code` and
    `json()`. Its two POSITIVE CONTROLS went red, which is the control doing its job: the
    harness was wrong, not the product. Reuse the shipped shape.
    """
    return PinnedResponse(
        status_code=status,
        headers={"content-type": "application/json"},
        body=jsonlib.dumps(payload).encode("utf-8"),
    )


@pytest.fixture
def adapter(monkeypatch):
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.get_fresh_access_token",
        AsyncMock(return_value="mock_graph_token"),
    )
    return MicrosoftGraphSourceAdapter()


def _install(monkeypatch, handler):
    rec = _Recorder(handler)
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.send_pinned_http", rec
    )
    return rec


# ── the defect ───────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "cursor,why",
    [
        (
            "https://graph.microsoft.com/beta/me/drive/items/F1/children?$skiptoken=Z",
            "a beta base is a plausible future nextLink shape",
        ),
        (
            "$skiptoken=Z",
            "a bare opaque token — Drive's cursor shape arriving here by mistake",
        ),
    ],
)
async def test_an_unrecognised_cursor_is_REFUSED_and_never_silently_restarts(
    adapter, monkeypatch, cursor, why
):
    """The whole bug in one assertion: the adapter must not quietly return page 1.

    ⛔ RED before the fix: no exception is raised, and the issued URL is the page-1 URL —
    the caller receives a full, successful-looking first page and has no way to tell.
    """
    def handler(capability, method, url, kwargs):
        return _json({"value": [{"id": "F2", "name": "Page one", "folder": {}}]})

    rec = _install(monkeypatch, handler)

    with pytest.raises(ValueError) as exc:
        await adapter.browse(CONN, folder_id="F1", page_token=cursor)

    assert rec.urls == [], (
        f"the adapter issued a request for an unrecognised cursor instead of refusing "
        f"({why}); it fetched {rec.urls!r}, which is page 1 wearing the costume of page 2"
    )
    detail = str(exc.value)
    assert "cursor" in detail.lower(), (
        f"the refusal must say what it refused; got {detail!r}"
    )


@pytest.mark.asyncio
async def test_the_refusal_names_the_cursor_without_dumping_the_whole_token(
    adapter, monkeypatch
):
    """A cursor can carry a long opaque token. Name enough to diagnose, not the whole thing."""
    long_cursor = "https://evil.example.com/v1.0/x?$skiptoken=" + ("A" * 500)
    _install(monkeypatch, lambda *a, **k: _json({"value": []}))

    with pytest.raises(ValueError) as exc:
        await adapter.browse(CONN, folder_id="F1", page_token=long_cursor)

    detail = str(exc.value)
    assert len(detail) < 300, (
        f"the refusal dumped a {len(detail)}-char message; a cursor is untrusted, "
        "possibly attacker-influenced text and does not belong in a log verbatim"
    )


# ── the positive controls — these MUST be green both before and after the fix ────────────


@pytest.mark.asyncio
async def test_an_UPPERCASE_host_is_ACCEPTED_because_the_host_is_case_insensitive(
    adapter, monkeypatch
):
    """⚠ THIS CASE MOVED. It was first written as a REFUSAL and that was WRONG.

    RFC 3986 §3.2.2 makes the host case-insensitive, so `GRAPH.microsoft.com` is a legal
    variation Graph may emit for the same resource. Refusing it would be over-strict and
    would break a valid response.

    ⭐ And it is SAFE to accept, measured rather than assumed: `egress.py:383` normalises with
    `host.lower().rstrip(".")` before the suffix match, so an uppercase host resolves to the
    same pinned destination. The cursor still cannot reach a foreign host.

    ⛔ The refusal exists to stop a SILENT RESTART, not to police URL spelling. Recorded here
    rather than quietly deleted because "the test was wrong" is a claim that needs its
    reasoning attached — see [[SEED-270]].
    """
    cursor = "https://GRAPH.microsoft.com/v1.0/me/drive/items/F1/children?$skiptoken=Z"
    rec = _install(
        monkeypatch,
        lambda c, m, u, k: _json({"value": [{"id": "F9", "name": "Page two", "folder": {}}]}),
    )

    page = await adapter.browse(CONN, folder_id="F1", page_token=cursor)

    assert rec.urls == [cursor], (
        "an uppercase host is the same resource and must be re-issued verbatim, "
        f"not refused and not rewritten; issued {rec.urls!r}"
    )
    assert [n.id for n in page.items] == ["F9"], "it must return page TWO, not page 1"



@pytest.mark.asyncio
async def test_a_RECOGNISED_cursor_is_still_re_issued_byte_identically(adapter, monkeypatch):
    """⭐ POSITIVE CONTROL. The fix must not break the shipped happy path.

    If this ever goes red, the refusal became too strict and paging is broken outright —
    a worse bug than the one being fixed.
    """
    next_link = f"{GRAPH_API_BASE}/me/drive/items/F1/children?$skiptoken=ABC123"

    def handler(capability, method, url, kwargs):
        if "$skiptoken" in url:
            return _json({"value": [{"id": "F3", "name": "Second", "folder": {}}]})
        return _json({
            "value": [{"id": "F2", "name": "First", "folder": {}}],
            "@odata.nextLink": next_link,
        })

    rec = _install(monkeypatch, handler)
    first = await adapter.browse(CONN, folder_id="F1")
    second = await adapter.browse(CONN, folder_id="F1", page_token=first.next_page_token)

    assert rec.urls[1] == next_link, "a valid nextLink must still be re-issued verbatim"
    assert [n.id for n in second.items] == ["F3"]


@pytest.mark.asyncio
async def test_no_cursor_at_all_still_starts_at_page_one(adapter, monkeypatch):
    """⭐ POSITIVE CONTROL. `page_token=None` means 'first page' and must keep meaning it.

    The refusal must fire on an UNRECOGNISED cursor, never on the ABSENCE of one.
    """
    rec = _install(
        monkeypatch,
        lambda c, m, u, k: _json({"value": [{"id": "F2", "name": "First", "folder": {}}]}),
    )
    page = await adapter.browse(CONN, folder_id="F1")

    assert len(rec.urls) == 1, "a first-page browse must issue exactly one request"
    assert [n.id for n in page.items] == ["F2"]
