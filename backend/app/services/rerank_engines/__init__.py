"""Rerank / decision engines (Phase 294-01, DEC-01).

The engine table is ``registry.py``; this module answers the questions every caller asks of it:
which engine a stored ``rerank_provider`` names, which model to send, which key to use, and
whether the citation check (plan 03) can run.

⛔ Keys are read from ``user_settings.providers`` BY ``id`` (``"openrouter"`` / ``"openai"``) or
from ``rerank_api_key`` — never from a ``base_url`` (D-02: no TypeSafe direct path exists, and
Jev's endpoint is not under OpenRouter's ``/api/v1``). A key is never logged and never returned
anywhere except to the adapter that sends it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.services.rerank_engines.registry import ENGINES, LEGACY_ALIASES, EngineSpec

__all__ = [
    "CheckAvailability",
    "MissingEngineKey",
    "citation_check_availability",
    "get_engine",
    "resolve_credentials",
    "resolve_model",
]


class MissingEngineKey(RuntimeError):
    """A hosted engine is selected but no key is stored for it. The message is the engine id."""


def get_engine(provider_id: str | None) -> EngineSpec | None:
    """``"api"`` → Cohere (the pre-294 spelling); an unknown or empty id → None."""
    if not provider_id:
        return None
    pid = LEGACY_ALIASES.get(provider_id, provider_id)
    return ENGINES.get(pid)


def resolve_model(spec: EngineSpec, rerank_model: str | None) -> str:
    """The stored model when it belongs to this engine, else the engine's default.

    One ``rerank_model`` setting serves every engine, so after switching engines the stored value
    is usually another engine's name (``rerank-v3.5`` under Jev). Sending it would fail every call.
    """
    if rerank_model and re.search(spec.model_pattern, rerank_model):
        return rerank_model
    return spec.default_model


def _clean(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def resolve_credentials(spec: EngineSpec, user_settings: Any) -> str | None:
    """The key the engine authenticates with, or None. Never logged."""
    source = spec.key_source
    if source is None:
        return None
    if source == "rerank_api_key":
        if user_settings is not None:
            return _clean(getattr(user_settings, "rerank_api_key", None))
        return _clean(settings.rerank_api_key)
    if user_settings is not None:
        for provider in getattr(user_settings, "providers", None) or []:
            if getattr(provider, "id", None) == source:
                return _clean(getattr(provider, "api_key", None))
        return None
    return _clean(getattr(settings, f"{source}_api_key", None))


@dataclass(frozen=True)
class CheckAvailability:
    available: bool
    engine: str | None          # "jev" | "openai_decisions" | None
    reason: str | None          # "off" | "engine_reorders_only" | "key_missing" | None


def citation_check_availability(user_settings: Any) -> CheckAvailability:
    """Whether the citation check (D-13) can run under the current engine settings."""
    enabled = user_settings.rerank_enabled if user_settings is not None else settings.rerank_enabled
    if not enabled:
        return CheckAvailability(False, None, "off")
    provider = user_settings.rerank_provider if user_settings is not None else settings.rerank_provider
    spec = get_engine(provider)
    if spec is None:
        return CheckAvailability(False, None, "off")
    if not spec.citation_check:
        return CheckAvailability(False, None, "engine_reorders_only")
    if resolve_credentials(spec, user_settings) is None:
        return CheckAvailability(False, spec.id, "key_missing")
    return CheckAvailability(True, spec.id, None)
