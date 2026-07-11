"""Phase 147 Plan 02 (ADMIN-02) — dependency-health probes for the operator Control Plane.

Three tiny async probes — Redis / Supabase / sandbox reachability + latency — surfaced
as an ADDITIVE ``dependencies`` block on ``GET /admin/backpressure`` (D-078-08
additive-only; the four original signals stay byte-identical). Every probe is
BEST-EFFORT: it NEVER raises out of the endpoint (each degrades to ``down``/``off``),
so a single probe failure can never break the health payload.

Probe contract (per dependency):
    {"state": "up" | "down" | "off", "latency_ms": int | None}
``latency_ms`` is populated only for ``up``; ``down``/``off`` carry ``None``.

Sandbox honesty (Pitfall 6): a deliberately-disabled sandbox
(``settings.sandbox_enabled = false``) reports ``off`` (neutral) — NEVER ``down``. No
container exists to ping, so a red card there would misread a config as a failure. Only
an ENABLED sandbox whose Docker daemon is unreachable is ``down``.

Analog composition (147-PATTERNS): Redis PING mirrors ``main.py health()`` /
``main.py:232`` (``asyncio.wait_for(get_redis().ping(), timeout=1.0)``); the Docker
client mirrors ``sandbox_service.py:94-104`` (``docker.from_env()`` guarded by
``ImportError``); the trivial Supabase select is wrapped in ``run_in_threadpool``
because supabase-py is blocking (D-v2.5-01 — never block the event loop).
"""
from __future__ import annotations

import asyncio
import logging
import time

from fastapi.concurrency import run_in_threadpool

from app.config import settings

logger = logging.getLogger(__name__)

# Bound every probe so one slow/hung dependency can't stall the poll (mirrors the
# boot PING timeout at main.py:232). A probe that exceeds this reports ``down``.
_PROBE_TIMEOUT_S = 1.0


def _up(t0: float) -> dict:
    return {"state": "up", "latency_ms": round((time.perf_counter() - t0) * 1000)}


async def probe_redis() -> dict:
    """Redis reachability + latency via PING (bounded by ``_PROBE_TIMEOUT_S``)."""
    from app.dependencies import get_redis

    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=_PROBE_TIMEOUT_S)
        return _up(t0)
    except Exception as exc:
        logger.warning("health probe: Redis unreachable (%s)", type(exc).__name__)
        return {"state": "down", "latency_ms": None}


async def probe_supabase() -> dict:
    """Supabase/Postgres reachability + latency via a trivial SELECT.

    supabase-py is blocking → ``run_in_threadpool`` (D-v2.5-01). ``app_settings`` is the
    app's singleton settings table (present in every environment); a ``limit(1)`` read is
    the cheapest reachability signal that also exercises the auth + network path.
    """
    from app.dependencies import get_supabase

    t0 = time.perf_counter()

    def _ping():
        return get_supabase().table("app_settings").select("*").limit(1).execute()

    try:
        await asyncio.wait_for(run_in_threadpool(_ping), timeout=_PROBE_TIMEOUT_S)
        return _up(t0)
    except Exception as exc:
        logger.warning("health probe: Supabase unreachable (%s)", type(exc).__name__)
        return {"state": "down", "latency_ms": None}


async def probe_sandbox() -> dict:
    """Sandbox (Docker) reachability — THREE honest states (Pitfall 6).

    - ``off``  → ``settings.sandbox_enabled`` is false (deliberate config; NO ping
      attempted; NEVER ``down``).
    - ``up``   → ``docker.from_env().ping()`` succeeds.
    - ``down`` → sandbox is ENABLED but the Docker daemon is unreachable (or the SDK
      is not importable).
    """
    if not settings.sandbox_enabled:
        return {"state": "off", "latency_ms": None}

    t0 = time.perf_counter()

    def _ping():
        import docker  # guarded — ImportError falls through to ``down`` below

        return docker.from_env().ping()

    try:
        await asyncio.wait_for(run_in_threadpool(_ping), timeout=_PROBE_TIMEOUT_S)
        return _up(t0)
    except Exception as exc:
        logger.warning("health probe: sandbox/Docker unreachable (%s)", type(exc).__name__)
        return {"state": "down", "latency_ms": None}


async def probe_dependencies() -> dict:
    """Run the three probes CONCURRENTLY (``asyncio.gather``) and assemble the additive
    ``dependencies`` block. Each probe swallows its own failure, so gather never raises."""
    redis_state, supabase_state, sandbox_state = await asyncio.gather(
        probe_redis(), probe_supabase(), probe_sandbox()
    )
    return {"redis": redis_state, "supabase": supabase_state, "sandbox": sandbox_state}


__all__ = ["probe_redis", "probe_supabase", "probe_sandbox", "probe_dependencies"]
