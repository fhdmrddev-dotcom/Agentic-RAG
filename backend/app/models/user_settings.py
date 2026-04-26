"""
Settings resolution: .env → settings_override.json (UI writes here).

Priority: settings_override.json > .env
The override file is never committed (gitignored like .env).
"""

from __future__ import annotations

import json
import time as _time
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.config import settings as env_settings, MODEL_CAPABILITIES


class OpenRouterToolStrategy(str, Enum):
    QUALITY = "quality"
    NATIVE = "native"
    XML = "xml"

# Path to the override file (sits next to .env in the backend dir)
_OVERRIDE_FILE = Path(__file__).parent.parent.parent / "settings_override.json"

KNOWN_PROVIDERS = {
    "openai":     {"name": "OpenAI",         "base_url": ""},
    "anthropic":  {"name": "Anthropic",       "base_url": "https://api.anthropic.com/v1"},
    "google":     {"name": "Google Gemini",   "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"},
    "openrouter": {"name": "OpenRouter",      "base_url": "https://openrouter.ai/api/v1"},
    "ollama":     {"name": "Ollama (local)",  "base_url": ""},  # resolved from ollama_base_url
}

KEY_PLACEHOLDER = "***"


class LLMProvider(BaseModel):
    id: str
    name: str
    base_url: str
    api_key: str = ""        # real key — never sent to frontend
    models: list[str] = []
    is_active: bool = False


class UserEffectiveSettings(BaseModel):
    # Resolved LLM credentials (ready to pass to OpenAI client)
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    available_models: list[str]
    active_provider: str  # id, e.g. "openrouter"

    # All providers (configured + unconfigured) for UI
    providers: list[LLMProvider]

    # Embedding
    embedding_api_key: str
    embedding_base_url: str
    embedding_model: str
    embedding_dimensions: int

    # Reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_api_key: str
    rerank_model: str
    rerank_top_n: int

    # Retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int

    # Web search
    tavily_api_key: str
    web_search_max_results: int
    web_search_enabled: bool

    # Sandbox
    sandbox_enabled: bool

    # Context & Sub-agent
    context_window_max_tokens: int
    sub_agent_max_output_tokens: int
    sub_agent_model: str
    llm_max_output_tokens: int  # 0 = auto (use per-model defaults)

    # OpenRouter tool calling strategy
    openrouter_tool_strategy: OpenRouterToolStrategy = OpenRouterToolStrategy.QUALITY


# ── Override file I/O ─────────────────────────────────────────────────────────

# Module-level cache for settings override file
_override_cache: dict = {}
_override_cache_time: float = 0.0
_OVERRIDE_CACHE_TTL: float = 5.0


def _load_override() -> dict[str, Any]:
    global _override_cache, _override_cache_time
    now = _time.time()
    if now - _override_cache_time < _OVERRIDE_CACHE_TTL:
        return _override_cache
    try:
        _override_cache = json.loads(_OVERRIDE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        _override_cache = {}
    _override_cache_time = now
    return _override_cache


def save_override(updates: dict[str, Any]) -> None:
    """Merge `updates` into the override file. Skips KEY_PLACEHOLDER values."""
    global _override_cache_time
    current = _load_override()
    for k, v in updates.items():
        if v == KEY_PLACEHOLDER:
            continue  # "***" = keep existing key, don't overwrite
        if v is None:
            current.pop(k, None)  # None = remove override, fall back to env
        else:
            current[k] = v
    _OVERRIDE_FILE.write_text(json.dumps(current, indent=2), encoding="utf-8")
    _override_cache_time = 0.0  # invalidate cache after write


# ── Helpers ───────────────────────────────────────────────────────────────────

def _str(override: dict, key: str, env_val: str) -> str:
    v = override.get(key)
    if v is None:
        return env_val
    return str(v)


def _int(override: dict, key: str, env_val: int) -> int:
    v = override.get(key)
    if v is None:
        return env_val
    try:
        return int(v)
    except (TypeError, ValueError):
        return env_val


def _float(override: dict, key: str, env_val: float) -> float:
    v = override.get(key)
    if v is None:
        return env_val
    try:
        return float(v)
    except (TypeError, ValueError):
        return env_val


def _bool(override: dict, key: str, env_val: bool) -> bool:
    v = override.get(key)
    if v is None:
        return env_val
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("true", "1", "yes")


def _models_list(override: dict, key: str, env_val: str) -> list[str]:
    raw = override.get(key, env_val) or ""
    return [m.strip() for m in raw.split(",") if m.strip()]


# ── Provider builder ──────────────────────────────────────────────────────────

def _build_providers(override: dict) -> list[LLMProvider]:
    active_id = _str(override, "llm_provider", env_settings.llm_provider)
    ollama_base = _str(override, "ollama_base_url", env_settings.ollama_base_url).rstrip("/")

    providers: list[LLMProvider] = []
    for pid, meta in KNOWN_PROVIDERS.items():
        key_field = f"{pid}_api_key"
        models_field = f"{pid}_models"
        env_key = getattr(env_settings, key_field, "")
        env_models_raw = getattr(env_settings, f"{pid}_models", "")

        api_key = _str(override, key_field, env_key)
        models = _models_list(override, models_field, env_models_raw)

        # For native providers, merge saved list with registry so new registry
        # models appear automatically without requiring manual Settings updates.
        if pid in ("openai", "anthropic", "google"):
            registry = [
                m for m, cap in MODEL_CAPABILITIES.items()
                if cap.get("provider") == pid
            ]
            # Preserve user's ordering; append any registry models not already present
            existing_set = set(models)
            models = models + [m for m in registry if m not in existing_set]

        if pid == "ollama":
            base_url = f"{ollama_base}/v1"
            api_key = api_key or "ollama"
        else:
            base_url = meta["base_url"]

        providers.append(LLMProvider(
            id=pid,
            name=meta["name"],
            base_url=base_url,
            api_key=api_key,
            models=models,
            is_active=(pid == active_id),
        ))
    return providers


def _resolve_llm(override: dict, providers: list[LLMProvider]) -> tuple[str, str, str, list[str], str]:
    """Returns (api_key, base_url, model, available_models, active_provider_id)."""
    active_id = _str(override, "llm_provider", env_settings.llm_provider)

    active = next((p for p in providers if p.id == active_id), None)
    if active:
        api_key = active.api_key
        base_url = active.base_url
        available = active.models or [_str(override, "llm_model", env_settings.llm_model)]
    else:
        # Legacy mode: use raw llm_api_key / llm_base_url from env/override
        api_key = _str(override, "llm_api_key", env_settings.llm_api_key)
        base_url = _str(override, "llm_base_url", env_settings.llm_base_url)
        available_raw = _str(override, "available_models", env_settings.available_models)
        available = [m.strip() for m in available_raw.split(",") if m.strip()]

    model = _str(override, "llm_model", env_settings.llm_model)
    if not available:
        available = [model]

    return api_key, base_url, model, available, active_id


# ── Public API ────────────────────────────────────────────────────────────────

def load_app_settings() -> UserEffectiveSettings:
    override = _load_override()
    providers = _build_providers(override)
    api_key, base_url, model, available, active_provider = _resolve_llm(override, providers)

    return UserEffectiveSettings(
        llm_api_key=api_key,
        llm_base_url=base_url,
        llm_model=model,
        available_models=available,
        active_provider=active_provider,
        providers=providers,

        embedding_api_key=_str(override, "embedding_api_key", env_settings.embedding_api_key),
        embedding_base_url=_str(override, "embedding_base_url", env_settings.embedding_base_url),
        embedding_model=_str(override, "embedding_model", env_settings.embedding_model),
        embedding_dimensions=_int(override, "embedding_dimensions", env_settings.embedding_dimensions),

        rerank_enabled=_bool(override, "rerank_enabled", env_settings.rerank_enabled),
        rerank_provider=_str(override, "rerank_provider", env_settings.rerank_provider),
        rerank_api_key=_str(override, "rerank_api_key", env_settings.rerank_api_key),
        rerank_model=_str(override, "rerank_model", env_settings.rerank_model),
        rerank_top_n=_int(override, "rerank_top_n", env_settings.rerank_top_n),

        retrieval_top_k=_int(override, "retrieval_top_k", env_settings.retrieval_top_k),
        retrieval_match_threshold=_float(override, "retrieval_match_threshold", env_settings.retrieval_match_threshold),
        hybrid_search_enabled=_bool(override, "hybrid_search_enabled", env_settings.hybrid_search_enabled),
        hybrid_candidate_count=_int(override, "hybrid_candidate_count", env_settings.hybrid_candidate_count),
        vector_search_weight=_float(override, "vector_search_weight", env_settings.vector_search_weight),
        keyword_search_weight=_float(override, "keyword_search_weight", env_settings.keyword_search_weight),
        rrf_k=_int(override, "rrf_k", env_settings.rrf_k),

        tavily_api_key=_str(override, "tavily_api_key", env_settings.tavily_api_key),
        web_search_max_results=_int(override, "web_search_max_results", env_settings.web_search_max_results),
        web_search_enabled=_bool(override, "web_search_enabled", bool(env_settings.tavily_api_key)),

        sandbox_enabled=_bool(override, "sandbox_enabled", env_settings.sandbox_enabled),
        context_window_max_tokens=_int(override, "context_window_max_tokens", env_settings.context_window_max_tokens),
        sub_agent_max_output_tokens=_int(override, "sub_agent_max_output_tokens", env_settings.sub_agent_max_output_tokens),
        sub_agent_model=_str(override, "sub_agent_model", env_settings.sub_agent_model),
        llm_max_output_tokens=_int(override, "llm_max_output_tokens", env_settings.llm_max_output_tokens),
        openrouter_tool_strategy=OpenRouterToolStrategy(_str(override, "openrouter_tool_strategy", OpenRouterToolStrategy.QUALITY.value)),
    )


def override_provider(effective: UserEffectiveSettings, provider_id: str) -> UserEffectiveSettings:
    """Return a copy of effective settings with credentials switched to the given provider."""
    provider = next((p for p in effective.providers if p.id == provider_id), None)
    if not provider or not provider.api_key:
        return effective
    return effective.model_copy(update={
        "active_provider": provider_id,
        "llm_api_key": provider.api_key,
        "llm_base_url": provider.base_url,
        "available_models": provider.models or effective.available_models,
    })


def load_user_settings(user_id: str, supabase=None) -> UserEffectiveSettings:
    return load_app_settings()


def resolve_sub_agent_model(s: "UserEffectiveSettings") -> str:
    """Return the model that would actually be used for sub-agent calls right now.

    Resolution order (matches run_sub_agent logic):
      1. sub_agent_model override (from settings_override.json or env)
      2. _SUB_AGENT_MODEL_DEFAULTS[active_provider]
      3. s.llm_model (main chat model as last resort)
    """
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    override = s.sub_agent_model or env_settings.sub_agent_model
    if override:
        return override
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(s.active_provider, "")
    return provider_default or s.llm_model
