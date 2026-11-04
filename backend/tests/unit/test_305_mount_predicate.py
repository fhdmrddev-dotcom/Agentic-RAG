"""Phase 305-01 (D-05 / D-49 / D-06 / T-305-20) — one refuse-mount predicate, two consumers.

``mcp_public_base()`` decides whether this deployment serves MCP at all. In production a base that
is unset, loopback or not https is refused: ``register_mcp`` mounts nothing and logs CRITICAL (so
``/mcp`` is a 404), and ``mcp_url()`` returns None through the SAME predicate, so the key screen
shows "no address" instead of a dead one. Outside production the 304 pin holds (loopback served
as-is, test_304_tool_catalogue). The host allowlist is derived from the same base.
"""
from __future__ import annotations

import logging

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h

PROD_REFUSED = [None, "", "http://localhost:8000", "http://127.0.0.1:8000", "https://localhost",
                "http://api.example.com"]


@pytest.mark.parametrize("base", PROD_REFUSED)
def test_production_refuses_unset_loopback_or_http(monkeypatch, caplog, base):
    from app.mcp.transport import MCP_ROUTE_PATHS
    from app.services import mcp_tool_catalogue as cat

    h.configure(monkeypatch, base=base, env="production")
    assert cat.mcp_public_base() is None
    assert cat.mcp_url() is None
    with caplog.at_level(logging.CRITICAL, logger="app.mcp"):
        app = h.fresh_app()
    paths = {getattr(r, "path", None) for r in app.router.routes}
    assert not (paths & set(MCP_ROUTE_PATHS))
    crit = [r for r in caplog.records if r.levelno == logging.CRITICAL]
    assert crit and "BACKEND_PUBLIC_URL" in crit[0].getMessage()
    with TestClient(app, base_url="https://api.example.com") as c:
        assert c.post("/mcp", headers=h.headers(), json=h.initialize_body()).status_code == 404


@pytest.mark.parametrize("env", ["production", "prod", "PRODUCTION"])
def test_production_https_base_is_served(monkeypatch, env):
    from app.services import mcp_tool_catalogue as cat

    h.configure(monkeypatch, base="https://api.example.com/", env=env)
    assert cat.mcp_public_base() == "https://api.example.com"
    assert cat.mcp_url() == "https://api.example.com/mcp"


def test_production_one_box_prefix_is_kept(monkeypatch):
    from app.services import mcp_tool_catalogue as cat

    h.configure(monkeypatch, base="https://host.example/api", env="production")
    assert cat.mcp_url() == "https://host.example/api/mcp"


@pytest.mark.parametrize("env", ["", "development", "local", "staging"])
def test_outside_production_loopback_is_served_as_is(monkeypatch, env):
    from app.services import mcp_tool_catalogue as cat

    h.configure(monkeypatch, base="http://localhost:8000", env=env)
    assert cat.mcp_public_base() == "http://localhost:8000"
    assert cat.mcp_url() == "http://localhost:8000/mcp"


def test_unset_base_is_never_mounted_anywhere(monkeypatch):
    from app.services import mcp_tool_catalogue as cat

    h.configure(monkeypatch, base="  ", env="")
    assert cat.mcp_public_base() is None
    assert cat.mcp_url() is None


def test_production_mount_registers_both_paths(monkeypatch):
    h.configure(monkeypatch, base="https://api.example.com", env="production")
    app = h.fresh_app()
    paths = [getattr(r, "path", None) for r in app.router.routes]
    assert paths.count("/mcp") == 1 and paths.count("/mcp/") == 1


def test_allowed_hosts_in_production_are_exactly_the_public_host(monkeypatch):
    from app.mcp.transport import allowed_hosts, transport_security

    h.configure(monkeypatch, base="https://api.example.com", env="production")
    assert allowed_hosts() == ["api.example.com", "api.example.com:*"]
    ts = transport_security()
    assert ts.enable_dns_rebinding_protection is True
    assert ts.allowed_origins == []


def test_allowed_hosts_outside_production_add_the_loopback_forms(monkeypatch):
    from app.mcp.transport import allowed_hosts

    h.configure(monkeypatch, base="https://api.example.com", env="")
    assert allowed_hosts() == [
        "api.example.com", "api.example.com:*", "127.0.0.1:*", "localhost:*", "[::1]:*",
    ]


def test_mcp_path_is_unchanged():
    from app.services import mcp_tool_catalogue as cat

    assert cat.MCP_PATH == "/mcp"
