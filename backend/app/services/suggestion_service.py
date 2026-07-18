from __future__ import annotations

import logging
import openai
from typing import TYPE_CHECKING

from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.openai_service import get_llm_client, _uses_max_completion_tokens

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

_SUGGESTION_SYSTEM_PROMPT = (
    "You are a helpful assistant. Based on the conversation excerpt below, generate "
    "exactly 3 concise, actionable follow-up questions the user might want to ask next. "
    "Each question should be distinct and directly relevant to what was just discussed. "
    "Return only the questions, one per line, no numbering or bullets."
)


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks (closed) and any unclosed trailing
    <think> from text. Reasoning providers served via the compat path (minimax inline,
    DeepSeek/GLM-4.6+) emit <think> inline in message.content rather than a separate
    reasoning_content field; without stripping, each think line becomes a suggestion chip
    and pushes the real questions past the 3-item clamp (round-2 UAT Test 7, D-149-10
    fallback path).

    Mirrors app.api.threads._strip_think_blocks verbatim (the title path's sibling).
    A shared-util de-dup of the two copies is a future candidate (out of scope here) —
    do NOT silently fork the logic without keeping this note.
    """
    out = text or ""
    lower = out.lower()
    while "<think>" in lower and "</think>" in lower:
        start = lower.find("<think>")
        end = lower.find("</think>", start)
        if end == -1:
            break
        out = out[:start] + out[end + len("</think>"):]
        lower = out.lower()
    idx = out.lower().find("<think>")  # unclosed trailing think (ran out of budget mid-reasoning)
    if idx != -1:
        out = out[:idx]
    return out


def generate_suggestions(
    user_message: str,
    assistant_response: str,
    user_settings: "UserEffectiveSettings | None" = None,
) -> tuple[list[str], dict | None]:
    """Generate up to 3 follow-up questions from the last Q&A pair.

    Returns (questions, fallback_info).
    fallback_info is None normally; {"original_model": ..., "fallback_model": ...} on 404 retry.
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

    # Model resolution: user_settings override (UI/JSON) > env override > provider default
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
            or settings.llm_model
        )

    token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
    _original_model = effective_model
    fallback_info: dict | None = None
    # Phase 067.4 (D-067.4-R3-01 branch b): GPT-5+ family uses max_completion_tokens
    # as a UNIFIED budget covering both visible content AND chain-of-thought reasoning.
    # At 200 tokens reasoning consumes the cap and content="" (finish_reason="length").
    # 2000 is the empirical floor for `gpt-5.4-mini` on a 3-instruction system prompt.
    # Non-reasoning models (gpt-4.1-mini, gpt-4o) still fit easily.
    try:
        resp = client.chat.completions.create(
            model=effective_model,
            messages=messages,
            stream=False,
            **{token_param: 2000},
        )
    except openai.NotFoundError:
        provider = user_settings.active_provider if user_settings else ""
        fallback = (
            _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
            or (user_settings.llm_model if user_settings else None)
            or settings.llm_model
        )
        if not fallback or fallback == _original_model:
            raise
        fallback_info = {"original_model": _original_model, "fallback_model": fallback}
        token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
        # Phase 067.4 (D-067.4-R3-01 branch b): same unified-budget rationale
        # applies to the NotFoundError fallback retry — bump 200 → 2000 here too.
        resp = client.chat.completions.create(
            model=fallback,
            messages=messages,
            stream=False,
            **{token_param2: 2000},
        )
    content = resp.choices[0].message.content or ""
    # Strip <think> reasoning BEFORE the line-parse: compat-path reasoning models
    # (MiniMax/DeepSeek/GLM) emit <think>...</think> inline in message.content, and the
    # non-streaming suggestion call bypasses the streaming adapter's reasoning split.
    # Stripping precedes the split so a think line never becomes a chip nor fills the clamp.
    content = _strip_think_blocks(content)
    # Parse: one question per line, strip empty lines, clamp to 3
    questions = [q.strip() for q in content.split("\n") if q.strip()]
    return questions[:3], fallback_info
