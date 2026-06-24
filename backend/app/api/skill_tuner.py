"""Phase 123 (TRIG-01) — the Skill Trigger Tuner network surface.

This wraps the Plan-03 ``skill_tuner_service`` orchestration core in a net-new,
owner-scoped router mounted under ``/skills/{skill_id}/tuner/...``:

  1. ``POST /skills/{skill_id}/tuner/runs`` — owner-verify the skill, kick off a BOUNDED
     background tuning run over the Phase-061+ Redis run-buffer, and return a ``run_id``
     IMMEDIATELY (non-blocking, D-06). The author can leave and reconcile on return.
  2. ``GET  /skills/{skill_id}/tuner/runs/{run_id}/stream`` — owner-verify, then return an
     ``EventSourceResponse`` over the SHARED ``replay_tail_consumer`` (runs.py) so live
     per-provider progress streams as tuner-specific SSE events.
  3. ``GET  /skills/{skill_id}/tuner/runs/{run_id}`` — owner-verify, return the held-out
     scoreboard (per-provider cells carrying BOTH fires/no_false sub-scores) + the candidate
     descriptions once the run is complete.

OWNER-SCOPING IS THE SOLE GATE (V4 / T-123-04-01): ``get_supabase()`` is the SERVICE-ROLE
client (RLS bypassed), so the app-code ``.eq("user_id", ...)`` / ``.or_(...own,global)`` on
EVERY route is the only thing standing between user A and user B's skill. A user can NEVER
start, stream, or read a tuning run for another user's non-global skill — a miss returns 404
(never 403 — don't leak existence). The cross-user-404 integration test is the load-bearing
proof.

BOUNDED RUN (DoS — T-123-04-02): the background job is capped on every axis — at most
``MAX_CASES`` benchmark cases, at most ``MAX_TARGETS`` provider columns, at most
``MAX_ITERATIONS`` (=5) candidate iterations, each provider call wrapped with the registry
``get_per_call_timeout`` deadline, and exactly ONE in-flight job per skill (``runs:active``
+ a per-skill in-flight guard) — no unbounded fan-out / cost blow-up.

TUNER-SPECIFIC EVENT VOCABULARY (T-123-04-03 / Open-Q4): progress rides the SAME run-buffer
transport (``run:{tuner_run_id}`` stream) but uses a DISTINCT event set
(``tuner_progress`` / ``tuner_provider_done`` / ``tuner_complete``) — chat event types are
NEVER emitted by this router. The run is closed with a single ``done`` / ``error`` TERMINAL
sentinel so the shared SSE consumer breaks cleanly (the ``tuner_*`` events themselves are
non-terminal progress).

RED LINE (D-14): the background task calls ONLY the Plan-03 service functions (which are thin
orchestration over ``forced_emit``) — it NEVER opens the agent loop or a raw provider SDK.
Provider differences stay at the gateway boundary.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time as time_mod
from datetime import datetime, timezone
from uuid import UUID, uuid4

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse
from supabase import Client

from app.api.runs import replay_tail_consumer
from app.config import get_model_capability, get_per_call_timeout, settings
from app.dependencies import get_current_user, get_redis, get_supabase
from app.services import skill_tuner_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skill-tuner"])

# ── Bounds (T-123-04-02 — DoS guard; no unbounded fan-out / cost blow-up) ────────
MAX_CASES = 40          # cap benchmark cases per run (should_fire + should_not combined)
MAX_TARGETS = 8         # cap N provider columns (one representative model per provider)
MAX_ITERATIONS = 5      # cap candidate iterations at <=5 (D-06 / hybrid 60/40/3x/<=5)
DEFAULT_REPEATS = skill_tuner_service.DEFAULT_REPEATS  # 3 repeats per (candidate, target, case)

# Tuner-specific SSE event vocabulary (Open-Q4 — NEVER overload chat event types).
EVENT_PROGRESS = "tuner_progress"
EVENT_PROVIDER_DONE = "tuner_provider_done"
EVENT_COMPLETE = "tuner_complete"

# Terminal sentinel types the SHARED replay_tail_consumer breaks on (threads.TERMINAL_TYPES).
# The tuner_* events above are NON-terminal progress; we close the run with one of these so
# the SSE consumer terminates cleanly. (Imported indirectly — kept local to avoid coupling.)
TERMINAL_DONE = "done"
TERMINAL_ERROR = "error"

# Redis key TTL after a tuner run finalizes (mirrors REDIS-SETUP.md run-buffer discipline).
_TUNER_BUFFER_TTL_S = 600

# In-flight guard: exactly ONE tuner job per skill (no duplicate concurrent runs — T-123-04-02).
# Phase 123 (WR-01): the CORRECTNESS gate is now an ATOMIC Redis ``SET NX`` claim
# (``tuner_inflight:{skill_id}``) so the bound holds (a) across the two near-simultaneous POSTs
# that previously both passed a check-then-add separated by awaits (TOCTOU), and (b) across the
# multi-worker uvicorn default (``WORKER_COUNT=2`` — a per-process set is invisible to the other
# worker). ``_INFLIGHT_SKILLS`` is kept ONLY as a same-process fast-path hint; it is NOT the
# gate. Keyed by skill_id.
_INFLIGHT_SKILLS: set[str] = set()

# TTL on the Redis claim — generously above the longest bounded run so a crashed/killed worker
# that never reaches the ``finally`` cleanup can't wedge a skill forever, yet a real in-flight
# run is never evicted mid-flight. Worst-case bounded run is
# MAX_ITERATIONS×MAX_TARGETS×held-out×DEFAULT_REPEATS provider calls — 1800s clears it.
_INFLIGHT_TTL_S = 1800


def _inflight_key(skill_id: str) -> str:
    return f"tuner_inflight:{skill_id}"


# ── Request body ────────────────────────────────────────────────────────────────
class TunerCase(BaseModel):
    """One (client-held) benchmark case: a user prompt + whether the skill SHOULD fire on it.

    Cases are ephemeral / client-held (A2 / Open-Q5) — NO DB schema change; only the winning
    description persists later via the owner-scoped PATCH (Plan 05).
    """

    prompt: str
    should_fire: bool


class TunerTarget(BaseModel):
    """One benchmark target column (a provider + its representative model)."""

    provider: str
    model: str


class StartTunerRunBody(BaseModel):
    """POST body for a tuning run. All fields optional — defaults derive the configured
    target set + auto-seed cases server-side from the owner-scoped catalog (Plan 03)."""

    cases: list[TunerCase] = Field(default_factory=list)
    targets: list[TunerTarget] = Field(default_factory=list)
    n: int = skill_tuner_service.DEFAULT_CANDIDATE_COUNT


# ── Owner-scoping helper (the SOLE leak gate — V4 / T-123-04-01) ─────────────────
async def _fetch_owned_or_global_skill(supabase: Client, skill_id: str, user_id: str) -> dict:
    """Return the skill row IFF the caller owns it OR it is global; else raise 404.

    ``get_supabase()`` is SERVICE-ROLE — this ``.or_(user_id.eq, is_global.eq.true)`` scoping
    (mirrors skills.py owner-scoping) is the only thing preventing a cross-user leak. 404 (never
    403) on a miss so resource existence is not leaked to other users. Wrapped in
    ``run_in_threadpool`` because supabase-py is blocking (D-v2.5-01).
    """

    def _read():
        return (
            supabase.table("skills")
            .select("id, name, description, user_id, is_global")
            .eq("id", skill_id)
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .limit(1)
            .execute()
        )

    try:
        resp = await run_in_threadpool(_read)
    except Exception:
        # A malformed skill_id (e.g. not a UUID) makes PostgREST raise — treat as a miss (404),
        # never leak the error shape.
        logger.debug("tuner skill ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    rows = list(resp.data or [])
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return rows[0]


# ── Run-buffer emit helpers (tuner-specific vocab on the shared transport) ───────
async def _emit_tuner(redis, run_id: UUID, event_type: str, **fields) -> None:
    """XADD one tuner-specific progress event to ``run:{run_id}`` (Open-Q4 vocab).

    Mirrors threads._emit's canonical single-field ``data`` envelope + MAXLEN cap, but emits
    ONLY tuner_* event types (never a chat event type). Best-effort: a Redis hiccup logs and
    continues (the run keeps computing; the consumer reconciles via the next event)."""
    try:
        await redis.xadd(
            f"run:{run_id}",
            {"data": json.dumps({"type": event_type, **fields})},
            maxlen=10000,
            approximate=True,
        )
    except Exception:
        logger.exception("tuner _emit_tuner XADD failed for run %s (type=%s)", run_id, event_type)


async def _emit_terminal(redis, run_id: UUID, terminal_type: str, **fields) -> None:
    """XADD the single terminal sentinel (``done`` / ``error``) so the shared SSE consumer
    breaks cleanly, then EXPIRE the buffer (run-buffer TTL discipline)."""
    try:
        await redis.xadd(
            f"run:{run_id}",
            {"data": json.dumps({"type": terminal_type, **fields})},
        )
    except Exception:
        logger.exception("tuner terminal sentinel XADD failed for run %s", run_id)
    try:
        await redis.expire(f"run:{run_id}", _TUNER_BUFFER_TTL_S)
    except Exception:
        logger.exception("tuner EXPIRE failed for run %s", run_id)


# ── The bounded background tuning run ────────────────────────────────────────────
async def _run_tuner_job(
    *,
    redis,
    run_id: UUID,
    skill_id: str,
    skill: dict,
    cases: list[dict],
    targets: list[dict],
    n: int,
    user_id: str,
    supabase: Client | None = None,
) -> None:
    """Execute the bounded tuning run and stream tuner_* progress.

    For each candidate × target × case × ``DEFAULT_REPEATS`` repeats, call the Plan-03 service
    (``build_candidates`` once, then ``classify_fires`` per case-repeat), score with the pure
    60/40 held-out math, and emit progress. EVERY provider call is wrapped with the registry
    per-call timeout (T-123-04-02). The whole job is bounded: <= MAX_ITERATIONS candidates,
    <= MAX_TARGETS columns, <= MAX_CASES cases. Closes with a single terminal sentinel.

    Honest-fail floors throughout (the service functions return [] / would_load=False rather
    than crashing); a hard failure emits a terminal ``error`` event, never a silent hang.
    """
    try:
        from app.models.user_settings import load_user_settings  # function-local (Pitfall 4)

        try:
            user_settings = await run_in_threadpool(load_user_settings, user_id)
        except Exception:
            await _emit_terminal(redis, run_id, TERMINAL_ERROR, error="no_user_settings")
            return

        # Phase 123 (CR-01): resolve the builder model from the DB-effective settings,
        # NOT the env-level ``app.config.settings`` singleton. The Settings-UI knob writes
        # to ``app_settings.skill_builder_model`` (surfaced via UserEffectiveSettings); the
        # env object's ``skill_builder_model`` is None for any UI-configured install, so
        # passing ``settings`` here silently fell through to the registry default while the
        # Settings UI DISPLAYED the DB-resolved label (display-vs-run mismatch). ``user_settings``
        # was already loaded above (load_user_settings -> load_app_settings, the DB-backed
        # cache) and carries the resolved ``skill_builder_model``.
        builder_model = skill_tuner_service.resolve_skill_builder_model(user_settings)
        if builder_model is None:
            await _emit_terminal(redis, run_id, TERMINAL_ERROR, error="no_builder_model")
            return

        await _emit_tuner(
            redis, run_id, EVENT_PROGRESS,
            stage="building_candidates", builder_model=builder_model,
        )

        # Candidate generation — ONE forced shot on the builder model, wrapped with the
        # builder's per-call timeout. <= n candidates, then bounded to MAX_ITERATIONS.
        builder_timeout = get_per_call_timeout(builder_model)
        try:
            candidates = await asyncio.wait_for(
                skill_tuner_service.build_candidates(
                    name=skill.get("name", ""),
                    description=skill.get("description", ""),
                    builder_model=builder_model,
                    user_settings=user_settings,
                    n=n,
                ),
                timeout=builder_timeout,
            )
        except (asyncio.TimeoutError, Exception):
            logger.exception("tuner build_candidates failed/timed out for run %s", run_id)
            candidates = []

        # Always include the CURRENT description as a baseline candidate so the run produces a
        # comparison even when the builder honest-fails. Bound the candidate set (<= MAX_ITERATIONS).
        baseline = (skill.get("description") or "").strip()
        all_candidates = ([baseline] if baseline else []) + list(candidates)
        # De-dupe preserving order, then cap at MAX_ITERATIONS.
        seen: set[str] = set()
        bounded_candidates: list[str] = []
        for c in all_candidates:
            if c and c not in seen:
                seen.add(c)
                bounded_candidates.append(c)
            if len(bounded_candidates) >= MAX_ITERATIONS:
                break

        # The classifier catalog line MUST mirror the production firing surface (Pitfall 1):
        # the SAME "- **{name}**: {description}" shape agent_loop.py builds.
        skill_name = skill.get("name", "")

        scored_candidates: list[dict] = []
        for cand_idx, candidate_desc in enumerate(bounded_candidates):
            catalog_lines = f"- **{skill_name}**: {candidate_desc}"
            # Per-provider cells for this candidate (held-out split applied per axis).
            # Phase 123 (WR-02): split PER CLASS so the held-out partition is NOT vacuous on
            # one axis. ``cases`` is built class-sorted ([should_fire...] + [should_not...]),
            # and ``split_held_out`` takes a deterministic head-60% / tail-40% cut with NO
            # shuffle — so the held-out tail skewed ~100% toward should-NOT, making the
            # should-fire (recall) axis empty -> ``_score_axis`` returns a vacuous 1.0 and the
            # winner pick ran on a degenerate signal. Splitting each class independently and
            # concatenating the held-out halves guarantees BOTH rails appear in held-out
            # whenever the source has both classes. ``split_held_out`` itself stays generic.
            _fire = [c for c in cases if c.get("should_fire")]
            _nofire = [c for c in cases if not c.get("should_fire")]
            _, _ho_f = skill_tuner_service.split_held_out(_fire)
            _, _ho_n = skill_tuner_service.split_held_out(_nofire)
            held_out_cases = _ho_f + _ho_n
            per_target_cells: list[dict] = []
            for target in targets:
                provider = target.get("provider", "unknown")
                model = target.get("model") or ""
                # An empty representative model (e.g. openrouter gateway) — skip honestly.
                if not model:
                    continue
                target_timeout = get_per_call_timeout(model)

                fire_decisions: list[bool] = []
                no_false_decisions: list[bool] = []
                # Score on the HELD-OUT cases (winner-by-held-out, never train).
                for case in held_out_cases:
                    prompt = case.get("prompt", "")
                    expected_fire = bool(case.get("should_fire"))
                    repeat_fires: list[bool] = []
                    for _ in range(DEFAULT_REPEATS):
                        try:
                            decision = await asyncio.wait_for(
                                skill_tuner_service.classify_fires(
                                    target_model=model,
                                    catalog_lines=catalog_lines,
                                    user_prompt=prompt,
                                    user_settings=user_settings,
                                ),
                                timeout=target_timeout,
                            )
                            repeat_fires.append(bool(decision.would_load))
                        except (asyncio.TimeoutError, Exception):
                            logger.debug(
                                "tuner classify_fires failed/timed out (run %s, %s); "
                                "treating as did-not-fire",
                                run_id, model, exc_info=True,
                            )
                            repeat_fires.append(False)
                    # Aggregate the repeats: majority-fired -> the case "fired".
                    fired = sum(1 for f in repeat_fires if f) > (DEFAULT_REPEATS / 2)
                    if expected_fire:
                        fire_decisions.append(fired)
                    else:
                        no_false_decisions.append(fired)

                cell = skill_tuner_service.build_cell(
                    provider=provider,
                    model=model,
                    fire_decisions=fire_decisions,
                    no_false_decisions=no_false_decisions,
                )
                per_target_cells.append(cell)
                await _emit_tuner(
                    redis, run_id, EVENT_PROVIDER_DONE,
                    candidate_index=cand_idx, provider=provider, model=model, cell=cell,
                )

            held_out_score = (
                sum(skill_tuner_service.cell_score(c) for c in per_target_cells)
                / len(per_target_cells)
                if per_target_cells else 0.0
            )
            scored_candidates.append({
                "index": cand_idx,
                "description": candidate_desc,
                "cells": per_target_cells,
                "held_out_score": held_out_score,
                "is_baseline": (cand_idx == 0 and baseline == candidate_desc),
            })
            await _emit_tuner(
                redis, run_id, EVENT_PROGRESS,
                stage="candidate_scored", candidate_index=cand_idx,
                held_out_score=held_out_score,
            )

        winner = skill_tuner_service.pick_winner(scored_candidates)
        scoreboard = {
            "skill_id": skill_id,
            "candidates": scored_candidates,
            "winner_index": winner.get("index") if winner else None,
            "winner_description": winner.get("description") if winner else None,
        }
        # Stash the final scoreboard so GET results can return it (run-buffer key — ephemeral).
        try:
            await redis.set(
                f"tuner_result:{run_id}",
                json.dumps(scoreboard),
                ex=_TUNER_BUFFER_TTL_S,
            )
        except Exception:
            logger.exception("tuner result stash failed for run %s", run_id)

        # D-07 durable persistence: upsert the latest scoreboard into ``tuner_runs`` ALONGSIDE
        # the ephemeral Redis stash so it SURVIVES a Redis flush / refresh (BUG-260624-01 HIGH #3).
        # One row per skill — ``on_conflict="skill_id"`` overwrites latest-wins (UNIQUE(skill_id)),
        # never accumulating. supabase-py is BLOCKING, so the call is wrapped in
        # ``run_in_threadpool`` (D-v2.5-01 — a bare blocking call here freezes the event loop), and
        # the whole thing is best-effort try/except so a DB hiccup never crashes the run (the Redis
        # stash still serves the per-run-id GET). ``user_id`` is the originating caller (whoever
        # ran the tuner — the documented global-skill last-runner attribution).
        if supabase is not None:
            try:
                upsert_payload = {
                    "skill_id": skill_id,
                    "user_id": user_id,
                    "run_id": str(run_id),
                    "scoreboard": scoreboard,
                    "builder_model": builder_model,
                    "target_count": len(targets),
                    "case_count": len(cases),
                    # Phase 123.1 (WR-07): a real ISO-8601 timestamptz, NOT the JSON string
                    # ``"now()"`` — PostgREST sends the value literally and Postgres rejects
                    # ``'now()'`` (parens) as ``invalid input syntax for type timestamp with
                    # time zone`` (only the bare literal ``'now'`` is special). The reject was
                    # swallowed by this best-effort try/except, so the D-07 durable persistence
                    # SILENTLY never wrote against real Postgres. Mirrors every other
                    # timestamptz write (agent_loop.py:2405, runs.py:1181).
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

                def _persist_latest():
                    return (
                        supabase.table("tuner_runs")
                        .upsert(upsert_payload, on_conflict="skill_id")
                        .execute()
                    )

                await run_in_threadpool(_persist_latest)
            except Exception:
                logger.exception("tuner durable upsert into tuner_runs failed for run %s", run_id)

        await _emit_tuner(redis, run_id, EVENT_COMPLETE, scoreboard=scoreboard)
        await _emit_terminal(redis, run_id, TERMINAL_DONE)
    except Exception:
        logger.exception("tuner job crashed for run %s", run_id)
        await _emit_terminal(redis, run_id, TERMINAL_ERROR, error="tuner_job_failed")
    finally:
        # Cleanup: release the in-flight guard + the active-run sorted-set entries.
        _INFLIGHT_SKILLS.discard(skill_id)  # same-process fast-path hint
        try:
            # Phase 123 (WR-01): release the cross-worker Redis claim so the NEXT run for
            # this skill can start (the SET NX above is the gate).
            await redis.delete(_inflight_key(skill_id))
            await redis.zrem("runs:active", str(run_id))
            await redis.zrem(f"runs_by_thread:tuner:{skill_id}", str(run_id))
        except Exception:
            logger.exception("tuner job cleanup (DEL/ZREM) failed for run %s", run_id)


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/{skill_id}/tuner/runs", status_code=status.HTTP_202_ACCEPTED)
async def start_tuner_run(
    skill_id: str,
    body: StartTunerRunBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Kick off a BOUNDED background tuning run; return the run id IMMEDIATELY (D-06).

    Owner-verify the skill (404 on cross-user / not-global — T-123-04-01), bound the
    inputs (cases / targets), ZADD the run to the run-buffer, spawn the background job, and
    return without blocking. The author streams progress on the /stream route and reads the
    final scoreboard on the results route.
    """
    skill = await _fetch_owned_or_global_skill(supabase, skill_id, current_user["id"])

    run_id = uuid4()

    # ONE job per skill (T-123-04-02 — no duplicate concurrent runs / fan-out). Phase 123
    # (WR-01): the gate is an ATOMIC Redis ``SET NX`` claim — a single check-and-set with NO
    # intervening await — so two near-simultaneous POSTs can't both pass (the old
    # check-then-add TOCTOU), and the claim is visible across uvicorn workers
    # (``WORKER_COUNT=2`` defeats a per-process set). The losing POST raises the existing 409.
    # NOTE: NEVER swallow this in a broad except — a Redis failure here must surface, not
    # silently disable the DoS bound.
    claimed = await redis.set(
        _inflight_key(skill_id), str(run_id), nx=True, ex=_INFLIGHT_TTL_S
    )
    if not claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tuning run is already in progress for this skill",
        )
    _INFLIGHT_SKILLS.add(skill_id)  # same-process fast-path hint (NOT the gate)

    # From here on the claim is HELD: if anything fails before the background job is spawned
    # (it owns the release in its ``finally``), release the claim so a transient error can't
    # wedge the skill for the full TTL. Once the task is created, ownership transfers to it.
    try:
        # Resolve + BOUND the targets (default to the configured N-column set; cap at MAX_TARGETS).
        if body.targets:
            targets = [{"provider": t.provider, "model": t.model} for t in body.targets]
        else:
            # Phase 123 (CR-01): derive the default target set from the DB-effective settings
            # (provider keys saved through the Settings UI live in app_settings, surfaced via
            # UserEffectiveSettings.providers), NOT the env-level ``settings`` singleton whose
            # flat ``{provider}_api_key`` attrs are empty for UI-configured installs. The
            # duck-typed ``configured_targets`` handles the .providers-list shape.
            from app.models.user_settings import load_app_settings_async  # function-local (Pitfall 4)

            eff = await load_app_settings_async()
            targets = skill_tuner_service.configured_targets(eff)
        targets = targets[:MAX_TARGETS]

        # Phase 123.1 (WR-01): drop empty-model targets so the scored lanes, the rendered
        # cells, the persisted ``target_count``, and the "measured on N models" attribution all
        # AGREE. ``configured_targets`` appends local providers (ollama/lmstudio) when a base_url
        # is set, but ``_REPRESENTATIVE_MODEL`` has no entry for them -> ``model: ""``; the
        # scoring loop then ``if not model: continue`` (no cell). Counting those unscored lanes
        # in ``target_count`` fabricated a number (e.g. a default-Ollama install reported
        # "measured on N models" while only N-1 columns were ever scored). Excluding the unscored
        # lanes is the HONEST fix — local model ids are user-specific, so we do NOT synthesize a
        # fake representative model for them.
        targets = [t for t in targets if (t.get("model") or "").strip()]

        # Resolve + BOUND the cases (default to the owner-scoped auto-seed; cap at MAX_CASES).
        if body.cases:
            cases = [{"prompt": c.prompt, "should_fire": c.should_fire} for c in body.cases]
        else:
            siblings = await run_in_threadpool(
                skill_tuner_service.fetch_owner_scoped_siblings,
                supabase, current_user["id"], skill_id,
            )
            seeded = skill_tuner_service.auto_seed_cases(skill, siblings)
            cases = (
                [{"prompt": p, "should_fire": True} for p in seeded.get("should_fire", [])]
                + [{"prompt": p, "should_fire": False} for p in seeded.get("should_not", [])]
            )
        cases = cases[:MAX_CASES]

        n = max(1, min(int(body.n or skill_tuner_service.DEFAULT_CANDIDATE_COUNT), MAX_ITERATIONS))

        _started_score = time_mod.time()
        # Run-buffer ZADD start (Phase-061+ transport). A tuner run isn't anchored to a chat
        # thread, so the per-skill sorted set carries it (NOT runs_by_thread:{chat_thread}).
        try:
            await redis.zadd(f"runs_by_thread:tuner:{skill_id}", {str(run_id): _started_score})
            await redis.zadd("runs:active", {str(run_id): _started_score})
        except Exception:
            logger.exception("tuner ZADD failed for run %s; continuing", run_id)

        # Spawn the bounded background task (non-blocking — D-06). The in-flight claim was
        # taken atomically (SET NX) above; the job's ``finally`` releases it.
        asyncio.create_task(
            _run_tuner_job(
                redis=redis,
                run_id=run_id,
                skill_id=skill_id,
                skill=skill,
                cases=cases,
                targets=targets,
                n=n,
                user_id=current_user["id"],
                supabase=supabase,  # D-07 durable upsert into tuner_runs
            )
        )
    except Exception:
        # Job never spawned — release the claim NOW (its owner-on-finally never starts) so a
        # transient resolution error doesn't wedge the skill for the full TTL.
        _INFLIGHT_SKILLS.discard(skill_id)
        try:
            await redis.delete(_inflight_key(skill_id))
        except Exception:
            logger.exception("tuner inflight-claim release failed after spawn error (skill %s)", skill_id)
        raise

    return {
        "run_id": str(run_id),
        "skill_id": skill_id,
        "targets": targets,
        "case_count": len(cases),
        "n": n,
    }


@router.get("/{skill_id}/tuner/runs/{run_id}/stream")
async def stream_tuner_run(
    skill_id: str,
    run_id: UUID,
    since: str = "0",
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Stream live tuner_* progress over SSE (reusing the shared replay_tail_consumer).

    Owner-verify the skill first (404 on cross-user — T-123-04-01), then hand the
    ``run:{run_id}`` stream to the shared two-phase replay-then-tail consumer. The tuner_*
    events are progress; the terminal ``done``/``error`` sentinel breaks the consumer."""
    await _fetch_owned_or_global_skill(supabase, skill_id, current_user["id"])

    # Phase 123.1 (CR-01): the skill gate above only proves "you can SEE this skill" — it does
    # NOT bind the CALLER-SUPPLIED ``run_id`` to this skill. The tuner reuses the SAME
    # ``run:{run_id}`` keyspace as chat (threads.py XADDs ``run:{run_id}``; replay_tail_consumer
    # reads it keyed SOLELY on run_id), so owning any visible/global skill + a LEAKED run_id
    # (logs / LangSmith / ``runs:active``) would otherwise read an arbitrary chat/tuner buffer.
    # The start path ZADDs the run into ``runs_by_thread:tuner:{skill_id}`` (the per-skill
    # membership oracle); assert run<->skill membership before touching the buffer. This route
    # is IN-FLIGHT only (the ZADD entry is ZREM'd in the job ``finally``), so the live zscore
    # check suffices here — 404 (never 403 — don't leak existence) on a miss.
    if await redis.zscore(f"runs_by_thread:tuner:{skill_id}", str(run_id)) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tuner run not found",
        )

    return EventSourceResponse(
        replay_tail_consumer(
            redis=redis,
            run_id=run_id,
            since=since,
            settings=settings,
        ),
        ping=None,
    )


@router.get("/{skill_id}/tuner/runs/latest")
async def get_latest_tuner_run(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the DURABLE latest tuner result for a skill (D-07 rehydration-on-open).

    Owner-verify first (404 on cross-user / not-global — T-123.1-01). Then read the single
    ``tuner_runs`` row for this ``skill_id`` (UNIQUE(skill_id) — latest-wins). Unlike the
    per-run-id GET (which reads the ephemeral Redis stash), this survives a Redis flush / a
    page refresh — it is the rehydrate-on-open source for Plan 04.

    A 404 here means NO tuning run has ever completed for this skill (no row yet). The
    ``tuner_runs`` read is wrapped in ``run_in_threadpool`` (supabase-py is blocking — D-v2.5-01).

    REGISTRATION ORDER (load-bearing): this literal-``latest`` route is declared BEFORE the
    ``GET .../runs/{run_id}`` route below so FastAPI matches ``latest`` here first. The
    ``{run_id}`` route types its param as ``UUID``; the string ``"latest"`` fails that converter
    and would 422 rather than fall through if the order were reversed.
    """
    await _fetch_owned_or_global_skill(supabase, skill_id, current_user["id"])

    def _read_latest():
        return (
            supabase.table("tuner_runs")
            .select("skill_id, user_id, run_id, scoreboard, builder_model, target_count, case_count, updated_at")
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
        )

    try:
        resp = await run_in_threadpool(_read_latest)
    except Exception:
        logger.exception("tuner latest read failed for skill %s", skill_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tuner result store unavailable",
        )
    rows = list(resp.data or [])
    if not rows:
        # No completed run for this skill yet — 404 (the wire's getTunerLatest maps this to null).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tuner run for this skill yet",
        )
    row = rows[0]
    return {
        "skill_id": row.get("skill_id"),
        "run_id": row.get("run_id"),
        "scoreboard": row.get("scoreboard"),
        "builder_model": row.get("builder_model"),
        "target_count": row.get("target_count"),
        "case_count": row.get("case_count"),
        "updated_at": row.get("updated_at"),
    }


@router.get("/{skill_id}/tuner/runs/{run_id}")
async def get_tuner_results(
    skill_id: str,
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Return the held-out scoreboard (per-provider cells with BOTH fires/no_false sub-scores)
    + candidate descriptions once the run completes.

    Owner-verify first (404 on cross-user — T-123-04-01). The scoreboard is stashed at
    ``tuner_result:{run_id}`` by the background job (ephemeral, TTL-bound — A2 / no DB schema
    change). A 404 here means the run is still in progress or its buffer expired."""
    await _fetch_owned_or_global_skill(supabase, skill_id, current_user["id"])

    # Phase 123.1 (CR-01): bind the CALLER-SUPPLIED ``run_id`` to this skill BEFORE reading the
    # shared ``tuner_result:{run_id}`` buffer (the skill gate above only proves "you can SEE
    # this skill"; the buffer keyspace is shared with chat). Unlike the in-flight stream route,
    # this is post-completion: the live ``runs_by_thread:tuner:{skill_id}`` membership is ZREM'd
    # in the job ``finally``, so a legitimately-COMPLETED run would 404 on the live check alone.
    # Accept EITHER the live membership OR a durable ``tuner_runs`` row for THIS skill whose
    # ``run_id`` matches — else 404 (never leak existence). The durable read goes through
    # ``run_in_threadpool`` (supabase-py is blocking — D-v2.5-01); the zscore is on the async
    # client (fine in async).
    live_member = await redis.zscore(f"runs_by_thread:tuner:{skill_id}", str(run_id)) is not None
    if not live_member:
        def _read_run_id():
            return (
                supabase.table("tuner_runs")
                .select("run_id")
                .eq("skill_id", skill_id)
                .limit(1)
                .execute()
            )

        try:
            durable = await run_in_threadpool(_read_run_id)
        except Exception:
            logger.exception("tuner run<->skill durable membership read failed for run %s", run_id)
            durable = None
        durable_rows = list((durable.data if durable else None) or [])
        durable_match = bool(durable_rows) and str(durable_rows[0].get("run_id")) == str(run_id)
        if not durable_match:
            # Neither the live per-skill membership nor the durable latest row binds this
            # run_id to this skill — refuse the cross-buffer read (404, not 403).
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tuner run not found",
            )

    try:
        raw = await redis.get(f"tuner_result:{run_id}")
    except Exception:
        logger.exception("tuner result read failed for run %s", run_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tuner result store unavailable",
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tuner run not complete or result expired",
        )
    return json.loads(raw)


@router.get("/{skill_id}/tuner/cases/seeded")
async def get_seeded_cases(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the already-computed seeded benchmark cases WITH provenance (D-05).

    Owner-verify first (404 on cross-user — T-123.1-02). Then fetch the owner-scoped siblings
    (the SOLE false-fire-rail leak gate — ``.or_(user_id.eq, is_global.eq.true)`` inside
    ``fetch_owner_scoped_siblings``) and return the provenance-carrying seed so the editor can
    SHOW + edit the cases before a run (fixes WR-05 / HIGH #2 — the editor previously showed
    "0 cases"). Another user's private skill never reaches the seed.

    Returns ``{should_fire: [{prompt, provenance}], should_not: [{prompt, provenance}]}`` where
    provenance is ``"seeded"`` (this skill's own desc/paraphrase + the generic off-topic set) or
    ``"sibling"`` (an owner-scoped sibling's description) — NEVER ``"held"``.
    """
    skill = await _fetch_owned_or_global_skill(supabase, skill_id, current_user["id"])

    siblings = await run_in_threadpool(
        skill_tuner_service.fetch_owner_scoped_siblings,
        supabase, current_user["id"], skill_id,
    )
    seeded = skill_tuner_service.seed_cases_with_provenance(skill, siblings)
    return {
        "should_fire": seeded.get("should_fire", []),
        "should_not": seeded.get("should_not", []),
    }
