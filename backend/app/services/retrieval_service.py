from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langsmith import traceable
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.services.openai_service import embed_texts
from app.services.rerank_service import rerank
from app.utils.db import aexec

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _vector_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    match_threshold: float,
    user_settings: UserEffectiveSettings | None,
    folder_ids: list[str] | None = None,
) -> list[dict]:
    # SEED-065: embed_texts is a SYNC OpenAI HTTP call. Running it directly on the
    # event loop froze ALL request serving for the embedding round-trip — under a
    # search-heavy llm_batch_agents fan-out (N concurrent sub-agents) that stacked
    # into multi-second idle-request stalls (conc_probe cross_tab_latency p95=2.6s,
    # threadpool only 6/200 = blocking, not starvation). Wrap in run_in_threadpool
    # so the blocking HTTP call leaves the loop (the D-v2.5-01 pattern; supersedes
    # the D-058-01 deferral that scoped 058 to Supabase only). Behavior identical.
    query_embedding = (
        await run_in_threadpool(embed_texts, [query], user_settings=user_settings)
    )[0]
    params: dict = {
        "query_embedding": query_embedding,
        "match_user_id": user_id,
        "match_count": top_n,
        "match_threshold": match_threshold,
    }
    if metadata_filter:
        params["metadata_filter"] = metadata_filter
    if folder_ids:
        params["p_folder_ids"] = folder_ids

    result = await aexec(supabase.rpc("match_document_chunks", params))
    return result.data or []


async def _keyword_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    folder_ids: list[str] | None = None,
) -> list[dict]:
    params: dict = {
        "search_query": query,
        "match_user_id": user_id,
        "match_count": top_n,
    }
    if metadata_filter:
        params["metadata_filter"] = metadata_filter
    if folder_ids:
        params["p_folder_ids"] = folder_ids

    result = await aexec(supabase.rpc("keyword_search_chunks", params))
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


async def _enrich_with_filenames(rows: list[dict], supabase: Client) -> list[dict]:
    if not rows:
        return []
    doc_ids = list({row["document_id"] for row in rows})
    docs_result = await aexec(
        supabase.table("documents")
        .select("id, filename, metadata, version_number")
        .in_("id", doc_ids)
    )
    doc_map = {doc["id"]: doc for doc in (docs_result.data or [])}
    enriched = []
    for row in rows:
        doc = doc_map.get(row["document_id"], {})
        entry: dict = {
            "content": row["content"],
            "document_id": row["document_id"],
            "filename": doc.get("filename", "Unknown"),
            "chunk_index": row.get("chunk_index"),
            "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
            "version_number": doc.get("version_number", 1),
        }
        if doc.get("metadata"):
            entry["metadata"] = doc["metadata"]
        enriched.append(entry)
    return enriched


def _deduplicate_chunks(rows: list[dict], text_overlap_threshold: float = 0.85) -> list[dict]:
    """Remove near-duplicate chunks from a ranked result list.

    Two chunks are considered duplicates when their word-set Jaccard similarity
    exceeds *text_overlap_threshold* (default 0.85). The higher-scoring chunk is
    kept. This is a safety net against the old chunking algorithm producing
    near-identical overlapping chunks and, after the fix, against any edge cases
    in very repetitive documents.
    """
    kept: list[dict] = []
    for candidate in rows:
        words_c = set(candidate["content"].lower().split())
        is_dup = False
        for existing in kept:
            words_e = set(existing["content"].lower().split())
            union = words_c | words_e
            if not union:
                continue
            jaccard = len(words_c & words_e) / len(union)
            if jaccard >= text_overlap_threshold:
                is_dup = True
                break
        if not is_dup:
            kept.append(candidate)
    return kept


def _avg_cosine(rows: list[dict]) -> float:
    """Average cosine similarity from vector search rows. Returns 0.0 if no rows."""
    sims = [row["similarity"] for row in rows if row.get("similarity") and row["similarity"] > 0]
    return sum(sims) / len(sims) if sims else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_document_id(filename: str, user_id: str, supabase: Client) -> str | None:
    """Case-insensitive filename lookup for a user's document (latest version only). Tries exact match then partial match."""
    # Exact case-insensitive match — only resolve to the latest version
    result = await aexec(
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .ilike("filename", filename)
        .limit(1)
    )
    if result.data:
        return result.data[0]["id"]
    # Partial match (allows approximate filenames like "Elitefooty PRD")
    result = await aexec(
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_latest", True)
        .ilike("filename", f"%{filename}%")
        .limit(1)
    )
    if result.data:
        return result.data[0]["id"]
    return None


async def fetch_full_document(document_id: str, user_id: str, supabase: Client) -> dict | None:
    """Fetch complete document content for the analyze_document sub-agent.

    Prefers `full_markdown` (the raw extracted text stored at ingest time) over
    concatenating chunks. Chunks now have context-enriched embeddings but store
    raw content, so either path produces clean text — but `full_markdown` avoids
    any repeated context headers if the chunk storage format ever changes.
    """
    doc_result = await aexec(
        supabase.table("documents")
        .select("id, filename, metadata, version_number, full_markdown")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
    )
    if not doc_result.data:
        return None

    doc = doc_result.data

    # Use full_markdown when available (set during ingestion from the raw extracted text)
    full_text = doc.get("full_markdown") or ""
    if not full_text:
        # Fallback: reassemble from chunks (documents ingested before full_markdown was stored)
        chunks_result = await aexec(
            supabase.table("document_chunks")
            .select("content")
            .eq("document_id", document_id)
            .order("chunk_index")
        )
        full_text = "\n\n".join(c["content"] for c in (chunks_result.data or []))

    return {
        "document_id": doc["id"],
        "filename": doc["filename"],
        "metadata": doc.get("metadata"),
        "content": full_text,
    }


@traceable(name="search-documents", run_type="retriever")
async def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None = None,
    user_settings: UserEffectiveSettings | None = None,
    folder_ids: list[str] | None = None,
) -> tuple[list[dict], float]:
    # Normalize metadata_filter values to lowercase for case-insensitive matching
    if metadata_filter:
        metadata_filter = {k: v.lower() if isinstance(v, str) else v for k, v in metadata_filter.items()}

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
        # Vector-only path — fetch 2x top_k so dedup has candidates to spare
        rows = await _vector_search(
            query, user_id, supabase, metadata_filter,
            top_n=top_k * 2, match_threshold=match_threshold,
            user_settings=user_settings,
            folder_ids=folder_ids,
        )
        avg_sim = _avg_cosine(rows)
        rows = _deduplicate_chunks(rows)[:top_k]
        return await _enrich_with_filenames(rows, supabase), avg_sim

    # Hybrid path: vector + keyword → RRF fusion → dedup → optional reranking
    vector_rows = await _vector_search(
        query, user_id, supabase, metadata_filter,
        top_n=candidate_count, match_threshold=match_threshold,
        user_settings=user_settings,
        folder_ids=folder_ids,
    )
    keyword_rows = await _keyword_search(query, user_id, supabase, metadata_filter, top_n=candidate_count, folder_ids=folder_ids)

    if not vector_rows and not keyword_rows:
        return [], 0.0

    avg_sim = _avg_cosine(vector_rows)

    fused = _rrf_fuse(
        vector_rows, keyword_rows,
        k=rrf_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    # Deduplicate before reranking so duplicate slots don't waste the reranker budget
    fused = _deduplicate_chunks(fused)

    # Take top-K before reranking
    candidates = fused[: max(top_k, rerank_top_n)]

    rerank_enabled = user_settings.rerank_enabled if user_settings else settings.rerank_enabled
    if rerank_enabled:
        # SEED-065: rerank is a SYNC Cohere-HTTP / local-ML call — same event-loop
        # blocking class as the embed above. Off by default, but when enabled it
        # compounds the stall, so wrap it in run_in_threadpool too (D-v2.5-01).
        candidates = await run_in_threadpool(
            rerank, query, candidates, top_n=top_k, user_settings=user_settings
        )
    else:
        candidates = candidates[:top_k]

    return await _enrich_with_filenames(candidates, supabase), avg_sim
