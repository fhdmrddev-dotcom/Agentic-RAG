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


# ─────────────────────────────────────────────────────────────────────────────
# Task 2 — diff partition + propose-only capability fill (SC#3).
# ─────────────────────────────────────────────────────────────────────────────
def test_discovery():
    """new/changed/vanished partition; a FAILED provider manufactures no
    false-vanished (the 058/060 lesson).

    CR-01: the ``current`` fixture uses the REAL registry namespace
    (``context_window_tokens`` / ``max_output_tokens``) that the ONLY production caller
    (``admin.run_model_discovery``, which builds ``current`` from MODEL_CAPABILITIES ∪
    ``load_all_model_overrides``) actually produces — NOT the discovery-service field names
    (``context`` / ``max_output``) the buggy fixture used to feed. This exercises the true
    changed-detection contract.
    """
    current = {
        "gpt-4o":       {"provider": "openai", "context_window_tokens": 128_000, "enabled": True},
        "gpt-old":      {"provider": "openai", "enabled": True},      # → vanished (openai ok)
        "claude-x":     {"provider": "anthropic", "enabled": True},   # anthropic FAILED → NOT vanished
        # gemini-match: registry caps EXACTLY equal what Google returns → must NOT be "changed".
        "gemini-match": {"provider": "google", "context_window_tokens": 1_000_000, "max_output_tokens": 8192},
        # gemini-pro: registry context genuinely differs (1M stored vs 2M discovered) → "changed".
        "gemini-pro":   {"provider": "google", "context_window_tokens": 1_000_000, "max_output_tokens": 8192},
    }
    discovered = [
        {"provider": "openai", "status": "ok", "ids": ["gpt-5.6", "gpt-4o"],
         "caps": {}, "capabilities_returned": False},
        # anthropic did not respond ok → contributes NO vanished entries.
        {"provider": "anthropic", "status": "http-429", "ids": []},
        {"provider": "google", "status": "ok",
         "ids": ["gemini-match", "gemini-pro", "gemini-new"],
         "caps": {"gemini-match": {"context": 1_000_000, "max_output": 8192},
                  "gemini-pro": {"context": 2_000_000, "max_output": 8192},
                  "gemini-new": {"context": 1_000_000, "max_output": 8192}},
         "capabilities_returned": True},
    ]

    diff = mds.compute_diff(current, discovered)

    assert {n["model_id"] for n in diff["new"]} == {"gpt-5.6", "gemini-new"}

    changed_ids = {c["model_id"] for c in diff["changed"]}
    # (a) a known model whose registry caps MATCH the discovered caps is NOT "changed" —
    #     this is the regression the CR-01 bug produced (matching caps false-flagged as changed).
    assert "gemini-match" not in changed_ids
    # (b) a known model whose value genuinely differs IS "changed", comparing against the
    #     REGISTRY value (context_window_tokens=1M) — the from-value is 1M, NOT a spurious null.
    assert changed_ids == {"gemini-pro"}
    gemini_pro = next(c for c in diff["changed"] if c["model_id"] == "gemini-pro")
    assert gemini_pro["changes"]["context"] == {"from": 1_000_000, "to": 2_000_000}
    # max_output matched (8192 == 8192) so it is NOT reported as a change.
    assert "max_output" not in gemini_pro["changes"]

    # gpt-old vanished (openai is ok); claude-x does NOT (anthropic failed).
    vanished_ids = {v["model_id"] for v in diff["vanished"]}
    assert vanished_ids == {"gpt-old"}
    assert "claude-x" not in vanished_ids

    # Ephemeral + JSON-serializable (D-149-12) — no proposals table.
    import json
    json.dumps(diff)


def test_propose_only():
    """SC#3: new models land disabled; capabilities fill ONLY where the provider
    returned them — OpenRouter fills native_tools, Google does not, everyone else
    fills nothing. An un-returned capability is the `unknown` sentinel, never a
    guessed value and never an auto-enable."""
    current: dict = {}  # everything discovered is new
    discovered = [
        {"provider": "openai", "status": "ok", "ids": ["gpt-new"],
         "caps": {}, "capabilities_returned": False},
        {"provider": "google", "status": "ok", "ids": ["gemini-new"],
         "caps": {"gemini-new": {"context": 1_000_000, "max_output": 8192}},
         "capabilities_returned": True},
        {"provider": "openrouter", "status": "ok", "ids": ["vendor/model-new"],
         "caps": {"vendor/model-new": {"context": 200_000, "max_output": 8192,
                                       "native_tools": True}},
         "capabilities_returned": True},
    ]

    diff = mds.compute_diff(current, discovered)
    new_by_id = {n["model_id"]: n for n in diff["new"]}

    # No new model is ever auto-enabled.
    for entry in diff["new"]:
        assert entry["enabled"] is False

    # OpenAI (IDs only) → EVERY capability field is the unknown sentinel.
    openai_caps = new_by_id["gpt-new"]["capabilities"]
    assert openai_caps["context"] == mds.UNKNOWN
    assert openai_caps["max_output"] == mds.UNKNOWN
    assert openai_caps["native_tools"] == mds.UNKNOWN

    # Google → context + max_output filled; native_tools is the sentinel, NOT a bool.
    g = new_by_id["gemini-new"]["capabilities"]
    assert g["context"] == 1_000_000
    assert g["max_output"] == 8192
    assert g["native_tools"] == mds.UNKNOWN
    assert not isinstance(g["native_tools"], bool)

    # OpenRouter → native_tools filled from supported_parameters (a real bool).
    o = new_by_id["vendor/model-new"]["capabilities"]
    assert o["context"] == 200_000
    assert o["max_output"] == 8192
    assert isinstance(o["native_tools"], bool)
    assert o["native_tools"] is True
