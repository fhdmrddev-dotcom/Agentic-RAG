"""Phase 149 Plan 05 (MODEL-01 / D-149-08) — `enabled` becomes REAL for the picker.

`_build_providers` must hide any model whose override has ``enabled=false`` from BOTH
unfiltered merge branches:
  1. the static-registry merge (config.MODEL_CAPABILITIES) — a disabled built-in model
     (e.g. gpt-4o) must not surface;
  2. the legacy ``db_model_lists`` / env-CSV branch (app_settings.provider_model_lists
     JSONB) — a disabled model listed there for a legacy-migrated account must not leak
     back in.
An enabled / absent-override model still lists.

`_build_providers` is sync and reads the module-level all-rows cache
(``_all_model_overrides_cache``) that the async caller warms; the tests set that global
directly (no pool needed) plus an empty hot cache, then assert the built provider list.
"""
import app.models.user_settings as us
from app.models.user_settings import _build_providers


def test_disabled_static_registry_model_hidden(monkeypatch):
    """A disabled built-in model (gpt-4o, from MODEL_CAPABILITIES) is dropped from the
    static-registry merge; sibling enabled built-ins still list."""
    monkeypatch.setattr(us, "_all_model_overrides_cache", {
        "gpt-4o": {"model_id": "gpt-4o", "provider": "openai", "enabled": False},
    })
    monkeypatch.setattr(us, "_model_overrides_cache", {})

    providers = _build_providers({"llm_provider": "openai"})
    openai = next(p for p in providers if p.id == "openai")

    assert "gpt-4o" not in openai.models, "a disabled static-registry model must be hidden"
    assert any(m.startswith("gpt-") for m in openai.models), (
        "enabled sibling static models must still list (only the disabled one is hidden)"
    )


def test_disabled_legacy_db_model_lists_model_hidden(monkeypatch):
    """A disabled model that surfaced ONLY via the legacy provider_model_lists JSONB
    branch is also hidden; an enabled sibling in the same list still lists."""
    monkeypatch.setattr(us, "_all_model_overrides_cache", {
        "legacy-disabled": {"model_id": "legacy-disabled", "provider": "openai", "enabled": False},
    })
    monkeypatch.setattr(us, "_model_overrides_cache", {})

    row = {
        "llm_provider": "openai",
        # app_settings.provider_model_lists JSONB — the legacy-migrated account's list.
        "provider_model_lists": {"openai": ["legacy-disabled", "legacy-enabled"]},
    }
    providers = _build_providers(row)
    openai = next(p for p in providers if p.id == "openai")

    assert "legacy-disabled" not in openai.models, (
        "a disabled model must be hidden even when it surfaced via the legacy db_model_lists branch"
    )
    assert "legacy-enabled" in openai.models, "an enabled legacy-listed model still lists"


def test_absent_override_model_still_lists(monkeypatch):
    """A model with NO override row is untouched — the filter only hides rows that are
    present-and-disabled, never absent-override models."""
    monkeypatch.setattr(us, "_all_model_overrides_cache", {})
    monkeypatch.setattr(us, "_model_overrides_cache", {})

    providers = _build_providers({"llm_provider": "openai"})
    openai = next(p for p in providers if p.id == "openai")
    # gpt-4o has no override here → it stays listed (the picker is unchanged when nothing
    # is disabled).
    assert "gpt-4o" in openai.models
