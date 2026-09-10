"""
Email extraction service for Outlook (.msg) and internet email (.eml) files (Phase 203 EML-01/02).

Extracts structured headers into first-class metadata, strips quoted reply/forwarding chains
for clean retrieval chunking, and extracts attachments for document relationships.
"""
from __future__ import annotations

import email
import email.policy
import email.utils
from email.header import decode_header
import html
from html.parser import HTMLParser
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

log = logging.getLogger(__name__)

# ── 203 HARDENING — the bounds the plan's own <threat_model> named and the first pass did not
#    implement. They live HERE, not at the call site, because `documents.py` parses the raw bytes
#    a SECOND time for the attachment cascade: a cap enforced at one call site would be absent at
#    the other, and the two would disagree about what a safe email is.
#
# ⚠ THE SIZE CAP IS THE WEAKER OF THE TWO AND THAT IS STATED RATHER THAN IMPLIED. An attachment
#   cannot exceed its parent email, and `upload_document` already refuses a body over 50 MB, so the
#   per-attachment ceiling was never unbounded. THE COUNT IS THE REAL AMPLIFICATION: one 50 MB
#   email can carry tens of thousands of 1 KB parts, and each one became a `documents` row, a
#   storage object and an ingestion job.
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
MAX_ATTACHMENTS_PER_EMAIL = 50
#: Longest attachment filename kept, before the extension is re-appended.
_MAX_ATTACHMENT_NAME_LEN = 120

EML_MIME = "message/rfc822"
MSG_MIMES: frozenset[str] = frozenset({
    "application/vnd.ms-outlook",
    "application/x-msg",
})


class _HTMLToPlainText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in ("script", "style", "head"):
            self._skip = True
        elif tag.lower() in ("p", "br", "div", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in ("script", "style", "head"):
            self._skip = False
        elif tag.lower() in ("p", "div", "tr", "li"):
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self._chunks.append(data)

    def get_text(self) -> str:
        text = "".join(self._chunks)
        # Collapse excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def html_to_plain_text(html_content: str) -> str:
    """Convert HTML string to clean plain text."""
    if not html_content or not html_content.strip():
        return ""
    parser = _HTMLToPlainText()
    parser.feed(html_content)
    return html.unescape(parser.get_text())


# ── 260825 — `scrub_text` MOVED to `app.services.text_sanitize`, NOT deleted.
#    BUG-260825-01 proved the document ingestion path had NO NUL strip at all while this
#    module had one, so the fix needed ONE shared home rather than a fourth private copy.
#    The re-export below keeps the Phase 203 import path live: `from
#    app.services.email_extraction_service import scrub_text` still resolves, this module's
#    own 15 call sites below are untouched, and the moved body is byte-identical.
from app.services.text_sanitize import scrub_text  # noqa: F401  (re-export — see above)


def sanitize_attachment_filename(name: str | None) -> str:
    """Reduce an attachment name to a leaf filename that is safe to use as a storage key.

    ⚠ THE NAME ARRIVES FROM THE EMAIL AND IS ATTACKER-CONTROLLED. It was previously interpolated
    straight into ``f"{user_id}/{doc_id}/{filename}"``, so a part named ``../../x`` produced a key
    outside the caller's own prefix. Whether the object store normalises that is not ours to rely
    on — the fix is to never emit the separator.

    Keeps ONLY the basename, drops path separators, drops NUL and control characters, refuses the
    pure-dot names, and bounds the length while preserving the extension (the extension is what
    ``_EXT_MIME_OVERRIDES`` routes on downstream, so truncating it would change the MIME verdict).
    Never returns the empty string.
    """
    if not name:
        return "attachment"
    # Both separators, whatever the producing platform used.
    leaf = str(name).replace("\\", "/").rsplit("/", 1)[-1]
    leaf = "".join(ch for ch in leaf if ch.isprintable() and ch not in '\0')
    leaf = leaf.strip().strip(".").strip()
    if not leaf:
        return "attachment"
    if len(leaf) > _MAX_ATTACHMENT_NAME_LEN:
        if "." in leaf:
            stem, _, ext = leaf.rpartition(".")
            ext = ext[:16]
            leaf = stem[: _MAX_ATTACHMENT_NAME_LEN - len(ext) - 1] + "." + ext
        else:
            leaf = leaf[:_MAX_ATTACHMENT_NAME_LEN]
    return leaf or "attachment"


def _accept_attachment(collected: list, raw: bytes) -> bool:
    """Whether one more part fits under both bounds. Logs the refusal — a silently dropped
    attachment and an email that genuinely had none must not look the same in the log."""
    if len(collected) >= MAX_ATTACHMENTS_PER_EMAIL:
        log.warning(
            "email attachment cap reached (%d) — remaining parts skipped", MAX_ATTACHMENTS_PER_EMAIL
        )
        return False
    if len(raw) > MAX_ATTACHMENT_BYTES:
        log.warning(
            "email attachment of %d bytes exceeds the %d-byte cap — skipped",
            len(raw), MAX_ATTACHMENT_BYTES,
        )
        return False
    return True


@dataclass
class EmailAttachment:
    filename: str
    content_type: str
    raw: bytes
    size: int


@dataclass
class ParsedEmail:
    subject: str = ""
    sender: str = ""
    to: list[str] = field(default_factory=list)
    cc: list[str] = field(default_factory=list)
    bcc: list[str] = field(default_factory=list)
    date: str | None = None
    message_id: str | None = None
    in_reply_to: str | None = None
    references: list[str] = field(default_factory=list)
    body: str = ""
    clean_body: str = ""
    attachments: list[EmailAttachment] = field(default_factory=list)
    headers: dict[str, str] = field(default_factory=dict)


def _decode_header_str(val: str | None) -> str:
    """Safely decode RFC 2047 encoded email headers."""
    if not val:
        return ""
    try:
        decoded_parts = decode_header(val)
        res = []
        for text, encoding in decoded_parts:
            if isinstance(text, bytes):
                enc = encoding or "utf-8"
                try:
                    res.append(text.decode(enc, errors="replace"))
                except (LookupError, UnicodeDecodeError):
                    res.append(text.decode("latin-1", errors="replace"))
            else:
                res.append(str(text))
        return "".join(res).strip()
    except Exception:
        return str(val).strip()


def _format_date_iso(raw_date: str | datetime | None) -> str | None:
    """Normalize date header into ISO 8601 format."""
    if not raw_date:
        return None
    if isinstance(raw_date, datetime):
        return raw_date.isoformat()
    try:
        parsed_tuple = email.utils.parsedate_to_datetime(str(raw_date))
        if parsed_tuple:
            return parsed_tuple.isoformat()
    except Exception:
        pass
    return str(raw_date).strip()


def strip_quoted_replies(text: str) -> str:
    """Strip quoted email replies, forwarded message blocks, and thread history.

    Prevents duplicate retrieval poisoning by ensuring chunks only contain the active email message.
    """
    if not text:
        return ""

    lines = text.splitlines()
    cleaned_lines: list[str] = []

    # Patterns indicating the start of a forwarded/replied message block
    REPLY_HEADER_PATTERNS = [
        re.compile(r"^-----Original Message-----", re.IGNORECASE),
        re.compile(r"^_{10,}\s*$"),  # Outlook divider line
        re.compile(r"^\s*On\s+.+?wrote:\s*$", re.IGNORECASE),
        re.compile(r"^\s*From:\s*.+?\n\s*Sent:\s*.+?", re.IGNORECASE),
        re.compile(r"^\s*From:\s*.+?\n\s*To:\s*.+?", re.IGNORECASE),
    ]

    for idx, line in enumerate(lines):
        # 1. Check for single-line delimiter
        if any(pat.match(line.strip()) for pat in REPLY_HEADER_PATTERNS[:3]):
            break

        # 2. Check for multi-line Outlook style "From: ... \n Sent: ... "
        if idx + 1 < len(lines):
            two_lines = f"{line}\n{lines[idx+1]}"
            if REPLY_HEADER_PATTERNS[3].match(two_lines) or REPLY_HEADER_PATTERNS[4].match(two_lines):
                break

        # 3. Leading quote prefix '>' — DROP the line, never BREAK on it.
        #
        # ⚠ THIS WAS A `break`, AND A `break` HERE LOSES ORIGINAL CONTENT. One quoted line
        #   anywhere in the body — a markdown blockquote, a pasted diff, a single quoted sentence
        #   in the opening paragraph — discarded EVERYTHING after it. Worse in combination with the
        #   empty-result fallback below: when the FIRST line was quoted, `cleaned_lines` came out
        #   empty and the function returned the entire UNSTRIPPED body, so the same rule both
        #   over-stripped and under-stripped depending only on where the quote sat.
        #
        # Dropping instead still removes the reply trail — a real trail is quoted to the END of the
        # message, so filtering and truncating remove the same lines — while a quote in the middle
        # of live prose now costs one line rather than the remainder of the email.
        if line.strip().startswith(">"):
            continue

        cleaned_lines.append(line)

    result = "\n".join(cleaned_lines).strip()
    # Fallback to original text if stripping removed everything
    return result if result else text.strip()


def parse_eml_bytes(raw: bytes) -> ParsedEmail:
    """Parse RFC-822 email (.eml) bytes into structured ParsedEmail."""
    msg = email.message_from_bytes(raw, policy=email.policy.default)

    subject = _decode_header_str(msg.get("subject", ""))
    sender = _decode_header_str(msg.get("from", ""))
    
    def _parse_addr_list(header_name: str) -> list[str]:
        val = msg.get(header_name, "")
        if not val:
            return []
        addrs = []
        for name, addr in email.utils.getaddresses([str(val)]):
            decoded_name = _decode_header_str(name)
            if decoded_name and addr:
                addrs.append(f"{decoded_name} <{addr}>")
            elif addr:
                addrs.append(addr)
            elif decoded_name:
                addrs.append(decoded_name)
        return addrs

    to_addrs = _parse_addr_list("to")
    cc_addrs = _parse_addr_list("cc")
    bcc_addrs = _parse_addr_list("bcc")
    
    date_str = _format_date_iso(msg.get("date"))
    message_id = str(msg.get("message-id", "")).strip() or None
    in_reply_to = str(msg.get("in-reply-to", "")).strip() or None
    
    references_raw = msg.get("references", "")
    references = [r.strip() for r in str(references_raw).split() if r.strip()]

    # Extract body
    body_text = ""
    body_part = msg.get_body(preferencelist=("plain", "html"))
    if body_part:
        content_type = body_part.get_content_type()
        try:
            content = body_part.get_content()
            if content_type == "text/html":
                body_text = html_to_plain_text(content)
            else:
                body_text = str(content)
        except Exception as exc:
            log.warning("Failed to decode email body: %s", exc)
            payload = body_part.get_payload(decode=True)
            body_text = payload.decode("utf-8", errors="replace") if payload else ""
    else:
        # Fallback manual part walk
        for part in msg.walk():
            if part.get_content_maintype() == "text":
                ctype = part.get_content_type()
                payload = part.get_payload(decode=True)
                if payload:
                    text_chunk = payload.decode("utf-8", errors="replace")
                    if ctype == "text/html" and not body_text:
                        body_text = html_to_plain_text(text_chunk)
                    elif ctype == "text/plain":
                        body_text = text_chunk
                        break

    clean_body = strip_quoted_replies(body_text)

    # Extract attachments
    attachments: list[EmailAttachment] = []
    for att in msg.iter_attachments():
        att_filename = att.get_filename() or "unnamed_attachment"
        att_content_type = att.get_content_type()
        try:
            att_bytes = att.get_content()
            if isinstance(att_bytes, str):
                att_bytes = att_bytes.encode("utf-8")
        except Exception:
            att_bytes = att.get_payload(decode=True) or b""

        if att_bytes and _accept_attachment(attachments, att_bytes):
            attachments.append(EmailAttachment(
                filename=sanitize_attachment_filename(att_filename),
                content_type=att_content_type,
                raw=att_bytes,
                size=len(att_bytes),
            ))

    # All headers dict
    headers_dict = {k: _decode_header_str(str(v)) for k, v in msg.items()}

    # 203 FIX — scrub at the ONE exit point rather than per field: a new field added later
    # is covered by construction instead of by remembering.
    return ParsedEmail(
        subject=scrub_text(subject),
        sender=scrub_text(sender),
        to=[scrub_text(a) for a in to_addrs],
        cc=[scrub_text(a) for a in cc_addrs],
        bcc=[scrub_text(a) for a in bcc_addrs],
        date=date_str,
        message_id=message_id,
        in_reply_to=in_reply_to,
        references=references,
        body=scrub_text(body_text),
        clean_body=scrub_text(clean_body),
        attachments=attachments,
        headers={k: scrub_text(v) for k, v in headers_dict.items()},
    )


def parse_msg_bytes(raw: bytes) -> ParsedEmail:
    """Parse Outlook compound binary (.msg) bytes into structured ParsedEmail."""
    import extract_msg

    msg = extract_msg.openMsg(io.BytesIO(raw))
    try:
        subject = msg.subject or ""
        sender = msg.sender or ""
        to_str = msg.to or ""
        cc_str = msg.cc or ""
        bcc_str = msg.bcc or ""
        
        to_addrs = [a.strip() for a in to_str.split(";") if a.strip()] if to_str else []
        cc_addrs = [a.strip() for a in cc_str.split(";") if a.strip()] if cc_str else []
        bcc_addrs = [a.strip() for a in bcc_str.split(";") if a.strip()] if bcc_str else []

        date_str = _format_date_iso(msg.date)
        message_id = msg.messageId or None
        in_reply_to = getattr(msg, "inReplyTo", None) or None

        body_text = msg.body or ""
        if not body_text and hasattr(msg, "htmlBody") and msg.htmlBody:
            body_text = html_to_plain_text(msg.htmlBody.decode("utf-8", errors="replace") if isinstance(msg.htmlBody, bytes) else str(msg.htmlBody))

        clean_body = strip_quoted_replies(body_text)

        attachments: list[EmailAttachment] = []
        for att in getattr(msg, "attachments", []):
            att_name = att.longFilename or att.shortFilename or "attachment"
            att_data = getattr(att, "data", None) or b""
            att_mime = getattr(att, "mimetype", "application/octet-stream") or "application/octet-stream"
            if att_data and _accept_attachment(attachments, att_data):
                attachments.append(EmailAttachment(
                    filename=sanitize_attachment_filename(att_name),
                    content_type=att_mime,
                    raw=att_data,
                    size=len(att_data),
                ))

        headers_dict = {}
        if hasattr(msg, "headerDict") and msg.headerDict:
            headers_dict = {k: str(v) for k, v in msg.headerDict.items()}

        # 203 FIX — see `scrub_text`. THIS is the parser whose real output carried the NUL.
        return ParsedEmail(
            subject=scrub_text(subject),
            sender=scrub_text(sender),
            to=[scrub_text(a) for a in to_addrs],
            cc=[scrub_text(a) for a in cc_addrs],
            bcc=[scrub_text(a) for a in bcc_addrs],
            date=date_str,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=[],
            body=scrub_text(body_text),
            clean_body=scrub_text(clean_body),
            attachments=attachments,
            headers={k: scrub_text(v) for k, v in headers_dict.items()},
        )
    finally:
        msg.close()


#: A Message-ID is chosen by whoever sent the mail, so it is attacker-LENGTH as well as
#: attacker-content (TM-240-07). Bounded at the derivation rather than at the column, because a
#: column-level truncation would silently split one conversation into two.
MAX_THREAD_KEY_CHARS = 512

#: Characters a header may legally contain but a stored key must not. ⚠ Not paranoia: during v3.7
#: UAT a NUL byte inside a `.msg` subject produced a Postgres `22P05` that 5,438 green tests missed.
_CONTROL_CHARS = "".join(chr(c) for c in range(0x20)) + chr(0x7F)


def _normalise_msgid(value: str | None) -> str | None:
    """One RFC 5322 message identifier, reduced to a comparable key.

    Angle brackets, surrounding whitespace and case are all things two clients disagree about
    while meaning the same message — so all three are normalised away. Anything left that a
    database should never see is dropped.
    """
    if not value:
        return None
    text = str(value).strip()
    # A `References` header is a LIST; the caller splits it, but a stray one arriving here should
    # not silently become a key made of several ids joined by spaces.
    text = text.split()[0] if text.split() else ""
    text = text.strip("<>").strip()
    text = text.translate({ord(c): None for c in _CONTROL_CHARS})
    text = text.lower()[:MAX_THREAD_KEY_CHARS]
    return text or None


def thread_key_for(parsed: ParsedEmail) -> str | None:
    """The conversation this message belongs to, derived from the message itself (D-3, D-240-05).

    Order: the FIRST entry of ``References`` (the thread root) -> ``In-Reply-To`` -> the message's
    own ``Message-ID`` -> ``None``.

    ── WHY THE HEADERS AND NOT THE PROVIDER'S OWN THREAD ID ────────────────────────────────────

    Gmail hands out a ``threadId`` and Microsoft Graph a ``conversationId``, and either would have
    been easier to read. Both were rejected, for one reason: **D-3 calls this a retrieval-grouping
    column, not a provider id.** A provider thread id is meaningless outside that provider and
    outside that account, so it could never group a manually uploaded ``.eml`` with its synced
    twin — and manual upload is where essentially all mail in this Library is today. Header
    derivation is also the only rule that keeps the SOURCE CONTRACT untouched: no thread id has to
    travel through ``SourceFile``, which is what lets ``sources/base.py`` close byte-identical.

    ⭐ Google's own reference argues the same way. Its ``threadId`` description states that adding
    a message to a thread requires *"the `References` and `In-Reply-To` headers … in compliance
    with RFC 2822"* — Gmail derives its thread from exactly the headers read here.

    ── THE KNOWN WEAKNESS, RECORDED RATHER THAN HIDDEN ─────────────────────────────────────────

    A client that omits ``References`` breaks the chain, and its message becomes a thread of one.
    That is a **visible** degradation — a singleton conversation a person can see and query —
    never a wrong grouping. The failure DIRECTION is what makes this acceptable: a wrong grouping
    would put one conversation's mail inside another's answer with nothing on screen saying so.
    If a real mailbox shows this biting, the provider thread id becomes a documented fallback in a
    later phase — never a silent one here.

    ⛔ **Subject is NEVER an input.** "Re: Budget" collides across unrelated conversations and
    across people.
    """
    if parsed.references:
        root = _normalise_msgid(parsed.references[0])
        if root:
            return root
    parent = _normalise_msgid(parsed.in_reply_to)
    if parent:
        return parent
    return _normalise_msgid(parsed.message_id)


def format_email_text_for_retrieval(parsed: ParsedEmail) -> str:
    """Format an email into clean, structured Markdown text for document_chunks embedding."""
    lines: list[str] = []
    lines.append(f"# Subject: {parsed.subject or '(No Subject)'}")
    if parsed.sender:
        lines.append(f"**From:** {parsed.sender}")
    if parsed.to:
        lines.append(f"**To:** {', '.join(parsed.to)}")
    if parsed.cc:
        lines.append(f"**Cc:** {', '.join(parsed.cc)}")
    if parsed.date:
        lines.append(f"**Date:** {parsed.date}")
    if parsed.attachments:
        att_names = [a.filename for a in parsed.attachments]
        lines.append(f"**Attachments:** {', '.join(att_names)}")
    lines.append("")
    lines.append(parsed.clean_body or parsed.body)
    return "\n".join(lines).strip()
