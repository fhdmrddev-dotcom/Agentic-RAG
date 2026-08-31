"""Read-only Gmail, on the SAME connection Drive already uses.

── ⚠ ONE CONNECTION, MORE SCOPES — NEVER A SECOND ROW (2026-08-31) ────────────────────
The operator's direction (BUS-037 §B) is explicit: Gmail is *"one connection, not many:
add the scope to the authorize request (you re-consent once, same token) and add tools
backed by real API calls under their own egress key."* So there is no `gmail` service id,
no second `connector_connections` row and no second token — `oauth_service`'s Google
`default_scopes` gained `gmail.readonly`, and these tools mint their access token from
the SAME connection id the Drive tools do, through `get_fresh_access_token`.

⚠ THE OPERATOR MUST RE-CONSENT ONCE, AND UNTIL THEY DO THESE TOOLS RETURN A REFUSAL
NAMING THAT. A Google access token carries the scopes granted at consent time; adding a
scope to the authorize request does not retroactively widen a token already minted. An
existing connection therefore answers `403 insufficientPermissions` or
`ACCESS_TOKEN_SCOPE_INSUFFICIENT` until it is reconnected — and `_error_reason`
below exists so that sentence reaches the person instead of a bare `HTTP 403`. That is
the same defect measured on Drive the same day: given only `HTTP 403`, the model told
the operator to re-consent scopes that were already correct.

── ⛔ READS ONLY, DELIBERATELY ─────────────────────────────────────────────────────────
No send, no draft, no label edit, no delete. `gmail.readonly` is the narrowest scope that
answers "what is in my mail", and every other verb is a different scope, a different
consent screen and a different threat model — a write on the mailbox of the person who
granted consent. `service_tools`' Drive section states the same rule for Drive
(*"NO WRITE TOOL, DELIBERATELY"*) and `SEED-209/210/211/212` fence any AUTOMATIC or
BACKGROUND sync: these run only when a person asks, and only after the posture gate.

── THE BODY IS NEVER LOGGED, AND THE ENUM HALF IS NOT THE BODY ────────────────────────
A Gmail error body echoes the `q` parameter, which carries whatever the person searched
their own mail for. `error.message` and the raw text therefore never travel. Google's
`error.status` and `error.errors[].reason` are a closed enum vocabulary that cannot
contain user text, and those do — the identical rule `cloud_storage._google_error_reason`
carries for Drive, spelled once per module rather than shared, because a shared helper
would put a Drive import in this file's graph for four lines.

── EVERY CALL GOES THROUGH THE BINDER ──────────────────────────────────────────────────
`send_pinned_http` under the `gmail_read` key: scheme check, host allow-list, DNS pin,
redirect refusal and a response cap. This module constructs no client of its own — the
mistake `cloud_storage` shipped with (a raw `httpx.AsyncClient`, validated by nothing)
is the reason that rule is written down.
"""

from __future__ import annotations

import base64
import json as jsonlib
import logging
from typing import Any
from uuid import UUID

from app.security.egress import send_pinned_http
from app.services.oauth_refresh_service import get_fresh_access_token

logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

#: The headers a listing surfaces. Read from the full header set the API returns — see
#: the note in `search_email` on why this is NOT sent as a `metadataHeaders` filter.
_METADATA_HEADERS = ("Subject", "From", "To", "Date")

#: A message body large enough to be an answer and small enough not to be a context bomb.
_MAX_BODY_CHARS = 100_000

__all__ = ["search_email", "read_email", "GmailReadError"]


class GmailReadError(RuntimeError):
    """A Gmail read that did not happen, with a sentence saying why."""


def _error_reason(body: bytes | str | None) -> str:
    """`` (STATUS / reason)`` from Google's enum fields only, or `""`. Never raises."""
    try:
        data = jsonlib.loads(body) if body else {}
        err = data.get("error") or {}
        parts: list[str] = []
        status = err.get("status")
        if isinstance(status, str) and status.replace("_", "").isalnum():
            parts.append(status)
        for entry in err.get("errors") or []:
            reason = (entry or {}).get("reason") if isinstance(entry, dict) else None
            if isinstance(reason, str) and reason.isalnum() and reason not in parts:
                parts.append(reason)
        return f" ({' / '.join(parts)})" if parts else ""
    except Exception:  # noqa: BLE001 — a best-effort read of a body we already distrust
        return ""


async def _token(connection_id: str | UUID) -> str:
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise GmailReadError(
            "this Google connection has no valid OAuth token — reconnect it in "
            "Settings › Connections"
        )
    return token


async def _get(connection_id: str | UUID, path: str, params: dict[str, str], *, what: str) -> Any:
    token = await _token(connection_id)
    resp = await send_pinned_http(
        "gmail_read",
        "GET",
        f"{GMAIL_API_BASE}{path}",
        params=params,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=20.0,
        max_bytes=1024 * 1024,
    )
    if resp.status_code != 200:
        reason = _error_reason(resp.body)
        # The BODY is not logged — see the module docstring. The enum half is.
        logger.error("Gmail %s failed (%s)%s", what, resp.status_code, reason)
        if resp.status_code in (401, 403):
            raise GmailReadError(
                f"Gmail refused {what}: HTTP {resp.status_code}{reason}. If this says "
                "insufficient scope, this connection was authorised before mail access "
                "was added — reconnect it once in Settings › Connections."
            )
        raise GmailReadError(f"Gmail refused {what}: HTTP {resp.status_code}{reason}")
    return jsonlib.loads(resp.body)


def _header(payload: dict, name: str) -> str:
    for h in (payload.get("headers") or []):
        if isinstance(h, dict) and str(h.get("name", "")).lower() == name.lower():
            return str(h.get("value") or "")
    return ""


def _plain_text(payload: dict) -> str:
    """Depth-first walk for the first `text/plain` part, falling back to the top-level body.

    ⚠ HTML IS NOT DECODED INTO THE MODEL'S CONTEXT. A `text/html` part is markup plus
    tracking pixels plus, quite often, an instruction someone else wrote — and this text
    is already wrapped as untrusted by the dispatcher. Plain text or nothing.
    """
    mime = str(payload.get("mimeType") or "")
    body = payload.get("body") or {}
    data = body.get("data")
    if mime.startswith("text/plain") and data:
        try:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", "replace")
        except Exception:  # noqa: BLE001 — a malformed part is not an error, it is empty
            return ""
    for part in (payload.get("parts") or []):
        if isinstance(part, dict):
            found = _plain_text(part)
            if found:
                return found
    return ""


async def search_email(
    connection_id: str | UUID,
    query: str | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """List messages matching a Gmail search, with enough headers to be readable.

    ⚠ TWO ROUND TRIPS PER RESULT IS WHY `limit` IS CAPPED LOW. `messages.list` returns
    ids and nothing else, so each result needs a `messages.get` at `format=metadata`.
    The cap is 25, not 100 like Drive's, because the cost here is per RESULT.
    """
    capped = max(1, min(int(limit or 10), 25))
    listing = await _get(
        connection_id,
        "/messages",
        {"maxResults": str(capped), **({"q": query} if query else {})},
        what="search_email",
    )
    out: list[dict[str, Any]] = []
    for stub in (listing.get("messages") or [])[:capped]:
        mid = (stub or {}).get("id")
        if not mid:
            continue
        # ⚠ NO `metadataHeaders` FILTER, DELIBERATELY. Gmail expects that parameter
        # REPEATED (`metadataHeaders=Subject&metadataHeaders=From`), and the binder's
        # `params` is a `Mapping[str, str]` — one value per key — so a comma-joined
        # spelling would be accepted by the API and silently match no header, returning
        # a listing with every subject blank. `format=metadata` alone returns all
        # headers, which is a few KB against a 1 MB cap; `_header` picks the four that
        # matter. A quiet wrong answer is the thing being avoided here, not bytes.
        meta = await _get(
            connection_id, f"/messages/{mid}", {"format": "metadata"}, what="search_email"
        )
        payload = meta.get("payload") or {}
        row: dict[str, Any] = {"id": mid, "thread_id": meta.get("threadId")}
        # `_METADATA_HEADERS` is the projection, applied HERE rather than sent to the API
        # — one list, one place, and no chance of the constant drifting from the keys.
        for header in _METADATA_HEADERS:
            row[header.lower()] = _header(payload, header)
        row["snippet"] = meta.get("snippet") or ""
        row["unread"] = "UNREAD" in (meta.get("labelIds") or [])
        out.append(row)
    return {"messages": out, "returned": len(out)}


async def read_email(connection_id: str | UUID, message_id: str) -> dict[str, Any]:
    """Return one message's headers and its plain-text body."""
    mid = str(message_id or "").strip()
    if not mid:
        raise GmailReadError("read_email needs a message id and none was supplied")
    msg = await _get(connection_id, f"/messages/{mid}", {"format": "full"}, what="read_email")
    payload = msg.get("payload") or {}
    text = _plain_text(payload)
    return {
        "id": mid,
        "thread_id": msg.get("threadId"),
        "subject": _header(payload, "Subject"),
        "from": _header(payload, "From"),
        "to": _header(payload, "To"),
        "date": _header(payload, "Date"),
        "snippet": msg.get("snippet") or "",
        "text": text[:_MAX_BODY_CHARS] or None,
        "truncated": len(text) > _MAX_BODY_CHARS,
        # An honest absence beats a silent empty string: an HTML-only message HAS a body,
        # it just has no plain-text part, and the reader should be able to tell.
        "note": None if text else (
            "This message has no plain-text part (it is HTML only), so no body text was "
            "read. Open it in Gmail to see it."
        ),
    }
