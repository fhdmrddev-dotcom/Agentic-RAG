from __future__ import annotations

import json
import openai
from typing import TYPE_CHECKING, Generator

from langsmith import traceable

from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.openai_service import get_llm_client, _resolve_max_tokens, _uses_max_completion_tokens

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

    # Priority: user_settings override (UI/JSON) > env override (.env) > provider default
    # Sub-agents always use their dedicated model — the main agent handles generation.
    # Escalating to the orchestrator model caused sub-agents to use the expensive main
    # model (e.g. gpt-4.1) even for pure document analysis tasks, burning TPM quota.
    override_model = (
        (user_settings.sub_agent_model if user_settings else "")
        or settings.sub_agent_model
    )

    if override_model:
        effective_model = override_model
    else:
        provider = user_settings.active_provider if user_settings else ""
        provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        effective_model = (
            provider_default
            or (user_settings.llm_model if user_settings else None)
            or model
            or settings.llm_model
        )

    # Sub-agents always get the full output budget — they analyze complete documents
    # and need enough tokens to return thorough extractions to the main agent.
    output_ceiling = max(32768, settings.sub_agent_max_output_tokens)

    resolved_tokens = _resolve_max_tokens(output_ceiling, user_settings)
    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    _original_model = effective_model
    try:
        stream = client.chat.completions.create(
            model=effective_model,
            messages=messages,
            stream=True,
            **{token_param: resolved_tokens},
        )
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except openai.NotFoundError:
        provider = user_settings.active_provider if user_settings else ""
        fallback = (
            _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
            or (user_settings.llm_model if user_settings else None)
            or model
            or settings.llm_model
        )
        if not fallback or fallback == _original_model:
            raise
        # Yield sentinel so the caller (event_stream) can re-emit as SSE event
        yield json.dumps({"__type": "fallback_model", "original_model": _original_model, "fallback_model": fallback})
        token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
        stream2 = client.chat.completions.create(
            model=fallback,
            messages=messages,
            stream=True,
            **{token_param2: resolved_tokens},
        )
        for chunk in stream2:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
