"""Phase 305-01 (D-21 / D-24 / T-305-05) — the tools/call pipeline: grant at call, plain sentences.

* ``tools/list`` is REGISTERED intersected with the principal's granted tools.
* ``tools/call`` re-checks the grant at dispatch, BEFORE any handler runs (a key that lists a
  tool it may not call still cannot call it — and one that never listed it cannot either).
* argument validation failures are an ``isError`` result with a plain sentence, never pydantic text.
"""
from __future__ import annotations

from dataclasses import replace

from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h


def _install(monkeypatch, principal=h.PRINCIPAL):
    import app.mcp.tools as tools

    calls: list[str] = []

    async def handler(principal, args):
        calls.append(principal.key_id)
        return h.text_result("ran")

    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", handler))
    monkeypatch.setitem(
        tools.REGISTERED, "t_query", h.make_spec("t_query", handler, args_model=h.NeedsQuery)
    )
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch, h.Recorder(principal))
    return calls


def test_tools_list_is_registered_intersect_granted(monkeypatch):
    _install(monkeypatch, replace(h.PRINCIPAL, tools=("t_read",)))
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.list_tools(c)
    assert r.status_code == 200, r.text
    names = [t["name"] for t in r.json()["result"]["tools"]]
    assert names == ["t_read"]


def test_ungranted_tool_is_neither_listed_nor_callable(monkeypatch):
    calls = _install(monkeypatch, replace(h.PRINCIPAL, tools=("t_query",)))
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        listed = [t["name"] for t in h.list_tools(c).json()["result"]["tools"]]
        r = h.call(c, "t_read")
    assert "t_read" not in listed
    result = r.json()["result"]
    assert result["isError"] is True
    assert result["content"][0]["text"] == "This key can't use t_read."
    assert calls == [], "the handler ran for an ungranted tool"


def test_a_principal_with_no_grant_lists_nothing(monkeypatch):
    _install(monkeypatch, replace(h.PRINCIPAL, tools=()))
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.list_tools(c)
    assert r.json()["result"]["tools"] == []


def test_argument_validation_is_a_plain_sentence(monkeypatch):
    calls = _install(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_query", {"limit": "many"})
    result = r.json()["result"]
    assert result["isError"] is True
    text = result["content"][0]["text"]
    assert text == "Those arguments don't fit t_query. Check the tool's inputs and try again."
    for leak in ("validation error", "Field required", "type=", "pydantic", "input_value"):
        assert leak not in r.text, leak
    assert calls == []


async def test_dispatch_order_grant_before_validation(monkeypatch):
    """Direct: an ungranted call with bad arguments is refused for the GRANT, not the arguments."""
    import app.mcp.tools as tools
    from app.mcp.dispatch import dispatch

    async def handler(principal, args):  # pragma: no cover - must never run
        raise AssertionError("handler ran")

    monkeypatch.setitem(
        tools.REGISTERED, "t_query", h.make_spec("t_query", handler, args_model=h.NeedsQuery)
    )
    out = await dispatch(replace(h.PRINCIPAL, tools=()), "t_query", {"limit": "x"})
    assert out.is_error is True
    assert out.content[0].text == "This key can't use t_query."


async def test_dispatch_runs_a_granted_valid_call(monkeypatch):
    import app.mcp.tools as tools
    from app.mcp.dispatch import dispatch

    seen = {}

    async def handler(principal, args):
        seen["query"] = args.query
        return h.text_result("ok")

    monkeypatch.setitem(
        tools.REGISTERED, "t_query", h.make_spec("t_query", handler, args_model=h.NeedsQuery)
    )
    out = await dispatch(replace(h.PRINCIPAL, tools=("t_query",)), "t_query", {"query": "q"})
    assert out.is_error is not True
    assert seen == {"query": "q"}
