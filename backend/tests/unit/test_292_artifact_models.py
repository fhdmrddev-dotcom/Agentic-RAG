"""Phase 292-01 — the six-name artifact vocabulary and its three new arms (D-01..D-06, D-09, D-14, D-20).

Every reason asserted here is people-facing (the rail prints it verbatim), so each is the exact
UI-SPEC sentence. Rules the frontend guard does NOT share (a 1-step or 0-link diagram, a source
number < 1, a null-filled call, a placeholder echo) are tested only here, never in the shared
fixture.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.models.artifact import (
    ARTIFACT_COMPONENTS,
    ARTIFACT_LABEL_RE,
    COMPONENT_ALIASES,
    MAX_EDGES,
    MAX_EVENTS,
    MAX_NODES,
    MAX_OPTIONS,
    MAX_TERMS,
    MIN_EDGES,
    MIN_NODES,
    MIN_OPTIONS,
    NODE_ID_RE,
    NODE_KINDS,
    RESULT_KEY_ORDER,
    ROWS_PLACEHOLDER_NOT_STORED,
    ROWS_PLACEHOLDER_STORED,
    TABULAR_COMPONENTS,
    VERDICTS,
    ArtifactRefusal,
    ChartArgs,
    ComparisonArgs,
    DiagramArgs,
    MetricArgs,
    TableArgs,
    TimelineArgs,
    parse_source_handle,
    validate_args,
)

ARTIFACT_PY = Path(__file__).resolve().parents[2] / "app" / "models" / "artifact.py"

# ── builders ─────────────────────────────────────────────────────────────────────────────────────

INVOICE_NODES = [
    {"id": "recv", "label": "Invoice received", "kind": "start"},
    {"id": "ok", "label": "Matches the purchase order?", "kind": "Decision"},
    {"id": "chase", "label": "Query the supplier"},
    {"id": "appr", "label": "Budget holder approves", "kind": "step"},
    {"id": "ctrl", "label": "Finance controller sign-off", "kind": "step"},
    {"id": "sched", "label": "Payment scheduled", "kind": "step"},
    {"id": "paid", "label": "Paid on the next payment run", "kind": "step"},
    {"id": "filed", "label": "Filed for audit", "kind": "end"},
]
INVOICE_EDGES = [
    {"from": "recv", "to": "ok"},
    {"from": "ok", "to": "appr", "label": "Yes"},
    {"from": "ok", "to": "chase", "label": "No"},
    {"from": "chase", "to": "ok", "label": "Corrected invoice"},
    {"from": "chase", "to": "chase", "label": "Reminder after 5 days"},
    {"from": "appr", "to": "ctrl"},
    {"from": "ctrl", "to": "sched"},
    {"from": "sched", "to": "paid"},
    {"from": "paid", "to": "filed"},
]


def _diagram(nodes=None, edges=None, **over) -> dict:
    base = {"component": "diagram", "title": "Invoice approval",
            "diagram": {"nodes": INVOICE_NODES if nodes is None else nodes,
                        "edges": INVOICE_EDGES if edges is None else edges}}
    base.update(over)
    return base


def _chain(n: int) -> tuple[list[dict], list[dict]]:
    nodes = [{"id": f"s{i}", "label": f"Step {i}"} for i in range(1, n + 1)]
    edges = [{"from": f"s{i}", "to": f"s{i + 1}"} for i in range(1, n)]
    return nodes, edges


TWO = [{"id": "a", "label": "Request"}, {"id": "b", "label": "Approve"}]
ONE_EDGE = [{"from": "a", "to": "b"}]


def _comparison(options=None, terms=None, **over) -> dict:
    base = {"component": "comparison", "title": "Contracts",
            "comparison": {"options": ["Atlas", "Northwind"] if options is None else options,
                           "terms": terms if terms is not None else [
                               {"name": "Liability cap", "cells": [{"verdict": "y", "text": "12 months"},
                                                                   {"verdict": "q"}]},
                               {"name": "Notice", "cells": [{"verdict": "n", "text": "90 days"},
                                                            {"verdict": "y", "text": "30 days"}]},
                           ]}}
    base.update(over)
    return base


def _terms(n: int, width: int = 2) -> list[dict]:
    return [{"name": f"Term {i}", "cells": [{"verdict": "y"} for _ in range(width)]} for i in range(1, n + 1)]


def _timeline(events=None, **over) -> dict:
    base = {"component": "timeline", "title": "Contract history",
            "timeline": {"events": events if events is not None else [
                {"date": "2024-02-09", "title": "Amendment"},
                {"date": "2024-02", "title": "Review month"},
                {"date": "2023-12-01", "title": "Signed"},
            ]}}
    base.update(over)
    return base


def _events(n: int) -> list[dict]:
    return [{"date": f"{2020 + i // 12:04d}-{i % 12 + 1:02d}-01", "title": f"Event {i + 1}"} for i in range(n)]


def _refused(raw) -> ArtifactRefusal:
    out = validate_args(raw)
    assert isinstance(out, ArtifactRefusal), f"expected a refusal, got {out!r}"
    assert out.reason and len(out.reason) <= 120, out.reason
    assert out.detail, out
    return out


def _ok(raw):
    out = validate_args(raw)
    assert not isinstance(out, ArtifactRefusal), f"expected valid, got refusal {out!r}"
    return out


# ── D-01 / D-02 / I-1: the closed vocabulary ─────────────────────────────────────────────────────


def test_six_components_and_the_new_literals_are_derived_and_exact():
    assert ARTIFACT_COMPONENTS == ("chart", "table", "metric", "diagram", "comparison", "timeline")
    assert TABULAR_COMPONENTS == ("chart", "table", "metric")
    assert NODE_KINDS == ("start", "step", "decision", "end")
    assert VERDICTS == ("y", "n", "m", "q")
    assert (MIN_NODES, MAX_NODES, MIN_EDGES, MAX_EDGES) == (2, 25, 1, 40)
    assert (MIN_OPTIONS, MAX_OPTIONS, MAX_TERMS, MAX_EVENTS) == (2, 5, 20, 40)


def test_the_literals_are_flat_so_the_frontend_fence_can_read_them():
    src = ARTIFACT_PY.read_text(encoding="utf-8")
    for name, values in (("ComponentName", ARTIFACT_COMPONENTS), ("NodeKind", NODE_KINDS), ("Verdict", VERDICTS)):
        m = re.search(rf"^{name}\s*=\s*Literal\[([^\]]*)\]", src, re.M)
        assert m, name
        assert tuple(re.findall(r'"([^"]+)"', m.group(1))) == values
    assert '"actor"' not in src
    code = "\n".join(line for line in src.splitlines() if not line.lstrip().startswith("#"))
    assert "populate_by_name" not in code


def test_label_regex_is_derived_from_the_six():
    assert ARTIFACT_LABEL_RE.fullmatch("timeline 3")
    assert ARTIFACT_LABEL_RE.fullmatch("diagram 12")
    assert ARTIFACT_LABEL_RE.fullmatch("comparison 1")
    assert ARTIFACT_LABEL_RE.fullmatch("chart 1")
    assert not ARTIFACT_LABEL_RE.fullmatch("steps 1")
    assert not ARTIFACT_LABEL_RE.fullmatch("diagram 0")


def test_result_key_order_is_widened_after_row_count():
    i = RESULT_KEY_ORDER.index("row_count")
    assert RESULT_KEY_ORDER[i + 1:i + 3] == ("edge_count", "option_count")
    assert RESULT_KEY_ORDER[0] == "artifact_id"


def test_node_id_regex():
    assert NODE_ID_RE.fullmatch("step_1.a-b")
    assert not NODE_ID_RE.fullmatch("a b")
    assert not NODE_ID_RE.fullmatch("x" * 41)


# ── unknown component and the closed alias table (UI-D-292-21) ────────────────────────────────────


@pytest.mark.parametrize("word", ["mindmap", "MindMap ", " mindmap"])
def test_alias_component_names_the_alias_key(word):
    r = _refused(_diagram(component=word))
    assert r.reason == '"mindmap" is not an artifact type'


@pytest.mark.parametrize("word", ["flowchart", "pie_chart", "graph", "gantt_chart", "sunburst"])
def test_non_alias_component_gets_the_widened_sentence_and_is_never_echoed(word):
    r = _refused(_diagram(component=word))
    assert r.reason == "something other than a chart, table, metric, diagram, comparison or timeline"
    assert word not in r.reason


def test_missing_component_gets_the_widened_sentence():
    r = _refused({k: v for k, v in _diagram().items() if k != "component"})
    assert r.reason == "something other than a chart, table, metric, diagram, comparison or timeline"


def test_unknown_component_detail_lists_the_six_from_the_literal():
    r = _refused(_diagram(component="flowchart"))
    assert ", ".join(ARTIFACT_COMPONENTS) in r.detail


def test_alias_table_is_closed_and_excludes_flow_words():
    assert set(COMPONENT_ALIASES) == {"mindmap", "mind_map", "gantt", "sankey", "map", "image", "html", "code",
                                      "kanban", "steps", "pie", "donut"}
    for word in ("flowchart", "graph", "gantt_chart"):
        assert word not in COMPONENT_ALIASES
    assert _refused(_diagram(component="pie")).reason == '"pie" is not an artifact type'


# ── diagram (D-04) ──────────────────────────────────────────────────────────────────────────────


def test_invoice_flow_validates_with_kind_defaults_and_lower_case():
    out = _ok(_diagram())
    assert isinstance(out, DiagramArgs)
    kinds = {n.id: n.kind for n in out.diagram.nodes}
    assert kinds["chase"] == "step"
    assert kinds["ok"] == "decision"
    assert len(out.diagram.nodes) == 8 and len(out.diagram.edges) == 9
    dumped = out.diagram.model_dump(by_alias=True)
    assert dumped["edges"][0]["from"] == "recv"
    assert "from_" not in json.dumps(dumped)


def test_labelled_self_loop_validates_and_unlabelled_is_refused():
    _ok(_diagram(TWO, ONE_EDGE + [{"from": "a", "to": "a", "label": "retry"}]))
    r = _refused(_diagram(TWO, ONE_EDGE + [{"from": "a", "to": "a"}]))
    assert r.reason == "a step links to itself without a label"
    r2 = _refused(_diagram(TWO, ONE_EDGE + [{"from": "a", "to": "a", "label": "   "}]))
    assert r2.reason == "a step links to itself without a label"


def test_too_many_and_too_few_nodes_and_edges():
    nodes, edges = _chain(26)
    assert _refused(_diagram(nodes, edges)).reason == "26 steps (max 25); group related steps first"
    assert _refused(_diagram(TWO[:1], [])).reason == "a diagram needs at least 2 steps"
    assert _refused(_diagram(TWO, [])).reason == "a diagram needs at least 1 link"
    ten = [{"id": f"n{i}", "label": f"Step {i}"} for i in range(10)]
    pairs = [(i, j) for i in range(10) for j in range(10) if i < j][:41]
    edges41 = [{"from": f"n{i}", "to": f"n{j}"} for i, j in pairs]
    assert _refused(_diagram(ten, edges41)).reason == "41 links (max 40); group related steps first"
    _ok(_diagram(ten, edges41[:40]))
    nodes25, edges25 = _chain(25)
    _ok(_diagram(nodes25, edges25))


def test_graph_reference_rules():
    assert _refused(_diagram(TWO, [{"from": "a", "to": "zz"}])).reason == "a link names a step that isn't in it (zz)"
    dup = [{"id": "a", "label": "One"}, {"id": "a", "label": "Two"}]
    assert _refused(_diagram(dup, [{"from": "a", "to": "a", "label": "x"}])).reason == "two steps share an id"
    twice = [{"from": "a", "to": "b", "label": "first"}, {"from": "a", "to": "b", "label": "second"}]
    assert _refused(_diagram(TWO, twice)).reason == "two links join the same two steps"


def test_unknown_node_with_markup_is_not_echoed():
    r = _refused(_diagram(TWO, [{"from": "a", "to": "<b>x</b>"}]))
    assert "<b>" not in r.reason


def test_label_caps_count_utf16_units():
    emoji49 = "A" * 47 + "\U0001F600"  # Python len 48, browser length 49
    r = _refused(_diagram([{"id": "a", "label": emoji49}, TWO[1]], ONE_EDGE))
    assert r.reason == "a step name is over 48 characters"
    _ok(_diagram([{"id": "a", "label": "A" * 46 + "\U0001F600"}, TWO[1]], ONE_EDGE))
    r2 = _refused(_diagram(TWO, [{"from": "a", "to": "b", "label": "L" * 25}]))
    assert r2.reason == "a link label is over 24 characters"


def test_unknown_kind_falls_to_fallback_and_detail_names_the_kinds():
    r = _refused(_diagram([{"id": "a", "label": "Requester", "kind": "actor"}, TWO[1]], ONE_EDGE))
    assert r.reason == "its settings weren't valid"
    for k in NODE_KINDS:
        assert k in r.detail
    assert "actor" not in r.reason


def test_no_coordinate_svg_or_mermaid_field_is_accepted():
    for key, val in (("x", 10), ("svg", "<svg/>"), ("mermaid", "graph TD")):
        node = dict(TWO[0], **{key: val})
        _refused(_diagram([node, TWO[1]], ONE_EDGE))
    _refused(_diagram(TWO, ONE_EDGE, svg="<svg/>"))
    _refused({"component": "diagram", "title": "t", "diagram": {"nodes": TWO, "edges": ONE_EDGE, "mermaid": "x"}})


def test_the_edge_key_is_from_and_from_underscore_is_refused():
    _refused(_diagram(TWO, [{"from_": "a", "to": "b"}]))


# ── comparison (D-05) ───────────────────────────────────────────────────────────────────────────


def test_comparison_validates_and_lower_cases_verdicts():
    out = _ok(_comparison(terms=[{"name": "T", "cells": [{"verdict": "Y"}, {"verdict": "q", "text": "  "}]}]))
    assert isinstance(out, ComparisonArgs)
    cells = out.comparison.terms[0].cells
    assert [c.verdict for c in cells] == ["y", "q"]
    assert cells[1].text is None


def test_option_counts():
    assert _refused(_comparison(["Atlas"], [{"name": "T", "cells": [{"verdict": "y"}]}])).reason == "1 options (2 to 5)"
    six = [f"O{i}" for i in range(6)]
    assert _refused(_comparison(six, _terms(1, 6))).reason == "6 options (2 to 5)"
    assert _refused(_comparison(["A", "A"], _terms(1))).reason == "two options share a name"
    _ok(_comparison([f"O{i}" for i in range(5)], _terms(20, 5)))


def test_term_counts_and_ragged_terms():
    assert _refused(_comparison(terms=_terms(21))).reason == "21 terms (max 20)"
    assert _refused(_comparison(terms=[])).reason == "it has no terms to show"
    ragged = [{"name": "T1", "cells": [{"verdict": "y"}, {"verdict": "n"}]},
              {"name": "T2", "cells": [{"verdict": "y"}, {"verdict": "n"}, {"verdict": "m"}]}]
    assert _refused(_comparison(terms=ragged)).reason == "term 2 has 3 cells for 2 options"


def test_bad_verdict_and_text_caps():
    r = _refused(_comparison(terms=[{"name": "T", "cells": [{"verdict": "x"}, {"verdict": "n"}]}]))
    assert r.reason == "its settings weren't valid"
    for v in VERDICTS:
        assert v in r.detail
    long_cell = [{"name": "T", "cells": [{"verdict": "y", "text": "t" * 201}, {"verdict": "n"}]}]
    assert _refused(_comparison(terms=long_cell)).reason == "a cell's text is over 200 characters"
    assert _refused(_comparison(["O" * 41, "B"], _terms(1))).reason == "an option name is over 40 characters"
    long_term = [{"name": "T" * 61, "cells": [{"verdict": "y"}, {"verdict": "n"}]}]
    assert _refused(_comparison(terms=long_term)).reason == "a term name is over 60 characters"


# ── timeline (D-06) ─────────────────────────────────────────────────────────────────────────────


def test_timeline_validates_with_mixed_precision_and_default_deadline():
    out = _ok(_timeline([{"date": "2026-03", "title": "Month"}, {"date": "2026-03-14", "title": "Day"}]))
    assert isinstance(out, TimelineArgs)
    assert [e.deadline for e in out.timeline.events] == [False, False]


@pytest.mark.parametrize("bad", ["2026-13-01", "2026-02-30", "24 Oct 2026", "2026-3-1", "2026", "2026-00"])
def test_bad_dates_are_refused_naming_the_event(bad):
    events = [{"date": "2026-01-01", "title": "One"}, {"date": "2026-02-01", "title": "Two"},
              {"date": bad, "title": "Three"}]
    assert _refused(_timeline(events)).reason == "event 3 has a date that isn't YYYY-MM-DD or YYYY-MM"


def test_event_counts_and_text_caps():
    assert _refused(_timeline(_events(41))).reason == "41 events (max 40)"
    _ok(_timeline(_events(40)))
    assert _refused(_timeline([])).reason == "it has no events to show"
    assert _refused(_timeline([{"date": "2026-01-01", "title": "T" * 81}])).reason == \
        "an event title is over 80 characters"
    assert _refused(_timeline([{"date": "2026-01-01", "title": "t", "detail": "d" * 201}])).reason == \
        "an event detail is over 200 characters"
    assert _refused(_timeline([{"date": "2026-01-01", "title": "t", "category": "c" * 25}])).reason == \
        "a category is over 24 characters"


def test_deadline_must_be_a_boolean():
    r = _refused(_timeline([{"date": "2026-01-01", "title": "t", "deadline": "yes"}]))
    assert r.reason == "its settings weren't valid"
    out = _ok(_timeline([{"date": "2026-01-01", "title": "t", "deadline": True}]))
    assert out.timeline.events[0].deadline is True


def test_no_today_field_exists():
    _refused(_timeline(today="2026-10-24"))
    _refused({"component": "timeline", "title": "t",
              "timeline": {"events": [{"date": "2026-01-01", "title": "t"}], "today": "2026-10-24"}})


# ── source handles (D-07, Pitfall 3) ─────────────────────────────────────────────────────────────


def test_source_handle_parsing():
    assert parse_source_handle(None) is None
    assert parse_source_handle(3) == 3
    assert parse_source_handle("3") == 3
    assert parse_source_handle("[3]") == 3
    assert parse_source_handle(3.0) == 3  # Gemini sends integers as floats
    for bad in (True, False, 0, -1, "x", "[0]", 2.5, [], {}):
        with pytest.raises(ValueError):
            parse_source_handle(bad)


@pytest.mark.parametrize("handle,expect", [("3", 3), ("[3]", 3), (2, 2)])
def test_source_handles_are_normalised_to_int(handle, expect):
    nodes = [dict(TWO[0], source=handle), TWO[1]]
    out = _ok(_diagram(nodes, ONE_EDGE))
    assert out.diagram.nodes[0].source == expect


@pytest.mark.parametrize("handle", [True, False, 0, -1, "x", "Policy.pdf"])
def test_bad_source_handles_are_refused(handle):
    _refused(_diagram([dict(TWO[0], source=handle), TWO[1]], ONE_EDGE))
    _refused(_comparison(terms=[{"name": "T", "cells": [{"verdict": "y", "source": handle}, {"verdict": "n"}]}]))
    _refused(_timeline([{"date": "2026-01-01", "title": "t", "source": handle}]))


def test_source_true_never_resolves_to_one():
    out = validate_args(_diagram([dict(TWO[0], source=True), TWO[1]], ONE_EDGE))
    assert isinstance(out, ArtifactRefusal)


# ── null-fill (Pitfall 1) and foreign fields ──────────────────────────────────────────────────────

_NULLS = {"diagram": None, "comparison": None, "timeline": None}


def test_tabular_arms_accept_null_new_encodings():
    chart = {"component": "chart", "title": "Revenue", "columns": [{"name": "q", "type": "string"},
                                                                   {"name": "r", "type": "number"}],
             "rows": [["Q1", 1]], "chart": {"kind": "bar", "x": "q", "y": ["r"]}, "metric": None,
             "from_artifact": None, "transform": None, **_NULLS}
    assert isinstance(_ok(chart), ChartArgs)
    table = {"component": "table", "title": "T", "columns": [{"name": "q", "type": "string"}], "rows": [["a"]],
             "chart": None, "metric": None, **_NULLS}
    assert isinstance(_ok(table), TableArgs)
    metric = {"component": "metric", "title": "M", "columns": [{"name": "v", "type": "number"}], "rows": [[1]],
              "metric": {"value_column": "v"}, "chart": None, **_NULLS}
    assert isinstance(_ok(metric), MetricArgs)


def test_tabular_arm_with_a_non_null_new_encoding_is_refused():
    table = {"component": "table", "title": "T", "columns": [{"name": "q", "type": "string"}], "rows": [["a"]],
             "diagram": {"nodes": TWO, "edges": ONE_EDGE}}
    _refused(table)


def test_new_arms_accept_a_full_null_fill():
    fill = {"from_artifact": None, "columns": None, "rows": None, "transform": None, "chart": None, "metric": None}
    _ok({**_diagram(), **fill, "comparison": None, "timeline": None})
    _ok({**_comparison(), **fill, "diagram": None, "timeline": None})
    _ok({**_timeline(), **fill, "diagram": None, "comparison": None})


def test_new_arm_with_rows_chart_or_another_encoding_is_worded():
    for extra in ({"rows": [["a"]]}, {"chart": {"kind": "bar", "x": "a", "y": ["b"]}},
                  {"columns": [{"name": "a", "type": "string"}]},
                  {"comparison": {"options": ["a", "b"], "terms": _terms(1)}}):
        r = _refused(_diagram(**extra))
        assert r.reason != "its settings weren't valid", extra
        assert "{" not in r.reason


def test_new_arm_without_its_encoding_is_refused():
    assert _refused({"component": "diagram", "title": "t"}).reason == "it has no steps to show"
    assert _refused({"component": "comparison", "title": "t"}).reason == "it has no terms to show"
    assert _refused({"component": "timeline", "title": "t"}).reason == "it has no events to show"


def test_from_artifact_on_a_new_arm_passes_validation_for_the_handler_to_word():
    out = _ok({"component": "diagram", "title": "t", "from_artifact": "table 1"})
    assert out.from_artifact == "table 1"
    assert _ok({"component": "diagram", "title": "t", "from_artifact": "  ", **{"diagram": _diagram()["diagram"]}}
               ).from_artifact is None


# ── placeholders (D-11) ──────────────────────────────────────────────────────────────────────────


def test_a_stored_placeholder_echo_is_refused():
    r = _refused(_diagram(diagram=ROWS_PLACEHOLDER_STORED + "a_k3j9x0p2qd, diagram of 8 steps>"))
    assert r.reason == "it sent a reference to a shown artifact, not its data"
    r2 = _refused(_comparison(comparison=ROWS_PLACEHOLDER_NOT_STORED + ": refused, comparison of 7 terms>"))
    assert r2.reason == "it sent a placeholder from a refused call, not data"


# ── stringified nested JSON (Pitfall 5) ──────────────────────────────────────────────────────────


def test_stringified_nesting_is_decoded_once_per_level():
    inner = {"nodes": json.dumps(TWO), "edges": json.dumps(ONE_EDGE)}
    out = _ok({"component": "diagram", "title": "t", "diagram": json.dumps(inner)})
    assert [n.id for n in out.diagram.nodes] == ["a", "b"]
    terms = json.dumps([{"name": "T", "cells": json.dumps([{"verdict": "y"}, {"verdict": "n"}])}])
    _ok({"component": "comparison", "title": "t", "comparison": {"options": json.dumps(["A", "B"]), "terms": terms}})
    _ok({"component": "timeline", "title": "t", "timeline": {"events": json.dumps(_events(2))}})


def test_a_doubly_stringified_list_is_refused():
    twice = json.dumps(json.dumps(TWO))
    _refused({"component": "diagram", "title": "t", "diagram": {"nodes": twice, "edges": ONE_EDGE}})


def test_every_refusal_reason_is_people_safe():
    for raw in (_diagram(TWO, [{"from": "a", "to": "zz"}]), _comparison(terms=_terms(21)),
                _timeline([{"date": "bad", "title": "t"}]), _diagram(component="mindmap")):
        r = _refused(raw)
        for key in ("nodes", "edges", "verdict", "events", "component", "{", "}"):
            assert key not in r.reason, (key, r.reason)


# ── the show_artifact schema (D-09 / D-10 / I-4) ─────────────────────────────────────────────────


def _walk(node, visit):
    if isinstance(node, dict):
        visit(node)
        for v in node.values():
            _walk(v, visit)
    elif isinstance(node, list):
        for v in node:
            _walk(v, visit)


def test_schema_enums_derive_from_the_literals():
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    props = SHOW_ARTIFACT_TOOL["function"]["parameters"]["properties"]
    assert props["component"]["enum"] == list(ARTIFACT_COMPONENTS)
    node = props["diagram"]["properties"]["nodes"]["items"]["properties"]
    assert node["kind"]["enum"] == list(NODE_KINDS)
    assert node["kind"]["type"] == "string"
    cell = props["comparison"]["properties"]["terms"]["items"]["properties"]["cells"]["items"]["properties"]
    assert cell["verdict"]["enum"] == list(VERDICTS)
    assert cell["verdict"]["type"] == "string"
    ev = props["timeline"]["properties"]["events"]["items"]["properties"]
    assert set(ev) == {"date", "title", "detail", "category", "deadline", "source"}
    for key in ("diagram", "comparison", "timeline"):
        assert props[key]["type"] == ["object", "null"]
    assert SHOW_ARTIFACT_TOOL["function"]["parameters"]["required"] == ["component", "title"]


def test_schema_has_no_union_keywords_and_no_coordinates():
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    found, names = [], []
    params = SHOW_ARTIFACT_TOOL["function"]["parameters"]
    _walk(params, lambda d: found.extend(k for k in ("anyOf", "oneOf", "allOf", "additionalProperties") if k in d))
    _walk(params, lambda d: names.extend(d["properties"]) if isinstance(d.get("properties"), dict) else None)
    assert found == []
    for banned in ("x_pos", "y_pos", "svg", "mermaid", "today", "document", "page", "excerpt"):
        assert banned not in names, banned


def test_schema_converts_for_gemini_with_the_new_objects():
    from app.services.google_service import _convert_tools_to_google
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    converted = _convert_tools_to_google([SHOW_ARTIFACT_TOOL])
    dumped = [t.model_dump(mode="json", exclude_none=True) for t in converted]
    bad = []
    _walk(dumped, lambda d: bad.append(d["type"]) if isinstance(d.get("type"), list) else None)
    assert bad == []
    text = json.dumps(dumped)
    for needle in ("diagram", "comparison", "timeline", '"from"', "verdict"):
        assert needle in text, needle


def test_description_names_the_six_and_defines_the_verdicts():
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    desc = SHOW_ARTIFACT_TOOL["function"]["description"]
    assert len(desc) <= 3000, len(desc)
    for word in ARTIFACT_COMPONENTS:
        assert word in desc, word
    for needle in ("favourable", "unfavourable", "not stated in what was retrieved", "send the data again",
                   "Use a table for anything else", "YYYY-MM-DD"):
        assert needle in desc, needle
    # the chart example stays FIRST and still validates
    start = desc.index('{"component"')
    example, _ = json.JSONDecoder().raw_decode(desc[start:])
    assert example["component"] == "chart"
    assert isinstance(_ok(example), ChartArgs)


def test_tool_count_is_still_thirty():
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    assert len(_TOOL_REGISTRY) == 30
