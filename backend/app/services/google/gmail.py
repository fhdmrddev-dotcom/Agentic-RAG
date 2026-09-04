"""Read-only Gmail, on the SAME connection Drive already uses.

── ⚠ ONE CONNECTION, MORE SCOPES — NEVER A SECOND ROW ─────────────────────────────────
The operator's direction (BUS-037 §B): *"one connection, not many: add the scope to the
authorize request (you re-consent once, same token) and add tools backed by real API
calls under their own egress key."* So there is no `gmail` service id, no second
`connector_connections` row and no second token.

⚠ THIS FILE WAS `services/gmail_read.py` FOR ONE COMMIT. It moved into this package when
Round 1 added four more Google surfaces, because its `_get` / `_error_reason` pair was
about to be copied a fifth time. Nothing about its behaviour changed in the move; the
shared shape lives in `_http.py` and the enum-only error projection is spelled once.

── ⛔ READS ONLY, DELIBERATELY ─────────────────────────────────────────────────────────
No send, no draft, no reply, no label edit, no archive, no trash. `gmail.readonly` is the
narrowest scope that answers "what is in my mail". Writes are a different scope, a
different consent screen and a write on the mailbox of the person who consented —
deferred by decision (operator, 2026-08-31: "reads first, decide after").

── HTML IS NOT DECODED INTO THE MODEL'S CONTEXT ───────────────────────────────────────
A `text/html` part is markup, tracking pixels and, quite often, an instruction someone
else wrote. This text already travels inside the dispatcher's untrusted-content envelope;
adding markup to it buys nothing. Plain text, or an honest note saying there is none.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, decode_b64url, get_json

CAPABILITY = "gmail_read"
API = "https://gmail.googleapis.com/gmail/v1/users/me"

#: The headers a listing surfaces. Applied OUR side — see `search_email` on why this is
#: never sent as a `metadataHeaders` filter.
_HEADERS = ("Subject", "From", "To", "Date")

_MAX_BODY_CHARS = 100_000
#: An attachment big enough to be a document, small enough not to be a memory event.
_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

__all__ = [
    "search_email", "read_email", "read_thread", "list_labels", "read_attachment",
    "CAPABILITY", "GoogleReadError",
]


def _header(payload: dict, name: str) -> str:
    for h in (payload.get("headers") or []):
        if isinstance(h, dict) and str(h.get("name", "")).lower() == name.lower():
            return str(h.get("value") or "")
    return ""


def _plain_text(payload: dict) -> str:
    """Depth-first walk for the first `text/plain` part."""
    mime = str(payload.get("mimeType") or "")
    data = (payload.get("body") or {}).get("data")
    if mime.startswith("text/plain") and data:
        return decode_b64url(data).decode("utf-8", "replace")
    for part in (payload.get("parts") or []):
        if isinstance(part, dict):
            found = _plain_text(part)
            if found:
                return found
    return ""


def _attachments(payload: dict) -> list[dict[str, Any]]:
    """Every attachment's filename, type, size and **attachment id**.

    ⚠ THE ID IS THE WHOLE POINT AND ITS ABSENCE WOULD BE A REACHABILITY DEFECT.
    `read_attachment` takes an `attachment_id`, and that id exists nowhere else in the
    API's output — a model handed only a filename could never call the tool. Shipping the
    reader without the id would be an action advertised on a grant list that nothing can
    reach, which is the exact shape this codebase keeps finding and removing.
    """
    out: list[dict[str, Any]] = []

    def walk(node: dict) -> None:
        body = node.get("body") or {}
        if node.get("filename") and body.get("attachmentId"):
            out.append({
                "filename": node.get("filename"),
                "mime_type": node.get("mimeType"),
                "bytes": body.get("size"),
                "attachment_id": body.get("attachmentId"),
            })
        for part in (node.get("parts") or []):
            if isinstance(part, dict):
                walk(part)

    walk(payload)
    return out


def _message(msg: dict, *, with_body: bool) -> dict[str, Any]:
    payload = msg.get("payload") or {}
    out: dict[str, Any] = {"id": msg.get("id"), "thread_id": msg.get("threadId")}
    for header in _HEADERS:
        out[header.lower()] = _header(payload, header)
    out["snippet"] = msg.get("snippet") or ""
    out["unread"] = "UNREAD" in (msg.get("labelIds") or [])
    out["labels"] = msg.get("labelIds") or []
    if with_body:
        text = _plain_text(payload)
        out["text"] = text[:_MAX_BODY_CHARS] or None
        out["truncated"] = len(text) > _MAX_BODY_CHARS
        out["attachments"] = _attachments(payload)
        out["note"] = None if text else (
            "This message has no plain-text part (it is HTML only), so no body text was "
            "read. Open it in Gmail to see it."
        )
    return out


async def search_email(
    connection_id: str | UUID, query: str | None = None, limit: int = 10
) -> dict[str, Any]:
    """List messages matching a Gmail search, with enough headers to be readable.

    ⚠ TWO ROUND TRIPS PER RESULT IS WHY `limit` IS CAPPED LOW. `messages.list` returns ids
    and nothing else, so each result needs its own `messages.get`.
    """
    capped = max(1, min(int(limit or 10), 25))
    listing = await get_json(
        CAPABILITY, connection_id, f"{API}/messages",
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
        # `params` is one value per key — so a comma-joined spelling is accepted by the
        # API and silently matches NO header, returning a listing with every subject
        # blank. `format=metadata` alone returns all headers; `_HEADERS` is the projection,
        # applied here. A quiet wrong answer is what is being avoided, not bytes.
        meta = await get_json(
            CAPABILITY, connection_id, f"{API}/messages/{mid}", {"format": "metadata"},
            what="search_email",
        )
        out.append(_message({**meta, "id": mid}, with_body=False))
    return {
        "messages": out,
        "returned": len(out),
        "note": None if out else (
            "The search succeeded and matched no mail. This is not a permission problem — "
            "that raises an error instead of returning an empty list."
        ),
    }


async def read_email(connection_id: str | UUID, message_id: str) -> dict[str, Any]:
    """One message's headers, plain-text body and attachment list."""
    mid = str(message_id or "").strip()
    if not mid:
        raise GoogleReadError("read_email needs a message id and none was supplied")
    msg = await get_json(
        CAPABILITY, connection_id, f"{API}/messages/{mid}", {"format": "full"},
        what="read_email", max_bytes=4 * 1024 * 1024,
    )
    return _message({**msg, "id": mid}, with_body=True)


async def read_thread(connection_id: str | UUID, thread_id: str) -> dict[str, Any]:
    """A whole conversation in order — every message's headers, body and attachments.

    ⚠ A THREAD IS THE UNIT A PERSON ACTUALLY MEANS. "What did we agree about the invoice"
    is answered by the exchange, not by whichever single message the search ranked first,
    and reading them one id at a time costs a round trip and an approval click each.
    """
    tid = str(thread_id or "").strip()
    if not tid:
        raise GoogleReadError("read_thread needs a thread id and none was supplied")
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/threads/{tid}", {"format": "full"},
        what="read_thread", max_bytes=8 * 1024 * 1024,
    )
    messages = [
        _message(m, with_body=True)
        for m in (data.get("messages") or []) if isinstance(m, dict)
    ]
    return {"thread_id": tid, "message_count": len(messages), "messages": messages}


async def list_labels(connection_id: str | UUID) -> dict[str, Any]:
    """Every label on this mailbox, system and user-made.

    ⚠ THE REACHABILITY HALF OF `search_email`. Gmail search takes `label:Invoices`, and a
    model that has never seen the list can only guess at label names — which are whatever
    this person happened to type. Without this, half of Gmail's query language is unusable.
    """
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/labels", None, what="list_labels",
    )
    return {
        "labels": [
            {
                "id": l.get("id"),
                "name": l.get("name"),
                "system": (l.get("type") == "system"),
            }
            for l in (data.get("labels") or []) if isinstance(l, dict)
        ]
    }


async def read_attachment(
    connection_id: str | UUID, message_id: str, attachment_id: str
) -> dict[str, Any]:
    """One attachment's TEXT, or an honest refusal for anything binary.

    The `attachment_id` comes from `read_email` / `read_thread`'s `attachments` list.

    ⚠ IT DOES NOT RETURN BYTES, and that is the same rule Drive's `read_file` keeps: a PDF
    or a spreadsheet decoded into a context window is noise that costs tokens and answers
    nothing. The remedy sentence points at the composer's import, which extracts and
    indexes properly.
    """
    mid = str(message_id or "").strip()
    aid = str(attachment_id or "").strip()
    if not mid or not aid:
        raise GoogleReadError(
            "read_attachment needs both a message id and an attachment id — both come "
            "from read_email or read_thread"
        )
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/messages/{mid}/attachments/{aid}", None,
        what="read_attachment", max_bytes=_MAX_ATTACHMENT_BYTES,
    )
    raw = decode_b64url(data.get("data"))
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return {
            "message_id": mid,
            "attachment_id": aid,
            "bytes": len(raw),
            "text": None,
            "note": (
                "This attachment is not text. Import it from the composer's + menu to "
                "have it extracted and indexed, then search it."
            ),
        }
    return {
        "message_id": mid,
        "attachment_id": aid,
        "bytes": len(raw),
        "text": text[:_MAX_BODY_CHARS],
        "truncated": len(text) > _MAX_BODY_CHARS,
    }
