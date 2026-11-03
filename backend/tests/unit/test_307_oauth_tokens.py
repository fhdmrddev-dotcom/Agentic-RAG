"""Phase 307-01 (D-17, D-01, D-18) — the pure OAuth token primitives.

``app/security/oauth_tokens.py`` does no I/O: it mints the two opaque token shapes, digests a
presented token of ONE kind, verifies a PKCE S256 pair in constant time, and canonicalises a
resource URL so ``/mcp`` and ``/mcp/`` (or ``LocalHost`` and ``localhost``) compare equal.
"""

from __future__ import annotations

import hashlib
import inspect

import pytest

from app.security import oauth_tokens as ot

RFC7636_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
# RFC 7636 appendix B, verbatim. ⚠ The 307-01 PLAN quoted the challenge as "...URWbuGgSN6cXdM",
# which is NOT the RFC's value (measured: sha256 of the verifier gives "...URWbuGJSstw-cM", the
# RFC's own text). That mistyped string is kept below as a wrong-challenge case.
RFC7636_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
PLAN_MISTYPED_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGgSN6cXdM"


def test_constants():
    assert ot.ACCESS_TOKEN_PREFIX == "srl_oat_"
    assert ot.REFRESH_TOKEN_PREFIX == "srl_ort_"
    assert ot.ACCESS_TTL_SECONDS == 3600
    assert ot.GRANT_TTL_DAYS == 90
    assert ot.REFRESH_GRACE_SECONDS == 60


@pytest.mark.parametrize("kind,prefix", [("access", "srl_oat_"), ("refresh", "srl_ort_")])
def test_mint_token_shape(kind, prefix):
    a, b = ot.mint_token(kind), ot.mint_token(kind)
    assert a.startswith(prefix) and b.startswith(prefix)
    assert a != b
    body = a[len(prefix):]
    assert len(body) == 43
    assert all(ch.isalnum() or ch in "-_" for ch in body)


def test_digest_token_accepts_its_own_kind_only():
    access, refresh = ot.mint_token("access"), ot.mint_token("refresh")
    d = ot.digest_token(access, "access")
    assert d == hashlib.sha256(access.encode()).hexdigest() and len(d) == 64
    assert ot.digest_token(refresh, "refresh") == hashlib.sha256(refresh.encode()).hexdigest()
    assert ot.digest_token(refresh, "access") is None
    assert ot.digest_token(access, "refresh") is None


@pytest.mark.parametrize(
    "presented",
    [
        "",
        "srl_mcp_" + "a" * 43,
        "srl_live_" + "a" * 43,
        "srl_oat_" + "a" * 121,          # 129 chars
        "srl_oat_abc def",
        "srl_oat_abc+def/=",
        "srl_oat_",
        "srl_oat_é",
    ],
)
def test_digest_token_refuses_malformed(presented):
    assert ot.digest_token(presented, "access") is None


def test_pkce_rfc7636_appendix_b_vector():
    assert ot.pkce_s256_matches(RFC7636_VERIFIER, RFC7636_CHALLENGE) is True


@pytest.mark.parametrize(
    "verifier,challenge",
    [
        (RFC7636_VERIFIER, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cN"),   # wrong challenge
        (RFC7636_VERIFIER, PLAN_MISTYPED_CHALLENGE),
        (RFC7636_VERIFIER, ""),
        ("a" * 42, None),                                                   # too short
        ("a" * 129, None),                                                  # too long
        ("a" * 42 + "!", None),                                             # outside the set
        ("a" * 42 + "é", None),
    ],
)
def test_pkce_refuses(verifier, challenge):
    if challenge is None:
        import base64

        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode("utf-8")).digest()
        ).decode().rstrip("=")
    assert ot.pkce_s256_matches(verifier, challenge) is False


def test_pkce_accepts_the_full_unreserved_set():
    import base64

    verifier = ("Az09-._~" * 6)[:60]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    assert ot.pkce_s256_matches(verifier, challenge) is True


def test_pkce_compares_in_constant_time():
    assert "compare_digest" in inspect.getsource(ot.pkce_s256_matches)


@pytest.mark.parametrize(
    "a,b",
    [
        ("HTTP://LocalHost:8000/mcp/", "http://localhost:8000/mcp"),
        ("https://API.example.com:443/mcp", "https://api.example.com/mcp"),
        ("http://example.com:80/mcp/", "http://example.com/mcp"),
    ],
)
def test_canonical_resource_equalities(a, b):
    assert ot.canonical_resource(a) is not None
    assert ot.canonical_resource(a) == ot.canonical_resource(b)


def test_canonical_resource_exact_form():
    assert ot.canonical_resource("HTTP://LocalHost:8000/mcp/") == "http://localhost:8000/mcp"
    assert ot.canonical_resource("https://api.example.com:8443/mcp") == "https://api.example.com:8443/mcp"


@pytest.mark.parametrize(
    "a,b",
    [
        ("http://localhost:8000/mcp", "http://localhost:8001/mcp"),
        ("http://localhost:8000/mcp", "https://localhost:8000/mcp"),
        ("http://localhost:8000/mcp", "http://127.0.0.1:8000/mcp"),
        ("https://a.example/mcp", "https://a.example/mcp/x"),
    ],
)
def test_canonical_resource_differences(a, b):
    assert ot.canonical_resource(a) != ot.canonical_resource(b)


@pytest.mark.parametrize(
    "value",
    [
        "https://api.example.com/mcp#frag",
        "https://user:pw@api.example.com/mcp",
        "https://user@api.example.com/mcp",
        "https:///mcp",
        "/mcp",
        "ftp://api.example.com/mcp",
        "javascript:alert(1)",
        "https://api.example.com:notaport/mcp",
        "",
        None,
    ],
)
def test_canonical_resource_refuses(value):
    assert ot.canonical_resource(value) is None


def test_module_is_pure():
    src = inspect.getsource(ot)
    for banned in ("import httpx", "import requests", "import asyncpg", "from app.db"):
        assert banned not in src, banned
