import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import anyio
from dotenv import load_dotenv

# pydantic-settings reads backend/.env into the Settings object, but it does NOT
# populate os.environ. Downstream os.getenv() consumers (e.g. PYMUPDF_TIMEOUT_S
# in the AGPL fence) would otherwise never see env-only knobs.
# load_dotenv() fills os.environ from backend/.env regardless of CWD. Must run
# before any module reads os.getenv() at import time.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Suppress asyncio transport-level "socket.send() raised exception." warnings.
# These fire from CPython's selector_events.py when a client disconnects while
# we're mid-write — our SSEStreamingResponse already handles the disconnect
# gracefully at the ASGI layer, so these warnings are noise.
logging.getLogger("asyncio").setLevel(logging.ERROR)

# Phase 123.1 TT-10 — Suppress the LangSmith background-uploader 429 flood.
# Once the monthly unique-trace quota is exceeded, the langsmith client's
# background ingest thread emits a repeating "Failed to multipart ingest runs:
# ... 429 Client Error: Too Many Requests" WARNING. This is upload-retry noise,
# NOT the latency path — it does not slow the run (audit TT-06), it just drowns
# the backend log during the exact tuner/heavy runs an operator needs to read.
# ERROR-and-above (auth failure, hard client error) still surfaces; this is
# scoped to the langsmith logger only — app/uvicorn/asyncio logging is unchanged.
# To throttle the uploads at the source, set LANGSMITH_TRACING_SAMPLING_RATE in
# backend/.env (documented in .env.example) — no code change required.
logging.getLogger("langsmith").setLevel(logging.ERROR)

logger = logging.getLogger(__name__)

# Phase 093 D-20 — opt-in backend file log-sink. Runs AFTER load_dotenv (so
# os.environ carries LOG_FILE_PATH) and AFTER the asyncio suppressor above. Unset
# env var = no handler = byte-identical console-only logging. Imports only stdlib
# + os, so a top-level import forms no cycle.
from app.services.logging_sink import install_file_log_sink

# WR-02 (093 gap-closure review): belt-and-suspenders — the installer is itself
# fail-safe (returns None on a filesystem error), but guard the call site too so
# a diagnostic sink can never block startup, matching the best-effort posture of
# every other hook in this module.
try:
    _log_sink_path = install_file_log_sink()
    if _log_sink_path:
        logger.info("backend file log-sink active: %s", _log_sink_path)
except Exception:  # noqa: BLE001
    logger.warning(
        "backend file log-sink failed to install; continuing console-only",
        exc_info=True,
    )

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware.canvas_gate import CanvasGateMiddleware, build_canvas_aware_openapi
from app.middleware.maintenance import MaintenanceMiddleware
from app.middleware.setup import SetupMiddleware


def _patch_postgrest_maybe_single():
    """Fix postgrest-py bug: maybe_single() raises APIError on 204 (no rows) instead of returning None."""
    try:
        from postgrest._sync.request_builder import SyncSingleRequestBuilder
        from postgrest.exceptions import APIError
        _orig = SyncSingleRequestBuilder.execute

        def _safe(self):
            try:
                return _orig(self)
            except APIError as e:
                if getattr(e, "code", None) == "204":
                    class _Empty:
                        data = None
                        count = None
                    return _Empty()
                raise

        SyncSingleRequestBuilder.execute = _safe
    except Exception:
        pass


_patch_postgrest_maybe_single()

# Configure LangSmith tracing via environment variables
os.environ["LANGSMITH_TRACING"] = settings.langsmith_tracing
os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
if settings.langsmith_api_key:
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key


# Phase 081.1 Plan 02 — key routing constants for one-shot settings migration.
# Column names are code constants (never from user input) — SQL injection safe.
_DIRECT_COLUMNS: set[str] = {
    "llm_provider", "llm_model", "embedding_model", "embedding_base_url",
    "embedding_dimensions", "rerank_enabled", "rerank_provider", "rerank_model",
    "rerank_top_n", "retrieval_top_k", "retrieval_match_threshold",
    "hybrid_search_enabled", "hybrid_candidate_count", "vector_search_weight",
    "keyword_search_weight", "rrf_k", "web_search_max_results",
    "web_search_enabled", "sandbox_enabled", "context_window_max_tokens",
    "sub_agent_max_output_tokens", "sub_agent_model", "llm_max_output_tokens",
    "openrouter_tool_strategy", "ollama_base_url",
    # Phase 147 (FLAG-01, migration 097) — operator control-plane kill-switches.
    # Column names are code CONSTANTS (never user input) -> keeps save_app_settings
    # SQLi-safe (T-147-01). Values are parameterized ($N) in save_app_settings.
    "self_improve_enabled", "workflows_enabled", "maintenance_mode",
    # Phase 149 (MODEL-02, migration 099) — the single org-default lock flag. Written by
    # the dedicated PUT /admin/models/{id}/lock endpoint through save_app_settings; a code
    # CONSTANT (never user input) so the write stays SQLi-safe (value parameterized $N).
    "llm_model_locked",
    # Phase 159 (MODEL-03, migration 103) — the persisted discovery-filter default. Added here
    # for documentation-completeness of the legacy settings_override.json→DB migration path
    # (_migrate_settings_override — the ONLY consumer of _DIRECT_COLUMNS), mirroring the mig
    # 097/099 flag-column additions. This is NOT the write-path SQLi guard: the operator write
    # rides PUT /admin/flags → _FLAG_KEYS + save_app_settings's _VALID_COLUMN_NAME regex.
    "model_discovery_filter_enabled",
}

_PROVIDER_MODEL_KEYS: set[str] = {
    "openai_models", "anthropic_models", "google_models",
    "openrouter_models", "ollama_models", "deepseek_models",
    "moonshot_models", "minimax_models", "zhipu_models",
}

# CR-01 fix: allowset for API key column names prevents SQL injection
# from crafted JSON keys like "x; DROP TABLE --_api_key".
# Phase 150 (SEC-01) — single source of truth: re-pointed to the cipher module's
# SECRET_COLUMNS frozenset (identical 12-column set; secret_cipher does NOT import main,
# so there is no cycle). The legacy use at _migrate_settings_override (`key in
# _API_KEY_COLUMNS`) works unchanged against a frozenset.
from app.security.secret_cipher import SECRET_COLUMNS as _API_KEY_COLUMNS


async def _migrate_settings_override() -> None:
    """One-shot migration: settings_override.json -> app_settings DB table.

    Phase 081.1 D-01..D-05. Runs in lifespan after asyncpg pool init.
    Multi-worker safe via UPDATE ... WHERE id='global' (D-02).
    Idempotent: no-op if JSON file absent (D-05).
    Fail-safe: on any DB error, leaves file untouched for fallback (D-03).
    On success: renames file to .migrated (D-04).

    Phase 150 (SEC-01 / RESEARCH Pattern 5): this legacy path writes secret values as
    PLAINTEXT — no encryption is added here. The eager secret sweep (_sweep_secret_columns,
    later in the SAME lifespan boot) encrypts whatever this migration wrote (D-150-03 backstop).
    """
    import json as _json

    override_file = Path(__file__).resolve().parent.parent / "settings_override.json"
    if not override_file.exists():
        return  # D-05: idempotent no-op

    # Read and parse JSON — fail-safe (D-03): leave file untouched on error
    try:
        raw = override_file.read_text(encoding="utf-8")
        data: dict = _json.loads(raw)
    except (OSError, _json.JSONDecodeError) as e:
        logger.error("settings migration: cannot read/parse JSON: %s", e)
        return

    if not isinstance(data, dict) or not data:
        logger.warning("settings migration: empty or non-dict JSON — skipping")
        return

    # Categorize keys
    direct_updates: dict[str, object] = {}
    api_key_updates: dict[str, object] = {}
    provider_model_lists: dict[str, list[str]] = {}
    skipped_keys: list[str] = []

    for key, value in data.items():
        if key in _DIRECT_COLUMNS:
            direct_updates[key] = value
        elif key in _PROVIDER_MODEL_KEYS:
            provider = key.replace("_models", "")
            models = [m.strip() for m in str(value).split(",") if m.strip()]
            provider_model_lists[provider] = models
        elif key.endswith("_api_key") and key in _API_KEY_COLUMNS:
            api_key_updates[key] = value  # D-19: keys stay in app_settings DB
        else:
            skipped_keys.append(key)

    if skipped_keys:
        logger.warning("settings migration: skipping unknown keys: %s", skipped_keys)

    # Merge all into one update dict
    all_updates: dict[str, object] = {}
    all_updates.update(direct_updates)
    all_updates.update(api_key_updates)
    if provider_model_lists:
        all_updates["provider_model_lists"] = _json.dumps(provider_model_lists)

    if not all_updates:
        logger.info("settings migration: no routable keys found — skipping DB write")
        return

    # Build parameterized UPDATE query
    # Column names are from code constants (_DIRECT_COLUMNS etc.), not user input
    set_clauses = []
    values = []
    for i, (col, val) in enumerate(all_updates.items(), start=1):
        set_clauses.append(f"{col} = ${i}")
        values.append(val)
    set_clauses.append(f"updated_at = now()")
    query = f"UPDATE app_settings SET {', '.join(set_clauses)} WHERE id = 'global'"

    # Execute via asyncpg pool — fail-safe (D-03)
    from app.dependencies import get_pg_pool
    try:
        pool = await get_pg_pool()
        await pool.execute(query, *values)
    except Exception as e:
        logger.error("settings migration: DB write failed: %s", e)
        return  # D-03: leave file untouched for fallback

    # Success — rename file to .migrated (D-04)
    # Multi-worker race safe: FileNotFoundError means another worker already renamed
    migrated_count = len(direct_updates) + len(api_key_updates) + (1 if provider_model_lists else 0)
    try:
        override_file.rename(override_file.with_suffix(".json.migrated"))
    except FileNotFoundError:
        pass  # Another worker already renamed — safe

    # T-081.1-04: never log API key values, only key names and counts
    logger.info(
        "Migrated %d keys from settings_override.json (%d direct, %d api_keys, %d provider_model sets)",
        len(data), len(direct_updates), len(api_key_updates), len(provider_model_lists),
    )


def _validate_and_report_cipher():
    """Phase 150 (SEC-01 / D-150-04 / D-150-01) — boot-time master-key gate.

    Called UN-wrapped from lifespan (NO best-effort try/except — Pitfall 6). Returns the
    active MultiFernet, or None when no key is configured. Polarity:
      - MALFORMED SECRETS_ENCRYPTION_KEY -> get_cipher() raises ValueError, which PROPAGATES
        out of this function and out of lifespan, so ALL WORKER_COUNT=2 workers refuse to
        start (D-150-04 fail-hard). A typo'd key must NEVER silently boot plaintext. Mirrors
        the assert_action_types_synced hard-fail / the 075.4 UnknownProviderError.
      - MISSING key -> get_cipher() None -> one loud WARNING naming SECRETS_ENCRYPTION_KEY;
        secrets remain PLAINTEXT at rest (D-150-01 fail-open). Returns None.
    """
    from app.security.secret_cipher import get_cipher
    cipher = get_cipher()  # malformed key -> ValueError propagates (NOT swallowed)
    if cipher is None:
        logger.warning(
            "SECRETS_ENCRYPTION_KEY is not set — provider/API secrets in app_settings are "
            "stored PLAINTEXT at rest until it is configured (D-150-01 fail-open)."
        )
    return cipher


async def _sweep_secret_columns(pool) -> dict[str, str]:
    """Phase 150 (SEC-01 / D-150-03 / D-150-06) — eager, idempotent at-rest secret sweep.

    Reads the id='global' app_settings row, asks sweep_row which secret columns need
    (re)encryption (plaintext -> enc:v1:, or a value under an OLD key -> rotate to the
    primary key), and issues ONE parameterized UPDATE writing ONLY the changed columns.
    Returns the {col: new_enc_value} that changed ({} when already converged — a no-op boot).

    Idempotent (D-150-03): sweep_row skips values already under the primary key, so a second
    call returns {} and issues no UPDATE. WORKER_COUNT=2-safe with NO lock — encrypting the
    same plaintext twice yields two valid ciphertexts (last-writer-wins, both decrypt
    identically), and the enc:v1: prefix check keeps it from re-wrapping. Column names are
    from sweep_row's SECRET_COLUMNS allowlist (never user input -> SQLi-safe, T-081.1-04);
    values are parameterized ($N). Logs NEVER carry a value or token (T-150-02).
    """
    from app.security.secret_cipher import sweep_row

    row = await pool.fetchrow("SELECT * FROM app_settings WHERE id = 'global'")
    if row is None:
        return {}
    changed = sweep_row(dict(row))
    if not changed:
        return {}

    cols = list(changed.keys())
    set_clause = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(cols))
    vals = list(changed.values())
    vals.append("global")  # WHERE id = $N
    await pool.execute(
        f"UPDATE app_settings SET {set_clause}, updated_at = now() WHERE id = ${len(vals)}",
        *vals,
    )
    return changed


@asynccontextmanager
async def lifespan(app_instance):
    # Startup: bump AnyIO default thread limiter so SSE-path .execute()
    # wraps don't queue at the 40-token default (research §A2, D-058-07).
    # Env-overridable via ANYIO_THREAD_TOKENS.
    anyio.to_thread.current_default_thread_limiter().total_tokens = (
        settings.anyio_thread_tokens
    )

    # Phase 158 (DEPLOY-02 / D-03) — setup-mode tolerance. Derive ONCE from the blip-proof
    # FILE marker (a cheap read, NO DB): a fresh/unbound box (finalize marker unset) boots into
    # setup mode so the operator reaches /setup and reads the token, instead of crash-looping on
    # the ONE un-guarded DB hard-fail below (assert_action_types_synced, RESEARCH Pattern 3 /
    # Pitfall 3). A FINALIZED box is byte-identical to today — the audit guard runs and all four
    # reconcilers spawn. NEVER a DB read (D-05): a transient DB outage must not flip a configured
    # box into setup mode.
    from app.services import setup_store  # noqa: F401 — kept for announce_token_if_unfinalized below
    from app.config import needs_setup, settings as _setup_cfg
    # _setup_mode is TRUE only for a GENUINELY-fresh box (placeholder infra AND no finalize
    # marker). A box configured via env (real supabase_url, no marker — every existing deploy
    # and every local dev box) reads False here and boots byte-identically (audit guard + all
    # four reconcilers run). needs_setup is a file+string check (D-05), NEVER a DB read — a
    # transient DB outage cannot flip a configured box into setup mode.
    _setup_mode = needs_setup(_setup_cfg)
    if _setup_mode:
        # D-15 — surface the first-boot setup token to stdout (`docker compose logs backend`)
        # exactly once. Best-effort (mirrors every other lifespan side-effect): a setup-store
        # write failure must not crash the boot (D-03 degrade-not-crash); the box still boots
        # into setup mode so the operator can act.
        try:
            setup_store.announce_token_if_unfinalized()
        except Exception:  # noqa: BLE001 — announce is advisory; a store-write blip must not crash boot
            logger.warning("setup-token announce failed (app continues in setup mode)", exc_info=True)

    # Phase 061 (D-061-13, T-061-05): best-effort Redis startup PING.
    # Do NOT block startup if Redis is unreachable — the warning log makes
    # misconfiguration loud. Never log settings.redis_url verbatim (may
    # contain credentials in cloud setups, e.g. rediss://default:PASSWORD@host).
    from app.dependencies import get_redis
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=1.0)
        logger.info("Redis ping ok")
    except Exception as e:
        logger.warning("Redis unreachable (run-backed streaming will fail): %s", type(e).__name__)

    # Phase 081.1 D-01: one-shot settings migration (after asyncpg pool init)
    from app.dependencies import get_pg_pool
    try:
        await get_pg_pool()  # ensure pool exists before migration
        await _migrate_settings_override()
    except Exception as e:
        logger.error("Settings migration failed (app continues with file fallback): %s", e)

    # Phase 150 (SEC-01) — at-rest secret encryption: boot-time key gate + eager sweep.
    # TWO steps in DELIBERATELY DIFFERENT polarities (RESEARCH §Pattern 4):
    #   (1) KEY VALIDATION is HARD-FAIL — _validate_and_report_cipher() is called UN-wrapped
    #       (NO try/except, Pitfall 6): a MALFORMED key raises ValueError that refuses startup
    #       for all WORKER_COUNT=2 workers (D-150-04, mirrors assert_action_types_synced below /
    #       the 075.4 UnknownProviderError); a MISSING key warns + boots plaintext (D-150-01).
    #   (2) EAGER SWEEP is BEST-EFFORT (try/except -> log + continue, mirrors the operator-seed
    #       block below), runs ONLY when a key is present, encrypts existing plaintext in place +
    #       rotates non-primary values (D-150-03 idempotent / D-150-06 rotation). Runs AFTER
    #       _migrate_settings_override() so it encrypts whatever the legacy migration just wrote.
    _secret_cipher = _validate_and_report_cipher()  # UN-wrapped: malformed key => refuse startup
    if _secret_cipher is not None:
        try:
            _swept = await _sweep_secret_columns(await get_pg_pool())
            if _swept:
                logger.info(
                    "Secret sweep encrypted/rotated %d secret column(s): %s",
                    len(_swept), sorted(_swept.keys()),
                )
        except Exception as e:
            logger.error("Secret sweep failed (app continues; retries next boot): %s", e)

    # Phase 146 D-01: idempotent operator bootstrap from OPERATOR_EMAILS (after the
    # asyncpg pool is ensured). The DB table (operator_users) is the runtime source of
    # truth; the env var is bootstrap-only. Best-effort — mirrors the settings-migration
    # block above (logs on failure, NEVER blocks startup). Concurrent-safe under
    # WORKER_COUNT=2 by construction: seed_operators_from_env upserts INSERT ... ON
    # CONFLICT (user_id) DO NOTHING, so both workers race, the first wins, the second
    # no-ops — NO lock/leader-election needed. An OPERATOR_EMAILS entry with no matching
    # auth.users row is warned-and-deferred inside the seed (re-seeds on a later restart
    # once the user signs up).
    from app.services.operator_service import seed_operators_from_env
    try:
        await get_pg_pool()  # ensure pool exists before the seed write
        await seed_operators_from_env()
    except Exception as e:
        logger.error("Operator seed failed (app continues, no operators bootstrapped): %s", e)

    # Phase 110 DMF-01 / D-110-4 — audit-enum drift guard. MUST hard-fail (unlike the
    # best-effort blocks above): a frozenset⊄live-CHECK drift = a silent prod audit hole.
    # Mirrors the 075.4 UnknownProviderError-at-startup pattern. Runs per worker (read-only,
    # idempotent; a drift crashes all WORKER_COUNT workers identically — the desired loud fail).
    # Phase 158 (D-03): this is the ONE un-guarded DB hard-fail (RESEARCH Pattern 3) — in setup
    # mode get_pg_pool() awaits an unreachable DB and raises, the crash that hides the setup
    # token (Pitfall 3). DEFER it until finalize; a CONFIGURED box STILL runs it (byte-identical:
    # the loud drift guard is preserved for a bound box).
    if not _setup_mode:
        from app.services.audit_service import assert_action_types_synced
        await assert_action_types_synced(await get_pg_pool())
    else:
        logger.warning(
            "SETUP MODE — DB unbound; deferring audit-enum drift guard until finalize"
        )

    # Phase 091 HARNESS-03 — resume runs left `active` by a restart. CLAIMS each
    # run (CAS) so WORKER_COUNT=2 workers never double-execute (Pitfall 7), and
    # resumes a mid-ask_user phase correctly (answered → proceed; pending →
    # re-subscribe+re-emit, subscribe-before-emit). Spawned as a BACKGROUND task so
    # a slow resume never blocks startup; best-effort (logs + continues on error).
    async def _resume_stranded():
        try:
            from app.services.harness_engine import resume_stranded_workflows
            from app.dependencies import get_redis
            count = await resume_stranded_workflows(
                pool=await get_pg_pool(), redis=get_redis()
            )
            if count:
                logger.info("Harness resume sweep re-ran %d stranded run(s)", count)
        except Exception:
            logger.exception("Harness resume sweep failed (app continues)")

    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no DB to reconcile
        asyncio.create_task(_resume_stranded())

    # Phase 137.1 (EVAL-05g / BUG-260702-02) — boot-time orphan reconciler. When a
    # restart kills the in-process task driving a run, its terminal DB transition is
    # never written and the row is stranded non-terminal forever (the user sees a run
    # "running" with no error/timeout/recovery). This sweep honestly terminalizes
    # orphans (eval → interrupted, chat → failed) + drops their stale Redis streams,
    # guarded by a single-shot SET NX so WORKER_COUNT=2 never double-sweeps (mirrors
    # _resume_stranded). Best-effort BACKGROUND task: a slow or failed sweep never
    # blocks startup (logs + the app continues). Additive — NOT in threads.py (G-5),
    # no agent-loop touch (D-14).
    async def _reconcile_orphans():
        try:
            from app.services.run_reconciler import reconcile_orphaned_runs
            from app.dependencies import get_redis, get_supabase
            count = await reconcile_orphaned_runs(
                pool=await get_pg_pool(), redis=get_redis(), supabase=get_supabase()
            )
            if count:
                logger.info("Run reconciler closed %d orphaned run(s)", count)
        except Exception:
            logger.exception("Run reconciler failed (app continues)")

    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no DB to reconcile
        asyncio.create_task(_reconcile_orphans())

    # Phase 100 (TMPL-01, D-07) — in-process janitor: GC expired template rows +
    # ALL their Storage version bytes every ~15 min. Best-effort (failure logs +
    # the app continues; the NEXT cadence re-runs). Idempotent by construction
    # (sweep_expired SELECTs only `expires_at <= now()` and DELETE-rowcount-skips a
    # row a sibling worker raced), so WORKER_COUNT=2 is safe with NO lock — every
    # worker can run its own sweep harmlessly. ALL sweep logic lives in
    # template_service (this is a thin call-through). The guarantee is the read
    # filter (Plans 03/04); this sweep is pure garbage collection.
    async def _sweep_expired_templates():
        while True:
            try:
                from app.services.template_service import sweep_expired
                from app.dependencies import get_supabase
                n = await sweep_expired(pool=await get_pg_pool(), supabase=get_supabase())
                if n:
                    logger.info("Template sweep deleted %d expired template(s)", n)
            except Exception:
                logger.exception("Template sweep failed (app continues)")
            await asyncio.sleep(15 * 60)   # D-07 ~15 min cadence

    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no templates to sweep
        asyncio.create_task(_sweep_expired_templates())

    # Phase 145 (FND-01 / D-145-06 / D-145-08) — PERIODIC stream-age orphan sweep. The
    # boot reconciler above heals restart-orphans ONCE; this INTERVAL task corrects a
    # LYING runs.status that appears WHILE the app runs — a producer that dies mid-stream
    # on a still-up worker (broken SSE / crashed task) leaves runs.status='streaming'
    # forever, and under D-145-02 the run STAYS in runs:active so membership is blind
    # (145-REPRO Direction B). reconcile_orphaned_runs' stream-age oracle catches it. This
    # caller (a) EXCLUDES cap_paused (legitimately quiet, re-attachable — Pitfall 3) and
    # (b) uses a SHORT lock_ttl=90 (< the 120s tick) so exactly ONE WORKER_COUNT=2 worker
    # sweeps per tick and the SET NX guard self-expires before the next tick (D-145-08).
    # Same shape as _sweep_expired_templates (while True + asyncio.sleep), NOT folded into
    # resume_stranded_workflows (boot-only, re-drives — wrong semantics). Best-effort
    # background task: a slow/failed sweep never blocks the app (logs + the next tick re-runs).
    async def _reconcile_orphans_periodic():
        while True:
            try:
                from app.services.run_reconciler import reconcile_orphaned_runs
                from app.dependencies import get_redis, get_supabase
                count = await reconcile_orphaned_runs(
                    pool=await get_pg_pool(),
                    redis=get_redis(),
                    supabase=get_supabase(),
                    lock_ttl=90,
                    include_cap_paused=False,
                )
                if count:
                    logger.info("Periodic run reconciler closed %d orphan(s)", count)
            except Exception:
                logger.exception("Periodic run reconciler failed (app continues)")
            await asyncio.sleep(settings.run_stale_sweep_interval_seconds)

    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no runs to reconcile
        asyncio.create_task(_reconcile_orphans_periodic())

    # Phase 204 (SCHED-01 / D-204-09 / D-204-11) — the background workflow scheduler.
    # ADDITIVE and OFF BY DEFAULT (`scheduler_process_enabled`): a box that has never
    # been told to schedule anything boots byte-identically to before this phase.
    #
    # ⚠ IT RUNS IN EVERY WORKER ON PURPOSE, with no leader election and no lock held
    # here. Exactly-once is owned by `db/schedules.claim_due_schedules` — FOR UPDATE
    # SKIP LOCKED plus the next_run_at advance INSIDE the claiming transaction — which
    # is a property of the database rather than of whichever worker happened to win an
    # election. A leader scheme's failure mode is that the leader dies and NOTHING
    # fires, silently; this one has no such state.
    #
    # Same shape as the three sweeps above (background task, best-effort, never blocks
    # startup) and, like them, skipped in setup mode — a fresh box has no schedules.
    # The service is parked on `app_instance.state` so shutdown can stop it and so a
    # test can reach it without importing module globals.
    _scheduler = None
    if not _setup_mode and settings.scheduler_process_enabled:
        try:
            from app.services.scheduler_service import SchedulerService
            from app.dependencies import get_redis

            _scheduler = SchedulerService(
                pool=await get_pg_pool(),
                redis=get_redis(),
                poll_interval_seconds=settings.scheduler_poll_interval_seconds,
                max_claims_per_tick=settings.scheduler_max_claims_per_tick,
            )
            _scheduler.start()
            logger.info(
                "Workflow scheduler started (poll every %ds, max %d claims/tick)",
                settings.scheduler_poll_interval_seconds,
                settings.scheduler_max_claims_per_tick,
            )
        except Exception:
            logger.exception("Workflow scheduler failed to start (app continues)")
            _scheduler = None
    app_instance.state.workflow_scheduler = _scheduler

    # Phase 230 (QUEUE-01 / QUEUE-05 / D-05) — the durable ingestion queue daemon.
    # Runs in every worker with concurrency bounding and stale claim recovery (G-1).
    _ingestion_queue = None
    if not _setup_mode and getattr(settings, "ingest_worker_enabled", True):
        try:
            from app.services.ingestion_queue_service import IngestionQueueService
            from app.dependencies import get_supabase

            _pg_pool = await get_pg_pool()
            _ingestion_queue = IngestionQueueService(
                pool=_pg_pool,
                supabase_factory=get_supabase,
                max_concurrent_jobs=settings.ingest_max_concurrent_jobs,
                poll_interval_seconds=settings.ingest_poll_interval_seconds,
                lease_timeout_seconds=settings.ingest_lease_timeout_seconds,
            )
            # Boot-time sweep to rescue in-flight jobs stranded across restarts (G-1 / SC#1)
            await _ingestion_queue.run_stale_sweep()
            _ingestion_queue.start()
            logger.info(
                "Ingestion queue service started (max concurrent %d, poll every %.1fs)",
                settings.ingest_max_concurrent_jobs,
                settings.ingest_poll_interval_seconds,
            )
        except Exception:
            logger.exception("Ingestion queue service failed to start (app continues)")
            _ingestion_queue = None
    app_instance.state.ingestion_queue_service = _ingestion_queue

    # Phase 234 (LIB-08 / QUEUE-03) — the background connector watch loop.
    # Off by default, safe across multiple uvicorn workers with database-level claim exclusivity.
    _watch_service = None
    if not _setup_mode and getattr(settings, "watch_process_enabled", False):
        try:
            from app.services.watch_service import WatchService
            from app.dependencies import get_supabase

            _pg_pool = await get_pg_pool()
            _watch_service = WatchService(
                pool=_pg_pool,
                settings=settings,
                supabase=get_supabase(),
            )
            _watch_service.start()
            logger.info(
                "Watch service started (poll every %ds, lease %ds)",
                settings.watch_poll_interval_seconds,
                settings.watch_lease_seconds,
            )
        except Exception:
            logger.exception("Watch service failed to start (app continues)")
            _watch_service = None
    app_instance.state.watch_service = _watch_service

    # BUG-260902-06 — the cross-worker settings/model-registry cache invalidator.
    #
    # ⚠ IT RUNS IN EVERY WORKER ON PURPOSE, and unlike the scheduler above that is the whole
    # point: the defect is that `_settings_cache` / `_model_overrides_cache` /
    # `_all_model_overrides_cache` are MODULE globals — per PROCESS — behind a 30s TTL, while
    # WORKER_COUNT=2 is the default. A write invalidated the writing worker and nowhere else,
    # so whether a change was visible was a coin flip on which worker served the next read.
    # Each worker subscribes to one channel and RE-WARMS on receipt (re-warm, never merely
    # invalidate — `load_app_settings()` is SYNC and never checks the timestamp).
    #
    # FAIL SOFT, deliberately unconditional: no kill switch, because a box with no Redis
    # already degrades to exactly the pre-existing TTL behaviour. `start()` returns
    # immediately (startup is never blocked on Redis) and the loop reconnects forever without
    # propagating. Skipped only in setup mode, like every other background service here.
    _settings_subscriber = None
    if not _setup_mode:
        try:
            from app.dependencies import get_redis
            from app.services.settings_broadcast import SettingsCacheSubscriber

            _settings_subscriber = SettingsCacheSubscriber(redis=get_redis())
            _settings_subscriber.start()
            logger.info("Settings cache subscriber started (cross-worker invalidation)")
        except Exception:
            logger.exception(
                "Settings cache subscriber failed to start (app continues on the 30s TTL)"
            )
            _settings_subscriber = None
    app_instance.state.settings_cache_subscriber = _settings_subscriber

    yield

    # BUG-260902-06 — stop the settings cache subscriber. Best-effort with its own deadline
    # inside `stop()`, so a half-dead Redis socket cannot wedge shutdown.
    try:
        _sub = getattr(app_instance.state, "settings_cache_subscriber", None)
        if _sub is not None:
            await _sub.stop()
    except Exception:
        logger.exception("Settings cache subscriber stop failed at lifespan shutdown")

    # Phase 204 (SCHED-01) — stop the scheduler FIRST among the shutdown steps that
    # touch runs. It is the only component that STARTS new work; leaving it ticking
    # while the producer-cancel loop below tears down live runs would race a fresh
    # launch against a shutting-down pool. Best-effort — a failed stop never blocks
    # shutdown.
    try:
        _sched = getattr(app_instance.state, "workflow_scheduler", None)
        if _sched is not None:
            await _sched.stop()
    except Exception:  # noqa: BLE001
        logger.exception("Workflow scheduler stop failed at lifespan shutdown")

    # Phase 230 — stop the ingestion queue worker before cancelling in-flight tasks
    try:
        _iq = getattr(app_instance.state, "ingestion_queue_service", None)
        if _iq is not None:
            await _iq.stop()
    except Exception:  # noqa: BLE001
        logger.exception("Ingestion queue service stop failed at lifespan shutdown")

    # Phase 234 — stop the watch service
    try:
        _ws = getattr(app_instance.state, "watch_service", None)
        if _ws is not None:
            _ws.stop()
    except Exception:  # noqa: BLE001
        logger.exception("Watch service stop failed at lifespan shutdown")

    # 096-09 (UAT Test 2 restart-resumability fix): mark the process as shutting
    # down as the FIRST shutdown step — before the ask_user sentinel broadcast and
    # the producer-cancel loop below. Set first so there is NO wake-ordering race:
    # any paused harness producer that the sentinel/cancel wakes will observe the
    # flag and leave its workflow_runs row active+anchored for the next-boot resume
    # sweep, instead of terminalizing to 'failed'. Deep runs are unaffected.
    # Best-effort: a failed import never blocks shutdown.
    try:
        from app.services.harness_engine import set_app_shutting_down
        set_app_shutting_down(True)
    except Exception:  # noqa: BLE001
        logger.exception("set_app_shutting_down failed at lifespan shutdown")

    # Phase 085 D-085-07 — broadcast ask_user shutdown sentinel BEFORE cancelling
    # the producer tasks below (RESEARCH §A.6 PUBLISH-first ordering). Allows
    # any paused _handle_ask_user calls to return a normal ToolResult
    # ("ask_user interrupted by server shutdown") so the agent loop iterates
    # once more and the run finalizes with status='failed' (T-085-T17 — paused
    # runs would otherwise remain stuck in status='streaming' forever after
    # uvicorn restarts).
    #
    # Best-effort + 2s deadline — NEVER block shutdown on Redis failure or
    # half-dead Redis sockets (matches the broader "graceful shutdown" rule
    # at this site).
    try:
        from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all
        from app.dependencies import get_redis
        await asyncio.wait_for(
            broadcast_shutdown_sentinel_to_all(get_redis()),
            timeout=2.0,
        )
    except Exception:
        logger.exception("ask_user shutdown sentinel broadcast failed")

    # Phase 061 (D-061-11): cancel all in-flight producer tasks (registry
    # lives in threads.py; late-bind import to avoid circular import at
    # module load — same pattern as the sandbox_manager import below).
    try:
        from app.api.threads import RUN_TASKS
        for task in list(RUN_TASKS.values()):
            if not task.done():
                task.cancel()
        if RUN_TASKS:
            await asyncio.gather(*RUN_TASKS.values(), return_exceptions=True)
    except ImportError:
        # Plan 03 hasn't landed yet — RUN_TASKS doesn't exist. Safe no-op.
        pass

    # Close the Redis client AFTER cancelling producer tasks (so producers
    # finishing their finally blocks can still write terminal sentinels).
    try:
        from app.dependencies import get_redis
        await get_redis().aclose()
    except Exception:
        logger.exception("Redis aclose failed at shutdown")

    # Phase 073 — close the asyncpg pool BEFORE Supabase (matches Redis-then-Supabase
    # order). pool.close() waits for in-flight queries; wrap in wait_for so a stuck
    # query can't wedge shutdown (Pitfall 4). Falls back to pool.terminate() on
    # timeout (fire-and-forget; kills sockets immediately).
    try:
        from app.dependencies import _pg_pool
        if _pg_pool is not None:
            try:
                await asyncio.wait_for(_pg_pool.close(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("pg pool close timed out — terminating")
                _pg_pool.terminate()
    except Exception:
        logger.exception("pg pool close failed at shutdown")

    # Phase 078 (CQ-SUPA-01, D-078-09): close the Supabase singleton client.
    # Runs AFTER asyncpg pool close (step 3), BEFORE sandbox close (step 4).
    # supabase-py sync Client has no aclose(); check for both async and sync variants.
    try:
        from app.dependencies import _supabase
        if _supabase is not None:
            if hasattr(_supabase, "aclose"):
                await _supabase.aclose()
            elif hasattr(_supabase, "close"):
                _supabase.close()
    except Exception:
        logger.exception("Supabase client close failed at shutdown")

    # Shutdown: close all open sandbox sessions to free Docker containers
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()


app = FastAPI(title="Agentic RAG API", version="1.0.0", lifespan=lifespan)

# Phase 182 (VALID-01 / D-182-R2-02) — the SCHEMA half of the canvas off-switch. `/openapi.json`
# is anonymous + unconditional on every finalized deploy; while the canvas was off it still
# published both gated paths and every canvas-only model, i.e. a complete map of the surface the
# 404 hides (CR-02). This hook filters that document per request while off, and returns the app's
# own full document untouched while on. FastAPI resolves the app's schema callable at REQUEST time
# (applications.py:1009), so replacing the instance attribute here is honored on every request.
#
# Two deliberate boundaries, recorded so a future verifier does not re-raise them as leaks:
#   * `include_in_schema=False` was REJECTED — it would hide both routes from /docs permanently,
#     including while the canvas is ON, degrading the API docs for the whole remainder of v3.6
#     (phases 183-189 all build on this seam). The dynamic hook tracks the live flag instead.
#   * `GET /docs` deliberately keeps returning 200 in BOTH flag states. It is a static Swagger UI
#     shell carrying no route information of its own — it renders whatever the filtered document
#     says. App-wide `docs_url` gating has never been a convention in this codebase and is not
#     introduced here.
app.openapi = build_canvas_aware_openapi(app)

# Phase 182 (VALID-01 / D-182-R2-01) — the canvas off-switch's request-path gate. Decides
# ``visual_workflow_canvas`` BEFORE Starlette routing and before FastAPI decodes any body,
# so a malformed body can no longer 422 ahead of the gate's 404 and a wrong-method probe can
# no longer 405 (both leaked that the route exists while off — CR-01).
#
# REGISTRATION ORDER IS LOAD-BEARING. Starlette applies add_middleware in REVERSE
# registration order (the LAST-registered wraps the rest), so registering FIRST makes this
# the INNERMOST middleware: it runs AFTER SetupMiddleware and MaintenanceMiddleware and
# immediately BEFORE the router. That is exactly right for byte-identity — on an unfinalized
# box an unbuilt path returns the setup 503, and under maintenance a mutating request to an
# unbuilt path returns the maintenance 503; if the canvas gate ran OUTSIDE those, a gated
# path would answer 404 where an unbuilt path answers 503, which is itself a distinguishing
# signal. CORS stays outermost, so this 404 still carries CORS headers exactly as the
# router's own 404 does.
#
# Pure-ASGI (NOT BaseHTTPMiddleware) so it never buffers the SSE stream; it reads the flag
# from the in-memory settings cache and fails CLOSED on a cold/blip read (D-181-02 — the
# deliberate opposite of Maintenance's fail-OPEN). D-v2.5-01's "no per-request DB call" holds
# for every request EXCEPT the gated paths themselves, which await a TTL-checked refresh
# first so the kill switch cannot be enforced from an unboundedly stale cache
# (T-184-UAT-02) — at most one query per 30s per worker, and none on the hot path.
# ``Depends(require_canvas())`` REMAINS on both canvas routes as defense in depth (D-182-05):
# this seam owns only the master off-switch, the dependency still owns caller resolution and
# the operator/everyone/role audience.
app.add_middleware(CanvasGateMiddleware)

# Phase 147 (FLAG-01 / D-06) — maintenance/read-only write-block seam. Registered
# BEFORE CORS so CORS ends up OUTERMOST (Starlette applies add_middleware in reverse
# registration order — the LAST-registered wraps the rest). CORS-outermost means:
#   (a) CORS still answers OPTIONS preflight in maintenance, and
#   (b) a 503 write-block still carries CORS headers so the browser can READ it
#       (a maintenance-outermost 503 would surface as an opaque CORS error).
# Pure-ASGI middleware (NOT BaseHTTPMiddleware) so it never buffers the SSE stream; it
# reads the flag from the in-memory TTL settings cache (no per-request DB, D-v2.5-01)
# and fails OPEN on a cold/blip read (D-Q4). The allowlist keeps the off-switch
# (PUT /admin/flags), login, and DELETE /runs/{id} reachable even under maintenance.
app.add_middleware(MaintenanceMiddleware)

# Phase 158 (DEPLOY-02 / D-04) — first-run setup gate. Registered alongside Maintenance and
# BEFORE CORS so CORS stays OUTERMOST (a 503 setup_required still carries CORS headers so the
# browser can READ it, not surface an opaque CORS error). Pure-ASGI (NOT BaseHTTPMiddleware) so
# it never buffers the SSE stream; it reads the blip-proof FILE marker through a monotonic
# finalized-latch (NEVER the DB, D-05), so a CONFIGURED box is a single-bool no-op —
# byte-identical (D-17). Pre-finalize it gates everything EXCEPT the allowlist (/health,
# /public-config, /setup/*) so an unbound box stays observable and the operator can reach the
# wizard. Sits OUTSIDE Maintenance (runs first) so a fresh box is gated with zero DB touch.
app.add_middleware(SetupMiddleware)

# FRONTEND_URL may hold one origin or a comma-separated list (e.g.
# "https://superrag.cloud,https://agentic-rag-rho.vercel.app"). Split + strip
# so multiple production origins can be allowed without a code change; a single
# value stays valid (one-element list).
_allowed_origins = [o.strip() for o in settings.frontend_url.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    from app.dependencies import get_redis
    from app.models.user_settings import maintenance_mode
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=1.0)
        redis_status = "ok"
    except Exception:
        redis_status = "unreachable"
    # Phase 147 (FLAG-01 / D-06) — additive maintenance boolean so the end-user
    # (non-operator) banner has a PUBLIC flag source without hitting /admin (which is
    # 404 to non-operators). Boolean ONLY — no other settings may leak here (T-147-15).
    # Read via the same in-memory TTL cache (maintenance_mode(): fail-OPEN, no DB call).
    return {"status": "ok", "redis": redis_status, "maintenance": maintenance_mode()}


@app.get("/models")
async def list_models():
    if settings.available_models:
        models = [m.strip() for m in settings.available_models.split(",") if m.strip()]
    else:
        models = [settings.llm_model]
    return {"models": models, "default": settings.llm_model}


from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback, sandbox_outputs, workspace, admin, panel, workflows, workflow_runs, metadata_fields, document_views, document_relationships, classification_rules, document_governance, skill_tuner, skill_test_cases, evals, features, setup as setup_api, org, me_preferences, connectors, model_registry, schedules, document_queries, library, checked_queries, takeoff, sources  # noqa: E402

app.include_router(threads.router)
app.include_router(runs.router)
app.include_router(documents.router)
app.include_router(settings_api.router)
app.include_router(folders.router)
app.include_router(kb.router)
app.include_router(skills.router)
app.include_router(audit.router)
app.include_router(knowledge_health.router)
app.include_router(feedback.router)
app.include_router(sandbox_outputs.router)
app.include_router(workspace.router)
app.include_router(admin.router)
app.include_router(panel.router)  # Phase 085 D-085-23 — thread-scoped panel data endpoints
app.include_router(workflows.router)  # Phase 092 MODE-01 — published-workflows picker feed
app.include_router(workflow_runs.router)  # Phase 188 RUNVIZ-03 — GET /workflow-runs/{id}: the one net-new read that gives a RUN an address (run + the definition version that RAN + the durable phase spine, D-188-14); ownership-gated 404 + require_canvas ALONE, path template registered in CANVAS_GATED_PATHS (D-188-15/16)
app.include_router(metadata_fields.router)  # Phase 111 META-01 — custom metadata field-definition CRUD
app.include_router(document_views.router)  # Phase 113 VIEW-01/02 — virtual-folder views CRUD + per-viewer resolve
app.include_router(document_relationships.router)  # Phase 116 REL-01/03 — typed document-relationship CRUD (visible-both gate + audit)
app.include_router(classification_rules.router)  # Phase 118 CLASS-01 — classification-rule CRUD (leak-safe own+global, is_system_global hard-false, match_expr validation + audit)
app.include_router(document_governance.router)  # Phase 119 DGOV-01/02 — read-only governance aggregation (broken-rel / unclassified / low-conf; owner-scoped reads, no write path)
app.include_router(skill_tuner.router)  # Phase 123 TRIG-01 — owner-scoped Skill Trigger Tuner (bounded background run over the run-buffer + tuner_* SSE + held-out scoreboard)
app.include_router(skill_test_cases.router)  # Phase 132 EVAL-01/VER-01 — owner-scoped eval test-case CRUD + read-only skill version history
app.include_router(evals.router)  # Phase 133 EVAL-02 — owner-scoped eval runner control surface (POST kickoff + GET results/list; companion runs row reuses runs.py stream/cancel)
app.include_router(evals.router_evals)  # Phase 137.1 EVAL-05 — skill-LESS eval surface (POST engine-sweep + GET engine-health + GET /evals/runs/{id} skill-less readout; matrix launch stays on evals.router)
app.include_router(features.router)  # Phase 148 VIS-01 — authenticated per-user GET /features effective-map (NOT operator-gated; top-level, not under /admin — non-operators must reach it to learn their own map)
app.include_router(setup_api.router)  # Phase 158 DEPLOY-02 — pre-auth token-gated /setup/* wizard API + open GET /setup/status (SetupMiddleware-allowlisted)
app.include_router(setup_api.public_router)  # Phase 158 D-07 — open top-level GET /public-config (browser Supabase creds so login works without a frontend rebuild)
app.include_router(org.router)  # Phase 166 ADMIN-01/02/04 — org-admin surface (server-validated X-Org-Id + org:manage gate; /org/me probe, read-only members roster, org-scoped audit degrade)
app.include_router(connectors.router)  # Phase 190 CONN-02/CONN-03 — connector-connection CRUD (Settings → Connections, D-25). Org-WIDE reads (U-02: read + bind), org-admin writes API-ENFORCED via require_org_manage, per-endpoint require_visible("live_connectors") on the writes ONLY (never router-level), 404-not-403 on every cross-org miss
app.include_router(me_preferences.router)  # Phase 167 VIS-02 — per-user model-default preference (SEED-116 two-layer: operator allowed-set + lock; per-user RLS write, NOT the service-role settings writer)
app.include_router(model_registry.router)  # Phase 196 AUTH-04/D-01 — the non-operator model-registry union GET /models/registry (NOT operator-gated and NOT under /admin: an author must reach it to pick a model, and /admin/models stays default-deny with no RLS backstop). Six-field ALLOWLIST projection (to_author_row), never a drop-list
app.include_router(schedules.router)  # Phase 204 SCHED-01 — the schedule's own address space (/schedules): list, patch, delete, trigger. Owner-scoped on every route, 404-not-403 on every miss. `claim_due_schedules` is deliberately unrouted and unimported there (it is owner-AGNOSTIC by construction)
app.include_router(document_queries.router)  # Phase 217 LIB-04 / D-217-06 + D-217-07 — GET /documents/{id}/queries: "the questions that found it", derived from the audit_log search.query rows the retrieval path already writes. Its own module (and its own CLASSIFIED service-role rationale) so api/documents.py stays uniformly user-JWT. Shares the /documents prefix with documents.router; registered AFTER it so every older, more specific /documents route keeps its precedence — no path collides (documents.py has no GET /documents/{id} and no catch-all)
app.include_router(library.router)  # Phase 217.1 (BE-2 / D-217.1-27) — GET /library/index-summary: the Indexing tab's UNGATED, RLS-enforced corpus facts (vector store / embedding model / folders cards). Deliberately NOT in api/documents.py (71/31/2535, G-5 HARD — a cross-folder aggregate is the wrong direction there), following document_queries.py's one-route-module precedent
app.include_router(checked_queries.router)  # Phase 217.1 (BE-6 / D-217.1) — checked-queries CRUD + check trigger. Private assertion about the caller's corpus; 108 Shape A RLS, no org-wide read branch.
app.include_router(takeoff.router)  # Phase 220 (TAKEOFF-02/03) — CAD takeoff extraction & rate sheet BOQ matching. Shares the /documents prefix with api/documents.py.
app.include_router(schedules.workflow_router)  # Phase 204 SCHED-01 — the workflow-anchored half (/workflows/{id}/schedules: create + list). Shares the /workflows prefix with api/workflows.py; no path collides. Registered AFTER workflows.router so the older, more specific routes keep their precedence
app.include_router(sources.router)  # Phase 234 (LIB-08 / SURF-01 / VIS-05) — folder watches & source sync (/sources)
app.include_router(sources.router, prefix="/api")  # Phase 234 alias (/api/sources)
# Phase 182 (D-182-04): the TEMPORARY Phase-181 "/canvas/ping" canary router was RETIRED here.
# The real require_canvas-gated routes (POST /workflows/validate + GET /workflows/grounding-bundle,
# mounted on workflows.router above) now carry the byte-identical 404-when-off gate, so the
# throwaway probe is redundant. Do not re-add it — add the 404-when-off assertion to the REAL
# route instead (backend/tests/test_revert_byte_identical.py).


# Phase 063 Plan 05 — test-only fixture endpoints (e2e harness support).
# Threat T-063-05-01: gated by ENABLE_TEST_FIXTURES=1 so the route does
# NOT exist in production. CI/staging/prod env files MUST NOT set this
# variable. The mount also emits a startup warning when enabled so any
# misconfigured production deploy is loud.
#
# BL-04 fix: hard refusal-to-start when ENABLE_TEST_FIXTURES is on AND the
# environment looks like production. Belt-and-suspenders so an accidental
# env var flip in a prod-like deploy crashes loudly at startup rather than
# silently exposing the route.
if os.getenv("ENABLE_TEST_FIXTURES", "0") == "1":
    if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError(
            "ENABLE_TEST_FIXTURES=1 in production environment — refusing to start. "
            "This env var is for local Playwright e2e harness use only "
            "(Phase 063 T-063-05-01)."
        )
    from app.api.test_fixtures import router as test_fixtures_router  # noqa: E402
    app.include_router(test_fixtures_router)
    logger.warning(
        "ENABLE_TEST_FIXTURES=1 — /__test__/inject-failed-run endpoint is "
        "MOUNTED. This MUST NOT happen in production (Phase 063 T-063-05-01)."
    )

# Phase 077 — env-var-gated mock LLM for multi-worker integration tests.
# Mirrors the ENABLE_TEST_FIXTURES pattern (Phase 063 T-063-05-01).
# When MOCK_LLM_MODE=1, the app replaces create_adaptive_streaming_chat
# with a deterministic fake and bypasses auth with a fixed test user.
# Zero API cost, millisecond-per-run execution (D-077-02).
if os.getenv("MOCK_LLM_MODE", "0") == "1":
    if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError(
            "MOCK_LLM_MODE=1 in production environment -- refusing to start. "
            "This env var is for local multi-worker harness use only "
            "(Phase 077 D-077-02)."
        )
    from app._test_mock_llm import install_mock  # noqa: E402
    install_mock()
    logger.warning(
        "MOCK_LLM_MODE=1 -- LLM calls return deterministic fakes, auth bypassed. "
        "This MUST NOT happen in production (Phase 077 D-077-02)."
    )
