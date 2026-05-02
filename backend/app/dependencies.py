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
