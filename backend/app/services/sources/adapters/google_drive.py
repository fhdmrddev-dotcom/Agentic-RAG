"""Phase 232 (SRC-02 / D-232-01 / D-232-05) — Google Drive Source Adapter.

Implements SourceAdapter for Google Drive and Google Workspace accounts.
Provides hierarchical folder browsing for both My Drive and Shared Drives,
file enumeration with full shared drive support, Docs/Sheets PDF export,
and safe diagnostic error reporting without user query leakage.
"""

from __future__ import annotations

import json as jsonlib
import logging
from typing import Any
from uuid import UUID

from app.models.user_settings import source_max_file_bytes
from app.security.egress import send_pinned_http
from app.services.oauth_refresh_service import get_fresh_access_token
from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)

logger = logging.getLogger(__name__)

GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"

# ── ⚠ SEED-258: ~~`MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB matching application upload
#    ceiling`~~ — REMOVED, and its comment was FALSE. Measured 2026-09-08, `documents.py`
#    refuses a hand-uploaded file at 50 MB, so this never "matched" anything; it was one of
#    three private copies that agreed only by coincidence of careful authorship, while a
#    fourth number (`mcp_client`'s envelope cap) disagreed with all three in production.
#    The ceiling is now ONE operator setting read through `source_max_file_bytes()`.
#    ⛔ Do not reintroduce a module constant here — that is the defect, not a convenience.


def _google_error_reason(body: bytes | str | None) -> str:
    """Return `` (reason)`` built only from Google's machine-readable enum fields, or `""`.

    Never logs or reflects the raw error body, which echoes user search query 'q'.
    Extracts status and reasons from error.status, error.errors[], and error.details[].
    """
    try:
        data = jsonlib.loads(body) if body else {}
        err = data.get("error") or {}
        parts: list[str] = []
        status = err.get("status")
        if isinstance(status, str) and status.replace("_", "").isalnum():
            parts.append(status)
        for entry in err.get("errors") or []:
            reason = (entry or {}).get("reason") if isinstance(entry, dict) else None
            if isinstance(reason, str) and reason.isalnum() and reason not in parts:
                parts.append(reason)
        for detail in err.get("details") or []:
            if not isinstance(detail, dict):
                continue
            reason = detail.get("reason")
            if isinstance(reason, str) and reason.replace("_", "").isalnum() and reason not in parts:
                parts.append(reason)
        return f" ({' / '.join(parts)})" if parts else ""
    except Exception:  # noqa: BLE001
        return ""


@SourceRegistry.register("google")
@SourceRegistry.register("google_workspace")
class GoogleDriveSourceAdapter(SourceAdapter):
    """Source adapter for Google Drive and Google Workspace."""

    async def _get_auth_token(self, connection: Any) -> str:
        """Resolve and refresh the connection OAuth access token."""
        conn_id = getattr(connection, "id", None) or (
            connection.get("id") if isinstance(connection, dict) else None
        )
        if not conn_id:
            raise ValueError("Connection has no valid id to obtain access token.")

        token = await get_fresh_access_token(conn_id)
        if not token:
            raise ValueError("Cannot access Google Drive: Connection has no valid OAuth token.")
        return token

    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse folder hierarchy for My Drive and Shared Drives."""
        # Top-level virtual roots: My Drive and Shared Drives
        if not folder_id or folder_id in ("virtual_root", ""):
            return BrowsePage(
                items=[
                    SourceNode(
                        id="my_drive",
                        name="My Drive",
                        kind="folder",
                        has_children=True,
                    ),
                    SourceNode(
                        id="shared_drives",
                        name="Shared Drives",
                        kind="folder",
                        has_children=True,
                    ),
                ],
                next_page_token=None,
            )

        token = await self._get_auth_token(connection)
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        # Shared Drives root: enumerate all accessible shared drives via /drives
        if folder_id == "shared_drives":
            params = {"pageSize": "100"}
            if page_token:
                params["pageToken"] = page_token

            resp = await send_pinned_http(
                "drive_read",
                "GET",
                f"{GOOGLE_DRIVE_API_BASE}/drives",
                params=params,
                headers=headers,
                timeout=15.0,
                max_bytes=512 * 1024,
            )
            if resp.status_code != 200:
                reason = _google_error_reason(resp.body)
                logger.error("Google Drive list shared drives failed (%s)%s", resp.status_code, reason)
                raise ValueError(f"Failed to list Shared Drives: HTTP {resp.status_code}{reason}")

            data = jsonlib.loads(resp.body)
            items: list[SourceNode] = []
            for d in data.get("drives", []):
                items.append(
                    SourceNode(
                        id=d.get("id", ""),
                        name=d.get("name", "Shared Drive"),
                        kind="drive",
                        drive_id=d.get("id"),
                        has_children=True,
                        parent_id="shared_drives",
                    )
                )
            return BrowsePage(items=items, next_page_token=data.get("nextPageToken"))

        # Folder drill-down: My Drive root ('root') or a specific folder ID
        target_parent = "root" if folder_id == "my_drive" else folder_id
        safe_parent = target_parent.replace("'", "\\'")

        q = f"'{safe_parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        params = {
            "pageSize": "100",
            "fields": "nextPageToken, files(id, name, mimeType, driveId)",
            "q": q,
            "orderBy": "name",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
            "corpora": "allDrives",
        }
        if page_token:
            params["pageToken"] = page_token

        resp = await send_pinned_http(
            "drive_read",
            "GET",
            f"{GOOGLE_DRIVE_API_BASE}/files",
            params=params,
            headers=headers,
            timeout=15.0,
            max_bytes=512 * 1024,
        )
        if resp.status_code != 200:
            reason = _google_error_reason(resp.body)
            logger.error("Google Drive browse folder failed (%s)%s", resp.status_code, reason)
            raise ValueError(f"Failed to browse Google Drive folder: HTTP {resp.status_code}{reason}")

        data = jsonlib.loads(resp.body)
        items = []
        for f in data.get("files", []):
            items.append(
                SourceNode(
                    id=f.get("id", ""),
                    name=f.get("name", ""),
                    kind="folder",
                    drive_id=f.get("driveId"),
                    has_children=True,
                    parent_id=folder_id,
                )
            )
        return BrowsePage(items=items, next_page_token=data.get("nextPageToken"))

    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
    ) -> FilePage:
        """List non-folder files inside a target folder, or matching an optional search query."""
        if folder_id in ("shared_drives", "virtual_root") and not query:
            return FilePage(files=[], next_page_token=None)

        token = await self._get_auth_token(connection)
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        q_parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"]
        if folder_id and folder_id not in ("shared_drives", "virtual_root"):
            target_parent = "root" if folder_id == "my_drive" else folder_id
            safe_parent = target_parent.replace("'", "\\'")
            q_parts.append(f"'{safe_parent}' in parents")
        if query:
            safe_q = query.replace("'", "\\'")
            q_parts.append(f"name contains '{safe_q}'")

        params = {
            "pageSize": str(min(page_size, 100)),
            "fields": (
                "nextPageToken, files(id, name, mimeType, size, modifiedTime, driveId, iconLink, "
                "webViewLink)"
            ),
            "q": " and ".join(q_parts),
            "orderBy": "modifiedTime desc",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
            "corpora": "allDrives",
        }
        if page_token:
            params["pageToken"] = page_token

        resp = await send_pinned_http(
            "drive_read",
            "GET",
            f"{GOOGLE_DRIVE_API_BASE}/files",
            params=params,
            headers=headers,
            timeout=15.0,
            max_bytes=512 * 1024,
        )
        if resp.status_code != 200:
            reason = _google_error_reason(resp.body)
            logger.error("Google Drive list files failed (%s)%s", resp.status_code, reason)
            raise ValueError(f"Failed to list Google Drive files: HTTP {resp.status_code}{reason}")

        data = jsonlib.loads(resp.body)
        files = []
        for f in data.get("files", []):
            files.append(
                SourceFile(
                    id=f.get("id", ""),
                    name=f.get("name", ""),
                    mime_type=f.get("mimeType", "application/octet-stream"),
                    size=int(f.get("size", 0)) if f.get("size") else None,
                    modified_at=f.get("modifiedTime"),
                    drive_id=f.get("driveId"),
                    icon_url=f.get("iconLink"),
                    web_view_url=f.get("webViewLink"),
                )
            )
        return FilePage(files=files, next_page_token=data.get("nextPageToken"))

    async def read_file(
        self,
        connection: Any,
        file_id: str,
    ) -> tuple[str, bytes, str]:
        """Download file content, exporting Google Docs/Sheets to PDF."""
        token = await self._get_auth_token(connection)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Fetch metadata
        meta_resp = await send_pinned_http(
            "drive_read",
            "GET",
            f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
            params={"fields": "id, name, mimeType, size", "supportsAllDrives": "true"},
            headers={**headers, "Accept": "application/json"},
            timeout=30.0,
            max_bytes=64 * 1024,
        )
        if meta_resp.status_code != 200:
            reason = _google_error_reason(meta_resp.body)
            raise ValueError(f"Failed to fetch file metadata: HTTP {meta_resp.status_code}{reason}")

        meta = jsonlib.loads(meta_resp.body)
        filename = meta.get("name", f"file_{file_id}")
        mime_type = meta.get("mimeType", "application/octet-stream")

        # 2. Export native Google Docs / Sheets to PDF
        if mime_type in (
            "application/vnd.google-apps.document",
            "application/vnd.google-apps.spreadsheet",
        ):
            kind = "Google Doc" if mime_type.endswith("document") else "Google Sheet"
            export_resp = await send_pinned_http(
                "drive_read",
                "GET",
                f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}/export",
                params={"mimeType": "application/pdf"},
                headers=headers,
                timeout=30.0,
                max_bytes=source_max_file_bytes(),
            )
            if export_resp.status_code != 200:
                reason = _google_error_reason(export_resp.body)
                raise ValueError(f"Failed to export {kind}: HTTP {export_resp.status_code}{reason}")
            return f"{filename}.pdf", export_resp.body, "application/pdf"

        # 3. Binary download
        dl_resp = await send_pinned_http(
            "drive_read",
            "GET",
            f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
            params={"alt": "media", "supportsAllDrives": "true"},
            headers=headers,
            timeout=30.0,
            max_bytes=source_max_file_bytes(),
        )
        if dl_resp.status_code != 200:
            reason = _google_error_reason(dl_resp.body)
            raise ValueError(f"Failed to download file content: HTTP {dl_resp.status_code}{reason}")

        return filename, dl_resp.body, mime_type

    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Verify token freshness and basic API reachability."""
        try:
            token = await self._get_auth_token(connection)
            headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
            resp = await send_pinned_http(
                "drive_read",
                "GET",
                f"{GOOGLE_DRIVE_API_BASE}/about",
                params={"fields": "user(displayName, emailAddress)"},
                headers=headers,
                timeout=10.0,
                max_bytes=64 * 1024,
            )
            if resp.status_code != 200:
                reason = _google_error_reason(resp.body)
                return SourceHealth(ok=False, error=f"HTTP {resp.status_code}{reason}")

            data = jsonlib.loads(resp.body)
            user_info = data.get("user") or {}
            return SourceHealth(
                ok=True,
                details={
                    "display_name": user_info.get("displayName"),
                    "email": user_info.get("emailAddress"),
                },
            )
        except Exception as exc:
            return SourceHealth(ok=False, error=str(exc))


async def _list_google_drive_files(
    connection_id: str | UUID,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
) -> dict[str, Any]:
    """Shim for legacy callers (service_tools.py and test suites) querying Google Drive files."""
    adapter = GoogleDriveSourceAdapter()
    conn = {"id": str(connection_id), "service_id": "google"}
    page = await adapter.list_files(
        conn,
        query=query,
        page_token=page_token,
        page_size=page_size,
    )
    return {
        "files": [
            {
                "id": f.id,
                "name": f.name,
                "mime_type": f.mime_type,
                "size": f.size,
                "modified_at": f.modified_at,
                "icon_url": f.icon_url,
                "web_view_url": f.web_view_url,
            }
            for f in page.files
        ],
        "next_page_token": page.next_page_token,
    }


async def _fetch_google_drive_file(
    connection_id: str | UUID,
    file_id: str,
) -> tuple[str, bytes, str]:
    """Shim for legacy callers downloading a single file from Google Drive."""
    adapter = GoogleDriveSourceAdapter()
    conn = {"id": str(connection_id), "service_id": "google"}
    return await adapter.read_file(conn, file_id)

