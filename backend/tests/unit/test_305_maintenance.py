"""Phase 305-01 (D-25 / MCP-07) — maintenance inside the MCP server.

The HTTP write-block allowlists MCP_PATH (test_147). Inside, the dispatch guard refuses any tool
whose annotations are not read-only while maintenance is on — as a JSON-RPC error carrying the
maintenance sentence (never HTML, never a 503). Read-only tools still answer. The guard reuses
``middleware.maintenance._read_maintenance`` — never a second reader.
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h


def _install(monkeypatch, *, maintenance: bool):
    import app.mcp.tools as tools
    import app.middleware.maintenance as mw

    ran: list[str] = []

    async def reader(principal, args):
        ran.append("t_read")
        return h.text_result("read ok")

    async def writer(principal, args):
        ran.append("t_write")
        return h.text_result("write ok")

    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", reader))
    monkeypatch.setitem(tools.REGISTERED, "t_write", h.make_spec("t_write", writer, read_only=False))
    monkeypatch.setattr(mw, "_read_maintenance", lambda: maintenance)
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)
    return ran


@pytest.mark.parametrize("era", [h.LEGACY, h.MODERN])
def test_reads_still_answer_in_maintenance(monkeypatch, era):
    ran = _install(monkeypatch, maintenance=True)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_read", era=era)
    assert r.status_code == 200
    assert r.json()["result"]["content"][0]["text"] == "read ok"
    assert ran == ["t_read"]


@pytest.mark.parametrize("era", [h.LEGACY, h.MODERN])
def test_a_non_read_tool_gets_the_maintenance_sentence(monkeypatch, era):
    from app.mcp.dispatch import MAINTENANCE_SENTENCE

    ran = _install(monkeypatch, maintenance=True)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_write", era=era)
    assert r.status_code != 503
    assert r.headers["content-type"].startswith("application/json")
    body = r.json()
    assert "result" not in body
    assert body["error"]["message"] == MAINTENANCE_SENTENCE
    assert ran == []


def test_with_maintenance_off_the_non_read_tool_runs(monkeypatch):
    ran = _install(monkeypatch, maintenance=False)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_write")
    assert r.json()["result"]["content"][0]["text"] == "write ok"
    assert ran == ["t_write"]


def test_the_maintenance_sentence():
    from app.mcp.dispatch import MAINTENANCE_SENTENCE

    assert MAINTENANCE_SENTENCE == (
        "Syrel is in maintenance mode, so this tool can't start anything right now. "
        "Searching and reading still work."
    )
