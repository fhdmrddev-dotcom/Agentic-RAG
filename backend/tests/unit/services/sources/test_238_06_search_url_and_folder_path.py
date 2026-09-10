"""BUG-260910-04 / 238-REVIEW WR-01 + WR-03 - the search URL and the folder path.

Two defects in the same adapter, both reached by ordinary user input, both invisible to the
live UAT because it drove only `/Attachments` and an underscored filename.

WR-01 - THE SEARCH TERM IS BUILT INTO THE URL **PATH**.

    safe = query.replace("'", "''")
    url = f"{GRAPH_API_BASE}/me/drive/root/search(q='{safe}')"

Only the OData string delimiter is escaped; **URL syntax is not**. A `?` in the search box
terminates the path and opens a real query string, so the caller controls OData parameters -
and `/` plus `../` are normalised by `httpx.URL`, so the caller also chooses which Graph
endpoint is hit under the connection's token.

This is a REGRESSION against the sibling it was told to mirror, not parity with it:
`google_drive.py:254` puts the identical user string into a `params` VALUE, where the transport
percent-encodes it and the URL structure is untouchable. `send_pinned_http`'s own docstring
states the rule - "Query parameters, encoded by the transport rather than by the caller" -
and this call site opted out of it.

Not SSRF: the host is pinned and the token is the caller's own delegated scope. It is an
arbitrary-Graph-GET primitive plus a 400-on-a-parenthesis robustness bug.

WR-03 - THE PATH MIXES TWO ENCODINGS, AND SHOWS DRIVE IDS AS FOLDERS.

`parentReference.path` is documented by Graph as a NAVIGABLE (URL-encoded) path. `_folder_path`
returns it verbatim and `list_files` concatenates the DECODED name:

    '/Team%20Docs/Q3%20Plans' + '/' + 'Q3 Plans.pdf'
      -> '/Team%20Docs/Q3%20Plans/Q3 Plans.pdf'

The two halves of one string are in different encodings, so a rule looking for '/Team Docs/'
never matches. That is SEED-253's exact user-visible failure arriving through a new
mechanism - a path that looks real and cannot be matched. Every folder with a space or a
non-ASCII character is affected.

Second arm: with no `root:` marker the regex does not match and the raw value is returned, so
an opaque id (`/drives/b!abc/items/01XYZ`) is presented as a location to write a rule against.

CR-01 made `None` a legitimate honest answer for an unknown path, so this fix costs nothing
it did not already have: when we do not know the folder, we say so.

ALL OF THESE ASSERT BEHAVIOUR (SEED-270): each drives the adapter and reads the URL actually
issued or the path actually minted. None greps the source.
"""

import json as jsonlib
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.security.egress import PinnedResponse
from app.services.sources.adapters.microsoft_graph import (
    GRAPH_API_BASE,
    MicrosoftGraphSourceAdapter,
    _folder_path,
)

CONN = {"id": "conn-1", "service_id": "microsoft", "config": {}}


def _json(payload: dict[str, Any], status: int = 200) -> PinnedResponse:
    return PinnedResponse(
        status_code=status,
        headers={"content-type": "application/json"},
        body=jsonlib.dumps(payload).encode("utf-8"),
    )


class _Recorder:
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
    def params(self) -> list[dict]:
        return [c[3].get("params") or {} for c in self.calls]


@pytest.fixture
def adapter(monkeypatch):
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.get_fresh_access_token",
        AsyncMock(return_value="mock_graph_token"),
    )
    return MicrosoftGraphSourceAdapter()


def _install(monkeypatch, handler=None):
    rec = _Recorder(handler or (lambda c, m, u, k: _json({"value": []})))
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.send_pinned_http", rec
    )
    return rec


# -- WR-01: the search term must never shape the URL --------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "hostile,what_it_would_do",
    [
        ("a')?$expand=children&x=('", "terminate the path and add a real OData parameter"),
        ("a')/../../me/drive/root/children?x=('", "choose a different Graph endpoint"),
        ("a#fragment", "truncate the request at a fragment"),
        ("a&$top=999", "override the page size"),
    ],
)
async def test_a_hostile_search_term_cannot_change_the_request_URL(
    adapter, monkeypatch, hostile, what_it_would_do
):
    """The URL the adapter issues must be structurally identical whatever the user typed."""
    rec = _install(monkeypatch)
    await adapter.list_files(CONN, query=hostile)

    issued = rec.urls[0]
    assert issued.startswith(f"{GRAPH_API_BASE}/"), f"URL left the pinned base: {issued!r}"

    for ch in ("?", "#", "&"):
        assert ch not in issued, (
            f"the search term reached the URL and could {what_it_would_do}: {issued!r}"
        )

    # The term sits inside search(q='...'). Everything the user typed must be encoded such
    # that it cannot act as URL SYNTAX - so the interesting question is whether any
    # STRUCTURAL character survives inside that segment, not whether some byte sequence
    # appears anywhere in the string.
    #
    # ⚠ THIS ASSERTION WAS FIRST WRITTEN AS `".." not in issued` AND THAT WAS WRONG - the
    # third over-strict assertion in this session, and worth naming rather than quietly
    # fixing. `.` is an unreserved character, so `..` legitimately survives encoding; with
    # every surrounding `/` encoded to `%2F` it CANNOT form a path segment and is inert.
    # Forbidding the literal would have failed a correct implementation. Test the property
    # (no unencoded separator inside the term), never a byte sequence that merely looks
    # dangerous. See [[SEED-270]].
    prefix = f"{GRAPH_API_BASE}/me/drive/root/search(q='"
    assert issued.startswith(prefix), f"unexpected search URL shape: {issued!r}"
    term_segment = issued[len(prefix):].rsplit("')", 1)[0]
    assert "/" not in term_segment, (
        f"an unencoded path separator survived inside the search term, so it could "
        f"{what_it_would_do}: {term_segment!r}"
    )


@pytest.mark.asyncio
async def test_the_search_term_is_transmitted_and_is_ENCODED_wherever_it_rides(
    adapter, monkeypatch
):
    """THIS TEST WAS REWRITTEN, and the reason matters more than the test.

    It first asserted the term must travel in `params` - which pinned an IMPLEMENTATION
    (the review's suggested fix) rather than the PROPERTY that actually matters. That is
    the SEED-270 mistake from the other side: a test so specific it forbids a correct
    solution.

    The property is: the term is transmitted, and it cannot reach URL syntax. Graph
    documents OneDrive search as an OData FUNCTION (`/search(q='...')`), so moving the term
    to a query parameter would change the contract with a live API this change cannot
    drive. Percent-encoding satisfies the property without that gamble.

    So: assert the term ARRIVES, and assert (in the sibling test above) that no structural
    character survives. Do not dictate which side of the request carries it.
    """
    rec = _install(monkeypatch)
    await adapter.list_files(CONN, query="quarterly report")

    whole_request = rec.urls[0] + repr(rec.params[0])
    assert "quarterly" in whole_request and "report" in whole_request, (
        f"the search term never reached the request at all; url={rec.urls[0]!r} "
        f"params={rec.params[0]!r}"
    )
    assert " " not in rec.urls[0], (
        f"a raw space reached the URL: {rec.urls[0]!r} - the term is not being encoded"
    )


@pytest.mark.asyncio
async def test_an_ordinary_search_still_returns_its_results(adapter, monkeypatch):
    """POSITIVE CONTROL - green before and after. The fix must not break search."""

    def handler(c, m, u, k):
        return _json(
            {
                "value": [
                    {
                        "id": "F1",
                        "name": "Q3.pdf",
                        "file": {"mimeType": "application/pdf"},
                        "size": 10,
                    },
                ]
            }
        )

    _install(monkeypatch, handler)
    page = await adapter.list_files(CONN, query="Q3")
    assert [f.name for f in page.files] == ["Q3.pdf"]


# -- WR-03: the folder path must be one encoding, or None ---------------------------------


def test_a_percent_encoded_folder_path_is_DECODED_so_a_rule_can_match():
    """A percent-encoded folder cannot be matched by a person writing the plain name."""
    got = _folder_path({"parentReference": {"path": "/drive/root:/Team%20Docs/Q3%20Plans"}})
    assert got == "/Team Docs/Q3 Plans", (
        f"got {got!r} - a rule looking for '/Team Docs/' cannot match this, which is "
        "SEED-253's failure by a new mechanism"
    )


def test_a_drive_internal_id_is_NOT_presented_as_a_folder_path():
    """An opaque id is not a location anyone can write a rule against. None is honest."""
    got = _folder_path({"parentReference": {"path": "/drives/b!abc/items/01XYZ"}})
    assert got is None, (
        f"got {got!r} - an opaque drive/item id was offered as a folder path. CR-01 made None "
        "a legitimate answer for 'we do not know'; use it"
    )


@pytest.mark.asyncio
async def test_the_composed_file_path_is_ONE_encoding_end_to_end(adapter, monkeypatch):
    """The folder half and the filename half must not be in different encodings."""

    def handler(c, m, u, k):
        return _json(
            {
                "value": [
                    {
                        "id": "F1",
                        "name": "Q3 Plans.pdf",
                        "file": {"mimeType": "application/pdf"},
                        "size": 10,
                        "parentReference": {"path": "/drive/root:/Team%20Docs"},
                    }
                ]
            }
        )

    _install(monkeypatch, handler)
    page = await adapter.list_files(CONN, folder_id="F1")

    assert page.files[0].path == "/Team Docs/Q3 Plans.pdf", (
        f"got {page.files[0].path!r} - the folder half and the name half are in different "
        "encodings, so no folder-shaped rule can match the whole string"
    )
    assert "%20" not in (page.files[0].path or ""), "percent-encoding leaked into a stored fact"


def test_a_plain_unencoded_path_is_unchanged():
    """POSITIVE CONTROL - green before and after.

    Decoding must be a no-op when there is nothing to decode, or the fix has changed the
    shipped happy path rather than repaired it.
    """
    got = _folder_path({"parentReference": {"path": "/drive/root:/Attachments"}})
    assert got == "/Attachments"


def test_no_parent_reference_is_still_None():
    """POSITIVE CONTROL - the CR-01 invariant must survive this change."""
    assert _folder_path({}) is None
    assert _folder_path({"parentReference": {}}) is None
