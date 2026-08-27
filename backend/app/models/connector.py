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

from typing import Annotated, Any, Literal, get_args

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

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


# ── WR-05 · the emptiness constraints, declared ONCE ─────────────────────────────────────
# Before this, NO field on `ConnectorConnectionCreate` or on any of the three config models
# carried a length, format or non-empty constraint — `name`, `host`, `from_address`,
# `base_url`, `default_channel` and `secret` all accepted `""`. So *Add a connection* →
# *Sends an email* → **Save**, with nothing typed, produced `{host: "", port: 0,
# from_address: "", tls: "starttls"}` with `secret = ""`, the API answered **201**, and
# `encrypt_secret("")` stored a real `enc:v1:` envelope over an empty password. Settings then
# listed a connection named `""` with a blank *Sends to* column that a workflow author could
# bind, and the first time anyone found out was a FAILED WORKFLOW RUN (`host_not_allowed` —
# `_host_is_allowed` fails closed on an empty `allowed_host`).
#
# Constrained HERE rather than in the panel, because the model is the one place the API, a
# curl request and every future caller all pass through. The panel mirrors it (a disabled
# Save is kinder than a 422) but the panel is not the gate.
NonEmpty = Annotated[str, Field(min_length=1)]

# ⚠ IN-03 is folded in here rather than deferred, because it is the same defect wearing a
# number instead of a string. `configFromDraft` maps an unparseable port to `0`, and
# `egress.validate_destination` computes
# `resolved_port = port or parsed.port or _DEFAULT_PORTS[scheme]` — which treats `0` as FALSY
# and silently substitutes 465/587. Someone who typed `four sixty five` got a working
# connection on a port they never chose, with no indication their input was discarded.
Port = Annotated[int, Field(ge=1, le=65535)]


# ── Phase 211 (D-211-01) · the SERVICE identity ──────────────────────────────────────────
def _normalise_service_id(value: str) -> str:
    """Strip, then refuse what is left if it is empty — the model half of the DB's `btrim`.

    ⚠ `NonEmpty` alone is NOT enough here and the difference is the whole point. `min_length=1`
    accepts `'   '`, which migration 127's
    `CHECK (service_id IS NOT NULL AND length(btrim(service_id)) > 0)` refuses. A model laxer
    than the database does not merely permit a bad row — it converts a 422 the caller can act
    on into a `CheckViolationError` surfacing as a 500, which is D-211-04's stated rule read
    backwards.

    Normalising HERE rather than at the call site means every writer gets the same value: the
    stored identity is what a lookup key must equal, and `' slack'` and `'slack'` are two
    services to any exact-match table.
    """
    stripped = value.strip()
    if not stripped:
        raise ValueError(
            "service_id must name a service — a blank identity is a row nobody can find, and "
            "the database refuses it too (connector_connections_has_a_service_identity)"
        )
    return stripped


# The bound is 64 characters, chosen and stated rather than inherited. It is NEW UNTRUSTED
# INPUT (T-211-10) reaching a text column, so it gets a ceiling like every other constrained
# type in this file — and 64 is generous for the thing it holds (`slack`, `jira`, `smtp`,
# `notion`, a vendor's own product name) while being far too small to be a payload.
# ⚠ IT IS A LENGTH BOUND AND NOTHING ELSE. There is deliberately no pattern, no enum and no
# allow-list: D-211-01 makes this FREE TEXT precisely so an unknown service is storable, and
# a `Literal` here would be migration 116's `capability` mistake moved one column over.
ServiceId = Annotated[str, Field(min_length=1, max_length=64), AfterValidator(_normalise_service_id)]


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

    host: NonEmpty
    port: Port
    from_address: NonEmpty
    # ⚠ `username` stays UNCONSTRAINED-optional on purpose (D-03: the non-secret half of the
    # SMTP credential pair, absent for every host whose login IS the mailbox). Making it
    # NonEmpty would refuse the majority configuration.
    username: str | None = None
    tls: Literal["starttls", "implicit"] = "starttls"


class CreateTicketConfig(_StrictBase):
    """Jira Cloud destination facts. The API token rides ``secret``; the email does not.

    ``account_email`` is the basic-auth USERNAME half (D-03 / R12) — a non-secret fact, and
    keeping it here rather than in ``secret`` is what lets the whole credential pair be
    displayed to an org admin without ever decrypting anything.
    """

    base_url: NonEmpty
    project_key: NonEmpty
    account_email: NonEmpty


class PostMessageConfig(_StrictBase):
    """Slack destination facts — a channel, and NOTHING else (D-02).

    ⚠ There is deliberately no ``base_url`` / ``host`` / ``webhook_url`` field. Slack's API
    host is a module constant in ``app/security/egress.py``; an author-supplied URL here
    would hand the SSRF guard a destination it has to reason about instead of one it can
    refuse to accept in the first place.
    """

    default_channel: NonEmpty


class McpConfig(_StrictBase):
    """Configuration facts for a remote MCP server connection."""

    headers: dict[str, str] = Field(default_factory=dict)


ConnectorConfig = SendEmailConfig | CreateTicketConfig | PostMessageConfig | McpConfig

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


def _reject_config_capability_mismatch(capability: str | None, config: object) -> None:
    """Raise unless ``config`` is the model class ``capability`` binds to.

    Pydantic's smart union already picks a member by shape; this makes the choice
    DETERMINISTIC rather than shape-inferred, so a ``create_ticket`` row can never end up
    carrying a ``PostMessageConfig`` because the submitted dict happened to fit.
    """
    if not capability or capability not in CONFIG_MODEL_FOR_CAPABILITY:
        return
    expected = CONFIG_MODEL_FOR_CAPABILITY[capability]
    if not isinstance(config, expected):
        raise ValueError(
            f"config for capability {capability!r} must be a {expected.__name__}, "
            f"got {type(config).__name__}"
        )


ToolGrantPosture = Literal["allow", "ask", "deny"]


# ── the CRUD trio ────────────────────────────────────────────────────────────────────────
class ConnectorConnectionCreate(_StrictBase):
    """A new connection. ``secret`` is WRITE-ONLY plaintext — it is never echoed back.

    ``org_id`` and ``created_by`` are deliberately ABSENT: the service hard-sets both from
    the authenticated caller, never from the body (the mig-116 ``autofill_org_id_by_owner``
    trigger is defence in depth, not the gate). A body field for either would be a
    tenant-selection parameter, which is the D-14 leak with a friendlier name.
    """

    capability: ConnectorCapability | None = None
    # Phase 211 (D-211-01) — REQUIRED, ON EVERY SHAPE, and that is the decision this model
    # takes rather than inherits. The model and migration 127 then agree EXACTLY, which is
    # D-211-04's rule: a model LAXER than the database yields a 500 where a 422 belongs, and a
    # model STRICTER than it refuses a row the database would have stored. Making it optional
    # "for now" would mean the first surface to read it has to branch on absence forever.
    service_id: ServiceId
    name: NonEmpty
    # WARNING - THIS READ ``ConnectorConfig | dict[str, Any] = Field(default_factory=dict)``
    # FOR THE LENGTH OF ONE PHASE, AND THAT UNION MEMBER IS WHAT SWITCHED WR-05 OFF. A raw
    # dict satisfies ``dict[str, Any]`` outright, so Pydantic never tried to coerce a
    # capability row's config into its bound model and never reported a per-FIELD error -
    # which is the only kind WR-05's fence can see. Driven 2026-08-25: an empty
    # ``send_email`` connection was ACCEPTED. MCP rows need no laxity here after all:
    # ``McpConfig`` is a member of the union in its own right, so the permissive shape is
    # expressed as a MODEL rather than as a hole.
    config: ConnectorConfig = Field(default_factory=McpConfig)
    mcp_server_url: str | None = None
    default_approval_posture: ToolGrantPosture = "ask"
    tool_grants: dict[str, ToolGrantPosture] = Field(default_factory=dict)
    # Plaintext at the API boundary and NOWHERE else: the service encrypts it with the
    # shipped cipher before the row is written, and refuses the write outright when no
    # cipher is configured (D-11's fail-CLOSED inversion). NonEmpty (WR-05): an `enc:v1:`
    # envelope over an empty password is a credential-shaped object that authenticates
    # nowhere, and it looks exactly like a real one in every list, table and picker.
    secret: NonEmpty | None = None

    @model_validator(mode="after")
    def _validate_connection_shape(self) -> "ConnectorConnectionCreate":
        """One validator, TWO shapes, and neither may borrow the other's laxity.

        WARNING - THE FIRST VERSION OF THIS LET AN MCP CONNECTION'S PERMISSIVENESS LEAK ONTO
        EVERY CAPABILITY CONNECTION, and it was measured rather than reasoned about
        (2026-08-25). Widening ``config`` to ``ConnectorConfig | dict[str, Any]`` so an MCP
        row could carry a free-form dict meant Pydantic's smart union stopped coercing a
        capability row's config into its bound model - a raw dict simply satisfied the
        annotation - and the guard beside it read ``isinstance(self.config, _StrictBase)``,
        which is FALSE for exactly those raw dicts. So the deterministic capability-to-config
        binding never ran on the wire path it exists to defend. All three driven directly at
        the model:

            ACCEPTED | send_email, config={}, no secret
            ACCEPTED | send_email, config={'zzz': 1}
            ACCEPTED | send_email carrying a PostMessageConfig-shaped config

        The first is WR-05's own sentence: an empty credential "looks exactly like a real one
        in every list, table and picker". The third is what
        ``_reject_config_capability_mismatch`` was written for.

        The fix is to branch on the SHAPE and validate each one on its own terms, never to
        loosen the shared path.

        ── Phase 211 (D-211-11 / CONN-08): THREE shapes now, and ONE new refusal ───────────
        The two arms below are byte-unchanged. What is added is an arm at each END, and both
        additions follow the conclusion above rather than relaxing it:

          * FIRST, a refusal of the AMBIGUOUS body (both a capability and an MCP URL). ⚠ Its
            POSITION IS LOAD-BEARING: the ambiguous body carries an ``mcp_server_url``, so an
            arm placed after the MCP branch would never run — that branch returns.
          * LAST, the SERVICE-ONLY shape (neither), which REPLACES the old blanket refusal
            that demanded one of the two. It is ACCEPTED, and it deliberately does NOT inherit
            the capability arm's secret or config requirements: an OAuth-authenticated service
            has neither until Phase 215, and demanding one would make the shape unusable in
            the only case it exists for.
            ⚠ The old sentence is deliberately NOT quoted here or anywhere else in the tree.
            `grep -rn` over `backend/` is what proves no caller and no test still expects it,
            and a comment that quotes the string it retired defeats that grep — the same trap
            this repository has recorded twice before.

        ⚠ Nothing here loosens the CAPABILITY arm. ``_reject_config_capability_mismatch`` and
        the secret requirement still run for exactly the rows they always ran for.
        """
        # ── The AMBIGUOUS shape, refused FIRST (D-211-11) ────────────────────────────────
        # ⚠ WHY THIS IS A REFUSAL AND NOT A PREFERENCE. `phase_types.py` branches on
        # `mcp_tool_name` FIRST when it executes an external action, so a row carrying both
        # shapes silently takes the remote-server path and **its capability goes inert** — the
        # connection does something other than what its own verb says, with nothing anywhere
        # reporting a conflict. Migration 127's
        # `connector_connections_shape_is_not_ambiguous` is the same rule at the database (the
        # door a service-role writer takes); this one is what makes the API answer 422 instead
        # of surfacing a CheckViolationError as a 500.
        if self.mcp_server_url and self.capability:
            raise ValueError(
                "a connection may carry a capability or an mcp_server_url, never both: the "
                "executor branches on the tool name first, so the capability on such a row "
                "would never run. Split it into two connections."
            )

        if self.mcp_server_url:
            # ── MCP shape: a URL is the identity, the config is server-specific ──────────
            # HTTPS only. The credential travels in an Authorization header on every call,
            # so cleartext here puts a live token on the wire. `validate_mcp_destination`
            # enforces the same rule at call time; this is the earlier of the two doors.
            if not self.mcp_server_url.startswith("https://"):
                raise ValueError("mcp_server_url must be an HTTPS URL")
            return self

        # ── SERVICE-ONLY shape (CONN-08 / SC#4): neither, and that is now VALID ──────────
        # ⚠ THIS REPLACES the old blanket refusal that demanded one of the two shapes. That
        # sentence is gone from the tree deliberately, not by accident: a test still asserting
        # it would have been a test pinning the defect.
        #
        # A row here names a SERVICE and no way to reach it — an OAuth-authenticated service,
        # which has neither an adapter nor a remote server until Phase 215. It requires no
        # secret and no config, because it HAS neither, and the identity field above is what
        # keeps it from being migration 126's "connection that resolves to nothing": it
        # resolves to a NAME. What it cannot do is act — `/check` and `/discover` each refuse
        # it by name rather than with a bare error.
        if not self.capability:
            return self

        # Pydantic has already coerced `config` into one of the union members at the FIELD,
        # which is what re-applies every per-field NonEmpty constraint and what lets WR-05
        # see `host` / `from_address` / `port` by name. This makes the CHOICE deterministic:
        # a `send_email` row may not carry a `PostMessageConfig` that happened to fit.
        _reject_config_capability_mismatch(self.capability, self.config)

        # WR-05: an `enc:v1:` envelope over an empty password is a credential-shaped object
        # that authenticates nowhere. A capability connection has always required one.
        if self.secret is None or not str(self.secret).strip():
            raise ValueError("secret is required for a capability connection")
        return self


class ConnectorConnectionUpdate(_StrictBase):
    """All-optional. A present ``secret`` is a REPLACE, never a merge.

    ``capability`` is absent on purpose: changing it would orphan the config shape and the
    stored secret in one edit. Re-pointing a connection at a different vendor is a new row.

    ⚠ ``service_id`` IS ALSO ABSENT, AND ALSO ON PURPOSE (Phase 211). Editing a connection's
    identity is CONN-07, which Phase 212 owns TOGETHER WITH the surface that would do it —
    a catalog that can rename a service but has nowhere to show the rename is half a feature.
    Adding the field here without that surface would ship an editable column nothing edits.
    """

    name: NonEmpty | None = None
    config: ConnectorConfig | None = None
    secret: NonEmpty | None = None
    is_enabled: bool | None = None
    mcp_server_url: str | None = None
    default_approval_posture: ToolGrantPosture | None = None
    tool_grants: dict[str, ToolGrantPosture] | None = None
    discovered_tools: list[dict[str, Any]] | None = None


class ConnectorCheckResponse(_StrictBase):
    """The result of ONE credential check (Phase 190 plan 190-15 — UI-SPEC §5c)."""

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
    either raises rather than passes it through.
    """

    id: str
    org_id: str
    capability: ConnectorCapability | None = None
    # Phase 211 — POINT 3 OF THE FIVE-POINT COLUMN LOCKSTEP. Point 4
    # (`connector_service._SELECTABLE_COLUMNS`) follows automatically because that constant is
    # DERIVED from these field names; there is no hand-maintained column list to update.
    # ⚠ POINT 5 IS NOT IN THIS FILE AND IT IS THE ONE THAT BREAKS EVERYTHING: migration 118
    # grants `SELECT` on `connector_connections` COLUMN BY COLUMN, so a field added HERE with
    # no `GRANT SELECT` in a migration makes the projection name a column `authenticated`
    # cannot read — and PostgREST answers `42501` for EVERY read of the table, which reads as a
    # total outage rather than as a missing column. Migration 127 §4 carries that grant.
    # ⚠ REQUIRED, not `str | None`: after migration 127 the database GUARANTEES a non-blank
    # value on every row, so a None here would mean the row is broken and the honest response
    # is a loud ValidationError rather than a silent null a client has to branch on.
    service_id: str
    name: str
    # WARNING - THIS READ ``ConnectorConfig | dict[str, Any] = Field(default_factory=dict)``
    # FOR THE LENGTH OF ONE PHASE, AND THAT UNION MEMBER IS WHAT SWITCHED WR-05 OFF. A raw
    # dict satisfies ``dict[str, Any]`` outright, so Pydantic never tried to coerce a
    # capability row's config into its bound model and never reported a per-FIELD error -
    # which is the only kind WR-05's fence can see. Driven 2026-08-25: an empty
    # ``send_email`` connection was ACCEPTED. MCP rows need no laxity here after all:
    # ``McpConfig`` is a member of the union in its own right, so the permissive shape is
    # expressed as a MODEL rather than as a hole.
    config: ConnectorConfig = Field(default_factory=McpConfig)
    mcp_server_url: str | None = None
    default_approval_posture: ToolGrantPosture = "ask"
    tool_grants: dict[str, ToolGrantPosture] = Field(default_factory=dict)
    discovered_tools: list[dict[str, Any]] = Field(default_factory=list)
    is_enabled: bool = True
    last_checked_at: str | None = None
    last_check_verdict: Literal["not_checked", "ok", "failed"] | None = None
    created_at: str | None = None
    updated_at: str | None = None


class McpDiscoverRequest(_StrictBase):
    """Pre-save probe request to discover tools from an arbitrary remote MCP server."""

    mcp_server_url: NonEmpty
    secret: str | None = None
    timeout: float = Field(default=15.0, ge=1.0, le=60.0)


class McpDiscoverResponse(_StrictBase):
    """Discovered tools returned from pre-save MCP endpoint probe."""

    server_url: str
    tools: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0


__all__ = [
    "ConnectorCapability",
    "ServiceId",
    "ToolGrantPosture",
    "SendEmailConfig",
    "CreateTicketConfig",
    "PostMessageConfig",
    "McpConfig",
    "ConnectorConfig",
    "CONFIG_MODEL_FOR_CAPABILITY",
    "ConnectorConnectionCreate",
    "ConnectorConnectionUpdate",
    "ConnectorConnectionResponse",
    "ConnectorCheckResponse",
    "McpDiscoverRequest",
    "McpDiscoverResponse",
]

