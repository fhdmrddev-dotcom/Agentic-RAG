from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    openai_api_key: str
    openai_vector_store_id: str = ""
    langsmith_api_key: str = ""
    langsmith_project: str = "agentic-rag-module1"
    langsmith_tracing: str = "true"
    frontend_url: str = "http://localhost:5173"


settings = Settings()
