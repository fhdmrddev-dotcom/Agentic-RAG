from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.folder import FolderCreate, FolderMoveRequest, FolderUpdate, FolderResponse

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List all folders visible to the current user (owned + global)."""
    result = (
        supabase.table("folders")
        .select("*")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .order("name")
        .execute()
    )
    # Deduplicate by id in case user owns a global folder
    seen = set()
    folders = []
    for row in result.data:
        if row["id"] not in seen:
            seen.add(row["id"])
            folders.append(row)
    return folders


@router.get("/{folder_id}/children", response_model=list[FolderResponse])
async def list_children(
    folder_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List direct children of a folder that are visible to the current user."""
    result = (
        supabase.table("folders")
        .select("*")
        .eq("parent_id", folder_id)
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .order("name")
        .execute()
    )
    seen = set()
    folders = []
    for row in result.data:
        if row["id"] not in seen:
            seen.add(row["id"])
            folders.append(row)
    return folders


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Create a new folder. Validates parent_id ownership if provided."""
    if body.parent_id:
        parent = (
            supabase.table("folders")
            .select("id, user_id, is_global")
            .eq("id", str(body.parent_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not parent.data:
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
    if name_check.data:
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
            "is_global": body.is_global,
        })
        .execute()
    )
    return result.data[0]


@router.patch("/{folder_id}", response_model=FolderResponse)
async def rename_folder(
    folder_id: str,
    body: FolderUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
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
    if not current.data:
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
    if name_check.data:
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
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Delete a folder and all documents inside it (storage + DB + chunks)."""
    # 1. Collect this folder and all descendant folder IDs (BFS)
    all_folder_ids = [folder_id]
    queue = [folder_id]
    while queue:
        parent = queue.pop(0)
        children = supabase.table("folders").select("id").eq("parent_id", parent).execute()
        for child in children.data:
            all_folder_ids.append(child["id"])
            queue.append(child["id"])

    # 2. Find all documents in these folders
    docs_result = (
        supabase.table("documents")
        .select("id, file_path")
        .in_("folder_id", all_folder_ids)
        .execute()
    )

    # 3. Delete each document from storage, then DB (chunks cascade via FK)
    for doc in docs_result.data:
        try:
            supabase.storage.from_("documents").remove([doc["file_path"]])
        except Exception:
            pass
    if docs_result.data:
        doc_ids = [d["id"] for d in docs_result.data]
        supabase.table("documents").delete().in_("id", doc_ids).execute()

    # 4. Delete the folder (DB cascade handles descendant folders)
    supabase.table("folders").delete().eq("id", folder_id).eq("user_id", current_user["id"]).execute()


@router.patch("/{folder_id}/move", response_model=FolderResponse)
async def move_folder(
    folder_id: str,
    body: FolderMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Move a folder to a different parent. parent_id=null moves to root."""
    # 1. Validate new parent accessibility (if not moving to root)
    if body.parent_id:
        parent = (
            supabase.table("folders")
            .select("id")
            .eq("id", str(body.parent_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not parent.data:
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
