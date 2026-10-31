"""Phase 305-02 (MCP-07; D-18 / D-20 / D-21 / D-23 / D-47; T-305-05 / T-305-09) — the static tools.

* ``REGISTERED`` is exactly the three read tools; each one's title IS the catalogue label
  (``mcp_tool_catalogue.MCP_TOOLS``, never retyped); all three carry the read-only annotations;
  input and output schemas are the Pydantic models' own ``model_json_schema()``; the limit bucket
  is ``expensive`` for search (it embeds the query) and ``cheap`` for the other two.
* ``tools/list`` through a fresh app: two principals with different grants get BYTE-EQUAL entries
  for every tool they share; a principal granted all eight catalogue names lists exactly the names
  the server SERVES; no title or description carries a fixture string (a folder name, a document
  title, a key label) — they are code constants (T-305-09).

306-04 (D-15) RETIRES this file's "exactly the three" pin DELIBERATELY (SEED-177: retire a fence on
purpose, never trip it by surprise): ``ask_agent`` and ``get_answer`` are now served, so the
registry holds five and a fully-granted key lists five. The three read tools' own definitions are
still pinned here unchanged; the two ask tools are pinned by ``test_306_tool_defs.py``. The 307
names (``list_workflows`` / ``run_workflow`` / ``get_workflow_run``) are still never listed.
* the dispatch render stage: a handler's model becomes ``structuredContent`` (validated against the
  same model) plus the text rendered from it; a handler's sentence becomes one ``isError`` block.
"""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from starlette.testclient import TestClient

from app.mcp import read_tools, results, tools
from app.services.mcp_tool_catalogue import MCP_TOOL_NAMES, MCP_TOOLS
from tests.unit import _mcp305_harness as h

THREE = ("search_knowledge_base", "list_documents", "read_document")
LABELS = {t.name: t.label for t in MCP_TOOLS}
FIXTURE_STRINGS = ("Contracts 2026", "Q3 revenue.pdf", "Fahad's laptop key", "304-03", "305-01", "zqx")


# 306-04 (D-15): the registry now SERVES the two ask tools after the three read tools.
SERVED = THREE + ("ask_agent", "get_answer")


def test_the_three_read_tools_lead_the_registry():
    assert tuple(tools.REGISTERED) == SERVED


@pytest.mark.parametrize("name", THREE)
def test_each_tool_is_static_and_labelled_from_the_catalogue(name):
    spec = tools.REGISTERED[name]
    t = spec.tool
    assert t.name == name
    assert t.title == LABELS[name]
    assert t.annotations == tools.READ_ONLY
    assert tools.is_read_only(spec)
    assert t.input_schema == spec.args_model.model_json_schema()
    assert t.description and len(t.description) < 400
    for needle in FIXTURE_STRINGS:
        assert needle not in t.description and needle not in t.title


def test_the_schemas_and_buckets():
    reg = tools.REGISTERED
    assert reg["search_knowledge_base"].args_model is results.SearchArgs
    assert reg["list_documents"].args_model is results.ListArgs
    assert reg["read_document"].args_model is results.ReadArgs
    assert reg["search_knowledge_base"].tool.output_schema == results.SearchResult.model_json_schema()
    assert reg["list_documents"].tool.output_schema == results.ListResult.model_json_schema()
    assert reg["read_document"].tool.output_schema == results.ReadResult.model_json_schema()
    assert {n: s.bucket for n, s in reg.items() if n in THREE} == {
        "search_knowledge_base": "expensive", "list_documents": "cheap", "read_document": "cheap"}
    assert reg["search_knowledge_base"].handler is read_tools.search_knowledge_base
    assert reg["list_documents"].handler is read_tools.list_documents
    assert reg["read_document"].handler is read_tools.read_document


def test_the_search_description_says_passages_are_quoted_content():
    d = tools.REGISTERED["search_knowledge_base"].tool.description.lower()
    assert "not instructions" in d


def _listed(monkeypatch, principal) -> list[dict]:
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(principal))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        r = h.list_tools(client)
    assert r.status_code == 200, r.text
    return r.json()["result"]["tools"]


def test_two_keys_see_byte_equal_definitions_for_the_tools_they_share(monkeypatch):
    a = replace(h.PRINCIPAL, key_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tools=THREE)
    b = replace(h.PRINCIPAL, key_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", folder_ids=("x",),
                include_external=True, tools=("read_document", "search_knowledge_base"))
    la = {t["name"]: json.dumps(t, sort_keys=True) for t in _listed(monkeypatch, a)}
    lb = {t["name"]: json.dumps(t, sort_keys=True) for t in _listed(monkeypatch, b)}
    assert list(la) == list(THREE)
    assert list(lb) == ["search_knowledge_base", "read_document"]
    for name in lb:
        assert la[name] == lb[name], name
    for blob in la.values():
        for needle in FIXTURE_STRINGS:
            assert needle not in blob


def test_a_key_granted_every_catalogue_tool_lists_only_the_served_names(monkeypatch):
    everything = replace(h.PRINCIPAL, tools=tuple(t.name for t in MCP_TOOLS))
    assert set(everything.tools) == MCP_TOOL_NAMES and len(everything.tools) == 8
    assert [t["name"] for t in _listed(monkeypatch, everything)] == list(SERVED)


def test_an_unregistered_307_name_is_a_protocol_error_even_when_granted(monkeypatch):
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(replace(h.PRINCIPAL, tools=tuple(MCP_TOOL_NAMES))))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        r = h.call(client, "run_workflow", {"workflow_id": "w"})
    assert r.json()["error"]["code"] == -32602


# ── the dispatch render stage ────────────────────────────────────────────────────────────────


def _register(monkeypatch, handler, args_model=h.NoArgs):
    spec = h.make_spec("t_read", handler, args_model=args_model)
    monkeypatch.setitem(tools.REGISTERED, "t_read", spec)


def test_a_model_becomes_structured_content_and_its_rendering(monkeypatch):
    model = results.SearchResult(passages=[results.Passage(
        document_id="5b0c1d2e-3f40-4a51-8b62-7c83d94ea5f6", title="Q", passage="body",
        citation=results.Citation(passage=1), link="https://app.example/app/library/x", origin="library")])

    async def handler(principal, args):
        return model

    _register(monkeypatch, handler)
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        result = h.call(client, "t_read").json()["result"]
    assert result["isError"] is False
    assert result["structuredContent"] == model.model_dump(mode="json")
    assert result["content"] == [{"type": "text", "text": results.render(model)}]


def test_a_sentence_becomes_one_error_block(monkeypatch):
    async def handler(principal, args):
        return read_tools.NOT_AVAILABLE_SENTENCE

    _register(monkeypatch, handler)
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        result = h.call(client, "t_read").json()["result"]
    assert result["isError"] is True
    assert result["content"] == [{"type": "text", "text": read_tools.NOT_AVAILABLE_SENTENCE}]
    assert "structuredContent" not in result or result["structuredContent"] is None


def test_the_sentences():
    assert read_tools.NOT_AVAILABLE_SENTENCE == "No document with that id is available to this key."
    assert read_tools.NO_TEXT_SENTENCE == "This document has no readable text yet."


# ── handler units over stubbed reads (the live suites drive the real reads) ─────────────────


class _Reads:
    """A stand-in for ``acting_member_reads`` recording what the handlers asked for."""

    def __init__(self, folders=(), docs=None, read=None, rows=()):
        self.folders, self.docs, self.read, self.rows = list(folders), docs or {}, read, list(rows)
        self.list_calls: list[dict] = []
        self.search_calls: list[dict] = []

    async def list_folders(self, principal):
        return self.folders

    async def list_documents(self, principal, **kw):
        self.list_calls.append(kw)
        items = self.docs.get(kw.get("folder_id"), [])
        off, lim = kw.get("offset", 0), kw.get("limit", 50)
        return {"items": items[off:off + lim], "total": len(items)}

    async def read_document(self, principal, document_id):
        return self.read if document_id == (self.read or {}).get("id") else None

    async def search(self, principal, query, *, user_settings=None):
        self.search_calls.append({"query": query, "top_k": user_settings.retrieval_top_k})
        return self.rows


F1, F2, F3 = ("aaaaaaaa-0000-4000-8000-00000000000%d" % i for i in (1, 2, 3))
D1 = "dddddddd-0000-4000-8000-000000000001"


@pytest.fixture
def fake_reads(monkeypatch):
    import app.config as config

    monkeypatch.setattr(config, "primary_frontend_origin", lambda: "https://app.example")

    def install(**kw):
        fake = _Reads(**kw)
        monkeypatch.setattr(read_tools, "reads", fake)
        return fake

    return install


async def test_the_top_level_is_visible_folders_whose_parent_is_not_visible(fake_reads):
    fake = fake_reads(folders=[
        {"id": F1, "name": "A", "parent_id": None},
        {"id": F2, "name": "B", "parent_id": F1},
        {"id": F3, "name": "C", "parent_id": "eeeeeeee-0000-4000-8000-000000000009"},  # parent hidden
    ], docs={None: [{"id": D1, "filename": "r.txt", "source_connection_id": None}]})
    out = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs())
    assert [f.folder_id for f in out.folders] == [F1, F3]
    assert [d.document_id for d in out.documents] == [D1]
    assert fake.list_calls[-1]["root_only"] is True and fake.list_calls[-1]["folder_id"] is None


async def test_a_narrowed_key_gets_no_root_documents(fake_reads):
    fake = fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None}], docs={None: [{"id": D1}]})
    out = await read_tools.list_documents(replace(h.PRINCIPAL, folder_ids=(F1,)), results.ListArgs())
    assert [f.folder_id for f in out.folders] == [F1] and out.documents == []
    assert fake.list_calls == []


async def test_a_folder_outside_the_visible_set_is_the_empty_page(fake_reads):
    fake = fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None}])
    out = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=F2))
    empty = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=F1))
    assert out == empty == results.ListResult(folders=[], documents=[], next_cursor=None)
    assert all(c["folder_id"] == F1 for c in fake.list_calls)


async def test_a_bad_list_cursor_is_refused_before_visibility(fake_reads):
    fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None}])
    for folder in (F1, F2):
        out = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=folder, cursor="garbage"))
        assert out == read_tools.BAD_CURSOR_SENTENCE


async def test_search_overrides_top_k_and_doubles_it_when_external_is_excluded(fake_reads, monkeypatch):
    from pydantic import BaseModel

    class _Settings(BaseModel):  # the one field the handler overrides
        retrieval_top_k: int = 5

    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: _Settings())
    rows = [{"document_id": D1, "filename": f"f{i}", "content": "c", "chunk_index": i,
             "source_connection_id": None, "version_number": 1} for i in range(10)]
    fake = fake_reads(rows=rows)
    out = await read_tools.search_knowledge_base(replace(h.PRINCIPAL, include_external=False),
                                                 results.SearchArgs(query="q", limit=4))
    assert fake.search_calls[-1]["top_k"] == 8 and len(out.passages) == 4
    await read_tools.search_knowledge_base(replace(h.PRINCIPAL, include_external=True),
                                           results.SearchArgs(query="q", limit=4))
    assert fake.search_calls[-1]["top_k"] == 4


async def test_read_refusals_are_one_sentence(fake_reads):
    fake_reads(read={"id": D1, "filename": "f", "full_markdown": "x" * 100, "source_connection_id": None})
    other = "dddddddd-0000-4000-8000-000000000002"
    assert await read_tools.read_document(h.PRINCIPAL, results.ReadArgs(document_id=other)) == \
        read_tools.NOT_AVAILABLE_SENTENCE
    for cursor in ("garbage", results.encode_read_cursor(other, 1), results.encode_read_cursor(D1, 101)):
        out = await read_tools.read_document(h.PRINCIPAL, results.ReadArgs(document_id=D1, cursor=cursor))
        assert out == read_tools.NOT_AVAILABLE_SENTENCE, cursor
    ok = await read_tools.read_document(h.PRINCIPAL, results.ReadArgs(document_id=D1))
    assert isinstance(ok, results.ReadResult) and ok.text == "x" * 100 and ok.next_cursor is None


# ── 305-REVIEW WR-06: subfolders past the 100th are paged, never silently dropped ─────────────


def _fid(i: int) -> str:
    return "f0f0f0f0-0000-4000-8000-%012d" % i


def _did(i: int) -> str:
    return "d0d0d0d0-0000-4000-8000-%012d" % i


async def _walk(principal, folder_id=None, limit=50, max_pages=50):
    """Follow ``next_cursor`` to the end; every folder and document id seen, in order."""
    folders, documents, cursor, pages = [], [], None, 0
    while True:
        out = await read_tools.list_documents(
            principal, results.ListArgs(folder_id=folder_id, cursor=cursor, limit=limit)
        )
        assert isinstance(out, results.ListResult), out
        pages += 1
        assert pages <= max_pages, "the listing never ended"
        assert len(out.folders) <= results.SUBFOLDER_CAP
        folders += [f.folder_id for f in out.folders]
        documents += [d.document_id for d in out.documents]
        if out.next_cursor is None:
            return folders, documents, pages
        cursor = out.next_cursor


async def test_more_than_a_hundred_top_level_folders_all_reach_a_page(fake_reads):
    tops = [{"id": _fid(i), "name": f"T{i}", "parent_id": None} for i in range(250)]
    fake_reads(folders=tops, docs={None: [{"id": _did(i), "filename": f"r{i}"} for i in range(30)]})
    folders, documents, pages = await _walk(h.PRINCIPAL)
    assert folders == [f["id"] for f in tops]  # all 250, each once, in order
    assert documents == [_did(i) for i in range(30)]
    assert pages == 3


async def test_more_than_a_hundred_subfolders_and_their_siblings_documents(fake_reads):
    subs = [{"id": _fid(i), "name": f"S{i}", "parent_id": F1} for i in range(130)]
    docs = [{"id": _did(i), "filename": f"d{i}"} for i in range(120)]
    fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None}, *subs], docs={F1: docs})
    folders, documents, _ = await _walk(h.PRINCIPAL, folder_id=F1, limit=50)
    assert folders == [s["id"] for s in subs]
    assert documents == [d["id"] for d in docs]


async def test_a_narrowed_key_pages_its_top_level_folders_too(fake_reads):
    tops = [{"id": _fid(i), "name": f"T{i}", "parent_id": None} for i in range(101)]
    fake = fake_reads(folders=tops)
    narrowed = replace(h.PRINCIPAL, folder_ids=tuple(f["id"] for f in tops))
    folders, documents, pages = await _walk(narrowed)
    assert folders == [f["id"] for f in tops] and documents == [] and pages == 2
    assert fake.list_calls == []  # still no Root documents for a narrowed key


async def test_a_hundred_folders_or_fewer_page_exactly_as_before(fake_reads):
    subs = [{"id": _fid(i), "name": f"S{i}", "parent_id": F1} for i in range(100)]
    docs = [{"id": _did(i), "filename": f"d{i}"} for i in range(60)]
    fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None}, *subs], docs={F1: docs})
    first = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=F1, limit=50))
    assert len(first.folders) == 100 and len(first.documents) == 50
    assert first.next_cursor == results.encode_list_cursor(F1, 50)  # the 305-02 cursor, byte-equal
    second = await read_tools.list_documents(
        h.PRINCIPAL, results.ListArgs(folder_id=F1, cursor=first.next_cursor, limit=50)
    )
    assert second.folders == [] and len(second.documents) == 10 and second.next_cursor is None


async def test_a_folder_page_cursor_is_bound_to_its_folder(fake_reads):
    subs = [{"id": _fid(i), "name": f"S{i}", "parent_id": F1} for i in range(150)]
    fake_reads(folders=[{"id": F1, "name": "A", "parent_id": None},
                        {"id": F2, "name": "B", "parent_id": None}, *subs])
    first = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=F1))
    assert first.next_cursor is not None
    for folder in (F2, None):
        out = await read_tools.list_documents(h.PRINCIPAL, results.ListArgs(folder_id=folder, cursor=first.next_cursor))
        assert out == read_tools.BAD_CURSOR_SENTENCE
