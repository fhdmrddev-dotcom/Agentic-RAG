"""Phase 190 Plan 07 (CONN-03) — the RESIDUAL-190-01 source fence.

RESIDUAL-190-01 — both DNS-pin recipes depend on NON-PUBLIC attributes (research §R10,
whose wording supersedes CONTEXT D-07 step 5's):

    `smtplib.SMTP._host` is a private attribute and `SMTP.connect()`'s non-assignment of it
    is an implementation detail, not a documented contract; `httpcore`'s `sni_hostname`
    request extension is an httpx/httpcore internal convention rather than a versioned
    public API. A CPython or httpx minor upgrade could silently break the pin **while every
    functional test still passes** — the connection would simply re-resolve and still work.

**TRIGGER: any Python or httpx version bump in `requirements.txt`.**

⚠ MEASURED CORRECTION TO THAT TRIGGER, and it makes this file MORE load-bearing rather than
less. `backend/requirements.txt:38` reads `httpx>=0.28.0` — an unpinned upper bound (recorded
there as D-071.3-10, after the Docling rip removed the `<0.29` cap). So an httpx MAJOR-minor
move can land on any fresh install or rebuild **without anybody editing requirements.txt at
all**, and a trigger phrased as "watch for a version bump in requirements.txt" would simply
never fire. What actually protects the pin is that these assertions run on EVERY test run
against the INSTALLED library, not the declared one. The written trigger is kept because it
is the one a human reviewer can act on; this note is why it is not sufficient on its own.

── WHAT HAPPENS WITHOUT THIS FILE, STATED PLAINLY ────────────────────────────────────────
Nothing visible. That is the entire point, and it is why the mitigation had to be a test and
not a sentence in SECURITY.md. Every one of the six binder cases in `test_190_egress.py`
keeps passing when the pin breaks, because they drive a STUBBED transport that never resolves
anything. In production the un-pinned connection re-resolves the hostname and the request
still succeeds — to whatever address the second DNS answer names. A silent un-pinning has no
symptom: no error, no failed test, no log line. It just re-opens the DNS-rebinding TOCTOU
window that `app/security/egress.py` exists to close.

So this file asserts the two library facts the pin is built on, each with its own POSITIVE
CONTROL, because a matcher that can only ever return the answer we want is not a fence:

  (a) `"_host" not in inspect.getsource(smtplib.SMTP.connect)`
      control: the SAME matcher DOES find `_host` in `smtplib.SMTP.__init__`
  (b) `"sni_hostname" in inspect.getsource(httpcore._async.connection)`
      control: the SAME matcher does NOT find an invented token in that same source

── DRIVEN RED (plan 190-07 Task 3) ───────────────────────────────────────────────────────
Both fences were driven against a SIMULATED library change — the accessors below are named
functions precisely so a one-line plant can retarget them — and both went RED:

    PLANT A  _smtp_connect_source() -> inspect.getsource(smtplib.SMTP.__init__)
             (i.e. a future CPython whose connect() DOES assign self._host)
    PLANT B  _httpcore_connection_source() -> ....replace("sni_hostname", "REMOVED")
             (i.e. an httpx upgrade that dropped the request extension)

The verbatim failure text of both is recorded in `190-07-SUMMARY.md`; each turned exactly
its own fence RED with the other four cases still green, and each was restored.

The measured environment when this fence was written (re-derived, never inherited):
httpx 0.28.1, httpcore 1.0.9, CPython 3.12.6.
"""
from __future__ import annotations

import inspect
import smtplib
from pathlib import Path

import httpcore._async.connection

# The two accessors the fences read. They are FUNCTIONS rather than inline expressions so
# that simulating a library change is a one-line, restorable plant — the same plant → observe
# → restore idiom plan 190-02 used against production source.


def _smtp_connect_source() -> str:
    return inspect.getsource(smtplib.SMTP.connect)


def _httpcore_connection_source() -> str:
    return inspect.getsource(httpcore._async.connection)


def test_smtplib_connect_still_does_not_assign_host():
    """The measured fact the SMTP pin is built on: `SMTP.connect()` never touches `_host`.

    `egress._open_pinned_smtp_blocking` sets `client._host = hostname` and then calls
    `client.connect(validated_ip, port)`. If a future `connect()` assigned `self._host = host`
    the way `__init__` does, the certificate would be verified against the IP LITERAL — which
    no certificate carries — and the likely "fix" somebody reaches for is to stop verifying.
    """
    source = _smtp_connect_source()

    # POSITIVE CONTROL FIRST. `__init__` is the method that DOES assign `_host`, so if the
    # matcher cannot find it there, the matcher is inert and the assertion below is theatre.
    assert "_host" in inspect.getsource(smtplib.SMTP.__init__), (
        "the positive control failed: `_host` was not found in smtplib.SMTP.__init__, which "
        "is known to assign it. The matcher is inert, so the real assertion below proves "
        "nothing — fix the matcher before trusting this file."
    )

    assert "_host" not in source, (
        "RESIDUAL-190-01 (b) HAS FIRED: smtplib.SMTP.connect now mentions `_host`. "
        "app/security/egress.py sets `client._host = hostname` BEFORE connect() and relies "
        "on connect() leaving it alone, so the SMTP pin may now be verifying the certificate "
        "against the IP literal instead of the hostname. Re-read RESEARCH §R10 and re-derive "
        "the recipe against this Python version before shipping. Trigger: a Python version "
        "bump in requirements.txt."
    )


def test_httpcore_still_honours_the_sni_hostname_extension():
    """The measured fact the HTTP pin is built on: httpcore reads `sni_hostname`.

    `egress.send_pinned_http` connects to the validated IP and restores the TLS identity with
    `request.extensions["sni_hostname"]`. httpcore passes that value straight into
    `start_tls(server_hostname=...)`, independently of the host used for the TCP connection.
    Remove the extension and the pin still WORKS — it just verifies the certificate against
    an address. That is the silent failure this file exists to make loud.
    """
    source = _httpcore_connection_source()

    # POSITIVE CONTROL: the same matcher over the same source must NOT find a token that was
    # never there. Without it, a matcher that returns True for everything passes forever.
    invented = "sni_hostname_190_07_TOKEN_THAT_WAS_NEVER_IN_HTTPCORE"
    assert invented not in source, (
        "the positive control failed: an invented token was 'found' in the httpcore source, "
        "so the containment matcher is meaningless and the assertion below proves nothing"
    )

    assert "sni_hostname" in source, (
        "RESIDUAL-190-01 (a) HAS FIRED: httpcore no longer reads the `sni_hostname` request "
        "extension. app/security/egress.py connects to a validated IP LITERAL and relies on "
        "that extension for SNI and certificate hostname verification, so TLS identity "
        "checking may now be pointed at an address no certificate carries. Re-derive the "
        "recipe (RESEARCH §R10) against this httpx version before shipping. Trigger: an "
        "httpx version bump in requirements.txt."
    )


# ── D-05: one module owns one dangerous thing ─────────────────────────────────
# `send_pinned_http` and `open_pinned_smtp` are the ONLY two places a connector socket is
# opened. The STANDING fence over `backend/app/services/connectors/**` belongs to plan 190-14
# (`test_190_connector_source_fence.py`); what is fenced HERE is the half this plan can
# actually falsify today — that egress.py opens the sockets and composes no messages, and
# that the banned-token matcher is not inert.

_BANNED_IN_ADAPTERS = (
    "httpx.",
    "requests.",
    "smtplib.",
    "urllib.request",
    "socket.",
    ".sendmail(",
)


def test_the_banned_token_matcher_is_not_inert():
    """The positive control for the fence below, kept as its own case so it cannot be skipped.

    190-02 shipped a source fence that was INERT and only its positive control caught it (it
    stripped `#` comments textually, and a docstring is a string literal, not a comment). A
    scanner is worth exactly what its control proves.
    """
    planted = (
        "import httpx\n"
        "import requests\n"
        "import smtplib\n"
        "import urllib.request\n"
        "import socket\n"
        "def go():\n"
        "    httpx.AsyncClient()\n"
        "    requests.post('x')\n"
        "    smtplib.SMTP_SSL()\n"
        "    urllib.request.urlopen('x')\n"
        "    socket.create_connection(('h', 1))\n"
        "    server.sendmail(f, t, raw)\n"
    )
    missed = [token for token in _BANNED_IN_ADAPTERS if token not in planted]
    assert not missed, (
        f"the matcher missed {missed} in a source that contains every one of them — it would "
        "have reported a planted direct client as clean"
    )


def test_no_connector_adapter_constructs_its_own_client():
    """D-05, over whatever of the connectors package exists at this commit.

    ⚠ NON-VACUITY IS STATED, NOT ASSUMED. When the package does not exist yet this test
    asserts THAT, naming the plan that creates it — a fence that silently scans zero files and
    reports success is the failure mode, not the success case.
    """
    connectors = Path(__file__).resolve().parents[2] / "app" / "services" / "connectors"
    if not connectors.exists():
        # Measured at plan 190-07: the adapters are 190-08 / 190-10 / 190-11. The standing
        # fence lands with them (190-14). This branch is a dated statement of fact, and it
        # stops being taken the moment the directory appears.
        assert not connectors.exists(), "unreachable"
        return

    offenders: list[str] = []
    scanned = 0
    for path in sorted(connectors.rglob("*.py")):
        scanned += 1
        source = path.read_text(encoding="utf-8")
        for token in _BANNED_IN_ADAPTERS:
            if token in source:
                offenders.append(f"{path.name}: {token}")
    assert scanned > 0, "the connectors package exists but contains no python files to scan"
    assert not offenders, (
        f"D-05 violated — a connector adapter opens its own socket: {offenders}. Every "
        "connector socket comes from app/security/egress.py; an adapter with its own client "
        "has no IP pin, no redirect refusal, no size cap and no audit line."
    )


def test_egress_composes_no_message_and_is_the_only_socket_owner():
    """egress.py opens sockets; it does not compose or send mail.

    RESEARCH §R13: the defence against SMTP header injection is ARCHITECTURAL, not a regex —
    `EmailMessage` already raises `ValueError` on CR/LF in a header value, and the ONLY way
    that guard is bypassed is a hand-built raw string handed to the raw-string send API. The
    binder returns an OPEN SESSION and stops there; composition is the adapter's (190-08).
    """
    egress_path = Path(__file__).resolve().parents[2] / "app" / "security" / "egress.py"
    source = egress_path.read_text(encoding="utf-8")

    assert ".sendmail(" not in source, (
        "egress.py calls the raw-string send API. That bypasses EmailMessage's CR/LF header "
        "guard entirely and is the one path by which SMTP header injection reaches the wire."
    )
    for binder in ("def send_pinned_http", "async def open_pinned_smtp"):
        assert binder in source, f"{binder} is missing from egress.py — D-05's single home"
