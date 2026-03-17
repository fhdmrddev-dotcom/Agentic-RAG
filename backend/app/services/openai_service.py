from langsmith import traceable
from openai import OpenAI

from app.config import settings

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


def get_llm_client() -> OpenAI:
    kwargs: dict = {"api_key": settings.llm_api_key}
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    return OpenAI(**kwargs)


def get_embedding_client() -> OpenAI:
    api_key = settings.embedding_api_key or settings.llm_api_key
    kwargs: dict = {"api_key": api_key}
    if settings.embedding_base_url:
        kwargs["base_url"] = settings.embedding_base_url
    return OpenAI(**kwargs)


@traceable(name="chat-completions", run_type="llm")
def create_streaming_chat(messages: list[dict], tool_choice: str = "auto", model: str | None = None):
    client = get_llm_client()
    kwargs: dict = {
        "model": model or settings.llm_model,
        "messages": messages,
        "stream": True,
    }
    if tool_choice == "auto":
        kwargs["tools"] = [SEARCH_DOCUMENTS_TOOL]
        kwargs["tool_choice"] = "auto"
    return client.chat.completions.create(**kwargs)


def embed_texts(texts: list[str], model: str | None = None) -> list[list[float]]:
    client = get_embedding_client()
    response = client.embeddings.create(
        model=model or settings.embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]
