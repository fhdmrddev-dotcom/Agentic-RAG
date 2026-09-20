from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field

ScopeMode = Literal["restricted", "biased"]
Visibility = Literal["private", "org", "public", "granted"]
GranteeType = Literal["user", "role"]


class PromptSuggestion(BaseModel):
    title: str = Field(..., description="Short label for the prompt suggestion card")
    prompt: str = Field(..., description="Full prompt text injected on click")


class ExpertGrantBase(BaseModel):
    grantee_type: GranteeType = Field(..., description="Target grantee: user or role")
    grantee_id: str = Field(..., description="User UUID string or role slug")


class ExpertGrantCreate(ExpertGrantBase):
    pass


class ExpertGrant(ExpertGrantBase):
    id: UUID
    expert_id: UUID
    created_at: datetime


class ExpertBundleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120)
    icon: str = Field(default="chart", max_length=64, description="Icon identifier for expert card")
    category: str = Field(default="General", max_length=64, description="Domain category")
    when_to_use: str = Field(default="", max_length=500, description="Guidance on when to consult this expert")
    example_output: str = Field(default="", max_length=1000, description="Sample deliverable or output snippet")
    description: str = Field(default="", max_length=1000)
    scope_mode: ScopeMode = Field(default="restricted")
    tool_floor_enabled: bool = Field(default=True, description="Whether deliverable tools are kept as additive floor")
    member_skills: list[str] = Field(default_factory=list)
    required_connections: list[str] = Field(default_factory=list)
    knowledge_folder_ids: list[UUID] = Field(default_factory=list)
    prompt_suggestions: list[PromptSuggestion] = Field(default_factory=list)
    visibility: Visibility = Field(default="private")
    is_enabled: bool = Field(default=True)


class ExpertBundleCreate(ExpertBundleBase):
    pass


class ExpertBundleUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    category: str | None = None
    when_to_use: str | None = None
    example_output: str | None = None
    description: str | None = None
    scope_mode: ScopeMode | None = None
    tool_floor_enabled: bool | None = None
    member_skills: list[str] | None = None
    required_connections: list[str] | None = None
    knowledge_folder_ids: list[UUID] | None = None
    prompt_suggestions: list[PromptSuggestion] | None = None
    visibility: Visibility | None = None
    is_enabled: bool | None = None


class ExpertBundle(ExpertBundleBase):
    id: UUID
    org_id: UUID | None = None
    created_by: UUID
    is_system: bool = False
    created_at: datetime
    updated_at: datetime
