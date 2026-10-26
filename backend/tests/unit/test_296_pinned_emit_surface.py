"""Phase 296 (293-F-4, found live by 296-05's roster): a pinned cross-provider emit shot
must resolve its API SURFACE under the PINNED provider, not the run's.

Measured 2026-10-27 (`evidence/roster/pinned-emit-diagnosis.json`): a step pinned to
``gpt-5.6-luna`` from a run on any non-OpenAI provider got OpenAI's key and endpoint, but
``resolve_api_surface`` still read the RUN's ``active_provider`` and returned ``None``
(chat.completions). OpenAI refused: "Function tools with reasoning_effort are not supported
for gpt-5.6-luna in /v1/chat/completions" (400). The same shot under OpenAI settings emits.

The cross-provider copy of the settings already swaps the key and base_url to the target;
it must swap ``active_provider`` too, so every reader of the copy agrees on one provider.
"""
from __future__ import annotations

import asyncio
from typing import Any

from pydantic import BaseModel

from app.services import forced_emit as fe
from app.services.openai_service import resolve_api_surface

PINNED = "gpt-5.6-luna"


class _RunSettings(BaseModel):
    active_provider: str = "deepseek"  # the run's provider, not the pin's
    llm_api_key: str = "sk-run-provider-key"
    llm_base_url: str = "https://api.deepseek.com"


async def _capture(monkeypatch) -> Any:
    captured: dict[str, Any] = {}

    async def _fake_open_stream(provider: str, req):  # noqa: ANN001
        captured["user_settings"] = req.user_settings
        raise RuntimeError("captured — short-circuit")

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    monkeypatch.setattr(fe.settings, "openai_api_key", "sk-openai-test-key", raising=False)
    result = await fe.forced_emit(
        messages=[{"role": "user", "content": "emit"}],
        model=PINNED,
        provider="openai",
        emitter="emit_document_metadata",
        tools=[{"type": "function", "function": {"name": "emit_document_metadata", "parameters": {}}}],
        user_settings=_RunSettings(),
    )
    assert result["failure"] == "provider_error"
    return captured["user_settings"]


def test_pinned_shot_settings_name_the_pinned_provider(monkeypatch):
    us = asyncio.run(_capture(monkeypatch))
    assert us.llm_api_key == "sk-openai-test-key"
    assert us.active_provider == "openai"


def test_pinned_responses_model_resolves_its_own_surface(monkeypatch):
    # Control: under the run's settings the surface is chat.completions — the 400's cause.
    assert resolve_api_surface(PINNED, _RunSettings()) is None
    us = asyncio.run(_capture(monkeypatch))
    assert resolve_api_surface(PINNED, us) == "responses"


def test_same_provider_shot_is_not_copied(monkeypatch):
    """The active-provider path stays byte-identical: no copy, same object."""
    captured: dict[str, Any] = {}

    async def _fake_open_stream(provider: str, req):  # noqa: ANN001
        captured["user_settings"] = req.user_settings
        raise RuntimeError("captured — short-circuit")

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    original = _RunSettings()
    asyncio.run(fe.forced_emit(
        messages=[{"role": "user", "content": "emit"}],
        model="deepseek-v4-pro",
        provider="deepseek",
        emitter="emit_document_metadata",
        tools=[{"type": "function", "function": {"name": "emit_document_metadata", "parameters": {}}}],
        user_settings=original,
    ))
    assert captured["user_settings"] is original
