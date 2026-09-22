"""Phase 262 — provider inference reads the provider the operator ALREADY NAMED.

⭐ THE DEFECT THIS CLOSES, stated plainly because it was invisible for the whole life of the
inference table: a model id matching none of the ten naming patterns fell to the `ollama`
bucket, which is not in `_NATIVE_TOOL_PROVIDERS`. So `native_tools` resolved False, the
`tools` parameter was never sent, the model narrated its tool calls as prose the parser
cannot read, and the agent loop ended after one iteration **with nothing on screen**. The
only trace was a log line.

⚠ It is not a rare edge. The patterns are ten prefixes (`gpt-`, `o[1-9]`, `claude-`,
`gemini-`, `deepseek-`, `kimi-`, `moonshot-`, `minimax-`, `glm-`, `org/model`). Every id
outside them lands in the hole — `grok-`, `mistral-`, `command-`, `qwen`, and by definition
every naming convention a vendor has not invented yet. **A naming-convention table is a
guess about the future, and this one silently failed closed.**

The fix is not a bigger table. It is that when the guess has nothing to say, the system
should read the fact it already holds: the provider the operator configured this model
under. These tests pin that, and pin the two ways it must NOT be used.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.config import ROUTING_PROVIDERS, _infer_provider_for, _match_provider_pattern, get_model_capability
from app.services.openai_service import CallingMode, resolve_calling_mode

# Ids that match no pattern — the population that was silently losing tool calling.
UNMATCHED_IDS = ("grok-5", "mistral-large-3", "command-r-plus", "qwen3-max", "brand-new-thing")


def test_the_pattern_matcher_can_say_it_does_not_know():
    """⛔ The `None` is the fix's foundation.

    `_infer_provider_for` returns `"ollama"` both for a real Ollama model and for one it has
    never heard of. Those are different facts and the old code could not tell them apart —
    which is the whole reason the hole existed.
    """
    assert _match_provider_pattern("gpt-5.6-sol") == "openai"
    assert _match_provider_pattern("claude-opus-5") == "anthropic"
    for mid in UNMATCHED_IDS:
        assert _match_provider_pattern(mid) is None


@pytest.mark.parametrize("model_id", UNMATCHED_IDS)
def test_without_a_hint_an_unmatched_id_still_falls_to_the_old_bucket(model_id):
    """D-14: omitting the hint is byte-identical to the pre-262 behaviour."""
    assert _infer_provider_for(model_id) == "ollama"


@pytest.mark.parametrize("model_id", UNMATCHED_IDS)
def test_a_hint_rescues_an_unmatched_id(model_id):
    assert _infer_provider_for(model_id, "openai") == "openai"
    assert _infer_provider_for(model_id, "anthropic") == "anthropic"


def test_a_pattern_match_still_outranks_the_hint():
    """⛔ The hint is a FALLBACK, never an override.

    A `claude-` id listed by mistake under an OpenAI provider block is still Anthropic. That
    has been correct all along, and letting a misfiled row rewrite a model's identity would
    trade one silent failure for another.
    """
    assert _infer_provider_for("claude-opus-5", "openai") == "anthropic"
    assert _infer_provider_for("gemini-4-pro", "openrouter") == "google"


def test_an_unrecognised_hint_is_ignored_not_trusted():
    """⛔ Only a real routing provider may steer capability resolution.

    A typo in a settings row would otherwise invent a provider, and both
    `_NATIVE_TOOL_PROVIDERS` and `_INFERRED_DEFAULT_MAX_TOKENS` would silently miss on it —
    producing defaults nobody chose.
    """
    assert "xai" not in ROUTING_PROVIDERS
    assert _infer_provider_for("grok-5", "xai") == "ollama"
    assert _infer_provider_for("grok-5", "") == "ollama"
    assert _infer_provider_for("grok-5", None) == "ollama"


def test_the_hint_is_case_and_whitespace_tolerant():
    assert _infer_provider_for("grok-5", "  OpenAI ") == "openai"


# ── The consequence, end to end ───────────────────────────────────────────────


def _settings(provider: str, model: str) -> SimpleNamespace:
    return SimpleNamespace(
        active_provider=provider, llm_model=model, openrouter_tool_strategy="quality"
    )


@pytest.mark.parametrize("model_id", UNMATCHED_IDS)
def test_an_unknown_model_on_a_native_provider_gets_native_tools(model_id):
    """⭐ THE HEADLINE. This is the assertion that would have failed before the fix.

    An unreleased model id, typed into an OpenAI provider block, now calls tools natively
    instead of narrating them into the void.
    """
    assert resolve_calling_mode(model_id, _settings("openai", model_id)) is CallingMode.NATIVE
    assert get_model_capability(model_id, "openai")["native_tools"] is True


@pytest.mark.parametrize("provider", ("ollama", "lmstudio", "custom"))
def test_local_providers_that_were_deliberately_tool_less_stay_tool_less(provider):
    """⛔ THE FIX MUST NOT QUIETLY ENABLE TOOLS WHERE THEY WERE TURNED OFF ON PURPOSE.

    The local providers sit outside `_NATIVE_TOOL_PROVIDERS` by an explicit, measured
    decision — a local model narrating and even FABRICATING tool calls is live-confirmed.
    Reading the hint must not launder that away: the hint decides WHICH provider, never
    whether that provider has native tools.
    """
    assert (
        resolve_calling_mode("grok-5", _settings(provider, "grok-5")) is CallingMode.STRUCTURED
    )


def test_openrouter_is_native_by_STRATEGY_not_by_the_native_tools_set():
    """⚠ MEASURED CORRECTION — this case was written asserting STRUCTURED and was WRONG.

    `openrouter` is outside `_NATIVE_TOOL_PROVIDERS`, so the obvious inference is that an
    OpenRouter model runs STRUCTURED. It does not. `resolve_calling_mode` has an OpenRouter
    branch that sits ABOVE the `effective_native` read and returns NATIVE for the `quality`
    and `native` strategies, reaching STRUCTURED only for `xml`. **Two different mechanisms
    decide tool mode and they disagree about OpenRouter** — the capability set is not the one
    in charge there.

    Recorded as a test rather than a comment because the wrong version of it passed review in
    my own head: `_NATIVE_TOOL_PROVIDERS` reads like the authority on this question and is
    not. ⛔ Phase 262 changes NOTHING here — `is_openrouter` is satisfied by
    `active_provider` before any inference runs, so the hint cannot reach this branch.
    """
    assert (
        resolve_calling_mode("grok-5", _settings("openrouter", "grok-5")) is CallingMode.NATIVE
    )
    xml = _settings("openrouter", "grok-5")
    xml.openrouter_tool_strategy = "xml"
    assert resolve_calling_mode("grok-5", xml) is CallingMode.STRUCTURED


def test_a_registered_model_never_consults_the_hint():
    """A registry hit returns before inference runs — registered models are untouched."""
    assert get_model_capability("gpt-5.6-sol", "ollama")["provider"] == "openai"
    assert get_model_capability("claude-opus-5", "openai")["provider"] == "anthropic"
