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
