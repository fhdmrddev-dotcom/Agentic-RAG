import hashlib
import io
from uuid import uuid4

from docx import Document as DocxDocument
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status
from pypdf import PdfReader
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document import DocumentMoveRequest, DocumentResponse
from app.models.user_settings import load_app_settings
from app.services.embedding_service import chunk_text, embed_chunks, extract_metadata

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/html",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def extract_text(raw: bytes, mime_type: str) -> str:
    if mime_type == "application/pdf":
        reader = PdfReader(io.BytesIO(raw))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        doc = DocxDocument(io.BytesIO(raw))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
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

    # Some browsers send .md files as text/plain — treat by extension
    if mime_type == "text/plain" and (file.filename or "").endswith(".md"):
        mime_type = "text/markdown"

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

    # Validate folder_id if provided (per DOC-01)
    if folder_id:
        folder_check = (
            supabase.table("folders")
            .select("id")
            .eq("id", folder_id)
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found")

    content_hash = hashlib.sha256(raw).hexdigest()

    # Case 1: exact duplicate already completed — skip re-ingestion
    existing = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )
    if existing.data:
        response.status_code = status.HTTP_200_OK
        return existing.data[0]

    # Case 2: same filename, different content → delete old and re-ingest
    stale = (
        supabase.table("documents")
        .select("id, file_path")
        .eq("user_id", current_user["id"])
        .eq("filename", file.filename)
        .neq("content_hash", content_hash)
        .limit(1)
        .execute()
    )
    if stale.data:
        try:
            supabase.storage.from_("documents").remove([stale.data[0]["file_path"]])
        except Exception:
            pass
        supabase.table("documents").delete().eq("id", stale.data[0]["id"]).execute()

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
    result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


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
