"""Phase 304-02 (KEY-03, KEY-04; D-11, D-12, D-28) — the MCP tool catalogue and the MCP URL.

The eight tool names, their groups, labels, companions and the three presets are ONE backend code
constant, served to the frontend through the API and never retyped. Pinned here:

  * exactly the eight D-11 names, in catalogue order, grouped read / ask / run;
  * ``get_answer`` travels with ``ask_agent``; ``list_workflows`` and ``get_workflow_run`` travel
    with ``run_workflow`` (D-12);
  * presets: Read only (the default), Read and ask, Read, ask and run workflows;
  * ``normalise_tool_selection`` adds companions, orders by the catalogue, and refuses an empty
    list, an unknown name and an orphaned companion, each with one plain sentence;
  * ``mcp_url()`` is ``BACKEND_PUBLIC_URL`` + ``MCP_PATH``, ``None`` when unset (D-28).
"""

from __future__ import annotations

import dataclasses
import pathlib
import re

import pytest

from app.services import mcp_tool_catalogue as cat

READ = ("search_knowledge_base", "list_documents", "read_document")
ASK = ("ask_agent", "get_answer")
RUN = ("list_workflows", "run_workflow", "get_workflow_run")


def test_the_catalogue_is_exactly_the_eight_names_in_order():
    assert tuple(t.name for t in cat.MCP_TOOLS) == READ + ASK + RUN
    assert cat.MCP_TOOL_NAMES == frozenset(READ + ASK + RUN)
    assert len(cat.MCP_TOOLS) == 8


def test_each_tool_carries_its_group():
    groups = {t.name: t.group for t in cat.MCP_TOOLS}
    assert {n for n, g in groups.items() if g == "read"} == set(READ)
    assert {n for n, g in groups.items() if g == "ask"} == set(ASK)
    assert {n for n, g in groups.items() if g == "run"} == set(RUN)


def test_the_companions_travel_with_their_leads():
    travels = {t.name: t.travels_with for t in cat.MCP_TOOLS}
    assert travels["get_answer"] == "ask_agent"
    assert travels["list_workflows"] == "run_workflow"
    assert travels["get_workflow_run"] == "run_workflow"
    others = set(READ) | {"ask_agent", "run_workflow"}
    assert all(travels[n] is None for n in others)


def test_every_tool_has_a_short_plain_label():
    for tool in cat.MCP_TOOLS:
        assert tool.label and len(tool.label) <= 60
        assert tool.label[0].isupper()
        assert "_" not in tool.label


def test_a_tool_is_a_frozen_value():
    with pytest.raises(dataclasses.FrozenInstanceError):
        cat.MCP_TOOLS[0].name = "x"  # type: ignore[misc]


def test_the_presets_and_their_default():
    assert list(cat.PRESETS) == ["read", "ask", "run"]
    assert cat.DEFAULT_PRESET == "read"
    assert tuple(cat.PRESETS["read"].tools) == READ
    assert tuple(cat.PRESETS["ask"].tools) == READ + ASK
    assert tuple(cat.PRESETS["run"].tools) == READ + ASK + RUN
    for preset in cat.PRESETS.values():
        assert preset.label


def test_a_preset_selection_normalises_to_itself():
    for preset in cat.PRESETS.values():
        out = cat.normalise_tool_selection(list(preset.tools))
        assert out.refusal is None
        assert out.tools == tuple(preset.tools)


def test_a_lead_brings_its_companions_in_catalogue_order():
    out = cat.normalise_tool_selection(["read_document", "ask_agent"])
    assert out.refusal is None
    assert out.tools == ("read_document", "ask_agent", "get_answer")
    out = cat.normalise_tool_selection(["run_workflow"])
    assert out.tools == ("list_workflows", "run_workflow", "get_workflow_run")


def test_duplicates_and_order_do_not_matter():
    out = cat.normalise_tool_selection(["read_document", "search_knowledge_base", "read_document"])
    assert out.tools == ("search_knowledge_base", "read_document")


def test_an_empty_selection_is_refused():
    out = cat.normalise_tool_selection([])
    assert out.tools is None
    assert out.refusal == "Tick at least one tool."


def test_an_unknown_name_is_refused_by_name():
    out = cat.normalise_tool_selection(["read_document", "delete_everything"])
    assert out.tools is None
    assert "delete_everything" in out.refusal


def test_an_orphaned_companion_is_refused_naming_its_lead():
    out = cat.normalise_tool_selection(["get_answer"])
    assert out.tools is None
    assert "ask_agent" in out.refusal
    out = cat.normalise_tool_selection(["read_document", "get_workflow_run"])
    assert out.tools is None
    assert "run_workflow" in out.refusal


# ── the MCP URL (D-28) ─────────────────────────────────────────────────────────────────────────


def _set_url(monkeypatch, value):
    from app.config import settings

    monkeypatch.setattr(settings, "backend_public_url", value, raising=False)


def test_the_url_is_the_public_base_plus_the_path(monkeypatch):
    _set_url(monkeypatch, "https://api.example.com/")
    assert cat.MCP_PATH == "/mcp"
    assert cat.mcp_url() == "https://api.example.com/mcp"


def test_a_path_prefixed_base_keeps_its_prefix(monkeypatch):
    _set_url(monkeypatch, "https://example.com/api")
    assert cat.mcp_url() == "https://example.com/api/mcp"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_an_unset_base_has_no_url(monkeypatch, value):
    _set_url(monkeypatch, value)
    assert cat.mcp_url() is None


def test_the_loopback_default_is_served_as_is(monkeypatch):
    # Decision pinned (D-28): with no request to compare against, the configured base is used even
    # when it is loopback — on a local stack, a client on the same machine reaches exactly this.
    # (_public_api_base swaps a loopback base for the request's own; mcp_url has no request.)
    _set_url(monkeypatch, "http://localhost:8000")
    assert cat.mcp_url() == "http://localhost:8000/mcp"


# ── purity ─────────────────────────────────────────────────────────────────────────────────────


def test_the_module_imports_nothing_from_the_app_at_top_level():
    src = pathlib.Path(cat.__file__).read_text(encoding="utf-8")
    assert not re.search(r"^(from app|import app)\b", src, re.M)
