"""Phase 133 Plan 04 (EVAL-02) — the owner-scoped eval-run control surface.

This net-new router (modeled on ``skill_tuner.py`` — it touches NO G-5 hot file) is the
EVAL-02 launch + readout API. It wraps the Plan-03 ``eval_runner_service.run_eval_job``
background engine:

  POST   /skills/{skill_id}/evals/runs        body=StartEvalRunBody -> {run_id} (202)
  GET    /skills/{skill_id}/evals/runs/{run_id}  -> eval_run + eval_results (durable DB readout)
  GET    /skills/{skill_id}/evals/runs           -> list a skill's runs, owner-scoped, newest-first

The two run-lifecycle verbs are REUSED VERBATIM from ``runs.py`` (RESEARCH Pattern 3):
  GET    /runs/{run_id}/stream?since=          live eval_* SSE progress
  DELETE /runs/{run_id}                        cancel

THE ONE-RUN-ID INVARIANT (Pattern 3 — reattach + cancel for free): the single
``run_id`` minted here doubles as ``eval_runs.id`` == the companion ``public.runs.run_id``
== the ``run:{run_id}`` Redis buffer key. Because the POST inserts a companion
``public.runs`` row keyed by that SAME UUID, the EXISTING chat-run machinery
(``getActiveRuns`` / ``subscribeToRun`` / ``GET /runs/{id}/stream`` / ``DELETE /runs/{id}``)
works against an eval run with ZERO new frontend stream code. There is deliberately NO
bespoke ``/stream`` or cancel route in this module.

OWNER-SCOPING IS THE SOLE RUNTIME GATE (T-133-01 / SC#4): ``get_supabase()`` is the
SERVICE-ROLE client (RLS bypassed), so the app-code ``.eq("user_id", current_user["id"])``
on EVERY read/launch is the only thing standing between user A and user B's eval runs. A
cross-user miss returns 404 (never 403 — don't leak existence). ``user_id``/``skill_id``
come from the authenticated caller + the path, NEVER the request body (T-133-03). The
companion ``runs`` row makes ``runs.py``'s own owner-check (run_id + user_id, 404 not 403)
cover the reused stream/cancel verbs (runs.py:394-407 / :1107-1119).

MODEL VALIDATION (D-01 / V5 / T-133-08): the POST validates ``body.model`` against the
``MODEL_CAPABILITIES`` registry (``get_model_capability`` -> ``capability_source ==
"registry"``) and rejects an unknown model — preventing narrate-as-text + bad routing
before any (paid) provider call. ``body.provider`` must agree with the registry provider.

STATE DISCIPLINE (D-PRD-12 / SEED-097): no module-global run state — the in-flight
CORRECTNESS gate is an atomic Redis ``SET NX`` claim (``eval_inflight:{skill_id}``); every
blocking ``supabase-py`` call is wrapped in ``run_in_threadpool`` (D-v2.5-01). The spawned
task is registered in ``threads.RUN_TASKS[run_id]`` so the reused ``DELETE /runs/{id}``
happy-path cancel can ``task.cancel()`` it (cancel parity).
"""
from __future__ import annotations

import asyncio
import logging
import time as time_mod
from datetime import datetime, timezone
from uuid import UUID, uuid4

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from supabase import Client

from app.config import MODEL_CAPABILITIES, get_model_capability
from app.db.runs import insert_run
from app.dependencies import get_current_user, get_pg_pool, get_redis, get_supabase
from app.models.eval_run import (
    ForcePromoteBody,
    PromotionGate,
    ProposeBody,
    ProposeDescriptionBody,
    RateResultBody,
    SkillProposalResponse,
    StartEvalRunBody,
)
from app.services import eval_aggregation, eval_runner_service, skill_proposer_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skill-evals"])

# Phase 137.1 (EVAL-05) — the skill-LESS eval surface (engine smoke sweep + engine-health
# board + the skill-less run readout). These routes are NOT under the ``/skills`` prefix (a
# sweep run has no skill_id — D-02), so they live on their own ``/evals`` router. Registered
# alongside ``router`` in main.py.
router_evals = APIRouter(prefix="/evals", tags=["evals"])

# TTL on the Redis in-flight claim — generously above the longest bounded run so a
# crashed/killed worker that never reaches the job ``finally`` can't wedge a skill forever
# (mirrors skill_tuner._INFLIGHT_TTL_S).
_INFLIGHT_TTL_S = 1800

# CR-03 (135-08) — grace window before a wedged ``approved`` proposal (approve committed
# status='approved' in step 7 but ``_launch_reeval`` never linked a re_eval_run_id) is honestly
# self-healed to ``interrupted`` on read. ~2 min is comfortably beyond a normal approve request, so
# a fresh ``approved`` row whose launch is legitimately in flight is never clobbered.
_APPROVED_STALE_GRACE_S = 120


def _inflight_key(skill_id: str) -> str:
    """The atomic per-skill in-flight claim key (mirror eval_runner_service._inflight_key —
    the job ``finally`` CAS-releases this exact key)."""
    return f"eval_inflight:{skill_id}"


def _approved_is_stale(updated_at) -> bool:
    """True when an ``approved`` proposal's ``updated_at`` is older than ``_APPROVED_STALE_GRACE_S``
    (CR-03 self-heal). Parses the stored ISO ``updated_at`` (may end in ``Z``) against current UTC;
    a missing/unparseable timestamp is treated as stale so a wedged row is never left forever."""
    if not updated_at:
        return True
    try:
        parsed = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - parsed).total_seconds() > _APPROVED_STALE_GRACE_S


async def _verify_owned_skill(supabase: Client, skill_id: str, user_id: str) -> dict:
    """Return the skill row IFF the caller OWNS it; else raise 404.

    The owned-only gate for the LAUNCH path (a user can only eval a skill they own —
    mirrors skill_test_cases._verify_owned_skill, the create-path precedent). ``get_supabase``
    is service-role (RLS bypassed), so this ``.eq("user_id", …)`` is the real gate. 404 (never
    403) on a miss so a cross-user skill's existence is not leaked. Wrapped in
    ``run_in_threadpool`` (supabase-py is blocking — D-v2.5-01)."""

    def _read():
        return (
            supabase.table("skills")
            .select("id, name, description, user_id")
            .eq("id", skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    try:
        resp = await run_in_threadpool(_read)
    except Exception:
        # A malformed skill_id (not a UUID) makes PostgREST raise — treat as a miss (404),
        # never leak the error shape.
        logger.debug("eval skill ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    rows = list(resp.data or [])
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return rows[0]


# ── POST — kick off a bounded eval run, return the run id immediately (D-06) ──────
@router.post("/{skill_id}/evals/runs", status_code=status.HTTP_202_ACCEPTED)
async def start_eval_run(
    skill_id: str,
    body: StartEvalRunBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_pg_pool),
):
    """Launch an eval run (WITH-skill vs WITHOUT-skill over the owner's test cases).

    Owner-verify the skill (404 cross-user — T-133-01), validate the model (D-01 / V5),
    resolve the LATEST owner-scoped ``skill_versions`` snapshot + the owner's test cases
    (reject a run with zero cases — T-133-02), mint one ``run_id``, take the atomic
    ``SET NX`` in-flight claim (409 on contention — one eval per skill), insert the
    ``eval_runs`` row + a companion ``public.runs`` row keyed by the SAME ``run_id``
    (Pattern 3 — reattach/cancel for free), ZADD the active sorted sets, spawn the Plan-03
    background job, and return ``{run_id}`` IMMEDIATELY (non-blocking — D-06)."""
    user_id = current_user["id"]

    # 1. Owner gate FIRST (404 cross-user before anything else is touched — T-133-01).
    await _verify_owned_skill(supabase, skill_id, user_id)

    # 2. Model validation (D-01 / V5 / T-133-08) — only a registry-known model is accepted;
    # an inferred/unknown model is rejected (prevents narrate-as-text + bad routing). The
    # provider must agree with the registry provider for the model.
    cap = get_model_capability(body.model)
    if cap.get("capability_source") != "registry":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model: {body.model}",
        )
    if body.provider and cap.get("provider") != body.provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{body.provider}' does not match model '{body.model}'",
        )

    # 3. Resolve the LATEST owner-scoped skill_version SNAPSHOT (max version_number). The
    # WITH arm is pinned to THIS immutable snapshot (D-03/D-10 traceability), NOT the live
    # skills row. Owner-scoped (.eq user_id) so a consumer of a global skill never reads the
    # author's private version history (T-132-08).
    def _read_latest_version():
        return (
            supabase.table("skill_versions")
            .select("id, name, description, version_number")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )

    version_resp = await run_in_threadpool(_read_latest_version)
    version_rows = list(version_resp.data or [])
    if not version_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No skill version found for this skill",
        )
    skill_version = version_rows[0]

    # 4. Read the owner-scoped test cases (the eval corpus). Reject a run with zero cases —
    # there is nothing to A/B (T-133-02 — no empty fan-out).
    def _read_cases():
        return (
            supabase.table("skill_test_cases")
            .select("id, prompt, expected_behavior, order_index")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("order_index")
            .execute()
        )

    cases_resp = await run_in_threadpool(_read_cases)
    cases = list(cases_resp.data or [])
    if not cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This skill has no test cases to evaluate",
        )

    # 5. Mint the single run_id (== eval_runs.id == companion runs.run_id == run:{id} key).
    run_id = uuid4()

    # 6. ONE eval per skill (T-133-02 — no duplicate concurrent runs / fan-out). The gate is
    # an ATOMIC Redis ``SET NX`` claim — a single check-and-set with NO intervening await — so
    # two near-simultaneous POSTs can't both pass, and the claim is visible across uvicorn
    # workers (WORKER_COUNT=2 defeats a per-process set). The losing POST 409s. NEVER swallow
    # a Redis failure here — it must surface, not silently disable the DoS bound.
    claimed = await redis.set(
        _inflight_key(skill_id), str(run_id), nx=True, ex=_INFLIGHT_TTL_S
    )
    if not claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An eval run is already in progress for this skill",
        )

    # From here the claim is HELD: if anything fails before the background job is spawned (the
    # job owns the release in its ``finally``), release the claim so a transient error can't
    # wedge the skill for the full TTL. Once the task is created, ownership transfers to it.
    try:
        # 7. Create ONE ephemeral eval thread so the companion ``runs`` row has a valid
        # (NOT NULL, FK) thread_id. The Plan-03 job creates its OWN working thread for the
        # agent-loop completions; this thread anchors the companion runs row that powers the
        # reused reattach/cancel verbs.
        eval_thread_id = uuid4()

        def _insert_thread():
            return (
                supabase.table("threads")
                .insert({
                    "id": str(eval_thread_id),
                    "user_id": user_id,
                    "title": "[eval] skill A/B run",
                    "folder_id": None,
                    # BUG-260702-01 / Phase 134.1 (mig 082): this POST-side anchor thread
                    # (it exists only so the companion runs row has a thread_id FK — the
                    # job creates its OWN execution thread) is eval exhaust too. Without
                    # the flag it leaked into the sidebar as the "empty" twin of every run.
                    "is_eval": True,
                })
                .execute()
            )

        await run_in_threadpool(_insert_thread)

        # 8. Insert the durable eval_runs row (status=running). id == run_id; user_id/skill_id
        # from the caller + path (NEVER the body — T-133-03). The Plan-03 job UPDATEs this row
        # to its terminal status (.eq user_id) when it finishes.
        def _insert_eval_run():
            return (
                supabase.table("eval_runs")
                .insert({
                    "id": str(run_id),
                    "skill_id": skill_id,
                    "skill_version_id": skill_version["id"],
                    "user_id": user_id,
                    "provider": body.provider,
                    "model": body.model,
                    "status": "running",
                    "case_count": len(cases),
                })
                .execute()
            )

        await run_in_threadpool(_insert_eval_run)

        # 9. Insert the companion public.runs row keyed by the SAME run_id (Pattern 3). This is
        # what makes ``GET /runs/{id}/stream`` + ``DELETE /runs/{id}`` (runs.py) owner-check
        # and serve an eval run with zero new stream code. asyncpg write (db/runs.py).
        await insert_run(
            pool,
            run_id=run_id,
            thread_id=eval_thread_id,
            user_id=UUID(user_id),
            status="streaming",
            model=body.model,
            provider=body.provider,
        )

        # 10. Run-buffer ZADD start (Phase-061+ transport). An eval run isn't anchored to a
        # chat thread the user reads, so the per-skill sorted set carries it (the Plan-03 job
        # ZREMs both keys in its ``finally``).
        _started_score = time_mod.time()
        try:
            await redis.zadd(f"runs_by_thread:eval:{skill_id}", {str(run_id): _started_score})
            await redis.zadd("runs:active", {str(run_id): _started_score})
        except Exception:
            logger.exception("eval ZADD failed for run %s; continuing", run_id)

        # 10b. Seed the run buffer BEFORE the client can subscribe (BUG-260702-03 (a)).
        # GET /runs/{id}/stream treats a MISSING run:{run_id} key as TTL-expired and
        # synthesizes a terminal error (runs.py Step 3b, 'buffer_expired_while_streaming').
        # The eval job's first XADD (eval_case_started) lands only after 3 DB round-trips,
        # so a fast subscriber raced that window and got a dead stream at open. Chat's
        # POST /messages guarantees the key exists before the client learns the run_id —
        # this restores that invariant for evals. _emit_eval is best-effort (never raises);
        # the frontend demux ignores unknown eval_* types.
        await eval_runner_service._emit_eval(
            redis, run_id, eval_runner_service.EVENT_RUN_STARTED
        )

        # 11. Load the caller's effective settings (the job needs them to route the provider).
        from app.models.user_settings import load_user_settings, override_provider  # function-local (avoid import cycle)

        user_settings = await run_in_threadpool(load_user_settings, user_id)
        # Apply the eval's chosen provider/model as a per-run override onto the
        # effective settings — the gateway dispatch inside run_agent_loop routes on
        # user_settings.active_provider (+ its credentials), NOT ctx.resolved_provider.
        # Without this, a non-default provider's model is sent to the default
        # provider's SDK → 404 (the threads.py:1059-1096 / Phase 075.3 D-075.3-08
        # trap; the chat path applies the same override_provider). body.provider was
        # already validated to match the model's registry provider above (D-01 / V5).
        if body.provider and body.provider != user_settings.active_provider:
            user_settings = override_provider(user_settings, body.provider)
        user_settings = user_settings.model_copy(update={"llm_model": body.model})

        # 12. Spawn the bounded background job (non-blocking — D-06) and register it in
        # threads.RUN_TASKS[run_id] so the reused DELETE /runs/{id} happy-path can task.cancel()
        # it (cancel parity). Function-local import avoids a module-load circular import.
        from app.api.threads import RUN_TASKS  # function-local (avoid circular import)

        task = asyncio.create_task(
            eval_runner_service.run_eval_job(
                run_id=run_id,
                skill_id=skill_id,
                skill_version=skill_version,
                cases=cases,
                provider=body.provider,
                model=body.model,
                current_user=current_user,
                user_settings=user_settings,
                redis=redis,
                supabase=supabase,
                pool=pool,
            )
        )
        RUN_TASKS[run_id] = task
        task.add_done_callback(lambda _t, _r=run_id: RUN_TASKS.pop(_r, None))
    except Exception:
        # The job never spawned — release the claim NOW (its owner-on-finally never starts) so
        # a transient error doesn't wedge the skill for the full TTL. CAS-release so we only
        # ever drop OUR OWN claim (taken with SET NX, value=run_id).
        await eval_runner_service._release_inflight_if_owned(redis, skill_id, run_id)
        raise

    return {
        "run_id": str(run_id),
        "skill_id": skill_id,
        "skill_version_id": str(skill_version["id"]),
        "provider": body.provider,
        "model": body.model,
        "case_count": len(cases),
    }


# ── GET results — the DURABLE DB readout (survives the Redis buffer TTL — SC#3) ───
@router.get("/{skill_id}/evals/runs/{run_id}")
async def get_eval_run(
    skill_id: str,
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the eval_run + its eval_results from the DB (owner-scoped).

    The DURABLE readout: it reads ``eval_runs`` + ``eval_results`` from Postgres, so it stays
    readable AFTER the ephemeral ``run:{run_id}`` Redis buffer TTL-expires (SC#3). Owner-scoped
    on BOTH reads (.eq user_id) — a cross-user run 404s on the eval_runs read (never 403 —
    T-133-01)."""
    user_id = current_user["id"]

    def _read_run():
        return (
            supabase.table("eval_runs")
            .select("*")
            .eq("id", str(run_id))
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    run_resp = await run_in_threadpool(_read_run)
    run_rows = list(run_resp.data or [])
    if not run_rows:
        # 404 (never 403) — don't leak the run's existence to another user.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval run not found")
    eval_run = run_rows[0]

    def _read_results():
        return (
            supabase.table("eval_results")
            .select("*")
            .eq("eval_run_id", str(run_id))
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )

    results_resp = await run_in_threadpool(_read_results)
    results = list(results_resp.data or [])

    # Attach the CALLER's own thumbs rating to each result (EVAL-04 / D-09 readout) so the
    # frontend can render current thumb state. A SECOND owner-scoped read (.eq user_id),
    # additionally BOUND to THIS run's result ids (.in_ eval_result_id) — so the query never
    # over-fetches the caller's lifetime ratings, and (WR-01) can never be truncated
    # server-side by a PostgREST db-max-rows cap into silently dropping this run's ratings
    # (which would report a genuinely-rated answer as rating:null). The rating row is keyed by
    # the globally-unique eval_results.id, so the .in_ bound is exact — no cross-run bleed.
    # Merged in Python onto this run's results; None when the caller hasn't rated that answer.
    # Do NOT change the run/results scoping, and do NOT weaken the .eq(user_id) owner gate.
    result_ids = {r["id"] for r in results}
    if result_ids:
        def _read_ratings():
            return (
                supabase.table("eval_ratings")
                .select("eval_result_id, rating")
                .eq("user_id", user_id)
                .in_("eval_result_id", list(result_ids))
                .execute()
            )

        ratings_resp = await run_in_threadpool(_read_ratings)
        rating_map = {
            row["eval_result_id"]: row["rating"]
            for row in (ratings_resp.data or [])
        }
        for r in results:
            r["rating"] = rating_map.get(r["id"])

    return {"eval_run": eval_run, "eval_results": results}


# ── GET list — a skill's eval runs, owner-scoped, newest-first ───────────────────
@router.get("/{skill_id}/evals/runs")
async def list_eval_runs(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List a skill's eval runs (owner-scoped, newest-first).

    Owner-verify the skill FIRST (404 cross-user — T-133-01) so a non-owner can't even probe a
    skill's existence, then read owner-scoped (.eq user_id) newest-first."""
    user_id = current_user["id"]

    await _verify_owned_skill(supabase, skill_id, user_id)

    def _read():
        return (
            supabase.table("eval_runs")
            .select("*")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

    resp = await run_in_threadpool(_read)
    return resp.data or []


# ── PUT rating — the caller's thumbs on ONE answer (EVAL-04; the FIRST user write here) ──
@router.put("/{skill_id}/evals/results/{result_id}/rating")
async def rate_eval_result(
    skill_id: str,
    result_id: UUID,
    body: RateResultBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Record (or clear) the caller's thumbs up/down on ONE eval_results answer (EVAL-04).

    The FIRST user-initiated write in the eval domain, so the IDOR gate is load-bearing:

      1. OWNER-VERIFY the target ``eval_results`` row on BOTH ``id`` AND ``user_id`` before any
         write. ``get_supabase`` is the SERVICE-ROLE client (RLS bypassed), so this
         ``.eq("user_id", …)`` IS the access control. A cross-user (or unknown) ``result_id``
         returns 404 — NEVER 403 — so another user's result existence is not leaked (T-134-01;
         the ``_verify_owned_skill`` 404-not-403 precedent).
      2. WRITE via the service-role client. ``rating is None`` → DELETE the ``eval_ratings`` row
         for ``(eval_result_id, user_id)`` (clear — D-08 re-ratable). Else reject anything but
         ``"up"``/``"down"`` with 400 (T-134-09; the DB CHECK is the second gate) and UPSERT on
         the ``(eval_result_id, user_id)`` UNIQUE constraint (idempotent toggle — one thumb per
         (user, answer), D-08). ``user_id`` comes from ``current_user``, NEVER the body
         (T-134-03). ``RateResultBody`` carries only ``rating``.

    Every blocking supabase-py call is wrapped in ``run_in_threadpool`` (D-v2.5-01). ``skill_id``
    is the RESTful path anchor; the owner gate is the result-row ownership, matching the minimal
    ``eval_ratings`` row (no skill_id column — D-09)."""
    user_id = current_user["id"]

    # 1. Owner-verify the eval_result (404 cross-user — never 403; T-134-01 IDOR gate).
    def _verify_result():
        return (
            supabase.table("eval_results")
            .select("id")
            .eq("id", str(result_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    try:
        verify_resp = await run_in_threadpool(_verify_result)
    except Exception:
        # A malformed result_id (not a UUID) makes PostgREST raise — treat as a miss (404),
        # never leak the error shape (mirrors _verify_owned_skill).
        logger.debug("eval result ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval result not found")
    if not list(verify_resp.data or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval result not found")

    # 2a. Clear — rating None DELETEs the row (D-08). user_id from the caller (T-134-03).
    if body.rating is None:
        def _clear():
            return (
                supabase.table("eval_ratings")
                .delete()
                .eq("eval_result_id", str(result_id))
                .eq("user_id", user_id)
                .execute()
            )

        await run_in_threadpool(_clear)
        return {"eval_result_id": str(result_id), "rating": None}

    # 2b. Set — reject an invalid value (T-134-09, the DB CHECK is the second gate), then upsert
    # on the UNIQUE (eval_result_id, user_id) constraint so a re-rate TOGGLES the one row.
    if body.rating not in ("up", "down"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rating must be 'up', 'down', or null",
        )

    def _upsert():
        return (
            supabase.table("eval_ratings")
            .upsert(
                {
                    "eval_result_id": str(result_id),
                    "user_id": user_id,
                    "rating": body.rating,
                },
                on_conflict="eval_result_id,user_id",
            )
            .execute()
        )

    await run_in_threadpool(_upsert)
    return {"eval_result_id": str(result_id), "rating": body.rating}


# ═══════════════════════════════════════════════════════════════════════════════════
# Phase 135 (SI-01) — the self-improvement PROPOSAL control surface.
#
# Four routes on this SAME ``/skills`` router (the smaller diff per RESEARCH Alternatives):
#   POST   /skills/{skill_id}/proposals                       -> draft ONE proposal (D-01/D-04)
#   GET    /skills/{skill_id}/proposals                       -> list, owner-scoped, newest-first
#   GET    /skills/{skill_id}/proposals/{proposal_id}         -> one, 404-not-403 (D-07)
#   POST   /skills/{skill_id}/proposals/{proposal_id}/reject  -> pure-audit status flip (D-10)
#
# OWNER-SCOPING IS THE SOLE RUNTIME GATE (T-135-01 / T-135-07): ``get_supabase()`` is the
# SERVICE-ROLE client (RLS bypassed), so the app-code ``.eq("user_id", …)`` on EVERY read/write
# is the only thing standing between user A and user B's proposals. A cross-user miss returns 404
# (never 403 — don't leak existence). ``user_id``/``skill_id`` come from the caller + the path,
# NEVER the request body (T-135-02). The nullable ``gate`` (D-13 honest counts) is None at this
# stage — no re-eval has reconciled yet (Plan 05 populates it; declared on the response model so
# FastAPI does not strip it).
# ═══════════════════════════════════════════════════════════════════════════════════

# The OPEN-proposal statuses (D-04 concurrency — "one open proposal per skill at a time"). A
# ``proposed`` draft the user never acted on is superseded by a new propose; an ``approved`` or
# ``re_evaling`` proposal is genuinely in-flight (a re-eval is imminent or running) and BLOCKS a
# new propose (409) — clobbering it would orphan a running/committed re-eval.
_OPEN_PROPOSAL_STATUSES = ("proposed", "approved", "re_evaling")
_INFLIGHT_PROPOSAL_STATUSES = ("approved", "re_evaling")

# Strong references to the in-process reconcile tasks a re-eval's done-callback spawns, so a
# fire-and-forget ``asyncio.create_task`` is never garbage-collected mid-flight (the sanctioned
# retention pattern — mirrors eval_runner_service._BACKGROUND_TASKS). NOT run state.
_RECONCILE_TASKS: set[asyncio.Task] = set()


async def _read_skill_cases(supabase: Client, skill_id: str, user_id: str) -> list[dict]:
    """Read the owner-scoped test cases for a skill (the re-eval corpus), ordered — the SAME
    read ``start_eval_run`` does. Owner-scoped (``.eq user_id``); threadpool-wrapped (D-v2.5-01)."""

    def _read():
        return (
            supabase.table("skill_test_cases")
            .select("id, prompt, expected_behavior, order_index")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("order_index")
            .execute()
        )

    return list((await run_in_threadpool(_read)).data or [])


async def _read_base_instructions(supabase: Client, version_id: str, user_id: str) -> str:
    """Return one base ``skill_versions.instructions`` body, owner-scoped (T-135-07). Empty
    string when the version is missing (a deleted base version) — honest, never faked."""

    def _read():
        return (
            supabase.table("skill_versions")
            .select("id, instructions")
            .eq("id", str(version_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    return (rows[0].get("instructions") or "") if rows else ""


async def _base_instructions_map(
    supabase: Client, version_ids: list[str], user_id: str
) -> dict[str, str]:
    """Bounded (``.in_``) owner-scoped read of many base versions' instructions for list
    hydration — never over/under-fetches beyond the caller's own referenced version rows
    (T-135-07 / the evals.py:404-421 id-bounded precedent)."""
    ids = [str(v) for v in {vid for vid in version_ids if vid}]
    if not ids:
        return {}

    def _read():
        return (
            supabase.table("skill_versions")
            .select("id, instructions")
            .in_("id", ids)
            .eq("user_id", user_id)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    return {str(r["id"]): (r.get("instructions") or "") for r in rows}


def _proposal_response(row: dict, *, base_instructions: str, gate=None) -> SkillProposalResponse:
    """Assemble the LOCKED ``SkillProposalResponse`` from a stored ``skill_proposals`` row plus the
    hydrated ``base_instructions`` and the D-13 ``gate`` (None until a re-eval reconciles — Plan 05
    computes it; NOT a stored column, so it is always None at this plan's stage)."""
    return SkillProposalResponse(
        id=row["id"],
        skill_id=row["skill_id"],
        base_skill_version_id=row["base_skill_version_id"],
        new_skill_version_id=row.get("new_skill_version_id"),
        re_eval_run_id=row.get("re_eval_run_id"),
        source_eval_run_id=row.get("source_eval_run_id"),
        # CR-01 (139 review): forward the STORED kind (defense-in-depth — the SI-01 reads are
        # kind-scoped to 'instruction', so this is belt-and-suspenders against a kind-blind read
        # ever mislabeling a description row as an instruction proposal again).
        kind=row.get("kind", "instruction") or "instruction",
        proposed_instructions=row.get("proposed_instructions", "") or "",
        base_instructions=base_instructions,
        rationale=row.get("rationale", "") or "",
        evidence_summary=row.get("evidence_summary", "") or "",
        status=row.get("status", "proposed"),
        override_forced=bool(row.get("override_forced", False)),
        gate=gate,
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# ── POST — draft ONE proposal on demand from a source eval run (D-01 / D-04) ──────
@router.post("/{skill_id}/proposals", response_model=SkillProposalResponse)
async def propose_skill_improvement(
    skill_id: str,
    body: ProposeBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Draft ONE improvement from a SOURCE eval run's evidence, on demand (D-01).

    Owner-verify the skill FIRST (404 cross-user — T-135-01), read the SOURCE eval run
    owner-scoped to resolve the evaluated version (the diff BASE), read that base version's
    instructions, guard D-01 (400 if the source run has no results), enforce D-04 (one open
    proposal — supersede a lingering ``proposed`` draft; 409 on an in-flight ``approved``/
    ``re_evaling`` one), assemble the D-02 evidence, force ONE ``SkillProposal`` on the resolved
    builder model (honest 424 if none resolves — never a fabricated proposal), and INSERT a
    ``status='proposed'`` row. Returns the locked ``SkillProposalResponse`` with ``base_instructions``
    set and ``gate=None`` (no re-eval yet). Every supabase-py call is threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner gate FIRST — 404 cross-user before any evidence is touched (T-135-01).
    skill = await _verify_owned_skill(supabase, skill_id, user_id)

    # 2. Read the SOURCE eval run owner-scoped (and scoped to this skill) — its evaluated
    #    ``skill_version_id`` is the diff BASE (``base_skill_version_id``). 404 on a cross-user /
    #    unknown / wrong-skill run (never 403 — T-135-01).
    source_run_id = body.source_eval_run_id

    def _read_source_run():
        return (
            supabase.table("eval_runs")
            .select("id, skill_id, skill_version_id, user_id")
            .eq("id", str(source_run_id))
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    try:
        run_rows = list((await run_in_threadpool(_read_source_run)).data or [])
    except Exception:
        # A malformed source_eval_run_id (not a UUID) makes PostgREST raise — treat as a miss
        # (404), never leak the error shape (mirrors _verify_owned_skill).
        logger.debug("eval source-run read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source eval run not found")
    if not run_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source eval run not found")
    base_skill_version_id = run_rows[0]["skill_version_id"]

    # 3. Read the BASE version's instructions (owner-scoped) — the body being edited + the diff base.
    def _read_base_version():
        return (
            supabase.table("skill_versions")
            .select("id, instructions, name, description")
            .eq("id", str(base_skill_version_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    base_rows = list((await run_in_threadpool(_read_base_version)).data or [])
    if not base_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Base skill version not found for the source run",
        )
    base_version = base_rows[0]
    base_instructions = base_version.get("instructions") or ""

    # 4. D-01 guard: propose is enabled ONLY once the source run has >=1 result — a bounded
    #    (limit 1) owner-scoped existence probe (never over-fetch). No results -> 400.
    def _has_results():
        return (
            supabase.table("eval_results")
            .select("id")
            .eq("eval_run_id", str(source_run_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    if not list((await run_in_threadpool(_has_results)).data or []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The source eval run has no results to propose from",
        )

    # 5. D-04 concurrency — one OPEN proposal per skill. Read the open set owner-scoped: BLOCK
    #    (409) on an in-flight ``approved``/``re_evaling`` proposal (a re-eval is committed/running
    #    — a new draft must not clobber it); SUPERSEDE any lingering ``proposed`` draft to
    #    ``rejected`` (the user never acted on it). This is the documented supersede-proposed +
    #    block-on-in-flight policy.
    def _read_open():
        return (
            supabase.table("skill_proposals")
            .select("id, status")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            # CR-01 (139 review): kind-scope the open set — a pending DESCRIPTION proposal
            # (SI-02) must never be superseded by drafting an INSTRUCTION proposal.
            .eq("kind", "instruction")
            .in_("status", list(_OPEN_PROPOSAL_STATUSES))
            .execute()
        )

    open_rows = list((await run_in_threadpool(_read_open)).data or [])
    if any(r.get("status") in _INFLIGHT_PROPOSAL_STATUSES for r in open_rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A proposal for this skill is already approved or re-evaluating",
        )
    superseded_ids = [r["id"] for r in open_rows if r.get("status") == "proposed"]
    if superseded_ids:
        def _supersede():
            return (
                supabase.table("skill_proposals")
                .update({"status": "rejected"})
                .in_("id", superseded_ids)
                .eq("user_id", user_id)
                .eq("kind", "instruction")  # CR-01: mirror the kind-scoped read
                .execute()
            )

        await run_in_threadpool(_supersede)

    # 6. Assemble the D-02 evidence bundle (owner-scoped, disagreement-first) and force ONE
    #    proposal on the resolved builder model. Load the caller's settings for provider routing.
    from app.models.user_settings import load_user_settings  # function-local (Pitfall 4)

    user_settings = await run_in_threadpool(load_user_settings, user_id)
    evidence = await skill_proposer_service.assemble_evidence(
        supabase,
        skill_id=skill_id,
        source_run_id=source_run_id,
        user_id=user_id,
        current_instructions=base_instructions,
    )
    proposal = await skill_proposer_service.propose(
        skill=skill,
        base_version=base_version,
        source_run_id=source_run_id,
        evidence=evidence,
        user_settings=user_settings,
    )
    if proposal is None:
        # Honest floor (D-03): no builder model resolved -> a real dependency failure, never a
        # fabricated proposal. 424 Failed Dependency carries the honest detail.
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="No skill-builder model resolved — cannot draft a proposal",
        )

    # 7. Service-role INSERT the durable ``proposed`` row. id is minted app-side (mirrors
    #    start_eval_run's run_id); user_id/skill_id from the caller + path (NEVER the body —
    #    T-135-02). new_skill_version_id / re_eval_run_id stay NULL until Plan 05 approves.
    proposal_id = uuid4()
    insert_payload = {
        "id": str(proposal_id),
        "skill_id": skill_id,
        "base_skill_version_id": base_skill_version_id,
        "source_eval_run_id": str(source_run_id),
        "user_id": user_id,
        # CR-01 (139 review): explicit kind (matches the DB DEFAULT from migration 090) so the
        # kind-scoped SI-01 reads always see rows this route inserts.
        "kind": "instruction",
        "proposed_instructions": proposal.proposed_instructions,
        "rationale": proposal.rationale,
        "evidence_summary": proposal.evidence_cited,
        "status": "proposed",
    }

    def _insert():
        return supabase.table("skill_proposals").insert(insert_payload).execute()

    insert_resp = await run_in_threadpool(_insert)
    inserted = (list(insert_resp.data or []) or [{}])[0]
    # Overlay the app-known payload with the DB echo (id/created_at/updated_at/override_forced
    # defaults) so the response carries the DB-authoritative values in production; the payload is
    # the floor when a non-echoing test fake returns only what was sent.
    row = {**insert_payload, **inserted}
    return _proposal_response(row, base_instructions=base_instructions, gate=None)


# ── GET list — a skill's proposals, owner-scoped, newest-first ────────────────────
@router.get("/{skill_id}/proposals", response_model=list[SkillProposalResponse])
async def list_skill_proposals(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """List a skill's proposals (owner-scoped, newest-first).

    Owner-verify the skill FIRST (404 cross-user — T-135-01) so a non-owner can't probe a skill's
    existence, then read owner-scoped (``.eq user_id``) newest-first and hydrate each row's
    ``base_instructions`` from its base version (id-bounded owner-scoped read — T-135-07). Plan 05
    self-heals: any ``re_evaling`` proposal is reconciled first (a terminal/orphaned re-eval
    finalizes — D-14), and every proposal with a completed re-eval carries the D-13 honest ``gate``
    counts (recompute-on-read so ``promoted`` AND ``not_promoted`` always display them)."""
    user_id = current_user["id"]

    await _verify_owned_skill(supabase, skill_id, user_id)

    def _read():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            # CR-01 (139 review): kind-scope — description proposals (SI-02) must never leak
            # into the SI-01 surface mislabeled as instruction proposals.
            .eq("kind", "instruction")
            .order("created_at", desc=True)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    # Self-heal any 're_evaling' proposal (terminal/orphaned re-eval finalizes here — D-14) before
    # the base-instructions batch read, so the returned rows reflect the true terminal state.
    for i, r in enumerate(rows):
        # CR-03: reconcile ``approved`` rows too, so a wedged ``approved`` proposal (launch never
        # linked a run) self-heals to ``interrupted`` on read (not only ``re_evaling`` rows).
        if r.get("status") in ("re_evaling", "approved"):
            reconciled = await reconcile_proposal(
                supabase, redis, proposal_id=r.get("id"), user_id=user_id
            )
            if reconciled is not None:
                rows[i] = reconciled

    base_map = await _base_instructions_map(
        supabase, [r.get("base_skill_version_id") for r in rows], user_id
    )
    out = []
    for r in rows:
        # Attach the D-13 counts for any proposal with a completed re-eval (None otherwise — honest).
        gate = await _compute_gate(
            supabase,
            source_eval_run_id=r.get("source_eval_run_id"),
            re_eval_run_id=r.get("re_eval_run_id"),
            user_id=user_id,
        )
        out.append(
            _proposal_response(
                r,
                base_instructions=base_map.get(str(r.get("base_skill_version_id")), ""),
                gate=gate,
            )
        )
    return out


# ── GET one — a single proposal, owner-scoped, 404-not-403 ───────────────────────
@router.get("/{skill_id}/proposals/{proposal_id}", response_model=SkillProposalResponse)
async def get_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Return ONE proposal (owner-scoped).

    Owner-verify the proposal row on ``id`` AND ``user_id`` AND ``skill_id``; 404 (NEVER 403) on a
    cross-user / unknown miss so existence isn't leaked (T-135-01). Hydrate ``base_instructions``
    from the base version (owner-scoped). Plan 05 self-heals: a ``re_evaling`` proposal is reconciled
    first (a terminal/orphaned re-eval finalizes — D-14 — so the state never sticks after a backend
    restart lost the in-process task), and a proposal with a completed re-eval carries the D-13 honest
    ``gate`` counts (recompute-on-read — ``promoted`` AND ``not_promoted`` always display them)."""
    user_id = current_user["id"]

    def _read():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            # CR-01 (139 review): kind-gate — a description proposal is indistinguishable from
            # absent through the SI-01 route (mirrors the description routes' T-139-10 guard).
            .eq("kind", "instruction")
            .limit(1)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    row = rows[0]
    # CR-03: reconcile ``approved`` rows too, so a wedged ``approved`` proposal (launch never linked
    # a run) self-heals to ``interrupted`` on read (not only ``re_evaling`` rows).
    if row.get("status") in ("re_evaling", "approved"):
        reconciled = await reconcile_proposal(
            supabase, redis, proposal_id=proposal_id, user_id=user_id
        )
        if reconciled is not None:
            row = reconciled
    gate = await _compute_gate(
        supabase,
        source_eval_run_id=row.get("source_eval_run_id"),
        re_eval_run_id=row.get("re_eval_run_id"),
        user_id=user_id,
    )
    base_instructions = await _read_base_instructions(
        supabase, row.get("base_skill_version_id"), user_id
    )
    return _proposal_response(row, base_instructions=base_instructions, gate=gate)


# ── POST reject — a pure-audit status flip (NO version / skills write — D-10) ─────
@router.post("/{skill_id}/proposals/{proposal_id}/reject", response_model=SkillProposalResponse)
async def reject_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Reject a proposal — a PURE AUDIT status flip (D-10).

    Copies ``rate_eval_result``'s IDOR gate (evals.py:485-504): owner-verify the proposal row on
    ``id`` AND ``user_id`` BEFORE the write; 404 (NEVER 403) on a cross-user / unknown miss. Then a
    SINGLE ``.update({"status": "rejected"})`` — NO ``skill_versions`` INSERT, NO ``skills`` write
    (rejection keeps its audit trail here with ``new_skill_version_id`` NULL; re-drafting is a fresh
    propose — D-10). Every call is threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner-verify the proposal row (404 cross-user — never 403; T-135-01 IDOR gate).
    #    CR-01 (139 review): also kind-gated — a pending DESCRIPTION proposal (SI-02) can never be
    #    flipped through this INSTRUCTION route (mirrors the description reject's T-139-10 guard).
    def _verify():
        return (
            supabase.table("skill_proposals")
            .select("id, base_skill_version_id")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .eq("kind", "instruction")
            .limit(1)
            .execute()
        )

    try:
        verify_rows = list((await run_in_threadpool(_verify)).data or [])
    except Exception:
        logger.debug("proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not verify_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    # 2. Pure-audit flip — ONE update, owner-scoped. No version row, no skills write (D-10).
    def _reject():
        return (
            supabase.table("skill_proposals")
            .update({"status": "rejected"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("kind", "instruction")  # CR-01: mirror the kind-gated verify
            .execute()
        )

    updated_rows = list((await run_in_threadpool(_reject)).data or [])
    row = updated_rows[0] if updated_rows else {**verify_rows[0], "status": "rejected"}
    base_instructions = await _read_base_instructions(
        supabase, row.get("base_skill_version_id"), user_id
    )
    return _proposal_response(row, base_instructions=base_instructions, gate=None)


# ═══════════════════════════════════════════════════════════════════════════════════
# Phase 139 Plan 02 (SI-02) — the DESCRIPTION-proposal lifecycle (D-11 — ONE table, kind-gated).
#
#   POST /skills/{skill_id}/description-proposals                     -> propose (kind='description')
#   GET  /skills/{skill_id}/description-proposals                     -> list (rehydration-on-open)
#   POST /skills/{skill_id}/description-proposals/{proposal_id}/reject  -> pure-audit flip (kind-gated)
#   POST /skills/{skill_id}/description-proposals/{proposal_id}/approve -> synchronous live-write + version
#
# The proposer IS the Trigger Tuner (D-01): the winner is a MEASURED, held-out per-provider result
# READ from the durable ``tuner_runs`` scoreboard — never a new proposer LLM call. These routes mirror
# the SI-01 lifecycle above, DROPPING the async re-eval arm (D-07): a description proposal moves
# ``proposed -> rejected | promoted`` only. Approve WRITES the live ``skills.description`` and lets the
# 079/132 ``capture_skill_version`` trigger version it (no draft INSERT, no re-eval, no SSE). The
# displayed evidence is SNAPSHOTTED inline at propose-time (RESEARCH Pitfall 1 — ``tuner_runs`` is a
# latest-wins singleton, so a bare FK would mutate a pending proposal's scoreboard out from under it).
#
# OWNER-SCOPING IS THE SOLE RUNTIME GATE (T-139-04/05/06): ``get_supabase()`` is SERVICE-ROLE (RLS
# bypassed), so the app-code ``.eq("user_id", …)`` on EVERY read/write is the only gate. A cross-user
# miss returns 404 (never 403). ``user_id`` comes from the auth caller and ``skill_id`` from the path,
# NEVER the request body (the body carries only ``run_id`` — T-135-02). The whole lifecycle is
# OWNER-ONLY (not owner-or-global): approve writes ``skills.description WHERE id AND user_id``, so a
# proposal on a non-owned skill could never be applied — ``_verify_owned_skill`` gates propose/approve
# to exactly the skills the caller can also approve. Every supabase-py call is threadpool-wrapped
# (D-v2.5-01) — NEVER the bare skills.py:404 pattern (RESEARCH Pitfall 5). ``threads.py`` / the agent
# loop are untouched (D-13 red line).
# ═══════════════════════════════════════════════════════════════════════════════════


async def _read_base_description(supabase: Client, version_id, user_id: str) -> str:
    """Return one base ``skill_versions.description`` body, owner-scoped (T-139-04). Empty string
    when the version is missing (a deleted base version) — honest, never faked. This is the diff
    base a description proposal renders ``proposed_description`` against."""

    def _read():
        return (
            supabase.table("skill_versions")
            .select("id, description")
            .eq("id", str(version_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    return (rows[0].get("description") or "") if rows else ""


def _description_proposal_response(row: dict, *, base_description: str) -> SkillProposalResponse:
    """Assemble a ``kind='description'`` ``SkillProposalResponse`` (SI-02) from a stored
    ``skill_proposals`` row. Mirrors ``_proposal_response`` but hydrates ``base_description`` (the diff
    base) instead of ``base_instructions``, carries the inline ``scoreboard_snapshot`` evidence +
    provenance ``source_tuner_run_id``, and leaves the instruction / re-eval / gate fields at their
    honest defaults (a description proposal never enters the re-eval arm — D-07)."""
    return SkillProposalResponse(
        id=row["id"],
        skill_id=row["skill_id"],
        base_skill_version_id=row["base_skill_version_id"],
        new_skill_version_id=row.get("new_skill_version_id"),
        source_eval_run_id=row.get("source_eval_run_id"),
        source_tuner_run_id=row.get("source_tuner_run_id"),
        kind=row.get("kind", "description") or "description",
        proposed_description=row.get("proposed_description"),
        base_description=base_description,
        scoreboard_snapshot=row.get("scoreboard_snapshot"),
        proposed_instructions=row.get("proposed_instructions") or "",
        base_instructions="",
        rationale=row.get("rationale") or "",
        evidence_summary=row.get("evidence_summary") or "",
        status=row.get("status", "proposed"),
        override_forced=bool(row.get("override_forced", False)),
        gate=None,
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# ── POST — draft ONE description proposal from a completed Tuner run's held-out winner (D-01) ──
@router.post(
    "/{skill_id}/description-proposals",
    response_model=SkillProposalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def propose_description_improvement(
    skill_id: str,
    body: ProposeDescriptionBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Draft ONE DESCRIPTION proposal from a completed Trigger Tuner run's held-out winner (D-01).

    Owner-verify the skill FIRST (404 cross-user — T-139-04), resolve the diff base (the skill's
    current live description + its latest ``skill_versions`` id), read the DURABLE ``tuner_runs`` row
    (409 if the tuner has re-run since — the observed ``run_id`` is stale), gate honest-by-construction
    (400 if the held-out winner IS the baseline — D-02 — never a fabricated diff), supersede any
    lingering ``proposed`` description draft (D-04, kind-scoped), SNAPSHOT the winner + the proposed-vs-
    current scoreboard INLINE (RESEARCH Pitfall 1), and service-role INSERT a ``kind='description'``
    ``status='proposed'`` row. The proposal IS the Tuner's winner — no new proposer LLM call. Returns
    the locked ``SkillProposalResponse`` with ``base_description`` set. The live skill is NEVER written
    on propose. Every supabase-py call is threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner gate FIRST — 404 cross-user before any evidence is touched (T-139-04). Owner-only:
    #    the lifecycle writes ``skills.description WHERE id AND user_id`` on approve, so a proposal on a
    #    non-owned skill could never be applied — gate propose to exactly what the caller can approve.
    skill = await _verify_owned_skill(supabase, skill_id, user_id)
    base_description = skill.get("description") or ""

    # 2. Resolve the diff BASE version id — the skill's latest ``skill_versions`` row (every
    #    description save versions via the 079 trigger, so latest == the current live description —
    #    RESEARCH Pitfall 3). Owner-scoped; NOT NULL is always resolvable.
    def _read_latest_version():
        return (
            supabase.table("skill_versions")
            .select("id, version_number, description")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )

    ver_rows = list((await run_in_threadpool(_read_latest_version)).data or [])
    if not ver_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No base skill version found for this skill",
        )
    base_skill_version_id = ver_rows[0]["id"]

    # 3. Read the DURABLE ``tuner_runs`` row for this skill (UNIQUE(skill_id) — latest-wins). 404 if
    #    no run has completed; 409 if the tuner has re-run since the observed ``run_id`` (the evidence
    #    the client saw is stale — force a re-review of the latest result).
    def _read_latest_tuner():
        return (
            supabase.table("tuner_runs")
            .select("id, run_id, scoreboard")
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
        )

    try:
        tuner_rows = list((await run_in_threadpool(_read_latest_tuner)).data or [])
    except Exception:
        logger.debug("tuner-run read raised; treating as 404", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No tuner run for this skill yet"
        )
    if not tuner_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No tuner run for this skill yet"
        )
    tuner_run = tuner_rows[0]
    if str(tuner_run.get("run_id")) != str(body.run_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The tuner has re-run since — review the latest result",
        )

    # 4. Honest-by-construction gate (D-02): resolve the winner candidate from the scoreboard. If the
    #    winner is None (nothing measured) OR IS the baseline, there is nothing to propose — 400.
    scoreboard = tuner_run.get("scoreboard") or {}
    candidates = scoreboard.get("candidates") or []
    winner_index = scoreboard.get("winner_index")
    winner = next((c for c in candidates if c.get("index") == winner_index), None)
    if winner is None or winner.get("is_baseline"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nothing to propose — the current description already wins",
        )
    winner_description = winner.get("description") or scoreboard.get("winner_description")
    # WR-06 (139 review): a malformed / legacy scoreboard can leave the winner with NO description.
    # Refuse honestly (400) instead of letting the INSERT hit the skill_proposals_kind_fields CHECK
    # (an unguarded PostgREST raise → an opaque 500).
    if not winner_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The tuner winner has no description to propose",
        )
    baseline_candidate = next((c for c in candidates if c.get("is_baseline")), None)

    # 5. Concurrency guard, kind-scoped (D-04): supersede any lingering ``proposed`` DESCRIPTION draft
    #    to ``rejected`` (the user never acted on it). Approve is synchronous — no async in-flight
    #    state exists for description, so the open set is effectively just ``('proposed',)`` and there
    #    is no 409 block (RESEARCH Runtime State Inventory).
    def _read_open_desc():
        return (
            supabase.table("skill_proposals")
            .select("id, status")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .eq("kind", "description")
            .in_("status", ["proposed"])
            .execute()
        )

    open_rows = list((await run_in_threadpool(_read_open_desc)).data or [])
    superseded_ids = [r["id"] for r in open_rows if r.get("status") == "proposed"]
    if superseded_ids:
        def _supersede():
            return (
                supabase.table("skill_proposals")
                .update({"status": "rejected"})
                .in_("id", superseded_ids)
                .eq("user_id", user_id)
                .eq("kind", "description")
                .execute()
            )

        await run_in_threadpool(_supersede)

    # 6. Snapshot the evidence INLINE with the LITERAL top-level keys {winner, baseline, run_id}
    #    (RESEARCH Code Example :377-381 — the exact shape 139-04's DescriptionScoreboardSnapshot
    #    declares; NOT a candidates/winner_index blob) and service-role INSERT the row. id minted
    #    app-side; user_id/skill_id from the caller + path, NEVER the body (T-135-02).
    scoreboard_snapshot = {
        "winner": winner,
        "baseline": baseline_candidate,
        "run_id": tuner_run.get("run_id"),
    }
    proposal_id = uuid4()
    insert_payload = {
        "id": str(proposal_id),
        "skill_id": skill_id,
        "base_skill_version_id": base_skill_version_id,
        "user_id": user_id,
        "kind": "description",
        "proposed_description": winner_description,
        "proposed_instructions": None,
        "scoreboard_snapshot": scoreboard_snapshot,
        "source_tuner_run_id": tuner_run.get("id"),
        "source_eval_run_id": None,
        "status": "proposed",
    }

    def _insert():
        return supabase.table("skill_proposals").insert(insert_payload).execute()

    insert_resp = await run_in_threadpool(_insert)
    inserted = (list(insert_resp.data or []) or [{}])[0]
    row = {**insert_payload, **inserted}
    return _description_proposal_response(row, base_description=base_description)


# ── GET list — a skill's DESCRIPTION proposals, owner-scoped, newest-first (rehydration) ──
@router.get(
    "/{skill_id}/description-proposals", response_model=list[SkillProposalResponse]
)
async def list_description_proposals(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List a skill's DESCRIPTION proposals (owner-scoped, newest-first) for rehydration-on-open.

    Owner-verify the skill FIRST (404 cross-user — T-139-04), then read owner-scoped + kind-scoped
    (``.eq kind='description'``) newest-first and hydrate each row's ``base_description`` from its base
    version. Returns the stored rows with their snapshotted evidence — no re-eval self-heal (D-07)."""
    user_id = current_user["id"]

    await _verify_owned_skill(supabase, skill_id, user_id)

    def _read():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .eq("kind", "description")
            .order("created_at", desc=True)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    out = []
    base_cache: dict = {}
    for r in rows:
        bvid = r.get("base_skill_version_id")
        if bvid not in base_cache:
            base_cache[bvid] = await _read_base_description(supabase, bvid, user_id)
        out.append(_description_proposal_response(r, base_description=base_cache[bvid]))
    return out


# ── POST reject — a pure-audit status flip, KIND-GATED to description rows (D-05 / T-139-10) ──
@router.post(
    "/{skill_id}/description-proposals/{proposal_id}/reject",
    response_model=SkillProposalResponse,
)
async def reject_description_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Reject a DESCRIPTION proposal — a PURE AUDIT status flip (D-05).

    Owner-verify the proposal row on ``id`` AND ``user_id`` AND ``skill_id`` AND ``kind='description'``
    BEFORE the write; 404 (NEVER 403) on a cross-user / unknown / WRONG-KIND miss (T-139-04 IDOR +
    T-139-10 kind guard — an ``instruction`` proposal can never be flipped through this route). Then a
    SINGLE ``.update({"status": "rejected"})`` — NO ``skill_versions`` INSERT, NO ``skills`` write
    (``new_skill_version_id`` stays NULL; re-drafting is a fresh propose — D-05). Every call is
    threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    def _verify():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .eq("kind", "description")
            .limit(1)
            .execute()
        )

    try:
        verify_rows = list((await run_in_threadpool(_verify)).data or [])
    except Exception:
        logger.debug("description-proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not verify_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    def _reject():
        return (
            supabase.table("skill_proposals")
            .update({"status": "rejected"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("kind", "description")
            .execute()
        )

    updated_rows = list((await run_in_threadpool(_reject)).data or [])
    row = updated_rows[0] if updated_rows else {**verify_rows[0], "status": "rejected"}
    base_description = await _read_base_description(
        supabase, row.get("base_skill_version_id"), user_id
    )
    return _description_proposal_response(row, base_description=base_description)


# ── POST approve — synchronous live-write + trigger-versioned promote (drops the async arm) ──
@router.post(
    "/{skill_id}/description-proposals/{proposal_id}/approve",
    response_model=SkillProposalResponse,
)
async def approve_description_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Approve a DESCRIPTION proposal: write the LIVE description ONCE, let the 079/132 trigger
    version it, and promote — NO draft INSERT, NO re-eval, NO SSE (D-04/D-07 — the winner was
    already gated at draft-time by the held-out score).

    Owner-verify the skill (404 cross-user) + read the proposal on ``id`` AND ``user_id`` AND
    ``skill_id`` (404 not 403 — T-139-04); guard ``kind == 'description'`` (409 if an instruction
    proposal is sent here) and ``status == 'proposed'`` (409 otherwise). Then: (1) ``UPDATE skills SET
    description = proposed_description WHERE id AND user_id`` — WRAPPED in ``run_in_threadpool`` (NEVER
    the bare skills.py:404 call — RESEARCH Pitfall 5) — which fires ``capture_skill_version`` (INSERTs
    ONE immutable ``skill_versions`` row, source='manual'); (2) read back MAX(version_number) for
    ``new_skill_version_id`` (do NOT also INSERT — double-capture, Pitfall 2); (3) link it + flip
    ``status='promoted'``. The promoted ``kind='description'`` proposal row (with ``source_tuner_run_id``)
    is the self-improve audit anchor (RESEARCH Discretion #2). Returns the promoted proposal (NO
    ``re_eval_run_id``). Every supabase-py call is threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner-verify the skill (404 cross-user) + read the proposal (id AND user_id AND skill_id).
    #    The returned row carries the LIVE description — the WR-02 staleness guard reads it below.
    skill = await _verify_owned_skill(supabase, skill_id, user_id)

    def _read_proposal():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
        )

    try:
        prop_rows = list((await run_in_threadpool(_read_proposal)).data or [])
    except Exception:
        logger.debug("description-proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not prop_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    proposal = prop_rows[0]

    # 2. Kind + state guards. Kind-gate so an instruction proposal can never be promoted through the
    #    description route (409); only a ``proposed`` draft can be approved (409 otherwise — T-139-04).
    if proposal.get("kind") != "description":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not a description proposal",
        )
    if proposal.get("status") != "proposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proposal is not proposable (status={proposal.get('status')})",
        )
    proposed_description = proposal.get("proposed_description")
    if not proposed_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal has no proposed description",
        )

    # WR-02 (139 review): staleness + no-op guards between propose-time and approve-time.
    # (a) Hydrate the STORED diff base (immutable version row) and compare it to the LIVE
    #     description: a manual edit since propose means the reviewed diff is NOT the change that
    #     would actually land — 409 (mirror the propose route's stale-run 409), never a blind
    #     last-write-wins clobber of the newer edit.
    live_description = skill.get("description") or ""
    base_description = await _read_base_description(
        supabase, proposal.get("base_skill_version_id"), user_id
    )
    if live_description != base_description:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The live description has changed since this was proposed — re-run the tuner and propose again",
        )
    # (b) No-op guard: if the live description ALREADY equals the proposal, the 079/132 trigger
    #     would NOT fire (it captures only IS DISTINCT FROM changes), so _read_max_version would
    #     link a version this approval never created — the audit anchor would point at the wrong
    #     artifact. Refuse honestly instead of fabricating a version link.
    if live_description == proposed_description:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The live description already matches this proposal — nothing to apply",
        )

    # 3. Write the LIVE description ONCE (fires the 079/132 capture_skill_version trigger →
    #    source='manual'). WRAP in run_in_threadpool — do NOT copy skills.py:404's bare blocking call
    #    (D-v2.5-01 / Pitfall 5). No matching owned skill → 404.
    def _apply_description():
        return (
            supabase.table("skills")
            .update({"description": proposed_description})
            .eq("id", skill_id)
            .eq("user_id", user_id)
            .execute()
        )

    apply_rows = list((await run_in_threadpool(_apply_description)).data or [])
    if not apply_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    # 4. Read back the just-created immutable version (MAX(version_number)) — mirror _read_max_version.
    #    Do NOT INSERT a version (the trigger already did — double-capture, Pitfall 2).
    def _read_max_version():
        return (
            supabase.table("skill_versions")
            .select("id, version_number")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )

    max_rows = list((await run_in_threadpool(_read_max_version)).data or [])
    new_skill_version_id = max_rows[0].get("id") if max_rows else None

    # 5. Promote the proposal — link the captured version + flip to ``promoted`` (owner-scoped). No
    #    re_evaling / interrupted / not_promoted transition (D-07).
    def _promote():
        return (
            supabase.table("skill_proposals")
            .update({"new_skill_version_id": new_skill_version_id, "status": "promoted"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    promoted_rows = list((await run_in_threadpool(_promote)).data or [])
    row = (
        promoted_rows[0]
        if promoted_rows
        else {**proposal, "new_skill_version_id": new_skill_version_id, "status": "promoted"}
    )
    # base_description was hydrated for the WR-02 staleness guard above — the base version row is
    # immutable, so it is still the honest diff base here (no second read needed).
    return _description_proposal_response(row, base_description=base_description)


# ═══════════════════════════════════════════════════════════════════════════════════
# Phase 135 Plan 05 (SI-01) — approval + auto re-eval + the honest promotion gate.
#
#   POST /skills/{skill_id}/proposals/{proposal_id}/approve        -> {proposal, re_eval_run_id}
#   POST /skills/{skill_id}/proposals/{proposal_id}/rerun          -> {proposal, re_eval_run_id} (D-14)
#   POST /skills/{skill_id}/proposals/{proposal_id}/force-promote  -> SkillProposalResponse (D-06)
#
# Approve INSERTs an immutable ``skill_versions(source='self_improve')`` draft WITHOUT touching the
# live skill (D-05), then launches a both-arms re-eval REUSING the ``start_eval_run`` companion
# machinery + ``run_eval_job`` on the SOURCE run's provider/model (D-11/D-12) with the Plan-02
# ``skill_instructions_override`` seam so the WITH arm measures the DRAFT (Pitfall #1). When the
# re-eval terminates, ``promotion_gate()`` (D-13, case-matched no-regression + improvement) decides:
# PASS -> promote (the SINGLE ``skills.instructions`` UPDATE, accepting the 079 trigger's benign
# ``manual`` dup version per Pitfall #2) + status='promoted'; FAIL -> status='not_promoted' with the
# honest counts (force-promotable, D-06); orphaned/stale -> status='interrupted' + rerun (D-14). The
# D-13 honest counts are RECOMPUTED-ON-READ onto the locked ``SkillProposalResponse.gate`` (owned by
# Plan 04's eval_run.py — NOT touched here) so they render on BOTH ``promoted`` AND ``not_promoted``
# and survive reloads (D-13 "always displayed"), with no schema change.
# ═══════════════════════════════════════════════════════════════════════════════════


def promotion_gate(source_rows: list[dict], reeval_rows: list[dict]) -> dict:
    """The D-13 case-matched no-regression + improvement gate (RESEARCH § Code Examples — verbatim).

    Join the SOURCE run × the RE-EVAL run on ``test_case_id``, ``with_skill`` arm only, over the
    INTERSECTION of test_case_ids GRADED in BOTH runs (Open-Q3 — a case added or deleted since the
    source run is honestly ``excluded_not_measured``, never counted as a pass OR a fail).
    ``not_measured`` (``verdict_state != 'graded'``) rows are excluded from BOTH sides. Returns
    EXACTLY the 8 keys of ``PromotionGate.model_fields`` (asserted in test_promotion_gate.py so the
    field can never silently drift from the model)."""

    def graded_map(rows: list[dict]) -> dict:
        # test_case_id -> verdict_passed(bool), only GRADED with_skill rows.
        return {
            r["test_case_id"]: r["verdict_passed"]
            for r in rows
            if r.get("variant") == "with_skill" and r.get("verdict_state") == "graded"
        }

    src, new = graded_map(source_rows), graded_map(reeval_rows)
    shared = src.keys() & new.keys()
    prev_pass = {c for c in shared if src[c] is True}
    prev_fail = {c for c in shared if src[c] is False}
    no_regression = all(new[c] is True for c in prev_pass)   # every prev-PASS still PASS
    improved = any(new[c] is True for c in prev_fail)         # >=1 prev-FAIL now PASS
    passed = no_regression and improved
    return {  # honest counts ALWAYS displayed alongside the verdict (D-13)
        "passed": passed,
        "no_regression": no_regression,
        "improved": improved,
        "prev_pass": len(prev_pass),
        "prev_fail": len(prev_fail),
        "still_pass": sum(1 for c in prev_pass if new[c]),
        "newly_pass": sum(1 for c in prev_fail if new[c]),
        "excluded_not_measured": len([c for c in (src.keys() | new.keys()) if c not in shared]),
    }


async def _read_arm_results(supabase: Client, run_id, user_id: str) -> list[dict]:
    """Read the gate-relevant ``eval_results`` columns for one run, owner-scoped (T-135-07)."""

    def _read():
        return (
            supabase.table("eval_results")
            .select("test_case_id, variant, verdict_state, verdict_passed")
            .eq("eval_run_id", str(run_id))
            .eq("user_id", user_id)
            .execute()
        )

    return list((await run_in_threadpool(_read)).data or [])


async def _compute_gate(
    supabase: Client, *, source_eval_run_id, re_eval_run_id, user_id: str
) -> PromotionGate | None:
    """Recompute the D-13 honest gate from the SOURCE + RE-EVAL runs' ``eval_results`` (owner-scoped).

    Returns ``None`` — honestly nothing to display — when either run id is missing, the re-eval run
    is not ``completed``, or it has no results yet (in-flight / interrupted). Else returns
    ``PromotionGate(**promotion_gate(source_rows, reeval_rows))``. Recompute-on-read (no schema
    change) so ``promoted`` AND ``not_promoted`` proposals carry the counts and survive reloads
    (D-13 "always displayed"). All blocking calls threadpool-wrapped (D-v2.5-01)."""
    if not source_eval_run_id or not re_eval_run_id:
        return None

    # The re-eval must be a COMPLETED run for the gate to be meaningful (an in-flight / interrupted
    # re-eval has nothing honest to show).
    def _read_reeval_meta():
        return (
            supabase.table("eval_runs")
            .select("id, status")
            .eq("id", str(re_eval_run_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    meta = list((await run_in_threadpool(_read_reeval_meta)).data or [])
    if not meta or meta[0].get("status") != "completed":
        return None

    source_rows = await _read_arm_results(supabase, source_eval_run_id, user_id)
    reeval_rows = await _read_arm_results(supabase, re_eval_run_id, user_id)
    if not reeval_rows:
        return None
    return PromotionGate(**promotion_gate(source_rows, reeval_rows))


async def reconcile_proposal(
    supabase: Client, redis, *, proposal_id, user_id: str
) -> dict | None:
    """Self-heal a ``re_evaling`` proposal to its terminal state + apply the promotion write (D-13/D-14).

    Reads the proposal owner-scoped. If it is NOT ``re_evaling``, returns it UNCHANGED (the route
    attaches the gate for display via ``_compute_gate``). Else reads the linked re-eval run and branches:

      (a) run ``completed``     -> ``gate = _compute_gate(...)``; ``gate.passed`` -> PROMOTE: the SINGLE
          ``skills.instructions`` UPDATE = proposed (fires the 079 trigger's benign ``manual`` dup
          version — ACCEPT it, Pitfall #2; the ``self_improve`` draft remains the anchor) + status
          ``promoted``; else status ``not_promoted``.
      (b) run terminal-but-not-completed (``failed``/``cancelled``/``interrupted``) OR running-but-orphaned
          (status ``running`` AND the run is not in ``RUN_TASKS`` — a backend restart lost the task) ->
          status ``interrupted`` (D-14 — never stuck ``re_evaling``; nothing to display honestly).

    Persists the transition (service-role UPDATE, owner-scoped) and returns the updated row (or the
    unchanged row when the run is genuinely in-flight). Returns ``None`` when the proposal is missing.
    All blocking calls threadpool-wrapped (D-v2.5-01)."""

    def _read_proposal():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    rows = list((await run_in_threadpool(_read_proposal)).data or [])
    if not rows:
        return None
    proposal = rows[0]
    re_eval_run_id = proposal.get("re_eval_run_id")
    status_val = proposal.get("status")
    new_status: str | None = None

    if (
        status_val == "approved"
        and not re_eval_run_id
        and _approved_is_stale(proposal.get("updated_at"))
    ):
        # CR-03 self-heal (D-14): approve commits status='approved' (step 7) BEFORE ``_launch_reeval``
        # links a re_eval_run_id; if the request died there (crash, or a launch failure whose revert
        # also failed) the row is wedged ``approved`` with no run. A STALE ``approved`` row (updated_at
        # older than ``_APPROVED_STALE_GRACE_S``, or missing/unparseable) is honestly ``interrupted`` —
        # this function's own "approved but no re-eval linked -> interrupted" contract. A FRESH
        # ``approved`` row still inside the grace window is a normal in-flight approve request and is
        # left UNTOUCHED (the elif below returns it unchanged).
        new_status = "interrupted"
    elif status_val != "re_evaling":
        # Not a re-eval in progress (and not a stale approved row) -> unchanged; the route attaches
        # the gate for display via ``_compute_gate``.
        return proposal
    elif not re_eval_run_id:
        # ``re_evaling`` but no re-eval linked (a crash between the version INSERT and the launch) —
        # honestly interrupted (D-14).
        new_status = "interrupted"
    else:
        def _read_run():
            return (
                supabase.table("eval_runs")
                .select("id, status")
                .eq("id", str(re_eval_run_id))
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        run_rows = list((await run_in_threadpool(_read_run)).data or [])
        run_status = run_rows[0].get("status") if run_rows else None

        if run_status == "completed":
            gate = await _compute_gate(
                supabase,
                source_eval_run_id=proposal.get("source_eval_run_id"),
                re_eval_run_id=re_eval_run_id,
                user_id=user_id,
            )
            if gate is not None and gate.passed:
                # PROMOTE — the SINGLE live-skill write, ONLY on a passing gate (T-135-04). This is
                # the only place the loop touches ``skills``; it fires the 079 capture trigger -> a
                # benign source='manual' dup version we ACCEPT (Pitfall #2, trigger untouched).
                proposed = proposal.get("proposed_instructions") or ""
                skill_id = proposal["skill_id"]

                def _promote():
                    return (
                        supabase.table("skills")
                        .update({"instructions": proposed})
                        .eq("id", skill_id)
                        .eq("user_id", user_id)
                        .execute()
                    )

                await run_in_threadpool(_promote)
                new_status = "promoted"
            else:
                new_status = "not_promoted"
        elif run_status in ("failed", "cancelled", "interrupted"):
            new_status = "interrupted"
        elif run_status == "running":
            # Orphan check (CR-02): a ``running`` re-eval whose task is gone from ``RUN_TASKS`` MIGHT
            # be orphaned — but the per-process ``RUN_TASKS`` dict is defeated by the WORKER_COUNT=2
            # default (the task can be alive on the OTHER worker). Cross-check the shared
            # ``eval_inflight:{skill_id}`` Redis claim ``_launch_reeval`` SET-NX'd with value
            # ``str(re_eval_run_id)`` (CAS-released in ``run_eval_job``'s finally): while the claim
            # still NAMES this run it is a healthy in-flight re-eval on another worker -> LEAVE
            # ``re_evaling`` (no transition). Only when the task is absent HERE AND the claim no longer
            # names this run (released / expired) is it a true orphan -> interrupted (D-14). This stops
            # the false ``interrupted`` that silently skips the promotion gate under multi-worker.
            from app.api.threads import RUN_TASKS  # function-local (avoid circular import)

            try:
                run_key = UUID(str(re_eval_run_id))
            except (ValueError, TypeError):
                run_key = re_eval_run_id

            claim = await redis.get(_inflight_key(proposal["skill_id"]))
            claim_val = claim.decode() if isinstance(claim, bytes) else claim
            if run_key not in RUN_TASKS and claim_val != str(re_eval_run_id):
                new_status = "interrupted"
        else:
            # Unknown / missing run row -> honestly interrupted (never stuck ``re_evaling``).
            new_status = "interrupted"

    if new_status is None:
        return proposal  # genuinely in-flight — no transition

    def _persist():
        return (
            supabase.table("skill_proposals")
            .update({"status": new_status})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    updated = list((await run_in_threadpool(_persist)).data or [])
    return updated[0] if updated else {**proposal, "status": new_status}


async def _launch_reeval(
    *,
    skill: dict,
    draft_version: dict,
    proposed_instructions: str,
    cases: list[dict],
    provider: str,
    model: str,
    proposal_id,
    user_id: str,
    current_user: dict,
    supabase: Client,
    redis: aioredis.Redis,
    pool: asyncpg.Pool,
) -> UUID:
    """Launch a both-arms re-eval measuring the DRAFT (Pitfall #1), REUSING the ``start_eval_run``
    companion machinery verbatim (mint run_id -> Redis SET NX inflight claim -> INSERT eval_runs +
    companion ``public.runs`` row -> ZADD -> seed the buffer BEFORE returning -> provider/model
    override -> spawn ``run_eval_job`` -> register in RUN_TASKS). The WITH arm reads the draft body
    via ``skill_instructions_override={skill.name: proposed_instructions}`` (Plan 02 seam). Registers
    a done-callback that reconciles the proposal so the gate finalizes in-process. Returns the re-eval
    ``run_id``. Does NOT fork ``run_eval_job`` (D-12). On a pre-spawn failure the inflight claim is
    CAS-released so a transient error can't wedge the skill for the full TTL."""
    skill_id = skill["id"]
    run_id = uuid4()

    # ONE eval per skill (T-135-06 DoS bound) — the SAME atomic SET NX claim ``start_eval_run`` takes;
    # the spawned ``run_eval_job`` CAS-releases it in its ``finally``. 409 on contention.
    claimed = await redis.set(
        _inflight_key(skill_id), str(run_id), nx=True, ex=_INFLIGHT_TTL_S
    )
    if not claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An eval run is already in progress for this skill",
        )

    try:
        # Anchor thread so the companion runs row has a valid (NOT NULL FK) thread_id; is_eval=True
        # keeps it out of the sidebar (Phase 134.1 / BUG-260702-01).
        eval_thread_id = uuid4()

        def _insert_thread():
            return (
                supabase.table("threads")
                .insert({
                    "id": str(eval_thread_id),
                    "user_id": user_id,
                    "title": "[eval] skill re-eval (self-improve)",
                    "folder_id": None,
                    "is_eval": True,
                })
                .execute()
            )

        await run_in_threadpool(_insert_thread)

        # Durable eval_runs row — skill_version_id = the DRAFT (self_improve) version + provider/model
        # = the SOURCE run's (D-11). user_id/skill_id from the caller + path (NEVER a body — T-135-02).
        def _insert_eval_run():
            return (
                supabase.table("eval_runs")
                .insert({
                    "id": str(run_id),
                    "skill_id": skill_id,
                    "skill_version_id": draft_version["id"],
                    "user_id": user_id,
                    "provider": provider,
                    "model": model,
                    "status": "running",
                    "case_count": len(cases),
                })
                .execute()
            )

        await run_in_threadpool(_insert_eval_run)

        # Companion public.runs row keyed by the SAME run_id (Pattern 3 — reattach/cancel for free).
        await insert_run(
            pool,
            run_id=run_id,
            thread_id=eval_thread_id,
            user_id=UUID(user_id),
            status="streaming",
            model=model,
            provider=provider,
        )

        # Run-buffer ZADD + seed the buffer BEFORE returning (the d0c0c10a race fix — a fast
        # subscriber must not hit a missing run:{id} key and synthesize a terminal error).
        _score = time_mod.time()
        try:
            await redis.zadd(f"runs_by_thread:eval:{skill_id}", {str(run_id): _score})
            await redis.zadd("runs:active", {str(run_id): _score})
        except Exception:
            logger.exception("re-eval ZADD failed for run %s; continuing", run_id)
        await eval_runner_service._emit_eval(
            redis, run_id, eval_runner_service.EVENT_RUN_STARTED
        )

        # Route the re-eval to the SOURCE run's provider/model (D-11) — the gateway routes on
        # user_settings.active_provider, so apply the SAME override_provider + model pin the chat +
        # start_eval_run paths use (no fork — the 306dd2d4 trap).
        from app.models.user_settings import load_user_settings, override_provider  # function-local

        user_settings = await run_in_threadpool(load_user_settings, user_id)
        if provider and provider != user_settings.active_provider:
            user_settings = override_provider(user_settings, provider)
        user_settings = user_settings.model_copy(update={"llm_model": model})

        # Spawn the bounded re-eval job (non-blocking). Pitfall #1: the WITH arm measures the DRAFT
        # via ``skill_instructions_override`` keyed on the skill NAME (Plan 02 seam). Register in
        # RUN_TASKS for cancel parity + a done-callback that reconciles the proposal in-process so
        # the gate finalizes without waiting for a GET (the GET path is the restart backstop).
        from app.api.threads import RUN_TASKS  # function-local (avoid circular import)

        task = asyncio.create_task(
            eval_runner_service.run_eval_job(
                run_id=run_id,
                skill_id=skill_id,
                skill_version=draft_version,
                cases=cases,
                provider=provider,
                model=model,
                current_user=current_user,
                user_settings=user_settings,
                redis=redis,
                supabase=supabase,
                pool=pool,
                # WR-02: key the override on BOTH the live skill name AND the DRAFT version name.
                # The WITH-arm catalog (eval_runner_service.py) injects ``skill_version["name"]`` =
                # the draft version's name, and ``_handle_load_skill`` looks the override up by that
                # catalog name — so keying only on the live ``skill.name`` silently misses when the
                # skill was renamed between propose and approve (Pitfall #1's "silent no-op gate").
                skill_instructions_override={
                    name: proposed_instructions
                    for name in {skill.get("name") or "", draft_version.get("name") or ""}
                    if name
                },
            )
        )
        RUN_TASKS[run_id] = task

        def _on_reeval_done(_t, _rid=run_id, _pid=str(proposal_id), _uid=user_id):
            RUN_TASKS.pop(_rid, None)
            rec = asyncio.create_task(
                reconcile_proposal(supabase, redis, proposal_id=_pid, user_id=_uid)
            )
            _RECONCILE_TASKS.add(rec)
            rec.add_done_callback(_RECONCILE_TASKS.discard)

        task.add_done_callback(_on_reeval_done)
    except Exception:
        # The job never spawned — release the claim NOW (its owner-on-finally never starts) so a
        # transient error doesn't wedge the skill for the full TTL. CAS-release (only our OWN claim).
        await eval_runner_service._release_inflight_if_owned(redis, skill_id, run_id)
        raise

    return run_id


# ── POST approve — self_improve draft INSERT (no live-skill write) + launch the re-eval ──
@router.post("/{skill_id}/proposals/{proposal_id}/approve")
async def approve_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_pg_pool),
):
    """Approve a proposal: INSERT the immutable ``self_improve`` draft version WITHOUT touching the
    live skill (D-05), then launch a both-arms re-eval that measures the DRAFT (Pitfall #1).

    Owner-verify the skill (404 cross-user) + the proposal on ``id`` AND ``user_id`` AND ``skill_id``
    (404 not 403 — T-135-01); require ``status=='proposed'`` (409 otherwise). Read the base version
    (name/description carried onto the draft) + the SOURCE run's provider/model (D-11). Compute
    ``next_num = COALESCE(MAX(version_number),0)+1`` and service-role INSERT a ``skill_versions`` row
    (``source='self_improve'`` — a DIRECT INSERT bypasses the 079 append-only trigger; only UPDATE is
    blocked) with ``instructions=proposed``. Link ``new_skill_version_id`` + mark ``approved``, launch
    the re-eval reusing the ``start_eval_run`` machinery on the source provider/model with the draft
    override, then link ``re_eval_run_id`` + ``status='re_evaling'``. Returns ``{proposal,
    re_eval_run_id}``. Every supabase-py call is threadpool-wrapped (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner-verify the skill (404 cross-user) + read the proposal (id AND user_id AND skill_id).
    #    CR-01 (139 review): kind-gated — a description proposal (SI-02) approved through this
    #    INSTRUCTION route would dead-end at the source-run guard with a nonsense 400; make it a
    #    clean 404 instead (indistinguishable from absent — T-139-10 symmetry).
    skill = await _verify_owned_skill(supabase, skill_id, user_id)

    def _read_proposal():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .eq("kind", "instruction")
            .limit(1)
            .execute()
        )

    try:
        prop_rows = list((await run_in_threadpool(_read_proposal)).data or [])
    except Exception:
        logger.debug("proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not prop_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    proposal = prop_rows[0]

    # 2. State guard — only a ``proposed`` draft can be approved (409 otherwise — T-135-01).
    if proposal.get("status") != "proposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proposal is not proposable (status={proposal.get('status')})",
        )

    base_version_id = proposal["base_skill_version_id"]
    source_eval_run_id = proposal.get("source_eval_run_id")
    proposed_instructions = proposal.get("proposed_instructions") or ""

    # 3. Read the base version (name/description carried onto the draft) — owner-scoped.
    def _read_base_version():
        return (
            supabase.table("skill_versions")
            .select("id, name, description")
            .eq("id", str(base_version_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    base_rows = list((await run_in_threadpool(_read_base_version)).data or [])
    if not base_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Base skill version not found",
        )
    base_version = base_rows[0]

    # 4. Read the SOURCE run's provider/model (D-11 — the re-eval routes to the SAME provider/model).
    source_provider = None
    source_model = None
    if source_eval_run_id:
        def _read_source_run():
            return (
                supabase.table("eval_runs")
                .select("id, provider, model")
                .eq("id", str(source_eval_run_id))
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        src_rows = list((await run_in_threadpool(_read_source_run)).data or [])
        if src_rows:
            source_provider = src_rows[0].get("provider")
            source_model = src_rows[0].get("model")
    if not source_provider or not source_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source eval run provider/model unavailable — cannot re-eval",
        )

    # 5. Read the owner's test cases (the re-eval corpus). Reject an empty fan-out (T-133-02 parity).
    cases = await _read_skill_cases(supabase, skill_id, user_id)
    if not cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This skill has no test cases to re-evaluate",
        )

    # 6. INSERT the immutable self_improve DRAFT version WITHOUT touching the live skill (D-05). A
    # DIRECT service-role INSERT (source='self_improve') bypasses the 079 trigger (only UPDATE is
    # blocked); next_num = COALESCE(MAX(version_number),0)+1 for the skill.
    def _read_max_version():
        return (
            supabase.table("skill_versions")
            .select("version_number")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )

    max_rows = list((await run_in_threadpool(_read_max_version)).data or [])
    next_num = ((max_rows[0].get("version_number") if max_rows else 0) or 0) + 1

    draft_version_id = uuid4()
    draft_payload = {
        "id": str(draft_version_id),
        "skill_id": skill_id,
        "user_id": user_id,
        "version_number": next_num,
        "name": base_version.get("name") or skill.get("name") or "",
        "description": base_version.get("description") or "",
        "instructions": proposed_instructions,
        "source": "self_improve",
    }

    def _insert_draft():
        return supabase.table("skill_versions").insert(draft_payload).execute()

    draft_resp = await run_in_threadpool(_insert_draft)
    draft_echo = (list(draft_resp.data or []) or [draft_payload])[0]
    draft_version = {**draft_payload, **draft_echo}

    # 7. Link the draft + mark ``approved`` (in-flight; blocks a new propose — D-04). ``re_evaling`` is
    # set together with ``re_eval_run_id`` AFTER the launch succeeds (step 9) so a reconcile can never
    # see ``re_evaling`` without a run id and race it to ``interrupted``.
    def _mark_approved():
        return (
            supabase.table("skill_proposals")
            .update({
                "new_skill_version_id": str(draft_version_id),
                "status": "approved",
            })
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    await run_in_threadpool(_mark_approved)

    # 8. Launch the both-arms re-eval measuring the DRAFT (Pitfall #1), reusing start_eval_run's
    # companion machinery (no fork of run_eval_job — D-12). CR-03: step 7 already committed
    # status='approved', so a launch failure here (the reachable case is the shared
    # ``eval_inflight:{skill_id}`` 409 raised when a normal eval is already running for this skill)
    # must NOT wedge the proposal in ``approved``. Revert to an actionable ``proposed`` state with a
    # CAS-guarded owner-scoped UPDATE (``.eq('status','approved')`` is the compare-and-swap so a
    # concurrent transition is not clobbered), then re-raise. The already-inserted ``self_improve``
    # draft version row is harmless; unlink it (``new_skill_version_id=None``) so the row is clean.
    try:
        re_eval_run_id = await _launch_reeval(
            skill=skill,
            draft_version=draft_version,
            proposed_instructions=proposed_instructions,
            cases=cases,
            provider=source_provider,
            model=source_model,
            proposal_id=proposal_id,
            user_id=user_id,
            current_user=current_user,
            supabase=supabase,
            redis=redis,
            pool=pool,
        )
    except Exception:
        def _revert_approved():
            return (
                supabase.table("skill_proposals")
                .update({"status": "proposed", "new_skill_version_id": None})
                .eq("id", str(proposal_id))
                .eq("user_id", user_id)
                .eq("status", "approved")
                .execute()
            )

        await run_in_threadpool(_revert_approved)
        raise

    # 9. Link the re_eval_run_id + transition to ``re_evaling`` in one write.
    def _mark_reevaling():
        return (
            supabase.table("skill_proposals")
            .update({"re_eval_run_id": str(re_eval_run_id), "status": "re_evaling"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    await run_in_threadpool(_mark_reevaling)

    row = {
        **proposal,
        "new_skill_version_id": str(draft_version_id),
        "re_eval_run_id": str(re_eval_run_id),
        "status": "re_evaling",
    }
    base_instructions = await _read_base_instructions(supabase, base_version_id, user_id)
    proposal_resp = _proposal_response(row, base_instructions=base_instructions, gate=None)
    return {"proposal": proposal_resp, "re_eval_run_id": str(re_eval_run_id)}


# ── POST rerun — re-launch a re-eval for an interrupted proposal (D-14 affordance) ───────
@router.post("/{skill_id}/proposals/{proposal_id}/rerun")
async def rerun_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_pg_pool),
):
    """Re-launch the re-eval for an ``interrupted`` proposal against its EXISTING draft version (D-14).

    Owner-verify the skill + proposal (404 not 403). First ``reconcile_proposal`` so a stale
    ``re_evaling`` settles to its true terminal state; then require the effective status to be
    ``interrupted`` (409 if genuinely in-flight ``re_evaling`` / not rerunnable). Reuse the Task-1
    launch block against the EXISTING ``new_skill_version_id`` draft (same draft override, same source
    provider/model), set ``re_eval_run_id`` + ``status='re_evaling'``. Returns ``{proposal,
    re_eval_run_id}``."""
    user_id = current_user["id"]

    skill = await _verify_owned_skill(supabase, skill_id, user_id)

    def _read_proposal():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
        )

    try:
        prop_rows = list((await run_in_threadpool(_read_proposal)).data or [])
    except Exception:
        logger.debug("proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not prop_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    proposal = prop_rows[0]

    # Settle a stale ``re_evaling`` first (a terminal/orphaned run -> interrupted here — D-14).
    if proposal.get("status") == "re_evaling":
        reconciled = await reconcile_proposal(
            supabase, redis, proposal_id=proposal_id, user_id=user_id
        )
        if reconciled is not None:
            proposal = reconciled

    if proposal.get("status") != "interrupted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proposal is not rerunnable (status={proposal.get('status')})",
        )

    draft_version_id = proposal.get("new_skill_version_id")
    if not draft_version_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Proposal has no draft version to re-evaluate",
        )
    proposed_instructions = proposal.get("proposed_instructions") or ""
    source_eval_run_id = proposal.get("source_eval_run_id")

    # Read the EXISTING draft version (name/description/instructions) — owner-scoped.
    def _read_draft():
        return (
            supabase.table("skill_versions")
            .select("id, name, description, instructions")
            .eq("id", str(draft_version_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    draft_rows = list((await run_in_threadpool(_read_draft)).data or [])
    if not draft_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Draft skill version not found",
        )
    draft_version = draft_rows[0]

    # Source provider/model (D-11).
    source_provider = None
    source_model = None
    if source_eval_run_id:
        def _read_source_run():
            return (
                supabase.table("eval_runs")
                .select("id, provider, model")
                .eq("id", str(source_eval_run_id))
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        src_rows = list((await run_in_threadpool(_read_source_run)).data or [])
        if src_rows:
            source_provider = src_rows[0].get("provider")
            source_model = src_rows[0].get("model")
    if not source_provider or not source_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source eval run provider/model unavailable — cannot re-eval",
        )

    cases = await _read_skill_cases(supabase, skill_id, user_id)
    if not cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This skill has no test cases to re-evaluate",
        )

    re_eval_run_id = await _launch_reeval(
        skill=skill,
        draft_version=draft_version,
        proposed_instructions=proposed_instructions,
        cases=cases,
        provider=source_provider,
        model=source_model,
        proposal_id=proposal_id,
        user_id=user_id,
        current_user=current_user,
        supabase=supabase,
        redis=redis,
        pool=pool,
    )

    def _mark_reevaling():
        return (
            supabase.table("skill_proposals")
            .update({"re_eval_run_id": str(re_eval_run_id), "status": "re_evaling"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    await run_in_threadpool(_mark_reevaling)

    row = {**proposal, "re_eval_run_id": str(re_eval_run_id), "status": "re_evaling"}
    base_instructions = await _read_base_instructions(
        supabase, proposal.get("base_skill_version_id"), user_id
    )
    proposal_resp = _proposal_response(row, base_instructions=base_instructions, gate=None)
    return {"proposal": proposal_resp, "re_eval_run_id": str(re_eval_run_id)}


# ── POST force-promote — human override of a failed gate, with evidence recorded (D-06) ──
@router.post(
    "/{skill_id}/proposals/{proposal_id}/force-promote",
    response_model=SkillProposalResponse,
)
async def force_promote_skill_proposal(
    skill_id: str,
    proposal_id: UUID,
    body: ForcePromoteBody | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Force-promote a ``not_promoted`` proposal despite a non-improving gate (D-06 — human override).

    Owner-verify the skill + proposal (404 not 403); require ``status=='not_promoted'`` (409 otherwise
    — a human may only override a proposal the gate already FAILED, with the failed evidence still
    linked via ``re_eval_run_id``). Apply the promotion write (the SAME accept-the-079-trigger-dup
    ``skills.instructions`` UPDATE as ``reconcile_proposal`` — Pitfall #2), set ``override_forced=true``
    + ``status='promoted'``, and attach ``gate=_compute_gate(...)`` so the FAILED honest counts render
    at the moment of override (D-13 always displayed + D-06 override-with-evidence). ``ForcePromoteBody``
    is empty — the server derives everything, nothing to forge (T-135-02)."""
    user_id = current_user["id"]

    skill = await _verify_owned_skill(supabase, skill_id, user_id)

    def _read_proposal():
        return (
            supabase.table("skill_proposals")
            .select("*")
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
        )

    try:
        prop_rows = list((await run_in_threadpool(_read_proposal)).data or [])
    except Exception:
        logger.debug("proposal ownership read raised; treating as 404", exc_info=True)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if not prop_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    proposal = prop_rows[0]

    if proposal.get("status") != "not_promoted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only a not_promoted proposal can be force-promoted (status={proposal.get('status')})",
        )

    proposed_instructions = proposal.get("proposed_instructions") or ""

    # The promotion write — the SINGLE live-skill UPDATE (accept the 079 trigger dup, Pitfall #2).
    def _promote():
        return (
            supabase.table("skills")
            .update({"instructions": proposed_instructions})
            .eq("id", skill_id)
            .eq("user_id", user_id)
            .execute()
        )

    await run_in_threadpool(_promote)

    def _mark_promoted():
        return (
            supabase.table("skill_proposals")
            .update({"override_forced": True, "status": "promoted"})
            .eq("id", str(proposal_id))
            .eq("user_id", user_id)
            .execute()
        )

    updated = list((await run_in_threadpool(_mark_promoted)).data or [])
    row = updated[0] if updated else {
        **proposal, "override_forced": True, "status": "promoted",
    }
    # Attach the FAILED honest counts at the moment of override (D-13 + D-06 override-with-evidence).
    gate = await _compute_gate(
        supabase,
        source_eval_run_id=row.get("source_eval_run_id"),
        re_eval_run_id=row.get("re_eval_run_id"),
        user_id=user_id,
    )
    base_instructions = await _read_base_instructions(
        supabase, row.get("base_skill_version_id"), user_id
    )
    return _proposal_response(row, base_instructions=base_instructions, gate=gate)


# ═══════════════════════════════════════════════════════════════════════════════════
# Phase 137.1 Plan 04 (EVAL-05) — matrix fan-out + engine smoke sweep + engine-health.
#
#   POST /skills/{skill_id}/evals/matrix   -> {matrix_group_id, arms[]}  (N single-provider
#                                             runs under ONE group claim, ONE feeds_gate — D-05/D-06)
#   POST /evals/engine-sweep               -> EngineHealthBoard  (the sweep rides the SAME matrix
#                                             machinery over a built-in in-memory SKILL-LESS fixture — D-01/D-02)
#   GET  /evals/engine-health              -> EngineHealthBoard  (the caller's latest sweep board — D-03)
#   GET  /evals/runs/{run_id}              -> {eval_run, eval_results}  (skill-less run readout — D-03)
#
# THE HARD PARTS ARE ALREADY SOLVED (RESEARCH): each arm is an existing self-contained
# ``run_eval_job``; N rows are N existing per-run subscriptions; the SSE + re-attach machinery is
# reused UNCHANGED. Net-new is (a) the ONE group claim (value=group_id, D-06/Pitfall 1), (b) the
# exactly-one gate-feeder flag (D-05), and (c) the in-memory smoke fixture (D-02). The per-arm spawn
# is the SAME companion machinery ``start_eval_run`` uses, extracted into ``_spawn_eval_job`` so the
# matrix + sweep + single-run paths never diverge. OWNER-SCOPING is the sole runtime gate on every
# route (404-never-403); arms are owner-stamped from ``current_user``, NEVER the body (T-133-03).
# ═══════════════════════════════════════════════════════════════════════════════════

# Local (non-cloud) provider ids the engine smoke sweep excludes (D-01 — "native-7 + OpenRouter,
# exclude local"). A matrix run stays inclusive (a user CAN A/B a local model); only the sweep skips
# these so an unconfigured/absent local endpoint doesn't skew the cross-provider engine board.
_LOCAL_PROVIDER_IDS = frozenset({"ollama", "lmstudio", "lm_studio", "local"})

# Strong references to the fire-and-forget group-release coordinators so an ``asyncio.create_task``
# is never GC'd mid-flight (mirrors ``_RECONCILE_TASKS`` / ``eval_runner_service._BACKGROUND_TASKS``).
# NOT run state (D-PRD-12) — the in-flight correctness gate is the Redis SET NX group claim.
_MATRIX_COORD_TASKS: set[asyncio.Task] = set()

# The built-in in-memory engine smoke fixture (D-02). Synthesized IN-MEMORY and passed DIRECTLY to
# ``run_eval_job`` via its EXISTING ``skill_version`` + ``cases`` params — NO ``_read_cases`` /
# ``_read_latest_version``, and NO rows in skills / skill_versions / skill_test_cases. The arm
# persists NULL skill_id / skill_version_id (mig 085 relaxation) + NULL test_case_id (case id=None,
# Plan 02 NULL-tolerant _persist_result). Deterministic + token-cheap + judge-gradeable: an engine
# that runs end-to-end returns the token and grades PASS (healthy); a provider with no key fails the
# arm honestly -> not_measured carrying the REAL provider error (unhealthy — never engine-shaped).
# COORDINATION NOTE: if Phase 137.2 (CREATE-01) lands a shared hidden/built-in skill mechanism, this
# fixture MAY migrate onto it — it is intentionally a plain dict here so that move is a one-liner.
_SMOKE_SKILL_VERSION: dict = {
    "id": None,
    "name": "engine-smoke",
    "description": "Built-in engine smoke check — a trivial no-op skill used only to prove the "
    "agent loop runs end-to-end on each provider.",
    "instructions": "Answer the user directly and concisely.",
}
_SMOKE_CASE: dict = {
    "id": None,  # NULL test_case_id (Plan 02 NULL-tolerant _persist_result) — no skill_test_cases row
    "prompt": "Reply with exactly the single word: PONG. Output nothing else.",
    "expected_behavior": "The response contains the token PONG.",
    "order_index": 0,
}


# Operator-PINNED representative model per provider for skill/engine testing — a TEMPORARY
# stand-in for the user-selectable matrix-model picker (deferred; see
# project_dynamic_settings_direction / "later we'll add the ability to select the matrix
# models"). It overrides a provider whose AUTO-picked registry model is registry-valid but does
# NOT actually route — e.g. OpenRouter's z-ai/glm-5.1 returns 404 "no endpoints found". OpenRouter
# is a passthrough gateway, so a pinned model need NOT be in MODEL_CAPABILITIES to run
# (get_model_capability infers caps for unknown ids). When the picker ships this becomes its
# default seed.
_PINNED_REPRESENTATIVE_MODEL: dict[str, str] = {
    "openrouter": "nvidia/nemotron-3-ultra-550b-a55b",
}


def _representative_registry_model(provider_id: str, provider_models: list[str] | None) -> str | None:
    """Pick ONE representative model for ``provider_id`` (D-01 / V5). An operator PIN
    (``_PINNED_REPRESENTATIVE_MODEL``) wins first (a real provider model the auto-pick can't reach);
    else prefer the provider's OWN configured ``models`` list (newest-first curation already lives
    there), else scan ``MODEL_CAPABILITIES`` for the first registry entry whose provider matches.
    Returns None when the provider has no model at all (that provider is then OMITTED — never a
    fabricated model)."""
    pinned = _PINNED_REPRESENTATIVE_MODEL.get(provider_id)
    if pinned:
        return pinned
    for m in provider_models or []:
        cap = get_model_capability(m)
        if cap.get("capability_source") == "registry" and cap.get("provider") == provider_id:
            return m
    for m, cap in MODEL_CAPABILITIES.items():
        if cap.get("capability_source") == "registry" and cap.get("provider") == provider_id:
            return m
    return None


def _configured_provider_configs(
    user_settings, *, exclude_local: bool, prefer_active_model: bool
) -> list[dict]:
    """Build the fan-out config list: ONE ``{provider, model}`` per CONFIGURED provider (a provider
    is configured iff it carries a non-empty ``api_key``), each with a registry-valid representative
    model. A provider with no registry model is OMITTED (D-01). When ``prefer_active_model`` is set,
    the user's active provider uses the user's OWN selected ``llm_model`` if it is registry-valid for
    that provider (so the default gate-feeder arm measures the model the user actually runs). Pure /
    deterministic — no I/O — so the config logic is unit-testable off a fake settings object."""
    configs: list[dict] = []
    seen: set[str] = set()
    for p in getattr(user_settings, "providers", None) or []:
        pid = getattr(p, "id", None)
        if not pid or pid in seen:
            continue
        if not getattr(p, "api_key", ""):  # unconfigured provider — skip
            continue
        if exclude_local and pid in _LOCAL_PROVIDER_IDS:
            continue
        model: str | None = None
        if prefer_active_model and pid == getattr(user_settings, "active_provider", None):
            m = getattr(user_settings, "llm_model", "") or ""
            cap = get_model_capability(m) if m else {}
            if cap.get("capability_source") == "registry" and cap.get("provider") == pid:
                model = m
        if model is None:
            model = _representative_registry_model(pid, getattr(p, "models", None))
        if model is None:
            continue
        seen.add(pid)
        configs.append({"provider": pid, "model": model})
    return configs


async def _spawn_eval_job(
    *,
    run_id: UUID,
    skill_id: str,
    skill_version: dict,
    cases: list[dict],
    provider: str,
    model: str,
    current_user: dict,
    user_settings,
    redis: aioredis.Redis,
    supabase: Client,
    pool: asyncpg.Pool,
) -> asyncio.Task:
    """Spawn ONE eval arm's background job, REUSING ``start_eval_run``'s companion machinery
    verbatim (anchor ``is_eval`` thread -> companion ``public.runs`` row -> ZADD -> seed the run
    buffer BEFORE any subscriber -> per-arm provider/model override -> ``run_eval_job`` task ->
    register in ``RUN_TASKS``). RETURNS the created ``asyncio.Task`` so the group coordinator can
    await ALL arms before releasing the ONE shared group claim (D-06 / Pitfall 1).

    ``skill_id`` is the JOB key (a real skill id for a matrix arm; the synthetic
    ``engine-sweep:{user_id}`` key for the skill-less sweep) — used ONLY for ``run_eval_job``'s
    inflight CAS-release + ZREM keys, NEVER for the ``eval_runs`` row (the CALLER inserts that with
    the correct real / NULL skill_id). The per-arm ``override_provider`` mirrors the chat +
    ``start_eval_run`` route (the 306dd2d4 routing trap — the gateway routes on
    ``active_provider``, so each arm's provider must be applied as a per-run override)."""
    user_id = current_user["id"]
    eval_thread_id = uuid4()

    def _insert_thread():
        return (
            supabase.table("threads")
            .insert({
                "id": str(eval_thread_id),
                "user_id": user_id,
                "title": "[eval] matrix arm",
                "folder_id": None,
                "is_eval": True,  # Phase 134.1 — keep the anchor thread out of the sidebar.
            })
            .execute()
        )

    await run_in_threadpool(_insert_thread)

    await insert_run(
        pool,
        run_id=run_id,
        thread_id=eval_thread_id,
        user_id=UUID(user_id),
        status="streaming",
        model=model,
        provider=provider,
    )

    _score = time_mod.time()
    try:
        await redis.zadd(f"runs_by_thread:eval:{skill_id}", {str(run_id): _score})
        await redis.zadd("runs:active", {str(run_id): _score})
    except Exception:
        logger.exception("matrix/sweep arm ZADD failed for run %s; continuing", run_id)
    # Seed the buffer BEFORE returning so a fast subscriber never hits a missing run:{id} key and
    # synthesizes a terminal error (the d0c0c10a race — best-effort, never raises).
    await eval_runner_service._emit_eval(redis, run_id, eval_runner_service.EVENT_RUN_STARTED)

    from app.models.user_settings import override_provider  # function-local (avoid import cycle)

    arm_settings = user_settings
    if provider and provider != arm_settings.active_provider:
        arm_settings = override_provider(arm_settings, provider)
    arm_settings = arm_settings.model_copy(update={"llm_model": model})

    from app.api.threads import RUN_TASKS  # function-local (avoid circular import)

    task = asyncio.create_task(
        eval_runner_service.run_eval_job(
            run_id=run_id,
            skill_id=skill_id,
            skill_version=skill_version,
            cases=cases,
            provider=provider,
            model=model,
            current_user=current_user,
            user_settings=arm_settings,
            redis=redis,
            supabase=supabase,
            pool=pool,
        )
    )
    RUN_TASKS[run_id] = task
    task.add_done_callback(lambda _t, _r=run_id: RUN_TASKS.pop(_r, None))
    return task


async def _release_group_when_done(
    redis: aioredis.Redis, claim_skill_id: str, group_id: UUID, tasks: list
) -> None:
    """After ALL arms of a matrix/sweep group finish, CAS-release the ONE shared group claim
    (``_inflight_key(claim_skill_id)`` with value == ``group_id``). CRITICAL (D-06 / Pitfall 1):
    each arm's own ``run_eval_job`` ``finally`` CAS-releases with value == ITS run_id, which NO-OPS
    because the stored claim value is ``group_id`` — so ONLY this group-level release actually frees
    the skill/sweep key after the last arm. Best-effort (``_release_inflight_if_owned`` swallows)."""
    real = [t for t in tasks if isinstance(t, asyncio.Task)]
    if real:
        await asyncio.gather(*real, return_exceptions=True)
    await eval_runner_service._release_inflight_if_owned(redis, claim_skill_id, group_id)


def _spawn_group_release(
    redis: aioredis.Redis, claim_skill_id: str, group_id: UUID, arm_tasks: list
) -> asyncio.Task | None:
    """Spawn the group-release coordinator IFF at least one real ``asyncio.Task`` arm was created
    (production). Returns the coordinator task, or None when no real arm ran (e.g. a unit test that
    mocks ``_spawn_eval_job`` — the claim then stays until its TTL, which is fine for the mocked
    assertions). Retains a strong reference so the fire-and-forget task is not GC'd."""
    real = [t for t in arm_tasks if isinstance(t, asyncio.Task)]
    if not real:
        return None
    coord = asyncio.create_task(_release_group_when_done(redis, claim_skill_id, group_id, real))
    _MATRIX_COORD_TASKS.add(coord)
    coord.add_done_callback(_MATRIX_COORD_TASKS.discard)
    return coord


async def matrix_gate_feeder_run(
    supabase: Client, *, matrix_group_id, user_id: str
) -> dict | None:
    """Return the ONE ``feeds_gate=true`` run of a matrix group, owner-scoped (D-05 / 137 D-03).

    The publish gate reads ONLY this run's rows — the gate-feeder is a LABEL on the ``feeds_gate``
    flag, NEVER a second ``met`` computation. The other N−1 arms are analysis-only and never feed the
    gate. Returns None when the group has no gate-feeder (e.g. a sweep group — feeds_gate is false on
    every arm). Owner-scoped ``.eq("user_id")`` (T-133-01); threadpool-wrapped (D-v2.5-01)."""

    def _read():
        return (
            supabase.table("eval_runs")
            .select("*")
            .eq("matrix_group_id", str(matrix_group_id))
            .eq("user_id", user_id)
            .eq("feeds_gate", True)
            .limit(1)
            .execute()
        )

    rows = list((await run_in_threadpool(_read)).data or [])
    return rows[0] if rows else None


class MatrixRunBody(BaseModel):
    """POST body for a matrix launch. ``gate_provider`` designates the ONE arm whose rows feed the
    publish gate (D-05); it defaults SERVER-SIDE to the caller's active provider when omitted.
    ``user_id``/``skill_id`` come from the caller + path, NEVER this body (T-133-03)."""

    gate_provider: str | None = None


# ── POST — matrix launch: N arms under ONE group claim, exactly ONE gate-feeder (D-05/D-06) ──
@router.post("/{skill_id}/evals/matrix", status_code=status.HTTP_202_ACCEPTED)
async def start_matrix_run(
    skill_id: str,
    body: MatrixRunBody | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_pg_pool),
):
    """Fan a skill's eval across N providers as N parallel single-provider runs (EVAL-05b).

    Owner-gate FIRST (404 cross-user — T-133-01). Resolve the LATEST owner-scoped version snapshot +
    the owner's test cases (reject an empty corpus — T-133-02). Build the config list (one
    registry-valid representative model per CONFIGURED provider; the active provider uses the user's
    selected model). Take the ONE ``SET NX`` claim keyed by ``skill_id`` with value == ``group_id``
    (D-06 — a second launch on the same skill 409s while the matrix is live). Per config: insert the
    ``eval_runs`` row (+ ``matrix_group_id`` + exactly-one ``feeds_gate`` — D-05), then spawn the arm
    via the SHARED ``_spawn_eval_job`` companion machinery. A group coordinator releases the ONE claim
    only after ALL arms finish (Pitfall 1). Returns ``{matrix_group_id, arms[]}`` immediately (D-06)."""
    user_id = current_user["id"]
    body = body or MatrixRunBody()

    # 1. Owner gate FIRST (404 cross-user before anything else — T-133-01).
    await _verify_owned_skill(supabase, skill_id, user_id)

    # 2. Resolve the LATEST owner-scoped version snapshot (the WITH-arm target — D-03/D-10).
    def _read_latest_version():
        return (
            supabase.table("skill_versions")
            .select("id, name, description, version_number")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )

    version_rows = list((await run_in_threadpool(_read_latest_version)).data or [])
    if not version_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No skill version found for this skill",
        )
    skill_version = version_rows[0]

    # 3. Read the owner-scoped test cases (reject an empty fan-out — T-133-02).
    cases = await _read_skill_cases(supabase, skill_id, user_id)
    if not cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This skill has no test cases to evaluate",
        )

    # 4. Build the fan-out configs (one registry model per configured provider; active provider uses
    #    the user's selected model). The gate_provider defaults to the caller's active provider.
    from app.models.user_settings import load_user_settings  # function-local (avoid import cycle)

    user_settings = await run_in_threadpool(load_user_settings, user_id)
    configs = _configured_provider_configs(
        user_settings, exclude_local=False, prefer_active_model=True
    )
    if not configs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No configured providers with a registry model to run a matrix over",
        )
    gate_provider = body.gate_provider or user_settings.active_provider
    # Exactly ONE feeds_gate (D-05): the gate_provider arm, or the FIRST config when the chosen
    # gate_provider is not in the list (never zero, never two).
    gate_idx = next((i for i, c in enumerate(configs) if c["provider"] == gate_provider), 0)

    # 5. Mint the group id + take the ONE claim (value == group_id — D-06 / Pitfall 1). NEVER swallow
    #    a Redis failure here — it must surface, not silently disable the DoS bound.
    group_id = uuid4()
    claimed = await redis.set(
        _inflight_key(skill_id), str(group_id), nx=True, ex=_INFLIGHT_TTL_S
    )
    if not claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An eval run is already in progress for this skill",
        )

    # 6. Fan the arms under the held claim. On a pre-spawn failure, let the coordinator release the
    #    claim after the arms that DID spawn finish (or release immediately if none did).
    arm_tasks: list = []
    arms: list[dict] = []
    try:
        for i, cfg in enumerate(configs):
            run_id = uuid4()
            feeds_gate = i == gate_idx

            def _insert_eval_run(_cfg=cfg, _rid=run_id, _fg=feeds_gate):
                return (
                    supabase.table("eval_runs")
                    .insert({
                        "id": str(_rid),
                        "skill_id": skill_id,
                        "skill_version_id": skill_version["id"],
                        "user_id": user_id,
                        "provider": _cfg["provider"],
                        "model": _cfg["model"],
                        "status": "running",
                        "case_count": len(cases),
                        "matrix_group_id": str(group_id),
                        "feeds_gate": _fg,
                    })
                    .execute()
                )

            await run_in_threadpool(_insert_eval_run)
            task = await _spawn_eval_job(
                run_id=run_id,
                skill_id=skill_id,
                skill_version=skill_version,
                cases=cases,
                provider=cfg["provider"],
                model=cfg["model"],
                current_user=current_user,
                user_settings=user_settings,
                redis=redis,
                supabase=supabase,
                pool=pool,
            )
            arm_tasks.append(task)
            arms.append({
                "run_id": str(run_id),
                "skill_id": skill_id,
                "skill_version_id": str(skill_version["id"]),
                "provider": cfg["provider"],
                "model": cfg["model"],
                "case_count": len(cases),
            })
    except Exception:
        if _spawn_group_release(redis, skill_id, group_id, arm_tasks) is None:
            await eval_runner_service._release_inflight_if_owned(redis, skill_id, group_id)
        raise

    # 7. Release the ONE claim only after ALL arms finish (Pitfall 1 — a per-arm run_id release CAS
    #    no-ops against the group_id-valued claim).
    _spawn_group_release(redis, skill_id, group_id, arm_tasks)

    return {"matrix_group_id": str(group_id), "arms": arms}


# ── GET aggregate — per-config mean±stddev/delta over run HISTORY + analyst notes (D-07/D-08) ──
@router.get("/{skill_id}/evals/aggregate")
async def get_eval_aggregate(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the per-config aggregation (mean±stddev/delta over accumulated run HISTORY) + the
    deterministic D-08 analyst notes for a skill (EVAL-05b / D-07 / D-08 — the Studio renders this
    VERBATIM, Plan 09).

    Owner-gate FIRST (404 cross-user — T-133-01 carried), read the caller's COMPLETED eval-run
    history for this skill owner-scoped (``.eq user_id``; a partial / interrupted run has no honest
    run-level rollup, so only ``completed`` runs are samples), read those runs' ``eval_results`` in
    ONE bounded owner-scoped ``.in_`` read, then DELEGATE all aggregation math + fixed phrasing to
    the pure ``eval_aggregation`` module (NO inline stats here — the honesty locks + analyst-note
    phrasing live in ONE testable place, RESEARCH OQ4). A never-evaluated skill returns the honest
    empty ``{configs: []}`` (200, not 404). Every blocking supabase-py call is threadpool-wrapped
    (D-v2.5-01)."""
    user_id = current_user["id"]

    # 1. Owner gate FIRST — 404 cross-user before any history is read (T-133-01).
    await _verify_owned_skill(supabase, skill_id, user_id)

    # 2. The caller's COMPLETED run history for this skill (owner-scoped; completed = honest samples —
    #    a partial run has no run-level rollup to average).
    def _read_runs():
        return (
            supabase.table("eval_runs")
            .select("id, provider, model, status, created_at")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("created_at")
            .execute()
        )

    runs = list((await run_in_threadpool(_read_runs)).data or [])
    if not runs:
        # Never evaluated — the honest empty aggregate (200, not 404).
        return {"configs": []}

    run_ids = [str(r["id"]) for r in runs]

    # 3. Those runs' eval_results in ONE bounded owner-scoped read (.in_ the run ids) — never
    #    over-fetches beyond this skill's completed runs.
    def _read_results():
        return (
            supabase.table("eval_results")
            .select(
                "eval_run_id, provider, model, test_case_id, variant, "
                "verdict_state, verdict_passed, verdict_score, duration_ms"
            )
            .in_("eval_run_id", run_ids)
            .eq("user_id", user_id)
            .execute()
        )

    results = list((await run_in_threadpool(_read_results)).data or [])

    # 4. Embed each run's results, then feed the rows into the pure module. ALL math + phrasing is
    #    delegated — the route does no stats (aggregate_configs → analyst_notes → to_wire).
    by_run: dict[str, list[dict]] = {}
    for r in results:
        by_run.setdefault(str(r.get("eval_run_id")), []).append(r)
    history = [
        {
            "provider": run.get("provider"),
            "model": run.get("model"),
            "results": by_run.get(str(run["id"]), []),
        }
        for run in runs
    ]
    configs = eval_aggregation.aggregate_configs(history)
    notes = eval_aggregation.analyst_notes(configs, results)
    return eval_aggregation.to_wire(configs, notes)


# ── The engine-health board (D-02/D-03) — built from the caller's LATEST skill-less sweep group ──
async def _tile_for_run(supabase: Client, run: dict, user_id: str) -> dict:
    """Compose ONE ``EngineHealthTile`` from a sweep arm's run row (owner-scoped results read).

    ``healthy`` is honest ENGINE health — TRUE iff the run ``completed`` AND its with-skill arm
    reached a GRADED verdict (the engine ran the loop end-to-end; a graded FAIL is still HEALTHY —
    the model failed the case, the engine did not). A failed / not_measured / judge_error arm is
    ``healthy=false`` and carries the VERBATIM provider/arm error (the truncated real error string,
    never an engine-shaped message — D-02); a still-running arm is ``healthy=false`` with ``error``
    None (the board renders it as in-flight). ``run_id`` deep-links to the skill-less run readout."""
    run_id = run.get("id")

    def _read_results():
        return (
            supabase.table("eval_results")
            .select("*")
            .eq("eval_run_id", str(run_id))
            .eq("user_id", user_id)
            .execute()
        )

    results = list((await run_in_threadpool(_read_results)).data or [])
    with_arm = next((r for r in results if r.get("variant") == "with_skill"), None)

    if run.get("status") == "completed" and with_arm and with_arm.get("verdict_state") == "graded":
        healthy = True
        error = None
    else:
        healthy = False
        error = None
        if with_arm:
            # The VERBATIM provider error: a failed/timed_out arm's truncated error, or a
            # judge_error arm's reason. NEVER an engine-shaped message (D-02).
            error = with_arm.get("error")
            if not error and with_arm.get("verdict_state") == "judge_error":
                error = with_arm.get("verdict_reason")
        error = error or run.get("error")
        # Only stamp a synthetic "did not complete" when the run is genuinely terminal-but-failed
        # with no real error to show; a still-running arm keeps error=None (rendered as in-flight).
        if not error and run.get("status") not in (None, "running"):
            error = "The engine did not complete this arm."
    return {
        "provider": run.get("provider"),
        "model": run.get("model"),
        "healthy": healthy,
        "error": error,
        "run_id": str(run_id) if run_id else None,
        "last_swept_at": run.get("created_at"),
    }


async def _build_engine_health_board(supabase: Client, user_id: str) -> dict:
    """Assemble the caller's LATEST skill-less sweep board (``EngineHealthBoard`` — Plan 01 shape).

    The latest-sweep lookup contract (Task 2/3): the caller's most-recent group where
    ``matrix_group_id IS NOT NULL AND skill_id IS NULL`` (owner-scoped ``.eq("user_id")`` +
    ``.is_("skill_id","null")`` — a NULL-skill row is a sweep arm BY CONSTRUCTION, so it isolates the
    sweep arms; the newest one names the latest group). Returns one tile per arm in that group +
    ``swept_at`` (the group's newest ``created_at``). Never swept -> ``{tiles: [], swept_at: null}``
    (honest empty board, 200 — never a 404). All blocking reads threadpool-wrapped (D-v2.5-01)."""

    def _read_sweep_runs():
        return (
            supabase.table("eval_runs")
            .select("*")
            .eq("user_id", user_id)
            .is_("skill_id", "null")
            .order("created_at", desc=True)
            .execute()
        )

    rows = list((await run_in_threadpool(_read_sweep_runs)).data or [])
    sweep_runs = [r for r in rows if r.get("matrix_group_id")]
    if not sweep_runs:
        return {"tiles": [], "swept_at": None}
    latest_group = sweep_runs[0].get("matrix_group_id")
    group_runs = [r for r in sweep_runs if r.get("matrix_group_id") == latest_group]
    tiles = [await _tile_for_run(supabase, r, user_id) for r in group_runs]
    swept_at = max((r.get("created_at") for r in group_runs if r.get("created_at")), default=None)
    return {"tiles": tiles, "swept_at": swept_at}


# ── POST — engine smoke sweep: the matrix machinery over the built-in SKILL-LESS fixture (D-01/D-02) ──
@router_evals.post("/engine-sweep")
async def run_engine_sweep(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
    pool: asyncpg.Pool = Depends(get_pg_pool),
):
    """Fan one representative model per configured provider over the BUILT-IN in-memory smoke fixture
    (EVAL-05a), riding the SAME matrix machinery as ``start_matrix_run``.

    The fixture is synthesized IN-MEMORY (``_SMOKE_SKILL_VERSION`` + ``_SMOKE_CASE``) and passed
    DIRECTLY to ``run_eval_job`` via its EXISTING ``skill_version`` + ``cases`` params — NO
    ``_read_cases`` / ``_read_latest_version``, NO rows in skills / skill_versions / skill_test_cases.
    Each arm's ``eval_runs`` row persists SKILL-LESS (``skill_id`` / ``skill_version_id`` NULL — mig
    085) with ``matrix_group_id`` set + ``feeds_gate=false`` (the gate is irrelevant to a sweep),
    owner-stamped from ``current_user``. The claim is a PER-USER sweep key
    (``eval_inflight:engine-sweep:{user_id}``) so a sweep never collides with a skill's eval claim
    (D-06 preserved, no per-skill 409 collateral). Local providers are excluded (D-01). Returns the
    refreshed engine-health board (the just-created group's arms, freshly running)."""
    user_id = current_user["id"]

    from app.models.user_settings import load_user_settings  # function-local (avoid import cycle)

    user_settings = await run_in_threadpool(load_user_settings, user_id)
    configs = _configured_provider_configs(
        user_settings, exclude_local=True, prefer_active_model=False
    )
    if not configs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No configured providers to run an engine sweep over",
        )

    # The sweep claim is SKILL-LESS — a per-user key so it never collides with a skill's eval claim.
    sweep_key = f"engine-sweep:{user_id}"
    group_id = uuid4()
    claimed = await redis.set(
        _inflight_key(sweep_key), str(group_id), nx=True, ex=_INFLIGHT_TTL_S
    )
    if not claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An engine sweep is already in progress",
        )

    arm_tasks: list = []
    try:
        for cfg in configs:
            run_id = uuid4()

            def _insert_eval_run(_cfg=cfg, _rid=run_id):
                return (
                    supabase.table("eval_runs")
                    .insert({
                        "id": str(_rid),
                        "skill_id": None,          # SKILL-LESS (mig 085 relaxation — D-02)
                        "skill_version_id": None,  # SKILL-LESS (mig 085 relaxation — D-02)
                        "user_id": user_id,
                        "provider": _cfg["provider"],
                        "model": _cfg["model"],
                        "status": "running",
                        "case_count": 1,
                        "matrix_group_id": str(group_id),
                        "feeds_gate": False,  # the gate is irrelevant to a sweep
                    })
                    .execute()
                )

            await run_in_threadpool(_insert_eval_run)
            task = await _spawn_eval_job(
                run_id=run_id,
                skill_id=sweep_key,  # synthetic JOB key (run_eval_job release/ZREM only) — row skill_id is NULL
                skill_version=dict(_SMOKE_SKILL_VERSION),
                cases=[dict(_SMOKE_CASE)],
                provider=cfg["provider"],
                model=cfg["model"],
                current_user=current_user,
                user_settings=user_settings,
                redis=redis,
                supabase=supabase,
                pool=pool,
            )
            arm_tasks.append(task)
    except Exception:
        if _spawn_group_release(redis, sweep_key, group_id, arm_tasks) is None:
            await eval_runner_service._release_inflight_if_owned(redis, sweep_key, group_id)
        raise

    _spawn_group_release(redis, sweep_key, group_id, arm_tasks)

    return await _build_engine_health_board(supabase, user_id)


# ── GET — the caller's latest engine-health board (D-03, on-demand; no cache, no scheduler) ──
@router_evals.get("/engine-health")
async def get_engine_health(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the caller's LATEST smoke-sweep board (``EngineHealthBoard`` — the Settings card's data
    source, D-03). Owner-scoped (it reads only the caller's sweep groups); another user's sweep is
    invisible; never-swept returns the honest empty board (``{tiles: [], swept_at: null}``, 200) — not
    a 404. ``healthy`` is derived SERVER-SIDE + honestly (completed + graded = healthy; failed /
    not_measured / judge_error render ``healthy=false`` with the VERBATIM provider error). On-demand
    only — no cache, no scheduler (D-04); the board itself displays staleness via ``swept_at``."""
    return await _build_engine_health_board(supabase, current_user["id"])


# ── GET — the SKILL-LESS run readout (makes every engine-health tile's run_id deep-link resolvable) ──
@router_evals.get("/runs/{run_id}")
async def get_eval_run_by_id(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the eval_run + its eval_results for ANY of the caller's runs BY ID — including NULL-skill
    sweep rows — with NO ``skill_id`` filter (D-03).

    The existing skill-scoped readout ``GET /skills/{skill_id}/evals/runs/{run_id}`` filters
    ``.eq("skill_id", skill_id)``, so a NULL-skill sweep row can NEVER match it — that is why this
    skill-less route exists: it makes every engine-health tile's ``run_id`` deep-link resolvable
    (Plan 10 consumes it via ``getEvalRunById``). Owner-scoped ``.eq("user_id")`` on BOTH reads,
    404-never-403 on a cross-user / missing run (T-133-01). Returns the SAME run+results shape as
    ``get_eval_run`` (including the caller's merged thumbs rating). All calls threadpool-wrapped
    (D-v2.5-01)."""
    user_id = current_user["id"]

    def _read_run():
        return (
            supabase.table("eval_runs")
            .select("*")
            .eq("id", str(run_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    run_rows = list((await run_in_threadpool(_read_run)).data or [])
    if not run_rows:
        # 404 (never 403) — don't leak the run's existence to another user (T-133-01).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval run not found")
    eval_run = run_rows[0]

    def _read_results():
        return (
            supabase.table("eval_results")
            .select("*")
            .eq("eval_run_id", str(run_id))
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )

    results = list((await run_in_threadpool(_read_results)).data or [])

    # Merge the caller's own thumbs rating onto each result (get_eval_run shape parity — EVAL-04).
    # A bounded (.in_) owner-scoped read, so it never over-fetches or drops this run's ratings.
    result_ids = {r["id"] for r in results}
    if result_ids:
        def _read_ratings():
            return (
                supabase.table("eval_ratings")
                .select("eval_result_id, rating")
                .eq("user_id", user_id)
                .in_("eval_result_id", list(result_ids))
                .execute()
            )

        rating_map = {
            row["eval_result_id"]: row["rating"]
            for row in ((await run_in_threadpool(_read_ratings)).data or [])
        }
        for r in results:
            r["rating"] = rating_map.get(r["id"])

    return {"eval_run": eval_run, "eval_results": results}
