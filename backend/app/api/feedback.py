"""User feedback endpoints — Phase 39 (FB-01–FB-03)."""
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/feedback", tags=["feedback"])

DOWNVOTE_WINDOW_DAYS = 30   # D-04: most-downvoted window consistent with Phase 37
TOP_DOWNVOTED = 5            # D-13: top-5 downvoted documents


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _window_cutoff(days: int) -> str:
    """Return ISO 8601 UTC string for (now - days)."""
    return (_now_utc() - timedelta(days=days)).isoformat()


class FeedbackRequest(BaseModel):
    message_id: UUID
    rating: str   # "positive" or "negative"
    reason: str | None = None   # one of: wrong_answer, not_from_documents, incomplete, other


@router.post("", status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Submit a thumbs-up or thumbs-down on an assistant message (D-12).

    Returns 201 on success. Returns 409 if user already rated this message (D-02).
    Rating is permanent — no update or delete endpoint exists (D-01).
    """
    user_id = current_user["id"]

    try:
        supabase.table("message_feedback").insert({
            "user_id": user_id,
            "message_id": str(body.message_id),
            "rating": body.rating,
            "reason": body.reason,
        }).execute()
    except Exception as exc:
        exc_str = str(exc).lower()
        # Supabase unique constraint violation surfaces as a 23505 Postgres error
        if "23505" in exc_str or "unique" in exc_str or "duplicate" in exc_str:
            raise HTTPException(
                status_code=409,
                detail="Feedback already submitted for this message",
            )
        raise HTTPException(status_code=502, detail="Failed to save feedback") from exc

    # D-07: fire-and-forget audit write — never await
    asyncio.create_task(write_audit_entry(
        user_id=user_id,
        action_type="feedback.submit",
        metadata={
            "message_id": str(body.message_id),
            "rating": body.rating,
            "reason": body.reason,
        },
        supabase=supabase,
    ))

    return {"status": "ok"}


@router.get("/stats")
async def get_feedback_stats(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return overall positive rate (all-time, D-03) and top-5 most-downvoted documents (last 30 days, D-04).

    Response shape (D-13):
        {
          "positive_rate": float,        # 0.0–1.0; 0.0 when no ratings
          "total_ratings": int,
          "downvoted_documents": [
            {"document_id": str, "filename": str, "folder_id": str|null, "downvote_count": int}
          ]
        }
    """
    user_id = current_user["id"]
    try:
        # ── Overall positive rate (all-time, D-03) ────────────────────────────
        all_ratings_res = (
            supabase.table("message_feedback")
            .select("rating")
            .eq("user_id", user_id)
            .execute()
        )
        all_ratings = all_ratings_res.data or []
        total_ratings = len(all_ratings)
        if total_ratings == 0:
            positive_rate = 0.0
        else:
            positive_count = sum(1 for r in all_ratings if r.get("rating") == "positive")
            positive_rate = positive_count / total_ratings

        # ── Most-downvoted documents — last 30 days (D-04, D-08–D-10) ────────
        cutoff = _window_cutoff(DOWNVOTE_WINDOW_DAYS)
        neg_res = (
            supabase.table("message_feedback")
            .select("message_id")
            .eq("user_id", user_id)
            .eq("rating", "negative")
            .gte("created_at", cutoff)
            .execute()
        )
        neg_message_ids = [r["message_id"] for r in (neg_res.data or [])]

        downvoted_documents: list[dict] = []

        if neg_message_ids:
            # Fetch source_refs for those messages (D-08: attribute to ALL cited docs)
            msgs_res = (
                supabase.table("messages")
                .select("id, source_refs")
                .in_("id", neg_message_ids)
                .eq("user_id", user_id)
                .execute()
            )

            # Python-side aggregation — same pattern as knowledge_health._fetch_low_confidence
            doc_counts: dict[str, int] = defaultdict(int)
            for row in (msgs_res.data or []):
                source_refs = row.get("source_refs") or []
                if not source_refs:
                    # D-09: skip pure-reasoning messages with no RAG attribution
                    continue
                for entry in source_refs:
                    if not isinstance(entry, dict):
                        continue
                    doc_id = entry.get("document_id")
                    if not doc_id:
                        continue
                    doc_counts[doc_id] += 1

            if doc_counts:
                sorted_doc_ids = sorted(
                    doc_counts.keys(), key=lambda d: doc_counts[d], reverse=True
                )[:TOP_DOWNVOTED]

                meta_res = (
                    supabase.table("documents")
                    .select("id, filename, folder_id")
                    .in_("id", sorted_doc_ids)
                    .eq("user_id", user_id)
                    .eq("is_latest", True)
                    .execute()
                )
                doc_map = {row["id"]: row for row in (meta_res.data or [])}
                for doc_id in sorted_doc_ids:
                    if doc_id not in doc_map:
                        continue
                    doc = doc_map[doc_id]
                    downvoted_documents.append({
                        "document_id": doc_id,
                        "filename": doc.get("filename"),
                        "folder_id": doc.get("folder_id"),
                        "downvote_count": doc_counts[doc_id],
                    })

        return {
            "positive_rate": round(positive_rate, 4),
            "total_ratings": total_ratings,
            "downvoted_documents": downvoted_documents,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Feedback stats temporarily unavailable",
        ) from exc
