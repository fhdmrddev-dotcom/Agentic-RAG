from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROVIDER_BASE_URLS: dict[str, str] = {
    "openai": "",
    "anthropic": "https://api.anthropic.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "",  # resolved dynamically from ollama_base_url
}

# Main-agent context budget by provider. Used as fallback when no model-specific
# entry exists in MODEL_CONTEXT_DEFAULTS or MODEL_CONTEXT_LIMITS.
PROVIDER_CONTEXT_DEFAULTS: dict[str, int] = {
    "anthropic":  120_000,  # $3-5/1M — cap to control costs on long conversations
    "openai":     200_000,  # GPT-5.4 tiers at 272k — stay well below
    "google":     180_000,  # Gemini Pro tiers at 200k — stay just below
    "openrouter": 100_000,  # Unknown underlying model — stay conservative
    "ollama":      80_000,  # Local hardware — stay conservative
}

# Per-model context budgets (practical input limits, not theoretical maximums).
# Leaves headroom for system prompt, tool results, and output tokens.
# Override any entry via MODEL_CONTEXT_LIMITS in .env (format: model-id=tokens,...)
MODEL_CONTEXT_DEFAULTS: dict[str, int] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "gpt-4o":                               100_000,  # actual 128k
    "gpt-4o-mini":                          100_000,  # actual 128k
    "gpt-4.1":                              400_000,  # actual 1M — practical cap
    "gpt-4.1-mini":                         400_000,  # actual 1M — practical cap
    "gpt-4.1-nano":                         400_000,  # actual 1M — practical cap
    "gpt-5":                                200_000,  # actual 200k
    "gpt-5.4-mini":                         200_000,  # actual 200k
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-opus-4-6":                      150_000,  # actual 200k
    "claude-sonnet-4-6":                    150_000,  # actual 200k
    "claude-haiku-4-5-20251001":            150_000,  # actual 200k
    # ── Google ──────────────────────────────────────────────────────────────
    "gemini-2.5-pro":                       600_000,  # actual 1M — practical cap
    "gemini-2.5-flash":                     600_000,  # actual 1M — practical cap
    "gemini-2.5-flash-lite":                600_000,  # actual 1M — practical cap
    "gemini-3-flash-preview":               600_000,  # actual 1M — practical cap
    # ── OpenRouter ──────────────────────────────────────────────────────────
    "meta-llama/llama-3.3-70b-instruct":    100_000,  # actual 128k
    "deepseek/deepseek-r1":                 100_000,  # actual 128k via OpenRouter
    "moonshotai/kimi-k2.5":                 200_000,  # actual 262k
    "minimax/minimax-m2.7":                 160_000,  # actual 204k
    "minimax/minimax-m2.5:free":            150_000,  # actual 196k
    "nvidia/nemotron-3-super-120b-a12b:free": 200_000,  # actual 262k
    "google/gemma-4-26b-a4b-it":             200_000,  # actual 262k
    "google/gemma-4-31b-it:free":            200_000,  # actual 262k — free tier
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str

    # Active provider — set this to switch between providers
    # Options: openai | anthropic | google | openrouter | ollama
    # Leave blank to use the legacy LLM_API_KEY / LLM_BASE_URL directly.
    llm_provider: str = ""

    # Per-provider keys (add the ones you have; unused providers are ignored)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    # Resolved credentials — set directly only in legacy mode (no LLM_PROVIDER).
    # When LLM_PROVIDER is set these are overwritten by the validator below.
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = "gpt-4o"
    # Comma-separated list of models to expose in UI (defaults to llm_model if empty)
    available_models: str = ""

    # Per-provider model lists (comma-separated; empty = not configured)
    openai_models: str = ""
    anthropic_models: str = ""
    google_models: str = ""
    openrouter_models: str = ""
    ollama_models: str = ""

    @model_validator(mode="after")
    def resolve_llm_provider(self) -> "Settings":
        provider = self.llm_provider.strip().lower()
        if not provider:
            return self  # legacy mode: LLM_API_KEY / LLM_BASE_URL used as-is

        key_map: dict[str, str] = {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "google": self.google_api_key,
            "openrouter": self.openrouter_api_key,
            "ollama": "ollama",  # Ollama doesn't require a real key
        }
        if provider not in key_map:
            raise ValueError(
                f"Unknown LLM_PROVIDER '{provider}'. "
                f"Must be one of: {', '.join(key_map)}"
            )

        resolved_key = key_map[provider]
        if resolved_key:
            self.llm_api_key = resolved_key

        if provider == "ollama":
            self.llm_base_url = f"{self.ollama_base_url.rstrip('/')}/v1"
        else:
            self.llm_base_url = _PROVIDER_BASE_URLS[provider]

        return self

    # Embedding provider (falls back to LLM key if not set)
    embedding_api_key: str = ""
    embedding_base_url: str = ""
    embedding_model: str = "text-embedding-3-small"
    # Must match the embedding model's output dimension.
    # 1536 = text-embedding-3-small, 768 = nomic-embed-text, 384 = all-MiniLM-L6-v2
    # Only change if switching models (requires resize_embedding_column + re-ingestion)
    embedding_dimensions: int = 1536

    # Retrieval settings
    retrieval_top_k: int = 5
    retrieval_match_threshold: float = 0.3

    # Hybrid search (vector + keyword with RRF fusion)
    hybrid_search_enabled: bool = True
    hybrid_candidate_count: int = 20  # candidates from each method before fusion
    vector_search_weight: float = 1.0
    keyword_search_weight: float = 1.0
    rrf_k: int = 60  # RRF constant (standard: 60)

    # Reranking (disabled by default — requires Cohere API key or local model)
    rerank_enabled: bool = False
    rerank_provider: str = "api"  # "api" (Cohere) or "local" (sentence-transformers)
    rerank_api_key: str = ""      # required when rerank_provider="api"
    rerank_model: str = "rerank-v3.5"  # API: "rerank-v3.5" | Local: "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_top_n: int = 5         # final results returned after reranking

    # Chunking settings
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Web search (Tavily) — tool is disabled when key is absent
    tavily_api_key: str = ""
    web_search_max_results: int = 5

    # Code execution sandbox
    sandbox_enabled: bool = False
    sandbox_ttl_minutes: int = 30

    @property
    def web_search_enabled(self) -> bool:
        return bool(self.tavily_api_key)

    # Context window management
    context_window_max_tokens: int = 0
    # 0 = auto-select from MODEL_CONTEXT_DEFAULTS / PROVIDER_CONTEXT_DEFAULTS.
    # Set CONTEXT_WINDOW_MAX_TOKENS=<n> in .env to override for ALL models globally.
    context_window_reserve_recent: int = 10  # minimum recent messages to always preserve

    # Per-model context window overrides. Syntax: model-id=tokens,model-id=tokens
    # Use = not : as separator (model IDs like minimax-m2.5:free already contain colons).
    # Example: MODEL_CONTEXT_LIMITS=gpt-4o=128000,moonshotai/kimi-k2.5=250000
    # Overrides MODEL_CONTEXT_DEFAULTS for the listed models; others keep their defaults.
    model_context_limits: str = ""

    # Global max tokens override for LLM output.
    # When left at the default (8192), per-model/provider smart defaults apply instead
    # (see _MODEL_OUTPUT_DEFAULTS / _PROVIDER_DEFAULT_MAX_TOKENS in openai_service.py).
    # Set this explicitly in .env only when you need a universal cap (e.g. LLM_MAX_OUTPUT_TOKENS=32768).
    llm_max_output_tokens: int = 8192

    # Per-model output token overrides. Syntax: model-id=tokens,model-id=tokens
    # Example: MODEL_OUTPUT_LIMITS=claude-sonnet-4-6=32768,minimax/minimax-m2.7=32768
    # Overrides _MODEL_OUTPUT_DEFAULTS for the listed models.
    model_output_limits: str = ""

    # Vision model for image description during ingestion (must support vision)
    # Defaults to gpt-4o-mini — override with VISION_MODEL=<model-id> in .env
    vision_model: str = "gpt-4o-mini"

    # Sub-agent settings
    sub_agent_model: str = ""
    # Empty = auto-select cheapest model for active provider (see sub_agent_service.py).
    # Set SUB_AGENT_MODEL=<model-id> in .env to override for all providers.
    sub_agent_max_chars: int = 600_000
    # Sub-agents have their own independent context window — this cap is NOT protecting
    # the main agent's budget. 600k chars ≈ 150k tokens, which fits any 200k+ model
    # (Haiku 4.5: 200k, GPT-5.4-nano: 400k, Gemini Flash: 1M) with headroom for output.
    sub_agent_max_output_tokens: int = 8192
    # Default output ceiling for sub-agent analysis tasks (D-08).
    # Generation tasks (pptx, report, pdf, etc.) override this with max(32768, this value).
    # Range: 4096–65536. Set SUB_AGENT_MAX_OUTPUT_TOKENS=<n> in .env to override globally.
    # Overridable per-user via Settings UI slider.

    # Observability
    langsmith_api_key: str = ""
    langsmith_project: str = "agentic-rag-module2"
    langsmith_tracing: str = "true"

    frontend_url: str = "http://localhost:5173"


settings = Settings()
