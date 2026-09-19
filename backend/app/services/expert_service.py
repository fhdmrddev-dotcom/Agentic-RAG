from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.db import experts as experts_db
from app.models.expert import ExpertBundle, ExpertBundleCreate, ExpertBundleUpdate

logger = logging.getLogger(__name__)


class ResolvedExpertBundle(BaseModel):
    bundle_id: UUID
    name: str
    slug: str
    description: str
    scope_mode: str
    is_system: bool
    org_id: UUID | None
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
    )


async def get_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by ID."""
    return await experts_db.get_expert_bundle_by_id(pool, bundle_id, caller_org_id)


async def get_expert_by_slug_service(
    pool: asyncpg.Pool,
    slug: str,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by slug."""
    return await experts_db.get_expert_bundle_by_slug(pool, slug, caller_org_id)


async def list_experts_service(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List raw expert bundles accessible to caller."""
    return await experts_db.list_expert_bundles(
        pool=pool,
        caller_org_id=caller_org_id,
        include_system=include_system,
        enabled_only=enabled_only,
    )


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
) -> ResolvedExpertBundle | None:
    """Two-phase member boundary evaluation (PACK-04, SEED-125).

    Phase 1:
      Verify bundle exists and is accessible to caller_org_id (is_system = true OR org_id == caller_org_id).
      If not found or cross-org, returns None.

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
            SELECT id, org_id
            FROM public.folders
            WHERE id = ANY($1::uuid[]);
        """
        folder_rows = await pool.fetch(folder_query, raw_folder_ids)
        valid_folders: set[UUID] = {
            r["id"] for r in folder_rows if r.get("org_id") == caller_org_id
        }

        for f_id in raw_folder_ids:
            if f_id in valid_folders:
                effective_folder_ids.append(f_id)
            else:
                stripped_count += 1
                detail = f"folder:{f_id}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: folder '%s' foreign to org '%s'",
                    f_id,
                    caller_org_id,
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
        effective_skills=effective_skills,
        effective_folder_ids=effective_folder_ids,
        effective_connections=effective_connections,
        prompt_suggestions=bundle.get("prompt_suggestions") or [],
        stripped_members_count=stripped_count,
        stripped_details=stripped_details,
    )
