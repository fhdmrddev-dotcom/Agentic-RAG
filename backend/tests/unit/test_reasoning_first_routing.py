"""Phase 175 Plan 03 Task 1 (XPROV-01 / D-01) — reasoning_first STRUCTURED routing gate.

gpt-5.6-class OpenAI models are reasoning-first: the live chat.completions endpoint
rejects a call that carries BOTH a native ``tools`` param AND reasoning with a 400
("Function tools with reasoning_effort are not supported ... use /v1/responses or set
reasoning_effort to 'none'"). The fix routes any model whose capability carries
``reasoning_first`` to :class:`CallingMode.STRUCTURED` — tools go via XML injection, so no
``tools`` param (and no ``reasoning_effort``) is ever sent, the 400 can't fire, and
reasoning stays ON.

The gate sits ABOVE the ``db_native`` / ``effective_native`` resolution so the hard OpenAI
API constraint WINS over an operator ``native_tools=True`` override (RESEARCH Open Q2) — a
forced native toggle cannot re-trigger the 400.

Pure unit — monkeypatches the SAME warm ``_model_overrides_cache`` the analog
``test_149_native_tools_routing.py`` drives; no DB, no network. ``reasoning_first`` is real
registry data landed by Plan 01, so the gate is tied to ``MODEL_CAPABILITIES`` directly.
"""
import app.models.user_settings as us_mod
from app.config import MODEL_CAPABILITIES
from app.services.openai_service import CallingMode, resolve_calling_mode


def _warm_cache(monkeypatch, cache: dict) -> None:
    """Replace the warm ``_model_overrides_cache`` the sync DB-native read consults."""
    monkeypatch.setattr(us_mod, "_model_overrides_cache", cache)


def test_reasoning_first_routes_structured(monkeypatch):
    """A model whose capability carries ``reasoning_first`` → STRUCTURED (no tools /
    reasoning_effort param → no gpt-5.6 400; reasoning stays on). ``gpt-5.6-sol`` is the real
    registry row (Plan 01) and static ``native_tools=True`` — proving the gate short-circuits
    ABOVE the native-tools read."""
    _warm_cache(monkeypatch, {})
    assert resolve_calling_mode("gpt-5.6-sol", user_settings=None) is CallingMode.STRUCTURED


def test_reasoning_first_wins_over_operator_db_native_true(monkeypatch):
    """Open Q2 ordering proof: even an operator ``native_tools=True`` override on the
    reasoning-first row STILL resolves STRUCTURED — the hard API constraint wins because the
    gate is ABOVE the ``db_native`` / ``effective_native`` read, so a forced native toggle
    cannot re-trigger the 400."""
    _warm_cache(monkeypatch, {
        "gpt-5.6-sol": {"model_id": "gpt-5.6-sol", "native_tools": True,
                        "enabled": True, "provider": "openai"},
    })
    assert resolve_calling_mode("gpt-5.6-sol", user_settings=None) is CallingMode.STRUCTURED


def test_non_reasoning_first_model_is_byte_identical(monkeypatch):
    """D-14: a plain ``native_tools=True`` non-5.6 model is unchanged — NATIVE, exactly as
    today. The gate is default-inert for any model without the ``reasoning_first`` key."""
    _warm_cache(monkeypatch, {})
    assert resolve_calling_mode("gpt-4o", user_settings=None) is CallingMode.NATIVE


def test_gpt_5_6_registry_rows_carry_reasoning_first():
    """Tie the gate to Plan 01's data: the real registry rows MUST carry ``reasoning_first``,
    else the gate above would silently no-op for the exact models it protects."""
    for model_id in ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"):
        assert MODEL_CAPABILITIES[model_id].get("reasoning_first") is True
