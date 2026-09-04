"""API routes for CAD Drawing Takeoff & Rate Sheet Matching (Phase 220, TAKEOFF-02/03)."""
from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
from app.services.takeoff.matcher import (
    load_rate_sheet_rows,
    match_takeoff_to_rates,
    resolve_takeoff_item,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["takeoff"])


class TakeoffMatchRequest(BaseModel):
    rate_sheet_document_id: str


class TakeoffResolveRequest(BaseModel):
    item_key: str
    chosen_rate_code: str


@router.get("/{document_id}/takeoff")
async def get_document_takeoff(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> dict[str, Any]:
    """Retrieve extracted takeoff entities and priced BOQ for a CAD document."""
    resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id, filename, metadata")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Document not found")

    meta = resp.data.get("metadata") or {}
    takeoff = meta.get("_takeoff")
    if not takeoff:
        raise HTTPException(
            status_code=400,
            detail="Document has no CAD takeoff data. Ensure it is a valid .dxf file.",
        )
    return takeoff


@router.post("/{document_id}/takeoff/match")
async def match_document_takeoff(
    document_id: str,
    body: TakeoffMatchRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    service_supabase: Client = Depends(get_supabase),
) -> dict[str, Any]:
    """Match a CAD drawing's takeoff entities against an uploaded rate sheet spreadsheet."""
    # 1. Fetch CAD Document
    cad_resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id, filename, file_path, metadata")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not cad_resp.data:
        raise HTTPException(status_code=404, detail="CAD Document not found")

    cad_doc = cad_resp.data
    meta = dict(cad_doc.get("metadata") or {})
    takeoff = meta.get("_takeoff")

    # If takeoff wasn't extracted during ingest, try to extract now from storage
    if not takeoff and cad_doc.get("file_path"):
        try:
            file_bytes = await run_in_threadpool(
                lambda: service_supabase.storage.from_("documents").download(cad_doc["file_path"])
            )
            from app.services.extractors.aspects.dxf import extract_dxf_takeoff  # noqa: PLC0415
            takeoff = extract_dxf_takeoff(file_bytes, filename=cad_doc["filename"])
            meta["_takeoff"] = takeoff
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read CAD drawing: {exc}",
            ) from exc

    if not takeoff:
        raise HTTPException(
            status_code=400,
            detail="No CAD takeoff data available for this document.",
        )

    # 2. Fetch Rate Sheet Document
    rate_resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id, filename, file_path")
        .eq("id", body.rate_sheet_document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not rate_resp.data:
        raise HTTPException(status_code=404, detail="Rate sheet document not found")

    rate_doc = rate_resp.data
    if not rate_doc.get("file_path"):
        raise HTTPException(status_code=400, detail="Rate sheet has no stored file.")

    try:
        rate_bytes = await run_in_threadpool(
            lambda: service_supabase.storage.from_("documents").download(rate_doc["file_path"])
        )
        rates = load_rate_sheet_rows(rate_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to extract rate sheet: {exc}",
        ) from exc

    # 3. Match Takeoff to Rates
    try:
        boq = match_takeoff_to_rates(takeoff, rates)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error computing takeoff quantities: {exc}",
        ) from exc

    # 4. Save BOQ into document metadata
    meta["_takeoff"]["boq"] = boq
    meta["_takeoff"]["rate_sheet_document_id"] = body.rate_sheet_document_id
    meta["_takeoff"]["rate_sheet_filename"] = rate_doc["filename"]

    await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"metadata": meta})
        .eq("id", document_id)
        .execute()
    )

    return boq


@router.patch("/{document_id}/takeoff/resolve")
async def resolve_document_takeoff_item(
    document_id: str,
    body: TakeoffResolveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    service_supabase: Client = Depends(get_supabase),
) -> dict[str, Any]:
    """Resolve an ambiguous takeoff item by assigning a chosen rate code."""
    # 1. Fetch CAD Document
    cad_resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id, metadata")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not cad_resp.data:
        raise HTTPException(status_code=404, detail="CAD Document not found")

    meta = dict(cad_resp.data.get("metadata") or {})
    takeoff = meta.get("_takeoff") or {}
    boq = takeoff.get("boq")
    rate_sheet_id = takeoff.get("rate_sheet_document_id")

    if not boq or not rate_sheet_id:
        raise HTTPException(
            status_code=400,
            detail="No active matched BOQ found for this document.",
        )

    # 2. Fetch Rate Sheet Document
    rate_resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("file_path")
        .eq("id", rate_sheet_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not rate_resp.data or not rate_resp.data.get("file_path"):
        raise HTTPException(status_code=404, detail="Underlying rate sheet not found")

    rate_bytes = await run_in_threadpool(
        lambda: service_supabase.storage.from_("documents").download(rate_resp.data["file_path"])
    )
    rates = load_rate_sheet_rows(rate_bytes)

    # 3. Resolve item
    try:
        updated_boq = resolve_takeoff_item(boq, body.item_key, body.chosen_rate_code, rates)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    meta["_takeoff"]["boq"] = updated_boq

    await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"metadata": meta})
        .eq("id", document_id)
        .execute()
    )

    return updated_boq
