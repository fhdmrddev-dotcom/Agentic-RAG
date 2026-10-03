"""Retrieval ORCHESTRATOR — ``search_documents``: embed → arms → fuse → rerank → enrich.

Phase 272 (D-13) split this file. Its extraction had been owed since Phase 231 (SEED-224) and it
FIRED G-5; 272-01 took that extraction FIRST, as a pure move, before Phase 272 adds any behaviour.
What remains here is the orchestrator only — its decorator and body are byte-unchanged
(``tests/unit/test_272_pure_move.py``). Everything it composes now lives in:

* ``retrieval_rpc.py``       — ``_vector_literal``, ``_call_as_user``, ``_vector_search``, ``_keyword_search``
* ``retrieval_rank.py``      — ``_rrf_fuse``, ``_deduplicate_chunks``, ``_avg_cosine`` (pure)
* ``retrieval_documents.py`` — ``_enrich_with_filenames``, ``resolve_document_id``, ``fetch_full_document``

⛔ Filtered retrieval lands in ``retrieval_scope.py`` / ``retrieval_rpc.py`` — never back here.
272-03 threads ONE parameter (``document_ids``) through the orchestrator and nothing more: the
set is resolved in ``retrieval_scope.py``, restricted in ``retrieval_rpc.py``, marked in
``retrieval_rank.py``.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Sequence

from langsmith import traceable
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.services.rerank_service import rerank
from app.services.retrieval_documents import _enrich_with_filenames
from app.services.retrieval_rank import (
    _avg_cosine,
    _carry_low_similarity,
    _cover_matched_documents,
    _deduplicate_chunks,
    _rrf_fuse,
    _select_filtered_vector_rows,
)
from app.services.retrieval_rpc import FILTERED_MATCH_FLOOR, _keyword_search, _vector_search

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
    document_ids: Sequence[str] | None = None,
) -> tuple[list[dict], float]:
    """Phase 272 (D-14 / D-18 / D-19 / D-10) — ``document_ids`` is the filtered-retrieval input.

    * ``None`` — no filter. The calls are byte-identical to before (pinned by
      ``test_272_pure_move::test_unfiltered_rpc_calls_are_pinned``).
    * EMPTY — the filter matched nothing: ``([], 0.0)`` before any embed or RPC. ⛔ Never coerced
      to ``None``, which would widen to the whole knowledge base.
    * non-empty — the SAME set goes to the vector arm and the keyword arm, alongside the folder
      scope (D-19: a filter narrows the chat scope, never replaces it). The vector RPC runs with
      ``FILTERED_MATCH_FLOOR`` and the configured threshold is applied afterwards: if nothing
      clears it, the top rows come back marked ``low_similarity`` instead of a false empty.
    """
    if document_ids is not None and len(document_ids) == 0:
        return [], 0.0
    filtered = document_ids is not None
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
            top_n=top_k * 2, match_threshold=FILTERED_MATCH_FLOOR if filtered else match_threshold,
            user_settings=user_settings,
            folder_ids=folder_ids,
            document_ids=document_ids,
        )
        if filtered:
            rows = _select_filtered_vector_rows(rows, match_threshold)
        avg_sim = _avg_cosine(rows)
        rows = _deduplicate_chunks(rows)
        # D-27: a filtered cut keeps one passage per matched document before filling by rank.
        rows = _cover_matched_documents(rows, top_k) if filtered else rows[:top_k]
        return _carry_low_similarity(rows, await _enrich_with_filenames(rows, supabase)), avg_sim

    # Hybrid path: vector + keyword → RRF fusion → dedup → optional reranking
    vector_rows = await _vector_search(
        query, user_id, supabase, metadata_filter,
        top_n=candidate_count, match_threshold=FILTERED_MATCH_FLOOR if filtered else match_threshold,
        user_settings=user_settings,
        folder_ids=folder_ids,
        document_ids=document_ids,
    )
    if filtered:
        vector_rows = _select_filtered_vector_rows(vector_rows, match_threshold)
    keyword_rows = await _keyword_search(
        query, user_id, supabase, metadata_filter, top_n=candidate_count, folder_ids=folder_ids,
        document_ids=document_ids,
    )

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
    # D-27: a filtered cut keeps one passage per matched document (no document is dropped by
    # another's strong passages); the unfiltered cut is unchanged.
    if filtered:
        candidates = _cover_matched_documents(fused, max(top_k, rerank_top_n))
    else:
        candidates = fused[: max(top_k, rerank_top_n)]

    rerank_enabled = user_settings.rerank_enabled if user_settings else settings.rerank_enabled
    if rerank_enabled:
        # SEED-065: rerank is a SYNC Cohere-HTTP / local-ML call — same event-loop
        # blocking class as the embed above. Off by default, but when enabled it
        # compounds the stall, so wrap it in run_in_threadpool too (D-v2.5-01).
        # D-27: a filtered set is reordered in full, then cut with coverage, so the reranker
        # cannot drop a matched document either.
        candidates = await run_in_threadpool(
            rerank, query, candidates, top_n=len(candidates) if filtered else top_k,
            user_settings=user_settings,
        )
        if filtered:
            candidates = _cover_matched_documents(candidates, top_k)
    else:
        candidates = _cover_matched_documents(candidates, top_k) if filtered else candidates[:top_k]

    # D-10: `_rrf_fuse` copies each row (`dict(...)`) and rerank mutates in place, so the mark
    # survives to here; enrichment rebuilds the dicts, so it is carried across by position.
    return _carry_low_similarity(candidates, await _enrich_with_filenames(candidates, supabase)), avg_sim
