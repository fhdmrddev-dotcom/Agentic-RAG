"""Phase 275 (RET-01..04) — the /retention wire contract.

Request models are ``extra="forbid"``: an unknown key is a 422, never silently ignored. Validation
messages are the UI-SPEC S2/S3 sentences, so a server refusal reads the same as the inline form error.

⚠ One stored policy has ONE scope (migration 204's ``retention_policies_scope_shape``: a folder XOR a
document type). The editor's rule "A policy needs a document type, a folder, or both." therefore
refuses NEITHER here, and a draft carrying BOTH is refused with its own sentence (make two
policies) — see the 275-03 SUMMARY deviation.
"""
from __future__ import annotations

import calendar
from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.retention.periods import add_period

Unit = Literal["days", "months", "years"]
Clock = Literal["document_date", "date_added"]
Action = Literal["archive", "delete", "review"]

NAME_REQUIRED = "Give the policy a name."
SCOPE_REQUIRED = "A policy needs a document type, a folder, or both."
SCOPE_ONE_ONLY = "A policy covers one folder or one document type. Make a second policy for the other."
STAGE2_AFTER = "The delete step must come after the archive step."
STAGE2_ONLY_AFTER_ARCHIVE = "A later delete step is only possible when the policy archives first."
STAGE2_BOTH = "Give the delete step a number and a unit."
MATTER_REQUIRED = "Name the matter."
REASON_REQUIRED = "Say why it is held."
PICK_ONE = "Pick at least one folder or document."

# Reference days for "stage 2 is after stage 1 for EVERY clock date": every month start and month
# end across a leap year and a normal one (the month-end clamp is where days and months disagree).
def _build_reference_dates() -> tuple[date, ...]:
    out: list[date] = []
    for y in (2023, 2024):
        for m in range(1, 13):
            out += [date(y, m, 1), date(y, m, 28), date(y, m, calendar.monthrange(y, m)[1])]
    return tuple(out)


_REFERENCE_DATES = _build_reference_dates()


def _reference_dates() -> tuple[date, ...]:
    return _REFERENCE_DATES


class PolicyDraft(BaseModel):
    """What the editor submits for Preview and for Save."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=200)
    document_type_norm: Optional[str] = Field(default=None, max_length=200)
    folder_id: Optional[UUID] = None
    include_subfolders: bool = True
    clock: Clock
    stage1_value: int = Field(ge=1, le=10000)
    stage1_unit: Unit
    stage1_action: Action
    stage2_value: Optional[int] = Field(default=None, ge=1, le=10000)
    stage2_unit: Optional[Unit] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError(NAME_REQUIRED)
        return v

    @field_validator("document_type_norm")
    @classmethod
    def _type(cls, v: Optional[str]) -> Optional[str]:
        v = (v or "").strip().lower()
        return v or None

    @model_validator(mode="after")
    def _shape(self) -> "PolicyDraft":
        if self.folder_id is None and self.document_type_norm is None:
            raise ValueError(SCOPE_REQUIRED)
        if self.folder_id is not None and self.document_type_norm is not None:
            raise ValueError(SCOPE_ONE_ONLY)
        if (self.stage2_value is None) != (self.stage2_unit is None):
            raise ValueError(STAGE2_BOTH)
        if self.stage2_value is not None:
            if self.stage1_action != "archive":
                raise ValueError(STAGE2_ONLY_AFTER_ARCHIVE)
            for d in _reference_dates():
                if add_period(d, self.stage2_value, self.stage2_unit) <= add_period(d, self.stage1_value, self.stage1_unit):
                    raise ValueError(STAGE2_AFTER)
        return self

    def to_row(self) -> dict:
        """The stored shape (migration 204 columns)."""
        return {
            "name": self.name,
            "scope_kind": "folder" if self.folder_id is not None else "class",
            "folder_id": str(self.folder_id) if self.folder_id else None,
            "include_subfolders": bool(self.include_subfolders) if self.folder_id is not None else True,
            "document_type_norm": self.document_type_norm,
            "clock": self.clock,
            "stage1_value": self.stage1_value,
            "stage1_unit": self.stage1_unit,
            "stage1_action": self.stage1_action,
            "stage2_value": self.stage2_value,
            "stage2_unit": self.stage2_unit,
            "stage2_action": "delete" if self.stage2_value is not None else None,
        }


class PreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    draft: PolicyDraft
    #: The policy being edited; absent for a new policy.
    policy_id: Optional[UUID] = None


class _Ids(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_ids: list[UUID] = Field(default_factory=list, max_length=500)
    folder_ids: list[UUID] = Field(default_factory=list, max_length=50)


class HoldCreate(_Ids):
    name: str = Field(max_length=200)
    reason: str = Field(max_length=4000)

    @field_validator("name")
    @classmethod
    def _matter(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError(MATTER_REQUIRED)
        return v

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError(REASON_REQUIRED)
        return v

    @model_validator(mode="after")
    def _one(self) -> "HoldCreate":
        if not self.document_ids and not self.folder_ids:
            raise ValueError(PICK_ONE)
        return self


class HoldCoverageAdd(_Ids):
    @model_validator(mode="after")
    def _one(self) -> "HoldCoverageAdd":
        if not self.document_ids and not self.folder_ids:
            raise ValueError(PICK_ONE)
        return self


class HoldCount(_Ids):
    pass


class HoldRelease(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: Optional[str] = Field(default=None, max_length=4000)


class ConfirmBatch(BaseModel):
    """D-03 / D-10: ids are the queue rows' latest document ids; ``typed_count`` must equal the deletes."""

    model_config = ConfigDict(extra="forbid")

    delete_ids: list[UUID] = Field(default_factory=list, max_length=1000)
    keep_ids: list[UUID] = Field(default_factory=list, max_length=1000)
    archive_ids: list[UUID] = Field(default_factory=list, max_length=1000)
    typed_count: int = Field(ge=0)


class DocumentStatesRequest(_Ids):
    pass


# ── responses ───────────────────────────────────────────────────────────────────────────────

class RetentionSummary(BaseModel):
    sweep_enabled: bool
    sweep_hour_utc: int
    last_run_at: Optional[datetime] = None
    last_status: Optional[str] = None
    last_error: Optional[str] = None
    next_run_at: Optional[datetime] = None
    counts: dict[str, int]


class PolicyTonight(BaseModel):
    due_now: int
    undecidable: int
    next_due: Optional[date] = None


class PolicyOut(BaseModel):
    id: UUID
    name: str
    scope_kind: str
    folder_id: Optional[UUID] = None
    folder_path: Optional[str] = None
    include_subfolders: bool = True
    document_type_norm: Optional[str] = None
    clock: str
    stage1_value: int
    stage1_unit: str
    stage1_action: str
    stage2_value: Optional[int] = None
    stage2_unit: Optional[str] = None
    stage2_action: Optional[str] = None
    revision: int
    previewed_revision: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    scope_text: str
    kept_for_text: str
    rule_text: str
    #: None when tonight's numbers could not be computed (an incomplete org read).
    tonight: Optional[PolicyTonight] = None


class PolicyList(BaseModel):
    policies: list[PolicyOut]
    evaluation_incomplete: bool = False


class PreviewRow(BaseModel):
    document_id: UUID
    name: str
    folder_path: Optional[str] = None
    document_date: Optional[date] = None
    due_at: Optional[date] = None
    kind: str
    why: str = ""
    other_policy_name: Optional[str] = None
    hold_names: list[str] = Field(default_factory=list)
    kept_by: Optional[str] = None
    kept_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None


class PreviewBuckets(BaseModel):
    act: list[PreviewRow]
    hold: list[PreviewRow]
    undecidable: list[PreviewRow]
    kept: list[PreviewRow]
    not_yet: list[PreviewRow]
    already: list[PreviewRow]


class PreviewOut(BaseModel):
    draft_hash: str
    action: str
    has_stage2: bool
    buckets: PreviewBuckets
    counts: dict[str, int]
    private_not_covered: int


class DocumentTypeOut(BaseModel):
    value: str
    count: int


class HoldOut(BaseModel):
    id: UUID
    name: str
    reason: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    released_by_name: Optional[str] = None
    release_note: Optional[str] = None
    active: bool
    document_count: int = 0
    folder_ids: list[UUID] = Field(default_factory=list)
    folder_paths: list[str] = Field(default_factory=list)
    #: Documents held today (families). None when it could not be counted — never a fake 0.
    held_today: Optional[int] = None


class HoldList(BaseModel):
    active: list[HoldOut]
    released: list[HoldOut]


class HoldCountOut(BaseModel):
    count: int


class QueueRow(BaseModel):
    document_id: UUID
    name: str
    folder_path: Optional[str] = None
    document_date: Optional[date] = None
    due_since: Optional[date] = None
    kind: str
    found_at: Optional[datetime] = None


class SkippedNote(BaseModel):
    name: str
    why: str


class QueueBatch(BaseModel):
    policy_id: UUID
    policy_name: str
    kind: Literal["delete", "review"]
    scope_text: str
    kept_for_text: str
    found_at: Optional[datetime] = None
    rows: list[QueueRow]
    held: list[SkippedNote]
    undecidable: list[SkippedNote]


class QueueList(BaseModel):
    batches: list[QueueBatch]
    total: int


class ConfirmOut(BaseModel):
    deleted: list[dict[str, Any]]
    did_not_delete: list[dict[str, Any]]
    kept: list[dict[str, Any]]
    archived: list[dict[str, Any]]
    not_found: list[dict[str, Any]]
    skipped: list[dict[str, Any]]
    #: 275-REVIEW B-WR-04: families that failed for a non-hold reason (nothing of them was
    #: committed; their queue row stays). The batch continues past them.
    failed: list[dict[str, Any]] = Field(default_factory=list)
    #: Paths of committed deletes whose bytes could not be removed (also on the deleted receipt).
    bytes_not_removed: list[str] = Field(default_factory=list)


class HistoryRow(BaseModel):
    id: UUID
    action: str
    #: The ✎ write mark (062-A); a dry run is a read and carries none.
    written: bool
    document_id: Optional[UUID] = None
    document_name: Optional[str] = None
    policy_name: Optional[str] = None
    hold_name: Optional[str] = None
    #: A person's name, "Nightly sweep", or "a former member" when the account is gone.
    actor_name: str
    detail: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class HistoryPage(BaseModel):
    rows: list[HistoryRow]
    offset: int
    has_more: bool


class DocumentSection(BaseModel):
    kind: Literal[
        "hold", "archived", "delete_pending", "archives_tonight", "in_review", "no_date", "disagree",
        "kept", "unarchived", "not_due", "none",
    ]
    policy_name: Optional[str] = None
    other_policy_name: Optional[str] = None
    due_at: Optional[date] = None
    archived_at: Optional[datetime] = None
    kept_by: Optional[str] = None
    kept_at: Optional[datetime] = None
    rule_text: Optional[str] = None


class DocumentState(BaseModel):
    document_id: UUID
    chip: Optional[str] = None
    source_chip: Optional[str] = None
    held: bool
    hold_line: Optional[str] = None
    #: ORG ADMINS ONLY (D-17). Absent from a member's payload.
    hold_names: Optional[list[str]] = None
    archived: bool
    can_unarchive: bool
    section: DocumentSection


class FolderPolicyLine(BaseModel):
    kind: Literal["own", "inherited"]
    policy_id: UUID
    policy_name: str
    action: str
    kept_for_text: str
    rule_text: str
    from_folder_path: Optional[str] = None


class FolderState(BaseModel):
    folder_id: UUID
    policy: Optional[FolderPolicyLine] = None
    held: bool
    #: ORG ADMINS ONLY (D-17). Absent from a member's payload.
    hold_names: Optional[list[str]] = None


class DocumentStatesOut(BaseModel):
    documents: list[DocumentState]
    folders: list[FolderState]
    can_manage: bool


class SweepRunOut(BaseModel):
    status: str
    counts: dict[str, int] = Field(default_factory=dict)
    error: Optional[str] = None


class UnarchiveOut(BaseModel):
    document_id: UUID
    name: str
    policy_name: str
    skip_written: bool


class PolicyDeletedOut(BaseModel):
    id: UUID
    name: str
