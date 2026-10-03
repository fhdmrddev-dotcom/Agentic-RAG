"""Retrieval ORCHESTRATOR — ``search_documents``: embed → arms → fuse → rerank → enrich.

Phase 272 (D-13) split this file. Its extraction had been owed since Phase 231 (SEED-224) and it
FIRED G-5; 272-01 took that extraction FIRST, as a pure move, before Phase 272 adds any behaviour.
What remains here is the orchestrator only — its decorator and body are byte-unchanged
(``tests/unit/test_272_pure_move.py``). Everything it composes now lives in:

* ``retrieval_rpc.py``       — ``_vector_literal``, ``_call_as_user``, ``_vector_search``, ``_keyword_search``
* ``retrieval_rank.py``      — ``_rrf_fuse``, ``_deduplicate_chunks``, ``_avg_cosine`` (pure)
* ``retrieval_documents.py`` — ``_enrich_with_filenames``, ``resolve_document_id``, ``fetch_full_document``

⛔ Filtered retrieval lands in ``retrieval_scope.py`` / ``retrieval_rpc.py`` — never back here.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langsmith import traceable
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.services.rerank_service import rerank
from app.services.retrieval_documents import _enrich_with_filenames
from app.services.retrieval_rank import _avg_cosine, _deduplicate_chunks, _rrf_fuse
from app.services.retrieval_rpc import _keyword_search, _vector_search

# ── Back-compat re-exports (Phase 272, D-13) ─────────────────────────────────────────────────
# These names moved; every measured importer still reads them from HERE, so they stay importable
# and are the SAME objects as in their new homes (pinned by test_272_pure_move::test_back_compat_names):
#   tool_dispatcher.py:47            search_documents, resolve_document_id, fetch_full_document
#   agent_loop.py:79                 _call_as_user, _vector_literal
#   checked_query_service.py:22      search_documents
#   multimodal_service.py:1011       resolve_document_id (lazy)
#   scripts/spike-097/derive_fields.py:61   search_documents
#   tests/unit/test_retrieval_service.py:13 search_documents, _enrich_with_filenames
#   tests/unit/test_271_no_embedding.py     embed_texts (its `_EMBED_SITES` hasattr fence)
# ⚠ A PATCH of one of these names HERE no longer reaches the code that calls it — patch the
#   module that now resolves it (patch-where-used).
from app.services.openai_service import embed_texts  # noqa: F401 — re-export only
from app.services.retrieval_documents import fetch_full_document, resolve_document_id  # noqa: F401
from app.services.retrieval_rpc import _call_as_user, _vector_literal  # noqa: F401

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


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
