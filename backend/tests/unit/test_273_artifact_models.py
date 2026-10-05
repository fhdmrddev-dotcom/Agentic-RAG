"""Phase 273-01 — the closed show_artifact vocabulary (D-02, D-03, D-05, D-07, D-09, I-1, I-3).

Every case here is a contract other 273 plans code against:
  * 273-03's handler calls ``validate_args`` and returns ``refusal_payload`` verbatim;
  * 273-04's ``redact_artifact_args`` builds its history placeholders from the two exported prefixes,
    and the reload attach parses ids with ``artifact_id_from_result``;
  * 273-02's frontend guard fences against ``fixtures/artifact_record_v1.json``.

⚠ A refusal ``reason`` is shown to PEOPLE (the rail, L-4). It must come from the closed catalogue,
never from a model string outside the alias table — the ``sunburst`` case asserts that by absence.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.models.artifact import (
    ARTIFACT_COMPONENTS,
    ARTIFACT_RECORD_KEYS,
    CHART_KINDS,
    KIND_ALIASES,
    MAX_ROWS,
    MAX_SERIES,
    MAX_SPEC_BYTES,
    RESULT_ID_KEY,
    ROWS_PLACEHOLDER_NOT_STORED,
    ROWS_PLACEHOLDER_STORED,
    ArtifactRefusal,
    ChartArgs,
    MetricArgs,
    StoredArtifactSpec,
    TableArgs,
    artifact_id_from_result,
    is_refusal_result,
    refusal_payload,
    validate_args,
    validate_dataset,
)

FIXTURE = Path(__file__).parent / "fixtures" / "artifact_record_v1.json"

# ── builders ────────────────────────────────────────────────────────────────────────────────────


def _chart(**over) -> dict:
    base = {
        "component": "chart",
        "title": "Revenue by quarter",
        "columns": [
            {"name": "quarter", "type": "string"},
            {"name": "revenue", "type": "number", "unit": "$K"},
        ],
        "rows": [["Q1", 120], ["Q2", 135], ["Q3", 128], ["Q4", 151]],
        "chart": {"kind": "bar", "x": "quarter", "y": ["revenue"]},
    }
    base.update(over)
    return base


def _series_chart(kind: str, n: int) -> dict:
    cols = [{"name": "month", "type": "string"}] + [
        {"name": f"region {i}", "type": "number"} for i in range(n)
    ]
    rows = [[f"M{m}"] + [m * 10 + i for i in range(n)] for m in range(1, 4)]
    return _chart(columns=cols, rows=rows, chart={"kind": kind, "x": "month", "y": [c["name"] for c in cols[1:]]})


def _table(**over) -> dict:
    base = {
        "component": "table",
        "title": "Deals by region",
        "columns": [
            {"name": "region", "type": "string"},
            {"name": "deals", "type": "number"},
        ],
        "rows": [["Americas", 42], ["EMEA", 31], ["APAC", 18]],
    }
    base.update(over)
    return base


def _metric(**over) -> dict:
    base = {
        "component": "metric",
        "title": "Q4 revenue",
        "columns": [
            {"name": "revenue", "type": "number", "unit": "$K"},
            {"name": "prior", "type": "number", "unit": "$K"},
        ],
        "rows": [[151, 128]],
        "metric": {"value_column": "revenue", "compare_column": "prior"},
    }
    base.update(over)
    return base


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


# ── I-1: the vocabulary is derived and closed ───────────────────────────────────────────────────


def test_components_and_kinds_are_derived_and_exact():
    assert ARTIFACT_COMPONENTS == ("chart", "table", "metric")
    assert CHART_KINDS == ("line", "bar", "area", "scatter")
    assert MAX_ROWS == 500
    assert MAX_SERIES == {"line": 4, "bar": 4, "area": 4, "scatter": 3}
    assert MAX_SPEC_BYTES == 262144
    src = (Path(__file__).resolve().parents[2] / "app" / "models" / "artifact.py").read_text(encoding="utf-8")
    assert src.count("get_args") >= 2


def test_three_components_validate():
    assert isinstance(_ok(_chart()), ChartArgs)
    assert isinstance(_ok(_table()), TableArgs)
    assert isinstance(_ok(_metric()), MetricArgs)


def test_unknown_component_is_refused_with_the_catalogue_reason():
    r = _refused(_chart(component="pie_chart"))
    assert r.reason == "something other than a chart, table or metric"
    assert "pie_chart" not in r.reason
    r2 = _refused({k: v for k, v in _chart().items() if k != "component"})
    assert r2.reason == "something other than a chart, table or metric"


def test_pie_is_named_because_it_is_in_the_alias_table():
    assert "pie" in KIND_ALIASES
    r = _refused(_chart(chart={"kind": "pie", "x": "quarter", "y": ["revenue"]}))
    assert r.reason == '"pie" is not a chart kind'


def test_sunburst_is_never_echoed():
    r = _refused(_chart(chart={"kind": "sunburst", "x": "quarter", "y": ["revenue"]}))
    assert r.reason == "a chart kind we can't draw"
    assert "sunburst" not in r.reason
    assert "sunburst" not in json.dumps(refusal_payload(r)["reason"])


def test_kind_is_case_insensitive():
    assert isinstance(_ok(_chart(chart={"kind": "Bar", "x": "quarter", "y": ["revenue"]})), ChartArgs)


# ── D-02: no open props ─────────────────────────────────────────────────────────────────────────


def test_extra_prop_inside_chart_is_refused():
    r = _refused(_chart(chart={"kind": "bar", "x": "quarter", "y": ["revenue"], "color": "red"}))
    assert r.reason == "its settings weren't valid"


def test_top_level_props_bag_is_refused():
    _refused(_table(props={}))


def test_model_sent_slots_are_refused_server_only():
    _refused(_chart(chart={"kind": "bar", "x": "quarter", "y": ["revenue"], "slots": [0]}))


def test_args_models_carry_no_open_dict_field():
    src = (Path(__file__).resolve().parents[2] / "app" / "models" / "artifact.py").read_text(encoding="utf-8")
    code = "\n".join(line.split("#", 1)[0] for line in src.splitlines())
    assert "dict[str, Any]" not in code
    assert "props:" not in code


# ── D-09: caps refuse, never truncate ───────────────────────────────────────────────────────────


def _rows(n: int) -> list:
    return [[f"day {i}", i] for i in range(n)]


def test_501_rows_refused_aggregate_first():
    r = _refused(_chart(rows=_rows(501)))
    assert r.reason == "501 rows (max 500); aggregate first"


def test_1240_rows_reason_has_a_thousands_separator():
    r = _refused(_chart(rows=_rows(1240)))
    assert r.reason == "1,240 rows (max 500); aggregate first"


def test_500_rows_is_accepted_untruncated():
    out = _ok(_chart(rows=_rows(500)))
    assert len(out.rows) == 500


def test_zero_rows_refused():
    assert _refused(_chart(rows=[])).reason == "no rows to show"
    assert _refused(_chart(rows=None)).reason == "no rows to show"


def test_byte_cap_refused():
    cols = [{"name": f"c{i}", "type": "string"} for i in range(4)]
    rows = [["x" * 200] * 4 for _ in range(400)]  # ~330 KB
    r = _refused(_table(columns=cols, rows=rows))
    assert "KiB" in r.reason


def test_cell_over_200_chars_refused():
    _refused(_table(rows=[["A" * 201, 1]]))


# ── D-05 / UI-D-01: series caps ─────────────────────────────────────────────────────────────────


def test_bar_with_5_series_refused():
    assert _refused(_series_chart("bar", 5)).reason == "5 series (max 4)"


def test_scatter_with_4_series_refused():
    assert _refused(_series_chart("scatter", 4)).reason == "4 series (max 3)"


def test_area_with_4_series_validates():
    _ok(_series_chart("area", 4))


# ── D-03 / Pitfall 3: number coercion ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "cell,expected",
    [(120, 120), (120.5, 120.5), ("120", 120), ("1,234.5", 1234.5), ("-3", -3), (None, None)],
)
def test_number_cells_coerce(cell, expected):
    out = _ok(_chart(rows=[["Q1", cell]]))
    assert out.rows[0][1] == expected
    if expected is not None:
        assert type(out.rows[0][1]) is type(expected)


@pytest.mark.parametrize("cell", ["$120", "12%", "12 kg", "1.2.3", True, "1e3", "12,34"])
def test_non_bare_numbers_refused_with_a_fix_it_detail(cell):
    r = _refused(_chart(rows=[["Q1", 1], ["Q2", cell]]))
    assert "revenue" in r.detail
    assert "rows[1]" in r.detail
    assert "pass bare numbers; put units in `unit`" in r.detail


def test_string_column_numbers_become_text():
    out = _ok(_table(columns=[{"name": "year", "type": "string"}, {"name": "deals", "type": "number"}],
                     rows=[[2024, 3], [2025.0, 4]]))
    assert out.rows == [["2024", 3], ["2025", 4]]


def test_ragged_row_refused_naming_the_row():
    r = _refused(_table(rows=[["Americas", 42], ["EMEA"]]))
    assert "row 2" in r.reason or "rows[1]" in r.detail


def test_duplicate_column_names_refused():
    _refused(_table(columns=[{"name": "region", "type": "string"}, {"name": "region", "type": "number"}]))


def test_missing_encoding_column_is_named_when_safe():
    r = _refused(_chart(chart={"kind": "bar", "x": "quarter", "y": ["profit"]}))
    assert "profit" in r.reason


def test_missing_encoding_column_with_an_unsafe_name_is_generic():
    r = _refused(_chart(chart={"kind": "bar", "x": "quarter", "y": ["<script>alert(1)</script>"]}))
    assert "<script>" not in r.reason
    assert r.reason == "it names a column it doesn't have"


def test_metric_value_column_must_exist():
    r = _refused(_metric(metric={"value_column": "margin"}))
    assert "margin" in r.reason


def test_metric_with_two_rows_refused():
    assert _refused(_metric(rows=[[151, 128], [140, 120]])).reason == "a metric needs exactly one row"


# ── I-4 history placeholders (273-04 redaction) ─────────────────────────────────────────────────


def test_stored_placeholder_points_the_model_at_from_artifact():
    r = _refused(_chart(rows=f"{ROWS_PLACEHOLDER_STORED}a_k3j9x0p2qd, 120 rows>"))
    assert r.reason == "rows were a reference to a shown artifact, not data"
    assert 'from_artifact="a_k3j9x0p2qd"' in r.detail


def test_stored_placeholder_with_a_malformed_id_does_not_copy_it():
    r = _refused(_chart(rows=f"{ROWS_PLACEHOLDER_STORED}a_BAD\"; drop, 120 rows>"))
    assert "a_BAD" not in r.detail
    assert "from_artifact=<the artifact's id or label>" in r.detail


@pytest.mark.parametrize("rows", ["<not stored: refused, 1240 rows>", "<not stored>"])
def test_not_stored_placeholder_asks_for_bare_rows(rows):
    assert rows.startswith(ROWS_PLACEHOLDER_NOT_STORED)
    r = _refused(_chart(rows=rows))
    assert "refused" in r.detail
    assert "aggregate first" in r.detail


def test_placeholder_is_never_a_one_cell_row():
    r = _refused(_table(rows=[f"{ROWS_PLACEHOLDER_STORED}a_k3j9x0p2qd, 3 rows>"]))
    assert r.reason == "rows were a reference to a shown artifact, not data"


# ── Provider shapes: null-filled (Responses strict) and stringified (weak models) ───────────────


def test_null_filled_table_call_validates():
    raw = _table(from_artifact=None, transform=None, chart=None, metric=None)
    raw["columns"] = [dict(c, unit=None) for c in raw["columns"]]
    _ok(raw)


def test_null_filled_chart_call_validates():
    raw = _chart(from_artifact=None, transform=None, metric=None)
    raw["chart"] = dict(raw["chart"], stacked=None)
    _ok(raw)


def test_stringified_nested_args_are_decoded_once():
    raw = _chart()
    raw["columns"] = json.dumps(raw["columns"])
    raw["rows"] = json.dumps(raw["rows"])
    raw["chart"] = json.dumps(raw["chart"])
    out = _ok(raw)
    assert out.rows[3] == ["Q4", 151]


def test_stringified_transform_is_decoded():
    out = _ok({"component": "table", "title": "Q3 only", "from_artifact": "chart 1",
               "transform": json.dumps({"filter": [{"column": "quarter", "op": "eq", "value": "Q3"}]})})
    assert out.transform.filter[0].value == "Q3"


def test_validate_args_never_mutates_the_caller_dict():
    raw = _chart(component="Chart")
    snapshot = json.loads(json.dumps(raw))
    validate_args(raw)
    assert raw == snapshot


# ── D-06 / D-07: by-reference and transforms ────────────────────────────────────────────────────


def test_from_artifact_with_rows_refused():
    r = _refused(_chart(from_artifact="chart 1"))
    assert "pass from_artifact OR rows, not both" in r.detail
    assert "from_artifact" not in r.reason


def test_from_artifact_without_rows_validates():
    out = _ok({"component": "chart", "title": "Only Q3", "from_artifact": "chart 1",
               "chart": {"kind": "bar", "x": "quarter", "y": ["revenue"]},
               "transform": {"filter": [{"column": "quarter", "op": "eq", "value": "Q3"}]}})
    assert out.from_artifact == "chart 1"
    assert out.rows is None


def test_transform_without_from_artifact_refused():
    r = _refused(_chart(transform={"sort": {"column": "revenue", "direction": "desc"}}))
    assert "from_artifact" in r.detail


def test_top_n_without_sort_refused():
    r = _refused({"component": "table", "title": "Top 3", "from_artifact": "table 1",
                  "transform": {"top_n": 3}})
    assert "sort" in r.detail


def test_filter_op_between_refused_closed_set():
    _refused({"component": "table", "title": "x", "from_artifact": "table 1",
              "transform": {"filter": [{"column": "deals", "op": "between", "min": 1, "max": 5}]}})


def test_closed_filter_ops_validate():
    _ok({"component": "table", "title": "x", "from_artifact": "table 1",
         "transform": {"filter": [
             {"column": "region", "op": "in", "values": ["EMEA", "APAC"]},
             {"column": "deals", "op": "range", "min": 10, "max": None},
         ], "select": ["region"], "sort": {"column": "deals", "direction": "asc"}, "top_n": 2}})


def test_no_aggregation_op_exists():
    _refused({"component": "table", "title": "x", "from_artifact": "table 1",
              "transform": {"group_by": "region"}})


# ── validate_dataset takes plain lists (273-03 reuses it after transforms) ──────────────────────


def test_validate_dataset_takes_plain_lists():
    rows, ref = validate_dataset(
        "metric",
        [{"name": "revenue", "type": "number", "unit": None}],
        [["151"]],
        None,
        {"value_column": "revenue", "compare_column": None, "label": None, "compare_label": None},
    )
    assert ref is None
    assert rows == [[151]]
    _, ref2 = validate_dataset("metric", [{"name": "revenue", "type": "number"}], [], None,
                               {"value_column": "revenue"})
    assert ref2 is not None and ref2.reason == "no rows to show"


# ── Refusal payload + result contract (I-3, L-4) ────────────────────────────────────────────────


def test_refusal_payload_has_no_error_key():
    p = refusal_payload(_refused(_chart(rows=_rows(501))))
    assert set(p) == {"status", "reason", "detail"}
    assert p["status"] == "refused"
    assert "error" not in p


def test_refusal_payload_source_has_no_error_literal():
    src = (Path(__file__).resolve().parents[2] / "app" / "models" / "artifact.py").read_text(encoding="utf-8")
    start = src.index("def refusal_payload")
    body = src[start:src.index("\ndef ", start + 1)]
    assert '"error"' not in body


def test_artifact_id_from_result():
    assert RESULT_ID_KEY == "artifact_id"
    assert artifact_id_from_result('{"artifact_id":"a_k3j9x0p2qd","label":"chart 1"}') == "a_k3j9x0p2qd"
    assert artifact_id_from_result(json.dumps(refusal_payload(ArtifactRefusal("no rows to show", "x")))) is None
    assert artifact_id_from_result("not json") is None
    assert artifact_id_from_result('{"artifact_id":"a_k3j9x0p2') is None
    cut = ('{"artifact_id":"a_k3j9x0p2qd","note":"' + "x" * 3000 + '"}')[:2000]
    assert artifact_id_from_result(cut) is None
    assert artifact_id_from_result('{"artifact_id":"a_K3J9X0P2QD"}') is None
    assert artifact_id_from_result('{"artifact_id":"a_k3j9x0p2qdz"}') is None
    assert artifact_id_from_result(None) is None
    assert artifact_id_from_result('["a_k3j9x0p2qd"]') is None


def test_is_refusal_result():
    assert is_refusal_result('{"status":"refused","reason":"no rows to show","detail":"x"}')
    assert not is_refusal_result('{"artifact_id":"a_k3j9x0p2qd"}')
    assert not is_refusal_result("refused")
    assert not is_refusal_result('{"status":"done"}')
    assert not is_refusal_result(None)


# ── Wire fixture (I-2) ──────────────────────────────────────────────────────────────────────────


def _records() -> list[dict]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    head = {k: v for k, v in data.items() if k != "examples"}
    return [head] + list(data["examples"])


def test_fixture_records_match_the_wire_contract():
    recs = _records()
    assert len(recs) == 4
    comps = sorted(r["component"] for r in recs)
    assert comps == ["chart", "chart", "metric", "table"]
    for rec in recs:
        assert set(rec) == ARTIFACT_RECORD_KEYS, set(rec) ^ ARTIFACT_RECORD_KEYS
        assert rec["component"] in ARTIFACT_COMPONENTS
        assert rec["spec_version"] == 1
        assert rec["row_count"] == len(rec["spec"]["rows"]) == rec["caption"]["row_count"]
        assert rec["label"].split(" ")[0] == rec["component"]
        spec = StoredArtifactSpec.model_validate(rec["spec"])
        assert spec.model_dump() == rec["spec"], "the fixture must round-trip unchanged"
        rows, ref = validate_dataset(rec["component"], rec["spec"]["columns"], rec["spec"]["rows"],
                                     rec["spec"]["chart"], rec["spec"]["metric"])
        assert ref is None, ref
        assert rows == rec["spec"]["rows"]


def test_fixture_by_reference_record_carries_lineage():
    by_ref = [r for r in _records() if r["parent_id"]]
    assert len(by_ref) == 1
    lin = by_ref[0]["caption"]["lineage"]
    assert lin["parent_label"] == "chart 1"
    assert lin["operations"][0]["op"] == "filter_eq"


def test_stored_spec_rejects_bad_slots():
    rec = _records()[0]
    bad = json.loads(json.dumps(rec["spec"]))
    bad["chart"]["slots"] = [0]
    with pytest.raises(Exception):
        StoredArtifactSpec.model_validate(bad)
    bad["chart"]["slots"] = [0, 7]
    with pytest.raises(Exception):
        StoredArtifactSpec.model_validate(bad)


# ── Import isolation ────────────────────────────────────────────────────────────────────────────


def test_importing_models_artifact_does_not_import_the_dispatcher():
    backend = Path(__file__).resolve().parents[2]
    code = (
        "import sys; import app.models.artifact; "
        "print('app.services.tool_dispatcher' in sys.modules)"
    )
    out = subprocess.run([sys.executable, "-c", code], cwd=backend, capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "False"
