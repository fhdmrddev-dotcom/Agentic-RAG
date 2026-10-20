"""THE rerank-engine table (Phase 294-01, DEC-01 / D-02 / D-03 / D-08).

Data only — no I/O, no settings reads. Every fact about an engine lives here, so a new engine
is one row plus one adapter module, and the frontend's ``rerankEngines.ts`` mirrors the
``EngineId`` literal below (plan 04 reads it with a regex through ``?raw``, so keep it on ONE
line).

Vendor facts (D-24) were read from the vendors' own docs on 2026-10-20 (294-RESEARCH §1):

* Jev via OpenRouter — ``POST https://openrouter.ai/api/alpha/decisions``. It is NOT under
  ``/api/v1``, so it is never derived from the stored OpenRouter ``base_url``. ``noul`` answers
  are P(yes). $0.042 / 1M input tokens, output free; the response carries ``usage.cost`` in USD.
  Requests over ~32,000 bytes of text drop into a slower long-context mode, hence the byte cap.
* OpenAI Decisions — ``POST https://api.openai.com/v1/decisions``, ``gpt-6-luna`` only, 1-200
  questions per request, ``predicate`` answers are a probability, any answer may be a refusal.
  $0.10 / 1M input tokens, output free.
* Cohere ``rerank-v3.5`` — relevance scores are for ranking, not calibrated probabilities, and
  cohere.com publishes no per-search price we can multiply, so ``input_usd_per_million`` is None
  (unpriced, never $0 — the METER-01 honesty rule).
* Local cross-encoder — sigmoid output, not a calibrated probability. Runs on this server: free.

D-08: only the two decision engines are ``probabilistic`` (the 0.1 prune applies). Cohere and
Local keep today's reorder + ``[:top_n]``.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

EngineId = Literal["cohere", "local", "jev", "openai_decisions"]

# The pre-294 value "api" meant Cohere. Stored settings still carry it, so it stays accepted.
LEGACY_ALIASES: dict[str, str] = {"api": "cohere"}
ACCEPTED_PROVIDER_IDS: tuple[str, ...] = ("api", "cohere", "local", "jev", "openai_decisions")

JEV_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
OPENAI_DECISIONS_URL = "https://api.openai.com/v1/decisions"
COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank"

# Jev batching: ≤ 30 passages per call (the reference reranker's measured sweet spot) and
# ≤ ~28 KB of serialised state (under the ~32 KB long-context cliff); ≤ 4 calls in flight
# (sustained 429s were measured upstream at ~24).
JEV_MAX_PASSAGES_PER_CALL = 30
JEV_MAX_STATE_BYTES = 28_000
JEV_MAX_IN_FLIGHT = 4
OPENAI_MAX_QUESTIONS = 200


@dataclass(frozen=True)
class EngineSpec:
    id: str                    # one of EngineId
    label: str
    default_model: str
    model_pattern: str         # re.search pattern a stored rerank_model must match, else default_model
    key_source: str | None     # "rerank_api_key" | "openrouter" | "openai" | None (local)
    hosted: bool
    probabilistic: bool        # True only for jev, openai_decisions → prune() applies (D-07 / D-08)
    steering: bool             # True only for jev, openai_decisions (D-09)
    citation_check: bool       # True only for jev, openai_decisions (D-13)
    input_usd_per_million: Decimal | None
    timeout_s: float
    connect_timeout_s: float


ENGINES: dict[str, EngineSpec] = {
    "cohere": EngineSpec(
        id="cohere", label="Cohere", default_model="rerank-v3.5", model_pattern=r"^rerank-",
        key_source="rerank_api_key", hosted=True, probabilistic=False, steering=False,
        citation_check=False, input_usd_per_million=None,
        # Unchanged from the pre-294 call (``timeout=30.0`` for every phase, connect included).
        timeout_s=30.0, connect_timeout_s=30.0,
    ),
    "local": EngineSpec(
        id="local", label="On this server", default_model="BAAI/bge-reranker-v2-m3",
        model_pattern=r"/", key_source=None, hosted=False, probabilistic=False, steering=False,
        citation_check=False, input_usd_per_million=None,
        timeout_s=0.0, connect_timeout_s=0.0,   # no network; inference latency is measured (plan 02)
    ),
    "jev": EngineSpec(
        id="jev", label="Jev via OpenRouter", default_model="typesafe/jev-1.14",
        model_pattern=r"^~?typesafe/jev-", key_source="openrouter", hosted=True,
        probabilistic=True, steering=True, citation_check=True,
        input_usd_per_million=Decimal("0.042"), timeout_s=5.0, connect_timeout_s=2.0,
    ),
    "openai_decisions": EngineSpec(
        id="openai_decisions", label="OpenAI Decisions", default_model="gpt-6-luna",
        model_pattern=r"^gpt-", key_source="openai", hosted=True,
        probabilistic=True, steering=True, citation_check=True,
        input_usd_per_million=Decimal("0.10"), timeout_s=8.0, connect_timeout_s=2.0,
    ),
}

# Jev fans out; the whole fan-out must finish inside this wall-clock budget (D-11: a slow engine
# falls back, it never stalls the answer).
JEV_OVERALL_TIMEOUT_S = 6.0
