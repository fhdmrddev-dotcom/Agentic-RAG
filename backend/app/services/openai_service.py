from __future__ import annotations

from typing import TYPE_CHECKING

from langsmith import traceable
from openai import OpenAI

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

SEARCH_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": (
            "Search the user's uploaded documents for relevant information. "
            "Use metadata_filter to narrow results to specific document attributes "
            "when the user's request implies a scope (e.g. 'find all 2024 reports', "
            "'only look in Python tutorials', 'search financial documents'). "
            "Supported filter keys: document_type, language, author, date."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The semantic search query to find relevant document chunks.",
                },
                "metadata_filter": {
                    "type": "object",
                    "description": (
                        "Optional JSONB containment filter applied to document metadata. "
                        "Each key-value pair must match the stored metadata exactly. "
                        "Example: {\"document_type\": \"report\"} or {\"language\": \"French\"}. "
                        "Omit this parameter when no document-level scoping is needed."
                    ),
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["query"],
        },
    },
}


def get_llm_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        kwargs: dict = {"api_key": user_settings.llm_api_key}
        if user_settings.llm_base_url:
            kwargs["base_url"] = user_settings.llm_base_url
    else:
        kwargs = {"api_key": settings.llm_api_key}
        if settings.llm_base_url:
            kwargs["base_url"] = settings.llm_base_url
    return OpenAI(**kwargs)


def get_embedding_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        if user_settings.embedding_api_key:
            # Dedicated embedding key — use its own base_url only, never inherit LLM base_url
            api_key = user_settings.embedding_api_key
            base_url = user_settings.embedding_base_url or None
        else:
            # No dedicated key — reuse LLM credentials (key + base_url)
            api_key = user_settings.llm_api_key
            base_url = user_settings.embedding_base_url or user_settings.llm_base_url or None
    else:
        if settings.embedding_api_key:
            # Dedicated embedding key — use its own base_url only, never inherit LLM base_url
            api_key = settings.embedding_api_key
            base_url = settings.embedding_base_url or None
        else:
            # No dedicated key — reuse LLM credentials (key + base_url)
            api_key = settings.llm_api_key
            base_url = settings.embedding_base_url or settings.llm_base_url or None

    kwargs: dict = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


@traceable(name="chat-completions", run_type="llm")
def create_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
):
    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
    }
    if tool_choice == "auto":
        kwargs["tools"] = [SEARCH_DOCUMENTS_TOOL]
        kwargs["tool_choice"] = "auto"
    return client.chat.completions.create(**kwargs)


def embed_texts(
    texts: list[str],
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
) -> list[list[float]]:
    client = get_embedding_client(user_settings)
    effective_model = model or (user_settings.embedding_model if user_settings else None) or settings.embedding_model
    response = client.embeddings.create(
        model=effective_model,
        input=texts,
    )
    return [item.embedding for item in response.data]
