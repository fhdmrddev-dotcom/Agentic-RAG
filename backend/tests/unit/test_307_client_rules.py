"""Phase 307-02 (D-08, D-09, D-06; T-307-01, T-307-09, T-307-10) — client rules, pure.

* ``redirect_host_kind`` / ``host_allowed`` — every non-loopback redirect host must be on the
  LIVE ``app_settings.mcp_oauth_redirect_hosts`` list (D-08); loopback is always allowed.
* ``validate_dcr_body`` — RFC 7591 registration, public clients only, never a secret (D-09).
* ``cimd_url_ok`` / ``validate_cimd_document`` — a Client ID Metadata Document client (D-06).
* a source fence: nothing under ``backend/app/mcp/oauth_*`` opens its own HTTP client.
"""
from __future__ import annotations

import ast
import pathlib

import pytest

from app.mcp.oauth_clients import (
    DCR_MAX_BODY,
    MAX_CLIENT_NAME,
    MAX_REDIRECT_URIS,
    CimdClient,
    DcrClient,
    OAuthError,
    cimd_url_ok,
    host_allowed,
    redirect_host_kind,
    validate_cimd_document,
    validate_dcr_body,
)

ALLOW = [{"host": "claude.ai"}, {"host": "claude.com"}]
CLAUDE = "https://claude.ai/api/mcp/auth_callback"

# Fetched live 2026-11-03 (307-RESEARCH §Provider facts) — the Claude Code CIMD document, verbatim.
CLAUDE_CODE_URL = "https://claude.ai/oauth/claude-code-client-metadata"
CLAUDE_CODE_DOC = {
    "client_id": "https://claude.ai/oauth/claude-code-client-metadata",
    "client_name": "Claude Code",
    "client_uri": "https://claude.ai",
    "redirect_uris": ["http://localhost/callback", "http://127.0.0.1/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
}


# ── redirect_host_kind / host_allowed ─────────────────────────────────────────────────────────


def test_redirect_host_kind():
    assert redirect_host_kind(CLAUDE) == ("web", "claude.ai")
    assert redirect_host_kind("http://localhost:3118/callback") == ("loopback", "localhost")
    assert redirect_host_kind("http://127.0.0.1/callback") == ("loopback", "127.0.0.1")
    assert redirect_host_kind("http://[::1]:7/cb") == ("loopback", "[::1]")
    assert redirect_host_kind("http://example.com/cb") is None
    assert redirect_host_kind("cursor://x") is None
    assert redirect_host_kind("https://claude.ai/cb#f") is None


@pytest.mark.parametrize("host, ok", [
    ("claude.ai", True),
    ("claude.com", True),
    ("localhost", True),
    ("127.0.0.1", True),
    ("[::1]", True),
    ("evil-claude.ai", False),
    ("claude.ai.evil.com", False),
    ("sub.claude.ai", False),
    ("example.com", False),
    ("", False),
])
def test_host_allowed(host, ok):
    assert host_allowed(host, ALLOW) is ok


def test_an_empty_allowlist_refuses_every_web_host_but_never_loopback():
    assert host_allowed("claude.ai", []) is False
    assert host_allowed("localhost", []) is True


def test_allowlist_entries_that_are_not_host_dicts_are_ignored():
    assert host_allowed("claude.ai", [{"nohost": 1}, "claude.ai", None]) is False


# ── validate_dcr_body ─────────────────────────────────────────────────────────────────────────

CLAUDE_AI_DCR = {
    "client_name": "Claude",
    "redirect_uris": [CLAUDE],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
    "scope": "mcp",
}


def test_claude_ai_dcr_shape_is_accepted():
    out = validate_dcr_body(dict(CLAUDE_AI_DCR), ALLOW)
    assert isinstance(out, DcrClient)
    assert out.redirect_uris == [CLAUDE]
    assert out.client_name == "Claude"
    assert out.grant_types == ["authorization_code", "refresh_token"]
    assert out.response_types == ["code"]


def test_a_minimal_body_gets_the_defaults():
    out = validate_dcr_body({"redirect_uris": ["http://localhost/callback"]}, ALLOW)
    assert isinstance(out, DcrClient)
    assert out.client_name is None
    assert out.grant_types == ["authorization_code", "refresh_token"]
    assert out.response_types == ["code"]


def _err(body, allow=ALLOW) -> str:
    out = validate_dcr_body(body, allow)
    assert isinstance(out, OAuthError), out
    return out.error


@pytest.mark.parametrize("body, code", [
    ({"redirect_uris": []}, "invalid_redirect_uri"),
    ({}, "invalid_redirect_uri"),
    ({"redirect_uris": "https://claude.ai/x"}, "invalid_redirect_uri"),
    ({"redirect_uris": [CLAUDE] * (MAX_REDIRECT_URIS + 1)}, "invalid_redirect_uri"),
    ({"redirect_uris": ["https://evil.example/cb"]}, "invalid_redirect_uri"),
    ({"redirect_uris": ["http://example.com/cb"]}, "invalid_redirect_uri"),
    ({"redirect_uris": ["https://claude.ai/cb#f"]}, "invalid_redirect_uri"),
    ({"redirect_uris": [CLAUDE, "cursor://x"]}, "invalid_redirect_uri"),
    ({"redirect_uris": [42]}, "invalid_redirect_uri"),
    ({"redirect_uris": [CLAUDE], "token_endpoint_auth_method": "client_secret_post"},
     "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "grant_types": ["client_credentials"]}, "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "grant_types": "authorization_code"}, "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "response_types": ["token"]}, "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "client_name": "x" * (MAX_CLIENT_NAME + 1)}, "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "client_name": 7}, "invalid_client_metadata"),
    ({"redirect_uris": [CLAUDE], "client_uri": "h" * 3000}, "invalid_client_metadata"),
])
def test_dcr_refusals(body, code):
    assert _err(body) == code


def test_dcr_refuses_a_non_object_body():
    assert _err([CLAUDE]) == "invalid_client_metadata"
    assert _err("x") == "invalid_client_metadata"


def test_a_host_removed_from_the_allowlist_is_refused_at_registration():
    assert _err(dict(CLAUDE_AI_DCR), [{"host": "claude.com"}]) == "invalid_redirect_uri"


def test_the_body_cap_is_sixteen_kilobytes():
    assert DCR_MAX_BODY == 16_384


def test_a_client_name_at_the_cap_is_stored_as_data():
    out = validate_dcr_body({"redirect_uris": [CLAUDE], "client_name": "<b>x</b>" + "y" * 192}, ALLOW)
    assert isinstance(out, DcrClient)
    assert out.client_name.startswith("<b>x</b>")  # stored verbatim, as data — never rendered as HTML


# ── cimd_url_ok ───────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("url, ok", [
    (CLAUDE_CODE_URL, True),
    ("https://example.com/app/metadata.json", True),
    ("https://example.com/app/metadata.json?x=1", False),
    ("https://example.com/app/metadata.json#f", False),
    ("https://u@example.com/app/metadata.json", False),
    ("https://example.com:8443/app/metadata.json", False),
    ("http://example.com/app/metadata.json", False),
    ("https://example.com", False),
    ("https://example.com/", False),
    ("not-a-url", False),
    ("https://exämple.com/m", False),
    ("", False),
    (None, False),
])
def test_cimd_url_ok(url, ok):
    assert cimd_url_ok(url) is ok


# ── validate_cimd_document ────────────────────────────────────────────────────────────────────


def test_the_live_claude_code_document_is_accepted():
    out = validate_cimd_document(CLAUDE_CODE_URL, dict(CLAUDE_CODE_DOC))
    assert isinstance(out, CimdClient)
    assert out.client_name == "Claude Code"
    assert out.redirect_uris == ["http://localhost/callback", "http://127.0.0.1/callback"]
    assert out.client_uri == "https://claude.ai"


def _bad(**change):
    doc = dict(CLAUDE_CODE_DOC)
    for k, v in change.items():
        if v is _DROP:
            doc.pop(k, None)
        else:
            doc[k] = v
    return doc


_DROP = object()


@pytest.mark.parametrize("doc", [
    _bad(client_id="https://claude.ai/oauth/other"),
    _bad(client_id="https://claude.ai/oauth/claude-code-client-metadata/"),
    _bad(client_id=_DROP),
    _bad(client_name=_DROP),
    _bad(client_name=""),
    _bad(client_name="x" * (MAX_CLIENT_NAME + 1)),
    _bad(redirect_uris=_DROP),
    _bad(redirect_uris=[]),
    _bad(redirect_uris=["http://example.com/cb"]),
    _bad(redirect_uris=["http://localhost/cb"] * 11),
    _bad(token_endpoint_auth_method="private_key_jwt"),
    _bad(grant_types=["implicit"]),
    _bad(response_types=["token"]),
    ["not", "an", "object"],
])
def test_bad_documents_are_unreadable(doc):
    assert validate_cimd_document(CLAUDE_CODE_URL, doc) == "metadata_unreadable"


def test_a_document_for_a_url_that_is_not_ok_is_unreadable():
    url = "https://example.com:8443/m"
    doc = dict(CLAUDE_CODE_DOC, client_id=url)
    assert validate_cimd_document(url, doc) == "metadata_unreadable"


# ── the source fence (T-307-09) ───────────────────────────────────────────────────────────────


def test_no_oauth_module_opens_its_own_http_client():
    mcp_dir = pathlib.Path(__file__).resolve().parents[2] / "app" / "mcp"
    files = sorted(mcp_dir.glob("oauth_*.py"))
    assert files, "no oauth_* module found — the fence would pass over nothing"
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = {a.name for a in node.names}
                assert not names & {"httpx", "requests", "urllib.request", "aiohttp"}, (path.name, names)
            if isinstance(node, ast.ImportFrom):
                assert node.module not in {"httpx", "requests", "urllib.request", "aiohttp"}, (
                    path.name, node.module)
                if node.module == "urllib":
                    assert "request" not in {a.name for a in node.names}, path.name
            if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
                assert not (node.value.id == "httpx" and node.attr in {"AsyncClient", "Client"}), path.name
