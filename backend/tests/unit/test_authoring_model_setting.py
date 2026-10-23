"""The workflow-drafting model is a Settings control, not env-only (operator direction 2026-10-23).

Found at 291 UAT S1: the drafting model resolved only from ``HARNESS_AUTHORING_MODEL``, so moving
off a provider with no credit needed an ``.env`` edit and a backend restart. It now lives in
``app_settings.harness_authoring_model`` (migration 212) exactly as the judge model does (086).

Precedence, pinned here: the Settings value → ``HARNESS_AUTHORING_MODEL`` → the registry
defaults. A save accepts only a registry model that supports forced emission, because drafting
IS one forced emission and any other model can never return a draft.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.config as config_mod
import app.models.user_settings as us


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    us._settings_cache = None
    us._settings_cache_time = 0.0
    yield
    us._settings_cache = None
    us._settings_cache_time = 0.0


# ── the resolver ──────────────────────────────────────────────────────────────────────────


def test_the_settings_value_wins_over_the_env_value(monkeypatch):
    from app.services.workflow_authoring import resolve_authoring_model

    monkeypatch.setattr(config_mod.settings, "harness_authoring_model", "gpt-5.5")
    assert resolve_authoring_model(SimpleNamespace(harness_authoring_model="deepseek-v4-pro")) == "deepseek-v4-pro"


def test_an_unset_settings_value_falls_back_to_the_env_value(monkeypatch):
    from app.services.workflow_authoring import resolve_authoring_model

    monkeypatch.setattr(config_mod.settings, "harness_authoring_model", "gpt-5.5")
    assert resolve_authoring_model(SimpleNamespace(harness_authoring_model="")) == "gpt-5.5"


def test_nothing_set_falls_back_to_the_registry_default(monkeypatch):
    from app.services.workflow_authoring import resolve_authoring_model

    monkeypatch.setattr(config_mod.settings, "harness_authoring_model", None)
    assert resolve_authoring_model(SimpleNamespace(harness_authoring_model="")) == "claude-opus-4-8"


@pytest.mark.asyncio
async def test_the_effective_settings_carry_the_app_settings_column(monkeypatch):
    async def _row():
        return {"harness_authoring_model": "gpt-5.5"}

    async def _overrides():
        return {}

    monkeypatch.setattr(us, "_load_settings_from_db", _row)
    monkeypatch.setattr(us, "load_all_model_overrides", _overrides)
    eff = await us.load_app_settings_async()
    assert eff.harness_authoring_model == "gpt-5.5"


@pytest.mark.asyncio
async def test_a_missing_column_reads_as_unset(monkeypatch):
    # Cloud before migration 212 is applied: the row has no such key.
    async def _row():
        return {}

    async def _overrides():
        return {}

    monkeypatch.setattr(us, "_load_settings_from_db", _row)
    monkeypatch.setattr(us, "load_all_model_overrides", _overrides)
    assert (await us.load_app_settings_async()).harness_authoring_model == ""


# ── generate reads the OWNER's effective settings ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_drafts_on_the_settings_model_not_the_env_model(monkeypatch):
    import app.services.workflow_authoring as wa

    monkeypatch.setattr(config_mod.settings, "harness_authoring_model", "claude-opus-4-8")
    monkeypatch.setattr(us, "load_user_settings", lambda _uid: SimpleNamespace(
        harness_authoring_model="gpt-5.5", active_provider="openai"))
    seen: dict = {}

    async def _stop(**kwargs):
        seen.update(kwargs)
        return ("G", set(), set())

    monkeypatch.setattr(wa, "_assemble_grounding", _stop)

    async def _fake_forced_emit(**kwargs):
        seen["model"] = kwargs.get("model")
        return {"emitted": None, "failure": "validation_failed"}

    import app.services.forced_emit as fe
    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)
    await wa.generate_workflow_definition(describe="x", supabase=object(), user_id="u1",
                                          settings=config_mod.settings)
    assert seen.get("model") == "gpt-5.5"


# ── the settings API ──────────────────────────────────────────────────────────────────────


def test_settings_contract_exposes_raw_and_resolved_authoring_model():
    from app.api.settings import FullSettingsResponse, SettingsUpdate

    assert {"harness_authoring_model", "resolved_harness_authoring_model",
            "authoring_model_options"} <= set(FullSettingsResponse.model_fields)
    assert "harness_authoring_model" in SettingsUpdate.model_fields


def test_authoring_model_options_are_registry_models_that_force_an_emission():
    from app.api.settings import authoring_model_options

    opts = authoring_model_options()
    assert "gpt-5.5" in opts and "claude-opus-4-8" in opts
    for m in opts:
        assert config_mod.get_model_capability(m).get("forced_emission")


@pytest.mark.parametrize("bad", ["not-a-model-xyz"])
def test_a_save_refuses_a_model_that_cannot_draft(bad):
    from app.api.settings import validate_authoring_model

    with pytest.raises(HTTPException) as exc:
        validate_authoring_model(bad)
    assert exc.value.status_code == 400


def test_a_save_accepts_a_forceable_registry_model_and_the_empty_reset():
    from app.api.settings import validate_authoring_model

    assert validate_authoring_model("gpt-5.5") == "gpt-5.5"
    assert validate_authoring_model("") == ""
