"""Phase 190 (CONN-03) — the connector-connection Pydantic models.

The request/response trio for ``public.connector_connections`` (migration 116), in the
shape ``classification_rule.py`` uses for classification rules: a ``Create``, an
all-optional ``Update``, and a ``Response`` that is deliberately NARROWER than the row.

── WHY THE RESPONSE MODEL IS THE REAL GATE (T7 / T-190-06-T7) ──────────────────────────
``ConnectorConnectionResponse`` has **no ``secret_ciphertext`` field and no ``secret``
field**, and it is ``extra='forbid'``, so handing it a raw row is a ``ValidationError``
rather than a leak. That is the enforcing surface for VALIDATION row T7 — not the
TypeScript type, which any hand-rolled fetch bypasses, and not a hand-maintained
projection list in the router, which drifts the first time a column is added. A column
added to migration 116 tomorrow cannot reach a client through this model unless somebody
adds the field HERE, in a diff a reviewer reads.

── WHY THE CONFIG MODELS ARE PER-CAPABILITY (T6 / T-190-06-T6) ─────────────────────────
``config`` is the NON-secret half of a connection (mig 116's ``COMMENT ON COLUMN``: *"host,
port, base_url, from_address, default_channel, project_key. No token, no password, no API
key ever lands here"*). Typing it as a free ``dict`` would make that comment the only thing
standing between a caller and ``config["smtp_password"]``. Each capability therefore gets
its own ``extra='forbid'`` model, so a password key in ``config`` is **unconstructable**
rather than merely discouraged — and ``SendEmailConfig`` in particular carries the host and
the port but has nowhere to put the password, which is the whole point.

⚠ **``PostMessageConfig`` takes no URL at all** (D-02): Slack's host is a module constant in
``app/security/egress.py``, never author-supplied. One of the three destinations is then
unforgeable by construction, which is the cheapest SSRF posture available and gives the
guard suite a real negative control.

── D-03 · STATIC TOKENS ONLY ────────────────────────────────────────────────────────────
The three shapes are exactly the three static-credential shapes D-03 locks: a Slack bot
token (``xoxb-``), a Jira account email + API token (basic auth), an SMTP username +
password. There is **no** OAuth authorization-code flow anywhere in this module — no
redirect URI, no callback, no refresh token, no consent surface. ``secret`` is a single
opaque string in every case; the second half of the Jira/SMTP pair (``account_email`` /
``username``) is a NON-secret fact and lives in ``config``.

── The two-spellings rule ───────────────────────────────────────────────────────────────
``ConnectorCapability`` is the third spelling of one closed set (the frozenset in
``harness/grounding.py`` is the runtime home; ``ExternalActionPhaseConfig.capability`` is
the second; migration 116's ``CHECK`` is the SQL one). Pydantic needs a literal, so the
duplication is unavoidable — the AGREEMENT is therefore made MECHANICAL by the module-scope
assert below, exactly as ``models/harness.py`` records for its own copy. Nothing here is
remembered; it is checked at import.
"""

from __future__ import annotations

from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict, model_validator

# The runtime home of the closed capability set. Imported for the static agreement assert
# below — this module never calls into the service layer at request time.
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES


class _StrictBase(BaseModel):
    """Base for every model here — rejects unknown keys (the D-07 posture).

    Deliberately declared locally rather than imported from ``models/harness.py``: that
    one is a private symbol of the phase-config module, and a one-line ``ConfigDict`` is
    not a set that can silently drift. What CAN drift — the capability vocabulary — is
    fenced by the assert below instead.
    """

    model_config = ConfigDict(extra="forbid")


# ── the capability vocabulary ────────────────────────────────────────────────────────────
ConnectorCapability = Literal["send_email", "create_ticket", "post_message"]

# Static, data-independent: both operands are literals declared in the tree, so this can
# only fire when someone edits one of them — which is precisely when it should. Mirrors the
# assert beside EXTERNAL_ACTION_CAPABILITIES in harness/grounding.py.
assert set(get_args(ConnectorCapability)) == set(EXTERNAL_ACTION_CAPABILITIES), (
    "D-04: ConnectorCapability disagrees with EXTERNAL_ACTION_CAPABILITIES "
    f"({sorted(set(get_args(ConnectorCapability)) ^ set(EXTERNAL_ACTION_CAPABILITIES))}). "
    "The capability set is closed and has one runtime home; a connection whose capability "
    "no external_action step can name is a row that can never be bound."
)


# ── the per-capability NON-secret config models (T6) ─────────────────────────────────────
class SendEmailConfig(_StrictBase):
    """SMTP destination facts. NO password field exists — the secret rides ``secret``.

    ``tls`` is a closed two-member literal because D-07 requires TLS either way: implicit
    TLS on 465, or STARTTLS on 587. There is no plaintext-SMTP member to select.
    """

    host: str
    port: int
    from_address: str
    username: str | None = None  # the NON-secret half of the SMTP credential pair (D-03)
    tls: Literal["starttls", "implicit"] = "starttls"


class CreateTicketConfig(_StrictBase):
    """Jira Cloud destination facts. The API token rides ``secret``; the email does not.

    ``account_email`` is the basic-auth USERNAME half (D-03 / R12) — a non-secret fact, and
    keeping it here rather than in ``secret`` is what lets the whole credential pair be
    displayed to an org admin without ever decrypting anything.
    """

    base_url: str
    project_key: str
    account_email: str


class PostMessageConfig(_StrictBase):
    """Slack destination facts — a channel, and NOTHING else (D-02).

    ⚠ There is deliberately no ``base_url`` / ``host`` / ``webhook_url`` field. Slack's API
    host is a module constant in ``app/security/egress.py``; an author-supplied URL here
    would hand the SSRF guard a destination it has to reason about instead of one it can
    refuse to accept in the first place.
    """

    default_channel: str


ConnectorConfig = SendEmailConfig | CreateTicketConfig | PostMessageConfig

# The closed capability → config-model binding. A dict rather than an if-ladder for the same
# reason `_TOOL_REGISTRY` / `PROGRAMMATIC_PHASE_REGISTRY` are: an unknown key is a KeyError at
# a named site, never a dynamic lookup and never an eval.
CONFIG_MODEL_FOR_CAPABILITY: dict[str, type[_StrictBase]] = {
    "send_email": SendEmailConfig,
    "create_ticket": CreateTicketConfig,
    "post_message": PostMessageConfig,
}

assert set(CONFIG_MODEL_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
    "every capability needs exactly one config model; missing/extra: "
    f"{sorted(set(CONFIG_MODEL_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))}"
)


def _reject_config_capability_mismatch(capability: str, config: object) -> None:
    """Raise unless ``config`` is the model class ``capability`` binds to.

    Pydantic's smart union already picks a member by shape; this makes the choice
    DETERMINISTIC rather than shape-inferred, so a ``create_ticket`` row can never end up
    carrying a ``PostMessageConfig`` because the submitted dict happened to fit.
    """
    expected = CONFIG_MODEL_FOR_CAPABILITY[capability]
    if not isinstance(config, expected):
        raise ValueError(
            f"config for capability {capability!r} must be a {expected.__name__}, "
            f"got {type(config).__name__}"
        )


# ── the CRUD trio ────────────────────────────────────────────────────────────────────────
class ConnectorConnectionCreate(_StrictBase):
    """A new connection. ``secret`` is WRITE-ONLY plaintext — it is never echoed back.

    ``org_id`` and ``created_by`` are deliberately ABSENT: the service hard-sets both from
    the authenticated caller, never from the body (the mig-116 ``autofill_org_id_by_owner``
    trigger is defence in depth, not the gate). A body field for either would be a
    tenant-selection parameter, which is the D-14 leak with a friendlier name.
    """

    capability: ConnectorCapability
    name: str
    config: ConnectorConfig
    # Plaintext at the API boundary and NOWHERE else: the service encrypts it with the
    # shipped cipher before the row is written, and refuses the write outright when no
    # cipher is configured (D-11's fail-CLOSED inversion).
    secret: str

    @model_validator(mode="after")
    def _config_matches_capability(self) -> "ConnectorConnectionCreate":
        _reject_config_capability_mismatch(self.capability, self.config)
        return self


class ConnectorConnectionUpdate(_StrictBase):
    """All-optional. A present ``secret`` is a REPLACE, never a merge.

    ``capability`` is absent on purpose: changing it would orphan the config shape and the
    stored secret in one edit. Re-pointing a connection at a different vendor is a new row.
    """

    name: str | None = None
    config: ConnectorConfig | None = None
    secret: str | None = None
    is_enabled: bool | None = None


class ConnectorCheckResponse(_StrictBase):
    """The result of ONE credential check (Phase 190 plan 190-15 — UI-SPEC §5c).

    ⚠ **A CHECK RETURNS A VERDICT. IT NEVER RETURNS THE CREDENTIAL, IN ANY FORM.** The same
    T7 rule the response model above enforces applies here and is enforced the same way:
    there is no ``secret`` field, no ``secret_ciphertext`` field, and ``extra='forbid'``
    means an attempt to construct one carrying either RAISES rather than leaking. The check
    runs on the STORED connection precisely so that no plaintext secret ever crosses the
    wire for a non-storage purpose; a response model that could carry one back would undo
    that in the other direction.

    ``ok`` / ``verdict``
        The adapter's OWN verdict, and the value persisted to
        ``connector_connections.last_check_verdict``. Two spellings of one fact because the
        column is a three-member enum (``not_checked`` is only ever written by the create
        and by a secret REPLACE) while the wire wants a boolean the panel can branch on.
    ``identity``
        WHO we authenticated as, as the vendor names it. It is what UI-SPEC §5c renders in
        *"Authenticated as {identity}"*, and it is the half that makes a green check mean
        something: a credential that works for the WRONG account is a distinct failure from
        one that does not work at all. ``None`` on every failure.
    ``host`` / ``port``
        The destination that was contacted, derived from the STORED connection row — never
        from a request body. §5c renders *"at {host}:{port}"*.
    ``bucket``
        ⚠ **UI-SPEC §4d's THREE STATES, kept apart on the wire.** ``refused`` (WE declined
        to open the socket, for a security property) · ``unreachable`` (the address is
        allowed; nothing answered) · ``rejected`` (we reached it and IT said no). ``None``
        on success. §4d names flattening these into one *"could not connect"* as the single
        most likely copy defect on this surface, and a client can only keep them apart if
        the server keeps them apart first.
    ``provider_message``
        The vendor's words VERBATIM — unparaphrased, untranslated, untruncated (071-A, the
        rule UI-SPEC §5b's ``what the host said, verbatim`` block binds). ``""`` when the
        vendor said nothing, never a sentence we invented on its behalf. It is EMPTY for a
        ``refused`` bucket, because on that path nothing was ever contacted and there is no
        vendor to quote.
    ``reason_code``
        The guard's OWN refusal code (``egress.REFUSAL_REASONS``) on a ``refused`` bucket,
        else ``None``. It is the key into UI-SPEC §4c's CLOSED six-row sentence table; a
        client that re-words a refusal instead of keying on this produces a seventh
        sentence nobody ratified.

    **No user-facing sentence is authored here or anywhere below the component layer.** The
    panel composes §5c / §4c / §4d from exported identifiers (plan 190-18), so the copy can
    be asserted by character-identity — a string in a model or an API client is a string
    nobody tests for drift.
    """

    ok: bool
    verdict: Literal["ok", "failed"]
    identity: str | None = None
    host: str = ""
    port: int | None = None
    checked_at: str | None = None
    bucket: Literal["refused", "unreachable", "rejected"] | None = None
    provider_message: str = ""
    reason_code: str | None = None


class ConnectorConnectionResponse(_StrictBase):
    """What a client is allowed to learn about a connection. NO secret, in any form.

    ⚠ Do not add ``secret_ciphertext`` or ``secret`` here. The absence of those two fields
    IS VALIDATION row T7, and ``extra='forbid'`` means an attempt to construct one with
    either raises rather than passes it through. ``config`` is the typed per-capability
    model rather than the raw jsonb dict, so an unexpected key in a stored row is a refusal
    to serve rather than a silent echo — fail-CLOSED in the direction that matters.
    """

    id: str
    org_id: str
    capability: ConnectorCapability
    name: str
    config: ConnectorConfig
    is_enabled: bool = True
    last_checked_at: str | None = None
    last_check_verdict: Literal["not_checked", "ok", "failed"] | None = None
    created_at: str | None = None
    updated_at: str | None = None


__all__ = [
    "ConnectorCapability",
    "SendEmailConfig",
    "CreateTicketConfig",
    "PostMessageConfig",
    "ConnectorConfig",
    "CONFIG_MODEL_FOR_CAPABILITY",
    "ConnectorConnectionCreate",
    "ConnectorConnectionUpdate",
    "ConnectorConnectionResponse",
    "ConnectorCheckResponse",
]
