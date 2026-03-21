import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Configure LangSmith tracing via environment variables
os.environ["LANGSMITH_TRACING"] = settings.langsmith_tracing
os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
if settings.langsmith_api_key:
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key


app = FastAPI(title="Agentic RAG API", version="1.0.0")

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


from app.api import threads, documents, settings as settings_api, folders, kb  # noqa: E402

app.include_router(threads.router)
app.include_router(documents.router)
app.include_router(settings_api.router)
app.include_router(folders.router)
app.include_router(kb.router)
