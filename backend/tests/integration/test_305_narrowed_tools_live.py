"""Phase 305-02 (D-21 / D-22 / D-41(3); T-305-05) — a narrowed key, at ``tools/call``, per tool.

304 proved the reads narrow; this proves the TRANSPORT does not re-widen them. A key ticked to
folder F (subtree F ⊃ F2) is presented through the real ``/mcp`` path (``phase305_mcp_client``),
and each of the three tools gets ONE driven arm that first shows the un-narrowed key REACHING the
thing (non-vacuity), then shows the narrowed key does not:

* ``search_knowledge_base`` — Root and shared-folder passages are out; only F's subtree is in;
* ``list_documents`` — the top level is F alone with no Root documents; another folder (even a
  visible shared one) answers the same empty page as an empty folder;
* ``read_document`` — outside the subtree is the one not-available sentence.

Plus the two exclusion arms carried from 304 D-32:

* **the shared (global-to-the-org) folder** — a co-member's org-shared folder SX is out of a key
  ticked to F, through every tool, and in once SX itself is ticked;
* **connector-fed** — with ``include_external`` false the connector-fed document is out of every
  tool even inside the ticked folder, and in with it true.

The grant is re-checked at call time: a key without ``read_document`` cannot call it even by name.
Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

import pytest

from app.mcp import read_tools
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)
from tests.integration.phase305_mcp_client import mcp_session

pytestmark = requires_pg


@pytest.fixture
def w(world, monkeypatch):
    patch_search(monkeypatch, world)
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    return world


async def _search(call, w) -> set[str]:
    reply = await call.tool("search_knowledge_base", {"query": w.tok_x, "limit": 20})
    assert not reply.is_error, reply.text
    return {p["document_id"] for p in reply.structured["passages"]}


async def _listing(call, folder_id=None) -> tuple[set[str], set[str]]:
    args = {"limit": 100} | ({"folder_id": folder_id} if folder_id else {})
    reply = await call.tool("list_documents", args)
    assert not reply.is_error, reply.text
    s = reply.structured
    assert s["next_cursor"] is None
    return {f["folder_id"] for f in s["folders"]}, {d["document_id"] for d in s["documents"]}


async def _readable(call, document_id) -> bool:
    """The key can read the document. The seeded documents carry no ``full_markdown``, so a
    readable one answers ``NO_TEXT_SENTENCE`` — which is only ever said about a document the key
    can see; anything it cannot see is the one not-available sentence."""
    reply = await call.tool("read_document", {"document_id": document_id})
    if reply.is_error:
        assert reply.text in (read_tools.NOT_AVAILABLE_SENTENCE, read_tools.NO_TEXT_SENTENCE), reply.text
    return reply.text != read_tools.NOT_AVAILABLE_SENTENCE


# ── one arm per tool ─────────────────────────────────────────────────────────────────────────


async def test_search_knowledge_base_narrowed(w, monkeypatch):
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as wide:
        assert w.ids("root_x", "sx_doc") <= await _search(wide, w)  # non-vacuity
    async with mcp_session(monkeypatch, await w.mint(folder_ids=[w.f], include_external=True)) as call:
        assert await _search(call, w) == w.ids("f_doc", "f2_doc", "ext_doc")


async def test_list_documents_narrowed(w, monkeypatch):
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as wide:
        folders, docs = await _listing(wide)
        assert {w.f, w.sx} <= folders and w.docs["root_x"] in docs  # non-vacuity
        assert (await _listing(wide, w.sx))[1] == w.ids("sx_doc")
    async with mcp_session(monkeypatch, await w.mint(folder_ids=[w.f], include_external=True)) as call:
        assert await _listing(call) == ({w.f}, set())  # no Root documents for a narrowed key
        assert await _listing(call, w.f) == ({w.f2}, w.ids("f_doc", "ext_doc"))
        assert await _listing(call, w.f2) == (set(), w.ids("f2_doc"))
        assert await _listing(call, w.sx) == (set(), set())  # the same page as an empty folder


async def test_read_document_narrowed(w, monkeypatch):
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as wide:
        for label in ("root_x", "sx_doc"):
            assert await _readable(wide, w.docs[label]), label  # non-vacuity
    async with mcp_session(monkeypatch, await w.mint(folder_ids=[w.f], include_external=True)) as call:
        for label in ("f_doc", "f2_doc", "ext_doc"):
            assert await _readable(call, w.docs[label]), label
        for label in ("root_x", "sx_doc", "px_doc", "fy_doc"):
            assert not await _readable(call, w.docs[label]), label


# ── the exclusion arms ───────────────────────────────────────────────────────────────────────


async def test_the_shared_folder_needs_its_own_tick_through_every_tool(w, monkeypatch):
    sx_doc = w.docs["sx_doc"]
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as wide:
        assert sx_doc in await _search(wide, w) and await _readable(wide, sx_doc)  # non-vacuity
    async with mcp_session(monkeypatch, await w.mint(folder_ids=[w.f], include_external=True)) as call:
        assert sx_doc not in await _search(call, w)
        assert w.sx not in (await _listing(call))[0]
        assert sx_doc not in (await _listing(call, w.sx))[1]
        assert not await _readable(call, sx_doc)
    async with mcp_session(monkeypatch, await w.mint(folder_ids=[w.f, w.sx], include_external=True)) as call:
        assert sx_doc in await _search(call, w)
        assert w.sx in (await _listing(call))[0]
        assert (await _listing(call, w.sx))[1] == {sx_doc}
        assert await _readable(call, sx_doc)


async def test_connector_fed_documents_need_include_external_through_every_tool(w, monkeypatch):
    ext = w.docs["ext_doc"]
    for folder_ids in (None, [w.f]):
        async with mcp_session(monkeypatch, await w.mint(folder_ids=folder_ids, include_external=True)) as on:
            assert ext in await _search(on, w)  # non-vacuity
            assert ext in (await _listing(on, w.f))[1]
            assert await _readable(on, ext)
        async with mcp_session(monkeypatch, await w.mint(folder_ids=folder_ids, include_external=False)) as off:
            assert ext not in await _search(off, w)
            assert ext not in (await _listing(off, w.f))[1]
            assert not await _readable(off, ext)


async def test_the_grant_is_rechecked_at_call_time(w, monkeypatch):
    secret = await w.mint(tools=("search_knowledge_base",))
    async with mcp_session(monkeypatch, secret) as call:
        assert [t["name"] for t in await call.list_tools()] == ["search_knowledge_base"]
        reply = await call.tool("read_document", {"document_id": w.docs["f_doc"]})
        listing = await call.tool("list_documents", {})
    assert reply.is_error and reply.text == "This key can't use read_document."
    assert listing.is_error and listing.text == "This key can't use list_documents."
