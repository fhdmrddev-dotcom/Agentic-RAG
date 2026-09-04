"""The One Ingest Splice — unified minting and background ingestion pipeline.

Phase 229 (TRUST-01):
Every document row created in this product is minted by mint_document_row,
ensuring identical row schema, deduplication, versioning, and canonical storage path
across all ingress doors (/upload, connectors, email attachments).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import hashlib
import logging
import time
from typing import TYPE_CHECKING, Literal
from uuid import uuid4

from fastapi import HTTPException, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

if TYPE_CHECKING:
    from app.services.extraction_service import ExtractedDocument

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class MintResult:
    document: dict
    is_duplicate: bool
    storage_path: str
    version_number: int


def mint_document_row(
    *,
    raw: bytes,
    filename: str,
    mime_type: str,
    user_id: str,
    supabase: Client,
    folder_id: str | None = None,
    metadata: dict | None = None,
    org_id: str | None = None,
    on_conflict: Literal["raise", "link"] = "raise",
) -> MintResult:
    """Synchronously validates, dedupes, versions, and mints a single document row.

    Strictly preserves upload-path semantics:
    1. Folder ownership: folder_id must exist and belong to user_id (403 on mismatch).
    2. Hashing: SHA-256 of raw bytes.
    3. Deduplication: folder-scoped check for status='completed' AND is_latest=True.
       If match found, returns MintResult(is_duplicate=True) without inserting.
    4. Versioning: user-scoped by filename. If prior versions exist, retires them
       (is_latest=False) and increments version_number.
    5. Storage path: canonical f"{user_id}/{document_id}/{filename}".
    6. Row creation: inserts status='pending', omitting created_at/updated_at to
       preserve Postgres column clock defaults.
    7. Unique index collision (23505 on documents_dedup_idx):
       - on_conflict="raise": raises HTTP 409 Conflict.
       - on_conflict="link": re-queries the non-failed document and returns it as
         is_duplicate=True.
    """
    # 1. Folder ownership validation (G-1: owner-only parity with documents.py:610-617)
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
        if folder_check.data["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot upload to a folder you do not own",
            )

    # 2. Content hashing
    content_hash = hashlib.sha256(raw).hexdigest()

    # 3. Folder-scoped deduplication check (completed + is_latest)
    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", user_id)
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
        existing_doc = existing.data[0]
        return MintResult(
            document=existing_doc,
            is_duplicate=True,
            storage_path=existing_doc.get("file_path", ""),
            version_number=existing_doc.get("version_number", 1),
        )

    # 4. Versioning (user-scoped, filename matching)
    existing_versions = (
        supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", user_id)
        .eq("filename", filename)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if existing_versions.data:
        next_version = existing_versions.data[0]["version_number"] + 1
        supabase.table("documents").update({"is_latest": False}).eq("user_id", user_id).eq("filename", filename).execute()
    else:
        next_version = 1

    # 5. Insert new documents row with status='pending'
    document_id = str(uuid4())
    storage_path = f"{user_id}/{document_id}/{filename}"

    doc_data: dict = {
        "id": document_id,
        "user_id": user_id,
        "filename": filename,
        "file_path": storage_path,
        "file_size": len(raw),
        "mime_type": mime_type,
        "status": "pending",
        "content_hash": content_hash,
        "folder_id": folder_id,
        "version_number": next_version,
        "is_latest": True,
    }
    if metadata:
        doc_data["metadata"] = metadata
    if org_id:
        doc_data["org_id"] = org_id

    try:
        result = supabase.table("documents").insert(doc_data).execute()
        doc = result.data[0]
        return MintResult(
            document=doc,
            is_duplicate=False,
            storage_path=storage_path,
            version_number=next_version,
        )
    except Exception as exc:
        exc_str = str(exc)
        if "23505" in exc_str:
            if on_conflict == "link":
                # G-2: Attachment collision or concurrent ingest race.
                # documents_dedup_idx is UNIQUE WHERE status <> 'failed'.
                link_query = (
                    supabase.table("documents")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("content_hash", content_hash)
                    .neq("status", "failed")
                )
                if folder_id:
                    link_query = link_query.eq("folder_id", folder_id)
                else:
                    link_query = link_query.is_("folder_id", "null")
                link_match = link_query.order("created_at", desc=True).limit(1).execute()
                if link_match.data:
                    linked_doc = link_match.data[0]
                    return MintResult(
                        document=linked_doc,
                        is_duplicate=True,
                        storage_path=linked_doc.get("file_path", ""),
                        version_number=linked_doc.get("version_number", 1),
                    )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="File already exists in this folder",
            ) from exc
        raise


async def async_mint_document_row(
    *,
    raw: bytes,
    filename: str,
    mime_type: str,
    user_id: str,
    supabase: Client,
    folder_id: str | None = None,
    metadata: dict | None = None,
    org_id: str | None = None,
    on_conflict: Literal["raise", "link"] = "raise",
) -> MintResult:
    """Asynchronous wrapper for mint_document_row using run_in_threadpool."""
    return await run_in_threadpool(
        lambda: mint_document_row(
            raw=raw,
            filename=filename,
            mime_type=mime_type,
            user_id=user_id,
            supabase=supabase,
            folder_id=folder_id,
            metadata=metadata,
            org_id=org_id,
            on_conflict=on_conflict,
        )
    )


def splice_document(
    *,
    document_id: str,
    raw: bytes,
    mime_type: str,
    filename: str,
    user_id: str,
    storage_path: str,
    supabase: Client,
    engines_dict: dict[str, str] | None = None,
) -> None:
    """Executes the post-minting extraction, embedding, and chunking pipeline.

    Follows the pinned status/ingestion_step sequence:
    1. Storage upload (if storage_path provided; non-blocking swallow-log on failure).
    2. Set status='processing', ingestion_step='extracting'.
    3. Wall-clock bounded Layer 2 extraction (130s timeout).
       On failure: sets status='failed', ingestion_step='failed', error_message.
    4. Delegates to ingest_document for embedding ('embedding'), table/image
       multimodal chunks ('extracting_tables', 'extracting_images'), and completion
       ('completed').
    """
    # Step 1: Storage upload
    if storage_path:
        try:
            supabase.storage.from_("documents").upload(
                path=storage_path,
                file=raw,
                file_options={"content-type": mime_type},
            )
        except Exception as up_exc:
            log.warning(
                "Storage upload failed for %s (%s): %s — proceeding to extraction",
                document_id,
                storage_path,
                up_exc,
            )

    # Step 2: Extraction with status progression and wall-clock fail-safe
    extract_start = time.perf_counter()
    extracted_doc: ExtractedDocument | None = None
    engine_used: str | None = None
    text: str = ""
    wall_clock_s = 130.0

    try:
        supabase.table("documents").update({
            "status": "processing",
            "ingestion_step": "extracting",
        }).eq("id", document_id).execute()
    except Exception:
        pass

    try:
        from app.services.extraction_service import (  # noqa: PLC0415
            DOCX_MIME as _DOCX,
            PDF_MIME as _PDF,
            extract_composable,
        )
        from app.api.documents import extract_text  # noqa: PLC0415

        if mime_type not in (_PDF, _DOCX):
            text = extract_text(raw, mime_type)
        else:
            async def _run_with_timeout() -> ExtractedDocument:
                return await asyncio.wait_for(
                    run_in_threadpool(extract_composable, raw, mime_type, engines_dict),
                    timeout=wall_clock_s,
                )

            extracted_doc = asyncio.run(_run_with_timeout())
            text = extracted_doc.text
            engine_used = extracted_doc.extractor_name or None
    except Exception as exc:
        log.warning("splice_document extraction failed for %s: %s", document_id, exc)
        try:
            supabase.table("documents").update({
                "status": "failed",
                "ingestion_step": "failed",
                "error_message": str(exc)[:500],
            }).eq("id", document_id).execute()
        except Exception:
            pass
        return

    extract_duration_ms = int((time.perf_counter() - extract_start) * 1000)

    # Step 3: Delegate to ingest_document
    from app.api.documents import ingest_document  # noqa: PLC0415

    ingest_document(
        document_id=document_id,
        text=text,
        user_id=user_id,
        supabase=supabase,
        raw=raw,
        mime_type=mime_type,
        filename=filename,
        engine_override=engine_used,
        extracted_doc=extracted_doc,
        extract_duration_ms=extract_duration_ms,
    )
