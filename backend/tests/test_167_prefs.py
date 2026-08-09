"""Phase 167 VIS-02 (D-167-04) — the two-layer per-user model-default overlay.

The load-bearing proof is the D-14 RED LINE: ``apply_user_model_default`` is a STRICT
no-op when the user has no preference — it returns the SAME settings object (identity),
so the shared Deep / workflow send path is byte-identical to today. The other cases prove
the SEED-116 two-layer rule: a valid, unlocked, in-allowed-set preference overlays the
model; an operator lock or an out-of-set preference is ignored (falls back to the operator
default). Every helper is patched at ``app.models.user_settings`` (where
``apply_user_model_default`` late-imports them) so no DB is touched.
"""
import pytest
from pydantic import BaseModel

from app.models.user_settings import compose_effective_model_default
from app.services.run_model_resolution import apply_user_model_default


class _FakeSettings(BaseModel):
    """Minimal stand-in for UserEffectiveSettings — the overlay only reads ``llm_model``
    and calls ``model_copy``. A real pydantic model so ``model_copy(update=...)`` returns a
    genuine new instance (identity-distinct), matching the production object's semantics."""
    llm_model: str


_OPERATOR_DEFAULT = "gpt-4o"
_USER_PICK = "claude-3-5-sonnet-latest"


def _patch(monkeypatch, *, pref, allowed, locked):
    async def _load_user_model_default(_user_id):
        return pref

    async def _enabled_model_allowed_set():
        return set(allowed)

    async def _operator_model_default_locked():
        return locked

    monkeypatch.setattr(
        "app.models.user_settings.load_user_model_default", _load_user_model_default
    )
    monkeypatch.setattr(
        "app.models.user_settings.enabled_model_allowed_set", _enabled_model_allowed_set
    )
    monkeypatch.setattr(
        "app.models.user_settings.operator_model_default_locked",
        _operator_model_default_locked,
    )


# ── (a) the D-14 red-line proof: unset -> byte-identical (SAME object) ──────────
async def test_deep_byte_identical_when_unset(monkeypatch):
    _patch(monkeypatch, pref=None, allowed={_USER_PICK}, locked=False)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {"id": "u1"}, settings)

    # The strict no-op: the SAME object flows through (identity), so the shared send
    # path is byte-identical to a pre-VIS-02 send.
    assert result is settings
    assert result.llm_model == _OPERATOR_DEFAULT


# ── (b) a valid, unlocked, in-allowed-set preference overlays the model ─────────
async def test_two_layer_overlay(monkeypatch):
    _patch(monkeypatch, pref=_USER_PICK, allowed={_USER_PICK, _OPERATOR_DEFAULT}, locked=False)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {"id": "u1"}, settings)

    assert result.llm_model == _USER_PICK
    # A copy — the original is never mutated in place.
    assert result is not settings
    assert settings.llm_model == _OPERATOR_DEFAULT


# ── (c) the operator lock wins server-side: preference ignored (identity) ───────
async def test_operator_lock_wins(monkeypatch):
    _patch(monkeypatch, pref=_USER_PICK, allowed={_USER_PICK}, locked=True)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {"id": "u1"}, settings)

    # Locked -> compose returns the operator default -> composed == current -> identity.
    assert result is settings
    assert result.llm_model == _OPERATOR_DEFAULT


# ── (d) an out-of-allowed-set preference is ignored (falls back, identity) ──────
async def test_out_of_set_preference_ignored(monkeypatch):
    _patch(monkeypatch, pref=_USER_PICK, allowed={_OPERATOR_DEFAULT}, locked=False)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {"id": "u1"}, settings)

    assert result is settings
    assert result.llm_model == _OPERATOR_DEFAULT


# ── fail-open: any read error -> settings unchanged (never breaks a send) ───────
async def test_fail_open_on_read_error(monkeypatch):
    async def _boom(_user_id):
        raise RuntimeError("db blip")

    monkeypatch.setattr("app.models.user_settings.load_user_model_default", _boom)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {"id": "u1"}, settings)

    assert result is settings
    assert result.llm_model == _OPERATOR_DEFAULT


# ── no user id -> strict no-op (identity) ───────────────────────────────────────
async def test_missing_user_id_is_noop(monkeypatch):
    _patch(monkeypatch, pref=_USER_PICK, allowed={_USER_PICK}, locked=False)
    settings = _FakeSettings(llm_model=_OPERATOR_DEFAULT)

    result = await apply_user_model_default(None, {}, settings)

    assert result is settings


# ── the pure two-layer decision (compose) — the SEED-116 truth table ────────────
def test_compose_two_layer_truth_table():
    eff = _FakeSettings(llm_model=_OPERATOR_DEFAULT)
    allowed = {_USER_PICK, _OPERATOR_DEFAULT}

    # valid, unlocked, in-set -> user pick
    assert compose_effective_model_default(_USER_PICK, eff, allowed, False) == _USER_PICK
    # locked -> operator default
    assert compose_effective_model_default(_USER_PICK, eff, allowed, True) == _OPERATOR_DEFAULT
    # out of set -> operator default
    assert compose_effective_model_default("ghost-model", eff, allowed, False) == _OPERATOR_DEFAULT
    # unset -> operator default
    assert compose_effective_model_default(None, eff, allowed, False) == _OPERATOR_DEFAULT
