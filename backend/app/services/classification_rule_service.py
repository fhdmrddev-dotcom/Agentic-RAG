"""Classification-rule CRUD data-access service (Phase 118, CLASS-01).

The data-access core behind the `/classification-rules` router. Cloned almost
verbatim from `document_view_service.py` (the Phase 113 saved-view CRUD service)
so the live-DB integration tests (`test_118_rule_crud.py`) can drive
create/list/get/update/delete directly against :54322 without a FastAPI
TestClient + JWT.

A classification rule is a metadata-driven *suggestion source* (D-118-2): `name` +
the validated `match_expr` AST (jsonb) + an optional `suggest_folder_id` (the folder
the rule suggests for matching uploads; the FK is `ON DELETE SET NULL` — a rule
survives its folder's deletion). The rule NEVER moves a document at create — the
move happens only when the user accepts the suggestion (the accept endpoint, Plan 03).

Security invariants (T-118-02-01 / T-118-02-02 / T-118-02-03):
  - create_rule HARD-SETS is_system_global=False and enabled=True (never trusts a caller
    arg; the RLS WITH CHECK at migration 071 forces is_system_global on INSERT/UPDATE too —
    this hard-set is defense-in-depth). Globals are service-role / migration-seeded
    only, exactly like global folders, skills and views.
  - get_rule gates reads to own-OR-global (`.or_(...is_system_global.eq.true)`); a not-
    readable id collapses to None so the router returns 404-not-403 (no existence
    leak).
  - update_rule / delete_rule are own-scoped (`.eq("user_id", caller)`) and collapse
    a cross-user miss to None/False the router maps to 404-not-403. The `enabled`
    toggle is a plain UPDATE column — it rides update_rule (no dedicated endpoint).

Field-whitelist validation (D-113-10 analog) does NOT live here — it runs in the
router (Plan 02) via `view_filter_compiler.validate_fields` / `validate_operands`
on create AND update, before the DB write. This module is pure persistence.

All Supabase `.execute()` calls run through `aexec` (run_in_threadpool) so an
async caller never blocks the event loop (D-v2.5-01).

Every function takes an optional ``supabase`` client (defaults to the singleton
``get_supabase()``). The router passes the DI-injected client; the live-DB tests
inject a real local client built from backend/.env.
"""

from supabase import Client

from app.dependencies import get_supabase
from app.utils.db import aexec, coerce_uid

_TABLE = "classification_rules"


def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()


# The UUID-coercion that makes the one runtime-value-into-`.or_()`-DSL spot safe by
# construction (the WR-02 hardening) now lives in app.utils.db; kept as a local alias
# so the call sites read unchanged (AR-118-01 hoist).
_uid = coerce_uid


async def create_rule(
    user_id,
    name: str,
    match_expr: dict,
    suggest_folder_id=None,
    rule_scope: str = "classification",
    supabase: Client | None = None,
) -> dict:
    """Insert a classification rule owned by ``user_id`` — never global.

    ``match_expr`` arrives as an already-validated AST dict (the router runs
    ``view_filter_compiler.validate_fields`` + ``model_dump()`` before calling this).
    ``is_system_global=False`` and ``enabled=True`` are HARD-SET in the inserted payload and
    NEVER read from any caller field (T-118-02-01; RLS WITH CHECK forces is_system_global too
    — defense-in-depth). ``suggest_folder_id`` is stored as ``str(...)`` (a UUID) or
    None. ``rule_scope`` defaults to 'classification' ('watch' | 'classification').
    """
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "name": name,
        "match_expr": match_expr,  # validated AST jsonb (already passed validate_fields)
        "suggest_folder_id": str(suggest_folder_id) if suggest_folder_id else None,
        "rule_scope": rule_scope or "classification",
        "is_system_global": False,  # HARD-SET — never from the caller (T-118-02-01)
        "enabled": True,  # HARD-SET — a new rule is on; the toggle rides update_rule
    }
    result = await aexec(client.table(_TABLE).insert(payload))
    return result.data[0]


async def list_rules(
    user_id,
    rule_scope: str | None = None,
    supabase: Client | None = None,
) -> list[dict]:
    """Return the caller's own rules plus global ones, deduped by id, ordered by name.

    Mirrors the view / field-def / skills list shape (own + global via OR predicate).
    Optionally filters by ``rule_scope`` ('watch' | 'classification').
    """
    client = _client(supabase)
    query = (
        client.table(_TABLE)
        .select("*")
        .or_(f"user_id.eq.{_uid(user_id)},is_system_global.eq.true")
    )
    if rule_scope:
        query = query.eq("rule_scope", rule_scope)
    result = await aexec(query.order("name"))
    seen: set = set()
    out: list[dict] = []
    for row in result.data or []:
        if row["id"] not in seen:
            seen.add(row["id"])
            out.append(row)
    return out


async def get_rule(rule_id, user_id, supabase: Client | None = None) -> dict | None:
    """Return the rule if the caller can read it (own OR global), else None.

    The readability check the router's 404-not-403 depends on: a rule id the caller
    can't see (not own AND not global) → empty result → None. No existence leak.
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .select("*")
        .eq("id", rule_id)
        .or_(f"user_id.eq.{_uid(user_id)},is_system_global.eq.true")  # own OR global; not-readable → empty
    )
    return (result.data or [None])[0]


async def update_rule(
    user_id, rule_id: str, data: dict, supabase: Client | None = None
) -> dict | None:
    """Own-scoped update; returns the updated row or None on a cross-user miss (→404).

    STRICTLY own-scoped (`.eq("user_id", caller)`): a global rule the caller does not
    own is not updatable. The `enabled` toggle rides this path (it is a plain column
    in ``data``).
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .update(data)
        .eq("id", rule_id)
        .eq("user_id", str(user_id))
    )
    if not result.data:
        return None
    return result.data[0]


async def delete_rule(user_id, rule_id: str, supabase: Client | None = None) -> bool:
    """Own-scoped delete; returns True if a row was removed, False on a cross-user miss (→404).

    STRICTLY own-scoped: a global rule the caller does not own is not deletable.
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .delete()
        .eq("id", rule_id)
        .eq("user_id", str(user_id))
    )
    return bool(result.data)
