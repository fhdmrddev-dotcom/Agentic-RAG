from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status

from app.dependencies import _has_org_permission, get_active_org_id, get_current_user, get_pg_pool
from app.models.expert import (
    ExpertBundleCreate,
    ExpertBundleUpdate,
    ExpertGrant,
    ExpertGrantCreate,
    SkillBodyDraftRequest,
)
from app.services.entitlement_service import require_capability
from app.services.expert_authoring import ExpertDraftOutput, generate_expert_draft
from app.services.skill_body_authoring import (
    AuthoredSkillBody,
    SkillBodyAuthoringDisabled,
    author_skill_body,
)
from app.services.expert_service import (
    ResolvedExpertBundle,
    add_expert_grant_service,
    create_expert_service,
    delete_expert_service,
    filter_visible_skill_names,
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


async def _refuse_unknown_member_skills(
    pool: asyncpg.Pool,
    member_skills: list[str] | None,
    org_id: UUID,
    user_id: UUID,
    bundle_id: UUID | None,
) -> None:
    """Refuse a save whose ``member_skills`` names a capability the author cannot resolve.

    PACK-16 / D-263-09 / D-263-10. The UI's disabled Save is the courteous half; THIS is the
    fence. A stale client or a direct API call walks straight past a UI-only check, which is
    this project's recurring "a green fence coexisting with the shipped defect" shape.

    ⛔ ``member_skills is None`` RETURNS IMMEDIATELY, and that is not defensive coding. On
    ``PATCH`` a missing field means "not being changed"; collapsing ``None`` into ``[]`` would
    run the check against an empty list on every unrelated rename.

    ⛔ It does NOT reuse ``resolve_expert_bundle``: that resolves an EXISTING bundle by id, and
    at ``POST`` time no bundle exists yet. ``filter_visible_skill_names`` (263-01) is the one
    shared predicate precisely so this call site and phase 2 of the resolver cannot drift.

    ⚠ ``unknown`` is derived by SUBTRACTION from the caller's own input (T-263-15) — the payload
    echoes back only names the caller already submitted and never enumerates the library.
    """
    if member_skills is None or not member_skills:
        return

    visible = await filter_visible_skill_names(
        pool,
        skill_names=member_skills,
        caller_org_id=org_id,
        caller_user_id=user_id,
        bundle_id=bundle_id,
    )
    unknown = [name for name in member_skills if name not in visible]
    if not unknown:
        return

    names = ", ".join(unknown)
    raise HTTPException(
        # ⚠ FastAPI reserves 422 for its own RequestValidationError, whose detail is a LIST.
        # Ours is a DICT and the client discriminates on ``detail.error`` — never on the bare
        # status, which would swallow a genuine Pydantic failure into the wrong error type.
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            # ⭐ The "detail" key INSIDE detail is load-bearing, not decorative: the frontend's
            # handleResponse reads exactly ``err.detail?.detail`` for its message.
            "detail": (
                f"{len(unknown)} of this Expert's capabilities do not exist in your library: "
                f"{names}."
            ),
            "error": "expert_member_skills_unknown",
            "unknown_skills": unknown,
        },
    )


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
    # ⛔ ABOVE the `try:` on purpose (T-263-17). HTTPException subclasses Exception, so a 422
    # raised inside it is caught below, logged as an error and re-raised as a 400 whose detail
    # is the stringified exception — D-263-10's named refusal silently destroyed. The placement
    # is asserted mechanically by test_263_expert_save_refuses_unknown_skills.py and was driven
    # RED by moving this call one line down.
    await _refuse_unknown_member_skills(
        pool=pool,
        member_skills=payload.member_skills,
        org_id=org_id,
        user_id=user_id,
        # No bundle exists yet at save time. ⛔ Never `bundle_id=<anything>` here: 263-01's
        # born-for arm is disabled by exactly this None.
        bundle_id=None,
    )
    try:
        return await create_expert_service(
            pool=pool,
            org_id=org_id,
            user_id=user_id,
            bundle_in=payload,
        )
    # ⛔ 263-REVIEW.md WR-09 — ORDER IS THE CONTRACT. The named arm must precede the
    # catch-all or it never runs, and both sit OUTSIDE the refusal above, where an
    # HTTPException would be caught and its 422 re-raised as a 400.
    except asyncpg.UniqueViolationError as exc:
        # The one failure users actually hit. It used to render as the raw driver sentence,
        # index name and all. `detail` is a DICT with an `error` key because the client
        # discriminates on `detail.error` — FastAPI's own 422 body is a LIST, so a bare
        # status is not something a caller can branch on (same shape as PACK-16).
        logger.warning("Duplicate expert slug for org %s: %s", org_id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": f"An Expert with the slug '{payload.slug}' already exists in this organisation.",
                "error": "expert_slug_taken",
            },
        ) from exc
    except Exception as exc:
        # ⛔ The detail stays a LITERAL. It used to be f"…: {exc}", which put asyncpg's
        # message — index names, column tuples, another org's identifiers, and on a driver
        # fault the connection string — into the studio's error banner. The full exception
        # still reaches the log with `exc_info=True`; it just stops reaching the browser.
        logger.error("Failed to create expert bundle: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create expert bundle.",
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
    # 263-REVIEW.md CR-02/CR-03: the asset menu below is built on the BYPASSRLS pool, so
    # the caller's identity must be spliced into the predicates by hand — the database
    # will not re-check anything the query does not say.
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))

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
    # ⛔ 263-REVIEW.md CR-02 — this read `org_id = $1 OR is_org_shared = true`. The OR was
    # UNBRACKETED, so on this BYPASSRLS pool it matched EVERY org's shared folders: their
    # names went into the prompt and their UUIDs came back as `knowledge_folder_ids`.
    # Now mirrors the live SELECT policy verbatim (`full-schema.sql`, "Users can view own
    # and global folders"): org-gated AND (owner OR shared). `folder_is_org_shared(id)` and
    # NOT the flat column — sharing is inherited down a subtree, so the column alone
    # misses every child of a shared parent.
    folder_rows = await pool.fetch(
        "SELECT id, name FROM public.folders "
        "WHERE org_id = $1 AND (user_id = $2 OR public.folder_is_org_shared(id)) "
        "ORDER BY name ASC LIMIT 50;",
        org_id,
        user_id,
    )
    available_folders = [dict(r) for r in folder_rows]

    # ⛔ 263-REVIEW.md CR-03 — this carried NO owner/shared term at all, so another user's
    # PRIVATE skill in the same org reached the drafter and could be proposed as a
    # `member_skills` entry. Worse in this phase than before it: PACK-16's save refusal then
    # answers "…do not exist in your library: <name>" — a false sentence about a name the
    # caller was never entitled to see, echoed back to them.
    # Mirrors the live policy ("Users can view own and global skills") and the one shared
    # rule in `app/utils/skill_visibility.py`: is_system escape OUTSIDE the org gate, then
    # org-gated AND (owner OR org-shared).
    skill_rows = await pool.fetch(
        "SELECT name, description FROM public.skills "
        "WHERE (is_system = true OR (org_id = $1 AND (user_id = $2 OR is_org_shared = true))) "
        "AND is_enabled = true ORDER BY name ASC LIMIT 50;",
        org_id,
        user_id,
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


@router.post("/draft-skill-body", status_code=status.HTTP_200_OK, response_model=AuthoredSkillBody)
async def draft_skill_body(
    payload: SkillBodyDraftRequest,
    active_org: str = Depends(get_active_org_id),
    # ⛔ POSITIONAL-OR-KEYWORD, and there is NO bare `*` anywhere in this signature. That is not
    # a style choice: test_261_single_expert_authoring_gate walks `fn_node.args.defaults`, which
    # does NOT contain keyword-only defaults — a guard after a `*` lands in `kw_defaults`, the
    # fence reads this route as UNPROTECTED, and the gate goes RED on correctly-guarded code.
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> AuthoredSkillBody:
    """Author ONE proposed skill's instruction body (PACK-15 / D-263-13 / D-263-15).

    This route is the whole auth story for ``author_skill_body``, which carries none of its own
    (T-263-09): the router-level ``require_capability("experts")`` plus ``require_expert_manage``
    here, and FLAG-01 inside the service.

    ⛔ It NEVER persists a skill. The row is created by the existing ``POST /skills`` (D-263-03),
    which carries the write guards; a path that both authored AND persisted would be the second
    engine PACK-15 refuses and would bypass them.
    """
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    # Loaded in the ROUTE, not the service — the same shape as draft_expert, so provider
    # credential resolution has exactly one home per surface.
    from app.models.user_settings import load_user_settings  # noqa: PLC0415
    try:
        user_settings = load_user_settings(user_id)
    except Exception as exc:
        logger.warning("Could not load user_settings for %s: %s", user_id, exc)
        user_settings = None

    try:
        authored = await author_skill_body(
            pool,
            skill_name=payload.skill_name,
            skill_description=payload.skill_description,
            why_needed=payload.why_needed,
            expert_name=payload.expert_name,
            expert_description=payload.expert_description,
            user_settings=user_settings,
        )
    except SkillBodyAuthoringDisabled as exc:
        # ⛔ A REFUSAL, not a failure — and it must NOT share a status code with the arm below.
        # D-263-14 gates only GENERATION, so the UI has to be able to say "your operator turned
        # drafting off, write it by hand" rather than "something broke, try again later".
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": str(exc),
                "error": "self_improve_disabled",
            },
        ) from exc

    if authored is None:
        # An honest failure. ⛔ Never a fabricated body: a plausible-looking instruction set
        # nobody authored is worse than an error, because nothing downstream can tell.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": (
                    "Could not draft instructions for this skill right now. You can still "
                    "create it and write the instructions yourself."
                ),
                "error": "skill_body_unavailable",
            },
        )
    return authored


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
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    # Same rule, same home. ⚠ This endpoint has NO try/except, so a 422 propagates cleanly —
    # copy the PLACEMENT from create_expert, not its structure. `bundle_id` is the path id so a
    # skill born FOR this bundle (263-01's third disjunct) resolves rather than being refused.
    await _refuse_unknown_member_skills(
        pool=pool,
        member_skills=payload.member_skills,
        org_id=org_id,
        user_id=user_id,
        bundle_id=bundle_id,
    )
    updated = await update_expert_service(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        bundle_update=payload,
        caller_user_id=user_id,
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
