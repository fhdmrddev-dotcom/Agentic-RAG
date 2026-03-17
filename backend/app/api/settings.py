import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.config import settings as env_settings
from app.dependencies import get_current_user, get_supabase
from app.models.user_settings import LLMProvider, load_app_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

_GLOBAL_ID = "global"

# ─────────────────────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────────────────────

class LLMProviderResponse(BaseModel):
    id: str
    name: str
    base_url: str
    models: list[str]
    is_active: bool
    has_api_key: bool


class FullSettingsResponse(BaseModel):
    llm_providers: list[LLMProviderResponse]
    llm_model: str
    available_models: list[str]
    # embedding
    embedding_model: str
    embedding_model_locked: bool
    embedding_base_url: str
    embedding_dimensions: int
    embedding_has_api_key: bool
    embedding_overridden: bool
    # reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_model: str
    rerank_top_n: int
    rerank_has_api_key: bool
    reranking_overridden: bool
    # retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int
    retrieval_overridden: bool


# ─────────────────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────────────────

class LLMProviderInput(BaseModel):
    id: str | None = None
    name: str
    base_url: str
    api_key: str = ""
    models: list[str] = []


class EmbeddingSettingsInput(BaseModel):
    embedding_model: str | None = None
    embedding_base_url: str | None = None
    embedding_api_key: str = ""
    embedding_dimensions: int | None = None


class RerankingSettingsInput(BaseModel):
    rerank_enabled: bool | None = None
    rerank_provider: str | None = None
    rerank_api_key: str = ""
    rerank_model: str | None = None
    rerank_top_n: int | None = None


class RetrievalSettingsInput(BaseModel):
    retrieval_top_k: int | None = None
    retrieval_match_threshold: float | None = None
    hybrid_search_enabled: bool | None = None
    hybrid_candidate_count: int | None = None
    vector_search_weight: float | None = None
    keyword_search_weight: float | None = None
    rrf_k: int | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_row(supabase: Client) -> dict:
    try:
        result = supabase.table("app_settings").select("*").eq("id", _GLOBAL_ID).limit(1).execute()
        if result.data:
            return result.data[0]
        supabase.table("app_settings").insert({"id": _GLOBAL_ID}).execute()
        result = supabase.table("app_settings").select("*").eq("id", _GLOBAL_ID).limit(1).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("app_settings read/create failed: %s", e)
        raise HTTPException(status_code=500, detail=f"app_settings table error: {e}. Run migration 010_app_settings.sql in Supabase.")


def _update_row(update: dict, supabase: Client) -> None:
    try:
        _get_or_create_row(supabase)
        supabase.table("app_settings").update(update).eq("id", _GLOBAL_ID).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("app_settings update failed: %s", e)
        raise HTTPException(status_code=500, detail=f"app_settings write failed: {e}")


def _is_overridden(row: dict, keys: list[str]) -> bool:
    return any(row.get(k) is not None for k in keys)


_EMBEDDING_KEYS = ["embedding_model", "embedding_base_url", "embedding_api_key", "embedding_dimensions"]
_RERANKING_KEYS = ["rerank_enabled", "rerank_provider", "rerank_api_key", "rerank_model", "rerank_top_n"]
_RETRIEVAL_KEYS = ["retrieval_top_k", "retrieval_match_threshold", "hybrid_search_enabled",
                   "hybrid_candidate_count", "vector_search_weight", "keyword_search_weight", "rrf_k"]


def _has_any_documents(supabase: Client) -> bool:
    return len(supabase.table("documents").select("id").limit(1).execute().data) > 0


def _build_response(supabase: Client) -> FullSettingsResponse:
    row = _get_or_create_row(supabase)
    effective = load_app_settings(supabase)

    providers_raw: list[dict] = row.get("llm_providers") or []
    provider_responses = [
        LLMProviderResponse(
            id=p["id"],
            name=p["name"],
            base_url=p["base_url"],
            models=p.get("models") or [],
            is_active=p.get("is_active", False),
            has_api_key=bool(p.get("api_key")),
        )
        for p in providers_raw
    ]

    return FullSettingsResponse(
        llm_providers=provider_responses,
        llm_model=effective.llm_model,
        available_models=effective.available_models,
        embedding_model=effective.embedding_model,
        embedding_model_locked=_has_any_documents(supabase),
        embedding_base_url=effective.embedding_base_url,
        embedding_dimensions=effective.embedding_dimensions,
        embedding_has_api_key=bool(effective.embedding_api_key),
        embedding_overridden=False,  # always read from .env
        rerank_enabled=effective.rerank_enabled,
        rerank_provider=effective.rerank_provider,
        rerank_model=effective.rerank_model,
        rerank_top_n=effective.rerank_top_n,
        rerank_has_api_key=bool(effective.rerank_api_key),
        reranking_overridden=False,  # always read from .env
        retrieval_top_k=effective.retrieval_top_k,
        retrieval_match_threshold=effective.retrieval_match_threshold,
        hybrid_search_enabled=effective.hybrid_search_enabled,
        hybrid_candidate_count=effective.hybrid_candidate_count,
        vector_search_weight=effective.vector_search_weight,
        keyword_search_weight=effective.keyword_search_weight,
        rrf_k=effective.rrf_k,
        retrieval_overridden=False,  # always read from .env
    )


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=FullSettingsResponse)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _build_response(supabase)


@router.put("/providers", response_model=FullSettingsResponse)
async def upsert_provider(
    body: LLMProviderInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(supabase)
    providers: list[dict] = list(row.get("llm_providers") or [])

    if body.id:
        existing = next((p for p in providers if p["id"] == body.id), None)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
        existing["name"] = body.name
        existing["base_url"] = body.base_url
        existing["models"] = body.models
        if body.api_key:
            existing["api_key"] = body.api_key
    else:
        new_provider: dict = {
            "id": str(uuid.uuid4()),
            "name": body.name,
            "base_url": body.base_url,
            "api_key": body.api_key,
            "models": body.models,
            "is_active": len(providers) == 0,
        }
        providers.append(new_provider)

    _update_row({"llm_providers": providers}, supabase)
    return _build_response(supabase)


@router.delete("/providers/{provider_id}", response_model=FullSettingsResponse)
async def delete_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(supabase)
    providers = [p for p in (row.get("llm_providers") or []) if p["id"] != provider_id]
    _update_row({"llm_providers": providers}, supabase)
    return _build_response(supabase)


@router.patch("/providers/{provider_id}/activate", response_model=FullSettingsResponse)
async def activate_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(supabase)
    providers: list[dict] = list(row.get("llm_providers") or [])
    found = False
    for p in providers:
        p["is_active"] = p["id"] == provider_id
        if p["id"] == provider_id:
            found = True
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    _update_row({"llm_providers": providers}, supabase)
    return _build_response(supabase)


@router.put("/embedding", response_model=FullSettingsResponse)
async def update_embedding(
    body: EmbeddingSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Embedding settings are read-only from .env — no DB write
    return _build_response(supabase)


@router.put("/reranking", response_model=FullSettingsResponse)
async def update_reranking(
    body: RerankingSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Reranking settings are read-only from .env — no DB write
    return _build_response(supabase)


@router.put("/retrieval", response_model=FullSettingsResponse)
async def update_retrieval(
    body: RetrievalSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Retrieval settings are read-only from .env — no DB write
    return _build_response(supabase)


# ─────────────────────────────────────────────────────────────────────────────
# Reset endpoints — null out overrides, revert section to .env defaults
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/reranking", response_model=FullSettingsResponse)
async def reset_reranking(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _build_response(supabase)


@router.delete("/retrieval", response_model=FullSettingsResponse)
async def reset_retrieval(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _build_response(supabase)


@router.delete("/embedding", response_model=FullSettingsResponse)
async def reset_embedding(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _build_response(supabase)
