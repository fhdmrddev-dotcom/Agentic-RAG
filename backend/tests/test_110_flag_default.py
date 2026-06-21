"""Phase 110 SC#5 (default-on) — defensive flag helper returns True on failure.

Unit test (no live DB). Forces ``load_app_settings()`` to raise (monkeypatch)
and asserts the defensive ``document_management_enabled()`` wrapper returns
True. F8 polarity trap: a settings-read failure must NOT hide DM surfaces — the
helper defaults ON, never OFF. Mirrors the
``tool_args_progress_emit_boundary_bytes()`` defensive-default test shape.
"""

import pytest


def test_flag_helper_defaults_on_when_load_raises(monkeypatch):
    """Forced load_app_settings exception → helper returns True (default-ON)."""
    monkeypatch.setattr(
        "app.models.user_settings.load_app_settings",
        lambda: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    from app.models.user_settings import document_management_enabled
    assert document_management_enabled() is True


def test_flag_helper_returns_true_by_default(monkeypatch):
    """A cold cache (empty row → _val_bool default True) surfaces True."""
    # No exception this time; load_app_settings reads the cold cache → default True.
    from app.models.user_settings import document_management_enabled
    assert document_management_enabled() is True
