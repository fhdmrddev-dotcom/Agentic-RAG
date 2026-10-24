"""Phase 292-01 (D-11, Pitfall 2) — the three new encodings never ride a later turn.

``redact_artifact_args`` replaces a persisted ``diagram`` / ``comparison`` / ``timeline`` object with a
placeholder built from the 273 constants, so a later turn cannot re-send stale ``source`` numbers
against a different manifest, and the validator refuses an echo of the placeholder.
"""
from __future__ import annotations

import copy
import json

import pytest

from app.models.artifact import (
    REFUSED_STATUS,
    RESULT_ID_KEY,
    ROWS_PLACEHOLDER_NOT_STORED,
    ROWS_PLACEHOLDER_STORED,
    ArtifactRefusal,
    validate_args,
)
from app.services.artifact_history import redact_artifact_args

ART_ID = "a_k3j9x0p2qd"
NODES = [{"id": f"n{i}", "label": f"Step {i}", "source": 1} for i in range(8)]
EDGES = [{"from": f"n{i}", "to": f"n{i + 1}"} for i in range(7)] + [{"from": "n7", "to": "n0", "label": "again"}]


def _stored(component="diagram", n=8):
    return json.dumps({RESULT_ID_KEY: ART_ID, "label": f"{component} 1", "component": component, "row_count": n})


def _refused():
    return json.dumps({"status": REFUSED_STATUS, "reason": "26 steps (max 25); group related steps first",
                       "detail": "x"})


def _call(args, result):
    return {"tool_call_id": "c1", "name": "show_artifact", "status": "done", "args": args, "result": result}


def test_a_stored_diagram_becomes_a_placeholder_naming_its_steps():
    tc = _call({"component": "diagram", "title": "Flow", "diagram": {"nodes": NODES, "edges": EDGES}}, _stored())
    before = copy.deepcopy(tc)
    (out,) = redact_artifact_args([tc])
    assert out["args"]["diagram"] == f"{ROWS_PLACEHOLDER_STORED}{ART_ID}, diagram of 8 steps>"
    assert out["args"]["title"] == "Flow" and out["result"] == tc["result"]
    assert tc == before, "the input is never mutated"
    assert '"source"' not in json.dumps(out["args"])


def test_comparison_and_timeline_name_their_items():
    comp = {"component": "comparison", "title": "C", "comparison": {
        "options": ["a", "b"], "terms": [{"name": "t", "cells": [{"verdict": "y"}, {"verdict": "n"}]}] * 7}}
    (o1,) = redact_artifact_args([_call(comp, _stored("comparison", 7))])
    assert o1["args"]["comparison"] == f"{ROWS_PLACEHOLDER_STORED}{ART_ID}, comparison of 7 terms>"
    tl = {"component": "timeline", "title": "T", "timeline": {"events": [{"date": "2026-01", "title": "x"}] * 9}}
    (o2,) = redact_artifact_args([_call(tl, _refused())])
    assert o2["args"]["timeline"] == f"{ROWS_PLACEHOLDER_NOT_STORED}: refused, timeline of 9 events>"


def test_a_refused_diagram_is_a_not_stored_placeholder():
    (out,) = redact_artifact_args([_call({"component": "diagram", "title": "F",
                                          "diagram": {"nodes": NODES, "edges": EDGES}}, _refused())])
    assert out["args"]["diagram"].startswith(ROWS_PLACEHOLDER_NOT_STORED)


def test_a_stringified_encoding_is_counted_too():
    args = {"component": "diagram", "title": "F", "diagram": json.dumps({"nodes": NODES, "edges": EDGES})}
    (out,) = redact_artifact_args([_call(args, _stored())])
    assert out["args"]["diagram"] == f"{ROWS_PLACEHOLDER_STORED}{ART_ID}, diagram of 8 steps>"


def test_an_uncountable_encoding_still_gets_a_placeholder():
    (out,) = redact_artifact_args([_call({"component": "diagram", "title": "F", "diagram": "not json"}, _refused())])
    assert out["args"]["diagram"].startswith(ROWS_PLACEHOLDER_NOT_STORED)


def test_untouched_entries_keep_their_identity():
    other = {"tool_call_id": "c0", "name": "search_documents", "args": {"query": "x"}, "result": "[]"}
    tabular_ref = _call({"component": "table", "title": "t", "from_artifact": "table 1", "rows": None},
                        _stored("table", 3))
    new_ref = _call({"component": "diagram", "title": "t", "from_artifact": "table 1", "diagram": None}, _refused())
    out = redact_artifact_args([other, tabular_ref, new_ref])
    assert out[0] is other and out[1] is tabular_ref and out[2] is new_ref


def test_rows_redaction_is_unchanged():
    args = {"component": "table", "title": "t", "columns": [{"name": "a", "type": "string"}],
            "rows": [["x"], ["y"]]}
    (out,) = redact_artifact_args([_call(args, _stored("table", 2))])
    assert out["args"]["rows"] == f"{ROWS_PLACEHOLDER_STORED}{ART_ID}, 2 rows>"
    assert out["args"]["columns"] == args["columns"]


@pytest.mark.parametrize("component", ["diagram", "comparison", "timeline"])
def test_an_echoed_placeholder_is_refused_by_the_validator(component):
    enc = {"diagram": {"nodes": NODES, "edges": EDGES},
           "comparison": {"options": ["a", "b"], "terms": [{"name": "t", "cells": [{"verdict": "y"}] * 2}]},
           "timeline": {"events": [{"date": "2026-01", "title": "x"}]}}[component]
    for result in (_stored(component), _refused()):
        (out,) = redact_artifact_args([_call({"component": component, "title": "x", component: enc}, result)])
        echoed = validate_args(out["args"])
        assert isinstance(echoed, ArtifactRefusal), out["args"]
        assert echoed.reason in ("it sent a reference to a shown artifact, not its data",
                                 "it sent a placeholder from a refused call, not data")
