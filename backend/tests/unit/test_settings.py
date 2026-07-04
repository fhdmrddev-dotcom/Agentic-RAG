"""Unit tests for settings API models — CTX-03.

Phase 137.1-05 (EVAL-05f / D-11 / D-12) extends this with the shared harness
judge-model knob: the settings API exposes the ALREADY-end-to-end
``harness_judge_model`` (raw + resolved via ``resolve_judge_model`` — the ONE
source of truth used by BOTH the eval judge and the publish judge; no new setting,
no migration, no second resolver) and registry-validates it on write (an unknown
model 400s; the effective default surfaces when unset).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest


def _fake_settings(**overrides):
    """A fully-populated effective-settings stand-in for ``_build_response``.

    Carries every attribute the response builder reads directly (providers is an
    empty list so no ProviderInfo / inferred-provider entries are produced), so a
    test can drive ``_build_response`` with no DB. Override any field via kwargs.
    """
    base = dict(
        active_provider="anthropic",
        llm_model="claude-sonnet-5",
        available_models=["claude-sonnet-5"],
        providers=[],
        embedding_model="text-embedding-3-small",
        embedding_base_url="https://api.openai.com/v1",
        embedding_dimensions=1536,
        embedding_api_key="sk-e",
        embedding_provider="openai",
        extraction_provider="openai",
        extraction_model="gpt-5.4-mini",
        rerank_enabled=False,
        rerank_provider="cohere",
        rerank_model="rerank-3",
        rerank_top_n=5,
        rerank_api_key="",
        retrieval_top_k=10,
        retrieval_match_threshold=0.3,
        hybrid_search_enabled=True,
        hybrid_candidate_count=40,
        vector_search_weight=0.7,
        keyword_search_weight=0.3,
        rrf_k=60,
        web_search_enabled=False,
        tavily_api_key="",
        web_search_max_results=5,
        sandbox_enabled=True,
        context_window_max_tokens=120000,
        sub_agent_max_output_tokens=8192,
        sub_agent_model="claude-haiku-4-5-20251001",
        skill_builder_model="",
        harness_judge_model="",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ---------------------------------------------------------------------------
# sub_agent_max_output_tokens settings (CTX-03)
# ---------------------------------------------------------------------------

def test_sub_agent_output_tokens_field_range():
    """SettingsUpdate rejects sub_agent_max_output_tokens outside 4096-65536."""
    from pydantic import ValidationError
    from app.api.settings import SettingsUpdate

    # Valid boundary values must be accepted
    s_min = SettingsUpdate(sub_agent_max_output_tokens=4096)
    assert s_min.sub_agent_max_output_tokens == 4096

    s_max = SettingsUpdate(sub_agent_max_output_tokens=65536)
    assert s_max.sub_agent_max_output_tokens == 65536

    # Below minimum must raise ValidationError
    with pytest.raises(ValidationError):
        SettingsUpdate(sub_agent_max_output_tokens=4095)

    # Above maximum must raise ValidationError
    with pytest.raises(ValidationError):
        SettingsUpdate(sub_agent_max_output_tokens=65537)


def test_sub_agent_settings_roundtrip():
    """sub_agent_max_output_tokens present in FullSettingsResponse."""
    from app.api.settings import FullSettingsResponse
    import inspect
    fields = FullSettingsResponse.model_fields
    assert "sub_agent_max_output_tokens" in fields


def test_sub_agent_default_in_config():
    """config.py Settings class has sub_agent_max_output_tokens defaulting to 8192."""
    from app.config import settings
    assert hasattr(settings, "sub_agent_max_output_tokens")
    assert settings.sub_agent_max_output_tokens == 8192


# ---------------------------------------------------------------------------
# harness_judge_model settings knob (EVAL-05f / D-11 / D-12) — Phase 137.1-05
# ---------------------------------------------------------------------------

def test_judge_model_fields_in_settings_response():
    """FullSettingsResponse exposes both the raw + resolved shared judge model."""
    from app.api.settings import FullSettingsResponse
    fields = FullSettingsResponse.model_fields
    assert "harness_judge_model" in fields
    assert "resolved_harness_judge_model" in fields


def test_judge_model_field_in_settings_update():
    """SettingsUpdate accepts harness_judge_model (a model id, not a secret)."""
    from app.api.settings import SettingsUpdate
    assert "harness_judge_model" in SettingsUpdate.model_fields
    body = SettingsUpdate(harness_judge_model="claude-opus-4-8")
    assert body.harness_judge_model == "claude-opus-4-8"


async def test_build_response_wires_shared_judge_resolver(monkeypatch):
    """_build_response surfaces harness_judge_model (raw) + resolved_harness_judge_model
    computed by the SHARED resolve_judge_model (D-11) — unset surfaces the effective
    default (claude-opus-4-8), an explicit registry model surfaces verbatim."""
    import app.api.settings as sm

    # Patch the sibling resolvers so this test isolates the JUDGE wiring; the judge
    # resolver (validator_kinds.resolve_judge_model) is intentionally NOT patched — we
    # assert the real shared resolver's output flows through (the D-11 contract).
    monkeypatch.setattr(sm, "resolve_sub_agent_model", lambda s: "sub")
    monkeypatch.setattr(sm, "resolve_skill_builder_model", lambda s: "builder")

    # Unset → raw is "" and the resolved label is the effective default.
    resp = await sm._build_response(_fake_settings(harness_judge_model=""))
    assert resp.harness_judge_model == ""
    assert resp.resolved_harness_judge_model == "claude-opus-4-8"

    # Explicit registry model → both raw and resolved reflect it (no second resolver).
    resp2 = await sm._build_response(_fake_settings(harness_judge_model="claude-sonnet-5"))
    assert resp2.harness_judge_model == "claude-sonnet-5"
    assert resp2.resolved_harness_judge_model == "claude-sonnet-5"


async def test_build_response_survives_none_model_ids(monkeypatch):
    """REGRESSION (137.1-05): the config defaults for harness_judge_model AND
    skill_builder_model are None when unset (config.py:1006 / :1020), but the response
    contract types both as non-nullable `str` (settings.py:88 / :78). Passing the bare
    None raised a Pydantic ValidationError → GET /settings 500 → "failed to fetch" on the
    whole Settings page for every real (unset) user. The prior tests only ever passed "",
    masking it. _build_response must coerce None → "" (the documented unset sentinel)."""
    import app.api.settings as sm

    monkeypatch.setattr(sm, "resolve_sub_agent_model", lambda s: "sub")
    monkeypatch.setattr(sm, "resolve_skill_builder_model", lambda s: "builder")

    # BOTH unset as None (the real fresh-DB state) must build cleanly, not 500.
    resp = await sm._build_response(
        _fake_settings(harness_judge_model=None, skill_builder_model=None)
    )
    assert resp.harness_judge_model == ""
    assert resp.skill_builder_model == ""
    # The resolved label still surfaces the effective default (resolver reads None safely).
    assert resp.resolved_harness_judge_model == "claude-opus-4-8"


async def test_update_settings_rejects_unknown_judge_model(monkeypatch):
    """PUT with a NON-registry judge model 400s (D-12 registry validation) — before
    any persist (an unroutable/inferred model can never reach the shared judge setting)."""
    import app.api.settings as sm
    from fastapi import BackgroundTasks, HTTPException
    from unittest.mock import MagicMock

    async def _fake_save(updates):
        raise AssertionError("save must not be reached for an unknown judge model")

    async def _fake_load():
        return _fake_settings()

    async def _fake_build(s=None):
        return MagicMock()

    monkeypatch.setattr(sm, "save_app_settings", _fake_save)
    monkeypatch.setattr(sm, "load_app_settings_async", _fake_load)
    monkeypatch.setattr(sm, "_build_response", _fake_build)

    with pytest.raises(HTTPException) as exc:
        await sm.update_settings(
            body=sm.SettingsUpdate(harness_judge_model="totally-not-a-real-model-xyz-999"),
            background_tasks=BackgroundTasks(),
            current_user={"id": "u1"},
            supabase=MagicMock(),
        )
    assert exc.value.status_code == 400


async def test_update_settings_persists_registry_judge_model(monkeypatch):
    """PUT with a registry-known judge model persists it (D-12) — the update dict
    carries harness_judge_model verbatim."""
    import app.api.settings as sm
    from fastapi import BackgroundTasks
    from unittest.mock import MagicMock

    captured: dict = {}

    async def _fake_save(updates):
        captured.update(updates)

    async def _fake_load():
        return _fake_settings()

    async def _fake_build(s=None):
        return MagicMock()

    monkeypatch.setattr(sm, "save_app_settings", _fake_save)
    monkeypatch.setattr(sm, "load_app_settings_async", _fake_load)
    monkeypatch.setattr(sm, "_build_response", _fake_build)

    await sm.update_settings(
        body=sm.SettingsUpdate(harness_judge_model="claude-opus-4-8"),
        background_tasks=BackgroundTasks(),
        current_user={"id": "u1"},
        supabase=MagicMock(),
    )
    assert captured.get("harness_judge_model") == "claude-opus-4-8"
