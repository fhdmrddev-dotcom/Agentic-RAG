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

──────────────────────────────────────────────────────────────────────────────────────
⚠ AMENDED 2026-09-21 (Phase 262) — TWO CASES WERE RETIRED **DELIBERATELY**, and the
  original docstring above is kept VERBATIM rather than rewritten, because what it
  describes was true and the reason it stopped being true is the finding.

  The 400 above names TWO remedies — *"use /v1/responses **or** set reasoning_effort to
  'none'"* — and Phase 175 took NEITHER. It dropped the ``tools`` param instead, which
  avoids the error by surrendering the capability the error was about. The cost ran
  silently for months: the ``gpt-5.6`` family had **no native tool calling at all**, tool
  invocations were parsed back out of prose, ``parallel_tool_calls`` was unavailable, and
  the Model Registry kept showing ``native_tools: True`` over a toggle that could not fire.

  Phase 262 takes the FIRST remedy. A row marked ``api_surface: "responses"`` is served on
  ``/v1/responses`` by ``provider_gateway.openai_responses``, where reasoning and native
  tools coexist — so those rows now resolve **NATIVE**, and the two cases that asserted
  STRUCTURED for ``gpt-5.6-sol`` no longer describe the shipped system.

  ⛔ THE GATE ITSELF IS NOT REMOVED, AND THE ORDERING PROOF IS NOT WEAKENED. Both cases are
  REPLACED below — not deleted — by the same assertions driven through a model that is
  ``reasoning_first`` WITHOUT the Responses surface (an OpenRouter-served copy). That route
  still hits the 400 and STRUCTURED is still its only answer, so the property each case was
  built to protect is still proven, on the input where it still holds.

  ⛔ Nothing here may be "simplified" by deleting the OpenRouter parametrisation. Doing so
  would leave the STRUCTURED branch of ``resolve_calling_mode`` with no test at all, and a
  branch nobody exercises is how this family lost native tool calling in the first place.
──────────────────────────────────────────────────────────────────────────────────────
"""
from types import SimpleNamespace

import app.models.user_settings as us_mod
from app.config import MODEL_CAPABILITIES
from app.services.openai_service import CallingMode, resolve_calling_mode


def _warm_cache(monkeypatch, cache: dict) -> None:
    """Replace the warm ``_model_overrides_cache`` the sync DB-native read consults."""
    monkeypatch.setattr(us_mod, "_model_overrides_cache", cache)


def _openrouter_settings(model_id: str) -> SimpleNamespace:
    """A reasoning-first model routed through OpenRouter — the case the gate still owns.

    ``/v1/responses`` is OpenAI's OWN surface: an OpenRouter, Ollama or LM Studio endpoint
    serving the same model id does not implement it, so such a route is still stuck with
    chat.completions and still hard-400s on a tools param. STRUCTURED remains correct, and
    these are the inputs the retired cases are re-driven on.
    """
    return SimpleNamespace(
        active_provider="openrouter",
        llm_model=model_id,
        openrouter_tool_strategy="quality",
    )


def test_reasoning_first_routes_structured(monkeypatch):
    """A model whose capability carries ``reasoning_first`` → STRUCTURED (no tools /
    reasoning_effort param → no gpt-5.6 400; reasoning stays on).

    ⚠ RE-DRIVEN (Phase 262) on the OpenRouter route. The original drove ``gpt-5.6-sol`` with
    ``user_settings=None``, which now resolves NATIVE because that row is served on
    ``/v1/responses``. The property under test is unchanged: a reasoning-first model with no
    Responses surface available still routes STRUCTURED, and ``native_tools=True`` in its
    static registry row does not save it — so the gate is still proven to short-circuit
    ABOVE the native-tools read.
    """
    _warm_cache(monkeypatch, {})
    assert MODEL_CAPABILITIES["gpt-5.6-sol"]["native_tools"] is True
    assert (
        resolve_calling_mode("gpt-5.6-sol", user_settings=_openrouter_settings("gpt-5.6-sol"))
        is CallingMode.STRUCTURED
    )


def test_reasoning_first_wins_over_operator_db_native_true(monkeypatch):
    """Open Q2 ordering proof: even an operator ``native_tools=True`` override on the
    reasoning-first row STILL resolves STRUCTURED — the hard API constraint wins because the
    gate is ABOVE the ``db_native`` / ``effective_native`` read, so a forced native toggle
    cannot re-trigger the 400.

    ⚠ RE-DRIVEN (Phase 262) on the OpenRouter route, for the reason in the module docstring.
    The ORDERING is what this case exists to pin and the ordering is untouched: the operator
    override below is the strongest "make it native" signal the system has, and it still
    loses to the gate wherever the gate still applies.
    """
    _warm_cache(monkeypatch, {
        "gpt-5.6-sol": {"model_id": "gpt-5.6-sol", "native_tools": True,
                        "enabled": True, "provider": "openai"},
    })
    assert (
        resolve_calling_mode("gpt-5.6-sol", user_settings=_openrouter_settings("gpt-5.6-sol"))
        is CallingMode.STRUCTURED
    )


def test_responses_surface_rows_resolve_native(monkeypatch):
    """⭐ THE RETIREMENT, ASSERTED POSITIVELY (Phase 262).

    A retired fence that leaves nothing behind is indistinguishable from a deleted one. This
    case states the NEW truth in the same file as the old: on the native OpenAI route, every
    ``api_surface: "responses"`` row resolves NATIVE, because the adapter that serves it
    gives the model reasoning AND native tools together.
    """
    _warm_cache(monkeypatch, {})
    for model_id in ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"):
        assert resolve_calling_mode(model_id, user_settings=None) is CallingMode.NATIVE


def test_non_reasoning_first_model_is_byte_identical(monkeypatch):
    """D-14: a plain ``native_tools=True`` non-5.6 model is unchanged — NATIVE, exactly as
    today. The gate is default-inert for any model without the ``reasoning_first`` key."""
    _warm_cache(monkeypatch, {})
    assert resolve_calling_mode("gpt-4o", user_settings=None) is CallingMode.NATIVE


def test_gpt_5_6_registry_rows_carry_reasoning_first():
    """Tie the gate to Plan 01's data: the real registry rows MUST carry ``reasoning_first``,
    else the gate above would silently no-op for the exact models it protects.

    ⚠ Still load-bearing after Phase 262, and for a SECOND reason now: ``reasoning_first`` is
    what keeps the STRUCTURED downgrade armed for every non-OpenAI route of these same ids.
    """
    for model_id in ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"):
        assert MODEL_CAPABILITIES[model_id].get("reasoning_first") is True


def test_gpt_5_6_registry_rows_carry_the_responses_surface():
    """The Phase 262 data half: the gate reads ``api_surface``, so a row that lost the key
    would silently fall back to prose-parsed tool calls with nothing to say so."""
    for model_id in ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"):
        assert MODEL_CAPABILITIES[model_id].get("api_surface") == "responses"
