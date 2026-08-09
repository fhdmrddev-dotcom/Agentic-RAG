"""Phase 175 Plan 01 — reasoning-capability marker matrix (XPROV-01 D-01 + XPROV-04 D-05).

Asserts the exact SAFE/UNSAFE marker matrix directly against the live
``MODEL_CAPABILITIES`` registry. These markers are additive DATA (never a
hardcoded id-list in code — D-122-04): the Plan-03 routing gate reads
``reasoning_first`` and the Plan-04 title-call injection reads ``reasoning_off``.

Why per-MODEL, not per-provider-default (D-05): ``thread_title.py`` resolves the
title model from the user's ACTIVE ``chat_model`` FIRST for single-model
providers, so ANY docs-confirmed-SAFE model a user chats with must carry the
marker — not just the 3 provider defaults — or the degenerate first-few-words
title returns (the XPROV-04 symptom).

The tamper-regression guard for T-175-01-01: MODEL_CAPABILITIES is
operator/code-controlled; this matrix is the only thing that locks the SAFE set
marked and the UNSAFE negatives unmarked.
"""
from __future__ import annotations

import pytest

from app.config import MODEL_CAPABILITIES


# ---------------------------------------------------------------------------
# XPROV-01 (D-01) — reasoning_first on the 3 gpt-5.6-class rows ONLY
# ---------------------------------------------------------------------------

REASONING_FIRST_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]


@pytest.mark.parametrize("model_id", REASONING_FIRST_MODELS)
def test_gpt56_rows_are_reasoning_first(model_id: str):
    """Each gpt-5.6-class row carries ``reasoning_first is True`` (D-01)."""
    assert MODEL_CAPABILITIES[model_id].get("reasoning_first") is True


@pytest.mark.parametrize("model_id", REASONING_FIRST_MODELS)
def test_gpt56_rows_keep_native_tools(model_id: str):
    """The existing ``native_tools: True`` is untouched — the Plan-03 gate
    short-circuits STRUCTURED ABOVE the native-tools read, so the marker alone
    routes them (D-01)."""
    assert MODEL_CAPABILITIES[model_id].get("native_tools") is True


def test_reasoning_first_is_not_set_anywhere_else():
    """``reasoning_first`` appears on EXACTLY the 3 gpt-5.6 rows — no other row
    (capability-keyed, no accidental widening)."""
    marked = {
        mid for mid, cap in MODEL_CAPABILITIES.items() if cap.get("reasoning_first")
    }
    assert marked == set(REASONING_FIRST_MODELS)


# ---------------------------------------------------------------------------
# XPROV-04 (D-05) — reasoning_off on the FULL docs-confirmed SAFE set
# ---------------------------------------------------------------------------

# extra_body {"thinking": {"type": "disabled"}} family — SAFE (11 rows)
THINKING_DISABLED_MODELS = [
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "kimi-k2.6",
    "kimi-k2.5",
    "glm-4.6",
    "glm-4.7",
    "glm-5",
    "glm-5-turbo",
    "glm-5.1",
    "glm-5.2",
    "MiniMax-M3",
]

# Google reasoning_effort="none" family — SAFE (2 rows)
EFFORT_NONE_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]


@pytest.mark.parametrize("model_id", THINKING_DISABLED_MODELS)
def test_thinking_disabled_rows_marked(model_id: str):
    """Every ``extra_body.thinking``-family SAFE row carries
    ``reasoning_off == "thinking_disabled"`` (D-05 — per-MODEL across the whole
    set, not just the 3 provider defaults)."""
    assert MODEL_CAPABILITIES[model_id].get("reasoning_off") == "thinking_disabled"


@pytest.mark.parametrize("model_id", EFFORT_NONE_MODELS)
def test_effort_none_rows_marked(model_id: str):
    """Both Google docs-confirmed-disable rows carry
    ``reasoning_off == "effort_none"`` (D-05 SAFE)."""
    assert MODEL_CAPABILITIES[model_id].get("reasoning_off") == "effort_none"


def test_reasoning_off_marked_set_is_exactly_the_safe_set():
    """``reasoning_off`` appears on EXACTLY the 13 docs-confirmed-SAFE rows and
    no others (locks the widened SAFE boundary — 11 thinking_disabled + 2
    effort_none = 13)."""
    marked = {
        mid for mid, cap in MODEL_CAPABILITIES.items() if cap.get("reasoning_off")
    }
    assert marked == set(THINKING_DISABLED_MODELS) | set(EFFORT_NONE_MODELS)
    assert len(marked) == 13


# ---------------------------------------------------------------------------
# XPROV-04 (D-05) — the UNSAFE negatives stay UNMARKED (no regression)
# ---------------------------------------------------------------------------

# accept-but-ignore (M2.x keeps thinking ON) / cannot-disable (2.5-pro + all
# 3.x) / pre-4.6 not-docs-confirmed (glm-4.5 / glm-4.5-air) / non-reasoning
# (moonshot-v1-8k). These MUST keep today's derived fallback (default-inert, D-14).
UNSAFE_UNMARKED_MODELS = [
    # MiniMax-M2.x family — accepts {type:disabled} but keeps thinking ON
    "MiniMax-M2",
    "MiniMax-M2.1",
    "MiniMax-M2.1-highspeed",
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
    "MiniMax-M2.7",
    "MiniMax-M2.7-highspeed",
    # Gemini — 2.5-pro cannot disable; whole 3.x family cannot disable
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    # GLM pre-4.6 — not docs-confirmed
    "glm-4.5",
    "glm-4.5-air",
    # non-reasoning
    "moonshot-v1-8k",
]


@pytest.mark.parametrize("model_id", UNSAFE_UNMARKED_MODELS)
def test_unsafe_negatives_have_no_reasoning_off(model_id: str):
    """``reasoning_off`` is ABSENT on every UNSAFE negative (D-05 — keep the
    derived fallback; no regression)."""
    assert "reasoning_off" not in MODEL_CAPABILITIES[model_id]


@pytest.mark.parametrize("model_id", UNSAFE_UNMARKED_MODELS)
def test_unsafe_negatives_have_no_reasoning_first(model_id: str):
    """None of the UNSAFE negatives is a reasoning_first row either."""
    assert "reasoning_first" not in MODEL_CAPABILITIES[model_id]


def test_no_openrouter_row_carries_either_marker():
    """OpenRouter rows are experimental/out-of-scope — neither marker appears on
    any ``provider == "openrouter"`` row (default-inert)."""
    for mid, cap in MODEL_CAPABILITIES.items():
        if cap.get("provider") == "openrouter":
            assert "reasoning_off" not in cap, mid
            assert "reasoning_first" not in cap, mid
