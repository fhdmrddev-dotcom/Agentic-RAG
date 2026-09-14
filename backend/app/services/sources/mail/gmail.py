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

import asyncio
import base64
import time
import json as jsonlib
import logging
from typing import Any

from app.security.egress import send_pinned_http
from app.services.sources.base import FilePage, SourceNode, clamp_read_cap
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

#: How many per-message metadata reads may be in flight at once.
#:
#: ⛔ THIS NUMBER EXISTS BECAUSE THE SEQUENTIAL VERSION WAS MEASURED BROKEN ON A REAL MAILBOX,
#:    not because concurrency is nice to have. Google forces an N+1 — `users.messages.list`
#:    returns *"only an `id` and a `threadId`"* — so a page of 25 costs 26 requests. Issued one
#:    after another that measured **23.4 seconds per page** against the operator's own Gmail, and
#:    `watch_service`'s H-5 listing loop is EXHAUSTIVE: a 201-message inbox meant **~3.5 minutes
#:    of listing before a single message could be ingested.** The operator clicked *Sync now* and
#:    saw nothing happen, which is exactly what that looks like from outside.
#:
#: ⚠ THE COST HAD BEEN SIZED FOR THE WRONG CALLER. A preview reads ONE page, where 23 s is
#:   survivable; a watch reads EVERY page. Drive returns 100 files WITH their metadata in a single
#:   request, so the shared listing loop was built around a cost model mail does not share.
#:
#: ⚠ BOUNDED, not unlimited. Gmail's per-user budget is 250 quota units/second and
#:   `messages.get` costs 5, so 8 in flight stays an order of magnitude inside it. Unbounded
#:   `gather` over a large label would turn a slow listing into a rate-limited one.
_METADATA_CONCURRENCY = 8

#: Gmail's BATCH endpoint. One HTTP request carries many sub-requests.
#:
#: ⛔ THIS IS THE FIX FOR A DEFECT MEASURED ON THE OPERATOR'S OWN INBOX, and the numbers are the
#:    argument. Google forces an N+1 (`messages.list` returns *"only an `id` and a `threadId`"*),
#:    so a page of 25 cost 26 requests: **~13 s per page even with 8 requests in flight**. The
#:    inbox paginated past **375 messages with no end**, and `watch_service`'s H-5 listing loop is
#:    EXHAUSTIVE with `max_pages = 200` — so a full listing would have run **~43 minutes** while
#:    the watch lease is **600 s**. The watch was therefore re-claimed and RESTARTED FROM PAGE 1
#:    every ten minutes, forever, ingesting nothing. From outside: *"I clicked Sync now and
#:    nothing happened."*
#:
#: ⚠ CONCURRENCY WAS NOT ENOUGH, AND THAT WAS MEASURED TOO — 8 / 16 / 25 in flight gave
#:   14.2 / 13.2 / 11.8 s per page. The cost is per-request (each pinned call resolves and
#:   handshakes its own connection), so the only real remedy is FEWER REQUESTS.
#:
#: ⭐ Batching makes a page cost 2 requests instead of 26 without giving anything up: the listing
#:   stays exhaustive, `SourceListing.complete` keeps its meaning, and the preview keeps REAL
#:   SUBJECTS — which Phase 233 exists to protect. The alternative considered and rejected was
#:   dropping per-message metadata and naming rows by message id, which would have reduced that
#:   phase's honest labels to a column of hex.
GMAIL_BATCH_URL = "https://gmail.googleapis.com/batch/gmail/v1"

#: Sub-requests per batch. Google documents 100 as the ceiling and recommends staying below it.
_BATCH_SIZE = 50
_BATCH_MAX_BYTES = 4 * 1024 * 1024
_BATCH_RETRIES = 4
_BATCH_BACKOFF_SECONDS = 2.0


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


# Multi-tenant cache: keyed by (connection_id, label_id) because Gmail user label IDs
# (e.g. 'Label_9', 'Label_10') are per-mailbox, NOT globally unique across accounts.
# Keying by connection_id prevents cross-tenant label name leaking and path corruption (F-1).
_LABEL_NAME_CACHE: dict[tuple[str, str], str] = {}


async def get_label_name(token: str, label_id: str, connection_id: str = "") -> str:
    """Resolve human-readable label name (e.g. 'Finance' for 'Label_9') for WR-04.

    System labels have id == name. User labels query /labels/{id} and cache the result.
    Keyed by (connection_id, label_id) to prevent cross-tenant collisions (F-1).
    """
    if not label_id:
        return ""
    if label_id in ("INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "UNREAD", "IMPORTANT"):
        return label_id
    cache_key = (connection_id or "", label_id)
    if cache_key in _LABEL_NAME_CACHE:
        return _LABEL_NAME_CACHE[cache_key]

    try:
        resp = await send_pinned_http(
            EGRESS_KEY,
            "GET",
            f"{GMAIL_API_BASE}/labels/{label_id}",
            headers=_headers(token),
            timeout=15.0,
            max_bytes=_LABEL_LIST_MAX_BYTES,
        )
        if resp.status_code == 200:
            data = jsonlib.loads(resp.body)
            name = str(data.get("name") or label_id)
            if len(_LABEL_NAME_CACHE) > 5000:
                _LABEL_NAME_CACHE.clear()
            _LABEL_NAME_CACHE[cache_key] = name
            return name
    except Exception:
        pass
    return label_id


async def list_labels(token: str, connection_id: str = "") -> list[SourceNode]:
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
    if len(_LABEL_NAME_CACHE) > 5000:
        _LABEL_NAME_CACHE.clear()
    for lbl in labels:
        _LABEL_NAME_CACHE[(connection_id or "", str(lbl["id"]))] = str(lbl.get("name") or lbl["id"])

    def sort_key(lbl: dict[str, Any]) -> tuple[int, str]:
        is_user = 1 if str(lbl.get("type", "")).lower() == "user" else 0
        return (is_user, str(lbl.get("name") or lbl["id"]).lower())

    # ⚠ ONE anchor for the whole listing, taken once, so every label offered in the same browse
    #   carries the same moment. Taking it per-label would give two labels picked in one sitting
    #   two different start times for no reason a person could see.
    anchor = int(time.time())
    return [
        mailbox.label_to_node(str(lbl["id"]), str(lbl.get("name") or lbl["id"]), anchor)
        for lbl in sorted(labels, key=sort_key)
    ]



def _subject_of(meta: dict[str, Any]) -> str | None:
    for header in (meta.get("payload") or {}).get("headers") or []:
        if isinstance(header, dict) and str(header.get("name", "")).lower() == "subject":
            return header.get("value")
    return None


def _build_batch_body(ids: list[str], boundary: str) -> bytes:
    """A `multipart/mixed` body of `application/http` sub-requests, one per message."""
    parts: list[str] = []
    for i, msg_id in enumerate(ids):
        query = "format=metadata&" + "&".join(
            f"metadataHeaders={h}" for h in METADATA_HEADERS
        )
        parts.append(
            f"--{boundary}\r\n"
            "Content-Type: application/http\r\n"
            f"Content-ID: <item-{i}>\r\n\r\n"
            f"GET /gmail/v1/users/me/messages/{msg_id}?{query}\r\n\r\n"
        )
    parts.append(f"--{boundary}--\r\n")
    return "".join(parts).encode("utf-8")


def _parse_batch_response(
    body: bytes, content_type: str
) -> list[tuple[int | None, int, dict[str, Any]]]:
    """Each sub-response as `(request_index, status_code, parsed_json)`.

    ⛔ **THE INDEX IS THE POINT (code review WR-01).** This used to return a bare positional list
    and the caller `zip`ped it against the request chunk — while `_build_batch_body` was writing
    `Content-ID: <item-N>` for every sub-request and this function threw it away. **Google's
    batch documentation does not guarantee response order**; it tells clients to correlate on
    `Content-ID`. Emitting a correlation handle and never reading it is the tell.

    ⚠ `request_index` is `None` when the header is missing or unparseable, so the caller can fall
    back to position rather than fail a page over a shape this parser has not seen.

    ⚠ Parsed with the stdlib `email` package rather than by hand, because a batch response IS a
    MIME document and this codebase already trusts that parser with untrusted mail.
    """
    import email as _email  # noqa: PLC0415
    import email.policy  # noqa: PLC0415

    raw = b"Content-Type: " + content_type.encode("ascii", "replace") + b"\r\n\r\n" + body
    outer = _email.message_from_bytes(raw, policy=_email.policy.default)

    results: list[tuple[int | None, int, dict[str, Any]]] = []
    for part in outer.iter_parts() if outer.is_multipart() else []:
        # Google echoes the request's `<item-N>` back as `<response-item-N>`; take the trailing
        # integer of whichever shape arrives, and `None` when there is no readable one.
        cid_tail = (part.get("Content-ID") or "").strip().strip("<>").rsplit("-", 1)[-1]
        req_index = int(cid_tail) if cid_tail.isdigit() else None
        payload = part.get_payload(decode=True)
        if payload is None:
            text = part.get_payload()
            payload = text.encode("utf-8", "replace") if isinstance(text, str) else b""
        # A sub-response is a raw HTTP response: status line, headers, blank line, body.
        head, _, sub_body = payload.partition(b"\r\n\r\n")
        status = 0
        first_line = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
        bits = first_line.split()
        if len(bits) >= 2 and bits[1].isdigit():
            status = int(bits[1])
        try:
            parsed = jsonlib.loads(sub_body) if sub_body.strip() else {}
        except Exception:  # noqa: BLE001
            parsed = {}
        results.append((req_index, status, parsed if isinstance(parsed, dict) else {}))
    return results


async def _fetch_metadata_batched(token: str, ids: list[str]) -> dict[str, dict[str, Any]]:
    """Subject / date / size for many messages, in as few requests as possible.

    ⛔ FAILS CLOSED, exactly as the per-message path did. A sub-request that did not answer 200
    raises, so `watch_service` marks the listing incomplete and suppresses missing-state
    transitions. An empty-but-"complete" listing is what the `H-5` deletion guard consumes, and
    Phase 239 recorded that shape as the more urgent half of its own defect.
    """
    out: dict[str, dict[str, Any]] = {}
    for start in range(0, len(ids), _BATCH_SIZE):
        chunk = ids[start : start + _BATCH_SIZE]
        boundary = "batch_agentic_rag_240"

        # ⚠ 429 IS EXPECTED HERE AND IS NOT AN ERROR CONDITION — it was hit on the very first
        #   live batch run, because batching turns a slow trickle of requests into a burst.
        #   Gmail's per-user budget is 250 quota units/second and `messages.get` costs 5, so a
        #   50-message batch spends 250 in one go. Backing off is part of using the endpoint
        #   correctly, not a workaround. ⛔ Bounded: after the last attempt it RAISES, so the
        #   listing is marked incomplete and no deletion signal is ever derived from a short read.
        resp = None
        for attempt in range(_BATCH_RETRIES):
            resp = await send_pinned_http(
                EGRESS_KEY,
                "POST",
                GMAIL_BATCH_URL,
                content=_build_batch_body(chunk, boundary),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": f"multipart/mixed; boundary={boundary}",
                },
                timeout=60.0,
                max_bytes=_BATCH_MAX_BYTES,
            )
            if resp.status_code != 429:
                break
            delay = _BATCH_BACKOFF_SECONDS * (2 ** attempt)
            logger.warning(
                "Gmail batch rate-limited (429); retrying in %.1fs (attempt %d/%d)",
                delay, attempt + 1, _BATCH_RETRIES,
            )
            await asyncio.sleep(delay)

        if resp is None or resp.status_code != 200:
            code = resp.status_code if resp is not None else 0
            reason = _gmail_error_reason(resp.body if resp is not None else None)
            raise ValueError(f"Failed to read message metadata: HTTP {code}{reason}")

        content_type = ""
        for k, v in (resp.headers or {}).items():
            if k.lower() == "content-type":
                content_type = v
                break

        subs = _parse_batch_response(resp.body, content_type)
        if len(subs) != len(chunk):
            raise ValueError(
                f"Gmail batch returned {len(subs)} responses for {len(chunk)} messages"
            )
        # ⚠ A SUB-RESPONSE CAN BE 429 WHILE THE ENVELOPE IS 200 — that is exactly what the first
        #   live run returned, and treating it as a hard failure would make a busy mailbox
        #   permanently unreadable. Rate-limited members are retried once, serially and slowly,
        #   rather than failing the page.
        # ⛔ PAIR BY `Content-ID`, NOT BY POSITION (code review WR-01). When every sub-response
        #    carries a distinct, in-range index, that index decides which request it answers.
        #    Positional pairing is kept ONLY for a response with no readable indices at all, so a
        #    wire shape this parser has not seen degrades to the previous behaviour rather than
        #    failing a page.
        # ⚠ A PARTIAL OR REPEATED SET IS A REFUSAL, not a guess: pairing half by id and half by
        #   position is how the wrong message would silently take another's metadata.
        indices = [idx for idx, _s, _m in subs]
        if any(i is not None for i in indices):
            if sorted(i for i in indices if i is not None) != list(range(len(chunk))):
                raise ValueError(
                    f"Gmail batch Content-IDs did not cover {len(chunk)} requests exactly: "
                    f"{indices!r}"
                )
            paired = [(chunk[idx], status, meta) for idx, status, meta in subs]
        else:
            paired = [(mid, status, meta) for mid, (_i, status, meta) in zip(chunk, subs)]

        retry_ids: list[str] = []
        for msg_id, status, meta in paired:
            if status == 429:
                retry_ids.append(msg_id)
                continue
            if status != 200:
                raise ValueError(f"Failed to read message metadata: HTTP {status}")
            out[msg_id] = meta

        if retry_ids:
            logger.warning(
                "Gmail batch: %d of %d sub-requests were rate-limited; re-reading them slowly",
                len(retry_ids), len(chunk),
            )
            await asyncio.sleep(_BATCH_BACKOFF_SECONDS)
            for msg_id in retry_ids:
                meta_resp = await send_pinned_http(
                    EGRESS_KEY,
                    "GET",
                    f"{GMAIL_API_BASE}/messages/{msg_id}",
                    params={"format": "metadata", "metadataHeaders": list(METADATA_HEADERS)},
                    headers=_headers(token),
                    timeout=15.0,
                    max_bytes=_MESSAGE_META_MAX_BYTES,
                )
                if meta_resp.status_code != 200:
                    reason = _gmail_error_reason(meta_resp.body)
                    raise ValueError(
                        f"Failed to read message metadata: HTTP {meta_resp.status_code}{reason}"
                    )
                out[msg_id] = jsonlib.loads(meta_resp.body)
    return out


async def list_messages(
    token: str,
    *,
    label_id: str,
    label_name: str | None = None,
    page_token: str | None = None,
    page_size: int = mailbox.MAIL_PAGE_SIZE,
    after_epoch_seconds: int | None = None,
) -> FilePage:
    """One page of messages in a label, as files.

    ⚠ N+1 BY NECESSITY, NOT BY OVERSIGHT (D-240-12). The list endpoint returns ids only, so a
    second small request per message buys the subject, the size and the timestamp. The
    alternative was naming each row by its message id, which would have made Phase 233's honest
    preview labels a column of hex.
    """
    if after_epoch_seconds is None:
        # ⛔ REFUSED, NOT DEFAULTED, AND THE REFUSAL IS THE SAFE ANSWER. Every alternative default
        #   is worse: no filter re-creates the 30,000-message treadmill that made this watch
        #   ingest nothing for hours, and a rolling window (say "last 30 days") lets messages age
        #   OUT of a COMPLETE listing — which `watch_service` reads as deleted-at-source. A
        #   worded refusal costs one re-created watch; the alternatives cost silent wrong state.
        raise ValueError(
            "This mail folder has no start date, so listing it would try to read the entire "
            "mailbox. Remove this watch and add it again — mail folders picked from now on "
            "carry the moment you chose them."
        )

    params: dict[str, str] = {"maxResults": str(page_size)}
    if label_id:
        params["labelIds"] = label_id
    if page_token:
        params["pageToken"] = page_token
    # Gmail's own search syntax. ⚠ SECONDS, not a calendar date — Google's filtering guide warns
    # that a bare date is read as *"midnight on that date in the PST timezone"* and says to pass
    # seconds for accuracy anywhere else.
    params["q"] = f"after:{int(after_epoch_seconds)}"

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
    ids = [
        str((stub or {}).get("id"))
        for stub in (data.get("messages") or [])
        if (stub or {}).get("id")
    ]

    if not ids:
        return FilePage(
            files=[],
            next_page_token=data.get("nextPageToken"),
            deletions_detectable=False,
        )

    # ⭐ ONE REQUEST FOR THE WHOLE PAGE. See GMAIL_BATCH_URL for the measurements that forced it.
    # ⚠ The per-message path below is kept as a FALLBACK and is not dead code: if Google ever
    #   answers the batch endpoint with something this parser cannot read, a slow listing is a
    #   better outcome than no listing. A batch sub-request that returns non-200 still RAISES —
    #   only a malformed BATCH ENVELOPE degrades.
    try:
        metas = await _fetch_metadata_batched(token, ids)
        return FilePage(
            files=[
                mailbox.message_to_file(
                    message_id=str((metas.get(mid) or {}).get("id") or mid),
                    subject=_subject_of(metas.get(mid) or {}),
                    internal_date=(metas.get(mid) or {}).get("internalDate"),
                    size=(metas.get(mid) or {}).get("sizeEstimate"),
                    label_name=label_name or label_id or None,
                )
                for mid in ids
            ],
            next_page_token=data.get("nextPageToken"),
            # ⛔ THE SAME DECLARATION AS THE FALLBACK PATH BELOW, and it has to be on BOTH —
            #    this is the branch that actually runs, so marking only the other one would
            #    have left the defect live while looking fixed.
            deletions_detectable=False,
        )
    except ValueError:
        raise
    except Exception as batch_exc:  # noqa: BLE001
        logger.warning(
            "Gmail batch metadata read failed (%s) — falling back to per-message reads",
            batch_exc,
        )

    semaphore = asyncio.Semaphore(_METADATA_CONCURRENCY)

    async def _one(msg_id: str):
        async with semaphore:
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
            # ⚠ ONE UNREADABLE MESSAGE MUST NOT EMPTY A LISTING, AND CONCURRENCY DOES NOT COST
            #   THAT PROPERTY. `SourceListing.complete` fails closed on an exception, and an
            #   empty-but-"complete" listing is what the H-5 deletion guard consumes — Phase 239
            #   recorded exactly that shape as the more urgent half of its own defect. Raising
            #   here still propagates out of the `gather` below, so the watch loop marks the
            #   listing incomplete and suppresses missing-state transitions.
            reason = _gmail_error_reason(meta_resp.body)
            raise ValueError(
                f"Failed to read message metadata: HTTP {meta_resp.status_code}{reason}"
            )
        meta = jsonlib.loads(meta_resp.body)
        return mailbox.message_to_file(
            message_id=str(meta.get("id") or msg_id),
            subject=_subject_of(meta),
            internal_date=meta.get("internalDate"),
            size=meta.get("sizeEstimate"),
            label_name=label_name or label_id or None,
        )

    # ⚠ `gather` PRESERVES INPUT ORDER, which is what keeps the page in Gmail's own recency
    #   order. Collecting completions as they finish would reorder the preview for no reason.
    files = list(await asyncio.gather(*(_one(msg_id) for msg_id in ids))) if ids else []

    # ⛔ LEAVING A LABEL IS NOT DELETION (code review WR-03). Gmail's Archive button removes
    #    `INBOX`, so an archived message drops out of this listing exactly like a deleted one.
    #    Declaring it here — rather than branching in `watch_service` — is what keeps one rule
    #    for every family. `SEED-264` carries the sharper version that could tell them apart.
    return FilePage(
        files=files, next_page_token=data.get("nextPageToken"), deletions_detectable=False
    )


def _decode_raw(raw_b64url: str) -> bytes:
    """base64url with the padding Google strips restored.

    ⚠ Without the padding restore this raises ``binascii.Error`` on roughly two thirds of all
    messages — a failure that looks like a corrupt mailbox rather than a decoder bug.
    """
    padded = raw_b64url + "=" * (-len(raw_b64url) % 4)
    return base64.urlsafe_b64decode(padded)


async def read_message(
    token: str, message_id: str, max_bytes: int | None = None
) -> tuple[str, bytes, str]:
    """One message as RFC-822 bytes — the same bytes a ``.eml`` upload carries.

    ``max_bytes`` (244-08 / T-244-06-07) lets a caller with a TIGHTER ceiling than the
    operator's say so — the chat's cloud door accepts 10 MB, and a mail id reaches this
    function through exactly the same picker a Drive file does. Clamped, so it can only
    tighten; the 4/3 base64 inflation is applied to whichever ceiling won.
    """
    ceiling = clamp_read_cap(max_bytes)
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
