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
   ``ViewResponse``) — clone the ``metadata_field.py`` create/update/response shape.

NOTE (IN-03 — the 112 CR-01 lesson): there is deliberately NO
``ViewResolveResponse`` model. ``GET /{view_id}/resolve`` returns a plain
``{"documents": [...], "total": N}`` dict with NO ``response_model`` so resolved
rows round-trip the exact metadata blob ``GET /documents`` returns. A typed
response model whose nested ``metadata`` is ``DocumentMetadata`` would have to
keep ``extra="allow"`` or it silently strips ``_source`` / ``_confidence`` from
rows — so the model was removed rather than left dangling one import away from
re-triggering that regression.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel


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
