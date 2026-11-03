"""Phase 307-02 (D-06, D-05; T-307-09, T-307-19) — the CIMD fetch goes through the egress guard only.

``fetch_cimd_document(url)`` fetches an attacker-choosable https URL, so it is an SSRF surface. It
calls ``egress.send_pinned_http("client_metadata", ...)`` and nothing else: public addresses only,
DNS pinned, no redirects, 16 KB cap — inside ``asyncio.wait_for(..., 5.0)`` because the DNS lookup
is not bounded by the httpx timeout (egress.py's CR-04 note). Every failure is one reason,
``metadata_unreadable``; the document is never partially trusted.
"""
from __future__ import annotations

import json
import time

import httpx
import pytest

from app.mcp import oauth_clients
from app.mcp.oauth_clients import (
    CIMD_MAX_BYTES,
    CIMD_TTL_DEFAULT,
    CIMD_TTL_MAX,
    CIMD_TTL_MIN,
    fetch_cimd_document,
)
from app.security import egress

URL = "https://claude.ai/oauth/claude-code-client-metadata"
DOC = {
    "client_id": URL,
    "client_name": "Claude Code",
    "client_uri": "https://claude.ai",
    "redirect_uris": ["http://localhost/callback", "http://127.0.0.1/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
}
PUBLIC = "104.18.32.47"


def _resolver(*addresses):
    calls: list[str] = []

    def resolve(host, port):
        calls.append(host)
        return list(addresses)

    resolve.calls = calls  # type: ignore[attr-defined]
    return resolve


def _transport(status=200, body: bytes | None = None, headers: dict | None = None, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        payload = json.dumps(DOC).encode() if body is None else body
        # A raw stream, not ``content=``: the binder reads with ``aiter_raw`` (the test_190 shape).
        return httpx.Response(status, stream=httpx.ByteStream(payload), headers=headers or {})

    return httpx.MockTransport(handler)


async def test_a_good_document_is_returned_with_its_ttl():
    seen: list[httpx.Request] = []
    out = await fetch_cimd_document(
        URL, resolver=_resolver(PUBLIC),
        transport=_transport(headers={"cache-control": "public, max-age=300"}, seen=seen),
    )
    assert out == (DOC, 300)
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "GET"
    assert req.url.host == PUBLIC  # pinned to the validated address
    assert req.headers["host"] == "claude.ai"
    assert req.headers["accept"] == "application/json"
    assert req.headers["user-agent"] == "Syrel-OAuth/1"


@pytest.mark.parametrize("cache_control, ttl", [
    (None, CIMD_TTL_DEFAULT),
    ("max-age=10", CIMD_TTL_MIN),
    ("public, max-age=999999", CIMD_TTL_MAX),
    ("max-age=7200", 7200),
    ("no-store", CIMD_TTL_MIN),
    ("no-cache", CIMD_TTL_MIN),
    ("max-age=abc", CIMD_TTL_DEFAULT),
])
async def test_cache_control_is_honoured_and_clamped(cache_control, ttl):
    headers = {"cache-control": cache_control} if cache_control else {}
    out = await fetch_cimd_document(URL, resolver=_resolver(PUBLIC), transport=_transport(headers=headers))
    assert out == (DOC, ttl)
    assert (CIMD_TTL_MIN, CIMD_TTL_MAX, CIMD_TTL_DEFAULT) == (300, 86_400, 3_600)


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.5", "192.168.1.9", "169.254.169.254", "::1"])
async def test_private_and_metadata_addresses_are_refused(address):
    seen: list = []
    out = await fetch_cimd_document(URL, resolver=_resolver(address), transport=_transport(seen=seen))
    assert out == "metadata_unreadable"
    assert seen == [], "the request reached the transport for a refused address"


@pytest.mark.parametrize("status, body, headers", [
    (302, b"", {"location": "http://169.254.169.254/latest"}),
    (404, b"{}", {}),
    (500, b"{}", {}),
    (200, b"<html>no</html>", {"content-type": "text/html"}),
    (200, b"[1, 2]", {}),
    (200, b"x" * (CIMD_MAX_BYTES + 1), {}),
    (200, json.dumps(dict(DOC, client_id="https://claude.ai/other")).encode(), {}),
])
async def test_bad_answers_are_unreadable(status, body, headers):
    out = await fetch_cimd_document(
        URL, resolver=_resolver(PUBLIC), transport=_transport(status, body, headers)
    )
    assert out == "metadata_unreadable"


async def test_a_bad_url_is_refused_before_any_lookup():
    resolve = _resolver(PUBLIC)
    out = await fetch_cimd_document("https://claude.ai:8443/meta", resolver=resolve, transport=_transport())
    assert out == "metadata_unreadable"
    assert resolve.calls == []


async def test_a_resolver_that_hangs_is_refused_inside_five_and_a_half_seconds():
    def sleepy(host, port):
        time.sleep(10)
        return [PUBLIC]

    started = time.monotonic()
    out = await fetch_cimd_document(URL, resolver=sleepy, transport=_transport())
    elapsed = time.monotonic() - started
    assert out == "metadata_unreadable"
    assert elapsed < 5.5, f"the CIMD fetch took {elapsed:.2f}s — Claude gives up at 10 s"


async def test_the_fetch_goes_through_send_pinned_http_with_the_client_metadata_capability(monkeypatch):
    calls: list[tuple] = []

    async def spy(capability, method, url, **kw):
        calls.append((capability, method, url, kw))
        return egress.PinnedResponse(200, {"content-type": "application/json"}, json.dumps(DOC).encode())

    monkeypatch.setattr(egress, "send_pinned_http", spy)
    out = await oauth_clients.fetch_cimd_document(URL)
    assert out == (DOC, CIMD_TTL_DEFAULT)
    assert len(calls) == 1
    capability, method, url, kw = calls[0]
    assert (capability, method, url) == ("client_metadata", "GET", URL)
    assert kw["allowed_host"] == "claude.ai"
    assert kw["timeout"] == 4.0
    assert kw["max_bytes"] == 16_384
    assert kw["headers"] == {"Accept": "application/json", "User-Agent": "Syrel-OAuth/1"}


# ── the capability itself (egress.py, D-06) ───────────────────────────────────────────────────


def test_client_metadata_is_wired_in_all_three_tables():
    assert egress.ALLOWED_HOST_SUFFIXES["client_metadata"] == ()
    assert egress._HOST_MATCH["client_metadata"] == egress._CALLER
    assert egress._TLS_SCHEMES["client_metadata"] == frozenset({"https"})


def test_client_metadata_pins_to_the_callers_host_only():
    pinned = egress.validate_destination(
        "client_metadata", URL, allowed_host="claude.ai", resolver=_resolver(PUBLIC)
    )
    assert (pinned.ip, pinned.hostname, pinned.port) == (PUBLIC, "claude.ai", 443)
    with pytest.raises(egress.EgressRefused) as other:
        egress.validate_destination(
            "client_metadata", URL, allowed_host="claude.com", resolver=_resolver(PUBLIC)
        )
    assert other.value.reason_code == "host_not_allowed"
    with pytest.raises(egress.EgressRefused) as none_given:
        egress.validate_destination("client_metadata", URL, resolver=_resolver(PUBLIC))
    assert none_given.value.reason_code == "host_not_allowed"
    with pytest.raises(egress.EgressRefused) as plain:
        egress.validate_destination(
            "client_metadata", "http://claude.ai/m", allowed_host="claude.ai", resolver=_resolver(PUBLIC)
        )
    assert plain.value.reason_code == "scheme_not_tls"
