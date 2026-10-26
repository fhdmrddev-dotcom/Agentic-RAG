"""Trace redaction and per-call engine accounting (Phase 294-01, SC#6 / D-19).

``redact_inputs`` is the ``process_inputs=`` hook for every ``@traceable`` this phase owns.
LangSmith serialises a traced function's arguments; ``user_settings`` carries every provider key
(``providers[*].api_key``, ``rerank_api_key``, ``embedding_api_key``, ``llm_api_key``), an
``api_key`` argument is a key, and a ``supabase`` client repr can carry a bearer token. A fake-
client probe at 294 research found both planted keys in ``create_run`` inputs before this hook.

``EngineCall`` is one engine HTTP call (or one local scoring pass, or one fallback). The
measurement harness (plan 02) reads them through ``capture_engine_calls()``. The capture is a
ContextVar holding a shared list: ``run_in_threadpool`` and ``contextvars.copy_context().run``
both copy the context, and the copies still point at the SAME list, so appends from worker
threads land in the caller's capture.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterator

REDACTED = "<redacted>"
_SECRET_ARGS = frozenset({"user_settings", "api_key", "supabase"})


def redact_inputs(inputs: dict) -> dict:
    """Replace every secret-bearing argument with ``"<redacted>"``. Never raises."""
    return {k: (REDACTED if k in _SECRET_ARGS else v) for k, v in dict(inputs or {}).items()}


@dataclass(frozen=True)
class EngineCall:
    """One engine call. Token counts default to None = the engine reports none (Cohere, Local, a
    fallback) — unknown, never coerced to 0 (the METER-01 honesty rule). This is an in-memory
    measurement record for the harness, not a run-usage write."""
    engine: str
    model: str
    purpose: str                    # "rerank" | "citation_check"
    latency_ms: float
    ok: bool
    reason: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: Decimal | None = None  # Jev: vendor usage.cost; OpenAI: pricing helper; local: 0; cohere: None


_CAPTURE: ContextVar[list[EngineCall] | None] = ContextVar("rerank_engine_calls", default=None)


def record_engine_call(call: EngineCall) -> None:
    """Append to the active capture; a no-op when nothing is capturing."""
    sink = _CAPTURE.get()
    if sink is not None:
        sink.append(call)


@contextmanager
def capture_engine_calls() -> Iterator[list[EngineCall]]:
    sink: list[EngineCall] = []
    token = _CAPTURE.set(sink)
    try:
        yield sink
    finally:
        _CAPTURE.reset(token)


def span_outputs(*, latency_ms: float, input_tokens: int | None = None, output_tokens: int | None = None,
                 cost_usd: Decimal | None = None, **extra: Any) -> dict:
    """The outputs dict an ``llm`` span returns so LangSmith can read usage and cost (D-19).

    296-03 (294-IN-02): a token count the engine did not report is OMITTED, never written as 0
    (the METER-01 rule ``EngineCall`` already kept); ``total_tokens`` only when both are known.
    """
    usage: dict[str, Any] = {}
    if input_tokens is not None:
        usage["input_tokens"] = input_tokens
    if output_tokens is not None:
        usage["output_tokens"] = output_tokens
    if input_tokens is not None and output_tokens is not None:
        usage["total_tokens"] = input_tokens + output_tokens
    if cost_usd is not None:
        usage["total_cost"] = float(cost_usd)
    return {
        "usage_metadata": usage,
        "cost_usd": None if cost_usd is None else str(cost_usd),
        "latency_ms": round(latency_ms, 2),
        **extra,
    }
