"""Phase 111.1 Wave-0 — confidence buckets read from settings (D-11/D-12).

Two layers:

  1. SCHEMA (flips GREEN in THIS plan's Task 3): `confidence_bucket_high` /
     `confidence_bucket_medium` read back through `_build_settings_from_row` with
     the 0.54 / 0.38 defaults (env_attr=None app-config), AND the settings API
     rejects an incoherent bucket order (medium > high) with a 422 (V5).

  2. CONSUMPTION (stays xfail until Plan 03): `_compute_confidence` reads the
     buckets from settings instead of the hardcoded 0.54/0.38 literals.

RED convention: not-yet-built symbols imported inside the body; xfail(strict=False).
"""

import pytest


@pytest.mark.xfail(
    reason="confidence buckets added to UserEffectiveSettings in Task 3 of this plan (D-12)",
    strict=False,
)
def test_buckets_read_back_with_defaults_without_db():
    """SCHEMA layer — flips GREEN once Task 3 adds the two fields (D-12).

    Un-marked (xfail removed) by Task 3 of this plan once the fields land.
    """
    from app.models.user_settings import _build_settings_from_row

    s = _build_settings_from_row({})
    assert s.confidence_bucket_high == 0.54, "default confidence_bucket_high is 0.54"
    assert s.confidence_bucket_medium == 0.38, "default confidence_bucket_medium is 0.38"


@pytest.mark.xfail(
    reason="confidence buckets added to SettingsUpdate in Task 3 of this plan (D-12)",
    strict=False,
)
def test_settings_update_has_bucket_fields():
    """SCHEMA layer — SettingsUpdate carries the two bucket fields after Task 3.

    Un-marked (xfail removed) by Task 3 of this plan once the fields land.
    """
    from app.api.settings import SettingsUpdate

    assert "confidence_bucket_high" in SettingsUpdate.model_fields
    assert "confidence_bucket_medium" in SettingsUpdate.model_fields


@pytest.mark.xfail(
    reason="bucket-order validation lands in Task 3 of this plan (V5)",
    strict=False,
)
def test_incoherent_bucket_order_rejected():
    """SCHEMA layer — medium > high is incoherent and must 422 (V5).

    Pure-Python guard: the validation helper rejects medium > high. Kept xfail
    until Task 3 wires the clamp/order check so the suite stays green during RED.
    """
    from app.api.settings import _validate_confidence_buckets

    with pytest.raises(Exception):
        _validate_confidence_buckets(high=0.5, medium=0.9)
    # A coherent pair passes.
    _validate_confidence_buckets(high=0.6, medium=0.4)


@pytest.mark.xfail(
    reason="_compute_confidence reads buckets from settings in Plan 03 (D-12)",
    strict=False,
)
def test_compute_confidence_reads_buckets_from_settings():
    """CONSUMPTION layer — Plan 03. Lower the high bucket and a mid score reads 'high'."""
    from app.services.agent_loop import _compute_confidence

    # With a high bucket of 0.30, a 0.40 similarity should grade 'high' (not 'medium').
    grade = _compute_confidence(0.40, bucket_high=0.30, bucket_medium=0.20)
    assert grade == "high", "compute_confidence must honor settings-driven buckets, not 0.54/0.38"
