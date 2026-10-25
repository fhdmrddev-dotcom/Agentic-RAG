"""Phase 293 (START-02; D-14, D-15; T-293-06) — the per-key rate limiter.

A Redis fixed-window counter: one bucket per key, per kind (``start`` / ``read``), per minute,
named ``apikey:rl:{kind}:{key_id}:{minute}``. INCR and EXPIRE run in one MULTI/EXEC, so the count is
atomic across BOTH uvicorn workers — the property this module exists for.

⛔ Do NOT model this on ``api/setup.py``'s limiter. That one is an in-process dict, so each worker
keeps its own count and two workers admit twice the limit. A per-key API limit has to be shared.

⛔ FAIL CLOSED (D-15). If Redis raises, the call is refused with 503 — never admitted uncounted.
A limiter that waves calls through when its store is down is not a limit.

A per-minute bucket name needs no ``EXPIRE NX``, so this works on any Redis 5+, including Upstash
(``rediss://``). The limits come from ``app_settings`` through the 30-second async settings cache,
so a limit saved on one worker reaches the other within 30 seconds.
"""
from __future__ import annotations

import logging
import time
from typing import Literal

from fastapi import HTTPException

from app.models.user_settings import load_app_settings_async

logger = logging.getLogger(__name__)

Kind = Literal["start", "read"]

UNAVAILABLE_DETAIL = (
    "Rate limiting is unavailable right now, so this call was refused. Try again in a minute."
)


async def hit(redis, *, key_id: str, kind: Kind, limit: int) -> int | None:
    """Count one call. ``None`` if it is within ``limit``; else the seconds until the window
    resets (the ``Retry-After`` value, 1..60)."""
    now = int(time.time())
    bucket = f"apikey:rl:{kind}:{key_id}:{now // 60}"
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(bucket)
        pipe.expire(bucket, 120)
        count, _ = await pipe.execute()
    if count <= limit:
        return None
    return (60 - (now % 60)) or 1


async def enforce_key_limit(redis, *, key_id: str, kind: Kind) -> None:
    """Refuse the call with 429 + ``Retry-After`` when this key is over its per-minute limit,
    and with 503 when the limiter cannot count (fail closed)."""
    settings = await load_app_settings_async()
    if kind == "start":
        limit = int(settings.api_key_starts_per_minute)
    else:
        limit = int(settings.api_key_reads_per_minute)
    try:
        retry = await hit(redis, key_id=key_id, kind=kind, limit=limit)
    except Exception:  # noqa: BLE001 — any Redis failure refuses; see the module docblock
        logger.warning("api key rate limiter unavailable; refusing the call", exc_info=True)
        raise HTTPException(status_code=503, detail=UNAVAILABLE_DETAIL)
    if retry is None:
        return
    if kind == "start":
        detail = (
            f"Too many starts: this key may start {limit} runs a minute. "
            f"Try again in {retry} seconds."
        )
    else:
        detail = (
            f"Too many status reads: this key may read {limit} times a minute. "
            f"Try again in {retry} seconds."
        )
    raise HTTPException(status_code=429, detail=detail, headers={"Retry-After": str(retry)})
