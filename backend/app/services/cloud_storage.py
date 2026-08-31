"""Phase 216 (ATTACH-01 / D-216-09 / D-216-16) — Single-File Cloud Storage Browser & Fetcher.

Provides human-initiated browsing and fetching of individual files from connected cloud sources
(e.g., Google Drive, OneDrive). Deliberately single-file, synchronous/on-demand, and user-scoped
without background synchronization loops or background watchers (SEED-209/210/211/212 preserved).
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import json as jsonlib

from app.security.egress import send_pinned_http
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


# ── The one safe half of a Google error body ───────────────────────────────────────────
#
# ⚠ THE BODY STAYS UNLOGGED AND UNQUOTED — that rule is not being relaxed. A Drive error
# body echoes the `q` parameter, which carries whatever the person searched for, so
# neither `error.message` nor the raw text may travel. But Google also returns two
# machine-readable ENUMS beside it — `error.status` (`PERMISSION_DENIED`) and
# `error.errors[].reason` (`accessNotConfigured`, `authError`, `insufficientPermissions`,
# `userRateLimitExceeded`, `notFound`) — and those are a closed vocabulary that can never
# contain user text.
#
# ⚠ AND THE DIFFERENCE IS NOT COSMETIC. Measured 2026-08-31: with the Drive API disabled
# in the Cloud project, a real chat run reached the model as bare `HTTP 403`, and the
# model told the operator to "reconnect Google Workspace with the correct scopes" — the
# scopes were already granted and correct, and re-consenting could never have fixed it.
# `accessNotConfigured` is the word that makes that answer impossible to give.
_SAFE_GOOGLE_ERROR_FIELDS = ("status", "reason")


def _google_error_reason(body: bytes | str | None) -> str:
    """Return `` (reason)`` built only from Google's enum fields, or `""`.

    Never raises: a diagnostic that can fail is a second fault on an existing one.
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
        return f" ({' / '.join(parts)})" if parts else ""
    except Exception:  # noqa: BLE001 — a best-effort read of a body we already distrust
        return ""


async def _list_google_drive_files(
    connection_id: str | UUID,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
) -> dict[str, Any]:
    """Queries Google Drive files.list using the connection's refreshed OAuth access token.

    ⚠ THROUGH THE EGRESS BINDER, NOT A RAW CLIENT. This used a bare `httpx.AsyncClient`, so
    it was validated by NOTHING — no scheme check, no allow-list, no DNS pin, no redirect
    refusal, no response cap — which is the one contract every other outbound call in this
    tree keeps. The binder supplies all five under the `drive_read` key.
    """
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise ValueError("Cannot access cloud storage: Connection has no valid OAuth token.")

    q_parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"]
    if query:
        safe_q = query.replace("'", "\\'")
        q_parts.append(f"name contains '{safe_q}'")

    params: dict[str, str] = {
        "pageSize": str(min(page_size, 100)),
        "fields": (
            "nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, "
            "webViewLink)"
        ),
        "q": " and ".join(q_parts),
        "orderBy": "modifiedTime desc",
    }
    if page_token:
        params["pageToken"] = page_token

    resp = await send_pinned_http(
        "drive_read",
        "GET",
        f"{GOOGLE_DRIVE_API_BASE}/files",
        params=params,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=15.0,
        max_bytes=512 * 1024,
    )
    if resp.status_code != 200:
        # ⚠ THE BODY IS NOT LOGGED. It used to be, and a Drive error body echoes the query
        # — which carries whatever the person searched for.
        reason = _google_error_reason(resp.body)
        logger.error("Google Drive list files failed (%s)%s", resp.status_code, reason)
        raise ValueError(
            f"Failed to list Google Drive files: HTTP {resp.status_code}{reason}"
        )

    data = jsonlib.loads(resp.body)
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
    return {"files": files, "next_page_token": data.get("nextPageToken")}

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
    """Downloads one file's bytes from Google Drive, through the egress binder.

    ⚠ `max_bytes` IS THE CAP THE RAW CLIENT DID NOT HAVE. This path downloads a file whose
    id a caller supplies, so an unbounded read was a memory exhaustion any Drive account
    could trigger. 25 MB matches the app's own upload ceiling — a file this cannot fetch is
    a file it could not have ingested anyway.
    """
    token = await get_fresh_access_token(connection_id)
    if not token:
        raise ValueError("Cannot download cloud file: Connection has no valid OAuth token.")

    headers = {"Authorization": f"Bearer {token}"}
    max_bytes = 25 * 1024 * 1024

    meta_resp = await send_pinned_http(
        "drive_read", "GET", f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
        params={"fields": "id, name, mimeType, size"},
        headers={**headers, "Accept": "application/json"},
        timeout=30.0, max_bytes=64 * 1024,
    )
    if meta_resp.status_code != 200:
        raise ValueError(
            "Failed to fetch file metadata: HTTP "
            f"{meta_resp.status_code}{_google_error_reason(meta_resp.body)}"
        )
    meta = jsonlib.loads(meta_resp.body)
    filename = meta.get("name", f"file_{file_id}")
    mime_type = meta.get("mimeType", "application/octet-stream")

    # A Google-native Doc or Sheet has no bytes of its own; it is EXPORTED. Both export to
    # PDF, so the two arms differ only in the sentence they raise.
    if mime_type in (
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
    ):
        kind = "Google Doc" if mime_type.endswith("document") else "Google Sheet"
        export_resp = await send_pinned_http(
            "drive_read", "GET", f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}/export",
            params={"mimeType": "application/pdf"},
            headers=headers, timeout=30.0, max_bytes=max_bytes,
        )
        if export_resp.status_code != 200:
            raise ValueError(
                f"Failed to export {kind}: HTTP "
                f"{export_resp.status_code}{_google_error_reason(export_resp.body)}"
            )
        return f"{filename}.pdf", export_resp.body, "application/pdf"

    dl_resp = await send_pinned_http(
        "drive_read", "GET", f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}",
        params={"alt": "media"},
        headers=headers, timeout=30.0, max_bytes=max_bytes,
    )
    if dl_resp.status_code != 200:
        raise ValueError(
            "Failed to download file content: HTTP "
            f"{dl_resp.status_code}{_google_error_reason(dl_resp.body)}"
        )
    return filename, dl_resp.body, mime_type
