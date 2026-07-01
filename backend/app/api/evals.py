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
from uuid import UUID, uuid4

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from supabase import Client

from app.config import get_model_capability
from app.db.runs import insert_run
from app.dependencies import get_current_user, get_pg_pool, get_redis, get_supabase
from app.models.eval_run import RateResultBody, StartEvalRunBody
from app.services import eval_runner_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skill-evals"])

# TTL on the Redis in-flight claim — generously above the longest bounded run so a
# crashed/killed worker that never reaches the job ``finally`` can't wedge a skill forever
# (mirrors skill_tuner._INFLIGHT_TTL_S).
_INFLIGHT_TTL_S = 1800


def _inflight_key(skill_id: str) -> str:
    """The atomic per-skill in-flight claim key (mirror eval_runner_service._inflight_key —
    the job ``finally`` CAS-releases this exact key)."""
    return f"eval_inflight:{skill_id}"


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
    # frontend can render current thumb state. A SECOND owner-scoped read (.eq user_id) —
    # mirrors the two-read owner-scoping above; the rating row is keyed by the globally-unique
    # eval_results.id so there is no cross-run bleed. Merged in Python onto this run's results;
    # None when the caller hasn't rated that answer. Do NOT change the run/results scoping.
    result_ids = {r["id"] for r in results}
    if result_ids:
        def _read_ratings():
            return (
                supabase.table("eval_ratings")
                .select("eval_result_id, rating")
                .eq("user_id", user_id)
                .execute()
            )

        ratings_resp = await run_in_threadpool(_read_ratings)
        rating_map = {
            row["eval_result_id"]: row["rating"]
            for row in (ratings_resp.data or [])
            if row.get("eval_result_id") in result_ids
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
