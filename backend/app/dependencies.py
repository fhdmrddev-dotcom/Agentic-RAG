import json

import asyncpg
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client

from app.config import settings

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
