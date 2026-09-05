"""Phase 232 (SRC-01 / D-232-06) — Source Import Service.

Encapsulates single-file import and browse routines using SourceRegistry,
discharging the legacy cloud_storage.py responsibilities into the source contract.
Handles asynchronous document minting, connection-scoped visibility, and background splicing.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import BackgroundTasks
from supabase import Client

from app.dependencies import get_supabase
from app.services import ingest_splice
from app.services.sources.base import SourceRegistry

logger = logging.getLogger(__name__)


async def browse_connection_files(
    connection: Any,
    query: str | None = None,
    folder_id: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
) -> dict[str, Any]:
    """List or search files available in the connected external source."""
    adapter = SourceRegistry.get_adapter(connection)
    if not adapter:
        return {
            "files": [],
            "next_page_token": None,
        }

    file_page = await adapter.list_files(
        connection=connection,
        folder_id=folder_id,
        page_token=page_token,
        query=query,
        page_size=page_size,
    )
    files = [
        {
            "id": f.id,
            "name": f.name,
            "mime_type": f.mime_type,
            "size": f.size,
            "modified_at": f.modified_at,
            "icon_url": f.icon_url,
            "web_view_url": f.web_view_url,
        }
        for f in file_page.files
    ]
    return {
        "files": files,
        "next_page_token": file_page.next_page_token,
    }


async def import_single_file(
    connection: Any,
    file_id: str,
    user_id: str,
    active_org: str,
    background_tasks: BackgroundTasks,
    supabase: Client,
) -> dict[str, Any]:
    """Download a single file from a connected source and mint it into Library.

    Preserves TM-232-05 (ingest_visibility read exclusively from connection record)
    and TM-232-06 (org_id resolved explicitly from active_org).
    """
    filename, raw_bytes, mime_type = await fetch_cloud_file(connection, file_id)

    conn_id = getattr(connection, "id", None) or (
        connection.get("id") if isinstance(connection, dict) else None
    )
    ingest_vis = (
        getattr(connection, "default_ingest_visibility", None)
        or (connection.get("default_ingest_visibility") if isinstance(connection, dict) else None)
        or "private"
    )

    mint_result = await ingest_splice.async_mint_document_row(
        raw=raw_bytes,
        filename=filename,
        mime_type=mime_type,
        user_id=user_id,
        supabase=supabase,
        org_id=str(active_org),
        source_connection_id=str(conn_id) if conn_id else None,
        ingest_visibility=ingest_vis,
    )
    doc = mint_result.document

    if not mint_result.is_duplicate:
        srv_supabase = get_supabase()
        background_tasks.add_task(
            ingest_splice.splice_document,
            document_id=doc["id"],
            raw=raw_bytes,
            mime_type=mime_type,
            filename=filename,
            user_id=user_id,
            storage_path=mint_result.storage_path,
            supabase=srv_supabase,
        )

    return doc


# Backwards compatibility shims for legacy callers and tests
list_cloud_files = browse_connection_files


async def fetch_cloud_file(
    connection: Any,
    file_id: str,
) -> tuple[str, bytes, str]:
    """Download a single file from connected source (legacy shim)."""
    adapter = SourceRegistry.get_adapter(connection)
    if not adapter:
        service_name = getattr(connection, "service_name", "") or (
            connection.get("service_name", "") if isinstance(connection, dict) else ""
        )
        if "google" in service_name.lower():
            adapter = SourceRegistry.get_adapter("google")

    if not adapter:
        service_id = getattr(connection, "service_id", "") or (
            connection.get("service_id", "") if isinstance(connection, dict) else ""
        )
        raise NotImplementedError(f"Cloud file fetching not implemented for service: {service_id}")
    return await adapter.read_file(connection, file_id)
