"""Phase 158 Plan 01 (SC#3 / D-01+D-02) — the store-wins-over-placeholder config overlay.

Wave-0 Nyquist scaffold. ``app.config`` already imports (MODIFIED module), so these are
HONEST REDs (assertion failures, not collection errors) until ``apply_setup_overlay`` lands
in Wave 1 — the not-yet-present symbol is guarded with ``getattr(config, "apply_setup_overlay",
None)`` + an explicit ``assert ... is not None`` so the file always COLLECTS clean.

Behaviors pinned (158-VALIDATION.md, SC#3/D-01/02):
  - the config load path exposes ``apply_setup_overlay(settings)`` (the two-tier merge);
  - for the enumerated INFRA keys the overlay is STORE-WINS-over-env — because the onebox
    preset ships ``supabase_url=https://<project-ref>.supabase.co`` (a set-BUT-placeholder
    env), env-wins would shadow the wizard's real value (RESEARCH Pattern 1);
  - the overlay touches ONLY the infra tier — app-level keys (provider keys, operator_emails,
    model pins) are NEVER sourced from the store (they live in app_settings, D-01).

The overlay reads the throwaway ``setup_store_path`` store; no real infra values are used.
"""
from types import SimpleNamespace

import app.config as config_mod

_PLACEHOLDER_URL = "https://<project-ref>.supabase.co"  # onebox ships this — a set env
_REAL_URL = "https://real-project.supabase.co"


def test_apply_setup_overlay_exists():
    """SC#3/D-01: the config load path exposes ``apply_setup_overlay`` (the point where the
    infra tier from /data/setup.json merges into the running Settings). RED until Wave 1."""
    fn = getattr(config_mod, "apply_setup_overlay", None)
    assert fn is not None, (
        "RED until Wave 1: app.config.apply_setup_overlay(settings) must exist "
        "(the thin store→env overlay wrapper — RESEARCH Component Responsibilities)"
    )


def test_store_overrides_placeholder_infra_key(setup_store_path):
    """SC#3/D-01 (STORE-WINS polarity): a store value OVERRIDES a placeholder env infra key.
    The onebox ``supabase_url`` placeholder is a set env var; env-wins would shadow the
    wizard's real URL, so the overlay MUST be store-wins for the enumerated infra keys."""
    fn = getattr(config_mod, "apply_setup_overlay", None)
    assert fn is not None, "RED until Wave 1: apply_setup_overlay"

    from app.services.setup_store import write_store
    write_store({"supabase_url": _REAL_URL})

    settings = SimpleNamespace(supabase_url=_PLACEHOLDER_URL, llm_api_key="env-app-tier")
    fn(settings)
    assert settings.supabase_url == _REAL_URL, "store value must WIN over the placeholder env"


def test_app_level_key_never_overridden(setup_store_path):
    """SC#3/D-01: the overlay is INFRA-TIER-ONLY — an app-level key that somehow appears in
    the store must NOT be applied to Settings (app-level config lives in app_settings, never
    the setup-store; a stray store key must not leak into the app tier)."""
    fn = getattr(config_mod, "apply_setup_overlay", None)
    assert fn is not None, "RED until Wave 1: apply_setup_overlay"

    from app.services.setup_store import write_store
    write_store({"llm_api_key": "STORE-SHOULD-NOT-WIN", "supabase_url": _REAL_URL})

    settings = SimpleNamespace(supabase_url=_PLACEHOLDER_URL, llm_api_key="env-app-tier")
    fn(settings)
    assert settings.llm_api_key == "env-app-tier", "app-level key must NOT be overridden by the store"
