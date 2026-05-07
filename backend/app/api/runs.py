"""Phase 062 — /runs/* endpoint module.

Per D-062-14 file layout: this module owns the ephemeral-buffer surface
(GET /runs/{id}/stream + DELETE /runs/{id}); GET /threads/{id}/active-runs
lives in app.api.threads (under the /threads prefix). Imports the registry
and helper constants from app.api.threads — single source of truth, no
parallel registry per D-061-11 / D-v2.5-02 (single uvicorn worker).

Contains:
  - replay_tail_consumer(redis, run_id, since, settings): module-level
    async generator (D-061.1-10 IN-04 lifted-to-module convention);
    mirrors event_consumer at threads.py:336-423 with `last_id = since`
    (D-062-07 cursor parameterization). Same WR-01 carry-forward,
    TERMINAL_TYPES break, deadline guard, no-op finally (D-061-03).
  - _synthetic_terminal_generator(runs_status, runs_error): yields exactly
    one synthetic terminal SSE event mapped via _RUN_STATUS_TO_TERMINAL_TYPE
    for the TTL-expired path (D-062-06).
  - GET /runs/{run_id}/stream?since={offset} (D-062-05/06/07/12/13).
  - DELETE /runs/{run_id} (added in Plan 03; D-062-08/09/10/11/12/13).

Phase 062 ships ZERO new schema (uses public.runs from migration 035) and
ZERO new dependencies (everything from Phase 061's requirements.txt).

IMPORTANT — imports: `RedisError` is imported at the top of the file via
`from redis.exceptions import RedisError` (NOT `import redis.exceptions`).
The route declares `redis: aioredis.Redis = Depends(get_redis)`, which
shadows the `redis` module name inside the route body. Any `redis.exceptions.X`
reference inside the route would dereference `.exceptions` on the Redis
INSTANCE (AttributeError), NOT the module. This convention matches the
Phase 061 import style at the top of threads.py.
"""
import asyncio
import json
import logging
import time as time_mod
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sse_starlette import EventSourceResponse
from supabase import Client
# Phase 067 D-067-04: alias TimeoutError as RedisTimeoutError to differentiate
# the redis-py async_timeout wrapper conversion (cancellation-equivalent on
# xread BLOCK) from genuine RedisError. Variable-shadowing-safe: the `redis`
# module is shadowed inside the route body by `redis: aioredis.Redis =
# Depends(get_redis)`, so writing `redis.exceptions.TimeoutError` would
# AttributeError. Module-level alias is the canonical safe approach.
# Phase 061 follows the same convention in threads.py.
from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError

from app.api.threads import (
    RUN_TASKS,
    TERMINAL_TYPES,
    _emit_terminal,
    _RUN_STATUS_TO_TERMINAL_TYPE,
)
from app.config import settings
from app.dependencies import get_current_user, get_redis, get_supabase
from app.utils.db import aexec

router = APIRouter(prefix="/runs", tags=["runs"])
logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────────────────
# replay_tail_consumer — 062's analogue of event_consumer at
# threads.py:336-423. Difference: last_id = since (D-062-07) instead of
# hardcoded "0". All other invariants preserved verbatim:
#   - WR-01 (D-061.1-07): carry last_id forward between phases; no `$` reset
#   - H1 (061.1-DIAGNOSIS.md): BaseException wrapper around per-entry yield
#   - Deadline = monotonic + consumer_timeout_seconds (Phase 066: 610s default;
#     was run_hard_timeout_seconds + 10 = 130s pre-066. Bumped to outlast the
#     producer's max_iterations × per_call_budget worst-case wall-time.)
#   - Break on first TERMINAL_TYPES entry
#   - finally: pass (D-061-03 — consumer disconnect MUST NOT cancel producer)
# ───────────────────────────────────────────────────────────────────────
async def replay_tail_consumer(redis, run_id: UUID, since: str, settings):
    """Two-mode XREAD consumer with `since` cursor (D-062-05/07).

    Mirrors app.api.threads.event_consumer verbatim except for the initial
    last_id assignment. See that function's docstring for full semantics.
    Multi-consumer fan-out is implicit at the Redis layer: XREAD is non-
    destructive, so any number of replay_tail_consumer instances on the
    same run_id receive identical sequences (foundation for SC#4).
    """
    stream_key = f"run:{run_id}"
    last_id = since
    deadline = time_mod.monotonic() + settings.consumer_timeout_seconds

    try:
        # Phase 1: replay backlog from `since` (no block; immediate return)
        while True:
            if time_mod.monotonic() > deadline:
                yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
                return
            # WR-03 fix: wrap xread in try/except RedisError. `since` is a free-form
            # string at the route boundary (D-062-07 contract); a malformed value
            # (anything not <ms>-<seq> / "0" / "$") makes Redis raise ResponseError
            # (a RedisError subclass) on the FIRST xread. Without this guard the
            # exception escapes the generator's outer try/finally (which is just
            # `pass` per D-061-03) and EventSourceResponse closes the response
            # with HTTP 200 + zero events — no terminal sentinel, no error event.
            # Yield a synthetic invalid_since error event so the client gets a
            # clean SSE termination instead of a silent drop.
            try:
                result = await redis.xread(
                    streams={stream_key: last_id},
                    count=100,
                )
            except asyncio.CancelledError:
                # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
                # Client disconnected; log INFO and re-raise so the asyncio task state
                # stays correct. No yield — the generator is being torn down.
                logger.info(
                    "replay_tail_consumer xread (replay phase) cancelled by client "
                    "disconnect for run %s",
                    run_id,
                )
                raise
            except RedisTimeoutError:
                # D-067-04: redis-py's async_timeout wrapper converted a socket-read
                # deadline / cancellation into TimeoutError. Cancellation-equivalent at
                # this site — INFO-only, no traceback. Yield a clean SSE error event
                # so the consumer-side socket closes naturally; do NOT propagate as 503.
                logger.info(
                    "replay_tail_consumer xread (replay phase) socket timeout for run %s "
                    "(consumer disconnected; xread cancellation-equivalent)",
                    run_id,
                )
                yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
                return
            except RedisError:
                logger.exception(
                    "replay_tail_consumer xread (replay phase) raised RedisError "
                    "for run %s (likely malformed since=%r)",
                    run_id,
                    since,
                )
                yield {"data": json.dumps({"type": "error", "error": "invalid_since"})}
                return
            if not result:
                break
            for _stream_name, entries in result:
                for entry_id, fields in entries:
                    try:
                        last_id = entry_id  # advance cursor (Pitfall 1)
                        # WR-05 fix: defensive .get("data") instead of fields["data"].
                        # Producers always wrap payloads in {"data": <json>}, but a
                        # future migration / misbehaving producer / cross-version
                        # backfill that writes an envelope-less entry would raise
                        # KeyError, get caught by the BaseException handler, and
                        # kill the SSE stream silently mid-replay. Skip malformed
                        # entries with a logged warning and continue — the consumer
                        # still terminates cleanly on the next valid sentinel.
                        data_field = fields.get("data")
                        if data_field is None:
                            logger.warning(
                                "replay_tail_consumer skipping envelope-less entry "
                                "%s for run %s (fields=%r)",
                                entry_id,
                                run_id,
                                list(fields.keys()),
                            )
                            continue
                        yield {"data": data_field}
                        payload = json.loads(data_field)
                        if payload.get("type") in TERMINAL_TYPES:
                            return
                    except BaseException:
                        logger.exception(
                            "replay_tail_consumer raised mid-yield (replay phase) for run %s",
                            run_id,
                        )
                        raise

        # Phase 2: live-tail (BLOCK 5000) — WR-01: keep last_id; NO `$` reset
        while True:
            if time_mod.monotonic() > deadline:
                yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
                return
            # WR-03 fix (defense-in-depth): also wrap the live-tail xread. By the
            # time we reach Phase 2, last_id has been advanced from `since` to a
            # real entry id (so RedisError is unlikely here), but a transient
            # Redis error mid-tail otherwise propagates the same way as Phase 1.
            try:
                result = await redis.xread(
                    streams={stream_key: last_id},
                    count=100,
                    block=5000,
                )
            except asyncio.CancelledError:
                # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
                logger.info(
                    "replay_tail_consumer xread (tail phase) cancelled by client "
                    "disconnect for run %s",
                    run_id,
                )
                raise
            except RedisTimeoutError:
                # D-067-04: redis-py async_timeout wrapper conversion;
                # cancellation-equivalent at this site (the only thing it means here is
                # the consumer's blocking xread was interrupted while no client was
                # actively listening). INFO-only, no traceback.
                logger.info(
                    "replay_tail_consumer xread (tail phase) socket timeout for run %s "
                    "(consumer disconnected; xread cancellation-equivalent)",
                    run_id,
                )
                yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
                return
            except RedisError:
                logger.exception(
                    "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
                    run_id,
                )
                yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
                return
            if not result:
                # WR-02 fix: if the stream key vanished mid-stream (TTL race
                # between the route's redis.exists probe and our first xread,
                # or producer finalize → EXPIRE 60 → TTL-zero arriving inside
                # the BLOCK window), don't keep BLOCKing until the hard
                # deadline. Emit a synthetic terminal-shaped error event and
                # return so the client gets a clean close instead of waiting
                # the full consumer_timeout_seconds for this consumer.
                try:
                    if not await redis.exists(stream_key):
                        yield {"data": json.dumps({
                            "type": "error",
                            "error": "buffer_expired_during_tail",
                        })}
                        return
                except asyncio.CancelledError:
                    # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
                    # Symmetric defense per RESEARCH Open Question 4: same shape as the two
                    # xread sites above so a tab-cycle interrupt during the post-BLOCK probe
                    # does not surface a stack trace either.
                    logger.info(
                        "replay_tail_consumer post-BLOCK exists probe cancelled by client "
                        "disconnect for run %s",
                        run_id,
                    )
                    raise
                except RedisTimeoutError:
                    # D-067-04: cancellation-equivalent at this site too. Best-effort probe;
                    # fall through to deadline-based loop rather than yielding an error.
                    logger.info(
                        "replay_tail_consumer post-BLOCK exists probe socket timeout for run %s "
                        "(consumer disconnected; xread cancellation-equivalent)",
                        run_id,
                    )
                except (RedisError, OSError):
                    # Best-effort probe; if it fails (genuine Redis failure or socket OSError),
                    # fall through to the original deadline-based behavior rather than dying.
                    logger.exception(
                        "replay_tail_consumer post-BLOCK exists probe failed for run %s",
                        run_id,
                    )
                continue   # BLOCK timeout — re-check deadline
            for _stream_name, entries in result:
                for entry_id, fields in entries:
                    try:
                        last_id = entry_id
                        # WR-05 fix: same defensive .get("data") pattern as Phase 1.
                        data_field = fields.get("data")
                        if data_field is None:
                            logger.warning(
                                "replay_tail_consumer skipping envelope-less entry "
                                "%s for run %s (fields=%r)",
                                entry_id,
                                run_id,
                                list(fields.keys()),
                            )
                            continue
                        yield {"data": data_field}
                        payload = json.loads(data_field)
                        if payload.get("type") in TERMINAL_TYPES:
                            return
                    except BaseException:
                        logger.exception(
                            "replay_tail_consumer raised mid-yield (tail phase) for run %s",
                            run_id,
                        )
                        raise
    finally:
        # D-061-03: consumer disconnect MUST NOT cancel producer.
        pass


# ───────────────────────────────────────────────────────────────────────
# Synthetic terminal generator — for TTL-expired buffers (D-062-06).
# Yields exactly one terminal SSE event then returns; EventSourceResponse
# closes the response naturally on generator exhaustion.
# ───────────────────────────────────────────────────────────────────────
async def _synthetic_terminal_generator(runs_status: str, runs_error: Optional[str]):
    """Yield ONE synthetic terminal event for a TTL-expired run (D-062-06).

    Maps runs.status → SSE TERMINAL_TYPES via _RUN_STATUS_TO_TERMINAL_TYPE
    (the same dict the producer's _shielded_finalize uses at threads.py:2109).
    Defensive case: status='streaming' with redis.exists=0 shouldn't happen,
    but emit type='error' rather than 500 so client still gets a clean close.
    """
    mapped = _RUN_STATUS_TO_TERMINAL_TYPE.get(runs_status)
    if mapped is None:
        yield {"data": json.dumps({
            "type": "error",
            "error": "buffer_expired_while_streaming",
            "runs_status": runs_status,
        })}
        return
    yield {"data": json.dumps({
        "type": mapped,
        "error": "buffer_expired",
        "runs_status": runs_status,
        "runs_error": runs_error,
    })}


# ───────────────────────────────────────────────────────────────────────
# GET /runs/{run_id}/stream?since={offset}
# D-062-05 (already-terminal replays naturally), D-062-06 (TTL-expired
# synthetic terminal), D-062-07 (?since=any string), D-062-12 (404 not 403),
# D-062-13 (Redis-down → 503 + Retry-After: 10).
# T-062-01 (cross-user IDOR — mitigated via .eq user_id + 404).
# T-062-03 (Redis error leak — mitigated via RedisError catch + generic 503).
# T-062-04 (DoS via parallel consumers — bounded by deadline + bounded pool).
# ───────────────────────────────────────────────────────────────────────
@router.get("/{run_id}/stream")
async def stream_run(
    run_id: UUID,
    since: str = "0",
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Step 1: ownership SELECT on runs row (D-062-12 / T-062-01).
    # maybe_single() returns None on no-row instead of raising APIError
    # (postgrest patch in main.py:22-45 makes this safe).
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id, error")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None
    if not row:
        # 404 not 403 — don't leak resource existence to other users.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # Step 2: Redis health probe — bounded by asyncio timeout.
    # On RedisError or timeout, return 503 with Retry-After: 10 (D-062-13, T-062-03).
    # NOTE: We use the unqualified `RedisError` (imported at top of file) — NOT
    # `redis.exceptions.RedisError`. The `redis` parameter above shadows the
    # `redis` module here, so `redis.exceptions.X` would raise AttributeError
    # on the Redis instance (it has no `.exceptions` attribute).
    try:
        buffer_exists = await asyncio.wait_for(
            redis.exists(f"run:{run_id}"), timeout=2.0
        )
    except (RedisError, asyncio.TimeoutError, OSError):
        logger.exception("Redis unreachable on GET /runs/%s/stream", run_id)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Streaming infrastructure unavailable"},
            headers={"Retry-After": "10"},
        )

    # Step 3a: live or already-terminal run — buffer present.
    # Both cases use the same consumer code path; the producer's terminal
    # sentinel (D-061-12) is in the buffer in both cases, so the loop
    # breaks naturally and the response closes (D-062-05).
    if buffer_exists:
        return EventSourceResponse(
            replay_tail_consumer(redis=redis, run_id=run_id, since=since, settings=settings),
            ping=None,
        )

    # Step 3b: TTL-expired run — emit synthetic terminal mapped from
    # runs.status (D-062-06). The runs row already exists (validated above);
    # synthesize a single terminal SSE event matching its status.
    return EventSourceResponse(
        _synthetic_terminal_generator(
            runs_status=row.get("status"),
            runs_error=row.get("error"),
        ),
        ping=None,
    )


# ───────────────────────────────────────────────────────────────────────
# DELETE /runs/{run_id}  — cancel verb (D-062-08/09/10/11/12/13).
# Idempotent across all three sub-paths:
#   - happy:      in-flight run (RUN_TASKS contains task) → task.cancel() → 204
#                 (producer's CancelledError handler at threads.py:2110-2116
#                 + _shielded_finalize finishes ASYNC; DELETE does NOT await)
#   - zombie:     runs.status='streaming' but RUN_TASKS missing →
#                 UPDATE Postgres + synthetic 'zombie_healed' sentinel +
#                 ZREM × 2 + EXPIRE 60 → 204 (D-062-11)
#   - terminal:   runs.status in {completed, failed, cancelled, timed_out} →
#                 204 silent (D-062-09 idempotent; timed_out added per D-066-04)
#
# Threats mitigated:
#   T-062-01 (Information Disclosure): cross-user → 404 via .eq(user_id=...) + RLS
#            (D-062-12 — never leak existence to other users)
#   T-062-02 (Tampering / EoP): ownership SELECT runs BEFORE any RUN_TASKS lookup;
#            cross-user attempts cannot reach task.cancel()
#   T-062-03 (Information Disclosure stack-trace leak): every Redis op wrapped
#            in try/except + logger.exception; 204 returned even when every
#            Redis op fails (Postgres UPDATE is the durable cancel record;
#            Redis ops are best-effort per D-062-13).
#
# IMPORTANT: same RedisError-shadowing rule as stream_run applies here — use
# the top-level unqualified `RedisError` import, NOT `redis.exceptions.X`,
# inside the route body (the `redis: aioredis.Redis = Depends(get_redis)`
# parameter shadows the `redis` module name).
# ───────────────────────────────────────────────────────────────────────
@router.delete(
    "/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def cancel_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    # ── Step 1: ownership SELECT (D-062-08 / D-062-12 / T-062-01 / T-062-02) ──
    # maybe_single() returns None on no-row instead of raising APIError
    # (postgrest patch in main.py:22-45 makes this safe). 404 (NOT 403) on
    # missing row — never leak existence to other users.
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # ── Step 2: already-terminal → 204 silent (D-062-09 idempotent) ──
    # NO UPDATE, NO Redis touch — the run is already finalized; re-call has
    # no observable effect.
    if row["status"] in ("completed", "failed", "cancelled", "timed_out"):
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # ── Step 3a: happy path — producer alive in RUN_TASKS (D-062-10) ──
    # task.cancel() schedules the CancelledError; the producer's existing
    # handler at threads.py:2110-2116 sets _terminal_status='cancelled' and
    # _shielded_finalize at threads.py:~2123-2138 runs the 5-step finalize
    # ordering (sentinel → UPDATE → EXPIRE → ZREM → RUN_TASKS.pop)
    # ASYNCHRONOUSLY. DELETE does NOT await the task — return 204 immediately.
    task = RUN_TASKS.get(run_id)
    if task is not None and not task.done():
        task.cancel()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # ── Step 3b: zombie heal (D-062-11) ──
    # RUN_TASKS missing but runs.status='streaming' — process restarted,
    # producer died without finalizing, etc. User intent ("Stop my run") is
    # honored even when the producer is dead. Each Redis op gets its own
    # try/except per D-062-13 (T-062-03) — DELETE returns 204 even if every
    # Redis op fails.
    thread_id = row["thread_id"]
    stream_key = f"run:{run_id}"

    # 1. UPDATE Postgres. Best-effort per D-062-13 — primary durability is
    # the original happy-path cancel; zombie heal is a recovery surface,
    # not a primary write. If Postgres UPDATE fails here, still return 204
    # (the operator sees the failure in logger.exception output).
    # WR-01 fix: Python-side ISO-8601 timestamp instead of the literal string
    # "now()". PostgREST sends update payloads as JSON over the wire; "now()"
    # arrives as a JSON string and timestamptz only treats the bare token 'now'
    # (no parens) as a special literal. The "now()" form may store a literal
    # string, return NULL, or error depending on column/version — silently
    # degrading the zombie-heal contract. Symmetric with _shielded_finalize.
    try:
        await aexec(
            supabase.table("runs").update({
                "status": "cancelled",
                "error": "cancelled_by_user",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("run_id", str(run_id))
        )
    except Exception:
        logger.exception(
            "Zombie heal Postgres UPDATE failed for run %s", run_id
        )

    # 2. Synthetic terminal sentinel — gives any attached consumer the event
    # it needs to break out of the XREAD loop. Only emitted if the buffer
    # still exists (TTL-expired runs have nothing to attach to).
    # WR-04 fix: gate the XADD on a SETNX cancel-lock so concurrent DELETEs
    # on the same run_id only write ONE sentinel. Two concurrent zombie-heal
    # paths could both pass the ownership SELECT + status check, both reach
    # this point, and both XADD a 'cancelled'+'zombie_healed' sentinel —
    # not user-visible (consumer breaks on first), but a duplicate sentinel
    # is still a code smell and could cause flaky tests with tight
    # assertion counts. Lock TTL=60s matches the EXPIRE bucket below.
    # SET NX EX is a single atomic Redis op; its own try/except per D-062-13.
    sentinel_lock_acquired = False
    try:
        sentinel_lock_acquired = bool(
            await redis.set(f"run:{run_id}:cancel_lock", "1", nx=True, ex=60)
        )
    except (RedisError, OSError):
        logger.exception(
            "Zombie heal cancel_lock SETNX failed for run %s", run_id
        )
        # On lock failure, fall through and emit the sentinel anyway — the
        # original best-effort behavior is preferred over silent degradation
        # if Redis is misbehaving.
        sentinel_lock_acquired = True
    if sentinel_lock_acquired:
        try:
            if await redis.exists(stream_key):
                await _emit_terminal(
                    redis, run_id, "cancelled", reason="zombie_healed"
                )
        except (RedisError, OSError):
            logger.exception(
                "Zombie heal sentinel XADD failed for run %s", run_id
            )

    # 3. ZREM both sorted sets — keeps active-runs listing honest even
    # though the producer never got to run its own ZREMs. Each in its own
    # try block per D-062-13 (don't let one failure mask the other).
    try:
        await redis.zrem("runs:active", str(run_id))
    except (RedisError, OSError):
        logger.exception(
            "Zombie heal ZREM runs:active failed for run %s", run_id
        )
    try:
        await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
    except (RedisError, OSError):
        logger.exception(
            "Zombie heal ZREM runs_by_thread failed for run %s", run_id
        )

    # 4. EXPIRE 60s (failed/cancelled bucket per D-061-04). Lets attached
    # consumers drain the buffer before it disappears.
    try:
        await redis.expire(stream_key, 60)
    except (RedisError, OSError):
        logger.exception(
            "Zombie heal EXPIRE failed for run %s", run_id
        )

    # 5. Always 204 — Postgres UPDATE is the source-of-truth cancel record;
    # Redis ops are best-effort (D-062-13).
    return Response(status_code=status.HTTP_204_NO_CONTENT)
