"""Pydantic models for saved metadata-driven views — "virtual folders" (Phase 113).

Two layers live here:

1. The **filter AST** (``ViewCondition`` / ``ViewFilter``) — the forward-compatible
   condition-list shape stored in ``document_views.filter_expr`` (D-113-6). The
   ``op`` fields are ``Literal``-discriminated, which is the DECLARATIVE
   reject-unknown-op mechanism: an incoming ``filter_expr`` with ``op:"or"`` or a
   condition ``op:"gte"`` fails ``ViewFilter.model_validate(...)`` at parse → 422.
   No ``eval``, no dict-walking op-ladder (Pitfall 5). Phase 113 honors ONLY
   ``and`` + ``eq``; Phase 114 widens these ``Literal``s additively (no shape
   change, no data migration of live view rows — the D-113-6 payoff).

2. The **request/response models** (``ViewCreate`` / ``ViewUpdate`` /
   ``ViewResponse`` / ``ViewResolveResponse``) — clone the ``metadata_field.py``
   create/update/response shape. ``ViewResolveResponse.documents`` reuses
   ``DocumentResponse`` from ``models/document.py`` so a resolved view listing is
   byte-shape-identical to ``GET /documents``.

CAUTION (the 112 CR-01 lesson): ``DocumentResponse.metadata`` is
``DocumentMetadata`` with ``model_config = ConfigDict(extra="allow")``. It is
reused here UNCHANGED — do NOT tighten it to ``extra="ignore"`` anywhere in the
resolve path, or ``_source`` / ``_confidence`` are silently stripped from rows.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.document import DocumentResponse


# ── filter AST (stored shape — reject-unknown-op by Literal discriminator) ─────
class ViewCondition(BaseModel):
    field: str
    op: Literal["eq"]  # 113: ONLY eq. 114 widens this Literal additively.
    value: str | int | float | bool  # scalar literal (bound as a param at resolve)


class ViewFilter(BaseModel):
    op: Literal["and"]  # 113: ONLY and (flat AND-of-conditions, D-113-7)
    conditions: list[ViewCondition] = []  # empty = no narrowing (D-113-9)


# ── request/response models (clone metadata_field.py shape) ────────────────────
class ViewCreate(BaseModel):
    name: str
    filter_expr: ViewFilter
    folder_scope: UUID | None = None


class ViewUpdate(BaseModel):
    name: str | None = None
    filter_expr: ViewFilter | None = None
    folder_scope: UUID | None = None


class ViewResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    filter_expr: dict
    folder_scope: UUID | None = None
    is_global: bool = False


class ViewResolveResponse(BaseModel):
    # Reuse DocumentResponse (extra="allow" on its nested metadata intact — 112
    # CR-01) so the view listing round-trips the same blob GET /documents does.
    documents: list[DocumentResponse]
    total: int
