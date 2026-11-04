"""Phase 308-02 (D-23 / D-37 / D-45; T-308-01..03) — the ONE closed egress capability ``webhook``.

A webhook endpoint is a URL a member types, so its host is caller-supplied: the capability uses the
``_CALLER`` arm (``send_email`` / ``client_metadata``), with an EMPTY host tuple, https only, the DNS
pin, no redirects and the response cap — exactly the properties every other destination has. Nothing
else in ``egress.py`` changes, and ``test_190_egress.py`` is not amended (its empty-tuple rule already
admits a ``_CALLER`` key).
"""
from __future__ import annotations

import httpx
import pytest

from app.security import egress

URL = "https://hooks.example.com/syrel"
PUBLIC = "93.184.216.34"


def _resolver(*addresses):
    calls: list[str] = []

    def resolve(host, port):
        calls.append(host)
        return list(addresses)

    resolve.calls = calls  # type: ignore[attr-defined]
    return resolve


def _transport(status=200, body: bytes = b"", headers: dict | None = None, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, stream=httpx.ByteStream(body), headers=headers or {})

    return httpx.MockTransport(handler)


def test_webhook_is_wired_in_all_three_tables():
    assert egress.ALLOWED_HOST_SUFFIXES["webhook"] == ()
    assert egress._HOST_MATCH["webhook"] == egress._CALLER
    assert egress._TLS_SCHEMES["webhook"] == frozenset({"https"})


def test_webhook_sits_directly_after_client_metadata_in_every_table():
    for table in (egress.ALLOWED_HOST_SUFFIXES, egress._HOST_MATCH, egress._TLS_SCHEMES):
        keys = list(table)
        assert keys.index("webhook") == keys.index("client_metadata") + 1


def test_webhook_pins_to_the_callers_host_only():
    pinned = egress.validate_destination(
        "webhook", URL, allowed_host="hooks.example.com", resolver=_resolver(PUBLIC)
    )
    assert (pinned.ip, pinned.hostname, pinned.port, pinned.scheme) == (
        PUBLIC, "hooks.example.com", 443, "https",
    )
    with pytest.raises(egress.EgressRefused) as other:
        egress.validate_destination(
            "webhook", URL, allowed_host="other.example.com", resolver=_resolver(PUBLIC)
        )
    assert other.value.reason_code == "host_not_allowed"
    with pytest.raises(egress.EgressRefused) as none_given:
        egress.validate_destination("webhook", URL, resolver=_resolver(PUBLIC))
    assert none_given.value.reason_code == "host_not_allowed"


def test_webhook_keeps_a_non_default_port():
    pinned = egress.validate_destination(
        "webhook", "https://hooks.example.com:8443/a?token=x",
        allowed_host="hooks.example.com", resolver=_resolver(PUBLIC),
    )
    assert pinned.port == 8443


def test_webhook_refuses_cleartext():
    with pytest.raises(egress.EgressRefused) as plain:
        egress.validate_destination(
            "webhook", "http://hooks.example.com/syrel",
            allowed_host="hooks.example.com", resolver=_resolver(PUBLIC),
        )
    assert plain.value.reason_code == "scheme_not_tls"


async def test_a_webhook_post_goes_to_the_pinned_address_with_the_name_restored():
    seen: list[httpx.Request] = []
    resp = await egress.send_pinned_http(
        "webhook", "POST", URL, content=b'{"a":1}',
        headers={"content-type": "application/json"},
        timeout=10.0, max_bytes=65_536, allowed_host="hooks.example.com",
        resolver=_resolver(PUBLIC), transport=_transport(204, seen=seen),
    )
    assert resp.status_code == 204
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert req.url.host == PUBLIC
    assert req.headers["host"] == "hooks.example.com"
    assert req.content == b'{"a":1}'
