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

# The closed external action capability set (Phase 190 / D-04).
EXTERNAL_ACTION_CAPABILITIES: frozenset[str] = frozenset({
    "send_email",
    "create_ticket",
    "post_message",
})


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


AuthType = Literal["static_key", "oauth_byo", "mcp"]
ConnectionStatus = Literal["active", "revoked", "error"]
OAuthProvider = Literal["google", "microsoft", "github"]


class OAuthConnectionConfig(_StrictBase):
    """Configuration facts for an OAuth-authenticated connection (Phase 215)."""

    provider: OAuthProvider
    custom_client_id: str | None = None
    custom_client_secret: str | None = None
    scopes: list[str] = Field(default_factory=list)
    redirect_uri: str | None = None
    account_email: str | None = None
    account_name: str | None = None


ConnectorConfig = SendEmailConfig | CreateTicketConfig | PostMessageConfig | McpConfig | OAuthConnectionConfig

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

    auth_type: AuthType = "static_key"
    status: ConnectionStatus = "active"
    error_message: str | None = None
    capability: ConnectorCapability | None = None
    service_id: ServiceId
    name: NonEmpty
    config: ConnectorConfig = Field(default_factory=McpConfig)
    mcp_server_url: str | None = None
    default_approval_posture: ToolGrantPosture = "ask"
    tool_grants: dict[str, ToolGrantPosture] = Field(default_factory=dict)
    secret: NonEmpty | None = None

    @model_validator(mode="after")
    def _validate_connection_shape(self) -> "ConnectorConnectionCreate":
        """One validator, TWO shapes, and neither may borrow the other's laxity."""
        if self.mcp_server_url and self.capability:
            raise ValueError(
                "a connection may carry a capability or an mcp_server_url, never both: the "
                "executor branches on the tool name first, so the capability on such a row "
                "would never run. Split it into two connections."
            )

        if self.mcp_server_url:
            if not self.mcp_server_url.startswith("https://"):
                raise ValueError("mcp_server_url must be an HTTPS URL")
            return self

        if not self.capability:
            return self

        _reject_config_capability_mismatch(self.capability, self.config)

        if self.secret is None or not str(self.secret).strip():
            raise ValueError("secret is required for a capability connection")
        return self


class ConnectorConnectionUpdate(_StrictBase):
    """All fields optional. ``service_id`` and ``capability`` CANNOT BE MUTATED."""

    name: NonEmpty | None = None
    config: ConnectorConfig | None = None
    secret: NonEmpty | None = None
    is_enabled: bool | None = None
    mcp_server_url: str | None = None
    default_approval_posture: ToolGrantPosture | None = None
    tool_grants: dict[str, ToolGrantPosture] | None = None
    discovered_tools: list[dict[str, Any]] | None = None
    auth_type: AuthType | None = None
    status: ConnectionStatus | None = None
    error_message: str | None = None


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
    """What a client is allowed to learn about a connection. NO secret, in any form."""

    id: str
    org_id: str
    capability: ConnectorCapability | None = None
    service_id: str
    name: str
    auth_type: AuthType = "static_key"
    status: ConnectionStatus = "active"
    error_message: str | None = None
    account_email: str | None = None
    account_name: str | None = None
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


class OAuthTokenResponse(_StrictBase):
    """Safe public projection of a connector token (no ciphertexts!)."""

    id: str
    connection_id: str
    account_email: str | None = None
    account_name: str | None = None
    token_type: str = "Bearer"
    scopes: list[str] = Field(default_factory=list)
    expires_at: str
    status: ConnectionStatus = "active"
    created_at: str | None = None
    updated_at: str | None = None


class OAuthAuthorizeRequest(_StrictBase):
    """Request to begin an OAuth 2.0 authorization code grant flow."""

    provider: OAuthProvider
    connection_id: str | None = None
    custom_client_id: str | None = None
    custom_scopes: list[str] = Field(default_factory=list)


class OAuthAuthorizeResponse(_StrictBase):
    """Response containing provider authorization URL and PKCE/state payload."""

    authorization_url: str
    state: str


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
    "AuthType",
    "ConnectionStatus",
    "OAuthProvider",
    "OAuthConnectionConfig",
    "OAuthTokenResponse",
    "OAuthAuthorizeRequest",
    "OAuthAuthorizeResponse",
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

