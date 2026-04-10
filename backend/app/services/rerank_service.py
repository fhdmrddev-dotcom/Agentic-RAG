"""
Reranking service — API (Cohere) and local (sentence-transformers CrossEncoder) providers.

Controlled by config or per-request UserEffectiveSettings:
  RERANK_ENABLED   - master switch (default: false)
  RERANK_PROVIDER  - "api" or "local"
  RERANK_API_KEY   - Cohere API key (required for "api" provider)
  RERANK_MODEL     - model name for chosen provider
  RERANK_TOP_N     - number of results to return after reranking
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx
from langsmith import traceable

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

# Lazy-loaded local model (only initialised when first needed)
_local_model = None


def _get_local_model(model_name: str):
    global _local_model
    if _local_model is None:
        from sentence_transformers import CrossEncoder  # type: ignore
        logger.info("Loading local reranker model: %s", model_name)
        _local_model = CrossEncoder(model_name)
        logger.info("Local reranker model loaded.")
    return _local_model


@traceable(name="rerank-documents", run_type="retriever")
def rerank(
    query: str,
    documents: list[dict],
    top_n: int | None = None,
    user_settings: UserEffectiveSettings | None = None,
) -> list[dict]:
    """Rerank documents by relevance to query. Returns top_n results (or all if top_n is None).

    Each document dict must have a "content" key.
    Adds a "relevance_score" field to each returned document.
    Falls back to original order on any error.
    """
    rerank_enabled = user_settings.rerank_enabled if user_settings is not None else settings.rerank_enabled
    if not rerank_enabled:
        return documents

    if not documents:
        return documents

    rerank_top_n = user_settings.rerank_top_n if user_settings is not None else settings.rerank_top_n
    n = top_n if top_n is not None else rerank_top_n

    rerank_provider = user_settings.rerank_provider if user_settings is not None else settings.rerank_provider
    rerank_api_key = user_settings.rerank_api_key if user_settings is not None else settings.rerank_api_key
    rerank_model = user_settings.rerank_model if user_settings is not None else settings.rerank_model

    try:
        if rerank_provider in ("api", "cohere"):
            return _rerank_api(query, documents, n, rerank_api_key, rerank_model)
        elif rerank_provider == "local":
            return _rerank_local(query, documents, n, rerank_model)
        else:
            logger.warning("Unknown RERANK_PROVIDER=%r — skipping rerank", rerank_provider)
            return documents
    except Exception:
        logger.exception("Reranking failed — returning original order")
        return documents


def _rerank_api(query: str, documents: list[dict], top_n: int, api_key: str, model: str) -> list[dict]:
    """Rerank via Cohere Rerank API (v2)."""
    response = httpx.post(
        "https://api.cohere.com/v2/rerank",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "query": query,
            "documents": [doc["content"] for doc in documents],
            "top_n": top_n,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()

    reranked = []
    for result in data["results"]:
        doc = dict(documents[result["index"]])
        doc["relevance_score"] = result["relevance_score"]
        reranked.append(doc)
    return reranked


def _rerank_local(query: str, documents: list[dict], top_n: int, model_name: str) -> list[dict]:
    """Rerank via local sentence-transformers CrossEncoder."""
    model = _get_local_model(model_name)
    pairs = [(query, doc["content"]) for doc in documents]
    scores = model.predict(pairs)

    scored = [(float(score), doc) for score, doc in zip(scores, documents)]
    scored.sort(key=lambda x: x[0], reverse=True)

    reranked = []
    for score, doc in scored[:top_n]:
        d = dict(doc)
        d["relevance_score"] = score
        reranked.append(d)
    return reranked
