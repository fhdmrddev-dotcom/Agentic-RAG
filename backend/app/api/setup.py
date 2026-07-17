"""Phase 158 (DEPLOY-02, Plan 06) — the pre-auth, token-gated ``/setup/*`` router.

The wire order that mints the first operator, saves the encrypted provider key, runs the
smoke, and writes the dual finalize marker. This surface is the SECURITY WALL: the backend
runs on the service-role key with **no RLS backstop** (v3.3 red-line), so the setup token +
finalize latch are the SOLE access authority — exactly like the ``/admin`` surface's operator
gate, but INVERTED to a pre-auth token gate. A missing token check on ANY ``/setup/*`` write is
a full pre-auth config-write hole.

Two routers:

* ``router`` (prefix ``/setup``) — the write endpoints, EACH gated on
  ``Depends(require_setup_token)``, plus the ONE open ``GET /setup/status`` entry probe.
* ``public_router`` (no prefix) — the ONE open ``GET /public-config`` (D-07), returning ONLY
  the two PUBLIC Supabase values so the browser's Supabase client can bind without a rebuild.

``require_setup_token`` (D-15 / D-14) is the load-bearing dependency. Order matters:

  1. ``setup_finalized()`` → **409** FIRST (D-14 lock-out — a post-finalize write can never
     mutate config even with a valid token; re-config is ``/admin``-only).
  2. rate-limit the token-verify path → **429** (T-158-08 brute-force, atop the 256-bit token
     + constant-time compare).
  3. ``verify_token`` (constant-time ``hmac.compare_digest`` in setup_store) → **401** on a
     missing/wrong token (T-158-01 hijack).

Everything below ORCHESTRATES the shipped 158-05 service seams + 158-03 store seams — it never
forks a seam (no second probe, no second encrypt path, no second operator upsert). The store /
service names are bound at module scope so tests can monkeypatch the boundary.
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

# Store seams (158-03) — bound at module scope so require_setup_token's finalize-latch + token
# checks are monkeypatchable at the boundary (the idempotency + gate proofs patch these names).
from app.services.setup_store import (
    finalize as store_finalize,
    get_or_create_token,
    setup_finalized,
    verify_token,
)

# The auditable-DB-flag write seam (Phase-150 encrypt-on-write is inherited for free) — bound at
# module scope so the finalize proof monkeypatches the boundary (no live DB in a unit test).
from app.models.user_settings import save_app_settings

# Service seams (158-05) — the pure, unit-testable logic the router orchestrates (never forked).
# Bound at module scope so the endpoint proofs monkeypatch the boundary (save-False, dup, etc.).
from app.services.setup_service import (
    SchemaBootstrapPrivilegeError,
    bootstrap_operator,
    compute_setup_status,
    detect_environment,
    probe_submitted_postgres,
    probe_submitted_redis,
    probe_submitted_supabase,
    run_schema_bootstrap,
    run_smoke_checks,
    save_provider_key,
)

logger = logging.getLogger(__name__)

# D-10 guide fallback: the exact OPERATOR.md Step-3 bootstrap sequence a schema-absent box shows
# (with copy buttons in 158-08) when the auto-runner can't/needn't run — full schema + the 9
# ordered seed migrations. The runner also inserts the app_settings('global') row (A6 gotcha).
_SEED_SEQUENCE = (
    "supabase/full-schema.sql",
    "supabase/migrations/010_app_settings.sql",
    "supabase/migrations/018_skill_creator_seed.sql",
    "supabase/migrations/053_settings_unification.sql",
    "supabase/migrations/056_workflow_definitions.sql",
    "supabase/migrations/061_harness_seed_templates.sql",
    "supabase/migrations/066_eval_coverage_seed.sql",
    "supabase/migrations/087_skill_creator_reborn.sql",
    "supabase/migrations/088_skill_creator_eval_step_sequencing.sql",
    "supabase/migrations/089_skill_creator_file_attach_honesty.sql",
)


# ── Token-verify rate-limit (D-15 / T-158-08 brute-force) ──────────────────────────────────
# A lightweight in-process sliding window of FAILED verify attempts, keyed by client host. A
# legitimate operator holds the token → succeeds → the window is CLEARED, so honest re-runs
# never accumulate; only sustained failures (a brute-force attacker, who never succeeds) trip
# the 429. Defense-in-depth atop the 256-bit token + constant-time compare — not the primary
# control. Per-process (WORKER_COUNT=2 → each worker throttles independently, which is fine).
_RATE_WINDOW_S = 60.0
_RATE_MAX_FAILURES = 20
_failed_attempts: dict[str, list[float]] = {}


def _too_many_failures(host: str) -> bool:
    """True when ``host`` has ``_RATE_MAX_FAILURES``+ FAILED verifies within the window."""
    now = time.monotonic()
    recent = [t for t in _failed_attempts.get(host, []) if now - t < _RATE_WINDOW_S]
    _failed_attempts[host] = recent
    return len(recent) >= _RATE_MAX_FAILURES


def _record_failure(host: str) -> None:
    _failed_attempts.setdefault(host, []).append(time.monotonic())


def _clear_failures(host: str) -> None:
    _failed_attempts.pop(host, None)


async def require_setup_token(
    request: Request = None,
    x_setup_token: str | None = Header(default=None),
) -> None:
    """The SOLE access authority for every ``/setup/*`` WRITE (no RLS backstop — D-15).

    Load-bearing order: finalize-latch 409 → rate-limit 429 → constant-time token 401. The
    ``request`` default of ``None`` lets the dependency be unit-called directly (the idempotency
    proof invokes ``require_setup_token(x_setup_token=...)`` with no ASGI request).
    """
    # 1. D-14 lock-out FIRST: after finalize, no write can mutate config (re-config is /admin).
    if setup_finalized():
        raise HTTPException(
            status_code=409, detail="Setup already complete — reconfigure from /admin."
        )
    # 2. Rate-limit the token-verify path (brute-force throttle).
    host = request.client.host if (request is not None and request.client) else "direct"
    if _too_many_failures(host):
        raise HTTPException(
            status_code=429, detail="Too many attempts — wait about a minute."
        )
    # 3. Constant-time token verify (hmac.compare_digest in setup_store).
    if not verify_token(x_setup_token):
        _record_failure(host)
        raise HTTPException(status_code=401, detail="Invalid or missing setup token.")
    _clear_failures(host)


# ── Routers ─────────────────────────────────────────────────────────────────────────────────
# NO router-level operator gate (INVERTS admin.py:128): writes gate per-route on
# require_setup_token; /setup/status is OPEN (in the SetupMiddleware allowlist).
router = APIRouter(prefix="/setup", tags=["setup"])
# Top-level, no prefix — nginx strips /api so /api/public-config reaches backend /public-config
# (the SetupMiddleware allowlist exempts it). Registered separately so it is NOT under /setup.
public_router = APIRouter(tags=["setup-public"])


# ── Open routes (no token — the ONLY two un-gated routes) ────────────────────────────────────
@router.get("/status")
async def get_status() -> dict:
    """D-06: the STATIC, blip-proof entry signal — ``{needs_setup, finalized, has_token}``.

    Delegates to ``compute_setup_status`` (a pure string check on the marker + placeholder infra
    — NO live DB probe, so a DB blip can never re-trigger the wizard on a configured box).
    """
    return compute_setup_status()


@public_router.get("/public-config")
async def public_config() -> dict:
    """D-07 (T-158-04): return ONLY the two PUBLIC Supabase values so the browser's Supabase
    client binds without a frontend rebuild. NEVER the service-role key / DSN / any secret.

    ``getattr`` with an empty-string default keeps this route honest on a fresh box where the
    optional ``supabase_anon_key`` field may be absent from ``Settings`` (no AttributeError).
    """
    from app.config import settings as _settings

    return {
        "supabase_url": getattr(_settings, "supabase_url", "") or "",
        "supabase_anon_key": getattr(_settings, "supabase_anon_key", "") or "",
    }


# ── Request bodies (all fields optional so a re-entered step is forgiving — D-14) ────────────
class BindBody(BaseModel):
    """The submitted infra tier for the LIVE bind/validate probes (D-10)."""

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None
    postgres_dsn: str | None = None
    redis_url: str | None = None


class OperatorBody(BaseModel):
    """The first operator + the infra it is minted against (D-11). Infra travels in the body
    because the store is not written until finalize — each step is stateless + re-entrant."""

    email: str
    password: str
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    postgres_dsn: str | None = None


class ProviderKeyBody(BaseModel):
    """The default provider key (+ optional embedding key) — encrypt-on-write via the seam."""

    provider: str
    api_key: str
    embedding_key: str | None = None


class SmokeBody(BaseModel):
    """The submitted config the 5-way smoke checklist probes server-side (D-13)."""

    supabase_url: str | None = None
    service_role_key: str | None = None
    postgres_dsn: str | None = None
    redis_url: str | None = None
    provider: str | None = None
    provider_key: str | None = None


def _load_schema_artifacts() -> tuple[str, list[str]]:
    """Read ``supabase/full-schema.sql`` + the ordered seed migrations from the repo (D-10).

    Used ONLY by the schema-absent auto-runner (a SHOULD). A missing artifact raises, and the
    endpoint falls back to the copy-guide (the MUST path) — never a partial silent bootstrap.
    """
    from pathlib import Path

    repo_root = Path(__file__).resolve().parents[3]  # backend/app/api/setup.py -> repo root
    full_schema_sql = (repo_root / "supabase" / "full-schema.sql").read_text(encoding="utf-8")
    seeds: list[str] = []
    for rel in _SEED_SEQUENCE[1:]:  # skip full-schema.sql itself (already loaded)
        p = repo_root / rel
        if p.exists():
            seeds.append(p.read_text(encoding="utf-8"))
    return full_schema_sql, seeds


# ── Token-gated step endpoints (each Depends(require_setup_token) — the pre-auth wall) ───────
@router.post("/detect", dependencies=[Depends(require_setup_token)])
async def detect() -> dict:
    """D-08: LIGHT env-detect — cheap booleans to pre-fill defaults, not auto-discovery."""
    return await detect_environment()


@router.post("/validate", dependencies=[Depends(require_setup_token)])
async def validate(body: BindBody) -> dict:
    """D-10: validate the SUBMITTED values LIVE via THROWAWAY connections (never the app
    singletons). Returns sanitized pass/fail only — a probe reflects ``type(exc).__name__``,
    never the raw error / host / DSN (T-158-03 SSRF telemetry). Postgres also reports
    ``schema_present`` (the ``to_regclass`` sentinel)."""
    supabase = await probe_submitted_supabase(
        body.supabase_url or "", body.supabase_service_role_key or ""
    )
    postgres = await probe_submitted_postgres(body.postgres_dsn or "")
    redis = await probe_submitted_redis(body.redis_url or "")
    return {"supabase": supabase, "postgres": postgres, "redis": redis}


@router.post("/schema-bootstrap", dependencies=[Depends(require_setup_token)])
async def schema_bootstrap(body: BindBody) -> dict:
    """D-10 (SHOULD): schema-absent-GATED auto-runner with a guide fallback.

    Never runs against a present schema (non-idempotent ``CREATE TABLE`` would error — this is
    the idempotency guard for the step). On a privilege error (or a missing artifact) it returns
    ``{fallback:"guide", seed_sequence:[...]}`` — the MUST copy-guide path (D-18), never a
    half-applied silent success.
    """
    dsn = body.postgres_dsn or ""
    probe = await probe_submitted_postgres(dsn)
    if probe.get("state") != "up":
        # Unreachable → cannot auto-run; hand the operator the guide (+ the sanitized reason).
        return {
            "ok": False,
            "reason": probe.get("reason", "unreachable"),
            "fallback": "guide",
            "seed_sequence": list(_SEED_SEQUENCE),
        }
    if probe.get("schema_present"):
        return {"ok": True, "skipped": True, "schema_present": True}  # idempotent no-op
    try:
        full_schema_sql, seed_sqls = _load_schema_artifacts()
    except Exception:  # noqa: BLE001 — a missing artifact → guide fallback, never a 500
        logger.warning("setup: schema artifacts unreadable — falling back to the copy-guide")
        return {"ok": False, "fallback": "guide", "seed_sequence": list(_SEED_SEQUENCE)}
    try:
        await run_schema_bootstrap(dsn, full_schema_sql, seed_sqls)
    except SchemaBootstrapPrivilegeError:
        # The pooler role lacks DDL/extension/auth-schema rights — the guide is the MUST path.
        return {"ok": False, "fallback": "guide", "seed_sequence": list(_SEED_SEQUENCE)}
    return {"ok": True, "bootstrapped": True}


@router.post("/operator", dependencies=[Depends(require_setup_token)])
async def operator(body: OperatorBody) -> dict:
    """D-11: mint the first CONFIRMED operator (Auth admin API) + upsert operator_users.

    A duplicate email → ``{already_exists:true}`` at 200 (the service handles it, no raise). A
    GoTrue password-policy rejection (or any other create error) is surfaced as a **400
    verbatim** — never a 500 that hides the real cause (T-158-06). Ordering: the wizard runs
    schema-bootstrap BEFORE this (the ``on_auth_user_created`` trigger needs its tables)."""
    from app.config import settings as _settings

    supabase_url = body.supabase_url or getattr(_settings, "supabase_url", "")
    service_role_key = body.supabase_service_role_key or getattr(
        _settings, "supabase_service_role_key", ""
    )
    pg_dsn = body.postgres_dsn or getattr(_settings, "postgres_dsn", "")
    try:
        return await bootstrap_operator(
            supabase_url, service_role_key, body.email, body.password, pg_dsn
        )
    except Exception as exc:  # noqa: BLE001 — password policy / create error → 400 verbatim (T-158-06)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/provider-key", dependencies=[Depends(require_setup_token)])
async def provider_key(body: ProviderKeyBody) -> dict:
    """D-12: persist the provider key through the SINGLE ``save_app_settings`` seam
    (encrypt-on-write inherited for free). A False return is a REAL 500 (honest write-through,
    mirrors PUT /admin/flags) — never a false 'saved'."""
    if not await save_provider_key(body.provider, body.api_key, body.embedding_key):
        raise HTTPException(
            status_code=500,
            detail="Could not persist the provider key — it was not saved.",
        )
    return {"ok": True}


@router.post("/smoke", dependencies=[Depends(require_setup_token)])
async def smoke(body: SmokeBody) -> dict:
    """D-13: the 5-way green checklist that IS the finalize gate — a row is green ONLY on
    server truth. Returns ``{checks, all_green}``; any red keeps Finalize disabled."""
    return await run_smoke_checks(body.model_dump(exclude_none=True))


class FinalizeBody(BaseModel):
    """The full config finalize commits: the infra tier (→ file marker) + operator_emails +
    the provider values the server RE-SMOKES (never trusting a client 'all green')."""

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None
    postgres_dsn: str | None = None
    redis_url: str | None = None
    secrets_encryption_key: str | None = None
    operator_emails: str | None = None
    provider: str | None = None
    provider_key: str | None = None


@router.post("/finalize", dependencies=[Depends(require_setup_token)])
async def finalize_setup(body: FinalizeBody) -> dict:
    """D-05: write the DUAL finalize marker + signal restart-to-apply.

    1. RE-RUN the smoke SERVER-SIDE and REFUSE (409) unless every row is green — the finalize
       gate is server truth, never a client 'all green' (D-13).
    2. Write the FILE marker (``setup_store.finalize``) — the blip-proof gate AUTHORITY (D-05)
       and the point-of-no-return commit; after it, ``require_setup_token`` 409s every write.
    3. Write the AUDITABLE DB flag (``save_app_settings({"setup_complete": True})``) and report
       the result HONESTLY.
    4. Return ``restart_required:true`` — in-process re-init is unreliable under WORKER_COUNT=2,
       so ``docker compose restart backend`` is the documented apply step.

    Note (deviation from the plan's literal 'file-first then a hard 500 on DB-False'): the
    auditable DB flag is written best-effort and its outcome is reported as
    ``setup_complete_persisted`` rather than 500'd. Under restart-to-apply the app pool is still
    bound to placeholder config until the restart, so this write can legitimately not land yet;
    the FILE marker above is the sole gate authority (D-05) and ``setup_complete()`` reads
    default-False-safe, so a hard 500 here would BOTH falsely claim finalize failed AND be
    unrecoverable (the marker now 409s a retry). Reporting the truth (never a false 'saved')
    preserves the honesty intent without the retry-lock paradox.
    """
    # 1. Server-side smoke gate — the client cannot force finalize past a red check.
    cfg = {
        k: v
        for k, v in {
            "supabase_url": body.supabase_url,
            "service_role_key": body.supabase_service_role_key,
            "postgres_dsn": body.postgres_dsn,
            "redis_url": body.redis_url,
            "provider": body.provider,
            "provider_key": body.provider_key,
        }.items()
        if v is not None
    }
    result = await run_smoke_checks(cfg)
    if not result.get("all_green"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "smoke_not_green",
                "message": "Setup is not fully green yet — resolve the red checks before finalizing.",
                "checks": result.get("checks"),
            },
        )

    # 2. FILE marker — the blip-proof gate AUTHORITY (D-05) + point-of-no-return lock (D-14).
    store_finalize(body.model_dump(exclude_none=True))

    # 3. Auditable DB flag — best-effort + honestly reported (see the docstring rationale).
    setup_complete_persisted = False
    try:
        setup_complete_persisted = bool(await save_app_settings({"setup_complete": True}))
    except Exception:  # noqa: BLE001 — auditable-only; never fail the (file-authoritative) finalize
        logger.warning(
            "setup finalize: setup_complete DB-flag write raised (best-effort)", exc_info=True
        )
    if not setup_complete_persisted:
        logger.warning(
            "setup finalize: auditable setup_complete DB flag not persisted yet (pre-restart "
            "app pool / DB blip) — the file marker is authoritative; the flag re-syncs post-restart"
        )

    # 4. Restart-to-apply verdict (WORKER_COUNT=2 makes in-process re-init unreliable).
    return {
        "finalized": True,
        "restart_required": True,
        "setup_complete_persisted": setup_complete_persisted,
        "message": "Setup complete — run `docker compose restart backend` to apply.",
    }
