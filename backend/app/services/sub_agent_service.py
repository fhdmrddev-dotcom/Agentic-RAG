from __future__ import annotations

from typing import TYPE_CHECKING, Generator

from langsmith import traceable

from app.config import settings
from app.services.openai_service import get_llm_client

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings


@traceable(name="sub-agent", run_type="llm")
def run_sub_agent(
    document_content: str,
    document_filename: str,
    task: str,
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
) -> Generator[str, None, None]:
    """Stream a focused LLM analysis of a full document."""
    max_chars = settings.sub_agent_max_chars
    truncated = len(document_content) > max_chars
    content = document_content[:max_chars]
    if truncated:
        content += "\n\n[Note: document was truncated to fit context window]"

    system_prompt = (
        f"You are a document analysis assistant. You have the full text of '{document_filename}'. "
        "Analyze it carefully and cite specific sections/quotes to support your response."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Document:\n\n{content}\n\n---\nTask: {task}"},
    ]

    client = get_llm_client(user_settings)
    effective_model = model or (user_settings.llm_model if user_settings else None) or settings.llm_model

    stream = client.chat.completions.create(
        model=effective_model,
        messages=messages,
        stream=True,
    )

    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
