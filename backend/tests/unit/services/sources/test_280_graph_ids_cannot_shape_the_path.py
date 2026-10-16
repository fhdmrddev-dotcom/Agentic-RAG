"""Phase 280 (FIX-04 / D-28) - a client-supplied Graph item id cannot shape the request path.

WR-01 (BUG-260910-04) fixed this class for the SEARCH term. Research for Phase 280 measured
its live sibling: the item ids that reach `_children_url` and `read_file` were interpolated
raw into the Graph path -

    f"{GRAPH_API_BASE}/me/drive/items/{folder_id}/children"
    f"{GRAPH_API_BASE}/me/drive/items/{file_id}"

and those ids arrive from the client: `GET /connectors/connections/{id}/browse?folder_id=`,
`WatchCreateRequest.source_folder_id`, and the import file ids. Measured in the venv
(httpx 0.28.1), with the URL built exactly as above:

    x/../../drives/D1/root   -> /v1.0/me/drive/drives/D1/root/children   (dot segments collapsed)
    x?$expand=children&a=    -> the `children` call became an item call with a caller query
    a#frag                   -> the fragment swallowed `/children`

Not SSRF - egress pins the host - but it lets the caller choose a different Graph endpoint,
or another drive, under the connection owner's token.

⚠ EVERY ASSERTION HERE IS MADE AFTER `httpx.URL(...)` NORMALISATION, because the measured
attack IS the normalisation: a string check on the raw URL would see `items/` and pass while
the transport sends the request somewhere else.

⚠ Following the 238_06 lesson (its :140-146): do NOT assert that `..` is absent. `.` is
unreserved, so `..` legitimately survives encoding and is inert once every `/` around it is
`%2F`. Test the PROPERTY - the id occupies exactly one path segment - not a byte sequence
that merely looks dangerous.

ALL OF THESE ASSERT BEHAVIOUR (SEED-270): each drives the adapter and reads the URL actually
issued. None greps the source.
"""

import json as jsonlib
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from app.security.egress import PinnedResponse
from app.services.sources.adapters.microsoft_graph import (
    GRAPH_API_BASE,
    MicrosoftGraphSourceAdapter,
)

CONN = {"id": "conn-1", "service_id": "microsoft", "config": {}}

ITEMS_PREFIX = "/v1.0/me/drive/items/"
OWN_PARAMS = {"$select", "$top"}


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


def _read_file_handler(c, m, u, k):
    """Metadata answers with a downloadUrl; the download answers with bytes."""
    if c == "graph_download":
        return PinnedResponse(status_code=200, headers={}, body=b"hello")
    return _json(
        {
            "id": "whatever",
            "name": "a.txt",
            "file": {"mimeType": "text/plain"},
            "@microsoft.graph.downloadUrl": "https://public.dm.files.1drv.com/x?token=t",
        }
    )


HOSTILE_IDS = [
    ("x/../../drives/D1/root", "climb out of /items/ and address another drive"),
    ("x?$expand=children&a=", "open a real query string and turn the call into another one"),
    ("a#frag", "truncate the request at a fragment, swallowing what follows"),
    ("a&$top=999", "smuggle an OData parameter (inert in a path segment; a control row)"),
]


def _assert_one_segment(issued: str, *, suffix: str, what_it_would_do: str) -> None:
    url = httpx.URL(issued)
    path = url.raw_path.decode("ascii").split("?", 1)[0]

    assert url.host == "graph.microsoft.com", f"left the Graph host: {issued!r}"
    assert url.query == b"", (
        f"the id opened a query string and could {what_it_would_do}: {issued!r} "
        f"-> query {url.query!r}"
    )
    assert url.fragment == "", (
        f"the id opened a fragment and could {what_it_would_do}: {issued!r} "
        f"-> fragment {url.fragment!r}"
    )
    assert path.startswith(ITEMS_PREFIX), (
        f"after normalisation the request no longer addresses /me/drive/items/ - the id "
        f"could {what_it_would_do}: {issued!r} -> {path!r}"
    )
    assert path.endswith(suffix), (
        f"after normalisation the request lost its {suffix or 'item'} endpoint: "
        f"{issued!r} -> {path!r}"
    )
    segment = path[len(ITEMS_PREFIX):len(path) - len(suffix)] if suffix else path[len(ITEMS_PREFIX):]
    assert segment and "/" not in segment, (
        f"the id does not occupy exactly one path segment, so it could "
        f"{what_it_would_do}: {segment!r}"
    )


# -- the folder id: _children_url (list_files / browse / watch) ---------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("hostile,what_it_would_do", HOSTILE_IDS)
async def test_a_hostile_folder_id_cannot_change_the_children_endpoint(
    adapter, monkeypatch, hostile, what_it_would_do
):
    rec = _install(monkeypatch)
    await adapter.list_files(CONN, folder_id=hostile)

    assert len(rec.calls) == 1
    _assert_one_segment(rec.urls[0], suffix="/children", what_it_would_do=what_it_would_do)
    assert set(rec.params[0]) == OWN_PARAMS, (
        f"parameters other than the adapter's own reached the request: {rec.params[0]!r}"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("hostile,what_it_would_do", HOSTILE_IDS)
async def test_a_hostile_folder_id_cannot_change_the_BROWSE_endpoint(
    adapter, monkeypatch, hostile, what_it_would_do
):
    """`browse` is the door the folder picker uses - `?folder_id=` straight from the client."""
    rec = _install(monkeypatch)
    await adapter.browse(CONN, folder_id=hostile)

    assert len(rec.calls) == 1
    _assert_one_segment(rec.urls[0], suffix="/children", what_it_would_do=what_it_would_do)


# -- the file id: read_file's metadata call -----------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("hostile,what_it_would_do", HOSTILE_IDS)
async def test_a_hostile_file_id_cannot_change_the_metadata_endpoint(
    adapter, monkeypatch, hostile, what_it_would_do
):
    rec = _install(monkeypatch, _read_file_handler)
    await adapter.read_file(CONN, hostile)

    capability, _, meta_url, kwargs = rec.calls[0]
    assert capability == "graph_read"
    assert not kwargs.get("params"), "read_file's metadata call must carry no $select"
    _assert_one_segment(meta_url, suffix="", what_it_would_do=what_it_would_do)


# -- refusal: ids that cannot name an item at all -----------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [".", ".."])
async def test_a_dot_segment_folder_id_is_REFUSED_and_never_issued(adapter, monkeypatch, bad):
    """`.`/`..` are not ids - they are path syntax. Encoding cannot help: `.` is unreserved,
    so `quote` leaves them alone and httpx would still collapse them. Refuse instead.

    ⚠ `""` is NOT in this table on purpose: for a FOLDER, `""` is a declared virtual-root id
    (`VIRTUAL_ROOT_IDS`) and means "the drive root" - see the positive control below.
    """
    rec = _install(monkeypatch)
    with pytest.raises(ValueError) as exc:
        await adapter.list_files(CONN, folder_id=bad)
    assert repr(bad) in str(exc.value), f"the refusal must name what it refused: {exc.value}"
    assert rec.calls == [], f"a refused id still reached the wire: {rec.urls!r}"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["", ".", ".."])
async def test_an_empty_or_dot_segment_file_id_is_REFUSED_and_never_issued(
    adapter, monkeypatch, bad
):
    rec = _install(monkeypatch, _read_file_handler)
    with pytest.raises(ValueError) as exc:
        await adapter.read_file(CONN, bad)
    assert repr(bad) in str(exc.value), f"the refusal must name what it refused: {exc.value}"
    assert rec.calls == [], f"a refused id still reached the wire: {rec.urls!r}"


def test_a_None_id_is_REFUSED_rather_than_formatted_as_the_string_None():
    """`f"items/{None}"` would issue `/items/None` - a request for an item called "None"."""
    from app.services.sources.adapters.microsoft_graph import _item_segment

    with pytest.raises(ValueError) as exc:
        _item_segment(None)
    assert "None" in str(exc.value)


# -- positive controls: green before and after --------------------------------------------


@pytest.mark.asyncio
async def test_a_real_personal_onedrive_id_is_issued_with_its_bang_LITERAL(adapter, monkeypatch):
    """POSITIVE CONTROL. Personal OneDrive ids look like `ABC123!105`; `!` stays literal
    (`%21` is unverified against live Graph - RESEARCH A2), and the browse still works."""

    def handler(c, m, u, k):
        return _json(
            {
                "value": [
                    {"id": "ABC123!106", "name": "Q3 Plans", "folder": {"childCount": 10}},
                    {"id": "ABC123!107", "name": "a.txt", "file": {"mimeType": "text/plain"}},
                ]
            }
        )

    rec = _install(monkeypatch, handler)
    page = await adapter.browse(CONN, folder_id="ABC123!105")

    assert rec.urls[0] == f"{GRAPH_API_BASE}/me/drive/items/ABC123!105/children"
    assert httpx.URL(rec.urls[0]).raw_path.decode("ascii").startswith(
        "/v1.0/me/drive/items/ABC123!105/children"
    )
    assert [n.id for n in page.items] == ["ABC123!106"]

    rec2 = _install(monkeypatch, _read_file_handler)
    await adapter.read_file(CONN, "ABC123!107")
    assert rec2.urls[0] == f"{GRAPH_API_BASE}/me/drive/items/ABC123!107"


@pytest.mark.asyncio
@pytest.mark.parametrize("root_id", [None, "", "virtual_root", "onedrive"])
async def test_a_virtual_root_id_still_lists_the_drive_root(adapter, monkeypatch, root_id):
    """POSITIVE CONTROL - the virtual-root branch never goes through the item helper."""
    rec = _install(monkeypatch)
    await adapter.list_files(CONN, folder_id=root_id)
    assert rec.urls[0] == f"{GRAPH_API_BASE}/me/drive/root/children"
