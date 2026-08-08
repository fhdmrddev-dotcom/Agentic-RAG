"""Phase 190 Plan 02 (CONN-03) — the egress destination validator's driven corpus.

THE ARTEFACT HERE IS THE CORPUS, NOT THE PREDICATE. The 185 lesson binds — *a deny-list
cannot be made fail-closed by extension; verify the PROPERTY, not the PATCH* — and RESEARCH
§R14 then found that even the property-shaped predicate ``not ip.is_global`` has **four
measured holes**, each found by driving a case rather than by reasoning:

    224.0.0.1          multicast                       is_global -> True
    64:ff9b::7f00:1    NAT64 (RFC 6052), embeds 127.0.0.1        -> True
    ::ffff:0:7f00:1    IPv4-TRANSLATED (SIIT); ipv4_mapped is None -> True
    fec0::1            IPv6 site-local (deprecated RFC 3879)     -> True

Reproduced independently at plan-02 execution time (a research figure is a claim to
re-derive, never a figure to inherit): the corrected unwrap-then-test predicate scores
**29/29** over ``_IP_CORPUS`` below, and the naive ``not is_global`` predicate misses six of
its addresses across those four classes.

── WHAT THIS FILE FIXES, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────────────
It drives the DESTINATION VALIDATOR half of ``app.security.egress`` only: scheme, host and
every resolved address. The transport binders (the httpx IP pin, the smtplib ``_host`` pin,
redirects, the response-size cap) are plan **190-07**; the ``redirected`` reason code is
asserted present in the closed table here and RAISED there.

── RED OBSERVED (Wave 1, plan 190-02) ───────────────────────────────────────────────────
``cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_egress.py -q``
-> **exit code 2**, before ``app/security/egress.py`` existed:

    =================================== ERRORS ====================================
    _____________ ERROR collecting tests/unit/test_190_egress.py ______________
    ImportError while importing test module 'C:\\Vibe Apps\\Agentic RAG\\backend\\tests\\unit\\test_190_egress.py'.
    Hint: make sure your test modules/packages have valid Python names.
    Traceback:
    C:\\Python312\\Lib\\importlib\\__init__.py:90: in import_module
        return _bootstrap._gcd_import(name[level:], package, level)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    tests\\unit\\test_190_egress.py:66: in <module>
        from app.security.egress import (
    E   ModuleNotFoundError: No module named 'app.security.egress'
    ============================== warnings summary ===============================
    venv\\Lib\\site-packages\\requests\\__init__.py:113

    =========================== short test summary info ===========================
    ERROR tests/unit/test_190_egress.py
    !!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
    1 warning, 1 error in 0.39s

⚠ **That RED measures the import system, not the guard** — it is the weak kind, exactly as
190-01 recorded for its two module-missing drives. The MEANINGFUL REDs for this file are the
six production-source plants in plan 190-02 Task 3, each observed individually with this file
green either side of it. A corpus that only ever passes proves nothing; see
``test_the_corpus_would_notice_a_deleted_unwrap_clause`` for the standing fence.

(Line-number honesty, the 190-01 lesson: pasting a traceback into the file it describes moves
the line it reports. The `:66` above was re-measured to a FIXED POINT: the first observation
read `:65`, adding this very sentence pushed it to `:66`, and re-running after that edit
confirmed `:66 == :66`. Exactly the three-step drift 190-01 recorded, met a second time.)
"""
from __future__ import annotations

import inspect
import ipaddress
import logging

import pytest

from app.security.egress import (
    ALLOWED_HOST_SUFFIXES,
    REFUSAL_REASONS,
    SLACK_API_BASE,
    EgressRefused,
    PinnedDestination,
    refuse_reason,
    validate_destination,
)

# ── the corpus ────────────────────────────────────────────────────────────────
# RESEARCH §R14's driven cases as a module-level TABLE, never inline literals, so a
# shortened corpus is a failing assertion rather than an invisible deletion.
#
# ⚠ MEASURED ADDITION, stated rather than smuggled: the plan enumerates 28 addresses and
# then requires len == 29. The 29th is `::ffff:224.0.0.1`, and it is not filler — it is the
# ONLY address measured to flip REFUSE -> allow when the `ipv4_mapped` clause is deleted.
# (See _UNWRAP_AUDIT_IDENTITY below for why the plan's stated PLANT-1 expectation is false:
# CPython's IPv6Address.is_global ALREADY unwraps IPv4-mapped, so `::ffff:127.0.0.1` keeps
# refusing without our clause. Multicast is the one property CPython does not carry across
# the mapping, because ff00::/8 does not contain ::ffff:e000:1.)
_IP_CORPUS: list[tuple[str, bool, str]] = [
    # ── IPv4, refused ──
    ("169.254.169.254", True, "cloud metadata endpoint (link-local) — the n8n #28218 target"),
    ("127.0.0.1", True, "loopback"),
    ("10.0.0.1", True, "RFC1918 private"),
    ("172.16.0.1", True, "RFC1918 private"),
    ("192.168.1.1", True, "RFC1918 private"),
    ("100.64.0.1", True, "CGNAT (RFC 6598)"),
    ("0.0.0.0", True, "unspecified"),
    ("255.255.255.255", True, "broadcast"),
    ("240.0.0.1", True, "reserved (class E)"),
    ("198.18.0.1", True, "benchmarking (RFC 2544)"),
    ("192.0.0.170", True, "IETF protocol assignment"),
    ("224.0.0.1", True, "multicast — HOLE 1: is_global says True"),
    # ── IPv6, refused ──
    ("::1", True, "loopback"),
    ("::", True, "unspecified"),
    ("fc00::1", True, "unique local (fc00::/7)"),
    ("fe80::1", True, "link-local (fe80::/10)"),
    ("fec0::1", True, "site-local — HOLE 4: deprecated RFC 3879, is_global says True"),
    ("2001:db8::1", True, "documentation (RFC 3849)"),
    # ── IPv4 embedded in IPv6, refused ──
    ("::ffff:127.0.0.1", True, "IPv4-mapped loopback"),
    ("::ffff:169.254.169.254", True, "IPv4-mapped metadata endpoint"),
    ("::ffff:224.0.0.1", True, "IPv4-mapped MULTICAST — the ipv4_mapped clause's own driven case"),
    ("::ffff:0:7f00:1", True, "IPv4-TRANSLATED (SIIT) — HOLE 3: ipv4_mapped returns None"),
    ("64:ff9b::7f00:1", True, "NAT64 embedding 127.0.0.1 — HOLE 2"),
    ("64:ff9b::a9fe:a9fe", True, "NAT64 embedding 169.254.169.254 — HOLE 2"),
    ("2002:7f00:1::1", True, "6to4 embedding 127.0.0.1"),
    # ── allowed: the non-vacuity half. A corpus that refuses everything proves nothing. ──
    ("142.250.185.78", False, "public — google"),
    ("1.1.1.1", False, "public — cloudflare resolver"),
    ("2606:4700:4700::1111", False, "public IPv6 — cloudflare resolver"),
    ("2a00:1450:4001:800::200e", False, "public IPv6 — google"),
]

# The four MEASURED holes, each with the clause that closes it NAMED, so a deleted clause
# names itself in the failure text rather than producing an anonymous corpus regression.
_CLAUSE_CASES: list[tuple[str, str]] = [
    ("the `is_multicast` test in refuse_reason", "224.0.0.1"),
    ("the `is_multicast` test in refuse_reason (IPv6 ff00::/8 form)", "ff02::1"),
    ("the `ipv4_mapped` clause of _unwrap", "::ffff:224.0.0.1"),
    ("the `_NAT64` membership branch of _unwrap", "64:ff9b::7f00:1"),
    ("the `_NAT64` membership branch of _unwrap", "64:ff9b::a9fe:a9fe"),
    ("the `_V4_TRANSLATED` membership branch of _unwrap", "::ffff:0:7f00:1"),
    ("the `_SITE_LOCAL` pre-check in refuse_reason", "fec0::1"),
]

# Every _unwrap clause is load-bearing for the AUDITED ADDRESS even where CPython's is_global
# happens to reach the same verdict. D-08 says a refusal names what was refused; naming
# `::ffff:7f00:1` instead of `127.0.0.1` is a refusal an operator cannot act on. This table is
# what makes the ipv4_mapped / sixtofour / teredo clauses individually falsifiable.
_UNWRAP_AUDIT_IDENTITY: list[tuple[str, str, str]] = [
    ("ipv4_mapped", "::ffff:127.0.0.1", "127.0.0.1"),
    ("ipv4_mapped", "::ffff:169.254.169.254", "169.254.169.254"),
    ("sixtofour", "2002:7f00:1::1", "127.0.0.1"),
    ("sixtofour", "2002:a9fe:a9fe::1", "169.254.169.254"),
    ("teredo", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "192.0.2.45"),
    ("_V4_TRANSLATED", "::ffff:0:7f00:1", "127.0.0.1"),
    ("_NAT64", "64:ff9b::a9fe:a9fe", "169.254.169.254"),
]

# UI-SPEC §4c's closed table. A seventh code is a refusal no sentence renders.
_UI_SPEC_REASON_CODES = {
    "address_not_public",
    "scheme_not_tls",
    "host_not_allowed",
    "host_not_ascii",
    "unresolvable",
    "redirected",
}

# A sentinel that must never reach a message, a repr or a log line (D-08).
SENTINEL_SECRET = "xoxb-190-02-THIS-STRING-MAY-NEVER-APPEAR-IN-A-REFUSAL"

_PUBLIC_IP = "142.250.185.78"


def _resolver(*addresses: str):
    """A stub DNS answer. The guard MUST accept an injected resolver, or the resolve step
    is only testable against the live internet — which makes it untested in CI and therefore
    unfalsifiable, the exact failure this file exists to prevent."""

    def _resolve(hostname: str, port: int) -> list[str]:
        return list(addresses)

    return _resolve


# ── 1 · the corpus itself ─────────────────────────────────────────────────────


def test_the_corpus_is_complete_and_has_both_polarities():
    """Non-vacuity control. A corpus that refuses everything measures nothing."""
    assert len(_IP_CORPUS) == 29, (
        f"the driven corpus is {len(_IP_CORPUS)} addresses, not 29 — RESEARCH §R14's set was "
        "silently shortened, and a shortened corpus is exactly how a hole ships"
    )
    allow = [c for c in _IP_CORPUS if not c[1]]
    refuse = [c for c in _IP_CORPUS if c[1]]
    assert len(allow) >= 4, (
        f"only {len(allow)} ALLOW case(s) — a predicate that returns a refusal for every "
        "input would pass a refuse-only corpus while blocking the whole product"
    )
    assert len(refuse) >= 20, f"only {len(refuse)} REFUSE case(s) — the hole classes are not covered"
    assert len({c[0] for c in _IP_CORPUS}) == len(_IP_CORPUS), "duplicate address in the corpus"


@pytest.mark.parametrize("address,must_refuse,why", _IP_CORPUS, ids=[c[0] for c in _IP_CORPUS])
def test_every_corpus_address_gets_the_right_verdict(address: str, must_refuse: bool, why: str):
    """The 29/29 drive. A refusal is a non-empty STRING (D-08), never a bool."""
    verdict = refuse_reason(ipaddress.ip_address(address))

    if must_refuse:
        assert verdict is not None, f"{address} was ALLOWED but must be refused — {why}"
        assert isinstance(verdict, str), (
            f"{address} refused with {verdict!r} ({type(verdict).__name__}) — D-08 requires an "
            "auditable reason STRING. A bool cannot be written into an audit row a person reads."
        )
        assert verdict.strip(), f"{address} refused with an empty reason — that is a bool wearing a string"
        assert verdict is not True, "a bool is not a reason"
    else:
        assert verdict is None, (
            f"{address} was REFUSED ({verdict!r}) but is a public address — {why}. An "
            "over-refusing guard is not 'safe', it is a product that cannot send anything."
        )


def test_each_of_the_four_unwrap_clauses_is_load_bearing():
    """D-28 — the four MEASURED holes, asserted individually and by clause NAME.

    Deleting any one clause must name itself here, so a falsification round produces a
    pointer to the deleted line rather than an anonymous corpus failure.
    """
    for clause, address in _CLAUSE_CASES:
        verdict = refuse_reason(ipaddress.ip_address(address))
        assert verdict is not None, (
            f"{address} was ALLOWED — {clause} is missing or inert. This is one of the four "
            "holes RESEARCH §R14 measured in a bare `not ip.is_global`; the naive predicate "
            f"reports is_global={ipaddress.ip_address(address).is_global} for it."
        )


def test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper():
    """Every _unwrap clause is load-bearing, and for two of them the property is the REASON.

    ⚠ MEASURED CORRECTION to plan 190-02's PLANT-1 expectation. CPython's
    ``IPv6Address.is_global`` already unwraps IPv4-MAPPED, so deleting our ``ipv4_mapped``
    clause does NOT flip ``::ffff:127.0.0.1`` to allow — it flips what the refusal NAMES
    (``::ffff:7f00:1`` instead of ``127.0.0.1``) and it flips the verdict only for the
    multicast form, ``::ffff:224.0.0.1``. Same for ``sixtofour`` and ``teredo``: the verdict
    survives, the auditability does not. D-08's refusal has to name an address an operator
    can act on, so this IS the property, not a nicety.
    """
    for clause, address, embedded in _UNWRAP_AUDIT_IDENTITY:
        verdict = refuse_reason(ipaddress.ip_address(address))
        assert verdict is not None, f"{address} was allowed — {clause} is gone"
        assert embedded in verdict, (
            f"the refusal for {address} reads {verdict!r} and never names the address actually "
            f"reached, {embedded!r} — the `{clause}` clause of _unwrap is missing. An operator "
            "reading this audit line cannot tell they were pointed at a private host."
        )


# ── 2 · the host tables ───────────────────────────────────────────────────────

# RESEARCH §R15, driven. `h = host.lower().rstrip(".")`, then
# `h == suffix or h.endswith("." + suffix)`. THE LEADING DOT IS THE WHOLE MECHANISM.
_HOST_CASES: list[tuple[str, str, str | None]] = [
    ("post_message", "https://slack.com/api/chat.postMessage", None),
    ("post_message", "https://SLACK.COM/api/", None),
    ("post_message", "https://slack.com./api/", None),
    ("post_message", "https://notslack.com/api/", "host_not_allowed"),
    ("post_message", "https://slack.com.evil.com/api/", "host_not_allowed"),
    ("post_message", "https://api.slack.com/api/", "host_not_allowed"),
    ("create_ticket", "https://acme.atlassian.net/rest/api/3/issue", None),
    ("create_ticket", "https://atlassian.net/rest/api/3/issue", None),
    ("create_ticket", "https://ATLASSIAN.NET/rest/", None),
    ("create_ticket", "https://atlassian.net./rest/", None),
    ("create_ticket", "https://evilatlassian.net/rest/", "host_not_allowed"),
    ("create_ticket", "https://atlassian.net.evil.com/rest/", "host_not_allowed"),
]


@pytest.mark.parametrize(
    "capability,url,expected", _HOST_CASES, ids=[f"{c}-{u}" for c, u, _ in _HOST_CASES]
)
def test_host_matching_is_a_label_boundary_never_a_substring(
    capability: str, url: str, expected: str | None
):
    """§R15 — `notslack.com` and `slack.com.evil.com` are the two traps, and both die on the
    leading dot. `api.slack.com` refuses too: Slack is EXACT-match (D-02), not a suffix."""
    if expected is None:
        pinned = validate_destination(capability, url, resolver=_resolver(_PUBLIC_IP))
        assert isinstance(pinned, PinnedDestination)
    else:
        with pytest.raises(EgressRefused) as excinfo:
            validate_destination(capability, url, resolver=_resolver(_PUBLIC_IP))
        assert excinfo.value.reason_code == expected, (
            f"{url} refused as {excinfo.value.reason_code!r}, expected {expected!r}"
        )


# T14 — the URL-parsing trap that matters more than the matching. Every one of these dies at
# the PARSE, and only because the guard reads `httpx.URL(u).host`.
_PARSED_HOST_CASES: list[tuple[str, str]] = [
    ("https://slack.com@evil.com/api/", "host_not_allowed"),
    ("https://slack.com:443@evil.com/", "host_not_allowed"),
    ("https://evil.com/?x=https://slack.com", "host_not_allowed"),
    ("https://evil.com#slack.com", "host_not_allowed"),
    ("https://slack.com.evil.com/api/", "host_not_allowed"),
    ("https://xn--slck-hoa.com/", "host_not_ascii"),
]


@pytest.mark.parametrize("url,expected", _PARSED_HOST_CASES, ids=[u for u, _ in _PARSED_HOST_CASES])
def test_the_host_comes_from_the_PARSED_url_never_the_raw_string(url: str, expected: str):
    """T14 — userinfo / query / fragment / homograph. A raw-string ``"slack.com" in url``
    accepts the first FOUR of these outright."""
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination("post_message", url, resolver=_resolver(_PUBLIC_IP))
    assert excinfo.value.reason_code == expected, (
        f"{url} refused as {excinfo.value.reason_code!r}, expected {expected!r} — a raw-string "
        "match would have ACCEPTED this, because the allowed suffix genuinely appears in it"
    )


def test_a_non_ascii_host_is_refused_with_its_own_reason_code():
    """§R15's live trap: httpx IDNA-DECODES, so `.host` is `slåck.com`, not the punycode.

    A homograph host would fail the allow-list anyway (the safe direction), but silently —
    and a silent refusal reads to a person as "the address is wrong" rather than "those
    characters can be made to look like another address". UI-SPEC §4c gives it its own row.
    """
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination("post_message", "https://xn--slck-hoa.com/", resolver=_resolver(_PUBLIC_IP))
    assert excinfo.value.reason_code == "host_not_ascii", (
        f"a homograph host refused as {excinfo.value.reason_code!r} — accidental, not designed"
    )


# ── 3 · the scheme table ──────────────────────────────────────────────────────

_SCHEME_CASES: list[tuple[str, str, str | None, str | None]] = [
    ("post_message", "https://slack.com/api/", None, None),
    ("post_message", "http://slack.com/api/", None, "scheme_not_tls"),
    ("create_ticket", "http://acme.atlassian.net/rest/", None, "scheme_not_tls"),
    ("create_ticket", "http://127.0.0.1/rest/", None, "scheme_not_tls"),
    ("create_ticket", "acme.atlassian.net", None, "scheme_not_tls"),
    ("send_email", "smtps://mail.example.com:465", "mail.example.com", None),
    ("send_email", "smtp+starttls://mail.example.com:587", "mail.example.com", None),
    ("send_email", "smtp://mail.example.com:25", "mail.example.com", "scheme_not_tls"),
    ("send_email", "mail.example.com", "mail.example.com", "scheme_not_tls"),
]


@pytest.mark.parametrize(
    "capability,destination,allowed_host,expected",
    _SCHEME_CASES,
    ids=[f"{c}-{d}" for c, d, _, _ in _SCHEME_CASES],
)
def test_plain_http_is_refused_including_for_localhost(
    capability: str, destination: str, allowed_host: str | None, expected: str | None
):
    """D-07 step 1, and the ordering matters: scheme is checked FIRST.

    ``http://127.0.0.1/`` is the explicit no-exception case — it is refused for its SCHEME,
    not for its address, which is why the expected code is `scheme_not_tls` and not
    `address_not_public`. A guard that let localhost through "because it is local" is the
    developer-convenience hole that becomes the production hole.

    A destination with NO scheme is refused too: TLS is STATED, never assumed.
    """
    kwargs = {"resolver": _resolver(_PUBLIC_IP)}
    if allowed_host is not None:
        kwargs["allowed_host"] = allowed_host

    if expected is None:
        assert isinstance(validate_destination(capability, destination, **kwargs), PinnedDestination)
    else:
        with pytest.raises(EgressRefused) as excinfo:
            validate_destination(capability, destination, **kwargs)
        assert excinfo.value.reason_code == expected, (
            f"{destination} refused as {excinfo.value.reason_code!r}, expected {expected!r}"
        )


# ── 4 · the resolve step ──────────────────────────────────────────────────────


def test_every_resolved_address_is_checked_not_just_the_first():
    """D-07 step 3 — EVERY answer. A multi-A-record host with one private answer is the
    cheapest DNS-rebinding-adjacent bypass there is, and checking `answers[0]` misses it."""
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination(
            "create_ticket",
            "https://acme.atlassian.net/rest/",
            resolver=_resolver(_PUBLIC_IP, "127.0.0.1"),
        )
    assert excinfo.value.reason_code == "address_not_public", (
        f"a public-then-private answer set refused as {excinfo.value.reason_code!r} — if this "
        "is not `address_not_public`, only the FIRST answer was validated"
    )


def test_T1_the_cloud_metadata_endpoint_is_refused_by_the_resolve_step():
    """T1 — SSRF via an org-configured host, driven at the exact n8n #28218 address.

    The host allow-list cannot catch this on its own: `169.254.169.254.atlassian.net` style
    tricks aside, an org that legitimately configures its own SMTP host can point it anywhere.
    The resolve step is the only thing standing here.
    """
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination(
            "send_email",
            "smtps://mail.internal.example:465",
            allowed_host="mail.internal.example",
            resolver=_resolver("169.254.169.254"),
        )
    assert excinfo.value.reason_code == "address_not_public"
    assert excinfo.value.host == "mail.internal.example", (
        "D-08: the refusal must name the HOST the person typed, which is the one piece of the "
        f"request they can act on — got {excinfo.value.host!r}"
    )


def test_an_unresolvable_host_is_refused_with_its_own_reason_code():
    """UI-SPEC §4c deliberately words `unresolvable` as a LOOKUP FAILURE, not a refusal — it
    is the one row where the person genuinely made a typo. It still fails closed."""
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination(
            "create_ticket", "https://acme.atlassian.net/rest/", resolver=_resolver()
        )
    assert excinfo.value.reason_code == "unresolvable"


def test_a_permitted_destination_returns_the_pinned_triple():
    """THE NON-VACUITY FLOOR for the whole validator. Without this, every assertion above is
    satisfied by ``def validate_destination(*a, **k): raise EgressRefused(...)``."""
    pinned = validate_destination(
        "post_message", SLACK_API_BASE, resolver=_resolver(_PUBLIC_IP)
    )
    assert isinstance(pinned, PinnedDestination)
    assert pinned.ip == _PUBLIC_IP, f"the pin is {pinned.ip!r}, not the validated address"
    assert pinned.hostname == "slack.com", (
        f"the pinned hostname is {pinned.hostname!r} — 190-07 feeds this to SNI and to "
        "certificate verification, so an IP here silently disables hostname checking"
    )
    assert pinned.port == 443
    assert pinned.scheme == "https"


# ── 5 · the closed table and the D-08 leak fence ──────────────────────────────


def test_the_reason_codes_are_exactly_the_six_the_ui_spec_declares():
    """UI-SPEC §4c is a CLOSED six-row table. A seventh code is a refusal nobody can read,
    and a missing one is a rendered sentence with no producer."""
    assert set(REFUSAL_REASONS) == _UI_SPEC_REASON_CODES, (
        "the guard's reason codes and UI-SPEC §4c's table have drifted.\n"
        f"  in the guard, not in the spec: {sorted(set(REFUSAL_REASONS) - _UI_SPEC_REASON_CODES)}\n"
        f"  in the spec, not in the guard: {sorted(_UI_SPEC_REASON_CODES - set(REFUSAL_REASONS))}"
    )
    assert len(REFUSAL_REASONS) == 6


def test_the_capability_keys_agree_with_the_shipped_closed_set():
    """D-04 — the allow-list is keyed off the SAME closed capability set the rest of the app
    uses. Two spellings are unavoidable (egress.py must not import a service); the agreement
    is therefore MECHANICAL rather than remembered — the `models/harness.py:229-235` rule."""
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    assert set(ALLOWED_HOST_SUFFIXES) == set(EXTERNAL_ACTION_CAPABILITIES), (
        f"egress allow-list keys {sorted(ALLOWED_HOST_SUFFIXES)} != capabilities "
        f"{sorted(EXTERNAL_ACTION_CAPABILITIES)} — a capability with no allow-list entry is a "
        "capability whose destination is unchecked"
    )


def test_an_unknown_capability_fails_CLOSED():
    """A capability that is not in the closed set must be REFUSED, never waved through by a
    `.get(capability, ALLOW_EVERYTHING)` default."""
    with pytest.raises(EgressRefused) as excinfo:
        validate_destination("exfiltrate", "https://slack.com/api/", resolver=_resolver(_PUBLIC_IP))
    assert excinfo.value.reason_code == "host_not_allowed"


def test_a_refusal_never_carries_a_credential(caplog):
    """D-08 — a refusal carries capability, host and reason. Nothing else, ever.

    WITH A POSITIVE CONTROL: the second half proves `caplog` is actually capturing this
    module's logger. Without it, a broken capture makes the sentinel assertion pass forever
    while checking nothing — the same vacuity `test_the_mcp_matcher_actually_matches` exists
    to prevent for the 189 fence.
    """
    with caplog.at_level(logging.DEBUG, logger="app.security.egress"):
        with pytest.raises(EgressRefused) as excinfo:
            validate_destination(
                "send_email",
                f"smtps://mail.internal.example:465?token={SENTINEL_SECRET}",
                allowed_host="mail.internal.example",
                resolver=_resolver("127.0.0.1"),
            )

    exception = excinfo.value
    captured = "\n".join(r.getMessage() for r in caplog.records)

    for surface, text in (("str(exc)", str(exception)), ("repr(exc)", repr(exception)), ("logs", captured)):
        assert SENTINEL_SECRET not in text, (
            f"D-08: the credential sentinel reached {surface}. A refusal is an AUDIT record — it "
            f"is written to disk, shipped to a log aggregator and read by people who are not the "
            f"tenant. Content: {text!r}"
        )

    # The refusal must still be USEFUL — a leak-free message that says nothing is not a win.
    assert exception.reason_code in REFUSAL_REASONS
    assert exception.host == "mail.internal.example"
    assert "mail.internal.example" in str(exception)
    assert "send_email" in str(exception)

    # D-06's wording fence, mirrored from test_190_egress_ordering.py: the refusal must read as
    # a DESTINATION problem, never as a missing credential.
    lowered = str(exception).lower()
    for credential_word in ("credential", "token", "password", "secret", "not configured"):
        assert credential_word not in lowered, (
            f"the refusal reads as {credential_word!r}: {str(exception)!r}"
        )

    # ── the positive control ──
    caplog.clear()
    with caplog.at_level(logging.DEBUG, logger="app.security.egress"):
        logging.getLogger("app.security.egress").warning("control %s", SENTINEL_SECRET)
    control = "\n".join(r.getMessage() for r in caplog.records)
    assert SENTINEL_SECRET in control, (
        "the caplog capture is INERT — it did not even record a line this test emitted itself, "
        "so the assertions above measured nothing at all"
    )


def test_EgressRefused_cannot_be_constructed_with_a_body():
    """D-08, structurally rather than by discipline. Keyword-only, no `**kwargs`: there is no
    parameter a request body, a payload or a secret could be passed through."""
    signature = inspect.signature(EgressRefused.__init__)
    for name, parameter in signature.parameters.items():
        if name == "self":
            continue
        assert parameter.kind is inspect.Parameter.KEYWORD_ONLY, (
            f"EgressRefused.__init__ parameter {name!r} is {parameter.kind.description} — a "
            "positional parameter is one `raise EgressRefused(capability, response.text)` away "
            "from putting a response body in an audit row"
        )
    assert not any(
        p.kind is inspect.Parameter.VAR_KEYWORD for p in signature.parameters.values()
    ), "EgressRefused accepts **kwargs — anything at all can be attached to a refusal"
    assert set(signature.parameters) - {"self"} <= {"reason_code", "host", "ip", "capability"}, (
        f"EgressRefused takes {sorted(set(signature.parameters) - {'self'})} — D-08 permits "
        "capability, host, reason and the refused address, and nothing else"
    )


def test_a_reason_code_outside_the_closed_table_cannot_be_raised():
    """The closed table is enforced at RAISE time, not merely declared. A typo'd code renders
    no sentence at all in UI-SPEC §4c's map — the person sees an empty refusal."""
    with pytest.raises((ValueError, AssertionError, KeyError)):
        raise EgressRefused(reason_code="probably_fine", host="slack.com", capability="post_message")
