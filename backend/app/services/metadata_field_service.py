"""Custom metadata field-definition CRUD service (Phase 111, META-01).

The data-access core behind the `/metadata-fields` router. Kept as a service
module (not inline in the router) so the live-DB integration tests can drive the
create/list logic directly against :54322 without a FastAPI TestClient + JWT.

Security invariants (T-111-03-01 / -03):
  - create() HARD-SETS user_id=caller + is_global=false (never trusts a caller
    arg); the RLS WITH CHECK at migration 071:168 forces the same on INSERT.
  - update()/delete() are own-scoped (.eq("user_id", caller)) and collapse a
    cross-user miss to None/False the router maps to 404-not-403.

All Supabase `.execute()` calls run through `aexec` (run_in_threadpool) so an
async caller never blocks the event loop (D-v2.5-01).

Every function takes an optional ``supabase`` client (defaults to the singleton
``get_supabase()``). The router passes the DI-injected client; the live-DB tests
inject a real local client built from backend/.env (the conftest plants a fake
cloud SUPABASE_URL, so the tests must supply the real local one).
"""

from supabase import Client

from app.dependencies import get_supabase
from app.utils.db import aexec

_TABLE = "metadata_field_definitions"


def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()


async def list_field_definitions(user_id, supabase: Client | None = None) -> list[dict]:
    """Return the caller's own field defs plus global ones, deduped by id.

    Mirrors the skills list shape (own + global via OR predicate).
    """
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .select("*")
        .or_(f"user_id.eq.{user_id},is_global.eq.true")
        .order("field_key")
    )
    seen: set = set()
    out: list[dict] = []
    for row in result.data or []:
        if row["id"] not in seen:
            seen.add(row["id"])
            out.append(row)
    return out


async def create_field_definition(
    user_id,
    field_key: str,
    field_type: str,
    description: str | None = None,
    options: list[str] | None = None,
    enabled: bool = True,
    is_global: bool = False,  # accepted for signature symmetry; ALWAYS forced False below
    supabase: Client | None = None,
) -> dict:
    """Insert a custom field def owned by ``user_id`` — never global.

    ``is_global`` in the signature is intentionally ignored: a caller cannot
    escalate to a global field. ``user_id`` and ``is_global=False`` are
    hard-set in the inserted payload (RLS WITH CHECK forces it too).
    """
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "field_key": field_key,
        "field_type": field_type,
        "description": description,
        "is_global": False,  # HARD-SET — never from the caller (T-111-03-01)
        "enabled": enabled,
    }
    # `options` only exists after migration 072 (Plan 05). Include it only when
    # provided so a pre-072 DB does not reject the insert on an unknown column.
    if options is not None:
        payload["options"] = options
    result = await aexec(client.table(_TABLE).insert(payload))
    return result.data[0]


async def field_key_exists(user_id, field_key: str, supabase: Client | None = None) -> bool:
    """True if the caller already owns a field def with this key (own-scoped)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .select("id")
        .eq("user_id", str(user_id))
        .eq("field_key", field_key)
    )
    return bool(result.data)


async def update_field_definition(
    user_id, field_id: str, data: dict, supabase: Client | None = None
) -> dict | None:
    """Own-scoped update; returns the updated row or None on a cross-user miss (→404)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .update(data)
        .eq("id", field_id)
        .eq("user_id", str(user_id))
    )
    if not result.data:
        return None
    return result.data[0]


async def delete_field_definition(
    user_id, field_id: str, supabase: Client | None = None
) -> bool:
    """Own-scoped delete; returns True if a row was removed, False on a cross-user miss (→404)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .delete()
        .eq("id", field_id)
        .eq("user_id", str(user_id))
    )
    return bool(result.data)
