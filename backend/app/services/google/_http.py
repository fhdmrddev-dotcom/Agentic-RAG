"""The one HTTP shape every Google read in this package uses.

── ⚠ WHY THIS EXISTS (2026-08-31) ─────────────────────────────────────────────────────
`cloud_storage.py` and the first cut of `gmail_read.py` each carried their own copy of
the same three things: mint a token from the connection id, call the binder, and turn a
non-200 into a sentence. Two copies is a coincidence; **five would have been a rule
nobody wrote down**, and the enum-only error projection is the kind of rule that rots
quietly when it is spelled once per module. Round 1 adds Sheets, Docs, Calendar,
Contacts and three more Gmail reads — so the shape is extracted BEFORE the fifth copy,
not after it.

`cloud_storage.py` deliberately keeps its own copy for now: it is the file picker's
module as well as the connector's, it is on the ledger, and moving it is a separate
change with its own blast radius. That is a decision, not an oversight —
`docs/HOT-FILE-LEDGER.md` records the seam.

── THE BODY NEVER TRAVELS; THE ENUM HALF DOES ─────────────────────────────────────────
A Google error body echoes the request — for Drive and Gmail that is the `q` parameter,
which carries whatever the person searched their own files or mail for. So
`error.message` and the raw text are never logged and never returned. `error.status`
(`PERMISSION_DENIED`) and `error.errors[].reason` (`accessNotConfigured`,
`insufficientPermissions`, `notFound`, `rateLimitExceeded`) are a closed enum vocabulary
that cannot contain user text, and those are exactly the words that make a refusal
actionable.

⚠ MEASURED, NOT ARGUED. Handed a bare `HTTP 403`, a real model call told the operator to
re-consent Google scopes that were already granted and correct — the cause was a disabled
Drive API. `accessNotConfigured` is the word that makes that answer impossible to give.

── EVERY CALL GOES THROUGH THE BINDER ─────────────────────────────────────────────────
`send_pinned_http` under the CALLER'S key: scheme check, host allow-list, DNS pin,
redirect refusal, response cap. This package constructs no client of its own — the
mistake `cloud_storage` shipped with (a raw `httpx.AsyncClient`, validated by nothing) is
the reason that rule is written down.

⚠ THE KEY IS THE CALLER'S, NOT THIS MODULE'S. Sheets, Docs, Calendar, Gmail, Contacts and
Drive all resolve to googleapis.com, so a shared key would buy nothing and would let a
Calendar tool reach Gmail. Each surface passes its own, and `SERVICE_TOOL_SPECS` declares
it — one grep per key is the whole audit.
"""

from __future__ import annotations

import base64
import json as jsonlib
import logging
from typing import Any, Mapping
from uuid import UUID

from app.security.egress import send_pinned_http
from app.services.oauth_refresh_service import get_fresh_access_token

logger = logging.getLogger(__name__)

__all__ = [
    "GoogleReadError", "error_reason", "activation_url", "get_json", "post_json",
    "decode_b64url",
]


class GoogleReadError(RuntimeError):
    """A Google read that did not happen, with a sentence saying why."""


#: The console origins an `activationUrl` may have. A WHITELIST, not a sanitiser: the
#: value is vendor-supplied, and the only safe way to put a URL in front of a person is to
#: refuse every one that does not start with an origin we named ourselves.
_CONSOLE_ORIGINS = (
    "https://console.developers.google.com/",
    "https://console.cloud.google.com/",
)


def _enum(value: object, *, allow_dots: bool = False) -> str | None:
    """Return ``value`` iff it is an enum-shaped token, else ``None``.

    ⚠ THIS IS THE WHOLE PROJECTION AND IT IS DELIBERATELY UNGENEROUS. Anything carrying a
    space, a quote or punctuation is free text by definition — and free text in a Google
    error body is the echoed request, which for Drive and Gmail is the person's own query.
    ``allow_dots`` exists only for service hostnames (`sheets.googleapis.com`).
    """
    if not isinstance(value, str) or not value:
        return None
    probe = value.replace("_", "")
    if allow_dots:
        probe = probe.replace(".", "").replace("-", "")
    return value if probe.isalnum() else None


def error_reason(body: bytes | str | None) -> str:
    """`` (STATUS / reason / service)`` built from Google's enum fields only, or `""`.

    Never raises: a diagnostic that can fail is a second fault stacked on an existing one.

    ── ⚠ `details[]` IS READ, AND OMITTING IT LOST THE ONLY FACT THAT MATTERED ──────────
    The first cut read `error.status` and `error.errors[].reason`. That is the LEGACY
    shape — Drive and Gmail still send it — and the newer APIs (Sheets, Docs, People) send
    an empty `errors` and put everything in `details[]` as a `google.rpc.ErrorInfo`.
    Measured 2026-08-31, driving all five surfaces on one token: Sheets and Docs both
    answered `SERVICE_DISABLED` (the API is switched off in the Cloud project) while
    People answered `ACCESS_TOKEN_SCOPE_INSUFFICIENT` (one re-consent fixes it) — **and
    all three arrived here as the identical bare `PERMISSION_DENIED`.** Two completely
    different remedies, one indistinguishable refusal. That is the same defect this whole
    module exists to remove, one layer deeper than it was first fixed.

    `metadata.service` travels too, because "which API is off" is the actionable half of
    `SERVICE_DISABLED` and a hostname cannot carry a query.
    """
    try:
        data = jsonlib.loads(body) if body else {}
        err = data.get("error") or {}
        parts: list[str] = []

        status = _enum(err.get("status"))
        if status:
            parts.append(status)

        # Legacy shape — Drive, Gmail.
        for entry in err.get("errors") or []:
            reason = _enum((entry or {}).get("reason")) if isinstance(entry, dict) else None
            if reason and reason not in parts:
                parts.append(reason)

        # google.rpc.ErrorInfo — Sheets, Docs, People, and increasingly everything.
        for detail in err.get("details") or []:
            if not isinstance(detail, dict):
                continue
            reason = _enum(detail.get("reason"))
            if reason and reason not in parts:
                parts.append(reason)
            service = _enum((detail.get("metadata") or {}).get("service"), allow_dots=True)
            if service and service not in parts:
                parts.append(service)

        return f" ({' / '.join(parts)})" if parts else ""
    except Exception:  # noqa: BLE001 — a best-effort read of a body we already distrust
        return ""


def activation_url(body: bytes | str | None) -> str:
    """The console link that switches a disabled API on, or `""`.

    ⚠ ORIGIN-WHITELISTED, NEVER SANITISED. This is a vendor-supplied URL being put in
    front of a person by an agent; the only defensible check is that it starts with an
    origin named in this file. Google sends it as `metadata.activationUrl` alongside
    `SERVICE_DISABLED`, and it is the single most actionable string in the whole body —
    it names the project AND the exact API to enable.
    """
    try:
        data = jsonlib.loads(body) if body else {}
        for detail in (data.get("error") or {}).get("details") or []:
            if not isinstance(detail, dict):
                continue
            url = (detail.get("metadata") or {}).get("activationUrl")
            if isinstance(url, str) and url.startswith(_CONSOLE_ORIGINS):
                return url
    except Exception:  # noqa: BLE001
        pass
    return ""


async def _token(connection_id: str | UUID) -> str:
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise GoogleReadError(
            "this Google connection has no valid OAuth token — reconnect it in "
            "Settings › Connections"
        )
    return token


def _raise_for(status_code: int, body: bytes | str | None, what: str) -> None:
    reason = error_reason(body)
    # The BODY is not logged. The enum half is — see the module docstring.
    logger.error("Google %s failed (%s)%s", what, status_code, reason)
    if status_code in (401, 403):
        # ⚠ TWO DIFFERENT 403s WITH TWO DIFFERENT REMEDIES, AND THEY ARE TOLD APART HERE.
        # `SERVICE_DISABLED` means the API is switched off in the Cloud project and no
        # amount of re-consenting will help; `*_SCOPE_INSUFFICIENT` /
        # `insufficientPermissions` means the token predates the scope and exactly one
        # reconnect fixes it. Answering both with the same sentence is how an operator
        # ends up re-consenting scopes that were already correct — measured, 2026-08-31.
        if "SERVICE_DISABLED" in reason or "accessNotConfigured" in reason:
            link = activation_url(body)
            where = (
                f"Enable it here, wait about two minutes, then retry: {link}"
                if link
                else "Enable it in the Google Cloud console and retry."
            )
            raise GoogleReadError(
                f"Google refused {what}: HTTP {status_code}{reason}. That API is switched "
                "OFF in the Google Cloud project — this is NOT a scope problem, and "
                f"reconnecting will not help. {where}"
            )
        raise GoogleReadError(
            f"Google refused {what}: HTTP {status_code}{reason}. This connection was "
            "most likely authorised before that scope was added — reconnect it once in "
            "Settings › Connections."
        )
    if status_code == 404:
        raise GoogleReadError(
            f"Google refused {what}: HTTP 404{reason}. The id may be wrong, or this "
            "account may not have access to it."
        )
    raise GoogleReadError(f"Google refused {what}: HTTP {status_code}{reason}")


async def get_json(
    capability: str,
    connection_id: str | UUID,
    url: str,
    params: Mapping[str, str] | None = None,
    *,
    what: str,
    max_bytes: int = 1024 * 1024,
    timeout: float = 20.0,
) -> Any:
    """One GET, through the binder under ``capability``, decoded as JSON."""
    token = await _token(connection_id)
    resp = await send_pinned_http(
        capability,
        "GET",
        url,
        params=dict(params or {}),
        headers={"authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=timeout,
        max_bytes=max_bytes,
    )
    if resp.status_code != 200:
        _raise_for(resp.status_code, resp.body, what)
    return jsonlib.loads(resp.body)


async def post_json(
    capability: str,
    connection_id: str | UUID,
    url: str,
    payload: Mapping[str, Any],
    *,
    what: str,
    max_bytes: int = 512 * 1024,
    timeout: float = 20.0,
) -> Any:
    """One POST, for the read endpoints Google models as POST.

    ⚠ A POST HERE IS STILL A READ, and only two things keep that honest: the SCOPE is
    `*.readonly`, so the token cannot mutate anything whatever this sends; and the only
    caller is `calendar.find_free_time`, whose endpoint (`freeBusy.query`) is a query
    Google happens to shape as a POST because the request body is large. Do NOT reach for
    this to add a write — a write is a different scope, a different consent screen and a
    different decision, deliberately deferred (operator, 2026-08-31: "reads first").
    """
    token = await _token(connection_id)
    resp = await send_pinned_http(
        capability,
        "POST",
        url,
        json=dict(payload),
        headers={"authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=timeout,
        max_bytes=max_bytes,
    )
    if resp.status_code != 200:
        _raise_for(resp.status_code, resp.body, what)
    return jsonlib.loads(resp.body)


async def write_json(
    capability: str,
    connection_id: str | UUID,
    method: str,
    url: str,
    payload: Mapping[str, Any] | None = None,
    params: Mapping[str, str] | None = None,
    *,
    what: str,
    max_bytes: int = 512 * 1024,
    timeout: float = 25.0,
) -> Any:
    """One WRITE — the only function in this module that changes anything at Google.

    ⚠ **SEPARATE FROM `post_json` ON PURPOSE, AND THAT SEPARATION IS THE POINT.**
    `post_json`'s docstring promises *"a POST here is still a read"* and tells the next
    author not to reach for it to add a write. Widening it would have made that promise
    false for its one existing caller (`calendar.find_free_time`) without editing a line of
    that caller — the sentence would still be there, and it would be a lie. So writes get
    their own door, and `post_json`'s guarantee stays true and greppable.

    ⚠ **IT REFUSES A `*_read` CAPABILITY OUTRIGHT.** Every read key is bound to a
    `.readonly` OAuth scope, so a write attempted under one would fail at Google anyway —
    but it would fail as a confusing 403 about scopes rather than as our own bug. The
    assertion turns a mis-wired spec into an immediate, named error at the seam, which is
    the same refuse-never-degrade stance `_sanitize_tool_grants` takes one layer up.

    ⚠ Accepts the 2xx family, not just 200. Google answers `201 Created` for a created
    calendar event and a created Drive file; a `== 200` check — the shape both read helpers
    above use correctly — would turn every successful create into a reported failure.
    """
    if capability.endswith("_read"):
        raise GoogleReadError(
            f"{what} was NOT sent: it declares the read-only capability {capability!r}. "
            "A write must declare its own '*_write' key — this is a wiring error, not a "
            "permission the person can grant."
        )

    token = await _token(connection_id)
    resp = await send_pinned_http(
        capability,
        method.upper(),
        url,
        params=dict(params or {}),
        json=dict(payload) if payload is not None else None,
        headers={"authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=timeout,
        max_bytes=max_bytes,
    )
    if not (200 <= resp.status_code < 300):
        _raise_for(resp.status_code, resp.body, what)
    if not resp.body:
        return {}
    return jsonlib.loads(resp.body)


async def upload_media(
    capability: str,
    connection_id: str | UUID,
    method: str,
    url: str,
    body: bytes,
    content_type: str,
    params: Mapping[str, str] | None = None,
    *,
    what: str,
    timeout: float = 30.0,
) -> Any:
    """Send RAW BYTES — the one thing `write_json` cannot do, and the reason a file was empty.

    ⚠ **THIS EXISTS BECAUSE `create_file` REPORTED SUCCESS AND WROTE NOTHING.** Drive's
    upload endpoint takes the file's bytes as the request body; `write_json` sends a JSON
    document, so the content parameter was accepted, encoded into nothing, and the person
    got an empty file with a cheerful note. The failure was predicted verbatim in
    `writes.py`'s own docstring and then committed anyway.

    ⚠ Same refusal as `write_json`: a `*_read` capability cannot reach this. A read key is
    bound to a `.readonly` scope, so an upload under one is a wiring error, and naming it
    here beats a confusing 403 from Google.
    """
    if capability.endswith("_read"):
        raise GoogleReadError(
            f"{what} was NOT sent: it declares the read-only capability {capability!r}. "
            "An upload must declare its own '*_write' key — this is a wiring error, not a "
            "permission the person can grant."
        )

    token = await _token(connection_id)
    resp = await send_pinned_http(
        capability,
        method.upper(),
        url,
        params=dict(params or {}),
        content=body,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": content_type,
            "Accept": "application/json",
        },
        timeout=timeout,
        max_bytes=512 * 1024,
    )
    if not (200 <= resp.status_code < 300):
        _raise_for(resp.status_code, resp.body, what)
    if not resp.body:
        return {}
    return jsonlib.loads(resp.body)


def decode_b64url(data: str | None) -> bytes:
    """Google's base64url with the padding it omits. Empty on anything malformed.

    A malformed part is not an error — it is a part with nothing in it, and raising would
    turn one unreadable MIME section into a failed read of the whole message.
    """
    if not data:
        return b""
    try:
        return base64.urlsafe_b64decode(data + "==")
    except Exception:  # noqa: BLE001
        return b""
