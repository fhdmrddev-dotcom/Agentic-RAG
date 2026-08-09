"""Admin operations — operator-gated backpressure + identity probe + audit feed.

Every route here inherits the router-level ``require_operator`` gate (Phase 146,
ADMIN-01): a non-operator JWT gets a byte-identical 404 on ALL of them — the
surface is non-discoverable (see tests/test_146_operator_gate.py). The gate lives
at the ROUTER level so a future /admin endpoint can never forget it; there is NO
RLS backstop (the backend runs on the service-role key), so this gate is the sole
authority.

Endpoints:
- GET /admin/backpressure — the four Phase-078 bottleneck signals + the Phase-147
  additive dependency-health block (D-078-06/08 additive-only); floor-EXEMPT (D-07 —
  the Control Plane auto-polls it, so logging every poll would spam the ledger).
- GET /admin/runs — cross-user active-runs list with honest kind badges (chat /
  workflow / eval / tuner, D-Q1 Option A no-migration) + a server-derived
  not_responding signal; floor-EXEMPT poll (D-07).
- GET /admin/me — operator identity probe; floor-EXEMPT (mount probes must not spam
  the ledger — Pitfall 4 / D-04).
- GET /admin/audit — recent operator actions feed for the Control Room ledger;
  audit-floor attached (viewing the ledger is itself a recorded action).
- POST /admin/control-plane/record — the ONE deliberate ledger row per Control Plane
  visit + per manual refresh (D-07); floor-ATTACHED, server-owned (label, action).
"""
import logging
from datetime import datetime
from typing import Literal
from uuid import UUID

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool
from supabase import Client

import app.dependencies as deps
from app.config import MODEL_CAPABILITIES, _infer_provider_for, settings
from app.dependencies import (
    get_redis,
    get_supabase,
    operator_audit_floor,
    require_operator,
)
from app.models.user_settings import (
    invalidate_model_overrides_cache,
    save_app_settings,
    set_feature_visibility,
)
from app.services import governance_service
from app.services.operator_service import (
    get_operator_record,
    get_recent_operator_audit,
    grant_operator,
    revoke_operator,
)

logger = logging.getLogger(__name__)

# Kill is wired day-one for chat + workflow only (D-01); eval/tuner are bounded internal
# jobs that end on their own (no operator-side cancel this phase).
_KILLABLE_KINDS = {"chat", "workflow"}

# FLAG-01 (T-147-01): the code-constant kill-switch allowlist — the ONLY keys PUT
# /admin/flags may write. A client-supplied column name must NEVER reach
# save_app_settings' SET clause (which interpolates the column name into SQL). These
# are the five booleans added to main._DIRECT_COLUMNS (mig 097 added the last three).
# Keyed by human name so the audit label is plain-language (LANG-01, born plain).
_FLAG_HUMAN_NAMES = {
    "web_search_enabled": "web search",
    "sandbox_enabled": "code sandbox",
    "self_improve_enabled": "self-improvement",
    "workflows_enabled": "workflows",
    "maintenance_mode": "maintenance mode",
    # Phase 159 (MODEL-03 / D-159-04 write half): the persisted discovery-filter toggle rides
    # the existing PUT /admin/flags path with ZERO new endpoint code — this one allowlist entry
    # auto-includes the key in _FLAG_KEYS so set_flag accepts + routes it via save_app_settings.
    # The app_settings column it writes is created by Plan 03's migration 103 (the readback is
    # fail-soft until then — this Wave-1 plan lands AHEAD of the operator-applied migration).
    "model_discovery_filter_enabled": "model discovery filter",
}
_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)

# ── Phase 148 (ADMIN-03 / VIS-01) constants ───────────────────────────────────
# The GoTrue "indefinite" ban literal. Go's time.ParseDuration largest unit is
# HOURS (day/year units are REJECTED — Pitfall 2), so ~100y == "876600h". "none"
# lifts the ban (GoTrue nulls auth.users.banned_until).
_INDEFINITE_BAN = "876600h"

# Terminal run statuses — mirrors run_lifecycle._cancel_run_internals Step 2. A
# victim's runs in any OTHER state are in-flight and are cancelled on disable via
# the SHARED cancel helper (reuse, never re-implement — D-062 discipline).
_TERMINAL_RUN_STATUSES = ("completed", "failed", "cancelled", "timed_out")

# PUT /admin/visibility code allowlists (T-148-03). feature + audience are validated
# against these code constants BEFORE any write — never free text (SQLi-safe, mirrors
# set_flag's _FLAG_KEYS guard). Audience is an enum VALUE, never a boolean (the
# SEED-115 forward-compat contract that keeps the v3.4 roles path open).
_VISIBILITY_FEATURES = {
    "skill_studio",
    "model_management",
    "workflow_authoring",
    "governance_health",
    # Phase 181 (REVERT-01 / T-181-03): the v3.6 canvas flag is operator-writable through
    # the SAME allowlisted PUT /admin/visibility path (Off = "off", On = "everyone").
    "visual_workflow_canvas",
    # Phase 190 (CONN-03 / D-26): the live-connector kill-switch rides the SAME allowlisted
    # PUT /admin/visibility path (Off = "off", On = "everyone"), for the SAME reason Phase
    # 181 chose it — ZERO migrations. CONTEXT D-26 names the /admin/flags allowlist above
    # while citing this very precedent; measured, `visual_workflow_canvas` has always lived
    # HERE, and the flags path writes an app_settings BOOLEAN COLUMN (= a migration 118 this
    # phase does not owe). Cold default "off" lives in user_settings._GOVERNED_FEATURES;
    # test_190_connectors_api.py asserts membership here AND absence from _FLAG_HUMAN_NAMES,
    # so a later move that silently owes a column fails loudly instead of reading False.
    "live_connectors",
}
# Phase 167 (VIS-01 / D-167-06): the audience enum extends to "role" (zero migration — the
# mig-098 JSONB shape). A "role" write also carries a roles[] greenlist validated against the
# 4-tier set (mig 104 CHECK) BEFORE the write — a free-text role must NEVER reach the JSONB
# codec (SQLi-safe, mirrors the feature allowlist above).
# Phase 181 (T-181-03): "off" joins the write-allowlist so an operator can flip the canvas
# hidden; a crafted off-allowlist audience still 400s BEFORE any JSONB write (SQLi-safe).
_VISIBILITY_AUDIENCES = {"everyone", "operators", "role", "off"}
_VISIBILITY_ROLES = {"super-admin", "org-admin", "dept-admin", "member"}

# Phase 149 (MODEL-01 / T-149-11): the ONLY columns a capability PATCH may write — the
# seven editable columns of model_capabilities_overrides. A client-supplied field name
# must NEVER reach the upsert's column list (which interpolates names into SQL). An
# unknown key → 422 BEFORE any DB touch (mirrors set_flag's _FLAG_KEYS guard); the upsert
# values are parameterized $N binds — no client field name reaches a SET clause (Pattern 2).
_MODEL_CAP_COLUMNS = {
    "llm_call_timeout_seconds",
    "context_window_tokens",
    "max_output_tokens",
    "native_tools",
    "enabled",
    "deprecated",
    "deprecated_reason",
}

# Phase 149 (WR-01): the per-column value-type contract for the PATCH write. A wrong-typed
# value is rejected 422 BEFORE any DB touch (never a 500 from an asyncpg type error). bool is
# a subclass of int in Python, so the int columns reject a bool EXPLICITLY — which also makes
# the ``enabled is False`` disable guard safe (a non-bool ``enabled`` can never slip past as a
# falsy value). ``deprecated_reason`` is the lone str-or-null column; every column also
# accepts an explicit ``null`` (a Reset that clears the override to DEF).
_MODEL_CAP_INT_COLUMNS = {
    "llm_call_timeout_seconds",
    "context_window_tokens",
    "max_output_tokens",
}
_MODEL_CAP_BOOL_COLUMNS = {"native_tools", "enabled", "deprecated"}

# The single load-bearing security line: default-deny at the router (Pattern 1).
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_operator)],
)


@router.get("/backpressure")
async def get_backpressure():
    """Return worker backpressure metrics + dependency-health for the ops dashboard.

    D-078-06: four signals — anyio_threadpool_depth, redis_active_runs,
    postgres_pool_in_use, per_worker_run_count.
    D-078-08: JSON shape is additive-only — Phase 147 (ADMIN-02) APPENDS a top-level
    ``dependencies`` block (redis / supabase / sandbox reachability + latency + the
    3-state sandbox) WITHOUT touching the four original keys.

    Phase 147 D-07: this endpoint is now floor-EXEMPT (the ``operator_audit_floor``
    dependency + the audit_label/action lines are REMOVED). The Control Plane
    auto-polls it every ~10s while open; recording every poll would spam the ledger
    with non-actions. The ONE deliberate "Viewed system health" ledger row is written
    by ``POST /admin/control-plane/record`` on a manual refresh instead. The
    ``GET /admin/me`` no-floor probe is the exempt precedent.
    """
    # 1. AnyIO thread-pool depth
    limiter = anyio.to_thread.current_default_thread_limiter()
    anyio_borrowed = limiter.borrowed_tokens
    anyio_total = limiter.total_tokens

    # 2. Redis -- ZCARD runs:active sorted set (Phase 061+ convention)
    redis_active_runs = 0
    try:
        redis_active_runs = await get_redis().zcard("runs:active")
    except Exception as exc:
        logger.warning("backpressure: Redis unreachable, reporting 0: %s", type(exc).__name__)

    # 3. asyncpg pool -- in-use connections.
    # CR-02: read the pool via the LIVE module attribute (deps._pg_pool), NOT a
    # from-import snapshot. `from app.dependencies import _pg_pool` copies the
    # binding at import time (when the singleton is still None); get_pg_pool()
    # later rebinds app.dependencies._pg_pool, but the copied name stays None
    # forever, so this signal was structurally always 0 in production.
    pool = deps._pg_pool
    pg_in_use = 0
    if pool is not None:
        try:
            pg_in_use = pool.get_size() - pool.get_idle_size()
        except Exception:
            pass

    # 4. RUN_TASKS -- active producer tasks (late-bind import, avoids circular at module load)
    try:
        from app.api.threads import RUN_TASKS
        per_worker_run_count = len(RUN_TASKS)
    except ImportError:
        per_worker_run_count = 0

    # 5. Dependency-health probes (Phase 147 ADMIN-02) — ADDITIVE, concurrent,
    # best-effort (each degrades to down/off; never raises out of the endpoint).
    from app.services.health_probe import probe_dependencies
    dependencies = await probe_dependencies()

    # 6. Secrets at-rest encryption state (Phase 150 SEC-01, D-150-02) — ADDITIVE,
    # best-effort. encryption_status() MUST be fed the RAW (ciphertext) app_settings
    # row from _load_settings_from_db() — the 30s-cached row holding CIPHERTEXT —
    # NOT the decrypted load_app_settings()/_build_settings_from_row(), which would
    # misread every already-decrypted value as lingering plaintext. Same posture as
    # the dependency probes: a failed raw-row load (or a defensive cipher error) can
    # NEVER raise out of the health endpoint — it degrades to the plaintext state.
    from app.models.user_settings import _load_settings_from_db
    from app.security.secret_cipher import encryption_status
    try:
        raw_settings_row = await _load_settings_from_db()
        secrets_encryption = encryption_status(raw_settings_row)
    except Exception as exc:
        logger.warning(
            "backpressure: secrets_encryption unavailable, reporting plaintext: %s",
            type(exc).__name__,
        )
        secrets_encryption = {"state": "plaintext"}

    return {
        "anyio_threadpool_depth": {
            "borrowed": anyio_borrowed,
            "total": anyio_total,
        },
        "redis_active_runs": redis_active_runs,
        "postgres_pool_in_use": pg_in_use,
        "per_worker_run_count": per_worker_run_count,
        "dependencies": dependencies,
        "secrets_encryption": secrets_encryption,
    }


def _uuid_list(ids):
    """Coerce an iterable of id strings to ``uuid.UUID`` for a ``$1::uuid[]`` param.

    The codebase's asyncpg array pattern passes ``UUID`` objects (harness/freshness.py).
    A non-UUID member (shouldn't happen — all run/thread/user ids are uuid4) is dropped
    rather than raising, so one bad id never sinks the whole enrichment query.
    """
    import uuid as _uuid

    out = []
    for i in ids:
        try:
            out.append(_uuid.UUID(str(i)))
        except (ValueError, AttributeError, TypeError):
            continue
    return out


async def _derive_not_responding(redis, run_id, stale_timeout_ms, started_at, grace_ms) -> bool:
    """Server-derived stalled-stream signal for a chat/workflow run (RESEARCH Open Q3).

    REUSES the reconciler's stream-age oracle (``run_reconciler._is_chat_orphan`` — the
    ``run:{run_id}`` last-write-age check with its start-grace) READ-ONLY: no edit to
    run_reconciler.py, no re-derivation of the age math. A run inside the start-grace,
    or a fresh stream, is not stalled → False; a missing/stale stream past grace → True.
    Any failure to VERIFY liveness (a real Redis fault the oracle re-raises) degrades to
    False — we never paint a false "not responding" tag on a transient hiccup.
    """
    try:
        from app.services.run_reconciler import _is_chat_orphan

        return bool(
            await _is_chat_orphan(redis, run_id, stale_timeout_ms, started_at, grace_ms)
        )
    except Exception:
        return False


@router.get("/runs")
async def get_active_runs():
    """Cross-user active-runs list with honest kind badges — floor-EXEMPT (D-07).

    D-Q1 (Option A, NO migration): ZRANGE ``runs:active`` WITHSCORES → batch-enrich the
    ids that HAVE a ``runs`` row (chat / workflow / eval); the ids with NO ``runs`` row
    are tuner jobs (Redis-only writer). Split the enriched rows: eval when
    ``eval_runs.id`` == run_id (the companion row shares the UUID); workflow when the
    run's thread carries an ``active_workflow_run_id``; chat otherwise.

    ``killable`` is true ONLY for chat + workflow (D-01). ``started_at`` is the ZRANGE
    score (unix epoch) — the client computes elapsed (D-07, no server ticking).
    ``not_responding`` is server-derived for chat/workflow via the reconciler oracle;
    eval/tuner rows are always false. Cross-user reads are METADATA ONLY — user/model/
    elapsed, never thread contents (sketch linkage rule #11). The router gate is the
    sole authority (byte-identical 404 to non-operators; no RLS backstop).
    """
    redis = get_redis()
    try:
        entries = await redis.zrange("runs:active", 0, -1, withscores=True)
    except Exception as exc:
        logger.warning("active-runs: Redis unreachable (%s), returning empty", type(exc).__name__)
        return {"runs": []}
    if not entries:
        return {"runs": []}

    # started_at per active run (unix epoch score → client elapsed math, D-07)
    started_by_id: dict[str, float] = {}
    for member, score in entries:
        rid = member.decode() if isinstance(member, (bytes, bytearray)) else member
        started_by_id[rid] = float(score)
    active_ids = list(started_by_id.keys())

    pool = deps._pg_pool  # CR-02: live module attribute, never an import snapshot
    runs_by_id: dict[str, object] = {}
    eval_ids: set[str] = set()
    workflow_thread_ids: set[str] = set()
    email_by_user: dict[str, str] = {}

    if pool is not None:
        # 1. Batch-enrich the ids that have a runs row (chat/workflow/eval).
        try:
            rows = await pool.fetch(
                "SELECT run_id, thread_id, user_id, model, provider, status, started_at "
                "FROM runs WHERE run_id = ANY($1::uuid[])",
                _uuid_list(active_ids),
            )
            for r in rows:
                runs_by_id[str(r["run_id"])] = r
        except Exception:
            logger.exception("active-runs: runs enrichment failed (continuing)")

        if runs_by_id:
            row_ids = list(runs_by_id.keys())
            thread_ids = [str(r["thread_id"]) for r in runs_by_id.values() if r["thread_id"]]
            user_ids = [str(r["user_id"]) for r in runs_by_id.values() if r["user_id"]]

            # 2. Eval detection — eval_runs.id doubles as the companion run_id.
            try:
                eval_rows = await pool.fetch(
                    "SELECT id FROM eval_runs WHERE id = ANY($1::uuid[])", _uuid_list(row_ids)
                )
                eval_ids = {str(e["id"]) for e in eval_rows}
            except Exception:
                logger.exception("active-runs: eval detection failed (continuing)")

            # 3. Workflow detection — a run whose thread has an active workflow run.
            if thread_ids:
                try:
                    wf_rows = await pool.fetch(
                        "SELECT id FROM threads WHERE active_workflow_run_id IS NOT NULL "
                        "AND id = ANY($1::uuid[])",
                        _uuid_list(thread_ids),
                    )
                    workflow_thread_ids = {str(w["id"]) for w in wf_rows}
                except Exception:
                    logger.exception("active-runs: workflow detection failed (continuing)")

            # 4. user_email enrichment (metadata only — linkage rule #11; never content).
            if user_ids:
                try:
                    user_rows = await pool.fetch(
                        "SELECT id, email FROM auth.users WHERE id = ANY($1::uuid[])",
                        _uuid_list(user_ids),
                    )
                    email_by_user = {str(u["id"]): u["email"] for u in user_rows}
                except Exception:
                    logger.exception("active-runs: user email enrichment failed (continuing)")

    stale_timeout_ms = settings.run_stale_sweep_timeout_seconds * 1000
    grace_ms = settings.run_start_grace_seconds * 1000

    runs_out = []
    for rid in active_ids:
        row = runs_by_id.get(rid)
        started_at = started_by_id.get(rid)

        if row is None:
            # No runs row → tuner (Redis-only writer). No Kill (D-01); generic label.
            runs_out.append({
                "run_id": rid,
                "kind": "tuner",
                "thread_id": None,
                "user_id": None,
                "user_email": None,
                "model": None,
                "provider": None,
                "started_at": started_at,
                "killable": False,
                "not_responding": False,
            })
            continue

        if rid in eval_ids:
            kind = "eval"
        elif str(row["thread_id"]) in workflow_thread_ids:
            kind = "workflow"
        else:
            kind = "chat"

        not_responding = False
        if kind in _KILLABLE_KINDS:
            not_responding = await _derive_not_responding(
                redis, rid, stale_timeout_ms, row["started_at"], grace_ms
            )

        uid = str(row["user_id"]) if row["user_id"] else None
        runs_out.append({
            "run_id": rid,
            "kind": kind,
            "thread_id": str(row["thread_id"]) if row["thread_id"] else None,
            "user_id": uid,
            "user_email": email_by_user.get(uid) if uid else None,
            "model": row["model"],
            "provider": row["provider"],
            "started_at": started_at,
            "killable": kind in _KILLABLE_KINDS,
            "not_responding": not_responding,
        })

    return {"runs": runs_out}


@router.post("/runs/{run_id}/kill", status_code=status.HTTP_204_NO_CONTENT)
async def kill_run(
    run_id: UUID,
    request: Request,
    supabase: Client = Depends(get_supabase),
    _floor: None = Depends(operator_audit_floor),
):
    """Operator Kill — cancel ANY user's chat/workflow run (ADMIN-02 / D-02 / D-03).

    The ONLY difference from the owner-scoped ``cancel_run`` is the missing ownership
    filter (D-02): the SELECT here carries NO ``user_id`` predicate, so it reaches any
    user's run — but a MISSING run still 404s (non-discoverable, T-147-04). The
    ownership skip is legitimate ONLY behind this ``require_operator`` router gate
    (T-147-06 — the shared helper makes no privileged decision). Internal jobs
    (eval/tuner, D-01) are refused with a plain 409 — they end on their own, no Kill.

    The cancel itself DELEGATES to the SHARED ``_cancel_run_internals`` so the D-062
    zombie-heal discipline never drifts. The audit label names the victim + model
    (064-B) — but a zombie-heal OUTCOME reads "Recovered a stuck run", never "killed"
    (064-B honesty; the verb is derived from which sub-path fired). The victim sees
    exactly a self-cancel; who/why lives ONLY in ``operator_audit_log`` (D-03 — no
    operator attribution reaches anything the victim reads). Floor-attached.
    """
    pool = deps._pg_pool  # CR-02: live module attribute, never an import snapshot
    if pool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # Operator-scoped SELECT — NO ``.eq(user_id)`` (the ENTIRE D-02 difference). Fetch
    # ANY user's row (for victim naming); still 404-non-discoverable on a missing id.
    try:
        run_rows = await pool.fetch(
            "SELECT run_id, status, thread_id, user_id, model, provider "
            "FROM runs WHERE run_id = $1",
            run_id,
        )
    except Exception:
        logger.exception("kill_run: runs SELECT failed for %s", run_id)
        run_rows = []
    row = run_rows[0] if run_rows else None
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # D-01: refuse internal jobs. An eval companion run shares its UUID with
    # ``eval_runs.id`` (the D-Q1 derivation plan 02's /admin/runs uses); a tuner job has
    # no ``runs`` row at all so it never reaches here (it 404'd above).
    try:
        eval_rows = await pool.fetch("SELECT id FROM eval_runs WHERE id = $1", run_id)
    except Exception:
        logger.exception("kill_run: eval detection failed for %s (continuing)", run_id)
        eval_rows = []
    if eval_rows:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This is an internal evaluation job — it finishes on its own and "
                "can't be stopped by hand."
            ),
        )

    # Victim naming (metadata ONLY — linkage rule #11; never thread contents).
    model = row["model"]
    victim = "a user"
    if row["user_id"] is not None:
        try:
            user_rows = await pool.fetch(
                "SELECT email FROM auth.users WHERE id = $1", row["user_id"]
            )
            if user_rows and user_rows[0]["email"]:
                victim = user_rows[0]["email"]
        except Exception:
            logger.exception("kill_run: victim email enrichment failed (continuing)")

    # Delegate to the SHARED cancel/zombie-heal discipline — WITHOUT the ownership
    # filter (which we deliberately skipped above). Nothing operator-identifying is
    # passed: the victim's run finalizes to the ordinary cancelled/cancelled_by_user
    # terminal state, identical to a self-cancel (D-03).
    from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415

    outcome = await _cancel_run_internals(
        run_id=run_id,
        status=row["status"],
        thread_id=str(row["thread_id"]) if row["thread_id"] else None,
        redis=get_redis(),
        supabase=supabase,
    )

    # 064-B honesty: a zombie-heal reads "Recovered a stuck run", a live cancel "Ended
    # {victim}'s run". Both record action ``run.kill``. Who/why lives ONLY here.
    if outcome == "zombie_healed":
        request.state.audit_label = f"Recovered a stuck run on {model}"
    else:
        request.state.audit_label = f"Ended {victim}'s run on {model}"
    request.state.audit_action = "run.kill"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class FlagUpdate(BaseModel):
    """Body for PUT /admin/flags. ``key`` is validated against the code-constant
    allowlist in the handler (T-147-01); ``value`` is a strict bool."""

    key: str
    value: bool


@router.put("/flags", status_code=status.HTTP_204_NO_CONTENT)
async def set_flag(
    request: Request,
    body: FlagUpdate,
    _floor: None = Depends(operator_audit_floor),
):
    """Write ONE validated kill-switch through ``save_app_settings`` (FLAG-01).

    T-147-01: ``key`` MUST be one of the code-constant flag names (``_FLAG_KEYS``) — a
    client-supplied column name must NEVER reach ``save_app_settings``' SET clause, which
    interpolates the column name into SQL. An unknown key → 422 (never a write). The
    value is a bool (Pydantic). ``save_app_settings`` issues the parameterized UPDATE and
    invalidates the per-worker TTL cache (the flag takes effect within the ~30s window —
    the "on their next call" copy). Floor-attached: ``flag.<key>.<on|off>`` (except
    ``maintenance_mode`` → ``maintenance.set``, 066 linkage), plain-language label.
    """
    if body.key not in _FLAG_KEYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown flag key: {body.key}",
        )

    # CR-02: save_app_settings SWALLOWS every DB-write exception and returns a bool.
    # A False result means the flip did NOT persist (pool exhausted / transient blip /
    # connection reset). Surface that as a real 500 — NEVER a false 204 — and do it
    # BEFORE any success audit_label is set, so the honest ledger never records a
    # kill-switch flip that did not happen (the whole point of this phase). We also
    # stamp an explicit failure action/label onto request.state: the operator_audit_floor
    # teardown runs after the yield and, on FastAPI >=0.106, a raised HTTPException is
    # re-thrown INTO the floor at its (un-try/except'd) `yield` — so the floor SKIPS its
    # write entirely on this path and records nothing. Stamping the error state is
    # belt-and-braces: if the floor is ever changed to record on exceptions, it records a
    # truthful "failed to persist" row, never a false success.
    if not await save_app_settings({body.key: body.value}):
        request.state.audit_action = "flag.write_failed"
        request.state.audit_label = (
            f"Flag change for {_FLAG_HUMAN_NAMES[body.key]} failed to persist"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not persist the flag — it was not changed.",
        )

    on = "ON" if body.value else "OFF"
    if body.key == "maintenance_mode":
        request.state.audit_action = "maintenance.set"
        request.state.audit_label = f"Turned {on} maintenance mode"
    else:
        request.state.audit_action = f"flag.{body.key}.{'on' if body.value else 'off'}"
        request.state.audit_label = f"Turned {on} {_FLAG_HUMAN_NAMES[body.key]} for everyone"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class ControlPlaneRecord(BaseModel):
    """Body for POST /admin/control-plane/record — the event is a server-owned enum.

    T-147-13: the client supplies ONLY this Literal; the server owns the (label, action)
    mapping, so no free-text action/label string ever reaches operator_audit_log.
    """

    event: Literal["visit", "refresh"]


# Server-owned event → (audit label, audit action). The ONLY strings that reach the
# ledger for a Control Plane read (D-07): the deliberate visit row + the manual ↻ row.
_RECORD_MAP = {
    "visit": ("Opened the Control Plane", "control_plane.visit"),
    "refresh": ("Viewed system health", "health.view"),
}


@router.post("/control-plane/record", status_code=status.HTTP_204_NO_CONTENT)
async def record_control_plane_event(
    request: Request,
    body: ControlPlaneRecord,
    _floor: None = Depends(operator_audit_floor),
):
    """Write the ONE deliberate ledger row per Control Plane visit / manual refresh (D-07).

    The poll GETs (``/backpressure``, ``/runs``) are floor-EXEMPT; this floor-ATTACHED
    endpoint is how the ledger stays an honest record of deliberate human actions. The
    event is a Pydantic ``Literal`` (unknown → 422); the server maps it to a hardcoded
    (label, action). ``is_write=False`` — these are reads (receipts), not mutations.
    """
    label, action = _RECORD_MAP[body.event]
    request.state.audit_label = label
    request.state.audit_action = action
    request.state.audit_is_write = False
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
async def get_operator_me(request: Request):
    """Operator identity probe — floor-EXEMPT (Pitfall 4).

    The router gate already 404'd non-operators; operators get their identity
    ``{id, email, granted_at}`` for the Control Room band. NO operator_audit_floor
    attached — the frontend probes this on EVERY app mount, and logging it would
    fill the ledger with non-actions (D-04: every ledger row is a deliberate human
    action).
    """
    op = request.state.operator  # set by require_operator (router gate)
    record = await get_operator_record(op["id"])
    granted_at = record.get("granted_at") if record else None
    return {"id": op["id"], "email": op["email"], "granted_at": granted_at}


@router.get("/audit")
async def get_operator_audit_feed(
    request: Request,
    limit: int = 50,
    _floor: None = Depends(operator_audit_floor),
):
    """Recent operator actions feed for the Control Room ledger card.

    Reads the latest N ``operator_audit_log`` rows (created_at DESC). Floor-attached —
    viewing the ledger is itself a recorded operator action (plain label "Viewed
    recent actions" / action "audit.view").
    """
    request.state.audit_label = "Viewed recent actions"
    request.state.audit_action = "audit.view"
    entries = await get_recent_operator_audit(limit=limit)
    return {"entries": entries}


# ══════════════════════════════════════════════════════════════════════════════
# Phase 148 (ADMIN-03) — platform audit browse + capped CSV export
# ══════════════════════════════════════════════════════════════════════════════
#
# These are the SC#4 no-RLS-backstop cross-user READS. The query/scope/cap safety
# lives in governance_service (148-04, parameterized $N binds, page_size ≤ 100,
# COUNT-first refuse-over-50000); here the controller is thin: delegate + RECORD.
# Both are floor-ATTACHED with audit_is_write=False and SERVER-OWNED labels — a
# cross-user read is NEVER silent (T-148-01).


def _describe_audit_filter(
    user_id: str | None,
    action_types: list[str] | None,
    since: datetime | None,
    until: datetime | None,
) -> str:
    """A short, plain-language summary of the active filter for the audit.export label."""
    parts = ["one user" if user_id else "all users"]
    if action_types:
        n = len(action_types)
        parts.append(f"{n} action type{'s' if n != 1 else ''}")
    if since or until:
        parts.append("date range")
    return ", ".join(parts)


@router.get("/platform-audit")
async def browse_platform_audit(
    request: Request,
    user_id: str | None = None,
    action_type: list[str] | None = Query(default=None),
    since: datetime | None = None,
    until: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
    _floor: None = Depends(operator_audit_floor),
):
    """Cross-user platform ``audit_log`` browse — a RECORDED read (SC#4, no RLS backstop).

    ``user_id`` NULL = the deliberate all-users read; a value = single-user scope.
    ``action_type`` is a repeatable query param (text[] ANY); ``since``/``until`` a
    half-open window. Pagination is 1-based (``page``); the service clamps ``page_size``
    ≤ 100 so the response is never larger than one page (no full-tenant leak). The
    query/scope/cap safety is entirely in ``governance_service.query_platform_audit`` —
    this controller only delegates + records the ``audit.view_platform`` floor row
    (``audit_is_write=False``, a read receipt with a server-owned label, never client
    text).
    """
    request.state.audit_label = "Viewed platform activity"
    request.state.audit_action = "audit.view_platform"
    request.state.audit_is_write = False

    page = max(1, page)
    offset = (page - 1) * max(1, page_size)
    rows = await governance_service.query_platform_audit(
        user_id=user_id,
        action_types=action_type,
        since=since,
        until=until,
        page_size=page_size,
        offset=offset,
    )
    return {
        "entries": rows,
        "page": page,
        "page_size": page_size,
        "has_more": len(rows) == page_size,
    }


@router.get("/platform-audit/export")
async def export_platform_audit(
    request: Request,
    user_id: str | None = None,
    action_type: list[str] | None = Query(default=None),
    since: datetime | None = None,
    until: datetime | None = None,
    _floor: None = Depends(operator_audit_floor),
):
    """Export EXACTLY the filtered platform ``audit_log`` set as CSV — capped, recorded.

    Delegates to ``governance_service.export_platform_audit_csv`` (COUNT-first; refuses
    over 50 000 rows rather than silently truncating). On SUCCESS it records ONE
    ``audit.export`` floor row naming the EXACT row count. On the over-cap REFUSE it maps
    the domain ``AuditExportTooLarge`` to a 413 and records NOTHING — the audit state is
    stamped ONLY after the count is known, and the raised exception is re-thrown into the
    floor's ``yield`` so its post-yield write is skipped entirely (same discipline as
    ``set_flag``'s failure path). A refused export therefore leaves no receipt (T-148-01).
    """
    try:
        stream, count = await governance_service.export_platform_audit_csv(
            user_id=user_id,
            action_types=action_type,
            since=since,
            until=until,
        )
    except governance_service.AuditExportTooLarge as exc:
        # Over-cap: refuse (never truncate) — 413, and NO audit.export receipt. The
        # audit_* state below is never reached, and the floor skips its write.
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Too many rows ({exc.count}) — narrow the filter.",
        )

    summary = _describe_audit_filter(user_id, action_type, since, until)
    request.state.audit_label = f"Exported {count} audit entries ({summary})"
    request.state.audit_action = "audit.export"
    request.state.audit_is_write = False
    return stream


# ══════════════════════════════════════════════════════════════════════════════
# Phase 148 (ADMIN-03) — users roster + disable (ban + in-flight cancel) + enable
# ══════════════════════════════════════════════════════════════════════════════


async def _lookup_user_email(user_id) -> str:
    """Best-effort victim naming (metadata only — linkage rule #11; never content).

    Returns the target's ``auth.users.email`` for a plain-sentence audit label; falls
    back to ``"a user"`` on a missing pool / miss / any read error (naming must never
    sink the action). Reads via the LIVE ``deps._pg_pool`` attribute (never an import
    snapshot — CR-02).
    """
    pool = deps._pg_pool
    if pool is None:
        return "a user"
    try:
        row = await pool.fetchrow("SELECT email FROM auth.users WHERE id = $1", user_id)
        if row and row["email"]:
            return row["email"]
    except Exception:
        logger.exception("user email lookup failed for %s", user_id)
    return "a user"


async def _cancel_inflight_runs(user_id, supabase) -> int:
    """Cancel the victim's in-flight runs on disable — REUSING the shared cancel helper.

    Looks up the victim's non-terminal ``runs`` rows (any status not in
    ``_TERMINAL_RUN_STATUSES``) and delegates each to the SHARED
    ``run_lifecycle._cancel_run_internals`` — the same D-062 zombie-heal discipline the
    operator Kill path uses, never re-implemented. Best-effort per run: one bad row never
    sinks the disable. Returns the number of runs handed to the cancel helper.
    """
    pool = deps._pg_pool
    if pool is None:
        return 0
    try:
        rows = await pool.fetch(
            "SELECT run_id, status, thread_id FROM runs "
            "WHERE user_id = $1 AND status <> ALL($2::text[])",
            user_id,
            list(_TERMINAL_RUN_STATUSES),
        )
    except Exception:
        logger.exception("disable: active-runs lookup failed for %s", user_id)
        return 0
    if not rows:
        return 0

    from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415

    cancelled = 0
    for row in rows:
        rid = row["run_id"]
        try:
            await _cancel_run_internals(
                run_id=rid,
                status=row["status"],
                thread_id=str(row["thread_id"]) if row["thread_id"] else None,
                redis=get_redis(),
                supabase=supabase,
            )
            cancelled += 1
        except Exception:
            logger.exception("disable: cancel of run %s failed (continuing)", rid)
    return cancelled


@router.get("/users")
async def list_users(page: int = 1, page_size: int = 50):
    """Users roster — honest last-active + doc/chat counts + operator role. Floor-EXEMPT.

    Poll-style read (the ``/runs`` precedent, D-07): the UsersAndAccess table re-fetches,
    so recording every poll would spam the ledger. 1-based pagination; the service clamps
    ``page_size`` ≤ 100. Delegates to ``governance_service.list_users_roster`` (one join,
    never fabricated last-active). Cross-user read behind the router gate (no RLS backstop).
    """
    page = max(1, page)
    offset = (page - 1) * max(1, page_size)
    rows = await governance_service.list_users_roster(page_size=page_size, offset=offset)
    return {"users": rows, "page": page, "page_size": page_size}


@router.post("/users/{user_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(
    user_id: UUID,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Disable a user — GoTrue ban + in-flight run cancel + a recorded ``user.disable``.

    Self-guard FIRST (Pitfall 7 — self-lockout): if ``user_id`` is the acting operator's
    own id, refuse ``409`` BEFORE any mutation. Then ban via the GoTrue admin API with the
    EXACT indefinite literal ``"876600h"`` (day/year units are rejected — Pitfall 2),
    wrapped in ``run_in_threadpool`` (supabase-py is blocking httpx — D-v2.5-01). Then cancel
    the victim's in-flight runs via the SHARED ``_cancel_run_internals`` (reuse, never
    re-implement). The floor row carries the 064-B victim-naming label + ``user.disable``.
    The app-layer ban check in ``get_current_user`` (148-02) closes the live-JWT window.
    """
    acting_id = request.state.operator["id"]  # set by require_operator (router gate)
    if str(user_id) == str(acting_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot disable yourself.",
        )

    sb = get_supabase()
    await run_in_threadpool(
        lambda: sb.auth.admin.update_user_by_id(
            str(user_id), {"ban_duration": _INDEFINITE_BAN}
        )
    )

    victim = await _lookup_user_email(user_id)
    await _cancel_inflight_runs(user_id, sb)

    request.state.audit_label = f"Disabled {victim}'s account"
    request.state.audit_action = "user.disable"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/{user_id}/enable", status_code=status.HTTP_204_NO_CONTENT)
async def enable_user(
    user_id: UUID,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Re-enable a user — lift the GoTrue ban and record a ``user.enable`` row.

    ``ban_duration="none"`` nulls ``auth.users.banned_until`` (GoTrue). Restorative +
    direct: NO in-flight cancel, NO self-guard (re-enabling yourself is harmless). The
    blocking admin call rides ``run_in_threadpool`` (D-v2.5-01). Floor row: the 064-B
    plain-sentence label + ``user.enable``.
    """
    sb = get_supabase()
    await run_in_threadpool(
        lambda: sb.auth.admin.update_user_by_id(str(user_id), {"ban_duration": "none"})
    )

    victim = await _lookup_user_email(user_id)
    request.state.audit_label = f"Re-enabled {victim}'s account"
    request.state.audit_action = "user.enable"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# Phase 148 (ADMIN-03 / D-01, VIS-01) — operator grant/revoke + visibility set
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/users/{user_id}/operator", status_code=status.HTTP_204_NO_CONTENT)
async def grant_operator_access(
    user_id: UUID,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Grant operator access (D-01) — delegates to ``operator_service.grant_operator``.

    The service INSERTs ``operator_users`` populating ``granted_by`` = the acting operator
    (mig 095 provenance), idempotent via ``ON CONFLICT DO UPDATE``. Floor row: a
    plain-sentence ``operator.grant`` naming the grantee.
    """
    acting_id = request.state.operator["id"]
    await grant_operator(str(user_id), acting_id)

    email = await _lookup_user_email(user_id)
    request.state.audit_label = f"Granted operator access to {email}"
    request.state.audit_action = "operator.grant"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/users/{user_id}/operator", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_operator_access(
    user_id: UUID,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Revoke operator access — delegates to ``operator_service.revoke_operator``.

    The service refuses a self-revoke with ``409`` BEFORE any DELETE (lockout-proof —
    Pitfall 7; the server is the wall, not the UI tooltip). The person keeps their normal
    account (only the membership row is removed); past ``operator_audit_log`` history is
    untouched. Floor row: ``operator.revoke`` naming the target.
    """
    acting_id = request.state.operator["id"]
    email = await _lookup_user_email(user_id)  # name the target before the delete
    await revoke_operator(str(user_id), acting_id)  # raises 409 on self BEFORE any mutation

    request.state.audit_label = f"Revoked {email}'s operator access"
    request.state.audit_action = "operator.revoke"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/visibility")
async def get_visibility():
    """Read the persisted per-feature audience + greenlist map (WR-05 — server truth).

    The Control Room previously seeded its visibility/greenlist UI from client defaults, so an
    operator saw the DEFAULT audience (not the persisted one) after any reload — display
    dishonesty on a security-governance surface. This returns the CURRENT audience (cold-default
    aware, via ``feature_audience``) + greenlisted ``roles`` for every governed feature, so the
    shell seeds from the DB on mount. Floor-EXEMPT (a config read seeded on every Control Room
    mount — logging it would spam the ledger; the write PUT /admin/visibility is what's recorded).
    Inherits the router-level ``require_operator`` gate (404 to non-operators).
    """
    from app.models.user_settings import (
        _GOVERNED_FEATURES,
        _feature_record,
        feature_audience,
    )
    features = {}
    for f in _GOVERNED_FEATURES:
        rec = _feature_record(f)
        roles = [r for r in (rec.get("roles") or []) if isinstance(r, str) and r in _VISIBILITY_ROLES]
        features[f] = {"audience": feature_audience(f), "roles": roles}
    return {"features": features}


class VisibilityUpdate(BaseModel):
    """Body for PUT /admin/visibility. ``feature`` + ``audience`` + ``roles`` are validated
    against code allowlists in the handler (T-148-03 / T-167-12) — never free text.
    ``audience`` is an enum VALUE, never a boolean (SEED-115 forward-compat). ``roles`` is the
    greenlist for the ``role`` audience (D-167-06) — empty for everyone/operators."""

    feature: str
    audience: str
    roles: list[str] = []


@router.put("/visibility", status_code=status.HTTP_204_NO_CONTENT)
async def set_visibility(
    request: Request,
    body: VisibilityUpdate,
    _floor: None = Depends(operator_audit_floor),
):
    """Set a governed feature's audience (VIS-01) — allowlist-validated, then atomic merge.

    Validates ``feature`` against the four-key code allowlist AND ``audience`` against
    ``{everyone, operators}`` and rejects a bad value with ``400`` BEFORE any write (never
    free text → SQLi-safe, mirrors ``set_flag``'s ``_FLAG_KEYS`` guard). Then delegates to
    ``set_feature_visibility`` (atomic per-key JSONB ``||`` merge — no lost-update clobber).
    Floor row: ``visibility.set`` with a plain-sentence label.
    """
    if body.feature not in _VISIBILITY_FEATURES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown feature: {body.feature}",
        )
    if body.audience not in _VISIBILITY_AUDIENCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audience: {body.audience}",
        )
    # T-167-12: every greenlist role must be in the 4-tier set BEFORE the JSONB write —
    # a free-text role must never reach set_feature_visibility's codec (SQLi-safe).
    bad = [r for r in body.roles if r not in _VISIBILITY_ROLES]
    if bad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role(s): {', '.join(bad)}",
        )

    await set_feature_visibility(body.feature, body.audience, roles=body.roles)

    if body.audience == "role":
        request.state.audit_label = (
            f"Made {body.feature} visible to role(s): {', '.join(body.roles) or 'none'}"
        )
    else:
        request.state.audit_label = f"Made {body.feature} visible to {body.audience}"
    request.state.audit_action = "visibility.set"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# Phase 149 (MODEL-01) — the model registry: full-union read + SQLi-safe write
# ══════════════════════════════════════════════════════════════════════════════
#
# D-149-03: the registry is the FULL union — built-in config.MODEL_CAPABILITIES DEF rows
# ∪ model_capabilities_overrides OVR rows ∪ discovery-confirmed DB-only rows. config.py
# is the shipped baseline; the DB is the living registry. Both routes are 404-gated for
# non-operators by the router-level require_operator (no RLS backstop — SC#4 / D-149-09).


def _registry_row(model_id, cap, ovr, default_model, model_locked):
    """Build one union registry row: OVR (DB-stored) values win over DEF (built-in) values,
    with BOTH discernible via ``overridden_fields`` so the editor can render Reset (D-149-03).

    ``cap`` is the built-in MODEL_CAPABILITIES entry (or None for a DB-only model); ``ovr``
    is the model_capabilities_overrides row (or None for a pure DEF row). An OVR column is
    applied only when NON-None (null-clears-to-DEF — the same overlay rule as
    get_model_capability_async), so an operator's cleared field falls back to the built-in.
    """
    cap = cap or {}
    ovr = ovr or {}

    def _eff(col, default=None):
        v = ovr.get(col)
        if v is not None:
            return v
        return cap.get(col, default)

    provider = ovr.get("provider") or cap.get("provider") or _infer_provider_for(model_id)
    # DB-only OR any model carrying a stored override row → db_override; else the built-in.
    source = "db_override" if ovr else "registry"
    # Which editable columns are actually STORED (non-None) in the DB — the editor renders
    # Reset only for fields that are overridden vs inherited from the built-in DEF.
    overridden_fields = sorted(c for c in _MODEL_CAP_COLUMNS if ovr.get(c) is not None)

    _enabled = ovr.get("enabled")
    _deprecated = ovr.get("deprecated")
    return {
        "model_id": model_id,  # verbatim casing (Pitfall 6)
        "provider": provider,
        "capability_source": source,
        "enabled": bool(_enabled) if _enabled is not None else True,
        "deprecated": bool(_deprecated) if _deprecated is not None else False,
        # IN-02: surface the stored deprecation reason so re-editing a deprecated model seeds
        # the input from the current note (not blank) — a blur/enter no longer clobbers it.
        "deprecated_reason": ovr.get("deprecated_reason"),
        # WR-04: distinguish "not tracked in the registry" from a real 0. No built-in
        # MODEL_CAPABILITIES entry carries context_window_tokens, so coalescing absent→0 made
        # the tab read "Context 0 · DEF" for essentially every registry row (false — the value
        # is simply not tracked, not zero). Return the RAW effective value or None; the tab
        # renders None as "—" (not a concrete 0). Same for the sibling numeric fields.
        "context_window_tokens": _eff("context_window_tokens"),
        "max_output_tokens": _eff("max_output_tokens"),
        "native_tools": bool(_eff("native_tools", False)),
        "llm_call_timeout_seconds": _eff("llm_call_timeout_seconds"),
        "is_default": model_id == default_model,
        "is_locked": bool(model_locked) and model_id == default_model,
        # Additive (Plan 07 extends the ModelRegistryRow type): per-field OVR-vs-DEF for Reset.
        "overridden_fields": overridden_fields,
    }


@router.get("/models")
async def get_model_registry(request: Request):
    """Full-union model registry read (D-149-03) — floor-EXEMPT poll-style read.

    Returns ``{"models": [...]}``: every built-in MODEL_CAPABILITIES model as a DEF row
    (capability_source="registry"), every override as an OVR row (capability_source=
    "db_override"), and every DB-only model (in overrides, not in the built-in registry)
    as a DB-only row. Reads the ALL-ROWS override cache (``load_all_model_overrides`` —
    disabled rows INCLUDED, Pitfall 1) so the editor can re-enable what was disabled, and
    stamps ``is_default``/``is_locked`` from the app_settings row (``llm_model`` +
    ``llm_model_locked``). Floor-EXEMPT (the tab re-fetches — the /admin/runs + /admin/users
    poll precedent, D-07); ``audit_is_write=False`` marks it a read. The router gate is the
    sole authority — a non-operator gets a byte-identical 404 (SC#4 / D-149-09).
    """
    request.state.audit_is_write = False

    # Function-local imports (Pitfall 4 — keep the settings module off admin's load path).
    from app.models.user_settings import _load_settings_from_db, load_all_model_overrides

    settings_row = await _load_settings_from_db()
    default_model = settings_row.get("llm_model") or ""
    model_locked = bool(settings_row.get("llm_model_locked"))

    overrides = await load_all_model_overrides()

    rows = []
    seen = set()
    # DEF rows (built-in registry) overlaid with any OVR.
    for model_id, cap in MODEL_CAPABILITIES.items():
        rows.append(_registry_row(model_id, cap, overrides.get(model_id), default_model, model_locked))
        seen.add(model_id)
    # DB-only rows (in overrides, not in the built-in registry) — discovery-confirmed models.
    for model_id, ovr in overrides.items():
        if model_id in seen:
            continue
        rows.append(_registry_row(model_id, None, ovr, default_model, model_locked))

    return {"models": rows}


class AddModelRequest(BaseModel):
    """Body for POST /admin/models — add ONE model by EXPLICIT id + provider (D-159-02).

    Unlike the capability PATCH (which INFERS provider from the id/registry), add-by-ID takes
    the operator's EXPLICIT provider pick, validated against the native-7 + openrouter roster
    (``PROVIDER_ENDPOINTS``) before any DB touch. There is deliberately NO ``enabled`` field:
    the row is forced ``enabled=false`` server-side (the 149 opt-in-enable rule / SC#3 — an add
    never auto-enables; the operator flips it on from the registry table afterward). The
    capability fields are optional pre-fills (every column is null-safe on the table).
    ``protected_namespaces=()`` silences Pydantic's ``model_``-prefix warning for ``model_id``.
    """

    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    provider: str
    context_window_tokens: int | None = None
    max_output_tokens: int | None = None
    native_tools: bool | None = None
    deprecated: bool = False
    deprecated_reason: str | None = None


# The capability columns add-by-ID may pre-fill — a CODE-CONSTANT ordered subset of
# _MODEL_CAP_COLUMNS (model_id + provider are handled separately; ``enabled`` is FORCED False,
# never a body field). Column names reach the upsert ONLY from this constant — a client value
# never becomes an identifier (T-159-02, the same SQLi wall as set_model_capability).
_ADD_MODEL_CAP_COLUMNS = (
    "context_window_tokens",
    "max_output_tokens",
    "native_tools",
    "deprecated",
    "deprecated_reason",
)


@router.post("/models")
async def add_model_by_id(
    request: Request,
    body: AddModelRequest,
    _floor: None = Depends(operator_audit_floor),
):
    """Add a single model by explicit id + provider as a DB-only override row (D-159-02).

    Writes one ``model_capabilities_overrides`` row that lands ``enabled=false`` (SC#3 — NEVER
    auto-enabled) and is served immediately by ``get_model_capability_async`` on the next
    request (SC#1 — no restart; the write invalidates the override cache). Reuses the SQLi-safe
    parameterized upsert proven in ``set_model_capability``: column names come ONLY from the code
    allowlist (``_ADD_MODEL_CAP_COLUMNS`` + the two fixed columns), values are ``$N`` asyncpg
    binds — no client identifier/value ever reaches a SET clause (T-159-02).

    Validation runs BEFORE any DB touch (allowlist-before-touch): a blank id → 422; a provider
    outside ``PROVIDER_ENDPOINTS`` → 422; a wrong-typed cap → 422; a model already in the
    registry (built-in OR override, CASE-FOLDED per the WR-02 precedent so ``GLM-4.5`` can't
    phantom-duplicate ``glm-4.5``) → 409. On success: ``invalidate_model_overrides_cache()`` + a
    ✎ ``model.added`` receipt. On a persistence failure: a ``model.add_failed`` stamp + a real
    500 (never a false 2xx). Non-operators are 404'd by the router gate (SC#4 / D-149-09).
    """
    # (1) Non-empty id (mirror set_model_capability's guard). Strip stray slash/space/newline —
    # the cleaned id is what we dedup against AND store (a body id can carry whitespace a URL
    # path param would not), so a re-add can never phantom-differ by a trailing space.
    model_id = body.model_id.strip("/ \t\r\n") if body.model_id else ""
    if not model_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="model_id must be non-empty.",
        )

    # (2) Provider roster allowlist BEFORE any DB touch (function-local import — Pitfall 4). The
    # SAME hardcoded roster the SSRF discovery gate validates against; an EXPLICIT pick (never
    # inferred) so the operator owns the provider a DB-only model routes through.
    from app.services.model_discovery_service import PROVIDER_ENDPOINTS
    if body.provider not in set(PROVIDER_ENDPOINTS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown provider: {body.provider}",
        )

    # (3) Per-column type guards (mirror set_model_capability's WR-01 discipline). bool is an int
    # subclass, so the int columns reject a bool explicitly. Pydantic already rejects most garbage
    # at parse time; this is belt-and-braces so a wrong type is always a 422, never a 500.
    for col in ("context_window_tokens", "max_output_tokens"):
        val = getattr(body, col)
        if val is not None and (isinstance(val, bool) or not isinstance(val, int)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"'{col}' must be an integer or null.",
            )
    if body.native_tools is not None and not isinstance(body.native_tools, bool):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'native_tools' must be a boolean or null.",
        )

    # (4) Duplicate guard — CASE-FOLDED (WR-02 precedent: a case-SENSITIVE check lets ``GLM-4.5``
    # phantom-duplicate an existing ``glm-4.5``). Refuse if the id already exists in the built-in
    # registry OR as an override row — never clobber an existing row, never add a case-variant
    # second row (the operator edits the existing model in the table instead).
    from app.models.user_settings import load_all_model_overrides  # function-local (Pitfall 4)
    mid_lc = model_id.lower()
    existing_lc = {k.lower() for k in MODEL_CAPABILITIES} | {
        k.lower() for k in (await load_all_model_overrides())
    }
    if mid_lc in existing_lc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That model is already in the registry — edit it in the table instead.",
        )

    # Build the upsert EXACTLY like set_model_capability: column names ONLY from the code
    # allowlist; values ONLY as ``$N`` binds. Pre-filled caps that are non-None are written; the
    # ``enabled`` column is ALWAYS written as the literal False (never taken from the body — there
    # is no body.enabled — so an add can never auto-enable, SC#3).
    cap_values = {
        "context_window_tokens": body.context_window_tokens,
        "max_output_tokens": body.max_output_tokens,
        "native_tools": body.native_tools,
        "deprecated": body.deprecated,
        "deprecated_reason": body.deprecated_reason,
    }
    present_cols = [c for c in _ADD_MODEL_CAP_COLUMNS if cap_values[c] is not None]
    write_cols = [*present_cols, "enabled"]  # ``enabled`` is always written, forced False

    insert_cols = ["model_id", "provider", *write_cols]
    placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_cols)))
    # WR-01 (Phase 159 review): a PLAIN insert — NOT an ``ON CONFLICT DO UPDATE``. The case-folded
    # duplicate guard above reads a per-worker 30s override cache, so under WORKER_COUNT=2 a
    # concurrent add can slip past it; the table's ``model_id`` unique constraint is the
    # authoritative backstop. A genuine duplicate MUST fail SAFE as a 409 (below) — never an upsert
    # that would silently reset an existing row's caps and force ``enabled=false``. This is the ADD
    # path; ``set_model_capability`` owns the deliberate edit/upsert with its reset semantics.
    sql = (
        f"INSERT INTO model_capabilities_overrides ({', '.join(insert_cols)}) "
        f"VALUES ({placeholders})"
    )
    values = [
        model_id,
        body.provider,
        *[cap_values[c] for c in present_cols],
        False,  # ``enabled`` — the FORCED literal, never body-sourced (SC#3)
    ]

    import asyncpg  # function-local (Pitfall 4)
    pool = deps._pg_pool  # CR-02: live module attribute, never an import snapshot
    write_ok = False
    if pool is not None:
        try:
            await pool.execute(sql, *values)
            write_ok = True
        except asyncpg.exceptions.UniqueViolationError:
            # The race backstop (WR-01): a concurrent worker already inserted this id after our
            # cache guard read a stale snapshot. Fail safe with the SAME 409 the cache guard raises
            # — never clobber the existing row, never a false 500.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That model is already in the registry — edit it in the table instead.",
            )
        except Exception:
            logger.exception("add_model_by_id: upsert failed for %s", model_id)

    if not write_ok:
        # Honest failure: stamp a *.add_failed receipt and raise a real 500 — never a false 2xx
        # (mirrors set_flag / set_model_capability). The raised HTTPException re-enters the
        # floor's yield, so the floor skips its write; the stamp is belt-and-braces.
        request.state.audit_action = "model.add_failed"
        request.state.audit_label = f"Adding {model_id} failed to persist"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not persist the new model — it was not added.",
        )

    invalidate_model_overrides_cache()  # SC#1: the DB-only row is served on the next request
    request.state.audit_action = "model.added"
    request.state.audit_label = f"Added {model_id} ({body.provider})"
    return {"ok": True, "model_id": model_id, "provider": body.provider, "enabled": False}


@router.patch("/models/{model_id:path}")
async def set_model_capability(
    model_id: str,
    body: dict,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """SQLi-safe capability write with null-clears-to-DEF Reset (MODEL-01 / D-149-02).

    T-149-11: reject any body key not in ``_MODEL_CAP_COLUMNS`` with 422 BEFORE any SQL —
    a client field name never reaches the upsert's column list. The upsert is a
    parameterized asyncpg INSERT ... ON CONFLICT (model_id) DO UPDATE (values via $N binds).

    Reset semantics (D-149-02 / 149-07): a field sent as an EXPLICIT ``null`` CLEARS that
    override (the column is written SQL NULL, so get_model_capability_async's non-None
    overlay skips it and the value falls back to the built-in DEF). An OMITTED key is left
    UNTOUCHED. The raw ``dict`` body preserves the present-null-vs-omitted distinction that a
    Pydantic model would erase.

    On success: invalidate the TTL cache (so the edit is visible on the next request — ≤30s
    cross-worker per Pitfall 3, the accepted SC#1 semantics) + stamp a ✎
    ``model.capability.set`` receipt. On a persistence failure: stamp
    ``model.capability.write_failed`` + raise a real 500 (never a false 2xx — mirrors
    set_flag's honest-failure path). The default/locked-disable guard + lock semantics are
    Plan 06 — this is the base write. Non-operators are 404'd by the router gate.
    """
    # WR-04 (review round 2): the `:path` converter regex is `.*` — unlike the old
    # single-segment `{model_id}` (`[^/]+`), it matches the EMPTY string, so
    # `PATCH /admin/models/` would reach this handler with model_id="" and upsert a
    # phantom model_id="" row that then surfaces in the registry union. Reject
    # empty / whitespace-or-slash-only ids with a 422 BEFORE any other processing —
    # restores the non-empty guarantee the old converter provided structurally.
    if not model_id or not model_id.strip("/ \t\r\n"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="model_id must be non-empty.",
        )

    # T-149-11: allowlist BEFORE any DB touch. An unknown field never reaches a SET clause.
    unknown = [k for k in body if k not in _MODEL_CAP_COLUMNS]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown capability field(s): {', '.join(sorted(unknown))}",
        )

    # WR-01: per-column value-type validation BEFORE any DB touch — a wrong-typed value is a
    # 422 (client error), never a 500 (an asyncpg type error caught by the broad except). An
    # explicit null is a valid Reset for every column. bool is a subclass of int in Python, so
    # the int columns reject a bool explicitly (which also makes the ``enabled is False``
    # disable guard below safe — a non-bool ``enabled`` can never slip past as a falsy value).
    for col, val in body.items():
        if val is None:
            continue  # explicit null → Reset (clears to DEF); valid for any column.
        if col in _MODEL_CAP_INT_COLUMNS:
            if isinstance(val, bool) or not isinstance(val, int):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{col}' must be an integer or null.",
                )
        elif col in _MODEL_CAP_BOOL_COLUMNS:
            if not isinstance(val, bool):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{col}' must be a boolean or null.",
                )
        elif col == "deprecated_reason":
            if not isinstance(val, str):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="'deprecated_reason' must be a string or null.",
                )

    # Phase 149 (D-149-09 disable-path half): NO dead default. Disabling the current org
    # default — OR the locked model — is REFUSED with a plain 409 BEFORE any write, so the
    # threads.py request-path fallback target (app_settings.llm_model) always resolves to an
    # ENABLED model. An ordinary disable of a non-default, non-locked model stays a direct,
    # reversible flip. The lock-path half of this guard lives in set_model_lock (refusing to
    # LOCK a disabled model) — the two together guarantee no dead default can ever exist.
    if body.get("enabled") is False:
        from app.models.user_settings import (  # function-local (Pitfall 4)
            _load_settings_from_db,
            invalidate_settings_cache,
        )

        # WR-03: force a FRESH settings read (the cross-worker source of truth). The
        # per-worker 30s-TTL settings cache can hold a STALE org default written by another
        # worker (save_app_settings only invalidates the LOCAL worker's cache), which would
        # let a disable of the TRUE org default slip past this guard and create a dead
        # default. Zeroing the cache timestamp first guarantees the guard reads the live DB.
        invalidate_settings_cache()
        _s = await _load_settings_from_db()
        _org_default = _s.get("llm_model") or ""
        _is_locked = bool(_s.get("llm_model_locked"))
        if model_id == _org_default:
            if _is_locked:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This model is locked as the org default — unlock it first.",
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This is the org default model — pick a new default first.",
            )

    # Only keys PRESENT in the raw body are written; an explicit null → SQL NULL (clear to
    # DEF), an omitted key → never touched (do NOT coalesce omitted to NULL — that would
    # wipe unrelated overrides). Column names come ONLY from the code allowlist (SQLi-safe).
    present_cols = [c for c in _MODEL_CAP_COLUMNS if c in body]
    if not present_cols:
        # Nothing to change — a no-op success; never writes a bare all-DEF override row.
        request.state.audit_action = "model.capability.set"
        request.state.audit_label = f"No capability changes for {model_id}"
        return {"ok": True, "model_id": model_id, "changed": []}

    # provider is NOT NULL on the table; needed for a first-time INSERT of a DEF/DB-only
    # model. get_model_capability returns the registry (or inferred) provider; an existing
    # OVR row keeps its stored provider (ON CONFLICT does not touch it).
    from app.config import get_model_capability  # function-local (Pitfall 4)
    provider = get_model_capability(model_id).get("provider") or _infer_provider_for(model_id)

    insert_cols = ["model_id", "provider", *present_cols]
    placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_cols)))
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in present_cols)
    sql = (
        f"INSERT INTO model_capabilities_overrides ({', '.join(insert_cols)}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT (model_id) DO UPDATE SET {set_clause}, updated_at = now()"
    )
    values = [model_id, provider, *[body[c] for c in present_cols]]

    pool = deps._pg_pool  # CR-02: live module attribute, never an import snapshot
    write_ok = False
    if pool is not None:
        try:
            await pool.execute(sql, *values)
            write_ok = True
        except Exception:
            logger.exception("set_model_capability: upsert failed for %s", model_id)

    if not write_ok:
        # Honest failure: stamp a *.write_failed receipt and raise a real 500 — never a
        # false 2xx. (Like set_flag, the raised HTTPException re-enters the floor's yield,
        # so the floor skips its write; the stamp is belt-and-braces.)
        request.state.audit_action = "model.capability.write_failed"
        request.state.audit_label = f"Capability change for {model_id} failed to persist"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not persist the capability change — it was not changed.",
        )

    invalidate_model_overrides_cache()  # SC#1: edit visible on the next request
    request.state.audit_action = "model.capability.set"
    request.state.audit_label = f"Changed capabilities for {model_id}"
    return {"ok": True, "model_id": model_id, "changed": present_cols}


# ══════════════════════════════════════════════════════════════════════════════
# Phase 149 (MODEL-02 / D-149-07) — the dedicated lock/unlock endpoint
# ══════════════════════════════════════════════════════════════════════════════
#
# Lock/unlock is a DEDICATED PUT /admin/models/{id}/lock route (body {locked}), SEPARATE
# from the capability PATCH and matching the Plan-04 setModelLock seam — the lock is NOT a
# model_capabilities_overrides column, it pins the single app_settings org default. The new
# non-GET route inherits the router-level require_operator 404 gate (no RLS backstop) and
# carries its OWN non-operator 404 test.


class ModelLockUpdate(BaseModel):
    """Body for PUT /admin/models/{id}/lock (the D-149-07 dedicated lock seam, SEPARATE
    from the capability PATCH). ``locked`` is a strict bool (Pydantic)."""

    locked: bool


@router.put("/models/{model_id:path}/lock", status_code=status.HTTP_204_NO_CONTENT)
async def set_model_lock(
    model_id: str,
    body: ModelLockUpdate,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Lock/unlock + pin the single org default (D-149-07 / D-149-09 lock-path half).

    ``locked=true``: FIRST resolve the target's effective ``enabled`` from the all-rows
    override cache (a model is disabled ONLY when its ``load_all_model_overrides()`` row
    carries ``enabled=false``; an ABSENT override defaults enabled). If the target is
    DISABLED, refuse with a plain 409 "enable it first" BEFORE any write — a lock must never
    pin a disabled model as the org default (this is the lock-path half of the no-dead-default
    guard; it 409-refuses rather than silently auto-enabling, symmetric with the disable
    guard's honest consequence). Otherwise write ``llm_model=model_id`` + ``llm_model_locked=
    true`` via the code-constant allowlist (SQLi-safe) and stamp a ✎ ``model.lock`` receipt.
    The single ``llm_model`` pin + single ``llm_model_locked`` flag guarantee "at most one
    lock" structurally.

    ``locked=false``: clear ``llm_model_locked`` (``llm_model`` unchanged) + stamp ✎
    ``model.unlock``. On a persistence failure, stamp ``*.write_failed`` + raise a real 500
    (never a false 204 — mirrors set_flag's honest-failure path). Non-operators are 404'd by
    the router gate; a failed persist re-enters the floor's yield so no false receipt is written.
    """
    # WR-04 (review round 2): the `:path` converter matches the EMPTY string —
    # `PUT /admin/models//lock` would reach this handler with model_id="" and (on
    # locked=true) write app_settings.llm_model="" + llm_model_locked=true, blanking
    # AND locking the org default. Reject empty / whitespace-or-slash-only ids with a
    # 422 BEFORE any write — restores the old single-segment converter's structural
    # non-empty guarantee.
    if not model_id or not model_id.strip("/ \t\r\n"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="model_id must be non-empty.",
        )

    from app.models.user_settings import (  # function-local (Pitfall 4)
        invalidate_model_overrides_cache,
        load_all_model_overrides,
    )

    if body.locked:
        # D-149-09 (lock path): never pin a DISABLED model as the org default. Refuse 409
        # BEFORE any write — no hidden auto-enable side effect (honest consequence).
        # WR-03: force a FRESH all-rows override read (the cross-worker source of truth) so
        # the disabled-check can't pass on a STALE per-worker cache — another worker may have
        # just disabled this model, and a lock on a stale-enabled read would pin a dead default.
        invalidate_model_overrides_cache()
        overrides = await load_all_model_overrides()
        if (overrides.get(model_id) or {}).get("enabled") is False:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This model is disabled — enable it first.",
            )
        if not await save_app_settings({"llm_model": model_id, "llm_model_locked": True}):
            request.state.audit_action = "model.lock.write_failed"
            request.state.audit_label = f"Locking {model_id} as the org default failed to persist"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not persist the lock — it was not changed.",
            )
        request.state.audit_action = "model.lock"
        request.state.audit_label = f"Locked {model_id} as the org default"
    else:
        if not await save_app_settings({"llm_model_locked": False}):
            request.state.audit_action = "model.unlock.write_failed"
            request.state.audit_label = f"Unlocking {model_id} failed to persist"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not persist the unlock — it was not changed.",
            )
        request.state.audit_action = "model.unlock"
        request.state.audit_label = f"Unlocked {model_id}"
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# Phase 149 (MODEL-02 / D-149-11) — operator-gated live model discovery
# ══════════════════════════════════════════════════════════════════════════════
#
# POST /admin/models/discover fans out to the keyed providers server-side (the Plan-02
# model_discovery_service) and returns the EPHEMERAL propose-only diff. No proposals table
# (D-149-12). Provider selection is validated against the code-constant PROVIDER_ENDPOINTS
# set (SSRF-safe — no client URL). The new non-GET route inherits the router require_operator
# 404 gate and carries its OWN non-operator 404 test.


class DiscoverRequest(BaseModel):
    """Optional body for POST /admin/models/discover. ``providers`` (if given) is validated
    against ``set(PROVIDER_ENDPOINTS)`` — a code-constant allowlist, NEVER a URL/base — so no
    client-supplied value can ever become a request target (SSRF-safe, T-149-14)."""

    providers: list[str] | None = None


@router.post("/models/discover")
async def run_model_discovery(
    request: Request,
    body: DiscoverRequest | None = None,
    _floor: None = Depends(operator_audit_floor),
):
    """Operator-gated live model discovery (D-149-11) — fan out, diff, ✎ receipt.

    Resolves keyed providers from settings and fans out to each provider's ``/models``
    (``model_discovery_service`` — SSRF-safe: URLs come ONLY from the hardcoded
    PROVIDER_ENDPOINTS allowlist), builds the current registry union (built-in
    MODEL_CAPABILITIES ∪ ``load_all_model_overrides``), and returns the EPHEMERAL
    propose-only diff (``new``/``changed``/``vanished``) plus honest per-provider outcomes.
    NO proposals table is written — the diff lives only in this response (D-149-12); the
    operator confirms each change through the PATCH capability seam (SC#3 — discovery never
    auto-enables). If the (optional) body carries a provider selection, EVERY value must be
    in ``set(PROVIDER_ENDPOINTS)`` or the whole run is refused 422 BEFORE any fan-out (no
    client value reaches the HTTP client). Stamps a ✎ ``model.discover`` receipt.
    Non-operators are 404'd by the router gate.
    """
    from app.models.user_settings import load_all_model_overrides  # function-local (Pitfall 4)
    from app.services.model_discovery_service import (  # function-local (Pitfall 4)
        PROVIDER_ENDPOINTS,
        compute_diff,
        discover_all,
        keyed_from_settings,
    )

    selection = body.providers if body is not None else None
    if selection is not None:
        # SSRF gate (T-149-14): validate against the code-constant allowlist BEFORE any
        # fan-out. A client value never becomes a request URL — the reject path calls no
        # service. Mirror the _MODEL_CAP_COLUMNS allowlist-before-touch discipline.
        allowed = set(PROVIDER_ENDPOINTS)
        unknown = [p for p in selection if p not in allowed]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown provider(s): {', '.join(sorted(unknown))}",
            )

    keyed = keyed_from_settings()
    if selection is not None:
        # Honor the selection: only the chosen providers keep their key (others → None,
        # so discover_all skips them as no_key). Iteration stays over the code constant.
        chosen = set(selection)
        keyed = {p: (keyed.get(p) if p in chosen else None) for p in keyed}

    discovered = await discover_all(keyed)

    # Current registry union: built-in DEF ∪ ALL DB override rows (enabled AND disabled).
    # Each entry MUST carry a ``provider`` (compute_diff's vanished detection keys on it).
    current: dict[str, dict] = {}
    for mid, cap in MODEL_CAPABILITIES.items():
        current[mid] = dict(cap)
    overrides = await load_all_model_overrides()
    for mid, ovr in overrides.items():
        merged = dict(current.get(mid, {}))
        for k, v in ovr.items():
            if v is not None:  # null-clears-to-DEF overlay (same rule as the registry read)
                merged[k] = v
        if not merged.get("provider"):
            merged["provider"] = ovr.get("provider") or _infer_provider_for(mid)
        current[mid] = merged

    diff = compute_diff(current, discovered)

    request.state.audit_action = "model.discover"
    request.state.audit_label = "Ran model discovery"

    # Honest per-provider outcomes — names + status ONLY (never the response body or key,
    # T-149-04). ``ok`` is derived so the tab can show which providers ran vs skipped/errored.
    providers_summary = [
        {
            "provider": d.get("provider"),
            "status": d.get("status"),
            "ok": d.get("status") == "ok",
        }
        for d in discovered
    ]
    return {**diff, "providers": providers_summary}


# ══════════════════════════════════════════════════════════════════════════════
# Phase 168 (SSO-01 / D-168-05 Control 2) — operator approval of a pending SSO connection
# ══════════════════════════════════════════════════════════════════════════════
#
# The second anti-hijack control: an org-admin CREATES a connection (it lands
# status='pending_approval' — org.py create_sso_provider), but an OPERATOR — not the creating
# org-admin — flips it live. Until then the pending config routes nobody (org.py /sso/route +
# /sso/provision both filter status='active'). This is a minimal operator affordance on the
# service-role pool behind the router-level require_operator gate (byte-identical 404 to
# non-operators; no RLS backstop). Floor-attached: an approval is a deliberate, recorded action.


@router.post("/sso/configs/{config_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_sso_config(
    config_id: UUID,
    request: Request,
    _floor: None = Depends(operator_audit_floor),
):
    """Flip a pending_approval SSO connection to active (D-168-05 Control 2; operator-only).

    Guarded ``WHERE id=$1 AND status='pending_approval'`` on the singleton pool: an already-
    active / unknown id matches no row → the byte-identical /admin 404 (non-discoverable).
    Records ``approved_by`` (the acting operator) + ``approved_at`` for the D-168-05 audit
    trail, and a plain-language ``sso.approve`` ledger row.
    """
    operator_id = request.state.operator["id"]  # set by require_operator (router gate)
    pool = await deps.get_pg_pool()
    row = await pool.fetchrow(
        "UPDATE public.sso_configs "
        "SET status = 'active', approved_by = $2, approved_at = now() "
        "WHERE id = $1 AND status = 'pending_approval' "
        "RETURNING id, email_domain",
        config_id, deps._to_uuid(operator_id),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSO configuration not found"
        )

    request.state.audit_label = f"Approved SSO for {row['email_domain'] or 'a domain'}"
    request.state.audit_action = "sso.approve"
    return Response(status_code=status.HTTP_204_NO_CONTENT)
