"""SSE transport primitives for the run/producer path.

EXTRACTED FROM ``app.api.threads`` on 2026-08-17 to discharge the G-5 obligation
recorded for that file in ``CLAUDE.md``'s hot-file ledger (see
``docs/HOT-FILE-LEDGER.md``). The bodies below are a VERBATIM move — not a
rewrite — following the same one-definition-no-duplicate pattern ``threads.py``
already used for ``agent_loop``, ``thread_title``, ``run_model_resolution``,
``workflow_kickoff`` and ``run_producer``.

WHY THIS IS A SEPARATE MODULE, measured rather than argued. FOUR of the seven
symbols here — ``_spawn``, ``_BACKGROUND_TASKS``, ``TERMINAL_TYPES`` and
``_RUN_STATUS_TO_TERMINAL_TYPE`` — had ZERO uses in ``threads.py`` outside their
own definitions. They lived in an HTTP route module purely so OTHER modules could
import them. ``RUN_TASKS`` alone has ELEVEN production import sites across SEVEN
modules (``admin``, ``evals``, ``runs``, ``main``, ``run_lifecycle``,
``run_producer``, ``task_service``), and most are LATE, function-local imports
written to dodge a circular import — the smell that says a leaf concern is parked
inside a module that pulls in half the service graph. This module imports only
``asyncio``, ``json`` and ``uuid``, so it is a true leaf and cannot participate
in a cycle.

⚠ CONSUMERS WERE DELIBERATELY NOT REPOINTED, AND THAT IS THE POINT OF THE MOVE'S
SAFETY. Every existing consumer still says ``from app.api.threads import
RUN_TASKS`` / ``_emit`` / ``_emit_terminal`` / ``_spawn``, and ``threads.py``
re-imports these names, so there is ONE object:
``app.api.threads.RUN_TASKS is app.services.run_transport.RUN_TASKS``. The tests
that ``patch("app.api.threads.RUN_TASKS")`` still intercept, because the
late-importing consumers read the attribute off ``app.api.threads`` at CALL time.
Repointing a consumer at this module directly would silently break that patch
surface — so a later phase that wants to do it must move the patch sites in the
same commit.
"""

import asyncio
import json
import uuid as _uuid_mod

# WR-05: retain strong references to fire-and-forget background tasks so the
# event loop does not garbage-collect them mid-execution (Python docs:
# asyncio.create_task only weakly references the returned task). Without a
# strong reference, audit-log and memory writes can be silently dropped with
# the warning "Task was destroyed but it is pending!". Tasks self-evict from
# the set via the done-callback so it never grows unbounded.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _spawn(coro) -> asyncio.Task:
    """Schedule a fire-and-forget coroutine and retain a strong reference."""
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t


# ── Phase 061: per-run producer-task registry (D-061-11, D-v2.5-08) ──────
# Module-level dict keyed by run_id. The route handler registers new
# producer tasks; the producer's finally pops itself; the lifespan close
# in main.py cancels all entries (Plan 01 — late-bound import). 062's
# DELETE /runs/{id} will look up the run_id here and call task.cancel().
# Single uvicorn worker (D-v2.5-02) means one registry per process — no
# cross-process coordination needed.
RUN_TASKS: dict[_uuid_mod.UUID, asyncio.Task] = {}

# Terminal sentinel discriminator types (D-061-12). Consumer breaks when
# it XREADs an entry whose data.type is in this set.
# Phase 066 D-066-06: 5th SSE terminal type 'timed_out' — distinct wire-format
# value from 'error' so the frontend's onTerminal callback can route to a
# dedicated "Agent reached time limit" banner (D-066-10) and the Resume
# button gating extends to runStatus === 'timed_out' (D-066-09).
TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})

# D-061-09 runs.status enum → SSE TERMINAL_TYPES mapping. The runs table
# uses {"streaming","completed","failed","cancelled","timed_out"} per the
# migration CHECK constraint (035 + 038); the SSE wire uses TERMINAL_TYPES.
# The producer's finally must translate runs.status → wire type before
# calling _emit_terminal.
_RUN_STATUS_TO_TERMINAL_TYPE: dict[str, str] = {
    "completed": "done",
    "failed": "error",
    "cancelled": "cancelled",
    "timed_out": "timed_out",  # Phase 066 D-066-06 — system-timeout sentinel
}


async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """One canonical XADD shape for all producer-side events (D-061-10).

    Wire format byte-identical to 059's queue payload: single-field
    `data` containing JSON-encoded {type, **fields}. MAXLEN ~ 10000 caps
    per-run buffer at ~2MB (typical run emits <500 events). The terminal
    sentinel XADD goes through _emit_terminal() instead so it's exempt
    from MAXLEN trimming (Pitfall 5).
    """
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )


async def _emit_terminal(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """Terminal sentinel XADD — exempt from MAXLEN trimming (Pitfall 5).

    type MUST be in TERMINAL_TYPES. Called inside the producer's shielded
    finalizer BEFORE EXPIRE — Pitfall 2 ordering rule.
    """
    # WR-03: explicit raise (not assert) — assertions are stripped under `python -O`.
    if type not in TERMINAL_TYPES:
        raise ValueError(
            f"_emit_terminal type must be in TERMINAL_TYPES, got {type!r}"
        )
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
    )
