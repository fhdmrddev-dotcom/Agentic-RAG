"""Phase 137.1 Plan 03 (EVAL-05g / BUG-260702-02) — boot-time orphan run reconciler.

A CAS-guarded startup sweep that closes the restart-orphan gap: when a backend
restart (deploy / container recycle / crash) kills the in-process asyncio task
driving a run, that run's terminal DB transition is never written and its row is
stranded non-terminal FOREVER — the user sees a run "running" with no error, no
timeout, no recovery. On the next boot this module honestly terminalizes those
orphans and drops their stale Redis streams. 137 already ships the DISPLAY half
(interrupted banner + re-run); this is the WRITER half.

It is a near-copy of ``harness_engine.resume_stranded_workflows`` — the shipped,
battle-tested lifespan-spawned sweep — but WRITES terminal statuses instead of
re-driving the run:

  - a non-terminal ``eval_runs`` row (status ``running``) whose ``id`` is absent
    from the Redis ``runs:active`` sorted set  →  ``interrupted``
  - a non-terminal companion ``runs`` row (status ``streaming`` / ``cap_paused``)
    absent from ``runs:active``                →  ``failed``
  - the stale ``run:{run_id}`` stream is dropped in both cases

This is EXACTLY the 2026-07-02 manual cleanup (eval → interrupted, chat → failed,
drop stale ``run:*`` streams), made self-healing.

STALENESS PREDICATE (D-10 / Pitfall 6 / T-137.1-RC1): non-terminal in Postgres AND
absent from ``runs:active`` (the AUTHORITATIVE "currently streaming" set — CLAUDE.md
run-buffer key conventions). A run PRESENT in ``runs:active`` is NEVER flipped — it is
genuinely live. If liveness can't be verified (a Redis hiccup on the membership read)
the row is SKIPPED, never flipped — the safe default.

WORKER-SAFETY (D-09 / T-137.1-RC2): a single-shot Redis ``SET NX`` guard
(``run_reconcile_lock``) means exactly ONE worker performs the sweep under
WORKER_COUNT=2; the racing sibling acquires nothing and returns 0. The guard TTL
self-expires so the NEXT restart re-runs the sweep.

BOUNDARY (D-10 / D-14 / G-5): this module ONLY writes DB statuses + drops streams.
It is additive, lives OUTSIDE ``threads.py`` (G-5), and never imports or touches the
shared Deep chat path (D-14). Best-effort per-row try/except so one bad row never
aborts the sweep; every blocking supabase-py call is wrapped in ``run_in_threadpool``
(D-v2.5-01). Spawned as a best-effort background task (T-137.1-RC3), a slow or failed
sweep never blocks startup.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi.concurrency import run_in_threadpool

from app.db.runs import finalize_run

logger = logging.getLogger(__name__)

# Single-shot boot guard (D-09 / T-137.1-RC2). The KEY's existence is the lock; the
# value is an inert marker. A few-minutes TTL covers the WORKER_COUNT=2 boot skew +
# the sweep duration, then self-expires so the NEXT restart re-runs the sweep.
_RECONCILE_LOCK_KEY = "run_reconcile_lock"
_RECONCILE_LOCK_TTL_S = 300

# The authoritative liveness set (CLAUDE.md run-buffer key conventions). A run present
# here is genuinely streaming and must never be flipped (T-137.1-RC1 / Pitfall 6).
_ACTIVE_SET_KEY = "runs:active"

# Non-terminal companion ``runs`` statuses. runs_status_check (supabase/full-schema.sql)
# is streaming / cap_paused / completed / failed / cancelled / timed_out — the first two
# are the only non-terminal values → the orphan candidates.
_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]

# Honest, short (<200 char — T-133-04 precedent) reconciliation error notes: never leak
# raw tracebacks into the RLS-readable error column.
_ERROR_EVAL = "interrupted: orphaned by backend restart (reconciled at boot)"
_ERROR_CHAT = "failed: orphaned by backend restart (reconciled at boot)"


async def reconcile_orphaned_runs(*, pool, redis, supabase) -> int:
    """Boot-time orphan sweep — terminalize stranded non-terminal runs (EVAL-05g).

    Acquires a single-shot ``SET NX`` guard so only ONE worker sweeps
    (WORKER_COUNT=2 safe); the loser returns 0 immediately. Then flips ``eval_runs``
    orphans → ``interrupted`` and companion ``runs`` orphans → ``failed`` (staleness
    = non-terminal in Postgres AND absent from ``runs:active``), dropping each stale
    ``run:{run_id}`` stream. Returns the count of runs terminalized.
    """
    acquired = await redis.set(
        _RECONCILE_LOCK_KEY, "1", nx=True, ex=_RECONCILE_LOCK_TTL_S
    )
    if not acquired:
        # A sibling worker holds the guard — it owns this boot's sweep. No double-run.
        return 0

    flipped = 0
    flipped += await _reconcile_eval_runs(redis, supabase)
    flipped += await _reconcile_chat_runs(pool, redis)
    if flipped:
        logger.info("Run reconciler terminalized %d orphaned run(s)", flipped)
    return flipped


async def _reconcile_eval_runs(redis, supabase) -> int:
    """Flip ``running`` eval_runs rows absent from ``runs:active`` → ``interrupted``.

    Service-role read/write (this is a boot sweep, not a request) scoped by row id;
    the ``.eq('status', 'running')`` on the UPDATE is a CAS so a row that raced to a
    real terminal status in between is left untouched. supabase-py is blocking →
    ``run_in_threadpool`` (D-v2.5-01).
    """
    def _query():
        return (
            supabase.table("eval_runs")
            .select("id")
            .eq("status", "running")
            .execute()
        )

    try:
        resp = await run_in_threadpool(_query)
    except Exception:
        logger.exception("reconcile: eval_runs 'running' query failed (app continues)")
        return 0

    rows = getattr(resp, "data", None) or []
    flipped = 0
    for row in rows:
        run_id = row.get("id") if isinstance(row, dict) else None
        if not run_id:
            continue
        try:
            if not await _is_orphan(redis, run_id):
                continue  # present in runs:active → genuinely live (T-137.1-RC1)

            def _update(_rid=run_id):
                return (
                    supabase.table("eval_runs")
                    .update({
                        "status": "interrupted",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "error": _ERROR_EVAL,
                    })
                    .eq("id", str(_rid))
                    .eq("status", "running")  # CAS — only if still running
                    .execute()
                )

            await run_in_threadpool(_update)
            await _drop_stream(redis, run_id)
            flipped += 1
        except Exception:
            logger.exception("reconcile: failed to terminalize eval run %s", run_id)
    return flipped


async def _reconcile_chat_runs(pool, redis) -> int:
    """Finalize non-terminal companion ``runs`` rows absent from ``runs:active`` → ``failed``.

    Uses ``db.runs.finalize_run`` (the same terminal writer the live producer uses) so
    reattach/cancel parity holds. asyncpg is natively async — no threadpool.
    """
    try:
        rows = await pool.fetch(
            "SELECT run_id FROM runs WHERE status = ANY($1::text[])",
            _NON_TERMINAL_CHAT_STATUSES,
        )
    except Exception:
        logger.exception("reconcile: runs non-terminal query failed (app continues)")
        return 0

    flipped = 0
    for row in rows:
        run_id = row["run_id"]
        try:
            if not await _is_orphan(redis, run_id):
                continue  # present in runs:active → genuinely live (T-137.1-RC1)

            await finalize_run(
                pool,
                run_id=run_id,
                status="failed",
                error=_ERROR_CHAT,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=None,
                output_tokens=None,
            )
            await _drop_stream(redis, run_id)
            flipped += 1
        except Exception:
            logger.exception("reconcile: failed to terminalize chat run %s", run_id)
    return flipped


async def _is_orphan(redis, run_id) -> bool:
    """True when ``run_id`` is ABSENT from ``runs:active`` (the authoritative streaming
    set). A present run is live and must never be flipped (T-137.1-RC1 / Pitfall 6).

    A raised exception here (Redis hiccup) propagates to the per-row handler, which
    logs and SKIPS the row — never flips on unverifiable liveness (the safe default).
    """
    score = await redis.zscore(_ACTIVE_SET_KEY, str(run_id))
    return score is None


async def _drop_stream(redis, run_id) -> None:
    """Drop the stale ``run:{run_id}`` stream + defensively evict from ``runs:active``.
    Best-effort — a Redis hiccup here never unwinds the DB terminalization already done."""
    try:
        await redis.delete(f"run:{run_id}")
        await redis.zrem(_ACTIVE_SET_KEY, str(run_id))
    except Exception:
        logger.exception("reconcile: stale stream drop failed for run %s", run_id)


__all__ = ["reconcile_orphaned_runs"]
