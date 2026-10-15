"""Phase 282 code review (282-REVIEW.md) — one RED-driven pin per fixed finding.

Each test here was run FAILING against ``3268b6228`` (the reviewed HEAD) before its fix landed,
so it proves the defect the review CLAIMED rather than restating the fix.

- CR-01: the SDK retry count follows the provider that chose the ENDPOINT (the routing provider
  ``open_stream`` was called with), never the registry vendor of the model id.
- WR-01: an open still queued for a thread when the guard fires never starts a request.
- WR-02: a sub-agent ended by the per-call timeout records WHY, not an empty string.
- WR-03: forced_emit treats a per-call timeout as terminal for its ladder.
- WR-04: an env override above the ceiling clamps to it, like the DB tier, rather than dropping.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.config as config
from app.services import openai_service
from app.services.provider_gateway import dispatcher, openai_compat, openai_responses
from app.services.provider_gateway.dispatcher import GatewayRequest


class _Stop(Exception):
    """Raised by a recorder once it has captured its kwargs."""


def _compat_recorder(record: dict):
    def _fake(**kwargs):
        record.update(kwargs)
        raise _Stop

    return _fake


# ── CR-01 ─────────────────────────────────────────────────────────────────────────────────


def test_cr01_compat_retries_follow_the_endpoint_provider_not_the_registry_vendor(monkeypatch):
    """An LM Studio model id shaped ``qwen/qwen3-30b-a3b`` resolves to registry vendor
    ``openrouter`` (the review measured it with the live resolver), while the client is pointed
    at LM Studio by ``user_settings``. The local GPU must be tried ONCE (D-19)."""
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(
        messages=[],
        model="qwen/qwen3-30b-a3b",
        active_provider_name="openrouter",
        user_settings=SimpleNamespace(active_provider="lmstudio"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert rec["max_retries"] == 0


async def test_cr01_open_stream_stamps_its_routing_provider_on_the_request(monkeypatch):
    """``open_stream``'s first argument IS the routing provider at every caller (agent_loop:
    ``user_settings.active_provider``; task_service: ``_provider``; forced_emit: the target,
    whose endpoint it injects). No user_settings at all → that argument still decides."""
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    monkeypatch.setattr(openai_service, "resolve_api_surface", lambda *_a, **_k: None)
    req = GatewayRequest(
        messages=[], model="deepseek-r1:14b", active_provider_name="deepseek", timeout_s=900
    )
    with pytest.raises(_Stop):
        await dispatcher.open_stream("ollama", req)
    assert rec["max_retries"] == 0


def test_cr01_cloud_routing_keeps_cloud_retries(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(
        messages=[],
        model="qwen/qwen3-30b-a3b",
        active_provider_name="openrouter",
        user_settings=SimpleNamespace(active_provider="openrouter"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert rec["max_retries"] == 2


def test_cr01_responses_adapter_keys_retries_on_the_same_routing_provider(monkeypatch):
    rec: dict = {}

    def _fake(user_settings=None, **kw):
        rec.update(kw)
        raise _Stop

    monkeypatch.setattr(openai_responses, "get_llm_client", _fake)
    req = GatewayRequest(
        messages=[],
        model="gpt-5.6",
        active_provider_name="openai",
        user_settings=SimpleNamespace(active_provider="lmstudio"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_responses.open_openai_responses_stream(req)
    assert rec["max_retries"] == 0
