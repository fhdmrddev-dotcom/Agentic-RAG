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
from pydantic import BaseModel
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
async def replay_tail_consumer(
    redis,
    run_id: UUID,
    since: str,
    settings,
    *,
    supabase: Client | None = None,
    user_id: str | None = None,
):
    """Two-mode XREAD consumer with `since` cursor (D-062-05/07).

    Mirrors app.api.threads.event_consumer verbatim except for the initial
    last_id assignment. See that function's docstring for full semantics.
    Multi-consumer fan-out is implicit at the Redis layer: XREAD is non-
    destructive, so any number of replay_tail_consumer instances on the
    same run_id receive identical sequences (foundation for SC#4).

    Phase 075 D-075-13 / BUG-260518-01: when the buffer expires mid-tail,
    we now probe `public.runs.status` (when supabase + user_id are
    provided) to distinguish a heartbeat-gap during an in-flight cell from
    a genuine TTL-expiry. The discriminator is added to the SSE error
    payload as `recently_active` (bool) + `runs_status` (str | None) so
    the frontend can re-attach instead of flipping the Resume button on.
    `supabase` / `user_id` are keyword-only so legacy callers (which pass
    none) still work — they just get the fail-safe terminal-flip behavior.
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
                #
                # Phase 075 D-075-13 / BUG-260518-01: distinguish heartbeat-gap
                # from genuine TTL-expiry. The runs row outlives the Redis
                # buffer (D-062-06); a streaming row + missing key means the
                # producer is mid-cell (long execute_code or silent matplotlib
                # render) and the frontend should re-attach, not flip Resume on.
                # Inline payload extension chosen over a second consumer-side
                # decoder (075-PATTERNS.md §8 option (a)); mirrors
                # _synthetic_terminal_generator at runs.py:298-319 which
                # already reads runs.status for the TTL-expired-after-completion
                # case. Fail-safe on probe error: fall through to terminal-flip
                # behavior (recently_active=False, runs_status=None).
                try:
                    if not await redis.exists(stream_key):
                        runs_status: str | None = None
                        recently_active: bool = False
                        if supabase is not None and user_id is not None:
                            try:
                                probe = await aexec(
                                    supabase.table("runs")
                                    .select("status")
                                    .eq("run_id", str(run_id))
                                    .eq("user_id", user_id)
                                    .maybe_single()
                                )
                                probe_row = probe.data if probe is not None else None
                                if probe_row:
                                    runs_status = probe_row.get("status")
                                    recently_active = runs_status == "streaming"
                            except Exception:
                                # Fail-safe to terminal-flip on Postgres probe error.
                                # T-073-04 / D-074-03: identifier-only format string.
                                logger.exception(
                                    "runs.status probe failed for run=%s during "
                                    "buffer_expired_during_tail",
                                    run_id,
                                )
                        yield {"data": json.dumps({
                            "type": "error",
                            "error": "buffer_expired_during_tail",
                            "runs_status": runs_status,
                            "recently_active": recently_active,
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
            # Phase 075 D-075-13: pass supabase + user_id so the consumer can
            # distinguish heartbeat-gap from genuine TTL-expiry on
            # buffer_expired_during_tail (BUG-260518-01 backend half).
            replay_tail_consumer(
                redis=redis,
                run_id=run_id,
                since=since,
                settings=settings,
                supabase=supabase,
                user_id=current_user["id"],
            ),
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
# Phase 085 D-085-02 — POST /runs/{rid}/ask_user_response
# ───────────────────────────────────────────────────────────────────────
# User submits an answer to a paused ask_user prompt. Order is load-bearing
# (RESEARCH §A.7 durability path):
#
#   1. Ownership SELECT (404 not 403 on cross-user — D-062-12)
#   2. Persist messages row with kind='ask_user_response' (DURABLE — survives
#      the PUBLISH-with-no-subscriber case)
#   3. Emit ask_user_response SSE event (for live UI sync; non-fatal on failure)
#   4. PUBLISH to ask_user:{rid}:{tcid} (wakes the paused SUBSCRIBE if alive)
#
# Returns 200 once the persist succeeds. PUBLISH failure (no subscriber) is
# logged, not raised — the messages row is the durable record; if the
# SUBSCRIBE is dead (worker restarted, etc.), the run is already terminal
# and the user gets a "response was recorded" ack regardless.
#
# Threats mitigated:
#   T-085-T12 (Spoofing — user Y answers user X's prompt): ownership SELECT
#             on runs by (run_id, user_id) — 404 on miss.
#   T-085-T13 (Tampering — replay after run finalized): runs.status checked
#             via the same ownership SELECT; if the row isn't visible to this
#             user the response is rejected at the ownership gate.
# ───────────────────────────────────────────────────────────────────────


class AskUserResponseBody(BaseModel):
    """Phase 085 D-085-02 — POST body for /runs/{rid}/ask_user_response.

    tool_call_id pairs the response with the originating prompt's
    messages.tool_calls[0].tool_call_id field (and Redis channel name).
    """
    tool_call_id: str
    response_text: str
    choice_index: "int | None" = None


@router.post("/{run_id}/ask_user_response", status_code=200)
async def submit_ask_user_response(
    run_id: UUID,
    body: AskUserResponseBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Submit a user response to a paused ask_user prompt (D-085-02).

    Persist FIRST (durability), then PUBLISH (live wake). Returns 200 once
    the persist succeeds; PUBLISH failure is logged but not raised.
    """
    # ── Step 1: ownership check (T-085-T12 / T-085-T13 / D-062-12) ──
    # maybe_single() returns None on no-row instead of raising APIError.
    # 404 (NOT 403) on missing row — never leak existence to other users.
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, thread_id, status")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None

    if not row:
        # ── F10 (093 / D-07 / D-08): harness ask_user workflow_run-id fallback ──
        # A harness ``llm_human_input`` prompt's durable row carries
        # ``run_id = ctx.run_id`` — the WORKFLOW_RUN id (NOT a ``runs`` row) — and
        # the executor subscribes on ``ask_user:{workflow_run_id}:{tcid}``
        # (phase_types.py passes ctx.run_id to subscribe_for_response). The Step-1
        # SELECT above therefore MISSES for harness. Resolve the id as a
        # ``workflow_runs`` row UNDER THE CALLER'S OWNERSHIP + thread-anchor confirm
        # (T-093-IDOR: never trust the path id; owner-scoped + the row's thread must
        # have this id as its live ``active_workflow_run_id``). 404 — NEVER 403 — on
        # missing / not-yours / non-anchor, so the response is INDISTINGUISHABLE for
        # "doesn't exist" and "not yours" (no existence leak). This is the EXACT
        # owner-scoped, anchor-confirmed pattern the Continue endpoint already uses
        # (see continue_run Step-1 fallback). BRANCH, never replace (D-08): the
        # Step-1 ``runs`` SELECT above stays FIRST and unchanged — Deep's runs-keyed
        # ask_user path is byte-identical and still returns 200; this fallback only
        # engages AFTER that SELECT misses. Once ``row`` is synthesized, Steps 2-4
        # (persist / emit / PUBLISH) run UNCHANGED under ``run_id`` = the workflow_run
        # id, so ``publish_response`` hits ``ask_user:{workflow_run_id}:{tcid}`` —
        # the SAME channel ``subscribe_for_response`` blocks on (and the same channel
        # ``resume_pending_prompt`` re-subscribes on after a worker restart).
        wf_self_resp = await aexec(
            supabase.table("workflow_runs")
            .select("id, thread_id")
            .eq("id", str(run_id))
            .eq("user_id", current_user["id"])  # owner-scoped — no existence leak
            .maybe_single()
        )
        wf_self = wf_self_resp.data if wf_self_resp is not None else None
        if wf_self:
            anchor_resp = await aexec(
                supabase.table("threads")
                .select("active_workflow_run_id")
                .eq("id", wf_self["thread_id"])
                .eq("user_id", current_user["id"])  # thread-anchor confirm
                .maybe_single()
            )
            _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
            if str(_anchor.get("active_workflow_run_id")) == str(run_id):
                # Synthesize the Step-1 row so Steps 2-4 persist/emit/PUBLISH under
                # the workflow_run id (status is never read post-Step-1, but mirror
                # the SELECT shape for parity with the Continue fallback).
                row = {
                    "run_id": str(run_id),
                    "thread_id": wf_self["thread_id"],
                    "status": None,
                }

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # ── Step 2: persist messages row FIRST (durability — RESEARCH §A.7) ──
    # If this fails, return 500 — the agent loop has no live SUBSCRIBE we
    # could wake instead, and we don't want to silently drop the response.
    try:
        await aexec(
            supabase.table("messages").insert({
                "thread_id": row["thread_id"],
                "user_id": current_user["id"],
                "role": "system",
                "content": body.response_text,
                "tool_calls": [{
                    "kind": "ask_user_response",
                    "tool_call_id": body.tool_call_id,
                    "response_text": body.response_text,
                    "choice_index": body.choice_index,
                }],
            })
        )
    except Exception:
        logger.exception(
            "ask_user_response: messages insert failed for run %s tcid %s",
            run_id, body.tool_call_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist response",
        )

    # ── Step 3: emit ask_user_response SSE for live UI sync ──
    # Lazy import to avoid the module-load-time cycle between runs.py and
    # threads.py (threads.py already imports from this module's siblings).
    try:
        from app.api.threads import _emit  # noqa: PLC0415
        await _emit(
            redis, run_id, 'ask_user_response',
            tool_call_id=body.tool_call_id,
            response_text=body.response_text,
            choice_index=body.choice_index,
        )
    except Exception:
        logger.exception(
            "ask_user_response: SSE emit failed for run %s tcid %s",
            run_id, body.tool_call_id,
        )

    # ── Step 4: PUBLISH — wakes the paused SUBSCRIBE if it's alive ──
    # PUBLISH failure (no subscriber, worker dead, etc.) is logged but NOT
    # raised. The persist succeeded — the response is durable. Returning
    # non-200 here would mislead the user into thinking their answer wasn't
    # recorded.
    try:
        from app.services.ask_user_service import publish_response  # noqa: PLC0415
        await publish_response(
            redis, run_id, body.tool_call_id,
            body.response_text, body.choice_index,
        )
    except Exception:
        logger.exception(
            "ask_user_response: publish failed for run %s tcid %s",
            run_id, body.tool_call_id,
        )

    return {"status": "ok"}


# ───────────────────────────────────────────────────────────────────────
# POST /runs/{run_id}/continue — CONT-01 / D-06 / D-08 (Phase 092 / 092-03).
# At the iteration cap a run pauses cap_paused with its dropped tool calls
# persisted (agent_loop.persist_cap_paused). Continue resumes the SAME run with
# a FRESH bounded budget:
#   - Deep run:    CONSUMES the persisted dropped calls (re-executes them) —
#                  SC#4 (consume, not re-drop, not restart).
#   - Harness run: re-reads the active phase's available_tools from the parsed
#                  definition (D-08) + re-drives run_workflow.
# The (max_continues_per_run)-th Continue is refused server-side (D-06). The
# durable continues_used column (migration 063) survives WORKER_COUNT=2.
# ───────────────────────────────────────────────────────────────────────
def resolve_phase_available_tools(definition, active_slug: str) -> list:
    """Re-read the active phase's available_tools from the parsed definition (D-08).

    available_tools lives in the definition JSONB (per-phase config), NOT a
    workflow_phases column — so a Harness Continue MUST re-read it from the parsed
    WorkflowDefinition before resuming, never trust a stale row. Tool-bearing
    phase configs (llm_agent / llm_batch_agents) carry the whitelist; other phase
    types (llm_single / programmatic / llm_human_input) have none → empty list.
    """
    for ps in definition.phases:
        if ps.slug == active_slug:
            return list(getattr(ps.config, "available_tools", []) or [])
    return []


@router.post("/{run_id}/continue", status_code=200)
async def continue_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Resume a cap_paused run within a fresh bounded budget (CONT-01)."""
    # ── Step 1: ownership SELECT → 404 (never leak existence; T-092-09) ──
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id, continues_used")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None

    if not row:
        # Facet C (092-07) Continue-404 repair: after a page reload
        # workflowLock.runId carries the WORKFLOW_RUN id (StreamsProvider seeds it
        # from wf.active_workflow_run_id on reconcile), which is NOT a `runs` row →
        # the SELECT above 404s before the harness branch ever runs. Resolve it as
        # a workflow_runs.id UNDER THE CALLER'S OWNERSHIP (T-092-07-02: the resolve
        # stays owner-scoped — never trust the path id alone, never leak existence)
        # and confirm it is the thread's live anchor, then synthesize the Step-1 row
        # so the existing harness branch drives it.
        wf_self_resp = await aexec(
            supabase.table("workflow_runs")
            .select("id, thread_id, continues_used")
            .eq("id", str(run_id))
            .eq("user_id", current_user["id"])
            .maybe_single()
        )
        wf_self = wf_self_resp.data if wf_self_resp is not None else None
        if wf_self:
            # Confirm this workflow_run is the thread's CURRENT live anchor (only
            # Continue the thread's active workflow — owner-scoped thread read).
            anchor_resp = await aexec(
                supabase.table("threads")
                .select("active_workflow_run_id")
                .eq("id", wf_self["thread_id"])
                .eq("user_id", current_user["id"])
                .maybe_single()
            )
            _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
            if str(_anchor.get("active_workflow_run_id")) == str(run_id):
                row = {
                    "run_id": str(run_id),
                    "status": None,
                    "thread_id": wf_self["thread_id"],
                    "continues_used": wf_self.get("continues_used") or 0,
                }

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    thread_id = row["thread_id"]

    # ── Step 2: detect Deep vs Harness — read continues_used from the row that
    # carries the cap. A Harness run's cap lives on workflow_runs (via the
    # thread anchor); a Deep run's cap lives on the runs row. ──
    thread_resp = await aexec(
        supabase.table("threads")
        .select("active_workflow_run_id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    _thread = thread_resp.data if thread_resp is not None else None
    active_workflow_run_id = (_thread or {}).get("active_workflow_run_id")

    continues_used = row.get("continues_used") or 0
    wf_row = None
    if active_workflow_run_id is not None:
        wf_resp = await aexec(
            supabase.table("workflow_runs")
            # F8 (092-07): pull `inputs` too so the re-driven first phase can read
            # the original kickoff_prompt back (Continue resume path).
            .select("id, continues_used, definition_id, inputs")
            .eq("id", str(active_workflow_run_id))
            .maybe_single()
        )
        wf_row = wf_resp.data if wf_resp is not None else None
        if wf_row is not None:
            continues_used = wf_row.get("continues_used") or 0

    # ── Step 3: refuse the 4th Continue server-side (D-06 / T-092-10) ──
    # Durable counter — never an in-memory count (WORKER_COUNT=2). No spawn.
    if continues_used >= settings.max_continues_per_run:
        return JSONResponse(
            status_code=200,
            content={
                "status": "refused",
                "message": (
                    f"All {settings.max_continues_per_run} Continues used — "
                    "this run is stopped. Start a new message to keep going."
                ),
                "continues_used": continues_used,
                "continues_remaining": 0,
            },
        )

    # ── Step 4: transactionally increment continues_used on the carrying row ──
    _new_used = continues_used + 1
    try:
        if active_workflow_run_id is not None:
            await aexec(
                supabase.table("workflow_runs")
                .update({"continues_used": _new_used})
                .eq("id", str(active_workflow_run_id))
            )
        else:
            await aexec(
                supabase.table("runs")
                .update({"continues_used": _new_used, "status": "streaming"})
                .eq("run_id", str(run_id))
            )
    except Exception:
        logger.exception("continue: continues_used increment failed for run %s", run_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record continue",
        )

    # ── Step 5: branch — Harness re-drive vs Deep consume ──
    if active_workflow_run_id is not None:
        # Harness: re-read available_tools from the definition (D-08) + re-drive.
        from app.services.harness_engine import (  # noqa: PLC0415
            run_workflow, _load_run_definition, _emit as _harness_emit,
        )
        from app.db.workflows import get_active_phase  # noqa: PLC0415
        from types import SimpleNamespace  # noqa: PLC0415
        from app.dependencies import get_pg_pool  # noqa: PLC0415
        from app.api.threads import RUN_TASKS as _RUN_TASKS  # noqa: PLC0415
        # F5 (092-07): the same module-level _spawn the Deep RunContext uses
        # (threads.py:105 / :1198) — gives a re-driven sub-agent task() the same
        # fire-and-forget spawn surface Deep has.
        from app.api.threads import _spawn as _spawn_harness_resume  # noqa: PLC0415
        import asyncio as _asyncio  # noqa: PLC0415

        from app.db.runs import insert_run as _insert_run, finalize_run as _finalize_run  # noqa: PLC0415
        from uuid import uuid4 as _uuid4  # noqa: PLC0415
        from datetime import datetime as _dt, timezone as _tz  # noqa: PLC0415

        pool = await get_pg_pool()
        wf_run_uuid = (
            UUID(active_workflow_run_id)
            if isinstance(active_workflow_run_id, str)
            else active_workflow_run_id
        )
        definition = await _load_run_definition(pool, wf_run_uuid)
        active_phase = await get_active_phase(pool, wf_run_uuid)
        # D-08: re-read the active phase's whitelist from the PARSED definition.
        _available_tools = (
            resolve_phase_available_tools(definition, active_phase["slug"])
            if (definition is not None and active_phase is not None) else []
        )
        logger.info(
            "continue: harness re-drive run=%s phase=%s available_tools=%s",
            wf_run_uuid, (active_phase or {}).get("slug"), _available_tools,
        )

        # Facet C (092-07): mint a fresh producer-shell `runs` row (same as the
        # startup-sweep resume) so the re-driven sub-agents' parent_run_id FK
        # resolves (Facet A) and events route to run:{producer} (Facet B). The
        # original producer id is finalized/EXPIREd; no producer-id column persists.
        _thread_uuid = UUID(thread_id) if isinstance(thread_id, str) else thread_id
        _producer_id = _uuid4()
        await _insert_run(
            pool,
            run_id=_producer_id,
            thread_id=_thread_uuid,
            user_id=(
                UUID(current_user["id"])
                if isinstance(current_user["id"], str) else current_user["id"]
            ),
            status="streaming",
            model="unknown", provider="unknown",  # NOT NULL; shell makes no LLM call
            parent_run_id=None,
        )

        # F8 (092-07): rehydrate the original kickoff_prompt from the persisted
        # workflow_runs.inputs jsonb so a re-driven first phase still acts on the
        # user's question. supabase-py decodes jsonb to a dict, but parse
        # defensively (str → json.loads) to match the startup-sweep resume builder.
        import json as _json_harness_resume  # noqa: PLC0415
        _wf_inputs = (wf_row or {}).get("inputs") or {}
        if isinstance(_wf_inputs, str):
            try:
                _wf_inputs = _json_harness_resume.loads(_wf_inputs)
            except (ValueError, TypeError):
                _wf_inputs = {}
        if not isinstance(_wf_inputs, dict):
            _wf_inputs = {}

        # D-04 (site 3 — Continue) + Open Q2: thread the resolved ctx model onto the
        # continuation wf_ctx. The continuation previously set user_settings=None +
        # no model, so the resolver never fired on Continue (only phase.config.model
        # applied). Load the run OWNER's effective settings (the owner is verified at
        # the Step-1 ownership SELECT — current_user["id"]) using the SAME loader the
        # kickoff path uses (threads.py:900 load_user_settings), then resolve via the
        # resolve-never-mutate wrapper (D-05): a stale cross-provider llm_model falls
        # back to the active provider's default instead of leaking to the wrong client
        # (T-093-MISROUTE). Phase-level precedence is unchanged downstream:
        # phase.config.model or ctx.model (phase_types._effective_model) — this only
        # sets ctx.model. If loading the owner's settings fails for any reason, fall
        # back to None settings + "" model (resolve_workflow_ctx_model(None) -> "");
        # phase-level model still applies — never block the Continue on this.
        from app.models.user_settings import load_user_settings  # noqa: PLC0415
        from app.services.sub_agent_models import resolve_workflow_ctx_model  # noqa: PLC0415
        try:
            _owner_settings = load_user_settings(current_user["id"])
        except Exception:  # noqa: BLE001
            logger.exception(
                "continue: owner effective-settings load failed for run %s "
                "(falling back to phase-level model only)", wf_run_uuid,
            )
            _owner_settings = None
        _ctx_model = resolve_workflow_ctx_model(_owner_settings)

        async def _harness_continuation():
            wf_ctx = SimpleNamespace(
                run_id=wf_run_uuid,
                # Facet C (092-07): the fresh producer runs id (FK target + stream).
                producer_run_id=_producer_id,
                thread_id=thread_id,
                current_user=current_user,
                # D-04 (site 3): owner effective settings + resolved ctx model so the
                # re-driven phases resolve a non-stale model from the active provider.
                user_settings=_owner_settings,
                model=_ctx_model,
                # F8 (092-07): the persisted inputs (kickoff_prompt) for the re-driven run.
                inputs=_wf_inputs,
                redis=redis,
                pool=pool,
                emit=_harness_emit,
                retry_feedback=None,
                # F5 (092-07): the tool-context fields every Supabase tool reads via
                # ctx.<field>. The Continue endpoint HAS the request supabase
                # (Depends(get_supabase), runs.py:622) in scope — pass it so a
                # re-driven phase's search_documents resolves (without it ctx.supabase
                # is None → AttributeError on the first RPC). Owner-scoped retrieval is
                # preserved: search_documents filters by current_user["id"] (this run's
                # verified owner from the Step-1 ownership SELECT). Folder scope is not
                # rehydrated on continue (best-effort None → unscoped search); spawn +
                # a fresh per-run semaphore complete the tool substrate.
                supabase=supabase,
                folder_subtree_ids=None,
                scoped_folder_path=None,
                spawn=_spawn_harness_resume,
                per_run_task_semaphore=_asyncio.Semaphore(
                    settings.task_per_run_concurrency
                ),
            )
            _failed = False
            try:
                await run_workflow(
                    wf_run_uuid, definition, wf_ctx, pool=pool, redis=redis,
                    stream_run_id=_producer_id,
                )
            except Exception:
                _failed = True
                logger.exception("Harness continuation failed for run %s", wf_run_uuid)
            finally:
                # Facet C: terminalize the fresh producer shell on EVERY exit path
                # (no stranded streaming row → the F2 self-heal is never defeated),
                # BEFORE the _RUN_TASKS.pop.
                try:
                    await _finalize_run(
                        pool,
                        run_id=_producer_id,
                        status="failed" if _failed else "completed",
                        error="continuation failed" if _failed else None,
                        completed_at=_dt.now(_tz.utc),
                        message_id=None,
                        input_tokens=None,
                        output_tokens=None,
                    )
                except Exception:
                    logger.exception(
                        "continue: producer-shell finalize failed for %s", _producer_id
                    )
                _RUN_TASKS.pop(wf_run_uuid, None)

        _t = _asyncio.create_task(_harness_continuation())
        _RUN_TASKS[wf_run_uuid] = _t
        _t.add_done_callback(lambda _x, _r=wf_run_uuid: _RUN_TASKS.pop(_r, None))
    else:
        # Deep: CONSUME the persisted dropped tool calls (SC#4).
        from app.db.runs import load_cap_paused_tool_calls  # noqa: PLC0415
        from app.api.threads import spawn_continuation_run  # noqa: PLC0415
        from app.dependencies import get_pg_pool  # noqa: PLC0415

        pool = await get_pg_pool()
        thread_uuid = UUID(thread_id) if isinstance(thread_id, str) else thread_id
        dropped = await load_cap_paused_tool_calls(pool, thread_uuid)
        await spawn_continuation_run(
            run_id=run_id,
            thread_id=thread_id,
            current_user=current_user,
            redis=redis,
            supabase=supabase,
            dropped_tool_calls=dropped,
        )

    _resp = {
        "status": "ok",
        "run_id": str(run_id),
        "continues_used": _new_used,
        "continues_remaining": max(0, settings.max_continues_per_run - _new_used),
    }
    # Facet C (092-07): surface the fresh producer id so the frontend re-subscribes
    # GET /runs/{producer_run_id}/stream (the original producer stream EXPIREd). Only
    # the Harness re-drive mints one; the Deep consume path keeps the same run_id.
    if active_workflow_run_id is not None:
        _resp["producer_run_id"] = str(_producer_id)
    return _resp


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
        # Phase 085 D-085-04 — PUBLISH cancel sentinel BEFORE task.cancel() so
        # any paused _handle_ask_user wakes and returns a normal ToolResult
        # ("ask_user cancelled by user stop") BEFORE CancelledError propagates
        # (RESEARCH §A.5 PUBLISH-first ordering). Without this ordering, the
        # CancelledError lands inside pubsub.get_message's wait loop, the
        # handler returns normally to its finally, the agent loop is still
        # mid-iteration but the run terminates without a kind='ask_user_
        # response' companion row — GET /threads/{tid}/ask_user/pending would
        # then return that prompt forever.
        #
        # Best-effort — never block the cancel verb on Redis failure (the
        # same discipline as the zombie-heal Redis ops below).
        try:
            from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
            await publish_cancel_sentinel(redis, run_id)
        except Exception:
            logger.exception(
                "ask_user cancel sentinel broadcast failed for run %s", run_id
            )
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

    # Phase 092 (092-03 / SC#2, MODE-02) — clear the per-thread workflow lock
    # anchor on cancel so a cancelled Harness/cap_paused run never strands the
    # thread Harness-locked. Keyed by the thread (a cancel knows its thread_id,
    # not necessarily the workflow_runs id the anchor points at). Best-effort,
    # symmetric with the zombie-heal Redis ops (D-062-13). The happy-path live
    # cancel reaches the same clear via the engine's finish_run (the single
    # authoritative workflow_runs-side site); this is the zombie-heal sibling.
    try:
        await aexec(
            supabase.table("threads")
            .update({"active_workflow_run_id": None})
            .eq("id", thread_id)
        )
    except Exception:
        logger.exception(
            "Zombie heal anchor-clear failed for thread %s (run %s)",
            thread_id, run_id,
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
