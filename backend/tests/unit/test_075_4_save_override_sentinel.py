"""_is_valid_api_key sentinel allowlist guard (originally Plan 075.4-04).

Phase 081.1 replaced save_override with DB-backed save_app_settings.
The _is_valid_api_key guard was ported to the new write path (D-14).
Integration tests for the DB path live in test_081_1_settings_migration.py.
Only the pure-function _is_valid_api_key unit tests remain here.
"""

from __future__ import annotations

import logging

import pytest


# ── Unit tests for _is_valid_api_key (pure function) ──────────────────────────


def test_is_valid_api_key_openai_real_key_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "sk-realkey123abc") is True


def test_is_valid_api_key_rejects_canonical_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "***") is False


def test_is_valid_api_key_rejects_keep_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "__KEEP__") is False


def test_is_valid_api_key_rejects_dot_mask_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "••••••") is False


def test_is_valid_api_key_rejects_empty_string() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "") is False


def test_is_valid_api_key_rejects_whitespace() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "   ") is False


def test_is_valid_api_key_rejects_wrong_provider_prefix() -> None:
    from app.models.user_settings import _is_valid_api_key

    # openai_api_key requires sk- prefix — "claude-key-no-prefix" fails
    assert _is_valid_api_key("openai_api_key", "claude-key-no-prefix") is False


def test_is_valid_api_key_anthropic_valid_prefix_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("anthropic_api_key", "sk-ant-validkey") is True


def test_is_valid_api_key_openrouter_valid_prefix_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openrouter_api_key", "sk-or-validkey") is True


def test_is_valid_api_key_google_length_check_passes() -> None:
    from app.models.user_settings import _is_valid_api_key

    # google_api_key: length-only minimum (>=30 chars)
    assert _is_valid_api_key("google_api_key", "x" * 35) is True


def test_is_valid_api_key_google_too_short_fails() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("google_api_key", "tooshort") is False


def test_is_valid_api_key_ollama_any_non_sentinel_passes() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("ollama_api_key", "anything-non-sentinel") is True


def test_is_valid_api_key_ollama_still_rejects_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("ollama_api_key", "***") is False


def test_is_valid_api_key_non_api_key_field_passes_through() -> None:
    from app.models.user_settings import _is_valid_api_key

    # Non-api-key fields fall through unchanged (the guard in save_override
    # only invokes _is_valid_api_key when k.endswith("_api_key")).
    # The helper itself returns True for unknown keys with non-sentinel values
    # to make the unit-test contract explicit.
    assert _is_valid_api_key("not_an_api_key_field", "anything") is True


# Integration tests for save_override were removed in Phase 081.1 — save_override
# was replaced by DB-backed save_app_settings. Equivalent coverage is in
# backend/tests/integration/test_081_1_settings_migration.py
