"""Phase 276-07 (D-27) — the invite email carries the Syrel lockup and name, and stays escaped.

The logo is a hosted PNG (many mail clients block SVG) served from OUR primary frontend origin —
the same origin the invite link is built from, so no new env var and no third-party host
(T-276-41: no query string, no per-recipient token). WR-02 still binds: the tenant-controlled org
name and every interpolated URL are HTML-escaped (T-276-40).

⚠ RE-POINTED AT PHASE 300-03 (D-34) — NOT DELETED. Until 300 this suite planted a fake
``resend`` module in ``sys.modules`` and called ``ResendProvider().send_invite``. That fixture
is exactly why the defect it should have caught stayed invisible: the real ``resend`` package
was never installed in the built image, so the shipped lazy ``import resend`` could not send one
invitation email in production — and the fake made every assertion here pass regardless. D-21
replaced the SDK with Resend's REST API over ``httpx``, so each ORIGINAL assertion below is kept
and now reads the captured HTTP request body (``httpx.MockTransport`` through the mailer's
``_http_client`` seam). ``ENVIRONMENT=production`` is set because the D-10 dev guard holds back
every email outside production when no test address is configured.
"""

from __future__ import annotations

import json
import logging

import httpx
import pytest

from app.config import settings
from app.services import email_provider

from tests.unit.decision_engine_fakes import install

ORG = "Acme </a><script>"
LINK = "https://app.example.com/invite?token=abc&x=\"1\""


@pytest.fixture
def captured(monkeypatch):
    sent: list[dict] = []

    def handle(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content.decode("utf-8")))
        return httpx.Response(200, json={"id": "fake"})

    install(monkeypatch, email_provider, handle)
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "email_provider", "resend")
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "invite_from_email", "invites@example.com")
    monkeypatch.setattr(settings, "frontend_url", "https://app.example.com,https://other.example.com")
    return sent


def test_the_invite_shows_the_hosted_lockup_from_the_primary_origin(captured):
    outcome = email_provider.send_invite("p@example.com", LINK, ORG)

    assert outcome.status == "sent"
    assert len(captured) == 1
    body = captured[0]["html"]
    assert '<img src="https://app.example.com/brand/syrel-lockup-email.png"' in body
    assert 'alt="Syrel"' in body
    assert 'width="160"' in body and 'height="80"' in body
    # the second origin is a CORS alternate, never the image host
    assert "other.example.com" not in body


def test_the_invite_names_syrel_and_keeps_every_value_escaped(captured):
    email_provider.send_invite("p@example.com", LINK, ORG)

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
    assert payload["subject"] == f"You're invited to {ORG} on Syrel"
    # 300 (UI-D4): every app email carries a plain-text alternative
    assert payload["text"] == (
        f"You have been invited to join {ORG} on Syrel.\n\n"
        f"Accept your invitation:\n{LINK}"
    )


def test_the_none_provider_is_unchanged(captured, monkeypatch, caplog):
    monkeypatch.setattr(settings, "email_provider", "none")
    with caplog.at_level(logging.INFO, logger="app.services.email_provider"):
        outcome = email_provider.send_invite("p@example.com", LINK, "Acme")

    assert captured == []
    assert outcome.status == "suppressed"
    assert LINK in caplog.text
