from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langsmith import traceable
from supabase import Client

from app.config import settings
from app.services.openai_service import embed_texts
from app.services.rerank_service import rerank

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _vector_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    match_threshold: float,
    user_settings: UserEffectiveSettings | None,
) -> list[dict]:
    query_embedding = embed_texts([query], user_settings=user_settings)[0]
    params: dict = {
        "query_embedding": query_embedding,
        "match_user_id": user_id,
        "match_count": top_n,
        "match_threshold": match_threshold,
    }
    if metadata_filter:
        params["metadata_filter"] = metadata_filter

    result = supabase.rpc("match_document_chunks", params).execute()
    return result.data or []


def _keyword_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
) -> list[dict]:
    params: dict = {
        "search_query": query,
        "match_user_id": user_id,
        "match_count": top_n,
    }
    if metadata_filter:
        params["metadata_filter"] = metadata_filter

    result = supabase.rpc("keyword_search_chunks", params).execute()
    return result.data or []


def _rrf_fuse(
    vector_results: list[dict],
    keyword_results: list[dict],
    k: int = 60,
    vector_weight: float = 1.0,
    keyword_weight: float = 1.0,
) -> list[dict]:
    """Reciprocal Rank Fusion: score(d) = Σ weight/(k + rank_i(d))"""
    scores: dict[str, float] = {}
    docs: dict[str, dict] = {}

    for rank, row in enumerate(vector_results):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + vector_weight / (k + rank + 1)
        docs[chunk_id] = row

    for rank, row in enumerate(keyword_results):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + keyword_weight / (k + rank + 1)
        if chunk_id not in docs:
            docs[chunk_id] = row

    fused = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)
    result = []
    for chunk_id in fused:
        doc = dict(docs[chunk_id])
        doc["rrf_score"] = scores[chunk_id]
        result.append(doc)
    return result


def _enrich_with_filenames(rows: list[dict], supabase: Client) -> list[dict]:
    if not rows:
        return []
    doc_ids = list({row["document_id"] for row in rows})
    docs_result = supabase.table("documents").select("id, filename, metadata").in_("id", doc_ids).execute()
    doc_map = {doc["id"]: doc for doc in (docs_result.data or [])}
    enriched = []
    for row in rows:
        doc = doc_map.get(row["document_id"], {})
        entry: dict = {
            "content": row["content"],
            "document_id": row["document_id"],
            "filename": doc.get("filename", "Unknown"),
            "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
        }
        if doc.get("metadata"):
            entry["metadata"] = doc["metadata"]
        enriched.append(entry)
    return enriched


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def resolve_document_id(filename: str, user_id: str, supabase: Client) -> str | None:
    """Case-insensitive filename lookup for a user's document. Tries exact match then partial match."""
    # Exact case-insensitive match
    result = (
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .ilike("filename", filename)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]
    # Partial match (allows approximate filenames like "Elitefooty PRD")
    result = (
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .ilike("filename", f"%{filename}%")
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]
    return None


def fetch_full_document(document_id: str, user_id: str, supabase: Client) -> dict | None:
    """Fetch complete document content by concatenating all ordered chunks."""
    doc_result = (
        supabase.table("documents")
        .select("id, filename, metadata")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not doc_result.data:
        return None

    doc = doc_result.data
    chunks_result = (
        supabase.table("document_chunks")
        .select("content")
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    chunks = chunks_result.data or []
    full_text = "\n\n".join(c["content"] for c in chunks)
    return {
        "document_id": doc["id"],
        "filename": doc["filename"],
        "metadata": doc.get("metadata"),
        "content": full_text,
    }


@traceable(name="search-documents", run_type="retriever")
def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None = None,
    user_settings: UserEffectiveSettings | None = None,
) -> list[dict]:
    # Resolve effective config values
    hybrid_enabled = user_settings.hybrid_search_enabled if user_settings else settings.hybrid_search_enabled
    top_k = user_settings.retrieval_top_k if user_settings else settings.retrieval_top_k
    match_threshold = user_settings.retrieval_match_threshold if user_settings else settings.retrieval_match_threshold
    candidate_count = user_settings.hybrid_candidate_count if user_settings else settings.hybrid_candidate_count
    rrf_k = user_settings.rrf_k if user_settings else settings.rrf_k
    vector_weight = user_settings.vector_search_weight if user_settings else settings.vector_search_weight
    keyword_weight = user_settings.keyword_search_weight if user_settings else settings.keyword_search_weight
    rerank_top_n = user_settings.rerank_top_n if user_settings else settings.rerank_top_n

    if not hybrid_enabled:
        # Vector-only path
        rows = _vector_search(
            query, user_id, supabase, metadata_filter,
            top_n=top_k, match_threshold=match_threshold,
            user_settings=user_settings,
        )
        return _enrich_with_filenames(rows, supabase)

    # Hybrid path: vector + keyword → RRF fusion → optional reranking
    vector_rows = _vector_search(
        query, user_id, supabase, metadata_filter,
        top_n=candidate_count, match_threshold=match_threshold,
        user_settings=user_settings,
    )
    keyword_rows = _keyword_search(query, user_id, supabase, metadata_filter, top_n=candidate_count)

    if not vector_rows and not keyword_rows:
        return []

    fused = _rrf_fuse(
        vector_rows, keyword_rows,
        k=rrf_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    # Take top-K before reranking
    candidates = fused[: max(top_k, rerank_top_n)]

    rerank_enabled = user_settings.rerank_enabled if user_settings else settings.rerank_enabled
    if rerank_enabled:
        candidates = rerank(query, candidates, top_n=top_k, user_settings=user_settings)
    else:
        candidates = candidates[:top_k]

    return _enrich_with_filenames(candidates, supabase)
