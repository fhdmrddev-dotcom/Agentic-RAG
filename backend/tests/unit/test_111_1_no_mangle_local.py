"""Phase 111.1 Plan 02 — D-09 #3: OpenRouter mangling gated on provider==openrouter.

BUG-260616-01 (the bug that actually blocked the live test): the OpenRouter "quality"
strategy block in `create_adaptive_streaming_chat` was gated on `"/" in effective_model`.
Every LM Studio / Ollama model is named `org/model` (`google/gemma-4-e4b`), so the gate
fired for local models too — appending `:exacto` to the model id and injecting an
`extra_body={"plugins":[{"id":"response-healing"}]}`. Both are OpenRouter-only; LM Studio
has no `:exacto` model and no plugin system → it returns a 500 and extraction dies.

The fix gates on the RESOLVED `provider` (`provider == "openrouter"`) instead of the slash.

These tests drive the REAL `create_adaptive_streaming_chat` (patching only the client
boundary `get_llm_client` to capture the kwargs sent to the SDK), so a local slashed id
gets NO `:exacto`/plugin while an OpenRouter id still gets the full quality strategy.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import openai_service as svc
from app.services.openai_service import CallingMode


class _FakeCompletions:
    def __init__(self, sink: dict):
        self._sink = sink

    def create(self, **kwargs):  # noqa: ANN003
        self._sink["kwargs"] = kwargs
        return iter(())  # an empty stream is fine — we only inspect kwargs


class _FakeClient:
    def __init__(self, sink: dict):
        self.chat = SimpleNamespace(completions=_FakeCompletions(sink))


def _call(model: str, active_provider: str, *, monkeypatch) -> dict:
    """Run create_adaptive_streaming_chat far enough to capture the SDK kwargs."""
    sink: dict = {}
    monkeypatch.setattr(svc, "get_llm_client", lambda us=None: _FakeClient(sink))
    # Force the NATIVE auto branch so the quality block is reachable regardless of
    # registry calling-mode resolution for the local id.
    monkeypatch.setattr(svc, "resolve_calling_mode", lambda m, us=None: CallingMode.NATIVE)
    monkeypatch.setattr(svc, "get_tools", lambda us=None: [])

    user_settings = SimpleNamespace(
        llm_model=model,
        active_provider=active_provider,
        openrouter_tool_strategy="quality",
    )
    svc.create_adaptive_streaming_chat(
        messages=[{"role": "user", "content": "hi"}],
        tool_choice="auto",
        model=model,
        user_settings=user_settings,
        max_tokens=1024,  # explicit so _resolve_max_tokens short-circuits cleanly
    )
    return sink["kwargs"]


# ────────────────────────────────────────────────────────────────────
# 1. Local slashed id (provider=lmstudio) → NO :exacto, NO plugin
# ────────────────────────────────────────────────────────────────────

def test_local_slashed_id_not_mangled(monkeypatch):
    kwargs = _call("google/gemma-4-e4b", active_provider="lmstudio", monkeypatch=monkeypatch)
    # The model id is untouched — no :exacto appended (LM Studio would 500 on it).
    assert kwargs["model"] == "google/gemma-4-e4b"
    assert ":exacto" not in kwargs["model"]
    # No response-healing plugin injected.
    plugins = (kwargs.get("extra_body") or {}).get("plugins")
    assert plugins is None


def test_local_ollama_slashed_id_not_mangled(monkeypatch):
    kwargs = _call("library/llama-4-8b", active_provider="ollama", monkeypatch=monkeypatch)
    assert kwargs["model"] == "library/llama-4-8b"
    assert ":exacto" not in kwargs["model"]
    assert (kwargs.get("extra_body") or {}).get("plugins") is None


# ────────────────────────────────────────────────────────────────────
# 2. OpenRouter id (provider=openrouter) → :exacto + plugin (quality preserved)
# ────────────────────────────────────────────────────────────────────

def test_openrouter_id_still_mangled(monkeypatch):
    """Regression guard: the OpenRouter quality strategy must still apply."""
    kwargs = _call("anthropic/claude-sonnet-4-6", active_provider="openrouter", monkeypatch=monkeypatch)
    assert kwargs["model"] == "anthropic/claude-sonnet-4-6:exacto"
    plugins = kwargs["extra_body"]["plugins"]
    assert plugins == [{"id": "response-healing"}]


# ────────────────────────────────────────────────────────────────────
# 3. Source guard — the gate is provider-based, not slash-based (must_haves)
# ────────────────────────────────────────────────────────────────────

def test_mangling_gate_is_provider_based():
    import inspect

    src = inspect.getsource(svc.create_adaptive_streaming_chat)
    assert 'provider == "openrouter"' in src, "mangling must gate on provider, not slash"
