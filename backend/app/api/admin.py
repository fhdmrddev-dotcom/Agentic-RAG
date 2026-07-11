"""Admin operations — operator-gated backpressure + identity probe + audit feed.

Every route here inherits the router-level ``require_operator`` gate (Phase 146,
ADMIN-01): a non-operator JWT gets a byte-identical 404 on ALL of them — the
surface is non-discoverable (see tests/test_146_operator_gate.py). The gate lives
at the ROUTER level so a future /admin endpoint can never forget it; there is NO
RLS backstop (the backend runs on the service-role key), so this gate is the sole
authority.

Endpoints:
- GET /admin/backpressure — the four Phase-078 bottleneck signals + the Phase-147
  additive dependency-health block (D-078-06/08 additive-only); floor-EXEMPT (D-07 —
  the Control Plane auto-polls it, so logging every poll would spam the ledger).
- GET /admin/runs — cross-user active-runs list with honest kind badges (chat /
  workflow / eval / tuner, D-Q1 Option A no-migration) + a server-derived
  not_responding signal; floor-EXEMPT poll (D-07).
- GET /admin/me — operator identity probe; floor-EXEMPT (mount probes must not spam
  the ledger — Pitfall 4 / D-04).
- GET /admin/audit — recent operator actions feed for the Control Room ledger;
  audit-floor attached (viewing the ledger is itself a recorded action).
- POST /admin/control-plane/record — the ONE deliberate ledger row per Control Plane
  visit + per manual refresh (D-07); floor-ATTACHED, server-owned (label, action).
"""
import logging
from typing import Literal

import anyio
from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel

import app.dependencies as deps
from app.config import settings
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

# Kill is wired day-one for chat + workflow only (D-01); eval/tuner are bounded internal
# jobs that end on their own (no operator-side cancel this phase).
_KILLABLE_KINDS = {"chat", "workflow"}

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


def _uuid_list(ids):
    """Coerce an iterable of id strings to ``uuid.UUID`` for a ``$1::uuid[]`` param.

    The codebase's asyncpg array pattern passes ``UUID`` objects (harness/freshness.py).
    A non-UUID member (shouldn't happen — all run/thread/user ids are uuid4) is dropped
    rather than raising, so one bad id never sinks the whole enrichment query.
    """
    import uuid as _uuid

    out = []
    for i in ids:
        try:
            out.append(_uuid.UUID(str(i)))
        except (ValueError, AttributeError, TypeError):
            continue
    return out


async def _derive_not_responding(redis, run_id, stale_timeout_ms, started_at, grace_ms) -> bool:
    """Server-derived stalled-stream signal for a chat/workflow run (RESEARCH Open Q3).

    REUSES the reconciler's stream-age oracle (``run_reconciler._is_chat_orphan`` — the
    ``run:{run_id}`` last-write-age check with its start-grace) READ-ONLY: no edit to
    run_reconciler.py, no re-derivation of the age math. A run inside the start-grace,
    or a fresh stream, is not stalled → False; a missing/stale stream past grace → True.
    Any failure to VERIFY liveness (a real Redis fault the oracle re-raises) degrades to
    False — we never paint a false "not responding" tag on a transient hiccup.
    """
    try:
        from app.services.run_reconciler import _is_chat_orphan

        return bool(
            await _is_chat_orphan(redis, run_id, stale_timeout_ms, started_at, grace_ms)
        )
    except Exception:
        return False


@router.get("/runs")
async def get_active_runs():
    """Cross-user active-runs list with honest kind badges — floor-EXEMPT (D-07).

    D-Q1 (Option A, NO migration): ZRANGE ``runs:active`` WITHSCORES → batch-enrich the
    ids that HAVE a ``runs`` row (chat / workflow / eval); the ids with NO ``runs`` row
    are tuner jobs (Redis-only writer). Split the enriched rows: eval when
    ``eval_runs.id`` == run_id (the companion row shares the UUID); workflow when the
    run's thread carries an ``active_workflow_run_id``; chat otherwise.

    ``killable`` is true ONLY for chat + workflow (D-01). ``started_at`` is the ZRANGE
    score (unix epoch) — the client computes elapsed (D-07, no server ticking).
    ``not_responding`` is server-derived for chat/workflow via the reconciler oracle;
    eval/tuner rows are always false. Cross-user reads are METADATA ONLY — user/model/
    elapsed, never thread contents (sketch linkage rule #11). The router gate is the
    sole authority (byte-identical 404 to non-operators; no RLS backstop).
    """
    redis = get_redis()
    try:
        entries = await redis.zrange("runs:active", 0, -1, withscores=True)
    except Exception as exc:
        logger.warning("active-runs: Redis unreachable (%s), returning empty", type(exc).__name__)
        return {"runs": []}
    if not entries:
        return {"runs": []}

    # started_at per active run (unix epoch score → client elapsed math, D-07)
    started_by_id: dict[str, float] = {}
    for member, score in entries:
        rid = member.decode() if isinstance(member, (bytes, bytearray)) else member
        started_by_id[rid] = float(score)
    active_ids = list(started_by_id.keys())

    pool = deps._pg_pool  # CR-02: live module attribute, never an import snapshot
    runs_by_id: dict[str, object] = {}
    eval_ids: set[str] = set()
    workflow_thread_ids: set[str] = set()
    email_by_user: dict[str, str] = {}

    if pool is not None:
        # 1. Batch-enrich the ids that have a runs row (chat/workflow/eval).
        try:
            rows = await pool.fetch(
                "SELECT run_id, thread_id, user_id, model, provider, status, started_at "
                "FROM runs WHERE run_id = ANY($1::uuid[])",
                _uuid_list(active_ids),
            )
            for r in rows:
                runs_by_id[str(r["run_id"])] = r
        except Exception:
            logger.exception("active-runs: runs enrichment failed (continuing)")

        if runs_by_id:
            row_ids = list(runs_by_id.keys())
            thread_ids = [str(r["thread_id"]) for r in runs_by_id.values() if r["thread_id"]]
            user_ids = [str(r["user_id"]) for r in runs_by_id.values() if r["user_id"]]

            # 2. Eval detection — eval_runs.id doubles as the companion run_id.
            try:
                eval_rows = await pool.fetch(
                    "SELECT id FROM eval_runs WHERE id = ANY($1::uuid[])", _uuid_list(row_ids)
                )
                eval_ids = {str(e["id"]) for e in eval_rows}
            except Exception:
                logger.exception("active-runs: eval detection failed (continuing)")

            # 3. Workflow detection — a run whose thread has an active workflow run.
            if thread_ids:
                try:
                    wf_rows = await pool.fetch(
                        "SELECT id FROM threads WHERE active_workflow_run_id IS NOT NULL "
                        "AND id = ANY($1::uuid[])",
                        _uuid_list(thread_ids),
                    )
                    workflow_thread_ids = {str(w["id"]) for w in wf_rows}
                except Exception:
                    logger.exception("active-runs: workflow detection failed (continuing)")

            # 4. user_email enrichment (metadata only — linkage rule #11; never content).
            if user_ids:
                try:
                    user_rows = await pool.fetch(
                        "SELECT id, email FROM auth.users WHERE id = ANY($1::uuid[])",
                        _uuid_list(user_ids),
                    )
                    email_by_user = {str(u["id"]): u["email"] for u in user_rows}
                except Exception:
                    logger.exception("active-runs: user email enrichment failed (continuing)")

    stale_timeout_ms = settings.run_stale_sweep_timeout_seconds * 1000
    grace_ms = settings.run_start_grace_seconds * 1000

    runs_out = []
    for rid in active_ids:
        row = runs_by_id.get(rid)
        started_at = started_by_id.get(rid)

        if row is None:
            # No runs row → tuner (Redis-only writer). No Kill (D-01); generic label.
            runs_out.append({
                "run_id": rid,
                "kind": "tuner",
                "thread_id": None,
                "user_id": None,
                "user_email": None,
                "model": None,
                "provider": None,
                "started_at": started_at,
                "killable": False,
                "not_responding": False,
            })
            continue

        if rid in eval_ids:
            kind = "eval"
        elif str(row["thread_id"]) in workflow_thread_ids:
            kind = "workflow"
        else:
            kind = "chat"

        not_responding = False
        if kind in _KILLABLE_KINDS:
            not_responding = await _derive_not_responding(
                redis, rid, stale_timeout_ms, row["started_at"], grace_ms
            )

        uid = str(row["user_id"]) if row["user_id"] else None
        runs_out.append({
            "run_id": rid,
            "kind": kind,
            "thread_id": str(row["thread_id"]) if row["thread_id"] else None,
            "user_id": uid,
            "user_email": email_by_user.get(uid) if uid else None,
            "model": row["model"],
            "provider": row["provider"],
            "started_at": started_at,
            "killable": kind in _KILLABLE_KINDS,
            "not_responding": not_responding,
        })

    return {"runs": runs_out}


class ControlPlaneRecord(BaseModel):
    """Body for POST /admin/control-plane/record — the event is a server-owned enum.

    T-147-13: the client supplies ONLY this Literal; the server owns the (label, action)
    mapping, so no free-text action/label string ever reaches operator_audit_log.
    """

    event: Literal["visit", "refresh"]


# Server-owned event → (audit label, audit action). The ONLY strings that reach the
# ledger for a Control Plane read (D-07): the deliberate visit row + the manual ↻ row.
_RECORD_MAP = {
    "visit": ("Opened the Control Plane", "control_plane.visit"),
    "refresh": ("Viewed system health", "health.view"),
}


@router.post("/control-plane/record", status_code=status.HTTP_204_NO_CONTENT)
async def record_control_plane_event(
    request: Request,
    body: ControlPlaneRecord,
    _floor: None = Depends(operator_audit_floor),
):
    """Write the ONE deliberate ledger row per Control Plane visit / manual refresh (D-07).

    The poll GETs (``/backpressure``, ``/runs``) are floor-EXEMPT; this floor-ATTACHED
    endpoint is how the ledger stays an honest record of deliberate human actions. The
    event is a Pydantic ``Literal`` (unknown → 422); the server maps it to a hardcoded
    (label, action). ``is_write=False`` — these are reads (receipts), not mutations.
    """
    label, action = _RECORD_MAP[body.event]
    request.state.audit_label = label
    request.state.audit_action = action
    request.state.audit_is_write = False
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
