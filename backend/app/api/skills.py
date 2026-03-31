from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.skill import SkillCreate, SkillUpdate, SkillResponse, SkillFileResponse

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List all skills visible to the current user (owned + global), deduplicated."""
    result = (
        supabase.table("skills")
        .select("*")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .order("name")
        .execute()
    )
    seen = set()
    skills = []
    for row in result.data:
        if row["id"] not in seen:
            seen.add(row["id"])
            skills.append(row)
    return skills


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    body: SkillCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Create a new skill owned by the current user."""
    result = (
        supabase.table("skills")
        .insert({
            "user_id": current_user["id"],
            "name": body.name.strip(),
            "description": body.description,
            "instructions": body.instructions,
            "is_global": body.is_global,
        })
        .execute()
    )
    return result.data[0]


@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    body: SkillUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Update name, description, or instructions of an owned skill."""
    update_data = body.model_dump(exclude_none=True)
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("skills")
        .update(update_data)
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    return result.data[0]


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Delete a skill and cascade-remove all associated storage files."""
    # Step 1: Fetch all file_paths for the skill
    files = (
        supabase.table("skill_files")
        .select("id, file_path")
        .eq("skill_id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    # Step 2: Remove each file from storage
    for f in files.data:
        try:
            supabase.storage.from_("skill-files").remove([f["file_path"]])
        except Exception:
            pass

    # Step 3: Delete the skill row (skill_files cascade via FK)
    supabase.table("skills").delete().eq("id", skill_id).eq("user_id", current_user["id"]).execute()


@router.patch("/{skill_id}/toggle-enabled", response_model=SkillResponse)
async def toggle_enabled(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Flip the is_enabled boolean on an owned skill."""
    # Step 1: Fetch current state
    current = (
        supabase.table("skills")
        .select("*")
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not current.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Skill not found or you are not the owner",
        )

    # Step 2: Compute new value and update
    # current.data is a list (select returns list); maybe_single behaviour varies by client version
    skill_row = current.data[0] if isinstance(current.data, list) else current.data
    new_value = not skill_row["is_enabled"]
    result = (
        supabase.table("skills")
        .update({"is_enabled": new_value})
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]


@router.patch("/{skill_id}/toggle-global", response_model=SkillResponse)
async def toggle_global(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Flip the is_global boolean on an owned skill. Only the owner can toggle."""
    # Step 1: Fetch current state (owner-only)
    current = (
        supabase.table("skills")
        .select("*")
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not current.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Skill not found or you are not the owner",
        )

    # Step 2: Compute new value and update
    # current.data is a list (select returns list); maybe_single behaviour varies by client version
    skill_row = current.data[0] if isinstance(current.data, list) else current.data
    new_value = not skill_row["is_global"]
    result = (
        supabase.table("skills")
        .update({"is_global": new_value})
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]


@router.get("/{skill_id}/files", response_model=list[SkillFileResponse])
async def list_skill_files(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List files attached to a skill (owner or global skill only)."""
    # Verify skill is accessible (own or global)
    skill = (
        supabase.table("skills")
        .select("id, user_id, is_global")
        .eq("id", skill_id)
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .maybe_single()
        .execute()
    )
    if not skill.data:
        raise HTTPException(status_code=404, detail="Skill not found")

    result = (
        supabase.table("skill_files")
        .select("*")
        .eq("skill_id", skill_id)
        .order("filename")
        .execute()
    )
    return result.data


@router.post("/{skill_id}/files", response_model=SkillFileResponse,
             status_code=status.HTTP_201_CREATED)
async def upload_skill_file(
    skill_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Upload a file to a skill. Only the skill owner can upload."""
    # 1. Read file and enforce 10 MB limit (checked before DB access)
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    # 2. Verify user owns the skill
    skill = (
        supabase.table("skills")
        .select("id")
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not skill.data:
        raise HTTPException(status_code=403, detail="Skill not found or not owned by you")

    # 3. Storage path: user_id/skill_id/filename (FILE-03)
    storage_path = f"{current_user['id']}/{skill_id}/{file.filename}"

    # 4. Upload to storage (overwrites if path already exists)
    supabase.storage.from_("skill-files").upload(
        path=storage_path,
        file=raw,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )

    # 5. Insert metadata row (upsert via delete+insert handled at DB level via unique constraint)
    result = (
        supabase.table("skill_files")
        .insert({
            "skill_id": skill_id,
            "user_id": current_user["id"],
            "filename": file.filename,
            "file_path": storage_path,
            "file_size": len(raw),
            "mime_type": file.content_type or "application/octet-stream",
        })
        .execute()
    )
    return result.data[0]


@router.delete("/{skill_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill_file(
    skill_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Delete a file from a skill. Only the file owner can delete."""
    # 1. Fetch file row (owner only — enforces FILE-06)
    file_row = (
        supabase.table("skill_files")
        .select("*")
        .eq("id", file_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not file_row.data:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Remove from storage (best-effort)
    file_data = file_row.data[0] if isinstance(file_row.data, list) else file_row.data
    try:
        supabase.storage.from_("skill-files").remove([file_data["file_path"]])
    except Exception:
        pass

    # 3. Delete metadata row
    supabase.table("skill_files").delete().eq("id", file_id).execute()
