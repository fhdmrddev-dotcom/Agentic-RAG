import io
import os
import re
import zipfile

import yaml
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.skill import (
    SkillCreate,
    SkillFileResponse,
    SkillImportError,
    SkillImportResult,
    SkillResponse,
    SkillUpdate,
)

router = APIRouter(prefix="/skills", tags=["skills"])


# ── Helper functions ───────────────────────────────────────────────────────────

def _mime_to_subdir(mime_type: str) -> str:
    """Map MIME type to export subdirectory."""
    if mime_type.startswith("text/x-python") or mime_type.endswith("+python") or mime_type == "application/x-python-code":
        return "scripts"
    if mime_type.startswith("image/") or mime_type.startswith("audio/") or mime_type.startswith("video/"):
        return "assets"
    if (
        mime_type.startswith("application/vnd.openxmlformats-officedocument")
        or mime_type in ("application/pdf", "application/zip", "application/octet-stream")
    ):
        return "assets"
    return "references"


def _sanitize_zip_name(name: str) -> str:
    """Raise ValueError if path traversal detected; return safe name otherwise."""
    normalized = os.path.normpath(name.replace("\\", "/"))
    if normalized.startswith("..") or os.path.isabs(normalized):
        raise ValueError(f"Unsafe path in ZIP: {name!r}")
    return normalized


def _parse_skill_md(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter + body from SKILL.md content."""
    if not content.lstrip().startswith("---"):
        raise ValueError("SKILL.md missing YAML frontmatter delimiters")
    parts = content.split("---", 2)
    if len(parts) < 3:
        raise ValueError("SKILL.md missing closing YAML frontmatter delimiter")
    try:
        frontmatter = yaml.safe_load(parts[1])
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML frontmatter: {e}")
    if not isinstance(frontmatter, dict) or "name" not in frontmatter:
        raise ValueError("SKILL.md frontmatter must contain 'name'")
    return frontmatter, parts[2].strip()


def _find_skill_entries(zf: zipfile.ZipFile) -> list[tuple[str, bytes]]:
    """Return list of (prefix, skill_md_bytes). prefix='' for root skills."""
    names = set(zf.namelist())
    entries = []
    if "SKILL.md" in names:
        entries.append(("", zf.read("SKILL.md")))
    else:
        for n in sorted(names):
            parts = n.split("/")
            if len(parts) == 2 and parts[1] == "SKILL.md":
                entries.append((parts[0] + "/", zf.read(n)))
    return entries


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


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_skill(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Import skill(s) from a ZIP file in agentskills.io format."""
    # 1. Read and validate size
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP file exceeds 10 MB limit")

    # 2. Validate it is actually a ZIP
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP")

    results: list[dict] = []
    errors: list[dict] = []

    with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
        # 3. Sanitize all entries first (OPEN-06)
        for entry_name in zf.namelist():
            try:
                _sanitize_zip_name(entry_name)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsafe file path detected in ZIP: {entry_name}",
                )

        # 4. Find SKILL.md entries
        skill_entries = _find_skill_entries(zf)
        if not skill_entries:
            raise HTTPException(status_code=400, detail="No SKILL.md found in ZIP")

        # 5. Parse all SKILL.md first — no DB writes yet (OPEN-05 atomicity)
        parsed: list[tuple[str, dict, str]] = []
        for prefix, skill_bytes in skill_entries:
            try:
                fm, instructions = _parse_skill_md(skill_bytes.decode("utf-8"))
                parsed.append((prefix, fm, instructions))
            except (ValueError, UnicodeDecodeError) as e:
                errors.append({"skill": prefix or "root", "error": str(e)})

        # If nothing was parsed at all, return 400
        if not parsed and not errors:
            raise HTTPException(status_code=400, detail="No valid SKILL.md found in ZIP")
        if not parsed and errors:
            raise HTTPException(status_code=400, detail=errors[0]["error"])

        # 6. Create DB rows for successfully parsed skills
        for prefix, fm, instructions in parsed:
            skill_row = (
                supabase.table("skills")
                .insert({
                    "user_id": current_user["id"],
                    "name": fm["name"],
                    "description": fm.get("description", ""),
                    "instructions": instructions,
                    "is_global": False,
                })
                .execute()
            ).data[0]
            results.append(skill_row)

            # Upload companion files
            for entry_name in zf.namelist():
                if not entry_name.startswith(prefix):
                    continue
                if entry_name.endswith("SKILL.md") or entry_name.endswith("/"):
                    continue
                relative = entry_name[len(prefix):] if prefix else entry_name
                filename = os.path.basename(relative)
                if not filename:
                    continue
                file_bytes = zf.read(entry_name)
                storage_path = f"{current_user['id']}/{skill_row['id']}/{filename}"
                supabase.storage.from_("skill-files").upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": "application/octet-stream"},
                )
                supabase.table("skill_files").insert({
                    "skill_id": skill_row["id"],
                    "user_id": current_user["id"],
                    "filename": filename,
                    "file_path": storage_path,
                    "file_size": len(file_bytes),
                    "mime_type": "application/octet-stream",
                }).execute()

    return {"created": results, "errors": errors}


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

    # 4. Upload to storage — use upsert to handle re-upload of same filename
    try:
        supabase.storage.from_("skill-files").upload(
            path=storage_path,
            file=raw,
            file_options={
                "content-type": file.content_type or "application/octet-stream",
                "upsert": "true",
            },
        )
    except Exception as upload_err:
        raise HTTPException(
            status_code=500,
            detail=f"Storage upload failed: {upload_err}",
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


@router.get("/{skill_id}/export")
async def export_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Export a skill as a ZIP file in agentskills.io format."""
    # 1. Fetch skill (owner-only)
    skill = (
        supabase.table("skills")
        .select("*")
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not skill.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill_row = skill.data[0] if isinstance(skill.data, list) else skill.data

    # 2. Fetch attached files
    files = (
        supabase.table("skill_files")
        .select("*")
        .eq("skill_id", skill_id)
        .execute()
    )

    # 3. Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        fm = {
            "name": skill_row["name"],
            "description": skill_row["description"],
            "license": "MIT",
            "compatibility": "1.0",
        }
        skill_md = f"---\n{yaml.dump(fm, default_flow_style=False)}---\n\n{skill_row['instructions']}"
        zf.writestr("SKILL.md", skill_md)

        for f in files.data:
            subdir = _mime_to_subdir(f["mime_type"])
            raw = supabase.storage.from_("skill-files").download(f["file_path"])
            safe_name = os.path.basename(f["filename"])
            zf.writestr(f"{subdir}/{safe_name}", raw)

    buf.seek(0)
    slug = skill_row["name"].replace(" ", "-").lower()
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}.zip"'},
    )
