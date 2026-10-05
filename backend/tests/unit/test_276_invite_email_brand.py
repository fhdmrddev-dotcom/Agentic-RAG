"""Phase 276-07 (D-27) — the invite email carries the Syrel lockup and name, and stays escaped.

The logo is a hosted PNG (many mail clients block SVG) served from OUR primary frontend origin —
the same origin the invite link is built from, so no new env var and no third-party host
(T-276-41: no query string, no per-recipient token). WR-02 still binds: the tenant-controlled org
name and every interpolated URL are HTML-escaped (T-276-40).

The `resend` SDK is imported lazily inside `send_invite`, so a fake module in `sys.modules`
captures the payload without the real package or a network call.
"""

from __future__ import annotations

import logging
import sys
import types

import pytest

from app.config import settings
from app.services import email_provider

ORG = "Acme </a><script>"
LINK = "https://app.example.com/invite?token=abc&x=\"1\""


@pytest.fixture
def captured(monkeypatch):
    sent: list[dict] = []
    fake = types.ModuleType("resend")
    fake.api_key = None

    class _Emails:
        @staticmethod
        def send(payload):
            sent.append(payload)
            return {"id": "fake"}

    fake.Emails = _Emails
    monkeypatch.setitem(sys.modules, "resend", fake)
    monkeypatch.setattr(settings, "frontend_url", "https://app.example.com,https://other.example.com")
    return sent


def test_the_invite_shows_the_hosted_lockup_from_the_primary_origin(captured):
    email_provider.ResendProvider().send_invite("p@example.com", LINK, ORG)

    assert len(captured) == 1
    body = captured[0]["html"]
    assert '<img src="https://app.example.com/brand/syrel-lockup-email.png"' in body
    assert 'alt="Syrel"' in body
    assert 'width="160"' in body and 'height="80"' in body
    # the second origin is a CORS alternate, never the image host
    assert "other.example.com" not in body


def test_the_invite_names_syrel_and_keeps_every_value_escaped(captured):
    email_provider.ResendProvider().send_invite("p@example.com", LINK, ORG)

    payload = captured[0]
    body = payload["html"]
    assert "Syrel" in body.replace('alt="Syrel"', "")  # the word, not only the alt text
    assert "Acme &lt;/a&gt;&lt;script&gt;" in body
    assert "<script>" not in body
    # the link stays the escaped invite link
    assert 'href="https://app.example.com/invite?token=abc&amp;x=&quot;1&quot;"' in body
    # subject is plain text: it names Syrel and is not entity-escaped
    assert "Syrel" in payload["subject"]
    assert ORG in payload["subject"]


def test_the_none_provider_is_unchanged(captured, caplog):
    with caplog.at_level(logging.INFO, logger="app.services.email_provider"):
        email_provider.NoneLogProvider().send_invite("p@example.com", LINK, "Acme")

    assert captured == []
    assert LINK in caplog.text
