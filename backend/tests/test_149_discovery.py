"""Phase 149 Plan 02 (MODEL-02) — model-discovery service tests.

All 8 providers are mocked at the httpx.AsyncClient.get seam — NO live network
calls. Covers Task 1 (honest per-provider fan-out outcomes: no_key / http-* /
ok, pagination, casing, exception isolation) and Task 2 (compute_diff
new/changed/vanished partition + the SC#3 propose-only capability-fill
asymmetry).
"""
from __future__ import annotations

import httpx
import pytest
from unittest.mock import patch

from app.services import model_discovery_service as mds


# ─────────────────────────────────────────────────────────────────────────────
# Test doubles — a fake httpx response + a URL-dispatching fake `get`.
# ─────────────────────────────────────────────────────────────────────────────
class _FakeResponse:
    def __init__(self, status_code: int, payload: object):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def _url_of(provider: str) -> str:
    return mds.PROVIDER_ENDPOINTS[provider]["url"]


def _make_fake_get(handlers: dict):
    """handlers maps a provider endpoint URL → fn(params)->_FakeResponse.
    A handler may raise to simulate a network exception on that provider."""

    async def fake_get(self, url, headers=None, params=None, timeout=None):
        handler = handlers.get(url)
        if handler is None:
            return _FakeResponse(404, {})
        return handler(params or {})

    return fake_get


# ─────────────────────────────────────────────────────────────────────────────
# Task 1 — honest per-provider fan-out outcomes.
# ─────────────────────────────────────────────────────────────────────────────
def _provider_outcome_handlers() -> dict:
    def openai_h(params):
        # newest-first must reorder by `created` DESC → gpt-5.6 before gpt-4o.
        return _FakeResponse(200, {"data": [
            {"id": "gpt-4o", "created": 1_600_000_000},
            {"id": "gpt-5.6", "created": 1_700_000_000},
        ]})

    def anthropic_h(params):
        # two-page pagination via has_more + last_id.
        if params.get("after_id"):
            return _FakeResponse(200, {
                "data": [{"id": "claude-page2", "created_at": "2026-01-01T00:00:00Z"}],
                "has_more": False,
            })
        return _FakeResponse(200, {
            "data": [{"id": "claude-page1", "created_at": "2026-02-01T00:00:00Z"}],
            "has_more": True,
            "last_id": "claude-page1",
        })

    def google_h(params):
        # two-page pagination via nextPageToken.
        if params.get("pageToken"):
            return _FakeResponse(200, {"models": [
                {"name": "models/gemini-page2", "inputTokenLimit": 1_000_000,
                 "outputTokenLimit": 8192},
            ]})
        return _FakeResponse(200, {
            "models": [{"name": "models/gemini-page1", "inputTokenLimit": 2_000_000,
                        "outputTokenLimit": 8192}],
            "nextPageToken": "tok-2",
        })

    def deepseek_h(params):
        # 429 → excluded, NOT failed; provider still present in the result.
        return _FakeResponse(429, {"error": "rate limited — this body must never surface"})

    def moonshot_h(params):
        # one provider raising must NOT abort the others.
        raise httpx.ConnectError("boom")

    def minimax_h(params):
        # verbatim id casing preserved (MiniMax-M2.7, not minimax-m2.7).
        return _FakeResponse(200, {"model_list": [{"id": "MiniMax-M2.7"}]})

    def openrouter_h(params):
        return _FakeResponse(200, {"data": [{
            "id": "anthropic/claude-x",
            "created": 1_700_000_000,
            "context_length": 200_000,
            "top_provider": {"max_completion_tokens": 8192},
            "supported_parameters": ["tools", "temperature"],
        }]})

    return {
        _url_of("openai"): openai_h,
        _url_of("anthropic"): anthropic_h,
        _url_of("google"): google_h,
        _url_of("deepseek"): deepseek_h,
        _url_of("moonshot"): moonshot_h,
        _url_of("minimax"): minimax_h,
        _url_of("openrouter"): openrouter_h,
    }


async def test_provider_outcomes():
    keyed = {
        "openai": "sk-openai",
        "anthropic": "sk-anthropic",
        "google": "sk-google",
        "deepseek": "sk-deepseek",
        "moonshot": "sk-moonshot",
        "zhipu": None,       # → no_key skip (auth != public)
        "minimax": "sk-minimax",
        "openrouter": None,  # public endpoint → still fetched
    }

    with patch.object(httpx.AsyncClient, "get", new=_make_fake_get(_provider_outcome_handlers())):
        results = await mds.discover_all(keyed)

    by_provider = {r["provider"]: r for r in results}

    # All 8 providers report an outcome — none silently dropped.
    assert set(by_provider) == set(mds.PROVIDER_ENDPOINTS)

    # no_key: skipped honestly, not failed.
    assert by_provider["zhipu"]["status"] == "no_key"

    # 429: excluded-not-failed — provider present, verbatim status code, no body echo.
    assert by_provider["deepseek"]["status"] == "http-429"
    assert by_provider["deepseek"]["ids"] == []

    # Exception isolation: moonshot errored, the other seven are intact.
    assert by_provider["moonshot"]["status"].startswith("error-")
    assert by_provider["openai"]["status"] == "ok"

    # newest-first ordering by created stamp.
    assert by_provider["openai"]["ids"] == ["gpt-5.6", "gpt-4o"]

    # Google pagination: BOTH pages present.
    assert by_provider["google"]["status"] == "ok"
    assert "gemini-page1" in by_provider["google"]["ids"]
    assert "gemini-page2" in by_provider["google"]["ids"]

    # Anthropic pagination: BOTH pages present.
    assert "claude-page1" in by_provider["anthropic"]["ids"]
    assert "claude-page2" in by_provider["anthropic"]["ids"]

    # Verbatim id casing preserved (Pitfall 6).
    assert "MiniMax-M2.7" in by_provider["minimax"]["ids"]

    # capabilities_returned only for the two providers that return capability
    # metadata (google + openrouter); everything else False.
    assert by_provider["google"]["capabilities_returned"] is True
    assert by_provider["openrouter"]["capabilities_returned"] is True
    assert by_provider["openai"]["capabilities_returned"] is False
    assert by_provider["minimax"]["capabilities_returned"] is False

    # Failure messages are names-only — never echo the response body.
    assert "rate limited" not in by_provider["deepseek"]["status"]
