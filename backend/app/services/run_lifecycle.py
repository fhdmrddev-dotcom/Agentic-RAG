"""Phase 145 Plan 02 (FND-01 / D-145-01 / D-145-02 / D-145-09) — the atomic run-lifecycle owner.

The single module that co-writes a chat run's Postgres ``runs.status`` and its
``runs:active`` sorted-set mirror TOGETHER, so the mirror can never drift from the
truth. Today that drift lives in ``threads.py``: the ``ZADD``/``ZREM`` on
``runs:active`` run in DIFFERENT code paths than the ``insert_run``/``finalize_run``
status writes, so a partial failure (or a boot sweep) leaves ``runs.status='streaming'``
while ``runs:active`` is empty (BUG-260709-01, 145-REPRO Direction B). This owner
collapses each transition into ONE call.

AUTHORITY MODEL (D-145-01, superseding the pre-trace "runs:active is the source of
truth" framing): **Postgres ``runs.status`` is AUTHORITATIVE.** The frontend derives
``isStreaming`` from ``get_snapshot`` (which reads ``runs.status``), never from
``runs:active``. ``runs:active`` is a DERIVED mirror — a fast liveness index this
module co-writes alongside the authoritative status. Reconciliation therefore trusts
``runs.status`` (Plan 04's stream-age sweep), not membership of ``runs:active``.

INVARIANT (by construction, for CHAT/Deep runs only — D-145-12): on success
``run_id ∈ runs:active  ⇔  runs.status == 'streaming'``. This is **CHAT-SCOPED this
phase**. The module is NEW and additive: it reuses the shared writers
``db.runs.insert_run`` / ``db.runs.finalize_run`` (parity with the live producer,
reattach/cancel semantics unchanged) and does NOT fork or migrate the eval/tuner
status writers. Those five are deliberately NOT covered by this invariant and are left
for a follow-up (SEED-096 lineage): ``eval_runner_service.py`` (eval_runs),
``run_reconciler._reconcile_eval_runs`` (boot eval sweep), ``skill_tuner.py`` (tuner
runs), ``api/evals.py`` (companion run rows), and ``agent_loop.py`` (the ``cap_paused``
non-terminal transition). A future reader must NOT assume a global invariant.

THINNESS / best-effort (T-145-02-02): the owner stays thin — it performs the two
co-writes in order and does NOT swallow the DB write's exceptions. Callers own their
existing best-effort framing (``threads.py`` keeps its per-Redis-op try/except; the
reconciler keeps its per-row try/except). The owner does NOT XADD the terminal
sentinel or EXPIRE the ``run:{id}`` stream — those SSE-transport steps stay in the
``threads.py`` producer (Plan 03). The owner logs nothing containing message content
(T-145-02-01): it writes the caller-supplied ``error`` verbatim (callers pass short
identifier/reason strings, never tracebacks — the T-073-04 discipline).

This plan ONLY creates the owner + its tests. No caller is re-pointed yet (Plan 03
wires ``threads.py`` + the cancel zombie-heal; Plan 04 the reconciler sweep), so the
running app is byte-identical — this module is dead code until wired.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from uuid import UUID

from redis.exceptions import RedisError

from app.db.runs import finalize_run, insert_run

logger = logging.getLogger(__name__)

# The derived liveness mirror (CLAUDE.md run-buffer key conventions). Same constant
# name as run_reconciler.py:61 so the owner and the sweep speak of the same set.
_ACTIVE_SET_KEY = "runs:active"


async def register_run_start(
    *,
    pool,
    redis,
    run_id,
    thread_id,
    user_id,
    model,
    provider,
    spawned_by_worker=None,
    parent_run_id=None,
    status: str = "streaming",
) -> None:
    """Atomic START co-write — insert the ``runs`` row THEN ZADD both mirrors.

    Routes the status write through the shared ``db.runs.insert_run`` (parity with the
    live producer), then adds ``run_id`` to ``runs:active`` and ``runs_by_thread:{tid}``
    keyed on the SAME ``run_id`` with a ``time.time()`` unix score (the started-at
    ordering ``threads.py`` uses today). On success the chat-scoped invariant holds:
    ``run_id ∈ runs:active  ⇔  runs.status == 'streaming'``.

    Extracted SHAPE of ``threads.py:1108-1127``. Thin: the DB INSERT is the FATAL,
    authoritative write and its exceptions propagate (callers own spawn-failure
    framing); the two mirror ZADDs are BEST-EFFORT — a transient Redis blip is logged,
    never raised (CR-01) — so a mirror hiccup never fails the send. No sentinel/EXPIRE
    here.
    """
    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status=status,
        model=model,
        provider=provider,
        spawned_by_worker=spawned_by_worker,
        parent_run_id=parent_run_id,
    )
    _score = time.time()
    # CR-01 (Phase 145 review): the two mirror ZADDs are BEST-EFFORT. The Postgres
    # INSERT above is the fatal, authoritative write (D-145-01: ``runs.status`` is
    # AUTHORITATIVE, ``runs:active`` is a DERIVED mirror). A transient Redis blip on
    # the mirror must NOT escalate into a spawn failure → user-facing 500 → a run
    # churned ``streaming`` → ``failed`` for a purely-cosmetic mirror write. This
    # matches the module's own best-effort-Redis posture around the finalizer; the
    # stale-stream sweep reconciles any run left out of the mirror.
    try:
        await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _score})
        await redis.zadd(_ACTIVE_SET_KEY, {str(run_id): _score})
    except Exception:
        logger.exception(
            "register_run_start: mirror ZADD failed for run %s (status write already "
            "succeeded; continuing)",
            run_id,
        )


async def finalize_run_terminal(
    *,
    pool,
    redis,
    run_id,
    thread_id,
    status,
    error,
    completed_at,
    message_id=None,
    input_tokens=None,
    output_tokens=None,
) -> None:
    """Atomic TERMINAL co-write — finalize the ``runs`` row THEN ZREM both mirrors.

    Routes the terminal status write through the shared ``db.runs.finalize_run`` (the
    same writer the live producer + the boot reconciler use — reattach/cancel parity),
    then removes ``run_id`` from ``runs:active`` and ``runs_by_thread:{tid}``. On success
    the chat-scoped invariant holds: a terminal ``runs.status`` ⇔ absent from
    ``runs:active``.

    Extracted SHAPE of ``threads.py:1684-1724`` (status + ZREM ×2 only). Call this ONLY
    for TRUE terminals — ``cap_paused`` is non-terminal and re-attachable, so it keeps
    its row in the active sets (the producer must NOT route ``cap_paused`` here). Thin:
    the DB write's exceptions propagate; the terminal sentinel XADD + EXPIRE stay in the
    ``threads.py`` producer AFTER this call (do not reorder — status must land first).
    """
    await finalize_run(
        pool,
        run_id=run_id,
        status=status,
        error=error,
        completed_at=completed_at,
        message_id=message_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    await redis.zrem(_ACTIVE_SET_KEY, str(run_id))
    await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))


async def _cancel_run_internals(
    *,
    run_id,
    status: str,
    thread_id,
    redis,
    supabase,
) -> str:
    """The shared cancel / zombie-heal discipline (D-062-* / D-02 refactor-to-share).

    Performs Steps 2/3a/3b of the DELETE-run cancel verb VERBATIM (extracted from
    ``api/runs.py:cancel_run``) so a single correct discipline is reused by BOTH the
    owner-scoped ``cancel_run`` and the operator-scoped ``POST /admin/runs/{id}/kill``.
    The ONLY thing the operator path drops is Step 1's ownership SELECT — so this
    helper deliberately performs **no ownership check**: the caller owns that decision
    (T-147-06 — the privileged ownership skip lives only inside the ``require_operator``
    router, never here).

    Returns an outcome discriminator so callers can pick the audit verb (064-B honesty):
      - ``"terminal_noop"``  — the run was already terminal; NO UPDATE, NO Redis touch
                               (D-062-09 idempotent).
      - ``"task_cancelled"`` — a live producer was in ``RUN_TASKS``; the ask_user cancel
                               sentinel is PUBLISHed BEFORE ``task.cancel()`` (D-085-04),
                               then the producer's own handler finalizes ASYNC.
      - ``"zombie_healed"``  — no live producer; the terminal state is co-written here via
                               ``finalize_run_terminal`` + a SETNX-gated synthetic sentinel
                               + EXPIRE 60 (D-062-11). A caller reading this outcome renders
                               "recovered a stuck run", NEVER "killed" (064-B).

    Every Redis op is best-effort per D-062-13 (T-062-03): a failure is logged and the
    cancel still succeeds — Postgres ``runs.status`` is the durable cancel record.
    """
    # ── Step 2: already-terminal → 204 silent (D-062-09 idempotent) ──
    # NO UPDATE, NO Redis touch — the run is already finalized; re-call has no
    # observable effect.
    if status in ("completed", "failed", "cancelled", "timed_out"):
        return "terminal_noop"

    # ── Step 3a: happy path — producer alive in RUN_TASKS (D-062-10) ──
    # task.cancel() schedules the CancelledError; the producer's existing handler
    # (threads.py) sets _terminal_status='cancelled' and _shielded_finalize runs the
    # terminal ordering ASYNCHRONOUSLY. The caller does NOT await the task.
    # Late import keeps the RUN_TASKS registry off this module's load path (runs.py
    # style) and avoids the runs<->run_lifecycle import cycle.
    from app.api.threads import RUN_TASKS  # noqa: PLC0415

    task = RUN_TASKS.get(run_id)
    if task is not None and not task.done():
        # Phase 085 D-085-04 — PUBLISH the ask_user cancel sentinel BEFORE task.cancel()
        # so any paused _handle_ask_user wakes and returns a normal ToolResult before
        # CancelledError propagates. Best-effort — never block the cancel on Redis
        # failure (same discipline as the zombie-heal ops below).
        try:
            from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
            await publish_cancel_sentinel(redis, run_id)
        except Exception:
            logger.exception(
                "ask_user cancel sentinel broadcast failed for run %s", run_id
            )
        task.cancel()
        return "task_cancelled"

    # ── Step 3b: zombie heal (D-062-11) ──
    # RUN_TASKS missing but status='streaming' — process restarted, producer died
    # without finalizing, etc. User intent ("Stop my run") is honored even when the
    # producer is dead. Each Redis op gets its own try/except per D-062-13.
    stream_key = f"run:{run_id}"

    # 1. Atomic terminal co-write (Phase 145-03 / D-145-14 writer parity): the
    # runs.status='cancelled' UPDATE + both mirror ZREMs are ONE call via
    # finalize_run_terminal, so a healed zombie can't leave runs.status terminal while
    # runs:active still lists it. Best-effort per D-062-13 — a failure still returns the
    # discriminator (logged); status lands FIRST (before the synthetic sentinel below).
    try:
        from app.dependencies import get_pg_pool  # noqa: PLC0415
        pool = await get_pg_pool()
        await finalize_run_terminal(
            pool=pool,
            redis=redis,
            run_id=run_id,
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            status="cancelled",
            error="cancelled_by_user",
            completed_at=datetime.now(timezone.utc),
        )
    except Exception:
        logger.exception("Zombie heal finalize (cancel) failed for run %s", run_id)

    # Phase 092 (092-03 / SC#2, MODE-02) — clear the per-thread workflow lock anchor on
    # cancel so a cancelled Harness/cap_paused run never strands the thread
    # Harness-locked. Best-effort, symmetric with the zombie-heal Redis ops (D-062-13).
    try:
        from app.utils.db import aexec  # noqa: PLC0415
        await aexec(
            supabase.table("threads")
            .update({"active_workflow_run_id": None})
            .eq("id", thread_id)
        )
    except Exception:
        logger.exception(
            "Zombie heal anchor-clear failed for thread %s (run %s)", thread_id, run_id
        )

    # 2. Synthetic terminal sentinel — gives any attached consumer the event it needs to
    # break out of the XREAD loop. Only emitted if the buffer still exists. WR-04 fix:
    # gate the XADD on a SETNX cancel-lock so concurrent cancels write ONE sentinel.
    # Lock TTL=60s matches the EXPIRE bucket below.
    sentinel_lock_acquired = False
    try:
        sentinel_lock_acquired = bool(
            await redis.set(f"run:{run_id}:cancel_lock", "1", nx=True, ex=60)
        )
    except (RedisError, OSError):
        logger.exception("Zombie heal cancel_lock SETNX failed for run %s", run_id)
        # On lock failure, fall through and emit the sentinel anyway — the original
        # best-effort behavior is preferred over silent degradation.
        sentinel_lock_acquired = True
    if sentinel_lock_acquired:
        try:
            if await redis.exists(stream_key):
                from app.api.threads import _emit_terminal  # noqa: PLC0415
                await _emit_terminal(
                    redis, run_id, "cancelled", reason="zombie_healed"
                )
        except (RedisError, OSError):
            logger.exception("Zombie heal sentinel XADD failed for run %s", run_id)

    # 3. EXPIRE 60s (failed/cancelled bucket per D-061-04). Lets attached consumers
    # drain the buffer before it disappears.
    try:
        await redis.expire(stream_key, 60)
    except (RedisError, OSError):
        logger.exception("Zombie heal EXPIRE failed for run %s", run_id)

    return "zombie_healed"


__all__ = [
    "register_run_start",
    "finalize_run_terminal",
    "_cancel_run_internals",
]
