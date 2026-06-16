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


def test_buckets_read_back_with_defaults_without_db():
    """SCHEMA layer — GREEN (Task 3 added the two fields; D-12)."""
    from app.models.user_settings import _build_settings_from_row

    s = _build_settings_from_row({})
    assert s.confidence_bucket_high == 0.54, "default confidence_bucket_high is 0.54"
    assert s.confidence_bucket_medium == 0.38, "default confidence_bucket_medium is 0.38"


def test_settings_update_has_bucket_fields():
    """SCHEMA layer — GREEN (Task 3 added the two fields to SettingsUpdate; D-12)."""
    from app.api.settings import SettingsUpdate

    assert "confidence_bucket_high" in SettingsUpdate.model_fields
    assert "confidence_bucket_medium" in SettingsUpdate.model_fields


def test_incoherent_bucket_order_rejected():
    """SCHEMA layer — GREEN (Task 3): medium > high is incoherent and must 422 (V5)."""
    from fastapi import HTTPException

    from app.api.settings import _validate_confidence_buckets

    with pytest.raises(HTTPException) as exc:
        _validate_confidence_buckets(high=0.5, medium=0.9)
    assert exc.value.status_code == 422
    # Out-of-range is also rejected.
    with pytest.raises(HTTPException):
        _validate_confidence_buckets(high=1.5, medium=0.4)
    # A coherent in-range pair passes (no raise).
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
