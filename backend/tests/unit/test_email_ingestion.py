"""
Unit tests for Phase 203: Outlook (.msg) and Email (.eml) Ingestion Pipeline (EML-01, EML-02).
"""
import io
from email.message import EmailMessage
from unittest.mock import MagicMock, patch
import pytest

from app.services.email_extraction_service import (
    parse_eml_bytes,
    parse_msg_bytes,
    strip_quoted_replies,
    format_email_text_for_retrieval,
    html_to_plain_text,
    ParsedEmail,
    EmailAttachment,
)


def _build_sample_eml(
    subject: str = "Quarterly Business Review",
    sender: str = "Alice Smith <alice@example.com>",
    to: str = "Bob Jones <bob@example.com>",
    cc: str = "Carol Danvers <carol@example.com>",
    date: str = "Mon, 15 Jan 2024 10:00:00 +0000",
    body: str = "Hello Bob,\n\nPlease find the review details attached.\n\nBest,\nAlice",
    attachment_name: str | None = None,
    attachment_data: bytes | None = None,
    html_body: str | None = None,
) -> bytes:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    msg["Date"] = date
    msg["Message-ID"] = "<msg-12345@example.com>"

    if html_body and not attachment_name:
        msg.set_content(html_body, subtype="html")
    else:
        msg.set_content(body)

    if attachment_name and attachment_data:
        msg.add_attachment(
            attachment_data,
            maintype="application",
            subtype="octet-stream",
            filename=attachment_name,
        )

    return msg.as_bytes()


def test_parse_eml_basic():
    """EML bytes with standard headers → ParsedEmail has correct subject, sender, recipients, and date."""
    raw = _build_sample_eml(
        subject="Project Alpha Launch",
        sender="Lead Dev <dev@company.com>",
        to="Team <team@company.com>",
        cc="Manager <mgr@company.com>",
        body="We are launching tomorrow at 9 AM UTC.",
    )
    parsed = parse_eml_bytes(raw)
    assert parsed.subject == "Project Alpha Launch"
    assert "dev@company.com" in parsed.sender
    assert len(parsed.to) == 1
    assert "team@company.com" in parsed.to[0]
    assert len(parsed.cc) == 1
    assert "mgr@company.com" in parsed.cc[0]
    assert "We are launching tomorrow at 9 AM UTC." in parsed.body
    assert "We are launching tomorrow at 9 AM UTC." in parsed.clean_body
    assert parsed.message_id == "<msg-12345@example.com>"


def test_parse_eml_html_body_fallback():
    """EML with HTML body only → stripped to clean plain text."""
    html_content = "<p>Hello <b>World</b>!</p><br/><p>Important meeting at <i>3 PM</i>.</p>"
    raw = _build_sample_eml(
        subject="HTML Notification",
        html_body=html_content,
    )
    parsed = parse_eml_bytes(raw)
    assert "Hello World!" in parsed.body
    assert "Important meeting at 3 PM." in parsed.body


def test_parse_eml_with_attachment():
    """EML with binary attachment → extracted into attachments list."""
    csv_payload = b"id,name,score\n1,Alpha,95\n2,Beta,88"
    raw = _build_sample_eml(
        attachment_name="scores.csv",
        attachment_data=csv_payload,
    )
    parsed = parse_eml_bytes(raw)
    assert len(parsed.attachments) == 1
    att = parsed.attachments[0]
    assert att.filename == "scores.csv"
    assert att.raw == csv_payload
    assert att.size == len(csv_payload)


def test_strip_quoted_replies_on_wrote_pattern():
    """Quoted reply starting with 'On ... wrote:' is stripped from clean_body."""
    thread = """Thanks for the update, will check it out.

On Mon, Jan 15, 2024 at 10:00 AM Alice Smith <alice@example.com> wrote:
> Hi team,
> Here is the initial draft of the proposal.
> Please review by Friday.
"""
    cleaned = strip_quoted_replies(thread)
    assert cleaned == "Thanks for the update, will check it out."
    assert "Here is the initial draft" not in cleaned


def test_strip_quoted_replies_outlook_header():
    """Outlook forwarded/reply header ('-----Original Message-----' or 'From: ... \n Sent: ...') is stripped."""
    thread = """Approved. Proceed with rollout.

-----Original Message-----
From: John Doe <john@example.com>
Sent: Tuesday, January 16, 2024 2:30 PM
To: Alice Smith <alice@example.com>
Subject: Request for Approval

Can we proceed with the v3.8 deployment?
"""
    cleaned = strip_quoted_replies(thread)
    assert cleaned == "Approved. Proceed with rollout."
    assert "Request for Approval" not in cleaned


def test_strip_quoted_replies_leading_greater_than():
    """Blocks starting with '>' quote prefixes are stripped."""
    text = """Yes, that looks correct.

> What do you think about the proposed timeline?
> Are we on track for Q3?
"""
    cleaned = strip_quoted_replies(text)
    assert cleaned == "Yes, that looks correct."
    assert "proposed timeline" not in cleaned


def test_format_email_text_for_retrieval():
    """format_email_text_for_retrieval generates clean Markdown with headers and body."""
    parsed = ParsedEmail(
        subject="Budget Review 2026",
        sender="Finance <fin@corp.com>",
        to=["Executive Team <exec@corp.com>"],
        cc=["Accounting <acc@corp.com>"],
        date="2026-01-10T12:00:00Z",
        body="Raw body text",
        clean_body="Approved Q1 capital allocation of $500,000.",
        attachments=[EmailAttachment("budget.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"", 0)],
    )
    formatted = format_email_text_for_retrieval(parsed)
    assert "# Subject: Budget Review 2026" in formatted
    assert "**From:** Finance <fin@corp.com>" in formatted
    assert "**To:** Executive Team <exec@corp.com>" in formatted
    assert "**Attachments:** budget.xlsx" in formatted
    assert "Approved Q1 capital allocation of $500,000." in formatted


def test_extract_text_email_mime_routing():
    """extract_text routes RFC-822 and Outlook MIME types through email parser."""
    from app.api.documents import extract_text

    raw_eml = _build_sample_eml(
        subject="Security Advisory",
        body="Please rotate your API tokens immediately.",
    )
    text = extract_text(raw_eml, "message/rfc822")
    assert "# Subject: Security Advisory" in text
    assert "Please rotate your API tokens immediately." in text


def test_parse_msg_via_mock():
    """parse_msg_bytes extracts subject, sender, recipients, and attachments from extract_msg.Message."""
    mock_msg = MagicMock()
    mock_msg.subject = "Outlook Meeting Invite"
    mock_msg.sender = "Planner <planner@office.com>"
    mock_msg.to = "Team <team@office.com>"
    mock_msg.cc = ""
    mock_msg.bcc = ""
    mock_msg.date = "2026-02-01T09:00:00"
    mock_msg.messageId = "<msg-outlook-999>"
    mock_msg.inReplyTo = None
    mock_msg.body = "Please attend the sprint retrospective on Monday."
    mock_msg.attachments = []
    mock_msg.headerDict = {"Subject": "Outlook Meeting Invite"}

    with patch("extract_msg.openMsg", return_value=mock_msg):
        parsed = parse_msg_bytes(b"fake_msg_bytes")
        assert parsed.subject == "Outlook Meeting Invite"
        assert parsed.sender == "Planner <planner@office.com>"
        assert parsed.message_id == "<msg-outlook-999>"
        assert "retrospective on Monday" in parsed.clean_body


def test_ingest_email_populates_metadata_and_attachments():
    """ingest_document with message/rfc822 extracts headers into metadata_dict and links attachments."""
    from app.api.documents import ingest_document

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.update.return_value = mock_builder
    mock_builder.select.return_value = mock_builder
    mock_builder.eq.return_value = mock_builder
    mock_builder.maybe_single.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[], count=1)

    raw_eml = _build_sample_eml(
        subject="Client Deliverable Signed",
        sender="Legal <legal@corp.com>",
        to="Account Mgr <am@corp.com>",
        body="Agreement has been executed.",
        attachment_name="contract.csv",
        attachment_data=b"col1,col2\nv1,v2",
    )

    with patch("app.api.documents.chunk_text", return_value=["Agreement has been executed."]), \
         patch("app.services.embedding_service.embed_texts", return_value=[[0.1] * 1536]):
        ingest_document(
            document_id="email-doc-001",
            text="# Subject: Client Deliverable Signed\nAgreement has been executed.",
            user_id="user-001",
            supabase=mock_supabase,
            raw=raw_eml,
            mime_type="message/rfc822",
            filename="signed_email.eml",
        )

    # Check documents UPDATE was called with metadata containing email headers
    update_calls = [c[0][0] for c in mock_builder.update.call_args_list if isinstance(c[0][0], dict) and "metadata" in c[0][0]]
    assert len(update_calls) > 0
    final_meta = update_calls[-1]["metadata"]
    assert final_meta["title"] == "Client Deliverable Signed"
    assert "Legal <legal@corp.com>" in final_meta["author"]
    assert final_meta["document_type"] == "email"
    assert final_meta["email_from"] == "Legal <legal@corp.com>"
    assert final_meta["email_message_id"] == "<msg-12345@example.com>"

    # Check document_relationships was called for contract.csv attachment
    mock_supabase.table.assert_any_call("document_relationships")


# ─────────────────────────────────────────────────────────────────────────────────────
# 203 HARDENING — the mitigations Phase 203's own <threat_model> NAMED and the first
# pass did not implement. Each test below fails against the shipped code at 725a2b5c.
#
# ⚠ WHY THESE EXIST AT ALL, because it is the transferable part: the plan wrote
#   "sanitize attachment filenames, and enforce max size constraints" into its threat
#   model, every task passed, 56 tests were green, and NOTHING checked that the stated
#   mitigation was discharged. A threat model is a claim, and a claim needs a test.
# ─────────────────────────────────────────────────────────────────────────────────────
import pytest

from app.services.email_extraction_service import (
    MAX_ATTACHMENTS_PER_EMAIL,
    MAX_ATTACHMENT_BYTES,
    EmailAttachment,
    _accept_attachment,
    sanitize_attachment_filename,
    strip_quoted_replies,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("../../evil.pdf", "evil.pdf"),
        ("..\\..\\evil.pdf", "evil.pdf"),
        ("/etc/passwd", "passwd"),
        ("C:\\Windows\\system32\\cmd.exe", "cmd.exe"),
        ("report.pdf", "report.pdf"),
        ("", "attachment"),
        (None, "attachment"),
        ("...", "attachment"),
        ("   ", "attachment"),
    ],
)
def test_sanitize_attachment_filename_never_emits_a_path(raw, expected):
    """The name is attacker-controlled and was interpolated straight into the storage key
    ``f"{user_id}/{doc_id}/{filename}"``. It must reduce to a leaf, on BOTH separators."""
    out = sanitize_attachment_filename(raw)
    assert out == expected
    assert "/" not in out and "\\" not in out
    assert out != ""


def test_sanitize_attachment_filename_bounds_length_but_keeps_the_extension():
    """⚠ The extension is what `_EXT_MIME_OVERRIDES` routes on downstream, so a truncation
    that ate it would silently change the attachment's MIME verdict."""
    out = sanitize_attachment_filename("a" * 300 + ".pdf")
    assert len(out) <= 120
    assert out.endswith(".pdf"), out


def test_sanitize_attachment_filename_drops_control_characters():
    assert "\0" not in sanitize_attachment_filename("x\0y.txt")


def test_attachment_count_is_capped():
    """THE COUNT IS THE REAL AMPLIFICATION, not the per-part size: one 50 MB email can carry
    tens of thousands of 1 KB parts, and each became a documents row + a storage object +
    an ingestion job."""
    full = [EmailAttachment("a.txt", "text/plain", b"x", 1)] * MAX_ATTACHMENTS_PER_EMAIL
    assert _accept_attachment(full, b"x") is False
    assert _accept_attachment(full[:-1], b"x") is True


def test_oversized_attachment_is_refused():
    assert _accept_attachment([], b"x" * (MAX_ATTACHMENT_BYTES + 1)) is False
    assert _accept_attachment([], b"x" * 16) is True


def test_a_quote_in_the_middle_of_live_prose_does_not_truncate_the_email():
    """⚠ THE REGRESSION THIS PINS: the rule was `break`, so ONE quoted line anywhere — a
    markdown blockquote, a pasted diff, a single quoted sentence — discarded EVERYTHING
    after it."""
    out = strip_quoted_replies("Hello\n> quoted mid-body\nStill mine.")
    assert "Still mine." in out, out
    assert "quoted mid-body" not in out


def test_a_leading_quote_no_longer_returns_the_whole_unstripped_body():
    """The same `break` interacted with the empty-result fallback: when the FIRST line was
    quoted, nothing was collected and the function returned the ENTIRE original text. So
    one rule both over-stripped and under-stripped, depending only on where the quote sat."""
    out = strip_quoted_replies("> leading quote\nreal content")
    assert out == "real content", out


def test_the_reply_trail_is_still_stripped():
    """POSITIVE CONTROL — the fix above must not have turned the de-poisoning off."""
    assert strip_quoted_replies("Body here\n-----Original Message-----\nold stuff") == "Body here"
    assert strip_quoted_replies("Mine\n> old line one\n> old line two") == "Mine"


# -------------------------------------------------------------------------------------
# A REAL .msg FAILED INGESTION IN THE APP. Not a hypothetical.
#   Postgres refused the document at the embedding step with SQLSTATE 22P05,
#   "unsupported Unicode escape sequence -- NUL cannot be converted to text".
#   Measured on the offending file: the NUL was in the SUBJECT (1 occurrence), NOT in the
#   body and NOT in any of its 19 headers. extract-msg reads NUL-terminated MAPI properties
#   out of an OLE compound file and the terminator rides along into the decoded string.
#   Postgres refuses NUL in `text` at any depth -- no cast or encoding stores it -- so it
#   has to be removed where the value is produced.
#
# NOTE ON THIS FILE: an earlier draft of these tests wrote LITERAL NUL bytes into the
# source and pytest refused to collect it ("source code string cannot contain null
# bytes"). Every NUL below is an ESCAPE SEQUENCE, never a raw byte.
# -------------------------------------------------------------------------------------
from app.services.email_extraction_service import scrub_text


def test_scrub_text_removes_nul_the_character_that_broke_ingestion():
    assert scrub_text("An update\x00") == "An update"
    assert scrub_text("a\x00b\x00c") == "abc"
    assert "\x00" not in scrub_text("a\x00b")


def test_scrub_text_keeps_the_whitespace_that_carries_meaning():
    """A blanket control-character strip would flatten every email body into one line."""
    body = "Dear Sara,\n\n\tRegards,\r\nAhmed"
    assert scrub_text(body) == body


def test_scrub_text_removes_other_control_characters_but_not_ordinary_text():
    assert scrub_text("bell\x07 del\x7f vt\x0b") == "bell del vt"
    assert scrub_text("Rapport trimestriel — Q3 · 2026") == "Rapport trimestriel — Q3 · 2026"
    assert scrub_text("ورقة1") == "ورقة1"


def test_scrub_text_never_returns_none():
    assert scrub_text(None) == ""
    assert scrub_text("") == ""


def test_a_parsed_subject_carrying_nul_cannot_reach_the_database():
    """END-TO-END on the shape that failed: the NUL must be gone from the retrieval text,
    which is what is handed to chunking and then to Postgres."""
    from app.services.email_extraction_service import (
        format_email_text_for_retrieval,
        parse_eml_bytes,
    )

    src = (
        b"From: a@x.com\r\nTo: b@x.com\r\n"
        b"Subject: An update\x00 on your application\r\n"
        b"\r\nBody line one.\r\nBody line two.\r\n"
    )
    parsed = parse_eml_bytes(src)
    text = format_email_text_for_retrieval(parsed)

    assert "\x00" not in parsed.subject
    assert "\x00" not in text
    # POSITIVE CONTROL -- the subject survived; only the NUL left.
    assert "An update on your application" in parsed.subject
    assert "Body line one." in text
