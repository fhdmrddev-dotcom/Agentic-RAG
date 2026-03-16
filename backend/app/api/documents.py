import io
from uuid import uuid4

from docx import Document as DocxDocument
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pypdf import PdfReader
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document import DocumentResponse
from app.services.embedding_service import chunk_text, embed_chunks

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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
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


def ingest_document(document_id: str, text: str, user_id: str, supabase: Client) -> None:
    try:
        supabase.table("documents").update({"status": "processing"}).eq("id", document_id).execute()

        chunks = chunk_text(text)
        if not chunks:
            supabase.table("documents").update({
                "status": "failed",
                "error_message": "No text content could be extracted from the file.",
            }).eq("id", document_id).execute()
            return

        # Look up user's preferred embedding model
        user_prefs = supabase.table("user_settings").select("embedding_model").eq("user_id", user_id).limit(1).execute()
        preferred_model = user_prefs.data[0]["embedding_model"] if user_prefs.data and user_prefs.data[0].get("embedding_model") else None

        embeddings = embed_chunks(chunks, model=preferred_model)

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

        supabase.table("documents").update({
            "status": "completed",
            "chunk_count": len(chunks),
        }).eq("id", document_id).execute()

    except Exception as e:
        supabase.table("documents").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", document_id).execute()
