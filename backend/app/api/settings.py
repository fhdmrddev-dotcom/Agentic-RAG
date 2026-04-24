from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.user_settings import (
    KEY_PLACEHOLDER,
    load_app_settings,
    save_override,
)
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Response models ───────────────────────────────────────────────────────────

class ProviderInfo(BaseModel):
    id: str
    name: str
    base_url: str
    has_key: bool
    is_active: bool
    models: list[str]


class FullSettingsResponse(BaseModel):
    # LLM
    active_provider: str
    llm_model: str
    available_models: list[str]
    providers: list[ProviderInfo]
    # Embedding
    embedding_model: str
    embedding_base_url: str
    embedding_dimensions: int
    embedding_has_api_key: bool
    # Reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_model: str
    rerank_top_n: int
    rerank_has_api_key: bool
    # Retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int
    # Web search
    web_search_enabled: bool
    web_search_max_results: int
    # Sandbox
    sandbox_enabled: bool
    # Context & Sub-agent
    context_window_max_tokens: int
    sub_agent_max_output_tokens: int
    sub_agent_model: str


# ── Request models ────────────────────────────────────────────────────────────

class ProviderUpdate(BaseModel):
    id: str
    api_key: str = KEY_PLACEHOLDER   # "***" = keep existing; "" = clear; real = save
    models: list[str] = []
    base_url: str = ""               # only relevant for ollama


class SettingsUpdate(BaseModel):
    active_provider: str | None = None
    llm_model: str | None = None
    providers: list[ProviderUpdate] = []
    # Embedding
    embedding_model: str | None = None
    embedding_api_key: str | None = None   # "***" = keep; "" = clear; real = save
    embedding_base_url: str | None = None
    embedding_dimensions: int | None = None
    # Reranking
    rerank_enabled: bool | None = None
    rerank_provider: str | None = None
    rerank_api_key: str | None = None      # "***" = keep; "" = clear; real = save
    rerank_model: str | None = None
    rerank_top_n: int | None = None
    # Retrieval
    retrieval_top_k: int | None = None
    retrieval_match_threshold: float | None = None
    hybrid_search_enabled: bool | None = None
    hybrid_candidate_count: int | None = None
    vector_search_weight: float | None = None
    keyword_search_weight: float | None = None
    rrf_k: int | None = None
    # Web search
    tavily_api_key: str | None = None      # "***" = keep; "" = clear; real = save
    web_search_max_results: int | None = None
    # Sandbox
    sandbox_enabled: bool | None = None
    # Context & Sub-agent
    context_window_max_tokens: int | None = None
    sub_agent_max_output_tokens: int | None = Field(default=None, ge=4096, le=65536)
    sub_agent_model: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_response(s=None) -> FullSettingsResponse:
    if s is None:
        s = load_app_settings()
    return FullSettingsResponse(
        active_provider=s.active_provider,
        llm_model=s.llm_model,
        available_models=s.available_models,
        providers=[
            ProviderInfo(
                id=p.id,
                name=p.name,
                base_url=p.base_url,
                has_key=bool(p.api_key and p.api_key != "ollama"),
                is_active=p.is_active,
                models=p.models,
            )
            for p in s.providers
        ],
        embedding_model=s.embedding_model,
        embedding_base_url=s.embedding_base_url,
        embedding_dimensions=s.embedding_dimensions,
        embedding_has_api_key=bool(s.embedding_api_key),
        rerank_enabled=s.rerank_enabled,
        rerank_provider=s.rerank_provider,
        rerank_model=s.rerank_model,
        rerank_top_n=s.rerank_top_n,
        rerank_has_api_key=bool(s.rerank_api_key),
        retrieval_top_k=s.retrieval_top_k,
        retrieval_match_threshold=s.retrieval_match_threshold,
        hybrid_search_enabled=s.hybrid_search_enabled,
        hybrid_candidate_count=s.hybrid_candidate_count,
        vector_search_weight=s.vector_search_weight,
        keyword_search_weight=s.keyword_search_weight,
        rrf_k=s.rrf_k,
        web_search_enabled=bool(s.tavily_api_key),
        web_search_max_results=s.web_search_max_results,
        sandbox_enabled=s.sandbox_enabled,
        context_window_max_tokens=s.context_window_max_tokens,
        sub_agent_max_output_tokens=s.sub_agent_max_output_tokens,
        sub_agent_model=s.sub_agent_model,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=FullSettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return _build_response()


@router.put("", response_model=FullSettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    updates: dict = {}

    if body.active_provider is not None:
        updates["llm_provider"] = body.active_provider
    if body.llm_model is not None:
        updates["llm_model"] = body.llm_model

    for p in body.providers:
        updates[f"{p.id}_api_key"] = p.api_key  # save_override handles "***" skip
        if p.models:
            updates[f"{p.id}_models"] = ",".join(p.models)
        if p.id == "ollama" and p.base_url:
            updates["ollama_base_url"] = p.base_url

    if body.embedding_model is not None:
        updates["embedding_model"] = body.embedding_model
    if body.embedding_api_key is not None:
        updates["embedding_api_key"] = body.embedding_api_key
    if body.embedding_base_url is not None:
        updates["embedding_base_url"] = body.embedding_base_url
    if body.embedding_dimensions is not None:
        updates["embedding_dimensions"] = body.embedding_dimensions

    if body.rerank_enabled is not None:
        updates["rerank_enabled"] = body.rerank_enabled
    if body.rerank_provider is not None:
        updates["rerank_provider"] = body.rerank_provider
    if body.rerank_api_key is not None:
        updates["rerank_api_key"] = body.rerank_api_key
    if body.rerank_model is not None:
        updates["rerank_model"] = body.rerank_model
    if body.rerank_top_n is not None:
        updates["rerank_top_n"] = body.rerank_top_n

    if body.retrieval_top_k is not None:
        updates["retrieval_top_k"] = body.retrieval_top_k
    if body.retrieval_match_threshold is not None:
        updates["retrieval_match_threshold"] = body.retrieval_match_threshold
    if body.hybrid_search_enabled is not None:
        updates["hybrid_search_enabled"] = body.hybrid_search_enabled
    if body.hybrid_candidate_count is not None:
        updates["hybrid_candidate_count"] = body.hybrid_candidate_count
    if body.vector_search_weight is not None:
        updates["vector_search_weight"] = body.vector_search_weight
    if body.keyword_search_weight is not None:
        updates["keyword_search_weight"] = body.keyword_search_weight
    if body.rrf_k is not None:
        updates["rrf_k"] = body.rrf_k

    if body.tavily_api_key is not None:
        updates["tavily_api_key"] = body.tavily_api_key
    if body.web_search_max_results is not None:
        updates["web_search_max_results"] = body.web_search_max_results

    if body.sandbox_enabled is not None:
        updates["sandbox_enabled"] = body.sandbox_enabled
    if body.context_window_max_tokens is not None:
        updates["context_window_max_tokens"] = body.context_window_max_tokens
    if body.sub_agent_max_output_tokens is not None:
        updates["sub_agent_max_output_tokens"] = body.sub_agent_max_output_tokens
    if body.sub_agent_model is not None:
        updates["sub_agent_model"] = body.sub_agent_model

    save_override(updates)
    sanitized = {k: ("[REDACTED]" if "_key" in k or "_secret" in k else v) for k, v in updates.items()}
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="settings.update",
        metadata={"new_settings": sanitized},
        supabase=supabase,
    )
    return _build_response()


@router.get("/providers")
async def get_providers(current_user: dict = Depends(get_current_user)):
    """Lightweight endpoint for the chat UI provider selector."""
    s = load_app_settings()
    configured = [
        {"id": p.id, "name": p.name, "models": p.models, "is_active": p.is_active}
        for p in s.providers
        if p.api_key  # only providers that have a key set
    ]
    return {"active": s.active_provider, "providers": configured}
