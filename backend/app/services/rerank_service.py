"""
Reranking — a thin dispatcher over ``app.services.rerank_engines`` (Phase 294-01, DEC-01).

Controlled by config or per-request UserEffectiveSettings:
  RERANK_ENABLED   - master switch (default: false)
  RERANK_PROVIDER  - "cohere" (legacy "api"), "local", "jev" or "openai_decisions"
  RERANK_API_KEY   - Cohere API key (Jev uses the stored OpenRouter key, OpenAI Decisions the
                     stored OpenAI key — D-02 / D-03, no new secret)
  RERANK_MODEL     - model name; a name that belongs to another engine falls back to the
                     selected engine's default (``rerank_engines.resolve_model``)
  RERANK_TOP_N     - number of results to return after reranking

⛔ D-11 + D-12 — a failure EQUALS rerank-off. Any exception, an unknown provider, a missing key or
a model that is still loading returns ``documents[:n]``, which is exactly what the caller gets with
rerank off. (Before 294 a failure returned the WHOLE pool — more passages than off.) A failure is
logged with the engine id and the exception TYPE only: never a traceback log, never the
exception text (an httpx error can carry the request), never a key.

⛔ SC#6 — the decorator's ``redact_inputs`` hook keeps ``user_settings`` (every provider key) out of the
LangSmith run inputs.
"""

from __future__ import annotations

import importlib
import logging
import time
from typing import TYPE_CHECKING

import httpx
from langsmith import traceable

from app.config import settings
from app.services.rerank_engines import MissingEngineKey, get_engine, resolve_credentials, resolve_model
from app.services.rerank_engines.local import LocalModelWarming
from app.services.rerank_engines.tracing import EngineCall, record_engine_call, redact_inputs

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


def _reason(exc: BaseException) -> str:
    """The exception TYPE (plus the HTTP status for a status error). Never ``str(exc)``."""
    name = type(exc).__name__
    if isinstance(exc, httpx.HTTPStatusError):
        return f"{name}:{exc.response.status_code}"
    return name


@traceable(name="rerank-documents", run_type="retriever", process_inputs=redact_inputs)
def rerank(
    query: str,
    documents: list[dict],
    top_n: int | None = None,
    user_settings: UserEffectiveSettings | None = None,
    *,
    instruction: str | None = None,
    keep_documents: bool = False,
) -> list[dict]:
    """Rerank documents by relevance to query. Returns at most top_n results.

    Each document dict must have a "content" key; every returned row is a COPY that keeps every
    key and gains "relevance_score". ``instruction`` steers the decision engines only (D-09, data,
    never instructions — D-10); ``keep_documents`` is the filtered path's D-27 coverage signal.
    Falls back to ``documents[:n]`` (== rerank off) on any failure.
    """
    rerank_enabled = user_settings.rerank_enabled if user_settings is not None else settings.rerank_enabled
    if not rerank_enabled:
        return documents

    if not documents:
        return documents

    rerank_top_n = user_settings.rerank_top_n if user_settings is not None else settings.rerank_top_n
    n = top_n if top_n is not None else rerank_top_n

    rerank_provider = user_settings.rerank_provider if user_settings is not None else settings.rerank_provider
    rerank_model = user_settings.rerank_model if user_settings is not None else settings.rerank_model

    spec = get_engine(rerank_provider)
    if spec is None:
        logger.warning("Unknown rerank_provider=%r — keeping the current order", rerank_provider)
        return documents[:n]

    model = resolve_model(spec, rerank_model)
    started = time.perf_counter()
    try:
        api_key = resolve_credentials(spec, user_settings)
        if spec.hosted and api_key is None:
            raise MissingEngineKey(spec.id)
        adapter = importlib.import_module(f"app.services.rerank_engines.{spec.id}")
        return adapter.rerank(
            query, documents, n, api_key=api_key, model=model,
            instruction=instruction, keep_documents=keep_documents,
        )
    except LocalModelWarming:
        logger.info("local rerank model %s still loading — keeping the current order", model)
        _record_fallback(spec.id, model, started, "warming")
        return documents[:n]
    except Exception as exc:  # noqa: BLE001 — D-11: any failure falls back to the off output
        reason = _reason(exc)
        logger.warning("rerank engine %s failed (%s) — keeping the current order", spec.id, reason)
        _record_fallback(spec.id, model, started, reason)
        return documents[:n]


def _record_fallback(engine: str, model: str, started: float, reason: str) -> None:
    # A fallback sent nothing countable: tokens and cost stay unknown (the EngineCall defaults).
    record_engine_call(EngineCall(
        engine=engine, model=model, purpose="rerank",
        latency_ms=(time.perf_counter() - started) * 1000, ok=False, reason=reason,
    ))
