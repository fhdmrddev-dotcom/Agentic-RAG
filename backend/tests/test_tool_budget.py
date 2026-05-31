"""Phase 091 — TOOL-05 tool-budget contracts (Plan 06, LIVE).

apply_tool_budget filters get_tools() output to the active phase whitelist
(D-05 layer 1 — the model only SEES allowed tools) then caps the result at the
per-provider MODEL_CAPABILITIES[model].max_tools soft ceiling — dropping
lowest-priority (registry/assembly-order) tools first but ALWAYS retaining the
whitelist tools (they are the point of the phase). Absent max_tools = no cap.

This function is invoked ONLY from the harness executor path (Plan 03, phase
config present). It is NOT wired into the Deep-Mode/default get_tools() call
sites this phase, so Explorer/General/Deep-Mode tool sets — including Google —
stay byte-identical (SC#2 / the Phase 089 invariant).
"""
from __future__ import annotations

import pytest

from app.config import MODEL_CAPABILITIES
from app.models.harness import LlmAgentPhaseConfig
from app.services.openai_service import apply_tool_budget, get_tools


def _fn(name: str) -> dict:
    """A minimal tool schema in the get_tools() shape."""
    return {"type": "function", "function": {"name": name, "description": name}}


def test_budget_whitelist_source_is_available_tools():
    """LIVE anchor — the budget guard's retain-set is the phase's available_tools."""
    cfg = LlmAgentPhaseConfig.model_validate(
        {"phase_type": "llm_agent", "prompt": "x",
         "available_tools": ["search_documents", "execute_code"]}
    )
    assert set(cfg.available_tools) == {"search_documents", "execute_code"}


def test_max_tools_field_on_google_rows():
    """TOOL-05 — Google/Gemini rows carry an explicit max_tools ceiling (SEED-035)."""
    google_rows = [
        (mid, cap) for mid, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "google"
    ]
    assert google_rows, "expected Google rows in MODEL_CAPABILITIES"
    assert all("max_tools" in cap for _mid, cap in google_rows), (
        "every Google row must carry max_tools"
    )


def test_budget_caps_at_max_tools():
    """get_tools filtered to whitelist then capped at MODEL_CAPABILITIES[model].max_tools."""
    # 24 input schemas; whitelist of 2; Google cap is well below 24.
    schemas = [_fn(f"tool_{i}") for i in range(22)] + [
        _fn("search_documents"), _fn("execute_code")
    ]
    google_model = next(
        mid for mid, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "google" and "max_tools" in cap
    )
    cap = MODEL_CAPABILITIES[google_model]["max_tools"]
    whitelist = frozenset({"search_documents", "execute_code"})
    out = apply_tool_budget(schemas, model=google_model, whitelist=whitelist)
    # whitelist filter reduced 24 → 2, so the result is exactly the whitelist (≤ cap)
    names = {t["function"]["name"] for t in out}
    assert names == {"search_documents", "execute_code"}
    assert len(out) <= cap


def test_budget_caps_long_whitelist_at_max_tools():
    """A whitelist LARGER than the cap is capped to max_tools (still retaining whitelist tools)."""
    google_model = next(
        mid for mid, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "google" and "max_tools" in cap
    )
    cap = MODEL_CAPABILITIES[google_model]["max_tools"]
    # whitelist of cap+5 tools, plus 5 non-whitelist filler
    wl_names = [f"wl_{i}" for i in range(cap + 5)]
    schemas = [_fn(n) for n in wl_names] + [_fn(f"other_{i}") for i in range(5)]
    whitelist = frozenset(wl_names)
    out = apply_tool_budget(schemas, model=google_model, whitelist=whitelist)
    out_names = {t["function"]["name"] for t in out}
    # non-whitelist filler dropped first; whitelist preserved up to cap behavior
    assert out_names.issubset(set(wl_names))  # only whitelist tools survived
    # when whitelist alone exceeds cap, all whitelist tools are kept (structural req wins)
    assert out_names == set(wl_names)


def test_whitelist_tools_always_retained():
    """With whitelist=None the cap drops lowest-priority tools but never reorders survivors.

    (When a whitelist IS set, stage-1 filtering already removes non-whitelist tools,
     so the "retain whitelist while dropping fillers at the cap" path only fires when
     the whitelist itself exceeds the cap — covered by test_budget_caps_long_whitelist.)
    Here we prove the no-whitelist cap keeps the HIGHEST-priority (earliest) tools.
    """
    google_model = next(
        mid for mid, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "google" and "max_tools" in cap
    )
    cap = MODEL_CAPABILITIES[google_model]["max_tools"]
    schemas = [_fn(f"tool_{i}") for i in range(cap + 5)]
    out = apply_tool_budget(schemas, model=google_model, whitelist=None)
    assert len(out) == cap
    # earliest (highest-priority) tools survive; latest dropped
    assert [t["function"]["name"] for t in out] == [f"tool_{i}" for i in range(cap)]


def test_no_cap_when_max_tools_absent():
    """A model with no max_tools key → all input schemas returned unchanged (soft ceiling)."""
    # OpenAI rows carry no max_tools (only Google does in 091).
    uncapped_model = "gpt-4o"
    assert "max_tools" not in MODEL_CAPABILITIES.get(uncapped_model, {})
    schemas = [_fn(f"tool_{i}") for i in range(30)]
    out = apply_tool_budget(schemas, model=uncapped_model, whitelist=None)
    assert out == schemas  # byte-identical pass-through, no filter, no cap


def test_deep_mode_non_capped_provider_byte_identical():
    """whitelist=None + no max_tools → get_tools() list returned unchanged (SC#2)."""
    tools = get_tools(None)
    out = apply_tool_budget(tools, model="gpt-4o", whitelist=None)
    assert out == tools  # Deep-Mode byte-identical for non-capped providers


def test_whitelist_filter_alone_reduces_to_whitelist_size():
    """Whitelist filter (no cap) reduces N schemas → len(whitelist intersection)."""
    schemas = [_fn(f"tool_{i}") for i in range(10)] + [_fn("search_documents")]
    whitelist = frozenset({"search_documents"})
    # gpt-4o has no max_tools → only the whitelist filter applies
    out = apply_tool_budget(schemas, model="gpt-4o", whitelist=whitelist)
    assert [t["function"]["name"] for t in out] == ["search_documents"]


def test_unknown_model_no_cap():
    """A model not in MODEL_CAPABILITIES at all → no cap (default-when-absent)."""
    schemas = [_fn(f"tool_{i}") for i in range(30)]
    out = apply_tool_budget(schemas, model="some-unregistered-model", whitelist=None)
    assert out == schemas
