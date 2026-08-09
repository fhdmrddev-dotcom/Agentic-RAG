"""Phase 190 (CONN-02 / CONN-03) — the ``create_ticket`` adapter. Jira Cloud REST v3, once.

── D-05 · THIS FILE CONSTRUCTS NO CLIENT ─────────────────────────────────────────────────
Every connection comes from ``app.security.egress``. ``send_pinned_http`` validates the
destination (scheme, allow-listed host, every resolved address), connects to the address it
validated rather than to whatever the next name lookup answers, keeps the certificate
verified against the NAME, refuses redirects outright and caps the reply in both its wire
and its expanded size. This module names no transport module at all — not to build one, not
to catch one's exceptions — and the fence over that is asserted directly against this file
in ``tests/unit/test_190_jira_adapter.py`` ahead of plan 190-14's standing walk.

⚠ ``allowed_host=`` is deliberately NOT passed here, and that is the opposite of the
``send_email`` adapter's rule. ``create_ticket``'s permitted host is a CODE rule — the
label-boundary suffix ``atlassian.net`` in ``egress.ALLOWED_HOST_SUFFIXES`` — not org
configuration. Passing a per-call host would hand the guard a second, staler source of truth
for something it already knows, and the whole point of §R15's rule living inside the guard is
that no adapter re-implements host matching.

── §R12 · WHAT ATLASSIAN'S OWN DOCUMENTATION SAYS, AND WHAT FOLLOWS FROM IT ───────────────
Sourced from developer.atlassian.com (*Jira Cloud platform REST API v3 — Issues*, *Basic auth
for REST APIs*, *REST API v3 intro*) at research time, and every one of the three points
below is a direct consequence rather than a convention borrowed from another vendor.

1. **v3 requires the Atlassian Document Format for ``description``** — *"Version 3 of the API
   provides support for the Atlassian Document Format (ADF), including in issue resources."*
   The field takes an OBJECT. A v2-era wiki-markup string is rejected, so the plain-string
   shape a reader might reasonably reach for is wrong rather than merely old.
2. **Auth is basic, the username is the account EMAIL and the password is an API token** —
   *"Authentication using passwords has been deprecated."* There is therefore no password
   path in this adapter to be reached, and none to be added later without contradicting the
   vendor. The pair is handed to the transport binder as ``auth=(account_email, api_token)``
   and the library encodes it; this file constructs no encoded credential string and no
   credential header of its own, because a hand-built one is one interpolation away from a
   log line (T-190-10-AUTH).
3. **Jira signals errors with real HTTP status codes**, with a body shaped
   ``{"errorMessages": [...], "errors": {"<field>": "<message>"}}``.

⚠ **ASSUMPTION A1, recorded rather than assumed away:** point 3's exact body shape is NOT
driven against a live Jira account (D-30's blocking dependency). Points 1 and 2 are stated
directly by Atlassian and are HIGH confidence; the envelope is MEDIUM. The failure path below
degrades safely — an envelope in an unexpected shape falls back to the reply's own decoded
text, verbatim — but the first live ``create_ticket`` UAT row must verify it and correct this
file if it differs.

── T13 · WHY THERE IS NO SHARED "INTERPRET THE REPLY" HELPER ──────────────────────────────
Point 3 makes a ``raise_for_status()``-shaped check CORRECT for Jira — and that same check is
WRONG for Slack, which answers ``200`` with ``{"ok": false, "error": ...}`` for a message it
never posted. A helper shared across the two adapters would have to pick one of those
contracts and be wrong about the other vendor; RESEARCH § Anti-Patterns names it first on its
list and UI-SPEC §8c calls it the likeliest lie this phase ships. The observable is a phase
reading *"Complete"* for a send that did not leave the app (D-31). The seam in ``protocol.py``
declares no such helper ON PURPOSE, this file interprets its own vendor, and a source fence
asserts it borrows none from a sibling.

**``ok=True`` MEANS THE TICKET EXISTS.** That is stronger than "the status line was 2xx", and
the difference is three checks rather than one: the status must be 2xx, the body must not
carry an error envelope, and the body must carry an issue KEY — the key being the only
evidence in the reply that an issue was actually created. A 200 with an error envelope, or a
201 with no key, is a failure here.

── §4d · THE THREE-WORD VOCABULARY, AND WHY IT HAS NO FOURTH MEMBER ───────────────────────
UI-SPEC §4d gives three states, three headings and three next steps, and warns that
flattening them is the single most likely copy defect on this surface:

  * ``refused``     — WE declined to open the connection, for a security property. Raised by
                     the guard as ``EgressRefused`` with one of six authored reason codes,
                     and it PROPAGATES THROUGH THIS FILE UNCHANGED: catching it and re-raising
                     it as an adapter failure would replace an authored sentence with an
                     improvised one and lose the code the renderer keys off.
  * ``unreachable`` — the address is allowed and nothing answered on it.
  * ``rejected``    — we reached the host and IT said no.

Every status-carrying failure is ``rejected``, including a 400 and a 404: the host answered,
so neither of the other two words is true of it. The 401/403 case is the one §5b's sentence
is written for, and the status travels on the result so a renderer can tell a stale token
from a missing project without this file inventing a fourth bucket to carry it.

⚠ ``EgressResponseTooLarge`` and ``EgressResponseUndecodable`` also propagate unchanged,
because neither is a §4d state: the host DID answer, so it is not unreachable, and the answer
was not a refusal of ours. Painting either with a §4d heading would be exactly the swap §4d
forbids. See A2 in this plan's summary for the honest consequence — an unreadable reply after
a create leaves the outcome genuinely unknown, and D-18 means the human decides what to do
about that rather than this file guessing.

── D-08 · WHAT A REFUSAL MAY SAY ─────────────────────────────────────────────────────────
A refusal names the offending FIELD and the category of problem. It never carries that
field's value — the value is author-controlled, so echoing it writes composed workflow
content into every log that records the exception — and it never carries the credential, in
any form.

── D-18 · AT MOST ONCE ───────────────────────────────────────────────────────────────────
Automatic re-attempt machinery of every kind is forbidden on this path (D-18): no retry, no
backoff, no idempotency key, no queue (D-18 — every line of this paragraph naming the
forbidden machinery cites the decision, because the fence over it reads per line rather than
per file). Jira's create endpoint takes no idempotency key at this scope, so a second attempt
(D-18) files the ticket twice — and a duplicate is worse than a
missing one on the surface whose whole discipline is not over-claiming. A failed create fails
the phase and halts the run; the human re-runs deliberately.

── A MEASURED DIFFERENCE FROM THE ``send_email`` ADAPTER, STATED RATHER THAN SMOOTHED ─────
The mail adapter reads ``credential.secret`` only AFTER its connection cleared the guard, so
a run refused egress never materialises a plaintext credential at all. This adapter cannot do
that: the binder takes the credential pair as a CALL ARGUMENT, so the plaintext exists one
frame before the guard runs. D-06's asserted property is unaffected — the guard still runs
first inside the binder, still refuses without consulting the credential, and a refused
destination still reaches no wire — but the lazy-decrypt bonus the mail path gets for free is
not available on the HTTP path. Recorded here so the next reader finds the difference
explained rather than assumes one of the two files is wrong.
"""

from __future__ import annotations

import json as jsonlib
import logging
from types import MappingProxyType
from typing import Any, Mapping

from pydantic import ValidationError

from app.models.connector import CreateTicketConfig
from app.security.egress import (
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

CAPABILITY = "create_ticket"

#: One bound on the whole exchange, and one on what may be read back. ``send_pinned_http``
#: requires both keyword-only with no default precisely so they cannot be forgotten here.
JIRA_TIMEOUT_SECONDS = 30.0
JIRA_MAX_RESPONSE_BYTES = 256 * 1024

#: §R12's two paths. The create endpoint files an issue; the identity endpoint files nothing,
#: which is what makes UI-SPEC §5c's *"No ticket was created."* an honest closing line.
ISSUE_PATH = "/rest/api/3/issue"
IDENTITY_PATH = "/rest/api/3/myself"

#: §R12: ``issuetype`` is required and takes a name or an id. It is a module constant rather
#: than a config field because ``CreateTicketConfig`` is ``extra='forbid'`` and declares
#: ``base_url`` / ``project_key`` / ``account_email`` and nothing else — so a per-connection
#: issue type is unconstructable today by design, not by omission. Adding one is a change to
#: migration 116's config contract and belongs to whoever needs it.
DEFAULT_ISSUE_TYPE = "Task"

#: UI-SPEC §4d's closed three. Declared as a set so a typo'd bucket raises at the raise site
#: rather than rendering an empty heading, exactly as ``EgressRefused`` does for its codes.
FAILURE_BUCKETS = frozenset({"refused", "unreachable", "rejected"})


# ── refusals ──────────────────────────────────────────────────────────────────────────────
class JiraAdapterError(AdapterError):
    """Base for this adapter's NAMED refusals."""


class JiraConfigInvalid(JiraAdapterError):
    """The stored connection config is not a valid ``create_ticket`` config."""


class JiraArgumentsInvalid(JiraAdapterError):
    """The argument object does not match ``INPUT_SCHEMA``."""


class JiraDocumentRefused(JiraAdapterError):
    """D-09's fence: the description was not composed plain text.

    Raised by ``_plain_text_to_adf`` itself rather than by a validation step in front of it,
    and that placement is load-bearing: a fence the real path does not reach is decoration,
    and plan 190-08 recorded exactly that failure — its plant left the target cases green
    because composition refused before the guarded step ran.
    """


class JiraUnreachable(JiraAdapterError):
    """Nothing answered. UI-SPEC §4d's *unreachable* — the address is allowed, the host did
    not reply.

    Distinct from every reply-bearing failure because the next step a person is offered
    differs: *"the address is allowed — nothing answered on it"* sends them to the host and
    port, while *"the host rejected this credential"* sends them to the token.
    """


class JiraCreateFailed(JiraAdapterError):
    """A create that did not produce a ticket. Carries the structured result and its bucket.

    The exception carries an ``AdapterResult`` rather than a loose set of attributes so the
    payload is the same shape a caller would have received on success — one type to render,
    with ``ok`` already ``False`` and asserted so at construction. Raising rather than
    returning is deliberate and matches the sibling adapter: a returned ``ok=False`` is
    ignorable, and an ignored failure is the *"Complete for a send that did not leave the
    app"* defect (D-31) arriving through the front door.
    """

    def __init__(self, message: str, *, result: AdapterResult, bucket: str) -> None:
        if result.ok:
            raise ValueError("a JiraCreateFailed cannot carry an ok=True result")
        if bucket not in FAILURE_BUCKETS:
            raise ValueError(
                f"{bucket!r} is not one of UI-SPEC §4d's three states: {sorted(FAILURE_BUCKETS)}"
            )
        self.result = result
        self.bucket = bucket
        super().__init__(message)


# ── the ADF builder (D-09's fence) ────────────────────────────────────────────────────────
def _plain_text_to_adf(value: Any) -> dict:
    """Composed plain TEXT in, an Atlassian Document Format document out. A pure function.

    §R12's minimal document: one ``paragraph`` node per line, each carrying one ``text`` node.
    An empty line becomes an empty paragraph rather than a ``text`` node with an empty string,
    because an empty text node is not valid in that format.

    ⚠ **IT TAKES A STRING AND IT RAISES ON ANYTHING ELSE — that raise IS D-09's fence.**
    Accepting an author-supplied document has two independent costs, either sufficient on its
    own: it is rich content handed to a renderer we do not own, and an authoring affordance
    for it is precisely the per-field templating surface D-09 rules out for this phase. The
    line endings are normalised first so a document composed on either platform produces the
    same paragraphs; nothing else about the text is touched, because a builder that trims or
    collapses quietly rewrites what a person wrote.
    """
    if not isinstance(value, str):
        raise JiraDocumentRefused(
            f"the 'description' must be composed plain text, and a {type(value).__name__} "
            "was supplied where text belongs. An author-supplied document object is refused "
            "(D-09): the document is built from the text, never accepted from the author."
        )
    if not value.strip():
        raise JiraDocumentRefused("the 'description' is empty")

    normalised = value.replace("\r\n", "\n").replace("\r", "\n")
    content: list[dict] = []
    for line in normalised.split("\n"):
        paragraph: dict[str, Any] = {"type": "paragraph"}
        if line:
            paragraph["content"] = [{"type": "text", "text": line}]
        content.append(paragraph)
    return {"type": "doc", "version": 1, "content": content}


# ── validation ────────────────────────────────────────────────────────────────────────────
def _validated_config(config: Mapping[str, Any]) -> CreateTicketConfig:
    """Parse the stored NON-secret config through the shipped ``extra='forbid'`` model.

    The model is the one 190-06 landed, so there is one spelling of what a Jira connection
    knows — and it has nowhere to put the API token, which is what makes ``config['token']``
    unconstructable rather than merely discouraged. ``base_url`` lives on the CONNECTION ROW
    and never on the step's config; that was settled in 190-06 and is not re-litigated here.
    """
    try:
        settings = CreateTicketConfig.model_validate(dict(config))
    except ValidationError as exc:
        raise JiraConfigInvalid(
            f"the stored create_ticket connection config is not usable: {exc.error_count()} "
            f"problem(s) in fields {sorted({str(e['loc'][0]) for e in exc.errors() if e['loc']})}"
        ) from None

    # The API path below is APPENDED to this value, so a query string or a fragment in it
    # would swallow the path and send the create to the site root instead — which can answer
    # 200 with a page rather than an error. Refused here rather than discovered at the wire.
    if "?" in settings.base_url or "#" in settings.base_url:
        raise JiraConfigInvalid(
            "the stored 'base_url' carries a query string or a fragment; it must be the bare "
            "site address, because the API path is appended to it"
        )
    return settings


def _validated_text(args: Mapping[str, Any], key: str) -> str:
    value = args.get(key)
    if not isinstance(value, str) or not value.strip():
        raise JiraArgumentsInvalid(f"'{key}' must be a non-empty string")
    return value


def _endpoint(settings: CreateTicketConfig, path: str) -> str:
    """``<org-configured base_url>`` + one of the two API paths, with the join made once."""
    return settings.base_url.strip().rstrip("/") + path


# ── the vendor's own words ────────────────────────────────────────────────────────────────
def _decoded(body: bytes) -> str:
    return body.decode("utf-8", errors="replace") if body else ""


def _envelope(body: bytes) -> dict | None:
    """The reply parsed as a JSON object, or ``None`` when it is not one.

    ``None`` is a real answer and not an error: a gateway page, an empty body and a bare JSON
    array are all things a caller must be able to tell apart from a Jira envelope, and every
    one of them means *"this reply does not describe a created issue"*.
    """
    try:
        parsed = jsonlib.loads(_decoded(body)) if body else None
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _carries_error(envelope: dict | None) -> bool:
    """True when the reply carries §R12's error envelope, WHATEVER its status line said.

    This is the check that makes ``ok=True`` mean the ticket exists rather than mean the
    status line was agreeable. It is cheap, and the shape it defends against — a structurally
    successful reply that describes a failure — is the one this phase is most likely to ship
    a lie about.
    """
    if envelope is None:
        return False
    return bool(envelope.get("errorMessages")) or bool(envelope.get("errors"))


def _provider_words(body: bytes) -> str:
    """The vendor's own words, VERBATIM — unparaphrased, untranslated, untruncated (071-A).

    Both halves of §R12's envelope are rendered because they carry different information:
    ``errorMessages`` is the request-level complaint and ``errors`` is per-field, so surfacing
    one and dropping the other is a truncation with a nicer name. A body that is not an
    envelope falls back to its own decoded text, which is still the host's words and never a
    message invented on its behalf.
    """
    envelope = _envelope(body)
    if envelope is None:
        return _decoded(body).strip()

    lines: list[str] = []
    messages = envelope.get("errorMessages")
    if isinstance(messages, list):
        lines.extend(str(message) for message in messages)
    errors = envelope.get("errors")
    if isinstance(errors, dict):
        lines.extend(f"{field}: {message}" for field, message in errors.items())
    if lines:
        return "; ".join(lines)
    return _decoded(body).strip()


def _failure_bucket(status: int | None) -> str:
    """Map a failure onto UI-SPEC §4d's three states. There is no fourth.

    ``None`` means nothing answered → ``unreachable``. Any status at all means the host
    answered and said no → ``rejected``, 401 and 403 included and 400 and 404 alike. A
    refusal of OURS never reaches here: ``EgressRefused`` propagates unchanged and carries its
    own authored reason code.
    """
    return "unreachable" if status is None else "rejected"


def _identity_of(envelope: dict | None) -> str | None:
    """WHO the token belongs to, as Jira names it — for §5c's *"Authenticated as {identity}"*.

    A green check that cannot name the account is not a green check: a credential that works
    for the WRONG account is a distinct failure from one that does not work, and it is the
    only one a person cannot see without being told.
    """
    if envelope is None:
        return None
    for field in ("displayName", "emailAddress", "accountId"):
        value = envelope.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


# ── the one door to the wire ──────────────────────────────────────────────────────────────
async def _request(
    method: str, url: str, *, auth: tuple[str, str], json: Any | None = None
) -> PinnedResponse:
    """One exchange through the egress binder. Interprets NOTHING about the reply.

    The split is deliberate: this function classifies EXCEPTIONS, and each caller interprets
    its own REPLY. A helper that did both would be the shared response checker T13 forbids,
    one file earlier than the sibling adapter that would have imported it.

    Three failures propagate unchanged because none of them is a §4d state this adapter may
    describe: ``EgressRefused`` carries its own authored sentence, and the two response-size
    terminals mean the host answered something we would not read.
    """
    try:
        return await send_pinned_http(
            CAPABILITY,
            method,
            url,
            json=json,
            headers={"Accept": "application/json"},
            auth=auth,
            timeout=JIRA_TIMEOUT_SECONDS,
            max_bytes=JIRA_MAX_RESPONSE_BYTES,
        )
    except (EgressRefused, EgressResponseTooLarge, EgressResponseUndecodable):
        raise
    except Exception as exc:  # noqa: BLE001 - a transport boundary; nothing answered
        raise JiraUnreachable(
            f"nothing answered at the Jira site for this connection: {exc}"
        ) from exc


# ── the adapter ───────────────────────────────────────────────────────────────────────────
class Adapter:
    """``create_ticket`` — one issue, in one project, at most once."""

    CAPABILITY: str = CAPABILITY

    #: The thin two, and nothing else (D-32). No labels, no assignee, no priority, no custom
    #: field: each is a new outbound surface with no prior review cycle inside a phase gated
    #: on ``threats_open: 0``, and ``assignee`` in particular would let a workflow name a
    #: person in a directory this platform cannot see.
    INPUT_SCHEMA: Mapping[str, Any] = MappingProxyType({
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "description"],
        "properties": MappingProxyType({
            "summary": MappingProxyType({
                "type": "string",
                "description": "The issue summary — Jira's required one-line title.",
            }),
            "description": MappingProxyType({
                "type": "string",
                "description": (
                    "The issue description as PLAIN TEXT. It is converted to an Atlassian "
                    "Document Format document here; a document object is refused."
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
        """File one issue. Raises a NAMED refusal on anything that is not a created ticket."""
        if capability is not None and capability != CAPABILITY:
            raise JiraArgumentsInvalid(
                f"this adapter performs {CAPABILITY!r}, not {capability!r}"
            )

        settings = _validated_config(config)
        unknown = sorted(set(args) - set(self.INPUT_SCHEMA["properties"]))
        if unknown:
            # Fail CLOSED on an argument nobody declared: an undeclared key is either a
            # mis-wired executor or a field somebody expects to have an effect, and silently
            # dropping it is how a `labels` argument comes to look supported.
            raise JiraArgumentsInvalid(f"undeclared argument(s) for create_ticket: {unknown}")

        summary = _validated_text(args, "summary")
        # ⚠ THE RAW VALUE, DELIBERATELY. The builder does its own type check because the
        # builder IS D-09's fence; validating the description as a string here first would
        # move the refusal in front of the guarded step and leave the fence unreachable.
        description = _plain_text_to_adf(args.get("description"))

        payload = {
            "fields": {
                "project": {"key": settings.project_key},
                "issuetype": {"name": DEFAULT_ISSUE_TYPE},
                "summary": summary,
                "description": description,
            }
        }

        try:
            response = await _request(
                "POST",
                _endpoint(settings, ISSUE_PATH),
                auth=(settings.account_email, credential.secret),
                json=payload,
            )
        except JiraUnreachable as exc:
            logger.warning(
                "create_ticket: nothing answered (project=%s)", settings.project_key
            )
            # D-18 - the failure is surfaced to the caller, never attempted a second time.
            raise JiraCreateFailed(
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

        return self._verdict(response, settings)

    def _verdict(
        self, response: PinnedResponse, settings: CreateTicketConfig
    ) -> AdapterResult:
        """Jira's own contract, applied to Jira's own reply. Not shared with any other vendor.

        Three gates, and ``ok=True`` requires all three: a 2xx status line, no error envelope,
        and an issue KEY. The second and third are what make the verdict mean *"the ticket
        exists"* rather than *"the status line was agreeable"*.
        """
        words = _provider_words(response.body)
        status = response.status_code

        if not 200 <= status < 300:
            logger.warning(
                "create_ticket: the host refused the issue (project=%s status=%s)",
                settings.project_key, status,
            )
            raise JiraCreateFailed(
                f"Jira refused the issue: {words}",
                result=AdapterResult(
                    ok=False,
                    provider_message=words,
                    raw_status=status,
                    detail=f"Jira answered {status} and no issue was created",
                ),
                bucket=_failure_bucket(status),
            )

        envelope = _envelope(response.body)
        if _carries_error(envelope):
            # A structurally successful reply that describes a failure. Reading this as a
            # success is the Jira-shaped version of the trap plan 190-11 owns for Slack, and
            # the phase would show "Complete" for a ticket nobody can find.
            raise JiraCreateFailed(
                f"Jira answered {status} but the reply describes a failure: {words}",
                result=AdapterResult(
                    ok=False,
                    provider_message=words,
                    raw_status=status,
                    detail=(
                        f"Jira answered {status} carrying an error envelope; no issue was "
                        "created"
                    ),
                ),
                bucket=_failure_bucket(status),
            )

        key = envelope.get("key") if envelope else None
        if not isinstance(key, str) or not key.strip():
            raise JiraCreateFailed(
                f"Jira answered {status} without an issue key, so no created issue can be "
                "confirmed",
                result=AdapterResult(
                    ok=False,
                    provider_message=words,
                    raw_status=status,
                    detail=(
                        "the reply carries no issue key — the key is the only evidence in a "
                        "reply that an issue was created, so its absence cannot read as one"
                    ),
                ),
                bucket=_failure_bucket(status),
            )

        logger.info(
            "create_ticket: one issue created (project=%s key=%s)",
            settings.project_key, key.strip(),
        )
        return AdapterResult(
            ok=True,
            # Jira's success body describes the created issue rather than saying anything, so
            # there are no vendor words to quote and none are invented.
            provider_message="",
            raw_status=status,
            detail=f"created {key.strip()} in project {settings.project_key}",
        )

    async def check(
        self,
        *,
        credential: CredentialLike,
        config: Mapping[str, Any],
    ) -> AdapterCheckResult:
        """Ask the host who this token belongs to. **Create nothing.**

        A GET to §R12's identity endpoint, which files no issue — so UI-SPEC §5c's closing
        line *"No ticket was created."* is honest at the level it is claimed at, and the test
        asserts the create endpoint was never reached and no body was ever carried.

        ⚠ The three §4d states arrive by three different doors on purpose, so a caller cannot
        confuse them: a refusal of ours raises ``EgressRefused`` with its authored code, a
        host that did not answer raises ``JiraUnreachable``, and a host that answered and said
        no returns ``ok=False`` — which is exactly and only the case §5b's *"The host rejected
        this credential"* is written for. Returning ``ok=False`` for all three would collapse
        the vocabulary this section exists to keep apart.
        """
        settings = _validated_config(config)

        response = await _request(
            "GET",
            _endpoint(settings, IDENTITY_PATH),
            auth=(settings.account_email, credential.secret),
        )

        words = _provider_words(response.body)
        if not 200 <= response.status_code < 300:
            logger.info(
                "create_ticket: credential check failed (status=%s)", response.status_code
            )
            return AdapterCheckResult(ok=False, identity=None, provider_message=words)

        identity = _identity_of(_envelope(response.body))
        if identity is None:
            # A 200 that names nobody is not a green check: §5c renders WHO we authenticated
            # as, and a check that cannot answer that has not established what it claims.
            return AdapterCheckResult(ok=False, identity=None, provider_message=words)
        return AdapterCheckResult(ok=True, identity=identity, provider_message="")


__all__ = [
    "Adapter",
    "CAPABILITY",
    "FAILURE_BUCKETS",
    "JiraAdapterError",
    "JiraArgumentsInvalid",
    "JiraConfigInvalid",
    "JiraCreateFailed",
    "JiraDocumentRefused",
    "JiraUnreachable",
]
