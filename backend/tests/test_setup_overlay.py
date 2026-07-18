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


def test_needs_setup_false_when_url_real(setup_store_path):
    """SC#3/D-05 (static, blip-proof entry check): a REAL ``supabase_url`` ⇒ ``needs_setup``
    False even WITHOUT a finalize marker — a hand-filled 157-style box must NOT show the
    wizard. The check is a pure string test (no live DB probe), so a transient DB blip can
    never re-trigger the wizard on a configured box (Pitfall 1)."""
    fn = getattr(config_mod, "needs_setup", None)
    assert fn is not None, "RED until Wave 1: app.config.needs_setup(settings) (the static entry check)"

    settings = SimpleNamespace(supabase_url=_REAL_URL)
    assert fn(settings) is False, "a real supabase_url ⇒ not a placeholder ⇒ needs_setup False"


# ── CR-01: the overlay must not setattr an undeclared Settings field (crash-loop on finalize) ──

def test_all_infra_keys_are_declared_settings_fields():
    """CR-01 / IN-05 (defense-in-depth): EVERY ``setup_store.INFRA_KEY`` must be a declared
    ``Settings`` field, so the overlay's ``setattr`` can never raise Pydantic v2's
    undeclared-field ``ValueError`` at import — the exact crash that bricked a wizard-finalized
    box on its first restart. This is the cross-check the drift-check gap (IN-05) missed; pinning
    it here trips a test if a future INFRA_KEY is added without a matching field."""
    from app.services.setup_store import INFRA_KEYS

    declared = set(config_mod.Settings.model_fields)
    missing = [k for k in INFRA_KEYS if k not in declared]
    assert not missing, f"INFRA_KEYS not declared as Settings fields (CR-01 crash risk): {missing}"


def test_overlay_applies_supabase_anon_without_crashing(setup_store_path):
    """CR-01 (proven crash): a store carrying ALL infra keys — including the three formerly
    UNDECLARED Supabase keys (anon/publishable/secret) — overlays onto a REAL pydantic
    ``Settings`` cleanly and applies them. Before the fix, ``setattr(settings, 'supabase_anon_key',
    ...)`` raised ``ValueError`` at import, crash-looping the box after finalize."""
    from app.services.setup_store import INFRA_KEYS, write_store

    write_store({k: f"real-{k}" for k in INFRA_KEYS})
    s = config_mod.Settings()  # a REAL env-backed Settings — the CR-01 crash target
    config_mod.apply_setup_overlay(s)  # must NOT raise
    assert s.supabase_anon_key == "real-supabase_anon_key"
    assert s.supabase_publishable_key == "real-supabase_publishable_key"
    assert s.supabase_secret_key == "real-supabase_secret_key"


def test_overlay_never_crashes_on_undeclared_infra_key(setup_store_path, monkeypatch):
    """CR-01 belt-and-suspenders: even if a FUTURE ``INFRA_KEY`` is added WITHOUT a matching
    ``Settings`` field, the overlay SKIPS it (the ``hasattr`` guard) rather than raising
    Pydantic's undeclared-field ``ValueError`` at import (which crash-loops the box)."""
    import app.services.setup_store as store_mod
    from app.services.setup_store import write_store

    # apply_setup_overlay does `from app.services.setup_store import INFRA_KEYS` per call, so
    # patching the module attribute is picked up at call time.
    monkeypatch.setattr(
        store_mod, "INFRA_KEYS", store_mod.INFRA_KEYS + ("a_field_that_does_not_exist",)
    )
    write_store({"a_field_that_does_not_exist": "boom", "supabase_url": _REAL_URL})
    s = config_mod.Settings()
    config_mod.apply_setup_overlay(s)  # must NOT raise despite the bogus key
    assert s.supabase_url == _REAL_URL
    assert not hasattr(s, "a_field_that_does_not_exist")


async def test_public_config_returns_real_anon_key(monkeypatch):
    """CR-01 (second face): with ``supabase_anon_key`` now a declared field, ``/public-config``
    returns the REAL anon key (not "") so the browser's Supabase client can bind — the D-07
    no-rebuild login path. Before the fix the field was absent → ``getattr`` default "" → the
    browser never received the key and login was dead."""
    import app.api.setup as setup_api

    monkeypatch.setattr(config_mod.settings, "supabase_anon_key", "real-anon-key-xyz", raising=False)
    monkeypatch.setattr(config_mod.settings, "supabase_url", _REAL_URL, raising=False)
    result = await setup_api.public_config()
    assert result["supabase_anon_key"] == "real-anon-key-xyz"
    assert result["supabase_url"] == _REAL_URL
