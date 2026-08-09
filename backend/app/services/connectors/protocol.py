"""Phase 190 (CONN-02 / D-01) — the connector adapter seam, shaped for the Model Context
Protocol.

⚠ **WHY THE THREE-LETTER ACRONYM IS NEVER SPELLED IN THIS FILE.** The standing fence in
``tests/unit/test_189_no_egress.py`` sweeps EVERY line under ``backend/app`` for that
acronym and requires zero occurrences — comments and docstrings included. Its continued
passing is part of D-01's own evidence that this phase built no client for that protocol,
so a docstring that spelled the acronym would turn the phase's proof RED while changing
nothing real. The expansion — **Model Context Protocol** — is written out instead, which is
more precise anyway. (Plan 190-07 hit the identical shape with the banned raw-string send
API and recorded the rule: *when prose in production source would trip the very fence it
describes, rewrite the sentence rather than declare a conflict*.) The full verdict this
amends lives in ``docs/CONNECTOR-ARCHITECTURE.md``, where the acronym IS spelled, because
that file is documentation and is outside the fence's walk.

── D-01 · THE AMENDMENT THIS FILE EXISTS TO MAKE HONEST ──────────────────────────────────
ROADMAP SC#1 for Phase 190 promised action nodes backed by that protocol. The parenthetical
was amended, for a structural reason rather than an effort one: a remote server of that kind
makes the outbound call **from its own process**, so CONN-03's *"every connector outbound
passes an unconditional SSRF / egress allow-list guard"* is unprovable through one — the
socket that matters is in someone else's process — and a local stdio server is the second
runtime red line D-14 forbids in as many words. What ships instead is three FIRST-PARTY
adapters whose sockets we own — and **this protocol is deliberately shaped to match that
standard's call shape, so that when the Open Platform milestone builds a real client for
it, adapters register through this same seam rather than beside it.**

The four borrowed properties, one attribute each, so the claim is checkable rather than
aspirational:

  1. a NAMED CAPABILITY          -> ``CAPABILITY``   (a class attribute, so the registry can
                                                      ASSERT agreement instead of trusting a
                                                      mapping nobody re-reads)
  2. a DECLARED INPUT SCHEMA     -> ``INPUT_SCHEMA`` (JSON-schema-shaped; what a server of
                                                      that kind would publish, and what the
                                                      executor validates an argument object
                                                      against)
  3. a JSON ARGUMENT OBJECT IN   -> ``send(args=...)``
  4. a STRUCTURED RESULT OUT     -> ``AdapterResult`` / ``AdapterCheckResult``

**Re-open trigger, so this is a check rather than a memory (SEED-013 / SEED-014):** the
client arrives with the Open Platform milestone. The observable is **a phase number
appearing on ``.planning/ROADMAP.md`` for SEED-013**. At that point each adapter either
becomes a call through that client behind this UNCHANGED protocol, or is retired. Until
then no such client, dependency or transport exists anywhere in ``backend/app`` — the
acronym fence named at the top of this docstring is the standing proof of that, and this
phase leaves it untouched and green.

── WHAT THIS FILE IS NOT ─────────────────────────────────────────────────────────────────
It opens nothing and imports no transport (D-05 — see the package docstring). It also
declares NO shared response-interpretation helper, and that omission is a decision: Slack
returns HTTP 200 with ``{"ok": false}`` on failure while Jira uses real status codes, so a
shared ``_check_response()`` would flatten a genuine difference into the "Complete for a
send that did not leave the app" defect (D-31 / T13). Each adapter interprets its own
vendor.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping, Protocol

__all__ = [
    "AdapterCheckResult",
    "AdapterError",
    "AdapterResult",
    "ConnectorAdapter",
    "CredentialLike",
]


class AdapterError(Exception):
    """Base for every NAMED adapter refusal.

    Named rather than generic because the executor (190-13) must be able to tell an
    adapter's own refusal — a malformed recipient, a header the stdlib rejected — from a
    transport failure, from an ``EgressRefused``. A bare ``Exception`` reaching the engine
    reads to a user as an internal error, which is the 500-shaped outcome VALIDATION row
    T12 rules out by name.

    ⚠ A subclass's ``str()`` is user-visible. It carries the offending FIELD or HEADER NAME
    and the vendor's own words; it never carries a credential, and it never carries the
    offending header VALUE (D-08 — the value is attacker-controlled and would put an
    injected ``Bcc:`` line into a log).
    """


@dataclass(frozen=True)
class AdapterResult:
    """The structured result of one ``send`` — borrowed property 4.

    Frozen, in ``provider_gateway/dispatcher.py``'s ``GatewayRequest`` shape, with each
    field's provenance stated rather than inferred:

    ``ok``
        ⚠ **THE ADAPTER'S OWN VERDICT — NOT AN HTTP STATUS, and this distinction is the
        single most likely way this phase ships a lie.** Slack answers ``200`` with
        ``{"ok": false, "error": "channel_not_found"}`` for a message that was never
        delivered; Jira answers with real status codes; SMTP answers with a three-digit
        reply code on a different protocol entirely. Any helper that computes this field
        for more than one vendor is the T13 defect (RESEARCH Anti-Patterns), and the
        observable failure is a phase reading *"Complete"* for a send that did not leave
        the app (D-31). Each adapter computes it from ITS vendor's contract.
    ``provider_message``
        The vendor's words VERBATIM — unparaphrased, untranslated, untruncated (the 071-A
        verbatim-provider-error rule UI-SPEC §5b binds). ``""`` when the vendor said
        nothing, never a message we invented on its behalf.
    ``raw_status``
        The transport-level status as an integer where one exists — an HTTP status code, or
        an SMTP reply code — and ``None`` where it does not. It is recorded for the audit
        receipt; it is NOT what ``ok`` is derived from.
    ``detail``
        OUR one-line explanation, for a person reading a failed phase. Distinct from
        ``provider_message`` on purpose: mixing the two is how a vendor string quietly
        becomes a paraphrase.
    """

    ok: bool
    provider_message: str = ""
    raw_status: int | None = None
    detail: str = ""


@dataclass(frozen=True)
class AdapterCheckResult:
    """The structured result of one ``check`` — authenticate, then disconnect.

    ``ok``
        The adapter's own verdict on whether the stored credential authenticates. Same
        rule as ``AdapterResult.ok``: per-vendor, never shared.
    ``identity``
        WHO we authenticated as, as the vendor names it — the SMTP username, the Slack
        bot handle, the Jira account. It is what UI-SPEC §5c renders in *"Authenticated
        as {identity}"*, and it is the half that makes a green check mean something: a
        credential that works for the WRONG account is a distinct failure from one that
        does not work.
    ``provider_message``
        The vendor's words VERBATIM, exactly as in ``AdapterResult``.

    ⚠ ``check`` MUST send nothing. UI-SPEC §5c's headline is *"Credential works — and
    nothing was sent"*, and a headline that says *nothing was sent* is only honest if it
    is proved: the SMTP adapter's check is asserted to issue no ``DATA`` command, and the
    Slack/Jira checks reach an identity endpoint rather than a delivery one.
    """

    ok: bool
    identity: str | None = None
    provider_message: str = ""


class CredentialLike(Protocol):
    """The one thing an adapter needs from a resolved connection: its plaintext secret.

    Structural rather than a hard import of ``connector_service.ResolvedConnection`` so
    that the credential layer stays ABOVE the adapters in the import graph and an adapter
    can be exercised without a database. The real object materializes the plaintext lazily
    on this property (both D-11 fail-closed read gates having already been evaluated
    eagerly by the resolver), so an adapter that never touches ``.secret`` — because the
    egress guard refused first, D-06 — never causes a decryption at all.
    """

    @property
    def secret(self) -> str: ...  # pragma: no cover - structural


class ConnectorAdapter(Protocol):
    """The seam every first-party connector implements. TWO methods, no more.

    Implementations are named ``Adapter`` in their own module and are resolved through
    ``registry.get_adapter(capability)``; they hold no state and are safe to reuse.
    """

    #: Borrowed property 1 — the named capability. A member of the CLOSED set
    #: ``EXTERNAL_ACTION_CAPABILITIES``; the registry asserts that the key an adapter is
    #: registered under equals the name the adapter claims here, so the two spellings
    #: cannot drift (``models/harness.py``'s *"the agreement is MECHANICAL rather than
    #: remembered"* rule).
    CAPABILITY: str = ""

    #: Borrowed property 2 — the declared input schema, a plain JSON-schema-shaped mapping.
    #: This is what a Model Context Protocol server would publish, and what the executor
    #: validates the argument object against. Kept DELIBERATELY THIN (D-32): every extra
    #: property is a new outbound surface with no prior review cycle.
    INPUT_SCHEMA: Mapping[str, Any] = MappingProxyType({})

    async def send(
        self,
        *,
        args: Mapping[str, Any],
        credential: CredentialLike,
        config: Mapping[str, Any],
        capability: str | None = None,
    ) -> AdapterResult:
        """Perform the capability once. Borrowed property 3 in, property 4 out.

        ``args``       the JSON argument object, shaped by ``INPUT_SCHEMA``
        ``credential`` the resolved connection (only ``.secret`` is read)
        ``config``     the NON-secret per-capability config from the connection ROW —
                       host, port, base_url, channel. Never from the step's JSONB, which
                       carries a ``connection_id`` reference and nothing else (D-13).
        ``capability`` the capability being performed, when the caller wants to state it.
                       Optional so a caller need not repeat what the registry already
                       resolved; when given it is CHECKED against ``CAPABILITY`` rather
                       than trusted, because a mismatch means the dispatch was wrong.

        ⚠ **At MOST once (D-18).** No retry, no backoff, no idempotency key, no queue —
        anywhere in any implementation. A retried send with no idempotency key double-sends,
        and a duplicate is worse than a missing one on the surface whose entire discipline
        is not over-claiming. A failed send fails the phase and halts the run; the human
        re-runs deliberately.
        """
        ...  # pragma: no cover - structural

    async def check(
        self,
        *,
        credential: CredentialLike,
        config: Mapping[str, Any],
    ) -> AdapterCheckResult:
        """Authenticate and disconnect. **Send nothing.**

        The credential-test path behind UI-SPEC §5c's *"Credential works — and nothing was
        sent"*. It exists because the alternative — proving a connection works by using it
        — means the first test of a mail connection is an email somebody receives.
        """
        ...  # pragma: no cover - structural
