"""Phase 307-02 (D-22, D-23, D-53; T-307-16) — the /mcp 401 is the OAuth challenge.

``WWW-Authenticate: Bearer resource_metadata="<PRM URL>"`` (RFC 9728, path-inserted), configured
ONCE per base by ``register_mcp`` and byte-identical for every key AND token failure, so no refusal
kind can be told from another. The two switched-off refusals stay 403 with their sentence (a 403 is
terminal for Claude — it must not start a sign-in for a switched-off org).
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.security.api_key_auth import KeyRefused
from tests.unit import _mcp305_harness as h

TOKEN = "srl_oat_" + "A" * 43


def _refusing(reason, sentence=None):
    async def resolve(presented, *, pool, redis):
        raise KeyRefused(reason, sentence)

    return resolve


def _fingerprint(r):
    return (r.status_code, r.content, sorted((k.lower(), v) for k, v in r.headers.items()))


def _post(monkeypatch, auth, resolver=None, base=h.BASE):
    h.configure(monkeypatch, base=base)
    h.stub_edge(monkeypatch, resolver)
    headers = {"accept": "application/json, text/event-stream", "content-type": "application/json"}
    if auth is not None:
        headers["authorization"] = auth
    with TestClient(h.fresh_app(), base_url=base) as c:
        return c.post("/mcp", headers=headers, json=h.initialize_body())


CASES = [
    ("no token", None, None),
    ("basic", "Basic dXNlcjpwYXNz", None),
    ("bad key", f"Bearer {h.KEY}", "unknown"),
    ("unknown srl_oat_", f"Bearer {TOKEN}", "unknown"),
    ("expired token", f"Bearer {TOKEN}", "expired"),
    ("revoked grant", f"Bearer {TOKEN}", "revoked"),
    ("wrong resource", f"Bearer {TOKEN}", "wrong_resource"),
    ("not member", f"Bearer {TOKEN}", "not_member"),
]


def test_every_key_and_token_failure_is_one_identical_challenge(monkeypatch):
    prints = {}
    for label, auth, reason in CASES:
        prints[label] = _fingerprint(_post(monkeypatch, auth, _refusing(reason) if reason else None))
    first = prints["no token"]
    assert first[0] == 401
    challenge = 'Bearer resource_metadata="http://localhost:8000/.well-known/oauth-protected-resource/mcp"'
    assert ("www-authenticate", challenge) in first[2]
    for label, fp in prints.items():
        assert fp == first, f"{label!r} differs from the one 401"


@pytest.mark.parametrize("base, prm", [
    ("https://api.example", "https://api.example/.well-known/oauth-protected-resource/mcp"),
    ("https://h/api", "https://h/.well-known/oauth-protected-resource/api/mcp"),
])
def test_the_challenge_follows_the_base(monkeypatch, base, prm):
    r = _post(monkeypatch, None, base=base)
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == f'Bearer resource_metadata="{prm}"'


def test_the_401_body_is_unchanged_by_the_challenge(monkeypatch):
    import app.mcp.edge as edge

    before = edge._INVALID_BODY
    h.configure(monkeypatch, base="https://api.example")
    h.fresh_app()
    assert edge._INVALID_BODY == before
    assert b"invalid_token" in edge._INVALID_BODY
    headers = dict(edge._INVALID_HEADERS)
    assert headers[b"content-length"] == str(len(edge._INVALID_BODY)).encode()
    assert headers[b"www-authenticate"].startswith(b'Bearer resource_metadata="https://api.example/')


@pytest.mark.parametrize("reason", ["mcp_off_org", "mcp_off_deployment"])
def test_switched_off_stays_a_403_with_its_sentence(monkeypatch, reason):
    r = _post(monkeypatch, f"Bearer {TOKEN}", _refusing(reason, "Switched off here."))
    assert r.status_code == 403
    assert r.json() == {"error": "mcp_off", "error_description": "Switched off here."}
    assert "www-authenticate" not in {k.lower() for k in r.headers}


def test_configure_challenge_is_the_one_writer():
    import inspect

    import app.mcp.edge as edge

    assert "resource_metadata=" in inspect.getsource(edge.configure_challenge)
