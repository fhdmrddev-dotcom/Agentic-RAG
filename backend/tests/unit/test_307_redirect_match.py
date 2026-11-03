"""Phase 307-02 (D-07, T-307-01) — redirect matching: exact strings, loopback any-port only.

A redirect URI decides where a browser carrying an authorization code goes. The rule is exact
string equality after a strict parse, with ONE exception: ``http`` on ``localhost``, ``127.0.0.1``
or ``[::1]`` matches on any port (Claude Code publishes ``http://localhost/callback`` and then
listens on a random port). Never ``pydantic.AnyUrl`` — it normalises host case and empty paths.
"""
from __future__ import annotations

import pytest

from app.mcp.oauth_clients import parse_redirect, redirect_matches

CLAUDE = "https://claude.ai/api/mcp/auth_callback"


@pytest.mark.parametrize(
    "presented, registered",
    [
        ("http://localhost:3118/callback", ["http://localhost/callback"]),
        ("http://localhost:3118/callback", ["http://localhost:9/callback"]),
        ("http://localhost/callback", ["http://localhost:9/callback"]),
        ("http://127.0.0.1:5/callback", ["http://127.0.0.1/callback"]),
        ("http://[::1]:7/cb", ["http://[::1]/cb"]),
        ("http://localhost:54001/callback", ["http://127.0.0.1/callback", "http://localhost/callback"]),
        (CLAUDE, [CLAUDE]),
        (CLAUDE, ["https://claude.com/api/mcp/auth_callback", CLAUDE]),
    ],
)
def test_these_redirects_match(presented, registered):
    assert redirect_matches(presented, registered) is True


@pytest.mark.parametrize(
    "presented, registered",
    [
        # localhost and 127.0.0.1 are NOT interchangeable (the Claude Code document lists both)
        ("http://127.0.0.1:5/callback", ["http://localhost/callback"]),
        ("http://localhost:5/callback", ["http://127.0.0.1/callback"]),
        ("http://[::1]:5/callback", ["http://localhost/callback"]),
        # path and query stay exact on loopback
        ("http://localhost:3118/callback?x=1", ["http://localhost/callback"]),
        ("http://localhost:3118/callback/", ["http://localhost/callback"]),
        ("http://localhost:3118/Callback", ["http://localhost/callback"]),
        # https: the full string, nothing looser
        ("https://claude.ai:444/api/mcp/auth_callback", [CLAUDE]),
        ("https://claude.ai:443/api/mcp/auth_callback", [CLAUDE]),
        ("https://claude.ai/api/mcp/auth_callback/extra", [CLAUDE]),
        ("https://claude.ai/api/mcp/auth_callback#f", [CLAUDE]),
        ("https://user@claude.ai/api/mcp/auth_callback", [CLAUDE]),
        ("http://claude.ai/api/mcp/auth_callback", [CLAUDE]),
        ("https://CLAUDE.ai/api/mcp/auth_callback", [CLAUDE]),
        ("https://claude.ai/api/mcp/auth_callback?a=1", [CLAUDE]),
        ("https://claude.ai/api/mcp/auth_callbac", [CLAUDE]),
        # custom schemes and other http
        ("cursor://x", ["cursor://x"]),
        ("http://example.com/cb", ["http://example.com/cb"]),
        ("http://localhost.evil.com/cb", ["http://localhost.evil.com/cb"]),
        # garbage
        ("", [CLAUDE]),
        ("not a url", [CLAUDE]),
        (CLAUDE, []),
    ],
)
def test_these_redirects_are_refused(presented, registered):
    assert redirect_matches(presented, registered) is False


def test_a_registered_entry_that_is_itself_bad_never_matches():
    # A fragment-bearing registration can never be matched, even by the identical string.
    bad = "https://claude.ai/cb#x"
    assert redirect_matches(bad, [bad]) is False


@pytest.mark.parametrize(
    "uri",
    [
        "https://claude.ai/cb#frag",
        "https://u:p@claude.ai/cb",
        "https://cläude.ai/cb",
        "ftp://claude.ai/cb",
        "javascript:alert(1)",
        "https:///nohost",
        "http://localhost:99999/cb",
        "https://claude.ai/c b",
        None,
        42,
    ],
)
def test_strict_parse_refuses(uri):
    assert parse_redirect(uri) is None


def test_the_module_never_uses_anyurl():
    import inspect

    import app.mcp.oauth_clients as mod

    assert "AnyUrl" not in inspect.getsource(mod)
