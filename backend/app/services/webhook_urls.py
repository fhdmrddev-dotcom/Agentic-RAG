"""Phase 308-02 (D-27 / D-46 / D-51; T-308-04, T-308-15) — the webhook URL rules, in ONE pure module.

Three callers, one set of rules: the route validator (308-04) refuses a bad URL at save, the sender
(``webhook_sender.send``) RE-ASSERTS it before every send, and the org-admin list shows
``admin_display`` instead of the URL.

**Why the rules exist beside egress (D-46, measured).** ``egress.validate_destination`` reads the
parsed ``.host`` only, so ``https://user:pw@host/`` passes egress — and httpx would then send the
userinfo as Basic auth to the receiver. A fragment is never sent at all, so a URL carrying one is not
the URL that would be called. Neither may reach egress.

**The URL is returned unchanged except for its scheme, which is lower-cased (WR-04)**, and the
routes store the returned value, so the stored URL is exactly the sent URL.

**Nothing here logs, and the query never leaves ``admin_display``.** A receiver's token sits in the
path (Zapier / Slack style), in the query, or in the leftmost host label (Pipedream / ngrok style).
``admin_display`` (CR-01 / D-59) shows the ``display_host`` and a neutral "path hidden" marker only,
and reports whether a query exists; the audit rows record ``display_host`` too. ``WebhookUrlError``
carries a code, never the URL.
"""
from __future__ import annotations

from typing import Literal
from urllib.parse import urlsplit

import httpx

MAX_URL_LENGTH = 2048
MASK = "…"
#: CR-01 / D-59: what an admin sees in place of a path — every segment hidden, whatever its length.
PATH_HIDDEN = "/" + MASK
#: CR-01 / D-59: a leftmost host label this long is treated as a token.
TOKEN_LABEL_AT = 12

WebhookUrlErrorCode = Literal["not_https", "too_long", "userinfo", "fragment", "not_url", "no_host"]


class WebhookUrlError(ValueError):
    """A URL that may not be a webhook destination. ``code`` is internal; the route shows one sentence."""

    def __init__(self, code: WebhookUrlErrorCode) -> None:
        self.code: WebhookUrlErrorCode = code
        super().__init__(f"webhook url refused: {code}")


def _has_space_or_control(url: str) -> bool:
    return any(ch.isspace() or ord(ch) < 0x20 or ord(ch) == 0x7F for ch in url)


def check_webhook_url(url: str) -> str:
    """Return ``url`` (scheme lower-cased, nothing else changed) when it may be a webhook
    destination; raise ``WebhookUrlError``."""
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
    # WR-04: the scheme ALONE is lower-cased. Migration 225's CHECK is ``url LIKE 'https://%'``
    # (case-sensitive), and httpx lower-cases the scheme it sends — so ``HTTPS://…`` stored as typed
    # would 500 on the CHECK. Storing the returned value keeps "the stored URL is the sent URL".
    return "https" + url[len(parts.scheme):]


def host_of(url: str) -> str:
    """The lower-cased hostname, without the port — the ``allowed_host`` egress pins to."""
    return (urlsplit(url).hostname or "").lower()


def _looks_like_token(label: str) -> bool:
    """A host label that may be a credential: long (12+), or a hex / digit run of 6+ with a digit."""
    if len(label) >= TOKEN_LABEL_AT:
        return True
    if len(label) < 6 or not any(ch.isdigit() for ch in label):
        return False
    hexish = sum(1 for ch in label if ch in "0123456789abcdef-")
    return hexish / len(label) >= 0.6


def display_host(url: str) -> str:
    """The host an org admin and an audit row may see (CR-01 / D-59): lower-cased, no port, and a
    token-looking LEFTMOST label of a 3+-label name replaced by ``…`` (Pipedream / ngrok style
    receivers carry the credential there). A registrable domain and an IP literal are kept."""
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""
    labels = host.split(".")
    if len(labels) < 3 or ":" in host or all(label.isdigit() for label in labels):
        return host
    if _looks_like_token(labels[0]):
        labels[0] = MASK
    return ".".join(labels)


def admin_display(url: str) -> tuple[str, str, bool]:
    """``(display host, path marker, has_query)`` for the org-admin list (D-30 / D-59).

    ⚠ CR-01: D-51 masked path segments of 16+ characters, and a real Zapier catch hook has none that
    long — the whole working URL reached every admin. No path segment is shown now: the marker is
    ``PATH_HIDDEN`` when the URL has a path beyond ``/``, else ``""``. The query itself never.
    """
    parts = urlsplit(url)
    path = PATH_HIDDEN if parts.path not in ("", "/") else ""
    return display_host(url), path, bool(parts.query)
