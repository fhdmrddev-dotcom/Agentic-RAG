"""Phase 217.1 (BE-6 / D-217.1) — the rank evaluator for checked queries.

Calls the SHIPPED ``search_documents`` path with the caller's OWN resolved ``user_settings``
(never ``None``, never a default). Finds the expected document's index and writes
``previous_rank``/``last_rank``/``checked_at``.

⚠ ``search_documents`` already wraps its blocking calls in ``run_in_threadpool``, so this
service does NOT need a second threadpool wrapper.

⚠ NOT the ``eval_runner_service.py`` shape (959 L, drives the full agent loop). This is a
tight ~40-line evaluator that calls one retrieval function.

⚠ The caller's ``user_settings`` MUST be resolved and passed. ``search_documents`` reads
``hybrid_search_enabled``, ``retrieval_top_k``, ``retrieval_match_threshold``,
``rerank_top_n`` and more from it; passing ``None`` measures a DIFFERENT retrieval
configuration than the user's actual chat.
"""
from datetime import datetime, timezone

from supabase import Client

from app.services.retrieval_service import search_documents
from app.utils.db import aexec


async def evaluate_check(
    supabase: Client,
    user_id: str,
    checked_query_id: str,
    question: str,
    expected_document_id: str,
    user_settings: dict | None,
) -> int | None:
    """Re-run retrieval for a single checked query and record the result.

    Returns the new rank (1-indexed), or ``None`` if the expected document was not found.
    """
    # Re-run the shipped retrieval path with the caller's real settings.
    hits, _avg_sim = await search_documents(
        question,
        user_id,
        supabase,
        user_settings=user_settings,
    )

    # Find the FIRST occurrence of the expected document (best rank).
    rank = next(
        (i + 1 for i, h in enumerate(hits) if h.get("document_id") == expected_document_id),
        None,
    )

    # Read the current last_rank so we can rotate it to previous_rank.
    current = await aexec(
        supabase.table("checked_queries")
        .select("last_rank")
        .eq("id", checked_query_id)
        .eq("user_id", user_id)
        .limit(1)
    )
    current_rank: int | None = current.data[0]["last_rank"] if current.data else None

    # Write previous_rank/last_rank/checked_at in one update.
    now = datetime.now(timezone.utc).isoformat()
    await aexec(
        supabase.table("checked_queries")
        .update({
            "previous_rank": current_rank,
            "last_rank": rank,
            "checked_at": now,
        })
        .eq("id", checked_query_id)
        .eq("user_id", user_id)
    )

    return rank