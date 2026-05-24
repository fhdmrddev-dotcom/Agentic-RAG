"""Knowledge Health Dashboard — Backend (Phase 49, HLTH-01–HLTH-04)."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/knowledge-health", tags=["knowledge-health"])

TOP_N = 10
LOW_CONF_THRESHOLD = 0.38   # D-02: avg similarity below this = low-confidence (Phase 076 aligned)
HIGH_CONF_THRESHOLD = 0.54  # similarity at or above this = "matched well" (Phase 076 aligned)
WINDOW_DAYS = 30             # D-07: most-retrieved and low-confidence window
DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _window_cutoff(days: int) -> str:
    """Return ISO 8601 UTC string for (now - days)."""
    return (_now_utc() - timedelta(days=days)).isoformat()


def _parse_date(dt_str: str) -> str:
    """Parse an ISO datetime string and return YYYY-MM-DD."""
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except (ValueError, TypeError):
        return ""


# ── Paginated metric helpers ──────────────────────────────────────────────────

def _fetch_most_retrieved(supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT) -> dict:
    """Return paginated documents by retrieval count in the last WINDOW_DAYS."""
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

    total = len(counts)
    if not counts:
        return {"items": [], "total": 0, "offset": offset, "limit": limit}

    sorted_ids = sorted(counts.keys(), key=lambda d: counts[d], reverse=True)
    page_ids = sorted_ids[offset:offset + limit]

    meta_res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .in_("id", page_ids)
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )

    doc_map = {row["id"]: row for row in meta_res.data}
    items = []
    for doc_id in page_ids:
        if doc_id not in doc_map:
            continue
        doc = doc_map[doc_id]
        items.append({
            "document_id": doc_id,
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": doc.get("created_at"),
            "file_size": doc.get("file_size"),
            "retrieval_count": counts[doc_id],
            "last_retrieved_at": last_retrieved.get(doc_id),
        })

    items.sort(key=lambda x: x["retrieval_count"], reverse=True)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


def _fetch_never_retrieved(supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT) -> dict:
    """Return paginated active documents never referenced in any search.query audit entry."""
    # Fetch retrieved document IDs; cap at 1000 to stay within Supabase .in_() limits.
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
            if len(retrieved_set) >= 1000:
                break
        if len(retrieved_set) >= 1000:
            break

    query = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size", count="exact")
        .eq("user_id", user_id)
        .eq("is_latest", True)
    )

    if retrieved_set:
        query = query.not_.in_("id", list(retrieved_set))

    res = query.range(offset, offset + limit - 1).execute()

    items = []
    for doc in res.data:
        items.append({
            "document_id": doc["id"],
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": doc.get("created_at"),
            "file_size": doc.get("file_size"),
        })

    return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}


def _fetch_low_confidence_documents(supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT) -> dict:
    """Return paginated documents with avg similarity < LOW_CONF_THRESHOLD in last WINDOW_DAYS."""
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
        return {"items": [], "total": 0, "offset": offset, "limit": limit}

    avg_scores = {
        doc_id: sum(scores) / len(scores)
        for doc_id, scores in doc_scores.items()
    }

    low_conf_ids = [
        doc_id for doc_id, avg in avg_scores.items()
        if avg < LOW_CONF_THRESHOLD
    ]

    if not low_conf_ids:
        return {"items": [], "total": 0, "offset": offset, "limit": limit}

    low_conf_ids.sort(key=lambda d: avg_scores[d])
    total = len(low_conf_ids)
    page_ids = low_conf_ids[offset:offset + limit]

    meta_res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size")
        .in_("id", page_ids)
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )

    doc_map = {row["id"]: row for row in meta_res.data}
    items = []
    for doc_id in page_ids:
        if doc_id not in doc_map:
            continue
        doc = doc_map[doc_id]
        items.append({
            "document_id": doc_id,
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": doc.get("created_at"),
            "file_size": doc.get("file_size"),
            "avg_similarity": avg_scores[doc_id],
        })

    return {"items": items, "total": total, "offset": offset, "limit": limit}


def _fetch_low_confidence_queries(supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT) -> dict:
    """Return paginated query-level low-confidence analysis."""
    # Fetch assistant messages with low confidence in the window that have source_refs
    assistant_res = (
        supabase.table("messages")
        .select("id, thread_id, content, confidence_avg_similarity, created_at, source_refs")
        .eq("user_id", user_id)
        .eq("role", "assistant")
        .lt("confidence_avg_similarity", LOW_CONF_THRESHOLD)
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )

    # Filter out empty source_refs in Python (PostgREST cannot easily check JSONB array length)
    assistant_rows = [
        row for row in assistant_res.data
        if row.get("source_refs")
    ]

    if not assistant_rows:
        return {"items": [], "total": 0, "offset": offset, "limit": limit}

    # Group by thread_id to minimize follow-up queries
    thread_ids = list({row["thread_id"] for row in assistant_rows})

    user_messages_res = (
        supabase.table("messages")
        .select("thread_id, content, created_at")
        .eq("user_id", user_id)
        .eq("role", "user")
        .in_("thread_id", thread_ids)
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )

    # Build per-thread user message lists sorted by created_at
    thread_user_msgs: dict[str, list[dict]] = defaultdict(list)
    for row in user_messages_res.data:
        thread_user_msgs[row["thread_id"]].append(row)

    for msgs in thread_user_msgs.values():
        msgs.sort(key=lambda m: m["created_at"])

    # Match each assistant message to its most recent preceding user message
    query_groups: dict[str, dict] = {}
    for assistant in assistant_rows:
        thread_id = assistant["thread_id"]
        user_msgs = thread_user_msgs.get(thread_id, [])
        query_text = None
        for um in reversed(user_msgs):
            if um["created_at"] <= assistant["created_at"]:
                query_text = um["content"]
                break

        if not query_text:
            query_text = assistant.get("content", "")[:200] or "[unknown query]"

        similarity = assistant.get("confidence_avg_similarity") or 0.0
        source_refs = assistant.get("source_refs") or []
        doc_count = len(source_refs)

        if query_text not in query_groups:
            query_groups[query_text] = {
                "query_text": query_text,
                "similarities": [],
                "occurrence_count": 0,
                "document_count": 0,
            }

        group = query_groups[query_text]
        group["similarities"].append(float(similarity))
        group["occurrence_count"] += 1
        group["document_count"] = max(group["document_count"], doc_count)

    # Build final items with averages
    items = []
    for group in query_groups.values():
        items.append({
            "query_text": group["query_text"],
            "avg_similarity": round(sum(group["similarities"]) / len(group["similarities"]), 3),
            "occurrence_count": group["occurrence_count"],
            "document_count": group["document_count"],
        })

    # Sort by occurrence_count desc, then by avg_similarity asc
    items.sort(key=lambda x: (-x["occurrence_count"], x["avg_similarity"]))
    total = len(items)
    paginated_items = items[offset:offset + limit]

    return {
        "items": paginated_items,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


def _fetch_stale(supabase: Client, user_id: str, stale_days: int, offset: int = 0, limit: int = DEFAULT_LIMIT) -> dict:
    """Return paginated active documents older than stale_days."""
    cutoff = _window_cutoff(stale_days)

    res = (
        supabase.table("documents")
        .select("id, filename, folder_id, created_at, file_size", count="exact")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .lt("created_at", cutoff)
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )

    now = _now_utc()
    items = []
    for doc in res.data:
        created_at_str = doc.get("created_at") or ""
        try:
            created_at_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            days_stale = (now - created_at_dt).days
        except (ValueError, TypeError):
            days_stale = 0
        items.append({
            "document_id": doc["id"],
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "created_at": created_at_str,
            "file_size": doc.get("file_size"),
            "days_stale": days_stale,
        })

    return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}


def _fetch_retrieval_trend(supabase: Client, user_id: str, days: int) -> list[dict]:
    """Return daily retrieval counts and unique documents for the last N days."""
    res = (
        supabase.table("audit_log")
        .select("metadata, created_at")
        .eq("user_id", user_id)
        .eq("action_type", "search.query")
        .gte("created_at", _window_cutoff(days))
        .execute()
    )

    daily: dict[str, dict] = defaultdict(lambda: {"retrieval_count": 0, "unique_documents": set()})

    for row in res.data:
        date_str = _parse_date(row.get("created_at") or "")
        if not date_str:
            continue
        meta = row.get("metadata") or {}
        doc_ids = meta.get("document_ids") or []
        daily[date_str]["retrieval_count"] += 1
        for doc_id in doc_ids:
            daily[date_str]["unique_documents"].add(doc_id)

    # Ensure every day in the window is present (zero-fill)
    result = []
    for i in range(days):
        day = (_now_utc() - timedelta(days=days - 1 - i)).date().isoformat()
        result.append({
            "date": day,
            "retrieval_count": daily[day]["retrieval_count"],
            "unique_documents": len(daily[day]["unique_documents"]),
        })

    return result


def _fetch_overview_metrics(supabase: Client, user_id: str, stale_days: int) -> dict:
    """Calculate aggregate KPIs and health score (0-100).

    Health score formula:
        coverage   = (retrieved_this_month / total) * 100
        freshness  = ((total - stale) / total) * 100
        confidence = (avg_confidence / 0.70) * 100
        feedback   = positive_rate * 100   (default 50 if no feedback)
        health_score = coverage*0.40 + freshness*0.30 + min(confidence,100)*0.20 + feedback*0.10
    """
    # Total documents
    total_res = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )
    total_documents = total_res.count or 0

    # Retrieved this month (unique docs from audit_log in 30 days)
    audit_res = (
        supabase.table("audit_log")
        .select("metadata")
        .eq("user_id", user_id)
        .eq("action_type", "search.query")
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )
    retrieved_ids: set[str] = set()
    for row in audit_res.data:
        meta = row.get("metadata") or {}
        for doc_id in (meta.get("document_ids") or []):
            retrieved_ids.add(doc_id)
    retrieved_this_month = len(retrieved_ids)

    # Never retrieved count (SQL-level)
    audit_all_res = (
        supabase.table("audit_log")
        .select("metadata")
        .eq("user_id", user_id)
        .eq("action_type", "search.query")
        .execute()
    )
    all_retrieved: set[str] = set()
    for row in audit_all_res.data:
        meta = row.get("metadata") or {}
        for doc_id in (meta.get("document_ids") or []):
            all_retrieved.add(doc_id)
            if len(all_retrieved) >= 1000:
                break
        if len(all_retrieved) >= 1000:
            break

    never_query = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_latest", True)
    )
    if all_retrieved:
        never_query = never_query.not_.in_("id", list(all_retrieved))
    never_res = never_query.execute()
    never_retrieved_count = never_res.count or 0

    # Stale count
    stale_cutoff = _window_cutoff(stale_days)
    stale_res = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .lt("created_at", stale_cutoff)
        .execute()
    )
    stale_count = stale_res.count or 0

    # Low confidence queries count
    lc_res = (
        supabase.table("messages")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("role", "assistant")
        .lt("confidence_avg_similarity", LOW_CONF_THRESHOLD)
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )
    low_confidence_queries_count = lc_res.count or 0

    # Coverage percent
    coverage_percent = round((retrieved_this_month / max(total_documents, 1)) * 100, 1)

    # Average confidence — only for assistant messages that performed RAG retrieval
    # (have source_refs). Non-RAG messages (chitchat, tool calls without retrieval)
    # have confidence_avg_similarity = 0 and must not drag down the average.
    conf_res = (
        supabase.table("messages")
        .select("confidence_avg_similarity, source_refs")
        .eq("user_id", user_id)
        .eq("role", "assistant")
        .gte("created_at", _window_cutoff(WINDOW_DAYS))
        .execute()
    )
    conf_values = [
        row.get("confidence_avg_similarity") or 0.0
        for row in conf_res.data
        if row.get("source_refs") and row.get("confidence_avg_similarity") is not None
    ]
    avg_confidence = round(sum(conf_values) / max(len(conf_values), 1), 2)
    high_confidence_rate = round(
        sum(1 for v in conf_values if v >= HIGH_CONF_THRESHOLD) / max(len(conf_values), 1), 2
    )

    # Feedback positive rate
    feedback_res = (
        supabase.table("message_feedback")
        .select("rating")
        .eq("user_id", user_id)
        .execute()
    )
    if feedback_res.data:
        positive = sum(1 for row in feedback_res.data if row.get("rating") == "positive")
        positive_rate = positive / len(feedback_res.data)
    else:
        positive_rate = 0.5  # default 50% when no feedback

    coverage = (retrieved_this_month / max(total_documents, 1)) * 100
    freshness = ((total_documents - stale_count) / max(total_documents, 1)) * 100
    confidence = (avg_confidence / 0.70) * 100
    feedback = positive_rate * 100
    health_score = int(round(
        coverage * 0.40 + freshness * 0.30 + min(confidence, 100) * 0.20 + feedback * 0.10
    ))

    return {
        "health_score": max(0, min(100, health_score)),
        "total_documents": total_documents,
        "retrieved_this_month": retrieved_this_month,
        "never_retrieved_count": never_retrieved_count,
        "stale_count": stale_count,
        "low_confidence_queries_count": low_confidence_queries_count,
        "coverage_percent": coverage_percent,
        "avg_confidence": avg_confidence,
        "high_confidence_rate": high_confidence_rate,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _pagination_params(
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> tuple[int, int]:
    return offset, limit


@router.get("/overview")
async def knowledge_health_overview(
    stale_days: int = Query(90, ge=1, le=3650),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return aggregate KPIs + health score (0-100)."""
    user_id = current_user["id"]
    try:
        return _fetch_overview_metrics(supabase, user_id, stale_days)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/most-retrieved")
async def knowledge_health_most_retrieved(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated most-retrieved documents."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_most_retrieved(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/never-retrieved")
async def knowledge_health_never_retrieved(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated never-retrieved documents (SQL-level filter)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_never_retrieved(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/stale")
async def knowledge_health_stale(
    stale_days: int = Query(90, ge=1, le=3650),
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated stale documents."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_stale(supabase, user_id, stale_days, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/low-confidence/documents")
async def knowledge_health_low_confidence_documents(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated document-level low confidence (backward compatible behaviour)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_low_confidence_documents(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/low-confidence/queries")
async def knowledge_health_low_confidence_queries(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated query-level low-confidence analysis."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_low_confidence_queries(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/retrieval-trend")
async def knowledge_health_retrieval_trend(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return daily retrieval counts for line chart."""
    user_id = current_user["id"]
    try:
        return _fetch_retrieval_trend(supabase, user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc


@router.get("/summary")
async def knowledge_health_summary(
    stale_days: int = Query(90, ge=1, le=3650),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return four library health metric arrays (DEPRECATED — use paginated endpoints)."""
    user_id = current_user["id"]
    try:
        most_retrieved = _fetch_most_retrieved(supabase, user_id, 0, TOP_N)["items"]
        never_retrieved = _fetch_never_retrieved(supabase, user_id, 0, TOP_N)["items"]
        low_confidence = _fetch_low_confidence_documents(supabase, user_id, 0, TOP_N)["items"]
        stale = _fetch_stale(supabase, user_id, stale_days, 0, TOP_N)["items"]

        total_res = (
            supabase.table("documents")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_latest", True)
            .execute()
        )

        return {
            "total_documents": total_res.count or 0,
            "most_retrieved": most_retrieved,
            "never_retrieved": never_retrieved,
            "low_confidence": low_confidence,
            "stale": stale,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc
