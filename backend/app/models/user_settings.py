"""
Settings resolution: DB app_settings row > .env defaults.

Phase 081.1 Plan 03: file-based settings_override.json eliminated.
All settings reads go through a 30s TTL in-process DB cache (D-06).
Writes go through save_app_settings() via asyncpg (D-20).
"""

from __future__ import annotations

import logging
import time as _time
from enum import Enum
from typing import Any

from pydantic import BaseModel

from app.config import settings as env_settings, MODEL_CAPABILITIES, _PROVIDER_BASE_URLS

logger = logging.getLogger(__name__)


class OpenRouterToolStrategy(str, Enum):
    QUALITY = "quality"
    NATIVE = "native"
    XML = "xml"


_PROVIDER_DISPLAY_NAMES: dict[str, str] = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google Gemini",
    "openrouter": "OpenRouter",
    "ollama": "Ollama (local)",
    "deepseek": "DeepSeek",
    "moonshot": "Moonshot (Kimi)",
    "minimax": "MiniMax",
    "zhipu": "GLM (Zhipu)",
}

KNOWN_PROVIDERS = {
    pid: {"name": _PROVIDER_DISPLAY_NAMES.get(pid, pid), "base_url": url}
    for pid, url in _PROVIDER_BASE_URLS.items()
}

KEY_PLACEHOLDER = "***"

# Plan 075.4-04 D-075.4-F1 -- sentinel allowlist guard ported to
# save_app_settings (D-14). Defense-in-depth: rejects placeholder /
# sentinel / wrong-prefix values before DB write.
_PROVIDER_KEY_PREFIXES: dict[str, str] = {
    "openai_api_key": "sk-",
    "anthropic_api_key": "sk-ant-",
    "openrouter_api_key": "sk-or-",
    # google_api_key: length-only minimum (~35-40 chars)
    # ollama_api_key: any non-sentinel non-empty
}
_SENTINEL_VALUES: frozenset[str] = frozenset({"***", "__KEEP__", "••••••"})


def _is_valid_api_key(key: str, value: str) -> bool:
    """Plan 075.4-04 D-075.4-F1: allowlist guard.

    Returns True if ``value`` looks like a real api_key for ``key``. Returns
    False for empty / whitespace / sentinel / wrong-provider-prefix / too-short
    google keys. Non-api-key fields (key NOT in _PROVIDER_KEY_PREFIXES and not
    google/ollama) fall through as True -- the guard in ``save_app_settings``
    only invokes this helper when ``key.endswith("_api_key")``.
    """
    if not value or not value.strip():
        return False
    if value in _SENTINEL_VALUES:
        return False
    if "•" in value or value.replace("*", "").strip() == "":
        return False
    prefix = _PROVIDER_KEY_PREFIXES.get(key)
    if prefix is not None:
        return value.startswith(prefix)
    if key == "google_api_key":
        return len(value) >= 30
    if key == "ollama_api_key":
        return True
    return True


class LLMProvider(BaseModel):
    id: str
    name: str
    base_url: str
    api_key: str = ""        # real key -- never sent to frontend
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

    # Phase 147 (FLAG-01, migration 097) — operator control-plane kill-switches.
    # app_settings-only (env_attr=None readback below; these are runtime SWITCHES,
    # not secrets/infra — CLAUDE.md). D-Q4 polarity: capability switches default True
    # (byte-identical runtime until an operator flips one); maintenance_mode defaults
    # False (platform OPEN — a cold/fresh read must never wedge the platform).
    self_improve_enabled: bool = True
    workflows_enabled: bool = True
    maintenance_mode: bool = False

    # Phase 110 DMF-03 — master DM capability gate (migration 071). Default True => unchanged behavior.
    document_management_enabled: bool = True

    # Multimodal limits (Phase 071 migration 044; Phase 072 RAG-MM-LIFT-01 USES these)
    multimodal_max_vision_calls: int = 100
    multimodal_max_b64_bytes_kb: int = 4096

    # Phase 075.10 (migration 049): tool_args_progress SSE emission cadence.
    chat_tool_args_progress_emit_boundary_bytes: int = 256

    # Per-aspect extraction engines (Phase 071.2 D-071.2-02/03; migration 045)
    extraction_text_engine_pdf: str = "legacy"
    extraction_text_engine_docx: str = "legacy"
    extraction_table_engine_pdf: str = "camelot"
    extraction_image_engine_pdf: str = "pymupdf_full"
    extraction_image_engine_docx: str = "zip_xpath"
    extraction_equation_engine: str = "none"
    extraction_per_call_hints_enabled: bool = True

    # Phase 111 META-03 — configurable metadata extraction (migration 072).
    # app_settings-only (env_attr=None below); deliberately NOT in SettingsUpdate
    # (DB-only, no UI — D-111-2; mirrors extraction_* / harness_judge_model).
    extraction_model: str = ""              # unset => settings.llm_model (gpt-4o env default)
    extraction_window_cap: int = 32000      # head+tail sampler cap
    metadata_enrichment_mode: str = "enriched"  # enriched | legacy

    # Phase 123 (D-08 / TRIG-01) — the skill-builder model for the Trigger Tuner.
    # app_settings-only (env_attr=None readback below; CLAUDE.md "env vars are for
    # secrets/infra only" — a model id is a VALUE). Empty => resolve_skill_builder_model()
    # picks a strong registry default. Selectable across the full provider list incl.
    # local; no paid-provider SPOF (D-08); decoupled from the benchmark targets. The
    # Settings UI (Plan 06) reads/writes this field.
    skill_builder_model: str = ""

    # Phase 137.1-05 (EVAL-05f / D-11) — the ONE shared harness judge model id, resolved
    # identically by the eval judge AND the publish judge via resolve_judge_model. app_settings-only
    # (env_attr=None readback below; a model id is a VALUE, not a secret). Empty => the resolver
    # picks the strong registry default (claude-opus-4-8). The Settings UI (Plan 10) reads/writes it.
    harness_judge_model: str = ""

    # Phase 140 (TRIG-02 / D-04) — global token budget for the "## Available Skills"
    # catalog block. app_settings-only (env_attr=None readback below; a budget is a
    # VALUE, not a secret). 0 = inject-all kill switch (D-04). Default 1500 keeps small
    # catalogs byte-identical (D-03 bypass); resolved via resolve_skill_catalog_budget().
    skill_catalog_max_tokens: int = 1500

    # Phase 111.1 — configurable / multi-provider embeddings (migration 073).
    # app_settings-only (env_attr=None readback below); app-config, NOT secrets.
    embedding_provider: str = ""            # D-06 explicit embedding provider (preset/picker)
    extraction_provider: str = ""           # D-09 #1 explicit extraction provider (short-circuits name-inference)
    confidence_bucket_high: float = 0.54    # D-12 portable confidence bucket (was hardcoded 0.54)
    confidence_bucket_medium: float = 0.38  # D-12 portable confidence bucket (was hardcoded 0.38)

    # Context & Sub-agent
    context_window_max_tokens: int
    sub_agent_max_output_tokens: int
    sub_agent_model: str
    llm_max_output_tokens: int  # 0 = auto (use per-model defaults)

    # Ephemeral template TTL (Phase 100 TMPL-01 D-05; migration 068 app_settings col)
    # Hours a kind='template_input' workspace file lives before the gated read-path
    # hides it and the in-process janitor deletes it. Safe default 24 when absent/NULL.
    template_ttl_hours: int = 24

    # OpenRouter tool calling strategy
    openrouter_tool_strategy: OpenRouterToolStrategy = OpenRouterToolStrategy.QUALITY


# ── DB-backed settings cache (Phase 081.1 D-06/D-07/D-08) ─────────────────
# 30s in-process TTL cache per worker. Populated by the async path
# (_load_settings_from_db). The sync load_app_settings() reads directly
# from _settings_cache (no DB I/O). If cache is cold (before any async
# load has run), returns Pydantic model defaults via env_settings fallback.

_settings_cache: dict[str, Any] | None = None
_settings_cache_time: float = 0.0
_SETTINGS_CACHE_TTL: float = 30.0


async def _load_settings_from_db() -> dict[str, Any]:
    """Return the global app_settings row as a dict, with 30s TTL cache.

    On cache hit (within TTL): returns cached dict without DB I/O.
    On cache miss: fetches via asyncpg pool, updates cache + timestamp.
    """
    global _settings_cache, _settings_cache_time
    now = _time.time()
    if _settings_cache is not None and (now - _settings_cache_time) < _SETTINGS_CACHE_TTL:
        return _settings_cache

    try:
        from app.dependencies import get_pg_pool  # lazy import -- avoid circular
        pool = await get_pg_pool()
        row = await pool.fetchrow(
            "SELECT * FROM app_settings WHERE id = 'global'"
        )
        _settings_cache = dict(row) if row else {}
    except Exception:
        logger.warning(
            "_load_settings_from_db: DB read failed; returning stale/empty cache",
            exc_info=True,
        )
        if _settings_cache is None:
            _settings_cache = {}
    _settings_cache_time = _time.time()
    return _settings_cache


def invalidate_settings_cache() -> None:
    """Zero out settings cache timestamp so next read hits DB (D-07)."""
    global _settings_cache_time
    _settings_cache_time = 0.0


async def save_app_settings(updates: dict[str, Any]) -> None:
    """Write settings to app_settings DB row via asyncpg.

    Ports the _is_valid_api_key sentinel guard (D-14).
    Calls invalidate_settings_cache() on success (D-07).
    """
    # Filter out sentinel / invalid API key values (D-14, T-081.1-07)
    clean: dict[str, Any] = {}
    for k, v in updates.items():
        if v == KEY_PLACEHOLDER:
            continue
        if k.endswith("_api_key") and v is not None and not _is_valid_api_key(k, str(v)):
            logger.warning(
                "save_app_settings: rejected api_key write -- sentinel/invalid for key=%s",
                k,
            )
            continue
        if v is None:
            continue  # skip None values -- don't write NULLs for missing keys
        clean[k] = v

    if not clean:
        return

    # Build parameterized UPDATE -- column names from code constants, values via $N
    cols = list(clean.keys())
    vals = list(clean.values())
    set_clause = ", ".join(f"{col} = ${i+1}" for i, col in enumerate(cols))
    vals.append("global")  # WHERE id = $N

    try:
        from app.dependencies import get_pg_pool
        pool = await get_pg_pool()
        await pool.execute(
            f"UPDATE app_settings SET {set_clause}, updated_at = now() "
            f"WHERE id = ${len(vals)}",
            *vals,
        )
        invalidate_settings_cache()
    except Exception:
        logger.warning(
            "save_app_settings: DB write failed; settings not persisted",
            exc_info=True,
        )


# ── Model capabilities overrides cache (Phase 081.1 D-09/D-10) ──────────

_model_overrides_cache: dict[str, dict] = {}
_model_overrides_cache_time: float = 0.0


async def _load_model_overrides() -> dict[str, dict]:
    """Return enabled model_capabilities_overrides rows as {model_id: row_dict}.

    Same 30s TTL cache pattern as _load_settings_from_db (D-06).
    """
    global _model_overrides_cache, _model_overrides_cache_time
    now = _time.time()
    if _model_overrides_cache and (now - _model_overrides_cache_time) < _SETTINGS_CACHE_TTL:
        return _model_overrides_cache

    try:
        from app.dependencies import get_pg_pool
        pool = await get_pg_pool()
        rows = await pool.fetch(
            "SELECT * FROM model_capabilities_overrides WHERE enabled = true"
        )
        _model_overrides_cache = {r["model_id"]: dict(r) for r in rows}
    except Exception:
        logger.warning(
            "_load_model_overrides: DB read failed; returning stale/empty cache",
            exc_info=True,
        )
        if not _model_overrides_cache:
            _model_overrides_cache = {}
    _model_overrides_cache_time = _time.time()
    return _model_overrides_cache


def invalidate_model_overrides_cache() -> None:
    """Zero out model overrides cache timestamp (D-07 pattern)."""
    global _model_overrides_cache_time
    _model_overrides_cache_time = 0.0


# ── Row-to-value helpers ─────────────────────────────────────────────────────
# DB row values are already typed (asyncpg returns native Python types).
# These helpers provide fallback chains: DB row > env_settings > hardcoded default.

def _val(row: dict, key: str, env_attr: str | None = None, default: Any = "") -> Any:
    """Get a value from DB row, falling back to env_settings, then default.

    For string/int/float fields. Returns the DB value if non-None, else
    getattr(env_settings, env_attr, default) if env_attr is provided,
    else the hardcoded default.
    """
    v = row.get(key)
    if v is not None:
        return v
    if env_attr is not None:
        return getattr(env_settings, env_attr, default)
    return default


def _val_bool(row: dict, key: str, env_attr: str | None = None, default: bool = False) -> bool:
    """Get a boolean from DB row. Handles None vs False correctly.

    DB NULLs (None) fall through to env_settings / default. Actual False
    values from the DB are preserved.
    """
    v = row.get(key)
    if v is not None:
        return bool(v)
    if env_attr is not None:
        return bool(getattr(env_settings, env_attr, default))
    return default


# ── Provider builder ──────────────────────────────────────────────────────────

def _build_providers(row: dict) -> list[LLMProvider]:
    """Build provider list from DB row, merging DB models + static registry.

    D-13/D-24: user ordering first (from provider_model_lists JSONB),
    then DB-registered models (from model_capabilities_overrides cache)
    alphabetically, then static registry models alphabetically.
    """
    active_id = _val(row, "llm_provider", "llm_provider", "")
    ollama_base = str(_val(row, "ollama_base_url", "ollama_base_url", "http://localhost:11434")).rstrip("/")

    # D-17: provider_model_lists JSONB column stores {"openai": [...], "anthropic": [...]}
    # Defensive: the migration runner json.dumps() before asyncpg's JSONB codec,
    # causing double-serialization (stored as a JSON string literal in JSONB).
    # Handle both dict and str gracefully.
    _raw_pml = row.get("provider_model_lists") or {}
    if isinstance(_raw_pml, str):
        import json as _json
        try:
            _raw_pml = _json.loads(_raw_pml)
        except (ValueError, TypeError):
            _raw_pml = {}
    db_model_lists: dict[str, list[str]] = _raw_pml if isinstance(_raw_pml, dict) else {}

    providers: list[LLMProvider] = []
    for pid, meta in KNOWN_PROVIDERS.items():
        key_field = f"{pid}_api_key"
        env_key = getattr(env_settings, key_field, "")

        # API key: DB row > env
        api_key = str(_val(row, key_field, key_field, env_key))

        # Model list: DB JSONB > env CSV > empty
        db_models = db_model_lists.get(pid, [])
        if db_models:
            models = list(db_models)  # preserve user ordering from DB
        else:
            # Fall back to env CSV for this provider
            env_models_raw = getattr(env_settings, f"{pid}_models", "")
            models = [m.strip() for m in str(env_models_raw).split(",") if m.strip()]

        # D-13/D-24: merge DB-registered models from model_capabilities_overrides
        # These appear alphabetically after user's saved list
        existing_set = set(models)
        db_registered = sorted(
            mid for mid, cap in _model_overrides_cache.items()
            if cap.get("provider") == pid and cap.get("enabled", True) and mid not in existing_set
        )
        models.extend(db_registered)

        # Merge static registry models -- append any not already present
        existing_set = set(models)
        registry = sorted(
            m for m, cap in MODEL_CAPABILITIES.items()
            if cap.get("provider") == pid and m not in existing_set
        )
        models.extend(registry)

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


def _resolve_llm(row: dict, providers: list[LLMProvider]) -> tuple[str, str, str, list[str], str]:
    """Returns (api_key, base_url, model, available_models, active_provider_id)."""
    active_id = _val(row, "llm_provider", "llm_provider", "")

    active = next((p for p in providers if p.id == active_id), None)
    if active:
        api_key = active.api_key
        base_url = active.base_url
        model_default = str(_val(row, "llm_model", "llm_model", "gpt-4o"))
        available = active.models or [model_default]
    else:
        # Legacy mode: use raw llm_api_key / llm_base_url from env/override
        api_key = str(_val(row, "llm_api_key", "llm_api_key", ""))
        base_url = str(_val(row, "llm_base_url", "llm_base_url", ""))
        available_raw = str(_val(row, "available_models", "available_models", ""))
        available = [m.strip() for m in available_raw.split(",") if m.strip()]

    model = str(_val(row, "llm_model", "llm_model", "gpt-4o"))
    if not available:
        available = [model]

    return api_key, base_url, model, available, active_id


# ── Settings construction helper ─────────────────────────────────────────────

def _build_settings_from_row(row: dict) -> UserEffectiveSettings:
    """Construct UserEffectiveSettings from a DB row dict.

    Shared between sync load_app_settings() and async load_app_settings_async().
    """
    providers = _build_providers(row)
    api_key, base_url, model, available, active_provider = _resolve_llm(row, providers)

    return UserEffectiveSettings(
        llm_api_key=api_key,
        llm_base_url=base_url,
        llm_model=model,
        available_models=available,
        active_provider=active_provider,
        providers=providers,

        embedding_api_key=str(_val(row, "embedding_api_key", "embedding_api_key", "")),
        embedding_base_url=str(_val(row, "embedding_base_url", "embedding_base_url", "")),
        embedding_model=str(_val(row, "embedding_model", "embedding_model", "")),
        embedding_dimensions=int(_val(row, "embedding_dimensions", "embedding_dimensions", 1536)),

        rerank_enabled=_val_bool(row, "rerank_enabled", "rerank_enabled", False),
        rerank_provider=str(_val(row, "rerank_provider", "rerank_provider", "")),
        rerank_api_key=str(_val(row, "rerank_api_key", "rerank_api_key", "")),
        rerank_model=str(_val(row, "rerank_model", "rerank_model", "")),
        rerank_top_n=int(_val(row, "rerank_top_n", "rerank_top_n", 5)),

        retrieval_top_k=int(_val(row, "retrieval_top_k", "retrieval_top_k", 5)),
        retrieval_match_threshold=float(_val(row, "retrieval_match_threshold", "retrieval_match_threshold", 0.3)),
        hybrid_search_enabled=_val_bool(row, "hybrid_search_enabled", "hybrid_search_enabled", True),
        hybrid_candidate_count=int(_val(row, "hybrid_candidate_count", "hybrid_candidate_count", 20)),
        vector_search_weight=float(_val(row, "vector_search_weight", "vector_search_weight", 1.0)),
        keyword_search_weight=float(_val(row, "keyword_search_weight", "keyword_search_weight", 1.0)),
        rrf_k=int(_val(row, "rrf_k", "rrf_k", 60)),

        tavily_api_key=str(_val(row, "tavily_api_key", "tavily_api_key", "")),
        web_search_max_results=int(_val(row, "web_search_max_results", None, 5)),
        web_search_enabled=_val_bool(row, "web_search_enabled", None, bool(env_settings.tavily_api_key)),

        sandbox_enabled=_val_bool(row, "sandbox_enabled", "sandbox_enabled", True),

        # Phase 147 (FLAG-01, migration 097) — env_attr=None: app_settings-only, no env
        # fallback (runtime SWITCHES, not secrets/infra). D-Q4 polarity mirrors the
        # migration defaults so a missing/None column reads the SAFE value for each flag:
        # capability switches => True (never silently disable); maintenance => False (OPEN).
        self_improve_enabled=_val_bool(row, "self_improve_enabled", None, True),
        workflows_enabled=_val_bool(row, "workflows_enabled", None, True),
        maintenance_mode=_val_bool(row, "maintenance_mode", None, False),

        # Phase 110 DMF-03 — env_attr=None: app_settings-only, no env fallback
        # (CLAUDE.md "env vars are for secrets/infra only"). Missing/None column => True.
        document_management_enabled=_val_bool(row, "document_management_enabled", None, True),

        multimodal_max_vision_calls=int(_val(row, "multimodal_max_vision_calls", None, 100)),
        multimodal_max_b64_bytes_kb=int(_val(row, "multimodal_max_b64_bytes_kb", None, 4096)),

        chat_tool_args_progress_emit_boundary_bytes=int(
            _val(row, "chat_tool_args_progress_emit_boundary_bytes", None, 256)
        ),

        # Per-aspect extraction engines (Phase 071.2 D-071.2-03; migration 045)
        extraction_text_engine_pdf=str(_val(row, "extraction_text_engine_pdf", None, "legacy")),
        extraction_text_engine_docx=str(_val(row, "extraction_text_engine_docx", None, "legacy")),
        extraction_table_engine_pdf=str(_val(row, "extraction_table_engine_pdf", None, "camelot")),
        extraction_image_engine_pdf=str(_val(row, "extraction_image_engine_pdf", None, "pymupdf_full")),
        extraction_image_engine_docx=str(_val(row, "extraction_image_engine_docx", None, "zip_xpath")),
        extraction_equation_engine=str(_val(row, "extraction_equation_engine", None, "none")),
        extraction_per_call_hints_enabled=_val_bool(row, "extraction_per_call_hints_enabled", None, True),

        # Phase 111 META-03 — env_attr=None: app_settings-only, no env fallback
        # (CLAUDE.md "env vars are for secrets/infra only"). Missing/None => defaults.
        extraction_model=str(_val(row, "extraction_model", None, "")),
        extraction_window_cap=int(_val(row, "extraction_window_cap", None, 32000)),
        metadata_enrichment_mode=str(_val(row, "metadata_enrichment_mode", None, "enriched")),

        # Phase 123 (D-08 / TRIG-01) — env_attr=None: app_settings-only, no env
        # fallback (a model id is a VALUE, not a secret). Missing/None => "" =>
        # resolve_skill_builder_model() picks a strong registry default.
        skill_builder_model=str(_val(row, "skill_builder_model", None, "")),

        # Phase 137.1-05 (EVAL-05f / D-11) — env_attr=None: app_settings-only (a model id is
        # a VALUE, not a secret). Missing/None => "" => resolve_judge_model() picks the default.
        harness_judge_model=str(_val(row, "harness_judge_model", None, "")),

        # Phase 140 (TRIG-02 / D-04) — env_attr=None: app_settings-only, no env fallback
        # (a budget is a VALUE, not a secret). Missing/None => 1500 default. 0 = inject-all
        # kill switch; resolve_skill_catalog_budget() bounds-checks the untrusted value.
        skill_catalog_max_tokens=int(_val(row, "skill_catalog_max_tokens", None, 1500)),

        # Phase 111.1 — env_attr=None: app_settings-only, no env fallback
        # (CLAUDE.md "env vars are for secrets/infra only"). Missing/None => defaults.
        embedding_provider=str(_val(row, "embedding_provider", None, "")),
        extraction_provider=str(_val(row, "extraction_provider", None, "")),
        confidence_bucket_high=float(_val(row, "confidence_bucket_high", None, 0.54)),
        confidence_bucket_medium=float(_val(row, "confidence_bucket_medium", None, 0.38)),

        context_window_max_tokens=int(_val(row, "context_window_max_tokens", "context_window_max_tokens", 0)),
        sub_agent_max_output_tokens=int(_val(row, "sub_agent_max_output_tokens", "sub_agent_max_output_tokens", 8192)),
        sub_agent_model=str(_val(row, "sub_agent_model", "sub_agent_model", "")),
        llm_max_output_tokens=int(_val(row, "llm_max_output_tokens", "llm_max_output_tokens", 8192)),
        template_ttl_hours=int(_val(row, "template_ttl_hours", "template_ttl_hours", 24)),
        openrouter_tool_strategy=OpenRouterToolStrategy(
            str(_val(row, "openrouter_tool_strategy", None, OpenRouterToolStrategy.QUALITY.value))
        ),
    )


# ── Public API ────────────────────────────────────────────────────────────────

def load_app_settings() -> UserEffectiveSettings:
    """Sync settings read. Uses in-memory cache populated by async path.

    If cache is cold (no async load yet), returns env_settings / Pydantic
    defaults. Async callers should prefer load_app_settings_async().
    """
    row = _settings_cache if _settings_cache is not None else {}
    return _build_settings_from_row(row)


async def load_app_settings_async() -> UserEffectiveSettings:
    """Async settings read. Refreshes cache from DB if TTL expired."""
    row = await _load_settings_from_db()
    return _build_settings_from_row(row)


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


# ── Phase 075.10 -- tool_args_progress boundary helper ─────────────────────────

# Hardcoded pre-075.10 fallback. Used by `tool_args_progress_emit_boundary_bytes()`
# if `load_app_settings()` raises for ANY reason so the streaming services
# never crash on a settings read.
_FALLBACK_TOOL_ARGS_EMIT_BOUNDARY_BYTES = 5120


def tool_args_progress_emit_boundary_bytes() -> int:
    """Return the configured byte boundary for ``tool_args_progress`` SSE emits.

    Defensive: if `load_app_settings()` fails for any reason (DB cache
    cold, missing field, etc.), returns the pre-075.10 hardcoded value
    5120 instead of raising. The streaming generator must never crash on
    a settings read.

    Returns:
        Positive int byte boundary (minimum 1 -- clamps any non-positive
        override up to 1 to avoid a divide-by-zero).
    """
    try:
        value = load_app_settings().chat_tool_args_progress_emit_boundary_bytes
    except Exception:  # noqa: BLE001 -- defensive: NEVER raise from a streaming hot path.
        logger.warning(
            "tool_args_progress_emit_boundary_bytes(): load_app_settings() raised; "
            "falling back to pre-075.10 hardcoded %d",
            _FALLBACK_TOOL_ARGS_EMIT_BOUNDARY_BYTES,
        )
        return _FALLBACK_TOOL_ARGS_EMIT_BOUNDARY_BYTES
    if value is None or value <= 0:
        return _FALLBACK_TOOL_ARGS_EMIT_BOUNDARY_BYTES
    return int(value)


def document_management_enabled() -> bool:
    """Phase 110 DMF-03 — master DM capability gate. Defensive: True on any read failure
    (a settings-read failure must NOT hide DM surfaces — default-on, D-110-2).

    Note the polarity flip vs tool_args_progress_emit_boundary_bytes(): that helper
    falls back to a fixed VALUE; this one MUST fall back to True (default-ON). F8 trap:
    returning False here would silently hide DM despite the default-on guarantee.
    """
    try:
        return load_app_settings().document_management_enabled
    except Exception:  # noqa: BLE001 — defensive: default-on on cold cache / DB read failure
        return True


# ── Phase 147 (FLAG-01) — operator control-plane flag reads ────────────────────
# All three read through the per-worker 30s TTL settings cache (load_app_settings),
# so a flip propagates within the TTL window with NO server restart, and a transient
# DB blip returns LAST-KNOWN-GOOD (the cache is not reset on a read failure — see
# _load_settings_from_db:233-241), never "unknown". A truly-cold cache / a
# load_app_settings() exception falls back to the D-Q4 polarity below.
#
# Pitfall 5 (deliberately NOT done): no Redis pub/sub cross-worker cache-bust. A
# ≤30s per-worker skew is expected and honest — it matches the "takes effect on
# their next call" operator copy.


def self_improve_enabled() -> bool:
    """FLAG-01 capability switch: is the self-improvement (skill-saving) capability on?

    Polarity mirrors document_management_enabled() (default-ON): a cold-cache / DB-read
    failure returns True so a transient blip NEVER silently disables the capability
    (D-Q4). Only a deliberate operator OFF flip flips it.
    """
    try:
        return load_app_settings().self_improve_enabled
    except Exception:  # noqa: BLE001 — defensive: default-ON on cold cache / read failure
        return True


def workflows_enabled() -> bool:
    """FLAG-01 capability switch: are workflow launches allowed?

    Default-ON polarity (D-Q4): a cold-cache / DB-read failure returns True — a blip
    must not silently block workflow launches. In-flight workflow runs are unaffected
    by this flag (D-05); it gates only NEW launches at the kickoff seam.
    """
    try:
        return load_app_settings().workflows_enabled
    except Exception:  # noqa: BLE001 — defensive: default-ON on cold cache / read failure
        return True


def maintenance_mode() -> bool:
    """FLAG-01 platform switch: is the platform in maintenance / read-only mode?

    INVERTED polarity (D-Q4, operator-resolved 2026-07-11): a cold-cache / DB-read
    failure returns False (platform OPEN). Failing "closed" here would be a
    self-inflicted outage — a transient settings-read failure must NEVER wedge the
    whole platform into read-only. Only a deliberate operator ON flip (or a live DB
    value of True) enables maintenance.
    """
    try:
        return load_app_settings().maintenance_mode
    except Exception:  # noqa: BLE001 — defensive: default-OPEN (False) on cold cache / read failure
        return False


def resolve_sub_agent_model(s: "UserEffectiveSettings") -> str:
    """Return the model that would actually be used for sub-agent calls right now.

    Resolution order (matches run_sub_agent logic):
      1. sub_agent_model override (from DB / env)
      2. _SUB_AGENT_MODEL_DEFAULTS[active_provider]
      3. s.llm_model (main chat model as last resort)
    """
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    override = s.sub_agent_model or env_settings.sub_agent_model
    if override:
        return override
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(s.active_provider, "")
    return provider_default or s.llm_model
