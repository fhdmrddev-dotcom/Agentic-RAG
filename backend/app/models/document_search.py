"""Request model for ``POST /document-search`` — Phase 271 (FIND-01/02/03).

Document search is its own mode beside RAG (FIND-02): an exact field match over the
caller's visible ``documents`` rows, sorted by a stated server order, paged on the server,
with an exact total. It never returns a passage or a chunk and never ranks.

Why every field is a CLOSED ``Literal`` or a typed id (ASVS V5 / T-271-04):
  * ``extra="forbid"`` on EVERY model here — an unknown key is a 422 at parse, so a chip the
    UI sends but the server does not understand can never be silently ignored (ROADMAP's
    named failure: "a filter the backend silently ignores").
  * Verbs, sorts, version states, date columns, date ops and units are ``Literal`` sets —
    nothing user-typed ever becomes a column name or a PostgREST operator.
  * Every id is a ``UUID``; the name is length-capped; ``limit`` is 1..100; ``dates`` ≤ 3.
  * The 8 relationship verbs are pinned to ``document_relationship_service._INVERSE_LABEL``
    (its 4 keys + 4 values) by ``tests/unit/test_271_relationship_filter.py`` — the
    vocabulary has ONE source and this Literal may not drift from it.

Metadata conditions (document type, "Date in the document" = field ``date``, custom fields)
ride ``filter_expr`` — the SHIPPED ``ViewFilter`` through the shipped compiler (P-10); the
other three dates (added / created in the file / modified in the file) are structure
conditions in ``dates`` with timestamptz day-boundary semantics.

The RESPONSE is a plain dict (no ``response_model``) so each row keeps its exact
``metadata`` blob — the 112 CR-01 lesson.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.document_view import ViewFilter

# The 8 relationship verbs (D-04): the 4 stored ``rel_type`` values (result is the edge
# SOURCE) + their 4 inverse labels (result is the edge TARGET). Pinned to
# ``_INVERSE_LABEL`` by test — never retyped elsewhere.
RelVerb = Literal[
    "supersedes",
    "superseded_by",
    "amends",
    "amended_by",
    "references",
    "referenced_by",
    "attached_to",
    "has_attachment",
]

# D-06: Latest versions (default) / Has earlier versions / Older versions (superseded).
VersionState = Literal["latest", "has_earlier", "older"]

# P-01: the default is "Added to Syrel (newest)" (renamed from the old product name in 276-07).
SortKey = Literal[
    "added_desc",
    "added_asc",
    "document_date_desc",
    "source_modified_desc",
    "source_created_desc",
    "name_asc",
]

DateWhich = Literal["added", "source_created", "source_modified"]
DateOp = Literal["before", "after", "between", "within_next", "older_than"]

_ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_iso_day(value: object) -> bool:
    """True only for a real calendar day written ``YYYY-MM-DD`` (``2019-13-40`` is False)."""
    if not isinstance(value, str) or not _ISO_DAY.match(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


class FindFolder(BaseModel):
    """Folder condition. ``folder_id=None`` means "Not in a folder" (``folder_id IS NULL``)."""

    model_config = ConfigDict(extra="forbid")

    folder_id: UUID | None = None
    include_subfolders: bool = True


class FindAddedBy(BaseModel):
    """Who added the document (270's "Added by" facts — never an email, 270 P-02)."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["me", "connection", "others"]
    connection_id: UUID | None = None

    @model_validator(mode="after")
    def _pairing(self) -> "FindAddedBy":
        if self.kind == "connection" and self.connection_id is None:
            raise ValueError("added_by kind 'connection' requires connection_id")
        if self.kind != "connection" and self.connection_id is not None:
            raise ValueError(f"added_by kind {self.kind!r} does not take connection_id")
        return self


class FindDate(BaseModel):
    """One of the three timestamptz dates (added / created in file / modified in file)."""

    model_config = ConfigDict(extra="forbid")

    which: DateWhich
    op: DateOp
    value: str | int | None = None
    value2: str | None = None
    unit: Literal["days", "weeks", "months"] | None = None

    @model_validator(mode="after")
    def _shape(self) -> "FindDate":
        if self.op in ("before", "after"):
            if not _is_iso_day(self.value):
                raise ValueError(f"date {self.op!r} needs an ISO YYYY-MM-DD value")
            if self.value2 is not None or self.unit is not None:
                raise ValueError(f"date {self.op!r} takes one value only")
        elif self.op == "between":
            if not (_is_iso_day(self.value) and _is_iso_day(self.value2)):
                raise ValueError("date 'between' needs two ISO YYYY-MM-DD values")
            if self.unit is not None:
                raise ValueError("date 'between' takes no unit")
        else:  # within_next / older_than
            if isinstance(self.value, bool) or not isinstance(self.value, int) or self.value < 0:
                raise ValueError(f"date {self.op!r} needs a whole number >= 0")
            if self.value2 is not None:
                raise ValueError(f"date {self.op!r} takes no second value")
        return self


class FindRelationship(BaseModel):
    """``<result> <verb> <picked document>`` (D-04, both directions)."""

    model_config = ConfigDict(extra="forbid")

    verb: RelVerb
    document_id: UUID


class DocumentSearchRequest(BaseModel):
    """The ``POST /document-search`` body (THE WIRE CONTRACT in 271-01-PLAN.md)."""

    model_config = ConfigDict(extra="forbid")

    filter_expr: ViewFilter = Field(default_factory=lambda: ViewFilter(op="and", conditions=[]))
    name: str | None = Field(default=None, max_length=200)
    folder: FindFolder | None = None
    added_by: FindAddedBy | None = None
    dates: list[FindDate] = Field(default_factory=list, max_length=3)
    relationship: FindRelationship | None = None
    version: VersionState = "latest"
    sort: SortKey = "added_desc"
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=25, ge=1, le=100)

    @model_validator(mode="after")
    def _one_date_per_which(self) -> "DocumentSearchRequest":
        seen: set[str] = set()
        for d in self.dates:
            if d.which in seen:
                raise ValueError(f"at most one date condition per {d.which!r}")
            seen.add(d.which)
        return self
