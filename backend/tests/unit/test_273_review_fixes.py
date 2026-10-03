"""Phase 273 code-review fixes (273-REVIEW.md) — one section per finding, each written RED first.

CR-01 — the backend validator must refuse everything the frontend guard refuses. A spec the model is
told was "Shown to the user" must be one the only renderer draws (I-2 / D-12). The two validators are
pinned to ONE shared fixture (``fixtures/artifact_bad_specs_v1.json``), which
``frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`` feeds through
``parseArtifactRecord`` — so the two cannot drift apart again without one of the two suites going red.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.models.artifact import ArtifactRefusal, refusal_payload, validate_args

PARITY_FIXTURE = Path(__file__).parent / "fixtures" / "artifact_bad_specs_v1.json"


def _expand(v):
    """``{"$repeat": s, "times": n}`` → ``s * n``, recursively (the fixture's one convention)."""
    if isinstance(v, dict):
        if set(v) == {"$repeat", "times"}:
            return v["$repeat"] * v["times"]
        return {k: _expand(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_expand(x) for x in v]
    return v


def _cases(kind: str) -> list[dict]:
    raw = json.loads(PARITY_FIXTURE.read_text(encoding="utf-8"))
    return [_expand(c) for c in raw[kind]]


def _args(case: dict) -> dict:
    """The case as show_artifact arguments: every key except the fixture's own ``name``."""
    return {k: v for k, v in case.items() if k != "name"}


# ── CR-01: backend ⊇ frontend guard ──────────────────────────────────────────────────────────────


def test_cr01_parity_fixture_is_not_vacuous():
    assert len(_cases("bad")) >= 20
    assert len(_cases("good")) >= 5


@pytest.mark.parametrize("case", _cases("bad"), ids=lambda c: c["name"])
def test_cr01_every_bad_spec_is_refused_by_the_backend(case):
    out = validate_args(_args(case))
    assert isinstance(out, ArtifactRefusal), f"backend ACCEPTED a spec the frontend refuses: {case['name']}"
    payload = refusal_payload(out)
    assert set(payload) == {"status", "reason", "detail"}
    assert "error" not in payload


@pytest.mark.parametrize("case", _cases("good"), ids=lambda c: c["name"])
def test_cr01_every_good_spec_is_accepted_by_the_backend(case):
    out = validate_args(_args(case))
    assert not isinstance(out, ArtifactRefusal), f"{case['name']}: {out}"


def test_cr01_scatter_with_text_x_names_the_column_not_the_model_string():
    case = next(c for c in _cases("bad") if c["name"] == "scatter with a text x column")
    out = validate_args(_args(case))
    assert isinstance(out, ArtifactRefusal)
    assert out.reason == "region isn't a number column"
    assert "scatter" in out.detail


def test_cr01_overflowing_numbers_never_reach_the_store_as_infinity():
    for name in ("integer cell beyond the float64 range", "numeric string that overflows to infinity"):
        case = next(c for c in _cases("bad") if c["name"] == name)
        out = validate_args(_args(case))
        assert isinstance(out, ArtifactRefusal), name
        assert out.reason == "a value in v is too large to show", out


def test_cr01_a_range_filter_bound_must_be_finite():
    out = validate_args({
        "component": "table", "title": "t", "from_artifact": "table 1",
        "transform": {"filter": [{"column": "v", "op": "range", "min": float("inf")}]},
    })
    assert isinstance(out, ArtifactRefusal)


def test_cr01_length_caps_count_utf16_units_like_the_browser():
    # 60 emoji = 120 UTF-16 units (the frontend's cap) — accepted; one more emoji is refused.
    ok = validate_args({"component": "table", "title": "\U0001F600" * 60,
                        "columns": [{"name": "k", "type": "string"}], "rows": [["a"]]})
    assert not isinstance(ok, ArtifactRefusal)
    bad = validate_args({"component": "table", "title": "\U0001F600" * 61,
                         "columns": [{"name": "k", "type": "string"}], "rows": [["a"]]})
    assert isinstance(bad, ArtifactRefusal)
    assert bad.reason == "the title is over 120 characters"
