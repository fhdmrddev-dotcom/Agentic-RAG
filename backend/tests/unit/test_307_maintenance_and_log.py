"""Phase 307-02 (D-31; T-307-08) — maintenance allowlist and the access-log query strip for /oauth.

* Maintenance must not disconnect a connected app: ``POST /oauth/token`` (refresh), ``/oauth/revoke``
  and ``/oauth/register`` pass. The consent APPROVE creates a grant, so it stays blocked.
* An ``/oauth/authorize`` URL carries ``state`` and ``code_challenge`` in its query; uvicorn's access
  line would write them to every log sink. The query is dropped for ``/oauth`` paths, exactly as
  for ``/mcp`` — segment boundary, never a prefix.
"""
from __future__ import annotations

import logging

import pytest

from app.mcp.access_log import McpQueryStripFilter
from app.middleware.maintenance import _is_allowlisted


@pytest.mark.parametrize("path", ["/oauth/token", "/oauth/revoke", "/oauth/register"])
def test_the_three_oauth_writes_pass_under_maintenance(path):
    assert _is_allowlisted("POST", path) is True


@pytest.mark.parametrize("method, path", [
    ("POST", "/oauth/requests/6f1c2e0a-7d3b-4c8e-9a1f-2b3c4d5e6f70/approve"),
    ("POST", "/oauth/requests/x/approve"),
    ("POST", "/oauth/requests/x/deny"),
    ("POST", "/oauth/tokenx"),
    ("POST", "/oauthx/token"),
    ("POST", "/oauth/token/extra"),
    ("PUT", "/oauth/client"),
])
def test_everything_else_under_oauth_stays_blocked(method, path):
    assert _is_allowlisted(method, path) is False


def test_get_authorize_passes_as_every_read_does():
    assert _is_allowlisted("GET", "/oauth/authorize") is True


def _record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4:5555", "GET", path, "1.1", 302), None,
    )


@pytest.mark.parametrize("path, logged", [
    ("/oauth/authorize?code_challenge=abc&state=s3cret&client_id=x", "/oauth/authorize"),
    ("/oauth/token?code=leak", "/oauth/token"),
    ("/oauth?x=1", "/oauth"),
    ("/mcp?key=srl_mcp_x", "/mcp"),
    ("/oauthx/a?keep=1", "/oauthx/a?keep=1"),
    ("/documents?q=1", "/documents?q=1"),
])
def test_the_access_log_drops_the_oauth_query(path, logged):
    rec = _record(path)
    assert McpQueryStripFilter().filter(rec) is True
    assert rec.args[2] == logged
    assert "s3cret" not in rec.getMessage() or path.startswith("/oauthx")
