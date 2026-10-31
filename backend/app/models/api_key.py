"""Phase 293 (START-02; D-02, D-03, D-04, D-11, D-17, D-19) — API key wire models.

Phase 304 (KEY-01/03/04/05/06; D-07, D-08, D-25, D-28, D-30): a key has a ``kind``. The create body
is a union keyed by ``kind`` — a body WITHOUT ``kind`` is the 293 workflow key, byte-for-byte (same
fields, same 422 sentences); ``kind="mcp"`` is ``McpKeyCreateBody``. ``ApiKeyRead`` carries the MCP
fields (defaults on a workflow key) and ``ApiKeyList.mcp`` the catalogue, URL and switch state the
key screen reads — never retyped in the client.

Every field the routes return is DECLARED here: ``response_model`` drops undeclared keys silently
(the three-place lockstep with ``db/api_keys._KEY_COLUMNS`` and ``api/api_keys.py``).

⛔ ``ApiKeyCreated`` is the ONLY model with a ``secret`` field, and no model has a digest field.
The secret exists in exactly one response — the one that creates the key (D-19).
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Discriminator,
    Field,
    StringConstraints,
    Tag,
    field_validator,
)

# 296-06 (293-IN-06): ``needs_task`` — the workflow declares no launch field, so it starts from a
# typed task a key cannot send.
WorkflowRefState = Literal[
    "startable", "unpublished", "deleted", "file_upload", "needs_task", "cannot_run"
]
KeyState = Literal["active", "expired", "revoked"]
KeyKind = Literal["workflow", "mcp"]
# D-28 / D-30: why MCP is off — the deployment switch wins over the org's. ``unknown`` (304-REVIEW
# WR-02): the switches could not be read — still OFF (fail closed), but no switch is named.
McpOff = Literal["org", "deployment", "unknown"]

# D-07 / D-08 — the sentences the key form shows as-is (the client strips "Value error, ").
MCP_EXPIRY_SENTENCE = "An AI tool key must have an expiry: 30, 90 or 365 days."
MCP_EMPTY_FOLDERS_SENTENCE = "Tick at least one folder, or choose All folders I can see."


class ApiKeyWorkflowRef(BaseModel):
    id: str
    name: str
    state: WorkflowRefState


class ApiKeyCall(BaseModel):
    at: datetime
    verb: Literal["start", "read"]
    workflow_id: str | None = None
    workflow_name: str | None = None
    run_id: str | None = None
    ok: bool
    outcome: str | None = None
    reason: str | None = None
    detail: dict | None = None
    tool: str | None = None   # 305-03 (D-53): the MCP tool a call used; None on a workflow key


class ApiKeyFolderRef(BaseModel):
    """A folder an MCP key ticks, named server-side (a folder since deleted drops out)."""

    id: str
    name: str


class ApiKeyRead(BaseModel):
    id: str
    label: str
    key_prefix: str
    workflows: list[ApiKeyWorkflowRef]
    state: KeyState
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    revoked_by_name: str | None = None
    revoked_by_admin: bool = False
    last_used_at: datetime | None = None
    created_at: datetime
    owner_name: str | None = None
    owner_is_you: bool = True
    calls: list[ApiKeyCall] = Field(default_factory=list)
    # Phase 304 — the defaults are a workflow key's values.
    kind: KeyKind = "workflow"
    tools: list[str] | None = None                  # catalogue order, companions included
    folders: list[ApiKeyFolderRef] | None = None    # None = not narrowed by folder
    include_external: bool = False
    org_name: str | None = None                     # the org an MCP key acts in
    mcp_off: McpOff | None = None                   # None on a workflow key, or while MCP is on


class ApiKeyLimits(BaseModel):
    starts_per_minute: int
    reads_per_minute: int
    searches_per_minute: int   # 305-03 (D-54): the AI tool keys' expensive bucket


class McpToolRef(BaseModel):
    """One entry of ``mcp_tool_catalogue.MCP_TOOLS`` (D-11), served in catalogue order."""

    name: str
    group: Literal["read", "ask", "run"]
    label: str
    travels_with: str | None = None


class McpAvailability(BaseModel):
    """D-28 / D-30. ``available`` is the DEPLOYMENT switch (false hides the MCP choice); ``off``
    names the switch that is off, the deployment's winning; ``url`` is ``mcp_url()``."""

    available: bool = False
    off: McpOff | None = None
    url: str | None = None
    tools: list[McpToolRef] = Field(default_factory=list)


class ApiKeyList(BaseModel):
    keys: list[ApiKeyRead]
    limits: ApiKeyLimits
    mcp: McpAvailability = Field(default_factory=McpAvailability)


def _clean_label(v: str) -> str:
    v = v.strip()
    if not 1 <= len(v) <= 60:
        raise ValueError("A key label must be 1 to 60 characters.")
    return v


class ApiKeyCreateBody(BaseModel):
    """D-04: label, one or more published workflows, and an expiry of 30 / 90 / 365 days or
    never (``null``). The default is 90.

    Phase 304: ``kind`` may be omitted (the 293 body) or sent as ``"workflow"``."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["workflow"] = "workflow"
    label: str
    workflow_ids: list[UUID] = Field(min_length=1, max_length=20)
    expires_in_days: Literal[30, 90, 365] | None = 90

    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        return _clean_label(v)

    @field_validator("workflow_ids")
    @classmethod
    def _unique(cls, v: list[UUID]) -> list[UUID]:
        if len(set(v)) != len(v):
            raise ValueError("Each workflow can be listed on a key only once.")
        return v


class McpKeyCreateBody(BaseModel):
    """Phase 304 (KEY-01, KEY-03, KEY-04; D-07, D-08). A personal MCP key.

    ``tools`` is validated and normalised by the route (``normalise_tool_selection``: an empty
    list, an unknown name and a companion without its lead are each refused in one sentence).
    ``folder_ids``: ``None`` = every folder the member can see; an EMPTY list is refused, never
    read as "all". No ``workflow_ids`` (``extra="forbid"`` refuses them) and no "never" expiry.
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["mcp"]
    label: str
    tools: list[Annotated[str, StringConstraints(max_length=64)]] = Field(max_length=32)
    folder_ids: list[UUID] | None = Field(default=None, max_length=500)
    include_external: bool = False
    expires_in_days: Literal[30, 90, 365] = 90

    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        return _clean_label(v)

    @field_validator("expires_in_days", mode="before")
    @classmethod
    def _expiry(cls, v: Any) -> Any:
        if v is None:
            raise ValueError(MCP_EXPIRY_SENTENCE)
        return v

    @field_validator("folder_ids")
    @classmethod
    def _folders(cls, v: list[UUID] | None) -> list[UUID] | None:
        if v is None:
            return None
        if not v:
            raise ValueError(MCP_EMPTY_FOLDERS_SENTENCE)
        return list(dict.fromkeys(v))


def _create_kind(value: Any) -> str | None:
    """The union tag: the body's ``kind``, ``"workflow"`` when absent (the 293 body)."""
    if isinstance(value, dict):
        kind = value.get("kind", "workflow")
    else:
        kind = getattr(value, "kind", None)
    return kind if isinstance(kind, str) else None


ApiKeyCreateRequest = Annotated[
    Union[
        Annotated[ApiKeyCreateBody, Tag("workflow")],
        Annotated[McpKeyCreateBody, Tag("mcp")],
    ],
    Discriminator(_create_kind),
]


class ApiKeyCreated(BaseModel):
    key: ApiKeyRead
    secret: str


class StartableField(BaseModel):
    key: str
    label: str
    required: bool


class StartableWorkflow(BaseModel):
    id: str
    name: str
    fields: list[StartableField]
    startable: bool
    reason: str | None = None


class StartableWorkflowList(BaseModel):
    workflows: list[StartableWorkflow]
    drafts_hidden: int


class PickableFolder(BaseModel):
    """A folder the member can tick on an MCP key, read on their own acting visibility.
    ``source`` is a UI hint only (D-40), never a server-side scope rule."""

    id: str
    name: str
    parent_id: str | None = None
    shared: bool
    source: Literal["mail", "synced"] | None = None


class PickableFolderList(BaseModel):
    folders: list[PickableFolder]


class OrgMcpAccess(BaseModel):
    """The org's MCP switch (D-35), read and written by an org admin."""

    enabled: bool


class OrgMcpAccessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool


class OrgPiiRedaction(BaseModel):
    """305-04 (GUARD-03, D-36): the org's PII redaction switch for AI tool results."""

    enabled: bool


class OrgPiiRedactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool
