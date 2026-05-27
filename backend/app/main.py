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

logger = logging.getLogger(__name__)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


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
}

_PROVIDER_MODEL_KEYS: set[str] = {
    "openai_models", "anthropic_models", "google_models",
    "openrouter_models", "ollama_models", "deepseek_models",
    "moonshot_models", "minimax_models", "zhipu_models",
}

# CR-01 fix: allowset for API key column names prevents SQL injection
# from crafted JSON keys like "x; DROP TABLE --_api_key"
_API_KEY_COLUMNS: set[str] = {
    "openai_api_key", "anthropic_api_key", "google_api_key",
    "openrouter_api_key", "ollama_api_key", "deepseek_api_key",
    "moonshot_api_key", "minimax_api_key", "zhipu_api_key",
    "embedding_api_key", "rerank_api_key", "tavily_api_key",
}


async def _migrate_settings_override() -> None:
    """One-shot migration: settings_override.json -> app_settings DB table.

    Phase 081.1 D-01..D-05. Runs in lifespan after asyncpg pool init.
    Multi-worker safe via UPDATE ... WHERE id='global' (D-02).
    Idempotent: no-op if JSON file absent (D-05).
    Fail-safe: on any DB error, leaves file untouched for fallback (D-03).
    On success: renames file to .migrated (D-04).
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


@asynccontextmanager
async def lifespan(app_instance):
    # Startup: bump AnyIO default thread limiter so SSE-path .execute()
    # wraps don't queue at the 40-token default (research §A2, D-058-07).
    # Env-overridable via ANYIO_THREAD_TOKENS.
    anyio.to_thread.current_default_thread_limiter().total_tokens = (
        settings.anyio_thread_tokens
    )

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

    yield

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    from app.dependencies import get_redis
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=1.0)
        redis_status = "ok"
    except Exception:
        redis_status = "unreachable"
    return {"status": "ok", "redis": redis_status}


@app.get("/models")
async def list_models():
    if settings.available_models:
        models = [m.strip() for m in settings.available_models.split(",") if m.strip()]
    else:
        models = [settings.llm_model]
    return {"models": models, "default": settings.llm_model}


from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback, sandbox_outputs, admin  # noqa: E402

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
app.include_router(admin.router)


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
