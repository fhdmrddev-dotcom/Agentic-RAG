"""Phase 308-02 (D-27 / D-46 / D-51; T-308-04, T-308-15) — the webhook URL rules, in ONE pure module.

Three callers, one set of rules: the route validator (308-04) refuses a bad URL at save, the sender
(``webhook_sender.send``) RE-ASSERTS it before every send, and the org-admin list shows
``admin_display`` instead of the URL.

**Why the rules exist beside egress (D-46, measured).** ``egress.validate_destination`` reads the
parsed ``.host`` only, so ``https://user:pw@host/`` passes egress — and httpx would then send the
userinfo as Basic auth to the receiver. A fragment is never sent at all, so a URL carrying one is not
the URL that would be called. Neither may reach egress.

**The URL is returned unchanged, never normalised**, so the stored URL is exactly the sent URL.

**Nothing here logs, and the query never leaves ``admin_display``.** A receiver's token sits in the
path (Zapier / Slack style) or in the query; ``admin_display`` masks every path segment of 16 or more
characters and reports only whether a query exists. ``WebhookUrlError`` carries a code, never the URL.
"""
from __future__ import annotations

from typing import Literal
from urllib.parse import urlsplit

import httpx

MAX_URL_LENGTH = 2048
MASK_SEGMENT_AT = 16
MASK = "…"

WebhookUrlErrorCode = Literal["not_https", "too_long", "userinfo", "fragment", "not_url", "no_host"]


class WebhookUrlError(ValueError):
    """A URL that may not be a webhook destination. ``code`` is internal; the route shows one sentence."""

    def __init__(self, code: WebhookUrlErrorCode) -> None:
        self.code: WebhookUrlErrorCode = code
        super().__init__(f"webhook url refused: {code}")


def _has_space_or_control(url: str) -> bool:
    return any(ch.isspace() or ord(ch) < 0x20 or ord(ch) == 0x7F for ch in url)


def check_webhook_url(url: str) -> str:
    """Return ``url`` unchanged when it may be a webhook destination; raise ``WebhookUrlError``."""
    if not isinstance(url, str) or not url:
        raise WebhookUrlError("not_url")
    if len(url) > MAX_URL_LENGTH:
        raise WebhookUrlError("too_long")
    if _has_space_or_control(url):
        raise WebhookUrlError("not_url")
    try:
        parts = urlsplit(url)
    except ValueError:
        raise WebhookUrlError("not_url") from None
    if parts.scheme.lower() != "https":
        raise WebhookUrlError("not_https")
    if "@" in parts.netloc or parts.username is not None or parts.password is not None:
        raise WebhookUrlError("userinfo")
    if "#" in url or parts.fragment:
        raise WebhookUrlError("fragment")
    if not parts.netloc and not parts.path and not parts.query:
        raise WebhookUrlError("not_url")  # "https://" — nothing after the scheme at all
    if not parts.hostname:
        raise WebhookUrlError("no_host")
    try:
        parts.port  # noqa: B018 — raises ValueError for an out-of-range or non-numeric port
        parsed = httpx.URL(url)
    except Exception:  # noqa: BLE001 — httpx.InvalidURL and friends: what httpx cannot send is refused
        raise WebhookUrlError("not_url") from None
    if not parsed.host:
        raise WebhookUrlError("no_host")
    return url


def host_of(url: str) -> str:
    """The lower-cased hostname, without the port — the ``allowed_host`` egress pins to."""
    return (urlsplit(url).hostname or "").lower()


def admin_display(url: str) -> tuple[str, str, bool]:
    """``(host, masked path, has_query)`` for the org-admin list (D-51). The query itself never."""
    parts = urlsplit(url)
    masked = "/".join(
        MASK if len(segment) >= MASK_SEGMENT_AT else segment for segment in parts.path.split("/")
    )
    return (parts.hostname or "").lower(), masked, bool(parts.query)
