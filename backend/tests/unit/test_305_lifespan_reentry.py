"""Phase 305-01 (D-49 / Pitfall 4) — a lifespan entered twice on ONE app works.

``StreamableHTTPSessionManager.run()`` can only be called once per instance, and 13 test modules
enter ``TestClient`` lifespans on the same ``app.main.app`` object. ``mcp_lifespan()`` builds a
fresh session manager on every entry, so the second entry answers exactly like the first.
"""
from __future__ import annotations

from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h


def test_one_app_two_lifespans(monkeypatch):
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)
    app = h.fresh_app()
    for _ in range(2):
        with TestClient(app, base_url=h.BASE) as c:
            r = c.post("/mcp", headers=h.headers(), json=h.initialize_body())
            assert r.status_code == 200, r.text
            assert r.json()["result"]["protocolVersion"] == h.LEGACY


def test_without_a_lifespan_the_edge_answers_503_not_a_traceback(monkeypatch):
    h.configure(monkeypatch)
    h.stub_edge(monkeypatch)
    app = h.fresh_app()
    c = TestClient(app, base_url=h.BASE)  # no `with`: the lifespan never runs
    r = c.post("/mcp", headers=h.headers(), json=h.initialize_body())
    assert r.status_code == 503
    assert "Traceback" not in r.text
