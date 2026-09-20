from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status

from app.dependencies import _has_org_permission, get_active_org_id, get_current_user, get_pg_pool
from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate, ExpertGrant, ExpertGrantCreate
from app.services.entitlement_service import require_capability
from app.services.expert_authoring import ExpertDraftOutput, generate_expert_draft
from app.services.expert_service import (
    ResolvedExpertBundle,
    add_expert_grant_service,
    create_expert_service,
    delete_expert_service,
    get_expert_grants_service,
    get_expert_service,
    list_experts_service,
    remove_expert_grant_service,
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


async def require_expert_manage(
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
) -> dict[str, Any]:
    """experts:manage gate for Expert authoring mutations (PACK-08 / D-261-03).

    Evaluates role_permissions(role, 'experts:manage') via _has_org_permission.
    Seeded for super-admin and org-admin.
    """
    if not await _has_org_permission(request, current_user, active_org, "experts:manage"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage experts for this organization.",
        )
    return current_user


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expert(
    payload: ExpertBundleCreate,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Create a new tenant expert bundle.

    Gated by require_capability('experts') (PACK-06) and require_expert_manage (PACK-08).
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


@router.post("/draft", status_code=status.HTTP_200_OK, response_model=ExpertDraftOutput)
async def draft_expert(
    description: str = Form(..., description="Description of the desired expert"),
    files: list[UploadFile] | None = File(default=None, description="Ephemeral brainstorm files (never ingested into permanent documents)"),
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ExpertDraftOutput:
    """Draft an Expert bundle using AI synthesis from description and ephemeral brainstorm files (PACK-09).

    Files are parsed in memory and strictly NEVER ingested into public.documents or public.chunks.
    Returns a draft row for human review and editing.
    """
    org_id = _to_uuid(active_org)

    # 1. Ephemeral in-memory text extraction (PACK-09, F-2, F-3)
    brainstorm_snippets: list[str] = []
    if files:
        for f in files:
            if f and f.filename:
                try:
                    # Bounded in-memory read (F-3: max 5MB per file)
                    MAX_FILE_BYTES = 5 * 1024 * 1024
                    data = await f.read(MAX_FILE_BYTES)
                    if data:
                        fname_lower = f.filename.lower()
                        extracted_text = ""
                        if fname_lower.endswith(".pdf"):
                            try:
                                import io  # noqa: PLC0415
                                from pypdf import PdfReader  # noqa: PLC0415
                                reader = PdfReader(io.BytesIO(data))
                                extracted_text = "\n\n".join(
                                    page.extract_text() or "" for page in reader.pages
                                )
                            except Exception as pdf_err:
                                logger.warning("Failed to extract PDF text from %s: %s", f.filename, pdf_err)
                        elif fname_lower.endswith(".docx"):
                            try:
                                import io  # noqa: PLC0415
                                from docx import Document as DocxDocument  # noqa: PLC0415
                                doc = DocxDocument(io.BytesIO(data))
                                extracted_text = "\n\n".join(
                                    p.text for p in doc.paragraphs if p.text.strip()
                                )
                            except Exception as docx_err:
                                logger.warning("Failed to extract DOCX text from %s: %s", f.filename, docx_err)
                        else:
                            extracted_text = data.decode("utf-8", errors="replace")

                        cleaned_text = extracted_text.strip()[:30000]
                        if cleaned_text:
                            brainstorm_snippets.append(f"--- File: {f.filename} ---\n{cleaned_text}")
                    del data
                except Exception as exc:
                    logger.warning("Failed to extract ephemeral text from %s: %s", f.filename, exc)

    brainstorm_text = "\n\n".join(brainstorm_snippets) if brainstorm_snippets else None

    # 2. Fetch available grounding assets for caller's org
    folder_rows = await pool.fetch(
        "SELECT id, name FROM public.folders WHERE org_id = $1 OR is_org_shared = true ORDER BY name ASC LIMIT 50;",
        org_id,
    )
    available_folders = [dict(r) for r in folder_rows]

    skill_rows = await pool.fetch(
        "SELECT name, description FROM public.skills WHERE (org_id = $1 OR is_system = true) AND is_enabled = true ORDER BY name ASC LIMIT 50;",
        org_id,
    )
    available_skills = [dict(r) for r in skill_rows]

    conn_rows = await pool.fetch(
        "SELECT id, name, capability, service_id FROM public.connector_connections WHERE org_id = $1 AND is_enabled = true ORDER BY name ASC LIMIT 50;",
        org_id,
    )
    available_connections = [
        {"slug": (r.get("service_id") or r.get("name") or str(r.get("id"))), "service_name": r.get("name") or ""}
        for r in conn_rows
    ]

    # 3. Load caller user_settings for LLM provider credentials
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    from app.models.user_settings import load_user_settings  # noqa: PLC0415
    try:
        user_settings = load_user_settings(user_id)
    except Exception as exc:
        logger.warning("Could not load user_settings for %s: %s", user_id, exc)
        user_settings = None

    # 4. Synthesize candidate draft row (PACK-09)
    return await generate_expert_draft(
        description=description,
        brainstorm_text=brainstorm_text,
        available_folders=available_folders,
        available_skills=available_skills,
        available_connections=available_connections,
        user_settings=user_settings,
    )


@router.get("", status_code=status.HTTP_200_OK)
async def list_experts(
    request: Request,
    include_system: bool = Query(True, description="Include platform system templates"),
    enabled_only: bool = Query(True, description="Only return active enabled bundles"),
    for_management: bool = Query(False, description="Return all org bundles for admin management"),
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> list[dict[str, Any]]:
    """List accessible expert bundles (system templates and org bundles).

    Gated by require_capability('experts') (PACK-06).
    If for_management is False, filters by caller visibility & grants.
    If for_management is True, verifies experts:manage permission and returns all bundles.
    """
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    caller_role = current_user.get("role")
    caller_roles = [caller_role] if caller_role else []

    if for_management:
        if not await _has_org_permission(request, current_user, active_org, "experts:manage"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage experts for this organization.",
            )
        return await list_experts_service(
            pool=pool,
            caller_org_id=org_id,
            include_system=include_system,
            enabled_only=enabled_only,
        )

    return await list_experts_service(
        pool=pool,
        caller_org_id=org_id,
        caller_user_id=user_id,
        caller_roles=caller_roles,
        include_system=include_system,
        enabled_only=enabled_only,
    )


@router.get("/{bundle_id}", status_code=status.HTTP_200_OK)
async def get_expert(
    bundle_id: UUID,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Fetch raw expert bundle manifest by ID.

    Gated by require_capability('experts') (PACK-06) and expert grant access (PACK-10).
    """
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    caller_role = current_user.get("role")
    caller_roles = [caller_role] if caller_role else []
    bundle = await get_expert_service(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        caller_user_id=user_id,
        caller_roles=caller_roles,
    )
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
    caller_role = current_user.get("role")
    caller_roles = [caller_role] if caller_role else []
    resolved = await resolve_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        caller_user_id=user_id,
        caller_roles=caller_roles,
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
    current_user: dict[str, Any] = Depends(require_expert_manage),
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
    current_user: dict[str, Any] = Depends(require_expert_manage),
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


# --- Granular Access Grants Endpoints (PACK-10) ---

@router.get("/{bundle_id}/grants", status_code=status.HTTP_200_OK, response_model=list[ExpertGrant])
async def get_expert_grants(
    bundle_id: UUID,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> list[dict[str, Any]]:
    """Fetch all granular access grants for an expert bundle (PACK-10)."""
    org_id = _to_uuid(active_org)
    bundle = await get_expert_service(pool=pool, bundle_id=bundle_id, caller_org_id=org_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert bundle not found")
    return await get_expert_grants_service(pool=pool, expert_id=bundle_id)


@router.post("/{bundle_id}/grants", status_code=status.HTTP_201_CREATED, response_model=ExpertGrant)
async def add_expert_grant(
    bundle_id: UUID,
    payload: ExpertGrantCreate,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Add a granular access grant (user or role) for an expert bundle (PACK-10)."""
    org_id = _to_uuid(active_org)
    bundle = await get_expert_service(pool=pool, bundle_id=bundle_id, caller_org_id=org_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert bundle not found")
    if bundle.get("is_system"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add grants to system templates")
    return await add_expert_grant_service(
        pool=pool,
        expert_id=bundle_id,
        grantee_type=payload.grantee_type,
        grantee_id=payload.grantee_id,
    )


@router.delete("/{bundle_id}/grants/{grant_id}", status_code=status.HTTP_200_OK)
async def remove_expert_grant(
    bundle_id: UUID,
    grant_id: UUID,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    """Remove a granular access grant from an expert bundle (PACK-10)."""
    org_id = _to_uuid(active_org)
    bundle = await get_expert_service(pool=pool, bundle_id=bundle_id, caller_org_id=org_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert bundle not found")
    removed = await remove_expert_grant_service(pool=pool, grant_id=grant_id, expert_id=bundle_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found")
    return {"deleted": True, "id": str(grant_id)}
