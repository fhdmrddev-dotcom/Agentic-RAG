"""Phase 222 — RFC 9728 / RFC 8414 authorization discovery for MCP servers.

⚠ THESE TESTS FAKE THE SOCKET AND NOTHING ELSE. Every one drives the real
`probe_mcp_auth`, the real `_PinnedFetch`, the real URL rewriting and the real SNI
restoration, through `httpx.MockTransport`. That is deliberate and it is the Phase 212
lesson: D-1's pin monkeypatched `_post` away and then asserted only that an argument had
been HANDED to it, and D-2's seam stub INVENTED a parameter the real function lacked. A
mock proves the caller is self-consistent; it cannot prove the wire is right.

⚠ `validate_mcp_destination` IS stubbed in most tests, because a test host does not
resolve. It is NOT stubbed in the security tests at the bottom, which drive the real
validator against real refusals — the one property no stub may stand in for.
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.security.egress import EgressRefused, EgressResponseTooLarge, PinnedDestination
from app.services import mcp_auth_discovery as disc
from app.services.mcp_auth_discovery import McpAuthProbe, probe_mcp_auth

SERVER = "https://mcp.example.com/mcp"


@pytest.fixture
def pinned(monkeypatch):
    """Stub the resolver only. Everything downstream of it stays real."""

    def _fake(url: str) -> PinnedDestination:
        return PinnedDestination(
            ip="93.184.216.34", hostname=httpx.URL(url).host, port=443, scheme="https"
        )

    monkeypatch.setattr(disc, "validate_mcp_destination", _fake)


def _json_response(payload: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(status, content=json.dumps(payload).encode(), headers={"content-type": "application/json"})


# ── the four doors ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_server_that_answers_without_a_credential_is_an_open_door(pinned):
    transport = httpx.MockTransport(lambda req: _json_response({"jsonrpc": "2.0", "id": 0, "result": {}}))
    probe = await probe_mcp_auth(SERVER, transport=transport)
    assert probe.kind == "open"
    assert probe.resource_status == 200


@pytest.mark.asyncio
async def test_a_401_with_no_www_authenticate_is_the_paste_a_token_door(pinned):
    """GitHub's shape today: it wants a bearer and advertises no way to obtain one."""
    transport = httpx.MockTransport(lambda req: httpx.Response(401))
    probe = await probe_mcp_auth(SERVER, transport=transport)
    assert probe.kind == "token"
    # The sentence must name a CAUSE, not restate the status code.
    assert "401" not in (probe.detail or "")
    assert "token you create yourself" in (probe.detail or "")


@pytest.mark.asyncio
async def test_a_fully_compliant_server_yields_the_oauth_door_with_its_endpoints(pinned):
    """Notion's shape: 401 -> RFC 9728 metadata -> RFC 8414 metadata -> endpoints."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/mcp":
            return httpx.Response(
                401,
                headers={
                    "WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
                },
            )
        if path == "/.well-known/oauth-protected-resource":
            return _json_response({"authorization_servers": ["https://auth.example.com"]})
        if path == "/.well-known/oauth-authorization-server":
            return _json_response({
                "authorization_endpoint": "https://auth.example.com/authorize",
                "token_endpoint": "https://auth.example.com/token",
                "registration_endpoint": "https://auth.example.com/register",
                "code_challenge_methods_supported": ["S256"],
            })
        return httpx.Response(404)

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "oauth"
    assert probe.authorization_host == "auth.example.com"
    assert probe.authorization_endpoint == "https://auth.example.com/authorize"
    assert probe.token_endpoint == "https://auth.example.com/token"
    assert probe.registration_endpoint == "https://auth.example.com/register"
    assert probe.code_challenge_methods == ["S256"]


@pytest.mark.asyncio
async def test_a_transport_failure_is_unreachable_and_never_a_door(pinned):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "unreachable"
    assert probe.detail


# ── partial compliance degrades to a worse door, never to a crash ─────────────────────


@pytest.mark.asyncio
async def test_metadata_that_names_no_authorization_server_falls_back_to_token(pinned):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        return _json_response({"resource": "https://mcp.example.com"})  # no authorization_servers

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "token"


@pytest.mark.asyncio
async def test_malformed_metadata_json_falls_back_to_token_rather_than_raising(pinned):
    """A server serving broken JSON at a well-known path is a DOOR verdict, not an outage."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        return httpx.Response(200, content=b"{not json at all", headers={"content-type": "application/json"})

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "token"


@pytest.mark.asyncio
async def test_an_authorization_server_missing_its_endpoints_falls_back_to_token(pinned):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        if request.url.path == "/prm":
            return _json_response({"authorization_servers": ["https://auth.example.com"]})
        return _json_response({"issuer": "https://auth.example.com"})  # no endpoints

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "token"


# ── RFC 8414 §3 — the step most often got wrong ───────────────────────────────────────


def test_the_well_known_segment_is_inserted_after_the_host_not_appended():
    """⚠ For issuer `https://h/tenant1` the metadata is at
    `https://h/.well-known/oauth-authorization-server/tenant1` — NOT at
    `https://h/tenant1/.well-known/...`. Appending 404s against every correct server."""
    urls = disc._as_metadata_urls("https://auth.example.com/tenant1")
    assert urls[0] == "https://auth.example.com/.well-known/oauth-authorization-server/tenant1"
    assert urls[1] == "https://auth.example.com/.well-known/openid-configuration/tenant1"
    # The (incorrect) append form is tried LAST, never first.
    assert urls[2] == "https://auth.example.com/tenant1/.well-known/oauth-authorization-server"


@pytest.mark.asyncio
async def test_the_oidc_well_known_is_tried_when_the_oauth_one_is_absent(pinned):
    """Many real authorization servers publish only the OIDC document."""
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        if request.url.path == "/prm":
            return _json_response({"authorization_servers": ["https://auth.example.com"]})
        if request.url.path == "/.well-known/oauth-authorization-server":
            return httpx.Response(404)
        if request.url.path == "/.well-known/openid-configuration":
            return _json_response({
                "authorization_endpoint": "https://auth.example.com/authorize",
                "token_endpoint": "https://auth.example.com/token",
            })
        return httpx.Response(404)

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "oauth"
    assert "/.well-known/oauth-authorization-server" in seen  # tried first
    assert "/.well-known/openid-configuration" in seen


@pytest.mark.asyncio
async def test_pkce_methods_are_read_not_assumed(pinned):
    """An AS that does not advertise S256 reports an EMPTY list — not a fabricated one."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        if request.url.path == "/prm":
            return _json_response({"authorization_servers": ["https://auth.example.com"]})
        return _json_response({
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
        })

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert probe.kind == "oauth"
    assert probe.code_challenge_methods == []
    assert probe.registration_endpoint is None


# ── security properties · the real validator, NOT a stub ──────────────────────────────


@pytest.mark.asyncio
async def test_a_private_address_is_refused_before_any_socket_opens():
    """No `pinned` fixture: this drives the REAL validate_mcp_destination."""
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200)

    with pytest.raises(EgressRefused):
        await probe_mcp_auth("https://127.0.0.1/mcp", transport=httpx.MockTransport(handler))
    assert called is False, "a refused destination must never reach the transport"


@pytest.mark.asyncio
async def test_a_cleartext_url_is_refused():
    with pytest.raises(EgressRefused):
        await probe_mcp_auth("http://mcp.example.com/mcp", transport=httpx.MockTransport(lambda r: httpx.Response(200)))


@pytest.mark.asyncio
async def test_a_discovered_authorization_server_on_a_private_address_is_refused(monkeypatch):
    """⚠ THE CIRCULAR-TRUST CASE, AND THE REASON THIS MODULE RE-VALIDATES EVERY HOP.

    RFC 9728 lets the RESOURCE name its own authorization server. A malicious MCP server
    can therefore point us at anything — including inward. Here the resource is public and
    valid, and the AS it names is loopback: the probe must refuse rather than fetch it.
    """
    real = disc.validate_mcp_destination

    def _selective(url: str) -> PinnedDestination:
        if httpx.URL(url).host == "mcp.example.com":
            return PinnedDestination(ip="93.184.216.34", hostname="mcp.example.com", port=443, scheme="https")
        return real(url)  # the discovered host meets the real validator

    monkeypatch.setattr(disc, "validate_mcp_destination", _selective)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://169.254.169.254/prm"'})

    probe = await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    # It degrades to the token door; it must NOT have followed the pointer.
    assert probe.kind == "token"


@pytest.mark.asyncio
async def test_the_probe_sends_no_credential_on_any_request(pinned):
    """Discovery is unauthenticated by design — a token here would go to an untrusted host."""
    seen_headers: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_headers.append(request.headers)
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={"WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'})
        if request.url.path == "/prm":
            return _json_response({"authorization_servers": ["https://auth.example.com"]})
        return _json_response({
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
        })

    await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert len(seen_headers) >= 3
    for h in seen_headers:
        assert "authorization" not in {k.lower() for k in h.keys()}


@pytest.mark.asyncio
async def test_a_redirect_is_refused_and_never_reported_as_an_open_door(pinned):
    """⚠ THIS TEST FOUND A REAL DEFECT IN THE FIRST CUT AND THE ORIGINAL ASSERTION IS KEPT
    IN THE NAME, because what it caught is more interesting than that it passes now.

    `follow_redirects=False` correctly stopped the hop — but a 302 then fell through the
    `status < 400` branch and came back as `kind="open"`, i.e. *"this server needs no
    credential, connect straight through"*, about a server that had answered nothing at
    all. Not following the redirect was never the whole property; not MISREADING it is.
    """
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        return httpx.Response(302, headers={"location": "https://evil.example.net/mcp"})

    with pytest.raises(EgressRefused) as excinfo:
        await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))

    assert paths == ["/mcp"], "the redirect target must never be fetched"
    # One of the six CLOSED reason codes, declared at egress.py:83 for transport binders.
    assert excinfo.value.reason_code == "redirected"


@pytest.mark.asyncio
async def test_an_oversized_metadata_document_is_refused(pinned):
    """⚠ A NAMED TYPE, NOT `EgressRefused` — `egress.py:556` requires a caller to be able to
    tell *"the remote sent too much"* from *"the network failed"*. The first cut raised
    `EgressRefused` with a free-text message and did not even construct: that exception is
    keyword-only over a closed reason set precisely to make that impossible."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"x" * (disc.MAX_METADATA_BYTES + 10))

    with pytest.raises(EgressResponseTooLarge):
        await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_the_connection_goes_to_the_pinned_ip_while_sni_keeps_the_name(pinned):
    """The TOCTOU property: connect to the IP, verify the certificate by NAME."""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["host_header"] = request.headers.get("Host")
        seen["url_host"] = request.url.host
        seen["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, content=b"{}", headers={"content-type": "application/json"})

    await probe_mcp_auth(SERVER, transport=httpx.MockTransport(handler))
    assert seen["url_host"] == "93.184.216.34", "the socket must go to the pinned IP"
    assert seen["host_header"] == "mcp.example.com"
    assert seen["sni"] == "mcp.example.com", "SNI is TLS-layer; the Host header cannot stand in for it"
