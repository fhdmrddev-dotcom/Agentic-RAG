from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.config import settings
from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsResponse(BaseModel):
    llm_model: str
    available_models: list[str]
    embedding_model: str  # effective model (user pref or env default)
    embedding_model_locked: bool  # True if user has documents


class EmbeddingModelUpdate(BaseModel):
    embedding_model: str


def _get_available_models() -> list[str]:
    if settings.available_models:
        return [m.strip() for m in settings.available_models.split(",") if m.strip()]
    return [settings.llm_model]


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Check if user has documents (locks embedding model)
    docs = supabase.table("documents").select("id").eq("user_id", current_user["id"]).limit(1).execute()
    has_documents = len(docs.data) > 0

    # Get user's stored embedding model preference
    user_prefs = supabase.table("user_settings").select("embedding_model").eq("user_id", current_user["id"]).limit(1).execute()
    stored_model = user_prefs.data[0]["embedding_model"] if user_prefs.data and user_prefs.data[0].get("embedding_model") else ""
    effective_embedding_model = stored_model or settings.embedding_model

    return SettingsResponse(
        llm_model=settings.llm_model,
        available_models=_get_available_models(),
        embedding_model=effective_embedding_model,
        embedding_model_locked=has_documents,
    )


@router.put("/embedding-model", response_model=SettingsResponse)
async def update_embedding_model(
    body: EmbeddingModelUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Check if locked
    docs = supabase.table("documents").select("id").eq("user_id", current_user["id"]).limit(1).execute()
    if docs.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Embedding model cannot be changed once documents have been uploaded.",
        )

    # Upsert user settings
    supabase.table("user_settings").upsert({
        "user_id": current_user["id"],
        "embedding_model": body.embedding_model,
    }).execute()

    return SettingsResponse(
        llm_model=settings.llm_model,
        available_models=_get_available_models(),
        embedding_model=body.embedding_model,
        embedding_model_locked=False,
    )
