"""Phase 292-01 — the shared 292 parity fixtures, read through the backend (Pitfall 6 / CR-01 class).

``fixtures/artifact_bad_specs_292.json`` is read by THIS suite through ``validate_args`` and by
292-03's ``artifactParity292.fence.test.ts`` through ``parseArtifactRecord`` (after the lift stated in
the fixture's own ``about``), so a rule present in one validator and missing in the other turns one of
the two suites red. ``fixtures/artifact_record_292.json`` is the stored wire contract 292-02 codes
against: every record must round-trip byte-for-byte through its ``Stored*Spec`` model.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.artifact import (
    ARTIFACT_COMPONENTS,
    ARTIFACT_LABEL_RE,
    ARTIFACT_RECORD_KEYS,
    MAX_SOURCE_DOCUMENT_CHARS,
    ArtifactRefusal,
    StoredComparisonSpec,
    StoredDiagramSpec,
    StoredSource,
    StoredTimelineSpec,
    _js_len,
    clean_document_name,
    refusal_payload,
    validate_args,
)

FIXTURES = Path(__file__).parent / "fixtures"
PARITY_FIXTURE = FIXTURES / "artifact_bad_specs_292.json"
RECORD_FIXTURE = FIXTURES / "artifact_record_292.json"


def _expand(v):
    """``{"$repeat": s, "times": n}`` → ``s * n``, recursively (the v1 fixture's one convention)."""
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
    return {k: v for k, v in case.items() if k != "name"}


def test_parity_fixture_is_not_vacuous():
    raw = json.loads(PARITY_FIXTURE.read_text(encoding="utf-8"))
    assert set(raw) == {"about", "bad", "good", "stored_sources", "document_names"}
    assert len(raw["bad"]) >= 20
    assert len(raw["good"]) >= 6
    comps = {c["component"] for c in raw["bad"]} | {c["component"] for c in raw["good"]}
    assert {"diagram", "comparison", "timeline"} <= comps
    # The lift plan 03 applies is stated, not implied.
    for needle in ('"step"', "lower-cased", "fixture.pdf", "row_count", "lineage: null"):
        assert needle in raw["about"], needle


@pytest.mark.parametrize("case", _cases("bad"), ids=lambda c: c["name"])
def test_every_bad_case_is_refused_by_the_backend(case):
    out = validate_args(_args(case))
    assert isinstance(out, ArtifactRefusal), f"backend ACCEPTED a spec the frontend refuses: {case['name']}"
    payload = refusal_payload(out)
    assert set(payload) == {"status", "reason", "detail"}
    assert "error" not in payload
    assert 0 < len(out.reason) <= 120


@pytest.mark.parametrize("case", _cases("good"), ids=lambda c: c["name"])
def test_every_good_case_is_accepted_by_the_backend(case):
    out = validate_args(_args(case))
    assert not isinstance(out, ArtifactRefusal), f"{case['name']}: {out}"


# ── 292-REVIEW CR-01: the stored source and its document name, in the browser's units ───────────


def test_source_sections_are_not_vacuous():
    raw = json.loads(PARITY_FIXTURE.read_text(encoding="utf-8"))
    assert {c["ok"] for c in raw["stored_sources"]} == {True, False}
    assert len(raw["document_names"]) >= 3
    assert "stored_sources" in raw["about"] and "document_names" in raw["about"]


@pytest.mark.parametrize("case", _cases("stored_sources"), ids=lambda c: c["name"])
def test_every_stored_source_case_matches_its_ok(case):
    try:
        StoredSource.model_validate(case["source"])
        accepted = True
    except ValidationError:
        accepted = False
    assert accepted is case["ok"], case["name"]


@pytest.mark.parametrize("case", _cases("document_names"), ids=lambda c: c["name"])
def test_every_document_name_is_cleaned_to_its_stored_value(case):
    doc = clean_document_name(case["filename"])
    assert doc == case["document"], case["name"]
    assert _js_len(doc) <= MAX_SOURCE_DOCUMENT_CHARS
    StoredSource.model_validate({"document": doc, "page": None, "excerpt": None})


# ── The stored wire contract (D-14) ──────────────────────────────────────────────────────────────

_STORED = {"diagram": StoredDiagramSpec, "comparison": StoredComparisonSpec, "timeline": StoredTimelineSpec}


def _records() -> list[dict]:
    data = json.loads(RECORD_FIXTURE.read_text(encoding="utf-8"))
    head = {k: v for k, v in data.items() if k != "examples"}
    return [head] + list(data["examples"])


def test_record_fixture_holds_one_record_per_new_type():
    recs = _records()
    assert sorted(r["component"] for r in recs) == ["comparison", "diagram", "timeline"]
    assert [r["label"] for r in recs] == ["diagram 1", "comparison 1", "timeline 1"]


@pytest.mark.parametrize("rec", _records(), ids=lambda r: r["component"])
def test_every_record_round_trips_through_its_stored_model(rec):
    assert set(rec) == ARTIFACT_RECORD_KEYS, set(rec) ^ ARTIFACT_RECORD_KEYS
    assert rec["component"] in ARTIFACT_COMPONENTS
    assert ARTIFACT_LABEL_RE.fullmatch(rec["label"])
    assert rec["spec_version"] == 1
    assert rec["caption"]["lineage"] is None
    comp = rec["component"]
    spec = rec["spec"]
    assert set(spec) == {"title", comp}, "a new-type spec carries its title and its own encoding only"
    model = _STORED[comp].model_validate(spec)
    assert model.model_dump(by_alias=True) == spec, "the fixture must round-trip unchanged"
    items = {"diagram": lambda s: s["diagram"]["nodes"], "comparison": lambda s: s["comparison"]["terms"],
             "timeline": lambda s: s["timeline"]["events"]}[comp](spec)
    assert rec["row_count"] == rec["caption"]["row_count"] == len(items)


def test_record_fixture_carries_at_least_one_resolved_source_per_type():
    for rec in _records():
        dumped = json.dumps(rec["spec"])
        assert '"excerpt": "' in dumped, rec["component"]


def test_record_fixture_shapes_match_the_sketch():
    diag, comp, tl = _records()
    d = diag["spec"]["diagram"]
    assert (len(d["nodes"]), len(d["edges"])) == (8, 9)
    assert {n["kind"] for n in d["nodes"]} == {"start", "step", "decision", "end"}
    assert any(e["from"] == e["to"] and e["label"] for e in d["edges"]), "one labelled self-loop"
    c = comp["spec"]["comparison"]
    assert (len(c["options"]), len(c["terms"])) == (3, 7)
    assert sum(cell["verdict"] == "q" for t in c["terms"] for cell in t["cells"]) >= 2
    ev = tl["spec"]["timeline"]["events"]
    assert len(ev) == 9
    assert sum(e["deadline"] for e in ev) == 1
    assert {len(e["date"]) for e in ev} == {7, 10}, "mixed precision"
