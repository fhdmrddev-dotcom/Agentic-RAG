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


from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback, sandbox_outputs  # noqa: E402

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
