import io
import logging
import os
import re
import zipfile

import yaml
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, StreamingResponse
from supabase import Client

# Phase 163 (TEN-02 / D-03): the skills CRUD + files + import/export handlers run on the
# per-request user-JWT client (RLS-ENFORCED). skills / skill_files have authenticated own+global
# SELECT + owner-scoped INSERT/UPDATE/DELETE policies (mig 108) and BEFORE-INSERT
# autofill_org_id triggers, and the skill-files storage bucket is owner-path-scoped under
# authenticated — so every handler here (incl. import_skill's file-upload BackgroundTask, which
# writes skill_files + owner-path storage) works under the user-JWT client. The version-capture
# trigger is SECURITY DEFINER, so version rows are still written on skill create/update. KEEP
# .eq("user_id") (D-14) + run_in_threadpool (D-v2.5-01). The re-embed writer is out of scope (plan 09).
from app.dependencies import get_current_user, get_user_supabase_client
from app.models.skill import (
    PublishGate,
    SkillCreate,
    SkillFileResponse,
    SkillImportError,
    SkillImportResult,
    SkillResponse,
    SkillUpdate,
    TogglePublishBody,
)
from app.services.publish_gate_service import compute_publish_gate
from app.services.skill_lint import lint_description
# Phase 142 (SRH-01 / SC#1 / D-08): single source for the non-Python script-extension
# set (Plan 01 defines it in tool_dispatcher). No circular import — tool_dispatcher does
# NOT import app.api.skills.
from app.services.tool_dispatcher import SCRIPT_EXTS

logger = logging.getLogger(__name__)

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


def _dedup_flattened_name(filename: str, used_names: set[str]) -> str:
    """Return a collision-free flattened basename, registering it in ``used_names``.

    First occurrence keeps its plain name. A repeat gets the smallest integer
    ``>= 2`` inserted before the extension (``__init__.py`` -> ``__init__2.py`` ->
    ``__init__3.py``; a no-extension name like ``Makefile`` -> ``Makefile2``),
    skipping any candidate already taken. Deterministic and collision-free — this is
    the fix that stops two ZIP entries in different folders (which flatten to the same
    basename) from resolving to one storage path and silently losing a file.
    """
    if filename not in used_names:
        used_names.add(filename)
        return filename
    stem, ext = os.path.splitext(filename)
    n = 2
    candidate = f"{stem}{n}{ext}"
    while candidate in used_names:
        n += 1
        candidate = f"{stem}{n}{ext}"
    used_names.add(candidate)
    return candidate


def _upload_skill_files(
    files_to_upload: list[dict],
    skill_id: str,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """Upload companion files to storage and insert metadata rows.

    Each dict in files_to_upload must contain:
      file_bytes, filename, storage_path, mime_type

    Resilient per-file: a single file's storage upload OR DB insert failure is
    caught, logged, and collected — it never aborts the loop, so every later file
    is still attempted. This fixes the silent data-loss bug where one unhandled
    upload exception (e.g. a duplicate storage path) dropped every file after it.

    Returns a list of ``{"filename", "error"}`` dicts (empty when all succeed).
    Callers decide how to surface it: the synchronous import path folds it into the
    response ``errors`` list (SkillImportError channel); the backgrounded path has no
    response channel left, so these failures live only in the ``logger.warning`` log.
    """
    errors: list[dict] = []
    for entry in files_to_upload:
        try:
            supabase.storage.from_("skill-files").upload(
                path=entry["storage_path"],
                file=entry["file_bytes"],
                file_options={"content-type": entry["mime_type"]},
            )
            supabase.table("skill_files").insert({
                "skill_id": skill_id,
                "user_id": user_id,
                "filename": entry["filename"],
                "file_path": entry["storage_path"],
                "file_size": len(entry["file_bytes"]),
                "mime_type": entry["mime_type"],
            }).execute()
        except Exception as exc:
            logger.warning(
                "Skill file upload failed (skill_id=%s, filename=%s): %s",
                skill_id,
                entry["filename"],
                exc,
            )
            errors.append({"filename": entry["filename"], "error": str(exc)})
    return errors


def _sibling_descriptions(
    supabase: Client, user_id: str, exclude_skill_id: str | None = None
) -> list[str]:
    """Owner-scoped (own + global) sibling descriptions for the lint duplicate check.

    Uses the SAME owner-scoped ``.or_(user_id.eq, is_global.eq.true)`` filter as
    ``list_skills`` — never another user's private skills (T-123-01-02). On PATCH the
    edited skill is excluded so a skill never flags itself as a duplicate. Never raises:
    a read failure degrades to an empty sibling list (the lint stays advisory).
    """
    try:
        result = (
            supabase.table("skills")
            .select("id, description")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .execute()
        )
        rows = result.data or []
        return [
            r.get("description", "")
            for r in rows
            if str(r.get("id")) != str(exclude_skill_id)
        ]
    except Exception:
        return []


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List all skills visible to the current user (owned + global), deduplicated."""
    result = (
        supabase.table("skills")
        .select("*")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        # CREATE-01 (D-05): is_system rows FIRST, then alphabetical — the built-in
        # skill-creator pins to the top of the Skills list. PostgREST emits
        # order=is_system.desc,name.asc. Chained multi-column order is an established
        # pattern here (documents.py:1903; toggle_global chains version_number desc).
        .order("is_system", desc=True).order("name")
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
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create a new skill owned by the current user."""
    # Phase 123 (WR-07): reject an empty/whitespace name. A blank name would render a
    # malformed catalog line ("- ****: ...", agent_loop catalog note) and produce an
    # unaddressable skill (tool_dispatcher resolves by name). The lint is advisory-only,
    # so this is the hard gate.
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Skill name cannot be empty")

    # TRIG-03 (D-09/D-10): lint the description PRE-persist against owner-scoped
    # siblings (own + global), attach warnings to the response, but ALWAYS save.
    siblings = _sibling_descriptions(supabase, current_user["id"])
    warnings = lint_description(body.name, body.description, siblings)

    result = (
        supabase.table("skills")
        .insert({
            "user_id": current_user["id"],
            "name": body.name.strip(),
            "description": body.description,
            "instructions": body.instructions,
            "is_global": False,  # HARD-SET — never from the caller (D-08 / T-118-02-01)
        })
        .execute()
    )
    row = dict(result.data[0])
    row["lint_warnings"] = warnings
    return row


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_skill(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
        has_background = False
        # Phase 142 (SRH-01 / SC#1 / D-08): non-blocking honesty notes — one entry per
        # skill that bundles a non-Python script (the G-B, import-time-knowable gap, D-10).
        notes: list[dict] = []
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

            # Build list of companion file dicts
            files_to_upload: list[dict] = []
            used_names: set[str] = set()
            script_names: list[str] = []  # 142: non-Python scripts this skill bundles
            for entry_name in zf.namelist():
                if not entry_name.startswith(prefix):
                    continue
                if entry_name.endswith("SKILL.md") or entry_name.endswith("/"):
                    continue
                relative = entry_name[len(prefix):] if prefix else entry_name
                filename = os.path.basename(relative)
                if not filename:
                    continue
                # Phase 142 (SC#1 / D-08 / D-10 / T-142-03): static ZIP-extension scan —
                # the only import-time-knowable runtime-gap signal (G-B). Inspect ONLY
                # splitext(basename) on the entry, which was already validated by
                # _sanitize_zip_name at step 3; no path is built from untrusted input, so
                # this adds no new traversal surface. Mechanism-only — never blocks the
                # import and never edits instructions (D-12).
                ext = os.path.splitext(filename)[1].lstrip(".").lower()
                if ext in SCRIPT_EXTS and filename not in script_names:
                    script_names.append(filename)
                # De-dup the flattened basename BEFORE building the storage path so two
                # entries in different folders that flatten to the same basename (e.g.
                # pkg_a/__init__.py + pkg_b/__init__.py) get DISTINCT paths and neither is
                # silently lost. The os.path.basename flattening above is unchanged —
                # folder-tree fidelity stays out of scope; this only stops collisions.
                unique_name = _dedup_flattened_name(filename, used_names)
                file_bytes = zf.read(entry_name)
                storage_path = f"{current_user['id']}/{skill_row['id']}/{unique_name}"
                files_to_upload.append({
                    "file_bytes": file_bytes,
                    "filename": unique_name,
                    "storage_path": storage_path,
                    "mime_type": "application/octet-stream",
                })

            # Phase 142 (SC#1 / D-08): attach a single non-blocking honesty note if this
            # skill bundles any non-Python script. The import still succeeds regardless.
            if script_names:
                notes.append({
                    "skill": fm["name"],
                    "note": (
                        f"'{fm['name']}' includes a step the sandbox can't run yet "
                        f"({', '.join(script_names)}); its instructions still work."
                    ),
                })

            file_count = len(files_to_upload)
            if file_count > 20:
                # Backgrounded: the HTTP response is already sent, so per-file failures
                # have no response channel — they are captured by the logger.warning in
                # _upload_skill_files. Its return is intentionally discarded here.
                background_tasks.add_task(
                    _upload_skill_files,
                    files_to_upload,
                    skill_row["id"],
                    current_user["id"],
                    supabase,
                )
                has_background = True
            else:
                upload_errors = _upload_skill_files(
                    files_to_upload, skill_row["id"], current_user["id"], supabase
                )
                if upload_errors:
                    # Surface per-file failures through the EXISTING SkillImportError
                    # channel ({skill, error}) the endpoint already returns and the
                    # frontend already renders as "X imported, Y failed" — one summary
                    # row per skill naming each failed file and its reason.
                    failed_summary = "; ".join(
                        f"{e['filename']}: {e['error']}" for e in upload_errors
                    )
                    errors.append({
                        "skill": fm["name"],
                        "error": (
                            f"{len(upload_errors)} file(s) failed to upload — "
                            f"{failed_summary}"
                        ),
                    })

    if has_background:
        return JSONResponse(
            status_code=202,
            content={
                "created": results,
                "errors": errors,
                # Phase 142 (SC#1 / Pitfall 5): additive OPTIONAL key on BOTH branches —
                # existing consumers ignore it.
                "notes": notes,
                "message": "Skill imported — files uploading in background",
            },
        )
    return {"created": results, "errors": errors, "notes": notes}


@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    body: SkillUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Update name, description, or instructions of an owned skill."""
    update_data = body.model_dump(exclude_none=True)
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
        # Phase 123 (WR-07): a name present in the patch that strips to empty must be
        # rejected — otherwise a skill is renamed to "" (malformed catalog note + an
        # unaddressable, dedupe-by-name-breaking skill). The ``if not update_data`` guard
        # below does NOT catch this: the dict is still truthy (it carries ``name: ""``).
        if not update_data["name"]:
            raise HTTPException(status_code=400, detail="Skill name cannot be empty")
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

    # TRIG-03 (D-09): re-lint the resulting skill (this PATCH is also the D-03
    # author-confirm winner write). Excludes the edited skill from the duplicate
    # check; warnings are attached but the update has already succeeded.
    row = dict(result.data[0])
    siblings = _sibling_descriptions(supabase, current_user["id"], exclude_skill_id=skill_id)
    row["lint_warnings"] = lint_description(
        row.get("name", ""), row.get("description", ""), siblings
    )
    return row


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    result = (
        supabase.table("skills")
        .delete()
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Skill not found")


@router.patch("/{skill_id}/toggle-enabled", response_model=SkillResponse)
async def toggle_enabled(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    body: TogglePublishBody | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Flip the is_global boolean on an owned skill. Only the owner can toggle.

    GATE-01 (D-07): the private→global direction is GATED. The server recomputes the publish
    gate from ``eval_runs`` (never trusting any client-supplied gate data) and REFUSES the flip
    with a structured 409 unless the gate is met OR the request explicitly overrides
    (``{"override": true}``). A force-publish (override on an unmet gate) is RECORDED as an
    owner-visible ``skill_publish_overrides`` row with the gate snapshot AT THE MOMENT OF
    OVERRIDE (D-01/D-02). The global→private direction (unshare) is NEVER gated, and a later
    re-share re-runs the whole check fresh — no was-ever-published grandfathering (D-09).
    """
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

    # Step 2: Compute new value
    # current.data is a list (select returns list); maybe_single behaviour varies by client version
    skill_row = current.data[0] if isinstance(current.data, list) else current.data
    new_value = not skill_row["is_global"]

    # Step 3 (GATE-01 / D-07): gate the private→global direction ONLY. Unshare (new_value is
    # False) falls straight through to the UPDATE — never gated, and the NEXT re-share re-gates
    # (D-09 — no grandfathering state is stored).
    if new_value is True:
        gate = await compute_publish_gate(supabase, skill_id, current_user["id"])
        if not gate.met and not (body and body.override):
            # Structured refusal — the client can never fabricate a passing eval (D-07). The
            # dialog renders THIS server-computed gate; the 409 body is server→client only.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "publish_gate_unmet", "gate": gate.model_dump()},
            )
        if not gate.met and body and body.override:
            # Force-publish (D-01/D-02): record an owner-visible audit row with the gate snapshot
            # AT THE MOMENT OF OVERRIDE. Resolve the skill's LATEST version id FIRST (migration
            # 079's UNIQUE(skill_id, version_number) makes version_number the ordering key); null
            # only when the skill has no version rows. Both the read + the INSERT run off the
            # event loop (D-v2.5-01 — the new hot path follows the evals.py wrap pattern even
            # though the legacy skills handlers do not).
            def _read_latest_version():
                return (
                    supabase.table("skill_versions")
                    .select("id")
                    .eq("skill_id", skill_id)
                    .eq("user_id", current_user["id"])
                    .order("version_number", desc=True)
                    .limit(1)
                    .execute()
                )

            version_rows = list((await run_in_threadpool(_read_latest_version)).data or [])
            resolved_version_id = version_rows[0]["id"] if version_rows else None

            def _insert_override():
                return (
                    supabase.table("skill_publish_overrides")
                    .insert({
                        "skill_id": skill_id,
                        "skill_version_id": resolved_version_id,
                        "user_id": current_user["id"],
                        "gate_state": gate.state,
                        "gate_snapshot": {
                            "measured_count": gate.measured,
                            "passed_count": gate.passed,
                            "reason": gate.reason,
                        },
                    })
                    .execute()
                )

            await run_in_threadpool(_insert_override)
        # gate.met is True → a straight publish, no override row.

    # Step 4: Apply the is_global UPDATE (owner-scoped).
    result = (
        supabase.table("skills")
        .update({"is_global": new_value})
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]


@router.get("/{skill_id}/publish-gate", response_model=PublishGate)
async def get_publish_gate(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Return the server-computed publish gate for an owned skill (D-05).

    The Plan 03 dialog renders THIS authoritative status before the user commits — the server
    recomputes from ``eval_runs`` and IGNORES any client-supplied gate data (T-136-03).
    Owner-verify with an endpoint-local 403 (consistent with ``toggle_global``); the gate
    compute is a second owner-scoped backstop (T-136-04).
    """
    def _read_skill():
        return (
            supabase.table("skills")
            .select("id")
            .eq("id", skill_id)
            .eq("user_id", current_user["id"])
            .limit(1)
            .execute()
        )

    skill_rows = list((await run_in_threadpool(_read_skill)).data or [])
    if not skill_rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Skill not found or you are not the owner",
        )
    return await compute_publish_gate(supabase, skill_id, current_user["id"])


@router.get("/{skill_id}/files", response_model=list[SkillFileResponse])
async def list_skill_files(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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
    slug = re.sub(r'[^a-z0-9-]+', '-', skill_row["name"].lower()).strip('-')

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
            "name": slug,
            "description": skill_row["description"],
            "license": "MIT",
            "metadata": {
                "version": "1.0",
                "original_name": skill_row["name"],
            },
            "compatibility": "Requires execute_code tool with Docker sandbox and python-docx",
        }
        skill_md = f"---\n{yaml.dump(fm, default_flow_style=False)}---\n\n{skill_row['instructions']}"
        zf.writestr(f"{slug}/SKILL.md", skill_md)

        for f in files.data:
            subdir = _mime_to_subdir(f["mime_type"])
            raw = supabase.storage.from_("skill-files").download(f["file_path"])
            safe_name = os.path.basename(f["filename"])
            zf.writestr(f"{slug}/{subdir}/{safe_name}", raw)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}.zip"'},
    )
