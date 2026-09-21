from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


def _suggestions_to_jsonb(val: Any) -> str:
    """Serialise prompt_suggestions for a ``::jsonb`` bind — ALWAYS as a JSON ARRAY.

    BUG-260921-01b: the write path was a bare ``json.dumps(value or [])``. That is correct
    for a list and silently WRONG for a string: ``json.dumps('[{"title":...}]')`` yields a
    JSON *string scalar*, which Postgres stores happily and which reads back as
    ``jsonb_typeof = 'string'`` rather than ``'array'``. Measured on a live row
    (``phd-lr``) against a correct one (``financial-analyzer``) in the same column. Same
    class as the ``workflow_definition`` jsonb-string-scalar trap already in this project's
    record.

    ⛔ The invariant is THE RETURN VALUE PARSES TO A LIST. A str input is parsed rather than
    re-dumped; anything neither a list nor list-bearing JSON becomes an empty array,
    because a malformed tile set must not be persisted as a scalar that every later reader
    has to defend against.
    """
    if val is None:
        return "[]"
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
        except Exception:
            return "[]"
        return json.dumps(parsed) if isinstance(parsed, list) else "[]"
    if isinstance(val, (list, tuple)):
        return json.dumps([
            (v if isinstance(v, dict) else (v.model_dump() if hasattr(v, "model_dump") else v))
            for v in val
        ])
    if hasattr(val, "model_dump"):
        return json.dumps([val.model_dump()])
    return "[]"


def _parse_prompt_suggestions(val: Any) -> list[dict[str, Any]]:
    if val is None:
        return []
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    if isinstance(val, list):
        return val
    return []


def _row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    if "prompt_suggestions" in d:
        d["prompt_suggestions"] = _parse_prompt_suggestions(d["prompt_suggestions"])
    return d


async def create_expert_bundle(
    pool: asyncpg.Pool,
    org_id: UUID,
    created_by: UUID,
    name: str,
    slug: str,
    description: str = "",
    scope_mode: str = "restricted",
    member_skills: list[str] | None = None,
    required_connections: list[str] | None = None,
    knowledge_folder_ids: list[UUID] | None = None,
    prompt_suggestions: list[dict[str, Any]] | None = None,
    visibility: str = "private",
    is_enabled: bool = True,
    icon: str = "chart",
    category: str = "General",
    when_to_use: str = "",
    example_output: str = "",
    tool_floor_enabled: bool = True,
) -> dict[str, Any]:
    """Create a new domain expert bundle for a tenant organization.

    System bundles cannot be created via this function (enforced is_system = false).
    Slug uniqueness within the org is enforced by partial unique index idx_expert_bundles_org_slug.
    """
    suggestions_json = _suggestions_to_jsonb(prompt_suggestions)
    query = """
        INSERT INTO public.expert_bundles (
            org_id,
            created_by,
            name,
            slug,
            description,
            scope_mode,
            member_skills,
            required_connections,
            knowledge_folder_ids,
            prompt_suggestions,
            visibility,
            is_system,
            is_enabled,
            icon,
            category,
            when_to_use,
            example_output,
            tool_floor_enabled
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, false, $12, $13, $14, $15, $16, $17
        )
        RETURNING *;
    """
    row = await pool.fetchrow(
        query,
        org_id,
        created_by,
        name,
        slug,
        description,
        scope_mode,
        member_skills or [],
        required_connections or [],
        knowledge_folder_ids or [],
        suggestions_json,
        visibility,
        is_enabled,
        icon,
        category,
        when_to_use,
        example_output,
        tool_floor_enabled,
    )
    result = _row_to_dict(row)
    if not result:
        raise RuntimeError("Failed to create expert bundle")
    return result


async def get_expert_bundle_by_id(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch an expert bundle by its UUID.

    Returns the bundle if it is a system template (is_system = true)
    or if it belongs to the caller's organization (org_id = caller_org_id).
    Cross-org access returns None.
    """
    query = """
        SELECT *
        FROM public.expert_bundles
        WHERE id = $1
          AND (is_system = true OR org_id = $2);
    """
    row = await pool.fetchrow(query, bundle_id, caller_org_id)
    return _row_to_dict(row)


async def get_expert_bundle_by_slug(
    pool: asyncpg.Pool,
    slug: str,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch an expert bundle by its slug.

    Prioritizes org-specific bundle over system bundle if both match the slug.
    """
    query = """
        SELECT *
        FROM public.expert_bundles
        WHERE slug = $1
          AND (is_system = true OR org_id = $2)
        ORDER BY is_system ASC
        LIMIT 1;
    """
    row = await pool.fetchrow(query, slug, caller_org_id)
    return _row_to_dict(row)


async def list_expert_bundles(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List all expert bundles in the org (plus system templates).

    Intended for administrative management surfaces (OrgAdminShell).
    Returns all tenant-owned bundles regardless of visibility.
    """
    clauses: list[str] = []
    args: list[Any] = []

    if include_system and caller_org_id is not None:
        args.append(caller_org_id)
        clauses.append(f"(is_system = true OR org_id = ${len(args)})")
    elif include_system:
        clauses.append("is_system = true")
    elif caller_org_id is not None:
        args.append(caller_org_id)
        clauses.append(f"(is_system = false AND org_id = ${len(args)})")
    else:
        return []

    if enabled_only:
        clauses.append("is_enabled = true")

    where_sql = " AND ".join(clauses)
    query = f"""
        SELECT *
        FROM public.expert_bundles
        WHERE {where_sql}
        ORDER BY is_system DESC, name ASC;
    """
    rows = await pool.fetch(query, *args)
    return [_row_to_dict(r) for r in rows if r is not None]  # type: ignore[misc]


async def list_expert_bundles_for_caller(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List expert bundles accessible to a specific caller based on visibility and grants.

    Enforces:
      - System bundles: public catalog assets, visible to all.
      - Org bundles with visibility 'public' or 'org': visible to any org member.
      - Org bundles with visibility 'private': visible ONLY to creator (created_by == caller_user_id).
      - Org bundles with visibility 'granted': visible if created_by == caller_user_id OR
        caller has an active grant in public.expert_grants matching caller_user_id or caller_roles.
    """
    clauses: list[str] = []
    args: list[Any] = []

    if caller_org_id is None and not include_system:
        return []

    if enabled_only:
        clauses.append("is_enabled = true")

    # Base org or system boundary
    if include_system and caller_org_id is not None:
        args.append(caller_org_id)
        org_filter = f"(is_system = true OR org_id = ${len(args)})"
    elif include_system:
        org_filter = "is_system = true"
    elif caller_org_id is not None:
        args.append(caller_org_id)
        org_filter = f"(is_system = false AND org_id = ${len(args)})"
    else:
        return []

    # Visibility & grant filtering clause for tenant bundles
    user_str = str(caller_user_id) if caller_user_id else ""
    roles = caller_roles or []

    args.append(caller_user_id)
    uid_param = f"${len(args)}"
    args.append(user_str)
    uid_str_param = f"${len(args)}"
    args.append(roles)
    roles_param = f"${len(args)}::text[]"

    visibility_clause = f"""(
        is_system = true
        OR visibility IN ('org', 'public')
        OR (visibility = 'private' AND created_by = {uid_param})
        OR (visibility = 'granted' AND (
            created_by = {uid_param}
            OR EXISTS (
                SELECT 1
                FROM public.expert_grants eg
                WHERE eg.expert_id = expert_bundles.id
                  AND (
                      (eg.grantee_type = 'user' AND eg.grantee_id = {uid_str_param})
                      OR (eg.grantee_type = 'role' AND eg.grantee_id = ANY({roles_param}))
                  )
            )
        ))
    )"""

    clauses.append(org_filter)
    clauses.append(visibility_clause)

    where_sql = " AND ".join(clauses)
    query = f"""
        SELECT *
        FROM public.expert_bundles
        WHERE {where_sql}
        ORDER BY is_system DESC, name ASC;
    """
    rows = await pool.fetch(query, *args)
    return [_row_to_dict(r) for r in rows if r is not None]  # type: ignore[misc]


async def check_expert_grant_access(
    pool: asyncpg.Pool,
    bundle: dict[str, Any],
    caller_user_id: UUID | None,
    caller_roles: list[str] | None = None,
) -> bool:
    """Check if caller has access to a specific expert bundle based on visibility and grants."""
    if bundle.get("is_system"):
        return True
    vis = bundle.get("visibility", "private")
    if vis in ("org", "public"):
        return True
    if caller_user_id is None:
        return False
    if bundle.get("created_by") == caller_user_id:
        return True
    if vis == "granted":
        user_str = str(caller_user_id)
        roles = caller_roles or []
        query = """
            SELECT 1
            FROM public.expert_grants
            WHERE expert_id = $1
              AND (
                  (grantee_type = 'user' AND grantee_id = $2)
                  OR (grantee_type = 'role' AND grantee_id = ANY($3::text[]))
              )
            LIMIT 1;
        """
        row = await pool.fetchrow(query, bundle["id"], user_str, roles)
        return row is not None
    return False


async def update_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    **updates: Any,
) -> dict[str, Any] | None:
    """Update fields on a tenant-owned expert bundle.

    Refuses to update system bundles (returns None).
    Refuses to update bundles belonging to other organizations (returns None).
    """
    # Verify existence and tenant ownership first
    existing = await get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not existing:
        return None
    if existing.get("is_system"):
        logger.warning("Attempted to update system expert bundle %s; refused.", bundle_id)
        return None

    allowed_fields = {
        "name",
        "description",
        "scope_mode",
        "member_skills",
        "required_connections",
        "knowledge_folder_ids",
        "prompt_suggestions",
        "visibility",
        "is_enabled",
        "icon",
        "category",
        "when_to_use",
        "example_output",
        "tool_floor_enabled",
    }

    set_clauses: list[str] = []
    args: list[Any] = [bundle_id, caller_org_id]

    for field, value in updates.items():
        if field not in allowed_fields:
            continue
        if field == "prompt_suggestions":
            args.append(_suggestions_to_jsonb(value))
            set_clauses.append(f"prompt_suggestions = ${len(args)}::jsonb")
        else:
            args.append(value)
            set_clauses.append(f"{field} = ${len(args)}")

    if not set_clauses:
        return existing

    set_clauses.append("updated_at = now()")
    set_sql = ", ".join(set_clauses)

    query = f"""
        UPDATE public.expert_bundles
        SET {set_sql}
        WHERE id = $1
          AND org_id = $2
          AND is_system = false
        RETURNING *;
    """
    row = await pool.fetchrow(query, *args)
    return _row_to_dict(row)


async def stamp_skills_born_for_bundle(
    pool: asyncpg.Pool,
    *,
    bundle_id: UUID,
    skill_names: list[str],
    org_id: UUID,
    user_id: UUID,
) -> list[str]:
    """Mark the saver's own unstamped skills as born for this Expert bundle (D-263-08).

    Returns the names actually stamped, which is a SUBSET of ``skill_names`` — a caller that
    needs to know what did NOT get stamped must diff, because silence here means "already
    claimed, foreign, or not yours" and those are different situations.

    Each of the three narrowing predicates is load-bearing:

      * ``org_id = $3`` — a foreign-org row cannot be stamped. The stamp IS a privilege
        widening under D-263-06 (it makes a private skill resolvable to every org member
        through this bundle), so it must never reach outside the caller's tenancy.
      * ``user_id = $4`` — another author's pre-existing row cannot be silently conscripted
        into somebody else's Expert.
      * ``born_for_expert_bundle_id IS NULL`` — D-263-07's rejection of re-stamping on reuse.
        Without it, adding a skill to a SECOND Expert would move the marker and the FIRST
        Expert would silently lose the skill.
    """
    if not skill_names:
        return []

    query = """
        UPDATE public.skills
        SET born_for_expert_bundle_id = $1,
            updated_at = now()
        WHERE name = ANY($2::text[])
          AND org_id = $3
          AND user_id = $4
          AND born_for_expert_bundle_id IS NULL
        RETURNING name;
    """
    rows = await pool.fetch(query, bundle_id, skill_names, org_id, user_id)
    return [r["name"] for r in rows]


async def delete_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
) -> bool:
    """Delete a tenant-owned expert bundle.

    Refuses to delete system bundles (returns False).
    Refuses to delete bundles belonging to other organizations (returns False).
    """
    existing = await get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not existing:
        return False
    if existing.get("is_system"):
        logger.warning("Attempted to delete system expert bundle %s; refused.", bundle_id)
        return False

    query = """
        DELETE FROM public.expert_bundles
        WHERE id = $1
          AND org_id = $2
          AND is_system = false;
    """
    result = await pool.execute(query, bundle_id, caller_org_id)
    return result == "DELETE 1"


# --- Expert Grants CRUD (PACK-10) ---

async def get_expert_grants(
    pool: asyncpg.Pool,
    expert_id: UUID,
) -> list[dict[str, Any]]:
    """Fetch all granular access grants for a given expert bundle."""
    query = """
        SELECT *
        FROM public.expert_grants
        WHERE expert_id = $1
        ORDER BY created_at ASC;
    """
    rows = await pool.fetch(query, expert_id)
    return [dict(r) for r in rows if r is not None]


async def add_expert_grant(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grantee_type: str,
    grantee_id: str,
) -> dict[str, Any]:
    """Add a granular access grant (user or role) for an expert bundle.

    Idempotent: on conflict returns existing grant.
    """
    query = """
        INSERT INTO public.expert_grants (
            expert_id,
            grantee_type,
            grantee_id
        ) VALUES (
            $1, $2, $3
        )
        ON CONFLICT (expert_id, grantee_type, grantee_id) DO UPDATE
        SET expert_id = EXCLUDED.expert_id
        RETURNING *;
    """
    row = await pool.fetchrow(query, expert_id, grantee_type, grantee_id)
    if not row:
        raise RuntimeError("Failed to add expert grant")
    return dict(row)


async def remove_expert_grant(
    pool: asyncpg.Pool,
    grant_id: UUID,
    expert_id: UUID | None = None,
) -> bool:
    """Remove a granular access grant by its ID."""
    if expert_id is not None:
        query = """
            DELETE FROM public.expert_grants
            WHERE id = $1 AND expert_id = $2;
        """
        result = await pool.execute(query, grant_id, expert_id)
    else:
        query = """
            DELETE FROM public.expert_grants
            WHERE id = $1;
        """
        result = await pool.execute(query, grant_id)
    return result == "DELETE 1"


async def bulk_set_expert_grants(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grants: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    """Synchronize expert grants in a transaction, replacing existing grants."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM public.expert_grants WHERE expert_id = $1;", expert_id)
            if not grants:
                return []
            stmt = """
                INSERT INTO public.expert_grants (expert_id, grantee_type, grantee_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (expert_id, grantee_type, grantee_id) DO NOTHING
                RETURNING *;
            """
            out = []
            for g_type, g_id in grants:
                r = await conn.fetchrow(stmt, expert_id, g_type, g_id)
                if r:
                    out.append(dict(r))
            return out
