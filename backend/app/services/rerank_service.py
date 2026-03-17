"""
Reranking service — API (Cohere) and local (sentence-transformers CrossEncoder) providers.

Controlled by config:
  RERANK_ENABLED   - master switch (default: false)
  RERANK_PROVIDER  - "api" or "local"
  RERANK_API_KEY   - Cohere API key (required for "api" provider)
  RERANK_MODEL     - model name for chosen provider
  RERANK_TOP_N     - number of results to return after reranking
"""

import logging

import httpx
from langsmith import traceable

from app.config import settings

logger = logging.getLogger(__name__)

# Lazy-loaded local model (only initialised when first needed)
_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import CrossEncoder  # type: ignore
        logger.info("Loading local reranker model: %s", settings.rerank_model)
        _local_model = CrossEncoder(settings.rerank_model)
        logger.info("Local reranker model loaded.")
    return _local_model


@traceable(name="rerank-documents", run_type="retriever")
def rerank(query: str, documents: list[dict], top_n: int | None = None) -> list[dict]:
    """Rerank documents by relevance to query. Returns top_n results (or all if top_n is None).

    Each document dict must have a "content" key.
    Adds a "relevance_score" field to each returned document.
    Falls back to original order on any error.
    """
    if not settings.rerank_enabled:
        return documents

    if not documents:
        return documents

    n = top_n if top_n is not None else settings.rerank_top_n

    try:
        if settings.rerank_provider == "api":
            return _rerank_api(query, documents, n)
        elif settings.rerank_provider == "local":
            return _rerank_local(query, documents, n)
        else:
            logger.warning("Unknown RERANK_PROVIDER=%r — skipping rerank", settings.rerank_provider)
            return documents
    except Exception:
        logger.exception("Reranking failed — returning original order")
        return documents


def _rerank_api(query: str, documents: list[dict], top_n: int) -> list[dict]:
    """Rerank via Cohere Rerank API (v2)."""
    response = httpx.post(
        "https://api.cohere.com/v2/rerank",
        headers={
            "Authorization": f"Bearer {settings.rerank_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.rerank_model,
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


def _rerank_local(query: str, documents: list[dict], top_n: int) -> list[dict]:
    """Rerank via local sentence-transformers CrossEncoder."""
    model = _get_local_model()
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
