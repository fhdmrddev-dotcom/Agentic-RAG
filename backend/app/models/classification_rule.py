"""Pydantic models for classification rules — auto-classification on upload (Phase 118).

The create/update/response trio, cloned from ``document_view.py`` (the SavedView model
shape). The KEY reuse: ``match_expr`` is typed as :class:`~app.models.document_view.ViewFilter`
— the SAME closed filter AST the virtual-folder views use — so the ``Literal``-discriminated
``op`` rejects an unknown operator at ``model_validate`` for free (the sole parse-time
op-reject layer; Pitfall 5: no op-ladder, no eval). DO NOT redefine the AST here.

A classification rule is a metadata-driven *suggestion source* (CLASS-01/02): ``name`` +
the validated ``match_expr`` AST (jsonb) + an optional ``suggest_folder_id`` (the folder the
rule suggests for matching uploads; the FK is ``ON DELETE SET NULL`` — a rule survives its
folder's deletion). ``is_system_global`` is HARD-SET False by the service on create (never trusted
from the caller — globals are service-role/migration-seeded only); ``enabled`` toggles the
rule on/off and rides the UPDATE path (no dedicated toggle endpoint).

NOTE (IN-03 — the 112 CR-01 / 113 IN-03 lesson): a ``RuleResponse`` carries NO document
``metadata``, so a typed response model is safe here (it strips nothing nested). Do NOT add a
``response_model`` ELSEWHERE whose nested ``metadata`` is ``DocumentMetadata`` without
``extra="allow"`` — that silently drops ``_classification`` / ``_source`` / ``_confidence``
from doc rows.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.document_view import ViewFilter  # reuse the AST verbatim (Literal op-reject)


class RuleCreate(BaseModel):
    name: str
    match_expr: ViewFilter  # the closed filter AST — unknown ops 422 at parse (Pitfall 5)
    suggest_folder_id: UUID | None = None
    rule_scope: Literal["watch", "classification"] = "classification"


class RuleUpdate(BaseModel):
    # All-Optional — the enable/disable toggle rides this UPDATE path (no toggle endpoint).
    name: str | None = None
    match_expr: ViewFilter | None = None
    suggest_folder_id: UUID | None = None
    enabled: bool | None = None
    rule_scope: Literal["watch", "classification"] | None = None


class RuleResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    match_expr: dict  # the raw jsonb dict round-tripped to the client
    suggest_folder_id: UUID | None = None
    is_system_global: bool = False
    enabled: bool = True
    rule_scope: str = "classification"
