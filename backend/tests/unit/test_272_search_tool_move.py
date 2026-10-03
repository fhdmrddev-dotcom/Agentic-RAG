"""Phase 272-01 (D-15) — the ``search_documents`` handler moved out of ``tool_dispatcher.py``, proven.

The narrow cut: the handler (and, from 272-04, its D-09 retry lock) lives in
``search_documents_tool.py``; ``tool_dispatcher`` keeps the ONE registry line and re-exports the
handler under its old private name. The full registry/handler split stays OWED (→ Phase 273).

What this suite pins:

* the registry entry and the re-export are the SAME object as the moved handler, and the closed
  tool core still holds **29** tools (Extension Contract — widen arguments, never add a tool);
* the moved handler is AST-identical to ``_handle_search_documents`` at the plan's base commit,
  apart from its NAME and the function-local import that breaks the import cycle (its own test
  function, so 272-04 can retire it BY NAME when it rewrites the handler) — ⚠ RETIRED by 272-04,
  which rewrote the handler on purpose; the proof is kept as history at ``WAVE1_MERGE_SHA``;
* the new module has no module-level import of ``tool_dispatcher`` (that would cycle — the
  dispatcher imports this module at load);
* **patch-where-used**, driven both ways: a patch on the NEW module is hit, and a patch on the
  OLD ``td.search_documents`` alone is hit ZERO times — which is why every suite that patched the
  old name had to be retargeted in the same commit.
"""
from __future__ import annotations

import ast
import asyncio
import importlib
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

PLAN_BASE_SHA = "f49d9ea2d354a42d66eb007de9d9ca6a451afe81"

REPO_ROOT = Path(__file__).resolve().parents[3]

_TD_REL = "backend/app/services/tool_dispatcher.py"
_TOOL_REL = "backend/app/services/search_documents_tool.py"


def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 precedent): `text=True` alone decodes
    # with cp1252 here, these modules carry `⚠` / `—`, and the failure would be an unrelated
    # `AttributeError` on a `None` stdout.
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _tool():
    return importlib.import_module("app.services.search_documents_tool")


def _td():
    return importlib.import_module("app.services.tool_dispatcher")


def _top_level_function(src: str, name: str):
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    return None


def test_registry_and_reexport_are_the_moved_handler():
    td, tool = _td(), _tool()
    assert td._TOOL_REGISTRY["search_documents"] is tool.handle_search_documents
    assert td._handle_search_documents is tool.handle_search_documents
    assert len(td._TOOL_REGISTRY) == 29


# ⚠ RETIRED ON PURPOSE BY 272-04 (SEED-177: retire a fence DELIBERATELY, never trip it by surprise):
# `test_handler_ast_identical_to_base` stood here. It proved the handler in search_documents_tool.py
# was a VERBATIM move of PHASE_BASE's `_handle_search_documents` — and that proof HELD at 272-01's
# merge (WAVE1_MERGE_SHA, recorded in 272-03-SUMMARY.md). 272-04 then rewrites the handler on
# purpose (D-03 filters, D-09 retry lock, D-12 four result kinds + ONE audit writer, D-18 empty-set
# short-circuit, D-19 scope AND), so comparing HEAD to the base would now fail for the right reason.
# The pure-move proof is kept below as HISTORY against WAVE1_MERGE_SHA, and
# `test_handler_was_rewritten_after_the_move` proves the retirement was necessary (not vacuous).
WAVE1_MERGE_SHA = "020a0f41f7f9155783eb38790fef40e052bbcfcf"


def _blob_at(sha: str, rel_path: str) -> str:
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _normalised_handler(src: str):
    """The handler with its NAME normalised and the leading cycle-breaking imports stripped
    (asserted to be ONLY imports from ``app.services.tool_dispatcher``) — 272-01's normalisation."""
    fn = _top_level_function(src, "handle_search_documents")
    assert fn is not None, "handle_search_documents not found"
    # A leading docstring is dropped (272-04 added one; the WAVE1 blob has none, so this is a
    # no-op for the history proof) — so a comparison against a rewritten handler fails on the
    # BODY, never on the positive control below.
    if fn.body and isinstance(fn.body[0], ast.Expr) and isinstance(getattr(fn.body[0], "value", None), ast.Constant):
        fn.body.pop(0)
    stripped = []
    while fn.body and isinstance(fn.body[0], (ast.Import, ast.ImportFrom)):
        stripped.append(fn.body.pop(0))
    assert stripped, "POSITIVE CONTROL FAILED — no function-local cycle-breaking import found"
    for node in stripped:
        assert isinstance(node, ast.ImportFrom) and node.module == "app.services.tool_dispatcher", (
            f"a stripped leading statement is not an import from tool_dispatcher: {ast.dump(node)}"
        )
    fn.name = "_handle_search_documents"
    return fn


def test_handler_move_proven_at_wave1_merge():
    """History: at WAVE1_MERGE_SHA the moved handler == PHASE_BASE's, modulo name + the import."""
    base_fn = _top_level_function(_blob_at_base(_TD_REL), "_handle_search_documents")
    assert base_fn is not None, f"_handle_search_documents not found at {PLAN_BASE_SHA}"
    moved_fn = _normalised_handler(_blob_at(WAVE1_MERGE_SHA, _TOOL_REL))
    assert ast.dump(moved_fn) == ast.dump(base_fn), (
        f"at {WAVE1_MERGE_SHA} handle_search_documents was not a verbatim move of _handle_search_documents"
    )


def test_handler_was_rewritten_after_the_move():
    """Non-vacuity of the retirement: HEAD's handler is NOT the base handler any more (272-04)."""
    base_fn = _top_level_function(_blob_at_base(_TD_REL), "_handle_search_documents")
    head_fn = _normalised_handler((REPO_ROOT / _TOOL_REL).read_text(encoding="utf-8"))
    assert ast.dump(head_fn) != ast.dump(base_fn)


def test_no_module_level_import_of_tool_dispatcher():
    tree = ast.parse((REPO_ROOT / _TOOL_REL).read_text(encoding="utf-8"))
    offenders = []
    for node in tree.body:  # module-level statements ONLY
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.tool_dispatcher":
            offenders.append(ast.dump(node))
        if isinstance(node, ast.Import) and any(
            a.name == "app.services.tool_dispatcher" for a in node.names
        ):
            offenders.append(ast.dump(node))
    assert offenders == [], f"module-level tool_dispatcher import would cycle: {offenders}"


def _ctx():
    spawned: list = []
    return SimpleNamespace(
        current_user={"id": "user-1"},
        supabase=object(),
        user_settings=None,
        folder_subtree_ids=None,
        run_id="run-1",
        thread_id="thread-1",
        parent_run_id=None,
        spawn=spawned.append,
        has_connection_retrieval=False,
    ), spawned


def _drive(td, ctx, spawned):
    async def _runner():
        out = await td._handle_search_documents({"query": "q"}, ctx)
        for coro in spawned:
            await coro
        return out

    return asyncio.run(_runner())


def test_patch_where_used_new_target_is_hit(monkeypatch):
    td, tool = _td(), _tool()
    calls: list = []

    async def _rec(*a, **k):
        calls.append((a, k))
        return [], 0.0

    monkeypatch.setattr(tool, "search_documents", _rec)
    monkeypatch.setattr(tool, "write_audit_entry", AsyncMock())
    ctx, spawned = _ctx()
    out = _drive(td, ctx, spawned)
    assert len(calls) == 1
    assert out.result == "No relevant documents found."


def test_patch_where_used_old_target_alone_is_missed(monkeypatch):
    """Patching only ``td.search_documents`` no longer reaches the handler. The REAL
    ``search_documents`` runs instead — against stubbed infrastructure (the RPC call and the
    embedding), so nothing leaves the process — and the old-target recorder sees ZERO calls."""
    td, tool = _td(), _tool()
    rpc = importlib.import_module("app.services.retrieval_rpc")
    calls: list = []

    async def _rec(*a, **k):
        calls.append((a, k))
        return [], 0.0

    async def _no_rows(*a, **k):
        return []

    monkeypatch.setattr(td, "search_documents", _rec)
    monkeypatch.setattr(rpc, "_call_as_user", _no_rows)
    monkeypatch.setattr(rpc, "embed_texts", lambda *a, **k: [[0.25, 0.5]])
    monkeypatch.setattr(tool, "write_audit_entry", AsyncMock())
    ctx, spawned = _ctx()
    _drive(td, ctx, spawned)
    assert calls == []
