"""Saved-view (virtual folder) CRUD data-access service (Phase 113, VIEW-01/05).

The data-access core behind the `/document-views` router. Cloned almost verbatim
from `metadata_field_service.py` so the live-DB integration tests (Plan 03) can
drive create/list/get/update/delete directly against :54322 without a FastAPI
TestClient + JWT.

A view is a metadata-driven *query, not a copy* (D-113-1): `name` + the validated
`filter_expr` AST (jsonb) + an optional `folder_scope`. One document appears in
many views with zero duplication.

Security invariants (T-113-06 / T-113-07 / T-113-08):
  - create_view HARD-SETS is_global=False (never trusts a caller arg; D-113-3) —
    globals are service-role / migration-seeded only, exactly like global folders
    and global skills. The RLS WITH CHECK at migration 071 forces the same on
    INSERT/UPDATE; this hard-set is defense-in-depth.
  - get_view gates reads to own-OR-global (`.or_(...is_global.eq.true)`); a not-
    readable id collapses to None so the router returns 404-not-403 (no existence
    leak; the readability check the resolve route's leak-safety depends on,
    D-113-4).
  - update_view / delete_view are own-scoped (`.eq("user_id", caller)`) and
    collapse a cross-user miss to None/False the router maps to 404-not-403.

Field-whitelist validation (D-113-10) does NOT live here — it runs in the router
(Plan 03) via `view_filter_compiler.validate_fields` on create AND update, before
the DB write. This module is pure persistence.

All Supabase `.execute()` calls run through `aexec` (run_in_threadpool) so an
async caller never blocks the event loop (D-v2.5-01).

Every function takes an optional ``supabase`` client (defaults to the singleton
``get_supabase()``). The router passes the DI-injected client; the live-DB tests
inject a real local client built from backend/.env (the conftest plants a fake
cloud SUPABASE_URL, so the tests must supply the real local one).
"""

from uuid import UUID

from supabase import Client

from app.dependencies import get_supabase
from app.utils.db import aexec

_TABLE = "document_views"


def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()


def _uid(user_id) -> str:
    """Coerce ``user_id`` to a canonical UUID string before it is interpolated into
    a PostgREST ``.or_()`` filter grammar (WR-02 hardening).

    ``user_id`` is the JWT-subject UUID from ``get_current_user`` and is not
    attacker-influenced today, but ``get_supabase()`` is the SERVICE-ROLE client
    (RLS bypassed) — these app-level predicates are the SOLE owner-scoping gate.
    Wrapping it in ``UUID(...)`` makes the one unparameterized runtime-value-into-
    DSL spot safe by construction: any value that is not a well-formed UUID raises
    ``ValueError`` instead of breaking out of the ``user_id.eq.<...>`` term.
    """
    return str(UUID(str(user_id)))


async def create_view(
    user_id,
    name: str,
    filter_expr: dict,
    folder_scope=None,
    supabase: Client | None = None,
) -> dict:
    """Insert a view owned by ``user_id`` — never global.

    ``filter_expr`` arrives as an already-validated AST dict (the router runs
    ``view_filter_compiler.validate_fields`` + ``model_dump()`` before calling
    this). ``is_global=False`` is HARD-SET in the inserted payload and NEVER read
    from any caller field (D-113-3; RLS WITH CHECK forces it too — defense-in-
    depth). ``folder_scope`` is stored as ``str(folder_scope)`` (a UUID) or None.
    """
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "name": name,
        "filter_expr": filter_expr,  # validated AST jsonb (already passed validate_fields)
        "folder_scope": str(folder_scope) if folder_scope else None,
        "is_global": False,  # HARD-SET — never from the caller (T-113-06)
    }
    result = await aexec(client.table(_TABLE).insert(payload))
    return result.data[0]


async def list_views(user_id, supabase: Client | None = None) -> list[dict]:
    """Return the caller's own views plus global ones, deduped by id, ordered by name.

    Mirrors the field-def / skills list shape (own + global via OR predicate).
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .select("*")
        .or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")
        .order("name")
    )
    seen: set = set()
    out: list[dict] = []
    for row in result.data or []:
        if row["id"] not in seen:
            seen.add(row["id"])
            out.append(row)
    return out


async def get_view(view_id, user_id, supabase: Client | None = None) -> dict | None:
    """Return the view if the caller can read it (own OR global), else None.

    The readability check the resolve route's 404-not-403 depends on (D-113-4): a
    view id the caller can't see (not own AND not global) → empty result → None.
    No existence leak.
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .select("*")
        .eq("id", view_id)
        .or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")  # own OR global; not-readable → empty
    )
    return (result.data or [None])[0]


async def get_view_by_name(
    name: str, user_id, supabase: Client | None = None
) -> dict | None:
    """Return the caller-readable view named ``name`` (own-or-global), else None.

    The Phase 115 agent tool resolves a saved view from a HUMAN NAME (the model never
    sees a view UUID — D-115-6). Own-or-global readability matches ``get_view``: the
    caller can name their own view OR a globally-seeded one; an unknown/unseeable name
    collapses to None so the handler routes to the catalog rather than leaking a
    distinguishable 403 (the existence-leak guard, D-115-6 / T-115-02-02).

    Matching is case-insensitive on the trimmed name. When BOTH an own and a global
    view share a name, the OWN view wins (own-first preference) — the user's saved
    intent shadows a shared default.

    WR-02 hardening: the ``name`` is NEVER interpolated into a PostgREST ``.or_()`` /
    ``.eq()`` filter grammar. We reuse the already-owner-scoped ``list_views`` (which
    runs the safe ``user_id.eq.<uuid>,is_global.eq.true`` predicate with the ``_uid``
    UUID-coercion guard) and filter the returned rows in Python — so there is no new
    runtime-value-into-DSL surface for a view name to break out of.
    """
    target = name.strip().lower()
    if not target:
        return None
    rows = await list_views(user_id, supabase=supabase)
    own_uid = _uid(user_id)
    matches = [r for r in rows if (r.get("name") or "").strip().lower() == target]
    if not matches:
        return None
    # Own-first preference: an own view of this name shadows a global one.
    for r in matches:
        if r.get("user_id") == own_uid:
            return r
    return matches[0]


async def update_view(
    user_id, view_id: str, data: dict, supabase: Client | None = None
) -> dict | None:
    """Own-scoped update; returns the updated row or None on a cross-user miss (→404)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .update(data)
        .eq("id", view_id)
        .eq("user_id", str(user_id))
    )
    if not result.data:
        return None
    return result.data[0]


async def delete_view(user_id, view_id: str, supabase: Client | None = None) -> bool:
    """Own-scoped delete; returns True if a row was removed, False on a cross-user miss (→404)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .delete()
        .eq("id", view_id)
        .eq("user_id", str(user_id))
    )
    return bool(result.data)
