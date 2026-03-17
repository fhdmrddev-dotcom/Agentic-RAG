import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.config import settings as env_settings
from app.dependencies import get_current_user, get_supabase
from app.models.user_settings import LLMProvider, load_user_settings

router = APIRouter(prefix="/settings", tags=["settings"])


# ─────────────────────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────────────────────

class LLMProviderResponse(BaseModel):
    id: str
    name: str
    base_url: str
    models: list[str]
    is_active: bool
    has_api_key: bool  # never return raw key


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
    embedding_overridden: bool   # True = custom user values; False = reading from .env
    # reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_model: str
    rerank_top_n: int
    rerank_has_api_key: bool
    reranking_overridden: bool   # True = custom user values; False = reading from .env
    # retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int
    retrieval_overridden: bool   # True = custom user values; False = reading from .env


# ─────────────────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────────────────

class LLMProviderInput(BaseModel):
    id: str | None = None  # None = new provider
    name: str
    base_url: str
    api_key: str = ""  # empty string = keep existing key
    models: list[str] = []


class EmbeddingSettingsInput(BaseModel):
    embedding_model: str | None = None
    embedding_base_url: str | None = None
    embedding_api_key: str = ""  # empty = keep existing
    embedding_dimensions: int | None = None


class RerankingSettingsInput(BaseModel):
    rerank_enabled: bool | None = None
    rerank_provider: str | None = None
    rerank_api_key: str = ""  # empty = keep existing
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

def _get_or_create_row(user_id: str, supabase: Client) -> dict:
    result = supabase.table("user_settings").select("*").eq("user_id", user_id).limit(1).execute()
    if result.data:
        return result.data[0]
    supabase.table("user_settings").insert({"user_id": user_id}).execute()
    result = supabase.table("user_settings").select("*").eq("user_id", user_id).limit(1).execute()
    return result.data[0]


def _is_overridden(row: dict, keys: list[str]) -> bool:
    """Returns True if any of the given DB columns are non-null (user has customised them)."""
    return any(row.get(k) is not None for k in keys)


_EMBEDDING_KEYS = ["embedding_model", "embedding_base_url", "embedding_api_key", "embedding_dimensions"]
_RERANKING_KEYS = ["rerank_enabled", "rerank_provider", "rerank_api_key", "rerank_model", "rerank_top_n"]
_RETRIEVAL_KEYS = ["retrieval_top_k", "retrieval_match_threshold", "hybrid_search_enabled",
                   "hybrid_candidate_count", "vector_search_weight", "keyword_search_weight", "rrf_k"]


def _build_response(user_id: str, supabase: Client) -> FullSettingsResponse:
    row = _get_or_create_row(user_id, supabase)
    effective = load_user_settings(user_id, supabase)

    has_documents = len(
        supabase.table("documents").select("id").eq("user_id", user_id).limit(1).execute().data
    ) > 0

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
        embedding_model_locked=has_documents,
        embedding_base_url=effective.embedding_base_url,
        embedding_dimensions=effective.embedding_dimensions,
        embedding_has_api_key=bool(effective.embedding_api_key),
        embedding_overridden=_is_overridden(row, _EMBEDDING_KEYS),
        rerank_enabled=effective.rerank_enabled,
        rerank_provider=effective.rerank_provider,
        rerank_model=effective.rerank_model,
        rerank_top_n=effective.rerank_top_n,
        rerank_has_api_key=bool(effective.rerank_api_key),
        reranking_overridden=_is_overridden(row, _RERANKING_KEYS),
        retrieval_top_k=effective.retrieval_top_k,
        retrieval_match_threshold=effective.retrieval_match_threshold,
        hybrid_search_enabled=effective.hybrid_search_enabled,
        hybrid_candidate_count=effective.hybrid_candidate_count,
        vector_search_weight=effective.vector_search_weight,
        keyword_search_weight=effective.keyword_search_weight,
        rrf_k=effective.rrf_k,
        retrieval_overridden=_is_overridden(row, _RETRIEVAL_KEYS),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=FullSettingsResponse)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _build_response(current_user["id"], supabase)


@router.put("/providers", response_model=FullSettingsResponse)
async def upsert_provider(
    body: LLMProviderInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(current_user["id"], supabase)
    providers: list[dict] = list(row.get("llm_providers") or [])

    if body.id:
        # Update existing
        existing = next((p for p in providers if p["id"] == body.id), None)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
        existing["name"] = body.name
        existing["base_url"] = body.base_url
        existing["models"] = body.models
        if body.api_key:  # only replace if non-empty
            existing["api_key"] = body.api_key
    else:
        # Add new provider
        new_provider: dict = {
            "id": str(uuid.uuid4()),
            "name": body.name,
            "base_url": body.base_url,
            "api_key": body.api_key,
            "models": body.models,
            "is_active": len(providers) == 0,  # first provider auto-activates
        }
        providers.append(new_provider)

    supabase.table("user_settings").update({"llm_providers": providers}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


@router.delete("/providers/{provider_id}", response_model=FullSettingsResponse)
async def delete_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(current_user["id"], supabase)
    providers: list[dict] = list(row.get("llm_providers") or [])
    providers = [p for p in providers if p["id"] != provider_id]
    supabase.table("user_settings").update({"llm_providers": providers}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


@router.patch("/providers/{provider_id}/activate", response_model=FullSettingsResponse)
async def activate_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    row = _get_or_create_row(current_user["id"], supabase)
    providers: list[dict] = list(row.get("llm_providers") or [])
    found = False
    for p in providers:
        p["is_active"] = p["id"] == provider_id
        if p["id"] == provider_id:
            found = True
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    supabase.table("user_settings").update({"llm_providers": providers}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


@router.put("/embedding", response_model=FullSettingsResponse)
async def update_embedding(
    body: EmbeddingSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    has_documents = len(
        supabase.table("documents").select("id").eq("user_id", current_user["id"]).limit(1).execute().data
    ) > 0
    if has_documents and (body.embedding_model or body.embedding_dimensions is not None):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Embedding model/dimensions cannot be changed once documents have been uploaded.",
        )

    row = _get_or_create_row(current_user["id"], supabase)
    update: dict = {}
    if body.embedding_model is not None:
        update["embedding_model"] = body.embedding_model
    if body.embedding_base_url is not None:
        update["embedding_base_url"] = body.embedding_base_url
    if body.embedding_dimensions is not None:
        update["embedding_dimensions"] = body.embedding_dimensions
    if body.embedding_api_key:  # only replace if non-empty
        update["embedding_api_key"] = body.embedding_api_key

    if update:
        supabase.table("user_settings").update(update).eq("user_id", current_user["id"]).execute()

    return _build_response(current_user["id"], supabase)


@router.put("/reranking", response_model=FullSettingsResponse)
async def update_reranking(
    body: RerankingSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    _get_or_create_row(current_user["id"], supabase)
    update: dict = {}
    if body.rerank_enabled is not None:
        update["rerank_enabled"] = body.rerank_enabled
    if body.rerank_provider is not None:
        update["rerank_provider"] = body.rerank_provider
    if body.rerank_model is not None:
        update["rerank_model"] = body.rerank_model
    if body.rerank_top_n is not None:
        update["rerank_top_n"] = body.rerank_top_n
    if body.rerank_api_key:
        update["rerank_api_key"] = body.rerank_api_key

    if update:
        supabase.table("user_settings").update(update).eq("user_id", current_user["id"]).execute()

    return _build_response(current_user["id"], supabase)


@router.put("/retrieval", response_model=FullSettingsResponse)
async def update_retrieval(
    body: RetrievalSettingsInput,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    _get_or_create_row(current_user["id"], supabase)
    update: dict = {}
    if body.retrieval_top_k is not None:
        update["retrieval_top_k"] = body.retrieval_top_k
    if body.retrieval_match_threshold is not None:
        update["retrieval_match_threshold"] = body.retrieval_match_threshold
    if body.hybrid_search_enabled is not None:
        update["hybrid_search_enabled"] = body.hybrid_search_enabled
    if body.hybrid_candidate_count is not None:
        update["hybrid_candidate_count"] = body.hybrid_candidate_count
    if body.vector_search_weight is not None:
        update["vector_search_weight"] = body.vector_search_weight
    if body.keyword_search_weight is not None:
        update["keyword_search_weight"] = body.keyword_search_weight
    if body.rrf_k is not None:
        update["rrf_k"] = body.rrf_k

    if update:
        supabase.table("user_settings").update(update).eq("user_id", current_user["id"]).execute()

    return _build_response(current_user["id"], supabase)


# ─────────────────────────────────────────────────────────────────────────────
# Reset endpoints — null out user overrides, revert section to .env defaults
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/reranking", response_model=FullSettingsResponse)
async def reset_reranking(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    _get_or_create_row(current_user["id"], supabase)
    supabase.table("user_settings").update({k: None for k in _RERANKING_KEYS}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


@router.delete("/retrieval", response_model=FullSettingsResponse)
async def reset_retrieval(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    _get_or_create_row(current_user["id"], supabase)
    supabase.table("user_settings").update({k: None for k in _RETRIEVAL_KEYS}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


@router.delete("/embedding", response_model=FullSettingsResponse)
async def reset_embedding(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Only allow reset if not locked (no documents)
    has_documents = len(
        supabase.table("documents").select("id").eq("user_id", current_user["id"]).limit(1).execute().data
    ) > 0
    if has_documents:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reset embedding settings while documents exist.",
        )
    _get_or_create_row(current_user["id"], supabase)
    supabase.table("user_settings").update({k: None for k in _EMBEDDING_KEYS}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)


# ─────────────────────────────────────────────────────────────────────────────
# Legacy endpoint (kept for backwards compatibility)
# ─────────────────────────────────────────────────────────────────────────────

class EmbeddingModelUpdate(BaseModel):
    embedding_model: str


@router.put("/embedding-model", response_model=FullSettingsResponse)
async def update_embedding_model(
    body: EmbeddingModelUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    has_documents = len(
        supabase.table("documents").select("id").eq("user_id", current_user["id"]).limit(1).execute().data
    ) > 0
    if has_documents:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Embedding model cannot be changed once documents have been uploaded.",
        )
    _get_or_create_row(current_user["id"], supabase)
    supabase.table("user_settings").update({"embedding_model": body.embedding_model}).eq("user_id", current_user["id"]).execute()
    return _build_response(current_user["id"], supabase)
