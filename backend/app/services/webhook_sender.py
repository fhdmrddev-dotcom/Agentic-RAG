"""Phase 308-02 (D-16 / D-17 / D-20 / D-41 / D-46; T-308-02..04, T-308-13, T-308-14) — ONE webhook send
through egress, and the classification of every way it can end.

**One door.** ``send`` POSTs through ``egress.send_pinned_http`` under the closed ``webhook``
capability with the endpoint URL's own host as ``allowed_host``: public addresses only, the DNS
answer pinned, redirects refused, the response read under a 64 KB cap. This module opens no HTTP
client of its own (PITFALLS 13). The call is wrapped in ``asyncio.wait_for`` because the DNS lookup
inside egress is not bounded by the httpx timeout.

**The URL rules again, before every send (D-46).** Egress reads ``.host`` only, so a URL with
userinfo would pass it and httpx would send Basic auth. ``check_webhook_url`` runs first; a refused
URL is ``invalid_url`` and egress is never called.

**Nothing of the response is kept (D-20).** Only the status code and ``Retry-After`` are read; the
body and every other header are discarded. ``SendOutcome`` has no field that could hold them.

**Logs carry the host and an outcome word only** — never the path or query (a receiver's token
lives there), the body or a signature.

**The classification table** (RESEARCH §Pattern; the CHECK set of migration 225's error words):

=================================================  =======  =====================
outcome                                            retried  error word
=================================================  =======  =====================
2xx                                                —        —
408, 429, 5xx (``Retry-After`` read)               yes      ``http_status``
timeout (httpx or the send bound)                  yes      ``timeout``
connect / network / protocol error                 yes      ``connect``
TLS (``ssl.SSLError`` anywhere in the cause chain) yes      ``tls``
3xx (egress ``redirected``)                        no       ``redirect``
any other egress refusal (DNS changed since save)  no       ``refused_address``
response over the cap, or undecodable: by STATUS  (WR-03, the rows above; the body is never needed)
  ... with no status, or a status not listed above  no       ``response_too_large``
410                                                no       ``gone`` (endpoint off)
other 4xx                                          no       ``http_status``
URL fails the rules                                no       ``invalid_url``
=================================================  =======  =====================

⚠ 308-REVIEW WR-03 (D-61): egress attaches the response's ``status_code`` to the size exceptions, and
the sender classifies by it — an oversized or undecodable **2xx is delivered** (the receiver took it;
retrying would duplicate it, failing it would count toward auto-disable), a 5xx / 408 / 429 with a
large error page **is retried**, a 410 is gone. Only an over-cap response whose status is not one of
those stays ``response_too_large`` (not retried), and the drainer never counts that word toward
auto-disable.
"""
from __future__ import annotations

import asyncio
import logging
import ssl
import time
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Awaitable, Callable, Mapping

import httpx

from app.models.webhook import serialize_payload
from app.security import egress
from app.services import outbound_guard, webhook_urls

logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 10.0
#: The outer bound: DNS inside egress is not bounded by the httpx timeout (egress.py CR-04).
WEBHOOK_SEND_BOUND_SECONDS = 15.0
RESPONSE_CAP_BYTES = 65_536

#: Every error word this module can produce — migration 225's CHECK set, exactly.
ERROR_WORDS = (
    "http_status", "timeout", "connect", "tls", "redirect", "refused_address",
    "response_too_large", "gone", "invalid_url",
)

_RETRYABLE_STATUSES = frozenset({408, 429})
_CAUSE_DEPTH = 8


@dataclass(frozen=True)
class SendOutcome:
    delivered: bool
    status_code: int | None
    latency_ms: int | None
    error: str | None
    retryable: bool
    gone: bool = False
    retry_after_seconds: int | None = None


def parse_retry_after(value: str | None, *, now: datetime | None = None) -> int | None:
    """``Retry-After`` as whole seconds from now: delta-seconds or an HTTP-date in the future.
    Garbage, a negative number or a date in the past is ``None``."""
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    try:
        when = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        return None
    if when is None:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    current = now if now is not None else datetime.now(timezone.utc)
    seconds = int((when - current).total_seconds())
    return seconds if seconds >= 0 else None


def _header(headers: Mapping[str, str] | None, name: str) -> str | None:
    if not headers:
        return None
    for key, value in headers.items():
        if str(key).lower() == name:
            return value
    return None


def _is_tls(exc: BaseException) -> bool:
    seen: BaseException | None = exc
    for _ in range(_CAUSE_DEPTH):
        if seen is None:
            return False
        if isinstance(seen, ssl.SSLError):
            return True
        seen = seen.__cause__ or seen.__context__
    return False


def _failed(error: str, *, retryable: bool, status_code: int | None = None, **extra: Any) -> SendOutcome:
    return SendOutcome(
        delivered=False, status_code=status_code, latency_ms=None, error=error,
        retryable=retryable, **extra,
    )


def classify(
    *,
    status_code: int | None = None,
    exc: BaseException | None = None,
    headers: Mapping[str, str] | None = None,
) -> SendOutcome:
    """The classification table above, pure. ``latency_ms`` is filled in by ``send``."""
    if exc is not None:
        return _classify_exception(exc)
    if status_code is None:
        raise ValueError("classify needs a status_code or an exception")
    if 200 <= status_code < 300:
        return SendOutcome(delivered=True, status_code=status_code, latency_ms=None, error=None, retryable=False)
    if status_code == 410:
        return _failed("gone", retryable=False, status_code=status_code, gone=True)
    if status_code in _RETRYABLE_STATUSES or 500 <= status_code < 600:
        return _failed(
            "http_status", retryable=True, status_code=status_code,
            retry_after_seconds=parse_retry_after(_header(headers, "retry-after")),
        )
    if 300 <= status_code < 400:
        return _failed("redirect", retryable=False, status_code=status_code)
    return _failed("http_status", retryable=False, status_code=status_code)


def _classify_exception(exc: BaseException) -> SendOutcome:
    if isinstance(exc, egress.EgressRefused):
        if exc.reason_code == "redirected":
            return _failed("redirect", retryable=False)
        return _failed("refused_address", retryable=False)
    if isinstance(exc, (egress.EgressResponseTooLarge, egress.EgressResponseUndecodable)):
        status = getattr(exc, "status_code", None)  # WR-03: egress read it before the body
        if status is not None:
            by_status = classify(status_code=status)
            if by_status.delivered or by_status.gone or by_status.retryable:
                return by_status
        return _failed("response_too_large", retryable=False, status_code=status)
    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError, TimeoutError)):
        return _failed("timeout", retryable=True)
    if _is_tls(exc):
        return _failed("tls", retryable=True)
    if isinstance(exc, (httpx.TransportError, OSError)):
        return _failed("connect", retryable=True)
    raise TypeError(f"no webhook outcome for {type(exc).__name__}")


#: What ``send`` classifies; anything else propagates to the caller's per-row error path.
_CLASSIFIED = (
    egress.EgressRefused, egress.EgressResponseTooLarge, egress.EgressResponseUndecodable,
    httpx.TransportError, asyncio.TimeoutError, TimeoutError, OSError,
)


async def send(
    url: str,
    body: bytes,
    headers: Mapping[str, str],
    *,
    resolver: Callable[[str, int], list[str]] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> SendOutcome:
    """Send ``body`` (already frozen and signed for this attempt) once, and classify the result."""
    try:
        webhook_urls.check_webhook_url(url)
    except webhook_urls.WebhookUrlError:
        outcome = _failed("invalid_url", retryable=False)
        # R-308-04: logs name the masked host (display_host), never a token-looking host label.
        shown_host = webhook_urls.display_host(url)
        logger.warning("webhook send: host=%s outcome=%s", shown_host, outcome.error)
        return outcome

    host = webhook_urls.host_of(url)
    started = clock()
    try:
        response = await asyncio.wait_for(
            egress.send_pinned_http("webhook", "POST", url, content=body, headers=dict(headers), timeout=WEBHOOK_TIMEOUT_SECONDS, max_bytes=RESPONSE_CAP_BYTES, allowed_host=host, resolver=resolver, transport=transport),  # noqa: E501 — one line: the key_link grep reads it whole
            WEBHOOK_SEND_BOUND_SECONDS,
        )
    except _CLASSIFIED as exc:
        outcome = classify(exc=exc)
    else:
        outcome = classify(
            status_code=response.status_code,
            headers={"retry-after": _header(response.headers, "retry-after") or ""},
        )
        del response  # the body and every other header are discarded here (D-20)
    outcome = replace(outcome, latency_ms=max(0, int(round((clock() - started) * 1000))))
    shown_host = webhook_urls.display_host(url)
    logger.info("webhook send: host=%s outcome=%s", shown_host, outcome.error or "sent")
    return outcome


async def freeze_payload(model: Any, *, org_id: str, is_on: Callable[[str], Awaitable[Any]]) -> str | None:
    """The payload's frozen ASCII text after the redaction guard (D-15 / D-41), or ``None`` when the
    guard withheld it or raised — the caller records ``redaction_failed`` and sends nothing."""
    try:
        guarded = await outbound_guard.guard(model, org_id=org_id, is_on=is_on, textless_ok=True)
    except Exception:  # noqa: BLE001 — fail closed: an unguardable payload is never sent
        return None
    if guarded is outbound_guard.WITHHELD:
        return None
    try:
        return serialize_payload(guarded).decode("ascii")
    except Exception:  # noqa: BLE001 — fail closed
        return None
