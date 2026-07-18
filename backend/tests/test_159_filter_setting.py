"""Phase 159 Plan 03 (MODEL-03 / D-159-04 persistence half) — the app_settings readback chain.

Plan 02 wired the WRITE path (``model_discovery_filter_enabled`` in ``_FLAG_HUMAN_NAMES`` →
``PUT /admin/flags`` — proven by test_159_filter_flag.py). This plan wires the READBACK: a
persisted, operator-governed, default-ON ``app_settings`` knob that survives sessions +
WORKER_COUNT=2 via the existing 30s TTL settings cache, surfaced on ``GET /settings``.

The load-bearing proof is FAIL-SOFT (T-159-07): the code ships AHEAD of the operator-applied
migration 103, so a settings row where the column is ABSENT must return the safe default ``True``
and NEVER raise. These are pure unit tests over ``_build_settings_from_row`` (the shared sync/async
construction seam) — no live DB, exactly what ``load_app_settings()`` does on a cold cache — plus
the ``_DIRECT_COLUMNS`` legacy-migration-allowlist membership check.
"""
from app.models.user_settings import _build_settings_from_row

_KEY = "model_discovery_filter_enabled"


def test_absent_column_defaults_true():
    """Fail-soft (SC#1 / T-159-07): with the column ABSENT (empty row, migration not yet applied),
    building settings returns model_discovery_filter_enabled=True and raises no exception."""
    s = _build_settings_from_row({})
    assert s.model_discovery_filter_enabled is True


def test_none_value_defaults_true():
    """An explicit NULL column value (DB NULL → None) also falls through to the True default —
    _val_bool treats None as "unset" (the discovery filter defaults ON, never silently OFF)."""
    s = _build_settings_from_row({_KEY: None})
    assert s.model_discovery_filter_enabled is True


def test_db_false_is_preserved():
    """A real stored False (operator turned the filter OFF) is READ BACK as False — proving the
    readback actually reads the column, not a hardcoded True."""
    s = _build_settings_from_row({_KEY: False})
    assert s.model_discovery_filter_enabled is False


def test_db_true_is_preserved():
    """A real stored True is read back as True (the persisted default-ON round-trips)."""
    s = _build_settings_from_row({_KEY: True})
    assert s.model_discovery_filter_enabled is True


def test_key_in_direct_columns_allowlist():
    """The column joins main._DIRECT_COLUMNS — the code-constant allowlist for the legacy
    settings_override.json→DB migration path (documentation-completeness, mirroring the mig
    097/099 flag columns). The write-path SQLi safety is independently _FLAG_KEYS +
    _VALID_COLUMN_NAME, not this membership."""
    import app.main as main_mod

    assert _KEY in main_mod._DIRECT_COLUMNS
