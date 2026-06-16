"""Phase 111.1 Plan 02 — D-09 #2: local-aware forced_emit cross-provider injection.

BUG-260616-01 (second bug): when a forced shot TARGETS a local provider
(`lmstudio`/`ollama`) that is NOT the active provider, the cross-provider injection
block in `forced_emit` used to no-op — local providers have no `<provider>_api_key`
env field, so `_target_key == ""` and the `if` was skipped. The forced shot then fell
through to the WRONG active (cloud) provider, shipping document text off-box.

The fix adds a local-provider branch BEFORE the cloud branch that injects the local
dummy key + local base_url, MIRRORING `resolve_llm_provider`:
  - lmstudio -> dummy key "lm-studio", base_url = lmstudio_base_url AS-IS (already /v1)
  - ollama   -> dummy key "ollama",    base_url = ollama_base_url + "/v1"
The cloud branch (OpenAI/Anthropic/Google/etc.) stays byte-identical.

These tests drive the REAL `forced_emit` injection branch (patching only the gateway
boundary `open_stream` to capture the resolved `user_settings` handed to the request),
so the resolved local base_url + dummy key are asserted end-to-end.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest
from pydantic import BaseModel

from app.services import forced_emit as fe


class _MiniSettings(BaseModel):
    """Minimal Pydantic stand-in carrying the fields the injection branch touches.

    Must be a Pydantic model (the injection guard requires ``model_copy``) and must
    expose ``active_provider`` (read by ``_active_provider``)."""

    active_provider: str = "openai"  # active != target so the cross-provider block fires
    llm_api_key: str = "sk-active-cloud-key"
    llm_base_url: str = "https://api.openai.com/v1"


async def _capture_user_settings(target_provider: str, *, monkeypatch) -> Any:
    """Run forced_emit far enough to capture the user_settings passed to the gateway."""
    captured: dict[str, Any] = {}

    async def _fake_open_stream(provider: str, req):  # noqa: ANN001
        captured["user_settings"] = req.user_settings
        # Raise so forced_emit honest-fails immediately AFTER the injection — we only
        # need the captured request; the drain/recovery path is irrelevant here.
        raise RuntimeError("captured — short-circuit")

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)

    result = await fe.forced_emit(
        messages=[{"role": "user", "content": "extract metadata"}],
        model="google/gemma-4-12b-qat",  # a slashed LOCAL id
        provider=target_provider,
        emitter="emit_document_metadata",
        tools=[{"type": "function", "function": {"name": "emit_document_metadata", "parameters": {}}}],
        user_settings=_MiniSettings(),
        system_prompt="",
    )
    # provider raise -> honest provider_error (proves the gateway was reached)
    assert result["failure"] == "provider_error"
    return captured["user_settings"]


# ────────────────────────────────────────────────────────────────────
# 1. LM Studio target → dummy key + base_url AS-IS (no /v1 double-append)
# ────────────────────────────────────────────────────────────────────

def test_lmstudio_target_injects_dummy_key_and_base_url_no_double_append(monkeypatch):
    # lmstudio_base_url default already ends in /v1 (config.py:695 = http://localhost:1234/v1).
    expected_base = fe.settings.lmstudio_base_url.rstrip("/")
    us = asyncio.run(_capture_user_settings("lmstudio", monkeypatch=monkeypatch))
    assert us.llm_api_key == "lm-studio"
    assert us.llm_base_url == expected_base
    # No double-append: exactly one trailing /v1, not /v1/v1.
    assert us.llm_base_url.endswith("/v1")
    assert not us.llm_base_url.endswith("/v1/v1")


# ────────────────────────────────────────────────────────────────────
# 2. Ollama target → dummy key + base_url with /v1 appended ONCE
# ────────────────────────────────────────────────────────────────────

def test_ollama_target_injects_dummy_key_and_appends_v1_once(monkeypatch):
    expected_base = f"{fe.settings.ollama_base_url.rstrip('/')}/v1"
    us = asyncio.run(_capture_user_settings("ollama", monkeypatch=monkeypatch))
    assert us.llm_api_key == "ollama"
    assert us.llm_base_url == expected_base
    assert us.llm_base_url.endswith("/v1")
    assert not us.llm_base_url.endswith("/v1/v1")


# ────────────────────────────────────────────────────────────────────
# 3. Cloud target (openrouter) → byte-identical existing behavior (regression)
# ────────────────────────────────────────────────────────────────────

def test_cloud_target_uses_provider_base_url_and_key(monkeypatch):
    """The cloud branch must be untouched: a non-local target resolves the per-provider
    key + _PROVIDER_BASE_URLS endpoint exactly as before."""
    from app.config import _PROVIDER_BASE_URLS

    # Give the env an openrouter key so the cloud branch's _target_key is truthy.
    monkeypatch.setattr(fe.settings, "openrouter_api_key", "sk-or-test-key", raising=False)
    us = asyncio.run(_capture_user_settings("openrouter", monkeypatch=monkeypatch))
    assert us.llm_api_key == "sk-or-test-key"
    assert us.llm_base_url == _PROVIDER_BASE_URLS["openrouter"]


# ────────────────────────────────────────────────────────────────────
# 4. Source guard — the cloud branch path is still present (must_haves)
# ────────────────────────────────────────────────────────────────────

def test_cloud_branch_still_present():
    import inspect

    src = inspect.getsource(fe.forced_emit)
    assert "_PROVIDER_BASE_URLS" in src, "cloud cross-provider branch must remain"
    assert "lmstudio" in src and "ollama" in src, "local branch must be present"
