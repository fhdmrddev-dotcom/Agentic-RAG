"""Phase 306-04 (MCP-04; D-14 / D-15 / D-30 / D-37; T-306-17 / T-306-19) — the two ask tools' definitions.

* ``REGISTERED`` serves the three 305 read tools plus ``ask_agent`` and ``get_answer`` (D-15). Titles
  are the catalogue labels; ``ask_agent`` is NOT read-only (maintenance refuses it, D-14 / T-306-17),
  ``get_answer`` is ``READ_ONLY`` and keeps answering. Buckets: ``ask_agent`` counts on the per-key
  ``start`` bucket (``api_key_starts_per_minute``), ``get_answer`` on ``cheap``.
* ``ask_agent``'s description discloses the scope (D-30). No definition carries user text.
* D-37 / T-306-19: ``AskArgs`` has exactly ``question`` and ``idempotency_key`` (no model, no
  provider) and forbids extras, so an MCP caller can never pick the model; ``ask_tools`` never
  passes the internal override keywords and is the only caller of ``resolve_ask_model`` in the app.
* The grant: a key without ``ask_agent`` neither lists nor calls either tool; ``get_answer``
  travels with ``ask_agent`` (a row holding ``get_answer`` alone grants nothing).
"""
from __future__ import annotations

import ast
import re
from dataclasses import replace
from pathlib import Path

import pytest
from mcp.shared.exceptions import MCPError
from starlette.testclient import TestClient

from app.mcp import results, tools
from app.models.user_settings import _build_settings_from_row
from app.services import rate_limit
from app.services.mcp_tool_catalogue import MCP_TOOLS
from tests.unit import _mcp305_harness as h
from tests.unit.phase293_inbound_fakes import FakeRedis

FIVE = {"search_knowledge_base", "list_documents", "read_document", "ask_agent", "get_answer"}
# 306-05 (D-15) RETIRES the "exactly five" pin DELIBERATELY (SEED-177): the three workflow tools are
# now served too, so the registry holds every catalogue name.
RUN3 = ("list_workflows", "run_workflow", "get_workflow_run")
EIGHT = FIVE | set(RUN3)
LABELS = {t.name: t.label for t in MCP_TOOLS}
FIXTURE_STRINGS = ("Contracts 2026", "Q3 revenue.pdf", "Fahad's laptop key", "306-04", "zqx")
SCOPE_DISCLOSURE = (
    "Answers come from the folders this key can read in its organisation. "
    "Documents not in a folder are not searched."
)
APP = Path(__file__).resolve().parents[2] / "app"


def test_the_eight_names_are_served():
    assert set(tools.REGISTERED) == EIGHT
    assert tuple(tools.REGISTERED)[-3:] == RUN3


@pytest.mark.parametrize("name", ["ask_agent", "get_answer"])
def test_each_ask_tool_is_static_and_labelled_from_the_catalogue(name):
    t = tools.REGISTERED[name].tool
    assert t.name == name and t.title == LABELS[name]
    assert t.description and len(t.description) < 600
    for needle in FIXTURE_STRINGS:
        assert needle not in t.description and needle not in t.title


def test_ask_agent_starts_things_and_get_answer_reads():
    ask, get = tools.REGISTERED["ask_agent"], tools.REGISTERED["get_answer"]
    assert ask.tool.annotations.read_only_hint is False
    assert not tools.is_read_only(ask)
    assert get.tool.annotations == tools.READ_ONLY and tools.is_read_only(get)
    assert ask.bucket == "start" and get.bucket == "cheap"
    assert ask.args_model is results.AskArgs and get.args_model is results.GetAnswerArgs
    assert ask.tool.output_schema == results.AskResult.model_json_schema()
    assert get.tool.output_schema == results.AskResult.model_json_schema()


def test_the_ask_description_discloses_the_scope():
    assert tools.REGISTERED["ask_agent"].tool.description.endswith(SCOPE_DISCLOSURE)


def test_ask_args_have_no_model_and_no_provider():
    schema = results.AskArgs.model_json_schema()
    assert set(schema["properties"]) == {"question", "idempotency_key"}
    q = schema["properties"]["question"]
    assert (q["minLength"], q["maxLength"]) == (1, 16000)
    assert schema.get("additionalProperties") is False
    pattern = r"^[A-Za-z0-9_.:-]{1,128}$"
    assert pattern in str(schema["properties"]["idempotency_key"])
    with pytest.raises(Exception):
        results.AskArgs.model_validate({"question": "q", "model": "gpt-x"})
    with pytest.raises(Exception):
        results.AskArgs.model_validate({"question": "q", "provider": "openai"})
    with pytest.raises(Exception):
        results.AskArgs.model_validate({"question": "q", "idempotency_key": "has space"})
    with pytest.raises(Exception):
        results.AskArgs.model_validate({"question": ""})
    g = results.GetAnswerArgs.model_json_schema()["properties"]["handle"]
    assert (g["minLength"], g["maxLength"]) == (1, 64)


# ── D-37 ──────────────────────────────────────────────────────────────────────────────────────


def test_ask_tools_never_passes_the_model_overrides():
    source = (APP / "mcp" / "ask_tools.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)
             and (getattr(n.func, "attr", None) or getattr(n.func, "id", None)) == "resolve_ask_model"]
    assert calls, "ask_tools must resolve the member's model"
    for call in calls:
        assert {k.arg for k in call.keywords} & {"model", "provider"} == set()
        assert not any(k.arg is None for k in call.keywords), "no **kwargs into resolve_ask_model"
    assert not re.search(r"model=|provider=", source)


def test_resolve_ask_model_has_exactly_two_homes():
    homes = sorted(
        str(p.relative_to(APP)).replace("\\", "/")
        for p in APP.rglob("*.py")
        if "resolve_ask_model(" in p.read_text(encoding="utf-8")
    )
    assert homes == ["mcp/ask_tools.py", "services/outside_ask.py"]


# ── the grant ─────────────────────────────────────────────────────────────────────────────────


def _listed(monkeypatch, principal) -> list[str]:
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(principal))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        r = h.list_tools(client)
    assert r.status_code == 200, r.text
    return [t["name"] for t in r.json()["result"]["tools"]]


READ3 = ("search_knowledge_base", "list_documents", "read_document")


def test_a_key_without_ask_agent_lists_neither_ask_tool(monkeypatch):
    assert _listed(monkeypatch, replace(h.PRINCIPAL, tools=READ3)) == list(READ3)


def test_a_key_with_ask_agent_lists_both(monkeypatch):
    names = _listed(monkeypatch, replace(h.PRINCIPAL, tools=READ3 + ("ask_agent", "get_answer")))
    assert names == list(READ3) + ["ask_agent", "get_answer"]


def test_get_answer_without_its_lead_is_neither_listed_nor_callable(monkeypatch):
    lone = replace(h.PRINCIPAL, tools=READ3 + ("get_answer",))
    assert "get_answer" not in _listed(monkeypatch, lone)
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(lone))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        result = h.call(client, "get_answer", {"handle": "x"}).json()["result"]
    assert result["isError"] is True
    assert result["content"][0]["text"] == "This key can't use get_answer."


def test_a_key_without_ask_agent_cannot_call_it(monkeypatch):
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(replace(h.PRINCIPAL, tools=READ3)))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        result = h.call(client, "ask_agent", {"question": "q"}).json()["result"]
    assert result["isError"] is True and result["content"][0]["text"] == "This key can't use ask_agent."


# ── maintenance (D-14 / T-306-17) ─────────────────────────────────────────────────────────────

ASKER = replace(h.PRINCIPAL, tools=READ3 + ("ask_agent", "get_answer"), label="Laptop")


@pytest.fixture
def audited(monkeypatch):
    rows = h.stub_accounting(monkeypatch)
    return rows


async def test_maintenance_refuses_ask_agent_and_get_answer_still_answers(audited, monkeypatch):
    import app.mcp.ask_tools as ask_tools
    import app.mcp.dispatch as dispatch_mod
    from app.mcp.dispatch import MAINTENANCE_SENTENCE, dispatch

    monkeypatch.setattr(dispatch_mod._maintenance, "_read_maintenance", lambda: True)
    started: list[str] = []

    async def _never(principal, args):
        started.append("ask")
        raise AssertionError("ask_agent ran in maintenance")

    async def _answer(principal, args):
        return ask_tools.NO_HANDLE_SENTENCE

    monkeypatch.setitem(tools.REGISTERED, "ask_agent", replace(tools.REGISTERED["ask_agent"], handler=_never))
    monkeypatch.setitem(tools.REGISTERED, "get_answer", replace(tools.REGISTERED["get_answer"], handler=_answer))
    with pytest.raises(MCPError) as err:
        await dispatch(ASKER, "ask_agent", {"question": "q"}, redis=FakeRedis())
    assert err.value.error.message == MAINTENANCE_SENTENCE
    assert started == []
    assert audited[-1]["metadata"]["reason"] == "maintenance"
    out = await dispatch(ASKER, "get_answer", {"handle": "h"}, redis=FakeRedis())
    assert out.content[0].text == ask_tools.NO_HANDLE_SENTENCE


# ── the start bucket (D-14) ───────────────────────────────────────────────────────────────────


@pytest.fixture
def knobs(monkeypatch):
    values = {"api_key_reads_per_minute": 50, "api_key_searches_per_minute": 50,
              "api_key_starts_per_minute": 2}

    async def _load():
        return _build_settings_from_row(dict(values))

    monkeypatch.setattr(rate_limit, "load_app_settings_async", _load)
    return values


async def test_ask_agent_counts_on_the_start_bucket(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    spec = tools.REGISTERED["ask_agent"]
    assert await limits.check_limit(ASKER, spec, redis) is None
    keys = [k for k in redis.store if k.startswith("apikey:rl:")]
    assert keys and all(k.startswith(f"apikey:rl:start:{ASKER.key_id}:") for k in keys)
    assert await limits.check_limit(ASKER, spec, redis) is None
    refused = await limits.check_limit(ASKER, spec, redis)
    assert refused is not None and refused.reason == "rate_limited:start" and refused.limit == 2
    assert re.fullmatch(
        r"This key has started too many questions and runs in the last minute\. Try again in (\d+) seconds\.",
        refused.sentence,
    ), refused.sentence
    assert limits.STARTS_SENTENCE.startswith("This key has started too many questions and runs")


async def test_the_read_and_expensive_arms_are_unchanged(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    assert await limits.check_limit(ASKER, tools.REGISTERED["get_answer"], redis) is None
    assert all(k.startswith("apikey:rl:read:") for k in redis.store if k.startswith("apikey:rl:"))
    limit, retry = await rate_limit.check_key_limit(redis, key_id="k", kind="expensive")
    assert (limit, retry) == (50, None)
    limit, retry = await rate_limit.check_key_limit(redis, key_id="k", kind="read")
    assert (limit, retry) == (50, None)
    limit, retry = await rate_limit.check_key_limit(redis, key_id="k", kind="start")
    assert (limit, retry) == (2, None)


async def test_a_model_argument_does_not_fit(audited, monkeypatch):
    from app.mcp.dispatch import dispatch

    async def _never(principal, args):
        raise AssertionError("a model argument reached the handler")

    monkeypatch.setitem(tools.REGISTERED, "ask_agent", replace(tools.REGISTERED["ask_agent"], handler=_never))
    out = await dispatch(ASKER, "ask_agent", {"question": "q", "model": "gpt-x"}, redis=FakeRedis())
    assert out.is_error is True
    assert out.content[0].text == "Those arguments don't fit ask_agent. Check the tool's inputs and try again."


# ── 306-05: the three workflow tools (D-10..D-15; T-306-17) ───────────────────────────────────

RUNNER = replace(h.PRINCIPAL, tools=READ3 + RUN3, label="Laptop")


@pytest.mark.parametrize("name", RUN3)
def test_each_run_tool_is_static_and_labelled_from_the_catalogue(name):
    t = tools.REGISTERED[name].tool
    assert t.name == name and t.title == LABELS[name]
    assert t.description and len(t.description) < 600
    for needle in FIXTURE_STRINGS:
        assert needle not in t.description and needle not in t.title


def test_run_workflow_starts_things_and_the_other_two_read():
    run, lst, get = (tools.REGISTERED[n] for n in ("run_workflow", "list_workflows", "get_workflow_run"))
    assert run.tool.annotations == tools.STARTS and not tools.is_read_only(run)
    assert lst.tool.annotations == tools.READ_ONLY and tools.is_read_only(lst)
    assert get.tool.annotations == tools.READ_ONLY and tools.is_read_only(get)
    assert (run.bucket, lst.bucket, get.bucket) == ("start", "cheap", "cheap")
    assert run.args_model is results.RunWorkflowArgs and run.tool.output_schema == results.RunStarted.model_json_schema()
    assert lst.args_model is results.ListWorkflowsArgs
    assert lst.tool.output_schema == results.WorkflowList.model_json_schema()
    assert get.args_model is results.GetRunArgs and get.tool.output_schema == results.RunRead.model_json_schema()


def test_the_tools_docblock_names_every_served_tool():
    doc = tools.__doc__ or ""
    for name in EIGHT:
        assert name in doc, name


def test_a_key_granting_run_workflow_lists_all_three(monkeypatch):
    assert _listed(monkeypatch, RUNNER) == list(READ3) + list(RUN3)


def test_a_key_without_run_workflow_lists_none_of_them(monkeypatch):
    lone = replace(h.PRINCIPAL, tools=READ3 + ("list_workflows", "get_workflow_run"))
    assert _listed(monkeypatch, lone) == list(READ3)


def test_a_companion_without_run_workflow_is_not_callable(monkeypatch):
    lone = replace(h.PRINCIPAL, tools=READ3 + ("list_workflows",))
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(lone))
    with TestClient(h.fresh_app(), base_url=h.BASE) as client:
        result = h.call(client, "list_workflows", {}).json()["result"]
    assert result["isError"] is True and result["content"][0]["text"] == "This key can't use list_workflows."


async def test_maintenance_refuses_run_workflow_and_the_reads_still_answer(audited, monkeypatch):
    import app.mcp.dispatch as dispatch_mod
    from app.mcp import run_tools
    from app.mcp.dispatch import MAINTENANCE_SENTENCE, dispatch

    monkeypatch.setattr(dispatch_mod._maintenance, "_read_maintenance", lambda: True)
    started: list[str] = []

    async def _never(principal, args):
        started.append("run")
        raise AssertionError("run_workflow ran in maintenance")

    async def _none(principal, args):
        return run_tools.NO_RUN_SENTENCE

    async def _empty(principal, args):
        return results.WorkflowList(workflows=[])

    monkeypatch.setitem(tools.REGISTERED, "run_workflow", replace(tools.REGISTERED["run_workflow"], handler=_never))
    monkeypatch.setitem(tools.REGISTERED, "get_workflow_run",
                        replace(tools.REGISTERED["get_workflow_run"], handler=_none))
    monkeypatch.setitem(tools.REGISTERED, "list_workflows",
                        replace(tools.REGISTERED["list_workflows"], handler=_empty))
    with pytest.raises(MCPError) as err:
        await dispatch(RUNNER, "run_workflow", {"workflow_id": "w"}, redis=FakeRedis())
    assert err.value.error.message == MAINTENANCE_SENTENCE and started == []
    assert audited[-1]["metadata"]["reason"] == "maintenance"
    out = await dispatch(RUNNER, "get_workflow_run", {"run_id": "r"}, redis=FakeRedis())
    assert out.content[0].text == run_tools.NO_RUN_SENTENCE
    out = await dispatch(RUNNER, "list_workflows", {}, redis=FakeRedis())
    assert out.content[0].text == "No published workflows are available to this key."


async def test_run_workflow_counts_on_the_start_bucket(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    assert await limits.check_limit(RUNNER, tools.REGISTERED["run_workflow"], redis) is None
    keys = [k for k in redis.store if k.startswith("apikey:rl:")]
    assert keys and all(k.startswith(f"apikey:rl:start:{RUNNER.key_id}:") for k in keys)
