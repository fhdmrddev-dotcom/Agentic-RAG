"""Admin operations -- backpressure metrics (Phase 078, WORKER-LIFT-04).

Ships the four bottleneck signals as a JSON primitive for the v3.1 ops
dashboard. Auth gated via BACKPRESSURE_ADMIN_USER_IDS env var:
- Production (ENVIRONMENT=production): fail-closed (403 when var unset)
- Dev/local (default): fail-open (any authenticated user)

JSON shape is additive-only (D-078-08) -- v3.1 can add fields without
breaking existing consumers.
"""
import logging

import anyio
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import get_current_user, get_redis, _pg_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _check_backpressure_auth(current_user: dict = Depends(get_current_user)) -> dict:
    """Validate caller against BACKPRESSURE_ADMIN_USER_IDS allow-list.

    D-078-07: fail-closed in production when the env var is unset/empty;
    fail-open in dev so testing works without config.
    """
    env = settings.environment.lower()
    is_production = env in ("production", "prod")
    allow_ids_raw = settings.backpressure_admin_user_ids.strip()

    if not allow_ids_raw:
        if is_production:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin endpoint not configured",
            )
        # Dev/local: fail-open -- no restriction
        return current_user

    allowed = {uid.strip() for uid in allow_ids_raw.split(",") if uid.strip()}
    if current_user["id"] not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    return current_user


@router.get("/backpressure")
async def get_backpressure(
    _user: dict = Depends(_check_backpressure_auth),
):
    """Return worker backpressure metrics for the v3.1 ops dashboard.

    D-078-06: four signals -- anyio_threadpool_depth, redis_active_runs,
    postgres_pool_in_use, per_worker_run_count.
    D-078-08: JSON shape is additive-only -- v3.1 can add fields
    (uptime_seconds, sandbox_active_sessions, memory_rss_mb) without
    breaking existing consumers.
    """
    # 1. AnyIO thread-pool depth
    limiter = anyio.to_thread.current_default_thread_limiter()
    anyio_borrowed = limiter.borrowed_tokens
    anyio_total = limiter.total_tokens

    # 2. Redis -- ZCARD runs:active sorted set (Phase 061+ convention)
    redis_active_runs = 0
    try:
        redis_active_runs = await get_redis().zcard("runs:active")
    except Exception as exc:
        logger.warning("backpressure: Redis unreachable, reporting 0: %s", type(exc).__name__)

    # 3. asyncpg pool -- in-use connections
    pg_in_use = 0
    if _pg_pool is not None:
        try:
            pg_in_use = _pg_pool.get_size() - _pg_pool.get_idle_size()
        except Exception:
            pass

    # 4. RUN_TASKS -- active producer tasks (late-bind import, avoids circular at module load)
    try:
        from app.api.threads import RUN_TASKS
        per_worker_run_count = len(RUN_TASKS)
    except ImportError:
        per_worker_run_count = 0

    return {
        "anyio_threadpool_depth": {
            "borrowed": anyio_borrowed,
            "total": anyio_total,
        },
        "redis_active_runs": redis_active_runs,
        "postgres_pool_in_use": pg_in_use,
        "per_worker_run_count": per_worker_run_count,
    }
