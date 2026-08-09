"""Phase 168 (SSO — SAML 2.0 CORE), Plan 02 — public/free email-domain blocklist (D-168-05 Control 1).

Supabase verifies NEITHER domain ownership NOR public-domain exclusion, so the self-service
convenience of SSO registration is also a hijack surface: an org-admin could register `gmail.com`
(or a competitor's domain) and intercept SSO logins. This module is the first anti-hijack control —
a hardcoded set of the common public/free email providers, rejected BEFORE any provider-CRUD call
(RESEARCH lines 280-284, T-168-02).

NO runtime fetch of any remote list — a static hardcoded set avoids the SSRF / availability risk of
pulling a live blocklist at request time (RESEARCH line 283). ~25 entries cover >99% of real cases;
extend the set as needed. A curated disposable-domain list is a documented nice-to-have, not shipped
here.
"""
from __future__ import annotations

# The curated public/free email-provider set (RESEARCH line 282, extended). Stored lowercase;
# matching is exact (host-level) after lowercase + strip. Keep alphabetical-ish by provider family.
PUBLIC_EMAIL_DOMAINS: frozenset[str] = frozenset({
    # Google
    "gmail.com", "googlemail.com",
    # Microsoft
    "outlook.com", "hotmail.com", "live.com", "msn.com", "hotmail.co.uk", "outlook.co.uk",
    # Yahoo
    "yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.uk",
    # Apple
    "icloud.com", "me.com", "mac.com",
    # AOL
    "aol.com",
    # Proton
    "proton.me", "protonmail.com",
    # GMX / Mail.com family
    "gmx.com", "gmx.net", "mail.com",
    # Zoho
    "zoho.com",
    # Yandex
    "yandex.com", "yandex.ru",
    # Chinese consumer providers
    "qq.com", "163.com", "126.com",
    # Other consumer providers
    "fastmail.com", "hey.com",
})


def is_public_domain(domain: str) -> bool:
    """True iff ``domain`` is a known public/free email provider (case-insensitive).

    Non-string / empty inputs are treated as NOT public (presence validation is the caller's job);
    a real domain is normalized to lowercase + stripped before the membership test so that
    ``"GMAIL.COM"`` / ``" gmail.com "`` both match.
    """
    if not isinstance(domain, str):
        return False
    normalized = domain.strip().lower()
    if not normalized:
        return False
    return normalized in PUBLIC_EMAIL_DOMAINS


__all__ = ["PUBLIC_EMAIL_DOMAINS", "is_public_domain"]
