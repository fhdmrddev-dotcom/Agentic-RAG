from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROVIDER_BASE_URLS: dict[str, str] = {
    "openai": "",
    "anthropic": "https://api.anthropic.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "",  # resolved dynamically from ollama_base_url
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

    # Sub-agent settings
    sub_agent_max_chars: int = 100000

    # Observability
    langsmith_api_key: str = ""
    langsmith_project: str = "agentic-rag-module2"
    langsmith_tracing: str = "true"

    frontend_url: str = "http://localhost:5173"


settings = Settings()
