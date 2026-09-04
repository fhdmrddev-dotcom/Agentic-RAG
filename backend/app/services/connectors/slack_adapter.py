"""Phase 190 (CONN-02 / CONN-03) — the ``post_message`` adapter. Slack Web API, once.

── D-05 · THIS FILE CONSTRUCTS NO CLIENT ─────────────────────────────────────────────────
Every connection comes from ``app.security.egress``. ``send_pinned_http`` validates the
destination (scheme, allow-listed host, every resolved address), connects to the address it
validated rather than to whatever the next name lookup answers, keeps the certificate
verified against the NAME, refuses redirects outright and caps the reply in both its wire and
its expanded size. This module names no transport module at all — not to build one, not to
catch one's exceptions — and the fence over that is asserted directly against this file in
``tests/unit/test_190_slack_ok_false.py`` ahead of plan 190-14's standing walk.

── ⭐ THE SUCCESS CONTRACT, STATED AS A RULE ──────────────────────────────────────────────
**A Slack send is successful IFF ``status_code == 200`` AND the reply's ``ok`` field is
exactly ``True``.** Everything else is a failure (D-17 → the shipped failure reading).

That rule exists because of a fact Slack's own reference states (RESEARCH §R11, from
docs.slack.dev — *chat.postMessage*):

    Errors return HTTP 200 with a JSON body {"ok": false, "error": "<code>"}.

So the status line carries no information about whether the message was posted. A status-only
check — the shape that is genuinely CORRECT for the ticket vendor, whose errors arrive with
real HTTP status codes — reads ``channel_not_found``, ``not_authed``, ``invalid_auth``,
``missing_scope`` and ``rate_limited`` as SUCCESS here. The observable is a phase reading
*"Complete"* for a send that did not leave the app (D-31), which UI-SPEC §8c names as the
likeliest lie this phase ships. The gate is an IDENTITY comparison against ``True`` and not a
truthiness test, because ``{"ok": "false"}`` is a non-empty string and every truthiness test
in Python says yes to it.

── T13 · WHY THERE IS NO SHARED "INTERPRET THE REPLY" HELPER ──────────────────────────────
The two HTTP vendors this phase speaks to genuinely disagree about what success looks like:
one signals failure with status codes, the other signals it inside a 200. A helper shared
across both adapters would have to pick one contract and be wrong about the other vendor —
RESEARCH § Anti-Patterns names it first on its list, and flattening the difference IS the
defect rather than a tidy-up of it. The seam in ``protocol.py`` therefore declares no such
helper ON PURPOSE (its own docstring says so), this file interprets its own vendor, and
source fences on BOTH sides assert that neither borrows from the other. Do not "de-duplicate"
these two verdict functions; they are not duplicates.

── D-02 · THE DESTINATION IS A CODE CONSTANT, AND THAT IS A SECURITY POSTURE ──────────────
``SLACK_API_BASE`` is read from ``app.security.egress`` rather than re-typed, so there is
exactly ONE spelling of it in the tree. This capability accepts **no URL from anywhere** — not
from the author, not from the step's config, not from the stored connection: ``_endpoint``
below takes the API method name and nothing else, so a destination that could depend on stored
data is unconstructable rather than merely unused. ``PostMessageConfig`` (190-06) carries a
channel and nothing else and is ``extra='forbid'``, so a ``base_url`` key in a stored config
is a REFUSAL rather than an ignored field.

That makes one of the three destinations unforgeable by construction — the cheapest SSRF
posture available, and it gives the egress suite a real negative control. The surface says so
out loud: the Settings row carries a ``fixed`` tag and the form says *"it cannot be pointed
anywhere else, by you or by a workflow."*

⚠ ``allowed_host=`` is deliberately NOT passed to the binder, for the same reason the ticket
adapter omits it: this capability's permitted host is a CODE rule inside the guard
(``egress.ALLOWED_HOST_SUFFIXES["post_message"]``, matched by EXACT equality rather than by
suffix, precisely because there is no user-supplied URL to be lenient about). A per-call host
would hand the guard a second, staler source of truth for something it already knows.

── D-03 / D-08 · THE TOKEN GOES IN THE HEADER, NEVER IN THE BODY ──────────────────────────
Slack also accepts the token as a POST ``token`` parameter. We deliberately do not use it: a
request body is the first thing an integration logs, and the composed workflow text is already
in this one. The static ``xoxb-`` bot token therefore travels in an ``Authorization: Bearer``
header, built here because the vendor requires that exact form — and unlike the ticket
adapter's credential pair there is nothing to encode, so no encoded credential string is
constructed anywhere. A refusal from this file names the FIELD and the vendor's own words, and
never the credential in any form.

── §4d · THE THREE-WORD VOCABULARY, AND WHY IT HAS NO FOURTH MEMBER ───────────────────────
UI-SPEC §4d gives three states, three headings and three next steps, and warns that flattening
them is the single most likely copy defect on this surface:

  * ``refused``     — WE declined to open the connection, for a security property. Raised by
                     the guard as ``EgressRefused`` with one of six authored reason codes, and
                     it PROPAGATES THROUGH THIS FILE UNCHANGED.
  * ``unreachable`` — the address is allowed and nothing answered on it.
  * ``rejected``    — we reached the host and IT said no. **Every ok:false lands here**, and
                     that is the whole point: Slack answered, and what it answered was no.

⚠ ``EgressResponseTooLarge`` and ``EgressResponseUndecodable`` also propagate unchanged,
because neither is a §4d state: the host DID answer, so it is not unreachable, and the answer
was not a refusal of ours.

── D-17 · ZERO NEW RUN-STATUS WORDS ──────────────────────────────────────────────────────
This adapter reports a VERDICT. It does not name a run status, and it must not learn to: the
four outcomes reuse the vocabulary 189 shipped, with no migration on the phases table. A
failed send and the terminal for a step with no connection bound are DIFFERENT states told by
different code, and UI-SPEC §8b requires them to stay distinguishable on three independent
axes — so a source fence asserts the status vocabulary is absent from this file entirely.
(The fence is why the paragraph you are reading spells neither word out; 190-07 recorded the
rule — *when prose in production source would trip the very fence it describes, rewrite the
sentence rather than declare a conflict* — and the same applies to the vendor-neutral name of
the status-line check this file rules out.)

── D-18 · AT MOST ONCE ───────────────────────────────────────────────────────────────────
Automatic re-attempt machinery of every kind is forbidden on this path (D-18): no retry, no
backoff, no queue (D-18 — the fence over this reads per line rather than per file, so every
line naming the forbidden machinery cites the decision). ``rate_limited`` is the code an
author of such a loop reaches for, and it is exactly the one that must not have one: Slack's
endpoint takes no idempotency key at this scope, so a second attempt (D-18) posts a second
message, and a duplicate is worse than a missing one on the surface whose whole discipline is
not over-claiming. A failed post fails the phase and halts the run; the human re-runs
deliberately.
"""

from __future__ import annotations

import json as jsonlib
import logging
from types import MappingProxyType
from typing import Any, Mapping

from pydantic import ValidationError

from app.models.connector import PostMessageConfig
from app.security.egress import (
    SLACK_API_BASE,
    EgressRefused,
    EgressResponseTooLarge,
    EgressResponseUndecodable,
    PinnedResponse,
    send_pinned_http,
)
from app.services.connectors.protocol import (
    AdapterCheckResult,
    AdapterError,
    AdapterResult,
    CredentialLike,
)

logger = logging.getLogger(__name__)

CAPABILITY = "post_message"

#: One bound on the whole exchange, and one on what may be read back. ``send_pinned_http``
#: requires both keyword-only with no default precisely so they cannot be forgotten here.
SLACK_TIMEOUT_SECONDS = 30.0
SLACK_MAX_RESPONSE_BYTES = 256 * 1024

#: §R11's two API methods. The first posts a message; the second files nothing, which is what
#: makes UI-SPEC §5c's *"No message was posted."* an honest closing line rather than a hope.
POST_MESSAGE_METHOD = "chat.postMessage"
AUTH_TEST_METHOD = "auth.test"

#: UI-SPEC §4d's closed three. Declared here rather than imported from the sibling adapter on
#: purpose: the T13 fence forbids this file from borrowing anything from that module, and the
#: vocabulary's real home is UI-SPEC §4d rather than either adapter. A typo'd bucket raises at
#: the raise site instead of rendering an empty heading, exactly as ``EgressRefused`` does for
#: its own codes.
FAILURE_BUCKETS = frozenset({"refused", "unreachable", "rejected"})


# ── refusals ──────────────────────────────────────────────────────────────────────────────
class SlackAdapterError(AdapterError):
    """Base for this adapter's NAMED refusals."""


class SlackConfigInvalid(SlackAdapterError):
    """The stored connection config is not a valid ``post_message`` config.

    ⚠ This is also what a stored ``base_url`` produces (D-02). ``PostMessageConfig`` is
    ``extra='forbid'`` and declares a channel and nothing else, so a URL key in a stored
    config is refused here rather than ignored — an ignored key still describes an intent the
    system silently discards, and the next reader cannot tell which.
    """


class SlackArgumentsInvalid(SlackAdapterError):
    """The argument object does not match ``INPUT_SCHEMA``."""


class SlackUnreachable(SlackAdapterError):
    """Nothing answered. UI-SPEC §4d's *unreachable* — the address is allowed, no reply came.

    Distinct from every reply-bearing failure because the next step a person is offered
    differs: *"the address is allowed — nothing answered on it"* sends them to the network,
    while *"the host rejected this credential"* sends them to the token.
    """


class SlackPostFailed(SlackAdapterError):
    """A post that did not produce a message. Carries the structured result and its bucket.

    It RAISES rather than returning, and it carries an ``AdapterResult`` whose ``ok`` is
    asserted ``False`` at construction, so the payload is the same shape a caller would have
    received on success. A returned falsy verdict is ignorable, and an ignored failure is the
    *"Complete for a send that did not leave the app"* defect (D-31) arriving through the front
    door — which on THIS vendor is the defect the whole plan exists to close.
    """

    def __init__(self, message: str, *, result: AdapterResult, bucket: str) -> None:
        if result.ok:
            raise ValueError("a SlackPostFailed cannot carry an ok=True result")
        if bucket not in FAILURE_BUCKETS:
            raise ValueError(
                f"{bucket!r} is not one of UI-SPEC §4d's three states: {sorted(FAILURE_BUCKETS)}"
            )
        self.result = result
        self.bucket = bucket
        super().__init__(message)


# ── validation ────────────────────────────────────────────────────────────────────────────
def _validated_config(config: Mapping[str, Any]) -> PostMessageConfig:
    """Parse the stored NON-secret config through the shipped ``extra='forbid'`` model.

    One spelling of what a Slack connection knows — a channel — and nowhere to put a token or
    a URL, which is what makes both unconstructable rather than merely discouraged.
    """
    try:
        settings = PostMessageConfig.model_validate(dict(config))
    except ValidationError as exc:
        raise SlackConfigInvalid(
            f"the stored post_message connection config is not usable: {exc.error_count()} "
            f"problem(s) in fields {sorted({str(e['loc'][0]) for e in exc.errors() if e['loc']})}"
        ) from None
    if not settings.default_channel.strip():
        raise SlackConfigInvalid("the stored 'default_channel' is empty")
    return settings


def _validated_text(args: Mapping[str, Any]) -> str:
    """``text`` must be a non-empty string BEFORE anything leaves the app.

    Slack would answer ``no_text`` for an empty one, and a round trip to be told what we
    already knew is a send we should not have attempted.
    """
    value = args.get("text")
    if not isinstance(value, str) or not value.strip():
        raise SlackArgumentsInvalid("'text' must be a non-empty string")
    return value


def _endpoint(method: str) -> str:
    """The API method appended to the CODE-CONSTANT base. It sees no stored data at all.

    ⚠ The signature is the point and a test asserts it: a function that cannot receive config
    is a destination config cannot move. The base is imported from ``app.security.egress`` so
    there is exactly one spelling of it in the tree (D-02).
    """
    return SLACK_API_BASE + method


# ── the vendor's own words ────────────────────────────────────────────────────────────────
def _decoded(body: bytes) -> str:
    return body.decode("utf-8", errors="replace") if body else ""


def _payload(body: bytes) -> dict | None:
    """The reply parsed as a JSON object, or ``None`` when it is not one.

    ``None`` is a real answer rather than an error: a gateway page, an empty body and a bare
    JSON array are all things a caller must tell apart from a Slack reply, and every one of
    them means *"this reply does not say a message was posted"*.
    """
    try:
        parsed = jsonlib.loads(_decoded(body)) if body else None
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _provider_words(payload: dict | None, body: bytes) -> str:
    """The vendor's own words, VERBATIM — unparaphrased, untranslated, untruncated (071-A).

    Slack's failure vocabulary is a single machine-readable CODE, and the code is returned
    EXACTLY as it arrived: no prefix, no sentence built around it, no translation. It is the
    only string a person can search Slack's own documentation for, and a paraphrase beside it
    would be a second truth-teller with a nicer voice.

    ⚠ ``needed`` / ``provided`` (which ``missing_scope`` carries) are deliberately NOT folded
    in here. They are useful and they are logged below, but this field is rendered under a
    *"what the host said, verbatim"* label, and a labelled join of two vendor fields is our
    sentence wearing the vendor's clothes. A reply that is not a Slack envelope falls back to
    its own decoded text, which is still the host's words and never one invented for it.
    """
    if payload is not None:
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error
    return _decoded(body).strip()


def _failure_bucket(status: int | None) -> str:
    """Map a failure onto UI-SPEC §4d's three states. There is no fourth.

    ``None`` means nothing answered → ``unreachable``. Any status at all means the host
    answered and said no → ``rejected``, and on this vendor that includes the 200 that carries
    ``ok: false``, which is the single most important row in this table. A refusal of OURS
    never reaches here: ``EgressRefused`` propagates unchanged with its own authored code.
    """
    return "unreachable" if status is None else "rejected"


def _identity_of(payload: dict | None) -> str | None:
    """WHO the token belongs to, as Slack names it — for §5c's *"Authenticated as {identity}"*.

    Both halves of the vendor's answer are used when both are present, because *which
    workspace* is the half that catches the failure a person cannot otherwise see: a bot token
    that authenticates perfectly against the WRONG workspace is a distinct failure from one
    that does not authenticate, and a green check that cannot name the workspace has not
    established what it claims. Each half is the vendor's own string; only the join is ours.
    """
    if payload is None:
        return None
    user = payload.get("user") or payload.get("bot_id") or payload.get("user_id")
    if not isinstance(user, str) or not user.strip():
        return None
    team = payload.get("team")
    if isinstance(team, str) and team.strip():
        return f"{user.strip()} in {team.strip()}"
    return user.strip()


# ── the one door to the wire ──────────────────────────────────────────────────────────────
async def _request(method_name: str, *, token: str, json: Any | None = None) -> PinnedResponse:
    """One exchange through the egress binder. Interprets NOTHING about the reply.

    The split is deliberate: this function classifies EXCEPTIONS, and each caller interprets
    its own REPLY. A helper that did both would be the shared response checker T13 forbids.

    Three failures propagate unchanged because none of them is a §4d state this adapter may
    describe: ``EgressRefused`` carries its own authored sentence, and the two response-size
    terminals mean the host answered something we would not read.
    """
    return await _send(
        "POST",
        _endpoint(method_name),
        json=json,
        headers={
            # D-08: the credential rides HERE and never in the body. Content-Type is left to
            # the transport library, which sets it from the JSON body it encodes — stating it
            # twice is how the two come to disagree.
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )


async def call_web_api(
    api_method: str,
    *,
    http_method: str,
    token: str,
    params: dict[str, str] | None = None,
    json: Any | None = None,
) -> PinnedResponse:
    """One Slack Web API exchange for an action OTHER than ``post_message``.

    ⚠ **IT LIVES HERE RATHER THAN BESIDE THE TOOL LIST, AND THAT IS THE FENCE TALKING.**
    ``service_tools.py`` owns WHICH actions this service advertises; this module owns HOW
    a Slack request is made. Splitting them the other way would put the line
    ``"Authorization": f"Bearer {token}"`` in a second file, and
    ``test_190_connector_source_fence`` exempts exactly ONE file from the
    credential-encoding ban — this one — because the vendor requires a bearer token in a
    header and a tree-wide ban would have been RED on correct code from its first commit.
    A second home for that string would either need a second exemption or would go red;
    both are worse than one vendor owning its own auth.

    It reuses ``_send``, so the destination is validated and PINNED by the same binder
    ``post_message`` goes through, under the same ``post_message`` egress key whose
    allow-list is ``slack.com``. No host is added by any caller of this function.

    ⚠ It INTERPRETS NOTHING. The reply comes back whole, exactly as ``_request`` returns
    it, because the split this module already documents is that transport classifies
    EXCEPTIONS and each caller interprets its own REPLY.
    """
    return await _send(
        http_method,
        _endpoint(api_method),
        json=json,
        params=params,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )

async def _send(method: str, url: str, **kwargs) -> PinnedResponse:
    """The binder call, with transport failures named. Kept separate so ``_request`` reads as
    one statement and the exception classification has exactly one home."""
    try:
        return await send_pinned_http(
            CAPABILITY,
            method,
            url,
            timeout=SLACK_TIMEOUT_SECONDS,
            max_bytes=SLACK_MAX_RESPONSE_BYTES,
            **kwargs,
        )
    except (EgressRefused, EgressResponseTooLarge, EgressResponseUndecodable):
        raise
    except Exception as exc:  # noqa: BLE001 - a transport boundary; nothing answered
        raise SlackUnreachable(f"nothing answered at the Slack API: {exc}") from exc


# ── the adapter ───────────────────────────────────────────────────────────────────────────
class Adapter:
    """``post_message`` — one message, in one channel, at most once."""

    CAPABILITY: str = CAPABILITY

    #: The thin ONE, and nothing else (D-32). The channel comes from the stored connection,
    #: not from the author. No ``blocks`` and no ``attachments``: both are rich content handed
    #: to a renderer we do not own. No ``username`` / ``icon_emoji``: both need
    #: ``chat:write.customize``, a scope 190 deliberately does not request, and both let a
    #: workflow post under a name it chose.
    INPUT_SCHEMA: Mapping[str, Any] = MappingProxyType({
        "type": "object",
        "additionalProperties": False,
        "required": ["text"],
        "properties": MappingProxyType({
            "text": MappingProxyType({
                "type": "string",
                "description": (
                    "The message body as plain text. The channel is a property of the "
                    "connection, not of the step."
                ),
            }),
        }),
    })

    async def send(
        self,
        *,
        args: Mapping[str, Any],
        credential: CredentialLike,
        config: Mapping[str, Any],
        capability: str | None = None,
    ) -> AdapterResult:
        """Post one message. Raises a NAMED refusal on anything that is not a posted message."""
        if capability is not None and capability != CAPABILITY:
            raise SlackArgumentsInvalid(
                f"this adapter performs {CAPABILITY!r}, not {capability!r}"
            )

        settings = _validated_config(config)
        unknown = sorted(set(args) - set(self.INPUT_SCHEMA["properties"]))
        if unknown:
            # Fail CLOSED on an argument nobody declared: an undeclared key is either a
            # mis-wired executor or a field somebody expects to have an effect, and silently
            # dropping it is how a `blocks` argument comes to look supported.
            raise SlackArgumentsInvalid(f"undeclared argument(s) for post_message: {unknown}")

        channel = settings.default_channel.strip()
        payload = {"channel": channel, "text": _validated_text(args)}

        try:
            response = await _request(
                POST_MESSAGE_METHOD, token=credential.secret, json=payload
            )
        except SlackUnreachable as exc:
            logger.warning("post_message: nothing answered (channel=%s)", channel)
            # D-18 - the failure is surfaced to the caller, never attempted a second time.
            raise SlackPostFailed(
                str(exc),
                result=AdapterResult(
                    ok=False,
                    # No provider message and no status, HONESTLY: nothing answered, so
                    # anything here would be a wire fact we invented.
                    provider_message="",
                    raw_status=None,
                    detail=str(exc),
                ),
                bucket="unreachable",
            ) from exc

        return self._verdict(response, channel)

    def _verdict(self, response: PinnedResponse, channel: str) -> AdapterResult:
        """⭐ Slack's own contract, applied to Slack's own reply. Not shared with any vendor.

        Two gates, and both must hold: the status line must be ``200``, and the reply's ``ok``
        must be exactly ``True``. There is deliberately **no third gate** here, and the
        difference from the ticket adapter is worth stating rather than reading as an
        inconsistency: that vendor's status line says nothing about whether an issue exists, so
        the issue key has to be checked; ``ok: true`` IS this vendor asserting, in its own
        words, that the message posted. Requiring more than the vendor's own assertion would
        start failing sends that actually succeeded, which is the opposite error and just as
        dishonest.
        """
        status = response.status_code
        payload = _payload(response.body)
        words = _provider_words(payload, response.body)

        if status != 200:
            logger.warning(
                "post_message: the host refused the message (channel=%s status=%s)",
                channel, status,
            )
            raise SlackPostFailed(
                f"Slack refused the message: {words}",
                result=AdapterResult(
                    ok=False,
                    provider_message=words,
                    raw_status=status,
                    detail=f"Slack answered {status} and no message was posted",
                ),
                bucket=_failure_bucket(status),
            )

        # ⭐ THE GATE THIS PLAN EXISTS FOR. `is True`, not truthiness: `{"ok": "false"}` is a
        # non-empty string, and every truthiness test in Python says yes to it. A reply that
        # is not a JSON object at all reaches here as None and fails the same way, because a
        # reply we cannot read is not a reply that says a message was posted.
        if payload is None or payload.get("ok") is not True:
            logger.warning(
                "post_message: Slack answered 200 and said no (channel=%s error=%s "
                "needed=%s provided=%s)",
                channel,
                words,
                (payload or {}).get("needed"),
                (payload or {}).get("provided"),
            )
            raise SlackPostFailed(
                f"Slack answered 200 but the reply says the message was not posted: {words}",
                result=AdapterResult(
                    ok=False,
                    provider_message=words,
                    # The status IS recorded — for the audit receipt, and because hiding it
                    # would make this failure harder to recognise as the trap it is. It is
                    # simply not what the verdict was derived from.
                    raw_status=status,
                    detail=(
                        "Slack signals failure inside a 200; the reply's ok field was not "
                        "true, so nothing was posted"
                    ),
                ),
                bucket=_failure_bucket(status),
            )

        timestamp = payload.get("ts")
        logger.info(
            "post_message: one message posted (channel=%s ts=%s)",
            payload.get("channel") or channel,
            timestamp,
        )
        return AdapterResult(
            ok=True,
            # Slack's success body describes the posted message rather than saying anything,
            # so there are no vendor words to quote and none are invented.
            provider_message="",
            raw_status=status,
            detail=f"posted to {payload.get('channel') or channel} at {timestamp}",
        )

    async def check(
        self,
        *,
        credential: CredentialLike,
        config: Mapping[str, Any],
    ) -> AdapterCheckResult:
        """Ask the host who this token belongs to. **Post nothing.**

        ``auth.test`` carries no body at all and files nothing, so UI-SPEC §5c's closing line
        *"No message was posted."* is honest at the level it is claimed at — and the test
        asserts the delivery method was never reached rather than trusting this sentence.

        ⚠ **The trap lives on this path too, and it is worse here.** ``auth.test`` answers
        ``200 {"ok": false, "error": "invalid_auth"}`` for a revoked token, so a status-line
        check would paint a dead credential green — a green light a person acts on later,
        rather than a failure they see now. The same identity gate therefore applies.

        The three §4d states arrive by three different doors on purpose: a refusal of ours
        raises ``EgressRefused`` with its authored code, a host that did not answer raises
        ``SlackUnreachable``, and a host that answered and said no returns ``ok=False`` —
        which is exactly and only the case §5b's *"The host rejected this credential"* is
        written for.
        """
        _validated_config(config)

        response = await _request(AUTH_TEST_METHOD, token=credential.secret)

        payload = _payload(response.body)
        words = _provider_words(payload, response.body)

        if response.status_code != 200 or payload is None or payload.get("ok") is not True:
            logger.info(
                "post_message: credential check failed (status=%s)", response.status_code
            )
            return AdapterCheckResult(ok=False, identity=None, provider_message=words)

        identity = _identity_of(payload)
        if identity is None:
            # A green answer that names nobody is not a green check: §5c renders WHO we
            # authenticated as, and a check that cannot answer that has established nothing.
            return AdapterCheckResult(ok=False, identity=None, provider_message=words)
        return AdapterCheckResult(ok=True, identity=identity, provider_message="")


__all__ = [
    "Adapter",
    "CAPABILITY",
    "FAILURE_BUCKETS",
    "SlackAdapterError",
    "SlackArgumentsInvalid",
    "SlackConfigInvalid",
    "SlackPostFailed",
    "SlackUnreachable",
]
