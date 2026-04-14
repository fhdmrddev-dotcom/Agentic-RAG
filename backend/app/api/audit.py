"""Audit log read endpoints — Phase 31 (AUDIT-04, AUDIT-05)."""
import csv
import io
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from supabase import Client

from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/audit-logs", tags=["audit"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _since_to_dt(since: str | None) -> datetime | None:
    """Convert since param (7d/30d/90d) to a UTC datetime cutoff."""
    if since == "7d":
        return datetime.now(timezone.utc) - timedelta(days=7)
    if since == "30d":
        return datetime.now(timezone.utc) - timedelta(days=30)
    if since == "90d":
        return datetime.now(timezone.utc) - timedelta(days=90)
    return None


def _apply_filters(query, user_id: str, since: str | None, action_type: str | None):
    """Apply user_id, since, and action_type filters to a Supabase query builder."""
    query = query.eq("user_id", user_id)
    dt = _since_to_dt(since)
    if dt is not None:
        query = query.gte("created_at", dt.isoformat())
    if action_type:
        query = query.eq("action_type", action_type)
    return query


def _format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _format_details(action_type: str, metadata: dict) -> str:
    """Human-readable one-liner for the Details column (per D-04)."""
    if action_type == "document.upload":
        fname = metadata.get("filename", "")
        size = metadata.get("file_size")
        if size is not None:
            return f"{fname} ({_format_bytes(size)})"
        return fname
    if action_type == "document.delete":
        return metadata.get("filename", "")
    if action_type == "search.query":
        text = metadata.get("query_text", "")
        if len(text) > 60:
            text = text[:60] + "\u2026"
        return f'"{text}"'
    if action_type == "code.execute":
        return metadata.get("language", "")
    if action_type == "skill.load":
        return metadata.get("skill_name", "")
    if action_type in ("thread.create", "thread.delete"):
        return "\u2014"  # em-dash
    if action_type == "settings.update":
        # Phase 30 stores {"new_settings": {"field": "value", ...}}
        new_settings = metadata.get("new_settings", {})
        if isinstance(new_settings, dict):
            return ", ".join(new_settings.keys())
        return ""
    return ""


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_audit_logs(
    since: str | None = Query(None),
    action_type: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Export all matching audit log entries as CSV (per D-05)."""
    user_id = current_user["id"]

    data_q = supabase.table("audit_log").select("id, action_type, metadata, created_at")
    data_q = _apply_filters(data_q, user_id, since, action_type)
    data_q = data_q.order("created_at", desc=True)
    data_res = data_q.execute()

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["timestamp", "action_type", "details", "metadata_json"])
    for row in data_res.data:
        meta = row.get("metadata", {}) or {}
        writer.writerow([
            row.get("created_at", ""),
            row.get("action_type", ""),
            _format_details(row.get("action_type", ""), meta),
            json.dumps(meta),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-log.csv"},
    )


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    since: str | None = Query(None),
    action_type: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated audit log entries for the current user (per D-01, D-06)."""
    user_id = current_user["id"]

    # Count query
    count_q = supabase.table("audit_log").select("id", count="exact")
    count_q = _apply_filters(count_q, user_id, since, action_type)
    count_res = count_q.execute()
    total = count_res.count if count_res.count is not None else len(count_res.data)

    # Data query
    offset = (page - 1) * page_size
    data_q = supabase.table("audit_log").select("id, action_type, metadata, created_at")
    data_q = _apply_filters(data_q, user_id, since, action_type)
    data_q = data_q.order("created_at", desc=True).range(offset, offset + page_size - 1)
    data_res = data_q.execute()

    return {
        "entries": data_res.data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
