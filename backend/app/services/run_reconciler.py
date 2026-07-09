"""Phase 137.1 Plan 03 + Phase 145 Plan 04 (EVAL-05g / FND-01) — orphan run reconciler.

A CAS-guarded sweep — run BOTH at boot AND on a periodic interval (main.py) — that
closes the orphan gap: a run whose in-process producer died (backend restart / deploy
/ crash / broken SSE) never wrote its terminal DB transition, so its row is stranded
non-terminal FOREVER — the user sees a run "running" with no error, no timeout, no
recovery. This module honestly terminalizes those orphans and drops their stale Redis
streams. 137 ships the DISPLAY half (interrupted banner + re-run); this is the WRITER.

AUTHORITY MODEL (Phase 145 D-145-01, superseding the 137.1 framing): **Postgres
``runs.status`` is AUTHORITATIVE.** ``runs:active`` is a DERIVED liveness mirror the
Plan 02 owner (``run_lifecycle``) co-writes alongside the status. Because that owner
keeps the mirror in lock-step, a dead-producer orphan now STAYS PRESENT in
``runs:active`` — so membership is BLIND to it (145-REPRO Direction B). Reconciliation
therefore trusts ``runs.status`` + the STREAM-AGE oracle for CHAT runs, not membership.

CHAT ORPHAN PREDICATE (Phase 145 D-145-06 — the crux): a non-terminal companion
``runs`` row (``streaming`` / ``cap_paused``) whose ``run:{run_id}`` Redis stream is
MISSING, or whose ``last-generated-id`` is older than STALE_TIMEOUT
(``settings.run_stale_sweep_timeout_seconds`` = 2400s, > the 1800s ask_user ceiling so
a live-but-quiet run is never killed — D-145-07), is terminalized to ``failed`` via
``run_lifecycle.finalize_run_terminal`` (co-writing the ZREM). Age is grounded on the
Redis clock (``redis.time()``) — no app↔Redis skew (Pitfall 4). A live long run keeps
its stream fresh; a dead producer's stream goes stale. If liveness can't be verified (a
NON-"no such key" Redis fault on the age read) the row is SKIPPED, never flipped — the
safe default (Pitfall 6). ``cap_paused`` is the legitimate, re-attachable iteration-cap
pause: the PERIODIC sweep EXCLUDES it (``include_cap_paused=False``, Pitfall 3); the
BOOT sweep keeps covering it.

EVAL ORPHAN PREDICATE (UNCHANGED — D-145-12): the eval/tuner status writers were NOT
migrated to the owner this phase, so ``runs:active`` MEMBERSHIP is still the correct
oracle for a ``running`` ``eval_runs`` row (a live eval run is present; a dead one
absent). A row ABSENT from ``runs:active`` → ``interrupted``. Only the CHAT predicate
changed to stream-age; ``_is_orphan`` (membership) is preserved for eval.

WORKER-SAFETY (D-09 / D-145-08 / T-137.1-RC2): a single-shot Redis ``SET NX`` guard
(``run_reconcile_lock``) means exactly ONE worker performs each sweep under
WORKER_COUNT=2; the racing sibling acquires nothing and returns 0. The boot sweep uses
a generous TTL (300s); the periodic caller passes a SHORT ``lock_ttl`` (90s) < the 120s
tick so the guard self-expires before the next tick and exactly one worker sweeps per
tick.

BOUNDARY (D-10 / D-14 / G-5): this module ONLY decides orphan-ness + routes the terminal
write through the owner + drops streams. It is additive, lives OUTSIDE ``threads.py``
(G-5), and never imports or touches the shared Deep chat path (D-14). Best-effort
per-row try/except so one bad row never aborts the sweep; every blocking supabase-py
call is wrapped in ``run_in_threadpool`` (D-v2.5-01). Cross-worker cancel is OUT of
scope (flagged to SEED-109, D-145). Spawned as a best-effort background task
(T-137.1-RC3), a slow or failed sweep never blocks startup.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi.concurrency import run_in_threadpool
from redis.exceptions import ResponseError

from app.config import settings
from app.services.run_lifecycle import finalize_run_terminal

logger = logging.getLogger(__name__)

# Single-shot boot guard (D-09 / T-137.1-RC2). The KEY's existence is the lock; the
# value is an inert marker. A few-minutes TTL covers the WORKER_COUNT=2 boot skew +
# the sweep duration, then self-expires so the NEXT restart re-runs the sweep.
_RECONCILE_LOCK_KEY = "run_reconcile_lock"
_RECONCILE_LOCK_TTL_S = 300

# The derived liveness mirror (CLAUDE.md run-buffer key conventions). Under Phase 145
# D-145-02 the owner co-writes this, so it is NO LONGER the chat oracle (a dead-producer
# orphan STAYS present — membership is blind). It remains the EVAL membership oracle
# (D-145-12) and the ZREM target used by ``_drop_stream``.
_ACTIVE_SET_KEY = "runs:active"

# Non-terminal companion ``runs`` statuses. runs_status_check (supabase/full-schema.sql)
# is streaming / cap_paused / completed / failed / cancelled / timed_out — the first two
# are the only non-terminal values → the orphan candidates. ``cap_paused`` is EXCLUDED
# from the periodic sweep (Pitfall 3) — see ``_reconcile_chat_runs``.
_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]

# Honest, short (<200 char — T-133-04 / T-073-04 precedent) reconciliation error notes:
# identifier-only, never a raw traceback, into the RLS-readable error column. The chat
# note is NOT restart-specific (the periodic sweep catches mid-run producer deaths too).
_ERROR_EVAL = "interrupted: orphaned by backend restart (reconciled at boot)"
_ERROR_CHAT = "failed: orphaned — stream stale, reconciled by staleness sweep"


async def reconcile_orphaned_runs(
    *,
    pool,
    redis,
    supabase,
    stale_timeout_ms: int | None = None,
    lock_ttl: int | None = None,
    include_cap_paused: bool = True,
) -> int:
    """Orphan sweep — terminalize stranded non-terminal runs (EVAL-05g / FND-01).

    Runs at BOOT (main.py ``_reconcile_orphans``, defaults) and PERIODICALLY (main.py
    ``_reconcile_orphans_periodic``, ``lock_ttl=90`` + ``include_cap_paused=False``).

    Acquires a single-shot ``SET NX`` guard (TTL ``lock_ttl``, default
    ``_RECONCILE_LOCK_TTL_S``) so only ONE worker sweeps per invocation
    (WORKER_COUNT=2 safe, D-145-08); the loser returns 0 immediately. Then flips:
      - ``eval_runs`` orphans → ``interrupted`` — membership oracle, UNCHANGED (D-145-12).
      - companion ``runs`` orphans → ``failed`` — STREAM-AGE oracle (D-145-06): the
        ``run:{run_id}`` stream is MISSING or its ``last-generated-id`` is older than
        ``stale_timeout_ms`` (default ``settings.run_stale_sweep_timeout_seconds*1000``
        = 2400s), routed through the ``run_lifecycle`` owner (co-writes the ZREM).
    ``include_cap_paused=False`` (the periodic caller) drops ``cap_paused`` from the chat
    candidate set (Pitfall 3). Returns the count of runs terminalized.
    """
    if stale_timeout_ms is None:
        stale_timeout_ms = settings.run_stale_sweep_timeout_seconds * 1000
    if lock_ttl is None:
        lock_ttl = _RECONCILE_LOCK_TTL_S

    acquired = await redis.set(_RECONCILE_LOCK_KEY, "1", nx=True, ex=lock_ttl)
    if not acquired:
        # A sibling worker holds the guard — it owns this tick's sweep. No double-run.
        return 0

    flipped = 0
    flipped += await _reconcile_eval_runs(redis, supabase)
    flipped += await _reconcile_chat_runs(
        pool,
        redis,
        stale_timeout_ms=stale_timeout_ms,
        include_cap_paused=include_cap_paused,
    )
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


async def _reconcile_chat_runs(pool, redis, *, stale_timeout_ms, include_cap_paused) -> int:
    """Finalize STALE-STREAM non-terminal companion ``runs`` rows → ``failed`` (D-145-06).

    The chat orphan oracle is STREAM-AGE, not ``runs:active`` membership (D-145-02 makes
    membership blind — a dead-producer orphan STAYS in the mirror). Each orphan is routed
    through ``run_lifecycle.finalize_run_terminal`` (the owner co-writes the ZREM ×2 so
    the mirror never drifts), then its stale ``run:{id}`` stream is dropped.

    ``include_cap_paused`` gates the candidate status set: the BOOT sweep keeps
    ``cap_paused`` coverage; the PERIODIC sweep passes ``False`` to EXCLUDE it — a
    legitimately-paused Continue run has a quiet stream and must not be killed (Pitfall 3).
    Selects ``run_id`` AND ``thread_id`` (the owner ZREMs ``runs_by_thread:{tid}``).
    asyncpg is natively async — no threadpool.
    """
    statuses = list(_NON_TERMINAL_CHAT_STATUSES) if include_cap_paused else ["streaming"]
    try:
        rows = await pool.fetch(
            "SELECT run_id, thread_id FROM runs WHERE status = ANY($1::text[])",
            statuses,
        )
    except Exception:
        logger.exception("reconcile: runs non-terminal query failed (app continues)")
        return 0

    flipped = 0
    for row in rows:
        run_id = row["run_id"]
        try:
            if not await _is_chat_orphan(redis, run_id, stale_timeout_ms):
                continue  # fresh stream → genuinely live-but-quiet (never false-kill)

            await finalize_run_terminal(
                pool=pool,
                redis=redis,
                run_id=run_id,
                thread_id=row["thread_id"],
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


async def _is_chat_orphan(redis, run_id, stale_timeout_ms) -> bool:
    """True iff the ``run:{run_id}`` stream is MISSING or its last event is older than
    ``stale_timeout_ms`` (STREAM-AGE, D-145-06). This catches the dead-producer orphan
    that D-145-02 leaves PRESENT in ``runs:active`` (membership is now blind for chat).

    - Missing stream (``ResponseError('no such key')``) + a non-terminal PG row → orphan
      (Pitfall 5). Age is grounded on the Redis clock (``redis.time()``) — no app↔Redis
      skew (Pitfall 4).
    - ANY OTHER exception (a real Redis fault) PROPAGATES to the per-row handler, which
      logs + SKIPS the row — never flip on unverifiable liveness (Pitfall 6, the safe default).
    """
    try:
        info = await redis.xinfo_stream(f"run:{run_id}")
    except ResponseError as e:
        if "no such key" in str(e).lower():
            return True     # missing stream + non-terminal PG row = orphan (Pitfall 5)
        raise               # real fault → per-row handler SKIPS (Pitfall 6)

    last_id = info.get("last-generated-id") if info else None
    if last_id is None:
        return True         # a present-but-empty stream is a dead buffer → orphan
    if isinstance(last_id, bytes):
        last_id = last_id.decode()
    last_ms = int(str(last_id).split("-")[0])
    sec, usec = await redis.time()          # Redis clock — no app↔Redis skew (Pitfall 4)
    now_ms = sec * 1000 + usec // 1000
    return (now_ms - last_ms) > stale_timeout_ms


async def _is_orphan(redis, run_id) -> bool:
    """EVAL membership oracle (UNCHANGED — D-145-12). True when ``run_id`` is ABSENT from
    ``runs:active``. Eval writers were not migrated to the owner, so membership is still
    correct for eval: a live eval run is present, a dead one absent.

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
