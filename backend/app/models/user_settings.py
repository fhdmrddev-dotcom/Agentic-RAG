"""
UserEffectiveSettings — merges user DB row with env defaults.
Built once per request in the chat/ingestion endpoints.
"""

import uuid
from typing import Any

from pydantic import BaseModel, Field
from supabase import Client

from app.config import settings as env_settings


class LLMProvider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    base_url: str
    api_key: str = ""
    models: list[str] = []
    is_active: bool = False


class UserEffectiveSettings(BaseModel):
    # LLM
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    available_models: list[str]
    # Embedding
    embedding_api_key: str
    embedding_base_url: str
    embedding_model: str
    embedding_dimensions: int
    # Reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_api_key: str
    rerank_model: str
    rerank_top_n: int
    # Retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int


def _env_available_models() -> list[str]:
    if env_settings.available_models:
        return [m.strip() for m in env_settings.available_models.split(",") if m.strip()]
    return [env_settings.llm_model]


def load_user_settings(user_id: str, supabase: Client) -> UserEffectiveSettings:
    """Fetch user_settings row and merge with env defaults."""
    result = supabase.table("user_settings").select("*").eq("user_id", user_id).limit(1).execute()
    row: dict[str, Any] = result.data[0] if result.data else {}

    # Resolve LLM from active provider if present
    llm_api_key = env_settings.llm_api_key
    llm_base_url = env_settings.llm_base_url
    llm_model = env_settings.llm_model
    available_models = _env_available_models()

    providers_raw: list[dict] = row.get("llm_providers") or []
    active_provider = next((p for p in providers_raw if p.get("is_active")), None)
    if active_provider:
        llm_api_key = active_provider.get("api_key") or llm_api_key
        llm_base_url = active_provider.get("base_url") or llm_base_url
        provider_models: list[str] = active_provider.get("models") or []
        if provider_models:
            llm_model = provider_models[0]
            available_models = provider_models

    def _v(key: str, default: Any) -> Any:
        val = row.get(key)
        return val if val is not None else default

    return UserEffectiveSettings(
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_model=llm_model,
        available_models=available_models,
        embedding_api_key=_v("embedding_api_key", env_settings.embedding_api_key),
        embedding_base_url=_v("embedding_base_url", env_settings.embedding_base_url),
        embedding_model=_v("embedding_model", env_settings.embedding_model),
        embedding_dimensions=_v("embedding_dimensions", env_settings.embedding_dimensions),
        rerank_enabled=_v("rerank_enabled", env_settings.rerank_enabled),
        rerank_provider=_v("rerank_provider", env_settings.rerank_provider),
        rerank_api_key=_v("rerank_api_key", env_settings.rerank_api_key),
        rerank_model=_v("rerank_model", env_settings.rerank_model),
        rerank_top_n=_v("rerank_top_n", env_settings.rerank_top_n),
        retrieval_top_k=_v("retrieval_top_k", env_settings.retrieval_top_k),
        retrieval_match_threshold=_v("retrieval_match_threshold", env_settings.retrieval_match_threshold),
        hybrid_search_enabled=_v("hybrid_search_enabled", env_settings.hybrid_search_enabled),
        hybrid_candidate_count=_v("hybrid_candidate_count", env_settings.hybrid_candidate_count),
        vector_search_weight=_v("vector_search_weight", env_settings.vector_search_weight),
        keyword_search_weight=_v("keyword_search_weight", env_settings.keyword_search_weight),
        rrf_k=_v("rrf_k", env_settings.rrf_k),
    )
