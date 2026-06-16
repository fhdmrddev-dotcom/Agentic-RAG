"""Phase 111.1 Wave-0 (RED) — embedding-preset resolution (EMBED-01/02/03).

A preset name resolves to a {base_url, default model, default dims, key} bundle:
  - "openai"    -> active-provider base_url + real key + text-embedding-3-small / 1536
  - "google"    -> Google embeddings base_url + gemini-embedding-001 (curated in Plan 06)
  - "ollama"    -> local base_url (+ /v1) + dummy key "ollama"
  - "lmstudio"  -> local base_url AS-IS (already /v1) + dummy key "lm-studio"

The backend preset-resolution helper lands in Plan 03/06 (the picker preset map
fills the UI side in Plan 06). RED convention: import the not-yet-built symbol
INSIDE each test body; xfail(strict=False) so the suite still exits 0.
"""

import pytest


@pytest.mark.xfail(
    reason="embedding preset resolver not built until Plan 03/06 (EMBED-01/02/03)",
    strict=False,
)
def test_local_preset_resolves_dummy_key_and_local_base_url():
    from app.services.embedding_service import resolve_embedding_preset

    preset = resolve_embedding_preset("ollama")
    assert preset["base_url"].endswith("/v1"), "ollama preset base_url ends with /v1"
    assert preset["api_key"] == "ollama", "local presets use the dummy key, never a real one"


@pytest.mark.xfail(
    reason="embedding preset resolver not built until Plan 03/06 (EMBED-01/02/03)",
    strict=False,
)
def test_lmstudio_preset_does_not_double_append_v1():
    from app.services.embedding_service import resolve_embedding_preset

    preset = resolve_embedding_preset("lmstudio")
    assert not preset["base_url"].endswith("/v1/v1"), "LM Studio URL already ends /v1 — no double append"
    assert preset["api_key"] == "lm-studio", "LM Studio preset uses the dummy 'lm-studio' key"


@pytest.mark.xfail(
    reason="embedding preset resolver not built until Plan 03/06 (EMBED-01/02/03)",
    strict=False,
)
def test_openai_preset_carries_default_model_and_dims():
    from app.services.embedding_service import resolve_embedding_preset

    preset = resolve_embedding_preset("openai")
    assert preset["model"] == "text-embedding-3-small", "OpenAI preset default model"
    assert preset["dimensions"] == 1536, "OpenAI preset default dims"
