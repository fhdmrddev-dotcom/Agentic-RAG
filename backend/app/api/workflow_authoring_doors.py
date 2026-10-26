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

Phase 291 (AUTH-02, plan 291-01) adds two handlers here, registered the same way:
``read_describe_file`` (``POST /workflows/describe/read`` — stateless, the 193.1 shape) and
``upload_workflow_reference`` (``POST /workflows/{definition_id}/reference`` — the template
door's gates). It widens ``upload_workflow_template`` (a ``.pdf``; Word ``anchors`` → the
server-made fillable copy) and ``get_workflow_template_placeholders`` (one ``.pdf`` branch).
Every file read goes through ``app.services.describe_files``. The 286 pins moved by a written
re-baseline (``test_286_workflows_seam_pins.py``).
"""
from __future__ import annotations

import functools
import io
import json
import logging
import re
import zipfile
from typing import Annotated, Literal
from uuid import UUID, uuid4

import anyio.from_thread
from fastapi import Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import (
    BaseModel,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
    model_validator,
)
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.api.workflow_wire import (
    DescribeReadResponse,
    ReferenceAssetRef,
    TemplateAssetRef,
    TemplatePlaceholdersResponse,
    WordAnchorIn,
    _DESCRIBE_MIME_BY_EXT,
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
from app.models.user_settings import load_user_settings
from app.services import describe_files, workflow_authoring
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


# ── Phase 291-02 (AUTH-02) — the describe door's files, as the generate body carries them ────
#
# UNTRUSTED, every byte: these are client-held READ RESULTS from ``/describe/read`` (Pitfall 11 —
# the bytes are not re-read at generate time). The server re-caps each text and fences it as
# data (``describe_draft_guards``); nothing here can grant a tool, a connection or an action.
# ``_GENERATE_TEXT_MAX`` bounds the body (T-291-14); the per-model re-cap is far below it.
_GENERATE_TEXT_MAX = 250_000
# 291-06 (CR-02): the key rule is split. ``{ } < >`` and control characters are refused on
# EVERY arm. ``%`` is refused unless the arm is ``form_fields``: a fillable PDF's field name is
# a pypdf dictionary key at fill time (render_template.fill_acroform) and never a Jinja token,
# so "Rate %" is a real PDF name; on a Word arm the key IS template syntax.
_FIELD_KEY_FORBIDDEN = re.compile(r"[\x00-\x1f\x7f{}<>]")
_FIELD_KEY_JINJA = re.compile(r"%")
# 291-06 (CR-02): the raised caps (1000 fields x 500 options x 200 chars) would otherwise
# allow a ~100 MB body; this aggregate bounds it (T-291-14). The prompt shows a bounded option
# list per field (describe_draft_guards.PROMPT_ENUM_SHOWN); the inputs keep every option.
_FORM_OPTIONS_TOTAL_MAX = 20_000


class DescribeFormFieldIn(BaseModel):
    model_config = {"extra": "forbid"}

    key: str = Field(min_length=1, max_length=200)
    label: str = Field("", max_length=200)
    type: Literal["text", "number", "date", "enum"]
    enum_options: list[Annotated[str, StringConstraints(max_length=200)]] = Field(
        default_factory=list, max_length=500
    )
    origin: Literal["exact", "ai_proposed"]

    @field_validator("key")
    @classmethod
    def _key_is_not_template_syntax(cls, value: str) -> str:
        if _FIELD_KEY_FORBIDDEN.search(value):
            raise ValueError("a field name may not contain control characters or { } < >")
        return value


# ⚠ No docstring on this class or the one above: it would become an OpenAPI description and
# move three pinned fixtures (test_286_workflows_seam_pins, the public OpenAPI snapshots).
class DescribeFormIn(BaseModel):
    model_config = {"extra": "forbid"}

    filename: str = Field(max_length=255)
    arm: Literal[
        "template_fields",
        "form_fields",
        "suggested_fields",
        "blanks",
        "none",
        "not_word",
        "scan_unreadable",
        "copy_refused",
    ]
    fields: list[DescribeFormFieldIn] = Field(default_factory=list, max_length=1000)
    text: str = Field("", max_length=_GENERATE_TEXT_MAX)

    @model_validator(mode="after")
    def _arm_aware_keys_and_bounded_options(self) -> "DescribeFormIn":
        if self.arm != "form_fields" and any(_FIELD_KEY_JINJA.search(f.key) for f in self.fields):
            raise ValueError("a field name may not contain % unless the form is a fillable PDF")
        if sum(len(f.enum_options) for f in self.fields) > _FORM_OPTIONS_TOTAL_MAX:
            raise ValueError(
                f"a form may carry at most {_FORM_OPTIONS_TOTAL_MAX} options across its fields"
            )
        return self


class DescribeReferenceIn(BaseModel):
    model_config = {"extra": "forbid"}

    filename: str = Field(max_length=255)
    text: str = Field(max_length=_GENERATE_TEXT_MAX)


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
    # Phase 291-02 (D-03 / D-05) — the attached form and up to five references. Both absent is
    # today's request exactly; ``references=[]`` stays ``[]`` (absent and empty never collapse).
    form: DescribeFormIn | None = None
    references: list[DescribeReferenceIn] | None = Field(None, max_length=5)


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
        # ⚠ FORWARDED VERBATIM too: None stays None and [] stays [].
        form=body.form.model_dump() if body.form is not None else None,
        references=[r.model_dump() for r in body.references] if body.references is not None else None,
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


# ── Phase 291 (AUTH-02, plan 291-01) — the describe door's file read ──────────

#: A form may be any describe type; a reference is something to READ, so the slide and sheet
#: formats (no text model for them here) are refused at the door rather than read as empty.
_DESCRIBE_FORM_EXTS = frozenset(_DESCRIBE_MIME_BY_EXT)
_DESCRIBE_REFERENCE_EXTS = frozenset({".pdf", ".docx", ".txt", ".md"})
#: The zip-bomb cap applies to OOXML containers ONLY: a PDF or a text file is not a zip, and
#: opening one as a zip would refuse every one of them.
_OOXML_EXTS = frozenset({".docx", ".pptx", ".xlsx"})
#: Ticked Word blanks accepted per bind (a form with more blanks than this is not a form).
_MAX_WORD_ANCHORS = 200


def _propose_from_worker_thread(text: str, candidates: list[dict], *, user_id: str) -> list[dict]:
    """The read leaf runs in a worker thread (``run_in_threadpool``); the proposal is an async
    model call. ``anyio.from_thread.run`` schedules it on the request's own event loop, so the
    async provider clients are never driven from a second loop."""

    async def _call() -> list[dict]:
        return await describe_files.propose_fields_via_model(
            text, candidates, user_id=user_id, settings=settings
        )

    return anyio.from_thread.run(_call)


async def read_describe_file(
    file: UploadFile = File(...),
    role: Literal["form", "reference"] = Form("form"),
    current_user: dict = Depends(get_current_user),
) -> DescribeReadResponse:
    """Read ONE attached file before any draft exists, persisting nothing (D-04, D-06).

    The 193.1 shape, copied rather than shared (the sibling's body is AST-pinned):
    **no Supabase client, no pool, no workflow id and no Storage path** — the bytes arrive
    in the request and the answer leaves in the response, so the cross-tenant Storage-read
    class has nothing to attach to. ``test_291_describe_read_door.py`` sweeps this body.

    THE GATES, in the shipped order: declared size before ``.read()``; the extension
    (``role="reference"`` refuses ``.pptx``/``.xlsx``); empty / oversized body; the magic
    bytes via ``validate_upload`` (``%PDF-``, the OOXML container, text NUL-reject); and
    the uncompressed-total cap for OOXML ONLY. A parse failure past the gates is a 422
    *"The document could not be read."* — never the "none" arm (D-02's honesty ordering).

    The settings read is the global cached app-settings read, not a caller-supplied path.
    The echoed filename is the server-sanitised name.
    """
    if not isinstance(role, str):  # called directly, the Form default object arrives
        role = "form"
    if role not in ("form", "reference"):
        raise HTTPException(422, "A file is attached either as a form or as a reference.")

    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if role == "reference" and ext not in _DESCRIBE_REFERENCE_EXTS:
        raise HTTPException(
            422,
            "A reference must be a .pdf, .docx, .txt or .md document "
            f"(got {ext or 'a file with no extension'}).",
        )
    if ext not in _DESCRIBE_FORM_EXTS:
        raise HTTPException(
            422,
            "A form must be a .pdf, .docx, .pptx, .xlsx, .txt or .md document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / container / text gate -> 422

    if ext in _OOXML_EXTS:
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                uncompressed = sum(zi.file_size for zi in zf.infolist())
        except Exception:  # noqa: BLE001 — the container gate already proved it is a zip
            raise HTTPException(422, "File is not a valid Office document (its archive could not be read).")
        if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES:
            raise HTTPException(
                422,
                "This document expands to more than "
                f"{_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB when opened and "
                "was not read.",
            )

    # Echoed back for the "No fields found in …" / "Couldn't read this scan" sentences, so it
    # is the sanitised name: no path separators, no markup (T-291-06).
    shown_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
    shown_name = re.sub(r"\.{2,}", ".", shown_name).strip() or f"document{ext}"

    user_id = str(current_user["id"])
    app_settings = await run_in_threadpool(load_user_settings, user_id)
    propose = functools.partial(_propose_from_worker_thread, user_id=user_id)
    try:
        # Blocking parse + (for scans) the vision calls run off the loop (D-v2.5-01).
        result = await run_in_threadpool(describe_files.read_describe_file, raw, ext, shown_name, role, app_settings=app_settings, propose=propose)
    except Exception:
        logger.warning("Describe file read failed (relaying clean error)", exc_info=True)
        raise HTTPException(422, "The document could not be read.")
    return DescribeReadResponse(
        role=result.role,
        arm=result.arm,
        suggested_from=result.suggested_from,
        filename=result.filename,
        fields=result.fields,
        unplaced=result.unplaced,
        text=result.text,
        cut_short=result.cut_short,
        refused=result.refused,
    )


def _parse_word_anchors(payload: str) -> list[WordAnchorIn]:
    """The ticked Word blanks, validated; any malformed payload is one 422 in words."""
    try:
        data = json.loads(payload)
    except ValueError:
        raise HTTPException(422, "The blank placements could not be read.")
    if not isinstance(data, list) or len(data) > _MAX_WORD_ANCHORS:
        raise HTTPException(422, "The blank placements could not be read.")
    try:
        return [WordAnchorIn.model_validate(item) for item in data]
    except ValidationError:
        raise HTTPException(422, "The blank placements could not be read.")


async def upload_workflow_template(
    definition_id: UUID,
    file: UploadFile = File(...),
    # Phase 291 (D-26): the ticked Word blanks as a JSON list of ``WordAnchorIn``. Present →
    # the server writes a fillable COPY and stores THAT; absent → today's upload, unchanged.
    anchors: str | None = Form(None),
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

    Phase 291 (D-25 / D-26) widens it twice, and no further: a fillable ``.pdf`` binds
    as-is (its AcroForm field names ARE the placeholders), and a ``.docx`` sent with
    ``anchors`` binds as the server-made fillable COPY — ``describe_files.make_fillable_copy``
    writes ``{{ key.value }}`` at each ticked blank and proves each appears exactly once.
    The author's original bytes are never written anywhere. A refused copy, or one that
    placed nothing, is a 422 with the server's sentence; ``anchors`` on anything but a
    ``.docx`` is a 422.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _TEMPLATE_MIME_BY_EXT and ext != ".pdf":
        raise HTTPException(
            422,
            "A workflow template must be a .docx, .pptx, .xlsx or .pdf document "
            f"(got {ext or 'a file with no extension'}).",
        )
    word_anchors = None
    if isinstance(anchors, str) and anchors.strip():  # a direct call passes the Form default
        if ext != ".docx":
            raise HTTPException(422, "Blank placements can only be made in a Word (.docx) document.")
        word_anchors = _parse_word_anchors(anchors)

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422

    unplaced: list[str] = []  # 296-06 (291-IN-03)
    if word_anchors is not None:
        # The copy maker opens the container, so the zip-bomb cap applies here too.
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                uncompressed = sum(zi.file_size for zi in zf.infolist())
        except Exception:  # noqa: BLE001
            raise HTTPException(422, "File is not a valid Office document (its archive could not be read).")
        if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES:
            raise HTTPException(
                422,
                "This document expands to more than "
                f"{_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB when opened and "
                "was not read.",
            )
        made = await run_in_threadpool(describe_files.make_fillable_copy, raw, [a.model_dump() for a in word_anchors])
        if made.refused:
            raise HTTPException(422, made.refused)
        if not made.placed or made.copy is None:
            raise HTTPException(
                422,
                " ".join(
                    ["None of the ticked blanks could be placed, so no fillable copy was made."]
                    + [sentence for _, sentence in made.unplaced]
                ),
            )
        raw = made.copy  # the COPY is stored; the original is never written
        unplaced = [sentence for _, sentence in made.unplaced]  # 296-06 (291-IN-03)

    # WR-05 (100-REVIEW) sanitisation, same shape as workspace.py:265 — ordinary names
    # ("Q3 Report (final).docx", "P&L 2026.xlsx") must not 422 at a user who never typed
    # a path, while '/' and '..' are stripped so the object can only ever land under the
    # user-keyed prefix built below.
    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
    mime = _DESCRIBE_MIME_BY_EXT[ext]
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

    return TemplateAssetRef(
        asset_id=asset_id, filename=safe_name, mime=mime, unplaced_sentences=unplaced
    )


async def upload_workflow_reference(
    definition_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    # The per-request user-JWT client, NOT the service role: Storage RLS
    # (``workspace_storage_insert_own``) is the second boundary under the owner-gate.
    supabase: Client = Depends(get_user_supabase_client),
) -> ReferenceAssetRef:
    """Store a reference document with a workflow the caller OWNS (Phase 291, D-05).

    The template door's gates, in its order: owner-gate first (404 on non-owner, no
    existence oracle), declared size, extension (``.pdf .docx .txt .md``), empty /
    oversized body, magic bytes, and the zip-bomb cap for ``.docx``. The object lands at
    ``{user_id}/_library/{definition_id}/{uuid8}-{safe_name}``, beside the template, and the
    returned descriptor is written into ``definition.assets[]`` by the Builder's one draft
    save — this route writes no row. References are NOT ingested into the Library (D-06).
    The 1 + 5 limit (D-03) is counted by the describe door; this door stores one file.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _DESCRIBE_REFERENCE_EXTS:
        raise HTTPException(
            422,
            "A reference must be a .pdf, .docx, .txt or .md document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / container / text gate -> 422

    if ext in _OOXML_EXTS:
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                uncompressed = sum(zi.file_size for zi in zf.infolist())
        except Exception:  # noqa: BLE001
            raise HTTPException(422, "File is not a valid Office document (its archive could not be read).")
        if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES:
            raise HTTPException(
                422,
                "This document expands to more than "
                f"{_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB when opened and "
                "was not read.",
            )

    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"reference{ext}"
    mime = _DESCRIBE_MIME_BY_EXT[ext]
    asset_id = f"{user_id}/_library/{definition_id}/{uuid4().hex[:8]}-{safe_name}"
    try:
        await run_in_threadpool(
            supabase.storage.from_(BUCKET_NAME).upload,
            asset_id,
            raw,
            {"content-type": mime, "upsert": "true"},
        )
    except Exception:
        logger.warning(
            "Workflow reference upload failed for definition=%s (relaying clean error)",
            definition_id,
            exc_info=True,
        )
        raise HTTPException(502, "The reference could not be stored. Please try again.")

    return ReferenceAssetRef(asset_id=asset_id, filename=safe_name, mime=mime)


async def _pdf_template_placeholders(*, supabase, pool, user_id: str, asset_id: str) -> tuple[list[str], str]:
    """A bound fillable PDF's field names, through the ONE AcroForm reader, in document
    order. The same three-state honesty as ``grounding.resolve_template_placeholders``:
    no bytes (or bytes that are not a PDF) is ``unreadable``; an opened PDF with no fields
    is ``ok`` + ``[]``."""
    from app.models.harness import AssetRef  # function-local (Pitfall 4)
    from app.services.template_asset_service import resolve_template_source

    try:
        resolved = await resolve_template_source(
            pool=pool,
            supabase=supabase,
            thread_id="",  # library path (Branch 1) ignores thread_id
            user_id=user_id,
            asset_ref=AssetRef(asset_id=asset_id, filename=asset_id, kind="template", mime="application/pdf"),
        )
        data = resolved.get("bytes")
    except Exception:  # noqa: BLE001 — a miss is unreadable, never a crash
        logger.warning("Bound PDF template read failed; reporting unreadable", exc_info=True)
        return [], "unreadable"
    if not data or not await run_in_threadpool(describe_files.pdf_opens, data):
        return [], "unreadable"
    oracle = await run_in_threadpool(describe_files.acroform_oracle, data)
    return list((oracle or {}).get("scalars") or []), "ok"


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

    if asset_id.lower().endswith(".pdf"):  # Phase 291 (D-25): a fillable PDF's own field names
        placeholders, read = await _pdf_template_placeholders(
            supabase=supabase, pool=pool, user_id=str(user_id), asset_id=asset_id
        )
        return TemplatePlaceholdersResponse(read=read, placeholders=placeholders)

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
