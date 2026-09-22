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


class SkillBodyDraftRequest(BaseModel):
    """The brief for ONE proposed skill, sent to POST /experts/draft-skill-body (PACK-15).

    ⛔ Every field is author-supplied text that is spliced into a provider prompt. The
    anti-injection boundary is the service's job (``SKILL_BODY_BRIEF_DELIMITER`` quotes the whole
    block as DATA); this model's job is only to make the shape explicit and typed at the wire.
    """

    skill_name: str = Field(..., min_length=1, max_length=120)
    skill_description: str = Field(..., max_length=1000)
    why_needed: str = Field(default="", max_length=2000, description="Why the Expert needs it")
    expert_name: str = Field(default="", max_length=120)
    expert_description: str = Field(default="", max_length=8000)


class ExpertBundleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120)
    icon: str = Field(default="chart", max_length=64, description="Icon identifier for expert card")
    category: str = Field(default="General", max_length=64, description="Domain category")
    when_to_use: str = Field(default="", max_length=500, description="Guidance on when to consult this expert")
    example_output: str = Field(default="", max_length=4000, description="Sample deliverable or output snippet")
    description: str = Field(default="", max_length=8000)
    scope_mode: ScopeMode = Field(default="restricted")
    tool_floor_enabled: bool = Field(default=True, description="Whether deliverable tools are kept as additive floor")
    member_skills: list[str] = Field(default_factory=list)
    required_connections: list[str] = Field(default_factory=list)
    knowledge_folder_ids: list[UUID] = Field(default_factory=list)
    prompt_suggestions: list[PromptSuggestion] = Field(default_factory=list)
    visibility: Visibility = Field(default="private")
    is_enabled: bool = Field(default=True)


class ExpertBundleCreate(ExpertBundleBase):
    # ⛔ 263-REVIEW.md WR-08 — REQUEST-ONLY, and deliberately NOT on `ExpertBundleBase`:
    # `ExpertBundle` (the response model) extends Base, so a field there would ship back to
    # every caller and into the persisted row. The client names the skills IT CREATED in this
    # authoring session; only those are stamped born-for. `None` means "this client said
    # nothing" and must stamp NOTHING — falling back to `member_skills` is the defect itself,
    # which claimed any long-standing private skill merely ticked in the picker.
    born_skills: list[str] | None = Field(
        default=None,
        description="Skill names CREATED during this authoring session (WR-08). Never persisted.",
    )


class ExpertBundleUpdate(BaseModel):
    """⛔ 263-REVIEW.md WR-02 — every cap here MIRRORS ``ExpertBundleBase``.

    These fields were bare ``str | None``, so ``PATCH`` accepted what ``POST`` refuses:
    ``{"name": ""}`` returned 200 and ``update_expert_bundle`` persisted it, because
    ``allowed_fields`` includes ``name``. A door that accepts what its sibling refuses is
    not a second door.

    ⛔ ``default=None`` IS LOAD-BEARING and must stay on every field.
    ``update_expert_service`` reads this body with ``exclude_unset=True`` — "absent means
    unchanged". A ``Field(...)`` without a default makes the field REQUIRED and breaks every
    partial PATCH in the product. Pinned by ``test_update_fields_all_still_optional``.

    ⛔ ``slug`` IS ABSENT BY DECISION, not by omission (WR-03, operator 2026-09-22): it is
    how ``get_expert_by_slug_service`` resolves, so a rename silently invalidates anything
    holding the old value. The studio renders it ``readOnly`` in edit mode. Pinned by
    ``test_slug_is_not_updatable``.
    """

    # ⛔ 263-REVIEW.md WR-08 — REQUEST-ONLY, and deliberately NOT on `ExpertBundleBase`:
    # `ExpertBundle` (the response model) extends Base, so a field there would ship back to
    # every caller and into the persisted row. The client names the skills IT CREATED in this
    # authoring session; only those are stamped born-for. `None` means "this client said
    # nothing" and must stamp NOTHING — falling back to `member_skills` is the defect itself,
    # which claimed any long-standing private skill merely ticked in the picker.
    born_skills: list[str] | None = Field(
        default=None,
        description="Skill names CREATED during this authoring session (WR-08). Never persisted.",
    )

    name: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=64)
    category: str | None = Field(default=None, max_length=64)
    when_to_use: str | None = Field(default=None, max_length=500)
    example_output: str | None = Field(default=None, max_length=4000)
    description: str | None = Field(default=None, max_length=8000)
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
