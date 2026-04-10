from __future__ import annotations

from typing import TYPE_CHECKING, Generator

from langsmith import traceable

from app.config import settings
from app.services.openai_service import get_llm_client, _resolve_max_tokens

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

# Sub-agent model defaults: cheapest stable model per provider.
# These handle completion tasks well without needing the full orchestrator model.
# Gemini 3.x excluded — still in preview as of April 2026.
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-5.4-nano",
    "google":     "gemini-2.5-flash",
    "openrouter": "",   # Unknown routing — fall back to user's selected model
    "ollama":     "",   # Local, user manages their own models
}


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
    # Resolution order:
    # 1. SUB_AGENT_MODEL env var (power-user override for all providers)
    # 2. Provider default (cheap/fast model suited for heavy doc processing)
    # 3. User's selected model (fallback for unknown providers)
    # 4. Server default
    if settings.sub_agent_model:
        effective_model = settings.sub_agent_model
    else:
        provider = user_settings.active_provider if user_settings else ""
        provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        effective_model = (
            provider_default
            or (user_settings.llm_model if user_settings else None)
            or model
            or settings.llm_model
        )

    stream = client.chat.completions.create(
        model=effective_model,
        messages=messages,
        stream=True,
        max_tokens=_resolve_max_tokens(8192, user_settings),  # Haiku 4.5 ceiling
    )

    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
