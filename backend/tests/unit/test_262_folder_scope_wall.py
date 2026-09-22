"""262-UAT row 3.5 — a folder-limited run's file tools must stay inside its folders.

Driven live 2026-09-22: in a RESTRICTED Expert thread, ``search_documents`` and
``query_documents`` returned nothing (correct — the only bound folder was not visible to the
caller), and then ``grep`` searched ALL 75 library documents and listed files from the root
and from unrelated folders. ``glob`` and ``search_documents`` already honour
``ctx.folder_subtree_ids``; ``grep``, ``ls``, ``tree``, ``read_document`` and
``analyze_document`` did not — and a model-supplied ``path: "/"`` or document id bypassed the
default path entirely.

Operator ruling (2026-09-23): the wall applies to EVERY folder-limited run — Restricted and
Union Experts and folder-pinned chats alike — because ``folder_subtree_ids`` is the one scope
channel all of them share. ``folder_subtree_ids is None`` (an unscoped chat) stays
byte-identical: every case below has an unscoped POSITIVE CONTROL.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services import tool_dispatcher as td

IN = "folder-in"
OUT = "folder-out"


def _ctx(scope: list[str] | None) -> SimpleNamespace:
    return SimpleNamespace(
        folder_subtree_ids=scope,
        scoped_folder_path=None,
        current_user={"id": "user-1"},
        supabase=object(),
    )


def _doc_folders(mapping: dict[str, str | None]):
    """Patch the ONE folder lookup the wall uses, keyed by document id."""
    async def _lookup(ctx, doc_ids):
        return {d: mapping.get(d) for d in doc_ids if d in mapping}
    return patch.object(td, "_document_folder_ids", side_effect=_lookup)


# ── grep ─────────────────────────────────────────────────────────────────────────
GREP_RESULT = {
    "pattern": "risk",
    "path": None,
    "matches": [
        {"document_id": "d-in", "filename": "in.md", "folder_id": IN},
        {"document_id": "d-out", "filename": "out.md", "folder_id": OUT},
        {"document_id": "d-root", "filename": "root.md", "folder_id": None},
    ],
    "total": 3,
}


@pytest.mark.asyncio
async def test_grep_keeps_only_in_scope_matches_even_for_path_root():
    with patch.object(td, "grep_path", AsyncMock(return_value=json.loads(json.dumps(GREP_RESULT)))):
        res = json.loads((await td._handle_grep({"pattern": "risk", "path": "/"}, _ctx([IN]))).result)
    assert [m["document_id"] for m in res["matches"]] == ["d-in"]
    assert res["total"] == 1


@pytest.mark.asyncio
async def test_grep_empty_scope_returns_nothing():
    # The live 3.5 shape: the Expert's only folder was invisible, so the scope is EMPTY.
    with patch.object(td, "grep_path", AsyncMock(return_value=json.loads(json.dumps(GREP_RESULT)))):
        res = json.loads((await td._handle_grep({"pattern": "risk"}, _ctx([]))).result)
    assert res["matches"] == [] and res["total"] == 0


@pytest.mark.asyncio
async def test_grep_unscoped_is_unchanged():
    with patch.object(td, "grep_path", AsyncMock(return_value=json.loads(json.dumps(GREP_RESULT)))):
        res = json.loads((await td._handle_grep({"pattern": "risk"}, _ctx(None))).result)
    assert res["total"] == 3


# ── ls ───────────────────────────────────────────────────────────────────────────
LS_RESULT = {
    "path": "/",
    "folders": [{"id": IN, "name": "In"}, {"id": OUT, "name": "Out"}],
    "documents": [{"id": "d-in", "filename": "in.md"}, {"id": "d-root", "filename": "root.md"}],
}


@pytest.mark.asyncio
async def test_ls_hides_out_of_scope_folders_and_documents():
    with patch.object(td, "ls_path", AsyncMock(return_value=json.loads(json.dumps(LS_RESULT)))), \
         _doc_folders({"d-in": IN, "d-root": None}):
        res = json.loads((await td._handle_ls({"path": "/"}, _ctx([IN]))).result)
    assert [f["id"] for f in res["folders"]] == [IN]
    assert [d["id"] for d in res["documents"]] == ["d-in"]


@pytest.mark.asyncio
async def test_ls_unscoped_is_unchanged():
    with patch.object(td, "ls_path", AsyncMock(return_value=json.loads(json.dumps(LS_RESULT)))):
        res = json.loads((await td._handle_ls({"path": "/"}, _ctx(None))).result)
    assert len(res["folders"]) == 2 and len(res["documents"]) == 2


# ── tree ─────────────────────────────────────────────────────────────────────────
def _node(fid, docs=(), children=()):
    return {"id": fid, "name": fid, "type": "folder", "is_org_shared": False, "truncated": False,
            "children": list(children), "documents": [{"id": d, "filename": d} for d in docs]}


TREE_RESULT = {
    "path": "/", "depth": None,
    "tree": [
        _node("parent", docs=["d-parent"], children=[_node(IN, docs=["d-in"])]),
        _node(OUT, docs=["d-out"]),
    ],
}


@pytest.mark.asyncio
async def test_tree_prunes_to_scope_but_keeps_the_path_to_it():
    with patch.object(td, "tree_path", AsyncMock(return_value=json.loads(json.dumps(TREE_RESULT)))):
        res = json.loads((await td._handle_tree({"path": "/"}, _ctx([IN]))).result)
    assert [n["id"] for n in res["tree"]] == ["parent"]
    parent = res["tree"][0]
    assert parent["documents"] == []                      # the ancestor's own docs are NOT in scope
    assert [c["id"] for c in parent["children"]] == [IN]
    assert [d["id"] for d in parent["children"][0]["documents"]] == ["d-in"]


@pytest.mark.asyncio
async def test_tree_unscoped_is_unchanged():
    with patch.object(td, "tree_path", AsyncMock(return_value=json.loads(json.dumps(TREE_RESULT)))):
        res = json.loads((await td._handle_tree({"path": "/"}, _ctx(None))).result)
    assert res == TREE_RESULT


# ── read_document / analyze_document ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_read_document_refuses_an_out_of_scope_id():
    read = AsyncMock(return_value={"content": "secret"})
    with patch.object(td, "read_path", read), _doc_folders({"d-out": OUT}):
        res = json.loads((await td._handle_read_document({"document_id": "d-out"}, _ctx([IN]))).result)
    assert res.get("error_kind") == "out_of_scope"
    read.assert_not_awaited()


@pytest.mark.asyncio
async def test_read_document_allows_an_in_scope_id():
    read = AsyncMock(return_value={"content": "ok"})
    with patch.object(td, "read_path", read), _doc_folders({"d-in": IN}):
        res = json.loads((await td._handle_read_document({"document_id": "d-in"}, _ctx([IN]))).result)
    assert res == {"content": "ok"}


@pytest.mark.asyncio
async def test_read_document_unscoped_never_looks_up_folders():
    read = AsyncMock(return_value={"content": "ok"})
    with patch.object(td, "read_path", read), \
         patch.object(td, "_document_folder_ids", AsyncMock()) as lookup:
        await td._handle_read_document({"document_id": "d-any"}, _ctx(None))
    lookup.assert_not_awaited()
    read.assert_awaited_once()


@pytest.mark.asyncio
async def test_analyze_document_refuses_an_out_of_scope_file():
    fetch = AsyncMock(return_value={"filename": "out.md", "full_markdown": "secret"})
    with patch.object(td, "resolve_document_id", AsyncMock(return_value="d-out")), \
         patch.object(td, "fetch_full_document", fetch), _doc_folders({"d-out": OUT}):
        res = await td._handle_analyze_document({"filename": "out.md", "query": "q"}, _ctx([IN]))
    assert "outside the folders this chat is limited to" in res.result
    fetch.assert_not_awaited()


# ── fetch_document_file / attach_skill_file — the byte path (v4.3 audit) ─────────────
# Both reach a document's ORIGINAL bytes through `_fetch_owned_document_bytes`, which was
# owner→global scoped only and never consulted the folder wall. The wall now sits at the
# top of that ONE helper, so both callers (and any future one) inherit it.

class _NoStorage:
    """Any storage/table read means the wall let the id through."""
    def table(self, *_a, **_k):
        raise AssertionError("document bytes were resolved for an out-of-scope id")


def _byte_ctx(scope):
    return SimpleNamespace(
        folder_subtree_ids=scope, scoped_folder_path=None,
        current_user={"id": "user-1"}, supabase=_NoStorage(), thread_id="t-1",
    )


@pytest.mark.asyncio
async def test_fetch_owned_bytes_refuses_an_out_of_scope_document():
    with _doc_folders({"d-out": OUT}):
        res = await td._fetch_owned_document_bytes(_byte_ctx([IN]), "d-out")
    assert isinstance(res, dict) and res.get("error_kind") == "out_of_scope"


@pytest.mark.asyncio
async def test_fetch_document_file_tool_refuses_an_out_of_scope_document():
    with _doc_folders({"d-out": OUT}):
        out = await td._handle_fetch_document_file({"document_id": "d-out"}, _byte_ctx([IN]))
    assert json.loads(out.result).get("error_kind") == "out_of_scope"


@pytest.mark.asyncio
async def test_fetch_owned_bytes_unscoped_never_consults_the_wall():
    lookup = AsyncMock(return_value={})
    with patch.object(td, "_document_folder_ids", lookup):
        try:
            await td._fetch_owned_document_bytes(_byte_ctx(None), "d-any")
        except AssertionError:
            pass  # reached storage — the normal (unscoped) path, as intended
        except Exception:
            pass
    lookup.assert_not_called()
