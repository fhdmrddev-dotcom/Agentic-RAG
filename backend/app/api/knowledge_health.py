"""Knowledge Health Dashboard — Backend (Phase 49, HLTH-01–HLTH-04).

Phase 163 (TEN-02) — SERVICE-ROLE, classified exception (NOT swapped to the user-JWT client).
This retrieval-analytics surface reads ``audit_log`` (the ``search.query`` events behind
most-retrieved / never-retrieved / retrieval-trend / coverage) — a table whose RLS is INSERT-only
for ``authenticated`` (mig 108 adds NO SELECT policy), so a user-JWT client would silently read
back an EMPTY audit set and the analytics would break. Like ``governance_service.py``, this is the
plan's "aggregate/analytics call that legitimately needs service-role" carve-out: every query stays
owner-scoped in app code via ``.eq("user_id", user_id)`` (D-14 belt-and-suspenders — the sole gate),
parameterized, and read-only. The messages/documents/message_feedback reads here WOULD work under
RLS, but the module is kept uniformly service-role so the surface has ONE auditable rationale rather
than a per-handler split.
"""
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

    daily: dict[str, dict] = defaultdict(
        lambda: {
            "retrieval_count": 0,
            "unique_documents": set(),
            "could_not_search": 0,
            "found_something": 0,
            "found_nothing": 0,
        }
    )

    for row in res.data:
        date_str = _parse_date(row.get("created_at") or "")
        if not date_str:
            continue
        meta = row.get("metadata") or {}
        doc_ids = meta.get("document_ids") or []
        # BE-4 (217.1 / LIB-06 / D-217.1-34): three explicit series, and `retrieval_count`'s
        # meaning is preserved BYTE-FOR-BYTE — an error row (BE-4's `retrieval_status:
        # "provider_error"` write) is EXCLUDED from retrieval_count, so a provider outage can
        # never make the shipped Coverage Trend chart RISE. It increments its own
        # `could_not_search` series instead.
        is_error = meta.get("retrieval_status") == "provider_error"
        if is_error:
            daily[date_str]["could_not_search"] += 1
        else:
            daily[date_str]["retrieval_count"] += 1
            if doc_ids:
                daily[date_str]["found_something"] += 1
            else:
                daily[date_str]["found_nothing"] += 1
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
            "could_not_search": daily[day]["could_not_search"],
            "found_something": daily[day]["found_something"],
            "found_nothing": daily[day]["found_nothing"],
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

    # ── READABILITY — the one signal that is HEALTH rather than DEMAND ────────────
    #
    # ⭐ A document that produced ZERO chunks is one the agent literally cannot see: the
    # extraction failed, or the file carried no text layer. That is a fault the PRODUCT owns
    # and a person can act on. It is true regardless of whether anyone ever searched for it.
    try:
        readable_documents, unreadable_documents = _fetch_readability(supabase, user_id)
    except _ReadabilityUnknown:
        # The surface renders "—" for None. It must NEVER render a truncated scan as health.
        readable_documents, unreadable_documents = None, None

    # ── EMBEDDING COVERAGE — an un-embedded chunk is invisible to search ──────────
    total_chunks, embedded_chunks = _fetch_embedding_coverage(supabase, user_id)

    # ── OUTCOMES BY FILE TYPE — the actionable one ────────────────────────────────
    # "PDFs fail 30% of the time" names a thing to fix. "46 documents were found" does not.
    by_type = _fetch_outcomes_by_type(supabase, user_id)

    # ── FRESHNESS TIERS — the one health signal that is genuinely THREE-valued ────
    # A binary good/bad ring on a healthy library is a filled circle: one variable drawn as
    # a donut. Age is a real gradient, and a stale document answers questions with old facts.
    freshness_tiers = _fetch_freshness_tiers(supabase, user_id, stale_days)

    # ⛔ SCORE RE-WEIGHTED 2026-09-06 (operator decision) — `coverage` WAS 40% OF THIS SCORE,
    # AND `coverage` IS DEMAND, NOT HEALTH.
    #
    # It measured `retrieved_this_month / total_documents` — i.e. what fraction of the library
    # a search happened to return in 30 days. So a perfectly ingested, perfectly fresh library
    # that nobody queried scored near ZERO, and the gauge labelled "health" reported that as
    # ill health. The visible symptom was a red 46/119 donut reading "61% of your library is
    # broken" when it meant "61% has not been needed yet".
    #
    # `readability` replaces it at the same weight: the share of documents the agent can
    # actually READ. Same shape, same range, and it can only be low for a reason the product
    # owns. Demand is still reported — as `retrieved_this_month` / `never_retrieved_count`,
    # under a USAGE heading — it simply no longer masquerades as health.
    # ⚠ When readability is unknown the score drops that term rather than substituting demand
    # again. Re-weighting the remaining three keeps the range 0-100 without inventing a value.
    if readable_documents is None:
        freshness_w, confidence_w, feedback_w = 0.50, 0.34, 0.16
        readability, readability_w = 0.0, 0.0
    else:
        freshness_w, confidence_w, feedback_w = 0.30, 0.20, 0.10
        readability, readability_w = (readable_documents / max(total_documents, 1)) * 100, 0.40
    freshness = ((total_documents - stale_count) / max(total_documents, 1)) * 100
    confidence = (avg_confidence / 0.70) * 100
    feedback = positive_rate * 100
    health_score = int(round(
        readability * readability_w
        + freshness * freshness_w
        + min(confidence, 100) * confidence_w
        + feedback * feedback_w
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
        # ── Health signals (added 2026-09-06) ─────────────────────────────────────
        "readable_documents": readable_documents,
        "unreadable_documents": unreadable_documents,
        "total_chunks": total_chunks,
        "embedded_chunks": embedded_chunks,
        "outcomes_by_type": by_type,
        "freshness_tiers": freshness_tiers,
    }


_PAGE = 1000
# 50 pages = 50,000 chunks. Beyond that this endpoint should be a SQL aggregate, not a scan.
_READABILITY_MAX_PAGES = 50


class _ReadabilityUnknown(Exception):
    """Raised when the chunk scan could not be proven exhaustive.

    ⛔ Deliberately an exception rather than a fallback number. Every "reasonable default" here
    is a claim about the library's health that nobody measured.
    """


def _fetch_freshness_tiers(supabase: Client, user_id: str, stale_days: int) -> dict:
    """Documents by age band: fresh / aging / stale.

    ⚠ `stale_days` is the SAME knob the stale chip already uses, so the ring and the chip can
    never disagree — two surfaces reading one threshold, not two thresholds.
    """
    aging_days = max(1, stale_days // 3)  # 90 -> 30, and it moves WITH the knob
    fresh_cut = _window_cutoff(aging_days)
    stale_cut = _window_cutoff(stale_days)

    def _count(**kw) -> int:
        q = (
            supabase.table("documents")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_latest", True)
        )
        if "gte" in kw:
            q = q.gte("created_at", kw["gte"])
        if "lt" in kw:
            q = q.lt("created_at", kw["lt"])
        return q.execute().count or 0

    return {
        "fresh": _count(gte=fresh_cut),
        "aging": _count(gte=stale_cut, lt=fresh_cut),
        "stale": _count(lt=stale_cut),
        "aging_days": aging_days,
        "stale_days": stale_days,
    }


def _fetch_readability(supabase: Client, user_id: str) -> tuple[int, int]:
    """Documents the agent can READ, versus those that produced no text at all.

    ⚠ A zero-chunk document is not a slow document or an unpopular one — it is one the agent
    cannot see. `document_chunks` is the ground truth: no chunk, no retrievable content.
    """
    docs = (
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )
    ids = {row["id"] for row in (docs.data or [])}
    if not ids:
        return 0, 0

    # ⛔ TWO TRAPS HERE, BOTH MEASURED ON REAL DATA (2026-09-06) — DO NOT "SIMPLIFY" THIS.
    #
    # 1. `documents.chunk_count` LOOKS like the obvious source and is WRONG. Measured: 119 rows
    #    carry `chunk_count > 0` while 121 actually have chunks — the denormalised counter has
    #    drifted on 2 documents. Using it would report 4 unreadable when there are 2, which is
    #    the same over-alarming lie this whole change exists to remove, just smaller.
    #
    # 2. PostgREST caps a select at ~1000 rows by DEFAULT. The first version of this function
    #    pulled chunk rows in `in_` batches and silently hit that cap, so most documents looked
    #    chunk-less and the ring rendered "77/119 the agent can read" against a true 121/123.
    #    A truncated read does not look truncated — it looks like bad health.
    #
    # So: page explicitly, and REFUSE TO ANSWER rather than under-report if the corpus outgrows
    # the cap. A missing number a caller can render as "—" is honest; a confidently wrong one
    # is the defect.
    with_text: set[str] = set()
    page = 0
    while page < _READABILITY_MAX_PAGES:
        start = page * _PAGE
        res = (
            supabase.table("document_chunks")
            .select("document_id")
            .eq("user_id", user_id)
            .range(start, start + _PAGE - 1)
            .execute()
        )
        rows = res.data or []
        for row in rows:
            doc_id = row.get("document_id")
            if doc_id in ids:
                with_text.add(doc_id)
        if len(rows) < _PAGE:
            break
        page += 1
    else:
        # Cap exhausted with a full last page — we cannot prove we saw every chunk.
        raise _ReadabilityUnknown()

    readable = len(with_text)
    return readable, len(ids) - readable


def _fetch_embedding_coverage(supabase: Client, user_id: str) -> tuple[int, int]:
    """Total chunks versus chunks carrying a vector.

    ⚠ An un-embedded chunk is INVISIBLE to semantic search no matter how well it was
    extracted, so this is health and not usage. It is expected to sit at 100% — a health
    dashboard SHOULD be boring when the system is well; the old donut was dramatic only
    because it measured the wrong thing.
    """
    total = (
        supabase.table("document_chunks")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    embedded = (
        supabase.table("document_chunks")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .not_.is_("embedding", "null")
        .execute()
    )
    return total.count or 0, embedded.count or 0


# Presentation-friendly names for EVERY format this library accepts. The list mirrors the
# upload hint on the Ingestion tab (PDF · DOCX · PPTX · XLSX · XLS · CSV · TXT · MD · HTML ·
# EPUB · EML · MSG · DXF · PNG · JPG · JPEG · WEBP · TIFF · BMP) — if a format can be ingested
# it can appear here, so it needs a name.
#
# ⚠ An unmapped type still falls through to its own raw subtype rather than into a bucket, so
# a NEW format shows up as itself and prompts a label rather than hiding in "Other".
_TYPE_LABEL = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.ms-excel": "Excel",
    "text/markdown": "Markdown",
    "text/plain": "Text",
    "text/csv": "CSV",
    "text/html": "HTML",
    "message/rfc822": "Email",
    "application/vnd.ms-outlook": "Outlook",
    "application/epub+zip": "EPUB",
    "application/dxf": "DXF",
    "image/vnd.dxf": "DXF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/tiff": "TIFF",
    "image/bmp": "BMP",
}


def _fetch_outcomes_by_type(supabase: Client, user_id: str) -> list[dict]:
    """Per-file-type ingestion outcomes — the most ACTIONABLE signal on the page.

    ⭐ "PDFs fail 30% of the time" names something to fix. "46 documents were found" does not.
    Sorted by volume, capped at the 8 types that carry the most documents, so one long tail
    cannot crowd out the formats that matter.
    """
    res = (
        supabase.table("documents")
        .select("mime_type, status, chunk_count")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .execute()
    )
    buckets: dict[str, dict] = {}
    for row in res.data or []:
        mime = row.get("mime_type") or "unknown"
        label = _TYPE_LABEL.get(mime, mime.split("/")[-1][:16])
        b = buckets.setdefault(
            label, {"type": label, "completed": 0, "failed": 0, "documents": 0, "chunks": 0}
        )
        b["documents"] += 1
        b["chunks"] += int(row.get("chunk_count") or 0)
        if (row.get("status") or "") == "completed":
            b["completed"] += 1
        else:
            b["failed"] += 1

    # ⛔ NO CAP. An earlier version returned only the top 8 and SILENTLY DROPPED the tail —
    # measured on real data: DXF, PNG, WebP, HTML, TIFF, JPEG, Outlook and EPUB (8 formats,
    # 14 documents) vanished from both charts with nothing saying so. A format a person
    # deliberately uploaded disappearing from "what is in my library" is the same silent
    # omission this dashboard exists to stop. The SURFACE folds a long tail into a named
    # "Other" bucket; the DATA stays complete.
    return sorted(buckets.values(), key=lambda b: b["documents"], reverse=True)


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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
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
