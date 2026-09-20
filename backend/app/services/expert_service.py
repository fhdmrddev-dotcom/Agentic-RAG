from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.db import experts as experts_db
from app.models.expert import ExpertBundle, ExpertBundleCreate, ExpertBundleUpdate

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class ResolvedExpertBundle(BaseModel):
    bundle_id: UUID
    name: str
    slug: str
    description: str
    scope_mode: str
    is_system: bool
    org_id: UUID | None
    tool_floor_enabled: bool = True
    effective_skills: list[str] = Field(default_factory=list)
    effective_folder_ids: list[UUID] = Field(default_factory=list)
    effective_connections: list[str] = Field(default_factory=list)
    prompt_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    stripped_members_count: int = 0
    stripped_details: list[str] = Field(default_factory=list)


async def create_expert_service(
    pool: asyncpg.Pool,
    org_id: UUID,
    user_id: UUID,
    bundle_in: ExpertBundleCreate,
) -> dict[str, Any]:
    """Create a new tenant expert bundle via service layer."""
    return await experts_db.create_expert_bundle(
        pool=pool,
        org_id=org_id,
        created_by=user_id,
        name=bundle_in.name,
        slug=bundle_in.slug,
        description=bundle_in.description,
        scope_mode=bundle_in.scope_mode,
        member_skills=bundle_in.member_skills,
        required_connections=bundle_in.required_connections,
        knowledge_folder_ids=bundle_in.knowledge_folder_ids,
        prompt_suggestions=[s.model_dump() for s in bundle_in.prompt_suggestions],
        visibility=bundle_in.visibility,
        is_enabled=bundle_in.is_enabled,
        icon=bundle_in.icon,
        category=bundle_in.category,
        when_to_use=bundle_in.when_to_use,
        example_output=bundle_in.example_output,
        tool_floor_enabled=bundle_in.tool_floor_enabled,
    )


async def get_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by ID, verifying grant access if caller_user_id is provided."""
    bundle = await experts_db.get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not bundle:
        return None
    if caller_user_id is not None:
        has_grant = await experts_db.check_expert_grant_access(
            pool=pool,
            bundle=bundle,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
        )
        if not has_grant:
            return None
    return bundle


async def get_expert_by_slug_service(
    pool: asyncpg.Pool,
    slug: str,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by slug, verifying grant access if caller_user_id is provided."""
    bundle = await experts_db.get_expert_bundle_by_slug(pool, slug, caller_org_id)
    if not bundle:
        return None
    if caller_user_id is not None:
        has_grant = await experts_db.check_expert_grant_access(
            pool=pool,
            bundle=bundle,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
        )
        if not has_grant:
            return None
    return bundle


async def list_experts_service(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List raw expert bundles accessible to caller."""
    if caller_user_id is not None:
        return await experts_db.list_expert_bundles_for_caller(
            pool=pool,
            caller_org_id=caller_org_id,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
            include_system=include_system,
            enabled_only=enabled_only,
        )
    return await experts_db.list_expert_bundles(
        pool=pool,
        caller_org_id=caller_org_id,
        include_system=include_system,
        enabled_only=enabled_only,
    )


async def get_expert_grants_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
) -> list[dict[str, Any]]:
    """Fetch all granular access grants for an expert bundle."""
    return await experts_db.get_expert_grants(pool, expert_id)


async def add_expert_grant_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grantee_type: str,
    grantee_id: str,
) -> dict[str, Any]:
    """Add a granular access grant for an expert bundle."""
    return await experts_db.add_expert_grant(pool, expert_id, grantee_type, grantee_id)


async def remove_expert_grant_service(
    pool: asyncpg.Pool,
    grant_id: UUID,
    expert_id: UUID | None = None,
) -> bool:
    """Remove an access grant."""
    return await experts_db.remove_expert_grant(pool, grant_id, expert_id)


async def bulk_set_expert_grants_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grants: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    """Bulk set access grants for an expert bundle."""
    return await experts_db.bulk_set_expert_grants(pool, expert_id, grants)


async def update_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    bundle_update: ExpertBundleUpdate,
) -> dict[str, Any] | None:
    """Update tenant expert bundle fields."""
    update_data = bundle_update.model_dump(exclude_unset=True)
    if "prompt_suggestions" in update_data and update_data["prompt_suggestions"] is not None:
        update_data["prompt_suggestions"] = [
            s if isinstance(s, dict) else s.model_dump()
            for s in update_data["prompt_suggestions"]
        ]
    return await experts_db.update_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=caller_org_id,
        **update_data,
    )


async def delete_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
) -> bool:
    """Delete tenant expert bundle."""
    return await experts_db.delete_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=caller_org_id,
    )


async def resolve_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    caller_user_id: UUID,
    caller_roles: list[str] | None = None,
) -> ResolvedExpertBundle | None:
    """Two-phase member boundary evaluation (PACK-04, SEED-125).

    Phase 1:
      Verify bundle exists and is accessible to caller_org_id (is_system = true OR org_id == caller_org_id).
      Verify caller holds access grant if visibility is 'granted' or 'private' (PACK-10 / SC#5).
      If not found, cross-org, or grant denied, returns None.

    Phase 2:
      Independently evaluate each referenced member (skills, folders, connections):
      - skills: must be is_system = true OR (org_id == caller_org_id AND is_enabled = true AND (user_id == caller_user_id OR is_org_shared = true))
      - folders: must belong to caller_org_id (org_id == caller_org_id)
      - connections: must be active and enabled in caller_org_id
      Foreign members are stripped and logged with an audit warning (EXPERT_MEMBER_CROSS_ORG_STRIPPED).
    """
    bundle = await experts_db.get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not bundle:
        return None

    # PACK-10 / SC#5: Verify caller holds grant access for granted/private bundles
    has_grant = await experts_db.check_expert_grant_access(
        pool=pool,
        bundle=bundle,
        caller_user_id=caller_user_id,
        caller_roles=caller_roles,
    )
    if not has_grant:
        logger.warning(
            "EXPERT_GRANT_ACCESS_DENIED: user '%s' lacks grant to resolve expert '%s' (visibility '%s')",
            caller_user_id,
            bundle_id,
            bundle.get("visibility"),
        )
        return None

    stripped_count = 0
    stripped_details: list[str] = []

    # 1. Evaluate member_skills independently
    raw_skills = bundle.get("member_skills") or []
    effective_skills: list[str] = []

    if raw_skills:
        skill_query = """
            SELECT name, is_system, org_id, user_id, is_org_shared, is_enabled
            FROM public.skills
            WHERE name = ANY($1::text[]);
        """
        skill_rows = await pool.fetch(skill_query, raw_skills)
        valid_skills: set[str] = set()

        for row in skill_rows:
            s_name = row["name"]
            is_sys = bool(row.get("is_system"))
            s_org_id = row.get("org_id")
            s_user_id = row.get("user_id")
            s_shared = bool(row.get("is_org_shared"))
            s_enabled = bool(row.get("is_enabled", True))

            if is_sys:
                valid_skills.add(s_name)
            elif (
                s_org_id == caller_org_id
                and s_enabled
                and (s_user_id == caller_user_id or s_shared)
            ):
                valid_skills.add(s_name)

        for s in raw_skills:
            if s in valid_skills:
                effective_skills.append(s)
            else:
                stripped_count += 1
                detail = f"skill:{s}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: skill '%s' foreign or inaccessible to org '%s' (user '%s')",
                    s,
                    caller_org_id,
                    caller_user_id,
                )

    # 2. Evaluate knowledge_folder_ids independently
    raw_folder_ids = bundle.get("knowledge_folder_ids") or []
    effective_folder_ids: list[UUID] = []

    if raw_folder_ids:
        folder_query = """
            SELECT id, org_id, user_id, is_org_shared
            FROM public.folders
            WHERE id = ANY($1::uuid[]);
        """
        folder_rows = await pool.fetch(folder_query, raw_folder_ids)
        valid_folders: set[UUID] = set()

        for r in folder_rows:
            f_id = r["id"]
            f_org_id = r.get("org_id")
            f_user_id = r.get("user_id")
            f_shared = bool(r.get("is_org_shared"))
            is_system_folder = bool(f_user_id == SYSTEM_USER_ID and f_shared)
            is_tenant_folder = bool(f_org_id == caller_org_id and (f_user_id == caller_user_id or f_shared))
            if is_system_folder or is_tenant_folder:
                valid_folders.add(f_id)

        for f_id in raw_folder_ids:
            if f_id in valid_folders:
                effective_folder_ids.append(f_id)
            else:
                stripped_count += 1
                detail = f"folder:{f_id}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: folder '%s' foreign or inaccessible to org '%s' (user '%s')",
                    f_id,
                    caller_org_id,
                    caller_user_id,
                )

    # 3. Evaluate required_connections independently
    raw_connections = bundle.get("required_connections") or []
    effective_connections: list[str] = []

    if raw_connections:
        conn_query = """
            SELECT DISTINCT service_id, capability
            FROM public.connector_connections
            WHERE org_id = $1
              AND is_enabled = true
              AND status = 'active';
        """
        conn_rows = await pool.fetch(conn_query, caller_org_id)
        active_conn_keys: set[str] = set()
        for r in conn_rows:
            if r.get("service_id"):
                active_conn_keys.add(r["service_id"])
            if r.get("capability"):
                active_conn_keys.add(r["capability"])

        for c in raw_connections:
            if c in active_conn_keys:
                effective_connections.append(c)
            else:
                stripped_count += 1
                detail = f"connection:{c}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: connection '%s' unconfigured or foreign to org '%s'",
                    c,
                    caller_org_id,
                )

    return ResolvedExpertBundle(
        bundle_id=bundle["id"],
        name=bundle["name"],
        slug=bundle["slug"],
        description=bundle.get("description", ""),
        scope_mode=bundle.get("scope_mode", "restricted"),
        is_system=bundle.get("is_system", False),
        org_id=bundle.get("org_id"),
        tool_floor_enabled=bool(bundle.get("tool_floor_enabled", True)),
        effective_skills=effective_skills,
        effective_folder_ids=effective_folder_ids,
        effective_connections=effective_connections,
        prompt_suggestions=bundle.get("prompt_suggestions") or [],
        stripped_members_count=stripped_count,
        stripped_details=stripped_details,
    )
