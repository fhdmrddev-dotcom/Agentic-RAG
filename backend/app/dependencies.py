import json
import logging

import asyncpg
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client

from app.config import settings
from app.services.operator_service import is_operator, write_operator_audit

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

_supabase: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase


_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the singleton async Redis client (Phase 061 — D-061-13).

    Mirrors get_supabase(): module-level cache, lazy init, no I/O at call
    time (from_url only sets up pool config; the first awaited command
    does the TCP connect). Closed in app lifespan via await aclose().

    decode_responses=True: XREAD entries arrive as str (not bytes) so the
    consumer can json.loads(entry['data']) without a manual .decode().
    socket_timeout / socket_connect_timeout: defense against Pitfall 7
    (producer's finally hanging on a half-dead Redis socket).
    """
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=10,
            socket_connect_timeout=5,
        )
    return _redis


_pg_pool: asyncpg.Pool | None = None


async def _init_pg_connection(conn: asyncpg.Connection) -> None:
    """Register JSONB codec on every newly-created Connection (Phase 073 — D-073-06).

    D-073-06 wording references ``pool.set_type_codec`` but asyncpg has NO such
    pool-level method (Pitfall 5). Codec registration happens per Connection via
    the ``init=`` callback passed to ``create_pool``. Semantically identical: the
    codec is set once per Connection at pool init.

    Without this, asyncpg returns jsonb as ``str`` (forcing per-call json.loads)
    and accepts jsonb writes as ``str`` only (forcing per-call json.dumps).
    Registering here lets call sites pass plain Python dicts/lists for
    tool_calls / source_refs / confidence_* / runs.error.
    """
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )


async def get_pg_pool() -> asyncpg.Pool:
    """Return the singleton asyncpg pool (Phase 073 — D-073-01/02/03/06).

    Mirrors ``get_redis()``: module-level cache, lazy init at first call, no I/O
    at call time (``create_pool`` returns immediately; the first acquire does the
    TCP handshake). Closed in app lifespan via ``await pool.close()`` with a
    ``asyncio.wait_for(..., timeout=5.0)`` fallback to ``pool.terminate()``
    (Pitfall 4 — pool.close() can wedge on stuck queries).

    DSN comes from POSTGRES_DSN env var (D-073-02). Pool sized via
    POSTGRES_POOL_MIN / POSTGRES_POOL_MAX (D-073-03, default 2/10 — leaves
    headroom for Phase 079 ``--workers 2`` at effective ceiling 20 connections).

    Event-loop binding (Pitfall 1): the pool is bound to whatever event loop
    called ``create_pool``. In tests, this requires the ``_reset_pg_pool_singleton``
    autouse fixture (D-073-12, Task 4) to reset between tests.
    """
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = await asyncpg.create_pool(
            settings.postgres_dsn,
            min_size=settings.postgres_pool_min,
            max_size=settings.postgres_pool_max,
            init=_init_pg_connection,
            command_timeout=30,
        )
    return _pg_pool


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# ── Phase 146 (ADMIN-01) — operator gate + append-only audit floor ────────────
# Byte-identical to Starlette's unknown-route 404 (non-discoverable). Do NOT
# customize the body — the whole point is that a non-operator cannot tell an
# /admin route exists-but-forbidden vs. simply not existing (404-not-403).
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")

# WR-02: /admin gets its OWN bearer scheme with auto_error=False, used ONLY by the
# operator gate. The shared ``bearer_scheme`` (auto_error=True) raises 403 on an
# ABSENT Authorization header — so a request with no JWT to a real /admin route
# returned 403 while /admin/<unknown> returned 404, letting an anonymous scanner
# enumerate gated routes (defeating the non-discoverability claim). auto_error=False
# hands us ``None`` for absent credentials so we fold every auth failure into the
# SAME byte-identical 404. The shared get_current_user path is unchanged.
_admin_bearer_scheme = HTTPBearer(auto_error=False)

# Plain-sentence label + machine action code, keyed by /admin path. Endpoints may
# also set request.state.audit_label / audit_action explicitly; these are the
# route-derived fallbacks the floor uses when they did not.
_AUDIT_LABELS: dict[str, tuple[str, str]] = {
    "/admin/backpressure": ("Viewed system health", "health.view"),
    "/admin/audit": ("Viewed recent actions", "audit.view"),
}


def _derive_plain_label(request: Request) -> str:
    return _AUDIT_LABELS.get(request.url.path, ("Performed an operator action", ""))[0]


def _derive_action(request: Request) -> str:
    known = _AUDIT_LABELS.get(request.url.path)
    if known:
        return known[1]
    # "<area>.<verb>" fallback: last non-'admin' path segment + ".view".
    parts = [p for p in request.url.path.split("/") if p and p != "admin"]
    area = parts[-1] if parts else "admin"
    return f"{area}.view"


async def authenticate_operator_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(_admin_bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Resolve the caller for the /admin surface, folding EVERY auth failure into 404.

    WR-02: the non-discoverability contract (404-not-403) must hold BEFORE auth, not
    only after. This uses the dedicated ``_admin_bearer_scheme`` (auto_error=False) so
    an ABSENT Authorization header yields ``None`` here (instead of the shared scheme's
    403), and an invalid/expired token — or any resolution error — is folded into the
    SAME byte-identical ``_NOT_FOUND``. An anonymous scanner therefore cannot tell a
    gated /admin route (404) apart from a nonexistent one (404).

    A dedicated dependency (rather than reusing ``get_current_user``) keeps the shared
    auth path untouched AND gives tests a clean override seam (conftest overrides this
    to inject a fake operator identity; the WR-02 regression pops the override to
    exercise the real pre-auth 404 path).
    """
    if credentials is None:
        raise _NOT_FOUND
    try:
        response = supabase.auth.get_user(credentials.credentials)
        user = getattr(response, "user", None)
    except Exception:
        raise _NOT_FOUND
    if user is None:
        raise _NOT_FOUND
    return {"id": user.id, "email": user.email}


async def require_operator(
    request: Request,
    current_user: dict = Depends(authenticate_operator_request),
) -> dict:
    """Router-level default-deny gate for every /admin route (Pattern 1).

    ``authenticate_operator_request`` already folded an absent/invalid JWT into a
    byte-identical 404 (WR-02). On non-membership raise the same byte-identical 404
    (non-discoverable — 404-not-403). On membership, stash the operator on
    ``request.state`` for the audit floor + the ``/admin/me`` probe, and return the
    identity. The backend runs on the service-role key with NO RLS backstop, so this
    gate is the SOLE authority (Pitfall 1). Attach at the ROUTER level (never
    per-endpoint) so a future /admin endpoint cannot forget it.
    """
    if not await is_operator(current_user["id"]):
        raise _NOT_FOUND
    request.state.operator = current_user
    return current_user


async def operator_audit_floor(
    request: Request,
    supabase: Client = Depends(get_supabase),
):
    """Append-only audit floor as a yield-dependency (Pattern 2).

    Attach PER-ACTION-ENDPOINT (never at the router level) so the ``GET /admin/me``
    mount probe stays floor-EXEMPT (Pitfall 4 — probes must not spam the ledger). The
    teardown runs AFTER the response (off the latency path): it reads an enrich
    label/action/is_write from ``request.state`` (falling back to a route-derived plain
    label/action), and writes exactly ONE ``operator_audit_log`` row — no UPDATE,
    preserving immutability. Wrapped in try/except that logs and swallows — the floor
    never raises into the request.
    """
    yield
    try:
        op = getattr(request.state, "operator", None)
        if op is None:
            return  # the gate already 404'd a non-operator — nothing to record
        label = getattr(request.state, "audit_label", None) or _derive_plain_label(request)
        action = getattr(request.state, "audit_action", None) or _derive_action(request)
        is_write = getattr(request.state, "audit_is_write", False)
        await write_operator_audit(
            operator_user_id=op["id"],
            action=action,
            label=label,
            is_write=is_write,
            metadata={},
            supabase=supabase,
        )
    except Exception as exc:
        logger.error("operator audit floor failed: %s", exc)  # swallow (D-05 precedent)
