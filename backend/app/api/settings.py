from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.user_settings import load_app_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class FullSettingsResponse(BaseModel):
    llm_model: str
    available_models: list[str]
    # embedding
    embedding_model: str
    embedding_base_url: str
    embedding_dimensions: int
    embedding_has_api_key: bool
    # reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_model: str
    rerank_top_n: int
    rerank_has_api_key: bool
    # retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int


def _build_response() -> FullSettingsResponse:
    s = load_app_settings()
    return FullSettingsResponse(
        llm_model=s.llm_model,
        available_models=s.available_models,
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
    )


@router.get("", response_model=FullSettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return _build_response()
