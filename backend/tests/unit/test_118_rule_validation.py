"""Phase 118 (CLASS-01) — RuleCreate/RuleUpdate/RuleResponse model-parse + AST op-reject.

The rule models REUSE the ``ViewFilter`` AST verbatim for ``match_expr`` (do NOT redefine
it), so the ``Literal``-discriminated ``op`` rejects an unknown operator at
``model_validate`` for free — the sole parse-time op-reject layer (Pitfall 5: no op-ladder,
no eval). This file proves the model trio:

  * ``RuleCreate`` parses ``{name, match_expr:{op:"and",conditions:[...]}, suggest_folder_id}``
    with ``match_expr`` typed as ``ViewFilter``.
  * An unknown op (``op:"xor"``) in ``match_expr`` raises a Pydantic ``ValidationError``.
  * ``RuleUpdate`` fields are ALL Optional (name/match_expr/suggest_folder_id/enabled) —
    the enable/disable toggle rides UPDATE.
  * ``RuleResponse`` carries id/user_id/name/match_expr(dict)/suggest_folder_id/is_system_global/enabled.

GREEN in THIS plan (Task 3 lands the models). The ``validate_fields`` /
``validate_operands`` reject-path is exercised in Plan 02's router (live integration); here
we cover the AST PARSE-reject.

CONVENTION (mirrors test_114): ``from app... import ...`` is INSIDE each test body so a
not-yet-built symbol never breaks COLLECTION.
"""

from __future__ import annotations

from uuid import uuid4

import pytest


def _good_expr() -> dict:
    return {
        "op": "and",
        "conditions": [
            {"field": "document_type", "op": "eq", "value": "invoice"},
            {"field": "author", "op": "contains", "value": "acme"},
        ],
    }


# ── RuleCreate parses a valid AST; match_expr is a ViewFilter ───────────────────
def test_rule_create_parses_valid_ast():
    from app.models.classification_rule import RuleCreate
    from app.models.document_view import ViewFilter

    folder = uuid4()
    rc = RuleCreate(name="Invoices", match_expr=_good_expr(), suggest_folder_id=folder)
    assert rc.name == "Invoices"
    assert isinstance(rc.match_expr, ViewFilter)
    assert rc.match_expr.op == "and"
    assert len(rc.match_expr.conditions) == 2
    assert rc.suggest_folder_id == folder


def test_rule_create_suggest_folder_optional():
    from app.models.classification_rule import RuleCreate

    rc = RuleCreate(name="No folder", match_expr=_good_expr())
    assert rc.suggest_folder_id is None


# ── unknown op rejected at parse (ViewFilter Literal discriminator) ─────────────
def test_rule_create_unknown_op_rejected():
    from pydantic import ValidationError

    from app.models.classification_rule import RuleCreate

    bad = {
        "op": "and",
        "conditions": [{"field": "document_type", "op": "xor", "value": "invoice"}],
    }
    with pytest.raises(ValidationError):
        RuleCreate(name="bad", match_expr=bad)


def test_rule_create_unknown_top_op_rejected():
    from pydantic import ValidationError

    from app.models.classification_rule import RuleCreate

    bad = {"op": "or", "conditions": []}   # only "and" is allowed at the top
    with pytest.raises(ValidationError):
        RuleCreate(name="bad", match_expr=bad)


# ── RuleUpdate all-Optional (the enable/disable toggle rides UPDATE) ────────────
def test_rule_update_all_optional():
    from app.models.classification_rule import RuleUpdate

    # An empty update is valid (every field optional).
    ru = RuleUpdate()
    assert ru.name is None
    assert ru.match_expr is None
    assert ru.suggest_folder_id is None
    assert ru.enabled is None

    # The enable/disable toggle rides the UPDATE path.
    ru2 = RuleUpdate(enabled=False)
    assert ru2.enabled is False


def test_rule_update_match_expr_is_view_filter():
    from app.models.classification_rule import RuleUpdate
    from app.models.document_view import ViewFilter

    ru = RuleUpdate(match_expr=_good_expr())
    assert isinstance(ru.match_expr, ViewFilter)


# ── RuleResponse carries the full row shape ─────────────────────────────────────
def test_rule_response_shape():
    from app.models.classification_rule import RuleResponse

    rr = RuleResponse(
        id="rule-1",
        user_id="user-1",
        name="Invoices",
        match_expr=_good_expr(),
        suggest_folder_id=uuid4(),
        is_system_global=False,
        enabled=True,
    )
    assert rr.id == "rule-1"
    assert rr.user_id == "user-1"
    assert rr.name == "Invoices"
    assert isinstance(rr.match_expr, dict)   # response carries the raw jsonb dict
    assert rr.is_system_global is False
    assert rr.enabled is True


def test_rule_response_defaults():
    from app.models.classification_rule import RuleResponse

    rr = RuleResponse(id="r", name="n", match_expr=_good_expr())
    assert rr.is_system_global is False
    assert rr.enabled is True
    assert rr.suggest_folder_id is None
    assert rr.rule_scope == "classification"


def test_rule_create_with_rule_scope():
    from app.models.classification_rule import RuleCreate

    rc = RuleCreate(name="Watch invoices", match_expr=_good_expr(), rule_scope="watch")
    assert rc.rule_scope == "watch"

    rc_default = RuleCreate(name="Default scope", match_expr=_good_expr())
    assert rc_default.rule_scope == "classification"


@pytest.mark.asyncio
async def test_watch_rule_refuses_extracted_metadata_at_build_time():
    """SC#3: A watch rule keying on extracted metadata (document_type, etc.) is refused at save time with 422."""
    from fastapi import HTTPException
    from unittest.mock import MagicMock
    from app.api.classification_rules import _validate_match_expr
    from app.models.document_view import ViewFilter

    user = {"id": "00000000-0000-0000-0000-000000000001"}
    supabase = MagicMock()

    # Rule with extracted metadata field "document_type"
    expr = ViewFilter.model_validate({
        "op": "and",
        "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]
    })

    with pytest.raises(HTTPException) as exc:
        await _validate_match_expr(expr, user, supabase, rule_scope="watch")
    assert exc.value.status_code == 422
    assert "document_type" in exc.value.detail
    assert "not available for watch rules" in exc.value.detail


@pytest.mark.asyncio
async def test_watch_rule_accepts_arrival_fields():
    """Watch rules succeed when matching name, mime, path, size, or source facts."""
    from unittest.mock import MagicMock
    from app.api.classification_rules import _validate_match_expr
    from app.models.document_view import ViewFilter

    user = {"id": "00000000-0000-0000-0000-000000000001"}
    supabase = MagicMock()

    expr = ViewFilter.model_validate({
        "op": "and",
        "conditions": [
            {"field": "name", "op": "contains", "value": "Invoice"},
            {"field": "path", "op": "contains", "value": "Accounting"},
            {"field": "mime", "op": "eq", "value": "application/pdf"},
            {"field": "size", "op": "gte", "value": 1024},
            {"field": "date", "op": "gte", "value": "2026-09-01"},
            {"field": "source_system", "op": "eq", "value": "google_drive"},
        ]
    })

    # Does not raise
    await _validate_match_expr(expr, user, supabase, rule_scope="watch")


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["source_state", "ingest_visibility"])
async def test_watch_rule_refuses_document_columns_not_at_arrival(field: str):
    """Fields that exist only on documents table post-ingest cannot be used in arrival watch rules."""
    from fastapi import HTTPException
    from unittest.mock import MagicMock
    from app.api.classification_rules import _validate_match_expr
    from app.models.document_view import ViewFilter

    user = {"id": "00000000-0000-0000-0000-000000000001"}
    supabase = MagicMock()

    expr = ViewFilter.model_validate({
        "op": "and",
        "conditions": [{"field": field, "op": "eq", "value": "active"}]
    })

    with pytest.raises(HTTPException) as exc:
        await _validate_match_expr(expr, user, supabase, rule_scope="watch")
    assert exc.value.status_code == 422
    assert field in exc.value.detail
    assert "not available for watch rules" in exc.value.detail

