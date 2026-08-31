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

SCOPE (extended by plan 190-07): this module validates, pins AND binds. The two transport
binders at the bottom — ``send_pinned_http`` and ``open_pinned_smtp`` — are the ONLY two
places in the app where a connector socket is opened (D-05), and the ``redirected`` reason
code that 190-02 declared and left unraised is raised in ``send_pinned_http``.

⚠ RESIDUAL-190-01 (a NAMED residual risk, guarded by
``tests/unit/test_190_residual_fence.py``, not by this paragraph): both pin recipes depend on
NON-PUBLIC attributes — ``smtplib.SMTP._host`` (private, and ``SMTP.connect()``'s
non-assignment of it is an implementation detail rather than a documented contract) and
``httpcore``'s ``sni_hostname`` request extension (an httpx/httpcore internal convention, not
a versioned public API). A CPython or httpx minor upgrade could break the pin **while every
functional test still passes**, because an un-pinned connection simply re-resolves and still
works. Trigger: any Python or httpx version bump in ``requirements.txt``.
"""
from __future__ import annotations

import ipaddress
import logging
import smtplib
import socket
import ssl
import zlib
from dataclasses import dataclass
from typing import Any, Callable, Mapping, NamedTuple

import httpx
from starlette.concurrency import run_in_threadpool

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


def validate_mcp_destination(
    url: str,
    *,
    resolver: Callable[[str, int], list[str]] | None = None,
) -> PinnedDestination:
    """Phase 206 (D-206-04 / T-206-01) — Validate remote MCP server destination against SSRF.

    Enforces HTTPS (rejecting insecure cleartext protocols unless explicit in testing), resolves all
    destination addresses, checks every address against the public address predicate (blocking loopback,
    RFC1918 private subnets, cloud metadata 169.254.169.254, and IPv6 site-local ranges), and returns
    a PinnedDestination triple or raises EgressRefused.
    """
    try:
        parsed = httpx.URL(url)
    except Exception:
        raise _refuse("mcp", "", "host_not_allowed", detail="unparseable destination") from None

    scheme = parsed.scheme.lower()
    # WARNING - THIS READ `("https", "http")` UNTIL 2026-08-25 WHILE THE DOCSTRING ABOVE SAID
    # "Enforces HTTPS", AND THE DOCSTRING WAS THE ONE TELLING THE TRUTH ABOUT THE INTENT.
    # Driven: `validate_mcp_destination("http://example.com/mcp")` returned ALLOWED. The MCP
    # credential rides an Authorization header on every single call, so a cleartext scheme
    # puts a live token on the wire at a public host that the SSRF predicate happily permits
    # BECAUSE it is public. Plan criterion 4 (D-206-04) says HTTPS; this is that criterion.
    if scheme != "https":
        raise _refuse("mcp", "", "scheme_not_tls", detail=f"scheme {scheme!r} must be https")

    host = _normalise_host(parsed.host)
    if not host:
        raise _refuse("mcp", "", "host_not_allowed", detail="no host in the destination")

    if not host.isascii():
        raise _refuse("mcp", host, "host_not_ascii", detail="non-ASCII (IDNA) host")

    resolved_port = parsed.port or 443
    resolve = resolver or _default_resolver
    answers = resolve(host, resolved_port)
    if not answers:
        raise _refuse("mcp", host, "unresolvable", detail="host did not resolve")

    for address in answers:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            raise _refuse("mcp", host, "address_not_public", ip=str(address), detail="unparseable address") from None

        reason = refuse_reason(ip)
        if reason is not None:
            raise _refuse("mcp", host, "address_not_public", ip=str(ip), detail=reason)

    return PinnedDestination(ip=answers[0], hostname=host, port=resolved_port, scheme=scheme)



# ══ THE TWO TRANSPORT BINDERS (plan 190-07) ═══════════════════════════════════
#
# D-05: these are the ONLY two places a connector socket is opened. Everything above decides
# WHERE we may connect; everything below is what makes the socket actually go there. The two
# halves are deliberately one module: the same validated triple has to feed httpx and
# smtplib, and smtplib has no transport concept at all — so it is one validator and two thin
# binders, rather than an AsyncHTTPTransport subclass that would make the ordering implicit
# (RESEARCH §R10's recommendation; D-06's whole point is that the ordering is ASSERTABLE).


class EgressResponseTooLarge(Exception):
    """A response exceeded its byte cap, on the wire or after decompression.

    A NAMED type rather than a generic error because a caller must be able to tell "the
    remote sent too much" from "the network failed" — D-17's honest terminal cannot be
    reported from an exception nobody can classify.
    """


class EgressResponseUndecodable(Exception):
    """A response carried a Content-Encoding this module will not expand, or a truncated one.

    Returning still-compressed bytes to an adapter would be a silent wrong answer, and
    expanding an arbitrary encoding is how the cap below stops being a cap.
    """


class PinnedResponse(NamedTuple):
    """``(status_code, headers, body)`` — deliberately UNINTERPRETED.

    ⚠ Do NOT add a ``success`` flag here. Slack returns HTTP 200 with ``{"ok": false}`` on
    failure while Jira uses real status codes, so any shared notion of success flattens a
    difference that is the T13 defect — the single most likely way this phase ships a lie.
    Interpretation belongs to each adapter (190-08/10/11).
    """

    status_code: int
    headers: dict[str, str]
    body: bytes


# Content-Encodings this module will expand, and the zlib window each needs. Anything else is
# refused rather than guessed at.
_DECODER_WBITS: dict[str, int] = {
    "gzip": 16 + zlib.MAX_WBITS,
    "x-gzip": 16 + zlib.MAX_WBITS,
    "deflate": zlib.MAX_WBITS,  # zlib-wrapped; the raw form is retried at -MAX_WBITS below
}


def _decode_bounded(raw: bytes, content_encoding: str | None, max_bytes: int) -> bytes:
    """Expand a response body with the cap applied to the DECOMPRESSED size.

    ⚠ MEASURED, and it is why this exists instead of ``response.aiter_bytes()``: 5 MB of one
    repeated byte gzips to about 5 KB, and httpx delivered the whole 5 MB as a SINGLE decoded
    chunk — so a between-chunks check has already paid for the memory before it runs. Capping
    the wire bytes alone is the classic miss; capping only the decoded stream is unbounded in
    one step. ``zlib.decompressobj().decompress(data, max_length)`` bounds the OUTPUT, which
    is the only version of this that is actually bounded.
    """
    encoding = (content_encoding or "").strip().lower()
    if encoding in ("", "identity"):
        return raw
    if encoding not in _DECODER_WBITS:
        raise EgressResponseUndecodable(
            f"response Content-Encoding {encoding!r} is not one of "
            f"{sorted(_DECODER_WBITS) + ['identity']}"
        )

    def _inflate(wbits: int) -> bytes:
        decompressor = zlib.decompressobj(wbits)
        # max_bytes + 1 so "exactly at the cap" is allowed and "one byte over" is detectable.
        expanded = decompressor.decompress(raw, max_bytes + 1)
        if len(expanded) > max_bytes or decompressor.unconsumed_tail:
            raise EgressResponseTooLarge(
                f"response expanded past the {max_bytes}-byte cap from {len(raw)} wire bytes "
                f"(a decompression bomb expands ~1000:1; the wire size is not the cost)"
            )
        if not decompressor.eof:
            raise EgressResponseUndecodable(
                f"{encoding} body ended mid-stream after {len(expanded)} bytes"
            )
        return expanded

    try:
        return _inflate(_DECODER_WBITS[encoding])
    except zlib.error:
        if encoding != "deflate":
            raise EgressResponseUndecodable(f"{encoding} body did not decode") from None
        # RFC 1950 vs RFC 1951: "deflate" is served both zlib-wrapped and raw in the wild.
        try:
            return _inflate(-zlib.MAX_WBITS)
        except zlib.error:
            raise EgressResponseUndecodable("deflate body did not decode") from None


async def send_pinned_http(
    capability: str,
    method: str,
    url: str,
    *,
    json: Any | None = None,
    headers: Mapping[str, str] | None = None,
    #: Query parameters, encoded by the transport rather than by the caller.
    #:
    #: ⚠ THE ENCODING BELONGS HERE AND NOT IN A CALLER, for a reason the connector
    #: source fence states as a rule: no module under `services/connectors/` may import
    #: `urllib` (or any transport), so a caller that needed one query parameter had to
    #: either hand-roll percent-encoding or trip the fence. Both are worse than this
    #: line. Validation is unaffected — `validate_destination` drops query and fragment
    #: before it looks at anything, so a parameter can never influence the host that was
    #: pinned.
    params: Mapping[str, str] | None = None,
    auth: tuple[str, str] | None = None,
    timeout: float,
    max_bytes: int,
    allowed_host: str | None = None,
    resolver: Callable[[str, int], list[str]] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> PinnedResponse:
    """Send ONE request to a validated destination, pinned to the validated address.

    THE SEQUENCE IS THE SECURITY PROPERTY (D-07): validate once, rewrite the URL to the IP
    literal so the connection cannot re-resolve, restore the TLS/HTTP identity by name, refuse
    redirects explicitly, and read the body under a cap that survives compression.

    ``transport`` is a test seam with a production default of ``None`` — the same shape as
    ``validate_destination``'s ``resolver``, and for the same reason: a binder exercisable
    only against the live internet is a binder that is untested in CI.
    """
    # ── 1 · validate FIRST; a refusal propagates as EgressRefused and is never swallowed ──
    # D-06: this runs before any credential is touched. `auth` arrives already resolved, but
    # nothing here reads it, and a refusal below never reaches the transport at all.
    #
    # ⚠ CR-04 / D-v2.5-01 — THE VALIDATION RUNS OFF THE EVENT LOOP, and the reason is the DNS
    # lookup inside it, not the validation. `_default_resolver` calls `socket.getaddrinfo`,
    # which is a BLOCKING libc call, and this function is `async def` — so before this wrapper
    # the resolution ran on the event loop thread. `timeout=` does NOT bound it: the timeout
    # goes to the transport, not to `getaddrinfo`, so a blackholed nameserver blocks for the
    # OS resolver's own budget (glibc `timeout:5 attempts:2` per nameserver — tens of seconds)
    # with no application-level cap anywhere. The docstring below cites SEED-065's measurement
    # of what that costs: *"a sync HTTP call left on the event loop froze ALL request serving
    # for the round trip."*
    #
    # `validate_destination` stays a plain `def` and a plain module attribute, deliberately:
    # the D-06 ordering fence installs recording stubs with `monkeypatch.setattr`, and making
    # it a coroutine or hiding it behind a wrapper name would make that ordering unobservable
    # — the exact shape RESEARCH §R10 rejected.
    pinned = await run_in_threadpool(
        validate_destination, capability, url, None,
        allowed_host=allowed_host, resolver=resolver,
    )

    # ── 2 · rewrite the URL to the IP literal (D-07 step 5) ──
    # This single line is the DNS-rebinding TOCTOU fix: the TCP connection goes to the address
    # that was validated, not to whatever the next DNS answer says. httpx brackets IPv6 for us.
    target = httpx.URL(url).copy_with(host=pinned.ip)

    # ── 3 · restore the identity the pin would otherwise cost us ──
    # A pin that loses SNI silently points certificate HOSTNAME verification at an address no
    # certificate carries, which is a worse bug than the one being fixed.
    outgoing: dict[str, str] = {
        # Asking for an unencoded body shrinks the decompression-bomb surface to servers that
        # ignore the request; _decode_bounded handles the ones that do.
        "Accept-Encoding": "identity",
        **{str(k): str(v) for k, v in (headers or {}).items()},
        "Host": pinned.hostname,
    }

    explicit_timeout = httpx.Timeout(timeout)
    async with httpx.AsyncClient(
        transport=transport,
        timeout=explicit_timeout,
        # trust_env=False is a SECURITY setting, not tidiness: an HTTPS_PROXY in the
        # environment would route this connection through a host nothing validated, and the
        # pin would be silently worthless while every test still passed.
        trust_env=False,
        follow_redirects=False,
    ) as client:
        request = client.build_request(
            method,
            target,
            json=json,
            params=dict(params) if params else None,
            headers=outgoing,
            timeout=explicit_timeout,
        )
        # RESIDUAL-190-01 (a): httpcore reads this extension and passes it straight into
        # start_tls(server_hostname=...), independently of the host used for the TCP
        # connection. Measured present in this venv (httpx 0.28.1):
        #   'sni_hostname' in inspect.getsource(httpcore._async.connection) -> True
        # It is an httpcore internal convention, not a versioned public API; the fence in
        # tests/unit/test_190_residual_fence.py is what makes its removal loud.
        request.extensions["sni_hostname"] = pinned.hostname

        # follow_redirects=False is set EXPLICITLY even though it is already the httpx
        # default: D-07 step 4 is a security property, and a default is not a guarantee. A
        # 30x to 169.254.169.254 is the classic post-validation bypass.
        response = await client.send(
            request, auth=auth, follow_redirects=False, stream=True
        )
        try:
            if 300 <= response.status_code < 400:
                # The raise site for the `redirected` code 190-02 declared. Returning the 30x
                # to the adapter instead would leave the bypass one adapter line away.
                location_host = ""
                try:
                    location_host = httpx.URL(response.headers.get("location", "")).host
                except Exception:  # noqa: BLE001 — an unparseable Location is still a refusal
                    location_host = "<unparseable>"
                raise _refuse(
                    capability,
                    pinned.hostname,
                    "redirected",
                    detail=f"{response.status_code} to host {location_host!r}",
                )

            # A declared over-cap length fails before a single body byte is read.
            declared = response.headers.get("content-length")
            if declared is not None:
                try:
                    if int(declared) > max_bytes:
                        raise EgressResponseTooLarge(
                            f"response declares {int(declared)} bytes, over the "
                            f"{max_bytes}-byte cap"
                        )
                except ValueError:
                    pass  # an unparseable length is not a permission; the stream cap follows

            # aiter_raw, not aiter_bytes: the wire bytes are capped here and the decompressed
            # bytes are capped in _decode_bounded. Both, because either alone has a hole.
            wire = bytearray()
            async for chunk in response.aiter_raw():
                wire += chunk
                if len(wire) > max_bytes:
                    raise EgressResponseTooLarge(
                        f"response exceeded the {max_bytes}-byte cap on the wire; the read "
                        "was abandoned rather than buffered"
                    )
            body = _decode_bounded(
                bytes(wire), response.headers.get("content-encoding"), max_bytes
            )
            return PinnedResponse(
                status_code=response.status_code,
                headers=dict(response.headers),
                body=body,
            )
        finally:
            await response.aclose()


# smtps -> implicit TLS on 465; smtp+starttls -> cleartext connect then STARTTLS on 587.
# There is no third entry, and plaintext never reaches here: validate_destination refuses a
# destination whose scheme is not one of these two.
_SMTP_TLS_MODES: dict[str, str] = {
    "smtps": "implicit",
    "smtp+starttls": "starttls",
}


def _open_pinned_smtp_blocking(
    pinned: PinnedDestination, *, timeout: float, tls_mode: str
) -> smtplib.SMTP:
    """The BLOCKING half. Never call this from the event loop — see ``open_pinned_smtp``."""
    context = ssl.create_default_context()  # check_hostname=True, verify_mode=CERT_REQUIRED
    if tls_mode == "implicit":
        # No host argument: a bare construction does NOT connect (measured:
        # `smtplib.SMTP_SSL(timeout=1)._host` -> '').
        client: smtplib.SMTP = smtplib.SMTP_SSL(context=context, timeout=timeout)
    else:
        client = smtplib.SMTP(timeout=timeout)

    # RESIDUAL-190-01 (b) — THE PIN. Both stdlib TLS paths derive the certificate hostname
    # from this attribute (SMTP_SSL._get_socket and SMTP.starttls both call
    # wrap_socket(..., server_hostname=self._host)), and the measured fact that makes pinning
    # work at all is:
    #     '_host' in inspect.getsource(smtplib.SMTP.connect) -> False
    # i.e. connect() uses its host argument for the TCP socket ONLY and never overwrites the
    # identity. That is an implementation detail, not a documented contract, which is exactly
    # why tests/unit/test_190_residual_fence.py asserts it every run.
    # It MUST be set before connect(): SMTP_SSL wraps the socket inside connect().
    client._host = pinned.hostname

    client.connect(pinned.ip, pinned.port)  # TCP to the PINNED address; _host untouched
    if tls_mode == "starttls":
        # starttls() runs EHLO first and re-wraps the live socket with server_hostname=_host.
        client.starttls(context=context)
    return client


async def open_pinned_smtp(
    capability: str,
    host: str,
    port: int | None = None,
    *,
    tls_mode: str | None = None,
    timeout: float,
    allowed_host: str | None = None,
    resolver: Callable[[str, int], list[str]] | None = None,
) -> smtplib.SMTP:
    """Open ONE TLS SMTP session to a validated destination, pinned to the validated address.

    ``host`` carries its TLS scheme (``smtps://`` or ``smtp+starttls://``) because TLS is
    STATED here, never assumed — ``validate_destination`` refuses a bare hostname.

    ⚠ ``smtplib`` IS BLOCKING and ``_exec_external_action`` is ``async def``. SEED-065
    measured what that costs: a sync HTTP call left on the event loop froze ALL request
    serving for the round trip (threadpool 6/200 — blocking, not starvation). The connect
    therefore runs through ``run_in_threadpool`` (D-v2.5-01), and this async entry point is
    the ONLY exported way in, so the blocking half cannot be reached by accident.

    Composition and sending are the SMTP adapter's (190-08): this returns an open session and
    calls no raw-string send API of any kind — a hand-built message bypasses
    ``EmailMessage``'s CR/LF guard, which is the one way header injection reaches the wire
    (RESEARCH §R13). The banned token itself is deliberately NOT written out in this prose:
    the D-05 fence greps for it, and a docstring that names it would trip the grep it is
    describing. (190-06 hit the same criterion-vs-legibility conflict and had to STATE it;
    here the sentence can simply be written so both hold.)
    """
    # ⚠ CR-04 — THE OTHER HALF OF THE SAME FIX, and this is the site where half a fix read
    # exactly like a whole one: the SMTP **connect** below has been wrapped in
    # `run_in_threadpool` since 190-07, while the DNS lookup that PRECEDES it stayed on the
    # event loop. `validate_destination` is `def` and calls `socket.getaddrinfo`; this is
    # `async def`. See the fuller note at `send_pinned_http`.
    #
    # This path is the remotely-triggerable one: `POST /connectors/connections/{id}/check`
    # reaches it on a user HTTP request with no rate limit, so an org admin creating a
    # `send_email` connection pointed at any domain whose authoritative NS drops packets and
    # clicking *Check* twice would park both workers' event loops — stopping every concurrent
    # SSE chat stream on the box. No credential needed, no egress permitted; the guard
    # "working correctly" is what triggered it.
    pinned = await run_in_threadpool(
        validate_destination, capability, host, port,
        allowed_host=allowed_host, resolver=resolver,
    )
    derived = _SMTP_TLS_MODES.get(pinned.scheme)
    if derived is None:
        # Reachable only by calling this binder for an HTTP capability — a programming error,
        # not a destination problem, so it is not an EgressRefused.
        raise ValueError(
            f"open_pinned_smtp cannot serve scheme {pinned.scheme!r} (capability "
            f"{capability!r}); it speaks {sorted(_SMTP_TLS_MODES)}"
        )
    if tls_mode is not None and tls_mode != derived:
        # One source of truth. A tls_mode that disagrees with the validated scheme is how a
        # "smtps://" destination quietly becomes a cleartext session.
        raise ValueError(
            f"tls_mode={tls_mode!r} contradicts the validated scheme {pinned.scheme!r} "
            f"(which means {derived!r}); the scheme decides"
        )
    return await run_in_threadpool(
        _open_pinned_smtp_blocking, pinned, timeout=timeout, tls_mode=derived
    )


__all__ = [
    "REFUSAL_REASONS",
    "EgressRefused",
    "EgressResponseTooLarge",
    "EgressResponseUndecodable",
    "PinnedDestination",
    "PinnedResponse",
    "refuse_reason",
    "validate_destination",
    "send_pinned_http",
    "open_pinned_smtp",
    "ALLOWED_HOST_SUFFIXES",
    "SLACK_API_BASE",
]
