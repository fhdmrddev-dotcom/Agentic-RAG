"""Phase 294-03 (DEC-03, D-15..D-17) — the citation check's wire model, version 1.

One ``CitationCheckResult`` is stored per assistant message in ``public.message_citation_checks``
(migration 211, ``result`` jsonb) and is returned verbatim by ``POST /citation-checks/{id}`` and
``GET /citation-checks``. Plan 05's frontend reads these Literals from source (``?raw``), so they
stay module-level and spelled ``Name = Literal[...]`` on one line.

* ``verdict`` is the decision engine's ``choice`` over ``CHOICE_LABELS``, or ``couldnt_check``
  for a refusal, a missing / malformed / unknown answer, a missing source passage, a per-source
  call failure or a claim over the cap (D-17). Nothing ever defaults to ``supported``.
* ``confidence`` is the engine's own ``confidence`` for that choice (null for ``couldnt_check``).
  It is never re-derived from ``probabilities`` (assumption A2: option order can move those).
* There is NO model-written reason: decision engines return no text, and the UI's one-line
  reason is fixed per-verdict copy.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

Verdict = Literal["supported", "partly_supported", "not_supported", "contradicted", "couldnt_check"]
CheckEngineId = Literal["jev", "openai_decisions"]
UnavailableReason = Literal["off", "engine_reorders_only", "key_missing"]

#: The four labels an engine may choose, in the CANONICAL order offered on EVERY call (A2).
CHOICE_LABELS: tuple[str, ...] = ("supported", "partly_supported", "not_supported", "contradicted")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CitationClaimResult(_Strict):
    ordinal: int
    n: int
    sentence: str
    verdict: Verdict
    confidence: float | None


class CitationCheckCounts(_Strict):
    supported: int
    partly_supported: int
    not_supported: int
    contradicted: int
    couldnt_check: int


class CitationCheckUsage(_Strict):
    input_tokens: int | None
    cost_usd: float | None


class CitationCheckResult(_Strict):
    version: Literal[1]
    engine: CheckEngineId
    model: str
    checked_at: str
    claims: list[CitationClaimResult]
    counts: CitationCheckCounts
    usage: CitationCheckUsage


class CitationCheckAvailabilityOut(_Strict):
    available: bool
    engine: CheckEngineId | None
    reason: UnavailableReason | None


class CitationChecksResponse(_Strict):
    availability: CitationCheckAvailabilityOut
    checks: dict[str, CitationCheckResult]
