from langsmith import traceable
from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)


@traceable(name="openai-responses-chat", run_type="llm")
def create_streaming_response(
    message: str,
    previous_response_id: str | None,
    vector_store_id: str,
):
    kwargs: dict = {
        "model": "gpt-4o",
        "input": message,
        "store": True,
        "stream": True,
    }
    if vector_store_id:
        kwargs["tools"] = [{"type": "file_search", "vector_store_ids": [vector_store_id]}]
    if previous_response_id:
        kwargs["previous_response_id"] = previous_response_id
    return client.responses.create(**kwargs)
