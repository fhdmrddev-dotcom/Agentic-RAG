"""Phase 123 Plan 03 Task 1 (D-08 / TRIG-01) — the skill-builder model resolver.

``resolve_skill_builder_model(settings)`` mirrors ``resolve_authoring_model``
(``workflow_authoring.py:83``) verbatim, swapping the setting name +
default candidates. The resolution order is:

  1. ``settings.skill_builder_model`` if set -> returned VERBATIM (incl. a local
     model id like ``ollama/llama3.1`` — no paid-provider hardcoding, no SPOF).
  2. else the first registry default with ``forced_emission:True``.
  3. else ``None`` (honest — no SPOF, the caller emits an honest failure).

D-08: the builder model is configurable across the FULL provider list incl.
local; it is NOT pinned to a single paid provider (no single-point-of-failure).

CONVENTION (Phase 102/103 posture): imports INSIDE the test bodies.
"""

from __future__ import annotations

from types import SimpleNamespace


def test_explicit_setting_returned_verbatim():
    from app.services.skill_tuner_service import resolve_skill_builder_model

    settings = SimpleNamespace(skill_builder_model="claude-opus-4-8")
    assert resolve_skill_builder_model(settings) == "claude-opus-4-8", (
        "an explicit skill_builder_model setting must be returned verbatim"
    )


def test_local_model_id_accepted_verbatim_no_spof():
    """D-08: a local / self-hosted model id is a VALID setting — no paid-provider
    hardcoding. The resolver returns it verbatim, it does NOT 'correct' it to a
    cloud default."""
    from app.services.skill_tuner_service import resolve_skill_builder_model

    settings = SimpleNamespace(skill_builder_model="ollama/llama3.1")
    assert resolve_skill_builder_model(settings) == "ollama/llama3.1", (
        "a local/self-hosted model id must be accepted verbatim (no SPOF / no "
        "paid-provider hardcoding — D-08)"
    )


def test_unset_falls_back_to_strong_forced_emission_default():
    """Setting unset/empty -> the first candidate with forced_emission:True. Both
    default candidates (claude-haiku-4-5-20251001 / gpt-5.4-mini) are
    forced_emission:True in the registry, so a real id is resolved."""
    from app.config import get_model_capability
    from app.services.skill_tuner_service import resolve_skill_builder_model

    for unset in ("", None):
        settings = SimpleNamespace(skill_builder_model=unset)
        chosen = resolve_skill_builder_model(settings)
        assert chosen, "unset must resolve to a strong default, not None"
        cap = get_model_capability(chosen) or {}
        assert cap.get("forced_emission") is True, (
            f"the resolved default {chosen!r} must be forced_emission-capable"
        )


def test_missing_attribute_falls_back_to_default():
    """A settings object with NO skill_builder_model attribute (getattr default)
    must still resolve to a strong default, never raise."""
    from app.services.skill_tuner_service import resolve_skill_builder_model

    settings = SimpleNamespace()  # no skill_builder_model attribute at all
    chosen = resolve_skill_builder_model(settings)
    assert chosen, "a settings object missing the attr must fall back to a default"


def test_honest_none_when_no_candidate_forceable(monkeypatch):
    """Setting unset AND no candidate is forced-emission-capable -> None (honest).
    No SPOF: the resolver does NOT fabricate a model — it returns None and the
    caller surfaces an honest 'no builder model' failure."""
    import app.services.skill_tuner_service as svc

    # Force the function-local get_model_capability import to report every
    # candidate as NOT forced-emission-capable.
    import app.config as cfg

    monkeypatch.setattr(cfg, "get_model_capability", lambda _m: {"forced_emission": False})

    settings = SimpleNamespace(skill_builder_model=None)
    assert svc.resolve_skill_builder_model(settings) is None, (
        "no forceable candidate must resolve to an honest None (no SPOF, no fabrication)"
    )
