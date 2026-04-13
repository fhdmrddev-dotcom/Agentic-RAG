import csv
import hashlib
import io
import zipfile
from uuid import uuid4

from docx import Document as DocxDocument
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status
from pypdf import PdfReader
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document import DocumentMoveRequest, DocumentResponse
from app.models.user_settings import load_app_settings
from app.services.embedding_service import chunk_text, embed_chunks, extract_metadata
from app.utils.folder_utils import get_globally_visible_folder_ids

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/html",
    "text/csv",
    "application/csv",
    "application/pdf",
    "application/epub+zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

# Extension → canonical MIME type for formats browsers misreport
_EXT_MIME_OVERRIDES: dict[str, str] = {
    ".md":   "text/markdown",
    ".csv":  "text/csv",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".epub": "application/epub+zip",
}


def extract_text(raw: bytes, mime_type: str) -> str:
    if mime_type == "application/pdf":
        reader = PdfReader(io.BytesIO(raw))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        doc = DocxDocument(io.BytesIO(raw))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    if mime_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        from pptx import Presentation  # noqa: PLC0415
        prs = Presentation(io.BytesIO(raw))
        lines: list[str] = []
        for slide_num, slide in enumerate(prs.slides, 1):
            slide_lines = [f"## Slide {slide_num}"]
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        slide_lines.append(text)
            if len(slide_lines) > 1:  # skip blank slides
                lines.append("\n".join(slide_lines))
        return "\n\n".join(lines)

    if mime_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ):
        from openpyxl import load_workbook  # noqa: PLC0415
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheets: list[str] = []
        for sheet in wb.worksheets:
            rows: list[str] = [f"## Sheet: {sheet.title}"]
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                if any(cells):
                    rows.append("\t".join(cells))
            if len(rows) > 1:
                sheets.append("\n".join(rows))
        return "\n\n".join(sheets)

    if mime_type in ("text/csv", "application/csv"):
        text = raw.decode("utf-8-sig")  # strip BOM if present
        reader = csv.reader(io.StringIO(text))
        return "\n".join("\t".join(row) for row in reader)

    if mime_type == "application/epub+zip":
        import ebooklib  # noqa: PLC0415
        from ebooklib import epub
        from html.parser import HTMLParser

        class _StripHTML(HTMLParser):
            def __init__(self) -> None:
                super().__init__()
                self._chunks: list[str] = []
            def handle_data(self, data: str) -> None:
                self._chunks.append(data)
            def get_text(self) -> str:
                return "".join(self._chunks)

        # ebooklib requires a file path — write to a temp file
        import tempfile, os  # noqa: PLC0415
        with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        try:
            book = epub.read_epub(tmp_path)
        finally:
            os.unlink(tmp_path)

        chapters: list[str] = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            parser = _StripHTML()
            parser.feed(item.get_content().decode("utf-8", errors="ignore"))
            text = parser.get_text().strip()
            if text:
                chapters.append(text)
        return "\n\n".join(chapters)

    # plain text, markdown, html — decode as UTF-8
    return raw.decode("utf-8")


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Normalize mime type (strip charset suffix)
    mime_type = (file.content_type or "").split(";")[0].strip()

    # Browsers / OS often misreport MIME types for these formats — normalise by extension
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if mime_type in ("text/plain", "application/octet-stream", "application/zip") and ext in _EXT_MIME_OVERRIDES:
        mime_type = _EXT_MIME_OVERRIDES[ext]

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type: {mime_type}. Allowed: PDF, DOCX, Markdown, plain text.",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty",
        )

    # Validate folder ownership: only the folder owner may upload into it
    if folder_id:
        folder_check = (
            supabase.table("folders")
            .select("id, user_id")
            .eq("id", folder_id)
            .maybe_single()
            .execute()
        )
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found")
        if folder_check.data["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot upload to a folder you do not own",
            )

    content_hash = hashlib.sha256(raw).hexdigest()

    # Case 1: exact duplicate already completed (is_latest=True) in the same folder — skip re-ingestion
    # Dedup only matches the current latest version; stale versions do not short-circuit upload.
    # Duplicate check is folder-scoped: same file in different folders creates separate entries.
    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .eq("is_latest", True)
    )
    if folder_id:
        dedup_query = dedup_query.eq("folder_id", folder_id)
    else:
        dedup_query = dedup_query.is_("folder_id", "null")
    existing = dedup_query.limit(1).execute()
    if existing.data:
        response.status_code = status.HTTP_200_OK
        return existing.data[0]

    # Case 2: same filename → create new version instead of deleting stale document.
    # Old files are retained in storage for future restore (Phase 29).
    existing_versions = (
        supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", current_user["id"])
        .eq("filename", file.filename)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if existing_versions.data:
        next_version = existing_versions.data[0]["version_number"] + 1
        # Retire all previous versions from retrieval (user-scoped, not folder-scoped)
        (
            supabase.table("documents")
            .update({"is_latest": False})
            .eq("user_id", current_user["id"])
            .eq("filename", file.filename)
            .execute()
        )
    else:
        next_version = 1

    try:
        text = extract_text(raw, mime_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from file: {e}",
        )

    document_id = str(uuid4())
    storage_path = f"{current_user['id']}/{document_id}/{file.filename}"

    doc_data = {
        "id": document_id,
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_path": storage_path,
        "file_size": len(raw),
        "mime_type": mime_type,
        "status": "pending",
        "content_hash": content_hash,
        "folder_id": folder_id,
        "version_number": next_version,
        "is_latest": True,
    }
    result = supabase.table("documents").insert(doc_data).execute()
    doc = result.data[0]

    try:
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=raw,
            file_options={"content-type": mime_type},
        )
    except Exception:
        pass  # Storage upload failure doesn't block ingestion

    background_tasks.add_task(ingest_document, document_id, text, current_user["id"], supabase)

    return doc


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Own documents — only show latest versions (VER-03)
    own_result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_latest", True)
        .execute()
    )
    own_docs = own_result.data or []

    # Documents in globally visible folders (not owned by current user)
    global_folder_ids = get_globally_visible_folder_ids(supabase, current_user["id"])
    global_docs = []
    if global_folder_ids:
        global_result = (
            supabase.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .eq("is_latest", True)
            .execute()
        )
        global_docs = global_result.data or []

    # Merge, deduplicate by id, sort by created_at desc
    seen: set[str] = set()
    merged: list[dict] = []
    for doc in own_docs + global_docs:
        if doc["id"] not in seen:
            seen.add(doc["id"])
            merged.append(doc)
    merged.sort(key=lambda d: d["created_at"], reverse=True)
    return merged


@router.get("/{document_id}/versions", response_model=list[DocumentResponse])
async def list_document_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return all versions of a document ordered by version_number descending."""
    # 1. Verify doc exists and user has access
    doc = (
        supabase.table("documents")
        .select("filename, user_id, folder_id")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    # 2. Fetch all sibling versions
    result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("filename", doc.data["filename"])
        .order("version_number", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document_version(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Restore a historical document version, making it the current latest."""
    # 1. Validate ownership
    doc = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    target = doc.data
    folder_id = target["folder_id"]
    # 2. Retire all siblings
    siblings_q = (
        supabase.table("documents")
        .update({"is_latest": False})
        .eq("user_id", current_user["id"])
        .eq("filename", target["filename"])
    )
    if folder_id is None:
        siblings_q = siblings_q.is_("folder_id", "null")
    else:
        siblings_q = siblings_q.eq("folder_id", folder_id)
    siblings_q.execute()
    # 3. Promote target
    result = (
        supabase.table("documents")
        .update({"is_latest": True})
        .eq("id", document_id)
        .execute()
    )
    return result.data[0]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    doc_resp = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        supabase.storage.from_("documents").remove([doc_resp.data["file_path"]])
    except Exception:
        pass

    supabase.table("documents").delete().eq("id", document_id).execute()


@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    body: DocumentMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Move a document to a different folder. folder_id=null moves to root."""
    # 1. Verify document ownership
    doc = (
        supabase.table("documents")
        .select("id")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Validate target folder accessibility (if not moving to root)
    if body.folder_id:
        folder = (
            supabase.table("folders")
            .select("id")
            .eq("id", str(body.folder_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")

    # 3. Perform move
    result = (
        supabase.table("documents")
        .update({"folder_id": str(body.folder_id) if body.folder_id else None})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data[0]


def ingest_document(document_id: str, text: str, user_id: str, supabase: Client) -> None:
    import logging, traceback
    log = logging.getLogger(__name__)
    try:
        supabase.table("documents").update({"status": "processing"}).eq("id", document_id).execute()

        chunks = chunk_text(text)
        if not chunks:
            supabase.table("documents").update({
                "status": "failed",
                "error_message": "No text content could be extracted from the file.",
            }).eq("id", document_id).execute()
            return

        app_settings = load_app_settings()
        embeddings = embed_chunks(chunks, model=app_settings.embedding_model or None)

        chunk_rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "content": chunk,
                "chunk_index": i,
                "embedding": embedding,
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        supabase.table("document_chunks").insert(chunk_rows).execute()

        # Extract metadata — best-effort, never blocks completion
        metadata = extract_metadata(text)
        metadata_dict = metadata.model_dump(exclude_none=True) if metadata else None
        # Normalize case-sensitive filter fields for consistent retrieval
        if metadata_dict:
            if metadata_dict.get("document_type"):
                metadata_dict["document_type"] = metadata_dict["document_type"].lower()
            if metadata_dict.get("language"):
                metadata_dict["language"] = metadata_dict["language"].lower()

        supabase.table("documents").update({
            "status": "completed",
            "chunk_count": len(chunks),
            "metadata": metadata_dict,
            "full_markdown": text,
        }).eq("id", document_id).execute()

    except Exception as e:
        log.error("ingest_document failed: %s\n%s", e, traceback.format_exc())
        supabase.table("documents").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", document_id).execute()
