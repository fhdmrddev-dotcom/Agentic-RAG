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


#: Characters Supabase Storage refuses in an object key. ⚠ DERIVED FROM A REAL 400, not from the
#: docs: `Cambridge IELTS 14 with Answers GT [www.luckyielts.com].pdf` produced
#:     StorageApiError {'statusCode': 400, 'error': 'InvalidKey',
#:                      'message': 'Invalid key: <user>/<doc>/Cambridge ... [www.luckyielts.com].pdf'}
#: Square brackets are the ones that bit; the rest are the shell/URL-hostile set that would bite
#: next. Kept deliberately SMALL — this is a key sanitiser, not a filename policy.
_STORAGE_UNSAFE = '[]{}#%^`"\'<>|\\?*\r\n\t'


def _storage_safe(name: str) -> str:
    """Make a filename usable as a Supabase Storage object key, without renaming the document.

    ⚠ BUG-260905-06 — THE FAILURE THIS FIXES WAS INVISIBLE, AND THAT IS THE POINT. The upload
    raised `InvalidKey`, but `/upload` and `splice_document` BOTH swallow storage-upload errors
    (a `log.warning` and a `log.debug` respectively, deliberately, so a storage hiccup does not
    lose an ingest). The document therefore sailed on to extraction with **no bytes ever
    stored**, and later failed with an EMPTY `error_message` — which is what two of the six
    failures in the operator's Drive import actually were. **The blank message was the tell:**
    every honest failure path in this pipeline names a cause.

    ⚠ `documents.filename` is NOT touched. The person sees the file they uploaded; only the
    storage KEY is sanitised. A sanitiser that renamed the document would fix the 400 by
    lying about what the file is called.

    ⚠ It is applied HERE, at the single minting site, so `file_path` is written sanitised ONCE
    and every later reader (`splice_document`'s download, the queue worker, re-extract) derives
    the same key from the column rather than recomputing it. Sanitising at the upload call
    instead would have produced a key that no download could reproduce.
    """
    cleaned = "".join("_" if ch in _STORAGE_UNSAFE else ch for ch in (name or ""))
    cleaned = cleaned.strip() or "file"
    # Collapse runs of the replacement so `[www.x.com]` does not become `__www.x.com__`.
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned


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
    source_connection_id: str | None = None,
    ingest_visibility: str | None = None,
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

    # 3. Deduplication — SCOPED TO MATCH THE CONSTRAINT THAT ACTUALLY FIRES.
    #
    # ⚠ BUG-260905-02. This check used to be FOLDER-scoped and to require `is_latest = True`.
    #   The unique index it is supposed to anticipate is neither:
    #
    #     documents_completed_hash_unique_idx
    #       ON documents (user_id, content_hash)
    #       WHERE content_hash IS NOT NULL AND status = 'completed'
    #
    #   So re-uploading a file you already had, into a DIFFERENT folder, passed this check,
    #   ran the whole extraction and embedding pipeline, and then died at the completion write
    #   with a raw 23505 — after all the work was paid for, and leaving the row `failed` when
    #   nothing had actually gone wrong. Measured on a real bulk ingest: `Train-the-Trainer.pptx`
    #   completed in folder e400e289 on 2026-09-01, re-uploaded to the root on 09-05, failed.
    #
    # ⚠ A CHECK THAT IS NARROWER THAN ITS CONSTRAINT DOES NOT PREVENT THE ERROR, IT ONLY DELAYS
    #   IT. The two predicates below are now the index's predicate, verbatim.
    #
    # ⚠ DELIBERATE BEHAVIOUR CHANGE: the same bytes uploaded to a second folder are now reported
    #   as a duplicate instead of appearing to succeed and then failing. The database already
    #   forbade the second copy — this only moves the refusal to where a person can act on it.
    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", user_id)
        .eq("content_hash", content_hash)
        .eq("status", "completed")
    )

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
    storage_path = f"{user_id}/{document_id}/{_storage_safe(filename)}"

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

    # Phase 231 (VIS-01 / TRUST-04) — provenance and the scope the connection's owner chose.
    # ⚠ BOTH keys are omitted entirely for a person's upload, so /upload's minted dict stays
    #   field-for-field what Phase 229's verification pinned. The column default ('private')
    #   covers the omitted case, and the SQL predicate ignores visibility outright when
    #   source_connection_id IS NULL — so a hand-uploaded row is untouched by this phase.
    # ⚠ Visibility is only meaningful WITH a connection. Accepting one without the other would
    #   mint a row claiming a scope nothing enforces, so the pair is written together or not
    #   at all.
    if source_connection_id:
        doc_data["source_connection_id"] = source_connection_id
        doc_data["ingest_visibility"] = ingest_visibility or "private"

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
    source_connection_id: str | None = None,
    ingest_visibility: str | None = None,
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
            source_connection_id=source_connection_id,
            ingest_visibility=ingest_visibility,
        )
    )


async def splice_document(
    *,
    document_id: str,
    raw: bytes | None = None,
    mime_type: str | None = None,
    filename: str | None = None,
    user_id: str | None = None,
    storage_path: str | None = None,
    supabase: Client | None = None,
    engines_dict: dict[str, str] | None = None,
    job_id: str | Any | None = None,
    initial_progress: dict[str, Any] | None = None,
    progress: dict[str, Any] | None = None,
    pool: Any | None = None,
) -> None:
    """Executes the post-minting extraction, embedding, and chunking pipeline.

    Phase 230 (QUEUE-01 / QUEUE-04 / SC#1 / SC#4):
    - Supports durable queue execution with checkpointed resumption (progress.chunk_offset).
    - When job_id is provided, updates ingestion_jobs.progress after each chunk batch and stage.
    - Resumes chunk embedding from progress.chunk_offset without re-embedding prior chunks.
    - If stage == "tables_embedded", skips table extraction and embedding.
    - Authoritative recount of document_chunks on completion.
    """
    from datetime import datetime, timezone  # noqa: PLC0415
    from uuid import UUID  # noqa: PLC0415

    if supabase is None:
        from app.dependencies import get_supabase  # noqa: PLC0415
        supabase = get_supabase()

    # Resolve document row if metadata fields missing
    doc: dict[str, Any] = {}
    if not (filename and mime_type and user_id and storage_path):
        try:
            res = supabase.table("documents").select("*").eq("id", document_id).maybe_single().execute()
            doc = res.data or {}
        except Exception as e:
            log.warning("Could not fetch document %s row: %s", document_id, e)
        filename = filename or doc.get("filename", "")
        mime_type = mime_type or doc.get("mime_type", "")
        user_id = user_id or doc.get("user_id", "")
        storage_path = storage_path or doc.get("file_path", "")

    # Resolve raw bytes if missing
    if raw is None or len(raw) == 0:
        if storage_path:
            try:
                raw = supabase.storage.from_("documents").download(storage_path)
            except Exception as dl_exc:
                log.warning("Storage download failed for %s (%s): %s", document_id, storage_path, dl_exc)
                raw = b""
        else:
            raw = b""

    # Step 1: Storage upload (if raw & storage_path provided and not already uploaded)
    if storage_path and raw:
        try:
            supabase.storage.from_("documents").upload(
                path=storage_path,
                file=raw,
                file_options={"content-type": mime_type},
            )
        except Exception as up_exc:
            log.debug(
                "Storage upload non-blocking notice for %s (%s): %s",
                document_id,
                storage_path,
                up_exc,
            )

    prog = progress or initial_progress or {}
    if isinstance(prog, list):
        # Defensive against malformed array: find last dict or empty dict
        dict_items = [x for x in prog if isinstance(x, dict)]
        prog = dict_items[-1] if dict_items else {}
    elif isinstance(prog, str):
        import json  # noqa: PLC0415
        try:
            parsed = json.loads(prog)
            prog = parsed if isinstance(parsed, dict) else {}
        except Exception:
            prog = {}
    elif not isinstance(prog, dict):
        prog = {}

    chunk_offset = int(prog.get("chunk_offset", 0))
    stage = prog.get("stage")
    job_uuid = UUID(str(job_id)) if job_id else None

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

    if pool and job_uuid and not stage:
        try:
            from app.db.ingestion_jobs import update_job_progress  # noqa: PLC0415
            await update_job_progress(pool, job_uuid, stage="extracting", progress_patch={"chunk_offset": chunk_offset})
        except Exception as p_exc:
            log.warning("Failed updating progress to extracting: %s", p_exc)

    # Re-use already extracted full_markdown if available
    if not text and doc.get("full_markdown"):
        text = doc["full_markdown"]

    if not text:
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

                extracted_doc = await _run_with_timeout()
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
            if job_uuid:
                raise exc
            return

    extract_duration_ms = int((time.perf_counter() - extract_start) * 1000)

    # Step 3: When job_id is not provided, delegate directly to legacy ingest_document
    if not job_uuid:
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
        return

    from app.services.text_sanitize import scrub_text  # noqa: PLC0415
    from app.services.embedding_service import chunk_text, embed_chunks  # noqa: PLC0415
    from app.models.user_settings import load_app_settings  # noqa: PLC0415
    from app.db.ingestion_jobs import update_job_progress  # noqa: PLC0415

    # 4a. Multi-modal table extraction (skip if tables_embedded / chunks_embedded)
    if raw and mime_type:
        if stage in ("tables_embedded", "chunks_embedded"):
            log.info("Document %s: skipping table extraction (already at stage=%s)", document_id, stage)
        else:
            try:
                supabase.table("documents").update({"ingestion_step": "extracting_tables"}).eq("id", document_id).execute()
                from app.services.multimodal_service import extract_and_store_tables  # noqa: PLC0415
                await run_in_threadpool(
                    extract_and_store_tables,
                    raw, mime_type, document_id, user_id, supabase,
                    extracted_doc=extracted_doc,
                )
                if pool and job_uuid:
                    await update_job_progress(
                        pool, job_uuid, stage="tables_embedded", progress_patch={"chunk_offset": chunk_offset}
                    )
            except Exception as tbl_err:
                log.warning("Table extraction warning for %s: %s", document_id, tbl_err)

    app_settings = load_app_settings()

    # ── BUG-260905-06 — THE STEP THIS PATH NEVER RAN ────────────────────────────────────
    #
    # ⛔ EVERY UPLOAD SINCE THE PHASE 230 CUTOVER LANDED WITHOUT METADATA. With a `job_id`
    #    this function stops delegating to `ingest_document` and runs the loop below
    #    instead — and the loop was written without the enrichment step. Measured:
    #    `grep "extract_metadata\|metadata_dict\|context_header"` over this file returned
    #    NOTHING. `/upload` enqueues a job by default, so the metadata-bearing path had no
    #    traffic at all.
    #
    #    What was lost, per document: title / date / author / document_type / custom fields;
    #    the `[Document: … | Title: … | Date: …]` header prepended to every chunk before
    #    embedding; SEED-226 vision transcription for scans, drawings and images; and the
    #    `_source` user-edit guard plus `metadata.source` provenance carry that Phase 233
    #    added at what it called "the single metadata-write site all three re-extract entry
    #    points funnel through". They funnelled through it. This path did not.
    #
    # ⚠ `run_in_threadpool` IS LOAD-BEARING, not decoration. `enrich_for_ingest` calls
    #   `asyncio.run` internally and does blocking Supabase I/O; awaiting it here, or
    #   calling it inline, would raise inside a running loop and its own broad `except`
    #   would degrade that to `metadata=None` — reintroducing this exact bug in a form that
    #   looks like a working call.
    from app.services.ingest_enrich import enrich_for_ingest  # noqa: PLC0415

    enriched = await run_in_threadpool(
        enrich_for_ingest,
        document_id=document_id,
        text=text,
        raw=raw,
        mime_type=mime_type,
        filename=filename,
        user_id=user_id,
        supabase=supabase,
        app_settings=app_settings,
    )
    text = enriched.text
    context_header = enriched.context_header

    if enriched.metadata is not None:
        try:
            supabase.table("documents").update(
                {"metadata": enriched.metadata}
            ).eq("id", document_id).execute()
        except Exception as meta_err:
            # Best-effort, exactly as the legacy path treats it: a metadata write must never
            # fail an ingestion that has already produced text (D-111-8).
            log.warning("Metadata write warning for %s: %s", document_id, meta_err)

    # 4b. Chunking and Checkpointed Embedding
    clean_text = scrub_text(text)
    chunks = chunk_text(clean_text)
    total_chunks = len(chunks)
    _chunk_embedding_model = app_settings.embedding_model or "text-embedding-3-small"
    _chunk_embedding_dimensions = getattr(app_settings, "embedding_dimensions", None)

    try:
        supabase.table("documents").update({"ingestion_step": "embedding"}).eq("id", document_id).execute()
    except Exception:
        pass

    BATCH_SIZE = 50
    # SC#4: Resume from chunk_offset without re-embedding prior chunks
    for batch_start in range(chunk_offset, total_chunks, BATCH_SIZE):
        batch_chunks = chunks[batch_start : batch_start + BATCH_SIZE]
        if not batch_chunks:
            continue

        # Embed batch (transparent batcher in embed_texts handles <= 200k tokens / 512 chunks)
        # ⚠ THE HEADER IS EMBEDDED, THE RAW CHUNK IS STORED — the same split the legacy path
        #   makes. It is what lets "amount paid on 17 Jan" match a receipt whose date exists
        #   only in its filename, and it is what carries a truncated document's own
        #   INCOMPLETE notice into every one of its chunks.
        texts_to_embed = (
            [context_header + c for c in batch_chunks] if context_header else batch_chunks
        )
        embeddings = await run_in_threadpool(
            embed_chunks,
            texts_to_embed,
            model=_chunk_embedding_model,
            user_settings=app_settings,
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        chunk_rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "content": c,
                "chunk_index": batch_start + i,
                "embedding": emb,
                "embedding_model": _chunk_embedding_model,
                "embedding_dimensions": _chunk_embedding_dimensions,
                "embedded_at": now_iso,
            }
            for i, (c, emb) in enumerate(zip(batch_chunks, embeddings))
        ]
        supabase.table("document_chunks").insert(chunk_rows).execute()

        current_offset = batch_start + len(batch_chunks)
        if pool and job_uuid:
            await update_job_progress(
                pool,
                job_uuid,
                stage="chunks_embedded",
                progress_patch={"chunk_offset": current_offset},
            )

    # 4c. Multi-modal image extraction
    if raw and mime_type:
        try:
            supabase.table("documents").update({"ingestion_step": "extracting_images"}).eq("id", document_id).execute()
            from app.services.multimodal_service import extract_and_store_images  # noqa: PLC0415
            await run_in_threadpool(
                extract_and_store_images,
                raw, mime_type, document_id, user_id, supabase, app_settings,
                extracted_doc=extracted_doc,
            )
        except Exception as img_err:
            log.warning("Image extraction warning for %s: %s", document_id, img_err)

    # 4d. Finalize & Authoritative Recount
    try:
        count_resp = (
            supabase.table("document_chunks")
            .select("id", count="exact", head=True)
            .eq("document_id", document_id)
            .execute()
        )
        total_recounted = count_resp.count if count_resp.count is not None else total_chunks
    except Exception:
        total_recounted = total_chunks

    supabase.table("documents").update({
        "status": "completed",
        "chunk_count": total_recounted,
        "full_markdown": text,
        "extractor": engine_used or "legacy",
    }).eq("id", document_id).execute()

    if pool and job_uuid:
        await update_job_progress(
            pool,
            job_uuid,
            stage="completed",
            progress_patch={"chunk_offset": total_chunks},
        )
