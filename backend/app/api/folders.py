from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.folder import FolderCreate, FolderUpdate, FolderResponse

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
    """Delete a folder. DB cascade handles descendant folders."""
    supabase.table("folders").delete().eq("id", folder_id).eq("user_id", current_user["id"]).execute()
