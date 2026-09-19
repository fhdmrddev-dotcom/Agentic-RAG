from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field

ScopeMode = Literal["restricted", "biased"]
Visibility = Literal["private", "org", "public"]


class PromptSuggestion(BaseModel):
    title: str = Field(..., description="Short label for the prompt suggestion card")
    prompt: str = Field(..., description="Full prompt text injected on click")


class ExpertBundleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    scope_mode: ScopeMode = Field(default="restricted")
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
    description: str | None = None
    scope_mode: ScopeMode | None = None
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
