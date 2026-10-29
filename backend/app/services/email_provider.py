"""The ONE app mailer (Phase 300 / D-21). Every app email — invitations and run-waiting
notices — goes through ``send_email``.

── THREE PROVIDERS, NOTHING TO INSTALL (D-21) ───────────────────────────────────────────
``EMAIL_PROVIDER`` (env, infra) picks one; an unset or unknown value is ``none``:

* ``none``   — nothing leaves the process. The outcome is ``suppressed``. The invite LINK is
  still logged (the offline / self-hosted flow: the inviter copies it from the app).
* ``resend`` — Resend's REST API over ``httpx`` (``RESEND_EMAILS_URL``). ⚠ Until Phase 300 this
  path lazily imported the vendor SDK, which was NEVER in the built image, so a deployed
  backend could not send a single invitation email; a fake module in the test suite hid it.
  ``httpx`` is a declared requirement, and ``test_300_clean_image_imports`` walks this module's
  imports against ``requirements.txt``.
* ``smtp``   — stdlib ``smtplib`` against the operator's relay (``SMTP_*`` env vars, D-28). This
  is plain ``smtplib.SMTP`` / ``SMTP_SSL`` on purpose, NOT the connector egress binder
  (``open_pinned_smtp``): that refuses private and loopback hosts, which is right for a
  tenant-configured host and wrong for the operator's own relay, which may be local.

``send_email`` is BLOCKING (httpx.Client / smtplib) and every caller reaches it through
``run_in_threadpool`` (D-v2.5-01). It NEVER raises: every failure becomes a ``SendOutcome``
whose ``reason`` is a short sentence that never carries the API key, the SMTP password, the
recipient, the subject or a link. ``retryable`` says whether the same frozen message may be
tried again (the 300-04 drainer reads it).

── THE DEV GUARD (D-10) ─────────────────────────────────────────────────────────────────
Outside production (``is_production_environment()`` — the ONE home of that check) every email
is rewritten to the Settings test address with a ``[Test] `` subject prefix, or, when no test
address is set, held back (``suppressed``) and only logged. Production ignores the test address.
The guard sits HERE, inside the seam, so no caller can forget it.

── SENDER (D-02 / D-03 / D-08) ──────────────────────────────────────────────────────────
From = ``{from-name} <{from-address}>`` from Settings (``app_settings``, migration 218); the
address falls back to env ``INVITE_FROM_EMAIL`` while the Settings value is empty. No reply address header is set (D-03).
Every header value passes through ``one_line`` (CR, LF and every control character → one space),
so a crafted name cannot add a header on either transport.

── WHY THE BODY IS FROZEN BY THE CALLER (D-31) ──────────────────────────────────────────
``OutboundEmail`` is rendered once by its caller and passed in whole. The mailer never renders,
so a retry sends byte-identical content — which is what Resend's ``Idempotency-Key`` requires
(a changed body under the same key is refused ``409 invalid_idempotent_request``).
"""
from __future__ import annotations

import html
import logging
import re
import smtplib
import ssl
from dataclasses import dataclass, replace
from email.message import EmailMessage
from email.utils import formataddr
from typing import Literal

import httpx

from app.api.api_docs import is_production_environment
from app.config import primary_frontend_origin, settings
from app.models.user_settings import load_app_settings

logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"
USER_AGENT = "Syrel-mailer/1"
RESEND_TIMEOUT_SECONDS = 10.0
SMTP_TIMEOUT_SECONDS = 15.0

#: Every C0 control, DEL, and the Unicode line breaks a header parser may honour.
_CONTROL_CHARACTERS = frozenset(chr(code) for code in range(32)) | {
    chr(127), "\x85", " ", " ",
}
#: Resend's error ``name`` is read only when it is enum-shaped; anything else is dropped.
_ENUM = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


@dataclass(frozen=True)
class OutboundEmail:
    to: str
    subject: str
    text: str
    html: str


@dataclass(frozen=True)
class SendOutcome:
    status: Literal["sent", "failed", "suppressed"]
    reason: str | None = None
    provider: str = "none"
    provider_id: str | None = None
    retryable: bool = False
    #: 300-REVIEW IN-01: outside production the send was rewritten to the Settings test address,
    #: so a ``sent`` outcome did NOT reach its real recipient. Callers say so in words.
    redirected: bool = False


def configured_provider() -> Literal["none", "resend", "smtp"]:
    """``EMAIL_PROVIDER`` normalised; unset or unknown → ``none`` (the safe default)."""
    raw = (getattr(settings, "email_provider", "") or "").strip().lower()
    if raw == "resend":
        return "resend"
    if raw == "smtp":
        return "smtp"
    return "none"


def one_line(value: str) -> str:
    """Every CR, LF and other control character becomes one space (the header guard, D-02)."""
    return "".join(" " if ch in _CONTROL_CHARACTERS else ch for ch in (value or ""))


def compose_invite_link(raw_token: str) -> str:
    """Compose the invite link server-side from ``settings.frontend_url`` (the link base).

    Reuses the EXISTING ``frontend_url`` config — deliberately NO new env var for the link base
    (RESEARCH Open-Question 3). The raw token is carried in the query string; it exists ONLY
    here and in the emitted link, never at rest (T-161-04).
    """
    # ⚠ BUG-260904-04: `frontend_url` is a COMMA-SEPARATED LIST on any multi-origin install,
    # so the raw value built `https://a.com,https://b.com/invite?token=…` — an unusable link
    # in an email nobody can resend. Same defect as the four OAuth redirect sites.
    base = primary_frontend_origin()
    return f"{base}/invite?token={raw_token}"


# ── the shell (UI-SPEC S1 / UI-D4) ──────────────────────────────────────────────────────
_FONT = ("-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif")
_LINK_STYLE = "color:#4F46E5;font-weight:600"


def shell_html(inner_html: str, *, footer_html: str | None = None) -> str:
    """Wrap ALREADY-ESCAPED inner HTML in the one app-email shell: the Syrel lockup, then the
    body, then an optional footer block. Plain ``<div>``/``<p>`` with inline styles — no
    ``<style>`` block, no table layout, no web font, no tracking pixel, no preheader.

    The logo URL is escaped too (WR-02 / D-22): ``FRONTEND_URL`` is operator config, but every
    interpolated value is escaped at this boundary, not only the tenant-controlled ones.
    """
    safe_logo = html.escape(f"{primary_frontend_origin()}/brand/syrel-lockup-email.png", quote=True)
    parts = [
        f'<div style="max-width:560px;margin:0 auto;padding:24px;background:#FFFFFF;'
        f'font-family:{_FONT};font-size:16px;line-height:1.5;color:#0F172A">',
        f'<p style="margin:0 0 24px"><img src="{safe_logo}" alt="Syrel" width="160" height="80" '
        f'style="display:block;border:0"></p>',
        inner_html,
    ]
    if footer_html is not None:
        parts.append(
            '<div style="border-top:1px solid #E2E4E9;padding-top:16px;font-size:14px;'
            f'color:#6B7280">{footer_html}</div>'
        )
    parts.append("</div>")
    return "".join(parts)


# ── providers ───────────────────────────────────────────────────────────────────────────
def _http_client(timeout: httpx.Timeout) -> httpx.Client:
    """The one client factory — tests inject an ``httpx.MockTransport`` here."""
    return httpx.Client(timeout=timeout)


def _resend_error_name(response: httpx.Response) -> str | None:
    """Resend's error ``name``, only when it is enum-shaped. Never raises; the body is never
    logged (it may echo the address or the key)."""
    try:
        data = response.json()
    except Exception:  # noqa: BLE001 - a non-JSON body is a normal failure shape
        return None
    name = data.get("name") if isinstance(data, dict) else None
    return name if isinstance(name, str) and _ENUM.match(name) else None


def _send_resend(sender: str, to: str, subject: str, msg: OutboundEmail,
                 idempotency_key: str | None) -> SendOutcome:
    api_key = (settings.resend_api_key or "").strip()
    if not api_key:
        return SendOutcome("failed", reason="RESEND_API_KEY is not set.", provider="resend")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    payload = {"from": sender, "to": [to], "subject": subject, "html": msg.html, "text": msg.text}
    try:
        with _http_client(httpx.Timeout(RESEND_TIMEOUT_SECONDS)) as client:
            response = client.post(RESEND_EMAILS_URL, headers=headers, json=payload)
    except httpx.TimeoutException:
        logger.warning("email: Resend timed out")
        return SendOutcome("failed", reason="Resend did not answer in time.", provider="resend",
                           retryable=True)
    except httpx.TransportError as exc:
        logger.warning("email: Resend could not be reached (%s)", type(exc).__name__)
        return SendOutcome("failed", reason="Resend could not be reached.", provider="resend",
                           retryable=True)

    status = response.status_code
    if 200 <= status < 300:
        provider_id = None
        try:
            data = response.json()
            if isinstance(data, dict) and isinstance(data.get("id"), str):
                provider_id = data["id"]
        except Exception:  # noqa: BLE001 - accepted is accepted; the id is a nicety
            pass
        return SendOutcome("sent", provider="resend", provider_id=provider_id)

    name = _resend_error_name(response)
    retryable = status == 429 or status >= 500 or (
        status == 409 and name == "concurrent_idempotent_requests"
    )
    # The BODY is not logged; the status and the enum-guarded name are.
    logger.warning("email: Resend answered HTTP %s (%s)", status, name or "no name")
    suffix = f", {name}" if name else ""
    return SendOutcome("failed", reason=f"Resend refused the email (HTTP {status}{suffix}).",
                       provider="resend", retryable=retryable)


def _quit_quietly(session) -> None:
    try:
        session.quit()
    except Exception:  # noqa: BLE001 - a failed goodbye must never replace the outcome
        logger.debug("email: the SMTP session did not close cleanly")


#: The SMTP_SECURITY values the mailer knows. 300-REVIEW WR-02: anything else used to open a
#: PLAIN session and then log in, so a likely operator value such as ``tls`` sent SMTP_PASSWORD
#: unencrypted. An unknown value now fails closed, before any socket opens.
SMTP_SECURITY_VALUES = ("starttls", "ssl", "none")


def smtp_security_problem() -> str | None:
    """The sentence refusing the SMTP transport settings, else ``None``. Pure; no network.

    ``none`` is kept for a trusted relay that needs NO login. With a username set it is refused:
    the login (and its password) never crosses a plaintext session.
    """
    security = (settings.smtp_security or "starttls").strip().lower()
    if security not in SMTP_SECURITY_VALUES:
        return "SMTP_SECURITY must be starttls, ssl or none."
    if security == "none" and (settings.smtp_username or "").strip():
        return "SMTP_SECURITY is none, so the login was not sent. Use starttls or ssl."
    return None


def _send_smtp(sender_header: str, sender_address: str, to: str, subject: str,
               msg: OutboundEmail) -> SendOutcome:
    host = (settings.smtp_host or "").strip()
    if not host:
        return SendOutcome("failed", reason="SMTP_HOST is not set.", provider="smtp")
    problem = smtp_security_problem()
    if problem:
        logger.warning("email: not sent, the SMTP security setting was refused")
        return SendOutcome("failed", reason=problem, provider="smtp")
    port = int(settings.smtp_port or 587)
    security = (settings.smtp_security or "starttls").strip().lower()
    username = (settings.smtp_username or "").strip()

    message = EmailMessage()
    for header, value in (("From", sender_header), ("To", to), ("Subject", subject)):
        try:
            message[header] = value
        except ValueError:
            # Name the header, never the value (190 D-08).
            return SendOutcome("failed", reason=f"The {header} header was refused.", provider="smtp")
    message.set_content(msg.text)
    message.add_alternative(msg.html, subtype="html")

    context = ssl.create_default_context()
    session = None
    try:
        if security == "ssl":
            session = smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS, context=context)
        else:
            session = smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS)
            if security == "starttls":
                session.starttls(context=context)
        # WR-02: reached only over ssl/starttls, or `none` with no username (refused above).
        if username:
            session.login(username, settings.smtp_password or "")
        refused = session.send_message(message, from_addr=sender_address, to_addrs=[to])
    except smtplib.SMTPAuthenticationError as exc:
        logger.warning("email: the mail server refused the login (code=%s)", exc.smtp_code)
        return SendOutcome("failed", reason="The mail server refused the login.", provider="smtp")
    except smtplib.SMTPRecipientsRefused:
        logger.warning("email: the mail server refused the recipient")
        return SendOutcome("failed", reason="The mail server refused the recipient.", provider="smtp")
    except smtplib.SMTPServerDisconnected:
        logger.warning("email: the mail server disconnected")
        return SendOutcome("failed", reason="The mail server disconnected.", provider="smtp",
                           retryable=True)
    except smtplib.SMTPResponseException as exc:
        code = exc.smtp_code if isinstance(exc.smtp_code, int) else 0
        logger.warning("email: the mail server refused the message (code=%s)", code)
        return SendOutcome("failed", reason=f"The mail server refused the message (code {code}).",
                           provider="smtp", retryable=400 <= code < 500)
    except (TimeoutError, OSError) as exc:  # ConnectionError, socket.timeout, ssl errors
        logger.warning("email: the mail server could not be reached (%s)", type(exc).__name__)
        return SendOutcome("failed", reason="The mail server could not be reached.", provider="smtp",
                           retryable=True)
    finally:
        if session is not None:
            _quit_quietly(session)

    if refused:
        # send_message RETURNS per-recipient refusals rather than raising when another
        # address was accepted; with one recipient, a non-empty map means it was refused.
        logger.warning("email: the mail server refused the recipient")
        return SendOutcome("failed", reason="The mail server refused the recipient.", provider="smtp")
    return SendOutcome("sent", provider="smtp")


def _usable_address(value: str) -> bool:
    local, sep, domain = value.partition("@")
    return bool(sep and local and domain and "@" not in domain and "." in domain
                and not any(ch in _CONTROL_CHARACTERS or ch.isspace() for ch in value))


def _send(msg: OutboundEmail, idempotency_key: str | None) -> SendOutcome:
    provider = configured_provider()
    if provider == "none":
        logger.info("email: not sent, EMAIL_PROVIDER is none")
        return SendOutcome("suppressed", reason="Email is not set up on this server.", provider="none")

    app = load_app_settings()
    to = (msg.to or "").strip()
    subject = one_line(msg.subject)
    redirected = False
    if not is_production_environment():
        redirect = (getattr(app, "email_dev_redirect_address", "") or "").strip()
        if not redirect:
            logger.info("email: not sent, outside production with no test address")
            return SendOutcome(
                "suppressed",
                reason="Outside production with no test address set, so the email was only logged.",
                provider=provider,
            )
        to = redirect
        subject = "[Test] " + subject
        redirected = True

    address = one_line(getattr(app, "email_from_address", "") or settings.invite_from_email or "").strip()
    if not address:
        return SendOutcome("failed", reason="No sender address is set.", provider=provider)
    name = one_line(getattr(app, "email_from_name", "") or "").strip() or "Syrel"
    sender = formataddr((name, address))
    if not _usable_address(to):
        return SendOutcome("failed", reason="The recipient address is not usable.", provider=provider)

    if provider == "resend":
        outcome = _send_resend(sender, to, subject, msg, idempotency_key)
    else:
        outcome = _send_smtp(sender, address, to, subject, msg)
    return replace(outcome, redirected=True) if redirected else outcome


def send_email(msg: OutboundEmail, *, idempotency_key: str | None = None) -> SendOutcome:
    """Send one email. BLOCKING — call through ``run_in_threadpool``. Never raises."""
    try:
        return _send(msg, idempotency_key)
    except Exception as exc:  # noqa: BLE001 - the seam's contract: an outcome, never a raise
        logger.error("email: unexpected failure in the mailer (%s)", type(exc).__name__)
        return SendOutcome("failed", reason="The email could not be sent.",
                           provider=configured_provider())


# ── the invitation (UI-SPEC S1 "Invite email on the shell") ────────────────────────────
def send_invite(to: str, link: str, org_name: str) -> SendOutcome:
    """Compose the invitation on the shared shell and send it. BLOCKING; never raises.

    The shipped words are kept verbatim (276-07); 300 adds the shell styling and the plain-text
    alternative. No footer: an invite is a one-off a person asked another person to send.
    WR-02: ``org_name`` is tenant-controlled and ``link`` carries the token, so BOTH are escaped
    in the HTML; the subject is plain text (never entity-escaped) through ``one_line``.
    """
    safe_org = html.escape(org_name)
    safe_link = html.escape(link, quote=True)
    inner = (
        f'<p style="margin:0 0 16px">You have been invited to join <strong>{safe_org}</strong> '
        f'on Syrel.</p>'
        f'<p style="margin:0 0 24px"><a href="{safe_link}" style="{_LINK_STYLE}">'
        f'Accept your invitation</a></p>'
    )
    plain_org = one_line(org_name)
    text = f"You have been invited to join {plain_org} on Syrel.\n\nAccept your invitation:\n{link}"
    outcome = send_email(OutboundEmail(
        to=to,
        subject=one_line(f"You're invited to {org_name} on Syrel"),
        text=text,
        html=shell_html(inner),
    ))
    if outcome.status == "suppressed":
        # The offline / self-hosted flow (Phase 167): the link is still findable in the log.
        logger.info("invite link for %s (org=%s): %s", to, org_name, link)
    return outcome
