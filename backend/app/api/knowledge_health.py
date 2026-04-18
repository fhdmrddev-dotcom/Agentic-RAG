"""Knowledge Health Dashboard — Backend (Phase 37, HLTH-01–HLTH-04)."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/knowledge-health", tags=["knowledge-health"])

TOP_N = 10
LOW_CONF_THRESHOLD = 0.40   # D-02: avg similarity below this = low-confidence
WINDOW_DAYS = 30             # D-07: most-retrieved and low-confidence window


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _window_cutoff(days: int) -> str:
    """Return ISO 8601 UTC string for (now - days)."""
    return (_now_utc() - timedelta(days=days)).isoformat()


# ── Metric helpers ────────────────────────────────────────────────────────────

def _fetch_most_retrieved(supabase: Client, user_id: str) -> list[dict]:
    """Return top-N documents by retrieval count in the last WINDOW_DAYS (D-01, D-07, D-11)."""
    res = (
        supabase.table("audit_log")
        .select("metadata, created_at")
        .eq("user_id", user_id)
        .eq("action_type", "search.query")
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )

    counts: dict[str, int] = defaultdict(int)
    last_retrieved: dict[str, str] = {}

    for row in res.data:
        meta = row.get("metadata") or {}
        doc_ids = meta.get("document_ids") or []
        for doc_id in doc_ids:
            counts[doc_id] += 1
            created_at = row.get("created_at") or ""
            if doc_id not in last_retrieved or created_at > last_retrieved[doc_id]:
                last_retrieved[doc_id] = created_at

    if not counts:
        return []

    sorted_ids = sorted(counts.keys(), key=lambda d: counts[d], reverse=True)[:TOP_N]

    meta_res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .in_("id", sorted_ids)
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )

    doc_map = {row["id"]: row for row in meta_res.data}
    results = []
    for doc_id in sorted_ids:
        if doc_id not in doc_map:
            continue
        doc = doc_map[doc_id]
        results.append({
            "document_id": doc_id,
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": doc.get("created_at"),
            "file_size": doc.get("file_size"),
            "retrieval_count": counts[doc_id],
            "last_retrieved_at": last_retrieved.get(doc_id),
        })

    results.sort(key=lambda x: x["retrieval_count"], reverse=True)
    return results


def _fetch_never_retrieved(supabase: Client, user_id: str) -> list[dict]:
    """Return up to TOP_N active documents never referenced in any search.query audit entry (D-08, D-11)."""
    docs_res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )

    audit_res = (
        supabase.table("audit_log")
        .select("metadata")
        .eq("user_id", user_id)
        .eq("action_type", "search.query")
        .execute()
    )

    retrieved_set: set[str] = set()
    for row in audit_res.data:
        meta = row.get("metadata") or {}
        for doc_id in (meta.get("document_ids") or []):
            retrieved_set.add(doc_id)

    results = []
    for doc in docs_res.data:
        if doc["id"] not in retrieved_set:
            results.append({
                "document_id": doc["id"],
                "filename": doc.get("filename"),
                "folder_id": doc.get("folder_id"),
                "created_at": doc.get("created_at"),
                "file_size": doc.get("file_size"),
            })
        if len(results) >= TOP_N:
            break

    return results


def _fetch_low_confidence(supabase: Client, user_id: str) -> list[dict]:
    """Return top-N documents with avg similarity < LOW_CONF_THRESHOLD in last WINDOW_DAYS (D-01–D-03, D-11)."""
    res = (
        supabase.table("messages")
        .select("source_refs, confidence_avg_similarity")
        .eq("user_id", user_id)
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )

    doc_scores: dict[str, list[float]] = defaultdict(list)

    for row in res.data:
        source_refs = row.get("source_refs") or []
        row_similarity = row.get("confidence_avg_similarity") or 0.0
        for entry in source_refs:
            if not isinstance(entry, dict):
                continue
            doc_id = entry.get("document_id")
            if not doc_id:
                continue
            score = entry.get("avg_similarity")
            if score is None:
                score = row_similarity
            doc_scores[doc_id].append(float(score))

    if not doc_scores:
        return []

    avg_scores = {
        doc_id: sum(scores) / len(scores)
        for doc_id, scores in doc_scores.items()
    }

    low_conf_ids = [
        doc_id for doc_id, avg in avg_scores.items()
        if avg < LOW_CONF_THRESHOLD
    ]

    if not low_conf_ids:
        return []

    low_conf_ids.sort(key=lambda d: avg_scores[d])
    top_ids = low_conf_ids[:TOP_N]

    meta_res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .in_("id", top_ids)
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )

    doc_map = {row["id"]: row for row in meta_res.data}
    results = []
    for doc_id in top_ids:
        if doc_id not in doc_map:
            continue
        doc = doc_map[doc_id]
        results.append({
            "document_id": doc_id,
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": doc.get("created_at"),
            "file_size": doc.get("file_size"),
            "avg_similarity": avg_scores[doc_id],
        })

    return results


def _fetch_stale(supabase: Client, user_id: str, stale_days: int) -> list[dict]:
    """Return top-N active documents whose created_at is older than stale_days (D-04, D-05, D-11)."""
    cutoff = _window_cutoff(stale_days)

    res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .lt("created_at", cutoff)
        .execute()
    )

    now = _now_utc()
    results = []
    for doc in res.data:
        created_at_str = doc.get("created_at") or ""
        try:
            created_at_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            days_stale = (now - created_at_dt).days
        except (ValueError, TypeError):
            days_stale = 0
        results.append({
            "document_id": doc["id"],
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": created_at_str,
            "file_size": doc.get("file_size"),
            "days_stale": days_stale,
        })

    results.sort(key=lambda x: x["days_stale"], reverse=True)
    return results[:TOP_N]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/summary")
async def knowledge_health_summary(
    stale_days: int = Query(90, ge=1, le=3650),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return four library health metric arrays (D-09)."""
    user_id = current_user["id"]
    return {
        "most_retrieved": _fetch_most_retrieved(supabase, user_id),
        "never_retrieved": _fetch_never_retrieved(supabase, user_id),
        "low_confidence": _fetch_low_confidence(supabase, user_id),
        "stale": _fetch_stale(supabase, user_id, stale_days),
    }
