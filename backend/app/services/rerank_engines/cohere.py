"""Cohere rerank adapter — ``_rerank_api`` moved out of ``rerank_service.py`` (Phase 294-01).

Behaviour is unchanged: ``POST /v2/rerank``, 30 s timeout, reorder + ``[:top_n]`` (Cohere returns
at most ``top_n``). ⛔ D-08: never thresholded — ``relevance_score`` is a ranking score, not a
calibrated probability. ``instruction`` and ``keep_documents`` are accepted and ignored: Cohere
reorders only (no steering; the filtered path's coverage runs in ``retrieval_service`` after).

The HTTP client comes from the module factory ``_http_client`` so the rerank-off test can assert
it is never constructed and the failure tests can inject an ``httpx.MockTransport``.
"""
from __future__ import annotations

import time

import httpx
from langsmith import traceable

from app.services.rerank_engines.registry import COHERE_RERANK_URL, ENGINES
from app.services.rerank_engines.tracing import EngineCall, record_engine_call, redact_inputs, span_outputs

ENGINE_ID = "cohere"


def _http_client(timeout: httpx.Timeout) -> httpx.Client:
    return httpx.Client(timeout=timeout)


@traceable(name="rerank.cohere", run_type="llm", process_inputs=redact_inputs,
           metadata={"ls_provider": "cohere"})
def _call(query: str, documents: list[dict], top_n: int, *, api_key: str, model: str) -> dict:
    spec = ENGINES[ENGINE_ID]
    started = time.perf_counter()
    with _http_client(httpx.Timeout(spec.timeout_s, connect=spec.connect_timeout_s)) as client:
        response = client.post(
            COHERE_RERANK_URL,
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
        )
    response.raise_for_status()
    data = response.json()

    reranked = []
    for result in data["results"]:
        doc = dict(documents[result["index"]])
        doc["relevance_score"] = result["relevance_score"]
        reranked.append(doc)
    latency_ms = (time.perf_counter() - started) * 1000
    record_engine_call(EngineCall(
        engine=ENGINE_ID, model=model, purpose="rerank", input_tokens=None, output_tokens=None,
        cost_usd=None, latency_ms=latency_ms, ok=True, reason=None,
    ))
    return {"rows": reranked, **span_outputs(input_tokens=None, output_tokens=None, cost_usd=None,
                                              latency_ms=latency_ms)}


def rerank(query: str, documents: list[dict], top_n: int, *, api_key: str, model: str,
           instruction: str | None = None, keep_documents: bool = False) -> list[dict]:
    """Rerank via Cohere Rerank API (v2). Raises on any failure (the dispatcher falls back)."""
    return _call(query, documents, top_n, api_key=api_key, model=model)["rows"]
