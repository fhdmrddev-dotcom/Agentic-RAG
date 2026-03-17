"""
AppSettings — all settings read exclusively from .env. No DB dependency.
"""

from pydantic import BaseModel

from app.config import settings as env_settings


class LLMProvider(BaseModel):
    id: str
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


def load_app_settings() -> UserEffectiveSettings:
    """Build effective settings entirely from .env. No DB reads."""
    return UserEffectiveSettings(
        llm_api_key=env_settings.llm_api_key,
        llm_base_url=env_settings.llm_base_url,
        llm_model=env_settings.llm_model,
        available_models=_env_available_models(),
        embedding_api_key=env_settings.embedding_api_key,
        embedding_base_url=env_settings.embedding_base_url,
        embedding_model=env_settings.embedding_model,
        embedding_dimensions=env_settings.embedding_dimensions,
        rerank_enabled=env_settings.rerank_enabled,
        rerank_provider=env_settings.rerank_provider,
        rerank_api_key=env_settings.rerank_api_key,
        rerank_model=env_settings.rerank_model,
        rerank_top_n=env_settings.rerank_top_n,
        retrieval_top_k=env_settings.retrieval_top_k,
        retrieval_match_threshold=env_settings.retrieval_match_threshold,
        hybrid_search_enabled=env_settings.hybrid_search_enabled,
        hybrid_candidate_count=env_settings.hybrid_candidate_count,
        vector_search_weight=env_settings.vector_search_weight,
        keyword_search_weight=env_settings.keyword_search_weight,
        rrf_k=env_settings.rrf_k,
    )


def load_user_settings(user_id: str, supabase=None) -> UserEffectiveSettings:
    return load_app_settings()
