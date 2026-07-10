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


__all__ = ["register_run_start", "finalize_run_terminal"]
