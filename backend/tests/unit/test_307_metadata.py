"""Phase 307-02 (D-02, D-03, D-04, D-49; T-307-04) — the discovery documents, three topologies.

Every absolute URL derives from ``mcp_public_base()`` — never from ``Host`` or ``X-Forwarded-*``.
The issuer string is byte-identical in the protected-resource document, the authorization-server
document and every ``iss`` parameter (Claude compares them byte-for-byte). When the base is
refused, NOTHING is served: every ``.well-known`` and ``/oauth`` path is a 404 (D-02).
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h

BASES = {
    "local": "http://localhost:8000",
    "cloud": "https://api.example",
    "onebox": "https://h/api",
}

PRM_URL = {
    "local": "http://localhost:8000/.well-known/oauth-protected-resource/mcp",
    "cloud": "https://api.example/.well-known/oauth-protected-resource/mcp",
    "onebox": "https://h/.well-known/oauth-protected-resource/api/mcp",
}

PATHS = {
    "local": {"prm_suffixed": "/.well-known/oauth-protected-resource/mcp",
              "prm_root": "/.well-known/oauth-protected-resource",
              "as_metadata": "/.well-known/oauth-authorization-server"},
    "cloud": {"prm_suffixed": "/.well-known/oauth-protected-resource/mcp",
              "prm_root": "/.well-known/oauth-protected-resource",
              "as_metadata": "/.well-known/oauth-authorization-server"},
    "onebox": {"prm_suffixed": "/.well-known/oauth-protected-resource/api/mcp",
               "prm_root": "/.well-known/oauth-protected-resource",
               "as_metadata": "/.well-known/oauth-authorization-server/api"},
}


@pytest.mark.parametrize("topology", sorted(BASES))
def test_issuer_prm_url_and_paths(monkeypatch, topology):
    from app.mcp import oauth_metadata as m

    h.configure(monkeypatch, base=BASES[topology])
    assert m.issuer() == BASES[topology]
    assert m.prm_url() == PRM_URL[topology]
    assert m.well_known_paths() == PATHS[topology]
    assert m.base_path() == ("/api" if topology == "onebox" else "")


@pytest.mark.parametrize("topology", sorted(BASES))
def test_the_two_documents_are_exact(monkeypatch, topology):
    from app.mcp import oauth_metadata as m

    base = BASES[topology]
    h.configure(monkeypatch, base=base)
    assert m.authorization_server_metadata() == {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "revocation_endpoint": f"{base}/oauth/revoke",
        "scopes_supported": ["mcp"],
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "revocation_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
        "client_id_metadata_document_supported": True,
        "authorization_response_iss_parameter_supported": True,
    }
    assert m.protected_resource_metadata() == {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": ["mcp"],
        "bearer_methods_supported": ["header"],
        "resource_name": "Syrel",
    }


@pytest.mark.parametrize("topology", sorted(BASES))
def test_the_issuer_is_byte_identical_everywhere(monkeypatch, topology):
    from app.mcp import oauth_metadata as m
    from app.services.mcp_tool_catalogue import mcp_public_base

    h.configure(monkeypatch, base=BASES[topology])
    issuer = m.authorization_server_metadata()["issuer"]
    assert issuer == m.protected_resource_metadata()["authorization_servers"][0]
    assert issuer == m.issuer() == mcp_public_base()
    assert not issuer.endswith("/")


@pytest.mark.parametrize("topology", sorted(BASES))
def test_the_documents_are_served_at_their_paths(monkeypatch, topology):
    from app.mcp import oauth_metadata as m

    h.configure(monkeypatch, base=BASES[topology])
    client = TestClient(h.fresh_app())
    for key, path in PATHS[topology].items():
        r = client.get(path, headers={"host": "evil.example", "x-forwarded-host": "evil.example"})
        assert r.status_code == 200, (key, path, r.status_code)
        assert r.headers["content-type"].startswith("application/json")
        assert r.headers["cache-control"] == "public, max-age=300"
        assert "evil.example" not in r.text
        expected = (m.authorization_server_metadata() if key == "as_metadata"
                    else m.protected_resource_metadata())
        assert r.json() == expected


def test_there_is_no_openid_configuration(monkeypatch):
    h.configure(monkeypatch)
    client = TestClient(h.fresh_app())
    assert client.get("/.well-known/openid-configuration").status_code == 404


def test_with_no_public_base_nothing_is_served(monkeypatch):
    h.configure(monkeypatch, base=None)
    client = TestClient(h.fresh_app())
    for path in (*PATHS["local"].values(), *PATHS["onebox"].values()):
        assert client.get(path).status_code == 404, path
    assert client.get("/oauth/authorize").status_code == 404
    assert client.post("/oauth/register", json={}).status_code == 404
    from app.mcp import oauth_metadata as m

    assert m.issuer() is None
    assert m.prm_url() is None


def test_main_py_is_not_edited_for_oauth():
    import pathlib

    main = (pathlib.Path(__file__).resolve().parents[2] / "app" / "main.py").read_text(encoding="utf-8")
    assert "oauth_server" not in main and "oauth_metadata" not in main
