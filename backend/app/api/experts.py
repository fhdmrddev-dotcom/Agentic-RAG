from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate
from app.services.entitlement_service import require_capability
from app.services.expert_service import (
    ResolvedExpertBundle,
    create_expert_service,
    delete_expert_service,
    get_expert_service,
    list_experts_service,
    resolve_expert_bundle,
    update_expert_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/experts",
    tags=["experts"],
    dependencies=[Depends(require_capability("experts"))],
)


def _to_uuid(val: Any) -> UUID:
    if isinstance(val, UUID):
        return val
    return UUID(str(val))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expert(
    payload: ExpertBundleCreate,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Create a new tenant expert bundle.

    Gated by require_capability('experts') (PACK-06).
    """
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    try:
        return await create_expert_service(
            pool=pool,
            org_id=org_id,
            user_id=user_id,
            bundle_in=payload,
        )
    except Exception as exc:
        logger.error("Failed to create expert bundle: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create expert bundle: {exc}",
        ) from exc


@router.get("", status_code=status.HTTP_200_OK)
async def list_experts(
    include_system: bool = Query(True, description="Include platform system templates"),
    enabled_only: bool = Query(True, description="Only return active enabled bundles"),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> list[dict[str, Any]]:
    """List accessible expert bundles (system templates and org bundles).

    Gated by require_capability('experts') (PACK-06).
    """
    org_id = _to_uuid(active_org)
    return await list_experts_service(
        pool=pool,
        caller_org_id=org_id,
        include_system=include_system,
        enabled_only=enabled_only,
    )


@router.get("/{bundle_id}", status_code=status.HTTP_200_OK)
async def get_expert(
    bundle_id: UUID,
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Fetch raw expert bundle manifest by ID.

    Gated by require_capability('experts') (PACK-06).
    """
    org_id = _to_uuid(active_org)
    bundle = await get_expert_service(pool=pool, bundle_id=bundle_id, caller_org_id=org_id)
    if not bundle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert bundle not found",
        )
    return bundle


@router.get("/{bundle_id}/resolve", status_code=status.HTTP_200_OK, response_model=ResolvedExpertBundle)
async def resolve_expert(
    bundle_id: UUID,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ResolvedExpertBundle:
    """Resolve an expert bundle with two-phase member boundary evaluation (PACK-04).

    Verifies bundle access and independently sanitizes member skills, folders, and connections.
    Foreign member references are stripped and audited.
    """
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    resolved = await resolve_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        caller_user_id=user_id,
    )
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert bundle not found",
        )
    return resolved


@router.patch("/{bundle_id}", status_code=status.HTTP_200_OK)
async def update_expert(
    bundle_id: UUID,
    payload: ExpertBundleUpdate,
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Update a tenant expert bundle. Refuses modifying system templates or foreign bundles."""
    org_id = _to_uuid(active_org)
    updated = await update_expert_service(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        bundle_update=payload,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert bundle not found or cannot be modified",
        )
    return updated


@router.delete("/{bundle_id}", status_code=status.HTTP_200_OK)
async def delete_expert(
    bundle_id: UUID,
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Delete a tenant expert bundle. Refuses deleting system templates or foreign bundles."""
    org_id = _to_uuid(active_org)
    deleted = await delete_expert_service(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expert bundle not found or cannot be deleted",
        )
    return {"deleted": True, "id": str(bundle_id)}
