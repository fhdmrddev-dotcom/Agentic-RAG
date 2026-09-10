"""Classification-rule CRUD router (Phase 118, CLASS-01).

The thin composition layer that turns the Plan 01 matcher + the Plan-02 CRUD
service into a live, leak-safe API surface for `/classification-rules`. Cloned from
`api/document_views.py` (the CRUD half only — there is no resolve route here; a rule
is evaluated on upload by the ingest splice, Plan 03, not resolved on demand):

  - CRUD (`GET/POST/PATCH/DELETE`): create validates the `match_expr` AST fields +
    operands against the live whitelist (→ 422 on an unknown/`_`-prefixed field or a
    malformed operand), the service hard-sets `is_system_global=False` + `enabled=True`
    (T-118-02-01), and a fire-and-forget `classification.rule.create` audit row is
    written (the enum is LIVE in VALID_ACTION_TYPES). Every cross-user/unseeable miss
    collapses to a generic 404, NEVER the forbidden status — no existence leak.

  - UPDATE validates ownership FIRST (clone document_views.py:154-162) so an
    unowned/absent id uniformly 404s regardless of whether the submitted `match_expr`
    is valid — no 422-vs-404 ordering oracle. `get_rule` is own-OR-global, so STRICT
    ownership is required for update (a global rule the caller does not own is not
    updatable). The `enabled` toggle rides this UPDATE path (no dedicated endpoint).

The route functions return `RuleResponse` instances (not plain dicts) so the live
integration tests can call the coroutines directly and read `.is_system_global` / `.id` /
`.enabled`; FastAPI's `response_model` still serializes them identically at the HTTP
boundary.

NOTE (the 112 CR-01 / 113 IN-03 lesson): `RuleResponse` carries NO document
`metadata`, so this typed response model strips nothing nested (it is IN-03-safe).

The `match_expr` field validators (`validate_fields` / `validate_operands`) and the
field-meta builder (`_build_field_meta`) are the SAME ones the document-views router
runs — reused verbatim, never re-derived (so a rule's "would match" preview, built on
the same compiler, agrees with what these validators accept).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
from app.models.classification_rule import RuleCreate, RuleResponse, RuleUpdate
from app.services import classification_rule_service, view_filter_compiler
from app.services.audit_service import write_audit_entry
from app.services.document_view_resolver import _build_field_meta

# Re-exported so the live integration tests (test_118_rule_crud.py) can construct
# request bodies as `classification_rules.RuleCreate(...)` / `.RuleUpdate(...)`.
__all__ = ["router", "RuleCreate", "RuleUpdate", "RuleResponse", "WATCH_ALLOWED_FIELDS"]

router = APIRouter(prefix="/classification-rules", tags=["classification-rules"])

# Fields available on file arrival / preview (RULES-01 / SC#1 / SC#3).
# Extracted metadata (document_type, topics, summary, author, custom defs) is NOT
# yet available at arrival time and is rejected at build time for watch rules.
WATCH_ALLOWED_FIELDS: frozenset[str] = frozenset({
    "name",
    "filename",
    "title",
    "path",
    "source_path",
    "mime",
    "type",
    "mime_type",
    "size",
    "file_size",
    "source_system",
    "source_connection_id",
    "date",
})


async def _validate_match_expr(
    match_expr,
    current_user: dict,
    supabase: Client,
    rule_scope: str = "classification",
) -> None:
    """Validate the AST fields + operands against the scope-appropriate whitelist (→ 422 on a bad field).

    For ``rule_scope == 'watch'`` (SC#3):
      Enforces ``WATCH_ALLOWED_FIELDS`` strictly. Any condition naming an extracted
      metadata field (e.g. document_type, topics, summary, author, language, or custom fields)
      is refused at build time with 422 Unprocessable Entity and an explicit reason.

    For ``rule_scope == 'classification'``:
      Enforces the live metadata whitelist (built-ins ∪ enabled custom defs ∪ source facts).

    Operand validation (``validate_operands``) runs for both scopes.
    """
    try:
        if rule_scope == "watch":
            for c in match_expr.conditions:
                if c.field.startswith("_"):
                    raise ValueError(f"field {c.field!r} is not filterable (reserved prefix)")
                if c.field not in WATCH_ALLOWED_FIELDS:
                    raise ValueError(
                        f"field {c.field!r} is not available for watch rules: watch rules "
                        "evaluate on file arrival before extraction. Extracted metadata like "
                        f"{c.field!r} can only be used in classification rules."
                    )
            view_filter_compiler.validate_operands(match_expr, set())
        else:
            whitelist, number_fields = await _build_field_meta(current_user["id"], supabase)
            view_filter_compiler.validate_fields(match_expr, whitelist | WATCH_ALLOWED_FIELDS)
            view_filter_compiler.validate_operands(match_expr, number_fields)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("", response_model=list[RuleResponse])
async def list_rules(
    rule_scope: str | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List the caller's own rules plus global ones (deduped, ordered by name).

    Optionally filters by ``rule_scope`` ('watch' | 'classification').
    """
    rows = await classification_rule_service.list_rules(
        current_user["id"], rule_scope=rule_scope, supabase=supabase
    )
    return [RuleResponse(**r) for r in rows]


@router.post("", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: RuleCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create an owner-private classification rule + write a classification.rule.create audit row.

    Validates every `match_expr` AST field + operand against the scope whitelist BEFORE
    the write (→ 422 on an unknown/out-of-scope field). The service hard-sets
    `is_system_global=False` + `enabled=True` (T-118-02-01); the body never supplies them.
    """
    # 1. Field-whitelist + operand validation at SAVE → 422 on an out-of-scope field (SC#3).
    await _validate_match_expr(body.match_expr, current_user, supabase, rule_scope=body.rule_scope)

    # 2. Persist (service hard-sets is_system_global=False + enabled=True; match_expr stored
    #    as the validated AST dict via model_dump()).
    created = await classification_rule_service.create_rule(
        user_id=current_user["id"],
        name=body.name,
        match_expr=body.match_expr.model_dump(),
        suggest_folder_id=body.suggest_folder_id,
        rule_scope=body.rule_scope,
        supabase=supabase,
    )

    # 3. Fire the governance receipt. write_audit_entry is async and SWALLOWS errors,
    #    so the LIVE round-trip is the real verification
    #    (test_118_rule_crud.py::test_create_writes_rule_create_audit).
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="classification.rule.create",
        metadata={"rule_id": created["id"], "name": body.name, "rule_scope": body.rule_scope},
        supabase=supabase,
    )
    return RuleResponse(**created)


@router.patch("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Update an owned rule (404 on a cross-user miss, never the forbidden status).

    The `enabled` toggle rides this path. If `match_expr` or `rule_scope` is present,
    re-run the scope whitelist + operand validation before the write.
    """
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Ownership BEFORE validation: confirm the caller OWNS this rule before running
    # match_expr validation, so an unowned/absent id uniformly returns 404 regardless
    # of whether the submitted match_expr is valid — no 422-vs-404 ordering oracle.
    # get_rule is own-OR-global, so require STRICT ownership here: a global rule the
    # caller does not own is not updatable either.
    existing = await classification_rule_service.get_rule(
        rule_id, current_user["id"], supabase=supabase
    )
    if existing is None or str(existing.get("user_id")) != str(current_user["id"]):
        raise HTTPException(status_code=404, detail="Rule not found")  # NEVER the forbidden status — no existence leak

    target_scope = body.rule_scope or existing.get("rule_scope") or "classification"

    # Re-validate the AST fields + operands if the update carries a new match_expr or new rule_scope.
    if body.match_expr is not None:
        await _validate_match_expr(body.match_expr, current_user, supabase, rule_scope=target_scope)
        # Store the validated AST as a plain dict (jsonb), not the Pydantic model.
        data["match_expr"] = body.match_expr.model_dump()
    elif body.rule_scope is not None and body.rule_scope != existing.get("rule_scope"):
        from app.models.document_view import ViewFilter
        flt = ViewFilter.model_validate(existing.get("match_expr") or {})
        await _validate_match_expr(flt, current_user, supabase, rule_scope=target_scope)

    # suggest_folder_id (a UUID) must serialize to str for the column.
    if body.suggest_folder_id is not None:
        data["suggest_folder_id"] = str(body.suggest_folder_id)

    updated = await classification_rule_service.update_rule(
        current_user["id"], rule_id, data, supabase=supabase
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Rule not found")  # NEVER the forbidden status — defense-in-depth
    return RuleResponse(**updated)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Delete an owned rule (404 on a cross-user miss, never the forbidden status)."""
    removed = await classification_rule_service.delete_rule(
        current_user["id"], rule_id, supabase=supabase
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Rule not found")  # NEVER the forbidden status
