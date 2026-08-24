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

        # 3. Check for leading quote prefix '>'
        if line.strip().startswith(">"):
            # If line starts with >, stop collecting reply trail
            break

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

        if att_bytes:
            attachments.append(EmailAttachment(
                filename=att_filename,
                content_type=att_content_type,
                raw=att_bytes,
                size=len(att_bytes),
            ))

    # All headers dict
    headers_dict = {k: _decode_header_str(str(v)) for k, v in msg.items()}

    return ParsedEmail(
        subject=subject,
        sender=sender,
        to=to_addrs,
        cc=cc_addrs,
        bcc=bcc_addrs,
        date=date_str,
        message_id=message_id,
        in_reply_to=in_reply_to,
        references=references,
        body=body_text,
        clean_body=clean_body,
        attachments=attachments,
        headers=headers_dict,
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
            if att_data:
                attachments.append(EmailAttachment(
                    filename=att_name,
                    content_type=att_mime,
                    raw=att_data,
                    size=len(att_data),
                ))

        headers_dict = {}
        if hasattr(msg, "headerDict") and msg.headerDict:
            headers_dict = {k: str(v) for k, v in msg.headerDict.items()}

        return ParsedEmail(
            subject=subject,
            sender=sender,
            to=to_addrs,
            cc=cc_addrs,
            bcc=bcc_addrs,
            date=date_str,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=[],
            body=body_text,
            clean_body=clean_body,
            attachments=attachments,
            headers=headers_dict,
        )
    finally:
        msg.close()


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
