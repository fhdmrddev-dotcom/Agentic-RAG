from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


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
) -> dict[str, Any]:
    """Create a new domain expert bundle for a tenant organization.

    System bundles cannot be created via this function (enforced is_system = false).
    Slug uniqueness within the org is enforced by partial unique index idx_expert_bundles_org_slug.
    """
    suggestions_json = json.dumps(prompt_suggestions or [])
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
            is_enabled
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, false, $12
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
    """List expert bundles accessible to the caller.

    Returns system templates (if include_system is True) and org-authored bundles.
    Optionally filters by is_enabled = True.
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
    }

    set_clauses: list[str] = []
    args: list[Any] = [bundle_id, caller_org_id]

    for field, value in updates.items():
        if field not in allowed_fields:
            continue
        if field == "prompt_suggestions":
            args.append(json.dumps(value or []))
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
