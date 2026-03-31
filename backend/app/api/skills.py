from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.skill import SkillCreate, SkillUpdate, SkillResponse

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
    new_value = not current.data["is_enabled"]
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
    new_value = not current.data["is_global"]
    result = (
        supabase.table("skills")
        .update({"is_global": new_value})
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]
