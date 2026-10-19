"""Local cross-encoder adapter — ``_rerank_local`` moved out of ``rerank_service.py`` (294-01).

Two defects fixed here:

1. **The cache ignored the model name.** The base ``_get_local_model`` cached the FIRST model
   forever. Now ONE ``(model_name, CrossEncoder)`` pair is resident; a name change reloads exactly
   once and replaces it (the old one is released); a double-checked lock means two threadpool
   requests never double-load.
2. **First use stalled the answer.** Constructing ``BAAI/bge-reranker-v2-m3`` downloads ~2.3 GB.
   A chat search never waits for that: while the requested model is not resident, ``rerank``
   starts ONE background load and raises ``LocalModelWarming``; the dispatcher returns the
   rerank-off output and logs an INFO line. A failed load is retried only after
   ``LOAD_RETRY_COOLDOWN_S``, so a misspelt model name cannot start a download per search.

Each uvicorn worker (``WORKER_COUNT=2``) holds and loads its own copy; an out-of-process warm-up
only fills the Hugging Face disk cache. ``warm(name, wait=True)`` is the explicit warm-up used by
the measurement harness (plan 02) and the live drive.

⛔ D-08: reorder + ``[:top_n]`` only. The sigmoid output is not a calibrated probability, so the
D-07 prune never applies here.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from decimal import Decimal
from typing import Any

from langsmith import traceable

from app.services.rerank_engines.tracing import EngineCall, record_engine_call, redact_inputs, span_outputs

logger = logging.getLogger(__name__)

ENGINE_ID = "local"
LOAD_RETRY_COOLDOWN_S = 300


class LocalModelWarming(RuntimeError):
    """The requested model is loading (or cooling down after a failed load)."""


_clock = time.monotonic
_load_lock = threading.Lock()     # serialises CONSTRUCTION (the double-checked lock)
_state_lock = threading.Lock()    # guards _loader / _failed_at
_local: tuple[str, Any] | None = None          # (model_name, CrossEncoder) — ONE model resident
_loader: tuple[str, threading.Thread] | None = None
_failed_at: dict[str, float] = {}


def _resident(model_name: str) -> Any | None:
    cur = _local
    if cur is not None and cur[0] == model_name:
        return cur[1]
    return None


def _get_local_model(model_name: str) -> Any:
    """Blocking, single-flight load. Raises when the load fails (after logging the TYPE only)."""
    global _local
    model = _resident(model_name)               # hot path: no lock, no load
    if model is not None:
        return model
    with _load_lock:
        model = _resident(model_name)
        if model is not None:
            return model
        started = _clock()
        try:
            from sentence_transformers import CrossEncoder  # type: ignore

            model = CrossEncoder(model_name)
        except Exception as exc:  # noqa: BLE001 — logged by type; the caller falls back
            with _state_lock:
                _failed_at[model_name] = _clock()
            logger.info("local rerank model %s load failed (%s)", model_name, type(exc).__name__)
            raise
        _local = (model_name, model)            # replaces → the previous model is released
        with _state_lock:
            _failed_at.pop(model_name, None)
        logger.info("local rerank model %s loaded in %.1fs (pid %d)",
                    model_name, _clock() - started, os.getpid())
        return model


def _background_load(model_name: str) -> None:
    try:
        _get_local_model(model_name)
    except Exception:  # noqa: BLE001 — already logged; the cool-down governs the retry
        pass


def _start_background_load(model_name: str) -> threading.Thread | None:
    """Start ONE background load unless one is running or the name is cooling down."""
    global _loader
    with _state_lock:
        if _loader is not None and _loader[1].is_alive():
            return _loader[1] if _loader[0] == model_name else None
        failed = _failed_at.get(model_name)
        if failed is not None and _clock() - failed < LOAD_RETRY_COOLDOWN_S:
            return None
        thread = threading.Thread(target=_background_load, args=(model_name,),
                                  name="local-rerank-load", daemon=True)
        _loader = (model_name, thread)
        thread.start()
        return thread


def warm(model_name: str, *, wait: bool = False, timeout_s: float | None = None) -> bool:
    """Start (or join) the load of ``model_name``. True when the model is resident."""
    if _resident(model_name) is not None:
        return True
    thread = _start_background_load(model_name)
    if wait and thread is not None:
        thread.join(timeout_s)
    return _resident(model_name) is not None


@traceable(name="rerank.local", run_type="llm", process_inputs=redact_inputs,
           metadata={"ls_provider": "local"})
def _score(query: str, documents: list[dict], top_n: int, *, model_name: str, model: Any) -> dict:
    started = time.perf_counter()
    pairs = [(query, doc["content"]) for doc in documents]
    scores = model.predict(pairs)

    scored = [(float(score), doc) for score, doc in zip(scores, documents)]
    scored.sort(key=lambda x: x[0], reverse=True)

    reranked = []
    for score, doc in scored[:top_n]:
        d = dict(doc)
        d["relevance_score"] = score
        reranked.append(d)
    latency_ms = (time.perf_counter() - started) * 1000
    # No tokens are counted on this server (unknown, None); the cost is a real $0 — no vendor bill.
    record_engine_call(EngineCall(engine=ENGINE_ID, model=model_name, purpose="rerank",
                                  latency_ms=latency_ms, ok=True, cost_usd=Decimal("0")))
    return {"rows": reranked, **span_outputs(latency_ms=latency_ms, cost_usd=Decimal("0"))}


def rerank(query: str, documents: list[dict], top_n: int, *, api_key: str | None = None, model: str,
           instruction: str | None = None, keep_documents: bool = False) -> list[dict]:
    """Rerank via the resident CrossEncoder. Raises ``LocalModelWarming`` while it is not resident."""
    resident = _resident(model)
    if resident is None:
        _start_background_load(model)
        raise LocalModelWarming(model)
    return _score(query, documents, top_n, model_name=model, model=resident)["rows"]
