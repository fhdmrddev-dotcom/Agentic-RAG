"""Phase 167 (INV-01, D-167-02) — env-switched invitation email delivery.

Link-first delivery with an env switch (``EMAIL_PROVIDER``, default ``none``):

* ``none``   → ``NoneLogProvider`` (the DEFAULT). Logs the invite LINK at INFO and does
  nothing else — the offline / self-hosted default that needs NO email service and NO API key.
  The inviter copies the link from the app (Plan 02 returns it) and shares it out-of-band.
* ``resend`` → ``ResendProvider``. LAZY-imports the ``resend`` SDK INSIDE ``send_invite`` (so
  the package is only needed when real email is turned on — A6 keeps the offline default
  dependency-free), sets ``resend.api_key`` from settings, sends from ``invite_from_email``.

The invite LINK is always composed server-side from the EXISTING ``settings.frontend_url``
(no new APP_BASE_URL env var — RESEARCH Open-Question 3). The raw token lives ONLY in that
link (T-161-04); nothing here ever logs a bare token.

Precedent: the ``SANDBOX_IMAGE`` env-switch-with-fallback (``sandbox_service.py``) — an unset /
unknown value falls back to the safe default provider.
"""
from __future__ import annotations

import html
import logging
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)


def compose_invite_link(raw_token: str) -> str:
    """Compose the invite link server-side from ``settings.frontend_url`` (the link base).

    Reuses the EXISTING ``frontend_url`` config — deliberately NO new env var for the link base
    (RESEARCH Open-Question 3). The raw token is carried in the query string; it exists ONLY
    here and in the emitted link, never at rest (T-161-04).
    """
    base = (settings.frontend_url or "").rstrip("/")
    return f"{base}/invite?token={raw_token}"


class EmailProvider(Protocol):
    """The one delivery seam every provider implements."""

    def send_invite(self, to: str, link: str, org_name: str) -> None:  # pragma: no cover
        ...


class NoneLogProvider:
    """DEFAULT — offline / self-hosted. Logs the invite LINK (never a bare token elsewhere)."""

    def send_invite(self, to: str, link: str, org_name: str) -> None:
        logger.info("invite link for %s (org=%s): %s", to, org_name, link)


class ResendProvider:
    """``EMAIL_PROVIDER=resend`` — real email via the Resend SDK (opt-in, lazy-imported)."""

    def send_invite(self, to: str, link: str, org_name: str) -> None:
        # LAZY import: the `resend` package is only required when real email is enabled, so the
        # offline `none` default installs nothing (A6 — never imported on the none path).
        import resend

        resend.api_key = settings.resend_api_key
        # WR-02: org_name is tenant-controlled (organizations.name) and link is composed
        # server-side — HTML-escape BOTH before interpolating into the email body, or an org
        # named `</a><script>…` (or containing "/</>) breaks out of the markup (HTML/content
        # injection at the outbound-email trust boundary). The `subject` is a plain-text field,
        # not HTML, so it is left un-escaped (escaping it would surface literal entities).
        safe_org = html.escape(org_name)
        safe_link = html.escape(link, quote=True)
        resend.Emails.send(
            {
                "from": settings.invite_from_email,
                "to": to,
                "subject": f"You're invited to {org_name}",
                "html": (
                    f'<p>You have been invited to join <strong>{safe_org}</strong>.</p>'
                    f'<p><a href="{safe_link}">Accept your invitation</a></p>'
                ),
            }
        )


def get_email_provider() -> EmailProvider:
    """Return the provider impl for the current ``EMAIL_PROVIDER`` (default ``none``-log).

    An unset / unknown value falls back to ``NoneLogProvider`` — link-first is always safe.
    """
    provider = (settings.email_provider or "none").strip().lower()
    if provider == "resend":
        return ResendProvider()
    return NoneLogProvider()
