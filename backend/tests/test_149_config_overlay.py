"""Phase 149 Plan 01 (D-149-03/D-149-04) — the async capability read path must
overlay the DB ``deprecated`` state so a discovery-confirmed DB-only row carries
its badge state with ZERO code edits.

``get_model_capability_async`` merges ``model_capabilities_overrides`` rows onto
the static ``MODEL_CAPABILITIES`` defaults. This plan added ``"deprecated"`` to
the overlay field tuple + ``deprecated`` to the ``ModelCapability`` TypedDict.
These tests mock ``_load_model_overrides`` (the lazy import target inside the
function) to prove a non-None DB ``deprecated`` value surfaces on the returned
capability dict, tagged ``capability_source == "db_override"``.
"""
from __future__ import annotations

import app.config as config
import app.models.user_settings as us_mod


async def test_deprecated_true_overlays_from_db(monkeypatch):
    """A DB override row with ``deprecated=True`` for a model that is NOT in the
    static registry surfaces ``deprecated is True`` on the async capability read,
    tagged ``db_override`` (D-149-03 — DB is the living registry, no code edit)."""

    async def fake_overrides():
        return {
            "some-discovery-model": {
                "model_id": "some-discovery-model",
                "provider": "openai",
                "deprecated": True,
            }
        }

    monkeypatch.setattr(us_mod, "_load_model_overrides", fake_overrides)

    cap = await config.get_model_capability_async("some-discovery-model")
    assert cap.get("deprecated") is True, (
        f"a DB row with deprecated=True must overlay onto the capability dict; got {cap!r}"
    )
    assert cap.get("capability_source") == "db_override"


async def test_deprecated_false_overlays_from_db(monkeypatch):
    """An explicit DB ``deprecated=False`` overlays too (non-None) — proving the
    overlay carries the operator's chosen state either way, not just the truthy one."""

    async def fake_overrides():
        return {
            "still-current-model": {
                "model_id": "still-current-model",
                "provider": "anthropic",
                "deprecated": False,
            }
        }

    monkeypatch.setattr(us_mod, "_load_model_overrides", fake_overrides)

    cap = await config.get_model_capability_async("still-current-model")
    assert cap.get("deprecated") is False
    assert cap.get("capability_source") == "db_override"


async def test_no_db_row_leaves_deprecated_absent(monkeypatch):
    """No DB override row → fall through to the sync static path, which does not
    set ``deprecated`` (absent = not deprecated, the default-SAFE read)."""

    async def fake_overrides():
        return {}

    monkeypatch.setattr(us_mod, "_load_model_overrides", fake_overrides)

    cap = await config.get_model_capability_async("gpt-4o")
    assert cap.get("deprecated") is None
    assert cap.get("capability_source") != "db_override"
