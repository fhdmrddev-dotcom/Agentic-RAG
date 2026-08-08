"""Phase 190 · VALIDATION row T12 — SMTP header injection, driven.

THE ATTACK: a workflow-composed subject line containing ``\\r\\n``. One CRLF and the rest of
the string stops being a subject and becomes MORE HEADERS — ``Bcc: attacker@evil.com`` is the
cheapest and most complete version, because a blind-copied recipient leaves no trace on the
message the intended recipient sees.

THE DEFENCE IS ARCHITECTURAL, NOT A REGEX (RESEARCH §R13, re-derived in this venv at plan
time — CPython 3.12.6):

    Subject CRLF     RAISED: ValueError -> Header values may not contain linefeed or
                                           carriage return characters
    Subject bare LF  RAISED: ValueError -> (same)
    Subject bare CR  RAISED: ValueError -> (same)
    To CRLF          RAISED: ValueError -> (same)
    Subject NUL      NO RAISE -> 'Renewal\\x00evil'
    To NUL           NO RAISE -> 'v@example.com\\x00'
    To comma list    NO RAISE -> 'v@example.com, attacker@evil.com'

Three properties follow from those seven lines, and every one of them has a case below:

  1. compose with ``email.message.EmailMessage`` and set headers via ``msg[...] = ...`` —
     the stdlib's own ``ValueError`` IS the mitigation;
  2. never hand a raw string to the transport's raw-string send API — that bypasses the
     guard in (1) entirely, and it is the ONLY way this class reaches the wire;
  3. validate ENVELOPE recipients separately, with ``email.utils.parseaddr`` — the last
     three measured lines prove (1) does not cover the envelope at all: a NUL and a
     comma-smuggled second recipient both sail through the header guard.

⚠ **Any mention of a regex in this file refers to THIS FILE'S OWN matcher** (the source
assertion in the last case), never to a production guard. §R13's finding is that a regex over
the subject is the WRONG answer: it duplicates a stronger stdlib check, will disagree with it
at some edge, and can be widened later by someone who does not know why it exists.

⚠ **THE POSITIVE CONTROL IS LOAD-BEARING.** Cases 1–3 are green over an adapter that does
nothing at all. ``test_POSITIVE_CONTROL_…`` builds the same subject into a raw message BY HAND
(in this file, never in production source) and proves the resulting bytes really do carry a
``Bcc:`` line that a parser reads as a real header. Without it, this file measures nothing.
"""

from __future__ import annotations

import hashlib
import inspect
import pathlib
from email import message_from_string
from email.message import EmailMessage
from email.utils import parseaddr

import pytest

# ── the payloads ──────────────────────────────────────────────────────────────
EVIL_SUBJECT_CRLF = "Renewal\r\nBcc: attacker@evil.com"
EVIL_SUBJECT_LF = "Renewal\nBcc: attacker@evil.com"
EVIL_RECIPIENT_CRLF = "victim@example.com\r\nBcc: attacker@evil.com"
# Measured above: the header guard does NOT reject either of these two. They exist to drive
# the envelope path, which is a different channel with a different validator.
EVIL_RECIPIENT_NUL = "victim@example.com\x00"
EVIL_RECIPIENT_COMMA = "victim@example.com, attacker@evil.com"

GOOD_RECIPIENT = "victim@example.com"
GOOD_SUBJECT = "Renewal due"
GOOD_BODY = "Your subscription renews next week."

SMTP_CONFIG = {
    "host": "mail.example.com",
    "port": 465,
    "from_address": "workflows@example.com",
    "username": "workflows@example.com",
    "tls": "implicit",
}

SMTP_PASSWORD_SENTINEL = "smtp-PASSWORD-SENTINEL-MUST-NEVER-BE-LOGGED-190"


class _Credential:
    """The one thing an adapter reads from a resolved connection (``protocol.CredentialLike``).

    A stand-in rather than a real ``ResolvedConnection`` so these cases need no database and
    no encryption key — the adapter's contract is structural on purpose.
    """

    @property
    def secret(self) -> str:
        return SMTP_PASSWORD_SENTINEL


class _RecordingSession:
    """A stand-in for the OPEN session ``egress.open_pinned_smtp`` returns.

    It records the PROTOCOL VERBS each stdlib call would put on the wire, because *"and
    nothing was sent"* (UI-SPEC §5c) is a claim about the wire, not about a Python call.
    ``send_message`` issues ``MAIL FROM`` / ``RCPT TO`` / ``DATA``; ``login`` issues ``AUTH``;
    ``quit`` issues ``QUIT``. **``DATA`` is the verb that starts a message body**, so its
    absence is what the check-sends-nothing case asserts.
    """

    def __init__(self, *, refused: dict | None = None, raise_on_send: Exception | None = None,
                 raise_on_login: Exception | None = None) -> None:
        self.commands: list[str] = []
        self.sent: list[tuple] = []
        self.login_args: tuple | None = None
        self._refused = refused or {}
        self._raise_on_send = raise_on_send
        self._raise_on_login = raise_on_login

    def login(self, user, password):  # noqa: D102
        self.commands.append("AUTH")
        self.login_args = (user, password)
        if self._raise_on_login is not None:
            raise self._raise_on_login
        return (235, b"2.7.0 Authentication successful")

    def send_message(self, msg, from_addr=None, to_addrs=None):  # noqa: D102
        self.commands.extend(["MAIL FROM", "RCPT TO", "DATA"])
        self.sent.append((msg, from_addr, to_addrs))
        if self._raise_on_send is not None:
            raise self._raise_on_send
        return dict(self._refused)

    def quit(self):  # noqa: D102
        self.commands.append("QUIT")
        return (221, b"2.0.0 Bye")

    def close(self):  # noqa: D102
        self.commands.append("CLOSE")


def _adapter():
    """Resolve the module under test, failing with a NAMED message rather than a collection
    error.

    Plans 190-01, 190-02 and 190-07 all recorded the same lesson: a module-scope import of a
    not-yet-written module produces ONE collection error and ZERO named failures, which
    measures the import system rather than the security property. Each case below therefore
    fails on its own, naming what is missing and who owns it — and the ``ModuleNotFoundError``
    text is still carried through verbatim, so the RED is unambiguous.
    """
    try:
        import app.services.connectors.smtp_adapter as module
    except ModuleNotFoundError as exc:  # pragma: no cover - the RED path
        pytest.fail(
            f"{exc} - plan 190-08 owns app/services/connectors/smtp_adapter.py. "
            "T12: the SMTP adapter must compose with EmailMessage, set headers via "
            "msg[...] so the stdlib's ValueError fires on CR/LF, and validate envelope "
            "recipients separately with parseaddr."
        )
    return module


def _install_transport(monkeypatch, session):
    """Replace the adapter's binder with a recorder and return the recorded call list.

    Patching the name IN THE ADAPTER'S OWN NAMESPACE (rather than in ``egress``) is
    deliberate: it also proves the adapter imported the binder rather than building a client,
    which is D-05 asserted by construction as well as by the source fence.
    """
    module = _adapter()
    calls: list[dict] = []

    async def _fake_open_pinned_smtp(capability, host, port=None, **kwargs):
        calls.append({"capability": capability, "host": host, "port": port, **kwargs})
        return session

    monkeypatch.setattr(module, "open_pinned_smtp", _fake_open_pinned_smtp)
    return module, calls


async def _send(module, monkeypatch, *, to=GOOD_RECIPIENT, subject=GOOD_SUBJECT,
                body=GOOD_BODY, session=None, config=None):
    session = session if session is not None else _RecordingSession()
    module, calls = _install_transport(monkeypatch, session)
    result = await module.Adapter().send(
        args={"to": to, "subject": subject, "body": body},
        credential=_Credential(),
        config=dict(config or SMTP_CONFIG),
    )
    return result, session, calls


# ── 1 · a CRLF subject is REFUSED — not stripped, not a 500 ───────────────────
async def test_a_CRLF_in_the_subject_is_REFUSED_not_stripped_and_not_a_500(monkeypatch):
    """The headline T12 case. A SILENT STRIP IS THE WORST OUTCOME and must fail here.

    Three things are asserted, and the second is the one a naive implementation gets wrong:
      - a NAMED adapter refusal is raised (not a bare ``Exception``, not a generic 500-shape);
      - **no message was handed to the transport at all** — a refusal that still sends a
        subject with the injection quietly removed has "handled" nothing, it has silently
        rewritten a user's message;
      - the refusal names the offending HEADER, and NOT its value (D-08): the value is
        attacker-controlled, so putting it in an exception message puts the injected
        ``Bcc:`` line into a log.
    """
    module = _adapter()
    session = _RecordingSession()

    with pytest.raises(module.SmtpHeaderRefused) as excinfo:
        await _send(module, monkeypatch, subject=EVIL_SUBJECT_CRLF, session=session)

    message = str(excinfo.value)
    assert session.sent == [], (
        "T12: a message reached the transport despite the CRLF subject - the header was "
        f"stripped or accepted, not refused. Sent: {session.sent!r}"
    )
    assert "DATA" not in session.commands, (
        f"T12: the DATA verb was issued for a refused message: {session.commands!r}"
    )
    assert "Subject" in message, (
        f"the refusal does not name the offending header: {message!r}"
    )
    assert "attacker@evil.com" not in message and "Bcc" not in message, (
        "D-08: the refusal carries the attacker-controlled header VALUE, which puts the "
        f"injected line into every log that records this exception: {message!r}"
    )
    lowered = message.lower()
    assert "sent" not in lowered or "not sent" in lowered, (
        f"the refusal reads as though the send succeeded: {message!r}"
    )


# ── 2 · a bare LF is the same attack; a guard that only sees CRLF is half a guard ──
async def test_a_bare_LF_in_the_subject_is_also_refused(monkeypatch):
    """§R13 drove BOTH forms. Many hand-rolled guards look for ``\\r\\n`` only, and a bare
    ``\\n`` is accepted by most MTAs as a line terminator all the same."""
    module = _adapter()
    session = _RecordingSession()

    with pytest.raises(module.SmtpHeaderRefused):
        await _send(module, monkeypatch, subject=EVIL_SUBJECT_LF, session=session)

    assert session.sent == [], "a bare-LF subject reached the transport"


# ── 3 · the To HEADER half ────────────────────────────────────────────────────
async def test_a_CRLF_in_a_recipient_is_refused(monkeypatch):
    """The same injection through the recipient field. Refused, and by a NAMED refusal —
    ``SmtpRecipientRefused`` or ``SmtpHeaderRefused`` are both correct answers here, because
    a CR/LF recipient is rejected by the envelope validator AND by the header guard; what is
    not correct is a generic error or a send."""
    module = _adapter()
    session = _RecordingSession()

    with pytest.raises(module.SmtpAdapterError):
        await _send(module, monkeypatch, to=EVIL_RECIPIENT_CRLF, session=session)

    assert session.sent == [], "a CRLF recipient reached the transport"


# ── 4 · THE POSITIVE CONTROL — the attack is real ─────────────────────────────
def test_POSITIVE_CONTROL_a_hand_built_raw_message_WOULD_have_produced_a_Bcc_line():
    """Prove cases 1–3 are measuring something.

    A raw message is built BY HAND here — never in production source — from exactly the
    payload case 1 drives, and the result is asserted to carry a real ``Bcc:`` header. If
    this case ever goes green while asserting the OPPOSITE, cases 1–3 are decoration.

    Two assertions rather than one, because the string half alone is weak: a ``Bcc:``
    substring could be an artefact of how the string was concatenated. The parser half is
    the one that matters — an ordinary RFC-5322 parser, the same class of thing every MTA
    runs, reads ``attacker@evil.com`` as a BLIND COPY recipient of this message.
    """
    raw = (
        f"From: {SMTP_CONFIG['from_address']}\r\n"
        f"To: {GOOD_RECIPIENT}\r\n"
        f"Subject: {EVIL_SUBJECT_CRLF}\r\n"
        "\r\n"
        f"{GOOD_BODY}\r\n"
    )

    assert "\r\nBcc: attacker@evil.com" in raw, (
        "the control does not contain the injected line - the payload or the hand-built "
        "concatenation changed, and cases 1-3 would then be proving nothing"
    )

    parsed = message_from_string(raw)
    assert parsed["Bcc"] == "attacker@evil.com", (
        "an RFC-5322 parser does NOT read the injected line as a Bcc header - the control "
        f"is not demonstrating the attack. Parsed headers: {parsed.items()!r}"
    )
    assert parsed["Subject"] == "Renewal", (
        "the injected message's Subject is not truncated at the CRLF, so this is not the "
        f"attack T12 describes: {parsed['Subject']!r}"
    )

    # And the other half of the control: the SAME payload through EmailMessage raises,
    # which is the mitigation stated as a measurement rather than as a belief.
    guarded = EmailMessage()
    with pytest.raises(ValueError) as excinfo:
        guarded["Subject"] = EVIL_SUBJECT_CRLF
    assert "carriage return" in str(excinfo.value), (
        f"the stdlib guard's message changed: {excinfo.value!r} - re-derive §R13 before "
        "trusting any of this file"
    )


# ── 5 · the ENVELOPE is a different channel from the header ───────────────────
async def test_the_envelope_recipients_are_validated_separately_from_the_header(monkeypatch):
    """``msg["To"]`` is a HEADER. The SMTP ``RCPT TO`` envelope is a DIFFERENT CHANNEL, and
    the stdlib guards only the first of them.

    Measured, and this is why the case exists: ``msg["To"] = "victim@example.com\\x00"``
    raises NOTHING, and ``msg["To"] = "victim@example.com, attacker@evil.com"`` raises
    nothing either. Both are refused here only if the adapter validates envelope recipients
    on their own, with ``parseaddr``, before composition.

    The comma payload is the sharper of the two: ``parseaddr`` on it returns ``('', '')`` and
    ``getaddresses`` returns TWO addresses — so an adapter that passed the raw string to the
    envelope would silently deliver to ``attacker@evil.com`` as well.
    """
    module = _adapter()

    # The header guard genuinely does not cover either payload - assert that here, so the
    # case cannot later be satisfied by the CR/LF guard doing the work by accident.
    for payload in (EVIL_RECIPIENT_NUL, EVIL_RECIPIENT_COMMA):
        probe = EmailMessage()
        probe["To"] = payload  # no raise - this is the point of the case
        assert probe["To"] == payload

    assert parseaddr(EVIL_RECIPIENT_COMMA) == ("", ""), (
        "parseaddr's behaviour on a comma list changed; re-derive before trusting this case"
    )

    for payload in (EVIL_RECIPIENT_NUL, EVIL_RECIPIENT_COMMA):
        session = _RecordingSession()
        with pytest.raises(module.SmtpRecipientRefused) as excinfo:
            await _send(module, monkeypatch, to=payload, session=session)
        assert session.sent == [], f"{payload!r} reached the transport"
        assert "attacker@evil.com" not in str(excinfo.value), (
            "D-08: the refusal echoes the attacker-controlled recipient value"
        )


# ── 6 · the source fence for the raw-string send API ──────────────────────────
def test_the_adapter_source_contains_no_sendmail_call():
    """The banned token, asserted over the adapter's own source WITH its positive control.

    Property (2) of §R13: ``send_message(msg)`` keeps the composed ``EmailMessage`` — and
    therefore its CR/LF guard — on the path to the wire. The raw-string API takes a string
    that was never near that guard, so it is the one call that can put an injected header on
    the wire no matter how careful composition was. This is also the extra token plan 190-14
    adds to the standing D-05 fence.

    The matcher (a plain substring test — deliberately NOT a regex; see the module docstring)
    is proved non-inert against a haystack that contains the token, BEFORE it is trusted
    against one that should not.
    """
    banned = ".sendmail("

    # POSITIVE CONTROL - the matcher fires on a haystack that HAS the token. Without this,
    # a typo in `banned` makes this test green forever while checking nothing.
    for haystack in [
        "smtp.sendmail(sender, [to], raw)",
        "    session.sendmail(f, t, msg.as_string())",
        "client.sendmail(*args)",
    ]:
        assert banned in haystack, (
            f"the banned-token matcher failed to fire on {haystack!r} - the fence below "
            "would pass vacuously"
        )
    # ...and does not fire on the API that is REQUIRED, so the fence cannot be satisfied by
    # banning the safe call too.
    assert banned not in "smtp.send_message(msg, from_addr=f, to_addrs=[t])"

    module = _adapter()
    source = inspect.getsource(module)
    assert banned not in source, (
        "D-05 / T12 property 2: the SMTP adapter contains the raw-string send API. That "
        "call bypasses EmailMessage's CR/LF guard entirely and is the ONLY way header "
        "injection reaches the wire."
    )
    assert "send_message" in source, (
        "the adapter does not call send_message at all - the fence above is vacuous, "
        "because a module that sends nothing trivially contains no banned token"
    )


# ── 7 · check() authenticates and sends NOTHING ───────────────────────────────
async def test_check_authenticates_and_issues_no_DATA_command(monkeypatch):
    """UI-SPEC §5c's headline is *"Credential works — and nothing was sent"*.

    That second clause is only honest if it is PROVED, so it is asserted at the level it is
    claimed at: the wire. ``DATA`` is the verb that begins a message body; if it never goes
    out, no mail was submitted. ``AUTH`` and ``QUIT`` must both be present — a check that
    authenticated nothing would also issue no ``DATA``, and would pass a weaker version of
    this case forever.
    """
    module = _adapter()
    session = _RecordingSession()
    module, calls = _install_transport(monkeypatch, session)

    result = await module.Adapter().check(credential=_Credential(), config=dict(SMTP_CONFIG))

    assert result.ok is True, f"a working credential did not check out: {result!r}"
    assert "AUTH" in session.commands, (
        f"check() authenticated nothing - it proves nothing: {session.commands!r}"
    )
    assert "DATA" not in session.commands, (
        f"§5c: check() issued DATA - something WAS sent: {session.commands!r}"
    )
    assert session.sent == [], f"check() submitted a message: {session.sent!r}"
    assert "QUIT" in session.commands, (
        f"check() left the session open rather than disconnecting: {session.commands!r}"
    )
    assert result.identity == SMTP_CONFIG["username"], (
        "§5c renders 'Authenticated as {identity}'; a check that cannot say WHO it "
        f"authenticated as is half a check: {result!r}"
    )
    assert SMTP_PASSWORD_SENTINEL not in repr(result), (
        "D-08: the credential is printable from the check result"
    )


# ── 8 · THE NON-VACUITY CONTROL — a clean send must actually go ───────────────
async def test_a_clean_send_REACHES_the_transport_with_the_validated_envelope(monkeypatch):
    """Without this case, an adapter that refuses EVERYTHING passes 1, 2, 3, 5 and 7 forever.

    It also pins the two properties that make the header/envelope separation real rather than
    described: the envelope recipient list is passed EXPLICITLY to ``send_message`` (so the
    ``RCPT TO`` channel carries the VALIDATED addresses, not whatever the ``To`` header ended
    up holding), and the destination handed to the binder carries a TLS scheme.
    """
    result, session, calls = await _send(_adapter(), monkeypatch)

    assert result.ok is True, f"a clean send did not succeed: {result!r}"
    assert len(session.sent) == 1, f"expected exactly one submission: {session.sent!r}"
    msg, from_addr, to_addrs = session.sent[0]
    assert to_addrs == [GOOD_RECIPIENT], (
        "the envelope recipients were not passed explicitly - send_message would then "
        f"derive RCPT TO from the headers, which is the channel confusion T12 is about: "
        f"{to_addrs!r}"
    )
    assert from_addr == SMTP_CONFIG["from_address"]
    assert msg["Subject"] == GOOD_SUBJECT
    assert msg.get_content().strip() == GOOD_BODY
    assert msg["Bcc"] is None and msg["Cc"] is None, (
        f"the composed message grew a copy header: {msg.items()!r}"
    )
    assert session.commands.count("DATA") == 1, (
        f"D-18 at-MOST-once: DATA was issued {session.commands.count('DATA')} times"
    )


# ── 9 · allowed_host is not optional — the guard fails CLOSED without it ──────
async def test_every_send_passes_allowed_host_to_the_binder(monkeypatch):
    """190-02 -> 190-07's hand-off, verbatim: *"``send_email`` calls must pass
    ``allowed_host=<the org-configured host>``; without it the guard fails closed and every
    SMTP send is refused."*

    Both halves are driven. First the adapter's recorded call is asserted to carry it — a
    spy, because the guard is stubbed out in these cases and a forgotten keyword would
    otherwise be invisible here and only surface as a total outage in production. Then the
    REAL validator is driven with and without it, proving the omission fails CLOSED rather
    than silently permitting the destination.
    """
    from app.security import egress

    _, _, calls = await _send(_adapter(), monkeypatch)
    assert len(calls) == 1
    assert calls[0]["capability"] == "send_email"
    assert calls[0].get("allowed_host") == SMTP_CONFIG["host"], (
        "the adapter did not pass allowed_host to the binder; every real send would be "
        f"refused host_not_allowed: {calls[0]!r}"
    )
    assert str(calls[0]["host"]).startswith(("smtps://", "smtp+starttls://")), (
        f"the destination handed to the binder states no TLS scheme: {calls[0]['host']!r}"
    )
    assert "timeout" in calls[0], "the binder was called with no timeout"

    def _resolver(hostname, port):
        return ["93.184.216.34"]  # a public address, so only the host rule can refuse

    pinned = egress.validate_destination(
        "send_email", f"smtps://{SMTP_CONFIG['host']}", 465,
        allowed_host=SMTP_CONFIG["host"], resolver=_resolver,
    )
    assert pinned.hostname == SMTP_CONFIG["host"]

    with pytest.raises(egress.EgressRefused) as excinfo:
        egress.validate_destination(
            "send_email", f"smtps://{SMTP_CONFIG['host']}", 465, resolver=_resolver,
        )
    assert excinfo.value.reason_code == "host_not_allowed", (
        "omitting allowed_host did not fail CLOSED - it must refuse, never default to "
        f"permitting the destination: {excinfo.value!r}"
    )


# ── 10 · a send failure is NAMED, VERBATIM, and never retried ─────────────────
async def test_a_send_failure_is_named_carries_the_server_line_verbatim_and_sends_ONCE(
    monkeypatch,
):
    """D-18 is at-MOST-once: a failed send fails the phase and halts the run.

    A retry with no idempotency key double-sends an email, and a duplicate is worse than a
    missing one on the surface whose entire discipline is not over-claiming. The count of
    ``DATA`` verbs is the assertion — one attempt, no second one — and the server's own
    reply line survives to the failure unparaphrased (the 071-A verbatim rule UI-SPEC §5b
    binds).
    """
    module = _adapter()

    class _Refused(Exception):
        """Shaped like the transport's own reply-bearing exception, without importing it."""

        smtp_code = 550
        smtp_error = b"5.1.1 <victim@example.com>: Recipient address rejected"

    session = _RecordingSession(raise_on_send=_Refused())
    with pytest.raises(module.SmtpSendFailed) as excinfo:
        await _send(module, monkeypatch, session=session)

    message = str(excinfo.value)
    assert "5.1.1" in message and "Recipient address rejected" in message, (
        f"the server's reply line did not survive verbatim: {message!r}"
    )
    assert session.commands.count("DATA") == 1, (
        f"D-18: the adapter attempted the send more than once: {session.commands!r}"
    )
    assert SMTP_PASSWORD_SENTINEL not in message, "D-08: the credential is in the failure"


async def test_a_partially_refused_recipient_set_is_a_FAILURE_not_a_success(monkeypatch):
    """``send_message`` RETURNS a dict of refused recipients rather than raising when SOME
    addresses were accepted. An adapter that ignores the return value reports *"Complete"*
    for a message the intended recipient never received — D-31's named failure condition."""
    module = _adapter()
    session = _RecordingSession(refused={GOOD_RECIPIENT: (550, b"5.1.1 User unknown")})

    with pytest.raises(module.SmtpSendFailed) as excinfo:
        await _send(module, monkeypatch, session=session)
    assert "5.1.1 User unknown" in str(excinfo.value)


# ── 11 · the declared contract (borrowed property 2) ──────────────────────────
def test_the_input_schema_is_the_thin_three_and_the_capability_is_declared():
    """``INPUT_SCHEMA`` declares ``to``, ``subject``, ``body`` — and NOTHING else.

    No CC, no BCC, no attachment, no HTML part. Each would be a new outbound surface inside
    a phase gated on ``threats_open: 0`` (D-32), and a ``bcc`` property in particular would
    hand an author the exact capability T12 exists to keep off the wire.
    """
    module = _adapter()
    adapter = module.Adapter()

    assert adapter.CAPABILITY == "send_email"
    assert sorted(adapter.INPUT_SCHEMA["properties"]) == ["body", "subject", "to"], (
        f"the input schema is not the thin three: {sorted(adapter.INPUT_SCHEMA['properties'])!r}"
    )
    assert "bcc" not in adapter.INPUT_SCHEMA["properties"]

    from app.services.connectors.registry import get_adapter

    assert get_adapter("send_email").CAPABILITY == "send_email", (
        "the adapter does not resolve through the registry under its own capability"
    )


def test_the_adapter_file_names_no_transport_and_no_retry():
    """The D-05 banned-token walk over this one file, ahead of plan 190-14's standing fence.

    Its matchers are proved non-inert on a planted haystack first, for the same reason the
    ``.sendmail(`` case does it: a fence whose matcher never fires is a fence that passes
    over anything.
    """
    path = pathlib.Path(inspect.getfile(_adapter()))
    source = path.read_text(encoding="utf-8")
    banned = ("httpx.", "requests.", "smtplib.", "urllib.request", "socket.", ".sendmail(")

    planted = (
        "import httpx\nc = httpx.AsyncClient()\ns = smtplib.SMTP_SSL(h)\n"
        "socket.create_connection((h, p))\nurllib.request.urlopen(u)\nc.sendmail(f, t, raw)\n"
        "import requests\nrequests.post(u)\n"
    )
    for token in banned:
        assert token in planted, f"the banned-token matcher missed {token!r} on the plant"

    hits = [token for token in banned if token in source]
    assert hits == [], (
        f"D-05: {path.name} names a transport directly: {hits!r}. Every connector socket "
        "comes from app.security.egress and nowhere else."
    )

    # D-18 - no retry machinery. Prose citing the decision is allowed and is the ONLY thing
    # allowed, so the check is per-line rather than per-file.
    offending = [
        line.strip()
        for line in source.splitlines()
        if ("retry" in line.lower() or "backoff" in line.lower())
        and "D-18" not in line
    ]
    assert offending == [], (
        f"D-18 forbids retry/backoff in the send path; found: {offending!r}"
    )

    # Recorded so a later plant round can prove its restore was byte-exact (190-07's lesson:
    # hold the bytes, do not rely on a git checkout, which re-applies CRLF on this platform).
    print("smtp_adapter.py LF-normalised md5:",
          hashlib.md5(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest())
