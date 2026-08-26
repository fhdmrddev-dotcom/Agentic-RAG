"""SC#10 / W-1 (reopened) — the outage message must name the endpoint that was ACTUALLY called.

Driven RED against the substring-inference implementation on 2026-08-26: five of these
cases claimed ``openai`` while the client pointed somewhere else entirely. The roster and
the two reasons this is not an edge case are in
``.planning/phases/210-.../210-SC10-ROSTER.md``.

⚠ THE LABEL IS EMPTY IN EVERY CASE HERE ON PURPOSE. ``embedding_provider`` has NO env
fallback (``user_settings.py:919`` passes ``None`` as the env key) and
``deploy/onebox.env.example`` ships no provider field, so an env-configured install sits in
exactly this state until a human opens Settings and clicks a preset.
"""
import pytest

from app.models.user_settings import _build_settings_from_row
from app.services.openai_service import (
    get_embedding_client,
    resolve_effective_embedding_provider,
)

# Derived from EMBEDDING_PRESETS (frontend ProviderPicker.tsx:49), never re-typed from a doc.
PRESETS = [
    ("openai", "https://api.openai.com/v1", "text-embedding-3-small", "openai"),
    ("openai-large", "https://api.openai.com/v1", "text-embedding-3-large", "openai"),
    ("google", "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-embedding-001", "google"),
    ("ollama", "http://localhost:11434/v1", "nomic-embed-text", "ollama"),
    # ⚠ THE ONE THAT BROKE: the inference matched Ollama's :11434 and had no arm for
    # LM Studio's :1234, so a shipped first-class local preset claimed "openai".
    ("lmstudio", "http://localhost:1234/v1", "nomic-embed-text", "lmstudio"),
    ("cohere", "https://api.cohere.ai/compatibility/v1", "embed-v4.0", "cohere"),
    ("jina", "https://api.jina.ai/v1", "jina-embeddings-v3", "jina"),
    ("mistral", "https://api.mistral.ai/v1", "mistral-embed", "mistral"),
]


def _settings(base_url: str, model: str, label: str = ""):
    return _build_settings_from_row({
        "embedding_provider": label,
        "embedding_base_url": base_url,
        "embedding_model": model,
        "embedding_api_key": "sk-test-key",
        "embedding_dimensions": 1536,
        # A DIFFERENT LLM provider throughout: the embedding name must never borrow it
        # when dedicated embedding credentials are set.
        "llm_provider": "deepseek",
        "llm_model": "deepseek-v4-flash",
    })


@pytest.mark.parametrize("key,base_url,model,expected", PRESETS)
def test_named_provider_matches_the_endpoint_called_with_no_label(key, base_url, model, expected):
    s = _settings(base_url, model)
    assert resolve_effective_embedding_provider(s) == expected, (
        f"{key}: named the wrong provider for {base_url}"
    )


@pytest.mark.parametrize("key,base_url,model,expected", PRESETS)
def test_named_provider_matches_the_endpoint_called_with_label(key, base_url, model, expected):
    s = _settings(base_url, model, label=key)
    named = resolve_effective_embedding_provider(s)
    # The stored label may be more specific (openai-large), but it must never contradict
    # the host that was actually called.
    assert named in (expected, key), f"{key}: label state named {named!r}"


def test_unknown_host_names_the_host_never_openai():
    """A private OpenAI-compatible endpoint must NOT be called ``openai``.

    The host is a TRUE name; ``openai`` is a false one, and a false one sends the operator
    to the wrong account — the failure BUG-260815-05 was filed for.
    """
    s = _settings("https://embeddings.acme-internal.example.com/v1", "acme-embed-1")
    named = resolve_effective_embedding_provider(s)
    assert named != "openai"
    assert "acme-internal.example.com" in named


def test_name_tracks_the_client_that_is_actually_built():
    """The name and the endpoint come from one resolution, so they cannot drift."""
    for key, base_url, model, _ in PRESETS:
        s = _settings(base_url, model)
        assert str(get_embedding_client(s).base_url).rstrip("/") == base_url.rstrip("/"), key


def test_no_dedicated_key_falls_back_to_the_llm_endpoint():
    """With no embedding key, get_embedding_client reuses the LLM credentials — say so."""
    s = _build_settings_from_row({
        "embedding_provider": "openai",          # a stale label that routes NOTHING
        "embedding_base_url": "",
        "embedding_api_key": "",
        "embedding_model": "text-embedding-3-small",
        "llm_provider": "ollama",
        "llm_model": "qwen3:8b",
    })
    assert resolve_effective_embedding_provider(s) == "ollama"
