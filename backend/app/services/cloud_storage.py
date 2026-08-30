"""Phase 216 (ATTACH-01 / D-216-09 / D-216-16) — Single-File Cloud Storage Browser & Fetcher.

Provides human-initiated browsing and fetching of individual files from connected cloud sources
(e.g., Google Drive, OneDrive). Deliberately single-file, synchronous/on-demand, and user-scoped
without background synchronization loops or background watchers (SEED-209/210/211/212 preserved).
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx
from app.services.oauth_refresh_service import get_fresh_access_token

logger = logging.getLogger(__name__)

GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"


async def list_cloud_files(
    connection: Any,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
) -> dict[str, Any]:
    """Lists files available in the connected cloud storage account."""
    conn_id = getattr(connection, "id", None) or (connection.get("id") if isinstance(connection, dict) else None)
    service_id = getattr(connection, "service_id", "") or (connection.get("service_id", "") if isinstance(connection, dict) else "")

    if "google" in service_id.lower() or "workspace" in service_id.lower():
        return await _list_google_drive_files(conn_id, query=query, page_token=page_token, page_size=page_size)

    # Generic fallback
    return {
        "files": [],
        "next_page_token": None,
    }


async def _list_google_drive_files(
    connection_id: str | UUID,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
) -> dict[str, Any]:
    """Queries Google Drive files.list API using active refreshed OAuth access token."""
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise ValueError("Cannot access cloud storage: Connection has no valid OAuth token.")

    q_parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"]
    if query:
        safe_q = query.replace("'", "\\'")
        q_parts.append(f"name contains '{safe_q}'")
    q_str = " and ".join(q_parts)

    params: dict[str, Any] = {
        "pageSize": min(page_size, 100),
        "fields": "nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink)",
        "q": q_str,
        "orderBy": "modifiedTime desc",
    }
    if page_token:
        params["pageToken"] = page_token

    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{GOOGLE_DRIVE_API_BASE}/files", params=params, headers=headers)
        if resp.status_code != 200:
            logger.error("Google Drive list files failed (%s): %s", resp.status_code, resp.text)
            raise ValueError(f"Failed to list Google Drive files: HTTP {resp.status_code}")

        data = resp.json()
        files = []
        for f in data.get("files", []):
            files.append({
                "id": f.get("id"),
                "name": f.get("name"),
                "mime_type": f.get("mimeType"),
                "size": int(f.get("size", 0)) if f.get("size") else None,
                "modified_at": f.get("modifiedTime"),
                "icon_url": f.get("iconLink"),
                "web_view_url": f.get("webViewLink"),
            })
        return {
            "files": files,
            "next_page_token": data.get("nextPageToken"),
        }


async def fetch_cloud_file(
    connection: Any,
    file_id: str,
) -> tuple[str, bytes, str]:
    """Downloads a single file from connected cloud storage. Returns (filename, content_bytes, mime_type)."""
    conn_id = getattr(connection, "id", None) or (connection.get("id") if isinstance(connection, dict) else None)
    service_id = getattr(connection, "service_id", "") or (connection.get("service_id", "") if isinstance(connection, dict) else "")

    if "google" in service_id.lower() or "workspace" in service_id.lower():
        return await _fetch_google_drive_file(conn_id, file_id)

    raise NotImplementedError(f"Cloud file fetching not implemented for service: {service_id}")


async def _fetch_google_drive_file(
    connection_id: str | UUID,
    file_id: str,
) -> tuple[str, bytes, str]:
    """Downloads file bytes from Google Drive API."""
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise ValueError("Cannot download cloud file: Connection has no valid OAuth token.")

    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Fetch metadata
        meta_resp = await client.get(
            f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
            params={"fields": "id, name, mimeType, size"},
            headers=headers,
        )
        if meta_resp.status_code != 200:
            raise ValueError(f"Failed to fetch file metadata: HTTP {meta_resp.status_code}")
        meta = meta_resp.json()
        filename = meta.get("name", f"file_{file_id}")
        mime_type = meta.get("mimeType", "application/octet-stream")

        # 2. Download content
        if mime_type == "application/vnd.google-apps.document":
            export_resp = await client.get(
                f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}/export",
                params={"mimeType": "application/pdf"},
                headers=headers,
            )
            if export_resp.status_code != 200:
                raise ValueError(f"Failed to export Google Doc: HTTP {export_resp.status_code}")
            return f"{filename}.pdf", export_resp.content, "application/pdf"
        elif mime_type == "application/vnd.google-apps.spreadsheet":
            export_resp = await client.get(
                f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}/export",
                params={"mimeType": "application/pdf"},
                headers=headers,
            )
            if export_resp.status_code != 200:
                raise ValueError(f"Failed to export Google Sheet: HTTP {export_resp.status_code}")
            return f"{filename}.pdf", export_resp.content, "application/pdf"
        else:
            dl_resp = await client.get(
                f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
                params={"alt": "media"},
                headers=headers,
            )
            if dl_resp.status_code != 200:
                raise ValueError(f"Failed to download file content: HTTP {dl_resp.status_code}")
            return filename, dl_resp.content, mime_type
