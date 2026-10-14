import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
from app.models.folder import FolderCreate, FolderMoveRequest, FolderUpdate, FolderResponse
from app.services.audit_service import write_audit_entry
from app.services.retention import hold_guard  # Phase 275 (D-15): the one hold check
from app.utils.db import aexec, maybe_row
from app.utils.folder_utils import fetch_visible_folders, _null_foreign_global_owner

log = logging.getLogger(__name__)

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List all folders visible to the current user (owned + global subtree)."""
    folders = await fetch_visible_folders(supabase, current_user["id"])
    folders.sort(key=lambda f: f["name"])
    # SEED-091 / D-164-05 (TEN-06): null the seeding owner on non-owned global folders.
    return _null_foreign_global_owner(folders, current_user["id"])


@router.get("/{folder_id}/children", response_model=list[FolderResponse])
async def list_children(
    folder_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List direct children of a folder that are visible to the current user."""
    visible = await fetch_visible_folders(supabase, current_user["id"])
    children = [f for f in visible if f["parent_id"] == folder_id]
    children.sort(key=lambda f: f["name"])
    # SEED-091 / D-164-05 (TEN-06): null the seeding owner on non-owned global folders.
    return _null_foreign_global_owner(children, current_user["id"])


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create a new folder. Validates parent_id ownership if provided."""
    if body.parent_id:
        visible = await fetch_visible_folders(supabase, current_user["id"])
        visible_ids = {f["id"] for f in visible}
        if str(body.parent_id) not in visible_ids:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    # Check for duplicate folder name under same parent for same user
    name_check_query = (
        supabase.table("folders")
        .select("id")
        .eq("name", body.name.strip())
        .eq("user_id", current_user["id"])
    )
    if body.parent_id:
        name_check_query = name_check_query.eq("parent_id", str(body.parent_id))
    else:
        name_check_query = name_check_query.is_("parent_id", "null")
    name_check = name_check_query.maybe_single().execute()
    if name_check and name_check.data:
        raise HTTPException(
            status_code=409,
            detail="A folder with this name already exists in this location",
        )

    result = (
        supabase.table("folders")
        .insert({
            "user_id": current_user["id"],
            "name": body.name.strip(),
            "parent_id": str(body.parent_id) if body.parent_id else None,
            "is_org_shared": body.is_org_shared,
        })
        .execute()
    )
    return result.data[0]


@router.patch("/{folder_id}", response_model=FolderResponse)
async def rename_folder(
    folder_id: str,
    body: FolderUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Rename a folder. Only the owner can rename."""
    # Fetch current folder to know its parent_id for duplicate name check
    current = (
        supabase.table("folders")
        .select("id, parent_id")
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not maybe_row(current):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Check for duplicate name under same parent (excluding the folder itself)
    parent_id = current.data.get("parent_id")
    name_check_query = (
        supabase.table("folders")
        .select("id")
        .eq("name", body.name.strip())
        .eq("user_id", current_user["id"])
        .neq("id", folder_id)
    )
    if parent_id:
        name_check_query = name_check_query.eq("parent_id", parent_id)
    else:
        name_check_query = name_check_query.is_("parent_id", "null")
    name_check = name_check_query.maybe_single().execute()
    if name_check and name_check.data:
        raise HTTPException(
            status_code=409,
            detail="A folder with this name already exists in this location",
        )

    result = (
        supabase.table("folders")
        .update({"name": body.name.strip()})
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return result.data[0]


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    # Phase 275: the hold predicates and the audit writer are service-role only (W-5b / D-05).
    service_supabase: Client = Depends(get_supabase),
):
    """Delete a folder and all documents inside it (storage + DB + chunks)."""
    # 1. Collect this folder and all descendant folder IDs (BFS)
    all_folder_ids = [folder_id]
    queue = [folder_id]
    while queue:
        parent = queue.pop(0)
        children = await aexec(supabase.table("folders").select("id").eq("parent_id", parent))
        for child in children.data:
            all_folder_ids.append(child["id"])
            queue.append(child["id"])

    # The folder's own row — its name and org for the audit row (Phase 275).
    folder_resp = await aexec(
        supabase.table("folders")
        .select("id, name, org_id")
        .eq("id", folder_id)
        .maybe_single()
    )
    folder_row = (getattr(folder_resp, "data", None) or {}) if folder_resp is not None else {}

    # 2. Find all documents in these folders
    docs_result = await aexec(
        supabase.table("documents")
        .select("id, file_path")
        .in_("folder_id", all_folder_ids)
    )
    docs = docs_result.data or []
    doc_ids = [d["id"] for d in docs]

    # 3. Phase 275 (D-15, revision B-1): refuse the WHOLE delete when anything in the subtree is
    #    held — every document AND every folder (a held empty subfolder, or another owner's held
    #    document, is invisible to the caller's own id list). Nothing is touched before this.
    await hold_guard.assert_none_held(
        request, current_user, doc_ids, kind="folder", folder_ids=all_folder_ids,
        service_supabase=service_supabase,
    )

    # 4. Rows, then the folder, in ONE transaction as the caller (migration 206,
    #    275-REVIEW B-WR-03): a hold refusal anywhere in the cascade rolls back every document too,
    #    so "Nothing was deleted" is true (D-15). It returns the paths of the rows it deleted.
    with hold_guard.map_hold_refusal(kind="folder"):
        gone_resp = await aexec(supabase.rpc("delete_folder_tree", {"p_folder_id": folder_id}))
    gone = [r for r in (getattr(gone_resp, "data", None) or []) if isinstance(r, dict)]

    # 5. Bytes AFTER the commit (D-38), only for rows that were deleted; a failure is logged
    for doc in gone:
        if doc.get("file_path"):
            try:
                await run_in_threadpool(lambda p=doc["file_path"]: supabase.storage.from_("documents").remove([p]))
            except Exception as exc:
                log.warning("delete_folder: storage remove failed for %s: %s", doc["file_path"], exc)

    # 6. One audit row, on the folder's OWN org (explicit — never the trigger's guess)
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="folder.delete",
        metadata={
            "folder_id": folder_id,
            "name": folder_row.get("name"),
            "documents_deleted": len(gone),
        },
        supabase=service_supabase,
        org_id=folder_row.get("org_id"),
    )


@router.patch("/{folder_id}/toggle-global", response_model=FolderResponse)
async def toggle_global(
    folder_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Toggle is_org_shared on a folder. Only the folder owner can toggle."""
    # 1. Fetch current folder (owner-only)
    current = (
        supabase.table("folders")
        .select("*")
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not maybe_row(current):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Folder not found or you are not the owner",
        )

    new_value = not current.data["is_org_shared"]

    result = (
        supabase.table("folders")
        .update({"is_org_shared": new_value})
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]


@router.patch("/{folder_id}/move", response_model=FolderResponse)
async def move_folder(
    folder_id: str,
    body: FolderMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Move a folder to a different parent. parent_id=null moves to root."""
    # 1. Validate new parent accessibility (if not moving to root)
    if body.parent_id:
        visible = await fetch_visible_folders(supabase, current_user["id"])
        visible_ids = {f["id"] for f in visible}
        if str(body.parent_id) not in visible_ids:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    # 2. Perform move (ownership enforced via user_id filter)
    result = (
        supabase.table("folders")
        .update({"parent_id": str(body.parent_id) if body.parent_id else None})
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]
