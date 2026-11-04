"""Phase 307-03 (D-13 / D-36 / T-307-25) — the ONE MCP narrowing validator, moved out of the key route.

``_create_mcp_key`` used to refuse an MCP key inline: the switches (403), the tool selection (422)
and the folders (422), in that order. The consent approve route must refuse a grant by exactly the
same rules, so the block moved VERBATIM into ``app/services/mcp_narrowing.py`` and both callers use
it. This suite is the move fence:

* the module exists, exports the three names, and imports no FastAPI (a service, not a route);
* ``api_keys.py`` calls it exactly once, inside ``_create_mcp_key``, and maps a refusal to the SAME
  status and detail (``test_304_api_keys_routes.py`` passes unedited — the pass list before and after
  this plan is recorded in the 307-03 SUMMARY);
* the sentences moved with it and ``api_keys`` re-exports the SAME objects;
* the order is kept: a switch refusal wins over a bad tool pick, which wins over a bad folder pick.
"""
from __future__ import annotations

import ast
import asyncio
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
NARROWING = BACKEND / "app" / "services" / "mcp_narrowing.py"
API_KEYS = BACKEND / "app" / "api" / "api_keys.py"

ORG = "44444444-4444-4444-8444-444444444444"
USER = "33333333-3333-4333-8333-333333333333"
F_OK = "f0000000-0000-4000-8000-000000000001"
F_NO = "f0000000-0000-4000-8000-0000000000ff"


def _run(coro):
    return asyncio.run(coro)


def test_the_module_exists_and_imports_no_fastapi():
    src = NARROWING.read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            assert not (node.module or "").startswith("fastapi"), node.module
        if isinstance(node, ast.Import):
            assert not any(a.name.startswith("fastapi") for a in node.names)
    from app.services import mcp_narrowing as n

    for name in ("validate_mcp_narrowing", "NarrowingOk", "NarrowingRefusal"):
        assert hasattr(n, name), name


def test_api_keys_calls_it_once_inside_create_mcp_key():
    src = API_KEYS.read_text(encoding="utf-8")
    assert src.count("validate_mcp_narrowing(") == 1
    tree = ast.parse(src)
    fn = next(
        n for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_create_mcp_key"
    )
    calls = [
        c for c in ast.walk(fn)
        if isinstance(c, ast.Call) and getattr(c.func, "id", None) == "validate_mcp_narrowing"
    ]
    assert len(calls) == 1
    # The inline block is gone: no switch read and no tool normalisation left in the route.
    body = ast.get_source_segment(src, fn) or ""
    assert "mcp_switches(" not in body
    assert "normalise_tool_selection(" not in body


def test_the_sentences_moved_and_are_re_exported_as_the_same_objects():
    from app.api import api_keys as route
    from app.services import mcp_narrowing as n

    assert route._FOLDER_NOT_VISIBLE is n._FOLDER_NOT_VISIBLE
    assert route.MCP_STATE_UNKNOWN_SENTENCE is n.MCP_STATE_UNKNOWN_SENTENCE
    assert route._mcp_off is n.mcp_off
    assert n._FOLDER_NOT_VISIBLE == "One of the picked folders can't be found, or you can't see it."


@pytest.fixture
def world(monkeypatch):
    from app.services import mcp_narrowing as n

    state = {"switches": {"org_on": True, "deploy_on": True, "org_name": "Acme"}, "visible_reads": []}

    async def mcp_switches(pool, org_id):
        return state["switches"]

    async def visible(user_id, org_id):
        state["visible_reads"].append((user_id, org_id))
        return {F_OK}

    monkeypatch.setattr(n.api_keys_db, "mcp_switches", mcp_switches)
    monkeypatch.setattr(n, "acting_visible_folder_ids", visible)
    return state


def _validate(**kw):
    from app.services.mcp_narrowing import validate_mcp_narrowing

    args = {"caller": USER, "org": ORG, "tools": ["search_knowledge_base"], "folder_ids": None}
    args.update(kw)
    return _run(validate_mcp_narrowing(object(), **args))


@pytest.mark.parametrize("switches, sentence_name", [
    (None, "MCP_STATE_UNKNOWN_SENTENCE"),
    ({"org_on": True, "deploy_on": False}, "MCP_OFF_DEPLOYMENT_SENTENCE"),
    ({"org_on": False, "deploy_on": True}, "MCP_OFF_ORG_SENTENCE"),
    ({"org_on": False, "deploy_on": None}, "MCP_OFF_DEPLOYMENT_SENTENCE"),
])
def test_a_switch_refusal_is_403_with_the_304_sentence(world, switches, sentence_name):
    from app.services import mcp_narrowing as n
    from app.services.mcp_narrowing import NarrowingRefusal

    world["switches"] = switches
    # Order: the switch wins even over an empty tool pick and an unseen folder.
    r = _validate(tools=[], folder_ids=[F_NO])
    assert isinstance(r, NarrowingRefusal)
    assert r.status == 403
    assert r.detail == getattr(n, sentence_name)
    assert world["visible_reads"] == []


@pytest.mark.parametrize("tools", [[], ["no_such_tool"]])
def test_a_bad_tool_pick_is_422_with_the_catalogue_sentence(world, tools):
    from app.services.mcp_narrowing import NarrowingRefusal
    from app.services.mcp_tool_catalogue import normalise_tool_selection

    r = _validate(tools=tools, folder_ids=[F_NO])
    assert isinstance(r, NarrowingRefusal)
    assert (r.status, r.detail) == (422, normalise_tool_selection(tools).refusal)
    assert world["visible_reads"] == []  # tools before folders


def test_an_unseen_folder_is_422_read_on_the_members_own_visibility(world):
    from app.services.mcp_narrowing import _FOLDER_NOT_VISIBLE, NarrowingRefusal

    r = _validate(folder_ids=[F_OK, F_NO])
    assert isinstance(r, NarrowingRefusal)
    assert (r.status, r.detail) == (422, _FOLDER_NOT_VISIBLE)
    assert world["visible_reads"] == [(USER, ORG)]


def test_a_valid_pick_is_ok_with_companions_and_string_folders(world):
    from app.services.mcp_narrowing import NarrowingOk
    from app.services.mcp_tool_catalogue import normalise_tool_selection

    r = _validate(folder_ids=[F_OK])
    assert isinstance(r, NarrowingOk)
    assert r.tools == normalise_tool_selection(["search_knowledge_base"]).tools
    assert r.folder_ids == [F_OK]
    assert r.switches == world["switches"]
    r2 = _validate(folder_ids=None)
    assert isinstance(r2, NarrowingOk) and r2.folder_ids is None


def test_an_injected_folder_reader_is_used_instead_of_the_default(world):
    from app.services.mcp_narrowing import NarrowingOk

    seen = []

    async def reader(user_id, org_id):
        seen.append((user_id, org_id))
        return {F_NO}

    r = _validate(folder_ids=[F_NO], visible_folders=reader)
    assert isinstance(r, NarrowingOk)
    assert seen == [(USER, ORG)] and world["visible_reads"] == []
