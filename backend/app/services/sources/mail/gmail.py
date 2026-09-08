"""Phase 240 (SRC-05 / D-240-04 · D-240-12 · D-240-13 · D-240-14) — the Gmail half of the shape.

Everything provider-specific about reading a mailbox lives here. ``mailbox.py`` holds everything
that is not, which is what makes a second family (Microsoft Graph, `SEED-260`) a second file
beside this one plus the same three delegation lines in its adapter — rather than a fourth
``SourceAdapter``.

## Facts taken from Google's own reference, not from memory

CLAUDE.md's provider-docs-first rule, applied. Each of these decided a line of code:

* ``users.messages.get`` with ``format=RAW`` returns *"The entire email message in an RFC 2822
  formatted and base64url encoded string."*
  https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages
  → so the bytes this module yields are the bytes ``parse_eml_bytes`` already reads.
* ``users.messages.list``: *"each message resource contains only an `id` and a `threadId`.
  Additional message details can be fetched using the messages.get method."*
  https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
  → so a listing is unavoidably N+1, which is why ``MAIL_PAGE_SIZE`` is 25 (D-240-12).
* ``internalDate`` is *"the internal message creation timestamp (epoch ms) … more reliable than
  the `Date` header"* → so it, not ``Date``, is the version key.

## Two rules this module must never break

⛔ **``gmail_read``, never ``drive_read``.** Both resolve to ``googleapis.com``, so the pin alone
would not tell them apart — the KEY is what an audit can grep, and it is what makes "a Drive tool
cannot reach Gmail" a checkable statement rather than a hope. ``service_tools.py`` records the
same rule for the chat-time tools.

⛔ **Reads only.** ``gmail.compose`` sits on this very token (Phase 221 step 2), and nothing in
this module may call an endpoint that mutates a mailbox. The standing rule is that no outbound
capability exists before its approval model does.
"""

from __future__ import annotations

import base64
import json as jsonlib
import logging
from typing import Any

from app.models.user_settings import source_max_file_bytes
from app.security.egress import send_pinned_http
from app.services.sources.base import FilePage, SourceNode
from app.services.sources.mail import mailbox

logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

#: The egress capability every call in this module uses. Named once so a grep is decisive.
EGRESS_KEY = "gmail_read"

#: Headers worth one round trip. Subject names the row, Date is a human-readable fallback, and
#: Message-Id is here so a future caller can derive a thread key WITHOUT a second fetch — the
#: derivation itself lives in `email_extraction_service.thread_key_for` and reads the full
#: message, but asking for the header now costs nothing and documents the intent.
METADATA_HEADERS = ("Subject", "Date", "Message-Id")

_LABEL_LIST_MAX_BYTES = 256 * 1024
_MESSAGE_LIST_MAX_BYTES = 256 * 1024
_MESSAGE_META_MAX_BYTES = 64 * 1024


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _gmail_error_reason(body: bytes | str | None) -> str:
    """Google's machine-readable error enums only — never the raw body.

    Reuses the shape ``google_drive._google_error_reason`` established, for the same reason it
    exists there: an error body can echo a query, and a query can contain someone's mail.
    """
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
    except Exception:  # noqa: BLE001
        return ""


def _scope_hint(status_code: int, reason: str) -> str:
    """⚠ A 403 here almost always means a token minted BEFORE the mail scope was added.

    ``oauth_service.py`` states it plainly: *"an EXISTING connection does not widen itself. A
    token carries the scopes granted at consent time."* Saying so beats a bare HTTP 403, which
    sends a person looking for a bug that is really a reconnect.
    """
    if status_code == 403:
        return (
            " — this Google connection may have been authorised before mail access was added. "
            "Reconnect it once to grant the mail scope."
        )
    return reason


async def list_labels(token: str) -> list[SourceNode]:
    """Mail labels, as folders. System labels first, then user labels alphabetically."""
    resp = await send_pinned_http(
        EGRESS_KEY,
        "GET",
        f"{GMAIL_API_BASE}/labels",
        headers=_headers(token),
        timeout=15.0,
        max_bytes=_LABEL_LIST_MAX_BYTES,
    )
    if resp.status_code != 200:
        reason = _gmail_error_reason(resp.body)
        logger.error("Gmail label listing failed (%s)%s", resp.status_code, reason)
        raise ValueError(
            f"Failed to list mail folders: HTTP {resp.status_code}"
            f"{_scope_hint(resp.status_code, reason)}"
        )

    data = jsonlib.loads(resp.body)
    labels = [lbl for lbl in data.get("labels", []) if isinstance(lbl, dict) and lbl.get("id")]

    def sort_key(lbl: dict[str, Any]) -> tuple[int, str]:
        is_user = 1 if str(lbl.get("type", "")).lower() == "user" else 0
        return (is_user, str(lbl.get("name") or lbl["id"]).lower())

    return [
        mailbox.label_to_node(str(lbl["id"]), str(lbl.get("name") or lbl["id"]))
        for lbl in sorted(labels, key=sort_key)
    ]


def _subject_of(meta: dict[str, Any]) -> str | None:
    for header in (meta.get("payload") or {}).get("headers") or []:
        if isinstance(header, dict) and str(header.get("name", "")).lower() == "subject":
            return header.get("value")
    return None


async def list_messages(
    token: str,
    *,
    label_id: str,
    label_name: str | None = None,
    page_token: str | None = None,
    page_size: int = mailbox.MAIL_PAGE_SIZE,
) -> FilePage:
    """One page of messages in a label, as files.

    ⚠ N+1 BY NECESSITY, NOT BY OVERSIGHT (D-240-12). The list endpoint returns ids only, so a
    second small request per message buys the subject, the size and the timestamp. The
    alternative was naming each row by its message id, which would have made Phase 233's honest
    preview labels a column of hex.
    """
    params: dict[str, str] = {"maxResults": str(page_size)}
    if label_id:
        params["labelIds"] = label_id
    if page_token:
        params["pageToken"] = page_token

    resp = await send_pinned_http(
        EGRESS_KEY,
        "GET",
        f"{GMAIL_API_BASE}/messages",
        params=params,
        headers=_headers(token),
        timeout=20.0,
        max_bytes=_MESSAGE_LIST_MAX_BYTES,
    )
    if resp.status_code != 200:
        reason = _gmail_error_reason(resp.body)
        logger.error("Gmail message listing failed (%s)%s", resp.status_code, reason)
        raise ValueError(
            f"Failed to list messages: HTTP {resp.status_code}"
            f"{_scope_hint(resp.status_code, reason)}"
        )

    data = jsonlib.loads(resp.body)
    files = []
    for stub in data.get("messages", []) or []:
        msg_id = (stub or {}).get("id")
        if not msg_id:
            continue
        meta_resp = await send_pinned_http(
            EGRESS_KEY,
            "GET",
            f"{GMAIL_API_BASE}/messages/{msg_id}",
            params={
                "format": "metadata",
                "metadataHeaders": list(METADATA_HEADERS),
            },
            headers=_headers(token),
            timeout=15.0,
            max_bytes=_MESSAGE_META_MAX_BYTES,
        )
        if meta_resp.status_code != 200:
            # ⚠ ONE UNREADABLE MESSAGE MUST NOT EMPTY A LISTING. `SourceListing.complete` fails
            #   closed on an exception, and an empty-but-"complete" listing is what the H-5
            #   deletion guard consumes — Phase 239 recorded exactly that shape as the more
            #   urgent half of its own defect. Raising here is the honest move: the watch loop
            #   marks the listing incomplete and suppresses missing-state transitions.
            reason = _gmail_error_reason(meta_resp.body)
            raise ValueError(
                f"Failed to read message metadata: HTTP {meta_resp.status_code}{reason}"
            )
        meta = jsonlib.loads(meta_resp.body)
        files.append(
            mailbox.message_to_file(
                message_id=str(meta.get("id") or msg_id),
                subject=_subject_of(meta),
                internal_date=meta.get("internalDate"),
                size=meta.get("sizeEstimate"),
                label_name=label_name or label_id or None,
            )
        )

    return FilePage(files=files, next_page_token=data.get("nextPageToken"))


def _decode_raw(raw_b64url: str) -> bytes:
    """base64url with the padding Google strips restored.

    ⚠ Without the padding restore this raises ``binascii.Error`` on roughly two thirds of all
    messages — a failure that looks like a corrupt mailbox rather than a decoder bug.
    """
    padded = raw_b64url + "=" * (-len(raw_b64url) % 4)
    return base64.urlsafe_b64decode(padded)


async def read_message(token: str, message_id: str) -> tuple[str, bytes, str]:
    """One message as RFC-822 bytes — the same bytes a ``.eml`` upload carries."""
    ceiling = source_max_file_bytes()
    resp = await send_pinned_http(
        EGRESS_KEY,
        "GET",
        f"{GMAIL_API_BASE}/messages/{message_id}",
        params={"format": "raw"},
        headers=_headers(token),
        timeout=30.0,
        # The envelope is JSON around base64, which inflates 4/3 — the relation SEED-258 pinned.
        max_bytes=max(ceiling + ceiling // 3 + 64 * 1024, 64 * 1024),
    )
    if resp.status_code != 200:
        reason = _gmail_error_reason(resp.body)
        raise ValueError(
            f"Failed to read message: HTTP {resp.status_code}"
            f"{_scope_hint(resp.status_code, reason)}"
        )

    data = jsonlib.loads(resp.body)
    raw_b64 = data.get("raw")
    if not raw_b64:
        raise ValueError("Gmail returned a message with no raw content")

    content = _decode_raw(raw_b64)
    if len(content) > ceiling:
        raise ValueError(
            f"Message is {len(content)} bytes, over the {ceiling}-byte source file ceiling. "
            "Raise it in Settings if this size should be allowed."
        )

    from app.services.email_extraction_service import parse_eml_bytes  # noqa: PLC0415

    try:
        subject = parse_eml_bytes(content).subject
    except Exception:  # noqa: BLE001 — a name is not worth failing an ingest over
        subject = None

    return mailbox.message_filename(subject), content, mailbox.MAIL_MIME


async def check(token: str) -> tuple[bool, str | None, dict[str, Any]]:
    """Is the mail surface reachable with this token? Used by the adapter's health check."""
    try:
        resp = await send_pinned_http(
            EGRESS_KEY,
            "GET",
            f"{GMAIL_API_BASE}/profile",
            headers=_headers(token),
            timeout=10.0,
            max_bytes=16 * 1024,
        )
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), {}
    if resp.status_code != 200:
        reason = _gmail_error_reason(resp.body)
        return False, f"HTTP {resp.status_code}{_scope_hint(resp.status_code, reason)}", {}
    return True, None, {"mail": "reachable"}
