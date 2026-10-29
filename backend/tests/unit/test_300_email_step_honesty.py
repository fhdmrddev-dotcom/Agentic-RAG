"""Phase 300-03 (D-23 / D-24 / D-32; BUG-260828-05, BUG-260828-06) — the workflow email step.

BUG-260828-05: the step's receipt named the mail HOST ("Destination: smtp.gmail.com") and never
who the email went to — the one thing the person reading the receipt wanted to know. D-23 (an
operator decision overruling 190's D-08 half) names the recipient for ``send_email`` only, and
UI-D14 says "the mail server accepted it": an SMTP 250 proves the server took the message, not
that the person received it. Every other capability's receipt is byte-identical to before.

BUG-260828-06: the agent writes markdown, and the step sent it as a flat text part, so the
recipient read literal ``##`` and ``**``. D-24 renders it: a text part with the markers removed
and the line breaks kept, plus an HTML alternative from ``markdown-it-py``'s ``js-default`` preset
with ``html=False`` (D-32) — never ``commonmark``, which passes ``<script>`` through.
"""
from __future__ import annotations

import re
from email import message_from_bytes
from types import SimpleNamespace

import pytest

from app.services.connectors import smtp_adapter
from app.services.harness.phase_types import _external_action_sent_body

SMTP_CONFIG = {
    "host": "smtp.gmail.com",
    "port": 465,
    "from_address": "workflows@example.com",
    "username": "workflows@example.com",
    "tls": "implicit",
}
PASSWORD = "smtp-PASSWORD-MARKER-300"
ALLOWED_TAGS = {"p", "br", "strong", "em", "h1", "h2", "h3", "ul", "ol", "li", "blockquote",
                "code", "pre", "a", "div"}


# ── S7a · the receipt ──────────────────────────────────────────────────────────────────

def test_the_send_email_receipt_names_the_recipient_and_the_mail_server():
    result = SimpleNamespace(provider_message="", detail="accepted for delivery by smtp.gmail.com")
    body = _external_action_sent_body(
        "send_email", {"to": "sarah@acme.com", "subject": "Q3"}, result, "smtp.gmail.com"
    )
    assert body.splitlines() == [
        "Sent. Sends an email — the mail server accepted it.",
        "",
        "What this step did",
        "  Action     : Sends an email",
        "  Destination: sarah@acme.com (via smtp.gmail.com)",
        "  to         : sarah@acme.com",
        "  subject    : Q3",
        "",
        "accepted for delivery by smtp.gmail.com",
    ]
    assert "destination accepted it" not in body
    assert PASSWORD not in body and "password" not in body.lower()


def test_a_list_of_recipients_is_comma_joined_in_order():
    result = SimpleNamespace(provider_message="", detail="")
    body = _external_action_sent_body(
        "send_email", {"to": ["a@x.example", "b@x.example"]}, result, "smtp.x.example"
    )
    assert "  Destination: a@x.example, b@x.example (via smtp.x.example)" in body.splitlines()


def test_every_other_capability_keeps_its_receipt_byte_identical():
    result = SimpleNamespace(provider_message="ok", detail="")
    body = _external_action_sent_body("post_message", {"channel": "#ops"}, result, "slack.com")
    # The pre-300 output for this input, written out verbatim.
    assert body == (
        "Sent. Posts a message — the destination accepted it.\n"
        "\n"
        "What this step did\n"
        "  Action     : Posts a message\n"
        "  Destination: slack.com\n"
        "  channel    : #ops\n"
        "\n"
        "ok"
    )
    ticket = _external_action_sent_body("create_ticket", {"to": "x@y.example"}, result, "jira.example")
    assert "  Destination: jira.example" in ticket.splitlines()
    assert "(via" not in ticket


# ── S7b · the message ──────────────────────────────────────────────────────────────────

class _Credential:
    @property
    def secret(self) -> str:
        return PASSWORD


class _Session:
    def __init__(self):
        self.sent = []

    def login(self, user, password):
        return (235, b"ok")

    def send_message(self, msg, from_addr=None, to_addrs=None):
        self.sent.append(msg)
        return {}

    def quit(self):
        return (221, b"bye")


async def _send(monkeypatch, body: str):
    session = _Session()

    async def _open(capability, host, port=None, **kwargs):
        return session

    monkeypatch.setattr(smtp_adapter, "open_pinned_smtp", _open)
    await smtp_adapter.Adapter().send(
        args={"to": "sarah@acme.com", "subject": "Findings", "body": body},
        credential=_Credential(), config=dict(SMTP_CONFIG),
    )
    (message,) = session.sent
    parsed = message_from_bytes(message.as_bytes())
    assert parsed.get_content_type() == "multipart/alternative"
    text_part, html_part = parsed.get_payload()
    assert text_part.get_content_type() == "text/plain"
    assert html_part.get_content_type() == "text/html"
    text = text_part.get_payload(decode=True).decode(text_part.get_content_charset() or "utf-8")
    html = html_part.get_payload(decode=True).decode(html_part.get_content_charset() or "utf-8")
    return text.replace("\r\n", "\n"), html.replace("\r\n", "\n")


def _tags(html: str) -> set[str]:
    return {m.group(1).lower() for m in re.finditer(r"</?([A-Za-z][A-Za-z0-9]*)", html)}


MARKDOWN = "## Findings\n\n**Bold** and _em_\n- one\n- two\nline a\nline b"


async def test_markdown_becomes_html_and_a_line_preserving_text_part(monkeypatch):
    text, html = await _send(monkeypatch, MARKDOWN)

    assert "<h2>" in html and "<strong>" in html and "<em>" in html
    assert "<ul>" in html and "<li>" in html
    assert "line a<br" in html
    assert "##" not in text and "**" not in text
    assert "line a\nline b" in text
    lines = text.rstrip("\n").split("\n")
    assert "- one" in lines and any(l.startswith("- two") for l in lines)
    assert lines[0] == "Findings" and lines[1] == ""      # one blank line between blocks
    assert "\n\n\n" not in text


async def test_the_html_wrapper_is_plain_with_no_syrel_chrome(monkeypatch):
    _, html = await _send(monkeypatch, "hello")
    assert html.startswith("<div ")
    for needle in ("max-width:640px", "padding:24px", "font-size:16px", "line-height:1.5", "#0F172A"):
        assert needle in html
    assert "Syrel" not in html and "<img" not in html and "border-top" not in html


@pytest.mark.parametrize("body, absent", [
    ("<script>alert(1)</script>", "<script"),
    ("[x](javascript:alert(1))", 'href="javascript:'),
    ("![i](http://x/y.png)", "<img"),
    ("|a|b|\n|-|-|\n|1|2|", "<table"),
    ("one\n\n---\n\ntwo", "<hr"),
    ("~~strike~~", "<s>"),
    ("#### h4", "<h4"),
])
async def test_unsafe_or_out_of_scope_markdown_never_renders(monkeypatch, body, absent):
    _, html = await _send(monkeypatch, body)
    assert absent not in html
    assert _tags(html) <= ALLOWED_TAGS, _tags(html) - ALLOWED_TAGS


async def test_script_is_escaped_text(monkeypatch):
    _, html = await _send(monkeypatch, "<script>alert(1)</script>")
    assert "&lt;script&gt;" in html


async def test_a_link_keeps_only_http_https_mailto(monkeypatch):
    _, html = await _send(monkeypatch, "[a](https://ok.example) [b](/relative) [c](mailto:x@y.example)")
    hrefs = re.findall(r'href="([^"]*)"', html)
    assert hrefs == ["https://ok.example", "mailto:x@y.example"]


async def test_h4_is_capped_at_h3(monkeypatch):
    _, html = await _send(monkeypatch, "#### h4")
    assert "<h3>h4</h3>" in html


async def test_a_link_in_the_text_part_reads_text_then_url(monkeypatch):
    text, _ = await _send(monkeypatch, "See [the report](https://r.example/1).")
    assert "See the report (https://r.example/1)." in text


def test_the_renderer_is_js_default_never_commonmark():
    source = open(smtp_adapter.__file__, encoding="utf-8").read()
    assert 'MarkdownIt("js-default"' in source
    assert '"commonmark"' not in source
