"""Phase 308-02 (D-16 / D-17 / D-20 / D-41 / D-46; T-308-02..04, T-308-13, T-308-14) — one send
through egress, classified.

* ``classify`` is the RESEARCH outcome table, pure: 2xx sent; 408 / 429 / 5xx / timeout / connect /
  tls retried; redirect, refused_address, response_too_large and other 4xx not retried; 410 gone.
* ``send`` re-asserts the URL rules before egress (D-46: userinfo never reaches it), then calls
  ``egress.send_pinned_http("webhook", "POST", …)`` once with ``content=`` bytes, the 10 s timeout and
  the 64 KB cap, measures latency around the call, and keeps only the status and ``Retry-After``.
* Logs carry the host and an outcome word — never the URL path or query, the body or a secret.
* ``freeze_payload`` passes the guard with ``textless_ok=True``; WITHHELD or a raise is ``None``.
"""
from __future__ import annotations

import asyncio
import dataclasses
import ast
import inspect
import logging
import ssl
import time
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from uuid import UUID

import httpx
import pytest

from app.models import webhook as W
from app.security import egress
from app.services import outbound_guard, webhook_sender
from app.services.webhook_sender import (
    RESPONSE_CAP_BYTES,
    WEBHOOK_TIMEOUT_SECONDS,
    SendOutcome,
    classify,
    freeze_payload,
    parse_retry_after,
    send,
)

PUBLIC = "93.184.216.34"
URL = "https://hooks.example.com/hooks/catch/123/SECRETPATHTOKEN0001/?token=QUERYSECRET"
BODY = b'{"data":{"secret_marker":"BODYSECRET"},"type":"webhook.test"}'
HEADERS = {
    "webhook-id": "msg_x", "webhook-timestamp": "1700000000",
    "webhook-signature": "v1,SIGSECRET", "content-type": "application/json",
    "user-agent": "Syrel-Webhooks/1",
}
ORG = "44444444-4444-4444-8444-444444444444"


def _resolver(*addresses):
    def resolve(host, port):
        return list(addresses)

    return resolve


def _transport(status=200, body: bytes = b"", headers: dict | None = None, seen=None, raise_exc=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        if raise_exc is not None:
            raise raise_exc
        return httpx.Response(status, stream=httpx.ByteStream(body), headers=headers or {})

    return httpx.MockTransport(handler)


# ── constants ─────────────────────────────────────────────────────────────────────────────


def test_constants():
    assert WEBHOOK_TIMEOUT_SECONDS == 10.0
    assert webhook_sender.WEBHOOK_SEND_BOUND_SECONDS == 15.0
    assert RESPONSE_CAP_BYTES == 65_536


def test_send_outcome_has_no_body_or_headers_field():
    names = {f.name for f in dataclasses.fields(SendOutcome)}
    assert names == {
        "delivered", "status_code", "latency_ms", "error", "retryable", "gone", "retry_after_seconds",
    }


# ── classify (pure) ───────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("status", [200, 201, 202, 204, 299])
def test_2xx_is_delivered(status):
    out = classify(status_code=status)
    assert (out.delivered, out.error, out.retryable, out.gone, out.status_code) == (True, None, False, False, status)


@pytest.mark.parametrize("status", [408, 429, 500, 502, 503, 504])
def test_retryable_statuses(status):
    out = classify(status_code=status)
    assert (out.delivered, out.error, out.retryable, out.gone) == (False, "http_status", True, False)
    assert out.status_code == status


def test_410_is_gone_and_not_retried():
    out = classify(status_code=410)
    assert (out.delivered, out.error, out.retryable, out.gone, out.status_code) == (False, "gone", False, True, 410)


@pytest.mark.parametrize("status", [400, 401, 403, 404, 405, 409, 413, 422])
def test_other_4xx_is_not_retried(status):
    out = classify(status_code=status)
    assert (out.delivered, out.error, out.retryable, out.gone) == (False, "http_status", False, False)


def test_retry_after_is_read_from_a_retryable_status():
    out = classify(status_code=503, headers={"Retry-After": "60"})
    assert out.retry_after_seconds == 60
    out = classify(status_code=429, headers={"retry-after": "7"})
    assert out.retry_after_seconds == 7
    assert classify(status_code=200, headers={"retry-after": "60"}).retry_after_seconds is None


def _tls_connect_error() -> httpx.ConnectError:
    try:
        try:
            raise ssl.SSLError(1, "CERTIFICATE_VERIFY_FAILED")
        except ssl.SSLError as inner:
            raise httpx.ConnectError("tls failed") from inner
    except httpx.ConnectError as outer:
        return outer


@pytest.mark.parametrize("exc, error, retryable", [
    (httpx.ReadTimeout("t"), "timeout", True),
    (httpx.ConnectTimeout("t"), "timeout", True),
    (asyncio.TimeoutError(), "timeout", True),
    (httpx.ConnectError("refused"), "connect", True),
    (httpx.ReadError("reset"), "connect", True),
    (httpx.RemoteProtocolError("bad"), "connect", True),
    (_tls_connect_error(), "tls", True),
    (ssl.SSLError(1, "x"), "tls", True),
    (egress.EgressRefused(reason_code="redirected", host="h", capability="webhook"), "redirect", False),
    (egress.EgressRefused(reason_code="address_not_public", host="h", capability="webhook"), "refused_address", False),
    (egress.EgressRefused(reason_code="unresolvable", host="h", capability="webhook"), "refused_address", False),
    (egress.EgressResponseTooLarge("big"), "response_too_large", False),
    (egress.EgressResponseUndecodable("br"), "response_too_large", False),
])
def test_exceptions_are_classified(exc, error, retryable):
    out = classify(exc=exc)
    assert (out.delivered, out.error, out.retryable, out.gone, out.status_code) == (False, error, retryable, False, None)


def test_every_error_word_is_in_the_migration_check_set():
    words = {"http_status", "timeout", "connect", "tls", "redirect", "refused_address",
             "response_too_large", "gone", "invalid_url"}
    assert set(webhook_sender.ERROR_WORDS) == words


# ── parse_retry_after ─────────────────────────────────────────────────────────────────────


def test_retry_after_seconds():
    assert parse_retry_after("120") == 120
    assert parse_retry_after(" 0 ") == 0


def test_retry_after_http_date():
    now = datetime(2026, 11, 4, 12, 0, 0, tzinfo=timezone.utc)
    value = format_datetime(now + timedelta(seconds=90), usegmt=True)
    assert parse_retry_after(value, now=now) == 90


@pytest.mark.parametrize("value", [None, "", "soon", "-5", "1.5", "Wed, 21 Oct 2015 07:28:00 GMT", "1e3"])
def test_retry_after_garbage_negative_or_past_is_none(value):
    assert parse_retry_after(value, now=datetime(2026, 11, 4, tzinfo=timezone.utc)) is None


# ── send ──────────────────────────────────────────────────────────────────────────────────


async def test_a_200_is_delivered_with_latency():
    seen: list[httpx.Request] = []
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(200, b"ok", seen=seen))
    assert out.delivered is True and out.status_code == 200 and out.error is None
    assert out.latency_ms is not None and out.latency_ms >= 0
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert req.url.host == PUBLIC
    assert req.headers["host"] == "hooks.example.com"
    assert req.content == BODY
    assert req.headers["webhook-id"] == "msg_x"
    assert req.headers["user-agent"] == "Syrel-Webhooks/1"
    assert "authorization" not in req.headers


async def test_a_503_with_retry_after_is_retryable():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC),
                     transport=_transport(503, headers={"Retry-After": "60"}))
    assert (out.delivered, out.retryable, out.error, out.retry_after_seconds, out.status_code) == (
        False, True, "http_status", 60, 503,
    )


async def test_a_302_is_a_redirect_not_retried():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC),
                     transport=_transport(302, headers={"location": "http://169.254.169.254/"}))
    assert (out.delivered, out.retryable, out.error) == (False, False, "redirect")


async def test_an_internal_address_at_send_is_refused_address():
    seen: list = []
    out = await send(URL, BODY, HEADERS, resolver=_resolver("10.0.0.5"), transport=_transport(seen=seen))
    assert (out.delivered, out.retryable, out.error) == (False, False, "refused_address")
    assert seen == []


# ── WR-03: an over-cap body is classified by its STATUS — webhooks never need the body ──────────
#
# Before the fix egress raised before returning a status, so a receiver answering 200 with a large
# echo body was recorded failed and counted toward auto-disable, and a 503 with a large error page was
# never retried. Egress now attaches the response's status to the exception it raises.

_BIG = b"x" * (RESPONSE_CAP_BYTES + 1)


@pytest.mark.parametrize("declared", [True, False], ids=["content-length", "streamed"])
async def test_wr03_an_oversized_2xx_body_is_delivered(declared):
    headers = {"content-length": str(len(_BIG))} if declared else {}
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(200, _BIG, headers))
    assert (out.delivered, out.retryable, out.error, out.status_code) == (True, False, None, 200)


async def test_wr03_an_undecodable_2xx_body_is_delivered():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC),
                     transport=_transport(204, b"\x00\x01", {"content-encoding": "br"}))
    assert (out.delivered, out.error, out.status_code) == (True, None, 204)


async def test_wr03_a_503_with_an_oversized_body_is_retried():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC),
                     transport=_transport(503, _BIG, {"content-length": str(len(_BIG))}))
    assert (out.delivered, out.retryable, out.error, out.status_code) == (False, True, "http_status", 503)


async def test_wr03_a_410_with_an_oversized_body_is_gone():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(410, _BIG))
    assert (out.delivered, out.gone, out.error, out.status_code) == (False, True, "gone", 410)


async def test_wr03_another_status_with_an_oversized_body_stays_response_too_large():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(404, _BIG))
    assert (out.delivered, out.retryable, out.error, out.status_code) == (False, False, "response_too_large", 404)


@pytest.mark.parametrize("status, delivered, error", [
    (200, True, None), (503, False, "http_status"), (None, False, "response_too_large"),
])
def test_wr03_classify_reads_the_status_on_the_size_exceptions(status, delivered, error):
    for cls in (egress.EgressResponseTooLarge, egress.EgressResponseUndecodable):
        exc = cls("big")
        if status is not None:
            exc.status_code = status
        out = classify(exc=exc)
        assert (out.delivered, out.error, out.status_code) == (delivered, error, status)


async def test_wr03_egress_attaches_the_status_to_the_size_exception():
    with pytest.raises(egress.EgressResponseTooLarge) as err:
        await egress.send_pinned_http(
            "webhook", "POST", URL, content=BODY, timeout=5.0, max_bytes=RESPONSE_CAP_BYTES,
            allowed_host="hooks.example.com", resolver=_resolver(PUBLIC), transport=_transport(201, _BIG),
        )
    assert err.value.status_code == 201
    assert egress.EgressResponseTooLarge("x").status_code is None
    assert egress.EgressResponseUndecodable("x").status_code is None


async def test_a_tls_failure_is_tls_retryable():
    out = await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC),
                     transport=_transport(raise_exc=_tls_connect_error()))
    assert (out.delivered, out.retryable, out.error) == (False, True, "tls")


async def test_a_hanging_resolver_is_a_timeout_inside_the_bound(monkeypatch):
    monkeypatch.setattr(webhook_sender, "WEBHOOK_SEND_BOUND_SECONDS", 0.3)

    def sleepy(host, port):
        time.sleep(1.0)
        return [PUBLIC]

    started = time.monotonic()
    out = await send(URL, BODY, HEADERS, resolver=sleepy, transport=_transport())
    assert time.monotonic() - started < 0.9
    assert (out.delivered, out.retryable, out.error) == (False, True, "timeout")


@pytest.mark.parametrize("bad_url", [
    "https://u:p@hooks.example.com/x",
    "https://u@hooks.example.com/x",
    "https://hooks.example.com/x#frag",
    "http://hooks.example.com/x",
    "https://0177.0.0.1/x",
    "https://hooks.example.com/" + "a" * 2048,
])
async def test_a_url_failing_the_rules_never_reaches_egress(monkeypatch, bad_url):
    calls: list = []

    async def spy(*a, **kw):  # pragma: no cover - reaching it IS the failure
        calls.append((a, kw))
        raise AssertionError("egress was called for a refused URL")

    monkeypatch.setattr(egress, "send_pinned_http", spy)
    out = await send(bad_url, BODY, HEADERS)
    assert (out.delivered, out.retryable, out.error, out.status_code, out.latency_ms) == (
        False, False, "invalid_url", None, None,
    )
    assert calls == []


async def test_send_calls_egress_once_with_the_webhook_capability(monkeypatch):
    calls: list = []

    async def spy(capability, method, url, **kw):
        calls.append((capability, method, url, kw))
        return egress.PinnedResponse(204, {"x-receiver": "secret-ish"}, b"RESPONSEBODY")

    monkeypatch.setattr(egress, "send_pinned_http", spy)
    out = await send(URL, BODY, HEADERS)
    assert len(calls) == 1
    capability, method, url, kw = calls[0]
    assert (capability, method, url) == ("webhook", "POST", URL)
    assert kw["content"] == BODY
    assert "json" not in kw or kw["json"] is None
    assert kw["timeout"] == 10.0
    assert kw["max_bytes"] == 65_536
    assert kw["allowed_host"] == "hooks.example.com"
    assert dict(kw["headers"]) == HEADERS
    assert out.delivered is True and out.status_code == 204
    assert "RESPONSEBODY" not in repr(out) and "secret-ish" not in repr(out)


async def test_latency_is_measured_with_the_injected_clock(monkeypatch):
    ticks = iter([100.0, 100.25])

    async def spy(capability, method, url, **kw):
        return egress.PinnedResponse(200, {}, b"")

    monkeypatch.setattr(egress, "send_pinned_http", spy)
    out = await send(URL, BODY, HEADERS, clock=lambda: next(ticks))
    assert out.latency_ms == 250


async def test_logs_never_carry_the_url_body_or_signature(caplog):
    caplog.set_level(logging.DEBUG)
    await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(200))
    await send(URL, BODY, HEADERS, resolver=_resolver("127.0.0.1"), transport=_transport(200))
    await send(URL, BODY, HEADERS, resolver=_resolver(PUBLIC), transport=_transport(500))
    await send("https://u:PASSWORD@hooks.example.com/x", BODY, HEADERS)
    # Our own loggers (the sender's and egress's). httpx's INFO request line is NOT ours: it names
    # the pinned URL and is silent at the app's default (root WARNING) level — see 308-02-SUMMARY.
    ours = [r for r in caplog.records if r.name.startswith("app.")]
    assert any(r.name == "app.services.webhook_sender" for r in ours), (
        "the sender logged nothing — the scan would be vacuous"
    )
    for record in ours:
        text = record.getMessage()
        for forbidden in ("SECRETPATHTOKEN", "QUERYSECRET", "BODYSECRET", "SIGSECRET", "PASSWORD", "/hooks/catch"):
            assert forbidden not in text, (forbidden, text)


def test_the_sender_has_no_http_client_of_its_own():
    src = inspect.getsource(webhook_sender)
    assert "AsyncClient" not in src
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
    assert "requests" not in imported and "aiohttp" not in imported


# ── freeze_payload ────────────────────────────────────────────────────────────────────────


def _event():
    return W.build_test_event(UUID("eeeeeeee-0000-4000-8000-000000000005"),
                              datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc))


async def _on(_org):
    return True


async def _off(_org):
    return False


@pytest.mark.parametrize("is_on", [_on, _off], ids=["switch-on", "switch-off"])
async def test_freeze_payload_returns_the_canonical_ascii_text(is_on):
    event = _event()
    frozen = await freeze_payload(event, org_id=ORG, is_on=is_on)
    assert frozen == W.serialize_payload(event).decode("ascii")


async def test_freeze_payload_withheld_is_none(monkeypatch):
    async def withhold(model, **kw):
        assert kw.get("textless_ok") is True
        return outbound_guard.WITHHELD

    monkeypatch.setattr(outbound_guard, "guard", withhold)
    assert await freeze_payload(_event(), org_id=ORG, is_on=_on) is None


async def test_freeze_payload_guard_raise_is_none(monkeypatch):
    async def boom(model, **kw):
        raise RuntimeError("redactor exploded")

    monkeypatch.setattr(outbound_guard, "guard", boom)
    assert await freeze_payload(_event(), org_id=ORG, is_on=_on) is None
