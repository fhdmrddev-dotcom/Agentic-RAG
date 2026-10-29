"""Phase 300-03 (D-21, D-10, D-08, D-28) — ONE app mailer that works from a built image.

``send_email(msg, *, idempotency_key) -> SendOutcome`` has three providers and never raises:

* ``none``   — nothing leaves the process; the outcome is ``suppressed``.
* ``resend`` — REST over ``httpx`` (the ``resend`` SDK was never installed in the image, so the
  shipped lazy ``import resend`` could not send from a built image at all).
* ``smtp``   — stdlib ``smtplib`` against the operator's relay (env ``SMTP_*``).

Outside production every send is redirected to the Settings test address with a ``[Test] ``
subject prefix, or held back (``suppressed``) when there is no test address (D-10).

No network: Resend goes through ``httpx.MockTransport`` (the ``_http_client`` seam), SMTP through
a fake ``smtplib.SMTP`` / ``SMTP_SSL`` class. No test sends a real email.
"""
from __future__ import annotations

import json
import logging
import smtplib
from email import message_from_bytes
from email.utils import formataddr
from types import SimpleNamespace

import httpx
import pytest

from app.config import settings
from app.models import user_settings as us
from app.services import email_provider as ep

from tests.unit.decision_engine_fakes import install

API_KEY = "re_SECRET_MARKER_key_123"
SMTP_PASSWORD = "SMTP_PASSWORD_MARKER_xyz"
REAL_TO = "sarah@acme.example"
TEST_TO = "dev-inbox@example.com"


def _msg(**over) -> ep.OutboundEmail:
    base = dict(to=REAL_TO, subject="Report is waiting on you", text="plain body", html="<p>html body</p>")
    base.update(over)
    return ep.OutboundEmail(**base)


def _app(**over):
    base = dict(email_from_address="notify@notify.example.com", email_from_name="Syrel",
                email_dev_redirect_address="")
    base.update(over)
    return SimpleNamespace(**base)


@pytest.fixture
def env(monkeypatch):
    """Production, Resend, a key and a sender — each test narrows from here."""
    state = {"app": _app()}
    monkeypatch.setattr(settings, "email_provider", "resend")
    monkeypatch.setattr(settings, "resend_api_key", API_KEY)
    monkeypatch.setattr(settings, "invite_from_email", "")
    monkeypatch.setattr(settings, "smtp_host", "smtp.relay.example", raising=False)
    monkeypatch.setattr(settings, "smtp_port", 587, raising=False)
    monkeypatch.setattr(settings, "smtp_username", "", raising=False)
    monkeypatch.setattr(settings, "smtp_password", SMTP_PASSWORD, raising=False)
    monkeypatch.setattr(settings, "smtp_security", "starttls", raising=False)
    monkeypatch.setattr(ep, "is_production_environment", lambda: True)
    monkeypatch.setattr(ep, "load_app_settings", lambda: state["app"])
    return state


class _Rec:
    def __init__(self):
        self.requests: list[httpx.Request] = []

    def body(self, i=0) -> dict:
        return json.loads(self.requests[i].content.decode("utf-8"))


def _resend(monkeypatch, response=None, *, raise_exc=None):
    rec = _Rec()

    def handle(request: httpx.Request) -> httpx.Response:
        rec.requests.append(request)
        if raise_exc is not None:
            raise raise_exc(f"boom {API_KEY} {REAL_TO}", request=request)
        return response if response is not None else httpx.Response(200, json={"id": "x"})

    install(monkeypatch, ep, handle)
    return rec


def _forbid_network(monkeypatch):
    def _no_client(*a, **k):
        raise AssertionError("the mailer opened an HTTP client")

    class _NoSmtp:
        def __init__(self, *a, **k):
            raise AssertionError("the mailer opened an SMTP socket")

    monkeypatch.setattr(ep, "_http_client", _no_client)
    monkeypatch.setattr(smtplib, "SMTP", _NoSmtp)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _NoSmtp)


# ── configured_provider ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw, want", [
    ("resend", "resend"), (" RESEND ", "resend"), ("smtp", "smtp"), ("SMTP", "smtp"),
    ("none", "none"), ("", "none"), ("sendgrid", "none"), (None, "none"),
])
def test_configured_provider_reads_the_env_and_falls_back_to_none(monkeypatch, raw, want):
    monkeypatch.setattr(settings, "email_provider", raw)
    assert ep.configured_provider() == want


# ── none ───────────────────────────────────────────────────────────────────────────────

def test_the_none_provider_suppresses_and_opens_nothing(env, monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "none")
    _forbid_network(monkeypatch)

    out = ep.send_email(_msg())

    assert out.status == "suppressed"
    assert out.provider == "none"
    assert out.reason == "Email is not set up on this server."


# ── dev guard (D-10) ───────────────────────────────────────────────────────────────────

def test_outside_production_with_no_test_address_nothing_is_sent(env, monkeypatch):
    monkeypatch.setattr(ep, "is_production_environment", lambda: False)
    _forbid_network(monkeypatch)

    out = ep.send_email(_msg())

    assert out.status == "suppressed"
    assert "outside production" in out.reason.lower()
    assert "test address" in out.reason.lower()


def test_outside_production_the_test_address_receives_a_test_subject(env, monkeypatch):
    monkeypatch.setattr(ep, "is_production_environment", lambda: False)
    env["app"] = _app(email_dev_redirect_address=TEST_TO)
    rec = _resend(monkeypatch)

    out = ep.send_email(_msg())

    assert out.status == "sent"
    body = rec.body()
    assert body["to"] == [TEST_TO]
    assert body["subject"] == "[Test] Report is waiting on you"
    assert body["text"] == "plain body" and body["html"] == "<p>html body</p>"
    assert REAL_TO not in rec.requests[0].content.decode()


def test_production_ignores_the_test_address(env, monkeypatch):
    env["app"] = _app(email_dev_redirect_address=TEST_TO)
    rec = _resend(monkeypatch)

    ep.send_email(_msg())

    body = rec.body()
    assert body["to"] == [REAL_TO]
    assert body["subject"] == "Report is waiting on you"


# ── Resend over REST ───────────────────────────────────────────────────────────────────

def test_resend_request_shape(env, monkeypatch):
    rec = _resend(monkeypatch)

    out = ep.send_email(_msg(), idempotency_key="notice-1")

    assert out == ep.SendOutcome(status="sent", provider="resend", provider_id="x")
    req = rec.requests[0]
    assert str(req.url) == ep.RESEND_EMAILS_URL == "https://api.resend.com/emails"
    assert req.method == "POST"
    assert req.headers["Authorization"] == f"Bearer {API_KEY}"
    assert req.headers["User-Agent"] == "Syrel-mailer/1"
    assert req.headers["Content-Type"].startswith("application/json")
    assert req.headers["Idempotency-Key"] == "notice-1"
    body = rec.body()
    assert body == {
        "from": "Syrel <notify@notify.example.com>",
        "to": [REAL_TO],
        "subject": "Report is waiting on you",
        "html": "<p>html body</p>",
        "text": "plain body",
    }
    assert "reply_to" not in body


def test_resend_without_an_idempotency_key_sends_no_header(env, monkeypatch):
    rec = _resend(monkeypatch)
    ep.send_email(_msg())
    assert "Idempotency-Key" not in rec.requests[0].headers


def test_resend_without_a_key_fails_without_a_request(env, monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "")
    _forbid_network(monkeypatch)
    out = ep.send_email(_msg())
    assert out.status == "failed" and out.retryable is False


@pytest.mark.parametrize("status, payload, retryable", [
    (429, {"name": "rate_limit_exceeded"}, True),
    (500, {"name": "internal_server_error"}, True),
    (503, None, True),
    (409, {"name": "concurrent_idempotent_requests"}, True),
    (400, {"name": "validation_error"}, False),
    (401, {"name": "missing_api_key"}, False),
    (403, {"name": "invalid_api_key"}, False),
    (422, {"name": "invalid_from_address"}, False),
    (409, {"name": "invalid_idempotent_request"}, False),
])
def test_resend_error_classification(env, monkeypatch, caplog, status, payload, retryable):
    if payload is None:
        response = httpx.Response(status, content=f"<html>{API_KEY} {REAL_TO}</html>".encode())
    else:
        response = httpx.Response(status, json={**payload, "message": f"{API_KEY} {REAL_TO}"})
    _resend(monkeypatch, response)

    with caplog.at_level(logging.DEBUG):
        out = ep.send_email(_msg())

    assert out.status == "failed"
    assert out.retryable is retryable
    assert out.provider == "resend"
    assert out.reason and len(out.reason) <= 120
    for secret in (API_KEY, REAL_TO):
        assert secret not in out.reason
        assert secret not in caplog.text


@pytest.mark.parametrize("exc", [httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError])
def test_resend_network_failures_are_retryable(env, monkeypatch, caplog, exc):
    _resend(monkeypatch, raise_exc=exc)
    with caplog.at_level(logging.DEBUG):
        out = ep.send_email(_msg())
    assert out.status == "failed" and out.retryable is True
    assert API_KEY not in out.reason and REAL_TO not in out.reason
    assert API_KEY not in caplog.text and REAL_TO not in caplog.text


def test_resend_non_json_success_never_raises(env, monkeypatch):
    _resend(monkeypatch, httpx.Response(200, content=b"not json"))
    out = ep.send_email(_msg())
    assert out.status == "sent" and out.provider_id is None


# ── SMTP ───────────────────────────────────────────────────────────────────────────────

class _FakeSmtp:
    instances: list["_FakeSmtp"] = []
    ssl = False
    fail_on: str | None = None   # "login" | "send" | "connect" | "disconnect" | "timeout"
    refused: dict = {}

    def __init__(self, host, port, timeout=None, **kwargs):
        self.host, self.port, self.timeout, self.kwargs = host, port, timeout, kwargs
        self.calls: list[str] = []
        self.sent: list = []
        type(self).instances.append(self)
        if type(self).fail_on == "connect":
            raise ConnectionRefusedError(f"refused {SMTP_PASSWORD}")
        if type(self).fail_on == "timeout":
            raise TimeoutError("timed out")

    def starttls(self, **kwargs):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(f"login:{user}")
        if type(self).fail_on == "login":
            raise smtplib.SMTPAuthenticationError(535, f"bad {SMTP_PASSWORD}".encode())

    def send_message(self, message, from_addr=None, to_addrs=None):
        self.calls.append("send")
        if type(self).fail_on == "disconnect":
            raise smtplib.SMTPServerDisconnected("gone")
        self.sent.append((message, from_addr, to_addrs))
        return dict(type(self).refused)

    def quit(self):
        self.calls.append("quit")


class _FakeSmtpSsl(_FakeSmtp):
    ssl = True


@pytest.fixture
def smtp(env, monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "smtp")
    _FakeSmtp.instances = []
    _FakeSmtp.fail_on = None
    _FakeSmtp.refused = {}
    monkeypatch.setattr(smtplib, "SMTP", _FakeSmtp)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSmtpSsl)
    return _FakeSmtp


def test_smtp_starttls_sends_multipart_alternative(smtp):
    out = ep.send_email(_msg())

    assert out.status == "sent" and out.provider == "smtp"
    (session,) = smtp.instances
    assert not session.ssl
    assert (session.host, session.port) == ("smtp.relay.example", 587)
    assert session.calls == ["starttls", "send", "quit"]  # no username → no login
    message, from_addr, to_addrs = session.sent[0]
    assert from_addr == "notify@notify.example.com" and to_addrs == [REAL_TO]
    parsed = message_from_bytes(message.as_bytes())
    assert parsed.get_content_type() == "multipart/alternative"
    parts = [p.get_content_type() for p in parsed.get_payload()]
    assert parts == ["text/plain", "text/html"]
    assert parsed["From"] == formataddr(("Syrel", "notify@notify.example.com"))
    assert parsed["Reply-To"] is None


def test_smtp_ssl_uses_smtp_ssl_and_logs_in_when_a_username_is_set(smtp, monkeypatch):
    monkeypatch.setattr(settings, "smtp_security", "ssl")
    monkeypatch.setattr(settings, "smtp_username", "mailer")
    ep.send_email(_msg())
    (session,) = smtp.instances
    assert session.ssl
    assert session.calls == ["login:mailer", "send", "quit"]


def test_smtp_security_none_neither_tls(smtp, monkeypatch):
    monkeypatch.setattr(settings, "smtp_security", "none")
    ep.send_email(_msg())
    (session,) = smtp.instances
    assert not session.ssl and "starttls" not in session.calls


def test_smtp_refused_recipient_is_a_failure(smtp):
    smtp.refused = {REAL_TO: (550, b"no such user")}
    out = ep.send_email(_msg())
    assert out.status == "failed" and out.retryable is False
    assert REAL_TO not in out.reason


@pytest.mark.parametrize("fail_on, retryable", [
    ("login", False), ("disconnect", True), ("connect", True), ("timeout", True),
])
def test_smtp_failures_classified_and_quiet(smtp, monkeypatch, caplog, fail_on, retryable):
    monkeypatch.setattr(settings, "smtp_username", "mailer")
    smtp.fail_on = fail_on
    with caplog.at_level(logging.DEBUG):
        out = ep.send_email(_msg())
    assert out.status == "failed" and out.retryable is retryable
    assert out.reason and len(out.reason) <= 120
    assert SMTP_PASSWORD not in out.reason and SMTP_PASSWORD not in caplog.text
    assert REAL_TO not in out.reason
    if fail_on in ("login", "disconnect"):
        assert smtp.instances[0].calls[-1] == "quit"   # quit is always attempted


# ── From, Reply-To, header injection ───────────────────────────────────────────────────

def test_from_falls_back_to_the_env_address(env, monkeypatch):
    env["app"] = _app(email_from_address="")
    monkeypatch.setattr(settings, "invite_from_email", "invites@env.example.com")
    rec = _resend(monkeypatch)
    ep.send_email(_msg())
    assert rec.body()["from"] == "Syrel <invites@env.example.com>"


def test_no_sender_address_fails_without_the_transport(env, monkeypatch):
    env["app"] = _app(email_from_address="")
    _forbid_network(monkeypatch)
    out = ep.send_email(_msg())
    assert out.status == "failed"
    assert out.reason == "No sender address is set."


def test_a_from_name_with_a_line_break_cannot_add_a_header(smtp, env):
    env["app"] = _app(email_from_name="Syrel\r\nBcc: evil@example.com")
    out = ep.send_email(_msg(subject="Hi\r\nBcc: evil@example.com"))
    assert out.status == "sent"
    message = smtp.instances[0].sent[0][0]
    raw = message.as_bytes()
    parsed = message_from_bytes(raw)
    assert parsed["Bcc"] is None
    assert b"\r\nBcc:" not in raw and b"\nBcc:" not in raw


def test_one_line_replaces_every_control_character_with_a_space():
    assert ep.one_line("a\r\nb\tc\x00d\x7fe") == "a  b c d e"
    assert ep.one_line("plain") == "plain"


# ── never raises ───────────────────────────────────────────────────────────────────────

def test_an_unexpected_exception_becomes_a_failed_outcome(env, monkeypatch):
    def _explode():
        raise RuntimeError(f"surprise {API_KEY}")
    monkeypatch.setattr(ep, "load_app_settings", _explode)
    out = ep.send_email(_msg())
    assert out.status == "failed" and out.retryable is False
    assert API_KEY not in (out.reason or "")


# ── shell ──────────────────────────────────────────────────────────────────────────────

def test_the_shell_escapes_the_logo_origin_and_wraps_the_inner_html(monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", 'https://app.example.com/"onload="x,https://b.example.com')
    out = ep.shell_html("<p>inner</p>", footer_html="<p>foot</p>")
    assert "max-width:560px" in out and "padding:24px" in out and "#0F172A" in out
    assert "<p>inner</p>" in out and "<p>foot</p>" in out
    assert "border-top:1px solid #E2E4E9" in out and "#6B7280" in out
    assert '"onload="x' not in out and "&quot;onload=&quot;x" in out
    assert "b.example.com" not in out
    assert "border-top" not in ep.shell_html("<p>inner</p>")


# ── the Settings knobs (migration 218) ─────────────────────────────────────────────────

def test_the_four_email_knobs_default_on_a_database_without_migration_218():
    eff = us._build_settings_from_row({})
    assert eff.notification_email_delay_seconds == 120
    assert eff.email_from_address == ""
    assert eff.email_from_name == "Syrel"
    assert eff.email_dev_redirect_address == ""


def test_the_four_email_knobs_load_from_the_row():
    eff = us._build_settings_from_row({
        "notification_email_delay_seconds": 600, "email_from_address": "a@b.example",
        "email_from_name": "Acme", "email_dev_redirect_address": "t@b.example",
    })
    assert (eff.notification_email_delay_seconds, eff.email_from_address, eff.email_from_name,
            eff.email_dev_redirect_address) == (600, "a@b.example", "Acme", "t@b.example")


def test_the_smtp_settings_exist_with_their_defaults():
    from app.config import Settings
    fields = Settings.model_fields
    assert fields["smtp_host"].default == ""
    assert fields["smtp_port"].default == 587
    assert fields["smtp_username"].default == ""
    assert fields["smtp_password"].default == ""
    assert fields["smtp_security"].default == "starttls"
