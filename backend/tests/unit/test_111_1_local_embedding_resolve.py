"""Phase 111.1 — local embedder endpoint resolution (EMBED-02).

Mirrors `test_111_lmstudio_provider.py` but for the EMBEDDING client path: when a
local preset (Ollama / LM Studio) is configured, the embedding client resolves the
correct local base_url with NO double `/v1` append:
  - Ollama:   base_url == ollama_base_url + "/v1"  (single append)
  - LM Studio: base_url == lmstudio_base_url AS-IS (already /v1 — DO NOT double-append)

Wired through user_settings in Plan 03; these assert as plain green.
"""


def test_ollama_embedding_base_url_single_v1_append():
    from app.config import Settings
    from app.services.openai_service import get_embedding_client

    s = Settings(
        llm_provider="ollama",
        ollama_base_url="http://localhost:11434",
        embedding_provider="ollama",
    )
    client = get_embedding_client(s)
    base = str(getattr(client, "base_url", ""))
    assert base.rstrip("/").endswith("/v1"), f"ollama embedding base_url ends /v1 (got {base!r})"
    assert "/v1/v1" not in base, "no /v1/v1 double-append"


def test_lmstudio_embedding_base_url_no_double_v1():
    from app.config import Settings
    from app.services.openai_service import get_embedding_client

    s = Settings(
        llm_provider="lmstudio",
        lmstudio_base_url="http://localhost:1234/v1",
        embedding_provider="lmstudio",
    )
    client = get_embedding_client(s)
    base = str(getattr(client, "base_url", ""))
    assert "/v1/v1" not in base, f"LM Studio base_url must NOT double-append /v1 (got {base!r})"
