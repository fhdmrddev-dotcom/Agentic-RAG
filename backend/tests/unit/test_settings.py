"""Unit tests for settings API models — CTX-03."""
from __future__ import annotations
import pytest


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
