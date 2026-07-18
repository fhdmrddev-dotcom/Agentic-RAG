"""Phase 148 Wave 0 (VIS-01 / T-148-05) — RED scaffold for cold-read audience polarity.

Encodes the D-06 per-feature cold-read default that 148-02 (wave 2) builds as
``feature_audience`` in ``app.models.user_settings``:

  - on a cold cache / DB blip / missing key, each feature resolves to its HARDCODED
    default — DENY for skill_studio + model_management (audience "operators"), ALLOW for
    workflow_authoring + governance_health (audience "everyone");
  - a stored enum record {"audience": ...} is honored when present;
  - the resolver NEVER reads or returns a boolean and NEVER raises (fail-safe to default).

The polarity lives in exactly one place (``_GOVERNED_FEATURES``); a restart briefly exposing
an operators-only feature (fail-open) is the exact bug this pins.

RED-by-design: ``feature_audience`` does not exist yet; imported inside the body so
collection succeeds. Turns GREEN in wave 2. Owner: 148-02.
"""
from types import SimpleNamespace


def test_cold_read_falls_to_per_feature_default(monkeypatch):
    """DB-unreachable (load_app_settings raises) -> per-feature hardcoded default (D-06)."""
    from app.models import user_settings as us  # module exists; feature_audience — RED until 148-02

    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")

    monkeypatch.setattr(us, "load_app_settings", _boom)

    assert us.feature_audience("skill_studio") == "operators", "cold read DENIES skill_studio"
    assert us.feature_audience("model_management") == "operators", "cold read DENIES model_management"
    assert us.feature_audience("workflow_authoring") == "everyone", "cold read ALLOWS workflow_authoring"
    assert us.feature_audience("governance_health") == "everyone", "cold read ALLOWS governance_health"


def test_unknown_feature_safe_denies(monkeypatch):
    """An unknown feature key resolves to the safe-deny default ('operators')."""
    from app.models import user_settings as us  # RED until 148-02

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))
    assert us.feature_audience("not_a_real_feature") == "operators"


def test_stored_enum_record_is_honored(monkeypatch):
    """A stored {"audience": "everyone"} record overrides the operators-only default."""
    from app.models import user_settings as us  # RED until 148-02

    stored = SimpleNamespace(feature_visibility={"skill_studio": {"audience": "everyone"}})
    monkeypatch.setattr(us, "load_app_settings", lambda: stored)
    assert us.feature_audience("skill_studio") == "everyone"
