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

── RED OBSERVED (Wave 2, plan 190-07 — the two transport binders) ───────────────────────
``cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_egress.py -q``
-> **exit code 1**, before ``send_pinned_http`` / ``open_pinned_smtp`` existed:

    >       send_pinned_http = _require("send_pinned_http")
    tests\\unit\\test_190_egress.py:1039:
    name = 'send_pinned_http'
        def _require(name: str):
            obj = getattr(egress_module, name, None)
    >       assert obj is not None, (
    E       AssertionError: app.security.egress.send_pinned_http does not exist yet - plan
            190-07 owns it. D-05: the two transport binders live in egress.py and NOWHERE
            else; no connector adapter may construct an httpx or smtplib client.
    E       assert None is not None
    tests\\unit\\test_190_egress.py:677: AssertionError
    FAILED tests/unit/test_190_egress.py::test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one
    FAILED tests/unit/test_190_egress.py::test_T2b_the_TLS_identity_survives_the_pin
    FAILED tests/unit/test_190_egress.py::test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed
    FAILED tests/unit/test_190_egress.py::test_T11_an_oversized_response_is_capped_and_fails_cleanly
    FAILED tests/unit/test_190_egress.py::test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size
    FAILED tests/unit/test_190_egress.py::test_every_pinned_call_carries_a_timeout
    6 failed, 71 passed, 1 warning in 0.75s

**This one is NOT the weak kind, and the difference was deliberate** — see the note above
``_require``. Six NAMED failures with the 71 validator cases still green either side of them,
rather than one collection error that would have measured the import system and silenced the
whole file. The MEANINGFUL REDs for the binders are the three production-source plants in
plan 190-07 Task 3 (T2 · T3 · T11), each observed individually.

(Line-number honesty, the 190-01 lesson, met twice here. FIRST: pasting a traceback into the
file it describes moves the line it reports — the first observation read `:65`, adding the
sentence that said so pushed it to `:66`, and re-running confirmed `:66 == :66`. SECOND, and
the more interesting one: Task 3 later added ``test_the_corpus_would_notice_a_deleted_unwrap_clause``
and its `ast`/`textwrap`/`egress_module` imports, so the import now sits at `:74`. The
transcript above is deliberately NOT updated to `:69`. It is a record of an observation that
happened, at the file as it then was; editing it to match today's line would be composing a
traceback nobody ever saw. Convergence applies while the observation is live — after that,
the drift is stated instead.)
"""
from __future__ import annotations

import ast
import gzip
import inspect
import ipaddress
import logging
import smtplib
import textwrap

import httpx
import pytest

from app.security import egress as egress_module
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
# (See _UNWRAP_AUDIT_IDENTITY below for why the plan's stated falsification-1 expectation is false:
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

    ⚠ MEASURED CORRECTION to plan 190-02's falsification-1 expectation. CPython's
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


def _code_of(func) -> str:
    """The function's executable body, with comments AND the docstring removed.

    Via ``ast`` rather than by splitting on `#`: a first attempt at this used the textual
    approach and its own positive control caught it immediately — a docstring is a string
    literal, not a comment, so every clause name survived in the "code" through the prose
    that names them. ``ast.unparse`` cannot make that mistake.
    """
    tree = ast.parse(textwrap.dedent(inspect.getsource(func)))
    body = tree.body[0].body
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        body = body[1:]  # drop the docstring
    return "\n".join(ast.unparse(node) for node in body)


def test_the_corpus_would_notice_a_deleted_unwrap_clause():
    """A standing fence on the falsification discipline itself.

    This is a WEAK fence on its own — it reads source, not behaviour, and a clause could be
    present and inert. Its value is that the four driven REDs recorded in 190-02-SUMMARY.md
    were one-off observations: a future refactor that inlines a clause away, or replaces the
    peel with a single `is_global` call, fails loudly HERE instead of silently widening the
    guard. The behavioural fences above remain the real ones.

    Asserted against CODE, not comments — every clause name also appears in `_unwrap`'s
    docstring and inline notes, so a comment-inclusive check would stay green over a body
    that had been emptied out entirely.
    """
    body = _code_of(egress_module._unwrap)

    # Positive control for the extractor. Both halves matter: prose must be GONE (or the
    # clause names below are being read out of comments), and real code must be PRESENT (or
    # an extractor returning "" would satisfy every `not in` and fail every `in`, which at
    # least fails loudly — but a silent empty body is worth ruling out explicitly).
    assert "Peel every IPv4-embedding form" not in body, (
        "the extractor is inert — it left docstring prose in the 'code', so every assertion "
        "below would pass over a body whose clauses had all been deleted"
    )
    assert "return ip" in body, "the extractor returned no code at all"

    for clause in ("ipv4_mapped", "sixtofour", "teredo", "_NAT64", "_V4_TRANSLATED"):
        assert clause in body, (
            f"`{clause}` no longer appears in _unwrap's CODE. Each clause has a driven RED "
            "recorded in 190-02-SUMMARY.md; removing one re-opens a measured hole."
        )

    assert "_SITE_LOCAL" in _code_of(egress_module.refuse_reason), (
        "the fec0::/10 pre-check is gone from refuse_reason — HOLE 4, and CPython answers "
        "is_global=True for it, so nothing downstream will catch it"
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


# ══ 6 · THE TWO TRANSPORT BINDERS (plan 190-07) ═══════════════════════════════
#
# Everything above decides WHERE we may connect. These six cases decide that the socket
# actually goes there. Validating a hostname and then handing that hostname to the client
# leaves a DNS-rebinding TOCTOU window between the two, and a guard with that window open is
# decoration — the second answer is the one that gets connected to.
#
# Each case is one of VALIDATION.md's falsification rows: T2 (rebinding), T2b (the TLS
# identity the pin must not cost us), T3 (the 30x post-validation bypass), T11 + T11b (the
# size cap on the WIRE and on the DECOMPRESSED body — capping only one of the two is the
# classic miss) and the timeout that keeps a hung server off a worker forever.
#
# ⚠ WHY THE BINDERS ARE RESOLVED AT CALL TIME AND NOT IMPORTED AT MODULE SCOPE.
# A top-level `from app.security.egress import send_pinned_http` produces a COLLECTION error
# before the binders exist: one error, ZERO failing tests, and the 71 validator cases above
# never run at all. Plans 190-01 and 190-02 both recorded that shape as the WEAK kind of RED
# — it measures the import system, not the guard. Resolving through `_require` instead makes
# this plan's RED exactly six NAMED failures ("app.security.egress.send_pinned_http does not
# exist yet") with the corpus green either side of them, which is the shape 190-06 measured
# as the more meaningful one. `_require` also asserts `__all__` membership, so a binder that
# exists but is not exported still fails here rather than in an adapter three plans later.


def _require(name: str):
    """Resolve a 190-07 binder by name, failing with the symbol in the message."""
    obj = getattr(egress_module, name, None)
    assert obj is not None, (
        f"app.security.egress.{name} does not exist yet — plan 190-07 owns it. "
        "D-05: the two transport binders live in egress.py and NOWHERE else; no connector "
        "adapter may construct an httpx or smtplib client."
    )
    assert name in egress_module.__all__, (
        f"{name} exists but is missing from egress.__all__ — an adapter cannot import a name "
        "the module does not publish, which is how a private copy gets written instead"
    )
    return obj


class _RecordingTransport(httpx.AsyncBaseTransport):
    """Records every ``httpx.Request`` that actually reached the transport layer.

    This is the real client path — `build_request` → `client.send` → transport — so the URL
    host recorded here is the host the TCP connection would have been opened to. A stub that
    replaced `send` itself would prove nothing about the pin.
    """

    def __init__(self, responder):
        self.responder = responder
        self.requests: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.responder(request)


class _ChunkStream(httpx.AsyncByteStream):
    """A response body delivered in chunks, counting how many were actually PULLED.

    The count is the load-bearing part: a reader that raises only after buffering the whole
    body has capped the return value while still spending the memory, which is T11's DoS with
    a tidier traceback. ⚠ Measured: a Response built with ``content=`` is already consumed and
    ``aiter_raw()`` raises ``StreamConsumed`` — a stream is required to observe this at all.
    """

    def __init__(self, chunks: list[bytes]):
        self.chunks = chunks
        self.pulled = 0

    async def __aiter__(self):
        for chunk in self.chunks:
            self.pulled += 1
            yield chunk


def _rebinding_resolver(first: str, second: str):
    """DNS rebinding as a fixture: a public answer on call 1, the attacker's on call 2."""
    calls: list[str] = []

    def _resolve(hostname: str, port: int) -> list[str]:
        calls.append(hostname)
        return [first] if len(calls) == 1 else [second]

    return _resolve, calls


_SLACK_POST = SLACK_API_BASE + "chat.postMessage"


async def test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one():
    """T2 — DNS rebinding, as a test rather than as a paragraph.

    The resolver answers with a public address the first time and `127.0.0.1` the second. A
    binder that hands the HOSTNAME to httpx re-resolves at connect time and opens the socket
    to the second answer; a binder that rewrites the URL to the validated IP cannot. The
    plant that turns this RED is `url.copy_with(host=ip)` replaced by the hostname URL.
    """
    send_pinned_http = _require("send_pinned_http")
    resolve, calls = _rebinding_resolver(first=_PUBLIC_IP, second="127.0.0.1")
    transport = _RecordingTransport(
        lambda request: httpx.Response(200, stream=_ChunkStream([b'{"ok":true}']))
    )

    result = await send_pinned_http(
        "post_message",
        "POST",
        _SLACK_POST,
        json={"channel": "C0190"},
        timeout=3.0,
        max_bytes=64_000,
        resolver=resolve,
        transport=transport,
    )

    assert len(transport.requests) == 1, "the binder issued more than one request"
    connected_to = transport.requests[0].url.host
    assert connected_to == _PUBLIC_IP, (
        f"the socket went to {connected_to!r}, not to the VALIDATED call-1 address "
        f"{_PUBLIC_IP!r}. If it reads 'slack.com' the URL was never rewritten and the "
        "connection re-resolves — the rebinding window D-07 step 5 exists to close. The "
        f"second DNS answer this stub would have given is {'127.0.0.1'!r}."
    )
    assert len(calls) == 1, (
        f"the destination was resolved {len(calls)} times. Every resolution after the "
        "validated one is a fresh opportunity for a different answer; the validated address "
        "must travel with the request instead."
    )
    assert result.status_code == 200


async def test_T2b_the_TLS_identity_survives_the_pin():
    """T2b — a pin that loses SNI is a WORSE bug than the one it fixes.

    Connecting to an IP literal without restoring the name means the certificate is verified
    against `142.250.185.78`, which no certificate carries — so either the request fails, or
    (much worse) somebody "fixes" it with `verify=False`. Both transports must therefore
    carry the name independently of the address: httpx via `extensions["sni_hostname"]` plus
    the `Host` header, smtplib via `_host` set BEFORE `connect()` (measured: `SMTP.connect`
    never assigns it, and both TLS paths read it for `server_hostname`).
    """
    send_pinned_http = _require("send_pinned_http")
    open_pinned_smtp = _require("open_pinned_smtp")

    transport = _RecordingTransport(
        lambda request: httpx.Response(200, stream=_ChunkStream([b'{"ok":true}']))
    )
    await send_pinned_http(
        "post_message",
        "POST",
        _SLACK_POST,
        json={"channel": "C0190"},
        timeout=3.0,
        max_bytes=64_000,
        resolver=_resolver(_PUBLIC_IP),
        transport=transport,
    )
    request = transport.requests[0]
    assert request.url.host == _PUBLIC_IP, "the TCP target is not the validated IP"
    assert request.extensions.get("sni_hostname") == "slack.com", (
        f"extensions['sni_hostname'] is {request.extensions.get('sni_hostname')!r}. Without "
        "it httpcore passes the IP literal to start_tls(server_hostname=...) and certificate "
        "HOSTNAME verification is silently pointed at an address instead of a name."
    )
    assert request.headers.get("host") == "slack.com", (
        f"the Host header is {request.headers.get('host')!r} — an IP literal there breaks "
        "virtual hosting and tells the far end we think it is an address"
    )

    # ── the smtplib half of the same property ──
    captured: dict = {}

    class _FakeSMTP_SSL:
        def __init__(self, *args, **kwargs):
            captured["init_args"] = args
            captured["init_kwargs"] = kwargs
            self._host = ""

        def connect(self, host="", port=0, source_address=None):
            # _host is read AT CONNECT TIME on purpose: SMTP_SSL wraps the socket inside
            # connect(), so an assignment made afterwards would be too late and a test that
            # inspected it afterwards would pass over exactly that defect.
            captured["connect"] = (host, port, self._host)
            return (220, b"fake ready")

        def starttls(self, *args, **kwargs):
            captured["starttls"] = kwargs

        def quit(self):
            captured["quit"] = True

    monkey = pytest.MonkeyPatch()
    try:
        monkey.setattr(smtplib, "SMTP_SSL", _FakeSMTP_SSL)
        await open_pinned_smtp(
            "send_email",
            "smtps://mail.example.com",
            465,
            timeout=4.0,
            allowed_host="mail.example.com",
            resolver=_resolver(_PUBLIC_IP),
        )
    finally:
        monkey.undo()

    host_arg, port_arg, host_attr_at_connect = captured["connect"]
    assert host_arg == _PUBLIC_IP, (
        f"smtplib connected to {host_arg!r} instead of the validated address {_PUBLIC_IP!r}"
    )
    assert port_arg == 465
    assert host_attr_at_connect == "mail.example.com", (
        f"_host was {host_attr_at_connect!r} when connect() ran. Both stdlib TLS paths read "
        "self._host for server_hostname, so setting it after connect() verifies the "
        "certificate against an empty name on the implicit-TLS (465) path."
    )


async def test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed():
    """T3 — the classic post-validation bypass: validate slack.com, get 302'd to 169.254.169.254.

    Two independent things are asserted, because either alone is weak. (1) BEHAVIOUR: exactly
    one request reaches the transport, and the caller gets an EgressRefused carrying the
    `redirected` code — the code 190-02 declared and left unraised, whose raise site this plan
    owns. (2) THE RECORDED CALL: `follow_redirects=False` was passed EXPLICITLY. httpx's
    default is already False, so a behavioural assertion alone stays green over a binder that
    passes nothing and would flip the day that default changes. D-07 step 4 is a security
    property, and a default is not a guarantee.
    """
    send_pinned_http = _require("send_pinned_http")

    transport = _RecordingTransport(
        lambda request: httpx.Response(
            302, headers={"Location": "http://169.254.169.254/latest/meta-data/"}
        )
    )
    recorded_send_kwargs: dict = {}
    real_send = httpx.AsyncClient.send

    async def _spy(self, request, **kwargs):
        recorded_send_kwargs.update(kwargs)
        return await real_send(self, request, **kwargs)

    monkey = pytest.MonkeyPatch()
    try:
        monkey.setattr(httpx.AsyncClient, "send", _spy)
        with pytest.raises(EgressRefused) as excinfo:
            await send_pinned_http(
                "post_message",
                "POST",
                _SLACK_POST,
                json={"channel": "C0190"},
                timeout=3.0,
                max_bytes=64_000,
                resolver=_resolver(_PUBLIC_IP),
                transport=transport,
            )
    finally:
        monkey.undo()

    assert len(transport.requests) == 1, (
        f"{len(transport.requests)} requests reached the transport — the redirect was "
        "FOLLOWED, and the second one went to the cloud metadata endpoint"
    )
    assert excinfo.value.reason_code == "redirected", (
        f"a 3xx produced reason_code {excinfo.value.reason_code!r}. Handing a bare 30x back "
        "to an adapter leaves the bypass exactly one adapter line away."
    )
    assert recorded_send_kwargs.get("follow_redirects") is False, (
        f"client.send was called with follow_redirects="
        f"{recorded_send_kwargs.get('follow_redirects')!r} — it must be passed EXPLICITLY, "
        "not inherited from a library default"
    )
    assert "169.254.169.254" not in str(excinfo.value), (
        "the refusal message echoes the redirect target back to the caller"
    )


async def test_T11_an_oversized_response_is_capped_and_fails_cleanly():
    """T11 — an unbounded read is a remote party deciding how much memory a worker spends.

    The stream offers 200 KB in 1 KB chunks with no content-length. The cap is 4 KB. Two
    assertions, and the second is the one with teeth: a named `EgressResponseTooLarge` (not a
    generic Exception a caller cannot distinguish from a network failure), AND the stream was
    abandoned near the cap rather than drained — a reader that buffers everything and then
    raises has capped its return value while still spending the memory.
    """
    send_pinned_http = _require("send_pinned_http")
    too_large = _require("EgressResponseTooLarge")

    stream = _ChunkStream([b"B" * 1024 for _ in range(200)])
    transport = _RecordingTransport(lambda request: httpx.Response(200, stream=stream))

    with pytest.raises(Exception) as excinfo:  # noqa: B017 — the TYPE is the assertion below
        await send_pinned_http(
            "post_message",
            "POST",
            _SLACK_POST,
            json={"channel": "C0190"},
            timeout=3.0,
            max_bytes=4096,
            resolver=_resolver(_PUBLIC_IP),
            transport=transport,
        )

    assert type(excinfo.value) is too_large, (
        f"an oversized body raised {type(excinfo.value).__name__} — a caller cannot tell a "
        "capped read from a transport failure, so it cannot report the phase honestly"
    )
    assert stream.pulled <= 8, (
        f"{stream.pulled} of {len(stream.chunks)} chunks were pulled for a 4096-byte cap — "
        "the whole body was buffered before the cap was applied"
    )
    assert stream.pulled < len(stream.chunks), "the stream was drained to the end"


async def test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size():
    """T11b — capping the WIRE bytes alone is the classic miss.

    5 MB of 'A' compresses to about 5 KB, so a wire cap of 64 KB lets it straight through and
    the decoder does the damage. ⚠ MEASURED in this venv, and it is why the reader cannot
    simply iterate httpx's decoded stream: `aiter_bytes()` delivered the ENTIRE 5 MB as ONE
    chunk, so a between-chunks check has already paid for the memory before it runs.

    The positive control matters as much as the bomb: a small legitimately-gzipped body must
    still decode, or a binder that refuses every compressed response passes this row while
    breaking every real one.
    """
    send_pinned_http = _require("send_pinned_http")
    too_large = _require("EgressResponseTooLarge")

    bomb = gzip.compress(b"A" * (5 * 1024 * 1024))
    assert len(bomb) < 64_000, "the fixture must be UNDER the wire cap or it proves nothing"
    transport = _RecordingTransport(
        lambda request: httpx.Response(
            200,
            headers={"content-encoding": "gzip", "content-type": "application/json"},
            stream=_ChunkStream([bomb[i : i + 1024] for i in range(0, len(bomb), 1024)]),
        )
    )

    with pytest.raises(Exception) as excinfo:  # noqa: B017 — the TYPE is the assertion below
        await send_pinned_http(
            "post_message",
            "POST",
            _SLACK_POST,
            json={"channel": "C0190"},
            timeout=3.0,
            max_bytes=64_000,
            resolver=_resolver(_PUBLIC_IP),
            transport=transport,
        )
    assert type(excinfo.value) is too_large, (
        f"a {len(bomb)}-byte body that expands to 5 MB raised "
        f"{type(excinfo.value).__name__} — the cap is on the wire bytes only"
    )

    # ── POSITIVE CONTROL: the same path must still read an ordinary gzipped body ──
    ok_body = gzip.compress(b'{"ok":true}')
    fine = _RecordingTransport(
        lambda request: httpx.Response(
            200,
            headers={"content-encoding": "gzip", "content-type": "application/json"},
            stream=_ChunkStream([ok_body]),
        )
    )
    result = await send_pinned_http(
        "post_message",
        "POST",
        _SLACK_POST,
        json={"channel": "C0190"},
        timeout=3.0,
        max_bytes=64_000,
        resolver=_resolver(_PUBLIC_IP),
        transport=fine,
    )
    assert result.body == b'{"ok":true}', (
        "the gzip positive control failed to decode — this row would then be green for a "
        "binder that simply refuses every compressed response"
    )


async def test_every_pinned_call_carries_a_timeout():
    """A missing timeout is an unbounded hold on a worker, and it is invisible until the day
    a destination hangs instead of answering.

    Asserted three ways, because each catches a different way of losing it: `timeout` is a
    REQUIRED keyword-only parameter on both binders (a default is how a caller forgets), the
    httpx request actually carries it in `extensions["timeout"]`, and the smtplib
    construction receives it as a keyword.
    """
    send_pinned_http = _require("send_pinned_http")
    open_pinned_smtp = _require("open_pinned_smtp")

    for binder in (send_pinned_http, open_pinned_smtp):
        parameter = inspect.signature(binder).parameters.get("timeout")
        assert parameter is not None, f"{binder.__name__} takes no timeout at all"
        assert parameter.kind is inspect.Parameter.KEYWORD_ONLY, (
            f"{binder.__name__}'s timeout is {parameter.kind.description}; keyword-only keeps "
            "it from being lost in a positional shuffle"
        )
        assert parameter.default is inspect.Parameter.empty, (
            f"{binder.__name__}'s timeout defaults to {parameter.default!r} — a default is a "
            "value nobody chose for a destination nobody predicted"
        )

    transport = _RecordingTransport(
        lambda request: httpx.Response(200, stream=_ChunkStream([b'{"ok":true}']))
    )
    await send_pinned_http(
        "post_message",
        "POST",
        _SLACK_POST,
        json={"channel": "C0190"},
        timeout=7.5,
        max_bytes=64_000,
        resolver=_resolver(_PUBLIC_IP),
        transport=transport,
    )
    recorded_timeout = transport.requests[0].extensions.get("timeout")
    assert recorded_timeout, "the request carries no timeout extension at all"
    assert set(recorded_timeout.values()) == {7.5}, (
        f"the request's timeout extension is {recorded_timeout!r} — connect, read, write and "
        "pool must all be bounded; an unbounded read is the one that hangs"
    )

    captured: dict = {}

    class _FakeSMTP_SSL:
        def __init__(self, *args, **kwargs):
            captured["init_kwargs"] = kwargs
            self._host = ""

        def connect(self, host="", port=0, source_address=None):
            captured["connect"] = (host, port)
            return (220, b"fake ready")

        def starttls(self, *args, **kwargs):
            pass

    monkey = pytest.MonkeyPatch()
    try:
        monkey.setattr(smtplib, "SMTP_SSL", _FakeSMTP_SSL)
        await open_pinned_smtp(
            "send_email",
            "smtps://mail.example.com",
            465,
            timeout=9.0,
            allowed_host="mail.example.com",
            resolver=_resolver(_PUBLIC_IP),
        )
    finally:
        monkey.undo()

    assert captured["init_kwargs"].get("timeout") == 9.0, (
        f"smtplib was constructed with {captured['init_kwargs']!r} — with no timeout, a "
        "socket that never answers holds a threadpool worker until the process restarts"
    )
