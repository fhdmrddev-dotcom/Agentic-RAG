import logging

from langsmith import traceable
from supabase import Client

from app.config import settings
from app.services.openai_service import embed_texts
from app.services.rerank_service import rerank

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
) -> list[dict]:
    query_embedding = embed_texts([query])[0]
    params: dict = {
        "query_embedding": query_embedding,
        "match_user_id": user_id,
        "match_count": top_n,
        "match_threshold": settings.retrieval_match_threshold,
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
    docs_result = supabase.table("documents").select("id, filename").in_("id", doc_ids).execute()
    doc_map = {doc["id"]: doc["filename"] for doc in (docs_result.data or [])}
    return [
        {
            "content": row["content"],
            "document_id": row["document_id"],
            "filename": doc_map.get(row["document_id"], "Unknown"),
            "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
        }
        for row in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

@traceable(name="search-documents", run_type="retriever")
def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None = None,
) -> list[dict]:
    if not settings.hybrid_search_enabled:
        # Vector-only path (backward compatible)
        rows = _vector_search(
            query, user_id, supabase, metadata_filter, top_n=settings.retrieval_top_k
        )
        return _enrich_with_filenames(rows, supabase)

    # Hybrid path: vector + keyword → RRF fusion → optional reranking
    candidate_count = settings.hybrid_candidate_count

    vector_rows = _vector_search(query, user_id, supabase, metadata_filter, top_n=candidate_count)
    keyword_rows = _keyword_search(query, user_id, supabase, metadata_filter, top_n=candidate_count)

    if not vector_rows and not keyword_rows:
        return []

    fused = _rrf_fuse(
        vector_rows,
        keyword_rows,
        k=settings.rrf_k,
        vector_weight=settings.vector_search_weight,
        keyword_weight=settings.keyword_search_weight,
    )

    # Take top-K before reranking (keeps reranker input bounded)
    top_k = settings.retrieval_top_k
    candidates = fused[: max(top_k, settings.rerank_top_n)]

    if settings.rerank_enabled:
        candidates = rerank(query, candidates, top_n=top_k)
    else:
        candidates = candidates[:top_k]

    return _enrich_with_filenames(candidates, supabase)
