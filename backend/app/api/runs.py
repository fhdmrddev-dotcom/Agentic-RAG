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
    _RUN_STATUS_TO_TERMINAL_TYPE,
)
from app.config import settings
# Phase 163 (TEN-02): get_user_supabase_client = the per-request user-JWT (RLS-enforced)
# client the request handlers inject (D-03). get_supabase is KEPT for the D-05 carve-outs
# only — the background harness/Deep continuation + the shared cancel/zombie-heal writer
# (run_lifecycle) stay service-role (no auth.uid() off-request).
from app.dependencies import (
    get_current_user,
    get_redis,
    get_supabase,
    get_user_supabase_client,
)
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
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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

    # CTX-01 (T-120-04 / A2): the ask_user_response row's origin. The Step-1 SELECT
    # above resolves a Deep ``runs`` row → 'deep' (default). The harness workflow_runs
    # fallback below synthesizes ``row`` → 'harness'. Mis-tagging a workflow reply
    # 'deep' is the SAFE direction (it only re-shows in a later Deep turn); mis-tagging
    # a Deep reply 'harness' would DROP it from Deep replay — so default 'deep' and set
    # 'harness' ONLY on the confirmed-workflow branch.
    _origin = "deep"

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
                # CTX-01 (A2): confirmed workflow_run reply → tag 'harness'.
                _origin = "harness"

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
                # CTX-01 (A2): 'harness' only on the confirmed-workflow branch, else 'deep'.
                "origin": _origin,
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
    phase configs carry the whitelist; the rest have none → empty list, which is
    why the read is a defensive getattr over the discriminated union.

    ⚠ CORRECTED at Phase 189 (D-03 / D-26), in the commit that falsified it. The two
    lists above used to be spelled out as "(llm_agent / llm_batch_agents)" and
    "(llm_single / programmatic / llm_human_input)". Both were already incomplete
    (llm_emit, added at 101.1, appears in neither) and 189 makes the first one wrong:
    the 7th type, external_action, carries available_tools too, because D-03 puts its
    chosen capability there so the step rides this very re-read and the phase_whitelist
    dispatch backstop behind it. Enumerating union members in prose rots on every
    additive growth, so the rule is stated instead of the roster.
    """
    for ps in definition.phases:
        if ps.slug == active_slug:
            return list(getattr(ps.config, "available_tools", []) or [])
    return []


@router.post("/{run_id}/continue", status_code=200)
async def continue_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    # Phase 163 (D-05/D-09): service-role for the DETACHED continuation ONLY. Every
    # request-scoped read/write below (ownership SELECTs, the continues_used update,
    # the project-scope resolution) runs on the RLS-enforced `supabase`; the background
    # harness re-drive (wf_ctx.supabase) and the Deep spawn_continuation_run producer
    # stay service-role — the agent-loop async writer has no auth.uid() off-request.
    service_supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Resume a cap_paused run within a fresh bounded budget (CONT-01)."""
    # ── Step 1: ownership SELECT → 404 (never leak existence; T-092-09) ──
    row_resp = await aexec(
        supabase.table("runs")
        # Phase 163 (D-05): pull org_id off the RLS-verified run row so the Deep
        # continuation's cap-paused read (load_cap_paused_tool_calls) can carry an
        # org-scoping predicate on the service-role pool (belt-and-suspenders).
        .select("run_id, status, thread_id, continues_used, org_id")
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
        # 098 (GOV-01/PROJ-02 — site 3 Continue): the shared run-start scope resolver
        # + DB-aware ⊆ validator so a re-driven bound workflow stays inside its project.
        from app.services.harness.scope import (  # noqa: PLC0415
            assert_folder_scopes_subset as _assert_folder_scopes_subset,
            resolve_project_subtree as _resolve_project_subtree,
            resolve_run_scope_root as _resolve_run_scope_root,
        )

        from app.db.runs import insert_run as _insert_run, finalize_run as _finalize_run  # noqa: PLC0415
        from uuid import uuid4 as _uuid4  # noqa: PLC0415
        from datetime import datetime as _dt, timezone as _tz  # noqa: PLC0415

        # Phase 163 (D-05): the harness re-drive substrate — _load_run_definition /
        # get_active_phase / _insert_run (producer shell) / run_workflow are the
        # agent-loop/run-lifecycle writers; they stay on the raw service-role pool
        # (NOT get_user_pg_connection). The request-scoped ownership gate already ran.
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

        # 098 (GOV-01 / PROJ-02 — site 3 Continue): pre-resolve the run-start retrieval
        # scope from the run's PROJECT binding BEFORE the async continuation closure
        # (the closure runs in a background task — compute the value here, then close
        # over it). Closes the folder_subtree_ids=None whole-KB bypass at the wf_ctx
        # below so a bound workflow stays inside its project across a Continue. Owner-
        # scoped via current_user["id"] (the verified run owner from the Step-1 ownership
        # SELECT). An UNBOUND definition (project_folder_id None) resolves to None →
        # whole-KB unchanged. Best-effort: a resolution failure must NEVER block the
        # Continue (fall back to None + log, matching the never-block-the-Continue
        # posture of the owner-settings load above).
        _cont_subtree: "list[str] | None" = None
        # getattr (not attribute access) defends the sentinel definitions some tests
        # inject via a stubbed _load_run_definition; a real WorkflowDefinition always
        # has the field. An unbound workflow (None) skips resolution → whole-KB.
        _cont_project_folder_id = getattr(definition, "project_folder_id", None)
        try:
            if _cont_project_folder_id is not None:
                # D-07 DB half (unchanged): re-assert every per-phase folder_scope ⊆ the
                # project subtree before binding retrieval scope.
                await _assert_folder_scopes_subset(
                    definition, supabase=supabase, user_id=current_user["id"]
                )
            # 152 WFIN-02 (Pitfall 5): layer the durable per-run folder override from
            # workflow_runs.inputs so a CONTINUED run stays on the operator's chosen
            # folder instead of silently reverting to the author default. The helper
            # owner-re-validates the override (a since-deleted folder degrades safely).
            _cont_scope_root = await _resolve_run_scope_root(
                definition,
                run_inputs=_wf_inputs,
                thread_folder_id=None,
                supabase=supabase,
                user_id=current_user["id"],
            )
            if _cont_scope_root is not None:
                _cont_subtree = await _resolve_project_subtree(
                    _cont_scope_root,
                    supabase=supabase,
                    user_id=current_user["id"],
                )
        except Exception:  # noqa: BLE001
            logger.exception(
                "continue: project-scope resolution failed for run %s "
                "(falling back to unscoped search)", wf_run_uuid,
            )
            _cont_subtree = None
            # WR-03 (098 secure-phase): EMIT scope_resolution_failed so the fall-open is
            # OBSERVABLE in the run timeline — otherwise a bound workflow silently degrades
            # to whole-KB on a transient failure (the Plan-05 clip + scope_violation are
            # gated on `folder_subtree_ids is not None` and never fire on this None
            # fallback). Gated on a BOUND workflow (bound=True holds) — an unbound run whose
            # override merely dropped has no governance scope to signal. Continue is an
            # in-flight re-drive → stays fail-OPEN (never block the Continue).
            if _cont_project_folder_id is not None:
                try:
                    await _harness_emit(
                        redis,
                        wf_run_uuid,
                        "scope_resolution_failed",
                        site="continue",
                        bound=True,
                        detail=(
                            "project-scope resolution failed; "
                            "retrieval degraded to whole-KB"
                        ),
                    )
                except Exception:  # noqa: BLE001 — emit is best-effort
                    logger.debug(
                        "continue: scope_resolution_failed emit failed for run %s",
                        wf_run_uuid,
                    )

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
                # verified owner from the Step-1 ownership SELECT). 098 (GOV-01): folder
                # scope is now resolved from the run's project binding (_cont_subtree,
                # pre-resolved above) so a bound workflow stays inside its project across
                # a Continue; an unbound workflow stays None (unscoped, unchanged). spawn
                # + a fresh per-run semaphore complete the tool substrate.
                # Phase 163 (D-05/D-09): the harness re-drive is the agent-loop
                # async-writer path — service-role, NOT the request's user-JWT client.
                supabase=service_supabase,
                folder_subtree_ids=_cont_subtree,
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
        # Phase 162.5 Plan 03 (G-5 extraction): spawn_continuation_run moved to
        # run_producer.py (folded onto the shared _finalize_producer_run).
        from app.services.run_producer import spawn_continuation_run  # noqa: PLC0415
        from app.dependencies import get_pg_pool  # noqa: PLC0415

        # Phase 163 (D-05): load_cap_paused_tool_calls + spawn_continuation_run are the
        # Deep continuation run-lifecycle/producer writers — raw service-role pool.
        pool = await get_pg_pool()
        thread_uuid = UUID(thread_id) if isinstance(thread_id, str) else thread_id
        # Phase 163 (D-05): org-scope the service-role cap-paused read when the run row
        # carried org_id (row.get is None-safe for mock/legacy rows → byte-identical).
        _cont_org_id = row.get("org_id")
        _cont_org_uuid = (
            UUID(_cont_org_id) if isinstance(_cont_org_id, str) else _cont_org_id
        )
        dropped = await load_cap_paused_tool_calls(
            pool, thread_uuid, org_id=_cont_org_uuid
        )
        await spawn_continuation_run(
            run_id=run_id,
            thread_id=thread_id,
            current_user=current_user,
            redis=redis,
            # Phase 163 (D-05/D-09): the Deep continuation producer is service-role.
            supabase=service_supabase,
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
# ── Phase 194 (194-11 / RUN-01 / SC#1) — the route accepts a SECOND id shape ──
#
# ⚠ THE FINDING THIS FALLBACK EXISTS FOR, WRITTEN HERE BECAUSE THIS IS WHERE THE
# NEXT READER LOOKS. The frontend's ``WorkflowLock.runId`` CARRIES TWO ID TYPES:
# some write sites store a ``workflow_runs.id`` (StreamsProvider seeds it from
# ``wf.active_workflow_run_id`` on reconcile) and others store a producer
# ``runs.run_id``. Its own JSDoc asserts only the first. Until 194-11 this route
# accepted ONLY the second, and the client's ``cancelRun`` SWALLOWS 404 — so a Stop
# resolved through the anchor id SILENTLY SUCCEEDED WHILE DOING NOTHING. That is
# precisely the dishonesty RUN-01/SC#2 forbids, and a silent success is worse than a
# visible failure in a phase about honesty.
# ⚠ This was measured once before, in Phase 188, and recorded ONLY in a comment at
# ``WorkspacePanel.tsx:161-165`` — so it was invisible to Phase 194 until re-derived.
# A measurement that lives in one file's comment is invisible to the next phase.
#
# The repair is the shipped dual-id fallback, MIRRORED not invented: this is the
# THIRD route on the /runs prefix to gain it, after ``continue_run`` (:722-756,
# Facet C / 092-07) and ``submit_ask_user_response`` (:537-584, F10 / 093). The
# three clauses are NONE OF THEM OPTIONAL and they ARE the access boundary, not a
# convenience — see the block comment on the fallback itself.
#
# ⚠ BUT THIS ROUTE CANNOT STOP WHERE /continue STOPS, AND THAT IS THE HALF NEITHER
# SHIPPED FALLBACK HAS. The shared cancel writer keys ``RUN_TASKS`` and
# ``finalize_run_terminal`` on the PRODUCER ``runs.run_id``. Hand it a
# ``workflow_runs.id`` and you get: RUN_TASKS miss → Step 3b → ``finalize_run_terminal``
# updates ZERO ``runs`` rows → **the live producer task is never cancelled while this
# route returns 204.** The same silent success, moved server-side. So the fallback
# resolves FORWARD to the producer identity (a LEFT JOIN to the live ``runs`` row),
# and when no producer is alive it does NOT call the shared writer at all — it calls
# the exported workflow-side composition instead. Both forward arms return 204.
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
    supabase: Client = Depends(get_user_supabase_client),
    # Phase 163 (D-05/D-09): the Step-1 ownership SELECT below runs on the RLS-enforced
    # `supabase` (the real cross-user gate now). `_cancel_run_internals` is the SHARED
    # run-lifecycle cancel/zombie-heal WRITER (reused verbatim by the operator Kill path,
    # which is cross-user + service-role by design) — it stays service-role here too so
    # the shared helper receives one client type from both callers (behavior-preserving).
    service_supabase: Client = Depends(get_supabase),
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
        # ── Step 1b (194-11 / RUN-01 / SC#1): the dual-id fallback ──
        #
        # BRANCH, NEVER REPLACE (D-08) — the rule this route inherits verbatim from
        # the ask_user fallback's own comment at :549-552: "the Step-1 ``runs`` SELECT
        # above stays FIRST and unchanged — Deep's runs-keyed … path is byte-identical
        # and still returns 200; this fallback only engages AFTER that SELECT misses."
        # A producer ``runs.run_id`` therefore never reaches a single line below.
        #
        # ⚠ THE THREE CLAUSES BELOW ARE THE ACCESS BOUNDARY, NOT A CONVENIENCE, AND
        # NONE OF THEM IS OPTIONAL:
        #   (a) ``.eq("user_id", …)`` on the ``workflow_runs`` select,
        #   (b) ``.eq("user_id", …)`` on the ``threads`` anchor read,
        #   (c) the anchor equality check.
        # The workflow cluster is read further down this route through a SERVICE-ROLE
        # pool that BYPASSES RLS, so on that side the WHERE clause is the only gate;
        # these three keep an attacker-chosen uuid from ever reaching it. Phase 190's
        # CR-01 was a REAL credential exposure that 19 plans of RED-first self-checking
        # missed, and a later quick task found a missing owner-prefix clause returning
        # another user's asset — which is why each clause has its OWN fence and its OWN
        # plant (F-10, ``test_062_cancel_run.py``), rather than one fence for all three.
        #
        # 404 — NEVER 403 — on every miss: "doesn't exist" and "not yours" must be
        # INDISTINGUISHABLE (T-062-01 / D-062-12), the same collapse both shipped
        # fallbacks make.
        wf_self_resp = await aexec(
            supabase.table("workflow_runs")
            .select("id, thread_id")
            .eq("id", str(run_id))
            .eq("user_id", current_user["id"])  # (a) owner-scoped — no existence leak
            .maybe_single()
        )
        wf_self = wf_self_resp.data if wf_self_resp is not None else None
        if wf_self:
            anchor_resp = await aexec(
                supabase.table("threads")
                .select("active_workflow_run_id")
                .eq("id", wf_self["thread_id"])
                .eq("user_id", current_user["id"])  # (b) thread-anchor confirm
                .maybe_single()
            )
            _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
            if str(_anchor.get("active_workflow_run_id")) == str(run_id):  # (c)
                # ── FORWARD RESOLUTION — the half neither shipped fallback needs ──
                #
                # A live kickoff-started run's producer task is registered in
                # ``RUN_TASKS`` under the PRODUCER ``runs.run_id`` (threads.py:2011),
                # NOT the ``workflow_runs.id``. Resolve that producer identity via a
                # LEFT JOIN to the live ``runs`` row and cancel through IT — the same
                # shape ``delete_workflow_cascade`` has used since Phase 152
                # (api/workflows.py:1483-1518), narrowed here to ONE workflow run.
                # ``$N`` binds only — no f-string ever reaches this SQL (T-152-05-05).
                #
                # ⚠ CR-01 (194 code review) — THE JOIN MUST NARROW TO THE PRODUCER, AND
                # THE PICK MUST BE DETERMINISTIC. As first shipped this join linked on
                # ``thread_id`` + ``status = 'streaming'`` alone, with no ordering and no
                # limit, and the route took ``next(...)`` over the result. SUB-AGENT runs
                # live on the SAME thread with the SAME ``'streaming'`` status
                # (``task_service.py``'s ``insert_run`` writes
                # ``parent_run_id=parent_ctx.run_id``), and a harness phase's tool context
                # is built with ``parent_run_id=None`` and ``spawn`` threaded through
                # PRECISELY so a phase can spawn them. A Stop pressed during a
                # ``task_sub_agent`` phase could therefore rebind ``run_id`` to the
                # SUB-AGENT, cancel THAT, leave the real producer running — and still
                # return 204. That is the silent success this whole fallback exists to
                # remove, one level deeper.
                #   * ``r.parent_run_id IS NULL`` — a sub-agent shell is never a producer.
                #   * ``ORDER BY r.started_at DESC`` — a dead earlier producer can leave a
                #     stale ``streaming`` row on the thread (that is what the zombie arm
                #     heals); the LIVE producer is the most recently started one. The
                #     ``r.run_id`` tiebreaker makes identical timestamps deterministic too
                #     — the same discipline 193.2 needed on the library feeds.
                #   * ``LIMIT 1`` + an INDEXED read below, never ``next(...)`` over an
                #     arbitrarily-ordered result: the route acts on one row, so it must
                #     say which one.
                # ⚠ This NARROWS what the query can reach and widens nothing. On a
                # service-role pool that bypasses RLS the WHERE clause is the access
                # boundary; the three owner/anchor clauses above are unchanged and still
                # gate every path into here.
                from app.dependencies import get_pg_pool  # noqa: PLC0415
                pool = await get_pg_pool()
                _live = await pool.fetch(
                    "SELECT wr.id AS wf_id, wr.thread_id, "
                    "r.run_id AS producer_id, r.status AS producer_status "
                    "FROM workflow_runs wr "
                    "LEFT JOIN runs r ON r.thread_id = wr.thread_id "
                    "AND r.status = 'streaming' "
                    "AND r.parent_run_id IS NULL "
                    "WHERE wr.id = $1 "
                    "ORDER BY r.started_at DESC NULLS LAST, r.run_id DESC "
                    "LIMIT 1",
                    run_id,
                )
                # LEFT JOIN semantics: the workflow row survives with NULL producer
                # columns when nothing matched, which is the no-producer arm below.
                _row = _live[0] if _live else None
                _producer = (
                    _row if _row is not None and _row["producer_id"] is not None else None
                )
                if _producer is not None:
                    # Synthesize Step 1's row from the PRODUCER identity, so Steps
                    # 2/3a/3b below run UNCHANGED and actually reach the live task.
                    #
                    # ⚠ ``run_id`` IS DELIBERATELY REBOUND TO THE PRODUCER ID HERE, and
                    # that is the whole point of the forward resolution rather than an
                    # incidental tidy-up. The shared writer below is called as
                    # ``run_id=run_id`` — byte-unchanged, which is what keeps the Deep
                    # path identical — and it keys ``RUN_TASKS`` and
                    # ``finalize_run_terminal`` on the PRODUCER id. Leaving the path's
                    # ``workflow_runs.id`` bound here would miss ``RUN_TASKS``, take the
                    # zombie arm, update ZERO ``runs`` rows and still 204. A UUID is
                    # coerced so the registry lookup (keyed by UUID objects) cannot miss
                    # on a string that merely prints the same.
                    _pid = _producer["producer_id"]
                    run_id = UUID(str(_pid)) if not isinstance(_pid, UUID) else _pid
                    #
                    # ⚠ THE STATUS MUST BE THE PRODUCER'S, NOT ``None``. This route
                    # READS ``row["status"]`` as Step 2's terminal check, whereas the
                    # ask_user fallback synthesizes ``status: None`` and never reads it
                    # — so copying that shape here would silently reclassify every
                    # already-terminal producer as cancellable.
                    row = {
                        "run_id": str(run_id),
                        "status": _producer["producer_status"],
                        "thread_id": (
                            str(_producer["thread_id"])
                            if _producer["thread_id"] is not None
                            else None
                        ),
                    }
                else:
                    # ── No live producer: terminalize the WORKFLOW side directly ──
                    #
                    # Do NOT fall through to the shared cancel writer with the
                    # ``workflow_runs.id``: it would miss ``RUN_TASKS``, take the zombie
                    # arm, update ZERO ``runs`` rows and return 204 — a success report
                    # over a no-op. There is no producer to cancel, so the honest act is
                    # to write the terminal state the run will otherwise never get.
                    #
                    # ONE MECHANISM (D-08/D-10): call plan 194-09's EXPORTED composition
                    # rather than re-composing ``finish_run`` + ``cancel_active_phases``
                    # here. It coerces the id, carries its own D-062-13 best-effort
                    # try/except and never raises. This is exactly what
                    # ``delete_workflow_cascade`` already does, shipped since Phase 152.
                    from app.services.ask_user_service import (  # noqa: PLC0415
                        publish_cancel_sentinel,
                    )
                    from app.services.run_lifecycle import (  # noqa: PLC0415
                        cancel_workflow_run_internals,
                    )

                    # Wake any paused harness ask_user prompt — the harness subscribes
                    # on the WORKFLOW run id channel. Best-effort by contract; wrapped
                    # anyway so a Redis outage can never fail a Stop (D-062-13).
                    try:
                        await publish_cancel_sentinel(redis, run_id)
                    except Exception:
                        logger.exception(
                            "cancel_run: workflow cancel sentinel failed for "
                            "workflow run %s",
                            run_id,
                        )
                    _wrote = await cancel_workflow_run_internals(
                        pool=pool, workflow_run_id=run_id
                    )
                    # ⚠ CR-03 (194 code review) — THIS ARM MAY NOT REPORT A WRITE IT
                    # CANNOT KNOW HAPPENED. The comment here used to read "Postgres is
                    # the durable cancel record (D-062-13), and this arm has just
                    # written it", and that second clause was a claim the code could not
                    # make: the composition swallows every exception by contract and
                    # returned nothing, so a pool exhaustion or a transient Postgres
                    # error left ``workflow_runs`` ``active`` FOREVER while this route
                    # answered 204 and ``cancelRun`` reported success. The shipped
                    # justification for that swallow — "the chat-side cancel has already
                    # landed" — is true of the Step-3b caller and FALSE HERE, where this
                    # is the ONLY durable write in the whole request. So the composition
                    # now REPORTS (it still never raises), and this arm acts on it.
                    # 204 on this route means "stopped, durably"; with no producer to
                    # cancel and the write gone, NOTHING has happened, and the honest
                    # answer is a failure the client can see. Step 3b keeps ignoring the
                    # report — its best-effort framing is still correct there.
                    if not _wrote:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not stop the run",
                        )
                    # Same 204 as every other arm — Postgres is the durable cancel
                    # record (D-062-13), and this arm has now confirmed it wrote.
                    return Response(status_code=status.HTTP_204_NO_CONTENT)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # ── Steps 2/3a/3b: the shared cancel / zombie-heal discipline (D-02) ──
    # The idempotent-terminal 204, the PUBLISH-first ask_user sentinel + task.cancel()
    # happy path, and the finalize_run_terminal + SETNX + EXPIRE zombie heal all live in
    # ONE shared helper (run_lifecycle._cancel_run_internals) so the operator-side Kill
    # reuses the EXACT same discipline WITHOUT drifting — the only thing the operator
    # path drops is Step 1's ownership SELECT above. The owner path here is byte-
    # equivalent: still idempotent-204, still PUBLISH-first, still zombie-heals. Local
    # import keeps the helper off the /runs module-load path (runs.py style) and avoids
    # the runs<->run_lifecycle import cycle.
    from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415

    await _cancel_run_internals(
        run_id=run_id,
        status=row["status"],
        thread_id=row["thread_id"],
        redis=redis,
        # Phase 163 (D-05): shared run-lifecycle writer — service-role (matches the
        # operator Kill path); the owner gate above already enforced RLS ownership.
        supabase=service_supabase,
    )

    # Always 204 — every sub-path (terminal-noop / task-cancelled / zombie-healed)
    # returns success; Postgres runs.status is the durable cancel record (D-062-13).
    return Response(status_code=status.HTTP_204_NO_CONTENT)
