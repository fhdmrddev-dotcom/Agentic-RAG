"""Phase 085 — shared sub-agent model-routing safety helper.

REPLICATES the logic in sub_agent_service.py:62-89 (D-075.5-04 footgun mitigation)
so task_service.py can use the same safety net WITHOUT modifying sub_agent_service.py
(which is byte-frozen per D-085-16).

The rule: when a user switches active_provider but doesn't update sub_agent_model,
the stale picker would route (e.g.) a Google model name through an OpenAI client → 400.
This helper validates override_model against the active provider's llm_models list
and falls back to a provider-safe default if it doesn't match.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS

logger = logging.getLogger(__name__)


def resolve_sub_agent_model_safely(
    user_settings: "UserEffectiveSettings | None",
    override_model: str | None = None,
    fallback_model: str | None = None,
) -> str:
    """Return a safe model name for sub-agent use.

    Falls back when override_model would route to a different provider than
    user_settings.active_provider. Mirrors sub_agent_service.py:62-89 verbatim
    (D-085-16 — that file is frozen, so we replicate rather than import).

    Args:
        user_settings: per-user effective settings (carries active_provider +
            llm_model + llm_models comma-separated list).
        override_model: explicit sub-agent model the caller wants to use, if any.
        fallback_model: caller-supplied last-resort default if everything else is empty.

    Returns:
        A model name string safe to send to the user's active provider's client.
    """
    _active_provider = (user_settings.active_provider if user_settings else "") or ""
    _active_models = (
        user_settings.llm_models
        if (user_settings and getattr(user_settings, "llm_models", None))
        else ""
    )
    _active_models_list = (
        [m.strip() for m in _active_models.split(",") if m.strip()]
        if _active_models
        else []
    )
    _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

    if override_model and _active_models_list and override_model not in _active_models_list:
        logger.warning(
            "sub_agent_model=%r is not in active provider=%r's model list — "
            "falling back to default to avoid cross-provider call.",
            override_model, _active_provider,
        )
        return (
            _provider_default
            or (user_settings.llm_model if user_settings else None)
            or fallback_model
            or settings.llm_model
        )

    return (
        override_model
        or (user_settings.llm_model if user_settings else None)
        or fallback_model
        or settings.llm_model
    )
