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


QUERY_DOCUMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "query_documents",
        "description": (
            "Run a SQL SELECT query against the user's documents table to answer "
            "structured questions about their uploaded files. Use for questions like "
            "'how many documents do I have?', 'list all PDFs', 'which files were "
            "uploaded in 2024?'. "
            "Table: documents. Columns: id (uuid), filename (text), file_type (text), "
            "status (text, e.g. 'completed'), created_at (timestamptz), "
            "metadata (jsonb with keys: title, author, date, document_type, topics, "
            "language, summary). "
            "The query is automatically scoped to the current user — do NOT add a "
            "user_id filter yourself."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A valid SQL SELECT statement. No semicolons.",
                }
            },
            "required": ["query"],
        },
    },
}

WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for current information not available in the user's "
            "uploaded documents. Use when the user asks about recent events, "
            "general knowledge, or topics clearly outside their document library. "
            "Always prefer search_documents first if the answer may be in their files. "
            "Always cite sources (title + URL) in your response."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The web search query.",
                }
            },
            "required": ["query"],
        },
    },
}


def get_tools() -> list[dict]:
    """Return the active tool list based on current config."""
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL]
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    return tools


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
        kwargs["tools"] = get_tools()
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
