from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str

    # LLM provider (OpenAI-compatible)
    llm_api_key: str
    llm_base_url: str = ""
    llm_model: str = "gpt-4o"
    # Comma-separated list of models to expose in UI (defaults to llm_model if empty)
    available_models: str = ""

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
