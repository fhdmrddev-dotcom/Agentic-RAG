"""Phase 147 Plan 02 (ADMIN-02) — dependency-health probes for the operator Control Plane.

Three tiny async probes — Redis / Supabase / sandbox reachability + latency — surfaced
as an ADDITIVE ``dependencies`` block on ``GET /admin/backpressure`` (D-078-08
additive-only; the four original signals stay byte-identical). Every probe is
BEST-EFFORT: it NEVER raises out of the endpoint (each degrades to ``down``/``off``),
so a single probe failure can never break the health payload.

Phase 300 (D-12) adds a fourth key, ``email`` (``probe_email``): the app mailer's mode and the
newest delivery outcome from the run-waiting outbox. Its contract is wider than the three above
(``mode`` / ``provider`` / ``last_*``), and ``admin.py`` is untouched — ``get_backpressure``
already spreads ``probe_dependencies()``.

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

from app.api.api_docs import is_production_environment
from app.config import settings
from app.db.notifications import latest_delivery_facts
from app.models.user_settings import load_app_settings
from app.services.email_provider import configured_provider, transport_config_problem

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


#: The one sentence the Email tile shows when the delivery record itself could not be read.
EMAIL_RECORD_UNREADABLE = "Couldn't read the email delivery record."


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


async def probe_email() -> dict:
    """Phase 300 (D-12) — the run-waiting / invitation mailer, as the operator sees it.

    ``mode``: provider ``none`` → ``off``; not production and no Settings test address →
    ``held_back`` (mail is only logged, D-10); not production with one → ``test``; production →
    ``live``. ``state``: ``off`` for off / held back (a deliberate config, NEVER ``down``);
    ``down`` when the newest failed delivery is newer than the newest sent one (or nothing was
    ever sent), or when the record could not be read; else ``up``. ``config_problem`` (IN-04):
    in live or test mode, the mailer's sentence for a transport that cannot send on config alone
    (``state: down``, no outbox read); ``None`` otherwise. Skipped and suppressed
    deliveries are never failures. The reason is the mailer's own address-free sentence; the
    probe never carries a recipient, a subject or a link (T-300-33), and it never raises.
    """
    out = {
        "state": "off",
        "mode": "off",
        "provider": "none",
        "last_sent_at": None,
        "last_failure_at": None,
        "last_failure_reason": None,
        "latency_ms": None,
        "config_problem": None,
    }
    try:
        provider = configured_provider()
        out["provider"] = provider
        if provider == "none":
            return out
        app = await run_in_threadpool(load_app_settings)
        if is_production_environment():
            out["mode"] = "live"
        else:
            redirect = (getattr(app, "email_dev_redirect_address", "") or "").strip()
            out["mode"] = "test" if redirect else "held_back"
            if not redirect:
                return out
        # 300-REVIEW IN-04: a transport that cannot send on config alone (no sender address, no
        # key, no host, a refused SMTP_SECURITY) used to read "Ready" until the first real send
        # failed. Named now, in the mailer's own words; the outbox is not read.
        problem = transport_config_problem(provider, app)
        if problem:
            out.update(state="down", config_problem=problem)
            return out
    except Exception as exc:  # noqa: BLE001 — a probe never raises
        logger.warning("health probe: email mode unreadable (%s)", type(exc).__name__)
        out.update(state="down", mode="live", last_failure_reason=EMAIL_RECORD_UNREADABLE)
        return out

    from app.dependencies import get_pg_pool

    try:
        pool = await get_pg_pool()
        facts = await asyncio.wait_for(latest_delivery_facts(pool), timeout=_PROBE_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — includes the timeout
        logger.warning("health probe: email delivery record unreadable (%s)", type(exc).__name__)
        out.update(state="down", last_failure_reason=EMAIL_RECORD_UNREADABLE)
        return out

    sent_at = facts.get("last_sent_at")
    failed_at = facts.get("last_failure_at")
    out["last_sent_at"] = _iso(sent_at)
    out["last_failure_at"] = _iso(failed_at)
    out["last_failure_reason"] = facts.get("last_failure_reason")
    failing = failed_at is not None and (sent_at is None or failed_at > sent_at)
    out["state"] = "down" if failing else "up"
    return out


async def probe_dependencies() -> dict:
    """Run the probes CONCURRENTLY (``asyncio.gather``) and assemble the additive
    ``dependencies`` block. Each probe swallows its own failure, so gather never raises.
    300-04 adds ``email`` after the three shipped keys, which stay byte-identical."""
    redis_state, supabase_state, sandbox_state, email_state = await asyncio.gather(
        probe_redis(), probe_supabase(), probe_sandbox(), probe_email()
    )
    return {
        "redis": redis_state,
        "supabase": supabase_state,
        "sandbox": sandbox_state,
        "email": email_state,
    }


__all__ = ["probe_redis", "probe_supabase", "probe_sandbox", "probe_email", "probe_dependencies"]
