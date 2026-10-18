"""Phase 286 (REG-07, plan 286-01, 2026-10-18) — the ``/workflows`` authoring doors.

Moved VERBATIM out of ``app/api/workflows.py`` with the route decorator REMOVED: ``GenerateRequest``,
``generate_workflow`` (``POST /workflows/generate``), ``read_template_placeholders``
(``POST /workflows/template/placeholders``), ``upload_workflow_template``
(``POST /workflows/{definition_id}/template``) and ``get_workflow_template_placeholders``
(``GET /workflows/{definition_id}/template/placeholders``).

⚠ THE ROUTES ARE NOT REGISTERED HERE. ``workflows.py`` registers each handler on its ONE
``router`` as ``router.<verb>(<the decorator's arguments, verbatim>)(<handler>)``, at the exact
position the decorated def used to occupy. Same router object, same ``add_api_route`` path, same
declaration order — a second ``APIRouter`` or an ``include_router`` would reorder the table and
let ``/{definition_id}`` patterns shadow literal segments. Pinned by
``tests/unit/test_286_workflows_seam_pins.py`` (OpenAPI sub-document, ordered route table, and
AST identity of each body AND each decorator call), committed before the move.

Moved by OPERATOR DECISION (286-01 Task 1, option B, 2026-10-18), not by D-03's letter: three of
these handlers were patched through ``app.api.workflows.get_pg_pool``. Those tests now patch
``app.api.workflow_authoring_doors.get_pg_pool`` — the name these bodies look up — in a
test-only commit separate from the move (D-13).

The template-door invariants travel unchanged (D-06), because the bodies are byte-identical:
  * ``read_template_placeholders`` injects NO Supabase client and NO pool — the cross-tenant
    class has nothing to attach to (``test_193_1_stateless_placeholders.py`` sweeps its code);
  * the zip-bomb cap (``_TEMPLATE_MAX_UNCOMPRESSED_BYTES``) and the 422-never-"no placeholders"
    ordering of its gates;
  * the owner-gate (``_owned_slug_or_404``), the owner-prefix check and the ``..`` traversal
    check on the stored doors.

No cycle: this module imports wire symbols from ``workflow_wire`` and never imports
``app.api.workflows``.
"""
from __future__ import annotations

import io
import logging
import re
import zipfile
from uuid import UUID, uuid4

from fastapi import Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.api.workflow_wire import (
    TemplateAssetRef,
    TemplatePlaceholdersResponse,
    _TEMPLATE_MAX_UNCOMPRESSED_BYTES,
    _TEMPLATE_MIME_BY_EXT,
    _coerce_user_id,
    _owned_slug_or_404,
)
from app.api.workspace import validate_upload
from app.config import settings
from app.dependencies import (
    get_current_user,
    get_pg_pool,
    get_supabase,
    get_user_supabase_client,
)
from app.services import workflow_authoring
from app.services.harness import grounding
from app.services.template_render_service import (
    parse_docx_template_variables,
    placeholder_names_from_parsed,
)
from app.services.workspace_service import BUCKET_NAME, MAX_FILE_SIZE

# ⚠ THE LITERAL, NOT ``__name__``. These handlers logged as ``app.api.workflows`` before they
# moved, and ``caplog`` filters and log search key on that name — a renamed logger is a runtime
# behaviour change. Pinned by ``test_286_workflows_seam_pins.py``'s logger case.
logger = logging.getLogger("app.api.workflows")


class GenerateRequest(BaseModel):
    """The NL-authoring body (D-103-CONF-2). ``describe`` is the plain-language task;
    template grounding is OPTIONAL — a library ``template_asset_id`` OR a direct
    ``template_placeholders`` list (never both required)."""

    describe: str
    project_folder_id: UUID | None = None
    template_asset_id: UUID | None = None
    template_placeholders: list[str] | None = None
    # Phase 214 (STEP-06 / D-214-20) — the connections the AUTHOR ticked on the describe door,
    # which become the generator's whole vocabulary for `external_action` steps.
    #
    # ⚠ ABSENT AND EMPTY ARE DIFFERENT FACTS AND MUST NEVER COLLAPSE. `None` is today's
    # UNCONSTRAINED behaviour (the author expressed no preference); `[]` is the author's
    # DECISION that no external step may be emitted at all. `list[str] | None = None` carries
    # both; a `Field(default_factory=list)` here would erase the distinction at the boundary
    # and no amount of care downstream could get it back. The full semantics are stated where
    # the service parameter is declared (`workflow_authoring.generate_workflow_definition`).
    #
    # ⚠ `str`, NOT `UUID`, and deliberately: `connector_connections.id` reaches the client as a
    # string and is re-scoped by org at every read (D-14). A `UUID` here would 422 a whole
    # generation on a malformed id the ENFORCEMENT below would otherwise simply refuse to
    # honour — an unrecognised id constrains, it never widens.
    allowed_connection_ids: list[str] | None = None


async def generate_workflow(
    body: GenerateRequest,
    current_user: dict = Depends(get_current_user),
    # service-role: delegates to the out-of-scope workflow_authoring service (grounding
    # assembly reads spanning folders/templates/assets — not audited for RLS-readiness here).
    supabase=Depends(get_supabase),
):
    """Generate a grounded ``WorkflowDefinition`` DRAFT from an NL description (REQ-2).

    Delegates to ``workflow_authoring.generate_workflow_definition`` (the orchestration
    stays OUT of the route body). Returns the service result dict directly:
      - ``{ok: True, definition}`` -> a draft object the Builder loads (NOT persisted);
      - ``{ok: False, error, detail}`` -> an HONEST "could not generate" (the UI
        distinguishes on ``ok``). A service ``ok=False`` is returned as 200 with the
        structured error body — it is not an HTTP error, it is an honest failure surface.

    ``project_folder_id`` / ``template_asset_id`` are path/body ``UUID``s -> FastAPI 422
    on a malformed value (V5).
    """
    pool = await get_pg_pool()
    user_id = current_user["id"]
    result = await workflow_authoring.generate_workflow_definition(
        describe=body.describe,
        supabase=supabase,
        user_id=str(user_id),
        settings=settings,
        pool=pool,
        project_folder_id=body.project_folder_id,
        template_asset_id=body.template_asset_id,
        template_placeholders=body.template_placeholders,
        # ⚠ FORWARDED VERBATIM — no `or None`, no `or []`, no `if body.allowed_connection_ids`.
        # Every one of those collapses the absent arm into the empty one or the reverse, and
        # the two mean opposite things (see the field's own declaration above).
        allowed_connection_ids=body.allowed_connection_ids,
    )
    return result


async def read_template_placeholders(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> TemplatePlaceholdersResponse:
    """Read a template's fill-in fields from the BYTES, persisting nothing (D-05).

    WHY THIS ROUTE EXISTS. The sibling upload door needs a saved workflow
    (``POST /{definition_id}/template``), and at describe time there is no workflow yet
    — so an author who wants the draft built to fit their template has a chicken-and-egg
    problem. This door takes the bytes straight off their disk and answers with the field
    names. **No row, no Storage object, no draft.** Rejected alternatives, recorded so the
    shape reads as a decision: minting an empty draft up front (library rows the user
    never asked for, and a second writer against Phase 186's concurrency token), and
    stashing to a scratch Storage path (an orphan-cleanup problem nobody owns, on bytes
    that are RLS-sensitive).

    ⚠ **IT INJECTS NO SUPABASE CLIENT AND NO POOL, AND THAT IS A CLASS ELIMINATION
    RATHER THAN A STYLE CHOICE.** Quick task ``260814-q5r`` had to write an owner-prefix
    check AND a ``..`` traversal check on its read door, because that route resolves a
    caller-supplied Storage PATH through a client sitting on a service-role pool which
    bypasses RLS — a hand-written guard in front of a service-role read is the exact
    shape of a prior credential-exposure defect in this codebase. This route accepts no
    path and owns no row, so there is nothing for that class to attach to. Adding
    ``supabase=Depends(get_supabase)`` "for symmetry" would REINTRODUCE it; the fence in
    ``tests/unit/test_193_1_stateless_placeholders.py`` sweeps the body as well as the
    signature so that edit reds.

    THE GATES, in the sibling's exact order — each one load-bearing:

      1. **The DECLARED part size, before the body is materialised** (the WR-04 fix) —
         uvicorn/FastAPI impose no body cap, so ``.read()`` of a multi-GB part would
         buffer it all in RAM.
      2. **The extension**, before the body is read at all — a ``.png`` costs nothing.
      3. **Empty / oversized actual body** — a lying or absent declared size stops here.
      4. **The magic bytes** via the shipped ``validate_upload`` — ZIP EOCD +
         ``[Content_Types].xml`` + a per-extension part marker, so a renamed binary
         wearing a ``.docx`` name never reaches the parser.
      5. **The uncompressed-total cap** — see ``_TEMPLATE_MAX_UNCOMPRESSED_BYTES``.
         ⚠ This one is NOT inherited: gates 1-4 come from the shipped doors and do NOT
         cover a zip bomb, so they must not be presented as though they did. Capping it
         here does NOT close it on ``POST /{id}/template`` or on the q5r read door — the
         exposure is inherited, flagged, and deliberately not widened. It caps the
         DECLARED uncompressed total; a central directory that UNDER-declares its sizes
         would still get past it, and closing that needs a bounded read inside the
         shipped parser, which is out of this door's scope.

    WHY THE ORDER IS THE HONESTY MECHANISM. ``parse_docx_template_variables`` returns
    ``None`` for TWO different facts — *not a zip / corrupt / not a docx* (:390-391) and
    *a real docx carrying no tokens* (:407-408). Here the bytes come straight off a
    user's disk, so the ambiguity is live. With gate 4 ahead of the parse, a document
    that never opened is a **422 refusal**, and ``read="ok"`` with ``[]`` can only ever
    mean *we opened it and it carries no fill-in fields*. Those two facts may never merge
    (``TemplateAttachSection.tsx:130-143`` carries the same warning on the client).

    ⚠ ``read="unreadable"`` is UNREACHABLE on this route — the same idiom
    ``TemplatePlaceholdersResponse`` already uses for ``"not_requested"``. A document that
    cannot be opened is a refusal, not a degraded read. The field is kept for shape parity
    with the bound-template door so the client derives its arms from ONE wire shape.

    The response echoes NOTHING from the upload — no filename, no extension, no size —
    which is why the sibling's WR-05 ``safe_name`` sanitisation is not carried across.
    """
    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _TEMPLATE_MIME_BY_EXT:
        raise HTTPException(
            422,
            "A workflow template must be a .docx, .pptx or .xlsx document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422

    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            uncompressed = sum(zi.file_size for zi in zf.infolist())
    except Exception:  # noqa: BLE001 — gate 4 already proved it is a container
        raise HTTPException(422, "File is not a valid Office document (its archive could not be read).")
    if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES:
        raise HTTPException(
            422,
            "This document expands to more than "
            f"{_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB when opened and "
            "was not read.",
        )

    try:
        # CLAUDE.md / D-v2.5-01 — the parse is sync CPU work (zip inflate + regex over
        # stripped XML). Bounded by the gates above, but it is user-triggerable, so it
        # goes off the event loop exactly as the sibling wraps its Storage call (:1723).
        parsed = await run_in_threadpool(parse_docx_template_variables, raw)
    except Exception:
        # Clean relay, never a traceback (the sibling's :1729-1736 posture).
        logger.warning("Stateless template placeholder read failed (relaying clean error)", exc_info=True)
        raise HTTPException(422, "The document could not be read.")

    # ``parsed is None`` HERE — past gate 4 — is the honest empty state, not a failure.
    # The assembly is the SHARED one so this door and the bound-template door can never
    # show two different field lists for the same document.
    return TemplatePlaceholdersResponse(
        read="ok", placeholders=placeholder_names_from_parsed(parsed)
    )


async def upload_workflow_template(
    definition_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    # The per-request user-JWT client (ANON key + Bearer), NOT the service role. The
    # ``workspace_storage_insert_own`` policy (migration 054:91) requires the first path
    # segment to equal ``auth.uid()``, so Storage RLS is a SECOND, database-enforced
    # boundary underneath the owner-gate below — a service-role client would bypass it.
    supabase: Client = Depends(get_user_supabase_client),
) -> TemplateAssetRef:
    """Upload a template and store it durably against a workflow the caller OWNS.

    The order of the gates is load-bearing and each one is a decision:

      1. **Owner-gate first** — ``_owned_slug_or_404`` is the SAME owner-scoped
         ``created_by`` WHERE the delete/preview routes use, and its 404 is deliberately
         indistinguishable from not-found: a 403 would confirm that a workflow exists
         (no existence oracle). The workflow cluster reads through a service-role pool
         which bypasses RLS, so this WHERE is the route's authorization boundary.
      2. **The DECLARED part size, before the body is materialised** (workspace.py:250,
         the WR-04 fix) — uvicorn/FastAPI impose no body cap, so ``.read()`` of a
         multi-GB part would buffer it all in RAM.
      3. **The extension**, before the body is read at all — a ``.png`` costs nothing.
      4. **The magic bytes** via the shipped ``validate_upload`` — a renamed binary
         wearing a ``.docx`` name never reaches Storage.

    Nothing is persisted on any refusal: the single write is the LAST statement before
    the return. The blocking supabase-py upload is ``run_in_threadpool``-wrapped
    (CLAUDE.md / D-v2.5-01).
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _TEMPLATE_MIME_BY_EXT:
        raise HTTPException(
            422,
            "A workflow template must be a .docx, .pptx or .xlsx document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422

    # WR-05 (100-REVIEW) sanitisation, same shape as workspace.py:265 — ordinary names
    # ("Q3 Report (final).docx", "P&L 2026.xlsx") must not 422 at a user who never typed
    # a path, while '/' and '..' are stripped so the object can only ever land under the
    # user-keyed prefix built below.
    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
    mime = _TEMPLATE_MIME_BY_EXT[ext]
    # The layout the seeded library fixtures already use and Branch 1 already reads
    # (RESEARCH Q1): {user_id}/_library/{workflow}/{uuid8}-{name}. The uuid8 makes a
    # re-upload of the same filename a NEW object rather than an overwrite, so a draft
    # still pointing at the old asset_id keeps rendering.
    asset_id = f"{user_id}/_library/{definition_id}/{uuid4().hex[:8]}-{safe_name}"
    try:
        await run_in_threadpool(
            supabase.storage.from_(BUCKET_NAME).upload,
            asset_id,
            raw,
            {"content-type": mime, "upsert": "true"},
        )
    except Exception:
        # Never surface a raw storage traceback (the D-05 clean-relay posture).
        logger.warning(
            "Workflow template upload failed for definition=%s (relaying clean error)",
            definition_id,
            exc_info=True,
        )
        raise HTTPException(502, "The template could not be stored. Please try again.")

    return TemplateAssetRef(asset_id=asset_id, filename=safe_name, mime=mime)


async def get_workflow_template_placeholders(
    definition_id: UUID,
    asset_id: str = Query(..., max_length=512),
    current_user: dict = Depends(get_current_user),
    # The per-request user-JWT client, NOT the service role — see gate 3 below.
    supabase: Client = Depends(get_user_supabase_client),
) -> TemplatePlaceholdersResponse:
    """Read the fill-in fields of a template the caller OWNS (quick task 260814-q5r).

    WHY THIS ROUTE EXISTS AT ALL, rather than a widened ``?template_asset_id=`` on
    ``GET /workflows/grounding-bundle``. That parameter is typed ``UUID | None``, while
    this feature's asset ids are Storage PATHS (``{user_id}/_library/{definition_id}/…``)
    — so passing a real one is a **422 before the handler runs**, measured. The seam is
    not merely unwired, it is unwirable as typed. And widening it would be worse than
    useless: ``resolve_template_source`` Branch 1 does not scope by ``user_id`` at all,
    and that route injects the **service-role** client, so the ``UUID`` coercion is
    today's ONLY thing standing between a caller and any object in the bucket. Relaxing
    an accidental guard into a hand-written one on a service-role Storage read is the
    exact shape of a prior credential-exposure defect in this codebase. Two further
    reasons: the palette route is ``require_canvas()``-gated, so placeholders would be
    invisible on the Spine view (the surface most authors are on), and it would refetch
    the whole palette — folder tree, skill registry, tool list — to read one document.

    ⚠ **The asset is NOT required to be bound in the persisted definition, and that is a
    decision, not an oversight.** The Builder writes a freshly-uploaded descriptor into
    its store one statement before ``saveNow()``; requiring the binding would make this
    fetch race that round trip and answer about the OLD template, or about none.
    Ownership is proved by the gates below, never by the binding.

    THE GATES, in order, each one load-bearing:

      1. **Owner-gate on the definition** — ``_owned_slug_or_404``, the SAME owner-scoped
         ``created_by`` WHERE the upload/delete/preview routes use. Its 404 is deliberately
         indistinguishable from not-found: a 403 would confirm a workflow exists.
      2. **Owner-prefix on the asset id** — it must start with ``{user_id}/``. The pool is
         service-role and bypasses RLS, and gate 1 proves nothing about an asset id that
         arrived in the query string, so without this a caller could pass their OWN
         definition id and SOMEONE ELSE'S asset path.
      3. **No ``..`` segment.** This is NOT belt-and-braces. ``workspace_storage_select_own``
         (``supabase/migrations/054_workspace_files.sql:83-89``) keys on
         ``(storage.foldername(name))[1]`` — the FIRST path segment — so
         ``{uid}/../someone-else/x.docx`` satisfies gate 2 AND passes the database policy.
         The traversal check is the only thing that stops it.

    Both refusals raise the SAME 404 wording as a missing workflow — no existence oracle
    for objects either.

    The Storage read goes through the user-JWT client so ``workspace_storage_select_own``
    is a second, database-enforced boundary underneath gate 2, exactly as the sibling
    upload door documents for its write. A service-role client would silently remove it.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if not asset_id.startswith(f"{user_id}/") or ".." in asset_id.split("/"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="template not found")

    placeholders, read = await grounding.resolve_template_placeholders(
        supabase=supabase,
        pool=pool,
        user_id=str(user_id),
        template_asset_id=asset_id,
        template_placeholders=None,
    )
    # ``read`` can only be "ok" or "unreadable" here — "not_requested" is unreachable
    # because an ``asset_id`` is always supplied (it is a required query param).
    return TemplatePlaceholdersResponse(read=read, placeholders=placeholders)
