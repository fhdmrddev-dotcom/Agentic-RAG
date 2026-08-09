from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langsmith import traceable
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.dependencies import get_user_pg_connection
from app.services.openai_service import embed_texts
from app.services.rerank_service import rerank
from app.utils.db import aexec

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _vector_literal(embedding: list[float]) -> str:
    """Format a float embedding as a pgvector literal (Phase 164 / RESEARCH Pitfall 3).

    The asyncpg pool registers ONLY a jsonb codec (dependencies.py:74) — there is NO
    vector codec, so a raw ``list[float]`` cannot be bound to a ``vector`` param the way
    PostgREST/``supabase.rpc`` did implicitly. Build the ``'[...]'`` literal and cast it
    at the call site (``$1::public.vector``) instead.
    """
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


async def _call_as_user(user_id: str, fn_sql: str, *args) -> list[dict]:
    """Run a retrieval RPC (or any SELECT) over the Phase-163 asyncpg user-context (D-164-02).

    Opens ``get_user_pg_connection(None, {"id": user_id})`` — the uid-synthesized
    ``request.jwt.claims`` context (``SET LOCAL ROLE authenticated`` + both GUC forms, NO
    token → no mid-run expiry, the 163 red line) — so the DEFINER bodies' nested
    ``current_user_org_ids()`` / ``auth.uid()`` resolve the CALLER's org and a spoofed
    ``match_user_id`` cannot cross orgs. Returns plain dicts so the shape is parity with the
    old ``supabase.rpc(...).data`` (uuid columns are cast ``::text`` at the call site so ids
    stay str-keyed exactly like the PostgREST JSON, keeping ``_rrf_fuse`` / enrich lookups
    byte-compatible). Fail-closed: on a service-role/owner connection ``auth.uid()`` is NULL
    → empty org set → 0 rows.
    """
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(fn_sql, *args)
    return [dict(r) for r in rows]


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
    # Phase 111.1 D-10: filter search to the CURRENTLY-configured embedding model so a
    # half-finished re-embed never compares across vector spaces (Pitfall 2). Stale-model
    # chunks are excluded — that exclusion is the graceful-dip recall reduction (D-04),
    # NOT a cross-vector-space comparison. The migration-073 backfill tagged pre-existing
    # chunks text-embedding-3-small, so default to that when no model is configured.
    current_model = (getattr(user_settings, "embedding_model", "") or "text-embedding-3-small")
    # Phase 164 (D-164-02): run the DEFINER RPC over the asyncpg user-context (NOT the
    # passed-in service-role `supabase` client — the org predicate resolves auth.uid()=caller
    # only there). Positional args map the migration-073 signature order; the embedding is a
    # pgvector literal cast `$1::public.vector` (Pitfall 3); id/document_id cast ::text so the
    # dict shape matches the old PostgREST JSON (str ids for _rrf_fuse / enrich lookups).
    return await _call_as_user(
        user_id,
        """SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, similarity
           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)""",
        _vector_literal(query_embedding),
        user_id,
        top_n,
        match_threshold,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
        current_model,
    )


async def _keyword_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    folder_ids: list[str] | None = None,
) -> list[dict]:
    # Phase 164 (D-164-02): same user-context swap as `_vector_search` — keyword_search_chunks
    # is DEFINER, so its in-body org gate only scopes the caller when auth.uid() resolves.
    # Positional args map the migration-025 signature; @@/plainto_tsquery/ts_rank_cd resolve
    # under search_path='' (pg_catalog). Returns (id, document_id, content, chunk_index, rank).
    return await _call_as_user(
        user_id,
        """SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, rank
           FROM public.keyword_search_chunks($1, $2, $3, $4, $5)""",
        query,
        user_id,
        top_n,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
    )


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
        .select("id, filename, metadata, version_number, folder_id")
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
            # Phase 098 GOV-01 — additive folder_id for the post-query ⊆ scope clip
            # (Deep-inert: Deep consumers never read it; the return shape is unchanged).
            "folder_id": doc.get("folder_id"),
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
