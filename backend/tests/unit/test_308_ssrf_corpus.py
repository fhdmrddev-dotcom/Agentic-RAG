"""Phase 308-02 (D-24; T-308-01 / T-308-02 / T-308-03 / T-308-04) — the SSRF refusal corpus, driven
at SAVE and at SEND.

At save a URL passes two layers: ``webhook_urls.check_webhook_url`` (https, no userinfo, no fragment,
parseable) and ``egress.validate_destination("webhook", …)`` (host, then EVERY resolved address).
At send ``egress.send_pinned_http`` re-validates and re-resolves, so a name that answered public at
save and private at send (DNS rebinding) is refused before the transport, and a 302 to an internal
host is refused as ``redirected`` after exactly one request.

No case makes a real DNS query: names go through an injected resolver that answers as glibc would
(``2130706433`` / ``0x7f000001`` / ``127.1`` -> 127.0.0.1, as ``inet_aton`` resolves them on Linux),
IP literals go through a resolver that refuses anything that is not a literal, and the default
resolver is replaced for the whole module with one that raises if it is ever reached.
"""
from __future__ import annotations

import ipaddress

import httpx
import pytest

from app.security import egress
from app.services.webhook_urls import WebhookUrlError, check_webhook_url, host_of

PUBLIC = "93.184.216.34"


@pytest.fixture(autouse=True)
def _no_real_dns(monkeypatch):
    def refuse(host, port):  # pragma: no cover - reaching it IS the failure
        raise AssertionError(f"a corpus case reached the real resolver for {host!r}")

    monkeypatch.setattr(egress, "_default_resolver", refuse)


def _names(mapping: dict[str, list[str]]):
    """A name resolver: answers only the names it was told, and records every lookup."""
    calls: list[str] = []

    def resolve(host, port):
        calls.append(host)
        if host not in mapping:
            raise AssertionError(f"unexpected lookup {host!r}")
        return list(mapping[host])

    resolve.calls = calls  # type: ignore[attr-defined]
    return resolve


def _literal(host, port):
    """What getaddrinfo answers for a numeric host — the literal itself, with no lookup."""
    ipaddress.ip_address(host)  # raises (fails the case) for anything that is a NAME
    return [host]


def _transport(status=200, headers: dict | None = None, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, stream=httpx.ByteStream(b""), headers=headers or {})

    return httpx.MockTransport(handler)


# (id, url, resolver, expected layer, expected code)
#   layer "url"    -> check_webhook_url refuses (WebhookUrlError.code)
#   layer "egress" -> validate_destination refuses (EgressRefused.reason_code)
CORPUS = [
    ("http", "http://hooks.example.com/x", None, "url", "not_https"),
    ("localhost", "https://localhost/x", _names({"localhost": ["127.0.0.1"]}), "egress", "address_not_public"),
    ("loopback-v4", "https://127.0.0.1/x", _literal, "egress", "address_not_public"),
    ("loopback-v6", "https://[::1]/x", _literal, "egress", "address_not_public"),
    ("rfc1918-10", "https://10.0.0.1/x", _literal, "egress", "address_not_public"),
    ("rfc1918-172", "https://172.16.0.1/x", _literal, "egress", "address_not_public"),
    ("rfc1918-192", "https://192.168.1.1/x", _literal, "egress", "address_not_public"),
    ("cgnat-100-64", "https://100.64.0.1/x", _literal, "egress", "address_not_public"),
    ("link-local-metadata", "https://169.254.169.254/latest/meta-data", _literal, "egress", "address_not_public"),
    ("gcp-metadata-name", "https://metadata.google.internal/computeMetadata/v1/",
     _names({"metadata.google.internal": ["169.254.169.254"]}), "egress", "address_not_public"),
    ("v4-mapped-v6", "https://[::ffff:127.0.0.1]/x", _literal, "egress", "address_not_public"),
    ("decimal", "https://2130706433/x", _names({"2130706433": ["127.0.0.1"]}), "egress", "address_not_public"),
    ("hex", "https://0x7f000001/x", _names({"0x7f000001": ["127.0.0.1"]}), "egress", "address_not_public"),
    ("short-dotted", "https://127.1/x", _names({"127.1": ["127.0.0.1"]}), "egress", "address_not_public"),
    ("octal", "https://0177.0.0.1/x", None, "url", "not_url"),
    ("userinfo-user-pass", "https://u:p@hooks.example.com/x", None, "url", "userinfo"),
    ("userinfo-user", "https://u@hooks.example.com/x", None, "url", "userinfo"),
    ("public-name-private-answer", "https://hooks.attacker.example/x",
     _names({"hooks.attacker.example": ["10.0.0.5"]}), "egress", "address_not_public"),
    ("one-private-answer-among-public", "https://mixed.example/x",
     _names({"mixed.example": [PUBLIC, "192.168.0.7"]}), "egress", "address_not_public"),
]


def _refused_at_save(url: str, resolver) -> tuple[str, str] | None:
    try:
        check_webhook_url(url)
    except WebhookUrlError as exc:
        return ("url", exc.code)
    try:
        egress.validate_destination("webhook", url, None, allowed_host=host_of(url), resolver=resolver)
    except egress.EgressRefused as exc:
        return ("egress", exc.reason_code)
    return None


def test_the_corpus_covers_every_d24_entry():
    # http, localhost, 127/8, ::1, 10/8, 172.16/12, 192.168/16, 100.64/10, 169.254.169.254,
    # metadata.google.internal, v4-mapped, decimal, octal, hex, userinfo, a public name answering
    # private — plus the 302 and the DNS flip below (send-only cases).
    assert len(CORPUS) >= 18


@pytest.mark.parametrize(
    "url, resolver, layer, code", [c[1:] for c in CORPUS], ids=[c[0] for c in CORPUS]
)
def test_every_corpus_entry_is_refused_at_save(url, resolver, layer, code):
    assert _refused_at_save(url, resolver) == (layer, code)


@pytest.mark.parametrize(
    "url, resolver, layer, code",
    [c[1:] for c in CORPUS if c[3] == "egress" or c[4] in ("not_https", "not_url")],
    ids=[c[0] for c in CORPUS if c[3] == "egress" or c[4] in ("not_https", "not_url")],
)
async def test_every_address_entry_is_refused_by_egress_at_send(url, resolver, layer, code):
    seen: list = []
    host = ""
    try:
        host = host_of(url)
    except Exception:  # noqa: BLE001 — an unparseable URL has no host; egress refuses it anyway
        pass
    with pytest.raises(egress.EgressRefused):
        await egress.send_pinned_http(
            "webhook", "POST", url, content=b"{}", timeout=10.0, max_bytes=65_536,
            allowed_host=host or None, resolver=resolver, transport=_transport(seen=seen),
        )
    assert seen == [], "the request reached the transport for a refused destination"


def test_userinfo_passes_egress_alone_which_is_why_the_url_rule_exists():
    # D-46 / Pitfall 7: egress reads .host only. This pins WHY check_webhook_url must run first.
    url = "https://u:p@hooks.example.com/x"
    pinned = egress.validate_destination(
        "webhook", url, None, allowed_host=host_of(url), resolver=_names({"hooks.example.com": [PUBLIC]}),
    )
    assert pinned.hostname == "hooks.example.com"


def test_a_public_address_is_allowed():
    url = "https://hooks.example.com/x"
    assert _refused_at_save(url, _names({"hooks.example.com": [PUBLIC]})) is None


async def test_a_dns_flip_between_save_and_send_is_refused_at_send():
    url = "https://rebind.example/x"
    answers = iter([[PUBLIC], ["127.0.0.1"]])
    lookups: list[str] = []

    def flip(host, port):
        lookups.append(host)
        return next(answers)

    assert _refused_at_save(url, flip) is None  # public at save
    seen: list = []
    with pytest.raises(egress.EgressRefused) as err:
        await egress.send_pinned_http(
            "webhook", "POST", url, content=b"{}", timeout=10.0, max_bytes=65_536,
            allowed_host=host_of(url), resolver=flip, transport=_transport(seen=seen),
        )
    assert err.value.reason_code == "address_not_public"
    assert lookups == ["rebind.example", "rebind.example"], "send must re-resolve, never reuse save's answer"
    assert seen == []


async def test_a_302_to_an_internal_host_is_refused_after_one_request():
    url = "https://hooks.example.com/x"
    seen: list = []
    with pytest.raises(egress.EgressRefused) as err:
        await egress.send_pinned_http(
            "webhook", "POST", url, content=b"{}", timeout=10.0, max_bytes=65_536,
            allowed_host=host_of(url), resolver=_names({"hooks.example.com": [PUBLIC]}),
            transport=_transport(302, headers={"location": "http://169.254.169.254/"}, seen=seen),
        )
    assert err.value.reason_code == "redirected"
    assert len(seen) == 1
