"""Plan 075.4-04 Task 2 — save_override sentinel allowlist guard (D-075.4-F1 + F2).

Closes WR-02 (Phase 075.3 orchestrator data-loss footgun): when a masked-value
PATCH/PUT body reaches save_override with `api_key="***"` or other sentinel
shapes, the existing KEY_PLACEHOLDER skip handles the canonical "***" but does
not catch:

  - empty / whitespace strings (would clobber valid stored key with "")
  - sentinel variants like "__KEEP__" / "••••••"
  - wrong-provider prefixed strings (e.g., openrouter key submitted to openai field)

Mitigation: allowlist-by-provider-prefix wrapping the existing skip. Rejected
writes log WARNING and skip silently (no HTTP 422 — that escalation is Phase
081.1 territory per D-075.4-F2).

Forward-ref: Phase 081.1 (Settings Architecture Unification) replaces
save_override entirely (FORWARD-REF #4 + #5) — port the _is_valid_api_key
allowlist logic forward.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pytest


# ── Unit tests for _is_valid_api_key (pure function) ──────────────────────────


def test_is_valid_api_key_openai_real_key_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "sk-realkey123abc") is True


def test_is_valid_api_key_rejects_canonical_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "***") is False


def test_is_valid_api_key_rejects_keep_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "__KEEP__") is False


def test_is_valid_api_key_rejects_dot_mask_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "••••••") is False


def test_is_valid_api_key_rejects_empty_string() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "") is False


def test_is_valid_api_key_rejects_whitespace() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openai_api_key", "   ") is False


def test_is_valid_api_key_rejects_wrong_provider_prefix() -> None:
    from app.models.user_settings import _is_valid_api_key

    # openai_api_key requires sk- prefix — "claude-key-no-prefix" fails
    assert _is_valid_api_key("openai_api_key", "claude-key-no-prefix") is False


def test_is_valid_api_key_anthropic_valid_prefix_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("anthropic_api_key", "sk-ant-validkey") is True


def test_is_valid_api_key_openrouter_valid_prefix_returns_true() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("openrouter_api_key", "sk-or-validkey") is True


def test_is_valid_api_key_google_length_check_passes() -> None:
    from app.models.user_settings import _is_valid_api_key

    # google_api_key: length-only minimum (>=30 chars)
    assert _is_valid_api_key("google_api_key", "x" * 35) is True


def test_is_valid_api_key_google_too_short_fails() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("google_api_key", "tooshort") is False


def test_is_valid_api_key_ollama_any_non_sentinel_passes() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("ollama_api_key", "anything-non-sentinel") is True


def test_is_valid_api_key_ollama_still_rejects_sentinel() -> None:
    from app.models.user_settings import _is_valid_api_key

    assert _is_valid_api_key("ollama_api_key", "***") is False


def test_is_valid_api_key_non_api_key_field_passes_through() -> None:
    from app.models.user_settings import _is_valid_api_key

    # Non-api-key fields fall through unchanged (the guard in save_override
    # only invokes _is_valid_api_key when k.endswith("_api_key")).
    # The helper itself returns True for unknown keys with non-sentinel values
    # to make the unit-test contract explicit.
    assert _is_valid_api_key("not_an_api_key_field", "anything") is True


# ── Integration tests for save_override (writes to tmp_path) ──────────────────


@pytest.fixture
def isolated_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect _OVERRIDE_FILE to a per-test temp path and reset cache."""
    target = tmp_path / "settings_override.json"
    # Seed with a real key so we can assert "no clobber" on sentinel-rejected writes.
    target.write_text(
        json.dumps({"openai_api_key": "sk-existing-real-key"}, indent=2),
        encoding="utf-8",
    )
    import app.models.user_settings as us

    monkeypatch.setattr(us, "_OVERRIDE_FILE", target)
    # Force cache invalidation so the next _load_override() reads fresh.
    monkeypatch.setattr(us, "_override_cache_time", 0.0)
    monkeypatch.setattr(us, "_override_cache", {})
    return target


def _read_override(p: Path) -> dict[str, Any]:
    return json.loads(p.read_text(encoding="utf-8"))


def test_save_override_rejects_sentinel_and_does_not_clobber(
    isolated_override: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.models.user_settings import save_override

    with caplog.at_level(logging.WARNING, logger="app.models.user_settings"):
        save_override({"openai_api_key": "***"})

    # The pre-existing real key MUST remain — sentinel was skipped.
    after = _read_override(isolated_override)
    assert after.get("openai_api_key") == "sk-existing-real-key"
    # KEY_PLACEHOLDER "***" hits the OLDER `if v == KEY_PLACEHOLDER: continue`
    # guard — it bypasses the new allowlist layer entirely (the test simply
    # confirms the file is untouched). No WARNING expected on this path.
    # (See next test for the WARNING-firing path.)


def test_save_override_persists_valid_new_key(isolated_override: Path) -> None:
    from app.models.user_settings import save_override

    save_override({"openai_api_key": "sk-newkey-valid"})

    after = _read_override(isolated_override)
    assert after.get("openai_api_key") == "sk-newkey-valid"


def test_save_override_rejects_wrong_prefix_and_logs_warning(
    isolated_override: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.models.user_settings import save_override

    with caplog.at_level(logging.WARNING, logger="app.models.user_settings"):
        save_override({"openai_api_key": "claude-wrong-prefix"})

    # Existing key preserved — allowlist rejected the wrong-prefix write.
    after = _read_override(isolated_override)
    assert after.get("openai_api_key") == "sk-existing-real-key"
    # WARNING log fires with explicit "rejected api_key write" prefix and
    # the key name (NOT the value — the value is never logged).
    rejection_logs = [
        rec
        for rec in caplog.records
        if "rejected api_key write" in rec.getMessage()
        and "openai_api_key" in rec.getMessage()
    ]
    assert len(rejection_logs) >= 1, (
        f"expected at least one WARNING log with 'rejected api_key write' + 'openai_api_key'; "
        f"got: {[r.getMessage() for r in caplog.records]}"
    )


def test_save_override_rejects_empty_string_and_logs_warning(
    isolated_override: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Empty string would normally pass the `v == KEY_PLACEHOLDER` guard
    (since "" != "***") and the `v is None` guard, then WRITE "" to the
    override file — clobbering the existing valid key. The new allowlist
    layer catches this."""
    from app.models.user_settings import save_override

    with caplog.at_level(logging.WARNING, logger="app.models.user_settings"):
        save_override({"openai_api_key": ""})

    after = _read_override(isolated_override)
    # Existing key preserved — allowlist rejected the empty write.
    assert after.get("openai_api_key") == "sk-existing-real-key"
    # WARNING fires for the empty case.
    rejection_logs = [
        rec
        for rec in caplog.records
        if "rejected api_key write" in rec.getMessage()
    ]
    assert len(rejection_logs) >= 1


def test_save_override_respects_none_value_to_remove_key(
    isolated_override: Path,
) -> None:
    """None still removes the key (existing contract) — allowlist only fires
    when v is not None."""
    from app.models.user_settings import save_override

    save_override({"openai_api_key": None})

    after = _read_override(isolated_override)
    assert "openai_api_key" not in after


def test_save_override_non_api_key_field_unaffected_by_allowlist(
    isolated_override: Path,
) -> None:
    """Allowlist only triggers on k.endswith('_api_key'); other fields like
    'llm_model' pass through unchanged.

    Note: '***' is rejected for ALL fields by the older KEY_PLACEHOLDER skip
    (predates Plan 075.4-04); the allowlist layer only matters for api_key
    fields that did NOT hit that skip. This test uses a non-sentinel value to
    confirm non-api-key fields bypass the new layer entirely."""
    from app.models.user_settings import save_override

    # Non-api-key field with a value that LOOKS sentinel-ish for an api_key
    # (empty-ish, whitespace-ish) — the new allowlist must NOT trigger on this.
    save_override({"llm_model": "  weird-model-id  "})

    after = _read_override(isolated_override)
    assert after.get("llm_model") == "  weird-model-id  "  # passed through
