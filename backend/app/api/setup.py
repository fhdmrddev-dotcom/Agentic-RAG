"""Phase 158 (DEPLOY-02, Plan 06) — the pre-auth, token-gated ``/setup/*`` router.

The wire order that mints the first operator, saves the encrypted provider key, runs the
smoke, and writes the dual finalize marker. This surface is the SECURITY WALL: the backend
runs on the service-role key with **no RLS backstop** (v3.3 red-line), so the setup token +
finalize latch are the SOLE access authority — exactly like the ``/admin`` surface's operator
gate, but INVERTED to a pre-auth token gate. A missing token check on ANY ``/setup/*`` write is
a full pre-auth config-write hole.

Two routers:

* ``router`` (prefix ``/setup``) — the write endpoints, EACH gated on
  ``Depends(require_setup_token)``, plus the ONE open ``GET /setup/status`` entry probe.
* ``public_router`` (no prefix) — the ONE open ``GET /public-config`` (D-07), returning ONLY
  the two PUBLIC Supabase values so the browser's Supabase client can bind without a rebuild.

``require_setup_token`` (D-15 / D-14) is the load-bearing dependency. Order matters:

  1. ``setup_finalized()`` → **409** FIRST (D-14 lock-out — a post-finalize write can never
     mutate config even with a valid token; re-config is ``/admin``-only).
  2. rate-limit the token-verify path → **429** (T-158-08 brute-force, atop the 256-bit token
     + constant-time compare).
  3. ``verify_token`` (constant-time ``hmac.compare_digest`` in setup_store) → **401** on a
     missing/wrong token (T-158-01 hijack).

Everything below ORCHESTRATES the shipped 158-05 service seams + 158-03 store seams — it never
forks a seam (no second probe, no second encrypt path, no second operator upsert). The store /
service names are bound at module scope so tests can monkeypatch the boundary.
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request

# Store seams (158-03) — bound at module scope so require_setup_token's finalize-latch + token
# checks are monkeypatchable at the boundary (the idempotency + gate proofs patch these names).
from app.services.setup_store import (
    get_or_create_token,
    setup_finalized,
    verify_token,
)

# Service seams (158-05) — the pure, unit-testable logic the router orchestrates.
from app.services.setup_service import compute_setup_status

logger = logging.getLogger(__name__)


# ── Token-verify rate-limit (D-15 / T-158-08 brute-force) ──────────────────────────────────
# A lightweight in-process sliding window of FAILED verify attempts, keyed by client host. A
# legitimate operator holds the token → succeeds → the window is CLEARED, so honest re-runs
# never accumulate; only sustained failures (a brute-force attacker, who never succeeds) trip
# the 429. Defense-in-depth atop the 256-bit token + constant-time compare — not the primary
# control. Per-process (WORKER_COUNT=2 → each worker throttles independently, which is fine).
_RATE_WINDOW_S = 60.0
_RATE_MAX_FAILURES = 20
_failed_attempts: dict[str, list[float]] = {}


def _too_many_failures(host: str) -> bool:
    """True when ``host`` has ``_RATE_MAX_FAILURES``+ FAILED verifies within the window."""
    now = time.monotonic()
    recent = [t for t in _failed_attempts.get(host, []) if now - t < _RATE_WINDOW_S]
    _failed_attempts[host] = recent
    return len(recent) >= _RATE_MAX_FAILURES


def _record_failure(host: str) -> None:
    _failed_attempts.setdefault(host, []).append(time.monotonic())


def _clear_failures(host: str) -> None:
    _failed_attempts.pop(host, None)


async def require_setup_token(
    request: Request = None,
    x_setup_token: str | None = Header(default=None),
) -> None:
    """The SOLE access authority for every ``/setup/*`` WRITE (no RLS backstop — D-15).

    Load-bearing order: finalize-latch 409 → rate-limit 429 → constant-time token 401. The
    ``request`` default of ``None`` lets the dependency be unit-called directly (the idempotency
    proof invokes ``require_setup_token(x_setup_token=...)`` with no ASGI request).
    """
    # 1. D-14 lock-out FIRST: after finalize, no write can mutate config (re-config is /admin).
    if setup_finalized():
        raise HTTPException(
            status_code=409, detail="Setup already complete — reconfigure from /admin."
        )
    # 2. Rate-limit the token-verify path (brute-force throttle).
    host = request.client.host if (request is not None and request.client) else "direct"
    if _too_many_failures(host):
        raise HTTPException(
            status_code=429, detail="Too many attempts — wait about a minute."
        )
    # 3. Constant-time token verify (hmac.compare_digest in setup_store).
    if not verify_token(x_setup_token):
        _record_failure(host)
        raise HTTPException(status_code=401, detail="Invalid or missing setup token.")
    _clear_failures(host)


# ── Routers ─────────────────────────────────────────────────────────────────────────────────
# NO router-level operator gate (INVERTS admin.py:128): writes gate per-route on
# require_setup_token; /setup/status is OPEN (in the SetupMiddleware allowlist).
router = APIRouter(prefix="/setup", tags=["setup"])
# Top-level, no prefix — nginx strips /api so /api/public-config reaches backend /public-config
# (the SetupMiddleware allowlist exempts it). Registered separately so it is NOT under /setup.
public_router = APIRouter(tags=["setup-public"])


# ── Open routes (no token — the ONLY two un-gated routes) ────────────────────────────────────
@router.get("/status")
async def get_status() -> dict:
    """D-06: the STATIC, blip-proof entry signal — ``{needs_setup, finalized, has_token}``.

    Delegates to ``compute_setup_status`` (a pure string check on the marker + placeholder infra
    — NO live DB probe, so a DB blip can never re-trigger the wizard on a configured box).
    """
    return compute_setup_status()


@public_router.get("/public-config")
async def public_config() -> dict:
    """D-07 (T-158-04): return ONLY the two PUBLIC Supabase values so the browser's Supabase
    client binds without a frontend rebuild. NEVER the service-role key / DSN / any secret.

    ``getattr`` with an empty-string default keeps this route honest on a fresh box where the
    optional ``supabase_anon_key`` field may be absent from ``Settings`` (no AttributeError).
    """
    from app.config import settings as _settings

    return {
        "supabase_url": getattr(_settings, "supabase_url", "") or "",
        "supabase_anon_key": getattr(_settings, "supabase_anon_key", "") or "",
    }
