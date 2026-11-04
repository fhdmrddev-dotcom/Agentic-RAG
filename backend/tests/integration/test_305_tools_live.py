"""Phase 305-02 (MCP-02, MCP-03, MCP-07; D-13..D-18 / D-23 / D-41(2) / D-51) — the three tools, live.

A real minted key, presented as ``Authorization: Bearer`` to the real ``/mcp`` path in-process
(``phase305_mcp_client``), against the 304 two-org world (``phase304_fixtures.world``: U is a plain
member of X and Y; co-members own a shared folder and a private one). The query embedder is the
fixture's per-org stub (``patch_search``) and the member's settings are loaded with rerank off, so
no provider is called; every read, RLS rule and key scope is real.

* ``tools/list`` shows the three read tools, labelled read-only, titled with the catalogue labels.
* ``search_knowledge_base`` returns passages with title, citation, link and origin; a connector-fed
  passage reads ``origin: external`` on an include-external key and is ABSENT on one without.
* ``list_documents`` lists the top level (visible folders whose parent is not visible, plus Root
  documents for an all-folders key), a folder's subfolders then its documents, and pages to the end.
* ``read_document`` pages a long document by ``next_cursor`` and the pieces rejoin to the stored
  text; a document with no text answers the plain sentence.
* **D-16 / T-305-04**: missing, forbidden, other-org, out-of-scope, superseded, archived and
  malformed ids — and a tampered cursor — return BYTE-IDENTICAL JSON-RPC bodies (same id used for
  every call, so the whole body is compared, not just ``isError``).

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.mcp import read_tools, results
from app.services.mcp_tool_catalogue import MCP_TOOLS
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)
from tests.integration.phase305_mcp_client import mcp_session

pytestmark = requires_pg

THREE = ("search_knowledge_base", "list_documents", "read_document")
LABELS = {t.name: t.label for t in MCP_TOOLS}


@pytest.fixture
def searchable(world, monkeypatch):
    patch_search(monkeypatch, world)
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    return world


def _passage_docs(reply) -> list[str]:
    assert not reply.is_error, reply.text
    return [p["document_id"] for p in reply.structured["passages"]]


# ── tools/list ───────────────────────────────────────────────────────────────────────────────


async def test_tools_list_shows_the_three_labelled_read_only_tools(world, monkeypatch):
    secret = await world.mint()
    async with mcp_session(monkeypatch, secret) as call:
        tools = await call.list_tools()
    assert [t["name"] for t in tools] == list(THREE)
    for t in tools:
        assert t["title"] == LABELS[t["name"]]
        assert t["annotations"] == {"readOnlyHint": True, "destructiveHint": False,
                                    "idempotentHint": True, "openWorldHint": False}
        assert t["inputSchema"]["type"] == "object" and t["outputSchema"]["type"] == "object"


# ── search_knowledge_base ───────────────────────────────────────────────────────────────────


async def test_search_returns_titled_cited_linked_passages_with_external_marked(searchable, monkeypatch):
    w = searchable
    secret = await w.mint(include_external=True)
    async with mcp_session(monkeypatch, secret) as call:
        reply = await call.tool("search_knowledge_base", {"query": w.tok_x, "limit": 10})
    docs = _passage_docs(reply)
    assert w.ids("f_doc", "ext_doc", "root_x", "sx_doc") <= set(docs), docs
    assert w.docs["px_doc"] not in docs and w.docs["fy_doc"] not in docs  # private, other org
    filenames = {str(r["id"]): r["filename"] for r in await w.pool.fetch(
        "SELECT id, filename FROM public.documents WHERE id = ANY($1::uuid[])", [UUID(d) for d in docs])}
    by_doc = {p["document_id"]: p for p in reply.structured["passages"]}
    seeded = set(w.docs.values())
    for did, p in by_doc.items():
        if did not in seeded:
            continue  # only the fixture's own chunks have a known chunk_index
        assert p["title"] == filenames[did]
        assert p["link"] == results.doc_link(did) and p["link"].endswith(f"/app/library/{did}")
        assert p["citation"] == {"passage": 0}
        assert p["passage"]
        assert set(p) == {"document_id", "title", "passage", "citation", "link", "origin", "version_number"}
    assert by_doc[w.docs["ext_doc"]]["origin"] == "external"
    assert by_doc[w.docs["f_doc"]]["origin"] == "library"
    results.SearchResult.model_validate(reply.structured)
    assert reply.text.count(results.PASSAGE_OPEN) == len(docs)
    for did in docs:
        assert did in reply.text and results.doc_link(did) in reply.text


async def test_search_without_include_external_drops_the_connector_fed_passage(searchable, monkeypatch):
    w = searchable
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as call:
        assert w.docs["ext_doc"] in _passage_docs(await call.tool("search_knowledge_base", {"query": w.tok_x}))
    async with mcp_session(monkeypatch, await w.mint(include_external=False)) as call:
        docs = _passage_docs(await call.tool("search_knowledge_base", {"query": w.tok_x, "limit": 3}))
    assert w.docs["ext_doc"] not in docs
    assert len(docs) == 3  # 2 x limit was fetched, so the post-filter still fills the page


async def test_search_limit_is_honoured(searchable, monkeypatch):
    w = searchable
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as call:
        assert len(_passage_docs(await call.tool("search_knowledge_base", {"query": w.tok_x, "limit": 2}))) == 2


# ── list_documents ──────────────────────────────────────────────────────────────────────────


async def test_list_documents_top_level_then_a_folder(world, monkeypatch):
    w = world
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as call:
        top = await call.tool("list_documents", {})
        inside = await call.tool("list_documents", {"folder_id": w.f})
        empty = await call.tool("list_documents", {"folder_id": str(uuid4())})
    assert not top.is_error, top.text
    top_folders = {f["folder_id"] for f in top.structured["folders"]}
    assert {w.f, w.sx} <= top_folders
    assert w.f2 not in top_folders and w.px not in top_folders and w.fy not in top_folders
    top_docs = {d["document_id"] for d in top.structured["documents"]}
    assert w.docs["root_x"] in top_docs and w.docs["f_doc"] not in top_docs  # Root documents only

    assert [f["folder_id"] for f in inside.structured["folders"]] == [w.f2]
    assert {d["document_id"] for d in inside.structured["documents"]} == w.ids("f_doc", "ext_doc")
    ext = next(d for d in inside.structured["documents"] if d["document_id"] == w.docs["ext_doc"])
    assert ext["origin"] == "external" and ext["link"] == results.doc_link(w.docs["ext_doc"])
    assert empty.structured == {"folders": [], "documents": [], "next_cursor": None}
    results.ListResult.model_validate(inside.structured)


async def test_list_documents_pages_by_next_cursor_to_the_end(world, monkeypatch):
    w = world
    async with mcp_session(monkeypatch, await w.mint(include_external=True)) as call:
        first = await call.tool("list_documents", {"folder_id": w.f, "limit": 1})
        assert first.structured["next_cursor"], first.structured
        second = await call.tool("list_documents", {"folder_id": w.f, "limit": 1,
                                                     "cursor": first.structured["next_cursor"]})
        forged = await call.tool("list_documents", {"folder_id": w.f2, "limit": 1,
                                                     "cursor": first.structured["next_cursor"]})
    assert [f["folder_id"] for f in first.structured["folders"]] == [w.f2]
    assert second.structured["folders"] == []  # subfolders come with the first page only
    assert second.structured["next_cursor"] is None
    paged = {d["document_id"] for page in (first, second) for d in page.structured["documents"]}
    assert paged == w.ids("f_doc", "ext_doc")
    assert forged.is_error  # a cursor for folder F presented for F2


# ── read_document ───────────────────────────────────────────────────────────────────────────


async def test_read_document_pages_a_long_document_and_rejoins(world, monkeypatch):
    w = world
    para = "The northern region grew revenue by twelve percent. " * 30
    body = "\n\n".join(f"## Section {i}\n{para}" for i in range(20)) + "\nSee ![map](https://x.test/m.png)."
    assert len(body) > 3 * results.READ_BUDGET
    await w.pool.execute("UPDATE public.documents SET full_markdown = $1 WHERE id = $2", body,
                         UUID(w.docs["f_doc"]))
    pieces, cursor, calls = [], None, 0
    async with mcp_session(monkeypatch, await w.mint()) as call:
        while True:
            args = {"document_id": w.docs["f_doc"]} | ({"cursor": cursor} if cursor else {})
            reply = await call.tool("read_document", args)
            assert not reply.is_error, reply.text
            s = reply.structured
            assert s["total_chars"] == len(body) and s["offset"] == sum(len(p) for p in pieces)
            pieces.append(body[s["offset"]:s["end"]])
            assert len(pieces[-1]) <= results.READ_BUDGET
            assert s["title"] and s["link"] == results.doc_link(w.docs["f_doc"]) and s["origin"] == "library"
            calls += 1
            cursor = s["next_cursor"]
            if cursor is None:
                break
            assert calls < 20
    assert "".join(pieces) == body
    assert calls >= 4
    assert "[image: map]" in reply.structured["text"] and "x.test" not in reply.structured["text"]


async def test_a_document_with_no_text_answers_the_plain_sentence(world, monkeypatch):
    w = world
    await w.pool.execute("UPDATE public.documents SET full_markdown = NULL WHERE id = $1", UUID(w.docs["f2_doc"]))
    async with mcp_session(monkeypatch, await w.mint()) as call:
        reply = await call.tool("read_document", {"document_id": w.docs["f2_doc"]})
    assert reply.is_error and reply.text == read_tools.NO_TEXT_SENTENCE


# ── D-16: one identical refusal ─────────────────────────────────────────────────────────────


async def test_every_unavailable_document_gets_byte_identical_bodies(world, monkeypatch):
    w = world
    await w.pool.execute("UPDATE public.documents SET full_markdown = $1 WHERE id = $2",
                         "readable text " * 2000, UUID(w.docs["f_doc"]))
    arch = await w.doc("arch_doc", w.u, w.x, folder=w.f)
    await w.pool.execute("UPDATE public.documents SET archived_at = now() WHERE id = $1", UUID(arch))
    assert await w.pool.fetchval("SELECT retrievable FROM public.documents WHERE id = $1", UUID(arch)) is False

    wide = await w.mint(include_external=True)
    narrowed = await w.mint(folder_ids=[w.f2])
    cases = {
        "missing": (wide, str(uuid4())),
        "forbidden (a co-member's private document)": (wide, w.docs["px_doc"]),
        "other org": (wide, w.docs["fy_doc"]),
        "out of the key's scope": (narrowed, w.docs["root_x"]),
        "superseded": (wide, w.docs["old_x"]),
        "archived": (wide, arch),
        "malformed": (wide, "not-a-uuid"),
    }
    bodies: dict[str, bytes] = {}
    for label, (secret, did) in cases.items():
        async with mcp_session(monkeypatch, secret) as call:
            reply = await call.tool("read_document", {"document_id": did})
        assert reply.is_error and reply.text == read_tools.NOT_AVAILABLE_SENTENCE, (label, reply.text)
        bodies[label] = reply.raw

    async with mcp_session(monkeypatch, wide) as call:
        good = await call.tool("read_document", {"document_id": w.docs["f_doc"]})
        assert not good.is_error and good.structured["next_cursor"]  # non-vacuity: the key reads
        tampered = good.structured["next_cursor"][:-4] + "AAAA"
        foreign = results.encode_read_cursor(w.docs["root_x"], 10)  # another document's cursor
        for label, cursor in (("tampered cursor", tampered), ("another document's cursor", foreign)):
            reply = await call.tool("read_document", {"document_id": w.docs["f_doc"], "cursor": cursor})
            bodies[label] = reply.raw
        # root_x has no stored text: the key reaches it (NO_TEXT, never the not-available sentence)
        root = await call.tool("read_document", {"document_id": w.docs["root_x"]})
        assert root.text == read_tools.NO_TEXT_SENTENCE, root.text

    distinct = set(bodies.values())
    assert len(distinct) == 1, {k: v[:200] for k, v in bodies.items()}
    print(f"\n[305-02 D-16] {len(bodies)} cases, one body: {next(iter(distinct)).decode()}")
