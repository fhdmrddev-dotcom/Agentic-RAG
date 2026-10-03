"""Phase 272-04 Task 3 (D-02 / D-05 / D-07 / D-16 / D-22 / D-23 / D-26) — the model is told enough to filter.

A filter the model never emits is a filter that does not exist. So every Deep run:

* tells the model **today's date** (UTC) and that a month without a year means the most recent
  completed one, stated as a range in the answer (D-07 — measured: no date reached the agent before);
* lists, in ``search_documents``' ``filters`` description, the caller's **enabled field definitions**
  (own + system-global, ``list_field_definitions`` unchanged — D-26) with types and enum options,
  plus the **top 15 document types** (D-23); and
* drops the old *"only add metadata_filter when explicitly asked … never guess filter values"*
  guidance (D-02), and rewrites the *"do not stop on zero results"* fallbacks so they apply only to
  UNFILTERED searches: a filtered search that matched nothing is a final answer (D-22).

``agent_loop.py`` is honoured by construction (D-16): the source fences below pin exactly which
lines it gained. ``task_service``'s sub-agent ToolContext SHARES the lock set by reference (A5):
its construction sits inside the live sub-agent runner (it needs a run, a semaphore and an emit
channel), so the source fence is the proof here, as the plan allows.
"""
from __future__ import annotations

import copy
import inspect
import json
import pathlib
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import app.services.search_documents_tool as sdt
from app.services.openai_service import SEARCH_DOCUMENTS_TOOL, get_tools

SERVICES = pathlib.Path(sdt.__file__).parent
SETTINGS = SimpleNamespace(web_search_enabled=False, sandbox_enabled=False, self_improve_enabled=True)

ENUM = {"field_key": "legal_entity", "field_type": "enum", "options": ["Acme GmbH", "Beta Ltd"], "enabled": True}


def _filters_desc(tools) -> str:
    entry = next(t for t in tools if t["function"]["name"] == "search_documents")
    return entry["function"]["parameters"]["properties"]["filters"]["description"]


# ── today_line (D-07) ────────────────────────────────────────────────────────────────────────────


def test_today_line_states_the_date_and_the_month_rule():
    assert sdt.today_line(now=datetime(2026, 10, 3, tzinfo=timezone.utc)) == (
        "\n\nToday's date is 2026-10-03 (UTC). When a question names a month or quarter without a "
        "year, use the most recent completed one before today and state the resolved date range in "
        "your answer."
    )


def test_today_line_defaults_to_the_server_utc_clock():
    line = sdt.today_line()
    assert datetime.now(timezone.utc).date().isoformat() in line


# ── with_search_vocabulary (D-02 / D-23 / D-26) ──────────────────────────────────────────────────


def test_no_vocabulary_keeps_the_default_tools_signal():
    assert sdt.with_search_vocabulary(None, SETTINGS, None) is None
    assert sdt.with_search_vocabulary(None, SETTINGS, sdt.SearchVocabulary(fields=(), document_types=())) is None
    tools = [{"type": "function", "function": {"name": "x"}}]
    assert sdt.with_search_vocabulary(tools, SETTINGS, None) is tools


def test_the_vocabulary_is_written_into_a_copy_of_the_search_tool():
    before = copy.deepcopy(SEARCH_DOCUMENTS_TOOL)
    vocab = sdt.SearchVocabulary(fields=(ENUM,), document_types=(("report", 12), ("contract", 3)))
    out = sdt.with_search_vocabulary(None, SETTINGS, vocab)

    base = get_tools(SETTINGS)
    assert [t["function"]["name"] for t in out] == [t["function"]["name"] for t in base]
    for got, want in zip(out, base):
        if want["function"]["name"] != "search_documents":
            assert got is want
    desc = _filters_desc(out)
    assert "Fields for this workspace: legal_entity (enum: Acme GmbH, Beta Ltd)" in desc
    assert "Common document types: report, contract" in desc
    assert SEARCH_DOCUMENTS_TOOL == before, "the module constant must never be mutated"
    assert _filters_desc(get_tools(SETTINGS)) == before["function"]["parameters"]["properties"]["filters"]["description"]


def test_a_given_tool_list_is_substituted_in_place_order_preserved():
    connector = {"type": "function", "function": {"name": "github__search"}}
    tools = list(get_tools(SETTINGS)) + [connector]
    names = [t["function"]["name"] for t in tools]
    out = sdt.with_search_vocabulary(tools, SETTINGS, sdt.SearchVocabulary(fields=(ENUM,), document_types=()))
    assert out is not tools
    assert [t["function"]["name"] for t in out] == names
    assert out[-1] is connector
    assert "legal_entity (enum" in _filters_desc(out)
    assert "legal_entity" not in _filters_desc(tools)


def test_caps_disabled_defs_and_date_word_collisions():
    defs = tuple(
        {"field_key": f"f{i:02d}", "field_type": "string", "options": None, "enabled": True} for i in range(25)
    ) + (
        {"field_key": "zz_off", "field_type": "string", "options": None, "enabled": False},
        {"field_key": "added", "field_type": "string", "options": None, "enabled": True},
    )
    types = tuple((f"t{i:02d}", 100 - i) for i in range(20))
    desc = _filters_desc(sdt.with_search_vocabulary(None, SETTINGS, sdt.SearchVocabulary(fields=defs, document_types=types)))
    assert "f19 (string)" in desc and "f20" not in desc
    assert "…and 5 more; an unknown field is answered with the full list" in desc
    assert "zz_off" not in desc
    assert "added (string)" not in desc
    assert "`added`" in desc and "date word" in desc
    assert "t14" in desc and "t15" not in desc

    many = {"field_key": "region", "field_type": "enum", "options": [f"r{i:02d}" for i in range(30)], "enabled": True}
    desc = _filters_desc(sdt.with_search_vocabulary(None, SETTINGS, sdt.SearchVocabulary(fields=(many,), document_types=())))
    assert "r24" in desc and "r25" not in desc and "…and 5 more" in desc


# ── load_search_vocabulary ───────────────────────────────────────────────────────────────────────


async def test_load_search_vocabulary_reads_defs_and_types(monkeypatch):
    seen: dict = {}

    async def _defs(user_id, supabase=None):
        seen["defs"] = (user_id, supabase)
        return [ENUM]

    async def _types(*, user_id, limit=15):
        seen["types"] = (user_id, limit)
        return [("report", 12)]

    monkeypatch.setattr(sdt, "list_field_definitions", _defs)
    monkeypatch.setattr(sdt, "top_document_types", _types)
    sb = object()
    vocab = await sdt.load_search_vocabulary("user-1", sb)
    assert vocab.fields == (ENUM,) and vocab.document_types == (("report", 12),)
    assert seen == {"defs": ("user-1", sb), "types": ("user-1", 15)}


async def test_a_vocabulary_failure_never_breaks_chat(monkeypatch):
    async def _boom(*a, **k):
        raise RuntimeError("db down")

    monkeypatch.setattr(sdt, "list_field_definitions", _boom)
    assert await sdt.load_search_vocabulary("user-1", object()) is None


# ── SYSTEM_PROMPT (D-02 / D-05 / D-22) ───────────────────────────────────────────────────────────


def _prompt() -> str:
    from app.services.agent_loop import SYSTEM_PROMPT

    return SYSTEM_PROMPT


def _paragraph(prompt: str, head: str) -> str:
    i = prompt.index(head)
    return prompt[i:prompt.index("\n", i)]


def test_the_old_filter_guidance_is_gone():
    p = _prompt()
    assert "Only add `metadata_filter`" not in p
    assert "never guess filter values" not in p


def test_the_prompt_tells_the_model_to_filter():
    p = _prompt()
    rule = _paragraph(p, "- **search_documents**")
    assert "`filters`" in rule and "period" in rule
    assert "document's own date" in p
    for word in ("uploaded", "created", "modified"):
        assert word in p


def test_a_filtered_empty_result_is_final():
    p = _prompt()
    rule = _paragraph(p, "- **A filtered search that matched no documents is a final answer")
    for needle in ("cite nothing", "without the filter", "grep", "query_documents", "read_document", "analyze_document"):
        assert needle in rule, needle


def test_the_zero_result_fallbacks_apply_only_to_unfiltered_searches():
    p = _prompt()
    assert "unfiltered" in _paragraph(p, "**Hybrid fallback")
    assert "unfiltered" in _paragraph(p, "- **Zero results from search_documents")


# ── agent_loop source fences (D-16, honoured by construction) ────────────────────────────────────


def _agent_loop_src() -> str:
    return (SERVICES / "agent_loop.py").read_text(encoding="utf-8")


def test_agent_loop_gains_exactly_the_planned_lines():
    src = _agent_loop_src()
    assert src.count("today_line(") == 1
    assert src.index("today_line(") > src.index("active_system_prompt = SYSTEM_PROMPT")
    assert src.count("with_search_vocabulary(") == 1
    assert src.count("_empty_filter_fields_in_run: set[str] = set()") == 1
    assert src.count("empty_filter_fields_in_run=_empty_filter_fields_in_run") == 2


def test_task_service_shares_the_lock_by_reference():
    src = (SERVICES / "task_service.py").read_text(encoding="utf-8")
    assert src.count("empty_filter_fields_in_run=parent_ctx.empty_filter_fields_in_run") == 1
