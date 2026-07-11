"""Admin operations — operator-gated backpressure + identity probe + audit feed.

Every route here inherits the router-level ``require_operator`` gate (Phase 146,
ADMIN-01): a non-operator JWT gets a byte-identical 404 on ALL of them — the
surface is non-discoverable (see tests/test_146_operator_gate.py). The gate lives
at the ROUTER level so a future /admin endpoint can never forget it; there is NO
RLS backstop (the backend runs on the service-role key), so this gate is the sole
authority.

Endpoints:
- GET /admin/backpressure — the four Phase-078 bottleneck signals (shape unchanged,
  D-078-06/08 additive-only); audit-floor attached (recorded operator action).
- GET /admin/me — operator identity probe; floor-EXEMPT (mount probes must not spam
  the ledger — Pitfall 4 / D-04).
- GET /admin/audit — recent operator actions feed for the Control Room ledger;
  audit-floor attached (viewing the ledger is itself a recorded action).
"""
import logging

import anyio
from fastapi import APIRouter, Depends, Request

import app.dependencies as deps
from app.dependencies import (
    get_redis,
    operator_audit_floor,
    require_operator,
)
from app.services.operator_service import (
    get_operator_record,
    get_recent_operator_audit,
)

logger = logging.getLogger(__name__)

# The single load-bearing security line: default-deny at the router (Pattern 1).
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_operator)],
)


@router.get("/backpressure")
async def get_backpressure():
    """Return worker backpressure metrics + dependency-health for the ops dashboard.

    D-078-06: four signals — anyio_threadpool_depth, redis_active_runs,
    postgres_pool_in_use, per_worker_run_count.
    D-078-08: JSON shape is additive-only — Phase 147 (ADMIN-02) APPENDS a top-level
    ``dependencies`` block (redis / supabase / sandbox reachability + latency + the
    3-state sandbox) WITHOUT touching the four original keys.

    Phase 147 D-07: this endpoint is now floor-EXEMPT (the ``operator_audit_floor``
    dependency + the audit_label/action lines are REMOVED). The Control Plane
    auto-polls it every ~10s while open; recording every poll would spam the ledger
    with non-actions. The ONE deliberate "Viewed system health" ledger row is written
    by ``POST /admin/control-plane/record`` on a manual refresh instead. The
    ``GET /admin/me`` no-floor probe is the exempt precedent.
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

    # 3. asyncpg pool -- in-use connections.
    # CR-02: read the pool via the LIVE module attribute (deps._pg_pool), NOT a
    # from-import snapshot. `from app.dependencies import _pg_pool` copies the
    # binding at import time (when the singleton is still None); get_pg_pool()
    # later rebinds app.dependencies._pg_pool, but the copied name stays None
    # forever, so this signal was structurally always 0 in production.
    pool = deps._pg_pool
    pg_in_use = 0
    if pool is not None:
        try:
            pg_in_use = pool.get_size() - pool.get_idle_size()
        except Exception:
            pass

    # 4. RUN_TASKS -- active producer tasks (late-bind import, avoids circular at module load)
    try:
        from app.api.threads import RUN_TASKS
        per_worker_run_count = len(RUN_TASKS)
    except ImportError:
        per_worker_run_count = 0

    # 5. Dependency-health probes (Phase 147 ADMIN-02) — ADDITIVE, concurrent,
    # best-effort (each degrades to down/off; never raises out of the endpoint).
    from app.services.health_probe import probe_dependencies
    dependencies = await probe_dependencies()

    return {
        "anyio_threadpool_depth": {
            "borrowed": anyio_borrowed,
            "total": anyio_total,
        },
        "redis_active_runs": redis_active_runs,
        "postgres_pool_in_use": pg_in_use,
        "per_worker_run_count": per_worker_run_count,
        "dependencies": dependencies,
    }


@router.get("/me")
async def get_operator_me(request: Request):
    """Operator identity probe — floor-EXEMPT (Pitfall 4).

    The router gate already 404'd non-operators; operators get their identity
    ``{id, email, granted_at}`` for the Control Room band. NO operator_audit_floor
    attached — the frontend probes this on EVERY app mount, and logging it would
    fill the ledger with non-actions (D-04: every ledger row is a deliberate human
    action).
    """
    op = request.state.operator  # set by require_operator (router gate)
    record = await get_operator_record(op["id"])
    granted_at = record.get("granted_at") if record else None
    return {"id": op["id"], "email": op["email"], "granted_at": granted_at}


@router.get("/audit")
async def get_operator_audit_feed(
    request: Request,
    limit: int = 50,
    _floor: None = Depends(operator_audit_floor),
):
    """Recent operator actions feed for the Control Room ledger card.

    Reads the latest N ``operator_audit_log`` rows (created_at DESC). Floor-attached —
    viewing the ledger is itself a recorded operator action (plain label "Viewed
    recent actions" / action "audit.view").
    """
    request.state.audit_label = "Viewed recent actions"
    request.state.audit_action = "audit.view"
    entries = await get_recent_operator_audit(limit=limit)
    return {"entries": entries}
