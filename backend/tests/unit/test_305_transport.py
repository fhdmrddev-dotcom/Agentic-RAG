"""Phase 305-01 (D-02 / D-05 / D-06 / D-11 / D-47 / D-49 / D-57; T-305-06/-07/-17/-19) — the transport.

* ``/mcp`` and ``/mcp/`` are both registered to the same edge; neither ever answers 3xx (a 307 to
  ``http://`` behind TLS drops the key, T-305-19).
* every non-POST method is 405 + ``Allow: POST`` before any key lookup (a stateless GET would
  otherwise hold an SSE stream open forever, T-305-17).
* a present ``Origin`` is 403 and a Host outside the allowlist is 421 (DNS rebinding, T-305-06).
* the server is stateless with JSON responses: no response carries ``Mcp-Session-Id``.
* the access-log filter strips the query string from MCP_PATH lines only, and installs once.
* the principal reaches the handler in BOTH protocol eras.
"""
from __future__ import annotations

import logging

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h


@pytest.fixture
def client(monkeypatch):
    import app.mcp.tools as tools

    async def echo(principal, args):
        return h.text_result(f"{principal.org_id}|{principal.key_id}")

    monkeypatch.setitem(tools.REGISTERED, "t_org", h.make_spec("t_org", echo))
    h.configure(monkeypatch)
    resolver = h.stub_edge(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        c.resolver = resolver
        yield c


@pytest.mark.parametrize("path", ["/mcp", "/mcp/"])
def test_both_paths_initialize_and_never_redirect(client, path):
    r = client.post(path, headers=h.headers(), json=h.initialize_body(), follow_redirects=False)
    assert r.status_code == 200, r.text
    assert not (300 <= r.status_code < 400)
    assert r.json()["result"]["serverInfo"]["name"] == "syrel"
    assert "mcp-session-id" not in {k.lower() for k in r.headers}


@pytest.mark.parametrize("method", ["GET", "DELETE", "PUT", "PATCH", "HEAD"])
@pytest.mark.parametrize("path", ["/mcp", "/mcp/"])
def test_non_post_is_405_before_any_key_lookup(client, method, path):
    r = client.request(method, path, headers=h.headers(), follow_redirects=False)
    assert r.status_code == 405
    assert r.headers["allow"] == "POST"
    assert client.resolver.calls == []


def test_a_present_origin_is_403(client):
    r = client.post("/mcp", headers=h.headers(extra={"origin": "https://evil.example"}),
                    json=h.initialize_body())
    assert r.status_code == 403


def test_a_foreign_host_is_421(client):
    r = client.post("/mcp", headers=h.headers(extra={"host": "evil.example"}),
                    json=h.initialize_body())
    assert r.status_code == 421


def test_no_response_carries_a_session_id(client):
    seen = []
    seen.append(client.post("/mcp", headers=h.headers(), json=h.initialize_body()))
    seen.append(client.post("/mcp", headers=h.headers(era=h.LEGACY),
                            json={"jsonrpc": "2.0", "method": "notifications/initialized"}))
    seen.append(h.list_tools(client))
    seen.append(h.list_tools(client, era=h.MODERN))
    seen.append(h.call(client, "t_org"))
    seen.append(h.call(client, "t_org", era=h.MODERN))
    assert [r.status_code for r in seen] == [200, 202, 200, 200, 200, 200]
    for r in seen:
        assert "mcp-session-id" not in {k.lower() for k in r.headers}
    for r in seen:
        if r.status_code == 200:
            assert r.headers["content-type"].startswith("application/json")


@pytest.mark.parametrize("era", [h.LEGACY, h.MODERN])
def test_the_principal_reaches_the_handler_in_both_eras(client, era):
    r = h.call(client, "t_org", era=era)
    assert r.status_code == 200, r.text
    text = r.json()["result"]["content"][0]["text"]
    assert text == f"{h.KEY_ORG}|{h.PRINCIPAL.key_id}"


# ── the access-log filter (D-57 / R-24) ────────────────────────────────────────


def _access_record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1,
        '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:5555", "POST", path, "1.1", 200), None,
    )


@pytest.mark.parametrize("path, expected", [
    ("/mcp?key=srl_mcp_secret", "/mcp"),
    ("/mcp/?key=srl_mcp_secret&x=1", "/mcp/"),
    ("/mcp", "/mcp"),
    ("/documents?page=2", "/documents?page=2"),
    ("/mcpx?key=1", "/mcpx?key=1"),
])
def test_the_filter_strips_the_query_on_mcp_lines_only(path, expected):
    from app.mcp.access_log import McpQueryStripFilter

    rec = _access_record(path)
    assert McpQueryStripFilter().filter(rec) is True
    assert rec.args[2] == expected
    assert "srl_mcp_secret" not in rec.getMessage() or not expected.startswith("/mcp")


def test_the_filter_ignores_records_of_another_shape():
    from app.mcp.access_log import McpQueryStripFilter

    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "plain %s", ("x",), None)
    assert McpQueryStripFilter().filter(rec) is True
    assert rec.args == ("x",)


def test_register_mcp_twice_installs_one_filter(monkeypatch):
    from app.mcp.access_log import McpQueryStripFilter

    h.configure(monkeypatch)
    access = logging.getLogger("uvicorn.access")
    before = [f for f in access.filters if isinstance(f, McpQueryStripFilter)]
    h.fresh_app()
    h.fresh_app()
    after = [f for f in access.filters if isinstance(f, McpQueryStripFilter)]
    assert len(after) == 1
    assert len(before) <= 1
