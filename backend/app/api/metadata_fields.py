"""Custom metadata field-definition CRUD router (Phase 111, META-01).

Mirrors the skills router (own + global CRUD, get_current_user, RLS) with two
deliberate deviations driven by the threat register:

  - create HARD-SETS is_system_global=False (T-111-03-01) — a user can never author a
    global field def; the RLS WITH CHECK at migration 071:168 forces it too.
  - update/delete are own-scoped and collapse a cross-user miss to 404-not-403
    (T-111-03-03, D-v2.6-04 — the safer non-leaking pattern).

Create also writes a `metadata.field.create` audit row (T-111-03-04). The audit
service swallows errors, so the LIVE round-trip is the real verification
(test_111_audit_field_create.py).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
from app.models.metadata_field import (
    MetadataFieldCreate,
    MetadataFieldResponse,
    MetadataFieldUpdate,
)
from app.services import metadata_field_service
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/metadata-fields", tags=["metadata-fields"])


@router.get("", response_model=list[MetadataFieldResponse])
async def list_metadata_fields(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List the caller's own field definitions plus global ones (deduped)."""
    return await metadata_field_service.list_field_definitions(
        current_user["id"], supabase=supabase
    )


@router.post("", response_model=MetadataFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_metadata_field(
    body: MetadataFieldCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Define a custom metadata field owned by the caller (never global)."""
    # Own-scoped duplicate pre-check — migration 071 has no unique constraint on
    # (user_id, field_key), so reject a collision in app code → 409.
    if await metadata_field_service.field_key_exists(
        current_user["id"], body.field_key, supabase=supabase
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A metadata field with key '{body.field_key}' already exists",
        )

    created = await metadata_field_service.create_field_definition(
        user_id=current_user["id"],
        field_key=body.field_key,
        field_type=body.field_type,
        description=body.description,
        options=body.options,
        enabled=body.enabled,
        supabase=supabase,
        # is_system_global intentionally NOT passed — the service hard-sets it False.
    )

    # Fire the audit row. write_audit_entry is async and SWALLOWS errors, so it
    # never raises into the request (audit_service.py:57-74). Verified LIVE.
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="metadata.field.create",
        metadata={"field_key": body.field_key, "field_type": body.field_type},
        supabase=supabase,
    )
    return created


@router.patch("/{field_id}", response_model=MetadataFieldResponse)
async def update_metadata_field(
    field_id: str,
    body: MetadataFieldUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Update an owned field definition (404 on a cross-user miss, not 403)."""
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = await metadata_field_service.update_field_definition(
        current_user["id"], field_id, data, supabase=supabase
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Metadata field not found")
    return updated


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_metadata_field(
    field_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Delete an owned field definition (404 on a cross-user miss, not 403)."""
    removed = await metadata_field_service.delete_field_definition(
        current_user["id"], field_id, supabase=supabase
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Metadata field not found")
