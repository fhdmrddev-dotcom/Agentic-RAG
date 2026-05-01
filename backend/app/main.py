import logging
import os
from contextlib import asynccontextmanager

import anyio

# Suppress asyncio transport-level "socket.send() raised exception." warnings.
# These fire from CPython's selector_events.py when a client disconnects while
# we're mid-write — our SSEStreamingResponse already handles the disconnect
# gracefully at the ASGI layer, so these warnings are noise.
logging.getLogger("asyncio").setLevel(logging.ERROR)

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
    yield
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
    return {"status": "ok"}


@app.get("/models")
async def list_models():
    if settings.available_models:
        models = [m.strip() for m in settings.available_models.split(",") if m.strip()]
    else:
        models = [settings.llm_model]
    return {"models": models, "default": settings.llm_model}


from app.api import threads, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback  # noqa: E402

app.include_router(threads.router)
app.include_router(documents.router)
app.include_router(settings_api.router)
app.include_router(folders.router)
app.include_router(kb.router)
app.include_router(skills.router)
app.include_router(audit.router)
app.include_router(knowledge_health.router)
app.include_router(feedback.router)
