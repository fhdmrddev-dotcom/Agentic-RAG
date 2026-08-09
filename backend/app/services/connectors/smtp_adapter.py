"""Phase 190 (CONN-02 / CONN-03) — the ``send_email`` adapter. SMTP, over TLS, once.

── D-05 · THIS FILE CONSTRUCTS NO CLIENT ─────────────────────────────────────────────────
Every socket comes from ``app.security.egress``. The session below arrives already
validated (scheme, allow-listed host, every resolved address checked) and already PINNED to
the address that was validated, with the certificate still verified against the NAME. This
module names no transport module at all — **not even to catch its exceptions**: a failure is
classified by the reply it CARRIES (``smtp_code`` / ``smtp_error`` / ``recipients``), which
is the same information the transport's own exception hierarchy encodes, and it keeps this
file honestly inside the fence rather than technically inside it.

⚠ ``allowed_host=`` IS NOT OPTIONAL on any call below. ``send_email`` is the one capability
whose permitted host is org configuration rather than a code constant, so the validator has
no list of its own to fall back on: omit the keyword and EVERY send is refused
``host_not_allowed``. That is deliberate fail-CLOSED behaviour (190-02 → 190-07's hand-off),
and it is driven both ways by ``test_every_send_passes_allowed_host_to_the_binder``.

── T12 · SMTP HEADER INJECTION, DEFENDED ARCHITECTURALLY (RESEARCH §R13) ─────────────────
A ``\\r\\n`` in a subject is the cheapest complete attack on an email connector: everything
after the CRLF stops being a subject and becomes MORE HEADERS. ``Bcc: attacker@evil.com`` is
the worst version, because a blind copy leaves no trace on the message the intended
recipient receives.

Three properties, and no fourth:

  1. **Compose with ``EmailMessage``; set every header through ``msg[...] = ...``.**
     Measured in this venv (CPython 3.12.6): a ``\\r\\n``, a bare ``\\n`` and a bare ``\\r``
     each raise ``ValueError`` at ``__setitem__``, BEFORE anything is serialised.
     **The stdlib's ``ValueError`` IS the mitigation, and a regular expression over the
     subject would be a WEAKER DUPLICATE** — it re-implements a stronger check, it will
     disagree with that check at some edge, and the next author who does not know why it
     exists will widen it. There is deliberately no such pattern anywhere in this file.
  2. **Never hand a raw string to the transport's raw-string send API.** That call takes a
     string which was never near the guard in (1), so it is the ONE way this attack class
     reaches the wire. Only ``send_message`` is used here, and the banned token is on the
     D-05 fence's list (plan 190-14) as well as being asserted over this file directly.
  3. **Validate ENVELOPE recipients separately.** ``msg["To"]`` is a HEADER; the SMTP
     ``RCPT TO`` envelope is a DIFFERENT CHANNEL, and (1) does not cover it — measured:
     ``msg["To"] = "v@example.com\\x00"`` raises nothing, and neither does
     ``msg["To"] = "v@example.com, attacker@evil.com"``. Each recipient is therefore parsed
     with ``email.utils.parseaddr`` and required to be a single ``local@domain`` with no
     control characters, before composition — and the validated list is passed EXPLICITLY as
     ``to_addrs``, so the envelope carries what was validated rather than whatever the
     header ended up holding.

── D-08 · WHAT A REFUSAL MAY SAY ─────────────────────────────────────────────────────────
A refusal names the offending HEADER or FIELD. It never carries that field's VALUE: the
value is attacker-controlled, so echoing it writes the injected ``Bcc:`` line into every log
that records the exception. It never carries the credential, in any form.

── D-18 · AT MOST ONCE ───────────────────────────────────────────────────────────────────
D-18 forbids retry, backoff, an idempotency key and a queue on this path. A repeated send
with no idempotency key delivers the email twice, and a duplicate is worse than a missing
one on the surface whose whole discipline is not over-claiming. A failed send fails the
phase and halts the run; the human re-runs deliberately.
"""

from __future__ import annotations

import logging
from email.message import EmailMessage
from email.utils import parseaddr
from types import MappingProxyType
from typing import Any, Mapping

from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.models.connector import SendEmailConfig
from app.security.egress import open_pinned_smtp
from app.services.connectors.protocol import (
    AdapterCheckResult,
    AdapterError,
    AdapterResult,
    CredentialLike,
)

logger = logging.getLogger(__name__)

CAPABILITY = "send_email"

#: One bound on the whole conversation. ``open_pinned_smtp`` requires it keyword-only with
#: no default precisely so it cannot be forgotten here.
SMTP_TIMEOUT_SECONDS = 30.0

#: The connection config states its TLS mode; the destination string states the SCHEME, and
#: ``validate_destination`` refuses anything that is not one of these two. Plaintext SMTP has
#: no member here and cannot acquire one by configuration.
_SCHEME_FOR_TLS: dict[str, str] = {
    "implicit": "smtps",          # SMTPS, port 465
    "starttls": "smtp+starttls",  # cleartext connect then STARTTLS, port 587
}

_CONTROL_CHARACTERS = frozenset(chr(code) for code in range(32)) | {chr(127)}


# ── refusals ──────────────────────────────────────────────────────────────────────────────
class SmtpAdapterError(AdapterError):
    """Base for this adapter's NAMED refusals."""


class SmtpConfigInvalid(SmtpAdapterError):
    """The stored connection config is not a valid ``send_email`` config."""


class SmtpArgumentsInvalid(SmtpAdapterError):
    """The argument object does not match ``INPUT_SCHEMA``."""


class SmtpRecipientRefused(SmtpAdapterError):
    """An ENVELOPE recipient is not a single ``local@domain`` (T12 property 3)."""


class SmtpHeaderRefused(SmtpAdapterError):
    """A header value was rejected by the message composer (T12 property 1).

    Carries the header NAME and the composer's own explanation. Never the value.
    """


class SmtpSendFailed(SmtpAdapterError):
    """The server refused the message. Carries its reply line VERBATIM (071-A / §5b)."""


# ── validation ────────────────────────────────────────────────────────────────────────────
def _validated_envelope_recipient(raw: Any) -> str:
    """Return ``raw`` as a single ``local@domain``, or raise ``SmtpRecipientRefused``.

    ⚠ THE RULE IS *"THE PARSER MUST AGREE WITH THE LITERAL INPUT"*, not *"the parser must
    return something"*, and the difference is a real bypass. Measured:
    ``parseaddr("v@ex ample.com")`` returns ``"v@example.com"`` — it SILENTLY REWRITES the
    input into a different, valid address. Accepting the parser's output would mean the
    envelope carries an address the author never typed. Anything the parser has to normalise
    is refused instead.

    The messages below name the FIELD and the CATEGORY of problem, never the value (D-08).
    """
    if not isinstance(raw, str):
        raise SmtpRecipientRefused(
            f"the 'to' recipient must be a string, got {type(raw).__name__}"
        )

    candidate = raw.strip()
    if not candidate:
        raise SmtpRecipientRefused("the 'to' recipient is empty")
    if any(character in _CONTROL_CHARACTERS for character in candidate):
        raise SmtpRecipientRefused(
            "the 'to' recipient contains a control character, which the message composer "
            "does not reject for a NUL and which the envelope must reject on its own"
        )
    if any(character.isspace() for character in candidate):
        raise SmtpRecipientRefused("the 'to' recipient contains whitespace")
    if "," in candidate or ";" in candidate:
        raise SmtpRecipientRefused(
            "the 'to' recipient names more than one address; this capability sends to "
            "exactly one recipient, and a smuggled second address is a blind copy"
        )

    display_name, address = parseaddr(candidate)
    if display_name or address != candidate:
        raise SmtpRecipientRefused(
            "the 'to' recipient is not a bare addr-spec; the address parser disagrees with "
            "the literal input, so accepting it would send to an address that was not typed"
        )

    local_part, separator, domain = address.partition("@")
    if not separator or not local_part or not domain or "@" in domain or "." not in domain:
        raise SmtpRecipientRefused("the 'to' recipient is not a local@domain address")
    return address


def _validated_config(config: Mapping[str, Any]) -> SendEmailConfig:
    """Parse the stored NON-secret config through the shipped ``extra='forbid'`` model.

    The model is the one 190-06 landed, so there is one spelling of what a mail connection
    knows — and it has nowhere to put a password, which is what makes ``config['password']``
    unconstructable rather than merely discouraged.
    """
    try:
        return SendEmailConfig.model_validate(dict(config))
    except ValidationError as exc:
        raise SmtpConfigInvalid(
            f"the stored send_email connection config is not usable: {exc.error_count()} "
            f"problem(s) in fields {sorted({str(e['loc'][0]) for e in exc.errors() if e['loc']})}"
        ) from None


def _validated_text(args: Mapping[str, Any], key: str) -> str:
    value = args.get(key)
    if not isinstance(value, str) or not value.strip():
        raise SmtpArgumentsInvalid(f"'{key}' must be a non-empty string")
    return value


# ── the blocking halves ───────────────────────────────────────────────────────────────────
# ⚠ D-v2.5-01. Everything below this line blocks the calling thread, and this adapter's entry
# points are `async def`. SEED-065 measured what a blocking call left on the event loop costs:
# a sync HTTP call froze ALL request serving for the round trip. The whole conversation —
# authenticate, submit, disconnect — is therefore ONE helper reached through
# `run_in_threadpool`, rather than three separate hops.
def _quit_quietly(session: Any) -> None:
    """Close the session, swallowing anything the close itself raises.

    A failure to say goodbye must never replace the real outcome — neither a delivered
    message reported as an error, nor a server refusal masked by a connection reset.
    """
    try:
        session.quit()
    except Exception:  # noqa: BLE001 - see the docstring; the outcome is already decided
        logger.debug("send_email: the SMTP session did not close cleanly", exc_info=True)


def _deliver_blocking(
    session: Any, message: EmailMessage, *, from_addr: str, to_addrs: list[str],
    username: str, password: str,
) -> dict:
    """Authenticate, submit ONCE, disconnect. Returns the REFUSED-recipient mapping."""
    try:
        session.login(username, password)
        # send_message keeps the composed EmailMessage — and therefore its CR/LF guard — on
        # the path to the wire, and takes the ENVELOPE recipients explicitly so RCPT TO
        # carries the validated list rather than a re-reading of the To header (T12 §2/§3).
        return session.send_message(message, from_addr=from_addr, to_addrs=to_addrs)
    finally:
        _quit_quietly(session)


def _authenticate_blocking(session: Any, username: str, password: str):
    """Authenticate and disconnect. Submits NOTHING — see ``Adapter.check``."""
    try:
        return session.login(username, password)
    finally:
        _quit_quietly(session)


# ── the vendor's own words ────────────────────────────────────────────────────────────────
def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def _provider_words(exc: Exception) -> tuple[int | None, str]:
    """Extract ``(reply_code, verbatim_reply)`` from a transport exception BY SHAPE.

    This module names no transport module, so the exception hierarchy is read through the
    attributes it carries rather than through ``isinstance``: a reply-bearing error exposes
    ``smtp_code`` / ``smtp_error``, and a per-recipient refusal exposes ``recipients``. The
    words are returned VERBATIM — unparaphrased, untranslated, untruncated (071-A, the rule
    UI-SPEC §5b binds). Falling back to ``str(exc)`` is honest: it is still the failure's own
    words, and it is never a message invented on the server's behalf.
    """
    raw_code = getattr(exc, "smtp_code", None)
    code = raw_code if isinstance(raw_code, int) else None

    raw_error = getattr(exc, "smtp_error", None)
    if raw_error is not None:
        return code, _decode(raw_error)

    recipients = getattr(exc, "recipients", None)
    if isinstance(recipients, dict) and recipients:
        return code, _render_refusals(recipients)

    return code, str(exc)


def _render_refusals(refused: Mapping[Any, Any]) -> str:
    """Render a refused-recipient mapping as the server's own reply lines.

    Only the replies are rendered, not the mapping's keys: the reply text already names the
    address where the server chose to name it, and rendering the keys as well would echo a
    user-supplied field into a log for no added information (D-08).
    """
    lines = []
    for entry in refused.values():
        if isinstance(entry, (tuple, list)) and len(entry) == 2:
            lines.append(f"{entry[0]} {_decode(entry[1])}".strip())
        else:
            lines.append(_decode(entry))
    return "; ".join(lines)


# ── the adapter ───────────────────────────────────────────────────────────────────────────
class Adapter:
    """``send_email`` — one message, to one recipient, over TLS, at most once."""

    CAPABILITY: str = CAPABILITY

    #: The thin three, and nothing else (D-32). No CC, no BCC, no attachment, no HTML part:
    #: each is a new outbound surface inside a phase gated on `threats_open: 0`, and a `bcc`
    #: property in particular would hand an author, through configuration, exactly the
    #: capability T12 exists to keep off the wire.
    INPUT_SCHEMA: Mapping[str, Any] = MappingProxyType({
        "type": "object",
        "additionalProperties": False,
        "required": ["to", "subject", "body"],
        "properties": MappingProxyType({
            "to": MappingProxyType({
                "type": "string",
                "description": "A single recipient address, local@domain. Exactly one.",
            }),
            "subject": MappingProxyType({
                "type": "string",
                "description": "The subject line. Plain text; a line break is refused.",
            }),
            "body": MappingProxyType({
                "type": "string",
                "description": "The plain-text message body.",
            }),
        }),
    })

    def _destination(self, config: SendEmailConfig) -> str:
        """``<scheme>://<host>`` — TLS is STATED, never assumed."""
        return f"{_SCHEME_FOR_TLS[config.tls]}://{config.host}"

    def _identity(self, config: SendEmailConfig) -> str:
        """The SMTP login. Falls back to the from-address, which is the common case where a
        provider's username IS the mailbox."""
        return config.username or config.from_address

    async def send(
        self,
        *,
        args: Mapping[str, Any],
        credential: CredentialLike,
        config: Mapping[str, Any],
        capability: str | None = None,
    ) -> AdapterResult:
        """Send one message. Raises a NAMED refusal on anything that is not a delivery."""
        if capability is not None and capability != CAPABILITY:
            raise SmtpArgumentsInvalid(
                f"this adapter performs {CAPABILITY!r}, not {capability!r}"
            )

        settings = _validated_config(config)
        unknown = sorted(set(args) - set(self.INPUT_SCHEMA["properties"]))
        if unknown:
            # Fail CLOSED on an argument nobody declared: an undeclared key is either a
            # mis-wired executor or a field somebody expects to have an effect, and silently
            # dropping it is how a `bcc` argument comes to look supported.
            raise SmtpArgumentsInvalid(f"undeclared argument(s) for send_email: {unknown}")

        # ── T12 property 3 — the ENVELOPE, validated before anything touches a header ──
        recipient = _validated_envelope_recipient(args.get("to"))
        subject = _validated_text(args, "subject")
        body = _validated_text(args, "body")
        sender = _validated_envelope_recipient(settings.from_address)

        # ── T12 property 1 — compose; the composer's ValueError IS the guard ──
        message = EmailMessage()
        for header, value in (("From", sender), ("To", recipient), ("Subject", subject)):
            try:
                message[header] = value
            except ValueError as exc:
                # The composer's own explanation names the problem without quoting the
                # value, so it is safe to surface verbatim (D-08).
                raise SmtpHeaderRefused(
                    f"the {header} header was refused by the message composer: {exc}"
                ) from None
        # A plain-text part only. There is no rendered-markup surface to break out of, which
        # is why nothing is escaped here and why an HTML part is out of scope (D-32) rather
        # than merely unimplemented - `email_provider.ResendProvider` has to escape precisely
        # because it emits markup.
        message.set_content(body)

        # ── the socket, from egress and nowhere else (D-05) ──
        session = await open_pinned_smtp(
            CAPABILITY,
            self._destination(settings),
            settings.port,
            timeout=SMTP_TIMEOUT_SECONDS,
            allowed_host=settings.host,  # NOT optional - without it the guard refuses
        )

        # The plaintext is materialised only now, AFTER the destination cleared the guard —
        # ``ResolvedConnection.secret`` decrypts lazily for exactly this reason, so a run
        # that is refused egress never produces a credential in memory at all (D-06/D-11).
        username = self._identity(settings)
        try:
            refused = await run_in_threadpool(
                _deliver_blocking,
                session,
                message,
                from_addr=sender,
                to_addrs=[recipient],
                username=username,
                password=credential.secret,
            )
        except Exception as exc:  # noqa: BLE001 - a transport boundary: classify by shape
            code, words = _provider_words(exc)
            logger.warning(
                "send_email: the host refused the message (host=%s code=%s)",
                settings.host, code,
            )
            # D-18 - the failure is returned to the caller, never attempted a second time.
            raise SmtpSendFailed(
                f"the mail host refused the message: {words}"
            ) from exc

        if refused:
            # send_message RETURNS the per-recipient refusals rather than raising when some
            # addresses were accepted. Ignoring this value is how a phase reads "Complete"
            # for a message the recipient never received (D-31's named failure condition).
            raise SmtpSendFailed(
                f"the mail host refused the recipient: {_render_refusals(refused)}"
            )

        logger.info(
            "send_email: one message accepted for delivery (host=%s recipients=%d)",
            settings.host, 1,
        )
        return AdapterResult(
            ok=True,
            # No provider message and no reply code, HONESTLY: send_message surfaces only
            # the REFUSED recipients and never the accepting reply, so a `250` here would be
            # a wire fact we invented.
            provider_message="",
            raw_status=None,
            detail=f"accepted for delivery by {settings.host}",
        )

    async def check(
        self,
        *,
        credential: CredentialLike,
        config: Mapping[str, Any],
    ) -> AdapterCheckResult:
        """Connect, authenticate, disconnect. **Submit nothing.**

        UI-SPEC §5c's headline is *"Credential works — and nothing was sent"*, and the second
        clause is asserted at the level it is claimed at: no ``DATA`` verb is issued, which
        is the command that begins a message body
        (``test_check_authenticates_and_issues_no_DATA_command``).

        A refused credential is a RESULT, not an exception: the surface exists to show the
        host's own verdict, and a raise here would turn *"the host rejected this
        credential"* into an internal error.
        """
        settings = _validated_config(config)
        username = self._identity(settings)

        session = await open_pinned_smtp(
            CAPABILITY,
            self._destination(settings),
            settings.port,
            timeout=SMTP_TIMEOUT_SECONDS,
            allowed_host=settings.host,  # NOT optional - without it the guard refuses
        )
        try:
            reply = await run_in_threadpool(
                _authenticate_blocking, session, username, credential.secret
            )
        except Exception as exc:  # noqa: BLE001 - a transport boundary: classify by shape
            code, words = _provider_words(exc)
            logger.info(
                "send_email: credential check failed (host=%s code=%s)", settings.host, code
            )
            return AdapterCheckResult(ok=False, identity=None, provider_message=words)

        _, words = _provider_words_from_reply(reply)
        return AdapterCheckResult(ok=True, identity=username, provider_message=words)


def _provider_words_from_reply(reply: Any) -> tuple[int | None, str]:
    """Render a ``(code, message)`` login reply, verbatim, tolerating a bare value."""
    if isinstance(reply, (tuple, list)) and len(reply) == 2:
        code = reply[0] if isinstance(reply[0], int) else None
        return code, _decode(reply[1])
    return None, _decode(reply) if reply is not None else ""


__all__ = [
    "Adapter",
    "CAPABILITY",
    "SmtpAdapterError",
    "SmtpArgumentsInvalid",
    "SmtpConfigInvalid",
    "SmtpHeaderRefused",
    "SmtpRecipientRefused",
    "SmtpSendFailed",
]
