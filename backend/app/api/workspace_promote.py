"""Save a thread attachment to the Library — Phase 274 (ATT-03 / D-09..D-14, D-22, D-27, D-28).

Promotion is the ONE deliberate act that carries a file from a conversation into the Library. A chat
attachment lives in `workspace_files` for as long as its thread does (ATT-01); this door copies it,
on request, into a folder the person picks — through the Library's own minter, refusals, dedup and
versioning, never a second ingest path.

⭐ **Deliberately its own module, never `app/api/workspace.py`.** That module carries a source fence
(`test_244_cloud_attach_is_thread_scoped.py`) forbidding any reach to the minter — that absence IS
the structural guarantee *"the chat door cannot write the Library"*. This module is the one place
the reach is allowed, and `test_274_minter_inventory.py` pins it as the sixth and last minter caller.
It also keeps `workspace.py`, `documents.py` and `ingest_splice.py` (all G-5 FIRING) untouched (D-19).

**The read order (D-12, the BUG-260903-02 shape).** Thread ownership first (404), then the
attachment row and its bytes through the person's own user-JWT connection (RLS), and only then a
mint. No service-role client is created anywhere in this module: the bytes come from the RLS read,
and the service role appears only inside the shared `_enqueue_or_splice`, after the document exists.

**The rules the minter already decides, and this door does not re-decide:**
- *Rights* — whoever can upload into the folder through the Library can promote into it. The
  minter's `404 Folder not found` / `403 Cannot upload to a folder you do not own` reach the caller
  verbatim. ~~This module never reads `folders` (D-12).~~ ⚠ **AMENDED by D-29 (274 review CR-01):**
  the minter's folder check compares `user_id` only, and this door stamps the ACTIVE org on the
  document. So the module reads the folder ONCE, for its `org_id`, through the person's own
  user-JWT client, and refuses a folder in another org with its own 403 (`REFUSE_OTHER_ORG`)
  before anything is hashed or minted. Ownership stays the minter's answer.
- *Duplicates* (D-13) — the same bytes already completed in this person's Library (in this org) are
  LINKED, not copied: 200 `already`, naming the EXISTING copy's folder even when it differs from the
  one picked. ⚠ 274 review CR-02: so are bytes whose copy is still INDEXING (`find_existing_copy`,
  asked by this door before the minter) — the minter's completed-only dedup used to retire it.
- *Versions* (D-14) — a same-named file in the CHOSEN folder becomes the next version. The minter is
  called with `version_scope="folder"`, so a same-named file in another folder is never retired.

**The parameters that matter** — `version_scope="folder"`, `org_id=<active org>`,
`on_conflict="link"` (a double-click race collapses into a duplicate, T-274-16). ⚠ This door is
deliberately ORG-scoped, unlike `/documents/upload`, which passes no `org_id` (SEED-313, accepted).

The preview (`preview_promotion`) asks the minter's two questions read-only. It DUPLICATES the two
predicates rather than sharing a helper, because `ingest_splice.py` stays byte-unchanged;
`test_274_promote_preview_parity.py` is what holds the copies equal.
"""
from __future__ import annotations

import hashlib
import logging
import re
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from supabase import Client

# D-22: the Library door's own lists, imported — never a second allow-list here.
from app.api.documents import ALLOWED_MIME_TYPES, _EXT_MIME_OVERRIDES
# Reused, never duplicated: the thread-ownership 404 and the expiry gate's clock.
from app.api.workspace import _now_iso, _verify_thread_ownership
from app.db.workspace import get_file_by_id
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_pg_connection,
    get_user_supabase_client,
)
from app.models.workspace_promote import (
    AttachmentLibraryState,
    DuplicateOf,
    LibraryLink,
    LibraryLinkInfo,
    LibraryLinksResponse,
    PromotePreview,
    PromoteRequest,
    PromoteResult,
)
from app.services import ingest_splice
from app.services.audit_service import write_audit_entry
# Imported BY NAME, never copied: the one hand-off from a minted document to the durable queue
# (storage PUT + `ingestion_jobs` row, with the never-strand fallback).
from app.services.sources.import_service import _enqueue_or_splice
from app.services.workspace_service import WorkspaceError, _get_file_content
from app.utils.db import aexec

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/threads/{thread_id}/workspace",
    tags=["workspace"],
)

#: The only `kind` a person can save (D-09). `agent` rows are the agent's own deliverables.
_ATTACHMENT_KIND = "template_input"

#: D-29 — this door's own folder refusal, in the minter's sentence shape. A folder the person
#: owns in ANOTHER org would otherwise pass the minter's owner-only check and receive a document
#: stamped with the active org (and an org-shared one would show it to the wrong org).
REFUSE_OTHER_ORG = "Cannot upload to a folder in another organization"

#: The prefix `workspace.py` stamps on a stored upload: `/{uuid4().hex[:8]}-{safe_name}`.
#: ⛔ Lowercase only, exactly eight — the stamp is `uuid4().hex`, which never emits uppercase, so an
#: uppercase run is a person's own name. Mirrored lockstep in `frontend/src/lib/attachmentLifetime.ts`.
WORKSPACE_UPLOAD_PREFIX = re.compile(r"^[0-9a-f]{8}-")


def library_filename(path: str) -> str:
    """The name the Library document gets: the basename, with the stored prefix removed (D-27).

    Without this, D-14's same-name versioning could never match a person's real file. Never
    returns an empty string: a name that is ONLY the prefix keeps it.
    """
    base = (path or "").rsplit("/", 1)[-1]
    stripped = WORKSPACE_UPLOAD_PREFIX.sub("", base, count=1)
    return stripped or base


def _ext(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def library_mime(filename: str, row_mime: str | None) -> str:
    """The MIME the Library mints with: its own extension table FIRST, then the row's (D-27).

    The workspace row's MIME is the PLATFORM's `mimetypes` guess, and it differs by box (`.csv`
    reads `application/vnd.ms-excel` on Windows, `.webp` reads `application/octet-stream`).
    """
    return _EXT_MIME_OVERRIDES.get(_ext(filename)) or row_mime or "application/octet-stream"


def promotability(filename: str, row_mime: str | None) -> tuple[bool, str | None]:
    """Can the Library take this file? `(True, None)`, or `(False, <the Library's own sentence>)`.

    D-22: gated on the imported `ALLOWED_MIME_TYPES`, after `library_mime`, and refused in the
    sentence shape `/documents/upload` uses — derived from the set, never re-typed.
    """
    mime = library_mime(filename, row_mime)
    if mime in ALLOWED_MIME_TYPES:
        return True, None
    return False, (
        f"Unsupported file type: {mime}. "
        f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
    )


async def find_existing_copy(
    supabase: Client, *, content_hash: str, user_id: str, org_id: str
) -> dict | None:
    """The person's copy of these bytes already in the active org's Library, or None (D-13).

    Two questions, in order:
      1. the minter's own dedup — `status='completed'` (the completed-hash index's predicate);
      2. ⚠ 274 review CR-02 — any NON-FAILED copy that is still the latest version
         (`pending | processing | paused`). The minter's dedup misses it, so its folder-scoped
         version step RETIRED that first copy, hit `documents_dedup_idx`'s 23505, and the `link`
         arm returned the retired row as success: the only copy left the Library and search.
         Asking here, before the minter runs, links it instead. `ingest_splice.py` (FIRING) stays
         byte-unchanged; its own race for `/documents/upload` is logged separately.
    Shared by the preview and the confirm, so the two can never disagree about it.
    """
    completed = await aexec(
        supabase.table("documents")
        .select("*")
        .eq("user_id", user_id)
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .eq("org_id", org_id)
        .limit(1)
    )
    if completed.data:
        return completed.data[0]
    live = await aexec(
        supabase.table("documents")
        .select("*")
        .eq("user_id", user_id)
        .eq("content_hash", content_hash)
        .neq("status", "failed")
        .eq("is_latest", True)
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .limit(1)
    )
    return live.data[0] if live.data else None


async def mint_or_link(
    supabase: Client,
    *,
    raw: bytes,
    filename: str,
    mime_type: str,
    user_id: str,
    org_id: str,
    folder_id: str,
) -> ingest_splice.MintResult:
    """What confirming does: link an existing copy (CR-02), or mint through the shipped minter.

    The parameters that matter stay here, once: `version_scope="folder"`, the active org, and
    `on_conflict="link"` (a double-click race collapses into a duplicate, T-274-16).
    """
    existing = await find_existing_copy(
        supabase, content_hash=hashlib.sha256(raw).hexdigest(), user_id=user_id, org_id=org_id,
    )
    if existing is not None:
        return ingest_splice.MintResult(
            document=existing,
            is_duplicate=True,
            storage_path=existing.get("file_path", ""),
            version_number=existing.get("version_number", 1),
        )
    return await ingest_splice.async_mint_document_row(
        raw=raw,
        filename=filename,
        mime_type=mime_type,
        user_id=user_id,
        supabase=supabase,
        folder_id=folder_id,
        org_id=org_id,
        on_conflict="link",
        version_scope="folder",  # T-274-12: never retire a same-named file in another folder
    )


async def preview_promotion(
    supabase: Client,
    *,
    raw: bytes,
    filename: str,
    user_id: str,
    org_id: str,
    folder_id: str,
) -> PromotePreview:
    """What saving `raw` as `filename` into `folder_id` would do — without doing it (D-14).

    Mirrors what `mint_or_link` does on confirm, in its order:
      1. an existing copy — `find_existing_copy`, the SAME helper the confirm calls (the minter's
         completed dedup, then any non-failed latest copy, CR-02). A hit wins (D-13).
      2. folder-scoped version — `ingest_splice.mint_document_row`'s predicate: user_id + filename
         + org_id + folder_id, highest version + 1.

    ⛔ Read-only. ⛔ Never reads `folders` — whether the person may write there is the minter's
    answer on confirm (D-12), and a refusal surfaces then, verbatim (the org is the route's, D-29).
    """
    content_hash = hashlib.sha256(raw).hexdigest()

    existing = await find_existing_copy(supabase, content_hash=content_hash, user_id=user_id, org_id=org_id)
    if existing is not None:
        return PromotePreview(
            promotable=True,
            refusal=None,
            filename=filename,
            duplicate_of=DuplicateOf(
                document_id=str(existing["id"]),
                folder_id=str(existing["folder_id"]) if existing.get("folder_id") else None,
            ),
            next_version=existing.get("version_number", 1),
        )

    versions = await aexec(
        supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", user_id)
        .eq("filename", filename)
        .eq("org_id", org_id)
        .eq("folder_id", folder_id)
        .order("version_number", desc=True)
        .limit(1)
    )
    next_version = versions.data[0]["version_number"] + 1 if versions.data else 1
    return PromotePreview(
        promotable=True,
        refusal=None,
        filename=filename,
        duplicate_of=None,
        next_version=next_version,
    )


# ── the read: the person's own, live attachment, through RLS (D-09 / D-12) ─────────────────


def _not_found() -> HTTPException:
    # One sentence for every unreachable file — missing, another thread's, expired, agent-written
    # or malformed — so nothing about its existence leaks (D-062-12).
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")


async def _reachable_attachment(request: Request, current_user: dict, thread_id: str, file_id: str) -> tuple[UUID, dict]:
    """The attachment row, read on the person's own user-JWT connection, or `File not found`.

    ⚠ Call AFTER `_verify_thread_ownership` — a foreign thread must be `Thread not found` first.
    """
    try:
        fid = UUID(file_id)
    except ValueError:
        raise _not_found()

    async with get_user_pg_connection(request, current_user) as conn:
        row = await get_file_by_id(conn, fid)
    if (
        not row
        or str(row.get("thread_id")) != thread_id
        or row.get("is_expired")
        or row.get("kind") != _ATTACHMENT_KIND
    ):
        raise _not_found()
    return fid, row


async def _attachment_bytes(request: Request, current_user: dict, supabase: Client, row: dict) -> bytes:
    """The attachment's EXACT bytes (inline or bucket), read under RLS.

    ⛔ Never `/content`'s text decode — it turns a binary into UTF-8 and corrupts every docx/pdf.
    """
    async with get_user_pg_connection(request, current_user) as conn:
        try:
            return bytes(await _get_file_content(conn, supabase, row))
        except WorkspaceError:
            raise _not_found()


async def _refuse_folder_outside_org(supabase: Client, folder_id: str, active_org: str) -> None:
    """D-29 (amends D-12) — refuse a folder that belongs to another org, before any byte is read.

    Read through the person's own user-JWT client (RLS). A folder RLS does not return is left to
    the minter, whose `404 Folder not found` stays the answer; only a VISIBLE folder whose org
    differs from the active one is refused here.
    """
    found = await aexec(
        supabase.table("folders").select("id, org_id").eq("id", folder_id).maybe_single()
    )
    folder = found.data if found is not None else None
    if folder and folder.get("org_id") and str(folder["org_id"]) != str(active_org):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REFUSE_OTHER_ORG)


async def _existing_link(
    supabase: Client, thread_id: str, fid: UUID, picked_folder: str
) -> PromoteResult | None:
    """An attachment already promoted returns that link instead of minting again (T-274-16).

    Only a document the person can still SEE through RLS counts: a deleted or no-longer-visible
    document is no link, and the promote proceeds. Any error here (e.g. migration 203 not yet
    applied) is logged and read as "not linked" — never a failed promote.

    ⚠ 274 review WR-03: when the linked copy sits in a folder OTHER than `picked_folder`, the
    answer is `already` naming that folder — never the stored `saved`, which made the dialog
    close as if the file had just landed where the person pointed (D-13: stated, never hidden).
    """
    try:
        ws = await aexec(
            supabase.table("workspace_files")
            .select("library_document_id, library_link")
            .eq("id", str(fid))
            .eq("thread_id", thread_id)
            .maybe_single()
        )
        mark = ws.data if ws is not None else None
        if not mark or not mark.get("library_document_id"):
            return None
        found = await aexec(
            supabase.table("documents")
            .select("id, folder_id, status, filename, version_number")
            .eq("id", str(mark["library_document_id"]))
            .maybe_single()
        )
        doc = found.data if found is not None else None
        if not doc:
            return None
    except Exception as exc:  # noqa: BLE001 — a missing mark degrades to "not linked"
        logger.warning("Promote: could not read the Library mark of %s (%s); treating as unlinked", fid, exc)
        return None

    linked_folder = str(doc["folder_id"]) if doc.get("folder_id") else None
    elsewhere = linked_folder != str(picked_folder)
    outcome: LibraryLink = "already" if mark.get("library_link") == "already" or elsewhere else "saved"
    return PromoteResult(
        outcome=outcome,
        document_id=str(doc["id"]),
        folder_id=linked_folder,
        document_status=str(doc.get("status") or "pending"),
        filename=str(doc.get("filename") or ""),
        version_number=doc.get("version_number"),
    )


# ── the routes ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/files/{file_id}/promote",
    status_code=status.HTTP_201_CREATED,
    response_model=PromoteResult,
)
async def promote_attachment(
    thread_id: str,
    file_id: str,
    body: PromoteRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    active_org: str = Depends(get_active_org_id),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> PromoteResult:
    """Save ONE thread attachment into the chosen Library folder (ATT-03).

    201 `saved` — a new document was minted and handed to the ingest queue.
    200 `already` — the same bytes were already in the Library; linked, nothing copied. The
    `folder_id` is the EXISTING copy's (D-13). Also 200 when this attachment was promoted before.
    404 `Thread not found` / `File not found`; the minter's `Folder not found` (404) and
    `Cannot upload to a folder you do not own` (403) verbatim; 403 `Cannot upload to a folder in
    another organization` for a folder outside the active org (D-29); 422 for a type the Library
    refuses.

    The attachment itself stays in the thread, unchanged (D-11).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner
    fid, row = await _reachable_attachment(request, current_user, thread_id, file_id)
    await _refuse_folder_outside_org(supabase, str(body.folder_id), str(active_org))  # D-29

    picked = str(body.folder_id)
    linked = await _existing_link(supabase, thread_id, fid, picked)
    if linked is not None:
        response.status_code = status.HTTP_200_OK
        return linked

    filename = library_filename(row["path"])
    ok, refusal = promotability(filename, row.get("mime_type"))
    if not ok:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=refusal)
    mime_type = library_mime(filename, row.get("mime_type"))

    raw = await _attachment_bytes(request, current_user, supabase, row)

    # 274 review CR-02 — re-read the mark IMMEDIATELY before minting: the chip and the panel can
    # promote ONE attachment at once, and the other request may have stamped its link while this
    # one read the bytes. (`find_existing_copy` inside `mint_or_link` catches the window before
    # that stamp lands: the other request's fresh copy is non-failed and latest.)
    linked = await _existing_link(supabase, thread_id, fid, picked)
    if linked is not None:
        response.status_code = status.HTTP_200_OK
        return linked

    # ⛔ No folder OWNER pre-check: the minter's folder-owner refusal is the authority (D-12), and
    #    its HTTPException reaches the caller untouched. Only the ORG was checked above (D-29).
    mint = await mint_or_link(
        supabase,
        raw=raw,
        filename=filename,
        mime_type=mime_type,
        user_id=current_user["id"],
        org_id=str(active_org),
        folder_id=picked,
    )
    doc = dict(mint.document)
    outcome: LibraryLink = "already" if mint.is_duplicate else "saved"

    if not mint.is_duplicate:
        await _enqueue_or_splice(
            doc=doc,
            raw=raw,
            mime_type=mime_type,
            filename=filename,
            user_id=current_user["id"],
            active_org=str(active_org),
            storage_path=mint.storage_path,
            background_tasks=background_tasks,
        )

    # D-28 — the `In Library` mark, through the person's own client (`workspace_files_update_own`).
    # Best-effort: the document already exists, so a failed stamp is logged, never a failed promote.
    # CR-02: an `already` stamp never overwrites a mark that ALREADY names this document — a racing
    # promote of the same attachment minted it and owns the `saved` word.
    try:
        stamp = (
            supabase.table("workspace_files")
            .update({"library_document_id": doc["id"], "library_link": outcome})
            .eq("id", str(fid))
            .eq("thread_id", thread_id)
        )
        if mint.is_duplicate:
            stamp = stamp.or_(f"library_document_id.is.null,library_document_id.neq.{doc['id']}")
        await aexec(stamp)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Promote: Library mark stamp failed for workspace file %s -> document %s (%s)",
            fid, doc.get("id"), exc,
        )

    # T-274-17 — the existing `document.upload` action (a new action type hard-fails boot). The
    # user-JWT client, as `threads.py` does for its own audit rows: this door creates no
    # service-role client at all, and `audit_logs` accepts the person's own insert.
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.upload",
        metadata={
            "source": "thread_attachment",
            "workspace_file_id": str(fid),
            "thread_id": thread_id,
            "document_id": doc.get("id"),
            "filename": doc.get("filename") or filename,
            "folder_id": str(body.folder_id),
            "outcome": outcome,
        },
        supabase=supabase,
        org_id=str(active_org),
    )

    # Both arms set the status explicitly, as `/documents/upload` does (`documents.py:736`).
    response.status_code = status.HTTP_200_OK if mint.is_duplicate else status.HTTP_201_CREATED
    return PromoteResult(
        outcome=outcome,
        document_id=str(doc["id"]),
        folder_id=str(doc["folder_id"]) if doc.get("folder_id") else None,
        document_status=str(doc.get("status") or "pending"),
        filename=str(doc.get("filename") or filename),
        version_number=doc.get("version_number"),
    )


@router.get("/files/{file_id}/promote-preview", response_model=PromotePreview)
async def promote_preview(
    thread_id: str,
    file_id: str,
    request: Request,
    folder_id: UUID = Query(..., description="The Library folder the person is considering."),
    active_org: str = Depends(get_active_org_id),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> PromotePreview:
    """What saving this attachment into `folder_id` would do — refused, already there, or which
    version (D-14). Read-only and advisory: the POST's answer is the one rendered as a result.
    A folder outside the active org is the POST's own 403 here too (D-29)."""
    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner
    _fid, row = await _reachable_attachment(request, current_user, thread_id, file_id)
    await _refuse_folder_outside_org(supabase, str(folder_id), str(active_org))  # D-29

    filename = library_filename(row["path"])
    ok, refusal = promotability(filename, row.get("mime_type"))
    if not ok:
        # Refused before any byte is read or hashed (D-22).
        return PromotePreview(
            promotable=False, refusal=refusal, filename=filename, duplicate_of=None, next_version=None,
        )

    raw = await _attachment_bytes(request, current_user, supabase, row)
    return await preview_promotion(
        supabase,
        raw=raw,
        filename=filename,
        user_id=current_user["id"],
        org_id=str(active_org),
        folder_id=str(folder_id),
    )


_LINK_COLUMNS = "id, path, mime_type, kind, expires_at, library_document_id, library_link"
_BASE_COLUMNS = "id, path, mime_type, kind, expires_at"


def _live_attachments(supabase: Client, thread_id: str, columns: str):
    return (
        supabase.table("workspace_files")
        .select(columns)
        .eq("thread_id", thread_id)
        .eq("kind", _ATTACHMENT_KIND)
        .or_("expires_at.is.null,expires_at.gt." + _now_iso())
    )


@router.get("/library-links", response_model=LibraryLinksResponse)
async def list_library_links(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> LibraryLinksResponse:
    """Every live attachment of the thread: can it be saved, and its `In Library` mark — in ONE
    request (D-15). A mark is reported only for a document the person can still see (T-274-14).
    Without migration 203's columns every `link` is null — never a 500."""
    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner

    try:
        rows = (await aexec(_live_attachments(supabase, thread_id, _LINK_COLUMNS))).data or []
    except Exception as exc:  # noqa: BLE001 — migration 203 not applied yet
        logger.warning("library-links: Library mark columns unreadable for thread %s (%s); no links", thread_id, exc)
        rows = (await aexec(_live_attachments(supabase, thread_id, _BASE_COLUMNS))).data or []

    doc_ids = sorted({str(r["library_document_id"]) for r in rows if r.get("library_document_id")})
    visible: dict[str, dict] = {}
    if doc_ids:
        try:
            docs = await aexec(
                supabase.table("documents")
                .select("id, folder_id, status, filename")
                .in_("id", doc_ids)
            )
            visible = {str(d["id"]): d for d in (docs.data or [])}
        except Exception as exc:  # noqa: BLE001
            logger.warning("library-links: linked documents unreadable for thread %s (%s); no links", thread_id, exc)

    files: list[AttachmentLibraryState] = []
    for r in rows:
        filename = library_filename(r.get("path") or "")
        promotable, _refusal = promotability(filename, r.get("mime_type"))
        link = None
        doc = visible.get(str(r.get("library_document_id") or ""))
        if doc is not None:
            link = LibraryLinkInfo(
                document_id=str(doc["id"]),
                outcome="already" if r.get("library_link") == "already" else "saved",
                folder_id=str(doc["folder_id"]) if doc.get("folder_id") else None,
                document_status=str(doc.get("status") or "pending"),
                filename=str(doc.get("filename") or filename),
            )
        files.append(AttachmentLibraryState(workspace_file_id=str(r["id"]), promotable=promotable, link=link))
    return LibraryLinksResponse(files=files)
