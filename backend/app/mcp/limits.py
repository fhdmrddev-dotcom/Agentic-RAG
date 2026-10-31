"""Phase 305-03 (KEY-07; D-27 / D-28 / D-54; T-305-13) — the per-key MCP limits.

A tool's ``ToolSpec.bucket`` picks its counter: ``cheap`` -> the ``read`` kind (limited by
``api_key_reads_per_minute``), ``expensive`` -> the ``expensive`` kind (``api_key_searches_per_minute``).
Both are ``services/rate_limit.check_key_limit``: the shared Redis fixed window, atomic across both
uvicorn workers, FAIL CLOSED.

Over the limit is a SENTENCE the caller's model can relay (D-28), never an HTTP 429 a client reports
as "couldn't reach". The refusal also carries what the audit row needs: the reason (the ONE reason
vocabulary, shared with the key card's words: ``rate_limited:read`` / ``rate_limited:expensive`` /
``limiter_unavailable``) and the limit.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services import rate_limit

SEARCHES_SENTENCE = "This key has made too many searches in the last minute. Try again in {retry} seconds."
READS_SENTENCE = "This key has made too many reads in the last minute. Try again in {retry} seconds."

_KIND = {"cheap": "read", "expensive": "expensive"}


@dataclass(frozen=True)
class LimitRefusal:
    sentence: str          # the tool error the caller's model relays
    reason: str            # the audit reason
    limit: int | None      # the per-minute limit that refused it (None when it could not count)


async def check_limit(principal: Any, spec: Any, redis: Any) -> LimitRefusal | None:
    """Count this call against the key's bucket for ``spec``. ``None`` = within the limit."""
    kind = _KIND[spec.bucket]
    try:
        limit, retry = await rate_limit.check_key_limit(redis, key_id=str(principal.key_id), kind=kind)
    except rate_limit.LimiterUnavailable:
        return LimitRefusal(rate_limit.UNAVAILABLE_DETAIL, "limiter_unavailable", None)
    if retry is None:
        return None
    template = SEARCHES_SENTENCE if kind == "expensive" else READS_SENTENCE
    return LimitRefusal(template.format(retry=retry), f"rate_limited:{kind}", limit)
