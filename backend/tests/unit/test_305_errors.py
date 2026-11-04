"""Phase 305-01 (D-47 / D-24 / T-305-16 / MCP-07) — no exception text ever reaches the client.

Measured in research: without a catch-all the SDK ships ``{"code":0,"message":"<str(exc)>"}``.
A handler raising an exception carrying a marker string must come back as the plain
GENERIC_FAILURE_SENTENCE tool error, and the marker must be absent from the FULL response bytes.
An unknown tool name is a JSON-RPC protocol error (-32602), as the spec requires.
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h

MARKER = "MARKER-305-secret"


def _install(monkeypatch):
    import app.mcp.tools as tools

    async def boom(principal, args):
        raise RuntimeError(MARKER)

    monkeypatch.setitem(tools.REGISTERED, "t_boom", h.make_spec("t_boom", boom))
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)


@pytest.mark.parametrize("era", [h.LEGACY, h.MODERN])
def test_a_raising_handler_returns_the_generic_sentence(monkeypatch, era):
    from app.mcp.dispatch import GENERIC_FAILURE_SENTENCE

    _install(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_boom", era=era)
    assert r.status_code == 200, r.text
    assert MARKER not in r.text
    assert "RuntimeError" not in r.text
    result = r.json()["result"]
    assert result["isError"] is True
    assert result["content"][0]["text"] == GENERIC_FAILURE_SENTENCE


def test_generic_sentence_is_plain():
    from app.mcp.dispatch import GENERIC_FAILURE_SENTENCE

    assert GENERIC_FAILURE_SENTENCE == "Something went wrong reading your documents. Try again."


def test_an_unknown_tool_is_invalid_params(monkeypatch):
    _install(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "no_such_tool")
    body = r.json()
    assert "result" not in body
    assert body["error"]["code"] == -32602
    assert "no_such_tool" in body["error"]["message"]
