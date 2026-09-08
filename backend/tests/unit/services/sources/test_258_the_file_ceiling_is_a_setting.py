"""SEED-258 — the source file ceiling is an operator SETTING, not a hardcoded constant.

⚠ WHY THIS EXISTS. Phase 239 found two constants that disagreed in shipped code:
`mcp_source.MAX_FILE_BYTES` said 25 MB while `mcp_client.MAX_MCP_BODY_BYTES` said 2 MB and
applied to the WHOLE JSON-RPC envelope — which carries file content INSIDE it, base64
inflated 4/3. The real ceiling was ~1.5 MB and the 25 MB one COULD NEVER FIRE.

**Both numbers were individually defensible. The RELATION between them was wrong, and a
relation has no home in a file of constants.** This file pins the accessor that replaces the
constants: ONE knob, read from `app_settings`, bounded, and never able to crash a source read.

⛔ The knob lives in `app_settings` (global singleton, RLS disabled), NOT `user_settings`.
   A DoS guard a user can raise for themselves is not a guard. That home is asserted in
   `test_258_the_ceiling_is_operator_scope.py`.
"""

from types import SimpleNamespace

import pytest

import app.models.user_settings as us

MB = 1024 * 1024


@pytest.fixture
def stored(monkeypatch):
    """Seed a specific `app_settings` value for the ceiling."""

    def _set(value):
        monkeypatch.setattr(
            us, "load_app_settings", lambda: SimpleNamespace(source_max_file_size_mb=value)
        )

    return _set


@pytest.fixture
def settings_read_fails(monkeypatch):
    """The other route to "nothing usable": the settings read itself raises.

    ⚠ A SOURCE READ MUST NEVER CRASH BECAUSE A SETTINGS READ FAILED — the same reasoning
    that makes `tool_args_progress_emit_boundary_bytes()` swallow everything on the streaming
    hot path. A cold cache mid-sync must not turn every connected source into an error.
    """

    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")

    monkeypatch.setattr(us, "load_app_settings", _boom)


# ── the knob itself ───────────────────────────────────────────────────────────────────────


def test_the_configured_value_is_what_the_adapters_get(stored):
    stored(40)
    assert us.source_max_file_bytes() == 40 * MB


def test_the_shipped_default_is_the_value_phase_239_shipped(stored):
    """⭐ 25 MB is unchanged. This phase moves the number's HOME, never the number."""
    stored(None)
    assert us.source_max_file_bytes() == 25 * MB
    assert us.SOURCE_MAX_FILE_SIZE_MB_DEFAULT == 25


# ── never raise ───────────────────────────────────────────────────────────────────────────


def test_a_failed_settings_read_falls_back_instead_of_raising(settings_read_fails):
    assert us.source_max_file_bytes() == 25 * MB


# ── bounds are enforced at the READ too, not only at the write ────────────────────────────


def test_a_stored_value_above_the_hard_maximum_is_clamped_down(stored):
    """⛔ THE GUARD MUST NEVER BE EXCEEDABLE. The API refuses an out-of-range PATCH, but a row
    written before the bound existed — or by hand in the SQL editor — must not widen the
    memory a single in-flight request can buffer. Defence in depth: the write refuses AND the
    read clamps."""
    stored(999_999)
    assert us.source_max_file_bytes() == us.SOURCE_MAX_FILE_SIZE_MB_CEILING * MB


def test_a_stored_zero_does_not_silently_disable_every_connected_source(stored):
    """A ceiling of 0 refuses every file while every sync still reports success — the exact
    silent failure `multimodal_max_vision_calls` is bounded against (SEED-227). Non-positive
    reads as "nothing usable" and lands on the fallback, never on 0."""
    stored(0)
    assert us.source_max_file_bytes() == 25 * MB


def test_a_stored_negative_lands_on_the_fallback_too(stored):
    stored(-5)
    assert us.source_max_file_bytes() == 25 * MB


def test_the_bounds_are_named_and_orderly():
    """The floor, the default and the hard maximum are three named numbers with an order.

    ⚠ The hard maximum is 50 MB because that is `documents.py`'s OWN manual-upload ceiling —
    a connected source may never admit a file the app would refuse from a person's disk.
    """
    assert us.SOURCE_MAX_FILE_SIZE_MB_FLOOR == 1
    assert us.SOURCE_MAX_FILE_SIZE_MB_DEFAULT == 25
    assert us.SOURCE_MAX_FILE_SIZE_MB_CEILING == 50
    assert (
        us.SOURCE_MAX_FILE_SIZE_MB_FLOOR
        <= us.SOURCE_MAX_FILE_SIZE_MB_DEFAULT
        <= us.SOURCE_MAX_FILE_SIZE_MB_CEILING
    )


def test_the_hard_maximum_does_not_exceed_the_apps_own_upload_ceiling():
    """⭐ THE RELATION THIS SEED IS ABOUT, ONE LEVEL UP. `google_drive.py` claimed for its whole
    life that 25 MB "match[ed] application upload ceiling" — measured 2026-09-08, that ceiling
    is 50 MB (`app/api/documents.py`), so the comment was false and nothing could tell anyone.
    Pin the relation instead of restating it in a comment."""
    import inspect

    import app.api.documents as documents_api

    src = inspect.getsource(documents_api)
    assert "MAX_FILE_SIZE = 50 * 1024 * 1024" in src, (
        "the manual-upload ceiling moved; SOURCE_MAX_FILE_SIZE_MB_CEILING was chosen to equal "
        "it, so the two must be re-reconciled rather than left to drift apart in silence"
    )
    assert us.SOURCE_MAX_FILE_SIZE_MB_CEILING * MB <= 50 * 1024 * 1024
