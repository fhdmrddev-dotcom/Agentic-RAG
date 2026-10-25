"""Phase 293 (START-02; D-02, D-03, D-04, D-11, D-17, D-19) — API key wire models.

Every field the routes return is DECLARED here: ``response_model`` drops undeclared keys silently
(the three-place lockstep with ``db/api_keys._KEY_COLUMNS`` and ``api/api_keys.py``).

⛔ ``ApiKeyCreated`` is the ONLY model with a ``secret`` field, and no model has a digest field.
The secret exists in exactly one response — the one that creates the key (D-19).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

WorkflowRefState = Literal["startable", "unpublished", "deleted", "file_upload", "cannot_run"]
KeyState = Literal["active", "expired", "revoked"]


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


class ApiKeyLimits(BaseModel):
    starts_per_minute: int
    reads_per_minute: int


class ApiKeyList(BaseModel):
    keys: list[ApiKeyRead]
    limits: ApiKeyLimits


class ApiKeyCreateBody(BaseModel):
    """D-04: label, one or more published workflows, and an expiry of 30 / 90 / 365 days or
    never (``null``). The default is 90."""

    model_config = ConfigDict(extra="forbid")

    label: str
    workflow_ids: list[UUID] = Field(min_length=1, max_length=20)
    expires_in_days: Literal[30, 90, 365] | None = 90

    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 60:
            raise ValueError("A key label must be 1 to 60 characters.")
        return v

    @field_validator("workflow_ids")
    @classmethod
    def _unique(cls, v: list[UUID]) -> list[UUID]:
        if len(set(v)) != len(v):
            raise ValueError("Each workflow can be listed on a key only once.")
        return v


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
