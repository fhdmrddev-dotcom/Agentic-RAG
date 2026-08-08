"""Phase 190 Plan 02 (CONN-03) — connector egress guard: the destination validator.

The SINGLE home of every connector socket decision — scheme, host and resolved address —
and the producer of the pinned ``(ip, hostname, port, scheme)`` triple both transport
binders consume. No HTTP or SMTP client is constructed anywhere under
``backend/app/services/connectors/``; every adapter asks this module where it may connect,
and receives either a pinned destination or a refusal.

Failure polarity (D-07 / D-08, intent-based — each stated with its decision id):
  - Destination REFUSED            -> EgressRefused carrying an auditable reason CODE plus
    the host (D-08). Never a bool: a bool cannot be written into an audit row a person
    reads, filtered on, or alerted from.
  - Host does not resolve          -> REFUSAL (D-07 step 3). "Nothing answered" is not
    permission to try; an empty answer set fails closed like any other.
  - Any ONE resolved address is non-public -> REFUSAL of the whole destination (D-07 step
    3). A multi-answer host is only as safe as its worst answer.
  - Pin unavailable                -> REFUSAL, never a hostname fallback (D-07 step 5).
    Re-resolving at connect time is the DNS-rebinding TOCTOU window this module exists to
    close, so "connect by name instead" is the one recovery that must not exist.
  - Capability not in the closed set -> REFUSAL (D-04). There is no permissive default.

Ordering IS the security property (D-06 / D-07). The guard runs capability, then scheme,
then host, then EVERY resolved address, and it runs BEFORE any credential is resolved. That
is the entire n8n #28218 class: *"protection activates conditionally based on credential
presence, not request characteristics."* A guard that lives inside the credential path never
runs for an unbound step, and the request goes out.

Classification is by PARSING, never by substring (the ``secret_cipher._ENVELOPE_PREFIX``
discipline, one layer up): the host is read from ``httpx.URL(u).host``, which strips
userinfo, drops query and fragment and lowercases — so ``https://slack.com@evil.com/`` is
``evil.com`` here and matches nothing. ⚠ httpx IDNA-DECODES, so ``.host`` is the unicode
form; a non-ASCII host gets its own refusal rather than an accidental one.

The predicate's honest framing (RESEARCH §R14, and the 185 lesson): ``ip.is_global`` is
itself a table inside CPython, so this is not a pure property either. **What makes it
defensible is the CORPUS, not the predicate** — ``tests/unit/test_190_egress.py`` drives 29
addresses, and each unwrap clause below has a driven case that goes RED when it is deleted.
A bare ``not ip.is_global`` has FOUR measured holes; they are named at their clauses.

Secret-logging discipline (D-08, inherited verbatim from ``secret_cipher``'s
T-081.1-04 block): every log line emits the capability, the refused HOST and the reason code
— NEVER a credential, never a request body, never a URL query string.

SCOPE: this module validates and pins. It opens NOTHING. The httpx IP pin, the smtplib
``_host`` pin, ``follow_redirects=False`` and the response-size cap are plan 190-07; the
``redirected`` reason code is declared in the closed table here and raised there.
"""
from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass
from typing import Callable

import httpx

logger = logging.getLogger(__name__)

# ── the closed refusal table (UI-SPEC §4c) ────────────────────────────────────
# Six codes, each with exactly one authored sentence in the UI. A seventh code is a refusal
# no sentence renders — the person sees an empty reason — so the set is closed at import.
REFUSAL_REASONS: frozenset[str] = frozenset({
    "address_not_public",
    "scheme_not_tls",
    "host_not_allowed",
    "host_not_ascii",
    "unresolvable",
    # Declared here, RAISED in plan 190-07 (the transport binders own redirect handling).
    # Declaring it here keeps the table the single source UI-SPEC §4c renders from.
    "redirected",
})
assert len(REFUSAL_REASONS) == 6, (
    f"UI-SPEC §4c declares a CLOSED six-row refusal table; this module carries "
    f"{len(REFUSAL_REASONS)}. Add the sentence before adding the code."
)

# ── the address predicate (RESEARCH §R14, driven 29/29) ───────────────────────
# ⚠ These two prefixes differ by ONE 16-bit group and read almost identically. The first is
# handled by CPython's `.ipv4_mapped`; the second has NO accessor at all and is the hole that
# would have shipped. The assert below makes "they are different networks" mechanical rather
# than a thing a reader has to notice.
_V4_MAPPED = ipaddress.ip_network("::ffff:0:0/96")      # IPv4-mapped   — .ipv4_mapped
_V4_TRANSLATED = ipaddress.ip_network("::ffff:0:0:0/96")  # IPv4-TRANSLATED (SIIT) — no accessor
_NAT64 = ipaddress.ip_network("64:ff9b::/96")           # RFC 6052 well-known prefix
_SITE_LOCAL = ipaddress.ip_network("fec0::/10")         # deprecated RFC 3879; is_global -> True
assert not _V4_MAPPED.overlaps(_V4_TRANSLATED), (
    "::ffff:0:0/96 and ::ffff:0:0:0/96 must stay distinct networks — if these ever compare "
    "equal, the SIIT branch below has silently become dead code"
)

# The bound is 4 because each iteration strictly REMOVES one layer of IPv6 wrapping and
# there are only four wrapping forms; no crafted address can make us loop. It is a constant
# rather than a `while True` so a future fifth form is a deliberate edit, not a hang.
_UNWRAP_ITERATIONS = 4


def _unwrap(ip: ipaddress.IPv4Address | ipaddress.IPv6Address):
    """Peel every IPv4-embedding form CPython does NOT peel for you.

    Each clause names the form it peels and the driven case that proves it load-bearing
    (``tests/unit/test_190_egress.py``). Note that two of the four are load-bearing for the
    AUDITED ADDRESS rather than for the verdict — measured, not assumed: CPython's
    ``is_global`` already unwraps IPv4-mapped, so without the first clause the refusal would
    still fire for ``::ffff:127.0.0.1`` but would NAME ``::ffff:7f00:1``, which is a refusal
    an operator cannot act on (D-08).
    """
    for _ in range(_UNWRAP_ITERATIONS):
        if not isinstance(ip, ipaddress.IPv6Address):
            return ip
        # ::ffff:a.b.c.d — IPv4-mapped. Driven: ::ffff:224.0.0.1 flips REFUSE->allow without
        # this clause (multicast does not survive the mapping; ff00::/8 excludes ::ffff:e000:1).
        if ip.ipv4_mapped is not None:
            ip = ip.ipv4_mapped
            continue
        # 2002::/16 — 6to4. Driven: 2002:7f00:1::1 must audit as 127.0.0.1, not as itself.
        if ip.sixtofour is not None:
            ip = ip.sixtofour
            continue
        # 2001::/32 — Teredo; [1] is the client IPv4. Driven:
        # 2001:0:4136:e378:8000:63bf:3fff:fdd2 must audit as 192.0.2.45.
        if ip.teredo is not None:
            ip = ip.teredo[1]
            continue
        # ::ffff:0:0:0/96 (SIIT) and 64:ff9b::/96 (NAT64) both carry the IPv4 address in the
        # low 32 bits and CPython exposes NEITHER. Driven: ::ffff:0:7f00:1 (HOLE 3 — the one
        # that would have shipped) and 64:ff9b::a9fe:a9fe (HOLE 2 — the metadata endpoint).
        if ip in _V4_TRANSLATED or ip in _NAT64:
            ip = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
            continue
        return ip
    return ip


def refuse_reason(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str | None:
    """``None`` == may be connected to. A STRING == the auditable refusal reason (D-08).

    Never a bool, at either polarity. The string is what a person reads in the audit row, so
    it names the address actually reached rather than the wrapper it arrived in.
    """
    # FIRST, before the unwrap: fec0::/10 is deprecated (RFC 3879) and CPython answers
    # is_global=True for it — HOLE 4. Nothing downstream would catch it.
    if isinstance(ip, ipaddress.IPv6Address) and ip in _SITE_LOCAL:
        return "IPv6 site-local (fec0::/10)"

    unwrapped = _unwrap(ip)

    # HOLE 1: 224.0.0.1 answers is_global=True. Multicast is not a destination a connector
    # may hold a conversation with, and it is a live SSRF primitive on some fabrics.
    if unwrapped.is_multicast:
        return "multicast"

    if not unwrapped.is_global:
        return f"not globally routable ({unwrapped})"

    return None


# ── the refusal ───────────────────────────────────────────────────────────────


class EgressRefused(Exception):
    """A destination was refused. Carries capability, host, reason code and (optionally) the
    address — and STRUCTURALLY nothing else.

    D-08 is enforced by the signature, not by discipline: every parameter is keyword-only and
    there is no ``**kwargs``, so there is no argument through which a request body, a
    response body or a resolved secret could be attached. ``raise EgressRefused(capability,
    response.text)`` does not compile into anything.

    The wording is a DESTINATION problem and never a credential one (D-06). An unbound step
    aimed at a refused host must not be told to attach a credential for an address that would
    be refused with one.
    """

    def __init__(
        self,
        *,
        reason_code: str,
        host: str,
        capability: str,
        ip: str | None = None,
    ) -> None:
        if reason_code not in REFUSAL_REASONS:
            # Enforced at RAISE time, not merely declared. A typo'd code renders no sentence
            # at all in UI-SPEC §4c's closed map — the person sees an empty refusal.
            raise ValueError(
                f"egress reason_code {reason_code!r} is not one of the "
                f"{len(REFUSAL_REASONS)} codes UI-SPEC §4c declares: {sorted(REFUSAL_REASONS)}"
            )
        self.reason_code = reason_code
        self.host = host
        self.capability = capability
        self.ip = ip
        detail = f" [{ip}]" if ip else ""
        super().__init__(f"{capability}: refused {host!r}{detail} — {reason_code}")


@dataclass(frozen=True)
class PinnedDestination:
    """The validated triple both binders consume in plan 190-07.

    ``ip`` is what the TCP connection goes to; ``hostname`` is what SNI and certificate
    verification use. Keeping both is the whole point — connecting to the IP while verifying
    the name is what closes the rebinding window WITHOUT disabling hostname checking.
    """

    ip: str
    hostname: str
    port: int
    scheme: str


# ── the per-capability allow-list ─────────────────────────────────────────────

# D-02: Slack's destination is a CODE CONSTANT. No user-supplied URL exists for it, which is
# why its match is exact equality rather than a suffix.
SLACK_API_BASE = "https://slack.com/api/"

_EXACT = "exact"
_SUFFIX = "suffix"
_CALLER = "caller"  # send_email: the org configured this exact host; there is no wildcard.

# Keyed by the SAME closed capability set the rest of the app uses
# (``harness.grounding.EXTERNAL_ACTION_CAPABILITIES``). Two spellings are unavoidable —
# this module must not import a service — so the agreement is MECHANICAL, asserted by
# ``test_the_capability_keys_agree_with_the_shipped_closed_set`` rather than remembered.
ALLOWED_HOST_SUFFIXES: dict[str, tuple[str, ...]] = {
    "post_message": ("slack.com",),
    "create_ticket": ("atlassian.net",),
    # Empty on purpose: the allowed host is the org-configured one, supplied per call. An
    # entry here would be a second, staler source of truth for it.
    "send_email": (),
}

_HOST_MATCH: dict[str, str] = {
    "post_message": _EXACT,
    "create_ticket": _SUFFIX,
    "send_email": _CALLER,
}

# D-07 step 1. TLS is STATED, never assumed: a destination with no scheme is refused, so a
# bare "mail.example.com" can never become a cleartext session by default.
_TLS_SCHEMES: dict[str, frozenset[str]] = {
    "post_message": frozenset({"https"}),
    "create_ticket": frozenset({"https"}),
    "send_email": frozenset({"smtps", "smtp+starttls"}),
}

_DEFAULT_PORTS: dict[str, int] = {
    "https": 443,
    "smtps": 465,          # implicit TLS
    "smtp+starttls": 587,  # STARTTLS
}


def _normalise_host(host: str) -> str:
    """``h.lower().rstrip(".")`` — RESEARCH §R15. httpx already lowercases; doing it here too
    means the rule reads completely at its own site rather than depending on a parser detail."""
    return host.lower().rstrip(".")


def _host_is_allowed(capability: str, host: str, allowed_host: str | None) -> bool:
    """Label-boundary matching. ``h == suffix or h.endswith("." + suffix)``.

    ⚠ THE LEADING DOT IS THE WHOLE MECHANISM AND ITS ABSENCE IS THE CVE. Without it
    ``evilatlassian.net`` matches ``atlassian.net`` and ``notslack.com`` matches
    ``slack.com``. Both are driven cases.
    """
    mode = _HOST_MATCH[capability]
    if mode is _CALLER or mode == _CALLER:
        if not allowed_host:
            return False  # fail closed: no configured host means no permitted destination
        return host == _normalise_host(allowed_host)
    for suffix in ALLOWED_HOST_SUFFIXES[capability]:
        if mode == _EXACT:
            if host == suffix:
                return True
        elif host == suffix or host.endswith("." + suffix):
            return True
    return False


def _default_resolver(hostname: str, port: int) -> list[str]:
    """Every A/AAAA answer as a plain address string. An empty list means "did not resolve"."""
    try:
        answers = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return []
    # sockaddr[0] carries a scope id for link-local IPv6 ("fe80::1%eth0"); strip it so the
    # address parses. Losing the scope cannot weaken the verdict — fe80::/10 is refused
    # whatever interface it names.
    return [str(answer[4][0]).split("%")[0] for answer in answers]


def _refuse(
    capability: str, host: str, reason_code: str, *, ip: str | None = None, detail: str = ""
) -> EgressRefused:
    """Build the refusal AND emit its single audit line (D-08).

    Exactly one WARNING per refusal, carrying capability, host and reason code. The URL, its
    query string, the request body and any credential are not in scope here and never reach
    a format argument.
    """
    logger.warning(
        "egress refused: capability=%s host=%s reason=%s%s%s",
        capability,
        host,
        reason_code,
        f" address={ip}" if ip else "",
        f" ({detail})" if detail else "",
    )
    return EgressRefused(reason_code=reason_code, host=host, capability=capability, ip=ip)


def validate_destination(
    capability: str,
    url_or_host: str,
    port: int | None = None,
    *,
    allowed_host: str | None = None,
    resolver: Callable[[str, int], list[str]] | None = None,
) -> PinnedDestination:
    """Validate a destination and return the pinned triple, or raise ``EgressRefused``.

    THE ORDER IS THE SECURITY PROPERTY (D-07): capability, scheme, host, then EVERY resolved
    address. Reordering these is not a refactor.

    ``allowed_host`` is the org-configured SMTP host for ``send_email`` (D-02: the other two
    destinations are code constants and ignore it). ``resolver`` is a test seam with a stdlib
    default — production callers never pass it — and it exists because a resolve step that
    can only be exercised against the live internet is a resolve step that is untested in CI,
    which is precisely how a guard rots into decoration.
    """
    # ── 0 · capability (D-04) — no permissive default ──
    if capability not in _TLS_SCHEMES:
        return_host = ""
        try:
            return_host = _normalise_host(httpx.URL(url_or_host).host)
        except Exception:  # noqa: BLE001 — an unparseable URL is still a refusal
            pass
        raise _refuse(
            capability,
            return_host,
            "host_not_allowed",
            detail=f"capability {capability!r} is not in the closed set",
        )

    try:
        parsed = httpx.URL(url_or_host)
    except Exception:  # noqa: BLE001 — httpx raises InvalidURL and friends; all mean "refuse"
        raise _refuse(capability, "", "host_not_allowed", detail="unparseable destination") from None

    # ── 1 · scheme (D-07 step 1) ──
    # http:// is refused with NO exception, including for localhost. The developer-convenience
    # carve-out is the production hole; there is deliberately no branch for it here.
    scheme = parsed.scheme.lower()
    if scheme not in _TLS_SCHEMES[capability]:
        raw_host = ""
        try:
            raw_host = _normalise_host(parsed.host)
        except Exception:  # noqa: BLE001
            pass
        raise _refuse(
            capability,
            raw_host,
            "scheme_not_tls",
            detail=f"scheme {scheme!r} is not one of {sorted(_TLS_SCHEMES[capability])}",
        )

    # ── 2 · host, from the PARSED url and never the raw string (T14) ──
    host = _normalise_host(parsed.host)
    if not host:
        raise _refuse(capability, "", "host_not_allowed", detail="no host in the destination")

    # httpx IDNA-DECODES, so a punycode homograph arrives here as its unicode form and would
    # fail the allow-list anyway — but SILENTLY, reading to a person as "you typed it wrong".
    # UI-SPEC §4c gives it its own sentence, so it gets its own code.
    if not host.isascii():
        raise _refuse(capability, host, "host_not_ascii", detail="non-ASCII (IDNA) host")

    if not _host_is_allowed(capability, host, allowed_host):
        raise _refuse(capability, host, "host_not_allowed")

    # ── 3 · resolve, then check EVERY answer (D-07 step 3) ──
    resolved_port = port or parsed.port or _DEFAULT_PORTS[scheme]
    resolve = resolver or _default_resolver
    answers = resolve(host, resolved_port)
    if not answers:
        raise _refuse(capability, host, "unresolvable")

    for address in answers:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            # An answer we cannot even parse is an answer we cannot clear. Fail closed.
            raise _refuse(
                capability, host, "address_not_public", ip=str(address), detail="unparseable address"
            ) from None
        reason = refuse_reason(ip)
        if reason is not None:
            # A multi-answer host is only as safe as its worst answer: one private record in
            # an otherwise public set refuses the whole destination.
            raise _refuse(capability, host, "address_not_public", ip=str(ip), detail=reason)

    # ── 4 · the pin ──
    # The FIRST answer, now that every answer has cleared. 190-07 connects to `ip` and
    # verifies `hostname`; it must never re-resolve, which is why the address travels with
    # the name rather than the name travelling alone.
    return PinnedDestination(ip=answers[0], hostname=host, port=resolved_port, scheme=scheme)


__all__ = [
    "REFUSAL_REASONS",
    "EgressRefused",
    "PinnedDestination",
    "refuse_reason",
    "validate_destination",
    "ALLOWED_HOST_SUFFIXES",
    "SLACK_API_BASE",
]
