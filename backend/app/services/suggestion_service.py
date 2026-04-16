from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config import settings
from app.services.openai_service import get_llm_client, _uses_max_completion_tokens
from app.services.sub_agent_service import _SUB_AGENT_MODEL_DEFAULTS

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

_SUGGESTION_SYSTEM_PROMPT = (
    "You are a helpful assistant. Based on the conversation excerpt below, generate "
    "exactly 3 concise, actionable follow-up questions the user might want to ask next. "
    "Each question should be distinct and directly relevant to what was just discussed. "
    "Return only the questions, one per line, no numbering or bullets."
)


def generate_suggestions(
    user_message: str,
    assistant_response: str,
    user_settings: "UserEffectiveSettings | None" = None,
) -> list[str]:
    """Generate up to 3 follow-up questions from the last Q&A pair.

    Uses the cheapest model per provider (same resolution as sub_agent_service).
    Raises on any failure — caller must catch.
    """
    messages = [
        {"role": "system", "content": _SUGGESTION_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"User asked: {user_message}\n\n"
            f"Assistant replied: {assistant_response[:2000]}\n\n"
            "Generate 3 follow-up questions:"
        )},
    ]

    client = get_llm_client(user_settings)

    # Model resolution: same order as sub_agent_service.run_sub_agent
    if settings.sub_agent_model:
        effective_model = settings.sub_agent_model
    else:
        provider = user_settings.active_provider if user_settings else ""
        provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        effective_model = (
            provider_default
            or (user_settings.llm_model if user_settings else None)
            or settings.llm_model
        )

    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    resp = client.chat.completions.create(
        model=effective_model,
        messages=messages,
        stream=False,
        **{token_param: 200},
    )
    content = resp.choices[0].message.content or ""
    # Parse: one question per line, strip empty lines, clamp to 3
    questions = [q.strip() for q in content.split("\n") if q.strip()]
    return questions[:3]
